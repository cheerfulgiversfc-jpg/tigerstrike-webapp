const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");
const cinema=require("./story-cinematics");

const game=fs.readFileSync("game.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const source=fs.readFileSync("story-cinematics.js","utf8");

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
  for(const id of ["storyMovieCanvas","storyMovieCaption","storyMovieProgress","storyMoviePlayBtn","storyMovieReplayBtn","missionCinemaTopSkipBtn","missionCinemaBottomSkipBtn","missionCinemaContinueBtn","storyCinematicReplayBtn"]){
    assert(html.includes(`id="${id}"`),`${id} must be present`);
  }
  assert(game.includes("replayStoryMissionOneCinematic"));
  assert(game.includes('["Mission 1 Movie","replayStoryMissionOneCinematic()"]'));
  assert(game.includes("TigerStoryCinema?.open"));
  assert(game.includes("TigerStoryCinema?.stop"));
});

test("every cinematic action has protected Telegram touch handling",()=>{
  assert.equal(cinema.TAP_DEDUPE_MS,260);
  for(const eventName of ["pointerdown","touchstart","pointerup","touchend","click"]){
    assert(source.includes(`addEventListener("${eventName}"`),`${eventName} must be handled`);
  }
  for(const id of ["storyMoviePlayBtn","storyMovieReplayBtn","missionCinemaTopSkipBtn","missionCinemaBottomSkipBtn","missionCinemaContinueBtn"]){
    assert(source.includes(`${id}:`),`${id} must have a bound action`);
  }
  assert(source.includes("stopImmediatePropagation"));
  assert(source.includes('overlay.style.pointerEvents="auto"'));
  assert(html.includes("#missionCinemaOverlay{\n      z-index:11000"));
});

test("one physical touch activates exactly once even when a click follows",()=>{
  const handlers={};
  const button={
    dataset:{},
    style:{},
    disabled:false,
    addEventListener(name,handler){handlers[name]=handler;},
  };
  const event={preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}};
  let activations=0;
  assert.equal(cinema.bindTap(button,()=>{activations+=1;}),true);
  handlers.touchend(event);
  handlers.click(event);
  assert.equal(activations,1);
  assert.equal(button.dataset.storyCinemaTapBound,"1");
  assert.equal(button.style.touchAction,"manipulation");
});

test("polished attack faces civilians and deploys two soldiers from the helicopter",()=>{
  assert(source.includes("drawTiger(c,tigerX,401,1.2,elapsed/130,-1)"));
  assert(source.includes("const drop1=")&&source.includes("drop2="));
  assert(source.includes("c.lineTo(s1.x,s1.y-46)")&&source.includes("c.lineTo(s2.x,s2.y-46)"));
  assert(source.includes('drawSoldier(c,500,390')&&source.includes('drawSoldier(c,565,394'));
  assert(source.includes('c.arc(-4,-21,1.8')&&source.includes('c.arc(-4,-25,1.8'));
});
