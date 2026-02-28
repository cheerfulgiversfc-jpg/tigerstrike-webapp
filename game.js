// game.js — Tiger Strike V4.3.8 (Phase 1 engine, restored)
// NOTE: This is your original full game script moved out of index.html.
// Small changes ONLY:
// 1) Expose window.S for tutorial.js
// 2) Add openTutorial() function (tutorial button)
// 3) Add IDs expected by tutorial.js: #scanBtn, #shopBtn, #invBtn are set in index.html (not here)

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

  fogUntil:0,
  eventText:"",
  eventCooldown:0,
  pickups:[],
  stats:{ shots:0, captures:0, kills:0, evac:0, cashEarned:0 },
  achievements:{},
  title:"Rookie"
};

let S = load();
window.S = S; // ✅ for tutorial.js access

let lastOverlay = null;

const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

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
    m.achievements = saved.achievements || {};
    m.stats = { ...DEFAULT.stats, ...(saved.stats||{}) };
    if(m.lives==null) m.lives=3;
    m.v = 4380;
    return m;
  }catch(e){ return structuredClone(DEFAULT); }
}
function save(){ localStorage.setItem("ts_v4380", JSON.stringify(S)); }

// ✅ tutorial button helper (so you can open tutorial anytime)
function openTutorial(){
  if(window.TigerTutorial?.start) window.TigerTutorial.start();
  else toast("Tutorial system not loaded.");
}
window.openTutorial = openTutorial;

/* ===================== AUDIO ===================== */
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
  save(); if(S.soundOn) sfx("ui");
}

/* ===================== HELPERS ===================== */
function toast(msg){
  const t=document.getElementById("toast");
  t.innerText=msg; t.style.display="block";
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>t.style.display="none",2200);
}
function clamp(n,min,max){ return Math.max(min, Math.min(max,n)); }
function rand(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

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

/* ===================== COLLISION (carcasses) ===================== */
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

/* ===================== ACHIEVEMENTS / TITLE ===================== */
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

/* ===================== EVENTS (Story+Arcade only) ===================== */
function eventsEnabled(){ return (S.mode==="Story" || S.mode==="Arcade"); }
function setEventText(txt, seconds=6){
  S.eventText = txt;
  S.eventTextUntil = Date.now() + seconds*1000;
  save();
}
function tickEvents(){
  if(!eventsEnabled() || S.paused || S.inBattle || S.missionEnded || S.gameOver) return;

  if(S.eventCooldown>0) S.eventCooldown--;
  if(S.eventCooldown>0) return;

  S._evtTick = (S._evtTick||0)+1;
  if(S._evtTick < 180) return;
  S._evtTick = 0;

  const chance = 0.12;
  if(Math.random()>chance) return;

  const roll = Math.random();
  if(roll < 0.28){
    spawnPickup("CRATE", rand(280,880), rand(120,500));
    setEventText("📦 Supply Drop spotted!", 7);
    sfx("event"); hapticImpact("medium");
  } else if(roll < 0.52){
    spawnRogueTiger();
    setEventText("🚨 Rogue Pack entered the area!", 7);
    sfx("event"); hapticImpact("heavy");
  } else if(roll < 0.78){
    S.fogUntil = Date.now() + rand(6000, 12000);
    setEventText("🌫️ Fog rolled in — visibility reduced.", 8);
    sfx("event");
  } else {
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

  S.eventCooldown = 900;
  save();
}

/* ===================== PICKUPS / LOOT ===================== */
function spawnPickup(type, x, y){
  S.pickups.push({ id: Date.now()+Math.random(), type, x, y, ttl: 60*20 });
}
function maybeSpawnAmbientPickup(){
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  S._pTick=(S._pTick||0)+1;
  if(S._pTick<120) return;
  S._pTick=0;

  const baseChance = 0.22;
  if(Math.random()>baseChance) return;

  const x = rand(160, 900);
  const y = rand(90, 510);

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
    unlockAchv("pickup1","First Pickup");
    setEventText(`💵 Picked up cash +$${amt}`, 4);
    sfx("loot"); hapticImpact("light");
  }
  else if(p.type==="AMMO"){
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

/* ===================== UI: About / Pause / Mode ===================== */
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
  save();
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
  updateModeDesc(); markModeTabs(); sfx("ui"); save();
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

/* ===================== Shop / Inventory ===================== */
let currentShopTab="weapons";
function openShop(){
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
/* ===================== BUY / EQUIP ===================== */
function ensureDurability(id){
  if(S.durability[id]==null) S.durability[id]=100;
}
function setMagForWeapon(w){
  const cap = w.mag;
  const currently = S.mag.loaded||0;
  S.mag.cap = cap;
  S.mag.loaded = clamp(currently, 0, cap);
}

function buyWeapon(id){
  const w=getWeapon(id); if(!w) return;
  if(S.ownedWeapons.includes(id)) return toast("Already owned.");
  if(S.funds < w.price) return toast("Not enough funds.");
  S.funds -= w.price;
  S.ownedWeapons.push(id);
  ensureDurability(id);
  if(!S.achievements.buy1) unlockAchv("buy1","First Purchase");
  sfx("win"); hapticNotif("success");
  toast(`Purchased ${w.name}.`);
  renderShopList(); renderInventory(); updateHUD(); save();
}

function equipWeapon(id){
  if(!S.ownedWeapons.includes(id)) return toast("You don't own it.");
  const w=getWeapon(id); if(!w) return;
  S.equippedWeaponId = id;
  ensureDurability(id);
  setMagForWeapon(w);
  // auto load from reserve into mag on equip
  reloadWeapon(true);
  sfx("ui"); toast(`Equipped: ${w.name}`);
  renderShopList(); renderInventory(); updateHUD(); save();
}

function buyAmmo(id){
  const a=getAmmo(id); if(!a) return;
  const price = ammoPriceCapped(a);
  if(S.funds < price) return toast("Not enough funds.");
  S.funds -= price;
  S.ammoReserve[id] = (S.ammoReserve[id]||0) + a.pack;
  unlockAchv("ammo1","Bought Ammo");
  sfx("win"); toast(`Bought ${a.name} (+${a.pack}).`);
  renderShopList(); renderInventory(); updateHUD(); save();
}

function buyArmor(id){
  const ar=getArmor(id); if(!ar) return;
  if(S.armor >= S.armorCap) return toast("Armor already full.");
  if(S.funds < ar.price) return toast("Not enough funds.");
  S.funds -= ar.price;
  S.armorCap = ar.cap;
  S.armor = clamp(S.armor + ar.addArmor, 0, S.armorCap);
  unlockAchv("armor_buy","Armored");
  sfx("win"); toast(`Armor +${ar.addArmor}.`);
  renderShopList(); updateHUD(); save();
}

function buyMed(id){
  const m=getMed(id); if(!m) return;
  if(S.funds < m.price) return toast("Not enough funds.");
  S.funds -= m.price;
  S.medkits[id] = (S.medkits[id]||0) + 1;
  unlockAchv("med_buy","Stocked Meds");
  sfx("win"); toast(`Bought ${m.name}.`);
  renderShopList(); renderInventory(); updateHUD(); save();
}

function buyTool(id){
  const t=getTool(id); if(!t) return;
  const w=equippedWeapon();
  ensureDurability(w.id);
  if((S.durability[w.id]||100) >= 100) return toast("Weapon durability already 100%.");
  if(S.funds < t.price) return toast("Not enough funds.");
  S.funds -= t.price;
  S.repairKits[id] = (S.repairKits[id]||0) + t.qty;
  unlockAchv("tool_buy","Prepared");
  sfx("win"); toast(`Bought ${t.name}.`);
  renderShopList(); renderInventory(); updateHUD(); save();
}

function buyTrap(){
  if(S.funds < TRAP_ITEM.price) return toast("Not enough funds.");
  S.funds -= TRAP_ITEM.price;
  S.trapsOwned += 1;
  unlockAchv("trap_buy","Trap Buyer");
  sfx("win"); toast("Bought Trap.");
  renderShopList(); renderInventory(); updateHUD(); save();
}

/* ===================== INVENTORY UI ===================== */
function renderInventory(){
  document.getElementById("invMoney").innerText = S.funds.toLocaleString();

  // Weapons
  const wList = document.getElementById("invWeapons");
  wList.innerHTML = S.ownedWeapons.map(id=>{
    const w=getWeapon(id); if(!w) return "";
    ensureDurability(id);
    const dur=S.durability[id];
    const eq = (S.equippedWeaponId===id);
    return `
      <div class="item">
        <div>
          <div class="itemName">${w.name} ${eq?'<span class="tag">Equipped</span>':''} <span class="tag">${w.grade}</span></div>
          <div class="itemDesc">Ammo: ${w.ammo} • Mag: ${w.mag} • Durability: ${dur}%</div>
        </div>
        <div style="text-align:right">
          <button onclick="equipWeapon('${id}')">${eq?'Equipped':'Equip'}</button>
        </div>
      </div>`;
  }).join("");

  // Ammo
  const aList = document.getElementById("invAmmo");
  aList.innerHTML = Object.keys(S.ammoReserve).map(id=>{
    const a=getAmmo(id);
    const qty=S.ammoReserve[id]||0;
    if(!a || qty<=0) return "";
    return `
      <div class="item">
        <div>
          <div class="itemName">${a.name} <span class="tag">${a.grade}</span></div>
          <div class="itemDesc">Reserve: ${qty}</div>
        </div>
        <div style="text-align:right">
          <button class="ghost" onclick="setPreferredAmmo('${id}')">Prefer</button>
        </div>
      </div>`;
  }).join("") || `<div style="opacity:.8">No ammo in reserve.</div>`;

  // Meds
  const mList = document.getElementById("invMeds");
  mList.innerHTML = MEDS.map(m=>{
    const qty = S.medkits[m.id]||0;
    if(qty<=0) return "";
    return `
      <div class="item">
        <div>
          <div class="itemName">${m.name} <span class="tag">x${qty}</span></div>
          <div class="itemDesc">Heals +${m.heal} HP</div>
        </div>
        <div style="text-align:right">
          <button onclick="useMed('${m.id}', 'self')">Heal Self</button>
          <button class="ghost" onclick="useMed('${m.id}', 'civ')">Heal Civ</button>
        </div>
      </div>`;
  }).join("") || `<div style="opacity:.8">No med kits.</div>`;

  // Tools
  const tList = document.getElementById("invTools");
  tList.innerHTML = TOOLS.map(t=>{
    const qty = S.repairKits[t.id]||0;
    if(qty<=0) return "";
    return `
      <div class="item">
        <div>
          <div class="itemName">${t.name} <span class="tag">x${qty}</span></div>
          <div class="itemDesc">Adds +${t.add} weapon durability</div>
        </div>
        <div style="text-align:right">
          <button onclick="useRepair('${t.id}')">Use</button>
        </div>
      </div>`;
  }).join("") || `<div style="opacity:.8">No repair kits.</div>`;

  // Traps
  document.getElementById("invTraps").innerHTML = `
    <div class="item">
      <div>
        <div class="itemName">Traps <span class="tag">Owned: ${S.trapsOwned}</span></div>
        <div class="itemDesc">Place trap on map. One-time hold 3–5 seconds.</div>
      </div>
      <div style="text-align:right">
        <button onclick="placeTrap()">Place</button>
      </div>
    </div>`;
}

function setPreferredAmmo(ammoId){
  // Preferred ammo is only used if it matches currently equipped weapon ammo family
  S.preferredAmmoId = ammoId;
  toast("Preferred ammo set.");
  sfx("ui");
  save();
}

function useMed(id, target){
  const m=getMed(id); if(!m) return;
  if((S.medkits[id]||0)<=0) return toast("None left.");
  if(target==="self"){
    if(S.hp>=100) return toast("HP already full.");
    S.medkits[id]--;
    S.hp = clamp(S.hp + m.heal, 0, 100);
    toast(`Healed +${m.heal} HP.`);
    sfx("win"); hapticNotif("success");
    unlockAchv("heal1","First Aid");
  } else {
    if(S.mode==="Survival") return toast("No civilians in Survival.");
    const civ = nearestCiv();
    if(!civ) return toast("No civilian nearby.");
    if(civ.hp>=100) return toast("Civilian already full.");
    S.medkits[id]--;
    civ.hp = clamp(civ.hp + m.heal, 0, 100);
    toast(`Healed civilian +${m.heal} HP.`);
    sfx("win"); hapticNotif("success");
    unlockAchv("heal_civ","Medic to Civ");
  }
  renderInventory(); updateHUD(); save();
}

function useRepair(id){
  const t=getTool(id); if(!t) return;
  if((S.repairKits[id]||0)<=0) return toast("None left.");
  const w=equippedWeapon();
  ensureDurability(w.id);
  if(S.durability[w.id]>=100) return toast("Durability already full.");
  S.repairKits[id]--;
  S.durability[w.id]=clamp(S.durability[w.id]+t.add,0,100);
  toast(`Repaired +${t.add} durability.`);
  sfx("win"); hapticNotif("success");
  unlockAchv("repair1","Maintenance");
  renderInventory(); updateHUD(); save();
}

function placeTrap(){
  if(S.trapsOwned<=0) return toast("No traps.");
  if(S.inBattle) return toast("Can't place trap in battle.");
  // place at player location
  S.trapsOwned--;
  const hold = rand(180, 300); // 3–5 seconds in ticks (60fps-ish, but we use ~30fps)
  S.trapsPlaced.push({ id: Date.now()+Math.random(), x:S.me.x, y:S.me.y, r:28, ttl: 60*30, armed:true, holding:false, holdTicks:hold });
  toast("Trap placed.");
  sfx("trap");
  unlockAchv("trap_place","Trap Deployed");
  renderInventory(); updateHUD(); save();
}

/* ===================== GAMEPLAY: Scan / Lock / Engage ===================== */
function scan(){
  if(S.inBattle) return toast("Can't scan in battle.");
  if(S.paused) return;
  if(S.stamina < 10) return toast("Not enough stamina.");
  S.stamina -= 10;
  S.scanPing = 1;
  unlockAchv("scan1","First Scan");
  toast("Scan ping!");
  sfx("scan"); hapticImpact("light");
  save();
}

function lockTigerById(id){
  S.lockedTigerId = id;
  toast("Tiger locked.");
  sfx("ui"); save();
}

function engage(){
  if(S.inBattle) return;
  if(S.paused) return;
  const tid = S.lockedTigerId || nearestTigerId();
  if(!tid) return toast("No tiger to engage.");
  const t = S.tigers.find(x=>x.id===tid);
  if(!t) return toast("Tiger not found.");
  if(dist(S.me.x,S.me.y,t.x,t.y) > 120) return toast("Get closer to the tiger.");
  startBattle(t.id);
}

/* ===================== RELOAD / AMMO ===================== */
function preferredAmmoForWeapon(w){
  // If preferred ammo matches weapon family, use it. Else use standard of the weapon's ammo id.
  const pref = S.preferredAmmoId ? getAmmo(S.preferredAmmoId) : null;
  if(pref && pref.family && getAmmo(w.ammo)?.family === pref.family) return pref.id;
  return w.ammo;
}
function reloadWeapon(silent=false){
  const w=equippedWeapon();
  ensureDurability(w.id);
  const ammoId = preferredAmmoForWeapon(w);
  const reserve = S.ammoReserve[ammoId]||0;
  const needed = S.mag.cap - S.mag.loaded;
  if(needed<=0) return toast("Magazine already full.");
  if(reserve<=0) return toast("No reserve ammo. Buy ammo in Shop.");
  const take = Math.min(needed, reserve);
  S.mag.loaded += take;
  S.ammoReserve[ammoId] -= take;
  if(!silent){ toast(`Reloaded +${take}.`); sfx("reload"); }
  save(); updateHUD(); renderInventory();
}

function anyAmmoAvailable(){
  // Returns true if any owned weapon has reserve OR loaded ammo
  for(const wid of S.ownedWeapons){
    const w=getWeapon(wid); if(!w) continue;
    const ammoId = preferredAmmoForWeapon(w);
    const reserve = S.ammoReserve[ammoId]||0;
    if(reserve>0) return true;
    if(wid===S.equippedWeaponId && (S.mag.loaded||0)>0) return true;
  }
  return false;
}

/* ===================== TIGERS / CIVILIANS SPAWN ===================== */
function tigerBaseHP(){
  const base = 70 + (S.mode==="Arcade" ? S.arcadeLevel*6 : 0) + (S.mode==="Story" ? S.storyLevel*4 : 0) + (S.mode==="Survival" ? S.survivalWave*7 : 0);
  return base;
}

function spawnTiger(x,y){
  const ttype = TIGER_TYPES[rand(0, TIGER_TYPES.length-1)];
  const hp = Math.floor(tigerBaseHP() * ttype.hpMul);
  const t = {
    id: Date.now()+Math.random(),
    type: ttype.key,
    x, y,
    hp, hpMax: hp,
    spd: ttype.spd,
    rage: ttype.rage,
    stealth: ttype.stealth,
    civBias: ttype.civBias,
    trapped:0,
    fade:0,
    roar:0,
    targetCivId:null,
  };
  S.tigers.push(t);
  return t;
}

function spawnRogueTiger(){
  // spawn 2–3 tigers near edges
  const n = rand(2,3);
  for(let i=0;i<n;i++){
    const edge = rand(0,3);
    let x=0,y=0;
    if(edge===0){ x=rand(60,980); y=60; }
    if(edge===1){ x=980; y=rand(60,560); }
    if(edge===2){ x=rand(60,980); y=560; }
    if(edge===3){ x=60; y=rand(60,560); }
    spawnTiger(x,y);
  }
  save();
}

function spawnCivilians(){
  if(S.mode==="Survival") { S.civilians=[]; return; }

  const base = (S.mode==="Arcade") ? 4 : Math.min(7, 2 + (S.storyLevel-1));
  const n = base;

  S.civilians = [];
  for(let i=0;i<n;i++){
    S.civilians.push({
      id: Date.now()+Math.random(),
      x: rand(140, 920),
      y: rand(120, 520),
      hp: 100,
      follow:false,
      dead:false,
      scared:0,
    });
  }
}

function deploy(){
  // reset mission state but keep inventory / funds
  S.inBattle=false; S.activeTigerId=null; S.missionEnded=false; S.gameOver=false;
  S.me.x=160; S.me.y=420; S.target=null;
  S.scanPing=0; S.lockedTigerId=null;
  S.carcasses = S.carcasses || [];
  S.pickups = S.pickups || [];
  S.trapsPlaced = S.trapsPlaced || [];
  S.evacDone = 0;
  S.backupActive=0;
  S.backupCooldown = clamp(S.backupCooldown||0,0,999999);

  S.tigers = [];
  // tigers count scales
  let tigerCount = 3;
  if(S.mode==="Arcade") tigerCount = 4 + Math.floor((S.arcadeLevel-1)/2);
  if(S.mode==="Story"){
    tigerCount = 3 + Math.max(0,(S.storyLevel-7)); // after level 7, +1 tiger each
  }
  if(S.mode==="Survival"){
    tigerCount = 5 + Math.floor((S.survivalWave-1)/1.5);
  }
  tigerCount = clamp(tigerCount, 2, 14);

  for(let i=0;i<tigerCount;i++){
    spawnTiger(rand(260, 940), rand(110, 540));
  }

  spawnCivilians();

  // evac zone random-ish but safe
  S.evacZone = { x: rand(740, 920), y: rand(140, 520), r: 70 };

  updateHUD();
  save();
}
deploy();

/* ===================== CIV HELPERS ===================== */
function nearestCiv(){
  let best=null, bd=1e9;
  for(const c of S.civilians){
    if(c.dead) continue;
    const d=dist(S.me.x,S.me.y,c.x,c.y);
    if(d<bd){ bd=d; best=c; }
  }
  if(best && bd<140) return best;
  return null;
}
function civFollowTick(){
  if(S.mode==="Survival") return;
  for(const c of S.civilians){
    if(c.dead) continue;
    const d=dist(S.me.x,S.me.y,c.x,c.y);
    if(d<55) c.follow=true;
    if(c.follow){
      const dx=S.me.x-c.x, dy=S.me.y-c.y;
      const m=Math.hypot(dx,dy)||1;
      const sp=1.7;
      c.x += (dx/m)*sp;
      c.y += (dy/m)*sp;
      // evac?
      if(dist(c.x,c.y,S.evacZone.x,S.evacZone.y) < S.evacZone.r){
        c.dead=true; // removed
        S.evacDone++;
        S.stats.evac++;
        S.score += 120;
        S.funds += 200;
        toast("Civilian evacuated! +$200");
        sfx("win"); hapticNotif("success");
        unlockAchv("evac1","First Evac");
      }
    }
  }
  // remove evacuated
  S.civilians = S.civilians.filter(c=>!c.dead);
}

/* ===================== TIGER AI ===================== */
function tigerTick(){
  S._underAttack = 0;
  for(const t of S.tigers){
    // trapped hold
    if(t.trapped>0){ t.trapped--; continue; }

    // Stalker fade
    if(t.type==="Stalker"){
      if(t.fade>0) t.fade--;
      else if(Math.random()<0.007) t.fade = rand(120, 220);
    }

    // Alpha roar buff
    if(t.type==="Alpha"){
      if(t.roar>0) t.roar--;
      else if(Math.random()<0.005){
        t.roar = rand(100, 180);
        for(const o of S.tigers){
          if(o.id!==t.id && dist(o.x,o.y,t.x,t.y)<220){
            o.spd += 0.25;
            setTimeout(()=>{ o.spd = clamp(o.spd-0.25, 1.6, 4.4); }, 2000);
          }
        }
      }
    }

    // choose target
    let tx=S.me.x, ty=S.me.y;
    if(S.mode!=="Survival" && S.civilians.length){
      // bias to civs
      if(Math.random() < t.civBias){
        const c = S.civilians[rand(0, S.civilians.length-1)];
        tx=c.x; ty=c.y; t.targetCivId=c.id;
      } else t.targetCivId=null;
    }

    // move
    const dx=tx-t.x, dy=ty-t.y;
    const m=Math.hypot(dx,dy)||1;
    const sp=t.spd + (t.rage>0 ? (t.hp/t.hpMax<0.35 ? 0.45 : 0) : 0);
    const nx=t.x + (dx/m)*sp;
    const ny=t.y + (dy/m)*sp;
    tryMoveEntity(t, nx, ny, 16);

    // attack civilians
    if(S.mode!=="Survival" && t.targetCivId){
      const c = S.civilians.find(x=>x.id===t.targetCivId);
      if(c && !c.dead && dist(t.x,t.y,c.x,c.y)<20){
        c.hp -= rand(6,10);
        S._underAttack++;
        if(c.hp<=0){
          c.dead=true;
          S.lives--;
          sfx("hurt"); hapticNotif("error");
          toast("A civilian died! -1 life");
          if(S.lives<=0){ gameOver(); }
        }
      }
    }

    // Survival pressure damage
    if(S.mode==="Survival"){
      if(dist(S.me.x,S.me.y,t.x,t.y) < 52){
        S._underAttack++;
        damagePlayer(rand(2,5));
      }
    }

    // trap trigger
    for(const tr of S.trapsPlaced){
      if(!tr.armed || tr.holding) continue;
      if(dist(t.x,t.y,tr.x,tr.y) < tr.r){
        tr.holding=true;
        tr.armed=false;
        t.trapped = tr.holdTicks;
        setEventText("🪤 Tiger trapped!", 3);
        sfx("trap");
        break;
      }
    }
  }

  // cleanup traps after hold ends
  S.trapsPlaced = (S.trapsPlaced||[]).filter(tr=>{
    tr.ttl--;
    if(tr.holding){
      tr.holdTicks--;
      if(tr.holdTicks<=0) return false; // trap consumed
    }
    return tr.ttl>0;
  });
}

/* ===================== BATTLE ===================== */
function startBattle(tigerId){
  S.inBattle=true;
  S.activeTigerId=tigerId;
  S.target=null;
  setPaused(true,"battle");
  document.getElementById("battleOverlay").style.display="flex";
  updateBattleUI();
  sfx("ui");
  save();
}
function endBattle(){
  S.inBattle=false;
  S.activeTigerId=null;
  document.getElementById("battleOverlay").style.display="none";
  setPaused(false,null);
  updateHUD();
  save();
}
function getActiveTiger(){
  return S.tigers.find(t=>t.id===S.activeTigerId);
}
function battleTigerDmg(tiger, amount){
  tiger.hp -= amount;
  if(tiger.hp<0) tiger.hp=0;
}
function damagePlayer(amount){
  // armor first
  let left = amount;
  if(S.armor>0){
    const use = Math.min(S.armor, left);
    S.armor -= use;
    left -= use;
  }
  if(left>0){
    S.hp -= left;
    if(S.hp<0) S.hp=0;
  }
  updateHUD();
  if(S.hp<=0){ gameOver(); }
}

function chanceJam(w){
  ensureDurability(w.id);
  const grade = WEAPON_GRADE[w.grade] || WEAPON_GRADE.Common;
  const dur = S.durability[w.id]||100;
  const wearFactor = 1 + ((100-dur)/100)*1.8;
  const jamChance = grade.jamBase * wearFactor;
  return Math.random() < jamChance;
}

function applyWear(w){
  ensureDurability(w.id);
  const grade = WEAPON_GRADE[w.grade] || WEAPON_GRADE.Common;
  const wear = grade.wear;
  S.durability[w.id] = clamp(S.durability[w.id] - wear, 0, 100);
  if(S.durability[w.id]===0){
    toast("Weapon broke! Switch weapons.");
    sfx("jam"); hapticNotif("error");
  }
}

function attack(){
  if(!S.inBattle) return;
  const t=getActiveTiger(); if(!t) return;

  // if all weapons have no ammo, disable attacking
  if(!anyAmmoAvailable()) return toast("No ammo. Buy ammo in Shop.");

  const w=equippedWeapon();
  ensureDurability(w.id);

  if(S.durability[w.id]<=0) return toast("Weapon is broken. Switch weapons.");

  if(S.mag.loaded<=0){
    toast("Empty magazine. Reload or switch weapons.");
    sfx("ui");
    return;
  }

  if(chanceJam(w)){
    sfx("jam"); hapticNotif("warning");
    toast("Weapon jammed! Use Repair Kit or switch.");
    applyWear(w);
    save(); updateBattleUI(); return;
  }

  S.mag.loaded--;
  S.stats.shots++;
  unlockAchv("shot1","First Shot");

  const ammoObj = getAmmo(preferredAmmoForWeapon(w)) || getAmmo(w.ammo);
  const eff = AMMO_EFFECTS[ammoObj?.grade] || AMMO_EFFECTS.Standard;

  const base = rand(w.dmg[0], w.dmg[1]);
  const crit = (Math.random() < eff.crit) ? 1.6 : 1.0;

  let dmg = Math.floor(base * eff.dmgMul * crit);

  // tranq vs lethal
  if(w.type==="tranq"){
    // tranq acts as damage but “capture-ready” once low
    dmg = Math.floor(dmg * eff.tranq);
    sfx("tranq");
  } else {
    sfx("hit");
  }

  battleTigerDmg(t, dmg);
  applyWear(w);

  // tiger retaliates
  const retaliate = rand(5, 12) + Math.floor((t.hpMax-t.hp)/35);
  damagePlayer(retaliate);
  sfx("hurt");

  updateBattleUI();
  save();
}

function protect(){
  if(!S.inBattle) return;
  if(S.mode==="Survival") return toast("No civilians to protect in Survival.");
  // reduce incoming damage next hit
  S._protect = 1;
  toast("Protect stance!");
  sfx("ui");
  save();
}

function capture(){
  if(!S.inBattle) return;
  const t=getActiveTiger(); if(!t) return;
  if(t.hp > Math.floor(t.hpMax*0.22)) return toast("Tiger too strong to capture. Lower HP.");
  // capture success chance based on HP
  const p = 0.55 + (0.22 - (t.hp/t.hpMax))*1.3;
  const ok = Math.random() < clamp(p, 0.45, 0.95);
  if(ok){
    S.stats.captures++;
    S.score += 250;
    const reward = 750 + rand(0, 450);
    S.funds += reward;
    S.stats.cashEarned += reward;
    toast(`Captured! +$${reward}`);
    sfx("win"); hapticNotif("success");
    unlockAchv("cap1","First Capture");

    // remove tiger
    S.tigers = S.tigers.filter(x=>x.id!==t.id);
    endBattle();
    checkMissionComplete();
  } else {
    toast("Capture failed!");
    sfx("hurt"); hapticNotif("warning");
    // retaliation
    damagePlayer(rand(10, 18));
    updateBattleUI(); save();
  }
}

function killTiger(){
  if(!S.inBattle) return;
  const t=getActiveTiger(); if(!t) return;
  // if lethal weapon, can execute if low HP
  if(t.hp > Math.floor(t.hpMax*0.35)) return toast("Tiger is too strong to kill quickly. Lower HP.");
  S.stats.kills++;
  S.score += 150;
  const reward = 350 + rand(0, 250);
  S.funds += reward;
  S.stats.cashEarned += reward;
  toast(`Tiger killed. +$${reward}`);
  sfx("win"); hapticNotif("success");
  unlockAchv("kill1","First Kill");

  // carcass blocks movement
  S.carcasses.push({ x:t.x, y:t.y, ttl: 60*60 });
  S.tigers = S.tigers.filter(x=>x.id!==t.id);
  endBattle();
  checkMissionComplete();
}

function updateBattleUI(){
  const t=getActiveTiger();
  const hpEl=document.getElementById("bTigerHP");
  const myEl=document.getElementById("bMyHP");
  const wepEl=document.getElementById("bWeapon");
  const magEl=document.getElementById("bMag");
  const durEl=document.getElementById("bDur");
  if(!t){ hpEl.innerText="—"; }
  else hpEl.innerText = `${t.type} • ${t.hp}/${t.hpMax}`;

  myEl.innerText = `${S.hp}/100 • Armor ${S.armor}/${S.armorCap}`;
  const w=equippedWeapon(); ensureDurability(w.id);
  wepEl.innerText = `${w.name} (${w.type})`;
  magEl.innerText = `${S.mag.loaded}/${S.mag.cap}`;
  durEl.innerText = `${S.durability[w.id]||100}%`;

  // disable attack only if NO ammo anywhere
  document.getElementById("attackBtn").disabled = !anyAmmoAvailable();
}

/* ===================== MISSION COMPLETE / GAME OVER ===================== */
function checkMissionComplete(){
  if(S.missionEnded || S.gameOver) return;
  if(S.tigers.length>0) return;
  if(S.mode!=="Survival" && S.civilians.length>0){
    toast("Tigers eliminated — evacuate remaining civilians!");
    return;
  }
  missionComplete();
}

function missionComplete(){
  S.missionEnded=true;
  setPaused(true,"complete");
  document.getElementById("completeOverlay").style.display="flex";
  renderComplete();
  sfx("win"); hapticNotif("success");
  save();
}

function renderComplete(){
  const map = currentMap();
  document.getElementById("cTitle").innerText = "Mission Complete";
  document.getElementById("cMode").innerText = `${S.mode} • ${map.name}`;
  document.getElementById("cScore").innerText = S.score.toLocaleString();
  document.getElementById("cFunds").innerText = S.funds.toLocaleString();
  document.getElementById("cEvac").innerText = (S.stats.evac||0).toString();
  document.getElementById("cCaps").innerText = (S.stats.captures||0).toString();
  document.getElementById("cKills").innerText = (S.stats.kills||0).toString();
}

function nextMission(){
  if(!S.missionEnded) return;
  document.getElementById("completeOverlay").style.display="none";
  setPaused(false,null);

  if(S.mode==="Arcade") S.arcadeLevel++;
  if(S.mode==="Story") S.storyLevel++;
  if(S.mode==="Survival") S.survivalWave++;

  nextMap();
  deploy();
  toast("New mission deployed.");
  sfx("ui");
  save();
}

function gameOver(){
  if(S.gameOver) return;
  S.gameOver=true;
  setPaused(true,"gameover");
  document.getElementById("gameOverOverlay").style.display="flex";
  document.getElementById("goScore").innerText = S.score.toLocaleString();
  document.getElementById("goFunds").innerText = S.funds.toLocaleString();
  sfx("hurt"); hapticNotif("error");
  save();
}

function restart(){
  // Keep funds/inventory? Your original kept progress via save.
  // We'll do a soft restart of mission:
  document.getElementById("gameOverOverlay").style.display="none";
  S.hp=100; S.armor=20; S.lives=3;
  S.missionEnded=false; S.gameOver=false;
  setPaused(false,null);
  deploy();
  toast("Restarted.");
  sfx("ui");
  save();
}

/* ===================== BACKUP ===================== */
function callBackup(){
  if(S.inBattle) return toast("Not during battle.");
  if(S.backupCooldown>0) return toast("Backup cooling down.");
  if(S.funds < 50000) return toast("Need $50,000 for backup.");
  S.funds -= 50000;
  S.backupCooldown = 60*60; // 60s in ticks (approx)
  S.backupActive = 60*6;    // 6s freeze
  setEventText("🚁 Backup arrived — tigers frozen!", 6);
  sfx("win"); hapticNotif("success");
  unlockAchv("backup1","Called Backup");
  save(); updateHUD();
}

/* ===================== INPUT: MAP TAP ===================== */
cv.addEventListener("pointerdown", (e)=>{
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return;

  const rect=cv.getBoundingClientRect();
  const x=(e.clientX-rect.left) * (cv.width/rect.width);
  const y=(e.clientY-rect.top)  * (cv.height/rect.height);

  // tap tiger to lock (within radius)
  let hit=null, bd=28;
  for(const t of S.tigers){
    const d=dist(x,y,t.x,t.y);
    if(d<bd){ bd=d; hit=t; }
  }
  if(hit){
    lockTigerById(hit.id);
    return;
  }

  S.target = { x, y };
  sfx("ui");
  save();
});

/* ===================== BUTTON HOOKS (wired in index.html) ===================== */
window.scan = scan;
window.engage = engage;
window.togglePause = togglePause;
window.openShop = openShop;
window.closeShop = closeShop;
window.openInventory = openInventory;
window.closeInventory = closeInventory;
window.shopTab = shopTab;
window.buyWeapon = buyWeapon;
window.equipWeapon = equipWeapon;
window.buyAmmo = buyAmmo;
window.buyArmor = buyArmor;
window.buyMed = buyMed;
window.buyTool = buyTool;
window.buyTrap = buyTrap;
window.reloadWeapon = reloadWeapon;
window.attack = attack;
window.protect = protect;
window.capture = capture;
window.killTiger = killTiger;
window.callBackup = callBackup;
window.openAbout = openAbout;
window.closeAbout = closeAbout;
window.openMode = openMode;
window.closeMode = closeMode;
window.setMode = setMode;
window.nextMission = nextMission;
window.restart = restart;
window.toggleSound = toggleSound;
window.nextMap = nextMap;

/* ===================== HUD ===================== */
function updateHUD(){
  document.getElementById("hudMode").innerText = `${S.mode} • ${currentMap().name}`;
  document.getElementById("hudTitle").innerText = S.title;
  document.getElementById("hudLives").innerText = S.lives.toString();
  document.getElementById("hudFunds").innerText = S.funds.toLocaleString();
  document.getElementById("hudScore").innerText = S.score.toLocaleString();
  document.getElementById("hudTrust").innerText = S.trust.toString();
  document.getElementById("hudAggro").innerText = S.aggro.toString();
  document.getElementById("hudHP").innerText = `${S.hp}/100`;
  document.getElementById("hudArmor").innerText = `${S.armor}/${S.armorCap}`;
  document.getElementById("hudStam").innerText = `${S.stamina}/100`;
  document.getElementById("pauseLbl").innerText = S.paused ? "Resume" : "Pause";
  document.getElementById("soundLbl").innerText = S.soundOn ? "On" : "Off";
  // ammo
  const w=equippedWeapon();
  document.getElementById("hudWeapon").innerText = w.name;
  document.getElementById("hudMag").innerText = `${S.mag.loaded}/${S.mag.cap}`;
}
updateHUD();

/* ===================== RENDER LOOP ===================== */
function resize(){
  const dpr = window.devicePixelRatio||1;
  cv.width = Math.floor(cv.clientWidth*dpr);
  cv.height = Math.floor(cv.clientHeight*dpr);
}
window.addEventListener("resize", resize);
resize();

function tick(){
  if(S.gameOver) return;
  if(!S.paused && !S.inBattle && !S.missionEnded){
    // stamina regen
    S._stTick=(S._stTick||0)+1;
    if(S._stTick>=18){
      S._stTick=0;
      S.stamina = clamp(S.stamina + 1, 0, 100);
    }

    // move player
    if(S.target){
      const dx=S.target.x-S.me.x, dy=S.target.y-S.me.y;
      const m=Math.hypot(dx,dy)||1;
      const sp=3.0;
      if(m<5){ S.target=null; }
      else{
        const nx = S.me.x + (dx/m)*sp;
        const ny = S.me.y + (dy/m)*sp;
        if(tryMoveEntity(S.me, nx, ny, 12)){
          // stamina spend per movement tick
          if(S.stamina>0) S.stamina = clamp(S.stamina - 0.12, 0, 100);
        }
      }
    }

    // scan ping decay
    if(S.scanPing>0) S.scanPing = 0;

    // carcass ttl
    for(const c of (S.carcasses||[])) c.ttl--;
    S.carcasses = (S.carcasses||[]).filter(c=>c.ttl>0);

    civFollowTick();
    tigerTick();
    maybeSpawnAmbientPickup();
    tickPickups();
    tickEvents();

    if(S.backupCooldown>0) S.backupCooldown--;
    if(S.backupActive>0) S.backupActive--;

    checkMissionComplete();
    save();
    updateHUD();
  }
}

function draw(){
  const w=cv.width, h=cv.height;
  ctx.clearRect(0,0,w,h);

  // background
  ctx.fillStyle="#0b0d12";
  ctx.fillRect(0,0,w,h);

  const fog = (S.fogUntil && Date.now()<S.fogUntil);

  // grid
  ctx.globalAlpha = fog ? 0.06 : 0.10;
  ctx.strokeStyle="#94a3b8";
  for(let x=0;x<w;x+=80){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
  for(let y=0;y<h;y+=80){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
  ctx.globalAlpha=1;

  // evac zone (if not survival)
  if(S.mode!=="Survival"){
    ctx.globalAlpha= fog ? 0.28 : 0.42;
    ctx.fillStyle="#22c55e";
    ctx.beginPath(); ctx.arc(S.evacZone.x, S.evacZone.y, S.evacZone.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  // traps
  for(const tr of (S.trapsPlaced||[])){
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = tr.holding ? "#f59e0b" : "#22c55e";
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(tr.x,tr.y,tr.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=1;
  }

  // carcasses
  for(const c of (S.carcasses||[])){
    ctx.fillStyle="rgba(148,163,184,.45)";
    ctx.fillRect(c.x-14, c.y-8, 28, 16);
  }

  // pickups
  for(const p of (S.pickups||[])){
    ctx.globalAlpha=0.9;
    if(p.type==="CASH") ctx.fillStyle="#22c55e";
    else if(p.type==="AMMO") ctx.fillStyle="#60a5fa";
    else if(p.type==="ARMOR") ctx.fillStyle="#a78bfa";
    else if(p.type==="MED") ctx.fillStyle="#fb7185";
    else if(p.type==="TRAP") ctx.fillStyle="#f59e0b";
    else ctx.fillStyle="#eab308";
    ctx.beginPath(); ctx.arc(p.x,p.y,7,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  // civilians
  if(S.mode!=="Survival"){
    for(const c of S.civilians){
      ctx.fillStyle = c.follow ? "#fbbf24" : "#f1f5f9";
      ctx.beginPath(); ctx.arc(c.x,c.y,6,0,Math.PI*2); ctx.fill();
      // hp bar
      ctx.fillStyle="rgba(0,0,0,.5)";
      ctx.fillRect(c.x-10, c.y-14, 20, 3);
      ctx.fillStyle="#22c55e";
      ctx.fillRect(c.x-10, c.y-14, 20*(c.hp/100), 3);
    }
  }

  // tigers
  for(const t of S.tigers){
    let alpha = 1;
    if(t.type==="Stalker" && t.fade>0) alpha = 0.25;
    if(fog) alpha *= 0.6;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = (t.id===S.lockedTigerId) ? "#60a5fa" : "#ef4444";
    ctx.beginPath(); ctx.arc(t.x,t.y,10,0,Math.PI*2); ctx.fill();
    // hp
    ctx.fillStyle="rgba(0,0,0,.5)";
    ctx.fillRect(t.x-16, t.y-18, 32, 4);
    ctx.fillStyle="#ef4444";
    ctx.fillRect(t.x-16, t.y-18, 32*(t.hp/t.hpMax), 4);
    ctx.globalAlpha=1;
    // lock ring
    if(t.id===S.lockedTigerId){
      ctx.strokeStyle="rgba(96,165,250,.9)";
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(t.x,t.y,16,0,Math.PI*2); ctx.stroke();
    }
  }

  // player
  ctx.fillStyle="#22c55e";
  ctx.beginPath(); ctx.arc(S.me.x,S.me.y,9,0,Math.PI*2); ctx.fill();

  // target marker
  if(S.target){
    ctx.strokeStyle="rgba(148,163,184,.9)";
    ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(S.target.x,S.target.y,10,0,Math.PI*2); ctx.stroke();
  }

  // scan ping indicator (towards nearest/locked tiger)
  if(S.scanPing>0){
    const tid = S.lockedTigerId || nearestTigerId();
    const t = tid ? S.tigers.find(x=>x.id===tid) : null;
    if(t){
      ctx.strokeStyle="rgba(96,165,250,.75)";
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(S.me.x,S.me.y); ctx.lineTo(t.x,t.y); ctx.stroke();
      ctx.fillStyle="rgba(96,165,250,.9)";
      ctx.beginPath(); ctx.arc(t.x,t.y,4,0,Math.PI*2); ctx.fill();
    }
  }

  // event text
  if(S.eventText && S.eventTextUntil && Date.now() < S.eventTextUntil){
    ctx.fillStyle="rgba(0,0,0,.55)";
    ctx.fillRect(16, 16, 420, 34);
    ctx.fillStyle="#f8fafc";
    ctx.font="bold 14px system-ui";
    ctx.fillText(S.eventText, 26, 38);
  }
}

function nearestTigerId(){
  if(!S.tigers.length) return null;
  let best=S.tigers[0], bd=1e9;
  for(const t of S.tigers){
    const d=dist(S.me.x,S.me.y,t.x,t.y);
    if(d<bd){ bd=d; best=t; }
  }
  return best?.id || null;
}

setInterval(()=>{ tick(); draw(); }, 33);
 /* ===================== PHASE 2 (PART 3/3) — UI RENDER + PICKUPS + EVENTS + MAPS + FALLBACKS ===================== */
/* Paste this IMMEDIATELY after Part 2 */

/* ---------- Safe fallbacks if Part 1 didn't define these ---------- */
window.toast = window.toast || function (msg) {
  const n = document.getElementById("toast");
  if (!n) { console.log("[toast]", msg); return; }
  n.textContent = msg;
  n.style.opacity = "1";
  clearTimeout(window.__toastT);
  window.__toastT = setTimeout(()=> n.style.opacity = "0", 1600);
};

window.hapticImpact = window.hapticImpact || function(){};
window.hapticNotif  = window.hapticNotif  || function(){};

window.sfx = window.sfx || function (name) {
  if (!S.soundOn) return;
  // tiny clicky tones using WebAudio (no external files)
  try {
    const A = window.__aud || (window.__aud = new (window.AudioContext || window.webkitAudioContext)());
    const o = A.createOscillator();
    const g = A.createGain();
    o.type = "sine";
    const base = ({
      ui: 540, hit: 280, hurt: 160, win: 720, scan: 620, trap: 420, jam: 110, reload: 360, tranq: 240
    })[name] || 440;
    o.frequency.value = base;
    g.gain.value = 0.04;
    o.connect(g); g.connect(A.destination);
    o.start();
    o.stop(A.currentTime + 0.08);
  } catch {}
};

window.unlockAchv = window.unlockAchv || function(id, name){
  S.achievements = S.achievements || {};
  if (S.achievements[id]) return;
  S.achievements[id] = { at: Date.now(), name: name || id };
  window.toast(`🏆 ${name || "Achievement unlocked"}`);
};

window.save = window.save || function(){
  try { localStorage.setItem("ts_save_v1", JSON.stringify(S)); } catch {}
};

window.setEventText = window.setEventText || function(txt, seconds){
  S.eventText = txt;
  S.eventTextUntil = Date.now() + (seconds||2)*1000;
};

/* ---------- Map system (simple) ---------- */
const MAPS = window.MAPS || [
  { id:"delta",   name:"Delta Marsh",  fog:false, blocks:[] },
  { id:"mesa",    name:"Red Mesa",     fog:false, blocks:[] },
  { id:"jungle",  name:"Jungle Edge",  fog:true,  blocks:[] },
  { id:"village", name:"Old Village",  fog:false, blocks:[] },
];

window.currentMap = window.currentMap || function(){
  const idx = clamp(S.mapIndex || 0, 0, MAPS.length-1);
  return MAPS[idx];
};

window.nextMap = window.nextMap || function(){
  S.mapIndex = ((S.mapIndex||0) + 1) % MAPS.length;
  // “fog of war” style effect
  const m = currentMap();
  if(m.fog) S.fogUntil = Date.now() + 9000;
  else S.fogUntil = 0;
  updateHUD();
  save();
};

/* ---------- Collision helpers (carcasses block movement) ---------- */
window.tryMoveEntity = window.tryMoveEntity || function(ent, nx, ny, r){
  // keep inside bounds
  nx = clamp(nx, 40, 1000);
  ny = clamp(ny, 40, 580);

  // block by carcasses
  for(const c of (S.carcasses||[])){
    if(dist(nx,ny,c.x,c.y) < (r + 16)) return false;
  }

  // block by map blocks if any
  const blocks = currentMap().blocks || [];
  for(const b of blocks){
    // b = {x,y,w,h}
    if(nx > b.x-r && nx < b.x+b.w+r && ny > b.y-r && ny < b.y+b.h+r) return false;
  }

  // backup freeze effect for tigers only
  if(ent && ent.id && S.backupActive>0 && ent !== S.me && ent.hpMax) return false;

  ent.x = nx; ent.y = ny;
  return true;
};

/* ---------- Pickups (cash/ammo/armor/med/trap) ---------- */
function spawnPickup(type, x, y, data={}){
  S.pickups = S.pickups || [];
  S.pickups.push({ id: Date.now()+Math.random(), type, x, y, ttl: 60*30, ...data });
}

window.maybeSpawnAmbientPickup = window.maybeSpawnAmbientPickup || function(){
  S._puTick = (S._puTick||0) + 1;
  if(S._puTick < 120) return; // every ~4s
  S._puTick = 0;

  // small chance
  if(Math.random() > 0.22) return;

  const x = rand(120, 940);
  const y = rand(90,  550);

  const roll = Math.random();
  if(roll < 0.40) spawnPickup("CASH", x, y, { amount: rand(80, 220) });
  else if(roll < 0.62) spawnPickup("AMMO", x, y, { ammoId: preferredAmmoForWeapon(equippedWeapon()), amount: rand(8, 18) });
  else if(roll < 0.76) spawnPickup("ARMOR", x, y, { amount: rand(6, 14) });
  else if(roll < 0.90) spawnPickup("MED", x, y, { medId: "med_small" });
  else spawnPickup("TRAP", x, y, { amount: 1 });
};

window.tickPickups = window.tickPickups || function(){
  if(!S.pickups) S.pickups = [];
  for(const p of S.pickups) p.ttl--;

  // collect if close
  for(const p of S.pickups){
    if(dist(S.me.x,S.me.y,p.x,p.y) > 18) continue;

    if(p.type==="CASH"){
      const a = p.amount || 100;
      S.funds += a;
      S.score += Math.floor(a/2);
      S.stats.cashEarned += a;
      toast(`+$${a}`);
      sfx("win");
    }
    else if(p.type==="AMMO"){
      const ammoId = p.ammoId || preferredAmmoForWeapon(equippedWeapon());
      const a = p.amount || 10;
      S.ammoReserve[ammoId] = (S.ammoReserve[ammoId]||0) + a;
      toast(`Ammo +${a}`);
      sfx("reload");
    }
    else if(p.type==="ARMOR"){
      const a = p.amount || 10;
      S.armor = clamp(S.armor + a, 0, S.armorCap);
      toast(`Armor +${a}`);
      sfx("ui");
    }
    else if(p.type==="MED"){
      // add a small medkit
      S.medkits["med_small"] = (S.medkits["med_small"]||0) + 1;
      toast("Med kit +1");
      sfx("ui");
    }
    else if(p.type==="TRAP"){
      S.trapsOwned += (p.amount||1);
      toast("Trap +1");
      sfx("trap");
    }

    p.ttl = -1; // remove
  }

  S.pickups = S.pickups.filter(p=>p.ttl>0);
};

/* ---------- Events ticker ---------- */
window.tickEvents = window.tickEvents || function(){
  // simple “under attack” indicator could go here; already tracked as S._underAttack in tigerTick
};

/* ---------- Shop UI rendering (minimal, but complete) ---------- */
window.renderShopList = window.renderShopList || function(){
  const money = document.getElementById("shopMoney");
  if(money) money.textContent = S.funds.toLocaleString();

  const tab = S.shopTab || "weapons";

  const wWrap = document.getElementById("shopWeapons");
  const aWrap = document.getElementById("shopAmmo");
  const rWrap = document.getElementById("shopArmor");
  const mWrap = document.getElementById("shopMeds");
  const tWrap = document.getElementById("shopTools");
  const trWrap= document.getElementById("shopTraps");

  if(wWrap) wWrap.style.display = (tab==="weapons")?"block":"none";
  if(aWrap) aWrap.style.display = (tab==="ammo")?"block":"none";
  if(rWrap) rWrap.style.display = (tab==="armor")?"block":"none";
  if(mWrap) mWrap.style.display = (tab==="meds")?"block":"none";
  if(tWrap) tWrap.style.display = (tab==="tools")?"block":"none";
  if(trWrap)trWrap.style.display= (tab==="traps")?"block":"none";

  if(wWrap){
    wWrap.innerHTML = WEAPONS.map(w=>{
      const owned = S.ownedWeapons.includes(w.id);
      const eq = S.equippedWeaponId===w.id;
      return `
      <div class="item">
        <div>
          <div class="itemName">${w.name} <span class="tag">${w.grade}</span></div>
          <div class="itemDesc">$${w.price.toLocaleString()} • ${w.type} • ${w.ammo} • Mag ${w.mag} • Dmg ${w.dmg[0]}-${w.dmg[1]}</div>
        </div>
        <div style="text-align:right">
          ${owned
            ? `<button onclick="equipWeapon('${w.id}')">${eq?"Equipped":"Equip"}</button>`
            : `<button onclick="buyWeapon('${w.id}')">Buy</button>`
          }
        </div>
      </div>`;
    }).join("");
  }

  if(aWrap){
    aWrap.innerHTML = AMMO.map(a=>{
      const price = ammoPriceCapped(a);
      const qty = S.ammoReserve[a.id]||0;
      return `
      <div class="item">
        <div>
          <div class="itemName">${a.name} <span class="tag">${a.grade}</span></div>
          <div class="itemDesc">$${price.toLocaleString()} • Pack +${a.pack} • Reserve: ${qty}</div>
        </div>
        <div style="text-align:right">
          <button onclick="buyAmmo('${a.id}')">Buy</button>
        </div>
      </div>`;
    }).join("");
  }

  if(rWrap){
    rWrap.innerHTML = ARMOR.map(ar=>{
      return `
      <div class="item">
        <div>
          <div class="itemName">${ar.name}</div>
          <div class="itemDesc">$${ar.price.toLocaleString()} • Cap ${ar.cap} • +${ar.addArmor} now</div>
        </div>
        <div style="text-align:right">
          <button onclick="buyArmor('${ar.id}')">Buy</button>
        </div>
      </div>`;
    }).join("");
  }

  if(mWrap){
    mWrap.innerHTML = MEDS.map(m=>{
      return `
      <div class="item">
        <div>
          <div class="itemName">${m.name}</div>
          <div class="itemDesc">$${m.price.toLocaleString()} • Heal +${m.heal}</div>
        </div>
        <div style="text-align:right">
          <button onclick="buyMed('${m.id}')">Buy</button>
        </div>
      </div>`;
    }).join("");
  }

  if(tWrap){
    tWrap.innerHTML = TOOLS.map(t=>{
      return `
      <div class="item">
        <div>
          <div class="itemName">${t.name}</div>
          <div class="itemDesc">$${t.price.toLocaleString()} • Qty +${t.qty} • Repair +${t.add}</div>
        </div>
        <div style="text-align:right">
          <button onclick="buyTool('${t.id}')">Buy</button>
        </div>
      </div>`;
    }).join("");
  }

  if(trWrap){
    trWrap.innerHTML = `
      <div class="item">
        <div>
          <div class="itemName">${TRAP_ITEM.name}</div>
          <div class="itemDesc">$${TRAP_ITEM.price.toLocaleString()} • One-time hold 3–5 seconds</div>
        </div>
        <div style="text-align:right">
          <button onclick="buyTrap()">Buy</button>
        </div>
      </div>`;
  }
};

/* ---------- Shop / Inventory Overlay open/close (if Part 1 didn’t) ---------- */
window.openShop = window.openShop || function(){
  if(S.inBattle) return toast("Can't open Shop in battle.");
  document.getElementById("shopOverlay").style.display="flex";
  renderShopList();
  sfx("ui");
};
window.closeShop = window.closeShop || function(){
  document.getElementById("shopOverlay").style.display="none";
  sfx("ui");
};
window.openInventory = window.openInventory || function(){
  document.getElementById("invOverlay").style.display="flex";
  renderInventory();
  sfx("ui");
};
window.closeInventory = window.closeInventory || function(){
  document.getElementById("invOverlay").style.display="none";
  sfx("ui");
};
window.shopTab = window.shopTab || function(tab){
  S.shopTab = tab;
  renderShopList();
  save();
};

/* ---------- Mode menu / About menu (simple) ---------- */
window.openAbout = window.openAbout || function(){
  const o=document.getElementById("aboutOverlay");
  if(o) o.style.display="flex";
};
window.closeAbout = window.closeAbout || function(){
  const o=document.getElementById("aboutOverlay");
  if(o) o.style.display="none";
};
window.openMode = window.openMode || function(){
  const o=document.getElementById("modeOverlay");
  if(o) o.style.display="flex";
};
window.closeMode = window.closeMode || function(){
  const o=document.getElementById("modeOverlay");
  if(o) o.style.display="none";
};
window.setMode = window.setMode || function(mode){
  S.mode = mode;
  // reset difficulty progression for a clean start (keep inventory)
  if(mode==="Story"){ S.storyLevel = S.storyLevel||1; }
  if(mode==="Arcade"){ S.arcadeLevel = S.arcadeLevel||1; }
  if(mode==="Survival"){ S.survivalWave = S.survivalWave||1; }
  closeMode();
  deploy();
  toast(`Mode: ${mode}`);
  save();
};

/* ---------- Sound toggle (simple) ---------- */
window.toggleSound = window.toggleSound || function(){
  S.soundOn = !S.soundOn;
  updateHUD();
  save();
};

/* ---------- Final boot: ensure overlays render correct content ---------- */
(function finalizeBoot(){
  try{
    // ensure arrays exist
    S.carcasses = S.carcasses || [];
    S.pickups = S.pickups || [];
    S.trapsPlaced = S.trapsPlaced || [];
    S.ammoReserve = S.ammoReserve || {};
    S.medkits = S.medkits || {};
    S.repairKits = S.repairKits || {};
    S.achievements = S.achievements || {};

    // paint shop/inv once so UI isn't empty
    renderShopList();
    renderInventory();
    updateHUD();
    save();
  }catch(e){
    console.warn("Finalize boot warning:", e);
  }
})();
