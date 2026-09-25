const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const game = fs.readFileSync("game.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

function functionSource(name){
  const start = game.indexOf(`function ${name}(`);
  assert(start >= 0, `missing ${name}`);
  const brace = game.indexOf("{", start);
  let depth = 0;
  for(let i=brace; i<game.length; i++){
    if(game[i] === "{") depth += 1;
    if(game[i] === "}") depth -= 1;
    if(depth === 0) return game.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

const balanceContext = {
  S:{ survivalWave:1 },
  clamp:(value, min, max)=>Math.max(min, Math.min(max, value)),
};
vm.createContext(balanceContext);
for(const name of [
  "survivalTigerCountForWave",
  "survivalTigerBaseHpForWave",
  "survivalDangerLabelForWave",
  "survivalWaveCashReward",
  "survivalAmmoSupplyAmount",
  "survivalTigerTypeForWave",
]){
  vm.runInContext(functionSource(name), balanceContext);
}

test("early Survival waves ramp from two to four tigers with fair HP", () => {
  assert.deepEqual([1,2,3,4,5,6].map(balanceContext.survivalTigerCountForWave), [2,3,4,4,5,5]);
  assert.deepEqual([1,2,3,4,5].map(balanceContext.survivalTigerBaseHpForWave), [110,120,130,140,152]);
  assert.equal(balanceContext.survivalDangerLabelForWave(1), "Low");
  assert.equal(balanceContext.survivalDangerLabelForWave(5), "High");
});

test("Alpha and armored threats cannot appear in the opening waves", () => {
  for(const roll of [0, 0.25, 0.5, 0.75, 0.99]){
    assert(!["Alpha","Berserker"].includes(balanceContext.survivalTigerTypeForWave(1, roll, 0)));
    assert(!["Alpha","Berserker"].includes(balanceContext.survivalTigerTypeForWave(4, roll, 0)));
  }
  assert.equal(balanceContext.survivalTigerTypeForWave(5, 0.2, 0), "Alpha");
  assert(game.includes('disableMutation:S.mode==="Survival" && Math.max(1, Number(S.survivalWave || 1)) < 5'));
});

test("every cleared wave guarantees money and one useful supply", () => {
  assert.equal(balanceContext.survivalWaveCashReward(1), 750);
  assert.equal(balanceContext.survivalWaveCashReward(10), 2100);
  assert.equal(balanceContext.survivalAmmoSupplyAmount(1), 28);
  assert(game.includes("function claimSurvivalWaveSupply"));
  assert(game.includes('claimSurvivalWaveSupply("ammo", { silent:true })'));
  assert(game.includes("S.survivalRewardedWave = clearedWave"));
  for(const choice of ["ammo","medical","armor"]){
    assert(html.includes(`claimSurvivalWaveSupply('${choice}')`));
  }
});

test("deployment kit and safe 12-second Shop break are wired into real gameplay", () => {
  assert(game.includes("const SURVIVAL_PREP_BREAK_MS = 12000"));
  assert(game.includes("const SURVIVAL_DEPLOYMENT_REAL_AMMO = 72"));
  assert(game.includes("function ensureSurvivalDeploymentKit"));
  assert(game.includes("S.medkits.M_SMALL = Math.max(2"));
  assert(game.includes("S.armor = Math.max(50"));
  assert(game.includes("function openSurvivalBreakShop"));
  assert(game.includes("__returnToSurvivalBreakAfterShop"));
  assert(game.includes('runFrameTask("survivalPreparation"'));
  assert(html.includes('id="survivalSupplyOverlay"'));
  assert(html.includes("Shop During Break"));
});

test("preparation break has a large visible countdown and final warning", () => {
  assert(html.includes('id="survivalCountdownStage"'));
  assert(html.includes('id="survivalCountdownNumber">12'));
  assert(html.includes("font-size:clamp(76px,22vw,150px)"));
  assert(html.includes("survivalCountdownPulse"));
  assert(game.includes('countdownNumber.innerText = String(seconds)'));
  assert(game.includes('countdownStage.classList.toggle("urgent", seconds <= 3)'));
  assert(game.includes("seconds !== __lastSurvivalCountdownSecond"));
});

test("Survival remains lethal-only with no capture shortcut", () => {
  assert(game.includes('if(S.mode === "Survival") return interactionFeedback("Survival is kill-only: Real ammunition only, with no capture option."'));
  assert(game.includes("Real ammunition only • No Rubber • No Capture"));
});

test("V10.8 cache bust reaches Telegram clients", () => {
  assert(game.includes('const TS_BUILD = "5081"'));
  assert(html.includes("V10.8"));
  assert(html.includes("game.js?v=5081-crimson-hollow"));
});
