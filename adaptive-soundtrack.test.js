const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const coop = fs.readFileSync("squad-coop.js", "utf8");

test("V8.5 provides continuous multi-state music instead of isolated sound effects", () => {
  for(const mode of ["menu","hq","mission","danger","battle","boss","victory","defeat"]){
    assert(game.includes(`${mode}:{`), `missing ${mode} soundtrack`);
  }
  assert(game.includes("gameMusicScheduleDrums"));
  assert(game.includes("gameMusicChord"));
  assert(game.includes("while(Number(__gameMusic.nextStepAt"), "music must schedule ahead to avoid gaps");
  assert(game.includes("runFrameTask(\"adaptiveAudio\""), "soundtrack director must run continuously");
});

test("soundtrack unlocks from a user gesture and has a separate music control", () => {
  assert(game.includes('["pointerdown","touchstart","click"]'));
  assert(game.includes("startGameMusicDirector()"));
  assert(game.includes("function toggleMusic()"));
  assert(html.includes('onclick="toggleMusic()"'));
  assert(html.includes('id="musicLbl"'));
  assert(html.includes('id="musicLblMobile"'));
});

test("Live Squad drives exploration, combat, boss, victory, and defeat music", () => {
  assert(coop.includes("function syncSquadMusicContext()"));
  for(const context of ["menu","mission","battle","boss","victory","defeat"]){
    assert(coop.includes(`\"${context}\"`), `missing co-op ${context} transition`);
  }
  assert(coop.includes("bossEngaged"));
  assert(coop.includes("attacking || playerDown"));
});

test("V8.5 cache key forces Telegram to load the new soundtrack", () => {
  assert(game.includes('const TS_BUILD = "5057"'));
  assert(html.includes("game.js?v=5057-adaptive-soundtrack"));
  assert(html.includes("squad-coop.js?v=5057-adaptive-soundtrack"));
});
