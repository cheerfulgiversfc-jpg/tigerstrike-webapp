const tg = window.Telegram?.WebApp;
const TS_BUILD = "4466";
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
function tgUserInfo(){
  const user = tg?.initDataUnsafe?.user || null;
  const userId = Number(user?.id || 0);
  const username = String(user?.username || "").trim().replace(/^@+/, "");
  const firstName = String(user?.first_name || "").trim();
  const lastName = String(user?.last_name || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const handle = username ? `@${username}` : (fullName || (userId > 0 ? `Player ${userId}` : "Guest"));
  return {
    userId: Number.isFinite(userId) && userId > 0 ? userId : 0,
    username,
    firstName,
    lastName,
    fullName,
    handle,
  };
}

function normalizeClanTag(tag){
  const cleaned = String(tag || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 10);
}

function sanitizeClanName(name, fallbackTag = "SOLO"){
  const raw = String(name || "").replace(/\s+/g, " ").trim();
  if(raw) return raw.slice(0, 36);
  const tag = normalizeClanTag(fallbackTag) || "SOLO";
  return tag === "SOLO" ? "Lone Tigers" : `${tag} Clan`;
}

function defaultClanTagFromTelegram(state = S){
  const src = (state && typeof state === "object") ? state : S;
  const user = String(src?.telegramUsername || "").replace(/^@+/, "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if(user.length >= 3) return user.slice(0, 6);
  return "SOLO";
}

function ensureClanState(state = S){
  const src = (state && typeof state === "object") ? state : S;
  if(!src || typeof src !== "object") return { tag:"SOLO", name:"Lone Tigers" };
  const tag = normalizeClanTag(src.clanTag || defaultClanTagFromTelegram(src)) || "SOLO";
  src.clanTag = tag;
  src.clanName = sanitizeClanName(src.clanName, tag);
  src.clanRaidEnabled = !!src.clanRaidEnabled;
  if(!src.clanContractClaims || typeof src.clanContractClaims !== "object"){
    src.clanContractClaims = {};
  }
  if(!src.clanCloud || typeof src.clanCloud !== "object"){
    src.clanCloud = null;
  }
  if(!Number.isFinite(Number(src.clanLastSyncAt))){
    src.clanLastSyncAt = 0;
  }
  return { tag:src.clanTag, name:src.clanName };
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

const CONTRACTS_VERSION = 1;
const CONTRACT_DAILY_COUNT = 3;
const CONTRACT_WEEKLY_COUNT = 3;
const CONTRACT_REFRESH_THROTTLE_MS = 15000;
const LIVE_OPS_VERSION = 1;

const DEFAULT_CONTRACT_TALLIES = Object.freeze({
  missionsCleared:0,
  kills:0,
  captures:0,
  evac:0,
  shots:0,
  trapsPlaced:0,
  trapsTriggered:0,
  cashEarned:0,
});

const BALANCE_RECENT_MISSION_MAX = 18;
const BALANCE_FREEZE_WINDOW_MS = 10 * 60 * 1000;
const BALANCE_DEATH_WINDOW_MS = 20 * 60 * 1000;
const BALANCE_EVENT_HISTORY_MAX = 40;
const BALANCE_AUTOTUNE_MIN = 0.88;
const BALANCE_AUTOTUNE_MAX = 1.16;
const NEMESIS_ROSTER_MAX = 8;
const NEMESIS_RETURN_BASE_CHANCE = 0.42;
const NEMESIS_RETURN_MAX_CHANCE = 0.9;
const NEMESIS_MIN_MISSION_GAP = 1;
const NEMESIS_ESCAPED_BONUS_CASH_BASE = 500;
const NEMESIS_CAPTURE_BONUS_XP = 130;
const NEMESIS_KILL_BONUS_XP = 95;
const NEMESIS_NAME_PREFIX = Object.freeze([
  "Scar","Night","Ash","Iron","Dread","Ruin","Blood","Ghost","Storm","Fang"
]);
const NEMESIS_NAME_SUFFIX = Object.freeze([
  "claw","tooth","stalker","mane","hunter","shadow","snarl","reaper","prowler","maw"
]);
const MISSION_TWIST_TYPES = Object.freeze(["bridge","hostage","fog","blackout"]);
const MISSION_TWIST_ROLL_MIN_MS = 19000;
const MISSION_TWIST_ROLL_MAX_MS = 34000;
const MISSION_TWIST_COOLDOWN_MS = 12000;
const MISSION_TWIST_MAX_PER_MISSION = 3;
const MISSION_TWIST_BRIDGE_RADIUS_MIN = 58;
const MISSION_TWIST_BRIDGE_RADIUS_MAX = 84;
const MISSION_TWIST_BRIDGE_MIN_MS = 13000;
const MISSION_TWIST_BRIDGE_MAX_MS = 19000;
const MISSION_TWIST_HOSTAGE_MIN_MS = 14000;
const MISSION_TWIST_HOSTAGE_MAX_MS = 22000;
const MISSION_TWIST_FOG_MIN_MS = 10000;
const MISSION_TWIST_FOG_MAX_MS = 17000;
const MISSION_TWIST_BLACKOUT_MIN_MS = 10000;
const MISSION_TWIST_BLACKOUT_MAX_MS = 15000;
const ARCADE_BUILDCRAFT_DEFAULT_ID = "RESCUE";
const ARCADE_BUILDCRAFT_LOADOUTS = Object.freeze([
  Object.freeze({
    id:"RESCUE",
    icon:"🛟",
    name:"Rescue",
    summary:"Civilians move faster and take less damage.",
    pros:"+18% civilian follow speed • -16% civilian damage",
    cons:"-8% weapon damage",
    damageOutMul:0.92,
    critBonus:0.00,
    staminaDrainMul:1.00,
    civilianFollowMul:1.18,
    civilianDamageMul:0.84,
    trapRadiusMul:1.00,
    trapHoldMul:1.00,
    grant:{ medkits:{ M_SMALL:1 }, shields:1 }
  }),
  Object.freeze({
    id:"HUNTER",
    icon:"🎯",
    name:"Hunter",
    summary:"Higher damage and crit pressure for tiger takedowns.",
    pros:"+14% weapon damage • +3% crit chance",
    cons:"+8% stamina drain • civilians take +8% damage",
    damageOutMul:1.14,
    critBonus:0.03,
    staminaDrainMul:1.08,
    civilianFollowMul:0.96,
    civilianDamageMul:1.08,
    trapRadiusMul:0.96,
    trapHoldMul:0.96,
    grant:{ ammo:{ "9MM_STD":18, "556_STD":12 } }
  }),
  Object.freeze({
    id:"TRAP_MASTER",
    icon:"🪤",
    name:"Trap Master",
    summary:"Wider, longer trap control with utility supplies.",
    pros:"+32% trap radius • +35% trap hold duration",
    cons:"-6% weapon damage • +2% stamina drain",
    damageOutMul:0.94,
    critBonus:0.00,
    staminaDrainMul:1.02,
    civilianFollowMul:1.04,
    civilianDamageMul:0.96,
    trapRadiusMul:1.32,
    trapHoldMul:1.35,
    grant:{ traps:2, repairs:{ T_REPAIR:1 } }
  }),
]);
const ARCADE_BUILDCRAFT_BY_ID = Object.freeze(Object.fromEntries(
  ARCADE_BUILDCRAFT_LOADOUTS.map((def)=>[def.id, def])
));

const DAILY_CONTRACT_POOL = Object.freeze([
  Object.freeze({
    id:"D_EVAC_3",
    title:"Safe Corridor",
    desc:"Evacuate 3 civilians.",
    metric:"evac",
    target:3,
    reward:{ cash:650, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_CAPTURE_2",
    title:"Live Capture",
    desc:"Capture 2 tigers.",
    metric:"captures",
    target:2,
    reward:{ cash:800, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_KILL_2",
    title:"Threat Removal",
    desc:"Kill 2 tigers.",
    metric:"kills",
    target:2,
    reward:{ cash:700, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_MISSION_1",
    title:"Duty Complete",
    desc:"Clear 1 mission.",
    metric:"missionsCleared",
    target:1,
    reward:{ cash:950, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_SHOTS_20",
    title:"Weapons Drill",
    desc:"Fire 20 shots.",
    metric:"shots",
    target:20,
    reward:{ cash:550, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_TRAP_SET_2",
    title:"Trap Layer",
    desc:"Place 2 traps.",
    metric:"trapsPlaced",
    target:2,
    reward:{ cash:500, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_TRAP_STOP_2",
    title:"Containment",
    desc:"Trap-stop 2 tigers.",
    metric:"trapsTriggered",
    target:2,
    reward:{ cash:600, perkPoints:1 }
  }),
  Object.freeze({
    id:"D_CASH_2500",
    title:"Field Economy",
    desc:"Earn $2,500 mission cash.",
    metric:"cashEarned",
    target:2500,
    reward:{ cash:750, perkPoints:1 }
  }),
]);

const WEEKLY_CONTRACT_POOL = Object.freeze([
  Object.freeze({
    id:"W_EVAC_22",
    title:"Rescue Week",
    desc:"Evacuate 22 civilians.",
    metric:"evac",
    target:22,
    reward:{ cash:5000, perkPoints:3 }
  }),
  Object.freeze({
    id:"W_CAPTURE_12",
    title:"Research Pipeline",
    desc:"Capture 12 tigers.",
    metric:"captures",
    target:12,
    reward:{ cash:5600, perkPoints:3 }
  }),
  Object.freeze({
    id:"W_KILL_14",
    title:"Predator Control",
    desc:"Kill 14 tigers.",
    metric:"kills",
    target:14,
    reward:{ cash:5600, perkPoints:3 }
  }),
  Object.freeze({
    id:"W_MISSION_8",
    title:"Campaign Pace",
    desc:"Clear 8 missions.",
    metric:"missionsCleared",
    target:8,
    reward:{ cash:6800, perkPoints:4 }
  }),
  Object.freeze({
    id:"W_SHOTS_220",
    title:"Marksmanship Week",
    desc:"Fire 220 shots.",
    metric:"shots",
    target:220,
    reward:{ cash:3900, perkPoints:2 }
  }),
  Object.freeze({
    id:"W_TRAPS_14",
    title:"Field Engineer",
    desc:"Place 14 traps.",
    metric:"trapsPlaced",
    target:14,
    reward:{ cash:4100, perkPoints:2 }
  }),
  Object.freeze({
    id:"W_STOPS_10",
    title:"Net Control",
    desc:"Trap-stop 10 tigers.",
    metric:"trapsTriggered",
    target:10,
    reward:{ cash:4500, perkPoints:3 }
  }),
  Object.freeze({
    id:"W_CASH_26000",
    title:"War Chest",
    desc:"Earn $26,000 mission cash.",
    metric:"cashEarned",
    target:26000,
    reward:{ cash:7200, perkPoints:4 }
  }),
]);

const CLAN_CONTRACT_POOL = Object.freeze([
  Object.freeze({
    id:"C_EVAC_CONVOY",
    title:"Clan Convoy",
    desc:"Your clan evacuates civilians across operations this week.",
    metric:"evac",
    baseTarget:22,
    perMember:6,
    reward:{ cash:2600, perkPoints:1 }
  }),
  Object.freeze({
    id:"C_CAPTURE_GRID",
    title:"Capture Grid",
    desc:"Coordinate clan captures for research output.",
    metric:"captures",
    baseTarget:16,
    perMember:4,
    reward:{ cash:2800, perkPoints:1 }
  }),
  Object.freeze({
    id:"C_MISSION_DRIVE",
    title:"Mission Drive",
    desc:"Clear operations as a clan this week.",
    metric:"missionsCleared",
    baseTarget:12,
    perMember:3,
    reward:{ cash:3100, perkPoints:2 }
  }),
  Object.freeze({
    id:"C_CASH_CHAIN",
    title:"War Chest Chain",
    desc:"Accumulate mission cash as a clan.",
    metric:"cashEarned",
    baseTarget:22000,
    perMember:8500,
    reward:{ cash:3600, perkPoints:2 }
  }),
]);

const LIVE_OPS_POOL = Object.freeze([
  Object.freeze({
    id:"OPS_GREEN_CORRIDOR",
    title:"Operation Green Corridor",
    desc:"Evacuate 18 civilians in Story/Arcade operations this week.",
    metric:"evac",
    target:18,
    reward:{ cash:4600, perkPoints:2, medkits:2, shields:1 },
    modifiers:{ eventChanceMul:1.04, supplyWeightMul:1.16, rogueWeightMul:0.90, payoutMul:1.04 }
  }),
  Object.freeze({
    id:"OPS_IRON_NET",
    title:"Operation Iron Net",
    desc:"Trap-stop 9 tigers this week.",
    metric:"trapsTriggered",
    target:9,
    reward:{ cash:4200, perkPoints:2, traps:2, armorPlates:2 },
    modifiers:{ eventChanceMul:1.00, supplyWeightMul:0.96, rogueWeightMul:1.10, payoutMul:1.05 }
  }),
  Object.freeze({
    id:"OPS_SILENT_FANG",
    title:"Operation Silent Fang",
    desc:"Capture 10 tigers this week.",
    metric:"captures",
    target:10,
    reward:{ cash:5200, perkPoints:3, ammo:18 },
    modifiers:{ eventChanceMul:0.96, supplyWeightMul:0.94, rogueWeightMul:1.12, fogWeightMul:1.10, payoutMul:1.08 }
  }),
  Object.freeze({
    id:"OPS_SCORCHED_TRAIL",
    title:"Operation Scorched Trail",
    desc:"Kill 12 tigers this week.",
    metric:"kills",
    target:12,
    reward:{ cash:5000, perkPoints:2, armorPlates:2, shields:1 },
    modifiers:{ eventChanceMul:1.08, supplyWeightMul:0.88, rogueWeightMul:1.20, payoutMul:1.06 }
  }),
  Object.freeze({
    id:"OPS_WAR_CHEST",
    title:"Operation War Chest",
    desc:"Earn $28,000 mission cash this week.",
    metric:"cashEarned",
    target:28000,
    reward:{ cash:7400, perkPoints:3, medkits:2, traps:2, ammo:22 },
    modifiers:{ eventChanceMul:1.02, supplyWeightMul:1.08, bonusWeightMul:1.16, payoutMul:1.10 }
  }),
]);

function defaultContractTallies(){
  return { ...DEFAULT_CONTRACT_TALLIES };
}

function defaultBalanceStatsState(){
  return {
    deathsTotal:0,
    missionFailsTotal:0,
    freezeRecoverTotal:0,
    freezeSpikeTotal:0,
    missionsStartedTotal:0,
    missionsWonTotal:0,
    missionsFailedTotal:0,
    recentMissionResults:[],
    recentDeathAt:[],
    recentFreezeRecoverAt:[],
    recentFreezeSpikeAt:[],
    autoTune:1,
    lastMissionKey:"",
    activeMissionKey:"",
    missionStartAt:0,
    lastMissionResult:"",
    lastMissionResultAt:0,
    lastFreezeSpikeAt:0,
    lastFailRate:0,
    lastWinStreak:0,
    lastDeathsRecent:0,
    lastFreezePerMin:0,
    lastFreezeSpikesRecent:0,
    lastOutcomeSample:0,
    lastUpdatedAt:0,
  };
}

function defaultNemesisState(){
  return {
    seq: 0,
    lastSpawnMission: 0,
    lastSpawnId: "",
    lastBountyAt: 0,
    roster: [],
  };
}

function arcadeBuildcraftDef(id){
  return ARCADE_BUILDCRAFT_BY_ID[normalizeArcadeBuildcraftId(id)] || ARCADE_BUILDCRAFT_BY_ID[ARCADE_BUILDCRAFT_DEFAULT_ID];
}

function normalizeArcadeBuildcraftId(value){
  const id = String(value || "").trim().toUpperCase();
  return ARCADE_BUILDCRAFT_BY_ID[id] ? id : ARCADE_BUILDCRAFT_DEFAULT_ID;
}

function ensureArcadeBuildcraftState(state=S){
  if(!state || typeof state !== "object"){
    return ARCADE_BUILDCRAFT_DEFAULT_ID;
  }
  state.arcadeBuildcraftSelected = normalizeArcadeBuildcraftId(state.arcadeBuildcraftSelected || ARCADE_BUILDCRAFT_DEFAULT_ID);
  state.arcadeBuildcraftPending = normalizeArcadeBuildcraftId(state.arcadeBuildcraftPending || state.arcadeBuildcraftSelected);
  state.arcadeBuildcraftAppliedKey = String(state.arcadeBuildcraftAppliedKey || "");
  return state.arcadeBuildcraftPending;
}

function activeArcadeBuildcraftDef(state=S){
  ensureArcadeBuildcraftState(state);
  return arcadeBuildcraftDef(state.arcadeBuildcraftSelected);
}

function arcadeBuildcraftMul(key, fallback=1){
  if(normalizeModeName(S?.mode) !== "Arcade" || window.__TUTORIAL_MODE__) return fallback;
  const def = activeArcadeBuildcraftDef(S);
  const n = Number(def?.[key]);
  return Number.isFinite(n) ? n : fallback;
}

function arcadeBuildcraftCritBonus(){
  if(normalizeModeName(S?.mode) !== "Arcade" || window.__TUTORIAL_MODE__) return 0;
  const def = activeArcadeBuildcraftDef(S);
  return clamp(Number(def?.critBonus || 0), -0.05, 0.08);
}

function arcadeBuildcraftMissionKey(state=S){
  if(!state || normalizeModeName(state.mode) !== "Arcade") return "";
  const lvl = clamp(Math.floor(Number(state.arcadeLevel || 1)), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  const startedAt = Math.max(0, Math.floor(Number(state.arcadeMissionStartAt || 0)));
  return `arcade:${lvl}:${startedAt}`;
}

function prepareArcadeBuildcraftForMission(state=S){
  if(!state || normalizeModeName(state.mode) !== "Arcade" || window.__TUTORIAL_MODE__) return;
  ensureArcadeBuildcraftState(state);
  state.arcadeBuildcraftPending = normalizeArcadeBuildcraftId(state.arcadeBuildcraftSelected);
  state.arcadeBuildcraftAppliedKey = "";
}

function applyArcadeBuildcraftForMission(opts={}){
  if(normalizeModeName(S.mode) !== "Arcade" || window.__TUTORIAL_MODE__) return null;
  ensureArcadeBuildcraftState(S);
  const key = arcadeBuildcraftMissionKey(S);
  if(!key) return null;
  if(S.arcadeBuildcraftAppliedKey === key){
    return activeArcadeBuildcraftDef(S);
  }
  const id = normalizeArcadeBuildcraftId(S.arcadeBuildcraftPending || S.arcadeBuildcraftSelected);
  const def = arcadeBuildcraftDef(id);
  S.arcadeBuildcraftSelected = id;
  S.arcadeBuildcraftPending = id;
  S.arcadeBuildcraftAppliedKey = key;

  const grantRes = applyRewardGrant(def.grant || null);
  const grantSummary = grantRes?.changed ? ` • ${grantRes.summary}` : "";
  if(!opts.silent){
    setEventText(`${def.icon} ${def.name} loadout active. ${def.summary}${grantSummary}`, 5.5);
    toast(`Buildcraft active: ${def.name}.`);
    sfx("ui");
  }
  __savePending = true;
  return def;
}

function selectArcadeBuildcraft(id, opts={}){
  if(normalizeModeName(S.mode) !== "Arcade" || window.__TUTORIAL_MODE__) return;
  ensureArcadeBuildcraftState(S);
  const next = normalizeArcadeBuildcraftId(id);
  S.arcadeBuildcraftPending = next;
  renderArcadeBuildcraftBrief();
  if(!opts.silent){
    const def = arcadeBuildcraftDef(next);
    toast(`${def.icon} ${def.name} selected.`);
    sfx("ui");
  }
}

function defaultMissionTwistsState(){
  return {
    enabled: true,
    nextRollAt: 0,
    cooldownUntil: 0,
    triggerCount: 0,
    activeType: "",
    activeUntil: 0,
    used: {
      bridge: 0,
      hostage: 0,
      fog: 0,
      blackout: 0
    },
    bridge: {
      active: false,
      x: 0,
      y: 0,
      r: 68,
      until: 0
    },
    hostage: {
      active: false,
      siteId: 0,
      civId: 0,
      x: 0,
      y: 0,
      r: 48,
      until: 0,
      rescued: false,
      penaltyApplied: false
    },
    blackout: {
      active: false,
      until: 0
    }
  };
}

function ensureMissionTwistState(state=S){
  if(!state || typeof state !== "object"){
    return defaultMissionTwistsState();
  }
  const tw = (state.missionTwists && typeof state.missionTwists === "object")
    ? state.missionTwists
    : {};
  const base = defaultMissionTwistsState();
  tw.enabled = tw.enabled !== false;
  tw.nextRollAt = Math.max(0, Math.floor(Number(tw.nextRollAt || 0)));
  tw.cooldownUntil = Math.max(0, Math.floor(Number(tw.cooldownUntil || 0)));
  tw.triggerCount = clamp(Math.floor(Number(tw.triggerCount || 0)), 0, 99);
  tw.activeType = MISSION_TWIST_TYPES.includes(String(tw.activeType || ""))
    ? String(tw.activeType)
    : "";
  tw.activeUntil = Math.max(0, Math.floor(Number(tw.activeUntil || 0)));
  tw.used = (tw.used && typeof tw.used === "object") ? tw.used : {};
  for(const key of MISSION_TWIST_TYPES){
    tw.used[key] = Math.max(0, Math.floor(Number(tw.used[key] || 0)));
  }
  tw.bridge = (tw.bridge && typeof tw.bridge === "object") ? tw.bridge : {};
  tw.bridge.active = !!tw.bridge.active;
  tw.bridge.x = Number.isFinite(Number(tw.bridge.x)) ? Number(tw.bridge.x) : 0;
  tw.bridge.y = Number.isFinite(Number(tw.bridge.y)) ? Number(tw.bridge.y) : 0;
  tw.bridge.r = clamp(Number.isFinite(Number(tw.bridge.r)) ? Number(tw.bridge.r) : base.bridge.r, 24, 160);
  tw.bridge.until = Math.max(0, Math.floor(Number(tw.bridge.until || 0)));

  tw.hostage = (tw.hostage && typeof tw.hostage === "object") ? tw.hostage : {};
  tw.hostage.active = !!tw.hostage.active;
  tw.hostage.siteId = Math.max(0, Math.floor(Number(tw.hostage.siteId || 0)));
  tw.hostage.civId = Math.max(0, Math.floor(Number(tw.hostage.civId || 0)));
  tw.hostage.x = Number.isFinite(Number(tw.hostage.x)) ? Number(tw.hostage.x) : 0;
  tw.hostage.y = Number.isFinite(Number(tw.hostage.y)) ? Number(tw.hostage.y) : 0;
  tw.hostage.r = clamp(Number.isFinite(Number(tw.hostage.r)) ? Number(tw.hostage.r) : base.hostage.r, 20, 140);
  tw.hostage.until = Math.max(0, Math.floor(Number(tw.hostage.until || 0)));
  tw.hostage.rescued = !!tw.hostage.rescued;
  tw.hostage.penaltyApplied = !!tw.hostage.penaltyApplied;

  tw.blackout = (tw.blackout && typeof tw.blackout === "object") ? tw.blackout : {};
  tw.blackout.active = !!tw.blackout.active;
  tw.blackout.until = Math.max(0, Math.floor(Number(tw.blackout.until || 0)));

  // Mobile safety: disable all mission twists to prevent map blackout/fog artifacts
  // and reduce startup/transition CPU spikes.
  if(isMobileViewport()){
    tw.enabled = false;
    tw.activeType = "";
    tw.activeUntil = 0;
    tw.bridge.active = false;
    tw.bridge.until = 0;
    tw.hostage.active = false;
    tw.hostage.until = 0;
    tw.blackout.active = false;
    tw.blackout.until = 0;
    if(state && typeof state === "object"){
      state.fogUntil = 0;
    }
  }

  state.missionTwists = tw;
  return tw;
}

function resetMissionTwistsForDeploy(state=S, now=Date.now()){
  const tw = ensureMissionTwistState(state);
  tw.enabled = !isMobileViewport();
  tw.nextRollAt = now + rand(MISSION_TWIST_ROLL_MIN_MS, MISSION_TWIST_ROLL_MAX_MS);
  tw.cooldownUntil = now + rand(6200, 9800);
  tw.triggerCount = 0;
  tw.activeType = "";
  tw.activeUntil = 0;
  for(const key of MISSION_TWIST_TYPES){
    tw.used[key] = 0;
  }
  tw.bridge.active = false;
  tw.bridge.x = 0;
  tw.bridge.y = 0;
  tw.bridge.r = clamp(tw.bridge.r, MISSION_TWIST_BRIDGE_RADIUS_MIN, MISSION_TWIST_BRIDGE_RADIUS_MAX);
  tw.bridge.until = 0;
  tw.hostage.active = false;
  tw.hostage.siteId = 0;
  tw.hostage.civId = 0;
  tw.hostage.x = 0;
  tw.hostage.y = 0;
  tw.hostage.r = clamp(tw.hostage.r, 32, 80);
  tw.hostage.until = 0;
  tw.hostage.rescued = false;
  tw.hostage.penaltyApplied = false;
  tw.blackout.active = false;
  tw.blackout.until = 0;
  if(isMobileViewport() && state && typeof state === "object"){
    state.fogUntil = 0;
  }
  return tw;
}

function normalizeContractTalliesMap(raw){
  const out = defaultContractTallies();
  if(!raw || typeof raw !== "object") return out;
  for(const [metric, fallback] of Object.entries(DEFAULT_CONTRACT_TALLIES)){
    const n = Math.max(0, Math.floor(Number(raw[metric] ?? fallback ?? 0)));
    out[metric] = Number.isFinite(n) ? n : Math.max(0, Math.floor(Number(fallback || 0)));
  }
  return out;
}

function contractDayKey(nowMs=Date.now()){
  return ymdUTC(new Date(nowMs));
}

function contractWeekKey(nowMs=Date.now()){
  const now = new Date(nowMs);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const isoDay = dayStart.getUTCDay() || 7;
  dayStart.setUTCDate(dayStart.getUTCDate() + 4 - isoDay);
  const weekYear = dayStart.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((dayStart - yearStart) / 86400000) + 1) / 7);
  return `${weekYear}-W${String(week).padStart(2, "0")}`;
}

function nextUtcDayMs(nowMs=Date.now()){
  const now = new Date(nowMs);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
}

function nextUtcWeekMs(nowMs=Date.now()){
  const now = new Date(nowMs);
  const dayStartMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const isoDay = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const daysUntilNextMonday = 8 - isoDay;
  return dayStartMs + (daysUntilNextMonday * 86400000);
}

function contractCountdownText(period, nowMs=Date.now()){
  const nextAt = period === "weekly" ? nextUtcWeekMs(nowMs) : nextUtcDayMs(nowMs);
  const remainMs = Math.max(0, nextAt - nowMs);
  const totalMin = Math.max(0, Math.floor(remainMs / 60000));
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}h ${mm}m`;
}

function contractHashInt(str=""){
  let h = 2166136261;
  for(let i=0; i<str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function contractSeededPick(pool, count, seed){
  const arr = Array.isArray(pool) ? pool.slice() : [];
  let s = (seed >>> 0) || 1;
  const rand = ()=>{
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for(let i=arr.length - 1; i>0; i--){
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.max(0, Math.min(count, arr.length)));
}

function ensureContractTalliesState(state=S){
  if(!state || typeof state !== "object") return defaultContractTallies();
  state.contractTallies = normalizeContractTalliesMap(state.contractTallies);
  return state.contractTallies;
}

function contractMetricValue(metric, state=S){
  const tallies = ensureContractTalliesState(state);
  return Math.max(0, Math.floor(Number(tallies?.[metric] || 0)));
}

function generateContracts(period, key, state=S){
  const isWeekly = period === "weekly";
  const pool = isWeekly ? WEEKLY_CONTRACT_POOL : DAILY_CONTRACT_POOL;
  const take = isWeekly ? CONTRACT_WEEKLY_COUNT : CONTRACT_DAILY_COUNT;
  const tallies = ensureContractTalliesState(state);
  const seed = contractHashInt(`${period}|${key}|${tgUserKey()}`);
  const picks = contractSeededPick(pool, take, seed);
  const createdAt = Date.now();
  return picks.map((tpl, idx)=>{
    const baseline = contractMetricValue(tpl.metric, state);
    return {
      id: `${period}_${key}_${idx}_${tpl.id}`,
      key: tpl.id,
      title: tpl.title,
      desc: tpl.desc,
      metric: tpl.metric,
      target: Math.max(1, Math.floor(Number(tpl.target || 1))),
      baseline,
      reward: {
        cash: Math.max(0, Math.floor(Number(tpl.reward?.cash || 0))),
        perkPoints: Math.max(0, Math.floor(Number(tpl.reward?.perkPoints || 0))),
      },
      claimed: false,
      claimedAt: 0,
      createdAt,
      period,
    };
  });
}

function normalizeContractEntry(entry, state=S){
  if(!entry || typeof entry !== "object") return null;
  const metric = String(entry.metric || "").trim();
  if(!metric || !Object.prototype.hasOwnProperty.call(DEFAULT_CONTRACT_TALLIES, metric)) return null;
  const target = Math.max(1, Math.floor(Number(entry.target || 1)));
  const baseline = Math.max(0, Math.floor(Number(entry.baseline ?? contractMetricValue(metric, state))));
  return {
    id: String(entry.id || `${entry.period || "daily"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    key: String(entry.key || metric),
    title: String(entry.title || "Contract"),
    desc: String(entry.desc || "Complete this objective."),
    metric,
    target,
    baseline,
    reward: {
      cash: Math.max(0, Math.floor(Number(entry.reward?.cash || 0))),
      perkPoints: Math.max(0, Math.floor(Number(entry.reward?.perkPoints || 0))),
    },
    claimed: !!entry.claimed,
    claimedAt: Math.max(0, Math.floor(Number(entry.claimedAt || 0))),
    createdAt: Math.max(0, Math.floor(Number(entry.createdAt || Date.now()))),
    period: String(entry.period || "daily"),
  };
}

function ensureContractsState(state=S, opts={}){
  if(!state || typeof state !== "object") return false;
  ensureContractTalliesState(state);
  const now = Number(opts.now || Date.now());
  let changed = false;
  if(!state.contracts || typeof state.contracts !== "object"){
    state.contracts = {};
    changed = true;
  }
  if(!state.contracts.daily || typeof state.contracts.daily !== "object"){
    state.contracts.daily = {};
    changed = true;
  }
  if(!state.contracts.weekly || typeof state.contracts.weekly !== "object"){
    state.contracts.weekly = {};
    changed = true;
  }
  const dayKey = contractDayKey(now);
  const weekKey = contractWeekKey(now);
  const refreshDaily = state.contracts.daily.key !== dayKey;
  const refreshWeekly = state.contracts.weekly.key !== weekKey;

  if(refreshDaily){
    state.contracts.daily = {
      key: dayKey,
      resetAt: nextUtcDayMs(now),
      entries: generateContracts("daily", dayKey, state),
      refreshedAt: now,
    };
    changed = true;
  } else {
    state.contracts.daily.key = dayKey;
    state.contracts.daily.resetAt = nextUtcDayMs(now);
    const entries = Array.isArray(state.contracts.daily.entries) ? state.contracts.daily.entries : [];
    const normalized = entries.map((entry)=>normalizeContractEntry({ ...entry, period:"daily" }, state)).filter(Boolean);
    if(normalized.length !== entries.length){
      state.contracts.daily.entries = normalized;
      changed = true;
    } else {
      state.contracts.daily.entries = normalized;
    }
  }

  if(refreshWeekly){
    state.contracts.weekly = {
      key: weekKey,
      resetAt: nextUtcWeekMs(now),
      entries: generateContracts("weekly", weekKey, state),
      refreshedAt: now,
    };
    changed = true;
  } else {
    state.contracts.weekly.key = weekKey;
    state.contracts.weekly.resetAt = nextUtcWeekMs(now);
    const entries = Array.isArray(state.contracts.weekly.entries) ? state.contracts.weekly.entries : [];
    const normalized = entries.map((entry)=>normalizeContractEntry({ ...entry, period:"weekly" }, state)).filter(Boolean);
    if(normalized.length !== entries.length){
      state.contracts.weekly.entries = normalized;
      changed = true;
    } else {
      state.contracts.weekly.entries = normalized;
    }
  }

  state.contracts.version = CONTRACTS_VERSION;
  if(!Number.isFinite(Number(state.contracts.lastToastAt))) state.contracts.lastToastAt = 0;
  return changed;
}

function contractEntryProgress(entry, state=S){
  if(!entry || typeof entry !== "object") return 0;
  const metricNow = contractMetricValue(entry.metric, state);
  const baseline = Math.max(0, Math.floor(Number(entry.baseline || 0)));
  return Math.max(0, metricNow - baseline);
}

function contractEntryIsReady(entry, state=S){
  if(!entry || typeof entry !== "object") return false;
  return !entry.claimed && contractEntryProgress(entry, state) >= Math.max(1, Math.floor(Number(entry.target || 1)));
}

function contractRewardText(reward={}){
  const bits = [];
  const cash = Math.max(0, Math.floor(Number(reward.cash || 0)));
  const perks = Math.max(0, Math.floor(Number(reward.perkPoints || 0)));
  if(cash > 0) bits.push(`$${cash.toLocaleString()}`);
  if(perks > 0) bits.push(`+${perks} perk point${perks === 1 ? "" : "s"}`);
  return bits.join(" • ") || "No reward";
}

function contractSummary(period="daily", state=S){
  ensureContractsState(state);
  const bucket = state?.contracts?.[period];
  const entries = Array.isArray(bucket?.entries) ? bucket.entries : [];
  const total = entries.length;
  let claimed = 0;
  let ready = 0;
  for(const entry of entries){
    if(entry.claimed) claimed += 1;
    else if(contractEntryIsReady(entry, state)) ready += 1;
  }
  return {
    total,
    claimed,
    ready,
    remaining: Math.max(0, total - claimed),
    resetAt: Math.max(0, Number(bucket?.resetAt || 0)),
    key: String(bucket?.key || ""),
  };
}

function launchContractsSummaryText(state=S){
  const daily = contractSummary("daily", state);
  const weekly = contractSummary("weekly", state);
  const dailyReset = contractCountdownText("daily");
  const weeklyReset = contractCountdownText("weekly");
  return `Daily ${daily.claimed}/${daily.total} (${daily.ready} ready) • Weekly ${weekly.claimed}/${weekly.total} (${weekly.ready} ready) • Reset ${dailyReset}/${weeklyReset}`;
}

function claimContract(period="daily", contractId=""){
  ensureContractsState(S);
  const bucket = S?.contracts?.[period];
  if(!bucket || !Array.isArray(bucket.entries)) return;
  const entry = bucket.entries.find((c)=>c.id === contractId);
  if(!entry) return toast("Contract not found.");
  if(entry.claimed) return toast("Contract already claimed.");
  if(!contractEntryIsReady(entry, S)){
    return toast("Contract progress is not complete yet.");
  }
  const reward = entry.reward || {};
  const cash = Math.max(0, Math.floor(Number(reward.cash || 0)));
  const perks = Math.max(0, Math.floor(Number(reward.perkPoints || 0)));
  if(cash > 0){
    S.funds = Math.max(0, Math.round(Number(S.funds || 0))) + cash;
    trackCashEarned(cash);
  }
  if(perks > 0){
    S.perkPoints = Math.max(0, Math.floor(Number(S.perkPoints || 0))) + perks;
  }
  entry.claimed = true;
  entry.claimedAt = Date.now();
  toast(`📜 ${entry.title} claimed: ${contractRewardText(entry.reward)}`);
  hapticNotif("success");
  sfx("win");
  save();
  renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  refreshLaunchIntroStatus();
}

function claimAllContracts(period="daily"){
  ensureContractsState(S);
  const bucket = S?.contracts?.[period];
  if(!bucket || !Array.isArray(bucket.entries)) return;
  const ready = bucket.entries.filter((entry)=>contractEntryIsReady(entry, S));
  if(!ready.length){
    toast("No ready contracts to claim.");
    return;
  }
  for(const entry of ready){
    claimContract(period, entry.id);
  }
}

function normalizeClanContractClaimsMap(raw){
  const out = {};
  if(!raw || typeof raw !== "object") return out;
  for(const [week, val] of Object.entries(raw)){
    if(!week || typeof val !== "object" || !val) continue;
    const row = {};
    for(const [id, claimed] of Object.entries(val)){
      if(id && claimed) row[id] = 1;
    }
    if(Object.keys(row).length) out[week] = row;
  }
  return out;
}

function ensureClanContractClaimsState(state=S){
  if(!state || typeof state !== "object") return {};
  state.clanContractClaims = normalizeClanContractClaimsMap(state.clanContractClaims);
  return state.clanContractClaims;
}

function clanContractTarget(tpl, members=1){
  const base = Math.max(1, Math.floor(Number(tpl?.baseTarget || 1)));
  const per = Math.max(0, Math.floor(Number(tpl?.perMember || 0)));
  const team = Math.max(1, Math.floor(Number(members || 1)));
  return Math.max(1, base + (Math.max(0, team - 1) * per));
}

function clanContractsFromCloud(state=S){
  const cloud = (state?.clanCloud && typeof state.clanCloud === "object") ? state.clanCloud : null;
  const entries = Array.isArray(cloud?.contracts?.entries) ? cloud.contracts.entries : [];
  if(!entries.length) return null;
  const period = String(cloud?.contracts?.period || contractWeekKey()).trim() || contractWeekKey();
  return entries.map((entry, idx)=>{
    const key = String(entry?.key || entry?.id || `CLAN_${idx+1}`);
    const id = String(entry?.id || `${period}_${key}`);
    const title = String(entry?.title || "Clan Contract");
    const desc = String(entry?.desc || "Clan objective this week.");
    const target = Math.max(1, Math.floor(Number(entry?.target || 1)));
    const progress = Math.max(0, Math.floor(Number(entry?.progress || 0)));
    const reward = {
      cash: Math.max(0, Math.floor(Number(entry?.reward?.cash || 0))),
      perkPoints: Math.max(0, Math.floor(Number(entry?.reward?.perkPoints || 0))),
    };
    return {
      id,
      key,
      title,
      desc,
      target,
      progress,
      period,
      reward,
      ready: progress >= target,
      source:"cloud",
    };
  });
}

function clanContractsFromLocal(state=S){
  ensureClanState(state);
  const week = contractWeekKey();
  const members = Math.max(1, Math.floor(Number(state?.clanCloud?.members || 1)));
  const tallies = ensureContractTalliesState(state);
  const seed = contractHashInt(`clan_contracts|${week}|${state.clanTag || "SOLO"}`);
  const picks = contractSeededPick(CLAN_CONTRACT_POOL, Math.min(3, CLAN_CONTRACT_POOL.length), seed);
  return picks.map((tpl, idx)=>{
    const target = clanContractTarget(tpl, members);
    const metric = String(tpl.metric || "missionsCleared");
    const progress = Math.max(0, Math.floor(Number(tallies?.[metric] || 0)));
    return {
      id: `${week}_${idx}_${tpl.id}`,
      key: tpl.id,
      title: tpl.title,
      desc: tpl.desc,
      target,
      progress,
      period: week,
      reward: {
        cash: Math.max(0, Math.floor(Number(tpl.reward?.cash || 0))),
        perkPoints: Math.max(0, Math.floor(Number(tpl.reward?.perkPoints || 0))),
      },
      ready: progress >= target,
      source:"local",
    };
  });
}

function clanContractsForUi(state=S){
  return clanContractsFromCloud(state) || clanContractsFromLocal(state);
}

function clanContractClaimed(period, id, state=S){
  const claims = ensureClanContractClaimsState(state);
  const week = String(period || contractWeekKey());
  return !!(claims?.[week]?.[id]);
}

function claimClanContract(contractId=""){
  const entries = clanContractsForUi(S);
  const entry = entries.find((row)=>row.id === contractId);
  if(!entry){
    toast("Clan contract not found.");
    return;
  }
  if(!entry.ready){
    toast("Clan contract is not complete yet.");
    return;
  }
  if(clanContractClaimed(entry.period, entry.id, S)){
    toast("Clan contract already claimed this week.");
    return;
  }
  const claims = ensureClanContractClaimsState(S);
  if(!claims[entry.period]) claims[entry.period] = {};
  claims[entry.period][entry.id] = 1;

  const cash = Math.max(0, Math.floor(Number(entry.reward?.cash || 0)));
  const perkPoints = Math.max(0, Math.floor(Number(entry.reward?.perkPoints || 0)));
  if(cash > 0){
    S.funds = Math.max(0, Math.floor(Number(S.funds || 0))) + cash;
    trackCashEarned(cash);
  }
  if(perkPoints > 0){
    S.perkPoints = Math.max(0, Math.floor(Number(S.perkPoints || 0))) + perkPoints;
  }
  toast(`🏁 Clan contract claimed: ${entry.title} • ${contractRewardText(entry.reward)}`);
  hapticNotif("success");
  sfx("win");
  save();
  renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  refreshLaunchIntroStatus();
}

function setClanTagPrompt(){
  ensureClanState(S);
  const next = window.prompt("Set clan tag (2-10 letters/numbers):", S.clanTag || "");
  if(next == null) return;
  const tag = normalizeClanTag(next);
  if(tag.length < 2){
    toast("Clan tag must be 2-10 letters/numbers.");
    return;
  }
  S.clanTag = tag;
  S.clanName = sanitizeClanName(S.clanName, tag);
  S.clanCloud = null;
  S.clanLastSyncAt = 0;
  requestGameplayCloudSync("clan-tag-change", { force:true });
  save(true);
  updateModeDesc();
  refreshLaunchIntroStatus();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(`Clan tag set: ${tag}`);
}

function setClanNamePrompt(){
  ensureClanState(S);
  const next = window.prompt("Set clan name (max 36 chars):", S.clanName || "");
  if(next == null) return;
  S.clanName = sanitizeClanName(next, S.clanTag);
  S.clanCloud = null;
  S.clanLastSyncAt = 0;
  requestGameplayCloudSync("clan-name-change", { force:true });
  save(true);
  updateModeDesc();
  refreshLaunchIntroStatus();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(`Clan name set: ${S.clanName}`);
}

function raidModeActive(state=S){
  const src = (state && typeof state === "object") ? state : S;
  return !window.__TUTORIAL_MODE__ && normalizeModeName(src.mode) === "Arcade" && !!src.clanRaidEnabled;
}

function toggleRaidMode(){
  ensureClanState(S);
  S.clanRaidEnabled = !S.clanRaidEnabled;
  if(!raidModeActive(S) && Array.isArray(S.supportUnits)){
    S.supportUnits = S.supportUnits.filter((unit)=>!unit?.raidPartner);
  }
  save(true);
  updateModeDesc();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(`Co-op raid mode ${S.clanRaidEnabled ? "enabled" : "disabled"} (Arcade only).`);
}
function toggleArcadeWeeklySeedChallenge(){
  ensureArcadeWeeklySeedState(S);
  if(normalizeModeName(S.mode) !== "Arcade"){
    toast("Switch to Arcade mode first.");
    return;
  }
  S.arcadeWeeklySeedEnabled = !S.arcadeWeeklySeedEnabled;
  S.arcadeWeeklySeedKey = weeklyChallengeWeekKey();
  S.arcadeWeeklyRunId = "";
  S.arcadeWeeklyRunStartedAt = 0;
  deploy();
  save(true);
  updateModeDesc();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  toast(
    S.arcadeWeeklySeedEnabled
      ? `Weekly Seed Challenge enabled (${S.arcadeWeeklySeedKey}).`
      : "Weekly Seed Challenge disabled."
  );
}

function refreshClanCloudNow(){
  requestGameplayCloudSync("clan-refresh", { force:true });
  toast("Refreshing clan sync...");
}

function launchClanSummaryText(state=S){
  ensureClanState(state);
  const cloud = (state?.clanCloud && typeof state.clanCloud === "object") ? state.clanCloud : null;
  const rankTxt = Number.isFinite(Number(cloud?.rank)) && Number(cloud.rank) > 0 ? `#${Number(cloud.rank)}` : "—";
  const members = Math.max(1, Math.floor(Number(cloud?.members || 1)));
  const score = Math.max(0, Math.floor(Number(cloud?.score || 0)));
  return `${state.clanName} [${state.clanTag}] • Rank ${rankTxt} • ${members} member${members===1?"":"s"} • ${score.toLocaleString()} pts`;
}

function normalizeReferralMilestoneSnapshot(raw={}){
  const src = (raw && typeof raw === "object") ? raw : {};
  const started = Math.max(0, Math.floor(Number(src.started || 0)));
  const current = (src.current && typeof src.current === "object") ? src.current : {};
  const next = (src.next && typeof src.next === "object") ? src.next : null;
  return {
    started,
    current: {
      target: Math.max(0, Math.floor(Number(current.target || 0))),
      title: String(current.title || "No Milestone Yet"),
      reward: String(current.reward || ""),
    },
    next: next
      ? {
        target: Math.max(0, Math.floor(Number(next.target || 0))),
        title: String(next.title || ""),
        reward: String(next.reward || ""),
        remaining: Math.max(0, Math.floor(Number(next.remaining || 0))),
      }
      : null,
    progressPct: clamp(Number(src.progressPct || 0), 0, 100),
    link: String(src.link || "").trim(),
    botLink: String(src.botLink || "").trim(),
  };
}

function launchReferralSummaryText(state=S){
  const ref = normalizeReferralMilestoneSnapshot(state?.referralMilestone || {});
  if(ref.started <= 0 && !ref.next){
    return "Use /ref in Telegram to generate your invite link.";
  }
  if(ref.next){
    return `Referrals ${ref.started} • Next ${ref.next.title} (${ref.next.target}) in ${ref.next.remaining}`;
  }
  return `Referrals ${ref.started} • MAX milestone reached (${ref.current.title})`;
}

function countdownTextFromMs(ms){
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if(h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  if(m > 0) return `${m}m ${String(s).padStart(2,"0")}s`;
  return `${s}s`;
}

function normalizeTelegramEventDrop(raw={}){
  const src = (raw && typeof raw === "object") ? raw : {};
  const nextAtRaw = String(src.nextAt || "").trim();
  const nextAtMs = nextAtRaw ? Date.parse(nextAtRaw) : NaN;
  return {
    kind: String(src.kind || "campaign"),
    label: String(src.label || "Campaign Push"),
    nextKind: String(src.nextKind || "campaign"),
    nextLabel: String(src.nextLabel || "Campaign Push"),
    nextAt: nextAtRaw,
    nextAtMs: Number.isFinite(nextAtMs) ? nextAtMs : 0,
    secondsToNext: Math.max(0, Math.floor(Number(src.secondsToNext || 0))),
  };
}

function launchEventDropSummaryText(state=S){
  const drop = normalizeTelegramEventDrop(state?.telegramEventDrop || {});
  if(!drop.nextAtMs){
    return `${drop.label} now • Next drop in daily rotation`;
  }
  const remainMs = Math.max(0, drop.nextAtMs - Date.now());
  return `${drop.label} now • Next ${drop.nextLabel} in ${countdownTextFromMs(remainMs)}`;
}

function storyOrModeMissionLabel(state=S, missionMeta=null){
  const mode = normalizeModeName(state?.mode);
  if(mode === "Story"){
    const variant = normalizeStoryVariant(missionMeta?.storyVariant || state?.storyVariant);
    if(variant === STORY_VARIANTS.GAUNTLET){
      return `Gauntlet Run ${Math.max(1, Math.floor(Number(missionMeta?.runIndex || state?.gauntletDepth || 1)))}`;
    }
    if(variant === STORY_VARIANTS.ELITE_HUNT){
      return `Elite Hunt ${Math.max(1, Math.floor(Number(missionMeta?.runIndex || state?.eliteHuntRuns || 1)))}`;
    }
    return `Story Mission ${Math.max(1, Math.floor(Number(missionMeta?.number || state?.storyLevel || 1)))}`;
  }
  if(mode === "Arcade"){
    const weeklyEnabled = !!(missionMeta?.weeklySeed || state?.arcadeWeeklySeedEnabled);
    if(weeklyEnabled){
      return `Arcade Weekly Seed ${String(missionMeta?.weeklySeedKey || state?.arcadeWeeklySeedKey || weeklyChallengeWeekKey())}`;
    }
    return `Arcade Mission ${Math.max(1, Math.floor(Number(missionMeta?.number || state?.arcadeLevel || 1)))}`;
  }
  return `Survival Wave ${Math.max(1, Math.floor(Number(state?.survivalWave || 1)))}`;
}

function missionShareBaseUrl(){
  try{
    return `${window.location.origin}${window.location.pathname}`;
  }catch(e){
    return "https://tigerstrike-webapp.vercel.app/";
  }
}

function buildMissionRecapPayload(meta={}){
  const missionLabel = storyOrModeMissionLabel(S, meta);
  const chapterName = String(meta?.chapterName || "").trim();
  const chapterSuffix = chapterName ? ` — ${chapterName}` : "";
  const kills = Math.max(0, Math.floor(Number(S.stats?.kills || 0)));
  const captures = Math.max(0, Math.floor(Number(S.stats?.captures || 0)));
  const evac = Math.max(0, Math.floor(Number(S.stats?.evac || 0)));
  const trapsSet = Math.max(0, Math.floor(Number(S.stats?.trapsPlaced || 0)));
  const trapsStop = Math.max(0, Math.floor(Number(S.stats?.trapsTriggered || 0)));
  const shots = Math.max(0, Math.floor(Number(S.stats?.shots || 0)));
  const cash = Math.max(0, Math.floor(Number(S.stats?.cashEarned || 0)));
  const shareUrl = missionShareBaseUrl();
  const card = [
    `${missionLabel}${chapterSuffix}`,
    `Civilians Saved: ${evac}`,
    `Captures: ${captures} • Kills: ${kills}`,
    `Traps Set/Stopped: ${trapsSet}/${trapsStop}`,
    `Shots Fired: ${shots} • Cash Earned: $${cash.toLocaleString()}`,
  ].join("\n");
  const shareText = [
    "🐯 TIGER STRIKE MISSION RECAP",
    `${missionLabel}${chapterSuffix}`,
    `🛟 Civilians Saved: ${evac}`,
    `🎯 Captures: ${captures} • Eliminations: ${kills}`,
    `🧰 Traps: ${trapsSet}/${trapsStop} • 🔫 Shots: ${shots}`,
    `💵 Cash Earned: $${cash.toLocaleString()}`,
    "#TigerStrike",
  ].join("\n");
  return {
    missionLabel,
    chapterName,
    card,
    shareText,
    shareUrl,
    createdAt: Date.now(),
  };
}

function renderCompleteRecapCard(payload=null){
  const cardEl = document.getElementById("completeRecapCard");
  if(!cardEl) return;
  const recap = (payload && typeof payload === "object")
    ? payload
    : ((S.lastMissionRecap && typeof S.lastMissionRecap === "object") ? S.lastMissionRecap : buildMissionRecapPayload());
  cardEl.innerText = String(recap.card || "Mission recap is ready.");
}

function openShareUrl(url){
  const safeUrl = String(url || "").trim();
  if(!safeUrl) return false;
  try{
    if(typeof tg?.openTelegramLink === "function"){
      tg.openTelegramLink(safeUrl);
      return true;
    }
  }catch(e){}
  try{
    window.open(safeUrl, "_blank", "noopener,noreferrer");
    return true;
  }catch(e){
    return false;
  }
}

async function shareFallbackText(text){
  const body = String(text || "").trim();
  if(!body) return false;
  try{
    if(navigator.share){
      await navigator.share({ text: body });
      return true;
    }
  }catch(e){}
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(body);
      return true;
    }
  }catch(e){}
  return false;
}

async function shareMissionRecap(){
  const recap = buildMissionRecapPayload();
  S.lastMissionRecap = recap;
  renderCompleteRecapCard(recap);
  const shareLink = `https://t.me/share/url?url=${encodeURIComponent(recap.shareUrl)}&text=${encodeURIComponent(recap.shareText)}`;
  if(openShareUrl(shareLink)){
    toast("Mission recap opened for sharing.");
    return;
  }
  const ok = await shareFallbackText(`${recap.shareText}\n${recap.shareUrl}`);
  toast(ok ? "Mission recap copied for sharing." : "Could not open share. Copy the recap manually.");
}

async function shareReferralLinkFromGame(){
  const ref = normalizeReferralMilestoneSnapshot(S.referralMilestone || {});
  const link = String(ref.link || "").trim();
  const botLink = String(ref.botLink || "").trim();
  if(!link){
    const fallback = "Referral link not ready yet. Open Telegram bot and run /ref to generate your invite link.";
    const copied = await shareFallbackText(fallback);
    if(!copied && botLink){
      openShareUrl(botLink);
    }
    toast(copied ? "Referral instructions copied." : "Run /ref in Telegram bot to get your invite link.");
    return;
  }
  const nextLine = ref.next
    ? `Next milestone: ${ref.next.title} at ${ref.next.target} (${ref.next.remaining} to go).`
    : "MAX referral milestone reached.";
  const text = [
    "Join me in Tiger Strike.",
    `Referral progress: ${ref.started} started.`,
    nextLine,
    link,
  ].join("\n");
  const shareLink = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  if(openShareUrl(shareLink)){
    toast("Referral share opened.");
    return;
  }
  const copied = await shareFallbackText(text);
  toast(copied ? "Referral link copied." : "Could not share referral link.");
}

function shareReferralFromLaunchIntro(){
  return shareReferralLinkFromGame();
}

function normalizeLiveOpsReward(raw={}){
  const src = (raw && typeof raw === "object") ? raw : {};
  return {
    cash: Math.max(0, Math.floor(Number(src.cash || 0))),
    perkPoints: Math.max(0, Math.floor(Number(src.perkPoints || 0))),
    medkits: Math.max(0, Math.floor(Number(src.medkits || 0))),
    shields: Math.max(0, Math.floor(Number(src.shields || 0))),
    traps: Math.max(0, Math.floor(Number(src.traps || 0))),
    armorPlates: Math.max(0, Math.floor(Number(src.armorPlates || 0))),
    ammo: Math.max(0, Math.floor(Number(src.ammo || 0))),
  };
}
function normalizeLiveOpsModifiers(raw={}){
  const src = (raw && typeof raw === "object") ? raw : {};
  return {
    eventChanceMul: clamp(Number(src.eventChanceMul || 1), 0.72, 1.35),
    supplyWeightMul: clamp(Number(src.supplyWeightMul || 1), 0.65, 1.45),
    rogueWeightMul: clamp(Number(src.rogueWeightMul || 1), 0.65, 1.45),
    fogWeightMul: clamp(Number(src.fogWeightMul || 1), 0.65, 1.45),
    bonusWeightMul: clamp(Number(src.bonusWeightMul || 1), 0.65, 1.45),
    payoutMul: clamp(Number(src.payoutMul || 1), 0.80, 1.22),
  };
}
function generateLiveOpsEntry(weekKey, state=S){
  const pool = Array.isArray(LIVE_OPS_POOL) ? LIVE_OPS_POOL : [];
  if(!pool.length) return null;
  const seed = contractHashInt(`liveops|${weekKey}|v${LIVE_OPS_VERSION}`);
  const template = pool[seed % pool.length] || pool[0];
  const metric = String(template.metric || "missionsCleared");
  const target = Math.max(1, Math.floor(Number(template.target || 1)));
  return {
    id: `liveops_${weekKey}_${template.id}`,
    key: template.id,
    title: String(template.title || "Weekly Live Ops"),
    desc: String(template.desc || "Complete this week's operation."),
    metric,
    target,
    baseline: Math.max(0, Math.floor(Number(contractMetricValue(metric, state)))),
    reward: normalizeLiveOpsReward(template.reward),
    modifiers: normalizeLiveOpsModifiers(template.modifiers),
    claimed: false,
    claimedAt: 0,
    createdAt: Date.now(),
  };
}
function normalizeLiveOpsEntry(entry, state=S){
  if(!entry || typeof entry !== "object") return null;
  const metric = String(entry.metric || "").trim();
  if(!metric || !Object.prototype.hasOwnProperty.call(DEFAULT_CONTRACT_TALLIES, metric)) return null;
  const target = Math.max(1, Math.floor(Number(entry.target || 1)));
  return {
    id: String(entry.id || `liveops_${Date.now()}`),
    key: String(entry.key || "LIVE_OPS"),
    title: String(entry.title || "Weekly Live Ops"),
    desc: String(entry.desc || "Complete this week's operation."),
    metric,
    target,
    baseline: Math.max(0, Math.floor(Number(entry.baseline ?? contractMetricValue(metric, state)))),
    reward: normalizeLiveOpsReward(entry.reward),
    modifiers: normalizeLiveOpsModifiers(entry.modifiers),
    claimed: !!entry.claimed,
    claimedAt: Math.max(0, Math.floor(Number(entry.claimedAt || 0))),
    createdAt: Math.max(0, Math.floor(Number(entry.createdAt || Date.now()))),
  };
}
function ensureLiveOpsState(state=S, opts={}){
  if(!state || typeof state !== "object") return false;
  ensureContractTalliesState(state);
  const now = Number(opts.now || Date.now());
  const weekKey = contractWeekKey(now);
  let changed = false;
  if(!state.liveOps || typeof state.liveOps !== "object"){
    state.liveOps = {};
    changed = true;
  }
  const stale = state.liveOps.key !== weekKey || Number(state.liveOps.version || 0) !== LIVE_OPS_VERSION;
  if(stale){
    state.liveOps = {
      version: LIVE_OPS_VERSION,
      key: weekKey,
      resetAt: nextUtcWeekMs(now),
      entry: generateLiveOpsEntry(weekKey, state),
      refreshedAt: now,
      lastToastAt: 0,
    };
    changed = true;
  } else {
    state.liveOps.version = LIVE_OPS_VERSION;
    state.liveOps.key = weekKey;
    state.liveOps.resetAt = nextUtcWeekMs(now);
    const normalized = normalizeLiveOpsEntry(state.liveOps.entry, state);
    if(!normalized){
      state.liveOps.entry = generateLiveOpsEntry(weekKey, state);
      changed = true;
    } else {
      state.liveOps.entry = normalized;
    }
    if(!Number.isFinite(Number(state.liveOps.lastToastAt))){
      state.liveOps.lastToastAt = 0;
      changed = true;
    }
  }
  return changed;
}
function liveOpsEntry(state=S){
  ensureLiveOpsState(state);
  return state?.liveOps?.entry || null;
}
function liveOpsEntryProgress(entry, state=S){
  if(!entry || typeof entry !== "object") return 0;
  const metricNow = contractMetricValue(entry.metric, state);
  const baseline = Math.max(0, Math.floor(Number(entry.baseline || 0)));
  return Math.max(0, metricNow - baseline);
}
function liveOpsEntryIsReady(entry, state=S){
  if(!entry || typeof entry !== "object") return false;
  return !entry.claimed && liveOpsEntryProgress(entry, state) >= Math.max(1, Math.floor(Number(entry.target || 1)));
}
function liveOpsRewardText(reward={}){
  const r = normalizeLiveOpsReward(reward);
  const bits = [];
  if(r.cash > 0) bits.push(`$${r.cash.toLocaleString()}`);
  if(r.perkPoints > 0) bits.push(`+${r.perkPoints} perk point${r.perkPoints===1?"":"s"}`);
  if(r.medkits > 0) bits.push(`+${r.medkits} medkit${r.medkits===1?"":"s"}`);
  if(r.shields > 0) bits.push(`+${r.shields} shield${r.shields===1?"":"s"}`);
  if(r.traps > 0) bits.push(`+${r.traps} trap${r.traps===1?"":"s"}`);
  if(r.armorPlates > 0) bits.push(`+${r.armorPlates} armor plate${r.armorPlates===1?"":"s"}`);
  if(r.ammo > 0) bits.push(`+${r.ammo} ammo`);
  return bits.join(" • ") || "No reward";
}
function launchLiveOpsSummaryText(state=S){
  const entry = liveOpsEntry(state);
  if(!entry){
    return `Weekly operation unavailable • resets in ${contractCountdownText("weekly")}`;
  }
  const progress = Math.min(entry.target, liveOpsEntryProgress(entry, state));
  const status = entry.claimed ? "Claimed" : (liveOpsEntryIsReady(entry, state) ? "Ready" : `${progress}/${entry.target}`);
  return `${entry.title}: ${status} • Reset ${contractCountdownText("weekly")}`;
}
function liveOpsModifierValue(key, fallback=1, state=S){
  const entry = liveOpsEntry(state);
  const mods = normalizeLiveOpsModifiers(entry?.modifiers || {});
  const val = Number(mods?.[key]);
  return Number.isFinite(val) ? val : Number(fallback || 1);
}
function liveOpsActiveModifiers(state=S){
  return normalizeLiveOpsModifiers(liveOpsEntry(state)?.modifiers || {});
}
function liveOpsPayoutMul(state=S){
  return liveOpsModifierValue("payoutMul", 1, state);
}
function claimLiveOps(){
  ensureLiveOpsState(S);
  const entry = liveOpsEntry(S);
  if(!entry) return toast("Live Ops unavailable right now.");
  if(entry.claimed) return toast("Live Ops reward already claimed this week.");
  if(!liveOpsEntryIsReady(entry, S)) return toast("Live Ops objective is not complete yet.");

  const reward = normalizeLiveOpsReward(entry.reward);
  if(reward.cash > 0){
    S.funds = Math.max(0, Math.round(Number(S.funds || 0))) + reward.cash;
    trackCashEarned(reward.cash);
  }
  if(reward.perkPoints > 0){
    S.perkPoints = Math.max(0, Math.floor(Number(S.perkPoints || 0))) + reward.perkPoints;
  }
  if(reward.medkits > 0){
    S.medkits = { ...(S.medkits || {}) };
    S.medkits.M_SMALL = Math.max(0, Math.floor(Number(S.medkits.M_SMALL || 0))) + reward.medkits;
  }
  if(reward.shields > 0){
    S.shields = Math.max(0, Math.floor(Number(S.shields || 0))) + reward.shields;
  }
  if(reward.traps > 0){
    S.trapsOwned = Math.max(0, Math.floor(Number(S.trapsOwned || 0))) + reward.traps;
  }
  if(reward.armorPlates > 0){
    ensureArmorPlateInventoryState();
    ensureArmorPlateFallbackState();
    S.armorPlates.A_TIER1 = Math.max(0, Math.floor(Number(S.armorPlates.A_TIER1 || 0))) + reward.armorPlates;
    S.armorPlatesFallback.A_TIER1 = Math.max(0, Math.floor(Number(S.armorPlatesFallback.A_TIER1 || 0))) + reward.armorPlates;
  }
  if(reward.ammo > 0){
    const w = equippedWeapon();
    if(w){
      S.ammoReserve[w.ammo] = Math.max(0, Math.floor(Number(S.ammoReserve[w.ammo] || 0))) + reward.ammo;
    }
  }

  entry.claimed = true;
  entry.claimedAt = Date.now();
  toast(`📡 Live Ops reward claimed: ${liveOpsRewardText(reward)}`);
  hapticNotif("success");
  sfx("win");
  save();
  renderHUD();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  refreshLaunchIntroStatus();
}

function addContractTally(metric, delta=1, state=S){
  if(!state || typeof state !== "object") return 0;
  ensureContractTalliesState(state);
  if(!Object.prototype.hasOwnProperty.call(DEFAULT_CONTRACT_TALLIES, metric)) return 0;
  const add = Math.max(0, Math.floor(Number(delta || 0)));
  if(add <= 0) return contractMetricValue(metric, state);
  state.contractTallies[metric] = Math.max(0, Math.floor(Number(state.contractTallies[metric] || 0))) + add;
  return state.contractTallies[metric];
}

let __contractsLastRefreshAt = 0;
function contractsHeartbeatTick(){
  const now = Date.now();
  if((now - __contractsLastRefreshAt) < CONTRACT_REFRESH_THROTTLE_MS) return;
  __contractsLastRefreshAt = now;
  const contractsChanged = ensureContractsState(S, { now });
  const liveOpsChanged = ensureLiveOpsState(S, { now });
  if(contractsChanged || liveOpsChanged){
    __savePending = true;
    refreshLaunchIntroStatus();
    if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
  }
}

const STORAGE_VERSION = 4385;
const STORAGE_SCOPE = tgUserKey();
const STORAGE_KEY_BASE = `ts_v${STORAGE_VERSION}`;
const STORAGE_KEY = `${STORAGE_KEY_BASE}_${STORAGE_SCOPE}`;
const STORAGE_FALLBACK_KEYS = (() => {
  const versions = [4384, 4383, 4382, 4381, 4380, 4371];
  const keys = [];
  const seen = new Set();
  const pushKey = (k)=>{
    const key = String(k || "").trim();
    if(!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  for(const v of versions){
    pushKey(`ts_v${v}_${STORAGE_SCOPE}`);
  }
  if(STORAGE_SCOPE !== "local"){
    pushKey(`${STORAGE_KEY_BASE}_local`);
    for(const v of versions){
      pushKey(`ts_v${v}_local`);
    }
  }
  pushKey(STORAGE_KEY_BASE);
  for(const v of versions){
    pushKey(`ts_v${v}`);
  }
  return keys;
})();
const STORY_SAVE_KEY_BASE = "ts_story_save";
const STORY_PROGRESS_KEY_BASE = "ts_story_progress";
const STORY_PROFILE_KEY_BASE = "ts_story_profile";
const STORY_CHECKPOINT_KEY_BASE = "ts_story_checkpoint";
const CLOUD_PROFILE_ENDPOINT = "/api/player/game-sync";
const CLOUD_PROFILE_SAVE_MIN_MS = 15000;

function cloneState(obj){
  if(typeof structuredClone === "function"){
    try{ return structuredClone(obj); }catch(e){}
  }
  return JSON.parse(JSON.stringify(obj));
}

function awardDailyLogin(){
  if(!window.S) return null;

  const today = ymdUTC();
  const info = readDaily();

  if(info.last === today){
    return null;
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
  trackCashEarned(cash);

  info.last = today;
  info.streak = newStreak;
  info.total = (Number(info.total||0) + 1);
  writeDaily(info);

  toast(`🎁 Daily reward: +$${cash.toLocaleString()} • +${perkPts} perk point${perkPts>1?"s":""} • Streak: ${newStreak}`);
  try{ hapticNotif("success"); }catch(e){}
  __savePending = true;
  return {
    cash,
    perkPts,
    streak:newStreak,
    total:Number(info.total || 0),
    today,
  };
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

// ===================== SEASON PASS (Cosmetic Only) =====================
const SEASON_PASS_ID = "S1_JUNGLE_ASCENT";
const SEASON_PASS_POINTS_PER_LEVEL = 100;
const SEASON_PASS_MAX_LEVEL = 20;
const SEASON_PASS_MAX_POINTS = (SEASON_PASS_MAX_LEVEL * SEASON_PASS_POINTS_PER_LEVEL) - 1;
const SEASON_PASS_PREMIUM_PRICE = 15000;
const SEASON_PASS_TYPE_ICON = Object.freeze({
  skin: "🎨",
  badge: "🏅",
  banner: "🏳️",
  finisher: "✨",
});
const SEASON_PASS_SKINS = Object.freeze({
  SKIN_FIELD_STANDARD: {
    name: "Field Standard",
    palette: {
      pants: "rgba(26,32,44,.95)",
      boots: "rgba(17,22,31,.95)",
      armorOuter: "rgba(48,58,72,.96)",
      armorInner: "rgba(20,30,44,.97)",
      arm: "rgba(28,36,48,.95)",
      shoulder: "rgba(36,44,59,.9)",
      helmet: "rgba(55,65,75,.95)",
      visor: "rgba(180,210,235,.55)",
      trim: "rgba(120,208,255,.46)",
      lens: "rgba(22,26,38,.95)",
    },
  },
  SKIN_FOREST_RANGER: {
    name: "Forest Ranger",
    palette: {
      pants: "rgba(23,41,33,.95)",
      boots: "rgba(13,23,18,.95)",
      armorOuter: "rgba(43,77,58,.96)",
      armorInner: "rgba(22,47,35,.97)",
      arm: "rgba(24,52,38,.95)",
      shoulder: "rgba(31,58,45,.92)",
      helmet: "rgba(56,95,74,.95)",
      visor: "rgba(170,235,198,.55)",
      trim: "rgba(74,222,128,.56)",
      lens: "rgba(16,29,24,.95)",
    },
  },
  SKIN_DESERT_STORM: {
    name: "Desert Storm",
    palette: {
      pants: "rgba(65,52,33,.95)",
      boots: "rgba(32,25,15,.95)",
      armorOuter: "rgba(125,95,55,.96)",
      armorInner: "rgba(78,57,33,.97)",
      arm: "rgba(92,68,39,.95)",
      shoulder: "rgba(110,80,45,.92)",
      helmet: "rgba(142,109,62,.95)",
      visor: "rgba(255,220,165,.48)",
      trim: "rgba(251,191,36,.52)",
      lens: "rgba(40,32,20,.95)",
    },
  },
  SKIN_CRIMSON_FANG: {
    name: "Crimson Fang",
    palette: {
      pants: "rgba(62,18,24,.95)",
      boots: "rgba(30,10,13,.95)",
      armorOuter: "rgba(125,24,36,.96)",
      armorInner: "rgba(82,15,25,.97)",
      arm: "rgba(90,20,30,.95)",
      shoulder: "rgba(108,24,37,.92)",
      helmet: "rgba(140,30,44,.95)",
      visor: "rgba(254,202,202,.48)",
      trim: "rgba(248,113,113,.54)",
      lens: "rgba(44,12,16,.95)",
    },
  },
  SKIN_MIDNIGHT_OPS: {
    name: "Midnight Ops",
    palette: {
      pants: "rgba(12,16,30,.95)",
      boots: "rgba(8,10,20,.95)",
      armorOuter: "rgba(24,36,72,.96)",
      armorInner: "rgba(14,24,54,.97)",
      arm: "rgba(18,28,62,.95)",
      shoulder: "rgba(20,32,66,.92)",
      helmet: "rgba(36,52,96,.95)",
      visor: "rgba(191,219,254,.50)",
      trim: "rgba(96,165,250,.58)",
      lens: "rgba(10,16,34,.95)",
    },
  },
  SKIN_EMERALD_GUARD: {
    name: "Emerald Guard",
    palette: {
      pants: "rgba(16,38,34,.95)",
      boots: "rgba(10,22,20,.95)",
      armorOuter: "rgba(22,94,82,.96)",
      armorInner: "rgba(17,64,57,.97)",
      arm: "rgba(18,74,65,.95)",
      shoulder: "rgba(20,86,74,.92)",
      helmet: "rgba(24,120,104,.95)",
      visor: "rgba(167,243,208,.50)",
      trim: "rgba(45,212,191,.62)",
      lens: "rgba(8,29,25,.95)",
    },
  },
  SKIN_PANTHER_BLACK: {
    name: "Panther Black",
    palette: {
      pants: "rgba(10,11,14,.95)",
      boots: "rgba(5,6,8,.95)",
      armorOuter: "rgba(21,24,31,.96)",
      armorInner: "rgba(14,17,24,.97)",
      arm: "rgba(17,20,28,.95)",
      shoulder: "rgba(18,22,31,.92)",
      helmet: "rgba(28,34,46,.95)",
      visor: "rgba(203,213,225,.46)",
      trim: "rgba(156,163,175,.52)",
      lens: "rgba(20,23,30,.95)",
    },
  },
  SKIN_GOLDEN_COMMAND: {
    name: "Golden Command",
    palette: {
      pants: "rgba(58,49,26,.95)",
      boots: "rgba(30,25,13,.95)",
      armorOuter: "rgba(142,112,39,.96)",
      armorInner: "rgba(94,72,24,.97)",
      arm: "rgba(112,86,28,.95)",
      shoulder: "rgba(129,98,32,.92)",
      helmet: "rgba(168,132,44,.95)",
      visor: "rgba(254,240,138,.52)",
      trim: "rgba(250,204,21,.62)",
      lens: "rgba(43,34,12,.95)",
    },
  },
});
const SEASON_PASS_BADGES = Object.freeze({
  BADGE_RECRUIT: { name: "Recruit", icon: "🪖" },
  BADGE_SCOUT: { name: "Scout", icon: "🛰️" },
  BADGE_TRACKER: { name: "Tracker", icon: "🧭" },
  BADGE_WARDEN: { name: "Warden", icon: "🛡️" },
  BADGE_TAMER: { name: "Tamer", icon: "🐯" },
  BADGE_SHARPSHOT: { name: "Sharpshot", icon: "🎯" },
  BADGE_RESCUER: { name: "Rescuer", icon: "🚁" },
  BADGE_COMMANDER: { name: "Commander", icon: "⭐" },
});
const SEASON_PASS_BANNERS = Object.freeze({
  BANNER_FOREST_EDGE: { name: "Forest Edge" },
  BANNER_TRAILBLAZER: { name: "Trailblazer" },
  BANNER_STORM_LINE: { name: "Storm Line" },
  BANNER_RED_DAWN: { name: "Red Dawn" },
  BANNER_COBALT_MARK: { name: "Cobalt Mark" },
  BANNER_EMERALD_WAVE: { name: "Emerald Wave" },
  BANNER_SHADOW_FLAG: { name: "Shadow Flag" },
  BANNER_LEGEND_HUNTER: { name: "Legend Hunter" },
});
const SEASON_PASS_FINISHERS = Object.freeze({
  FINISHER_STANDARD: { name: "Standard Finish", text: "Clean Takedown", icon: "✨", popupKind: "crit" },
  FINISHER_SHOCKWAVE: { name: "Shockwave", text: "Shock Finish", icon: "⚡", popupKind: "crit" },
  FINISHER_CRESCENT: { name: "Crescent Slash", text: "Crescent Finish", icon: "🌙", popupKind: "crit" },
  FINISHER_TRANQ_NET: { name: "Tranq Net", text: "Secure Capture", icon: "💉", popupKind: "tranq" },
  FINISHER_PHANTOM: { name: "Phantom Break", text: "Phantom Finish", icon: "👤", popupKind: "crit" },
  FINISHER_CROWN: { name: "Tiger Crown", text: "Crown Finish", icon: "👑", popupKind: "crit" },
});
const SEASON_PASS_TRACK = Object.freeze([
  { level:1,  free:{ type:"badge", id:"BADGE_SCOUT" },           premium:{ type:"skin", id:"SKIN_PANTHER_BLACK" } },
  { level:2,  free:{ type:"banner", id:"BANNER_TRAILBLAZER" },   premium:{ type:"finisher", id:"FINISHER_SHOCKWAVE" } },
  { level:3,  free:{ type:"skin", id:"SKIN_FOREST_RANGER" },     premium:{ type:"badge", id:"BADGE_TRACKER" } },
  { level:4,  free:{ type:"finisher", id:"FINISHER_TRANQ_NET" }, premium:{ type:"banner", id:"BANNER_STORM_LINE" } },
  { level:5,  free:{ type:"badge", id:"BADGE_WARDEN" },          premium:{ type:"skin", id:"SKIN_DESERT_STORM" } },
  { level:6,  free:{ type:"banner", id:"BANNER_RED_DAWN" },      premium:{ type:"finisher", id:"FINISHER_CRESCENT" } },
  { level:7,  free:{ type:"skin", id:"SKIN_EMERALD_GUARD" },     premium:{ type:"badge", id:"BADGE_SHARPSHOT" } },
  { level:8,  free:{ type:"finisher", id:"FINISHER_STANDARD" },  premium:{ type:"banner", id:"BANNER_COBALT_MARK" } },
  { level:9,  free:{ type:"badge", id:"BADGE_TAMER" },           premium:{ type:"skin", id:"SKIN_CRIMSON_FANG" } },
  { level:10, free:{ type:"banner", id:"BANNER_EMERALD_WAVE" },  premium:{ type:"finisher", id:"FINISHER_PHANTOM" } },
  { level:11, free:{ type:"skin", id:"SKIN_MIDNIGHT_OPS" },      premium:{ type:"badge", id:"BADGE_RESCUER" } },
  { level:12, free:{ type:"finisher", id:"FINISHER_SHOCKWAVE" }, premium:{ type:"banner", id:"BANNER_SHADOW_FLAG" } },
  { level:13, free:{ type:"badge", id:"BADGE_COMMANDER" },       premium:{ type:"skin", id:"SKIN_GOLDEN_COMMAND" } },
  { level:14, free:{ type:"banner", id:"BANNER_STORM_LINE" },    premium:{ type:"finisher", id:"FINISHER_CROWN" } },
  { level:15, free:{ type:"skin", id:"SKIN_DESERT_STORM" },      premium:{ type:"badge", id:"BADGE_TAMER" } },
  { level:16, free:{ type:"finisher", id:"FINISHER_TRANQ_NET" }, premium:{ type:"banner", id:"BANNER_LEGEND_HUNTER" } },
  { level:17, free:{ type:"badge", id:"BADGE_RESCUER" },         premium:{ type:"skin", id:"SKIN_EMERALD_GUARD" } },
  { level:18, free:{ type:"banner", id:"BANNER_COBALT_MARK" },   premium:{ type:"finisher", id:"FINISHER_PHANTOM" } },
  { level:19, free:{ type:"skin", id:"SKIN_CRIMSON_FANG" },      premium:{ type:"badge", id:"BADGE_COMMANDER" } },
  { level:20, free:{ type:"banner", id:"BANNER_LEGEND_HUNTER" }, premium:{ type:"finisher", id:"FINISHER_CROWN" } },
]);
function seasonCosmeticBucket(type){
  if(type === "skin") return "skins";
  if(type === "badge") return "badges";
  if(type === "banner") return "banners";
  if(type === "finisher") return "finishers";
  return "";
}
function seasonCosmeticCatalog(type){
  if(type === "skin") return SEASON_PASS_SKINS;
  if(type === "badge") return SEASON_PASS_BADGES;
  if(type === "banner") return SEASON_PASS_BANNERS;
  if(type === "finisher") return SEASON_PASS_FINISHERS;
  return null;
}
function seasonRewardDef(type, id){
  const catalog = seasonCosmeticCatalog(type);
  if(!catalog) return null;
  return catalog[id] || null;
}
function seasonNormalizeStringList(list){
  if(!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for(const raw of list){
    const id = String(raw || "").trim();
    if(!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function seasonNormalizeClaimMap(map){
  const src = (map && typeof map === "object") ? map : {};
  const out = {};
  for(const [k, v] of Object.entries(src)){
    if(!v) continue;
    const tier = clamp(Math.floor(Number(k || 0)), 1, SEASON_PASS_MAX_LEVEL);
    out[String(tier)] = true;
  }
  return out;
}
function defaultSeasonPassState(){
  return {
    seasonId: SEASON_PASS_ID,
    points: 0,
    premium: false,
    claimedFree: {},
    claimedPremium: {},
    owned: {
      skins: ["SKIN_FIELD_STANDARD"],
      badges: ["BADGE_RECRUIT"],
      banners: ["BANNER_FOREST_EDGE"],
      finishers: ["FINISHER_STANDARD"],
    },
    equipped: {
      skin: "SKIN_FIELD_STANDARD",
      badge: "BADGE_RECRUIT",
      banner: "BANNER_FOREST_EDGE",
      finisher: "FINISHER_STANDARD",
    },
  };
}
function normalizeSeasonPassSnapshot(input){
  const base = defaultSeasonPassState();
  const src = (input && typeof input === "object") ? input : {};
  const out = {
    seasonId: String(src.seasonId || base.seasonId),
    points: clamp(Math.floor(Number(src.points || 0)), 0, SEASON_PASS_MAX_POINTS),
    premium: !!src.premium,
    claimedFree: seasonNormalizeClaimMap(src.claimedFree),
    claimedPremium: seasonNormalizeClaimMap(src.claimedPremium),
    owned: {
      skins: seasonNormalizeStringList(src.owned?.skins),
      badges: seasonNormalizeStringList(src.owned?.badges),
      banners: seasonNormalizeStringList(src.owned?.banners),
      finishers: seasonNormalizeStringList(src.owned?.finishers),
    },
    equipped: {
      skin: String(src.equipped?.skin || ""),
      badge: String(src.equipped?.badge || ""),
      banner: String(src.equipped?.banner || ""),
      finisher: String(src.equipped?.finisher || ""),
    },
  };

  for(const [type, fallbackId] of Object.entries(base.equipped)){
    const bucket = seasonCosmeticBucket(type);
    const catalog = seasonCosmeticCatalog(type);
    if(!bucket || !catalog) continue;
    if(!out.owned[bucket].includes(fallbackId)) out.owned[bucket].push(fallbackId);
    const cleanOwned = out.owned[bucket].filter((id)=>!!catalog[id]);
    out.owned[bucket] = cleanOwned.length ? cleanOwned : [fallbackId];
    if(!catalog[out.equipped[type]] || !out.owned[bucket].includes(out.equipped[type])){
      out.equipped[type] = out.owned[bucket][0] || fallbackId;
    }
  }
  return out;
}
function ensureSeasonPassState(state=S){
  if(!state || typeof state !== "object"){
    return normalizeSeasonPassSnapshot(null);
  }
  state.seasonPass = normalizeSeasonPassSnapshot(state.seasonPass);
  return state.seasonPass;
}
function mergeSeasonPassSnapshots(currentPass, incomingPass){
  const current = normalizeSeasonPassSnapshot(currentPass);
  const incoming = normalizeSeasonPassSnapshot(incomingPass);
  const merged = normalizeSeasonPassSnapshot(current);
  merged.seasonId = String(incoming.seasonId || current.seasonId || SEASON_PASS_ID);
  merged.points = Math.max(current.points || 0, incoming.points || 0);
  merged.premium = !!(current.premium || incoming.premium);
  merged.claimedFree = { ...current.claimedFree, ...incoming.claimedFree };
  merged.claimedPremium = { ...current.claimedPremium, ...incoming.claimedPremium };
  for(const type of ["skin","badge","banner","finisher"]){
    const bucket = seasonCosmeticBucket(type);
    const owned = seasonNormalizeStringList([...(current.owned?.[bucket] || []), ...(incoming.owned?.[bucket] || [])]);
    const catalog = seasonCosmeticCatalog(type);
    merged.owned[bucket] = owned.filter((id)=>!!catalog?.[id]);
    const fallback = defaultSeasonPassState().equipped[type];
    if(!merged.owned[bucket].length) merged.owned[bucket] = [fallback];
    const preferred = String(incoming.equipped?.[type] || current.equipped?.[type] || "");
    merged.equipped[type] = merged.owned[bucket].includes(preferred) ? preferred : merged.owned[bucket][0];
  }
  return merged;
}
function seasonPassLevel(pass=ensureSeasonPassState()){
  const points = Math.max(0, Math.floor(Number(pass?.points || 0)));
  return clamp(Math.floor(points / SEASON_PASS_POINTS_PER_LEVEL) + 1, 1, SEASON_PASS_MAX_LEVEL);
}
function seasonPassProgressPct(pass=ensureSeasonPassState()){
  const points = Math.max(0, Math.floor(Number(pass?.points || 0)));
  const within = points % SEASON_PASS_POINTS_PER_LEVEL;
  return clamp((within / SEASON_PASS_POINTS_PER_LEVEL) * 100, 0, 100);
}
function seasonPassOwnsCosmetic(pass, type, id){
  const bucket = seasonCosmeticBucket(type);
  if(!bucket) return false;
  return !!pass?.owned?.[bucket]?.includes(id);
}
function seasonPassUnlockCosmetic(pass, type, id){
  const catalog = seasonCosmeticCatalog(type);
  const bucket = seasonCosmeticBucket(type);
  if(!catalog || !bucket || !catalog[id]) return false;
  if(!Array.isArray(pass.owned[bucket])) pass.owned[bucket] = [];
  if(pass.owned[bucket].includes(id)) return false;
  pass.owned[bucket].push(id);
  return true;
}
function seasonPassTrackReward(level, track){
  const tier = SEASON_PASS_TRACK.find((row)=>row.level === level);
  if(!tier) return null;
  return track === "premium" ? tier.premium : tier.free;
}
function seasonPassRewardLabel(reward){
  if(!reward) return "Reward";
  const info = seasonRewardDef(reward.type, reward.id);
  const icon = SEASON_PASS_TYPE_ICON[reward.type] || "🎁";
  const name = info?.name || reward.id;
  return `${icon} ${name}`;
}
function seasonPassClaimed(pass, level, track){
  const key = String(level);
  if(track === "premium") return !!pass.claimedPremium[key];
  return !!pass.claimedFree[key];
}
function seasonPassSetClaimed(pass, level, track){
  const key = String(level);
  if(track === "premium") pass.claimedPremium[key] = true;
  else pass.claimedFree[key] = true;
}
function seasonPassBadgeDisplay(pass=ensureSeasonPassState()){
  const badgeId = pass?.equipped?.badge || "BADGE_RECRUIT";
  return SEASON_PASS_BADGES[badgeId] || SEASON_PASS_BADGES.BADGE_RECRUIT;
}
function seasonPassBannerDisplay(pass=ensureSeasonPassState()){
  const bannerId = pass?.equipped?.banner || "BANNER_FOREST_EDGE";
  return SEASON_PASS_BANNERS[bannerId] || SEASON_PASS_BANNERS.BANNER_FOREST_EDGE;
}
function seasonPassFinisherDisplay(pass=ensureSeasonPassState()){
  const finisherId = pass?.equipped?.finisher || "FINISHER_STANDARD";
  return SEASON_PASS_FINISHERS[finisherId] || SEASON_PASS_FINISHERS.FINISHER_STANDARD;
}
function seasonSoldierPalette(state=S){
  const pass = ensureSeasonPassState(state);
  const skinId = pass?.equipped?.skin || "SKIN_FIELD_STANDARD";
  const skin = SEASON_PASS_SKINS[skinId] || SEASON_PASS_SKINS.SKIN_FIELD_STANDARD;
  return skin.palette || SEASON_PASS_SKINS.SKIN_FIELD_STANDARD.palette;
}
function grantSeasonPassPoints(amount, source=""){
  if(window.__TUTORIAL_MODE__) return;
  const pass = ensureSeasonPassState();
  const add = Math.max(0, Math.floor(Number(amount || 0)));
  if(add <= 0) return;
  const before = seasonPassLevel(pass);
  const nextPoints = clamp((pass.points || 0) + add, 0, SEASON_PASS_MAX_POINTS);
  if(nextPoints === pass.points) return;
  pass.points = nextPoints;
  const after = seasonPassLevel(pass);
  if(after > before){
    toast(`Season Pass Level ${after} reached! Claim rewards in Shop > Season.`);
    hapticNotif("success");
  } else if(source && add >= 10){
    setEventText(`Season Pass +${add} • ${source}`, 1.7);
  }
  __savePending = true;
}
function unlockSeasonPremium(){
  const pass = ensureSeasonPassState();
  if(pass.premium) return toast("Season Pass Premium already unlocked.");
  if(S.funds < SEASON_PASS_PREMIUM_PRICE) return toast("Not enough money.");
  S.funds -= SEASON_PASS_PREMIUM_PRICE;
  pass.premium = true;
  sfx("ui"); hapticNotif("success");
  toast("Season Pass Premium unlocked.");
  save();
  renderShopList();
  renderHUD();
}
function claimSeasonPassReward(level, track="free"){
  const pass = ensureSeasonPassState();
  const tier = clamp(Math.floor(Number(level || 0)), 1, SEASON_PASS_MAX_LEVEL);
  const path = track === "premium" ? "premium" : "free";
  if(path === "premium" && !pass.premium) return toast("Unlock Premium Season Pass first.");
  if(seasonPassClaimed(pass, tier, path)) return toast("Reward already claimed.");
  if(seasonPassLevel(pass) < tier) return toast(`Reach Season Pass level ${tier} first.`);
  const reward = seasonPassTrackReward(tier, path);
  if(!reward) return toast("Reward data missing.");
  const unlocked = seasonPassUnlockCosmetic(pass, reward.type, reward.id);
  seasonPassSetClaimed(pass, tier, path);
  const equippedType = reward.type;
  if(!pass.equipped[equippedType] || unlocked){
    pass.equipped[equippedType] = reward.id;
  }
  sfx("ui");
  hapticImpact("light");
  toast(`Claimed: ${seasonPassRewardLabel(reward)}.`);
  save();
  renderShopList();
  renderHUD();
}
function equipSeasonPassCosmetic(type, id){
  const pass = ensureSeasonPassState();
  const bucket = seasonCosmeticBucket(type);
  const catalog = seasonCosmeticCatalog(type);
  if(!bucket || !catalog || !catalog[id]) return toast("Cosmetic not found.");
  if(!seasonPassOwnsCosmetic(pass, type, id)) return toast("Claim this reward first.");
  pass.equipped[type] = id;
  sfx("ui");
  hapticImpact("light");
  toast(`Equipped ${catalog[id].name}.`);
  save();
  renderShopList();
  renderHUD();
}
function applySeasonFinisherVisual(tiger, outcome="KILL"){
  if(!tiger) return;
  const finisher = seasonPassFinisherDisplay();
  const popupKind = outcome === "CAPTURE" ? "tranq" : (finisher.popupKind || "crit");
  const label = finisher.text || finisher.name || "Finish";
  emitDamagePopup(tiger.x, tiger.y - 44, label, popupKind);
  queueImpactPulse(tiger.x, tiger.y - 8, popupKind);
  if(finisher.icon){
    setEventText(`${finisher.icon} ${finisher.name}`, 1.8);
  }
}

// ===================== LONG-TERM MASTERY REWARDS (Cosmetic Only) =====================
const MASTERY_ELITE_TITLES = Object.freeze({
  ELITE_FIELD_WARDEN: { name:"Field Warden", icon:"🛡️" },
  ELITE_PREDATOR_HUNTER: { name:"Predator Hunter", icon:"🐯" },
  ELITE_RESCUE_LEAD: { name:"Rescue Lead", icon:"🚁" },
  ELITE_APEX_COMMANDER: { name:"Apex Commander", icon:"👑" },
});
const MASTERY_TRACKS = Object.freeze([
  { id:"MR_SKIN_FOREST_RANGER", type:"skin", rewardId:"SKIN_FOREST_RANGER", name:"Forest Ops", desc:"Evacuate civilians across Story operations.", metric:"evac", target:18 },
  { id:"MR_BANNER_TRAILBLAZER", type:"banner", rewardId:"BANNER_TRAILBLAZER", name:"Trail Network", desc:"Clear missions to earn command recognition.", metric:"missionsCleared", target:12 },
  { id:"MR_FINISHER_SHOCKWAVE", type:"finisher", rewardId:"FINISHER_SHOCKWAVE", name:"Shock Impact", desc:"Eliminate hostile tigers in active operations.", metric:"kills", target:36 },
  { id:"MR_TITLE_FIELD_WARDEN", type:"elite_title", rewardId:"ELITE_FIELD_WARDEN", name:"Field Warden Title", desc:"Build consistent rescue performance.", metric:"evac", target:60 },
  { id:"MR_SKIN_MIDNIGHT_OPS", type:"skin", rewardId:"SKIN_MIDNIGHT_OPS", name:"Midnight Specialist", desc:"Capture tigers for research and control.", metric:"captures", target:45 },
  { id:"MR_BANNER_COBALT_MARK", type:"banner", rewardId:"BANNER_COBALT_MARK", name:"Cobalt Command", desc:"Increase long-run mission completion.", metric:"missionsCleared", target:35 },
  { id:"MR_FINISHER_CROWN", type:"finisher", rewardId:"FINISHER_CROWN", name:"Crown Takedown", desc:"Master precision captures.", metric:"captures", target:95 },
  { id:"MR_TITLE_PREDATOR_HUNTER", type:"elite_title", rewardId:"ELITE_PREDATOR_HUNTER", name:"Predator Hunter Title", desc:"Raise tiger engagement mastery.", metric:"kills", target:140 },
  { id:"MR_SKIN_GOLDEN_COMMAND", type:"skin", rewardId:"SKIN_GOLDEN_COMMAND", name:"Golden Command", desc:"Develop weapon handling mastery.", metric:"weaponMasteryTotal", target:16 },
  { id:"MR_BANNER_LEGEND_HUNTER", type:"banner", rewardId:"BANNER_LEGEND_HUNTER", name:"Legend Banner", desc:"Complete chapter reward milestones.", metric:"chapterRewards", target:10 },
  { id:"MR_TITLE_RESCUE_LEAD", type:"elite_title", rewardId:"ELITE_RESCUE_LEAD", name:"Rescue Lead Title", desc:"Deliver sustained civilian survival.", metric:"evac", target:160 },
  { id:"MR_TITLE_APEX_COMMANDER", type:"elite_title", rewardId:"ELITE_APEX_COMMANDER", name:"Apex Commander Title", desc:"Reach full campaign mastery.", metric:"missionsCleared", target:100 },
]);
const MASTERY_TRACKS_BY_ID = Object.freeze(MASTERY_TRACKS.reduce((acc, row)=>{
  if(row && row.id) acc[row.id] = row;
  return acc;
}, {}));
function defaultMasteryRewardsState(){
  return {
    claimed: {},
    ownedEliteTitles: [],
    equippedEliteTitle: "",
  };
}
function normalizeMasteryClaimMap(map){
  const src = (map && typeof map === "object") ? map : {};
  const out = {};
  for(const [rawKey, rawVal] of Object.entries(src)){
    if(!rawVal) continue;
    const key = String(rawKey || "").trim();
    if(!key || !MASTERY_TRACKS_BY_ID[key]) continue;
    out[key] = true;
  }
  return out;
}
function normalizeMasteryTitleList(list){
  if(!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for(const raw of list){
    const id = String(raw || "").trim();
    if(!id || seen.has(id) || !MASTERY_ELITE_TITLES[id]) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
function normalizeMasteryRewardsSnapshot(input){
  const base = defaultMasteryRewardsState();
  const src = (input && typeof input === "object") ? input : {};
  const ownedEliteTitles = normalizeMasteryTitleList(src.ownedEliteTitles);
  const preferred = String(src.equippedEliteTitle || "").trim();
  return {
    claimed: normalizeMasteryClaimMap(src.claimed),
    ownedEliteTitles,
    equippedEliteTitle: ownedEliteTitles.includes(preferred) ? preferred : (ownedEliteTitles[0] || base.equippedEliteTitle),
  };
}
function ensureMasteryRewardsState(state=S){
  if(!state || typeof state !== "object"){
    return normalizeMasteryRewardsSnapshot(null);
  }
  state.masteryRewards = normalizeMasteryRewardsSnapshot(state.masteryRewards);
  return state.masteryRewards;
}
function mergeMasteryRewardsSnapshots(currentSnapshot, incomingSnapshot){
  const current = normalizeMasteryRewardsSnapshot(currentSnapshot);
  const incoming = normalizeMasteryRewardsSnapshot(incomingSnapshot);
  const ownedEliteTitles = normalizeMasteryTitleList([
    ...(current.ownedEliteTitles || []),
    ...(incoming.ownedEliteTitles || []),
  ]);
  const preferred = String(incoming.equippedEliteTitle || current.equippedEliteTitle || "").trim();
  return {
    claimed: { ...current.claimed, ...incoming.claimed },
    ownedEliteTitles,
    equippedEliteTitle: ownedEliteTitles.includes(preferred) ? preferred : (ownedEliteTitles[0] || ""),
  };
}
function masteryTrackDef(trackId){
  const key = String(trackId || "").trim();
  return MASTERY_TRACKS_BY_ID[key] || null;
}
function masteryMetricValue(metric, state=S){
  const src = (state && typeof state === "object") ? state : S;
  if(metric === "kills") return Math.max(0, Math.floor(Number(ensureOpsTotalsState(src).kills || 0)));
  if(metric === "captures") return Math.max(0, Math.floor(Number(ensureOpsTotalsState(src).captures || 0)));
  if(metric === "evac") return Math.max(0, Math.floor(Number(ensureOpsTotalsState(src).evac || 0)));
  if(metric === "missionsCleared") return Math.max(0, Math.floor(Number(ensureOpsTotalsState(src).missionsCleared || 0)));
  if(metric === "chapterRewards") return chapterRewardUnlockedCount();
  if(metric === "weaponMasteryTotal"){
    ensureWeaponMasteryState(src);
    let total = 0;
    for(const wid of Object.keys(src.weaponMastery || {})){
      total += weaponMasteryLevelFromXp(src.weaponMastery[wid]);
    }
    return Math.max(0, Math.floor(Number(total || 0)));
  }
  return 0;
}
function masteryMetricLabel(metric){
  if(metric === "kills") return "Tiger kills";
  if(metric === "captures") return "Tiger captures";
  if(metric === "evac") return "Civilians evacuated";
  if(metric === "missionsCleared") return "Missions cleared";
  if(metric === "chapterRewards") return "Chapter rewards unlocked";
  if(metric === "weaponMasteryTotal") return "Total weapon mastery levels";
  return "Progress";
}
function masteryTrackProgress(track, state=S){
  if(!track) return 0;
  return masteryMetricValue(track.metric, state);
}
function masteryTrackClaimed(trackId, state=S){
  const rewards = ensureMasteryRewardsState(state);
  const key = String(trackId || "").trim();
  if(!key) return false;
  return !!rewards.claimed[key];
}
function masteryTrackSetClaimed(trackId, state=S){
  const rewards = ensureMasteryRewardsState(state);
  const key = String(trackId || "").trim();
  if(!key) return;
  rewards.claimed[key] = true;
}
function masteryRewardLabel(track){
  if(!track) return "Reward";
  if(track.type === "elite_title"){
    const title = MASTERY_ELITE_TITLES[track.rewardId];
    if(title) return `${title.icon} ${title.name}`;
    return `Elite Title ${track.rewardId}`;
  }
  const def = seasonRewardDef(track.type, track.rewardId);
  if(def){
    const icon = SEASON_PASS_TYPE_ICON[track.type] || "🎁";
    return `${icon} ${def.name}`;
  }
  return `${SEASON_PASS_TYPE_ICON[track.type] || "🎁"} ${track.rewardId}`;
}
function masteryClaimedCount(state=S){
  const rewards = ensureMasteryRewardsState(state);
  return Object.values(rewards.claimed || {}).filter(Boolean).length;
}
function masteryEliteTitleDisplay(state=S){
  const rewards = ensureMasteryRewardsState(state);
  const id = String(rewards.equippedEliteTitle || "").trim();
  if(!id || !MASTERY_ELITE_TITLES[id]) return null;
  return { id, ...MASTERY_ELITE_TITLES[id] };
}
function effectiveDisplayTitle(state=S){
  const elite = masteryEliteTitleDisplay(state);
  if(elite) return `${elite.icon} ${elite.name}`;
  return String(state?.title || "Rookie");
}
function claimMasteryReward(trackId){
  const track = masteryTrackDef(trackId);
  if(!track) return toast("Mastery reward not found.");
  if(masteryTrackClaimed(track.id)) return toast("Mastery reward already claimed.");
  const progress = masteryTrackProgress(track, S);
  if(progress < track.target){
    return toast(`Not ready. ${masteryMetricLabel(track.metric)} ${progress}/${track.target}.`);
  }

  const rewards = ensureMasteryRewardsState(S);
  const pass = ensureSeasonPassState(S);
  let unlocked = false;
  if(track.type === "elite_title"){
    if(!rewards.ownedEliteTitles.includes(track.rewardId)){
      rewards.ownedEliteTitles.push(track.rewardId);
      unlocked = true;
    }
    rewards.equippedEliteTitle = track.rewardId;
  }else{
    unlocked = seasonPassUnlockCosmetic(pass, track.type, track.rewardId);
    pass.equipped[track.type] = track.rewardId;
  }

  masteryTrackSetClaimed(track.id, S);
  sfx("win");
  hapticNotif("success");
  toast(`Mastery unlocked: ${masteryRewardLabel(track)}${unlocked ? "" : " (already owned, now equipped)."}`);
  setEventText(`🏆 Mastery unlocked • ${track.name}`, 2.3);
  save();
  renderHUD();
  refreshLaunchIntroStatus();
  if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
  if(document.getElementById("invOverlay").style.display === "flex") renderInventory();
}
function equipMasteryEliteTitle(titleId=""){
  const rewards = ensureMasteryRewardsState(S);
  const id = String(titleId || "").trim();
  if(!id){
    rewards.equippedEliteTitle = "";
    sfx("ui");
    hapticImpact("light");
    toast("Base title equipped.");
    save();
    renderHUD();
    refreshLaunchIntroStatus();
    if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
    if(document.getElementById("invOverlay").style.display === "flex") renderInventory();
    return;
  }
  if(!MASTERY_ELITE_TITLES[id]) return toast("Elite title not found.");
  if(!rewards.ownedEliteTitles.includes(id)) return toast("Claim this elite title from Mastery first.");
  rewards.equippedEliteTitle = id;
  sfx("ui");
  hapticImpact("light");
  toast(`Equipped ${MASTERY_ELITE_TITLES[id].name}.`);
  save();
  renderHUD();
  refreshLaunchIntroStatus();
  if(document.getElementById("shopOverlay").style.display === "flex") renderShopList();
  if(document.getElementById("invOverlay").style.display === "flex") renderInventory();
}

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
const WEAPON_MASTERY_THRESHOLDS = Object.freeze([0, 120, 320, 680, 1180, 1900]);
const WEAPON_MASTERY_MAX_LEVEL = WEAPON_MASTERY_THRESHOLDS.length - 1;
const WEAPON_MASTERY_JAM_REDUCTION_PER_LEVEL = 0.055;
const WEAPON_MASTERY_RELOAD_SMOOTH_PER_LEVEL = 0.02;

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
const BOSS_SIGNATURE_MOMENT_BY_CHAPTER = Object.freeze({
  1: "Howl Call pressure — expect Standard reinforcement packs.",
  2: "War Roar into Rage Charge — burst aggression spikes.",
  3: "Shadow Fade into Pounce Chain — stealth lunge pattern.",
  4: "Pounce Chain plus War Roar — rapid close-range pressure.",
  5: "Rage Charge and Howl Call — split focus under reinforcement.",
  6: "Mountain charge bursts with pounce follow-up windows.",
  7: "Reinforcement marshal: Howl Call with roar-charge pacing.",
  8: "Tiger King rotation: roar, pounce, reinforce, and charge.",
  9: "Phantom cycle: stealth bait into charge and pounce.",
  10: "Ancient Tiger multi-phase chain: roar, stealth, reinforce, charge.",
});
const BOSS_PHASE_PRESETS = Object.freeze({
  1: { name:"Opening Pressure", cdMul:1.00, dmgMul:1.00, tempoMul:1.00, reinforceAdd:0, pounceExtra:0 },
  2: { name:"Rage Escalation", cdMul:0.84, dmgMul:1.12, tempoMul:1.12, reinforceAdd:1, pounceExtra:1 },
  3: { name:"Final Fury", cdMul:0.72, dmgMul:1.24, tempoMul:1.24, reinforceAdd:2, pounceExtra:1 },
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
  if(S.mode==="Story") return storyMissionForState(S);
  if(S.mode==="Arcade") return activeArcadeMission(S);
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
function bossPhaseCount(t){
  return clamp(Math.floor(Number(t?.bossPhases || 1)), 1, 3);
}
function bossPhaseFromHp(t){
  if(!isBossTiger(t)) return 1;
  const total = bossPhaseCount(t);
  const hpMax = Math.max(1, Number(t?.hpMax || 1));
  const ratio = clamp(Number(t?.hp || 0) / hpMax, 0, 1);
  if(total >= 3){
    if(ratio <= 0.35) return 3;
    if(ratio <= 0.70) return 2;
    return 1;
  }
  if(total === 2){
    return ratio <= 0.55 ? 2 : 1;
  }
  return 1;
}
function bossPhasePreset(phase=1){
  return BOSS_PHASE_PRESETS[clamp(Math.floor(Number(phase || 1)), 1, 3)] || BOSS_PHASE_PRESETS[1];
}
function bossPhaseSummaryText(phase, total){
  if(phase >= total){
    return "Phase 3. Howl Call active: reinforcements join the fight.";
  }
  if(phase === 2){
    return "Phase 2. War Roar phase: aggression and damage are buffed.";
  }
  return "Phase 1. Stalk phase: boss prowls and sets up attacks.";
}
function uniqueBossSkillCycle(skills){
  const out = [];
  const seen = new Set();
  for(const skill of (skills || [])){
    if(typeof skill !== "string" || !skill) continue;
    if(seen.has(skill)) continue;
    seen.add(skill);
    out.push(skill);
  }
  return out.length ? out : ["roar"];
}
function bossSkillCycleForPhase(profile, t){
  const base = uniqueBossSkillCycle(Array.isArray(profile?.cycle) && profile.cycle.length ? profile.cycle : ["roar"]);
  const total = bossPhaseCount(t);
  const phase = clamp(Math.floor(Number(t?.bossPhaseIndex || bossPhaseFromHp(t))), 1, total);
  const phaseOneLead = base.includes("stealth") ? "stealth" : "stalk";
  const burstLead = base.includes("pounce_chain")
    ? "pounce_chain"
    : (base.includes("charge") ? "charge" : "stalk");

  // Enforce cinematic boss progression:
  // Phase 1 = stalk opener, Phase 2 = roar pressure, Phase 3 = reinforcement pressure.
  if(phase <= 1){
    return uniqueBossSkillCycle([
      phaseOneLead,
      "stalk",
      ...base.filter((s)=>s!=="reinforce" && s!=="roar"),
      "roar"
    ]);
  }
  if(phase === 2){
    return uniqueBossSkillCycle([
      "roar",
      burstLead,
      ...base.filter((s)=>s!=="reinforce"),
      "stalk"
    ]);
  }
  return uniqueBossSkillCycle([
    "reinforce",
    "roar",
    burstLead,
    "pounce_chain",
    "charge",
    "stalk",
    ...base
  ]);
}
function ensureBossPhaseState(t, profile, now=Date.now(), opts={}){
  if(!t || !isBossTiger(t)) return 1;
  const total = bossPhaseCount(t);
  const nextPhase = bossPhaseFromHp(t);
  const prevPhase = clamp(Math.floor(Number(t.bossPhaseIndex || 1)), 1, total);
  t.bossPhaseIndex = nextPhase;
  if(prevPhase === nextPhase) return nextPhase;

  t._bossWarnForSkillAt = 0;
  t.bossSkillStep = 0;
  if(!Number.isFinite(t.nextBossSkillAt) || t.nextBossSkillAt > (now + 1200)){
    t.nextBossSkillAt = now + rand(520, 880);
  }
  setTigerIntent(t, `Phase ${nextPhase}`, 980);

  if(!opts.silent){
    const msg = `⚠️ ${profile?.name || "Boss"} Phase ${nextPhase}/${total}: ${bossPhaseSummaryText(nextPhase, total)}`;
    setEventText(msg, nextPhase >= total ? 4.2 : 3.4);
    if(S.inBattle && S.activeTigerId === t.id){
      setBattleMsg(msg);
    }
  }
  return nextPhase;
}
function bossSkillTelegraphText(skill, opts={}){
  const incoming = opts.incoming !== false;
  if(skill === "stalk") return incoming ? "Stalk phase incoming — boss is circling for an opening." : "Stalk phase active.";
  if(skill === "roar") return incoming ? "War Roar incoming — nearby tigers get buffed." : "War Roar active.";
  if(skill === "stealth") return incoming ? "Shadow Fade incoming — watch for a stealth lunge." : "Shadow Fade active.";
  if(skill === "pounce_chain") return incoming ? "Pounce Chain incoming — prepare for rapid leaps." : "Pounce Chain active.";
  if(skill === "reinforce") return incoming ? "Howl Call incoming — reinforcements may arrive." : "Howl Call active.";
  if(skill === "charge") return incoming ? "Rage Charge incoming — roll to dodge the hit." : "Rage Charge active.";
  return incoming ? "Boss skill incoming." : "Boss skill active.";
}
function bossChapterSignatureSummary(chapter, profile){
  const text = BOSS_SIGNATURE_MOMENT_BY_CHAPTER[clamp(chapter || 1, 1, 10)];
  if(text) return text;
  const cycle = Array.isArray(profile?.cycle) ? profile.cycle : [];
  const preview = cycle.slice(0, 2).map((skill)=>bossCycleLabel(skill)).join(" -> ");
  return preview ? `${preview}.` : "Signature pressure expected.";
}
function nextBossSkillInCycle(t, profile){
  const cycle = bossSkillCycleForPhase(profile, t);
  const idx = Number.isFinite(t?.bossSkillStep) ? t.bossSkillStep : 0;
  return cycle[idx % cycle.length];
}
function announceBossTelegraph(t, profile, skill, now=Date.now(), opts={}){
  if(!t || !profile || !skill) return;
  const tellKey = `${skill}|${opts.incoming ? "in" : "now"}`;
  const minGap = opts.incoming ? 1200 : 700;
  if(t._bossLastTellKey === tellKey && now < ((t._bossLastTellAt || 0) + minGap)) return;
  t._bossLastTellKey = tellKey;
  t._bossLastTellAt = now;
  const chapter = clamp(t.bossIdentityChapter || bossChapterIndex(), 1, 10);
  const msg = `⚠️ ${profile.name} (${chapter}): ${bossSkillTelegraphText(skill, opts)}`;
  setTigerIntent(t, bossCycleLabel(skill), opts.incoming ? 880 : 640);
  if(S.inBattle && S.activeTigerId === t.id){
    setBattleMsg(msg);
  } else {
    setEventText(msg, opts.incoming ? 2.8 : 2.2);
  }
}
function triggerBossPrefightWarning(t, profile, now=Date.now()){
  if(!t || !profile || !isBossTiger(t)) return;
  if((t._bossPrefightWarnedAt || 0) > 0 && now < ((t._bossPrefightWarnedAt || 0) + 25000)) return;
  ensureBossPhaseState(t, profile, now, { silent:true });
  t._bossPrefightWarnedAt = now;
  const chapter = clamp(t.bossIdentityChapter || bossChapterIndex(), 1, 10);
  const summary = bossChapterSignatureSummary(chapter, profile);
  const warning = `⚠️ Boss Signature — ${profile.name}: ${summary}`;
  setEventText(warning, 4.5);
  if(S.inBattle && S.activeTigerId === t.id){
    setBattleMsg(warning);
  }
  if(!Number.isFinite(t.nextBossSkillAt) || t.nextBossSkillAt > (now + 5200)){
    t.nextBossSkillAt = now + rand(1200, 1900);
  }
  t._bossWarnForSkillAt = 0;
}
function triggerBossIdentitySkill(t, profile, now=Date.now()){
  if(!t || !profile) return;
  const phase = ensureBossPhaseState(t, profile, now, { silent:true });
  const phaseCfg = bossPhasePreset(phase);
  const cycle = bossSkillCycleForPhase(profile, t);
  const idx = Number.isFinite(t.bossSkillStep) ? t.bossSkillStep : 0;
  const skill = cycle[idx % cycle.length];
  t.bossSkillStep = idx + 1;
  t._bossWarnForSkillAt = 0;
  announceBossTelegraph(t, profile, skill, now, { incoming:false });

  if(skill === "stalk"){
    const stalkMul = phase >= 3 ? 1.24 : (phase >= 2 ? 1.12 : 1);
    const stalkMs = Math.round(rand(1700, 2600) * stalkMul);
    t.bossStalkUntil = Math.max(t.bossStalkUntil || 0, now + stalkMs);
    setTigerHuntState(t, TIGER_HUNT_STATES.STALK, now, stalkMs);
    t.burstUntil = Math.max(t.burstUntil || 0, now + Math.round(stalkMs * 0.72));
    t.enragedUntil = Math.max(t.enragedUntil || 0, now + Math.round(stalkMs * 0.42));
    setTigerIntent(t, "Stalk", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is stalking for an opening.`);
  } else if(skill === "roar"){
    const rageMul = phase >= 3 ? 1.28 : (phase >= 2 ? 1.14 : 1);
    t.roarUntil = Math.max(t.roarUntil || 0, now + Math.round(rand(2500, 3600) * rageMul));
    t.enragedUntil = Math.max(t.enragedUntil || 0, now + Math.round(rand(3200, 4700) * rageMul));
    setTigerIntent(t, "War Roar", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} uses War Roar.`);
  } else if(skill === "stealth"){
    const stealthMul = phase >= 3 ? 1.18 : (phase >= 2 ? 1.08 : 1);
    t.bossStealthUntil = Math.max(t.bossStealthUntil || 0, now + Math.round(rand(1700, 2600) * stealthMul));
    t.burstUntil = Math.max(t.burstUntil || 0, (t.bossStealthUntil || 0) + rand(420, 760));
    setTigerIntent(t, "Shadow Fade", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} entered stealth phase.`);
  } else if(skill === "pounce_chain"){
    const bonusCharges = Math.max(0, Math.floor(Number(phaseCfg.pounceExtra || 0)));
    t.bossPounceCharges = rand(2 + bonusCharges, 3 + bonusCharges);
    t.bossPounceChainUntil = now + rand(2400, 3400);
    t.nextPounceAt = now + rand(120, 260);
    setTigerIntent(t, `Pounce x${t.bossPounceCharges}`, 900);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is chaining pounces.`);
  } else if(skill === "charge"){
    const chargeMul = phase >= 3 ? 1.18 : (phase >= 2 ? 1.08 : 1);
    t.bossChargeUntil = now + Math.round(rand(2000, 3200) * chargeMul);
    t.enragedUntil = Math.max(t.enragedUntil || 0, t.bossChargeUntil + 900);
    setTigerIntent(t, "Rage Charge", 860);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is charging.`);
  } else if(skill === "reinforce"){
    const phasePull = phase >= 3 ? 0 : (phase >= 2 ? 35 : 70);
    t.nextReinforceAt = Math.min(t.nextReinforceAt || (now + phasePull), now + phasePull);
    setTigerIntent(t, "Howl Call", 820);
    if(S.inBattle && S.activeTigerId === t.id) setBattleMsg(`${profile.name} is calling reinforcements.`);
  }

  const cd = profile.cd || [9000, 13000];
  const levelScale = clamp(1 - (Math.max(1, currentCampaignLevel()) - 1) * 0.005, 0.68, 1);
  const phaseCdMul = clamp(Number(phaseCfg.cdMul || 1), 0.66, 1.05);
  const cdMin = Math.round(cd[0] * levelScale * phaseCdMul);
  const cdMax = Math.max(cdMin + 250, Math.round(cd[1] * levelScale * phaseCdMul));
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
    const phase = ensureBossPhaseState(t, profile, now);
    const phaseCfg = bossPhasePreset(phase);
    if(!Number.isFinite(t.nextBossSkillAt) || t.nextBossSkillAt <= 0){
      const cd = profile.cd || [9000, 13000];
      const phaseCdMul = clamp(Number(phaseCfg.cdMul || 1), 0.66, 1.05);
      t.nextBossSkillAt = now + rand(
        Math.round(cd[0] * phaseCdMul),
        Math.round(cd[1] * phaseCdMul)
      );
      t.bossSkillStep = 0;
      t._bossWarnForSkillAt = 0;
      continue;
    }
    const warnLead = phase >= 3 ? 1200 : (phase >= 2 ? 1000 : 900);
    const warnAt = t.nextBossSkillAt - warnLead;
    if(now >= warnAt && now < t.nextBossSkillAt){
      if((t._bossWarnForSkillAt || 0) !== t.nextBossSkillAt){
        const nextSkill = nextBossSkillInCycle(t, profile);
        announceBossTelegraph(t, profile, nextSkill, now, { incoming:true });
        t._bossWarnForSkillAt = t.nextBossSkillAt;
      }
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
function tigerLevelDamageMul(target="player"){
  const lv = Math.max(1, currentCampaignLevel());
  if(lv <= 1) return 1;
  if(S.mode === "Story"){
    if(target === "civilian") return clamp(1 + ((lv - 1) * 0.004), 1, 1.35);
    if(target === "support") return clamp(1 + ((lv - 1) * 0.009), 1, 1.85);
    return clamp(1 + ((lv - 1) * 0.010), 1, 1.95);
  }
  if(S.mode === "Arcade"){
    if(target === "civilian") return clamp(1 + ((lv - 1) * 0.005), 1, 1.45);
    if(target === "support") return clamp(1 + ((lv - 1) * 0.010), 1, 1.95);
    return clamp(1 + ((lv - 1) * 0.011), 1, 2.05);
  }
  // Survival ramps fastest.
  if(target === "civilian") return clamp(1 + ((lv - 1) * 0.006), 1, 1.55);
  if(target === "support") return clamp(1 + ((lv - 1) * 0.012), 1, 2.10);
  return clamp(1 + ((lv - 1) * 0.013), 1, 2.20);
}
function tigerLevelDefenseMul(t){
  const lv = Math.max(1, currentCampaignLevel());
  if(lv <= 1) return 1;
  let base = 1;
  if(S.mode === "Story") base = clamp(1 + ((lv - 1) * 0.014), 1, 2.10);
  else if(S.mode === "Arcade") base = clamp(1 + ((lv - 1) * 0.016), 1, 2.25);
  else base = clamp(1 + ((lv - 1) * 0.018), 1, 2.40);
  if(isBossTiger(t)){
    base *= clamp(1.12 + ((lv - 1) * 0.0025), 1.12, 1.38);
  } else if(t?.type === "Alpha"){
    base *= clamp(1.05 + ((lv - 1) * 0.0015), 1.05, 1.20);
  }
  return base;
}
function tigerDamageScale(t, target="player"){
  const table = TIGER_DAMAGE_SCALES[target] || TIGER_DAMAGE_SCALES.player;
  const idx = clamp(tigerPowerRank(t) - 1, 0, table.length - 1);
  let scale = table[idx] * tigerLevelDamageMul(target);
  const nemesisDamageMul = clamp(Number(t?.nemesisDamageMul || 1), 0.7, 2);
  if(nemesisDamageMul > 1){
    scale *= nemesisDamageMul;
  } else if(Number(t?.nemesisPower || 0) > 0){
    scale *= clamp(1 + (Number(t.nemesisPower || 0) * 0.04), 1, 1.42);
  }
  const lv = Math.max(1, currentCampaignLevel());
  if(target === "civilian"){
    if(isBossTiger(t)) scale *= clamp(1.16 + ((lv - 1) * 0.003), 1.16, 1.45);
    else if(t?.type === "Alpha") scale *= clamp(1.08 + ((lv - 1) * 0.002), 1.08, 1.28);
  } else {
    if(isBossTiger(t)) scale *= clamp(1.08 + ((lv - 1) * 0.002), 1.08, 1.30);
    else if(t?.type === "Alpha") scale *= clamp(1.04 + ((lv - 1) * 0.001), 1.04, 1.18);
  }
  if(isBossTiger(t)){
    const phase = clamp(Math.floor(Number(t?.bossPhaseIndex || bossPhaseFromHp(t))), 1, bossPhaseCount(t));
    const phaseCfg = bossPhasePreset(phase);
    if(target === "civilian") scale *= (phase >= 3 ? 1.12 : (phase >= 2 ? 1.06 : 1));
    else if(target === "support") scale *= (phase >= 3 ? 1.15 : (phase >= 2 ? 1.08 : 1));
    else scale *= clamp(Number(phaseCfg.dmgMul || 1), 1, 1.30);
  }
  return scale;
}
function tigerDefenseScale(t){
  const idx = clamp(tigerPowerRank(t) - 1, 0, TIGER_DEFENSE_SCALES.length - 1);
  let scale = TIGER_DEFENSE_SCALES[idx] * tigerLevelDefenseMul(t);
  const nemesisDefenseMul = clamp(Number(t?.nemesisDefenseMul || 1), 0.7, 2);
  if(nemesisDefenseMul > 1){
    scale *= nemesisDefenseMul;
  } else if(Number(t?.nemesisPower || 0) > 0){
    scale *= clamp(1 + (Number(t.nemesisPower || 0) * 0.03), 1, 1.35);
  }
  return scale;
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

const BIOME_HAZARD_DEFAULTS = Object.freeze({
  waterSpeedMul: 1,
  staminaDrainMul: 1,
  tigerAggroMul: 1,
  tigerSpeedMul: 1,
  fogPulseEveryMs: 0,
  fogPulseDurationMs: 0,
});

const CHAPTER_BIOME_PROFILES = {
  Story: [
    {
      biome: "Rainforest Fringe",
      weather: "Monsoon Drizzle",
      weatherFx: "rain",
      weatherIntensity: 0.56,
      hazardShort: "Muddy trails",
      hazards: { waterSpeedMul:0.97, staminaDrainMul:1.02, tigerAggroMul:1.00, tigerSpeedMul:1.01, fogPulseEveryMs:0, fogPulseDurationMs:0 },
    },
    {
      biome: "Blood Marsh",
      weather: "Heavy Rain",
      weatherFx: "rain",
      weatherIntensity: 0.74,
      hazardShort: "Blood scent carries farther",
      hazards: { waterSpeedMul:0.93, staminaDrainMul:1.05, tigerAggroMul:1.05, tigerSpeedMul:1.03, fogPulseEveryMs:26000, fogPulseDurationMs:3000 },
    },
    {
      biome: "Canopy Mist",
      weather: "Dense Mist",
      weatherFx: "mist",
      weatherIntensity: 0.82,
      hazardShort: "Fog banks reduce vision",
      hazards: { waterSpeedMul:0.96, staminaDrainMul:1.03, tigerAggroMul:1.03, tigerSpeedMul:1.02, fogPulseEveryMs:16000, fogPulseDurationMs:5200 },
    },
    {
      biome: "Ember Streets",
      weather: "Smoke Haze",
      weatherFx: "ash",
      weatherIntensity: 0.54,
      hazardShort: "Debris and smoke pockets",
      hazards: { waterSpeedMul:1.00, staminaDrainMul:1.04, tigerAggroMul:1.06, tigerSpeedMul:1.03, fogPulseEveryMs:22000, fogPulseDurationMs:3400 },
    },
    {
      biome: "Floodplain Delta",
      weather: "River Squalls",
      weatherFx: "rain",
      weatherIntensity: 0.72,
      hazardShort: "Floodwater drag",
      hazards: { waterSpeedMul:0.90, staminaDrainMul:1.06, tigerAggroMul:1.04, tigerSpeedMul:1.04, fogPulseEveryMs:0, fogPulseDurationMs:0 },
    },
    {
      biome: "Alpine Ridge",
      weather: "Snow Gusts",
      weatherFx: "snow",
      weatherIntensity: 0.70,
      hazardShort: "Cold drains stamina",
      hazards: { waterSpeedMul:0.95, staminaDrainMul:1.10, tigerAggroMul:1.05, tigerSpeedMul:1.06, fogPulseEveryMs:18000, fogPulseDurationMs:2600 },
    },
    {
      biome: "Cave Wilds",
      weather: "Dust Drafts",
      weatherFx: "dust",
      weatherIntensity: 0.62,
      hazardShort: "Echo ambush lanes",
      hazards: { waterSpeedMul:0.98, staminaDrainMul:1.05, tigerAggroMul:1.08, tigerSpeedMul:1.08, fogPulseEveryMs:24000, fogPulseDurationMs:3000 },
    },
    {
      biome: "Warfire Jungle",
      weather: "Ashfall",
      weatherFx: "ash",
      weatherIntensity: 0.86,
      hazardShort: "Heat fatigue",
      hazards: { waterSpeedMul:1.00, staminaDrainMul:1.11, tigerAggroMul:1.10, tigerSpeedMul:1.10, fogPulseEveryMs:15000, fogPulseDurationMs:3600 },
    },
    {
      biome: "Hidden Wetlands",
      weather: "Thunderstorm",
      weatherFx: "storm",
      weatherIntensity: 0.94,
      hazardShort: "Storm surge pressure",
      hazards: { waterSpeedMul:0.92, staminaDrainMul:1.08, tigerAggroMul:1.14, tigerSpeedMul:1.13, fogPulseEveryMs:14000, fogPulseDurationMs:4300 },
    },
    {
      biome: "Ancient Temple Storm",
      weather: "Eclipse Tempest",
      weatherFx: "storm",
      weatherIntensity: 1.00,
      hazardShort: "Relic storm frenzy",
      hazards: { waterSpeedMul:0.94, staminaDrainMul:1.12, tigerAggroMul:1.18, tigerSpeedMul:1.16, fogPulseEveryMs:12000, fogPulseDurationMs:4600 },
    },
  ],
  Arcade: [
    {
      biome: "Trial Savannah",
      weather: "Dry Crosswinds",
      weatherFx: "dust",
      weatherIntensity: 0.40,
      hazardShort: "Loose footing",
      hazards: { waterSpeedMul:0.99, staminaDrainMul:1.02, tigerAggroMul:1.01, tigerSpeedMul:1.02, fogPulseEveryMs:0, fogPulseDurationMs:0 },
    },
    {
      biome: "Red Monsoon",
      weather: "Heavy Rain",
      weatherFx: "rain",
      weatherIntensity: 0.78,
      hazardShort: "Slippery lanes",
      hazards: { waterSpeedMul:0.92, staminaDrainMul:1.05, tigerAggroMul:1.06, tigerSpeedMul:1.04, fogPulseEveryMs:22000, fogPulseDurationMs:2800 },
    },
    {
      biome: "Fogfang Grove",
      weather: "Dense Mist",
      weatherFx: "mist",
      weatherIntensity: 0.80,
      hazardShort: "Vision pockets",
      hazards: { waterSpeedMul:0.96, staminaDrainMul:1.04, tigerAggroMul:1.05, tigerSpeedMul:1.04, fogPulseEveryMs:15500, fogPulseDurationMs:5000 },
    },
    {
      biome: "Urban Ashbelt",
      weather: "Smoke Drift",
      weatherFx: "ash",
      weatherIntensity: 0.62,
      hazardShort: "Heat haze pressure",
      hazards: { waterSpeedMul:1.00, staminaDrainMul:1.06, tigerAggroMul:1.08, tigerSpeedMul:1.06, fogPulseEveryMs:21000, fogPulseDurationMs:3200 },
    },
    {
      biome: "Floodway Sector",
      weather: "River Storm",
      weatherFx: "rain",
      weatherIntensity: 0.80,
      hazardShort: "Floodwater slowdown",
      hazards: { waterSpeedMul:0.89, staminaDrainMul:1.07, tigerAggroMul:1.08, tigerSpeedMul:1.07, fogPulseEveryMs:0, fogPulseDurationMs:0 },
    },
    {
      biome: "Frost Pass",
      weather: "Snow Gusts",
      weatherFx: "snow",
      weatherIntensity: 0.78,
      hazardShort: "Cold burn stamina",
      hazards: { waterSpeedMul:0.94, staminaDrainMul:1.11, tigerAggroMul:1.09, tigerSpeedMul:1.09, fogPulseEveryMs:17000, fogPulseDurationMs:2600 },
    },
    {
      biome: "Dust Tunnel",
      weather: "Sand Drafts",
      weatherFx: "dust",
      weatherIntensity: 0.68,
      hazardShort: "Sandblast drift",
      hazards: { waterSpeedMul:0.98, staminaDrainMul:1.07, tigerAggroMul:1.10, tigerSpeedMul:1.11, fogPulseEveryMs:23000, fogPulseDurationMs:2900 },
    },
    {
      biome: "War Ember Basin",
      weather: "Ashfall",
      weatherFx: "ash",
      weatherIntensity: 0.90,
      hazardShort: "Heatwave spikes",
      hazards: { waterSpeedMul:1.00, staminaDrainMul:1.12, tigerAggroMul:1.13, tigerSpeedMul:1.12, fogPulseEveryMs:14500, fogPulseDurationMs:3500 },
    },
    {
      biome: "Tempest Frontier",
      weather: "Thunderstorm",
      weatherFx: "storm",
      weatherIntensity: 0.98,
      hazardShort: "Storm hunt pressure",
      hazards: { waterSpeedMul:0.91, staminaDrainMul:1.09, tigerAggroMul:1.16, tigerSpeedMul:1.14, fogPulseEveryMs:13200, fogPulseDurationMs:4200 },
    },
    {
      biome: "Rift Citadel",
      weather: "Eclipse Tempest",
      weatherFx: "storm",
      weatherIntensity: 1.00,
      hazardShort: "Final surge",
      hazards: { waterSpeedMul:0.93, staminaDrainMul:1.12, tigerAggroMul:1.20, tigerSpeedMul:1.18, fogPulseEveryMs:11800, fogPulseDurationMs:4600 },
    },
  ],
  Survival: [
    {
      biome: "Night Woods",
      weather: "Fog Drift",
      weatherFx: "mist",
      weatherIntensity: 0.58,
      hazardShort: "Roaming fog pockets",
      hazards: { waterSpeedMul:0.98, staminaDrainMul:1.02, tigerAggroMul:1.02, tigerSpeedMul:1.02, fogPulseEveryMs:25000, fogPulseDurationMs:2500 },
    },
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

function weeklyChallengeWeekKey(nowMs=Date.now()){
  return contractWeekKey(nowMs);
}
function weeklySeedRng(seedText){
  let s = (contractHashInt(seedText) >>> 0) || 1;
  return ()=>{
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function ensureArcadeWeeklySeedState(state=S){
  if(!state || typeof state !== "object"){
    return {
      arcadeWeeklySeedEnabled:false,
      arcadeWeeklySeedKey:weeklyChallengeWeekKey(),
      arcadeWeeklyBestByWeek:{},
      arcadeWeeklyLastResult:null
    };
  }
  state.arcadeWeeklySeedEnabled = !!state.arcadeWeeklySeedEnabled;
  const currentWeek = weeklyChallengeWeekKey();
  const rawWeek = String(state.arcadeWeeklySeedKey || "").trim();
  state.arcadeWeeklySeedKey = rawWeek || currentWeek;
  if(state.arcadeWeeklySeedKey !== currentWeek){
    state.arcadeWeeklySeedKey = currentWeek;
  }
  const rawBest = (state.arcadeWeeklyBestByWeek && typeof state.arcadeWeeklyBestByWeek === "object")
    ? state.arcadeWeeklyBestByWeek
    : {};
  const normalizedBest = {};
  for(const [weekKey, row] of Object.entries(rawBest)){
    if(!/^\d{4}-W\d{2}$/.test(String(weekKey || "").trim())) continue;
    if(!row || typeof row !== "object") continue;
    normalizedBest[weekKey] = {
      weekKey:String(row.weekKey || weekKey),
      score:Math.max(0, Math.floor(Number(row.score || 0))),
      clearSec:Math.max(0, Math.floor(Number(row.clearSec || 0))),
      civiliansSaved:Math.max(0, Math.floor(Number(row.civiliansSaved || 0))),
      civiliansTotal:Math.max(0, Math.floor(Number(row.civiliansTotal || 0))),
      missionSeedKey:String(row.missionSeedKey || weekKey),
      runId:String(row.runId || ""),
      updatedAt:Math.max(0, Math.floor(Number(row.updatedAt || 0))),
    };
  }
  const keepKeys = Object.keys(normalizedBest).sort().reverse().slice(0, 24);
  const trimmedBest = {};
  for(const k of keepKeys) trimmedBest[k] = normalizedBest[k];
  state.arcadeWeeklyBestByWeek = trimmedBest;
  const last = (state.arcadeWeeklyLastResult && typeof state.arcadeWeeklyLastResult === "object")
    ? state.arcadeWeeklyLastResult
    : null;
  state.arcadeWeeklyLastResult = last ? {
    weekKey:String(last.weekKey || state.arcadeWeeklySeedKey),
    score:Math.max(0, Math.floor(Number(last.score || 0))),
    clearSec:Math.max(0, Math.floor(Number(last.clearSec || 0))),
    civiliansSaved:Math.max(0, Math.floor(Number(last.civiliansSaved || 0))),
    civiliansTotal:Math.max(0, Math.floor(Number(last.civiliansTotal || 0))),
    missionSeedKey:String(last.missionSeedKey || state.arcadeWeeklySeedKey),
    runId:String(last.runId || ""),
    updatedAt:Math.max(0, Math.floor(Number(last.updatedAt || 0))),
  } : null;
  state.arcadeWeeklyRunId = String(state.arcadeWeeklyRunId || "");
  state.arcadeWeeklyRunStartedAt = Math.max(0, Math.floor(Number(state.arcadeWeeklyRunStartedAt || 0)));
  return state;
}
function weeklySeedResultIsBetter(nextResult, currentResult){
  if(!currentResult) return true;
  const nextScore = Math.max(0, Math.floor(Number(nextResult?.score || 0)));
  const curScore = Math.max(0, Math.floor(Number(currentResult?.score || 0)));
  if(nextScore !== curScore) return nextScore > curScore;
  const nextSaved = Math.max(0, Math.floor(Number(nextResult?.civiliansSaved || 0)));
  const curSaved = Math.max(0, Math.floor(Number(currentResult?.civiliansSaved || 0)));
  if(nextSaved !== curSaved) return nextSaved > curSaved;
  const nextSec = Math.max(0, Math.floor(Number(nextResult?.clearSec || 0))) || 999999;
  const curSec = Math.max(0, Math.floor(Number(currentResult?.clearSec || 0))) || 999999;
  if(nextSec !== curSec) return nextSec < curSec;
  const nextAt = Math.max(0, Math.floor(Number(nextResult?.updatedAt || 0)));
  const curAt = Math.max(0, Math.floor(Number(currentResult?.updatedAt || 0)));
  return nextAt > curAt;
}
function arcadeWeeklyBestForWeek(state=S, weekKey=""){
  ensureArcadeWeeklySeedState(state);
  const wk = String(weekKey || state.arcadeWeeklySeedKey || weeklyChallengeWeekKey()).trim();
  const map = (state.arcadeWeeklyBestByWeek && typeof state.arcadeWeeklyBestByWeek === "object")
    ? state.arcadeWeeklyBestByWeek
    : {};
  return (wk && map[wk]) ? map[wk] : null;
}
function recordArcadeWeeklyResult(result, state=S){
  ensureArcadeWeeklySeedState(state);
  if(!result || typeof result !== "object") return null;
  const wk = String(result.weekKey || state.arcadeWeeklySeedKey || weeklyChallengeWeekKey()).trim() || weeklyChallengeWeekKey();
  const normalized = {
    weekKey:wk,
    score:Math.max(0, Math.floor(Number(result.score || 0))),
    clearSec:Math.max(0, Math.floor(Number(result.clearSec || 0))),
    civiliansSaved:Math.max(0, Math.floor(Number(result.civiliansSaved || 0))),
    civiliansTotal:Math.max(0, Math.floor(Number(result.civiliansTotal || 0))),
    missionSeedKey:String(result.missionSeedKey || wk),
    runId:String(result.runId || state.arcadeWeeklyRunId || ""),
    updatedAt:Math.max(0, Math.floor(Number(result.updatedAt || Date.now()))),
  };
  const current = arcadeWeeklyBestForWeek(state, wk);
  const better = weeklySeedResultIsBetter(normalized, current);
  if(better){
    state.arcadeWeeklyBestByWeek[wk] = normalized;
  }
  state.arcadeWeeklyLastResult = normalized;
  return {
    better,
    current:normalized,
    best:arcadeWeeklyBestForWeek(state, wk) || normalized
  };
}
function arcadeWeeklyChallengeMission(state=S){
  ensureArcadeWeeklySeedState(state);
  const weekKey = String(state.arcadeWeeklySeedKey || weeklyChallengeWeekKey()).trim() || weeklyChallengeWeekKey();
  const weekNum = clamp(parseInt(weekKey.split("-W")[1], 10) || 1, 1, 53);
  const chapter = clamp(((weekNum - 1) % 10) + 1, 1, 10);
  const levelSeed = clamp(((chapter - 1) * 10) + ((contractHashInt(`${weekKey}|level`) % 10) + 1), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  const base = arcadeCampaignMission(levelSeed);
  const rngCfg = weeklySeedRng(`arcade_weekly_cfg|${weekKey}`);
  const civBump = Math.floor(rngCfg() * 3) - 1;
  const tigerBump = Math.floor(rngCfg() * 3) - 1;
  const forceCapture = rngCfg() > 0.62;
  const forceTrap = rngCfg() > 0.70;
  const cfg = {
    ...base,
    weeklySeed:true,
    weeklySeedKey:weekKey,
    weeklySeedChapter:chapter,
    number:levelSeed,
    chapter,
    chapterName:`Weekly Seed C${chapter}`,
  };
  cfg.civilians = clamp((base.civilians || 3) + civBump, 2, 12);
  cfg.tigers = clamp((base.tigers || 3) + tigerBump, 2, 16);
  if(forceCapture && cfg.captureRequired <= 0) cfg.captureRequired = 1;
  if(forceTrap && cfg.trapPlaceRequired <= 0) cfg.trapPlaceRequired = 1;
  const directives = [
    `${cfg.civilians} civilians`,
    `${cfg.tigers} tigers`,
  ];
  if(cfg.captureRequired > 0) directives.push(`capture ${cfg.captureRequired}`);
  if(cfg.captureOnly) directives.push("no tiger kills");
  if(cfg.trapPlaceRequired > 0) directives.push(`set ${cfg.trapPlaceRequired} trap${cfg.trapPlaceRequired===1?"":"s"}`);
  if(cfg.trapTriggerRequired > 0) directives.push(`trap-stop ${cfg.trapTriggerRequired}`);
  cfg.objective = `Weekly Seed Challenge (${weekKey}): ${directives.join(" • ")}.`;
  return cfg;
}
function activeArcadeMission(state=S){
  const src = (state && typeof state === "object") ? state : S;
  if(normalizeModeName(src.mode) !== "Arcade") return null;
  ensureArcadeWeeklySeedState(src);
  return src.arcadeWeeklySeedEnabled ? arcadeWeeklyChallengeMission(src) : arcadeCampaignMission(src.arcadeLevel);
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

const STORY_VARIANTS = Object.freeze({
  CAMPAIGN: "CAMPAIGN",
  GAUNTLET: "GAUNTLET",
  ELITE_HUNT: "ELITE_HUNT",
});
const ELITE_HUNT_BOSS_TYPES = Object.freeze({
  1: "Alpha",
  2: "Berserker",
  3: "Stalker",
  4: "Alpha",
  5: "Berserker",
  6: "Alpha",
  7: "Berserker",
  8: "Alpha",
  9: "Stalker",
  10: "Alpha",
});
function normalizeStoryVariant(value){
  const key = String(value || "").trim().toUpperCase();
  return STORY_VARIANTS[key] || STORY_VARIANTS.CAMPAIGN;
}
function storyVariantLabel(variant=STORY_VARIANTS.CAMPAIGN){
  const v = normalizeStoryVariant(variant);
  if(v === STORY_VARIANTS.GAUNTLET) return "Endless Chapter Gauntlet";
  if(v === STORY_VARIANTS.ELITE_HUNT) return "Elite Boss Hunts";
  return "Story Campaign";
}
function ensureStoryEndgameState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  if(!src || typeof src !== "object") return;
  src.storyVariant = normalizeStoryVariant(src.storyVariant);
  src.storyNgPlusTier = Math.max(0, Math.floor(Number(src.storyNgPlusTier || 0)));
  src.gauntletDepth = Math.max(1, Math.floor(Number(src.gauntletDepth || 1)));
  src.eliteHuntChapter = clamp(Math.floor(Number(src.eliteHuntChapter || 1)), 1, 10);
  src.eliteHuntRuns = Math.max(1, Math.floor(Number(src.eliteHuntRuns || 1)));
  src.eliteHuntsCleared = Math.max(0, Math.floor(Number(src.eliteHuntsCleared || 0)));
  src.storyEndgameUnlocked = !!src.storyEndgameUnlocked;
  if(Number(src.storyLastMission || src.storyLevel || 1) >= STORY_CAMPAIGN_OBJECTIVES.length){
    src.storyEndgameUnlocked = true;
  }
}
function applyStoryEndgameSnapshot(target=S, source=null){
  const dst = (target && typeof target === "object") ? target : S;
  const src = (source && typeof source === "object") ? source : null;
  if(!dst || !src) return;
  if(src.storyVariant != null) dst.storyVariant = normalizeStoryVariant(src.storyVariant);
  if(Number.isFinite(Number(src.storyNgPlusTier))){
    dst.storyNgPlusTier = Math.max(0, Math.floor(Number(src.storyNgPlusTier || 0)));
  }
  if(src.storyEndgameUnlocked != null) dst.storyEndgameUnlocked = !!src.storyEndgameUnlocked;
  if(Number.isFinite(Number(src.gauntletDepth))){
    dst.gauntletDepth = Math.max(1, Math.floor(Number(src.gauntletDepth || 1)));
  }
  if(Number.isFinite(Number(src.eliteHuntChapter))){
    dst.eliteHuntChapter = clamp(Math.floor(Number(src.eliteHuntChapter || 1)), 1, 10);
  }
  if(Number.isFinite(Number(src.eliteHuntRuns))){
    dst.eliteHuntRuns = Math.max(1, Math.floor(Number(src.eliteHuntRuns || 1)));
  }
  if(Number.isFinite(Number(src.eliteHuntsCleared))){
    dst.eliteHuntsCleared = Math.max(0, Math.floor(Number(src.eliteHuntsCleared || 0)));
  }
  ensureStoryEndgameState(dst);
}
function storyEndgameUnlocked(state=S){
  ensureStoryEndgameState(state);
  const src = (state && typeof state === "object") ? state : S;
  return !!src?.storyEndgameUnlocked;
}
function storyCampaignProgressLevel(state=S){
  const src = (state && typeof state === "object") ? state : S;
  return clamp(Math.floor(Number(src?.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
}
function storyMissionLevelForState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  ensureStoryEndgameState(src);
  const variant = normalizeStoryVariant(src.storyVariant);
  if(variant === STORY_VARIANTS.GAUNTLET){
    const depth = Math.max(1, Math.floor(Number(src.gauntletDepth || 1)));
    return ((depth - 1) % STORY_CAMPAIGN_OBJECTIVES.length) + 1;
  }
  if(variant === STORY_VARIANTS.ELITE_HUNT){
    const chapter = clamp(Math.floor(Number(src.eliteHuntChapter || 1)), 1, 10);
    return clamp(chapter * 10, 1, STORY_CAMPAIGN_OBJECTIVES.length);
  }
  return storyCampaignProgressLevel(src);
}
function storyRunIndexForState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  ensureStoryEndgameState(src);
  const variant = normalizeStoryVariant(src.storyVariant);
  if(variant === STORY_VARIANTS.GAUNTLET){
    return Math.max(1, Math.floor(Number(src.gauntletDepth || 1)));
  }
  if(variant === STORY_VARIANTS.ELITE_HUNT){
    return Math.max(1, Math.floor(Number(src.eliteHuntRuns || 1)));
  }
  return storyCampaignProgressLevel(src);
}
function storyMissionForState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  ensureStoryEndgameState(src);
  const variant = normalizeStoryVariant(src.storyVariant);
  const level = storyMissionLevelForState(src);
  const cfg = { ...storyCampaignMission(level) };
  cfg.storyVariant = variant;
  cfg.runIndex = storyRunIndexForState(src);
  cfg.displayNumber = cfg.runIndex;
  cfg.displayTotal = variant === STORY_VARIANTS.CAMPAIGN ? STORY_CAMPAIGN_OBJECTIVES.length : null;
  cfg.endgameHpMul = 1;
  cfg.endgameAggroMul = 1;
  cfg.endgamePayoutMul = 1;

  if(variant === STORY_VARIANTS.GAUNTLET){
    const depth = Math.max(1, Math.floor(Number(src.gauntletDepth || 1)));
    const loop = Math.floor((depth - 1) / STORY_CAMPAIGN_OBJECTIVES.length);
    cfg.gauntletDepth = depth;
    cfg.gauntletLoop = loop + 1;
    cfg.chapterName = `Endless Chapter Gauntlet • Loop ${cfg.gauntletLoop}`;
    cfg.objective = `Gauntlet Run ${depth}: ${cfg.objective}`;
    cfg.tigers = clamp(cfg.tigers + Math.floor((depth - 1) / 6), 1, 22);
    cfg.captureRequired = clamp(cfg.captureRequired + Math.floor((depth - 1) / 30), 0, 7);
    cfg.endgameHpMul = 1 + (loop * 0.12) + Math.min(0.55, (depth - 1) * 0.0055);
    cfg.endgameAggroMul = 1 + (loop * 0.10) + Math.min(0.45, (depth - 1) * 0.004);
    cfg.endgamePayoutMul = 1 + (loop * 0.14) + Math.min(0.65, (depth - 1) * 0.006);
    if((depth % 10) === 0){
      cfg.boss = true;
      cfg.bossTwin = false;
      cfg.tigers = 1;
      cfg.bossType = ELITE_HUNT_BOSS_TYPES[cfg.chapter] || cfg.bossType || "Alpha";
    }
  }else if(variant === STORY_VARIANTS.ELITE_HUNT){
    const chapter = clamp(Math.floor(Number(src.eliteHuntChapter || 1)), 1, 10);
    const run = Math.max(1, Math.floor(Number(src.eliteHuntRuns || 1)));
    cfg.chapter = chapter;
    cfg.number = chapter * 10;
    cfg.chapterName = `Elite Boss Hunt • Chapter ${chapter}`;
    cfg.objective = `Elite Hunt ${run}: Defeat or capture Chapter ${chapter} boss.`;
    cfg.civilians = 0;
    cfg.captureRequired = 0;
    cfg.tigers = 1;
    cfg.boss = true;
    cfg.bossTwin = false;
    cfg.bossType = ELITE_HUNT_BOSS_TYPES[chapter] || cfg.bossType || "Alpha";
    cfg.finalBoss = chapter === 10;
    cfg.lowVisibility = cfg.lowVisibility || chapter === 7 || chapter === 9;
    cfg.bloodAggro = true;
    cfg.endgameHpMul = 1.55 + ((chapter - 1) * 0.10) + Math.min(0.70, (run - 1) * 0.055);
    cfg.endgameAggroMul = 1.16 + ((chapter - 1) * 0.03) + Math.min(0.38, (run - 1) * 0.028);
    cfg.endgamePayoutMul = 1.32 + ((chapter - 1) * 0.03) + Math.min(0.42, (run - 1) * 0.03);
  }

  const ngTier = Math.max(0, Math.floor(Number(src.storyNgPlusTier || 0)));
  if(ngTier > 0){
    cfg.ngPlusTier = ngTier;
    cfg.ngPlus = true;
    cfg.endgameHpMul *= 1 + (ngTier * 0.18);
    cfg.endgameAggroMul *= 1 + (ngTier * 0.10);
    cfg.endgamePayoutMul *= 1 + (ngTier * 0.14);
    if(variant === STORY_VARIANTS.CAMPAIGN){
      cfg.chapterName = `New Game+ ${ngTier} • ${cfg.chapterName}`;
    }
  }

  return cfg;
}
function storyMissionDisplayLabel(state=S){
  const mission = storyMissionForState(state);
  if(mission.storyVariant === STORY_VARIANTS.GAUNTLET){
    return `Gauntlet Run ${mission.runIndex}`;
  }
  if(mission.storyVariant === STORY_VARIANTS.ELITE_HUNT){
    return `Elite Hunt ${mission.runIndex}`;
  }
  return `Story Mission ${mission.number}`;
}

function markStoryFinalBossOutcome(outcome, tiger){
  if(S.mode!=="Story") return;
  const m = storyMissionForState(S);
  if(normalizeStoryVariant(m.storyVariant) !== STORY_VARIANTS.CAMPAIGN) return;
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
  arcadeBuildcraftSelected:ARCADE_BUILDCRAFT_DEFAULT_ID,
  arcadeBuildcraftPending:ARCADE_BUILDCRAFT_DEFAULT_ID,
  arcadeBuildcraftAppliedKey:"",
  arcadeWeeklySeedEnabled:false,
  arcadeWeeklySeedKey:"",
  arcadeWeeklyRunId:"",
  arcadeWeeklyRunStartedAt:0,
  arcadeWeeklyBestByWeek:{},
  arcadeWeeklyLastResult:null,
  storyLastMission:1,
  storyVariant:"CAMPAIGN",
  storyNgPlusTier:0,
  storyEndgameUnlocked:false,
  gauntletDepth:1,
  eliteHuntChapter:1,
  eliteHuntRuns:1,
  eliteHuntsCleared:0,
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
  weaponMastery:{},

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
  squadCommand:"AUTO",

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
  _biomeFogPulseAt:0,
  eventText:"",
  eventCooldown:0,
  director:{
    phase:"CALM",
    pressure:12,
    phaseLockUntil:0,
    nextSpawnAt:0,
    lastSampleAt:0,
    hardTrimAt:0,
    phaseChangedAt:0,
    lastNoticeAt:0
  },
  _directorAggroMul:1,
  _directorSpeedMul:1,
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
  opsTotals:{ kills:0, captures:0, evac:0, civiliansLost:0, missionsCleared:0, cashEarned:0 },
  balanceStats: defaultBalanceStatsState(),
  nemesis: defaultNemesisState(),
  missionTwists: defaultMissionTwistsState(),
  contractTallies: defaultContractTallies(),
  contracts: null,
  liveOps: null,
  seasonPass: defaultSeasonPassState(),
  masteryRewards: defaultMasteryRewardsState(),
  achievements:{},
  title:"Rookie",
  playerHandle:"",
  telegramUserId:0,
  telegramUsername:"",
  clanTag:"SOLO",
  clanName:"Lone Tigers",
  clanRaidEnabled:false,
  clanContractClaims:{},
  clanCloud:null,
  clanLastSyncAt:0,
  referralMilestone:null,
  telegramEventDrop:null,
  lastMissionRecap:null,

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
function syncTelegramIdentity(state=S){
  if(!state || typeof state !== "object") return state;
  const info = tgUserInfo();
  state.telegramUserId = info.userId;
  state.telegramUsername = info.username || "";
  const existing = String(state.playerHandle || "").trim();
  if(existing){
    state.playerHandle = existing.slice(0, 64);
  } else {
    state.playerHandle = String(info.handle || "").trim().slice(0, 64);
  }
  ensureClanState(state);
  if((state.clanTag || "SOLO") === "SOLO"){
    const autoTag = normalizeClanTag(defaultClanTagFromTelegram(state));
    if(autoTag && autoTag !== "SOLO"){
      state.clanTag = autoTag;
      state.clanName = sanitizeClanName(state.clanName, autoTag);
    }
  }
  return state;
}
function currentPlayerHandle(state=S){
  const src = (state && typeof state === "object") ? state : {};
  const explicit = String(src.playerHandle || "").trim();
  if(explicit) return explicit;
  const username = String(src.telegramUsername || "").trim();
  if(username) return `@${username.replace(/^@+/, "")}`;
  const uid = Math.floor(Number(src.telegramUserId || 0));
  if(uid > 0) return `Player ${uid}`;
  return "Guest";
}

syncTelegramIdentity(S);
ensureClanState(S);
ensureOpsTotalsState(S);
ensureBalanceStatsState(S);
ensureNemesisState(S);
ensureArcadeWeeklySeedState(S);
ensureMasteryRewardsState(S);
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
const ENABLE_SCREEN_SHAKE = false;
const ENABLE_BATTLE_CINEMATIC = false;
const BATTLE_CINE_ENTER_MS = 260;
const BATTLE_CINE_EXIT_MS = 220;
const BATTLE_CINEMATIC = {
  active:false,
  startAt:0,
  durationMs:0,
  fromScale:1,
  toScale:1,
  scale:1,
  focusX:0,
  focusY:0
};
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

function sumNonNegativeIntValues(obj){
  if(!obj || typeof obj !== "object") return 0;
  let total = 0;
  for(const value of Object.values(obj)){
    const n = Math.floor(Number(value || 0));
    if(Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

function ensureOpsTotalsState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  if(!src || typeof src !== "object") return { ...DEFAULT.opsTotals };
  const current = (src.opsTotals && typeof src.opsTotals === "object") ? src.opsTotals : {};
  src.opsTotals = {
    kills: Math.max(0, Math.floor(Number(current.kills || 0))),
    captures: Math.max(0, Math.floor(Number(current.captures || 0))),
    evac: Math.max(0, Math.floor(Number(current.evac || 0))),
    civiliansLost: Math.max(0, Math.floor(Number(current.civiliansLost || 0))),
    missionsCleared: Math.max(0, Math.floor(Number(current.missionsCleared || 0))),
    cashEarned: Math.max(0, Math.floor(Number(current.cashEarned || 0))),
  };
  return src.opsTotals;
}

function addOpsTotal(metric, amount=1, state=S){
  if(!metric) return 0;
  const totals = ensureOpsTotalsState(state);
  const inc = Math.max(0, Math.floor(Number(amount || 0)));
  if(inc <= 0) return Math.max(0, Math.floor(Number(totals[metric] || 0)));
  totals[metric] = Math.max(0, Math.floor(Number(totals[metric] || 0))) + inc;
  return totals[metric];
}

function normalizeRecentTimestampList(list, max=32){
  const out = [];
  if(!Array.isArray(list)) return out;
  for(const raw of list){
    const ts = Math.floor(Number(raw || 0));
    if(!Number.isFinite(ts) || ts <= 0) continue;
    out.push(ts);
  }
  if(out.length > max){
    return out.slice(out.length - max);
  }
  return out;
}

function normalizeMissionResultHistory(list, max=BALANCE_RECENT_MISSION_MAX){
  const out = [];
  if(!Array.isArray(list)) return out;
  for(const entry of list){
    if(!entry || typeof entry !== "object") continue;
    const ts = Math.floor(Number(entry.ts || 0));
    if(!Number.isFinite(ts) || ts <= 0) continue;
    const key = String(entry.key || "").trim().slice(0, 40);
    out.push({
      ts,
      ok: !!entry.ok,
      key,
      reason: String(entry.reason || "").trim().slice(0, 90),
    });
  }
  if(out.length > max){
    return out.slice(out.length - max);
  }
  return out;
}

function balanceMissionKey(state=S){
  const src = (state && typeof state === "object") ? state : S;
  const mode = normalizeModeName(src.mode);
  const mission = gameplayCloudMission(src);
  return `${mode}:${Math.max(1, Math.floor(Number(mission || 1)))}`;
}

function clampAutoTuneValue(value){
  const n = Number(value);
  if(!Number.isFinite(n)) return 1;
  return clamp(n, BALANCE_AUTOTUNE_MIN, BALANCE_AUTOTUNE_MAX);
}

function ensureBalanceStatsState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  const base = defaultBalanceStatsState();
  if(!src || typeof src !== "object"){
    return { ...base };
  }
  const current = (src.balanceStats && typeof src.balanceStats === "object") ? src.balanceStats : {};
  src.balanceStats = {
    ...base,
    ...current,
    deathsTotal: Math.max(0, Math.floor(Number(current.deathsTotal || 0))),
    missionFailsTotal: Math.max(0, Math.floor(Number(current.missionFailsTotal || 0))),
    freezeRecoverTotal: Math.max(0, Math.floor(Number(current.freezeRecoverTotal || 0))),
    freezeSpikeTotal: Math.max(0, Math.floor(Number(current.freezeSpikeTotal || 0))),
    missionsStartedTotal: Math.max(0, Math.floor(Number(current.missionsStartedTotal || 0))),
    missionsWonTotal: Math.max(0, Math.floor(Number(current.missionsWonTotal || 0))),
    missionsFailedTotal: Math.max(0, Math.floor(Number(current.missionsFailedTotal || 0))),
    recentMissionResults: normalizeMissionResultHistory(current.recentMissionResults),
    recentDeathAt: normalizeRecentTimestampList(current.recentDeathAt, BALANCE_EVENT_HISTORY_MAX),
    recentFreezeRecoverAt: normalizeRecentTimestampList(current.recentFreezeRecoverAt, BALANCE_EVENT_HISTORY_MAX),
    recentFreezeSpikeAt: normalizeRecentTimestampList(current.recentFreezeSpikeAt, BALANCE_EVENT_HISTORY_MAX),
    autoTune: clampAutoTuneValue(current.autoTune),
    lastMissionKey: String(current.lastMissionKey || "").trim().slice(0, 40),
    activeMissionKey: String(current.activeMissionKey || "").trim().slice(0, 40),
    missionStartAt: Math.max(0, Math.floor(Number(current.missionStartAt || 0))),
    lastMissionResult: String(current.lastMissionResult || "").trim().slice(0, 24),
    lastMissionResultAt: Math.max(0, Math.floor(Number(current.lastMissionResultAt || 0))),
    lastFreezeSpikeAt: Math.max(0, Math.floor(Number(current.lastFreezeSpikeAt || 0))),
    lastFailRate: clamp(Number(current.lastFailRate || 0), 0, 1),
    lastWinStreak: Math.max(0, Math.floor(Number(current.lastWinStreak || 0))),
    lastDeathsRecent: Math.max(0, Math.floor(Number(current.lastDeathsRecent || 0))),
    lastFreezePerMin: clamp(Number(current.lastFreezePerMin || 0), 0, 8),
    lastFreezeSpikesRecent: Math.max(0, Math.floor(Number(current.lastFreezeSpikesRecent || 0))),
    lastOutcomeSample: Math.max(0, Math.floor(Number(current.lastOutcomeSample || 0))),
    lastUpdatedAt: Math.max(0, Math.floor(Number(current.lastUpdatedAt || 0))),
  };
  return src.balanceStats;
}

function currentStoryMissionNumber(state=S){
  const src = (state && typeof state === "object") ? state : S;
  const missionRaw = (normalizeModeName(src.mode) === "Story")
    ? (storyMissionForState(src)?.number || src.storyLevel || src.storyLastMission || 1)
    : (src.storyLevel || src.storyLastMission || 1);
  const maxMission = Array.isArray(STORY_CAMPAIGN_OBJECTIVES) ? STORY_CAMPAIGN_OBJECTIVES.length : 100;
  return clamp(Math.floor(Number(missionRaw || 1)), 1, maxMission);
}

function normalizeNemesisAlias(alias, fallback="Nemesis"){
  const cleaned = String(alias || "").trim().replace(/[^a-zA-Z0-9\s\-']/g, "").slice(0, 28);
  return cleaned || fallback;
}

function nemesisBehaviorForType(type="Standard"){
  if(type === "Stalker") return "Shadow";
  if(type === "Scout") return "Skirmisher";
  if(type === "Berserker") return "Mauler";
  if(type === "Alpha") return "Warlord";
  return "Hunter";
}

function computeNemesisPower(entry, missionNo=1){
  const escapes = Math.max(1, Math.floor(Number(entry?.escapes || 1)));
  const returns = Math.max(0, Math.floor(Number(entry?.returns || 0)));
  const missionTier = Math.max(0, Math.floor((Math.max(1, missionNo) - 1) / 20));
  const seeded = Math.max(1, Math.floor(Number(entry?.power || 1)));
  const evolved = 1 + Math.min(6, escapes - 1) + Math.floor(returns / 2) + missionTier;
  return clamp(Math.max(seeded, evolved), 1, 10);
}

function computeNemesisBountyCash(entry, missionNo=1){
  const power = computeNemesisPower(entry, missionNo);
  const escapes = Math.max(1, Math.floor(Number(entry?.escapes || 1)));
  const returns = Math.max(0, Math.floor(Number(entry?.returns || 0)));
  return Math.round(clamp(
    NEMESIS_ESCAPED_BONUS_CASH_BASE + (power * 260) + (escapes * 140) + (returns * 90) + (Math.max(1, missionNo) * 18),
    NEMESIS_ESCAPED_BONUS_CASH_BASE,
    24000
  ));
}

function normalizeNemesisEntry(raw, fallbackId="", missionNo=1){
  const src = (raw && typeof raw === "object") ? raw : {};
  const id = String(src.id || fallbackId || "").trim().slice(0, 40);
  if(!id) return null;
  const tigerDefs = Array.isArray(TIGER_TYPES) ? TIGER_TYPES : [];
  const typeRaw = String(src.type || "Standard");
  const type = tigerDefs.some((def)=>def.key === typeRaw) ? typeRaw : "Standard";
  const escapes = Math.max(1, Math.floor(Number(src.escapes || 1)));
  const returns = Math.max(0, Math.floor(Number(src.returns || 0)));
  const scars = clamp(Math.max(1, Math.floor(Number(src.scars || escapes))), 1, 9);
  const alias = normalizeNemesisAlias(src.alias, `Nemesis ${id.replace(/^N/i, "") || "Tiger"}`);
  const statusRaw = String(src.status || "escaped").toLowerCase();
  const status = statusRaw === "resolved" ? "resolved" : (statusRaw === "active" ? "active" : "escaped");
  const entry = {
    id,
    alias,
    type,
    behavior: String(src.behavior || nemesisBehaviorForType(type)).slice(0, 24),
    escapes,
    returns,
    scars,
    power: clamp(Math.max(1, Math.floor(Number(src.power || 1))), 1, 10),
    bountyCash: Math.max(0, Math.floor(Number(src.bountyCash || 0))),
    status,
    lastEscapedMission: Math.max(0, Math.floor(Number(src.lastEscapedMission || 0))),
    lastSpawnMission: Math.max(0, Math.floor(Number(src.lastSpawnMission || 0))),
    lastSeenMission: Math.max(0, Math.floor(Number(src.lastSeenMission || 0))),
    lastDefeatMission: Math.max(0, Math.floor(Number(src.lastDefeatMission || 0))),
    lastOutcome: String(src.lastOutcome || "").slice(0, 16),
    createdAt: Math.max(0, Math.floor(Number(src.createdAt || Date.now()))),
    updatedAt: Math.max(0, Math.floor(Number(src.updatedAt || Date.now()))),
  };
  entry.power = computeNemesisPower(entry, missionNo);
  if(entry.status !== "resolved"){
    entry.bountyCash = Math.max(entry.bountyCash, computeNemesisBountyCash(entry, missionNo));
  }
  return entry;
}

function mergeNemesisEntries(current, incoming, missionNo=1){
  const a = normalizeNemesisEntry(current, current?.id || incoming?.id || "", missionNo);
  const b = normalizeNemesisEntry(incoming, incoming?.id || current?.id || "", missionNo);
  if(!a) return b;
  if(!b) return a;
  const preferIncoming = Number(b.updatedAt || 0) >= Number(a.updatedAt || 0);
  const merged = {
    ...a,
    ...b,
    alias: preferIncoming ? b.alias : a.alias,
    type: preferIncoming ? b.type : a.type,
    behavior: preferIncoming ? b.behavior : a.behavior,
    escapes: Math.max(a.escapes || 1, b.escapes || 1),
    returns: Math.max(a.returns || 0, b.returns || 0),
    scars: Math.max(a.scars || 1, b.scars || 1),
    power: Math.max(a.power || 1, b.power || 1),
    bountyCash: Math.max(a.bountyCash || 0, b.bountyCash || 0),
    lastEscapedMission: Math.max(a.lastEscapedMission || 0, b.lastEscapedMission || 0),
    lastSpawnMission: Math.max(a.lastSpawnMission || 0, b.lastSpawnMission || 0),
    lastSeenMission: Math.max(a.lastSeenMission || 0, b.lastSeenMission || 0),
    lastDefeatMission: Math.max(a.lastDefeatMission || 0, b.lastDefeatMission || 0),
    status: preferIncoming ? b.status : a.status,
    lastOutcome: preferIncoming ? b.lastOutcome : a.lastOutcome,
    createdAt: Math.min(a.createdAt || Date.now(), b.createdAt || Date.now()),
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  };
  return normalizeNemesisEntry(merged, merged.id, missionNo);
}

function trimNemesisRoster(nemesisState){
  if(!nemesisState || typeof nemesisState !== "object") return;
  if(!Array.isArray(nemesisState.roster)) nemesisState.roster = [];
  const statusScore = { active:3, escaped:2, resolved:1 };
  nemesisState.roster.sort((a, b)=>{
    const sa = statusScore[a?.status] || 0;
    const sb = statusScore[b?.status] || 0;
    if(sb !== sa) return sb - sa;
    return Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0);
  });
  if(nemesisState.roster.length > NEMESIS_ROSTER_MAX){
    nemesisState.roster = nemesisState.roster.slice(0, NEMESIS_ROSTER_MAX);
  }
}

function ensureNemesisState(state=S){
  const src = (state && typeof state === "object") ? state : S;
  const fallback = defaultNemesisState();
  if(!src || typeof src !== "object") return fallback;
  const missionNo = currentStoryMissionNumber(src);
  const current = (src.nemesis && typeof src.nemesis === "object") ? src.nemesis : {};
  const rosterRaw = Array.isArray(current.roster) ? current.roster : [];
  const byId = new Map();
  for(const raw of rosterRaw){
    const normalized = normalizeNemesisEntry(raw, "", missionNo);
    if(!normalized) continue;
    const existing = byId.get(normalized.id);
    byId.set(
      normalized.id,
      existing ? mergeNemesisEntries(existing, normalized, missionNo) : normalized
    );
  }
  const roster = Array.from(byId.values());
  src.nemesis = {
    seq: Math.max(0, Math.floor(Number(current.seq || roster.length || 0))),
    lastSpawnMission: Math.max(0, Math.floor(Number(current.lastSpawnMission || 0))),
    lastSpawnId: String(current.lastSpawnId || "").slice(0, 40),
    lastBountyAt: Math.max(0, Math.floor(Number(current.lastBountyAt || 0))),
    roster,
  };
  if(src.nemesis.seq < roster.length){
    src.nemesis.seq = roster.length;
  }
  trimNemesisRoster(src.nemesis);
  return src.nemesis;
}

function nextNemesisAlias(nemesisState){
  const nemesis = ensureNemesisState({ nemesis: nemesisState });
  const used = new Set((nemesis.roster || []).map((entry)=>String(entry?.alias || "").toLowerCase()).filter(Boolean));
  const total = Math.max(1, NEMESIS_NAME_PREFIX.length * NEMESIS_NAME_SUFFIX.length);
  const start = Math.max(0, Math.floor(Number(nemesis.seq || 0)));
  for(let offset=0; offset<total + 10; offset++){
    const seq = start + offset;
    const p = NEMESIS_NAME_PREFIX[seq % NEMESIS_NAME_PREFIX.length] || "Scar";
    const sRaw = NEMESIS_NAME_SUFFIX[Math.floor(seq / NEMESIS_NAME_PREFIX.length) % NEMESIS_NAME_SUFFIX.length] || "claw";
    const s = sRaw.charAt(0).toUpperCase() + sRaw.slice(1);
    const candidate = `${p}${s}`;
    if(!used.has(candidate.toLowerCase())){
      return candidate;
    }
  }
  return `Nemesis${start + 1}`;
}

function mergeNemesisState(currentNemesis, incomingNemesis, missionNo=1){
  const base = ensureNemesisState({ nemesis: currentNemesis });
  const incoming = ensureNemesisState({ nemesis: incomingNemesis });
  const merged = {
    seq: Math.max(base.seq || 0, incoming.seq || 0),
    lastSpawnMission: Math.max(base.lastSpawnMission || 0, incoming.lastSpawnMission || 0),
    lastSpawnId: (Number(incoming.lastSpawnMission || 0) >= Number(base.lastSpawnMission || 0))
      ? String(incoming.lastSpawnId || "")
      : String(base.lastSpawnId || ""),
    lastBountyAt: Math.max(base.lastBountyAt || 0, incoming.lastBountyAt || 0),
    roster: [],
  };
  const byId = new Map();
  for(const entry of (base.roster || [])){
    const normalized = normalizeNemesisEntry(entry, "", missionNo);
    if(normalized) byId.set(normalized.id, normalized);
  }
  for(const entry of (incoming.roster || [])){
    const normalized = normalizeNemesisEntry(entry, "", missionNo);
    if(!normalized) continue;
    const existing = byId.get(normalized.id);
    byId.set(normalized.id, existing ? mergeNemesisEntries(existing, normalized, missionNo) : normalized);
  }
  merged.roster = Array.from(byId.values());
  if(merged.seq < merged.roster.length){
    merged.seq = merged.roster.length;
  }
  trimNemesisRoster(merged);
  return merged;
}

function registerTigerEscapeNemesis(t, reason="RETREAT"){
  if(window.__TUTORIAL_MODE__) return null;
  if(normalizeModeName(S.mode) !== "Story") return null;
  if(!t || !t.alive) return null;
  const missionNo = currentStoryMissionNumber(S);
  const nemesis = ensureNemesisState(S);
  let entry = null;
  let createdNow = false;
  if(t.nemesisId){
    entry = (nemesis.roster || []).find((item)=>item.id === t.nemesisId) || null;
  }
  if(!entry){
    nemesis.seq = Math.max(0, Math.floor(Number(nemesis.seq || 0))) + 1;
    const id = `N${nemesis.seq}`;
    const alias = nextNemesisAlias(nemesis);
    entry = normalizeNemesisEntry({
      id,
      alias,
      type: t.type || "Standard",
      behavior: nemesisBehaviorForType(t.type || "Standard"),
      escapes: 1,
      returns: 0,
      scars: 1,
      power: 1,
      status: "escaped",
      lastEscapedMission: missionNo,
      lastSpawnMission: missionNo,
      lastSeenMission: missionNo,
      lastOutcome: "ESCAPED",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }, id, missionNo);
    if(entry) nemesis.roster.unshift(entry);
    createdNow = true;
  }
  if(!entry) return null;

  entry.type = t.type || entry.type || "Standard";
  entry.behavior = String(entry.behavior || nemesisBehaviorForType(entry.type)).slice(0, 24);
  entry.escapes = Math.max(1, Math.floor(Number(entry.escapes || 0))) + (createdNow ? 0 : 1);
  entry.scars = clamp(Math.max(1, Math.floor(Number(entry.scars || 1))) + (createdNow ? 0 : 1), 1, 9);
  if(!createdNow && entry.escapes >= 3 && (entry.escapes % 2 === 1)){
    entry.alias = normalizeNemesisAlias(nextNemesisAlias(nemesis), entry.alias || "Nemesis");
  }
  entry.status = "escaped";
  entry.lastEscapedMission = missionNo;
  entry.lastSeenMission = missionNo;
  entry.lastSpawnMission = Math.max(entry.lastSpawnMission || 0, missionNo);
  entry.lastOutcome = "ESCAPED";
  entry.updatedAt = Date.now();
  entry.power = computeNemesisPower(entry, missionNo);
  entry.bountyCash = computeNemesisBountyCash(entry, missionNo);
  t.nemesisId = entry.id;
  t.nemesisAlias = entry.alias;
  t.nemesisPower = entry.power;
  t.nemesisScars = entry.scars;
  t.nemesisBehavior = entry.behavior;
  t.nemesisBountyCash = entry.bountyCash;
  nemesis.lastSpawnMission = missionNo;
  nemesis.lastSpawnId = entry.id;
  trimNemesisRoster(nemesis);
  setEventText(`☠️ Nemesis escaped: ${entry.alias} (Lv ${entry.power}) • Bounty now $${entry.bountyCash.toLocaleString()}`, 5.5);
  if(reason === "RETREAT"){
    toast(`Nemesis escaped: ${entry.alias} is getting stronger.`);
  }
  return entry;
}

function pickReturningNemesisForMission(missionNo=currentStoryMissionNumber(S)){
  if(window.__TUTORIAL_MODE__) return null;
  if(normalizeModeName(S.mode) !== "Story") return null;
  const nemesis = ensureNemesisState(S);
  if(!Array.isArray(nemesis.roster) || !nemesis.roster.length) return null;
  if(Math.max(1, missionNo) <= 1) return null;
  if(Math.floor(Number(nemesis.lastSpawnMission || 0)) === missionNo) return null;

  const candidates = [];
  for(const entry of nemesis.roster){
    if(!entry) continue;
    if(entry.status === "resolved") continue;
    if(entry.status === "active" && missionNo > Math.max(0, Math.floor(Number(entry.lastSpawnMission || 0)))){
      entry.status = "escaped";
    }
    if(entry.status !== "escaped") continue;
    const anchorMission = Math.max(
      Math.floor(Number(entry.lastEscapedMission || 0)),
      Math.floor(Number(entry.lastSpawnMission || 0)),
      Math.floor(Number(entry.lastSeenMission || 0))
    );
    const gap = missionNo - anchorMission;
    if(gap < NEMESIS_MIN_MISSION_GAP) continue;
    const staleBonus = Math.max(0, gap - NEMESIS_MIN_MISSION_GAP) * 0.035;
    const chance = clamp(
      NEMESIS_RETURN_BASE_CHANCE +
        (Math.max(1, Math.floor(Number(entry.escapes || 1))) * 0.08) +
        (Math.max(1, Math.floor(Number(entry.power || 1))) * 0.03) +
        staleBonus,
      NEMESIS_RETURN_BASE_CHANCE,
      NEMESIS_RETURN_MAX_CHANCE
    );
    if(Math.random() > chance) continue;
    const score = chance + (Math.max(1, Math.floor(Number(entry.power || 1))) * 0.12) + (gap * 0.03) + (Math.random() * 0.4);
    candidates.push({ entry, score });
  }
  if(!candidates.length) return null;
  candidates.sort((a, b)=>b.score - a.score);
  const chosen = candidates[0].entry;
  chosen.status = "active";
  chosen.returns = Math.max(0, Math.floor(Number(chosen.returns || 0))) + 1;
  chosen.lastSpawnMission = missionNo;
  chosen.lastSeenMission = missionNo;
  chosen.updatedAt = Date.now();
  chosen.power = computeNemesisPower(chosen, missionNo);
  chosen.bountyCash = computeNemesisBountyCash(chosen, missionNo);
  nemesis.lastSpawnMission = missionNo;
  nemesis.lastSpawnId = chosen.id;
  trimNemesisRoster(nemesis);
  return chosen;
}

function applyNemesisEntryToTiger(t, entry, missionNo=currentStoryMissionNumber(S)){
  if(!t || !entry) return t;
  const normalized = normalizeNemesisEntry(entry, entry.id || "", missionNo);
  if(!normalized) return t;
  const power = computeNemesisPower(normalized, missionNo);
  const hpMul = clamp(1 + (power * 0.10), 1.08, 1.92);
  t.nemesisId = normalized.id;
  t.nemesisAlias = normalized.alias;
  t.nemesisPower = power;
  t.nemesisScars = normalized.scars;
  t.nemesisBehavior = normalized.behavior;
  t.nemesisBountyCash = normalized.bountyCash;
  t.nemesisSpeedMul = clamp(1 + (power * 0.03), 1, 1.34);
  t.nemesisDamageMul = clamp(1 + (power * 0.05), 1, 1.55);
  t.nemesisDefenseMul = clamp(1 + (power * 0.04), 1, 1.44);
  t.nemesisPounceMul = clamp(1 + (power * 0.03), 1, 1.42);
  t.nemesisReturned = true;
  t.hpMax = Math.max(12, Math.round(Number(t.hpMax || t.hp || 100) * hpMul));
  t.hp = t.hpMax;
  t.aggroBoost = clamp(Number(t.aggroBoost || 0) + 0.12 + (power * 0.06), 0, 2.4);
  t.civBias = clamp(Number(t.civBias || 0.4) + 0.03, 0.02, 0.98);
  if(normalized.behavior === "Shadow") t.personality = "Ambusher";
  else if(normalized.behavior === "Warlord") t.personality = "Hunter";
  else if(normalized.behavior === "Skirmisher") t.personality = "Sentinel";
  else if(normalized.behavior === "Mauler") t.personality = "Hunter";
  return t;
}

function resolveNemesisOutcome(t, outcome="KILL"){
  if(window.__TUTORIAL_MODE__) return null;
  if(normalizeModeName(S.mode) !== "Story") return null;
  if(!t || !t.nemesisId || t._nemesisResolved) return null;
  const nemesis = ensureNemesisState(S);
  const entry = (nemesis.roster || []).find((item)=>item.id === t.nemesisId);
  if(!entry) return null;
  const missionNo = currentStoryMissionNumber(S);
  const power = Math.max(
    computeNemesisPower(entry, missionNo),
    Math.max(1, Math.floor(Number(t.nemesisPower || 1)))
  );
  let bountyCash = computeNemesisBountyCash(entry, missionNo);
  if(String(outcome).toUpperCase() === "CAPTURE"){
    bountyCash = Math.round(bountyCash * 1.16);
  }
  const xpBonus = (String(outcome).toUpperCase() === "CAPTURE" ? NEMESIS_CAPTURE_BONUS_XP : NEMESIS_KILL_BONUS_XP) + (power * 8);
  S.funds = Math.max(0, Math.round(Number(S.funds || 0))) + bountyCash;
  trackCashEarned(bountyCash);
  S.score = Math.max(0, Math.round(Number(S.score || 0))) + Math.round(70 + (power * 28));
  addXP(xpBonus);
  entry.status = "resolved";
  entry.lastOutcome = String(outcome || "KILL").toUpperCase();
  entry.lastSeenMission = missionNo;
  entry.lastDefeatMission = missionNo;
  entry.updatedAt = Date.now();
  entry.bountyCash = 0;
  nemesis.lastBountyAt = Date.now();
  t._nemesisResolved = true;
  setEventText(
    `🏆 Nemesis ${entry.alias} ${entry.lastOutcome === "CAPTURE" ? "captured" : "eliminated"} • Bounty +$${bountyCash.toLocaleString()}`,
    5.2
  );
  toast(`Nemesis bounty claimed: +$${bountyCash.toLocaleString()}.`);
  trimNemesisRoster(nemesis);
  return entry;
}

function pushBalanceHistory(list, item, max=32){
  if(!Array.isArray(list)) list = [];
  list.push(item);
  if(list.length > max) return list.slice(list.length - max);
  return list;
}

function pruneBalanceHistory(stats, now=Date.now()){
  if(!stats || typeof stats !== "object") return;
  const freezeCutoff = now - BALANCE_FREEZE_WINDOW_MS;
  const deathCutoff = now - BALANCE_DEATH_WINDOW_MS;
  stats.recentDeathAt = (stats.recentDeathAt || []).filter((ts)=>Number(ts || 0) >= deathCutoff);
  stats.recentFreezeRecoverAt = (stats.recentFreezeRecoverAt || []).filter((ts)=>Number(ts || 0) >= freezeCutoff);
  stats.recentFreezeSpikeAt = (stats.recentFreezeSpikeAt || []).filter((ts)=>Number(ts || 0) >= freezeCutoff);
  stats.recentMissionResults = normalizeMissionResultHistory(stats.recentMissionResults, BALANCE_RECENT_MISSION_MAX);
}

function recomputeBalanceAutoTune(state=S, now=Date.now()){
  const stats = ensureBalanceStatsState(state);
  pruneBalanceHistory(stats, now);
  const outcomes = (stats.recentMissionResults || []).slice(-8);
  const failCount = outcomes.reduce((n, r)=>n + (r?.ok ? 0 : 1), 0);
  const failRate = outcomes.length ? (failCount / outcomes.length) : 0;
  const deathsRecent = (stats.recentDeathAt || []).length;
  const freezeRecoverRecent = (stats.recentFreezeRecoverAt || []).length;
  const freezeSpikesRecent = (stats.recentFreezeSpikeAt || []).length;
  const freezePerMin = freezeRecoverRecent / Math.max(1, BALANCE_FREEZE_WINDOW_MS / 60000);
  let winStreak = 0;
  for(let i = outcomes.length - 1; i >= 0; i -= 1){
    if(outcomes[i]?.ok) winStreak += 1;
    else break;
  }

  let tune = 1;
  if(failRate >= 0.6) tune -= 0.11;
  else if(failRate >= 0.4) tune -= 0.08;
  else if(failRate >= 0.25) tune -= 0.05;

  if(deathsRecent >= 4) tune -= 0.07;
  else if(deathsRecent >= 2) tune -= 0.04;
  else if(deathsRecent >= 1) tune -= 0.02;

  if(freezePerMin >= 0.35) tune -= 0.06;
  else if(freezePerMin >= 0.2) tune -= 0.04;
  else if(freezeSpikesRecent >= 4) tune -= 0.03;

  if(winStreak >= 6 && failRate <= 0.15 && deathsRecent === 0 && freezePerMin < 0.12){
    tune += 0.09;
  }else if(winStreak >= 4 && failRate <= 0.20){
    tune += 0.06;
  }else if(winStreak >= 2 && failRate <= 0.25){
    tune += 0.03;
  }

  stats.autoTune = clampAutoTuneValue(Math.round(tune * 1000) / 1000);
  stats.lastFailRate = failRate;
  stats.lastWinStreak = winStreak;
  stats.lastDeathsRecent = deathsRecent;
  stats.lastFreezePerMin = freezePerMin;
  stats.lastFreezeSpikesRecent = freezeSpikesRecent;
  stats.lastOutcomeSample = outcomes.length;
  stats.lastUpdatedAt = now;
  return stats;
}

function currentBalanceTuning(state=S, now=Date.now()){
  const stats = recomputeBalanceAutoTune(state, now);
  let autoTune = clampAutoTuneValue(stats.autoTune);
  const lagTier = frameLagTier();
  if(lagTier >= 2) autoTune = clampAutoTuneValue(autoTune - 0.03);
  else if(lagTier >= 1) autoTune = clampAutoTuneValue(autoTune - 0.015);
  const delta = autoTune - 1;
  let pressureMul = clamp(1 + (delta * 0.85), 0.88, 1.14);
  let spawnCdMul = clamp(1 - (delta * 0.75), 0.86, 1.18);
  let aggroMul = clamp(1 + (delta * 0.90), 0.88, 1.14);
  let speedMul = clamp(1 + (delta * 0.65), 0.90, 1.12);

  if(stats.lastFreezePerMin >= 0.35){
    pressureMul *= 0.94;
    spawnCdMul *= 1.06;
    aggroMul *= 0.95;
    speedMul *= 0.96;
  }else if(stats.lastFreezePerMin >= 0.20){
    pressureMul *= 0.97;
    spawnCdMul *= 1.03;
    aggroMul *= 0.98;
    speedMul *= 0.98;
  }

  return {
    autoTune: clampAutoTuneValue(autoTune),
    pressureMul: clamp(pressureMul, 0.86, 1.16),
    spawnCdMul: clamp(spawnCdMul, 0.84, 1.22),
    aggroMul: clamp(aggroMul, 0.86, 1.18),
    speedMul: clamp(speedMul, 0.88, 1.14),
  };
}

function markBalanceMissionStart(state=S){
  const stats = ensureBalanceStatsState(state);
  const now = Date.now();
  const key = balanceMissionKey(state);
  if(stats.activeMissionKey === key && (now - (stats.missionStartAt || 0)) < 2400){
    return stats;
  }
  stats.activeMissionKey = key;
  stats.missionStartAt = now;
  stats.missionsStartedTotal = Math.max(0, Math.floor(Number(stats.missionsStartedTotal || 0))) + 1;
  recomputeBalanceAutoTune(state, now);
  return stats;
}

function markBalanceMissionResult(ok, reason="", state=S){
  const stats = ensureBalanceStatsState(state);
  const now = Date.now();
  const key = stats.activeMissionKey || balanceMissionKey(state);
  if((now - (stats.lastMissionResultAt || 0)) < 1200 && stats.lastMissionKey === key && String(stats.lastMissionResult || "") === (ok ? "win" : "fail")){
    return stats;
  }
  stats.recentMissionResults = pushBalanceHistory(stats.recentMissionResults, {
    ts: now,
    key,
    ok: !!ok,
    reason: String(reason || "").trim().slice(0, 90),
  }, BALANCE_RECENT_MISSION_MAX);
  if(ok){
    stats.missionsWonTotal = Math.max(0, Math.floor(Number(stats.missionsWonTotal || 0))) + 1;
  }else{
    stats.missionsFailedTotal = Math.max(0, Math.floor(Number(stats.missionsFailedTotal || 0))) + 1;
    stats.missionFailsTotal = Math.max(0, Math.floor(Number(stats.missionFailsTotal || 0))) + 1;
  }
  stats.lastMissionResult = ok ? "win" : "fail";
  stats.lastMissionResultAt = now;
  stats.lastMissionKey = key;
  stats.activeMissionKey = "";
  stats.missionStartAt = 0;
  recomputeBalanceAutoTune(state, now);
  return stats;
}

function markBalanceDeath(state=S){
  const stats = ensureBalanceStatsState(state);
  const now = Date.now();
  stats.deathsTotal = Math.max(0, Math.floor(Number(stats.deathsTotal || 0))) + 1;
  stats.recentDeathAt = pushBalanceHistory(stats.recentDeathAt, now, BALANCE_EVENT_HISTORY_MAX);
  recomputeBalanceAutoTune(state, now);
  return stats;
}

function markBalanceFreezeSpike(frameGap=0, frameCost=0, state=S){
  const stats = ensureBalanceStatsState(state);
  const now = Date.now();
  if((now - (stats.lastFreezeSpikeAt || 0)) < 800) return stats;
  stats.lastFreezeSpikeAt = now;
  stats.freezeSpikeTotal = Math.max(0, Math.floor(Number(stats.freezeSpikeTotal || 0))) + 1;
  stats.recentFreezeSpikeAt = pushBalanceHistory(stats.recentFreezeSpikeAt, now, BALANCE_EVENT_HISTORY_MAX);
  recomputeBalanceAutoTune(state, now);
  return stats;
}

function markBalanceFreezeRecover(state=S){
  const stats = ensureBalanceStatsState(state);
  const now = Date.now();
  stats.freezeRecoverTotal = Math.max(0, Math.floor(Number(stats.freezeRecoverTotal || 0))) + 1;
  stats.recentFreezeRecoverAt = pushBalanceHistory(stats.recentFreezeRecoverAt, now, BALANCE_EVENT_HISTORY_MAX);
  recomputeBalanceAutoTune(state, now);
  return stats;
}

function trackCashEarned(amount=0){
  const cash = Math.max(0, Math.floor(Number(amount || 0)));
  if(cash <= 0) return;
  if(S.stats) S.stats.cashEarned = Math.max(0, Math.floor(Number(S.stats.cashEarned || 0))) + cash;
  addContractTally("cashEarned", cash);
  addOpsTotal("cashEarned", cash);
}

let __cloudProfileLastSyncAt = 0;
let __cloudProfileLastSig = "";
let __cloudProfileSyncInFlight = false;
let __cloudProfileQueued = false;

function gameplayCloudMission(state=S){
  const src = (state && typeof state === "object") ? state : S;
  const mode = normalizeModeName(src.mode);
  if(mode === "Story"){
    return storyProgressMissionFromState(src);
  }
  if(mode === "Arcade"){
    return clamp(Math.floor(Number(src.arcadeLevel || 1)), 1, 100);
  }
  return Math.max(1, Math.floor(Number(src.survivalWave || 1)));
}

function buildGameplayCloudSnapshot(state=S){
  const src = (state && typeof state === "object") ? state : S;
  ensureArcadeWeeklySeedState(src);
  const clan = ensureClanState(src);
  const totals = ensureOpsTotalsState(src);
  const balance = recomputeBalanceAutoTune(src);
  const weeklyKey = String(src.arcadeWeeklySeedKey || weeklyChallengeWeekKey()).trim() || weeklyChallengeWeekKey();
  const weeklyBest = arcadeWeeklyBestForWeek(src, weeklyKey);
  const missionStats = (src.stats && typeof src.stats === "object") ? src.stats : {};
  const kills = Math.max(
    Math.max(0, Math.floor(Number(totals.kills || 0))),
    Math.max(0, Math.floor(Number(missionStats.kills || 0)))
  );
  const captures = Math.max(
    Math.max(0, Math.floor(Number(totals.captures || 0))),
    Math.max(0, Math.floor(Number(missionStats.captures || 0)))
  );
  const evac = Math.max(
    Math.max(0, Math.floor(Number(totals.evac || 0))),
    Math.max(0, Math.floor(Number(missionStats.evac || 0)))
  );
  const cashEarned = Math.max(
    Math.max(0, Math.floor(Number(totals.cashEarned || 0))),
    Math.max(0, Math.floor(Number(missionStats.cashEarned || 0)))
  );
  return {
    kills,
    captures,
    evac,
    civiliansLost: Math.max(0, Math.floor(Number(totals.civiliansLost || 0))),
    missionsCleared: Math.max(0, Math.floor(Number(totals.missionsCleared || 0))),
    cashEarned,
    deaths: Math.max(0, Math.floor(Number(balance.deathsTotal || 0))),
    missionFails: Math.max(0, Math.floor(Number(balance.missionFailsTotal || 0))),
    freezeRecovers: Math.max(0, Math.floor(Number(balance.freezeRecoverTotal || 0))),
    freezeSpikes: Math.max(0, Math.floor(Number(balance.freezeSpikeTotal || 0))),
    autoTune: clampAutoTuneValue(balance.autoTune),
    mode: normalizeModeName(src.mode),
    mission: gameplayCloudMission(src),
    level: Math.max(1, Math.floor(Number(src.level || 1))),
    funds: Math.max(0, Math.floor(Number(src.funds || 0))),
    hp: clamp(Math.floor(Number(src.hp || 0)), 0, 100),
    armor: clamp(Math.floor(Number(src.armor || 0)), 0, Math.max(100, Math.floor(Number(src.armorCap || 100)))),
    weeklySeedEnabled: !!src.arcadeWeeklySeedEnabled,
    weeklySeedKey: weeklyKey,
    weeklySeedScore: Math.max(0, Math.floor(Number(weeklyBest?.score || 0))),
    weeklySeedClearSec: Math.max(0, Math.floor(Number(weeklyBest?.clearSec || 0))),
    weeklySeedCiviliansSaved: Math.max(0, Math.floor(Number(weeklyBest?.civiliansSaved || 0))),
    weeklySeedCiviliansTotal: Math.max(0, Math.floor(Number(weeklyBest?.civiliansTotal || 0))),
    clanTag: clan.tag,
    clanName: clan.name,
    clanRaidEnabled: !!src.clanRaidEnabled,
  };
}

function gameplayCloudSnapshotSig(snapshot){
  const snap = (snapshot && typeof snapshot === "object") ? snapshot : {};
  return [
    normalizeModeName(snap.mode),
    Math.max(1, Math.floor(Number(snap.mission || 1))),
    Math.max(1, Math.floor(Number(snap.level || 1))),
    Math.max(0, Math.floor(Number(snap.funds || 0))),
    Math.max(0, Math.floor(Number(snap.hp || 0))),
    Math.max(0, Math.floor(Number(snap.armor || 0))),
    snap.weeklySeedEnabled ? 1 : 0,
    String(snap.weeklySeedKey || ""),
    Math.max(0, Math.floor(Number(snap.weeklySeedScore || 0))),
    Math.max(0, Math.floor(Number(snap.weeklySeedClearSec || 0))),
    Math.max(0, Math.floor(Number(snap.weeklySeedCiviliansSaved || 0))),
    Math.max(0, Math.floor(Number(snap.weeklySeedCiviliansTotal || 0))),
    Math.max(0, Math.floor(Number(snap.kills || 0))),
    Math.max(0, Math.floor(Number(snap.captures || 0))),
    Math.max(0, Math.floor(Number(snap.evac || 0))),
    Math.max(0, Math.floor(Number(snap.civiliansLost || 0))),
    Math.max(0, Math.floor(Number(snap.missionsCleared || 0))),
    Math.max(0, Math.floor(Number(snap.cashEarned || 0))),
    Math.max(0, Math.floor(Number(snap.deaths || 0))),
    Math.max(0, Math.floor(Number(snap.missionFails || 0))),
    Math.max(0, Math.floor(Number(snap.freezeRecovers || 0))),
    Math.max(0, Math.floor(Number(snap.freezeSpikes || 0))),
    Math.round(clampAutoTuneValue(snap.autoTune) * 1000),
    normalizeClanTag(snap.clanTag || "SOLO"),
    sanitizeClanName(snap.clanName || "", snap.clanTag || "SOLO"),
    snap.clanRaidEnabled ? 1 : 0,
  ].join("|");
}

async function postGameplayCloudSnapshot(snapshot){
  const initData = String(tg?.initData || "");
  if(!initData) return false;
  const controller = (typeof AbortController === "function") ? new AbortController() : null;
  const timeout = controller ? setTimeout(()=>controller.abort(), 5500) : null;
  try{
    const res = await fetch(CLOUD_PROFILE_ENDPOINT, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ initData, snapshot }),
      keepalive:true,
      signal: controller ? controller.signal : undefined,
    });
    let payload = null;
    try{
      payload = await res.json();
    }catch(e){
      payload = null;
    }
    if(res.ok){
      if(payload?.clan && typeof payload.clan === "object"){
        S.clanCloud = payload.clan;
      }
      if(payload?.referral && typeof payload.referral === "object"){
        S.referralMilestone = normalizeReferralMilestoneSnapshot(payload.referral);
      }
      if(payload?.eventDrop && typeof payload.eventDrop === "object"){
        S.telegramEventDrop = normalizeTelegramEventDrop(payload.eventDrop);
      }
      if(payload?.balance && typeof payload.balance === "object"){
        const stats = ensureBalanceStatsState(S);
        stats.deathsTotal = Math.max(stats.deathsTotal, Math.max(0, Math.floor(Number(payload.balance.deaths || 0))));
        stats.missionFailsTotal = Math.max(stats.missionFailsTotal, Math.max(0, Math.floor(Number(payload.balance.missionFails || 0))));
        stats.freezeRecoverTotal = Math.max(stats.freezeRecoverTotal, Math.max(0, Math.floor(Number(payload.balance.freezeRecovers || 0))));
        stats.freezeSpikeTotal = Math.max(stats.freezeSpikeTotal, Math.max(0, Math.floor(Number(payload.balance.freezeSpikes || 0))));
        if(Number.isFinite(Number(payload.balance.autoTune))){
          stats.autoTune = clampAutoTuneValue(Number(payload.balance.autoTune || 1));
        }
        recomputeBalanceAutoTune(S);
      }
      S.clanLastSyncAt = Date.now();
      try{ updateModeDesc(); }catch(e){}
      try{ refreshLaunchIntroStatus(); }catch(e){}
      try{
        if(document.getElementById("invOverlay")?.style?.display === "flex"){
          renderInventory();
        }
      }catch(e){}
    }
    return { ok:!!res.ok, payload };
  }catch(e){
    return { ok:false, payload:null };
  }finally{
    if(timeout) clearTimeout(timeout);
  }
}

function requestGameplayCloudSync(reason="autosave", opts={}){
  if(window.__TUTORIAL_MODE__) return;
  if(!String(tg?.initData || "").trim()) return;
  if(__cloudProfileSyncInFlight){
    __cloudProfileQueued = true;
    return;
  }
  const now = Date.now();
  const force = !!opts.force;
  const snapshot = buildGameplayCloudSnapshot(S);
  const sig = gameplayCloudSnapshotSig(snapshot);
  if(!force){
    if(sig === __cloudProfileLastSig && (now - __cloudProfileLastSyncAt) < (CLOUD_PROFILE_SAVE_MIN_MS * 3)){
      return;
    }
    if((now - __cloudProfileLastSyncAt) < CLOUD_PROFILE_SAVE_MIN_MS){
      __cloudProfileQueued = true;
      return;
    }
  }
  __cloudProfileSyncInFlight = true;
  __cloudProfileLastSyncAt = now;
  void postGameplayCloudSnapshot(snapshot)
    .then((result)=>{
      if(result?.ok){
        __cloudProfileLastSig = sig;
      }
    })
    .finally(()=>{
      __cloudProfileSyncInFlight = false;
      if(__cloudProfileQueued){
        __cloudProfileQueued = false;
        setTimeout(()=>requestGameplayCloudSync(reason || "queued", { force:true }), 320);
      }
    });
}

function storySnapshotQuality(state){
  if(!state || typeof state !== "object") return -1;
  const mission = Math.max(1, Math.floor(Number(state.storyLastMission || state.storyLevel || 1)));
  const level = Math.max(1, Math.floor(Number(state.level || 1)));
  const xp = Math.max(0, Math.floor(Number(state.xp || 0)));
  const funds = Math.max(0, Math.floor(Number(state.funds || 0)));
  const score = Math.max(0, Math.floor(Number(state.score || 0)));
  const ownedWeapons = Array.isArray(state.ownedWeapons) ? state.ownedWeapons.length : 0;
  const ammoTotal = sumNonNegativeIntValues(state.ammoReserve);
  const medkitTotal = sumNonNegativeIntValues(state.medkits);
  const repairTotal = sumNonNegativeIntValues(state.repairKits);
  const armorPlateTotal = sumNonNegativeIntValues(state.armorPlates) + sumNonNegativeIntValues(state.armorPlatesFallback);
  const trapsOwned = Math.max(0, Math.floor(Number(state.trapsOwned || 0)));
  const shields = Math.max(0, Math.floor(Number(state.shields || 0)));
  const perkPoints = Math.max(0, Math.floor(Number(state.perkPoints || 0)));
  const perkRanks = sumNonNegativeIntValues(state.perks);
  const contractProgress = sumNonNegativeIntValues(state.contractTallies);
  const nemesisState = ensureNemesisState({ nemesis: state.nemesis || {} });
  const nemesisActive = (nemesisState.roster || []).filter((entry)=>entry.status !== "resolved").length;
  const nemesisResolved = (nemesisState.roster || []).filter((entry)=>entry.status === "resolved").length;
  const nemesisPower = (nemesisState.roster || []).reduce((sum, entry)=>sum + Math.max(0, Math.floor(Number(entry?.power || 0))), 0);
  return (
    (mission * 1_000_000) +
    (level * 10_000) +
    (xp * 10) +
    funds +
    score +
    (ownedWeapons * 2_000) +
    (ammoTotal * 8) +
    (medkitTotal * 150) +
    (repairTotal * 120) +
    (armorPlateTotal * 130) +
    (trapsOwned * 90) +
    (shields * 90) +
    (perkPoints * 50) +
    (perkRanks * 220) +
    (contractProgress * 3) +
    (nemesisActive * 140) +
    (nemesisResolved * 220) +
    (nemesisPower * 16)
  );
}

function shouldPreferStorySlotResume(saved, storySlot){
  const resume = storySlot?.resumeState;
  if(!resume || typeof resume !== "object") return false;
  if(!saved || typeof saved !== "object") return true;
  const slotQuality = storySnapshotQuality(resume);
  const savedQuality = storySnapshotQuality(saved);
  return slotQuality > savedQuality;
}

function storySnapshotMission(state){
  if(!state || typeof state !== "object") return 1;
  return clamp(
    Math.floor(Number(state.storyLastMission ?? state.storyLevel ?? state.mission ?? 1)),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
}

function pickRicherStorySnapshot(list=[]){
  let best = null;
  for(const item of list){
    if(!item || typeof item !== "object") continue;
    if(!best){
      best = item;
      continue;
    }
    const bestQuality = storySnapshotQuality(best);
    const nextQuality = storySnapshotQuality(item);
    if(nextQuality > bestQuality){
      best = item;
      continue;
    }
    if(nextQuality < bestQuality) continue;

    const bestMission = storySnapshotMission(best);
    const nextMission = storySnapshotMission(item);
    if(nextMission > bestMission){
      best = item;
      continue;
    }
    if(nextMission < bestMission) continue;

    const bestSavedAt = Number.isFinite(Number(best.savedAt)) ? Number(best.savedAt) : 0;
    const nextSavedAt = Number.isFinite(Number(item.savedAt)) ? Number(item.savedAt) : 0;
    if(nextSavedAt > bestSavedAt){
      best = item;
    }
  }
  return best;
}

function resolveStoryProfileOverlay(storyProfile, storyProgress, currentState=null){
  const best = pickRicherStorySnapshot([storyProfile, storyProgress]);
  if(!best) return null;
  if(!currentState || typeof currentState !== "object") return best;

  const currentQuality = storySnapshotQuality(currentState);
  const bestQuality = storySnapshotQuality(best);
  const currentMission = storySnapshotMission(currentState);
  const bestMission = storySnapshotMission(best);
  const currentSavedAt = Number.isFinite(Number(currentState.savedAt)) ? Number(currentState.savedAt) : 0;
  const bestSavedAt = Number.isFinite(Number(best.savedAt)) ? Number(best.savedAt) : 0;

  // Stability lock: do not allow an older/weaker profile to overwrite a richer live snapshot.
  if(bestQuality < currentQuality && bestMission <= currentMission && bestSavedAt <= currentSavedAt){
    return null;
  }
  return best;
}

function load(){
  try{
    const storySlot = readStorySaveData();
    const storyProgress = readStoryProgressData();
    const storyProfileRaw = readStoryProfileData();
    const storyProfile = resolveStoryProfileOverlay(storyProfileRaw, storyProgress);
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
    if(!saved && storySlot && typeof storySlot.resumeState === "object"){
      saved = storySlot.resumeState;
      sourceKey = "__story_resume__";
    }
    if(saved && shouldPreferStorySlotResume(saved, storySlot)){
      saved = storySlot.resumeState;
      sourceKey = "__story_resume__";
    }
    if(!saved){
      const fallback = cloneState(DEFAULT);
      applyStorySaveToState(fallback, { allowModeSync:true });
      applyStoryProfileToState(fallback, storyProfile);
      ensureStoryEndgameState(fallback);
      ensureContractTalliesState(fallback);
      ensureContractsState(fallback);
      ensureLiveOpsState(fallback);
      ensureOpsTotalsState(fallback);
      ensureBalanceStatsState(fallback);
      ensureNemesisState(fallback);
      ensureMissionTwistState(fallback);
      ensureArcadeBuildcraftState(fallback);
      ensureArcadeWeeklySeedState(fallback);
      ensureClanState(fallback);
      ensureSeasonPassState(fallback);
      ensureMasteryRewardsState(fallback);
      return fallback;
    }
    const m = { ...DEFAULT, ...saved };
    m.me = { ...DEFAULT.me, ...(saved.me||{}) };
    m.mag = { ...DEFAULT.mag, ...(saved.mag||{}) };
    m.ammoReserve = { ...DEFAULT.ammoReserve, ...(saved.ammoReserve||{}) };
    m.durability = { ...DEFAULT.durability, ...(saved.durability||{}) };
    m.weaponMastery = normalizeWeaponMasteryMap(saved.weaponMastery ?? DEFAULT.weaponMastery);
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
    m.opsTotals = { ...DEFAULT.opsTotals, ...((saved.opsTotals && typeof saved.opsTotals === "object") ? saved.opsTotals : {}) };
    m.balanceStats = { ...defaultBalanceStatsState(), ...((saved.balanceStats && typeof saved.balanceStats === "object") ? saved.balanceStats : {}) };
    m.nemesis = (saved.nemesis && typeof saved.nemesis === "object") ? cloneState(saved.nemesis) : defaultNemesisState();
    m.missionTwists = (saved.missionTwists && typeof saved.missionTwists === "object")
      ? cloneState(saved.missionTwists)
      : defaultMissionTwistsState();
    m.contractTallies = normalizeContractTalliesMap(saved.contractTallies);
    m.contracts = (saved.contracts && typeof saved.contracts === "object") ? saved.contracts : null;
    m.liveOps = (saved.liveOps && typeof saved.liveOps === "object") ? saved.liveOps : null;
    m.referralMilestone = (saved.referralMilestone && typeof saved.referralMilestone === "object") ? saved.referralMilestone : null;
    m.telegramEventDrop = (saved.telegramEventDrop && typeof saved.telegramEventDrop === "object") ? saved.telegramEventDrop : null;
    m.lastMissionRecap = (saved.lastMissionRecap && typeof saved.lastMissionRecap === "object") ? saved.lastMissionRecap : null;
    m.seasonPass = mergeSeasonPassSnapshots(DEFAULT.seasonPass, saved.seasonPass);
    m.masteryRewards = mergeMasteryRewardsSnapshots(DEFAULT.masteryRewards, saved.masteryRewards);
    m.perks = { ...DEFAULT.perks, ...(saved.perks||{}) };
    m.progressionUnlocks = { ...DEFAULT.progressionUnlocks, ...(saved.progressionUnlocks||{}) };
    m.metaBase = { ...DEFAULT.metaBase, ...(saved.metaBase||{}) };
    m.specialistPerks = { ...DEFAULT.specialistPerks, ...(saved.specialistPerks||{}) };
    m.specialistStarUnlocks = { ...DEFAULT.specialistStarUnlocks, ...(saved.specialistStarUnlocks||{}) };
    m.chapterRewardsUnlocked = { ...DEFAULT.chapterRewardsUnlocked, ...(saved.chapterRewardsUnlocked||{}) };
    m.touchHud = normalizeTouchHudSettings(saved.touchHud ?? m.touchHud);
    m.mode = normalizeModeName(m.mode);
    m.storyLastMission = clamp(Math.floor(Number(saved.storyLastMission ?? m.storyLevel ?? 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
    ensureStoryEndgameState(m);
    applyStorySaveToState(m, { allowModeSync:true });
    const profileOverlay = resolveStoryProfileOverlay(storyProfileRaw, storyProgress, m);
    applyStoryProfileToState(m, profileOverlay);
    const walletProfile = profileOverlay || storyProfile;
    const mergedModeWallets = (walletProfile && walletProfile.modeWallets && typeof walletProfile.modeWallets === "object")
      ? { ...(saved.modeWallets || {}), ...walletProfile.modeWallets }
      : saved.modeWallets;
    m.modeWallets = normalizeModeWallets(mergedModeWallets, m.funds, m.mode);
    if(walletProfile && Number.isFinite(Number(walletProfile.funds))){
      const profileFunds = Math.max(0, Math.round(Number(walletProfile.funds)));
      if(m.modeWallets && typeof m.modeWallets === "object"){
        m.modeWallets[m.mode] = profileFunds;
      }
    }
    m.funds = getModeWallet(m.mode, m);
    ensureContractTalliesState(m);
    ensureContractsState(m);
    ensureLiveOpsState(m);
    ensureOpsTotalsState(m);
    ensureBalanceStatsState(m);
    ensureNemesisState(m);
    ensureMissionTwistState(m);
    ensureArcadeBuildcraftState(m);
    ensureArcadeWeeklySeedState(m);
    ensureClanState(m);
    ensureSeasonPassState(m);
    ensureMasteryRewardsState(m);
    ensureStoryEndgameState(m);
    if(m.lives==null) m.lives=5;
    m.v = STORAGE_VERSION;
    trimPersistentState(m);
    if(sourceKey && sourceKey !== STORAGE_KEY){
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
      }catch(e){}
    }
    return m;
  }catch(e){
    const fallback = cloneState(DEFAULT);
    ensureStoryEndgameState(fallback);
    ensureContractTalliesState(fallback);
    ensureContractsState(fallback);
    ensureLiveOpsState(fallback);
    ensureOpsTotalsState(fallback);
    ensureBalanceStatsState(fallback);
    ensureNemesisState(fallback);
    ensureMissionTwistState(fallback);
    ensureArcadeBuildcraftState(fallback);
    ensureArcadeWeeklySeedState(fallback);
    ensureClanState(fallback);
    ensureSeasonPassState(fallback);
    ensureMasteryRewardsState(fallback);
    return fallback;
  }
}
// ===================== SAVE (THROTTLED — FIXES IOS FREEZE) =====================
const SAVE_MIN_INTERVAL_MS = 4200;
const SAVE_AUTOSAVE_MS = 12000;
const SAVE_AUTOSAVE_HEAVY_MS = 18000;
const SAVE_AUTOSAVE_BATTLE_MS = 32000;
const SAVE_AUTOSAVE_MAX_DEFER_MS = 42000;
const SAVE_FULL_STORY_SNAPSHOT_MS = 70000;
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
const FRAME_LOAD_LIGHT = 1;
const FRAME_LOAD_MID = 1.15;
const FRAME_LOAD_HIGH = 1.32;
const FRAME_LOAD_EXTREME = 1.52;
const FRAME_LAG_WARN_SCORE = 4;
const FRAME_LAG_CRITICAL_SCORE = 8;
const DIRECTOR_PHASES = {
  CALM: "CALM",
  PRESSURE: "PRESSURE",
  PEAK: "PEAK",
  RECOVER: "RECOVER",
};
const DIRECTOR_PHASE_LABELS = {
  CALM: "Calm",
  PRESSURE: "Pressure",
  PEAK: "Peak",
  RECOVER: "Recover",
};
const DIRECTOR_PHASE_CONFIG = {
  CALM: { eventChance:0.08, eventCooldownTicks:780, spawnCd:[20000, 27000], aggroMul:0.93, speedMul:0.96 },
  PRESSURE: { eventChance:0.11, eventCooldownTicks:640, spawnCd:[13800, 19200], aggroMul:0.99, speedMul:1.00 },
  PEAK: { eventChance:0.15, eventCooldownTicks:520, spawnCd:[9800, 13800], aggroMul:1.07, speedMul:1.05 },
  RECOVER: { eventChance:0.10, eventCooldownTicks:560, spawnCd:[15800, 22800], aggroMul:0.95, speedMul:0.97 },
};
const DIRECTOR_PHASE_MIN_LOCK_MS = 3600;
const DIRECTOR_HARD_CAPS = {
  Story: { tigers:20, civilians:24, pickups:20, carcasses:44, traps:22, support:16 },
  Arcade: { tigers:20, civilians:24, pickups:20, carcasses:44, traps:22, support:16 },
  Survival: { tigers:22, civilians:30, pickups:22, carcasses:48, traps:24, support:16 },
};

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
const __frameTaskPhase = Object.create(null);
const MAP_CACHE_INTERVAL_MS = 200;
let __mapFrameCacheCanvas = null;
let __mapFrameCacheCtx = null;
let __mapFrameCacheSig = "";
let __mapFrameCacheAt = 0;
let __mapObstacleSig = "";
let __mapObstacleRects = [];
let __mapObstacleCircles = [];
let __mapWaterSig = "";
let __mapWaterZones = [];
let __mapDenseLandmarksSig = "";
let __mapDenseLandmarks = [];
let __frameSlowUntil = 0;
let __frameLagScore = 0;
let __lastFrameAt = 0;
let __drawLoopStarted = false;
let __frameRecoverUntil = 0;
let __frameHeavyFxFlip = 0;
let __frameBgFxFlip = 0;
let __frameDynamicLoadMul = FRAME_LOAD_LIGHT;
let __battleHudRenderAt = 0;
let __battleReadabilityRenderAt = 0;
let __liteEntityRenderState = false;
let __liteEntityRenderNeedSince = 0;
let __liteEntityRenderRelaxUntil = 0;
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
let __lastStoryFullSnapshotAt = 0;
let __autoPerfEscalatedAt = 0;
let __storyCheckpointCache = null;

function invalidateMapCache(){
  __mapFrameCacheSig = "";
  __mapFrameCacheAt = 0;
  __mapObstacleSig = "";
  __mapObstacleRects = [];
  __mapObstacleCircles = [];
  __mapWaterSig = "";
  __mapWaterZones = [];
  __mapDenseLandmarksSig = "";
  __mapDenseLandmarks = [];
  __blockedAtCache.clear();
  __blockedAtCacheFrame = 0;
}

const WORLD_BASE_WIDTH = 960;
const WORLD_BASE_HEIGHT = 540;

function missionProgressForWorld(state=S){
  const mode = normalizeModeName(state?.mode || "Story");
  if(mode === "Story"){
    return clamp(Math.floor(storyMissionLevelForState(state) || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  }
  if(mode === "Arcade"){
    return clamp(Math.floor(state?.arcadeLevel || 1), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
  }
  return Math.max(1, Math.floor(state?.survivalWave || 1));
}

function worldScaleForModeMission(mode, mission){
  const mobile = isMobileViewport();
  const landscape = isLandscapeViewport();
  if(window.__TUTORIAL_MODE__) return 1;
  if(mobile){
    // Mobile-safe world sizing: still larger than one screen and camera-following,
    // but far smaller than desktop to avoid startup hitches and long empty traversals.
    if(mode === "Story"){
      if(landscape) return clamp(1.18 + ((Math.max(1, mission) - 1) * 0.0035), 1.18, 1.48);
      return clamp(1.10 + ((Math.max(1, mission) - 1) * 0.004), 1.10, 1.36);
    }
    if(mode === "Arcade"){
      if(landscape) return clamp(1.14 + ((Math.max(1, mission) - 1) * 0.003), 1.14, 1.40);
      return clamp(1.08 + ((Math.max(1, mission) - 1) * 0.0035), 1.08, 1.30);
    }
    if(landscape) return clamp(1.16 + ((Math.max(1, mission) - 1) * 0.006), 1.16, 1.52);
    return clamp(1.10 + ((Math.max(1, mission) - 1) * 0.0065), 1.10, 1.38);
  }
  if(mode === "Story"){
    return clamp(1.85 + ((Math.max(1, mission) - 1) * 0.012), 1.85, 3.20);
  }
  if(mode === "Arcade"){
    return clamp(1.70 + ((Math.max(1, mission) - 1) * 0.010), 1.70, 2.85);
  }
  return clamp(1.75 + ((Math.max(1, mission) - 1) * 0.028), 1.75, 2.70);
}

function desiredWorldLayout(state=S){
  const mode = normalizeModeName(state?.mode || "Story");
  const mission = missionProgressForWorld(state);
  const scale = worldScaleForModeMission(mode, mission);
  const viewportW = Number(cv?.width || WORLD_BASE_WIDTH) || WORLD_BASE_WIDTH;
  const viewportH = Number(cv?.height || WORLD_BASE_HEIGHT) || WORLD_BASE_HEIGHT;
  const mobile = isMobileViewport();
  const landscape = isLandscapeViewport();
  // Keep landscape as the primary large-map view, but ensure portrait is still clearly larger than one screen.
  const minPadW = mobile ? (landscape ? 140 : 240) : 40;
  const minPadH = mobile ? (landscape ? 96 : 220) : 40;
  const w = Math.max(viewportW + minPadW, Math.round(WORLD_BASE_WIDTH * scale));
  const h = Math.max(viewportH + minPadH, Math.round(WORLD_BASE_HEIGHT * scale));
  return { mode, mission, scale, w, h };
}

function ensureWorldLayout(state=S){
  if(!state || typeof state !== "object"){
    return { mode:"Story", mission:1, scale:1, w:(cv.width || WORLD_BASE_WIDTH), h:(cv.height || WORLD_BASE_HEIGHT) };
  }
  if(!state.world || typeof state.world !== "object") state.world = {};
  const world = state.world;
  const desired = desiredWorldLayout(state);
  const needsReset =
    !Number.isFinite(world.w) ||
    !Number.isFinite(world.h) ||
    !Number.isFinite(world.scale) ||
    world.mode !== desired.mode ||
    world.mission !== desired.mission ||
    Math.abs(Number(world.scale || 1) - desired.scale) > 0.0001;
  if(needsReset){
    world.mode = desired.mode;
    world.mission = desired.mission;
    world.scale = desired.scale;
    world.w = desired.w;
    world.h = desired.h;
  }
  if(!state.camera || typeof state.camera !== "object"){
    state.camera = { x: world.w * 0.5, y: world.h * 0.5 };
  }
  return world;
}

function worldWidth(state=S){
  const world = ensureWorldLayout(state);
  return Math.max(Number(cv?.width || WORLD_BASE_WIDTH), Math.round(Number(world?.w || WORLD_BASE_WIDTH)));
}

function worldHeight(state=S){
  const world = ensureWorldLayout(state);
  return Math.max(Number(cv?.height || WORLD_BASE_HEIGHT), Math.round(Number(world?.h || WORLD_BASE_HEIGHT)));
}

function worldBounds(radius=0, state=S){
  const w = worldWidth(state);
  const h = worldHeight(state);
  const r = Math.max(0, Number(radius) || 0);
  return {
    minX: 30 + r,
    maxX: w - (30 + r),
    minY: 48 + r,
    maxY: h - (22 + r),
  };
}

function clampWorldX(v, radius=0, state=S){
  const b = worldBounds(radius, state);
  return clamp(v, b.minX, b.maxX);
}

function clampWorldY(v, radius=0, state=S){
  const b = worldBounds(radius, state);
  return clamp(v, b.minY, b.maxY);
}

function cameraClampCenter(x, y, state=S){
  const world = ensureWorldLayout(state);
  const vw = Number(cv?.width || WORLD_BASE_WIDTH) || WORLD_BASE_WIDTH;
  const vh = Number(cv?.height || WORLD_BASE_HEIGHT) || WORLD_BASE_HEIGHT;
  const halfW = vw * 0.5;
  const halfH = vh * 0.5;
  const minX = halfW;
  const maxX = Math.max(halfW, Number(world.w || vw) - halfW);
  const minY = halfH;
  const maxY = Math.max(halfH, Number(world.h || vh) - halfH);
  return {
    x: clamp(Number.isFinite(x) ? x : (state?.me?.x || (world.w * 0.5)), minX, maxX),
    y: clamp(Number.isFinite(y) ? y : (state?.me?.y || (world.h * 0.5)), minY, maxY),
  };
}

function cameraOffsetSnapshot(state=S){
  const world = ensureWorldLayout(state);
  const vw = Number(cv?.width || WORLD_BASE_WIDTH) || WORLD_BASE_WIDTH;
  const vh = Number(cv?.height || WORLD_BASE_HEIGHT) || WORLD_BASE_HEIGHT;
  const camX = Number.isFinite(state?.camera?.x) ? state.camera.x : (state?.me?.x || world.w * 0.5);
  const camY = Number.isFinite(state?.camera?.y) ? state.camera.y : (state?.me?.y || world.h * 0.5);
  const clamped = cameraClampCenter(camX, camY, state);
  return { x: clamped.x - (vw * 0.5), y: clamped.y - (vh * 0.5) };
}

function updateWorldCamera(state=S){
  const world = ensureWorldLayout(state);
  if(!state.camera || typeof state.camera !== "object"){
    state.camera = { x: world.w * 0.5, y: world.h * 0.5 };
  }
  const vw = Number(cv?.width || WORLD_BASE_WIDTH) || WORLD_BASE_WIDTH;
  const vh = Number(cv?.height || WORLD_BASE_HEIGHT) || WORLD_BASE_HEIGHT;
  const target = cameraClampCenter(
    Number.isFinite(state?.me?.x) ? state.me.x : (world.w * 0.5),
    Number.isFinite(state?.me?.y) ? state.me.y : (world.h * 0.5),
    state
  );
  const ease = state?.inBattle ? 0.25 : 0.18;
  if(!Number.isFinite(state.camera.x) || !Number.isFinite(state.camera.y)){
    state.camera.x = target.x;
    state.camera.y = target.y;
  } else {
    state.camera.x += (target.x - state.camera.x) * ease;
    state.camera.y += (target.y - state.camera.y) * ease;
  }
  const farDx = Math.abs(target.x - state.camera.x);
  const farDy = Math.abs(target.y - state.camera.y);
  if(farDx > (vw * 0.45) || farDy > (vh * 0.45)){
    state.camera.x = target.x;
    state.camera.y = target.y;
  }
  const clamped = cameraClampCenter(state.camera.x, state.camera.y, state);
  state.camera.x = clamped.x;
  state.camera.y = clamped.y;
  return { x: state.camera.x - (vw * 0.5), y: state.camera.y - (vh * 0.5) };
}

function worldToScreenPoint(x, y, state=S){
  const off = cameraOffsetSnapshot(state);
  return { x: x - off.x, y: y - off.y };
}

function screenToWorldPoint(x, y, state=S){
  const off = cameraOffsetSnapshot(state);
  return { x: x + off.x, y: y + off.y };
}

function isWorldCameraActive(state=S){
  if(window.__TUTORIAL_MODE__) return false;
  if(!isMobileViewport()) return false;
  ensureWorldLayout(state);
  return true;
}

function flushSaveNow(){
  __lastSave = Date.now();
  __savePending = false;
  let primarySaved = false;
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState()));
    primarySaved = true;
  }catch(e){
    try{ console.warn("Primary save failed, using story save fallback:", e); }catch(err){}
  }
  if(normalizeModeName(S.mode) === "Story"){
    const snap = writeStorySaveData(primarySaved ? "autosave" : "autosave-story-only");
    if(snap) __lastStoryFullSnapshotAt = Date.now();
  }
  requestGameplayCloudSync("full-save");
}

function flushStoryLiteNow(source="autosave-lite"){
  __lastSave = Date.now();
  __savePending = false;
  const mode = normalizeModeName(S.mode);
  if(mode !== "Story"){
    flushSaveNow();
    return;
  }
  try{
    const mission = storyProgressMissionFromState(S);
    writeStoryProgressData({
      mission,
      storyLevel: S.storyLevel,
      storyLastMission: S.storyLastMission,
      hp: S.hp,
      armor: S.armor,
      funds: getModeWallet("Story", S),
      source
    });
    writeStoryProfileData(source, S);
    if(!S.inBattle){
      requestGameplayCloudSync(source);
    }
  }catch(e){
    flushSaveNow();
  }
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
    if(S.paused || S.missionEnded || S.gameOver){
      flushSaveNow();
    }
  }
  catch(e){
    console.log("Save failed:", e);
  }
}

function maybeAutosave(force=false){
  const now = Date.now();
  if(force){
    __lastAutosave = now;
    save(true);
    return;
  }
  if(!__savePending) return;
  const since = now - __lastAutosave;
  if(since <= SAVE_AUTOSAVE_MS) return;
  const heavy = frameIsSlow() || performanceMode() === "PERFORMANCE" || frameActiveEntityLoadScore() >= 44;
  if(since < SAVE_AUTOSAVE_MAX_DEFER_MS){
    if(S.inBattle && since < SAVE_AUTOSAVE_BATTLE_MS) return;
    if(!S.inBattle && heavy && since < SAVE_AUTOSAVE_HEAVY_MS) return;
  }
  if(__savePending){
    __lastAutosave = now;
    const inStory = normalizeModeName(S.mode) === "Story";
    const liveGameplay = !(S.paused || S.gameOver || S.missionEnded);
    const fullSnapshotDue = (now - (__lastStoryFullSnapshotAt || 0)) >= SAVE_FULL_STORY_SNAPSHOT_MS;
    if(inStory && S.inBattle){
      // Keep battle smooth: avoid full localStorage snapshot while combat is active.
      flushStoryLiteNow("autosave-lite-battle");
      return;
    }
    if(inStory && liveGameplay && !fullSnapshotDue){
      flushStoryLiteNow("autosave-lite");
    }else{
      save(true);
    }
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
  __liteEntityRenderNeedSince = 0;
  __liteEntityRenderRelaxUntil = 0;
  if(!isMobileViewport()) __liteEntityRenderState = false;
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
function frameActiveEntityLoadScore(){
  if(!S || typeof S !== "object") return 0;
  const tigerLoad = (S.tigers || []).reduce((n, t)=>n + (t?.alive ? 1 : 0), 0);
  const civLoad = (S.civilians || []).reduce((n, c)=>n + (c?.alive && !c?.evac ? 1 : 0), 0);
  const supportLoad = (S.supportUnits || []).reduce((n, u)=>n + (u?.alive ? 1 : 0), 0);
  const pickupLoad = Math.max(0, (S.pickups || []).length);
  const trapLoad = Math.max(0, (S.trapsPlaced || []).length);
  const carcassLoad = Math.max(0, Math.round(((S.carcasses || []).length || 0) * 0.5));
  const interactLoad = Math.max(0, Math.round(((S.mapInteractables || []).length || 0) * 0.5));
  const battleBoost = S.inBattle ? 8 : 0;
  return tigerLoad + civLoad + supportLoad + pickupLoad + trapLoad + carcassLoad + interactLoad + battleBoost;
}
function computeFrameLoadMultiplier(){
  const score = frameActiveEntityLoadScore();
  if(score >= 74) return FRAME_LOAD_EXTREME;
  if(score >= 56) return FRAME_LOAD_HIGH;
  if(score >= 38) return FRAME_LOAD_MID;
  return FRAME_LOAD_LIGHT;
}
function frameLagTier(){
  const score = Math.max(0, Number(__frameLagScore || 0));
  if(score >= FRAME_LAG_CRITICAL_SCORE) return 2;
  if(score >= FRAME_LAG_WARN_SCORE) return 1;
  return 0;
}
function directorPhaseLabel(phase){
  return DIRECTOR_PHASE_LABELS[phase] || DIRECTOR_PHASE_LABELS.CALM;
}
function directorPhaseRank(phase){
  if(phase === DIRECTOR_PHASES.PEAK) return 3;
  if(phase === DIRECTOR_PHASES.PRESSURE) return 2;
  if(phase === DIRECTOR_PHASES.RECOVER) return 1;
  return 0;
}
function missionDirectorPhaseStyle(phase){
  if(phase === DIRECTOR_PHASES.PEAK){
    return {
      tagBg:"linear-gradient(180deg, rgba(60,14,20,.96), rgba(36,10,14,.96))",
      tagBorder:"rgba(244,63,94,.82)",
      tagText:"#fecdd3",
      bar:"linear-gradient(90deg, #fb7185 0%, #f43f5e 100%)"
    };
  }
  if(phase === DIRECTOR_PHASES.PRESSURE){
    return {
      tagBg:"linear-gradient(180deg, rgba(62,32,8,.95), rgba(36,20,6,.95))",
      tagBorder:"rgba(245,158,11,.82)",
      tagText:"#fde68a",
      bar:"linear-gradient(90deg, #f59e0b 0%, #f97316 100%)"
    };
  }
  if(phase === DIRECTOR_PHASES.RECOVER){
    return {
      tagBg:"linear-gradient(180deg, rgba(16,40,36,.95), rgba(10,24,20,.95))",
      tagBorder:"rgba(16,185,129,.82)",
      tagText:"#a7f3d0",
      bar:"linear-gradient(90deg, #34d399 0%, #10b981 100%)"
    };
  }
  return {
    tagBg:"linear-gradient(180deg, rgba(20,30,56,.95), rgba(12,18,34,.95))",
    tagBorder:"rgba(96,165,250,.8)",
    tagText:"#bfdbfe",
    bar:"linear-gradient(90deg, #60a5fa 0%, #34d399 100%)"
  };
}
function ensureMissionDirectorState(state=S){
  if(!state || typeof state !== "object"){
    return {
      phase:DIRECTOR_PHASES.CALM,
      pressure:12,
      phaseLockUntil:0,
      nextSpawnAt:0,
      lastSampleAt:0,
      hardTrimAt:0,
      phaseChangedAt:0,
      lastNoticeAt:0
    };
  }
  const cur = (state.director && typeof state.director === "object") ? state.director : {};
  const next = {
    phase: DIRECTOR_PHASES[cur.phase] ? cur.phase : DIRECTOR_PHASES.CALM,
    pressure: clamp(Number.isFinite(cur.pressure) ? cur.pressure : 12, 0, 100),
    phaseLockUntil: Number.isFinite(cur.phaseLockUntil) ? cur.phaseLockUntil : 0,
    nextSpawnAt: Number.isFinite(cur.nextSpawnAt) ? cur.nextSpawnAt : 0,
    lastSampleAt: Number.isFinite(cur.lastSampleAt) ? cur.lastSampleAt : 0,
    hardTrimAt: Number.isFinite(cur.hardTrimAt) ? cur.hardTrimAt : 0,
    phaseChangedAt: Number.isFinite(cur.phaseChangedAt) ? cur.phaseChangedAt : 0,
    lastNoticeAt: Number.isFinite(cur.lastNoticeAt) ? cur.lastNoticeAt : 0
  };
  state.director = next;
  if(!Number.isFinite(state._directorAggroMul)) state._directorAggroMul = 1;
  if(!Number.isFinite(state._directorSpeedMul)) state._directorSpeedMul = 1;
  return next;
}
function missionDirectorHardCaps(){
  const modeKey = normalizeModeName(S?.mode);
  const base = DIRECTOR_HARD_CAPS[modeKey] || DIRECTOR_HARD_CAPS.Story;
  const caps = {
    tigers: base.tigers,
    civilians: base.civilians,
    pickups: base.pickups,
    carcasses: base.carcasses,
    traps: base.traps,
    support: base.support
  };
  const lagTier = frameLagTier();
  const heavy = frameIsSlow() || performanceMode() === "PERFORMANCE";
  if(heavy){
    caps.tigers -= 1;
    caps.pickups -= 2;
    caps.carcasses -= 4;
    caps.traps -= 2;
  }
  if(lagTier >= 1){
    caps.tigers -= 1;
    caps.pickups -= 2;
    caps.carcasses -= 4;
    caps.traps -= 2;
  }
  if(lagTier >= 2){
    caps.tigers -= 2;
    caps.pickups -= 3;
    caps.carcasses -= 6;
    caps.traps -= 3;
  }
  caps.tigers = clamp(Math.floor(caps.tigers), 14, STABILITY_SOFT_CAP_TIGERS);
  caps.civilians = clamp(Math.floor(caps.civilians), 18, STABILITY_SOFT_CAP_CIVILIANS);
  caps.pickups = clamp(Math.floor(caps.pickups), 10, STABILITY_SOFT_CAP_PICKUPS);
  caps.carcasses = clamp(Math.floor(caps.carcasses), 20, STABILITY_SOFT_CAP_CARCASSES);
  caps.traps = clamp(Math.floor(caps.traps), 8, STABILITY_SOFT_CAP_TRAPS);
  caps.support = clamp(Math.floor(caps.support), 8, MAX_PERSIST_SUPPORT_UNITS);
  return caps;
}
function missionDirectorAllowTigerSpawn(extra=1, opts={}){
  if(!S || typeof S !== "object") return false;
  const now = Date.now();
  const director = ensureMissionDirectorState();
  if(!opts.ignoreBudget && now < (director.nextSpawnAt || 0)) return false;
  if(!opts.ignoreFairness){
    if(S.respawnPendingUntil && now < (S.respawnPendingUntil + 1200)) return false;
    if(now < ((S.rollInvulnUntil || 0) + 700)) return false;
    if(S.mode !== "Survival"){
      const earlyGuardUntil = Math.max(0, Number(S.civGraceUntil || 0)) + 2400;
      if(now < earlyGuardUntil) return false;
      const aliveCivs = (S.civilians || []).reduce((n, c)=>n + (c?.alive && !c?.evac ? 1 : 0), 0);
      const underAttack = Math.max(0, Number(S._underAttack || 0));
      if(aliveCivs > 0 && underAttack >= Math.max(2, Math.ceil(aliveCivs * 0.5))){
        const aliveNow = (S.tigers || []).reduce((n, t)=>n + (t?.alive ? 1 : 0), 0);
        if(aliveNow >= 2) return false;
      }
    }
  }
  const alive = (S.tigers || []).reduce((n, t)=>n + (t?.alive ? 1 : 0), 0);
  const caps = missionDirectorHardCaps();
  return alive + Math.max(1, Math.floor(extra || 1)) <= caps.tigers;
}
function missionDirectorMarkTigerSpawn(opts={}){
  const now = Date.now();
  const director = ensureMissionDirectorState();
  const phaseKey = DIRECTOR_PHASE_CONFIG[director.phase] ? director.phase : DIRECTOR_PHASES.CALM;
  const cfg = DIRECTOR_PHASE_CONFIG[phaseKey];
  const tuning = currentBalanceTuning(S, now);
  const minCd = Math.round(cfg.spawnCd?.[0] || 13000);
  const maxCd = Math.round(cfg.spawnCd?.[1] || 19000);
  const survivalMul = S.mode === "Survival" ? 0.76 : 1;
  const cdMul = clamp(Number(tuning.spawnCdMul || 1), 0.84, 1.22);
  const cd = rand(
    Math.max(1200, Math.round(minCd * survivalMul * cdMul)),
    Math.max(1600, Math.round(maxCd * survivalMul * cdMul))
  );
  director.nextSpawnAt = now + cd;
}
function missionDirectorTargetPressure(now=Date.now()){
  if(S.respawnPendingUntil && now < S.respawnPendingUntil){
    return 6;
  }
  const aliveTigers = (S.tigers || []).filter((t)=>t && t.alive);
  const aliveCivs = (S.mode === "Survival")
    ? []
    : (S.civilians || []).filter((c)=>c && c.alive && !c.evac);
  const nearPlayer = aliveTigers.reduce((n, t)=>n + (dist(S.me.x, S.me.y, t.x, t.y) < 190 ? 1 : 0), 0);
  let nearCivs = 0;
  if(aliveCivs.length){
    for(const t of aliveTigers){
      for(const c of aliveCivs){
        if(dist(t.x, t.y, c.x, c.y) < 150){
          nearCivs += 1;
          break;
        }
      }
    }
  }
  const underAttack = Math.max(0, Number(S._underAttack || 0));
  const inBattle = S.inBattle ? 1 : 0;
  const hpStress = clamp((100 - Number(S.hp || 100)) / 100, 0, 1);
  const levelStress = (() => {
    if(S.mode === "Story"){
      const storyMission = storyMissionForState(S);
      const idx = Math.max(1, Number(storyMission?.number || S.storyLevel || 1));
      return clamp((idx - 1) / 99, 0, 1);
    }
    if(S.mode === "Arcade") return clamp(((S.arcadeLevel || 1) - 1) / 99, 0, 1);
    return clamp(((S.survivalWave || 1) - 1) / 35, 0, 1);
  })();
  let target = 7;
  target += aliveTigers.length * 2.3;
  target += nearPlayer * 6.2;
  target += nearCivs * 5.0;
  target += underAttack * 7.4;
  target += inBattle * 9.4;
  target += hpStress * 12;
  target += levelStress * (S.mode === "Survival" ? 18 : 12);
  if(now < (S.civGraceUntil || 0)) target *= 0.72;
  if(S.mode !== "Survival" && now < ((S.civGraceUntil || 0) + 2200)) target *= 0.62;
  if(now < ((S.rollInvulnUntil || 0) + 850)) target *= 0.56;
  if(S.mode !== "Survival" && aliveCivs.length){
    const attackRatio = underAttack / Math.max(1, aliveCivs.length);
    if(attackRatio >= 0.5) target = Math.min(target, 58);
    if(!inBattle && underAttack === 0) target -= 5;
    if(!inBattle && underAttack === 0 && nearPlayer === 0) target -= 3;
  }
  const tuning = currentBalanceTuning(S, now);
  target *= clamp(Number(tuning.pressureMul || 1), 0.86, 1.16);
  return clamp(target, 0, 100);
}
function missionDirectorResolvePhase(pressure, currentPhase){
  const p = clamp(Number(pressure) || 0, 0, 100);
  const cur = DIRECTOR_PHASE_CONFIG[currentPhase] ? currentPhase : DIRECTOR_PHASES.CALM;
  if(cur === DIRECTOR_PHASES.PEAK){
    if(p >= 66) return DIRECTOR_PHASES.PEAK;
    if(p >= 38) return DIRECTOR_PHASES.RECOVER;
    if(p >= 24) return DIRECTOR_PHASES.PRESSURE;
    return DIRECTOR_PHASES.CALM;
  }
  if(cur === DIRECTOR_PHASES.PRESSURE){
    if(p >= 80) return DIRECTOR_PHASES.PEAK;
    if(p >= 34) return DIRECTOR_PHASES.PRESSURE;
    if(p >= 22) return DIRECTOR_PHASES.RECOVER;
    return DIRECTOR_PHASES.CALM;
  }
  if(cur === DIRECTOR_PHASES.RECOVER){
    if(p >= 84) return DIRECTOR_PHASES.PEAK;
    if(p >= 52) return DIRECTOR_PHASES.PRESSURE;
    if(p >= 26) return DIRECTOR_PHASES.RECOVER;
    return DIRECTOR_PHASES.CALM;
  }
  if(p >= 46) return DIRECTOR_PHASES.PRESSURE;
  return DIRECTOR_PHASES.CALM;
}
function missionDirectorApplyHardCaps(){
  if(!S || typeof S !== "object") return { trimmed:0 };
  const caps = missionDirectorHardCaps();
  let trimmed = 0;
  if(Array.isArray(S.tigers) && S.tigers.length > caps.tigers){
    const alive = S.tigers.filter((t)=>t && t.alive);
    const dead = S.tigers.filter((t)=>!t?.alive);
    const keepIds = new Set();
    for(const t of alive){
      if(isBossTiger(t) || t.id === S.activeTigerId || t.id === S.lockedTigerId){
        keepIds.add(t.id);
      }
    }
    if(S.dangerCivId){
      const civ = (S.civilians || []).find((c)=>c?.alive && !c.evac && c.id === S.dangerCivId);
      if(civ){
        for(const t of alive){
          if(dist(t.x, t.y, civ.x, civ.y) < 210) keepIds.add(t.id);
        }
      }
    }
    const keep = alive.filter((t)=>keepIds.has(t.id));
    const overflow = alive.filter((t)=>!keepIds.has(t.id));
    overflow.sort((a, b)=>dist(S.me.x, S.me.y, a.x, a.y) - dist(S.me.x, S.me.y, b.x, b.y));
    const finalAlive = [...keep, ...overflow].slice(0, caps.tigers);
    const before = S.tigers.length;
    // Keep a tiny dead tail for FX continuity, but prioritize live entity cap.
    const deadTail = dead.slice(-Math.min(2, Math.max(0, caps.tigers - finalAlive.length)));
    S.tigers = [...finalAlive, ...deadTail];
    trimmed += Math.max(0, before - S.tigers.length);
  }
  if(Array.isArray(S.pickups) && S.pickups.length > caps.pickups){
    const before = S.pickups.length;
    S.pickups = S.pickups.slice(-caps.pickups);
    trimmed += Math.max(0, before - S.pickups.length);
  }
  if(Array.isArray(S.carcasses) && S.carcasses.length > caps.carcasses){
    const before = S.carcasses.length;
    S.carcasses = S.carcasses.slice(-caps.carcasses);
    trimmed += Math.max(0, before - S.carcasses.length);
  }
  if(Array.isArray(S.trapsPlaced) && S.trapsPlaced.length > caps.traps){
    const before = S.trapsPlaced.length;
    S.trapsPlaced = S.trapsPlaced.slice(-caps.traps);
    trimmed += Math.max(0, before - S.trapsPlaced.length);
  }
  if(Array.isArray(S.supportUnits) && S.supportUnits.length > caps.support){
    const before = S.supportUnits.length;
    S.supportUnits = S.supportUnits.slice(0, caps.support);
    trimmed += Math.max(0, before - S.supportUnits.length);
  }
  return { trimmed, caps };
}
function missionDirectorTick(){
  if(!S || typeof S !== "object") return;
  if(window.__TUTORIAL_MODE__) return;
  if(S.gameOver || S.missionEnded) return;
  const now = Date.now();
  const director = ensureMissionDirectorState();
  if(S.paused) return;
  if(now < (director.lastSampleAt || 0) + 140) return;
  director.lastSampleAt = now;

  const target = missionDirectorTargetPressure(now);
  const current = clamp(Number(director.pressure || 0), 0, 100);
  const riseAlpha = S.mode === "Survival" ? 0.14 : 0.13;
  const fallAlpha = S.mode === "Survival" ? 0.18 : 0.22;
  const alpha = target >= current ? riseAlpha : fallAlpha;
  director.pressure = clamp(current + ((target - current) * alpha), 0, 100);
  const resolved = missionDirectorResolvePhase(director.pressure, director.phase);
  if(resolved !== director.phase && now >= (director.phaseLockUntil || 0)){
    const currentRank = directorPhaseRank(director.phase);
    const nextRank = directorPhaseRank(resolved);
    const downshift = nextRank < currentRank;
    director.phase = resolved;
    director.phaseChangedAt = now;
    director.phaseLockUntil = now + (downshift ? 2200 : DIRECTOR_PHASE_MIN_LOCK_MS);
    if(!window.__TUTORIAL_MODE__ && now > (director.lastNoticeAt || 0) + 8200){
      director.lastNoticeAt = now;
      setEventText(`Mission Director: ${directorPhaseLabel(director.phase)} (${Math.round(director.pressure)}%)`, 2.2);
    }
  }
  const phaseCfg = DIRECTOR_PHASE_CONFIG[director.phase] || DIRECTOR_PHASE_CONFIG.CALM;
  const tuning = currentBalanceTuning(S, now);
  S._directorAggroMul = clamp(Number(phaseCfg.aggroMul || 1) * clamp(Number(tuning.aggroMul || 1), 0.86, 1.18), 0.78, 1.28);
  S._directorSpeedMul = clamp(Number(phaseCfg.speedMul || 1) * clamp(Number(tuning.speedMul || 1), 0.88, 1.14), 0.84, 1.22);

  if(now >= (director.hardTrimAt || 0)){
    const trimRes = missionDirectorApplyHardCaps();
    director.hardTrimAt = now + (frameLagTier() >= 1 ? 280 : 360);
    if(trimRes.trimmed > 0 && now > (director.lastNoticeAt || 0) + 6200){
      director.lastNoticeAt = now;
      setEventText(`Director stabilized mission load (${trimRes.trimmed} cleanup).`, 1.8);
    }
  }
}
function beginFrameBudget(frameStartTs){
  const now = Number.isFinite(frameStartTs) ? frameStartTs : (performance.now ? performance.now() : Date.now());
  const mode = performanceMode();
  __frameDynamicLoadMul = computeFrameLoadMultiplier();
  const lagTier = frameLagTier();
  if(lagTier >= 1) __frameDynamicLoadMul = Math.max(__frameDynamicLoadMul, FRAME_LOAD_HIGH);
  if(lagTier >= 2) __frameDynamicLoadMul = Math.max(__frameDynamicLoadMul, FRAME_LOAD_EXTREME);
  let limit = mode === "PERFORMANCE" ? 9.8 : 12.6;
  if(frameIsSlow(now)) limit -= 1.6;
  if(__frameDynamicLoadMul >= FRAME_LOAD_HIGH) limit -= 0.8;
  if(__frameDynamicLoadMul >= FRAME_LOAD_EXTREME) limit -= 0.8;
  if(lagTier >= 2) limit -= 0.9;
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
function resetCanvasDrawState(){
  if(!ctx) return;
  try{
    if(typeof ctx.resetTransform === "function") ctx.resetTransform();
    else if(typeof ctx.setTransform === "function") ctx.setTransform(1, 0, 0, 1, 0, 0);
  }catch(e){}
  try{ ctx.globalAlpha = 1; }catch(e){}
  try{ ctx.globalCompositeOperation = "source-over"; }catch(e){}
  try{ ctx.setLineDash([]); }catch(e){}
  try{
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }catch(e){}
}
function safeTick(key, fn){
  try{
    fn();
    return true;
  }catch(err){
    const k = String(key || "");
    if(/draw|render|scene|map/i.test(k)){
      try{ resetCanvasDrawState(); }catch(e){}
      try{ if(typeof invalidateMapCache === "function") invalidateMapCache(); }catch(e){}
    }
    reportTickError(key, err);
    return false;
  }
}
function runFrameTask(key, intervalMs, fn, options={}){
  const opts = options || {};
  const now = Date.now();
  if(now < (__frameTaskGate[key] || 0)) return false;
  const lagTier = frameLagTier();
  const mobile = isMobileViewport();
  const critical = !!opts.critical;
  let adjustedInterval = Math.max(8, Math.round(Number(intervalMs) || 16));
  if(!critical){
    let slowMul = 1;
    if(lagTier >= 2) slowMul = mobile ? 1.85 : 1.55;
    else if(lagTier >= 1) slowMul = mobile ? 1.45 : 1.25;
    else if(frameIsSlow()) slowMul = mobile ? 1.24 : 1.14;
    if(slowMul > 1){
      adjustedInterval = Math.max(adjustedInterval, Math.round(adjustedInterval * slowMul));
    }
  }
  const cadenceBase = Math.max(1, Math.floor(Number(opts.cadence) || 1));
  const cadenceSlow = Math.max(cadenceBase, Math.floor(Number(opts.slowCadence) || cadenceBase));
  const cadenceHeavy = Math.max(cadenceSlow, Math.floor(Number(opts.heavyCadence) || cadenceSlow));
  const cadenceExtreme = Math.max(cadenceHeavy, Math.floor(Number(opts.extremeCadence) || cadenceHeavy));
  let cadence = cadenceBase;
  if(frameIsSlow()) cadence = Math.max(cadence, cadenceSlow);
  if(__frameDynamicLoadMul >= FRAME_LOAD_HIGH) cadence = Math.max(cadence, cadenceHeavy);
  if(__frameDynamicLoadMul >= FRAME_LOAD_EXTREME) cadence = Math.max(cadence, cadenceExtreme);
  if(cadence > 1){
    if(!Number.isFinite(__frameTaskPhase[key])){
      let hash = 0;
      const sk = String(key || "");
      for(let i=0;i<sk.length;i++) hash = ((hash * 33) + sk.charCodeAt(i)) | 0;
      __frameTaskPhase[key] = Math.abs(hash) % cadence;
    }else{
      __frameTaskPhase[key] = Math.abs(Math.floor(__frameTaskPhase[key])) % cadence;
    }
    const frameNo = Math.max(0, Math.floor(Number(__frameBudgetState.frameNo) || 0));
    const phase = __frameTaskPhase[key] || 0;
    if((frameNo % cadence) !== phase){
      __frameTaskGate[key] = now + Math.min(intervalMs, 24);
      return false;
    }
  }
  const costHint = Math.max(0, Number(opts.costHint) || 0);
  if(!critical && frameBudgetExceeded(costHint)){
    __frameTaskGate[key] = now + Math.max(48, Math.min(adjustedInterval, mobile ? 120 : 90));
    __frameBudgetState.dropped = (__frameBudgetState.dropped || 0) + 1;
    if(__frameBudgetState.dropped >= 6){
      const perfNow = performance.now ? performance.now() : now;
      __frameSlowUntil = Math.max(__frameSlowUntil || 0, perfNow + 1400);
    }
    return false;
  }
  __frameTaskGate[key] = now + adjustedInterval;
  safeTick(key, fn);
  return true;
}

function frameIsSlow(nowTs){
  const now = Number.isFinite(nowTs) ? nowTs : (performance.now ? performance.now() : Date.now());
  return now < (__frameSlowUntil || 0);
}
function frameTimeScale(){
  const avgGap = __avgStabilitySample(__stabilityMonitorState.frameGaps);
  if(!Number.isFinite(avgGap) || avgGap <= 0) return 1;
  return clamp(avgGap / 16.7, 1, 2.8);
}

function frameInterval(baseMs, slowMul=1.45){
  const modeMul = performanceMode() === "PERFORMANCE" ? 1.24 : 1;
  const dynamicMul = Math.max(FRAME_LOAD_LIGHT, Number(__frameDynamicLoadMul || FRAME_LOAD_LIGHT));
  const blendedMul = Math.max(modeMul, dynamicMul);
  if(frameIsSlow()) return Math.max(baseMs + 1, Math.round(baseMs * Math.max(slowMul, blendedMul)));
  if(blendedMul > 1) return Math.max(baseMs + 1, Math.round(baseMs * blendedMul));
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
  if(isMobileViewport()) return false;
  if(window.__TS_SHOW_MONITOR__ === true) return true;
  if(window.__TUTORIAL_MODE__) return false;
  if(performanceMode() === "PERFORMANCE" && !isMobileViewport()) return true;
  if(frameIsSlow()) return true;
  return (now - (__stabilityMonitorState.lastSpikeAt || 0)) < 9000;
}
function renderStabilityMonitor(force=false){
  const now = Date.now();
  if(!force && (now - (__stabilityMonitorState.lastRenderAt || 0) < 260)) return;
  __stabilityMonitorState.lastRenderAt = now;
  const visible = shouldShowStabilityMonitor(now);
  if(!visible && !__stabilityMonitorState.node) return;
  const node = ensureStabilityMonitorNode();
  if(!node) return;
  node.style.display = visible ? "block" : "none";
  if(!visible) return;

  const avgGap = __avgStabilitySample(__stabilityMonitorState.frameGaps);
  const avgCost = __avgStabilitySample(__stabilityMonitorState.frameCosts);
  const worstGap = __maxStabilitySample(__stabilityMonitorState.frameGaps);
  const worstCost = __maxStabilitySample(__stabilityMonitorState.frameCosts);
  const fps = avgGap > 0 ? (1000 / avgGap) : 0;
  const dropped = Number(__frameBudgetState.dropped || 0);
  const recoversMin = (__freezeRecoverState.history || []).filter((t)=>(now - t) < 60000).length;
  const balance = ensureBalanceStatsState(S);
  const tuning = currentBalanceTuning(S, now);
  const failPct = Math.round(clamp(Number(balance.lastFailRate || 0), 0, 1) * 100);
  const mode = performanceMode() === "PERFORMANCE" ? "PERF" : "AUTO";
  node.innerText =
    `FPS ${fps.toFixed(0)} | gap ${avgGap.toFixed(1)}ms (max ${worstGap.toFixed(0)})` +
    `\nframe ${avgCost.toFixed(1)}ms (max ${worstCost.toFixed(0)}) | drop ${dropped}` +
    `\nmode ${mode} | recov ${recoversMin}/min` +
    `\nauto x${Number(tuning.autoTune || 1).toFixed(2)} | fail ${failPct}% | deaths ${Math.floor(Number(balance.lastDeathsRecent || 0))}`;
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
  markBalanceFreezeRecover(S);

  for(const k of Object.keys(__frameTaskGate)) delete __frameTaskGate[k];
  for(const k of Object.keys(__frameTaskPhase)) delete __frameTaskPhase[k];
  __frameSpikePending = false;
  __frameLagScore = 0;
  __frameBgFxFlip = 0;
  __frameDynamicLoadMul = FRAME_LOAD_LIGHT;
  __battleHudRenderAt = 0;
  __battleReadabilityRenderAt = 0;
  const perfNow = performance.now ? performance.now() : now;
  __frameRecoverUntil = Math.max(__frameRecoverUntil || 0, perfNow + 2200);
  __frameSlowUntil = Math.max(__frameSlowUntil || 0, perfNow + 2600);

  try{ if(typeof clearTransientCombatVisuals === "function") clearTransientCombatVisuals(); }catch(e){}
  try{ if(typeof invalidateMapCache === "function") invalidateMapCache(); }catch(e){}
  try{ if(typeof transitionCleanupSweep === "function") transitionCleanupSweep(`recover:${reason}`); }catch(e){}
  try{ if(typeof sanitizeRuntimeState === "function") sanitizeRuntimeState(); }catch(e){}
  try{ if(typeof clampWorldToCanvas === "function") clampWorldToCanvas(); }catch(e){}
  try{
    if(!isMobileViewport() && typeof validateMissionSpawnLayout === "function"){
      const res = validateMissionSpawnLayout({ repair:true });
      if((res?.fixed || 0) > 0){
        setEventText(`Stability recovered • spawn fixes: ${res.fixed}`, 1.4);
      } else {
        setEventText("Stability recovered.", 1.1);
      }
    } else {
      setEventText("Stability recovered.", isMobileViewport() ? 0.8 : 1.1);
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
  const mobile = isMobileViewport();
  noteFrameSample(frameGap, frameCost);
  if(mobile){
    if(frameGap > 6500 || frameCost > 380){
      runStabilityRecovery("critical-stall");
    }
  } else if(frameGap > 4200 || frameCost > 150){
    runStabilityRecovery("critical-stall");
  }
  if(frameGap > STABILITY_SPIKE_GAP_MS || frameCost > 46){
    if(!__frameSpikePending){
      markBalanceFreezeSpike(frameGap, frameCost, S);
    }
    __frameSpikePending = true;
  }
  if(mobile){
    if(frameGap > 1100 || frameCost > 180){
      __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + 3200);
    }
  } else {
    if(frameGap > STABILITY_STALL_HARD_GAP_MS || frameCost > STABILITY_STALL_COST_MS){
      runStabilityRecovery(frameGap > STABILITY_STALL_HARD_GAP_MS ? "hard-gap" : "hard-cost");
    } else if(frameGap > STABILITY_STALL_GAP_MS){
      __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + 3000);
    }
  }
  if(frameGap > 70 || frameCost > 34){
    __frameLagScore = Math.min(20, (__frameLagScore || 0) + 2);
  } else {
    __frameLagScore = Math.max(0, (__frameLagScore || 0) - 1);
  }
  if(__frameLagScore >= FRAME_LAG_CRITICAL_SCORE){
    __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + 3600);
    if(isMobileViewport() && performanceMode() !== "PERFORMANCE"){
      const nowMs = Date.now();
      if((__autoPerfEscalatedAt || 0) + 16000 < nowMs){
        __autoPerfEscalatedAt = nowMs;
        S.performanceMode = "PERFORMANCE";
        updatePerformanceLabels();
        setEventText("Performance mode auto-enabled for stability.", 1.8);
      }
    }
    __frameLagScore = Math.max(FRAME_LAG_WARN_SCORE, __frameLagScore - 3);
  } else if(__frameLagScore >= FRAME_LAG_WARN_SCORE){
    __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + 2400);
    __frameLagScore = Math.max(1, __frameLagScore - 1);
  }
}

function recoverFromSpikeFrame(){
  __frameSpikePending = false;
  const now = performance.now ? performance.now() : Date.now();
  __frameSlowUntil = Math.max(__frameSlowUntil || 0, now + STABILITY_SPIKE_RECOVER_MS);
  __frameRecoverUntil = Math.max(__frameRecoverUntil || 0, now + 1800);
  if(COMBAT_FX.length > 24) COMBAT_FX.splice(0, COMBAT_FX.length - 24);
  if(DAMAGE_POPUPS.length > 24) DAMAGE_POPUPS.splice(0, DAMAGE_POPUPS.length - 24);
  if(IMPACT_PULSES.length > 18) IMPACT_PULSES.splice(0, IMPACT_PULSES.length - 18);
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

  const slow = frameIsSlow();
  const mobile = isMobileViewport();
  const lagTier = frameLagTier();
  const perfMode = performanceMode() === "PERFORMANCE";
  let fxCap = slow ? (mobile ? 14 : 22) : (lagTier >= 1 ? (mobile ? 16 : 22) : (mobile ? 24 : 34));
  let popupCap = slow ? (mobile ? 10 : 16) : (lagTier >= 1 ? (mobile ? 12 : 16) : (mobile ? 18 : 24));
  let pulseCap = slow ? (mobile ? 8 : 14) : (lagTier >= 1 ? (mobile ? 10 : 14) : (mobile ? 14 : 22));
  if(perfMode){
    fxCap = Math.min(fxCap, mobile ? 12 : 18);
    popupCap = Math.min(popupCap, mobile ? 9 : 14);
    pulseCap = Math.min(pulseCap, mobile ? 7 : 12);
  }
  if(COMBAT_FX.length > fxCap) COMBAT_FX.splice(0, COMBAT_FX.length - fxCap);
  if(DAMAGE_POPUPS.length > popupCap) DAMAGE_POPUPS.splice(0, DAMAGE_POPUPS.length - popupCap);
  if(IMPACT_PULSES.length > pulseCap) IMPACT_PULSES.splice(0, IMPACT_PULSES.length - pulseCap);
  if(DAMAGE_POPUP_GATE.size > 360){
    const nowGate = Date.now();
    for(const [k, at] of DAMAGE_POPUP_GATE){
      if((Number(at) || 0) + 2400 < nowGate) DAMAGE_POPUP_GATE.delete(k);
    }
    if(DAMAGE_POPUP_GATE.size > 360) DAMAGE_POPUP_GATE.clear();
  }

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
  if(!S.soundOn){
    clearLaunchMusicLoop();
  }
  save();
  if(S.soundOn){
    sfx("ui");
    if(introOverlayVisible()){
      playLaunchTheme(true);
      startLaunchMusicLoop(true);
    }
  }
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
    ? Math.round(clamp(vh * 0.88, 320, 500))
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
  const coarse = !!window.matchMedia?.("(pointer:coarse)")?.matches;
  const touchCapable = ("ontouchstart" in window) || ((typeof navigator !== "undefined") && Number(navigator.maxTouchPoints || 0) > 0);
  const shortLandscape = isLandscapeViewport() && (window.innerHeight || 0) <= 620;
  return isMobileViewport() || coarse || touchCapable || shortLandscape;
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
    renderCompleteRecapCard();
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
function scalePointXY(obj, sx, sy, xKey="x", yKey="y"){
  if(!obj || typeof obj !== "object") return;
  const x = Number(obj[xKey]);
  const y = Number(obj[yKey]);
  if(Number.isFinite(x)) obj[xKey] = x * sx;
  if(Number.isFinite(y)) obj[yKey] = y * sy;
}
function scaleWorldForViewportResize(oldW, oldH, newW, newH){
  if(!S || typeof S !== "object") return;
  if(!(oldW > 0 && oldH > 0 && newW > 0 && newH > 0)) return;
  if(oldW === newW && oldH === newH) return;
  ensureWorldLayout(S);
  if(!window.__TUTORIAL_MODE__){
    const cam = cameraClampCenter(S?.camera?.x, S?.camera?.y, S);
    if(!S.camera || typeof S.camera !== "object") S.camera = { x:cam.x, y:cam.y };
    else {
      S.camera.x = cam.x;
      S.camera.y = cam.y;
    }
    return;
  }
  const sx = newW / oldW;
  const sy = newH / oldH;
  const sr = Math.sqrt(Math.max(0.01, sx * sy));

  scalePointXY(S.me, sx, sy);
  scalePointXY(S.target, sx, sy);
  scalePointXY(S.evacZone, sx, sy);
  if(S.evacZone && Number.isFinite(S.evacZone.r)) S.evacZone.r = S.evacZone.r * sr;

  for(const arrName of ["civilians","tigers","pickups","carcasses","trapsPlaced","rescueSites","mapInteractables"]){
    const arr = S[arrName];
    if(!Array.isArray(arr)) continue;
    for(const item of arr){
      scalePointXY(item, sx, sy);
      if(Number.isFinite(item?.r)) item.r = item.r * sr;
      if(arrName === "supportUnits"){
        scalePointXY(item, sx, sy, "homeX", "homeY");
      }
    }
  }

  if(Array.isArray(S.supportUnits)){
    for(const unit of S.supportUnits){
      scalePointXY(unit, sx, sy);
      scalePointXY(unit, sx, sy, "homeX", "homeY");
    }
  }

  if(Number.isFinite(S.respawnTargetX)) S.respawnTargetX *= sx;
  if(Number.isFinite(S.respawnTargetY)) S.respawnTargetY *= sy;
  if(Number.isFinite(S.rollAnimFromX)) S.rollAnimFromX *= sx;
  if(Number.isFinite(S.rollAnimFromY)) S.rollAnimFromY *= sy;
  if(Number.isFinite(S.rollAnimToX)) S.rollAnimToX *= sx;
  if(Number.isFinite(S.rollAnimToY)) S.rollAnimToY *= sy;

  const tw = ensureMissionTwistState(S);
  scalePointXY(tw.bridge, sx, sy);
  tw.bridge.r = clamp((Number(tw.bridge.r) || 68) * sr, 24, 180);
  scalePointXY(tw.hostage, sx, sy);
  tw.hostage.r = clamp((Number(tw.hostage.r) || 48) * sr, 20, 140);
}
function clampWorldToCanvas(){
  if(!S || typeof S !== "object") return;
  ensureWorldLayout(S);
  const w = worldWidth(S);
  const h = worldHeight(S);
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
    S.me.x = clamp(S.me.x, 40, w - 40);
    S.me.y = clamp(S.me.y, 60, h - 40);
    if(inMobileNoBuildZone(S.me.x, S.me.y, 16) || blockedAt(S.me.x, S.me.y, 16)){
      const mePt = safeSpawnPoint(S.me.x, S.me.y, 16, true, false);
      S.me.x = mePt.x;
      S.me.y = mePt.y;
      if(S.target && inMobileNoBuildZone(S.target.x, S.target.y, 20)) S.target = null;
    }
  }
  if(S.evacZone){
    S.evacZone.x = clamp(S.evacZone.x, 100, w - 60);
    S.evacZone.y = clamp(S.evacZone.y, 100, h - 60);
    if(inMapScenarioKeepout(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.90))){
      const zonePt = safeSpawnPoint(S.evacZone.x, S.evacZone.y, Math.round((S.evacZone.r || 70) * 0.45), true, true);
      S.evacZone.x = zonePt.x;
      S.evacZone.y = zonePt.y;
    }
  }
  const tw = ensureMissionTwistState(S);
  tw.bridge.x = clamp(tw.bridge.x, 60, w - 60);
  tw.bridge.y = clamp(tw.bridge.y, 80, h - 60);
  tw.bridge.r = clamp(tw.bridge.r, 24, 180);
  tw.hostage.x = clamp(tw.hostage.x, 60, w - 60);
  tw.hostage.y = clamp(tw.hostage.y, 80, h - 60);
  tw.hostage.r = clamp(tw.hostage.r, 20, 140);
  for(const civ of (S.civilians || [])){
    civ.x = clamp(civ.x, 50, w - 50);
    civ.y = clamp(civ.y, 70, h - 50);
    if(inMobileNoBuildZone(civ.x, civ.y, 14) || blockedAt(civ.x, civ.y, 14)){
      const civPt = safeSpawnPoint(civ.x, civ.y, 14, true, false);
      civ.x = civPt.x;
      civ.y = civPt.y;
    }
  }
  for(const tiger of (S.tigers || [])){
    tiger.x = clamp(tiger.x, 40, w - 40);
    tiger.y = clamp(tiger.y, 60, h - 40);
    if(inMobileNoBuildZone(tiger.x, tiger.y, 16) || blockedAt(tiger.x, tiger.y, 18)){
      const tigerPt = safeSpawnPoint(tiger.x, tiger.y, 16, true, false);
      tiger.x = tigerPt.x;
      tiger.y = tigerPt.y;
    }
  }
  for(const pickup of (S.pickups || [])){
    pickup.x = clamp(pickup.x, 40, w - 40);
    pickup.y = clamp(pickup.y, 60, h - 40);
  }
  for(const carcass of (S.carcasses || [])){
    carcass.x = clamp(carcass.x, 40, w - 40);
    carcass.y = clamp(carcass.y, 60, h - 40);
  }
  for(const trap of (S.trapsPlaced || [])){
    trap.x = clamp(trap.x, 40, w - 40);
    trap.y = clamp(trap.y, 60, h - 40);
  }
  for(const ally of (S.supportUnits || [])){
    ally.x = clamp(ally.x, 40, w - 40);
    ally.y = clamp(ally.y, 60, h - 40);
    ally.homeX = clamp(ally.homeX ?? ally.x, 40, w - 40);
    ally.homeY = clamp(ally.homeY ?? ally.y, 60, h - 40);
    if(inMobileNoBuildZone(ally.x, ally.y, 16) || blockedAt(ally.x, ally.y, 16)){
      const allyPt = safeSpawnPoint(ally.x, ally.y, 16, true, false);
      ally.x = allyPt.x;
      ally.y = allyPt.y;
      ally.homeX = clamp(ally.homeX ?? ally.x, 40, w - 40);
      ally.homeY = clamp(ally.homeY ?? ally.y, 60, h - 40);
    }
  }
  for(const site of (S.rescueSites || [])){
    site.x = clamp(site.x, 70, w - 70);
    site.y = clamp(site.y, 90, h - 80);
    if(
      inMapScenarioKeepout(site.x, site.y, Math.round((site.r || 44) * 0.42)) ||
      blockedAt(site.x, site.y, Math.round((site.r || 44) * 0.36))
    ){
      const pt = safeSpawnPoint(site.x, site.y, Math.round((site.r || 44) * 0.42), true, true);
      site.x = pt.x;
      site.y = pt.y;
    }
  }
  for(const it of (S.mapInteractables || [])){
    it.x = clamp(it.x, 70, w - 70);
    it.y = clamp(it.y, 90, h - 80);
    if(
      inMapScenarioKeepout(it.x, it.y, Math.round((it.r || 22) * 0.9)) ||
      blockedAt(it.x, it.y, Math.round((it.r || 22) * 0.5))
    ){
      const pt = safeSpawnPoint(it.x, it.y, Math.round((it.r || 22) * 0.9), true, true);
      it.x = pt.x;
      it.y = pt.y;
    }
  }
}
function sanitizeRuntimeState(){
  if(!S || typeof S !== "object") return;
  ensureWorldLayout(S);
  ensureStoryMetaState();
  ensureTouchHudState();
  ensureMissionDirectorState();
  ensureBalanceStatsState();
  ensureMissionTwistState();
  ensureArcadeBuildcraftState(S);
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

  const w = worldWidth(S);
  const h = worldHeight(S);
  const clampX = (v, min=40, max=w-40)=>clamp(v, min, max);
  const clampY = (v, min=60, max=h-40)=>clamp(v, min, max);

  if(!S.me || typeof S.me !== "object") S.me = { ...DEFAULT.me };
  S.me.x = clampX(S.me.x, 40, w - 40);
  S.me.y = clampY(S.me.y, 60, h - 40);
  if(inMobileNoBuildZone(S.me.x, S.me.y, 16) || blockedAt(S.me.x, S.me.y, 16)){
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
    if(isBossTiger(t) && Number(t.bossPhases || 0) < 3) t.bossPhases = 3;
    if(!Number.isFinite(t.bossStalkUntil)) t.bossStalkUntil = 0;
    if(!Number.isFinite(t._bossStalkPromptAt)) t._bossStalkPromptAt = 0;
    if(!Number.isFinite(t._bossWarnForSkillAt)) t._bossWarnForSkillAt = 0;
    if(!Number.isFinite(t._bossPrefightWarnedAt)) t._bossPrefightWarnedAt = 0;
    if(!Number.isFinite(t._bossLastTellAt)) t._bossLastTellAt = 0;
    if(typeof t._bossLastTellKey !== "string") t._bossLastTellKey = "";
    if(inMobileNoBuildZone(t.x, t.y, 16) || blockedAt(t.x, t.y, 18)){
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
    if(inMobileNoBuildZone(c.x, c.y, 14) || blockedAt(c.x, c.y, 14)){
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
    if(inMobileNoBuildZone(u.x, u.y, 16) || blockedAt(u.x, u.y, 16)){
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
    if(inMapScenarioKeepout(p.x, p.y, 12) || blockedAt(p.x, p.y, 12)){
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
    if(inMapScenarioKeepout(it.x, it.y, it.r) || blockedAt(it.x, it.y, Math.round(it.r * 0.5))){
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
    if(inMapScenarioKeepout(site.x, site.y, Math.round(site.r * 0.42)) || blockedAt(site.x, site.y, Math.round(site.r * 0.36))){
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
  if(!Number.isFinite(S._directorAggroMul)) S._directorAggroMul = 1;
  if(!Number.isFinite(S._directorSpeedMul)) S._directorSpeedMul = 1;
  if(!Number.isFinite(S._biomeFogPulseAt)) S._biomeFogPulseAt = 0;
  if(COMBAT_FX.length > 96){
    COMBAT_FX.splice(0, COMBAT_FX.length - 96);
  }
}
function resizeCanvasForViewport(){
  const prevW = Number(cv.width || 0) || 960;
  const prevH = Number(cv.height || 0) || 540;
  const mobile = isMobileViewport();
  cv.width = mobile
    ? (isLandscapeViewport() ? 980 : 820)
    : 960;
  cv.height = mobile ? mobileCanvasHeight() : 540;
  try{ scaleWorldForViewportResize(prevW, prevH, cv.width, cv.height); }catch(e){}
  try{ sanitizeRuntimeState(); }catch(e){}
  try{ clampWorldToCanvas(); }catch(e){}
  invalidateMapCache();
}
const STAMINA_COST_SCAN = 8;
const STAMINA_COST_SPRINT = 16;
const STAMINA_DRAIN_WALK = 0.035;
const STAMINA_DRAIN_SPRINT = 0.08;
const PLAYER_WALK_SPEED = 2.38;
const PLAYER_SPRINT_SPEED = 3.78;
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
  if(S.mode==="Story") return Math.max(1, storyRunIndexForState(S));
  if(S.mode==="Arcade") return Math.max(1, S.arcadeLevel || 1);
  return Math.max(1, S.survivalWave || 1);
}
function missionIndexForMode(mode=S.mode){
  if(mode==="Story") return clamp(Math.floor(storyMissionLevelForState(S) || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
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
function chapterBiomeProfile(mode=S.mode, chapter=chapterIndexForMode(mode)){
  const list = CHAPTER_BIOME_PROFILES[mode] || CHAPTER_BIOME_PROFILES.Survival;
  return list[clamp(chapter, 1, list.length) - 1] || list[0] || CHAPTER_BIOME_PROFILES.Survival[0];
}
function currentBiomeProfile(){
  return chapterBiomeProfile(S.mode, chapterIndexForMode(S.mode));
}
function biomeHazardModifiers(mode=S.mode, chapter=chapterIndexForMode(mode)){
  const profile = chapterBiomeProfile(mode, chapter);
  const hazards = (profile && profile.hazards && typeof profile.hazards === "object") ? profile.hazards : {};
  return {
    ...BIOME_HAZARD_DEFAULTS,
    ...hazards,
  };
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
const SQUAD_COMMAND_ORDER = ["AUTO", "ATTACK_TARGET", "RESCUE", "REGROUP", "HOLD"];
const SQUAD_COMMAND_LABELS = {
  AUTO: "Auto",
  ATTACK_TARGET: "Attack Target",
  RESCUE: "Rescue",
  REGROUP: "Regroup",
  HOLD: "Hold",
};
const SQUAD_COMMAND_SHORT_LABELS = {
  AUTO: "Auto",
  ATTACK_TARGET: "Target",
  RESCUE: "Rescue",
  REGROUP: "Group",
  HOLD: "Hold",
};
function normalizeSquadCommand(cmd){
  const key = String(cmd || "").trim().toUpperCase();
  return SQUAD_COMMAND_ORDER.includes(key) ? key : "AUTO";
}
function squadCommandLabel(cmd = S?.squadCommand){
  const key = normalizeSquadCommand(cmd);
  return SQUAD_COMMAND_LABELS[key] || SQUAD_COMMAND_LABELS.AUTO;
}
function squadCommandShortLabel(cmd = S?.squadCommand){
  const key = normalizeSquadCommand(cmd);
  return SQUAD_COMMAND_SHORT_LABELS[key] || SQUAD_COMMAND_SHORT_LABELS.AUTO;
}
const SQUAD_WHEEL_PROFILES = {
  A: {
    size: 186,
    center: 64,
    optionW: 66,
    optionH: 42,
    optionFont: 10,
    icon: 14,
    ringInset: 19,
    cornerGap: 14,
    anchorDx: -30,
    anchorDy: -74,
    pad: 102,
    zoneMinX: 0.56,
    zoneMaxX: 0.90,
    zoneMinY: 0.38,
    zoneMaxY: 0.82,
  },
  B: {
    size: 204,
    center: 70,
    optionW: 72,
    optionH: 46,
    optionFont: 11,
    icon: 15,
    ringInset: 21,
    cornerGap: 15,
    anchorDx: -40,
    anchorDy: -82,
    pad: 114,
    zoneMinX: 0.60,
    zoneMaxX: 0.92,
    zoneMinY: 0.34,
    zoneMaxY: 0.80,
  },
};
let __squadWheelOpen = false;
let __squadWheelAnchorId = "touchSquadWheelBtn";
function squadWheelProfileKey(stageRect){
  const vw = Math.max(1, Math.floor(window.innerWidth || stageRect.width || 1));
  const vh = Math.max(1, Math.floor(window.innerHeight || stageRect.height || 1));
  const portrait = vh >= vw;
  const veryTallPhone = portrait && (vh / vw) >= 1.95;
  const compact = Math.min(vw, vh) <= 440;
  if(portrait && (compact || veryTallPhone)) return "A";
  return "B";
}
function applySquadWheelProfile(stage, stageRect){
  const key = squadWheelProfileKey(stageRect);
  const profile = SQUAD_WHEEL_PROFILES[key] || SQUAD_WHEEL_PROFILES.B;
  if(!stage) return profile;
  stage.style.setProperty("--squad-wheel-size", `${Math.round(profile.size)}px`);
  stage.style.setProperty("--squad-wheel-center-size", `${Math.round(profile.center)}px`);
  stage.style.setProperty("--squad-wheel-option-width", `${Math.round(profile.optionW)}px`);
  stage.style.setProperty("--squad-wheel-option-height", `${Math.round(profile.optionH)}px`);
  stage.style.setProperty("--squad-wheel-option-font-size", `${Math.round(profile.optionFont)}px`);
  stage.style.setProperty("--squad-wheel-icon-size", `${Math.round(profile.icon)}px`);
  stage.style.setProperty("--squad-wheel-ring-inset", `${Math.round(profile.ringInset)}px`);
  stage.style.setProperty("--squad-wheel-corner-gap", `${Math.round(profile.cornerGap)}px`);
  return profile;
}
function squadCommandWheelRoot(){
  return document.getElementById("squadCommandWheel");
}
function isSquadCommandWheelOpen(){
  const root = squadCommandWheelRoot();
  return !!(root && root.classList.contains("open") && __squadWheelOpen);
}
function squadWheelAnchorEl(anchor){
  if(anchor && anchor.nodeType === 1) return anchor;
  const requested = typeof anchor === "string" ? anchor : "";
  const ids = [requested, __squadWheelAnchorId, "touchSquadWheelBtn", "squadCmdBtnMobile", "squadCmdBtn"];
  for(const id of ids){
    if(!id) continue;
    const el = document.getElementById(id);
    if(el && el.getClientRects().length) return el;
  }
  return null;
}
function positionSquadCommandWheel(anchor){
  const stage = document.querySelector(".mapStage");
  if(!stage) return;
  const stageRect = stage.getBoundingClientRect();
  if(!(stageRect.width > 0 && stageRect.height > 0)) return;
  const profileKey = squadWheelProfileKey(stageRect);
  const profile = applySquadWheelProfile(stage, stageRect);

  let cx = stageRect.width * 0.84;
  let cy = stageRect.height * 0.70;
  const anchorEl = squadWheelAnchorEl(anchor);
  if(anchorEl){
    const a = anchorEl.getBoundingClientRect();
    if(a.width > 0 && a.height > 0){
      cx = (a.left + a.width * 0.5) - stageRect.left;
      cy = (a.top + a.height * 0.5) - stageRect.top;
      __squadWheelAnchorId = anchorEl.id || __squadWheelAnchorId;
    }
  }
  cx += profile.anchorDx;
  cy += profile.anchorDy;
  const pad = profile.pad;
  cx = clamp(cx, pad, Math.max(pad, stageRect.width - pad));
  cy = clamp(cy, pad, Math.max(pad, stageRect.height - pad));
  // Final thumb-reach clamp: keep wheel in right-hand "comfort zone" per profile.
  const zoneMinX = stageRect.width * (profile.zoneMinX || 0.56);
  const zoneMaxX = stageRect.width * (profile.zoneMaxX || 0.92);
  const zoneMinY = stageRect.height * (profile.zoneMinY || 0.36);
  const zoneMaxY = stageRect.height * (profile.zoneMaxY || 0.82);
  cx = clamp(cx, zoneMinX, Math.max(zoneMinX, zoneMaxX));
  cy = clamp(cy, zoneMinY, Math.max(zoneMinY, zoneMaxY));
  if(profileKey === "A" && !anchorEl){
    // Stable fallback for tall portrait phones if anchor is unavailable.
    cx = clamp(stageRect.width * 0.76, zoneMinX, zoneMaxX);
    cy = clamp(stageRect.height * 0.62, zoneMinY, zoneMaxY);
  }
  stage.style.setProperty("--squad-wheel-x", `${Math.round(cx)}px`);
  stage.style.setProperty("--squad-wheel-y", `${Math.round(cy)}px`);
}
function syncSquadCommandWheelUi(){
  const current = normalizeSquadCommand(S?.squadCommand);
  document.querySelectorAll("#squadCommandWheel [data-cmd]").forEach((btn)=>{
    btn.classList.toggle("active", btn.dataset.cmd === current);
  });
  const touchMini = document.getElementById("touchSquadCmdMini");
  if(touchMini) touchMini.innerText = squadCommandShortLabel(current);
  const touchBtn = document.getElementById("touchSquadWheelBtn");
  if(touchBtn) touchBtn.title = `Squad: ${squadCommandLabel(current)}`;
}
function closeSquadCommandWheel(evt=null){
  if(evt?.preventDefault) evt.preventDefault();
  if(evt?.stopPropagation) evt.stopPropagation();
  const root = squadCommandWheelRoot();
  if(root){
    root.classList.remove("open");
    root.setAttribute("aria-hidden", "true");
  }
  __squadWheelOpen = false;
  return false;
}
function openSquadCommandWheel(anchor=null){
  if(!S || S.gameOver || S.missionEnded || S.paused || S.inBattle) return false;
  const root = squadCommandWheelRoot();
  if(!root) return false;
  positionSquadCommandWheel(anchor);
  syncSquadCommandWheelUi();
  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");
  __squadWheelOpen = true;
  return true;
}
function toggleSquadCommandWheel(anchor=null){
  if(anchor?.preventDefault) anchor.preventDefault();
  if(anchor?.stopPropagation) anchor.stopPropagation();
  if(isSquadCommandWheelOpen()) return closeSquadCommandWheel();
  return openSquadCommandWheel(anchor);
}
function pickSquadCommand(cmd, evt=null){
  if(evt?.preventDefault) evt.preventDefault();
  if(evt?.stopPropagation) evt.stopPropagation();
  setSquadCommand(cmd, { toast:true, save:true });
  syncSquadCommandWheelUi();
  closeSquadCommandWheel();
}
function setSquadCommand(cmd, opts={}){
  const next = normalizeSquadCommand(cmd);
  if(!S || typeof S !== "object") return next;
  if(S.squadCommand === next && !opts.force) return next;
  S.squadCommand = next;
  if(opts.toast !== false){
    toast(`Squad command: ${squadCommandLabel(next)}.`);
  }
  syncSquadCommandWheelUi();
  if(opts.save !== false) save();
  return next;
}
function cycleSquadCommand(){
  const current = normalizeSquadCommand(S?.squadCommand);
  const idx = Math.max(0, SQUAD_COMMAND_ORDER.indexOf(current));
  const next = SQUAD_COMMAND_ORDER[(idx + 1) % SQUAD_COMMAND_ORDER.length];
  return setSquadCommand(next, { toast:true, save:true });
}
function syncSquadRosterBounds(){
  S.squadCommand = normalizeSquadCommand(S.squadCommand);
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
  S.supportUnits = applyRaidPartnerSlots(S.supportUnits);
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
      if(unit.raidPartner) return true;
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
  S.supportUnits = applyRaidPartnerSlots(S.supportUnits);
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
  positionSquadCommandWheel();
  renderHUD();
}, { passive:true });
window.addEventListener("orientationchange", ()=>{
  resizeCanvasForViewport();
  applyMobileMenuState(__mobileMenuHiddenPref);
  applyTouchHudSettings();
  positionSquadCommandWheel();
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
  const biomeMul = clamp(Number(biomeHazardModifiers(S.mode).staminaDrainMul || 1), 0.70, 1.35);
  if(S.mode !== "Story"){
    return clamp(biomeMul * arcadeBuildcraftMul("staminaDrainMul", 1), 0.62, 1.45);
  }
  const base = 1 - (storyBaseRank("BASE_ENDURANCE") * 0.08);
  const chapterMul = storyChapterRewardUnlocked(6) ? 0.95 : 1;
  return clamp(base * chapterMul * biomeMul, 0.62, 1.35);
}
function storyPayoutMul(){
  if(S.mode !== "Story") return 1;
  const base = 1 + (storyBaseRank("BASE_FINANCE") * 0.08);
  const chapterMul = storyChapterRewardUnlocked(8) ? 1.08 : 1;
  return base * chapterMul;
}
function storyCivilianDamageMul(){
  if(S.mode === "Arcade"){
    return clamp(arcadeBuildcraftMul("civilianDamageMul", 1), 0.65, 1.32);
  }
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
  if(S.mode === "Arcade"){
    return clamp(arcadeBuildcraftMul("civilianFollowMul", 1), 0.82, 1.36);
  }
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
    trackCashEarned(def.cash);
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

const CORE_PERK_KEYS = ["H_CRIT","H_DMG","H_JAM","G_CIV_GUARD","G_ARMOR","T_TRAPS","T_RELOAD"];
const PERK_MAX_RANK = 6;
const PERK_EFFECTS = Object.freeze({
  H_CRIT: 0.0125,
  H_DMG: 0.025,
  H_JAM: 0.08,
  G_CIV_GUARD: 0.08,
  G_ARMOR: 0.03,
  T_TRAPS: 0.06,
  T_RELOAD: 0.06
});

function perkRank(k){
  return clamp(Math.floor(Number(S.perks?.[k] || 0)), 0, PERK_MAX_RANK);
}

function perkSpreadFloorRank(){
  let floor = Infinity;
  for(const key of CORE_PERK_KEYS){
    floor = Math.min(floor, perkRank(key));
  }
  if(!Number.isFinite(floor)) return 0;
  return Math.max(0, floor);
}

function perkUpgradeGate(key){
  if(!CORE_PERK_KEYS.includes(key)){
    return { ok:false, reason:"This perk cannot be upgraded." };
  }
  const rank = perkRank(key);
  if(rank >= PERK_MAX_RANK){
    return { ok:false, reason:`Max rank reached (${PERK_MAX_RANK}).` };
  }
  const floor = perkSpreadFloorRank();
  if(rank > floor){
    return { ok:false, reason:"Upgrade your lower-rank perks first." };
  }
  return { ok:true, reason:"" };
}

function perkCritBonus(){
  return perkRank("H_CRIT") * PERK_EFFECTS.H_CRIT;
}

function perkDamageMul(){
  return 1 + (perkRank("H_DMG") * PERK_EFFECTS.H_DMG);
}

function perkJamMul(){
  return clamp(1 - (perkRank("H_JAM") * PERK_EFFECTS.H_JAM), 0.55, 1);
}

function perkArmorEff(){
  return 1 + (perkRank("G_ARMOR") * PERK_EFFECTS.G_ARMOR);
}

function perkCivMul(){
  return clamp(1 - (perkRank("G_CIV_GUARD") * PERK_EFFECTS.G_CIV_GUARD), 0.55, 1);
}

function perkTrapScale(){
  return 1 + (perkRank("T_TRAPS") * PERK_EFFECTS.T_TRAPS);
}

function perkReloadBonus(){
  return perkRank("T_RELOAD") * PERK_EFFECTS.T_RELOAD;
}

function buyPerk(key){

  const points = Number(S.perkPoints || 0);

  if(points <= 0){
    toast("No perk points.");
    return;
  }
  const gate = perkUpgradeGate(key);
  if(!gate.ok){
    toast(gate.reason || "Perk is locked.");
    return;
  }

  S.perks[key] = perkRank(key) + 1;
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
function weaponMasteryLevelFromXp(xp){
  const val = Math.max(0, Math.floor(Number(xp || 0)));
  let level = 0;
  for(let i=1; i<WEAPON_MASTERY_THRESHOLDS.length; i++){
    if(val >= WEAPON_MASTERY_THRESHOLDS[i]) level = i;
    else break;
  }
  return clamp(level, 0, WEAPON_MASTERY_MAX_LEVEL);
}
function normalizeWeaponMasteryMap(raw){
  const out = {};
  for(const w of WEAPONS){
    out[w.id] = 0;
  }
  if(!raw || typeof raw !== "object") return out;
  for(const [wid, xpRaw] of Object.entries(raw)){
    if(!getWeapon(wid)) continue;
    const xp = Math.max(0, Math.floor(Number(xpRaw || 0)));
    if(Number.isFinite(xp)) out[wid] = xp;
  }
  return out;
}
function ensureWeaponMasteryState(state=S){
  if(!state || typeof state !== "object") return;
  state.weaponMastery = normalizeWeaponMasteryMap(state.weaponMastery);
}
function weaponMasteryXp(id){
  ensureWeaponMasteryState();
  if(!getWeapon(id)) return 0;
  return Math.max(0, Math.floor(Number(S.weaponMastery?.[id] || 0)));
}
function weaponMasteryLevel(id){
  return weaponMasteryLevelFromXp(weaponMasteryXp(id));
}
function weaponMasteryNextXp(level){
  const lvl = clamp(Math.floor(Number(level || 0)), 0, WEAPON_MASTERY_MAX_LEVEL);
  if(lvl >= WEAPON_MASTERY_MAX_LEVEL) return null;
  return WEAPON_MASTERY_THRESHOLDS[lvl + 1];
}
function weaponMasteryProgress(id){
  const xp = weaponMasteryXp(id);
  const level = weaponMasteryLevelFromXp(xp);
  const prevXp = WEAPON_MASTERY_THRESHOLDS[level] || 0;
  const nextXp = weaponMasteryNextXp(level);
  const span = nextXp ? Math.max(1, nextXp - prevXp) : 1;
  const pct = nextXp ? clamp((xp - prevXp) / span, 0, 1) : 1;
  return { xp, level, prevXp, nextXp, pct };
}
function weaponMasteryJamMul(id){
  const level = weaponMasteryLevel(id);
  const cut = level * WEAPON_MASTERY_JAM_REDUCTION_PER_LEVEL;
  return clamp(1 - cut, 0.62, 1);
}
function weaponMasteryReloadBonus(id){
  return weaponMasteryLevel(id) * WEAPON_MASTERY_RELOAD_SMOOTH_PER_LEVEL;
}
function addWeaponMasteryXp(id, amount, opts={}){
  const gain = Math.max(0, Math.floor(Number(amount || 0)));
  if(!gain) return;
  if(!getWeapon(id)) return;
  ensureWeaponMasteryState();
  const beforeXp = weaponMasteryXp(id);
  const beforeLevel = weaponMasteryLevelFromXp(beforeXp);
  const capXp = WEAPON_MASTERY_THRESHOLDS[WEAPON_MASTERY_THRESHOLDS.length - 1] + 9999;
  const afterXp = clamp(beforeXp + gain, 0, capXp);
  S.weaponMastery[id] = afterXp;
  const afterLevel = weaponMasteryLevelFromXp(afterXp);
  if(afterLevel > beforeLevel){
    const w = getWeapon(id);
    toast(`🎯 ${w?.name || "Weapon"} mastery Lv ${afterLevel}: smoother handling.`);
    if(opts?.notify !== false) hapticImpact("light");
  }
}
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
function buildDenseLandmarks(mapKey, chapter, w=worldWidth(S), h=worldHeight(S)){
  const family = mapFamilyKey(mapKey);
  const base = MAP_DENSE_LANDMARKS[family] || [];
  const ch = clamp(chapter || 1, 1, 10) - 1;
  const tileCols = clamp(Math.round(w / WORLD_BASE_WIDTH), 1, 4);
  const tileRows = clamp(Math.round(h / WORLD_BASE_HEIGHT), 1, 4);
  const out = [];
  for(let ty=0; ty<tileRows; ty++){
    for(let tx=0; tx<tileCols; tx++){
      const tileSeed = (ty * tileCols) + tx + 1;
      for(let idx=0; idx<base.length; idx++){
        const lm = base[idx];
        const wobbleX = Math.sin((idx + 1) * 1.71 + ch * 0.93 + tileSeed * 0.61) * 0.012;
        const wobbleY = Math.cos((idx + 1) * 1.37 + ch * 0.81 + tileSeed * 0.49) * 0.010;
        const nx = (tx + clamp(lm.nx + wobbleX, 0.04, 0.96)) / tileCols;
        const ny = (ty + clamp(lm.ny + wobbleY, 0.05, 0.95)) / tileRows;
        const x = clamp(Math.round(nx * w), 52, w - 52);
        const y = clamp(Math.round(ny * h), 70, h - 56);
        out.push({ ...lm, x, y });
      }
    }
  }
  return out;
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
  const keepoutRadius = profile.type === "circle"
    ? Math.max(26, (profile.r || 0) * scale * 1.1)
    : Math.max(26, Math.max(profile.w || 0, profile.h || 0) * scale * 0.62);
  if(inMapScenarioKeepout(item?.x, item?.y, keepoutRadius)) return;
  if(profile.type === "circle"){
    pushMapObstacleCircle(circles, item.x, item.y, profile.r * scale, profile.pad || 0);
    return;
  }
  pushMapObstacleRect(rects, item.x, item.y, profile.w * scale, profile.h * scale, profile.pad || 0);
}
function buildMapWaterZones(mapKey, chapter, w=worldWidth(S), h=worldHeight(S)){
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
  const w = worldWidth(S);
  const h = worldHeight(S);
  const sig = [S.mode, key, chapter, w, h, window.__TUTORIAL_MODE__ ? 1 : 0].join("|");
  if(sig === __mapObstacleSig) return;

  const rects = [];
  const circles = [];
  const waters = buildMapWaterZones(key, chapter, w, h);
  const denseLandmarks = buildDenseLandmarks(key, chapter, w, h);
  const family = mapFamilyKey(key);
  const sx = (v)=> v * (w / 960);
  const sy = (v)=> v * (h / 540);

  for(const lm of denseLandmarks){
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
  __mapDenseLandmarks = denseLandmarks;
  __mapDenseLandmarksSig = sig;
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
  const biomeMul = clamp(Number(biomeHazardModifiers(S.mode).waterSpeedMul || 1), 0.75, 1.15);
  let base = 0.90;
  if(entityType === "tiger") base = 0.96;
  else if(entityType === "soldier") base = 0.90;
  else if(entityType === "support") base = 0.88;
  else if(entityType === "civilian") base = 0.86;
  return clamp(base * biomeMul, 0.55, 1.15);
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
  const sp = worldToScreenPoint(x, y, S);
  const r = Math.max(0, radius || 0);
  return rectCircleCollide(rect.x, rect.y, rect.w, rect.h, sp.x, sp.y, r);
}
function inMobileControlKeepout(x, y, radius=0){
  const zones = mobileControlKeepoutZones();
  if(!zones.length) return false;
  const sp = worldToScreenPoint(x, y, S);
  const rrBase = Math.max(0, radius || 0);
  for(const zone of zones){
    const rr = zone.r + rrBase;
    const dx = sp.x - zone.x;
    const dy = sp.y - zone.y;
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
  const tw = S?.missionTwists;
  const bridge = tw?.bridge;
  if(
    bridge &&
    bridge.active &&
    Date.now() < (bridge.until || 0) &&
    dist(x, y, bridge.x || 0, bridge.y || 0) <= ((bridge.r || 0) + Math.max(2, Number(radius || 0)))
  ){
    __blockedAtCache.set(key, true);
    return true;
  }
  let blocked = false;
  if(inMapScenarioKeepout(x, y, radius + 10)){
    __blockedAtCache.set(key, false);
    return false;
  }
  // Blood pools are visual hazards; they should never hard-block movement.
  const sp = worldToScreenPoint(x, y, S);
  if(!(isMobileViewport() && sp.x > (cv.width * 0.66) && sp.y > (cv.height * 0.70))){
    blocked = blockedByMapObstacle(x, y, radius);
  }
  __blockedAtCache.set(key, blocked);
  if(__blockedAtCache.size > 1200){
    __blockedAtCache.clear();
    __blockedAtCacheFrame = __frameBudgetState.frameNo;
  }
  return blocked;
}
function entityNeedsRecovery(ent, radius, opts={}){
  if(!ent || !Number.isFinite(ent.x) || !Number.isFinite(ent.y)) return false;
  if(blockedAt(ent.x, ent.y, radius)) return true;
  if(opts.avoidKeepout && inMapScenarioKeepout(ent.x, ent.y, radius)) return true;
  if(opts.avoidWater && isPointInWater(ent.x, ent.y, Math.max(2, radius * 0.45))) return true;
  return false;
}
function forceEntityRecovery(ent, radius, opts={}){
  if(!ent || !Number.isFinite(ent.x) || !Number.isFinite(ent.y)) return false;
  const avoidKeepout = !!opts.avoidKeepout;
  const avoidWater = !!opts.avoidWater;
  const targetX = Number.isFinite(opts.targetX) ? opts.targetX : ent.x;
  const targetY = Number.isFinite(opts.targetY) ? opts.targetY : ent.y;
  const primary = findNearestOpenPoint(ent.x, ent.y, radius, {
    avoidKeepout,
    avoidWater,
    targetX,
    targetY
  });
  const secondary = primary || findNearestOpenPoint(targetX, targetY, radius, {
    avoidKeepout,
    avoidWater,
    targetX,
    targetY
  });
  const fallback = secondary || safeSpawnPoint(targetX, targetY, radius, avoidKeepout, avoidWater);
  if(!fallback) return false;
  ent.x = fallback.x;
  ent.y = fallback.y;
  ent._stuckTicks = 0;
  ent._lastMoveX = ent.x;
  ent._lastMoveY = ent.y;
  ent._nextUnstickTryAt = 0;
  ent._nextPathRecoverAt = 0;
  ent._nextKeepoutRecoverAt = 0;
  ent._pathStallCount = 0;
  return true;
}
function findNearestOpenPoint(x, y, radius, opts={}){
  const avoidKeepout = !!opts.avoidKeepout;
  const avoidWater = !!opts.avoidWater;
  const inPerfMode = performanceMode() === "PERFORMANCE";
  const slowFrame = frameIsSlow();
  const bounds = worldBounds(radius, S);
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const minY = bounds.minY;
  const maxY = bounds.maxY;
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
  const bounds = worldBounds(radius, S);
  return {
    x: clamp(x, bounds.minX, bounds.maxX),
    y: clamp(y, bounds.minY, bounds.maxY)
  };
}
function pointInViewportPad(x, y, pad=120){
  if(!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const sp = worldToScreenPoint(x, y, S);
  const w = Number(cv?.width || WORLD_BASE_WIDTH);
  const h = Number(cv?.height || WORLD_BASE_HEIGHT);
  return sp.x >= -pad && sp.x <= (w + pad) && sp.y >= -pad && sp.y <= (h + pad);
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
  if(entityNeedsRecovery(S.me, 16, { avoidKeepout:false })){
    forceEntityRecovery(S.me, 16, {
      avoidKeepout:false,
      avoidWater:false,
      targetX:S.target?.x,
      targetY:S.target?.y
    });
  }

  for(const civ of (S.civilians || [])){
    if(!civ.alive || civ.evac) continue;
    const civIntent = !!civ.following || (S.guideTargetId === civ.id) || entityNeedsRecovery(civ, 14, { avoidKeepout:true });
    resolveEntityStuck(civ, 14, {
      avoidKeepout:true,
      movingIntent:civIntent,
      stuckThreshold:20,
      targetX:S.evacZone?.x,
      targetY:S.evacZone?.y
    });
    if(entityNeedsRecovery(civ, 14, { avoidKeepout:true })){
      forceEntityRecovery(civ, 14, {
        avoidKeepout:true,
        avoidWater:false,
        targetX:S.evacZone?.x,
        targetY:S.evacZone?.y
      });
    }
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
    if(entityNeedsRecovery(unit, 16, { avoidKeepout:true })){
      forceEntityRecovery(unit, 16, {
        avoidKeepout:true,
        avoidWater:false,
        targetX:S.me?.x,
        targetY:S.me?.y
      });
    }
  }
  for(const tiger of (S.tigers || [])){
    if(!tiger.alive) continue;
    const tigerIntent = true;
    resolveEntityStuck(tiger, 16, {
      avoidKeepout:true,
      movingIntent:tigerIntent,
      stuckThreshold:16,
      targetX:S.me?.x,
      targetY:S.me?.y
    });
    if(entityNeedsRecovery(tiger, 16, { avoidKeepout:true })){
      forceEntityRecovery(tiger, 16, {
        avoidKeepout:true,
        avoidWater:false,
        targetX:S.me?.x,
        targetY:S.me?.y
      });
    }
  }
  for(const p of (S.pickups || [])){
    if(!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if(!inMapScenarioKeepout(p.x, p.y, 12) && !blockedAt(p.x, p.y, 12)) continue;
    const free = findNearestOpenPoint(p.x, p.y, 12, { avoidKeepout:true, avoidWater:false, targetX:S.me?.x, targetY:S.me?.y });
    if(free){
      p.x = free.x;
      p.y = free.y;
    }
  }
  for(const it of (S.mapInteractables || [])){
    if(!Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
    const rr = clamp(it.r, 12, 54);
    if(!inMapScenarioKeepout(it.x, it.y, rr) && !blockedAt(it.x, it.y, Math.round(rr * 0.5))) continue;
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
  const bounds = worldBounds(radius, S);
  const minX = bounds.minX;
  const maxX = bounds.maxX;
  const minY = bounds.minY;
  const maxY = bounds.maxY;
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

  const movedDist = dist(ent.x, ent.y, ox, oy);
  if(wantedDist > 0.34 && movedDist < 0.24){
    ent._pathStallCount = (ent._pathStallCount || 0) + 1;
    const stallThreshold = frameIsSlow() ? 4 : 3;
    if(ent._pathStallCount >= stallThreshold){
      const recovery = findNearestOpenPoint(targetX, targetY, radius, {
        avoidKeepout,
        targetX,
        targetY
      }) || findNearestOpenPoint(ox, oy, radius, {
        avoidKeepout,
        targetX,
        targetY
      });
      if(recovery){
        ent.x = recovery.x;
        ent.y = recovery.y;
        ent._pathStallCount = 0;
      } else {
        ent._nextPathRecoverAt = now + (frameIsSlow() ? 220 : 140);
        ent.x = clamp(ox, minX, maxX);
        ent.y = clamp(oy, minY, maxY);
        return false;
      }
    }
  } else {
    ent._pathStallCount = 0;
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
function missionTwistsEnabled(){
  return eventsEnabled() && !window.__TUTORIAL_MODE__ && !isMobileViewport();
}
function missionTwistBlackoutActive(now=Date.now()){
  const tw = ensureMissionTwistState(S);
  if(!tw.blackout.active) return false;
  if(now >= (tw.blackout.until || 0)){
    tw.blackout.active = false;
    tw.blackout.until = 0;
    if(tw.activeType === "blackout"){
      tw.activeType = "";
      tw.activeUntil = 0;
    }
    __savePending = true;
    return false;
  }
  return true;
}
function clearMissionTwist(type="", opts={}){
  const tw = ensureMissionTwistState(S);
  const silent = !!opts.silent;
  const now = Date.now();
  const target = String(type || tw.activeType || "");
  if(!type || type === "bridge"){
    tw.bridge.active = false;
    tw.bridge.until = 0;
  }
  if(!type || type === "hostage"){
    tw.hostage.active = false;
    tw.hostage.siteId = 0;
    tw.hostage.civId = 0;
    tw.hostage.until = 0;
    tw.hostage.rescued = false;
    tw.hostage.penaltyApplied = false;
  }
  if(!type || type === "blackout"){
    tw.blackout.active = false;
    tw.blackout.until = 0;
  }
  if(!type || tw.activeType === target){
    tw.activeType = "";
    tw.activeUntil = 0;
  }
  if(!silent && opts.notice){
    setEventText(String(opts.notice), Number.isFinite(opts.seconds) ? Number(opts.seconds) : 3.2);
  }
  tw.cooldownUntil = Math.max(tw.cooldownUntil || 0, now + Math.round(MISSION_TWIST_COOLDOWN_MS * 0.45));
  __savePending = true;
  return tw;
}
function missionTwistPickBridgePoint(){
  const minPlayerDist = 120;
  const candidates = [];
  const civs = (S.civilians || []).filter((c)=>c.alive && !c.evac);
  const tigers = (S.tigers || []).filter((t)=>t.alive);
  if(civs.length){
    const nearestCiv = civs.reduce((best, civ)=>{
      if(!best) return civ;
      return dist(S.me.x, S.me.y, civ.x, civ.y) < dist(S.me.x, S.me.y, best.x, best.y) ? civ : best;
    }, null);
    if(nearestCiv){
      candidates.push({ x:(S.me.x + nearestCiv.x) * 0.5, y:(S.me.y + nearestCiv.y) * 0.5 });
    }
  }
  if(tigers.length){
    const nearestTiger = tigers.reduce((best, tiger)=>{
      if(!best) return tiger;
      return dist(S.me.x, S.me.y, tiger.x, tiger.y) < dist(S.me.x, S.me.y, best.x, best.y) ? tiger : best;
    }, null);
    if(nearestTiger){
      candidates.push({ x:(S.me.x + nearestTiger.x) * 0.5, y:(S.me.y + nearestTiger.y) * 0.5 });
    }
  }
  candidates.push({ x:cv.width * 0.52, y:cv.height * 0.50 });
  candidates.push({ x:cv.width * 0.48, y:cv.height * 0.64 });

  const evaluate = (rawX, rawY)=>{
    let pt = safeSpawnPoint(rawX, rawY, 22, true, true);
    if(!pt) return null;
    const open = findNearestOpenPoint(pt.x, pt.y, 22, {
      avoidKeepout:true,
      avoidWater:true,
      targetX:cv.width * 0.5,
      targetY:cv.height * 0.5
    });
    if(open) pt = open;
    if(inMapScenarioKeepout(pt.x, pt.y, 26)) return null;
    if(isPointInWater(pt.x, pt.y, 16)) return null;
    if(dist(pt.x, pt.y, S.me.x, S.me.y) < minPlayerDist) return null;
    if(S.evacZone && dist(pt.x, pt.y, S.evacZone.x, S.evacZone.y) < ((S.evacZone.r || 70) + 84)) return null;
    return pt;
  };

  for(const c of candidates){
    const point = evaluate(c.x, c.y);
    if(point) return point;
  }
  for(let i=0; i<18; i++){
    const point = evaluate(rand(110, cv.width - 110), rand(120, cv.height - 110));
    if(point) return point;
  }
  return null;
}
function triggerMissionTwistBridge(now=Date.now()){
  const aliveTigerCount = (S.tigers || []).filter((t)=>t.alive).length;
  if(aliveTigerCount <= 0) return false;
  const point = missionTwistPickBridgePoint();
  if(!point) return false;
  const tw = ensureMissionTwistState(S);
  tw.bridge.active = true;
  tw.bridge.x = point.x;
  tw.bridge.y = point.y;
  tw.bridge.r = rand(MISSION_TWIST_BRIDGE_RADIUS_MIN, MISSION_TWIST_BRIDGE_RADIUS_MAX);
  tw.bridge.until = now + rand(MISSION_TWIST_BRIDGE_MIN_MS, MISSION_TWIST_BRIDGE_MAX_MS);
  tw.activeType = "bridge";
  tw.activeUntil = tw.bridge.until;
  tw.cooldownUntil = now + MISSION_TWIST_COOLDOWN_MS;
  tw.nextRollAt = now + rand(MISSION_TWIST_ROLL_MIN_MS, MISSION_TWIST_ROLL_MAX_MS);
  setEventText("🌉 Bridge collapse! Route blocked. Reroute now.", 5.5);
  sfx("event");
  hapticImpact("medium");
  __savePending = true;
  return true;
}
function missionTwistPickHostageTarget(){
  const civs = (S.civilians || []).filter((c)=>c.alive && !c.evac);
  if(!civs.length) return null;
  const primaryPool = civs.filter((c)=>!c.following);
  const pool = primaryPool.length ? primaryPool : civs;
  pool.sort((a, b)=>dist(S.me.x, S.me.y, b.x, b.y) - dist(S.me.x, S.me.y, a.x, a.y));
  const chosen = pool[Math.min(pool.length - 1, rand(0, Math.min(2, pool.length - 1)))];
  const site = (S.rescueSites || []).find((s)=>s.id === chosen.siteId) || null;
  return { civ:chosen, site };
}
function triggerMissionTwistHostage(now=Date.now()){
  const picked = missionTwistPickHostageTarget();
  if(!picked || !picked.civ) return false;
  const { civ, site } = picked;
  const tw = ensureMissionTwistState(S);
  tw.hostage.active = true;
  tw.hostage.siteId = site?.id || civ.siteId || 0;
  tw.hostage.civId = civ.id;
  tw.hostage.x = site?.x ?? civ.x;
  tw.hostage.y = site?.y ?? civ.y;
  tw.hostage.r = clamp(Math.round((site?.r || 44) * 0.74), 34, 80);
  tw.hostage.until = now + rand(MISSION_TWIST_HOSTAGE_MIN_MS, MISSION_TWIST_HOSTAGE_MAX_MS);
  tw.hostage.rescued = false;
  tw.hostage.penaltyApplied = false;
  tw.activeType = "hostage";
  tw.activeUntil = tw.hostage.until;
  tw.cooldownUntil = now + MISSION_TWIST_COOLDOWN_MS;
  tw.nextRollAt = now + rand(MISSION_TWIST_ROLL_MIN_MS, MISSION_TWIST_ROLL_MAX_MS);
  S.dangerCivId = civ.id;
  setEventText(`🚚 Hostage vehicle at ${site?.label || "field site"}! Escort civilian #${civ.id} before timer ends.`, 6.4);
  sfx("event");
  hapticImpact("heavy");
  __savePending = true;
  return true;
}
function triggerMissionTwistFog(now=Date.now()){
  const tw = ensureMissionTwistState(S);
  const dur = rand(MISSION_TWIST_FOG_MIN_MS, MISSION_TWIST_FOG_MAX_MS);
  S.fogUntil = Math.max(S.fogUntil || 0, now + dur);
  tw.activeType = "fog";
  tw.activeUntil = now + dur;
  tw.cooldownUntil = now + MISSION_TWIST_COOLDOWN_MS;
  tw.nextRollAt = now + rand(MISSION_TWIST_ROLL_MIN_MS, MISSION_TWIST_ROLL_MAX_MS);
  setEventText("🌫️ Night fog burst! Visibility reduced.", 5.2);
  sfx("event");
  __savePending = true;
  return true;
}
function triggerMissionTwistBlackout(now=Date.now()){
  if(isMobileViewport()) return false;
  const tw = ensureMissionTwistState(S);
  const dur = rand(MISSION_TWIST_BLACKOUT_MIN_MS, MISSION_TWIST_BLACKOUT_MAX_MS);
  tw.blackout.active = true;
  tw.blackout.until = now + dur;
  tw.activeType = "blackout";
  tw.activeUntil = tw.blackout.until;
  tw.cooldownUntil = now + MISSION_TWIST_COOLDOWN_MS;
  tw.nextRollAt = now + rand(MISSION_TWIST_ROLL_MIN_MS, MISSION_TWIST_ROLL_MAX_MS);
  S.scanPing = 0;
  setEventText("📻 Radio blackout! Scan and map devices are offline.", 5.8);
  sfx("event");
  hapticImpact("medium");
  __savePending = true;
  return true;
}
function missionTwistChooseType(tw){
  const aliveCivs = (S.civilians || []).filter((c)=>c.alive && !c.evac).length;
  const available = MISSION_TWIST_TYPES.filter((type)=>{
    if((tw.used?.[type] || 0) >= 1) return false;
    if(type === "hostage" && aliveCivs <= 0) return false;
    if(type === "blackout" && isMobileViewport()) return false;
    return true;
  });
  if(!available.length) return "";
  const weights = {
    bridge: 0.28,
    hostage: aliveCivs > 0 ? 0.30 : 0,
    fog: 0.23,
    blackout: 0.19
  };
  let total = 0;
  for(const type of available) total += Math.max(0.01, Number(weights[type] || 0.1));
  let roll = Math.random() * total;
  for(const type of available){
    roll -= Math.max(0.01, Number(weights[type] || 0.1));
    if(roll <= 0) return type;
  }
  return available[rand(0, available.length - 1)];
}
function tickMissionTwists(){
  const tw = ensureMissionTwistState(S);
  const now = Date.now();
  // Mobile stability guard: disable mission twists entirely on phone/tablet.
  // Twists (bridge/fog/hostage/blackout) are high-variance and can create
  // "broken map" visuals under load. Keep gameplay deterministic on mobile.
  if(isMobileViewport()){
    if(tw.activeType || tw.bridge.active || tw.hostage.active || tw.blackout.active){
      clearMissionTwist("", { silent:true });
    }
    tw.enabled = false;
    tw.cooldownUntil = now + 60000;
    tw.nextRollAt = tw.cooldownUntil;
    S.fogUntil = 0;
    return;
  }
  if(!missionTwistsEnabled()){
    if(tw.activeType || tw.bridge.active || tw.hostage.active || tw.blackout.active){
      clearMissionTwist("", { silent:true });
    }
    return;
  }
  if(!tw.enabled) return;
  if(tw.bridge.active && now >= (tw.bridge.until || 0)){
    clearMissionTwist("bridge", { notice:"🛣️ Collapse cleared. Route reopened.", seconds:2.8 });
  }
  if(tw.blackout.active && now >= (tw.blackout.until || 0)){
    clearMissionTwist("blackout", { notice:"📻 Radio signal restored.", seconds:2.8 });
  }
  if(tw.activeType === "fog" && now >= (tw.activeUntil || 0)){
    clearMissionTwist("fog", { silent:true });
  }
  if(tw.hostage.active){
    const civ = civilianById(tw.hostage.civId);
    const site = (S.rescueSites || []).find((s)=>s.id === tw.hostage.siteId) || null;
    if(site){
      tw.hostage.x = site.x;
      tw.hostage.y = site.y;
      tw.hostage.r = clamp(Math.round((site.r || tw.hostage.r || 44) * 0.72), 30, 96);
    } else if(civ){
      tw.hostage.x = civ.x;
      tw.hostage.y = civ.y;
    }
    if(civ && civ.evac){
      tw.hostage.rescued = true;
      const bonus = rand(260, 560);
      S.funds += bonus;
      trackCashEarned(bonus);
      clearMissionTwist("hostage", { notice:`✅ Hostage secured! +$${bonus.toLocaleString()}`, seconds:4.4 });
      sfx("win");
      hapticNotif("success");
    } else if(!civ || !civ.alive){
      clearMissionTwist("hostage", { notice:"❌ Hostage target lost.", seconds:4.0 });
    } else if(now >= (tw.hostage.until || 0)){
      if(!tw.hostage.penaltyApplied){
        const base = Math.max(18, Math.round((civ.hpMax || 100) * 0.38));
        const dmg = civilianShielded(civ) ? Math.max(4, Math.round(base * 0.35)) : base;
        civ.hp = clamp((civ.hp || 0) - dmg, 0, civ.hpMax || 100);
        tw.hostage.penaltyApplied = true;
        emitDamagePopup(civ.x, civ.y - 38, `-${Math.max(1, dmg)}`, "civilian");
      }
      clearMissionTwist("hostage", { notice:"⏱️ Hostage timer expired. Civilian took damage.", seconds:4.8 });
    }
  }
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  if(tw.triggerCount >= MISSION_TWIST_MAX_PER_MISSION) return;
  if(tw.activeType) return;
  if(now < (tw.cooldownUntil || 0) || now < (tw.nextRollAt || 0)) return;

  const type = missionTwistChooseType(tw);
  if(!type){
    tw.nextRollAt = now + rand(7000, 12000);
    return;
  }

  let ok = false;
  if(type === "bridge") ok = triggerMissionTwistBridge(now);
  else if(type === "hostage") ok = triggerMissionTwistHostage(now);
  else if(type === "fog") ok = triggerMissionTwistFog(now);
  else if(type === "blackout") ok = triggerMissionTwistBlackout(now);

  if(ok){
    tw.used[type] = Math.max(0, Math.floor(Number(tw.used[type] || 0))) + 1;
    tw.triggerCount = Math.max(0, Math.floor(Number(tw.triggerCount || 0))) + 1;
  } else {
    tw.nextRollAt = now + rand(6500, 11000);
    tw.cooldownUntil = now + Math.round(MISSION_TWIST_COOLDOWN_MS * 0.45);
  }
}
function tickEvents(){
  if(isMobileViewport()) return;
  if(!eventsEnabled() || S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  const director = ensureMissionDirectorState(S);
  const phase = DIRECTOR_PHASE_CONFIG[director.phase] ? director.phase : DIRECTOR_PHASES.CALM;
  const phaseCfg = DIRECTOR_PHASE_CONFIG[phase] || DIRECTOR_PHASE_CONFIG.CALM;
  const liveOpsMods = liveOpsActiveModifiers(S);

  if(S.eventCooldown>0) S.eventCooldown--;
  if(S.eventCooldown>0) return;

  // low chance per tick (60fps) -> we use a counter tick
  S._evtTick = (S._evtTick||0)+1;
  if(S._evtTick < 180) return; // about every 3s check
  S._evtTick = 0;

  const chance = clamp(
    Number(phaseCfg.eventChance || 0.12) * clamp(Number(liveOpsMods.eventChanceMul || 1), 0.72, 1.35),
    0.04,
    0.32
  );
  if(Math.random()>chance) return;

  let supplyWeight = 0.28;
  let rogueWeight = 0.24;
  let fogWeight = 0.26;
  let bonusWeight = 0.22;
  if(phase === DIRECTOR_PHASES.CALM){
    supplyWeight = 0.36;
    rogueWeight = 0.14;
    fogWeight = 0.20;
    bonusWeight = 0.30;
  } else if(phase === DIRECTOR_PHASES.PRESSURE){
    supplyWeight = 0.24;
    rogueWeight = 0.30;
    fogWeight = 0.24;
    bonusWeight = 0.22;
  } else if(phase === DIRECTOR_PHASES.PEAK){
    supplyWeight = 0.18;
    rogueWeight = 0.44;
    fogWeight = 0.20;
    bonusWeight = 0.18;
  } else if(phase === DIRECTOR_PHASES.RECOVER){
    supplyWeight = 0.35;
    rogueWeight = 0.16;
    fogWeight = 0.19;
    bonusWeight = 0.30;
  }

  supplyWeight *= clamp(Number(liveOpsMods.supplyWeightMul || 1), 0.65, 1.45);
  rogueWeight *= clamp(Number(liveOpsMods.rogueWeightMul || 1), 0.65, 1.45);
  fogWeight *= clamp(Number(liveOpsMods.fogWeightMul || 1), 0.65, 1.45);
  bonusWeight *= clamp(Number(liveOpsMods.bonusWeightMul || 1), 0.65, 1.45);
  let totalWeight = supplyWeight + rogueWeight + fogWeight + bonusWeight;
  if(!Number.isFinite(totalWeight) || totalWeight <= 0){
    supplyWeight = 0.28;
    rogueWeight = 0.24;
    fogWeight = 0.26;
    bonusWeight = 0.22;
    totalWeight = 1;
  }
  supplyWeight /= totalWeight;
  rogueWeight /= totalWeight;
  fogWeight /= totalWeight;
  bonusWeight /= totalWeight;

  const roll = Math.random();
  if(roll < supplyWeight){
    // Supply Drop: spawn crate pickup
    spawnPickup("CRATE", rand(280,880), rand(120,500));
    setEventText("📦 Supply Drop spotted!", 7);
    sfx("event"); hapticImpact("medium");
  } else if(roll < (supplyWeight + rogueWeight)){
    // Rogue Pack: spawn 1 tiger
    if(hasAliveBossTiger()){
      setEventText("👑 Boss presence suppressed random rogue pack event.", 4);
      sfx("ui");
    } else if(!missionDirectorAllowTigerSpawn(1)){
      setEventText("Mission Director held rogue spawn for fair pacing.", 3.4);
    } else {
      const spawned = spawnRogueTiger();
      if(spawned){
        setEventText("🚨 Rogue Pack entered the area!", 7);
        sfx("event"); hapticImpact("heavy");
      } else {
        setEventText("Mission Director skipped rogue spawn (entity cap).", 3.4);
      }
    }
  } else if(roll < (supplyWeight + rogueWeight + fogWeight)){
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
      trackCashEarned(bonus);
      unlockAchv("gov_bonus","Gov Bonus");
      setEventText(`🏛️ Government Bonus: +$${bonus.toLocaleString()}`, 7);
      sfx("win"); hapticNotif("success");
    } else {
      setEventText("🏛️ Bonus denied: civilians under attack!", 6);
      sfx("ui");
    }
  }

  S.eventCooldown = Math.max(280, Math.round(Number(phaseCfg.eventCooldownTicks || 900)));
  save();
}

function biomeHazardTick(){
  if(isMobileViewport()) return;
  if(S.paused || S.inBattle || S.missionEnded || S.gameOver) return;
  if(window.__TUTORIAL_MODE__) return;
  const profile = currentBiomeProfile();
  if(!profile) return;
  const hazards = biomeHazardModifiers(S.mode);
  const pulseEvery = Math.max(0, Math.floor(Number(hazards.fogPulseEveryMs || 0)));
  const pulseDuration = Math.max(0, Math.floor(Number(hazards.fogPulseDurationMs || 0)));
  if(pulseEvery <= 0 || pulseDuration <= 0) return;

  const now = Date.now();
  if(!Number.isFinite(S._biomeFogPulseAt) || S._biomeFogPulseAt <= 0){
    S._biomeFogPulseAt = now + rand(Math.max(2200, Math.floor(pulseEvery * 0.60)), pulseEvery);
    return;
  }
  if(now < S._biomeFogPulseAt) return;

  S.fogUntil = Math.max(S.fogUntil || 0, now + pulseDuration);
  S._biomeFogPulseAt = now + rand(Math.max(2400, Math.floor(pulseEvery * 0.72)), Math.max(2800, Math.floor(pulseEvery * 1.15)));
  if(Math.random() < 0.30){
    setEventText(`🌦️ ${profile.weather} shifted the battlefield. Stay on your route.`, 2.2);
  }
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
  const caps = missionDirectorHardCaps();
  if((S.pickups || []).length >= caps.pickups) return;
  S._pTick=(S._pTick||0)+1;
  if(S._pTick<120) return; // check ~2 seconds
  S._pTick=0;

  const director = ensureMissionDirectorState(S);
  const phase = DIRECTOR_PHASE_CONFIG[director.phase] ? director.phase : DIRECTOR_PHASES.CALM;
  let chanceMul = 1;
  if(phase === DIRECTOR_PHASES.CALM) chanceMul = 1.08;
  else if(phase === DIRECTOR_PHASES.PRESSURE) chanceMul = 0.92;
  else if(phase === DIRECTOR_PHASES.PEAK) chanceMul = 0.72;
  else if(phase === DIRECTOR_PHASES.RECOVER) chanceMul = 0.98;
  const lagTier = frameLagTier();
  if(lagTier >= 1) chanceMul *= 0.86;
  if(lagTier >= 2) chanceMul *= 0.70;

  const baseChance = clamp(0.22 * chanceMul, 0.08, 0.28);
  if(Math.random()>baseChance) return;

  const x = rand(160, 900);
  const y = rand(90, 510);

  // weighted loot
  const r = Math.random();
  if(phase === DIRECTOR_PHASES.PEAK){
    if(r<0.20) spawnPickup("CASH", x, y);
    else if(r<0.40) spawnPickup("AMMO", x, y);
    else if(r<0.62) spawnPickup("ARMOR", x, y);
    else if(r<0.84) spawnPickup("MED", x, y);
    else spawnPickup("TRAP", x, y);
  } else if(phase === DIRECTOR_PHASES.CALM){
    if(r<0.33) spawnPickup("CASH", x, y);
    else if(r<0.56) spawnPickup("AMMO", x, y);
    else if(r<0.72) spawnPickup("ARMOR", x, y);
    else if(r<0.89) spawnPickup("MED", x, y);
    else spawnPickup("TRAP", x, y);
  } else {
    if(r<0.28) spawnPickup("CASH", x, y);
    else if(r<0.52) spawnPickup("AMMO", x, y);
    else if(r<0.70) spawnPickup("ARMOR", x, y);
    else if(r<0.88) spawnPickup("MED", x, y);
    else spawnPickup("TRAP", x, y);
  }

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
    trackCashEarned(amt);
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
      if(r<0.35){ const amt=rand(200,600); S.funds+=amt; trackCashEarned(amt); msg += `+$${amt} `; }
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
  const tgInfo = tgUserInfo();
  const esc = (v)=>String(v || "").replace(/[&<>"']/g, (ch)=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    "\"":"&quot;",
    "'":"&#39;",
  }[ch]));
  const tgIdText = tgInfo.userId > 0 ? String(tgInfo.userId) : "Not detected";
  const tgUserText = tgInfo.username ? `@${tgInfo.username}` : (tgInfo.fullName || "-");
  const tgHint = tgInfo.userId > 0
    ? "Detected from your Telegram Mini App session."
    : "Open Tiger Strike from Telegram to detect your ID automatically.";
  document.getElementById("aboutOverlay").style.display="flex";
  document.getElementById("aboutBody").innerHTML = `
    <div class="item"><div><div class="itemName">Find your Telegram user ID</div>
      <div class="itemDesc">
        <b>In group/private chat:</b> send <code>/myid</code><br>
        <b>In-game detected ID:</b> ${esc(tgIdText)}<br>
        <b>Username:</b> ${esc(tgUserText)}<br>
        <b>Note:</b> ${esc(tgHint)}
      </div>
    </div></div>
    <div class="item"><div><div class="itemName">Tiger Abilities + Boss Phases</div>
      <div class="itemDesc">
        <b>Scout:</b> Dash burst.<br>
        <b>Stalker:</b> Fade/ambush (harder to see).<br>
        <b>Berserker:</b> Rage at low HP (hits harder).<br>
        <b>Alpha:</b> Roar buff nearby tigers.<br>
        <b>Bosses:</b> Multi-phase pressure (Phase 1/2/3) with stronger cadence and telegraphed phase shifts.
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
  if(on) closeSquadCommandWheel();
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
  if(S.mode==="Story"){
    const mission = storyMissionForState(S);
    if(normalizeStoryVariant(mission.storyVariant) === STORY_VARIANTS.GAUNTLET){
      return `Gauntlet Run ${mission.runIndex}`;
    }
    if(normalizeStoryVariant(mission.storyVariant) === STORY_VARIANTS.ELITE_HUNT){
      return `Elite Hunt ${mission.runIndex} (Chapter ${mission.chapter})`;
    }
    return `Story Mission ${clamp(mission.number || 1, 1, STORY_CAMPAIGN_OBJECTIVES.length)}`;
  }
  if(S.mode==="Arcade"){
    const mission = activeArcadeMission(S);
    if(mission?.weeklySeed){
      return `Arcade Weekly Seed ${String(mission.weeklySeedKey || S.arcadeWeeklySeedKey || weeklyChallengeWeekKey())}`;
    }
    return `Arcade Mission ${clamp(mission?.number || S.arcadeLevel || 1, 1, ARCADE_CAMPAIGN_OBJECTIVES.length)}`;
  }
  return `Survival Wave ${Math.max(1, S.survivalWave || 1)}`;
}
function nextMissionLabel(){
  if(S.mode==="Story"){
    const variant = normalizeStoryVariant(S.storyVariant);
    if(variant === STORY_VARIANTS.GAUNTLET){
      return `Gauntlet Run ${Math.max(1, Math.floor(Number(S.gauntletDepth || 1))) + 1}`;
    }
    if(variant === STORY_VARIANTS.ELITE_HUNT){
      return `Elite Hunt ${Math.max(1, Math.floor(Number(S.eliteHuntRuns || 1))) + 1}`;
    }
    return `Story Mission ${Math.min((S.storyLevel || 1) + 1, STORY_CAMPAIGN_OBJECTIVES.length)}`;
  }
  if(S.mode==="Arcade"){
    ensureArcadeWeeklySeedState(S);
    if(S.arcadeWeeklySeedEnabled){
      return `Arcade Weekly Seed ${S.arcadeWeeklySeedKey || weeklyChallengeWeekKey()}`;
    }
    return `Arcade Mission ${Math.min((S.arcadeLevel || 1) + 1, ARCADE_CAMPAIGN_OBJECTIVES.length)}`;
  }
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
    renderCompleteRecapCard();
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
    renderCompleteRecapCard();
    document.getElementById("completeOverlay").style.display="flex";
    return;
  }
  setPaused(false,null);
}
let __storyIntroAutoTimer = 0;
let __launchIntroAutoTimer = 0;
let __launchIntroShownThisBoot = false;
let __missionBriefTimer = 0;
let __pendingDailyReward = null;
let __dailyRewardContinue = null;
let __launchThemeAt = 0;
let __launchMusicLoopTimer = 0;

const INTRO_LAUNCH_MS = 10000;
const INTRO_STORY_MS = 10000;
const INTRO_BRIEF_MS = 10000;

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
    const mission = storyMissionForState(S);
    return {
      mode: "Story",
      total: normalizeStoryVariant(mission.storyVariant) === STORY_VARIANTS.CAMPAIGN
        ? STORY_CAMPAIGN_OBJECTIVES.length
        : null,
      mission
    };
  }
  if(S.mode==="Arcade"){
    const mission = activeArcadeMission(S);
    return {
      mode: "Arcade",
      total: ARCADE_CAMPAIGN_OBJECTIVES.length,
      mission
    };
  }
  return null;
}
function chapterRecapTextForCurrentStoryMission(){
  const mission = storyMissionForState(S);
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
  const biomeProfile = chapterBiomeProfile(mode || S.mode, Math.ceil((mission.number || 1) / 10));
  if(mode==="Story" && (mission.civilians || 0) > 0) rules.push("escort/protect civilians");
  if((mission.captureRequired || 0) > 0) rules.push(`capture objective active`);
  if(mode==="Arcade" && mission.captureOnly) rules.push("capture-only (no kills)");
  if(mode==="Arcade" && (mission.trapPlaceRequired || 0) > 0) rules.push("trap placement required");
  if(mode==="Arcade" && (mission.trapTriggerRequired || 0) > 0) rules.push("trap-stop objective active");
  if(mode==="Arcade" && mission.limitedAmmo) rules.push("limited ammo");
  if(mission.lowVisibility) rules.push("reduced visibility");
  if(mission.bloodAggro) rules.push("blood increases aggression");
  if(mission.finalBoss) rules.push("final choice changes ending");
  if(biomeProfile?.hazardShort) rules.push(`${biomeProfile.weather}: ${biomeProfile.hazardShort.toLowerCase()}`);
  if(!rules.length) return "Special Rule: standard mission rules.";
  return `Special Rule: ${rules[0]}.`;
}
function bossCycleLabel(skill){
  if(skill==="stalk") return "Predator Stalk";
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
  const biome = chapterBiomeProfile("Story", mission.chapter || 1);
  const focus = [];
  if((mission.civilians || 0) > 0) focus.push(`protect ${mission.civilians} civilian${mission.civilians===1?"":"s"}`);
  if((mission.captureRequired || 0) > 0) focus.push(`secure ${mission.captureRequired} capture${mission.captureRequired===1?"":"s"}`);
  if(mission.lowVisibility) focus.push("low visibility route");
  if(mission.bloodAggro) focus.push("lethal kills increase aggression");
  if(biome?.hazardShort) focus.push(`${biome.weather.toLowerCase()} • ${biome.hazardShort.toLowerCase()}`);
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
function renderArcadeBuildcraftBrief(){
  const wrap = document.getElementById("arcadeBuildcraftWrap");
  const list = document.getElementById("arcadeBuildcraftBtns");
  const tradeoff = document.getElementById("arcadeBuildcraftTradeoff");
  const shouldShow = normalizeModeName(S.mode) === "Arcade" && !window.__TUTORIAL_MODE__;
  if(wrap) wrap.style.display = shouldShow ? "block" : "none";
  if(!shouldShow){
    if(list) list.innerHTML = "";
    if(tradeoff) tradeoff.innerText = "";
    return;
  }
  ensureArcadeBuildcraftState(S);
  const selected = normalizeArcadeBuildcraftId(S.arcadeBuildcraftPending || S.arcadeBuildcraftSelected);
  if(list){
    list.innerHTML = "";
    for(const def of ARCADE_BUILDCRAFT_LOADOUTS){
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = def.id === selected ? "good" : "ghost";
      btn.innerText = `${def.icon} ${def.name}`;
      btn.onclick = ()=>selectArcadeBuildcraft(def.id);
      list.appendChild(btn);
    }
  }
  if(tradeoff){
    const def = arcadeBuildcraftDef(selected);
    tradeoff.innerText = `${def.summary} • ${def.pros} • Tradeoff: ${def.cons}`;
  }
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
  const hintEl = document.getElementById("missionBriefHint");
  const startBtn = document.getElementById("missionBriefStartBtn");
  const isStory = card.mode === "Story";
  const isArcade = card.mode === "Arcade";
  const storyVariant = isStory ? normalizeStoryVariant(card.mission?.storyVariant) : STORY_VARIANTS.CAMPAIGN;
  if(titleEl){
    if(isStory) titleEl.innerText = "📖 Story Operations Brief";
    else if(isArcade) titleEl.innerText = "🎛️ Arcade Buildcraft Brief";
    else titleEl.innerText = "📋 Mission Brief";
  }
  if(nameEl){
    if(isStory && storyVariant === STORY_VARIANTS.GAUNTLET){
      nameEl.innerText = `Gauntlet Run ${card.mission.runIndex} — ${card.mission.chapterName}`;
    } else if(isStory && storyVariant === STORY_VARIANTS.ELITE_HUNT){
      nameEl.innerText = `Elite Hunt ${card.mission.runIndex} — Chapter ${card.mission.chapter}`;
    } else {
      const totalTxt = Number.isFinite(Number(card.total)) && Number(card.total) > 0 ? `/${card.total}` : "";
      nameEl.innerText = `${card.mode} Mission ${card.mission.number}${totalTxt} — ${card.mission.chapterName}`;
    }
  }
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
  if(hintEl){
    hintEl.innerText = isArcade
      ? "Pick one Buildcraft loadout for this Arcade mission, then tap Start Mission."
      : "Auto-hide timing depends on mission flow. Tap Start anytime.";
  }
  if(startBtn){
    startBtn.innerText = isArcade ? "Start Mission" : "Start";
  }
  renderArcadeBuildcraftBrief();

  clearMissionBriefTimer();
  setPaused(true,"mission-brief");
  overlay.style.display = "flex";
  syncGamepadFocus();
  if(isArcade){
    // Arcade buildcraft requires an explicit pre-mission choice.
    return true;
  }
  const requestedMs = Math.floor(durationMs || 0);
  let ms = requestedMs || 2600;
  if(requestedMs >= 9000){
    ms = clamp(requestedMs, 9000, 14000);
  } else if(isStory){
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
  if(normalizeModeName(S.mode) === "Arcade" && !window.__TUTORIAL_MODE__){
    applyArcadeBuildcraftForMission({ silent: !!fromTimer });
  }
  if(S.paused && S.pauseReason === "mission-brief"){
    setPaused(false,null);
  }
  if(!fromTimer) sfx("ui");
  syncGamepadFocus();
}
function playLaunchTheme(force=false){
  if(!S.soundOn) return;
  const now = Date.now();
  if(!force && (now - __launchThemeAt) < 2600) return;
  __launchThemeAt = now;
  try{
    ensureAudio();
    const notes = [392, 523, 659, 784];
    notes.forEach((hz, idx)=>{
      setTimeout(()=>beep(hz, 120, "triangle", 0.045), idx * 150);
    });
  }catch(e){}
}
function introOverlayVisible(){
  const launch = document.getElementById("launchIntroOverlay");
  const story = document.getElementById("storyIntroOverlay");
  return !!((launch && launch.style.display === "flex") || (story && story.style.display === "flex"));
}
function clearLaunchMusicLoop(){
  if(__launchMusicLoopTimer){
    clearInterval(__launchMusicLoopTimer);
    __launchMusicLoopTimer = 0;
  }
}
function playHuntPulse(){
  if(!S.soundOn) return;
  try{
    ensureAudio();
    beep(146, 130, "sawtooth", 0.035);
    setTimeout(()=>beep(196, 90, "triangle", 0.03), 160);
    setTimeout(()=>beep(246, 80, "triangle", 0.028), 320);
    setTimeout(()=>beep(164, 120, "square", 0.03), 780);
    setTimeout(()=>beep(220, 70, "triangle", 0.028), 960);
  }catch(e){}
}
function startLaunchMusicLoop(force=false){
  if(!S.soundOn) return;
  if(__launchMusicLoopTimer && !force) return;
  clearLaunchMusicLoop();
  playHuntPulse();
  __launchMusicLoopTimer = setInterval(playHuntPulse, 1800);
}
function nextDailyCountdownText(){
  const now = new Date();
  const nextUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0);
  const remainingMs = Math.max(0, nextUtc - now.getTime());
  const totalMin = Math.floor(remainingMs / 60000);
  const hh = String(Math.floor(totalMin / 60)).padStart(2, "0");
  const mm = String(totalMin % 60).padStart(2, "0");
  return `${hh}h ${mm}m`;
}
function storySaveStorageKey(){
  return `${STORY_SAVE_KEY_BASE}_${tgUserKey()}`;
}
function storySaveStorageKeys(){
  const keys = [];
  const seen = new Set();
  const pushKey = (k)=>{
    const key = String(k || "").trim();
    if(!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  pushKey(storySaveStorageKey());
  if(tgUserKey() !== "local") pushKey(`${STORY_SAVE_KEY_BASE}_local`);
  pushKey(STORY_SAVE_KEY_BASE); // legacy migration
  return keys;
}
function storySaveReadStorageKeys(){
  return storySaveStorageKeys().slice();
}
function storyCheckpointStorageKey(){
  return `${STORY_CHECKPOINT_KEY_BASE}_${tgUserKey()}`;
}
function storyCheckpointStorageKeys(){
  const keys = [];
  const seen = new Set();
  const pushKey = (k)=>{
    const key = String(k || "").trim();
    if(!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  pushKey(storyCheckpointStorageKey());
  if(tgUserKey() !== "local") pushKey(`${STORY_CHECKPOINT_KEY_BASE}_local`);
  pushKey(STORY_CHECKPOINT_KEY_BASE); // legacy migration
  return keys;
}
function storyCheckpointReadStorageKeys(){
  return storyCheckpointStorageKeys().slice();
}
function storyCheckpointMissionFromPayload(payload){
  if(!payload || typeof payload !== "object") return 1;
  const resume = (payload.resumeState && typeof payload.resumeState === "object") ? payload.resumeState : null;
  const raw =
    payload.mission ??
    payload.storyLevel ??
    payload.storyLastMission ??
    (resume ? (resume.storyLevel ?? resume.storyLastMission) : 1);
  return clamp(Math.floor(Number(raw || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
}
function readStoryCheckpointData(){
  if(__storyCheckpointCache && typeof __storyCheckpointCache === "object"){
    return __storyCheckpointCache;
  }
  try{
    let best = null;
    for(const key of storyCheckpointReadStorageKeys()){
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      let parsed = null;
      try{
        parsed = JSON.parse(raw);
      }catch(e){
        parsed = null;
      }
      if(!parsed || typeof parsed !== "object") continue;
      const mission = storyCheckpointMissionFromPayload(parsed);
      const savedAt = Number.isFinite(Number(parsed.savedAt)) ? Number(parsed.savedAt) : 0;
      const candidate = { ...parsed, mission, savedAt, storageKey:key };
      if(!best || candidate.savedAt >= best.savedAt){
        best = candidate;
      }
    }
    __storyCheckpointCache = best;
    return best;
  }catch(e){
    return null;
  }
}
function clearStoryCheckpointData(){
  __storyCheckpointCache = null;
  try{
    for(const key of storyCheckpointStorageKeys()){
      localStorage.removeItem(key);
    }
  }catch(e){}
}
function clearStoryCheckpointForMission(mission){
  const slot = readStoryCheckpointData();
  if(!slot) return;
  const targetMission = clamp(Math.floor(Number(mission || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  if(storyCheckpointMissionFromPayload(slot) === targetMission){
    clearStoryCheckpointData();
  }
}
function activeStoryCheckpointForMission(mission){
  const slot = readStoryCheckpointData();
  if(!slot) return null;
  const targetMission = clamp(Math.floor(Number(mission || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  if(storyCheckpointMissionFromPayload(slot) !== targetMission) return null;
  if(!slot.resumeState || typeof slot.resumeState !== "object") return null;
  return slot;
}
function buildStoryCheckpointSnapshot(trigger={}){
  const mission = clamp(Math.floor(Number(S.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  const resumeState = buildPersistedState();
  resumeState.mode = "Story";
  resumeState.storyLevel = mission;
  resumeState.storyLastMission = Math.max(
    mission,
    clamp(Math.floor(Number(resumeState.storyLastMission || mission)), 1, STORY_CAMPAIGN_OBJECTIVES.length)
  );
  resumeState.missionEnded = false;
  resumeState.gameOver = false;
  resumeState.paused = false;
  resumeState.pauseReason = null;
  resumeState.inBattle = false;
  resumeState.activeTigerId = null;
  const storyFunds = Math.max(0, Math.round(Number(getModeWallet("Story", resumeState) || resumeState.funds || 0)));
  resumeState.modeWallets = normalizeModeWallets(resumeState.modeWallets, storyFunds, "Story");
  if(resumeState.modeWallets && typeof resumeState.modeWallets === "object"){
    resumeState.modeWallets.Story = storyFunds;
  }
  resumeState.funds = storyFunds;
  resumeState.v = STORAGE_VERSION;
  trimPersistentState(resumeState);
  return {
    mission,
    storyLevel: mission,
    storyLastMission: Math.max(mission, Math.floor(Number(resumeState.storyLastMission || mission))),
    trigger: {
      evacDone: Math.max(0, Math.floor(Number(trigger.evacDone || 0))),
      evacRequired: Math.max(1, Math.floor(Number(trigger.evacRequired || 1))),
      civTotal: Math.max(1, Math.floor(Number(trigger.civTotal || 1))),
      tigerDown: Math.max(0, Math.floor(Number(trigger.tigerDown || 0))),
    },
    source: "mission-checkpoint",
    savedAt: Date.now(),
    resumeState,
  };
}
function writeStoryCheckpointData(trigger={}){
  if(window.__TUTORIAL_MODE__) return null;
  const payload = buildStoryCheckpointSnapshot(trigger);
  try{
    const raw = JSON.stringify(payload);
    localStorage.setItem(storyCheckpointStorageKey(), raw);
    __storyCheckpointCache = payload;
    return payload;
  }catch(e){
    return null;
  }
}
function updateGameOverCheckpointButton(){
  const btn = document.getElementById("overCheckpointBtn");
  if(!btn) return;
  const slot =
    normalizeModeName(S.mode) === "Story"
      ? activeStoryCheckpointForMission(S.storyLevel)
      : null;
  if(!slot){
    btn.style.display = "none";
    btn.disabled = true;
    btn.innerText = "Restart from Checkpoint";
    return;
  }
  const trig = slot.trigger || {};
  const evacDone = Math.max(0, Math.floor(Number(trig.evacDone || 0)));
  const evacReq = Math.max(1, Math.floor(Number(trig.evacRequired || 1)));
  btn.style.display = "";
  btn.disabled = false;
  btn.innerText = `Restart from Checkpoint (${evacDone}/${evacReq} evac)`;
}
function maybeCaptureStoryCheckpoint(){
  if(window.__TUTORIAL_MODE__) return;
  if(normalizeModeName(S.mode) !== "Story") return;
  if(S.gameOver || S.missionEnded) return;
  const mission = clamp(Math.floor(Number(S.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  if(activeStoryCheckpointForMission(mission)) return;

  const civTotal = Array.isArray(S.civilians) ? S.civilians.length : 0;
  if(civTotal <= 0) return;
  const evacRequired = Math.max(1, Math.ceil(civTotal * 0.5));
  const evacDone = Math.max(0, Math.floor(Number(S.evacDone || 0)));
  const tigerDown =
    Math.max(0, Math.floor(Number(S.stats?.kills || 0))) +
    Math.max(0, Math.floor(Number(S.stats?.captures || 0)));

  if(evacDone < evacRequired || tigerDown < 1) return;
  const slot = writeStoryCheckpointData({ evacDone, evacRequired, civTotal, tigerDown });
  if(slot){
    toast(`Checkpoint reached: ${evacDone}/${civTotal} civilians evac + tiger down.`);
    hapticNotif("success");
    updateGameOverCheckpointButton();
  }
}
function restartFromStoryCheckpoint(){
  if(normalizeModeName(S.mode) !== "Story"){
    toast("Story checkpoints are only available in Story mode.");
    return;
  }
  const slot = activeStoryCheckpointForMission(S.storyLevel);
  if(!slot){
    toast("No checkpoint available for this mission yet.");
    updateGameOverCheckpointButton();
    return;
  }
  const resume = (slot.resumeState && typeof slot.resumeState === "object")
    ? cloneState(slot.resumeState)
    : null;
  if(!resume){
    clearStoryCheckpointForMission(S.storyLevel);
    toast("Checkpoint data was invalid and has been cleared.");
    updateGameOverCheckpointButton();
    return;
  }

  const mission = clamp(
    Math.floor(Number(storyCheckpointMissionFromPayload(slot) || S.storyLevel || 1)),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
  resume.mode = "Story";
  resume.storyLevel = mission;
  resume.storyLastMission = Math.max(
    mission,
    clamp(Math.floor(Number(resume.storyLastMission || mission)), 1, STORY_CAMPAIGN_OBJECTIVES.length)
  );
  resume.missionEnded = false;
  resume.gameOver = false;
  resume.paused = false;
  resume.pauseReason = null;
  resume.inBattle = false;
  resume.activeTigerId = null;
  const storyFunds = Math.max(0, Math.round(Number(getModeWallet("Story", resume) || resume.funds || 0)));
  resume.modeWallets = normalizeModeWallets(resume.modeWallets, storyFunds, "Story");
  if(resume.modeWallets && typeof resume.modeWallets === "object"){
    resume.modeWallets.Story = storyFunds;
  }
  resume.funds = storyFunds;
  resume.v = STORAGE_VERSION;
  trimPersistentState(resume);

  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
  }catch(e){}

  ["battleOverlay","completeOverlay","overOverlay","weaponQuickOverlay","progressGuardOverlay"].forEach((id)=>{
    const el = document.getElementById(id);
    if(el) el.style.display = "none";
  });
  lastOverlay = null;

  S = load();
  bindFundsWallet(S);
  syncWindowState();
  resizeCanvasForViewport();
  applyTouchHudSettings();
  applyModeTheme(S.mode);
  invalidateMapCache();
  transitionCleanupSweep("story-checkpoint-restore");
  clearTransientCombatVisuals();
  if(missionStateLooksEmpty()){
    const keepHp = clamp(Number(S.hp || 100), 0, 100);
    const keepArmor = clamp(Number(S.armor || 0), 0, S.armorCap || 100);
    deploy({ carryStats:true, hp:keepHp, armor:keepArmor });
  }
  updateEngage();
  maybeRenderHUD(true);
  try{ renderCombatControls(); }catch(e){}
  try{ renderBattleStatus(); }catch(e){}
  updateGameOverCheckpointButton();
  toast(`Restarted from checkpoint (Story Mission ${mission}).`);
  save(true);
}
function storyProgressStorageKey(){
  return `${STORY_PROGRESS_KEY_BASE}_${tgUserKey()}`;
}
function storyProgressStorageKeys(){
  const keys = [];
  const seen = new Set();
  const pushKey = (k)=>{
    const key = String(k || "").trim();
    if(!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  pushKey(storyProgressStorageKey());
  if(tgUserKey() !== "local") pushKey(`${STORY_PROGRESS_KEY_BASE}_local`);
  pushKey(STORY_PROGRESS_KEY_BASE); // legacy migration
  return keys;
}
function storyProgressReadStorageKeys(){
  return storyProgressStorageKeys().slice();
}
function storyProfileStorageKey(){
  return `${STORY_PROFILE_KEY_BASE}_${tgUserKey()}`;
}
function storyProfileStorageKeys(){
  const keys = [];
  const seen = new Set();
  const pushKey = (k)=>{
    const key = String(k || "").trim();
    if(!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };
  pushKey(storyProfileStorageKey());
  if(tgUserKey() !== "local") pushKey(`${STORY_PROFILE_KEY_BASE}_local`);
  pushKey(STORY_PROFILE_KEY_BASE); // legacy migration
  return keys;
}
function storyProfileReadStorageKeys(){
  return storyProfileStorageKeys().slice();
}
function readStoryProfileData(){
  try{
    let best = null;
    for(const key of storyProfileReadStorageKeys()){
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      let parsed = null;
      try{
        parsed = JSON.parse(raw);
      }catch(e){
        parsed = null;
      }
      if(!parsed || typeof parsed !== "object") continue;
      const savedAt = Number.isFinite(Number(parsed.savedAt)) ? Number(parsed.savedAt) : 0;
      const candidate = { ...parsed, savedAt, storageKey:key };
      if(!best || candidate.savedAt >= best.savedAt){
        best = candidate;
      }
    }
    return best;
  }catch(e){
    return null;
  }
}
function writeStoryProfileData(source="autosave", state=S){
  if(window.__TUTORIAL_MODE__) return false;
  const src = (state && typeof state === "object") ? state : S;
  if(!src || typeof src !== "object") return false;
  ensureStoryEndgameState(src);
  const seasonPass = ensureSeasonPassState(src);
  const masteryRewards = ensureMasteryRewardsState(src);
  const nemesis = ensureNemesisState(src);
  const payload = {
    storyLevel: clamp(Math.floor(Number(src.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length),
    storyLastMission: clamp(Math.floor(Number(src.storyLastMission || src.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length),
    storyVariant: normalizeStoryVariant(src.storyVariant),
    storyNgPlusTier: Math.max(0, Math.floor(Number(src.storyNgPlusTier || 0))),
    storyEndgameUnlocked: !!src.storyEndgameUnlocked,
    gauntletDepth: Math.max(1, Math.floor(Number(src.gauntletDepth || 1))),
    eliteHuntChapter: clamp(Math.floor(Number(src.eliteHuntChapter || 1)), 1, 10),
    eliteHuntRuns: Math.max(1, Math.floor(Number(src.eliteHuntRuns || 1))),
    eliteHuntsCleared: Math.max(0, Math.floor(Number(src.eliteHuntsCleared || 0))),
    funds: Math.max(0, Math.round(Number(src.funds || 0))),
    modeWallets: normalizeModeWallets(src.modeWallets, src.funds, src.mode),
    hp: clamp(Math.round(Number(src.hp || 100)), 0, 100),
    armor: clamp(Math.round(Number(src.armor || 0)), 0, src.armorCap || 100),
    lives: clamp(Math.round(Number(src.lives || 5)), 0, 99),
    score: Math.max(0, Math.round(Number(src.score || 0))),
    trust: clamp(Math.round(Number(src.trust || 80)), 0, 100),
    aggro: clamp(Math.round(Number(src.aggro || 10)), 0, 100),
    stamina: clamp(Math.round(Number(src.stamina || 100)), 0, 100),
    title: String(src.title || "Rookie"),
    xp: Math.max(0, Math.floor(Number(src.xp || 0))),
    level: Math.max(1, Math.floor(Number(src.level || 1))),
    perkPoints: Math.max(0, Math.floor(Number(src.perkPoints || 0))),
    perks: { ...(src.perks || {}) },
    progressionUnlocks: { ...(src.progressionUnlocks || {}) },
    metaBase: { ...(src.metaBase || {}) },
    specialistPerks: { ...(src.specialistPerks || {}) },
    specialistStarUnlocks: { ...(src.specialistStarUnlocks || {}) },
    chapterRewardsUnlocked: { ...(src.chapterRewardsUnlocked || {}) },
    achievements: { ...(src.achievements || {}) },
    stats: { ...(src.stats || {}) },
    opsTotals: { ...ensureOpsTotalsState(src) },
    balanceStats: cloneState(ensureBalanceStatsState(src)),
    nemesis: cloneState(nemesis),
    contractTallies: { ...ensureContractTalliesState(src) },
    contracts: (src.contracts && typeof src.contracts === "object") ? cloneState(src.contracts) : null,
    liveOps: (src.liveOps && typeof src.liveOps === "object") ? cloneState(src.liveOps) : null,
    ownedWeapons: Array.isArray(src.ownedWeapons) ? src.ownedWeapons.filter((id)=>typeof id === "string") : [],
    equippedWeaponId: String(src.equippedWeaponId || ""),
    ammoReserve: { ...(src.ammoReserve || {}) },
    durability: { ...(src.durability || {}) },
    weaponMastery: normalizeWeaponMasteryMap(src.weaponMastery),
    medkits: { ...(src.medkits || {}) },
    repairKits: { ...(src.repairKits || {}) },
    trapsOwned: Math.max(0, Math.floor(Number(src.trapsOwned || 0))),
    shields: Math.max(0, Math.floor(Number(src.shields || 0))),
    armorCap: clamp(Math.round(Number(src.armorCap || 100)), 100, 200),
    armorPlates: normalizeArmorPlateInventory(src.armorPlates),
    armorPlatesFallback: normalizeArmorPlateInventory(src.armorPlatesFallback ?? src.armorPlates),
    armorPlateSelectedId: String(src.armorPlateSelectedId || ""),
    medkitSelectedId: String(src.medkitSelectedId || ""),
    repairSelectedId: String(src.repairSelectedId || ""),
    mag: {
      loaded: Math.max(0, Math.floor(Number(src.mag?.loaded || 0))),
      cap: Math.max(0, Math.floor(Number(src.mag?.cap || 0))),
    },
    soldierAttackersOwned: Math.max(0, Math.floor(Number(src.soldierAttackersOwned || 0))),
    soldierRescuersOwned: Math.max(0, Math.floor(Number(src.soldierRescuersOwned || 0))),
    soldierAttackersDowned: Math.max(0, Math.floor(Number(src.soldierAttackersDowned || 0))),
    soldierRescuersDowned: Math.max(0, Math.floor(Number(src.soldierRescuersDowned || 0))),
    clanTag: normalizeClanTag(src.clanTag || defaultClanTagFromTelegram(src)) || "SOLO",
    clanName: sanitizeClanName(src.clanName, src.clanTag || defaultClanTagFromTelegram(src)),
    clanRaidEnabled: !!src.clanRaidEnabled,
    clanContractClaims: (src.clanContractClaims && typeof src.clanContractClaims === "object")
      ? cloneState(src.clanContractClaims)
      : {},
    seasonPass: cloneState(seasonPass),
    masteryRewards: cloneState(masteryRewards),
    savedAt: Date.now(),
    source: String(source || "autosave"),
  };
  try{
    const raw = JSON.stringify(payload);
    localStorage.setItem(storyProfileStorageKey(), raw);
    for(const key of storyProfileReadStorageKeys()){
      if(key !== storyProfileStorageKey()) localStorage.removeItem(key);
    }
    return true;
  }catch(e){
    return false;
  }
}
function mergeCountMapsFromProfile(currentMap, profileMap){
  const out = { ...(currentMap || {}) };
  if(!profileMap || typeof profileMap !== "object") return out;
  for(const [key, value] of Object.entries(profileMap)){
    const next = Math.max(0, Math.floor(Number(value || 0)));
    if(!Number.isFinite(next)) continue;
    out[key] = next;
  }
  return out;
}

function applyStoryProfileToState(state, profile){
  if(!state || typeof state !== "object") return state;
  if(!profile || typeof profile !== "object") return state;
  ensureStoryEndgameState(state);
  applyStoryEndgameSnapshot(state, profile);

  if(Number.isFinite(Number(profile.storyLevel))){
    state.storyLevel = clamp(Math.max(Number(state.storyLevel || 1), Number(profile.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  }
  if(Number.isFinite(Number(profile.storyLastMission))){
    state.storyLastMission = clamp(Math.max(Number(state.storyLastMission || 1), Number(profile.storyLastMission || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  }

  if(Array.isArray(profile.ownedWeapons) && profile.ownedWeapons.length){
    const merged = [...new Set([
      ...(Array.isArray(state.ownedWeapons) ? state.ownedWeapons : []),
      ...profile.ownedWeapons.filter((id)=>typeof id === "string" && id.trim()),
    ])];
    if(merged.length) state.ownedWeapons = merged;
  }
  if(profile.ammoReserve && typeof profile.ammoReserve === "object"){
    state.ammoReserve = mergeCountMapsFromProfile(state.ammoReserve, profile.ammoReserve);
  }
  if(profile.durability && typeof profile.durability === "object"){
    state.durability = { ...(state.durability || {}), ...profile.durability };
  }
  if(profile.weaponMastery && typeof profile.weaponMastery === "object"){
    ensureWeaponMasteryState(state);
    const incoming = normalizeWeaponMasteryMap(profile.weaponMastery);
    for(const [wid, xpRaw] of Object.entries(incoming)){
      const currentXp = Math.max(0, Math.floor(Number(state.weaponMastery?.[wid] || 0)));
      const nextXp = Math.max(0, Math.floor(Number(xpRaw || 0)));
      state.weaponMastery[wid] = Math.max(currentXp, nextXp);
    }
  }
  if(profile.medkits && typeof profile.medkits === "object"){
    state.medkits = mergeCountMapsFromProfile(state.medkits, profile.medkits);
  }
  if(profile.repairKits && typeof profile.repairKits === "object"){
    state.repairKits = mergeCountMapsFromProfile(state.repairKits, profile.repairKits);
  }

  if(Number.isFinite(Number(profile.trapsOwned))) state.trapsOwned = Math.max(0, Math.floor(Number(profile.trapsOwned)));
  if(Number.isFinite(Number(profile.shields))) state.shields = Math.max(0, Math.floor(Number(profile.shields)));
  if(Number.isFinite(Number(profile.armorCap))) state.armorCap = clamp(Math.round(Number(profile.armorCap)), 100, 200);
  if(Number.isFinite(Number(profile.funds))) state.funds = Math.max(0, Math.round(Number(profile.funds)));
  if(Number.isFinite(Number(profile.hp))) state.hp = clamp(Math.round(Number(profile.hp)), 0, 100);
  if(Number.isFinite(Number(profile.armor))) state.armor = clamp(Math.round(Number(profile.armor)), 0, state.armorCap || 100);
  if(Number.isFinite(Number(profile.lives))) state.lives = clamp(Math.round(Number(profile.lives)), 0, 99);
  if(Number.isFinite(Number(profile.score))) state.score = Math.max(0, Math.round(Number(profile.score || 0)));
  if(Number.isFinite(Number(profile.trust))) state.trust = clamp(Math.round(Number(profile.trust)), 0, 100);
  if(Number.isFinite(Number(profile.aggro))) state.aggro = clamp(Math.round(Number(profile.aggro)), 0, 100);
  if(Number.isFinite(Number(profile.stamina))) state.stamina = clamp(Math.round(Number(profile.stamina)), 0, 100);
  if(typeof profile.title === "string" && profile.title.trim()) state.title = profile.title;

  if(Number.isFinite(Number(profile.level))){
    state.level = Math.max(1, Math.floor(Number(profile.level || 1)));
  }
  if(Number.isFinite(Number(profile.xp))){
    state.xp = Math.max(0, Math.floor(Number(profile.xp || 0)));
  }
  if(Number.isFinite(Number(profile.perkPoints))){
    state.perkPoints = Math.max(0, Math.floor(Number(profile.perkPoints || 0)));
  }

  if(profile.perks && typeof profile.perks === "object"){
    state.perks = { ...(state.perks || {}), ...profile.perks };
  }
  if(profile.progressionUnlocks && typeof profile.progressionUnlocks === "object"){
    state.progressionUnlocks = { ...(state.progressionUnlocks || {}), ...profile.progressionUnlocks };
  }
  if(profile.metaBase && typeof profile.metaBase === "object"){
    state.metaBase = { ...(state.metaBase || {}), ...profile.metaBase };
  }
  if(profile.specialistPerks && typeof profile.specialistPerks === "object"){
    state.specialistPerks = { ...(state.specialistPerks || {}), ...profile.specialistPerks };
  }
  if(profile.specialistStarUnlocks && typeof profile.specialistStarUnlocks === "object"){
    state.specialistStarUnlocks = { ...(state.specialistStarUnlocks || {}), ...profile.specialistStarUnlocks };
  }
  if(profile.chapterRewardsUnlocked && typeof profile.chapterRewardsUnlocked === "object"){
    state.chapterRewardsUnlocked = { ...(state.chapterRewardsUnlocked || {}), ...profile.chapterRewardsUnlocked };
  }
  if(profile.achievements && typeof profile.achievements === "object"){
    state.achievements = { ...(state.achievements || {}), ...profile.achievements };
  }
  if(profile.stats && typeof profile.stats === "object"){
    state.stats = { ...(state.stats || {}), ...profile.stats };
  }
  if(profile.opsTotals && typeof profile.opsTotals === "object"){
    const totals = ensureOpsTotalsState(state);
    const incoming = ensureOpsTotalsState({ opsTotals: profile.opsTotals });
    for(const [metric, fallback] of Object.entries(DEFAULT.opsTotals || {})){
      const current = Math.max(0, Math.floor(Number(totals?.[metric] || fallback || 0)));
      const next = Math.max(0, Math.floor(Number(incoming?.[metric] || fallback || 0)));
      totals[metric] = Math.max(current, next);
    }
  }
  if(profile.balanceStats && typeof profile.balanceStats === "object"){
    const stats = ensureBalanceStatsState(state);
    const incoming = ensureBalanceStatsState({ balanceStats: profile.balanceStats });
    stats.deathsTotal = Math.max(stats.deathsTotal, incoming.deathsTotal);
    stats.missionFailsTotal = Math.max(stats.missionFailsTotal, incoming.missionFailsTotal);
    stats.freezeRecoverTotal = Math.max(stats.freezeRecoverTotal, incoming.freezeRecoverTotal);
    stats.freezeSpikeTotal = Math.max(stats.freezeSpikeTotal, incoming.freezeSpikeTotal);
    stats.missionsStartedTotal = Math.max(stats.missionsStartedTotal, incoming.missionsStartedTotal);
    stats.missionsWonTotal = Math.max(stats.missionsWonTotal, incoming.missionsWonTotal);
    stats.missionsFailedTotal = Math.max(stats.missionsFailedTotal, incoming.missionsFailedTotal);
    stats.recentMissionResults = normalizeMissionResultHistory(
      [...(stats.recentMissionResults || []), ...(incoming.recentMissionResults || [])],
      BALANCE_RECENT_MISSION_MAX
    );
    stats.recentDeathAt = normalizeRecentTimestampList(
      [...(stats.recentDeathAt || []), ...(incoming.recentDeathAt || [])],
      BALANCE_EVENT_HISTORY_MAX
    );
    stats.recentFreezeRecoverAt = normalizeRecentTimestampList(
      [...(stats.recentFreezeRecoverAt || []), ...(incoming.recentFreezeRecoverAt || [])],
      BALANCE_EVENT_HISTORY_MAX
    );
    stats.recentFreezeSpikeAt = normalizeRecentTimestampList(
      [...(stats.recentFreezeSpikeAt || []), ...(incoming.recentFreezeSpikeAt || [])],
      BALANCE_EVENT_HISTORY_MAX
    );
    stats.autoTune = clampAutoTuneValue(Math.max(stats.autoTune || 1, incoming.autoTune || 1));
    stats.lastMissionResultAt = Math.max(stats.lastMissionResultAt || 0, incoming.lastMissionResultAt || 0);
    stats.lastUpdatedAt = Math.max(stats.lastUpdatedAt || 0, incoming.lastUpdatedAt || 0);
    recomputeBalanceAutoTune(state);
  }
  if(profile.nemesis && typeof profile.nemesis === "object"){
    state.nemesis = mergeNemesisState(state.nemesis, profile.nemesis, currentStoryMissionNumber(state));
    ensureNemesisState(state);
  }
  if(profile.contractTallies && typeof profile.contractTallies === "object"){
    ensureContractTalliesState(state);
    for(const [metric, fallback] of Object.entries(DEFAULT_CONTRACT_TALLIES)){
      const current = Math.max(0, Math.floor(Number(state.contractTallies?.[metric] || fallback || 0)));
      const incoming = Math.max(0, Math.floor(Number(profile.contractTallies?.[metric] || fallback || 0)));
      state.contractTallies[metric] = Math.max(current, incoming);
    }
  }
  if(profile.contracts && typeof profile.contracts === "object"){
    state.contracts = cloneState(profile.contracts);
    ensureContractsState(state);
  }
  if(profile.liveOps && typeof profile.liveOps === "object"){
    state.liveOps = cloneState(profile.liveOps);
    ensureLiveOpsState(state);
  }

  state.armorPlates = normalizeArmorPlateInventory(mergeCountMapsFromProfile(state.armorPlates, profile.armorPlates));
  state.armorPlatesFallback = normalizeArmorPlateInventory(
    mergeCountMapsFromProfile(
      state.armorPlatesFallback,
      profile.armorPlatesFallback ?? profile.armorPlates
    )
  );
  if(typeof profile.armorPlateSelectedId === "string") state.armorPlateSelectedId = profile.armorPlateSelectedId;
  if(typeof profile.medkitSelectedId === "string") state.medkitSelectedId = profile.medkitSelectedId;
  if(typeof profile.repairSelectedId === "string") state.repairSelectedId = profile.repairSelectedId;

  if(Number.isFinite(Number(profile.soldierAttackersOwned))) state.soldierAttackersOwned = Math.max(0, Math.floor(Number(profile.soldierAttackersOwned)));
  if(Number.isFinite(Number(profile.soldierRescuersOwned))) state.soldierRescuersOwned = Math.max(0, Math.floor(Number(profile.soldierRescuersOwned)));
  if(Number.isFinite(Number(profile.soldierAttackersDowned))) state.soldierAttackersDowned = Math.max(0, Math.floor(Number(profile.soldierAttackersDowned)));
  if(Number.isFinite(Number(profile.soldierRescuersDowned))) state.soldierRescuersDowned = Math.max(0, Math.floor(Number(profile.soldierRescuersDowned)));
  if(typeof profile.clanTag === "string") state.clanTag = normalizeClanTag(profile.clanTag || state.clanTag || "SOLO") || "SOLO";
  if(typeof profile.clanName === "string") state.clanName = sanitizeClanName(profile.clanName, state.clanTag);
  if(typeof profile.clanRaidEnabled === "boolean") state.clanRaidEnabled = !!profile.clanRaidEnabled;
  if(profile.clanContractClaims && typeof profile.clanContractClaims === "object"){
    state.clanContractClaims = cloneState(profile.clanContractClaims);
  }
  ensureClanState(state);
  if(profile.seasonPass && typeof profile.seasonPass === "object"){
    state.seasonPass = mergeSeasonPassSnapshots(state.seasonPass, profile.seasonPass);
  }
  ensureSeasonPassState(state);
  if(profile.masteryRewards && typeof profile.masteryRewards === "object"){
    state.masteryRewards = mergeMasteryRewardsSnapshots(state.masteryRewards, profile.masteryRewards);
  }
  ensureMasteryRewardsState(state);

  if(typeof profile.equippedWeaponId === "string" && profile.equippedWeaponId && state.ownedWeapons?.includes(profile.equippedWeaponId)){
    state.equippedWeaponId = profile.equippedWeaponId;
  }
  if(profile.mag && typeof profile.mag === "object"){
    state.mag = { ...(state.mag || {}), ...profile.mag };
  }
  if(profile.modeWallets && typeof profile.modeWallets === "object"){
    state.modeWallets = normalizeModeWallets({ ...(state.modeWallets || {}), ...profile.modeWallets }, state.funds, state.mode);
  }
  ensureStoryEndgameState(state);
  return state;
}
function readStoryProgressData(){
  try{
    let best = null;
    for(const key of storyProgressReadStorageKeys()){
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      let parsed = null;
      try{
        parsed = JSON.parse(raw);
      }catch(e){
        parsed = null;
      }
      if(!parsed || typeof parsed !== "object") continue;
      const mission = clamp(Math.floor(Number(parsed.mission || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
      const savedAt = Number.isFinite(Number(parsed.savedAt)) ? Number(parsed.savedAt) : 0;
      const candidate = {
        ...parsed,
        mission,
        storyVariant: normalizeStoryVariant(parsed.storyVariant),
        storyNgPlusTier: Math.max(0, Math.floor(Number(parsed.storyNgPlusTier || 0))),
        storyEndgameUnlocked: !!parsed.storyEndgameUnlocked,
        gauntletDepth: Math.max(1, Math.floor(Number(parsed.gauntletDepth || 1))),
        eliteHuntChapter: clamp(Math.floor(Number(parsed.eliteHuntChapter || 1)), 1, 10),
        eliteHuntRuns: Math.max(1, Math.floor(Number(parsed.eliteHuntRuns || 1))),
        eliteHuntsCleared: Math.max(0, Math.floor(Number(parsed.eliteHuntsCleared || 0))),
        hp: clamp(Math.round(Number(parsed.hp || 100)), 0, 100),
        armor: clamp(Math.round(Number(parsed.armor || 0)), 0, DEFAULT?.armorCap || 100),
        funds: Math.max(0, Math.round(Number(parsed.funds || 0))),
        savedAt,
        storageKey:key,
      };
      if(mission >= STORY_CAMPAIGN_OBJECTIVES.length){
        candidate.storyEndgameUnlocked = true;
      }
      if(!best){
        best = candidate;
        continue;
      }
      if(candidate.mission > best.mission){
        best = candidate;
        continue;
      }
      if(candidate.mission === best.mission && candidate.savedAt > best.savedAt){
        best = candidate;
      }
    }
    return best;
  }catch(e){
    return null;
  }
}
function writeStoryProgressData(payload={}){
  if(window.__TUTORIAL_MODE__) return false;
  ensureStoryEndgameState(S);
  const seasonPass = ensureSeasonPassState(S);
  const masteryRewards = ensureMasteryRewardsState(S);
  const nemesis = ensureNemesisState(S);
  const storyVariant = normalizeStoryVariant(payload.storyVariant ?? S.storyVariant);
  const storyNgPlusTier = Math.max(0, Math.floor(Number(payload.storyNgPlusTier ?? S.storyNgPlusTier ?? 0)));
  const gauntletDepth = Math.max(1, Math.floor(Number(payload.gauntletDepth ?? S.gauntletDepth ?? 1)));
  const eliteHuntChapter = clamp(Math.floor(Number(payload.eliteHuntChapter ?? S.eliteHuntChapter ?? 1)), 1, 10);
  const eliteHuntRuns = Math.max(1, Math.floor(Number(payload.eliteHuntRuns ?? S.eliteHuntRuns ?? 1)));
  const eliteHuntsCleared = Math.max(0, Math.floor(Number(payload.eliteHuntsCleared ?? S.eliteHuntsCleared ?? 0)));
  const mission = clamp(Math.floor(Number(payload.mission || S.storyLevel || S.storyLastMission || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  const data = {
    mission,
    storyLevel: clamp(Math.floor(Number(payload.storyLevel || S.storyLevel || mission)), 1, STORY_CAMPAIGN_OBJECTIVES.length),
    storyLastMission: clamp(Math.floor(Number(payload.storyLastMission || S.storyLastMission || mission)), 1, STORY_CAMPAIGN_OBJECTIVES.length),
    storyVariant,
    storyNgPlusTier,
    storyEndgameUnlocked: !!(payload.storyEndgameUnlocked ?? S.storyEndgameUnlocked ?? (mission >= STORY_CAMPAIGN_OBJECTIVES.length)),
    gauntletDepth,
    eliteHuntChapter,
    eliteHuntRuns,
    eliteHuntsCleared,
    hp: clamp(Math.round(Number(payload.hp ?? S.hp ?? 100)), 0, 100),
    armor: clamp(Math.round(Number(payload.armor ?? S.armor ?? 0)), 0, S.armorCap || 100),
    funds: Math.max(0, Math.round(Number(payload.funds ?? S.funds ?? 0))),
    score: Math.max(0, Math.round(Number(payload.score ?? S.score ?? 0))),
    lives: clamp(Math.round(Number(payload.lives ?? S.lives ?? 5)), 0, 99),
    modeWallets: normalizeModeWallets(payload.modeWallets ?? S.modeWallets, payload.funds ?? S.funds, S.mode),
    ownedWeapons: Array.isArray(payload.ownedWeapons ?? S.ownedWeapons) ? (payload.ownedWeapons ?? S.ownedWeapons).filter((id)=>typeof id === "string") : [],
    equippedWeaponId: String(payload.equippedWeaponId ?? S.equippedWeaponId ?? ""),
    ammoReserve: { ...(payload.ammoReserve ?? S.ammoReserve ?? {}) },
    durability: { ...(payload.durability ?? S.durability ?? {}) },
    weaponMastery: normalizeWeaponMasteryMap(payload.weaponMastery ?? S.weaponMastery),
    medkits: { ...(payload.medkits ?? S.medkits ?? {}) },
    repairKits: { ...(payload.repairKits ?? S.repairKits ?? {}) },
    armorPlates: normalizeArmorPlateInventory(payload.armorPlates ?? S.armorPlates),
    armorPlatesFallback: normalizeArmorPlateInventory(payload.armorPlatesFallback ?? S.armorPlatesFallback ?? payload.armorPlates ?? S.armorPlates),
    armorPlateSelectedId: String(payload.armorPlateSelectedId ?? S.armorPlateSelectedId ?? ""),
    medkitSelectedId: String(payload.medkitSelectedId ?? S.medkitSelectedId ?? ""),
    repairSelectedId: String(payload.repairSelectedId ?? S.repairSelectedId ?? ""),
    trapsOwned: Math.max(0, Math.floor(Number(payload.trapsOwned ?? S.trapsOwned ?? 0))),
    shields: Math.max(0, Math.floor(Number(payload.shields ?? S.shields ?? 0))),
    armorCap: clamp(Math.round(Number(payload.armorCap ?? S.armorCap ?? 100)), 100, 200),
    xp: Math.max(0, Math.floor(Number(payload.xp ?? S.xp ?? 0))),
    level: Math.max(1, Math.floor(Number(payload.level ?? S.level ?? 1))),
    perkPoints: Math.max(0, Math.floor(Number(payload.perkPoints ?? S.perkPoints ?? 0))),
    perks: { ...(payload.perks ?? S.perks ?? {}) },
    progressionUnlocks: { ...(payload.progressionUnlocks ?? S.progressionUnlocks ?? {}) },
    metaBase: { ...(payload.metaBase ?? S.metaBase ?? {}) },
    specialistPerks: { ...(payload.specialistPerks ?? S.specialistPerks ?? {}) },
    specialistStarUnlocks: { ...(payload.specialistStarUnlocks ?? S.specialistStarUnlocks ?? {}) },
    chapterRewardsUnlocked: { ...(payload.chapterRewardsUnlocked ?? S.chapterRewardsUnlocked ?? {}) },
    achievements: { ...(payload.achievements ?? S.achievements ?? {}) },
    stats: { ...(payload.stats ?? S.stats ?? {}) },
    opsTotals: { ...ensureOpsTotalsState(payload.opsTotals ? { opsTotals: payload.opsTotals } : S) },
    balanceStats: cloneState(ensureBalanceStatsState(payload.balanceStats ? { balanceStats: payload.balanceStats } : S)),
    nemesis: cloneState(payload.nemesis && typeof payload.nemesis === "object" ? ensureNemesisState({ nemesis: payload.nemesis }) : nemesis),
    contractTallies: normalizeContractTalliesMap(payload.contractTallies ?? S.contractTallies),
    contracts: (payload.contracts && typeof payload.contracts === "object")
      ? cloneState(payload.contracts)
      : ((S.contracts && typeof S.contracts === "object") ? cloneState(S.contracts) : null),
    liveOps: (payload.liveOps && typeof payload.liveOps === "object")
      ? cloneState(payload.liveOps)
      : ((S.liveOps && typeof S.liveOps === "object") ? cloneState(S.liveOps) : null),
    soldierAttackersOwned: Math.max(0, Math.floor(Number(payload.soldierAttackersOwned ?? S.soldierAttackersOwned ?? 0))),
    soldierRescuersOwned: Math.max(0, Math.floor(Number(payload.soldierRescuersOwned ?? S.soldierRescuersOwned ?? 0))),
    soldierAttackersDowned: Math.max(0, Math.floor(Number(payload.soldierAttackersDowned ?? S.soldierAttackersDowned ?? 0))),
    soldierRescuersDowned: Math.max(0, Math.floor(Number(payload.soldierRescuersDowned ?? S.soldierRescuersDowned ?? 0))),
    clanTag: normalizeClanTag(payload.clanTag ?? S.clanTag ?? defaultClanTagFromTelegram(S)) || "SOLO",
    clanName: sanitizeClanName(payload.clanName ?? S.clanName, payload.clanTag ?? S.clanTag ?? "SOLO"),
    clanRaidEnabled: !!(payload.clanRaidEnabled ?? S.clanRaidEnabled),
    clanContractClaims: (payload.clanContractClaims && typeof payload.clanContractClaims === "object")
      ? cloneState(payload.clanContractClaims)
      : ((S.clanContractClaims && typeof S.clanContractClaims === "object") ? cloneState(S.clanContractClaims) : {}),
    seasonPass: (payload.seasonPass && typeof payload.seasonPass === "object")
      ? cloneState(payload.seasonPass)
      : cloneState(seasonPass),
    masteryRewards: (payload.masteryRewards && typeof payload.masteryRewards === "object")
      ? cloneState(payload.masteryRewards)
      : cloneState(masteryRewards),
    mag: {
      loaded: Math.max(0, Math.floor(Number((payload.mag ?? S.mag ?? {}).loaded || 0))),
      cap: Math.max(0, Math.floor(Number((payload.mag ?? S.mag ?? {}).cap || 0))),
    },
    savedAt: Date.now(),
    source: String(payload.source || "autosave"),
  };
  try{
    const raw = JSON.stringify(data);
    localStorage.setItem(storyProgressStorageKey(), raw);
    return true;
  }catch(e){
    return false;
  }
}
function storySaveMissionFromPayload(payload){
  if(!payload || typeof payload !== "object") return 1;
  const fromResume = payload.resumeState && typeof payload.resumeState === "object"
    ? (payload.resumeState.storyLevel ?? payload.resumeState.storyLastMission ?? payload.resumeState.mission)
    : null;
  const raw = payload.mission ?? payload.storyLevel ?? payload.storyLastMission ?? fromResume ?? 1;
  return clamp(
    Math.floor(Number(raw || 1)),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
}
function buildStoryResumeSnapshot(){
  const snapshot = buildPersistedState();
  ensureStoryEndgameState(snapshot);
  const mission = clamp(
    Math.max(
      1,
      Math.floor(Number(snapshot.storyLevel || 1)),
      Math.floor(Number(snapshot.storyLastMission || 1))
    ),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
  snapshot.mode = "Story";
  snapshot.storyLevel = mission;
  snapshot.storyLastMission = Math.max(mission, Math.floor(Number(snapshot.storyLastMission || mission)));
  const storyFunds = Math.max(0, Math.round(Number(getModeWallet("Story", snapshot) || snapshot.funds || 0)));
  snapshot.modeWallets = normalizeModeWallets(snapshot.modeWallets, storyFunds, "Story");
  if(snapshot.modeWallets && typeof snapshot.modeWallets === "object"){
    snapshot.modeWallets.Story = storyFunds;
  }
  snapshot.funds = storyFunds;
  snapshot.v = STORAGE_VERSION;
  trimPersistentState(snapshot);
  return snapshot;
}
function restoreStoryResumeSnapshot(slot, source="story-restore"){
  const mission = storySaveMissionFromPayload(slot || {});
  const resume = (slot && typeof slot.resumeState === "object") ? cloneState(slot.resumeState) : null;
  if(!resume) return false;
  ensureStoryEndgameState(resume);

  resume.mode = "Story";
  resume.storyLevel = clamp(Math.floor(Number(resume.storyLevel || mission || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  resume.storyLastMission = clamp(
    Math.max(
      Math.floor(Number(resume.storyLastMission || 1)),
      Math.floor(Number(resume.storyLevel || 1)),
      mission
    ),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
  const storyFunds = Math.max(0, Math.round(Number(getModeWallet("Story", resume) || resume.funds || 0)));
  resume.modeWallets = normalizeModeWallets(resume.modeWallets, storyFunds, "Story");
  if(resume.modeWallets && typeof resume.modeWallets === "object"){
    resume.modeWallets.Story = storyFunds;
  }
  resume.funds = storyFunds;
  resume.v = STORAGE_VERSION;
  trimPersistentState(resume);

  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
  }catch(e){}

  S = load();
  bindFundsWallet(S);
  syncWindowState();
  resizeCanvasForViewport();
  applyTouchHudSettings();
  applyModeTheme(S.mode);
  invalidateMapCache();
  transitionCleanupSweep(source);
  clearTransientCombatVisuals();
  if(missionStateLooksEmpty()){
    const keepHp = clamp(Number(S.hp || 100), 0, 100);
    const keepArmor = clamp(Number(S.armor || 0), 0, S.armorCap || 100);
    deploy({ carryStats:true, hp:keepHp, armor:keepArmor });
  }
  updateEngage();
  maybeRenderHUD(true);
  try{ renderCombatControls(); }catch(e){}
  save(true);
  return true;
}
function readStorySaveData(){
  try{
    let best = null;
    for(const key of storySaveReadStorageKeys()){
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      let parsed = null;
      try{
        parsed = JSON.parse(raw);
      }catch(e){
        parsed = null;
      }
      if(!parsed || typeof parsed !== "object") continue;
      const mission = storySaveMissionFromPayload(parsed);
      if(!Number.isFinite(mission) || mission < 1) continue;
      const savedAt = Number.isFinite(Number(parsed.savedAt)) ? Number(parsed.savedAt) : 0;
      const candidate = { ...parsed, mission, savedAt, storageKey:key };
      if(!best){
        best = candidate;
        continue;
      }
      // Prefer higher mission to avoid accidental regressions to Mission 1.
      if(candidate.mission > best.mission){
        best = candidate;
        continue;
      }
      // If missions tie, prefer newer timestamp.
      if(candidate.mission === best.mission && candidate.savedAt > best.savedAt){
        best = candidate;
      }
    }
    return best;
  }catch(e){
    return null;
  }
}
function applyStorySaveToState(state, opts={}){
  if(!state || typeof state !== "object") return state;
  ensureStoryEndgameState(state);
  const allowModeSync = opts.allowModeSync !== false;
  const slot = readStorySaveData();
  if(!slot) return state;
  applyStoryEndgameSnapshot(state, slot);
  if(slot.resumeState && typeof slot.resumeState === "object"){
    applyStoryEndgameSnapshot(state, slot.resumeState);
  }
  const mission = clamp(
    Math.floor(Number(slot.mission || 1)),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
  state.storyLastMission = Math.max(
    clamp(Math.floor(Number(state.storyLastMission || state.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length),
    mission
  );
  if(allowModeSync && normalizeModeName(state.mode) === "Story"){
    state.storyLevel = Math.max(
      clamp(Math.floor(Number(state.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length),
      state.storyLastMission
    );
  }
  ensureStoryEndgameState(state);
  return state;
}
function storyResumeMissionLevel(){
  const slotMission = Math.floor(Number(storySaveMissionFromPayload(readStorySaveData() || {}) || 1));
  const progressMission = Math.floor(Number((readStoryProgressData() || {}).mission || 1));
  return clamp(
    Math.max(
      1,
      Math.floor(Number(S.storyLevel || 1)),
      Math.floor(Number(S.storyLastMission || 1)),
      slotMission,
      progressMission
    ),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
}
function storyProgressMissionFromState(state=S){
  const src = (state && typeof state === "object") ? state : {};
  return clamp(
    Math.max(
      1,
      Math.floor(Number(src.storyLevel || 1)),
      Math.floor(Number(src.storyLastMission || 1))
    ),
    1,
    STORY_CAMPAIGN_OBJECTIVES.length
  );
}
function writeStorySaveData(source="manual"){
  if(window.__TUTORIAL_MODE__) return null;
  const resumeState = buildStoryResumeSnapshot();
  ensureStoryEndgameState(resumeState);
  const mission = storySaveMissionFromPayload(resumeState);
  const payload = {
    mission,
    storyLevel: mission,
    storyLastMission: mission,
    storyVariant: normalizeStoryVariant(resumeState.storyVariant),
    storyNgPlusTier: Math.max(0, Math.floor(Number(resumeState.storyNgPlusTier || 0))),
    storyEndgameUnlocked: !!resumeState.storyEndgameUnlocked,
    gauntletDepth: Math.max(1, Math.floor(Number(resumeState.gauntletDepth || 1))),
    eliteHuntChapter: clamp(Math.floor(Number(resumeState.eliteHuntChapter || 1)), 1, 10),
    eliteHuntRuns: Math.max(1, Math.floor(Number(resumeState.eliteHuntRuns || 1))),
    eliteHuntsCleared: Math.max(0, Math.floor(Number(resumeState.eliteHuntsCleared || 0))),
    hp: clamp(Math.round(Number(resumeState.hp || S.hp || 100)), 0, 100),
    armor: clamp(Math.round(Number(resumeState.armor || S.armor || 0)), 0, S.armorCap || 100),
    funds: Math.max(0, Math.round(Number(getModeWallet("Story", resumeState) || resumeState.funds || S.funds || 0))),
    resumeState,
    savedAt: Date.now(),
    source: String(source || "manual"),
  };
  const progressOk = writeStoryProgressData({
    mission,
    hp: payload.hp,
    armor: payload.armor,
    funds: payload.funds,
    source: payload.source,
  });
  const profileOk = writeStoryProfileData(payload.source, resumeState);
  try{
    const raw = JSON.stringify(payload);
    localStorage.setItem(storySaveStorageKey(), raw);
    return payload;
  }catch(e){
    return (progressOk || profileOk) ? payload : null;
  }
}
function clearStorySaveData(){
  try{
    for(const key of storySaveReadStorageKeys()){
      localStorage.removeItem(key);
    }
    for(const key of storyProgressReadStorageKeys()){
      localStorage.removeItem(key);
    }
    for(const key of storyProfileReadStorageKeys()){
      localStorage.removeItem(key);
    }
  }catch(e){}
}
function previewNextDailyReward(){
  const info = readDaily();
  const today = ymdUTC();
  const yesterday = new Date(Date.now());
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const y = ymdUTC(yesterday);
  let streak = 1;
  if(info?.last === today) streak = Number(info.streak || 0) + 1;
  else if(info?.last === y) streak = Number(info.streak || 0) + 1;
  const cash = 300 + Math.min(900, streak * 60);
  const perkPts = (streak % 3 === 0) ? 2 : 1;
  return { streak, cash, perkPts, total:Math.max(1, Number(info?.total || 0) + (info?.last === today ? 0 : 1)) };
}
function setLaunchArtwork(url=""){
  try{
    const next = String(url || "").trim();
    if(next) localStorage.setItem("ts_launch_art_url", next);
    else localStorage.removeItem("ts_launch_art_url");
  }catch(e){}
  refreshLaunchIntroStatus();
}
function launchProgressLabelForMode(mode=S.mode){
  const m = normalizeModeName(mode);
  if(m === "Story"){
    const mission = storyMissionForState(S);
    const variant = normalizeStoryVariant(mission.storyVariant);
    if(variant === STORY_VARIANTS.GAUNTLET) return `Gauntlet Run ${mission.runIndex}`;
    if(variant === STORY_VARIANTS.ELITE_HUNT) return `Elite Hunt ${mission.runIndex} (Chapter ${mission.chapter})`;
    return `Story Mission ${storyResumeMissionLevel()}`;
  }
  if(m === "Arcade"){
    ensureArcadeWeeklySeedState(S);
    if(S.arcadeWeeklySeedEnabled){
      return `Arcade Weekly Seed ${S.arcadeWeeklySeedKey || weeklyChallengeWeekKey()}`;
    }
    return `Arcade Mission ${clamp(S.arcadeLevel || 1, 1, ARCADE_CAMPAIGN_OBJECTIVES.length)}`;
  }
  return `Survival Wave ${Math.max(1, S.survivalWave || 1)}`;
}
function modeHasSavedProgress(mode=S.mode){
  const m = normalizeModeName(mode);
  if(m === "Story") return storyResumeMissionLevel() > 1;
  if(m === "Arcade") return Math.max(1, S.arcadeLevel || 1) > 1;
  return Math.max(1, S.survivalWave || 1) > 1 || Number(S.surviveSeconds || 0) > 0;
}
function refreshLaunchStartButtons(){
  const continueBtn = document.getElementById("launchContinueBtn");
  const restartBtn = document.getElementById("launchRestartBtn");
  const loadBtn = document.getElementById("launchLoadBtn");
  const hintEl = document.getElementById("launchProgressHint");
  const mode = normalizeModeName(S.mode);
  const progressLabel = launchProgressLabelForMode(mode);
  const hasProgress = modeHasSavedProgress(mode);
  const slot = readStorySaveData();
  const progress = readStoryProgressData();
  const slotMission = Number(slot?.mission || 0);
  const progressMission = Number(progress?.mission || 0);
  const loadMission = Math.max(slotMission, progressMission);

  if(continueBtn){
    continueBtn.innerText = mode === "Story"
      ? `▶ Continue Last Mission (${progressLabel})`
      : `▶ Continue (${progressLabel})`;
  }
  if(restartBtn) restartBtn.disabled = !hasProgress;
  if(loadBtn){
    const canLoad = mode === "Story" && loadMission > 0;
    loadBtn.disabled = !canLoad;
    loadBtn.innerText = canLoad
      ? `📂 Load Save (Story Mission ${loadMission})`
      : "📂 Load Save";
  }
  if(hintEl){
    if(mode === "Story" && loadMission > 0){
      hintEl.innerText = hasProgress
        ? `Saved progress found: ${progressLabel}. Continue where you left off, or load your Story save at Mission ${loadMission}.`
        : `Story save found at Mission ${loadMission}. You can load it now.`;
    } else {
      hintEl.innerText = hasProgress
        ? `Saved progress found: ${progressLabel}. Continue where you left off, or restart from Mission 1.`
        : `${mode} save is currently at Mission 1. Continue to start playing.`;
    }
  }
}
function bindLaunchIntroAudioGesture(){
  const overlay = document.getElementById("launchIntroOverlay");
  if(!overlay || overlay.dataset.audioBound === "1") return;
  overlay.dataset.audioBound = "1";
  overlay.addEventListener("pointerdown", ()=>{
    if(!S.soundOn) return;
    ensureAudio();
    playLaunchTheme(true);
    startLaunchMusicLoop(true);
  }, { passive:true });
}
function refreshLaunchIntroStatus(){
  ensureContractsState(S);
  ensureLiveOpsState(S);
  ensureClanState(S);
  const streakEl = document.getElementById("launchIntroStreak");
  const dailyEl = document.getElementById("launchIntroDailyStatus");
  const commanderEl = document.getElementById("launchCommanderCard");
  const intelEl = document.getElementById("launchIntelCard");
  const dailyCardEl = document.getElementById("launchDailyCard");
  const contractsCardEl = document.getElementById("launchContractsCard");
  const liveOpsCardEl = document.getElementById("launchLiveOpsCard");
  const clanCardEl = document.getElementById("launchClanCard");
  const referralCardEl = document.getElementById("launchReferralCard");
  const eventDropCardEl = document.getElementById("launchEventDropCard");
  const posterEl = document.getElementById("launchPoster");
  const info = readDaily();
  const streak = Math.max(0, Number(info?.streak || 0));
  const missionCard = currentMissionCardData();
  const mission = missionCard?.mission || null;
  if(posterEl){
    try{
      const customArt = localStorage.getItem("ts_launch_art_url");
      if(customArt){
        const safeUrl = customArt.replace(/["'()]/g, "");
        posterEl.style.backgroundImage =
          `linear-gradient(180deg, rgba(8,14,24,.14), rgba(5,9,18,.65)), url("${safeUrl}"), radial-gradient(circle at 82% 14%, rgba(74,222,128,.22), transparent 46%), radial-gradient(circle at 14% 82%, rgba(58,120,255,.26), transparent 52%)`;
      } else {
        posterEl.style.backgroundImage = "";
      }
    }catch(e){}
  }
  if(streakEl) streakEl.innerText = `🔥 Streak ${streak}`;
  if(dailyEl){
    if(__pendingDailyReward){
      const cash = Number(__pendingDailyReward.cash || 0);
      const perks = Number(__pendingDailyReward.perkPts || 0);
      dailyEl.innerText = `Daily reward ready: +$${cash.toLocaleString()} and +${perks} perk point${perks===1?"":"s"}.`;
    } else {
      dailyEl.innerText = `Daily reward claimed. Next drop in ${nextDailyCountdownText()}.`;
    }
  }
  if(commanderEl){
    const lv = Math.max(1, Number(S.level || 1));
    const title = effectiveDisplayTitle(S);
    commanderEl.innerText = `${title} • Lv ${lv} • Funds $${Number(S.funds||0).toLocaleString()}`;
  }
  if(intelEl){
    if(mission){
      const civ = Number(mission.civilians || 0);
      const tig = Number(mission.tigers || 0);
      const variant = normalizeStoryVariant(mission.storyVariant);
      if(missionCard.mode === "Story" && variant === STORY_VARIANTS.GAUNTLET){
        intelEl.innerText = `Gauntlet Run ${mission.runIndex} • Civilians ${civ} • Tigers ${tig}`;
      } else if(missionCard.mode === "Story" && variant === STORY_VARIANTS.ELITE_HUNT){
        intelEl.innerText = `Elite Hunt ${mission.runIndex} • Chapter ${mission.chapter} • Boss ${mission.bossType || "Alpha"}`;
      } else if(missionCard.mode === "Arcade" && mission.weeklySeed){
        intelEl.innerText = `Weekly Seed ${mission.weeklySeedKey} • Civilians ${civ} • Tigers ${tig}`;
      } else {
        intelEl.innerText = `${missionCard.mode} Mission ${mission.number} • Civilians ${civ} • Tigers ${tig}`;
      }
    } else {
      intelEl.innerText = `${S.mode} Ops • Prepare your squad and loadout.`;
    }
  }
  if(dailyCardEl){
    if(__pendingDailyReward){
      dailyCardEl.innerText = `Ready now: +$${Number(__pendingDailyReward.cash || 0).toLocaleString()} • +${Number(__pendingDailyReward.perkPts || 0)} perk`;
    } else {
      const next = previewNextDailyReward();
      dailyCardEl.innerText = `Next reward: +$${next.cash.toLocaleString()} • +${next.perkPts} perk in ${nextDailyCountdownText()}`;
    }
  }
  if(contractsCardEl){
    contractsCardEl.innerText = launchContractsSummaryText(S);
  }
  if(liveOpsCardEl){
    liveOpsCardEl.innerText = launchLiveOpsSummaryText(S);
  }
  if(clanCardEl){
    clanCardEl.innerText = launchClanSummaryText(S);
  }
  if(referralCardEl){
    referralCardEl.innerText = launchReferralSummaryText(S);
  }
  if(eventDropCardEl){
    eventDropCardEl.innerText = launchEventDropSummaryText(S);
  }
  refreshLaunchStartButtons();
}
function restartFromMission1FromLaunchIntro(){
  const mode = normalizeModeName(S.mode);
  if(!modeHasSavedProgress(mode)){
    toast(`${mode} is already at Mission 1.`);
    return;
  }
  const progressLabel = launchProgressLabelForMode(mode);
  const ok = window.confirm
    ? window.confirm(`Restart ${mode} from Mission 1?\nCurrent saved progress: ${progressLabel}`)
    : true;
  if(!ok) return;
  clearLaunchMusicLoop();
  clearLaunchIntroAutoTimer();
  const launchOverlay = document.getElementById("launchIntroOverlay");
  if(launchOverlay) launchOverlay.style.display = "none";
  const dailyOverlay = document.getElementById("dailyRewardOverlay");
  if(dailyOverlay) dailyOverlay.style.display = "none";
  __dailyRewardContinue = null;
  restartModeFromMission1();
  setPaused(false, null);
  syncGamepadFocus();
}
function saveGameNow(){
  if(window.__TUTORIAL_MODE__){
    toast("Save is disabled during tutorial.");
    return;
  }
  if(normalizeModeName(S.mode) !== "Story"){
    toast("Manual save currently supports Story mode.");
    return;
  }
  const slot = writeStorySaveData("manual");
  if(!slot){
    toast("Save failed. Try again.");
    return;
  }
  S.storyLastMission = Math.max(Number(S.storyLastMission || 1), Number(slot.mission || 1));
  save(true);
  refreshLaunchIntroStatus();
  toast(`Saved Story Mission ${slot.mission} with full progress snapshot.`);
}
function loadStorySaveFromLaunchIntro(){
  const slot = readStorySaveData();
  const progress = readStoryProgressData();
  const profileRaw = readStoryProfileData();
  if(!slot && !progress){
    toast("No Story save found.");
    return;
  }
  clearLaunchMusicLoop();
  clearLaunchIntroAutoTimer();
  const launchOverlay = document.getElementById("launchIntroOverlay");
  if(launchOverlay) launchOverlay.style.display = "none";
  const dailyOverlay = document.getElementById("dailyRewardOverlay");
  if(dailyOverlay) dailyOverlay.style.display = "none";
  __dailyRewardContinue = null;

  const slotMission = storySaveMissionFromPayload(slot || {});
  const progressMission = Math.floor(Number(progress?.mission || 1));
  const beforeMission = storyProgressMissionFromState(S);
  const mission = clamp(Math.max(slotMission, progressMission, beforeMission), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  const restored = !!slot && (slotMission >= beforeMission) && (slotMission >= progressMission)
    ? restoreStoryResumeSnapshot(slot, "launch-load-story-slot")
    : false;
  if(!restored){
    setModeWallet(S.mode, S.funds, S);
    S.mode = "Story";
    applyModeTheme(S.mode);
    const nextFunds = Number.isFinite(Number(progress?.funds))
      ? Number(progress.funds)
      : getModeWallet("Story", S);
    S.funds = Math.max(0, Math.round(nextFunds));
    S.storyLastMission = mission;
    S.storyLevel = mission;
    const profileOverlay = resolveStoryProfileOverlay(profileRaw, progress, S);
    applyStoryProfileToState(S, profileOverlay);
    const nextHp = Number.isFinite(Number(slot?.hp))
      ? clamp(Number(slot.hp), 0, 100)
      : (Number.isFinite(Number(progress?.hp)) ? clamp(Number(progress.hp), 0, 100) : clamp(S.hp, 0, 100));
    const nextArmor = Number.isFinite(Number(slot?.armor))
      ? clamp(Number(slot.armor), 0, S.armorCap || 100)
      : (Number.isFinite(Number(progress?.armor)) ? clamp(Number(progress.armor), 0, S.armorCap || 100) : clamp(S.armor, 0, S.armorCap || 100));
    deploy({ carryStats:true, hp:nextHp, armor:nextArmor });
  }
  if(storyProgressMissionFromState(S) < mission){
    const forceHp = clamp(Number(S.hp || 100), 0, 100);
    const forceArmor = clamp(Number(S.armor || 0), 0, S.armorCap || 100);
    S.mode = "Story";
    S.storyLevel = mission;
    S.storyLastMission = Math.max(Number(S.storyLastMission || 1), mission);
    deploy({ carryStats:true, hp:forceHp, armor:forceArmor });
  }
  const profileOverlay = resolveStoryProfileOverlay(profileRaw, progress, S);
  applyStoryProfileToState(S, profileOverlay);
  S.mode = "Story";
  S.storyLevel = Math.max(mission, Math.floor(Number(S.storyLevel || 1)));
  S.storyLastMission = Math.max(Number(S.storyLastMission || 1), mission);
  writeStorySaveData("load-launch");
  save(true);
  toast(`Loaded Story save at Mission ${mission}.`);
  continueFromLaunchIntro(true);
}
function openDailyRewardOverlay(reward=null, onDone=null){
  const active = reward || __pendingDailyReward;
  const overlay = document.getElementById("dailyRewardOverlay");
  if(!overlay) return false;
  const cashEl = document.getElementById("dailyRewardCash");
  const perkEl = document.getElementById("dailyRewardPerks");
  const streakEl = document.getElementById("dailyRewardStreak");
  const totalEl = document.getElementById("dailyRewardTotal");
  const stateEl = document.getElementById("dailyRewardStateText");
  const countdownEl = document.getElementById("dailyRewardCountdownText");
  const claimBtn = document.getElementById("dailyRewardClaimBtn");
  const dailyInfo = readDaily();
  const preview = active || previewNextDailyReward();
  if(cashEl) cashEl.innerText = `$${Number(preview.cash || 0).toLocaleString()}`;
  if(perkEl) perkEl.innerText = `+${Number(preview.perkPts || 0)}`;
  if(streakEl) streakEl.innerText = `${Math.max(1, Number(preview.streak || 1))}`;
  if(totalEl) totalEl.innerText = `${Math.max(1, Number((active ? preview.total : Number(dailyInfo.total || 0)) || 1))}`;
  if(stateEl){
    if(active) stateEl.innerHTML = "<b>Your login reward is ready.</b> Claim it to continue your mission.";
    else stateEl.innerHTML = "<b>Today's reward was already claimed.</b> Here is your next reward preview.";
  }
  if(countdownEl){
    countdownEl.innerText = active
      ? `Claim now • Streak ${Math.max(1, Number(preview.streak || 1))}`
      : `Next claim opens in ${nextDailyCountdownText()} (UTC reset)`;
  }
  if(claimBtn){
    claimBtn.innerText = active ? "Claim Reward" : "Continue";
    claimBtn.classList.toggle("good", !!active);
    claimBtn.classList.toggle("ghost", !active);
  }
  __dailyRewardContinue = (typeof onDone === "function") ? onDone : null;
  setPaused(true,"daily-reward");
  overlay.style.display = "flex";
  if(active) sfx("win");
  else sfx("ui");
  syncGamepadFocus();
  return true;
}
function claimDailyRewardOverlay(){
  const overlay = document.getElementById("dailyRewardOverlay");
  if(overlay) overlay.style.display = "none";
  const onDone = __dailyRewardContinue;
  __dailyRewardContinue = null;
  const hadPending = !!__pendingDailyReward;
  __pendingDailyReward = null;
  refreshLaunchIntroStatus();
  if(typeof onDone === "function"){
    if(hadPending) save();
    onDone();
    return;
  }
  if(introOverlayVisible()){
    setPaused(true, "launch-intro");
    syncGamepadFocus();
    return;
  }
  if(S.paused && S.pauseReason === "daily-reward"){
    setPaused(false,null);
  }
  if(hadPending) save();
  syncGamepadFocus();
}
function maybeShowPendingDailyReward(onDone){
  if(!__pendingDailyReward) return false;
  return openDailyRewardOverlay(__pendingDailyReward, onDone);
}
function continueAfterLaunchIntro(allowStoryIntro=true){
  clearLaunchMusicLoop();
  if(S.mode === "Story"){
    const slot = readStorySaveData();
    const progress = readStoryProgressData();
    const profileRaw = readStoryProfileData();
    const beforeMission = storyProgressMissionFromState(S);
    const slotMission = storySaveMissionFromPayload(slot || {});
    const progressMission = Math.floor(Number(progress?.mission || 1));
    const mission = clamp(Math.max(beforeMission, slotMission, progressMission), 1, STORY_CAMPAIGN_OBJECTIVES.length);
    const shouldRestoreFromSlot = !!slot && (slotMission >= beforeMission) && (slotMission >= progressMission);
    if(shouldRestoreFromSlot && restoreStoryResumeSnapshot(slot, "launch-continue-story-slot")){
      S.storyLevel = mission;
      S.storyLastMission = Math.max(S.storyLastMission || mission, mission);
    } else {
      const carryHp = Number.isFinite(Number(progress?.hp))
        ? clamp(Number(progress.hp), 0, 100)
        : clamp(S.hp, 0, 100);
      const carryArmor = Number.isFinite(Number(progress?.armor))
        ? clamp(Number(progress.armor), 0, S.armorCap || 100)
        : clamp(S.armor, 0, S.armorCap || 100);
      S.mode = "Story";
      S.storyLevel = mission;
      S.storyLastMission = Math.max(Number(S.storyLastMission || 1), mission);
      if(Number.isFinite(Number(progress?.funds))){
        S.funds = Math.max(0, Math.round(Number(progress.funds || 0)));
      }
      const profileOverlay = resolveStoryProfileOverlay(profileRaw, progress, S);
      applyStoryProfileToState(S, profileOverlay);
      deploy({ carryStats:true, hp:carryHp, armor:carryArmor });
    }
    if(storyProgressMissionFromState(S) < mission){
      const forceHp = clamp(Number(S.hp || 100), 0, 100);
      const forceArmor = clamp(Number(S.armor || 0), 0, S.armorCap || 100);
      S.mode = "Story";
      S.storyLevel = mission;
      S.storyLastMission = Math.max(Number(S.storyLastMission || 1), mission);
      deploy({ carryStats:true, hp:forceHp, armor:forceArmor });
    }
    const profileOverlay = resolveStoryProfileOverlay(profileRaw, progress, S);
    applyStoryProfileToState(S, profileOverlay);
    S.mode = "Story";
    S.storyLevel = Math.max(mission, Math.floor(Number(S.storyLevel || 1)));
    S.storyLastMission = Math.max(Number(S.storyLastMission || 1), mission);
    writeStorySaveData("continue-launch");
    save(true);
  }
  if(S.mode==="Story" && !window.__TUTORIAL_MODE__ && !S.storyIntroSeen){
    if(allowStoryIntro){
      openStoryIntro(false);
      return;
    }
    setPaused(false,null);
    syncGamepadFocus();
    return;
  }
  const shown = showMissionBrief(INTRO_BRIEF_MS);
  if(!shown) setPaused(false,null);
  syncGamepadFocus();
}
function continueFromLaunchIntro(allowStoryIntro=true){
  if(maybeShowPendingDailyReward(()=>continueAfterLaunchIntro(allowStoryIntro))) return;
  continueAfterLaunchIntro(allowStoryIntro);
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
  const dailyOverlay = document.getElementById("dailyRewardOverlay");
  if(dailyOverlay) dailyOverlay.style.display = "none";
  __dailyRewardContinue = null;
  bindLaunchIntroAudioGesture();
  refreshLaunchIntroStatus();
  requestGameplayCloudSync("launch-intro", { force:true });
  setPaused(true,"launch-intro");
  overlay.style.display = "flex";
  clearLaunchMusicLoop();
  playLaunchTheme(false);
  startLaunchMusicLoop(false);
  __launchIntroAutoTimer = setTimeout(()=>{
    beginFromLaunchIntro({ auto:true });
  }, INTRO_LAUNCH_MS);
  syncGamepadFocus();
}
function beginFromLaunchIntro(){
  clearLaunchIntroAutoTimer();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  continueFromLaunchIntro(true);
}
function startQuickTutorialFromLaunchIntro(){
  clearLaunchMusicLoop();
  clearLaunchIntroAutoTimer();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  setPaused(false,null);
  syncGamepadFocus();
  window.startTutorial?.();
}
function openContractsFromLaunchIntro(){
  clearLaunchIntroAutoTimer();
  clearLaunchMusicLoop();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  openInventory();
  requestAnimationFrame(()=>{
    const anchor = document.getElementById("invContractsAnchor");
    if(anchor && typeof anchor.scrollIntoView === "function"){
      anchor.scrollIntoView({ block:"start", inline:"nearest" });
    }
  });
}
function openClanContractsFromLaunchIntro(){
  clearLaunchIntroAutoTimer();
  clearLaunchMusicLoop();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  openInventory();
  requestAnimationFrame(()=>{
    const anchor = document.getElementById("invClanAnchor");
    if(anchor && typeof anchor.scrollIntoView === "function"){
      anchor.scrollIntoView({ block:"start", inline:"nearest" });
    }
  });
}
function openLiveOpsFromLaunchIntro(){
  clearLaunchIntroAutoTimer();
  clearLaunchMusicLoop();
  const overlay = document.getElementById("launchIntroOverlay");
  if(overlay) overlay.style.display = "none";
  openInventory();
  requestAnimationFrame(()=>{
    const anchor = document.getElementById("invLiveOpsAnchor");
    if(anchor && typeof anchor.scrollIntoView === "function"){
      anchor.scrollIntoView({ block:"start", inline:"nearest" });
    }
  });
}
function skipLaunchIntro(){
  clearLaunchMusicLoop();
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
  startLaunchMusicLoop(false);
  __storyIntroAutoTimer = setTimeout(()=>{
    beginStoryMissionFromIntro({ auto:true });
  }, INTRO_STORY_MS);
  syncGamepadFocus();
}
function beginStoryMissionFromIntro(){
  clearLaunchMusicLoop();
  clearStoryIntroAutoTimer();
  const overlay = document.getElementById("storyIntroOverlay");
  if(overlay) overlay.style.display = "none";
  S.storyIntroSeen = true;
  save();
  const shown = showMissionBrief(INTRO_BRIEF_MS);
  if(!shown) setPaused(false,null);
  syncGamepadFocus();
}
function startQuickTutorialFromIntro(){
  clearLaunchMusicLoop();
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
  ensureStoryEndgameState(S);
  setModeWallet(S.mode, S.funds, S);
  S.mode = nextMode;
  S.funds = getModeWallet(nextMode, S);
  S.lives=5;
  applyModeTheme(S.mode);
  if(nextMode==="Arcade") S.arcadeLevel=1;
  if(nextMode==="Survival"){ S.survivalWave=1; S.survivalStart=Date.now(); S.surviveSeconds=0; }
  if(nextMode==="Story"){
    // Keep Story progress when returning to Story mode.
    S.storyLevel = storyResumeMissionLevel();
    S.storyLastMission = S.storyLevel;
    ensureStoryEndgameState(S);
  }
  S.mapIndex=0;
  deploy();
  updateModeDesc(); markModeTabs(); closeMode(); sfx("ui");
  if(wantsStoryIntro) openStoryIntro(false);
  save();
}
function setStoryCampaignMode(){
  ensureStoryEndgameState(S);
  S.mode = "Story";
  S.storyVariant = STORY_VARIANTS.CAMPAIGN;
  S.storyLevel = storyResumeMissionLevel();
  S.storyLastMission = Math.max(S.storyLastMission || 1, S.storyLevel || 1);
  S.funds = getModeWallet("Story", S);
  S.mapIndex = 0;
  deploy();
  updateModeDesc();
  markModeTabs();
  toast(`Story Campaign ready (${storyMissionDisplayLabel(S)}).`);
  save(true);
}
function startStoryNgPlus(){
  ensureStoryEndgameState(S);
  if(!storyEndgameUnlocked(S)){
    toast("Complete Story Mission 100 to unlock New Game+.");
    return;
  }
  S.mode = "Story";
  S.storyVariant = STORY_VARIANTS.CAMPAIGN;
  S.storyNgPlusTier = Math.max(0, Math.floor(Number(S.storyNgPlusTier || 0))) + 1;
  S.storyLevel = 1;
  S.storyLastMission = 1;
  clearStoryCheckpointData();
  clearStorySaveData();
  S._storyFinalOutcome = "";
  S.funds = getModeWallet("Story", S);
  S.mapIndex = 0;
  deploy();
  updateModeDesc();
  markModeTabs();
  toast(`New Game+ ${S.storyNgPlusTier} started.`);
  save(true);
}
function startEndlessGauntlet(){
  ensureStoryEndgameState(S);
  if(!storyEndgameUnlocked(S)){
    toast("Complete Story Mission 100 to unlock Endless Gauntlet.");
    return;
  }
  S.mode = "Story";
  S.storyVariant = STORY_VARIANTS.GAUNTLET;
  S.gauntletDepth = Math.max(1, Math.floor(Number(S.gauntletDepth || 1)));
  S.storyLevel = storyMissionLevelForState(S);
  S.storyLastMission = Math.max(S.storyLastMission || 1, S.storyLevel || 1);
  S.funds = getModeWallet("Story", S);
  S.mapIndex = 0;
  deploy();
  updateModeDesc();
  markModeTabs();
  toast(`Gauntlet active: Run ${S.gauntletDepth}.`);
  save(true);
}
function startEliteBossHunt(chapter=null){
  ensureStoryEndgameState(S);
  if(!storyEndgameUnlocked(S)){
    toast("Complete Story Mission 100 to unlock Elite Boss Hunts.");
    return;
  }
  const nextChapter = Number.isFinite(Number(chapter))
    ? clamp(Math.floor(Number(chapter)), 1, 10)
    : clamp(Math.floor(Number(S.eliteHuntChapter || 1)), 1, 10);
  S.mode = "Story";
  S.storyVariant = STORY_VARIANTS.ELITE_HUNT;
  S.eliteHuntChapter = nextChapter;
  S.eliteHuntRuns = Math.max(1, Math.floor(Number(S.eliteHuntRuns || 1)));
  S.storyLevel = storyMissionLevelForState(S);
  S.storyLastMission = Math.max(S.storyLastMission || 1, S.storyLevel || 1);
  S.funds = getModeWallet("Story", S);
  S.mapIndex = 0;
  deploy();
  updateModeDesc();
  markModeTabs();
  toast(`Elite Boss Hunt ready: Chapter ${S.eliteHuntChapter}.`);
  save(true);
}
function cycleEliteHuntChapter(){
  ensureStoryEndgameState(S);
  const next = (clamp(Math.floor(Number(S.eliteHuntChapter || 1)), 1, 10) % 10) + 1;
  S.eliteHuntChapter = next;
  if(normalizeStoryVariant(S.storyVariant) === STORY_VARIANTS.ELITE_HUNT){
    startEliteBossHunt(next);
    return;
  }
  updateModeDesc();
  save();
  toast(`Elite Hunt target chapter: ${next}.`);
}
function updateStoryEndgameControls(){
  ensureStoryEndgameState(S);
  const statusEl = document.getElementById("modeEndgameStatus");
  const campaignBtn = document.getElementById("modeStoryCampaignBtn");
  const ngBtn = document.getElementById("modeNgPlusBtn");
  const gauntletBtn = document.getElementById("modeGauntletBtn");
  const eliteBtn = document.getElementById("modeEliteHuntBtn");
  const eliteChapterBtn = document.getElementById("modeEliteChapterBtn");
  const unlocked = storyEndgameUnlocked(S);
  const variant = normalizeStoryVariant(S.storyVariant);
  const mission = storyMissionForState(S);
  if(statusEl){
    if(!unlocked){
      statusEl.innerText = "Endgame unlocks after Story Mission 100.";
    }else if(variant === STORY_VARIANTS.GAUNTLET){
      statusEl.innerText = `Endgame: ${storyVariantLabel(variant)} • Run ${mission.runIndex} • Loop ${mission.gauntletLoop || 1} • NG+ ${Math.max(0, S.storyNgPlusTier || 0)}.`;
    }else if(variant === STORY_VARIANTS.ELITE_HUNT){
      statusEl.innerText = `Endgame: ${storyVariantLabel(variant)} • Chapter ${S.eliteHuntChapter} • Hunt ${mission.runIndex} • NG+ ${Math.max(0, S.storyNgPlusTier || 0)}.`;
    }else{
      statusEl.innerText = `Endgame unlocked. New Game+ Tier ${Math.max(0, S.storyNgPlusTier || 0)} available.`;
    }
  }
  if(campaignBtn){
    campaignBtn.className = variant === STORY_VARIANTS.CAMPAIGN ? "good" : "ghost";
    campaignBtn.disabled = false;
  }
  if(ngBtn){
    ngBtn.className = unlocked ? "ghost" : "bad";
    ngBtn.disabled = !unlocked;
    ngBtn.innerText = `🧬 New Game+ (${Math.max(0, S.storyNgPlusTier || 0)})`;
  }
  if(gauntletBtn){
    gauntletBtn.className = variant === STORY_VARIANTS.GAUNTLET ? "good" : "ghost";
    gauntletBtn.disabled = !unlocked;
  }
  if(eliteBtn){
    eliteBtn.className = variant === STORY_VARIANTS.ELITE_HUNT ? "good" : "ghost";
    eliteBtn.disabled = !unlocked;
  }
  if(eliteChapterBtn){
    eliteChapterBtn.disabled = !unlocked;
    eliteChapterBtn.innerText = `🗺️ Hunt Chapter ${clamp(Math.floor(Number(S.eliteHuntChapter || 1)), 1, 10)}`;
  }
}
function markModeTabs(){
  ["mStory","mArcade","mSurvival"].forEach(id=>document.getElementById(id).classList.remove("active"));
  if(S.mode==="Story") document.getElementById("mStory").classList.add("active");
  if(S.mode==="Arcade") document.getElementById("mArcade").classList.add("active");
  if(S.mode==="Survival") document.getElementById("mSurvival").classList.add("active");
}
function updateModeDesc(){
  ensureClanState(S);
  ensureStoryEndgameState(S);
  ensureArcadeWeeklySeedState(S);
  const el=document.getElementById("modeDesc");
  if(S.mode==="Story"){
    const mission = storyMissionForState(S);
    const variant = normalizeStoryVariant(mission.storyVariant);
    if(variant === STORY_VARIANTS.GAUNTLET){
      el.innerText = `Endless Chapter Gauntlet: looped chapter runs with rising pressure. Current Run ${mission.runIndex}, Loop ${mission.gauntletLoop || 1}.`;
    } else if(variant === STORY_VARIANTS.ELITE_HUNT){
      el.innerText = `Elite Boss Hunts: chapter-targeted boss encounters with high payouts. Current target: Chapter ${mission.chapter}.`;
    } else {
      const ngTier = Math.max(0, Math.floor(Number(S.storyNgPlusTier || 0)));
      el.innerText = ngTier > 0
        ? `Story Campaign New Game+ ${ngTier}: harder chapter operations with boosted rewards.`
        : "Story Campaign: chapter-based operations with escort/protect pressure, boss intros, and steady chapter rewards.";
    }
  }
  else if(S.mode==="Arcade"){
    const wk = S.arcadeWeeklySeedKey || weeklyChallengeWeekKey();
    const weeklyBest = arcadeWeeklyBestForWeek(S, wk);
    if(S.arcadeWeeklySeedEnabled){
      const bestText = weeklyBest
        ? ` Best: ${weeklyBest.score.toLocaleString()} pts • ${weeklyBest.civiliansSaved}/${weeklyBest.civiliansTotal} saved • ${weeklyBest.clearSec}s.`
        : " No run submitted yet this week.";
      el.innerText = `Arcade Weekly Seed Challenge (${wk}): all players get the same mission seed and compete on score, clear time, and civilians saved.${bestText}${S.clanRaidEnabled ? " Co-op Raid is ON." : " Co-op Raid is OFF."}`;
    }else{
      el.innerText=`Arcade Campaign: score-attack missions with a live timer, combo multiplier pressure, and medal ranking on clear.${S.clanRaidEnabled ? " Co-op Raid is ON." : " Co-op Raid is OFF."}`;
    }
  }
  else el.innerText="Survival: no civilians. Tigers pressure-damage you. Events OFF.";
  const clanStatus = document.getElementById("modeClanStatus");
  if(clanStatus){
    const cloud = (S.clanCloud && typeof S.clanCloud === "object") ? S.clanCloud : null;
    const rankTxt = Number.isFinite(Number(cloud?.rank)) && Number(cloud.rank) > 0 ? `#${Number(cloud.rank)}` : "—";
    const members = Math.max(1, Math.floor(Number(cloud?.members || 1)));
    const score = Math.max(0, Math.floor(Number(cloud?.score || 0)));
    clanStatus.innerText = `Clan ${S.clanName} [${S.clanTag}] • Rank ${rankTxt} • ${members} member${members===1?"":"s"} • ${score.toLocaleString()} pts`;
  }
  const raidBtn = document.getElementById("modeRaidBtn");
  if(raidBtn){
    raidBtn.innerText = `🤝 Co-op Raid: ${S.clanRaidEnabled ? "ON" : "OFF"}`;
    raidBtn.className = S.clanRaidEnabled ? "good" : "ghost";
  }
  const weeklyBtn = document.getElementById("modeWeeklySeedBtn");
  if(weeklyBtn){
    weeklyBtn.innerText = `🎯 Weekly Seed Challenge: ${S.arcadeWeeklySeedEnabled ? "ON" : "OFF"}`;
    weeklyBtn.className = (S.mode === "Arcade" && S.arcadeWeeklySeedEnabled) ? "good" : "ghost";
  }
  updateStoryEndgameControls();
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
  ensureSeasonShopTab();
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
    renderCompleteRecapCard();
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
    renderCompleteRecapCard();
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
function ensureSeasonShopTab(){
  let tab = document.getElementById("tabSeason");
  if(tab) return tab;
  const tabsWrap = document.querySelector("#shopOverlay .tabs");
  if(!tabsWrap) return null;

  tab = document.createElement("button");
  tab.className = "tab";
  tab.id = "tabSeason";
  tab.type = "button";
  tab.innerText = "Season";
  tab.addEventListener("click", ()=>shopTab("season"));

  const metaTab = document.getElementById("tabMeta");
  if(metaTab && metaTab.parentElement === tabsWrap){
    tabsWrap.insertBefore(tab, metaTab.nextSibling);
  } else {
    tabsWrap.appendChild(tab);
  }
  return tab;
}

function shopTab(tab){
  ensureSquadShopTab();
  ensureMetaShopTab();
  ensureSeasonShopTab();
  currentShopTab=tab;
  ["tabWeapons","tabAmmo","tabArmor","tabMeds","tabSquad","tabMeta","tabSeason","tabStars","tabCash","tabPremium","tabTools","tabTraps"].forEach((id)=>{
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
    season:"tabSeason",
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
  ensureWeaponMasteryState();
  document.getElementById("shopMoney").innerText = S.funds.toLocaleString();
  const list=document.getElementById("shopList");
  const note=document.getElementById("shopNote");

  if(currentShopTab==="weapons"){
    note.innerText="Weapons show Owned/Not owned. Money updates live.";
    list.innerHTML = WEAPONS.map(w=>{
      const owned = S.ownedWeapons.includes(w.id);
      const mastery = weaponMasteryProgress(w.id);
      const masteryText = owned ? ` • Mastery Lv ${mastery.level}/${WEAPON_MASTERY_MAX_LEVEL}` : "";
      return `
        <div class="item">
          <div>
            <div class="itemName">${w.name} <span class="tag">${w.grade}</span> <span class="tag">${owned?'Owned':'Not owned'}</span></div>
            <div class="itemDesc">Ammo: ${w.ammo} • Mag: ${w.mag} • Damage: ${w.dmg[0]}–${w.dmg[1]}${masteryText}</div>
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
    const mastery = ensureMasteryRewardsState(S);
    const pass = ensureSeasonPassState(S);
    const storyModeLive = S.mode === "Story";
    note.innerText = storyModeLive
      ? "Meta progression is active. Base upgrades, specialist perks, and chapter rewards affect Story missions. Mastery rewards are permanent cosmetics only."
      : "Meta progression purchases are persistent, but effects apply in Story missions. Mastery rewards stay cosmetic-only.";

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

    const masteryCards = MASTERY_TRACKS.map((track)=>{
      const progress = masteryTrackProgress(track, S);
      const target = Math.max(1, Math.floor(Number(track.target || 1)));
      const pct = clamp((progress / target) * 100, 0, 100);
      const claimed = masteryTrackClaimed(track.id, S);
      const ready = progress >= target;
      const statusTag = claimed ? "Claimed" : (ready ? "Ready" : `${Math.min(progress, target)}/${target}`);
      const metricText = `${masteryMetricLabel(track.metric)} ${Math.min(progress, target)}/${target}`;
      const rewardText = masteryRewardLabel(track);

      let actionBtn = "";
      if(claimed){
        if(track.type === "elite_title"){
          const equipped = mastery.equippedEliteTitle === track.rewardId;
          actionBtn = `<button ${equipped ? "disabled" : ""} onclick="equipMasteryEliteTitle('${track.rewardId}')">${equipped ? "Equipped" : "Equip Title"}</button>`;
        }else{
          const equipped = pass.equipped?.[track.type] === track.rewardId;
          actionBtn = `<button ${equipped ? "disabled" : ""} onclick="equipSeasonPassCosmetic('${track.type}','${track.rewardId}')">${equipped ? "Equipped" : "Equip"}</button>`;
        }
      }else{
        actionBtn = `<button ${ready ? "" : "disabled"} onclick="claimMasteryReward('${track.id}')">${ready ? "Claim" : "Locked"}</button>`;
      }

      return `
        <div class="item">
          <div>
            <div class="itemName">${track.name} <span class="tag">${statusTag}</span></div>
            <div class="itemDesc">${track.desc}</div>
            <div class="itemDesc">Reward: ${rewardText}</div>
            <div class="itemDesc">${metricText}</div>
            <div class="bar"><div class="fill green" style="width:${pct}%"></div></div>
          </div>
          <div style="text-align:right">
            ${actionBtn}
          </div>
        </div>`;
    }).join("");
    const eliteTitle = masteryEliteTitleDisplay(S);
    const eliteName = eliteTitle ? `${eliteTitle.icon} ${eliteTitle.name}` : "Base title only";

    list.innerHTML = `
      <div class="hudTitle">Base Upgrades (Story)</div>
      ${baseCards}
      <div class="divider"></div>
      <div class="hudTitle">Specialist Perks (Story)</div>
      ${specialistCards}
      <div class="divider"></div>
      <div class="hudTitle">Chapter Rewards (${chapterRewardUnlockedCount()}/${STORY_CHAPTER_REWARDS.length})</div>
      ${rewardCards}
      <div class="divider"></div>
      <div class="hudTitle">Mastery Rewards (${masteryClaimedCount(S)}/${MASTERY_TRACKS.length})</div>
      <div class="item">
        <div>
          <div class="itemName">Long-Term Meta Goals <span class="tag">Cosmetic Only</span></div>
          <div class="itemDesc">Permanent unlock tracks for skins, banners, finishers, and elite titles. No stat boosts.</div>
          <div class="itemDesc">Equipped elite title: <b>${eliteName}</b></div>
        </div>
        <div style="text-align:right">
          <button class="ghost" onclick="equipMasteryEliteTitle('')">Use Base Title</button>
        </div>
      </div>
      ${masteryCards}
    `;
    return;
  }

  if(currentShopTab==="season"){
    const pass = ensureSeasonPassState();
    const levelNow = seasonPassLevel(pass);
    const progressPct = seasonPassProgressPct(pass);
    const pointsNow = Math.max(0, Math.floor(Number(pass.points || 0)));
    const pointsInLevel = pointsNow % SEASON_PASS_POINTS_PER_LEVEL;
    const nextLevel = Math.min(SEASON_PASS_MAX_LEVEL, levelNow + 1);
    const remainingForNext = levelNow >= SEASON_PASS_MAX_LEVEL
      ? 0
      : Math.max(0, SEASON_PASS_POINTS_PER_LEVEL - pointsInLevel);
    const skin = SEASON_PASS_SKINS[pass.equipped.skin] || SEASON_PASS_SKINS.SKIN_FIELD_STANDARD;
    const badge = seasonPassBadgeDisplay(pass);
    const banner = seasonPassBannerDisplay(pass);
    const finisher = seasonPassFinisherDisplay(pass);
    note.innerText = "Season Pass is cosmetic-only: skins, badges, banners, and finisher effects. No stat boosts.";

    const premiumHeader = `
      <div class="item">
        <div>
          <div class="itemName">Season Pass: Jungle Ascent <span class="tag">Lv ${levelNow}/${SEASON_PASS_MAX_LEVEL}</span> <span class="tag">${pass.premium ? "Premium Unlocked" : "Free Track Active"}</span></div>
          <div class="itemDesc">Points: ${pointsNow} • ${levelNow >= SEASON_PASS_MAX_LEVEL ? "Max level reached." : `${remainingForNext} points to Level ${nextLevel}.`}</div>
          <div class="bar"><div class="fill green" style="width:${levelNow >= SEASON_PASS_MAX_LEVEL ? 100 : progressPct}%"></div></div>
          <div class="itemDesc">Equipped: 🎨 ${skin.name} • ${badge.icon} ${badge.name} • 🏳️ ${banner.name} • ${finisher.icon || "✨"} ${finisher.name}</div>
        </div>
        <div style="text-align:right">
          <div class="price">${pass.premium ? "Premium Active" : `$${SEASON_PASS_PREMIUM_PRICE.toLocaleString()}`}</div>
          <button onclick="unlockSeasonPremium()" ${pass.premium ? "disabled" : ""}>${pass.premium ? "Unlocked" : "Unlock Premium"}</button>
        </div>
      </div>`;

    const tierRows = SEASON_PASS_TRACK.map((tier)=>{
      const freeReward = tier.free;
      const premiumReward = tier.premium;
      const freeInfo = seasonRewardDef(freeReward.type, freeReward.id);
      const premiumInfo = seasonRewardDef(premiumReward.type, premiumReward.id);
      const freeClaimed = seasonPassClaimed(pass, tier.level, "free");
      const premiumClaimed = seasonPassClaimed(pass, tier.level, "premium");
      const freeEquipped = pass.equipped?.[freeReward.type] === freeReward.id;
      const premiumEquipped = pass.equipped?.[premiumReward.type] === premiumReward.id;
      const freeCanClaim = !freeClaimed && levelNow >= tier.level;
      const premiumCanClaim = pass.premium && !premiumClaimed && levelNow >= tier.level;
      const premiumLockedText = !pass.premium
        ? "Premium Locked"
        : (levelNow >= tier.level ? "Claim Available" : `Unlocks Lv ${tier.level}`);

      const freeButton = freeClaimed
        ? `<button ${freeEquipped ? "disabled" : ""} onclick="equipSeasonPassCosmetic('${freeReward.type}','${freeReward.id}')">${freeEquipped ? "Equipped" : "Equip"}</button>`
        : `<button ${freeCanClaim ? "" : "disabled"} onclick="claimSeasonPassReward(${tier.level},'free')">${freeCanClaim ? "Claim" : `Lv ${tier.level}`}</button>`;

      const premiumButton = premiumClaimed
        ? `<button ${premiumEquipped ? "disabled" : ""} onclick="equipSeasonPassCosmetic('${premiumReward.type}','${premiumReward.id}')">${premiumEquipped ? "Equipped" : "Equip"}</button>`
        : `<button ${premiumCanClaim ? "" : "disabled"} onclick="claimSeasonPassReward(${tier.level},'premium')">${premiumCanClaim ? "Claim" : (pass.premium ? `Lv ${tier.level}` : "Premium")}</button>`;

      return `
        <div class="item">
          <div>
            <div class="itemName">Tier ${tier.level} <span class="tag">${levelNow >= tier.level ? "Unlocked" : "Locked"}</span></div>
            <div class="itemDesc">FREE • ${(SEASON_PASS_TYPE_ICON[freeReward.type] || "🎁")} ${freeInfo?.name || freeReward.id} <span class="tag">${freeClaimed ? "Claimed" : (freeCanClaim ? "Ready" : "Pending")}</span></div>
            <div class="itemDesc">PREMIUM • ${(SEASON_PASS_TYPE_ICON[premiumReward.type] || "🎁")} ${premiumInfo?.name || premiumReward.id} <span class="tag">${premiumClaimed ? "Claimed" : premiumLockedText}</span></div>
          </div>
          <div style="text-align:right;display:grid;gap:8px;justify-items:end;">
            ${freeButton}
            ${premiumButton}
          </div>
        </div>`;
    }).join("");

    list.innerHTML = premiumHeader + tierRows;
    return;
  }

  if(currentShopTab==="stars"){
    const quickTargets = [100, 150, 250, 350];
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
  ensureWeaponMasteryState();
  if(!Number.isFinite(Number(S.weaponMastery[w.id]))){
    S.weaponMastery[w.id] = 0;
  }
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
  renderCombatControls();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
}
function buyMed(id){
  const m=getMed(id); if(!m) return;
  if(S.funds < m.price) return toast("Not enough money.");
  if(!S.medkits || typeof S.medkits !== "object") S.medkits = {};
  S.funds -= m.price;
  S.medkits[id] = (S.medkits[id]||0)+1;
  let healed = 0;
  let used = 0;
  if(S.hp < 100){
    const hpBefore = clamp(Number(S.hp) || 0, 0, 100);
    S.medkits[id] = Math.max(0, (S.medkits[id] || 0) - 1);
    S.hp = clamp(hpBefore + (m.heal || 0), 0, 100);
    healed = Math.max(0, Math.round(S.hp - hpBefore));
    used = 1;
  }
  const owned = S.medkits[id] || 0;
  toast(
    used > 0
      ? `${m.name} bought and auto-used. Healed +${healed}. ${medTierLabel(m.id)} owned: ${owned}.`
      : `${m.name} bought. ${medTierLabel(m.id)} owned: ${owned}.`
  );
  sfx("ui"); hapticImpact("light");
  save();
  renderShopList();
  renderHUD();
  renderCombatControls();
  if(document.getElementById("invOverlay").style.display==="flex") renderInventory();
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
  ensureWeaponMasteryState();
  const mastery = ensureMasteryRewardsState(S);
  syncSquadRosterBounds();
  const w=equippedWeapon();
  const ammoId=w.ammo;
  const baseRanks = STORY_BASE_UPGRADES.reduce((n, def)=>n + storyBaseRank(def.key), 0);
  const baseMaxRanks = STORY_BASE_UPGRADES.reduce((n, def)=>n + def.maxRank, 0);
  const specialistRanks = STORY_SPECIALIST_PERKS.reduce((n, def)=>n + storySpecialistRank(def.key), 0);
  const specialistMaxRanks = STORY_SPECIALIST_PERKS.reduce((n, def)=>n + def.maxRank, 0);
  const chapterRewards = chapterRewardUnlockedCount();
  const masteryCount = masteryClaimedCount(S);
  const eliteTitle = masteryEliteTitleDisplay(S);
  const eliteTitleTxt = eliteTitle ? `${eliteTitle.icon} ${eliteTitle.name}` : "Base title";
  document.getElementById("invSummary").innerHTML =
    `<b>Money:</b> $${S.funds.toLocaleString()} • <b>HP:</b> ${Math.round(S.hp)}/100 • <b>Armor:</b> ${Math.round(S.armor)}/${S.armorCap}<br>
     <b>Equipped:</b> ${w.name} • <b>Durability:</b> ${Math.round(weaponDurability(w.id))}% • <b>Ammo:</b> ${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[ammoId]||0}) • <b>Shields:</b> ${S.shields||0} • <b>Armor Plates:</b> ${totalArmorPlates()}<br>
     <b>Squad:</b> Attack ${squadAliveCount("attacker")}/${squadOwnedCount("attacker")} (down ${squadDownedCount("attacker")}) • Rescue ${squadAliveCount("rescue")}/${squadOwnedCount("rescue")} (down ${squadDownedCount("rescue")})<br>
     <b>Story Meta:</b> Base ${baseRanks}/${baseMaxRanks} • Specialist ${specialistRanks}/${specialistMaxRanks} • Chapter Rewards ${chapterRewards}/${STORY_CHAPTER_REWARDS.length}<br>
     <b>Mastery:</b> ${masteryCount}/${MASTERY_TRACKS.length} claimed • <b>Elite Title:</b> ${eliteTitleTxt}`;

  document.getElementById("invWeapons").innerHTML = S.ownedWeapons.map(id=>{
    const ww=getWeapon(id);
    const active=(id===S.equippedWeaponId);
    const dur=Math.round(weaponDurability(id));
    const mastery = weaponMasteryProgress(id);
    const jamCut = Math.round((1 - weaponMasteryJamMul(id)) * 100);
    const reloadSmooth = Math.round(weaponMasteryReloadBonus(id) * 100);
    const xpTxt = mastery.nextXp == null
      ? `${mastery.xp} XP (MAX)`
      : `${mastery.xp}/${mastery.nextXp} XP`;
    return `
      <div class="item">
        <div>
          <div class="itemName">${active?'✅ ':''}${ww.name} <span class="tag">${ww.grade}</span></div>
          <div class="itemDesc">Ammo: ${ww.ammo} • Mag: ${ww.mag} • Durability: ${dur}%</div>
          <div class="itemDesc">Mastery Lv ${mastery.level}/${WEAPON_MASTERY_MAX_LEVEL} • ${xpTxt} • Anti-jam ${jamCut}% • Reload smooth +${reloadSmooth}%</div>
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
    { key:"H_CRIT", name:"Deadeye", detail:(r)=>`+${(r*1.25).toFixed(2)}% Crit Chance` },
    { key:"H_DMG", name:"Damage Boost", detail:(r)=>`+${(r*2.5).toFixed(1)}% Weapon Damage` },
    { key:"H_JAM", name:"Anti-Jam", detail:(r)=>`-${(r*8).toFixed(0)}% Jam Chance` },
    { key:"G_CIV_GUARD", name:"Civilian Guard", detail:(r)=>`-${(r*8).toFixed(0)}% Civilian Damage Taken` },
    { key:"G_ARMOR", name:"Armor Efficiency", detail:(r)=>`+${(r*3).toFixed(0)}% Armor Effectiveness` },
    { key:"T_TRAPS", name:"Trap Expansion", detail:(r)=>`+${(r*6).toFixed(0)}% Trap Radius` },
    { key:"T_RELOAD", name:"Reload Boost", detail:(r)=>`+${(r*6).toFixed(0)}% Reload Efficiency` },
  ];
  const perkHtml = perkRows.map((p)=>{
    const rank = perkRank(p.key);
    const gate = perkUpgradeGate(p.key);
    const canSpend = (S.perkPoints > 0) && gate.ok;
    const lockNote = !gate.ok ? `<div class="itemDesc">${gate.reason}</div>` : "";
    return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">${p.name} <span class="tag">Rank ${rank}/${PERK_MAX_RANK}</span></div>
          <div class="itemDesc">${p.detail(rank)}</div>
          ${lockNote}
        </div>
        <div style="text-align:right">
          <button ${canSpend?'':'disabled'} title="${gate.reason || ''}" onclick="buyPerk('${p.key}')">Upgrade</button>
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
  ensureContractsState(S);
  ensureLiveOpsState(S);
  const liveOpsCurrent = liveOpsEntry(S);
  const liveOpsSectionHtml = (() => {
    if(!liveOpsCurrent){
      return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">Weekly Live Ops <span class="tag">Unavailable</span></div>
          <div class="itemDesc">No active operation found. Check back in a moment.</div>
        </div>
      </div>`;
    }
    const progress = Math.min(liveOpsCurrent.target, liveOpsEntryProgress(liveOpsCurrent, S));
    const ready = liveOpsEntryIsReady(liveOpsCurrent, S);
    const statusTag = liveOpsCurrent.claimed ? "Claimed" : (ready ? "Ready" : `${progress}/${liveOpsCurrent.target}`);
    const claimDisabled = liveOpsCurrent.claimed || !ready;
    return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">${liveOpsCurrent.title} <span class="tag">${statusTag}</span></div>
          <div class="itemDesc">${liveOpsCurrent.desc}</div>
          <div class="itemDesc">Reward: ${liveOpsRewardText(liveOpsCurrent.reward)} • Reset in ${contractCountdownText("weekly")}</div>
        </div>
        <div style="text-align:right">
          <button ${claimDisabled ? "disabled" : ""} onclick="claimLiveOps()">${liveOpsCurrent.claimed ? "Claimed" : "Claim"}</button>
        </div>
      </div>`;
  })();
  const contractSectionHtml = ["daily", "weekly"].map((period)=>{
    const summary = contractSummary(period, S);
    const entries = Array.isArray(S?.contracts?.[period]?.entries) ? S.contracts[period].entries : [];
    const periodLabel = period === "weekly" ? "Weekly Contracts" : "Daily Contracts";
    const resetTxt = contractCountdownText(period);
    const rows = entries.map((entry)=>{
      const progress = Math.min(entry.target, contractEntryProgress(entry, S));
      const ready = !entry.claimed && progress >= entry.target;
      const statusTag = entry.claimed ? "Claimed" : (ready ? "Ready" : `${progress}/${entry.target}`);
      const claimDisabled = entry.claimed || !ready;
      return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">${entry.title} <span class="tag">${statusTag}</span></div>
          <div class="itemDesc">${entry.desc}</div>
          <div class="itemDesc">Reward: ${contractRewardText(entry.reward)}</div>
        </div>
        <div style="text-align:right">
          <button ${claimDisabled ? "disabled" : ""} onclick="claimContract('${period}','${entry.id}')">${entry.claimed ? "Claimed" : "Claim"}</button>
        </div>
      </div>`;
    }).join("");
    return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">${periodLabel} <span class="tag">${summary.claimed}/${summary.total} claimed</span> <span class="tag">${summary.ready} ready</span></div>
          <div class="itemDesc">Resets in ${resetTxt}.</div>
        </div>
        <div style="text-align:right">
          <button class="ghost" ${summary.ready <= 0 ? "disabled" : ""} onclick="claimAllContracts('${period}')">Claim All Ready</button>
        </div>
      </div>
      ${rows}
    `;
  }).join("");

  ensureClanState(S);
  const clanContracts = clanContractsForUi(S);
  const clanCloud = (S.clanCloud && typeof S.clanCloud === "object") ? S.clanCloud : null;
  const clanRankTxt = Number.isFinite(Number(clanCloud?.rank)) && Number(clanCloud.rank) > 0 ? `#${Number(clanCloud.rank)}` : "—";
  const clanMembers = Math.max(1, Math.floor(Number(clanCloud?.members || 1)));
  const clanScore = Math.max(0, Math.floor(Number(clanCloud?.score || 0)));
  const clanPeriod = String(clanCloud?.contracts?.period || clanContracts?.[0]?.period || contractWeekKey());
  const clanRowsHtml = clanContracts.map((entry)=>{
    const progress = Math.max(0, Math.floor(Number(entry.progress || 0)));
    const target = Math.max(1, Math.floor(Number(entry.target || 1)));
    const ready = progress >= target;
    const claimed = clanContractClaimed(entry.period, entry.id, S);
    const status = claimed ? "Claimed" : (ready ? "Ready" : `${progress}/${target}`);
    return `
      <div class="item" style="padding:10px 12px;">
        <div>
          <div class="itemName">${entry.title} <span class="tag">${status}</span></div>
          <div class="itemDesc">${entry.desc}</div>
          <div class="itemDesc">Reward: ${contractRewardText(entry.reward)}</div>
        </div>
        <div style="text-align:right">
          <button ${(claimed || !ready) ? "disabled" : ""} onclick="claimClanContract('${entry.id}')">${claimed ? "Claimed" : "Claim"}</button>
        </div>
      </div>`;
  }).join("");

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
    <div class="hudTitle" id="invClanAnchor">Clan + Co-op Raid</div>
    <div class="item" style="padding:10px 12px;">
      <div>
        <div class="itemName">${S.clanName} <span class="tag">[${S.clanTag}]</span> <span class="tag">Rank ${clanRankTxt}</span></div>
        <div class="itemDesc">Clan score: ${clanScore.toLocaleString()} • Members: ${clanMembers}</div>
        <div class="itemDesc">Co-op raid mode: <b>${S.clanRaidEnabled ? "ON" : "OFF"}</b> (Arcade only, deploys 2-player wingman support)</div>
        <div class="itemDesc">Clan contract period: ${clanPeriod} • ${S.clanCloud ? "shared progress via cloud sync" : "local progress fallback"}</div>
      </div>
      <div style="text-align:right">
        <button class="ghost" onclick="setClanTagPrompt()">Set Tag</button>
        <button class="ghost" onclick="setClanNamePrompt()">Rename</button>
        <button class="${S.clanRaidEnabled ? "good" : "ghost"}" onclick="toggleRaidMode()">${S.clanRaidEnabled ? "Raid ON" : "Raid OFF"}</button>
        <button class="ghost" onclick="refreshClanCloudNow()">Refresh</button>
      </div>
    </div>
    ${clanRowsHtml}

    <div class="divider"></div>
    <div class="hudTitle" id="invLiveOpsAnchor">Live Ops</div>
    ${liveOpsSectionHtml}

    <div class="divider"></div>
    <div class="hudTitle" id="invContractsAnchor">Contracts</div>
    ${contractSectionHtml}

    <div class="divider"></div>
    <div class="item" style="padding:10px 12px;">
      <div>
        <div class="itemName">Progression</div>
        <div class="itemDesc"><b>Level:</b> ${S.level} • <b>XP:</b> ${S.xp}/${xpNeededForLevel(S.level)} • <b>Perk Points:</b> ${S.perkPoints}</div>
        <div class="itemDesc"><b>Unlocks:</b> ${progressionUnlockCount()}/${PROGRESSION_UNLOCKS.length} • ${progressText}</div>
        <div class="itemDesc"><b>Story Meta:</b> ${metaBits.join(" • ") || "No upgrades yet"} • Rewards ${chapterRewards}/${STORY_CHAPTER_REWARDS.length}</div>
        <div class="itemDesc"><b>Mastery Rewards:</b> ${masteryCount}/${MASTERY_TRACKS.length} • <b>Elite Title:</b> ${eliteTitleTxt}</div>
      </div>
      <div style="text-align:right">
        <button class="ghost" onclick="openShopFromInventory('meta')">Meta Shop</button>
        <button class="ghost" onclick="equipMasteryEliteTitle('')">Use Base Title</button>
      </div>
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

function canQuickUseArmorPlate(){
  if(S.paused || S.missionEnded || S.gameOver) return false;
  if(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) return false;
  return totalArmorPlates() > 0 && S.armor < S.armorCap;
}
function protectActionMode(){
  const tutorialNeedsShield = !!(window.TigerTutorial?.isRunning && window.TigerTutorial.currentKey === "shield");
  if(!tutorialNeedsShield && canQuickUseArmorPlate()) return "armor";
  return "shield";
}
function renderProtectActionButtons(){
  const mode = protectActionMode();
  const armorCount = totalArmorPlates();
  const shieldCount = Math.max(0, S.shields || 0);
  document.querySelectorAll("[data-shield-btn]").forEach((btn)=>{
    if(!btn) return;
    const touch = btn.classList?.contains("touchBtn");
    btn.classList.toggle("protectArmorMode", mode === "armor");
    btn.classList.toggle("protectShieldMode", mode === "shield");
    btn.dataset.protectMode = mode;
    if(touch){
      const iconEl = btn.querySelector(".touchBtnIcon");
      const labelEl = btn.querySelector(".touchBtnLabel");
      if(iconEl) iconEl.innerText = "🛡️";
      if(labelEl) labelEl.innerText = mode === "armor" ? "Armor" : "Shield";
      btn.title = mode === "armor"
        ? `Use armor plate (${armorCount} available)`
        : `Activate escort shield (${shieldCount} left)`;
      return;
    }
    btn.innerText = mode === "armor"
      ? `🛡️ Armor (${armorCount})`
      : `🛡️ Shield (${shieldCount})`;
    btn.dataset.baseText = btn.innerText;
    btn.title = mode === "armor"
      ? `Use armor plate (${armorCount} available)`
      : `Activate escort shield (${shieldCount} left)`;
  });
}
function useProtectAction(){
  if(protectActionMode() === "armor"){
    return useArmorPlate({ smart:true });
  }
  return activateShield();
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
  addContractTally("trapsPlaced", 1);
  if(!Array.isArray(S.trapsPlaced)) S.trapsPlaced = [];
  if(S.trapsPlaced.length >= MAX_PERSIST_TRAPS) S.trapsPlaced.shift();

  S.trapsPlaced.push({
    id: Date.now() + Math.random(),
    x: S.me.x,
    y: S.me.y,
    r: 80 * perkTrapScale() * arcadeBuildcraftMul("trapRadiusMul", 1),
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

    const holdMs = Math.round(rand(3000, 5000) * arcadeBuildcraftMul("trapHoldMul", 1));
    tgt.holdUntil = now + holdMs;
    tgt.vx = 0; tgt.vy = 0;
    tgt._held = true;

    tr.used = true;
    tr.removeAt = tgt.holdUntil;
    S.stats.trapsTriggered = (S.stats.trapsTriggered || 0) + 1;
    addContractTally("trapsTriggered", 1);

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
  return clamp((g.jamBase + wearFactor*0.18) * perkJamMul() * weaponMasteryJamMul(w.id), 0, 0.28);
}
function autoReloadIfNeeded(force=false){
  const w=equippedWeapon();
  if(!force && S.mag.loaded>0) return true;
  const reserve = S.ammoReserve[w.ammo] || 0;
  if(reserve<=0) return false;
  const need = S.mag.cap - S.mag.loaded;
  const take = Math.min(need, reserve);
  const handlingBonus = clamp(perkReloadBonus() + weaponMasteryReloadBonus(w.id), 0, 0.72);
  const bonus = Math.min(need - take, Math.floor(take * handlingBonus));
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

  ["battleOverlay","shopOverlay","invOverlay","completeOverlay","overOverlay","weaponQuickOverlay","launchIntroOverlay","dailyRewardOverlay","storyIntroOverlay","missionBriefOverlay","hudOverlay"].forEach((id)=>{
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
  const worldW = worldWidth(S);
  const worldH = worldHeight(S);
  const r = 70;
  const minX = 110;
  const maxX = worldW - 90;
  const minY = 120;
  const maxY = worldH - 90;
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
          targetX:worldW * 0.44,
          targetY:worldH * 0.56
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
      targetX:worldW * 0.5,
      targetY:worldH * 0.5
    });
    if(dryPoint) zonePoint = dryPoint;
  }
  if(inMapScenarioKeepout(zonePoint.x, zonePoint.y, Math.round(r * 0.85))){
    const clearPoint = findNearestOpenPoint(zonePoint.x, zonePoint.y, Math.round(r * 0.45), {
      avoidKeepout:true,
      avoidWater:true,
      targetX:worldW * 0.40,
      targetY:worldH * 0.55
    });
    if(clearPoint) zonePoint = clearPoint;
  }
  return { x:zonePoint.x, y:zonePoint.y, r };
}

function validateMissionSpawnLayout(opts={}){
  const repair = opts?.repair !== false;
  if(!S || typeof S !== "object") return { fixed:0 };
  const worldW = worldWidth(S);
  const worldH = worldHeight(S);
  if(!(worldW > 100 && worldH > 100)) return { fixed:0 };

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
      const mePt = safeSpawnPoint(worldW * 0.16, worldH * 0.78, 16, true, false);
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
        const pt = pickTigerSpawnAwayFromEscort(tiger.x, tiger.y, {
          ignoreTigerId: tiger.id,
          minTigerDist: 72,
          anchorTight: false
        });
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

  if(r.includes("deploy") || r.includes("complete") || r.includes("over") || r.includes("recover") || r.includes("init")){
    clearTransientCombatVisuals();
    __frameBgFxFlip = 0;
    __frameDynamicLoadMul = FRAME_LOAD_LIGHT;
    __battleHudRenderAt = 0;
    __battleReadabilityRenderAt = 0;
    resetBattleCinematic();
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
  const worldW = worldWidth(S);
  const worldH = worldHeight(S);
  const baseW = WORLD_BASE_WIDTH;
  const h = WORLD_BASE_HEIGHT;
  const toWorldX = (v)=> (v <= 1 ? (v * worldW) : (v * (worldW / baseW)));
  const toWorldY = (v)=> (v <= 1 ? (v * worldH) : (v * (worldH / WORLD_BASE_HEIGHT)));
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
    x: clamp(Math.round(toWorldX(site.x)), 70, worldW - 70),
    y: clamp(Math.round(toWorldY(site.y)), 90, worldH - 80),
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
  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;
  const storyIdx = Math.max(1, Number(storyMission?.number || S.storyLevel || 1));
  const wanted = (S.mode==="Story")
    ? clamp(4 + Math.floor((storyIdx - 1) / 2), 4, 6)
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
  if(missionTwistBlackoutActive(now)){
    toast("Radio blackout active. Map devices offline.");
    return false;
  }
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
    trackCashEarned(cash);
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
  trackCashEarned(bonusCash);
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

const RAID_PARTNER_IDS = Object.freeze({
  attacker:"RAID_PARTNER_ATTACK",
  rescue:"RAID_PARTNER_RESCUE",
});

function createRaidPartnerUnit(role, slotIndex=0){
  const base = createSupportUnit(role, slotIndex);
  const attacker = role === "attacker";
  base.id = attacker ? RAID_PARTNER_IDS.attacker : RAID_PARTNER_IDS.rescue;
  base.name = attacker ? "Co-op Raider" : "Co-op Rescuer";
  base.raidPartner = true;
  base.hpMax = Math.max(base.hpMax, Math.round(base.hpMax * (attacker ? 1.34 : 1.22)));
  base.hp = base.hpMax;
  base.armor = Math.max(base.armor || 0, attacker ? 36 : 20);
  base.guideAt = 0;
  base.fireAt = 0;
  return base;
}

function applyRaidPartnerSlots(units=[]){
  const list = Array.isArray(units) ? units.filter(Boolean) : [];
  if(!raidModeActive(S)){
    return list.filter((unit)=>!unit.raidPartner);
  }

  const core = list.filter((unit)=>!unit.raidPartner);
  const existingA = list.find((unit)=>unit?.id === RAID_PARTNER_IDS.attacker && unit.alive !== false);
  const existingR = list.find((unit)=>unit?.id === RAID_PARTNER_IDS.rescue && unit.alive !== false);
  const raidUnits = [
    existingA || createRaidPartnerUnit("attacker", 0),
    existingR || createRaidPartnerUnit("rescue", 0),
  ];

  raidUnits.forEach((unit, idx)=>{
    const anchorX = S.me.x + (idx === 0 ? -44 : 48);
    const anchorY = S.me.y + 26;
    const pt = safeSpawnPoint(anchorX, anchorY, 16, true, true);
    unit.x = pt.x;
    unit.y = pt.y;
    unit.homeX = S.me.x;
    unit.homeY = S.me.y;
    unit.alive = true;
    if(!Number.isFinite(unit.step)) unit.step = rand(0, 1000);
  });

  const keep = Math.max(0, 16 - raidUnits.length);
  return [...core.slice(0, keep), ...raidUnits];
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

  const coreCap = raidModeActive(S) ? 14 : 16;
  const merged = [...attackers, ...rescuers].slice(0, coreCap);
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
  S.supportUnits = applyRaidPartnerSlots(merged.filter((unit)=>unit.alive));
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

  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;
  const arcadeMission = (S.mode==="Arcade") ? activeArcadeMission(S) : null;
  const n = (S.mode==="Story")
    ? clamp(storyMission?.civilians ?? (3 + ((storyMission?.number || S.storyLevel || 1)-1)), 0, 14)
    : (S.mode==="Arcade"
      ? clamp(arcadeMission?.civilians ?? (2 + (S.arcadeLevel-1)), 0, 14)
      : 0);
  const raidBonusCivs = (S.mode === "Arcade" && raidModeActive(S)) ? 2 : 0;
  const spawnCount = clamp(n + raidBonusCivs, 0, 16);
  const sites = (S.rescueSites?.length ? S.rescueSites : rescueSitePool()).slice();

  S.civilians = [];

  for(let i=0;i<spawnCount;i++){
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

function tigerSpawnTooCloseToEscort(x, y, opts={}){
  const director = ensureMissionDirectorState(S);
  const phase = DIRECTOR_PHASE_CONFIG[director.phase] ? director.phase : DIRECTOR_PHASES.CALM;
  const phaseMul = phase === DIRECTOR_PHASES.PEAK ? 1.12 : (phase === DIRECTOR_PHASES.RECOVER ? 1.04 : (phase === DIRECTOR_PHASES.PRESSURE ? 1.08 : 1));
  const minPlayerDist = Math.max(130, Math.round(Number(opts.minPlayerDist ?? (170 * phaseMul))));
  const minCivDist = Math.max(150, Math.round(Number(opts.minCivDist ?? (220 * phaseMul))));
  const minEvacDist = Math.max(110, Math.round(Number(opts.minEvacDist ?? (150 * phaseMul))));
  const minTigerDist = Math.max(42, Math.round(Number(opts.minTigerDist ?? 62)));
  const ignoreTigerId = Number.isFinite(Number(opts.ignoreTigerId)) ? Number(opts.ignoreTigerId) : null;
  const checkRescueSites = opts.checkRescueSites !== false;
  const checkEvac = opts.checkEvac !== false;

  if(dist(x, y, S.me.x, S.me.y) < minPlayerDist) return true;
  if(S.mode !== "Survival"){
    for(const c of (S.civilians || [])){
      if(!c.alive || c.evac) continue;
      if(dist(x, y, c.x, c.y) < minCivDist) return true;
    }
    if(checkEvac && S.evacZone && Number.isFinite(S.evacZone.x) && Number.isFinite(S.evacZone.y)){
      if(dist(x, y, S.evacZone.x, S.evacZone.y) < minEvacDist) return true;
    }
    if(checkRescueSites){
      for(const site of (S.rescueSites || [])){
        if(!site || !Number.isFinite(site.x) || !Number.isFinite(site.y)) continue;
        const siteR = Math.max(24, Number(site.r || 42) * 0.66);
        if(dist(x, y, site.x, site.y) < siteR) return true;
      }
    }
  }
  for(const t of (S.tigers || [])){
    if(!t || !t.alive) continue;
    if(ignoreTigerId != null && Number(t.id) === ignoreTigerId) continue;
    if(dist(x, y, t.x, t.y) < minTigerDist) return true;
  }
  return false;
}
function pickTigerSpawnAwayFromEscort(seedX, seedY, opts={}){
  const preferX = Number.isFinite(Number(opts.preferX)) ? Number(opts.preferX) : seedX;
  const preferY = Number.isFinite(Number(opts.preferY)) ? Number(opts.preferY) : seedY;
  const radius = Math.max(16, Number(opts.radius || 18));
  const candidates = [];
  const pushCandidate = (x, y)=>{
    const px = clamp(Math.round(x), 70, cv.width - 70);
    const py = clamp(Math.round(y), 90, cv.height - 70);
    const pt = safeSpawnPoint(px, py, radius, true, true);
    candidates.push(pt);
  };

  pushCandidate(seedX, seedY);
  pushCandidate(preferX, preferY);

  for(let i=0; i<28; i++){
    const a = (Math.PI * 2 * i) / 28;
    const rr = 60 + (i % 5) * 34;
    pushCandidate(preferX + Math.cos(a) * rr, preferY + Math.sin(a) * rr);
  }
  for(let i=0; i<40; i++){
    const biasRight = i % 2 === 0;
    const rx = biasRight ? rand(Math.round(cv.width * 0.55), cv.width - 70) : rand(70, Math.round(cv.width * 0.45));
    const ry = rand(90, cv.height - 70);
    pushCandidate(rx, ry);
  }

  let best = null;
  let bestScore = -Infinity;
  let fallback = candidates[0] || safeSpawnPoint(seedX, seedY, radius, true, true);
  for(const pt of candidates){
    fallback = pt || fallback;
    if(!pt) continue;
    const invalid = tigerSpawnTooCloseToEscort(pt.x, pt.y, opts);
    const meDist = dist(pt.x, pt.y, S.me.x, S.me.y);
    let nearestCiv = Infinity;
    if(S.mode !== "Survival"){
      for(const c of (S.civilians || [])){
        if(!c.alive || c.evac) continue;
        nearestCiv = Math.min(nearestCiv, dist(pt.x, pt.y, c.x, c.y));
      }
    }
    let nearestTiger = Infinity;
    for(const t of (S.tigers || [])){
      if(!t || !t.alive) continue;
      if(opts.ignoreTigerId != null && Number(t.id) === Number(opts.ignoreTigerId)) continue;
      nearestTiger = Math.min(nearestTiger, dist(pt.x, pt.y, t.x, t.y));
    }
    const preferPenalty = dist(pt.x, pt.y, preferX, preferY) * (opts.anchorTight ? 0.34 : 0.20);
    const civScore = Number.isFinite(nearestCiv) ? Math.min(nearestCiv, 360) : 260;
    const tigerSpread = Number.isFinite(nearestTiger) ? Math.min(nearestTiger, 260) : 180;
    let score = (meDist * 1.05) + (civScore * 1.25) + (tigerSpread * 0.58) - preferPenalty;
    if(invalid) score -= 900;
    if(score > bestScore){
      bestScore = score;
      best = pt;
    }
  }
  return best || fallback;
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
      bossPhaseIndex:1,
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
      bossStalkUntil:0,
      bossPounceCharges:0,
      bossPounceChainUntil:0,
      bossChargeUntil:0,
      _bossStalkPromptAt:0,
      _bossWarnForSkillAt:0,
      _bossPrefightWarnedAt:0,
      _bossLastTellAt:0,
      _bossLastTellKey:"",
      nemesisId:"",
      nemesisAlias:"",
      nemesisPower:0,
      nemesisScars:0,
      nemesisBehavior:"",
      nemesisBountyCash:0,
      nemesisSpeedMul:1,
      nemesisDamageMul:1,
      nemesisDefenseMul:1,
      nemesisPounceMul:1,
      nemesisReturned:false,
      wanderAngle:Math.random()*(Math.PI*2),
      heading:0,
      drawDir:1,
      gaitState:"walk",
      gaitBlend:0
    }];

    return;
  }

  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;
  const arcadeMission = (S.mode==="Arcade") ? activeArcadeMission(S) : null;
  let count=2;

  if(S.mode==="Story"){
    count = clamp(storyMission?.tigers ?? (2 + Math.max(0,((storyMission?.number || S.storyLevel || 1)-1)-(7-3))), 1, 18);
  }

  if(S.mode==="Arcade"){
    count = clamp(arcadeMission?.tigers ?? (3 + Math.max(0,(S.arcadeLevel-1)-(7-2))), 1, 18);
    if(raidModeActive(S)) count = clamp(count + 1, 1, 19);
  }

  if(S.mode==="Survival")
    count=Math.min(4+(S.survivalWave-1),10);

  const storyBoss=!!(storyMission && storyMission.boss);
  const storyBossCount = storyBoss ? 1 : 0;
  const arcadeBoss=!!(arcadeMission && arcadeMission.boss);
  const arcadeBossCount = arcadeBoss ? 1 : 0;
  if(storyBoss || arcadeBoss) count = 1;
  const storyMissionNo = (S.mode === "Story")
    ? clamp(Math.floor(Number(storyMission?.number || S.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length)
    : 1;
  const nemesisEntry = (S.mode === "Story" && !storyBoss && !window.__TUTORIAL_MODE__)
    ? pickReturningNemesisForMission(storyMissionNo)
    : null;
  const nemesisSlot = nemesisEntry ? rand(Math.max(0, Math.floor(count * 0.45)), Math.max(0, count - 1)) : -1;
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
    if(nemesisEntry && i === nemesisSlot){
      typeKey = nemesisEntry.type || typeKey;
    }

    const def=TIGER_TYPES.find(t=>t.key===typeKey)||TIGER_TYPES[1];

    let baseHp=115;
    if(S.mode==="Arcade") baseHp=125+(S.arcadeLevel-1)*8;
    if(S.mode==="Survival") baseHp=140+(S.survivalWave-1)*12;
    if(S.mode==="Story") baseHp=122+((storyMission?.number || S.storyLevel || 1)-1)*6;

    let hp=Math.round(baseHp*def.hpMul*diff);
    let bossPhases=0;

    if(storyBoss && i < storyBossCount){
      hp = Math.round(hp * (storyMission.finalBoss ? 3.35 : 2.65));
      bossPhases = 3;
    } else if(arcadeBoss && i < arcadeBossCount){
      hp = Math.round(hp * (arcadeMission.finalBoss ? 3.2 : 2.55));
      bossPhases = 3;
    }
    if(S.mode==="Story"){
      hp = Math.round(hp * clamp(Number(storyMission?.endgameHpMul || 1), 1, 6));
    }

    const pack = packAnchors[i % packAnchors.length];
    const theta = (Math.PI * 2 * (i % 3)) / 3;
    const radius = 24 + ((i % 2) * 20);
    const initialVx = (Math.random()<0.5?-1:1)*def.spd*0.55;
    const initialVy = (Math.random()<0.5?-1:1)*def.spd*0.50;
    const tigerSpawn = pickTigerSpawnAwayFromEscort(
      clamp(Math.round(pack.x + Math.cos(theta) * radius + rand(-12,12)), 140, cv.width - 50),
      clamp(Math.round(pack.y + Math.sin(theta) * radius + rand(-12,12)), 90, cv.height - 70),
      {
        preferX: pack.x,
        preferY: pack.y,
        minTigerDist: 58,
        anchorTight: true
      }
    );

    const tigerObj = {
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
      aggroBoost:S.mode==="Story"
        ? clamp((Number(storyMission?.endgameAggroMul || 1) - 1) * 0.26, 0, 0.55)
        : 0,
      civBias:clamp(def.civBias+(diff-1)*0.18,0,0.98),
      stealth:def.stealth,
      rage:def.rage,
      personality:pickTigerPersonality(def.key),
      bossPhases,
      bossPhaseIndex:1,
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
      bossIdentityChapter:storyBoss && storyMission ? clamp(storyMission.chapter || 1, 1, 10) : 0,
      bossStealthUntil:0,
      bossStalkUntil:0,
      bossPounceCharges:0,
      bossPounceChainUntil:0,
      bossChargeUntil:0,
      _bossStalkPromptAt:0,
      _bossWarnForSkillAt:0,
      _bossPrefightWarnedAt:0,
      _bossLastTellAt:0,
      _bossLastTellKey:"",
      nemesisId:"",
      nemesisAlias:"",
      nemesisPower:0,
      nemesisScars:0,
      nemesisBehavior:"",
      nemesisBountyCash:0,
      nemesisSpeedMul:1,
      nemesisDamageMul:1,
      nemesisDefenseMul:1,
      nemesisPounceMul:1,
      nemesisReturned:false,
      wanderAngle:Math.random()*(Math.PI*2),
      heading:Math.atan2(initialVy, initialVx),
      drawDir:initialVx >= 0 ? 1 : -1,
      gaitState:"walk",
      gaitBlend:0
    };
    if(nemesisEntry && i === nemesisSlot){
      applyNemesisEntryToTiger(tigerObj, nemesisEntry, storyMissionNo);
    }
    S.tigers.push(tigerObj);
  }
  if(nemesisEntry){
    setEventText(`☠️ Nemesis returned: ${nemesisEntry.alias} (Lv ${nemesisEntry.power}) • Bounty $${nemesisEntry.bountyCash.toLocaleString()}`, 6.2);
    toast(`Nemesis returned: ${nemesisEntry.alias}`);
  }
}

function spawnRogueTiger(options={}){
  if(!Array.isArray(S.tigers)) S.tigers = [];

  const ignoreDirectorBudget = !!options.ignoreDirectorBudget;
  const aliveCount = S.tigers.reduce((n, t)=>n + (t?.alive ? 1 : 0), 0);
  const capFromDirector = missionDirectorHardCaps().tigers;
  const maxAlive = Math.min((S.mode === "Survival") ? 14 : 10, capFromDirector);
  if(aliveCount >= maxAlive) return null;
  if(!ignoreDirectorBudget && !missionDirectorAllowTigerSpawn(1)) return null;

  const forcedType = (typeof options.typeKey === "string" && TIGER_TYPES.some((t)=>t.key === options.typeKey))
    ? options.typeKey
    : null;
  const typeKey = forcedType || pickTigerType();
  const def = TIGER_TYPES.find((t)=>t.key===typeKey) || TIGER_TYPES[1];
  const diff = carcassDifficulty();
  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;

  let baseHp = 110;
  if(S.mode==="Arcade") baseHp = 122 + (S.arcadeLevel - 1) * 7;
  if(S.mode==="Survival") baseHp = 135 + (S.survivalWave - 1) * 10;
  if(S.mode==="Story") baseHp = 120 + ((storyMission?.number || S.storyLevel || 1) - 1) * 6;
  const hp = Math.round(baseHp * def.hpMul * diff * (S.mode==="Story" ? clamp(Number(storyMission?.endgameHpMul || 1), 1, 6) : 1));

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

  const rogueSpawn = pickTigerSpawnAwayFromEscort(Math.round(sx), Math.round(sy), {
    preferX: sx,
    preferY: sy,
    minTigerDist: Number.isFinite(options.packId) ? 56 : 82,
    anchorTight: !!options.anchorTight
  });
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
    bossPhaseIndex:1,
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
    bossStalkUntil:0,
    bossPounceCharges:0,
    bossPounceChainUntil:0,
    bossChargeUntil:0,
    _bossStalkPromptAt:0,
    _bossWarnForSkillAt:0,
    _bossPrefightWarnedAt:0,
    _bossLastTellAt:0,
    _bossLastTellKey:"",
    nemesisId:"",
    nemesisAlias:"",
    nemesisPower:0,
    nemesisScars:0,
    nemesisBehavior:"",
    nemesisBountyCash:0,
    nemesisSpeedMul:1,
    nemesisDamageMul:1,
    nemesisDefenseMul:1,
    nemesisPounceMul:1,
    nemesisReturned:false,
    wanderAngle:Math.random()*(Math.PI*2),
    heading:0,
    drawDir:1,
    gaitState:"walk",
    gaitBlend:0
  };
  if(S.mode === "Story"){
    tiger.aggroBoost = clamp(
      Number(tiger.aggroBoost || 0) + ((Number(storyMission?.endgameAggroMul || 1) - 1) * 0.22),
      0,
      0.65
    );
  }
  tiger.heading = Math.atan2(tiger.vy, tiger.vx);
  tiger.drawDir = tiger.vx >= 0 ? 1 : -1;

  S.tigers.push(tiger);
  if(!ignoreDirectorBudget) missionDirectorMarkTigerSpawn();
  return tiger;
}
// ===================== DEPLOY / NEXT / RESTART =====================
function deploy(opts={}){
  const carryStats = !!opts.carryStats;
  const carryHp = clamp(Number.isFinite(opts.hp) ? opts.hp : S.hp, 0, 100);
  const carryArmor = clamp(Number.isFinite(opts.armor) ? opts.armor : S.armor, 0, S.armorCap || 100);
  S._mobileMissionStartedAt = Date.now();
  resizeCanvasForViewport();
  invalidateMapCache();
  for(const k of Object.keys(__frameTaskGate)) delete __frameTaskGate[k];
  ensureStoryMetaState();
  if(normalizeModeName(S.mode) !== "Story"){
    clearStoryCheckpointData();
  } else {
    const variant = normalizeStoryVariant(S.storyVariant);
    const slot = readStoryCheckpointData();
    const mission = clamp(Math.floor(Number(S.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
    if(variant !== STORY_VARIANTS.CAMPAIGN){
      clearStoryCheckpointData();
    } else if(slot && storyCheckpointMissionFromPayload(slot) !== mission){
      clearStoryCheckpointData();
    }
  }
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
  {
    const camSnap = cameraClampCenter(S.me.x, S.me.y, S);
    S.camera = { x: camSnap.x, y: camSnap.y };
  }
  S.target=null;
  S.lockedTigerId=null;

  S.civGraceUntil = Date.now() + 1800;
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
  resetMissionTwistsForDeploy(S);
  S._biomeFogPulseAt = 0;
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
  {
    const d = ensureMissionDirectorState(S);
    const storyMission = (S.mode === "Story") ? storyMissionForState(S) : null;
    const startPressure = clamp(
      10 + ((S.mode === "Story")
        ? (((storyMission?.number || S.storyLevel || 1) - 1) * 0.6 * clamp(Number(storyMission?.endgameAggroMul || 1), 1, 2.8))
        : ((S.mode === "Arcade") ? ((S.arcadeLevel - 1) * 0.7) : ((S.survivalWave - 1) * 1.1))),
      8,
      42
    );
    d.phase = DIRECTOR_PHASES.CALM;
    d.pressure = startPressure;
    d.phaseLockUntil = Date.now() + 1200;
    d.lastSampleAt = 0;
    d.hardTrimAt = 0;
    d.phaseChangedAt = Date.now();
    d.lastNoticeAt = 0;
    d.nextSpawnAt = Date.now() + rand(4200, 6800);
    S._directorAggroMul = 1;
    S._directorSpeedMul = 1;
  }
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
    const mission = storyMissionForState(S);
    const variant = normalizeStoryVariant(mission.storyVariant);
    if(mission.lowVisibility){
      S.fogUntil = Date.now() + 120000;
    }
    if(mission.bloodAggro){
      setEventText("Story modifier active: tiger aggression is elevated this mission.", 8);
    } else if(variant === STORY_VARIANTS.CAMPAIGN && ((mission.number - 1) % 10) === 0){
      setEventText(`Story chapter ${mission.chapter} deployed. ${storyChapterRewardPreviewText(mission)}`, 8);
    } else if(variant === STORY_VARIANTS.GAUNTLET){
      setEventText(`♾️ Gauntlet Run ${mission.runIndex} • Loop ${mission.gauntletLoop || 1} • Aggro x${(mission.endgameAggroMul || 1).toFixed(2)}`, 8);
    } else if(variant === STORY_VARIANTS.ELITE_HUNT){
      setEventText(`🎯 Elite Boss Hunt ${mission.runIndex}: Chapter ${mission.chapter} ${mission.bossType || "Alpha"} target`, 8);
    }
    if(mission.boss){
      setEventText(storyBossIntroText(mission), 9);
    }
  }

  if(S.mode==="Arcade"){
    prepareArcadeBuildcraftForMission(S);
    const mission = activeArcadeMission(S);
    let timeLimitSec = 95 + (mission.chapter * 8);
    if(mission.captureOnly) timeLimitSec += 14;
    timeLimitSec += (mission.captureRequired || 0) * 6;
    timeLimitSec += (mission.trapPlaceRequired || 0) * 5;
    timeLimitSec += (mission.trapTriggerRequired || 0) * 5;
    if(mission.boss) timeLimitSec += mission.bossTwin ? 24 : 18;
    if(mission.finalBoss) timeLimitSec += 30;
    if(raidModeActive(S)) timeLimitSec += 20;
    S.arcadeMissionLimitSec = clamp(Math.round(timeLimitSec), 90, 240);
    S.arcadeMissionStartAt = Date.now();
    if(mission.weeklySeed){
      S.arcadeWeeklyRunStartedAt = S.arcadeMissionStartAt;
      S.arcadeWeeklyRunId = `${mission.weeklySeedKey || weeklyChallengeWeekKey()}:${S.arcadeMissionStartAt}`;
    }else{
      S.arcadeWeeklyRunStartedAt = 0;
      S.arcadeWeeklyRunId = "";
    }
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

  const biomeStart = currentBiomeProfile();
  if(biomeStart && !S.eventText){
    setEventText(`🌍 ${biomeStart.biome} • ${biomeStart.weather} • Hazard: ${biomeStart.hazardShort || "adaptive terrain"}`, 7.5);
  }

  if(S.mode==="Survival"){ S.survivalStart = Date.now(); S.surviveSeconds=0; }

  if(shouldShowMissionBrief()) showMissionBrief(rand(2200, 3000));
  else {
    if(normalizeModeName(S.mode) === "Arcade" && !window.__TUTORIAL_MODE__){
      applyArcadeBuildcraftForMission({ silent:true });
    }
    closeMissionBrief(true);
  }

  updateGameOverCheckpointButton();
  markBalanceMissionStart(S);
  save();
}

function startNextMission(){
  document.getElementById("completeOverlay").style.display="none";
  ensureStoryEndgameState(S);
  const carryHp = clamp(S.hp, 0, 100);
  const carryArmor = clamp(S.armor, 0, S.armorCap || 100);
  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;
  const storyVariant = normalizeStoryVariant(S.storyVariant);
  const wasStoryFinal = !!(S.mode==="Story" && storyVariant === STORY_VARIANTS.CAMPAIGN && storyMission && storyMission.number >= STORY_CAMPAIGN_OBJECTIVES.length);
  const wasArcadeFinal = (S.mode==="Arcade" && S.arcadeLevel >= ARCADE_CAMPAIGN_OBJECTIVES.length);
  if(S.mode==="Story"){
    if(storyVariant === STORY_VARIANTS.CAMPAIGN){
      clearStoryCheckpointForMission(S.storyLevel);
      S.storyLevel = Math.min(S.storyLevel + 1, STORY_CAMPAIGN_OBJECTIVES.length);
      S.storyLastMission = Math.max(storyResumeMissionLevel(), S.storyLevel);
    }else if(storyVariant === STORY_VARIANTS.GAUNTLET){
      S.gauntletDepth = Math.max(1, Math.floor(Number(S.gauntletDepth || 1))) + 1;
      S.storyLastMission = Math.max(S.storyLastMission || 1, storyMissionLevelForState(S));
    }else if(storyVariant === STORY_VARIANTS.ELITE_HUNT){
      S.eliteHuntRuns = Math.max(1, Math.floor(Number(S.eliteHuntRuns || 1))) + 1;
      S.eliteHuntsCleared = Math.max(0, Math.floor(Number(S.eliteHuntsCleared || 0))) + 1;
      S.eliteHuntChapter = (clamp(Math.floor(Number(S.eliteHuntChapter || 1)), 1, 10) % 10) + 1;
      S.storyLastMission = Math.max(S.storyLastMission || 1, storyMissionLevelForState(S));
    }
  }
  if(S.mode==="Arcade"){
    ensureArcadeWeeklySeedState(S);
    if(S.arcadeWeeklySeedEnabled){
      S.arcadeWeeklySeedKey = weeklyChallengeWeekKey();
    }else{
      S.arcadeLevel = Math.min(S.arcadeLevel + 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
    }
  }
  if(S.mode==="Survival") S.survivalWave += 1;
  deploy({ carryStats:true, hp:carryHp, armor:carryArmor });
  if(wasStoryFinal) toast("Story campaign complete. Replaying Mission 100.");
  else if(S.mode==="Story" && storyVariant === STORY_VARIANTS.GAUNTLET) toast(`Gauntlet advanced to Run ${S.gauntletDepth}.`);
  else if(S.mode==="Story" && storyVariant === STORY_VARIANTS.ELITE_HUNT) toast(`Elite Hunt advanced. Next target: Chapter ${S.eliteHuntChapter}.`);
  else if(S.mode==="Arcade" && S.arcadeWeeklySeedEnabled) toast(`Weekly Seed Challenge redeployed (${S.arcadeWeeklySeedKey}).`);
  else if(wasArcadeFinal) toast("Arcade campaign complete. Replaying Mission 100.");
  else toast("Next mission started.");
  save(true);
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

  if(mode === "Story"){
    S.storyLevel = 1;
    S.storyLastMission = 1;
    S.storyVariant = STORY_VARIANTS.CAMPAIGN;
    S.gauntletDepth = 1;
    S.eliteHuntChapter = 1;
    S.eliteHuntRuns = 1;
    S.eliteHuntsCleared = 0;
    clearStoryCheckpointData();
    clearStorySaveData();
  }
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
  clearStorySaveData();
  clearStoryCheckpointData();
  S = cloneState(DEFAULT);
  bindFundsWallet(S);
  syncWindowState();
  ["shopOverlay","invOverlay","weaponQuickOverlay","launchIntroOverlay","dailyRewardOverlay","storyIntroOverlay","missionBriefOverlay","aboutOverlay","hudOverlay","completeOverlay","overOverlay","modeOverlay","progressGuardOverlay"].forEach((id)=>{
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
  if(S.gameOver) return;
  if(!S.missionEnded){
    markBalanceMissionResult(false, msg, S);
  }
  S.gameOver = true;
  S.paused = true;
  transitionCleanupSweep("game-over");
  clearTransientCombatVisuals();
  document.getElementById("battleOverlay").style.display="none";
  document.getElementById("completeOverlay").style.display="none";
  lastOverlay=null;

  document.getElementById("overText").innerText = msg + "\n\nChoose:";
  updateGameOverCheckpointButton();
  document.getElementById("overOverlay").style.display="flex";
  sfx("hurt"); hapticNotif("error");
  save();
}

// ===================== INPUT =====================
cv.addEventListener("pointerdown",(e)=>{
  if(e.pointerType==="mouse" && e.button!==0) return;
  e.preventDefault();
  if(isSquadCommandWheelOpen()){
    closeSquadCommandWheel();
    return;
  }

  const rect=cv.getBoundingClientRect();
  const sx=(e.clientX-rect.left)*(cv.width/rect.width);
  const sy=(e.clientY-rect.top)*(cv.height/rect.height);
  const wp = isWorldCameraActive(S) ? screenToWorldPoint(sx, sy, S) : { x:sx, y:sy };
  const x = wp.x;
  const y = wp.y;
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

  const overlays = ["launchIntroOverlay","dailyRewardOverlay","storyIntroOverlay","missionBriefOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay","weaponQuickOverlay","hudOverlay"]
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
  const ids = ["tutorialOverlay","launchIntroOverlay","dailyRewardOverlay","storyIntroOverlay","missionBriefOverlay","overOverlay","completeOverlay","shopOverlay","invOverlay","modeOverlay","aboutOverlay","weaponQuickOverlay","hudOverlay"];
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
    else useProtectAction();
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
  if(missionTwistBlackoutActive(Date.now())) return toast("Radio blackout active. Scan unavailable.");
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
  speed *= frameTimeScale();
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
  speed *= frameTimeScale();
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
  renderCombatControls();
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
  const roleMul = role === "attacker" ? 0.52 : 0.88;
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
  const base = rand(9, 15) + (tigerDist < 100 ? 5 : 2);
  const antiTigerSkill = 1.30;
  const targetResist = 1 - ((rank - 1) * 0.06);
  const boost = storyAttackerDamageMul();
  return Math.max(5, Math.round(base * antiTigerSkill * clamp(targetResist, 0.70, 1.0) * boost));
}

function supportUnitsTick(){
  if(S.paused || S.gameOver || S.missionEnded) return;
  if(!S.supportUnits?.length) return;

  const now = Date.now();
  const lagTier = frameLagTier();
  const supportTickDelay = lagTier >= 2 ? 110 : (lagTier >= 1 ? 84 : 50);
  if(now < (S._supportTickAt || 0)) return;
  S._supportTickAt = now + supportTickDelay;

  const liveCivs = (S.mode==="Survival") ? [] : S.civilians.filter(c=>c.alive && !c.evac);
  const activeTigers = S.tigers.filter(t=>t.alive);
  const lockTiger = S.lockedTigerId ? activeTigers.find((t)=>t.id===S.lockedTigerId) : null;
  const dangerCiv = (S.mode==="Survival") ? null : liveCivs.find((c)=>c.id===S.dangerCivId) || null;
  const squadCommand = normalizeSquadCommand(S.squadCommand);
  const commandAuto = squadCommand === "AUTO";
  const commandAttackTarget = squadCommand === "ATTACK_TARGET";
  const commandRescue = squadCommand === "RESCUE";
  const commandRegroup = squadCommand === "REGROUP";
  const commandHold = squadCommand === "HOLD";

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
  if(!priorityTiger && (commandAuto || commandRescue || commandAttackTarget) && dangerCiv){
    priorityTiger = nearestTigerTo(dangerCiv.x, dangerCiv.y).tiger;
  }
  if(!priorityTiger && !commandHold){
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
    const leashMax = commandHold ? 120 : (commandRegroup ? 150 : 265);

    if(unit.role === "rescue" && liveCivs.length && !commandHold && !commandRegroup){
      const ownTag = "rescue";
      const ownedByThisUnit = liveCivs.filter((c)=>c.following && c.escortOwner === ownTag && c.escortUnitId === unit.id);
      const canTakeNewAssignments = !commandAttackTarget;
      const available = canTakeNewAssignments
        ? liveCivs.filter((c)=>!c.following && (c.escortOwner !== ownTag || !c.escortUnitId || c.escortUnitId === unit.id))
        : [];
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
      if(!targetCiv && (commandRescue || !commandAttackTarget)){
        const nearest = nearestCivTo(unit.x, unit.y).civ;
        if(nearest && (nearest.escortOwner !== ownTag || !nearest.escortUnitId || nearest.escortUnitId === unit.id)){
          targetCiv = nearest;
        }
      }

      if(targetCiv){
        const civDist = dist(unit.x, unit.y, targetCiv.x, targetCiv.y);
        const engageDist = commandRescue ? 62 : 56;
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
              unit.guideAt = now + 100;
              const gdx = S.evacZone.x - targetCiv.x;
              const gdy = S.evacZone.y - targetCiv.y;
              const gd = Math.hypot(gdx, gdy) || 1;
              const guideSpeedBase = commandRescue ? 2.2 : 1.95;
              const guideSpeed = Math.min(guideSpeedBase, gd) * waterSpeedMul("civilian", targetCiv.x, targetCiv.y, 10);
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
      let chaseTiger = null;
      if(commandAttackTarget){
        chaseTiger = lockTiger || null;
        if(!chaseTiger && fallback.d < 170) chaseTiger = fallback.tiger;
      } else if(commandRescue){
        chaseTiger = dangerCiv ? nearestTigerTo(dangerCiv.x, dangerCiv.y).tiger : null;
        if(!chaseTiger){
          const nearPlayer = nearestTigerTo(S.me.x, S.me.y);
          if(nearPlayer.tiger && nearPlayer.d < 230) chaseTiger = nearPlayer.tiger;
        }
      } else if(commandRegroup){
        const nearPlayer = nearestTigerTo(S.me.x, S.me.y);
        if(nearPlayer.tiger && nearPlayer.d < 150) chaseTiger = nearPlayer.tiger;
      } else if(commandAuto){
        chaseTiger = priorityTiger || (fallback.d < 210 ? fallback.tiger : null);
      } else {
        chaseTiger = fallback.d < 140 ? fallback.tiger : null;
      }
      if(chaseTiger){
        const nearPlayer = dist(chaseTiger.x, chaseTiger.y, S.me.x, S.me.y) < 300;
        const nearDanger = dangerCiv ? dist(chaseTiger.x, chaseTiger.y, dangerCiv.x, dangerCiv.y) < 210 : false;
        const isLocked = !!lockTiger && chaseTiger.id === lockTiger.id;
        const allowChase = commandAttackTarget
          ? (isLocked || (!lockTiger && nearPlayer))
          : commandRegroup
            ? nearPlayer
            : commandRescue
              ? (nearDanger || nearPlayer)
              : (isLocked || nearPlayer || nearDanger);
        if(allowChase){
          targetX = chaseTiger.x;
          targetY = chaseTiger.y;
        }
      }
    }

    const homeDist = dist(unit.x, unit.y, unit.homeX, unit.homeY);
    if(homeDist > leashMax){
      targetX = unit.homeX + Math.cos(unit.step * 0.55) * 14;
      targetY = unit.homeY + Math.sin(unit.step * 0.62) * 12;
    }

    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const len = Math.hypot(dx, dy) || 1;
    const waterMul = waterSpeedMul("support", unit.x, unit.y, 12);
    let stepCap = unit.role === "attacker"
      ? (2.30 * (S.mode==="Story" ? (1 + (storySpecialistRank("SP_ATK_DRILL") * 0.04)) : 1))
      : (2.08 * storyRescueSpeedMul());
    if(unit.role === "rescue" && commandRescue) stepCap *= 1.1;
    if(commandRegroup) stepCap *= 1.06;
    if(commandHold) stepCap *= 0.96;
    const finalStepCap = stepCap * waterMul;
    const step = Math.min(finalStepCap, len);
    unit.face = Math.atan2(dy, dx);
    tryMoveEntity(unit, unit.x + (dx / len) * step, unit.y + (dy / len) * step, 16, { avoidKeepout:false });

    for(const tiger of activeTigers){
      const tigerDist = dist(unit.x, unit.y, tiger.x, tiger.y);
      const nearPlayer = dist(tiger.x, tiger.y, S.me.x, S.me.y) < 300;
      const nearDanger = dangerCiv ? dist(tiger.x, tiger.y, dangerCiv.x, dangerCiv.y) < 210 : false;
      const isPriority = !!priorityTiger && tiger.id === priorityTiger.id;
      let allowEngage = isPriority || nearPlayer || nearDanger;
      let shotRange = 230;
      let clawRange = 90;
      if(commandAttackTarget){
        allowEngage = lockTiger ? tiger.id === lockTiger.id : nearPlayer;
        shotRange = lockTiger ? 255 : 155;
        clawRange = 96;
      } else if(commandRescue){
        allowEngage = nearDanger || nearPlayer;
        shotRange = nearDanger ? 245 : 190;
        clawRange = 98;
      } else if(commandRegroup){
        allowEngage = nearPlayer && tigerDist < 170;
        shotRange = 165;
        clawRange = 86;
      } else if(commandHold){
        allowEngage = nearPlayer && tigerDist < 130;
        shotRange = 135;
        clawRange = 82;
      }

      if(unit.role === "attacker"){
        if(allowEngage && tigerDist < shotRange && now >= (unit.fireAt || 0)){
          unit.fireAt = now + rand(260, 430);
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
              addContractTally("captures", 1);
              addOpsTotal("captures", 1);
              const pay = payout("CAPTURE");
              const cash = Math.round(pay.cash * 0.42);
              const score = Math.round(pay.score * 0.45);
              S.funds += cash;
              S.score += score;
              trackCashEarned(cash);
              setEventText("Tiger specialist secured a capture.", 2.2);
              break;
            }
          }
          if(tiger.hp <= 0){
            finishTigerKill(tiger);
            break;
          }
        }
        if(allowEngage && tigerDist < clawRange){
          const hitKey = `_nextTigerHitAt_${tiger.id}`;
          if(now >= (unit[hitKey] || 0)){
            unit[hitKey] = now + rand(780, 1120);
            damageSupportUnit(unit, supportTigerHitDamage(tiger, "attacker"));
          }
        }
      } else if(unit.role === "rescue"){
        if(tigerDist < 84){
          const hitKey = `_nextTigerHitAt_${tiger.id}`;
          if(now >= (unit[hitKey] || 0)){
            unit[hitKey] = now + rand(900, 1280);
            damageSupportUnit(unit, supportTigerHitDamage(tiger, "rescue"));
          }
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
  const escortedByPlayer = c.following && c.escortOwner === "player";
  if(escortedByPlayer){
    c.fleeUntil = 0;
    c.fleeFromTigerId = 0;
    return false;
  }

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
  const jitter = c.following ? 0 : (((c.id % 3) - 1) * 0.28);
  const ang = Math.atan2(awayY, awayX) + jitter;
  const waterMul = waterSpeedMul("civilian", c.x, c.y, 10);
  const fleeSpeed = (c.following ? 2.95 : 2.35) * (c.following ? Math.max(0.94, waterMul) : waterMul) * frameTimeScale();
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
  const followMaxDist = (S._sprintTicks && S._sprintTicks > 0) ? 520 : 450;
  const face = Number.isFinite(S.me.face) ? S.me.face : 0;
  if(!Number.isFinite(S._escortFace)) S._escortFace = face;
  const faceDelta = normalizeAngle(face - S._escortFace);
  S._escortFace = normalizeAngle(S._escortFace + clamp(faceDelta, -0.23, 0.23));
  const escortFace = S._escortFace;
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
  const sideGap = 32;
  const rowGap = 32;
  const baseBehind = 54;
  const anchors = [];

  for(let i=0;i<activeFollowers.length;i++){
    const row = Math.floor(i / cols);
    const col = i % cols;
    const colsInRow = Math.min(cols, activeFollowers.length - (row * cols));
    const center = (colsInRow - 1) * 0.5;
    const lateral = ((col - center) * sideGap) + ((row % 2) ? sideGap * 0.4 : 0);
    const back = baseBehind + (row * rowGap) + (Math.abs(lateral) * 0.16);
    anchors.push({
      x: S.me.x - Math.cos(escortFace) * back + Math.sin(escortFace) * lateral,
      y: S.me.y - Math.sin(escortFace) * back - Math.cos(escortFace) * lateral
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
    c.fleeUntil = 0;
    c.fleeFromTigerId = 0;

    let dx = anchor.x - c.x;
    let dy = anchor.y - c.y;
    let dd = Math.hypot(dx,dy) || 1;
    if(dd > 245 && now > (c._lastEscortSnapAt || 0) + 1800){
      const snap = findNearestOpenPoint(anchor.x, anchor.y, 14, {
        avoidKeepout:false,
        avoidWater:false,
        targetX:S.me.x,
        targetY:S.me.y
      });
      if(snap){
        c.x = snap.x;
        c.y = snap.y;
        c._lastEscortSnapAt = now;
        dx = anchor.x - c.x;
        dy = anchor.y - c.y;
        dd = Math.hypot(dx,dy) || 1;
      }
    }
    const waterMul = waterSpeedMul("civilian", c.x, c.y, 10);
    const escortWaterMul = Math.max(0.93, waterMul);
    const catchup = clamp((dd - 10) * 0.07, 0, 5.4);
    const trailBoost = dd > 170 ? 0.72 : (dd > 120 ? 0.40 : 0);
    const sp = Math.min(
      ((Math.max(playerSpeed * 1.24, 3.25) + catchup + trailBoost) * escortBoost * escortWaterMul),
      PLAYER_SPRINT_SPEED + 3.35
    ) * frameTimeScale();
    const vx = (dx/dd) * sp;
    const vy = (dy/dd) * sp;
    if(Math.hypot(vx, vy) > 0.02){
      c.face = Math.atan2(vy, vx);
      c.step = (c.step || 0) + clamp(Math.hypot(vx, vy) * 0.11, 0.04, 0.30);
    }
    const moved = tryMoveEntity(c, c.x + vx, c.y + vy, 14, { avoidKeepout:false });
    if(!moved){
      const recover = findNearestOpenPoint(anchor.x, anchor.y, 14, {
        avoidKeepout:false,
        avoidWater:false,
        targetX:S.me.x,
        targetY:S.me.y
      });
      if(recover){
        c.x = recover.x;
        c.y = recover.y;
      }
    }
  }
}

function moveCivilianInsideEvac(c){
  const ez = S.evacZone || DEFAULT.evacZone;
  if(!ez || !Number.isFinite(ez.x) || !Number.isFinite(ez.y)) return;
  const radius = Math.max(10, (ez.r || 70) - 14);
  const seed = ((Number(c.id || 1) * 97) % 360) * (Math.PI / 180);
  const laneR = Math.max(8, Math.min(radius * 0.56, 12 + ((Number(c.id || 1) % 5) * 6)));
  const tx = clamp(ez.x + Math.cos(seed) * laneR, 24, cv.width - 24);
  const ty = clamp(ez.y + Math.sin(seed) * laneR, 24, cv.height - 24);
  const spot = findNearestOpenPoint(tx, ty, 12, {
    avoidKeepout:false,
    avoidWater:false,
    targetX:ez.x,
    targetY:ez.y
  }) || { x:tx, y:ty };
  c.x = spot.x;
  c.y = spot.y;
  c.following = false;
  c.escortOwner = "";
  c.escortUnitId = "";
}

function evacCheck(){
  if(S.mode==="Survival") return;
  const ez = S.evacZone || DEFAULT.evacZone;
  const evacOuterRadius = (ez.r || 70) + 18;
  const evacCoreRadius = Math.max(14, (ez.r || 70) - 6);
  for(const c of S.civilians){
    if(!c.alive || c.evac) continue;
    const followBonus = c.following ? 7 : 0;
    const d = dist(c.x, c.y, ez.x, ez.y);
    if(d <= (evacOuterRadius + followBonus)){
      moveCivilianInsideEvac(c);
      if(dist(c.x, c.y, ez.x, ez.y) > evacCoreRadius){
        continue;
      }
      c.evac=true;
      S.evacDone += 1;
      S.stats.evac += 1;
      addContractTally("evac", 1);
      addOpsTotal("evac", 1);
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

  let threatTigers = S.tigers || [];
  if((frameIsSlow() || __frameLagScore >= FRAME_LAG_WARN_SCORE) && threatTigers.length > 8){
    const stride = __frameLagScore >= FRAME_LAG_CRITICAL_SCORE ? 3 : 2;
    const phase = Math.floor(Number(__frameBudgetState.frameNo || 0)) % stride;
    threatTigers = threatTigers.filter((_, idx)=> (idx % stride) === phase);
  }

  for(const t of threatTigers){
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
      const escortedByPlayer = best.following && best.escortOwner === "player";
      const playerCover = escortedByPlayer && dist(best.x, best.y, S.me.x, S.me.y) <= 190;
      if(!playerCover){
        best.fleeUntil = now + rand(escortedByPlayer ? 520 : 1300, escortedByPlayer ? 1100 : 2200);
        best.fleeFromTigerId = t.id;
      } else {
        best.fleeUntil = 0;
        best.fleeFromTigerId = 0;
      }

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
        const showPopup = nearPlayer;
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
      addOpsTotal("civiliansLost", 1);
      breakCombo("civilian lost");
      c.following = false;
      c.escortOwner = "";
      c.escortUnitId = "";
      S._underAttack = 0;
      S.dangerCivId = null;
      toast("Civilian lost. Mission failed.");
      hapticNotif("warning");
      save();
      return gameOverChoice("Mission failed: a civilian was killed. All civilians must survive.");
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
  const nemesisSpeedMul = clamp(Number(t.nemesisSpeedMul || 1), 0.8, 1.45);
  const nemesisPounceMul = clamp(Number(t.nemesisPounceMul || 1), 0.8, 1.45);

  const walk = (base.walk + (def.spd * 0.15) + (hunter * 0.30) + (pack * 0.25)) * persona.speedMul * nemesisSpeedMul;
  const chase = (base.chase + (def.spd * 0.20) + (hunter * 0.85) + (pack * 0.55) + (rage * 0.35) + (fading * 0.22)) * persona.speedMul * nemesisSpeedMul;
  const sprint = (base.sprint + (def.spd * 0.24) + (hunter * 1.05) + (pack * 0.85) + (rage * 0.55) + (scoutDash * 0.35)) * persona.speedMul * nemesisSpeedMul;
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
    pounceChance: clamp((base.pounceChance + (hunter * 0.03) + (pack * 0.02) + (rage * 0.02)) * persona.pounceMul * nemesisPounceMul, 0, 0.30),
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
  const biomeHazards = biomeHazardModifiers(S.mode);
  const biomeAggroMul = clamp(Number(biomeHazards.tigerAggroMul || 1), 0.82, 1.35);
  const biomeSpeedMul = clamp(Number(biomeHazards.tigerSpeedMul || 1), 0.86, 1.35);
  const directorAggroMul = clamp(Number(S._directorAggroMul || 1) * biomeAggroMul, 0.82, 1.36);
  const directorSpeedMul = clamp(Number(S._directorSpeedMul || 1) * biomeSpeedMul, 0.88, 1.34);
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
  const lagTier = frameLagTier();
  if(aliveTigers.length > 12 || (lagTier >= 1 && aliveTigers.length > 6)){
    const underLoad = frameIsSlow() || performanceMode() === "PERFORMANCE" || lagTier >= 1;
    const batchRatio = lagTier >= 2 ? 0.40 : (underLoad ? 0.52 : 0.62);
    const batchMin = lagTier >= 2 ? 4 : (underLoad ? 6 : 8);
    const batchSize = Math.max(batchMin, Math.ceil(aliveTigers.length * batchRatio));
    const pinned = [];
    const priority = [];
    const background = [];
    for(const tiger of aliveTigers){
      const isPinned = tiger.id === S.lockedTigerId || tiger.id === S.activeTigerId;
      if(isPinned){
        pinned.push(tiger);
        continue;
      }
      const nearPlayer = dist(tiger.x, tiger.y, S.me.x, S.me.y) <= 300;
      const nearViewport = pointInViewportPad(tiger.x, tiger.y, 140);
      let nearCiv = false;
      if(liveCivs.length){
        for(const civ of liveCivs){
          if(dist(tiger.x, tiger.y, civ.x, civ.y) <= 176){
            nearCiv = true;
            break;
          }
        }
      }
      if(nearPlayer || nearViewport || nearCiv){
        priority.push(tiger);
      }else{
        background.push(tiger);
      }
    }

    const maxPriority = lagTier >= 2 ? 8 : (underLoad ? 11 : 14);
    priority.sort((a, b)=>dist(a.x, a.y, S.me.x, S.me.y) - dist(b.x, b.y, S.me.x, S.me.y));
    const keepPriority = priority.slice(0, Math.max(0, maxPriority - pinned.length));
    const overflowPriority = priority.slice(keepPriority.length);
    if(overflowPriority.length) background.unshift(...overflowPriority);

    const backgroundLen = background.length;
    const start = backgroundLen > 0 ? ((S._tigerBatchStart || 0) % backgroundLen) : 0;
    const batch = [];
    if(backgroundLen > 0){
      const dynamicBatch = Math.max(1, batchSize - pinned.length - keepPriority.length);
      for(let i=0; i<dynamicBatch; i++){
        batch.push(background[(start + i) % backgroundLen]);
      }
      S._tigerBatchStart = (start + dynamicBatch) % backgroundLen;
    } else {
      S._tigerBatchStart = 0;
    }
    tickTigers = [...pinned, ...keepPriority, ...batch];
  } else {
    S._tigerBatchStart = 0;
  }

  for(const t of tickTigers){
    const playerDist = dist(t.x, t.y, S.me.x, S.me.y);
    const keyTiger = t.id === S.lockedTigerId || t.id === S.activeTigerId || isBossTiger(t);
    const nearViewport = pointInViewportPad(t.x, t.y, 150);
    let nearCivilian = false;
    if(liveCivs.length){
      for(const civ of liveCivs){
        if(dist(t.x, t.y, civ.x, civ.y) <= 180){
          nearCivilian = true;
          break;
        }
      }
    }
    const heavyFrame = lagTier >= 1 || frameIsSlow() || performanceMode() === "PERFORMANCE";
    if(heavyFrame && !keyTiger && !nearViewport && !nearCivilian && playerDist > 360){
      if(now < (t._nextFarThinkAt || 0)){
        t.vx = (t.vx || 0) * 0.94;
        t.vy = (t.vy || 0) * 0.94;
        t.x = clamp(t.x + t.vx, 40, cv.width - 40);
        t.y = clamp(t.y + t.vy, 60, cv.height - 40);
        t.step = (t.step + 0.04) % (Math.PI * 2);
        continue;
      }
      t._nextFarThinkAt = now + (lagTier >= 2 ? 130 : 90);
    } else {
      t._nextFarThinkAt = 0;
    }

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

    const closePlayerRange = (145 + (bloodScent * 85)) * directorAggroMul;
    const closeCivRange = (130 + (bloodScent * 95)) * directorAggroMul;
    const closeToPlayer = playerDist <= (closePlayerRange + (persona.playerBias * 120));
    const closeToCiv = closestCiv && closestCivDist <= closeCivRange;
    const civFocusBias = clamp(
      (t.civBias + bloodScent * 0.25 + (carcassDifficulty()-1)*0.10 + persona.civBiasDelta) * (0.92 + (directorAggroMul - 1) * 1.1),
      0.05,
      0.98
    );

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
      targetDist < (motion.detect * directorAggroMul) ||
      (now < (t.enragedUntil||0) && targetDist < (motion.detect + 80) * directorAggroMul)
    );
    if(isBossTiger(t) && now < (t.bossChargeUntil || 0) && Number.isFinite(targetDist) && targetDist < (motion.detect + 190) * directorAggroMul){
      chase = true;
    }
    if(t.type==="Stalker" && now < (t.fadeUntil||0) && Number.isFinite(targetDist) && targetDist < (motion.detect + 90) * directorAggroMul){
      chase = true;
    }
    if(!chase){
      t.aggroBoost = Math.max(0, (t.aggroBoost||0) - 0.004);
    }
    if(t.huntState === TIGER_HUNT_STATES.PATROL){
      chase = Number.isFinite(targetDist) && targetDist < 88;
    } else if(t.huntState === TIGER_HUNT_STATES.STALK){
      chase = Number.isFinite(targetDist) && targetDist < (motion.detect + 120) * directorAggroMul;
    } else if(t.huntState === TIGER_HUNT_STATES.POUNCE){
      chase = true;
    } else if(t.huntState === TIGER_HUNT_STATES.RECOVER){
      chase = Number.isFinite(targetDist) && targetDist < (motion.detect * 0.62) * directorAggroMul;
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
    speedCap *= directorSpeedMul;
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
  clearTransientCombatVisuals();
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
  S.civGraceUntil = Math.max(S.civGraceUntil || 0, now + 1800);
  {
    const director = ensureMissionDirectorState(S);
    director.nextSpawnAt = Math.max(director.nextSpawnAt || 0, now + rand(3200, 5200));
    director.pressure = clamp((Number(director.pressure || 8) * 0.72), 8, 72);
    director.phaseLockUntil = Math.max(director.phaseLockUntil || 0, now + 900);
  }
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
    S.meHitFlashUntil = now + 190;
    S.meHitFlashPower = clamp((Number(dmg) || 0) / 42, 0.28, 1.15);
    S.hp = clamp(S.hp - dmg, 0, 100);
    sfx("hurt"); hapticImpact("medium");
    if(showToast) toast(`🐅 Hit: -${dmg} HP`);
  }
  if(S.inBattle) renderBattleStatus();
  if(S.hp<=0 && S.armor<=0){
    markBalanceDeath(S);
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
function battleTigerMinSpacing(t){
  if(!t) return 108;
  if(isBossTiger(t)) return 138;
  if(t.type === "Alpha") return 130;
  if(t.type === "Berserker") return 122;
  if(t.type === "Stalker") return 116;
  if(t.type === "Scout") return 102;
  return 110;
}
function battleTigerDesiredSpacing(t, rangeLimit=equippedWeaponRange()){
  const safeRange = Math.max(70, Number(rangeLimit) || 112);
  const band = weaponRangeBand(safeRange);
  const weapon = equippedWeapon();
  let base = battleTigerMinSpacing(t);
  if(band === "short") base = Math.min(base, 82);
  else if(band === "mid") base = Math.min(base, 108);
  else base = Math.min(base + 8, 132);
  if(weapon?.type === "tranq") base -= 6;
  const minSep = band === "short" ? 62 : (band === "mid" ? 70 : 82);
  const maxSep = Math.max(66, safeRange - (band === "long" ? 16 : 12));
  return clamp(base, minSep, maxSep);
}
function keepBattleTigerBesidePlayer(t, now=Date.now()){
  if(!S.inBattle || !t || !t.alive) return;
  const meX = Number(S.me?.x) || 0;
  const meY = Number(S.me?.y) || 0;
  const dx = t.x - meX;
  const dy = t.y - meY;
  const d = Math.hypot(dx, dy);
  const rangeLimit = Math.max(70, Number(equippedWeaponRange()) || 112);
  const band = weaponRangeBand(rangeLimit);
  const desiredSep = battleTigerDesiredSpacing(t, rangeLimit);
  const overlapSep = band === "short" ? Math.max(52, desiredSep - 18) : Math.max(58, desiredSep - 14);
  if(d >= overlapSep) return;

  let ux = dx / (d || 1);
  let uy = dy / (d || 1);
  if(!Number.isFinite(ux) || !Number.isFinite(uy) || d < 4){
    const a = (t.id || 1) + (now * 0.0026);
    ux = Math.cos(a);
    uy = Math.sin(a);
  }
  const targetX = meX + (ux * desiredSep);
  const targetY = meY + (uy * desiredSep);
  const moved = tryMoveEntity(t, targetX, targetY, 18, { avoidKeepout:false });
  if(!moved){
    const fallback = findNearestOpenPoint(targetX, targetY, 18, { avoidKeepout:false, targetX, targetY });
    if(fallback){
      t.x = fallback.x;
      t.y = fallback.y;
    }
  }
  // Safety: never auto-push the tiger out of current weapon range.
  const nd = dist(meX, meY, t.x, t.y);
  const safeMax = Math.max(band === "short" ? 54 : 60, rangeLimit - (band === "long" ? 14 : 8));
  if(nd > safeMax){
    const pullX = meX + (ux * safeMax);
    const pullY = meY + (uy * safeMax);
    const pulled = tryMoveEntity(t, pullX, pullY, 18, { avoidKeepout:false });
    if(!pulled){
      const refit = findNearestOpenPoint(pullX, pullY, 18, { avoidKeepout:false, targetX:pullX, targetY:pullY });
      if(refit){
        t.x = refit.x;
        t.y = refit.y;
      }
    }
  }
  // keep the tiger oriented toward the player for clearer strike readability
  const fx = meX - t.x;
  const fy = meY - t.y;
  t.heading = Math.atan2(fy || 0, fx || 1);
  t.drawDir = Math.cos(t.heading) >= 0 ? 1 : -1;
}

function visualEffectsHeavyMode(){
  if(frameLagTier() >= 1) return true;
  if(performanceMode() === "PERFORMANCE") return true;
  return frameIsSlow();
}
function visualReadabilityHeavyMode(){
  if(visualEffectsHeavyMode()) return true;
  return __frameDynamicLoadMul >= FRAME_LOAD_HIGH;
}
function visualExtremeLoadMode(){
  if(frameLagTier() >= 2) return true;
  if(__frameDynamicLoadMul >= FRAME_LOAD_EXTREME) return true;
  if(frameIsSlow()) return frameBudgetExceeded(0.55);
  return false;
}

function currentBattleCinematicTargetScale(){
  if(!ENABLE_BATTLE_CINEMATIC) return 1;
  const perfScale = (performanceMode() === "PERFORMANCE" || frameIsSlow()) ? 0.96 : 1;
  const base = isMobileViewport() ? (isLandscapeViewport() ? 1.10 : 1.16) : 1.14;
  return clamp(base * perfScale, 1.06, 1.18);
}

function resolveBattleCinematicFocus(t){
  const meX = Number.isFinite(S?.me?.x) ? S.me.x : (cv.width * 0.5);
  const meY = Number.isFinite(S?.me?.y) ? S.me.y : (cv.height * 0.5);
  const tiger = t || activeTiger() || tigerById(S.lockedTigerId);
  let x = meX;
  let y = meY;
  if(tiger && tiger.alive){
    x = (meX + tiger.x) * 0.5;
    y = (meY + tiger.y) * 0.5;
  }
  return {
    x: clamp(x, 70, Math.max(70, cv.width - 70)),
    y: clamp(y, 70, Math.max(70, cv.height - 70))
  };
}

function battleCinematicScaleNow(now=Date.now()){
  if(!BATTLE_CINEMATIC.active) return Number(BATTLE_CINEMATIC.scale) || 1;
  const dur = Math.max(1, Number(BATTLE_CINEMATIC.durationMs) || 1);
  const p = clamp((now - (BATTLE_CINEMATIC.startAt || now)) / dur, 0, 1);
  const eased = 1 - Math.pow(1 - p, 3);
  return (BATTLE_CINEMATIC.fromScale || 1) + ((BATTLE_CINEMATIC.toScale || 1) - (BATTLE_CINEMATIC.fromScale || 1)) * eased;
}

function resetBattleCinematic(){
  BATTLE_CINEMATIC.active = false;
  BATTLE_CINEMATIC.startAt = 0;
  BATTLE_CINEMATIC.durationMs = 0;
  BATTLE_CINEMATIC.fromScale = 1;
  BATTLE_CINEMATIC.toScale = 1;
  BATTLE_CINEMATIC.scale = 1;
  BATTLE_CINEMATIC.focusX = Number.isFinite(S?.me?.x) ? S.me.x : (cv.width * 0.5);
  BATTLE_CINEMATIC.focusY = Number.isFinite(S?.me?.y) ? S.me.y : (cv.height * 0.5);
}

function triggerBattleCinematic(kind="enter", focusTigerId=null){
  if(!ENABLE_BATTLE_CINEMATIC){
    resetBattleCinematic();
    return;
  }
  const now = Date.now();
  const focusTiger = focusTigerId != null ? tigerById(focusTigerId) : null;
  const focus = resolveBattleCinematicFocus(focusTiger || activeTiger() || tigerById(S.lockedTigerId));
  BATTLE_CINEMATIC.focusX = focus.x;
  BATTLE_CINEMATIC.focusY = focus.y;
  const from = battleCinematicScaleNow(now);
  const to = kind === "enter" ? currentBattleCinematicTargetScale() : 1;
  if(Math.abs(from - to) < 0.004){
    BATTLE_CINEMATIC.active = false;
    BATTLE_CINEMATIC.scale = to;
    BATTLE_CINEMATIC.fromScale = to;
    BATTLE_CINEMATIC.toScale = to;
    BATTLE_CINEMATIC.startAt = now;
    BATTLE_CINEMATIC.durationMs = 0;
    return;
  }
  BATTLE_CINEMATIC.active = true;
  BATTLE_CINEMATIC.startAt = now;
  BATTLE_CINEMATIC.durationMs = kind === "enter" ? BATTLE_CINE_ENTER_MS : BATTLE_CINE_EXIT_MS;
  BATTLE_CINEMATIC.fromScale = from;
  BATTLE_CINEMATIC.toScale = to;
  BATTLE_CINEMATIC.scale = from;
}

function sampleBattleCinematic(){
  if(!ENABLE_BATTLE_CINEMATIC){
    resetBattleCinematic();
    return { active:false, scale:1, x:cv.width * 0.5, y:cv.height * 0.5 };
  }
  const now = Date.now();
  let scale = battleCinematicScaleNow(now);
  if(BATTLE_CINEMATIC.active){
    const doneAt = (BATTLE_CINEMATIC.startAt || 0) + Math.max(1, BATTLE_CINEMATIC.durationMs || 1);
    if(now >= doneAt){
      BATTLE_CINEMATIC.active = false;
      scale = BATTLE_CINEMATIC.toScale || 1;
    }
  }else{
    const holdTarget = S.inBattle ? currentBattleCinematicTargetScale() : 1;
    if(Math.abs(scale - holdTarget) > 0.004){
      scale += (holdTarget - scale) * 0.14;
    }else{
      scale = holdTarget;
    }
  }
  BATTLE_CINEMATIC.scale = clamp(scale, 1, 1.20);
  if(S.inBattle || BATTLE_CINEMATIC.active || BATTLE_CINEMATIC.scale > 1.01){
    const f = resolveBattleCinematicFocus();
    BATTLE_CINEMATIC.focusX += (f.x - BATTLE_CINEMATIC.focusX) * 0.18;
    BATTLE_CINEMATIC.focusY += (f.y - BATTLE_CINEMATIC.focusY) * 0.18;
  }
  const active = BATTLE_CINEMATIC.active || BATTLE_CINEMATIC.scale > 1.01;
  return {
    active,
    scale: BATTLE_CINEMATIC.scale,
    x: Number.isFinite(BATTLE_CINEMATIC.focusX) ? BATTLE_CINEMATIC.focusX : (cv.width * 0.5),
    y: Number.isFinite(BATTLE_CINEMATIC.focusY) ? BATTLE_CINEMATIC.focusY : (cv.height * 0.5)
  };
}

function queueCameraShake(power=1, durationMs=120){
  if(!ENABLE_SCREEN_SHAKE) return;
  const base = clamp(Number(power || 0), 0, 2);
  if(base <= 0) return;
  const modeScale = performanceMode() === "PERFORMANCE" ? 0.44 : (frameIsSlow() ? 0.62 : 1);
  const scaled = base * modeScale;
  if(scaled <= 0.02) return;
  CAMERA_SHAKE.power = Math.max(CAMERA_SHAKE.power, scaled);
  CAMERA_SHAKE.until = Math.max(CAMERA_SHAKE.until, Date.now() + clamp(durationMs, 40, 360));
}

function sampleCameraShake(){
  if(!ENABLE_SCREEN_SHAKE){
    CAMERA_SHAKE.power = 0;
    CAMERA_SHAKE.until = 0;
    return { x:0, y:0, active:false };
  }
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
  }else if(kind === "dodge"){
    color = "rgba(250,204,21,.92)";
    maxR = 21;
    ttl = 19;
  }else if(kind === "shield"){
    color = "rgba(96,165,250,.95)";
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
  IMPACT_PULSES.push({
    x, y, color, kind, ttl, maxTtl:ttl, r:2, maxR,
    spin: Math.random() * Math.PI * 2
  });
}

function emitCombatFx(x1, y1, x2, y2, color, width=3, kind="hit"){
  if(COMBAT_FX.length >= 64){
    COMBAT_FX.splice(0, COMBAT_FX.length - 63);
  }
  const ttl = visualEffectsHeavyMode() ? 6 : 8;
  COMBAT_FX.push({ x1, y1, x2, y2, color, width, kind, ttl, maxTtl:ttl, spin:Math.random() * Math.PI * 2 });
  queueImpactPulse(x2, y2, kind);
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
  const lagTier = frameLagTier();
  const maxDraw = heavy
    ? (lagTier >= 2 ? 10 : (frameIsSlow() ? 16 : 24))
    : (lagTier >= 2 ? 18 : (lagTier >= 1 ? 30 : 56));
  const startIdx = Math.max(0, COMBAT_FX.length - maxDraw);
  for(let i=startIdx; i<COMBAT_FX.length; i++){
    const fx = COMBAT_FX[i];
    const alpha = clamp(fx.ttl / fx.maxTtl, 0, 1);
    const dx = fx.x2 - fx.x1;
    const dy = fx.y2 - fx.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tipX = fx.x2;
    const tipY = fx.y2;
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
    if(!heavy){
      ctx.globalAlpha = alpha * 0.72;
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(tipX, tipY, Math.max(1.6, fx.width * 0.95), 0, Math.PI * 2);
      ctx.fill();
      if(fx.kind === "crit" || fx.kind === "player"){
        const cross = (fx.width * 1.6) + 2;
        ctx.strokeStyle = fx.kind === "crit" ? "rgba(252,211,77,.98)" : "rgba(248,113,113,.96)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tipX - (uy * cross), tipY + (ux * cross));
        ctx.lineTo(tipX + (uy * cross), tipY - (ux * cross));
        ctx.moveTo(tipX - (ux * cross * 0.8), tipY - (uy * cross * 0.8));
        ctx.lineTo(tipX + (ux * cross * 0.8), tipY + (uy * cross * 0.8));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawImpactPulses(){
  const lagTier = frameLagTier();
  const maxDraw = visualReadabilityHeavyMode()
    ? (lagTier >= 2 ? 7 : (frameIsSlow() ? 10 : 14))
    : (lagTier >= 2 ? 10 : (lagTier >= 1 ? 16 : 24));
  const startIdx = Math.max(0, IMPACT_PULSES.length - maxDraw);
  for(let i=startIdx; i<IMPACT_PULSES.length; i++){
    const pulse = IMPACT_PULSES[i];
    const life = clamp(pulse.ttl / pulse.maxTtl, 0, 1);
    ctx.save();
    const spin = (pulse.spin || 0) + ((1 - life) * 2.6);
    ctx.globalAlpha = life * 0.55;
    ctx.strokeStyle = pulse.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, pulse.r, 0, Math.PI * 2);
    ctx.stroke();
    if(pulse.kind === "crit" || pulse.kind === "player"){
      ctx.globalAlpha = life * 0.44;
      ctx.lineWidth = 1.7;
      const spoke = Math.max(4, pulse.r * 0.46);
      for(let i=0;i<4;i++){
        const a = spin + (i * (Math.PI * 0.5));
        const x1 = pulse.x + Math.cos(a) * (pulse.r * 0.56);
        const y1 = pulse.y + Math.sin(a) * (pulse.r * 0.56);
        const x2 = pulse.x + Math.cos(a) * (pulse.r * 0.56 + spoke);
        const y2 = pulse.y + Math.sin(a) * (pulse.r * 0.56 + spoke);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
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
  const lagTier = frameLagTier();
  const cellX = Math.round(x / 22);
  const cellY = Math.round(y / 22);
  const gateKey = `${kind}:${String(text)}:${cellX}:${cellY}`;
  const lastAt = DAMAGE_POPUP_GATE.get(gateKey) || 0;
  const gateMs = lagTier >= 2
    ? Math.round(DAMAGE_POPUP_RATE_MS * 3.4)
    : (lagTier >= 1 ? Math.round(DAMAGE_POPUP_RATE_MS * 2.3) : DAMAGE_POPUP_RATE_MS);
  if(now - lastAt < gateMs) return;
  DAMAGE_POPUP_GATE.set(gateKey, now);
  if(DAMAGE_POPUP_GATE.size > 260){
    for(const [k, at] of DAMAGE_POPUP_GATE){
      if(now - at > 1600) DAMAGE_POPUP_GATE.delete(k);
    }
    if(DAMAGE_POPUP_GATE.size > 320) DAMAGE_POPUP_GATE.clear();
  }

  const popupCap = lagTier >= 2 ? 12 : (lagTier >= 1 ? 18 : 30);
  if(DAMAGE_POPUPS.length >= popupCap){
    DAMAGE_POPUPS.splice(0, DAMAGE_POPUPS.length - (popupCap - 1));
  }
  DAMAGE_POPUPS.push({
    x, y,
    text: String(text),
    kind,
    ttl: (kind === "crit" ? 38 : 34),
    maxTtl: (kind === "crit" ? 38 : 34),
    vy: kind === "player" ? -1.45 : -1.10,
    drift: (Math.random() - 0.5) * 0.28,
    scale: kind === "crit" ? 1.16 : (kind === "player" ? 1.10 : 1.0)
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
  const lagTier = frameLagTier();
  const lagFade = lagTier >= 2 ? 1.7 : (lagTier >= 1 ? 1.35 : 1);
  const idleFade = (S.paused || S.missionEnded || S.gameOver || !S.inBattle) ? (3.2 * lagFade) : lagFade;
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
  const heavy = visualReadabilityHeavyMode();
  const lagTier = frameLagTier();
  const maxDraw = heavy
    ? (lagTier >= 2 ? 6 : (frameIsSlow() ? 8 : 12))
    : (lagTier >= 2 ? 8 : (lagTier >= 1 ? 14 : 24));
  const startIdx = Math.max(0, DAMAGE_POPUPS.length - maxDraw);
  for(let i=startIdx; i<DAMAGE_POPUPS.length; i++){
    const p = DAMAGE_POPUPS[i];
    const a = clamp(p.ttl / p.maxTtl, 0, 1);
    let color = "rgba(245,247,255,.95)";
    let bg = "rgba(9,12,18,.84)";
    let icon = "";
    if(p.kind === "crit") color = "rgba(252,211,77,.98)";
    else if(p.kind === "tranq") color = "rgba(125,211,252,.98)";
    else if(p.kind === "player") color = "rgba(248,113,113,.98)";
    else if(p.kind === "civilian") color = "rgba(251,191,36,.96)";
    else if(p.kind === "shield") color = "rgba(96,165,250,.98)";
    else if(p.kind === "dodge") color = "rgba(250,204,21,.98)";
    if(p.kind === "crit"){ bg = "rgba(74,50,8,.86)"; icon = "CRIT"; }
    else if(p.kind === "player"){ bg = "rgba(82,24,24,.88)"; icon = "HP"; }
    else if(p.kind === "tranq"){ bg = "rgba(18,48,78,.86)"; icon = "TRQ"; }
    else if(p.kind === "civilian"){ bg = "rgba(72,46,8,.88)"; icon = "CIV"; }
    else if(p.kind === "shield"){ bg = "rgba(14,44,86,.88)"; icon = "SHD"; }
    else if(p.kind === "dodge"){ bg = "rgba(86,64,10,.88)"; icon = "DGE"; }
    ctx.save();
    ctx.globalAlpha = a;
    const sc = clamp(Number(p.scale) || 1, 0.85, 1.35);
    const txt = String(p.text || "");
    const width = Math.max(34, Math.min(72, 18 + (txt.length * 8) + (icon ? 22 : 0)));
    const h = 16;
    const x = p.x - (width * 0.5);
    const y = p.y - 11;
    ctx.fillStyle = bg;
    roundedRectFill(x, y, width, h, 6);
    ctx.strokeStyle = "rgba(241,245,249,.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, h - 1);
    if(icon){
      ctx.fillStyle = "rgba(255,255,255,.64)";
      ctx.font = "800 8px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(icon, x + 5, y + 11);
    }
    ctx.fillStyle = color;
    ctx.font = `900 ${Math.round(11 * sc)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText(txt, p.x + (icon ? 8 : 0), p.y);
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

  resetAbilityCooldownButton(btn);
}

function resetAbilityCooldownButton(btn){
  if(!btn) return;
  const iconEl = btn.querySelector?.(".touchBtnIcon");
  btn.style.background = btn.dataset.baseBg || "";
  btn.style.borderColor = btn.dataset.baseBorder || "";
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
  renderProtectActionButtons();
  if(protectActionMode() === "shield"){
    document.querySelectorAll("[data-shield-btn]").forEach((btn)=>paintAbilityCooldownButton(btn, "shield"));
  } else {
    document.querySelectorAll("[data-shield-btn]").forEach((btn)=>resetAbilityCooldownButton(btn));
  }
}

function renderCombatControls(){
  const touchOverlay = document.querySelector(".touchOverlay");
  const touchHint = document.querySelector(".touchHint");
  const mapCluster = document.getElementById("mapTouchCluster");
  const combatCluster = document.getElementById("combatTouchCluster");
  const cacheBtn = document.getElementById("touchCacheBtn");
  const squadWheelBtn = document.getElementById("touchSquadWheelBtn");
  const actionButtons = document.querySelector(".actionButtons");
  const combatButtons = document.getElementById("combatButtons");
  const inCombat = !!S.inBattle;
  const hideTouchUi = controllerOwnsUi();
  if(touchOverlay) touchOverlay.style.display = hideTouchUi ? "none" : "block";
  if(touchHint) touchHint.style.display = hideTouchUi ? "none" : "block";
  if(mapCluster) mapCluster.style.display = hideTouchUi ? "none" : (inCombat ? "none" : "grid");
  if(combatCluster) combatCluster.style.display = hideTouchUi ? "none" : (inCombat ? "grid" : "none");
  if(cacheBtn) cacheBtn.style.display = hideTouchUi ? "none" : (inCombat ? "none" : "flex");
  if(squadWheelBtn) squadWheelBtn.style.display = hideTouchUi ? "none" : (inCombat ? "none" : "flex");
  if(actionButtons) actionButtons.style.display = (hideTouchUi || inCombat) ? "none" : "";
  if(combatButtons) combatButtons.style.display = hideTouchUi ? "none" : (inCombat ? "flex" : "none");
  if(hideTouchUi || inCombat || S.paused || S.gameOver || S.missionEnded){
    closeSquadCommandWheel();
  } else if(isSquadCommandWheelOpen()){
    positionSquadCommandWheel();
  }

  const t = activeTiger();
  const canCap = canAttemptCapture(t);
  const canAtk = anyLethalWeaponHasAmmo();
  const medCount = totalMedkits();
  const armorPlateCountAll = totalArmorPlates();
  const canMed = inCombat && !S.paused && !S.missionEnded && !S.gameOver && !(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) && medCount > 0;
  const canArmorPlate = inCombat && !S.paused && !S.missionEnded && !S.gameOver && !(S.respawnPendingUntil && Date.now() < S.respawnPendingUntil) && armorPlateCountAll > 0 && S.armor < S.armorCap;
  const canShield = !S.paused && !S.missionEnded && !S.gameOver && (S.shields||0) > 0 && !abilityOnCooldown("shield");
  const canQuickArmor = canQuickUseArmorPlate();
  const protectDisabled = inCombat || !(canShield || canQuickArmor);
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
  document.querySelectorAll("[data-shield-btn]").forEach((btn)=>{ btn.disabled = protectDisabled; });
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
  syncSquadCommandWheelUi();
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
function scheduleTigerRetaliationAfterShot(t){
  const now = Date.now();
  const boss = !!isBossTiger(t);
  const band = weaponRangeBand(equippedWeaponRange());
  let minMs = 420;
  let maxMs = 780;
  if(boss){
    minMs = 280;
    maxMs = 520;
  } else if(band === "short"){
    minMs = 360;
    maxMs = 640;
  } else if(band === "mid"){
    minMs = 420;
    maxMs = 760;
  } else {
    minMs = 520;
    maxMs = 900;
  }
  const candidateAt = now + rand(minMs, maxMs);
  const currentAt = Number(S._combatTigerAttackAt || 0);
  if(!Number.isFinite(currentAt) || currentAt <= now){
    S._combatTigerAttackAt = candidateAt;
    return;
  }
  // Do not postpone tiger retaliation due to rapid player fire.
  S._combatTigerAttackAt = Math.min(currentAt, candidateAt);
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
  S._combatTigerAttackAt = Date.now() + (isBossTiger(t) ? 680 : 950);
  t.aggroBoost = Math.max(t.aggroBoost || 0, 0.85);
  const overlay = document.getElementById("battleOverlay");
  if(overlay) overlay.style.display = "none";
  renderBattleStatus();
  updateBattleButtons();
  updateAttackButton();
  renderCombatControls();
  triggerBattleCinematic("enter", t.id);
  setBattleMsg(`Engaged Tiger #${t.id}. Fight stays on the map.`);
  if(isBossTiger(t)){
    triggerBossPrefightWarning(t, bossIdentityProfile(t), Date.now());
  }
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
  const focusTigerId = S.activeTigerId;
  const focusTiger = focusTigerId ? tigerById(focusTigerId) : null;
  triggerBattleCinematic("exit", focusTigerId);
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
  if(reason==="RETREAT"){
    S.aggro = clamp(S.aggro+4,0,100);
    if(focusTiger && focusTiger.alive){
      const damaged = Number(focusTiger.hp || 0) < Number(focusTiger.hpMax || 0);
      if(damaged || focusTiger.nemesisId){
        registerTigerEscapeNemesis(focusTiger, "RETREAT");
      }
    }
  }
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
  const liveOpsMul = liveOpsPayoutMul(S);
  if(S.mode==="Story"){
    const mul = storyPayoutMul();
    if(outcome==="CAPTURE") return { cash: Math.round(rand(2500,5000) * mul * liveOpsMul), score: Math.round(220 * mul), trust:+6, aggro:-8 };
    return { cash: Math.round(rand(500,1500) * mul * liveOpsMul), score: Math.round(100 * mul), trust:-4, aggro:+14 };
  }
  if(S.mode==="Arcade"){
    const L=S.arcadeLevel||1;
    if(outcome==="CAPTURE") return { cash: Math.round((900 + L*220) * liveOpsMul), score: 180 + L*40, trust:+2, aggro:-4 };
    return { cash: Math.round((450 + L*140) * liveOpsMul), score: 90 + L*25, trust:-1, aggro:+6 };
  }
  const W=S.survivalWave||1;
  if(outcome==="CAPTURE") return { cash: Math.round((700 + W*260) * liveOpsMul), score: 180 + W*45, trust:0, aggro:-2 };
  return { cash: Math.round((300 + W*170) * liveOpsMul), score: 85 + W*28, trust:0, aggro:+5 };
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
  if(S.mode==="Survival" || S.paused || S.missionEnded || S.gameOver) return;
  const boss = (S.tigers || []).find((t)=>t.alive && isBossTiger(t));
  if(!boss) return;
  const profile = bossIdentityProfile(boss);
  if(!profile) return;

  const now = Date.now();
  const phase = ensureBossPhaseState(boss, profile, now, { silent:true });
  const phaseCfg = bossPhasePreset(phase);
  const phaseCycle = bossSkillCycleForPhase(profile, boss);
  if(!phaseCycle.includes("reinforce")) return;
  if(boss.holdUntil && now < boss.holdUntil) return;
  const aliveStandards = (S.tigers || []).filter((t)=>t.alive && t.type==="Standard" && !isBossTiger(t)).length;
  const capBoost = ((profile.reinforce && profile.reinforce[1]) || 1) > 1 ? 1 : 0;
  const phaseCapBonus = phase >= 3 ? 1 : 0;
  const cap = bossStandardReinforcementCap() + capBoost + phaseCapBonus;
  if(aliveStandards >= cap) return;

  const cd = profile.cd || [9000, 13000];
  const level = currentCampaignLevel();
  const levelScale = clamp(1 - (Math.max(1, level) - 1) * 0.005, 0.68, 1);
  const phaseCdMul = clamp(Number(phaseCfg.cdMul || 1), 0.66, 1.05);
  const minCd = Math.round(clamp(cd[0] * levelScale * phaseCdMul, 3200, 17000));
  const maxCd = Math.round(clamp(cd[1] * levelScale * phaseCdMul, minCd + 250, 24000));
  if(!Number.isFinite(boss.nextReinforceAt) || boss.nextReinforceAt <= 0){
    boss.nextReinforceAt = now + rand(minCd, maxCd);
    return;
  }
  if(now < boss.nextReinforceAt) return;

  const reinfRange = profile.reinforce || [1, 1];
  const want = clamp(
    rand(reinfRange[0], reinfRange[1]) + Math.max(0, Math.floor(Number(phaseCfg.reinforceAdd || 0)) - 1),
    1,
    4
  );
  let spawned = 0;
  for(let i=0; i<want; i++){
    if((S.tigers || []).filter((t)=>t.alive && t.type==="Standard" && !isBossTiger(t)).length >= cap) break;
    const spawnedTiger = spawnRogueTiger({
      typeKey:"Standard",
      nearX:boss.x,
      nearY:boss.y,
      packId:boss.packId || 1,
      anchorTight:true,
      ignoreDirectorBudget:true
    });
    if(spawnedTiger){
      spawnedTiger.intent = "Boss Call";
      spawnedTiger.intentUntil = now + 700;
      spawned += 1;
    }
  }
  boss.nextReinforceAt = now + rand(minCd, maxCd);
  if(spawned > 0){
    setTigerIntent(boss, "Pack Call", 900);
    setEventText(`👑 ${profile.name} called ${spawned} Standard reinforcement${spawned>1?"s":""} (Phase ${phase}).`, 3);
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
  addContractTally("kills", 1);
  addOpsTotal("kills", 1);
  addXP(50);
  grantSeasonPassPoints(8, "Tiger eliminated");
  applySeasonFinisherVisual(t, "KILL");
  trackCashEarned(pay.cash);
  resolveNemesisOutcome(t, "KILL");
  unlockAchv("kill1","First Kill");
  S.trust=clamp(S.trust+pay.trust,0,100);
  S.aggro=clamp(S.aggro+pay.aggro,0,100);
  maybeReinforceOnKill();
  sfx("win"); hapticNotif("success");
  endBattle();
  checkMissionComplete();
}
function finishTigerKillWithWeapon(t, weaponId=""){
  const wid = String(weaponId || S.equippedWeaponId || "");
  finishTigerKill(t);
  if(getWeapon(wid)){
    addWeaponMasteryXp(wid, 4);
  }
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
    addWeaponMasteryXp(req, 4);
    const pay=payout("CAPTURE");
    S.funds+=pay.cash; S.score+=pay.score;
    S.stats.captures += 1;
    addContractTally("captures", 1);
    addOpsTotal("captures", 1);
    addXP(90);
    grantSeasonPassPoints(10, "Tiger captured");
    applySeasonFinisherVisual(t, "CAPTURE");
    awardCombo("capture");
    trackCashEarned(pay.cash);
    resolveNemesisOutcome(t, "CAPTURE");
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
    finishTigerKillWithWeapon(t, S.equippedWeaponId);
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
      addWeaponMasteryXp(w.id, 1);
      applyWearOnShot(w);
      sfx("jam");
      setBattleMsg(`JAM! ${w.name} malfunctioned.`);
      tigerTurn(t);
      save();
      return;
    }

    S.mag.loaded -= 1;
    S.stats.shots += 1;
    addContractTally("shots", 1);
    addWeaponMasteryXp(w.id, 2);
    addXP(2);
    
    const eff=ammoEffectFor(w.ammo);
    let dmg=rand(w.dmg[0],w.dmg[1]);
    dmg *= perkDamageMul();
    dmg *= arcadeBuildcraftMul("damageOutMul", 1);
    const crit=Math.random()<(eff.crit + perkCritBonus() + arcadeBuildcraftCritBonus());
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
      emitCombatFx(S.me.x, S.me.y - 6, victim.x, victim.y, "rgba(251,191,36,.95)", 3, "civilian");
      emitDamagePopup(victim.x, victim.y - 42, `-${civDmg}`, "civilian");
      hapticImpact("medium");
      setBattleMsg(`Friendly fire! Civilian #${victim.id} took ${civDmg}.`);
    } else {
      t.hitFlashUntil = Date.now() + 190;
      t.hitFlashKind = crit ? "crit" : (w.type === "tranq" ? "tranq" : "hit");
      t.lastHitDamage = dmg;
      if(w.type==="tranq"){
        t.hp = clamp(t.hp - dmg, 1, t.hpMax);
      }else{
        t.hp = clamp(t.hp - dmg, 0, t.hpMax);
      }
      emitCombatFx(
        S.me.x, S.me.y - 6, t.x, t.y,
        w.type==="tranq" ? "rgba(96,165,250,.96)" : "rgba(245,247,255,.96)",
        crit ? 4 : 3,
        (crit ? "crit" : (w.type==="tranq" ? "tranq" : "hit"))
      );
      addWeaponMasteryXp(w.id, 2);
      emitDamagePopup(t.x, t.y - 44, `-${dmg}`, crit ? "crit" : (w.type==="tranq" ? "tranq" : "hit"));
      hapticImpact(crit ? "heavy" : "light");
      setBattleMsg(`${crit?'CRIT! ':''}Hit for ${dmg}. ${w.type==='tranq'?'(tranq applied)':''}`);
    }

    if(t.hp<=0){
      finishTigerKillWithWeapon(t, w.id);
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
    scheduleTigerRetaliationAfterShot(t);
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
  keepBattleTigerBesidePlayer(t, now);
  const maxRange = Number.isFinite(opts.maxRange) ? opts.maxRange : 120;
  const distToPlayer = dist(t.x, t.y, S.me.x, S.me.y);
  if(distToPlayer > maxRange) return 0;

  if(shieldActiveNow()){
    emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(96,165,250,.95)", 2, "shield");
    emitDamagePopup(S.me.x, S.me.y - 50, "BLOCK", "shield");
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
    emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(250,204,21,.95)", 2, "dodge");
    emitDamagePopup(S.me.x, S.me.y - 50, "DODGE", "dodge");
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
  t.attackAnimKind = opts.kind || "strike";
  t.attackAnimStart = now;
  t.attackAnimUntil = now + ((opts.kind === "charge") ? 360 : (opts.kind === "pounce" ? 320 : 260));

  emitCombatFx(t.x, t.y, S.me.x, S.me.y - 4, "rgba(251,113,133,.95)", 3, "player");
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
  const now = Date.now();
  keepBattleTigerBesidePlayer(t, now);

  const d = dist(S.me.x, S.me.y, t.x, t.y);
  const rangeLimit = equippedWeaponRange();
  if(d > rangeLimit){
    const trappedHold = !!(t.holdUntil && now < t.holdUntil);
    const shieldOn = shieldActiveNow();
    if(trappedHold || shieldOn){
      if((t._rangeGraceHintAt || 0) + 950 < now){
        t._rangeGraceHintAt = now;
        setBattleMsg(trappedHold
          ? "Tiger is trapped. Keep firing while the trap holds."
          : "Shield is active. You can keep attacking while pressure is up.");
      }
    } else {
      endBattle("RETREAT");
      S.lockedTigerId = null;
      toast(`${equippedWeapon().name} lost range. Tap that tiger again when you get back in range.`);
      save();
      return;
    }
  }
  if(t.holdUntil && now < t.holdUntil){
    setBattleMsg(`Tiger #${t.id} is trapped. Attack while it is held.`);
    return;
  }

  if(isBossTiger(t)){
    const bossPhase = ensureBossPhaseState(t, bossIdentityProfile(t), now, { silent:true });
    const phaseCfg = bossPhasePreset(bossPhase);
    const phaseTempo = clamp(Number(phaseCfg.tempoMul || 1), 1, 1.35);
    if(!Number.isFinite(t.nextBossSkillAt) || t.nextBossSkillAt <= now){
      triggerBossIdentitySkill(t, bossIdentityProfile(t), now);
    }
    if(now < (t.bossStalkUntil || 0)){
      if((t._bossStalkPromptAt || 0) + 900 < now){
        t._bossStalkPromptAt = now;
        setBattleMsg(`${bossIdentityProfile(t)?.name || "Boss"} is stalking for an opening.`);
      }
      if(d < 188 && now >= (S._combatTigerAttackAt || 0)){
        S._combatTigerAttackAt = now + Math.max(520, Math.round(rand(860, 1220) / phaseTempo));
        tigerTurn(t, S._protectTicks > 0, { kind:"strike", dmgMul:1.16, maxRange:188 });
      }
      return;
    }
    if(now < (t.bossPounceChainUntil || 0) && (t.bossPounceCharges || 0) > 0 && d < 196 && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + Math.max(360, Math.round(rand(620, 900) / phaseTempo));
      tigerTurn(t, S._protectTicks > 0, { kind:"pounce", dmgMul:1.24, maxRange:196 });
      t.bossPounceCharges = Math.max(0, (t.bossPounceCharges || 0) - 1);
      if(t.bossPounceCharges <= 0) t.bossPounceChainUntil = 0;
      return;
    }
    if(now < (t.bossChargeUntil || 0) && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + Math.max(520, Math.round(rand(920, 1320) / phaseTempo));
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
    const shortAttackRange = Math.min(rangeLimit, 108);
    if(d <= shortAttackRange && now >= (S._combatTigerAttackAt || 0)){
      S._combatTigerAttackAt = now + rand(900, 1300);
      tigerTurn(t, S._protectTicks > 0, { kind:"strike", maxRange:108 });
    }
    return;
  }

  if(band === "mid"){
    const midAttackRange = Math.min(rangeLimit, 170);
    if(d <= midAttackRange && now >= (S._combatTigerAttackAt || 0)){
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
  const longAttackRange = Math.min(rangeLimit, 220);
  if(d <= longAttackRange && now >= (S._combatTigerAttackAt || 0)){
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

  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;
  const arcadeMission = (S.mode==="Arcade") ? activeArcadeMission(S) : null;
  const activeMission = storyMission || arcadeMission;
  const tAlive = S.tigers.some(t=>t.alive);
  const civTotal = S.civilians.length;
  const civDead = S.civilians.filter(c=>!c.alive).length;
  const civAlive = S.civilians.filter(c=>c.alive).length;
  const civEvac = S.civilians.filter(c=>c.alive && c.evac).length;
  const evacReady = (civAlive===0 || civEvac===civAlive);
  const captureReady = !activeMission || (S.stats.captures || 0) >= (activeMission.captureRequired || 0);
  const trapPlaceReady = !arcadeMission || (S.stats.trapsPlaced || 0) >= (arcadeMission.trapPlaceRequired || 0);
  const trapTriggerReady = !arcadeMission || (S.stats.trapsTriggered || 0) >= (arcadeMission.trapTriggerRequired || 0);
  const noKillReady = !arcadeMission || !arcadeMission.captureOnly || (S.stats.kills || 0) === 0;

  if(S.mode!=="Survival" && civTotal > 0 && civDead > 0){
    if(!S.missionEnded){
      return gameOverChoice("Mission failed: a civilian was killed. All civilians must survive.");
    }
    return;
  }

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
      ensureStoryEndgameState(S);
      const storyVariant = normalizeStoryVariant(storyMission?.storyVariant || S.storyVariant);
      S.missionEnded=true;
      markBalanceMissionResult(true, "mission-complete", S);
      addContractTally("missionsCleared", 1);
      addOpsTotal("missionsCleared", 1);
      requestGameplayCloudSync("mission-complete", { force:true });
      setPaused(true,"complete");
      transitionCleanupSweep("mission-complete");
      clearTransientCombatVisuals();
      if(S._underAttack===0) unlockAchv("clear_clean","Clean Clear");
      let heading = "Mission complete!\n";
      if(storyMission){
        if(storyVariant === STORY_VARIANTS.GAUNTLET){
          heading = `Gauntlet Run ${storyMission.runIndex} — ${storyMission.chapterName}\n${storyMission.objective}\n`;
        }else if(storyVariant === STORY_VARIANTS.ELITE_HUNT){
          heading = `Elite Hunt ${storyMission.runIndex} — Chapter ${storyMission.chapter}\n${storyMission.objective}\n`;
        }else{
          heading = `Story Mission ${storyMission.number}/100 — ${storyMission.chapterName}\n${storyMission.objective}\n`;
        }
      } else if(arcadeMission){
        if(arcadeMission.weeklySeed){
          heading = `Arcade Weekly Seed ${arcadeMission.weeklySeedKey}\n${arcadeMission.objective}\n`;
        }else{
          heading = `Arcade Mission ${arcadeMission.number}/100 — ${arcadeMission.chapterName}\n${arcadeMission.objective}\n`;
        }
      }
      let arcadeSummary = "";
      if(arcadeMission){
        const left = arcadeMissionTimeLeftSec();
        const limit = Math.max(0, Math.floor(Number(S.arcadeMissionLimitSec || 0)));
        const peak = Math.max(Math.floor(Number(S.arcadeComboPeak || 0)), Math.floor(Number(S.comboCount || 0)));
        const medal = arcadeMissionMedal();
        const bonus = Math.max(0, Math.floor(Number(S.arcadeScoreBonus || 0)));
        const missionClearSec = Math.max(
          1,
          Math.floor(
            (Date.now() - Math.max(0, Number(S.arcadeWeeklyRunStartedAt || S.arcadeMissionStartAt || Date.now())))
            / 1000
          )
        );
        const weeklySeedScore = Math.max(
          0,
          Math.floor(
            bonus +
            (left * 12) +
            (Math.max(0, civEvac) * 220) +
            ((civTotal > 0 && civEvac >= civTotal) ? 600 : 0)
          )
        );
        arcadeSummary =
          `\nArcade Medal: ${medal}` +
          `\nArcade Time Left: ${left}s / ${limit}s` +
          `\nArcade Combo Peak: x${peak}` +
          `\nArcade Score Bonus: +${bonus.toLocaleString()}\n`;
        if(arcadeMission.weeklySeed){
          ensureArcadeWeeklySeedState(S);
          const seedResult = recordArcadeWeeklyResult({
            weekKey:arcadeMission.weeklySeedKey || weeklyChallengeWeekKey(),
            missionSeedKey:arcadeMission.weeklySeedKey || weeklyChallengeWeekKey(),
            score:weeklySeedScore,
            clearSec:missionClearSec,
            civiliansSaved:civEvac,
            civiliansTotal:civTotal,
            runId:S.arcadeWeeklyRunId || "",
            updatedAt:Date.now()
          }, S);
          const bestResult = seedResult?.best || seedResult?.current || null;
          if(seedResult?.better){
            toast(`New weekly seed best: ${weeklySeedScore.toLocaleString()} pts.`);
          }
          arcadeSummary +=
            `\nWeekly Seed Score: ${weeklySeedScore.toLocaleString()}` +
            `\nWeekly Clear Time: ${missionClearSec}s` +
            `\nWeekly Civilians Saved: ${civEvac}/${civTotal}`;
          if(bestResult){
            arcadeSummary +=
              `\nWeekly Personal Best: ${Math.max(0, Number(bestResult.score || 0)).toLocaleString()} pts` +
              ` • ${Math.max(0, Number(bestResult.civiliansSaved || 0))}/${Math.max(0, Number(bestResult.civiliansTotal || 0))} saved` +
              ` • ${Math.max(0, Number(bestResult.clearSec || 0))}s`;
          }
          requestGameplayCloudSync("arcade-weekly-clear", { force:true });
          arcadeSummary += "\n";
        }
      }

      let chapterCutscene = "";
      if(storyMission && storyVariant === STORY_VARIANTS.CAMPAIGN && STORY_CHAPTER_CUTSCENES[storyMission.number]){
        chapterCutscene = `\nCutscene: ${STORY_CHAPTER_CUTSCENES[storyMission.number]}\n`;
      }

      let chapterRewardNote = "";
      if(storyMission && storyVariant === STORY_VARIANTS.CAMPAIGN && (storyMission.number % 10 === 0)){
        const reward = unlockStoryChapterReward(storyMission.chapter);
        if(reward){
          chapterRewardNote = `\nChapter Reward Unlocked: ${reward.label}${reward.grants ? ` (${reward.grants})` : ""}\n${reward.desc}\n`;
        }
      }
      let storyProgressNote = "";
      if(storyMission){
        if(storyVariant === STORY_VARIANTS.CAMPAIGN){
          const rewardDef = storyChapterRewardDef(storyMission.chapter || 1);
          if(rewardDef){
            const until = Math.max(0, ((storyMission.chapter || 1) * 10) - (storyMission.number || 1));
            storyProgressNote = until === 0
              ? `\nProgression Track: Chapter ${storyMission.chapter} reward checkpoint reached (${rewardDef.label}).\n`
              : `\nProgression Track: ${rewardDef.label} unlocks in ${until} mission${until===1?"":"s"}.\n`;
          }
        }else if(storyVariant === STORY_VARIANTS.GAUNTLET){
          storyProgressNote = `\nEndgame Loop: Gauntlet Loop ${storyMission.gauntletLoop || 1} • Difficulty x${(storyMission.endgameHpMul || 1).toFixed(2)}.\n`;
        }else if(storyVariant === STORY_VARIANTS.ELITE_HUNT){
          storyProgressNote = `\nEndgame Loop: Elite Hunts cleared ${Math.max(0, Math.floor(Number(S.eliteHuntsCleared || 0)))} • Next chapter target ${S.eliteHuntChapter}.\n`;
        }
      }

      let finalEnding = "";
      if(storyMission?.number === 100 && storyVariant === STORY_VARIANTS.CAMPAIGN){
        const choseCapture = S._storyFinalOutcome === "CAPTURE";
        finalEnding = choseCapture
          ? "\nFinal Choice: You captured the Ancient Tiger.\nEnding: Preservation ending unlocked.\nRewards Unlocked: Legendary Commander Rank • Golden Soldier Skin • Endless Jungle Mode\n"
          : "\nFinal Choice: You killed the Ancient Tiger.\nEnding: Dominance ending unlocked.\nRewards Unlocked: Legendary Commander Rank • Golden Soldier Skin • Endless Jungle Mode\n";
        S.storyEndgameUnlocked = true;
      }
      let endgamePayoutNote = "";
      if(storyMission){
        const payoutMul = clamp(Number(storyMission.endgamePayoutMul || 1), 1, 4);
        if(payoutMul > 1.001){
          const bonus = Math.round(500 + ((payoutMul - 1) * 900) + (storyMission.boss ? 240 : 0));
          if(bonus > 0){
            S.funds = Math.max(0, Math.round(Number(S.funds || 0))) + bonus;
            trackCashEarned(bonus);
            endgamePayoutNote = `\nEndgame Bonus: +$${bonus.toLocaleString()} (x${payoutMul.toFixed(2)} payout).\n`;
          }
        }
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

      const recapMeta = {
        number: activeMission?.number || gameplayCloudMission(S),
        chapterName: activeMission?.chapterName || "",
        storyVariant,
        runIndex: storyMission?.runIndex || 0,
      };
      const recap = buildMissionRecapPayload(recapMeta);
      S.lastMissionRecap = recap;
      renderCompleteRecapCard(recap);

      document.getElementById("completeText").innerText =
        `${heading}${arcadeSummary}${chapterCutscene}${chapterRewardNote}${storyProgressNote}${finalEnding}${endgamePayoutNote}${upkeepNote}\n• Tigers Killed: ${S.stats.kills}\n• Tigers Captured: ${S.stats.captures}\n• Civilians Evacuated: ${S.stats.evac}\n• Traps Set: ${S.stats.trapsPlaced||0}\n• Trap Stops: ${S.stats.trapsTriggered||0}\n• Cash Earned: $${S.stats.cashEarned.toLocaleString()}\n• Shots Fired: ${S.stats.shots}\n\nYou can Shop/Inventory and then start next mission.`;
      document.getElementById("completeOverlay").style.display="flex";
      addXP(120);
      const missionSeasonPoints = (storyMission ? 24 : 18) + ((storyMission?.boss || arcadeMission?.boss) ? 8 : 0);
      grantSeasonPassPoints(missionSeasonPoints, (storyMission?.boss || arcadeMission?.boss) ? "Boss mission clear" : "Mission clear");
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
    contractsHeartbeatTick();
    applyModeTheme(S.mode);
    // clear event text if expired
    if(S.eventTextUntil && Date.now()>S.eventTextUntil) S.eventText="";
    if(S.shieldUntil && Date.now() >= S.shieldUntil) S.shieldUntil = 0;

  document.getElementById("soundLbl").innerText = S.soundOn ? "On" : "Off";
  const soundLblMobile = document.getElementById("soundLblMobile");
  if(soundLblMobile) soundLblMobile.innerText = S.soundOn ? "On" : "Off";
  const pauseLblMobile = document.getElementById("pauseLblMobile");
  if(pauseLblMobile) pauseLblMobile.innerText = S.paused ? "Resume" : "Pause";
  const squadCmdLabel = squadCommandLabel();
  const squadCmdBtn = document.getElementById("squadCmdBtn");
  if(squadCmdBtn) squadCmdBtn.innerText = `🪖 ${squadCmdLabel}`;
  const squadCmdBtnMobile = document.getElementById("squadCmdBtnMobile");
  if(squadCmdBtnMobile) squadCmdBtnMobile.innerText = `🪖 ${squadCmdLabel}`;
  syncSquadCommandWheelUi();
  updatePerformanceLabels();
  document.getElementById("livesTxt").innerText = S.lives;
  const seasonPass = ensureSeasonPassState();
  const seasonLevelNow = seasonPassLevel(seasonPass);
  const seasonBadge = seasonPassBadgeDisplay(seasonPass);
  const seasonBanner = seasonPassBannerDisplay(seasonPass);
  const seasonFinisher = seasonPassFinisherDisplay(seasonPass);
  const displayTitle = effectiveDisplayTitle(S);

  document.getElementById("titleTxt").innerText = `${seasonBadge.icon} ${displayTitle}`;
  document.getElementById("achvTxt").innerText = `${achvCount()} • Pass Lv ${seasonLevelNow}`;
  const seasonHudTxt = document.getElementById("seasonHudTxt");
  if(seasonHudTxt){
    seasonHudTxt.innerText = `Season: ${seasonBanner.name} • Finisher: ${(seasonFinisher.icon || "✨")} ${seasonFinisher.name}`;
  }

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
  const canShieldUse = !S.paused && !S.missionEnded && !S.gameOver && (S.shields||0)>0 && !abilityOnCooldown("shield");
  const canArmorQuickUse = canQuickUseArmorPlate();
  const shieldDisabled = !(canShieldUse || canArmorQuickUse);
  document.querySelectorAll("[data-shield-btn]").forEach((btn)=>{ btn.disabled = shieldDisabled; });
  renderProtectActionButtons();
  const cacheBtn = document.getElementById("touchCacheBtn");
  if(cacheBtn){
    cacheBtn.disabled = S.paused || S.inBattle || S.missionEnded || S.gameOver || missionTwistBlackoutActive(Date.now()) || !nearestCacheInteractable(132);
  }

  document.getElementById("mapTxt").innerText = currentMap().name;

  let modeLabel=S.mode, lvl="—";
  if(S.mode==="Story"){
    const mission = storyMissionForState(S);
    const variant = normalizeStoryVariant(mission.storyVariant);
    const ngTier = Math.max(0, Math.floor(Number(S.storyNgPlusTier || 0)));
    if(variant === STORY_VARIANTS.GAUNTLET){
      modeLabel = "Gauntlet";
      lvl = mission.runIndex;
    }else if(variant === STORY_VARIANTS.ELITE_HUNT){
      modeLabel = `Elite Hunt C${mission.chapter}`;
      lvl = mission.runIndex;
    }else{
      modeLabel = ngTier > 0 ? `Story NG+${ngTier}` : "Story";
      lvl = mission.number || S.storyLevel;
    }
  }
  if(S.mode==="Arcade"){
    ensureArcadeWeeklySeedState(S);
    if(S.arcadeWeeklySeedEnabled){
      modeLabel = "Arcade Weekly";
      lvl = S.arcadeWeeklySeedKey || weeklyChallengeWeekKey();
    }else{
      modeLabel = "Arcade";
      lvl = S.arcadeLevel;
    }
  }
  if(S.mode==="Survival"){ modeLabel="Survival"; lvl=S.survivalWave; }
  document.getElementById("modeTxt").innerText = modeLabel;
  document.getElementById("lvlTxt").innerText = lvl;

  const t=currentTargetTiger();
  document.getElementById("tigerTxt").innerText = t ? `${Math.round(t.hp)}/${Math.round(t.hpMax)} (${t.type})` : "—";
  document.getElementById("tigerBar").style.width = t ? `${(t.hp/t.hpMax)*100}%` : "0%";
  const capturePctTxt = document.getElementById("capturePctTxt");
  if(capturePctTxt) capturePctTxt.innerText = captureWindowPctLabel();
  const director = ensureMissionDirectorState(S);
  const directorPhase = DIRECTOR_PHASE_CONFIG[director.phase] ? director.phase : DIRECTOR_PHASES.CALM;
  const directorPressure = clamp(Math.round(Number(director.pressure || 0)), 0, 100);
  const directorStyle = missionDirectorPhaseStyle(directorPhase);
  const directorPhaseTag = document.getElementById("directorPhaseTag");
  const directorPressureTxt = document.getElementById("directorPressureTxt");
  const directorPressureBar = document.getElementById("directorPressureBar");
  if(directorPhaseTag){
    directorPhaseTag.innerText = directorPhaseLabel(directorPhase);
    directorPhaseTag.style.background = directorStyle.tagBg;
    directorPhaseTag.style.borderColor = directorStyle.tagBorder;
    directorPhaseTag.style.color = directorStyle.tagText;
  }
  if(directorPressureTxt) directorPressureTxt.innerText = `${directorPressure}%`;
  if(directorPressureBar){
    directorPressureBar.style.width = `${directorPressure}%`;
    directorPressureBar.style.background = directorStyle.bar;
  }

  const civAlive = (S.mode==="Survival") ? "—" : `${S.civilians.filter(c=>c.alive).length}/${S.civilians.length||0}`;
  document.getElementById("civTxt").innerText = civAlive;
  document.getElementById("evacTxt").innerText = (S.mode==="Survival") ? "—" : `${S.evacDone}/${S.civilians.length||0}`;

  document.getElementById("tleftTxt").innerText = S.tigers.filter(t=>t.alive).length;
  const threatBase = (S.mode==="Survival") ? "Pressure" : (S._underAttack ? `${S._underAttack} attacks` : "Low");
  document.getElementById("threatTxt").innerText = `${threatBase} • ${directorPhaseLabel(directorPhase)} ${directorPressure}%`;

  const grace = (S.mode!=="Survival" && Date.now() < (S.civGraceUntil||0)) ? " • Civ Grace" : "";
  const storyMission = (S.mode==="Story") ? storyMissionForState(S) : null;
  const arcadeMission = (S.mode==="Arcade") ? activeArcadeMission(S) : null;
  const storyObjective = storyMission ? `${storyMission.objective}${storyObjectiveProgressText(storyMission)}` : "";
  const arcadeObjective = arcadeMission ? `${arcadeMission.objective}${arcadeObjectiveProgressText(arcadeMission)}` : "";
  const arcadeLeft = (S.mode==="Arcade") ? arcadeMissionTimeLeftSec() : 0;
  const arcadeMult = (S.mode==="Arcade") ? arcadeComboMultiplier() : 1;
  const arcadeMedal = (S.mode==="Arcade") ? arcadeMissionMedal() : "";
  const arcadeHint = (S.mode==="Arcade")
    ? ` • Timer ${arcadeLeft}s • Mult x${arcadeMult.toFixed(1)} • Medal ${arcadeMedal}${arcadeMission?.weeklySeed ? ` • Seed ${arcadeMission.weeklySeedKey}` : ""}`
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
      const variant = normalizeStoryVariant(storyMission.storyVariant);
      const civNeed = S.civilians.filter(c=>c.alive && !c.evac).length;
      const captureNeed = Math.max(0, storyMission.captureRequired || 0);
      const captureDone = Math.min(S.stats.captures || 0, captureNeed);
      if(variant === STORY_VARIANTS.GAUNTLET){
        storyOpsEl.innerText = `Gauntlet Ops: Run ${storyMission.runIndex} • Loop ${storyMission.gauntletLoop || 1} • Tigers ${S.tigers.filter(t=>t.alive).length}`;
      } else if(variant === STORY_VARIANTS.ELITE_HUNT){
        storyOpsEl.innerText = `Elite Hunt: Chapter ${storyMission.chapter} ${storyMission.bossType || "Alpha"} • Hunts cleared ${Math.max(0, Math.floor(Number(S.eliteHuntsCleared || 0)))}`;
      } else {
        const rewardTrack = storyChapterRewardPreviewText(storyMission).replace(/^Reward Track:\s*/i, "");
        const focus = captureNeed > 0
          ? `Story Ops: escort/protect civilians (${civNeed} pending) • Captures ${captureDone}/${captureNeed}`
          : `Story Ops: escort/protect civilians (${civNeed} pending)`;
        storyOpsEl.innerText = `${focus} • ${rewardTrack}`;
      }
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
  const biomeProfile = currentBiomeProfile();
  if(biomeProfile){
    assistParts.push(`Biome: ${biomeProfile.biome} • ${biomeProfile.weather}`);
    if(biomeProfile.hazardShort) assistParts.push(`Hazard: ${biomeProfile.hazardShort}`);
  }
  if((S.comboCount || 0) > 0){
    const left = Math.max(0, Math.ceil(((S.comboExpireAt || 0) - Date.now()) / 1000));
    assistParts.push(`Combo x${S.comboCount}${left ? ` (${left}s)` : ""}`);
  }
  const twistNow = Date.now();
  const tw = ensureMissionTwistState(S);
  if(tw.bridge.active && twistNow < (tw.bridge.until || 0)){
    const left = Math.max(1, Math.ceil(((tw.bridge.until || 0) - twistNow) / 1000));
    assistParts.unshift(`Twist: Bridge collapse ${left}s`);
  } else if(tw.hostage.active && twistNow < (tw.hostage.until || 0)){
    const left = Math.max(1, Math.ceil(((tw.hostage.until || 0) - twistNow) / 1000));
    const targetCiv = civilianById(tw.hostage.civId);
    const label = targetCiv ? `Civ #${targetCiv.id}` : "target";
    assistParts.unshift(`Twist: Hostage ${label} ${left}s`);
  } else if(missionTwistBlackoutActive(twistNow)){
    const left = Math.max(1, Math.ceil(((tw.blackout.until || 0) - twistNow) / 1000));
    assistParts.unshift(`Twist: Radio blackout ${left}s`);
  } else if(tw.activeType === "fog" && twistNow < (tw.activeUntil || 0)){
    const left = Math.max(1, Math.ceil(((tw.activeUntil || 0) - twistNow) / 1000));
    assistParts.unshift(`Twist: Night fog burst ${left}s`);
  }
  if(S.mode==="Arcade"){
    const limit = Math.max(0, Math.floor(Number(S.arcadeMissionLimitSec || 0)));
    const peak = Math.max(Math.floor(Number(S.arcadeComboPeak || 0)), Math.floor(Number(S.comboCount || 0)));
    const build = activeArcadeBuildcraftDef(S);
    assistParts.push(`Buildcraft: ${build.icon} ${build.name}`);
    assistParts.push(`Arcade clock: ${arcadeLeft}s/${limit}s • Medal: ${arcadeMedal}`);
    assistParts.push(`Arcade combo multiplier: x${arcadeMult.toFixed(1)} • Peak combo x${peak}`);
    if(arcadeMission?.weeklySeed){
      const wkBest = arcadeWeeklyBestForWeek(S, arcadeMission.weeklySeedKey);
      if(wkBest){
        assistParts.unshift(
          `Weekly Seed ${arcadeMission.weeklySeedKey}: Best ${Math.max(0, Number(wkBest.score || 0)).toLocaleString()} pts • ${Math.max(0, Number(wkBest.civiliansSaved || 0))}/${Math.max(0, Number(wkBest.civiliansTotal || 0))} saved • ${Math.max(0, Number(wkBest.clearSec || 0))}s`
        );
      }else{
        assistParts.unshift(`Weekly Seed ${arcadeMission.weeklySeedKey}: no run posted yet`);
      }
    }
  } else if(S.mode==="Story" && storyMission){
    const variant = normalizeStoryVariant(storyMission.storyVariant);
    if(variant === STORY_VARIANTS.CAMPAIGN){
      const reward = storyChapterRewardDef(storyMission.chapter || 1);
      const until = Math.max(0, ((storyMission.chapter || 1) * 10) - (storyMission.number || 1));
      if(reward && !storyChapterRewardUnlocked(storyMission.chapter || 1)){
        assistParts.push(until===0
          ? `Chapter reward ready after clear: ${reward.label}`
          : `Chapter reward in ${until} mission${until===1?"":"s"}: ${reward.label}`);
      }
    } else if(variant === STORY_VARIANTS.GAUNTLET){
      assistParts.push(`Gauntlet Loop ${storyMission.gauntletLoop || 1} • Difficulty x${clamp(Number(storyMission.endgameHpMul || 1), 1, 9).toFixed(2)}`);
    } else if(variant === STORY_VARIANTS.ELITE_HUNT){
      assistParts.push(`Elite Hunt Chapter ${storyMission.chapter} • Target ${storyMission.bossType || "Alpha"} • Cleared ${Math.max(0, Math.floor(Number(S.eliteHuntsCleared || 0)))}`);
    }
    if(storyMission.boss){
      const introShort = storyBossIntroText(storyMission).replace(/^Boss Intro:\s*/i, "");
      assistParts.unshift(`Boss mission: ${introShort}`);
    }
  }
  const liveOpsNow = liveOpsEntry(S);
  if(liveOpsNow){
    const liveOpsDone = Math.min(liveOpsNow.target, liveOpsEntryProgress(liveOpsNow, S));
    assistParts.push(
      liveOpsNow.claimed
        ? `Live Ops: ${liveOpsNow.title} claimed`
        : `Live Ops: ${liveOpsNow.title} ${liveOpsDone}/${liveOpsNow.target}`
    );
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
    const storyVariant = storyMission ? normalizeStoryVariant(storyMission.storyVariant) : STORY_VARIANTS.CAMPAIGN;
    mobileMissionChip.innerText =
      S.mode==="Survival"
        ? `Wave ${S.survivalWave}`
        : (S.mode==="Story" && storyMission)
          ? (storyVariant === STORY_VARIANTS.GAUNTLET
            ? `Gauntlet Run ${storyMission.runIndex} • Loop ${storyMission.gauntletLoop || 1}`
            : (storyVariant === STORY_VARIANTS.ELITE_HUNT
              ? `Elite Hunt ${storyMission.runIndex} • Ch ${storyMission.chapter}`
              : `Story ${storyMission.number}/100 • Ch ${storyMission.chapter}`))
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
    mobileThreatChip.innerText = `${threatText} • ${directorPhaseLabel(directorPhase)} ${directorPressure}%`;
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
      mobilePrompt = `Tiger #${t.id} locked. Tap it to fight.`;
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
  const loadScore = frameActiveEntityLoadScore();
  const lagTier = frameLagTier();
  const mobile = isMobileViewport();
  let minInterval = 340;
  if(mobile) minInterval = Math.max(minInterval, 460);
  if(frameIsSlow(now)) minInterval = Math.max(minInterval, mobile ? 620 : 520);
  if(performanceMode() === "PERFORMANCE") minInterval = Math.max(minInterval, mobile ? 640 : 540);
  if(lagTier >= 1) minInterval = Math.max(minInterval, mobile ? 760 : 620);
  if(lagTier >= 2) minInterval = Math.max(minInterval, mobile ? 980 : 780);
  if(loadScore >= 60) minInterval = Math.max(minInterval, mobile ? 780 : 640);
  else if(loadScore >= 44) minInterval = Math.max(minInterval, mobile ? 680 : 560);
  if(force || (now - __lastHudRender) >= minInterval){
    __lastHudRender = now;
    renderHUD();
  }
}

// ===================== CALM MAPS + FOG (no flashing) =====================
function drawMissionTwistOverlay(now=Date.now()){
  if(isMobileViewport()) return;
  const tw = ensureMissionTwistState(S);
  const worldCam = isWorldCameraActive(S);
  const camOff = worldCam ? cameraOffsetSnapshot(S) : { x:0, y:0 };
  ctx.save();
  if(tw.bridge.active && now < (tw.bridge.until || 0)){
    const left = Math.max(1, Math.ceil(((tw.bridge.until || 0) - now) / 1000));
    const pulse = 0.82 + (Math.sin(now / 180) * 0.16);
    ctx.globalAlpha = 0.22 + (pulse * 0.14);
    ctx.fillStyle = "rgba(180,48,54,.85)";
    ctx.beginPath();
    ctx.arc(tw.bridge.x, tw.bridge.y, tw.bridge.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = "rgba(252,165,165,.96)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tw.bridge.x, tw.bridge.y, tw.bridge.r + 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(tw.bridge.x, tw.bridge.y, Math.max(20, tw.bridge.r - 9), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,220,220,.92)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(tw.bridge.x - (tw.bridge.r * 0.52), tw.bridge.y - (tw.bridge.r * 0.52));
    ctx.lineTo(tw.bridge.x + (tw.bridge.r * 0.52), tw.bridge.y + (tw.bridge.r * 0.52));
    ctx.moveTo(tw.bridge.x + (tw.bridge.r * 0.52), tw.bridge.y - (tw.bridge.r * 0.52));
    ctx.lineTo(tw.bridge.x - (tw.bridge.r * 0.52), tw.bridge.y + (tw.bridge.r * 0.52));
    ctx.stroke();
    rounded(tw.bridge.x - 78, tw.bridge.y - tw.bridge.r - 34, 156, 24, 11, "rgba(44,8,12,.90)", "rgba(253,164,175,.82)");
    ctx.fillStyle = "rgba(255,226,231,.98)";
    ctx.textAlign = "center";
    ctx.font = "900 11px system-ui";
    ctx.fillText(`BRIDGE COLLAPSE ${left}s`, tw.bridge.x, tw.bridge.y - tw.bridge.r - 18);
    ctx.textAlign = "start";
  }
  if(tw.hostage.active && now < (tw.hostage.until || 0)){
    const left = Math.max(1, Math.ceil(((tw.hostage.until || 0) - now) / 1000));
    const pulse = 0.84 + (Math.sin(now / 160) * 0.14);
    ctx.globalAlpha = 0.18 + (pulse * 0.18);
    ctx.fillStyle = "rgba(236,72,153,.72)";
    ctx.beginPath();
    ctx.arc(tw.hostage.x, tw.hostage.y, tw.hostage.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "rgba(251,113,133,.98)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(tw.hostage.x, tw.hostage.y, tw.hostage.r + 1, 0, Math.PI * 2);
    ctx.stroke();
    rounded(tw.hostage.x - 74, tw.hostage.y - tw.hostage.r - 34, 148, 24, 11, "rgba(58,12,32,.92)", "rgba(251,113,133,.82)");
    ctx.fillStyle = "rgba(255,228,236,.98)";
    ctx.textAlign = "center";
    ctx.font = "900 11px system-ui";
    ctx.fillText(`HOSTAGE ${left}s`, tw.hostage.x, tw.hostage.y - tw.hostage.r - 18);
    ctx.textAlign = "start";
  }
  if(tw.blackout.active && now < (tw.blackout.until || 0)){
    const left = Math.max(1, Math.ceil(((tw.blackout.until || 0) - now) / 1000));
    const heavyDim = !isMobileViewport() && frameLagTier() <= 0 && performanceMode() !== "PERFORMANCE";
    if(heavyDim){
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "rgba(6,9,16,.98)";
      ctx.fillRect(camOff.x, camOff.y, cv.width, cv.height);
    }
    rounded(camOff.x + 16, camOff.y + 16, 194, 24, 11, "rgba(8,14,24,.92)", "rgba(148,163,184,.7)");
    ctx.globalAlpha = 0.96;
    ctx.fillStyle = "rgba(226,232,240,.96)";
    ctx.font = "900 11px system-ui";
    ctx.fillText(`📻 RADIO BLACKOUT ${left}s`, camOff.x + 26, camOff.y + 32);
  }
  ctx.restore();
}
function drawMapScene(){
  const frameNow = Date.now();
  const viewportW = Number(cv?.width || WORLD_BASE_WIDTH) || WORLD_BASE_WIDTH;
  const viewportH = Number(cv?.height || WORLD_BASE_HEIGHT) || WORLD_BASE_HEIGHT;
  const worldCam = isWorldCameraActive(S);
  const w = worldCam ? worldWidth(S) : viewportW;
  const h = worldCam ? worldHeight(S) : viewportH;
  const camOff = worldCam ? cameraOffsetSnapshot(S) : { x:0, y:0 };
  const viewPad = worldCam ? 88 : 0;
  const drawMinX = worldCam ? clamp(Math.floor(camOff.x) - viewPad, 0, w) : 0;
  const drawMinY = worldCam ? clamp(Math.floor(camOff.y) - viewPad, 0, h) : 0;
  const drawMaxX = worldCam ? clamp(Math.ceil(camOff.x + viewportW) + viewPad, drawMinX, w) : w;
  const drawMaxY = worldCam ? clamp(Math.ceil(camOff.y + viewportH) + viewPad, drawMinY, h) : h;
  const drawSpanW = Math.max(2, drawMaxX - drawMinX);
  const drawSpanH = Math.max(2, drawMaxY - drawMinY);
  const mapInfo = currentMap();
  const key = mapInfo.key;
  const missionIndex = missionIndexForMode(S.mode);
  const chapter = chapterIndexForMode(S.mode);
  const chapterStyle = chapterVisualForMode(S.mode, chapter);
  const ez = S.evacZone || DEFAULT.evacZone;
  const tw = ensureMissionTwistState(S);
  const cacheSig = [
    key, w, h, S.mode, missionIndex, chapter, S.mapIndex || 0, window.__TUTORIAL_MODE__ ? 1 : 0,
    Math.round(ez.x || 0), Math.round(ez.y || 0), Math.round(ez.r || 0),
    tw.activeType || "",
    tw.bridge.active ? 1 : 0,
    tw.hostage.active ? 1 : 0,
    tw.blackout.active ? 1 : 0
  ].join("|");
  const lagTier = frameLagTier();
  const mobile = isMobileViewport();
  const forceMobileFastMap = mobile;
  const mapLiteDetail = mobile && (forceMobileFastMap || worldCam || lagTier >= 1 || frameIsSlow());
  const ultraLiteMap = mobile && (forceMobileFastMap || lagTier >= 1 || frameIsSlow(frameNow) || frameBudgetExceeded(0.85));
  const propCullPad = worldCam ? 116 : 0;
  const propCullMinX = drawMinX - propCullPad;
  const propCullMinY = drawMinY - propCullPad;
  const propCullMaxX = drawMaxX + propCullPad;
  const propCullMaxY = drawMaxY + propCullPad;

  function inVisiblePropRange(x, y, radius=24){
    const r = Math.max(4, Number(radius) || 0);
    return (x + r) >= propCullMinX &&
      (x - r) <= propCullMaxX &&
      (y + r) >= propCullMinY &&
      (y - r) <= propCullMaxY;
  }

  function propCullRadius(kind, scale=1){
    const s = Math.max(0.5, Number(scale) || 1);
    if(kind === "building") return 48 * s;
    if(kind === "bus") return 44 * s;
    if(kind === "truck") return 40 * s;
    if(kind === "house" || kind === "park") return 34 * s;
    if(kind === "car") return 30 * s;
    if(kind === "tree" || kind === "bush") return 22 * s;
    if(kind === "fence") return 26 * s;
    return 20 * s;
  }
  let cacheAgeCap = frameIsSlow()
    ? (__frameDynamicLoadMul >= FRAME_LOAD_EXTREME ? 640 : (__frameDynamicLoadMul >= FRAME_LOAD_HIGH ? 520 : 360))
    : (__frameDynamicLoadMul >= FRAME_LOAD_HIGH ? 320 : MAP_CACHE_INTERVAL_MS);
  if(mobile){
    if(lagTier >= 2){
      cacheAgeCap = Math.max(cacheAgeCap, 1500);
    } else if(lagTier >= 1 || frameIsSlow()){
      cacheAgeCap = Math.max(cacheAgeCap, 1150);
    } else {
      cacheAgeCap = Math.max(cacheAgeCap, 560);
    }
  }
  if(!worldCam){
    const canUseCache =
      !!__mapFrameCacheCanvas &&
      __mapFrameCacheSig === cacheSig &&
      (frameNow - __mapFrameCacheAt) < cacheAgeCap;
    if(canUseCache){
      ctx.drawImage(__mapFrameCacheCanvas, 0, 0, w, h);
      return;
    }
    const hasAnyCache =
      !!__mapFrameCacheCanvas &&
      Number.isFinite(__mapFrameCacheAt) &&
      __mapFrameCacheAt > 0;
    if(hasAnyCache){
      const staleAge = frameNow - __mapFrameCacheAt;
      const emergencyReuse = frameBudgetExceeded(1.1) || frameIsSlow() || (__frameLagScore >= 4);
      const emergencyMaxAge = mobile
        ? (lagTier >= 2 ? 950 : (lagTier >= 1 ? 760 : 560))
        : (lagTier >= 2 ? 1800 : 1300);
      if(emergencyReuse && staleAge < emergencyMaxAge){
        ctx.drawImage(__mapFrameCacheCanvas, 0, 0, w, h);
        return;
      }
    }
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

  function fillSolid(color){
    ctx.fillStyle = color;
    ctx.fillRect(drawMinX, drawMinY, drawSpanW, drawSpanH);
  }
  function seedNoise(ix, iy, seed=0){
    let n = (ix * 374761393) ^ (iy * 668265263) ^ (seed * 982451653);
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }
  function terrainTexture(seed, step=30, alpha=0.08, colorA="rgba(255,255,255,.05)", colorB="rgba(0,0,0,.08)"){
    const sx = Math.floor(drawMinX / step) * step;
    const sy = Math.floor(drawMinY / step) * step;
    for(let y=sy; y<drawMaxY; y+=step){
      for(let x=sx; x<drawMaxX; x+=step){
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
  function groundShadow(x, y, rx, ry, alpha=0.24){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(5,8,14,.82)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function terrainBands(seed=0, count=4, alpha=0.08){
    ctx.save();
    for(let i=0;i<count;i++){
      const t = (i + 1) / (count + 1);
      const wobble = (seedNoise((seed + i) * 3, Math.floor(t * 100), seed + 71) - 0.5) * (h * 0.05);
      const y = (h * t) + wobble;
      const grad = ctx.createLinearGradient(0, y - 26, 0, y + 26);
      grad.addColorStop(0, `rgba(0,0,0,${alpha * 0.32})`);
      grad.addColorStop(0.5, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(drawMinX, y - 26, drawSpanW, 52);
    }
    ctx.restore();
  }
  function terrainPatches(seed=0, count=14, alpha=0.12, warm="rgba(255,245,210,.16)", cool="rgba(20,35,48,.20)"){
    ctx.save();
    const loops = worldCam ? Math.max(8, Math.round(count * 0.65)) : count;
    for(let i=0;i<loops;i++){
      const n1 = seedNoise(i + 17, seed + 29, seed + 101);
      const n2 = seedNoise(i + 43, seed + 71, seed + 149);
      const x = clamp((n1 * w), 20, w - 20);
      const y = clamp((n2 * h), 20, h - 20);
      const rx = 28 + (seedNoise(i + 91, seed + 11, seed + 7) * 56);
      const ry = 14 + (seedNoise(i + 13, seed + 53, seed + 19) * 34);
      const rot = (seedNoise(i + 31, seed + 67, seed + 83) - 0.5) * 0.8;
      const grad = ctx.createRadialGradient(x - (rx * 0.18), y - (ry * 0.14), 0, x, y, Math.max(rx, ry));
      grad.addColorStop(0, (i % 2) ? warm : cool);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha * (0.55 + (seedNoise(i + 57, seed + 89, seed + 211) * 0.8));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function scatterPebbles(seed=0, count=120, alpha=0.20, light="rgba(232,236,245,.45)", dark="rgba(6,10,16,.45)"){
    ctx.save();
    const loops = worldCam ? Math.max(32, Math.round(count * 0.62)) : count;
    for(let i=0;i<loops;i++){
      const n1 = seedNoise(i + 7, seed + 13, seed + 41);
      const n2 = seedNoise(i + 37, seed + 61, seed + 83);
      const x = n1 * w;
      const y = n2 * h;
      const r = 0.6 + (seedNoise(i + 79, seed + 97, seed + 109) * 1.6);
      ctx.globalAlpha = alpha * (0.5 + (seedNoise(i + 131, seed + 173, seed + 197) * 0.9));
      ctx.fillStyle = (i % 2) ? light : dark;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function roadLine(points,width,fill){
    ctx.strokeStyle=fill; ctx.lineWidth=width; ctx.lineCap="round"; ctx.lineJoin="round";
    ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.stroke();
  }
  function roadWear(points, width, seed=0){
    ctx.save();
    ctx.strokeStyle = "rgba(12,16,24,.16)";
    ctx.lineWidth = Math.max(2, width * 0.08);
    ctx.setLineDash([9 + (seed % 4), 11 + ((seed + 1) % 5)]);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
    ctx.strokeStyle = "rgba(250,245,235,.08)";
    ctx.lineWidth = Math.max(1.4, width * 0.045);
    ctx.setLineDash([4 + (seed % 3), 10 + ((seed + 2) % 4)]);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1] - Math.max(1, width * 0.06));
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0], points[i][1] - Math.max(1, width * 0.06));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
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
    const wavePhase = (Date.now() * 0.00135);
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

      ctx.globalAlpha = 0.26 * mul;
      ctx.strokeStyle = "rgba(7,20,28,.62)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(zone.x, zone.y, rx + 2, ry + 2, rot, 0, Math.PI * 2);
      ctx.stroke();

      const centerGrad = ctx.createRadialGradient(zone.x - (rx * 0.18), zone.y - (ry * 0.16), 0, zone.x, zone.y, Math.max(rx, ry));
      centerGrad.addColorStop(0, "rgba(220,245,255,.20)");
      centerGrad.addColorStop(0.35, "rgba(155,216,245,.12)");
      centerGrad.addColorStop(1, "rgba(20,48,66,0)");
      ctx.globalAlpha = 0.55 * mul;
      ctx.fillStyle = centerGrad;
      ctx.beginPath();
      ctx.ellipse(zone.x, zone.y, rx * 0.98, ry * 0.98, rot, 0, Math.PI * 2);
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
      ctx.ellipse(
        zone.x - (rx * 0.12) + (Math.sin(wavePhase + (zone.x * 0.01)) * 2.4),
        zone.y - (ry * 0.08) + (Math.cos(wavePhase + (zone.y * 0.01)) * 1.8),
        Math.max(6, rx * 0.54),
        Math.max(4, ry * 0.30),
        rot,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.globalAlpha = 0.34 * mul;
      ctx.strokeStyle = "rgba(186,230,253,.55)";
      ctx.lineWidth = 1.2;
      const ripple = 0.78 + (Math.sin(wavePhase * 2 + (zone.x * 0.006) + (zone.y * 0.004)) * 0.06);
      ctx.beginPath();
      ctx.ellipse(zone.x, zone.y, Math.max(8, rx * ripple), Math.max(6, ry * ripple), rot, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.22 * mul;
      ctx.strokeStyle = "rgba(220,245,255,.52)";
      ctx.lineWidth = 1;
      const stripCount = 4;
      for(let si=0; si<stripCount; si++){
        const t = (si + 1) / (stripCount + 1);
        const ly = zone.y - (ry * 0.55) + (ry * 1.1 * t) + (Math.sin(wavePhase + si + (zone.x * 0.002)) * 1.6);
        ctx.beginPath();
        ctx.moveTo(zone.x - (rx * 0.54), ly);
        ctx.quadraticCurveTo(zone.x, ly + (Math.sin(wavePhase * 1.3 + si) * 2.2), zone.x + (rx * 0.54), ly);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawProp(p){
    const px = p._abs ? p.x : (p.x * (w / 960));
    const py = p._abs ? p.y : (p.y * (h / 540));
    const s = p.s || 1;
    if(worldCam && !inVisiblePropRange(px, py, propCullRadius(p.kind, s))) return;
    if(inMapScenarioKeepout(px, py, 24 * s)) return;
    const shadowRx = (()=>{
      if(p.kind === "building") return 20 * s;
      if(p.kind === "truck" || p.kind === "bus") return 18 * s;
      if(p.kind === "house" || p.kind === "park") return 16 * s;
      if(p.kind === "car") return 14 * s;
      if(p.kind === "tree" || p.kind === "bush") return 12 * s;
      return 10 * s;
    })();
    const shadowRy = Math.max(3.5 * s, shadowRx * 0.34);
    groundShadow(px, py + (6.5 * s), shadowRx, shadowRy, 0.23);
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
      ctx.fillStyle = "rgba(15,20,28,.86)";
      ctx.beginPath(); ctx.arc(px - (10*s), py + (8*s), 3.2*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + (10*s), py + (8*s), 3.2*s, 0, Math.PI*2); ctx.fill();
      return;
    }
    if(p.kind==="truck"){
      rounded(px-(26*s), py-(11*s), 42*s, 22*s, 6*s, "rgba(110,124,140,.9)", "rgba(22,30,45,.95)");
      rounded(px+(12*s), py-(8*s), 14*s, 16*s, 4*s, "rgba(150,165,180,.85)", "rgba(24,34,46,.9)");
      ctx.fillStyle="rgba(210,228,245,.42)";
      rounded(px+(14*s), py-(6*s), 10*s, 7*s, 2*s, "rgba(210,228,245,.42)");
      ctx.fillStyle = "rgba(15,20,28,.86)";
      ctx.beginPath(); ctx.arc(px - (12*s), py + (10*s), 3.6*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + (2*s), py + (10*s), 3.6*s, 0, Math.PI*2); ctx.fill();
      return;
    }
    if(p.kind==="bus"){
      rounded(px-(30*s), py-(11*s), 60*s, 22*s, 7*s, "rgba(84,124,184,.88)", "rgba(22,30,45,.95)");
      ctx.fillStyle="rgba(210,232,255,.45)";
      for(let i=0;i<5;i++){
        rounded(px-(23*s)+(i*10*s), py-(8*s), 8*s, 6*s, 2*s, "rgba(210,232,255,.45)");
      }
      ctx.fillStyle = "rgba(15,20,28,.86)";
      ctx.beginPath(); ctx.arc(px - (18*s), py + (10*s), 3.6*s, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + (18*s), py + (10*s), 3.6*s, 0, Math.PI*2); ctx.fill();
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
      ctx.fillStyle = "rgba(84,60,34,.92)";
      rounded(px-(3*s), py-(2*s), 6*s, 12*s, 2*s, "rgba(84,60,34,.92)");
      ctx.fillStyle = "rgba(230,235,245,.50)";
      rounded(px-(11*s), py-(5*s), 6*s, 5*s, 2*s, "rgba(230,235,245,.50)");
      rounded(px+(5*s), py-(5*s), 6*s, 5*s, 2*s, "rgba(230,235,245,.50)");
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
      rounded(px-(22*s), py-(20*s), 44*s, 5*s, 2*s, "rgba(28,36,50,.85)");
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

  if(ultraLiteMap){
    fillSolid("#123023");
    const roadA = [[0,h*0.21],[250,h*0.30],[480,h*0.25],[740,h*0.34],[w,h*0.29]];
    const roadB = [[40,h*0.56],[240,h*0.50],[460,h*0.54],[640,h*0.46],[840,h*0.50],[w,h*0.44]];
    const roadC = [[40,h*0.84],[230,h*0.79],[430,h*0.82],[620,h*0.75],[820,h*0.80],[w,h*0.73]];
    roadLine(roadA, 42, "rgba(84,66,42,.82)");
    roadLine(roadB, 56, "rgba(88,70,46,.84)");
    roadLine(roadC, 50, "rgba(84,66,42,.82)");
    if(!frameBudgetExceeded(0.7)){
      for(let y=drawMinY + 16; y<drawMaxY; y+=48){
        for(let x=drawMinX + 20; x<drawMaxX; x+=54){
          const n = seedNoise((x / 24) | 0, (y / 24) | 0, 17);
          if(n < 0.72) continue;
          treeDot(x + ((n - 0.5) * 8), y + ((0.5 - n) * 6), 5.2 + (n * 2.6));
        }
      }
    }
  }
  else if(themeKey==="ST_FOREST"){
    fillSolid("#0f2b1c");
    ctx.fillStyle="rgba(18,66,40,.34)";
    ctx.fillRect(0,0,w,h);
    terrainTexture(11, 30, 0.09, "rgba(74,222,128,.10)", "rgba(0,0,0,.12)");
    terrainBands(11, 5, 0.07);
    terrainPatches(11, 16, 0.11, "rgba(180,235,160,.14)", "rgba(15,38,20,.18)");
    scatterPebbles(11, 86, 0.12, "rgba(168,212,156,.36)", "rgba(8,18,10,.34)");
    const upperRoad = h * 0.18;
    const midRoad = h * 0.43;
    const lowRoad = h * 0.72;
    const roadA = [[0,upperRoad],[240,upperRoad + 70],[470,upperRoad + 28],[720,upperRoad + 92],[960,upperRoad + 52]];
    const roadB = [[60,midRoad],[260,midRoad - 40],[450,midRoad - 10],[610,midRoad - 70],[820,midRoad - 40],[940,midRoad - 100]];
    const roadC = [[50,lowRoad],[260,lowRoad - 34],[450,lowRoad - 8],[610,lowRoad - 58],[820,lowRoad - 26],[940,lowRoad - 82]];
    roadShoulder(roadA, 48); roadLine(roadA, 48, "rgba(80,60,38,.85)");
    roadShoulder(roadB, 62); roadLine(roadB, 62, "rgba(90,70,45,.85)");
    roadShoulder(roadC, 56); roadLine(roadC, 56, "rgba(84,66,42,.82)");
    roadWear(roadA, 48, 11);
    roadWear(roadB, 62, 19);
    roadWear(roadC, 56, 27);
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
    terrainBands(19, 4, 0.065);
    terrainPatches(19, 14, 0.10, "rgba(226,236,210,.14)", "rgba(20,28,34,.16)");
    scatterPebbles(19, 94, 0.11, "rgba(214,224,236,.30)", "rgba(12,18,28,.30)");
    const main=[[0,280],[240,270],[480,300],[720,280],[960,300]];
    roadShoulder(main, 84); roadLine(main, 84, "rgba(75,78,86,.9)");
    roadWear(main, 84, 9);
    dashed(main);
    const laneTop = [[120,120],[420,110],[760,120]];
    const laneLow = [[120,440],[420,430],[760,440]];
    roadShoulder(laneTop, 62); roadLine(laneTop, 62, "rgba(75,78,86,.9)");
    roadShoulder(laneLow, 62); roadLine(laneLow, 62, "rgba(75,78,86,.9)");
    roadWear(laneTop, 62, 13);
    roadWear(laneLow, 62, 15);
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
    terrainBands(29, 4, 0.055);
    terrainPatches(29, 12, 0.08, "rgba(188,204,236,.12)", "rgba(8,12,20,.15)");
    scatterPebbles(29, 110, 0.11, "rgba(220,228,246,.28)", "rgba(7,10,17,.32)");
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
    terrainBands(41, 4, 0.062);
    terrainPatches(41, 14, 0.09, "rgba(226,196,150,.12)", "rgba(10,10,12,.16)");
    scatterPebbles(41, 90, 0.12, "rgba(220,200,172,.32)", "rgba(8,8,10,.34)");
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
  if(!ultraLiteMap){
    drawWaterBodies(1);
  }

  if(chapterStyle?.tint){
    ctx.fillStyle = chapterStyle.tint;
    ctx.fillRect(drawMinX, drawMinY, drawSpanW, drawSpanH);
  }
  if(chapterStyle?.haze){
    const haze = ctx.createLinearGradient(0, drawMinY, 0, drawMaxY);
    haze.addColorStop(0, chapterStyle.haze);
    haze.addColorStop(0.45, "rgba(0,0,0,0)");
    haze.addColorStop(1, "rgba(0,0,0,.03)");
    ctx.fillStyle = haze;
    ctx.fillRect(drawMinX, drawMinY, drawSpanW, drawSpanH);
  }

  // realism props (disabled in ultra-lite to keep mobile frame time stable)
  if(!ultraLiteMap){
    const props = MAP_REALISM_PROPS[themeKey] || [];
    if(mapLiteDetail){
      for(let i=0; i<props.length; i++){
        const p = props[i];
        if(!p || (i % 2 !== 0)) continue;
        if(p.kind === "house" || p.kind === "car" || p.kind === "truck" || p.kind === "park" || p.kind === "building"){
          drawProp(p);
        }
      }
    } else {
      for(const p of props) drawProp(p);
    }
    const denseLandmarks = (__mapDenseLandmarksSig === __mapObstacleSig && Array.isArray(__mapDenseLandmarks))
      ? __mapDenseLandmarks
      : buildDenseLandmarks(key, chapter, w, h);
    const extraScale = 1 + (chapterStyle?.landmarkScale || 0);
    for(let i=0; i<denseLandmarks.length; i++){
      if(mapLiteDetail && (i % 3 !== 0)) continue;
      const lm = denseLandmarks[i];
      if(!lm) continue;
      if(worldCam && !inVisiblePropRange(lm.x, lm.y, 40 * extraScale)) continue;
      drawProp({ ...lm, _abs:true, s:(lm.s || 1) * extraScale });
    }
  }

  // subtle vignette to reduce flatness
  const vgX = worldCam ? (camOff.x + (viewportW * 0.5)) : (w * 0.5);
  const vgY = worldCam ? (camOff.y + (viewportH * 0.48)) : (h * 0.48);
  const vgNear = worldCam ? (Math.max(viewportW, viewportH) * 0.28) : (h * 0.25);
  const vgFar = worldCam ? (Math.max(viewportW, viewportH) * 0.92) : (h * 0.85);
  const vignette = ctx.createRadialGradient(vgX, vgY, vgNear, vgX, vgY, vgFar);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.22)");
  ctx.fillStyle = vignette;
  ctx.fillRect(drawMinX, drawMinY, drawSpanW, drawSpanH);

  if(S.mode==="Arcade"){
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const arcadeTint = ctx.createLinearGradient(0, 0, w, h);
    arcadeTint.addColorStop(0, "rgba(34,211,238,.11)");
    arcadeTint.addColorStop(1, "rgba(192,132,252,.12)");
    ctx.fillStyle = arcadeTint;
    ctx.fillRect(drawMinX, drawMinY, drawSpanW, drawSpanH);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = "rgba(255,255,255,.65)";
    for(let y=Math.max(8, drawMinY); y<drawMaxY; y+=18){
      ctx.fillRect(drawMinX, y, drawSpanW, 1);
    }
    ctx.restore();
  } else if(S.mode==="Story"){
    ctx.save();
    const storyTint = ctx.createLinearGradient(0, drawMinY, 0, drawMaxY);
    storyTint.addColorStop(0, "rgba(245,158,11,.06)");
    storyTint.addColorStop(1, "rgba(59,130,246,.05)");
    ctx.fillStyle = storyTint;
    ctx.fillRect(drawMinX, drawMinY, drawSpanW, drawSpanH);
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

  if(!worldCam){
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
}
function drawMapDynamicOverlays(now=Date.now()){
  const worldCam = isWorldCameraActive(S);
  const camOff = worldCam ? cameraOffsetSnapshot(S) : { x:0, y:0 };
  const mobile = isMobileViewport();
  for(const tr of (S.trapsPlaced || [])){
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = "rgba(58,120,255,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Mobile stability: skip heavy dynamic overlays entirely.
  if(mobile){
    return;
  }

  if(S.scanPing > 0){
    S.scanPing = Math.max(0, S.scanPing - 1);
    const t = currentTargetTiger();
    if(t){
      const r = 40 + (140 - S.scanPing) * 1.3;
      ctx.globalAlpha = Math.max(0, S.scanPing / 260);
      ctx.strokeStyle = "rgba(245,158,11,.18)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  drawMissionTwistOverlay(now);

  if(now < (S.fogUntil || 0)){
    const fogW = worldCam ? (cv.width || WORLD_BASE_WIDTH) : (cv.width || WORLD_BASE_WIDTH);
    const fogH = worldCam ? (cv.height || WORLD_BASE_HEIGHT) : (cv.height || WORLD_BASE_HEIGHT);
    const fogX = worldCam ? camOff.x : 0;
    const fogY = worldCam ? camOff.y : 0;
    ctx.globalAlpha = isMobileViewport() ? 0.10 : 0.35;
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(fogX, fogY, fogW, fogH);
    ctx.globalAlpha = 1;
  }
}

function drawAtmosphericParallax(nowTs=Date.now()){
  const mode = performanceMode();
  const slow = frameIsSlow();
  const lagTier = frameLagTier();
  if(isMobileViewport()) return;
  if(mode === "PERFORMANCE" && (__frameHeavyFxFlip % 2 !== 0)) return;
  if(lagTier >= 2 && (__frameHeavyFxFlip % 2 !== 0)) return;
  if(slow && (__frameHeavyFxFlip % 3 === 1)) return;

  const w = cv.width;
  const h = cv.height;
  const biome = currentBiomeProfile();
  const weatherFx = String(biome?.weatherFx || "clear");
  const weatherIntensity = clamp(Number(biome?.weatherIntensity || 0.45), 0.12, 1.25);
  let hazeLayers = mode === "PERFORMANCE" ? 1 : (slow ? 2 : 3);
  let streakCount = mode === "PERFORMANCE" ? 6 : (slow ? 9 : 14);
  if(weatherFx === "mist" || weatherFx === "snow") hazeLayers += 1;
  if(weatherFx === "rain" || weatherFx === "storm") streakCount += slow ? 2 : 4;
  const t = nowTs * 0.00006;

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  let hazeCore = "rgba(147,197,253,";
  let hazeMid = "rgba(148,163,184,";
  if(weatherFx === "ash"){
    hazeCore = "rgba(251,191,36,";
    hazeMid = "rgba(253,186,116,";
  } else if(weatherFx === "snow"){
    hazeCore = "rgba(219,234,254,";
    hazeMid = "rgba(226,232,240,";
  } else if(weatherFx === "mist" || weatherFx === "storm"){
    hazeCore = "rgba(186,230,253,";
    hazeMid = "rgba(203,213,225,";
  } else if(weatherFx === "dust"){
    hazeCore = "rgba(253,224,155,";
    hazeMid = "rgba(251,191,36,";
  }
  for(let i=0; i<hazeLayers; i++){
    const phase = (i * 1.67);
    const x = ((Math.sin((t * (0.8 + i * 0.12)) + phase) + 1) * 0.5) * w;
    const y = ((Math.cos((t * (0.66 + i * 0.1)) + (phase * 0.8)) + 1) * 0.5) * h;
    const rx = (w * (0.34 - (i * 0.06)));
    const ry = (h * (0.24 - (i * 0.04)));
    const grad = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    const coreA = Math.max(0.02, (0.11 - (i * 0.02)) * (0.72 + weatherIntensity * 0.4));
    const midA = Math.max(0.01, (0.05 - (i * 0.009)) * (0.70 + weatherIntensity * 0.32));
    grad.addColorStop(0, `${hazeCore}${coreA})`);
    grad.addColorStop(0.52, `${hazeMid}${midA})`);
    grad.addColorStop(1, "rgba(15,23,42,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.globalCompositeOperation = "source-over";

  let streakColor = "rgba(226,232,240,.55)";
  if(weatherFx === "rain" || weatherFx === "storm") streakColor = "rgba(186,230,253,.60)";
  else if(weatherFx === "ash") streakColor = "rgba(253,186,116,.55)";
  else if(weatherFx === "dust") streakColor = "rgba(253,224,155,.52)";
  for(let i=0; i<streakCount; i++){
    const p = ATMOS_PARTICLES[i % ATMOS_PARTICLES.length];
    const px = ((p.u * w) + ((t * (26 + (p.drift * 22)) * p.depth) % (w + 120))) % (w + 120) - 60;
    const py = (p.v * h) + Math.sin(t * (1.9 + p.depth) + (i * 0.8)) * (8 + (p.depth * 10));
    const len = 22 + (p.size * 20);
    const alpha = p.alpha * (slow ? 0.7 : 1);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = streakColor;
    ctx.lineWidth = 1 + (p.size * 0.45);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + len, py + (4 * p.depth));
    ctx.stroke();
  }

  const fxDensityBase = mode === "PERFORMANCE" ? 0.55 : (slow ? 0.78 : 1);
  const fxCount = Math.max(8, Math.round((10 + (weatherIntensity * 22)) * fxDensityBase));
  if(weatherFx === "rain" || weatherFx === "storm"){
    const rainCount = weatherFx === "storm" ? Math.round(fxCount * 1.25) : fxCount;
    const dropSpeed = weatherFx === "storm" ? 460 : 340;
    ctx.globalAlpha = weatherFx === "storm" ? 0.54 : 0.46;
    ctx.strokeStyle = weatherFx === "storm" ? "rgba(191,219,254,.78)" : "rgba(186,230,253,.72)";
    ctx.lineWidth = weatherFx === "storm" ? 1.25 : 1.05;
    for(let i=0; i<rainCount; i++){
      const drift = (nowTs * 0.001 * dropSpeed) * (1 + ((i % 5) * 0.08));
      const px = ((i * 73.17) + drift) % (w + 140) - 70;
      const py = ((i * 51.71) + (drift * 1.78)) % (h + 120) - 60;
      const len = 8 + ((i % 6) * 1.7) + (weatherIntensity * 4.2);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - (len * 0.32), py + len);
      ctx.stroke();
    }
    if(weatherFx === "storm"){
      const lightningPulse = Math.max(0, Math.sin(nowTs * 0.0049 + 0.8) + Math.sin(nowTs * 0.0073 + 2.1) - 1.72);
      if(lightningPulse > 0){
        ctx.globalAlpha = clamp(lightningPulse * 0.22, 0.04, 0.20);
        ctx.fillStyle = "rgba(226,240,255,.95)";
        ctx.fillRect(0, 0, w, h);
      }
    }
  } else if(weatherFx === "snow"){
    ctx.globalAlpha = 0.68;
    ctx.fillStyle = "rgba(241,245,249,.90)";
    for(let i=0; i<fxCount; i++){
      const drift = (nowTs * 0.001 * (26 + (i % 7) * 6));
      const px = ((i * 88.27) + drift) % (w + 90) - 45;
      const py = ((i * 49.37) + (drift * 0.78)) % (h + 110) - 55;
      const r = 0.8 + ((i % 4) * 0.34);
      ctx.beginPath();
      ctx.arc(px + (Math.sin((nowTs * 0.0012) + i) * 1.8), py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if(weatherFx === "ash" || weatherFx === "dust"){
    const ashCount = Math.round(fxCount * (weatherFx === "ash" ? 1.1 : 1));
    ctx.globalAlpha = weatherFx === "ash" ? 0.50 : 0.44;
    ctx.strokeStyle = weatherFx === "ash" ? "rgba(251,191,36,.72)" : "rgba(253,224,155,.70)";
    ctx.lineWidth = weatherFx === "ash" ? 1.08 : 0.95;
    for(let i=0; i<ashCount; i++){
      const drift = (nowTs * 0.001 * (62 + (i % 9) * 10));
      const px = ((i * 67.93) + drift) % (w + 100) - 50;
      const py = ((i * 58.19) + (drift * 0.22)) % (h + 80) - 40;
      const len = 2.5 + ((i % 5) * 0.9);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + len, py + (weatherFx === "ash" ? len * 0.46 : len * 0.22));
      ctx.stroke();
    }
  } else if(weatherFx === "mist"){
    ctx.globalAlpha = 0.28 * (0.72 + weatherIntensity * 0.36);
    const mist = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.9);
    mist.addColorStop(0, "rgba(203,213,225,.20)");
    mist.addColorStop(0.45, "rgba(226,232,240,.28)");
    mist.addColorStop(1, "rgba(148,163,184,.18)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, 0, w, h);
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
    trail: ["rgba(96,165,250,.18)", "rgba(96,165,250,.92)"],
    park: ["rgba(74,222,128,.18)", "rgba(74,222,128,.92)"],
    car: ["rgba(251,191,36,.20)", "rgba(251,191,36,.94)"],
    truck: ["rgba(248,113,113,.20)", "rgba(248,113,113,.94)"],
    house: ["rgba(244,114,182,.18)", "rgba(244,114,182,.92)"],
    cabin: ["rgba(245,158,11,.20)", "rgba(245,158,11,.94)"],
    building: ["rgba(167,139,250,.20)", "rgba(167,139,250,.94)"],
  };
  const [fill, stroke] = palette[site.kind] || palette.trail;
  const pulse = 0.82 + (Math.sin(Date.now() / 220 + (site.x * 0.01)) * 0.12);

  ctx.globalAlpha = 0.90;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(site.x, site.y, site.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.64 * pulse;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(site.x, site.y, site.r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = "rgba(220,235,255,.88)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(site.x, site.y, Math.max(12, site.r - 5), 0, Math.PI * 2);
  ctx.stroke();

  function drawWheel(wx, wy, rr=3.2){
    ctx.fillStyle = "rgba(10,14,20,.95)";
    ctx.beginPath(); ctx.arc(wx, wy, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(150,162,180,.62)";
    ctx.beginPath(); ctx.arc(wx, wy, rr * 0.45, 0, Math.PI * 2); ctx.fill();
  }

  ctx.globalAlpha = 0.96;
  if(site.kind==="car"){
    ctx.fillStyle = "rgba(50,108,185,.95)";
    roundedRectFill(site.x - 15, site.y - 7, 30, 14, 5);
    ctx.fillStyle = "rgba(180,220,250,.55)";
    roundedRectFill(site.x - 8, site.y - 10, 16, 6, 3);
    ctx.fillStyle = "rgba(220,233,248,.40)";
    roundedRectFill(site.x - 6, site.y - 9, 5, 4, 2);
    roundedRectFill(site.x + 1, site.y - 9, 5, 4, 2);
    drawWheel(site.x - 9, site.y + 7.2, 3.1);
    drawWheel(site.x + 9, site.y + 7.2, 3.1);
  } else if(site.kind==="truck"){
    ctx.fillStyle = "rgba(112,126,146,.95)";
    roundedRectFill(site.x - 20, site.y - 8, 26, 16, 4);
    ctx.fillStyle = "rgba(156,173,194,.96)";
    roundedRectFill(site.x + 7, site.y - 7, 13, 14, 3);
    ctx.fillStyle = "rgba(208,228,248,.42)";
    roundedRectFill(site.x + 10, site.y - 5, 7, 5, 2);
    drawWheel(site.x - 12, site.y + 8.5, 3.2);
    drawWheel(site.x - 1, site.y + 8.5, 3.2);
    drawWheel(site.x + 13, site.y + 8.5, 3.2);
  } else if(site.kind==="house"){
    ctx.fillStyle = "rgba(206,188,160,.96)";
    roundedRectFill(site.x - 13, site.y - 9, 26, 18, 4);
    ctx.fillStyle = "rgba(110,66,38,.95)";
    ctx.beginPath();
    ctx.moveTo(site.x - 16, site.y - 9);
    ctx.lineTo(site.x, site.y - 22);
    ctx.lineTo(site.x + 16, site.y - 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(90,56,34,.95)";
    roundedRectFill(site.x - 2, site.y - 1, 4, 10, 1.8);
    ctx.fillStyle = "rgba(220,234,250,.50)";
    roundedRectFill(site.x - 9, site.y - 5, 5, 5, 1.6);
    roundedRectFill(site.x + 4, site.y - 5, 5, 5, 1.6);
  } else if(site.kind==="cabin"){
    ctx.fillStyle = "rgba(160,108,66,.96)";
    roundedRectFill(site.x - 13, site.y - 9, 26, 18, 4);
    ctx.fillStyle = "rgba(116,70,35,.96)";
    ctx.beginPath();
    ctx.moveTo(site.x - 16, site.y - 9);
    ctx.lineTo(site.x, site.y - 21);
    ctx.lineTo(site.x + 16, site.y - 9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(134,88,52,.92)";
    ctx.lineWidth = 1.1;
    for(let i=-10;i<=10;i+=5){
      ctx.beginPath();
      ctx.moveTo(site.x - 12, site.y - 6 + (i * 0.2));
      ctx.lineTo(site.x + 12, site.y - 6 + (i * 0.2));
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(86,52,28,.95)";
    roundedRectFill(site.x - 2, site.y - 1, 4, 10, 1.8);
  } else if(site.kind==="building"){
    ctx.fillStyle = "rgba(96,108,132,.96)";
    roundedRectFill(site.x - 14, site.y - 16, 28, 32, 4);
    ctx.fillStyle = "rgba(28,36,52,.86)";
    roundedRectFill(site.x - 14, site.y - 16, 28, 4, 2);
    ctx.fillStyle = "rgba(214,228,245,.48)";
    for(let row=0; row<3; row++){
      for(let col=0; col<2; col++){
        roundedRectFill(site.x - 9 + (col * 9), site.y - 11 + (row * 8), 5, 5, 1.2);
      }
    }
    ctx.fillStyle = "rgba(38,48,66,.90)";
    roundedRectFill(site.x - 2.2, site.y + 6, 4.4, 10, 1.8);
  } else if(site.kind==="park"){
    ctx.fillStyle = "rgba(27,121,70,.96)";
    ctx.beginPath(); ctx.arc(site.x - 6, site.y - 6, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(site.x + 3, site.y - 8, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(92,58,30,.95)";
    roundedRectFill(site.x - 3, site.y - 1, 4, 11, 1.6);
    ctx.fillStyle = "rgba(117,84,54,.96)";
    roundedRectFill(site.x + 6, site.y + 3, 11, 3, 1.2);
    roundedRectFill(site.x + 6, site.y + 6, 2, 4, 0.8);
    roundedRectFill(site.x + 15, site.y + 6, 2, 4, 0.8);
  } else {
    ctx.fillStyle = "rgba(231,245,255,.92)";
    roundedRectFill(site.x - 2.2, site.y - 16, 4.4, 22, 1.6);
    ctx.beginPath();
    ctx.moveTo(site.x + 2.2, site.y - 15);
    ctx.lineTo(site.x + 16, site.y - 9);
    ctx.lineTo(site.x + 2.2, site.y - 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(18,38,64,.85)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(site.x - 9, site.y + 10);
    ctx.lineTo(site.x + 11, site.y + 10);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.96;
  const badgeW = Math.max(92, Math.min(150, site.label.length * 6.2));
  roundedRectFill(site.x - (badgeW / 2), site.y + site.r + 6, badgeW, 16, 8);
  ctx.fillStyle = "rgba(8,12,18,.88)";
  roundedRectFill(site.x - (badgeW / 2) + 1.5, site.y + site.r + 7.5, badgeW - 3, 13, 6);
  ctx.fillStyle = "rgba(240,246,255,.96)";
  ctx.font = "900 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(site.label, site.x, site.y + site.r + 18);
  const hostageTw = S?.missionTwists?.hostage;
  if(
    hostageTw &&
    hostageTw.active &&
    Date.now() < (hostageTw.until || 0) &&
    Number(hostageTw.siteId || 0) === Number(site.id || -1)
  ){
    const left = Math.max(1, Math.ceil(((hostageTw.until || 0) - Date.now()) / 1000));
    ctx.fillStyle = "rgba(58,12,32,.95)";
    roundedRectFill(site.x - 52, site.y - site.r - 24, 104, 16, 8);
    ctx.fillStyle = "rgba(10,14,22,.90)";
    roundedRectFill(site.x - 50.5, site.y - site.r - 22.5, 101, 13, 6);
    ctx.fillStyle = "rgba(251,113,133,.98)";
    ctx.font = "900 10px system-ui";
    ctx.fillText(`HOSTAGE ${left}s`, site.x, site.y - site.r - 12);
  }
  ctx.textAlign = "start";
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
function smoothedDrawPoint(entity, targetX, targetY, stiffness=0.38){
  if(!entity || !Number.isFinite(targetX) || !Number.isFinite(targetY)){
    return { x:targetX, y:targetY };
  }
  const now = performance.now ? performance.now() : Date.now();
  if(!Number.isFinite(entity.__drawX) || !Number.isFinite(entity.__drawY)){
    entity.__drawX = targetX;
    entity.__drawY = targetY;
    entity.__drawAt = now;
    return { x:targetX, y:targetY };
  }
  const prevAt = Number(entity.__drawAt) || now;
  const dt = clamp(now - prevAt, 0, 50);
  entity.__drawAt = now;
  const snapDist = 120;
  const dx = targetX - entity.__drawX;
  const dy = targetY - entity.__drawY;
  if((dx*dx + dy*dy) > (snapDist * snapDist)){
    entity.__drawX = targetX;
    entity.__drawY = targetY;
    return { x:targetX, y:targetY };
  }
  const blend = clamp(stiffness * (dt / 16.7), 0.14, 0.68);
  entity.__drawX += dx * blend;
  entity.__drawY += dy * blend;
  return { x:entity.__drawX, y:entity.__drawY };
}
function currentDrawPoint(entity, fallbackX, fallbackY){
  if(entity && Number.isFinite(entity.__drawX) && Number.isFinite(entity.__drawY)){
    return { x:entity.__drawX, y:entity.__drawY };
  }
  return { x:fallbackX, y:fallbackY };
}
function drawOnMapBattleReadability(){
  if(!S.inBattle) return;
  const t = activeTiger();
  if(!t || !t.alive) return;
  if(frameLagTier() >= 2 && (frameIsSlow() || frameBudgetExceeded(0.45))) return;
  const now = Date.now();
  const heavy = visualReadabilityHeavyMode();
  const extreme = visualExtremeLoadMode();
  const lagTier = frameLagTier();
  const mobile = isMobileViewport();
  let minInterval = mobile ? 34 : 0;
  if(heavy) minInterval = Math.max(minInterval, mobile ? 88 : 70);
  if(lagTier >= 1) minInterval = Math.max(minInterval, mobile ? 120 : 92);
  if(extreme || lagTier >= 2) minInterval = Math.max(minInterval, mobile ? 150 : 120);
  if(minInterval > 0 && (now - (__battleReadabilityRenderAt || 0)) < minInterval) return;
  __battleReadabilityRenderAt = now;
  const p = currentDrawPoint(S.me, S.me.x, S.me.y);
  const tp = currentDrawPoint(t, t.x, t.y);
  const dx = tp.x - p.x;
  const dy = tp.y - p.y;
  const d = Math.hypot(dx, dy);
  const mx = (p.x + tp.x) * 0.5;
  const my = (p.y + tp.y) * 0.5;
  const focusR = clamp((d * 0.68) + 140, 160, Math.max(cv.width, cv.height) * 0.7);
  const range = equippedWeaponRange();
  const inRange = d <= range;

  ctx.save();
  if(!extreme){
    const vignette = ctx.createRadialGradient(mx, my, focusR * 0.32, mx, my, focusR);
    vignette.addColorStop(0, "rgba(8,12,18,0)");
    vignette.addColorStop(0.7, "rgba(8,12,18,.10)");
    vignette.addColorStop(1, "rgba(5,8,14,.34)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cv.width, cv.height);
  }

  const beamAlpha = inRange ? (extreme ? 0.30 : 0.38) : (extreme ? 0.18 : 0.22);
  ctx.strokeStyle = inRange ? `rgba(74,222,128,${beamAlpha})` : `rgba(251,191,36,${beamAlpha})`;
  ctx.lineWidth = inRange ? (extreme ? 2.0 : 2.6) : (extreme ? 1.8 : 2.2);
  ctx.setLineDash(inRange ? (extreme ? [5,5] : [8,6]) : [4,6]);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 4);
  ctx.lineTo(tp.x, tp.y - 4);
  ctx.stroke();
  ctx.setLineDash([]);

  if(!extreme){
    ctx.strokeStyle = inRange ? "rgba(74,222,128,.85)" : "rgba(251,191,36,.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tp.x, tp.y, 40, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
function drawOnMapBattleHud(){
  if(!S.inBattle) return;
  const t = activeTiger();
  if(!t || !t.alive) return;
  if(frameLagTier() >= 2 && frameBudgetExceeded(0.55)) return;
  const now = Date.now();
  const heavy = visualReadabilityHeavyMode();
  const extreme = visualExtremeLoadMode();
  const lagTier = frameLagTier();
  const mobile = isMobileViewport();
  let minInterval = mobile ? 40 : 0;
  if(heavy) minInterval = Math.max(minInterval, mobile ? 120 : 95);
  if(lagTier >= 1) minInterval = Math.max(minInterval, mobile ? 150 : 120);
  if(extreme || lagTier >= 2) minInterval = Math.max(minInterval, mobile ? 190 : 150);
  if(minInterval > 0 && (now - (__battleHudRenderAt || 0)) < minInterval) return;
  __battleHudRenderAt = now;
  const panelW = Math.min(cv.width - 16, 320);
  const panelX = 8;
  const panelY = 8;
  const panelH = extreme ? 42 : 48;
  const hpRatio = clamp((S.hp || 0) / 100, 0, 1);
  const armorCap = Math.max(1, Number(S.armorCap) || 100);
  const armorRatio = clamp((S.armor || 0) / armorCap, 0, 1);
  const tigerRatio = clamp((t.hp || 0) / Math.max(1, t.hpMax || 1), 0, 1);
  const tigerPct = Math.round(tigerRatio * 100);
  const lowHpPulse = hpRatio <= 0.28 ? (0.62 + (Math.sin(Date.now() / 110) * 0.28)) : 0;

  ctx.save();
  ctx.fillStyle = "rgba(8,12,18,.78)";
  roundedRectFill(panelX, panelY, panelW, panelH, 10);
  ctx.strokeStyle = lowHpPulse > 0 ? `rgba(248,113,113,${clamp(lowHpPulse, 0.25, 0.95)})` : "rgba(148,163,184,.42)";
  ctx.lineWidth = lowHpPulse > 0 ? 2 : 1.2;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

  const leftX = panelX + 10;
  const rightX = panelX + (panelW * 0.52);
  ctx.fillStyle = "rgba(241,245,249,.94)";
  ctx.font = extreme ? "800 9px system-ui" : "800 10px system-ui";
  ctx.fillText(`AGENT HP ${Math.round(hpRatio * 100)}%`, leftX, panelY + 13);
  ctx.fillText(`${t.type.toUpperCase()} ${tigerPct}%`, rightX, panelY + 13);

  ctx.fillStyle = "rgba(8,12,18,.9)";
  ctx.fillRect(leftX, panelY + 18, panelW * 0.42, extreme ? 7 : 8);
  ctx.fillRect(rightX, panelY + 18, panelW * 0.42, extreme ? 7 : 8);
  ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : (hpRatio > 0.25 ? "#f59e0b" : "#fb7185");
  ctx.fillRect(leftX, panelY + 18, (panelW * 0.42) * hpRatio, extreme ? 7 : 8);
  ctx.fillStyle = tigerRatio > 0.5 ? "#4ade80" : (tigerRatio > 0.25 ? "#f59e0b" : "#fb7185");
  ctx.fillRect(rightX, panelY + 18, (panelW * 0.42) * tigerRatio, extreme ? 7 : 8);

  ctx.fillStyle = "rgba(241,245,249,.88)";
  ctx.font = "700 9px system-ui";
  ctx.fillText(`AR ${Math.round(armorRatio * 100)}%`, leftX, panelY + (extreme ? 36 : 40));
  ctx.fillStyle = "rgba(8,12,18,.9)";
  ctx.fillRect(leftX + 36, panelY + (extreme ? 31 : 34), panelW * 0.20, extreme ? 5 : 6);
  ctx.fillStyle = armorRatio > 0.5 ? "rgba(96,165,250,.96)" : "rgba(147,197,253,.92)";
  ctx.fillRect(leftX + 36, panelY + (extreme ? 31 : 34), (panelW * 0.20) * armorRatio, extreme ? 5 : 6);

  ctx.fillStyle = "rgba(241,245,249,.86)";
  ctx.fillText(`DIST ${Math.round(dist(S.me.x, S.me.y, t.x, t.y))}m`, rightX, panelY + (extreme ? 36 : 40));
  ctx.restore();
}

function drawCivilian(c){
  const smooth = smoothedDrawPoint(c, c.x, c.y, c.following ? 0.44 : 0.34);
  const cx = smooth.x;
  const cy = smooth.y;
  drawWaterRipple(cx, cy, 16, 0.50);
  ctx.save();
  ctx.globalAlpha = S.inBattle ? 0.34 : 0.24;
  ctx.strokeStyle = S.inBattle ? "rgba(254,240,138,.95)" : "rgba(236,253,245,.95)";
  ctx.lineWidth = S.inBattle ? 3.0 : 2.3;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, S.inBattle ? 20 : 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if(civilianShielded(c)){
    const pulse = 0.82 + Math.sin(Date.now()/120) * 0.15;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "rgba(96,165,250,.92)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy - 4, 20, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  const face = Number.isFinite(c.face) ? c.face : 0;
  const dir = Math.cos(face) >= 0 ? 1 : -1;
  const strideAmp = c.following ? 2.2 : 0.7;
  const stride = Math.sin(((c.step || 0) * 2.3) + (c.id * 0.4)) * strideAmp;
  const breath = Math.sin((Date.now() * 0.0042) + (c.id * 0.9)) * 0.45;
  const bx = cx;
  const by = cy + breath;

  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(dir, 1);

  ctx.strokeStyle = "rgba(8,12,18,.42)";
  ctx.lineWidth = 1.25;

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
  ctx.strokeStyle="rgba(9,12,18,.44)";
  ctx.lineWidth=1;
  ctx.strokeRect(-9, -12, 18, 24);
  ctx.strokeRect(-9.5, -12.5, 19, 25);
  ctx.fillStyle="rgba(255,255,255,.16)";
  roundedRectFill(-7, -10, 14, 9, 4);
  ctx.fillStyle="rgba(20,28,40,.44)";
  roundedRectFill(-3, -8, 6, 14, 2);
  ctx.fillStyle = "rgba(22,30,42,.56)";
  roundedRectFill(-0.8, -9, 1.6, 18, 1);
  ctx.fillStyle = "rgba(220,235,255,.14)";
  roundedRectFill(-6, -11, 12, 3, 2);

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
  ctx.fillStyle = "rgba(38,45,60,.88)";
  roundedRectFill(5.6, -14, 5.4, 10, 2.5);

  ctx.fillStyle=c.skin;
  ctx.beginPath(); ctx.arc(0, -18, 8.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "rgba(255,232,210,.26)";
  ctx.beginPath(); ctx.ellipse(-2, -20, 3.4, 2.1, -0.2, 0, Math.PI*2); ctx.fill();

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

  ctx.fillStyle = "rgba(10,14,20,.85)";
  roundedRectFill(-9, 12, 7, 2.6, 1.2);
  roundedRectFill(2, 12, 7, 2.6, 1.2);

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
  if(!rolling){
    const smooth = smoothedDrawPoint(S.me, px, py, 0.50);
    px = smooth.x;
    py = smooth.y;
  } else {
    S.me.__drawX = px;
    S.me.__drawY = py;
    S.me.__drawAt = performance.now ? performance.now() : Date.now();
  }
  const bob = rolling ? 0 : (Math.sin(step) * 1.5) + (Math.sin(step * 2.2) * 0.45);
  const x = px;
  const y = py + bob;
  const meHitFlashLeft = Math.max(0, (S.meHitFlashUntil || 0) - now);
  const meHitFlashAlpha = meHitFlashLeft > 0
    ? clamp((meHitFlashLeft / 190) * (Number(S.meHitFlashPower) || 0.7), 0.12, 0.86)
    : 0;
  const palette = seasonSoldierPalette();
  ctx.save();
  ctx.globalAlpha = S.inBattle ? 0.40 : 0.26;
  ctx.strokeStyle = S.inBattle ? "rgba(56,189,248,.98)" : "rgba(226,232,240,.90)";
  ctx.lineWidth = S.inBattle ? 3.8 : 2.4;
  ctx.beginPath();
  ctx.arc(x, y - 2, S.inBattle ? 25 : 20, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  drawWaterRipple(x, y, 18, 0.56);
  if(meHitFlashAlpha > 0){
    ctx.save();
    ctx.globalAlpha = meHitFlashAlpha;
    ctx.strokeStyle = "rgba(248,113,113,.96)";
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.arc(x, y - 2, 29, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const ang = S.me.face || 0;
  const dir = Math.cos(ang) >= 0 ? 1 : -1;
  const stride = rolling ? 0 : (Math.sin(step * 1.9) * 2.1);
  const shoulderShift = rolling ? 0 : (Math.sin(step * 2.1) * 0.7);
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

  ctx.fillStyle = palette.pants;
  roundedRectFill(-9,9,7,10,3);
  roundedRectFill(2,9,7,10,3);
  ctx.fillStyle = palette.boots;
  roundedRectFill(-9 + (stride * 0.35), 18, 7, 4, 2);
  roundedRectFill(2 - (stride * 0.35), 18, 7, 4, 2);

  ctx.fillStyle = palette.armorOuter;
  roundedRectFill(-10,-16,20,27,7);
  ctx.strokeStyle="rgba(7,10,16,.42)";
  ctx.lineWidth=1;
  ctx.strokeRect(-10,-16,20,27);
  ctx.fillStyle = palette.armorInner;
  roundedRectFill(-8,-11,16,19,6);
  ctx.fillStyle="rgba(72,88,108,.45)";
  roundedRectFill(-4.5,-10,9,6,2);
  ctx.fillStyle = palette.arm;
  roundedRectFill(-14,-12,5,16,2);
  roundedRectFill(9,-12,5,16,2);

  ctx.fillStyle = palette.shoulder;
  roundedRectFill(-12,-14,6,12,3);
  ctx.fillStyle = palette.trim;
  roundedRectFill(-11,-11,4,4,1.5);

  ctx.fillStyle = palette.helmet;
  ctx.beginPath(); ctx.arc(0, -24, 9.5, Math.PI, Math.PI*2); ctx.fill();
  ctx.fillStyle = palette.arm;
  roundedRectFill(-10,-24,20,6,3);
  ctx.fillStyle = palette.visor;
  roundedRectFill(-6,-22,12,3,2);

  ctx.fillStyle="rgba(220,220,225,.90)";
  ctx.beginPath(); ctx.arc(0,-20,6.5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = palette.lens;
  ctx.beginPath(); ctx.arc(-2,-20,1,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(2,-20,1,0,Math.PI*2); ctx.fill();
  ctx.restore();

  if(!rolling){
    const wx = x + Math.cos(ang) * 14;
    const wy = y + Math.sin(ang) * 13 + (shoulderShift * 0.25);
    const gripX = x + Math.cos(ang) * 5;
    const gripY = y + Math.sin(ang) * 2 + (shoulderShift * 0.35);
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
    const armorCap = Math.max(1, Number(S.armorCap) || 100);
    const arRatio = clamp((S.armor || 0) / armorCap, 0, 1);
    const arPct = Math.round(arRatio * 100);
    const labelY = y - 46;
    ctx.fillStyle = "rgba(9,12,18,.86)";
    roundedRectFill(x - 36, labelY - 12, 72, 26, 7);
    ctx.fillStyle = "rgba(245,247,255,.94)";
    ctx.font = "900 10px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`HP ${hpPct}%`, x, labelY - 1);
    ctx.fillStyle = "rgba(11,13,18,.88)";
    ctx.fillRect(x - 30, labelY + 4, 60, 4);
    ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : (hpRatio > 0.2 ? "#f59e0b" : "#fb7185");
    ctx.fillRect(x - 30, labelY + 4, 60 * hpRatio, 4);
    ctx.fillStyle = "rgba(96,165,250,.95)";
    ctx.fillRect(x - 30, labelY + 10, 60 * arRatio, 3);
    ctx.fillStyle = "rgba(180,214,255,.92)";
    ctx.font = "800 8px system-ui";
    ctx.fillText(`AR ${arPct}%`, x, labelY + 20);
    ctx.textAlign = "start";
  }
}

function drawSupportUnit(unit){
  const smooth = smoothedDrawPoint(unit, unit.x, unit.y, 0.42);
  const bob = Math.sin(unit.step || 0) * 1.2;
  const x = smooth.x;
  const y = smooth.y + bob;
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
  ctx.strokeStyle = "rgba(8,12,18,.40)";
  ctx.lineWidth = 1;
  ctx.strokeRect(-9, -15, 18, 24);
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
  const smoothStiff = sprinting ? 0.72 : (gaitState === "run" ? 0.62 : 0.52);
  const smooth = smoothedDrawPoint(t, t.x, t.y, smoothStiff);
  const bob = Math.sin((t.step||0)*2.2)*0.34*Math.max(0.62, speed*0.90);
  const strideBounce = Math.abs(Math.sin((t.step||0)*2.2)) * (gaitState==="sprint" ? 1.35 : (gaitState==="run" ? 0.95 : 0.58));
  const bodyLift = clamp(gaitBlend * 2.4 + (sprinting ? 1.35 : 0), 0, 3.8);
  const x=smooth.x, y=smooth.y + bob - bodyLift + (strideBounce * 0.36);
  const headBob = Math.sin((t.step||0)*2.4 + 0.7) * (gaitState==="sprint" ? 1.7 : (gaitState==="run" ? 1.25 : 0.7));
  const shoulderRoll = Math.sin((t.step||0)*1.3) * (gaitState==="sprint" ? 0.06 : 0.04);
  const tigerFocus = S.inBattle && (S.activeTigerId===t.id || S.lockedTigerId===t.id);
  const hitFlashLeft = Math.max(0, (t.hitFlashUntil || 0) - now);
  const hitFlashAlpha = hitFlashLeft > 0 ? clamp(hitFlashLeft / 190, 0.12, 0.78) : 0;
  const hitFlashColor = t.hitFlashKind === "tranq"
    ? "rgba(125,211,252,.95)"
    : (t.hitFlashKind === "crit" ? "rgba(252,211,77,.98)" : "rgba(248,113,113,.96)");
  const atkLeft = Math.max(0, (t.attackAnimUntil || 0) - now);
  const atkProgress = atkLeft > 0 && (t.attackAnimStart || 0) < (t.attackAnimUntil || 0)
    ? clamp(1 - (atkLeft / Math.max(1, (t.attackAnimUntil - t.attackAnimStart))), 0, 1)
    : 0;
  const atkKind = t.attackAnimKind || "";
  const atkSwing = atkProgress > 0 ? Math.sin(atkProgress * Math.PI) : 0;
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
  if(hitFlashAlpha > 0){
    ctx.save();
    ctx.globalAlpha = hitFlashAlpha;
    ctx.strokeStyle = hitFlashColor;
    ctx.lineWidth = tigerFocus ? 5 : 3.8;
    ctx.beginPath();
    ctx.arc(x, y, tigerFocus ? 44*s : 36*s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
  ctx.rotate(clamp((t.vy || 0) * 0.018, -0.09, 0.09) + shoulderRoll);

  ctx.fillStyle=c.body;
  ctx.beginPath(); ctx.ellipse(0, 2*s, 22*s, 13*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.14)";
  ctx.beginPath(); ctx.ellipse(-2*s, -2*s, 14*s, 5*s, -0.15, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=c.belly;
  ctx.beginPath(); ctx.ellipse(3*s, 6*s, 14*s, 8*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle=c.body;
  ctx.beginPath(); ctx.ellipse(20*s, (-6 + (headBob * 0.55))*s, 12*s, 10*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(26*s, (-14 + (headBob * 0.35))*s, 4.5*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16*s, (-14 + (headBob * 0.35))*s, 4.5*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(240,220,190,.88)";
  ctx.beginPath(); ctx.ellipse(22*s, (-4.5 + (headBob * 0.55))*s, 6.5*s, 4.4*s, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="#12161f";
  ctx.beginPath(); ctx.arc(24*s, (-8.4 + (headBob * 0.52))*s, 1.1*s, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(18.5*s, (-8.6 + (headBob * 0.52))*s, 1.1*s, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(15,15,15,.88)";
  ctx.beginPath();
  ctx.moveTo(22*s, (-4.4 + (headBob * 0.50))*s);
  ctx.lineTo(20.5*s, (-2.3 + (headBob * 0.50))*s);
  ctx.lineTo(23.5*s, (-2.3 + (headBob * 0.50))*s);
  ctx.closePath();
  ctx.fill();
  if(atkProgress > 0){
    const biteOpen = atkKind === "charge" ? 1.2 : (atkKind === "pounce" ? 1.0 : 0.75);
    const jawDrop = atkSwing * biteOpen * 2.4;
    ctx.strokeStyle = "rgba(18,18,18,.95)";
    ctx.lineWidth = 1.3*s;
    ctx.beginPath();
    ctx.moveTo(20.4*s, (-3.0 + (headBob * 0.50))*s);
    ctx.lineTo(22.2*s, (-1.0 + jawDrop + (headBob * 0.50))*s);
    ctx.lineTo(24.1*s, (-3.0 + (headBob * 0.50))*s);
    ctx.stroke();
    ctx.strokeStyle = "rgba(250,250,250,.85)";
    ctx.lineWidth = 0.95*s;
    ctx.beginPath();
    ctx.moveTo(21.3*s, (-2.3 + (headBob * 0.50))*s);
    ctx.lineTo(21.9*s, (-0.6 + jawDrop + (headBob * 0.50))*s);
    ctx.moveTo(22.6*s, (-2.3 + (headBob * 0.50))*s);
    ctx.lineTo(22.2*s, (-0.6 + jawDrop + (headBob * 0.50))*s);
    ctx.stroke();
  }

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
  if(Number(t.nemesisScars || 0) > 0){
    const scarCount = clamp(Math.floor(Number(t.nemesisScars || 1)), 1, 7);
    ctx.strokeStyle = "rgba(239,68,68,.75)";
    ctx.lineWidth = 1.25 * s;
    for(let i=0; i<scarCount; i++){
      const sx = (-8 + (i * 3.6)) * s;
      const sy = (-3 + ((i % 2) * 1.8)) * s;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + (5.4 * s), sy + (4.6 * s));
      ctx.stroke();
    }
  }
  if(atkProgress > 0){
    const clawReach = (atkKind === "charge" ? 12 : (atkKind === "pounce" ? 10 : 8)) * atkSwing;
    const clawLift = (atkKind === "pounce" ? 3.2 : 2.2) * atkSwing;
    const pawY = 8.2*s;
    ctx.strokeStyle = "rgba(24,24,26,.96)";
    ctx.lineWidth = 2.2*s;
    ctx.beginPath();
    ctx.moveTo(11*s, pawY);
    ctx.lineTo((21 + clawReach)*s, (pawY - clawLift)*s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4*s, pawY + (1.2*s));
    ctx.lineTo((14 + clawReach*0.85)*s, (pawY + 1.2 - clawLift*0.65)*s);
    ctx.stroke();
    ctx.strokeStyle = "rgba(245,245,245,.86)";
    ctx.lineWidth = 0.9*s;
    ctx.beginPath();
    ctx.moveTo((21 + clawReach)*s, (pawY - clawLift)*s);
    ctx.lineTo((24.3 + clawReach)*s, (pawY - clawLift - 1.2)*s);
    ctx.moveTo((19.4 + clawReach)*s, (pawY - clawLift + 0.5)*s);
    ctx.lineTo((22.3 + clawReach)*s, (pawY - clawLift - 0.8)*s);
    ctx.stroke();
  }
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
    ctx.fillStyle="rgba(9,12,18,.88)";
    roundedRectFill(x - (36*s), y - (52*s), 72*s, 20*s, 6*s);
    ctx.fillStyle="rgba(245,247,255,.95)";
    ctx.font=`900 ${Math.round(9.5*s)}px system-ui`;
    ctx.textAlign="center";
    ctx.fillText(`${Math.round(t.hp)}/${Math.round(t.hpMax)} (${Math.round(clamp(pct, 0, 1) * 100)}%)`, x, y-(40*s));
    ctx.textAlign="start";
    if(pct <= 0.25){
      const pulse = 0.58 + (Math.sin(now / 95) * 0.30);
      ctx.globalAlpha = clamp(pulse, 0.20, 0.92);
      ctx.strokeStyle = "rgba(248,113,113,.98)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y, 45*s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  const nonFocusBattle = S.inBattle && !tigerFocus;
  ctx.globalAlpha=(nonFocusBattle ? 0.55 : 0.85)*alpha;
  ctx.fillStyle="rgba(245,247,255,.80)";
  ctx.font= nonFocusBattle ? "800 11px system-ui" : "900 12px system-ui";
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
  const bossPhaseTag = isBossTiger(t)
    ? ` • P${clamp(Math.floor(Number(t.bossPhaseIndex || bossPhaseFromHp(t))), 1, bossPhaseCount(t))}/${bossPhaseCount(t)}`
    : "";
  const nemesisLabel = t.nemesisAlias
    ? ` ☠ ${t.nemesisAlias}${Number(t.nemesisPower || 0) > 0 ? ` Lv${Math.floor(Number(t.nemesisPower || 0))}` : ""}`
    : "";
  const fullLabel = t.type + bossTag + bossPhaseTag + nemesisLabel + persona + (t.tranqTagged?" (tranq)":"") + dash + fade + roar + rage + hunt;
  const compactLabel = (t.nemesisAlias ? `${t.type} • ${t.nemesisAlias}` : t.type) + (t.tranqTagged ? " (tranq)" : "");
  const skipLabel =
    visualReadabilityHeavyMode() &&
    !tigerFocus &&
    dist(S.me.x, S.me.y, t.x, t.y) > 220;
  if(!skipLabel){
    ctx.fillText(nonFocusBattle ? compactLabel : fullLabel, x-44*s, y-44*s);
  }
  ctx.globalAlpha=1;
}

function useLiteEntityRender(){
  // Disable "dot mode" fallback on mobile so units stay readable.
  // We now shed load from map/overlays instead of replacing entities.
  __liteEntityRenderState = false;
  __liteEntityRenderNeedSince = 0;
  __liteEntityRenderRelaxUntil = 0;
  return false;
}
function drawEntitiesLite(){
  const worldCam = isWorldCameraActive(S);
  const camOff = worldCam ? cameraOffsetSnapshot(S) : { x:0, y:0 };
  const visPad = 72;
  const visMinX = camOff.x - visPad;
  const visMinY = camOff.y - visPad;
  const visMaxX = camOff.x + (cv.width || WORLD_BASE_WIDTH) + visPad;
  const visMaxY = camOff.y + (cv.height || WORLD_BASE_HEIGHT) + visPad;
  const inLiteView = (x, y, r=20)=>(
    !worldCam ||
    ((x + r) >= visMinX && (x - r) <= visMaxX && (y + r) >= visMinY && (y - r) <= visMaxY)
  );

  ctx.fillStyle = "rgba(77,47,33,.64)";
  for(const c of (S.carcasses || [])){
    if(!inLiteView(c.x, c.y, 16)) continue;
    ctx.fillRect(c.x - 9, c.y - 4, 18, 8);
  }

  for(const p of (S.pickups || [])){
    if(!inLiteView(p.x, p.y, 16)) continue;
    let color = "rgba(147,197,253,.9)";
    if(p.kind === "medkit") color = "rgba(34,197,94,.92)";
    else if(p.kind === "ammo") color = "rgba(251,191,36,.92)";
    else if(p.kind === "repair") color = "rgba(248,113,113,.92)";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for(const it of (S.mapInteractables || [])) drawMapInteractable(it);
  for(const site of (S.rescueSites || [])) drawRescueSite(site);

  if(S.mode !== "Survival"){
    for(const c of (S.civilians || [])){
      if(!c.alive) continue;
      const smooth = smoothedDrawPoint(c, c.x, c.y, 0.30);
      const x = smooth.x;
      const y = smooth.y;
      ctx.fillStyle = c.shirt || "rgba(248,113,113,.92)";
      ctx.beginPath();
      ctx.arc(x, y - 2, 8, 0, Math.PI * 2);
      ctx.fill();
      if(S.dangerCivId === c.id){
        ctx.strokeStyle = "rgba(248,113,113,.94)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y - 2, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
      const pct = clamp((c.hp || 0) / Math.max(1, c.hpMax || 1), 0, 1);
      ctx.fillStyle = "rgba(9,12,18,.84)";
      ctx.fillRect(x - 16, y - 17, 32, 4);
      ctx.fillStyle = pct > 0.5 ? "#4ade80" : (pct > 0.2 ? "#f59e0b" : "#fb7185");
      ctx.fillRect(x - 16, y - 17, 32 * pct, 4);
    }
  }

  for(const unit of (S.supportUnits || [])){
    if(!unit.alive) continue;
    const smooth = smoothedDrawPoint(unit, unit.x, unit.y, 0.32);
    const x = smooth.x;
    const y = smooth.y;
    ctx.fillStyle = unit.role === "rescue" ? "rgba(34,197,94,.92)" : "rgba(251,146,60,.92)";
    ctx.fillRect(x - 7, y - 9, 14, 18);
    const hpPct = clamp((unit.hp || 0) / Math.max(1, unit.hpMax || 1), 0, 1);
    ctx.fillStyle = "rgba(9,12,18,.82)";
    ctx.fillRect(x - 14, y - 15, 28, 3);
    ctx.fillStyle = hpPct > 0.45 ? "#4ade80" : "#fb7185";
    ctx.fillRect(x - 14, y - 15, 28 * hpPct, 3);
  }

  for(const t of (S.tigers || [])){
    if(!t.alive) continue;
    const smooth = smoothedDrawPoint(t, t.x, t.y, 0.38);
    const x = smooth.x;
    const y = smooth.y;
    const theta = Number.isFinite(t.heading) ? t.heading : Math.atan2(t.vy || 0, t.vx || 1);
    const focus = S.inBattle && (S.activeTigerId === t.id || S.lockedTigerId === t.id);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(theta);
    ctx.fillStyle = "rgba(245,158,11,.94)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(20,20,24,.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-4, -7); ctx.lineTo(-4, 7);
    ctx.moveTo(2, -7); ctx.lineTo(2, 7);
    ctx.stroke();
    ctx.restore();

    const pct = clamp((t.hp || 0) / Math.max(1, t.hpMax || 1), 0, 1);
    ctx.fillStyle = "rgba(9,12,18,.84)";
    ctx.fillRect(x - 18, y - 18, 36, 4);
    ctx.fillStyle = pct > 0.5 ? "#4ade80" : (pct > 0.2 ? "#f59e0b" : "#fb7185");
    ctx.fillRect(x - 18, y - 18, 36 * pct, 4);
    if(focus){
      ctx.strokeStyle = "rgba(59,130,246,.96)";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.stroke();
      if(S.inBattle){
        ctx.fillStyle = "rgba(9,12,18,.86)";
        roundedRectFill(x - 28, y - 33, 56, 15, 5);
        ctx.fillStyle = "rgba(245,247,255,.95)";
        ctx.font = "800 9px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(t.hp)}/${Math.round(t.hpMax)} (${Math.round(pct * 100)}%)`, x, y - 22);
        ctx.textAlign = "start";
      }
    }
  }

  {
    const smooth = smoothedDrawPoint(S.me, S.me.x, S.me.y, 0.42);
    const x = smooth.x;
    const y = smooth.y;
    const ang = Number.isFinite(S.me.face) ? S.me.face : 0;
    ctx.fillStyle = "rgba(226,232,240,.95)";
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(30,41,59,.96)";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * 13, y + Math.sin(ang) * 13);
    ctx.stroke();
    if(shieldActiveNow()){
      ctx.save();
      ctx.globalAlpha = 0.34;
      ctx.strokeStyle = "rgba(96,165,250,.92)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if(S.inBattle){
      const hpPct = Math.round(clamp((S.hp / 100) * 100, 0, 100));
      const hpRatio = clamp(S.hp / 100, 0, 1);
      const arRatio = clamp((S.armor || 0) / Math.max(1, Number(S.armorCap) || 100), 0, 1);
      ctx.fillStyle = "rgba(9,12,18,.86)";
      roundedRectFill(x - 30, y - 35, 60, 18, 6);
      ctx.fillStyle = "rgba(245,247,255,.95)";
      ctx.font = "900 9px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`HP ${hpPct}%`, x, y - 23);
      ctx.fillStyle = "rgba(9,12,18,.88)";
      ctx.fillRect(x - 24, y - 18, 48, 3.5);
      ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : (hpRatio > 0.2 ? "#f59e0b" : "#fb7185");
      ctx.fillRect(x - 24, y - 18, 48 * hpRatio, 3.5);
      ctx.fillStyle = "rgba(96,165,250,.95)";
      ctx.fillRect(x - 24, y - 13, 48 * arRatio, 3);
      ctx.textAlign = "start";
    }
  }
}
function drawEntities(){
  const liteRender = useLiteEntityRender();
  if(liteRender){
    drawEntitiesLite();
  } else {
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
  }
  drawOnMapBattleReadability();
  drawOnMapBattleHud();
  drawAbilityCooldownWheel();
  const perfMode = performanceMode();
  const lagTier = frameLagTier();
  const mobile = isMobileViewport();
  const isSlowFrame = frameIsSlow();
  const frameBudgetTight = frameBudgetExceeded(0.85);
  const entityLoad =
    (S.tigers?.length || 0) +
    (S.civilians?.length || 0) +
    (S.supportUnits?.length || 0) +
    (S.pickups?.length || 0);
  const heavyLoad = entityLoad > 34;
  __frameHeavyFxFlip = (__frameHeavyFxFlip + 1) % 6;
  const drawFx = liteRender
    ? (!frameBudgetTight && (__frameHeavyFxFlip % 4 === 0))
    : (frameBudgetTight
      ? (__frameHeavyFxFlip % 4 === 0)
      : (heavyLoad
        ? (__frameHeavyFxFlip % (isSlowFrame ? 4 : 3) === 0)
        : ((perfMode !== "PERFORMANCE" && !isSlowFrame)
          || (perfMode === "PERFORMANCE" && (__frameHeavyFxFlip % 2 === 0))
          || (isSlowFrame && (__frameHeavyFxFlip % 3 === 0)))));
  let shouldDrawFx = drawFx;
  if(lagTier >= 2){
    shouldDrawFx = !frameBudgetTight && (__frameHeavyFxFlip % (mobile ? 9 : 8) === 0);
  }else if(lagTier >= 1){
    shouldDrawFx = !frameBudgetTight && (__frameHeavyFxFlip % (mobile ? 6 : 5) === 0);
  }
  const shouldDrawPopups = lagTier >= 2
    ? (__frameHeavyFxFlip % (mobile ? 9 : 8) === 0)
    : (lagTier >= 1
      ? (__frameHeavyFxFlip % (heavyLoad ? 6 : 5) === 0)
      : (__frameHeavyFxFlip % (heavyLoad ? 3 : 2) === 0));
  if(shouldDrawFx || (IMPACT_PULSES.length > 0 && !frameBudgetTight && lagTier === 0)) drawImpactPulses();
  if(!liteRender && shouldDrawFx && !frameBudgetTight) drawCombatFx();
  if(!liteRender && (shouldDrawFx || (!frameBudgetTight && shouldDrawPopups))) drawDamagePopups();
}
function drawMobileUiClearLane(){
  // Intentionally no overlay in the control lane; keep full map visibility.
  return;
}
function shouldDrawAtmosphericPass(){
  __frameBgFxFlip = (__frameBgFxFlip + 1) % 9;
  const score = frameActiveEntityLoadScore();
  const lagTier = frameLagTier();
  if(isMobileViewport() && lagTier >= 1) return false;
  if(__frameLagScore >= FRAME_LAG_CRITICAL_SCORE) return (__frameBgFxFlip % 6) === 0;
  if(__frameLagScore >= FRAME_LAG_WARN_SCORE) return (__frameBgFxFlip % 5) === 0;
  if(performanceMode() === "PERFORMANCE") return (__frameBgFxFlip % 3) === 0;
  if(frameBudgetExceeded(0.45)) return (__frameBgFxFlip % 4) === 0;
  if(frameIsSlow()) return (__frameBgFxFlip % 2) === 0;
  if(isMobileViewport() && score >= 34) return (__frameBgFxFlip % 4) === 0;
  if(score >= 64) return (__frameBgFxFlip % 3) === 0;
  if(score >= 46) return (__frameBgFxFlip % 2) === 0;
  return true;
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
    const lagTier = frameLagTier();
    const lagHeavy = lagTier >= 1;
    const lagCritical = lagTier >= 2;
    const battleLoad = !!S.inBattle;
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
      runFrameTask("sanitizeState", frameInterval(lagCritical ? 360 : (lagHeavy ? 300 : 240), 2.2), sanitizeRuntimeState, {
        costHint:1.3, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
      });
      runFrameTask("missionDirector", frameInterval(lagCritical ? 136 : (lagHeavy ? 106 : 84), 1.45), missionDirectorTick, {
        costHint:1.1, critical:true, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
      });
      runFrameTask("clampWorld", frameInterval(lagCritical ? 220 : 180, 1.3), clampWorldToCanvas, { costHint:0.9 });
      runFrameTask("unstickEntities", frameInterval(lagCritical ? 280 : (lagHeavy ? 220 : 170), 1.9), unstickEntitiesTick, {
        costHint:1.5, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
      });
      safeTick("regen", regen);
      runFrameTask("backupTick", frameInterval(lagCritical ? 120 : (lagHeavy ? 90 : 60), 1.5), backupTick, { costHint:1.1 });
      runFrameTask("trapTick", frameInterval(lagCritical ? 104 : (lagHeavy ? 80 : 54), 1.6), trapTick, { costHint:1.2 });
      runFrameTask("mapInteractableTick", frameInterval(lagCritical ? 148 : (lagHeavy ? 118 : 84), 1.5), mapInteractableTick, { costHint:1.1 });
      runFrameTask("comboTick", frameInterval(lagCritical ? 154 : (lagHeavy ? 130 : 110), 1.4), comboTick, { costHint:0.7 });

      if(!window.TigerTutorial?.isRunning){
        runFrameTask("missionTwists", frameInterval(lagHeavy ? 236 : 176, 1.5), tickMissionTwists, { costHint:0.9, critical:S.mode!=="Survival" });
        runFrameTask("tickEvents", frameInterval(lagHeavy ? 240 : 180, 1.5), tickEvents, { costHint:0.9 });
        runFrameTask("biomeHazard", frameInterval(lagHeavy ? 220 : 170, 1.45), biomeHazardTick, { costHint:0.6 });
        runFrameTask("ambientPickup", frameInterval(lagHeavy ? 360 : 300, 1.35), maybeSpawnAmbientPickup, { costHint:0.6 });
        runFrameTask("tickPickups", frameInterval(lagCritical ? 92 : (lagHeavy ? 74 : 52), 1.5), tickPickups, { costHint:1.0 });
      }

      runFrameTask("roamTigers", frameInterval(
        battleLoad
          ? (lagCritical ? 108 : (lagHeavy ? 86 : 64))
          : (lagCritical ? 74 : (lagHeavy ? 60 : 42)),
        1.55
      ), roamTigers, {
        costHint:2.6, critical:true, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
      });
      runFrameTask("bossIdentity", frameInterval(92, 1.45), bossIdentityTick, { costHint:0.9, critical:true });
      runFrameTask("bossReinforce", frameInterval(110, 1.45), bossReinforcementTick, { costHint:0.8 });
      runFrameTask("supportUnits", frameInterval(
        battleLoad
          ? (lagCritical ? 168 : (lagHeavy ? 132 : 104))
          : (lagCritical ? 112 : (lagHeavy ? 90 : 64)),
        1.8
      ), supportUnitsTick, {
        costHint:2.4, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
      });
      let usedKeyboard = false;
      safeTick("keyboardMoveTick", ()=>{ usedKeyboard = keyboardMoveTick(); });
      if(!usedKeyboard) safeTick("movePlayer", movePlayer);
      safeTick("clearOutOfRangeLock", clearOutOfRangeLock);
      runFrameTask("followCivilians", frameInterval(
        battleLoad
          ? (lagCritical ? 132 : (lagHeavy ? 110 : 86))
          : (lagCritical ? 78 : (lagHeavy ? 62 : 50)),
        1.5
      ), followCiviliansTick, {
        costHint:1.2, cadence:1, slowCadence:1, heavyCadence:2, extremeCadence:2, critical:true
      });
      runFrameTask("evacCheck", frameInterval(lagCritical ? 90 : (lagHeavy ? 72 : 58), 1.5), evacCheck, { costHint:0.9 });
      runFrameTask("civThreats", frameInterval(
        battleLoad
          ? (lagCritical ? 220 : (lagHeavy ? 180 : 138))
          : (lagCritical ? 156 : (lagHeavy ? 126 : 92)),
        1.5
      ), tickCiviliansAndThreats, {
        costHint:1.6, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
      });
      runFrameTask("survivalPressure", frameInterval(lagCritical ? 120 : (lagHeavy ? 102 : 86), 1.4), survivalPressureTick, { costHint:1.1 });
      runFrameTask("combatTick", frameInterval(S.inBattle ? (lagCritical ? 44 : (lagHeavy ? 36 : 28)) : (lagCritical ? 56 : (lagHeavy ? 46 : 36)), 1.6), combatTick, { costHint:1.9, critical:S.inBattle });
      runFrameTask("storyCheckpoint", frameInterval(lagCritical ? 220 : (lagHeavy ? 170 : 124), 1.45), maybeCaptureStoryCheckpoint, { costHint:0.8, critical:S.mode==="Story" });
      runFrameTask("checkMissionComplete", frameInterval(lagCritical ? 140 : (lagHeavy ? 112 : 90), 1.4), checkMissionComplete, { costHint:0.8, critical:true });
    }
    runFrameTask("combatFx", frameInterval(lagCritical ? 94 : (lagHeavy ? 72 : 42), 1.8), tickCombatFx, {
      costHint:0.5, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
    });
    runFrameTask("damagePopups", frameInterval(lagCritical ? 88 : (lagHeavy ? 68 : 40), 1.8), tickDamagePopups, {
      costHint:0.5, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
    });
    runFrameTask("impactPulses", frameInterval(lagCritical ? 82 : (lagHeavy ? 62 : 36), 1.8), tickImpactPulses, {
      costHint:0.45, cadence:1, slowCadence:2, heavyCadence:3, extremeCadence:4
    });

    safeTick("drawSceneFrame", ()=>{
      ctx.save();
      let needsTransform = false;
      let worldShifted = false;
      try{
        resetCanvasDrawState();
        // Hard clear each frame so old world-camera layers cannot ghost/stack on mobile.
        ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.fillStyle = "#0b111b";
        ctx.fillRect(0, 0, cv.width, cv.height);
        const liteRender = useLiteEntityRender();
        const shake = liteRender ? { active:false, x:0, y:0 } : sampleCameraShake();
        const cine = liteRender ? { active:false, x:0, y:0, scale:1 } : sampleBattleCinematic();
        const worldCam = isWorldCameraActive(S);
        const cam = updateWorldCamera(S);
        needsTransform = shake.active || cine.active;
        if(needsTransform){
          ctx.save();
          if(cine.active){
            ctx.translate(cine.x, cine.y);
            ctx.scale(cine.scale, cine.scale);
            ctx.translate(-cine.x, -cine.y);
          }
          if(shake.active){
            ctx.translate(shake.x, shake.y);
          }
        }
        if(worldCam){
          ctx.save();
          ctx.translate(-cam.x, -cam.y);
          worldShifted = true;
        }
        drawMapScene();
        drawMapDynamicOverlays();
        if(worldShifted){
          ctx.restore();
          worldShifted = false;
        }
        if(shouldDrawAtmosphericPass() && !frameBudgetExceeded(0.95)){
          drawAtmosphericParallax();
        }
        if(worldCam){
          ctx.save();
          ctx.translate(-cam.x, -cam.y);
          worldShifted = true;
        }
        drawEntities();
        if(worldShifted){
          ctx.restore();
          worldShifted = false;
        }
        if(needsTransform){
          ctx.restore();
          needsTransform = false;
        }
        drawMobileUiClearLane();
      } finally {
        if(worldShifted){
          try{ ctx.restore(); }catch(e){}
        }
        if(needsTransform){
          try{ ctx.restore(); }catch(e){}
        }
        ctx.restore();
      }
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
  if(isMobileViewport()){
    window.__TS_SHOW_MONITOR__ = false;
    const twBoot = ensureMissionTwistState(S);
    twBoot.blackout.active = false;
    twBoot.blackout.until = 0;
    if(twBoot.activeType === "blackout"){
      twBoot.activeType = "";
      twBoot.activeUntil = 0;
    }
  }
  ensureStoryMetaState();
  ensureContractTalliesState(S);
  ensureBalanceStatsState(S);
  ensureContractsState(S);
  ensureMissionDirectorState(S);
  ensureMissionTwistState(S);
  ensureArcadeBuildcraftState(S);
  ensureSeasonPassState(S);
  if(!["Story","Arcade","Survival"].includes(S.mode)) S.mode = DEFAULT.mode;
  S.storyLevel = clamp(Math.floor(S.storyLevel || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  S.storyLastMission = clamp(Math.floor(S.storyLastMission || S.storyLevel || 1), 1, STORY_CAMPAIGN_OBJECTIVES.length);
  const bootStoryProgress = readStoryProgressData();
  const bootStorySlot = readStorySaveData();
  const bootStoryProfile = resolveStoryProfileOverlay(readStoryProfileData(), bootStoryProgress, S);
  applyStoryProfileToState(S, bootStoryProfile);
  __lastStoryFullSnapshotAt = Number.isFinite(Number(bootStorySlot?.savedAt))
    ? Number(bootStorySlot.savedAt)
    : Date.now();
  const bootResumeMission = storyResumeMissionLevel();
  if(bootResumeMission > S.storyLevel){
    S.storyLevel = bootResumeMission;
    S.storyLastMission = Math.max(S.storyLastMission, bootResumeMission);
  }
  if(bootStoryProgress){
    if(Number.isFinite(Number(bootStoryProgress.funds))){
      S.funds = Math.max(0, Math.round(Number(bootStoryProgress.funds || 0)));
    }
  }
  if(S.mode === "Story"){
    S.storyLevel = Math.max(S.storyLevel, S.storyLastMission);
  } else {
    S.storyLastMission = Math.max(S.storyLastMission, S.storyLevel);
  }
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
  ensureWeaponMasteryState();
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
  if(!Number.isFinite(S.meHitFlashUntil)) S.meHitFlashUntil = 0;
  if(!Number.isFinite(S.meHitFlashPower)) S.meHitFlashPower = 0;
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
  if(!Number.isFinite(S._directorAggroMul)) S._directorAggroMul = 1;
  if(!Number.isFinite(S._directorSpeedMul)) S._directorSpeedMul = 1;
  if(!S.progressionUnlocks || typeof S.progressionUnlocks !== "object") S.progressionUnlocks = {};
  ensureContractTalliesState(S);
  ensureContractsState(S);
  ensureNemesisState(S);
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
    if(!Number.isFinite(t.bossPhaseIndex)) t.bossPhaseIndex = 1;
    if(!Number.isFinite(t.bossStealthUntil)) t.bossStealthUntil = 0;
    if(!Number.isFinite(t.bossStalkUntil)) t.bossStalkUntil = 0;
    if(!Number.isFinite(t.bossPounceCharges)) t.bossPounceCharges = 0;
    if(!Number.isFinite(t.bossPounceChainUntil)) t.bossPounceChainUntil = 0;
    if(!Number.isFinite(t.bossChargeUntil)) t.bossChargeUntil = 0;
    if(!Number.isFinite(t._bossStalkPromptAt)) t._bossStalkPromptAt = 0;
    if(!Number.isFinite(t._bossWarnForSkillAt)) t._bossWarnForSkillAt = 0;
    if(!Number.isFinite(t._bossPrefightWarnedAt)) t._bossPrefightWarnedAt = 0;
    if(!Number.isFinite(t._bossLastTellAt)) t._bossLastTellAt = 0;
    if(typeof t._bossLastTellKey !== "string") t._bossLastTellKey = "";
    if(isBossTiger(t) && Number(t.bossPhases || 0) < 3) t.bossPhases = 3;
    const phaseCap = bossPhaseCount(t);
    t.bossPhaseIndex = clamp(Math.floor(Number(t.bossPhaseIndex || 1)), 1, phaseCap);
    if(!Number.isFinite(t.attackAnimStart)) t.attackAnimStart = 0;
    if(!Number.isFinite(t.attackAnimUntil)) t.attackAnimUntil = 0;
    if(typeof t.attackAnimKind !== "string") t.attackAnimKind = "";
    if(!Number.isFinite(t.heading)) t.heading = Math.atan2(t.vy || Math.sin(t.wanderAngle || 0), t.vx || Math.cos(t.wanderAngle || 0));
    if(!Number.isFinite(t.drawDir)) t.drawDir = (Math.cos(t.heading) >= 0 ? 1 : -1);
    if(typeof t.gaitState !== "string") t.gaitState = "walk";
    if(!Number.isFinite(t.gaitBlend)) t.gaitBlend = 0;
    if(typeof t.nemesisId !== "string") t.nemesisId = "";
    if(typeof t.nemesisAlias !== "string") t.nemesisAlias = "";
    if(!Number.isFinite(t.nemesisPower)) t.nemesisPower = 0;
    if(!Number.isFinite(t.nemesisScars)) t.nemesisScars = 0;
    if(typeof t.nemesisBehavior !== "string") t.nemesisBehavior = "";
    if(!Number.isFinite(t.nemesisBountyCash)) t.nemesisBountyCash = 0;
    if(!Number.isFinite(t.nemesisSpeedMul)) t.nemesisSpeedMul = 1;
    if(!Number.isFinite(t.nemesisDamageMul)) t.nemesisDamageMul = 1;
    if(!Number.isFinite(t.nemesisDefenseMul)) t.nemesisDefenseMul = 1;
    if(!Number.isFinite(t.nemesisPounceMul)) t.nemesisPounceMul = 1;
    if(typeof t.nemesisReturned !== "boolean") t.nemesisReturned = false;
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
  if(!S.gameOver && !S.missionEnded){
    markBalanceMissionStart(S);
  }

  __pendingDailyReward = awardDailyLogin();
  refreshLaunchIntroStatus();
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
      let recovered = false;
      const preservedState = (S && typeof S === "object") ? cloneState(S) : null;
      if(preservedState){
        S = preservedState;
        S.mode = ["Story","Arcade","Survival"].includes(S.mode) ? S.mode : DEFAULT.mode;
        S.storyLevel = clamp(Math.floor(Number(S.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
        S.storyLastMission = clamp(Math.floor(Number(S.storyLastMission || S.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
        S.arcadeLevel = clamp(Math.floor(Number(S.arcadeLevel || 1)), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
        S.survivalWave = Math.max(1, Math.floor(Number(S.survivalWave || 1)));
        S.modeWallets = normalizeModeWallets(S.modeWallets, S.funds, S.mode);
        bindFundsWallet(S);
        syncWindowState();
        resizeCanvasForViewport();
        applyTouchHudSettings();
        if(missionStateLooksEmpty()){
          const keepHp = clamp(Number(S.hp || 100), 0, 100);
          const keepArmor = clamp(Number(S.armor || 0), 0, S.armorCap || 100);
          deploy({ carryStats:true, hp:keepHp, armor:keepArmor });
        }
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
        toast("Recovered from startup error using saved state.");
        save(true);
        recovered = true;
      }
      if(!recovered){
        const keepMode = ["Story","Arcade","Survival"].includes(S?.mode) ? S.mode : DEFAULT.mode;
        const keepMapIndex = Number.isFinite(S?.mapIndex) ? S.mapIndex : 0;
        const keepWallets = normalizeModeWallets(S?.modeWallets, S?.funds, keepMode);
        const keepStoryLevel = clamp(Math.floor(Number(S?.storyLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
        const keepStoryLastMission = clamp(Math.floor(Number(S?.storyLastMission || keepStoryLevel || 1)), 1, STORY_CAMPAIGN_OBJECTIVES.length);
        const keepArcadeLevel = clamp(Math.floor(Number(S?.arcadeLevel || 1)), 1, ARCADE_CAMPAIGN_OBJECTIVES.length);
        const keepSurvivalWave = Math.max(1, Math.floor(Number(S?.survivalWave || 1)));
        S = cloneState(DEFAULT);
        S.mode = keepMode;
        S.mapIndex = keepMapIndex;
        S.modeWallets = keepWallets;
        S.storyLevel = keepStoryLevel;
        S.storyLastMission = Math.max(keepStoryLevel, keepStoryLastMission);
        S.arcadeLevel = keepArcadeLevel;
        S.survivalWave = keepSurvivalWave;
        bindFundsWallet(S);
        syncWindowState();
        resizeCanvasForViewport();
        applyTouchHudSettings();
        deploy({ carryStats:true, hp:S.hp, armor:S.armor });
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
      }
    }catch(recoverErr){
      try{ console.error("Startup recovery failed:", recoverErr); }catch(e){}
    }
  }
}

bootstrap();

// Flush progress when app is backgrounded/closed (important on mobile).
window.addEventListener("pagehide", ()=>{
  try{ save(true); }catch(e){}
}, { capture:true });
document.addEventListener("visibilitychange", ()=>{
  if(document.visibilityState !== "hidden") return;
  try{ save(true); }catch(e){}
});


// ===================== TUTORIAL ACCESS =====================
// expose live game state safely for tutorial system
window.getGameState = () => S;
window.isTutorialRunning = () => window.TigerTutorial?.isRunning === true;
window.getTutorialConfig = () => ({
  capturePct: Math.round(storyCaptureWindowPct() * 100),
  shieldDurationSec: Math.max(1, Math.round(SHIELD_DURATION_MS / 1000)),
  shieldCooldownSec: Math.max(1, Math.round((ABILITY_COOLDOWN_MS?.shield || 0) / 1000)),
  squadUnlockLevel: Number(SOLDIER_UNLOCK_LEVEL || 15),
  squadUnitPrice: Number(SOLDIER_PRICE || 50000),
  squadBundlePrice: Number(REINFORCEMENT_BUNDLE_PRICE || 80000)
});


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
window.setStoryCampaignMode = setStoryCampaignMode;
window.startStoryNgPlus = startStoryNgPlus;
window.startEndlessGauntlet = startEndlessGauntlet;
window.startEliteBossHunt = startEliteBossHunt;
window.cycleEliteHuntChapter = cycleEliteHuntChapter;
window.openLaunchIntro = openLaunchIntro;
window.beginFromLaunchIntro = beginFromLaunchIntro;
window.startQuickTutorialFromLaunchIntro = startQuickTutorialFromLaunchIntro;
window.openContractsFromLaunchIntro = openContractsFromLaunchIntro;
window.openClanContractsFromLaunchIntro = openClanContractsFromLaunchIntro;
window.skipLaunchIntro = skipLaunchIntro;
window.restartFromMission1FromLaunchIntro = restartFromMission1FromLaunchIntro;
window.saveGameNow = saveGameNow;
window.loadStorySaveFromLaunchIntro = loadStorySaveFromLaunchIntro;
window.openDailyRewardOverlay = openDailyRewardOverlay;
window.claimDailyRewardOverlay = claimDailyRewardOverlay;
window.setLaunchArtwork = setLaunchArtwork;
window.openStoryIntro = openStoryIntro;
window.startStoryIntroMission = startStoryIntroMission;
window.beginStoryMissionFromIntro = beginStoryMissionFromIntro;
window.startQuickTutorialFromIntro = startQuickTutorialFromIntro;
window.skipStoryIntro = skipStoryIntro;
window.toggleChapterRecap = toggleChapterRecap;
window.closeMissionBrief = closeMissionBrief;
window.selectArcadeBuildcraft = selectArcadeBuildcraft;

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
window.useProtectAction = useProtectAction;
window.takeoverEscort = takeoverEscort;
window.useNearestCache = useNearestCache;
window.setSquadCommand = setSquadCommand;
window.cycleSquadCommand = cycleSquadCommand;
window.openSquadCommandWheel = openSquadCommandWheel;
window.closeSquadCommandWheel = closeSquadCommandWheel;
window.toggleSquadCommandWheel = toggleSquadCommandWheel;
window.pickSquadCommand = pickSquadCommand;

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
window.unlockSeasonPremium = unlockSeasonPremium;
window.claimSeasonPassReward = claimSeasonPassReward;
window.equipSeasonPassCosmetic = equipSeasonPassCosmetic;
window.claimMasteryReward = claimMasteryReward;
window.equipMasteryEliteTitle = equipMasteryEliteTitle;
window.buyTrap = buyTrap;
window.openStarsTopUp = openStarsTopUp;
window.buyWithStars = buyWithStars;
window.claimPendingStarsPurchase = claimPendingStarsPurchase;
window.setClanTagPrompt = setClanTagPrompt;
window.setClanNamePrompt = setClanNamePrompt;
window.toggleRaidMode = toggleRaidMode;
window.refreshClanCloudNow = refreshClanCloudNow;
window.claimClanContract = claimClanContract;
window.clearPendingStarsPurchase = clearPendingStarsPurchase;
window.awardDailyLogin = awardDailyLogin;
window.equipWeapon = equipWeapon;
window.openQuickWeaponPicker = openQuickWeaponPicker;
window.closeQuickWeaponPicker = closeQuickWeaponPicker;
window.selectQuickWeapon = selectQuickWeapon;
window.buyPerk = buyPerk;
window.claimContract = claimContract;
window.claimAllContracts = claimAllContracts;
window.lockNearestTiger = lockNearestTiger;
window.canAttemptCapture = canAttemptCapture;
window.tutorialCaptureWindowReady = tutorialCaptureWindowReady;
window.tutorialAnyCaptureWindowReady = tutorialAnyCaptureWindowReady;
