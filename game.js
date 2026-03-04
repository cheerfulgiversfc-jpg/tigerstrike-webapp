const tg = window.Telegram?.WebApp;
if (tg){ tg.expand(); tg.ready(); try{tg.setHeaderColor?.("#0b0d12"); tg.setBackgroundColor?.("#0b0d12");}catch(e){} }

// ===================== TELEGRAM HAPTICS (safe fallback) =====================
function hapticImpact(style="light"){
  try{
    const h = tg?.HapticFeedback;
    if(h?.impactOccurred) h.impactOccurred(style);
    else if(h?.notificationOccurred) h.notificationOccurred("success");
  }catch(e){}
}
function hapticNotif(type="success"){
  try{
    const h = tg?.HapticFeedback;
    if(h?.notificationOccurred) h.notificationOccurred(type);
  }catch(e){}
}

// ===================== DAILY LOGIN REWARD (NO BACKEND) =====================
function tgUserKey(){
  const uid = tg?.initDataUnsafe?.user?.id;
  return uid ? String(uid) : "local";
}
// ...rest of daily reward helpers...

function ymdUTC(d=new Date()){
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth()+1).padStart(2,"0");
  const dd = String(d.getUTCDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function readDaily(){
  const key = `ts_daily_${tgUserKey()}`;
  try{ return JSON.parse(localStorage.getItem(key) || "null") || { last:null, streak:0, total:0 }; }
  catch(e){ return { last:null, streak:0, total:0 }; }
}

function writeDaily(obj){
  const key = `ts_daily_${tgUserKey()}`;
  localStorage.setItem(key, JSON.stringify(obj));
}

function awardDailyLogin(){
  if(!window.S) return;

  const today = ymdUTC();
  const info = readDaily();

  if(info.last === today){
    return;
  }

  let newStreak = 1;
  if(info.last){
    const yesterday = new Date(Date.now());
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const y = ymdUTC(yesterday);
    newStreak = (info.last === y) ? (Number(info.streak||0) + 1) : 1;
  }

  const cashBase = 300;
  const cash = cashBase + Math.min(900, newStreak * 60);
  const perkPts = (newStreak % 3 === 0) ? 2 : 1;

  S.funds = (S.funds||0) + cash;
  S.perkPoints = (Number(S.perkPoints||0) + perkPts);

  if(S.stats) S.stats.cashEarned = (S.stats.cashEarned||0) + cash;

  info.last = today;
  info.streak = newStreak;
  info.total = (Number(info.total||0) + 1);
  writeDaily(info);

  toast(`🎁 Daily reward: +$${cash.toLocaleString()} • +${perkPts} perk point${perkPts>1?"s":""} • Streak: ${newStreak}`);
  try{ hapticNotif("success"); }catch(e){}
  save();
}
// ===================== DATA =====================
const WEAPONS = [
  { id:"W_TRQ_PISTOL_MK1", name:"Tranq Pistol Mk I", grade:"Common", price:50,   type:"tranq", ammo:"TRANQ_DARTS",  mag:6,  dmg:[8,12] },
  { id:"W_9MM_JUNK",      name:"9mm Sidearm (Used)", grade:"Common", price:150, type:"lethal", ammo:"9MM_STD",      mag:12, dmg:[10,14] },
  { id:"W_SHOTGUN",       name:"Pump Shotgun", grade:"Uncommon", price:500,     type:"lethal", ammo:"12GA_STD",     mag:5,  dmg:[18,26] },
  { id:"W_TRQ_RIFLE",     name:"Tranq Rifle", grade:"Rare", price:2500,         type:"tranq", ammo:"TRANQ_DARTS",  mag:5,  dmg:[14,20] },
  { id:"W_AR_CARBINE",    name:"AR Carbine", grade:"Rare", price:6500,          type:"lethal", ammo:"556_STD",      mag:30, dmg:[14,20] },
  { id:"W_DMR",           name:"DMR Marksman", grade:"Epic", price:18000,       type:"lethal", ammo:"762_STD",      mag:10, dmg:[20,28] },
  { id:"W_TRQ_LAUNCHER",  name:"Tranquilizer Launcher", grade:"Legendary", price:50000, type:"tranq", ammo:"TRANQ_HEAVY", mag:2, dmg:[30,42] },
  { id:"W_RAIL_PROTO",    name:"Prototype Rail Rifle", grade:"Mythic", price:100000,    type:"lethal", ammo:"RAIL_CELL",   mag:3, dmg:[40,60] },
];

const AMMO = [
  { id:"TRANQ_DARTS",  name:"Tranq Darts", grade:"Standard", price:50,  pack:10, family:"TRANQ_DARTS" },
  { id:"TRANQ_HEAVY",  name:"Heavy Tranq Canisters", grade:"Epic", price:2500, pack:4, family:"TRANQ_DARTS" },
  { id:"9MM_STD",      name:"9mm Standard", grade:"Standard", price:80, pack:25, family:"9MM" },
  { id:"9MM_AP",       name:"9mm Armor Piercing", grade:"Rare", price:400, pack:20, family:"9MM" },
  { id:"12GA_STD",     name:"12ga Buckshot", grade:"Standard", price:120, pack:12, family:"12GA" },
  { id:"12GA_SLUG",    name:"12ga Slugs", grade:"Rare", price:600, pack:10, family:"12GA" },
  { id:"556_STD",      name:"5.56 Standard", grade:"Standard", price:200, pack:30, family:"556" },
  { id:"556_AP",       name:"5.56 AP", grade:"Epic", price:1200, pack:25, family:"556" },
  { id:"762_STD",      name:"7.62 Standard", grade:"Standard", price:260, pack:20, family:"762" },
  { id:"762_AP",       name:"7.62 AP", grade:"Epic", price:1500, pack:15, family:"762" },
  { id:"RAIL_CELL",    name:"Rail Cells", grade:"Mythic", price:5000, pack:6, family:"RAIL" },
];

const MEDS = [
  { id:"M_SMALL",  name:"Small Med Kit",  price:50,  heal:10 },
  { id:"M_MED",    name:"Med Kit",        price:150, heal:25 },
  { id:"M_LARGE",  name:"Large Med Kit",  price:400, heal:50 },
  { id:"M_TRAUMA", name:"Trauma Kit",     price:1000, heal:100 },
];

const ARMORY = [
  { id:"A_TIER1", name:"Armory Tier I",  price:50,  addArmor:10,  cap:100 },
  { id:"A_TIER2", name:"Armory Tier II", price:150, addArmor:25,  cap:100 },
  { id:"A_TIER3", name:"Armory Tier III",price:400, addArmor:50,  cap:100 },
  { id:"A_TIER4", name:"Armory Tier IV", price:1000,addArmor:100, cap:100 },
];

const TOOLS = [
  { id:"T_REPAIR",     name:"Repair Kit",     price:300,  qty:1, add:10  },
  { id:"T_REPAIR_PRO", name:"Pro Repair Kit", price:2500, qty:1, add:100 },
];

const TRAP_ITEM = { id:"TRAP", name:"Trap", price:300, qty:1 };

const AMMO_EFFECTS = {
  "Standard": { dmgMul:1.00, crit:0.04, pen:0.00, tranq:1.00 },
  "Rare":     { dmgMul:1.08, crit:0.07, pen:0.08, tranq:1.08 },
  "Epic":     { dmgMul:1.15, crit:0.10, pen:0.15, tranq:1.15 },
  "Mythic":   { dmgMul:1.30, crit:0.16, pen:0.25, tranq:1.30 },
};

const WEAPON_GRADE = {
  "Common":    { wear:1.4, jamBase:0.05 },
  "Uncommon":  { wear:1.1, jamBase:0.035 },
  "Rare":      { wear:0.8, jamBase:0.02 },
  "Epic":      { wear:0.6, jamBase:0.012 },
  "Legendary": { wear:0.45, jamBase:0.008 },
  "Mythic":    { wear:0.35, jamBase:0.005 },
};

const TIGER_TYPES = [
  { key:"Scout",     hpMul:0.70, spd:3.4, civBias:0.85, stealth:0.00, rage:0.00 },
  { key:"Standard",  hpMul:1.00, spd:2.6, civBias:0.45, stealth:0.00, rage:0.00 },
  { key:"Alpha",     hpMul:1.35, spd:2.4, civBias:0.35, stealth:0.00, rage:0.10 },
  { key:"Berserker", hpMul:1.15, spd:2.7, civBias:0.25, stealth:0.00, rage:0.35 },
  { key:"Stalker",   hpMul:0.95, spd:3.1, civBias:0.55, stealth:0.55, rage:0.00 },
];

const MODE_MAPS = {
  Story: [
    { key:"ST_FOREST", name:"Forest Edge" },
    { key:"ST_SUBURBS", name:"Suburbs" },
    { key:"ST_DOWNTOWN", name:"Downtown" },
    { key:"ST_INDUSTRIAL", name:"Industrial" },
  ],
  Arcade: [
    { key:"AR_ARENA_BAY", name:"Arena Bay" },
    { key:"AR_NEON_GRID", name:"Neon Grid" },
    { key:"AR_SAND_YARD", name:"Sand Yard" },
    { key:"AR_STEEL_PIT", name:"Steel Pit" },
  ],
  Survival: [
    { key:"SV_NIGHT_WOODS", name:"Night Woods" },
    { key:"SV_STORM_DISTRICT", name:"Storm District" },
    { key:"SV_RUINS", name:"Ruins" },
    { key:"SV_ASH_FIELD", name:"Ash Field" },
  ],
};

// ===================== STATE =====================
const DEFAULT = {
  v: 4380,
  paused:false, pauseReason:null,
  mode:"Story", arcadeLevel:1, survivalWave:1, storyLevel:1, mapIndex:0,
  soundOn:true, audioUnlocked:false,

  lives:3, funds:1000, score:0, trust:80, aggro:10, stamina:100,
  hp:100, armor:20, armorCap:100,

  ownedWeapons:["W_TRQ_PISTOL_MK1","W_9MM_JUNK","W_TRQ_RIFLE","W_TRQ_LAUNCHER"],
  equippedWeaponId:"W_TRQ_PISTOL_MK1",
  ammoReserve:{ "TRANQ_DARTS":20, "9MM_STD":40 },
  mag:{ loaded:6, cap:6 },
  durability:{},

  medkits:{ "M_SMALL":1 },
  repairKits:{ "T_REPAIR":1 },
  trapsOwned:2,
  trapsPlaced:[],

  backupCooldown:0, backupActive:0,

  me:{ x:160, y:420, face:0, step:0 },
  target:null,

  tigers:[],
  carcasses:[],
  supportUnits:[],
  rescueSites:[],

  scanPing:0,
  lockedTigerId:null,

  civilians:[],
  evacZone:{ x:880, y:460, r:70 },
  evacDone:0,

  civGraceUntil:0,
  dangerCivId:null,

  inBattle:false,
  activeTigerId:null,

  survivalStart:null,
  surviveSeconds:0,

  missionEnded:false,
  gameOver:false,

  // Phase 1 systems
  fogUntil:0,
  eventText:"",
  eventCooldown:0,
  pickups:[],
  stats:{ shots:0, captures:0, kills:0, evac:0, cashEarned:0 },
  achievements:{},
  title:"Rookie",

// ===== PHASE 2 PROGRESSION =====
xp: 0,
level: 1,
perkPoints: 0,

perks: {
  H_CRIT: 0,
  H_JAM: 0,
  H_DMG: 0,
  G_CIV_GUARD: 0,
  G_ARMOR: 0,
  G_LIVES: 0,
  T_LOOT: 0,
  T_TRAPS: 0,
  T_RELOAD: 0
}
};

let S = load();

function syncWindowState(){
  window.S = S;
}

syncWindowState();

// ---- Tutorial support + global state ----
let lastOverlay = null;

// We'll set these after their functions exist (later), but define placeholders now
window.toast = window.toast || function(){};
window.setPaused = window.setPaused || function(){};

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");
const COMBAT_FX = [];

function load(){
  try{
    const saved = JSON.parse(localStorage.getItem("ts_v4380") || localStorage.getItem("ts_v4371") || "null");
    if(!saved) return structuredClone(DEFAULT);
    const m = { ...DEFAULT, ...saved };
    m.me = { ...DEFAULT.me, ...(saved.me||{}) };
    m.mag = { ...DEFAULT.mag, ...(saved.mag||{}) };
    m.ammoReserve = { ...DEFAULT.ammoReserve, ...(saved.ammoReserve||{}) };
    m.durability = { ...DEFAULT.durability, ...(saved.durability||{}) };
    m.medkits = { ...DEFAULT.medkits, ...(saved.medkits||{}) };
    m.repairKits = { ...DEFAULT.repairKits, ...(saved.repairKits||{}) };
    m.trapsPlaced = Array.isArray(saved.trapsPlaced) ? saved.trapsPlaced : [];
    m.carcasses = Array.isArray(saved.carcasses) ? saved.carcasses : [];
    m.pickups = Array.isArray(saved.pickups) ? saved.pickups : [];
    m.supportUnits = Array.isArray(saved.supportUnits) ? saved.supportUnits : [];
    m.rescueSites = Array.isArray(saved.rescueSites) ? saved.rescueSites : [];
    m.achievements = saved.achievements || {};
    m.stats = { ...DEFAULT.stats, ...(saved.stats||{}) };
    m.perks = { ...DEFAULT.perks, ...(saved.perks||{}) };
    if(m.lives==null) m.lives=3;
    m.v = 4380;
    return m;
  }catch(e){ return structuredClone(DEFAULT); }
}
// ===================== SAVE (THROTTLED — FIXES IOS FREEZE) =====================
let __lastSave = 0;
let __lastHudRender = 0;
let __lastAutosave = 0;

function save(force=false){
  try{
    const now = Date.now();

    if(!force && (now - __lastSave) < 700) return;

    __lastSave = now;

    localStorage.setItem("ts_v4380", JSON.stringify(S));
  }
  catch(e){
    console.log("Save failed:", e);
  }
}

function maybeAutosave(force=false){
  const now = Date.now();
  if(force || (now - __lastAutosave) > 2400){
    __lastAutosave = now;
    save(force);
  }
}

// ===================== AUDIO =====================
let AC=null;
function ensureAudio(){
  if(!S.soundOn) return;
  if(!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if(AC.state==="suspended") AC.resume();
  S.audioUnlocked=true;
}
document.addEventListener("pointerdown", ()=>{ if(!S.audioUnlocked) ensureAudio(); }, {once:true});
function beep(f=440,ms=80,type="sine",vol=0.06){
  if(!S.soundOn) return;
  try{
    ensureAudio();
    const o=AC.createOscillator(), g=AC.createGain();
    o.type=type; o.frequency.value=f; g.gain.value=vol;
    o.connect(g); g.connect(AC.destination);
    o.start(); setTimeout(()=>o.stop(), ms);
  }catch(e){}
}
function sfx(name){
  if(!S.soundOn) return;
  if(name==="ui"){ beep(420,70,"sine",0.05); }
  if(name==="scan"){ beep(520,70,"triangle",0.05); setTimeout(()=>beep(740,70,"triangle",0.05),80); }
  if(name==="hit"){ beep(620,70,"square",0.05); }
  if(name==="tranq"){ beep(520,90,"triangle",0.05); }
  if(name==="hurt"){ beep(220,120,"sawtooth",0.05); }
  if(name==="win"){ beep(660,60,"triangle",0.05); setTimeout(()=>beep(980,80,"triangle",0.05),70); }
  if(name==="reload"){ beep(360,60,"sine",0.05); setTimeout(()=>beep(420,60,"sine",0.05),70); }
  if(name==="jam"){ beep(180,140,"sawtooth",0.06); }
  if(name==="trap"){ beep(300,80,"triangle",0.05); setTimeout(()=>beep(240,110,"triangle",0.04),70); }
  if(name==="loot"){ beep(780,60,"triangle",0.04); }
  if(name==="event"){ beep(520,70,"triangle",0.05); setTimeout(()=>beep(980,90,"triangle",0.05),80); }
}
function toggleSound(){
  S.soundOn=!S.soundOn;
  document.getElementById("soundLbl").innerText = S.soundOn?"On":"Off";
  const mobileLbl = document.getElementById("soundLblMobile");
  if(mobileLbl) mobileLbl.innerText = S.soundOn ? "On" : "Off";
  save(); if(S.soundOn) sfx("ui");
}

// ===================== HELPERS =====================
function toast(msg){
  const t=document.getElementById("toast");
  t.innerText=msg; t.style.display="block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>t.style.display="none",2200);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function rand(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function pointSegmentDistance(px, py, ax, ay, bx, by){
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = (abx * abx) + (aby * aby);
  if(!len2) return dist(px, py, ax, ay);
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / len2, 0, 1);
  const sx = ax + abx * t;
  const sy = ay + aby * t;
  return dist(px, py, sx, sy);
}
function mobileCanvasHeight(){
  const vw = window.innerWidth || 390;
  const vh = window.innerHeight || 844;
  const landscape = vw > vh;
  return landscape
    ? Math.round(clamp(vh * 1.12, 640, 860))
    : Math.round(clamp(vh * 1.45, 980, 1280));
}
function isMobileViewport(){
  const narrow = !!window.matchMedia?.("(max-width:760px)")?.matches;
  const phoneLandscape = !!window.matchMedia?.("(max-width:960px) and (max-height:540px) and (orientation:landscape)")?.matches;
  const coarse = !!window.matchMedia?.("(pointer:coarse)")?.matches;
  return narrow || (coarse && phoneLandscape);
}
function isLandscapeViewport(){
  return (window.innerWidth || 0) > (window.innerHeight || 0);
}
function clampWorldToCanvas(){
  if(!S) return;
  if(S.me){
    S.me.x = clamp(S.me.x, 40, cv.width - 40);
    S.me.y = clamp(S.me.y, 60, cv.height - 40);
  }
  if(S.evacZone){
    S.evacZone.x = clamp(S.evacZone.x, 100, cv.width - 60);
    S.evacZone.y = clamp(S.evacZone.y, 100, cv.height - 60);
  }
  for(const civ of (S.civilians || [])){
    civ.x = clamp(civ.x, 50, cv.width - 50);
    civ.y = clamp(civ.y, 70, cv.height - 50);
  }
  for(const tiger of (S.tigers || [])){
    tiger.x = clamp(tiger.x, 40, cv.width - 40);
    tiger.y = clamp(tiger.y, 60, cv.height - 40);
  }
  for(const pickup of (S.pickups || [])){
    pickup.x = clamp(pickup.x, 40, cv.width - 40);
    pickup.y = clamp(pickup.y, 60, cv.height - 40);
  }
  for(const carcass of (S.carcasses || [])){
    carcass.x = clamp(carcass.x, 40, cv.width - 40);
    carcass.y = clamp(carcass.y, 60, cv.height - 40);
  }
  for(const trap of (S.trapsPlaced || [])){
    trap.x = clamp(trap.x, 40, cv.width - 40);
    trap.y = clamp(trap.y, 60, cv.height - 40);
  }
  for(const ally of (S.supportUnits || [])){
    ally.x = clamp(ally.x, 40, cv.width - 40);
    ally.y = clamp(ally.y, 60, cv.height - 40);
    ally.homeX = clamp(ally.homeX ?? ally.x, 40, cv.width - 40);
    ally.homeY = clamp(ally.homeY ?? ally.y, 60, cv.height - 40);
  }
  for(const site of (S.rescueSites || [])){
    site.x = clamp(site.x, 70, cv.width - 70);
    site.y = clamp(site.y, 90, cv.height - 80);
  }
}
function resizeCanvasForViewport(){
  const mobile = isMobileViewport();
  cv.width = 960;
  cv.height = mobile ? mobileCanvasHeight() : 540;
  clampWorldToCanvas();
}
const STAMINA_COST_SCAN = 8;
const STAMINA_COST_SPRINT = 16;
const STAMINA_DRAIN_WALK = 0.035;
const STAMINA_DRAIN_SPRINT = 0.08;
function pickupLabel(type){
  if(type==="CASH") return "Cash";
  if(type==="AMMO") return "Ammo";
  if(type==="ARMOR") return "Armor";
  if(type==="MED") return "Medkit";
  if(type==="TRAP") return "Trap";
  return "Supply";
}
function isTypingContext(target){
  const el = target || document.activeElement;
  if(!el) return false;
  const tag = el.tagName;
  return el.isContentEditable || tag==="INPUT" || tag==="TEXTAREA" || tag==="SELECT";
}
function tutorialKey(){
  return window.TigerTutorial?.isRunning ? (window.TigerTutorial.currentKey || null) : null;
}
function tutorialAllows(action){
  const key = tutorialKey();
  if(!key) return true;
  const allow = {
    scan:["scan","lock","engage","attack","shop","inventory","done"],
    lock:["lock","engage","attack","shop","inventory","done"],
    engage:["engage","attack","shop","inventory","done"],
    attack:["attack"],
    shop:["shop","inventory","done"],
    inventory:["inventory","done"],
  };
  return !allow[action] || allow[action].includes(key);
}
function tutorialBlockMessage(action){
  if(action==="scan") return "Escort the civilian to the green safe zone first.";
  if(action==="lock") return "Scan first, then tap the tiger to lock it.";
  if(action==="engage") return "Scan and lock the tiger before engaging.";
  if(action==="attack") return "Enter battle through the Engage step first.";
  if(action==="shop") return "Finish the combat basics before opening the shop.";
  if(action==="inventory") return "Open Inventory after the Shop step.";
  return "Follow the tutorial steps in order.";
}

resizeCanvasForViewport();
window.addEventListener("resize", ()=>{
  resizeCanvasForViewport();
  renderHUD();
}, { passive:true });
window.addEventListener("orientationchange", ()=>{
  resizeCanvasForViewport();
  renderHUD();
});
// ================= PHASE 2 XP / PERKS =================

function xpNeededForLevel(lv){
  return 200 + lv * 80;
}

function addXP(amount){
  if(!amount) return;
  S.xp += amount;

  while(S.xp >= xpNeededForLevel(S.level)){
    S.xp -= xpNeededForLevel(S.level);
    S.level++;
    S.perkPoints++;
    toast("Level Up! +1 Perk Point");
  }

  save();
}

function perkRank(k){
  return S.perks?.[k] || 0;
}

function perkCritBonus(){
  return perkRank("H_CRIT") * 0.02;
}

function perkDamageMul(){
  return 1 + perkRank("H_DMG") * 0.05;
}

function perkJamMul(){
  return 1 - perkRank("H_JAM") * 0.15;
}

function perkArmorEff(){
  return 1 + perkRank("G_ARMOR") * 0.05;
}

function perkCivMul(){
  return 1 - perkRank("G_CIV_GUARD") * 0.15;
}

function perkTrapScale(){
  return 1 + perkRank("T_TRAPS") * 0.10;
}

function perkReloadBonus(){
  return perkRank("T_RELOAD") * 0.10;
}

function buyPerk(key){

  const points = Number(S.perkPoints || 0);

  if(points <= 0){
    toast("No perk points.");
    return;
  }

  S.perks[key] = (S.perks[key] || 0) + 1;
  S.perkPoints = points - 1;

  save();
  renderHUD();

  if(document.getElementById("invOverlay").style.display === "flex"){
    renderInventory();
  }
}
function getWeapon(id){ return WEAPONS.find(w=>w.id===id); }
function getAmmo(id){ return AMMO.find(a=>a.id===id); }
function getMed(id){ return MEDS.find(m=>m.id===id); }
function getArmor(id){ return ARMORY.find(a=>a.id===id); }
function getTool(id){ return TOOLS.find(t=>t.id===id); }
function equippedWeapon(){ return getWeapon(S.equippedWeaponId) || WEAPONS[0]; }

function currentMap(){
  const list = MODE_MAPS[S.mode] || MODE_MAPS.Story;
  return list[clamp(S.mapIndex,0,list.length-1)];
}
function nextMap(){
  const list = MODE_MAPS[S.mode] || MODE_MAPS.Story;
  S.mapIndex = (S.mapIndex+1) % list.length;
  S.scanPing=0; sfx("ui"); save();
}

// ===================== COLLISION (carcasses) =====================
function carcassRects(){ return (S.carcasses || []).map(c => ({ x: c.x - 14, y: c.y - 8, w: 28, h: 16 })); }
function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr){
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx*dx + dy*dy) <= cr*cr;
}
function blockedAt(x, y, radius){
  for(const r of carcassRects()){
    if(rectCircleCollide(r.x, r.y, r.w, r.h, x, y, radius)) return true;
  }
  return false;
}
function tryMoveEntity(ent, nx, ny, radius){
  const ox = ent.x, oy = ent.y;
  if(!blockedAt(nx, oy, radius)) ent.x = nx;
  if(!blockedAt(ent.x, ny, radius)) ent.y = ny;
  if(blockedAt(ent.x, ent.y, radius)){ ent.x = ox; ent.y = oy; return false; }
  return true;
}

// ===================== ACHIEVEMENTS / TITLE =====================
function achvCount(){
  return Object.values(S.achievements||{}).filter(Boolean).length;
}
function unlockAchv(key, label){
  if(S.achievements[key]) return;
  S.achievements[key]=true;
  toast(`🏅 Achievement: ${label}`);
  sfx("win");
  hapticNotif("success");
  updateTitle();
  save();
}
function updateTitle(){
  const a = achvCount();
  if(a>=8) S.title="Elite Hunter";
  else if(a>=5) S.title="Guardian";
  else if(a>=3) S.title="Field Agent";
  else if(a>=1) S.title="Rookie+";
  else S.title="Rookie";
}

// ===================== EVENTS (Story+Arcade only) =====================
function eventsEnabled(){
  return (S.mode==="Story" || S.mode==="Arcade");
}
function setEventText(txt, seconds=6){
  S.eventText = txt;
  S.eventTextUntil = Date.now() + seconds*1000;
  save();
}
function tickEvents(){
  if(!eventsEnabled() || S.paused || S.inBattle || S.missionEnded || S.gameOver) return;

  if(S.eventCooldown>0) S.eventCooldown--;
  if(S.eventCooldown>0) return;

  // low chance per tick (60fps) -> we use a counter tick
  S._evtTick = (S._evtTick||0)+1;
  if(S._evtTick < 180) return; // about every 3s check
  S._evtTick = 0;

  const chance = 0.12; // not spammy
  if(Math.random()>chance) return;

  const roll = Math.random();
  if(roll < 0.28){
    // Supply Drop: spawn crate pickup
    spawnPickup("CRATE", rand(280,880), rand(120,500));
    setEventText("📦 Supply Drop spotted!", 7);
    sfx("event"); hapticImpact("medium");
  } else if(roll < 0.52){
    // Rogue Pack: spawn 1 tiger
    spawnRogueTiger();
    setEventText("🚨 Rogue Pack entered the area!", 7);
    sfx("event"); hapticImpact("heavy");
  } else if(roll < 0.78){
    // Fog
    S.fogUntil = Date.now() + rand(6000, 12000);
    setEventText("🌫️ Fog rolled in — visibility reduced.", 8);
    sfx("event");
  } else {
    // Government Bonus: if civilians safe
    const safe = (S.mode==="Survival") ? true : ((S._underAttack||0)===0);
    if(safe){
      const bonus = rand(300, 900);
      S.funds += bonus;
      S.stats.cashEarned += bonus;
      unlockAchv("gov_bonus","Gov Bonus");
      setEventText(`🏛️ Government Bonus: +$${bonus.toLocaleString()}`, 7);
      sfx("win"); hapticNotif("success");
    } else {
      setEventText("🏛️ Bonus denied: civilians under attack!", 6);
      sfx("ui");
    }
  }

  S.eventCooldown = 900; // ~15 seconds cooldown (at 60fps)
  save();
}

// ===================== PICKUPS / LOOT =====================
// Types: CASH, AMMO, ARMOR, MED, TRAP, CRATE
function spawnPickup(type, x, y){
  S.pickups.push({
    id: Date.now()+Math.random(),
    type,
    x, y,
    ttl: 60*20 // ~20 seconds at 60fps
  });
}
function maybeSpawnAmbientPickup(){
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  S._pTick=(S._pTick||0)+1;
  if(S._pTick<120) return; // check ~2 seconds
  S._pTick=0;

  const baseChance = 0.22; // overall
  if(Math.random()>baseChance) return;

  const x = rand(160, 900);
  const y = rand(90, 510);

  // weighted loot
  const r = Math.random();
  if(r<0.28) spawnPickup("CASH", x, y);
  else if(r<0.52) spawnPickup("AMMO", x, y);
  else if(r<0.70) spawnPickup("ARMOR", x, y);
  else if(r<0.88) spawnPickup("MED", x, y);
  else spawnPickup("TRAP", x, y);

  save();
}
function tickPickups(){
  if(!Array.isArray(S.pickups)) S.pickups=[];
  for(const p of S.pickups) p.ttl--;
  S.pickups = S.pickups.filter(p=>p.ttl>0);

  // collect
  for(let i=S.pickups.length-1;i>=0;i--){
    const p=S.pickups[i];
    if(dist(S.me.x,S.me.y,p.x,p.y) < 18){
      collectPickup(p);
      S.pickups.splice(i,1);
    }
  }
}
function collectPickup(p){
  if(p.type==="CASH"){
    const amt = rand(80, 260);
    S.funds += amt;
    S.stats.cashEarned += amt;
    addXP(10);
    unlockAchv("pickup1","First Pickup");
    setEventText(`💵 Picked up cash +$${amt}`, 4);
    sfx("loot"); hapticImpact("light");
  }
  else if(p.type==="AMMO"){
    // add ammo for equipped weapon
    const w=equippedWeapon();
    const pack = (w.ammo==="TRANQ_HEAVY") ? 1 : 6;
    S.ammoReserve[w.ammo] = (S.ammoReserve[w.ammo]||0) + pack;
    setEventText(`📦 Ammo picked up (+${pack} ${w.ammo})`, 4);
    sfx("loot");
    unlockAchv("ammo_pick","Ammo Scavenger");
  }
  else if(p.type==="ARMOR"){
    const add = rand(8, 18);
    if(S.armor < S.armorCap){
      S.armor = clamp(S.armor + add, 0, S.armorCap);
      setEventText(`🛡️ Armor plate +${add}`, 4);
    } else {
      setEventText(`🛡️ Armor plate (already full)`, 3);
    }
    sfx("loot");
    unlockAchv("armor_pick","Armored Up");
  }
  else if(p.type==="MED"){
    S.medkits["M_SMALL"] = (S.medkits["M_SMALL"]||0) + 1;
    setEventText(`❤️ Found Small Med Kit (+1)`, 4);
    sfx("loot");
    unlockAchv("med_pick","Medic");
  }
  else if(p.type==="TRAP"){
    S.trapsOwned += 1;
    setEventText(`🪤 Found Trap (+1)`, 4);
    sfx("loot");
    unlockAchv("trap_pick","Trapper");
  }
  else if(p.type==="CRATE"){
    // supply crate gives 2-3 items
    const items = rand(2,3);
    let msg="📦 Supply Crate: ";
    for(let k=0;k<items;k++){
      const r=Math.random();
      if(r<0.35){ const amt=rand(200,600); S.funds+=amt; S.stats.cashEarned+=amt; msg += `+$${amt} `; }
      else if(r<0.60){ const w=equippedWeapon(); const pack=rand(6,14); S.ammoReserve[w.ammo]=(S.ammoReserve[w.ammo]||0)+pack; msg += `+Ammo(${pack}) `; }
      else if(r<0.80){ const add=rand(12,28); S.armor=clamp(S.armor+add,0,S.armorCap); msg += `+Armor(${add}) `; }
      else { S.medkits["M_SMALL"]=(S.medkits["M_SMALL"]||0)+1; msg += `+Medkit `; }
    }
    setEventText(msg.trim(), 7);
    sfx("win"); hapticNotif("success");
    unlockAchv("crate1","Supply Runner");
  }
  save();
}

// ===================== UI: About / Pause / Mode =====================
function openAbout(){
  setPaused(true,"about");
  document.getElementById("aboutOverlay").style.display="flex";
  document.getElementById("aboutBody").innerHTML = `
    <div class="item"><div><div class="itemName">Tiger Abilities (Phase 1)</div>
      <div class="itemDesc">
        <b>Scout:</b> Dash burst.<br>
        <b>Stalker:</b> Fade/ambush (harder to see).<br>
        <b>Berserker:</b> Rage at low HP (hits harder).<br>
        <b>Alpha:</b> Roar buff nearby tigers.
      </div>
    </div></div>
    <div class="item"><div><div class="itemName">Random Events (Story/Arcade only)</div>
      <div class="itemDesc">Supply Drop • Rogue Pack • Fog • Gov Bonus</div>
    </div></div>
    <div class="item"><div><div class="itemName">Loot Pickups</div>
      <div class="itemDesc">Cash • Ammo • Armor • Medkit • Trap • Supply Crate</div>
    </div></div>
    <div class="divider"></div>
    <div class="hudLine"><b>Traps:</b> one-time hold 3–5s (no damage).</div>
    <div class="hudLine"><b>Ammo in battle:</b> If current gun is empty, switch guns. Attack disables only if ALL guns have no ammo.</div>
  `;
  sfx("ui");
}
function closeAbout(){ document.getElementById("aboutOverlay").style.display="none"; setPaused(false,null); }

function setPaused(on, reason=null){
  S.paused=on; S.pauseReason=reason;
  document.getElementById("pauseLbl").innerText = on?"Resume":"Pause";
  const mobileLbl = document.getElementById("pauseLblMobile");
  if(mobileLbl) mobileLbl.innerText = on ? "Resume" : "Pause";
  save(true);
}
function togglePause(){
  if(S.gameOver) return;
  if(S.inBattle) return toast("Finish battle first.");
  setPaused(!S.paused,"manual"); sfx("ui");
}

function openMode(){
  setPaused(true,"mode");
  document.getElementById("modeOverlay").style.display="flex";
  updateModeDesc(); markModeTabs(); sfx("ui");
}
function closeMode(){ document.getElementById("modeOverlay").style.display="none"; setPaused(false,null); }
function setMode(m){
  S.mode=m; S.lives=3;
  if(m==="Arcade") S.arcadeLevel=1;
  if(m==="Survival"){ S.survivalWave=1; S.survivalStart=Date.now(); S.surviveSeconds=0; }
  if(m==="Story") S.storyLevel=1;
  S.mapIndex=0;
  deploy();
  updateModeDesc(); markModeTabs(); closeMode(); sfx("ui"); save();
}
function markModeTabs(){
  ["mStory","mArcade","mSurvival"].forEach(id=>document.getElementById(id).classList.remove("active"));
  if(S.mode==="Story") document.getElementById("mStory").classList.add("active");
  if(S.mode==="Arcade") document.getElementById("mArcade").classList.add("active");
  if(S.mode==="Survival") document.getElementById("mSurvival").classList.add("active");
}
function updateModeDesc(){
  const el=document.getElementById("modeDesc");
  if(S.mode==="Story") el.innerText="Story: +1 civilian each level (max 7). After 7, +1 tiger per level. Events ON.";
  else if(S.mode==="Arcade") el.innerText="Arcade: civilians on map. Events ON. Each win gets harder.";
  else el.innerText="Survival: no civilians. Tigers pressure-damage you. Events OFF.";
}

// ===================== Shop / Inventory =====================
let currentShopTab="weapons";

function openShop(){
  if(!tutorialAllows("shop")) return toast(tutorialBlockMessage("shop"));
  if(S.inBattle) return toast("Finish battle first.");
  if(S.gameOver) return;
  if(S.missionEnded){ lastOverlay="complete"; document.getElementById("completeOverlay").style.display="none"; }
  setPaused(true,"shop");
  document.getElementById("shopOverlay").style.display="flex";
  shopTab(currentShopTab); sfx("ui");
}
function closeShop(){
  document.getElementById("shopOverlay").style.display="none";
  if(lastOverlay==="complete" && S.missionEnded){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display="flex";
    lastOverlay=null; return;
  }
  setPaused(false,null);
}

function openInventory(){
  if(!tutorialAllows("inventory")) return toast(tutorialBlockMessage("inventory"));
  if(S.inBattle) return toast("Finish battle first.");
  if(S.gameOver) return;
  if(S.missionEnded){ lastOverlay="complete"; document.getElementById("completeOverlay").style.display="none"; }
  setPaused(true,"inv");
  document.getElementById("invOverlay").style.display="flex";
  renderInventory(); sfx("ui");
}
function closeInventory(){
  document.getElementById("invOverlay").style.display="none";
  if(lastOverlay==="complete" && S.missionEnded){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display="flex";
    lastOverlay=null; return;
  }
  setPaused(false,null);
}

function shopTab(tab){
  currentShopTab=tab;
  ["tabWeapons","tabAmmo","tabArmor","tabMeds","tabTools","tabTraps"].forEach(id=>document.getElementById(id).classList.remove("active"));
  if(tab==="weapons") document.getElementById("tabWeapons").classList.add("active");
  if(tab==="ammo") document.getElementById("tabAmmo").classList.add("active");
  if(tab==="armor") document.getElementById("tabArmor").classList.add("active");
  if(tab==="meds") document.getElementById("tabMeds").classList.add("active");
  if(tab==="tools") document.getElementById("tabTools").classList.add("active");
  if(tab==="traps") document.getElementById("tabTraps").classList.add("active");
  renderShopList();
}

function ammoPriceCapped(a){
  if(a.grade!=="Epic") return a.price;
  const std = AMMO.find(x=>x.family===a.family && x.grade==="Standard");
  if(!std) return a.price;
  return Math.min(a.price, std.price + 500);
}
function ownedAmmoCount(ammoId){ return S.ammoReserve[ammoId]||0; }
function ownedMedCount(medId){ return S.medkits[medId]||0; }
function ownedToolCount(toolId){ return S.repairKits[toolId]||0; }

function renderShopList(){
  document.getElementById("shopMoney").innerText = S.funds.toLocaleString();
  const list=document.getElementById("shopList");
  const note=document.getElementById("shopNote");

  if(currentShopTab==="weapons"){
    note.innerText="Weapons show Owned/Not owned. Money updates live.";
    list.innerHTML = WEAPONS.map(w=>{
      const owned = S.ownedWeapons.includes(w.id);
      return `
        <div class="item">
          <div>
            <div class="itemName">${w.name} <span class="tag">${w.grade}</span> <span class="tag">${owned?'Owned':'Not owned'}</span></div>
            <div class="itemDesc">Ammo: ${w.ammo} • Mag: ${w.mag} • Damage: ${w.dmg[0]}–${w.dmg[1]}</div>
          </div>
          <div style="text-align:right">
            <div class="price">$${w.price.toLocaleString()}</div>
            <button ${owned?'disabled':''} onclick="buyWeapon('${w.id}')">${owned?'Owned':'Buy'}</button>
            <button class="ghost" onclick="equipWeapon('${w.id}')" ${owned?'':'disabled'}>Equip</button>
          </div>
        </div>`;
    }).join("");
    return;
  }

  if(currentShopTab==="ammo"){
    note.innerText="Owned shows reserve count. Epic price capped to Standard + $500.";
    list.innerHTML = AMMO.map(a=>{
      const p=ammoPriceCapped(a);
      const owned = ownedAmmoCount(a.id);
      return `
        <div class="item">
          <div>
            <div class="itemName">${a.name} <span class="tag">${a.grade}</span> <span class="tag">Owned: ${owned}</span></div>
            <div class="itemDesc">+${a.pack} reserve • Family: ${a.family}</div>
          </div>
          <div style="text-align:right">
            <div class="price">$${p.toLocaleString()}</div>
            <button onclick="buyAmmo('${a.id}')">Buy</button>
          </div>
        </div>`;
    }).join("");
    return;
  }

  if(currentShopTab==="armor"){
    note.innerText="Cannot buy armor if armor is already full.";
    list.innerHTML = ARMORY.map(ar=>`
      <div class="item">
        <div>
          <div class="itemName">${ar.name}</div>
          <div class="itemDesc">Adds +${ar.addArmor} armor (cap ${ar.cap})</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${ar.price.toLocaleString()}</div>
          <button onclick="buyArmor('${ar.id}')">Buy</button>
        </div>
      </div>`).join("");
    return;
  }

  if(currentShopTab==="meds"){
    note.innerText="Shows how many you own. Heal Self or Civilian in Inventory.";
    list.innerHTML = MEDS.map(m=>{
      const owned=ownedMedCount(m.id);
      return `
        <div class="item">
          <div>
            <div class="itemName">${m.name} <span class="tag">Owned: ${owned}</span></div>
            <div class="itemDesc">Heals +${m.heal} HP</div>
          </div>
          <div style="text-align:right">
            <div class="price">$${m.price.toLocaleString()}</div>
            <button onclick="buyMed('${m.id}')">Buy</button>
          </div>
        </div>`;
    }).join("");
    return;
  }

  if(currentShopTab==="tools"){
    note.innerText="Blocks buying repair kits if current weapon durability is already 100%.";
    list.innerHTML = TOOLS.map(t=>{
      const owned=ownedToolCount(t.id);
      return `
        <div class="item">
          <div>
            <div class="itemName">${t.name} <span class="tag">Owned: ${owned}</span></div>
            <div class="itemDesc">+${t.add} durability</div>
          </div>
          <div style="text-align:right">
            <div class="price">$${t.price.toLocaleString()}</div>
            <button onclick="buyTool('${t.id}')">Buy</button>
          </div>
        </div>`;
    }).join("");
    return;
  }

  note.innerText="Traps are one-time: hold a tiger 3–5s then disappear after hold ends.";
  list.innerHTML = `
    <div class="item">
      <div>
        <div class="itemName">Trap <span class="tag">Owned: ${S.trapsOwned}</span></div>
        <div class="itemDesc">Hold tigers 3–5 seconds inside trap circle.</div>
      </div>
      <div style="text-align:right">
        <div class="price">$${TRAP_ITEM.price.toLocaleString()}</div>
        <button onclick="buyTrap()">Buy</button>
      </div>
    </div>`;
}

function buyWeapon(id){
  const w=getWeapon(id); if(!w) return;
  if(S.ownedWeapons.includes(id)) return toast("Already owned.");
  if(S.funds < w.price) return toast("Not enough money.");
  S.funds -= w.price;
  S.ownedWeapons.push(id);
  if(S.durability[w.id]==null) S.durability[w.id]=100;
  if(!S.ammoReserve[w.ammo]) S.ammoReserve[w.ammo]=0;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyAmmo(id){
  const a=getAmmo(id); if(!a) return;
  const p=ammoPriceCapped(a);
  if(S.funds < p) return toast("Not enough money.");
  S.funds -= p;
  S.ammoReserve[id] = (S.ammoReserve[id]||0) + a.pack;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyArmor(id){
  const ar=getArmor(id); if(!ar) return;
  if(S.armor >= S.armorCap) return toast("Armor already full.");
  if(S.funds < ar.price) return toast("Not enough money.");
  S.funds -= ar.price;
  S.armorCap = ar.cap;
  S.armor = clamp(S.armor + ar.addArmor, 0, S.armorCap);
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyMed(id){
  const m=getMed(id); if(!m) return;
  if(S.funds < m.price) return toast("Not enough money.");
  S.funds -= m.price;
  S.medkits[id] = (S.medkits[id]||0)+1;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyTool(id){
  const w=equippedWeapon();
  if(weaponDurability(w.id) >= 100) return toast("Weapon durability already 100%.");
  const t=getTool(id); if(!t) return;
  if(S.funds < t.price) return toast("Not enough money.");
  S.funds -= t.price;
  S.repairKits[id] = (S.repairKits[id]||0) + t.qty;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyTrap(){
  if(S.funds < TRAP_ITEM.price) return toast("Not enough money.");
  S.funds -= TRAP_ITEM.price;
  S.trapsOwned += TRAP_ITEM.qty;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}

function totalMedkits(){ return Object.values(S.medkits||{}).reduce((a,b)=>a+(b||0),0); }
function totalRepairKits(){ return Object.values(S.repairKits||{}).reduce((a,b)=>a+(b||0),0); }

function setHealTarget(t){ S.healTarget=t; save(); if(document.getElementById("invOverlay").style.display==="flex") renderInventory(); renderHUD(); }
function pickMostInjuredCivilian(){
  const civs = S.civilians.filter(c=>c.alive && !c.evac);
  if(!civs.length) return null;
  let best=civs[0], gap=(best.hpMax-best.hp);
  for(const c of civs){ const g=c.hpMax-c.hp; if(g>gap){gap=g; best=c;} }
  return gap<=0 ? null : best;
}

function renderInventory(){
  const w=equippedWeapon();
  const ammoId=w.ammo;
  document.getElementById("invSummary").innerHTML =
    `<b>Money:</b> $${S.funds.toLocaleString()} • <b>HP:</b> ${Math.round(S.hp)}/100 • <b>Armor:</b> ${Math.round(S.armor)}/${S.armorCap}<br>
     <b>Equipped:</b> ${w.name} • <b>Durability:</b> ${Math.round(weaponDurability(w.id))}% • <b>Ammo:</b> ${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[ammoId]||0})`;

  document.getElementById("invWeapons").innerHTML = S.ownedWeapons.map(id=>{
    const ww=getWeapon(id);
    const active=(id===S.equippedWeaponId);
    const dur=Math.round(weaponDurability(id));
    return `
      <div class="item">
        <div>
          <div class="itemName">${active?'✅ ':''}${ww.name} <span class="tag">${ww.grade}</span></div>
          <div class="itemDesc">Ammo: ${ww.ammo} • Mag: ${ww.mag} • Durability: ${dur}%</div>
        </div>
        <div style="text-align:right">
          <button ${active?'disabled':''} onclick="equipWeapon('${id}')">Equip</button>
        </div>
      </div>`;
  }).join("");

  const ammoKeys = Object.keys(S.ammoReserve).sort();
  document.getElementById("invAmmo").innerHTML = ammoKeys.map(aid=>{
    const a=getAmmo(aid);
    return `
      <div class="item">
        <div>
          <div class="itemName">${a?a.name:aid} <span class="tag">${a?a.grade:'Ammo'}</span></div>
          <div class="itemDesc">Reserve: ${S.ammoReserve[aid]||0}</div>
        </div>
        <div style="text-align:right">
          <button class="ghost" onclick="openShop(); shopTab('ammo')">Buy</button>
        </div>
      </div>`;
  }).join("");

  const civs = (S.mode==="Survival") ? [] : S.civilians.filter(c=>c.alive);
  document.getElementById("invSupplies").innerHTML = `
    <div class="item">
      <div>
        <div class="itemName">❤️ Med Kits <span class="tag">Owned: ${totalMedkits()}</span></div>
        <div class="itemDesc">Heal target: <b>${S.healTarget||'self'}</b></div>
      </div>
      <div style="text-align:right">
        <button onclick="setHealTarget('self')">Self</button>
        <button ${civs.length?'':'disabled'} onclick="setHealTarget('civ')">Civilian</button>
        <button class="good" ${totalMedkits()<=0?'disabled':''} onclick="useMedkit()">Use</button>
      </div>
    </div>
    <div class="item">
      <div>
        <div class="itemName">🧰 Repair Kits <span class="tag">Owned: ${totalRepairKits()}</span></div>
        <div class="itemDesc">Repairs current weapon durability</div>
      </div>
      <div style="text-align:right">
        <button ${totalRepairKits()<=0?'disabled':''} onclick="useRepairKit()">Use</button>
      </div>
    </div>
    <div class="item">
      <div>
        <div class="itemName">🪤 Traps <span class="tag">Owned: ${S.trapsOwned}</span></div>
        <div class="itemDesc">One-time hold 3–5s.</div>
      </div>
      <div style="text-align:right">
        <button ${S.trapsOwned<=0?'disabled':''} onclick="placeTrap()">Place</button>
      </div>
    </div> 
   <div class="divider"></div>
<div>
  <b>Level:</b> ${S.level} |
  <b>XP:</b> ${S.xp}/${xpNeededForLevel(S.level)} |
  <b>Perk Points:</b> ${S.perkPoints}
</div>

<div style="margin-top:8px;">
  <div class="divider"></div>
<div>
  <b>Level:</b> ${S.level} |
  <b>XP:</b> ${S.xp}/${xpNeededForLevel(S.level)} |
  <b>Perk Points:</b> ${S.perkPoints}
</div>

<div style="margin-top:10px; font-size:13px; line-height:1.5;">

  <div>
    <b>Deadeye</b> (Rank ${perkRank("H_CRIT")})
    +${(perkRank("H_CRIT")*5).toFixed(0)}% Crit Chance
    <br>
    <button onclick="buyPerk('H_CRIT')">Upgrade</button>
  </div>

  <div>
    <b>Damage Boost</b> (Rank ${perkRank("H_DMG")})
    +${(perkRank("H_DMG")*8).toFixed(0)}% Weapon Damage
    <br>
    <button onclick="buyPerk('H_DMG')">Upgrade</button>
  </div>

  <div>
    <b>Anti-Jam</b> (Rank ${perkRank("H_JAM")})
    -${(perkRank("H_JAM")*10).toFixed(0)}% Jam Chance
    <br>
    <button onclick="buyPerk('H_JAM')">Upgrade</button>
  </div>

  <div>
    <b>Civilian Guard</b> (Rank ${perkRank("G_CIV_GUARD")})
    -${(perkRank("G_CIV_GUARD")*15).toFixed(0)}% Civilian Damage Taken
    <br>
    <button onclick="buyPerk('G_CIV_GUARD')">Upgrade</button>
  </div>

  <div>
    <b>Armor Efficiency</b> (Rank ${perkRank("G_ARMOR")})
    +${(perkRank("G_ARMOR")*5).toFixed(0)}% Armor Effectiveness
    <br>
    <button onclick="buyPerk('G_ARMOR')">Upgrade</button>
  </div>

  <div>
    <b>Trap Expansion</b> (Rank ${perkRank("T_TRAPS")})
    +${(perkRank("T_TRAPS")*10).toFixed(0)}% Trap Radius
    <br>
    <button onclick="buyPerk('T_TRAPS')">Upgrade</button>
  </div>

  <div>
    <b>Reload Boost</b> (Rank ${perkRank("T_RELOAD")})
    +${(perkRank("T_RELOAD")*10).toFixed(0)}% Reload Efficiency
    <br>
    <button onclick="buyPerk('T_RELOAD')">Upgrade</button>
  </div>

</div>
`;
}

function useMedkit(){
  if(totalMedkits()<=0) return toast("No medkits. Buy in shop.");
  const order=["M_TRAUMA","M_LARGE","M_MED","M_SMALL"];
  const pick = order.find(k => (S.medkits[k]||0)>0);
  if(!pick) return;
  const m=getMed(pick);

  if(S.healTarget==="civ" && S.mode!=="Survival"){
    const civ=pickMostInjuredCivilian();
    if(!civ) return toast("No injured civilians to heal.");
    S.medkits[pick]-=1;
    civ.hp = clamp(civ.hp + m.heal, 0, civ.hpMax);
    sfx("ui"); hapticImpact("light"); save(); renderHUD();
    if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
    return toast(`Healed civilian +${m.heal}`);
  }

  if(S.hp>=100) return toast("HP already full.");
  S.medkits[pick]-=1;
  S.hp = clamp(S.hp + m.heal, 0, 100);
  sfx("ui"); hapticImpact("light"); save(); renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(`Healed +${m.heal}`);
}

function useRepairKit(){
  const w=equippedWeapon();
  const pick = (S.repairKits["T_REPAIR_PRO"]||0)>0 ? "T_REPAIR_PRO" : ((S.repairKits["T_REPAIR"]||0)>0 ? "T_REPAIR" : null);
  if(!pick) return toast("No repair kits.");
  const t=getTool(pick);
  S.repairKits[pick]-=1;
  S.durability[w.id] = clamp((S.durability[w.id]??100) + t.add, 0, 100);
  sfx("ui"); hapticImpact("light"); save(); renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(`Repaired +${t.add} durability`);
}

// ===================== BACKUP =====================
function callBackup(){
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return toast("Not now.");
  if(S.funds < 50000) return toast("Need $50,000 for backup.");
  if(S.backupCooldown>0) return toast("Backup cooling down.");
  S.funds -= 50000;
  S.backupActive = 600;
  S.backupCooldown = 1800;
  toast("🚨 Backup deployed! Tigers frozen. Civilians protected.");
  sfx("ui"); hapticNotif("success");
  save();
  renderHUD();
}
function backupTick(){
  if(S.backupActive>0) S.backupActive--;
  if(S.backupCooldown>0) S.backupCooldown--;
}

// ===================== TRAPS (one-time) =====================
function placeTrap(){
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return toast("Not now.");
  if(S.trapsOwned<=0) return toast("No traps. Buy in shop.");
  S.trapsOwned -= 1;

  S.trapsPlaced.push({
    id: Date.now() + Math.random(),
    x: S.me.x,
    y: S.me.y,
    r: 80 * perkTrapScale(),
    ttl: 1800,
    used: false,
    removeAt: 0
  });

  toast("🪤 Trap placed (one-time).");
  sfx("trap"); hapticImpact("light");
  save(); renderHUD();
}

function trapTick(){
  for (const tr of S.trapsPlaced) tr.ttl -= 1;
  const now = Date.now();

  for (const t of S.tigers){
    if(!t.alive) continue;
    if(t.holdUntil && now < t.holdUntil){
      t.vx = 0; t.vy = 0;
      t._held = true;
    } else {
      t._held = false;
    }
  }

  for (const tr of S.trapsPlaced){
    if(tr.used) continue;
    const tgt = S.tigers.find(x =>
      x.alive &&
      dist(x.x, x.y, tr.x, tr.y) < tr.r &&
      !(x.holdUntil && now < x.holdUntil)
    );
    if(!tgt) continue;

    const holdMs = rand(3000, 5000);
    tgt.holdUntil = now + holdMs;
    tgt.vx = 0; tgt.vy = 0;
    tgt._held = true;

    tr.used = true;
    tr.removeAt = tgt.holdUntil;

    toast("🪤 Tiger trapped!");
    sfx("trap"); hapticImpact("medium");
    tgt.aggroBoost = clamp((tgt.aggroBoost||0) + 0.05, 0, 1);
    break;
  }

  S.trapsPlaced = S.trapsPlaced.filter(tr =>
    tr.ttl > 0 && (!tr.used || (tr.removeAt && now < tr.removeAt))
  );
}

// ===================== DURABILITY / RELOAD =====================
function ammoEffectFor(ammoId){
  const a=getAmmo(ammoId);
  const grade=a?.grade||"Standard";
  return AMMO_EFFECTS[grade] || AMMO_EFFECTS.Standard;
}
function weaponDurability(id){ if(S.durability[id]==null) S.durability[id]=100; return S.durability[id]; }
function applyWearOnShot(w){
  const g=WEAPON_GRADE[w.grade]||WEAPON_GRADE.Common;
  const wear = g.wear * (w.type==="lethal"?1.0:0.9);
  S.durability[w.id] = clamp((S.durability[w.id]??100)-wear,0,100);
}
function jamChance(w){
  const g=WEAPON_GRADE[w.grade]||WEAPON_GRADE.Common;
  const dur=weaponDurability(w.id);
  const wearFactor = dur>=60?0.0:(60-dur)/60;
  return clamp((g.jamBase + wearFactor*0.18) * perkJamMul(), 0, 0.28);
}
function autoReloadIfNeeded(force=false){
  const w=equippedWeapon();
  if(!force && S.mag.loaded>0) return true;
  const reserve = S.ammoReserve[w.ammo] || 0;
  if(reserve<=0) return false;
  const need = S.mag.cap - S.mag.loaded;
  const take = Math.min(need, reserve);
  const bonus = Math.min(need - take, Math.floor(take * perkReloadBonus()));
  S.mag.loaded += take + bonus;
  S.ammoReserve[w.ammo] = reserve - take;
  sfx("reload"); hapticImpact("light");
  return true;
}
function equipWeapon(id){
  if(!S.ownedWeapons.includes(id)) return;
  const w=getWeapon(id); if(!w) return;
  S.equippedWeaponId=id;
  S.mag.cap=w.mag;
  S.mag.loaded=clamp(S.mag.loaded,0,S.mag.cap);
  if(S.mag.loaded===0) autoReloadIfNeeded(true);
  sfx("ui"); hapticImpact("light");
  save();
  renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  if(document.getElementById("shopOverlay").style.display==="flex") renderShopList();
  if(document.getElementById("battleOverlay").style.display==="flex") { renderWeaponGrid(); updateBattleButtons(); updateAttackButton(); renderBattleStatus(); }
  renderCombatControls();
}

function cycleWeapon(dir=1){
  if(!S.ownedWeapons?.length) return;
  const idx = Math.max(0, S.ownedWeapons.indexOf(S.equippedWeaponId));
  const nextIdx = (idx + dir + S.ownedWeapons.length) % S.ownedWeapons.length;
  equipWeapon(S.ownedWeapons[nextIdx]);
}

// ===================== SPAWNS =====================

// --------------------------------------------------
// TUTORIAL MODE FLAG
// --------------------------------------------------
window.__TUTORIAL_MODE__ = false;

window.enterTutorialMode = function () {
  window.__TUTORIAL_MODE__ = true;
  S._tutorialPrev = {
    mode:S.mode,
    mapIndex:S.mapIndex,
    storyLevel:S.storyLevel,
    arcadeLevel:S.arcadeLevel,
    survivalWave:S.survivalWave,
    survivalStart:S.survivalStart,
  };

  S.mode = "Story";
  S.mapIndex = 0;
  S.storyLevel = 1;
  S.survivalStart = null;
  S.surviveSeconds = 0;
  S.scanPing = 0;
  S.lockedTigerId = null;
  S.target = null;
  S.pickups = [];
  S.eventText = "";
  S.fogUntil = 0;
  S.inBattle = false;
  S.activeTigerId = null;
  S.me = { x:230, y:330, face:0, step:0 };
  S.evacZone = { x:160, y:140, r:70 };

  // reset battlefield
  S.tigers = [];
  S.civilians = [];

  spawnCivilians();
  spawnTigers();

  const tiger = S.tigers[0];
  if(tiger){
    tiger.x = 760;
    tiger.y = 160;
    tiger.vx = 0;
    tiger.vy = 0;
    tiger.holdUntil = Date.now() + 86400000;
  }
};

window.exitTutorialMode = function () {
  window.__TUTORIAL_MODE__ = false;
  const prev = S._tutorialPrev || null;
  delete S._tutorialPrev;

  ["battleOverlay","shopOverlay","invOverlay","completeOverlay","overOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });

  if(prev){
    S.mode = prev.mode;
    S.mapIndex = prev.mapIndex;
    S.storyLevel = prev.storyLevel;
    S.arcadeLevel = prev.arcadeLevel;
    S.survivalWave = prev.survivalWave;
    S.survivalStart = prev.survivalStart;
  }

  deploy();
};


// --------------------------------------------------

function carcassDifficulty(){ return clamp(1 + (S.carcasses.length*0.05), 1, 3.5); }
function randomEvacZone(){
  return {
    x: rand(140, cv.width - 80),
    y: rand(130, cv.height - 80),
    r:70
  };
}

const SKIN_TONES = ["#f6d7c3","#eac0a6","#d9a07f","#c9865c","#a86a44","#7a4a2c","#4b2f1f"];
const SHIRT_COLS = ["#4aa3ff","#3ddc97","#f59e0b","#fb7185","#a78bfa","#f97316","#eab308","#22c55e","#60a5fa"];
const PANTS_COLS = ["#1f2937","#334155","#0f172a","#3f3f46","#1c1917","#111827"];
const SUPPORT_CALLSIGNS = ["Ranger","Guardian","Trailwatch","Sentinel","Echo","Sierra"];

function currentMapKey(){
  return currentMap().key;
}

function rescueSitePool(){
  const h = cv.height;
  const pools = {
    ST_FOREST: [
      { kind:"trail", label:"Trail Gate", x:140, y:h*0.18, r:42 },
      { kind:"cabin", label:"Ranger Cabin", x:330, y:h*0.45, r:46 },
      { kind:"truck", label:"Camp Truck", x:720, y:h*0.22, r:48 },
      { kind:"park", label:"Creek Park", x:620, y:h*0.68, r:54 },
      { kind:"trail", label:"Lookout Trail", x:840, y:h*0.58, r:42 },
      { kind:"house", label:"Forest House", x:220, y:h*0.78, r:48 },
    ],
    AR_SAND_YARD: [
      { kind:"truck", label:"Yard Truck", x:170, y:h*0.20, r:48 },
      { kind:"trail", label:"Fence Run", x:420, y:h*0.34, r:40 },
      { kind:"building", label:"Control Shack", x:760, y:h*0.24, r:48 },
      { kind:"park", label:"Supply Yard", x:620, y:h*0.68, r:54 },
      { kind:"truck", label:"Loader Bay", x:860, y:h*0.78, r:48 },
    ],
    SV_NIGHT_WOODS: [
      { kind:"trail", label:"Night Trail", x:160, y:h*0.18, r:42 },
      { kind:"cabin", label:"Watch Cabin", x:360, y:h*0.44, r:46 },
      { kind:"park", label:"Flooded Park", x:700, y:h*0.26, r:54 },
      { kind:"truck", label:"Rescue Truck", x:820, y:h*0.68, r:48 },
      { kind:"house", label:"Edge House", x:240, y:h*0.80, r:48 },
    ],
    ST_SUBURBS: [
      { kind:"house", label:"Maple House", x:150, y:h*0.22, r:48 },
      { kind:"car", label:"Street Car", x:390, y:h*0.52, r:42 },
      { kind:"park", label:"Play Park", x:720, y:h*0.36, r:54 },
      { kind:"truck", label:"Moving Truck", x:860, y:h*0.62, r:48 },
      { kind:"house", label:"Corner Home", x:250, y:h*0.76, r:48 },
      { kind:"car", label:"School Dropoff", x:620, y:h*0.78, r:42 },
    ],
    AR_ARENA_BAY: [
      { kind:"car", label:"Pit Car", x:170, y:h*0.22, r:42 },
      { kind:"truck", label:"Supply Van", x:430, y:h*0.34, r:48 },
      { kind:"park", label:"Staging Park", x:760, y:h*0.32, r:54 },
      { kind:"building", label:"Bay Office", x:830, y:h*0.66, r:48 },
      { kind:"trail", label:"Catwalk", x:250, y:h*0.74, r:40 },
    ],
    SV_ASH_FIELD: [
      { kind:"truck", label:"Ash Truck", x:170, y:h*0.18, r:48 },
      { kind:"park", label:"Field Camp", x:420, y:h*0.48, r:54 },
      { kind:"building", label:"Relay Hut", x:780, y:h*0.30, r:48 },
      { kind:"trail", label:"Burn Line", x:860, y:h*0.72, r:40 },
      { kind:"car", label:"Responder Car", x:260, y:h*0.80, r:42 },
    ],
    ST_DOWNTOWN: [
      { kind:"building", label:"Office Tower", x:180, y:h*0.20, r:52 },
      { kind:"car", label:"Taxi Lane", x:430, y:h*0.49, r:42 },
      { kind:"park", label:"City Plaza", x:720, y:h*0.34, r:54 },
      { kind:"building", label:"Mall Entry", x:860, y:h*0.60, r:52 },
      { kind:"truck", label:"Service Truck", x:280, y:h*0.76, r:48 },
      { kind:"building", label:"Parking Deck", x:640, y:h*0.78, r:52 },
    ],
    AR_NEON_GRID: [
      { kind:"building", label:"Neon Hub", x:170, y:h*0.24, r:52 },
      { kind:"car", label:"Grid Cab", x:420, y:h*0.48, r:42 },
      { kind:"park", label:"Sky Court", x:770, y:h*0.34, r:54 },
      { kind:"building", label:"Arcade Block", x:830, y:h*0.68, r:52 },
      { kind:"trail", label:"Light Run", x:260, y:h*0.76, r:40 },
    ],
    SV_STORM_DISTRICT: [
      { kind:"building", label:"Shelter Block", x:180, y:h*0.20, r:52 },
      { kind:"truck", label:"Storm Truck", x:430, y:h*0.50, r:48 },
      { kind:"park", label:"Flood Plaza", x:740, y:h*0.34, r:54 },
      { kind:"building", label:"Metro Entry", x:860, y:h*0.66, r:52 },
      { kind:"car", label:"Signal Car", x:270, y:h*0.78, r:42 },
    ],
    ST_INDUSTRIAL: [
      { kind:"building", label:"Warehouse A", x:170, y:h*0.22, r:52 },
      { kind:"truck", label:"Loading Truck", x:430, y:h*0.46, r:48 },
      { kind:"building", label:"Plant Office", x:770, y:h*0.24, r:52 },
      { kind:"park", label:"Scrap Yard", x:700, y:h*0.68, r:54 },
      { kind:"truck", label:"Fuel Rig", x:860, y:h*0.78, r:48 },
      { kind:"car", label:"Gate Sedan", x:260, y:h*0.76, r:42 },
    ],
    AR_STEEL_PIT: [
      { kind:"building", label:"Steel Office", x:170, y:h*0.24, r:52 },
      { kind:"truck", label:"Crane Truck", x:420, y:h*0.48, r:48 },
      { kind:"park", label:"Pit Yard", x:730, y:h*0.32, r:54 },
      { kind:"building", label:"Smelter Gate", x:860, y:h*0.68, r:52 },
      { kind:"trail", label:"Pipe Run", x:260, y:h*0.78, r:40 },
    ],
    SV_RUINS: [
      { kind:"building", label:"Ruined Hall", x:180, y:h*0.22, r:52 },
      { kind:"car", label:"Abandoned Car", x:420, y:h*0.50, r:42 },
      { kind:"park", label:"Overgrown Court", x:750, y:h*0.34, r:54 },
      { kind:"building", label:"Broken Tower", x:860, y:h*0.68, r:52 },
      { kind:"trail", label:"Rubble Trail", x:270, y:h*0.80, r:40 },
    ],
  };
  const pool = pools[currentMapKey()] || pools.ST_FOREST;
  return pool.map((site, idx) => ({
    id: idx + 1,
    kind: site.kind,
    label: site.label,
    x: clamp(Math.round(site.x), 70, cv.width - 70),
    y: clamp(Math.round(site.y), 90, cv.height - 80),
    r: site.r
  }));
}

function spawnRescueSites(){
  if(window.__TUTORIAL_MODE__){
    S.rescueSites = [{
      id: 1,
      kind: "trail",
      label: "Evac Route",
      x: 300,
      y: 260,
      r: 40
    }];
    return;
  }

  const basePool = rescueSitePool();
  const wanted = (S.mode==="Story")
    ? clamp(4 + Math.floor((S.storyLevel - 1) / 2), 4, 6)
    : (S.mode==="Arcade")
      ? clamp(4 + Math.floor((S.arcadeLevel - 1) / 2), 4, 6)
      : 5;

  S.rescueSites = basePool
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(wanted, basePool.length))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

function spawnSupportUnits(){
  S.supportUnits = [];
}


// ===================== CIVILIANS =====================
function spawnCivilians(){

  // ✅ TUTORIAL SPAWN (FORCED)
  if(window.__TUTORIAL_MODE__){
    S.civilians = [{
      id:1,
      x:300,
      y:260,
      hp:100,
      hpMax:100,
      alive:true,
      evac:false,
      skin:SKIN_TONES[2],
      shirt:"#22c55e",
      pants:"#1f2937",
      hair:1
    }];
    S.evacDone = 0;
    return;
  }

  const n = (S.mode==="Story")
    ? clamp(3 + (S.storyLevel-1), 3, 7)
    : (S.mode==="Arcade"
      ? clamp(2 + (S.arcadeLevel-1), 2, 7)
      : 0);
  const sites = (S.rescueSites?.length ? S.rescueSites : rescueSitePool()).slice();

  S.civilians = [];

  for(let i=0;i<n;i++){
    const site = sites[i % sites.length] || { x: rand(160, cv.width - 160), y: rand(140, cv.height - 120), kind:"trail", label:"Field Site" };
    const orbit = 16 + ((i % 3) * 14);
    const angle = (Math.PI * 2 * (i % Math.max(1, sites.length))) / Math.max(1, sites.length);
    const jitterX = Math.round(Math.cos(angle) * orbit + rand(-10, 10));
    const jitterY = Math.round(Math.sin(angle) * orbit + rand(-10, 10));
    S.civilians.push({
      id:i+1,
      x:clamp(site.x + jitterX, 60, cv.width - 60),
      y:clamp(site.y + jitterY, 90, cv.height - 70),
      hp:100,
      hpMax:100,
      alive:true,
      evac:false,
      siteId:site.id,
      rescueKind:site.kind,
      rescueLabel:site.label,
      skin:SKIN_TONES[rand(0,SKIN_TONES.length-1)],
      shirt:SHIRT_COLS[rand(0,SHIRT_COLS.length-1)],
      pants:PANTS_COLS[rand(0,PANTS_COLS.length-1)],
      hair:rand(0,3)
    });
  }

  S.evacDone=0;
}


// ===================== TIGER TYPE =====================
function pickTigerType(){
  const r=Math.random();

  if(S.mode==="Survival"){
    if(r<0.22) return "Scout";
    if(r<0.48) return "Stalker";
    if(r<0.72) return "Berserker";
    if(r<0.90) return "Standard";
    return "Alpha";
  }

  if(r<0.22) return "Scout";
  if(r<0.55) return "Standard";
  if(r<0.72) return "Stalker";
  if(r<0.90) return "Berserker";
  return "Alpha";
}


// ===================== TIGERS =====================
function spawnTigers(){

  // ✅ TUTORIAL TIGER (FORCED)
  if(window.__TUTORIAL_MODE__){
    const def = TIGER_TYPES.find(t=>t.key==="Standard") || TIGER_TYPES[1];

    S.tigers = [{
      id:1,
      type:def.key,
      x:650,
      y:260,
      vx:0,
      vy:0,
      hp:120,
      hpMax:120,
      alive:true,
      aggroBoost:0,
      civBias:0.3,
      stealth:false,
      rage:false,
      bossPhases:0,
      tranqTagged:false,
      step:0,
      holdUntil:0,
      dashUntil:0,
      fadeUntil:0,
      roarUntil:0,
      rageOn:false
    }];

    return;
  }

  let count=2;

  if(S.mode==="Story"){
    const afterMax=Math.max(0,(S.storyLevel-1)-(7-3));
    count=2+afterMax;
  }

  if(S.mode==="Arcade"){
    const afterMax=Math.max(0,(S.arcadeLevel-1)-(7-2));
    count=3+afterMax;
  }

  if(S.mode==="Survival")
    count=Math.min(4+(S.survivalWave-1),10);

  const boss=(S.mode==="Story"&&(S.storyLevel%5===0));
  const packCount = clamp(Math.ceil(count / 2), 1, 4);
  const sitePool = (S.rescueSites?.length ? S.rescueSites : rescueSitePool()).slice().reverse();
  const fallbackPacks = [
    { x: cv.width * 0.68, y: cv.height * 0.22 },
    { x: cv.width * 0.78, y: cv.height * 0.48 },
    { x: cv.width * 0.64, y: cv.height * 0.76 },
    { x: cv.width * 0.84, y: cv.height * 0.64 },
  ];
  const packAnchors = Array.from({ length: packCount }, (_, idx) => {
    const site = sitePool[idx];
    const anchor = site
      ? { x: clamp(site.x + rand(90, 180), 160, cv.width - 70), y: clamp(site.y + rand(-110, 110), 100, cv.height - 70) }
      : fallbackPacks[idx % fallbackPacks.length];
    return {
      id: idx + 1,
      x: Math.round(anchor.x),
      y: Math.round(anchor.y)
    };
  });

  S.tigers=[];
  const diff=carcassDifficulty();

  for(let i=0;i<count;i++){
    let typeKey=pickTigerType();
    if(boss && i===0) typeKey="Alpha";

    const def=TIGER_TYPES.find(t=>t.key===typeKey)||TIGER_TYPES[1];

    let baseHp=115;
    if(S.mode==="Arcade") baseHp=125+(S.arcadeLevel-1)*8;
    if(S.mode==="Survival") baseHp=140+(S.survivalWave-1)*12;
    if(S.mode==="Story") baseHp=118+(S.storyLevel-1)*4;

    let hp=Math.round(baseHp*def.hpMul*diff);
    let bossPhases=0;

    if(boss && i===0){
      hp=Math.round(hp*2.2);
      bossPhases=2;
    }

    const pack = packAnchors[i % packAnchors.length];
    const theta = (Math.PI * 2 * (i % 3)) / 3;
    const radius = 24 + ((i % 2) * 20);

    S.tigers.push({
      id:i+1,
      type:def.key,
      x:clamp(Math.round(pack.x + Math.cos(theta) * radius + rand(-12,12)), 140, cv.width - 50),
      y:clamp(Math.round(pack.y + Math.sin(theta) * radius + rand(-12,12)), 90, cv.height - 70),
      vx:(Math.random()<0.5?-1:1)*def.spd*0.55,
      vy:(Math.random()<0.5?-1:1)*def.spd*0.50,
      hp,
      hpMax:hp,
      alive:true,
      packId:pack.id,
      aggroBoost:0,
      civBias:clamp(def.civBias+(diff-1)*0.18,0,0.98),
      stealth:def.stealth,
      rage:def.rage,
      bossPhases,
      tranqTagged:false,
      step:rand(0,1000),
      holdUntil:0,
      dashUntil:0,
      fadeUntil:0,
      roarUntil:0,
      rageOn:false
    });
  }
}
// ===================== DEPLOY / NEXT / RESTART =====================
function deploy(){
  resizeCanvasForViewport();
  S.gameOver=false;
  S.missionEnded=false;
  S.inBattle=false;
  S.activeTigerId=null;
  S.paused=false; S.pauseReason=null;

  S.hp=100; S.armor=20; S.stamina=100;
  S.me={x:160,y:clamp(cv.height - 120, 240, 420),face:0,step:0};
  S.target=null;
  S.lockedTigerId=null;

  S.civGraceUntil = Date.now() + 1000;
  S.dangerCivId = null;

  if(S.mode!=="Survival") S.evacZone = randomEvacZone();
  S.backupActive=0;

  // phase 1
  S.fogUntil = 0;
  S.eventText = "";
  S.eventCooldown = 240;
  S.pickups = [];
  S.supportUnits = [];
  S.rescueSites = [];
  S.stats.shots = 0;
  S.stats.captures = 0;
  S.stats.kills = 0;
  S.stats.evac = 0;
  S.stats.cashEarned = 0;

  spawnRescueSites();
  spawnSupportUnits();
  spawnTigers();
  spawnCivilians();

  // spawn a couple guaranteed pickups early
  spawnPickup("CASH", 260, clamp(cv.height - 150, 220, cv.height - 80));
  spawnPickup("AMMO", 320, clamp(cv.height - 120, 240, cv.height - 70));

  for(const wid of S.ownedWeapons){ if(S.durability[wid]==null) S.durability[wid]=100; }

  const w=equippedWeapon();
  S.mag.cap = w.mag;
  S.mag.loaded = clamp(S.mag.loaded || w.mag, 0, S.mag.cap);
  if(S.mag.loaded===0) autoReloadIfNeeded(true);

  if(S.mode==="Survival"){ S.survivalStart = Date.now(); S.surviveSeconds=0; }

  save();
}

function startNextMission(){
  document.getElementById("completeOverlay").style.display="none";
  if(S.mode==="Story") S.storyLevel += 1;
  if(S.mode==="Arcade") S.arcadeLevel += 1;
  if(S.mode==="Survival") S.survivalWave += 1;
  deploy();
  toast("Next mission started.");
  save();
}

function restartCurrentMission(){
  document.getElementById("battleOverlay").style.display="none";
  document.getElementById("completeOverlay").style.display="none";
  document.getElementById("overOverlay").style.display="none";
  lastOverlay=null;

  S.gameOver=false;
  deploy();
  toast("Restarted this mission.");
  save();
}

function closeComplete(){ document.getElementById("completeOverlay").style.display="none"; }

function resetGame(){
  localStorage.removeItem("ts_v4380");
  localStorage.removeItem("ts_v4371");
  S = structuredClone(DEFAULT);
  syncWindowState();
  document.getElementById("shopOverlay").style.display="none";
  document.getElementById("invOverlay").style.display="none";
  document.getElementById("aboutOverlay").style.display="none";
  document.getElementById("completeOverlay").style.display="none";
  document.getElementById("overOverlay").style.display="none";
  document.getElementById("modeOverlay").style.display="none";
  lastOverlay = null;
  deploy();
  save(true);
  toast("Reset ✅");
}

// ===================== GAME OVER =====================
function gameOverChoice(msg){
  S.gameOver = true;
  S.paused = true;
  document.getElementById("battleOverlay").style.display="none";
  document.getElementById("completeOverlay").style.display="none";
  lastOverlay=null;

  document.getElementById("overText").innerText = msg + "\n\nChoose:";
  document.getElementById("overOverlay").style.display="flex";
  sfx("hurt"); hapticNotif("error");
  save();
}

// ===================== INPUT =====================
cv.addEventListener("pointerdown",(e)=>{
  if(e.pointerType==="mouse" && e.button!==0) return;
  e.preventDefault();

  const rect=cv.getBoundingClientRect();
  const x=(e.clientX-rect.left)*(cv.width/rect.width);
  const y=(e.clientY-rect.top)*(cv.height/rect.height);
  const tapped = S.tigers.find(t=>t.alive && dist(x,y,t.x,t.y) < 34);

  // --- Tutorial: capture map click so tutorial can advance ---
  if (window.TigerTutorial?.isRunning) {
    window.TigerTutorial.mapClicked = true;
  }

  // Stop normal gameplay while tutorial controls flow
  if (window.TigerTutorial?.isRunning){
    ensureAudio();
    if(tapped && tutorialAllows("lock")){
      S.lockedTigerId=tapped.id;
      window.TigerTutorial.lastLockedTigerId = tapped.id;
      sfx("ui");
      hapticImpact("light");
      save();
      return;
    }

    S.target={x,y};

    sfx("ui");
    hapticImpact("light");
    save();
    return;
  }

  // --- NORMAL GAMEPLAY ---
  if(S.gameOver || S.missionEnded) return;
  if(S.paused) return;

  ensureAudio();

  if(tapped && !S.inBattle){
    S.lockedTigerId=tapped.id;
    sfx("ui");
    hapticImpact("light");
    save();
    return;
  }

  S.target={x,y};
  sfx("ui");
  hapticImpact("light");
  save();
});

const touchStickShellEl = document.getElementById("touchStickShell");
const touchStickEl = document.getElementById("touchStick");
const TOUCH_STICK = { active:false, pointerId:null, touchId:null, dx:0, dy:0, max:34 };

function renderTouchStick(){
  if(!touchStickEl) return;
  touchStickEl.style.transform = `translate(${Math.round(TOUCH_STICK.dx * TOUCH_STICK.max)}px, ${Math.round(TOUCH_STICK.dy * TOUCH_STICK.max)}px)`;
}

function resetTouchStick(){
  TOUCH_STICK.active = false;
  TOUCH_STICK.pointerId = null;
  TOUCH_STICK.touchId = null;
  TOUCH_STICK.dx = 0;
  TOUCH_STICK.dy = 0;
  renderTouchStick();
}

function updateTouchStick(clientX, clientY){
  if(!touchStickShellEl) return;
  const rect = touchStickShellEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rawX = clientX - cx;
  const rawY = clientY - cy;
  const limit = Math.max(22, rect.width * 0.32);
  const len = Math.hypot(rawX, rawY) || 1;
  const clampedLen = Math.min(len, limit);
  TOUCH_STICK.dx = rawX / len * (clampedLen / limit);
  TOUCH_STICK.dy = rawY / len * (clampedLen / limit);
  renderTouchStick();
}

function stopTouchOverlayEvent(e){
  e.preventDefault();
  e.stopPropagation();
}

function touchMoveListener(e){
  if(!TOUCH_STICK.active || TOUCH_STICK.pointerId!==e.pointerId) return;
  stopTouchOverlayEvent(e);
  updateTouchStick(e.clientX, e.clientY);
}

function touchEndListener(e){
  if(TOUCH_STICK.pointerId!=null && TOUCH_STICK.pointerId!==e.pointerId) return;
  stopTouchOverlayEvent(e);
  resetTouchStick();
}

function findTrackedTouch(touchList){
  if(TOUCH_STICK.touchId == null || !touchList) return null;
  for(const touch of touchList){
    if(touch.identifier === TOUCH_STICK.touchId) return touch;
  }
  return null;
}

function touchStartFallback(e){
  const touch = e.changedTouches?.[0];
  if(!touch) return;
  stopTouchOverlayEvent(e);
  TOUCH_STICK.active = true;
  TOUCH_STICK.pointerId = null;
  TOUCH_STICK.touchId = touch.identifier;
  S.target = null;
  if(window.TigerTutorial?.isRunning) window.TigerTutorial.mapClicked = true;
  updateTouchStick(touch.clientX, touch.clientY);
}

function touchMoveFallback(e){
  const touch = findTrackedTouch(e.touches) || findTrackedTouch(e.changedTouches);
  if(!touch) return;
  stopTouchOverlayEvent(e);
  updateTouchStick(touch.clientX, touch.clientY);
}

function touchEndFallback(e){
  const touch = findTrackedTouch(e.changedTouches);
  if(!touch) return;
  stopTouchOverlayEvent(e);
  resetTouchStick();
}

function setupTouchControls(){
  document.querySelectorAll(".touchBtn").forEach((el)=>{
    el.addEventListener("pointerdown", (e)=>e.stopPropagation());
    el.addEventListener("pointerup", (e)=>e.stopPropagation());
    el.addEventListener("click", (e)=>e.stopPropagation());
    el.addEventListener("touchstart", (e)=>e.stopPropagation(), { passive:true });
    el.addEventListener("touchend", (e)=>e.stopPropagation(), { passive:true });
  });

  if(!touchStickShellEl) return;

  const begin = (e)=>{
    stopTouchOverlayEvent(e);
    if(e.pointerType==="mouse" && e.button!==0) return;
    TOUCH_STICK.active = true;
    TOUCH_STICK.pointerId = e.pointerId;
    S.target = null;
    if(window.TigerTutorial?.isRunning) window.TigerTutorial.mapClicked = true;
    updateTouchStick(e.clientX, e.clientY);
  };

  touchStickShellEl.addEventListener("pointerdown", begin);
  touchStickShellEl.addEventListener("touchstart", touchStartFallback, { passive:false });
  document.addEventListener("pointermove", touchMoveListener, { passive:false });
  document.addEventListener("pointerup", touchEndListener, { passive:false });
  document.addEventListener("pointercancel", touchEndListener, { passive:false });
  document.addEventListener("touchmove", touchMoveFallback, { passive:false });
  document.addEventListener("touchend", touchEndFallback, { passive:false });
  document.addEventListener("touchcancel", touchEndFallback, { passive:false });
  renderTouchStick();
}

setupTouchControls();

const GAMEPAD_STATE = {
  connected: false,
  id: "",
  lx: 0,
  ly: 0,
  activeAt: 0,
  buttons: Object.create(null),
};
const GAMEPAD_UI = {
  buttons: [],
  index: -1,
  activeAt: 0,
};
let LAST_CONTROLLER_UI_KEY = "";

function gamepadUiContainers(){
  const tutorial = document.getElementById("tutorialOverlay");
  if(tutorial && tutorial.style.display === "flex") return [document.getElementById("tutorialCard")];

  const overlays = ["overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay"]
    .map((id)=>document.getElementById(id))
    .filter((el)=>el && el.style.display === "flex");
  if(overlays.length) return overlays;

  return [
    document.getElementById("combatButtons"),
    document.querySelector(".actionButtons"),
    document.querySelector(".mobileUtilityBar"),
    document.querySelector(".nav"),
    document.querySelector(".topActions"),
  ].filter(Boolean);
}

function isGamepadFocusable(el){
  if(!el || el.disabled) return false;
  if(el.getClientRects().length === 0) return false;
  const cs = window.getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
}

function collectGamepadButtons(){
  return gamepadUiContainers()
    .flatMap((container)=>Array.from(container.querySelectorAll("button")))
    .filter(isGamepadFocusable);
}

function clearGamepadFocus(){
  for(const btn of GAMEPAD_UI.buttons){
    btn.classList.remove("gamepadFocus");
  }
  GAMEPAD_UI.buttons = [];
  GAMEPAD_UI.index = -1;
}

function syncGamepadFocus(){
  const buttons = collectGamepadButtons();
  const current = GAMEPAD_UI.buttons[GAMEPAD_UI.index];
  GAMEPAD_UI.buttons.forEach((btn)=>btn.classList.remove("gamepadFocus"));
  GAMEPAD_UI.buttons = buttons;

  if(!buttons.length){
    GAMEPAD_UI.index = -1;
    return null;
  }

  const currentIdx = current ? buttons.indexOf(current) : -1;
  if(currentIdx >= 0) GAMEPAD_UI.index = currentIdx;
  else if(GAMEPAD_UI.index < 0 || GAMEPAD_UI.index >= buttons.length) GAMEPAD_UI.index = 0;

  const active = buttons[GAMEPAD_UI.index];
  if(active){
    active.classList.add("gamepadFocus");
    active.scrollIntoView?.({ block:"nearest", inline:"nearest" });
  }
  return active || null;
}

function moveGamepadFocus(delta){
  const buttons = collectGamepadButtons();
  if(!buttons.length) return null;
  GAMEPAD_UI.buttons.forEach((btn)=>btn.classList.remove("gamepadFocus"));
  GAMEPAD_UI.buttons = buttons;
  GAMEPAD_UI.index = (GAMEPAD_UI.index < 0)
    ? 0
    : (GAMEPAD_UI.index + delta + buttons.length) % buttons.length;
  GAMEPAD_UI.activeAt = Date.now();
  const active = buttons[GAMEPAD_UI.index];
  if(active){
    active.classList.add("gamepadFocus");
    active.scrollIntoView?.({ block:"nearest", inline:"nearest" });
  }
  return active || null;
}

function gamepadUiOwnsInput(){
  return GAMEPAD_UI.index >= 0 && (Date.now() - (GAMEPAD_UI.activeAt || 0)) < 5000;
}

function activateGamepadFocus(){
  const btn = syncGamepadFocus();
  if(!btn) return false;
  GAMEPAD_UI.activeAt = Date.now();
  btn.click();
  syncGamepadFocus();
  return true;
}

function anyGamepadOverlayVisible(){
  const ids = ["tutorialOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay"];
  return ids.some((id)=>{
    const el = document.getElementById(id);
    return !!(el && el.style.display === "flex");
  });
}

function activateGamepadBack(){
  const buttons = collectGamepadButtons();
  if(!buttons.length) return false;
  const focused = buttons[GAMEPAD_UI.index];
  const preferFocused = focused && /back|close|resume|skip|finish/i.test(focused.innerText || "");
  const btn = preferFocused
    ? focused
    : buttons.find((el)=>/back|close|resume|skip|finish/i.test(el.innerText || ""));
  if(!btn) return false;
  GAMEPAD_UI.activeAt = Date.now();
  btn.click();
  syncGamepadFocus();
  return true;
}

function refreshControllerUi(force=false){
  const key = `${controllerOwnsUi()?1:0}:${S.inBattle?1:0}:${anyGamepadOverlayVisible()?1:0}`;
  if(force || key !== LAST_CONTROLLER_UI_KEY){
    renderCombatControls();
    if(controllerOwnsUi() || anyGamepadOverlayVisible()) syncGamepadFocus();
    else clearGamepadFocus();
    LAST_CONTROLLER_UI_KEY = key;
  }
}

function gamepadAxis(v, deadzone=0.18){
  const n = Number(v || 0);
  if(Math.abs(n) < deadzone) return 0;
  const sign = Math.sign(n);
  const scaled = (Math.abs(n) - deadzone) / (1 - deadzone);
  return sign * clamp(scaled, 0, 1);
}

function gamepadButtonPressed(btn){
  if(!btn) return false;
  if(typeof btn === "number") return btn > 0.55;
  return !!btn.pressed || Number(btn.value || 0) > 0.55;
}

function gamepadButtonEdge(name, pressed){
  const was = !!GAMEPAD_STATE.buttons[name];
  GAMEPAD_STATE.buttons[name] = pressed;
  if(pressed) GAMEPAD_STATE.activeAt = Date.now();
  return pressed && !was;
}

function gamepadLabel(id=""){
  const text = String(id || "").trim();
  if(!text) return "Controller";
  const parts = text.split("(")[0].trim().split(/\s+/).slice(0,3);
  return parts.join(" ");
}

function pollGamepadControls(){
  const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  const pad = pads[0];

  if(!pad){
    GAMEPAD_STATE.connected = false;
    GAMEPAD_STATE.id = "";
    GAMEPAD_STATE.lx = 0;
    GAMEPAD_STATE.ly = 0;
    GAMEPAD_STATE.activeAt = 0;
    GAMEPAD_STATE.buttons = Object.create(null);
    clearGamepadFocus();
    LAST_CONTROLLER_UI_KEY = "";
    return { x:0, y:0 };
  }

  GAMEPAD_STATE.connected = true;
  GAMEPAD_STATE.id = pad.id || "Controller";

  const lx = gamepadAxis(pad.axes?.[0]);
  const ly = gamepadAxis(pad.axes?.[1]);
  GAMEPAD_STATE.lx = lx;
  GAMEPAD_STATE.ly = ly;
  if(Math.abs(GAMEPAD_STATE.lx) > 0.08 || Math.abs(GAMEPAD_STATE.ly) > 0.08){
    GAMEPAD_STATE.activeAt = Date.now();
  }

  if(window.TigerTutorial?.isRunning && (Math.abs(GAMEPAD_STATE.lx) > 0.08 || Math.abs(GAMEPAD_STATE.ly) > 0.08)){
    window.TigerTutorial.mapClicked = true;
  }

  const uiVisible = anyGamepadOverlayVisible();
  if(uiVisible) syncGamepadFocus();

  if(gamepadButtonEdge("dpadUp", gamepadButtonPressed(pad.buttons?.[12]))){
    moveGamepadFocus(-1);
  }
  if(gamepadButtonEdge("dpadDown", gamepadButtonPressed(pad.buttons?.[13]))){
    moveGamepadFocus(1);
  }
  if(gamepadButtonEdge("dpadLeft", gamepadButtonPressed(pad.buttons?.[14]))){
    moveGamepadFocus(-1);
  }
  if(gamepadButtonEdge("dpadRight", gamepadButtonPressed(pad.buttons?.[15]))){
    moveGamepadFocus(1);
  }

  if(gamepadButtonEdge("a", gamepadButtonPressed(pad.buttons?.[0]))){
    if(uiVisible || gamepadUiOwnsInput()){
      if(activateGamepadFocus()) return { x: GAMEPAD_STATE.lx, y: GAMEPAD_STATE.ly };
    }
    if(S.inBattle) playerAction("ATTACK");
    else if(canEngage()) startCombat();
    else lockNearestTiger({ silent:true });
  }
  if(gamepadButtonEdge("b", gamepadButtonPressed(pad.buttons?.[1]))){
    if(uiVisible || gamepadUiOwnsInput()){
      if(activateGamepadBack()) return { x: GAMEPAD_STATE.lx, y: GAMEPAD_STATE.ly };
    }
    if(S.inBattle) endBattle("RETREAT");
    else sprint();
  }
  if(gamepadButtonEdge("x", gamepadButtonPressed(pad.buttons?.[2]))){
    scan();
  }
  if(gamepadButtonEdge("y", gamepadButtonPressed(pad.buttons?.[3]))){
    useMedkit();
  }
  if(gamepadButtonEdge("lb", gamepadButtonPressed(pad.buttons?.[4]))){
    cycleWeapon(-1);
  }
  if(gamepadButtonEdge("rb", gamepadButtonPressed(pad.buttons?.[5]))){
    cycleWeapon(1);
  }
  if(gamepadButtonEdge("lt", gamepadButtonPressed(pad.buttons?.[6]))){
    placeTrap();
  }
  if(gamepadButtonEdge("rt", gamepadButtonPressed(pad.buttons?.[7]))){
    if(S.inBattle) playerAction("ATTACK");
    else if(canEngage()) startCombat();
    else lockNearestTiger({ silent:true });
  }
  if(gamepadButtonEdge("back", gamepadButtonPressed(pad.buttons?.[8]))){
    useRepairKit();
  }
  if(gamepadButtonEdge("start", gamepadButtonPressed(pad.buttons?.[9]))){
    togglePause();
  }
  if(gamepadButtonEdge("ls", gamepadButtonPressed(pad.buttons?.[10]))){
    deploy();
  }
  if(gamepadButtonEdge("rs", gamepadButtonPressed(pad.buttons?.[11]))){
    callBackup();
  }

  return { x: GAMEPAD_STATE.lx, y: GAMEPAD_STATE.ly };
}

function controllerOwnsUi(){
  if(!GAMEPAD_STATE.connected) return false;
  return (Date.now() - (GAMEPAD_STATE.activeAt || 0)) < 4000;
}

window.addEventListener("gamepadconnected", (e)=>{
  const label = gamepadLabel(e.gamepad?.id);
  GAMEPAD_STATE.connected = true;
  GAMEPAD_STATE.id = e.gamepad?.id || "Controller";
  GAMEPAD_STATE.activeAt = Date.now();
  refreshControllerUi(true);
  toast(`${label} connected`);
});

window.addEventListener("gamepaddisconnected", ()=>{
  GAMEPAD_STATE.connected = false;
  GAMEPAD_STATE.id = "";
  GAMEPAD_STATE.activeAt = 0;
  clearGamepadFocus();
  refreshControllerUi(true);
  toast("Controller disconnected");
});

document.addEventListener("keydown",(e)=>{
  if(isTypingContext(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;

  const key = e.key.toLowerCase();
  if(setMoveKey(key, true)){
    e.preventDefault();
    return;
  }

  if(e.repeat) return;

  if(key==="q"){
    if(!(S.paused || S.inBattle || S.missionEnded || S.gameOver)) lockNearestTiger();
    e.preventDefault();
    return;
  }
  if(e.code==="Space"){
    scan();
    e.preventDefault();
    return;
  }
  if(key==="e"){
    startCombat();
    e.preventDefault();
    return;
  }
  if(key==="shift"){
    sprint();
    e.preventDefault();
    return;
  }
  if(key==="m"){
    useMedkit();
    e.preventDefault();
    return;
  }
  if(key==="r"){
    useRepairKit();
    e.preventDefault();
    return;
  }
  if(key==="t"){
    placeTrap();
    e.preventDefault();
  }
});

document.addEventListener("keyup",(e)=>{
  const key = e.key.toLowerCase();
  if(setMoveKey(key, false)) e.preventDefault();
});

function tigerById(id){ return S.tigers.find(t=>t.id===id); }
function nearestTiger(){
  const alive=S.tigers.filter(t=>t.alive);
  if(!alive.length) return null;
  let best=alive[0], bd=1e9;
  for(const t of alive){
    const d=dist(S.me.x,S.me.y,t.x,t.y);
    if(d<bd){bd=d; best=t;}
  }
  return best;
}
function currentTargetTiger(){
  const locked=tigerById(S.lockedTigerId);
  if(locked && locked.alive) return locked;
  return nearestTiger();
}
function lockNearestTiger(opts={}){
  const { silent=false } = opts;
  if(!tutorialAllows("lock")){
    if(!silent) toast(tutorialBlockMessage("lock"));
    return null;
  }
  const t=nearestTiger();
  if(!t){
    if(!silent) toast("No tiger to lock.");
    return null;
  }
  S.lockedTigerId=t.id;
  if(!silent){
    const d = Math.round(dist(S.me.x,S.me.y,t.x,t.y));
    toast(`Locked Tiger #${t.id} (${t.type}) • ${d}m`);
    sfx("ui");
    hapticImpact("light");
  }
  save();
  return t;
}
function canEngage(){
  const t=currentTargetTiger();
  if(!t) return null;
  return dist(S.me.x,S.me.y,t.x,t.y) < 90 ? t : null;
}

// ===================== SCAN =====================
function scan(){
  if(!tutorialAllows("scan")) return toast(tutorialBlockMessage("scan"));
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return toast("Not now.");
  if(S.stamina < STAMINA_COST_SCAN) return toast("Not enough stamina.");
  S.stamina -= STAMINA_COST_SCAN;
  S.scanPing=140;
  if(!window.TigerTutorial?.isRunning) lockNearestTiger({ silent:true });
  sfx("scan"); hapticImpact("light"); save();
  unlockAchv("scan1","First Scan");
}

// ===================== MOVEMENT =====================
const KEY_STATE = { up:false, down:false, left:false, right:false };

function setMoveKey(key, on){
  if(key==="w" || key==="arrowup"){ KEY_STATE.up = on; return true; }
  if(key==="s" || key==="arrowdown"){ KEY_STATE.down = on; return true; }
  if(key==="a" || key==="arrowleft"){ KEY_STATE.left = on; return true; }
  if(key==="d" || key==="arrowright"){ KEY_STATE.right = on; return true; }
  return false;
}

function keyboardMoveTick(){
  const touchActive = Math.abs(TOUCH_STICK.dx) > 0.04 || Math.abs(TOUCH_STICK.dy) > 0.04;
  const gamepadActive = Math.abs(GAMEPAD_STATE.lx) > 0.04 || Math.abs(GAMEPAD_STATE.ly) > 0.04;
  if(window.TigerTutorial?.isRunning && !touchActive && !gamepadActive) return false;
  if(S.paused || S.gameOver || S.missionEnded) return false;

  const dx = ((KEY_STATE.right ? 1 : 0) - (KEY_STATE.left ? 1 : 0)) + TOUCH_STICK.dx + GAMEPAD_STATE.lx;
  const dy = ((KEY_STATE.down ? 1 : 0) - (KEY_STATE.up ? 1 : 0)) + TOUCH_STICK.dy + GAMEPAD_STATE.ly;
  if(!dx && !dy) return false;
  if(S.stamina<=0) return false;

  const len = Math.hypot(dx,dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let speed=2.6;

  if(S._sprintTicks && S._sprintTicks>0){
    speed=4.2;
    S._sprintTicks--;
  }

  S.target=null;
  S.me.face = Math.atan2(uy, ux);
  S.me.step = (S.me.step + speed*0.35) % (Math.PI*2);

  const nx = S.me.x + ux*speed;
  const ny = S.me.y + uy*speed;
  tryMoveEntity(S.me, nx, ny, 16);

  S.stamina = clamp(S.stamina - (speed>2.6 ? STAMINA_DRAIN_SPRINT : STAMINA_DRAIN_WALK), 0, 100);
  return true;
}

function movePlayer(){
  if(!S.target) return;
  const dx=S.target.x-S.me.x, dy=S.target.y-S.me.y;
  const d=Math.hypot(dx,dy);
  if(d<6){ S.target=null; return; }
  if(S.stamina<=0) return;

  let speed=2.6;
  if(S._sprintTicks && S._sprintTicks>0){ speed=4.2; S._sprintTicks--; }

  S.me.face = Math.atan2(dy, dx);
  S.me.step = (S.me.step + speed*0.35) % (Math.PI*2);

  const nx = S.me.x + (dx/d)*speed;
  const ny = S.me.y + (dy/d)*speed;

  const ok = tryMoveEntity(S.me, nx, ny, 16);
  if(!ok){ S.target=null; }

  S.stamina = clamp(S.stamina - (speed>2.6 ? STAMINA_DRAIN_SPRINT : STAMINA_DRAIN_WALK), 0, 100);
}

function sprint(){
  if(S.paused || S.missionEnded || S.gameOver) return toast("Not now.");
  if(S.stamina < STAMINA_COST_SPRINT) return toast("Not enough stamina.");
  S.stamina -= STAMINA_COST_SPRINT;
  S._sprintTicks=90;
  sfx("ui"); hapticImpact("light"); save();
  unlockAchv("sprint1","Sprint");
}

function supportUnitsTick(){
  if(S.inBattle || S.paused || S.gameOver || S.missionEnded) return;
  const liveCivs = (S.mode==="Survival") ? [] : S.civilians.filter(c=>c.alive && !c.evac);
  const liveTigers = S.tigers.filter(t=>t.alive);

  for(const unit of (S.supportUnits || [])){
    unit.step = (unit.step || 0) + 0.08;
    const patrolX = (unit.homeX ?? unit.x) + Math.cos(unit.step * 0.55) * 16;
    const patrolY = (unit.homeY ?? unit.y) + Math.sin(unit.step * 0.72) * 14;
    let targetX = patrolX;
    let targetY = patrolY;

    const dangerCiv = liveCivs.find(c => c.id === S.dangerCivId);
    if(dangerCiv){
      targetX = dangerCiv.x;
      targetY = dangerCiv.y;
    } else {
      const nearestTiger = liveTigers
        .slice()
        .sort((a,b)=>dist(unit.x,unit.y,a.x,a.y) - dist(unit.x,unit.y,b.x,b.y))[0];
      if(nearestTiger && dist(unit.x, unit.y, nearestTiger.x, nearestTiger.y) < 240){
        targetX = nearestTiger.x;
        targetY = nearestTiger.y;
      }
    }

    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const step = Math.min(1.65, len);
    unit.face = Math.atan2(dy, dx);
    tryMoveEntity(unit, unit.x + (dx / len) * step, unit.y + (dy / len) * step, 16);

    for(const civ of liveCivs){
      if(dist(unit.x, unit.y, civ.x, civ.y) < 78){
        civ.hp = clamp(civ.hp + 0.025, 0, civ.hpMax);
      }
    }

    for(const tiger of liveTigers){
      const tigerDist = dist(unit.x, unit.y, tiger.x, tiger.y);
      if(tigerDist < 130){
        tiger.aggroBoost = clamp((tiger.aggroBoost || 0) - 0.01, 0, 1);
      }
      if(tigerDist < 82 && tiger.hp > 16){
        tiger.hp = Math.max(16, tiger.hp - 0.045);
        tiger.vx *= 0.96;
        tiger.vy *= 0.96;
      }
    }
  }
}

// ===================== CIVILIANS FOLLOW-ONLY =====================
function followCiviliansTick(){
  if(S.mode==="Survival") return;
  for(const c of S.civilians){
    if(!c.alive || c.evac) continue;
    const d = dist(c.x,c.y,S.me.x,S.me.y);
    if(d < 95){
      const dx = S.me.x - c.x, dy = S.me.y - c.y;
      const dd = Math.hypot(dx,dy) || 1;
      const sp = 1.25;
      tryMoveEntity(c, c.x + (dx/dd)*sp, c.y + (dy/dd)*sp, 14);
    }
  }
}

function evacCheck(){
  if(S.mode==="Survival") return;
  for(const c of S.civilians){
    if(!c.alive || c.evac) continue;
    if(dist(c.x,c.y,S.evacZone.x,S.evacZone.y) < S.evacZone.r){
      c.evac=true;
      S.evacDone += 1;
      S.stats.evac += 1;
      addXP(35);
      toast(`Civilian evacuated (${S.evacDone}/${S.civilians.length})`);
      unlockAchv("evac1","First Evac");
      hapticNotif("success");
    }
  }
}

// ===================== CIVILIANS UNDER ATTACK (slower damage) =====================
function tickCiviliansAndThreats(){
  if(S.mode==="Survival") return;

  if(Date.now() < (S.civGraceUntil||0)){
    S._underAttack=0;
    S.dangerCivId=null;
    return;
  }

  if(S.backupActive>0){
    S._underAttack=0;
    S.dangerCivId=null;
    return;
  }

  const aliveCivsAll = S.civilians.filter(c=>c.alive && !c.evac);
  if(!aliveCivsAll.length){
    S._underAttack=0;
    S.dangerCivId=null;
    return;
  }

  let underAttack=0;
  let dangerPair={ civId:null, dist:1e9 };

  for(const t of S.tigers){
    if(!t.alive) continue;

    let best=aliveCivsAll[0], bd=1e9;
    for(const c of aliveCivsAll){
      const d=dist(t.x,t.y,c.x,c.y);
      if(d<bd){bd=d; best=c;}
    }

    if(bd < dangerPair.dist) dangerPair={ civId: best.id, dist: bd };

    if(bd < 70){
      underAttack++;

      const base = 0.25;
      const diff = carcassDifficulty();
      const isBossAlpha = (t.type==="Alpha" && t.bossPhases>0);
      const multType =
        isBossAlpha ? 2.8 :
        (t.type==="Alpha") ? 2.2 : 1.0;

      // Berserker rage increases civilian threat slightly
      const rageMult = (t.type==="Berserker" && (t.hp/t.hpMax)<0.35) ? 1.25 : 1.0;
      const nearbySupport = (S.supportUnits || []).filter(unit => dist(unit.x, unit.y, best.x, best.y) < 96).length;
      const guardMult = nearbySupport ? clamp(1 - nearbySupport * 0.35, 0.3, 1) : 1;
      const protectMult = S._protectTicks > 0 ? 0.45 : 1;
      const dmg = base * multType * rageMult * (1 + (diff-1)*0.20) * guardMult * protectMult;
      best.hp = clamp(best.hp - (dmg * perkCivMul()), 0, best.hpMax);
    }
  }

  S._underAttack=underAttack;
  S.dangerCivId = (dangerPair.civId && dangerPair.dist < 220) ? dangerPair.civId : null;

  for(const c of S.civilians){
    if(c.alive && c.hp<=0){
      c.alive=false;
      S.lives -= 1;

      if(S.lives <= 0){
        S.lives = 0;
        return gameOverChoice("A civilian died and you ran out of lives.");
      }

      toast(`Civilian died. Lives left: ${S.lives}`);
      hapticNotif("warning");
      save();
      return;
    }
  }
}

// ===================== TIGER ABILITIES (Phase 1) =====================
function abilityTick(t){
  const now = Date.now();
  if(!t.alive) return;

  // Berserker Rage
  if(t.type==="Berserker"){
    t.rageOn = (t.hp/t.hpMax) < 0.35;
  } else t.rageOn = false;

  // Scout Dash (short burst)
  if(t.type==="Scout" && now > (t.dashUntil||0)){
    if(Math.random() < 0.007){ // occasional
      t.dashUntil = now + 900;
      setEventText("🐅 Scout Dash!", 2);
    }
  }

  // Stalker Fade
  if(t.type==="Stalker" && now > (t.fadeUntil||0)){
    if(Math.random() < 0.004){
      t.fadeUntil = now + rand(1600, 2400);
      setEventText("🐅 Stalker vanished…", 2);
    }
  }

  // Alpha Roar Buff
  if(t.type==="Alpha" && now > (t.roarUntil||0)){
    if(Math.random() < 0.004){
      t.roarUntil = now + rand(1800, 2600);
      setEventText("🦁 Alpha ROAR! Pack buffed.", 3);
      sfx("event"); hapticImpact("heavy");
    }
  }
}

function alphaBuffs(){
  const now=Date.now();
  const alphas = S.tigers.filter(t=>t.alive && t.type==="Alpha");
  for(const t of S.tigers){
    t._packBuff=0;
    if(!t.alive) continue;
    for(const a of alphas){
      if(a.id===t.id) continue;
      if(dist(a.x,a.y,t.x,t.y) < 240){
        const roar = (now < (a.roarUntil||0)) ? 0.22 : 0.12;
        t._packBuff = Math.max(t._packBuff, roar);
      }
    }
  }
}

// ===================== TIGERS ROAM =====================
function roamTigers(){
  alphaBuffs();
  if(S.backupActive>0) return;

  const now = Date.now();

  for(const t of S.tigers){
    if(!t.alive) continue;

    abilityTick(t);

    if(t.holdUntil && now < t.holdUntil){
      t.vx=0; t.vy=0;
      t.step = (t.step + 0.05) % (Math.PI*2);
      continue;
    }

    t.step = (t.step + 0.12) % (Math.PI*2);

    const civs = (S.mode!=="Survival") ? S.civilians.filter(c=>c.alive && !c.evac) : [];
    let targetX=S.me.x, targetY=S.me.y;

    const extraCivBias = (carcassDifficulty()-1)*0.15;
    const bias = clamp(t.civBias + extraCivBias, 0, 0.98);

    if(civs.length && Math.random() < bias){
      let best=civs[0], bd=1e9;
      for(const c of civs){
        const d=dist(t.x,t.y,c.x,c.y);
        if(d<bd){bd=d; best=c;}
      }
      targetX=best.x; targetY=best.y;
    }

    const def=TIGER_TYPES.find(x=>x.key===t.type) || TIGER_TYPES[1];
    const hunter=(t.aggroBoost||0);
    const chaseChance = clamp((S.aggro/100)*0.25 + hunter*0.55 + 0.10, 0, 0.95);
    const chase = Math.random() < chaseChance;

    // ability speed mods
    let speedCap = ((def.spd*0.9) + hunter*1.2 + (t._packBuff?0.55:0));
    if(t.type==="Scout" && now < (t.dashUntil||0)) speedCap *= 1.55;
    if(t.type==="Berserker" && t.rageOn) speedCap *= 1.20;

    if(chase){
      t.vx += (targetX>t.x?0.06:-0.06);
      t.vy += (targetY>t.y?0.06:-0.06);
    } else {
      t.vx += (Math.random()-0.5)*0.08;
      t.vy += (Math.random()-0.5)*0.08;
    }

    if(t.packId){
      const mates = S.tigers.filter(x => x.alive && x.packId === t.packId && x.id !== t.id);
      if(mates.length){
        const packX = mates.reduce((sum, x) => sum + x.x, 0) / mates.length;
        const packY = mates.reduce((sum, x) => sum + x.y, 0) / mates.length;
        const pull = dist(t.x, t.y, packX, packY) > 55 ? 0.035 : 0.012;
        t.vx += (packX > t.x ? pull : -pull);
        t.vy += (packY > t.y ? pull : -pull);
      }
    }

    t.vx = clamp(t.vx, -speedCap, speedCap);
    t.vy = clamp(t.vy, -speedCap, speedCap);

    const moved = tryMoveEntity(t, t.x + t.vx, t.y + t.vy, 18);
    if(!moved){ t.vx *= -0.8; t.vy *= -0.8; }

    if(t.x<40||t.x>cv.width-40) t.vx*=-1;
    if(t.y<60||t.y>cv.height-40) t.vy*=-1;
    t.x=clamp(t.x,40,cv.width-40);
    t.y=clamp(t.y,60,cv.height-40);
  }
}

// ===================== SURVIVAL PRESSURE =====================
function survivalPressureTick(){
  if(S.mode!=="Survival" || S.paused || S.gameOver) return;
  if(S.backupActive>0) return;

  if(!S.survivalStart) S.survivalStart = Date.now();
  S.surviveSeconds = Math.floor((Date.now()-S.survivalStart)/1000);

  let hits=0;
  for(const t of S.tigers){
    if(!t.alive) continue;
    if(dist(t.x,t.y,S.me.x,S.me.y) < 140) hits++;
  }
  if(hits>0){
    const base=0.20 + hits*0.10;
    S._pressure=(S._pressure||0)+base;
  }
  S._pressTick=(S._pressTick||0)+1;
  if(S._pressTick>=20){
    S._pressTick=0;
    const dmg=Math.min(8, Math.round((S._pressure||0)));
    S._pressure=0;
    if(dmg>0) applyPlayerDamage(dmg,true);
  }
}

// ===================== DAMAGE / RESPAWN =====================
function applyPlayerDamage(dmg, showToast=false){
  if(S.armor > 0){
  const eff = (typeof perkArmorEff === "function") ? perkArmorEff() : 1; // 1.00, 1.05, 1.10...
  const absorbed = Math.min(S.armor, dmg);
  const armorCost = absorbed / eff;   // perk slows armor drain
  S.armor = clamp(S.armor - armorCost, 0, S.armorCap);
  dmg -= absorbed;
}
  if(dmg>0){
    S.hp = clamp(S.hp - dmg, 0, 100);
    sfx("hurt"); hapticImpact("medium");
    if(showToast) toast(`🐅 Hit: -${dmg} HP`);
  }
  if(S.inBattle) renderBattleStatus();
  if(S.hp<=0){
    S.lives -= 1;

    if(S.lives > 0){
      toast(`You went down. Respawned. Lives left: ${S.lives}`);
      hapticNotif("warning");

      S.hp = 100;
      S.armor = 20;
      S.stamina = 100;
      S.me.x = 160; S.me.y = 420;
      S.target = null;

      if(S.inBattle) endBattle("RETREAT");

      S.aggro = clamp(S.aggro - 5, 0, 100);

      save();
      return;
    }

    S.lives = 0;
    return gameOverChoice("You died and ran out of lives.");
  }
}

// ===================== REGEN =====================
function regen(){
  const now=Date.now();
  if(!S._last) S._last=now;
  const dt=(now-S._last)/1000;
  if(dt>=2.5){
    const ticks=Math.floor(dt/2.5);
    S.stamina = clamp(S.stamina + ticks*3, 0, 100);
    S._last=now;
  }
}

// ===================== BATTLE =====================
function activeTiger(){
  return tigerById(S.activeTigerId);
}

function emitCombatFx(x1, y1, x2, y2, color, width=3){
  COMBAT_FX.push({ x1, y1, x2, y2, color, width, ttl:8, maxTtl:8 });
}

function tickCombatFx(){
  for(const fx of COMBAT_FX) fx.ttl -= 1;
  for(let i = COMBAT_FX.length - 1; i >= 0; i--){
    if(COMBAT_FX[i].ttl <= 0) COMBAT_FX.splice(i, 1);
  }
}

function drawCombatFx(){
  for(const fx of COMBAT_FX){
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = fx.width;
    ctx.beginPath();
    ctx.moveTo(fx.x1, fx.y1);
    ctx.lineTo(fx.x2, fx.y2);
    ctx.stroke();
    ctx.restore();
  }
}

function combatWeaponLabel(dir){
  if(!S.ownedWeapons?.length) return "Weapon";
  const idx = Math.max(0, S.ownedWeapons.indexOf(S.equippedWeaponId));
  const targetIdx = (idx + dir + S.ownedWeapons.length) % S.ownedWeapons.length;
  const nextWeapon = getWeapon(S.ownedWeapons[targetIdx]);
  if(!nextWeapon) return "Weapon";
  const words = nextWeapon.name.split(" ");
  return words.slice(0,2).join(" ");
}

function renderCombatControls(){
  const touchOverlay = document.querySelector(".touchOverlay");
  const touchHint = document.querySelector(".touchHint");
  const mapCluster = document.getElementById("mapTouchCluster");
  const combatCluster = document.getElementById("combatTouchCluster");
  const actionButtons = document.querySelector(".actionButtons");
  const combatButtons = document.getElementById("combatButtons");
  const inCombat = !!S.inBattle;
  const hideTouchUi = controllerOwnsUi();
  if(touchOverlay) touchOverlay.style.display = hideTouchUi ? "none" : "block";
  if(touchHint) touchHint.style.display = hideTouchUi ? "none" : "block";
  if(mapCluster) mapCluster.style.display = hideTouchUi ? "none" : (inCombat ? "none" : "grid");
  if(combatCluster) combatCluster.style.display = hideTouchUi ? "none" : (inCombat ? "grid" : "none");
  if(actionButtons) actionButtons.style.display = (hideTouchUi || inCombat) ? "none" : "";
  if(combatButtons) combatButtons.style.display = hideTouchUi ? "none" : (inCombat ? "flex" : "none");

  const t = activeTiger();
  const canCap = canCaptureTiger(t);
  const canKill = !!(t && t.hp <= 15);
  const canAtk = anyWeaponHasAmmo();

  [["touchAttackBtn", !canAtk], ["combatAttackBtn", !canAtk]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchCaptureBtn", !canCap], ["combatCaptureBtn", !canCap]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchKillBtn", !canKill], ["combatKillBtn", !canKill]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });

  const prevLabel = combatWeaponLabel(-1);
  const nextLabel = combatWeaponLabel(1);
  const prevDesktop = document.getElementById("combatPrevWeaponBtn");
  const nextDesktop = document.getElementById("combatNextWeaponBtn");
  if(prevDesktop) prevDesktop.innerText = `◀️ ${prevLabel}`;
  if(nextDesktop) nextDesktop.innerText = `${nextLabel} ▶️`;
  if(controllerOwnsUi() || anyGamepadOverlayVisible()) syncGamepadFocus();
}

function setBattleMsg(msg){
  S.battleMsg = msg;
  const titleEl = document.getElementById("battleTitle");
  const msgEl = document.getElementById("battleMsg");
  if(titleEl) titleEl.innerText = `Battle — Tiger #${S.activeTigerId}`;
  if(msgEl) msgEl.innerText = msg;
  renderBattleStatus();
}

function startCombat(){
  if(!tutorialAllows("engage")) return toast(tutorialBlockMessage("engage"));
  if(S.paused || S.missionEnded || S.gameOver) return toast("Not now.");
  const t=canEngage();
  if(!t) return toast("Move closer to a tiger to engage.");
  S.inBattle = true;
  S.activeTigerId = t.id;
  S.lockedTigerId = t.id;
  S._combatTigerAttackAt = Date.now() + 950;
  t.aggroBoost = Math.max(t.aggroBoost || 0, 0.85);
  const overlay = document.getElementById("battleOverlay");
  if(overlay) overlay.style.display = "none";
  renderBattleStatus();
  updateBattleButtons();
  updateAttackButton();
  renderCombatControls();
  setBattleMsg(`Engaged Tiger #${t.id}. Fight stays on the map.`);
  sfx("ui"); hapticImpact("light");
  save();
}

function renderBattleStatus(){
  const t = tigerById(S.activeTigerId);
  const agentBar = document.getElementById("battleAgentBar");
  const tigerBar = document.getElementById("battleTigerBar");
  const agentValue = document.getElementById("battleAgentValue");
  const tigerValue = document.getElementById("battleTigerValue");
  const agentMeta = document.getElementById("battleAgentMeta");
  const tigerMeta = document.getElementById("battleTigerMeta");
  if(!agentBar || !tigerBar || !agentValue || !tigerValue || !agentMeta || !tigerMeta) return;

  agentBar.style.width = `${clamp(S.hp, 0, 100)}%`;
  tigerBar.style.width = t ? `${clamp((t.hp / t.hpMax) * 100, 0, 100)}%` : "0%";

  agentValue.innerText = `${Math.round(S.hp)} HP`;
  tigerValue.innerText = t ? `${Math.round(t.hp)} / ${Math.round(t.hpMax)}` : "No target";

  agentMeta.innerText = `Armor ${Math.round(S.armor)} • Stamina ${Math.round(S.stamina)} • Ammo ${S.mag.loaded}/${S.mag.cap}`;
  tigerMeta.innerText = t
    ? `${t.type}${t.tranqTagged ? " • Tranq tagged" : ""} • Capture/Kill at 15 HP`
    : "Target lost";
  renderCombatControls();
}
function renderWeaponGrid(){
  const box=document.getElementById("weaponGrid");
  box.innerHTML = S.ownedWeapons.map(id=>{
    const w=getWeapon(id);
    const active=(id===S.equippedWeaponId);
    const dur=Math.round(weaponDurability(id));
    const reserve = S.ammoReserve[w.ammo]||0;
    const badge = (reserve<=0 && S.mag.loaded<=0 && active) ? " (NO AMMO)" : "";
    return `<button ${active?'class="good"':''} onclick="equipWeapon('${id}')">${active?'✅ ':''}${w.name} (${dur}%)${badge}</button>`;
  }).join("");
}
function endBattle(reason){
  const overlay = document.getElementById("battleOverlay");
  if(overlay) overlay.style.display="none";
  S.inBattle=false;
  S.activeTigerId=null;
  S.battleMsg="";
  S._combatTigerAttackAt = 0;
  if(reason==="RETREAT") S.aggro = clamp(S.aggro+4,0,100);
  renderCombatControls();
  save();
}

function requiredTranqWeaponId(t){
  const boss = (t.type==="Alpha" && t.bossPhases>0);
  if(boss) return "W_TRQ_LAUNCHER";
  if(t.type==="Stalker" || t.type==="Berserker") return "W_TRQ_RIFLE";
  return "W_TRQ_PISTOL_MK1";
}
function canCaptureTiger(t){
  if(!t || !t.alive) return false;
  if(t.hp>15) return false;
  if(!t.tranqTagged) return false;
  const req = requiredTranqWeaponId(t);
  if(S.equippedWeaponId !== req) return false;
  const w=equippedWeapon();
  if(w.type!=="tranq") return false;
  return true;
}
function updateBattleButtons(){
  const t=tigerById(S.activeTigerId);
  const killBtn = document.getElementById("killBtn");
  const capBtn = document.getElementById("capBtn");
  if(killBtn) killBtn.disabled = !(t && t.hp<=15);
  if(capBtn) capBtn.disabled = !canCaptureTiger(t);
  renderCombatControls();
  renderBattleStatus();
}

function payout(outcome){
  if(S.mode==="Story"){
    if(outcome==="CAPTURE") return { cash: rand(2500,5000), score: 220, trust:+6, aggro:-8 };
    return { cash: rand(500,1500), score: 100, trust:-4, aggro:+14 };
  }
  if(S.mode==="Arcade"){
    const L=S.arcadeLevel||1;
    if(outcome==="CAPTURE") return { cash: 900 + L*220, score: 180 + L*40, trust:+2, aggro:-4 };
    return { cash: 450 + L*140, score: 90 + L*25, trust:-1, aggro:+6 };
  }
  const W=S.survivalWave||1;
  if(outcome==="CAPTURE") return { cash: 700 + W*260, score: 180 + W*45, trust:0, aggro:-2 };
  return { cash: 300 + W*170, score: 85 + W*28, trust:0, aggro:+5 };
}

function maybeReinforceOnKill(){
  if(S.mode==="Survival") return;
  const chance = clamp(0.12 + (S.carcasses.length*0.01), 0.12, 0.30);
  if(Math.random() > chance) return;

  spawnRogueTiger();
  toast("🚨 Reinforcements arrived!");
}

// ---- Ammo availability helpers (Phase 1 fix) ----
function anyWeaponHasAmmo(){
  // If any owned weapon has either loaded>0 when equipped OR reserve>0 that could reload
  // We approximate by checking reserves; also if the equipped mag has bullets.
  if(S.mag.loaded>0) return true;
  for(const id of S.ownedWeapons){
    const w=getWeapon(id);
    const res = S.ammoReserve[w.ammo]||0;
    if(res>0) return true;
  }
  return false;
}
function equippedWeaponHasAmmoNow(){
  const w=equippedWeapon();
  if(S.mag.loaded>0) return true;
  const res = S.ammoReserve[w.ammo]||0;
  return res>0;
}
function updateAttackButton(){
  const btn = document.getElementById("atkBtn");
  if(btn) btn.disabled = !anyWeaponHasAmmo();
  renderCombatControls();
}

function findFriendlyFireVictim(targetTiger){
  if(S.mode==="Survival") return null;
  const candidates = S.civilians.filter(c=>c.alive && !c.evac);
  let victim = null;
  let nearest = 1e9;
  for(const civ of candidates){
    const segDist = pointSegmentDistance(civ.x, civ.y, S.me.x, S.me.y, targetTiger.x, targetTiger.y);
    const fromShooter = dist(S.me.x, S.me.y, civ.x, civ.y);
    const toTiger = dist(S.me.x, S.me.y, targetTiger.x, targetTiger.y);
    if(segDist < 18 && fromShooter < toTiger && fromShooter < nearest){
      nearest = fromShooter;
      victim = civ;
    }
  }
  return victim;
}

function playerAction(action){
  if(window.TigerTutorial?.isRunning){
    if(action==="ATTACK" && !tutorialAllows("attack")) return toast(tutorialBlockMessage("attack"));
    if(action==="PROTECT" || action==="CAPTURE" || action==="KILL"){
      return toast("Use Attack for the tutorial battle step.");
    }
  }
  const t=tigerById(S.activeTigerId);
  if(!t || !t.alive) return endBattle();

  if(action==="PROTECT"){
    if(S.mode==="Survival"){ setBattleMsg("No civilians in Survival."); return; }
    S._protectTicks=240;
    S.aggro=clamp(S.aggro+6,0,100);
    setBattleMsg("You draw attention! Civilian damage reduced briefly.");
    sfx("ui"); hapticImpact("light");
    save();
    return;
  }

  if(action==="CAPTURE"){
    if(!canCaptureTiger(t)) return toast("Capture rules not met.");
    t.alive=false;
    const pay=payout("CAPTURE");
    S.funds+=pay.cash; S.score+=pay.score;
    S.stats.captures += 1;
    addXP(90);
    S.stats.cashEarned += pay.cash;
    unlockAchv("cap1","First Capture");
    S.trust=clamp(S.trust+pay.trust,0,100);
    S.aggro=clamp(S.aggro+pay.aggro,0,100);
    sfx("win"); hapticNotif("success");
    endBattle();
    checkMissionComplete();
    return;
  }

  if(action==="KILL"){
    if(t.hp>15) return toast("Tiger HP too high to finish.");
    t.alive=false;
    S.carcasses.push({ x:t.x, y:t.y });
    const pay=payout("KILL");
    S.funds+=pay.cash; S.score+=pay.score;
    S.stats.kills += 1;
    addXP(50);
    S.stats.cashEarned += pay.cash;
    unlockAchv("kill1","First Kill");
    S.trust=clamp(S.trust+pay.trust,0,100);
    S.aggro=clamp(S.aggro+pay.aggro,0,100);
    maybeReinforceOnKill();
    sfx("win"); hapticNotif("success");
    endBattle();
    checkMissionComplete();
    return;
  }

  if(action==="ATTACK"){
    updateAttackButton();
    if(!anyWeaponHasAmmo()){
      toast("No ammo for any weapon. Buy ammo in Shop.");
      sfx("jam");
      return;
    }

    const w=equippedWeapon();

    // If this weapon is empty, do NOT auto-tigerTurn; let player switch weapons
    if(!equippedWeaponHasAmmoNow()){
      toast("No ammo for this weapon — switch guns or buy ammo.");
      sfx("jam");
      renderWeaponGrid();
      updateAttackButton();
      return;
    }

    // reload if needed
    if(S.mag.loaded<=0){
      const ok=autoReloadIfNeeded(true);
      if(!ok){
        toast("No reserve ammo for this weapon — switch guns.");
        sfx("jam");
        renderWeaponGrid();
        updateAttackButton();
        return;
      }
    }

    if(Math.random()<jamChance(w)){
      applyWearOnShot(w);
      sfx("jam");
      setBattleMsg(`JAM! ${w.name} malfunctioned.`);
      tigerTurn(t);
      save();
      return;
    }

    S.mag.loaded -= 1;
    S.stats.shots += 1;
    addXP(2);
    
    const eff=ammoEffectFor(w.ammo);
    let dmg=rand(w.dmg[0],w.dmg[1]);
    dmg *= perkDamageMul();
    const crit=Math.random()<(eff.crit + perkCritBonus());
    if(crit) dmg=Math.round(dmg*1.6);
    dmg=Math.round(dmg*eff.dmgMul);

    if(w.type==="tranq"){
      t.tranqTagged = true;
      dmg = Math.round(dmg * eff.tranq);
      sfx("tranq");
    } else {
      sfx("hit");
    }

    const victim = findFriendlyFireVictim(t);

    // ability mitigation
    dmg = Math.max(6, Math.round(dmg / carcassDifficulty()));
    if(t.type==="Berserker" && (t.hp/t.hpMax)<0.35) dmg = Math.max(6, Math.round(dmg*0.85));

    applyWearOnShot(w);

    if(victim){
      const civDmg = Math.max(4, Math.round(dmg * 0.7));
      victim.hp = clamp(victim.hp - civDmg, 0, victim.hpMax);
      emitCombatFx(S.me.x, S.me.y - 6, victim.x, victim.y, "rgba(251,191,36,.95)", 3);
      hapticImpact("medium");
      setBattleMsg(`Friendly fire! Civilian #${victim.id} took ${civDmg}.`);
    } else {
      t.hp = clamp(t.hp - dmg, 0, t.hpMax);
      emitCombatFx(S.me.x, S.me.y - 6, t.x, t.y, w.type==="tranq" ? "rgba(96,165,250,.96)" : "rgba(245,247,255,.96)", crit ? 4 : 3);
      hapticImpact(crit ? "heavy" : "light");
      setBattleMsg(`${crit?'CRIT! ':''}Hit for ${dmg}. ${w.type==='tranq'?'(tranq applied)':''}`);
    }

    if(t.hp<=0){ t.hp=15; setBattleMsg("Tiger is critically weak. Choose Capture or Kill!"); }

    updateBattleButtons();
    updateAttackButton();
    S._combatTigerAttackAt = Date.now() + rand(420, 780);
    save();
    return;
  }
}

function tigerTurn(t, softened=false){
  if(!t.alive) return;
  const diff=carcassDifficulty();

  let dmg = rand(10,18) + Math.floor((S.aggro/100)*10);
  dmg = Math.round(dmg * diff);

  // abilities
  if(t.type==="Scout" && Date.now() < (t.dashUntil||0)) dmg = Math.round(dmg*0.95);
  if(t.type==="Alpha" && Date.now() < (t.roarUntil||0)) dmg = Math.round(dmg*1.12);
  if(t.type==="Berserker"){
    dmg=Math.floor(dmg*1.25);
    if((t.hp/t.hpMax)<0.35) dmg=Math.floor(dmg*1.20);
  }
  if(t.type==="Stalker") dmg=Math.floor(dmg*1.05);
  if(softened) dmg=Math.floor(dmg*0.85);
  dmg=clamp(dmg,6,75);

  emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(251,113,133,.95)", 3);
  applyPlayerDamage(dmg,false);
  if(S.inBattle) setBattleMsg(`Tiger #${t.id} hits back for ${dmg}.`);
  updateBattleButtons();
  updateAttackButton();
  renderBattleStatus();
  return dmg;
}

function combatTick(){
  if(!S.inBattle) return;
  if(S._protectTicks>0) S._protectTicks--;

  const t = activeTiger();
  if(!t || !t.alive){
    endBattle();
    return;
  }

  S.lockedTigerId = t.id;
  t.aggroBoost = Math.max(t.aggroBoost || 0, 0.95);

  const d = dist(S.me.x, S.me.y, t.x, t.y);
  if(d > 260){
    toast("Target broke contact. Re-engage when closer.");
    endBattle("RETREAT");
    return;
  }

  if(d < 96 && Date.now() >= (S._combatTigerAttackAt || 0)){
    S._combatTigerAttackAt = Date.now() + rand(900, 1300);
    tigerTurn(t, S._protectTicks > 0);
  }
}

// ===================== MISSION COMPLETE =====================
function checkMissionComplete(){
  if(S.mode==="Survival") return;
  if(S.gameOver) return;

  const tAlive = S.tigers.some(t=>t.alive);
  const civAlive = S.civilians.filter(c=>c.alive).length;
  const civEvac = S.civilians.filter(c=>c.alive && c.evac).length;

  if(!tAlive && (civAlive===0 || civEvac===civAlive)){
    if(!S.missionEnded){
      S.missionEnded=true;
      setPaused(true,"complete");
      if(S._underAttack===0) unlockAchv("clear_clean","Clean Clear");
      document.getElementById("completeText").innerText =
        `Mission complete!\n• Tigers Killed: ${S.stats.kills}\n• Tigers Captured: ${S.stats.captures}\n• Civilians Evacuated: ${S.stats.evac}\n• Cash Earned: $${S.stats.cashEarned.toLocaleString()}\n• Shots Fired: ${S.stats.shots}\n\nYou can Shop/Inventory and then start next mission.`;
      document.getElementById("completeOverlay").style.display="flex";
      addXP(120);
      sfx("win"); hapticNotif("success");
      save();
    }
  }
}

// ===================== ENGAGE / HUD =====================
function updateEngage(){
  const disabled = S.inBattle || !canEngage() || S.paused || S.missionEnded || S.gameOver || !tutorialAllows("engage");
  document.querySelectorAll("[data-engage-btn]").forEach((btn)=>{
    btn.disabled = disabled;
  });
}

function renderHUD(){
  // clear event text if expired
  if(S.eventTextUntil && Date.now()>S.eventTextUntil) S.eventText="";

  document.getElementById("soundLbl").innerText = S.soundOn ? "On" : "Off";
  const soundLblMobile = document.getElementById("soundLblMobile");
  if(soundLblMobile) soundLblMobile.innerText = S.soundOn ? "On" : "Off";
  const pauseLblMobile = document.getElementById("pauseLblMobile");
  if(pauseLblMobile) pauseLblMobile.innerText = S.paused ? "Resume" : "Pause";
  document.getElementById("livesTxt").innerText = S.lives;

  document.getElementById("titleTxt").innerText = S.title || "Rookie";
  document.getElementById("achvTxt").innerText = `${achvCount()}`;

  document.getElementById("hpTxt").innerText = Math.round(S.hp);
  document.getElementById("armorTxt").innerText = Math.round(S.armor);
  document.getElementById("stamTxt").innerText = Math.round(S.stamina);

  document.getElementById("hpBar").style.width = `${S.hp}%`;
  document.getElementById("armorBar").style.width = `${(S.armor/S.armorCap)*100}%`;

  document.getElementById("fundsTxt").innerText = S.funds.toLocaleString();
  document.getElementById("scoreTxt").innerText = S.score.toLocaleString();

  if(S.mode==="Survival"){
    if(!S.survivalStart) S.survivalStart=Date.now();
    S.surviveSeconds = Math.floor((Date.now()-S.survivalStart)/1000);
    document.getElementById("surviveTxt").innerText = S.surviveSeconds+"s";
  } else {
    document.getElementById("surviveTxt").innerText = "—";
  }

  const w=equippedWeapon();
  document.getElementById("weaponTxt").innerText = w.name;
  document.getElementById("durTxt").innerText = Math.round(weaponDurability(w.id));
  document.getElementById("ammoTxt").innerText = `${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[w.ammo]||0})`;
  document.getElementById("medTxt").innerText = totalMedkits();
  document.getElementById("repTxt").innerText = totalRepairKits();
  document.getElementById("trapTxt").innerText = S.trapsOwned;

  const backupStr = (S.backupActive>0) ? `ACTIVE (${Math.ceil(S.backupActive/60)}s)` : (S.backupCooldown>0 ? `Cooldown (${Math.ceil(S.backupCooldown/60)}s)` : "Ready");
  document.getElementById("backupTxt").innerText = backupStr;

  document.getElementById("mapTxt").innerText = currentMap().name;

  let modeLabel=S.mode, lvl="—";
  if(S.mode==="Story"){ modeLabel="Story"; lvl=S.storyLevel; }
  if(S.mode==="Arcade"){ modeLabel="Arcade"; lvl=S.arcadeLevel; }
  if(S.mode==="Survival"){ modeLabel="Survival"; lvl=S.survivalWave; }
  document.getElementById("modeTxt").innerText = modeLabel;
  document.getElementById("lvlTxt").innerText = lvl;

  const t=currentTargetTiger();
  document.getElementById("tigerTxt").innerText = t ? `${Math.round(t.hp)}/${Math.round(t.hpMax)} (${t.type})` : "—";
  document.getElementById("tigerBar").style.width = t ? `${(t.hp/t.hpMax)*100}%` : "0%";

  const civAlive = (S.mode==="Survival") ? "—" : `${S.civilians.filter(c=>c.alive).length}/${S.civilians.length||0}`;
  document.getElementById("civTxt").innerText = civAlive;
  document.getElementById("evacTxt").innerText = (S.mode==="Survival") ? "—" : `${S.evacDone}/${S.civilians.length||0}`;

  document.getElementById("tleftTxt").innerText = S.tigers.filter(t=>t.alive).length;
  document.getElementById("threatTxt").innerText = (S.mode==="Survival") ? "Pressure" : (S._underAttack ? `${S._underAttack} attacks` : "Low");

  const grace = (S.mode!=="Survival" && Date.now() < (S.civGraceUntil||0)) ? " • Civ Grace" : "";
  document.getElementById("objTxt").innerText =
    (S.mode==="Survival")
      ? `Objective: Survive • Loot spawns • Traps hold tigers • Carcasses block movement`
      : `Objective: Evacuate living civilians + clear ALL tigers${grace}`;

  // danger ping
  if(S.dangerCivId && S.mode!=="Survival"){
    const civ = S.civilians.find(c=>c.id===S.dangerCivId);
    const d = civ ? Math.round(dist(S.me.x,S.me.y,civ.x,civ.y)) : null;
    document.getElementById("dangerTxt").innerText = civ ? `⚠️ Civilian #${civ.id} under attack near ${civ.rescueLabel || "the rescue site"}! Distance: ${d}` : "";
  } else {
    document.getElementById("dangerTxt").innerText = "";
  }

  const assistParts = [];
  if(S.mode!=="Survival"){
    const civTargets = S.civilians.filter(c=>c.alive && !c.evac);
    if(civTargets.length){
      let nearestCiv = civTargets[0];
      let nearestCivDist = dist(S.me.x,S.me.y,nearestCiv.x,nearestCiv.y);
      for(const civ of civTargets){
        const d = dist(S.me.x,S.me.y,civ.x,civ.y);
        if(d < nearestCivDist){
          nearestCiv = civ;
          nearestCivDist = d;
        }
      }
      const evacDist = Math.round(dist(S.me.x,S.me.y,S.evacZone.x,S.evacZone.y));
      assistParts.push(`Nearest civilian: #${nearestCiv.id} at ${nearestCiv.rescueLabel || "site"} (${Math.round(nearestCivDist)}m)`);
      assistParts.push(`Evac zone: ${evacDist}m`);
    }
  }

  if(t){
    const tigerDist = Math.round(dist(S.me.x,S.me.y,t.x,t.y));
    assistParts.unshift(`Tiger #${t.id}: ${tigerDist}m${canEngage() ? " • Engage ready" : ""}`);
  }

  if(S.pickups?.length){
    let nearestPickup = S.pickups[0];
    let nearestPickupDist = dist(S.me.x,S.me.y,nearestPickup.x,nearestPickup.y);
    for(const pickup of S.pickups){
      const d = dist(S.me.x,S.me.y,pickup.x,pickup.y);
      if(d < nearestPickupDist){
        nearestPickup = pickup;
        nearestPickupDist = d;
      }
    }
    assistParts.push(`${pickupLabel(nearestPickup.type)} pickup: ${Math.round(nearestPickupDist)}m`);
  }

  if(!anyWeaponHasAmmo()) assistParts.unshift("Out of ammo. Visit Shop before the next fight.");
  else if(S.mag.loaded<=0 && equippedWeaponHasAmmoNow()) assistParts.unshift("Magazine empty. Attack reloads or switch weapons.");
  if(S.stamina < 20) assistParts.push("Low stamina");

  document.getElementById("assistTxt").innerText = assistParts.slice(0,3).join(" • ") || "Sweep the map, scan, and keep pressure off civilians.";
  document.getElementById("eventTxt").innerText = S.eventText ? `EVENT: ${S.eventText}` : "";

  const mobilePlayerHpValue = document.getElementById("mobilePlayerHpValue");
  const mobilePlayerHpBar = document.getElementById("mobilePlayerHpBar");
  const mobileTigerHpValue = document.getElementById("mobileTigerHpValue");
  const mobileTigerHpBar = document.getElementById("mobileTigerHpBar");
  const mobileArmorChip = document.getElementById("mobileArmorChip");
  const mobileStamChip = document.getElementById("mobileStamChip");
  const mobileAmmoChip = document.getElementById("mobileAmmoChip");
  const mobileMissionChip = document.getElementById("mobileMissionChip");
  const mobileThreatChip = document.getElementById("mobileThreatChip");
  const mobilePromptTxt = document.getElementById("mobilePromptTxt");
  if(mobilePlayerHpValue) mobilePlayerHpValue.innerText = `${Math.round(S.hp)} / 100`;
  if(mobilePlayerHpBar) mobilePlayerHpBar.style.width = `${clamp(S.hp, 0, 100)}%`;
  if(mobileTigerHpValue) mobileTigerHpValue.innerText = t ? `${Math.round(t.hp)} / ${Math.round(t.hpMax)}` : "No target";
  if(mobileTigerHpBar) mobileTigerHpBar.style.width = t ? `${clamp((t.hp/t.hpMax) * 100, 0, 100)}%` : "0%";
  if(mobileArmorChip) mobileArmorChip.innerText = `Armor ${Math.round(S.armor)}`;
  if(mobileStamChip) mobileStamChip.innerText = `Stamina ${Math.round(S.stamina)}`;
  if(mobileAmmoChip) mobileAmmoChip.innerText = `Ammo ${S.mag.loaded}/${S.mag.cap}`;
  if(mobileMissionChip){
    mobileMissionChip.innerText =
      S.mode==="Survival"
        ? `Wave ${S.survivalWave}`
        : `Evac ${S.evacDone}/${S.civilians.length||0} • Tigers ${S.tigers.filter(tiger=>tiger.alive).length}`;
  }
  if(mobileThreatChip){
    const threatText = S.mode==="Survival" ? "Pressure High" : (S._underAttack ? `Threat ${S._underAttack} attack` : "Threat Low");
    mobileThreatChip.innerText = threatText;
  }
  if(mobilePromptTxt){
    let mobilePrompt =
      S.mode==="Survival"
        ? "Stay moving, manage ammo, and survive the pressure."
        : "Protect civilians, reach the evac zone, and clear every tiger.";
    if(S.dangerCivId){
      const civ = S.civilians.find(c=>c.id===S.dangerCivId);
      mobilePrompt = civ ? `Civilian #${civ.id} is under attack. Move there now.` : mobilePrompt;
    } else if(!anyWeaponHasAmmo()){
      mobilePrompt = "Out of ammo. Open Shop before the next fight.";
    } else if(t && canEngage()){
      mobilePrompt = `Tiger #${t.id} is in range. Tap Engage when ready.`;
    } else if(t){
      mobilePrompt = `Tiger #${t.id} locked. Close the distance and stay ready.`;
    } else if(window.TigerTutorial?.isRunning){
      mobilePrompt = assistParts[0] || "Follow the tutorial prompt and stay on the map.";
    } else if(S.missionEnded){
      mobilePrompt = "Mission complete. Shop, inventory, or start the next mission.";
    }
    mobilePromptTxt.innerText = mobilePrompt;
  }

  document.getElementById("statusLine").innerText =
    S.inBattle
      ? (S.battleMsg || `On-map combat active. Use Attack, Capture, Kill, and weapon swap while Tiger #${S.activeTigerId} stays locked.`)
      : (window.matchMedia?.("(pointer:fine)")?.matches
          ? "Desktop: click to move or lock. WASD/arrow keys move. Q locks nearest tiger. Space scans. E engages. Shift sprints."
          : "Agent and Mission stay above the map. Use the joystick on the map to move, then use the on-map buttons for deploy, scan, engage, gear, and combat.");
  renderCombatControls();
}

function maybeRenderHUD(force=false){
  const now = performance.now ? performance.now() : Date.now();
  if(force || (now - __lastHudRender) >= 120){
    __lastHudRender = now;
    renderHUD();
  }
}

// ===================== CALM MAPS + FOG (no flashing) =====================
function drawMapScene(){
  const w=cv.width, h=cv.height;
  const key=currentMap().key;

  function fillSolid(color){ ctx.fillStyle=color; ctx.fillRect(0,0,w,h); }
  function rounded(x,y,ww,hh,r,fill,stroke=null){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+ww,y,x+ww,y+hh,r);
    ctx.arcTo(x+ww,y+hh,x,y+hh,r);
    ctx.arcTo(x,y+hh,x,y,r);
    ctx.arcTo(x,y,x+ww,y,r);
    ctx.closePath();
    ctx.fillStyle=fill; ctx.fill();
    if(stroke){ ctx.strokeStyle=stroke; ctx.lineWidth=2; ctx.stroke(); }
  }
  function roadLine(points,width,fill){
    ctx.strokeStyle=fill; ctx.lineWidth=width; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.stroke();
  }
  function dashed(points){
    ctx.strokeStyle="rgba(240,240,245,.7)";
    ctx.lineWidth=4; ctx.setLineDash([18,14]); ctx.lineCap="round";
    ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function treeDot(x,y){
    ctx.fillStyle="rgba(22,120,60,.85)";
    ctx.beginPath(); ctx.arc(x,y,8,0,Math.PI*2); ctx.fill();
  }
  function buildingBlock(x,y,ww,hh){
    rounded(x-ww/2,y-hh/2,ww,hh,10,"rgba(55,70,95,.85)","rgba(18,24,38,.9)");
  }
  function houseBlock(x,y){
    rounded(x-18,y-12,36,24,8,"rgba(190,180,160,.8)","rgba(60,55,50,.9)");
  }
  function crateBlock(x,y){
    rounded(x-12,y-10,24,20,6,"rgba(140,90,45,.85)","rgba(70,40,20,.85)");
  }

  if(key==="ST_FOREST" || key==="AR_SAND_YARD" || key==="SV_NIGHT_WOODS"){
    fillSolid("#0f2b1c");
    const upperRoad = h * 0.18;
    const midRoad = h * 0.43;
    const lowRoad = h * 0.72;
    roadLine([[0,upperRoad],[240,upperRoad + 70],[470,upperRoad + 28],[720,upperRoad + 92],[960,upperRoad + 52]], 48, "rgba(80,60,38,.85)");
    roadLine([[60,midRoad],[260,midRoad - 40],[450,midRoad - 10],[610,midRoad - 70],[820,midRoad - 40],[940,midRoad - 100]], 62, "rgba(90,70,45,.85)");
    roadLine([[50,lowRoad],[260,lowRoad - 34],[450,lowRoad - 8],[610,lowRoad - 58],[820,lowRoad - 26],[940,lowRoad - 82]], 56, "rgba(84,66,42,.82)");
    const trees = [
      [90,h*0.08],[140,h*0.11],[210,h*0.08],[300,h*0.13],[360,h*0.08],[420,h*0.14],[520,h*0.10],[610,h*0.13],[700,h*0.09],[780,h*0.14],[880,h*0.11],
      [120,h*0.24],[200,h*0.26],[280,h*0.24],[360,h*0.27],[440,h*0.24],[520,h*0.27],[600,h*0.24],[700,h*0.26],[820,h*0.24],
      [110,h*0.40],[210,h*0.39],[320,h*0.40],[420,h*0.38],[520,h*0.40],[650,h*0.39],[760,h*0.40],[880,h*0.39],
      [100,h*0.56],[200,h*0.55],[300,h*0.57],[420,h*0.54],[520,h*0.56],[650,h*0.55],[760,h*0.57],[880,h*0.56],
      [110,h*0.74],[210,h*0.72],[320,h*0.75],[420,h*0.73],[520,h*0.74],[650,h*0.72],[760,h*0.75],[880,h*0.73],
      [90,h*0.88],[170,h*0.91],[290,h*0.88],[410,h*0.90],[520,h*0.87],[660,h*0.90],[780,h*0.88],[900,h*0.91],
    ];
    for(const [x,y] of trees) treeDot(x,y);
    ctx.fillStyle="rgba(25,90,105,.65)";
    ctx.beginPath(); ctx.ellipse(260,h*0.17,90,34,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(720,h*0.15,85,30,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(220,h*0.80,96,42,0,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(760,h*0.66,80,28,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="rgba(10,60,80,.7)"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(260,h*0.17,90,34,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(720,h*0.15,85,30,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(220,h*0.80,96,42,0,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(760,h*0.66,80,28,0,0,Math.PI*2); ctx.stroke();
  }
  else if(key==="ST_SUBURBS" || key==="AR_ARENA_BAY" || key==="SV_ASH_FIELD"){
    fillSolid("#18402a");
    const main=[[0,280],[240,270],[480,300],[720,280],[960,300]];
    roadLine(main, 84, "rgba(75,78,86,.9)");
    dashed(main);
    roadLine([[120,120],[420,110],[760,120]], 62, "rgba(75,78,86,.9)");
    roadLine([[120,440],[420,430],[760,440]], 62, "rgba(75,78,86,.9)");
    const houses = [
      [120,95],[240,95],[360,95],[480,95],[600,95],[720,95],[840,95],
      [160,170],[300,170],[440,170],[580,170],[720,170],[860,170],
      [140,360],[280,360],[420,360],[560,360],[700,360],[840,360],
      [120,450],[240,450],[360,450],[480,450],[600,450],[720,450],[840,450],
    ];
    for(const [x,y] of houses) houseBlock(x,y);
    rounded(120,210,170,90,18,"rgba(40,140,70,.75)","rgba(10,60,30,.8)");
    rounded(670,320,170,90,18,"rgba(40,140,70,.75)","rgba(10,60,30,.8)");
    const trees = [[70,200],[90,240],[110,260],[930,220],[900,250],[880,280],[70,520],[930,520]];
    for(const [x,y] of trees) treeDot(x,y);
  }
  else if(key==="ST_DOWNTOWN" || key==="AR_NEON_GRID" || key==="SV_STORM_DISTRICT"){
    fillSolid("#1a1f2d");
    ctx.fillStyle="rgba(70,72,80,.95)";
    for(let x=80; x<w; x+=170) ctx.fillRect(x-46,0,92,h);
    for(let y=80; y<h; y+=150) ctx.fillRect(0,y-42,w,84);
    const blocks = [
      [150,140,90,80],[320,150,80,70],[520,140,100,80],[720,150,80,75],[880,140,80,70],
      [180,310,100,85],[360,320,90,80],[560,310,110,85],[760,320,90,80],[900,310,80,75],
      [150,470,90,70],[340,470,90,70],[540,470,100,70],[740,470,90,70],[900,470,80,70],
    ];
    for(const [x,y,ww,hh] of blocks) buildingBlock(x,y,ww,hh);
    ctx.fillStyle="rgba(240,240,245,.75)";
    for(let i=0;i<8;i++){
      const cx=120+i*100;
      for(let k=0;k<7;k++) ctx.fillRect(cx+k*9, 270, 5, 18);
    }
  }
  else {
    fillSolid("#2b2b30");
    rounded(90,90,260,130,16,"rgba(70,70,76,.95)","rgba(20,20,22,.95)");
    rounded(610,110,260,110,16,"rgba(70,70,76,.95)","rgba(20,20,22,.95)");
    rounded(240,340,340,140,16,"rgba(70,70,76,.95)","rgba(20,20,22,.95)");
    ctx.strokeStyle="rgba(240,190,55,.55)";
    ctx.lineWidth=6;
    for(let k=0;k<260;k+=18){
      ctx.beginPath(); ctx.moveTo(90+k,90); ctx.lineTo(90+k-45,220); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(610+k,110); ctx.lineTo(610+k-45,220); ctx.stroke();
    }
    buildingBlock(170,260,140,90);
    buildingBlock(520,260,160,90);
    buildingBlock(820,300,150,90);
    const crates=[[110,480],[150,500],[190,470],[760,470],[800,500],[840,480],[520,500],[560,480]];
    for(const [x,y] of crates) crateBlock(x,y);
  }

  if(S.mode!=="Survival"){
    ctx.globalAlpha=0.9;
    ctx.strokeStyle="rgba(74,222,128,.55)";
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(S.evacZone.x,S.evacZone.y,S.evacZone.r,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle="rgba(74,222,128,.10)";
    ctx.beginPath(); ctx.arc(S.evacZone.x,S.evacZone.y,S.evacZone.r,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  for(const tr of S.trapsPlaced){
    ctx.globalAlpha=0.75;
    ctx.strokeStyle="rgba(58,120,255,.55)";
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(tr.x,tr.y,tr.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;
  }

  if(S.scanPing>0){
    S.scanPing--;
    const t=currentTargetTiger();
    if(t){
      const r=40+(140-S.scanPing)*1.3;
      ctx.globalAlpha=Math.max(0,S.scanPing/260);
      ctx.strokeStyle="rgba(245,158,11,.18)";
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(t.x,t.y,r,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
  }

  if(Date.now() < (S.fogUntil||0)){
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0,0,w,h);
    ctx.globalAlpha = 1;
  }
}

// ===================== DRAW ENTITIES =====================
function roundedRectFill(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fill();
}
function drawCarcass(x,y){
  ctx.globalAlpha=0.55;
  ctx.fillStyle="rgba(180,40,60,.65)";
  roundedRectFill(x-14,y-8,28,16,8);
  ctx.globalAlpha=1;
}
function drawDangerMarker(x,y){
  ctx.save();
  ctx.globalAlpha=0.95;
  ctx.fillStyle="rgba(251,113,133,.95)";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x-10, y+18);
  ctx.lineTo(x+10, y+18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle="rgba(11,13,18,.9)";
  ctx.font="900 14px system-ui";
  ctx.fillText("!", x-3.5, y+15);
  ctx.restore();
}

function drawRescueSite(site){
  ctx.save();
  const palette = {
    trail: ["rgba(96,165,250,.20)", "rgba(96,165,250,.85)"],
    park: ["rgba(74,222,128,.18)", "rgba(74,222,128,.88)"],
    car: ["rgba(251,191,36,.20)", "rgba(251,191,36,.88)"],
    truck: ["rgba(248,113,113,.20)", "rgba(248,113,113,.88)"],
    house: ["rgba(244,114,182,.18)", "rgba(244,114,182,.88)"],
    cabin: ["rgba(245,158,11,.18)", "rgba(245,158,11,.88)"],
    building: ["rgba(167,139,250,.18)", "rgba(167,139,250,.88)"],
  };
  const [fill, stroke] = palette[site.kind] || palette.trail;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(site.x, site.y, site.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(site.x, site.y, site.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = stroke;

  if(site.kind==="car"){
    roundedRectFill(site.x - 16, site.y - 9, 32, 18, 7);
  } else if(site.kind==="truck"){
    roundedRectFill(site.x - 24, site.y - 10, 38, 20, 6);
    roundedRectFill(site.x + 10, site.y - 6, 12, 12, 4);
  } else if(site.kind==="house" || site.kind==="cabin"){
    roundedRectFill(site.x - 15, site.y - 10, 30, 22, 6);
    ctx.fillStyle = "rgba(90,50,35,.9)";
    ctx.beginPath();
    ctx.moveTo(site.x - 18, site.y - 10);
    ctx.lineTo(site.x, site.y - 26);
    ctx.lineTo(site.x + 18, site.y - 10);
    ctx.closePath();
    ctx.fill();
  } else if(site.kind==="building"){
    roundedRectFill(site.x - 17, site.y - 18, 34, 36, 6);
    ctx.fillStyle = "rgba(230,235,245,.45)";
    for(let row=0; row<3; row++){
      for(let col=0; col<2; col++){
        ctx.fillRect(site.x - 10 + col * 10, site.y - 11 + row * 10, 5, 6);
      }
    }
  } else if(site.kind==="park"){
    ctx.fillStyle = "rgba(24,100,58,.92)";
    ctx.beginPath();
    ctx.arc(site.x, site.y - 6, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(85,55,30,.95)";
    ctx.fillRect(site.x - 3, site.y + 4, 6, 16);
  } else {
    ctx.fillStyle = "rgba(231,245,255,.90)";
    ctx.fillRect(site.x - 3, site.y - 18, 6, 26);
    ctx.beginPath();
    ctx.moveTo(site.x + 3, site.y - 18);
    ctx.lineTo(site.x + 16, site.y - 10);
    ctx.lineTo(site.x + 3, site.y - 4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.globalAlpha = 0.94;
  ctx.fillStyle = "rgba(245,247,255,.9)";
  ctx.font = "900 11px system-ui";
  ctx.fillText(site.label, site.x - Math.min(40, site.label.length * 2.8), site.y + site.r + 14);
  ctx.restore();
}

function drawPickup(p){
  const color = (p.type==="CASH") ? "rgba(74,222,128,.95)"
    : (p.type==="AMMO") ? "rgba(58,120,255,.95)"
    : (p.type==="ARMOR") ? "rgba(245,158,11,.95)"
    : (p.type==="MED") ? "rgba(251,113,133,.95)"
    : (p.type==="TRAP") ? "rgba(167,139,250,.95)"
    : "rgba(240,240,245,.95)";

  ctx.globalAlpha=0.95;
  ctx.fillStyle=color;
  ctx.beginPath(); ctx.arc(p.x,p.y,9,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(11,13,18,.9)";
  ctx.font="900 10px system-ui";
  const letter = (p.type==="CASH")?"$":(p.type==="AMMO")?"A":(p.type==="ARMOR")?"S":(p.type==="MED")?"+":(p.type==="TRAP")?"T":"C";
  ctx.fillText(letter, p.x-3.2, p.y+3.5);
  ctx.globalAlpha=1;
}

function drawCivilian(c){
  ctx.fillStyle=c.shirt;
  roundedRectFill(c.x-9, c.y-12, 18, 24, 6);
  ctx.fillStyle=c.pants;
  roundedRectFill(c.x-9, c.y+10, 18, 10, 4);
  ctx.fillStyle=c.skin;
  ctx.beginPath(); ctx.arc(c.x, c.y-18, 8.5, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle="rgba(20,20,22,.75)";
  if(c.hair===0){
    ctx.beginPath(); ctx.arc(c.x, c.y-21, 7, Math.PI, Math.PI*2); ctx.fill();
  } else if(c.hair===1){
    roundedRectFill(c.x-7, c.y-27, 14, 6, 3);
  } else if(c.hair===2){
    ctx.beginPath(); ctx.ellipse(c.x, c.y-24, 7, 5, 0, 0, Math.PI*2); ctx.fill();
  }

  if(c.evac){
    ctx.fillStyle="rgba(74,222,128,.85)";
    ctx.beginPath(); ctx.arc(c.x, c.y-32, 4.5, 0, Math.PI*2); ctx.fill();
  }

  if(S.dangerCivId===c.id) drawDangerMarker(c.x, c.y-58);

  const pct=c.hp/c.hpMax;
  ctx.fillStyle="rgba(11,13,18,.80)";
  ctx.fillRect(c.x-22,c.y-34,44,6);
  ctx.fillStyle=pct>0.5?"#4ade80":(pct>0.2?"#f59e0b":"#fb7185");
  ctx.fillRect(c.x-22,c.y-34,44*pct,6);
}

function drawSoldier(){
  const bob = Math.sin(S.me.step)*1.5;
  const x=S.me.x, y=S.me.y + bob;

  ctx.globalAlpha=0.25; ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(x,y+18,18,8,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  ctx.fillStyle="rgba(40,50,60,.95)";
  roundedRectFill(x-10, y-16, 20, 26, 7);
  ctx.fillStyle="rgba(20,30,40,.95)";
  roundedRectFill(x-8, y-12, 16, 18, 6);

  ctx.fillStyle="rgba(55,65,75,.95)";
  ctx.beginPath(); ctx.arc(x, y-24, 9.5, Math.PI, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(35,45,55,.95)";
  roundedRectFill(x-10, y-24, 20, 6, 3);

  ctx.fillStyle="rgba(220,220,225,.90)";
  ctx.beginPath(); ctx.arc(x, y-20, 6.5, 0, Math.PI*2); ctx.fill();

  const ang = S.me.face || 0;
  const wx = x + Math.cos(ang)*12;
  const wy = y + Math.sin(ang)*12;

  ctx.strokeStyle="rgba(30,30,34,.95)";
  ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(x+Math.cos(ang)*6, y+Math.sin(ang)*2); ctx.lineTo(wx, wy); ctx.stroke();

  ctx.fillStyle="rgba(245,158,11,.90)";
  ctx.beginPath(); ctx.arc(wx, wy, 2.3, 0, Math.PI*2); ctx.fill();
}

function drawSupportUnit(unit){
  const bob = Math.sin(unit.step || 0) * 1.2;
  const x = unit.x;
  const y = unit.y + bob;

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y + 18, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(30,68,92,.95)";
  roundedRectFill(x - 9, y - 15, 18, 24, 6);
  ctx.fillStyle = "rgba(52,211,153,.88)";
  roundedRectFill(x - 7, y - 10, 14, 11, 4);
  ctx.fillStyle = "rgba(220,220,225,.92)";
  ctx.beginPath();
  ctx.arc(x, y - 18, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(26,36,49,.96)";
  ctx.fillRect(x - 9, y - 25, 18, 5);

  const ang = unit.face || 0;
  ctx.strokeStyle = "rgba(210,240,255,.88)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x + Math.cos(ang) * 11, y + Math.sin(ang) * 11);
  ctx.stroke();

  ctx.fillStyle = "rgba(245,247,255,.78)";
  ctx.font = "900 10px system-ui";
  ctx.fillText(unit.name, x - Math.min(26, unit.name.length * 2.2), y - 28);
}

function tigerColors(type){
  if(type==="Scout") return { body:"#f7b24a", stripe:"#1c1917", belly:"#ffd9a3" };
  if(type==="Standard") return { body:"#f59e0b", stripe:"#111827", belly:"#ffd6a1" };
  if(type==="Stalker") return { body:"#c77c2f", stripe:"#0b0d12", belly:"#d9b18a" };
  if(type==="Berserker") return { body:"#f08a24", stripe:"#111827", belly:"#ffd1a1" };
  return { body:"#f59e0b", stripe:"#111827", belly:"#ffd6a1" };
}

function drawTiger(t){
  let alpha=1.0;

  // Fog reduces visibility
  if(Date.now() < (S.fogUntil||0)) alpha *= 0.75;

  // Stalker fade
  if(t.type==="Stalker" && Date.now() < (t.fadeUntil||0)){
    alpha *= 0.35;
  } else if(t.type==="Stalker"){
    const near=dist(t.x,t.y,S.me.x,S.me.y) < 180;
    alpha *= near ? 0.85 : 0.55;
  }

  const c=tigerColors(t.type);
  const bob = Math.sin(t.step||0)*1.2;
  const x=t.x, y=t.y + bob;
  let s=1.0;
  if(t.type==="Scout") s=0.85;
  if(t.type==="Alpha") s=1.22;
  if(t.type==="Berserker") s=1.10;

  // Rage glow
  if(t.type==="Berserker" && (t.hp/t.hpMax)<0.35){
    ctx.globalAlpha=0.18*alpha;
    ctx.strokeStyle="rgba(251,113,133,.95)";
    ctx.lineWidth=10;
    ctx.beginPath(); ctx.arc(x,y,34*s,0,Math.PI*2); ctx.stroke();
  }

  ctx.globalAlpha=0.25*alpha; ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(x,y+18*s,22*s,8*s,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=alpha;

  ctx.fillStyle=c.body;
  ctx.beginPath(); ctx.ellipse(x, y+2*s, 22*s, 13*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=c.belly;
  ctx.beginPath(); ctx.ellipse(x+3*s, y+6*s, 14*s, 8*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=c.body;
  ctx.beginPath(); ctx.ellipse(x+20*s, y-6*s, 12*s, 10*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+26*s, y-14*s, 4.5*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x+16*s, y-14*s, 4.5*s, 4*s, 0, 0, Math.PI*2); ctx.fill();

  ctx.strokeStyle=c.body; ctx.lineWidth=5*s;
  ctx.beginPath();
  ctx.moveTo(x-20*s, y+2*s);
  ctx.quadraticCurveTo(x-34*s, y-2*s + Math.sin((t.step||0)+1.4)*6*s, x-40*s, y-10*s);
  ctx.stroke();

  ctx.strokeStyle=c.stripe; ctx.lineWidth=3*s;
  for(let i=-2;i<=2;i++){
    ctx.beginPath();
    ctx.moveTo(x-8*s + i*6*s, y-6*s);
    ctx.lineTo(x-2*s + i*6*s, y+10*s);
    ctx.stroke();
  }

  if(t._held){
    ctx.globalAlpha=0.35;
    ctx.strokeStyle="rgba(58,120,255,.9)";
    ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(x, y, 30*s, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha=alpha;
  }

  if(S.lockedTigerId===t.id){
    ctx.strokeStyle="rgba(58,120,255,.95)";
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(x,y,30*s,0,Math.PI*2); ctx.stroke();
  }

  const pct=t.hp/t.hpMax;
  ctx.fillStyle="rgba(11,13,18,.85)";
  ctx.fillRect(x-26*s,y-34*s,52*s,6);
  ctx.fillStyle=pct>0.5?"#4ade80":(pct>0.2?"#f59e0b":"#fb7185");
  ctx.fillRect(x-26*s,y-34*s,52*s*pct,6);

  ctx.globalAlpha=0.85*alpha;
  ctx.fillStyle="rgba(245,247,255,.80)";
  ctx.font="900 12px system-ui";
  const dash = (t.type==="Scout" && Date.now()<(t.dashUntil||0)) ? " (DASH)" : "";
  const fade = (t.type==="Stalker" && Date.now()<(t.fadeUntil||0)) ? " (FADE)" : "";
  const roar = (t.type==="Alpha" && Date.now()<(t.roarUntil||0)) ? " (ROAR)" : "";
  const rage = (t.type==="Berserker" && (t.hp/t.hpMax)<0.35) ? " (RAGE)" : "";
  ctx.fillText(t.type + (t.tranqTagged?" (tranq)":"") + dash + fade + roar + rage, x-44*s, y-44*s);
  ctx.globalAlpha=1;
}

function drawEntities(){
  // carcasses block movement
  for(const c of S.carcasses) drawCarcass(c.x,c.y);

  // pickups
  for(const p of (S.pickups||[])) drawPickup(p);

  for(const site of (S.rescueSites || [])) drawRescueSite(site);

  if(S.mode!=="Survival"){
    for(const c of S.civilians){ if(c.alive) drawCivilian(c); }
  }
  for(const unit of (S.supportUnits || [])) drawSupportUnit(unit);
  for(const t of S.tigers){ if(t.alive) drawTiger(t); }
  drawSoldier();
  drawCombatFx();
}

// ===================== MISSION FLOW =====================
function closeComplete(){ document.getElementById("completeOverlay").style.display="none"; }

// ===================== MAIN LOOP =====================
function draw(){
  pollGamepadControls();
  refreshControllerUi();
  maybeRenderHUD();
  updateEngage();

  if(!(S.gameOver || S.paused || S.missionEnded)){
    regen();
    backupTick();
    trapTick();

    if(!window.TigerTutorial?.isRunning){
      tickEvents();
      maybeSpawnAmbientPickup();
      tickPickups();
    }

    roamTigers();
    supportUnitsTick();
    const usedKeyboard = keyboardMoveTick();
    if(!usedKeyboard) movePlayer();
    followCiviliansTick();
    evacCheck();
    tickCiviliansAndThreats();
    survivalPressureTick();
    combatTick();
    tickCombatFx();
    checkMissionComplete();
  }

  drawMapScene();
  drawEntities();
  maybeAutosave();
  requestAnimationFrame(draw);
}

// ===================== INIT =====================
function init(){
  if(!Array.isArray(S.ownedWeapons) || !S.ownedWeapons.length) S.ownedWeapons = [...DEFAULT.ownedWeapons];
  if(!S.equippedWeaponId || !getWeapon(S.equippedWeaponId)) S.equippedWeaponId = DEFAULT.equippedWeaponId;
  if(!S.ammoReserve || typeof S.ammoReserve !== "object") S.ammoReserve = { ...DEFAULT.ammoReserve };
  if(!S.mag || typeof S.mag !== "object") S.mag = { ...DEFAULT.mag };
  if(!Array.isArray(S.tigers)) S.tigers = [];
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.rescueSites)) S.rescueSites = [];
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  if(!S.evacZone) S.evacZone = { ...DEFAULT.evacZone };
  if(S.paused && !S.gameOver && !S.missionEnded){
    S.paused = false;
    S.pauseReason = null;
  }

  // achievements defaults
  if(!S.achievements) S.achievements={};
  updateTitle();

  for(const wid of S.ownedWeapons){
    if(S.durability[wid]==null) S.durability[wid]=100;
  }

  const w = equippedWeapon();
  S.mag.cap = w.mag;

  if(S.mag.loaded==null) S.mag.loaded = w.mag;
  S.mag.loaded = clamp(S.mag.loaded,0,S.mag.cap);

  if(S.mag.loaded===0) autoReloadIfNeeded(true);

  if(!S.tigers || !S.tigers.length) spawnTigers();
  if(!S.civilians) spawnCivilians();
  if(!Array.isArray(S.pickups)) S.pickups = [];

  awardDailyLogin();
  requestAnimationFrame(draw);
}

init();


// ===================== TUTORIAL ACCESS =====================
// expose live game state safely for tutorial system
window.getGameState = () => S;
window.isTutorialRunning = () => window.TigerTutorial?.isRunning === true;


// ---- Expose functions for HTML onclick + tutorial integration ----
syncWindowState();

window.toast = toast;
window.setPaused = setPaused;

// Buttons used by index.html
window.toggleSound = toggleSound;
window.openAbout = openAbout;
window.closeAbout = closeAbout;

window.openMode = openMode;
window.closeMode = closeMode;
window.setMode = setMode;

window.nextMap = nextMap;
window.togglePause = togglePause;

window.openShop = openShop;
window.closeShop = closeShop;
window.shopTab = shopTab;

window.openInventory = openInventory;
window.closeInventory = closeInventory;

window.resetGame = resetGame;
window.deploy = deploy;
window.scan = scan;
window.startCombat = startCombat;

window.useMedkit = useMedkit;
window.useRepairKit = useRepairKit;
window.placeTrap = placeTrap;
window.callBackup = callBackup;
window.sprint = sprint;

window.playerAction = playerAction;
window.endBattle = endBattle;

window.startNextMission = startNextMission;
window.restartCurrentMission = restartCurrentMission;
window.closeComplete = closeComplete;

// Shop functions that your HTML calls
window.buyWeapon = buyWeapon;
window.buyAmmo = buyAmmo;
window.buyArmor = buyArmor;
window.buyMed = buyMed;
window.buyTool = buyTool;
window.buyTrap = buyTrap;
window.awardDailyLogin = awardDailyLogin;
window.equipWeapon = equipWeapon;
window.buyPerk = buyPerk;
window.lockNearestTiger = lockNearestTiger;
