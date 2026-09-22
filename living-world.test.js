const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const livingWorld = require("./living-world");
const squadServer = require("./api/_lib/squad-session");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const squad = fs.readFileSync("squad-coop.js", "utf8");
const server = fs.readFileSync("api/_lib/squad-session.js", "utf8");

test("Chapter 1 missions map to three persistent districts", () => {
  assert.equal(livingWorld.districtForMission(1).id, "river_gate");
  assert.equal(livingWorld.districtForMission(3).id, "river_gate");
  assert.equal(livingWorld.districtForMission(4).id, "jungle_spine");
  assert.equal(livingWorld.districtForMission(7).id, "jungle_spine");
  assert.equal(livingWorld.districtForMission(8).id, "iron_roar");
  assert.equal(livingWorld.districtForMission(10).id, "iron_roar");
  assert.equal(livingWorld.districtForMission(11), null);
});

test("rescues and captures create a lasting safer district", () => {
  const result = livingWorld.applyOutcome(livingWorld.defaultState(), {
    receipt:"solo-run-1", missionLevel:2, rescues:3, captures:2, kills:0, at:1000,
  });
  assert.equal(result.applied, true);
  assert(result.after.tigerPressure < result.before.tigerPressure);
  assert(result.after.settlementSafety > result.before.settlementSafety);
  assert.equal(result.after.bloodScent, 0);
  assert.equal(result.after.soloClears, 1);
  assert.match(result.summary, /River Gate/);
});

test("lethal choices raise blood scent and reduce safety gains", () => {
  const result = livingWorld.applyOutcome(livingWorld.defaultState(), {
    receipt:"lethal-run", missionLevel:5, kills:5, captures:0, rescues:0, civiliansLost:1, at:2000,
  });
  assert.equal(result.after.bloodScent, 35);
  assert(result.after.settlementSafety < result.before.settlementSafety);
  assert(result.after.tigerPressure >= result.before.tigerPressure);
});

test("the same reward receipt cannot change the world twice", () => {
  const input = { receipt:"shared-story-1:ABC123:42", missionLevel:1, rescues:2, captures:1, coop:true, at:3000 };
  const first = livingWorld.applyOutcome(livingWorld.defaultState(), input);
  const second = livingWorld.applyOutcome(first.state, { ...input, at:4000 });
  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(second.reason, "duplicate");
  assert.deepEqual(second.state.districts.river_gate, first.state.districts.river_gate);
  assert.equal(first.state.districts.river_gate.coopClears, 1);
  assert.equal(first.state.districts.river_gate.soloClears, 0);
});

test("River Gate state produces real, balanced mission consequences", () => {
  const state = livingWorld.defaultState();
  state.districts.river_gate = {
    ...state.districts.river_gate,
    tigerPressure:88,
    settlementSafety:78,
    bloodScent:64,
  };
  const solo = livingWorld.missionConsequences(state, 2, { playerCount:1 });
  const coop = livingWorld.missionConsequences(state, 2, { playerCount:2 });
  assert.equal(solo.enabled, true);
  assert.equal(solo.extraPatrols, 1, "solo patrol escalation stays capped");
  assert.equal(coop.extraPatrols, 2, "two-player squad receives the full pressure patrol");
  assert(coop.startingAggroBoost > 0);
  assert.equal(coop.damageBonus, 3);
  assert.equal(coop.support.safeHouse, true);
  assert.equal(coop.support.ammoMinimum, 20);
  assert.equal(coop.support.scanPing, 280);
  assert.match(coop.brief, /2 extra tiger patrols/);
});

test("default River Gate and Jungle Spine consequences stay fair for solo", () => {
  const effect = livingWorld.missionConsequences(livingWorld.defaultState(), 1, { playerCount:1 });
  assert.equal(effect.enabled, true);
  assert.equal(effect.extraPatrols, 0);
  assert.equal(effect.support.safeHouse, true);
  assert.equal(effect.support.medkitMinimum, 2);
  const jungle = livingWorld.missionConsequences(livingWorld.defaultState(), 4, { playerCount:1 });
  assert.equal(jungle.enabled, true);
  assert.equal(jungle.extraPatrols, 1);
  assert.equal(jungle.patrolType, "Stalker");
  assert.equal(jungle.support.rangerStation, false);
  assert.equal(jungle.support.bridgeOpen, false);
  assert.equal(jungle.support.medkitMinimum, 1);
});

test("a restored Jungle Spine opens routes, helpers, and full squad support", () => {
  const state = livingWorld.defaultState();
  state.districts.jungle_spine = {
    ...state.districts.jungle_spine,
    tigerPressure:88,
    settlementSafety:76,
    bloodScent:90,
  };
  const solo = livingWorld.missionConsequences(state, 5, { playerCount:1 });
  const coop = livingWorld.missionConsequences(state, 5, { playerCount:2 });
  assert.equal(solo.extraPatrols, 1, "solo never receives more than one consequence patrol");
  assert.equal(coop.extraPatrols, 2);
  assert.equal(coop.patrolType, "Stalker");
  assert.equal(coop.damageBonus, 5);
  assert.equal(coop.support.rangerStation, true);
  assert.equal(coop.support.bridgeOpen, true);
  assert.equal(coop.support.safeRoute, true);
  assert.equal(coop.support.routeSpeedMul, 1.12);
  assert.equal(coop.support.returningCivilians, 2);
  assert.equal(coop.support.medkitMinimum, 2);
  assert.equal(coop.support.ammoMinimum, 24);
  assert.equal(coop.support.scanPing, 320);
  assert.match(coop.brief, /2 extra roaming Stalker patrols/);
  assert.match(coop.brief, /community bridge open/);
});

test("District consequences are integrated into solo, Shared Story, and the Telegram cache build", () => {
  assert(game.includes("function recordLivingWorldStoryOutcome"));
  assert(game.includes("worldMapLivingChapterOneHtml(wm)"));
  assert(game.includes("Living World: ${result.summary}"));
  assert(server.includes('const livingWorld = require("../../living-world")'));
  assert(server.includes("livingWorldOutcome = livingWorld.applyOutcome"));
  assert(server.includes("livingWorld.missionConsequences"));
  assert(server.includes("function activeLivingWorldMission"));
  assert(game.includes("prepareLivingWorldMissionConsequences(S)"));
  assert(game.includes("spawnLivingWorldRiverGateSafeHouse()"));
  assert(game.includes("configureLivingWorldDistrictRoutes()"));
  assert(game.includes('livingWorldSupportType:jungle ? "jungle_ranger"'));
  assert(squad.includes("function sharedLivingWorldHtml"));
  assert(squad.includes("function livingWorldMissionText"));
  assert(squad.includes("YOUR SHARED STORY WORLD"));
  assert(squad.includes("COMMUNITY BRIDGE • OPEN"));
  assert(html.includes("living-world.js?v=5077-jungle-spine"));
  assert(html.includes("V10.4 (Jungle Spine)"));
});

test("a real Shared Story room keeps River Gate patrols and support through start and reconnect", async () => {
  const host = { id:910301, first_name:"River", last_name:"Leader" };
  const teammate = { id:910302, first_name:"Gate", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.river_gate = {
    ...hostProfile.livingWorld.districts.river_gate,
    tigerPressure:88,
    settlementSafety:78,
    bloodScent:64,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:2 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.extraPatrols, 2);
  assert.equal(waiting.mission.tigerCount, 5);
  assert.equal(waiting.settlementSupport.label, "River Gate Safe House");

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  session = await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), host.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.bloodScent, 64);
  assert.equal(active.tigers.length, 5);
  assert(active.mission.aggressionBonus >= 3);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 2 && teammateProfile.supplies.medkits >= 2);
  assert(hostProfile.ammo.rubber >= 20 && teammateProfile.ammo.rubber >= 20);
});

test("a real Shared Story Jungle Spine room keeps Stalkers, routes, and Ranger support", async () => {
  const host = { id:910401, first_name:"Jungle", last_name:"Leader" };
  const teammate = { id:910402, first_name:"Spine", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.jungle_spine = {
    ...hostProfile.livingWorld.districts.jungle_spine,
    tigerPressure:88,
    settlementSafety:76,
    bloodScent:90,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:5 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "jungle_spine");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 2);
  assert.equal(waiting.mission.tigerCount, 5);
  assert.equal(waiting.settlementSupport.label, "Jungle Spine Ranger Station");
  assert.equal(waiting.settlementSupport.returningCivilians, 2);

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  session = await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.bridgeOpen, true);
  assert.equal(active.mission.livingWorld.support.safeRoute, true);
  assert.equal(active.mission.livingWorld.support.routeSpeedMul, 1.12);
  assert.equal(active.tigers.filter((tiger)=>tiger.type === "Stalker").length, 2);
  assert(active.mission.aggressionBonus >= 5);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 2 && teammateProfile.supplies.medkits >= 2);
  assert(hostProfile.ammo.rubber >= 24 && teammateProfile.ammo.rubber >= 24);
});
