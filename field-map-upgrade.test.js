const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

function sourceBetween(start, end){
  const from = game.indexOf(start);
  const to = game.indexOf(end, from);
  assert(from >= 0, `missing ${start}`);
  assert(to > from, `missing ${end}`);
  return game.slice(from, to);
}

test("Arcade chapters use only premium Story map families", () => {
  const maps = sourceBetween("const ARCADE_CHAPTER_MAPS", "const CHAPTER_VISUALS");
  assert(!maps.includes('key:"AR_'));
  assert(!maps.includes('key:"SV_'));
  for(const key of ["ST_FOREST", "ST_SUBURBS", "ST_DOWNTOWN", "ST_INDUSTRIAL"]){
    assert(maps.includes(`key:"${key}"`), `missing ${key}`);
  }
});

test("Survival and Arcade selectors use premium map keys", () => {
  const maps = sourceBetween("const MODE_MAPS", "const MAP_REALISM_PROPS");
  assert(!maps.includes('key:"AR_'));
  assert(!maps.includes('key:"SV_'));
});

test("all three field modes share the premium world scale and phone collision layout", () => {
  const scale = sourceBetween("function worldScaleForModeMission", "function desiredWorldLayout");
  assert(!scale.includes('mode === "Arcade"'));
  assert(!scale.includes('mode === "Story"'));
  assert(game.includes('["Story", "Arcade", "Survival"].includes(normalizeModeName(S.mode))'));
  assert(game.includes("const sharedPremiumDistrict"));
});

test("V10.1.3 is cache-busted for Telegram clients", () => {
  assert(game.includes('const TS_BUILD = "5074"'));
  assert(html.includes("V10.1.3"));
  assert(html.includes("game.js?v=5074-fair-survival"));
});
