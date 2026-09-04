const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const systems=require("./field-systems");

const game=fs.readFileSync("game.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const field=fs.readFileSync("field-systems.js","utf8");

test("all five selected secondaries are real limited-use mission tools",()=>{
  assert.deepEqual(Object.keys(systems.SECONDARY_DEFS).sort(),["flare","med-drone","shock","smoke","tranq-kit"]);
  for(const item of Object.values(systems.SECONDARY_DEFS)){
    assert(item.charges>0,`${item.name} needs mission charges`);
    assert(item.cooldown>0,`${item.name} needs a cooldown`);
  }
  assert(html.includes('id="touchSecondaryBtn"')&&html.includes('id="combatSecondaryActionBtn"'));
  assert(game.includes("resetMissionSecondaryForMission")&&game.includes("renderSecondaryHud")&&game.includes("drawMissionSecondaryEffects"));
});

test("mission tools consume a charge only after a real effect succeeds",()=>{
  const oldState=global.S;
  const oldDocument=global.document;
  global.document={getElementById:()=>null};
  try{
    global.S={
      mode:"Story",paused:false,missionEnded:false,gameOver:false,_missionRunId:"tools:1",
      worldMapPrepLast:{secondaryId:"smoke"},me:{x:50,y:50},
      tigers:[{id:1,x:70,y:50,hp:100,hpMax:100,alive:true,holdUntil:0}],civilians:[],
    };
    systems.resetMissionSecondaryForMission(global.S);
    const before=global.S.missionSecondary.charges;
    systems.useSelectedMissionSecondary();
    assert.equal(global.S.missionSecondary.charges,before-1);
    assert(global.S.secondarySmokeUntil>Date.now());
    assert(global.S.tigers[0].holdUntil>Date.now());

    global.S={
      mode:"Story",paused:false,missionEnded:false,gameOver:false,_missionRunId:"tools:2",
      worldMapPrepLast:{secondaryId:"med-drone"},me:{x:50,y:50},hp:100,
      tigers:[],civilians:[],
    };
    systems.resetMissionSecondaryForMission(global.S);
    const unused=global.S.missionSecondary.charges;
    systems.useSelectedMissionSecondary();
    assert.equal(global.S.missionSecondary.charges,unused,"a failed Med Drone search must not waste a charge");
  }finally{
    global.S=oldState;
    global.document=oldDocument;
  }
});

test("government scene has four answers, physical cuffs, movement, and no free-complete buttons",()=>{
  assert.equal(systems.QUESTIONS.length,3);
  systems.QUESTIONS.forEach((question)=>assert.equal(question.choices.length,4));
  assert(field.includes("attemptGovernmentLockpick")&&field.includes("lockpickTrack"));
  assert(field.includes("chooseGovernmentRun")&&field.includes("moveGovernmentEscape"));
  assert(field.includes("moveGovernmentTraining")&&field.includes("governmentTrainingAction"));
  assert(!field.includes("Complete Task"));
  assert(!field.includes("Complete Escape Step"));
  assert(!game.includes("program.rehabilitationTaskStep+=1"));
  assert(!game.includes("program.escapeStep+=1"));
});

test("questioning passes only when every answer is correct",()=>{
  assert.equal(systems.answerOutcome([{correct:true},{correct:true},{correct:true}]),true);
  assert.equal(systems.answerOutcome([{correct:true},{correct:false},{correct:true}]),false);
  assert.equal(systems.answerOutcome([{correct:true},{correct:true}]),false);
});

test("escape and rehabilitation movement respects room barriers",()=>{
  assert.deepEqual(systems.moveCell({x:0,y:4},1,0,["1,4"]),{x:0,y:4,blocked:true});
  assert.deepEqual(systems.moveCell({x:0,y:4},0,-1,[]),{x:0,y:3,blocked:false});
  assert.deepEqual(systems.moveCell({x:0,y:0},-1,0,[]),{x:0,y:0,blocked:false});
});

test("the three rehabilitation activities are actual mission definitions",()=>{
  assert.deepEqual(systems.REHAB_MISSIONS.map((mission)=>mission.title),[
    "Nonlethal Certification",
    "Civilian Rescue Exercise",
    "Wildlife Transfer Duty",
  ]);
  assert(html.includes("field-systems.js?v=5053-shared-story-chapter-3"));
});
