const assert = require("assert");
const {
  createSession,
  joinSession,
  readSession,
  buildSnapshot,
  applyAction,
  claimReward,
} = require("./squad-session");
const { getState, setState } = require("./metrics-store");

const host = { id:910001, first_name:"Host" };
const teammate = { id:910002, first_name:"Teammate" };

function playerStateKey(code, userId){
  return `live_squad_player_${code}_${userId}`;
}

async function writePlayerPatch(code, userId, patch){
  const key = playerStateKey(code, userId);
  const current = await getState(key);
  assert(current, `missing player ${userId}`);
  await setState(key, { ...current, ...patch });
}

async function run(){
  let session = await createSession(host, { launchType:"shared-story", storyMissionLevel:1 });
  const code = session.code;
  session = await joinSession(code, teammate);
  assert.equal(session.memberIds.length, 2, "both players join");

  session = await applyAction(session, host, "start");
  let snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.status, "active", "Mission 1 starts");
  assert.equal(snapshot.mission.level, 1, "real Story Mission 1 is selected");
  assert(snapshot.world.width >= 3800 && snapshot.world.height >= 2100, "co-op uses a Story-sized Mission 1 world");
  assert(snapshot.players.every((player)=>player.x < snapshot.world.width && player.y < snapshot.world.height), "both players spawn inside the expanded world");
  assert(snapshot.tigers.some((tiger)=>Math.hypot(tiger.x - snapshot.players[0].x, tiger.y - snapshot.players[0].y) > 1200), "objectives are spread across the larger district");

  session = await joinSession(code, host);
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.status, "active", "an existing member reconnects to the active mission");

  for(const user of [host, teammate]){
    await writePlayerPatch(code, user.id, { hp:0, downed:true, livesRemaining:0, respawnAt:0, lastSeenAt:Date.now() });
  }
  snapshot = await buildSnapshot(await readSession(code), host.id);
  assert.equal(snapshot.status, "failed", "both players can wipe after using their field lives");
  assert.equal(snapshot.failureReason, "squad_wipe", "the wipe offers a restart");

  session = await applyAction(await readSession(code), host, "restart");
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.status, "active", "the host restarts the same mission");
  for(const player of snapshot.players){
    assert.equal(player.livesRemaining, 1, "restart restores each field life");
    assert.equal(player.downed, false, "restart stands both players up");
  }

  const startedBeforeGear = snapshot.startedAt;
  session = await applyAction(await readSession(code), host, "pause", { reason:"shop" });
  session = await applyAction(session, teammate, "pause", { reason:"inventory" });
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.paused, true, "opening Shop or Inventory pauses the shared mission");
  assert.equal(snapshot.pausedBy.length, 2, "both open gear screens are tracked");
  assert(snapshot.pausedBy.some((row)=>row.reason === "shop"), "Shop pause is identified");
  assert(snapshot.pausedBy.some((row)=>row.reason === "inventory"), "Inventory pause is identified");

  const rawPausedSession = await getState(`live_squad_session_${code}`);
  await setState(`live_squad_session_${code}`, { ...rawPausedSession, pausedAt:Date.now() - 5000 });
  session = await applyAction(await readSession(code), host, "resume");
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.paused, true, "mission stays paused until every player closes gear");
  session = await applyAction(await readSession(code), teammate, "resume");
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.paused, false, "mission resumes after every gear screen closes");
  assert(snapshot.startedAt >= startedBeforeGear + 4500, "paused time is removed from the mission clock");

  session = await applyAction(await readSession(code), teammate, "pause", { reason:"shop" });
  await writePlayerPatch(code, teammate.id, { lastSeenAt:Date.now() - 31000 });
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.paused, false, "an abandoned gear pause clears after the player disconnects");

  const completedAt = Date.now();
  await writePlayerPatch(code, host.id, {
    x:snapshot.extraction.x,
    y:snapshot.extraction.y,
    rescuedIds:["civ_north","civ_market"],
    tigerDamage:{ tiger_scout:210, tiger_ambush:260 },
    lastSeenAt:completedAt,
  });
  await writePlayerPatch(code, teammate.id, {
    x:snapshot.extraction.x,
    y:snapshot.extraction.y,
    lastSeenAt:completedAt,
  });
  snapshot = await buildSnapshot(await readSession(code), host.id);
  assert.equal(snapshot.status, "complete", "both players finish together");

  const hostReward = await claimReward(await readSession(code), host);
  const teammateReward = await claimReward(await readSession(code), teammate);
  assert.equal(hostReward.firstClaim, true, "host claims once");
  assert.equal(teammateReward.firstClaim, true, "teammate claims once");
  assert.deepEqual(hostReward.storyProgress, { completedLevel:1, unlockLevel:2 }, "Mission 2 unlocks for host");
  assert.deepEqual(teammateReward.storyProgress, { completedLevel:1, unlockLevel:2 }, "Mission 2 unlocks for teammate");
  assert.notEqual(hostReward.receipt, teammateReward.receipt, "players receive separate receipts");

  const hostAgain = await claimReward(await readSession(code), host);
  const teammateAgain = await claimReward(await readSession(code), teammate);
  assert.equal(hostAgain.firstClaim, false, "host cannot receive a second server reward");
  assert.equal(teammateAgain.firstClaim, false, "teammate cannot receive a second server reward");

  for(let level=2; level<=5; level++){
    const levelHost = { id:910100 + (level * 10), first_name:`Host ${level}` };
    const levelMate = { id:910101 + (level * 10), first_name:`Mate ${level}` };
    let levelSession = await createSession(levelHost, { launchType:"shared-story", storyMissionLevel:level });
    levelSession = await joinSession(levelSession.code, levelMate);
    levelSession = await applyAction(levelSession, levelHost, "start");
    let levelSnapshot = await buildSnapshot(levelSession, levelHost.id);
    assert.equal(levelSnapshot.mission.level, level, `Story Mission ${level} keeps its own definition`);
    assert(levelSnapshot.world.width >= 3800 + ((level - 1) * 100), `Story Mission ${level} keeps a large mission world`);
    assert(levelSnapshot.world.height >= 2100, `Story Mission ${level} keeps Story-scale travel depth`);
    assert.equal(levelSnapshot.mission.title, `Story Mission ${level}`, `Story Mission ${level} has an accurate title`);
    assert(levelSnapshot.mission.objective.length > 12, `Story Mission ${level} has a real objective`);
    assert(levelSnapshot.tigers.length >= 1, `Story Mission ${level} has shared tiger gameplay`);
    const clearedAt = Date.now();
    await writePlayerPatch(levelSession.code, levelHost.id, {
      x:levelSnapshot.extraction.x,
      y:levelSnapshot.extraction.y,
      rescuedIds:levelSnapshot.civilians.slice(0, levelSnapshot.mission.rescueRequired).map((c)=>c.id),
      tigerDamage:Object.fromEntries(levelSnapshot.tigers.map((t)=>[t.id, t.hpMax])),
      lastSeenAt:clearedAt,
    });
    await writePlayerPatch(levelSession.code, levelMate.id, {
      x:levelSnapshot.extraction.x,
      y:levelSnapshot.extraction.y,
      lastSeenAt:clearedAt,
    });
    levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
    assert.equal(levelSnapshot.status, "complete", `Story Mission ${level} can be completed by both players`);
    const levelReward = await claimReward(await readSession(levelSession.code), levelHost);
    assert.deepEqual(levelReward.storyProgress, { completedLevel:level, unlockLevel:level + 1 }, `Story Mission ${level} unlocks the correct next mission`);
  }

  const captureHost = { id:910303, first_name:"Capture Host" };
  const captureMate = { id:910304, first_name:"Capture Mate" };
  let captureSession = await createSession(captureHost, { launchType:"shared-story", storyMissionLevel:3 });
  captureSession = await joinSession(captureSession.code, captureMate);
  captureSession = await applyAction(captureSession, captureHost, "start");
  let captureSnapshot = await buildSnapshot(captureSession, captureHost.id);
  const captureTiger = captureSnapshot.tigers[0];
  await writePlayerPatch(captureSession.code, captureHost.id, {
    x:captureTiger.x,
    y:captureTiger.y,
    tigerDamage:{ [captureTiger.id]:Math.ceil(captureTiger.hpMax * 0.71) },
    lastSeenAt:Date.now(),
  });
  await applyAction(await readSession(captureSession.code), captureHost, "capture", { tigerId:captureTiger.id });
  captureSnapshot = await buildSnapshot(await readSession(captureSession.code), captureHost.id);
  assert.equal(captureSnapshot.tigers[0].captured, true, "Mission 3 supports the Story capture choice");
  assert.equal(captureSnapshot.tigers[0].defeated, true, "a captured tiger clears the shared threat");

  const denHost = { id:910401, first_name:"Den Host" };
  const denMate = { id:910402, first_name:"Den Mate" };
  let denSession = await createSession(denHost, { launchType:"tiger-den" });
  denSession = await joinSession(denSession.code, denMate);
  assert.equal(denSession.launchType, "tiger-den", "Tiger Den keeps its own operation identity");
  denSession = await applyAction(denSession, denHost, "start");
  let denSnapshot = await buildSnapshot(denSession, denHost.id);
  assert.equal(denSnapshot.mission.title, "Tiger Den Assault", "Tiger Den has its own mission title");
  assert.equal(denSnapshot.mission.chapterName, "Cave Wilds", "Tiger Den has its own map identity");
  assert.equal(denSnapshot.mission.rescueRequired, 2, "Tiger Den requires both trapped specialists");
  assert.equal(denSnapshot.tigers.length, 4, "Tiger Den has three guards and one Alpha");
  assert.equal(denSnapshot.boss.name, "Stoneclaw Alpha", "Tiger Den has its own boss");
  assert.equal(denSnapshot.mission.timeLimitMs, 8 * 60 * 1000, "Tiger Den uses its eight-minute assault timer");
  assert(denSnapshot.world.width >= 4500 && denSnapshot.world.height >= 2500, "Tiger Den has a full-sized Cave Wilds map");

  const trappedRanger = denSnapshot.civilians[0];
  await writePlayerPatch(denSession.code, denHost.id, { x:trappedRanger.x, y:trappedRanger.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(denSession.code), denHost, "rescue", { civilianId:trappedRanger.id });
  denSnapshot = await buildSnapshot(await readSession(denSession.code), denHost.id);
  assert(denSnapshot.rescuedIds.includes(trappedRanger.id), "Tiger Den specialists use the real shared rescue action");

  const stoneclaw = denSnapshot.boss;
  await writePlayerPatch(denSession.code, denHost.id, { x:stoneclaw.x, y:stoneclaw.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(denSession.code), denHost, "attack", { tigerId:stoneclaw.id });
  denSnapshot = await buildSnapshot(await readSession(denSession.code), denHost.id);
  assert(denSnapshot.boss.hp < denSnapshot.boss.hpMax, "Stoneclaw uses the real shared combat action");

  const denClearedAt = Date.now();
  await writePlayerPatch(denSession.code, denHost.id, {
    x:denSnapshot.extraction.x,
    y:denSnapshot.extraction.y,
    rescuedIds:denSnapshot.civilians.map((civilian)=>civilian.id),
    tigerDamage:Object.fromEntries(denSnapshot.tigers.map((tiger)=>[tiger.id, tiger.hpMax])),
    lastSeenAt:denClearedAt,
  });
  await writePlayerPatch(denSession.code, denMate.id, {
    x:denSnapshot.extraction.x,
    y:denSnapshot.extraction.y,
    lastSeenAt:denClearedAt,
  });
  denSnapshot = await buildSnapshot(await readSession(denSession.code), denHost.id);
  assert.equal(denSnapshot.status, "complete", "Tiger Den can be completed through its real objectives");
  const denHostReward = await claimReward(await readSession(denSession.code), denHost);
  const denMateReward = await claimReward(await readSession(denSession.code), denMate);
  assert.equal(denHostReward.reward.badge, "Stoneclaw Den Breaker", "Tiger Den awards its own badge");
  assert.equal(denHostReward.reward.cash, 8200, "Tiger Den awards its own cash payout");
  assert.equal(denHostReward.storyProgress, null, "Tiger Den never changes Story progress");
  assert.notEqual(denHostReward.receipt, denMateReward.receipt, "both Tiger Den players receive separate receipts");
  const denHostAgain = await claimReward(await readSession(denSession.code), denHost);
  assert.equal(denHostAgain.firstClaim, false, "Tiger Den cannot pay the same player twice in one room");

  const siegeHost = { id:910501, first_name:"Siege Host" };
  const siegeMate = { id:910502, first_name:"Siege Mate" };
  let siegeSession = await createSession(siegeHost, { launchType:"village-siege" });
  siegeSession = await joinSession(siegeSession.code, siegeMate);
  assert.equal(siegeSession.launchType, "village-siege", "Village Siege keeps its own operation identity");
  siegeSession = await applyAction(siegeSession, siegeHost, "start");
  let siegeSnapshot = await buildSnapshot(siegeSession, siegeHost.id);
  assert.equal(siegeSnapshot.mission.title, "Village Siege", "Village Siege has its own mission title");
  assert.equal(siegeSnapshot.mission.chapterName, "Suncrest Village", "Village Siege has its own map identity");
  assert.equal(siegeSnapshot.mission.rescueRequired, 5, "Village Siege requires all five trapped villagers");
  assert.equal(siegeSnapshot.tigers.length, 5, "Village Siege has four siege tigers and one Alpha");
  assert.equal(siegeSnapshot.boss.name, "Ironmane Alpha", "Village Siege has its own boss");
  assert.equal(siegeSnapshot.mission.timeLimitMs, 9 * 60 * 1000, "Village Siege uses its nine-minute siege timer");
  assert(siegeSnapshot.world.width >= 4600 && siegeSnapshot.world.height >= 2600, "Village Siege has a full-sized Suncrest Village map");

  const villageElder = siegeSnapshot.civilians[0];
  await writePlayerPatch(siegeSession.code, siegeHost.id, { x:villageElder.x, y:villageElder.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(siegeSession.code), siegeHost, "rescue", { civilianId:villageElder.id });
  siegeSnapshot = await buildSnapshot(await readSession(siegeSession.code), siegeHost.id);
  assert(siegeSnapshot.rescuedIds.includes(villageElder.id), "Village Siege villagers use the real shared rescue action");

  const ironmane = siegeSnapshot.boss;
  await writePlayerPatch(siegeSession.code, siegeHost.id, { x:ironmane.x, y:ironmane.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(siegeSession.code), siegeHost, "attack", { tigerId:ironmane.id });
  siegeSnapshot = await buildSnapshot(await readSession(siegeSession.code), siegeHost.id);
  assert(siegeSnapshot.boss.hp < siegeSnapshot.boss.hpMax, "Ironmane uses the real shared combat action");

  const siegeClearedAt = Date.now();
  await writePlayerPatch(siegeSession.code, siegeHost.id, {
    x:siegeSnapshot.extraction.x,
    y:siegeSnapshot.extraction.y,
    rescuedIds:siegeSnapshot.civilians.map((civilian)=>civilian.id),
    tigerDamage:Object.fromEntries(siegeSnapshot.tigers.map((tiger)=>[tiger.id, tiger.hpMax])),
    lastSeenAt:siegeClearedAt,
  });
  await writePlayerPatch(siegeSession.code, siegeMate.id, {
    x:siegeSnapshot.extraction.x,
    y:siegeSnapshot.extraction.y,
    lastSeenAt:siegeClearedAt,
  });
  siegeSnapshot = await buildSnapshot(await readSession(siegeSession.code), siegeHost.id);
  assert.equal(siegeSnapshot.status, "complete", "Village Siege can be completed through its real objectives");
  const siegeHostReward = await claimReward(await readSession(siegeSession.code), siegeHost);
  const siegeMateReward = await claimReward(await readSession(siegeSession.code), siegeMate);
  assert.equal(siegeHostReward.reward.badge, "Suncrest Village Shield", "Village Siege awards its own badge");
  assert.equal(siegeHostReward.reward.cash, 9600, "Village Siege awards its own cash payout");
  assert.equal(siegeHostReward.reward.seasonPoints, 20, "Village Siege awards its own season points");
  assert.equal(siegeHostReward.storyProgress, null, "Village Siege never changes Story progress");
  assert.notEqual(siegeHostReward.receipt, siegeMateReward.receipt, "both Village Siege players receive separate receipts");
  const siegeHostAgain = await claimReward(await readSession(siegeSession.code), siegeHost);
  assert.equal(siegeHostAgain.firstClaim, false, "Village Siege cannot pay the same player twice in one room");

  const convoyHost = { id:910601, first_name:"Convoy Host" };
  const convoyMate = { id:910602, first_name:"Convoy Mate" };
  let convoySession = await createSession(convoyHost, { launchType:"convoy-rescue" });
  convoySession = await joinSession(convoySession.code, convoyMate);
  assert.equal(convoySession.launchType, "convoy-rescue", "Convoy Rescue keeps its own operation identity");
  convoySession = await applyAction(convoySession, convoyHost, "start");
  let convoySnapshot = await buildSnapshot(convoySession, convoyHost.id);
  assert.equal(convoySnapshot.mission.title, "Convoy Rescue", "Convoy Rescue has its own mission title");
  assert.equal(convoySnapshot.mission.chapterName, "Redwood Convoy Route", "Convoy Rescue has its own map identity");
  assert.equal(convoySnapshot.mission.rescueRequired, 4, "Convoy Rescue requires all four stranded crew members");
  assert.equal(convoySnapshot.tigers.length, 5, "Convoy Rescue has four ambush tigers and one Alpha");
  assert.equal(convoySnapshot.boss.name, "Roadclaw Alpha", "Convoy Rescue has its own boss");
  assert.equal(convoySnapshot.mission.timeLimitMs, 10 * 60 * 1000, "Convoy Rescue uses its ten-minute route timer");
  assert.equal(convoySnapshot.world.width, 4800, "Convoy Rescue uses the widest supported co-op route");
  assert(convoySnapshot.world.height >= 2700, "Convoy Rescue has a full-height Redwood route map");

  const convoyDriver = convoySnapshot.civilians[0];
  await writePlayerPatch(convoySession.code, convoyHost.id, { x:convoyDriver.x, y:convoyDriver.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(convoySession.code), convoyHost, "rescue", { civilianId:convoyDriver.id });
  convoySnapshot = await buildSnapshot(await readSession(convoySession.code), convoyHost.id);
  assert(convoySnapshot.rescuedIds.includes(convoyDriver.id), "Convoy crew members use the real shared rescue action");

  const roadclaw = convoySnapshot.boss;
  await writePlayerPatch(convoySession.code, convoyHost.id, { x:roadclaw.x, y:roadclaw.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(convoySession.code), convoyHost, "attack", { tigerId:roadclaw.id });
  convoySnapshot = await buildSnapshot(await readSession(convoySession.code), convoyHost.id);
  assert(convoySnapshot.boss.hp < convoySnapshot.boss.hpMax, "Roadclaw uses the real shared combat action");

  const convoyClearedAt = Date.now();
  await writePlayerPatch(convoySession.code, convoyHost.id, {
    x:convoySnapshot.extraction.x,
    y:convoySnapshot.extraction.y,
    rescuedIds:convoySnapshot.civilians.map((civilian)=>civilian.id),
    tigerDamage:Object.fromEntries(convoySnapshot.tigers.map((tiger)=>[tiger.id, tiger.hpMax])),
    lastSeenAt:convoyClearedAt,
  });
  await writePlayerPatch(convoySession.code, convoyMate.id, {
    x:convoySnapshot.extraction.x,
    y:convoySnapshot.extraction.y,
    lastSeenAt:convoyClearedAt,
  });
  convoySnapshot = await buildSnapshot(await readSession(convoySession.code), convoyHost.id);
  assert.equal(convoySnapshot.status, "complete", "Convoy Rescue can be completed through its real objectives");
  const convoyHostReward = await claimReward(await readSession(convoySession.code), convoyHost);
  const convoyMateReward = await claimReward(await readSession(convoySession.code), convoyMate);
  assert.equal(convoyHostReward.reward.badge, "Redwood Convoy Guardian", "Convoy Rescue awards its own badge");
  assert.equal(convoyHostReward.reward.cash, 11200, "Convoy Rescue awards its own cash payout");
  assert.equal(convoyHostReward.reward.perkPoints, 3, "Convoy Rescue awards its own perk points");
  assert.equal(convoyHostReward.reward.seasonPoints, 24, "Convoy Rescue awards its own season points");
  assert.equal(convoyHostReward.storyProgress, null, "Convoy Rescue never changes Story progress");
  assert.notEqual(convoyHostReward.receipt, convoyMateReward.receipt, "both Convoy Rescue players receive separate receipts");
  const convoyHostAgain = await claimReward(await readSession(convoySession.code), convoyHost);
  assert.equal(convoyHostAgain.firstClaim, false, "Convoy Rescue cannot pay the same player twice in one room");

  const alphaHost = { id:910701, first_name:"Alpha Host" };
  const alphaMate = { id:910702, first_name:"Alpha Mate" };
  let alphaSession = await createSession(alphaHost, { launchType:"alpha-hunt" });
  alphaSession = await joinSession(alphaSession.code, alphaMate);
  assert.equal(alphaSession.launchType, "alpha-hunt", "Alpha Hunt keeps its own operation identity");
  alphaSession = await applyAction(alphaSession, alphaHost, "start");
  let alphaSnapshot = await buildSnapshot(alphaSession, alphaHost.id);
  assert.equal(alphaSnapshot.mission.title, "Alpha Hunt", "Alpha Hunt has its own mission title");
  assert.equal(alphaSnapshot.mission.chapterName, "Moonshadow Highlands", "Alpha Hunt has its own map identity");
  assert.equal(alphaSnapshot.mission.rescueRequired, 2, "Alpha Hunt requires both injured trackers");
  assert.equal(alphaSnapshot.tigers.length, 4, "Alpha Hunt has three elite tigers and one Alpha");
  assert.equal(alphaSnapshot.boss.name, "Ghoststripe Alpha", "Alpha Hunt has its own boss");
  assert.equal(alphaSnapshot.boss.hpMax, 2300, "Ghoststripe has the operation's full Alpha health pool");
  assert.equal(alphaSnapshot.mission.timeLimitMs, 11 * 60 * 1000, "Alpha Hunt uses its eleven-minute hunt timer");
  assert.equal(alphaSnapshot.world.width, 4800, "Alpha Hunt uses the full co-op world width");
  assert.equal(alphaSnapshot.world.height, 2800, "Alpha Hunt uses the full co-op world height");

  const leadTracker = alphaSnapshot.civilians[0];
  await writePlayerPatch(alphaSession.code, alphaHost.id, { x:leadTracker.x, y:leadTracker.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(alphaSession.code), alphaHost, "rescue", { civilianId:leadTracker.id });
  alphaSnapshot = await buildSnapshot(await readSession(alphaSession.code), alphaHost.id);
  assert(alphaSnapshot.rescuedIds.includes(leadTracker.id), "Alpha Hunt trackers use the real shared rescue action");

  const ghoststripe = alphaSnapshot.boss;
  await writePlayerPatch(alphaSession.code, alphaHost.id, { x:ghoststripe.x, y:ghoststripe.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(alphaSession.code), alphaHost, "attack", { tigerId:ghoststripe.id });
  alphaSnapshot = await buildSnapshot(await readSession(alphaSession.code), alphaHost.id);
  assert(alphaSnapshot.boss.hp < alphaSnapshot.boss.hpMax, "Ghoststripe uses the real shared combat action");

  const alphaClearedAt = Date.now();
  await writePlayerPatch(alphaSession.code, alphaHost.id, {
    x:alphaSnapshot.extraction.x,
    y:alphaSnapshot.extraction.y,
    rescuedIds:alphaSnapshot.civilians.map((civilian)=>civilian.id),
    tigerDamage:Object.fromEntries(alphaSnapshot.tigers.map((tiger)=>[tiger.id, tiger.hpMax])),
    lastSeenAt:alphaClearedAt,
  });
  await writePlayerPatch(alphaSession.code, alphaMate.id, {
    x:alphaSnapshot.extraction.x,
    y:alphaSnapshot.extraction.y,
    lastSeenAt:alphaClearedAt,
  });
  alphaSnapshot = await buildSnapshot(await readSession(alphaSession.code), alphaHost.id);
  assert.equal(alphaSnapshot.status, "complete", "Alpha Hunt can be completed through its real objectives");
  const alphaHostReward = await claimReward(await readSession(alphaSession.code), alphaHost);
  const alphaMateReward = await claimReward(await readSession(alphaSession.code), alphaMate);
  assert.equal(alphaHostReward.reward.badge, "Ghoststripe Apex Hunter", "Alpha Hunt awards its own badge");
  assert.equal(alphaHostReward.reward.cash, 13000, "Alpha Hunt awards its own cash payout");
  assert.equal(alphaHostReward.reward.perkPoints, 3, "Alpha Hunt awards its own perk points");
  assert.equal(alphaHostReward.reward.seasonPoints, 28, "Alpha Hunt awards its own season points");
  assert.equal(alphaHostReward.storyProgress, null, "Alpha Hunt never changes Story progress");
  assert.notEqual(alphaHostReward.receipt, alphaMateReward.receipt, "both Alpha Hunt players receive separate receipts");
  const alphaHostAgain = await claimReward(await readSession(alphaSession.code), alphaHost);
  assert.equal(alphaHostAgain.firstClaim, false, "Alpha Hunt cannot pay the same player twice in one room");

  const stormHost = { id:910801, first_name:"Storm Host" };
  const stormMate = { id:910802, first_name:"Storm Mate" };
  let stormSession = await createSession(stormHost, { launchType:"storm-extraction" });
  stormSession = await joinSession(stormSession.code, stormMate);
  assert.equal(stormSession.launchType, "storm-extraction", "Storm Extraction keeps its own operation identity");
  stormSession = await applyAction(stormSession, stormHost, "start");
  let stormSnapshot = await buildSnapshot(stormSession, stormHost.id);
  assert.equal(stormSnapshot.mission.title, "Storm Extraction", "Storm Extraction has its own mission title");
  assert.equal(stormSnapshot.mission.chapterName, "Tempest Coast", "Storm Extraction has its own map identity");
  assert.equal(stormSnapshot.mission.rescueRequired, 3, "Storm Extraction requires all three evacuation specialists");
  assert.equal(stormSnapshot.tigers.length, 5, "Storm Extraction has four storm tigers and one Alpha");
  assert.equal(stormSnapshot.boss.name, "Tempest Alpha", "Storm Extraction has its own boss");
  assert.equal(stormSnapshot.boss.hpMax, 2600, "Tempest has the operation's full Alpha health pool");
  assert.equal(stormSnapshot.mission.timeLimitMs, 12 * 60 * 1000, "Storm Extraction uses its twelve-minute extraction timer");
  assert.equal(stormSnapshot.world.width, 4800, "Storm Extraction uses the full co-op world width");
  assert.equal(stormSnapshot.world.height, 2800, "Storm Extraction uses the full co-op world height");

  const evacPilot = stormSnapshot.civilians[0];
  await writePlayerPatch(stormSession.code, stormHost.id, { x:evacPilot.x, y:evacPilot.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(stormSession.code), stormHost, "rescue", { civilianId:evacPilot.id });
  stormSnapshot = await buildSnapshot(await readSession(stormSession.code), stormHost.id);
  assert(stormSnapshot.rescuedIds.includes(evacPilot.id), "Storm specialists use the real shared rescue action");

  const tempest = stormSnapshot.boss;
  await writePlayerPatch(stormSession.code, stormHost.id, { x:tempest.x, y:tempest.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(stormSession.code), stormHost, "attack", { tigerId:tempest.id });
  stormSnapshot = await buildSnapshot(await readSession(stormSession.code), stormHost.id);
  assert(stormSnapshot.boss.hp < stormSnapshot.boss.hpMax, "Tempest uses the real shared combat action");

  const stormClearedAt = Date.now();
  await writePlayerPatch(stormSession.code, stormHost.id, {
    x:stormSnapshot.extraction.x,
    y:stormSnapshot.extraction.y,
    rescuedIds:stormSnapshot.civilians.map((civilian)=>civilian.id),
    tigerDamage:Object.fromEntries(stormSnapshot.tigers.map((tiger)=>[tiger.id, tiger.hpMax])),
    lastSeenAt:stormClearedAt,
  });
  await writePlayerPatch(stormSession.code, stormMate.id, {
    x:stormSnapshot.extraction.x,
    y:stormSnapshot.extraction.y,
    lastSeenAt:stormClearedAt,
  });
  stormSnapshot = await buildSnapshot(await readSession(stormSession.code), stormHost.id);
  assert.equal(stormSnapshot.status, "complete", "Storm Extraction can be completed through its real objectives");
  const stormHostReward = await claimReward(await readSession(stormSession.code), stormHost);
  const stormMateReward = await claimReward(await readSession(stormSession.code), stormMate);
  assert.equal(stormHostReward.reward.badge, "Tempest Coast Lifeline", "Storm Extraction awards its own badge");
  assert.equal(stormHostReward.reward.cash, 15000, "Storm Extraction awards its own cash payout");
  assert.equal(stormHostReward.reward.perkPoints, 4, "Storm Extraction awards its own perk points");
  assert.equal(stormHostReward.reward.seasonPoints, 32, "Storm Extraction awards its own season points");
  assert.equal(stormHostReward.storyProgress, null, "Storm Extraction never changes Story progress");
  assert.notEqual(stormHostReward.receipt, stormMateReward.receipt, "both Storm Extraction players receive separate receipts");
  const stormHostAgain = await claimReward(await readSession(stormSession.code), stormHost);
  assert.equal(stormHostAgain.firstClaim, false, "Storm Extraction cannot pay the same player twice in one room");

  console.log("PASS: Story Missions 1-5 and six Special Operations, synchronized gear pause, reconnect/restart, separate unlocks, capture, and reward dedupe");
}

run().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});
