const assert = require("assert");
const intelligence = require("./tiger-intelligence");

const solo = intelligence.balanceFor({ playerCount:1, mode:"Story", level:100 });
const coop = intelligence.balanceFor({ playerCount:2, mode:"Story", level:100 });
assert(solo.damageMul < coop.damageMul, "solo tiger damage stays lower than co-op");
assert(solo.detectMul < coop.detectMul, "solo tiger detection stays lower than co-op");
assert(solo.maxCoordinatedAttackers === 2, "solo limits coordinated attackers to two");
assert(solo.warningMsMul > coop.warningMsMul, "solo receives longer warning windows");

const shot = intelligence.noiseEvent({ x:100, y:100, intensity:1.5, noiseMul:1.2, at:1000, source:"gunshot" });
assert(intelligence.noiseAt(shot, 100, 100, 1200) > intelligence.noiseAt(shot, 400, 400, 1200), "sound is strongest near its source");
assert.strictEqual(intelligence.noiseAt(shot, 100, 100, shot.expiresAt + 1), 0, "sound expires");

assert.strictEqual(intelligence.awarenessFor({ distance:900, detectionRange:300, targetVisible:false }).key, "calm");
assert.strictEqual(intelligence.awarenessFor({ distance:25, detectionRange:300, targetVisible:true }).key, "attacking");
assert.strictEqual(intelligence.awarenessFor({ distance:130, detectionRange:300, bloodScent:0.8 }).key, "blood_frenzy");

const memory = intelligence.rememberTarget(null, { x:44, y:55 }, 1000, 3000);
assert.deepStrictEqual(intelligence.rememberTarget(memory, null, 2000, 3000), memory, "target memory persists briefly");
assert.strictEqual(intelligence.rememberTarget(memory, null, 5000, 3000), null, "target memory expires");

console.log("tiger intelligence tests passed");
