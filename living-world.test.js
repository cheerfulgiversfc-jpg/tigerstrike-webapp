const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const livingWorld = require("./living-world");

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

test("Living World is integrated into solo, Shared Story, and the Telegram cache build", () => {
  assert(game.includes("function recordLivingWorldStoryOutcome"));
  assert(game.includes("worldMapLivingChapterOneHtml(wm)"));
  assert(game.includes("Living World: ${result.summary}"));
  assert(server.includes('const livingWorld = require("../../living-world")'));
  assert(server.includes("livingWorldOutcome = livingWorld.applyOutcome"));
  assert(squad.includes("function sharedLivingWorldHtml"));
  assert(squad.includes("YOUR SHARED STORY WORLD"));
  assert(html.includes("living-world.js?v=5075-living-world"));
  assert(html.includes("V10.2 (Living World Foundation)"));
});
