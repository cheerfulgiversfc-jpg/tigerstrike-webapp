const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const geometry = require("./extraction-geometry.js");

const river = geometry.sharedStoryRiverPlacement(2400, 2200, { x:180, y:180 });
assert.equal(river.sharedStoryRiver, true);
assert.equal(river.y % 1100, 990, "Story boat pickup is inside the visible river band");
assert.notEqual(river.y % 1100, 536, "Story boat pickup is never placed on the road centerline");
assert.ok(Math.abs(river.shoreY - river.y) <= 74, "soldier can board from the riverbank without walking on water");

const partialRiver = geometry.sharedStoryRiverPlacement(4228, 2800, { x:180, y:180 });
const partialRiverLocalX = partialRiver.x % 1200;
assert.ok(partialRiverLocalX === 1010 || partialRiverLocalX === 190, `partial district must keep a real river lane, received local x ${partialRiverLocalX}`);
assert.ok(partialRiverLocalX < 540 || partialRiverLocalX > 672, "partial district must not clamp a river pickup onto the vertical road");

const road = geometry.sharedStoryRoadPlacement(2400, 2200, { x:180, y:180 });
assert.equal(road.sharedStoryRoad, true);
assert.equal(road.y % 1100, 536, "land transport pickup is aligned to the marked road lane");

const partialRoad = geometry.sharedStoryRoadPlacement(4228, 2800, { x:180, y:180 });
assert.equal(partialRoad.x % 1200, 1010, "partial district keeps the land transport on a complete marked lane");
assert.equal(partialRoad.y % 1100, 536, "partial row keeps the land transport on a complete marked lane");

const water = { x:500, y:400, rx:180, ry:70, rot:0.2 };
const boat = geometry.ellipseBoatPlacement(water, { x:500, y:0 });
const localCos = Math.cos(-water.rot);
const localSin = Math.sin(-water.rot);
const dx = boat.x - water.x;
const dy = boat.y - water.y;
const localX = dx * localCos - dy * localSin;
const localY = dx * localSin + dy * localCos;
assert.ok((localX * localX) / (water.rx * water.rx) + (localY * localY) / (water.ry * water.ry) < 1, "boat pickup is inside its water ellipse");

const helicopterMotion = geometry.departureMotion("helicopter", 1, 0);
assert.ok(helicopterMotion.dy < -300 && helicopterMotion.scale < 0.7, "helicopter visibly lifts and flies away");
const boatMotion = geometry.departureMotion("boat", 1, Math.PI);
assert.ok(boatMotion.dx < -500 && Math.abs(boatMotion.dy) < 0.001, "boat travels along its water heading");
assert.ok(geometry.departureDurationMs("helicopter") >= 5000, "helicopter departure remains visible long enough to read");
assert.ok(geometry.departureDurationMs("suv") >= 4000, "vehicle departure remains visible long enough to read");

const gameSource = fs.readFileSync(path.join(__dirname, "game.js"), "utf8");
assert.match(gameSource, /def\?\.key === "boat"\s*\? \{ x:base\.x, y:base\.y \}/, "civilian boat zone bypasses land-only safe-spawn relocation");
assert.match(gameSource, /playerBoardedForExtraction\(S\)/, "soldier renderer hides the ground actor after boarding");
assert.match(gameSource, /ex\.playerBoarded = true/, "final extraction explicitly boards the soldier");
assert.match(gameSource, /geometry\.sharedStoryRiverPlacement/, "Story extraction uses the visible bright-map river geometry");

console.log("PASS: river, helicopter, and road extractions use truthful placement, boarding, and departure motion");
