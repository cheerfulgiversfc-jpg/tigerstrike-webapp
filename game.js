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
  shields:1,
  shieldUntil:0,
  abilityCooldowns:{ scan:0, sprint:0, shield:0 },
  soldierAttackersOwned:0,
  soldierRescuersOwned:0,

  backupCooldown:0, backupActive:0,

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
progressionUnlocks: {}
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
    if(m.lives==null) m.lives=3;
    m.v = 4380;
    trimPersistentState(m);
    return m;
  }catch(e){ return structuredClone(DEFAULT); }
}
// ===================== SAVE (THROTTLED — FIXES IOS FREEZE) =====================
const SAVE_MIN_INTERVAL_MS = 4200;
const SAVE_AUTOSAVE_MS = 12000;
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
const MAP_CACHE_INTERVAL_MS = 42;
let __mapFrameCacheCanvas = null;
let __mapFrameCacheCtx = null;
let __mapFrameCacheSig = "";
let __mapFrameCacheAt = 0;

function invalidateMapCache(){
  __mapFrameCacheSig = "";
  __mapFrameCacheAt = 0;
}

function flushSaveNow(){
  __lastSave = Date.now();
  __savePending = false;
  localStorage.setItem("ts_v4380", JSON.stringify(buildPersistedState()));
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

function runFrameTask(key, intervalMs, fn){
  const now = Date.now();
  if(now < (__frameTaskGate[key] || 0)) return false;
  __frameTaskGate[key] = now + intervalMs;
  fn();
  return true;
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
    ? Math.round(clamp(vh * 0.92, 500, 680))
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
  for(const it of (S.mapInteractables || [])){
    it.x = clamp(it.x, 70, cv.width - 70);
    it.y = clamp(it.y, 90, cv.height - 80);
  }
}
function resizeCanvasForViewport(){
  const mobile = isMobileViewport();
  cv.width = mobile ? 820 : 960;
  cv.height = mobile ? mobileCanvasHeight() : 540;
  clampWorldToCanvas();
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
const SOLDIER_PRICE = 15000;
const ABILITY_COOLDOWN_MS = { scan:6800, sprint:5200, shield:12000 };
const ABILITY_WHEEL = [
  { key:"scan", icon:"🛰️", color:"rgba(96,165,250,.95)" },
  { key:"sprint", icon:"⚡", color:"rgba(245,158,11,.95)" },
  { key:"shield", icon:"🛡️", color:"rgba(74,222,128,.95)" },
];
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
function shieldActiveNow(){ return Date.now() < (S.shieldUntil||0); }
function civilianShielded(c){
  if(!c || !shieldActiveNow()) return false;
  return dist(S.me.x, S.me.y, c.x, c.y) <= SHIELD_RADIUS;
}

resizeCanvasForViewport();
window.addEventListener("resize", ()=>{
  resizeCanvasForViewport();
  applyMobileMenuState(__mobileMenuHiddenPref);
  renderHUD();
}, { passive:true });
window.addEventListener("orientationchange", ()=>{
  resizeCanvasForViewport();
  applyMobileMenuState(__mobileMenuHiddenPref);
  renderHUD();
});
initMobileMenuToggle();
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
function equippedWeapon(){ return getWeapon(S.equippedWeaponId) || WEAPONS[0]; }
function equippedWeaponRange(){ return equippedWeapon()?.range || 112; }
function captureWindowHp(t){ return Math.max(1, Math.ceil((t?.hpMax || 0) * 0.25)); }

function currentMap(){
  const list = MODE_MAPS[S.mode] || MODE_MAPS.Story;
  return list[clamp(S.mapIndex,0,list.length-1)];
}
function nextMap(){
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
function blockedAt(x, y, radius){
  for(const carcass of (S.carcasses || [])){
    if(rectCircleCollide(carcass.x - 14, carcass.y - 8, 28, 16, x, y, radius)) return true;
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
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(S.pickups.length >= MAX_PERSIST_PICKUPS) S.pickups.shift();
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
function openStoryIntro(force=false){
  if(S.mode!=="Story" || window.__TUTORIAL_MODE__) return;
  if(!force && S.storyIntroSeen) return;
  const overlay = document.getElementById("storyIntroOverlay");
  if(!overlay) return;
  setPaused(true,"story-intro");
  overlay.style.display = "flex";
  syncGamepadFocus();
}
function startStoryIntroMission(){
  const overlay = document.getElementById("storyIntroOverlay");
  if(overlay) overlay.style.display = "none";
  S.storyIntroSeen = true;
  setPaused(false,null);
  save();
  syncGamepadFocus();
}
function setMode(m){
  const wantsStoryIntro = (m==="Story" && !window.__TUTORIAL_MODE__);
  S.mode=m; S.lives=3;
  if(m==="Arcade") S.arcadeLevel=1;
  if(m==="Survival"){ S.survivalWave=1; S.survivalStart=Date.now(); S.surviveSeconds=0; }
  if(m==="Story") S.storyLevel=1;
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
  if(S.mode==="Story") el.innerText="Story Campaign: 100 missions with chapter objectives, mission-based bosses, and chapter-end cutscenes.";
  else if(S.mode==="Arcade") el.innerText="Arcade Campaign: 100 missions in 10 chapters. Objective text, tiger/civilian counts, boss fights, and special rules are mission-based.";
  else el.innerText="Survival: no civilians. Tigers pressure-damage you. Events OFF.";
}

// ===================== Shop / Inventory =====================
let currentShopTab="weapons";

function openShop(){
  if(!tutorialAllows("shop")) return toast(tutorialBlockMessage("shop"));
  if(S.gameOver) return;
  const fromBattle = !!S.inBattle;
  if(S.missionEnded){ lastOverlay="complete"; document.getElementById("completeOverlay").style.display="none"; }
  setPaused(true, fromBattle ? "shop-battle" : "shop");
  document.getElementById("shopOverlay").style.display="flex";
  if(fromBattle && !anyLethalWeaponHasAmmo()) currentShopTab = "ammo";
  shopTab(currentShopTab); sfx("ui");
  if(fromBattle) setBattleMsg("Combat paused in Shop. Buy ammo or weapons, then tap Resume.");
}
function closeShop(){
  document.getElementById("shopOverlay").style.display="none";
  if(lastOverlay==="complete" && S.missionEnded){
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
  if(lastOverlay==="complete" && S.missionEnded){
    setPaused(true,"complete");
    document.getElementById("completeOverlay").style.display="flex";
    lastOverlay=null; return;
  }
  setPaused(false,null);
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
    note.innerText="Repair kits restore weapon durability. Shield protects escorts. Specialists cost $15,000 each.";
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
    const attackerCard = `
      <div class="item">
        <div>
          <div class="itemName">Tiger Specialist <span class="tag">Owned: ${S.soldierAttackersOwned||0}</span></div>
          <div class="itemDesc">Frontline tiger-killer. Can die in combat, then must be repurchased.</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${SOLDIER_PRICE.toLocaleString()}</div>
          <button onclick="buyTigerSpecialist()">Buy</button>
        </div>
      </div>`;
    const rescueCard = `
      <div class="item">
        <div>
          <div class="itemName">Search & Rescue Specialist <span class="tag">Owned: ${S.soldierRescuersOwned||0}</span></div>
          <div class="itemDesc">Finds civilians and helps guide them toward the safe zone.</div>
        </div>
        <div style="text-align:right">
          <div class="price">$${SOLDIER_PRICE.toLocaleString()}</div>
          <button onclick="buyRescueSpecialist()">Buy</button>
        </div>
      </div>`;
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
    list.innerHTML = attackerCard + rescueCard + shieldCard + repairCards;
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
function buyShield(){
  if(S.funds < SHIELD_PRICE) return toast("Not enough money.");
  S.funds -= SHIELD_PRICE;
  S.shields = (S.shields||0) + 1;
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyTigerSpecialist(){
  if((S.soldierAttackersOwned||0) >= 8) return toast("Tiger specialist roster is full.");
  if(S.funds < SOLDIER_PRICE) return toast("Not enough money.");
  S.funds -= SOLDIER_PRICE;
  S.soldierAttackersOwned = (S.soldierAttackersOwned||0) + 1;
  if(!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
    const attackCount = (S.supportUnits || []).filter(unit => unit.role === "attacker").length;
    if(attackCount < 8) S.supportUnits.push(createSupportUnit("attacker", attackCount));
  }
  toast("Tiger specialist hired.");
  sfx("ui"); hapticImpact("light");
  save(); renderShopList(); renderHUD();
}
function buyRescueSpecialist(){
  if((S.soldierRescuersOwned||0) >= 8) return toast("Rescue specialist roster is full.");
  if(S.funds < SOLDIER_PRICE) return toast("Not enough money.");
  S.funds -= SOLDIER_PRICE;
  S.soldierRescuersOwned = (S.soldierRescuersOwned||0) + 1;
  if(!window.__TUTORIAL_MODE__ && !S.gameOver && !S.missionEnded){
    const rescueCount = (S.supportUnits || []).filter(unit => unit.role === "rescue").length;
    if(rescueCount < 8) S.supportUnits.push(createSupportUnit("rescue", rescueCount));
  }
  toast("Rescue specialist hired.");
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
     <b>Equipped:</b> ${w.name} • <b>Durability:</b> ${Math.round(weaponDurability(w.id))}% • <b>Ammo:</b> ${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[ammoId]||0}) • <b>Shields:</b> ${S.shields||0}<br>
     <b>Squad:</b> Attack ${S.soldierAttackersOwned||0} • Rescue ${S.soldierRescuersOwned||0}`;

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
    <div class="item" style="padding:10px 12px;">
      <div>
        <div class="itemName">Progression</div>
        <div class="itemDesc"><b>Level:</b> ${S.level} • <b>XP:</b> ${S.xp}/${xpNeededForLevel(S.level)} • <b>Perk Points:</b> ${S.perkPoints}</div>
        <div class="itemDesc"><b>Unlocks:</b> ${progressionUnlockCount()}/${PROGRESSION_UNLOCKS.length} • ${progressText}</div>
      </div>
    </div>
    ${unlockHtml}

    <div class="divider"></div>
    <div class="hudTitle">Perks</div>
    ${perkHtml}
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
    S._tutorialSnapshot = structuredClone(S);
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

  ["battleOverlay","shopOverlay","invOverlay","completeOverlay","overOverlay","weaponQuickOverlay","storyIntroOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });

  if(snapshot){
    S = snapshot;
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
    return {
      x: rand(minX, maxX),
      y: rand(minY, maxY),
      r
    };
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
      best = { x:zx, y:zy, nearest };
    }
  }

  return {
    x: clamp(Math.round(best?.x ?? rand(minX, maxX)), minX, maxX),
    y: clamp(Math.round(best?.y ?? rand(minY, maxY)), minY, maxY),
    r
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

function mapInteractablePool(){
  const w = cv.width;
  const h = cv.height;
  const key = currentMapKey();
  const pools = {
    ST_FOREST: [
      { kind:"alarm", label:"Siren Tree", x:w*0.20, y:h*0.14 },
      { kind:"barricade", label:"Trail Gate", x:w*0.54, y:h*0.56 },
      { kind:"cache", label:"Ranger Cache", x:w*0.84, y:h*0.79 }
    ],
    ST_SUBURBS: [
      { kind:"alarm", label:"Street Alarm", x:w*0.17, y:h*0.23 },
      { kind:"barricade", label:"Blockade Switch", x:w*0.58, y:h*0.50 },
      { kind:"cache", label:"Garage Cache", x:w*0.83, y:h*0.72 }
    ],
    ST_DOWNTOWN: [
      { kind:"alarm", label:"Tower Siren", x:w*0.16, y:h*0.22 },
      { kind:"barricade", label:"Barrier Console", x:w*0.60, y:h*0.53 },
      { kind:"cache", label:"Service Crate", x:w*0.82, y:h*0.78 }
    ],
    ST_INDUSTRIAL: [
      { kind:"alarm", label:"Plant Alarm", x:w*0.18, y:h*0.22 },
      { kind:"barricade", label:"Steel Gate", x:w*0.56, y:h*0.50 },
      { kind:"cache", label:"Dock Cache", x:w*0.84, y:h*0.76 }
    ],
    AR_ARENA_BAY: [
      { kind:"alarm", label:"Arena Siren", x:w*0.18, y:h*0.26 },
      { kind:"barricade", label:"Bay Gate", x:w*0.56, y:h*0.50 },
      { kind:"cache", label:"Pit Cache", x:w*0.83, y:h*0.74 }
    ],
    AR_NEON_GRID: [
      { kind:"alarm", label:"Neon Beacon", x:w*0.17, y:h*0.24 },
      { kind:"barricade", label:"Grid Wall", x:w*0.58, y:h*0.48 },
      { kind:"cache", label:"Arc Cache", x:w*0.82, y:h*0.70 }
    ],
    AR_SAND_YARD: [
      { kind:"alarm", label:"Dust Alarm", x:w*0.20, y:h*0.18 },
      { kind:"barricade", label:"Dune Barrier", x:w*0.55, y:h*0.52 },
      { kind:"cache", label:"Yard Cache", x:w*0.84, y:h*0.77 }
    ],
    AR_STEEL_PIT: [
      { kind:"alarm", label:"Steel Horn", x:w*0.19, y:h*0.23 },
      { kind:"barricade", label:"Pit Lock", x:w*0.57, y:h*0.50 },
      { kind:"cache", label:"Steel Cache", x:w*0.83, y:h*0.73 }
    ]
  };
  const fallback = [
    { kind:"alarm", label:"Alert Beacon", x:w*0.18, y:h*0.18 },
    { kind:"barricade", label:"Barrier Node", x:w*0.56, y:h*0.54 },
    { kind:"cache", label:"Supply Cache", x:w*0.84, y:h*0.78 }
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
  S.mapInteractables = base.map((it, idx)=>({
    id: `INT-${idx+1}`,
    kind: it.kind,
    label: it.label,
    x: it.x,
    y: it.y,
    r: 22,
    uses: it.kind === "cache" ? 1 : 99,
    cooldownUntil: 0,
    activeUntil: 0,
    effectR: it.kind === "barricade" ? barricadeEffectRadius() : 0
  }));
}

function findInteractableAt(x,y){
  const items = S.mapInteractables || [];
  for(const it of items){
    const tapR = (it.r || 22) + 10;
    if(dist(x,y,it.x,it.y) <= tapR) return it;
  }
  return null;
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
  setEventText(`🔥 ${kind==="capture" ? "Capture" : "Rescue"} combo x${chain}: +$${bonusCash} +${bonusXp}XP`, 2.5);
  __savePending = true;
}

function createSupportUnit(role, slotIndex=0){
  const attacker = role === "attacker";
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
    hp: attacker ? 185 : 145,
    hpMax: attacker ? 185 : 145,
    armor: attacker ? 95 : 50,
    fireAt:0,
    guideAt:0,
    alive:true
  };
}

function spawnSupportUnits(){
  S.supportUnits = [];
  if(window.__TUTORIAL_MODE__) return;

  const attackers = clamp(Math.floor(S.soldierAttackersOwned || 0), 0, 8);
  const rescuers = clamp(Math.floor(S.soldierRescuersOwned || 0), 0, 8);

  for(let i=0;i<attackers;i++){
    S.supportUnits.push(createSupportUnit("attacker", i));
  }
  for(let i=0;i<rescuers;i++){
    S.supportUnits.push(createSupportUnit("rescue", i));
  }
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
    S.civilians.push({
      id:i+1,
      x:clamp(site.x + jitterX, 60, cv.width - 60),
      y:clamp(site.y + jitterY, 90, cv.height - 70),
      hp:100,
      hpMax:100,
      alive:true,
      evac:false,
      following:false,
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
      rageOn:false,
      burstUntil:0,
      nextPounceAt:0,
      enragedUntil:0,
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
  const storyBossCount = storyMission?.bossTwin ? 2 : (storyBoss ? 1 : 0);
  const arcadeBoss=!!(arcadeMission && arcadeMission.boss);
  const arcadeBossCount = arcadeMission?.bossTwin ? 2 : (arcadeBoss ? 1 : 0);
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
      hp = Math.round(hp * (storyMission.finalBoss ? 3.1 : (storyMission.bossTwin ? 2.0 : 2.25)));
      bossPhases = storyMission.finalBoss ? 3 : (storyMission.bossTwin ? 1 : 2);
    } else if(arcadeBoss && i < arcadeBossCount){
      hp = Math.round(hp * (arcadeMission.finalBoss ? 2.9 : (arcadeMission.bossTwin ? 2.0 : 2.3)));
      bossPhases = arcadeMission.finalBoss ? 3 : (arcadeMission.bossTwin ? 1 : 2);
    }

    const pack = packAnchors[i % packAnchors.length];
    const theta = (Math.PI * 2 * (i % 3)) / 3;
    const radius = 24 + ((i % 2) * 20);
    const initialVx = (Math.random()<0.5?-1:1)*def.spd*0.55;
    const initialVy = (Math.random()<0.5?-1:1)*def.spd*0.50;

    S.tigers.push({
      id:i+1,
      type:def.key,
      x:clamp(Math.round(pack.x + Math.cos(theta) * radius + rand(-12,12)), 140, cv.width - 50),
      y:clamp(Math.round(pack.y + Math.sin(theta) * radius + rand(-12,12)), 90, cv.height - 70),
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
      rageOn:false,
      burstUntil:0,
      nextPounceAt:0,
      enragedUntil:0,
      wanderAngle:Math.random()*(Math.PI*2),
      heading:Math.atan2(initialVy, initialVx),
      drawDir:initialVx >= 0 ? 1 : -1,
      gaitState:"walk",
      gaitBlend:0
    });
  }
}

function spawnRogueTiger(){
  if(!Array.isArray(S.tigers)) S.tigers = [];

  const aliveCount = S.tigers.reduce((n, t)=>n + (t?.alive ? 1 : 0), 0);
  const maxAlive = (S.mode === "Survival") ? 14 : 10;
  if(aliveCount >= maxAlive) return null;

  const typeKey = pickTigerType();
  const def = TIGER_TYPES.find((t)=>t.key===typeKey) || TIGER_TYPES[1];
  const diff = carcassDifficulty();

  let baseHp = 110;
  if(S.mode==="Arcade") baseHp = 122 + (S.arcadeLevel - 1) * 7;
  if(S.mode==="Survival") baseHp = 135 + (S.survivalWave - 1) * 10;
  if(S.mode==="Story") baseHp = 116 + (S.storyLevel - 1) * 4;
  const hp = Math.round(baseHp * def.hpMul * diff);

  const spawnEdge = rand(0, 3);
  let sx = 0;
  let sy = 0;
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

  const nextId = (S.tigers.reduce((maxId, t)=>{
    const tid = Number(t?.id);
    return Number.isFinite(tid) ? Math.max(maxId, tid) : maxId;
  }, 0) + 1);

  const tiger = {
    id: nextId,
    type: def.key,
    x: clamp(Math.round(sx), 70, cv.width - 70),
    y: clamp(Math.round(sy), 90, cv.height - 70),
    vx:(Math.random()<0.5?-1:1)*def.spd*0.58,
    vy:(Math.random()<0.5?-1:1)*def.spd*0.54,
    hp,
    hpMax:hp,
    alive:true,
    packId:rand(1,4),
    aggroBoost:0.18,
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
    rageOn:false,
    burstUntil:0,
    nextPounceAt:0,
    enragedUntil:0,
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
function deploy(){
  resizeCanvasForViewport();
  invalidateMapCache();
  for(const k of Object.keys(__frameTaskGate)) delete __frameTaskGate[k];
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
  S.shields = 1;
  S.shieldUntil = 0;
  ensureAbilityCooldownState();
  S.abilityCooldowns.scan = 0;
  S.abilityCooldowns.sprint = 0;
  S.abilityCooldowns.shield = 0;

  if(S.mode!=="Survival") S.evacZone = null;
  S.backupActive=0;
  S._escortSlotById = {};

  // phase 1
  S.fogUntil = 0;
  S.eventText = "";
  S.eventCooldown = 240;
  S.pickups = [];
  S.supportUnits = [];
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
  S._arcadeNoKillWarned = false;
  S._storyFinalOutcome = null;
  checkProgressionUnlocks({ silent:true });

  spawnRescueSites();
  spawnMapInteractables();
  spawnSupportUnits();
  spawnTigers();
  spawnCivilians();
  if(S.mode!=="Survival" && !window.__TUTORIAL_MODE__){
    S.evacZone = randomEvacZone(S.civilians);
  }

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
    }
  }

  if(S.mode==="Arcade"){
    const mission = arcadeCampaignMission(S.arcadeLevel);
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

  save();
}

function startNextMission(){
  document.getElementById("completeOverlay").style.display="none";
  const wasStoryFinal = (S.mode==="Story" && S.storyLevel >= STORY_CAMPAIGN_OBJECTIVES.length);
  const wasArcadeFinal = (S.mode==="Arcade" && S.arcadeLevel >= ARCADE_CAMPAIGN_OBJECTIVES.length);
  if(S.mode==="Story"){
    S.storyLevel = Math.min(S.storyLevel + 1, STORY_CAMPAIGN_OBJECTIVES.length);
  }
  if(S.mode==="Arcade"){
    S.arcadeLevel = Math.min(S.arcadeLevel + 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  }
  if(S.mode==="Survival") S.survivalWave += 1;
  deploy();
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

function closeComplete(){ document.getElementById("completeOverlay").style.display="none"; }

function resetGame(){
  localStorage.removeItem("ts_v4380");
  localStorage.removeItem("ts_v4371");
  S = structuredClone(DEFAULT);
  syncWindowState();
  ["shopOverlay","invOverlay","weaponQuickOverlay","storyIntroOverlay","aboutOverlay","completeOverlay","overOverlay","modeOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });
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

  const overlays = ["storyIntroOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay","weaponQuickOverlay"]
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
  const ids = ["tutorialOverlay","storyIntroOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay","weaponQuickOverlay"];
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
    activateShield();
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
  if(S.stamina < STAMINA_COST_SCAN) return toast("Not enough stamina.");
  S.stamina -= STAMINA_COST_SCAN;
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

  const dx = ((KEY_STATE.right ? 1 : 0) - (KEY_STATE.left ? 1 : 0)) + TOUCH_STICK.dx + GAMEPAD_STATE.lx;
  const dy = ((KEY_STATE.down ? 1 : 0) - (KEY_STATE.up ? 1 : 0)) + TOUCH_STICK.dy + GAMEPAD_STATE.ly;
  if(!dx && !dy) return false;
  if(S.stamina<=0) return false;

  const len = Math.hypot(dx,dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let speed=PLAYER_WALK_SPEED;

  if(S._sprintTicks && S._sprintTicks>0){
    speed=PLAYER_SPRINT_SPEED;
    S._sprintTicks--;
  }

  S.target=null;
  S.me.face = Math.atan2(uy, ux);
  S.me.step = (S.me.step + speed*0.35) % (Math.PI*2);

  const nx = S.me.x + ux*speed;
  const ny = S.me.y + uy*speed;
  tryMoveEntity(S.me, nx, ny, 16);

  S.stamina = clamp(S.stamina - (speed>PLAYER_WALK_SPEED ? STAMINA_DRAIN_SPRINT : STAMINA_DRAIN_WALK), 0, 100);
  return true;
}

function movePlayer(){
  if(!S.target) return;
  const dx=S.target.x-S.me.x, dy=S.target.y-S.me.y;
  const d=Math.hypot(dx,dy);
  if(d<6){ S.target=null; return; }
  if(S.stamina<=0) return;

  let speed=PLAYER_WALK_SPEED;
  if(S._sprintTicks && S._sprintTicks>0){ speed=PLAYER_SPRINT_SPEED; S._sprintTicks--; }

  S.me.face = Math.atan2(dy, dx);
  S.me.step = (S.me.step + speed*0.35) % (Math.PI*2);

  const nx = S.me.x + (dx/d)*speed;
  const ny = S.me.y + (dy/d)*speed;

  const ok = tryMoveEntity(S.me, nx, ny, 16);
  if(!ok){ S.target=null; }

  S.stamina = clamp(S.stamina - (speed>PLAYER_WALK_SPEED ? STAMINA_DRAIN_SPRINT : STAMINA_DRAIN_WALK), 0, 100);
}

function sprint(){
  if(S.paused || S.missionEnded || S.gameOver) return toast("Not now.");
  if(abilityOnCooldown("sprint")) return toast(`Sprint cooling down (${abilityCooldownLabel("sprint")}).`);
  if(S.stamina < STAMINA_COST_SPRINT) return toast("Not enough stamina.");
  S.stamina -= STAMINA_COST_SPRINT;
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

function damageSupportUnit(unit, dmg){
  if(!unit || !unit.alive || dmg <= 0) return;
  if(unit.armor > 0){
    const absorbed = Math.min(unit.armor, dmg * 0.8);
    unit.armor = Math.max(0, unit.armor - absorbed);
    dmg = Math.max(0, dmg - absorbed);
  }
  if(dmg > 0){
    unit.hp = Math.max(0, unit.hp - dmg);
  }
  if(unit.hp > 0) return;

  unit.alive = false;
  if(unit.role === "attacker" && !unit._rosterDeducted){
    unit._rosterDeducted = true;
    S.soldierAttackersOwned = Math.max(0, (S.soldierAttackersOwned||0) - 1);
    toast("Tiger specialist down. Repurchase in Shop.");
  } else if(unit.role === "rescue"){
    toast("Rescue specialist down.");
  }
  hapticNotif("warning");
  save();
}

function supportUnitsTick(){
  if(S.inBattle || S.paused || S.gameOver || S.missionEnded) return;
  if(!S.supportUnits?.length) return;

  const now = Date.now();
  if(now < (S._supportTickAt || 0)) return;
  S._supportTickAt = now + 50; // ~20fps for support AI to reduce mobile stalls

  const liveCivs = (S.mode==="Survival") ? [] : S.civilians.filter(c=>c.alive && !c.evac);
  const followCivs = liveCivs.filter(c=>c.following);
  const activeTigers = S.tigers.filter(t=>t.alive);

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
    for(const civ of followCivs){
      const d = dist(ux, uy, civ.x, civ.y);
      if(d < bestD){ bestD = d; best = civ; }
    }
    return { civ: best, d: bestD };
  };

  for(const unit of (S.supportUnits || [])){
    if(!unit.alive) continue;

    unit.step = (unit.step || 0) + 0.08;
    unit.homeX = S.me.x;
    unit.homeY = S.me.y;

    let targetX = unit.homeX + Math.cos(unit.step * 0.6) * 18;
    let targetY = unit.homeY + Math.sin(unit.step * 0.7) * 14;

    if(unit.role === "rescue" && followCivs.length){
      let targetCiv = (S.dangerCivId && followCivs.find(c=>c.id===S.dangerCivId)) || null;
      if(!targetCiv){
        targetCiv = nearestCivTo(unit.x, unit.y).civ;
      }

      if(targetCiv){
        const civDist = dist(unit.x, unit.y, targetCiv.x, targetCiv.y);
        if(civDist > 74){
          targetX = targetCiv.x;
          targetY = targetCiv.y;
        } else {
          targetX = (targetCiv.x + S.me.x + S.evacZone.x) / 3;
          targetY = (targetCiv.y + S.me.y + S.evacZone.y) / 3;

          if(now >= (unit.guideAt || 0)){
            unit.guideAt = now + 120;
            const gdx = S.evacZone.x - targetCiv.x;
            const gdy = S.evacZone.y - targetCiv.y;
            const gd = Math.hypot(gdx, gdy) || 1;
            const guideSpeed = Math.min(1.45, gd);
            tryMoveEntity(targetCiv, targetCiv.x + (gdx / gd) * guideSpeed, targetCiv.y + (gdy / gd) * guideSpeed, 14);
            targetCiv.hp = clamp(targetCiv.hp + 0.03, 0, targetCiv.hpMax);
          }
        }
      }
    } else if(unit.role === "attacker" && activeTigers.length){
      const nearest = nearestTigerTo(unit.x, unit.y);
      if(nearest.tiger && nearest.d < 330){
        targetX = nearest.tiger.x;
        targetY = nearest.tiger.y;
      }
    }

    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const stepCap = unit.role === "attacker" ? 2.05 : 1.9;
    const step = Math.min(stepCap, len);
    unit.face = Math.atan2(dy, dx);
    tryMoveEntity(unit, unit.x + (dx / len) * step, unit.y + (dy / len) * step, 16);

    for(const tiger of activeTigers){
      const tigerDist = dist(unit.x, unit.y, tiger.x, tiger.y);

      if(unit.role === "attacker"){
        if(tigerDist < 190 && Date.now() >= (unit.fireAt || 0)){
          unit.fireAt = Date.now() + rand(380, 620);
          const shotDmg = rand(4,8) + (tigerDist < 95 ? 2 : 0);
          tiger.hp = clamp(tiger.hp - shotDmg, 0, tiger.hpMax);
          tiger.aggroBoost = clamp((tiger.aggroBoost||0) + 0.05, 0, 1.4);
          if(tiger.hp <= 0){
            finishTigerKill(tiger);
            break;
          }
        }
        if(tigerDist < 74){
          damageSupportUnit(unit, rand(4,7) * 0.55);
        }
      } else if(unit.role === "rescue"){
        if(tigerDist < 76){
          damageSupportUnit(unit, rand(4,8));
        }
      }
    }
  }

  S.supportUnits = (S.supportUnits || []).filter(unit => unit.alive).slice(0, 16);
}

// ===================== CIVILIANS FOLLOW-ONLY =====================
function followCiviliansTick(){
  if(S.mode==="Survival") return;
  const playerSpeed = (S._sprintTicks && S._sprintTicks > 0) ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED;
  const engageDist = 58;
  const followMaxDist = 360;
  const face = Number.isFinite(S.me.face) ? S.me.face : 0;
  const activeFollowers = [];

  for(const c of S.civilians){
    if(!c.alive || c.evac) continue;

    const toPlayer = dist(c.x, c.y, S.me.x, S.me.y);
    if(!c.following){
      if(toPlayer <= engageDist){
        c.following = true;
      } else {
        continue;
      }
    }

    if(toPlayer > followMaxDist){
      c.following = false;
      continue;
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
    const sp = Math.min(Math.max(playerSpeed * 1.02, 2.35) + catchup, PLAYER_SPRINT_SPEED + 1.5);
    const vx = (dx/dd) * sp;
    const vy = (dy/dd) * sp;
    if(Math.hypot(vx, vy) > 0.02){
      c.face = Math.atan2(vy, vx);
      c.step = (c.step || 0) + clamp(Math.hypot(vx, vy) * 0.11, 0.04, 0.30);
    }
    tryMoveEntity(c, c.x + vx, c.y + vy, 14);
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
      awardCombo("rescue");
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

    if(bd < 64){
      underAttack++;

      const base = 0.12;
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
      const shieldMult = civilianShielded(best) ? 0 : 1;
      const dmg = base * multType * rageMult * (1 + (diff-1)*0.20) * guardMult * protectMult * shieldMult;
      best.hp = clamp(best.hp - (dmg * perkCivMul()), 0, best.hpMax);
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
  const fading = (t.type==="Stalker" && now < (t.fadeUntil||0)) ? 1 : 0;
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

  for(const t of S.tigers){
    if(!t.alive) continue;

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
    const civs = (S.mode!=="Survival") ? S.civilians.filter(c=>c.alive && !c.evac) : [];
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

    let chase = Number.isFinite(targetDist) && (
      targetDist < motion.detect ||
      (now < (t.enragedUntil||0) && targetDist < motion.detect + 80)
    );
    if(t.type==="Stalker" && now < (t.fadeUntil||0) && Number.isFinite(targetDist) && targetDist < motion.detect + 90){
      chase = true;
    }
    if(!chase){
      t.aggroBoost = Math.max(0, (t.aggroBoost||0) - 0.004);
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

    if(chase && td > 22){
      if((t.nextPounceAt||0) - now < 220 && td > 90 && td < 330) setTigerIntent(t, "Pounce", 360);
      if(now >= (t.nextPounceAt||0) && td > 92 && td < 330 && Math.random() < motion.pounceChance){
        t.heading = Math.atan2(uy, ux);
        const px = Math.cos(t.heading);
        const py = Math.sin(t.heading);
        t.vx += px * motion.pounceForce;
        t.vy += py * motion.pounceForce;
        t.burstUntil = now + rand(motion.burstMs[0], motion.burstMs[1]);
        t.nextPounceAt = now + rand(motion.pounceCd[0], motion.pounceCd[1]);
        setTigerIntent(t, "Pounce", 520);
      }

      const accel = motion.chaseAccel + (now < (t.burstUntil||0) ? 0.04 : 0);
      const align = clamp((hx * ux) + (hy * uy), -1, 1);
      const forwardAccel = accel * (0.76 + Math.max(0, align) * 0.58);
      const steerAssist = motion.steerGain * (1 - Math.max(0, align));
      t.vx += (hx * forwardAccel) + (ux * steerAssist);
      t.vy += (hy * forwardAccel) + (uy * steerAssist);

      const vel = Math.hypot(t.vx, t.vy);
      if(vel < motion.minChase){
        const push = (motion.minChase - vel) * 0.18;
        t.vx += ux * push;
        t.vy += uy * push;
      }
    } else {
      t.wanderAngle += (Math.random()-0.5) * 0.19;
      const wx = Math.cos(t.wanderAngle);
      const wy = Math.sin(t.wanderAngle);
      const jitter = 0.30 + Math.random()*0.42;
      const align = clamp((hx * wx) + (hy * wy), -1, 1);
      const forwardAccel = motion.wanderAccel * (0.56 + Math.max(0, align) * 0.65) * jitter;
      t.vx += (hx * forwardAccel) + (wx * motion.wanderAccel * 0.18);
      t.vy += (hy * forwardAccel) + (wy * motion.wanderAccel * 0.18);
    }

    if(t.packId){
      const mates = S.tigers.filter(x => x.alive && x.packId === t.packId && x.id !== t.id);
      if(mates.length){
        const packX = mates.reduce((sum, x) => sum + x.x, 0) / mates.length;
        const packY = mates.reduce((sum, x) => sum + x.y, 0) / mates.length;
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
    if(now < (t.burstUntil||0)) speedCap = Math.max(speedCap, motion.sprint);
    if(t.type==="Scout" && now < (t.dashUntil||0)) speedCap = Math.max(speedCap, motion.sprint + 0.35);
    if(t.type==="Berserker" && t.rageOn) speedCap = Math.max(speedCap, motion.sprint * 1.06);

    const velNow = Math.hypot(t.vx, t.vy);
    if(velNow > speedCap){
      const s = speedCap / (velNow || 1);
      t.vx *= s;
      t.vy *= s;
    }

    const moved = tryMoveEntity(t, t.x + t.vx, t.y + t.vy, 18);
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
  if(shieldActiveNow()){
    dmg = Math.floor(dmg * 0.20);
    if(dmg <= 0){
      if(showToast) toast("🛡️ Shield absorbed the hit.");
      return;
    }
  }
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
  if(COMBAT_FX.length >= 64){
    COMBAT_FX.splice(0, COMBAT_FX.length - 63);
  }
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
  const canCap = canAttemptCapture(t);
  const canAtk = anyLethalWeaponHasAmmo();

  [["touchAttackBtn", !canAtk], ["combatAttackBtn", !canAtk]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });
  [["touchCaptureBtn", !canCap], ["combatCaptureBtn", !canCap]].forEach(([id, disabled])=>{
    const el = document.getElementById(id);
    if(el) el.disabled = disabled;
  });

  const prevLabel = combatWeaponLabel(-1);
  const nextLabel = combatWeaponLabel(1);
  const prevDesktop = document.getElementById("combatPrevWeaponBtn");
  const nextDesktop = document.getElementById("combatNextWeaponBtn");
  if(prevDesktop) prevDesktop.innerText = `◀️ ${prevLabel}`;
  if(nextDesktop) nextDesktop.innerText = `${nextLabel} ▶️`;
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
  const t=canEngage();
  if(!lockedTiger()) return toast("Lock a tiger first.");
  if(!t) return toast("Move closer to the locked tiger and tap it again.");
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
    ? `${t.type} • Capture at 25% HP or lower`
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
function updateBattleButtons(){
  const t=tigerById(S.activeTigerId);
  const killBtn = document.getElementById("killBtn");
  const capBtn = document.getElementById("capBtn");
  if(killBtn) killBtn.disabled = !(t && t.hp<=15);
  if(capBtn) capBtn.disabled = !canAttemptCapture(t);
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
  markStoryFinalBossOutcome("KILL", t);
  t.alive=false;
  breakCombo("tiger killed");
  S.carcasses.push({ x:t.x, y:t.y });
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
    if(t.hp > captureWindowHp(t)) return toast("Capture is available when the tiger is at 25% HP or lower.");
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
      if(w.type==="tranq"){
        t.hp = clamp(t.hp - dmg, 1, t.hpMax);
      }else{
        t.hp = clamp(t.hp - dmg, 0, t.hpMax);
      }
      emitCombatFx(S.me.x, S.me.y - 6, t.x, t.y, w.type==="tranq" ? "rgba(96,165,250,.96)" : "rgba(245,247,255,.96)", crit ? 4 : 3);
      hapticImpact(crit ? "heavy" : "light");
      setBattleMsg(`${crit?'CRIT! ':''}Hit for ${dmg}. ${w.type==='tranq'?'(tranq applied)':''}`);
    }

    if(t.hp<=0){
      finishTigerKill(t);
      return;
    }
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

function tigerTurn(t, softened=false){
  if(!t.alive) return;
  const diff=carcassDifficulty();
  const persona = tigerPersonalityProfile(t);

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
  if(persona.key==="Hunter") dmg = Math.round(dmg * 1.08);
  if(persona.key==="Sentinel") dmg = Math.round(dmg * 0.94);
  if(persona.key==="Fury" && (t.hp/t.hpMax) < 0.55) dmg = Math.round(dmg * 1.10);
  if(persona.key==="Ambusher" && Date.now() < (t.burstUntil||0)) dmg = Math.round(dmg * 1.08);
  if(softened) dmg=Math.floor(dmg*0.85);
  dmg=clamp(dmg,6,75);
  setTigerIntent(t, "Strike", 440);

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
  const rangeLimit = equippedWeaponRange();
  if(d > rangeLimit){
    endBattle("RETREAT");
    S.lockedTigerId = null;
    toast(`${equippedWeapon().name} lost range. Tap that tiger again when you get back in range.`);
    save(true);
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
      if(S._underAttack===0) unlockAchv("clear_clean","Clean Clear");
      let heading = "Mission complete!\n";
      if(storyMission){
        heading = `Story Mission ${storyMission.number}/100 — ${storyMission.chapterName}\n${storyMission.objective}\n`;
      } else if(arcadeMission){
        heading = `Arcade Mission ${arcadeMission.number}/100 — ${arcadeMission.chapterName}\n${arcadeMission.objective}\n`;
      }

      let chapterCutscene = "";
      if(storyMission && STORY_CHAPTER_CUTSCENES[storyMission.number]){
        chapterCutscene = `\nCutscene: ${STORY_CHAPTER_CUTSCENES[storyMission.number]}\n`;
      }

      let finalEnding = "";
      if(storyMission?.number === 100){
        const choseCapture = S._storyFinalOutcome === "CAPTURE";
        finalEnding = choseCapture
          ? "\nFinal Choice: You captured the Ancient Tiger.\nEnding: Preservation ending unlocked.\nRewards Unlocked: Legendary Commander Rank • Golden Soldier Skin • Endless Jungle Mode\n"
          : "\nFinal Choice: You killed the Ancient Tiger.\nEnding: Dominance ending unlocked.\nRewards Unlocked: Legendary Commander Rank • Golden Soldier Skin • Endless Jungle Mode\n";
      }

      document.getElementById("completeText").innerText =
        `${heading}${chapterCutscene}${finalEnding}\n• Tigers Killed: ${S.stats.kills}\n• Tigers Captured: ${S.stats.captures}\n• Civilians Evacuated: ${S.stats.evac}\n• Traps Set: ${S.stats.trapsPlaced||0}\n• Trap Stops: ${S.stats.trapsTriggered||0}\n• Cash Earned: $${S.stats.cashEarned.toLocaleString()}\n• Shots Fired: ${S.stats.shots}\n\nYou can Shop/Inventory and then start next mission.`;
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
  const shieldSecs = Math.max(0, Math.ceil(((S.shieldUntil||0) - Date.now()) / 1000));
  const shieldLabel = shieldActiveNow() ? `${S.shields||0} • ACTIVE (${shieldSecs}s)` : `${S.shields||0}`;
  document.getElementById("shieldTxt").innerText = shieldLabel;

  const backupStr = (S.backupActive>0) ? `ACTIVE (${Math.ceil(S.backupActive/60)}s)` : (S.backupCooldown>0 ? `Cooldown (${Math.ceil(S.backupCooldown/60)}s)` : "Ready");
  document.getElementById("backupTxt").innerText = `${backupStr} • Squad A:${S.soldierAttackersOwned||0} R:${S.soldierRescuersOwned||0}`;
  const shieldDisabled = S.paused || S.missionEnded || S.gameOver || (S.shields||0)<=0 || abilityOnCooldown("shield");
  document.querySelectorAll("[data-shield-btn]").forEach((btn)=>{ btn.disabled = shieldDisabled; });

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
  const storyMission = (S.mode==="Story") ? storyCampaignMission(S.storyLevel) : null;
  const arcadeMission = (S.mode==="Arcade") ? arcadeCampaignMission(S.arcadeLevel) : null;
  const storyObjective = storyMission ? `${storyMission.objective}${storyObjectiveProgressText(storyMission)}` : "";
  const arcadeObjective = arcadeMission ? `${arcadeMission.objective}${arcadeObjectiveProgressText(arcadeMission)}` : "";
  document.getElementById("objTxt").innerText =
    (S.mode==="Survival")
      ? `Objective: Survive • Loot spawns • Traps hold tigers • Carcasses block movement`
      : (S.mode==="Story")
        ? `Objective: ${storyObjective}${grace}`
      : (S.mode==="Arcade")
        ? `Objective: ${arcadeObjective}${grace}`
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
  if((S.comboCount || 0) > 0){
    const left = Math.max(0, Math.ceil(((S.comboExpireAt || 0) - Date.now()) / 1000));
    assistParts.push(`Combo x${S.comboCount}${left ? ` (${left}s)` : ""}`);
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
          ? `Mission ${arcadeMission.number}/100 • Ch ${arcadeMission.chapter}`
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

    document.getElementById("statusLine").innerText =
      S.inBattle
        ? (S.battleMsg || `On-map combat active. Use Attack, Capture, weapon swap, and Retreat while Tiger #${S.activeTigerId} stays locked.`)
        : (window.matchMedia?.("(pointer:fine)")?.matches
            ? "Desktop: click the tiger you want. If it is close enough, combat starts right away. WASD or arrows move. Q locks nearest. Space scans. E engages the locked tiger. Tap map devices to trigger alarms, barriers, and caches."
            : "Agent and Mission stay above the map. Use the joystick to move, then tap the tiger you want. If it is in range, the fight starts and your combat buttons appear. Tap map devices for alarms, barriers, and caches.");
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
  if(force || (now - __lastHudRender) >= 240){
    __lastHudRender = now;
    renderHUD();
  }
}

// ===================== CALM MAPS + FOG (no flashing) =====================
function drawMapScene(){
  const frameNow = Date.now();
  const w=cv.width, h=cv.height;
  const key=currentMap().key;
  const missionIndex = S.mode==="Story"
    ? (S.storyLevel||1)
    : (S.mode==="Arcade" ? (S.arcadeLevel||1) : (S.survivalWave||1));
  const ez = S.evacZone || DEFAULT.evacZone;
  const cacheSig = [
    key, w, h, S.mode, missionIndex, S.mapIndex || 0, window.__TUTORIAL_MODE__ ? 1 : 0,
    Math.round(ez.x || 0), Math.round(ez.y || 0), Math.round(ez.r || 0),
    (S.trapsPlaced || []).length, (S.scanPing || 0) > 0 ? 1 : 0, frameNow < (S.fogUntil || 0) ? 1 : 0
  ].join("|");
  const canUseCache =
    !!__mapFrameCacheCanvas &&
    __mapFrameCacheSig === cacheSig &&
    (frameNow - __mapFrameCacheAt) < MAP_CACHE_INTERVAL_MS;
  if(canUseCache){
    ctx.drawImage(__mapFrameCacheCanvas, 0, 0, w, h);
    return;
  }

  const themeKey =
    (key==="ST_FOREST" || key==="AR_SAND_YARD" || key==="SV_NIGHT_WOODS") ? "ST_FOREST" :
    (key==="ST_SUBURBS" || key==="AR_ARENA_BAY" || key==="SV_ASH_FIELD") ? "ST_SUBURBS" :
    (key==="ST_DOWNTOWN" || key==="AR_NEON_GRID" || key==="SV_STORM_DISTRICT") ? "ST_DOWNTOWN" :
    "ST_INDUSTRIAL";

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
  function drawProp(p){
    const px = p.x * (w / 960);
    const py = p.y * (h / 540);
    const s = p.s || 1;
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

  if(key==="ST_FOREST" || key==="AR_SAND_YARD" || key==="SV_NIGHT_WOODS"){
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
  else if(key==="ST_DOWNTOWN" || key==="AR_NEON_GRID" || key==="SV_STORM_DISTRICT"){
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

  // ambient atmospheric depth by mission progression
  const phase = missionIndex % 4;
  if(phase===1){
    ctx.fillStyle="rgba(255,220,150,.06)";
    ctx.fillRect(0,0,w,h);
  } else if(phase===2){
    ctx.fillStyle="rgba(120,165,255,.05)";
    ctx.fillRect(0,0,w,h);
  } else if(phase===3){
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,"rgba(210,220,255,.11)");
    g.addColorStop(0.35,"rgba(120,135,170,.05)");
    g.addColorStop(1,"rgba(8,12,20,.02)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);
  }

  // realism props
  const props = MAP_REALISM_PROPS[themeKey] || [];
  for(const p of props) drawProp(p);

  // subtle vignette to reduce flatness
  const vignette = ctx.createRadialGradient(w*0.5, h*0.48, h*0.25, w*0.5, h*0.5, h*0.85);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0,0,w,h);

  if(S.mode!=="Survival"){
    const pulse = 0.86 + Math.sin(Date.now() / 240) * 0.08;
    const ex = S.evacZone.x;
    const ey = S.evacZone.y;
    const er = S.evacZone.r;

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
    ctx.strokeStyle = "rgba(74,222,128,.95)";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(ex,ey,er,0,Math.PI*2); ctx.stroke();

    ctx.strokeStyle = "rgba(167,243,208,.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8,6]);
    ctx.beginPath(); ctx.arc(ex,ey,er-9,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // center safe marker
    ctx.fillStyle = "rgba(74,222,128,.9)";
    rounded(ex-14, ey-14, 28, 28, 8, "rgba(74,222,128,.24)", "rgba(74,222,128,.95)");
    ctx.fillStyle = "rgba(220,255,235,.95)";
    ctx.fillRect(ex-2, ey-9, 4, 18);
    ctx.fillRect(ex-9, ey-2, 18, 4);

    // label
    rounded(ex-56, ey-er-30, 112, 24, 12, "rgba(16,56,34,.92)", "rgba(74,222,128,.95)");
    ctx.fillStyle = "rgba(220,255,235,.98)";
    ctx.font = "900 11px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("SAFE ZONE", ex, ey-er-14);
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

function drawCivilian(c){
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
}

function drawSoldier(){
  const step = S.me.step || 0;
  const bob = Math.sin(step) * 1.5;
  const x = S.me.x;
  const y = S.me.y + bob;
  const ang = S.me.face || 0;
  const dir = Math.cos(ang) >= 0 ? 1 : -1;
  const stride = Math.sin(step * 1.9) * 2.1;
  const lean = clamp(Math.sin(ang) * 0.06, -0.1, 0.1);

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
  ctx.rotate(lean);

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

function drawSupportUnit(unit){
  const bob = Math.sin(unit.step || 0) * 1.2;
  const x = unit.x;
  const y = unit.y + bob;
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

  if(now < (S.fogUntil||0)) alpha *= 0.75;
  if(t.type==="Stalker" && now < (t.fadeUntil||0)){
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
  let s=1.0;
  if(t.type==="Scout") s=0.85;
  if(t.type==="Alpha") s=1.22;
  if(t.type==="Berserker") s=1.10;
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

  ctx.globalAlpha=0.85*alpha;
  ctx.fillStyle="rgba(245,247,255,.80)";
  ctx.font="900 12px system-ui";
  const dash = (t.type==="Scout" && now<(t.dashUntil||0)) ? " (DASH)" : "";
  const fade = (t.type==="Stalker" && now<(t.fadeUntil||0)) ? " (FADE)" : "";
  const roar = (t.type==="Alpha" && now<(t.roarUntil||0)) ? " (ROAR)" : "";
  const rage = (t.type==="Berserker" && (t.hp/t.hpMax)<0.35) ? " (RAGE)" : "";
  const persona = t.personality ? ` • ${t.personality}` : "";
  ctx.fillText(t.type + persona + (t.tranqTagged?" (tranq)":"") + dash + fade + roar + rage, x-44*s, y-44*s);
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
  drawCombatFx();
}

// ===================== MISSION FLOW =====================

// ===================== MAIN LOOP =====================
function draw(){
  try{
    if(document.hidden){
      maybeAutosave();
      return;
    }
    pollGamepadControls();
    refreshControllerUi();
    maybeRenderHUD();
    updateEngage();

    if(!(S.gameOver || S.paused || S.missionEnded)){
      regen();
      runFrameTask("backupTick", 42, backupTick);
      runFrameTask("trapTick", 34, trapTick);
      runFrameTask("mapInteractableTick", 64, mapInteractableTick);
      runFrameTask("comboTick", 110, comboTick);

      if(!window.TigerTutorial?.isRunning){
        runFrameTask("tickEvents", 180, tickEvents);
        runFrameTask("ambientPickup", 300, maybeSpawnAmbientPickup);
        runFrameTask("tickPickups", 46, tickPickups);
      }

      runFrameTask("roamTigers", 34, roamTigers);
      supportUnitsTick();
      const usedKeyboard = keyboardMoveTick();
      if(!usedKeyboard) movePlayer();
      clearOutOfRangeLock();
      runFrameTask("followCivilians", 40, followCiviliansTick);
      runFrameTask("evacCheck", 58, evacCheck);
      runFrameTask("civThreats", 72, tickCiviliansAndThreats);
      runFrameTask("survivalPressure", 86, survivalPressureTick);
      combatTick();
      runFrameTask("combatFx", 24, tickCombatFx);
      checkMissionComplete();
    }

    drawMapScene();
    drawEntities();
    maybeAutosave();
  }catch(err){
    const now = Date.now();
    if((window.__tsFrameErrAt || 0) + 2500 < now){
      window.__tsFrameErrAt = now;
      console.error("Frame loop recovered from error:", err);
    }
  }finally{
    requestAnimationFrame(draw);
  }
}

// ===================== INIT =====================
function init(){
  S.storyLevel = clamp(Math.floor(S.storyLevel || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  S.arcadeLevel = clamp(Math.floor(S.arcadeLevel || 1), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  trimPersistentState(S);
  if(typeof S.storyIntroSeen !== "boolean") S.storyIntroSeen = false;
  if(!Array.isArray(S.ownedWeapons) || !S.ownedWeapons.length) S.ownedWeapons = [...DEFAULT.ownedWeapons];
  if(!S.equippedWeaponId || !getWeapon(S.equippedWeaponId)) S.equippedWeaponId = DEFAULT.equippedWeaponId;
  if(!S.ammoReserve || typeof S.ammoReserve !== "object") S.ammoReserve = { ...DEFAULT.ammoReserve };
  if(!S.mag || typeof S.mag !== "object") S.mag = { ...DEFAULT.mag };
  if(!Array.isArray(S.tigers)) S.tigers = [];
  if(!Array.isArray(S.civilians)) S.civilians = [];
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!Array.isArray(S.rescueSites)) S.rescueSites = [];
  if(!Array.isArray(S.supportUnits)) S.supportUnits = [];
  if(!Array.isArray(S.mapInteractables)) S.mapInteractables = [];
  if(!S.evacZone) S.evacZone = { ...DEFAULT.evacZone };
  if(!Number.isFinite(S.shields)) S.shields = 1;
  if(!Number.isFinite(S.shieldUntil)) S.shieldUntil = 0;
  ensureAbilityCooldownState();
  if(!Number.isFinite(S.soldierAttackersOwned)) S.soldierAttackersOwned = 0;
  if(!Number.isFinite(S.soldierRescuersOwned)) S.soldierRescuersOwned = 0;
  if(!Number.isFinite(S.comboCount)) S.comboCount = 0;
  if(!Number.isFinite(S.comboBest)) S.comboBest = 0;
  if(!Number.isFinite(S.comboExpireAt)) S.comboExpireAt = 0;
  if(!S.progressionUnlocks || typeof S.progressionUnlocks !== "object") S.progressionUnlocks = {};
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
    if(!Number.isFinite(t.enragedUntil)) t.enragedUntil = 0;
    if(!Number.isFinite(t.heading)) t.heading = Math.atan2(t.vy || Math.sin(t.wanderAngle || 0), t.vx || Math.cos(t.wanderAngle || 0));
    if(!Number.isFinite(t.drawDir)) t.drawDir = (Math.cos(t.heading) >= 0 ? 1 : -1);
    if(typeof t.gaitState !== "string") t.gaitState = "walk";
    if(!Number.isFinite(t.gaitBlend)) t.gaitBlend = 0;
  }
  for(const civ of (S.civilians || [])){
    if(typeof civ.following !== "boolean") civ.following = false;
    if(!Number.isFinite(civ.face)) civ.face = 0;
    if(!Number.isFinite(civ.step)) civ.step = 0;
  }
  for(const unit of (S.supportUnits || [])){
    if(!unit.role) unit.role = "attacker";
    if(!unit.name) unit.name = unit.role === "rescue" ? "Rescue Specialist" : "Tiger Specialist";
    if(!Number.isFinite(unit.hp)) unit.hp = unit.role === "rescue" ? 145 : 185;
    if(!Number.isFinite(unit.hpMax)) unit.hpMax = unit.hp;
    if(!Number.isFinite(unit.armor)) unit.armor = unit.role === "rescue" ? 50 : 95;
    if(unit.alive == null) unit.alive = true;
  }
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
  if(!S.civilians) spawnCivilians();
  if(!Array.isArray(S.pickups)) S.pickups = [];
  if(!window.__TUTORIAL_MODE__ && (!Array.isArray(S.mapInteractables) || !S.mapInteractables.length)){
    spawnMapInteractables();
  }
  checkProgressionUnlocks({ silent:true });

  awardDailyLogin();
  bindAttackButtonGestures();
  requestAnimationFrame(draw);
  if(S.mode === "Story" && !window.__TUTORIAL_MODE__) openStoryIntro(false);
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
window.openStoryIntro = openStoryIntro;
window.startStoryIntroMission = startStoryIntroMission;

window.nextMap = nextMap;
window.togglePause = togglePause;

window.openShop = openShop;
window.closeShop = closeShop;
window.shopTab = shopTab;

window.openInventory = openInventory;
window.closeInventory = closeInventory;
window.toggleMobileMenu = toggleMobileMenu;

window.resetGame = resetGame;
window.deploy = deploy;
window.scan = scan;
window.startCombat = startCombat;

window.useMedkit = useMedkit;
window.useRepairKit = useRepairKit;
window.placeTrap = placeTrap;
window.callBackup = callBackup;
window.sprint = sprint;
window.activateShield = activateShield;

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
window.buyShield = buyShield;
window.buyTigerSpecialist = buyTigerSpecialist;
window.buyRescueSpecialist = buyRescueSpecialist;
window.buyTrap = buyTrap;
window.awardDailyLogin = awardDailyLogin;
window.equipWeapon = equipWeapon;
window.openQuickWeaponPicker = openQuickWeaponPicker;
window.closeQuickWeaponPicker = closeQuickWeaponPicker;
window.selectQuickWeapon = selectQuickWeapon;
window.buyPerk = buyPerk;
window.lockNearestTiger = lockNearestTiger;
