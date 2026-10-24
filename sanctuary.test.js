const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const sanctuary=require("./sanctuary");

const game=fs.readFileSync("game.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const squadClient=fs.readFileSync("squad-coop.js","utf8");
const squadServer=fs.readFileSync("api/_lib/squad-session.js","utf8");

test("V11.4 has four real sanctuary facilities with gameplay benefits",()=>{
  assert.equal(sanctuary.VERSION,"11.4");
  assert.deepEqual(sanctuary.FACILITY_DEFS.map((row)=>row.id),["habitat","clinic","ranger","transport"]);
  let state=sanctuary.defaultState();
  const upgraded=sanctuary.upgradeFacility(state,"clinic",50000);
  assert.equal(upgraded.applied,true);
  state=upgraded.state;
  assert(sanctuary.missionBenefits(state).captureWindowBonus>0);
  assert(sanctuary.missionBenefits(state).carePerMission>6);
});

test("captured tigers become persistent named residents exactly once",()=>{
  let state=sanctuary.defaultState();
  const first=sanctuary.addCapture(state,{id:"T-1",alias:"River Claw",type:"Alpha",boss:true},{runId:"RUN-1",receipt:"RUN-1:T-1",mission:20});
  assert.equal(first.applied,true);
  assert.equal(first.state.residents.length,1);
  assert.equal(first.state.residents[0].name,"River Claw");
  assert.equal(first.state.residents[0].boss,true);
  const duplicate=sanctuary.addCapture(first.state,{id:"T-1",alias:"River Claw"},{receipt:"RUN-1:T-1"});
  assert.equal(duplicate.applied,false);
  assert.equal(duplicate.reason,"duplicate");
  assert.equal(duplicate.state.residents.length,1);
});

test("habitat capacity never deletes extra captures",()=>{
  let state=sanctuary.defaultState();
  for(let i=0;i<6;i++) state=sanctuary.addCapture(state,{id:`T-${i}`,name:`Tiger ${i}`},{receipt:`R-${i}`,capturedAt:100+i}).state;
  let summary=sanctuary.collectionSummary(state);
  assert.equal(summary.active,4);
  assert.equal(summary.holding,2);
  const upgrade=sanctuary.upgradeFacility(state,"habitat",50000);
  summary=sanctuary.collectionSummary(upgrade.state);
  assert.equal(summary.active,6);
  assert.equal(summary.holding,0);
  assert.equal(summary.capacity,8);
});

test("mission care is receipt guarded and prepares humane releases",()=>{
  let state=sanctuary.addCapture(sanctuary.defaultState(),{id:"T-CARE",name:"Hope"},{receipt:"CAP",condition:82}).state;
  state=sanctuary.upgradeFacility(state,"clinic",50000).state;
  const cared=sanctuary.advanceCare(state,"MISSION-7",{captures:1});
  assert.equal(cared.applied,true);
  assert.equal(cared.state.residents[0].releaseReady,true);
  const duplicate=sanctuary.advanceCare(cared.state,"MISSION-7",{captures:1});
  assert.equal(duplicate.applied,false);
  assert.equal(duplicate.reason,"duplicate");
});

test("release requires health and a genuinely restored Living World district",()=>{
  let state=sanctuary.addCapture(sanctuary.defaultState(),{id:"T-REL",name:"Dawn"},{receipt:"CAP",condition:100}).state;
  state.residents[0].releaseReady=true;
  const districts=[{id:"safe",name:"Safe Valley"},{id:"unsafe",name:"Red Marsh"}];
  const living={districts:{safe:{settlementSafety:80,tigerPressure:25},unsafe:{settlementSafety:20,tigerPressure:90}}};
  const target=sanctuary.releaseTarget(districts,living);
  assert.equal(target.definition.id,"safe");
  const released=sanctuary.releaseResident(state,"T-REL",target);
  assert.equal(released.applied,true);
  assert.equal(released.state.residents.length,0);
  assert.equal(released.state.archive.length,1);
  assert(released.reward>0);
  assert(released.pressureRelief>0);
});

test("government path visibly changes the same headquarters identity",()=>{
  assert.equal(sanctuary.baseIdentity({trust:90,status:"GOOD_STANDING"}).id,"official");
  assert.equal(sanctuary.baseIdentity({trust:30,status:"FUNDING_SUSPENDED",funded:false}).id,"independent");
  assert.equal(sanctuary.baseIdentity({path:"GONE_ROGUE"}).id,"rogue");
});

test("game integration makes sanctuary persistent, useful, and reachable",()=>{
  assert(html.includes("sanctuary.js?v=5251-combat-clarity"));
  assert(html.indexOf("sanctuary.js?v=5251-combat-clarity")<html.indexOf("game.js?v=5251-combat-clarity"));
  assert(game.includes('"cosmeticCollection","sanctuary","achievements"'));
  assert(game.includes("recordSanctuaryCapture(tiger, source)"));
  assert(game.includes("advanceSanctuaryAfterMission(S._missionRunId, missionStats)"));
  assert(game.includes("captureWindowBonus"));
  assert(game.includes("rubberAmmoMinimum"));
  assert(game.includes("baseHqSanctuaryHtml()"));
  assert(game.includes("releaseSanctuaryResident"));
});

test("Shared Story keeps a separate server-backed sanctuary and read-only leader visit",()=>{
  assert(squadServer.includes('const sanctuarySystem = require("../../sanctuary")'));
  assert(squadServer.includes("profile.sanctuary = sanctuarySystem.addCapture"));
  assert(squadServer.includes("sanctuarySystem.advanceCare"));
  assert(squadServer.includes("leaderSanctuary:"));
  assert(squadClient.includes("function leaderSanctuaryHtml()"));
  assert(squadClient.includes("never mixes either player's Solo inventory"));
});

test("V11.4 cache key reaches every gameplay asset",()=>{
  assert(html.includes("V13.4 (Combat Targeting &amp; Attack Clarity)"));
  for(const file of ["extraction-geometry.js","ammo-modes.js","government-policy.js","tiger-intelligence.js","living-world.js","mission-map-truth.js","post-campaign.js","sanctuary.js","game.js","story-cinematics.js","field-systems.js","tutorial.js","squad-motion.js","shared-battlefield-renderer.js","squad-coop.js","extraction-qa.js","squad-coop.css"]){
    assert(html.includes(`${file}?v=5251-combat-clarity`),`stale cache key for ${file}`);
  }
});
