const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");

const renderer=require("./shared-battlefield-renderer");
const source=fs.readFileSync("shared-battlefield-renderer.js","utf8");
const coop=fs.readFileSync("squad-coop.js","utf8");
const css=fs.readFileSync("squad-coop.css","utf8");
const html=fs.readFileSync("index.html","utf8");

test("V10.22 exposes one reusable premium battlefield renderer",()=>{
  assert.equal(renderer.VERSION,"10.22");
  for(const name of ["drawSoldier","drawCivilian","drawTiger","drawBattlefieldFinish"])assert.equal(typeof renderer[name],"function");
  assert(html.includes('shared-battlefield-renderer.js?v=5191-one-battlefield-final'));
  assert(html.indexOf("shared-battlefield-renderer.js")<html.indexOf("squad-coop.js"));
  assert(coop.includes("TigerStrikeBattlefieldRenderer?.drawSoldier"));
  assert(coop.includes("TigerStrikeBattlefieldRenderer?.drawCivilian"));
  assert(coop.includes("TigerStrikeBattlefieldRenderer?.drawTiger"));
  assert(coop.includes("TigerStrikeBattlefieldRenderer?.drawBattlefieldFinish"));
});

test("Shared Story selects the same four Solo map families by chapter",()=>{
  assert.deepEqual([1,11,21,31,41,51,61,71,81,91].map(renderer.storyFamilyForLevel),[
    "forest","suburbs","forest","downtown","suburbs","industrial","forest","downtown","suburbs","industrial",
  ]);
  assert.equal(typeof renderer.drawStoryMapFoundation,"function");
  assert(coop.includes("drawStoryMapFoundation(ctx,{level:storyLevel,family,worldW,worldH,view})"));
  assert(coop.includes("if(!sharedStoryFoundation)drawCoopWaterZones()"));
  assert(source.includes('if(family==="forest")'));
  assert(source.includes('else if(family==="suburbs")'));
  assert(source.includes('else if(family==="downtown")'));
});

test("premium units contain faces, equipment and articulated motion",()=>{
  assert(source.includes("Independent articulated legs keep the character upright"));
  assert(source.includes("Uniform, vest, belt, shoulder plates and backpack"));
  assert(source.includes("Face has features, hair/helmet, chin and headset"));
  assert(source.includes("Head, muzzle, ears, eyes and whiskers"));
  assert(source.includes('const stride=walking?Math.sin(phase)*7:0'));
  assert(!source.includes("rotate(face)"),"the soldier body must never rotate upside down");
});

test("co-op tiger gait follows real movement and has no target oval",()=>{
  const tiger=coop.slice(coop.indexOf("function drawStoryTiger"),coop.indexOf("function drawTigerCarcass"));
  const sharedTiger=source.slice(source.indexOf("function drawTiger"),source.indexOf("function storyFamilyForLevel"));
  assert(tiger.includes("const walking=moved>.14&&!tiger.captured"));
  assert(tiger.includes("phase:prior.phase"));
  assert(!sharedTiger.includes("setLineDash"),"the shared tiger renderer must not restore an oval target ring");
});

test("mobile co-op controls use the Solo-style floating layout",()=>{
  assert(css.includes(".squadControls{position:fixed"));
  assert(css.includes("background:transparent;box-shadow:none"));
  assert(css.includes(".squadJoystickRing{width:132px;height:132px"));
  assert(css.includes("grid-template-columns:repeat(3,minmax(64px,76px))"));
  assert(css.includes("min-height:64px;aspect-ratio:1;border-radius:22px"));
});
