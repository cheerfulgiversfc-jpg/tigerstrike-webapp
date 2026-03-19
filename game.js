const tg = window.Telegram?.WebApp;
const TS_BUILD = "4428";
if(tg){
  try{
    tg.expand?.();
    tg.ready?.();
    tg.setHeaderColor?.("#0b0d12");
    tg.setBackgroundColor?.("#0b0d12");
  }catch(e){
    try{ console.warn("Telegram init recovered:", e); }catch(err){}
  }
}

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

const STORAGE_VERSION = 4385;
const STORAGE_KEY = `ts_v${STORAGE_VERSION}`;
const STORAGE_FALLBACK_KEYS = ["ts_v4384", "ts_v4383", "ts_v4382", "ts_v4381", "ts_v4380", "ts_v4371"];

function cloneState(obj){
  if(typeof structuredClone === "function"){
    try{ return structuredClone(obj); }catch(e){}
  }
  return JSON.parse(JSON.stringify(obj));
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
  { id:"W_TRQ_PISTOL_MK1", name:"Tranq Pistol Mk I", grade:"Common", price:50,   type:"tranq", ammo:"TRANQ_DARTS",  mag:6,  dmg:[8,12], range:112 },
  { id:"W_9MM_JUNK",      name:"9mm Sidearm (Used)", grade:"Common", price:150, type:"lethal", ammo:"9MM_STD",      mag:12, dmg:[10,14], range:124 },
  { id:"W_SHOTGUN",       name:"Pump Shotgun", grade:"Uncommon", price:500,     type:"lethal", ammo:"12GA_STD",     mag:5,  dmg:[18,26], range:94 },
  { id:"W_TRQ_RIFLE",     name:"Tranq Rifle", grade:"Rare", price:2500,         type:"tranq", ammo:"TRANQ_DARTS",  mag:5,  dmg:[14,20], range:168 },
  { id:"W_AR_CARBINE",    name:"AR Carbine", grade:"Rare", price:6500,          type:"lethal", ammo:"556_STD",      mag:30, dmg:[14,20], range:176 },
  { id:"W_DMR",           name:"DMR Marksman", grade:"Epic", price:18000,       type:"lethal", ammo:"762_STD",      mag:10, dmg:[20,28], range:214 },
  { id:"W_TRQ_LAUNCHER",  name:"Tranquilizer Launcher", grade:"Legendary", price:50000, type:"tranq", ammo:"TRANQ_HEAVY", mag:2, dmg:[30,42], range:188 },
  { id:"W_RAIL_PROTO",    name:"Prototype Rail Rifle", grade:"Mythic", price:100000,    type:"lethal", ammo:"RAIL_CELL",   mag:3, dmg:[40,60], range:236 },
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
const STARS_CASH_PACKS = [
  { sku:"funds_50",    name:"Scout Purse", stars:50, funds:500, desc:"Convert 50 Stars into $500 in-game cash." },
  { sku:"funds_100",   name:"Supply Cache", stars:100, funds:1000, desc:"Convert 100 Stars into $1,000 in-game cash." },
  { sku:"funds_150",   name:"Rapid Reserve", stars:150, funds:1500, desc:"Convert 150 Stars into $1,500 in-game cash." },
  { sku:"funds_250",   name:"Field Treasury", stars:250, funds:2500, desc:"Convert 250 Stars into $2,500 in-game cash." },
  { sku:"funds_350",   name:"Taskforce Reserve", stars:350, funds:3500, desc:"Convert 350 Stars into $3,500 in-game cash." },
  { sku:"funds_2500",  name:"Strategic Reserve", stars:2500, funds:25000, desc:"Convert 2,500 Stars into $25,000 in-game cash." },
  { sku:"funds_5000",  name:"High Command Vault", stars:5000, funds:50000, desc:"Convert 5,000 Stars into $50,000 in-game cash." },
  { sku:"funds_10000", name:"Sovereign Treasury", stars:10000, funds:100000, desc:"Convert 10,000 Stars into $100,000 in-game cash." },
  { sku:"funds_25000", name:"National Treasury", stars:25000, funds:250000, desc:"Convert 25,000 Stars into $250,000 in-game cash." },
  { sku:"funds_35000", name:"Titan Treasury", stars:35000, funds:350000, desc:"Convert 35,000 Stars into $350,000 in-game cash." },
];
const STARS_PREMIUM_PACKS = [
  {
    sku:"premium_supply_drop",
    name:"Supply Drop",
    stars:150,
    desc:"Budget refill pack for active runs.",
    preview:"+3 Small Med Kits • +2 Med Kits • +2 Repair Kits • +3 Traps • +1 Shield",
    grant:{ medkits:{ M_SMALL:3, M_MED:2 }, repairs:{ T_REPAIR:2 }, traps:3, shields:1 },
  },
  {
    sku:"premium_arsenal_convoy",
    name:"Arsenal Convoy",
    stars:500,
    desc:"Large ammo shipment and maintenance support.",
    preview:"+260 Ammo • +1 Pro Repair • +2 Traps",
    grant:{ ammo:{ "9MM_STD":120, "556_STD":60, "762_STD":40, "TRANQ_DARTS":40 }, repairs:{ T_REPAIR_PRO:1 }, traps:2 },
  },
  {
    sku:"premium_rescue_priority",
    name:"Rescue Priority",
    stars:1000,
    desc:"Heavy mission support for survival streaks.",
    preview:"+5 Shields • +8 Traps • +3 Trauma Kits • +2 Pro Repairs",
    grant:{ shields:5, traps:8, medkits:{ M_TRAUMA:3 }, repairs:{ T_REPAIR_PRO:2 } },
  },
  {
    sku:"premium_tiger_specialist_unlock",
    name:"Tiger Specialist Unlock",
    stars:5000,
    desc:"Instant unlock + recruitment of a Tiger Specialist.",
    preview:"+1 Tiger Specialist • Unlocks Tiger Specialist purchases anytime",
    grant:{ specialists:{ attacker:1 }, specialistUnlocks:{ attacker:true } },
  },
  {
    sku:"premium_rescue_specialist_unlock",
    name:"Rescue Specialist Unlock",
    stars:5000,
    desc:"Instant unlock + recruitment of a Rescue Specialist.",
    preview:"+1 Rescue Specialist • Unlocks Rescue Specialist purchases anytime",
    grant:{ specialists:{ rescue:1 }, specialistUnlocks:{ rescue:true } },
  },
];
const CASH_SUPPLY_BUNDLES = [
  {
    id:"cash_quick_prep",
    name:"Quick Prep Bundle",
    price:3000,
    desc:"Low-cost mission prep with mixed utility.",
    preview:"+2 Shields • +4 Traps • +2 Med Kits • +1 Repair Kit",
    grant:{ shields:2, traps:4, medkits:{ M_SMALL:2 }, repairs:{ T_REPAIR:1 } },
  },
  {
    id:"cash_war_loadout",
    name:"War Loadout Bundle",
    price:15000,
    desc:"Heavy loadout for long missions and boss pushes.",
    preview:"+6 Shields • +8 Traps • +2 Trauma Kits • +2 Pro Repairs • +140 Ammo",
    grant:{ shields:6, traps:8, medkits:{ M_TRAUMA:2 }, repairs:{ T_REPAIR_PRO:2 }, ammo:{ "9MM_STD":60, "556_STD":40, "TRANQ_DARTS":40 } },
  },
];
const STARS_TOPUP_GUIDE = [
  { stars:50, label:"$0.99" },
  { stars:75, label:"$1.49" },
  { stars:100, label:"$1.99" },
  { stars:150, label:"$2.99" },
  { stars:250, label:"$4.99" },
  { stars:350, label:"$6.99" },
  { stars:500, label:"$9.99" },
  { stars:750, label:"$14.99" },
  { stars:1000, label:"$19.99" },
  { stars:1500, label:"$29.99" },
  { stars:2500, label:"$49.99" },
  { stars:5000, label:"$99.99" },
  { stars:10000, label:"$199.99" },
  { stars:25000, label:"$499.99" },
  { stars:35000, label:"$699.99" },
];
const STARS_ALL_OFFERS = [...STARS_CASH_PACKS, ...STARS_PREMIUM_PACKS];

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
  { key:"Standard",  hpMul:0.92, spd:3.00, civBias:0.42, stealth:0.00, rage:0.00 },
  { key:"Scout",     hpMul:1.02, spd:3.42, civBias:0.62, stealth:0.00, rage:0.00 },
  { key:"Stalker",   hpMul:1.12, spd:3.30, civBias:0.56, stealth:0.55, rage:0.00 },
  { key:"Berserker", hpMul:1.30, spd:3.16, civBias:0.40, stealth:0.00, rage:0.42 },
  { key:"Alpha",     hpMul:1.56, spd:3.08, civBias:0.36, stealth:0.00, rage:0.14 },
];

const TIGER_LOCOMOTION = {
  Scout: {
    walk:3.4, chase:4.8, sprint:6.2, minChase:4.2,
    detect:230, chaseAccel:0.24, wanderAccel:0.11,
    burstMs:[650,1100], pounceForce:1.75, pounceCd:[1200,2000], pounceChance:0.075
  },
  Standard: {
    walk:3.0, chase:4.2, sprint:5.6, minChase:3.9,
    detect:200, chaseAccel:0.20, wanderAccel:0.10,
    burstMs:[620,980], pounceForce:1.55, pounceCd:[1400,2400], pounceChance:0.065
  },
  Alpha: {
    walk:3.1, chase:4.3, sprint:5.7, minChase:4.0,
    detect:210, chaseAccel:0.21, wanderAccel:0.10,
    burstMs:[680,1080], pounceForce:1.65, pounceCd:[1400,2400], pounceChance:0.07
  },
  Berserker: {
    walk:3.2, chase:4.5, sprint:6.0, minChase:4.1,
    detect:205, chaseAccel:0.23, wanderAccel:0.10,
    burstMs:[700,1200], pounceForce:1.8, pounceCd:[1200,2100], pounceChance:0.085
  },
  Stalker: {
    walk:3.3, chase:4.6, sprint:6.0, minChase:4.2,
    detect:220, chaseAccel:0.22, wanderAccel:0.11,
    burstMs:[640,1020], pounceForce:1.7, pounceCd:[1300,2200], pounceChance:0.075
  }
};
const TIGER_HUNT_STATES = Object.freeze({
  PATROL: "patrol",
  STALK: "stalk",
  POUNCE: "pounce",
  RECOVER: "recover",
});
const BOSS_IDENTITY_BY_CHAPTER = Object.freeze({
  1: { name:"Pack Caller", cycle:["reinforce"], cd:[11500, 15500], reinforce:[1,1] },
  2: { name:"Blood Herald", cycle:["roar","charge"], cd:[9800, 13200] },
  3: { name:"Shadow Stalker", cycle:["stealth","pounce_chain"], cd:[9000, 12400] },
  4: { name:"Twin Fang Prime", cycle:["pounce_chain","roar"], cd:[8800, 11800] },
  5: { name:"River Breaker", cycle:["charge","reinforce"], cd:[9400, 12600], reinforce:[1,2] },
  6: { name:"Mountain Crusher", cycle:["charge","pounce_chain"], cd:[8600, 11400] },
  7: { name:"Territory Marshal", cycle:["reinforce","roar","charge"], cd:[8400, 11000], reinforce:[1,2] },
  8: { name:"Tiger King", cycle:["roar","pounce_chain","reinforce","charge"], cd:[7800, 10400], reinforce:[1,2] },
  9: { name:"Phantom Lord", cycle:["stealth","charge","pounce_chain"], cd:[7600, 10200] },
  10:{ name:"Ancient Tiger", cycle:["roar","stealth","pounce_chain","reinforce","charge"], cd:[7000, 9600], reinforce:[2,3] },
});

const TIGER_POWER_ORDER = {
  Standard: 1,
  Scout: 2,
  Stalker: 3,
  Berserker: 4,
  Alpha: 5,
};
const TIGER_DAMAGE_SCALES = {
  player: [0.88, 0.96, 1.08, 1.22, 1.38, 1.58],
  civilian: [1.00, 1.10, 1.22, 1.38, 1.62, 2.05],
  support: [0.78, 0.90, 1.05, 1.22, 1.42, 1.72],
};
const TIGER_DEFENSE_SCALES = [0.92, 0.98, 1.08, 1.18, 1.32, 1.58];

function isBossTiger(t){
  return !!(t && (t.bossPhases || 0) > 0);
}
function currentModeMission(){
  if(S.mode==="Story") return storyCampaignMission(S.storyLevel);
  if(S.mode==="Arcade") return arcadeCampaignMission(S.arcadeLevel);
  return null;
}
function bossChapterIndex(){
  const mission = currentModeMission();
  if(mission?.chapter) return clamp(mission.chapter, 1, 10);
  return chapterIndexForMode(S.mode);
}
function bossIdentityProfile(t){
  if(!isBossTiger(t)) return null;
  if(Number.isFinite(t.bossIdentityChapter) && BOSS_IDENTITY_BY_CHAPTER[t.bossIdentityChapter]){
    return BOSS_IDENTITY_BY_CHAPTER[t.bossIdentityChapter];
  }
  const chapter = bossChapterIndex();
  t.bossIdentityChapter = chapter;
  return BOSS_IDENTITY_BY_CHAPTER[chapter] || BOSS_IDENTITY_BY_CHAPTER[1];
}
function bossStealthActive(t, now=Date.now()){
  return !!(t && now < (t.bossStealthUntil || 0));
}
function triggerBossIdentitySkill(t, profile, now=Date.now()){
  if(!t || !profile) return;
  const cycle = Array.isArray(profile.cycle) && profile.cycle.length ? profile.cycle : ["roar"];
  const idx = Number.isFinite(t.bossSkillStep) ? t.bossSkillStep : 0;
  const skill = cycle[idx % cycle.length];
  t.bossSkillStep = idx + 1;

  if(skill === "roar"){
    t.roarUntil = Math.max(t.roarUntil || 0, now + rand(2500, 3600));
    t.enragedUntil = Math.max(t.enragedUntil || 0, now + rand(3200, 4700));
    setTigerIntent(t, "War Roar", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} uses War Roar.`);
  } else if(skill === "stealth"){
    t.bossStealthUntil = Math.max(t.bossStealthUntil || 0, now + rand(1700, 2600));
    t.burstUntil = Math.max(t.burstUntil || 0, (t.bossStealthUntil || 0) + rand(420, 760));
    setTigerIntent(t, "Shadow Fade", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} entered stealth phase.`);
  } else if(skill === "pounce_chain"){
    t.bossPounceCharges = rand(2, 3);
    t.bossPounceChainUntil = now + rand(2400, 3400);
    t.nextPounceAt = now + rand(120, 260);
    setTigerIntent(t, `Pounce x${t.bossPounceCharges}`, 900);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is chaining pounces.`);
  } else if(skill === "charge"){
    t.bossChargeUntil = now + rand(2000, 3200);
    t.enragedUntil = Math.max(t.enragedUntil || 0, t.bossChargeUntil + 900);
    setTigerIntent(t, "Rage Charge", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is charging.`);
  } else if(skill === "reinforce"){
    t.nextReinforceAt = Math.min(t.nextReinforceAt || (now + 70), now + 70);
    setTigerIntent(t, "Howl Call", 820);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is calling reinforcements.`);
  }

  const cd = profile.cd || [9000, 13000];
  const levelScale = clamp(1 - (Math.max(1, currentCampaignLevel()) - 1) * 0.005, 0.68, 1);
  const cdMin = Math.round(cd[0] * levelScale);
  const cdMax = Math.max(cdMin + 250, Math.round(cd[1] * levelScale));
  t.nextBossSkillAt = now + rand(cdMin, cdMax);
}
function bossIdentityTick(){
  if(S.mode==="Survival" || S.paused || S.missionEnded || S.gameOver) return;
  const now = Date.now();
  for(const t of (S.tigers || [])){
    if(!t?.alive || !isBossTiger(t)) continue;
    if(t.holdUntil && now < t.holdUntil) continue;
    const profile = bossIdentityProfile(t);
    if(!profile) continue;
    if(!Number.isFinite(t.nextBossSkillAt) || t.nextBossSkillAt <= 0){
      const cd = profile.cd || [9000, 13000];
      t.nextBossSkillAt = now + rand(cd[0], cd[1]);
      t.bossSkillStep = 0;
      continue;
    }
    if(now < t.nextBossSkillAt) continue;
    triggerBossIdentitySkill(t, profile, now);
  }
}
function tigerPowerRank(t){
  if(!t) return 1;
  if(isBossTiger(t)) return 6;
  return TIGER_POWER_ORDER[t.type] || 1;
}
function tigerDamageScale(t, target="player"){
  const table = TIGER_DAMAGE_SCALES[target] || TIGER_DAMAGE_SCALES.player;
  const idx = clamp(tigerPowerRank(t) - 1, 0, table.length - 1);
  return table[idx];
}
function tigerDefenseScale(t){
  const idx = clamp(tigerPowerRank(t) - 1, 0, TIGER_DEFENSE_SCALES.length - 1);
  return TIGER_DEFENSE_SCALES[idx];
}

const TIGER_PERSONALITIES = {
  Hunter: {
    label: "Hunter",
    playerBias: 0.32,
    civBiasDelta: -0.16,
    speedMul: 1.08,
    detectMul: 1.10,
    pounceMul: 1.08,
    packPullMul: 0.90
  },
  Ambusher: {
    label: "Ambusher",
    playerBias: 0.14,
    civBiasDelta: 0.05,
    speedMul: 1.02,
    detectMul: 1.05,
    pounceMul: 1.28,
    packPullMul: 0.95
  },
  Sentinel: {
    label: "Sentinel",
    playerBias: -0.06,
    civBiasDelta: 0.14,
    speedMul: 0.97,
    detectMul: 0.96,
    pounceMul: 0.90,
    packPullMul: 1.35
  },
  Fury: {
    label: "Fury",
    playerBias: 0.22,
    civBiasDelta: -0.10,
    speedMul: 1.00,
    detectMul: 1.00,
    pounceMul: 1.18,
    packPullMul: 1.00
  }
};

const COMBO_WINDOW_MS = 14000;
const COMBO_WINDOW_BONUS_MS = 4000;

const PROGRESSION_UNLOCKS = [
  { key:"cache_boost", level:3, label:"Cache Boost", desc:"+35% cache cash and +25% cache ammo." },
  { key:"barrier_boost", level:5, label:"Barrier Engineer", desc:"+26% barricade radius." },
  { key:"cooldown_boost", level:7, label:"Tempo Link", desc:"-16% cooldown on Scan, Sprint, and Shield." },
  { key:"combo_boost", level:9, label:"Chain Keeper", desc:"+4s combo timer window." },
];

const STORY_BASE_UPGRADES = [
  { key:"BASE_ARMORY", name:"Base Armory", maxRank:3, costs:[4500,8500,13500], desc:"+8 starting armor per rank in Story missions." },
  { key:"BASE_LOGISTICS", name:"Logistics Wing", maxRank:3, costs:[4200,7600,11800], desc:"Higher minimum mission-start supplies (medkits/traps/repair)." },
  { key:"BASE_SHIELD_NET", name:"Shield Network", maxRank:2, costs:[5200,9400], desc:"+1 starting shield per rank in Story missions." },
  { key:"BASE_ENDURANCE", name:"Endurance Program", maxRank:3, costs:[3800,7000,10600], desc:"-8% stamina drain per rank in Story missions." },
  { key:"BASE_FINANCE", name:"Operations Finance", maxRank:3, costs:[6000,10200,15400], desc:"+8% Story payout cash per rank." },
];

const STORY_SPECIALIST_PERKS = [
  { key:"SP_ATK_DRILL", role:"attacker", name:"Tiger Specialist Drill", maxRank:3, costs:[6800,11600,17200], desc:"Tiger specialists gain damage, HP, and armor." },
  { key:"SP_ATK_CAPTURE", role:"attacker", name:"Capture Tactics", maxRank:3, costs:[7000,12400,18400], desc:"Tiger specialists capture more reliably and improve Story capture window." },
  { key:"SP_RESCUE_ESCORT", role:"rescue", name:"Escort Formation", maxRank:3, costs:[6400,10800,16400], desc:"Rescue specialists move and guide civilians faster." },
  { key:"SP_RESCUE_GUARD", role:"rescue", name:"Civilian Guard Protocol", maxRank:3, costs:[6200,10400,15800], desc:"Rescue specialists and nearby civilians take less tiger damage." },
];

const STORY_CHAPTER_REWARDS = [
  { chapter:1, key:"RW_FIELD_GRANT", label:"Field Grant", desc:"One-time grant: +$3,000 and +1 perk point.", cash:3000, perkPoints:1 },
  { chapter:2, key:"RW_CAPTURE_RESEARCH", label:"Capture Research", desc:"Capture window permanently expands in Story missions.", captureWindowBonus:0.03 },
  { chapter:3, key:"RW_ESCORT_KIT", label:"Escort Kit", desc:"Story missions start with +1 extra shield.", shieldBonus:1 },
  { chapter:4, key:"RW_TRIAGE_PROTOCOL", label:"Triage Protocol", desc:"Civilians take less tiger damage in Story missions.", civilianDamageMul:0.90 },
  { chapter:5, key:"RW_ARMOR_CACHE", label:"Armor Cache", desc:"Story missions start with bonus armor.", startArmorBonus:6 },
  { chapter:6, key:"RW_STAMINA_DOCTRINE", label:"Stamina Doctrine", desc:"Extra Story stamina efficiency bonus unlocked.", staminaDrainMul:0.95 },
  { chapter:7, key:"RW_HUNTER_COMMAND", label:"Hunter Command", desc:"Tiger specialists gain additional combat edge.", attackerDamageMul:1.08, attackerDurabilityMul:1.08 },
  { chapter:8, key:"RW_TREASURY_LINK", label:"Treasury Link", desc:"Story payouts gain an extra multiplier.", payoutMul:1.08 },
  { chapter:9, key:"RW_EVAC_NETWORK", label:"Evac Network", desc:"Rescue specialists gain extra escort speed.", rescueSpeedMul:1.10 },
  { chapter:10, key:"RW_LEGENDARY_COMMAND", label:"Legendary Command", desc:"Final chapter reward: +2 perk points and Commander title.", perkPoints:2, title:"Legendary Commander" },
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

const MAP_REALISM_PROPS = {
  ST_FOREST: [
    { kind:"bush", x:130, y:148, s:1.1 },
    { kind:"bush", x:844, y:176, s:1.0 },
    { kind:"log", x:386, y:430, s:1.0 },
    { kind:"rock", x:728, y:466, s:1.0 },
    { kind:"sign", x:592, y:252, s:1.0 },
  ],
  ST_SUBURBS: [
    { kind:"lamp", x:150, y:192, s:1.0 },
    { kind:"lamp", x:790, y:210, s:1.0 },
    { kind:"car", x:424, y:246, s:1.0 },
    { kind:"fence", x:610, y:408, s:1.0 },
    { kind:"fence", x:286, y:418, s:1.0 },
  ],
  ST_DOWNTOWN: [
    { kind:"barrier", x:320, y:236, s:1.0 },
    { kind:"barrier", x:642, y:368, s:1.0 },
    { kind:"crate", x:196, y:438, s:1.0 },
    { kind:"crate", x:828, y:432, s:1.0 },
    { kind:"lamp", x:486, y:170, s:1.0 },
  ],
  ST_INDUSTRIAL: [
    { kind:"crate", x:174, y:264, s:1.1 },
    { kind:"crate", x:792, y:320, s:1.1 },
    { kind:"barrel", x:564, y:458, s:1.0 },
    { kind:"fence", x:362, y:198, s:1.0 },
    { kind:"lamp", x:690, y:132, s:1.0 },
  ],
};

const STORY_CHAPTER_MAPS = [
  { key:"ST_FOREST", name:"Border Jungle" },
  { key:"ST_SUBURBS", name:"Blood Path Villages" },
  { key:"ST_FOREST", name:"Deep Jungle Corridor" },
  { key:"ST_DOWNTOWN", name:"Abandoned Villages" },
  { key:"ST_SUBURBS", name:"River Territory" },
  { key:"ST_INDUSTRIAL", name:"Mountain Edge" },
  { key:"ST_FOREST", name:"Tiger Territory" },
  { key:"ST_DOWNTOWN", name:"Jungle Warfront" },
  { key:"ST_SUBURBS", name:"Hidden Jungle Rim" },
  { key:"ST_INDUSTRIAL", name:"Ancient Temple Zone" },
];

const ARCADE_CHAPTER_MAPS = [
  { key:"AR_SAND_YARD", name:"Arcade: Jungle Awakening" },
  { key:"AR_ARENA_BAY", name:"Arcade: Growing Danger" },
  { key:"ST_FOREST", name:"Arcade: Deep Jungle" },
  { key:"ST_DOWNTOWN", name:"Arcade: Abandoned Village" },
  { key:"AR_ARENA_BAY", name:"Arcade: River Crossing" },
  { key:"AR_STEEL_PIT", name:"Arcade: Mountain Pass" },
  { key:"ST_FOREST", name:"Arcade: Tiger Territory" },
  { key:"AR_NEON_GRID", name:"Arcade: Jungle War" },
  { key:"ST_SUBURBS", name:"Arcade: Last Villages" },
  { key:"SV_RUINS", name:"Arcade: Final Operation" },
];

const CHAPTER_VISUALS = {
  Story: [
    { tint:"rgba(86,188,120,.05)", haze:"rgba(255,218,142,.06)", landmarkScale:0.00, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(198,84,84,.05)", haze:"rgba(252,165,165,.05)", landmarkScale:0.02, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(94,188,255,.04)", haze:"rgba(190,230,255,.05)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(168,85,247,.04)", haze:"rgba(196,181,253,.05)", landmarkScale:0.02, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(59,130,246,.05)", haze:"rgba(191,219,254,.06)", landmarkScale:0.02, safeHue:"rgba(52,211,153,.95)" },
    { tint:"rgba(245,158,11,.05)", haze:"rgba(254,215,170,.06)", landmarkScale:0.04, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(34,197,94,.05)", haze:"rgba(187,247,208,.06)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(239,68,68,.05)", haze:"rgba(252,165,165,.06)", landmarkScale:0.03, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(14,165,233,.05)", haze:"rgba(186,230,253,.06)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(234,179,8,.05)", haze:"rgba(254,240,138,.06)", landmarkScale:0.05, safeHue:"rgba(74,222,128,.95)" },
  ],
  Arcade: [
    { tint:"rgba(234,179,8,.05)", haze:"rgba(254,240,138,.05)", landmarkScale:0.01, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(248,113,113,.05)", haze:"rgba(252,165,165,.05)", landmarkScale:0.02, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(34,197,94,.05)", haze:"rgba(187,247,208,.05)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(168,85,247,.05)", haze:"rgba(221,214,254,.05)", landmarkScale:0.02, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(59,130,246,.05)", haze:"rgba(191,219,254,.05)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(245,158,11,.05)", haze:"rgba(254,215,170,.06)", landmarkScale:0.03, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(16,185,129,.05)", haze:"rgba(167,243,208,.06)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(96,165,250,.05)", haze:"rgba(191,219,254,.06)", landmarkScale:0.04, safeHue:"rgba(110,231,183,.95)" },
    { tint:"rgba(244,114,182,.05)", haze:"rgba(251,207,232,.06)", landmarkScale:0.03, safeHue:"rgba(74,222,128,.95)" },
    { tint:"rgba(250,204,21,.06)", haze:"rgba(254,240,138,.07)", landmarkScale:0.04, safeHue:"rgba(74,222,128,.95)" },
  ],
  Survival: [
    { tint:"rgba(125,211,252,.04)", haze:"rgba(186,230,253,.05)", landmarkScale:0.02, safeHue:"rgba(110,231,183,.95)" },
  ],
};

const MAP_DENSE_LANDMARKS = {
  ST_FOREST: [
    { kind:"house", nx:0.12, ny:0.13, s:0.95 },
    { kind:"truck", nx:0.22, ny:0.23, s:0.9 },
    { kind:"park", nx:0.34, ny:0.10, s:1.0 },
    { kind:"house", nx:0.48, ny:0.18, s:0.9 },
    { kind:"truck", nx:0.62, ny:0.26, s:0.95 },
    { kind:"house", nx:0.84, ny:0.15, s:0.95 },
    { kind:"park", nx:0.14, ny:0.66, s:1.05 },
    { kind:"truck", nx:0.30, ny:0.78, s:0.9 },
    { kind:"house", nx:0.48, ny:0.84, s:0.9 },
    { kind:"house", nx:0.70, ny:0.70, s:0.9 },
    { kind:"truck", nx:0.86, ny:0.80, s:0.88 },
    { kind:"park", nx:0.58, ny:0.57, s:1.1 },
  ],
  ST_SUBURBS: [
    { kind:"house", nx:0.10, ny:0.16, s:0.95 },
    { kind:"house", nx:0.20, ny:0.16, s:0.95 },
    { kind:"car", nx:0.31, ny:0.30, s:0.95 },
    { kind:"truck", nx:0.47, ny:0.18, s:0.95 },
    { kind:"park", nx:0.63, ny:0.20, s:1.05 },
    { kind:"house", nx:0.80, ny:0.17, s:0.95 },
    { kind:"car", nx:0.15, ny:0.56, s:0.92 },
    { kind:"house", nx:0.31, ny:0.62, s:0.95 },
    { kind:"truck", nx:0.49, ny:0.62, s:0.95 },
    { kind:"park", nx:0.65, ny:0.66, s:1.1 },
    { kind:"house", nx:0.82, ny:0.64, s:0.95 },
    { kind:"car", nx:0.90, ny:0.40, s:0.9 },
    { kind:"house", nx:0.22, ny:0.86, s:0.9 },
    { kind:"truck", nx:0.74, ny:0.84, s:0.9 },
  ],
  ST_DOWNTOWN: [
    { kind:"building", nx:0.12, ny:0.12, s:1.0 },
    { kind:"building", nx:0.26, ny:0.12, s:1.0 },
    { kind:"bus", nx:0.42, ny:0.22, s:0.95 },
    { kind:"building", nx:0.58, ny:0.11, s:1.0 },
    { kind:"building", nx:0.78, ny:0.12, s:1.0 },
    { kind:"car", nx:0.90, ny:0.24, s:0.92 },
    { kind:"building", nx:0.15, ny:0.48, s:1.0 },
    { kind:"bus", nx:0.34, ny:0.52, s:0.95 },
    { kind:"park", nx:0.50, ny:0.50, s:0.95 },
    { kind:"building", nx:0.67, ny:0.50, s:1.0 },
    { kind:"car", nx:0.82, ny:0.52, s:0.95 },
    { kind:"building", nx:0.90, ny:0.48, s:1.0 },
    { kind:"building", nx:0.22, ny:0.82, s:1.0 },
    { kind:"building", nx:0.48, ny:0.82, s:1.0 },
    { kind:"building", nx:0.75, ny:0.82, s:1.0 },
  ],
  ST_INDUSTRIAL: [
    { kind:"building", nx:0.12, ny:0.16, s:1.05 },
    { kind:"truck", nx:0.26, ny:0.20, s:0.95 },
    { kind:"crate", nx:0.38, ny:0.16, s:1.0 },
    { kind:"building", nx:0.56, ny:0.18, s:1.05 },
    { kind:"truck", nx:0.72, ny:0.24, s:0.95 },
    { kind:"building", nx:0.86, ny:0.16, s:1.05 },
    { kind:"crate", nx:0.14, ny:0.56, s:1.0 },
    { kind:"truck", nx:0.30, ny:0.62, s:0.95 },
    { kind:"building", nx:0.52, ny:0.58, s:1.05 },
    { kind:"crate", nx:0.68, ny:0.62, s:1.0 },
    { kind:"truck", nx:0.84, ny:0.58, s:0.95 },
    { kind:"building", nx:0.20, ny:0.84, s:1.0 },
    { kind:"building", nx:0.48, ny:0.84, s:1.0 },
    { kind:"building", nx:0.78, ny:0.84, s:1.0 },
  ],
};

const MAP_COLLIDER_PROFILES = {
  house: { type:"rect", w:32, h:24, pad:6 },
  building: { type:"rect", w:56, h:42, pad:8 },
  truck: { type:"rect", w:44, h:22, pad:5 },
  car: { type:"rect", w:34, h:16, pad:4 },
  bus: { type:"rect", w:52, h:20, pad:5 },
  crate: { type:"rect", w:24, h:20, pad:4 },
  barrier: { type:"rect", w:34, h:14, pad:4 },
  fence: { type:"rect", w:40, h:12, pad:4 },
  rock: { type:"circle", r:14, pad:4 },
  bush: { type:"circle", r:14, pad:2 },
  barrel: { type:"circle", r:10, pad:2 },
  lamp: { type:"circle", r:8, pad:2 },
  sign: { type:"rect", w:28, h:14, pad:3 },
  log: { type:"rect", w:34, h:12, pad:3 },
};
const MAP_SOFT_COLLIDER_KINDS = new Set([
  "bush",
  "log",
  "lamp",
  "sign",
  "barrel",
  "fence",
  "park",
]);
const MAP_WATER_LAYOUTS = {
  ST_FOREST: [
    { nx:0.27, ny:0.17, rx:0.094, ry:0.062, rot:0.02 },
    { nx:0.75, ny:0.15, rx:0.088, ry:0.056, rot:-0.03 },
    { nx:0.23, ny:0.80, rx:0.102, ry:0.074, rot:0.04 },
    { nx:0.79, ny:0.66, rx:0.087, ry:0.053, rot:-0.02 },
  ],
  ST_SUBURBS: [
    { nx:0.18, ny:0.12, rx:0.108, ry:0.052, rot:-0.08 },
    { nx:0.50, ny:0.56, rx:0.172, ry:0.066, rot:0.05, riverBoost:true },
    { nx:0.82, ny:0.86, rx:0.128, ry:0.054, rot:-0.04 },
  ],
  ST_DOWNTOWN: [
    { nx:0.17, ny:0.28, rx:0.106, ry:0.048, rot:-0.10 },
    { nx:0.52, ny:0.51, rx:0.118, ry:0.050, rot:0.06 },
    { nx:0.80, ny:0.72, rx:0.108, ry:0.046, rot:0.03 },
  ],
  ST_INDUSTRIAL: [
    { nx:0.21, ny:0.34, rx:0.118, ry:0.054, rot:-0.08 },
    { nx:0.67, ny:0.24, rx:0.130, ry:0.058, rot:0.05 },
    { nx:0.74, ny:0.76, rx:0.120, ry:0.052, rot:-0.03 },
  ],
};

const ARCADE_CAMPAIGN_CHAPTERS = [
  "Jungle Awakening",
  "Growing Danger",
  "Deep Jungle",
  "Abandoned Village",
  "River Crossing",
  "Mountain Pass",
  "Tiger Territory",
  "Jungle War",
  "The Last Villages",
  "Final Operation",
];

const ARCADE_CAMPAIGN_OBJECTIVES = [
  "Escort 2 civilians to the safe zone. 1 tiger appears.",
  "Rescue 3 civilians. 2 tigers attack.",
  "First capture tutorial. Capture 1 tiger.",
  "Escort 4 civilians through light jungle.",
  "Kill or capture 2 tigers while escorting civilians.",
  "First trap tutorial. Set 1 trap.",
  "Escort 5 civilians safely.",
  "Tigers attack from two directions.",
  "Capture 2 tigers without killing them.",
  "Boss: Alpha Tiger appears.",
  "Escort 6 civilians. 3 tigers attack.",
  "Blood mechanic introduced. Killing tigers increases aggression.",
  "Capture 3 tigers.",
  "Escort civilians through narrow jungle path.",
  "7 civilians under attack.",
  "Use traps to stop 4 tigers.",
  "Night mission – reduced visibility.",
  "Rescue civilians trapped in huts.",
  "5 tigers attack simultaneously.",
  "Boss: Blood Tiger (first aggressive boss).",
  "Escort 8 civilians through dense jungle.",
  "Tigers hide in tall grass.",
  "Capture 4 tigers.",
  "Civilians split into two groups.",
  "6 tiger ambush attack.",
  "Escort doctor civilian (healing ability).",
  "Defend village entrance.",
  "High aggression jungle area.",
  "Escort 10 civilians.",
  "Boss: Stealth Tiger.",
  "Rescue civilians from abandoned homes.",
  "Tigers roam village streets.",
  "Capture 5 tigers for research.",
  "Escort civilians through burning buildings.",
  "8 tigers attack at once.",
  "Protect doctor civilian.",
  "Use drone scanner to locate tigers.",
  "Rescue trapped children.",
  "Aggressive tiger swarm.",
  "Boss: Twin Alpha Tigers.",
  "Escort civilians across river bridge.",
  "Tigers attack near water.",
  "Capture 3 river tigers.",
  "Flooded path slows movement.",
  "9 tigers ambush crossing.",
  "Use traps near riverbank.",
  "Escort injured civilians.",
  "High aggression tiger zone.",
  "Protect supply convoy.",
  "Boss: Giant River Tiger.",
  "Escort civilians up steep mountain.",
  "Tigers attack from cliffs.",
  "Capture rare mountain tiger.",
  "Avalanche hazard mission.",
  "10 tigers attack convoy.",
  "Escort elderly civilians.",
  "Limited ammo challenge.",
  "Snowstorm reduces vision.",
  "Extreme aggression zone.",
  "Boss: Mountain Alpha Tiger.",
  "Enter tiger breeding territory.",
  "Rescue lost hunter civilian.",
  "Capture 6 tigers.",
  "Escort civilians through cave path.",
  "Tiger swarm attack.",
  "Defend rescue helicopter zone.",
  "Night ambush mission.",
  "Protect scientist civilian.",
  "Aggression level extreme.",
  "Boss: Legendary Blood Tiger.",
  "Escort 12 civilians.",
  "Tigers attack from every direction.",
  "Capture rare stealth tiger.",
  "Use advanced traps.",
  "Rescue trapped village leader.",
  "15 tiger swarm attack.",
  "Protect evacuation convoy.",
  "Massive tiger ambush.",
  "Extreme jungle aggression.",
  "Boss: Tiger King.",
  "Rescue final village survivors.",
  "Tigers dominate the jungle.",
  "Capture elite tiger squad.",
  "Escort civilians through fire zone.",
  "Massive tiger ambush.",
  "Defend safe zone.",
  "Escort helicopter evacuation.",
  "Survive tiger swarm.",
  "Extreme final battle preparation.",
  "Boss: Phantom Tiger.",
  "Escort last civilians.",
  "Tigers extremely aggressive.",
  "Capture elite tiger.",
  "Escort convoy through jungle.",
  "Massive tiger assault.",
  "Rescue trapped soldiers.",
  "Final civilian evacuation.",
  "Survive jungle chaos.",
  "Prepare for final boss.",
  "FINAL BOSS: The Ancient Tiger (Legendary).",
];

function arcadeCampaignMission(level){
  const count = ARCADE_CAMPAIGN_OBJECTIVES.length;
  const n = clamp(Math.floor(level || 1), 1, count);
  const objective = ARCADE_CAMPAIGN_OBJECTIVES[n - 1];
  const chapter = Math.ceil(n / 10);
  const chapterName = ARCADE_CAMPAIGN_CHAPTERS[chapter - 1] || "Campaign";

  const cfg = {
    number: n,
    chapter,
    chapterName,
    objective,
    civilians: clamp(2 + chapter, 2, 12),
    tigers: clamp(1 + chapter + Math.floor((n - 1) / 20), 1, 16),
    captureRequired: 0,
    captureOnly: /without killing/i.test(objective),
    trapPlaceRequired: 0,
    trapTriggerRequired: 0,
    boss: /boss/i.test(objective),
    bossType: "Alpha",
    bossTwin: /twin alpha/i.test(objective),
    finalBoss: n === 100,
    lowVisibility: /(night|reduced visibility|snowstorm|hide in tall grass)/i.test(objective),
    limitedAmmo: /limited ammo/i.test(objective),
    bloodAggro: /blood mechanic/i.test(objective),
  };

  const civMatch = objective.match(/(?:escort|rescue)\s+(\d+)\s+civilians?/i) || objective.match(/(\d+)\s+civilians?\s+under attack/i);
  if(civMatch) cfg.civilians = clamp(parseInt(civMatch[1], 10) || cfg.civilians, 0, 14);

  const tigerNums = [...objective.matchAll(/(\d+)\s+tigers?/ig)].map((m)=>parseInt(m[1], 10)).filter(Number.isFinite);
  if(tigerNums.length) cfg.tigers = clamp(Math.max(cfg.tigers, ...tigerNums), 1, 18);

  const capMatch = objective.match(/capture\s+(\d+)\s+tigers?/i);
  if(capMatch) cfg.captureRequired = clamp(parseInt(capMatch[1], 10) || 0, 0, 12);
  else if(/capture\s+(?:rare|elite|first)/i.test(objective)) cfg.captureRequired = 1;
  else if(/capture elite tiger squad/i.test(objective)) cfg.captureRequired = 3;

  const trapSet = objective.match(/set\s+(\d+)\s+trap/i);
  if(trapSet) cfg.trapPlaceRequired = clamp(parseInt(trapSet[1], 10) || 0, 0, 10);
  const trapStop = objective.match(/use traps?\s+to stop\s+(\d+)\s+tigers?/i);
  if(trapStop) cfg.trapTriggerRequired = clamp(parseInt(trapStop[1], 10) || 0, 0, 10);

  if(/aggressive tiger swarm|massive tiger|tiger swarm|every direction/i.test(objective)){
    cfg.tigers = clamp(Math.max(cfg.tigers, 7 + chapter), 1, 18);
  }

  if(cfg.boss){
    cfg.tigers = Math.max(cfg.tigers, cfg.bossTwin ? 2 : 1);
    if(/stealth|phantom/i.test(objective)) cfg.bossType = "Stalker";
    else if(/blood|berserker/i.test(objective)) cfg.bossType = "Berserker";
    else cfg.bossType = "Alpha";
  }

  return cfg;
}

function arcadeObjectiveProgressText(cfg){
  if(!cfg) return "";
  const bits = [];
  if(cfg.captureRequired > 0) bits.push(`Capture ${Math.min(S.stats.captures||0, cfg.captureRequired)}/${cfg.captureRequired}`);
  if(cfg.trapPlaceRequired > 0) bits.push(`Traps set ${Math.min(S.stats.trapsPlaced||0, cfg.trapPlaceRequired)}/${cfg.trapPlaceRequired}`);
  if(cfg.trapTriggerRequired > 0) bits.push(`Trap stops ${Math.min(S.stats.trapsTriggered||0, cfg.trapTriggerRequired)}/${cfg.trapTriggerRequired}`);
  if(cfg.captureOnly) bits.push(`Kills ${S.stats.kills||0}/0`);
  return bits.length ? ` • ${bits.join(" • ")}` : "";
}

function arcadeMissionTimeLeftSec(){
  const limit = Math.max(0, Math.floor(Number(S.arcadeMissionLimitSec || 0)));
  const startAt = Math.max(0, Math.floor(Number(S.arcadeMissionStartAt || 0)));
  if(limit <= 0 || startAt <= 0) return 0;
  const elapsed = Math.floor((Date.now() - startAt) / 1000);
  return Math.max(0, limit - Math.max(0, elapsed));
}

function arcadeComboMultiplier(){
  const chain = Math.max(1, Math.floor(Number(S.comboCount || 0)));
  return clamp(1 + ((chain - 1) * 0.20), 1, 3);
}

function arcadeMissionMedal(){
  const limit = Math.max(1, Math.floor(Number(S.arcadeMissionLimitSec || 1)));
  const left = arcadeMissionTimeLeftSec();
  const ratio = left / limit;
  const peak = Math.max(0, Math.floor(Number(S.arcadeComboPeak || 0)));

  if(ratio >= 0.52 && peak >= 8) return "Platinum";
  if(ratio >= 0.34 && peak >= 5) return "Gold";
  if(ratio >= 0.18 && peak >= 3) return "Silver";
  return "Bronze";
}

const STORY_CAMPAIGN_CHAPTERS = [
  "The First Attack",
  "Blood in the Jungle",
  "The Deep Jungle",
  "Abandoned Villages",
  "River Territory",
  "Mountain Edge",
  "Tiger Territory",
  "The Tiger King",
  "The Hidden Jungle",
  "The Ancient Guardian",
];

const STORY_CAMPAIGN_OBJECTIVES = [
  "Escort 2 villagers from the jungle edge.",
  "Tigers attack a farm road. Escort 3 civilians.",
  "First tiger encounter. Kill or capture 1 tiger.",
  "Rescue villagers trapped in a hut.",
  "Escort 4 civilians through jungle trail.",
  "Tigers attack from tall grass.",
  "Escort injured villager to safe zone.",
  "Capture your first tiger for research.",
  "Multiple tigers attack village gate.",
  "Boss: Alpha Tiger appears near village.",
  "Escort villagers through narrow path.",
  "Killing a tiger increases aggression.",
  "Capture 2 tigers for scientists.",
  "Protect doctor civilian.",
  "Tigers ambush caravan.",
  "Escort 5 civilians through forest.",
  "Rescue children hiding in village.",
  "Capture aggressive tiger pack.",
  "High aggression tiger swarm.",
  "Boss: Blood Tiger appears.",
  "Escort research team.",
  "Tigers hide in tall grass.",
  "Capture stealth tiger.",
  "Escort villagers through river trail.",
  "Tiger ambush near jungle bridge.",
  "Rescue lost hunter.",
  "Escort group through abandoned camp.",
  "Large tiger pack attacks.",
  "Escort 7 civilians to helicopter zone.",
  "Boss: Stealth Tiger.",
  "Search empty homes for survivors.",
  "Tigers roam village streets.",
  "Escort survivors to safe zone.",
  "Capture 3 tigers for study.",
  "Tigers attack evacuation convoy.",
  "Protect scientist collecting tiger samples.",
  "Escort civilians through burning buildings.",
  "Tiger swarm in town center.",
  "Massive tiger pack attack.",
  "Boss: Twin Alpha Tigers.",
  "Escort civilians across broken bridge.",
  "Tigers attack near riverbank.",
  "Capture river tiger.",
  "Escort wounded villager across water.",
  "Tiger ambush during crossing.",
  "Protect supply convoy.",
  "Escort civilians to river camp.",
  "Tigers attack rescue boat.",
  "Large tiger pack near river delta.",
  "Boss: Giant River Tiger.",
  "Escort mountain villagers.",
  "Tigers attack from cliffs.",
  "Capture rare mountain tiger.",
  "Rescue trapped climbers.",
  "Tiger pack attacks mountain road.",
  "Escort caravan through canyon.",
  "Snowstorm reduces visibility.",
  "Protect rescue helicopter landing.",
  "Aggressive tiger swarm.",
  "Boss: Mountain Alpha Tiger.",
  "Escort scientists deeper into jungle.",
  "Tigers guard cave entrances.",
  "Capture 4 tigers for research.",
  "Escort villagers through cave tunnel.",
  "Massive tiger pack attack.",
  "Defend temporary base camp.",
  "Night ambush by stealth tigers.",
  "Protect research equipment.",
  "Extreme aggression zone.",
  "Boss: Legendary Blood Tiger.",
  "Escort villagers fleeing jungle center.",
  "Tigers attack from all directions.",
  "Capture elite tiger hunters.",
  "Escort caravan through dangerous jungle path.",
  "Tiger swarm attack.",
  "Rescue lost soldiers.",
  "Escort final villagers from jungle.",
  "Massive tiger ambush.",
  "Prepare for Tiger King encounter.",
  "Boss: Tiger King.",
  "Escort research team into hidden jungle.",
  "Rare tigers appear.",
  "Capture stealth tiger.",
  "Escort villagers through ancient ruins.",
  "Tiger pack guarding ruins.",
  "Protect excavation team.",
  "Escort survivors to helicopter zone.",
  "Extreme tiger aggression.",
  "Prepare for final confrontation.",
  "Boss: Phantom Tiger.",
  "Escort final villagers from jungle core.",
  "Tigers become extremely aggressive.",
  "Capture elite guardian tiger.",
  "Escort convoy through ancient jungle.",
  "Massive tiger assault.",
  "Rescue trapped soldiers.",
  "Protect final evacuation helicopter.",
  "Survive tiger swarm.",
  "Enter the ancient jungle temple.",
  "Final Boss: The Ancient Tiger.",
];

const STORY_CHAPTER_CUTSCENES = {
  10: "Commander Reyes realizes the attacks are becoming organized.",
  20: "Scientists confirm tiger blood is causing chain reactions.",
  30: "Scientists detect a powerful predator controlling packs.",
  40: "Two alpha leaders confirm tiger hierarchy.",
  50: "Satellite scans reveal deeper jungle movement.",
  60: "Scientists detect ancient territory beyond mountains.",
  70: "Evidence suggests a massive tiger leader exists.",
  80: "After defeating the Tiger King, scientists uncover a deeper mystery.",
  90: "Ancient legends speak of a guardian tiger.",
};

const STORY_CHAPTER_RECAPS = [
  "Border villages saw their first organized tiger attacks. You were deployed to escort civilians and stop the panic while command gathered evidence.",
  "Scientists confirmed tiger blood triggers chain aggression. You now balance fast kills against long-term danger by using captures when possible.",
  "The CRU pushed deeper into tall-grass routes and hidden trails. Pack behavior became coordinated, and stealth ambushes started appearing.",
  "Abandoned villages proved the conflict had spread. Evac routes through homes and streets became active warzones with heavy pack pressure.",
  "River territory turned crossings into choke points. Escort timing, trap placement, and route control became critical to keep civilians alive.",
  "Mountain routes added visibility loss and terrain pressure. Cliff attacks and convoy defense forced tighter movement and resource discipline.",
  "Inside core tiger territory, aggression surged and mission stakes escalated. Rescue teams now operate under constant high-threat conditions.",
  "The Tiger King campaign exposed leadership patterns across the packs. Missions shifted to full-scale evacuation under multi-direction attacks.",
  "Hidden jungle ruins revealed rare tiger variants and deeper coordination. Final preparation missions focused on survival and controlled captures.",
  "The final operation enters ancient territory. Your decisions on capture versus kill determine the campaign ending and legacy rewards.",
];

function storyCampaignMission(level){
  const count = STORY_CAMPAIGN_OBJECTIVES.length;
  const n = clamp(Math.floor(level || 1), 1, count);
  const objective = STORY_CAMPAIGN_OBJECTIVES[n - 1];
  const chapter = Math.ceil(n / 10);
  const chapterName = STORY_CAMPAIGN_CHAPTERS[chapter - 1] || "Story Campaign";

  const cfg = {
    number: n,
    chapter,
    chapterName,
    objective,
    civilians: clamp(2 + chapter, 2, 12),
    tigers: clamp(1 + chapter, 1, 14),
    captureRequired: 0,
    boss: /boss/i.test(objective),
    bossType: "Alpha",
    bossTwin: /twin alpha/i.test(objective),
    finalBoss: n === 100,
    lowVisibility: /(night|snowstorm|tall grass|stealth)/i.test(objective),
    bloodAggro: /(increases aggression|high aggression|extreme aggression|aggressive)/i.test(objective),
  };

  const civMatch = objective.match(/(?:escort|rescue)\s+(\d+)\s+(?:civilians?|villagers?)/i);
  if(civMatch) cfg.civilians = clamp(parseInt(civMatch[1], 10) || cfg.civilians, 0, 14);
  else if(/injured villager|wounded villager|lost hunter|doctor civilian|scientist/i.test(objective)) cfg.civilians = Math.max(1, cfg.civilians);

  const tigerNums = [...objective.matchAll(/(\d+)\s+tigers?/ig)].map((m)=>parseInt(m[1], 10)).filter(Number.isFinite);
  if(tigerNums.length) cfg.tigers = clamp(Math.max(cfg.tigers, ...tigerNums), 1, 18);
  if(/swarm|massive tiger|all directions|pack attack/i.test(objective)) cfg.tigers = clamp(Math.max(cfg.tigers, 7 + chapter), 1, 18);

  if(!/kill or capture/i.test(objective)){
    const capCount = objective.match(/capture\s+(\d+)\s+tigers?/i);
    if(capCount) cfg.captureRequired = clamp(parseInt(capCount[1], 10) || 0, 0, 12);
    else if(/capture/i.test(objective)){
      cfg.captureRequired = /pack|hunters/i.test(objective) ? 2 : 1;
    }
  }

  if(cfg.boss){
    cfg.tigers = cfg.bossTwin ? 2 : 1;
    if(/blood/i.test(objective)) cfg.bossType = "Berserker";
    else if(/stealth|phantom/i.test(objective)) cfg.bossType = "Stalker";
    else cfg.bossType = "Alpha";
  }

  if(cfg.finalBoss){
    cfg.boss = true;
    cfg.bossTwin = false;
    cfg.bossType = "Alpha";
    cfg.tigers = 1;
    cfg.civilians = 0;
  }

  return cfg;
}

function storyObjectiveProgressText(cfg){
  if(!cfg) return "";
  const bits = [];
  if(cfg.captureRequired > 0) bits.push(`Capture ${Math.min(S.stats.captures||0, cfg.captureRequired)}/${cfg.captureRequired}`);
  return bits.length ? ` • ${bits.join(" • ")}` : "";
}

function markStoryFinalBossOutcome(outcome, tiger){
  if(S.mode!=="Story") return;
  const m = storyCampaignMission(S.storyLevel);
  if(!m || m.number !== 100) return;
  if(!tiger || !tiger.bossPhases) return;
  S._storyFinalOutcome = outcome;
}


// ===================== STATE =====================
const MODE_KEYS = Object.freeze(["Story","Arcade","Survival"]);
const MODE_WALLET_START = Object.freeze({
  Story: 1000,
  Arcade: 1000,
  Survival: 1000,
});

function normalizeModeName(mode){
  const key = String(mode || "").trim();
  return MODE_KEYS.includes(key) ? key : "Story";
}
function sanitizeWalletAmount(value, fallback = 1000){
  const n = Math.floor(Number(value));
  if(Number.isFinite(n) && n >= 0) return n;
  const fb = Math.floor(Number(fallback));
  if(Number.isFinite(fb) && fb >= 0) return fb;
  return 1000;
}
function modeWalletStartValue(mode){
  const key = normalizeModeName(mode);
  return sanitizeWalletAmount(MODE_WALLET_START[key], 1000);
}
function normalizeModeWallets(wallets, fallbackFunds, activeMode){
  const out = {};
  for(const mode of MODE_KEYS){
    out[mode] = modeWalletStartValue(mode);
  }
  if(wallets && typeof wallets === "object"){
    for(const mode of MODE_KEYS){
      if(Object.prototype.hasOwnProperty.call(wallets, mode)){
        out[mode] = sanitizeWalletAmount(wallets[mode], out[mode]);
      }
    }
  }else{
    const mode = normalizeModeName(activeMode);
    out[mode] = sanitizeWalletAmount(fallbackFunds, out[mode]);
  }
  return out;
}
function ensureModeWalletsState(state){
  if(!state || typeof state !== "object") return;
  state.mode = normalizeModeName(state.mode);
  state.modeWallets = normalizeModeWallets(state.modeWallets, state.funds, state.mode);
}
function getModeWallet(mode = S?.mode, state = S){
  if(!state || typeof state !== "object"){
    return modeWalletStartValue(mode);
  }
  ensureModeWalletsState(state);
  const key = normalizeModeName(mode);
  return sanitizeWalletAmount(state.modeWallets[key], modeWalletStartValue(key));
}
function setModeWallet(mode, amount, state = S){
  if(!state || typeof state !== "object") return;
  ensureModeWalletsState(state);
  const key = normalizeModeName(mode);
  state.modeWallets[key] = sanitizeWalletAmount(amount, modeWalletStartValue(key));
}
function bindFundsWallet(state){
  if(!state || typeof state !== "object") return;
  ensureModeWalletsState(state);
  let fundsValue = sanitizeWalletAmount(state.funds, getModeWallet(state.mode, state));
  Object.defineProperty(state, "funds", {
    configurable: true,
    enumerable: true,
    get(){ return fundsValue; },
    set(next){
      fundsValue = sanitizeWalletAmount(next, fundsValue);
      ensureModeWalletsState(state);
      const mode = normalizeModeName(state.mode);
      state.modeWallets[mode] = fundsValue;
    },
  });
  // Re-sync displayed funds from the active mode wallet.
  state.funds = getModeWallet(state.mode, state);
}
function resetModeWallet(mode, state = S){
  const key = normalizeModeName(mode);
  setModeWallet(key, modeWalletStartValue(key), state);
  if(state && typeof state === "object" && normalizeModeName(state.mode) === key){
    state.funds = getModeWallet(key, state);
  }
}

const DEFAULT = {
  v: STORAGE_VERSION,
  paused:false, pauseReason:null,
  mode:"Story", arcadeLevel:1, survivalWave:1, storyLevel:1, mapIndex:0,
  modeWallets:{
    Story:1000,
    Arcade:1000,
    Survival:1000,
  },
  soundOn:true, audioUnlocked:false,
  performanceMode:"AUTO",

  lives:5, funds:1000, score:0, trust:80, aggro:10, stamina:100,
  hp:100, armor:20, armorCap:100,

  ownedWeapons:["W_TRQ_PISTOL_MK1","W_9MM_JUNK","W_TRQ_RIFLE","W_TRQ_LAUNCHER"],
  equippedWeaponId:"W_TRQ_PISTOL_MK1",
  ammoReserve:{ "TRANQ_DARTS":20, "9MM_STD":40 },
  mag:{ loaded:6, cap:6 },
  durability:{},

  medkits:{ "M_SMALL":1 },
  medkitSelectedId:"M_SMALL",
  repairKits:{ "T_REPAIR":1 },
  armorPlates:{ "A_TIER1":0, "A_TIER2":0, "A_TIER3":0, "A_TIER4":0 },
  armorPlatesFallback:{ "A_TIER1":0, "A_TIER2":0, "A_TIER3":0, "A_TIER4":0 },
  armorPlateSelectedId:"A_TIER1",
  trapsOwned:2,
  trapsPlaced:[],
  shields:1,
  shieldUntil:0,
  rollCooldownUntil:0,
  rollInvulnUntil:0,
  rollBufferedDodges:0,
  rollBufferedUntil:0,
  rollAnimStart:0,
  rollAnimUntil:0,
  rollAnimFromX:0,
  rollAnimFromY:0,
  rollAnimToX:0,
  rollAnimToY:0,
  abilityCooldowns:{ scan:0, sprint:0, shield:0 },
  soldierAttackersOwned:0,
  soldierRescuersOwned:0,
  soldierAttackersDowned:0,
  soldierRescuersDowned:0,
  specialistStarUnlocks:{ attacker:false, rescue:false },
  lastCombatLethalWeaponId:"",

  backupCooldown:0, backupActive:0,
  respawnPendingUntil:0,
  respawnTargetX:0,
  respawnTargetY:0,
  respawnNoticeAt:0,
  takeoverPromptUntil:0,
  takeoverCivId:null,
  takeoverUnitId:null,

  me:{ x:160, y:420, face:0, step:0 },
  target:null,

  tigers:[],
  carcasses:[],
  supportUnits:[],
  rescueSites:[],
  mapInteractables:[],

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
  storyIntroSeen:false,

  // Phase 1 systems
  fogUntil:0,
  eventText:"",
  eventCooldown:0,
  pickups:[],
  comboCount:0,
  comboBest:0,
  comboExpireAt:0,
  arcadeMissionStartAt:0,
  arcadeMissionLimitSec:0,
  arcadeComboPeak:0,
  arcadeScoreBonus:0,
  _arcadeTimerWarn:0,
  stats:{ shots:0, captures:0, kills:0, evac:0, cashEarned:0, trapsPlaced:0, trapsTriggered:0 },
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
},
progressionUnlocks: {},
metaBase: {},
specialistPerks: {},
chapterRewardsUnlocked: {},
  touchHud:{
    opacity:44,
    size:100,
    stickX:0,
    stickY:0,
    actionX:0,
    actionY:0,
    cacheX:0,
    cacheY:0
  }
};

let S = load();
bindFundsWallet(S);

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
const DAMAGE_POPUPS = [];
const IMPACT_PULSES = [];
const DAMAGE_POPUP_RATE_MS = 82;
const DAMAGE_POPUP_GATE = new Map();
const CAMERA_SHAKE = { until:0, power:0 };
const ATMOS_PARTICLES = Object.freeze(Array.from({ length:26 }, (_, i)=>{
  const seed = i + 1;
  const u = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const v = Math.abs(Math.sin(seed * 39.3467) * 19642.3491) % 1;
  const depth = 0.45 + ((i % 7) * 0.09);
  return Object.freeze({
    u,
    v,
    depth,
    size: 0.8 + ((i % 5) * 0.22),
    drift: 0.18 + ((i % 6) * 0.05),
    alpha: 0.035 + ((i % 4) * 0.012),
  });
}));

function clearTransientCombatVisuals(){
  COMBAT_FX.length = 0;
  DAMAGE_POPUPS.length = 0;
  IMPACT_PULSES.length = 0;
  DAMAGE_POPUP_GATE.clear();
  CAMERA_SHAKE.until = 0;
  CAMERA_SHAKE.power = 0;
}

function load(){
  try{
    let saved = null;
    let sourceKey = null;
    for(const key of [STORAGE_KEY, ...STORAGE_FALLBACK_KEYS]){
      let raw = null;
      try{
        raw = localStorage.getItem(key);
      }catch(e){
        raw = null;
      }
      if(!raw) continue;
      try{
        saved = JSON.parse(raw);
        sourceKey = key;
        break;
      }catch(e){
        try{ localStorage.removeItem(key); }catch(err){}
      }
    }
    if(!saved) return cloneState(DEFAULT);
    const m = { ...DEFAULT, ...saved };
    m.me = { ...DEFAULT.me, ...(saved.me||{}) };
    m.mag = { ...DEFAULT.mag, ...(saved.mag||{}) };
    m.ammoReserve = { ...DEFAULT.ammoReserve, ...(saved.ammoReserve||{}) };
    m.durability = { ...DEFAULT.durability, ...(saved.durability||{}) };
    m.medkits = { ...DEFAULT.medkits, ...(saved.medkits||{}) };
    m.repairKits = { ...DEFAULT.repairKits, ...(saved.repairKits||{}) };
    m.armorPlates = normalizeArmorPlateInventory(saved.armorPlates ?? m.armorPlates);
    m.armorPlatesFallback = normalizeArmorPlateInventory(saved.armorPlatesFallback ?? saved.armorPlates ?? m.armorPlatesFallback);
    m.abilityCooldowns = { ...DEFAULT.abilityCooldowns, ...(saved.abilityCooldowns||{}) };
    m.trapsPlaced = Array.isArray(saved.trapsPlaced) ? saved.trapsPlaced : [];
    m.carcasses = Array.isArray(saved.carcasses) ? saved.carcasses : [];
    m.pickups = Array.isArray(saved.pickups) ? saved.pickups : [];
    m.supportUnits = Array.isArray(saved.supportUnits) ? saved.supportUnits : [];
    m.rescueSites = Array.isArray(saved.rescueSites) ? saved.rescueSites : [];
    m.mapInteractables = Array.isArray(saved.mapInteractables) ? saved.mapInteractables : [];
    m.achievements = saved.achievements || {};
    m.stats = { ...DEFAULT.stats, ...(saved.stats||{}) };
    m.perks = { ...DEFAULT.perks, ...(saved.perks||{}) };
    m.progressionUnlocks = { ...DEFAULT.progressionUnlocks, ...(saved.progressionUnlocks||{}) };
    m.metaBase = { ...DEFAULT.metaBase, ...(saved.metaBase||{}) };
    m.specialistPerks = { ...DEFAULT.specialistPerks, ...(saved.specialistPerks||{}) };
    m.specialistStarUnlocks = { ...DEFAULT.specialistStarUnlocks, ...(saved.specialistStarUnlocks||{}) };
    m.chapterRewardsUnlocked = { ...DEFAULT.chapterRewardsUnlocked, ...(saved.chapterRewardsUnlocked||{}) };
    m.touchHud = normalizeTouchHudSettings(saved.touchHud ?? m.touchHud);
    m.mode = normalizeModeName(m.mode);
    m.modeWallets = normalizeModeWallets(saved.modeWallets, m.funds, m.mode);
    m.funds = getModeWallet(m.mode, m);
    if(m.lives==null) m.lives=5;
    m.v = STORAGE_VERSION;
    trimPersistentState(m);
    if(sourceKey && sourceKey !== STORAGE_KEY){
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
      }catch(e){}
    }
    return m;
  }catch(e){ return cloneState(DEFAULT); }
}
// ===================== SAVE (THROTTLED — FIXES IOS FREEZE) =====================
const SAVE_MIN_INTERVAL_MS = 4200;
const SAVE_AUTOSAVE_MS = 12000;
const STABILITY_SPIKE_GAP_MS = 520;
const STABILITY_SPIKE_RECOVER_MS = 3200;
const STABILITY_STALL_GAP_MS = 1600;
const STABILITY_STALL_HARD_GAP_MS = 2600;
const STABILITY_STALL_COST_MS = 84;
const STABILITY_RECOVER_COOLDOWN_MS = 5200;
const STABILITY_RECOVER_MAX_PER_MIN = 6;
const STABILITY_MONITOR_SAMPLE_MAX = 36;
const BLOCKED_CACHE_QUANT = 2;
const STABILITY_SOFT_CAP_TIGERS = 36;
const STABILITY_SOFT_CAP_CIVILIANS = 30;
const STABILITY_SOFT_CAP_PICKUPS = 34;
const STABILITY_SOFT_CAP_CARCASSES = 64;
const STABILITY_SOFT_CAP_TRAPS = 28;
const MAX_PERSIST_CARCASSES = 48;
const MAX_PERSIST_PICKUPS = 26;
const MAX_PERSIST_TRAPS = 24;
const MAX_PERSIST_RESCUE_SITES = 12;
const MAX_PERSIST_SUPPORT_UNITS = 16;
const MAX_PERSIST_INTERACTABLES = 10;
const MAX_PERSIST_TIGERS = 24;
const MAX_PERSIST_CIVILIANS = 24;

function capTail(list, max){
  if(!Array.isArray(list)) return [];
  if(list.length <= max) return list;
  return list.slice(-max);
}
function capHead(list, max){
  if(!Array.isArray(list)) return [];
  if(list.length <= max) return list;
  return list.slice(0, max);
}
function trimPersistentState(state){
  if(!state || typeof state !== "object") return state;
  state.carcasses = capTail(state.carcasses, MAX_PERSIST_CARCASSES);
  state.pickups = capTail(state.pickups, MAX_PERSIST_PICKUPS);
  state.trapsPlaced = capTail(state.trapsPlaced, MAX_PERSIST_TRAPS);
  state.rescueSites = capHead(state.rescueSites, MAX_PERSIST_RESCUE_SITES);
  state.supportUnits = capHead(state.supportUnits, MAX_PERSIST_SUPPORT_UNITS);
  state.mapInteractables = capHead(state.mapInteractables, MAX_PERSIST_INTERACTABLES);
  state.tigers = capHead(state.tigers, MAX_PERSIST_TIGERS);
  state.civilians = capHead(state.civilians, MAX_PERSIST_CIVILIANS);
  return state;
}
function buildPersistedState(){
  const out = { ...S };
  delete out._tutorialSnapshot;
  delete out._tutorialPrev;
  out.carcasses = capTail(S.carcasses, MAX_PERSIST_CARCASSES);
  out.pickups = capTail(S.pickups, MAX_PERSIST_PICKUPS);
  out.trapsPlaced = capTail(S.trapsPlaced, MAX_PERSIST_TRAPS);
  out.rescueSites = capHead(S.rescueSites, MAX_PERSIST_RESCUE_SITES);
  out.supportUnits = capHead(S.supportUnits, MAX_PERSIST_SUPPORT_UNITS);
  out.mapInteractables = capHead(S.mapInteractables, MAX_PERSIST_INTERACTABLES);
  out.tigers = capHead(S.tigers, MAX_PERSIST_TIGERS);
  out.civilians = capHead(S.civilians, MAX_PERSIST_CIVILIANS);
  return out;
}

let __lastSave = 0;
let __lastHudRender = 0;
let __lastAutosave = 0;
let __savePending = false;
const __frameTaskGate = Object.create(null);
const MAP_CACHE_INTERVAL_MS = 56;
let __mapFrameCacheCanvas = null;
let __mapFrameCacheCtx = null;
let __mapFrameCacheSig = "";
let __mapFrameCacheAt = 0;
let __mapObstacleSig = "";
let __mapObstacleRects = [];
let __mapObstacleCircles = [];
let __mapWaterSig = "";
let __mapWaterZones = [];
let __frameSlowUntil = 0;
let __frameLagScore = 0;
let __lastFrameAt = 0;
let __drawLoopStarted = false;
let __frameRecoverUntil = 0;
let __frameHeavyFxFlip = 0;
let __frameSpikePending = false;
const __frameErrorGate = Object.create(null);
const __blockedAtCache = new Map();
let __blockedAtCacheFrame = 0;
const __frameBudgetState = {
  frameNo: 0,
  startTs: 0,
  limitMs: 12.6,
  dropped: 0
};
const __freezeRecoverState = {
  lastRecoverAt: 0,
  history: []
};
const __stabilityMonitorState = {
  node: null,
  lastRenderAt: 0,
  lastSpikeAt: 0,
  frameGaps: [],
  frameCosts: []
};

function invalidateMapCache(){
  __mapFrameCacheSig = "";
  __mapFrameCacheAt = 0;
  __mapObstacleSig = "";
  __mapObstacleRects = [];
  __mapObstacleCircles = [];
  __mapWaterSig = "";
  __mapWaterZones = [];
  __blockedAtCache.clear();
  __blockedAtCacheFrame = 0;
}

function flushSaveNow(){
  __lastSave = Date.now();
  __savePending = false;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState()));
}

function save(force=false){
  try{
    const now = Date.now();
    if(force){
      flushSaveNow();
      return;
    }
    __savePending = true;
    if((now - __lastSave) < SAVE_MIN_INTERVAL_MS) return;
    flushSaveNow();
  }
  catch(e){
    console.log("Save failed:", e);
  }
}

function maybeAutosave(force=false){
  const now = Date.now();
  if(force || (__savePending && (now - __lastAutosave) > SAVE_AUTOSAVE_MS)){
    __lastAutosave = now;
    save(true);
  }
}

function normalizePerformanceMode(mode){
  return mode === "PERFORMANCE" ? "PERFORMANCE" : "AUTO";
}
function performanceMode(){
  if(!S || typeof S !== "object") return "AUTO";
  S.performanceMode = normalizePerformanceMode(S.performanceMode);
  return S.performanceMode;
}
function updatePerformanceLabels(){
  const mode = performanceMode();
  const label = mode === "PERFORMANCE" ? "Performance" : "Auto";
  const perfLbl = document.getElementById("perfLbl");
  if(perfLbl) perfLbl.innerText = label;
  const perfLblMobile = document.getElementById("perfLblMobile");
  if(perfLblMobile) perfLblMobile.innerText = label;
}
function togglePerformanceMode(){
  const mode = performanceMode();
  S.performanceMode = mode === "PERFORMANCE" ? "AUTO" : "PERFORMANCE";
  updatePerformanceLabels();
  save();
  toast(S.performanceMode === "PERFORMANCE"
    ? "Performance mode enabled (more stable on heavy missions)."
    : "Performance mode set to Auto.");
}
function toggleLagMonitor(force){
  if(typeof force === "boolean"){
    window.__TS_SHOW_MONITOR__ = force;
  } else {
    window.__TS_SHOW_MONITOR__ = !window.__TS_SHOW_MONITOR__;
  }
  renderStabilityMonitor(true);
  toast(window.__TS_SHOW_MONITOR__ ? "Lag monitor ON" : "Lag monitor OFF");
}
function beginFrameBudget(frameStartTs){
  const now = Number.isFinite(frameStartTs) ? frameStartTs : (performance.now ? performance.now() : Date.now());
  const mode = performanceMode();
  let limit = mode === "PERFORMANCE" ? 9.8 : 12.6;
  if(frameIsSlow(now)) limit -= 1.6;
  if(now < (__frameRecoverUntil || 0)) limit = Math.min(limit, 8.2);
  __frameBudgetState.frameNo += 1;
  if(__blockedAtCacheFrame !== __frameBudgetState.frameNo){
    __blockedAtCache.clear();
    __blockedAtCacheFrame = __frameBudgetState.frameNo;
  }
  __frameBudgetState.startTs = now;
  __frameBudgetState.limitMs = clamp(limit, 6.6, 14.8);
  __frameBudgetState.dropped = 0;
}
function frameBudgetExceeded(costHint=0){
  const now = performance.now ? performance.now() : Date.now();
  if(!Number.isFinite(__frameBudgetState.startTs) || __frameBudgetState.startTs <= 0) return false;
  const used = now - (__frameBudgetState.startTs || now);
  return (used + Math.max(0, costHint || 0)) > (__frameBudgetState.limitMs || 12.6);
}
function reportTickError(key, err){
  const now = Date.now();
  if((__frameErrorGate[key] || 0) + 2200 < now){
    __frameErrorGate[key] = now;
    console.error(`Tick recovered from error (${key}):`, err);
  }
  __frameRecoverUntil = (performance.now ? performance.now() : now) + 1800;
  __frameSlowUntil = Math.max(__frameSlowUntil || 0, (performance.now ? performance.now() : now) + 2200);
}
function safeTick(key, fn){
  try{
    fn();
    return true;
  }catch(err){
    reportTickError(key, err);
    return false;
  }
}
function runFrameTask(key, intervalMs, fn, options={}){
  const opts = options || {};
  const now = Date.now();
  if(now < (__frameTaskGate[key] || 0)) return false;
  const costHint = Math.max(0, Number(opts.costHint) || 0);
  const critical = !!opts.critical;
  if(!critical && frameBudgetExceeded(costHint)){
    __frameTaskGate[key] = now + Math.min(intervalMs, 40);
    __frameBudgetState.dropped = (__frameBudgetState.dropped || 0) + 1;
    if(__frameBudgetState.dropped >= 6){
      const perfNow = performance.now ? performance.now() : now;
      __frameSlowUntil = Math.max(__frameSlowUntil || 0, perfNow + 1400);
    }
    return false;
  }
  __frameTaskGate[key] = now + intervalMs;
  safeTick(key, fn);
  return true;
}

function frameIsSlow(nowTs){
  const now = Number.isFinite(nowTs) ? nowTs : (performance.now ? performance.now() : Date.now());
  return now < (__frameSlowUntil || 0);
}

function frameInterval(baseMs, slowMul=1.45){
  const modeMul = performanceMode() === "PERFORMANCE" ? 1.24 : 1;
  if(frameIsSlow()) return Math.max(baseMs + 1, Math.round(baseMs * Math.max(slowMul, modeMul)));
  if(modeMul > 1) return Math.max(baseMs + 1, Math.round(baseMs * modeMul));
  return baseMs;
}

function __pushStabilitySample(list, value, cap=STABILITY_MONITOR_SAMPLE_MAX){
  if(!Array.isArray(list)) return;
  list.push(value);
  if(list.length > cap) list.splice(0, list.length - cap);
}
function __avgStabilitySample(list){
  if(!Array.isArray(list) || !list.length) return 0;
  let total = 0;
  for(const v of list) total += Number(v) || 0;
  return total / list.length;
}
function __maxStabilitySample(list){
  if(!Array.isArray(list) || !list.length) return 0;
  let max = 0;
  for(const v of list){
    const n = Number(v) || 0;
    if(n > max) max = n;
  }
  return max;
}
function ensureStabilityMonitorNode(){
  if(__stabilityMonitorState.node && document.body?.contains(__stabilityMonitorState.node)) return __stabilityMonitorState.node;
  const el = document.createElement("div");
  el.id = "stabilityMonitor";
  el.style.cssText = [
    "position:fixed",
    "right:10px",
    "top:10px",
    "z-index:80",
    "display:none",
    "pointer-events:none",
    "padding:6px 8px",
    "max-width:76vw",
    "border-radius:10px",
    "border:1px solid rgba(148,163,184,.34)",
    "background:rgba(6,10,18,.62)",
    "color:#dbeafe",
    "font:700 11px/1.28 system-ui",
    "letter-spacing:.02em",
    "backdrop-filter: blur(5px)"
  ].join(";");
  el.innerText = "Perf monitor";
  try{ document.body.appendChild(el); }catch(e){ return null; }
  __stabilityMonitorState.node = el;
  return el;
}
function shouldShowStabilityMonitor(now=Date.now()){
  if(window.__TS_SHOW_MONITOR__ === true) return true;
  if(window.__TUTORIAL_MODE__) return false;
  if(performanceMode() === "PERFORMANCE") return true;
  if(frameIsSlow()) return true;
  return (now - (__stabilityMonitorState.lastSpikeAt || 0)) < 9000;
}
function renderStabilityMonitor(force=false){
  const now = Date.now();
  if(!force && (now - (__stabilityMonitorState.lastRenderAt || 0) < 260)) return;
  __stabilityMonitorState.lastRenderAt = now;
  const node = ensureStabilityMonitorNode();
  if(!node) return;
  const visible = shouldShowStabilityMonitor(now);
  node.style.display = visible ? "block" : "none";
  if(!visible) return;

  const avgGap = __avgStabilitySample(__stabilityMonitorState.frameGaps);
  const avgCost = __avgStabilitySample(__stabilityMonitorState.frameCosts);
  const worstGap = __maxStabilitySample(__stabilityMonitorState.frameGaps);
  const worstCost = __maxStabilitySample(__stabilityMonitorState.frameCosts);
  const fps = avgGap > 0 ? (1000 / avgGap) : 0;
  const dropped = Number(__frameBudgetState.dropped || 0);
  const recoversMin = (__freezeRecoverState.history || []).filter((t)=>(now - t) < 60000).length;
  const mode = performanceMode() === "PERFORMANCE" ? "PERF" : "AUTO";
  node.innerText =
    `FPS ${fps.toFixed(0)} | gap ${avgGap.toFixed(1)}ms (max ${worstGap.toFixed(0)})` +
    `\nframe ${avgCost.toFixed(1)}ms (max ${worstCost.toFixed(0)}) | drop ${dropped}` +
    `\nmode ${mode} | recov ${recoversMin}/min`;
}
function noteFrameSample(frameGap, frameCost){
  __pushStabilitySample(__stabilityMonitorState.frameGaps, frameGap);
  __pushStabilitySample(__stabilityMonitorState.frameCosts, frameCost);
  if(frameGap > 70 || frameCost > 30){
    __stabilityMonitorState.lastSpikeAt = Date.now();
  }
  renderStabilityMonitor(false);
}
function canRunStabilityRecovery(now=Date.now()){
  __freezeRecoverState.history = (__freezeRecoverState.history || []).filter((t)=>(now - t) < 60000);
  if((now - (__freezeRecoverState.lastRecoverAt || 0)) < STABILITY_RECOVER_COOLDOWN_MS) return false;
  if(__freezeRecoverState.history.length >= STABILITY_RECOVER_MAX_PER_MIN) return false;
  return true;
}
function runStabilityRecovery(reason="stall"){
  const now = Date.now();
  if(!canRunStabilityRecovery(now)) return false;
  __freezeRecoverState.lastRecoverAt = now;
  __freezeRecoverState.history.push(now);

  for(const k of Object.keys(__frameTaskGate)) delete __frameTaskGate[k];
  __frameSpikePending = false;
  __frameLagScore = 0;
  const perfNow = performance.now ? performance.now() : now;
  __frameRecoverUntil = Math.max(__frameRecoverUntil || 0, perfNow + 2200);
  __frameSlowUntil = Math.max(__frameSlowUntil || 0, perfNow + 2600);

  try{ if(typeof clearTransientCombatVisuals === "function") clearTransientCombatVisuals(); }catch(e){}
  try{ if(typeof transitionCleanupSweep === "function") transitionCleanupSweep(`recover:${reason}`); }catch(e){}
  try{ if(typeof sanitizeRuntimeState === "function") sanitizeRuntimeState(); }catch(e){}
  try{ if(typeof clampWorldToCanvas === "function") clampWorldToCanvas(); }catch(e){}
  try{
    if(typeof validateMissionSpawnLayout === "function"){
      const res = validateMissionSpawnLayout({ repair:true });
      if((res?.fixed || 0) > 0){
        setEventText(`Stability recovered • spawn fixes: ${res.fixed}`, 1.4);
      } else {
        setEventText("Stability recovered.", 1.1);
      }
    } else {
      setEventText("Stability recovered.", 1.1);
    }
  }catch(e){}
  try{ maybeRenderHUD(true); }catch(e){}
  try{ renderCombatControls(); }catch(e){}
  try{ updateAttackButton(); }catch(e){}
  return true;
}

function shouldSuspendForHiddenDocument(){
  const hidden = !!document.hidden;
  if(!hidden) return false;
  const inTelegramMiniApp = !!window.Telegram?.WebApp;
  const coarsePointer = !!window.matchMedia?.("(pointer:coarse)")?.matches;
  return !(inTelegramMiniApp || coarsePointer);
}

function updateFrameLoad(frameStartTs){
  const now = performance.now ? performance.now() : Date.now();
  if(!Number.isFinite(__lastFrameAt) || __lastFrameAt <= 0){
    __lastFrameAt = now;
    noteFrameSample(16.7, 0);
    return;
  }
  const frameGap = now - __lastFrameAt;
  __lastFrameAt = now;
  const frameCost = now - frameStartTs;
  noteFrameSample(frameGap, frameCost);
  if(frameGap > STABILITY_SPIKE_GAP_MS || frameCost > 46){
    __frameSpikePending = true;
  }
  if(frameGap > STABILITY_STALL_HARD_GAP_MS || frameCost > STABILITY_STALL_COST_MS){
    runStabilityRecovery(frameGap > STABILITY_STALL_HARD_GAP_MS ? "hard-gap" : "hard-cost");
  } else if(frameGap > STABILITY_STALL_GAP_MS){
    __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + 3000);
  }
  if(frameGap > 70 || frameCost > 34){
    __frameLagScore = Math.min(20, (__frameLagScore || 0) + 2);
  } else {
    __frameLagScore = Math.max(0, (__frameLagScore || 0) - 1);
  }
  if(__frameLagScore >= 6){
    __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + 2400);
    __frameLagScore = 2;
  }
}

function recoverFromSpikeFrame(){
  __frameSpikePending = false;
  const now = performance.now ? performance.now() : Date.now();
  __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + STABILITY_SPIKE_RECOVER_MS);
  __frameRecoverUntil = Math.max(__frameRecoverUntil || 0, now + 1800);
  if(COMBAT_FX.length > 24) COMBAT_FX.splice(0, COMBAT_FX.length - 24);
  if(DAMAGE_POPUPS.length > 24) DAMAGE_POPUPS.splice(0, DAMAGE_POPUPS.length - 24);
  if(S && typeof S === "object"){
    S.scanPing = Math.min(42, Math.max(0, S.scanPing || 0));
    for(const t of (S.tigers || [])){
      t.vx = clamp(Number.isFinite(t.vx) ? t.vx : 0, -4.2, 4.2);
      t.vy = clamp(Number.isFinite(t.vy) ? t.vy : 0, -4.2, 4.2);
      if(!Number.isFinite(t.heading)) t.heading = Math.atan2(t.vy || 0, t.vx || 1);
    }
  }
}

function trimActiveEntityLoad(){
  if(!S || typeof S !== "object") return;
  const meX = Number.isFinite(S?.me?.x) ? S.me.x : (cv.width * 0.5);
  const meY = Number.isFinite(S?.me?.y) ? S.me.y : (cv.height * 0.5);

  if(Array.isArray(S.tigers) && S.tigers.length > STABILITY_SOFT_CAP_TIGERS){
    const keep = [];
    const overflow = [];
    for(const t of S.tigers){
      if(!t || typeof t !== "object") continue;
      const priority = !!(isBossTiger(t) || t.id === S.activeTigerId || t.id === S.lockedTigerId);
      if(priority){
        keep.push(t);
      } else {
        overflow.push(t);
      }
    }
    overflow.sort((a, b)=>{
      const da = dist(meX, meY, a.x, a.y);
      const db = dist(meX, meY, b.x, b.y);
      return da - db;
    });
    S.tigers = [...keep, ...overflow].slice(0, STABILITY_SOFT_CAP_TIGERS);
  }

  if(Array.isArray(S.civilians) && S.civilians.length > STABILITY_SOFT_CAP_CIVILIANS){
    const alive = S.civilians.filter((c)=>c && c.alive && !c.evac);
    const others = S.civilians.filter((c)=>!alive.includes(c));
    S.civilians = [...alive, ...others].slice(0, STABILITY_SOFT_CAP_CIVILIANS);
  }
  if(Array.isArray(S.pickups) && S.pickups.length > STABILITY_SOFT_CAP_PICKUPS){
    S.pickups = S.pickups.slice(-STABILITY_SOFT_CAP_PICKUPS);
  }
  if(Array.isArray(S.carcasses) && S.carcasses.length > STABILITY_SOFT_CAP_CARCASSES){
    S.carcasses = S.carcasses.slice(-STABILITY_SOFT_CAP_CARCASSES);
  }
  if(Array.isArray(S.trapsPlaced) && S.trapsPlaced.length > STABILITY_SOFT_CAP_TRAPS){
    S.trapsPlaced = S.trapsPlaced.slice(-STABILITY_SOFT_CAP_TRAPS);
  }
}

function stabilityHealthTick(){
  if(!S || typeof S !== "object") return;
  if(!Array.isArray(S.tigers)) S.tigers = [];
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.carcasses)) S.carcasses = [];
  if(!Array.isArray(S.trapsPlaced)) S.trapsPlaced = [];

  trimActiveEntityLoad();

  if(!Number.isFinite(S.hp) || !Number.isFinite(S.armor) || !Number.isFinite(S.stamina)){
    sanitizeRuntimeState();
    return;
  }

  if(S.inBattle){
    const t = tigerById(S.activeTigerId);
    if(!t || !t.alive){
      endBattle();
    }
  }

  if(S.lockedTigerId != null && !S.tigers.some((t)=>t && t.alive && t.id === S.lockedTigerId)){
    S.lockedTigerId = null;
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
const STARS_DEBUG_ENABLED_KEY = "ts_stars_debug_enabled";
let starsDebugPanelOpen = false;
let starsDebugEntries = [];
function starsDebugEnabled(){
  try{
    const v = localStorage.getItem(STARS_DEBUG_ENABLED_KEY);
    if(v == null){
      localStorage.setItem(STARS_DEBUG_ENABLED_KEY, "1");
      return true;
    }
    return v === "1";
  }catch(e){
    return false;
  }
}
function setStarsDebugEnabled(on){
  const next = !!on;
  try{
    localStorage.setItem(STARS_DEBUG_ENABLED_KEY, next ? "1" : "0");
  }catch(e){}
  renderStarsDebugPanel();
}
function shortDebugRef(ref){
  const txt = String(ref || "").trim();
  if(!txt) return "-";
  if(txt.length <= 28) return txt;
  return `${txt.slice(0,14)}…${txt.slice(-10)}`;
}
function sanitizeDebugDetails(details){
  if(!details || typeof details !== "object") return "";
  const out = {};
  for(const [k, v] of Object.entries(details)){
    if(v == null) continue;
    if(typeof v === "string"){
      out[k] = v.length > 120 ? `${v.slice(0,117)}...` : v;
    } else {
      out[k] = v;
    }
  }
  const keys = Object.keys(out);
  if(!keys.length) return "";
  try{
    return JSON.stringify(out);
  }catch(e){
    return "";
  }
}
function pushStarsDebug(event, details){
  if(!starsDebugEnabled()) return;
  const ts = new Date();
  const hh = String(ts.getHours()).padStart(2, "0");
  const mm = String(ts.getMinutes()).padStart(2, "0");
  const ss = String(ts.getSeconds()).padStart(2, "0");
  const suffix = sanitizeDebugDetails(details);
  starsDebugEntries.push(`[${hh}:${mm}:${ss}] ${String(event || "event")}${suffix ? ` ${suffix}` : ""}`);
  if(starsDebugEntries.length > 80){
    starsDebugEntries = starsDebugEntries.slice(-80);
  }
  renderStarsDebugPanel();
}
function copyStarsDebugLog(){
  const lines = starsDebugEntries.join("\n");
  if(!lines){
    toast("No Stars debug logs yet.");
    return;
  }
  const status = `pending=${shortDebugRef(starsPendingOrderRef || readStarsPendingOrderRef())} | user=${tgUserKey()}`;
  const text = `Tiger Strike Stars Debug\n${status}\n\n${lines}`;
  const done = ()=>toast("Stars debug copied.");
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(text).then(done).catch(()=>toast("Copy failed."));
    return;
  }
  try{
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    done();
  }catch(e){
    toast("Copy failed.");
  }
}
function ensureStarsDebugUi(){
  if(typeof document === "undefined" || !document.body) return;
  if(document.getElementById("starsDebugToggle")) return;

  const toggle = document.createElement("button");
  toggle.id = "starsDebugToggle";
  toggle.type = "button";
  toggle.textContent = "DBG";
  toggle.style.position = "fixed";
  toggle.style.right = "10px";
  toggle.style.bottom = "10px";
  toggle.style.zIndex = "9999";
  toggle.style.fontSize = "11px";
  toggle.style.fontWeight = "800";
  toggle.style.borderRadius = "999px";
  toggle.style.padding = "6px 10px";
  toggle.style.border = "1px solid rgba(255,255,255,.35)";
  toggle.style.color = "#e5eefc";
  toggle.style.background = "rgba(12,22,42,.82)";
  toggle.style.boxShadow = "0 4px 14px rgba(0,0,0,.4)";
  toggle.style.cursor = "pointer";
  toggle.setAttribute("aria-label", "Open Stars debug panel");

  const panel = document.createElement("div");
  panel.id = "starsDebugPanel";
  panel.style.position = "fixed";
  panel.style.right = "10px";
  panel.style.bottom = "42px";
  panel.style.width = "min(92vw, 320px)";
  panel.style.maxHeight = "42vh";
  panel.style.zIndex = "9999";
  panel.style.display = "none";
  panel.style.flexDirection = "column";
  panel.style.background = "rgba(8,14,28,.96)";
  panel.style.border = "1px solid rgba(100,170,255,.45)";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 12px 28px rgba(0,0,0,.48)";
  panel.style.color = "#e5eefc";
  panel.style.overflow = "hidden";
  panel.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;background:rgba(38,93,182,.2);font-size:12px;font-weight:700;">
      <span>Stars Debug</span>
      <button id="starsDebugClose" type="button" style="border:1px solid rgba(255,255,255,.35);border-radius:8px;background:rgba(17,24,39,.65);color:#e5eefc;padding:2px 8px;font-size:11px;cursor:pointer;">Close</button>
    </div>
    <div id="starsDebugStatus" style="padding:8px 10px;border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);font-size:11px;line-height:1.35;"></div>
    <div id="starsDebugLog" style="padding:8px 10px;overflow:auto;max-height:26vh;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;white-space:pre-wrap;line-height:1.35;"></div>
    <div style="display:flex;gap:6px;padding:8px 10px;border-top:1px solid rgba(255,255,255,.07);">
      <button id="starsDebugCopy" type="button" style="flex:1;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(30,64,175,.45);color:#e5eefc;padding:6px 8px;font-size:11px;font-weight:600;cursor:pointer;">Copy</button>
      <button id="starsDebugClear" type="button" style="flex:1;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(55,65,81,.55);color:#e5eefc;padding:6px 8px;font-size:11px;font-weight:600;cursor:pointer;">Clear</button>
      <button id="starsDebugToggleLog" type="button" style="flex:1;border:1px solid rgba(255,255,255,.3);border-radius:8px;background:rgba(37,99,235,.55);color:#e5eefc;padding:6px 8px;font-size:11px;font-weight:600;cursor:pointer;">Log: ON</button>
    </div>
  `;

  toggle.addEventListener("click", ()=>{
    starsDebugPanelOpen = !starsDebugPanelOpen;
    renderStarsDebugPanel();
  });
  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  document.getElementById("starsDebugClose")?.addEventListener("click", ()=>{
    starsDebugPanelOpen = false;
    renderStarsDebugPanel();
  });
  document.getElementById("starsDebugCopy")?.addEventListener("click", copyStarsDebugLog);
  document.getElementById("starsDebugClear")?.addEventListener("click", ()=>{
    starsDebugEntries = [];
    renderStarsDebugPanel();
    toast("Stars debug cleared.");
  });
  document.getElementById("starsDebugToggleLog")?.addEventListener("click", ()=>{
    setStarsDebugEnabled(!starsDebugEnabled());
    toast(`Stars debug logging ${starsDebugEnabled() ? "ON" : "OFF"}.`);
  });
  renderStarsDebugPanel();
}
function renderStarsDebugPanel(){
  const toggle = document.getElementById("starsDebugToggle");
  const panel = document.getElementById("starsDebugPanel");
  const log = document.getElementById("starsDebugLog");
  const status = document.getElementById("starsDebugStatus");
  const toggleLog = document.getElementById("starsDebugToggleLog");
  if(!toggle || !panel || !log || !status || !toggleLog) return;

  const enabled = starsDebugEnabled();
  panel.style.display = starsDebugPanelOpen ? "flex" : "none";
  toggle.style.background = enabled ? "rgba(22,101,52,.84)" : "rgba(12,22,42,.82)";
  toggle.style.borderColor = enabled ? "rgba(134,239,172,.72)" : "rgba(255,255,255,.35)";
  toggleLog.textContent = `Log: ${enabled ? "ON" : "OFF"}`;
  toggleLog.style.background = enabled ? "rgba(37,99,235,.55)" : "rgba(55,65,81,.55)";
  status.textContent = `User: ${tgUserKey()} | Pending: ${shortDebugRef(starsPendingOrderRef || readStarsPendingOrderRef())}`;
  log.textContent = starsDebugEntries.length ? starsDebugEntries.join("\n") : "No Stars events yet.";
  log.scrollTop = log.scrollHeight;
}
function clamp(n,min,max){
  const lo = Number.isFinite(min) ? min : 0;
  const hi = Number.isFinite(max) ? max : lo;
  const v = Number.isFinite(n) ? n : lo;
  return Math.max(lo, Math.min(hi, v));
}
function rand(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
function normalizeAngle(a){
  let v = a;
  while(v > Math.PI) v -= Math.PI * 2;
  while(v < -Math.PI) v += Math.PI * 2;
  return v;
}
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
    ? Math.round(clamp(vh * 0.78, 280, 430))
    : Math.round(clamp(vh * 1.08, 820, 980));
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
const MOBILE_MENU_PREF_KEY = "ts_mobile_menu_hidden";
let __mobileMenuHiddenPref = false;
const TOUCH_HUD_DEFAULT = Object.freeze({
  opacity: 44,
  size: 100,
  stickX: 0,
  stickY: 0,
  actionX: 0,
  actionY: 0,
  cacheX: 0,
  cacheY: 0
});
let __touchHudSaveTimer = 0;
function canToggleMobileMenu(){
  return isMobileViewport() || !!window.matchMedia?.("(pointer:coarse)")?.matches;
}
function applyMobileMenuState(hidden){
  const body = document.body;
  if(!body) return;
  const btn = document.getElementById("mobileMenuToggle");
  if(!canToggleMobileMenu()){
    body.classList.remove("mobileMenuHidden");
    if(btn) btn.style.display = "none";
    return;
  }
  body.classList.toggle("mobileMenuHidden", !!hidden);
  if(btn){
    btn.style.display = "block";
    btn.innerText = hidden ? "Show Menu" : "Hide Menu";
    btn.setAttribute("aria-label", hidden ? "Show bottom menu" : "Hide bottom menu");
  }
}
function toggleMobileMenu(force){
  const body = document.body;
  if(!body) return;
  const next = (typeof force === "boolean")
    ? !!force
    : !body.classList.contains("mobileMenuHidden");
  __mobileMenuHiddenPref = next;
  applyMobileMenuState(next);
  try{ localStorage.setItem(MOBILE_MENU_PREF_KEY, next ? "1" : "0"); }catch(e){}
}
function initMobileMenuToggle(){
  try{
    __mobileMenuHiddenPref = localStorage.getItem(MOBILE_MENU_PREF_KEY) === "1";
  }catch(e){
    __mobileMenuHiddenPref = false;
  }
  applyMobileMenuState(__mobileMenuHiddenPref);
}
function normalizeTouchHudSettings(raw){
  const src = (raw && typeof raw === "object") ? raw : {};
  return {
    opacity: clamp(Math.round(Number(src.opacity ?? TOUCH_HUD_DEFAULT.opacity)), 20, 90),
    size: clamp(Math.round(Number(src.size ?? TOUCH_HUD_DEFAULT.size)), 80, 145),
    stickX: clamp(Math.round(Number(src.stickX ?? TOUCH_HUD_DEFAULT.stickX)), -160, 160),
    stickY: clamp(Math.round(Number(src.stickY ?? TOUCH_HUD_DEFAULT.stickY)), -180, 180),
    actionX: clamp(Math.round(Number(src.actionX ?? TOUCH_HUD_DEFAULT.actionX)), -180, 180),
    actionY: clamp(Math.round(Number(src.actionY ?? TOUCH_HUD_DEFAULT.actionY)), -200, 200),
    cacheX: clamp(Math.round(Number(src.cacheX ?? TOUCH_HUD_DEFAULT.cacheX)), -180, 180),
    cacheY: clamp(Math.round(Number(src.cacheY ?? TOUCH_HUD_DEFAULT.cacheY)), -220, 220),
  };
}
function ensureTouchHudState(){
  if(!S || typeof S !== "object") return normalizeTouchHudSettings(null);
  S.touchHud = normalizeTouchHudSettings(S.touchHud);
  return S.touchHud;
}
function applyTouchHudSettings(){
  const root = document.documentElement;
  if(!root) return;
  const hud = ensureTouchHudState();
  const baseOpacity = clamp(hud.opacity / 100, 0.20, 0.90);
  const scale = clamp(hud.size / 100, 0.80, 1.45);
  root.style.setProperty("--touch-ui-scale", scale.toFixed(2));
  root.style.setProperty("--touch-stick-offset-x", `${Math.round(hud.stickX)}px`);
  root.style.setProperty("--touch-stick-offset-y", `${Math.round(-hud.stickY)}px`);
  root.style.setProperty("--touch-cluster-offset-x", `${Math.round(hud.actionX)}px`);
  root.style.setProperty("--touch-cluster-offset-y", `${Math.round(-hud.actionY)}px`);
  root.style.setProperty("--touch-cache-offset-x", `${Math.round(hud.cacheX)}px`);
  root.style.setProperty("--touch-cache-offset-y", `${Math.round(-hud.cacheY)}px`);
  root.style.setProperty("--touch-stick-opacity", clamp(baseOpacity + 0.08, 0.24, 0.95).toFixed(2));
  root.style.setProperty("--touch-cluster-opacity", clamp(baseOpacity, 0.20, 0.92).toFixed(2));
  root.style.setProperty("--touch-cache-opacity", clamp(baseOpacity + 0.02, 0.20, 0.95).toFixed(2));
  root.style.setProperty("--touch-btn-opacity", clamp(baseOpacity - 0.04, 0.16, 0.86).toFixed(2));
}
function queueTouchHudSave(){
  if(__touchHudSaveTimer) clearTimeout(__touchHudSaveTimer);
  __touchHudSaveTimer = setTimeout(()=>{
    __touchHudSaveTimer = 0;
    save();
  }, 260);
}
function renderHudCustomizer(){
  const overlay = document.getElementById("hudOverlay");
  if(!overlay) return;
  const hud = ensureTouchHudState();
  const pairs = [
    ["hudOpacityRange", hud.opacity], ["hudOpacityValue", `${hud.opacity}%`],
    ["hudSizeRange", hud.size], ["hudSizeValue", `${hud.size}%`],
    ["hudStickXRange", hud.stickX], ["hudStickXValue", `${hud.stickX}`],
    ["hudStickYRange", hud.stickY], ["hudStickYValue", `${hud.stickY}`],
    ["hudActionXRange", hud.actionX], ["hudActionXValue", `${hud.actionX}`],
    ["hudActionYRange", hud.actionY], ["hudActionYValue", `${hud.actionY}`],
    ["hudCacheXRange", hud.cacheX], ["hudCacheXValue", `${hud.cacheX}`],
    ["hudCacheYRange", hud.cacheY], ["hudCacheYValue", `${hud.cacheY}`],
  ];
  for(const [id, value] of pairs){
    const el = document.getElementById(id);
    if(!el) continue;
    if(el.tagName === "INPUT") el.value = `${value}`;
    else el.innerText = `${value}`;
  }
}
function openHudCustomizer(){
  if(window.TigerTutorial?.isRunning) return toast("Finish the tutorial first.");
  if(S.gameOver) return;
  if(S.missionEnded){
    lastOverlay = "complete";
    const complete = document.getElementById("completeOverlay");
    if(complete) complete.style.display = "none";
  }
  const overlay = document.getElementById("hudOverlay");
  if(!overlay) return;
  setPaused(true, S.inBattle ? "hud-battle" : "hud");
  applyTouchHudSettings();
  renderHudCustomizer();
  overlay.style.display = "flex";
  syncGamepadFocus();
  sfx("ui");
}
function closeHudCustomizer(){
  const overlay = document.getElementById("hudOverlay");
  if(overlay) overlay.style.display = "none";
  if(S.missionEnded){
    setPaused(true, "complete");
    const complete = document.getElementById("completeOverlay");
    if(complete) complete.style.display = "flex";
    lastOverlay = null;
    syncGamepadFocus();
    return;
  }
  if(S.inBattle){
    setPaused(false, null);
    updateBattleButtons();
    updateAttackButton();
    if(anyLethalWeaponHasAmmo()) setBattleMsg(`Back in combat with Tiger #${S.activeTigerId}.`);
    else setBattleMsg("No lethal ammo. Open Shop or switch to Capture when the tiger is weak.");
    syncGamepadFocus();
    return;
  }
  setPaused(false, null);
  syncGamepadFocus();
}
function updateHudCustomizerSetting(key, rawValue){
  const hud = ensureTouchHudState();
  const ranges = {
    opacity: [20, 90],
    size: [80, 145],
    stickX: [-160, 160],
    stickY: [-180, 180],
    actionX: [-180, 180],
    actionY: [-200, 200],
    cacheX: [-180, 180],
    cacheY: [-220, 220],
  };
  if(!ranges[key]) return;
  const [min, max] = ranges[key];
  const next = clamp(Math.round(Number(rawValue) || 0), min, max);
  hud[key] = next;
  S.touchHud = hud;
  applyTouchHudSettings();
  renderHudCustomizer();
  queueTouchHudSave();
}
function applyHudPreset(name){
  const hud = ensureTouchHudState();
  if(name === "leftHanded"){
    hud.stickX = 118;
    hud.stickY = 0;
    hud.actionX = -118;
    hud.actionY = 0;
    hud.cacheX = 120;
    hud.cacheY = 0;
  } else {
    hud.stickX = 0;
    hud.stickY = 0;
    hud.actionX = 0;
    hud.actionY = 0;
    hud.cacheX = 0;
    hud.cacheY = 0;
  }
  S.touchHud = normalizeTouchHudSettings(hud);
  applyTouchHudSettings();
  renderHudCustomizer();
  save();
  toast(name === "leftHanded" ? "Left-handed HUD preset applied." : "Right-handed HUD preset applied.");
}
function resetHudCustomizer(){
  S.touchHud = normalizeTouchHudSettings(TOUCH_HUD_DEFAULT);
  applyTouchHudSettings();
  renderHudCustomizer();
  save();
  toast("HUD controls reset to default.");
}
function clampWorldToCanvas(){
  if(!S || typeof S !== "object") return;
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.tigers)) S.tigers = [];
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.carcasses)) S.carcasses = [];
  if(!Array.isArray(S.trapsPlaced)) S.trapsPlaced = [];
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  if(!Array.isArray(S.rescueSites)) S.rescueSites = [];
  if(!Array.isArray(S.mapInteractables)) S.mapInteractables = [];
  S.civilians = S.civilians.filter((c)=>c && typeof c === "object");
  S.tigers = S.tigers.filter((t)=>t && typeof t === "object");
  S.pickups = S.pickups.filter((p)=>p && typeof p === "object");
  S.carcasses = S.carcasses.filter((c)=>c && typeof c === "object");
  S.trapsPlaced = S.trapsPlaced.filter((t)=>t && typeof t === "object");
  S.supportUnits = S.supportUnits.filter((u)=>u && typeof u === "object");
  S.rescueSites = S.rescueSites.filter((s)=>s && typeof s === "object");
  S.mapInteractables = S.mapInteractables.filter((i)=>i && typeof i === "object");
  if(S.me){
    S.me.x = clamp(S.me.x, 40, cv.width - 40);
    S.me.y = clamp(S.me.y, 60, cv.height - 40);
    if(inMobileNoBuildZone(S.me.x, S.me.y, 16)){
      const mePt = safeSpawnPoint(S.me.x, S.me.y, 16, true, false);
      S.me.x = mePt.x;
      S.me.y = mePt.y;
      if(S.target && inMobileNoBuildZone(S.target.x, S.target.y, 20)) S.target = null;
    }
  }
  if(S.evacZone){
    S.evacZone.x = clamp(S.evacZone.x, 100, cv.width - 60);
    S.evacZone.y = clamp(S.evacZone.y, 100, cv.height - 60);
    if(inMapScenarioKeepout(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.90))){
      const zonePt = safeSpawnPoint(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.45), true, true);
      S.evacZone.x = zonePt.x;
      S.evacZone.y = zonePt.y;
    }
  }
  for(const civ of (S.civilians || [])){
    civ.x = clamp(civ.x, 50, cv.width - 50);
    civ.y = clamp(civ.y, 70, cv.height - 50);
    if(inMobileNoBuildZone(civ.x, civ.y, 14)){
      const civPt = safeSpawnPoint(civ.x, civ.y, 14, true, false);
      civ.x = civPt.x;
      civ.y = civPt.y;
    }
  }
  for(const tiger of (S.tigers || [])){
    tiger.x = clamp(tiger.x, 40, cv.width - 40);
    tiger.y = clamp(tiger.y, 60, cv.height - 40);
    if(inMobileNoBuildZone(tiger.x, tiger.y, 16)){
      const tigerPt = safeSpawnPoint(tiger.x, tiger.y, 16, true, false);
      tiger.x = tigerPt.x;
      tiger.y = tigerPt.y;
    }
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
    if(inMobileNoBuildZone(ally.x, ally.y, 16)){
      const allyPt = safeSpawnPoint(ally.x, ally.y, 16, true, false);
      ally.x = allyPt.x;
      ally.y = allyPt.y;
      ally.homeX = clamp(ally.homeX ?? ally.x, 40, cv.width - 40);
      ally.homeY = clamp(ally.homeY ?? ally.y, 60, cv.height - 40);
    }
  }
  for(const site of (S.rescueSites || [])){
    site.x = clamp(site.x, 70, cv.width - 70);
    site.y = clamp(site.y, 90, cv.height - 80);
    if(inMapScenarioKeepout(site.x, site.y, Math.round((site.r || 44) * 0.42))){
      const pt = safeSpawnPoint(site.x, site.y, Math.round((site.r || 44) * 0.42), true, true);
      site.x = pt.x;
      site.y = pt.y;
    }
  }
  for(const it of (S.mapInteractables || [])){
    it.x = clamp(it.x, 70, cv.width - 70);
    it.y = clamp(it.y, 90, cv.height - 80);
    if(inMapScenarioKeepout(it.x, it.y, Math.round((it.r || 22) * 0.9))){
      const pt = safeSpawnPoint(it.x, it.y, Math.round((it.r || 22) * 0.9), true, true);
      it.x = pt.x;
      it.y = pt.y;
    }
  }
}
function sanitizeRuntimeState(){
  if(!S || typeof S !== "object") return;
  ensureStoryMetaState();
  ensureTouchHudState();
  if(!Array.isArray(S.tigers)) S.tigers = [];
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.carcasses)) S.carcasses = [];
  if(!Array.isArray(S.trapsPlaced)) S.trapsPlaced = [];
  if(!Array.isArray(S.mapInteractables)) S.mapInteractables = [];
  if(!Array.isArray(S.rescueSites)) S.rescueSites = [];
  if(!Number.isFinite(S.soldierAttackersOwned)) S.soldierAttackersOwned = 0;
  if(!Number.isFinite(S.soldierRescuersOwned)) S.soldierRescuersOwned = 0;
  if(!Number.isFinite(S.soldierAttackersDowned)) S.soldierAttackersDowned = 0;
  if(!Number.isFinite(S.soldierRescuersDowned)) S.soldierRescuersDowned = 0;
  syncSquadRosterBounds();

  trimPersistentState(S);

  const w = cv.width || 960;
  const h = cv.height || 540;
  const clampX = (v, min=40, max=w-40)=>clamp(v, min, max);
  const clampY = (v, min=60, max=h-40)=>clamp(v, min, max);

  if(!S.me || typeof S.me !== "object") S.me = { ...DEFAULT.me };
  S.me.x = clampX(S.me.x, 40, w - 40);
  S.me.y = clampY(S.me.y, 60, h - 40);
  if(inMobileNoBuildZone(S.me.x, S.me.y, 16)){
    const mePt = safeSpawnPoint(S.me.x, S.me.y, 16, true, false);
    S.me.x = mePt.x;
    S.me.y = mePt.y;
  }
  if(!Number.isFinite(S.me.face)) S.me.face = 0;
  if(!Number.isFinite(S.me.step)) S.me.step = 0;
  if(!Number.isFinite(S.rollBufferedDodges)) S.rollBufferedDodges = 0;
  if(!Number.isFinite(S.rollBufferedUntil)) S.rollBufferedUntil = 0;
  if(!Number.isFinite(S.rollAnimStart)) S.rollAnimStart = 0;
  if(!Number.isFinite(S.rollAnimUntil)) S.rollAnimUntil = 0;
  S.rollAnimFromX = clampX(S.rollAnimFromX, 40, w - 40);
  S.rollAnimFromY = clampY(S.rollAnimFromY, 60, h - 40);
  S.rollAnimToX = clampX(S.rollAnimToX, 40, w - 40);
  S.rollAnimToY = clampY(S.rollAnimToY, 60, h - 40);

  if(!S.evacZone || typeof S.evacZone !== "object") S.evacZone = { ...DEFAULT.evacZone };
  S.evacZone.x = clampX(S.evacZone.x, 100, w - 60);
  S.evacZone.y = clampY(S.evacZone.y, 100, h - 60);
  S.evacZone.r = clamp(S.evacZone.r, 38, 120);
  if(inMapScenarioKeepout(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.90))){
    const evacPt = safeSpawnPoint(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.45), true, true);
    S.evacZone.x = evacPt.x;
    S.evacZone.y = evacPt.y;
  }

  S.tigers = S.tigers.filter((t)=>{
    if(!t || typeof t !== "object") return false;
    t.x = clampX(t.x, 40, w - 40);
    t.y = clampY(t.y, 60, h - 40);
    t.vx = clamp(Number.isFinite(t.vx) ? t.vx : 0, -8, 8);
    t.vy = clamp(Number.isFinite(t.vy) ? t.vy : 0, -8, 8);
    t.hpMax = Math.max(1, Math.round(Number.isFinite(t.hpMax) ? t.hpMax : 100));
    t.hp = clamp(Number.isFinite(t.hp) ? t.hp : t.hpMax, 0, t.hpMax);
    if(!Number.isFinite(t.heading)) t.heading = Math.atan2(t.vy || 0, t.vx || 1);
    if(!Number.isFinite(t.drawDir)) t.drawDir = (Math.cos(t.heading) >= 0 ? 1 : -1);
    if(!Number.isFinite(t.wanderAngle)) t.wanderAngle = Math.random() * Math.PI * 2;
    ensureTigerHuntState(t);
    if(inMobileNoBuildZone(t.x, t.y, 16)){
      const pt = safeSpawnPoint(t.x, t.y, 16, true, false);
      t.x = pt.x;
      t.y = pt.y;
    }
    t.alive = t.alive !== false && t.hp > 0;
    return true;
  }).slice(0, MAX_PERSIST_TIGERS);

  S.civilians = S.civilians.filter((c)=>{
    if(!c || typeof c !== "object") return false;
    c.x = clampX(c.x, 50, w - 50);
    c.y = clampY(c.y, 70, h - 50);
    c.hpMax = Math.max(1, Math.round(Number.isFinite(c.hpMax) ? c.hpMax : 100));
    c.hp = clamp(Number.isFinite(c.hp) ? c.hp : c.hpMax, 0, c.hpMax);
    c.alive = c.alive !== false && c.hp > 0;
    c.following = !!c.following;
    if(!Number.isFinite(c.followGraceUntil)) c.followGraceUntil = 0;
    if(!Number.isFinite(c.face)) c.face = 0;
    if(!Number.isFinite(c.step)) c.step = 0;
    if(inMobileNoBuildZone(c.x, c.y, 14)){
      const pt = safeSpawnPoint(c.x, c.y, 14, true, false);
      c.x = pt.x;
      c.y = pt.y;
    }
    return true;
  }).slice(0, MAX_PERSIST_CIVILIANS);

  S.supportUnits = S.supportUnits.filter((u)=>{
    if(!u || typeof u !== "object") return false;
    u.x = clampX(u.x, 40, w - 40);
    u.y = clampY(u.y, 60, h - 40);
    u.homeX = clampX(u.homeX ?? u.x, 40, w - 40);
    u.homeY = clampY(u.homeY ?? u.y, 60, h - 40);
    if(!u.role) u.role = "attacker";
    const desiredHpMax = storySupportHpMax(u.role);
    u.hpMax = Math.max(1, Math.round(desiredHpMax));
    u.hp = clamp(Number.isFinite(u.hp) ? u.hp : u.hpMax, 0, u.hpMax);
    u.armor = clamp(storySupportArmorBase(u.role), 0, 280);
    u.alive = u.alive !== false && u.hp > 0;
    if(!Number.isFinite(u.face)) u.face = 0;
    if(!Number.isFinite(u.step)) u.step = 0;
    if(inMobileNoBuildZone(u.x, u.y, 16)){
      const pt = safeSpawnPoint(u.x, u.y, 16, true, false);
      u.x = pt.x;
      u.y = pt.y;
      u.homeX = clampX(u.homeX ?? u.x, 40, w - 40);
      u.homeY = clampY(u.homeY ?? u.y, 60, h - 40);
    }
    return true;
  }).slice(0, MAX_PERSIST_SUPPORT_UNITS);

  S.pickups = S.pickups.filter((p)=>p && typeof p === "object" && Number.isFinite(p.x) && Number.isFinite(p.y)).slice(-MAX_PERSIST_PICKUPS);
  for(const p of S.pickups){
    p.x = clampX(p.x, 40, w - 40);
    p.y = clampY(p.y, 60, h - 40);
    p.ttl = Math.max(1, Math.round(Number.isFinite(p.ttl) ? p.ttl : 1));
    if(inMapScenarioKeepout(p.x, p.y, 12)){
      const pt = safeSpawnPoint(p.x, p.y, 12, true, false);
      p.x = pt.x;
      p.y = pt.y;
    }
  }
  S.carcasses = S.carcasses.filter((c)=>c && typeof c === "object" && Number.isFinite(c.x) && Number.isFinite(c.y)).slice(-MAX_PERSIST_CARCASSES);
  for(const c of S.carcasses){
    c.x = clampX(c.x, 40, w - 40);
    c.y = clampY(c.y, 60, h - 40);
  }
  S.trapsPlaced = S.trapsPlaced.filter((tr)=>tr && typeof tr === "object" && Number.isFinite(tr.x) && Number.isFinite(tr.y)).slice(-MAX_PERSIST_TRAPS);
  for(const tr of S.trapsPlaced){
    tr.x = clampX(tr.x, 40, w - 40);
    tr.y = clampY(tr.y, 60, h - 40);
    if(!Number.isFinite(tr.ttl)) tr.ttl = 0;
  }
  S.mapInteractables = S.mapInteractables.filter((it)=>it && typeof it === "object" && Number.isFinite(it.x) && Number.isFinite(it.y)).slice(0, MAX_PERSIST_INTERACTABLES);
  for(const it of S.mapInteractables){
    it.x = clampX(it.x, 70, w - 70);
    it.y = clampY(it.y, 90, h - 80);
    it.r = clamp(it.r, 12, 54);
    if(!Number.isFinite(it.uses)) it.uses = 0;
    if(inMapScenarioKeepout(it.x, it.y, it.r)){
      const pt = safeSpawnPoint(it.x, it.y, it.r, true, true);
      it.x = pt.x;
      it.y = pt.y;
    }
  }
  S.rescueSites = S.rescueSites.filter((site)=>site && typeof site === "object" && Number.isFinite(site.x) && Number.isFinite(site.y)).slice(0, MAX_PERSIST_RESCUE_SITES);
  for(const site of S.rescueSites){
    site.x = clampX(site.x, 70, w - 70);
    site.y = clampY(site.y, 90, h - 80);
    site.r = clamp(site.r, 24, 96);
    if(inMapScenarioKeepout(site.x, site.y, Math.round(site.r * 0.42))){
      const pt = safeSpawnPoint(site.x, site.y, Math.round(site.r * 0.42), true, true);
      site.x = pt.x;
      site.y = pt.y;
    }
  }

  S.hp = clamp(S.hp, 0, 100);
  S.armor = clamp(S.armor, 0, S.armorCap || 100);
  S.stamina = clamp(S.stamina, 0, 100);
  S.lives = clamp(Math.round(Number.isFinite(S.lives) ? S.lives : 5), 0, 99);
  ensureArmorPlateInventoryState();
  ensureArmorPlateFallbackState();
  ensureSupplySelectionState();
  if(typeof S.lastCombatLethalWeaponId !== "string") S.lastCombatLethalWeaponId = "";
  if(S.lockedTigerId != null && !S.tigers.some((t)=>t.id === S.lockedTigerId && t.alive)){
    S.lockedTigerId = null;
  }
  if(S.activeTigerId != null && !S.tigers.some((t)=>t.id === S.activeTigerId && t.alive)){
    S.activeTigerId = null;
    S.inBattle = false;
  }
  if(!Number.isFinite(S._tigerBatchStart)) S._tigerBatchStart = 0;
  if(COMBAT_FX.length > 96){
    COMBAT_FX.splice(0, COMBAT_FX.length - 96);
  }
}
function resizeCanvasForViewport(){
  const mobile = isMobileViewport();
  cv.width = mobile
    ? (isLandscapeViewport() ? 900 : 820)
    : 960;
  cv.height = mobile ? mobileCanvasHeight() : 540;
  try{ sanitizeRuntimeState(); }catch(e){}
  try{ clampWorldToCanvas(); }catch(e){}
  invalidateMapCache();
}
const STAMINA_COST_SCAN = 8;
const STAMINA_COST_SPRINT = 16;
const STAMINA_DRAIN_WALK = 0.035;
const STAMINA_DRAIN_SPRINT = 0.08;
const PLAYER_WALK_SPEED = 2.45;
const PLAYER_SPRINT_SPEED = 3.9;
const SHIELD_DURATION_MS = 5000;
const SHIELD_RADIUS = 150;
const SHIELD_PRICE = 1000;
const SOLDIER_PRICE = 50000;
const REINFORCEMENT_BUNDLE_PRICE = 80000;
const SQUAD_MAX_PER_ROLE = 8;
const SQUAD_UPKEEP_ATTACKER = 1400;
const SQUAD_UPKEEP_RESCUE = 1100;
const SQUAD_REVIVE_ATTACKER = 18000;
const SQUAD_REVIVE_RESCUE = 15000;
const SQUAD_REVIVE_ALL_DISCOUNT = 0.90;
const SQUAD_REVIVE_ALL_FLAT = 30000;
const SOLDIER_UNLOCK_LEVEL = 15;
const ROLL_COOLDOWN_MS = 2800;
const ROLL_INVULN_MS = 520;
const ROLL_TRAVEL_DIST = 92;
const ROLL_ANIM_MS = 420;
const ROLL_BUFFER_DODGE_MS = 1100;
const ESCORT_TAKEOVER_WINDOW_MS = 3000;
const ESCORT_TAKEOVER_DISTANCE = 92;
const WEAPON_RANGE_BANDS = { short:110, mid:170 };
const CIVILIAN_HIT_PCT_BY_TIGER = {
  Standard:[0.01,0.03],
  Scout:[0.03,0.05],
  Stalker:[0.05,0.07],
  Berserker:[0.07,0.10],
  Alpha:[0.10,0.12],
  Boss:[0.12,0.15],
};
const ABILITY_COOLDOWN_MS = { scan:6800, sprint:5200, shield:12000 };
const ABILITY_WHEEL = [
  { key:"scan", icon:"🛰️", color:"rgba(96,165,250,.95)" },
  { key:"sprint", icon:"⚡", color:"rgba(245,158,11,.95)" },
  { key:"shield", icon:"🛡️", color:"rgba(74,222,128,.95)" },
];
const MODE_THEME = Object.freeze({
  Story: Object.freeze({
    bg:"#0b111b",
    panel:"#121b2c",
    panel2:"#101829",
    border:"#2d4261",
    border2:"#253850",
    blue:"#4f8cff",
    accent:"#7db0ff",
    glow:"rgba(125,176,255,.34)",
    mapA:"rgba(245,158,11,.10)",
    mapB:"rgba(96,165,250,.10)",
  }),
  Arcade: Object.freeze({
    bg:"#090d18",
    panel:"#14152c",
    panel2:"#10112a",
    border:"#4b2e78",
    border2:"#3a225f",
    blue:"#47b6ff",
    accent:"#7bf7ff",
    glow:"rgba(123,247,255,.36)",
    mapA:"rgba(34,211,238,.12)",
    mapB:"rgba(192,132,252,.16)",
  }),
  Survival: Object.freeze({
    bg:"#100f16",
    panel:"#1a1320",
    panel2:"#150f1c",
    border:"#5a3343",
    border2:"#4a2937",
    blue:"#f97316",
    accent:"#fb7185",
    glow:"rgba(251,113,133,.30)",
    mapA:"rgba(251,113,133,.10)",
    mapB:"rgba(245,158,11,.09)",
  }),
});
let __modeThemeApplied = "";
function applyModeTheme(mode=S.mode){
  const key = MODE_THEME[mode] ? mode : "Story";
  if(__modeThemeApplied === key) return;
  __modeThemeApplied = key;
  const root = document.documentElement;
  if(!root) return;
  const theme = MODE_THEME[key];
  root.style.setProperty("--bg", theme.bg);
  root.style.setProperty("--panel", theme.panel);
  root.style.setProperty("--panel2", theme.panel2);
  root.style.setProperty("--border", theme.border);
  root.style.setProperty("--border2", theme.border2);
  root.style.setProperty("--blue", theme.blue);
  root.style.setProperty("--mode-accent", theme.accent);
  root.style.setProperty("--mode-glow", theme.glow);
  root.style.setProperty("--mode-map-a", theme.mapA);
  root.style.setProperty("--mode-map-b", theme.mapB);
}
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
function currentCampaignLevel(){
  if(S.mode==="Story") return Math.max(1, S.storyLevel || 1);
  if(S.mode==="Arcade") return Math.max(1, S.arcadeLevel || 1);
  return Math.max(1, S.survivalWave || 1);
}
function missionIndexForMode(mode=S.mode){
  if(mode==="Story") return clamp(Math.floor(S.storyLevel || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  if(mode==="Arcade") return clamp(Math.floor(S.arcadeLevel || 1), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  return Math.max(1, Math.floor(S.survivalWave || 1));
}
function chapterIndexForMode(mode=S.mode){
  if(mode==="Survival") return 1;
  return clamp(Math.ceil(missionIndexForMode(mode) / 10), 1, 10);
}
function mapFamilyKey(key){
  if(key==="ST_FOREST" || key==="AR_SAND_YARD" || key==="SV_NIGHT_WOODS") return "ST_FOREST";
  if(key==="ST_SUBURBS" || key==="AR_ARENA_BAY" || key==="SV_ASH_FIELD") return "ST_SUBURBS";
  if(key==="ST_DOWNTOWN" || key==="AR_NEON_GRID" || key==="SV_STORM_DISTRICT") return "ST_DOWNTOWN";
  return "ST_INDUSTRIAL";
}
function chapterVisualForMode(mode=S.mode, chapter=chapterIndexForMode(mode)){
  const list = CHAPTER_VISUALS[mode] || CHAPTER_VISUALS.Survival;
  return list[clamp(chapter, 1, list.length) - 1] || list[0] || CHAPTER_VISUALS.Survival[0];
}
function soldierUnlockLevelReached(){
  return currentCampaignLevel() >= SOLDIER_UNLOCK_LEVEL;
}
function hasPremiumSpecialistUnlock(role){
  if(role !== "attacker" && role !== "rescue") return false;
  const unlocks = S?.specialistStarUnlocks;
  if(!unlocks || typeof unlocks !== "object") return false;
  return !!unlocks[role];
}
function specialistRoleUnlocked(role){
  if(hasPremiumSpecialistUnlock(role)) return true;
  return soldierUnlockLevelReached();
}
function syncSquadRosterBounds(){
  S.soldierAttackersOwned = clamp(Math.floor(Number(S.soldierAttackersOwned || 0)), 0, SQUAD_MAX_PER_ROLE);
  S.soldierRescuersOwned = clamp(Math.floor(Number(S.soldierRescuersOwned || 0)), 0, SQUAD_MAX_PER_ROLE);
  S.soldierAttackersDowned = clamp(Math.floor(Number(S.soldierAttackersDowned || 0)), 0, S.soldierAttackersOwned);
  S.soldierRescuersDowned = clamp(Math.floor(Number(S.soldierRescuersDowned || 0)), 0, S.soldierRescuersOwned);
}
function squadOwnedCount(role){
  return role === "attacker" ? (S.soldierAttackersOwned || 0) : (S.soldierRescuersOwned || 0);
}
function squadDownedCount(role){
  return role === "attacker" ? (S.soldierAttackersDowned || 0) : (S.soldierRescuersDowned || 0);
}
function squadAliveCount(role){
  return Math.max(0, squadOwnedCount(role) - squadDownedCount(role));
}
function squadUpkeepUnitCost(role){
  return role === "attacker" ? SQUAD_UPKEEP_ATTACKER : SQUAD_UPKEEP_RESCUE;
}
function squadReviveUnitCost(role){
  return role === "attacker" ? SQUAD_REVIVE_ATTACKER : SQUAD_REVIVE_RESCUE;
}
function squadReviveAllCost(){
  return SQUAD_REVIVE_ALL_FLAT;
}
function syncActiveSupportToRoster(){
  if(window.__TUTORIAL_MODE__ || S.gameOver || S.missionEnded) return;
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  for(const role of ["attacker", "rescue"]){
    const wanted = squadAliveCount(role);
    const alive = S.supportUnits.filter((unit)=>unit.alive && unit.role === role);
    let idx = alive.length;
    while(idx < wanted && idx < SQUAD_MAX_PER_ROLE){
      S.supportUnits.push(createSupportUnit(role, idx));
      idx += 1;
    }
  }
}
function applySquadUpkeepAfterMission(){
  if(window.__TUTORIAL_MODE__) return null;
  syncSquadRosterBounds();
  const aliveAttackers = squadAliveCount("attacker");
  const aliveRescuers = squadAliveCount("rescue");
  const activeCount = aliveAttackers + aliveRescuers;
  if(activeCount <= 0) return null;

  const upkeepA = squadUpkeepUnitCost("attacker");
  const upkeepR = squadUpkeepUnitCost("rescue");
  const dueAttackers = aliveAttackers * upkeepA;
  const dueRescuers = aliveRescuers * upkeepR;
  const totalDue = dueAttackers + dueRescuers;
  let funds = Math.max(0, Math.floor(Number(S.funds || 0)));

  let paidAttackers = 0;
  let paidRescuers = 0;
  let remAttackers = aliveAttackers;
  let remRescuers = aliveRescuers;
  const ratioA = ()=> (aliveAttackers > 0 ? (paidAttackers / aliveAttackers) : 1);
  const ratioR = ()=> (aliveRescuers > 0 ? (paidRescuers / aliveRescuers) : 1);

  while(true){
    const canPayA = remAttackers > 0 && funds >= upkeepA;
    const canPayR = remRescuers > 0 && funds >= upkeepR;
    if(!canPayA && !canPayR) break;
    if(canPayR && (!canPayA || ratioR() <= ratioA())){
      funds -= upkeepR;
      paidRescuers++;
      remRescuers--;
    } else if(canPayA){
      funds -= upkeepA;
      paidAttackers++;
      remAttackers--;
    }
  }

  S.funds = funds;
  const unpaidAttackers = Math.max(0, aliveAttackers - paidAttackers);
  const unpaidRescuers = Math.max(0, aliveRescuers - paidRescuers);
  if(unpaidAttackers > 0){
    S.soldierAttackersDowned = clamp((S.soldierAttackersDowned || 0) + unpaidAttackers, 0, S.soldierAttackersOwned || 0);
  }
  if(unpaidRescuers > 0){
    S.soldierRescuersDowned = clamp((S.soldierRescuersDowned || 0) + unpaidRescuers, 0, S.soldierRescuersOwned || 0);
  }

  if((unpaidAttackers > 0 || unpaidRescuers > 0) && Array.isArray(S.supportUnits) && S.supportUnits.length){
    let dropA = unpaidAttackers;
    let dropR = unpaidRescuers;
    S.supportUnits = S.supportUnits.filter((unit)=>{
      if(!unit || !unit.alive) return false;
      if(unit.role === "attacker" && dropA > 0){
        dropA--;
        return false;
      }
      if(unit.role === "rescue" && dropR > 0){
        dropR--;
        return false;
      }
      return true;
    });
  }
  syncSquadRosterBounds();

  const paid = (paidAttackers * upkeepA) + (paidRescuers * upkeepR);
  return {
    totalDue,
    paid,
    paidAttackers,
    paidRescuers,
    unpaidAttackers,
    unpaidRescuers
  };
}
function tutorialKey(){
  return window.TigerTutorial?.isRunning ? (window.TigerTutorial.currentKey || null) : null;
}
function tutorialAllows(action){
  const key = tutorialKey();
  if(!key) return true;
  const allow = {
    scan:["scan","lock","engage","weaken_tiger","resolve_tiger","interactables","shield","shop","squad","inventory","done"],
    lock:["lock","engage","weaken_tiger","resolve_tiger","interactables","shield","shop","squad","inventory","done"],
    engage:["engage","weaken_tiger","resolve_tiger","interactables","shield","shop","squad","inventory","done"],
    attack:["weaken_tiger","resolve_tiger","interactables","shield","shop","squad","inventory","done"],
    capture:["resolve_tiger","interactables","shield","shop","squad","inventory","done"],
    kill:["resolve_tiger","interactables","shield","shop","squad","inventory","done"],
    shop:["shop","squad","inventory","done"],
    inventory:["inventory","done"],
  };
  return !allow[action] || allow[action].includes(key);
}
function tutorialBlockMessage(action){
  if(action==="scan") return "Escort the civilian to the green safe zone first.";
  if(action==="lock") return "Scan first, then tap the tiger to lock it.";
  if(action==="engage") return "Scan and lock the tiger before engaging.";
  if(action==="attack") return "Engage first, then weaken the tiger to capture range.";
  if(action==="capture") return "Reach the Capture step first.";
  if(action==="kill") return "Reach the Capture/Kill step first.";
  if(action==="shop") return "Finish combat and shield basics before opening the shop.";
  if(action==="inventory") return "Open Inventory after the Shop step.";
  return "Follow the tutorial steps in order.";
}
function shieldActiveNow(){ return Date.now() < (S.shieldUntil||0); }
function civilianShielded(c){
  if(!c || !shieldActiveNow()) return false;
  if(c.following) return true;
  return dist(S.me.x, S.me.y, c.x, c.y) <= SHIELD_RADIUS;
}
function rescueUnitById(unitId){
  if(!unitId) return null;
  return (S.supportUnits || []).find((unit)=>unit.alive && unit.role === "rescue" && unit.id === unitId) || null;
}
function civilianById(civId){
  if(civId == null) return null;
  return (S.civilians || []).find((civ)=>civ.alive && !civ.evac && civ.id === civId) || null;
}
function clearEscortTakeoverPrompt(){
  S.takeoverPromptUntil = 0;
  S.takeoverCivId = null;
  S.takeoverUnitId = null;
}
function setEscortTakeoverPrompt(unit, civ, now=Date.now()){
  if(!unit || !civ) return;
  if(S.inBattle || S.paused || S.missionEnded || S.gameOver) return;
  if(civ.escortOwner !== "rescue" || civ.escortUnitId !== unit.id) return;
  if(dist(S.me.x, S.me.y, unit.x, unit.y) > ESCORT_TAKEOVER_DISTANCE) return;
  if(now < (civ._takeoverPromptLockUntil || 0)) return;
  if(S.takeoverUnitId === unit.id && S.takeoverCivId === civ.id && S.takeoverPromptUntil > now) return;
  S.takeoverPromptUntil = now + ESCORT_TAKEOVER_WINDOW_MS;
  S.takeoverCivId = civ.id;
  S.takeoverUnitId = unit.id;
  civ._takeoverPromptLockUntil = now + ESCORT_TAKEOVER_WINDOW_MS + 900;
}
function takeoverEscort(){
  const now = Date.now();
  if(S.inBattle || S.paused || S.missionEnded || S.gameOver) return;
  if(!S.takeoverPromptUntil || now > S.takeoverPromptUntil) return clearEscortTakeoverPrompt();

  const unit = rescueUnitById(S.takeoverUnitId);
  const civ = civilianById(S.takeoverCivId);
  if(!unit || !civ){
    clearEscortTakeoverPrompt();
    return;
  }
  if(dist(S.me.x, S.me.y, unit.x, unit.y) > (ESCORT_TAKEOVER_DISTANCE + 8)){
    clearEscortTakeoverPrompt();
    return;
  }

  civ.following = true;
  civ.escortOwner = "player";
  civ.escortUnitId = "";
  civ.followGraceUntil = now + 2500;
  clearEscortTakeoverPrompt();
  setEventText(`You took over Civilian #${civ.id}.`, 2.2);
  renderHUD();
  save();
}

try{ resizeCanvasForViewport(); }catch(e){ try{ console.warn("Initial viewport setup recovered:", e); }catch(err){} }
window.addEventListener("resize", ()=>{
  resizeCanvasForViewport();
  applyMobileMenuState(__mobileMenuHiddenPref);
  applyTouchHudSettings();
  renderHUD();
}, { passive:true });
window.addEventListener("orientationchange", ()=>{
  resizeCanvasForViewport();
  applyMobileMenuState(__mobileMenuHiddenPref);
  applyTouchHudSettings();
  renderHUD();
});
initMobileMenuToggle();
applyTouchHudSettings();
// ================= PHASE 2 XP / PERKS =================

function xpNeededForLevel(lv){
  return 200 + lv * 80;
}

function hasProgressionUnlock(key){
  return !!(S.progressionUnlocks && S.progressionUnlocks[key]);
}

function progressionUnlockCount(){
  let n = 0;
  for(const u of PROGRESSION_UNLOCKS){
    if(hasProgressionUnlock(u.key)) n++;
  }
  return n;
}

function nextProgressionUnlock(){
  for(const u of PROGRESSION_UNLOCKS){
    if(!hasProgressionUnlock(u.key)) return u;
  }
  return null;
}

function storyChapterRewardDef(chapter){
  return STORY_CHAPTER_REWARDS.find((r)=>r.chapter === chapter) || null;
}
function ensureStoryMetaState(){
  if(!S.metaBase || typeof S.metaBase !== "object") S.metaBase = {};
  if(!S.specialistPerks || typeof S.specialistPerks !== "object") S.specialistPerks = {};
  if(!S.chapterRewardsUnlocked || typeof S.chapterRewardsUnlocked !== "object") S.chapterRewardsUnlocked = {};
  for(const def of STORY_BASE_UPGRADES){
    const rank = Math.floor(S.metaBase[def.key] || 0);
    S.metaBase[def.key] = clamp(rank, 0, def.maxRank);
  }
  for(const def of STORY_SPECIALIST_PERKS){
    const rank = Math.floor(S.specialistPerks[def.key] || 0);
    S.specialistPerks[def.key] = clamp(rank, 0, def.maxRank);
  }
}
function storyBaseRank(key){
  ensureStoryMetaState();
  return Math.max(0, Math.floor(S.metaBase[key] || 0));
}
function storySpecialistRank(key){
  ensureStoryMetaState();
  return Math.max(0, Math.floor(S.specialistPerks[key] || 0));
}
function storyMetaNextCost(def, rank){
  return def.costs[Math.min(rank, def.costs.length - 1)];
}
function storyChapterRewardUnlocked(chapter){
  ensureStoryMetaState();
  const def = storyChapterRewardDef(chapter);
  if(!def) return false;
  return !!S.chapterRewardsUnlocked[def.key];
}
function chapterRewardUnlockedCount(){
  ensureStoryMetaState();
  return STORY_CHAPTER_REWARDS.reduce((n, def)=>n + (S.chapterRewardsUnlocked[def.key] ? 1 : 0), 0);
}
function storyCaptureWindowPct(){
  if(S.mode !== "Story") return 0.25;
  const capRank = storySpecialistRank("SP_ATK_CAPTURE");
  const chapterBonus = storyChapterRewardUnlocked(2) ? 0.03 : 0;
  return clamp(0.25 + (capRank * 0.02) + chapterBonus, 0.25, 0.36);
}
function storyStaminaDrainMul(){
  if(S.mode !== "Story") return 1;
  const base = 1 - (storyBaseRank("BASE_ENDURANCE") * 0.08);
  const chapterMul = storyChapterRewardUnlocked(6) ? 0.95 : 1;
  return clamp(base * chapterMul, 0.62, 1);
}
function storyPayoutMul(){
  if(S.mode !== "Story") return 1;
  const base = 1 + (storyBaseRank("BASE_FINANCE") * 0.08);
  const chapterMul = storyChapterRewardUnlocked(8) ? 1.08 : 1;
  return base * chapterMul;
}
function storyCivilianDamageMul(){
  if(S.mode !== "Story") return 1;
  const rescueGuard = 1 - (storySpecialistRank("SP_RESCUE_GUARD") * 0.04);
  const chapterMul = storyChapterRewardUnlocked(4) ? 0.90 : 1;
  return clamp(rescueGuard * chapterMul, 0.68, 1);
}
function storyStartingArmorBonus(){
  if(S.mode !== "Story") return 0;
  return (storyBaseRank("BASE_ARMORY") * 8) + (storyChapterRewardUnlocked(5) ? 6 : 0);
}
function storyStartingShieldBonus(){
  if(S.mode !== "Story") return 0;
  return storyBaseRank("BASE_SHIELD_NET") + (storyChapterRewardUnlocked(3) ? 1 : 0);
}
function storyMissionSupplyMinimums(){
  if(S.mode !== "Story") return { medkits:1, traps:2, repair:1 };
  const logistics = storyBaseRank("BASE_LOGISTICS");
  return {
    medkits: 1 + logistics,
    traps: 2 + Math.floor((logistics + 1) / 2),
    repair: 1 + (logistics >= 2 ? 1 : 0)
  };
}
function storyAttackerDamageMul(){
  if(S.mode !== "Story") return 1;
  const drill = 1 + (storySpecialistRank("SP_ATK_DRILL") * 0.12);
  const chapterMul = storyChapterRewardUnlocked(7) ? 1.08 : 1;
  return drill * chapterMul;
}
function storyAttackerDurabilityMul(){
  if(S.mode !== "Story") return 1;
  const drill = 1 + (storySpecialistRank("SP_ATK_DRILL") * 0.10);
  const chapterMul = storyChapterRewardUnlocked(7) ? 1.08 : 1;
  return drill * chapterMul;
}
function storyAttackerCaptureBonus(){
  if(S.mode !== "Story") return 0;
  const rankBonus = storySpecialistRank("SP_ATK_CAPTURE") * 0.06;
  const chapterBonus = storyChapterRewardUnlocked(2) ? 0.05 : 0;
  return rankBonus + chapterBonus;
}
function storyRescueSpeedMul(){
  if(S.mode !== "Story") return 1;
  const escort = 1 + (storySpecialistRank("SP_RESCUE_ESCORT") * 0.10);
  const chapterMul = storyChapterRewardUnlocked(9) ? 1.10 : 1;
  return escort * chapterMul;
}
function storyRescueDamageMul(){
  if(S.mode !== "Story") return 1;
  const guard = 1 - (storySpecialistRank("SP_RESCUE_GUARD") * 0.08);
  return clamp(guard, 0.62, 1);
}
function storySupportHpMax(role){
  const base = role === "rescue" ? 220 : 280;
  if(S.mode !== "Story") return base;
  if(role === "attacker"){
    return Math.round(base * storyAttackerDurabilityMul());
  }
  const escort = 1 + (storySpecialistRank("SP_RESCUE_ESCORT") * 0.10);
  return Math.round(base * escort);
}
function storySupportArmorBase(role){
  if(role === "rescue") return 0;
  const base = 170;
  if(S.mode !== "Story") return base;
  return Math.round(base + (storySpecialistRank("SP_ATK_DRILL") * 16) + (storyChapterRewardUnlocked(7) ? 18 : 0));
}
function unlockStoryChapterReward(chapter, opts={}){
  const silent = !!opts.silent;
  ensureStoryMetaState();
  const def = storyChapterRewardDef(chapter);
  if(!def) return null;
  if(S.chapterRewardsUnlocked[def.key]) return null;
  S.chapterRewardsUnlocked[def.key] = true;

  const grantBits = [];
  if(def.cash){
    S.funds += def.cash;
    S.stats.cashEarned = (S.stats.cashEarned || 0) + def.cash;
    grantBits.push(`+$${def.cash.toLocaleString()}`);
  }
  if(def.perkPoints){
    S.perkPoints = (S.perkPoints || 0) + def.perkPoints;
    grantBits.push(`+${def.perkPoints} perk point${def.perkPoints > 1 ? "s" : ""}`);
  }
  if(def.title){
    S.title = def.title;
    grantBits.push(`Title: ${def.title}`);
  }

  const rewardLine = grantBits.length ? `${def.label} (${grantBits.join(" • ")})` : def.label;
  if(!silent){
    toast(`🏆 Chapter Reward Unlocked: ${rewardLine}`);
    setEventText(`🏆 ${def.label} unlocked. ${def.desc}`, 5);
  }
  return { label:def.label, desc:def.desc, grants:grantBits.join(" • ") };
}
function syncStoryChapterRewardsFromProgress(){
  ensureStoryMetaState();
  const completed = clamp(Math.floor((Math.max(1, S.storyLevel || 1) - 1) / 10), 0, STORY_CHAPTER_REWARDS.length);
  let unlocked = 0;
  for(let ch=1; ch<=completed; ch++){
    const got = unlockStoryChapterReward(ch, { silent:true });
    if(got) unlocked++;
  }
  return unlocked;
}

function comboWindowMs(){
  return COMBO_WINDOW_MS + (hasProgressionUnlock("combo_boost") ? COMBO_WINDOW_BONUS_MS : 0);
}

function cacheRewardMul(){
  return hasProgressionUnlock("cache_boost") ? 1.35 : 1;
}

function barricadeEffectRadius(){
  return Math.round(128 * (hasProgressionUnlock("barrier_boost") ? 1.26 : 1));
}

function abilityCooldownMul(){
  return hasProgressionUnlock("cooldown_boost") ? 0.84 : 1;
}

function abilityCooldownDuration(key){
  const base = ABILITY_COOLDOWN_MS[key] || 0;
  if(base <= 0) return 0;
  return Math.max(500, Math.round(base * abilityCooldownMul()));
}

function ensureAbilityCooldownState(){
  if(!S.abilityCooldowns || typeof S.abilityCooldowns !== "object"){
    S.abilityCooldowns = { scan:0, sprint:0, shield:0 };
  }
  if(!Number.isFinite(S.abilityCooldowns.scan)) S.abilityCooldowns.scan = 0;
  if(!Number.isFinite(S.abilityCooldowns.sprint)) S.abilityCooldowns.sprint = 0;
  if(!Number.isFinite(S.abilityCooldowns.shield)) S.abilityCooldowns.shield = 0;
}

function abilityCooldownLeftMs(key, now=Date.now()){
  ensureAbilityCooldownState();
  return Math.max(0, (S.abilityCooldowns[key] || 0) - now);
}

function abilityOnCooldown(key){
  return abilityCooldownLeftMs(key) > 0;
}

function abilityCooldownLabel(key){
  const left = abilityCooldownLeftMs(key);
  return left > 0 ? `${Math.max(1, Math.ceil(left / 1000))}s` : "";
}

function triggerAbilityCooldown(key){
  ensureAbilityCooldownState();
  const ms = abilityCooldownDuration(key);
  if(ms <= 0) return;
  S.abilityCooldowns[key] = Date.now() + ms;
}

function checkProgressionUnlocks(opts={}){
  if(!S.progressionUnlocks || typeof S.progressionUnlocks !== "object"){
    S.progressionUnlocks = {};
  }
  const silent = !!opts.silent;
  let unlockedAny = false;
  for(const u of PROGRESSION_UNLOCKS){
    if(S.level >= u.level && !S.progressionUnlocks[u.key]){
      S.progressionUnlocks[u.key] = true;
      unlockedAny = true;
      if(!silent){
        toast(`🔓 Unlock: ${u.label}`);
        setEventText(`🔓 ${u.label}: ${u.desc}`, 4);
      }
    }
  }
  if(unlockedAny){
    for(const it of (S.mapInteractables || [])){
      if(it.kind === "barricade"){
        it.effectR = barricadeEffectRadius();
      }
    }
    save();
  }
  return unlockedAny;
}

function addXP(amount){
  if(!amount) return;
  S.xp += amount;
  let leveled = false;

  while(S.xp >= xpNeededForLevel(S.level)){
    S.xp -= xpNeededForLevel(S.level);
    S.level++;
    S.perkPoints++;
    leveled = true;
    toast("Level Up! +1 Perk Point");
  }

  if(leveled) checkProgressionUnlocks();
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
function armorTierIndex(id){
  if(id === "A_TIER1") return 1;
  if(id === "A_TIER2") return 2;
  if(id === "A_TIER3") return 3;
  if(id === "A_TIER4") return 4;
  return 0;
}
function medTierLabel(id){
  if(id === "M_SMALL") return "T1";
  if(id === "M_MED") return "T2";
  if(id === "M_LARGE") return "T3";
  if(id === "M_TRAUMA") return "T4";
  return "T?";
}
function armorTierLabel(id){
  if(id === "A_TIER1") return "T1";
  if(id === "A_TIER2") return "T2";
  if(id === "A_TIER3") return "T3";
  if(id === "A_TIER4") return "T4";
  return "T?";
}
function legacyArmorKeysForId(id){
  const tier = armorTierIndex(id);
  if(!tier) return [id];
  return [
    id,
    `T${tier}`, `t${tier}`,
    `A${tier}`, `a${tier}`,
    `TIER${tier}`, `tier${tier}`, `tier_${tier}`,
    `ARMOR_T${tier}`, `armor_t${tier}`,
    `ARMOR_TIER${tier}`, `armor_tier${tier}`,
    `armorTier${tier}`, `armor_${tier}`
  ];
}
function normalizeArmorPlateInventory(raw){
  const stock = {};
  for(const ar of ARMORY) stock[ar.id] = 0;
  if(Array.isArray(raw)){
    for(let i=0; i<ARMORY.length; i++){
      const id = ARMORY[i].id;
      stock[id] = clamp(Math.floor(Number(raw[i] || 0)), 0, 999);
    }
    return stock;
  }
  if(raw && typeof raw === "object" && !Array.isArray(raw)){
    for(const ar of ARMORY){
      let count = 0;
      for(const key of legacyArmorKeysForId(ar.id)){
        const v = Number(raw[key]);
        if(Number.isFinite(v)) count = Math.max(count, Math.floor(v));
      }
      stock[ar.id] = clamp(count, 0, 999);
    }
    const knownTotal = Object.values(stock).reduce((sum, val)=>sum + val, 0);
    if(knownTotal <= 0){
      const fallbackTotal = Number(raw.total ?? raw.count ?? raw.owned ?? raw.plates);
      if(Number.isFinite(fallbackTotal) && fallbackTotal > 0){
        stock.A_TIER1 = clamp(Math.floor(fallbackTotal), 0, 999);
      }
    }
    return stock;
  }
  if(Number.isFinite(raw)){
    stock.A_TIER1 = clamp(Math.floor(Number(raw || 0)), 0, 999);
  }
  return stock;
}
function ensureArmorPlateInventoryState(){
  S.armorPlates = normalizeArmorPlateInventory(S.armorPlates);
}
function ensureArmorPlateFallbackState(){
  S.armorPlatesFallback = normalizeArmorPlateInventory(S.armorPlatesFallback);
}
function ensureSupplySelectionState(){
  if(!getMed(S.medkitSelectedId)) S.medkitSelectedId = MEDS[0].id;
  if(!getArmor(S.armorPlateSelectedId)) S.armorPlateSelectedId = ARMORY[0].id;
}
function armorPlateCount(id){
  ensureArmorPlateInventoryState();
  ensureArmorPlateFallbackState();
  const key = String(id || "");
  const primary = clamp(Math.floor(Number(S.armorPlates[key] || 0)), 0, 999);
  const fallback = clamp(Math.floor(Number(S.armorPlatesFallback[key] || 0)), 0, 999);
  const merged = Math.max(primary, fallback);
  if(primary !== merged) S.armorPlates[key] = merged;
  if(fallback !== merged) S.armorPlatesFallback[key] = merged;
  return merged;
}
function selectedMedkitId(){
  ensureSupplySelectionState();
  const selected = S.medkitSelectedId;
  if((S.medkits?.[selected] || 0) > 0) return selected;
  const owned = MEDS.filter((m)=>(S.medkits?.[m.id] || 0) > 0);
  if(!owned.length) return selected;
  S.medkitSelectedId = owned[0].id;
  return S.medkitSelectedId;
}
function selectedArmorPlateId(){
  ensureSupplySelectionState();
  const selected = S.armorPlateSelectedId;
  if(armorPlateCount(selected) > 0) return selected;
  const owned = ARMORY.filter((ar)=>armorPlateCount(ar.id) > 0);
  if(!owned.length) return selected;
  S.armorPlateSelectedId = owned[0].id;
  return S.armorPlateSelectedId;
}
function setSelectedMedkit(id){
  if(!getMed(id)) return;
  S.medkitSelectedId = id;
  save();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  renderHUD();
}
function setSelectedArmorPlate(id){
  if(!getArmor(id)) return;
  S.armorPlateSelectedId = id;
  save();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  renderHUD();
}
function pickSmartMedkitId(currentHp, maxHp, allowFull=false){
  const owned = MEDS
    .filter((m)=>(S.medkits?.[m.id] || 0) > 0)
    .sort((a,b)=>a.heal - b.heal);
  if(!owned.length) return null;
  const hpNow = clamp(Number(currentHp || 0), 0, Math.max(1, Number(maxHp || 100)));
  const hpMax = Math.max(1, Number(maxHp || 100));
  const deficit = Math.max(0, hpMax - hpNow);
  if(deficit <= 0){
    return allowFull ? owned[0].id : null;
  }
  const exact = owned.find((m)=>m.heal >= deficit);
  return (exact || owned[owned.length - 1]).id;
}
function pickSmartArmorPlateId(){
  const owned = ARMORY
    .filter((ar)=>armorPlateCount(ar.id) > 0)
    .sort((a,b)=>a.addArmor - b.addArmor);
  if(!owned.length) return null;
  const deficit = Math.max(0, (S.armorCap || 100) - S.armor);
  if(deficit <= 0) return null;
  const exact = owned.find((ar)=>ar.addArmor >= deficit);
  return (exact || owned[owned.length - 1]).id;
}
function equippedWeapon(){ return getWeapon(S.equippedWeaponId) || WEAPONS[0]; }
function equippedWeaponRange(){ return equippedWeapon()?.range || 112; }
function weaponRangeBand(range=equippedWeaponRange()){
  if(range <= WEAPON_RANGE_BANDS.short) return "short";
  if(range <= WEAPON_RANGE_BANDS.mid) return "mid";
  return "long";
}
function tigerCivilianHitRange(t){
  if(isBossTiger(t)) return CIVILIAN_HIT_PCT_BY_TIGER.Boss;
  return CIVILIAN_HIT_PCT_BY_TIGER[t?.type] || CIVILIAN_HIT_PCT_BY_TIGER.Standard;
}
function captureWindowPctLabel(){ return `${Math.round(storyCaptureWindowPct() * 100)}%`; }
function captureWindowHp(t){ return Math.max(1, Math.ceil((t?.hpMax || 0) * storyCaptureWindowPct())); }

function currentMap(){
  if(S.mode==="Story"){
    const chapter = chapterIndexForMode("Story");
    return STORY_CHAPTER_MAPS[chapter - 1] || STORY_CHAPTER_MAPS[0];
  }
  if(S.mode==="Arcade"){
    const chapter = chapterIndexForMode("Arcade");
    return ARCADE_CHAPTER_MAPS[chapter - 1] || ARCADE_CHAPTER_MAPS[0];
  }
  const list = MODE_MAPS[S.mode] || MODE_MAPS.Story;
  return list[clamp(S.mapIndex,0,list.length-1)];
}
function nextMap(){
  if(S.mode==="Story" || S.mode==="Arcade"){
    toast("Campaign maps are chapter-based. Map background updates every 10 missions.");
    sfx("ui");
    return;
  }
  const list = MODE_MAPS[S.mode] || MODE_MAPS.Story;
  S.mapIndex = (S.mapIndex+1) % list.length;
  if(!window.__TUTORIAL_MODE__) spawnMapInteractables();
  S.scanPing=0; sfx("ui"); save();
}

// ===================== COLLISION (carcasses) =====================
function rectCircleCollide(rx, ry, rw, rh, cx, cy, cr){
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return (dx*dx + dy*dy) <= cr*cr;
}
function buildDenseLandmarks(mapKey, chapter, w=cv.width, h=cv.height){
  const family = mapFamilyKey(mapKey);
  const base = MAP_DENSE_LANDMARKS[family] || [];
  const ch = clamp(chapter || 1, 1, 10) - 1;
  return base.map((lm, idx)=>{
    const wobbleX = Math.sin((idx + 1) * 1.71 + ch * 0.93) * 0.012;
    const wobbleY = Math.cos((idx + 1) * 1.37 + ch * 0.81) * 0.010;
    const x = clamp(Math.round((lm.nx + wobbleX) * w), 52, w - 52);
    const y = clamp(Math.round((lm.ny + wobbleY) * h), 70, h - 56);
    return { ...lm, x, y };
  });
}
function pushMapObstacleRect(rects, cx, cy, ww, hh, pad=0){
  const w = Math.max(6, ww + (pad * 2));
  const h = Math.max(6, hh + (pad * 2));
  rects.push({ x: cx - (w / 2), y: cy - (h / 2), w, h });
}
function pushMapObstacleCircle(circles, x, y, r, pad=0){
  circles.push({ x, y, r: Math.max(4, r + pad) });
}
function addMapObstacleForLandmark(rects, circles, item){
  if(inMapScenarioKeepout(item?.x, item?.y, 26)) return;
  if(MAP_SOFT_COLLIDER_KINDS.has(item?.kind)) return;
  const profile = MAP_COLLIDER_PROFILES[item?.kind];
  if(!profile) return;
  const scale = Math.max(0.72, item?.s || 1);
  if(profile.type === "circle"){
    pushMapObstacleCircle(circles, item.x, item.y, profile.r * scale, profile.pad || 0);
    return;
  }
  pushMapObstacleRect(rects, item.x, item.y, profile.w * scale, profile.h * scale, profile.pad || 0);
}
function buildMapWaterZones(mapKey, chapter, w=cv.width, h=cv.height){
  const family = mapFamilyKey(mapKey);
  const defs = MAP_WATER_LAYOUTS[family] || [];
  const riverChapter = (chapter === 5);
  const chapterMul = riverChapter ? 1.08 : 1;
  return defs.map((def)=>{
    const boost = (riverChapter && def.riverBoost) ? 1.16 : 1;
    const rx = clamp(Math.round(w * def.rx * chapterMul * boost), 18, Math.round(w * 0.30));
    const ry = clamp(Math.round(h * def.ry * chapterMul * boost), 12, Math.round(h * 0.18));
    return {
      x: clamp(Math.round(w * def.nx), 24, w - 24),
      y: clamp(Math.round(h * def.ny), 24, h - 24),
      rx,
      ry,
      rot: Number.isFinite(def.rot) ? def.rot : 0
    };
  }).filter((zone)=>!inMapScenarioKeepout(zone.x, zone.y, Math.max(zone.rx || 0, zone.ry || 0) * 0.55));
}
function waterZoneRadii(zone){
  const rx = Math.max(2, Number(zone?.rx || zone?.r || 0));
  const ry = Math.max(2, Number(zone?.ry || zone?.r || 0));
  return { rx, ry };
}
function pointInWaterZone(zone, x, y, radius=0){
  if(!zone) return false;
  const pad = Math.max(0, Number(radius) || 0);
  const base = waterZoneRadii(zone);
  const rx = base.rx + pad;
  const ry = base.ry + pad;
  const rot = Number.isFinite(zone.rot) ? zone.rot : 0;
  const dx = x - zone.x;
  const dy = y - zone.y;
  const cos = Math.cos(-rot);
  const sin = Math.sin(-rot);
  const lx = (dx * cos) - (dy * sin);
  const ly = (dx * sin) + (dy * cos);
  const nx = lx / Math.max(1, rx);
  const ny = ly / Math.max(1, ry);
  return ((nx * nx) + (ny * ny)) <= 1;
}
function ensureMapObstacleCache(){
  const map = currentMap();
  const key = map?.key || "ST_FOREST";
  const chapter = chapterIndexForMode(S.mode);
  const w = cv.width || 960;
  const h = cv.height || 540;
  const sig = [S.mode, key, chapter, w, h, window.__TUTORIAL_MODE__ ? 1 : 0].join("|");
  if(sig === __mapObstacleSig) return;

  const rects = [];
  const circles = [];
  const waters = buildMapWaterZones(key, chapter, w, h);
  const family = mapFamilyKey(key);
  const sx = (v)=> v * (w / 960);
  const sy = (v)=> v * (h / 540);

  for(const lm of buildDenseLandmarks(key, chapter, w, h)){
    addMapObstacleForLandmark(rects, circles, lm);
  }

  for(const p of (MAP_REALISM_PROPS[family] || [])){
    const px = p.x * (w / 960);
    const py = p.y * (h / 540);
    addMapObstacleForLandmark(rects, circles, { kind:p.kind, x:px, y:py, s:p.s || 1 });
  }

  if(family === "ST_SUBURBS"){
    const anchors = [
      [220,146],[460,146],[718,146],
      [240,388],[560,388],[820,388],
    ];
    for(const [hx, hy] of anchors){
      const cx = sx(hx);
      const cy = sy(hy);
      if(inMapScenarioKeepout(cx, cy, 24)) continue;
      pushMapObstacleRect(rects, cx, cy, sx(34), sy(22), 2);
    }
  } else if(family === "ST_DOWNTOWN"){
    const blocks = [
      [180,145,74,60],[520,145,84,64],[840,145,72,58],
      [200,330,86,66],[560,325,92,68],[860,320,78,60],
    ];
    for(const [bx, by, bw, bh] of blocks){
      const cx = sx(bx);
      const cy = sy(by);
      if(inMapScenarioKeepout(cx, cy, Math.max(sx(bw), sy(bh)) * 0.52)) continue;
      pushMapObstacleRect(rects, cx, cy, sx(bw), sy(bh), 4);
    }
  } else if(family === "ST_INDUSTRIAL"){
    const industrialBlocks = [
      [218,158,198,96,5],
      [738,166,202,92,5],
      [420,408,240,112,5],
      [815,300,112,72,4],
    ];
    for(const [bx, by, bw, bh, pad] of industrialBlocks){
      const cx = sx(bx);
      const cy = sy(by);
      if(inMapScenarioKeepout(cx, cy, Math.max(sx(bw), sy(bh)) * 0.52)) continue;
      pushMapObstacleRect(rects, cx, cy, sx(bw), sy(bh), pad);
    }
  }

  __mapObstacleRects = rects;
  __mapObstacleCircles = circles;
  __mapWaterZones = waters;
  __mapWaterSig = sig;
  __mapObstacleSig = sig;
}
function isPointInWater(x, y, radius=0){
  ensureMapObstacleCache();
  if(__mapWaterSig !== __mapObstacleSig) return false;
  for(const zone of (__mapWaterZones || [])){
    if(pointInWaterZone(zone, x, y, radius)) return true;
  }
  return false;
}
function waterSpeedMul(entityType, x, y, radius=0){
  if(!isPointInWater(x, y, radius)) return 1;
  if(entityType === "tiger") return 0.96;
  if(entityType === "soldier") return 0.90;
  if(entityType === "support") return 0.88;
  if(entityType === "civilian") return 0.86;
  return 0.90;
}
function blockedByMapObstacle(x, y, radius){
  ensureMapObstacleCache();
  for(const c of __mapObstacleCircles){
    const rr = (c.r || 0) + radius;
    const dx = x - c.x;
    const dy = y - c.y;
    if((dx*dx + dy*dy) <= (rr*rr)) return true;
  }
  for(const ob of __mapObstacleRects){
    if(rectCircleCollide(ob.x, ob.y, ob.w, ob.h, x, y, radius)) return true;
  }
  return false;
}
function mobileControlKeepoutZones(){
  if(!isMobileViewport()) return [];
  if(controllerOwnsUi()) return [];
  const w = cv.width || 960;
  const h = cv.height || 540;
  return [
    { x:w * 0.12, y:h * 0.91, r:44 }, // left joystick
    { x:w * 0.88, y:h * 0.90, r:46 }, // right bottom cluster
    { x:w * 0.88, y:h * 0.76, r:50 }, // right cluster upper reach
    { x:w * 0.16, y:h * 0.63, r:42 }, // cache button region (left side)
  ];
}
function mobileScenarioClearRects(){
  if(!isMobileViewport()) return [];
  if(controllerOwnsUi()) return [];
  const w = cv.width || 960;
  const h = cv.height || 540;
  return [
    { x: Math.round(w * 0.64), y: Math.round(h * 0.48), w: Math.round(w * 0.36), h: Math.round(h * 0.52) }, // right buttons area
    { x: 0, y: Math.round(h * 0.84), w: Math.round(w * 0.34), h: Math.round(h * 0.16) }, // joystick footprint
    { x: 0, y: Math.round(h * 0.58), w: Math.round(w * 0.28), h: Math.round(h * 0.26) }, // cache button lane
  ];
}
function inMobileUiScenarioZone(x, y, radius=0){
  const rects = mobileScenarioClearRects();
  if(!rects.length) return false;
  const r = Math.max(0, radius || 0);
  for(const rect of rects){
    if(rectCircleCollide(rect.x, rect.y, rect.w, rect.h, x, y, r)) return true;
  }
  return false;
}
function mobileRightUiLaneRect(){
  if(!isMobileViewport()) return null;
  if(controllerOwnsUi()) return null;
  const w = cv.width || 960;
  const h = cv.height || 540;
  return {
    x: Math.round(w * 0.76),
    y: Math.round(h * 0.50),
    w: Math.round(w * 0.24),
    h: Math.round(h * 0.50),
  };
}
function inMobileRightUiLane(x, y, radius=0){
  const rect = mobileRightUiLaneRect();
  if(!rect) return false;
  const r = Math.max(0, radius || 0);
  return rectCircleCollide(rect.x, rect.y, rect.w, rect.h, x, y, r);
}
function inMobileControlKeepout(x, y, radius=0){
  const zones = mobileControlKeepoutZones();
  if(!zones.length) return false;
  const rrBase = Math.max(0, radius || 0);
  for(const zone of zones){
    const rr = zone.r + rrBase;
    const dx = x - zone.x;
    const dy = y - zone.y;
    if((dx * dx + dy * dy) <= (rr * rr)) return true;
  }
  return false;
}
function inMobileNoBuildZone(x, y, radius=0){
  if(!isMobileViewport()) return false;
  // Do not block the entire right lane; keep only a tight control buffer.
  return inMobileControlKeepout(x, y, Math.max(0, radius) + 6);
}
function inMapScenarioKeepout(x, y, radius=0){
  return inMobileNoBuildZone(x, y, radius) || inMobileUiScenarioZone(x, y, radius);
}
function blockedCacheKey(x, y, radius=0){
  const q = BLOCKED_CACHE_QUANT;
  return `${Math.round(x / q)}|${Math.round(y / q)}|${Math.round((radius || 0) / q)}`;
}
function blockedAt(x, y, radius){
  const key = blockedCacheKey(x, y, radius);
  if(__blockedAtCache.has(key)) return __blockedAtCache.get(key);
  let blocked = false;
  if(inMapScenarioKeepout(x, y, radius + 4)){
    __blockedAtCache.set(key, false);
    return false;
  }
  // Blood pools are visual hazards; they should never hard-block movement.
  if(!(isMobileViewport() && x > (cv.width * 0.66) && y > (cv.height * 0.70))){
    blocked = blockedByMapObstacle(x, y, radius);
  }
  __blockedAtCache.set(key, blocked);
  if(__blockedAtCache.size > 1200){
    __blockedAtCache.clear();
    __blockedAtCacheFrame = __frameBudgetState.frameNo;
  }
  return blocked;
}
function findNearestOpenPoint(x, y, radius, opts={}){
  const avoidKeepout = !!opts.avoidKeepout;
  const avoidWater = !!opts.avoidWater;
  const inPerfMode = performanceMode() === "PERFORMANCE";
  const slowFrame = frameIsSlow();
  const minX = 30 + radius;
  const maxX = cv.width - (30 + radius);
  const minY = 48 + radius;
  const maxY = cv.height - (22 + radius);
  const ox = clamp(x, minX, maxX);
  const oy = clamp(y, minY, maxY);
  const targetX = Number.isFinite(opts.targetX) ? opts.targetX : ox;
  const targetY = Number.isFinite(opts.targetY) ? opts.targetY : oy;
  let best = null;
  let bestScore = Infinity;

  const testPoint = (px, py, weight=0.25)=>{
    const tx = clamp(px, minX, maxX);
    const ty = clamp(py, minY, maxY);
    if(blockedAt(tx, ty, radius)) return;
    if(avoidKeepout && inMapScenarioKeepout(tx, ty, radius)) return;
    if(avoidWater && isPointInWater(tx, ty, Math.max(2, radius * 0.45))) return;
    const homeDist = dist(tx, ty, ox, oy);
    const targetDist = dist(tx, ty, targetX, targetY);
    const score = targetDist + (homeDist * weight);
    if(score < bestScore){
      bestScore = score;
      best = { x:tx, y:ty };
    }
  };

  testPoint(ox, oy, 0.22);
  const baseStep = Math.max(8, radius + 6);
  const maxRings = slowFrame ? 6 : (inPerfMode ? 8 : 10);
  for(let ring=1; ring<=maxRings; ring++){
    if(ring > 2 && frameBudgetExceeded(0.55)) break;
    const stepMul = slowFrame ? 0.84 : (inPerfMode ? 0.92 : 1);
    const steps = Math.max(6, Math.round((8 + (ring * 2)) * stepMul));
    const rr = baseStep * ring;
    for(let i=0; i<steps; i++){
      const a = (Math.PI * 2 * i) / steps;
      testPoint(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr, 0.32);
    }
    if(best) break;
  }
  return best;
}
function updateEntityStuckState(ent, moveEps=0.75){
  if(!ent || !Number.isFinite(ent.x) || !Number.isFinite(ent.y)) return;
  if(!Number.isFinite(ent._lastMoveX)) ent._lastMoveX = ent.x;
  if(!Number.isFinite(ent._lastMoveY)) ent._lastMoveY = ent.y;
  const moved = dist(ent.x, ent.y, ent._lastMoveX, ent._lastMoveY);
  ent._stuckTicks = moved <= moveEps ? ((ent._stuckTicks || 0) + 1) : 0;
  ent._lastMoveX = ent.x;
  ent._lastMoveY = ent.y;
}
function resolveEntityStuck(ent, radius, opts={}){
  if(!ent || !Number.isFinite(ent.x) || !Number.isFinite(ent.y)) return false;
  const now = Date.now();
  const avoidKeepout = !!opts.avoidKeepout;
  const movingIntent = opts.movingIntent !== false;
  const stuckThreshold = Math.max(8, Math.floor(opts.stuckThreshold || 22));
  updateEntityStuckState(ent, opts.moveEps || 0.75);
  const isBlocked = blockedAt(ent.x, ent.y, radius);
  const inKeepout = avoidKeepout && inMapScenarioKeepout(ent.x, ent.y, radius);
  if(!movingIntent){
    ent._stuckTicks = 0;
    ent._lastMoveX = ent.x;
    ent._lastMoveY = ent.y;
    ent._nextUnstickTryAt = 0;
  }
  const isStuck = movingIntent && Number(ent._stuckTicks || 0) >= stuckThreshold;
  if(!isBlocked && !inKeepout && !isStuck){
    ent._nextUnstickTryAt = 0;
    return false;
  }
  if((ent._nextUnstickTryAt || 0) > now) return false;

  const free = findNearestOpenPoint(ent.x, ent.y, radius, {
    avoidKeepout,
    targetX: Number.isFinite(opts.targetX) ? opts.targetX : ent.x,
    targetY: Number.isFinite(opts.targetY) ? opts.targetY : ent.y
  });
  if(!free){
    ent._nextUnstickTryAt = now + (frameIsSlow() ? 260 : 160);
    return false;
  }
  ent.x = free.x;
  ent.y = free.y;
  ent._stuckTicks = 0;
  ent._lastMoveX = ent.x;
  ent._lastMoveY = ent.y;
  ent._nextUnstickTryAt = 0;
  return true;
}
function safeSpawnPoint(x, y, radius=16, avoidKeepout=true, avoidWater=false){
  const free = findNearestOpenPoint(x, y, radius, {
    avoidKeepout,
    avoidWater,
    targetX:x,
    targetY:y
  });
  if(free) return free;
  return {
    x: clamp(x, 30 + radius, cv.width - (30 + radius)),
    y: clamp(y, 48 + radius, cv.height - (22 + radius))
  };
}
function unstickEntitiesTick(){
  if(!S || S.paused || S.gameOver || S.missionEnded) return;
  const playerIntent =
    !!S.target ||
    KEY_STATE.up || KEY_STATE.down || KEY_STATE.left || KEY_STATE.right ||
    Math.abs(TOUCH_STICK.dx) > 0.08 || Math.abs(TOUCH_STICK.dy) > 0.08 ||
    Math.abs(GAMEPAD_STATE.lx) > 0.08 || Math.abs(GAMEPAD_STATE.ly) > 0.08;
  resolveEntityStuck(S.me, 16, {
    avoidKeepout:false,
    movingIntent:playerIntent,
    stuckThreshold:36,
    targetX:S.target?.x,
    targetY:S.target?.y
  });

  for(const civ of (S.civilians || [])){
    if(!civ.alive || civ.evac) continue;
    const civIntent = !!civ.following || (S.guideTargetId === civ.id);
    resolveEntityStuck(civ, 14, {
      avoidKeepout:true,
      movingIntent:civIntent,
      stuckThreshold:20,
      targetX:S.evacZone?.x,
      targetY:S.evacZone?.y
    });
  }
  for(const unit of (S.supportUnits || [])){
    if(!unit.alive) continue;
    resolveEntityStuck(unit, 16, {
      avoidKeepout:true,
      movingIntent:true,
      stuckThreshold:18,
      targetX:S.me?.x,
      targetY:S.me?.y
    });
  }
  for(const tiger of (S.tigers || [])){
    if(!tiger.alive) continue;
    const tigerIntent = Math.hypot(tiger.vx || 0, tiger.vy || 0) > 0.16 || !!tiger.targetCivId;
    resolveEntityStuck(tiger, 16, {
      avoidKeepout:true,
      movingIntent:tigerIntent,
      stuckThreshold:16,
      targetX:S.me?.x,
      targetY:S.me?.y
    });
  }
  for(const p of (S.pickups || [])){
    if(!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if(!inMapScenarioKeepout(p.x, p.y, 12)) continue;
    const free = findNearestOpenPoint(p.x, p.y, 12, { avoidKeepout:true, avoidWater:false });
    if(free){
      p.x = free.x;
      p.y = free.y;
    }
  }
  for(const it of (S.mapInteractables || [])){
    if(!Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
    const rr = clamp(it.r, 12, 54);
    if(!inMapScenarioKeepout(it.x, it.y, rr)) continue;
    const free = findNearestOpenPoint(it.x, it.y, rr, { avoidKeepout:true, avoidWater:true });
    if(free){
      it.x = free.x;
      it.y = free.y;
    }
  }
}
function tryCarcassEscape(ent, radius, minX, maxX, minY, maxY){
  ensureMapObstacleCache();
  let nearest = null;
  let nearestD = Infinity;
  for(const carcass of (S.carcasses || [])){
    if(!rectCircleCollide(carcass.x - 11, carcass.y - 6, 22, 12, ent.x, ent.y, radius)) continue;
    const d = dist(ent.x, ent.y, carcass.x, carcass.y);
    if(d < nearestD){
      nearest = carcass;
      nearestD = d;
    }
  }
  for(const ob of __mapObstacleRects){
    if(!rectCircleCollide(ob.x, ob.y, ob.w, ob.h, ent.x, ent.y, radius)) continue;
    const cx = ob.x + (ob.w * 0.5);
    const cy = ob.y + (ob.h * 0.5);
    const d = dist(ent.x, ent.y, cx, cy);
    if(d < nearestD){
      nearest = { x:cx, y:cy };
      nearestD = d;
    }
  }
  for(const c of __mapObstacleCircles){
    const rr = (c.r || 0) + radius;
    const d = dist(ent.x, ent.y, c.x, c.y);
    if(d > rr) continue;
    if(d < nearestD){
      nearest = c;
      nearestD = d;
    }
  }
  if(!nearest) return false;

  let angle = Math.atan2(ent.y - nearest.y, ent.x - nearest.x);
  if(!Number.isFinite(angle)) angle = Math.random() * Math.PI * 2;
  const basePush = Math.max(6, radius * 0.9);

  for(let i=0;i<8;i++){
    const scale = 1 + (i * 0.35);
    const nx = clamp(ent.x + Math.cos(angle) * basePush * scale, minX, maxX);
    const ny = clamp(ent.y + Math.sin(angle) * basePush * scale, minY, maxY);
    if(!blockedAt(nx, ny, radius)){
      ent.x = nx;
      ent.y = ny;
      return true;
    }
    angle += Math.PI / 4;
  }
  return false;
}
function tryMoveEntity(ent, nx, ny, radius, opts={}){
  const now = Date.now();
  const minX = 30 + radius;
  const maxX = cv.width - (30 + radius);
  const minY = 48 + radius;
  const maxY = cv.height - (22 + radius);
  const avoidKeepout = opts.avoidKeepout === true;
  const targetX = Number.isFinite(nx) ? nx : ent.x;
  const targetY = Number.isFinite(ny) ? ny : ent.y;
  nx = clamp(nx, minX, maxX);
  ny = clamp(ny, minY, maxY);

  const ox = ent.x, oy = ent.y;
  if(!blockedAt(nx, oy, radius)) ent.x = nx;
  if(!blockedAt(ent.x, ny, radius)) ent.y = ny;
  ent.x = clamp(ent.x, minX, maxX);
  ent.y = clamp(ent.y, minY, maxY);

  const desiredDx = targetX - ox;
  const desiredDy = targetY - oy;
  const wantedDist = Math.hypot(desiredDx, desiredDy);
  if(wantedDist > 0.34 && dist(ent.x, ent.y, ox, oy) < 0.24){
    const baseAng = Math.atan2(desiredDy, desiredDx);
    const detourStep = Math.min(wantedDist, Math.max(4.5, radius * 0.86));
    const turns = [0.46, -0.46, 0.92, -0.92, 1.32, -1.32, Math.PI];
    for(const turn of turns){
      const tx = clamp(ox + Math.cos(baseAng + turn) * detourStep, minX, maxX);
      const ty = clamp(oy + Math.sin(baseAng + turn) * detourStep, minY, maxY);
      if(blockedAt(tx, ty, radius)) continue;
      if(avoidKeepout && inMapScenarioKeepout(tx, ty, radius)) continue;
      ent.x = tx;
      ent.y = ty;
      break;
    }
  }

  if(blockedAt(ent.x, ent.y, radius)){
    const escaped = tryCarcassEscape(ent, radius, minX, maxX, minY, maxY);
    if(!escaped || blockedAt(ent.x, ent.y, radius)){
      if((ent._nextPathRecoverAt || 0) > now){
        ent.x = clamp(ox, minX, maxX);
        ent.y = clamp(oy, minY, maxY);
        return false;
      }
      const fallback = findNearestOpenPoint(ox, oy, radius, {
        avoidKeepout,
        targetX,
        targetY
      });
      if(fallback){
        ent.x = fallback.x;
        ent.y = fallback.y;
        ent._nextPathRecoverAt = 0;
      } else {
        ent._nextPathRecoverAt = now + (frameIsSlow() ? 220 : 120);
        ent.x = clamp(ox, minX, maxX);
        ent.y = clamp(oy, minY, maxY);
        return false;
      }
    }
  }
  if(avoidKeepout && inMapScenarioKeepout(ent.x, ent.y, radius)){
    if((ent._nextKeepoutRecoverAt || 0) > now){
      ent.x = clamp(ox, minX, maxX);
      ent.y = clamp(oy, minY, maxY);
      return false;
    }
    const free = findNearestOpenPoint(ent.x, ent.y, radius, {
      avoidKeepout:true,
      targetX:S.me?.x,
      targetY:S.me?.y
    });
    if(free){
      ent.x = free.x;
      ent.y = free.y;
      ent._nextKeepoutRecoverAt = 0;
    } else {
      ent._nextKeepoutRecoverAt = now + (frameIsSlow() ? 220 : 140);
    }
  }
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
  if(storyChapterRewardUnlocked(10)){
    S.title = "Legendary Commander";
    return;
  }
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
  __savePending = true;
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
    if(hasAliveBossTiger()){
      setEventText("👑 Boss presence suppressed random rogue pack event.", 4);
      sfx("ui");
    } else {
      spawnRogueTiger();
      setEventText("🚨 Rogue Pack entered the area!", 7);
      sfx("event"); hapticImpact("heavy");
    }
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
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(S.pickups.length >= MAX_PERSIST_PICKUPS) S.pickups.shift();
  const pt = safeSpawnPoint(
    clamp(Number.isFinite(x) ? x : rand(80, cv.width - 80), 40, cv.width - 40),
    clamp(Number.isFinite(y) ? y : rand(90, cv.height - 70), 60, cv.height - 40),
    12,
    true,
    false
  );
  S.pickups.push({
    id: Date.now()+Math.random(),
    type,
    x:pt.x,
    y:pt.y,
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

function currentMissionLabel(){
  if(S.mode==="Story") return `Story Mission ${clamp(S.storyLevel || 1, 1, STORY_CAMPAIGN_OBJECTIVES.length)}`;
  if(S.mode==="Arcade") return `Arcade Mission ${clamp(S.arcadeLevel || 1, 1, ARCADE_CAMPAIGN_OBJECTIVES.length)}`;
  return `Survival Wave ${Math.max(1, S.survivalWave || 1)}`;
}
function nextMissionLabel(){
  if(S.mode==="Story") return `Story Mission ${Math.min((S.storyLevel || 1) + 1, STORY_CAMPAIGN_OBJECTIVES.length)}`;
  if(S.mode==="Arcade") return `Arcade Mission ${Math.min((S.arcadeLevel || 1) + 1, ARCADE_CAMPAIGN_OBJECTIVES.length)}`;
  return `Survival Wave ${Math.max(1, (S.survivalWave || 1) + 1)}`;
}
let progressGuardSource = "";
function openMissionProgressGuard(source=""){
  const overlay = document.getElementById("progressGuardOverlay");
  const text = document.getElementById("progressGuardText");
  if(!overlay || !text) return;
  progressGuardSource = String(source || "");
  const reason =
    source==="mode"
      ? "Switching mode now can interrupt your current mission progress."
      : source==="reset-all"
        ? "Reset will wipe progress and wallets for all modes."
        : source==="reset"
        ? "Reset will restart progress from Mission 1."
        : "Choose what you want to do with your mission progress.";
  text.innerText = `${reason}\nCurrent: ${currentMissionLabel()}\nNext available: ${nextMissionLabel()}`;
  document.getElementById("completeOverlay").style.display = "none";
  setPaused(true,"progress-guard");
  overlay.style.display = "flex";
}
function closeMissionProgressGuard(restoreComplete=true){
  const overlay = document.getElementById("progressGuardOverlay");
  if(overlay) overlay.style.display = "none";
  progressGuardSource = "";
  if(restoreComplete && S.missionEnded && !S.gameOver){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display = "flex";
    return;
  }
  setPaused(false,null);
}
function pickProgressGuardAction(action){
  const source = progressGuardSource;
  if(action==="cancel"){
    closeMissionProgressGuard(true);
    return;
  }
  if(action==="next"){
    closeMissionProgressGuard(false);
    startNextMission();
    return;
  }
  if(action==="reset"){
    closeMissionProgressGuard(false);
    if(source === "reset-all") performResetGame();
    else restartModeFromMission1();
    return;
  }
  if(action==="mode"){
    closeMissionProgressGuard(false);
    openModeOverlay();
  }
}

function openModeOverlay(){
  setPaused(true,"mode");
  document.getElementById("modeOverlay").style.display="flex";
  updateModeDesc(); markModeTabs(); sfx("ui");
}
function openMode(){
  if(S.missionEnded && !S.gameOver){
    openMissionProgressGuard("mode");
    return;
  }
  openModeOverlay();
}
function closeMode(){
  document.getElementById("modeOverlay").style.display="none";
  if(S.missionEnded && !S.gameOver){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display="flex";
    return;
  }
  setPaused(false,null);
}
let __storyIntroAutoTimer = 0;
let __launchIntroAutoTimer = 0;
let __launchIntroShownThisBoot = false;
let __missionBriefTimer = 0;

function clearStoryIntroAutoTimer(){
  if(__storyIntroAutoTimer){
    clearTimeout(__storyIntroAutoTimer);
    __storyIntroAutoTimer = 0;
  }
}
function clearLaunchIntroAutoTimer(){
  if(__launchIntroAutoTimer){
    clearTimeout(__launchIntroAutoTimer);
    __launchIntroAutoTimer = 0;
  }
}
function clearMissionBriefTimer(){
  if(__missionBriefTimer){
    clearTimeout(__missionBriefTimer);
    __missionBriefTimer = 0;
  }
}
function currentMissionCardData(){
  if(S.mode==="Story"){
    return {
      mode: "Story",
      total: STORY_CAMPAIGN_OBJECTIVES.length,
      mission: storyCampaignMission(S.storyLevel)
    };
  }
  if(S.mode==="Arcade"){
    return {
      mode: "Arcade",
      total: ARCADE_CAMPAIGN_OBJECTIVES.length,
      mission: arcadeCampaignMission(S.arcadeLevel)
    };
  }
  return null;
}
function chapterRecapTextForCurrentStoryMission(){
  const mission = storyCampaignMission(S.storyLevel);
  const idx = clamp((mission?.chapter || 1) - 1, 0, STORY_CHAPTER_RECAPS.length - 1);
  return STORY_CHAPTER_RECAPS[idx] || STORY_CHAPTER_RECAPS[0];
}
function missionObjectiveCountText(mode, mission){
  if(!mission) return "Objective Count: mission clear.";
  const bits = [];
  if((mission.civilians || 0) > 0) bits.push(`${mission.civilians} civilians`);
  if((mission.tigers || 0) > 0) bits.push(`${mission.tigers} tigers`);
  if((mission.captureRequired || 0) > 0) bits.push(`capture ${mission.captureRequired}`);
  if(mode==="Arcade" && (mission.trapPlaceRequired || 0) > 0) bits.push(`set ${mission.trapPlaceRequired} traps`);
  if(mode==="Arcade" && (mission.trapTriggerRequired || 0) > 0) bits.push(`trap-stop ${mission.trapTriggerRequired}`);
  if(mode==="Arcade" && mission.captureOnly) bits.push("no tiger kills");
  if(!bits.length) bits.push("mission clear");
  return `Objective Count: ${bits.join(" • ")}.`;
}
function missionSpecialRuleText(mode, mission){
  if(!mission) return "Special Rule: standard mission rules.";
  const rules = [];
  if(mode==="Story" && (mission.civilians || 0) > 0) rules.push("escort/protect civilians");
  if((mission.captureRequired || 0) > 0) rules.push(`capture objective active`);
  if(mode==="Arcade" && mission.captureOnly) rules.push("capture-only (no kills)");
  if(mode==="Arcade" && (mission.trapPlaceRequired || 0) > 0) rules.push("trap placement required");
  if(mode==="Arcade" && (mission.trapTriggerRequired || 0) > 0) rules.push("trap-stop objective active");
  if(mode==="Arcade" && mission.limitedAmmo) rules.push("limited ammo");
  if(mission.lowVisibility) rules.push("reduced visibility");
  if(mission.bloodAggro) rules.push("blood increases aggression");
  if(mission.finalBoss) rules.push("final choice changes ending");
  if(!rules.length) return "Special Rule: standard mission rules.";
  return `Special Rule: ${rules[0]}.`;
}
function bossCycleLabel(skill){
  if(skill==="roar") return "War Roar";
  if(skill==="stealth") return "Shadow Fade";
  if(skill==="pounce_chain") return "Pounce Chain";
  if(skill==="reinforce") return "Howl Call";
  if(skill==="charge") return "Rage Charge";
  return "Boss Skill";
}
function storyChapterRewardPreviewText(mission){
  if(!mission) return "Reward Track: complete objectives to unlock chapter rewards.";
  const chapter = clamp(mission.chapter || 1, 1, STORY_CHAPTER_REWARDS.length);
  const reward = storyChapterRewardDef(chapter);
  if(!reward) return "Reward Track: all chapter rewards unlocked.";
  if(storyChapterRewardUnlocked(chapter)){
    const next = storyChapterRewardDef(chapter + 1);
    if(next) return `Reward Track: Chapter ${chapter} reward unlocked. Next up Chapter ${chapter + 1} — ${next.label}.`;
    return `Reward Track: Chapter ${chapter} reward unlocked — ${reward.label}.`;
  }
  const until = Math.max(0, (chapter * 10) - (mission.number || 1));
  if(until === 0) return `Reward Track: this mission clear unlocks ${reward.label}.`;
  return `Reward Track: ${reward.label} unlocks in ${until} mission${until===1?"":"s"}.`;
}
function storyMissionIntelText(mission){
  if(!mission) return "Story Intel: hold evac lanes and minimize civilian risk.";
  const focus = [];
  if((mission.civilians || 0) > 0) focus.push(`protect ${mission.civilians} civilian${mission.civilians===1?"":"s"}`);
  if((mission.captureRequired || 0) > 0) focus.push(`secure ${mission.captureRequired} capture${mission.captureRequired===1?"":"s"}`);
  if(mission.lowVisibility) focus.push("low visibility route");
  if(mission.bloodAggro) focus.push("lethal kills increase aggression");
  if(!focus.length) focus.push("clear tiger threats and secure evacuation");
  return `Story Intel: ${focus.join(" • ")}.`;
}
function storyBossIntroText(mission){
  if(!mission) return "Boss Intro: no active boss for this mission.";
  if(!mission.boss) return "Boss Intro: no chapter boss on this mission.";
  const chapter = clamp(mission.chapter || 1, 1, 10);
  const profile = BOSS_IDENTITY_BY_CHAPTER[chapter];
  if(mission.finalBoss){
    return "Boss Intro: Ancient Tiger final confrontation. Multi-phase pressure expected; your capture-vs-kill choice sets the ending.";
  }
  const tigerLine = mission.bossTwin
    ? `Twin ${mission.bossType || "Alpha"} Tigers`
    : `${mission.bossType || "Alpha"} Tiger`;
  const cycleLine = profile?.cycle?.length
    ? profile.cycle.map((skill)=>bossCycleLabel(skill)).slice(0, 3).join(" -> ")
    : "War Roar -> Rage Charge";
  const sig = profile?.name ? `${profile.name}` : "Chapter Predator";
  return `Boss Intro: ${tigerLine}. Signature profile: ${sig} (${cycleLine}).`;
}
function missionBossWarningText(mission){
  if(!mission || !mission.boss) return "Boss Warning: none.";
  const identity = BOSS_IDENTITY_BY_CHAPTER[clamp(mission.chapter || 1, 1, 10)];
  const sig = identity ? ` Signature: ${identity.name}.` : "";
  if(mission.finalBoss) return "Boss Warning: Final boss mission.";
  if(mission.bossTwin) return `Boss Warning: Twin ${mission.bossType || "Alpha"} Tigers.${sig}`;
  return `Boss Warning: ${mission.bossType || "Alpha"} Tiger.${sig}`;
}
function shouldShowMissionBrief(){
  if(window.__TUTORIAL_MODE__) return false;
  if(S.mode==="Survival") return false;
  if(S.mode==="Story" && !S.storyIntroSeen) return false;
  return true;
}
function showMissionBrief(durationMs=2600){
  const overlay = document.getElementById("missionBriefOverlay");
  if(!overlay || !shouldShowMissionBrief()) return false;

  const card = currentMissionCardData();
  if(!card || !card.mission) return false;

  const titleEl = document.getElementById("missionBriefTitle");
  const nameEl = document.getElementById("missionBriefName");
  const objectiveEl = document.getElementById("missionBriefObjective");
  const ruleEl = document.getElementById("missionBriefRule");
  const bossEl = document.getElementById("missionBriefBoss");
  const intelEl = document.getElementById("missionBriefIntel");
  const rewardEl = document.getElementById("missionBriefReward");
  const isStory = card.mode === "Story";
  if(titleEl) titleEl.innerText = isStory ? "📖 Story Operations Brief" : "📋 Mission Brief";
  if(nameEl) nameEl.innerText = `${card.mode} Mission ${card.mission.number}/${card.total} — ${card.mission.chapterName}`;
  if(objectiveEl){
    objectiveEl.innerText = isStory
      ? `Objective: ${card.mission.objective}`
      : missionObjectiveCountText(card.mode, card.mission);
  }
  if(ruleEl){
    ruleEl.innerText = isStory
      ? missionObjectiveCountText(card.mode, card.mission)
      : missionSpecialRuleText(card.mode, card.mission);
  }
  if(bossEl){
    bossEl.innerText = isStory
      ? storyBossIntroText(card.mission)
      : missionBossWarningText(card.mission);
  }
  if(intelEl) intelEl.innerText = isStory ? storyMissionIntelText(card.mission) : "";
  if(rewardEl) rewardEl.innerText = isStory ? storyChapterRewardPreviewText(card.mission) : "";

  clearMissionBriefTimer();
  setPaused(true,"mission-brief");
  overlay.style.display = "flex";
  syncGamepadFocus();
  let ms = Math.floor(durationMs || 2600);
  if(isStory){
    ms = Math.max(ms, card.mission.boss ? 5600 : 4300);
    ms = clamp(ms, 3400, 6800);
  } else {
    ms = clamp(ms, 2000, 3400);
  }
  __missionBriefTimer = setTimeout(()=>{
    closeMissionBrief(true);
  }, ms);
  return true;
}
function closeMissionBrief(fromTimer=false){
  clearMissionBriefTimer();
  const overlay = document.getElementById("missionBriefOverlay");
  if(overlay) overlay.style.display = "none";
  if(S.paused && S.pauseReason === "mission-brief"){
    setPaused(false,null);
  }
  if(!fromTimer) sfx("ui");
  syncGamepadFocus();
}
function continueFromLaunchIntro(allowStoryIntro=true){
  if(S.mode==="Story" && !window.__TUTORIAL_MODE__ && !S.storyIntroSeen){
    if(allowStoryIntro){
      openStoryIntro(false);
      return;
    }
    setPaused(false,null);
    syncGamepadFocus();
    return;
  }
  const shown = showMissionBrief(rand(2200, 3000));
  if(!shown) setPaused(false,null);
  syncGamepadFocus();
}
function openLaunchIntro(force=false){
  if(window.__TUTORIAL_MODE__) return;
  if(!force && __launchIntroShownThisBoot) return;
  const overlay = document.getElementById("launchIntroOverlay");
  if(!overlay){
    // Fallback to existing flow if launch overlay is unavailable.
    continueFromLaunchIntro(true);
    return;
  }
  __launchIntroShownThisBoot = true;
  clearLaunchIntroAutoTimer();
  clearStoryIntroAutoTimer();
  clearMissionBriefTimer();
  closeMissionBrief(true);
  const storyOverlay = document.getElementById("storyIntroOverlay");
  if(storyOverlay) storyOverlay.style.display = "none";
  setPaused(true,"launch-intro");
  overlay.style.display = "flex";
  __launchIntroAutoTimer = setTimeout(()=>{
    beginFromLaunchIntro({ auto:true });
  }, 5200);
  syncGamepadFocus();
}
function beginFromLaunchIntro(){
  clearLaunchIntroAutoTimer();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  continueFromLaunchIntro(true);
}
function startQuickTutorialFromLaunchIntro(){
  clearLaunchIntroAutoTimer();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  setPaused(false,null);
  syncGamepadFocus();
  window.startTutorial?.();
}
function skipLaunchIntro(){
  clearLaunchIntroAutoTimer();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  continueFromLaunchIntro(false);
}
function openStoryIntro(force=false){
  if(S.mode!=="Story" || window.__TUTORIAL_MODE__) return;
  if(!force && S.storyIntroSeen) return;
  const overlay = document.getElementById("storyIntroOverlay");
  if(!overlay) return;
  const recapEl = document.getElementById("storyRecapText");
  if(recapEl){
    recapEl.style.display = "none";
    recapEl.innerText = chapterRecapTextForCurrentStoryMission();
  }
  clearStoryIntroAutoTimer();
  clearMissionBriefTimer();
  closeMissionBrief(true);
  setPaused(true,"story-intro");
  overlay.style.display = "flex";
  __storyIntroAutoTimer = setTimeout(()=>{
    beginStoryMissionFromIntro({ auto:true });
  }, 5000);
  syncGamepadFocus();
}
function beginStoryMissionFromIntro(){
  clearStoryIntroAutoTimer();
  const overlay = document.getElementById("storyIntroOverlay");
  if(overlay) overlay.style.display = "none";
  S.storyIntroSeen = true;
  save();
  const shown = showMissionBrief(rand(2200, 3000));
  if(!shown) setPaused(false,null);
  syncGamepadFocus();
}
function startQuickTutorialFromIntro(){
  clearStoryIntroAutoTimer();
  const overlay = document.getElementById("storyIntroOverlay");
  if(overlay) overlay.style.display = "none";
  S.storyIntroSeen = true;
  setPaused(false,null);
  save();
  syncGamepadFocus();
  window.startTutorial?.();
}
function skipStoryIntro(){
  beginStoryMissionFromIntro();
}
function toggleChapterRecap(){
  const recapEl = document.getElementById("storyRecapText");
  if(!recapEl) return;
  if(recapEl.style.display === "none" || !recapEl.style.display){
    recapEl.innerText = chapterRecapTextForCurrentStoryMission();
    recapEl.style.display = "block";
  } else {
    recapEl.style.display = "none";
  }
  sfx("ui");
  syncGamepadFocus();
}
function startStoryIntroMission(){
  beginStoryMissionFromIntro();
}
function setMode(m){
  const nextMode = normalizeModeName(m);
  const wantsStoryIntro = (nextMode==="Story" && !window.__TUTORIAL_MODE__);
  setModeWallet(S.mode, S.funds, S);
  S.mode = nextMode;
  S.funds = getModeWallet(nextMode, S);
  S.lives=5;
  applyModeTheme(S.mode);
  if(nextMode==="Arcade") S.arcadeLevel=1;
  if(nextMode==="Survival"){ S.survivalWave=1; S.survivalStart=Date.now(); S.surviveSeconds=0; }
  if(nextMode==="Story") S.storyLevel=1;
  S.mapIndex=0;
  deploy();
  updateModeDesc(); markModeTabs(); closeMode(); sfx("ui");
  if(wantsStoryIntro) openStoryIntro(false);
  save();
}
function markModeTabs(){
  ["mStory","mArcade","mSurvival"].forEach(id=>document.getElementById(id).classList.remove("active"));
  if(S.mode==="Story") document.getElementById("mStory").classList.add("active");
  if(S.mode==="Arcade") document.getElementById("mArcade").classList.add("active");
  if(S.mode==="Survival") document.getElementById("mSurvival").classList.add("active");
}
function updateModeDesc(){
  const el=document.getElementById("modeDesc");
  if(S.mode==="Story") el.innerText="Story Campaign: chapter-based operations with escort/protect pressure, boss intros, and steady chapter rewards.";
  else if(S.mode==="Arcade") el.innerText="Arcade Campaign: score-attack missions with a live timer, combo multiplier pressure, and medal ranking on clear.";
  else el.innerText="Survival: no civilians. Tigers pressure-damage you. Events OFF.";
}

// ===================== Shop / Inventory =====================
let currentShopTab="weapons";
let starsCheckoutBusy = false;
let starsTopupBusy = false;
const starsClaimInFlight = new Map();
const starsOrderStatus = new Map();
let starsInvoiceActiveOrderRef = "";
let starsPendingOrderRef = readStarsPendingOrderRef();
let starsAutoClaimBusy = false;
let starsAutoClaimAt = 0;
const STARS_ORDER_STATUS_TTL_MS = 120000;

function starsOfferBySku(sku){
  return STARS_ALL_OFFERS.find((pack)=>pack.sku === sku) || null;
}
function starsTopupPackForTarget(targetStars){
  const list = [...STARS_CASH_PACKS].sort((a,b)=>a.stars-b.stars);
  if(!list.length) return null;
  const desired = positiveInt(targetStars);
  if(desired <= 0){
    return list.find((pack)=>pack.stars === 100) || list[0];
  }
  const exact = list.find((pack)=>pack.stars === desired);
  if(exact) return exact;
  const higher = list.find((pack)=>pack.stars >= desired);
  return higher || list[list.length - 1];
}
function cashBundleById(id){
  return CASH_SUPPLY_BUNDLES.find((bundle)=>bundle.id === id) || null;
}
function setStarsOrderStatus(orderRef, status){
  const ref = String(orderRef || "").trim();
  const s = String(status || "").trim().toLowerCase();
  if(!ref) return;
  if(!s){
    starsOrderStatus.delete(ref);
    return;
  }
  starsOrderStatus.set(ref, { status:s, at:Date.now() });
}
function getStarsOrderStatus(orderRef){
  const ref = String(orderRef || "").trim();
  if(!ref) return "";
  const raw = starsOrderStatus.get(ref);
  if(!raw) return "";
  if(typeof raw === "string") return raw.toLowerCase();
  if(raw && typeof raw === "object"){
    return String(raw.status || "").toLowerCase();
  }
  return "";
}
function clearStarsOrderStatus(orderRef){
  const ref = String(orderRef || "").trim();
  if(!ref) return;
  starsOrderStatus.delete(ref);
}
function clearStarsOrderStatusLater(orderRef, ttlMs = STARS_ORDER_STATUS_TTL_MS){
  const ref = String(orderRef || "").trim();
  if(!ref) return;
  const delayMs = Math.max(5000, Math.floor(Number(ttlMs || STARS_ORDER_STATUS_TTL_MS)));
  setTimeout(()=>{
    const state = getStarsOrderStatus(ref);
    if(state === "open" || state === "pending") return;
    clearStarsOrderStatus(ref);
  }, delayMs);
}
function starsPendingOrderKey(){
  return `ts_stars_pending_${tgUserKey()}`;
}
function starsClaimedTxKey(){
  return `ts_stars_claimed_${tgUserKey()}`;
}
function starsScopedKeys(prefix){
  const keys = [
    `${prefix}_${tgUserKey()}`,
    `${prefix}_local`,
    prefix,
  ];
  const out = [];
  const seen = new Set();
  for(const key of keys){
    const k = String(key || "").trim();
    if(!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
function readStarsPendingOrderRef(){
  try{
    for(const key of starsScopedKeys("ts_stars_pending")){
      const val = String(localStorage.getItem(key) || "").trim();
      if(val) return val;
    }
    return null;
  }catch(e){
    return null;
  }
}
function writeStarsPendingOrderRef(orderRef){
  starsPendingOrderRef = orderRef ? String(orderRef) : null;
  try{
    const keys = starsScopedKeys("ts_stars_pending");
    if(starsPendingOrderRef){
      for(const key of keys){
        localStorage.setItem(key, starsPendingOrderRef);
      }
    } else {
      for(const key of keys){
        localStorage.removeItem(key);
      }
    }
  }catch(e){}
  pushStarsDebug(starsPendingOrderRef ? "pending:set" : "pending:clear", { orderRef: shortDebugRef(starsPendingOrderRef) });
}
function readClaimedStarsTxIds(){
  try{
    const merged = [];
    const seen = new Set();
    for(const key of starsScopedKeys("ts_stars_claimed")){
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : [];
      if(!Array.isArray(arr)) continue;
      for(const idRaw of arr){
        const id = String(idRaw || "").trim();
        if(!id || seen.has(id)) continue;
        seen.add(id);
        merged.push(id);
      }
    }
    return merged.slice(-200);
  }catch(e){
    return [];
  }
}
function hasClaimedStarsTx(txId){
  if(!txId) return false;
  return readClaimedStarsTxIds().includes(String(txId));
}
function markClaimedStarsTx(txId){
  if(!txId) return;
  const id = String(txId);
  const prior = readClaimedStarsTxIds();
  if(prior.includes(id)) return;
  prior.push(id);
  try{
    const payload = JSON.stringify(prior.slice(-200));
    for(const key of starsScopedKeys("ts_stars_claimed")){
      localStorage.setItem(key, payload);
    }
  }catch(e){}
}
function orderRefCreatedAtMs(orderRef){
  const ref = String(orderRef || "").trim();
  if(!ref) return 0;
  const parts = ref.split(":");
  if(parts.length >= 5 && parts[0] === "ts2"){
    const parsed = parseInt(String(parts[3] || ""), 36);
    if(Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}
function pendingOrderIsStale(orderRef, staleMinutes = 20){
  const createdAt = orderRefCreatedAtMs(orderRef);
  if(!createdAt) return false;
  const ageMs = Date.now() - createdAt;
  return ageMs > (Math.max(5, staleMinutes) * 60 * 1000);
}
function waitMs(ms){
  return new Promise((resolve)=>setTimeout(resolve, ms));
}
function positiveInt(value){
  const n = Math.floor(Number(value || 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function applyRewardGrant(grantInput){
  const grant = grantInput && typeof grantInput === "object" ? grantInput : null;
  if(!grant) return { changed:false, summary:"No reward" };

  if(!S.ammoReserve || typeof S.ammoReserve !== "object") S.ammoReserve = {};
  if(!S.medkits || typeof S.medkits !== "object") S.medkits = {};
  if(!S.repairKits || typeof S.repairKits !== "object") S.repairKits = {};
  if(!S.specialistStarUnlocks || typeof S.specialistStarUnlocks !== "object"){
    S.specialistStarUnlocks = { attacker:false, rescue:false };
  }else{
    S.specialistStarUnlocks = {
      attacker: !!S.specialistStarUnlocks.attacker,
      rescue: !!S.specialistStarUnlocks.rescue,
    };
  }

  let changed = false;
  const bits = [];

  const funds = positiveInt(grant.funds);
  if(funds > 0){
    S.funds += funds;
    changed = true;
    bits.push(`+$${funds.toLocaleString()} cash`);
  }

  const shields = positiveInt(grant.shields);
  if(shields > 0){
    S.shields = (S.shields || 0) + shields;
    changed = true;
    bits.push(`+${shields} shields`);
  }

  const traps = positiveInt(grant.traps);
  if(traps > 0){
    S.trapsOwned = (S.trapsOwned || 0) + traps;
    changed = true;
    bits.push(`+${traps} traps`);
  }

  let medAdded = 0;
  if(grant.medkits && typeof grant.medkits === "object"){
    for(const [id, rawQty] of Object.entries(grant.medkits)){
      if(!getMed(id)) continue;
      const qty = positiveInt(rawQty);
      if(qty <= 0) continue;
      S.medkits[id] = (S.medkits[id] || 0) + qty;
      medAdded += qty;
      changed = true;
    }
  }
  if(medAdded > 0){
    bits.push(`+${medAdded} med kits`);
  }

  let repairAdded = 0;
  if(grant.repairs && typeof grant.repairs === "object"){
    for(const [id, rawQty] of Object.entries(grant.repairs)){
      if(!getTool(id)) continue;
      const qty = positiveInt(rawQty);
      if(qty <= 0) continue;
      S.repairKits[id] = (S.repairKits[id] || 0) + qty;
      repairAdded += qty;
      changed = true;
    }
  }
  if(repairAdded > 0){
    bits.push(`+${repairAdded} repair kits`);
  }

  let ammoAdded = 0;
  if(grant.ammo && typeof grant.ammo === "object"){
    for(const [id, rawQty] of Object.entries(grant.ammo)){
      if(!getAmmo(id)) continue;
      const qty = positiveInt(rawQty);
      if(qty <= 0) continue;
      S.ammoReserve[id] = (S.ammoReserve[id] || 0) + qty;
      ammoAdded += qty;
      changed = true;
    }
  }
  if(ammoAdded > 0){
    bits.push(`+${ammoAdded} ammo`);
  }

  let unlockBits = 0;
  if(grant.specialistUnlocks && typeof grant.specialistUnlocks === "object"){
    for(const role of ["attacker", "rescue"]){
      if(!grant.specialistUnlocks[role]) continue;
      if(S.specialistStarUnlocks[role]) continue;
      S.specialistStarUnlocks[role] = true;
      changed = true;
      unlockBits += 1;
      bits.push(role === "attacker" ? "Tiger Specialist unlocked" : "Rescue Specialist unlocked");
    }
  }

  let addedAttackers = 0;
  let addedRescuers = 0;
  if(grant.specialists && typeof grant.specialists === "object"){
    syncSquadRosterBounds();
    const wantAttackers = positiveInt(grant.specialists.attacker);
    const wantRescuers = positiveInt(grant.specialists.rescue);
    if(wantAttackers > 0){
      const current = squadOwnedCount("attacker");
      const canAdd = clamp(wantAttackers, 0, Math.max(0, SQUAD_MAX_PER_ROLE - current));
      if(canAdd > 0){
        S.soldierAttackersOwned = current + canAdd;
        addedAttackers = canAdd;
        changed = true;
      }
    }
    if(wantRescuers > 0){
      const current = squadOwnedCount("rescue");
      const canAdd = clamp(wantRescuers, 0, Math.max(0, SQUAD_MAX_PER_ROLE - current));
      if(canAdd > 0){
        S.soldierRescuersOwned = current + canAdd;
        addedRescuers = canAdd;
        changed = true;
      }
    }
    syncSquadRosterBounds();
    if((addedAttackers > 0 || addedRescuers > 0) && !window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
      syncActiveSupportToRoster();
    }
  }
  if(addedAttackers > 0){
    bits.push(`+${addedAttackers} Tiger Specialist`);
  }
  if(addedRescuers > 0){
    bits.push(`+${addedRescuers} Rescue Specialist`);
  }
  if(unlockBits > 0){
    ensureStoryMetaState();
  }

  return {
    changed,
    summary: bits.join(" • ") || "Reward applied",
  };
}
async function starsApiPost(path, body){
  pushStarsDebug("api:request", {
    path,
    sku: body?.sku ? String(body.sku) : undefined,
    orderRef: body?.orderRef ? shortDebugRef(body.orderRef) : undefined,
  });
  const res = await fetch(path, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body:JSON.stringify(body || {}),
  });
  let data = null;
  try{ data = await res.json(); }catch(e){ data = null; }
  if(!res.ok || !data?.ok){
    pushStarsDebug("api:error", { path, status: res.status, error: data?.error || "Stars service unavailable." });
    throw new Error(data?.error || "Stars service unavailable.");
  }
  pushStarsDebug("api:ok", { path, status: data?.status || "ok", sku: data?.sku, tx: data?.transactionId ? shortDebugRef(data.transactionId) : undefined });
  return data;
}
function starsUnavailableReason(){
  if(!tg) return "Open this game from Telegram to use Stars payments.";
  if(!tg.initData) return "Reopen the Mini App from your bot to enable Stars checkout.";
  return "";
}
function openStarsTopUp(targetStars){
  const pack = starsTopupPackForTarget(targetStars);
  if(!pack) return toast("Stars top-up is not configured.");
  const starterStars = positiveInt(pack.stars || 0);
  const hint = `${starterStars.toLocaleString()} Stars`;
  if(starsTopupBusy) return toast("Stars top-up flow is already opening.");
  const reason = starsUnavailableReason();
  if(reason) return toast(reason);
  const openPending = String(starsPendingOrderRef || readStarsPendingOrderRef() || "").trim();
  if(openPending && openPending !== starsInvoiceActiveOrderRef){
    const pendingState = getStarsOrderStatus(openPending);
    if(pendingState === "cancelled" || pendingState === "failed" || pendingOrderIsStale(openPending)){
      writeStarsPendingOrderRef(null);
      clearStarsOrderStatus(openPending);
      pushStarsDebug("pending:auto_clear", { orderRef: shortDebugRef(openPending), state: pendingState || "stale" });
    } else {
      pushStarsDebug("topup:blocked_pending", { orderRef: shortDebugRef(openPending) });
      return toast("Claim or clear the current pending purchase before opening top-up.");
    }
  }
  starsTopupBusy = true;
  pushStarsDebug("topup:start", { targetStars: starterStars, sku: pack.sku });
  Promise.resolve((async ()=>{
    const initData = tg.initData;
    const data = await starsApiPost("/api/stars/create-invoice", { sku: pack.sku, initData });
    const orderRef = String(data.orderRef || "");
    const invoiceLink = String(data.invoiceLink || "");
    if(!orderRef || !invoiceLink) throw new Error("Missing top-up invoice link.");
    writeStarsPendingOrderRef(orderRef);
    starsInvoiceActiveOrderRef = orderRef;
    setStarsOrderStatus(orderRef, "open");
    toast(`Opening Stars top-up around ${hint}.`);
    let callbackFired = false;
    const onClosed = (statusRaw)=>{
      callbackFired = true;
      const status = String(statusRaw || "").toLowerCase();
      if(starsInvoiceActiveOrderRef === orderRef){
        starsInvoiceActiveOrderRef = "";
      }
      pushStarsDebug("topup:status", { status, orderRef: shortDebugRef(orderRef) });
      if(status === "paid"){
        setStarsOrderStatus(orderRef, status);
        toast("Checkout submitted. Use Claim Pending Purchase in Cash/Premium tab if not applied yet.");
      } else if(status === "pending"){
        setStarsOrderStatus(orderRef, status);
        toast("Top-up is processing. Use Claim Pending Purchase in Cash/Premium tab.");
      } else if(status === "cancelled"){
        if(String(starsPendingOrderRef || "") === orderRef){
          writeStarsPendingOrderRef(null);
        }
        setStarsOrderStatus(orderRef, "cancelled");
        clearStarsOrderStatusLater(orderRef);
        toast("Top-up window closed. Buy Stars anytime from this tab.");
      } else if(status === "failed"){
        if(String(starsPendingOrderRef || "") === orderRef){
          writeStarsPendingOrderRef(null);
        }
        setStarsOrderStatus(orderRef, "failed");
        clearStarsOrderStatusLater(orderRef);
        toast("Top-up failed.");
      } else {
        setStarsOrderStatus(orderRef, status || "closed");
        clearStarsOrderStatusLater(orderRef);
        toast("Top-up window closed. If charged, tap Claim Pending Purchase.");
      }
      if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
    };
    if(typeof tg.openInvoice === "function"){
      tg.openInvoice(invoiceLink, onClosed);
    } else if(typeof tg.openTelegramLink === "function"){
      tg.openTelegramLink(invoiceLink);
      toast("Complete top-up in Telegram, then return to Cash tab.");
    } else {
      window.open(invoiceLink, "_blank", "noopener,noreferrer");
      toast("Complete top-up in Telegram, then return to Cash tab.");
    }
    setTimeout(()=>{
      if(callbackFired) return;
      pushStarsDebug("topup:callback_missing", { orderRef: shortDebugRef(orderRef) });
      toast("Waiting for Telegram result. If charged, tap Claim Pending Purchase.");
    }, 12000);
  })())
    .catch((e)=>{
      pushStarsDebug("topup:error", { error: e?.message || "Top-up open failed." });
      toast(e?.message || "Could not open Stars top-up.");
    })
    .finally(()=>{
      starsTopupBusy = false;
      if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
    });
}
async function claimStarsOrder(orderRef, opts={}){
  const ref = String(orderRef || "").trim();
  const initData = tg?.initData || "";
  if(!ref || !initData) return false;

  if(starsClaimInFlight.has(ref)){
    pushStarsDebug("claim:dedup", { orderRef: shortDebugRef(ref) });
    return starsClaimInFlight.get(ref);
  }

  const run = (async ()=>{
    pushStarsDebug("claim:start", { orderRef: shortDebugRef(ref), poll: opts.poll !== false });
    const poll = opts.poll !== false;
    const attempts = Math.max(1, Math.min(60, Math.floor(Number(opts.attempts || (poll ? 8 : 1)))));
    const intervalMs = Math.max(500, Math.min(5000, Math.floor(Number(opts.intervalMs || 1400))));
    const silentPending = !!opts.silentPending;
    for(let i=0;i<attempts;i++){
      const invoiceState = getStarsOrderStatus(ref);
      if(invoiceState === "failed" || (invoiceState === "cancelled" && poll)){
        pushStarsDebug("claim:aborted", { orderRef: shortDebugRef(ref), state: invoiceState });
        if(invoiceState === "failed" && String(starsPendingOrderRef || "") === ref){
          writeStarsPendingOrderRef(null);
        }
        return false;
      }
      const excludeTxIds = readClaimedStarsTxIds();
      const data = await starsApiPost("/api/stars/claim", { orderRef: ref, initData, excludeTxIds });
      if(data.status === "pending"){
        if(i < attempts - 1){
          await waitMs(intervalMs);
          continue;
        }
        if(!silentPending){
          if(poll) toast("Payment is still processing. Tap Claim Pending Purchase in Cash or Premium tab.");
          else toast("No completed payment was found for this pending order yet.");
        }
        pushStarsDebug("claim:pending", { orderRef: shortDebugRef(ref), attempts });
        return false;
      }
      if(data.status === "paid"){
        const txId = String(data.transactionId || "");
        if(txId && hasClaimedStarsTx(txId)){
          if(i < attempts - 1){
            await waitMs(500);
            continue;
          }
          toast("Purchase is syncing. Tap Claim Pending Purchase in a moment.");
          pushStarsDebug("claim:duplicate_tx", { orderRef: shortDebugRef(ref), tx: shortDebugRef(txId) });
          return false;
        }
        const grant = (data?.grant && typeof data.grant === "object") ? { ...data.grant } : {};
        if(positiveInt(data?.funds) > 0 && positiveInt(grant.funds) <= 0){
          grant.funds = positiveInt(data.funds);
        }
        const applied = applyRewardGrant(grant);
        if(!applied.changed){
          throw new Error("Invalid purchase grant returned.");
        }
        markClaimedStarsTx(txId);
        writeStarsPendingOrderRef(null);
        clearStarsOrderStatus(ref);
        save();
        renderHUD();
        if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
        if(document.getElementById("invOverlay").style.display === "flex") renderInventory();
        toast(`Stars purchase applied: ${applied.summary}`);
        try{ hapticNotif("success"); }catch(e){}
        pushStarsDebug("claim:paid", {
          orderRef: shortDebugRef(ref),
          tx: shortDebugRef(txId),
          funds: positiveInt(grant?.funds || 0),
        });
        return true;
      }
      if(data.status === "already_claimed"){
        writeStarsPendingOrderRef(null);
        clearStarsOrderStatus(ref);
        toast("This Stars purchase was already claimed.");
        pushStarsDebug("claim:already_claimed", { orderRef: shortDebugRef(ref) });
        return false;
      }
      throw new Error(data.error || "Unexpected Stars claim response.");
    }
    return false;
  })();

  starsClaimInFlight.set(ref, run);
  try{
    return await run;
  }finally{
    if(starsClaimInFlight.get(ref) === run){
      starsClaimInFlight.delete(ref);
    }
    if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
  }
}
async function buyWithStars(sku){
  if(starsCheckoutBusy) return toast("Stars checkout already in progress.");
  const reason = starsUnavailableReason();
  if(reason) return toast(reason);
  const pack = starsOfferBySku(sku);
  if(!pack) return toast("Unknown Stars offer.");
  if(sku === "premium_tiger_specialist_unlock" && hasPremiumSpecialistUnlock("attacker")){
    return toast("Tiger Specialist is already premium-unlocked.");
  }
  if(sku === "premium_rescue_specialist_unlock" && hasPremiumSpecialistUnlock("rescue")){
    return toast("Rescue Specialist is already premium-unlocked.");
  }
  const openPending = String(starsPendingOrderRef || readStarsPendingOrderRef() || "").trim();
  if(openPending && openPending !== starsInvoiceActiveOrderRef){
    const pendingState = getStarsOrderStatus(openPending);
    if(pendingState === "cancelled" || pendingState === "failed" || pendingOrderIsStale(openPending)){
      writeStarsPendingOrderRef(null);
      clearStarsOrderStatus(openPending);
      pushStarsDebug("pending:auto_clear", { orderRef: shortDebugRef(openPending), state: pendingState || "stale" });
    } else {
      pushStarsDebug("checkout:blocked_pending", { sku, orderRef: shortDebugRef(openPending) });
      return toast("Claim or clear the current pending purchase before starting another.");
    }
  }
  pushStarsDebug("checkout:start", { sku, stars: pack.stars });
  pushStarsDebug("checkout:consume_existing_balance", { sku, stars: pack.stars });
  starsCheckoutBusy = true;
  try{
    const initData = tg.initData;
    const data = await starsApiPost("/api/stars/create-invoice", { sku, initData });
    const orderRef = String(data.orderRef || "");
    const invoiceLink = String(data.invoiceLink || "");
    if(!orderRef || !invoiceLink) throw new Error("Missing invoice link.");
    writeStarsPendingOrderRef(orderRef);
    starsInvoiceActiveOrderRef = orderRef;
    setStarsOrderStatus(orderRef, "open");
    toast(`Opening invoice: ${pack.stars} Stars`);
    pushStarsDebug("checkout:invoice", { sku, orderRef: shortDebugRef(orderRef) });
    const onStatus = (status)=>{
      const s = String(status || "").toLowerCase();
      if(starsInvoiceActiveOrderRef === orderRef){
        starsInvoiceActiveOrderRef = "";
      }
      if(s){
        setStarsOrderStatus(orderRef, s);
      }
      pushStarsDebug("checkout:status", { orderRef: shortDebugRef(orderRef), status: s || "unknown" });
      if(s === "paid"){
        toast("Payment submitted. Verifying purchase...");
        Promise.resolve(claimStarsOrder(orderRef, { poll:true, attempts:15, intervalMs:1500, silentPending:true }))
          .then((ok)=>{
            if(!ok){
              toast("Payment is processing. Tap Claim Pending Purchase in Cash or Premium tab.");
            }
          })
          .catch((err)=>toast(err?.message || "Could not verify Stars purchase."));
      } else if(s === "pending"){
        toast("Payment is processing. Tap Claim Pending Purchase in Cash or Premium tab.");
      } else if(s === "cancelled"){
        setStarsOrderStatus(orderRef, "cancelled");
        clearStarsOrderStatusLater(orderRef);
        toast("Checkout canceled. If charged, tap Claim Pending Purchase once.");
      } else if(s === "failed"){
        if(String(starsPendingOrderRef || "") === orderRef){
          writeStarsPendingOrderRef(null);
        }
        setStarsOrderStatus(orderRef, "failed");
        clearStarsOrderStatusLater(orderRef);
        toast("Stars payment failed.");
      } else {
        setStarsOrderStatus(orderRef, "closed");
        clearStarsOrderStatusLater(orderRef);
        toast("Invoice closed. If charged, tap Claim Pending Purchase.");
      }
      if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
    };
    if(typeof tg.openInvoice === "function"){
      let callbackFired = false;
      try{
        tg.openInvoice(invoiceLink, (status)=>{
          callbackFired = true;
          try{
            onStatus(status);
          }catch(err){
            toast(err?.message || "Could not process invoice status.");
          }
        });
      }catch(e){
        if(starsInvoiceActiveOrderRef === orderRef){
          starsInvoiceActiveOrderRef = "";
        }
        throw e;
      }
      setTimeout(()=>{
        if(callbackFired) return;
        pushStarsDebug("checkout:callback_missing", { orderRef: shortDebugRef(orderRef), sku });
        toast("Waiting for Telegram checkout result. If charged, tap Claim Pending Purchase.");
      }, 12000);
    } else if(typeof tg.openTelegramLink === "function"){
      tg.openTelegramLink(invoiceLink);
      toast("Complete payment, then tap Claim Pending Purchase.");
    } else {
      window.open(invoiceLink, "_blank", "noopener,noreferrer");
      toast("Complete payment, then tap Claim Pending Purchase.");
    }
    sfx("ui");
    try{ hapticImpact("light"); }catch(e){}
  }catch(e){
    pushStarsDebug("checkout:error", { sku, error: e?.message || "Could not start Stars checkout." });
    toast(e?.message || "Could not start Stars checkout.");
  }finally{
    starsCheckoutBusy = false;
    if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
  }
}
async function claimPendingStarsPurchase(){
  const reason = starsUnavailableReason();
  if(reason) return toast(reason);
  if(starsInvoiceActiveOrderRef){
    return toast("Finish or close the current Stars checkout first.");
  }
  const orderRef = starsPendingOrderRef || readStarsPendingOrderRef();
  if(!orderRef){
    pushStarsDebug("claim:missing_pending");
    return toast("No pending Stars purchase.");
  }
  if(pendingOrderIsStale(orderRef)){
    pushStarsDebug("claim:stale_pending", { orderRef: shortDebugRef(orderRef) });
    return toast("This pending purchase is stale. Clear Pending, then try again.");
  }
  pushStarsDebug("claim:manual", { orderRef: shortDebugRef(orderRef) });
  try{
    await claimStarsOrder(orderRef, { poll:false, attempts:1, intervalMs:1200 });
  }catch(e){
    pushStarsDebug("claim:error", { orderRef: shortDebugRef(orderRef), error: e?.message || "Could not claim Stars purchase." });
    toast(e?.message || "Could not claim Stars purchase.");
  }
}
function clearPendingStarsPurchase(){
  const prior = String(starsPendingOrderRef || readStarsPendingOrderRef() || "");
  writeStarsPendingOrderRef(null);
  if(prior) clearStarsOrderStatus(prior);
  pushStarsDebug("pending:cleared_by_user");
  toast("Pending Stars purchase cleared.");
  if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
}
function maybeAutoClaimPendingStars(){
  // Manual claim only. Auto-claim loops caused confusing repeated pending behavior.
  return;
}

function openShop(){
  if(!tutorialAllows("shop")) return toast(tutorialBlockMessage("shop"));
  if(S.gameOver) return;
  const fromBattle = !!S.inBattle;
  ensureSquadShopTab();
  if(S.missionEnded){
    lastOverlay="complete";
    document.getElementById("completeOverlay").style.display="none";
    currentShopTab = "squad";
  }
  setPaused(true, fromBattle ? "shop-battle" : "shop");
  document.getElementById("shopOverlay").style.display="flex";
  if(fromBattle && !anyLethalWeaponHasAmmo()) currentShopTab = "ammo";
  shopTab(currentShopTab); sfx("ui");
  if(fromBattle) setBattleMsg("Combat paused in Shop. Buy ammo or weapons, then tap Resume.");
}
function closeShop(){
  document.getElementById("shopOverlay").style.display="none";
  if(S.missionEnded){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display="flex";
    lastOverlay=null; return;
  }
  if(S.inBattle){
    setPaused(false,null);
    updateAttackButton();
    if(anyLethalWeaponHasAmmo()) setBattleMsg(`Back in combat with Tiger #${S.activeTigerId}.`);
    else setBattleMsg("No lethal ammo yet. Open Shop again or switch to Capture when the tiger is weak.");
    return;
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
  if(S.missionEnded){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display="flex";
    lastOverlay=null; return;
  }
  setPaused(false,null);
}
function openShopFromInventory(tab="ammo"){
  closeInventory();
  openShop();
  if(document.getElementById("shopOverlay").style.display === "flex"){
    shopTab(tab);
  }
}
const WEAPON_PICKER_STATE = { paused:false, reason:null };

function renderQuickWeaponPicker(){
  const box = document.getElementById("weaponQuickList");
  if(!box) return;
  box.innerHTML = S.ownedWeapons.map((id)=>{
    const w = getWeapon(id);
    const active = id===S.equippedWeaponId;
    const reserve = S.ammoReserve[w.ammo]||0;
    const loaded = active ? S.mag.loaded : 0;
    const range = w.range || 0;
    return `<button ${active?'class="good"':''} onclick="selectQuickWeapon('${id}')">${active?'✅ ':''}${w.name}<br><span class="small">Ammo ${loaded}/${w.mag} • Reserve ${reserve} • Range ${range}</span></button>`;
  }).join("");
}
function openQuickWeaponPicker(){
  const overlay = document.getElementById("weaponQuickOverlay");
  if(!overlay || overlay.style.display==="flex") return;
  WEAPON_PICKER_STATE.paused = S.paused;
  WEAPON_PICKER_STATE.reason = S.pauseReason;
  setPaused(true,"weapon");
  renderQuickWeaponPicker();
  overlay.style.display = "flex";
  sfx("ui");
  syncGamepadFocus();
}
function closeQuickWeaponPicker(){
  const overlay = document.getElementById("weaponQuickOverlay");
  if(overlay) overlay.style.display = "none";
  setPaused(WEAPON_PICKER_STATE.paused, WEAPON_PICKER_STATE.paused ? WEAPON_PICKER_STATE.reason : null);
  syncGamepadFocus();
}
function selectQuickWeapon(id){
  equipWeapon(id);
  closeQuickWeaponPicker();
}

function ensureSquadShopTab(){
  let tab = document.getElementById("tabSquad");
  if(tab) return tab;
  const tabsWrap = document.querySelector("#shopOverlay .tabs");
  if(!tabsWrap) return null;

  tab = document.createElement("button");
  tab.className = "tab";
  tab.id = "tabSquad";
  tab.type = "button";
  tab.innerText = "Squad";
  tab.addEventListener("click", ()=>shopTab("squad"));

  const medsTab = document.getElementById("tabMeds");
  if(medsTab && medsTab.parentElement === tabsWrap){
    tabsWrap.insertBefore(tab, medsTab.nextSibling);
  } else {
    tabsWrap.appendChild(tab);
  }
  return tab;
}
function ensureMetaShopTab(){
  let tab = document.getElementById("tabMeta");
  if(tab) return tab;
  const tabsWrap = document.querySelector("#shopOverlay .tabs");
  if(!tabsWrap) return null;

  tab = document.createElement("button");
  tab.className = "tab";
  tab.id = "tabMeta";
  tab.type = "button";
  tab.innerText = "Meta";
  tab.addEventListener("click", ()=>shopTab("meta"));

  const squadTab = document.getElementById("tabSquad");
  if(squadTab && squadTab.parentElement === tabsWrap){
    tabsWrap.insertBefore(tab, squadTab.nextSibling);
  } else {
    tabsWrap.appendChild(tab);
  }
  return tab;
}

function shopTab(tab){
  ensureSquadShopTab();
  ensureMetaShopTab();
  currentShopTab=tab;
  ["tabWeapons","tabAmmo","tabArmor","tabMeds","tabSquad","tabMeta","tabStars","tabCash","tabPremium","tabTools","tabTraps"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.classList.remove("active");
  });
  const activeByTab = {
    weapons:"tabWeapons",
    ammo:"tabAmmo",
    armor:"tabArmor",
    meds:"tabMeds",
    squad:"tabSquad",
    meta:"tabMeta",
    stars:"tabStars",
    cash:"tabCash",
    premium:"tabPremium",
    tools:"tabTools",
    traps:"tabTraps",
  };
  const activeEl = document.getElementById(activeByTab[tab] || "tabWeapons");
  if(activeEl){
    activeEl.classList.add("active");
    if(typeof activeEl.scrollIntoView === "function"){
      activeEl.scrollIntoView({ block:"nearest", inline:"center" });
    }
  }
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
    note.innerText="Armor plates are storable by tier. Pick a tier in Inventory for exact use, or quick-use to auto-fill armor to 100.";
    list.innerHTML = ARMORY.map(ar=>`
      <div class="item">
        <div>
          <div class="itemName">${ar.name} <span class="tag">${armorTierLabel(ar.id)}</span> <span class="tag">Owned: ${armorPlateCount(ar.id)}</span></div>
          <div class="itemDesc">Armor Plate: +${ar.addArmor} armor per use • Armor cap ${ar.cap} • Total plates: ${totalArmorPlates()}</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${ar.price.toLocaleString()}</div>
          <button onclick="buyArmor('${ar.id}')">Buy</button>
        </div>
      </div>`).join("");
    return;
  }

  if(currentShopTab==="meds"){
    note.innerText="Pick a tier in Inventory for exact use, or quick-use to auto-fill HP to 100.";
    list.innerHTML = MEDS.map(m=>{
      const owned=ownedMedCount(m.id);
      return `
        <div class="item">
          <div>
            <div class="itemName">${m.name} <span class="tag">${medTierLabel(m.id)}</span> <span class="tag">Owned: ${owned}</span></div>
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

  if(currentShopTab==="squad"){
    syncSquadRosterBounds();
    const unlockedA = specialistRoleUnlocked("attacker");
    const unlockedR = specialistRoleUnlocked("rescue");
    const premiumUnlockedA = hasPremiumSpecialistUnlock("attacker");
    const premiumUnlockedR = hasPremiumSpecialistUnlock("rescue");
    const unlockedAny = unlockedA || unlockedR;
    const level = currentCampaignLevel();
    const spawnNow = (!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded);
    const ownA = squadOwnedCount("attacker");
    const ownR = squadOwnedCount("rescue");
    const downA = squadDownedCount("attacker");
    const downR = squadDownedCount("rescue");
    const aliveA = squadAliveCount("attacker");
    const aliveR = squadAliveCount("rescue");
    const reviveAllCost = squadReviveAllCost();
    const totalDowned = downA + downR;
    note.innerText = unlockedAny
      ? `${spawnNow ? "Buy now to spawn immediately." : "Buy now and they join on next mission deploy."} Upkeep per mission: Tiger Specialist $${SQUAD_UPKEEP_ATTACKER.toLocaleString()} • Rescue Specialist $${SQUAD_UPKEEP_RESCUE.toLocaleString()}. ${premiumUnlockedA || premiumUnlockedR ? "Premium specialist unlock active." : `Level unlock: ${SOLDIER_UNLOCK_LEVEL}.`}`
      : `Locked until level ${SOLDIER_UNLOCK_LEVEL}. Current level: ${level}.`;

    const attackerCard = `
      <div class="item">
        <div>
          <div class="itemName">Tiger Specialist <span class="tag">Owned: ${ownA}</span> <span class="tag">Alive: ${aliveA}</span> <span class="tag">Downed: ${downA}</span> <span class="tag">${premiumUnlockedA ? "Premium Unlocked" : (unlockedA ? "Unlocked" : `Unlock L${SOLDIER_UNLOCK_LEVEL}`)}</span></div>
          <div class="itemDesc">Frontline tiger specialist with high HP + armor. Skilled at captures and takedowns. Persists across missions until killed.</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${SOLDIER_PRICE.toLocaleString()}</div>
          <button onclick="buyTigerSpecialist()" ${unlockedA && ownA < SQUAD_MAX_PER_ROLE ? "" : "disabled"}>${unlockedA ? (ownA < SQUAD_MAX_PER_ROLE ? "Buy" : "Roster Full") : "Locked"}</button>
          <button class="ghost" onclick="reviveSoldier('attacker')" ${downA > 0 ? "" : "disabled"}>Revive ($${SQUAD_REVIVE_ATTACKER.toLocaleString()})</button>
        </div>
      </div>`;
    const rescueCard = `
      <div class="item">
        <div>
          <div class="itemName">Search & Rescue Specialist <span class="tag">Owned: ${ownR}</span> <span class="tag">Alive: ${aliveR}</span> <span class="tag">Downed: ${downR}</span> <span class="tag">${premiumUnlockedR ? "Premium Unlocked" : (unlockedR ? "Unlocked" : `Unlock L${SOLDIER_UNLOCK_LEVEL}`)}</span></div>
          <div class="itemDesc">Civilian escort specialist with high HP and no armor. Focuses on collecting civilians and guiding to safe zone.</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${SOLDIER_PRICE.toLocaleString()}</div>
          <button onclick="buyRescueSpecialist()" ${unlockedR && ownR < SQUAD_MAX_PER_ROLE ? "" : "disabled"}>${unlockedR ? (ownR < SQUAD_MAX_PER_ROLE ? "Buy" : "Roster Full") : "Locked"}</button>
          <button class="ghost" onclick="reviveSoldier('rescue')" ${downR > 0 ? "" : "disabled"}>Revive ($${SQUAD_REVIVE_RESCUE.toLocaleString()})</button>
        </div>
      </div>`;
    const bundleCard = `
      <div class="item">
        <div>
          <div class="itemName">Reinforcement Drop <span class="tag">Bundle</span> <span class="tag">${unlockedA && unlockedR ? "Unlocked" : `Unlock L${SOLDIER_UNLOCK_LEVEL}`}</span></div>
          <div class="itemDesc">Deploys both specialists in one purchase (Tiger Specialist + Rescue Specialist).</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${REINFORCEMENT_BUNDLE_PRICE.toLocaleString()}</div>
          <button onclick="buyReinforcementBundle()" ${unlockedA && unlockedR && (ownA < SQUAD_MAX_PER_ROLE || ownR < SQUAD_MAX_PER_ROLE) ? "" : "disabled"}>${unlockedA && unlockedR ? ((ownA < SQUAD_MAX_PER_ROLE || ownR < SQUAD_MAX_PER_ROLE) ? "Buy Bundle" : "Roster Full") : "Locked"}</button>
        </div>
      </div>`;
    const reviveAllCard = `
      <div class="item">
        <div>
          <div class="itemName">Revive All Downed <span class="tag">Downed Total: ${totalDowned}</span></div>
          <div class="itemDesc">Bring all downed specialists back to active roster (10% discount).</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${reviveAllCost.toLocaleString()}</div>
          <button onclick="reviveAllSoldiers()" ${totalDowned > 0 ? "" : "disabled"}>${totalDowned > 0 ? "Revive All" : "No Downed"}</button>
        </div>
      </div>`;
    list.innerHTML = attackerCard + rescueCard + bundleCard + reviveAllCard;
    return;
  }

  if(currentShopTab==="meta"){
    ensureStoryMetaState();
    const storyModeLive = S.mode === "Story";
    note.innerText = storyModeLive
      ? "Meta progression is active. Base upgrades, specialist perks, and chapter rewards affect Story missions."
      : "Meta progression purchases are persistent, but effects apply in Story missions.";

    const baseCards = STORY_BASE_UPGRADES.map((def)=>{
      const rank = storyBaseRank(def.key);
      const maxed = rank >= def.maxRank;
      const nextCost = maxed ? null : storyMetaNextCost(def, rank);
      return `
        <div class="item">
          <div>
            <div class="itemName">${def.name} <span class="tag">Rank ${rank}/${def.maxRank}</span></div>
            <div class="itemDesc">${def.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="price">${maxed ? "MAX" : `$${nextCost.toLocaleString()}`}</div>
            <button ${maxed ? "disabled" : ""} onclick="buyStoryBaseUpgrade('${def.key}')">${maxed ? "Maxed" : "Upgrade"}</button>
          </div>
        </div>`;
    }).join("");

    const specialistCards = STORY_SPECIALIST_PERKS.map((def)=>{
      const rank = storySpecialistRank(def.key);
      const maxed = rank >= def.maxRank;
      const nextCost = maxed ? null : storyMetaNextCost(def, rank);
      return `
        <div class="item">
          <div>
            <div class="itemName">${def.name} <span class="tag">${def.role==="attacker" ? "Tiger Specialist" : "Rescue Specialist"}</span> <span class="tag">Rank ${rank}/${def.maxRank}</span></div>
            <div class="itemDesc">${def.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="price">${maxed ? "MAX" : `$${nextCost.toLocaleString()}`}</div>
            <button ${maxed ? "disabled" : ""} onclick="buyStorySpecialistPerk('${def.key}')">${maxed ? "Maxed" : "Upgrade"}</button>
          </div>
        </div>`;
    }).join("");

    const completedChapter = Math.floor(Math.max(0, (S.storyLevel || 1) - 1) / 10);
    const rewardCards = STORY_CHAPTER_REWARDS.map((def)=>{
      const on = !!S.chapterRewardsUnlocked[def.key];
      const ready = completedChapter >= def.chapter;
      return `
        <div class="item" style="${on ? "" : "opacity:.78;"}">
          <div>
            <div class="itemName">${on ? "✅" : "🔒"} Chapter ${def.chapter}: ${def.label} <span class="tag">${on ? "Unlocked" : (ready ? "Ready on clear" : "Locked")}</span></div>
            <div class="itemDesc">${def.desc}</div>
          </div>
        </div>`;
    }).join("");

    list.innerHTML = `
      <div class="hudTitle">Base Upgrades (Story)</div>
      ${baseCards}
      <div class="divider"></div>
      <div class="hudTitle">Specialist Perks (Story)</div>
      ${specialistCards}
      <div class="divider"></div>
      <div class="hudTitle">Chapter Rewards (${chapterRewardUnlockedCount()}/${STORY_CHAPTER_REWARDS.length})</div>
      ${rewardCards}
    `;
    return;
  }

  if(currentShopTab==="stars"){
    const quickTargets = [50, 100, 150, 250, 350];
    const quickButtons = quickTargets.map((stars)=>{
      const topupPack = starsTopupPackForTarget(stars);
      const label = topupPack ? `${topupPack.stars.toLocaleString()} Stars` : `${stars.toLocaleString()} Stars`;
      return `<button onclick="openStarsTopUp(${stars})">${label}</button>`;
    }).join("");
    const guideText = STARS_TOPUP_GUIDE
      .map((plan)=>`${plan.stars.toLocaleString()} Stars • ${plan.label}`)
      .join(" • ");

    note.innerText = "Stars tab is top-up only. Pick a target amount to open Telegram checkout near that size. Cash/Premium tabs spend Stars you already own.";
    list.innerHTML = `
      <div class="item">
        <div>
          <div class="itemName">Buy Stars <span class="tag">Top-up</span></div>
          <div class="itemDesc">Use quick amounts below. If you only want to add Stars balance, close the invoice after top-up and then spend in Cash/Premium tabs.</div>
        </div>
        <div style="text-align:right">
          <div class="price">Quick Top-up</div>
          <div class="row" style="justify-content:flex-end;gap:8px;flex-wrap:wrap;max-width:340px;">
            ${quickButtons}
          </div>
        </div>
      </div>
      <div class="item">
        <div>
          <div class="itemName">Stars Price Guide</div>
          <div class="itemDesc">${guideText}</div>
        </div>
      </div>
    `;
    return;
  }

  if(currentShopTab==="cash"){
    starsPendingOrderRef = starsPendingOrderRef || readStarsPendingOrderRef();
    maybeAutoClaimPendingStars();
    const reason = starsUnavailableReason();
    const stalePending = !!starsPendingOrderRef && pendingOrderIsStale(starsPendingOrderRef);
    note.innerText = reason
      ? reason
      : "Convert Stars into in-game cash when you want. Telegram spends your existing Stars balance first; if balance is low, it shows top-up options. Purchases are repeatable.";

    const claimBusy = starsClaimInFlight.size > 0;
    const offersHtml = STARS_CASH_PACKS.map((pack)=>{
      const disabled = !!reason || starsCheckoutBusy;
      return `
        <div class="item">
          <div>
            <div class="itemName">${pack.name} <span class="tag">${pack.stars} Stars</span></div>
            <div class="itemDesc">${pack.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="price">+$${pack.funds.toLocaleString()}</div>
            <button onclick="buyWithStars('${pack.sku}')" ${disabled ? "disabled" : ""}>${starsCheckoutBusy ? "Processing..." : "Spend Stars"}</button>
          </div>
        </div>`;
    }).join("");

    const pendingHtml = starsPendingOrderRef
      ? `
      <div class="item">
        <div>
          <div class="itemName">Pending Purchase <span class="tag">${stalePending ? "Stale" : "Needs claim"}</span></div>
          <div class="itemDesc">${stalePending ? "This pending order is old. Clear it, then retry purchase." : "If payment completed but the reward was not added yet, tap Claim Pending Purchase."}</div>
        </div>
        <div style="text-align:right">
          <div class="price">Ready</div>
          <button onclick="claimPendingStarsPurchase()" ${(reason || claimBusy || stalePending) ? "disabled" : ""}>${claimBusy ? "Claiming..." : "Claim Pending Purchase"}</button>
          <button class="ghost" onclick="clearPendingStarsPurchase()">Clear Pending</button>
        </div>
      </div>`
      : "";

    list.innerHTML = offersHtml + pendingHtml;
    return;
  }

  if(currentShopTab==="premium"){
    starsPendingOrderRef = starsPendingOrderRef || readStarsPendingOrderRef();
    maybeAutoClaimPendingStars();
    const reason = starsUnavailableReason();
    const stalePending = !!starsPendingOrderRef && pendingOrderIsStale(starsPendingOrderRef);
    note.innerText = reason
      ? reason
      : "Premium bundles spend your existing Stars first. If your balance is low, Telegram offers top-up during checkout.";

    const claimBusy = starsClaimInFlight.size > 0;
    const offersHtml = STARS_PREMIUM_PACKS.map((pack)=>{
      const isTigerUnlock = pack.sku === "premium_tiger_specialist_unlock";
      const isRescueUnlock = pack.sku === "premium_rescue_specialist_unlock";
      const alreadyUnlocked = (isTigerUnlock && hasPremiumSpecialistUnlock("attacker"))
        || (isRescueUnlock && hasPremiumSpecialistUnlock("rescue"));
      const disabled = !!reason || starsCheckoutBusy || alreadyUnlocked;
      const buttonLabel = alreadyUnlocked ? "Unlocked" : (starsCheckoutBusy ? "Processing..." : "Buy with Stars");
      return `
        <div class="item">
          <div>
            <div class="itemName">${pack.name} <span class="tag">${pack.stars} Stars</span></div>
            <div class="itemDesc">${pack.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="price">${pack.preview}</div>
            <button onclick="buyWithStars('${pack.sku}')" ${disabled ? "disabled" : ""}>${buttonLabel}</button>
          </div>
        </div>`;
    }).join("");

    const pendingHtml = starsPendingOrderRef
      ? `
      <div class="item">
        <div>
          <div class="itemName">Pending Purchase <span class="tag">${stalePending ? "Stale" : "Needs claim"}</span></div>
          <div class="itemDesc">${stalePending ? "This pending order is old. Clear it, then retry purchase." : "If payment completed but rewards were not added yet, tap Claim Pending Purchase."}</div>
        </div>
        <div style="text-align:right">
          <div class="price">Ready</div>
          <button onclick="claimPendingStarsPurchase()" ${(reason || claimBusy || stalePending) ? "disabled" : ""}>${claimBusy ? "Claiming..." : "Claim Pending Purchase"}</button>
          <button class="ghost" onclick="clearPendingStarsPurchase()">Clear Pending</button>
        </div>
      </div>`
      : "";

    list.innerHTML = offersHtml + pendingHtml;
    return;
  }

  if(currentShopTab==="tools"){
    note.innerText="Cash utility bundles are optional prep packs. Repair kits restore weapon durability. Shield protects escorts.";
    const bundleCards = CASH_SUPPLY_BUNDLES.map((bundle)=>{
      return `
        <div class="item">
          <div>
            <div class="itemName">${bundle.name} <span class="tag">Bundle</span></div>
            <div class="itemDesc">${bundle.desc}</div>
          </div>
          <div style="text-align:right">
            <div class="price">$${bundle.price.toLocaleString()} • ${bundle.preview}</div>
            <button onclick="buyCashBundle('${bundle.id}')">Buy Bundle</button>
          </div>
        </div>`;
    }).join("");
    const repairCards = TOOLS.map(t=>{
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
    const shieldCard = `
      <div class="item">
        <div>
          <div class="itemName">Escort Shield <span class="tag">Owned: ${S.shields||0}</span></div>
          <div class="itemDesc">Creates a shield around you and nearby civilians for 5 seconds.</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${SHIELD_PRICE.toLocaleString()}</div>
          <button onclick="buyShield()">Buy</button>
        </div>
      </div>`;
    list.innerHTML = bundleCards + shieldCard + repairCards;
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
  if(S.funds < ar.price) return toast("Not enough money.");
  S.funds -= ar.price;
  S.armorCap = Math.max(S.armorCap || 100, ar.cap);
  ensureArmorPlateInventoryState();
  ensureArmorPlateFallbackState();
  const ownedBefore = armorPlateCount(ar.id);
  const ownedNext = clamp(ownedBefore + 1, 0, 999);
  S.armorPlates[ar.id] = ownedNext;
  S.armorPlatesFallback[ar.id] = ownedNext;
  if(!getArmor(S.armorPlateSelectedId) || armorPlateCount(S.armorPlateSelectedId) <= 0){
    S.armorPlateSelectedId = ar.id;
  }
  const armorBefore = S.armor;
  if(S.armor < S.armorCap){
    S.armor = clamp(S.armor + (ar.addArmor || 0), 0, S.armorCap);
  }
  const armorGain = Math.max(0, Math.round(S.armor - armorBefore));
  toast(`${ar.name} bought. ${armorTierLabel(ar.id)} owned: ${armorPlateCount(ar.id)}${armorGain > 0 ? ` • Armor +${armorGain}` : ""}.`);
  sfx("ui"); hapticImpact("light");
  save();
  renderShopList();
  renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
}
function buyMed(id){
  const m=getMed(id); if(!m) return;
  if(S.funds < m.price) return toast("Not enough money.");
  S.funds -= m.price;
  S.medkits[id] = (S.medkits[id]||0)+1;
  toast(`${m.name} bought. ${medTierLabel(m.id)} owned: ${S.medkits[id]||0}.`);
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
function buyShield(){
  if(S.funds < SHIELD_PRICE) return toast("Not enough money.");
  S.funds -= SHIELD_PRICE;
  S.shields = (S.shields||0) + 1;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyCashBundle(id){
  const bundle = cashBundleById(id);
  if(!bundle) return toast("Unknown bundle.");
  if(S.funds < bundle.price) return toast("Not enough money.");
  S.funds -= bundle.price;
  const applied = applyRewardGrant(bundle.grant);
  if(!applied.changed){
    return toast("Bundle has no configured rewards.");
  }
  sfx("ui"); hapticImpact("medium");
  save();
  renderShopList();
  renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(`${bundle.name} applied: ${applied.summary}`);
}
function buyTigerSpecialist(){
  if(!specialistRoleUnlocked("attacker")) return toast(`Unlocks at level ${SOLDIER_UNLOCK_LEVEL}, or unlock instantly in Premium.`);
  syncSquadRosterBounds();
  if(squadOwnedCount("attacker") >= SQUAD_MAX_PER_ROLE) return toast("Tiger specialist roster is full.");
  if(S.funds < SOLDIER_PRICE) return toast("Not enough money.");
  S.funds -= SOLDIER_PRICE;
  S.soldierAttackersOwned = squadOwnedCount("attacker") + 1;
  syncSquadRosterBounds();
  if(!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
    const attackCount = (S.supportUnits || []).filter(unit => unit.role === "attacker").length;
    if(attackCount < squadAliveCount("attacker")) S.supportUnits.push(createSupportUnit("attacker", attackCount));
  }
  toast("Tiger specialist hired.");
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyRescueSpecialist(){
  if(!specialistRoleUnlocked("rescue")) return toast(`Unlocks at level ${SOLDIER_UNLOCK_LEVEL}, or unlock instantly in Premium.`);
  syncSquadRosterBounds();
  if(squadOwnedCount("rescue") >= SQUAD_MAX_PER_ROLE) return toast("Rescue specialist roster is full.");
  if(S.funds < SOLDIER_PRICE) return toast("Not enough money.");
  S.funds -= SOLDIER_PRICE;
  S.soldierRescuersOwned = squadOwnedCount("rescue") + 1;
  syncSquadRosterBounds();
  if(!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
    const rescueCount = (S.supportUnits || []).filter(unit => unit.role === "rescue").length;
    if(rescueCount < squadAliveCount("rescue")) S.supportUnits.push(createSupportUnit("rescue", rescueCount));
  }
  toast("Rescue specialist hired.");
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyReinforcementBundle(){
  if(!specialistRoleUnlocked("attacker") || !specialistRoleUnlocked("rescue")){
    return toast(`Unlocks at level ${SOLDIER_UNLOCK_LEVEL}, or unlock both roles in Premium.`);
  }
  syncSquadRosterBounds();
  const attackersOwned = squadOwnedCount("attacker");
  const rescuersOwned = squadOwnedCount("rescue");
  if(attackersOwned >= SQUAD_MAX_PER_ROLE && rescuersOwned >= SQUAD_MAX_PER_ROLE) return toast("Both specialist rosters are full.");
  if(S.funds < REINFORCEMENT_BUNDLE_PRICE) return toast("Not enough money.");
  S.funds -= REINFORCEMENT_BUNDLE_PRICE;

  let addedA = 0;
  let addedR = 0;
  if(attackersOwned < SQUAD_MAX_PER_ROLE){
    S.soldierAttackersOwned = attackersOwned + 1;
    addedA = 1;
    if(!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
      const attackCount = (S.supportUnits || []).filter(unit => unit.role === "attacker").length;
      if(attackCount < squadAliveCount("attacker")) S.supportUnits.push(createSupportUnit("attacker", attackCount));
    }
  }
  if(rescuersOwned < SQUAD_MAX_PER_ROLE){
    S.soldierRescuersOwned = rescuersOwned + 1;
    addedR = 1;
    if(!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
      const rescueCount = (S.supportUnits || []).filter(unit => unit.role === "rescue").length;
      if(rescueCount < squadAliveCount("rescue")) S.supportUnits.push(createSupportUnit("rescue", rescueCount));
    }
  }

  syncSquadRosterBounds();
  toast(`Reinforcement deployed: +${addedA} Tiger Specialist, +${addedR} Rescue Specialist.`);
  sfx("ui"); hapticImpact("medium");
  save(); renderShopList(); renderHUD();
}
function reviveSoldier(role){
  if(role !== "attacker" && role !== "rescue") return;
  syncSquadRosterBounds();
  const downed = squadDownedCount(role);
  if(downed <= 0){
    return toast(role === "attacker" ? "No downed Tiger Specialist." : "No downed Rescue Specialist.");
  }
  const price = squadReviveUnitCost(role);
  if(S.funds < price) return toast("Not enough money.");
  S.funds -= price;
  if(role === "attacker"){
    S.soldierAttackersDowned = Math.max(0, (S.soldierAttackersDowned || 0) - 1);
  } else {
    S.soldierRescuersDowned = Math.max(0, (S.soldierRescuersDowned || 0) - 1);
  }
  syncSquadRosterBounds();
  syncActiveSupportToRoster();
  toast(role === "attacker" ? "Tiger specialist revived." : "Rescue specialist revived.");
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function reviveAllSoldiers(){
  syncSquadRosterBounds();
  const totalDowned = squadDownedCount("attacker") + squadDownedCount("rescue");
  if(totalDowned <= 0) return toast("No downed specialists.");
  const price = squadReviveAllCost();
  if(S.funds < price) return toast("Not enough money.");
  S.funds -= price;
  S.soldierAttackersDowned = 0;
  S.soldierRescuersDowned = 0;
  syncSquadRosterBounds();
  syncActiveSupportToRoster();
  toast(`All specialists revived for $${price.toLocaleString()}.`);
  sfx("ui"); hapticImpact("medium");
  save(); renderShopList(); renderHUD();
}
function storyBaseUpgradeDef(key){
  return STORY_BASE_UPGRADES.find((def)=>def.key === key) || null;
}
function storySpecialistPerkDef(key){
  return STORY_SPECIALIST_PERKS.find((def)=>def.key === key) || null;
}
function buyStoryBaseUpgrade(key){
  ensureStoryMetaState();
  const def = storyBaseUpgradeDef(key);
  if(!def) return;
  const rank = storyBaseRank(key);
  if(rank >= def.maxRank) return toast("Upgrade already maxed.");
  const cost = storyMetaNextCost(def, rank);
  if(S.funds < cost) return toast("Not enough money.");
  S.funds -= cost;
  S.metaBase[key] = rank + 1;
  toast(`${def.name} upgraded to Rank ${rank + 1}.`);
  sfx("ui"); hapticImpact("light");
  save();
  renderShopList();
  renderHUD();
  if(document.getElementById("invOverlay").style.display === "flex") renderInventory();
}
function buyStorySpecialistPerk(key){
  ensureStoryMetaState();
  const def = storySpecialistPerkDef(key);
  if(!def) return;
  const rank = storySpecialistRank(key);
  if(rank >= def.maxRank) return toast("Perk already maxed.");
  const cost = storyMetaNextCost(def, rank);
  if(S.funds < cost) return toast("Not enough money.");
  S.funds -= cost;
  S.specialistPerks[key] = rank + 1;
  if(!window.__TUTORIAL_MODE__ && Array.isArray(S.supportUnits) && S.supportUnits.length){
    spawnSupportUnits();
  }
  toast(`${def.name} upgraded to Rank ${rank + 1}.`);
  sfx("ui"); hapticImpact("light");
  save();
  renderShopList();
  renderHUD();
  if(document.getElementById("invOverlay").style.display === "flex") renderInventory();
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
function totalArmorPlates(){
  ensureArmorPlateInventoryState();
  let total = 0;
  for(const ar of ARMORY){
    total += armorPlateCount(ar.id);
  }
  return clamp(total, 0, 999);
}
function setHealTarget(t){ S.healTarget=t; save(); if(document.getElementById("invOverlay").style.display==="flex") renderInventory(); renderHUD(); }
function pickMostInjuredCivilian(){
  const civs = S.civilians.filter(c=>c.alive && !c.evac);
  if(!civs.length) return null;
  let best=civs[0], gap=(best.hpMax-best.hp);
  for(const c of civs){ const g=c.hpMax-c.hp; if(g>gap){gap=g; best=c;} }
  return gap<=0 ? null : best;
}

function renderInventory(){
  ensureStoryMetaState();
  syncSquadRosterBounds();
  const w=equippedWeapon();
  const ammoId=w.ammo;
  const baseRanks = STORY_BASE_UPGRADES.reduce((n, def)=>n + storyBaseRank(def.key), 0);
  const baseMaxRanks = STORY_BASE_UPGRADES.reduce((n, def)=>n + def.maxRank, 0);
  const specialistRanks = STORY_SPECIALIST_PERKS.reduce((n, def)=>n + storySpecialistRank(def.key), 0);
  const specialistMaxRanks = STORY_SPECIALIST_PERKS.reduce((n, def)=>n + def.maxRank, 0);
  const chapterRewards = chapterRewardUnlockedCount();
  document.getElementById("invSummary").innerHTML =
    `<b>Money:</b> $${S.funds.toLocaleString()} • <b>HP:</b> ${Math.round(S.hp)}/100 • <b>Armor:</b> ${Math.round(S.armor)}/${S.armorCap}<br>
     <b>Equipped:</b> ${w.name} • <b>Durability:</b> ${Math.round(weaponDurability(w.id))}% • <b>Ammo:</b> ${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[ammoId]||0}) • <b>Shields:</b> ${S.shields||0} • <b>Armor Plates:</b> ${totalArmorPlates()}<br>
     <b>Squad:</b> Attack ${squadAliveCount("attacker")}/${squadOwnedCount("attacker")} (down ${squadDownedCount("attacker")}) • Rescue ${squadAliveCount("rescue")}/${squadOwnedCount("rescue")} (down ${squadDownedCount("rescue")})<br>
     <b>Story Meta:</b> Base ${baseRanks}/${baseMaxRanks} • Specialist ${specialistRanks}/${specialistMaxRanks} • Chapter Rewards ${chapterRewards}/${STORY_CHAPTER_REWARDS.length}`;

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
          <button class="ghost" onclick="openShopFromInventory('ammo')">Buy</button>
        </div>
      </div>`;
  }).join("");

  const civs = (S.mode==="Survival") ? [] : S.civilians.filter(c=>c.alive);
  const perkRows = [
    { key:"H_CRIT", name:"Deadeye", detail:(r)=>`+${(r*5).toFixed(0)}% Crit Chance` },
    { key:"H_DMG", name:"Damage Boost", detail:(r)=>`+${(r*8).toFixed(0)}% Weapon Damage` },
    { key:"H_JAM", name:"Anti-Jam", detail:(r)=>`-${(r*10).toFixed(0)}% Jam Chance` },
    { key:"G_CIV_GUARD", name:"Civilian Guard", detail:(r)=>`-${(r*15).toFixed(0)}% Civilian Damage Taken` },
    { key:"G_ARMOR", name:"Armor Efficiency", detail:(r)=>`+${(r*5).toFixed(0)}% Armor Effectiveness` },
    { key:"T_TRAPS", name:"Trap Expansion", detail:(r)=>`+${(r*10).toFixed(0)}% Trap Radius` },
    { key:"T_RELOAD", name:"Reload Boost", detail:(r)=>`+${(r*10).toFixed(0)}% Reload Efficiency` },
  ];
  const perkHtml = perkRows.map((p)=>{
    const rank = perkRank(p.key);
    return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">${p.name} <span class="tag">Rank ${rank}</span></div>
          <div class="itemDesc">${p.detail(rank)}</div>
        </div>
        <div style="text-align:right">
          <button ${S.perkPoints<=0?'disabled':''} onclick="buyPerk('${p.key}')">Upgrade</button>
        </div>
      </div>`;
  }).join("");

  const unlockHtml = PROGRESSION_UNLOCKS.map((u)=>{
    const on = hasProgressionUnlock(u.key);
    return `
      <div class="item" style="padding:10px 12px; ${on ? "" : "opacity:.72;"}">
        <div>
          <div class="itemName">${on ? "✅" : "🔒"} ${u.label} <span class="tag">Level ${u.level}</span></div>
          <div class="itemDesc">${u.desc}</div>
        </div>
      </div>`;
  }).join("");
  const nextUnlock = nextProgressionUnlock();
  const progressText = nextUnlock
    ? `Next unlock at Level ${nextUnlock.level}: ${nextUnlock.label}`
    : "All progression unlocks completed.";
  const topBase = [...STORY_BASE_UPGRADES].sort((a,b)=>storyBaseRank(b.key)-storyBaseRank(a.key)).slice(0,2);
  const topSpec = [...STORY_SPECIALIST_PERKS].sort((a,b)=>storySpecialistRank(b.key)-storySpecialistRank(a.key)).slice(0,2);
  const metaBits = [
    ...topBase.map((d)=>`${d.name} R${storyBaseRank(d.key)}/${d.maxRank}`),
    ...topSpec.map((d)=>`${d.name} R${storySpecialistRank(d.key)}/${d.maxRank}`)
  ].filter(Boolean);
  const medSelected = selectedMedkitId();
  const medSelectedDef = getMed(medSelected) || MEDS[0];
  const armorSelected = selectedArmorPlateId();
  const armorSelectedDef = getArmor(armorSelected) || ARMORY[0];

  document.getElementById("invSupplies").innerHTML = `
    <div class="item">
      <div>
        <div class="itemName">❤️ Med Kits <span class="tag">Owned: ${totalMedkits()}</span></div>
        <div class="itemDesc">Heal target: <b>${S.healTarget||'self'}</b> • Selected: <b>${medTierLabel(medSelectedDef.id)} ${medSelectedDef.name}</b> (+${medSelectedDef.heal} HP)</div>
        <div class="itemDesc">${MEDS.map((m)=>`${medTierLabel(m.id)} ${m.name}: ${S.medkits?.[m.id] || 0}`).join(" • ")}</div>
      </div>
      <div style="text-align:right">
        <button onclick="setHealTarget('self')">Self</button>
        <button ${civs.length?'':'disabled'} onclick="setHealTarget('civ')">Civilian</button>
        <button class="${medSelectedDef.id===MEDS[0].id ? 'good' : 'ghost'}" ${totalMedkits()<=0?'disabled':''} onclick="setSelectedMedkit('${MEDS[0].id}')">T1</button>
        <button class="${medSelectedDef.id===MEDS[1].id ? 'good' : 'ghost'}" ${totalMedkits()<=0?'disabled':''} onclick="setSelectedMedkit('${MEDS[1].id}')">T2</button>
        <button class="${medSelectedDef.id===MEDS[2].id ? 'good' : 'ghost'}" ${totalMedkits()<=0?'disabled':''} onclick="setSelectedMedkit('${MEDS[2].id}')">T3</button>
        <button class="${medSelectedDef.id===MEDS[3].id ? 'good' : 'ghost'}" ${totalMedkits()<=0?'disabled':''} onclick="setSelectedMedkit('${MEDS[3].id}')">T4</button>
        <button class="good" ${totalMedkits()<=0?'disabled':''} onclick="useMedkit({ medId:'${medSelectedDef.id}' })">Use Selected</button>
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
        <div class="itemName">🛡️ Armor Plates <span class="tag">Owned: ${totalArmorPlates()}</span></div>
        <div class="itemDesc">Selected: <b>${armorTierLabel(armorSelectedDef.id)} ${armorSelectedDef.name}</b> (+${armorSelectedDef.addArmor} armor). T1 ${armorPlateCount("A_TIER1")} • T2 ${armorPlateCount("A_TIER2")} • T3 ${armorPlateCount("A_TIER3")} • T4 ${armorPlateCount("A_TIER4")}</div>
      </div>
      <div style="text-align:right">
        <button class="${armorSelectedDef.id==='A_TIER1' ? 'good' : 'ghost'}" ${totalArmorPlates()<=0?'disabled':''} onclick="setSelectedArmorPlate('A_TIER1')">T1</button>
        <button class="${armorSelectedDef.id==='A_TIER2' ? 'good' : 'ghost'}" ${totalArmorPlates()<=0?'disabled':''} onclick="setSelectedArmorPlate('A_TIER2')">T2</button>
        <button class="${armorSelectedDef.id==='A_TIER3' ? 'good' : 'ghost'}" ${totalArmorPlates()<=0?'disabled':''} onclick="setSelectedArmorPlate('A_TIER3')">T3</button>
        <button class="${armorSelectedDef.id==='A_TIER4' ? 'good' : 'ghost'}" ${totalArmorPlates()<=0?'disabled':''} onclick="setSelectedArmorPlate('A_TIER4')">T4</button>
        <button ${totalArmorPlates()<=0 || S.armor>=S.armorCap?'disabled':''} onclick="useArmorPlate({ armorId:'${armorSelectedDef.id}' })">Use Selected</button>
        <button class="ghost" onclick="openShopFromInventory('armor')">Buy</button>
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
    <div class="item" style="padding:10px 12px;">
      <div>
        <div class="itemName">Progression</div>
        <div class="itemDesc"><b>Level:</b> ${S.level} • <b>XP:</b> ${S.xp}/${xpNeededForLevel(S.level)} • <b>Perk Points:</b> ${S.perkPoints}</div>
        <div class="itemDesc"><b>Unlocks:</b> ${progressionUnlockCount()}/${PROGRESSION_UNLOCKS.length} • ${progressText}</div>
        <div class="itemDesc"><b>Story Meta:</b> ${metaBits.join(" • ") || "No upgrades yet"} • Rewards ${chapterRewards}/${STORY_CHAPTER_REWARDS.length}</div>
      </div>
      <div style="text-align:right"><button class="ghost" onclick="openShopFromInventory('meta')">Meta Shop</button></div>
    </div>
    ${unlockHtml}

    <div class="divider"></div>
    <div class="hudTitle">Perks</div>
    ${perkHtml}
`;
}

function useMedkit(opts={}){
  if(totalMedkits()<=0) return toast("No medkits. Buy in shop.");
  const options = (opts && typeof opts === "object") ? opts : {};
  const preferred = (typeof options.medId === "string" && getMed(options.medId)) ? options.medId : null;
  const smart = (options.smart != null) ? !!options.smart : !preferred;
  const allowFull = (options.allowFull != null) ? !!options.allowFull : !!S.inBattle;
  const autoFill = (options.autoFill != null) ? !!options.autoFill : !preferred;

  const pickIdFor = (currentHp, maxHp)=>{
    if(preferred){
      if((S.medkits?.[preferred] || 0) > 0) return preferred;
      return null;
    }
    if(smart){
      const smartPick = pickSmartMedkitId(currentHp, maxHp, allowFull);
      if(smartPick && (S.medkits?.[smartPick] || 0) > 0) return smartPick;
    }
    const selected = selectedMedkitId();
    if((S.medkits?.[selected] || 0) > 0) return selected;
    return MEDS.find((m)=>(S.medkits?.[m.id] || 0) > 0)?.id || null;
  };

  const applyToTarget = (target, getHp, setHp, maxHp)=>{
    let used = 0;
    let healed = 0;
    while(totalMedkits() > 0){
      const hpNow = clamp(Number(getHp()) || 0, 0, maxHp);
      if(hpNow >= maxHp){
        if(!allowFull || used > 0) break;
      }
      const pick = pickIdFor(hpNow, maxHp);
      if(!pick) break;
      const m = getMed(pick);
      if(!m) break;
      S.medkits[pick] = Math.max(0, (S.medkits[pick] || 0) - 1);
      const hpAfter = clamp(hpNow + m.heal, 0, maxHp);
      setHp(hpAfter);
      healed += Math.max(0, Math.round(hpAfter - hpNow));
      used += 1;
      if(preferred || !autoFill) break;
      if(hpAfter >= maxHp) break;
      if(m.heal <= 0) break;
    }
    return { target, used, healed };
  };

  if(S.healTarget==="civ" && S.mode!=="Survival"){
    const civ=pickMostInjuredCivilian();
    if(!civ) return toast("No injured civilians to heal.");
    const result = applyToTarget(civ, ()=>civ.hp, (next)=>{ civ.hp = next; }, civ.hpMax || 100);
    if(result.used <= 0){
      if(preferred) return toast(`${medTierLabel(preferred)} medkits out of stock.`);
      return toast("No usable medkits.");
    }
    sfx("ui"); hapticImpact("light"); save(); renderHUD();
    renderCombatControls();
    if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
    return toast(
      result.healed > 0
        ? `Healed civilian +${result.healed}${result.used > 1 ? ` (${result.used} kits)` : ""}`
        : `Medkit used${result.used > 1 ? ` (${result.used})` : ""}.`
    );
  }

  if(S.hp>=100 && !allowFull) return toast("HP already full.");
  const result = applyToTarget(S.me, ()=>S.hp, (next)=>{ S.hp = next; }, 100);
  if(result.used <= 0){
    if(preferred) return toast(`${medTierLabel(preferred)} medkits out of stock.`);
    if(S.hp>=100 && !allowFull) return toast("HP already full.");
    return toast("No usable medkits.");
  }
  sfx("ui"); hapticImpact("light"); save(); renderHUD();
  renderCombatControls();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(
    result.healed > 0
      ? `Healed +${result.healed}${result.used > 1 ? ` (${result.used} kits)` : ""}`
      : `Medkit used${result.used > 1 ? ` (${result.used})` : ""}. HP remains full.`
  );
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
function useArmorPlate(opts={}){
  const options = opts || {};
  const silent = !!options.silent;
  const skipSfx = !!options.skipSfx;
  const skipRender = !!options.skipRender;
  const skipSave = !!options.skipSave;
  const preferred = (typeof options.armorId === "string" && getArmor(options.armorId)) ? options.armorId : null;
  const smart = (options.smart != null) ? !!options.smart : !preferred;
  const autoFill = (options.autoFill != null) ? !!options.autoFill : !preferred;
  const plates = totalArmorPlates();
  if(plates <= 0){
    if(!silent) toast("No armor plates. Buy in Shop > Armor.");
    return 0;
  }
  if(S.armor >= S.armorCap){
    if(!silent) toast("Armor already full.");
    return 0;
  }
  const pickId = ()=>{
    if(preferred){
      if(armorPlateCount(preferred) > 0) return preferred;
      return null;
    }
    return (smart ? pickSmartArmorPlateId() : null) ||
      ((armorPlateCount(selectedArmorPlateId()) > 0) ? selectedArmorPlateId() : null) ||
      ARMORY.find((ar)=>armorPlateCount(ar.id) > 0)?.id || null;
  };

  let restoredTotal = 0;
  let used = 0;
  let lastPlateName = "Armor plate";
  while(totalArmorPlates() > 0){
    if(S.armor >= S.armorCap) break;
    const pick = pickId();
    if(!pick) break;
    const plate = getArmor(pick);
    if(!plate) break;
    const beforeCount = armorPlateCount(pick);
    if(beforeCount <= 0) break;
    ensureArmorPlateInventoryState();
    ensureArmorPlateFallbackState();
    S.armorPlates[pick] = beforeCount - 1;
    S.armorPlatesFallback[pick] = beforeCount - 1;
    const prevArmor = S.armor;
    S.armor = clamp(S.armor + (plate.addArmor || 0), 0, S.armorCap);
    const restored = Math.max(0, Math.round(S.armor - prevArmor));
    if(restored <= 0){
      S.armorPlates[pick] = beforeCount;
      S.armorPlatesFallback[pick] = beforeCount;
      break;
    }
    used += 1;
    restoredTotal += restored;
    lastPlateName = plate.name || "Armor plate";
    if(preferred || !autoFill) break;
    if(S.armor >= S.armorCap) break;
  }
  if(restoredTotal <= 0){
    if(!silent){
      if(preferred && armorPlateCount(preferred) <= 0) toast(`${armorTierLabel(preferred)} armor plates out of stock.`);
      else if(S.armor >= S.armorCap) toast("Armor already full.");
      else toast("No armor plates. Buy in Shop > Armor.");
    }
    return 0;
  }
  if(!skipSfx){
    sfx("ui");
    hapticImpact("light");
  }
  if(!skipSave) save();
  if(!skipRender){
    renderHUD();
    renderCombatControls();
    if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  }
  if(!silent) toast(`${lastPlateName} restored +${restoredTotal}${used > 1 ? ` (${used} plates)` : ""}.`);
  return restoredTotal;
}

// ===================== BACKUP =====================
function callBackup(){
  openShop();
  shopTab("squad");
  toast(`Reinforcement moved to Shop > Squad ($${REINFORCEMENT_BUNDLE_PRICE.toLocaleString()}).`);
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
  S.stats.trapsPlaced = (S.stats.trapsPlaced || 0) + 1;
  if(!Array.isArray(S.trapsPlaced)) S.trapsPlaced = [];
  if(S.trapsPlaced.length >= MAX_PERSIST_TRAPS) S.trapsPlaced.shift();

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
    S.stats.trapsTriggered = (S.stats.trapsTriggered || 0) + 1;

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
  if(!S._tutorialSnapshot){
    S._tutorialSnapshot = cloneState(S);
  }
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
  S.supportUnits = [];
  S.mapInteractables = [];
  S.eventText = "";
  S.fogUntil = 0;
  S.inBattle = false;
  S.activeTigerId = null;
  S.comboCount = 0;
  S.comboExpireAt = 0;
  S.me = { x:230, y:330, face:0, step:0 };
  S.evacZone = { x:160, y:140, r:70 };
  S.stats.shots = 0;
  S.stats.captures = 0;
  S.stats.kills = 0;
  S.stats.evac = 0;
  S.stats.trapsPlaced = 0;
  S.stats.trapsTriggered = 0;
  S.shields = Math.max(1, S.shields || 0);
  S.shieldUntil = 0;
  ensureAbilityCooldownState();
  S.abilityCooldowns.scan = 0;
  S.abilityCooldowns.sprint = 0;
  S.abilityCooldowns.shield = 0;

  // Tutorial loadout guarantees Attack and Capture steps can proceed.
  if(!S.ownedWeapons.includes("W_9MM_JUNK")) S.ownedWeapons.push("W_9MM_JUNK");
  if(!S.ownedWeapons.includes("W_TRQ_PISTOL_MK1")) S.ownedWeapons.push("W_TRQ_PISTOL_MK1");
  S.ammoReserve["9MM_STD"] = Math.max(S.ammoReserve["9MM_STD"]||0, 24);
  S.ammoReserve["TRANQ_DARTS"] = Math.max(S.ammoReserve["TRANQ_DARTS"]||0, 12);
  S.equippedWeaponId = "W_9MM_JUNK";
  const tutorialWeapon = getWeapon(S.equippedWeaponId);
  if(tutorialWeapon){
    S.mag.cap = tutorialWeapon.mag;
    S.mag.loaded = tutorialWeapon.mag;
  }

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
  const snapshot = S._tutorialSnapshot || null;
  delete S._tutorialSnapshot;
  const prev = S._tutorialPrev || null;
  delete S._tutorialPrev;

  ["battleOverlay","shopOverlay","invOverlay","completeOverlay","overOverlay","weaponQuickOverlay","launchIntroOverlay","storyIntroOverlay","missionBriefOverlay","hudOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });

  if(snapshot){
    S = snapshot;
    bindFundsWallet(S);
    syncWindowState();
    resizeCanvasForViewport();
    maybeRenderHUD(true);
    return;
  }

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
function randomEvacZone(civilians=[]){
  const r = 70;
  const minX = 110;
  const maxX = cv.width - 90;
  const minY = 120;
  const maxY = cv.height - 90;
  const validCivs = (Array.isArray(civilians) ? civilians : [])
    .filter((c)=>c && Number.isFinite(c.x) && Number.isFinite(c.y) && c.alive !== false && !c.evac);

  if(!validCivs.length){
    const fresh = safeSpawnPoint(rand(minX, maxX), rand(minY, maxY), Math.round(r * 0.45), true, true);
    return { x:fresh.x, y:fresh.y, r };
  }

  const candidates = [];
  const cols = 12;
  const rows = 9;
  for(let yi=0; yi<=rows; yi++){
    const py = minY + ((maxY - minY) * (yi / rows));
    for(let xi=0; xi<=cols; xi++){
      const px = minX + ((maxX - minX) * (xi / cols));
      candidates.push({ x:px, y:py });
    }
  }

  candidates.push(
    { x:minX, y:minY }, { x:maxX, y:minY },
    { x:minX, y:maxY }, { x:maxX, y:maxY },
    { x:Math.round((minX + maxX) * 0.5), y:minY },
    { x:Math.round((minX + maxX) * 0.5), y:maxY },
    { x:minX, y:Math.round((minY + maxY) * 0.5) },
    { x:maxX, y:Math.round((minY + maxY) * 0.5) }
  );

  for(let i=0;i<20;i++){
    candidates.push({
      x: rand(minX, maxX),
      y: rand(minY, maxY)
    });
  }

  let best = null;
  for(const pt of candidates){
    if(inMapScenarioKeepout(pt.x, pt.y, Math.round(r * 0.85))) continue;
    if(blockedAt(pt.x, pt.y, Math.round(r * 0.45))) continue;
    if(isPointInWater(pt.x, pt.y, Math.round(r * 0.50))) continue;
    let nearest = Infinity;
    for(const civ of validCivs){
      nearest = Math.min(nearest, dist(pt.x, pt.y, civ.x, civ.y));
    }
    if(!best || nearest > best.nearest){
      best = { x:pt.x, y:pt.y, nearest };
    }
  }

  if((best?.nearest ?? 0) < (r + 12)){
    for(let i=0;i<50;i++){
      const trialX = rand(minX, maxX);
      const trialY = rand(minY, maxY);
      if(inMapScenarioKeepout(trialX, trialY, Math.round(r * 0.85))) continue;
      if(blockedAt(trialX, trialY, Math.round(r * 0.45))) continue;
      if(isPointInWater(trialX, trialY, Math.round(r * 0.50))) continue;
      let nearest = Infinity;
      for(const civ of validCivs){
        nearest = Math.min(nearest, dist(trialX, trialY, civ.x, civ.y));
      }
      if(!best || nearest > best.nearest){
        best = { x:trialX, y:trialY, nearest };
      }
    }
  }

  if(best){
    let zx = best.x;
    let zy = best.y;
    for(let pass=0; pass<4; pass++){
      let nearest = Infinity;
      let nearestCiv = null;
      for(const civ of validCivs){
        const d = dist(zx, zy, civ.x, civ.y);
        if(d < nearest){
          nearest = d;
          nearestCiv = civ;
        }
      }
      if(nearest >= (r + 8) || !nearestCiv) break;
      const angle = Math.atan2(zy - nearestCiv.y, zx - nearestCiv.x) || 0;
      const push = (r + 18) - nearest;
      zx = clamp(zx + Math.cos(angle) * push, minX, maxX);
      zy = clamp(zy + Math.sin(angle) * push, minY, maxY);
      if(inMapScenarioKeepout(zx, zy, Math.round(r * 0.85))){
        const moved = findNearestOpenPoint(zx, zy, Math.round(r * 0.45), {
          avoidKeepout:true,
          avoidWater:true,
          targetX:cv.width * 0.44,
          targetY:cv.height * 0.56
        });
        if(moved){
          zx = moved.x;
          zy = moved.y;
        }
      }
      best = { x:zx, y:zy, nearest };
    }
  }

  const fallbackX = Math.round(best?.x ?? rand(minX, maxX));
  const fallbackY = Math.round(best?.y ?? rand(minY, maxY));
  let zonePoint = safeSpawnPoint(fallbackX, fallbackY, Math.round(r * 0.45), true, true);
  if(isPointInWater(zonePoint.x, zonePoint.y, Math.round(r * 0.50))){
    const dryPoint = findNearestOpenPoint(zonePoint.x, zonePoint.y, Math.round(r * 0.45), {
      avoidKeepout:true,
      avoidWater:true,
      targetX:cv.width * 0.5,
      targetY:cv.height * 0.5
    });
    if(dryPoint) zonePoint = dryPoint;
  }
  if(inMapScenarioKeepout(zonePoint.x, zonePoint.y, Math.round(r * 0.85))){
    const clearPoint = findNearestOpenPoint(zonePoint.x, zonePoint.y, Math.round(r * 0.45), {
      avoidKeepout:true,
      avoidWater:true,
      targetX:cv.width * 0.40,
      targetY:cv.height * 0.55
    });
    if(clearPoint) zonePoint = clearPoint;
  }
  return { x:zonePoint.x, y:zonePoint.y, r };
}

function validateMissionSpawnLayout(opts={}){
  const repair = opts?.repair !== false;
  if(!S || typeof S !== "object") return { fixed:0 };
  if(!Number.isFinite(cv.width) || !Number.isFinite(cv.height) || cv.width < 100 || cv.height < 100) return { fixed:0 };

  let fixed = 0;
  const aliveCivs = (S.civilians || []).filter((c)=>c && c.alive !== false && !c.evac && Number.isFinite(c.x) && Number.isFinite(c.y));
  const aliveTigers = (S.tigers || []).filter((t)=>t && t.alive && Number.isFinite(t.x) && Number.isFinite(t.y));

  if(S.mode !== "Survival" && S.evacZone && aliveCivs.length){
    let nearest = Infinity;
    for(const civ of aliveCivs){
      nearest = Math.min(nearest, dist(civ.x, civ.y, S.evacZone.x, S.evacZone.y));
    }
    const evacTooClose = nearest < Math.max(150, (S.evacZone.r || 70) + 64);
    const evacInvalid = inMapScenarioKeepout(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.86))
      || blockedAt(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.45))
      || isPointInWater(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.50));
    if((evacTooClose || evacInvalid) && repair){
      S.evacZone = randomEvacZone(aliveCivs);
      fixed += 1;
    }
  }

  if(S.me && aliveTigers.length){
    let nearTiger = Infinity;
    for(const t of aliveTigers){
      nearTiger = Math.min(nearTiger, dist(S.me.x, S.me.y, t.x, t.y));
    }
    if(nearTiger < 128 && repair){
      const mePt = safeSpawnPoint(cv.width * 0.16, cv.height * 0.78, 16, true, false);
      S.me.x = mePt.x;
      S.me.y = mePt.y;
      fixed += 1;
    }
  }

  if(repair){
    for(const civ of aliveCivs){
      if(inMapScenarioKeepout(civ.x, civ.y, 12)){
        const pt = safeSpawnPoint(civ.x, civ.y, 14, true, false);
        civ.x = pt.x;
        civ.y = pt.y;
        fixed += 1;
      }
    }
  }

  if(repair){
    for(const tiger of aliveTigers){
      let tooClose = dist(tiger.x, tiger.y, S.me.x, S.me.y) < 150;
      if(!tooClose && S.mode !== "Survival"){
        for(const civ of aliveCivs){
          if(dist(tiger.x, tiger.y, civ.x, civ.y) < 175){
            tooClose = true;
            break;
          }
        }
      }
      if(tooClose){
        const pt = pickTigerSpawnAwayFromEscort(tiger.x, tiger.y);
        tiger.x = pt.x;
        tiger.y = pt.y;
        tiger.vx = clamp(Number(tiger.vx) || 0, -3.8, 3.8);
        tiger.vy = clamp(Number(tiger.vy) || 0, -3.8, 3.8);
        fixed += 1;
      }
    }
  }

  return { fixed, civilians: aliveCivs.length, tigers: aliveTigers.length };
}

function transitionCleanupSweep(reason=""){
  if(!S || typeof S !== "object") return;
  const r = String(reason || "");
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.carcasses)) S.carcasses = [];
  if(!Array.isArray(S.trapsPlaced)) S.trapsPlaced = [];
  if(!Array.isArray(S.rescueSites)) S.rescueSites = [];
  if(!Array.isArray(S.mapInteractables)) S.mapInteractables = [];
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.tigers)) S.tigers = [];
  S.scanPing = clamp(Number(S.scanPing) || 0, 0, 42);

  if(!S.inBattle){
    S.activeTigerId = null;
    S._combatTigerAttackAt = 0;
    if(S.lockedTigerId != null){
      const t = tigerById(S.lockedTigerId);
      if(!t || !t.alive) S.lockedTigerId = null;
    }
  }

  if(r.includes("deploy") || r.includes("complete") || r.includes("over") || r.includes("recover")){
    clearTransientCombatVisuals();
  }
  if(r.includes("battle-end")) clearTransientCombatVisuals();

  clearEscortTakeoverPrompt();
  try{ sanitizeRuntimeState(); }catch(e){}
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
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((site)=>{
      let pt = safeSpawnPoint(site.x, site.y, Math.round((site.r || 44) * 0.42), true, true);
      if(inMapScenarioKeepout(pt.x, pt.y, Math.round((site.r || 44) * 0.42))){
        const clear = findNearestOpenPoint(pt.x, pt.y, Math.round((site.r || 44) * 0.42), {
          avoidKeepout:true,
          avoidWater:true,
          targetX:cv.width * 0.48,
          targetY:cv.height * 0.52
        });
        if(clear) pt = clear;
      }
      return { ...site, x:pt.x, y:pt.y };
    });
}

function pickTigerPersonality(type){
  const r = Math.random();
  if(type==="Alpha") return r < 0.5 ? "Sentinel" : (r < 0.8 ? "Hunter" : "Fury");
  if(type==="Berserker") return r < 0.6 ? "Fury" : (r < 0.85 ? "Hunter" : "Ambusher");
  if(type==="Stalker") return r < 0.6 ? "Ambusher" : (r < 0.85 ? "Hunter" : "Fury");
  if(type==="Scout") return r < 0.55 ? "Hunter" : (r < 0.85 ? "Ambusher" : "Sentinel");
  return r < 0.35 ? "Hunter" : (r < 0.62 ? "Ambusher" : (r < 0.84 ? "Sentinel" : "Fury"));
}

function tigerPersonalityProfile(t, now=Date.now()){
  const pKey = t?.personality || "Hunter";
  const base = TIGER_PERSONALITIES[pKey] || TIGER_PERSONALITIES.Hunter;
  const hpPct = t?.hpMax ? (t.hp / t.hpMax) : 1;
  let speedMul = base.speedMul;
  let detectMul = base.detectMul;
  let pounceMul = base.pounceMul;
  let playerBias = base.playerBias;
  let civBiasDelta = base.civBiasDelta;

  if(pKey==="Fury" && hpPct < 0.55){
    const rage = clamp((0.55 - hpPct) * 1.45, 0, 0.35);
    speedMul += rage;
    detectMul += rage * 0.35;
    pounceMul += rage * 0.55;
    playerBias += rage * 0.45;
    civBiasDelta -= rage * 0.35;
  }

  if(pKey==="Ambusher" && now < (t?.burstUntil || 0)){
    speedMul += 0.08;
    pounceMul += 0.12;
  }

  return {
    key: pKey,
    label: base.label || pKey,
    playerBias,
    civBiasDelta,
    speedMul,
    detectMul,
    pounceMul,
    packPullMul: base.packPullMul || 1
  };
}

function setTigerIntent(t, label, ms=520){
  if(!t) return;
  t.intent = label;
  t.intentUntil = Date.now() + ms;
}

function ensureTigerHuntState(t, now=Date.now()){
  if(!t) return;
  const st = t.huntState;
  if(st !== TIGER_HUNT_STATES.PATROL && st !== TIGER_HUNT_STATES.STALK && st !== TIGER_HUNT_STATES.POUNCE && st !== TIGER_HUNT_STATES.RECOVER){
    t.huntState = TIGER_HUNT_STATES.PATROL;
  }
  if(!Number.isFinite(t.huntStateUntil) || t.huntStateUntil <= 0){
    t.huntStateUntil = now + rand(900, 1500);
  }
  if(!Number.isFinite(t.pounceWindupUntil)) t.pounceWindupUntil = 0;
  if(!Number.isFinite(t.pounceDirX)) t.pounceDirX = 0;
  if(!Number.isFinite(t.pounceDirY)) t.pounceDirY = 0;
}

function setTigerHuntState(t, nextState, now=Date.now(), durationMs=640){
  if(!t) return;
  t.huntState = nextState;
  t.huntStateUntil = now + Math.max(120, durationMs);
  if(nextState !== TIGER_HUNT_STATES.POUNCE){
    t.pounceWindupUntil = 0;
  }
}

function tigerHuntStateTick(t, now, targetX, targetY, targetDist, motion){
  ensureTigerHuntState(t, now);
  const hasTarget = Number.isFinite(targetDist) && targetDist < (motion.detect + 80);
  const inPounceBand = Number.isFinite(targetDist) && targetDist > 88 && targetDist < 340;

  if(t.huntState === TIGER_HUNT_STATES.RECOVER){
    if(now >= (t.huntStateUntil || 0)){
      setTigerHuntState(t, hasTarget ? TIGER_HUNT_STATES.STALK : TIGER_HUNT_STATES.PATROL, now, hasTarget ? rand(700, 1200) : rand(900, 1700));
    } else {
      setTigerIntent(t, "Recover", 260);
    }
    return;
  }

  if(t.huntState === TIGER_HUNT_STATES.POUNCE){
    if(now < (t.pounceWindupUntil || 0)){
      setTigerIntent(t, "Pounce!", Math.max(160, (t.pounceWindupUntil || 0) - now));
    } else {
      setTigerIntent(t, "Pounce", 220);
    }
    if(now >= (t.huntStateUntil || 0)){
      setTigerHuntState(t, TIGER_HUNT_STATES.RECOVER, now, rand(520, 820));
      t.nextPounceAt = now + rand(motion.pounceCd[0], motion.pounceCd[1]);
    }
    return;
  }

  if(t.huntState === TIGER_HUNT_STATES.PATROL){
    if(hasTarget){
      setTigerHuntState(t, TIGER_HUNT_STATES.STALK, now, rand(700, 1300));
      setTigerIntent(t, "Stalk", 320);
      return;
    }
    if(now >= (t.huntStateUntil || 0)){
      t.huntStateUntil = now + rand(900, 1700);
    }
    return;
  }

  // STALK
  if(!hasTarget){
    setTigerHuntState(t, TIGER_HUNT_STATES.PATROL, now, rand(950, 1700));
    return;
  }

  if(inPounceBand && ((t.nextPounceAt || 0) - now) < 360){
    setTigerIntent(t, "Pounce soon", 260);
  } else {
    setTigerIntent(t, "Stalk", 220);
  }

  if(inPounceBand && now >= (t.nextPounceAt || 0)){
    const chance = clamp(motion.pounceChance + 0.05, 0.09, 0.34);
    if(Math.random() < chance){
      const dx = targetX - t.x;
      const dy = targetY - t.y;
      const dd = Math.hypot(dx, dy) || 1;
      t.pounceDirX = dx / dd;
      t.pounceDirY = dy / dd;
      t.pounceWindupUntil = now + rand(200, 340);
      setTigerHuntState(t, TIGER_HUNT_STATES.POUNCE, now, (t.pounceWindupUntil - now) + rand(420, 660));
      t.burstUntil = Math.max(t.burstUntil || 0, t.huntStateUntil + 80);
      setTigerIntent(t, "Pounce!", Math.max(200, t.pounceWindupUntil - now));
    } else {
      t.nextPounceAt = now + rand(440, 980);
    }
  } else if(now >= (t.huntStateUntil || 0)){
    t.huntStateUntil = now + rand(700, 1300);
  }
}

function mapInteractablePool(){
  const w = cv.width;
  const h = cv.height;
  const key = currentMapKey();
  const pools = {
    ST_FOREST: [
      { kind:"alarm", label:"Siren Tree", x:w*0.20, y:h*0.14 },
      { kind:"barricade", label:"Trail Gate", x:w*0.54, y:h*0.56 },
      { kind:"cache", label:"Ranger Cache", x:w*0.34, y:h*0.70 }
    ],
    ST_SUBURBS: [
      { kind:"alarm", label:"Street Alarm", x:w*0.17, y:h*0.23 },
      { kind:"barricade", label:"Blockade Switch", x:w*0.58, y:h*0.50 },
      { kind:"cache", label:"Garage Cache", x:w*0.34, y:h*0.66 }
    ],
    ST_DOWNTOWN: [
      { kind:"alarm", label:"Tower Siren", x:w*0.16, y:h*0.22 },
      { kind:"barricade", label:"Barrier Console", x:w*0.60, y:h*0.53 },
      { kind:"cache", label:"Service Crate", x:w*0.34, y:h*0.70 }
    ],
    ST_INDUSTRIAL: [
      { kind:"alarm", label:"Plant Alarm", x:w*0.18, y:h*0.22 },
      { kind:"barricade", label:"Steel Gate", x:w*0.56, y:h*0.50 },
      { kind:"cache", label:"Dock Cache", x:w*0.34, y:h*0.69 }
    ],
    AR_ARENA_BAY: [
      { kind:"alarm", label:"Arena Siren", x:w*0.18, y:h*0.26 },
      { kind:"barricade", label:"Bay Gate", x:w*0.56, y:h*0.50 },
      { kind:"cache", label:"Pit Cache", x:w*0.34, y:h*0.68 }
    ],
    AR_NEON_GRID: [
      { kind:"alarm", label:"Neon Beacon", x:w*0.17, y:h*0.24 },
      { kind:"barricade", label:"Grid Wall", x:w*0.58, y:h*0.48 },
      { kind:"cache", label:"Arc Cache", x:w*0.34, y:h*0.64 }
    ],
    AR_SAND_YARD: [
      { kind:"alarm", label:"Dust Alarm", x:w*0.20, y:h*0.18 },
      { kind:"barricade", label:"Dune Barrier", x:w*0.55, y:h*0.52 },
      { kind:"cache", label:"Yard Cache", x:w*0.34, y:h*0.70 }
    ],
    AR_STEEL_PIT: [
      { kind:"alarm", label:"Steel Horn", x:w*0.19, y:h*0.23 },
      { kind:"barricade", label:"Pit Lock", x:w*0.57, y:h*0.50 },
      { kind:"cache", label:"Steel Cache", x:w*0.34, y:h*0.67 }
    ]
  };
  const fallback = [
    { kind:"alarm", label:"Alert Beacon", x:w*0.18, y:h*0.18 },
    { kind:"barricade", label:"Barrier Node", x:w*0.56, y:h*0.54 },
    { kind:"cache", label:"Supply Cache", x:w*0.34, y:h*0.70 }
  ];
  return (pools[key] || fallback).map((it)=>({
    kind: it.kind,
    label: it.label,
    x: clamp(Math.round(it.x), 70, w - 70),
    y: clamp(Math.round(it.y), 90, h - 80)
  }));
}

function spawnMapInteractables(){
  if(window.__TUTORIAL_MODE__ || S.mode==="Survival"){
    S.mapInteractables = [];
    return;
  }
  const base = mapInteractablePool();
  S.mapInteractables = base.map((it, idx)=>{
    let pt = safeSpawnPoint(it.x, it.y, 22, true, true);
    if(inMapScenarioKeepout(pt.x, pt.y, 22)){
      const clear = findNearestOpenPoint(pt.x, pt.y, 22, {
        avoidKeepout:true,
        avoidWater:true,
        targetX:cv.width * 0.48,
        targetY:cv.height * 0.52
      });
      if(clear) pt = clear;
    }
    return {
      id: `INT-${idx+1}`,
      kind: it.kind,
      label: it.label,
      x: pt.x,
      y: pt.y,
      r: 22,
      uses: it.kind === "cache" ? 1 : 99,
      cooldownUntil: 0,
      activeUntil: 0,
      effectR: it.kind === "barricade" ? barricadeEffectRadius() : 0
    };
  });
}

function findInteractableAt(x,y){
  const items = S.mapInteractables || [];
  for(const it of items){
    const tapR = (it.r || 22) + 10;
    if(dist(x,y,it.x,it.y) <= tapR) return it;
  }
  return null;
}
function nearestCacheInteractable(maxDist=128){
  const items = S.mapInteractables || [];
  let best = null;
  let bestD = Infinity;
  for(const it of items){
    if(it.kind !== "cache") continue;
    if((it.uses || 0) <= 0) continue;
    const d = dist(S.me.x, S.me.y, it.x, it.y);
    if(d < bestD){
      bestD = d;
      best = it;
    }
  }
  if(!best) return null;
  return bestD <= maxDist ? best : null;
}
function useNearestCache(){
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  const cache = nearestCacheInteractable(132);
  if(!cache){
    toast("Move closer to a cache to open it.");
    return;
  }
  const changed = activateMapInteractable(cache);
  if(changed){
    sfx("ui");
    hapticImpact("light");
    save();
  }
}

function activeBarricades(now=Date.now()){
  return (S.mapInteractables || []).filter((it)=>it.kind==="barricade" && now < (it.activeUntil || 0));
}

function activateMapInteractable(it){
  if(!it) return false;
  const now = Date.now();
  if((it.uses||0) <= 0){
    toast(`${it.label} already used.`);
    return false;
  }
  if(now < (it.cooldownUntil || 0)){
    const sec = Math.max(1, Math.ceil(((it.cooldownUntil || 0) - now) / 1000));
    toast(`${it.label} cooling down (${sec}s).`);
    return false;
  }

  if(it.kind==="alarm"){
    S.scanPing = Math.max(S.scanPing || 0, 220);
    for(const tiger of (S.tigers || [])){
      if(!tiger.alive) continue;
      if(dist(it.x, it.y, tiger.x, tiger.y) < 260){
        tiger.holdUntil = Math.max(tiger.holdUntil || 0, now + 1100);
        tiger.aggroBoost = clamp((tiger.aggroBoost || 0) + 0.06, 0, 1.5);
      }
    }
    it.activeUntil = now + 1400;
    it.cooldownUntil = now + 18000;
    setEventText("📡 Siren triggered: nearby tigers exposed and staggered.", 3);
    __savePending = true;
    return true;
  }

  if(it.kind==="barricade"){
    it.effectR = barricadeEffectRadius();
    it.activeUntil = now + 9500;
    it.cooldownUntil = now + 21000;
    setEventText("🧱 Barrier deployed: tigers are forced around the block zone.", 3);
    __savePending = true;
    return true;
  }

  if(it.kind==="cache"){
    const cash = Math.round(rand(180, 520) * cacheRewardMul());
    S.funds += cash;
    S.stats.cashEarned += cash;
    const w = equippedWeapon();
    if(w){
      const refillBase = Math.max(2, Math.floor(w.mag * 0.6));
      const refill = Math.round(refillBase * (hasProgressionUnlock("cache_boost") ? 1.25 : 1));
      S.ammoReserve[w.ammo] = (S.ammoReserve[w.ammo] || 0) + refill;
    }
    if(Math.random() < 0.45){
      S.armor = clamp(S.armor + rand(6, 16), 0, S.armorCap);
    }
    if(Math.random() < 0.32){
      S.trapsOwned += 1;
    }
    it.uses = Math.max(0, (it.uses || 0) - 1);
    it.cooldownUntil = now + 60000;
    it.activeUntil = now + 900;
    setEventText(`📦 ${it.label} opened: +$${cash} and supplies found.`, 3);
    unlockAchv("pickup1","First Pickup");
    addXP(18);
    __savePending = true;
    return true;
  }

  return false;
}

function mapInteractableTick(){
  if(!Array.isArray(S.mapInteractables)) S.mapInteractables = [];
  const now = Date.now();
  for(const it of S.mapInteractables){
    if(it.activeUntil && now >= it.activeUntil && it.kind !== "barricade"){
      it.activeUntil = 0;
    }
  }
}

function comboTick(){
  if((S.comboCount || 0) <= 0) return;
  if(Date.now() > (S.comboExpireAt || 0)){
    S.comboCount = 0;
    S.comboExpireAt = 0;
  }
}

function arcadeModeTick(){
  if(window.__TUTORIAL_MODE__) return;
  if(S.mode!=="Arcade") return;
  if(S.gameOver || S.missionEnded) return;
  const limit = Math.max(0, Math.floor(Number(S.arcadeMissionLimitSec || 0)));
  const started = Math.max(0, Math.floor(Number(S.arcadeMissionStartAt || 0)));
  if(limit <= 0 || started <= 0) return;

  const left = arcadeMissionTimeLeftSec();
  if(left <= 0){
    gameOverChoice("Arcade timer expired.\nMission failed.\nPush faster routes and chain combos for higher medals.");
    return;
  }

  let warnBucket = 0;
  if(left <= 5) warnBucket = 5;
  else if(left <= 10) warnBucket = 10;
  else if(left <= 20) warnBucket = 20;
  if(warnBucket > 0 && S._arcadeTimerWarn !== warnBucket){
    S._arcadeTimerWarn = warnBucket;
    setEventText(`Arcade timer: ${left}s remaining`, 1.8);
  }
}

function breakCombo(reason=""){
  const prev = S.comboCount || 0;
  if(prev <= 0){
    S.comboCount = 0;
    S.comboExpireAt = 0;
    return;
  }
  S.comboCount = 0;
  S.comboExpireAt = 0;
  if(reason && prev >= 2){
    setEventText(`Combo ended: ${reason}`, 2);
  }
}

function awardCombo(kind){
  if(window.__TUTORIAL_MODE__) return;
  const now = Date.now();
  const within = (S.comboExpireAt || 0) > now;
  S.comboCount = within ? (S.comboCount || 0) + 1 : 1;
  S.comboExpireAt = now + comboWindowMs();
  S.comboBest = Math.max(S.comboBest || 0, S.comboCount || 0);

  const baseCash = kind==="capture" ? 180 : 120;
  const baseXp = kind==="capture" ? 24 : 16;
  const chain = Math.max(1, S.comboCount || 1);
  const bonusCash = Math.round(baseCash * (1 + ((chain - 1) * 0.30)));
  const bonusXp = Math.round(baseXp * (1 + ((chain - 1) * 0.22)));

  S.funds += bonusCash;
  S.stats.cashEarned += bonusCash;
  addXP(bonusXp);
  let arcadeSuffix = "";
  if(S.mode==="Arcade"){
    const mult = arcadeComboMultiplier();
    const scoreBonus = Math.max(8, Math.round((kind==="capture" ? 42 : 28) * mult));
    S.score += scoreBonus;
    S.arcadeScoreBonus = Math.max(0, Math.floor(Number(S.arcadeScoreBonus || 0))) + scoreBonus;
    S.arcadeComboPeak = Math.max(Math.floor(Number(S.arcadeComboPeak || 0)), chain);
    arcadeSuffix = ` • +${scoreBonus} score`;
  }
  setEventText(`🔥 ${kind==="capture" ? "Capture" : "Rescue"} combo x${chain}: +$${bonusCash} +${bonusXp}XP${arcadeSuffix}`, 2.5);
  __savePending = true;
}

function createSupportUnit(role, slotIndex=0){
  const attacker = role === "attacker";
  const hpMax = storySupportHpMax(role);
  const armorBase = storySupportArmorBase(role);
  const lane = slotIndex % 3;
  const row = Math.floor(slotIndex / 3);
  const baseX = attacker ? (S.me.x - 34 - (lane * 20)) : (S.me.x + 36 + (lane * 20));
  const baseY = attacker ? (S.me.y + 32 + (row * 20)) : (S.me.y + 28 + (row * 20));
  return {
    id: `${attacker ? "A" : "R"}-${Date.now()}-${rand(100,999)}`,
    name: attacker ? "Tiger Specialist" : "Rescue Specialist",
    role,
    x: clamp(baseX, 40, cv.width - 40),
    y: clamp(baseY, 60, cv.height - 40),
    homeX: S.me.x,
    homeY: S.me.y,
    face:0,
    step:rand(0,1000),
    hp: hpMax,
    hpMax,
    armor: armorBase,
    fireAt:0,
    guideAt:0,
    alive:true
  };
}

function spawnSupportUnits(){
  if(window.__TUTORIAL_MODE__) return;
  syncSquadRosterBounds();
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];

  const alive = S.supportUnits.filter((unit)=>unit && unit.alive !== false);
  const attackersWanted = clamp(squadAliveCount("attacker"), 0, SQUAD_MAX_PER_ROLE);
  const rescuersWanted = clamp(squadAliveCount("rescue"), 0, SQUAD_MAX_PER_ROLE);

  const attackers = alive.filter((unit)=>unit.role === "attacker").slice(0, attackersWanted);
  const rescuers = alive.filter((unit)=>unit.role === "rescue").slice(0, rescuersWanted);

  while(attackers.length < attackersWanted){
    attackers.push(createSupportUnit("attacker", attackers.length));
  }
  while(rescuers.length < rescuersWanted){
    rescuers.push(createSupportUnit("rescue", rescuers.length));
  }

  const merged = [...attackers, ...rescuers].slice(0, 16);
  merged.forEach((unit, idx)=>{
    const lane = idx % 4;
    const row = Math.floor(idx / 4);
    const side = unit.role === "attacker" ? -1 : 1;
    unit.homeX = S.me.x;
    unit.homeY = S.me.y;
    const spawnPt = safeSpawnPoint(
      clamp(S.me.x + side * (40 + lane * 22), 40, cv.width - 40),
      clamp(S.me.y + 30 + row * 22, 60, cv.height - 40),
      16,
      true,
      true
    );
    unit.x = spawnPt.x;
    unit.y = spawnPt.y;
    unit.face = Number.isFinite(unit.face) ? unit.face : 0;
    unit.step = Number.isFinite(unit.step) ? unit.step : rand(0, 1000);
    const targetHpMax = storySupportHpMax(unit.role);
    const hpRatio = Number.isFinite(unit.hpMax) && unit.hpMax > 0 ? clamp(unit.hp / unit.hpMax, 0, 1) : 1;
    unit.hpMax = targetHpMax;
    if(!Number.isFinite(unit.hp)) unit.hp = unit.hpMax;
    else unit.hp = clamp(Math.round(unit.hpMax * hpRatio), 0, unit.hpMax);
    unit.armor = storySupportArmorBase(unit.role);
    unit.alive = unit.hp > 0;
  });
  S.supportUnits = merged.filter((unit)=>unit.alive);
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
      following:false,
      escortOwner:"",
      escortUnitId:"",
      fleeUntil:0,
      fleeFromTigerId:0,
      _takeoverPromptLockUntil:0,
      face:0,
      step:0,
      skin:SKIN_TONES[2],
      shirt:"#22c55e",
      pants:"#1f2937",
      hair:1
    }];
    S.evacDone = 0;
    return;
  }

  const storyMission = (S.mode==="Story") ? storyCampaignMission(S.storyLevel) : null;
  const arcadeMission = (S.mode==="Arcade") ? arcadeCampaignMission(S.arcadeLevel) : null;
  const n = (S.mode==="Story")
    ? clamp(storyMission?.civilians ?? (3 + (S.storyLevel-1)), 0, 14)
    : (S.mode==="Arcade"
      ? clamp(arcadeMission?.civilians ?? (2 + (S.arcadeLevel-1)), 0, 14)
      : 0);
  const sites = (S.rescueSites?.length ? S.rescueSites : rescueSitePool()).slice();

  S.civilians = [];

  for(let i=0;i<n;i++){
    const site = sites[i % sites.length] || { x: rand(160, cv.width - 160), y: rand(140, cv.height - 120), kind:"trail", label:"Field Site" };
    const orbit = 16 + ((i % 3) * 14);
    const angle = (Math.PI * 2 * (i % Math.max(1, sites.length))) / Math.max(1, sites.length);
    const jitterX = Math.round(Math.cos(angle) * orbit + rand(-10, 10));
    const jitterY = Math.round(Math.sin(angle) * orbit + rand(-10, 10));
    const civSpawn = safeSpawnPoint(
      clamp(site.x + jitterX, 60, cv.width - 60),
      clamp(site.y + jitterY, 90, cv.height - 70),
      14,
      true,
      true
    );
    S.civilians.push({
      id:i+1,
      x:civSpawn.x,
      y:civSpawn.y,
      hp:100,
      hpMax:100,
      alive:true,
      evac:false,
      following:false,
      escortOwner:"",
      escortUnitId:"",
      fleeUntil:0,
      fleeFromTigerId:0,
      _takeoverPromptLockUntil:0,
      face:0,
      step:Math.random() * Math.PI * 2,
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

function tigerSpawnTooCloseToEscort(x, y){
  const minCivDist = 220;
  const minPlayerDist = 170;
  if(dist(x, y, S.me.x, S.me.y) < minPlayerDist) return true;
  if(S.mode !== "Survival"){
    for(const c of (S.civilians || [])){
      if(!c.alive || c.evac) continue;
      if(dist(x, y, c.x, c.y) < minCivDist) return true;
    }
  }
  return false;
}
function pickTigerSpawnAwayFromEscort(seedX, seedY){
  let spot = safeSpawnPoint(seedX, seedY, 18, true, true);
  if(!tigerSpawnTooCloseToEscort(spot.x, spot.y)) return spot;
  for(let i=0; i<40; i++){
    const biasRight = i % 2 === 0;
    const rx = biasRight ? rand(Math.round(cv.width * 0.55), cv.width - 70) : rand(70, Math.round(cv.width * 0.45));
    const ry = rand(90, cv.height - 70);
    spot = safeSpawnPoint(rx, ry, 18, true, true);
    if(!tigerSpawnTooCloseToEscort(spot.x, spot.y)) return spot;
  }
  return spot;
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
      personality:"Hunter",
      bossPhases:0,
      tranqTagged:false,
      intent:"",
      intentUntil:0,
      step:0,
      holdUntil:0,
      dashUntil:0,
      nextDashAt:0,
      fadeUntil:0,
      nextFadeAt:0,
      roarUntil:0,
      nextRoarAt:0,
      nextReinforceAt:0,
      rageOn:false,
      burstUntil:0,
      nextPounceAt:0,
      enragedUntil:0,
      bossSkillStep:0,
      nextBossSkillAt:0,
      bossIdentityChapter:0,
      bossStealthUntil:0,
      bossPounceCharges:0,
      bossPounceChainUntil:0,
      bossChargeUntil:0,
      wanderAngle:Math.random()*(Math.PI*2),
      heading:0,
      drawDir:1,
      gaitState:"walk",
      gaitBlend:0
    }];

    return;
  }

  const storyMission = (S.mode==="Story") ? storyCampaignMission(S.storyLevel) : null;
  const arcadeMission = (S.mode==="Arcade") ? arcadeCampaignMission(S.arcadeLevel) : null;
  let count=2;

  if(S.mode==="Story"){
    count = clamp(storyMission?.tigers ?? (2 + Math.max(0,(S.storyLevel-1)-(7-3))), 1, 18);
  }

  if(S.mode==="Arcade"){
    count = clamp(arcadeMission?.tigers ?? (3 + Math.max(0,(S.arcadeLevel-1)-(7-2))), 1, 18);
  }

  if(S.mode==="Survival")
    count=Math.min(4+(S.survivalWave-1),10);

  const storyBoss=!!(storyMission && storyMission.boss);
  const storyBossCount = storyBoss ? 1 : 0;
  const arcadeBoss=!!(arcadeMission && arcadeMission.boss);
  const arcadeBossCount = arcadeBoss ? 1 : 0;
  if(storyBoss || arcadeBoss) count = 1;
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
    if(storyBoss && i < storyBossCount) typeKey = storyMission.bossType || "Alpha";
    if(arcadeBoss && i < arcadeBossCount) typeKey = arcadeMission.bossType || "Alpha";

    const def=TIGER_TYPES.find(t=>t.key===typeKey)||TIGER_TYPES[1];

    let baseHp=115;
    if(S.mode==="Arcade") baseHp=125+(S.arcadeLevel-1)*8;
    if(S.mode==="Survival") baseHp=140+(S.survivalWave-1)*12;
    if(S.mode==="Story") baseHp=118+(S.storyLevel-1)*4;

    let hp=Math.round(baseHp*def.hpMul*diff);
    let bossPhases=0;

    if(storyBoss && i < storyBossCount){
      hp = Math.round(hp * (storyMission.finalBoss ? 3.35 : 2.65));
      bossPhases = storyMission.finalBoss ? 3 : 2;
    } else if(arcadeBoss && i < arcadeBossCount){
      hp = Math.round(hp * (arcadeMission.finalBoss ? 3.2 : 2.55));
      bossPhases = arcadeMission.finalBoss ? 3 : 2;
    }

    const pack = packAnchors[i % packAnchors.length];
    const theta = (Math.PI * 2 * (i % 3)) / 3;
    const radius = 24 + ((i % 2) * 20);
    const initialVx = (Math.random()<0.5?-1:1)*def.spd*0.55;
    const initialVy = (Math.random()<0.5?-1:1)*def.spd*0.50;
    const tigerSpawn = pickTigerSpawnAwayFromEscort(
      clamp(Math.round(pack.x + Math.cos(theta) * radius + rand(-12,12)), 140, cv.width - 50),
      clamp(Math.round(pack.y + Math.sin(theta) * radius + rand(-12,12)), 90, cv.height - 70)
    );

    S.tigers.push({
      id:i+1,
      type:def.key,
      x:tigerSpawn.x,
      y:tigerSpawn.y,
      vx:initialVx,
      vy:initialVy,
      hp,
      hpMax:hp,
      alive:true,
      packId:pack.id,
      aggroBoost:0,
      civBias:clamp(def.civBias+(diff-1)*0.18,0,0.98),
      stealth:def.stealth,
      rage:def.rage,
      personality:pickTigerPersonality(def.key),
      bossPhases,
      tranqTagged:false,
      intent:"",
      intentUntil:0,
      step:rand(0,1000),
      holdUntil:0,
      dashUntil:0,
      nextDashAt:0,
      fadeUntil:0,
      nextFadeAt:0,
      roarUntil:0,
      nextRoarAt:0,
      nextReinforceAt:0,
      rageOn:false,
      burstUntil:0,
      nextPounceAt:0,
      enragedUntil:0,
      huntState:TIGER_HUNT_STATES.PATROL,
      huntStateUntil:0,
      pounceWindupUntil:0,
      pounceDirX:0,
      pounceDirY:0,
      bossSkillStep:0,
      nextBossSkillAt:0,
      bossIdentityChapter:0,
      bossStealthUntil:0,
      bossPounceCharges:0,
      bossPounceChainUntil:0,
      bossChargeUntil:0,
      wanderAngle:Math.random()*(Math.PI*2),
      heading:Math.atan2(initialVy, initialVx),
      drawDir:initialVx >= 0 ? 1 : -1,
      gaitState:"walk",
      gaitBlend:0
    });
  }
}

function spawnRogueTiger(options={}){
  if(!Array.isArray(S.tigers)) S.tigers = [];

  const aliveCount = S.tigers.reduce((n, t)=>n + (t?.alive ? 1 : 0), 0);
  const maxAlive = (S.mode === "Survival") ? 14 : 10;
  if(aliveCount >= maxAlive) return null;

  const forcedType = (typeof options.typeKey === "string" && TIGER_TYPES.some((t)=>t.key === options.typeKey))
    ? options.typeKey
    : null;
  const typeKey = forcedType || pickTigerType();
  const def = TIGER_TYPES.find((t)=>t.key===typeKey) || TIGER_TYPES[1];
  const diff = carcassDifficulty();

  let baseHp = 110;
  if(S.mode==="Arcade") baseHp = 122 + (S.arcadeLevel - 1) * 7;
  if(S.mode==="Survival") baseHp = 135 + (S.survivalWave - 1) * 10;
  if(S.mode==="Story") baseHp = 116 + (S.storyLevel - 1) * 4;
  const hp = Math.round(baseHp * def.hpMul * diff);

  let sx = 0;
  let sy = 0;
  if(Number.isFinite(options.nearX) && Number.isFinite(options.nearY)){
    const a = Math.random() * Math.PI * 2;
    const r = rand(86, 170);
    sx = options.nearX + Math.cos(a) * r;
    sy = options.nearY + Math.sin(a) * r;
  } else {
    const spawnEdge = rand(0, 3);
    if(spawnEdge === 0){ // top
      sx = rand(90, cv.width - 90);
      sy = rand(72, 116);
    } else if(spawnEdge === 1){ // right
      sx = rand(cv.width - 116, cv.width - 72);
      sy = rand(90, cv.height - 90);
    } else if(spawnEdge === 2){ // bottom
      sx = rand(90, cv.width - 90);
      sy = rand(cv.height - 116, cv.height - 72);
    } else { // left
      sx = rand(72, 116);
      sy = rand(90, cv.height - 90);
    }
  }

  const rogueSpawn = safeSpawnPoint(Math.round(sx), Math.round(sy), 18, true, true);
  const nextId = (S.tigers.reduce((maxId, t)=>{
    const tid = Number(t?.id);
    return Number.isFinite(tid) ? Math.max(maxId, tid) : maxId;
  }, 0) + 1);

  const tiger = {
    id: nextId,
    type: def.key,
    x: rogueSpawn.x,
    y: rogueSpawn.y,
    vx:(Math.random()<0.5?-1:1)*def.spd*0.58,
    vy:(Math.random()<0.5?-1:1)*def.spd*0.54,
    hp,
    hpMax:hp,
    alive:true,
    packId:Number.isFinite(options.packId) ? options.packId : rand(1,4),
    aggroBoost:(forcedType === "Standard") ? 0.22 : 0.18,
    civBias:clamp(def.civBias + (diff-1)*0.14, 0, 0.98),
    stealth:def.stealth,
    rage:def.rage,
    personality:pickTigerPersonality(def.key),
    bossPhases:0,
    tranqTagged:false,
    intent:"",
    intentUntil:0,
    step:rand(0,1000),
    holdUntil:0,
    dashUntil:0,
    nextDashAt:0,
    fadeUntil:0,
    nextFadeAt:0,
    roarUntil:0,
    nextRoarAt:0,
    nextReinforceAt:0,
    rageOn:false,
    burstUntil:0,
    nextPounceAt:0,
    enragedUntil:0,
    huntState:TIGER_HUNT_STATES.PATROL,
    huntStateUntil:0,
    pounceWindupUntil:0,
    pounceDirX:0,
    pounceDirY:0,
    bossSkillStep:0,
    nextBossSkillAt:0,
    bossIdentityChapter:0,
    bossStealthUntil:0,
    bossPounceCharges:0,
    bossPounceChainUntil:0,
    bossChargeUntil:0,
    wanderAngle:Math.random()*(Math.PI*2),
    heading:0,
    drawDir:1,
    gaitState:"walk",
    gaitBlend:0
  };
  tiger.heading = Math.atan2(tiger.vy, tiger.vx);
  tiger.drawDir = tiger.vx >= 0 ? 1 : -1;

  S.tigers.push(tiger);
  return tiger;
}
// ===================== DEPLOY / NEXT / RESTART =====================
function deploy(opts={}){
  const carryStats = !!opts.carryStats;
  const carryHp = clamp(Number.isFinite(opts.hp) ? opts.hp : S.hp, 0, 100);
  const carryArmor = clamp(Number.isFinite(opts.armor) ? opts.armor : S.armor, 0, S.armorCap || 100);
  resizeCanvasForViewport();
  invalidateMapCache();
  for(const k of Object.keys(__frameTaskGate)) delete __frameTaskGate[k];
  ensureStoryMetaState();
  syncSquadRosterBounds();
  S.gameOver=false;
  S.missionEnded=false;
  S.inBattle=false;
  S.activeTigerId=null;
  S.paused=false; S.pauseReason=null;
  clearTransientCombatVisuals();
  transitionCleanupSweep("deploy-pre");

  S.hp = carryStats ? carryHp : 100;
  S.armor = carryStats
    ? carryArmor
    : clamp(20 + storyStartingArmorBonus(), 0, S.armorCap || 100);
  S.stamina=100;
  S.me={x:160,y:clamp(cv.height - 120, 240, 420),face:0,step:0};
  S.target=null;
  S.lockedTigerId=null;

  S.civGraceUntil = Date.now() + 1000;
  S.dangerCivId = null;
  S.shields = Math.max(0, 1 + storyStartingShieldBonus());
  S.shieldUntil = 0;
  ensureAbilityCooldownState();
  S.abilityCooldowns.scan = 0;
  S.abilityCooldowns.sprint = 0;
  S.abilityCooldowns.shield = 0;

  if(S.mode==="Story"){
    const mins = storyMissionSupplyMinimums();
    if(!S.medkits || typeof S.medkits !== "object") S.medkits = {};
    if(!S.repairKits || typeof S.repairKits !== "object") S.repairKits = {};
    S.medkits["M_SMALL"] = Math.max(S.medkits["M_SMALL"] || 0, mins.medkits);
    S.trapsOwned = Math.max(S.trapsOwned || 0, mins.traps);
    S.repairKits["T_REPAIR"] = Math.max(S.repairKits["T_REPAIR"] || 0, mins.repair);
  }

  if(S.mode!=="Survival") S.evacZone = null;
  S.backupActive=0;
  S._escortSlotById = {};
  clearEscortTakeoverPrompt();

  // phase 1
  S.fogUntil = 0;
  S.eventText = "";
  S.eventCooldown = 240;
  S.pickups = [];
  S.rescueSites = [];
  S.mapInteractables = [];
  S.comboCount = 0;
  S.comboExpireAt = 0;
  S.stats.shots = 0;
  S.stats.captures = 0;
  S.stats.kills = 0;
  S.stats.evac = 0;
  S.stats.cashEarned = 0;
  S.stats.trapsPlaced = 0;
  S.stats.trapsTriggered = 0;
  S.arcadeMissionStartAt = 0;
  S.arcadeMissionLimitSec = 0;
  S.arcadeComboPeak = 0;
  S.arcadeScoreBonus = 0;
  S._arcadeTimerWarn = 0;
  S._arcadeNoKillWarned = false;
  S._storyFinalOutcome = null;
  S._survivalClearAt = 0;
  S._pressure = 0;
  S._pressTick = 0;
  checkProgressionUnlocks({ silent:true });

  spawnRescueSites();
  spawnMapInteractables();
  spawnSupportUnits();
  spawnCivilians();
  spawnTigers();
  if(S.mode!=="Survival" && !window.__TUTORIAL_MODE__){
    S.evacZone = randomEvacZone(S.civilians);
  }
  const spawnAudit = validateMissionSpawnLayout({ repair:true });
  if((spawnAudit?.fixed || 0) > 0){
    setEventText(`Spawn safety adjusted: ${spawnAudit.fixed}`, 1.3);
  }
  transitionCleanupSweep("deploy-post");

  // spawn a couple guaranteed pickups early
  spawnPickup("CASH", 260, clamp(cv.height - 150, 220, cv.height - 80));
  spawnPickup("AMMO", 320, clamp(cv.height - 120, 240, cv.height - 70));

  for(const wid of S.ownedWeapons){ if(S.durability[wid]==null) S.durability[wid]=100; }

  const w=equippedWeapon();
  S.mag.cap = w.mag;
  S.mag.loaded = clamp(S.mag.loaded || w.mag, 0, S.mag.cap);
  if(S.mag.loaded===0) autoReloadIfNeeded(true);

  if(S.mode==="Story"){
    const mission = storyCampaignMission(S.storyLevel);
    if(mission.lowVisibility){
      S.fogUntil = Date.now() + 120000;
    }
    if(mission.bloodAggro){
      setEventText("Story modifier active: tiger aggression is elevated this mission.", 8);
    } else if(((mission.number - 1) % 10) === 0){
      setEventText(`Story chapter ${mission.chapter} deployed. ${storyChapterRewardPreviewText(mission)}`, 8);
    }
    if(mission.boss){
      setEventText(storyBossIntroText(mission), 9);
    }
  }

  if(S.mode==="Arcade"){
    const mission = arcadeCampaignMission(S.arcadeLevel);
    let timeLimitSec = 95 + (mission.chapter * 8);
    if(mission.captureOnly) timeLimitSec += 14;
    timeLimitSec += (mission.captureRequired || 0) * 6;
    timeLimitSec += (mission.trapPlaceRequired || 0) * 5;
    timeLimitSec += (mission.trapTriggerRequired || 0) * 5;
    if(mission.boss) timeLimitSec += mission.bossTwin ? 24 : 18;
    if(mission.finalBoss) timeLimitSec += 30;
    S.arcadeMissionLimitSec = clamp(Math.round(timeLimitSec), 90, 240);
    S.arcadeMissionStartAt = Date.now();
    S.arcadeComboPeak = 0;
    S.arcadeScoreBonus = 0;
    S._arcadeTimerWarn = 0;
    if(mission.lowVisibility){
      S.fogUntil = Date.now() + 120000;
    }
    if(mission.limitedAmmo){
      for(const wid of S.ownedWeapons){
        const ww = getWeapon(wid);
        if(!ww) continue;
        const keep = Math.max(ww.mag, Math.round(ww.mag * 1.4));
        S.ammoReserve[ww.ammo] = Math.min(S.ammoReserve[ww.ammo] || 0, keep);
      }
      if((S.ammoReserve[w.ammo] || 0) <= 0 && S.mag.loaded <= 0){
        S.mag.loaded = Math.max(1, Math.floor(w.mag * 0.5));
      }
    }
    if(mission.bloodAggro){
      setEventText("Blood mechanic active: kills increase tiger aggression.", 8);
    }
  }

  if(S.mode==="Survival"){ S.survivalStart = Date.now(); S.surviveSeconds=0; }

  if(shouldShowMissionBrief()) showMissionBrief(rand(2200, 3000));
  else closeMissionBrief(true);

  save();
}

function startNextMission(){
  document.getElementById("completeOverlay").style.display="none";
  const carryHp = clamp(S.hp, 0, 100);
  const carryArmor = clamp(S.armor, 0, S.armorCap || 100);
  const wasStoryFinal = (S.mode==="Story" && S.storyLevel >= STORY_CAMPAIGN_OBJECTIVES.length);
  const wasArcadeFinal = (S.mode==="Arcade" && S.arcadeLevel >= ARCADE_CAMPAIGN_OBJECTIVES.length);
  if(S.mode==="Story"){
    S.storyLevel = Math.min(S.storyLevel + 1, STORY_CAMPAIGN_OBJECTIVES.length);
  }
  if(S.mode==="Arcade"){
    S.arcadeLevel = Math.min(S.arcadeLevel + 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  }
  if(S.mode==="Survival") S.survivalWave += 1;
  deploy({ carryStats:true, hp:carryHp, armor:carryArmor });
  if(wasStoryFinal) toast("Story campaign complete. Replaying Mission 100.");
  else if(wasArcadeFinal) toast("Arcade campaign complete. Replaying Mission 100.");
  else toast("Next mission started.");
  save();
}

function restartCurrentMission(){
  document.getElementById("battleOverlay").style.display="none";
  document.getElementById("completeOverlay").style.display="none";
  document.getElementById("overOverlay").style.display="none";
  document.getElementById("weaponQuickOverlay").style.display="none";
  lastOverlay=null;

  S.gameOver=false;
  deploy();
  toast("Restarted this mission.");
  save();
}

function restartModeFromMission1(){
  const mode = normalizeModeName(S.mode);
  ["battleOverlay","completeOverlay","overOverlay","weaponQuickOverlay","progressGuardOverlay","modeOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });
  lastOverlay = null;
  S.gameOver = false;

  if(mode === "Story") S.storyLevel = 1;
  else if(mode === "Arcade") S.arcadeLevel = 1;
  else {
    S.survivalWave = 1;
    S.survivalStart = Date.now();
    S.surviveSeconds = 0;
  }
  S.mapIndex = 0;
  resetModeWallet(mode, S);

  deploy();
  toast(`${mode} restarted from Mission 1. ${mode} wallet reset.`);
  save();
}

function closeComplete(){
  if(S.missionEnded && !S.gameOver){
    openMissionProgressGuard("close");
    return;
  }
  document.getElementById("completeOverlay").style.display="none";
}

function performResetGame(){
  localStorage.removeItem(STORAGE_KEY);
  for(const key of STORAGE_FALLBACK_KEYS){
    localStorage.removeItem(key);
  }
  S = cloneState(DEFAULT);
  bindFundsWallet(S);
  syncWindowState();
  ["shopOverlay","invOverlay","weaponQuickOverlay","launchIntroOverlay","storyIntroOverlay","missionBriefOverlay","aboutOverlay","hudOverlay","completeOverlay","overOverlay","modeOverlay","progressGuardOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });
  lastOverlay = null;
  deploy();
  save(true);
  toast("Reset ✅");
}
function resetGame(){
  if(S.missionEnded && !S.gameOver){
    openMissionProgressGuard("reset-all");
    return;
  }
  performResetGame();
}

// ===================== GAME OVER =====================
function gameOverChoice(msg){
  S.gameOver = true;
  S.paused = true;
  transitionCleanupSweep("game-over");
  clearTransientCombatVisuals();
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
  const tappedInteractable = findInteractableAt(x,y);
  const tapped = S.tigers.find(t=>t.alive && dist(x,y,t.x,t.y) < 34);

  // --- Tutorial: capture map click so tutorial can advance ---
  if (window.TigerTutorial?.isRunning) {
    window.TigerTutorial.mapClicked = true;
  }

  // Stop normal gameplay while tutorial controls flow
  if (window.TigerTutorial?.isRunning){
    ensureAudio();
    if(tapped){
      if(tapped.id===S.lockedTigerId && tutorialAllows("engage")){
        if(canEngage()){
          startCombat();
        }else{
          toast("Move closer to the locked tiger, then tap it again.");
        }
        return;
      }
      if(tutorialAllows("lock")){
        S.lockedTigerId=tapped.id;
        window.TigerTutorial.lastLockedTigerId = tapped.id;
        sfx("ui");
        hapticImpact("light");
        save();
        return;
      }
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

  if(tappedInteractable && !S.inBattle){
    const changed = activateMapInteractable(tappedInteractable);
    if(changed){
      sfx("ui");
      hapticImpact("light");
      save();
    }
    return;
  }

  if(tapped && !S.inBattle){
    const d = dist(S.me.x,S.me.y,tapped.x,tapped.y);
    if(d > equippedWeaponRange()){
      S.lockedTigerId = null;
      toast(`${equippedWeapon().name} is out of range. Move closer before you lock that tiger.`);
      save();
      return;
    }
    S.lockedTigerId=tapped.id;
    startCombat();
    if(!S.inBattle){
      sfx("ui");
      hapticImpact("light");
      save();
    }
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

  const overlays = ["launchIntroOverlay","storyIntroOverlay","missionBriefOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay","weaponQuickOverlay","hudOverlay"]
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
  const ids = ["tutorialOverlay","launchIntroOverlay","storyIntroOverlay","missionBriefOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay","weaponQuickOverlay","hudOverlay"];
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
    const wasConnected = GAMEPAD_STATE.connected;
    const hadFocus = GAMEPAD_UI.index >= 0 || GAMEPAD_UI.buttons.length > 0;
    GAMEPAD_STATE.connected = false;
    GAMEPAD_STATE.id = "";
    GAMEPAD_STATE.lx = 0;
    GAMEPAD_STATE.ly = 0;
    GAMEPAD_STATE.activeAt = 0;
    GAMEPAD_STATE.buttons = Object.create(null);
    if(wasConnected || hadFocus){
      clearGamepadFocus();
      LAST_CONTROLLER_UI_KEY = "__controller-disconnected__";
    }
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
    if(S.inBattle) rollDodge();
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
    if(S.inBattle) endBattle("RETREAT");
    else useRepairKit();
  }
  if(gamepadButtonEdge("start", gamepadButtonPressed(pad.buttons?.[9]))){
    togglePause();
  }
  if(gamepadButtonEdge("ls", gamepadButtonPressed(pad.buttons?.[10]))){
    deploy();
  }
  if(gamepadButtonEdge("rs", gamepadButtonPressed(pad.buttons?.[11]))){
    if(S.inBattle) useArmorPlate({ smart:true });
    else activateShield();
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
function lockedTiger(){
  const locked=tigerById(S.lockedTigerId);
  return locked && locked.alive ? locked : null;
}
function currentTargetTiger(){
  const locked=lockedTiger();
  if(locked) return locked;
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
  const t=lockedTiger();
  if(!t) return null;
  return dist(S.me.x,S.me.y,t.x,t.y) <= equippedWeaponRange() ? t : null;
}
function clearOutOfRangeLock(){
  if(S.inBattle || window.TigerTutorial?.isRunning) return;
  const t = lockedTiger();
  if(!t) return;
  if(dist(S.me.x,S.me.y,t.x,t.y) > equippedWeaponRange()){
    S.lockedTigerId = null;
  }
}

// ===================== SCAN =====================
function scan(){
  if(!tutorialAllows("scan")) return toast(tutorialBlockMessage("scan"));
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return toast("Not now.");
  if(abilityOnCooldown("scan")) return toast(`Scan cooling down (${abilityCooldownLabel("scan")}).`);
  const scanCost = Math.max(2, STAMINA_COST_SCAN * storyStaminaDrainMul());
  if(S.stamina < scanCost) return toast("Not enough stamina.");
  S.stamina -= scanCost;
  S.scanPing=140;
  triggerAbilityCooldown("scan");
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
  if(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) return false;

  const dx = ((KEY_STATE.right ? 1 : 0) - (KEY_STATE.left ? 1 : 0)) + TOUCH_STICK.dx + GAMEPAD_STATE.lx;
  const dy = ((KEY_STATE.down ? 1 : 0) - (KEY_STATE.up ? 1 : 0)) + TOUCH_STICK.dy + GAMEPAD_STATE.ly;
  if(!dx && !dy) return false;
  if(S.stamina<=0) return false;

  const len = Math.hypot(dx,dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let speed=PLAYER_WALK_SPEED;
  let sprinting = false;

  if(S._sprintTicks && S._sprintTicks>0){
    speed=PLAYER_SPRINT_SPEED;
    sprinting = true;
    S._sprintTicks--;
  }
  speed *= waterSpeedMul("soldier", S.me.x, S.me.y, 12);

  S.target=null;
  S.me.face = Math.atan2(uy, ux);
  S.me.step = (S.me.step + speed*0.35) % (Math.PI*2);

  const nx = S.me.x + ux*speed;
  const ny = S.me.y + uy*speed;
  tryMoveEntity(S.me, nx, ny, 16, { avoidKeepout:false });

  S.stamina = clamp(S.stamina - ((sprinting ? STAMINA_DRAIN_SPRINT : STAMINA_DRAIN_WALK) * storyStaminaDrainMul()), 0, 100);
  return true;
}

function movePlayer(){
  if(!S.target) return;
  if(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) return;
  const dx=S.target.x-S.me.x, dy=S.target.y-S.me.y;
  const d=Math.hypot(dx,dy);
  if(d<6){ S.target=null; return; }
  if(S.stamina<=0) return;

  let speed=PLAYER_WALK_SPEED;
  let sprinting = false;
  if(S._sprintTicks && S._sprintTicks>0){ speed=PLAYER_SPRINT_SPEED; sprinting = true; S._sprintTicks--; }
  speed *= waterSpeedMul("soldier", S.me.x, S.me.y, 12);

  S.me.face = Math.atan2(dy, dx);
  S.me.step = (S.me.step + speed*0.35) % (Math.PI*2);

  const nx = S.me.x + (dx/d)*speed;
  const ny = S.me.y + (dy/d)*speed;

  const ok = tryMoveEntity(S.me, nx, ny, 16, { avoidKeepout:false });
  if(!ok){ S.target=null; }

  S.stamina = clamp(S.stamina - ((sprinting ? STAMINA_DRAIN_SPRINT : STAMINA_DRAIN_WALK) * storyStaminaDrainMul()), 0, 100);
}

function sprint(){
  if(S.paused || S.missionEnded || S.gameOver) return toast("Not now.");
  if(abilityOnCooldown("sprint")) return toast(`Sprint cooling down (${abilityCooldownLabel("sprint")}).`);
  const sprintCost = Math.max(4, STAMINA_COST_SPRINT * storyStaminaDrainMul());
  if(S.stamina < sprintCost) return toast("Not enough stamina.");
  S.stamina -= sprintCost;
  S._sprintTicks=82;
  triggerAbilityCooldown("sprint");
  sfx("ui"); hapticImpact("light"); save();
  unlockAchv("sprint1","Sprint");
}

function activateShield(){
  if(S.paused || S.missionEnded || S.gameOver) return toast("Not now.");
  if(abilityOnCooldown("shield")) return toast(`Shield cooling down (${abilityCooldownLabel("shield")}).`);
  if((S.shields||0) <= 0) return toast("No shields left. Buy more in Shop.");
  S.shields = Math.max(0, (S.shields||0) - 1);
  S.shieldUntil = Date.now() + SHIELD_DURATION_MS;
  triggerAbilityCooldown("shield");
  S.eventText = "🛡️ Escort Shield active for 5 seconds.";
  S.eventTextUntil = Date.now() + 1500;
  sfx("ui");
  hapticImpact("medium");
  renderHUD();
  save();
}
function rollCooldownLeftMs(now=Date.now()){
  return Math.max(0, (S.rollCooldownUntil || 0) - now);
}
function rollCooldownLabel(now=Date.now()){
  const left = rollCooldownLeftMs(now);
  return left > 0 ? `${Math.max(1, Math.ceil(left / 1000))}s` : "";
}
function rollDodge(){
  if(S.paused || S.missionEnded || S.gameOver) return toast("Not now.");
  if(!S.inBattle) return toast("Roll is available during tiger combat.");
  if(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) return;
  const now = Date.now();
  if(rollCooldownLeftMs(now) > 0) return toast(`Roll cooling down (${rollCooldownLabel(now)}).`);

  const t = activeTiger() || lockedTiger();
  const away = t ? Math.atan2(S.me.y - t.y, S.me.x - t.x) : ((S.me.face || 0) + Math.PI);
  const fromX = S.me.x;
  const fromY = S.me.y;
  const nx = S.me.x + Math.cos(away) * ROLL_TRAVEL_DIST;
  const ny = S.me.y + Math.sin(away) * ROLL_TRAVEL_DIST;
  tryMoveEntity(S.me, nx, ny, 16, { avoidKeepout:false });
  S.target = null;
  S.rollInvulnUntil = now + ROLL_INVULN_MS;
  S.rollBufferedDodges = 1;
  S.rollBufferedUntil = now + ROLL_BUFFER_DODGE_MS;
  S.rollCooldownUntil = now + ROLL_COOLDOWN_MS;
  S.rollAnimStart = now;
  S.rollAnimUntil = now + ROLL_ANIM_MS;
  S.rollAnimFromX = fromX;
  S.rollAnimFromY = fromY;
  S.rollAnimToX = S.me.x;
  S.rollAnimToY = S.me.y;
  S.me.face = away;
  S.me.step = (S.me.step + 2.2) % (Math.PI * 2);
  setBattleMsg("Roll executed. Next tiger hit will be dodged.");
  sfx("ui");
  hapticImpact("medium");
  renderCombatControls();
  save();
}

function damageSupportUnit(unit, dmg){
  if(!unit || !unit.alive || dmg <= 0) return;
  if(unit.role === "rescue"){
    unit.armor = 0;
  }
  if(unit.armor > 0){
    const absorbed = Math.min(unit.armor, dmg * 0.84);
    unit.armor = Math.max(0, unit.armor - absorbed);
    dmg = Math.max(0, dmg - absorbed);
  }
  if(dmg > 0){
    unit.hp = Math.max(0, unit.hp - dmg);
  }
  if(unit.hp > 0) return;

  unit.alive = false;
  if(!unit._downedApplied){
    unit._downedApplied = true;
    if(unit.role === "attacker"){
      S.soldierAttackersDowned = clamp((S.soldierAttackersDowned || 0) + 1, 0, S.soldierAttackersOwned || 0);
      toast("Tiger specialist down. Revive in Shop > Squad.");
    } else if(unit.role === "rescue"){
      S.soldierRescuersDowned = clamp((S.soldierRescuersDowned || 0) + 1, 0, S.soldierRescuersOwned || 0);
      toast("Rescue specialist down. Revive in Shop > Squad.");
    }
  }
  syncSquadRosterBounds();
  hapticNotif("warning");
  save();
}

function supportTigerHitDamage(tiger, role){
  const base = (role === "attacker") ? rand(2, 4) : rand(4, 7);
  const tier = tigerDamageScale(tiger, "support");
  const roleMul = role === "attacker" ? 0.68 : 1.02;
  let dmg = base * tier * roleMul;
  if(S.mode==="Story"){
    if(role === "attacker"){
      const resist = clamp(1 - (storySpecialistRank("SP_ATK_DRILL") * 0.06), 0.72, 1);
      dmg *= resist;
    } else {
      dmg *= storyRescueDamageMul();
    }
  }
  return Math.max(1.2, dmg);
}

function supportAttackDamage(unit, tiger, tigerDist){
  const rank = tigerPowerRank(tiger);
  const base = rand(7, 12) + (tigerDist < 95 ? 4 : 1);
  const antiTigerSkill = 1.14;
  const targetResist = 1 - ((rank - 1) * 0.06);
  const boost = storyAttackerDamageMul();
  return Math.max(4, Math.round(base * antiTigerSkill * clamp(targetResist, 0.68, 1.0) * boost));
}

function supportUnitsTick(){
  if(S.inBattle || S.paused || S.gameOver || S.missionEnded) return;
  if(!S.supportUnits?.length) return;

  const now = Date.now();
  if(now < (S._supportTickAt || 0)) return;
  S._supportTickAt = now + 50; // ~20fps for support AI to reduce mobile stalls

  const liveCivs = (S.mode==="Survival") ? [] : S.civilians.filter(c=>c.alive && !c.evac);
  const activeTigers = S.tigers.filter(t=>t.alive);
  const lockTiger = S.lockedTigerId ? activeTigers.find((t)=>t.id===S.lockedTigerId) : null;
  const dangerCiv = (S.mode==="Survival") ? null : liveCivs.find((c)=>c.id===S.dangerCivId) || null;

  const nearestTigerTo = (ux, uy) => {
    let best = null;
    let bestD = Infinity;
    for(const tiger of activeTigers){
      const d = dist(ux, uy, tiger.x, tiger.y);
      if(d < bestD){ bestD = d; best = tiger; }
    }
    return { tiger: best, d: bestD };
  };
  const nearestCivTo = (ux, uy) => {
    let best = null;
    let bestD = Infinity;
    for(const civ of liveCivs){
      const d = dist(ux, uy, civ.x, civ.y);
      if(d < bestD){ bestD = d; best = civ; }
    }
    return { civ: best, d: bestD };
  };

  let priorityTiger = lockTiger || null;
  if(!priorityTiger && dangerCiv){
    priorityTiger = nearestTigerTo(dangerCiv.x, dangerCiv.y).tiger;
  }
  if(!priorityTiger){
    const nearPlayer = nearestTigerTo(S.me.x, S.me.y);
    if(nearPlayer.tiger && nearPlayer.d < 280) priorityTiger = nearPlayer.tiger;
  }

  for(const unit of (S.supportUnits || [])){
    if(!unit.alive) continue;

    unit.step = (unit.step || 0) + 0.08;
    unit.homeX = S.me.x;
    unit.homeY = S.me.y;

    let targetX = unit.homeX + Math.cos(unit.step * 0.6) * 18;
    let targetY = unit.homeY + Math.sin(unit.step * 0.7) * 14;

    if(unit.role === "rescue" && liveCivs.length){
      const ownTag = "rescue";
      const ownedByThisUnit = liveCivs.filter((c)=>c.following && c.escortOwner === ownTag && c.escortUnitId === unit.id);
      const available = liveCivs.filter((c)=>!c.following && (c.escortOwner !== ownTag || !c.escortUnitId || c.escortUnitId === unit.id));
      let targetCiv = null;

      if(dangerCiv && (dangerCiv.escortOwner !== ownTag || !dangerCiv.escortUnitId || dangerCiv.escortUnitId === unit.id)){
        targetCiv = dangerCiv;
      }
      if(!targetCiv && ownedByThisUnit.length){
        targetCiv = ownedByThisUnit[0];
        let bestD = dist(unit.x, unit.y, targetCiv.x, targetCiv.y);
        for(const civ of ownedByThisUnit){
          const d = dist(unit.x, unit.y, civ.x, civ.y);
          if(d < bestD){
            bestD = d;
            targetCiv = civ;
          }
        }
      }
      if(!targetCiv && available.length){
        targetCiv = available[0];
        let bestD = dist(unit.x, unit.y, targetCiv.x, targetCiv.y);
        for(const civ of available){
          const d = dist(unit.x, unit.y, civ.x, civ.y);
          if(d < bestD){
            bestD = d;
            targetCiv = civ;
          }
        }
      }
      if(!targetCiv){
        const nearest = nearestCivTo(unit.x, unit.y).civ;
        if(nearest && (nearest.escortOwner !== ownTag || !nearest.escortUnitId || nearest.escortUnitId === unit.id)){
          targetCiv = nearest;
        }
      }

      if(targetCiv){
        const civDist = dist(unit.x, unit.y, targetCiv.x, targetCiv.y);
        const engageDist = 56;
        if(!targetCiv.following){
          targetX = targetCiv.x;
          targetY = targetCiv.y;
          if(civDist <= engageDist){
            targetCiv.following = true;
            targetCiv.escortOwner = ownTag;
            targetCiv.escortUnitId = unit.id;
            targetCiv.followGraceUntil = now + 2500;
          }
        } else if(targetCiv.escortOwner === ownTag && targetCiv.escortUnitId === unit.id){
          if(civDist > 76){
            targetX = targetCiv.x;
            targetY = targetCiv.y;
          } else if(S.evacZone){
            targetX = (targetCiv.x * 0.54) + (S.me.x * 0.24) + (S.evacZone.x * 0.22);
            targetY = (targetCiv.y * 0.54) + (S.me.y * 0.24) + (S.evacZone.y * 0.22);

            if(now >= (unit.guideAt || 0)){
              unit.guideAt = now + 120;
              const gdx = S.evacZone.x - targetCiv.x;
              const gdy = S.evacZone.y - targetCiv.y;
              const gd = Math.hypot(gdx, gdy) || 1;
              const guideSpeed = Math.min(1.5, gd) * waterSpeedMul("civilian", targetCiv.x, targetCiv.y, 10);
              tryMoveEntity(targetCiv, targetCiv.x + (gdx / gd) * guideSpeed, targetCiv.y + (gdy / gd) * guideSpeed, 14, { avoidKeepout:false });
              targetCiv.hp = clamp(targetCiv.hp + 0.03, 0, targetCiv.hpMax);
            }
          }

          if(dist(S.me.x, S.me.y, unit.x, unit.y) <= ESCORT_TAKEOVER_DISTANCE){
            setEscortTakeoverPrompt(unit, targetCiv, now);
          }
        }
      }
    } else if(unit.role === "attacker" && activeTigers.length){
      const fallback = nearestTigerTo(unit.x, unit.y);
      const chaseTiger = priorityTiger || (fallback.d < 210 ? fallback.tiger : null);
      if(chaseTiger){
        const nearPlayer = dist(chaseTiger.x, chaseTiger.y, S.me.x, S.me.y) < 300;
        const nearDanger = dangerCiv ? dist(chaseTiger.x, chaseTiger.y, dangerCiv.x, dangerCiv.y) < 210 : false;
        const isLocked = !!lockTiger && chaseTiger.id === lockTiger.id;
        if(isLocked || nearPlayer || nearDanger){
          targetX = chaseTiger.x;
          targetY = chaseTiger.y;
        }
      }
    }

    const homeDist = dist(unit.x, unit.y, unit.homeX, unit.homeY);
    if(homeDist > 265){
      targetX = unit.homeX + Math.cos(unit.step * 0.55) * 14;
      targetY = unit.homeY + Math.sin(unit.step * 0.62) * 12;
    }

    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const waterMul = waterSpeedMul("support", unit.x, unit.y, 12);
    const stepCap = unit.role === "attacker"
      ? (2.05 * (S.mode==="Story" ? (1 + (storySpecialistRank("SP_ATK_DRILL") * 0.04)) : 1))
      : (1.9 * storyRescueSpeedMul());
    const finalStepCap = stepCap * waterMul;
    const step = Math.min(finalStepCap, len);
    unit.face = Math.atan2(dy, dx);
    tryMoveEntity(unit, unit.x + (dx / len) * step, unit.y + (dy / len) * step, 16, { avoidKeepout:false });

    for(const tiger of activeTigers){
      const tigerDist = dist(unit.x, unit.y, tiger.x, tiger.y);
      const nearPlayer = dist(tiger.x, tiger.y, S.me.x, S.me.y) < 300;
      const nearDanger = dangerCiv ? dist(tiger.x, tiger.y, dangerCiv.x, dangerCiv.y) < 210 : false;
      const isPriority = !!priorityTiger && tiger.id === priorityTiger.id;
      const allowEngage = isPriority || nearPlayer || nearDanger;

      if(unit.role === "attacker"){
        if(allowEngage && tigerDist < 190 && now >= (unit.fireAt || 0)){
          unit.fireAt = now + rand(340, 560);
          const shotDmg = supportAttackDamage(unit, tiger, tigerDist);
          tiger.hp = clamp(tiger.hp - shotDmg, 0, tiger.hpMax);
          tiger.aggroBoost = clamp((tiger.aggroBoost||0) + 0.05, 0, 1.4);
          const capChance = clamp(0.36 + storyAttackerCaptureBonus(), 0.36, 0.82);
          if(tiger.hp > 0 && tiger.hp <= captureWindowHp(tiger) && Math.random() < capChance){
            tiger.hp = Math.max(0, tiger.hp - 1);
            tiger.tranqTagged = true;
            if(Math.random() < 0.50){
              markStoryFinalBossOutcome("CAPTURE", tiger);
              tiger.alive = false;
              S.stats.captures = (S.stats.captures || 0) + 1;
              const pay = payout("CAPTURE");
              const cash = Math.round(pay.cash * 0.42);
              const score = Math.round(pay.score * 0.45);
              S.funds += cash;
              S.score += score;
              S.stats.cashEarned += cash;
              setEventText("Tiger specialist secured a capture.", 2.2);
              break;
            }
          }
          if(tiger.hp <= 0){
            finishTigerKill(tiger);
            break;
          }
        }
        if(allowEngage && tigerDist < 74){
          damageSupportUnit(unit, supportTigerHitDamage(tiger, "attacker"));
        }
      } else if(unit.role === "rescue"){
        if(tigerDist < 76){
          damageSupportUnit(unit, supportTigerHitDamage(tiger, "rescue"));
        }
      }
    }
  }

  S.supportUnits = (S.supportUnits || []).filter(unit => unit.alive).slice(0, 16);
  syncSquadRosterBounds();
}

function runCivilianFleeStep(c, now=Date.now()){
  if(!c || !c.alive || c.evac) return false;
  if(now >= (c.fleeUntil || 0)) return false;

  let threat = null;
  if(Number.isFinite(c.fleeFromTigerId)){
    threat = (S.tigers || []).find((t)=>t.alive && t.id === c.fleeFromTigerId) || null;
  }
  if(!threat){
    let nearest = null;
    let nearestD = Infinity;
    for(const t of (S.tigers || [])){
      if(!t.alive) continue;
      const d = dist(c.x, c.y, t.x, t.y);
      if(d < nearestD){
        nearestD = d;
        nearest = t;
      }
    }
    threat = nearest;
  }
  if(!threat) return false;

  const awayX = c.x - threat.x;
  const awayY = c.y - threat.y;
  const awayLen = Math.hypot(awayX, awayY) || 1;
  const jitter = ((c.id % 3) - 1) * 0.28;
  const ang = Math.atan2(awayY, awayX) + jitter;
  const fleeSpeed = (c.following ? 2.55 : 2.25) * waterSpeedMul("civilian", c.x, c.y, 10);
  const nx = c.x + Math.cos(ang) * fleeSpeed;
  const ny = c.y + Math.sin(ang) * fleeSpeed;
  tryMoveEntity(c, nx, ny, 14, { avoidKeepout:false });
  c.face = ang;
  c.step = (c.step || 0) + 0.20;
  return true;
}

// ===================== CIVILIANS FOLLOW-ONLY =====================
function followCiviliansTick(){
  if(S.mode==="Survival") return;
  const playerSpeed = (S._sprintTicks && S._sprintTicks > 0) ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  const escortBoost = storyRescueSpeedMul();
  const engageDist = 58;
  const followMaxDist = (S._sprintTicks && S._sprintTicks > 0) ? 470 : 410;
  const face = Number.isFinite(S.me.face) ? S.me.face : 0;
  const activeFollowers = [];
  const now = Date.now();

  for(const c of S.civilians){
    if(!c.alive || c.evac) continue;

    const ownerIsRescue = c.escortOwner === "rescue" && !!c.escortUnitId;
    if(ownerIsRescue && !rescueUnitById(c.escortUnitId)){
      c.escortOwner = "";
      c.escortUnitId = "";
    }
    if(c.escortOwner === "rescue" && !c.following){
      c.escortOwner = "";
      c.escortUnitId = "";
    }

    if(runCivilianFleeStep(c, now)){
      continue;
    }

    if(c.escortOwner === "rescue"){
      continue;
    }

    const toPlayer = dist(c.x, c.y, S.me.x, S.me.y);
    if(!c.following){
      if(toPlayer <= engageDist){
        c.following = true;
        c.escortOwner = "player";
        c.escortUnitId = "";
        c.followGraceUntil = now + 2800;
      } else {
        continue;
      }
    }

    if(toPlayer <= 220){
      c.followGraceUntil = now + 1700;
    }
    if(toPlayer > followMaxDist){
      if(now > (c.followGraceUntil || 0)){
        c.following = false;
        c.escortOwner = "";
        c.escortUnitId = "";
        continue;
      }
    }

    if(c.escortOwner !== "player"){
      c.escortOwner = "player";
      c.escortUnitId = "";
    }
    activeFollowers.push(c);
  }

  if(!activeFollowers.length){
    S._escortSlotById = {};
    return;
  }

  const cols = Math.min(4, Math.max(2, activeFollowers.length >= 6 ? 4 : 3));
  const sideGap = 34;
  const rowGap = 34;
  const baseBehind = 58;
  const anchors = [];

  for(let i=0;i<activeFollowers.length;i++){
    const row = Math.floor(i / cols);
    const col = i % cols;
    const colsInRow = Math.min(cols, activeFollowers.length - (row * cols));
    const center = (colsInRow - 1) * 0.5;
    const lateral = ((col - center) * sideGap) + ((row % 2) ? sideGap * 0.4 : 0);
    const back = baseBehind + (row * rowGap) + (Math.abs(lateral) * 0.16);
    anchors.push({
      x: S.me.x - Math.cos(face) * back + Math.sin(face) * lateral,
      y: S.me.y - Math.sin(face) * back - Math.cos(face) * lateral
    });
  }

  if(!S._escortSlotById || typeof S._escortSlotById !== "object"){
    S._escortSlotById = {};
  }
  const slotById = S._escortSlotById;
  const assigned = new Map();
  const usedSlots = new Set();
  const activeIds = new Set(activeFollowers.map((c)=>c.id));

  for(const key of Object.keys(slotById)){
    if(!activeIds.has(Number(key))) delete slotById[key];
  }

  for(const c of activeFollowers){
    const prev = slotById[c.id];
    if(Number.isInteger(prev) && prev >= 0 && prev < anchors.length && !usedSlots.has(prev)){
      assigned.set(c.id, prev);
      usedSlots.add(prev);
    }
  }

  for(const c of activeFollowers){
    if(assigned.has(c.id)) continue;
    let bestSlot = -1;
    let bestDist = Infinity;
    for(let i=0;i<anchors.length;i++){
      if(usedSlots.has(i)) continue;
      const a = anchors[i];
      const d = dist(c.x, c.y, a.x, a.y);
      if(d < bestDist){
        bestDist = d;
        bestSlot = i;
      }
    }
    if(bestSlot < 0) continue;
    assigned.set(c.id, bestSlot);
    usedSlots.add(bestSlot);
  }

  for(const c of activeFollowers){
    const slot = assigned.get(c.id);
    if(!Number.isInteger(slot)) continue;
    slotById[c.id] = slot;
    const anchor = anchors[slot];
    if(!anchor) continue;

    const dx = anchor.x - c.x;
    const dy = anchor.y - c.y;
    const dd = Math.hypot(dx,dy) || 1;
    const catchup = clamp((dd - 16) * 0.04, 0, 3.3);
    const sp = Math.min(
      ((Math.max(playerSpeed * 1.02, 2.35) + catchup) * escortBoost * waterSpeedMul("civilian", c.x, c.y, 10)),
      PLAYER_SPRINT_SPEED + 1.8
    );
    const vx = (dx/dd) * sp;
    const vy = (dy/dd) * sp;
    if(Math.hypot(vx, vy) > 0.02){
      c.face = Math.atan2(vy, vx);
      c.step = (c.step || 0) + clamp(Math.hypot(vx, vy) * 0.11, 0.04, 0.30);
    }
    tryMoveEntity(c, c.x + vx, c.y + vy, 14, { avoidKeepout:false });
  }
}

function evacCheck(){
  if(S.mode==="Survival") return;
  const evacRadius = (S.evacZone?.r || 70) + 18;
  for(const c of S.civilians){
    if(!c.alive || c.evac) continue;
    const followBonus = c.following ? 7 : 0;
    if(dist(c.x,c.y,S.evacZone.x,S.evacZone.y) <= (evacRadius + followBonus)){
      c.evac=true;
      S.evacDone += 1;
      S.stats.evac += 1;
      addXP(35);
      awardCombo("rescue");
      toast(`Civilian evacuated (${S.evacDone}/${S.civilians.length})`);
      unlockAchv("evac1","First Evac");
      hapticNotif("success");
    }
  }
}

// ===================== CIVILIANS UNDER ATTACK (pulse damage) =====================
function tickCiviliansAndThreats(){
  if(S.mode==="Survival") return;
  const now = Date.now();

  if(now < (S.civGraceUntil||0)){
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
    if(t.holdUntil && now < t.holdUntil) continue;

    let best=aliveCivsAll[0], bd=1e9;
    for(const c of aliveCivsAll){
      const d=dist(t.x,t.y,c.x,c.y);
      if(d<bd){bd=d; best=c;}
    }

    if(bd < dangerPair.dist) dangerPair={ civId: best.id, dist: bd };

    if(bd < 64){
      underAttack++;
      if(now < (t._nextCivAttackAt || 0)) continue;
      t._nextCivAttackAt = now + rand(3000, 5000);
      best.fleeUntil = now + rand(1300, 2200);
      best.fleeFromTigerId = t.id;

      const hitRange = tigerCivilianHitRange(t);
      const pct = hitRange[0] + (Math.random() * (hitRange[1] - hitRange[0]));
      const base = Math.max(1, Math.round(best.hpMax * pct));
      const diff = carcassDifficulty();
      const multType = tigerDamageScale(t, "civilian");

      // Berserker rage increases civilian threat slightly
      const rageMult = (t.type==="Berserker" && (t.hp/t.hpMax)<0.35) ? 1.25 : 1.0;
      const nearbySupport = (S.supportUnits || []).filter(unit => dist(unit.x, unit.y, best.x, best.y) < 96).length;
      const guardMult = nearbySupport ? clamp(1 - nearbySupport * 0.35, 0.3, 1) : 1;
      const protectMult = S._protectTicks > 0 ? 0.45 : 1;
      const shieldMult = civilianShielded(best) ? 0 : 1;
      const scaled = base * multType * rageMult * (1 + (diff-1)*0.22) * guardMult * protectMult * perkCivMul() * storyCivilianDamageMul();
      const dmg = shieldMult ? Math.max(1, Math.round(scaled)) : 0;
      const prevHp = best.hp;
      best.hp = clamp(best.hp - dmg, 0, best.hpMax);
      if(prevHp > best.hp && now >= (best._nextDmgPopupAt || 0)){
        const nearPlayer = dist(S.me.x, S.me.y, best.x, best.y) < 260;
        const showPopup = S.inBattle || nearPlayer;
        best._nextDmgPopupAt = now + (showPopup ? 520 : 1350);
        if(showPopup){
          emitDamagePopup(best.x, best.y - 40, `-${Math.max(1, Math.round(prevHp - best.hp))}`, "civilian");
        }
      }
    }
  }

  S._underAttack=underAttack;
  S.dangerCivId = (dangerPair.civId && dangerPair.dist < 220) ? dangerPair.civId : null;

  for(const c of S.civilians){
    if(c.alive && c.hp<=0){
      c.alive=false;
      S.lives -= 1;
      breakCombo("civilian lost");

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
function tigerMotionProfile(t, def, now=Date.now()){
  const base = TIGER_LOCOMOTION[t.type] || TIGER_LOCOMOTION.Standard;
  const persona = tigerPersonalityProfile(t, now);
  const hunter = t.aggroBoost || 0;
  const pack = t._packBuff || 0;
  const rage = (t.type==="Berserker" && t.rageOn) ? 1 : 0;
  const fading = ((t.type==="Stalker" && now < (t.fadeUntil||0)) || bossStealthActive(t, now)) ? 1 : 0;
  const scoutDash = (t.type==="Scout" && now < (t.dashUntil||0)) ? 1 : 0;

  const walk = (base.walk + (def.spd * 0.15) + (hunter * 0.30) + (pack * 0.25)) * persona.speedMul;
  const chase = (base.chase + (def.spd * 0.20) + (hunter * 0.85) + (pack * 0.55) + (rage * 0.35) + (fading * 0.22)) * persona.speedMul;
  const sprint = (base.sprint + (def.spd * 0.24) + (hunter * 1.05) + (pack * 0.85) + (rage * 0.55) + (scoutDash * 0.35)) * persona.speedMul;
  const turnBase = t.type==="Scout" ? 0.21 : (t.type==="Stalker" ? 0.18 : (t.type==="Berserker" ? 0.17 : 0.155));
  const steerBase = t.type==="Scout" ? 0.062 : (t.type==="Stalker" ? 0.054 : 0.048);

  return {
    walk,
    chase,
    sprint,
    minChase: (base.minChase + (hunter * 0.55) + (pack * 0.30) + (rage * 0.35) + (fading * 0.20)) * Math.max(0.95, persona.speedMul),
    detect: (base.detect + (hunter * 80) + (pack * 45) + (fading * 60)) * persona.detectMul,
    chaseAccel: base.chaseAccel + (hunter * 0.04) + (pack * 0.02) + (rage * 0.03),
    wanderAccel: base.wanderAccel,
    burstMs: base.burstMs,
    pounceForce: base.pounceForce + (hunter * 0.35) + (pack * 0.18) + (rage * 0.25),
    pounceCd: base.pounceCd,
    pounceChance: clamp((base.pounceChance + (hunter * 0.03) + (pack * 0.02) + (rage * 0.02)) * persona.pounceMul, 0, 0.24),
    turnRateWalk: turnBase * (0.60 + (hunter * 0.08)),
    turnRateChase: turnBase * (1.00 + (hunter * 0.12)),
    steerGain: steerBase + (hunter * 0.01),
    chaseDrag: clamp(0.944 + (persona.speedMul * 0.01), 0.93, 0.97),
    wanderDrag: clamp(0.89 + (persona.speedMul * 0.01), 0.86, 0.93),
    personality: persona
  };
}

function abilityTick(t){
  const now = Date.now();
  if(!t.alive) return;

  // Berserker Rage
  if(t.type==="Berserker"){
    t.rageOn = (t.hp/t.hpMax) < 0.35;
  } else t.rageOn = false;

  // Scout Dash (short burst)
  if(t.type==="Scout"){
    if(!t.nextDashAt) t.nextDashAt = now + rand(650, 1300);
    if((t.nextDashAt - now) < 240) setTigerIntent(t, "Dash", 320);
    if(now >= t.nextDashAt){
      t.dashUntil = now + rand(760, 1120);
      t.nextDashAt = t.dashUntil + rand(900, 1650);
      setTigerIntent(t, "Dash", 560);
      if(Math.random() < 0.20) setEventText("🐅 Scout Dash!", 2);
    }
  }

  // Stalker Fade
  if(t.type==="Stalker"){
    if(!t.nextFadeAt) t.nextFadeAt = now + rand(1600, 2800);
    if((t.nextFadeAt - now) < 240) setTigerIntent(t, "Fade", 320);
    if(now >= t.nextFadeAt){
      t.fadeUntil = now + rand(1400, 2200);
      t.nextFadeAt = t.fadeUntil + rand(1700, 3100);
      setTigerIntent(t, "Fade", 560);
      if(Math.random() < 0.20) setEventText("🐅 Stalker vanished…", 2);
    }
  }

  // Alpha Roar Buff
  if(t.type==="Alpha"){
    if(!t.nextRoarAt) t.nextRoarAt = now + rand(1800, 3200);
    if((t.nextRoarAt - now) < 260) setTigerIntent(t, "Roar", 360);
    if(now >= t.nextRoarAt){
      t.roarUntil = now + rand(1800, 2600);
      t.nextRoarAt = t.roarUntil + rand(1900, 3200);
      setTigerIntent(t, "Roar", 620);
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
  const barricades = activeBarricades(now);
  const aliveTigers = (S.tigers || []).filter((t)=>t && t.alive);
  const liveCivs = (S.mode!=="Survival") ? (S.civilians || []).filter((c)=>c && c.alive && !c.evac) : [];
  const packStats = Object.create(null);
  for(const tiger of aliveTigers){
    if(!tiger.packId) continue;
    if(!packStats[tiger.packId]) packStats[tiger.packId] = { x:0, y:0, n:0 };
    packStats[tiger.packId].x += tiger.x;
    packStats[tiger.packId].y += tiger.y;
    packStats[tiger.packId].n += 1;
  }

  let tickTigers = aliveTigers;
  if(aliveTigers.length > 12){
    const underLoad = frameIsSlow() || performanceMode() === "PERFORMANCE";
    const batchSize = underLoad
      ? Math.max(6, Math.ceil(aliveTigers.length * 0.45))
      : Math.max(8, Math.ceil(aliveTigers.length * 0.62));
    const start = (S._tigerBatchStart || 0) % aliveTigers.length;
    tickTigers = [];
    for(let i=0; i<batchSize; i++){
      tickTigers.push(aliveTigers[(start + i) % aliveTigers.length]);
    }
    S._tigerBatchStart = (start + batchSize) % aliveTigers.length;
  } else {
    S._tigerBatchStart = 0;
  }

  for(const t of tickTigers){

    abilityTick(t);

    if(t.holdUntil && now < t.holdUntil){
      t.vx=0; t.vy=0;
      t.step = (t.step + 0.03) % (Math.PI*2);
      continue;
    }

    if(!Number.isFinite(t.wanderAngle)) t.wanderAngle = Math.random() * (Math.PI * 2);
    if(!Number.isFinite(t.burstUntil)) t.burstUntil = 0;
    if(!Number.isFinite(t.nextPounceAt) || t.nextPounceAt<=0) t.nextPounceAt = now + rand(900, 1500);

    const def=TIGER_TYPES.find(x=>x.key===t.type) || TIGER_TYPES[1];
    const motion = tigerMotionProfile(t, def, now);
    const persona = motion.personality || tigerPersonalityProfile(t, now);
    const civs = liveCivs;
    let targetX=t.x + Math.cos(t.wanderAngle) * 20;
    let targetY=t.y + Math.sin(t.wanderAngle) * 20;
    let targetDist=Infinity;
    const playerDist = dist(t.x,t.y,S.me.x,S.me.y);

    let closestCiv=null, closestCivDist=1e9;
    for(const c of civs){
      const d=dist(t.x,t.y,c.x,c.y);
      if(d<closestCivDist){ closestCivDist=d; closestCiv=c; }
    }

    let nearestCarcassDist = 1e9;
    for(const carcass of (S.carcasses || [])){
      const d = dist(t.x,t.y,carcass.x,carcass.y);
      if(d < nearestCarcassDist) nearestCarcassDist = d;
    }

    const killPressure = clamp((S.stats?.kills || 0) * 0.06, 0, 0.65);
    const bloodScent = nearestCarcassDist < 210
      ? (1 - (nearestCarcassDist / 210)) * (0.35 + killPressure)
      : 0;

    if(bloodScent > 0.08){
      t.aggroBoost = clamp((t.aggroBoost||0) + bloodScent * 0.015, 0, 1.5);
      t.enragedUntil = Math.max(t.enragedUntil || 0, now + rand(650, 1300));
    }

    const closePlayerRange = 145 + (bloodScent * 85);
    const closeCivRange = 130 + (bloodScent * 95);
    const closeToPlayer = playerDist <= (closePlayerRange + (persona.playerBias * 120));
    const closeToCiv = closestCiv && closestCivDist <= closeCivRange;
    const civFocusBias = clamp(t.civBias + bloodScent * 0.25 + (carcassDifficulty()-1)*0.10 + persona.civBiasDelta, 0.05, 0.95);

    if(closeToCiv && (!closeToPlayer || Math.random() < civFocusBias)){
      targetX = closestCiv.x;
      targetY = closestCiv.y;
      targetDist = closestCivDist;
    } else if(closeToPlayer){
      targetX = S.me.x;
      targetY = S.me.y;
      targetDist = playerDist;
    } else if(closestCiv && nearestCarcassDist < 130 && Math.random() < (0.12 + killPressure * 0.22)){
      targetX = closestCiv.x;
      targetY = closestCiv.y;
      targetDist = closestCivDist;
    }

    if(persona.key === "Hunter" && playerDist < motion.detect + 110){
      targetX = S.me.x;
      targetY = S.me.y;
      targetDist = playerDist;
    } else if(persona.key === "Sentinel" && S.rescueSites?.length){
      let nearSite = null;
      let nearSiteDist = 1e9;
      for(const site of S.rescueSites){
        const sd = dist(t.x, t.y, site.x, site.y);
        if(sd < nearSiteDist){ nearSiteDist = sd; nearSite = site; }
      }
      if(nearSite && nearSiteDist > 180 && !closeToPlayer && (!closestCiv || closestCivDist > 120)){
        targetX = nearSite.x;
        targetY = nearSite.y;
        targetDist = nearSiteDist;
      }
    } else if(persona.key === "Ambusher" && Number.isFinite(targetDist) && targetDist < motion.detect + 80 && targetDist > 145){
      t.wanderAngle += (Math.random() - 0.5) * 0.22;
    }

    if(S.lockedTigerId===t.id && playerDist < motion.detect + 90){
      targetX=S.me.x;
      targetY=S.me.y;
      targetDist=playerDist;
    }
    tigerHuntStateTick(t, now, targetX, targetY, targetDist, motion);

    let chase = Number.isFinite(targetDist) && (
      targetDist < motion.detect ||
      (now < (t.enragedUntil||0) && targetDist < motion.detect + 80)
    );
    if(isBossTiger(t) && now < (t.bossChargeUntil || 0) && Number.isFinite(targetDist) && targetDist < motion.detect + 190){
      chase = true;
    }
    if(t.type==="Stalker" && now < (t.fadeUntil||0) && Number.isFinite(targetDist) && targetDist < motion.detect + 90){
      chase = true;
    }
    if(!chase){
      t.aggroBoost = Math.max(0, (t.aggroBoost||0) - 0.004);
    }
    if(t.huntState === TIGER_HUNT_STATES.PATROL){
      chase = Number.isFinite(targetDist) && targetDist < 88;
    } else if(t.huntState === TIGER_HUNT_STATES.STALK){
      chase = Number.isFinite(targetDist) && targetDist < motion.detect + 120;
    } else if(t.huntState === TIGER_HUNT_STATES.POUNCE){
      chase = true;
    } else if(t.huntState === TIGER_HUNT_STATES.RECOVER){
      chase = Number.isFinite(targetDist) && targetDist < motion.detect * 0.62;
    }

    const tx = targetX - t.x;
    const ty = targetY - t.y;
    const td = Math.hypot(tx, ty) || 1;
    const ux = tx / td;
    const uy = ty / td;

    if(!Number.isFinite(t.heading)){
      const seedHeading = Math.atan2(t.vy || Math.sin(t.wanderAngle || 0), t.vx || Math.cos(t.wanderAngle || 0));
      t.heading = Number.isFinite(seedHeading) ? seedHeading : 0;
    }

    const desiredHeading = chase ? Math.atan2(uy, ux) : t.wanderAngle;
    const burstTurnBoost = now < (t.burstUntil||0) ? 0.03 : 0;
    const maxTurn = (chase ? motion.turnRateChase : motion.turnRateWalk) + burstTurnBoost;
    t.heading += clamp(normalizeAngle(desiredHeading - t.heading), -maxTurn, maxTurn);
    t.heading = normalizeAngle(t.heading);

    const hx = Math.cos(t.heading);
    const hy = Math.sin(t.heading);
    const pounceWindup = (t.huntState === TIGER_HUNT_STATES.POUNCE) && now < (t.pounceWindupUntil || 0);
    const pounceActive = (t.huntState === TIGER_HUNT_STATES.POUNCE) && !pounceWindup;

    if(chase && td > 22){
      if(pounceWindup){
        t.vx *= 0.84;
        t.vy *= 0.84;
      } else if(pounceActive){
        const pdx = Math.abs(t.pounceDirX || 0) > 0.001 ? t.pounceDirX : ux;
        const pdy = Math.abs(t.pounceDirY || 0) > 0.001 ? t.pounceDirY : uy;
        const burstForce = motion.pounceForce * 1.24;
        t.vx += pdx * burstForce;
        t.vy += pdy * burstForce;
        t.heading = Math.atan2(pdy, pdx);
        setTigerIntent(t, "Pounce", 220);
      }

      const stalkBoost = t.huntState === TIGER_HUNT_STATES.STALK ? 0.03 : 0;
      const pounceBoost = pounceActive ? 0.10 : 0;
      const recoverPenalty = t.huntState === TIGER_HUNT_STATES.RECOVER ? -0.06 : 0;
      const accel = Math.max(0.05, motion.chaseAccel + (now < (t.burstUntil||0) ? 0.04 : 0) + stalkBoost + pounceBoost + recoverPenalty);
      const align = clamp((hx * ux) + (hy * uy), -1, 1);
      const forwardAccel = accel * (0.76 + Math.max(0, align) * 0.58);
      const steerAssist = motion.steerGain * (1 - Math.max(0, align));
      t.vx += (hx * forwardAccel) + (ux * steerAssist);
      t.vy += (hy * forwardAccel) + (uy * steerAssist);

      const vel = Math.hypot(t.vx, t.vy);
      if(vel < motion.minChase){
        const push = (motion.minChase - vel) * (pounceActive ? 0.26 : 0.18);
        t.vx += ux * push;
        t.vy += uy * push;
      }
    } else {
      const wanderJitter = t.huntState === TIGER_HUNT_STATES.RECOVER ? 0.11 : 0.19;
      t.wanderAngle += (Math.random()-0.5) * wanderJitter;
      const wx = Math.cos(t.wanderAngle);
      const wy = Math.sin(t.wanderAngle);
      const jitter = 0.30 + Math.random()*0.42;
      const align = clamp((hx * wx) + (hy * wy), -1, 1);
      const forwardAccel = motion.wanderAccel * (0.56 + Math.max(0, align) * 0.65) * jitter;
      t.vx += (hx * forwardAccel) + (wx * motion.wanderAccel * 0.18);
      t.vy += (hy * forwardAccel) + (wy * motion.wanderAccel * 0.18);
    }

    if(t.packId){
      const pack = packStats[t.packId];
      if(pack && pack.n > 1){
        const matesCount = pack.n - 1;
        const packX = (pack.x - t.x) / matesCount;
        const packY = (pack.y - t.y) / matesCount;
        const pullBase = dist(t.x, t.y, packX, packY) > 58 ? 0.055 : 0.018;
        const pull = pullBase * (persona.packPullMul || 1);
        t.vx += (packX > t.x ? pull : -pull);
        t.vy += (packY > t.y ? pull : -pull);
      }
    }

    for(const field of barricades){
      const fieldR = field.effectR || 128;
      const bd = dist(t.x, t.y, field.x, field.y);
      if(bd >= fieldR) continue;
      const nx = (t.x - field.x) / (bd || 1);
      const ny = (t.y - field.y) / (bd || 1);
      const repel = clamp((fieldR - bd) / fieldR, 0.08, 1) * 0.78;
      t.vx += nx * repel;
      t.vy += ny * repel;
      if(bd < fieldR * 0.64){
        t.x = clamp(t.x + nx * 1.8, 40, cv.width - 40);
        t.y = clamp(t.y + ny * 1.8, 60, cv.height - 40);
      }
    }

    let speedCap = chase ? motion.chase : motion.walk;
    speedCap += bloodScent * 0.55;
    if(isBossTiger(t) && now < (t.bossChargeUntil || 0)) speedCap = Math.max(speedCap, motion.sprint * 1.26);
    if(isBossTiger(t) && bossStealthActive(t, now)) speedCap = Math.max(speedCap, motion.sprint * 1.12);
    if(t.huntState === TIGER_HUNT_STATES.STALK){
      speedCap = Math.max(speedCap, motion.chase * 1.05);
    }
    if(t.huntState === TIGER_HUNT_STATES.POUNCE){
      if(pounceWindup){
        speedCap = Math.max(motion.walk * 0.92, speedCap * 0.86);
      } else {
        speedCap = Math.max(speedCap, motion.sprint * 1.28);
      }
    }
    if(t.huntState === TIGER_HUNT_STATES.RECOVER){
      speedCap *= 0.84;
    }
    if(now < (t.burstUntil||0)) speedCap = Math.max(speedCap, motion.sprint);
    if(t.type==="Scout" && now < (t.dashUntil||0)) speedCap = Math.max(speedCap, motion.sprint + 0.35);
    if(t.type==="Berserker" && t.rageOn) speedCap = Math.max(speedCap, motion.sprint * 1.06);
    speedCap *= waterSpeedMul("tiger", t.x, t.y, 14);

    const velNow = Math.hypot(t.vx, t.vy);
    if(velNow > speedCap){
      const s = speedCap / (velNow || 1);
      t.vx *= s;
      t.vy *= s;
    }

    const moved = tryMoveEntity(t, t.x + t.vx, t.y + t.vy, 18, { avoidKeepout:false });
    if(!moved){
      t.vx *= -0.72;
      t.vy *= -0.72;
      t.heading += Math.PI * 0.42;
      t.wanderAngle += Math.PI * 0.58;
      t.burstUntil = 0;
    }
    const drag = chase ? motion.chaseDrag : motion.wanderDrag;
    t.vx *= drag;
    t.vy *= drag;

    if(t.x<40||t.x>cv.width-40) t.vx*=-1;
    if(t.y<60||t.y>cv.height-40) t.vy*=-1;
    t.x=clamp(t.x,40,cv.width-40);
    t.y=clamp(t.y,60,cv.height-40);
    const gait = Math.hypot(t.vx, t.vy);
    const sprintingNow = (now < (t.burstUntil||0)) || (t.type==="Scout" && now < (t.dashUntil||0));
    const runMul = sprintingNow ? 1.35 : (gait > motion.chase * 0.84 ? 1.14 : (gait > motion.walk * 0.72 ? 0.94 : 0.70));
    t.gaitState = sprintingNow
      ? "sprint"
      : (gait > motion.chase * 0.84 ? "run" : (gait > motion.walk * 0.72 ? "trot" : "walk"));
    t.gaitBlend = clamp(gait / Math.max(0.01, motion.sprint), 0, 1);
    t.step = (t.step + 0.08 + gait * 0.24 * runMul) % (Math.PI*2);
    if(gait > 0.08){
      t.drawDir = Math.cos(t.heading) >= 0 ? 1 : -1;
    }
  }
}

// ===================== SURVIVAL PRESSURE =====================
function survivalPressureTick(){
  if(S.mode!=="Survival" || S.paused || S.gameOver) return;
  if(S.backupActive>0) return;

  if(!S.survivalStart) S.survivalStart = Date.now();
  S.surviveSeconds = Math.floor((Date.now()-S.survivalStart)/1000);

  const now = Date.now();
  const aliveTigers = (S.tigers || []).filter((t)=>t && t.alive);
  if(aliveTigers.length <= 0){
    if(!Number.isFinite(S._survivalClearAt) || S._survivalClearAt <= 0){
      S._survivalClearAt = now + 1400;
      setEventText(`Wave ${Math.max(1, S.survivalWave || 1)} cleared. Incoming pack...`, 2.4);
    } else if(now >= S._survivalClearAt && !S.inBattle && !S.missionEnded){
      S._survivalClearAt = 0;
      S.survivalWave = Math.max(1, Math.floor(S.survivalWave || 1) + 1);
      spawnTigers();
      const spawnAudit = validateMissionSpawnLayout({ repair:true });
      if((spawnAudit?.fixed || 0) > 0){
        setEventText(`Wave ${S.survivalWave} started • spawn safety adjusted ${spawnAudit.fixed}`, 2.8);
      } else {
        setEventText(`Wave ${S.survivalWave} started • Tigers incoming`, 2.8);
      }
      toast(`Survival Wave ${S.survivalWave} started.`);
      sfx("event");
      hapticImpact("medium");
      save();
    }
    return;
  }
  if(S._survivalClearAt) S._survivalClearAt = 0;

  let hits=0;
  for(const t of aliveTigers){
    if(t.holdUntil && now < t.holdUntil) continue;
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
function pickRespawnPointAwayFromTigers(){
  const radius = 16;
  const minX = 60;
  const maxX = cv.width - 60;
  const minY = 90;
  const maxY = cv.height - 70;
  const aliveTigers = (S.tigers || []).filter((t)=>t.alive);

  const candidates = [];
  const cols = 8;
  const rows = 6;
  for(let yi=0; yi<=rows; yi++){
    const py = minY + ((maxY - minY) * (yi / rows));
    for(let xi=0; xi<=cols; xi++){
      const px = minX + ((maxX - minX) * (xi / cols));
      candidates.push({ x:px, y:py });
    }
  }
  for(let i=0; i<24; i++){
    candidates.push({ x:rand(minX, maxX), y:rand(minY, maxY) });
  }

  let best = null;
  let bestScore = -Infinity;
  for(const pt of candidates){
    const safePt = safeSpawnPoint(pt.x, pt.y, radius, true, true);
    let nearestTiger = Infinity;
    for(const t of aliveTigers){
      nearestTiger = Math.min(nearestTiger, dist(safePt.x, safePt.y, t.x, t.y));
    }
    const tigerScore = Number.isFinite(nearestTiger) ? nearestTiger : 999;
    const edgePenalty = Math.min(
      safePt.x - minX,
      maxX - safePt.x,
      safePt.y - minY,
      maxY - safePt.y
    ) * 0.35;
    const score = tigerScore + edgePenalty;
    if(score > bestScore){
      bestScore = score;
      best = safePt;
    }
  }

  return best || safeSpawnPoint(cv.width * 0.16, cv.height * 0.78, radius, true, true);
}
function startRespawnCountdown(){
  const now = Date.now();
  const pt = pickRespawnPointAwayFromTigers();
  S.respawnPendingUntil = now + 3000;
  S.respawnNoticeAt = now;
  S.respawnTargetX = pt.x;
  S.respawnTargetY = pt.y;
  S._combatTigerAttackAt = 0;
  S.target = null;
  if(S.inBattle) endBattle("RETREAT");
  toast(`Downed. Respawn in 3s. Lives left: ${S.lives}`);
}
function respawnTick(){
  if(!S.respawnPendingUntil) return;
  const now = Date.now();
  const leftMs = S.respawnPendingUntil - now;
  if(leftMs > 0){
    if((S.respawnNoticeAt || 0) + 900 <= now){
      S.respawnNoticeAt = now;
      const secs = Math.max(1, Math.ceil(leftMs / 1000));
      setEventText(`Respawn in ${secs}s • Lives left: ${S.lives}`, 1.1);
    }
    return;
  }

  S.hp = 100;
  S.armor = 20;
  S.stamina = 100;
  S.me.x = clamp(S.respawnTargetX || (cv.width * 0.16), 60, cv.width - 60);
  S.me.y = clamp(S.respawnTargetY || (cv.height * 0.78), 90, cv.height - 70);
  S.target = null;
  S.respawnPendingUntil = 0;
  S.respawnNoticeAt = 0;
  S.respawnTargetX = 0;
  S.respawnTargetY = 0;
  S.rollInvulnUntil = now + 1200;
  toast(`Respawned. Lives left: ${S.lives}`);
}
function applyPlayerDamage(dmg, showToast=false){
  const now = Date.now();
  if(S.respawnPendingUntil && now < S.respawnPendingUntil) return;
  if(now < (S.rollInvulnUntil || 0)) return;
  if(shieldActiveNow()){
    if((S._shieldBlockToastAt || 0) + 700 < now){
      S._shieldBlockToastAt = now;
      if(showToast) toast("🛡️ Shield blocked the hit.");
    }
    return;
  }
  if(S.armor > 0){
    const eff = (typeof perkArmorEff === "function") ? perkArmorEff() : 1; // 1.00, 1.05, 1.10...
    const absorbed = Math.min(S.armor, dmg);
    const armorCost = absorbed / eff;   // perk slows armor drain
    S.armor = clamp(S.armor - armorCost, 0, S.armorCap);
    if(S.armor < 0.01) S.armor = 0;
    dmg -= absorbed;
  }
  if(dmg>0){
    S.hp = clamp(S.hp - dmg, 0, 100);
    sfx("hurt"); hapticImpact("medium");
    if(showToast) toast(`🐅 Hit: -${dmg} HP`);
  }
  if(S.inBattle) renderBattleStatus();
  if(S.hp<=0 && S.armor<=0){
    S.lives -= 1;

    if(S.lives > 0){
      hapticNotif("warning");
      startRespawnCountdown();
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

function visualEffectsHeavyMode(){
  if(performanceMode() === "PERFORMANCE") return true;
  return frameIsSlow();
}

function queueCameraShake(power=1, durationMs=120){
  const base = clamp(Number(power || 0), 0, 2);
  if(base <= 0) return;
  const modeScale = performanceMode() === "PERFORMANCE" ? 0.44 : (frameIsSlow() ? 0.62 : 1);
  const scaled = base * modeScale;
  if(scaled <= 0.02) return;
  CAMERA_SHAKE.power = Math.max(CAMERA_SHAKE.power, scaled);
  CAMERA_SHAKE.until = Math.max(CAMERA_SHAKE.until, Date.now() + clamp(durationMs, 40, 360));
}

function sampleCameraShake(){
  const now = Date.now();
  if(now >= CAMERA_SHAKE.until || CAMERA_SHAKE.power <= 0.02){
    CAMERA_SHAKE.power = 0;
    CAMERA_SHAKE.until = 0;
    return { x:0, y:0, active:false };
  }
  const lifeLeft = clamp((CAMERA_SHAKE.until - now) / 220, 0, 1);
  const amp = CAMERA_SHAKE.power * lifeLeft;
  CAMERA_SHAKE.power = Math.max(0, (CAMERA_SHAKE.power * 0.90) - 0.01);
  const x = (Math.sin(now * 0.115) + Math.cos(now * 0.071)) * amp * 2.2;
  const y = (Math.cos(now * 0.097) - Math.sin(now * 0.061)) * amp * 1.8;
  return { x, y, active:true };
}

function queueImpactPulse(x, y, kind="hit"){
  if(!Number.isFinite(x) || !Number.isFinite(y)) return;
  if(IMPACT_PULSES.length >= 30){
    IMPACT_PULSES.splice(0, IMPACT_PULSES.length - 29);
  }
  let color = "rgba(245,247,255,.88)";
  let maxR = 18;
  let ttl = 18;
  if(kind === "crit"){
    color = "rgba(251,191,36,.95)";
    maxR = 24;
    ttl = 22;
  }else if(kind === "player"){
    color = "rgba(248,113,113,.92)";
    maxR = 22;
    ttl = 20;
  }else if(kind === "tranq"){
    color = "rgba(125,211,252,.92)";
    maxR = 20;
    ttl = 19;
  }else if(kind === "civilian"){
    color = "rgba(251,191,36,.90)";
    maxR = 19;
    ttl = 17;
  }
  if(visualEffectsHeavyMode()){
    maxR *= 0.84;
    ttl = Math.max(12, Math.round(ttl * 0.78));
  }
  IMPACT_PULSES.push({ x, y, color, ttl, maxTtl:ttl, r:2, maxR });
}

function emitCombatFx(x1, y1, x2, y2, color, width=3){
  if(COMBAT_FX.length >= 64){
    COMBAT_FX.splice(0, COMBAT_FX.length - 63);
  }
  const ttl = visualEffectsHeavyMode() ? 6 : 8;
  COMBAT_FX.push({ x1, y1, x2, y2, color, width, ttl, maxTtl:ttl });
  queueImpactPulse(x2, y2, "hit");
}

function tickCombatFx(){
  for(const fx of COMBAT_FX) fx.ttl -= 1;
  for(let i = COMBAT_FX.length - 1; i >= 0; i--){
    const fx = COMBAT_FX[i];
    if(!fx || !Number.isFinite(fx.ttl) || fx.ttl <= 0) COMBAT_FX.splice(i, 1);
  }
}

function tickImpactPulses(){
  const fade = visualEffectsHeavyMode() ? 1.6 : 1.1;
  for(const pulse of IMPACT_PULSES){
    pulse.ttl -= fade;
    const progress = 1 - clamp(pulse.ttl / pulse.maxTtl, 0, 1);
    pulse.r = 2 + (pulse.maxR * progress);
  }
  for(let i=IMPACT_PULSES.length-1; i>=0; i--){
    const pulse = IMPACT_PULSES[i];
    if(!pulse || !Number.isFinite(pulse.ttl) || pulse.ttl <= 0){
      IMPACT_PULSES.splice(i, 1);
    }
  }
}

function drawCombatFx(){
  const heavy = visualEffectsHeavyMode();
  for(const fx of COMBAT_FX){
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    if(!heavy){
      ctx.strokeStyle = "rgba(255,255,255,.24)";
      ctx.lineWidth = fx.width + 3.2;
      ctx.beginPath();
      ctx.moveTo(fx.x1, fx.y1);
      ctx.lineTo(fx.x2, fx.y2);
      ctx.stroke();
    }
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = fx.width;
    ctx.beginPath();
    ctx.moveTo(fx.x1, fx.y1);
    ctx.lineTo(fx.x2, fx.y2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawImpactPulses(){
  for(const pulse of IMPACT_PULSES){
    const life = clamp(pulse.ttl / pulse.maxTtl, 0, 1);
    ctx.save();
    ctx.globalAlpha = life * 0.55;
    ctx.strokeStyle = pulse.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, pulse.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = life * 0.22;
    ctx.fillStyle = pulse.color;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, Math.max(1.8, pulse.r * 0.34), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function emitDamagePopup(x, y, text, kind="hit"){
  if(!Number.isFinite(x) || !Number.isFinite(y) || text == null) return;
  const now = Date.now();
  const cellX = Math.round(x / 22);
  const cellY = Math.round(y / 22);
  const gateKey = `${kind}:${String(text)}:${cellX}:${cellY}`;
  const lastAt = DAMAGE_POPUP_GATE.get(gateKey) || 0;
  if(now - lastAt < DAMAGE_POPUP_RATE_MS) return;
  DAMAGE_POPUP_GATE.set(gateKey, now);
  if(DAMAGE_POPUP_GATE.size > 260){
    for(const [k, at] of DAMAGE_POPUP_GATE){
      if(now - at > 1600) DAMAGE_POPUP_GATE.delete(k);
    }
    if(DAMAGE_POPUP_GATE.size > 320) DAMAGE_POPUP_GATE.clear();
  }

  if(DAMAGE_POPUPS.length >= 34){
    DAMAGE_POPUPS.splice(0, DAMAGE_POPUPS.length - 33);
  }
  DAMAGE_POPUPS.push({
    x, y,
    text: String(text),
    kind,
    ttl: 32,
    maxTtl: 32,
    vy: kind === "player" ? -1.55 : -1.15,
    drift: (Math.random() - 0.5) * 0.35
  });
  queueImpactPulse(x, y, kind);
  if(kind === "crit"){
    queueCameraShake(1.15, 180);
  }else if(kind === "player"){
    queueCameraShake(1.35, 210);
  }else if(kind === "civilian"){
    queueCameraShake(0.86, 150);
  }else if(kind === "tranq"){
    queueCameraShake(0.55, 110);
  }else{
    queueCameraShake(0.32, 90);
  }
}

function tickDamagePopups(){
  const idleFade = (S.paused || S.missionEnded || S.gameOver || !S.inBattle) ? 1.8 : 1;
  for(const p of DAMAGE_POPUPS){
    p.ttl -= idleFade;
    p.y += p.vy;
    p.x += p.drift;
  }
  for(let i=DAMAGE_POPUPS.length-1; i>=0; i--){
    const p = DAMAGE_POPUPS[i];
    if(!p || !Number.isFinite(p.ttl) || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.ttl <= 0){
      DAMAGE_POPUPS.splice(i, 1);
      continue;
    }
    if(p.y < -40 || p.y > (cv.height + 120) || p.x < -120 || p.x > (cv.width + 120)){
      DAMAGE_POPUPS.splice(i, 1);
    }
  }
}

function drawDamagePopups(){
  for(const p of DAMAGE_POPUPS){
    const a = clamp(p.ttl / p.maxTtl, 0, 1);
    let color = "rgba(245,247,255,.95)";
    if(p.kind === "crit") color = "rgba(252,211,77,.98)";
    else if(p.kind === "tranq") color = "rgba(125,211,252,.98)";
    else if(p.kind === "player") color = "rgba(248,113,113,.98)";
    else if(p.kind === "civilian") color = "rgba(251,191,36,.96)";
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(9,12,18,.84)";
    roundedRectFill(p.x - 16, p.y - 10, 32, 14, 5);
    ctx.fillStyle = color;
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x, p.y);
    ctx.textAlign = "start";
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

function paintAbilityCooldownButton(btn, key){
  if(!btn) return;
  const left = abilityCooldownLeftMs(key);
  const total = Math.max(1, abilityCooldownDuration(key));

  if(!btn.dataset.baseBg) btn.dataset.baseBg = btn.style.background || "";
  if(!btn.dataset.baseBorder) btn.dataset.baseBorder = btn.style.borderColor || "";
  if(!btn.dataset.baseText && !btn.classList.contains("touchBtn")){
    btn.dataset.baseText = btn.innerText;
  }

  const iconEl = btn.querySelector?.(".touchBtnIcon");
  if(iconEl && !iconEl.dataset.baseIcon) iconEl.dataset.baseIcon = iconEl.innerText;

  if(left > 0){
    const ratio = clamp(left / total, 0, 1);
    const deg = Math.round(ratio * 360);
    const sec = Math.max(1, Math.ceil(left / 1000));
    btn.style.borderColor = "rgba(251,191,36,.72)";
    btn.style.background = `conic-gradient(rgba(6,10,18,.82) ${deg}deg, rgba(24,30,44,.28) 0deg), rgba(11,16,28,.52)`;
    btn.title = `${key} cooling down (${sec}s)`;
    if(iconEl){
      iconEl.innerText = `${sec}`;
      iconEl.style.fontSize = "18px";
    } else if(btn.dataset.baseText){
      const base = btn.dataset.baseText.replace(/\s*\(\d+s\)\s*$/,"");
      btn.innerText = `${base} (${sec}s)`;
    }
    return;
  }

  btn.style.background = btn.dataset.baseBg;
  btn.style.borderColor = btn.dataset.baseBorder;
  btn.title = "";
  if(iconEl){
    iconEl.innerText = iconEl.dataset.baseIcon || iconEl.innerText;
    iconEl.style.fontSize = "";
  } else if(btn.dataset.baseText){
    btn.innerText = btn.dataset.baseText;
  }
}

function renderAbilityCooldownUi(){
  paintAbilityCooldownButton(document.getElementById("scanBtn"), "scan");
  paintAbilityCooldownButton(document.getElementById("touchScanBtn"), "scan");
  paintAbilityCooldownButton(document.getElementById("touchSprintBtn"), "sprint");
  document.querySelectorAll("[data-shield-btn]").forEach((btn)=>paintAbilityCooldownButton(btn, "shield"));
}

function renderCombatControls(){
  const touchOverlay = document.querySelector(".touchOverlay");
  const touchHint = document.querySelector(".touchHint");
  const mapCluster = document.getElementById("mapTouchCluster");
  const combatCluster = document.getElementById("combatTouchCluster");
  const cacheBtn = document.getElementById("touchCacheBtn");
  const actionButtons = document.querySelector(".actionButtons");
  const combatButtons = document.getElementById("combatButtons");
  const inCombat = !!S.inBattle;
  const hideTouchUi = controllerOwnsUi();
  if(touchOverlay) touchOverlay.style.display = hideTouchUi ? "none" : "block";
  if(touchHint) touchHint.style.display = hideTouchUi ? "none" : "block";
  if(mapCluster) mapCluster.style.display = hideTouchUi ? "none" : (inCombat ? "none" : "grid");
  if(combatCluster) combatCluster.style.display = hideTouchUi ? "none" : (inCombat ? "grid" : "none");
  if(cacheBtn) cacheBtn.style.display = hideTouchUi ? "none" : (inCombat ? "none" : "flex");
  if(actionButtons) actionButtons.style.display = (hideTouchUi || inCombat) ? "none" : "";
  if(combatButtons) combatButtons.style.display = hideTouchUi ? "none" : (inCombat ? "flex" : "none");

  const t = activeTiger();
  const canCap = canAttemptCapture(t);
  const canAtk = anyLethalWeaponHasAmmo();
  const medCount = totalMedkits();
  const armorPlateCountAll = totalArmorPlates();
  const canMed = inCombat && !S.paused && !S.missionEnded && !S.gameOver && !(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) && medCount > 0;
  const canArmorPlate = inCombat && !S.paused && !S.missionEnded && !S.gameOver && !(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) && armorPlateCountAll > 0 && S.armor < S.armorCap;
  const rollLeft = rollCooldownLabel();
  const canRoll = inCombat && !S.paused && !S.missionEnded && !S.gameOver && !(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) && !rollLeft;

  [["touchAttackBtn", !canAtk], ["combatAttackBtn", !canAtk]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchCaptureBtn", !canCap], ["combatCaptureBtn", !canCap]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchCombatMedkitBtn", !canMed], ["combatMedkitBtn", !canMed]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchCombatArmorBtn", !canArmorPlate], ["combatArmorBtn", !canArmorPlate]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchRollBtn", !canRoll], ["combatRollBtn", !canRoll]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  const rollBtn = document.getElementById("combatRollBtn");
  if(rollBtn) rollBtn.innerText = rollLeft ? `Roll (${rollLeft})` : "Roll";

  const prevLabel = combatWeaponLabel(-1);
  const nextLabel = combatWeaponLabel(1);
  const prevDesktop = document.getElementById("combatPrevWeaponBtn");
  const nextDesktop = document.getElementById("combatNextWeaponBtn");
  const medDesktop = document.getElementById("combatMedkitBtn");
  const armorDesktop = document.getElementById("combatArmorBtn");
  if(prevDesktop) prevDesktop.innerText = `◀️ ${prevLabel}`;
  if(nextDesktop) nextDesktop.innerText = `${nextLabel} ▶️`;
  if(medDesktop) medDesktop.innerText = `❤️ Medkit (${medCount})`;
  if(armorDesktop) armorDesktop.innerText = `🛡️ Armor (${armorPlateCountAll})`;
  renderAbilityCooldownUi();
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
  if(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) return toast("Respawning...");
  const t=canEngage();
  if(!lockedTiger()) return toast("Lock a tiger first.");
  if(!t) return toast("Move closer to the locked tiger and tap it again.");
  transitionCleanupSweep("battle-start");
  clearTransientCombatVisuals();
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
    ? `${t.type} • Capture at ${captureWindowPctLabel()} HP or lower`
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
const ATTACK_HOLD = { timer:0, longPress:false };

function clearAttackHold(){
  if(ATTACK_HOLD.timer){
    clearTimeout(ATTACK_HOLD.timer);
    ATTACK_HOLD.timer = 0;
  }
}

function onAttackPressStart(e){
  if(e.pointerType==="mouse" && e.button!==0) return;
  if(window.TigerTutorial?.isRunning) return;
  ATTACK_HOLD.longPress = false;
  clearAttackHold();
  ATTACK_HOLD.timer = setTimeout(()=>{
    ATTACK_HOLD.longPress = true;
    openQuickWeaponPicker();
  }, 420);
}

function onAttackPressEnd(){
  clearAttackHold();
}

function onAttackClick(e){
  if(ATTACK_HOLD.longPress){
    e.preventDefault();
    e.stopImmediatePropagation();
    ATTACK_HOLD.longPress = false;
    return;
  }
  playerAction("ATTACK");
}

function bindAttackButtonGestures(){
  document.querySelectorAll("[data-attack-btn]").forEach((btn)=>{
    if(btn.dataset.attackBound==="1") return;
    btn.dataset.attackBound="1";
    btn.addEventListener("pointerdown", onAttackPressStart);
    btn.addEventListener("pointerup", onAttackPressEnd);
    btn.addEventListener("pointercancel", onAttackPressEnd);
    btn.addEventListener("pointerleave", onAttackPressEnd);
    btn.addEventListener("contextmenu", (e)=>e.preventDefault());
    btn.addEventListener("click", onAttackClick, true);
  });
}

function endBattle(reason){
  const overlay = document.getElementById("battleOverlay");
  if(overlay) overlay.style.display="none";
  S.inBattle=false;
  S.activeTigerId=null;
  S.battleMsg="";
  S._combatTigerAttackAt = 0;
  S.rollBufferedDodges = 0;
  S.rollBufferedUntil = 0;
  transitionCleanupSweep("battle-end");
  clearTransientCombatVisuals();
  if(reason==="RETREAT") S.aggro = clamp(S.aggro+4,0,100);
  renderCombatControls();
  save();
}

function requiredTranqWeaponId(t){
  const boss = isBossTiger(t);
  if(boss) return "W_TRQ_LAUNCHER";
  if(t.type==="Stalker" || t.type==="Berserker") return "W_TRQ_RIFLE";
  return "W_TRQ_PISTOL_MK1";
}
function hasAmmoForWeaponId(id){
  const w = getWeapon(id);
  if(!w) return false;
  if(S.equippedWeaponId === id && S.mag.loaded > 0) return true;
  return (S.ammoReserve[w.ammo]||0) > 0;
}
function canAttemptCapture(t){
  if(!t || !t.alive) return false;
  if(t.hp > captureWindowHp(t)) return false;
  const req = requiredTranqWeaponId(t);
  return S.ownedWeapons.includes(req) && hasAmmoForWeaponId(req);
}
function canCaptureTiger(t){
  if(!t || !t.alive) return false;
  if(t.hp > captureWindowHp(t)) return false;
  const req = requiredTranqWeaponId(t);
  if(S.equippedWeaponId !== req) return false;
  const w=equippedWeapon();
  if(w.type!=="tranq") return false;
  return S.mag.loaded > 0 || (S.ammoReserve[w.ammo]||0) > 0;
}
function tutorialCaptureWindowReady(){
  const t = tigerById(S.activeTigerId);
  if(!t || !t.alive) return false;
  return t.hp <= captureWindowHp(t);
}
function tutorialAnyCaptureWindowReady(){
  for(const t of (S.tigers || [])){
    if(!t || !t.alive) continue;
    if(t.hp <= captureWindowHp(t)) return true;
  }
  return false;
}
function restorePostCaptureWeapon(requiredTranqId){
  const restoreId = (typeof S.lastCombatLethalWeaponId === "string") ? S.lastCombatLethalWeaponId : "";
  if(!restoreId || restoreId === requiredTranqId) return false;
  if(!S.ownedWeapons?.includes(restoreId)) return false;
  equipWeapon(restoreId);
  return true;
}
function updateBattleButtons(){
  const t=tigerById(S.activeTigerId);
  const killBtn = document.getElementById("killBtn");
  const capBtn = document.getElementById("capBtn");
  if(killBtn) killBtn.disabled = !(t && t.hp<=15);
  if(capBtn) capBtn.disabled = !canAttemptCapture(t);
  try{
    if(window.TigerTutorial?.isRunning && window.TigerTutorial.currentKey === "weaken_tiger" && t && t.alive && t.hp <= captureWindowHp(t)){
      window.TigerTutorial.captureWindowReached = true;
    }
  }catch(e){}
  renderCombatControls();
  renderBattleStatus();
}

function payout(outcome){
  if(S.mode==="Story"){
    const mul = storyPayoutMul();
    if(outcome==="CAPTURE") return { cash: Math.round(rand(2500,5000) * mul), score: Math.round(220 * mul), trust:+6, aggro:-8 };
    return { cash: Math.round(rand(500,1500) * mul), score: Math.round(100 * mul), trust:-4, aggro:+14 };
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
  if(hasAliveBossTiger()) return;
  const chance = clamp(0.12 + (S.carcasses.length*0.01), 0.12, 0.30);
  if(Math.random() > chance) return;

  spawnRogueTiger();
  toast("🚨 Reinforcements arrived!");
}

function hasAliveBossTiger(){
  return (S.tigers || []).some((t)=>t.alive && isBossTiger(t));
}
function bossStandardReinforcementCap(){
  return clamp(2 + Math.floor((currentCampaignLevel() - 1) / 16), 2, 7);
}
function bossReinforcementTick(){
  if(S.mode==="Survival" || S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  const boss = (S.tigers || []).find((t)=>t.alive && isBossTiger(t));
  if(!boss) return;
  const profile = bossIdentityProfile(boss);
  if(!profile || !(profile.cycle || []).includes("reinforce")) return;

  const now = Date.now();
  if(boss.holdUntil && now < boss.holdUntil) return;
  const aliveStandards = (S.tigers || []).filter((t)=>t.alive && t.type==="Standard" && !isBossTiger(t)).length;
  const capBoost = ((profile.reinforce && profile.reinforce[1]) || 1) > 1 ? 1 : 0;
  const cap = bossStandardReinforcementCap() + capBoost;
  if(aliveStandards >= cap) return;

  const cd = profile.cd || [9000, 13000];
  const level = currentCampaignLevel();
  const levelScale = clamp(1 - (Math.max(1, level) - 1) * 0.005, 0.68, 1);
  const minCd = Math.round(clamp(cd[0] * levelScale, 3600, 17000));
  const maxCd = Math.round(clamp(cd[1] * levelScale, minCd + 250, 24000));
  if(!Number.isFinite(boss.nextReinforceAt) || boss.nextReinforceAt <= 0){
    boss.nextReinforceAt = now + rand(minCd, maxCd);
    return;
  }
  if(now < boss.nextReinforceAt) return;

  const reinfRange = profile.reinforce || [1, 1];
  const want = clamp(rand(reinfRange[0], reinfRange[1]), 1, 3);
  let spawned = 0;
  for(let i=0; i<want; i++){
    if((S.tigers || []).filter((t)=>t.alive && t.type==="Standard" && !isBossTiger(t)).length >= cap) break;
    const spawnedTiger = spawnRogueTiger({ typeKey:"Standard", nearX:boss.x, nearY:boss.y, packId:boss.packId || 1 });
    if(spawnedTiger){
      spawnedTiger.intent = "Boss Call";
      spawnedTiger.intentUntil = now + 700;
      spawned += 1;
    }
  }
  boss.nextReinforceAt = now + rand(minCd, maxCd);
  if(spawned > 0){
    setTigerIntent(boss, "Pack Call", 900);
    setEventText(`👑 ${profile.name} called ${spawned} Standard reinforcement${spawned>1?"s":""}.`, 3);
    sfx("event");
  }
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
function anyLethalWeaponHasAmmo(){
  for(const id of S.ownedWeapons){
    const w=getWeapon(id);
    if(!w || w.type!=="lethal") continue;
    if(hasAmmoForWeaponId(id)) return true;
  }
  return false;
}
function preferredAttackWeaponId(){
  const current = equippedWeapon();
  if(current?.type==="lethal" && hasAmmoForWeaponId(current.id)) return current.id;
  for(const id of S.ownedWeapons){
    const w=getWeapon(id);
    if(!w || w.type!=="lethal") continue;
    if(hasAmmoForWeaponId(id)) return id;
  }
  return null;
}
function equippedWeaponHasAmmoNow(){
  const w=equippedWeapon();
  if(S.mag.loaded>0) return true;
  const res = S.ammoReserve[w.ammo]||0;
  return res>0;
}
function updateAttackButton(){
  const btn = document.getElementById("atkBtn");
  if(btn) btn.disabled = !anyLethalWeaponHasAmmo();
  renderCombatControls();
}

function finishTigerKill(t){
  if(!t || !t.alive) return;
  if(window.TigerTutorial?.isRunning){
    window.TigerTutorial.combatOutcome = "KILL";
  }
  markStoryFinalBossOutcome("KILL", t);
  t.alive=false;
  breakCombo("tiger killed");
  S.carcasses.push({ x:t.x, y:t.y, bornAt:Date.now() });
  if(S.carcasses.length > MAX_PERSIST_CARCASSES){
    S.carcasses = S.carcasses.slice(-MAX_PERSIST_CARCASSES);
  }
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
  if(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) return;
  if(window.TigerTutorial?.isRunning){
    if(action==="ATTACK" && !tutorialAllows("attack")) return toast(tutorialBlockMessage("attack"));
    if(action==="CAPTURE" && !tutorialAllows("capture")) return toast(tutorialBlockMessage("capture"));
    if(action==="KILL" && !tutorialAllows("kill")) return toast(tutorialBlockMessage("kill"));
    if(action==="PROTECT") return toast("Use Attack, Capture, or Kill for tutorial battle steps.");
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
    const preCaptureWeaponId = S.equippedWeaponId;
    if(t.hp > captureWindowHp(t)) return toast(`Capture is available when the tiger is at ${captureWindowPctLabel()} HP or lower.`);
    const req = requiredTranqWeaponId(t);
    const reqWeapon = getWeapon(req);
    if(!reqWeapon) return toast("Required tranq weapon data missing.");
    if(!S.ownedWeapons.includes(req)) return toast(`${reqWeapon.name} is required to capture this ${t.type}.`);
    const magReady = (S.equippedWeaponId === req && S.mag.loaded > 0);
    const reserveReady = (S.ammoReserve[reqWeapon.ammo]||0) > 0;
    if(!magReady && !reserveReady){
      return toast(`${reqWeapon.name} is out of ammo for this ${t.type}.`);
    }
    if(S.equippedWeaponId !== req){
      equipWeapon(req);
      S.mag.loaded = 0;
    }
    if(S.mag.loaded <= 0 && !autoReloadIfNeeded(true)){
      return toast(`${reqWeapon.name} is out of ammo for this ${t.type}.`);
    }
    if(!canCaptureTiger(t)) return toast(`${reqWeapon.name} is needed to capture this ${t.type}.`);
    if(window.TigerTutorial?.isRunning){
      window.TigerTutorial.combatOutcome = "CAPTURE";
    }
    markStoryFinalBossOutcome("CAPTURE", t);
    t.alive=false;
    const pay=payout("CAPTURE");
    S.funds+=pay.cash; S.score+=pay.score;
    S.stats.captures += 1;
    addXP(90);
    awardCombo("capture");
    S.stats.cashEarned += pay.cash;
    unlockAchv("cap1","First Capture");
    S.trust=clamp(S.trust+pay.trust,0,100);
    S.aggro=clamp(S.aggro+pay.aggro,0,100);
    sfx("win"); hapticNotif("success");
    endBattle();
    if(!restorePostCaptureWeapon(req) && preCaptureWeaponId && preCaptureWeaponId !== req && S.ownedWeapons.includes(preCaptureWeaponId)){
      equipWeapon(preCaptureWeaponId);
    }
    checkMissionComplete();
    return;
  }

  if(action==="KILL"){
    if(t.hp>captureWindowHp(t)) return toast("Tiger HP is still too high to finish.");
    finishTigerKill(t);
    return;
  }

  if(action==="ATTACK"){
    updateAttackButton();
    const attackWeaponId = preferredAttackWeaponId();
    if(!attackWeaponId){
      toast("No lethal ammo. Buy ammo in Shop or use Capture when the tiger is weak enough.");
      sfx("jam");
      return;
    }
    S.lastCombatLethalWeaponId = attackWeaponId;
    if(S.equippedWeaponId !== attackWeaponId){
      equipWeapon(attackWeaponId);
      S.mag.loaded = 0;
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

    // Tiger defense scales with threat rank (Boss > Alpha > Berserker > Stalker > Scout > Standard)
    dmg = Math.max(6, Math.round(dmg / carcassDifficulty()));
    dmg = Math.max(4, Math.round(dmg / tigerDefenseScale(t)));
    if(t.type==="Berserker" && (t.hp/t.hpMax)<0.35) dmg = Math.max(4, Math.round(dmg*0.88));
    if(isBossTiger(t)) dmg = Math.max(3, Math.round(dmg*0.88));
    if(isBossTiger(t) && bossStealthActive(t)){
      dmg = Math.max(2, Math.round(dmg * 0.62));
      if(Math.random() < 0.45){
        setBattleMsg(`${bossIdentityProfile(t)?.name || "Boss"} is in stealth phase. Shots are less effective.`);
      }
    }

    applyWearOnShot(w);

    if(victim){
      const civDmg = Math.max(4, Math.round(dmg * 0.7));
      victim.hp = clamp(victim.hp - civDmg, 0, victim.hpMax);
      emitCombatFx(S.me.x, S.me.y - 6, victim.x, victim.y, "rgba(251,191,36,.95)", 3);
      emitDamagePopup(victim.x, victim.y - 42, `-${civDmg}`, "civilian");
      hapticImpact("medium");
      setBattleMsg(`Friendly fire! Civilian #${victim.id} took ${civDmg}.`);
    } else {
      if(w.type==="tranq"){
        t.hp = clamp(t.hp - dmg, 1, t.hpMax);
      }else{
        t.hp = clamp(t.hp - dmg, 0, t.hpMax);
      }
      emitCombatFx(S.me.x, S.me.y - 6, t.x, t.y, w.type==="tranq" ? "rgba(96,165,250,.96)" : "rgba(245,247,255,.96)", crit ? 4 : 3);
      emitDamagePopup(t.x, t.y - 44, `-${dmg}`, crit ? "crit" : (w.type==="tranq" ? "tranq" : "hit"));
      hapticImpact(crit ? "heavy" : "light");
      setBattleMsg(`${crit?'CRIT! ':''}Hit for ${dmg}. ${w.type==='tranq'?'(tranq applied)':''}`);
    }

    if(t.hp<=0){
      finishTigerKill(t);
      return;
    }
    try{
      if(window.TigerTutorial?.isRunning && window.TigerTutorial.currentKey === "weaken_tiger" && t.hp <= captureWindowHp(t)){
        window.TigerTutorial.captureWindowReached = true;
      }
    }catch(e){}
    if(w.type==="tranq" && t.hp <= captureWindowHp(t)){
      setBattleMsg(`Tiger is subdued. Tap Capture to use ${getWeapon(requiredTranqWeaponId(t))?.name || "the required tranq gun"}.`);
    }

    updateBattleButtons();
    updateAttackButton();
    S._combatTigerAttackAt = Date.now() + rand(420, 780);
    save();
    return;
  }
}

function tigerTurn(t, softened=false, opts={}){
  if(!t.alive) return;
  const now = Date.now();
  if(t.holdUntil && now < t.holdUntil){
    if(S.inBattle) setBattleMsg(`Tiger #${t.id} is trapped and cannot attack.`);
    return 0;
  }
  const maxRange = Number.isFinite(opts.maxRange) ? opts.maxRange : 120;
  const distToPlayer = dist(t.x, t.y, S.me.x, S.me.y);
  if(distToPlayer > maxRange) return 0;

  if(shieldActiveNow()){
    emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(96,165,250,.95)", 2);
    emitDamagePopup(S.me.x, S.me.y - 50, "BLOCK", "tranq");
    if(S.inBattle) setBattleMsg("🛡️ Shield blocked the tiger attack.");
    updateBattleButtons();
    updateAttackButton();
    renderBattleStatus();
    return 0;
  }
  const rollInvulnActive = now < (S.rollInvulnUntil || 0);
  const rollBufferedActive = (S.rollBufferedDodges || 0) > 0 && now < (S.rollBufferedUntil || 0);
  if(rollInvulnActive || rollBufferedActive){
    if(rollBufferedActive){
      S.rollBufferedDodges = 0;
      S.rollBufferedUntil = 0;
    }
    emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(250,204,21,.95)", 2);
    emitDamagePopup(S.me.x, S.me.y - 50, "DODGE", "crit");
    if(S.inBattle) setBattleMsg("🤸 Roll dodge successful.");
    updateBattleButtons();
    updateAttackButton();
    renderBattleStatus();
    return 0;
  }

  const diff=carcassDifficulty();
  const persona = tigerPersonalityProfile(t);

  let dmg = rand(10,18) + Math.floor((S.aggro/100)*10);
  dmg = Math.round(dmg * diff * tigerDamageScale(t, "player"));

  // abilities
  if(t.type==="Scout" && Date.now() < (t.dashUntil||0)) dmg = Math.round(dmg*1.03);
  if(t.type==="Alpha" && Date.now() < (t.roarUntil||0)) dmg = Math.round(dmg*1.15);
  if(t.type==="Berserker"){
    dmg=Math.floor(dmg*1.16);
    if((t.hp/t.hpMax)<0.35) dmg=Math.floor(dmg*1.10);
  }
  if(t.type==="Stalker") dmg=Math.floor(dmg*1.06);
  if(isBossTiger(t)) dmg = Math.round(dmg * 1.18);
  if(persona.key==="Hunter") dmg = Math.round(dmg * 1.08);
  if(persona.key==="Sentinel") dmg = Math.round(dmg * 0.94);
  if(persona.key==="Fury" && (t.hp/t.hpMax) < 0.55) dmg = Math.round(dmg * 1.10);
  if(persona.key==="Ambusher" && Date.now() < (t.burstUntil||0)) dmg = Math.round(dmg * 1.08);
  if(Number.isFinite(opts.dmgMul)) dmg = Math.round(dmg * opts.dmgMul);
  if(softened) dmg=Math.floor(dmg*0.85);
  const maxDamage = (opts.kind === "charge") ? 92 : 75;
  dmg=clamp(dmg,6,maxDamage);
  if(opts.kind === "charge") setTigerIntent(t, "Charge", 520);
  else if(opts.kind === "pounce") setTigerIntent(t, "Pounce", 480);
  else setTigerIntent(t, "Strike", 440);

  emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(251,113,133,.95)", 3);
  emitDamagePopup(S.me.x, S.me.y - 50, `-${dmg}`, "player");
  applyPlayerDamage(dmg,false);
  if(S.inBattle){
    const atkLabel = opts.kind === "charge" ? "charges" : (opts.kind === "pounce" ? "pounces" : "hits back");
    setBattleMsg(`Tiger #${t.id} ${atkLabel} for ${dmg}.`);
  }
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
  const rangeLimit = equippedWeaponRange();
  if(d > rangeLimit){
    endBattle("RETREAT");
    S.lockedTigerId = null;
    toast(`${equippedWeapon().name} lost range. Tap that tiger again when you get back in range.`);
    save(true);
    return;
  }
  const now = Date.now();
  if(t.holdUntil && now < t.holdUntil){
    setBattleMsg(`Tiger #${t.id} is trapped. Attack while it is held.`);
    return;
  }

  if(isBossTiger(t)){
    if(!Number.isFinite(t.nextBossSkillAt) || t.nextBossSkillAt <= now){
      triggerBossIdentitySkill(t, bossIdentityProfile(t), now);
    }
    if(now < (t.bossPounceChainUntil || 0) && (t.bossPounceCharges || 0) > 0 && d < 196 && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + rand(620, 900);
      tigerTurn(t, S._protectTicks > 0, { kind:"pounce", dmgMul:1.24, maxRange:196 });
      t.bossPounceCharges = Math.max(0, (t.bossPounceCharges || 0) - 1);
      if(t.bossPounceCharges <= 0) t.bossPounceChainUntil = 0;
      return;
    }
    if(now < (t.bossChargeUntil || 0) && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + rand(920, 1320);
      tigerTurn(t, S._protectTicks > 0, { kind:"charge", dmgMul:1.46, maxRange:248 });
      return;
    }
    if(bossStealthActive(t, now)){
      if((t._bossStealthPromptAt || 0) + 900 < now){
        t._bossStealthPromptAt = now;
        setBattleMsg(`${bossIdentityProfile(t)?.name || "Boss"} is in stealth phase. Watch for the lunge.`);
      }
    }
  }

  const band = weaponRangeBand(rangeLimit);
  if(band === "short"){
    if(d < 96 && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + rand(900, 1300);
      tigerTurn(t, S._protectTicks > 0, { kind:"strike", maxRange:108 });
    }
    return;
  }

  if(band === "mid"){
    if(d < 170 && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + rand(1150, 1700);
      tigerTurn(t, S._protectTicks > 0, { kind:"pounce", dmgMul:1.12, maxRange:170 });
    }
    return;
  }

  // Long-range weapons enrage tigers and trigger charge attacks. Roll can dodge this.
  t.enragedUntil = Math.max(t.enragedUntil || 0, now + 1800);
  if(d > 120){
    const dx = S.me.x - t.x;
    const dy = S.me.y - t.y;
    const len = Math.hypot(dx, dy) || 1;
    const chargeStep = Math.min(7.4, len);
    tryMoveEntity(t, t.x + (dx / len) * chargeStep, t.y + (dy / len) * chargeStep, 18, { avoidKeepout:false });
  }
  if(!Number.isFinite(t._chargeWindupUntil) || t._chargeWindupUntil <= now){
    t._chargeWindupUntil = now + rand(800, 1200);
    t._chargePromptAt = 0;
  }
  if(now < t._chargeWindupUntil){
    if((t._chargePromptAt || 0) + 900 < now){
      t._chargePromptAt = now;
      setBattleMsg("Tiger is charging. Roll to dodge.");
    }
    return;
  }
  if(now >= (S._combatTigerAttackAt || 0)){
    S._combatTigerAttackAt = now + rand(1700, 2400);
    t._chargeWindupUntil = now + rand(900, 1300);
    tigerTurn(t, S._protectTicks > 0, { kind:"charge", dmgMul:1.35, maxRange:220 });
  }
}

// ===================== MISSION COMPLETE =====================
function checkMissionComplete(){
  if(window.__TUTORIAL_MODE__) return;
  if(S.mode==="Survival") return;
  if(S.gameOver) return;

  const storyMission = (S.mode==="Story") ? storyCampaignMission(S.storyLevel) : null;
  const arcadeMission = (S.mode==="Arcade") ? arcadeCampaignMission(S.arcadeLevel) : null;
  const activeMission = storyMission || arcadeMission;
  const tAlive = S.tigers.some(t=>t.alive);
  const civAlive = S.civilians.filter(c=>c.alive).length;
  const civEvac = S.civilians.filter(c=>c.alive && c.evac).length;
  const evacReady = (civAlive===0 || civEvac===civAlive);
  const captureReady = !activeMission || (S.stats.captures || 0) >= (activeMission.captureRequired || 0);
  const trapPlaceReady = !arcadeMission || (S.stats.trapsPlaced || 0) >= (arcadeMission.trapPlaceRequired || 0);
  const trapTriggerReady = !arcadeMission || (S.stats.trapsTriggered || 0) >= (arcadeMission.trapTriggerRequired || 0);
  const noKillReady = !arcadeMission || !arcadeMission.captureOnly || (S.stats.kills || 0) === 0;

  if(arcadeMission?.captureOnly && (S.stats.kills||0) > 0 && !S._arcadeNoKillWarned){
    S._arcadeNoKillWarned = true;
    toast("Mission rule failed: this mission requires captures only (no tiger kills).");
  }

  if(!tAlive && evacReady && !(captureReady && trapPlaceReady && trapTriggerReady && noKillReady)){
    if(!S.missionEnded && !S.gameOver){
      const missing = [];
      if(!captureReady) missing.push("capture objective not met");
      if(!trapPlaceReady) missing.push("trap placement objective not met");
      if(!trapTriggerReady) missing.push("trap stop objective not met");
      if(!noKillReady) missing.push("no-kill objective failed");
      return gameOverChoice(`Mission failed: ${missing.join(" • ")}.`);
    }
    return;
  }

  if(!tAlive && evacReady && captureReady && trapPlaceReady && trapTriggerReady && noKillReady){
    if(!S.missionEnded){
      S.missionEnded=true;
      setPaused(true,"complete");
      transitionCleanupSweep("mission-complete");
      clearTransientCombatVisuals();
      if(S._underAttack===0) unlockAchv("clear_clean","Clean Clear");
      let heading = "Mission complete!\n";
      if(storyMission){
        heading = `Story Mission ${storyMission.number}/100 — ${storyMission.chapterName}\n${storyMission.objective}\n`;
      } else if(arcadeMission){
        heading = `Arcade Mission ${arcadeMission.number}/100 — ${arcadeMission.chapterName}\n${arcadeMission.objective}\n`;
      }
      let arcadeSummary = "";
      if(arcadeMission){
        const left = arcadeMissionTimeLeftSec();
        const limit = Math.max(0, Math.floor(Number(S.arcadeMissionLimitSec || 0)));
        const peak = Math.max(Math.floor(Number(S.arcadeComboPeak || 0)), Math.floor(Number(S.comboCount || 0)));
        const medal = arcadeMissionMedal();
        const bonus = Math.max(0, Math.floor(Number(S.arcadeScoreBonus || 0)));
        arcadeSummary =
          `\nArcade Medal: ${medal}` +
          `\nArcade Time Left: ${left}s / ${limit}s` +
          `\nArcade Combo Peak: x${peak}` +
          `\nArcade Score Bonus: +${bonus.toLocaleString()}\n`;
      }

      let chapterCutscene = "";
      if(storyMission && STORY_CHAPTER_CUTSCENES[storyMission.number]){
        chapterCutscene = `\nCutscene: ${STORY_CHAPTER_CUTSCENES[storyMission.number]}\n`;
      }

      let chapterRewardNote = "";
      if(storyMission && (storyMission.number % 10 === 0)){
        const reward = unlockStoryChapterReward(storyMission.chapter);
        if(reward){
          chapterRewardNote = `\nChapter Reward Unlocked: ${reward.label}${reward.grants ? ` (${reward.grants})` : ""}\n${reward.desc}\n`;
        }
      }
      let storyProgressNote = "";
      if(storyMission){
        const rewardDef = storyChapterRewardDef(storyMission.chapter || 1);
        if(rewardDef){
          const until = Math.max(0, ((storyMission.chapter || 1) * 10) - (storyMission.number || 1));
          storyProgressNote = until === 0
            ? `\nProgression Track: Chapter ${storyMission.chapter} reward checkpoint reached (${rewardDef.label}).\n`
            : `\nProgression Track: ${rewardDef.label} unlocks in ${until} mission${until===1?"":"s"}.\n`;
        }
      }

      let finalEnding = "";
      if(storyMission?.number === 100){
        const choseCapture = S._storyFinalOutcome === "CAPTURE";
        finalEnding = choseCapture
          ? "\nFinal Choice: You captured the Ancient Tiger.\nEnding: Preservation ending unlocked.\nRewards Unlocked: Legendary Commander Rank • Golden Soldier Skin • Endless Jungle Mode\n"
          : "\nFinal Choice: You killed the Ancient Tiger.\nEnding: Dominance ending unlocked.\nRewards Unlocked: Legendary Commander Rank • Golden Soldier Skin • Endless Jungle Mode\n";
      }
      let upkeepNote = "";
      const upkeep = applySquadUpkeepAfterMission();
      if(upkeep){
        const unpaid = upkeep.unpaidAttackers + upkeep.unpaidRescuers;
        if(unpaid > 0){
          upkeepNote =
            `\nSquad upkeep paid: $${upkeep.paid.toLocaleString()} / $${upkeep.totalDue.toLocaleString()}` +
            `\nUnpaid specialists moved to downed: A ${upkeep.unpaidAttackers} • R ${upkeep.unpaidRescuers}\n`;
          toast(`Upkeep shortfall: ${unpaid} specialist${unpaid>1?"s":""} moved to downed.`);
        } else {
          upkeepNote = `\nSquad upkeep paid: $${upkeep.paid.toLocaleString()} (all active specialists maintained)\n`;
        }
      }

      document.getElementById("completeText").innerText =
        `${heading}${arcadeSummary}${chapterCutscene}${chapterRewardNote}${storyProgressNote}${finalEnding}${upkeepNote}\n• Tigers Killed: ${S.stats.kills}\n• Tigers Captured: ${S.stats.captures}\n• Civilians Evacuated: ${S.stats.evac}\n• Traps Set: ${S.stats.trapsPlaced||0}\n• Trap Stops: ${S.stats.trapsTriggered||0}\n• Cash Earned: $${S.stats.cashEarned.toLocaleString()}\n• Shots Fired: ${S.stats.shots}\n\nYou can Shop/Inventory and then start next mission.`;
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
  try{
    syncSquadRosterBounds();
    applyModeTheme(S.mode);
    // clear event text if expired
    if(S.eventTextUntil && Date.now()>S.eventTextUntil) S.eventText="";
    if(S.shieldUntil && Date.now() >= S.shieldUntil) S.shieldUntil = 0;

  document.getElementById("soundLbl").innerText = S.soundOn ? "On" : "Off";
  const soundLblMobile = document.getElementById("soundLblMobile");
  if(soundLblMobile) soundLblMobile.innerText = S.soundOn ? "On" : "Off";
  const pauseLblMobile = document.getElementById("pauseLblMobile");
  if(pauseLblMobile) pauseLblMobile.innerText = S.paused ? "Resume" : "Pause";
  updatePerformanceLabels();
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
  const shieldSecs = Math.max(0, Math.ceil(((S.shieldUntil||0) - Date.now()) / 1000));
  const shieldLabel = shieldActiveNow() ? `${S.shields||0} • ACTIVE (${shieldSecs}s)` : `${S.shields||0}`;
  document.getElementById("shieldTxt").innerText = shieldLabel;

  document.getElementById("backupTxt").innerText = `Armor Plates: ${totalArmorPlates()} • Shop Bundle $${REINFORCEMENT_BUNDLE_PRICE.toLocaleString()} • Squad A:${squadAliveCount("attacker")}/${squadOwnedCount("attacker")} (down ${squadDownedCount("attacker")}) • R:${squadAliveCount("rescue")}/${squadOwnedCount("rescue")} (down ${squadDownedCount("rescue")})`;
  const shieldDisabled = S.paused || S.missionEnded || S.gameOver || (S.shields||0)<=0 || abilityOnCooldown("shield");
  document.querySelectorAll("[data-shield-btn]").forEach((btn)=>{ btn.disabled = shieldDisabled; });
  const cacheBtn = document.getElementById("touchCacheBtn");
  if(cacheBtn){
    cacheBtn.disabled = S.paused || S.inBattle || S.missionEnded || S.gameOver || !nearestCacheInteractable(132);
  }

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
  const capturePctTxt = document.getElementById("capturePctTxt");
  if(capturePctTxt) capturePctTxt.innerText = captureWindowPctLabel();

  const civAlive = (S.mode==="Survival") ? "—" : `${S.civilians.filter(c=>c.alive).length}/${S.civilians.length||0}`;
  document.getElementById("civTxt").innerText = civAlive;
  document.getElementById("evacTxt").innerText = (S.mode==="Survival") ? "—" : `${S.evacDone}/${S.civilians.length||0}`;

  document.getElementById("tleftTxt").innerText = S.tigers.filter(t=>t.alive).length;
  document.getElementById("threatTxt").innerText = (S.mode==="Survival") ? "Pressure" : (S._underAttack ? `${S._underAttack} attacks` : "Low");

  const grace = (S.mode!=="Survival" && Date.now() < (S.civGraceUntil||0)) ? " • Civ Grace" : "";
  const storyMission = (S.mode==="Story") ? storyCampaignMission(S.storyLevel) : null;
  const arcadeMission = (S.mode==="Arcade") ? arcadeCampaignMission(S.arcadeLevel) : null;
  const storyObjective = storyMission ? `${storyMission.objective}${storyObjectiveProgressText(storyMission)}` : "";
  const arcadeObjective = arcadeMission ? `${arcadeMission.objective}${arcadeObjectiveProgressText(arcadeMission)}` : "";
  const arcadeLeft = (S.mode==="Arcade") ? arcadeMissionTimeLeftSec() : 0;
  const arcadeMult = (S.mode==="Arcade") ? arcadeComboMultiplier() : 1;
  const arcadeMedal = (S.mode==="Arcade") ? arcadeMissionMedal() : "";
  const arcadeHint = (S.mode==="Arcade")
    ? ` • Timer ${arcadeLeft}s • Mult x${arcadeMult.toFixed(1)} • Medal ${arcadeMedal}`
    : "";
  document.getElementById("objTxt").innerText =
    (S.mode==="Survival")
      ? `Objective: Survive • Loot spawns • Traps hold tigers • Carcasses block movement`
      : (S.mode==="Story")
        ? `Objective: ${storyObjective}${grace}`
      : (S.mode==="Arcade")
        ? `Objective: ${arcadeObjective}${arcadeHint}${grace}`
        : `Objective: Evacuate living civilians + clear ALL tigers${grace}`;
  const storyOpsEl = document.getElementById("storyOpsTxt");
  if(storyOpsEl){
    if(S.mode==="Story" && storyMission){
      const civNeed = S.civilians.filter(c=>c.alive && !c.evac).length;
      const captureNeed = Math.max(0, storyMission.captureRequired || 0);
      const captureDone = Math.min(S.stats.captures || 0, captureNeed);
      const rewardTrack = storyChapterRewardPreviewText(storyMission).replace(/^Reward Track:\s*/i, "");
      const focus = captureNeed > 0
        ? `Story Ops: escort/protect civilians (${civNeed} pending) • Captures ${captureDone}/${captureNeed}`
        : `Story Ops: escort/protect civilians (${civNeed} pending)`;
      storyOpsEl.innerText = `${focus} • ${rewardTrack}`;
    } else {
      storyOpsEl.innerText = "";
    }
  }

  // danger ping
  if(S.dangerCivId && S.mode!=="Survival"){
    const civ = S.civilians.find(c=>c.id===S.dangerCivId);
    const d = civ ? Math.round(dist(S.me.x,S.me.y,civ.x,civ.y)) : null;
    document.getElementById("dangerTxt").innerText = civ ? `⚠️ Civilian #${civ.id} under attack near ${civ.rescueLabel || "the rescue site"}! Distance: ${d}` : "";
  } else {
    document.getElementById("dangerTxt").innerText = "";
  }

  const assistParts = [];
  if((S.comboCount || 0) > 0){
    const left = Math.max(0, Math.ceil(((S.comboExpireAt || 0) - Date.now()) / 1000));
    assistParts.push(`Combo x${S.comboCount}${left ? ` (${left}s)` : ""}`);
  }
  if(S.mode==="Arcade"){
    const limit = Math.max(0, Math.floor(Number(S.arcadeMissionLimitSec || 0)));
    const peak = Math.max(Math.floor(Number(S.arcadeComboPeak || 0)), Math.floor(Number(S.comboCount || 0)));
    assistParts.push(`Arcade clock: ${arcadeLeft}s/${limit}s • Medal: ${arcadeMedal}`);
    assistParts.push(`Arcade combo multiplier: x${arcadeMult.toFixed(1)} • Peak combo x${peak}`);
  } else if(S.mode==="Story" && storyMission){
    const reward = storyChapterRewardDef(storyMission.chapter || 1);
    const until = Math.max(0, ((storyMission.chapter || 1) * 10) - (storyMission.number || 1));
    if(reward && !storyChapterRewardUnlocked(storyMission.chapter || 1)){
      assistParts.push(until===0
        ? `Chapter reward ready after clear: ${reward.label}`
        : `Chapter reward in ${until} mission${until===1?"":"s"}: ${reward.label}`);
    }
    if(storyMission.boss){
      const introShort = storyBossIntroText(storyMission).replace(/^Boss Intro:\s*/i, "");
      assistParts.unshift(`Boss mission: ${introShort}`);
    }
  }
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

  if((S.mapInteractables || []).length && !S.inBattle){
    let nearestInteract = null;
    let nearestInteractDist = 1e9;
    for(const it of (S.mapInteractables || [])){
      if((it.uses || 0) <= 0) continue;
      const d = dist(S.me.x, S.me.y, it.x, it.y);
      if(d < nearestInteractDist){
        nearestInteract = it;
        nearestInteractDist = d;
      }
    }
    if(nearestInteract && nearestInteractDist < 170){
      assistParts.push(`${nearestInteract.label}: ${Math.round(nearestInteractDist)}m (tap to use)`);
    }
  }

  if(!anyWeaponHasAmmo()) assistParts.unshift("Out of ammo. Visit Shop before the next fight.");
  else if(S.mag.loaded<=0 && equippedWeaponHasAmmoNow()) assistParts.unshift("Magazine empty. Attack reloads or switch weapons.");
  if(S.stamina < 20) assistParts.push("Low stamina");
  const cooldownBits = [];
  if(abilityOnCooldown("scan")) cooldownBits.push(`Scan ${abilityCooldownLabel("scan")}`);
  if(abilityOnCooldown("sprint")) cooldownBits.push(`Sprint ${abilityCooldownLabel("sprint")}`);
  if(abilityOnCooldown("shield")) cooldownBits.push(`Shield ${abilityCooldownLabel("shield")}`);
  if(cooldownBits.length) assistParts.push(cooldownBits.join(" • "));

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
        : (S.mode==="Story" && storyMission)
          ? `Story ${storyMission.number}/100 • Ch ${storyMission.chapter}`
        : (S.mode==="Arcade" && arcadeMission)
          ? `Arcade ${arcadeMission.number}/100 • ${arcadeLeft}s • ${arcadeMedal}`
          : `Evac ${S.evacDone}/${S.civilians.length||0} • Tigers ${S.tigers.filter(tiger=>tiger.alive).length}`;
  }
  if(mobileThreatChip){
    const threatText =
      S.mode==="Arcade"
        ? (arcadeLeft <= 20 ? `Clock ${arcadeLeft}s` : `Combo x${Math.max(1, S.comboCount || 1)}`)
        : (S.mode==="Survival"
          ? "Pressure High"
          : (S._underAttack ? `Threat ${S._underAttack} attack` : "Threat Low"));
    mobileThreatChip.innerText = threatText;
  }
  if(mobilePromptTxt){
    let mobilePrompt =
      S.mode==="Survival"
        ? "Stay moving, manage ammo, and survive the pressure."
        : (S.mode==="Arcade"
            ? "Beat the clock, chain combos, and finish with a higher medal."
            : "Protect civilians, reach the evac zone, and clear every tiger.");
    let nearInteract = null;
    let nearInteractDist = 1e9;
    for(const it of (S.mapInteractables || [])){
      if((it.uses || 0) <= 0) continue;
      const d = dist(S.me.x, S.me.y, it.x, it.y);
      if(d < nearInteractDist){
        nearInteract = it;
        nearInteractDist = d;
      }
    }
    if(S.dangerCivId){
      const civ = S.civilians.find(c=>c.id===S.dangerCivId);
      mobilePrompt = civ ? `Civilian #${civ.id} is under attack. Move there now.` : mobilePrompt;
    } else if(!anyWeaponHasAmmo()){
      mobilePrompt = "Out of ammo. Open Shop before the next fight.";
    } else if(t && canEngage()){
      mobilePrompt = `Tiger #${t.id} is in range. Tap it to fight.`;
    } else if(t){
      mobilePrompt = `Tiger #${t.id} locked. Move closer and tap it to fight.`;
    } else if(nearInteract && nearInteractDist < 165){
      mobilePrompt = `${nearInteract.label} nearby. Tap it to activate.`;
    } else if(window.TigerTutorial?.isRunning){
      mobilePrompt = assistParts[0] || "Follow the tutorial prompt and stay on the map.";
    } else if(S.missionEnded){
      mobilePrompt = "Mission complete. Shop, inventory, or start the next mission.";
    }
    mobilePromptTxt.innerText = mobilePrompt;
  }

    const takeoverBtn = document.getElementById("escortTakeoverBtn");
    if(takeoverBtn){
      const nowTakeover = Date.now();
      let showTakeover = false;
      if(!S.inBattle && !S.paused && !S.missionEnded && !S.gameOver && S.takeoverPromptUntil > nowTakeover){
        const unit = rescueUnitById(S.takeoverUnitId);
        const civ = civilianById(S.takeoverCivId);
        if(unit && civ && civ.escortOwner === "rescue" && civ.escortUnitId === unit.id && dist(S.me.x, S.me.y, unit.x, unit.y) <= ESCORT_TAKEOVER_DISTANCE){
          showTakeover = true;
          const left = Math.max(1, Math.ceil((S.takeoverPromptUntil - nowTakeover) / 1000));
          takeoverBtn.innerText = `Take Over Escort (${left})`;
        } else {
          clearEscortTakeoverPrompt();
        }
      } else if(S.takeoverPromptUntil && nowTakeover > S.takeoverPromptUntil){
        clearEscortTakeoverPrompt();
      }
      takeoverBtn.style.display = showTakeover ? "inline-flex" : "none";
      takeoverBtn.disabled = !showTakeover;
      if(!showTakeover) takeoverBtn.innerText = "Take Over Escort";
    }

    document.getElementById("statusLine").innerText =
      S.inBattle
        ? (S.battleMsg || `On-map combat active. Use Attack, Capture, weapon swap, and Retreat while Tiger #${S.activeTigerId} stays locked.`)
        : (S.mode==="Story"
            ? ((storyMission && storyMission.boss)
                ? "Story Ops: chapter boss mission. Keep civilians safe, stay mobile, and control aggression before committing to the boss."
                : "Story Ops: escort/protect civilians first, then secure captures and clear routes to evacuation.")
            : (window.matchMedia?.("(pointer:fine)")?.matches
                ? "Desktop: click the tiger you want. If it is close enough, combat starts right away. WASD or arrows move. Q locks nearest. Space scans. E engages the locked tiger. Tap map devices to trigger alarms, barriers, and caches."
                : "Agent and Mission stay above the map. Use the joystick to move, then tap the tiger you want. If it is in range, the fight starts and your combat buttons appear. Tap map devices for alarms, barriers, and caches."));
    renderAbilityCooldownUi();
  }catch(err){
    const now = Date.now();
    if((window.__tsHudErrAt || 0) + 3000 < now){
      window.__tsHudErrAt = now;
      console.error("HUD render recovered from error:", err);
    }
  }
}

function maybeRenderHUD(force=false){
  const now = performance.now ? performance.now() : Date.now();
  const minInterval = frameIsSlow(now) ? 340 : 240;
  if(force || (now - __lastHudRender) >= minInterval){
    __lastHudRender = now;
    renderHUD();
  }
}

// ===================== CALM MAPS + FOG (no flashing) =====================
function drawMapScene(){
  const frameNow = Date.now();
  const w=cv.width, h=cv.height;
  const mapInfo = currentMap();
  const key = mapInfo.key;
  const missionIndex = missionIndexForMode(S.mode);
  const chapter = chapterIndexForMode(S.mode);
  const chapterStyle = chapterVisualForMode(S.mode, chapter);
  const ez = S.evacZone || DEFAULT.evacZone;
  const cacheSig = [
    key, w, h, S.mode, missionIndex, chapter, S.mapIndex || 0, window.__TUTORIAL_MODE__ ? 1 : 0,
    Math.round(ez.x || 0), Math.round(ez.y || 0), Math.round(ez.r || 0),
    (S.trapsPlaced || []).length, (S.scanPing || 0) > 0 ? 1 : 0, frameNow < (S.fogUntil || 0) ? 1 : 0
  ].join("|");
  const cacheAgeCap = frameIsSlow() ? Math.max(MAP_CACHE_INTERVAL_MS, 120) : MAP_CACHE_INTERVAL_MS;
  const canUseCache =
    !!__mapFrameCacheCanvas &&
    __mapFrameCacheSig === cacheSig &&
    (frameNow - __mapFrameCacheAt) < cacheAgeCap;
  if(canUseCache){
    ctx.drawImage(__mapFrameCacheCanvas, 0, 0, w, h);
    return;
  }

  const themeKey = mapFamilyKey(key);
  ensureMapObstacleCache();
  const waterZones = __mapWaterZones || [];
  const waterPalette = (()=>{
    if(themeKey === "ST_DOWNTOWN"){
      return { fill:"rgba(34,98,136,.46)", edge:"rgba(165,220,255,.55)", glint:"rgba(186,230,253,.24)" };
    }
    if(themeKey === "ST_INDUSTRIAL"){
      return { fill:"rgba(50,96,118,.44)", edge:"rgba(180,228,255,.50)", glint:"rgba(186,230,253,.20)" };
    }
    if(themeKey === "ST_SUBURBS"){
      return { fill:"rgba(40,108,142,.50)", edge:"rgba(186,230,253,.60)", glint:"rgba(191,241,255,.24)" };
    }
    return { fill:"rgba(25,90,105,.62)", edge:"rgba(147,217,247,.58)", glint:"rgba(186,230,253,.26)" };
  })();

  function fillSolid(color){ ctx.fillStyle=color; ctx.fillRect(0,0,w,h); }
  function seedNoise(ix, iy, seed=0){
    let n = (ix * 374761393) ^ (iy * 668265263) ^ (seed * 982451653);
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }
  function terrainTexture(seed, step=30, alpha=0.08, colorA="rgba(255,255,255,.05)", colorB="rgba(0,0,0,.08)"){
    for(let y=0; y<h; y+=step){
      for(let x=0; x<w; x+=step){
        const n = seedNoise((x/step)|0, (y/step)|0, seed);
        if(n < 0.30) continue;
        ctx.fillStyle = n > 0.62 ? colorA : colorB;
        ctx.globalAlpha = alpha * (0.4 + n * 0.8);
        ctx.fillRect(x + (n * 5), y + ((1 - n) * 4), 2 + (n * 3), 2 + (n * 3));
      }
    }
    ctx.globalAlpha = 1;
  }
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
  function roadShoulder(points, width){
    ctx.strokeStyle="rgba(12,16,24,.28)";
    ctx.lineWidth=width + 10;
    ctx.lineCap="round";
    ctx.lineJoin="round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.strokeStyle="rgba(235,210,160,.12)";
    ctx.lineWidth=Math.max(6, width * 0.14);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1]);
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
  function treeDot(x,y,size=8){
    ctx.globalAlpha=0.25;
    ctx.fillStyle="#05070b";
    ctx.beginPath(); ctx.ellipse(x, y + (size * 0.85), size * 1.05, size * 0.45, 0, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.fillStyle="rgba(15,78,42,.95)";
    ctx.beginPath(); ctx.arc(x,y,size,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="rgba(33,142,74,.78)";
    ctx.beginPath(); ctx.arc(x - (size * 0.22), y - (size * 0.18), size * 0.58,0,Math.PI*2); ctx.fill();
  }
  function buildingBlock(x,y,ww,hh){
    ctx.globalAlpha=0.2;
    ctx.fillStyle="#080b12";
    rounded(x-ww/2+4,y-hh/2+6,ww,hh,10,"rgba(0,0,0,.35)");
    ctx.globalAlpha=1;
    rounded(x-ww/2,y-hh/2,ww,hh,10,"rgba(55,70,95,.85)","rgba(18,24,38,.9)");
  }
  function houseBlock(x,y){
    ctx.globalAlpha=0.2;
    rounded(x-16,y-9,36,24,8,"rgba(0,0,0,.3)");
    ctx.globalAlpha=1;
    rounded(x-18,y-12,36,24,8,"rgba(190,180,160,.8)","rgba(60,55,50,.9)");
  }
  function crateBlock(x,y){
    ctx.globalAlpha=0.2;
    rounded(x-10,y-8,24,20,6,"rgba(0,0,0,.3)");
    ctx.globalAlpha=1;
    rounded(x-12,y-10,24,20,6,"rgba(140,90,45,.85)","rgba(70,40,20,.85)");
  }
  function drawWaterBodies(alphaMul=1){
    if(!waterZones.length) return;
    const mul = clamp(alphaMul, 0.35, 1.2);
    ctx.save();
    for(const zone of waterZones){
      const rad = waterZoneRadii(zone);
      const rx = rad.rx;
      const ry = rad.ry;
      const rot = zone.rot || 0;

      ctx.globalAlpha = 0.92 * mul;
      ctx.fillStyle = waterPalette.fill;
      ctx.beginPath();
      ctx.ellipse(zone.x, zone.y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.56 * mul;
      ctx.strokeStyle = waterPalette.edge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(zone.x, zone.y, Math.max(8, rx - 2), Math.max(6, ry - 2), rot, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.42 * mul;
      ctx.strokeStyle = waterPalette.glint;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(zone.x - (rx * 0.12), zone.y - (ry * 0.08), Math.max(6, rx * 0.54), Math.max(4, ry * 0.30), rot, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawProp(p){
    const px = p._abs ? p.x : (p.x * (w / 960));
    const py = p._abs ? p.y : (p.y * (h / 540));
    const s = p.s || 1;
    if(inMapScenarioKeepout(px, py, 24 * s)) return;
    if(p.kind==="bush"){
      treeDot(px, py, 10 * s);
      treeDot(px + (8*s), py + (3*s), 7 * s);
      return;
    }
    if(p.kind==="rock"){
      ctx.fillStyle="rgba(70,78,88,.82)";
      ctx.beginPath(); ctx.ellipse(px, py, 16*s, 10*s, -0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle="rgba(110,122,138,.42)";
      ctx.beginPath(); ctx.ellipse(px - (3*s), py - (2*s), 7*s, 4*s, -0.1, 0, Math.PI*2); ctx.fill();
      return;
    }
    if(p.kind==="log"){
      ctx.strokeStyle="rgba(82,56,35,.88)";
      ctx.lineWidth=8*s;
      ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(px-(16*s), py+(4*s)); ctx.lineTo(px+(16*s), py-(4*s)); ctx.stroke();
      return;
    }
    if(p.kind==="sign"){
      ctx.fillStyle="rgba(60,44,28,.95)";
      ctx.fillRect(px-(2*s), py-(4*s), 4*s, 18*s);
      rounded(px-(16*s), py-(16*s), 32*s, 12*s, 4*s, "rgba(220,190,120,.84)", "rgba(60,44,28,.9)");
      return;
    }
    if(p.kind==="lamp"){
      ctx.fillStyle="rgba(92,100,120,.95)";
      ctx.fillRect(px-(1.8*s), py-(18*s), 3.6*s, 22*s);
      ctx.fillStyle="rgba(250,228,168,.9)";
      ctx.beginPath(); ctx.arc(px, py-(20*s), 4.5*s, 0, Math.PI*2); ctx.fill();
      return;
    }
    if(p.kind==="car"){
      rounded(px-(20*s), py-(9*s), 40*s, 18*s, 6*s, "rgba(92,120,156,.88)", "rgba(22,30,45,.95)");
      ctx.fillStyle="rgba(195,222,245,.46)";
      rounded(px-(11*s), py-(8*s), 22*s, 7*s, 3*s, "rgba(195,222,245,.46)");
      return;
    }
    if(p.kind==="truck"){
      rounded(px-(26*s), py-(11*s), 42*s, 22*s, 6*s, "rgba(110,124,140,.9)", "rgba(22,30,45,.95)");
      rounded(px+(12*s), py-(8*s), 14*s, 16*s, 4*s, "rgba(150,165,180,.85)", "rgba(24,34,46,.9)");
      ctx.fillStyle="rgba(210,228,245,.42)";
      rounded(px+(14*s), py-(6*s), 10*s, 7*s, 2*s, "rgba(210,228,245,.42)");
      return;
    }
    if(p.kind==="bus"){
      rounded(px-(30*s), py-(11*s), 60*s, 22*s, 7*s, "rgba(84,124,184,.88)", "rgba(22,30,45,.95)");
      ctx.fillStyle="rgba(210,232,255,.45)";
      for(let i=0;i<5;i++){
        rounded(px-(23*s)+(i*10*s), py-(8*s), 8*s, 6*s, 2*s, "rgba(210,232,255,.45)");
      }
      return;
    }
    if(p.kind==="house"){
      houseBlock(px, py);
      ctx.fillStyle="rgba(90,50,35,.9)";
      ctx.beginPath();
      ctx.moveTo(px - (18*s), py - (10*s));
      ctx.lineTo(px, py - (24*s));
      ctx.lineTo(px + (18*s), py - (10*s));
      ctx.closePath();
      ctx.fill();
      return;
    }
    if(p.kind==="building"){
      buildingBlock(px, py, 54*s, 42*s);
      ctx.fillStyle="rgba(205,220,240,.40)";
      for(let row=0; row<3; row++){
        for(let col=0; col<2; col++){
          ctx.fillRect(px - (13*s) + (col * 12*s), py - (12*s) + (row * 10*s), 6*s, 6*s);
        }
      }
      return;
    }
    if(p.kind==="park"){
      rounded(px-(26*s), py-(16*s), 52*s, 32*s, 10*s, "rgba(28,118,66,.82)", "rgba(8,54,30,.88)");
      treeDot(px-(10*s), py-(2*s), 8*s);
      treeDot(px+(10*s), py+(2*s), 7*s);
      ctx.fillStyle="rgba(88,62,36,.9)";
      ctx.fillRect(px-(8*s), py+(8*s), 16*s, 3*s);
      return;
    }
    if(p.kind==="barrier"){
      rounded(px-(18*s), py-(6*s), 36*s, 12*s, 4*s, "rgba(220,180,70,.86)", "rgba(64,52,22,.95)");
      return;
    }
    if(p.kind==="barrel"){
      rounded(px-(7*s), py-(11*s), 14*s, 22*s, 4*s, "rgba(150,72,52,.88)", "rgba(62,28,20,.9)");
      return;
    }
    if(p.kind==="fence"){
      ctx.strokeStyle="rgba(160,138,98,.75)";
      ctx.lineWidth=2.2*s;
      ctx.beginPath();
      ctx.moveTo(px-(18*s), py-(6*s));
      ctx.lineTo(px+(18*s), py-(6*s));
      ctx.moveTo(px-(18*s), py+(4*s));
      ctx.lineTo(px+(18*s), py+(4*s));
      ctx.stroke();
      for(let i=-16;i<=16;i+=8){
        ctx.beginPath();
        ctx.moveTo(px+(i*s), py-(7*s));
        ctx.lineTo(px+(i*s), py+(7*s));
        ctx.stroke();
      }
      return;
    }
    if(p.kind==="crate"){
      crateBlock(px, py);
    }
  }

  if(themeKey==="ST_FOREST"){
    fillSolid("#0f2b1c");
    ctx.fillStyle="rgba(18,66,40,.34)";
    ctx.fillRect(0,0,w,h);
    terrainTexture(11, 30, 0.09, "rgba(74,222,128,.10)", "rgba(0,0,0,.12)");
    const upperRoad = h * 0.18;
    const midRoad = h * 0.43;
    const lowRoad = h * 0.72;
    const roadA = [[0,upperRoad],[240,upperRoad + 70],[470,upperRoad + 28],[720,upperRoad + 92],[960,upperRoad + 52]];
    const roadB = [[60,midRoad],[260,midRoad - 40],[450,midRoad - 10],[610,midRoad - 70],[820,midRoad - 40],[940,midRoad - 100]];
    const roadC = [[50,lowRoad],[260,lowRoad - 34],[450,lowRoad - 8],[610,lowRoad - 58],[820,lowRoad - 26],[940,lowRoad - 82]];
    roadShoulder(roadA, 48); roadLine(roadA, 48, "rgba(80,60,38,.85)");
    roadShoulder(roadB, 62); roadLine(roadB, 62, "rgba(90,70,45,.85)");
    roadShoulder(roadC, 56); roadLine(roadC, 56, "rgba(84,66,42,.82)");
    const trees = [
      [90,h*0.08],[140,h*0.11],[210,h*0.08],[300,h*0.13],[360,h*0.08],[420,h*0.14],[520,h*0.10],[610,h*0.13],[700,h*0.09],[780,h*0.14],[880,h*0.11],
      [120,h*0.24],[200,h*0.26],[280,h*0.24],[360,h*0.27],[440,h*0.24],[520,h*0.27],[600,h*0.24],[700,h*0.26],[820,h*0.24],
      [110,h*0.40],[210,h*0.39],[320,h*0.40],[420,h*0.38],[520,h*0.40],[650,h*0.39],[760,h*0.40],[880,h*0.39],
      [100,h*0.56],[200,h*0.55],[300,h*0.57],[420,h*0.54],[520,h*0.56],[650,h*0.55],[760,h*0.57],[880,h*0.56],
      [110,h*0.74],[210,h*0.72],[320,h*0.75],[420,h*0.73],[520,h*0.74],[650,h*0.72],[760,h*0.75],[880,h*0.73],
      [90,h*0.88],[170,h*0.91],[290,h*0.88],[410,h*0.90],[520,h*0.87],[660,h*0.90],[780,h*0.88],[900,h*0.91],
    ];
    for(const [x,y] of trees){
      const size = 6 + seedNoise((x/40)|0, (y/40)|0, 17) * 4;
      treeDot(x,y,size);
    }
  }
  else if(themeKey==="ST_SUBURBS"){
    fillSolid("#18402a");
    terrainTexture(19, 32, 0.08, "rgba(232,240,250,.05)", "rgba(0,0,0,.11)");
    const main=[[0,280],[240,270],[480,300],[720,280],[960,300]];
    roadShoulder(main, 84); roadLine(main, 84, "rgba(75,78,86,.9)");
    dashed(main);
    const laneTop = [[120,120],[420,110],[760,120]];
    const laneLow = [[120,440],[420,430],[760,440]];
    roadShoulder(laneTop, 62); roadLine(laneTop, 62, "rgba(75,78,86,.9)");
    roadShoulder(laneLow, 62); roadLine(laneLow, 62, "rgba(75,78,86,.9)");
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
    for(const [x,y] of trees) treeDot(x,y,7.5);
  }
  else if(themeKey==="ST_DOWNTOWN"){
    fillSolid("#1a1f2d");
    terrainTexture(29, 34, 0.07, "rgba(126,149,196,.06)", "rgba(0,0,0,.13)");
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
    terrainTexture(41, 32, 0.09, "rgba(230,210,170,.05)", "rgba(0,0,0,.14)");
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
  drawWaterBodies(1);

  if(chapterStyle?.tint){
    ctx.fillStyle = chapterStyle.tint;
    ctx.fillRect(0,0,w,h);
  }
  if(chapterStyle?.haze){
    const haze = ctx.createLinearGradient(0,0,0,h);
    haze.addColorStop(0, chapterStyle.haze);
    haze.addColorStop(0.45, "rgba(0,0,0,0)");
    haze.addColorStop(1, "rgba(0,0,0,.03)");
    ctx.fillStyle = haze;
    ctx.fillRect(0,0,w,h);
  }

  // realism props
  const props = MAP_REALISM_PROPS[themeKey] || [];
  for(const p of props) drawProp(p);
  const denseLandmarks = buildDenseLandmarks(key, chapter, w, h);
  const extraScale = 1 + (chapterStyle?.landmarkScale || 0);
  for(const lm of denseLandmarks){
    drawProp({ ...lm, _abs:true, s:(lm.s || 1) * extraScale });
  }

  // subtle vignette to reduce flatness
  const vignette = ctx.createRadialGradient(w*0.5, h*0.48, h*0.25, w*0.5, h*0.5, h*0.85);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0,0,w,h);

  if(S.mode==="Arcade"){
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const arcadeTint = ctx.createLinearGradient(0, 0, w, h);
    arcadeTint.addColorStop(0, "rgba(34,211,238,.11)");
    arcadeTint.addColorStop(1, "rgba(192,132,252,.12)");
    ctx.fillStyle = arcadeTint;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "rgba(255,255,255,.65)";
    for(let y=8; y<h; y+=18){
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();
  } else if(S.mode==="Story"){
    ctx.save();
    const storyTint = ctx.createLinearGradient(0, 0, 0, h);
    storyTint.addColorStop(0, "rgba(245,158,11,.06)");
    storyTint.addColorStop(1, "rgba(59,130,246,.05)");
    ctx.fillStyle = storyTint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if(S.mode!=="Survival"){
    const chapterLabel = `${S.mode} Chapter ${chapter}`;
    rounded(14, 12, 152, 24, 10, "rgba(8,14,24,.68)", "rgba(170,196,235,.28)");
    ctx.fillStyle = "rgba(232,240,255,.92)";
    ctx.font = "700 11px system-ui";
    ctx.fillText(chapterLabel, 24, 28);
  }

  if(S.mode!=="Survival"){
    const pulse = 0.86 + Math.sin(Date.now() / 240) * 0.08;
    const ex = S.evacZone.x;
    const ey = S.evacZone.y;
    const er = S.evacZone.r;
    const safeHue = chapterStyle?.safeHue || "rgba(74,222,128,.95)";

    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "rgba(16,56,34,.28)";
    ctx.beginPath(); ctx.arc(ex,ey,er,0,Math.PI*2); ctx.fill();

    // striped safe-zone floor
    ctx.beginPath(); ctx.arc(ex,ey,er-2,0,Math.PI*2); ctx.clip();
    ctx.strokeStyle = "rgba(74,222,128,.28)";
    ctx.lineWidth = 4;
    for(let i=-er*2; i<er*2; i+=12){
      ctx.beginPath();
      ctx.moveTo(ex - er + i, ey - er);
      ctx.lineTo(ex + er + i, ey + er);
      ctx.stroke();
    }
    ctx.restore();

    ctx.globalAlpha = pulse;
    ctx.strokeStyle = safeHue;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(ex,ey,er,0,Math.PI*2); ctx.stroke();

    ctx.strokeStyle = "rgba(167,243,208,.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.arc(ex,ey,er-9,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // center safe marker
    ctx.fillStyle = safeHue;
    rounded(ex-14, ey-14, 28, 28, 8, "rgba(74,222,128,.24)", safeHue);
    ctx.fillStyle = "rgba(220,255,235,.95)";
    ctx.fillRect(ex-2, ey-9, 4, 18);
    ctx.fillRect(ex-9, ey-2, 18, 4);

    for(let i=0;i<4;i++){
      const a = (Math.PI * 0.5 * i) + (Date.now() / 1300);
      const bx = ex + Math.cos(a) * (er + 14);
      const by = ey + Math.sin(a) * (er + 14);
      rounded(bx-7, by-7, 14, 14, 5, "rgba(10,20,14,.88)", safeHue);
    }

    // label + directional signage
    rounded(ex-72, ey-er-34, 144, 26, 12, "rgba(16,56,34,.92)", safeHue);
    ctx.fillStyle = "rgba(220,255,235,.98)";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("EVAC SAFE ZONE", ex, ey-er-16);
    ctx.font = "800 10px system-ui";
    ctx.fillStyle = "rgba(190,255,220,.9)";
    ctx.fillText("FOLLOW MARKER", ex, ey-er-4);

    ctx.strokeStyle = "rgba(170,243,208,.72)";
    ctx.lineWidth = 2;
    for(let i=0;i<3;i++){
      const r = er + 26 + (i * 10);
      const ang = (Date.now() / 900) + (i * 1.4);
      const tx = ex + Math.cos(ang) * r;
      const ty = ey + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - 10, ty - 6);
      ctx.lineTo(tx - 8, ty + 6);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.textAlign = "start";
    ctx.globalAlpha = 1;
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

  if(!__mapFrameCacheCanvas || __mapFrameCacheCanvas.width !== w || __mapFrameCacheCanvas.height !== h){
    __mapFrameCacheCanvas = document.createElement("canvas");
    __mapFrameCacheCanvas.width = w;
    __mapFrameCacheCanvas.height = h;
    __mapFrameCacheCtx = __mapFrameCacheCanvas.getContext("2d");
  }
  if(__mapFrameCacheCtx){
    __mapFrameCacheCtx.clearRect(0, 0, w, h);
    __mapFrameCacheCtx.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
    __mapFrameCacheSig = cacheSig;
    __mapFrameCacheAt = frameNow;
  }
}

function drawAtmosphericParallax(nowTs=Date.now()){
  const mode = performanceMode();
  const slow = frameIsSlow();
  if(mode === "PERFORMANCE" && (__frameHeavyFxFlip % 2 !== 0)) return;
  if(slow && (__frameHeavyFxFlip % 3 === 1)) return;

  const w = cv.width;
  const h = cv.height;
  const hazeLayers = mode === "PERFORMANCE" ? 1 : (slow ? 2 : 3);
  const streakCount = mode === "PERFORMANCE" ? 6 : (slow ? 9 : 14);
  const t = nowTs * 0.00006;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for(let i=0; i<hazeLayers; i++){
    const phase = (i * 1.67);
    const x = ((Math.sin((t * (0.8 + i * 0.12)) + phase) + 1) * 0.5) * w;
    const y = ((Math.cos((t * (0.66 + i * 0.1)) + (phase * 0.8)) + 1) * 0.5) * h;
    const rx = (w * (0.34 - (i * 0.06)));
    const ry = (h * (0.24 - (i * 0.04)));
    const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    grad.addColorStop(0, `rgba(147,197,253,${0.11 - (i * 0.02)})`);
    grad.addColorStop(0.52, `rgba(148,163,184,${0.05 - (i * 0.009)})`);
    grad.addColorStop(1, "rgba(15,23,42,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";

  for(let i=0; i<streakCount; i++){
    const p = ATMOS_PARTICLES[i % ATMOS_PARTICLES.length];
    const px = ((p.u * w) + ((t * (26 + (p.drift * 22)) * p.depth) % (w + 120))) % (w + 120) - 60;
    const py = (p.v * h) + Math.sin(t * (1.9 + p.depth) + (i * 0.8)) * (8 + (p.depth * 10));
    const len = 22 + (p.size * 20);
    const alpha = p.alpha * (slow ? 0.7 : 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(226,232,240,.55)";
    ctx.lineWidth = 1 + (p.size * 0.45);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py + (4 * p.depth));
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
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

function drawMapInteractable(it){
  const now = Date.now();
  const active = now < (it.activeUntil || 0);
  const cooling = now < (it.cooldownUntil || 0);
  const spent = (it.uses || 0) <= 0;
  const pulse = 0.8 + Math.sin(now / 180) * 0.18;
  const icon = it.kind==="alarm" ? "A" : (it.kind==="barricade" ? "B" : "S");
  const label = it.kind==="alarm" ? "Alarm" : (it.kind==="barricade" ? "Barrier" : "Cache");
  const palette = it.kind==="alarm"
    ? ["rgba(96,165,250,.24)","rgba(96,165,250,.95)"]
    : (it.kind==="barricade"
      ? ["rgba(251,191,36,.24)","rgba(251,191,36,.96)"]
      : ["rgba(74,222,128,.22)","rgba(74,222,128,.95)"]);

  ctx.save();
  if(spent) ctx.globalAlpha = 0.35;

  if(it.kind==="barricade" && active){
    ctx.globalAlpha = 0.18 + (pulse * 0.14);
    ctx.strokeStyle = "rgba(251,191,36,.95)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(it.x, it.y, it.effectR || 128, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = spent ? 0.35 : 1;
  }

  ctx.fillStyle = palette[0];
  ctx.beginPath();
  ctx.arc(it.x, it.y, it.r || 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette[1];
  ctx.lineWidth = active ? 3.5 : 2;
  ctx.beginPath();
  ctx.arc(it.x, it.y, (it.r || 22) + (active ? 1 : 0), 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "rgba(242,247,255,.95)";
  ctx.font = "900 12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(icon, it.x, it.y + 4);

  ctx.font = "800 10px system-ui";
  ctx.fillStyle = "rgba(242,247,255,.9)";
  ctx.fillText(label, it.x, it.y + 24);

  if(cooling && !active && !spent){
    const sec = Math.max(1, Math.ceil(((it.cooldownUntil || 0) - now) / 1000));
    ctx.font = "700 10px system-ui";
    ctx.fillStyle = "rgba(255,235,180,.95)";
    ctx.fillText(`${sec}s`, it.x, it.y - 18);
  }

  ctx.textAlign = "start";
  ctx.restore();
}

function drawAbilityCooldownWheel(){
  if(S.inBattle) return;
  const x = cv.width - 42;
  const startY = 56;
  const gap = 56;
  const now = Date.now();

  ctx.save();
  ctx.textAlign = "center";
  for(let i=0; i<ABILITY_WHEEL.length; i++){
    const info = ABILITY_WHEEL[i];
    const y = startY + i * gap;
    const left = abilityCooldownLeftMs(info.key, now);
    const total = Math.max(1, abilityCooldownDuration(info.key));
    const ratio = clamp(left / total, 0, 1);

    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(8,12,22,.72)";
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = "rgba(20,30,45,.92)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.stroke();

    if(left > 0){
      const sweep = ratio * Math.PI * 2;
      ctx.strokeStyle = "rgba(251,191,36,.96)";
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.arc(x, y, 18, -Math.PI / 2, (-Math.PI / 2) + sweep, false);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,235,180,.95)";
      ctx.font = "800 9px system-ui";
      ctx.fillText(`${Math.max(1, Math.ceil(left / 1000))}`, x, y + 29);
    } else {
      ctx.strokeStyle = info.color;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(x, y, 18, -Math.PI / 2, (Math.PI * 1.5), false);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.96;
    ctx.fillStyle = "rgba(245,247,255,.96)";
    ctx.font = "900 13px system-ui";
    ctx.fillText(info.icon, x, y + 4);
  }
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
function drawWaterRipple(x, y, size=16, alpha=0.52){
  if(!isPointInWater(x, y, size * 0.35)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(186,230,253,.78)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(x, y + (size * 0.68), size * 1.05, size * 0.34, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = alpha * 0.6;
  ctx.strokeStyle = "rgba(147,197,253,.72)";
  ctx.beginPath();
  ctx.ellipse(x, y + (size * 0.70), size * 0.66, size * 0.20, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCivilian(c){
  drawWaterRipple(c.x, c.y, 16, 0.50);
  ctx.save();
  ctx.globalAlpha = S.inBattle ? 0.34 : 0.24;
  ctx.strokeStyle = S.inBattle ? "rgba(254,240,138,.95)" : "rgba(236,253,245,.95)";
  ctx.lineWidth = S.inBattle ? 3.0 : 2.3;
  ctx.beginPath();
  ctx.arc(c.x, c.y - 4, S.inBattle ? 20 : 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if(civilianShielded(c)){
    const pulse = 0.82 + Math.sin(Date.now()/120) * 0.15;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "rgba(96,165,250,.92)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y - 4, 20, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  const face = Number.isFinite(c.face) ? c.face : 0;
  const dir = Math.cos(face) >= 0 ? 1 : -1;
  const strideAmp = c.following ? 2.2 : 0.7;
  const stride = Math.sin(((c.step || 0) * 2.3) + (c.id * 0.4)) * strideAmp;
  const breath = Math.sin((Date.now() * 0.0042) + (c.id * 0.9)) * 0.45;
  const bx = c.x;
  const by = c.y + breath;

  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(dir, 1);

  ctx.fillStyle="rgba(8,12,20,.30)";
  ctx.beginPath(); ctx.ellipse(0, 20, 15, 6.2, 0, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle=c.pants;
  roundedRectFill(-9, 9, 7, 11, 3);
  roundedRectFill(2, 9, 7, 11, 3);
  ctx.fillStyle="rgba(36,42,55,.94)";
  roundedRectFill(-9 + (stride * 0.35), 18, 7, 4, 2);
  roundedRectFill(2 - (stride * 0.35), 18, 7, 4, 2);

  ctx.fillStyle=c.shirt;
  roundedRectFill(-9, -12, 18, 24, 6);
  ctx.fillStyle="rgba(255,255,255,.16)";
  roundedRectFill(-7, -10, 14, 9, 4);
  ctx.fillStyle="rgba(20,28,40,.44)";
  roundedRectFill(-3, -8, 6, 14, 2);

  ctx.fillStyle="rgba(28,36,48,.92)";
  roundedRectFill(-13, -10, 4, 14, 2);
  roundedRectFill(9, -10, 4, 14, 2);
  ctx.fillStyle="rgba(55,68,88,.68)";
  roundedRectFill(-13, -1.5 + (stride * 0.14), 4, 4, 1.5);
  roundedRectFill(9, -1.5 - (stride * 0.14), 4, 4, 1.5);

  ctx.fillStyle="rgba(34,40,54,.88)";
  roundedRectFill(-11, -14, 6, 10, 3);
  ctx.fillStyle="rgba(124,208,255,.45)";
  roundedRectFill(-10, -11, 4, 4, 1.5);

  ctx.fillStyle=c.skin;
  ctx.beginPath(); ctx.arc(0, -18, 8.5, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle="rgba(20,20,22,.78)";
  if(c.hair===0){
    ctx.beginPath(); ctx.arc(0, -21, 7, Math.PI, Math.PI*2); ctx.fill();
  } else if(c.hair===1){
    roundedRectFill(-7, -27, 14, 6, 3);
  } else if(c.hair===2){
    ctx.beginPath(); ctx.ellipse(0, -24, 7, 5, 0, 0, Math.PI*2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(-1, -23, 6, 4.5, 0, 0, Math.PI*2); ctx.fill();
  }

  ctx.fillStyle="rgba(26,30,44,.92)";
  ctx.beginPath(); ctx.arc(-2.5, -19, 1.05, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2.5, -19, 1.05, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle="rgba(70,42,32,.78)";
  ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-2, -15); ctx.lineTo(2, -15); ctx.stroke();

  ctx.restore();

  if(c.evac){
    ctx.fillStyle="rgba(74,222,128,.85)";
    ctx.beginPath(); ctx.arc(bx, by-32, 4.5, 0, Math.PI*2); ctx.fill();
  }
  if(!c.following && !c.evac){
    ctx.fillStyle="rgba(245,247,255,.75)";
    ctx.font="900 11px system-ui";
    ctx.fillText("…", bx-4, by-33);
  }

  if(S.dangerCivId===c.id) drawDangerMarker(bx, by-58);

  const pct=c.hp/c.hpMax;
  ctx.fillStyle="rgba(11,13,18,.80)";
  ctx.fillRect(bx-22,by-34,44,6);
  ctx.fillStyle=pct>0.5?"#4ade80":(pct>0.2?"#f59e0b":"#fb7185");
  ctx.fillRect(bx-22,by-34,44*pct,6);
  ctx.strokeStyle = "rgba(241,245,249,.75)";
  ctx.lineWidth = 1;
  ctx.strokeRect(bx-22,by-34,44,6);
}

function drawSoldier(){
  const now = Date.now();
  const step = S.me.step || 0;
  const rollStart = Number.isFinite(S.rollAnimStart) ? S.rollAnimStart : 0;
  const rollUntil = Number.isFinite(S.rollAnimUntil) ? S.rollAnimUntil : 0;
  const rolling = rollUntil > now && rollUntil > rollStart;
  let rollProgress = 0;
  let px = S.me.x;
  let py = S.me.y;
  if(rolling){
    const duration = Math.max(1, rollUntil - rollStart);
    const linearT = clamp((now - rollStart) / duration, 0, 1);
    rollProgress = 1 - Math.pow(1 - linearT, 3);
    const fromX = Number.isFinite(S.rollAnimFromX) ? S.rollAnimFromX : S.me.x;
    const fromY = Number.isFinite(S.rollAnimFromY) ? S.rollAnimFromY : S.me.y;
    const toX = Number.isFinite(S.rollAnimToX) ? S.rollAnimToX : S.me.x;
    const toY = Number.isFinite(S.rollAnimToY) ? S.rollAnimToY : S.me.y;
    px = fromX + ((toX - fromX) * rollProgress);
    py = fromY + ((toY - fromY) * rollProgress);
  }
  const bob = rolling ? 0 : (Math.sin(step) * 1.5);
  const x = px;
  const y = py + bob;
  ctx.save();
  ctx.globalAlpha = S.inBattle ? 0.40 : 0.26;
  ctx.strokeStyle = S.inBattle ? "rgba(56,189,248,.98)" : "rgba(226,232,240,.90)";
  ctx.lineWidth = S.inBattle ? 3.8 : 2.4;
  ctx.beginPath();
  ctx.arc(x, y - 2, S.inBattle ? 25 : 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawWaterRipple(x, y, 18, 0.56);
  const ang = S.me.face || 0;
  const dir = Math.cos(ang) >= 0 ? 1 : -1;
  const stride = rolling ? 0 : (Math.sin(step * 1.9) * 2.1);
  const lean = rolling ? 0 : clamp(Math.sin(ang) * 0.06, -0.1, 0.1);

  if(shieldActiveNow()){
    const pulse = 0.78 + Math.sin(Date.now()/130) * 0.16;
    ctx.save();
    ctx.globalAlpha = pulse * 0.72;
    ctx.strokeStyle = "rgba(96,165,250,.96)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, SHIELD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = pulse * 0.22;
    ctx.fillStyle = "rgba(96,165,250,.35)";
    ctx.beginPath();
    ctx.arc(x, y, SHIELD_RADIUS - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  if(rolling){
    const spin = rollProgress * (Math.PI * 2.35);
    ctx.rotate(spin * (dir >= 0 ? 1 : -1));
  } else {
    ctx.rotate(lean);
  }

  ctx.globalAlpha=0.28;
  ctx.fillStyle="#000";
  ctx.beginPath(); ctx.ellipse(0,19,20,8,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  ctx.fillStyle="rgba(26,32,44,.95)";
  roundedRectFill(-9,9,7,10,3);
  roundedRectFill(2,9,7,10,3);
  ctx.fillStyle="rgba(17,22,31,.95)";
  roundedRectFill(-9 + (stride * 0.35), 18, 7, 4, 2);
  roundedRectFill(2 - (stride * 0.35), 18, 7, 4, 2);

  ctx.fillStyle="rgba(48,58,72,.96)";
  roundedRectFill(-10,-16,20,27,7);
  ctx.fillStyle="rgba(20,30,44,.97)";
  roundedRectFill(-8,-11,16,19,6);
  ctx.fillStyle="rgba(72,88,108,.45)";
  roundedRectFill(-4.5,-10,9,6,2);
  ctx.fillStyle="rgba(28,36,48,.95)";
  roundedRectFill(-14,-12,5,16,2);
  roundedRectFill(9,-12,5,16,2);

  ctx.fillStyle="rgba(36,44,59,.9)";
  roundedRectFill(-12,-14,6,12,3);
  ctx.fillStyle="rgba(120,208,255,.46)";
  roundedRectFill(-11,-11,4,4,1.5);

  ctx.fillStyle="rgba(55,65,75,.95)";
  ctx.beginPath(); ctx.arc(0, -24, 9.5, Math.PI, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(35,45,55,.95)";
  roundedRectFill(-10,-24,20,6,3);
  ctx.fillStyle="rgba(180,210,235,.55)";
  roundedRectFill(-6,-22,12,3,2);

  ctx.fillStyle="rgba(220,220,225,.90)";
  ctx.beginPath(); ctx.arc(0,-20,6.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(22,26,38,.95)";
  ctx.beginPath(); ctx.arc(-2,-20,1,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2,-20,1,0,Math.PI*2); ctx.fill();
  ctx.restore();

  if(!rolling){
    const wx = x + Math.cos(ang) * 14;
    const wy = y + Math.sin(ang) * 13;
    const gripX = x + Math.cos(ang) * 5;
    const gripY = y + Math.sin(ang) * 2;
    ctx.strokeStyle="rgba(18,22,28,.96)";
    ctx.lineWidth=4.3;
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(wx, wy); ctx.stroke();
    ctx.strokeStyle="rgba(105,116,128,.75)";
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(gripX, gripY); ctx.lineTo(wx, wy); ctx.stroke();

    ctx.fillStyle="rgba(245,158,11,.90)";
    ctx.beginPath(); ctx.arc(wx, wy, 2.3, 0, Math.PI*2); ctx.fill();
  }

  if(S.inBattle){
    const hpPct = Math.round(clamp((S.hp / 100) * 100, 0, 100));
    const hpRatio = clamp(S.hp / 100, 0, 1);
    const labelY = y - 46;
    ctx.fillStyle = "rgba(9,12,18,.86)";
    roundedRectFill(x - 28, labelY - 12, 56, 16, 7);
    ctx.fillStyle = "rgba(245,247,255,.94)";
    ctx.font = "900 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`${hpPct}%`, x, labelY);
    ctx.fillStyle = "rgba(11,13,18,.88)";
    ctx.fillRect(x - 24, labelY + 4, 48, 4);
    ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : (hpRatio > 0.2 ? "#f59e0b" : "#fb7185");
    ctx.fillRect(x - 24, labelY + 4, 48 * hpRatio, 4);
    ctx.textAlign = "start";
  }
}

function drawSupportUnit(unit){
  const bob = Math.sin(unit.step || 0) * 1.2;
  const x = unit.x;
  const y = unit.y + bob;
  drawWaterRipple(x, y, 17, 0.52);
  const attacker = unit.role === "attacker";
  const ang = unit.face || 0;
  const dir = Math.cos(ang) >= 0 ? 1 : -1;
  const stride = Math.sin((unit.step || 0) * 1.8) * 1.6;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 18, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(25,30,40,.95)";
  roundedRectFill(-8, 8, 6, 9, 3);
  roundedRectFill(2, 8, 6, 9, 3);
  ctx.fillStyle = "rgba(20,24,32,.95)";
  roundedRectFill(-8 + (stride * 0.35), 16, 6, 4, 2);
  roundedRectFill(2 - (stride * 0.35), 16, 6, 4, 2);

  ctx.fillStyle = attacker ? "rgba(114,44,26,.95)" : "rgba(30,68,92,.95)";
  roundedRectFill(-9, -15, 18, 24, 6);
  ctx.fillStyle = attacker ? "rgba(251,146,60,.88)" : "rgba(52,211,153,.88)";
  roundedRectFill(-7, -10, 14, 11, 4);
  ctx.fillStyle = "rgba(220,220,225,.92)";
  ctx.beginPath();
  ctx.arc(0, -18, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(26,36,49,.96)";
  ctx.fillRect(-9, -25, 18, 5);

  ctx.fillStyle = attacker ? "rgba(89,30,18,.88)" : "rgba(20,56,78,.9)";
  roundedRectFill(-12, -12, 4, 12, 2);
  roundedRectFill(8, -12, 4, 12, 2);
  ctx.restore();

  ctx.strokeStyle = attacker ? "rgba(255,214,170,.9)" : "rgba(210,240,255,.88)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.lineTo(x + Math.cos(ang) * 11, y + Math.sin(ang) * 11);
  ctx.stroke();

  ctx.fillStyle = attacker ? "rgba(255,233,205,.86)" : "rgba(245,247,255,.78)";
  ctx.font = "900 10px system-ui";
  const label = unit.name || (attacker ? "Tiger Specialist" : "Rescue Specialist");
  ctx.fillText(label, x - Math.min(26, label.length * 2.2), y - 28);
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
  const now = Date.now();
  const bossStealth = bossStealthActive(t, now);

  if(now < (S.fogUntil||0)) alpha *= 0.75;
  if((t.type==="Stalker" && now < (t.fadeUntil||0)) || bossStealth){
    alpha *= 0.35;
  } else if(t.type==="Stalker"){
    const near=dist(t.x,t.y,S.me.x,S.me.y) < 180;
    alpha *= near ? 0.85 : 0.55;
  }

  const c=tigerColors(t.type);
  const speed = Math.min(2.9, Math.hypot(t.vx||0, t.vy||0));
  const sprinting = (now < (t.burstUntil||0)) || (t.type==="Scout" && now < (t.dashUntil||0));
  const gaitState = t.gaitState || (sprinting ? "sprint" : (speed > 2.1 ? "run" : (speed > 1.0 ? "trot" : "walk")));
  const gaitBlend = Number.isFinite(t.gaitBlend) ? t.gaitBlend : clamp(speed / 6, 0, 1);
  const bob = Math.sin((t.step||0)*2.2)*0.34*Math.max(0.62, speed*0.90);
  const bodyLift = clamp(gaitBlend * 2.4 + (sprinting ? 1.35 : 0), 0, 3.8);
  const x=t.x, y=t.y + bob - bodyLift;
  const tigerFocus = S.inBattle && (S.activeTigerId===t.id || S.lockedTigerId===t.id);
  ctx.save();
  ctx.globalAlpha = tigerFocus ? 0.50 : 0.28;
  ctx.strokeStyle = tigerFocus ? "rgba(248,113,113,.99)" : "rgba(254,215,170,.88)";
  ctx.lineWidth = tigerFocus ? 3.8 : 2.3;
  ctx.beginPath();
  ctx.arc(x, y, tigerFocus ? 38 : 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  let s=1.0;
  if(t.type==="Scout") s=0.85;
  if(t.type==="Alpha") s=1.22;
  if(t.type==="Berserker") s=1.10;
  drawWaterRipple(x, y, 20 * s, 0.58);
  const drawDir = Number.isFinite(t.drawDir) ? (t.drawDir >= 0 ? 1 : -1) : ((Math.cos(t.heading || 0) >= 0) ? 1 : -1);

  if(t.type==="Berserker" && (t.hp/t.hpMax)<0.35){
    ctx.globalAlpha=0.18*alpha;
    ctx.strokeStyle="rgba(251,113,133,.95)";
    ctx.lineWidth=10;
    ctx.beginPath(); ctx.arc(x,y,34*s,0,Math.PI*2); ctx.stroke();
  }

  ctx.globalAlpha=0.24*alpha;
  ctx.fillStyle="#000";
  ctx.beginPath();
  ctx.ellipse(x, y + 18*s, 22*s + (speed * 0.8), 8*s, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.globalAlpha=alpha;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(drawDir, 1);
  ctx.rotate(clamp((t.vy || 0) * 0.018, -0.09, 0.09));

  ctx.fillStyle=c.body;
  ctx.beginPath(); ctx.ellipse(0, 2*s, 22*s, 13*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.14)";
  ctx.beginPath(); ctx.ellipse(-2*s, -2*s, 14*s, 5*s, -0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=c.belly;
  ctx.beginPath(); ctx.ellipse(3*s, 6*s, 14*s, 8*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=c.body;
  ctx.beginPath(); ctx.ellipse(20*s, -6*s, 12*s, 10*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(26*s, -14*s, 4.5*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16*s, -14*s, 4.5*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(240,220,190,.88)";
  ctx.beginPath(); ctx.ellipse(22*s, -4.5*s, 6.5*s, 4.4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="#12161f";
  ctx.beginPath(); ctx.arc(24*s, -8.4*s, 1.1*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(18.5*s, -8.6*s, 1.1*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(15,15,15,.88)";
  ctx.beginPath();
  ctx.moveTo(22*s, -4.4*s);
  ctx.lineTo(20.5*s, -2.3*s);
  ctx.lineTo(23.5*s, -2.3*s);
  ctx.closePath();
  ctx.fill();

  const gaitMul = gaitState==="sprint" ? 1.34 : (gaitState==="run" ? 1.18 : (gaitState==="trot" ? 0.92 : 0.64));
  const legSwingA = Math.sin((t.step||0)*1.9) * (2.6 + speed*3.7) * s * gaitMul;
  const legSwingB = Math.sin((t.step||0)*1.9 + Math.PI) * (2.2 + speed*3.2) * s * gaitMul;
  ctx.strokeStyle=c.body;
  ctx.lineWidth=3*s;
  [[-10,legSwingA],[-2,legSwingB],[8,legSwingB],[16,legSwingA]].forEach(([offset, swing])=>{
    ctx.beginPath();
    ctx.moveTo(offset*s, 10*s);
    ctx.lineTo(offset*s + swing*0.18, 21*s);
    ctx.stroke();
    ctx.fillStyle="rgba(24,26,33,.92)";
    ctx.beginPath();
    ctx.ellipse(offset*s + swing*0.18, 21.5*s, 1.8*s, 1.05*s, 0, 0, Math.PI*2);
    ctx.fill();
  });

  ctx.strokeStyle=c.body; ctx.lineWidth=5*s;
  ctx.beginPath();
  ctx.moveTo(-20*s, 2*s);
  ctx.quadraticCurveTo(-34*s, -2*s + Math.sin((t.step||0)+1.4)*6*s*gaitMul, -40*s, -10*s);
  ctx.stroke();

  ctx.strokeStyle=c.stripe; ctx.lineWidth=3*s;
  for(let i=-2;i<=2;i++){
    ctx.beginPath();
    ctx.moveTo(-8*s + i*6*s, -6*s);
    ctx.lineTo(-2*s + i*6*s, 10*s);
    ctx.stroke();
  }
  ctx.strokeStyle="rgba(28,30,35,.78)";
  ctx.lineWidth=1.2*s;
  ctx.beginPath(); ctx.moveTo(28*s, -4.8*s); ctx.lineTo(32*s, -5.6*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28*s, -3.3*s); ctx.lineTo(32*s, -3.6*s); ctx.stroke();
  ctx.restore();

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
    if(!S.inBattle){
      const dLock = dist(S.me.x, S.me.y, t.x, t.y);
      const range = equippedWeaponRange();
      const inRange = dLock <= range;
      ctx.strokeStyle = inRange ? "rgba(74,222,128,.88)" : "rgba(251,191,36,.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash(inRange ? [6,5] : [3,5]);
      ctx.beginPath();
      ctx.arc(x, y, 36*s, 0, Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      if(!inRange){
        const delta = Math.max(0, Math.round(dLock - range));
        ctx.fillStyle = "rgba(251,191,36,.96)";
        ctx.font = "900 10px system-ui";
        ctx.fillText(`+${delta}m`, x-14, y-57*s);
      }
    }
  }
  if(t.alive && t.hp <= captureWindowHp(t)){
    ctx.strokeStyle = "rgba(125,211,252,.86)";
    ctx.lineWidth = 2.2;
    ctx.setLineDash([7,6]);
    ctx.beginPath();
    ctx.arc(x, y, 43*s, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if(t.huntState === TIGER_HUNT_STATES.STALK){
    ctx.strokeStyle = "rgba(250,204,21,.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5,4]);
    ctx.beginPath();
    ctx.arc(x, y, 35*s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if(t.huntState === TIGER_HUNT_STATES.POUNCE){
    const windup = now < (t.pounceWindupUntil || 0);
    const pulse = 0.65 + (0.35 * Math.sin(now * 0.022));
    ctx.globalAlpha = clamp(alpha * pulse, 0.25, 1);
    ctx.strokeStyle = windup ? "rgba(251,191,36,.96)" : "rgba(248,113,113,.98)";
    ctx.lineWidth = windup ? 2.4 : 3.2;
    if(windup) ctx.setLineDash([4,3]);
    ctx.beginPath();
    ctx.arc(x, y, (windup ? 36 : 40) * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = alpha;
  } else if(t.huntState === TIGER_HUNT_STATES.RECOVER){
    ctx.strokeStyle = "rgba(125,211,252,.72)";
    ctx.lineWidth = 1.8;
    ctx.setLineDash([3,5]);
    ctx.beginPath();
    ctx.arc(x, y, 33*s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if((t.intentUntil || 0) > now){
    ctx.strokeStyle="rgba(251,191,36,.92)";
    ctx.lineWidth=2.2;
    ctx.setLineDash([6,5]);
    ctx.beginPath();
    ctx.arc(x, y, 34*s, 0, Math.PI*2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle="rgba(255,235,180,.98)";
    ctx.font="800 10px system-ui";
    ctx.fillText(t.intent || "Ready", x-20*s, y-52*s);
  }

  const pct=t.hp/t.hpMax;
  ctx.fillStyle="rgba(11,13,18,.85)";
  ctx.fillRect(x-26*s,y-34*s,52*s,6);
  ctx.fillStyle=pct>0.5?"#4ade80":(pct>0.2?"#f59e0b":"#fb7185");
  ctx.fillRect(x-26*s,y-34*s,52*s*pct,6);
  ctx.strokeStyle = "rgba(241,245,249,.72)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x-26*s,y-34*s,52*s,6);
  if(S.inBattle && (S.activeTigerId===t.id || S.lockedTigerId===t.id)){
    ctx.fillStyle="rgba(9,12,18,.85)";
    roundedRectFill(x - (22*s), y - (49*s), 44*s, 12*s, 5*s);
    ctx.fillStyle="rgba(245,247,255,.95)";
    ctx.font=`900 ${Math.round(10*s)}px system-ui`;
    ctx.textAlign="center";
    ctx.fillText(`${Math.round(clamp(pct, 0, 1) * 100)}%`, x, y-(40*s));
    ctx.textAlign="start";
  }

  ctx.globalAlpha=0.85*alpha;
  ctx.fillStyle="rgba(245,247,255,.80)";
  ctx.font="900 12px system-ui";
  const dash = (t.type==="Scout" && now<(t.dashUntil||0)) ? " (DASH)" : "";
  const fade = ((t.type==="Stalker" && now<(t.fadeUntil||0)) || bossStealth) ? " (FADE)" : "";
  const roar = (now<(t.roarUntil||0)) ? " (ROAR)" : "";
  const rage = (t.type==="Berserker" && (t.hp/t.hpMax)<0.35) ? " (RAGE)" : "";
  const hunt =
    t.huntState === TIGER_HUNT_STATES.POUNCE ? " (POUNCE)" :
    t.huntState === TIGER_HUNT_STATES.STALK ? " (STALK)" :
    t.huntState === TIGER_HUNT_STATES.RECOVER ? " (RECOVER)" : "";
  const persona = t.personality ? ` • ${t.personality}` : "";
  const bossTag = isBossTiger(t) ? ` • ${bossIdentityProfile(t)?.name || "Boss"}` : "";
  ctx.fillText(t.type + bossTag + persona + (t.tranqTagged?" (tranq)":"") + dash + fade + roar + rage + hunt, x-44*s, y-44*s);
  ctx.globalAlpha=1;
}

function drawEntities(){
  // carcasses block movement
  for(const c of S.carcasses) drawCarcass(c.x,c.y);

  // pickups
  for(const p of (S.pickups||[])) drawPickup(p);

  for(const it of (S.mapInteractables || [])) drawMapInteractable(it);

  for(const site of (S.rescueSites || [])) drawRescueSite(site);

  if(S.mode!=="Survival"){
    for(const c of S.civilians){ if(c.alive) drawCivilian(c); }
  }
  for(const unit of (S.supportUnits || [])) drawSupportUnit(unit);
  for(const t of S.tigers){ if(t.alive) drawTiger(t); }
  drawSoldier();
  drawAbilityCooldownWheel();
  const perfMode = performanceMode();
  const isSlowFrame = frameIsSlow();
  const entityLoad =
    (S.tigers?.length || 0) +
    (S.civilians?.length || 0) +
    (S.supportUnits?.length || 0) +
    (S.pickups?.length || 0);
  const heavyLoad = entityLoad > 34;
  __frameHeavyFxFlip = (__frameHeavyFxFlip + 1) % 6;
  const drawFx = heavyLoad
    ? (__frameHeavyFxFlip % (isSlowFrame ? 4 : 3) === 0)
    : ((perfMode !== "PERFORMANCE" && !isSlowFrame)
      || (perfMode === "PERFORMANCE" && (__frameHeavyFxFlip % 2 === 0))
      || (isSlowFrame && (__frameHeavyFxFlip % 3 === 0)));
  if(drawFx || IMPACT_PULSES.length > 0) drawImpactPulses();
  if(drawFx) drawCombatFx();
  if(drawFx || __frameHeavyFxFlip % (heavyLoad ? 3 : 2) === 0) drawDamagePopups();
}
function drawMobileUiClearLane(){
  // Intentionally no overlay in the control lane; keep full map visibility.
  return;
}

// ===================== MISSION FLOW =====================

// ===================== MAIN LOOP =====================
function draw(){
  const frameStart = performance.now ? performance.now() : Date.now();
  try{
    if(shouldSuspendForHiddenDocument()){
      maybeAutosave();
      return;
    }
    beginFrameBudget(frameStart);
    if(__frameSpikePending){
      safeTick("recoverFromSpikeFrame", recoverFromSpikeFrame);
    }
    safeTick("pollGamepadControls", pollGamepadControls);
    safeTick("refreshControllerUi", refreshControllerUi);
    safeTick("maybeRenderHUD", maybeRenderHUD);
    safeTick("updateEngage", updateEngage);
    safeTick("respawnTick", respawnTick);
    runFrameTask("stabilityHealth", frameInterval(220, 1.6), stabilityHealthTick, { costHint:0.9, critical:true });
    runFrameTask("arcadeModeTick", frameInterval(220, 1.45), arcadeModeTick, { costHint:0.6, critical:S.mode==="Arcade" });

    if(!(S.gameOver || S.paused || S.missionEnded)){
      runFrameTask("sanitizeState", frameInterval(150, 2.0), sanitizeRuntimeState, { costHint:1.3, critical:true });
      runFrameTask("clampWorld", frameInterval(180, 1.3), clampWorldToCanvas, { costHint:0.9 });
      runFrameTask("unstickEntities", frameInterval(84, 1.6), unstickEntitiesTick, { costHint:1.5, critical:true });
      safeTick("regen", regen);
      runFrameTask("backupTick", frameInterval(42, 1.5), backupTick, { costHint:1.1 });
      runFrameTask("trapTick", frameInterval(34, 1.6), trapTick, { costHint:1.2 });
      runFrameTask("mapInteractableTick", frameInterval(64, 1.5), mapInteractableTick, { costHint:1.1 });
      runFrameTask("comboTick", frameInterval(110, 1.4), comboTick, { costHint:0.7 });

      if(!window.TigerTutorial?.isRunning){
        runFrameTask("tickEvents", frameInterval(180, 1.5), tickEvents, { costHint:0.9 });
        runFrameTask("ambientPickup", frameInterval(300, 1.35), maybeSpawnAmbientPickup, { costHint:0.6 });
        runFrameTask("tickPickups", frameInterval(46, 1.5), tickPickups, { costHint:1.0 });
      }

      runFrameTask("roamTigers", frameInterval(34, 1.55), roamTigers, { costHint:2.6, critical:true });
      runFrameTask("bossIdentity", frameInterval(92, 1.45), bossIdentityTick, { costHint:0.9, critical:true });
      runFrameTask("bossReinforce", frameInterval(110, 1.45), bossReinforcementTick, { costHint:0.8 });
      runFrameTask("supportUnits", frameInterval(50, 1.8), supportUnitsTick, { costHint:2.4 });
      let usedKeyboard = false;
      safeTick("keyboardMoveTick", ()=>{ usedKeyboard = keyboardMoveTick(); });
      if(!usedKeyboard) safeTick("movePlayer", movePlayer);
      safeTick("clearOutOfRangeLock", clearOutOfRangeLock);
      runFrameTask("followCivilians", frameInterval(40, 1.5), followCiviliansTick, { costHint:1.7, critical:S.mode!=="Survival" });
      runFrameTask("evacCheck", frameInterval(58, 1.5), evacCheck, { costHint:0.9 });
      runFrameTask("civThreats", frameInterval(72, 1.5), tickCiviliansAndThreats, { costHint:1.6, critical:S.mode!=="Survival" });
      runFrameTask("survivalPressure", frameInterval(86, 1.4), survivalPressureTick, { costHint:1.1 });
      runFrameTask("combatTick", frameInterval(S.inBattle ? 24 : 34, 1.6), combatTick, { costHint:1.9, critical:S.inBattle });
      runFrameTask("checkMissionComplete", frameInterval(90, 1.4), checkMissionComplete, { costHint:0.8, critical:true });
    }
    runFrameTask("combatFx", frameInterval(26, 1.5), tickCombatFx, { costHint:0.8 });
    runFrameTask("damagePopups", frameInterval(26, 1.5), tickDamagePopups, { costHint:0.8 });
    runFrameTask("impactPulses", frameInterval(24, 1.5), tickImpactPulses, { costHint:0.7 });

    safeTick("drawSceneFrame", ()=>{
      drawMapScene();
      const shake = sampleCameraShake();
      if(shake.active){
        ctx.save();
        ctx.translate(shake.x, shake.y);
      }
      drawAtmosphericParallax();
      drawEntities();
      if(shake.active){
        ctx.restore();
      }
      drawMobileUiClearLane();
    });
    maybeAutosave();
  }catch(err){
    const now = Date.now();
    __frameSpikePending = true;
    safeTick("stabilityHealthTick", stabilityHealthTick);
    if((window.__tsFrameRecoverAt || 0) + 5200 < now){
      window.__tsFrameRecoverAt = now;
      try{ runStabilityRecovery("frame-exception"); }catch(e){}
    }
    if((window.__tsFrameErrAt || 0) + 2500 < now){
      window.__tsFrameErrAt = now;
      console.error("Frame loop recovered from error:", err);
    }
  }finally{
    updateFrameLoad(frameStart);
    requestAnimationFrame(draw);
  }
}

// ===================== INIT =====================
function missionStateLooksEmpty(){
  if(!S || typeof S !== "object") return true;
  const hasPlayer = !!(S.me && Number.isFinite(S.me.x) && Number.isFinite(S.me.y));
  const hasTiger = Array.isArray(S.tigers) && S.tigers.some((t)=>t && t.alive !== false && Number.isFinite(t.x) && Number.isFinite(t.y));
  if(S.mode === "Survival") return !(hasPlayer && hasTiger);
  const hasCivilian = Array.isArray(S.civilians) && S.civilians.some((c)=>c && c.alive !== false && !c.evac && Number.isFinite(c.x) && Number.isFinite(c.y));
  const hasEvac = !!(S.evacZone && Number.isFinite(S.evacZone.x) && Number.isFinite(S.evacZone.y) && Number.isFinite(S.evacZone.r));
  return !(hasPlayer && hasTiger && hasCivilian && hasEvac);
}

function init(){
  ensureStarsDebugUi();
  pushStarsDebug("app:init", { user: tgUserKey(), build: TS_BUILD });
  ensureStoryMetaState();
  if(!["Story","Arcade","Survival"].includes(S.mode)) S.mode = DEFAULT.mode;
  S.storyLevel = clamp(Math.floor(S.storyLevel || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  S.arcadeLevel = clamp(Math.floor(S.arcadeLevel || 1), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  if(syncStoryChapterRewardsFromProgress() > 0){
    __savePending = true;
  }
  trimPersistentState(S);
  if(typeof S.storyIntroSeen !== "boolean") S.storyIntroSeen = false;
  S.performanceMode = normalizePerformanceMode(S.performanceMode);
  S.touchHud = normalizeTouchHudSettings(S.touchHud);
  if(!Array.isArray(S.ownedWeapons) || !S.ownedWeapons.length) S.ownedWeapons = [...DEFAULT.ownedWeapons];
  if(!S.equippedWeaponId || !getWeapon(S.equippedWeaponId)) S.equippedWeaponId = DEFAULT.equippedWeaponId;
  if(!S.ammoReserve || typeof S.ammoReserve !== "object") S.ammoReserve = { ...DEFAULT.ammoReserve };
  if(!S.mag || typeof S.mag !== "object") S.mag = { ...DEFAULT.mag };
  if(!S.medkits || typeof S.medkits !== "object") S.medkits = { ...DEFAULT.medkits };
  if(!S.repairKits || typeof S.repairKits !== "object") S.repairKits = { ...DEFAULT.repairKits };
  ensureArmorPlateInventoryState();
  ensureArmorPlateFallbackState();
  ensureSupplySelectionState();
  if(!Array.isArray(S.tigers)) S.tigers = [];
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.rescueSites)) S.rescueSites = [];
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  if(!Array.isArray(S.mapInteractables)) S.mapInteractables = [];
  if(!S.evacZone) S.evacZone = { ...DEFAULT.evacZone };
  if(!Number.isFinite(S.shields)) S.shields = 1;
  if(!Number.isFinite(S.shieldUntil)) S.shieldUntil = 0;
  if(!Number.isFinite(S.rollCooldownUntil)) S.rollCooldownUntil = 0;
  if(!Number.isFinite(S.rollInvulnUntil)) S.rollInvulnUntil = 0;
  if(!Number.isFinite(S.rollBufferedDodges)) S.rollBufferedDodges = 0;
  if(!Number.isFinite(S.rollBufferedUntil)) S.rollBufferedUntil = 0;
  if(!Number.isFinite(S.rollAnimStart)) S.rollAnimStart = 0;
  if(!Number.isFinite(S.rollAnimUntil)) S.rollAnimUntil = 0;
  if(!Number.isFinite(S.rollAnimFromX)) S.rollAnimFromX = S.me?.x ?? DEFAULT.me.x;
  if(!Number.isFinite(S.rollAnimFromY)) S.rollAnimFromY = S.me?.y ?? DEFAULT.me.y;
  if(!Number.isFinite(S.rollAnimToX)) S.rollAnimToX = S.me?.x ?? DEFAULT.me.x;
  if(!Number.isFinite(S.rollAnimToY)) S.rollAnimToY = S.me?.y ?? DEFAULT.me.y;
  if(!Number.isFinite(S.respawnPendingUntil)) S.respawnPendingUntil = 0;
  if(!Number.isFinite(S.respawnTargetX)) S.respawnTargetX = 0;
  if(!Number.isFinite(S.respawnTargetY)) S.respawnTargetY = 0;
  if(!Number.isFinite(S.respawnNoticeAt)) S.respawnNoticeAt = 0;
  if(!Number.isFinite(S.takeoverPromptUntil)) S.takeoverPromptUntil = 0;
  if(S.takeoverCivId != null){
    const civIdNum = Number(S.takeoverCivId);
    S.takeoverCivId = Number.isFinite(civIdNum) ? civIdNum : null;
  } else S.takeoverCivId = null;
  if(typeof S.takeoverUnitId !== "string") S.takeoverUnitId = null;
  ensureAbilityCooldownState();
  if(!Number.isFinite(S.soldierAttackersOwned)) S.soldierAttackersOwned = 0;
  if(!Number.isFinite(S.soldierRescuersOwned)) S.soldierRescuersOwned = 0;
  if(!Number.isFinite(S.soldierAttackersDowned)) S.soldierAttackersDowned = 0;
  if(!Number.isFinite(S.soldierRescuersDowned)) S.soldierRescuersDowned = 0;
  syncSquadRosterBounds();
  if(!Number.isFinite(S.comboCount)) S.comboCount = 0;
  if(!Number.isFinite(S.comboBest)) S.comboBest = 0;
  if(!Number.isFinite(S.comboExpireAt)) S.comboExpireAt = 0;
  if(!Number.isFinite(S.arcadeMissionStartAt)) S.arcadeMissionStartAt = 0;
  if(!Number.isFinite(S.arcadeMissionLimitSec)) S.arcadeMissionLimitSec = 0;
  if(!Number.isFinite(S.arcadeComboPeak)) S.arcadeComboPeak = 0;
  if(!Number.isFinite(S.arcadeScoreBonus)) S.arcadeScoreBonus = 0;
  if(!Number.isFinite(S._arcadeTimerWarn)) S._arcadeTimerWarn = 0;
  if(!S.progressionUnlocks || typeof S.progressionUnlocks !== "object") S.progressionUnlocks = {};
  if(S.paused && !S.gameOver && !S.missionEnded){
    S.paused = false;
    S.pauseReason = null;
  }

  // achievements defaults
  if(!S.achievements) S.achievements={};
  applyModeTheme(S.mode);
  updatePerformanceLabels();
  applyTouchHudSettings();
  updateTitle();
  ensureStabilityMonitorNode();
  renderStabilityMonitor(true);

  for(const wid of S.ownedWeapons){
    if(S.durability[wid]==null) S.durability[wid]=100;
  }

  const w = equippedWeapon();
  S.mag.cap = w.mag;

  if(S.mag.loaded==null) S.mag.loaded = w.mag;
  S.mag.loaded = clamp(S.mag.loaded,0,S.mag.cap);

  if(S.mag.loaded===0) autoReloadIfNeeded(true);

  for(const t of (S.tigers || [])){
    if(!t.personality) t.personality = pickTigerPersonality(t.type || "Standard");
    if(typeof t.intent !== "string") t.intent = "";
    if(!Number.isFinite(t.intentUntil)) t.intentUntil = 0;
    if(!Number.isFinite(t.wanderAngle)) t.wanderAngle = Math.random() * (Math.PI * 2);
    if(!Number.isFinite(t.burstUntil)) t.burstUntil = 0;
    if(!Number.isFinite(t.nextPounceAt)) t.nextPounceAt = 0;
    if(!Number.isFinite(t.nextDashAt)) t.nextDashAt = 0;
    if(!Number.isFinite(t.nextFadeAt)) t.nextFadeAt = 0;
    if(!Number.isFinite(t.nextRoarAt)) t.nextRoarAt = 0;
    if(!Number.isFinite(t.nextReinforceAt)) t.nextReinforceAt = 0;
    if(!Number.isFinite(t.enragedUntil)) t.enragedUntil = 0;
    if(!Number.isFinite(t.bossSkillStep)) t.bossSkillStep = 0;
    if(!Number.isFinite(t.nextBossSkillAt)) t.nextBossSkillAt = 0;
    if(!Number.isFinite(t.bossIdentityChapter)) t.bossIdentityChapter = 0;
    if(!Number.isFinite(t.bossStealthUntil)) t.bossStealthUntil = 0;
    if(!Number.isFinite(t.bossPounceCharges)) t.bossPounceCharges = 0;
    if(!Number.isFinite(t.bossPounceChainUntil)) t.bossPounceChainUntil = 0;
    if(!Number.isFinite(t.bossChargeUntil)) t.bossChargeUntil = 0;
    if(!Number.isFinite(t.heading)) t.heading = Math.atan2(t.vy || Math.sin(t.wanderAngle || 0), t.vx || Math.cos(t.wanderAngle || 0));
    if(!Number.isFinite(t.drawDir)) t.drawDir = (Math.cos(t.heading) >= 0 ? 1 : -1);
    if(typeof t.gaitState !== "string") t.gaitState = "walk";
    if(!Number.isFinite(t.gaitBlend)) t.gaitBlend = 0;
    ensureTigerHuntState(t);
  }
  for(const civ of (S.civilians || [])){
    if(typeof civ.following !== "boolean") civ.following = false;
    if(!Number.isFinite(civ.followGraceUntil)) civ.followGraceUntil = 0;
    if(typeof civ.escortOwner !== "string") civ.escortOwner = civ.following ? "player" : "";
    if(civ.escortOwner !== "player" && civ.escortOwner !== "rescue") civ.escortOwner = "";
    if(typeof civ.escortUnitId !== "string") civ.escortUnitId = "";
    if(!Number.isFinite(civ.fleeUntil)) civ.fleeUntil = 0;
    if(!Number.isFinite(civ.fleeFromTigerId)) civ.fleeFromTigerId = 0;
    if(!Number.isFinite(civ._takeoverPromptLockUntil)) civ._takeoverPromptLockUntil = 0;
    if(!Number.isFinite(civ.face)) civ.face = 0;
    if(!Number.isFinite(civ.step)) civ.step = 0;
  }
  for(const unit of (S.supportUnits || [])){
    if(!unit.role) unit.role = "attacker";
    if(!unit.name) unit.name = unit.role === "rescue" ? "Rescue Specialist" : "Tiger Specialist";
    if(!Number.isFinite(unit.hpMax)) unit.hpMax = storySupportHpMax(unit.role);
    else unit.hpMax = storySupportHpMax(unit.role);
    if(!Number.isFinite(unit.hp)) unit.hp = unit.hpMax;
    unit.hp = clamp(unit.hp, 0, unit.hpMax);
    unit.armor = storySupportArmorBase(unit.role);
    if(unit.alive == null) unit.alive = true;
  }
  if((S.soldierAttackersOwned || 0) + (S.soldierRescuersOwned || 0) + (S.soldierAttackersDowned || 0) + (S.soldierRescuersDowned || 0) <= 0 && Array.isArray(S.supportUnits) && S.supportUnits.length){
    S.soldierAttackersOwned = S.supportUnits.filter((unit)=>unit.alive && unit.role === "attacker").length;
    S.soldierRescuersOwned = S.supportUnits.filter((unit)=>unit.alive && unit.role === "rescue").length;
    S.soldierAttackersDowned = 0;
    S.soldierRescuersDowned = 0;
  }
  syncSquadRosterBounds();
  for(const it of (S.mapInteractables || [])){
    if(!it.kind) it.kind = "cache";
    if(!it.label) it.label = it.kind === "barricade" ? "Barrier" : (it.kind === "alarm" ? "Alarm" : "Cache");
    if(!Number.isFinite(it.r)) it.r = 22;
    if(!Number.isFinite(it.uses)) it.uses = it.kind === "cache" ? 1 : 99;
    if(!Number.isFinite(it.cooldownUntil)) it.cooldownUntil = 0;
    if(!Number.isFinite(it.activeUntil)) it.activeUntil = 0;
    if(!Number.isFinite(it.effectR)) it.effectR = it.kind === "barricade" ? barricadeEffectRadius() : 0;
    if(it.kind === "barricade") it.effectR = barricadeEffectRadius();
  }
  if(Array.isArray(S.supportUnits) && S.supportUnits.length > 16){
    S.supportUnits = S.supportUnits.slice(0,16);
  }

  if(!S.tigers || !S.tigers.length) spawnTigers();
  if(!S.civilians || !S.civilians.length) spawnCivilians();
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!window.__TUTORIAL_MODE__ && (!Array.isArray(S.mapInteractables) || !S.mapInteractables.length)){
    spawnMapInteractables();
  }
  validateMissionSpawnLayout({ repair:true });
  transitionCleanupSweep("init");
  if(missionStateLooksEmpty()){
    deploy({ carryStats:true, hp:S.hp, armor:S.armor });
  }
  checkProgressionUnlocks({ silent:true });

  awardDailyLogin();
  bindAttackButtonGestures();
  maybeRenderHUD(true);
  safeTick("bootDrawMapScene", drawMapScene);
  safeTick("bootDrawAtmosphere", ()=>drawAtmosphericParallax(Date.now()));
  safeTick("bootDrawEntities", drawEntities);
  safeTick("bootDrawMobileUiClearLane", drawMobileUiClearLane);
  if(!__drawLoopStarted){
    __drawLoopStarted = true;
    requestAnimationFrame(draw);
  }
  openLaunchIntro(true);
}

function bootstrap(){
  try{
    init();
    window.__TS_BOOT_OK__ = true;
  }catch(err){
    try{ console.error("Startup recovered from init error:", err); }catch(e){}
    try{
      const keepMode = ["Story","Arcade","Survival"].includes(S?.mode) ? S.mode : DEFAULT.mode;
      const keepMapIndex = Number.isFinite(S?.mapIndex) ? S.mapIndex : 0;
      const keepWallets = normalizeModeWallets(S?.modeWallets, S?.funds, keepMode);
      S = cloneState(DEFAULT);
      S.mode = keepMode;
      S.mapIndex = keepMapIndex;
      S.modeWallets = keepWallets;
      bindFundsWallet(S);
      syncWindowState();
      resizeCanvasForViewport();
      applyTouchHudSettings();
      deploy();
      maybeRenderHUD(true);
      safeTick("recoverDrawMapScene", drawMapScene);
      safeTick("recoverDrawAtmosphere", ()=>drawAtmosphericParallax(Date.now()));
      safeTick("recoverDrawEntities", drawEntities);
      safeTick("recoverDrawUiLane", drawMobileUiClearLane);
      if(!__drawLoopStarted){
        __drawLoopStarted = true;
        requestAnimationFrame(draw);
      }
      window.__TS_BOOT_OK__ = true;
      toast("Recovered from startup error. Mission reloaded.");
      save(true);
    }catch(recoverErr){
      try{ console.error("Startup recovery failed:", recoverErr); }catch(e){}
    }
  }
}

bootstrap();


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
window.togglePerformanceMode = togglePerformanceMode;
window.toggleLagMonitor = toggleLagMonitor;
window.openHudCustomizer = openHudCustomizer;
window.closeHudCustomizer = closeHudCustomizer;
window.updateHudCustomizerSetting = updateHudCustomizerSetting;
window.applyHudPreset = applyHudPreset;
window.resetHudCustomizer = resetHudCustomizer;
window.openAbout = openAbout;
window.closeAbout = closeAbout;

window.openMode = openMode;
window.closeMode = closeMode;
window.pickProgressGuardAction = pickProgressGuardAction;
window.setMode = setMode;
window.openLaunchIntro = openLaunchIntro;
window.beginFromLaunchIntro = beginFromLaunchIntro;
window.startQuickTutorialFromLaunchIntro = startQuickTutorialFromLaunchIntro;
window.skipLaunchIntro = skipLaunchIntro;
window.openStoryIntro = openStoryIntro;
window.startStoryIntroMission = startStoryIntroMission;
window.beginStoryMissionFromIntro = beginStoryMissionFromIntro;
window.startQuickTutorialFromIntro = startQuickTutorialFromIntro;
window.skipStoryIntro = skipStoryIntro;
window.toggleChapterRecap = toggleChapterRecap;
window.closeMissionBrief = closeMissionBrief;

window.nextMap = nextMap;
window.togglePause = togglePause;

window.openShop = openShop;
window.closeShop = closeShop;
window.shopTab = shopTab;

window.openInventory = openInventory;
window.closeInventory = closeInventory;
window.openShopFromInventory = openShopFromInventory;
window.toggleMobileMenu = toggleMobileMenu;

window.resetGame = resetGame;
window.deploy = deploy;
window.scan = scan;
window.startCombat = startCombat;

window.useMedkit = useMedkit;
window.setSelectedMedkit = setSelectedMedkit;
window.useArmorPlate = useArmorPlate;
window.setSelectedArmorPlate = setSelectedArmorPlate;
window.useRepairKit = useRepairKit;
window.placeTrap = placeTrap;
window.callBackup = callBackup;
window.sprint = sprint;
window.activateShield = activateShield;
window.takeoverEscort = takeoverEscort;
window.useNearestCache = useNearestCache;

window.playerAction = playerAction;
window.endBattle = endBattle;
window.rollDodge = rollDodge;
window.cycleWeapon = cycleWeapon;

window.startNextMission = startNextMission;
window.restartCurrentMission = restartCurrentMission;
window.restartModeFromMission1 = restartModeFromMission1;
window.closeComplete = closeComplete;

// Shop functions that your HTML calls
window.buyWeapon = buyWeapon;
window.buyAmmo = buyAmmo;
window.buyArmor = buyArmor;
window.buyMed = buyMed;
window.buyTool = buyTool;
window.buyShield = buyShield;
window.buyCashBundle = buyCashBundle;
window.buyTigerSpecialist = buyTigerSpecialist;
window.buyRescueSpecialist = buyRescueSpecialist;
window.buyReinforcementBundle = buyReinforcementBundle;
window.reviveSoldier = reviveSoldier;
window.reviveAllSoldiers = reviveAllSoldiers;
window.buyStoryBaseUpgrade = buyStoryBaseUpgrade;
window.buyStorySpecialistPerk = buyStorySpecialistPerk;
window.buyTrap = buyTrap;
window.openStarsTopUp = openStarsTopUp;
window.buyWithStars = buyWithStars;
window.claimPendingStarsPurchase = claimPendingStarsPurchase;
window.clearPendingStarsPurchase = clearPendingStarsPurchase;
window.awardDailyLogin = awardDailyLogin;
window.equipWeapon = equipWeapon;
window.openQuickWeaponPicker = openQuickWeaponPicker;
window.closeQuickWeaponPicker = closeQuickWeaponPicker;
window.selectQuickWeapon = selectQuickWeapon;
window.buyPerk = buyPerk;
window.lockNearestTiger = lockNearestTiger;
window.canAttemptCapture = canAttemptCapture;
window.tutorialCaptureWindowReady = tutorialCaptureWindowReady;
window.tutorialAnyCaptureWindowReady = tutorialAnyCaptureWindowReady;
