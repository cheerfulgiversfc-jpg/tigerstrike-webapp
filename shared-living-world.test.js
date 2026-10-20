const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const postCampaign=require("./post-campaign");
const livingWorld=require("./living-world");
const squad=require("./api/_lib/squad-session");

const server=fs.readFileSync("api/_lib/squad-session.js","utf8");
const client=fs.readFileSync("squad-coop.js","utf8");
const game=fs.readFileSync("game.js","utf8");

function session(typeId, districtId="river_gate", missionLevel=1, playerCount=1){
  const crisis=postCampaign.crisisById(typeId);
  return {
    launchType:crisis.coopLaunchType,
    memberIds:Array.from({length:playerCount},(_,index)=>100+index),
    postCampaignOperation:{
      typeId,
      launchType:crisis.coopLaunchType,
      districtId,
      districtName:"River Gate",
      missionLevel,
      cycle:77,
      runId:`POST-77-${typeId}-${districtId}`,
    },
  };
}

test("all three Living World crises expose a valid squad launch type",()=>{
  assert.deepEqual(squad.POST_CAMPAIGN_LAUNCH_TYPES,[
    "crisis-settlement-siege","crisis-escaped-alpha","crisis-government-raid",
  ]);
  assert.equal(postCampaign.difficultyForPlayers(1).label,"Solo");
  assert.equal(postCampaign.difficultyForPlayers(2).label,"Two Player");
  assert(postCampaign.difficultyForPlayers(2).tigerHpMultiplier>1);
});

test("Settlement Siege keeps its truthful objective and scales for one or two players",()=>{
  const solo=squad.missionDefinition(session("settlement_siege","river_gate",1,1));
  const duo=squad.missionDefinition(session("settlement_siege","river_gate",1,2));
  assert.equal(solo.civilians.length,6);
  assert.equal(solo.tigers.length,8);
  assert.equal(solo.rescueRequired,6);
  assert.equal(solo.playerCount,1);
  assert.equal(duo.playerCount,2);
  assert(duo.tigers[0].hpMax>solo.tigers[0].hpMax);
  assert(duo.timeLimitMs>solo.timeLimitMs);
});

test("Escaped Alpha requires one live capture and Government Raid has separate units",()=>{
  const alpha=squad.missionDefinition(session("escaped_alpha","ancient_guardian_core",93,2));
  assert.equal(alpha.tigers.length,1);
  assert.equal(alpha.captureRequired,1);
  assert.deepEqual(alpha.captureTargetIds,["crisis_escaped_alpha"]);
  assert.equal(alpha.tigers[0].boss,true);

  const raid=squad.missionDefinition(session("government_raid","iron_roar",8,2));
  assert.equal(raid.civilians.length,4);
  assert.equal(raid.tigers.filter((row)=>row.faction!=="government").length,5);
  assert.equal(raid.tigers.filter((row)=>row.faction==="government").length,4);
  assert(raid.tigers.filter((row)=>row.faction==="government").every((row)=>row.capturable===false));
});

test("drop-in, drop-out, reconnect, and once-only reward protections are wired",()=>{
  assert(server.includes("const canDropIn = postCampaignSession(session) && session.status === \"active\""));
  assert(server.includes("if(session.memberIds.length < 2 && !postCampaignSession(session))"));
  assert(server.includes("const crisisDropOut = postCampaignSession(session)"));
  assert(server.includes("post-crisis:${crisisRunId}:${uid}"));
  assert(server.includes("rewardApplied = firstClaim && !profile.rewardReceipts[receipt]"));
  assert(client.includes("Invite Teammate During Crisis"));
  assert(client.includes("openLiveSquadPostCampaignCrisis"));
  assert(game.includes("function recordPostCampaignCoopClaim("));
});

test("two-player crisis deployment requires both server ballots and the leader breaks a split vote",async()=>{
  const host={id:91007801,first_name:"Vote Host"};
  const teammate={id:91007802,first_name:"Vote Teammate"};
  const crisis=session("settlement_siege","river_gate",1,1).postCampaignOperation;
  let room=await squad.createSession(host,{launchType:"crisis-settlement-siege",postCampaignOperation:crisis});
  room=await squad.joinSession(room.code,teammate);
  await assert.rejects(()=>squad.applyAction(room,host,"start"),/Both players must vote/);
  room=await squad.applyAction(room,host,"vote",{optionId:"humane_route"});
  assert.equal(room.crisisVote.resolvedOptionId,"");
  room=await squad.applyAction(room,teammate,"vote",{optionId:"contain_pack"});
  assert.equal(room.crisisVote.resolvedOptionId,"humane_route");
  assert.equal(room.crisisVote.resolvedBy,"leader-tiebreak");
  room=await squad.applyAction(room,host,"start");
  const snapshot=await squad.buildSnapshot(room,host.id);
  assert.equal(snapshot.status,"active");
  assert.equal(snapshot.postCampaignOperation.responseId,"humane_route");
  assert(snapshot.mission.dangerNote.includes("Use the Humane Route"));
});

test("a teammate joining a waiting solo crisis reopens voting for both players",async()=>{
  const host={id:91007811,first_name:"Early Voter"};
  const teammate={id:91007812,first_name:"Late Joiner"};
  const crisis=session("escaped_alpha","ancient_guardian_core",93,1).postCampaignOperation;
  let room=await squad.createSession(host,{launchType:"crisis-escaped-alpha",postCampaignOperation:crisis});
  room=await squad.applyAction(room,host,"vote",{optionId:"rescue_first"});
  assert.equal(room.crisisVote.resolvedOptionId,"rescue_first");
  room=await squad.joinSession(room.code,teammate);
  assert.equal(room.crisisVote.resolvedOptionId,"");
  await assert.rejects(()=>squad.applyAction(room,host,"start"),/Both players must vote/);
});

test("timed event rooms accept only current identities and derive their bonuses on the server",async()=>{
  const host={id:91007821,first_name:"Event Host"};
  const cycle=postCampaign.cycleKey(Date.now());
  const rare=postCampaign.rareEventForCycle(livingWorld.DISTRICTS,livingWorld.defaultState(),cycle);
  if(rare){
    const operation={...postCampaign.operationForEvent(rare),rewardBonusCash:99999999};
    const room=await squad.createSession(host,{launchType:operation.launchType,postCampaignOperation:operation});
    assert.equal(room.postCampaignOperation.eventId,rare.id);
    assert.equal(room.postCampaignOperation.rewardBonusCash,rare.rewardBonusCash);
    await assert.rejects(()=>squad.createSession({...host,id:91007822},{launchType:operation.launchType,postCampaignOperation:{...operation,eventId:`${operation.eventId}-forged`,runId:`${operation.runId}-forged`}}),/no longer available/);
  }
  const emergencyType=postCampaign.EMERGENCY_TYPES[0],district=livingWorld.DISTRICTS[0];
  const event={id:`EMG-${cycle}-${emergencyType.id}-${district.id}`,kind:"emergency",typeId:emergencyType.id,name:emergencyType.name,icon:emergencyType.icon,desc:emergencyType.desc,crisisTypeId:emergencyType.crisisTypeId,districtId:district.id,districtName:district.name,missionLevel:district.minMission,cycle,expiresCycle:cycle+2,rewardBonusCash:99999999};
  const operation=postCampaign.operationForEvent(event);
  const room=await squad.createSession({...host,id:91007823},{launchType:operation.launchType,postCampaignOperation:operation});
  assert.equal(room.postCampaignOperation.rewardBonusCash,5000);
});

test("a real crisis room starts solo, accepts a live teammate, and scales back without failing",async()=>{
  const host={id:91007701,first_name:"Solo Host"};
  const teammate={id:91007702,first_name:"Drop In"};
  const crisis=session("settlement_siege","river_gate",1,1).postCampaignOperation;
  let room=await squad.createSession(host,{launchType:"crisis-settlement-siege",postCampaignOperation:crisis});
  room=await squad.applyAction(room,host,"start");
  let snapshot=await squad.buildSnapshot(room,host.id);
  assert.equal(snapshot.status,"active");
  assert.equal(snapshot.memberCount,1);
  assert.equal(snapshot.mission.difficultyLabel,"Solo");

  room=await squad.joinSession(room.code,teammate);
  snapshot=await squad.buildSnapshot(room,host.id);
  assert.equal(snapshot.memberCount,2);
  assert.equal(snapshot.mission.difficultyLabel,"Two Player");

  await squad.closeSession(room,teammate);
  room=await squad.readSession(room.code);
  snapshot=await squad.buildSnapshot(room,host.id);
  assert.equal(snapshot.status,"active");
  assert.equal(snapshot.memberCount,1);
  assert.equal(snapshot.mission.difficultyLabel,"Solo");
});
