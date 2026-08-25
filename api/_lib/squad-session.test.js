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

  console.log("PASS: two-player Story Mission 1 join, reconnect, wipe, restart, completion, separate unlocks, and reward dedupe");
}

run().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});
