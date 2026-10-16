const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const postCampaign=require("./post-campaign");
const livingWorld=require("./living-world");

const game=fs.readFileSync("game.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const squad=fs.readFileSync("squad-coop.js","utf8");

test("V11.0 exposes exactly three real post-campaign crisis types",()=>{
  assert.equal(postCampaign.VERSION,"11.0");
  assert.deepEqual(postCampaign.CRISIS_TYPES.map((row)=>row.id),[
    "settlement_siege","escaped_alpha","government_raid",
  ]);
  for(const crisis of postCampaign.CRISIS_TYPES){
    assert(crisis.objective.length>30);
    assert(crisis.rewardCash>0);
    assert(crisis.rewardXp>0);
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
  assert(game.includes("returnAfterComplete = true"));
  assert(game.includes("_forceGovernmentResponse"));
  assert(game.includes("openEnding?.(endingInfo.finalChoice, endingInfo)"));
  assert(html.includes("View all 30 command districts")||game.includes("View all 30 command districts"));
});

test("release labels and cache point at V11.0",()=>{
  assert(html.includes("V11.0"));
  assert(html.includes("5221-world-after-ancient-tiger"));
  assert(squad.includes("Tiger Strike V11.0"));
  assert.equal(/V10\.34/.test(squad),false);
});
