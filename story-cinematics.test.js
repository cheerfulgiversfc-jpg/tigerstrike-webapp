const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const cinema=require("./story-cinematics");

const game=fs.readFileSync("game.js","utf8");
const html=fs.readFileSync("index.html","utf8");

test("Mission 1 opening is a timed five-scene in-engine movie",()=>{
  assert.equal(cinema.SCENES.length,5);
  assert.equal(cinema.DURATION,25500);
  assert.equal(cinema.sceneAt(0).id,"dawn");
  assert.equal(cinema.sceneAt(9000).id,"attack");
  assert.equal(cinema.sceneAt(25000).id,"mission");
  assert(cinema.SCENES.every((scene)=>scene.caption&&scene.kicker&&scene.end>scene.start));
});

test("cinematic is limited to Story Campaign Mission 1",()=>{
  assert.equal(cinema.supports({mode:"Story",mission:{number:1,storyVariant:"Campaign"}}),true);
  assert.equal(cinema.supports({mode:"Story",mission:{number:2,storyVariant:"Campaign"}}),false);
  assert.equal(cinema.supports({mode:"Arcade",mission:{number:1}}),false);
});

test("player exposes captions, pause, replay, skip, and Story Journal replay",()=>{
  for(const id of ["storyMovieCanvas","storyMovieCaption","storyMovieProgress","storyMoviePlayBtn","storyMovieReplayBtn","missionCinemaContinueBtn","storyCinematicReplayBtn"]){
    assert(html.includes(`id="${id}"`),`${id} must be present`);
  }
  assert(game.includes("replayStoryMissionOneCinematic"));
  assert(game.includes('["Mission 1 Movie","replayStoryMissionOneCinematic()"]'));
  assert(game.includes("TigerStoryCinema?.open"));
  assert(game.includes("TigerStoryCinema?.stop"));
});
