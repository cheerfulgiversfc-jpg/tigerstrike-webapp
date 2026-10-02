const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const truth = require("./mission-map-truth.js");

assert.equal(truth.VERSION, "10.18");
assert.equal(truth.MAX_MISSION, 50);
assert.deepEqual(truth.validate(), [], "all Missions 1-50 must have valid authored map truth");
assert.equal(Object.keys(truth.MISSIONS).length, 50, "exactly Missions 1-50 are covered");
assert.equal(truth.get(51), null, "V10.18 must not silently reuse Mission 50 for later missions");

for(let level=1; level<=50; level++){
  const spec = truth.get(level);
  assert.equal(spec.level, level);
  assert(spec.landmarks.length >= 3, `Mission ${level} needs at least three meaningful map landmarks`);
  assert(spec.route.length >= 2, `Mission ${level} needs a visible objective route`);
  if(level <= 37) assert(spec.requiredActionIds.length >= 1, `Mission ${level} needs at least one real map interaction`);
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
assert.equal(truth.get(38).tigers, 10, "Mission 38 keeps the exact ten-tiger swarm");
assert.equal(truth.get(39).tigers, 12, "Mission 39 keeps the exact twelve-tiger pack");
assert.equal(truth.get(40).landmarks.filter((item)=>item.type === "boss").length, 2, "Mission 40 shows both Alpha territories");
assert.equal(truth.get(41).civilians, 6, "Mission 41 keeps six escorted civilians");
assert.equal(truth.get(41).landmarks.filter((item)=>item.type === "bridge" && item.required).length, 2, "Mission 41 shows its working bridge route");
assert.equal(truth.get(42).tigers, 7, "Mission 42 keeps the exact seven-tiger riverbank attack");
assert.equal(truth.get(43).captures, 1, "Mission 43 requires Currentstripe to be captured alive");
assert.equal(truth.get(44).civilians, 1, "Mission 44 keeps the wounded villager escort");
assert.equal(truth.get(44).tigers, 4, "Mission 44 keeps its four river threats");
assert.equal(truth.get(45).tigers, 8, "Mission 45 keeps the exact eight-tiger crossing ambush");
assert.equal(truth.get(46).civilians, 4, "Mission 46 keeps the four-person supply convoy");
assert.equal(truth.get(46).tigers, 5, "Mission 46 keeps its five convoy attackers");
assert.equal(truth.get(47).civilians, 7, "Mission 47 keeps seven escorted civilians");
assert.equal(truth.get(47).tigers, 5, "Mission 47 keeps its five River Camp attackers");
assert.equal(truth.get(48).civilians, 4, "Mission 48 keeps the four-person rescue-boat crew");
assert.equal(truth.get(48).tigers, 7, "Mission 48 keeps its seven boat attackers");
assert.equal(truth.get(48).extraction, "boat", "Mission 48 uses real boat extraction");
assert.equal(truth.get(49).tigers, 11, "Mission 49 keeps the exact eleven-tiger delta pack");
assert.equal(truth.get(49).landmarks.filter((item)=>item.type === "river").length, 2, "Mission 49 shows both delta channels");
assert.equal(truth.get(50).tigers, 1, "Mission 50 keeps one Giant River Tiger");
assert.equal(truth.get(50).landmarks.filter((item)=>item.type === "boss").length, 1, "Mission 50 shows the Giant River Tiger territory");

const game = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
const coop = fs.readFileSync(path.join(__dirname, "squad-coop.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "api/_lib/squad-session.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
assert(game.includes("drawMissionMapTruthOverlay({ mobileFast:true })"), "mobile map renders mission truth");
assert(game.includes("drawMissionMapTruthOverlay({ mobileFast:false })"), "full map renders mission truth");
assert(game.includes("missionMapTruthReady(S)"), "solo completion is gated by required visible map objectives");
assert(game.includes("activateMissionMapTruthInteractable"), "mission landmarks have real player interaction");
assert(game.includes("cfg.number <= 50"), "Solo Story applies exact Mission Map Truth counts through Mission 50");
assert(server.includes('require("../../mission-map-truth")'), "Live Squad uses the same mission truth manifest");
assert(server.includes("mapTruthLandmarks:mission.mapTruthLandmarks || []"), "Live Squad sends authored landmarks to both phones");
assert(coop.includes("drawSharedMissionTruth(ctx,snap)"), "Live Squad renders the shared mission landmarks");
assert(game.includes("missionMapTruthHazardTick"), "Solo Mission 37 fire is a real gameplay hazard");
assert(html.includes("mission-map-truth.js?v=5150-tidefang"), "mission truth loads before gameplay");

console.log("mission-map-truth tests passed");
