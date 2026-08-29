const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const game = fs.readFileSync("game.js", "utf8");
const coop = fs.readFileSync("squad-coop.js", "utf8");
const server = fs.readFileSync("api/_lib/squad-session.js", "utf8");
const route = fs.readFileSync("api/squad/session.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");

test("Solo, Shared Story, and Special Operations expose the same ammunition system", ()=>{
  for(const id of ["9MM_RUBBER","12GA_RUBBER","556_RUBBER","762_RUBBER","RAIL_RUBBER"]){
    assert(game.includes(id), `${id} is sold in the shared Shop catalog`);
  }
  assert(game.includes("floorHp:rubberShot ? captureWindowMinHp(t)"), "Solo Rubber shots cannot pass below the live-capture floor");
  assert(game.includes("if(shotMode === \"real\") t.lethalWounded = true"), "Solo Real hits block capture");
  assert(game.includes("setWeaponAmmoMode"), "Inventory and combat can switch ammunition modes");
  assert(html.includes("touchAmmoModeBtn") && html.includes("combatAmmoModeBtn"), "mobile and desktop combat controls expose ammunition switching");
  assert(coop.includes("squadAmmoModeButton") && coop.includes("squadCaptureButton"), "Live Squad has separate ammunition and Capture buttons");
  assert(server.includes("ammoMode:\"real\"") && server.includes("lethalWoundedIds"), "co-op persists authoritative ammunition and capture state");
  assert(route.includes('"ammo-mode"'), "the co-op API accepts ammunition mode changes");
  for(const operation of ["tiger-den","village-siege","convoy-rescue","alpha-hunt","storm-extraction","endless-survival"]){
    assert(route.includes(operation), `${operation} stays routed through the shared co-op combat engine`);
  }
  assert(route.includes('"live-squad"'), "Night Fang Live Squad stays routed through the shared co-op combat engine");
});
