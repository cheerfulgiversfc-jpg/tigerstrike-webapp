const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const postCampaign=require("./post-campaign");
const livingWorld=require("./living-world");

const game=fs.readFileSync("game.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const squad=fs.readFileSync("squad-coop.js","utf8");

test("V11.2 exposes exactly three real post-campaign crisis types",()=>{
  assert.equal(postCampaign.VERSION,"11.2");
  assert.deepEqual(postCampaign.CRISIS_TYPES.map((row)=>row.id),[
    "settlement_siege","escaped_alpha","government_raid",
  ]);
  for(const crisis of postCampaign.CRISIS_TYPES){
    assert(crisis.objective.length>30);
    assert(crisis.rewardCash>0);
    assert(crisis.rewardXp>0);
    assert(postCampaign.isCrisisLaunchType(crisis.coopLaunchType));
  }
});

test("rotating command board assigns one playable crisis to three different real districts",()=>{
  assert.equal(livingWorld.DISTRICTS.length,30);
  const board=postCampaign.crisisBoard(livingWorld.DISTRICTS,livingWorld.defaultState(),Date.UTC(2026,9,16));
  assert.equal(board.length,3);
  assert.equal(new Set(board.map((row)=>row.districtId)).size,3);
  for(const crisis of board){
    const district=livingWorld.districtById(crisis.districtId);
    assert(district);
    assert(crisis.missionLevel>=district.minMission);
    assert(crisis.missionLevel<=district.maxMission);
  }
});

test("each crisis changes a real Story mission profile",()=>{
  const base={number:55,chapterName:"Chapter 6",objective:"Old",civilians:1,tigers:2,captureRequired:0,endgameHpMul:1,endgameAggroMul:1,endgamePayoutMul:1};
  const siege=postCampaign.applyCrisisProfile(base,{typeId:"settlement_siege",districtId:"whiteout_descent"});
  assert.equal(siege.postCampaignCrisis,true);
  assert.equal(siege.civilians,6);
  assert.equal(siege.tigers,8);
  assert.equal(siege.convoyMission,true);
  const alpha=postCampaign.applyCrisisProfile(base,{typeId:"escaped_alpha",districtId:"ancient_guardian_core"});
  assert.equal(alpha.boss,true);
  assert.equal(alpha.captureRequired,1);
  assert.equal(alpha.tigers,1);
  const raid=postCampaign.applyCrisisProfile(base,{typeId:"government_raid",districtId:"iron_roar"});
  assert.equal(raid.forceGovernmentResponse,true);
  assert.equal(raid.civilians,4);
});

test("Mission 100 ending has distinct capture and lethal movies",()=>{
  assert.equal(postCampaign.ENDING_SCENES.CAPTURE.length,4);
  assert.equal(postCampaign.ENDING_SCENES.KILL.length,4);
  assert.notEqual(postCampaign.ENDING_SCENES.CAPTURE[0].title,postCampaign.ENDING_SCENES.KILL[0].title);
  assert.equal(postCampaign.sceneFor("CAPTURE",5000).title,"A NEW PROTECTORATE");
  assert.equal(postCampaign.sceneFor("KILL",9000).title,"THIRTY DISTRICTS CALL");
  for(const id of ["postCampaignEndingOverlay","postCampaignEndingCanvas","postCampaignEndingCaption","postCampaignEndingReplayBtn"]){
    assert(html.includes(`id="${id}"`),`${id} must exist`);
  }
});

test("post-campaign launch, completion, replay, and save migration are wired",()=>{
  assert(game.includes("function startPostCampaignCrisis("));
  assert(game.includes("function recordPostCampaignCrisisOutcome("));
  assert(game.includes("postCampaignOperation:null"));
  assert(game.includes("postCampaignCompleted:{}"));
  assert(game.includes("postCampaignEndingSeen:false"));
  assert(game.includes("wm.postCampaignCompleted[runId]"),"duplicate crisis rewards need a receipt guard");
  assert(game.includes("if(wm.postCampaignOperation?.active) return \"\";"),"crisis must not also apply the ordinary Story district outcome");
  assert(game.includes("returnAfterComplete = true"));
  assert(game.includes("_forceGovernmentResponse"));
  assert(game.includes("openEnding?.(endingInfo.finalChoice, endingInfo)"));
  assert(html.includes("Rebuild all 30 command districts")||game.includes("Rebuild all 30 command districts"));
});

test("recovery projects have real costs, levels, and district effects",()=>{
  const living=livingWorld.defaultState();
  const recovery=postCampaign.normalizeRecovery(null,livingWorld.DISTRICTS);
  assert.equal(postCampaign.RECOVERY_PROJECTS.length,3);
  const before={...living.districts.river_gate};
  const result=postCampaign.fundRecoveryProject(recovery,living,livingWorld.DISTRICTS,"river_gate","field_clinic",50000);
  assert.equal(result.applied,true);
  assert.equal(result.level,1);
  assert.equal(result.fundsRemaining,40000);
  assert(result.after.settlementSafety>before.settlementSafety);
  assert(result.after.tigerPressure<before.tigerPressure);
  assert(postCampaign.recoveryCost("field_clinic",1)>postCampaign.recoveryCost("field_clinic",0));
});

test("crisis outcomes change only their real district and reject duplicate receipts",()=>{
  const living=livingWorld.defaultState();
  const operation={runId:"POST-88-settlement_siege-river_gate",typeId:"settlement_siege",districtId:"river_gate",districtName:"River Gate"};
  const result=postCampaign.applyCrisisDistrictOutcome(living,operation,{rescues:6,captures:1,kills:0,civiliansLost:0});
  assert.equal(result.applied,true);
  assert(result.after.settlementSafety>result.before.settlementSafety);
  assert(result.after.tigerPressure<result.before.tigerPressure);
  const duplicate=postCampaign.applyCrisisDistrictOutcome(result.state,operation,{rescues:6});
  assert.equal(duplicate.applied,false);
  assert.equal(duplicate.reason,"duplicate");
});

test("high-risk crises spread once per cycle and recovery defenses reduce the damage",()=>{
  const living=livingWorld.defaultState();
  const source=livingWorld.DISTRICTS[0];
  living.districts[source.id].tigerPressure=96;
  living.districts[source.id].bloodScent=100;
  living.districts[source.id].settlementSafety=0;
  const recovery=postCampaign.normalizeRecovery({lastCycle:90},livingWorld.DISTRICTS);
  const spread=postCampaign.advanceCrisisSpread(living,livingWorld.DISTRICTS,recovery,91);
  assert.equal(spread.applied,true);
  assert(spread.events.length>=1);
  const defendedRecovery=postCampaign.normalizeRecovery({lastCycle:90},livingWorld.DISTRICTS);
  const targetId=spread.events[0].targetId;
  for(const project of postCampaign.RECOVERY_PROJECTS) defendedRecovery.projects[targetId][project.id]=project.maxLevel;
  const defended=postCampaign.advanceCrisisSpread(living,livingWorld.DISTRICTS,defendedRecovery,91);
  const defendedEvent=defended.events.find((event)=>event.targetId===targetId);
  assert(defendedEvent);
  assert(defendedEvent.pressureRise<spread.events[0].pressureRise);
  const repeated=postCampaign.advanceCrisisSpread(spread.state,livingWorld.DISTRICTS,spread.recovery,91);
  assert.equal(repeated.applied,false);
  assert.equal(repeated.reason,"already-applied");
});

test("release labels and cache point at V11.2",()=>{
  assert(html.includes("V11.2"));
  assert(html.includes("5223-living-district-recovery"));
  assert(squad.includes("Tiger Strike V11.2"));
  assert.equal(/V10\.34/.test(squad),false);
});
