const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const coop = fs.readFileSync("squad-coop.js", "utf8");
const menuMusic = "assets/audio/tiger-strike-menu.mp3";
const missionMusic = "assets/audio/no-one-stands-alone-mission.m4a";
const bossMusic = "assets/audio/testing-mission.mp3";

test("V9.0 ships the three supplied full-length soundtrack files", () => {
  for(const file of [menuMusic, missionMusic, bossMusic]){
    assert(fs.existsSync(file), `missing ${file}`);
    assert(fs.statSync(file).size > 1_000_000, `${file} is unexpectedly small`);
    const header = fs.readFileSync(file).subarray(0, 12);
    const mp3 = header.subarray(0, 3).toString("ascii") === "ID3" || header[0] === 0xff;
    const m4a = header.subarray(4, 8).toString("ascii") === "ftyp";
    assert(mp3 || m4a, `${file} is not supported soundtrack audio`);
  }
  assert(game.includes('title:"Tiger Strike"'));
  assert(game.includes('src:"./assets/audio/tiger-strike-menu.mp3"'));
  assert(game.includes('title:"No One Stands Alone"'));
  assert(game.includes('src:"./assets/audio/no-one-stands-alone-mission.m4a"'));
  assert(game.includes('title:"Testing"'));
  assert(game.includes('src:"./assets/audio/testing-mission.mp3"'));
});

test("regular gameplay, boss missions, and menus route to different tracks", () => {
  assert(game.includes('["mission","danger","battle"].includes'));
  assert(game.includes('musicMode === "boss-mission"'));
  assert(game.includes('["Arcade","Survival"].includes(S.mode)'));
  assert(game.includes('level % 10 === 0'));
  assert(coop.includes('fullBossMission ? "boss-mission"'));
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

test("V9.2 cache key forces Telegram to load Shared Story Chapter 8", () => {
  assert(game.includes('const TS_BUILD = "5065"'));
  assert(html.includes("game.js?v=5065-story-ch8"));
  assert(html.includes("squad-coop.js?v=5065-story-ch8"));
});
