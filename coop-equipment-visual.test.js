const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const coop = fs.readFileSync("squad-coop.js", "utf8");
const css = fs.readFileSync("squad-coop.css", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const game = fs.readFileSync("game.js", "utf8");

test("co-op equipment hands touch control to Shop and Inventory", () => {
  assert(coop.includes("function setEquipmentPresentation"));
  assert(coop.includes('liveOverlay.style.display = "none"'));
  assert(coop.includes('liveOverlay.style.pointerEvents = "none"'));
  assert(coop.includes('gearOverlay.style.zIndex = "10150"'));
  assert(coop.includes('returnButton.textContent = open ? "Return to Squad" : "Resume"'));
  assert(css.includes("body.liveSquadEquipmentOpen #liveSquadOverlay"));
  assert(css.includes("#shopOverlay.liveSquadEquipmentOverlay"));
  assert(css.includes("#invOverlay.liveSquadEquipmentOverlay"));
  assert(html.includes('id="shopResumeBtn"'));
  assert(html.includes('id="inventoryResumeBtn"'));
  assert(game.includes('returnFromEquipment?.("shop")'));
  assert(game.includes('returnFromEquipment?.("inventory")'));
});

test("co-op equipment returns to and resumes the same squad", () => {
  assert(coop.includes("setEquipmentPresentation(equipment, false)"));
  assert(coop.includes('await api("resume")'));
  assert(coop.includes('setMessage("Returning to your squad…")'));
  assert(coop.includes("if(!state.open||state.equipmentOpen||isTypingTarget(event.target))return"));
});

test("paused co-op equipment keeps the mission soundtrack", () => {
  const music = coop.slice(coop.indexOf("function syncSquadMusicContext"), coop.indexOf("function render"));
  assert(music.includes('if(snap.status !== "active")'));
  assert(!music.includes('snap.status !== "active" || snap.paused'));
});

test("co-op mobile battlefield uses the premium portrait presentation", () => {
  assert(coop.includes("function sizeArenaCanvas"));
  assert(coop.includes("targetW=portrait?900:1200,targetH=portrait?1125:760"));
  assert(css.includes("#squadArena{aspect-ratio:4/5"));
  assert(coop.includes("function drawPremiumDistrictTexture"));
  assert(coop.includes('ctx.imageSmoothingQuality="high"'));
  assert(coop.includes("const vignette=ctx.createRadialGradient"));
});

test("co-op characters are detailed and living tigers have no oval target ring", () => {
  const tiger = coop.slice(coop.indexOf("function drawStoryTiger"), coop.indexOf("function drawTigerCarcass"));
  assert(tiger.includes("const nearest=(state.snapshot?.players||[])"));
  assert(tiger.includes("const facing=nearest?"));
  assert(tiger.includes("ctx.arc(37,-9,2.8"), "tiger face is drawn");
  assert(!tiger.includes("ctx.setLineDash"), "living tiger target ring must stay removed");
  const civilian = coop.slice(coop.indexOf("function drawStoryCivilian"), coop.indexOf("function drawStoryTiger"));
  assert(civilian.includes("ctx.arc(-2.7,-14.5,1"), "civilian face is drawn");
  const soldier = coop.slice(coop.indexOf("function drawStorySoldier"), coop.indexOf("function drawPremiumDistrictTexture"));
  assert(soldier.includes("ctx.arc(-3,-14,1.2"), "soldier face is drawn");
});

test("V8.8 uses one cache key for every gameplay module", () => {
  assert(game.includes('const TS_BUILD = "5061"'));
  for(const file of ["game.js", "squad-coop.js", "field-systems.js", "ammo-modes.js"]){
    assert(html.includes(`${file}?v=5061-coop-parity`), `stale cache key for ${file}`);
  }
});
