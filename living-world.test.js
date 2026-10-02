const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const livingWorld = require("./living-world");
const squadServer = require("./api/_lib/squad-session");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const squad = fs.readFileSync("squad-coop.js", "utf8");
const server = fs.readFileSync("api/_lib/squad-session.js", "utf8");

test("Missions 1–50 map to fifteen persistent districts", () => {
  assert.equal(livingWorld.districtForMission(1).id, "river_gate");
  assert.equal(livingWorld.districtForMission(3).id, "river_gate");
  assert.equal(livingWorld.districtForMission(4).id, "jungle_spine");
  assert.equal(livingWorld.districtForMission(7).id, "jungle_spine");
  assert.equal(livingWorld.districtForMission(8).id, "iron_roar");
  assert.equal(livingWorld.districtForMission(10).id, "iron_roar");
  assert.equal(livingWorld.districtForMission(11).id, "bloodroot_passage");
  assert.equal(livingWorld.districtForMission(13).id, "bloodroot_passage");
  assert.equal(livingWorld.districtForMission(14).id, "amara_haven");
  assert.equal(livingWorld.districtForMission(17).id, "amara_haven");
  assert.equal(livingWorld.districtForMission(18).id, "crimson_hollow");
  assert.equal(livingWorld.districtForMission(20).id, "crimson_hollow");
  assert.equal(livingWorld.districtForMission(21).id, "veil_canopy");
  assert.equal(livingWorld.districtForMission(23).id, "veil_canopy");
  assert.equal(livingWorld.districtForMission(24).id, "riverveil_crossing");
  assert.equal(livingWorld.districtForMission(27).id, "riverveil_crossing");
  assert.equal(livingWorld.districtForMission(28).id, "shadow_basin");
  assert.equal(livingWorld.districtForMission(30).id, "shadow_basin");
  assert.equal(livingWorld.districtForMission(31).id, "silent_village");
  assert.equal(livingWorld.districtForMission(33).id, "silent_village");
  assert.equal(livingWorld.districtForMission(34).id, "emberfall_ward");
  assert.equal(livingWorld.districtForMission(37).id, "emberfall_ward");
  assert.equal(livingWorld.districtForMission(38).id, "crownfall_square");
  assert.equal(livingWorld.districtForMission(40).id, "crownfall_square");
  assert.equal(livingWorld.districtForMission(41).id, "brokenwater_reach");
  assert.equal(livingWorld.districtForMission(43).id, "brokenwater_reach");
  assert.equal(livingWorld.districtForMission(44).id, "floodplain_lifeline");
  assert.equal(livingWorld.districtForMission(47).id, "floodplain_lifeline");
  assert.equal(livingWorld.districtForMission(48).id, "tidefang_delta");
  assert.equal(livingWorld.districtForMission(50).id, "tidefang_delta");
  assert.equal(livingWorld.districtForMission(51), null);
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

test("Amara Haven protects the doctor and children while keeping escorts active", () => {
  const defaults = livingWorld.defaultState();
  const doctor = livingWorld.missionConsequences(defaults, 14, { playerCount:2 });
  const caravan = livingWorld.missionConsequences(defaults, 15, { playerCount:2 });
  const forest = livingWorld.missionConsequences(defaults, 16, { playerCount:1 });
  const children = livingWorld.missionConsequences(defaults, 17, { playerCount:2 });
  assert.equal(doctor.enabled, true);
  assert.equal(doctor.extraPatrols, 0);
  assert.match(doctor.brief, /no added patrol around Doctor Amara/);
  assert.equal(caravan.extraPatrols, 1, "the caravan ambush never stacks a second consequence patrol");
  assert.equal(forest.extraPatrols, 1, "solo escort pressure stays capped at one patrol");
  assert.equal(forest.patrolType, "Stalker");
  assert.equal(children.extraPatrols, 0);
  assert.match(children.brief, /no added patrol around the village children/);
});

test("a restored Amara Haven protects civilians and opens its rescue network", () => {
  const state = livingWorld.defaultState();
  state.districts.amara_haven = {
    ...state.districts.amara_haven,
    tigerPressure:92,
    settlementSafety:78,
    bloodScent:95,
  };
  const caravan = livingWorld.missionConsequences(state, 15, { playerCount:2 });
  const forest = livingWorld.missionConsequences(state, 16, { playerCount:2 });
  assert.equal(caravan.extraPatrols, 1);
  assert.equal(forest.extraPatrols, 2);
  assert.equal(forest.damageBonus, 5);
  assert.equal(forest.support.fieldHospital, true);
  assert.equal(forest.support.rescueBeacons, true);
  assert.equal(forest.support.caravanRoute, true);
  assert.equal(forest.support.childShelter, true);
  assert.equal(forest.support.fortifiedGate, true);
  assert.equal(forest.support.safeRoute, true);
  assert.equal(forest.support.routeSpeedMul, 1.12);
  assert.equal(forest.support.returningCivilians, 2);
  assert.equal(forest.support.damageReduction, 1);
  assert.equal(forest.support.civilianDamageMul, 0.78);
  assert.equal(forest.support.medkitMinimum, 3);
  assert.equal(forest.support.armorFloor, 45);
  assert.equal(forest.support.ammoMinimum, 24);
  assert.equal(forest.support.scanPing, 360);
  assert.match(forest.brief, /Amara Haven Field Hospital/);
  assert.match(forest.brief, /22% civilian protection/);
});

test("Crimson Hollow preserves the capture pack, swarm, and Blood Tiger counts", () => {
  const defaults = livingWorld.defaultState();
  const capture = livingWorld.missionConsequences(defaults, 18, { playerCount:2 });
  const swarm = livingWorld.missionConsequences(defaults, 19, { playerCount:2 });
  const boss = livingWorld.missionConsequences(defaults, 20, { playerCount:2 });
  assert.equal(capture.enabled, true);
  assert.equal(capture.extraPatrols, 0);
  assert.match(capture.brief, /no added patrol around the aggressive capture pack/);
  assert.equal(swarm.extraPatrols, 0);
  assert.match(swarm.brief, /no added patrol inside the nine-tiger swarm/);
  assert.equal(boss.extraPatrols, 0);
  assert.match(boss.brief, /no added patrol in the Blood Tiger arena/);
});

test("a restored Crimson Hollow supplies humane capture and weakens Blood Rage", () => {
  const state = livingWorld.defaultState();
  state.districts.crimson_hollow = {
    ...state.districts.crimson_hollow,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  const restored = livingWorld.missionConsequences(state, 20, { playerCount:2 });
  assert.equal(restored.extraPatrols, 0);
  assert.equal(restored.damageBonus, 6);
  assert.equal(restored.support.conservationCamp, true);
  assert.equal(restored.support.calmingTowers, true);
  assert.equal(restored.support.swarmDefenses, true);
  assert.equal(restored.support.bossWard, true);
  assert.equal(restored.support.bossRageReduction, 3);
  assert.equal(restored.support.returningCivilians, 2);
  assert.equal(restored.support.damageReduction, 2);
  assert.equal(restored.support.medkitMinimum, 3);
  assert.equal(restored.support.armorFloor, 60);
  assert.equal(restored.support.rubberAmmoMinimum, 64);
  assert.equal(restored.support.tranqMinimum, 14);
  assert.equal(restored.support.scanPing, 420);
  assert.match(restored.brief, /Crimson Hollow Conservation Camp/);
  assert.match(restored.brief, /3 Blood Rage damage reduction/);
});

test("Veil Canopy preserves the research escort, tall-grass pack, and live-capture target", () => {
  const defaults = livingWorld.defaultState();
  const escort = livingWorld.missionConsequences(defaults, 21, { playerCount:2 });
  const ambush = livingWorld.missionConsequences(defaults, 22, { playerCount:2 });
  const capture = livingWorld.missionConsequences(defaults, 23, { playerCount:2 });
  assert.equal(escort.enabled, true);
  assert.equal(escort.extraPatrols, 0);
  assert.match(escort.brief, /no added patrol around the four-person research team/);
  assert.equal(ambush.extraPatrols, 0);
  assert.match(ambush.brief, /no added patrol inside the five-tiger tall-grass ambush/);
  assert.equal(capture.extraPatrols, 0);
  assert.match(capture.brief, /no added patrol around the Veil Tiger live-capture target/);
});

test("a restored Veil Canopy protects researchers and supplies humane field work", () => {
  const state = livingWorld.defaultState();
  state.districts.veil_canopy = {
    ...state.districts.veil_canopy,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  const restored = livingWorld.missionConsequences(state, 23, { playerCount:2 });
  assert.equal(restored.extraPatrols, 0);
  assert.equal(restored.damageBonus, 5);
  assert.equal(restored.support.researchOutpost, true);
  assert.equal(restored.support.canopyBeacons, true);
  assert.equal(restored.support.protectedResearchRoute, true);
  assert.equal(restored.support.veilLab, true);
  assert.equal(restored.support.safeRoute, true);
  assert.equal(restored.support.routeSpeedMul, 1.12);
  assert.equal(restored.support.returningCivilians, 2);
  assert.equal(restored.support.damageReduction, 2);
  assert.equal(restored.support.civilianDamageMul, 0.76);
  assert.equal(restored.support.medkitMinimum, 3);
  assert.equal(restored.support.armorFloor, 55);
  assert.equal(restored.support.ammoMinimum, 22);
  assert.equal(restored.support.rubberAmmoMinimum, 56);
  assert.equal(restored.support.tranqMinimum, 12);
  assert.equal(restored.support.scanPing, 420);
  assert.match(restored.brief, /Veil Canopy Field Lab/);
  assert.match(restored.brief, /24% civilian protection/);
});

test("Riverveil Crossing preserves every escort, bridge, hunter, and camp encounter", () => {
  const defaults = livingWorld.defaultState();
  const river = livingWorld.missionConsequences(defaults, 24, { playerCount:2 });
  const bridge = livingWorld.missionConsequences(defaults, 25, { playerCount:2 });
  const hunter = livingWorld.missionConsequences(defaults, 26, { playerCount:2 });
  const camp = livingWorld.missionConsequences(defaults, 27, { playerCount:2 });
  assert.equal(river.enabled, true);
  assert.equal(river.extraPatrols, 0);
  assert.match(river.brief, /no added patrol around the five-villager river escort/);
  assert.equal(bridge.extraPatrols, 0);
  assert.match(bridge.brief, /no added patrol inside the five-tiger bridge ambush/);
  assert.equal(hunter.extraPatrols, 0);
  assert.match(hunter.brief, /no added patrol around the injured lost hunter/);
  assert.equal(camp.extraPatrols, 0);
  assert.match(camp.brief, /no added patrol around the five abandoned-camp survivors/);
});

test("a restored Riverveil Crossing secures routes and protects civilians", () => {
  const state = livingWorld.defaultState();
  state.districts.riverveil_crossing = {
    ...state.districts.riverveil_crossing,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  const restored = livingWorld.missionConsequences(state, 27, { playerCount:2 });
  assert.equal(restored.extraPatrols, 0);
  assert.equal(restored.damageBonus, 5);
  assert.equal(restored.support.riverStation, true);
  assert.equal(restored.support.bridgeSecured, true);
  assert.equal(restored.support.hunterBeacons, true);
  assert.equal(restored.support.survivorCamp, true);
  assert.equal(restored.support.bridgeOpen, true);
  assert.equal(restored.support.safeRoute, true);
  assert.equal(restored.support.routeSpeedMul, 1.12);
  assert.equal(restored.support.returningCivilians, 2);
  assert.equal(restored.support.damageReduction, 2);
  assert.equal(restored.support.civilianDamageMul, 0.74);
  assert.equal(restored.support.medkitMinimum, 3);
  assert.equal(restored.support.armorFloor, 55);
  assert.equal(restored.support.ammoMinimum, 28);
  assert.equal(restored.support.rubberAmmoMinimum, 32);
  assert.equal(restored.support.tranqMinimum, 0);
  assert.equal(restored.support.scanPing, 420);
  assert.match(restored.brief, /Riverveil Rescue Station/);
  assert.match(restored.brief, /26% civilian protection/);
});

test("Shadow Basin preserves its coordinated pack, helicopter rescue, and Stealth Tiger", () => {
  const defaults = livingWorld.defaultState();
  const pack = livingWorld.missionConsequences(defaults, 28, { playerCount:2 });
  const rescue = livingWorld.missionConsequences(defaults, 29, { playerCount:2 });
  const boss = livingWorld.missionConsequences(defaults, 30, { playerCount:2 });
  assert.equal(pack.enabled, true);
  assert.equal(pack.extraPatrols, 0);
  assert.match(pack.brief, /no added patrol inside the eight-tiger coordinated pack/);
  assert.equal(rescue.extraPatrols, 0);
  assert.match(rescue.brief, /no added patrol around the seven-civilian helicopter evacuation/);
  assert.equal(boss.extraPatrols, 0);
  assert.match(boss.brief, /no added patrol in the Stealth Tiger arena/);
});

test("a restored Shadow Basin protects the LZ and tracks its boss", () => {
  const state = livingWorld.defaultState();
  state.districts.shadow_basin = {
    ...state.districts.shadow_basin,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  const restored = livingWorld.missionConsequences(state, 30, { playerCount:2 });
  assert.equal(restored.extraPatrols, 0);
  assert.equal(restored.damageBonus, 6);
  assert.equal(restored.support.shadowCommand, true);
  assert.equal(restored.support.packSensors, true);
  assert.equal(restored.support.lzDefenses, true);
  assert.equal(restored.support.stealthArray, true);
  assert.equal(restored.support.stealthBossReduction, 3);
  assert.equal(restored.support.safeRoute, true);
  assert.equal(restored.support.routeSpeedMul, 1.12);
  assert.equal(restored.support.returningCivilians, 2);
  assert.equal(restored.support.damageReduction, 2);
  assert.equal(restored.support.civilianDamageMul, 0.72);
  assert.equal(restored.support.medkitMinimum, 3);
  assert.equal(restored.support.armorFloor, 65);
  assert.equal(restored.support.ammoMinimum, 30);
  assert.equal(restored.support.rubberAmmoMinimum, 48);
  assert.equal(restored.support.tranqMinimum, 10);
  assert.equal(restored.support.scanPing, 450);
  assert.match(restored.brief, /Shadow Basin Forward Command/);
  assert.match(restored.brief, /28% civilian protection/);
  assert.match(restored.brief, /3 Stealth Tiger damage reduction/);
});

test("Silent Village preserves the home search, street patrol, and safe-route escort", () => {
  const defaults = livingWorld.defaultState();
  const search = livingWorld.missionConsequences(defaults, 31, { playerCount:2 });
  const patrol = livingWorld.missionConsequences(defaults, 32, { playerCount:2 });
  const escort = livingWorld.missionConsequences(defaults, 33, { playerCount:2 });
  assert.equal(search.enabled, true);
  assert.equal(search.extraPatrols, 0);
  assert.match(search.brief, /no added patrol around the four-home survivor search/);
  assert.equal(patrol.extraPatrols, 0);
  assert.match(patrol.brief, /no added patrol inside the six-tiger village street patrol/);
  assert.equal(escort.extraPatrols, 0);
  assert.match(escort.brief, /no added patrol around the six-survivor safe-route escort/);
});

test("a restored Silent Village protects survivors and opens evacuation", () => {
  const state = livingWorld.defaultState();
  state.districts.silent_village = {
    ...state.districts.silent_village,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  const restored = livingWorld.missionConsequences(state, 33, { playerCount:2 });
  assert.equal(restored.extraPatrols, 0);
  assert.equal(restored.damageBonus, 5);
  assert.equal(restored.support.villageCommand, true);
  assert.equal(restored.support.searchBeacons, true);
  assert.equal(restored.support.clinicRelay, true);
  assert.equal(restored.support.evacCorridor, true);
  assert.equal(restored.support.safeRoute, true);
  assert.equal(restored.support.routeSpeedMul, 1.12);
  assert.equal(restored.support.returningCivilians, 2);
  assert.equal(restored.support.damageReduction, 2);
  assert.equal(restored.support.civilianDamageMul, 0.74);
  assert.equal(restored.support.medkitMinimum, 3);
  assert.equal(restored.support.armorFloor, 60);
  assert.equal(restored.support.ammoMinimum, 26);
  assert.equal(restored.support.rubberAmmoMinimum, 32);
  assert.equal(restored.support.tranqMinimum, 0);
  assert.equal(restored.support.scanPing, 430);
  assert.match(restored.brief, /Silent Village Search Command/);
  assert.match(restored.brief, /26% civilian protection/);
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
  assert(game.includes('amara ? "amara_hospital"'));
  assert(game.includes('crimson ? "crimson_camp"'));
  assert(game.includes('veil ? "veil_outpost"'));
  assert(game.includes('riverveil ? "riverveil_station"'));
  assert(game.includes('shadow ? "shadow_command"'));
  assert(game.includes('silent ? "silent_command"'));
  assert(game.includes('crownfall ? "crownfall_command"'));
  assert(game.includes('brokenwater ? "brokenwater_station"'));
  assert(game.includes('floodplain ? "floodplain_clinic"'));
  assert(game.includes("livingWorldPlayerDamageReduction(S, t)"));
  assert(game.includes("livingWorldCivilianDamageMul(S)"));
  assert(squad.includes("function sharedLivingWorldHtml"));
  assert(squad.includes("function livingWorldMissionText"));
  assert(squad.includes("YOUR SHARED STORY WORLD"));
  assert(squad.includes("COMMUNITY BRIDGE • OPEN"));
  assert(squad.includes("IRON ROAR POWER GRID • ONLINE"));
  assert(squad.includes("LANTERNS ACTIVE"));
  assert(squad.includes("RESCUE BEACONS ACTIVE"));
  assert(squad.includes("BLOOD TIGER WARD ACTIVE"));
  assert(squad.includes("VEIL FIELD LAB ONLINE"));
  assert(squad.includes("SURVIVOR CAMP OPEN"));
  assert(squad.includes("STEALTH TRACKING ONLINE"));
  assert(squad.includes("SURVIVOR BEACONS ACTIVE"));
  assert(squad.includes("TWIN ALPHA WARD ACTIVE"));
  assert(squad.includes("WILDLIFE ROUTE PROTECTED"));
  assert(squad.includes("RIVER CAMP LIFELINE OPEN"));
  assert(squad.includes("GIANT TIGER TIDE WARD ACTIVE"));
  assert(server.includes("6 - Number(livingWorldEffect.support?.bossRageReduction"));
  assert(server.includes("stealthBossReduction"));
  assert(html.includes("living-world.js?v=5150-tidefang"));
  assert(html.includes("V10.18 (Tidefang Delta)"));
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

test("a real Shared Story Amara Haven room keeps Stalkers and hospital support", async () => {
  const host = { id:910701, first_name:"Amara", last_name:"Leader" };
  const teammate = { id:910702, first_name:"Haven", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.amara_haven = {
    ...hostProfile.livingWorld.districts.amara_haven,
    tigerPressure:92,
    settlementSafety:78,
    bloodScent:95,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:16 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "amara_haven");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 2);
  assert.equal(waiting.mission.tigerCount, 6);
  assert.equal(waiting.settlementSupport.label, "Amara Haven Field Hospital");
  assert.equal(waiting.settlementSupport.type, "amara_hospital");

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
  assert.equal(active.mission.livingWorld.support.rescueBeacons, true);
  assert.equal(active.mission.livingWorld.support.caravanRoute, true);
  assert.equal(active.mission.livingWorld.support.childShelter, true);
  assert.equal(active.mission.livingWorld.support.civilianDamageMul, 0.78);
  assert.equal(active.tigers.filter((tiger)=>tiger.type === "Stalker").length, 2);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 3 && teammateProfile.supplies.medkits >= 3);
  assert(hostProfile.supplies.armorPlates >= 1 && teammateProfile.supplies.armorPlates >= 1);
  assert(hostProfile.ammo.real >= 24 && teammateProfile.ammo.real >= 24);
});

test("Shared Story Missions 14 and 17 keep their protected civilian encounters exact", async () => {
  for(const [level, userId, tigerCount, civilianCount] of [[14, 910703, 3, 1], [17, 910704, 3, 4]]){
    const host = { id:userId, first_name:`Protected${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.amara_haven = {
      ...profile.livingWorld.districts.amara_haven,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:96,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
  }
});

test("a real Shared Story Crimson Hollow room grants capture and anti-rage support", async () => {
  const host = { id:910801, first_name:"Crimson", last_name:"Leader" };
  const teammate = { id:910802, first_name:"Hollow", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.crimson_hollow = {
    ...hostProfile.livingWorld.districts.crimson_hollow,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  hostProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:18 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "crimson_hollow");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.tigerCount, 4);
  assert.equal(waiting.mission.captureRequired, 2);
  assert.equal(waiting.settlementSupport.label, "Crimson Hollow Conservation Camp");
  assert.equal(waiting.settlementSupport.type, "crimson_camp");

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  teammateProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.calmingTowers, true);
  assert.equal(active.mission.livingWorld.support.swarmDefenses, true);
  assert.equal(active.mission.livingWorld.support.bossRageReduction, 3);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 3 && teammateProfile.supplies.medkits >= 3);
  assert(hostProfile.supplies.armorPlates >= 1 && teammateProfile.supplies.armorPlates >= 1);
  assert(hostProfile.ammo.rubber >= 64 && teammateProfile.ammo.rubber >= 64);
  assert(hostProfile.ammo.tranq >= 14 && teammateProfile.ammo.tranq >= 14);
});

test("Shared Story Missions 18–20 retain their exact designed encounters", async () => {
  for(const [level, userId, tigerCount, captureRequired, bossCount] of [[18, 910803, 4, 2, 0], [19, 910804, 9, 0, 0], [20, 910805, 1, 0, 1]]){
    const host = { id:userId, first_name:`Crimson${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.crimson_hollow = {
      ...profile.livingWorld.districts.crimson_hollow,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.captureRequired, captureRequired);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.tigers.filter((tiger)=>tiger.boss).length, bossCount);
  }
});

test("a real Shared Story Veil Canopy room grants research and capture support", async () => {
  const host = { id:910901, first_name:"Veil", last_name:"Leader" };
  const teammate = { id:910902, first_name:"Canopy", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.veil_canopy = {
    ...hostProfile.livingWorld.districts.veil_canopy,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  hostProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:23 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "veil_canopy");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.tigerCount, 3);
  assert.equal(waiting.mission.captureRequired, 1);
  assert.equal(waiting.settlementSupport.label, "Veil Canopy Field Lab");
  assert.equal(waiting.settlementSupport.type, "veil_outpost");

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  teammateProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.canopyBeacons, true);
  assert.equal(active.mission.livingWorld.support.protectedResearchRoute, true);
  assert.equal(active.mission.livingWorld.support.veilLab, true);
  assert.equal(active.mission.livingWorld.support.civilianDamageMul, 0.76);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 3 && teammateProfile.supplies.medkits >= 3);
  assert(hostProfile.supplies.armorPlates >= 1 && teammateProfile.supplies.armorPlates >= 1);
  assert(hostProfile.ammo.real >= 22 && teammateProfile.ammo.real >= 22);
  assert(hostProfile.ammo.rubber >= 56 && teammateProfile.ammo.rubber >= 56);
  assert(hostProfile.ammo.tranq >= 12 && teammateProfile.ammo.tranq >= 12);
});

test("Shared Story Missions 21–23 retain their exact designed encounters", async () => {
  for(const [level, userId, tigerCount, civilianCount, captureRequired] of [[21, 910903, 4, 4, 0], [22, 910904, 5, 0, 0], [23, 910905, 3, 0, 1]]){
    const host = { id:userId, first_name:`Veil${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.veil_canopy = {
      ...profile.livingWorld.districts.veil_canopy,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.captureRequired, captureRequired);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
  }
});

test("a real Shared Story Riverveil room grants crossing and survivor support", async () => {
  const host = { id:911001, first_name:"Riverveil", last_name:"Leader" };
  const teammate = { id:911002, first_name:"Crossing", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.riverveil_crossing = {
    ...hostProfile.livingWorld.districts.riverveil_crossing,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:27 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "riverveil_crossing");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.tigerCount, 5);
  assert.equal(waiting.mission.rescueRequired, 5);
  assert.equal(waiting.settlementSupport.label, "Riverveil Survivor Station");
  assert.equal(waiting.settlementSupport.type, "riverveil_station");

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.bridgeSecured, true);
  assert.equal(active.mission.livingWorld.support.hunterBeacons, true);
  assert.equal(active.mission.livingWorld.support.survivorCamp, true);
  assert.equal(active.mission.livingWorld.support.civilianDamageMul, 0.74);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 3 && teammateProfile.supplies.medkits >= 3);
  assert(hostProfile.supplies.armorPlates >= 1 && teammateProfile.supplies.armorPlates >= 1);
  assert(hostProfile.ammo.real >= 28 && teammateProfile.ammo.real >= 28);
  assert(hostProfile.ammo.rubber >= 32 && teammateProfile.ammo.rubber >= 32);
});

test("Shared Story Missions 24–27 retain exact tigers, civilians, and checkpoints", async () => {
  const rows = [
    [24, 911003, 4, 5, 3],
    [25, 911004, 5, 0, 3],
    [26, 911005, 4, 1, 2],
    [27, 911006, 5, 5, 3],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount] of rows){
    const host = { id:userId, first_name:`Riverveil${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.riverveil_crossing = {
      ...profile.livingWorld.districts.riverveil_crossing,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
  }
});

test("a real Shared Story Shadow Basin room grants tracking and LZ support to both players", async () => {
  const host = { id:911101, first_name:"Shadow", last_name:"Leader" };
  const teammate = { id:911102, first_name:"Basin", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.shadow_basin = {
    ...hostProfile.livingWorld.districts.shadow_basin,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  hostProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:30 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "shadow_basin");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.tigerCount, 1);
  assert.equal(waiting.tigers[0].name, "Stealth Tiger");
  assert.equal(waiting.tigers[0].hpMax, 2200);
  assert.equal(waiting.settlementSupport.label, "Shadow Basin Tracking Command");
  assert.equal(waiting.settlementSupport.type, "shadow_command");

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  teammateProfile.ammo.tranq = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.packSensors, true);
  assert.equal(active.mission.livingWorld.support.lzDefenses, true);
  assert.equal(active.mission.livingWorld.support.stealthArray, true);
  assert.equal(active.mission.livingWorld.support.stealthBossReduction, 3);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 3 && teammateProfile.supplies.medkits >= 3);
  assert(hostProfile.supplies.armorPlates >= 1 && teammateProfile.supplies.armorPlates >= 1);
  assert(hostProfile.ammo.real >= 30 && teammateProfile.ammo.real >= 30);
  assert(hostProfile.ammo.rubber >= 48 && teammateProfile.ammo.rubber >= 48);
  assert(hostProfile.ammo.tranq >= 10 && teammateProfile.ammo.tranq >= 10);
});

test("Shared Story Missions 28–30 retain exact encounters and extraction", async () => {
  const rows = [
    [28, 911103, 8, 0, 0, 0, "ground"],
    [29, 911104, 5, 7, 3, 0, "helicopter"],
    [30, 911105, 1, 0, 0, 1, "ground"],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount, bossCount, extractionType] of rows){
    const host = { id:userId, first_name:`Shadow${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.shadow_basin = {
      ...profile.livingWorld.districts.shadow_basin,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
    assert.equal(waiting.tigers.filter((tiger)=>tiger.boss).length, bossCount);
    assert.equal(waiting.mission.extractionType, extractionType);
  }
});

test("a real Shared Story Silent Village room grants search and evacuation support to both players", async () => {
  const host = { id:911201, first_name:"Silent", last_name:"Leader" };
  const teammate = { id:911202, first_name:"Village", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.silent_village = {
    ...hostProfile.livingWorld.districts.silent_village,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);

  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:33 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.mission.livingWorld.districtId, "silent_village");
  assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
  assert.equal(waiting.mission.tigerCount, 4);
  assert.equal(waiting.mission.rescueRequired, 6);
  assert.equal(waiting.settlementSupport.label, "Silent Village Evac Command");
  assert.equal(waiting.settlementSupport.type, "silent_command");

  session = await squadServer.joinSession(session.code, teammate);
  let teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  await squadServer.applyAction(session, host, "start");

  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.searchBeacons, true);
  assert.equal(active.mission.livingWorld.support.clinicRelay, true);
  assert.equal(active.mission.livingWorld.support.evacCorridor, true);
  assert.equal(active.mission.livingWorld.support.civilianDamageMul, 0.74);
  hostProfile = await squadServer.readCoopProfile(host);
  teammateProfile = await squadServer.readCoopProfile(teammate);
  assert(hostProfile.supplies.medkits >= 3 && teammateProfile.supplies.medkits >= 3);
  assert(hostProfile.supplies.armorPlates >= 1 && teammateProfile.supplies.armorPlates >= 1);
  assert(hostProfile.ammo.real >= 26 && teammateProfile.ammo.real >= 26);
  assert(hostProfile.ammo.rubber >= 32 && teammateProfile.ammo.rubber >= 32);
});

test("Shared Story Missions 31–33 retain exact homes, tigers, survivors, and checkpoints", async () => {
  const rows = [
    [31, 911203, 4, 4, 4, true],
    [32, 911204, 6, 0, 0, false],
    [33, 911205, 4, 6, 3, false],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount, checkpointsBeforeRescue] of rows){
    const host = { id:userId, first_name:`Silent${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.silent_village = {
      ...profile.livingWorld.districts.silent_village,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
    assert.equal(waiting.mission.checkpointsBeforeRescue, checkpointsBeforeRescue);
    assert.equal(waiting.mission.extractionType, "ground");
  }
});

test("Emberfall Ward protects the exact Missions 34–37 encounters", async () => {
  const rows = [
    [34, 911234, 5, 0, 0, 3, "ground"],
    [35, 911235, 5, 5, 3, 0, "vehicle"],
    [36, 911236, 4, 1, 3, 0, "ground"],
    [37, 911237, 5, 6, 3, 0, "ground"],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount, captureRequired, extractionType] of rows){
    const host = { id:userId, first_name:`Ember${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.emberfall_ward = {
      ...profile.livingWorld.districts.emberfall_ward,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.districtId, "emberfall_ward");
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.mission.captureRequired, captureRequired);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
    assert.equal(waiting.mission.extractionType, extractionType);
    assert.equal(waiting.mission.mapTruthVersion, "10.18");
    assert(waiting.mapTruthLandmarks.length >= 5);
    if(level === 37) assert.equal(waiting.fireZones.length, 4);
  }
});

test("Emberfall relief support reaches both Shared Story players", async () => {
  const host = { id:911238, first_name:"Ember", last_name:"Leader" };
  const teammate = { id:911239, first_name:"Firebreak", last_name:"Partner" };
  let hostProfile = await squadServer.readCoopProfile(host);
  hostProfile.livingWorld.districts.emberfall_ward = {
    ...hostProfile.livingWorld.districts.emberfall_ward,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:100,
  };
  hostProfile.supplies.medkits = 0;
  hostProfile.supplies.armorPlates = 0;
  hostProfile.ammo.real = 0;
  hostProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(hostProfile, host);
  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:37 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.settlementSupport.label, "Emberfall Firebreak Command");
  assert.equal(waiting.settlementSupport.type, "emberfall_command");
  session = await squadServer.joinSession(session.code, teammate);
  const teammateProfile = await squadServer.readCoopProfile(teammate);
  teammateProfile.supplies.medkits = 0;
  teammateProfile.supplies.armorPlates = 0;
  teammateProfile.ammo.real = 0;
  teammateProfile.ammo.rubber = 0;
  await squadServer.writeCoopProfile(teammateProfile, teammate);
  await squadServer.applyAction(session, host, "start");
  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.mission.livingWorld.support.searchBeacons, true);
  assert.equal(active.mission.livingWorld.support.clinicRelay, true);
  assert.equal(active.mission.livingWorld.support.evacCorridor, true);
  assert.equal(active.mission.livingWorld.support.civilianDamageMul, 0.74);
});

test("Crownfall Square protects the exact Missions 38–40 encounters", async () => {
  const rows = [
    [38, 911240, 10, 0],
    [39, 911241, 12, 0],
    [40, 911242, 2, 0],
  ];
  for(const [level, userId, tigerCount, civilianCount] of rows){
    const host = { id:userId, first_name:`Crown${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.crownfall_square = {
      ...profile.livingWorld.districts.crownfall_square,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.districtId, "crownfall_square");
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.mission.mapTruthVersion, "10.18");
    if(level === 40){
      assert.equal(waiting.tigers.filter((tiger)=>tiger.boss).length, 2);
      assert.deepEqual(waiting.tigers.map((tiger)=>tiger.hpMax), [1850,1850]);
      assert.equal(waiting.mapTruthLandmarks.filter((item)=>item.type === "boss").length, 2);
    }
  }
});

test("Crownfall Defense support and Twin Alpha ward reach Shared Story", async () => {
  const host = { id:911243, first_name:"Crownfall", last_name:"Leader" };
  const teammate = { id:911244, first_name:"Ward", last_name:"Partner" };
  const profile = await squadServer.readCoopProfile(host);
  profile.livingWorld.districts.crownfall_square = {
    ...profile.livingWorld.districts.crownfall_square,
    tigerPressure:92,
    settlementSafety:78,
    bloodScent:80,
  };
  await squadServer.writeCoopProfile(profile, host);
  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:40 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.settlementSupport.label, "Crownfall Twin Ward Command");
  assert.equal(waiting.settlementSupport.type, "crownfall_command");
  assert.equal(waiting.mission.livingWorld.support.calmingTowers, true);
  assert.equal(waiting.mission.livingWorld.support.swarmDefenses, true);
  assert.equal(waiting.mission.livingWorld.support.bossWard, true);
  assert.equal(waiting.mission.livingWorld.support.stealthBossReduction, 3);
  session = await squadServer.joinSession(session.code, teammate);
  await squadServer.applyAction(session, host, "start");
  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.armorFloor, 65);
  assert.equal(active.mission.livingWorld.support.rubberAmmoMinimum, 72);
});

test("Brokenwater Reach protects the exact Missions 41–43 encounters", async () => {
  const rows = [
    [41, 911245, 4, 6, 3, 0],
    [42, 911246, 7, 0, 0, 0],
    [43, 911247, 4, 0, 0, 1],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount, captureRequired] of rows){
    const host = { id:userId, first_name:`Broken${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.brokenwater_reach = {
      ...profile.livingWorld.districts.brokenwater_reach,
      tigerPressure:96,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.districtId, "brokenwater_reach");
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.mission.captureRequired, captureRequired);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
    assert.equal(waiting.waterZones.length, 1);
    assert.equal(waiting.mission.mapTruthVersion, "10.18");
    if(level === 43){
      assert.deepEqual(waiting.mission.captureTargetIds, ["s43_currentstripe"]);
      assert.equal(waiting.tigers.find((tiger)=>tiger.id === "s43_currentstripe")?.hpMax, 760);
      assert.equal(waiting.mapTruthLandmarks.filter((item)=>item.type === "cage").length, 1);
    }
  }
});

test("Brokenwater support rebuilds the crossing and protects Currentstripe research", async () => {
  const host = { id:911248, first_name:"Brokenwater", last_name:"Leader" };
  const teammate = { id:911249, first_name:"River", last_name:"Partner" };
  const profile = await squadServer.readCoopProfile(host);
  profile.livingWorld.districts.brokenwater_reach = {
    ...profile.livingWorld.districts.brokenwater_reach,
    tigerPressure:88,
    settlementSafety:78,
    bloodScent:70,
  };
  await squadServer.writeCoopProfile(profile, host);
  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:43 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.settlementSupport.label, "Brokenwater Wildlife Station");
  assert.equal(waiting.settlementSupport.type, "brokenwater_station");
  assert.equal(waiting.mission.livingWorld.support.bridgeSecured, true);
  assert.equal(waiting.mission.livingWorld.support.hunterBeacons, true);
  assert.equal(waiting.mission.livingWorld.support.survivorCamp, true);
  assert.equal(waiting.mission.livingWorld.support.civilianDamageMul, 0.74);
  assert.equal(waiting.mission.livingWorld.support.rubberAmmoMinimum, 52);
  assert.equal(waiting.mission.livingWorld.support.tranqMinimum, 10);
  session = await squadServer.joinSession(session.code, teammate);
  await squadServer.applyAction(session, host, "start");
  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.routeSpeedMul, 1.12);
});

test("Floodplain Lifeline protects the exact Missions 44–47 encounters", async () => {
  const rows = [
    [44, 911250, 4, 1, 3],
    [45, 911251, 8, 0, 3],
    [46, 911252, 5, 4, 3],
    [47, 911253, 5, 7, 3],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount] of rows){
    const host = { id:userId, first_name:`Flood${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.floodplain_lifeline = {
      ...profile.livingWorld.districts.floodplain_lifeline,
      tigerPressure:97,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.districtId, "floodplain_lifeline");
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.mission.captureRequired, 0);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
    assert.equal(waiting.waterZones.length, 1);
    assert.equal(waiting.mission.mapTruthVersion, "10.18");
    assert(waiting.mapTruthLandmarks.length >= 4);
  }
});

test("Floodplain support marks the crossings and keeps the River Camp route open", async () => {
  const host = { id:911254, first_name:"Floodplain", last_name:"Leader" };
  const teammate = { id:911255, first_name:"Camp", last_name:"Partner" };
  const profile = await squadServer.readCoopProfile(host);
  profile.livingWorld.districts.floodplain_lifeline = {
    ...profile.livingWorld.districts.floodplain_lifeline,
    tigerPressure:90,
    settlementSafety:78,
    bloodScent:70,
  };
  await squadServer.writeCoopProfile(profile, host);
  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:47 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.settlementSupport.label, "Floodplain Lifeline Camp");
  assert.equal(waiting.settlementSupport.type, "floodplain_clinic");
  assert.equal(waiting.mission.livingWorld.support.bridgeSecured, true);
  assert.equal(waiting.mission.livingWorld.support.hunterBeacons, true);
  assert.equal(waiting.mission.livingWorld.support.survivorCamp, true);
  assert.equal(waiting.mission.livingWorld.support.civilianDamageMul, 0.74);
  assert.equal(waiting.mission.livingWorld.support.medkitMinimum, 3);
  assert.equal(waiting.mission.livingWorld.support.rubberAmmoMinimum, 40);
  session = await squadServer.joinSession(session.code, teammate);
  await squadServer.applyAction(session, host, "start");
  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.routeSpeedMul, 1.12);
});

test("Tidefang Delta protects the exact Missions 48–50 encounters", async () => {
  const rows = [
    [48, 911256, 7, 4, 0, 1],
    [49, 911257, 11, 0, 0, 2],
    [50, 911258, 1, 0, 0, 1],
  ];
  for(const [level, userId, tigerCount, civilianCount, checkpointCount, waterCount] of rows){
    const host = { id:userId, first_name:`Tide${level}`, last_name:"Leader" };
    const profile = await squadServer.readCoopProfile(host);
    profile.livingWorld.districts.tidefang_delta = {
      ...profile.livingWorld.districts.tidefang_delta,
      tigerPressure:97,
      settlementSafety:78,
      bloodScent:100,
    };
    await squadServer.writeCoopProfile(profile, host);
    const session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:level });
    const waiting = await squadServer.buildSnapshot(session, host.id);
    assert.equal(waiting.mission.livingWorld.districtId, "tidefang_delta");
    assert.equal(waiting.mission.livingWorld.extraPatrols, 0);
    assert.equal(waiting.mission.tigerCount, tigerCount);
    assert.equal(waiting.mission.rescueRequired, civilianCount);
    assert.equal(waiting.mission.captureRequired, 0);
    assert.equal(waiting.tigers.length, tigerCount);
    assert.equal(waiting.civilians.length, civilianCount);
    assert.equal(waiting.checkpoints.length, checkpointCount);
    assert.equal(waiting.waterZones.length, waterCount);
    assert.equal(waiting.mission.mapTruthVersion, "10.18");
    assert(waiting.mapTruthLandmarks.length >= 4);
    if(level === 48) assert.equal(waiting.mission.extractionType, "boat");
    if(level === 50){
      const giant = waiting.tigers.find((tiger)=>tiger.id === "s50_giant_river_tiger");
      assert.equal(giant?.hpMax, 2850);
      assert.equal(giant?.bloodRage, true);
    }
  }
});

test("Tidefang support secures the boat lane and reduces Giant River Tiger rage", async () => {
  const host = { id:911259, first_name:"Tidefang", last_name:"Leader" };
  const teammate = { id:911260, first_name:"Delta", last_name:"Partner" };
  const profile = await squadServer.readCoopProfile(host);
  profile.livingWorld.districts.tidefang_delta = {
    ...profile.livingWorld.districts.tidefang_delta,
    tigerPressure:94,
    settlementSafety:78,
    bloodScent:72,
  };
  await squadServer.writeCoopProfile(profile, host);
  let session = await squadServer.createSession(host, { launchType:"shared-story", storyMissionLevel:50 });
  const waiting = await squadServer.buildSnapshot(session, host.id);
  assert.equal(waiting.settlementSupport.label, "Tidefang Marine Command");
  assert.equal(waiting.settlementSupport.type, "tidefang_station");
  assert.equal(waiting.mission.livingWorld.support.bridgeSecured, true);
  assert.equal(waiting.mission.livingWorld.support.hunterBeacons, true);
  assert.equal(waiting.mission.livingWorld.support.survivorCamp, true);
  assert.equal(waiting.mission.livingWorld.support.bossRageReduction, 3);
  assert.equal(waiting.mission.livingWorld.support.rubberAmmoMinimum, 56);
  assert.equal(waiting.mission.livingWorld.support.tranqMinimum, 12);
  session = await squadServer.joinSession(session.code, teammate);
  await squadServer.applyAction(session, host, "start");
  const active = await squadServer.buildSnapshot(await squadServer.readSession(session.code), teammate.id);
  assert.equal(active.status, "active");
  assert.equal(active.mission.livingWorld.support.routeSpeedMul, 1.12);
});
