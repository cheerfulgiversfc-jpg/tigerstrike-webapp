const { getState, setState } = require("./metrics-store");

const PLAYER_STATE_PREFIX = "player_stats_u_";
const LEADERBOARD_STATE_KEY = "player_leaderboards_v1";
const LEADERBOARD_VERSION = 1;
const LEADERBOARD_STORE_LIMIT = 120;
const CLAN_LEADERBOARD_STORE_LIMIT = 500;
const CLAN_MEMBER_STORE_LIMIT = 3000;
const SEASON_TIER_LADDER = [
  { name: "Bronze", minPoints: 0 },
  { name: "Silver", minPoints: 2500 },
  { name: "Gold", minPoints: 6000 },
  { name: "Platinum", minPoints: 10000 },
  { name: "Diamond", minPoints: 15000 },
  { name: "Legend", minPoints: 22000 },
];
const CLAN_CONTRACT_POOL = [
  {
    id: "C_EVAC_CONVOY",
    title: "Clan Convoy",
    desc: "Your clan evacuates civilians across operations this week.",
    metric: "evac",
    baseTarget: 22,
    perMember: 6,
    reward: { cash: 2600, perkPoints: 1 },
  },
  {
    id: "C_CAPTURE_GRID",
    title: "Capture Grid",
    desc: "Coordinate clan captures for research output.",
    metric: "captures",
    baseTarget: 16,
    perMember: 4,
    reward: { cash: 2800, perkPoints: 1 },
  },
  {
    id: "C_MISSION_DRIVE",
    title: "Mission Drive",
    desc: "Clear operations as a clan this week.",
    metric: "missionsCleared",
    baseTarget: 12,
    perMember: 3,
    reward: { cash: 3100, perkPoints: 2 },
  },
  {
    id: "C_CASH_CHAIN",
    title: "War Chest Chain",
    desc: "Accumulate mission cash as a clan.",
    metric: "cashEarned",
    baseTarget: 22000,
    perMember: 8500,
    reward: { cash: 3600, perkPoints: 2 },
  },
];

function toInt(value, fallback = 0){
  const n = Number(value);
  if(!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function clampNonNegative(value){
  const n = Number(value);
  if(!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function safeText(value){
  return String(value || "").trim();
}

function safeUsername(value){
  return safeText(value).replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 64);
}

function safeUserId(value){
  const n = toInt(value, 0);
  return n > 0 ? n : 0;
}

function normalizeClanTag(value){
  const cleaned = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.slice(0, 10) || "SOLO";
}

function sanitizeClanName(value, fallbackTag = "SOLO"){
  const raw = String(value || "").replace(/\s+/g, " ").trim();
  if(raw) return raw.slice(0, 36);
  const tag = normalizeClanTag(fallbackTag);
  return tag === "SOLO" ? "Lone Tigers" : `${tag} Clan`;
}

function nowSec(){
  return Math.floor(Date.now() / 1000);
}

function monthKeyUTC(tsMs = Date.now()){
  const d = new Date(Number(tsMs || Date.now()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dayKeyUTC(tsMs = Date.now()){
  const d = new Date(Number(tsMs || Date.now()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekKeyUTC(tsMs = Date.now()){
  const d = new Date(Number(tsMs || Date.now()));
  const utcDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function contractHashInt(str = ""){
  let h = 2166136261;
  for(let i = 0; i < str.length; i += 1){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededPick(pool, count, seed){
  const arr = Array.isArray(pool) ? pool.slice() : [];
  let s = (seed >>> 0) || 1;
  const rand = ()=>{
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for(let i = arr.length - 1; i > 0; i -= 1){
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, Math.max(0, Math.min(count, arr.length)));
}

function displayNameFromUser(user, userId = 0){
  const first = safeText(user?.first_name);
  const last = safeText(user?.last_name);
  const full = `${first} ${last}`.trim();
  if(full) return full.slice(0, 80);
  const username = safeUsername(user?.username);
  if(username) return `@${username}`;
  const id = safeUserId(user?.id) || safeUserId(userId);
  return id > 0 ? `Player ${id}` : "Player";
}

function userSnapshot(user, fallbackUserId = 0){
  const id = safeUserId(user?.id) || safeUserId(fallbackUserId);
  const username = safeUsername(user?.username);
  return {
    userId: id,
    username,
    firstName: safeText(user?.first_name).slice(0, 60),
    lastName: safeText(user?.last_name).slice(0, 60),
    displayName: displayNameFromUser(user, id),
  };
}

function scoreFormula(parts){
  const kills = clampNonNegative(parts?.kills);
  const captures = clampNonNegative(parts?.captures);
  const evac = clampNonNegative(parts?.evac);
  const missions = clampNonNegative(parts?.missionsCleared);
  const civLost = clampNonNegative(parts?.civiliansLost);
  const cashEarned = clampNonNegative(parts?.cashEarned);
  const score = Math.round(
    (kills * 120) +
    (captures * 180) +
    (evac * 110) +
    (missions * 260) +
    Math.round(cashEarned * 0.05) -
    (civLost * 300)
  );
  return score > 0 ? score : 0;
}

function seasonTierFromPoints(points){
  const pts = clampNonNegative(points);
  let idx = 0;
  for(let i = 0; i < SEASON_TIER_LADDER.length; i += 1){
    if(pts >= SEASON_TIER_LADDER[i].minPoints){
      idx = i;
    }else{
      break;
    }
  }
  const current = SEASON_TIER_LADDER[idx];
  const next = SEASON_TIER_LADDER[idx + 1] || null;
  const floor = current.minPoints;
  const ceil = next ? next.minPoints : floor;
  const span = Math.max(1, ceil - floor);
  const progressRaw = next ? Math.floor(((pts - floor) / span) * 100) : 100;
  return {
    index: idx,
    current: current.name,
    next: next ? next.name : "MAX",
    nextPoints: next ? next.minPoints : floor,
    pointsToNext: next ? Math.max(0, next.minPoints - pts) : 0,
    progressPct: Math.max(0, Math.min(100, progressRaw)),
  };
}

function buildSeasonSnapshot(profile){
  const weekly = (profile && profile.weekly && typeof profile.weekly === "object") ? profile.weekly : {};
  const points = clampNonNegative(weekly.score);
  const tier = seasonTierFromPoints(points);
  return {
    period: safeText(weekly.period || weekKeyUTC()),
    points,
    tier: tier.current,
    tierIndex: tier.index,
    nextTier: tier.next,
    nextTierPoints: clampNonNegative(tier.nextPoints),
    pointsToNext: clampNonNegative(tier.pointsToNext),
    progressPct: clampNonNegative(tier.progressPct),
    kills: clampNonNegative(weekly.kills),
    captures: clampNonNegative(weekly.captures),
    evac: clampNonNegative(weekly.evac),
    civiliansLost: clampNonNegative(weekly.civiliansLost),
    missionsCleared: clampNonNegative(weekly.missionsCleared),
    cashEarned: clampNonNegative(weekly.cashEarned),
  };
}

function defaultProfile(user, userId = 0){
  const snap = userSnapshot(user, userId);
  const ts = nowSec();
  const day = dayKeyUTC();
  const week = weekKeyUTC();
  const month = monthKeyUTC();
  return {
    version: 1,
    userId: snap.userId,
    username: snap.username,
    firstName: snap.firstName,
    lastName: snap.lastName,
    displayName: snap.displayName,
    createdAt: ts,
    updatedAt: ts,
    lastSeenAt: ts,
    ordersCreated: 0,
    claimsPaid: 0,
    claimsPending: 0,
    claimsError: 0,
    starsSpentTotal: 0,
    fundsGrantedTotal: 0,
    bundlesGranted: 0,
    cashPurchases: 0,
    lastSku: "",
    lastOrderRef: "",
    lastTransactionId: "",
    lastPaidAt: 0,
    referredBy: 0,
    referralsStarted: 0,
    weekly: {
      period: week,
      ordersCreated: 0,
      claimsPaid: 0,
      starsSpent: 0,
      fundsGranted: 0,
      referrals: 0,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      score: 0,
    },
    monthly: {
      period: month,
      ordersCreated: 0,
      claimsPaid: 0,
      starsSpent: 0,
      fundsGranted: 0,
      referrals: 0,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      score: 0,
    },
    daily: {
      period: day,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      score: 0,
    },
    season: {
      period: week,
      points: 0,
      tier: "Bronze",
      tierIndex: 0,
      nextTier: "Silver",
      nextTierPoints: 2500,
      pointsToNext: 2500,
      progressPct: 0,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
    },
    ops: {
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      lastMode: "Story",
      lastMission: 1,
      lastLevel: 1,
      lastFunds: 0,
      lastHp: 100,
      lastArmor: 20,
      lastSyncAt: 0,
    },
    clan: {
      tag: "SOLO",
      name: "Lone Tigers",
      raidEnabled: false,
      updatedAt: ts,
    },
    lifetimeScore: 0,
  };
}

function normalizeProfile(raw, user = null, fallbackUserId = 0){
  const base = defaultProfile(user, fallbackUserId);
  const src = (raw && typeof raw === "object") ? raw : {};
  const out = {
    ...base,
    ...src,
  };
  const snap = userSnapshot(user || out, out.userId || fallbackUserId);
  out.userId = safeUserId(out.userId) || snap.userId;
  out.username = safeUsername(snap.username || out.username);
  out.firstName = safeText(snap.firstName || out.firstName).slice(0, 60);
  out.lastName = safeText(snap.lastName || out.lastName).slice(0, 60);
  out.displayName = safeText(snap.displayName || out.displayName).slice(0, 80);

  out.createdAt = toInt(out.createdAt || base.createdAt, base.createdAt);
  out.updatedAt = toInt(out.updatedAt || base.updatedAt, base.updatedAt);
  out.lastSeenAt = toInt(out.lastSeenAt || base.lastSeenAt, base.lastSeenAt);

  out.ordersCreated = clampNonNegative(out.ordersCreated);
  out.claimsPaid = clampNonNegative(out.claimsPaid);
  out.claimsPending = clampNonNegative(out.claimsPending);
  out.claimsError = clampNonNegative(out.claimsError);
  out.starsSpentTotal = clampNonNegative(out.starsSpentTotal);
  out.fundsGrantedTotal = clampNonNegative(out.fundsGrantedTotal);
  out.bundlesGranted = clampNonNegative(out.bundlesGranted);
  out.cashPurchases = clampNonNegative(out.cashPurchases);
  out.lastSku = safeText(out.lastSku).slice(0, 80);
  out.lastOrderRef = safeText(out.lastOrderRef).slice(0, 220);
  out.lastTransactionId = safeText(out.lastTransactionId).slice(0, 180);
  out.lastPaidAt = clampNonNegative(out.lastPaidAt);
  out.referredBy = safeUserId(out.referredBy);
  out.referralsStarted = clampNonNegative(out.referralsStarted);

  out.weekly = {
    ...base.weekly,
    ...(out.weekly && typeof out.weekly === "object" ? out.weekly : {}),
  };
  out.monthly = {
    ...base.monthly,
    ...(out.monthly && typeof out.monthly === "object" ? out.monthly : {}),
  };
  out.daily = {
    ...base.daily,
    ...(out.daily && typeof out.daily === "object" ? out.daily : {}),
  };
  out.ops = {
    ...base.ops,
    ...(out.ops && typeof out.ops === "object" ? out.ops : {}),
  };
  out.clan = {
    ...base.clan,
    ...(out.clan && typeof out.clan === "object" ? out.clan : {}),
  };

  out.weekly.period = safeText(out.weekly.period || base.weekly.period);
  out.weekly.ordersCreated = clampNonNegative(out.weekly.ordersCreated);
  out.weekly.claimsPaid = clampNonNegative(out.weekly.claimsPaid);
  out.weekly.starsSpent = clampNonNegative(out.weekly.starsSpent);
  out.weekly.fundsGranted = clampNonNegative(out.weekly.fundsGranted);
  out.weekly.referrals = clampNonNegative(out.weekly.referrals);
  out.weekly.kills = clampNonNegative(out.weekly.kills);
  out.weekly.captures = clampNonNegative(out.weekly.captures);
  out.weekly.evac = clampNonNegative(out.weekly.evac);
  out.weekly.civiliansLost = clampNonNegative(out.weekly.civiliansLost);
  out.weekly.missionsCleared = clampNonNegative(out.weekly.missionsCleared);
  out.weekly.cashEarned = clampNonNegative(out.weekly.cashEarned);
  out.weekly.score = clampNonNegative(out.weekly.score);

  out.monthly.period = safeText(out.monthly.period || base.monthly.period);
  out.monthly.ordersCreated = clampNonNegative(out.monthly.ordersCreated);
  out.monthly.claimsPaid = clampNonNegative(out.monthly.claimsPaid);
  out.monthly.starsSpent = clampNonNegative(out.monthly.starsSpent);
  out.monthly.fundsGranted = clampNonNegative(out.monthly.fundsGranted);
  out.monthly.referrals = clampNonNegative(out.monthly.referrals);
  out.monthly.kills = clampNonNegative(out.monthly.kills);
  out.monthly.captures = clampNonNegative(out.monthly.captures);
  out.monthly.evac = clampNonNegative(out.monthly.evac);
  out.monthly.civiliansLost = clampNonNegative(out.monthly.civiliansLost);
  out.monthly.missionsCleared = clampNonNegative(out.monthly.missionsCleared);
  out.monthly.cashEarned = clampNonNegative(out.monthly.cashEarned);
  out.monthly.score = clampNonNegative(out.monthly.score);

  out.daily.period = safeText(out.daily.period || base.daily.period);
  out.daily.kills = clampNonNegative(out.daily.kills);
  out.daily.captures = clampNonNegative(out.daily.captures);
  out.daily.evac = clampNonNegative(out.daily.evac);
  out.daily.civiliansLost = clampNonNegative(out.daily.civiliansLost);
  out.daily.missionsCleared = clampNonNegative(out.daily.missionsCleared);
  out.daily.cashEarned = clampNonNegative(out.daily.cashEarned);
  out.daily.score = clampNonNegative(out.daily.score);
  out.season = buildSeasonSnapshot(out);

  out.ops.kills = clampNonNegative(out.ops.kills);
  out.ops.captures = clampNonNegative(out.ops.captures);
  out.ops.evac = clampNonNegative(out.ops.evac);
  out.ops.civiliansLost = clampNonNegative(out.ops.civiliansLost);
  out.ops.missionsCleared = clampNonNegative(out.ops.missionsCleared);
  out.ops.cashEarned = clampNonNegative(out.ops.cashEarned);
  out.ops.lastMode = safeText(out.ops.lastMode || "Story").slice(0, 20) || "Story";
  out.ops.lastMission = Math.max(1, toInt(out.ops.lastMission, 1));
  out.ops.lastLevel = Math.max(1, toInt(out.ops.lastLevel, 1));
  out.ops.lastFunds = clampNonNegative(out.ops.lastFunds);
  out.ops.lastHp = clampNonNegative(out.ops.lastHp);
  out.ops.lastArmor = clampNonNegative(out.ops.lastArmor);
  out.ops.lastSyncAt = clampNonNegative(out.ops.lastSyncAt);

  out.clan.tag = normalizeClanTag(out.clan.tag || base.clan.tag);
  out.clan.name = sanitizeClanName(out.clan.name, out.clan.tag);
  out.clan.raidEnabled = !!out.clan.raidEnabled;
  out.clan.updatedAt = clampNonNegative(out.clan.updatedAt || out.updatedAt || nowSec());

  out.lifetimeScore = clampNonNegative(out.lifetimeScore);
  return out;
}

function ensurePeriodBuckets(profile){
  const day = dayKeyUTC();
  const week = weekKeyUTC();
  const month = monthKeyUTC();

  if(profile.daily.period !== day){
    profile.daily = {
      period: day,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      score: 0,
    };
  }
  if(profile.weekly.period !== week){
    profile.weekly = {
      period: week,
      ordersCreated: 0,
      claimsPaid: 0,
      starsSpent: 0,
      fundsGranted: 0,
      referrals: 0,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      score: 0,
    };
  }
  if(profile.monthly.period !== month){
    profile.monthly = {
      period: month,
      ordersCreated: 0,
      claimsPaid: 0,
      starsSpent: 0,
      fundsGranted: 0,
      referrals: 0,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      score: 0,
    };
  }
}

function recomputeScores(profile){
  profile.lifetimeScore = scoreFormula({
    starsSpent: profile.starsSpentTotal,
    fundsGranted: profile.fundsGrantedTotal,
    claimsPaid: profile.claimsPaid,
    referrals: profile.referralsStarted,
    ordersCreated: profile.ordersCreated,
    kills: profile.ops?.kills,
    captures: profile.ops?.captures,
    evac: profile.ops?.evac,
    civiliansLost: profile.ops?.civiliansLost,
    missionsCleared: profile.ops?.missionsCleared,
    cashEarned: profile.ops?.cashEarned,
  });
  profile.daily.score = scoreFormula({
    kills: profile.daily?.kills,
    captures: profile.daily?.captures,
    evac: profile.daily?.evac,
    civiliansLost: profile.daily?.civiliansLost,
    missionsCleared: profile.daily?.missionsCleared,
    cashEarned: profile.daily?.cashEarned,
  });
  profile.weekly.score = scoreFormula({
    starsSpent: profile.weekly.starsSpent,
    fundsGranted: profile.weekly.fundsGranted,
    claimsPaid: profile.weekly.claimsPaid,
    referrals: profile.weekly.referrals,
    ordersCreated: profile.weekly.ordersCreated,
    kills: profile.weekly.kills,
    captures: profile.weekly.captures,
    evac: profile.weekly.evac,
    civiliansLost: profile.weekly.civiliansLost,
    missionsCleared: profile.weekly.missionsCleared,
    cashEarned: profile.weekly.cashEarned,
  });
  profile.monthly.score = scoreFormula({
    starsSpent: profile.monthly.starsSpent,
    fundsGranted: profile.monthly.fundsGranted,
    claimsPaid: profile.monthly.claimsPaid,
    referrals: profile.monthly.referrals,
    ordersCreated: profile.monthly.ordersCreated,
    kills: profile.monthly.kills,
    captures: profile.monthly.captures,
    evac: profile.monthly.evac,
    civiliansLost: profile.monthly.civiliansLost,
    missionsCleared: profile.monthly.missionsCleared,
    cashEarned: profile.monthly.cashEarned,
  });
  profile.season = buildSeasonSnapshot(profile);
}

function profileStateKey(userId){
  return `${PLAYER_STATE_PREFIX}${safeUserId(userId)}`;
}

async function readProfile(userId){
  const uid = safeUserId(userId);
  if(!uid) return null;
  const raw = await getState(profileStateKey(uid));
  return normalizeProfile(raw, null, uid);
}

async function writeProfile(profile){
  const uid = safeUserId(profile?.userId);
  if(!uid) return null;
  const normalized = normalizeProfile(profile, null, uid);
  await setState(profileStateKey(uid), normalized);
  return normalized;
}

function leaderboardEntryFromProfile(profile, scoreField = "lifetimeScore"){
  const score = clampNonNegative(profile?.[scoreField]);
  const season = (profile && profile.season && typeof profile.season === "object") ? profile.season : {};
  const ops = (profile && profile.ops && typeof profile.ops === "object") ? profile.ops : {};
  return {
    userId: safeUserId(profile?.userId),
    username: safeUsername(profile?.username),
    displayName: safeText(profile?.displayName || "").slice(0, 80) || `Player ${safeUserId(profile?.userId)}`,
    score,
    kills: clampNonNegative(ops.kills),
    captures: clampNonNegative(ops.captures),
    evac: clampNonNegative(ops.evac),
    civiliansLost: clampNonNegative(ops.civiliansLost),
    missionsCleared: clampNonNegative(ops.missionsCleared),
    cashEarned: clampNonNegative(ops.cashEarned),
    starsSpent: clampNonNegative(profile?.starsSpentTotal),
    claimsPaid: clampNonNegative(profile?.claimsPaid),
    fundsGranted: clampNonNegative(profile?.fundsGrantedTotal),
    referrals: clampNonNegative(profile?.referralsStarted),
    seasonPoints: clampNonNegative(season.points),
    seasonTier: safeText(season.tier || "Bronze"),
    updatedAt: toInt(profile?.updatedAt, nowSec()),
  };
}

function periodEntryFromProfile(profile, bucket = "weekly"){
  const node = (profile && profile[bucket] && typeof profile[bucket] === "object") ? profile[bucket] : {};
  const season = (profile && profile.season && typeof profile.season === "object") ? profile.season : {};
  return {
    userId: safeUserId(profile?.userId),
    username: safeUsername(profile?.username),
    displayName: safeText(profile?.displayName || "").slice(0, 80) || `Player ${safeUserId(profile?.userId)}`,
    score: clampNonNegative(node.score),
    kills: clampNonNegative(node.kills),
    captures: clampNonNegative(node.captures),
    evac: clampNonNegative(node.evac),
    civiliansLost: clampNonNegative(node.civiliansLost),
    missionsCleared: clampNonNegative(node.missionsCleared),
    cashEarned: clampNonNegative(node.cashEarned),
    starsSpent: clampNonNegative(node.starsSpent),
    claimsPaid: clampNonNegative(node.claimsPaid),
    fundsGranted: clampNonNegative(node.fundsGranted),
    referrals: clampNonNegative(node.referrals),
    seasonPoints: clampNonNegative(season.points || node.score),
    seasonTier: safeText(season.tier || "Bronze"),
    updatedAt: toInt(profile?.updatedAt, nowSec()),
  };
}

function clanContributionFromProfile(profile){
  const weekly = (profile && profile.weekly && typeof profile.weekly === "object") ? profile.weekly : {};
  const clan = (profile && profile.clan && typeof profile.clan === "object") ? profile.clan : {};
  return {
    userId: safeUserId(profile?.userId),
    clanTag: normalizeClanTag(clan.tag || "SOLO"),
    clanName: sanitizeClanName(clan.name, clan.tag || "SOLO"),
    score: clampNonNegative(weekly.score),
    kills: clampNonNegative(weekly.kills),
    captures: clampNonNegative(weekly.captures),
    evac: clampNonNegative(weekly.evac),
    civiliansLost: clampNonNegative(weekly.civiliansLost),
    missionsCleared: clampNonNegative(weekly.missionsCleared),
    cashEarned: clampNonNegative(weekly.cashEarned),
    updatedAt: toInt(profile?.updatedAt, nowSec()),
  };
}

function normalizeClanMemberContribution(raw){
  if(!raw || typeof raw !== "object") return null;
  const userId = safeUserId(raw.userId);
  if(!userId) return null;
  const clanTag = normalizeClanTag(raw.clanTag || "SOLO");
  return {
    userId,
    clanTag,
    clanName: sanitizeClanName(raw.clanName, clanTag),
    score: clampNonNegative(raw.score),
    kills: clampNonNegative(raw.kills),
    captures: clampNonNegative(raw.captures),
    evac: clampNonNegative(raw.evac),
    civiliansLost: clampNonNegative(raw.civiliansLost),
    missionsCleared: clampNonNegative(raw.missionsCleared),
    cashEarned: clampNonNegative(raw.cashEarned),
    updatedAt: toInt(raw.updatedAt, nowSec()),
  };
}

function normalizeClanLeaderboardEntry(raw){
  if(!raw || typeof raw !== "object") return null;
  const clanTag = normalizeClanTag(raw.clanTag || "SOLO");
  return {
    clanTag,
    clanName: sanitizeClanName(raw.clanName, clanTag),
    score: clampNonNegative(raw.score),
    members: Math.max(1, toInt(raw.members, 1)),
    kills: clampNonNegative(raw.kills),
    captures: clampNonNegative(raw.captures),
    evac: clampNonNegative(raw.evac),
    civiliansLost: clampNonNegative(raw.civiliansLost),
    missionsCleared: clampNonNegative(raw.missionsCleared),
    cashEarned: clampNonNegative(raw.cashEarned),
    updatedAt: toInt(raw.updatedAt, nowSec()),
  };
}

function trimClanMembersMap(members){
  const src = (members && typeof members === "object") ? members : {};
  const rows = Object.values(src)
    .map((entry)=>normalizeClanMemberContribution(entry))
    .filter(Boolean)
    .sort((a, b)=>toInt(b?.updatedAt) - toInt(a?.updatedAt));
  const keep = rows.slice(0, CLAN_MEMBER_STORE_LIMIT);
  const out = {};
  for(const row of keep){
    out[String(row.userId)] = row;
  }
  return out;
}

function clanEntriesSortedTrimmed(entries, limit = CLAN_LEADERBOARD_STORE_LIMIT){
  const arr = Array.isArray(entries) ? entries.slice() : [];
  arr.sort((a, b)=>{
    const scoreDelta = clampNonNegative(b?.score) - clampNonNegative(a?.score);
    if(scoreDelta !== 0) return scoreDelta;
    const missionDelta = clampNonNegative(b?.missionsCleared) - clampNonNegative(a?.missionsCleared);
    if(missionDelta !== 0) return missionDelta;
    const captureDelta = clampNonNegative(b?.captures) - clampNonNegative(a?.captures);
    if(captureDelta !== 0) return captureDelta;
    const killDelta = clampNonNegative(b?.kills) - clampNonNegative(a?.kills);
    if(killDelta !== 0) return killDelta;
    const evacDelta = clampNonNegative(b?.evac) - clampNonNegative(a?.evac);
    if(evacDelta !== 0) return evacDelta;
    const memberDelta = clampNonNegative(b?.members) - clampNonNegative(a?.members);
    if(memberDelta !== 0) return memberDelta;
    const updatedDelta = toInt(b?.updatedAt) - toInt(a?.updatedAt);
    if(updatedDelta !== 0) return updatedDelta;
    return String(a?.clanTag || "").localeCompare(String(b?.clanTag || ""));
  });
  return arr.slice(0, Math.max(1, toInt(limit, CLAN_LEADERBOARD_STORE_LIMIT)));
}

function rebuildClanLeaderboardEntries(members){
  const src = (members && typeof members === "object") ? members : {};
  const byClan = new Map();
  for(const value of Object.values(src)){
    const row = normalizeClanMemberContribution(value);
    if(!row) continue;
    const key = row.clanTag;
    const current = byClan.get(key) || {
      clanTag: row.clanTag,
      clanName: row.clanName,
      score: 0,
      members: 0,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      updatedAt: 0,
    };
    current.clanName = row.clanName || current.clanName;
    current.members += 1;
    current.score += row.score;
    current.kills += row.kills;
    current.captures += row.captures;
    current.evac += row.evac;
    current.civiliansLost += row.civiliansLost;
    current.missionsCleared += row.missionsCleared;
    current.cashEarned += row.cashEarned;
    current.updatedAt = Math.max(current.updatedAt, row.updatedAt);
    byClan.set(key, current);
  }
  return clanEntriesSortedTrimmed(
    Array.from(byClan.values()).map((entry)=>normalizeClanLeaderboardEntry(entry)).filter(Boolean),
    CLAN_LEADERBOARD_STORE_LIMIT
  );
}

function sortedTrimmed(entries, limit = LEADERBOARD_STORE_LIMIT){
  const arr = Array.isArray(entries) ? entries.slice() : [];
  arr.sort((a, b)=>{
    const scoreDelta = clampNonNegative(b?.score) - clampNonNegative(a?.score);
    if(scoreDelta !== 0) return scoreDelta;
    const missionDelta = clampNonNegative(b?.missionsCleared) - clampNonNegative(a?.missionsCleared);
    if(missionDelta !== 0) return missionDelta;
    const captureDelta = clampNonNegative(b?.captures) - clampNonNegative(a?.captures);
    if(captureDelta !== 0) return captureDelta;
    const killDelta = clampNonNegative(b?.kills) - clampNonNegative(a?.kills);
    if(killDelta !== 0) return killDelta;
    const evacDelta = clampNonNegative(b?.evac) - clampNonNegative(a?.evac);
    if(evacDelta !== 0) return evacDelta;
    const starsDelta = clampNonNegative(b?.starsSpent) - clampNonNegative(a?.starsSpent);
    if(starsDelta !== 0) return starsDelta;
    const paidDelta = clampNonNegative(b?.claimsPaid) - clampNonNegative(a?.claimsPaid);
    if(paidDelta !== 0) return paidDelta;
    const updatedDelta = toInt(b?.updatedAt) - toInt(a?.updatedAt);
    if(updatedDelta !== 0) return updatedDelta;
    return safeUserId(a?.userId) - safeUserId(b?.userId);
  });
  return arr.slice(0, Math.max(1, toInt(limit, LEADERBOARD_STORE_LIMIT)));
}

function upsertLeaderboardEntry(entries, entry, limit = LEADERBOARD_STORE_LIMIT){
  const uid = safeUserId(entry?.userId);
  if(!uid) return sortedTrimmed(entries, limit);
  const arr = Array.isArray(entries) ? entries.slice() : [];
  const next = arr.filter((row)=>safeUserId(row?.userId) !== uid);
  if(clampNonNegative(entry?.score) > 0){
    next.push(entry);
  }
  return sortedTrimmed(next, limit);
}

function defaultLeaderboardState(){
  return {
    version: LEADERBOARD_VERSION,
    updatedAt: nowSec(),
    global: { entries: [] },
    weekly: { period: weekKeyUTC(), entries: [] },
    season: { period: weekKeyUTC(), entries: [] },
    monthly: { period: monthKeyUTC(), entries: [] },
    clans: { period: weekKeyUTC(), entries: [], members: {} },
  };
}

function normalizeLeaderboardState(raw){
  const base = defaultLeaderboardState();
  const src = (raw && typeof raw === "object") ? raw : {};
  const out = {
    ...base,
    ...src,
    global: {
      ...(base.global || {}),
      ...(src.global && typeof src.global === "object" ? src.global : {}),
    },
    weekly: {
      ...(base.weekly || {}),
      ...(src.weekly && typeof src.weekly === "object" ? src.weekly : {}),
    },
    season: {
      ...(base.season || {}),
      ...(src.season && typeof src.season === "object" ? src.season : {}),
    },
    monthly: {
      ...(base.monthly || {}),
      ...(src.monthly && typeof src.monthly === "object" ? src.monthly : {}),
    },
    clans: {
      ...(base.clans || {}),
      ...(src.clans && typeof src.clans === "object" ? src.clans : {}),
    },
  };
  out.updatedAt = toInt(out.updatedAt, nowSec());
  out.weekly.period = safeText(out.weekly.period || weekKeyUTC());
  out.season.period = safeText(out.season.period || weekKeyUTC());
  out.monthly.period = safeText(out.monthly.period || monthKeyUTC());
  out.clans.period = safeText(out.clans.period || weekKeyUTC());
  out.global.entries = sortedTrimmed(out.global.entries, LEADERBOARD_STORE_LIMIT);
  out.weekly.entries = sortedTrimmed(out.weekly.entries, LEADERBOARD_STORE_LIMIT);
  out.season.entries = sortedTrimmed(out.season.entries, LEADERBOARD_STORE_LIMIT);
  out.monthly.entries = sortedTrimmed(out.monthly.entries, LEADERBOARD_STORE_LIMIT);
  out.clans.members = trimClanMembersMap(out.clans.members);
  out.clans.entries = rebuildClanLeaderboardEntries(out.clans.members);
  return out;
}

async function updateLeaderboardsFromProfile(profile){
  const week = weekKeyUTC();
  const month = monthKeyUTC();
  const board = normalizeLeaderboardState(await getState(LEADERBOARD_STATE_KEY));
  if(board.weekly.period !== week){
    board.weekly = { period: week, entries: [] };
  }
  if(board.season.period !== week){
    board.season = { period: week, entries: [] };
  }
  if(board.monthly.period !== month){
    board.monthly = { period: month, entries: [] };
  }
  if(board.clans.period !== week){
    board.clans = { period: week, entries: [], members: {} };
  }

  board.global.entries = upsertLeaderboardEntry(board.global.entries, leaderboardEntryFromProfile(profile), LEADERBOARD_STORE_LIMIT);
  board.weekly.entries = upsertLeaderboardEntry(board.weekly.entries, periodEntryFromProfile(profile, "weekly"), LEADERBOARD_STORE_LIMIT);
  board.season.entries = upsertLeaderboardEntry(board.season.entries, periodEntryFromProfile(profile, "weekly"), LEADERBOARD_STORE_LIMIT);
  board.monthly.entries = upsertLeaderboardEntry(board.monthly.entries, periodEntryFromProfile(profile, "monthly"), LEADERBOARD_STORE_LIMIT);
  const clanMember = clanContributionFromProfile(profile);
  if(clanMember.userId > 0){
    const currentMembers = (board.clans.members && typeof board.clans.members === "object") ? board.clans.members : {};
    const nextMembers = { ...currentMembers };
    delete nextMembers[String(clanMember.userId)];
    const hasClanScore =
      clanMember.score > 0 ||
      clanMember.missionsCleared > 0 ||
      clanMember.captures > 0 ||
      clanMember.kills > 0 ||
      clanMember.evac > 0 ||
      clanMember.cashEarned > 0;
    if(hasClanScore){
      nextMembers[String(clanMember.userId)] = clanMember;
    }
    board.clans.members = trimClanMembersMap({
      ...nextMembers,
    });
    board.clans.entries = rebuildClanLeaderboardEntries(board.clans.members);
  }
  board.updatedAt = nowSec();
  board.version = LEADERBOARD_VERSION;
  await setState(LEADERBOARD_STATE_KEY, board);
  return board;
}

async function upsertPlayerProfile(user, mutator){
  const uid = safeUserId(user?.id);
  if(!uid) return null;
  let profile = await readProfile(uid);
  profile = normalizeProfile(profile, user, uid);
  ensurePeriodBuckets(profile);

  if(typeof mutator === "function"){
    await mutator(profile);
  }

  profile.updatedAt = nowSec();
  profile.lastSeenAt = profile.updatedAt;
  recomputeScores(profile);
  const saved = await writeProfile(profile);
  await updateLeaderboardsFromProfile(saved);
  return saved;
}

async function touchPlayer(user){
  return upsertPlayerProfile(user, null);
}

async function getPlayerStats(user){
  const uid = safeUserId(user?.id || user);
  if(!uid) return null;
  const base = await readProfile(uid);
  if(base) return normalizeProfile(base, user, uid);
  if(typeof user === "object" && user){
    return upsertPlayerProfile(user, null);
  }
  return normalizeProfile(null, { id: uid }, uid);
}

function normalizeGameplaySnapshot(snapshot){
  const src = (snapshot && typeof snapshot === "object") ? snapshot : {};
  const clanTag = normalizeClanTag(src.clanTag || "SOLO");
  return {
    kills: clampNonNegative(src.kills),
    captures: clampNonNegative(src.captures),
    evac: clampNonNegative(src.evac),
    civiliansLost: clampNonNegative(src.civiliansLost),
    missionsCleared: clampNonNegative(src.missionsCleared),
    cashEarned: clampNonNegative(src.cashEarned),
    mode: safeText(src.mode || "Story").slice(0, 20) || "Story",
    mission: Math.max(1, toInt(src.mission, 1)),
    level: Math.max(1, toInt(src.level, 1)),
    funds: clampNonNegative(src.funds),
    hp: clampNonNegative(src.hp),
    armor: clampNonNegative(src.armor),
    clanTag,
    clanName: sanitizeClanName(src.clanName, clanTag),
    clanRaidEnabled: !!src.clanRaidEnabled,
  };
}

async function recordGameplaySnapshot({ user, snapshot }){
  const snap = normalizeGameplaySnapshot(snapshot);
  return upsertPlayerProfile(user, (profile)=>{
    profile.ops = {
      ...(profile.ops && typeof profile.ops === "object" ? profile.ops : {}),
      kills: clampNonNegative(profile?.ops?.kills),
      captures: clampNonNegative(profile?.ops?.captures),
      evac: clampNonNegative(profile?.ops?.evac),
      civiliansLost: clampNonNegative(profile?.ops?.civiliansLost),
      missionsCleared: clampNonNegative(profile?.ops?.missionsCleared),
      cashEarned: clampNonNegative(profile?.ops?.cashEarned),
      lastMode: safeText(profile?.ops?.lastMode || "Story").slice(0, 20) || "Story",
      lastMission: Math.max(1, toInt(profile?.ops?.lastMission, 1)),
      lastLevel: Math.max(1, toInt(profile?.ops?.lastLevel, 1)),
      lastFunds: clampNonNegative(profile?.ops?.lastFunds),
      lastHp: clampNonNegative(profile?.ops?.lastHp),
      lastArmor: clampNonNegative(profile?.ops?.lastArmor),
      lastSyncAt: clampNonNegative(profile?.ops?.lastSyncAt),
    };

    const keys = ["kills", "captures", "evac", "civiliansLost", "missionsCleared", "cashEarned"];
    for(const key of keys){
      const current = clampNonNegative(profile.ops[key]);
      const incoming = clampNonNegative(snap[key]);
      const next = Math.max(current, incoming);
      const delta = next - current;
      profile.ops[key] = next;
      if(delta > 0){
        profile.daily[key] = clampNonNegative(profile.daily[key]) + delta;
        profile.weekly[key] = clampNonNegative(profile.weekly[key]) + delta;
        profile.monthly[key] = clampNonNegative(profile.monthly[key]) + delta;
      }
    }

    profile.ops.lastMode = snap.mode;
    profile.ops.lastMission = snap.mission;
    profile.ops.lastLevel = snap.level;
    profile.ops.lastFunds = snap.funds;
    profile.ops.lastHp = snap.hp;
    profile.ops.lastArmor = snap.armor;
    profile.ops.lastSyncAt = nowSec();

    profile.clan = {
      ...(profile.clan && typeof profile.clan === "object" ? profile.clan : {}),
      tag: normalizeClanTag(snap.clanTag || profile?.clan?.tag || "SOLO"),
      name: sanitizeClanName(snap.clanName || profile?.clan?.name || "", snap.clanTag || profile?.clan?.tag || "SOLO"),
      raidEnabled: !!snap.clanRaidEnabled,
      updatedAt: nowSec(),
    };
  });
}

async function recordInvoiceCreated({ user, sku = "", orderRef = "", stars = 0 }){
  return upsertPlayerProfile(user, (profile)=>{
    const starsAmt = clampNonNegative(stars);
    profile.ordersCreated += 1;
    profile.lastSku = safeText(sku).slice(0, 80);
    profile.lastOrderRef = safeText(orderRef).slice(0, 220);
    profile.weekly.ordersCreated += 1;
    profile.monthly.ordersCreated += 1;
    if(starsAmt > 0){
      profile.weekly.starsSpent += 0; // created invoice does not equal paid spend
      profile.monthly.starsSpent += 0;
    }
  });
}

async function recordClaimPending({ user, sku = "" }){
  return upsertPlayerProfile(user, (profile)=>{
    profile.claimsPending += 1;
    profile.lastSku = safeText(sku).slice(0, 80);
  });
}

async function recordClaimError({ user, sku = "" }){
  return upsertPlayerProfile(user, (profile)=>{
    profile.claimsError += 1;
    profile.lastSku = safeText(sku).slice(0, 80);
  });
}

async function recordClaimPaid({ user, sku = "", stars = 0, funds = 0, kind = "", transactionId = "", paidAt = 0 }){
  return upsertPlayerProfile(user, (profile)=>{
    const starsAmt = clampNonNegative(stars);
    const fundsAmt = clampNonNegative(funds);
    const kindText = safeText(kind).toLowerCase();
    profile.claimsPaid += 1;
    profile.starsSpentTotal += starsAmt;
    profile.fundsGrantedTotal += fundsAmt;
    if(kindText === "bundle") profile.bundlesGranted += 1;
    if(fundsAmt > 0) profile.cashPurchases += 1;
    profile.lastSku = safeText(sku).slice(0, 80);
    profile.lastTransactionId = safeText(transactionId).slice(0, 180);
    profile.lastPaidAt = clampNonNegative(paidAt);

    profile.weekly.claimsPaid += 1;
    profile.weekly.starsSpent += starsAmt;
    profile.weekly.fundsGranted += fundsAmt;

    profile.monthly.claimsPaid += 1;
    profile.monthly.starsSpent += starsAmt;
    profile.monthly.fundsGranted += fundsAmt;
  });
}

async function recordReferralStart({ referredUser, referrerId }){
  const referredId = safeUserId(referredUser?.id);
  const refId = safeUserId(referrerId);
  if(!referredId || !refId || referredId === refId) return null;

  const referredProfile = await upsertPlayerProfile(referredUser, (profile)=>{
    if(!safeUserId(profile.referredBy)){
      profile.referredBy = refId;
    }
  });

  if(!referredProfile) return null;
  if(safeUserId(referredProfile.referredBy) !== refId) return referredProfile;

  const refProfileCurrent = await readProfile(refId);
  if(refProfileCurrent && clampNonNegative(refProfileCurrent.referralsStarted) > 0){
    const existingRef = safeUserId(referredProfile.referredBy);
    if(existingRef !== refId){
      return referredProfile;
    }
  }

  await upsertPlayerProfile({ id: refId }, (profile)=>{
    const duplicateGuardKey = `ref:${referredId}`;
    const refMap = (profile._refMap && typeof profile._refMap === "object") ? profile._refMap : {};
    if(refMap[duplicateGuardKey]) return;
    refMap[duplicateGuardKey] = 1;
    profile._refMap = refMap;
    profile.referralsStarted += 1;
    profile.weekly.referrals += 1;
    profile.monthly.referrals += 1;
  });

  // Keep private dedupe map compact and out of external snapshots.
  const cleaned = await readProfile(refId);
  if(cleaned && cleaned._refMap){
    const map = cleaned._refMap;
    const keys = Object.keys(map);
    if(keys.length > 400){
      const trimmed = {};
      keys.slice(-300).forEach((k)=>{ trimmed[k] = 1; });
      cleaned._refMap = trimmed;
      await writeProfile(cleaned);
      await updateLeaderboardsFromProfile(cleaned);
    }
  }

  return referredProfile;
}

function stripPrivateFields(profile){
  if(!profile || typeof profile !== "object") return profile;
  const out = { ...profile };
  delete out._refMap;
  return out;
}

function clanContractTarget(baseTarget, perMember, members){
  const base = Math.max(1, toInt(baseTarget, 1));
  const per = Math.max(0, toInt(perMember, 0));
  const team = Math.max(1, toInt(members, 1));
  return Math.max(1, base + (Math.max(0, team - 1) * per));
}

function clanContractsForEntry(clanEntry, weekKey){
  const entry = normalizeClanLeaderboardEntry(clanEntry) || normalizeClanLeaderboardEntry({
    clanTag: "SOLO",
    clanName: "Lone Tigers",
    score: 0,
    members: 1,
  });
  const period = safeText(weekKey || weekKeyUTC()) || weekKeyUTC();
  const seed = contractHashInt(`clan_contracts|${period}|${entry.clanTag}`);
  const picks = seededPick(CLAN_CONTRACT_POOL, Math.min(3, CLAN_CONTRACT_POOL.length), seed);
  const progressByMetric = {
    evac: clampNonNegative(entry.evac),
    captures: clampNonNegative(entry.captures),
    missionsCleared: clampNonNegative(entry.missionsCleared),
    cashEarned: clampNonNegative(entry.cashEarned),
  };
  return picks.map((tpl, idx)=>{
    const target = clanContractTarget(tpl.baseTarget, tpl.perMember, entry.members);
    const metric = safeText(tpl.metric || "missionsCleared");
    return {
      id: `${period}_${idx}_${tpl.id}`,
      key: tpl.id,
      title: safeText(tpl.title || "Clan Contract"),
      desc: safeText(tpl.desc || "Clan objective this week."),
      metric,
      target,
      progress: clampNonNegative(progressByMetric[metric] || 0),
      reward: {
        cash: clampNonNegative(tpl.reward?.cash || 0),
        perkPoints: clampNonNegative(tpl.reward?.perkPoints || 0),
      },
    };
  });
}

async function getClanCloudSnapshot(user){
  const uid = safeUserId(user?.id || user);
  if(!uid) return null;
  const profileRaw = await readProfile(uid);
  const profile = normalizeProfile(profileRaw, (typeof user === "object" ? user : null), uid);
  const board = normalizeLeaderboardState(await getState(LEADERBOARD_STATE_KEY));
  const week = weekKeyUTC();

  const myTag = normalizeClanTag(profile?.clan?.tag || "SOLO");
  const myName = sanitizeClanName(profile?.clan?.name, myTag);
  const clanEntriesPrimary = (board.clans.period === week && Array.isArray(board.clans.entries)) ? board.clans.entries : [];
  const clanEntriesAll = clanEntriesPrimary.length
    ? clanEntriesPrimary
    : rebuildClanLeaderboardEntries(board?.clans?.members);

  const rankIdx = clanEntriesAll.findIndex((row)=>normalizeClanTag(row?.clanTag) === myTag);
  const rank = rankIdx >= 0 ? rankIdx + 1 : 0;
  const found = rankIdx >= 0
    ? normalizeClanLeaderboardEntry(clanEntriesAll[rankIdx])
    : normalizeClanLeaderboardEntry({
      clanTag: myTag,
      clanName: myName,
      score: 0,
      members: 1,
      kills: 0,
      captures: 0,
      evac: 0,
      civiliansLost: 0,
      missionsCleared: 0,
      cashEarned: 0,
      updatedAt: nowSec(),
    });

  const contracts = clanContractsForEntry(found, week);
  return {
    tag: found.clanTag,
    name: found.clanName,
    rank,
    members: Math.max(1, toInt(found.members, 1)),
    score: clampNonNegative(found.score),
    kills: clampNonNegative(found.kills),
    captures: clampNonNegative(found.captures),
    evac: clampNonNegative(found.evac),
    missionsCleared: clampNonNegative(found.missionsCleared),
    cashEarned: clampNonNegative(found.cashEarned),
    updatedAt: toInt(found.updatedAt, nowSec()),
    contracts: {
      period: week,
      entries: contracts,
    },
  };
}

async function getLeaderboardSnapshot(limit = 10){
  const max = Math.max(1, Math.min(25, toInt(limit, 10)));
  const board = normalizeLeaderboardState(await getState(LEADERBOARD_STATE_KEY));
  const week = weekKeyUTC();
  const month = monthKeyUTC();
  const weeklyEntries = (board.weekly.period === week) ? board.weekly.entries : [];
  const seasonEntries = (board.season.period === week) ? board.season.entries : [];
  const monthlyEntries = (board.monthly.period === month) ? board.monthly.entries : [];
  return {
    updatedAt: board.updatedAt,
    periods: {
      weekly: week,
      season: week,
      monthly: month,
      clans: week,
    },
    global: board.global.entries.slice(0, max),
    weekly: weeklyEntries.slice(0, max),
    season: seasonEntries.slice(0, max),
    monthly: monthlyEntries.slice(0, max),
    clans: (board.clans.period === week ? board.clans.entries : []).slice(0, max),
  };
}

module.exports = {
  getPlayerStats: async (user)=>stripPrivateFields(await getPlayerStats(user)),
  touchPlayer,
  recordGameplaySnapshot,
  recordInvoiceCreated,
  recordClaimPending,
  recordClaimError,
  recordClaimPaid,
  recordReferralStart,
  getLeaderboardSnapshot,
  getClanCloudSnapshot,
};
