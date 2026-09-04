const assert = require("assert");
const {
  createSession,
  joinSession,
  readSession,
  buildSnapshot,
  updateOwnPresence,
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
  assert(snapshot.players.every((player)=>player.ammoMode === "rubber"), "fresh co-op missions start both players on capture-safe Rubber ammunition");
  assert(snapshot.tigers.every((tiger)=>["calm","suspicious","stalking","attacking","blood_frenzy"].includes(tiger.awarenessState)), "every co-op tiger exposes an authoritative awareness state");
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

  const rubberTiger = snapshot.tigers[0];
  await writePlayerPatch(code, host.id, { x:rubberTiger.x, y:rubberTiger.y, lastAttackAt:0, lastSeenAt:Date.now() });
  session = await applyAction(await readSession(code), host, "ammo-mode", { ammoMode:"rubber" });
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.players.find((player)=>player.userId === host.id).ammoMode, "rubber", "Live Squad saves Rubber ammunition selection per player");
  session = await applyAction(await readSession(code), host, "attack", { tigerId:rubberTiger.id });
  snapshot = await buildSnapshot(session, host.id);
  assert.notEqual(snapshot.tigers.find((tiger)=>tiger.id === rubberTiger.id).awarenessState, "calm", "nearby gunfire raises server-authoritative tiger awareness");
  assert(snapshot.tigers.find((tiger)=>tiger.id === rubberTiger.id).hp > 0, "a Rubber hit cannot kill a co-op tiger");
  assert.equal(snapshot.tigers.find((tiger)=>tiger.id === rubberTiger.id).lethalWounded, false, "Rubber does not block capture");
  assert.equal(snapshot.tigers.find((tiger)=>tiger.id === rubberTiger.id).rubberSlowed, true, "Rubber slows the tiger's attack cycle for both players");
  await writePlayerPatch(code, host.id, { tigerDamage:{ [rubberTiger.id]:rubberTiger.hpMax - 1 }, lastAttackAt:0, lastSeenAt:Date.now() });
  session = await applyAction(await readSession(code), host, "capture", { tigerId:rubberTiger.id });
  snapshot = await buildSnapshot(session, host.id);
  assert(snapshot.capturedIds.includes(rubberTiger.id), "a Rubber-weakened tiger can be captured");
  const capturedTiger = snapshot.tigers.find((tiger)=>tiger.id === rubberTiger.id);
  assert.equal(capturedTiger.cage, true, "a captured co-op tiger remains visible in a cage");
  assert.equal(capturedTiger.carcass, false, "a live capture never creates a blood-scent body");
  const capturedPosition = { x:capturedTiger.x, y:capturedTiger.y };
  const capturingPlayer = snapshot.players.find((player)=>player.userId === host.id);
  assert(capturingPlayer.captureSites[rubberTiger.id], "the server saves the cage location on the capturing player");
  session = await joinSession(code, host);
  snapshot = await buildSnapshot(session, host.id);
  const reconnectedCage = snapshot.tigers.find((tiger)=>tiger.id === rubberTiger.id);
  assert.deepEqual({ x:reconnectedCage.x, y:reconnectedCage.y }, capturedPosition, "reconnecting keeps the cage in its exact capture location");

  const realTiger = snapshot.tigers.find((tiger)=>!tiger.defeated);
  await writePlayerPatch(code, host.id, { x:realTiger.x, y:realTiger.y, lastAttackAt:0, lastSeenAt:Date.now() });
  session = await applyAction(await readSession(code), host, "ammo-mode", { ammoMode:"real" });
  session = await applyAction(session, host, "attack", { tigerId:realTiger.id });
  snapshot = await buildSnapshot(session, host.id);
  assert.equal(snapshot.tigers.find((tiger)=>tiger.id === realTiger.id).lethalWounded, true, "a Real hit marks the tiger as lethally wounded for both players");
  const hostRaw = await getState(playerStateKey(code, host.id));
  await writePlayerPatch(code, host.id, { tigerDamage:{ ...(hostRaw.tigerDamage || {}), [realTiger.id]:Math.ceil(realTiger.hpMax * 0.80) }, lastAttackAt:0, lastSeenAt:Date.now() });
  await assert.rejects(
    async()=>applyAction(await readSession(code), host, "capture", { tigerId:realTiger.id }),
    /Capture blocked/,
    "a Real-wounded tiger cannot be captured"
  );
  const woundedHost = await getState(playerStateKey(code, host.id));
  await writePlayerPatch(code, host.id, {
    tigerDamage:{ ...(woundedHost.tigerDamage || {}), [realTiger.id]:realTiger.hpMax - 1 },
    lastAttackAt:0,
    lastSeenAt:Date.now(),
  });
  session = await applyAction(await readSession(code), host, "attack", { tigerId:realTiger.id });
  snapshot = await buildSnapshot(session, host.id);
  const lethalBody = snapshot.tigers.find((tiger)=>tiger.id === realTiger.id);
  assert.equal(lethalBody.carcass, true, "a lethal co-op kill leaves the tiger body on the map");
  assert.equal(lethalBody.captured, false, "a lethal body is never treated as a capture");
  assert.equal(lethalBody.bloodScentRadius, 360, "the body broadcasts an authoritative blood-scent zone");
  assert.equal(snapshot.mission.tigerKills, 1, "the mission counts the lethal body");
  assert.equal(snapshot.mission.aggressionBonus, 2, "a lethal kill raises surviving tiger damage in every mission");
  assert(snapshot.players.find((player)=>player.userId === host.id).killSites[realTiger.id], "the kill position persists for reconnects");

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
  assert.equal(hostReward.governmentAudit.exempt, false, "Shared Story completion receives a government conduct audit");
  assert.equal(hostReward.governmentAudit.captures, 1, "the co-op audit counts the shared live capture");
  assert.equal(hostReward.governmentAudit.kills, 1, "the co-op audit counts the shared lethal outcome");
  assert.equal(hostReward.governmentAudit.runId, `coop:${code}:${host.id}`, "each player receives an individually deduplicated audit receipt");
  assert.deepEqual(hostReward.storyProgress, { completedLevel:1, unlockLevel:2 }, "Mission 2 unlocks for host");
  assert.deepEqual(teammateReward.storyProgress, { completedLevel:1, unlockLevel:2 }, "Mission 2 unlocks for teammate");
  assert.notEqual(hostReward.receipt, teammateReward.receipt, "players receive separate receipts");

  const hostAgain = await claimReward(await readSession(code), host);
  const teammateAgain = await claimReward(await readSession(code), teammate);
  assert.equal(hostAgain.firstClaim, false, "host cannot receive a second server reward");
  assert.equal(teammateAgain.firstClaim, false, "teammate cannot receive a second server reward");

  for(let level=2; level<=40; level++){
    const levelHost = { id:910100 + (level * 10), first_name:`Host ${level}` };
    const levelMate = { id:910101 + (level * 10), first_name:`Mate ${level}` };
    let levelSession = await createSession(levelHost, { launchType:"shared-story", storyMissionLevel:level });
    levelSession = await joinSession(levelSession.code, levelMate);
    levelSession = await applyAction(levelSession, levelHost, "start");
    let levelSnapshot = await buildSnapshot(levelSession, levelHost.id);
    assert.equal(levelSnapshot.mission.level, level, `Story Mission ${level} keeps its own definition`);
    assert(levelSnapshot.world.width >= 3800, `Story Mission ${level} keeps a large mission world`);
    if(level >= 11) assert.equal(levelSnapshot.world.width, 4800, `Story Mission ${level} uses the full expanded Story world width`);
    assert(levelSnapshot.world.height >= 2100, `Story Mission ${level} keeps Story-scale travel depth`);
    assert.equal(levelSnapshot.mission.title, `Story Mission ${level}`, `Story Mission ${level} has an accurate title`);
    assert(levelSnapshot.mission.objective.length > 12, `Story Mission ${level} has a real objective`);
    assert(levelSnapshot.tigers.length >= 1, `Story Mission ${level} has shared tiger gameplay`);
    if(level === 6){
      assert(levelSnapshot.mission.objective.toLowerCase().includes("tall grass"), "Mission 6 names the tall-grass ambush");
      assert.equal(levelSnapshot.tigers.length, 3, "Mission 6 has three hidden-grass threats");
    }
    if(level === 7){
      assert.equal(levelSnapshot.mission.rescueRequired, 1, "Mission 7 requires the injured villager escort");
      assert.equal(levelSnapshot.civilians[0].name, "Injured Villager", "Mission 7 identifies its escort target");
    }
    if(level === 8){
      assert.equal(levelSnapshot.mission.captureRequired, 1, "Mission 8 requires a research capture");
      assert.equal(levelSnapshot.civilians.length, 0, "Mission 8 does not invent a civilian objective");
    }
    if(level === 9) assert.equal(levelSnapshot.tigers.length, 4, "Mission 9 has a full village-gate pack");
    if(level === 10){
      assert.equal(levelSnapshot.boss.name, "Village Alpha", "Mission 10 uses its real Village Alpha boss");
      assert.equal(levelSnapshot.boss.hpMax, 1000, "Mission 10 keeps the Village Alpha boss health");
    }
    if(level === 11){
      assert.equal(levelSnapshot.mission.chapterName, "Blood in the Jungle", "Mission 11 starts the real Chapter 2 campaign");
      assert.equal(levelSnapshot.mission.rescueRequired, 4, "Mission 11 escorts four villagers through the narrow path");
    }
    if(level === 12){
      assert.equal(levelSnapshot.tigers.length, 4, "Mission 12 has a pack large enough for rising aggression");
      assert(levelSnapshot.mission.dangerNote.includes("Every tiger killed"), "Mission 12 explains its real kill-driven aggression rule");
    }
    if(level === 13) assert.equal(levelSnapshot.mission.captureRequired, 2, "Mission 13 requires two research captures");
    if(level === 14){
      assert.equal(levelSnapshot.mission.rescueRequired, 1, "Mission 14 requires Doctor Amara's rescue");
      assert.equal(levelSnapshot.civilians[0].name, "Doctor Amara", "Mission 14 identifies its protected doctor");
      assert.equal(levelSnapshot.civilians[0].vip, true, "Doctor Amara is marked as the mission VIP");
    }
    if(level === 15){
      assert.equal(levelSnapshot.mission.rescueRequired, 4, "Mission 15 requires all caravan crew members");
      assert.equal(levelSnapshot.tigers.length, 4, "Mission 15 has a complete caravan ambush pack");
    }
    if(level === 16) assert.equal(levelSnapshot.mission.rescueRequired, 5, "Mission 16 requires all five forest civilians");
    if(level === 17){
      assert.equal(levelSnapshot.mission.rescueRequired, 4, "Mission 17 requires all four children");
      assert(levelSnapshot.civilians.every((civilian)=>civilian.child === true), "Mission 17 marks every rescue target as a child");
    }
    if(level === 18){
      assert.equal(levelSnapshot.mission.captureRequired, 2, "Mission 18 requires two aggressive-pack captures");
      assert.equal(levelSnapshot.mission.aggressionBonus, 2, "Mission 18 applies its real close-range aggression damage");
    }
    if(level === 19){
      assert.equal(levelSnapshot.tigers.length, 9, "Mission 19 contains the full nine-tiger swarm");
      assert.equal(levelSnapshot.mission.aggressionBonus, 4, "Mission 19 begins at high aggression");
    }
    if(level === 20){
      assert.equal(levelSnapshot.boss.name, "Blood Tiger", "Mission 20 uses the real Blood Tiger boss");
      assert.equal(levelSnapshot.boss.hpMax, 1800, "Mission 20 keeps the Blood Tiger boss health");
      assert.equal(levelSnapshot.boss.bloodRage, true, "Mission 20 boss carries the Blood Rage mechanic");
    }
    if(level === 21){
      assert.equal(levelSnapshot.mission.chapterName, "The Deep Jungle", "Mission 21 starts the real Chapter 3 campaign");
      assert.equal(levelSnapshot.mission.rescueRequired, 4, "Mission 21 escorts all four research-team members");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 21 has a three-stage research route");
    }
    if(level === 22){
      assert.equal(levelSnapshot.tigers.length, 5, "Mission 22 has a complete tall-grass pack");
      assert(levelSnapshot.mission.objective.toLowerCase().includes("tall grass"), "Mission 22 names the real tall-grass objective");
    }
    if(level === 23){
      assert.equal(levelSnapshot.mission.captureRequired, 1, "Mission 23 requires one live capture");
      assert.deepEqual(levelSnapshot.mission.captureTargetIds, ["s23_veil_tiger"], "Mission 23 requires the named Veil Tiger rather than any tiger");
      assert.deepEqual(levelSnapshot.mission.captureTargetNames, ["Veil Tiger"], "Mission 23 tells both players the exact capture target");
      assert.equal(levelSnapshot.tigers.find((tiger)=>tiger.id === "s23_veil_tiger").type, "Stalker", "the Veil Tiger uses stealth behavior");
    }
    if(level === 24){
      assert.equal(levelSnapshot.mission.rescueRequired, 5, "Mission 24 escorts five river-trail villagers");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 24 has a real three-stage river route");
    }
    if(level === 25){
      assert.equal(levelSnapshot.tigers.length, 5, "Mission 25 has a five-tiger bridge ambush");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 25 requires both players to secure all bridge checkpoints");
    }
    if(level === 26){
      assert.equal(levelSnapshot.mission.rescueRequired, 1, "Mission 26 requires the lost hunter rescue");
      assert.equal(levelSnapshot.civilians[0].name, "Lost Hunter", "Mission 26 identifies its real rescue target");
      assert.equal(levelSnapshot.civilians[0].vip, true, "the lost hunter is protected as a mission VIP");
    }
    if(level === 27){
      assert.equal(levelSnapshot.mission.rescueRequired, 5, "Mission 27 escorts all five abandoned-camp survivors");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 27 has a three-stage abandoned-camp route");
    }
    if(level === 28){
      assert.equal(levelSnapshot.tigers.length, 8, "Mission 28 contains the full eight-tiger pack");
      assert.equal(levelSnapshot.mission.aggressionBonus, 3, "Mission 28 begins with large-pack danger damage");
    }
    if(level === 29){
      assert.equal(levelSnapshot.mission.rescueRequired, 7, "Mission 29 requires all seven civilian rescues");
      assert.equal(levelSnapshot.mission.extractionType, "helicopter", "Mission 29 uses a real helicopter-marked extraction zone");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 29 has a three-stage helicopter boarding route");
    }
    if(level === 30){
      assert.equal(levelSnapshot.boss.name, "Stealth Tiger", "Mission 30 uses the real Stealth Tiger boss");
      assert.equal(levelSnapshot.boss.hpMax, 2200, "Mission 30 keeps the Stealth Tiger boss health");
      assert.equal(levelSnapshot.boss.type, "Stalker", "Mission 30 boss uses stealth behavior");
    }
    if(level === 31){
      assert.equal(levelSnapshot.mission.chapterName, "Abandoned Villages", "Mission 31 starts the real Chapter 4 campaign");
      assert.equal(levelSnapshot.mission.rescueRequired, 4, "Mission 31 requires all four home survivors");
      assert.equal(levelSnapshot.checkpoints.length, 4, "Mission 31 has four actual homes to search");
      assert.equal(levelSnapshot.mission.checkpointsBeforeRescue, true, "Mission 31 allows home searches before survivors follow");
      const firstHome = levelSnapshot.checkpoints[0];
      await writePlayerPatch(levelSession.code, levelHost.id, { x:firstHome.x, y:firstHome.y, lastSeenAt:Date.now() });
      await updateOwnPresence(await readSession(levelSession.code), levelHost, {});
      levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
      assert(levelSnapshot.players.find((player)=>player.userId === levelHost.id).checkpointIds.includes(firstHome.id), "Mission 31 records a searched home before any rescue");
      await assert.rejects(
        async()=>applyAction(await readSession(levelSession.code), levelHost, "rescue", { civilianId:"s31_survivor_north" }),
        /Search all marked homes/,
        "Mission 31 blocks survivor pickup until both players search every home"
      );
    }
    if(level === 32) assert.equal(levelSnapshot.tigers.length, 6, "Mission 32 has six roaming street tigers");
    if(level === 33){
      assert.equal(levelSnapshot.mission.rescueRequired, 6, "Mission 33 escorts six village survivors");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 33 has a three-stage safe route");
    }
    if(level === 34) assert.equal(levelSnapshot.mission.captureRequired, 3, "Mission 34 requires three live research captures");
    if(level === 35){
      assert.equal(levelSnapshot.mission.rescueRequired, 5, "Mission 35 requires the five-person evacuation convoy");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 35 advances through three convoy route checkpoints");
    }
    if(level === 36){
      assert.equal(levelSnapshot.mission.rescueRequired, 1, "Mission 36 requires Doctor Imani's protection");
      assert.equal(levelSnapshot.civilians[0].name, "Doctor Imani", "Mission 36 identifies its protected scientist");
      assert.equal(levelSnapshot.civilians[0].vip, true, "Doctor Imani is marked as the mission VIP");
      assert.equal(levelSnapshot.checkpoints.length, 3, "Mission 36 has three real sample sites");
    }
    if(level === 37){
      assert.equal(levelSnapshot.mission.rescueRequired, 6, "Mission 37 escorts six civilians through the burning village");
      assert.equal(levelSnapshot.fireZones.length, 4, "Mission 37 has four server-authoritative fire zones");
      const fire = levelSnapshot.fireZones[0];
      await writePlayerPatch(levelSession.code, levelHost.id, { x:fire.x, y:fire.y, hp:100, lastFireAt:0, lastHazardAt:Date.now(), lastSeenAt:Date.now() });
      await updateOwnPresence(await readSession(levelSession.code), levelHost, {});
      const burnedPlayer = await getState(playerStateKey(levelSession.code, levelHost.id));
      assert(burnedPlayer.hp <= 92, "Mission 37 fire deals its real eight-point hazard damage");
      const fireHp = burnedPlayer.hp;
      await updateOwnPresence(await readSession(levelSession.code), levelHost, {});
      const cooldownPlayer = await getState(playerStateKey(levelSession.code, levelHost.id));
      assert.equal(cooldownPlayer.hp, fireHp, "Mission 37 fire cooldown prevents instant repeated damage");
    }
    if(level === 38) assert.equal(levelSnapshot.tigers.length, 10, "Mission 38 contains the complete ten-tiger town swarm");
    if(level === 39) assert.equal(levelSnapshot.tigers.length, 12, "Mission 39 contains the massive twelve-tiger village pack");
    if(level === 40){
      assert.equal(levelSnapshot.tigers.filter((tiger)=>tiger.boss).length, 2, "Mission 40 contains both Alpha bosses");
      assert.equal(levelSnapshot.boss.name, "Ashclaw Alpha", "Mission 40 starts by tracking Ashclaw Alpha");
      const ashclaw = levelSnapshot.tigers.find((tiger)=>tiger.id === "s40_ashclaw_alpha");
      await writePlayerPatch(levelSession.code, levelHost.id, { tigerDamage:{ [ashclaw.id]:ashclaw.hpMax }, lastSeenAt:Date.now() });
      levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
      assert.equal(levelSnapshot.boss.name, "Ruinstripe Alpha", "the Mission 40 HUD switches to the surviving Alpha twin");
      assert.equal(levelSnapshot.mission.aggressionBonus, 7, "the surviving Alpha gains three damage when its twin falls");
    }
    if(level === 12){
      const firstTiger = levelSnapshot.tigers[0];
      await writePlayerPatch(levelSession.code, levelHost.id, {
        tigerDamage:{ [firstTiger.id]:firstTiger.hpMax },
        lastSeenAt:Date.now(),
      });
      levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
      assert.equal(levelSnapshot.mission.tigerKills, 1, "Mission 12 counts an actual tiger kill");
      assert.equal(levelSnapshot.mission.aggressionBonus, 2, "Mission 12 raises surviving tiger damage after a kill");
    }
    if(level === 20){
      const bloodTiger = levelSnapshot.boss;
      await writePlayerPatch(levelSession.code, levelHost.id, {
        tigerDamage:{ [bloodTiger.id]:Math.ceil(bloodTiger.hpMax * 0.70) },
        lastSeenAt:Date.now(),
      });
      levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
      assert.equal(levelSnapshot.mission.bloodRageActive, true, "Mission 20 activates Blood Rage below 35% health");
      assert.equal(levelSnapshot.mission.aggressionBonus, 9, "Blood Rage adds six damage on top of the boss danger bonus");
    }
    const clearedAt = Date.now();
    await writePlayerPatch(levelSession.code, levelHost.id, {
      x:levelSnapshot.extraction.x,
      y:levelSnapshot.extraction.y,
      rescuedIds:levelSnapshot.civilians.slice(0, levelSnapshot.mission.rescueRequired).map((c)=>c.id),
      checkpointIds:(levelSnapshot.checkpoints || []).map((checkpoint)=>checkpoint.id),
      capturedIds:[],
      tigerDamage:Object.fromEntries(levelSnapshot.tigers.map((t)=>[t.id, t.hpMax])),
      lastSeenAt:clearedAt,
    });
    await writePlayerPatch(levelSession.code, levelMate.id, {
      x:levelSnapshot.extraction.x,
      y:levelSnapshot.extraction.y,
      checkpointIds:(levelSnapshot.checkpoints || []).map((checkpoint)=>checkpoint.id),
      lastSeenAt:clearedAt,
    });
    if(levelSnapshot.mission.captureRequired > 0){
      levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
      assert.equal(levelSnapshot.status, "active", `Mission ${level} cannot finish without its required captures`);
      if(level === 23){
        await writePlayerPatch(levelSession.code, levelHost.id, {
          capturedIds:["s23_veil_scout"],
          lastSeenAt:Date.now(),
        });
        levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
        assert.equal(levelSnapshot.status, "active", "Mission 23 cannot be completed by capturing a different tiger");
      }
      await writePlayerPatch(levelSession.code, levelHost.id, {
        capturedIds:levelSnapshot.mission.captureTargetIds?.length
          ? levelSnapshot.mission.captureTargetIds
          : levelSnapshot.tigers.slice(0, levelSnapshot.mission.captureRequired).map((tiger)=>tiger.id),
        lastSeenAt:Date.now(),
      });
    }
    levelSnapshot = await buildSnapshot(await readSession(levelSession.code), levelHost.id);
    assert.equal(levelSnapshot.status, "complete", `Story Mission ${level} can be completed by both players`);
    const levelHostReward = await claimReward(await readSession(levelSession.code), levelHost);
    const levelMateReward = await claimReward(await readSession(levelSession.code), levelMate);
    assert.deepEqual(levelHostReward.storyProgress, { completedLevel:level, unlockLevel:level + 1 }, `Story Mission ${level} unlocks the correct next mission for the host`);
    assert.deepEqual(levelMateReward.storyProgress, { completedLevel:level, unlockLevel:level + 1 }, `Story Mission ${level} unlocks the correct next mission for the teammate`);
    assert.notEqual(levelHostReward.receipt, levelMateReward.receipt, `Story Mission ${level} keeps player reward receipts separate`);
    if(level === 20){
      assert.equal(levelHostReward.reward.cash, 9500, "Mission 20 pays the Blood Tiger cash reward");
      assert.equal(levelHostReward.reward.badge, "Blood Tiger Breakers", "Mission 20 awards the Blood Tiger badge");
      assert.deepEqual(levelHostReward.storyProgress, { completedLevel:20, unlockLevel:21 }, "Mission 20 unlocks Mission 21");
    }
    if(level === 30){
      assert.equal(levelHostReward.reward.cash, 16000, "Mission 30 pays the Stealth Tiger cash reward");
      assert.equal(levelHostReward.reward.badge, "Stealth Tiger Breakers", "Mission 30 awards the Stealth Tiger badge");
      assert.deepEqual(levelHostReward.storyProgress, { completedLevel:30, unlockLevel:31 }, "Mission 30 unlocks Mission 31");
    }
    if(level === 40){
      assert.equal(levelHostReward.reward.cash, 25000, "Mission 40 pays the Twin Alpha cash reward");
      assert.equal(levelHostReward.reward.badge, "Twin Alpha Breakers", "Mission 40 awards the Twin Alpha badge");
      assert.deepEqual(levelHostReward.storyProgress, { completedLevel:40, unlockLevel:41 }, "Mission 40 unlocks Mission 41");
    }
    const levelHostAgain = await claimReward(await readSession(levelSession.code), levelHost);
    assert.equal(levelHostAgain.firstClaim, false, `Story Mission ${level} does not pay the host twice`);
  }

  const futureRoom = await createSession({ id:910809, first_name:"Future Mission" }, { launchType:"shared-story", storyMissionLevel:41 });
  assert.equal(futureRoom.launchType, "live-squad", "an unconverted Mission 41 cannot create a fake shared Story room");
  assert.equal(futureRoom.storyMissionLevel, 0, "an unconverted Story room cannot masquerade as Mission 41");

  const routeHost = { id:910811, first_name:"Route Host" };
  const routeMate = { id:910812, first_name:"Route Mate" };
  let routeSession = await createSession(routeHost, { launchType:"shared-story", storyMissionLevel:15 });
  routeSession = await joinSession(routeSession.code, routeMate);
  routeSession = await applyAction(routeSession, routeHost, "start");
  let routeSnapshot = await buildSnapshot(routeSession, routeHost.id);
  assert.equal(routeSnapshot.checkpoints.length, 3, "Mission 15 has three real moving-caravan checkpoints");
  const caravanCivilians = routeSnapshot.civilians.map((civilian)=>civilian.id);
  await writePlayerPatch(routeSession.code, routeHost.id, {
    rescuedIds:caravanCivilians.slice(0, 2),
    lastSeenAt:Date.now(),
  });
  await writePlayerPatch(routeSession.code, routeMate.id, {
    rescuedIds:caravanCivilians.slice(2),
    lastSeenAt:Date.now(),
  });
  routeSnapshot = await buildSnapshot(await readSession(routeSession.code), routeHost.id);
  const followingCivilian = routeSnapshot.civilians.find((civilian)=>civilian.followingUserId === routeHost.id);
  const routeHostPlayer = routeSnapshot.players.find((player)=>player.userId === routeHost.id);
  assert.equal(followingCivilian.following, true, "rescued civilians visibly follow their rescuer");
  assert(Math.hypot(followingCivilian.x - routeHostPlayer.x, followingCivilian.y - routeHostPlayer.y) < 100, "a following civilian stays beside the moving player");

  for(const checkpoint of routeSnapshot.checkpoints){
    for(const user of [routeHost, routeMate]){
      await writePlayerPatch(routeSession.code, user.id, {
        x:checkpoint.x,
        y:checkpoint.y,
        lastMoveAt:Date.now() - 2000,
        lastSeenAt:Date.now(),
      });
      await updateOwnPresence(await readSession(routeSession.code), user, { x:checkpoint.x, y:checkpoint.y });
    }
    routeSnapshot = await buildSnapshot(await readSession(routeSession.code), routeHost.id);
    assert(routeSnapshot.checkpointCompletedIds.includes(checkpoint.id), `${checkpoint.label} saves after both players arrive`);
  }

  const savedCheckpoint = routeSnapshot.checkpoints[routeSnapshot.checkpoints.length - 1];
  await writePlayerPatch(routeSession.code, routeHost.id, {
    hp:0,
    downed:true,
    livesRemaining:0,
    respawnAt:Date.now() - 1,
    x:100,
    y:100,
    lastSeenAt:Date.now(),
  });
  await updateOwnPresence(await readSession(routeSession.code), routeHost, {});
  routeSnapshot = await buildSnapshot(await readSession(routeSession.code), routeHost.id);
  const respawnedRouteHost = routeSnapshot.players.find((player)=>player.userId === routeHost.id);
  assert.equal(respawnedRouteHost.downed, false, "a field life respawns the caravan player");
  assert(Math.hypot(respawnedRouteHost.x - savedCheckpoint.x, respawnedRouteHost.y - savedCheckpoint.y) < 100, "field-life respawn uses the latest saved checkpoint");

  for(const user of [routeHost, routeMate]){
    await writePlayerPatch(routeSession.code, user.id, { hp:0, downed:true, livesRemaining:0, respawnAt:0, lastSeenAt:Date.now() });
  }
  routeSnapshot = await buildSnapshot(await readSession(routeSession.code), routeHost.id);
  assert.equal(routeSnapshot.status, "failed", "the caravan route can still end in a squad wipe");
  routeSession = await applyAction(await readSession(routeSession.code), routeHost, "restart");
  routeSnapshot = await buildSnapshot(routeSession, routeHost.id);
  const finalCheckpoint = routeSnapshot.checkpoints[routeSnapshot.checkpoints.length - 1];
  assert(routeSnapshot.players.every((player)=>Math.hypot(player.x - finalCheckpoint.x, player.y - finalCheckpoint.y) < 100), "checkpoint restart returns both players to the latest saved caravan point");
  assert.equal(routeSnapshot.rescuedIds.length, 4, "checkpoint restart preserves the rescued caravan crew");
  assert.equal(routeSnapshot.checkpointCompletedIds.length, 3, "checkpoint restart preserves the completed moving route");

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

  const survivalHost = { id:910901, first_name:"Survival Host" };
  const survivalMate = { id:910902, first_name:"Survival Mate" };
  let survivalSession = await createSession(survivalHost, { launchType:"endless-survival" });
  survivalSession = await joinSession(survivalSession.code, survivalMate);
  assert.equal(survivalSession.launchType, "endless-survival", "Endless Survival keeps its own operation identity");
  survivalSession = await applyAction(survivalSession, survivalHost, "start");
  let survivalSnapshot = await buildSnapshot(survivalSession, survivalHost.id);
  assert.equal(survivalSnapshot.mission.title, "Endless Survival", "Endless Survival has its own mission title");
  assert.equal(survivalSnapshot.mission.chapterName, "Last Stand Basin", "Endless Survival has its own map identity");
  assert.equal(survivalSnapshot.mission.survival, true, "Endless Survival exposes wave rules to the client");
  assert.equal(survivalSnapshot.mission.survivalWave, 1, "Endless Survival starts on Wave 1");
  assert.equal(survivalSnapshot.mission.rescueRequired, 0, "Endless Survival has no fake civilian objective");
  assert.equal(survivalSnapshot.tigers.length, 4, "each survival wave has three tigers and one Alpha");
  assert.equal(survivalSnapshot.boss.name, "Relentless Alpha • Wave 1", "the recurring Alpha displays its wave number");
  assert.equal(survivalSnapshot.boss.hpMax, 1500, "Wave 1 uses the base Relentless Alpha health");
  assert.equal(survivalSnapshot.world.width, 4800, "Endless Survival uses the full co-op world width");
  assert.equal(survivalSnapshot.world.height, 2800, "Endless Survival uses the full co-op world height");
  assert(survivalSnapshot.players.every((player)=>player.ammoMode === "real"), "Endless Survival starts every player with Real ammunition");
  await assert.rejects(
    async()=>applyAction(await readSession(survivalSession.code), survivalHost, "ammo-mode", { ammoMode:"rubber" }),
    /Real ammunition only/,
    "Endless Survival rejects Rubber ammunition"
  );
  await assert.rejects(
    async()=>applyAction(await readSession(survivalSession.code), survivalHost, "capture", { tigerId:survivalSnapshot.tigers[0].id }),
    /Capture is disabled/,
    "Endless Survival rejects capture actions"
  );

  const relentless = survivalSnapshot.boss;
  await writePlayerPatch(survivalSession.code, survivalHost.id, { x:relentless.x, y:relentless.y, lastSeenAt:Date.now() });
  await applyAction(await readSession(survivalSession.code), survivalHost, "attack", { tigerId:relentless.id });
  survivalSnapshot = await buildSnapshot(await readSession(survivalSession.code), survivalHost.id);
  assert(survivalSnapshot.boss.hp < survivalSnapshot.boss.hpMax, "Relentless Alpha uses the real shared combat action");

  async function clearSurvivalWave(expectedWave){
    const clearedAt = Date.now();
    await writePlayerPatch(survivalSession.code, survivalHost.id, {
      x:survivalSnapshot.world.width * .45,
      y:survivalSnapshot.world.height * .45,
      tigerDamage:Object.fromEntries(survivalSnapshot.tigers.map((tiger)=>[tiger.id, tiger.hpMax])),
      lastSeenAt:clearedAt,
    });
    await writePlayerPatch(survivalSession.code, survivalMate.id, {
      x:survivalSnapshot.world.width * .48,
      y:survivalSnapshot.world.height * .45,
      lastSeenAt:clearedAt,
    });
    survivalSnapshot = await buildSnapshot(await readSession(survivalSession.code), survivalHost.id);
    assert.equal(survivalSnapshot.mission.survivalWavesCleared, expectedWave, `Wave ${expectedWave} clear is saved`);
    assert(survivalSnapshot.mission.survivalIntermissionMs > 0, `Wave ${expectedWave} starts a regroup period`);
  }

  await clearSurvivalWave(1);
  const waveOneBossHp = survivalSnapshot.boss.hpMax;
  let survivalRaw = await getState(`live_squad_session_${survivalSession.code}`);
  await setState(`live_squad_session_${survivalSession.code}`, { ...survivalRaw, survivalIntermissionUntil:Date.now() - 1 });
  survivalSnapshot = await buildSnapshot(await readSession(survivalSession.code), survivalHost.id);
  assert.equal(survivalSnapshot.mission.survivalWave, 2, "Wave 2 starts after the regroup period");
  assert(survivalSnapshot.boss.hpMax > waveOneBossHp, "Wave 2 tiger health is higher than Wave 1");
  assert(survivalSnapshot.tigers.every((tiger)=>tiger.hp === tiger.hpMax), "new-wave tiger health resets completely");

  await clearSurvivalWave(2);
  survivalRaw = await getState(`live_squad_session_${survivalSession.code}`);
  await setState(`live_squad_session_${survivalSession.code}`, { ...survivalRaw, survivalIntermissionUntil:Date.now() - 1 });
  survivalSnapshot = await buildSnapshot(await readSession(survivalSession.code), survivalHost.id);
  assert.equal(survivalSnapshot.mission.survivalWave, 3, "Wave 3 starts after the second regroup period");
  assert.equal(survivalSnapshot.boss.hpMax, 2160, "Wave 3 applies the documented 44% health increase");

  await clearSurvivalWave(3);
  assert.equal(survivalSnapshot.status, "active", "clearing Wave 3 does not force the squad to leave");
  assert.equal(survivalSnapshot.mission.survivalExtractAvailable, true, "clearing Wave 3 unlocks optional reward extraction");
  const survivalExtractAt = Date.now();
  for(const player of [survivalHost, survivalMate]){
    await writePlayerPatch(survivalSession.code, player.id, {
      x:survivalSnapshot.extraction.x,
      y:survivalSnapshot.extraction.y,
      lastSeenAt:survivalExtractAt,
    });
  }
  survivalSnapshot = await buildSnapshot(await readSession(survivalSession.code), survivalHost.id);
  assert.equal(survivalSnapshot.status, "complete", "both players can bank the survival reward after Wave 3");
  const survivalHostReward = await claimReward(await readSession(survivalSession.code), survivalHost);
  const survivalMateReward = await claimReward(await readSession(survivalSession.code), survivalMate);
  assert.equal(survivalHostReward.reward.cash, 13500, "Wave 3 extraction awards the exact survival cash payout");
  assert.equal(survivalHostReward.reward.perkPoints, 2, "Wave 3 extraction awards two perk points");
  assert.equal(survivalHostReward.reward.seasonPoints, 22, "Wave 3 extraction awards 22 season points");
  assert.equal(survivalHostReward.reward.badge, "Last Stand Survivor", "Endless Survival awards its own badge");
  assert.equal(survivalHostReward.storyProgress, null, "Endless Survival never changes Story progress");
  assert.equal(survivalHostReward.governmentAudit.exempt, true, "Endless Survival is exempt from government capture-policy investigation");
  assert.notEqual(survivalHostReward.receipt, survivalMateReward.receipt, "both survival players receive separate receipts");
  const survivalHostAgain = await claimReward(await readSession(survivalSession.code), survivalHost);
  assert.equal(survivalHostAgain.firstClaim, false, "Endless Survival cannot pay the same player twice in one room");

  console.log("PASS: Story Missions 1-40 and seven Special Operations, Chapter 4 home searches, fire hazards, convoy and sample routes, Twin Alpha handoff, reconnect, separate unlocks, capture, and reward dedupe");
}

run().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});
