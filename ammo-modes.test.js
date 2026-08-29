const assert = require("node:assert/strict");
const test = require("node:test");
const rules = require("./ammo-modes");

test("rubber rounds can never kill a tiger", ()=>{
  const result = rules.applyTigerAmmoDamage({ hp:5, hpMax:100, damage:999, mode:"rubber" });
  assert.equal(result.hp, 1);
  assert.equal(result.defeated, false);
  assert.equal(result.lethalWounded, false);
  assert.equal(result.slowed, true);
});

test("real rounds can kill and make the tiger ineligible for capture", ()=>{
  const result = rules.applyTigerAmmoDamage({ hp:5, hpMax:100, damage:20, mode:"real" });
  assert.equal(result.hp, 0);
  assert.equal(result.defeated, true);
  assert.equal(result.lethalWounded, true);
  assert.equal(rules.canCaptureTiger({ hp:20, hpMax:100, lethalWounded:result.lethalWounded }), false);
});

test("rubber-weakened tiger can be captured inside the capture window", ()=>{
  const result = rules.applyTigerAmmoDamage({ hp:35, hpMax:100, damage:20, mode:"rubber" });
  assert.equal(rules.canCaptureTiger({ hp:result.hp, hpMax:100, lethalWounded:result.lethalWounded }), true);
});

test("rubber slow stacks safely", ()=>{
  assert.equal(rules.rubberSlowMultiplier(1, true), 0.78);
  assert.equal(rules.rubberSlowMultiplier(4, true), 0.54);
  assert.equal(rules.rubberSlowMultiplier(4, false), 1);
});
