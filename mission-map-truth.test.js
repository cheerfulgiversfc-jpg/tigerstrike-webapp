const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const truth = require("./mission-map-truth.js");

assert.equal(truth.VERSION, "10.14");
assert.equal(truth.MAX_MISSION, 37);
assert.deepEqual(truth.validate(), [], "all Missions 1-37 must have valid authored map truth");
assert.equal(Object.keys(truth.MISSIONS).length, 37, "exactly Missions 1-37 are covered");
assert.equal(truth.get(38), null, "V10.14 must not silently reuse Mission 37 for later missions");

for(let level=1; level<=37; level++){
  const spec = truth.get(level);
  assert.equal(spec.level, level);
  assert(spec.landmarks.length >= 3, `Mission ${level} needs at least three meaningful map landmarks`);
  assert(spec.route.length >= 2, `Mission ${level} needs a visible objective route`);
  assert(spec.requiredActionIds.length >= 1, `Mission ${level} needs at least one real map interaction`);
  const scaled = truth.scale(level, 2400, 1800);
  assert(scaled.landmarks.every((item)=>item.x > 0 && item.x < 2400 && item.y > 0 && item.y < 1800));
}

assert.equal(truth.get(31).landmarks.filter((item)=>item.type === "home" && item.required).length, 4, "Mission 31 has four searchable homes");
assert.equal(truth.get(29).extraction, "helicopter", "Mission 29 uses real helicopter extraction");
assert(truth.get(24).landmarks.some((item)=>item.type === "bridge" && item.required), "Mission 24 includes its river crossing");
assert.equal(truth.get(13).captures, 2, "Mission 13 requires two live captures");
assert.equal(truth.get(33).civilians, 6, "Mission 33 has six survivors");
assert.equal(truth.get(34).captures, 3, "Mission 34 requires three live research captures");
assert.equal(truth.get(35).extraction, "vehicle", "Mission 35 uses a real convoy extraction");
assert.equal(truth.get(36).landmarks.filter((item)=>item.type === "research" && item.required).length, 3, "Mission 36 has three working sample sites");
assert.equal(truth.get(37).landmarks.filter((item)=>item.type === "fire").length, 4, "Mission 37 shows all four fire zones");

const game = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
const coop = fs.readFileSync(path.join(__dirname, "squad-coop.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "api/_lib/squad-session.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert(game.includes("drawMissionMapTruthOverlay({ mobileFast:true })"), "mobile map renders mission truth");
assert(game.includes("drawMissionMapTruthOverlay({ mobileFast:false })"), "full map renders mission truth");
assert(game.includes("missionMapTruthReady(S)"), "solo completion is gated by required visible map objectives");
assert(game.includes("activateMissionMapTruthInteractable"), "mission landmarks have real player interaction");
assert(server.includes('require("../../mission-map-truth")'), "Live Squad uses the same mission truth manifest");
assert(server.includes("mapTruthLandmarks:mission.mapTruthLandmarks || []"), "Live Squad sends authored landmarks to both phones");
assert(coop.includes("drawSharedMissionTruth(ctx,snap)"), "Live Squad renders the shared mission landmarks");
assert(game.includes("missionMapTruthHazardTick"), "Solo Mission 37 fire is a real gameplay hazard");
assert(html.includes("mission-map-truth.js?v=5110-emberfall"), "mission truth loads before gameplay");

console.log("mission-map-truth tests passed");
