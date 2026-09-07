const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const coop = fs.readFileSync("squad-coop.js", "utf8");
const menuMusic = "assets/audio/tiger-strike-menu.mp3";
const missionMusic = "assets/audio/testing-mission.mp3";

test("V8.7 ships the two supplied full-length soundtrack files", () => {
  for(const file of [menuMusic, missionMusic]){
    assert(fs.existsSync(file), `missing ${file}`);
    assert(fs.statSync(file).size > 1_000_000, `${file} is unexpectedly small`);
    const header = fs.readFileSync(file).subarray(0, 3).toString("ascii");
    assert(header === "ID3" || header.charCodeAt(0) === 0xff, `${file} is not an MP3`);
  }
  assert(game.includes('title:"Tiger Strike"'));
  assert(game.includes('src:"./assets/audio/tiger-strike-menu.mp3"'));
  assert(game.includes('title:"Testing"'));
  assert(game.includes('src:"./assets/audio/testing-mission.mp3"'));
});

test("all gameplay contexts use Testing and all non-mission contexts use Tiger Strike", () => {
  assert(game.includes('["mission","danger","battle","boss"].includes'));
  for(const context of ["mission","battle","boss"]){
    assert(coop.includes(`\"${context}\"`), `missing co-op ${context} transition`);
  }
  for(const mode of ["Story", "Arcade", "Survival"]){
    assert(game.includes(`\"${mode}\"`), `missing ${mode} gameplay mode`);
  }
  assert(game.includes('if(introOverlayVisible()) return "menu"'));
  assert(game.includes('if(baseHqActive?.()) return "hq"'));
  assert(game.includes('if(S.paused) return "mission"'));
});

test("one looping audio element owns music and prevents overlapping tracks", () => {
  assert(game.includes("const audio = new Audio()"));
  assert(game.includes("audio.loop = true"));
  assert(game.includes("audio.pause();"));
  assert(game.includes("audio.src = track.src"));
  assert(game.includes('__gameMusic = { audio, mode:"", trackKey:"", playbackBlocked:false }'));
  const activeDirector = game.slice(game.indexOf("function gameMusicDirectorTick"), game.indexOf("function tickAudioDirectors"));
  assert(!activeDirector.includes("gameMusicNote("), "the active director must not generate another score");
});

test("music unlocks from a gesture and respects both audio controls", () => {
  assert(game.includes('["pointerdown","touchstart","click"]'));
  assert(game.includes("startGameMusicDirector()"));
  assert(game.includes("function toggleMusic()"));
  assert(html.includes('onclick="toggleMusic()"'));
  assert(html.includes('id="musicLbl"'));
  assert(html.includes('id="musicLblMobile"'));
});

test("V8.8 cache key forces Telegram to load the current co-op build", () => {
  assert(game.includes('const TS_BUILD = "5061"'));
  assert(html.includes("game.js?v=5061-coop-parity"));
  assert(html.includes("squad-coop.js?v=5061-coop-parity"));
});
