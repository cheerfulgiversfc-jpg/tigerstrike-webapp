const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const tutorial = fs.readFileSync("tutorial.js", "utf8");
const field = fs.readFileSync("field-systems.js", "utf8");

test("brand-new players receive one explicit tutorial choice", () => {
  for(const id of ["tutorialWelcomeOverlay", "tutorialWelcomePlay", "tutorialWelcomeSkip"]){
    assert(html.includes(`id="${id}"`), `missing ${id}`);
  }
  assert(game.includes("tutorialOnboardingVersion:0"));
  assert(tutorial.includes('saveFirstLaunchChoice("play")'));
  assert(tutorial.includes('saveFirstLaunchChoice("skip")'));
  assert(tutorial.includes("FIRST_LAUNCH_TUTORIAL_KEY"));
  assert(tutorial.includes("localStorage.setItem(FIRST_LAUNCH_TUTORIAL_KEY"));
  assert(tutorial.includes("setTimeout(showFirstLaunchTutorialChoice, 850)"));
  assert(tutorial.includes('saveFirstLaunchChoice("play");\n    hideWelcome();'));
});

test("returning saves are grandfathered and do not receive a surprise popup", () => {
  assert(game.includes("Number(saved.tutorialOnboardingVersion)"));
  assert(game.includes(": 1;"));
  assert(tutorial.includes("Number(S.tutorialOnboardingVersion || 0) >= 1"));
});

test("training reflects current controls and capture rules", () => {
  assert(!tutorial.includes("Tap anywhere on the map to move your agent"));
  for(const key of ["moveControl", "rubber_ammo", "secondary_gear", "field_consequences"]){
    assert(tutorial.includes(key), `missing tutorial coverage for ${key}`);
  }
  assert(game.includes('S.ammoModeByWeapon["W_9MM_JUNK"] = "rubber"'));
  assert(game.includes('S.mag.ammoId = "9MM_RUBBER"'));
  assert(game.includes("Training safety is on"));
  assert(game.includes('secondaryId:"flare"'));
  assert(game.includes('"dailyRewardOverlay","baseHqOverlay","launchIntroOverlay"'));
  assert(game.includes("leaveBaseHqView({ restoreMenu:true })"));
  assert(field.includes('markTigerTutorialAction?.("secondary"'));
});

test("coach card follows camera-aware targets without blocking their controls", () => {
  assert(game.includes("window.tutorialWorldToScreenPoint"));
  assert(tutorial.includes("function tutorialTargetRect(step)"));
  assert(tutorial.includes("function canvasClientPoint(x, y)"));
  assert(tutorial.includes("const aboveTop"));
  assert(tutorial.includes("const belowTop"));
  assert(html.includes("max-height:min(31vh, 250px)"));
  assert(html.includes("pointer-events:none"));
  assert(html.indexOf('id="tutorialArrow"') < html.indexOf('src="./tutorial.js'));
});

test("tutorial interactables render without private map-helper errors", () => {
  const drawInteractable = game.slice(game.indexOf("function drawMapInteractable"), game.indexOf("function drawMapExpansionMinimap"));
  assert(!drawInteractable.includes("crateBlock("));
});

test("all tutorial navigation buttons use duplicate-safe touch handling", () => {
  assert(tutorial.includes("function bindReliablePress(button, handler)"));
  for(const binding of [
    "bindReliablePress(nextBtn",
    "bindReliablePress(skipBtn",
    "bindReliablePress(welcomePlayBtn",
    "bindReliablePress(welcomeSkipBtn"
  ]) assert(tutorial.includes(binding), `missing ${binding}`);
});
