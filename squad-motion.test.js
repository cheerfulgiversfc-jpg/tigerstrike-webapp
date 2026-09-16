const assert = require("assert");
const test = require("node:test");
const motion = require("./squad-motion");

const world = { width:3800, height:2200 };
const walking = { x:500, y:500, moving:true, moveX:1, moveY:0, online:true, downed:false };

test("remote soldier continues walking smoothly between verified phone updates", () => {
  let sample = motion.accept(null, walking, 1000, world);
  for(let frame=1; frame<=20; frame++) sample = motion.step(sample, 1000 + frame * 16, .016, 185, world);
  assert(sample.drawX > 520, "the other phone sees continuous movement instead of a freeze");
  assert(sample.drawX < 570, "prediction remains close to verified speed");
  const bounded = motion.step(sample, 3000, .016, 185, world);
  assert(bounded.drawX <= walking.x + 185 * motion.MAX_PREDICTION_MS / 1000, "a stale update never causes endless walking");
});

test("releasing movement stops prediction and eases to the server position", () => {
  let sample = motion.accept(null, walking, 1000, world);
  for(let frame=1; frame<=20; frame++) sample = motion.step(sample, 1000 + frame * 16, .016, 185, world);
  const released = motion.accept(sample, { ...walking, x:538, moving:false, moveX:0 }, 1320, world);
  assert.equal(released.moving, false);
  let settled = released;
  for(let frame=1; frame<=30; frame++) settled = motion.step(settled, 1320 + frame * 16, .016, 185, world);
  assert(Math.abs(settled.drawX - 538) < 1, "the character settles at the authoritative stop point");
});

test("changing direction follows the new verified input without a position jump", () => {
  let sample = motion.accept(null, walking, 1000, world);
  for(let frame=1; frame<=18; frame++) sample = motion.step(sample, 1000 + frame * 16, .016, 185, world);
  const beforeTurn = sample.drawX;
  sample = motion.accept(sample, { ...walking, x:535, moveX:-1 }, 1290, world);
  assert.equal(sample.drawX, beforeTurn, "receiving a new direction does not teleport the drawn soldier");
  for(let frame=1; frame<=18; frame++) sample = motion.step(sample, 1290 + frame * 16, .016, 185, world);
  assert(sample.drawX < beforeTurn, "the soldier visibly reverses after the turn packet");
});

test("respawns and large authoritative moves snap instead of ghost-gliding", () => {
  const first = motion.accept(null, walking, 1000, world);
  const respawn = motion.accept(first, { ...walking, x:1900, y:1400, downed:true, moving:false }, 1400, world);
  assert.equal(respawn.drawX, 1900);
  assert.equal(respawn.drawY, 1400);
});
