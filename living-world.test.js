const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const livingWorld = require("./living-world");
const squadServer = require("./api/_lib/squad-session");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const squad = fs.readFileSync("squad-coop.js", "utf8");
const server = fs.readFileSync("api/_lib/squad-session.js", "utf8");

test("Missions 1–13 map to four persistent districts", () => {
  assert.equal(livingWorld.districtForMission(1).id, "river_gate");
  assert.equal(livingWorld.districtForMission(3).id, "river_gate");
  assert.equal(livingWorld.districtForMission(4).id, "jungle_spine");
  assert.equal(livingWorld.districtForMission(7).id, "jungle_spine");
  assert.equal(livingWorld.districtForMission(8).id, "iron_roar");
  assert.equal(livingWorld.districtForMission(10).id, "iron_roar");
  assert.equal(livingWorld.districtForMission(11).id, "bloodroot_passage");
  assert.equal(livingWorld.districtForMission(13).id, "bloodroot_passage");
  assert.equal(livingWorld.districtForMission(14), null);
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

test("Iron Roar adds fair Armored pressure without crowding the Alpha boss", () => {
  const defaults = livingWorld.defaultState();
  const solo = livingWorld.missionConsequences(defaults, 8, { playerCount:1 });
  const coop = livingWorld.missionConsequences(defaults, 8, { playerCount:2 });
  const boss = livingWorld.missionConsequences(defaults, 10, { playerCount:2 });
  assert.equal(solo.enabled, true);
  assert.equal(solo.extraPatrols, 1);
  assert.equal(coop.extraPatrols, 1);
  assert.equal(coop.patrolType, "Armored");
  assert.equal(coop.support.armoryDepot, false);
  assert.equal(coop.support.powerGrid, false);
  assert.equal(boss.extraPatrols, 0);
  assert.match(boss.brief, /no added patrol in the Alpha boss arena/);
});

test("a restored Iron Roar powers defenses, workers, and the supply lane", () => {
  const state = livingWorld.defaultState();
  state.districts.iron_roar = {
    ...state.districts.iron_roar,
    tigerPressure:92,
    settlementSafety:80,
    bloodScent:96,
  };
  const solo = livingWorld.missionConsequences(state, 9, { playerCount:1 });
  const coop = livingWorld.missionConsequences(state, 9, { playerCount:2 });
  assert.equal(solo.extraPatrols, 1);
  assert.equal(coop.extraPatrols, 2);
  assert.equal(coop.patrolType, "Armored");
  assert.equal(coop.damageBonus, 6);
  assert.equal(coop.support.armoryDepot, true);
  assert.equal(coop.support.powerGrid, true);
  assert.equal(coop.support.fortifiedGate, true);
  assert.equal(coop.support.safeRoute, true);
  assert.equal(coop.support.routeSpeedMul, 1.08);
  assert.equal(coop.support.returningCivilians, 2);
  assert.equal(coop.support.damageReduction, 2);
  assert.equal(coop.support.armorFloor, 65);
  assert.equal(coop.support.ammoMinimum, 30);
  assert.equal(coop.support.scanPing, 360);
  assert.match(coop.brief, /2 extra Armored rail-yard patrols/);
  assert.match(coop.brief, /industrial power grid online/);
});

test("Bloodroot Passage protects capture targets and caps blood-aggression pressure", () => {
  const defaults = livingWorld.defaultState();
  const escort = livingWorld.missionConsequences(defaults, 11, { playerCount:1 });
  const aggression = livingWorld.missionConsequences(defaults, 12, { playerCount:2 });
  const capture = livingWorld.missionConsequences(defaults, 13, { playerCount:2 });
  assert.equal(escort.enabled, true);
  assert.equal(escort.extraPatrols, 1);
  assert.equal(escort.patrolType, "Berserker");
  assert.equal(escort.support.fieldClinic, false);
  assert.equal(escort.support.lanternNetwork, false);
  assert.equal(aggression.extraPatrols, 1, "Mission 12 never stacks two patrols on its kill-aggression pack");
  assert.equal(capture.extraPatrols, 0);
  assert.match(capture.brief, /no added patrol around the two protected research targets/);
});

test("a restored Bloodroot Passage opens a humane research route", () => {
  const state = livingWorld.defaultState();
  state.districts.bloodroot_passage = {
    ...state.districts.bloodroot_passage,
    tigerPressure:92,
    settlementSafety:78,
    bloodScent:90,
  };
  const solo = livingWorld.missionConsequences(state, 11, { playerCount:1 });
  const coop = livingWorld.missionConsequences(state, 11, { playerCount:2 });
  assert.equal(solo.extraPatrols, 1);
  assert.equal(coop.extraPatrols, 2);
  assert.equal(coop.patrolType, "Berserker");
  assert.equal(coop.damageBonus, 5);
  assert.equal(coop.support.fieldClinic, true);
  assert.equal(coop.support.researchPost, true);
  assert.equal(coop.support.lanternNetwork, true);
  assert.equal(coop.support.safeRoute, true);
  assert.equal(coop.support.routeSpeedMul, 1.10);
  assert.equal(coop.support.returningCivilians, 2);
  assert.equal(coop.support.damageReduction, 1);
  assert.equal(coop.support.rubberAmmoMinimum, 36);
  assert.equal(coop.support.tranqMinimum, 8);
  assert.equal(coop.support.scanPing, 360);
  assert.match(coop.brief, /2 extra Bloodroot Berserker patrols/);
  assert.match(coop.brief, /Bloodroot Research Clinic/);
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
  assert(game.includes('jungle ? "jungle_ranger" : "river_safe_house"'));
  assert(game.includes('iron ? "iron_armory"'));
  assert(game.includes('bloodroot ? "bloodroot_clinic"'));
  assert(game.includes("livingWorldPlayerDamageReduction(S)"));
  assert(squad.includes("function sharedLivingWorldHtml"));
  assert(squad.includes("function livingWorldMissionText"));
  assert(squad.includes("YOUR SHARED STORY WORLD"));
  assert(squad.includes("COMMUNITY BRIDGE • OPEN"));
  assert(squad.includes("IRON ROAR POWER GRID • ONLINE"));
  assert(squad.includes("LANTERNS ACTIVE"));
  assert(html.includes("living-world.js?v=5079-bloodroot-passage"));
  assert(html.includes("V10.6 (Bloodroot Passage)"));
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

test("a real Shared Story Iron Roar room keeps Armored patrols and powered defenses", async () => {
  const host = { id:910501, first_name:"Iron", last_name:"Leader" };
  const teammate = { id:910502, first_name:"Roar", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.iron_roar = {
    ...hostProfile.livingWorld.districts.iron_roar,
    tigerPressure:92,
    settlementSafety:80,
    bloodScent:96,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:9 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "iron_roar");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 2);
  assert.equal(waiting.mission.tigerCount, 6);
  assert.equal(waiting.settlementSupport.label, "Iron Roar Armory Depot");
  assert.equal(waiting.settlementSupport.type, "iron_armory");
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
  assert.equal(active.mission.livingWorld.support.powerGrid, true);
  assert.equal(active.mission.livingWorld.support.fortifiedGate, true);
  assert.equal(active.mission.livingWorld.support.damageReduction, 2);
  assert.equal(active.tigers.filter((tiger)=>tiger.type === "Armored").length, 3);
  assert(active.mission.aggressionBonus >= 6);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 2 && teammateProfile.supplies.medkits >= 2);
  assert(hostProfile.ammo.rubber >= 30 && teammateProfile.ammo.rubber >= 30);
});

test("Shared Story Mission 10 keeps its single Alpha under Iron Roar consequences", async () => {
  const host = { id:910503, first_name:"Alpha", last_name:"Leader" };
  let profile = await squadServer.readCoopProfile(host);
  profile.livingWorld.districts.iron_roar = {
    ...profile.livingWorld.districts.iron_roar,
    tigerPressure:96,
    settlementSafety:80,
    bloodScent:96,
  };
  await squadServer.writeCoopProfile(profile, host);
  const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:10 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.tigerCount, 1);
  assert.equal(waiting.tigers.length, 1);
  assert.equal(waiting.tigers[0].boss, true);
});

test("a real Shared Story Bloodroot room keeps Berserkers, clinic support, and humane supplies", async () => {
  const host = { id:910601, first_name:"Bloodroot", last_name:"Leader" };
  const teammate = { id:910602, first_name:"Passage", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.bloodroot_passage = {
    ...hostProfile.livingWorld.districts.bloodroot_passage,
    tigerPressure:92,
    settlementSafety:78,
    bloodScent:90,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  hostProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:11 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "bloodroot_passage");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 2);
  assert.equal(waiting.mission.tigerCount, 5);
  assert.equal(waiting.settlementSupport.label, "Bloodroot Research Clinic");
  assert.equal(waiting.settlementSupport.type, "bloodroot_clinic");
  assert.equal(waiting.settlementSupport.returningCivilians, 2);

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  teammateProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  session = await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.lanternNetwork, true);
  assert.equal(active.mission.livingWorld.support.safeRoute, true);
  assert.equal(active.mission.livingWorld.support.damageReduction, 1);
  assert.equal(active.tigers.filter((tiger)=>tiger.type === "Berserker").length, 2);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 2 && teammateProfile.supplies.medkits >= 2);
  assert(hostProfile.ammo.rubber >= 36 && teammateProfile.ammo.rubber >= 36);
  assert(hostProfile.ammo.tranq >= 8 && teammateProfile.ammo.tranq >= 8);
});

test("Shared Story Mission 13 keeps exactly its original three research tigers", async () => {
  const host = { id:910603, first_name:"Research", last_name:"Leader" };
  let profile = await squadServer.readCoopProfile(host);
  profile.livingWorld.districts.bloodroot_passage = {
    ...profile.livingWorld.districts.bloodroot_passage,
    tigerPressure:96,
    settlementSafety:78,
    bloodScent:96,
  };
  await squadServer.writeCoopProfile(profile, host);
  const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:13 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.captureRequired, 2);
  assert.equal(waiting.mission.tigerCount, 3);
  assert.equal(waiting.tigers.length, 3);
});
