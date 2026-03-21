const { getState, setState } = require("./metrics-store");

const PLAYER_STATE_PREFIX = "player_stats_u_";
const LEADERBOARD_STATE_KEY = "player_leaderboards_v1";
const LEADERBOARD_VERSION = 1;
const LEADERBOARD_STORE_LIMIT = 120;

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

function nowSec(){
  return Math.floor(Date.now() / 1000);
}

function monthKeyUTC(tsMs = Date.now()){
  const d = new Date(Number(tsMs || Date.now()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
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
  const stars = clampNonNegative(parts?.starsSpent);
  const funds = clampNonNegative(parts?.fundsGranted);
  const paid = clampNonNegative(parts?.claimsPaid);
  const refs = clampNonNegative(parts?.referrals);
  const orders = clampNonNegative(parts?.ordersCreated);
  return Math.round(
    (stars * 100) +
    funds +
    (paid * 450) +
    (refs * 2500) +
    (orders * 40)
  );
}

function defaultProfile(user, userId = 0){
  const snap = userSnapshot(user, userId);
  const ts = nowSec();
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
      score: 0,
    },
    monthly: {
      period: month,
      ordersCreated: 0,
      claimsPaid: 0,
      starsSpent: 0,
      fundsGranted: 0,
      referrals: 0,
      score: 0,
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

  out.weekly.period = safeText(out.weekly.period || base.weekly.period);
  out.weekly.ordersCreated = clampNonNegative(out.weekly.ordersCreated);
  out.weekly.claimsPaid = clampNonNegative(out.weekly.claimsPaid);
  out.weekly.starsSpent = clampNonNegative(out.weekly.starsSpent);
  out.weekly.fundsGranted = clampNonNegative(out.weekly.fundsGranted);
  out.weekly.referrals = clampNonNegative(out.weekly.referrals);
  out.weekly.score = clampNonNegative(out.weekly.score);

  out.monthly.period = safeText(out.monthly.period || base.monthly.period);
  out.monthly.ordersCreated = clampNonNegative(out.monthly.ordersCreated);
  out.monthly.claimsPaid = clampNonNegative(out.monthly.claimsPaid);
  out.monthly.starsSpent = clampNonNegative(out.monthly.starsSpent);
  out.monthly.fundsGranted = clampNonNegative(out.monthly.fundsGranted);
  out.monthly.referrals = clampNonNegative(out.monthly.referrals);
  out.monthly.score = clampNonNegative(out.monthly.score);

  out.lifetimeScore = clampNonNegative(out.lifetimeScore);
  return out;
}

function ensurePeriodBuckets(profile){
  const week = weekKeyUTC();
  const month = monthKeyUTC();

  if(profile.weekly.period !== week){
    profile.weekly = {
      period: week,
      ordersCreated: 0,
      claimsPaid: 0,
      starsSpent: 0,
      fundsGranted: 0,
      referrals: 0,
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
  });
  profile.weekly.score = scoreFormula({
    starsSpent: profile.weekly.starsSpent,
    fundsGranted: profile.weekly.fundsGranted,
    claimsPaid: profile.weekly.claimsPaid,
    referrals: profile.weekly.referrals,
    ordersCreated: profile.weekly.ordersCreated,
  });
  profile.monthly.score = scoreFormula({
    starsSpent: profile.monthly.starsSpent,
    fundsGranted: profile.monthly.fundsGranted,
    claimsPaid: profile.monthly.claimsPaid,
    referrals: profile.monthly.referrals,
    ordersCreated: profile.monthly.ordersCreated,
  });
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
  return {
    userId: safeUserId(profile?.userId),
    username: safeUsername(profile?.username),
    displayName: safeText(profile?.displayName || "").slice(0, 80) || `Player ${safeUserId(profile?.userId)}`,
    score,
    starsSpent: clampNonNegative(profile?.starsSpentTotal),
    claimsPaid: clampNonNegative(profile?.claimsPaid),
    fundsGranted: clampNonNegative(profile?.fundsGrantedTotal),
    referrals: clampNonNegative(profile?.referralsStarted),
    updatedAt: toInt(profile?.updatedAt, nowSec()),
  };
}

function periodEntryFromProfile(profile, bucket = "weekly"){
  const node = (profile && profile[bucket] && typeof profile[bucket] === "object") ? profile[bucket] : {};
  return {
    userId: safeUserId(profile?.userId),
    username: safeUsername(profile?.username),
    displayName: safeText(profile?.displayName || "").slice(0, 80) || `Player ${safeUserId(profile?.userId)}`,
    score: clampNonNegative(node.score),
    starsSpent: clampNonNegative(node.starsSpent),
    claimsPaid: clampNonNegative(node.claimsPaid),
    fundsGranted: clampNonNegative(node.fundsGranted),
    referrals: clampNonNegative(node.referrals),
    updatedAt: toInt(profile?.updatedAt, nowSec()),
  };
}

function recruiterEntryFromProfile(profile){
  return {
    userId: safeUserId(profile?.userId),
    username: safeUsername(profile?.username),
    displayName: safeText(profile?.displayName || "").slice(0, 80) || `Player ${safeUserId(profile?.userId)}`,
    score: clampNonNegative(profile?.referralsStarted),
    referrals: clampNonNegative(profile?.referralsStarted),
    updatedAt: toInt(profile?.updatedAt, nowSec()),
  };
}

function sortedTrimmed(entries, limit = LEADERBOARD_STORE_LIMIT){
  const arr = Array.isArray(entries) ? entries.slice() : [];
  arr.sort((a, b)=>{
    const scoreDelta = clampNonNegative(b?.score) - clampNonNegative(a?.score);
    if(scoreDelta !== 0) return scoreDelta;
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
    monthly: { period: monthKeyUTC(), entries: [] },
    clans: { entries: [] },
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
  out.monthly.period = safeText(out.monthly.period || monthKeyUTC());
  out.global.entries = sortedTrimmed(out.global.entries, LEADERBOARD_STORE_LIMIT);
  out.weekly.entries = sortedTrimmed(out.weekly.entries, LEADERBOARD_STORE_LIMIT);
  out.monthly.entries = sortedTrimmed(out.monthly.entries, LEADERBOARD_STORE_LIMIT);
  out.clans.entries = sortedTrimmed(out.clans.entries, LEADERBOARD_STORE_LIMIT);
  return out;
}

async function updateLeaderboardsFromProfile(profile){
  const week = weekKeyUTC();
  const month = monthKeyUTC();
  const board = normalizeLeaderboardState(await getState(LEADERBOARD_STATE_KEY));
  if(board.weekly.period !== week){
    board.weekly = { period: week, entries: [] };
  }
  if(board.monthly.period !== month){
    board.monthly = { period: month, entries: [] };
  }

  board.global.entries = upsertLeaderboardEntry(board.global.entries, leaderboardEntryFromProfile(profile), LEADERBOARD_STORE_LIMIT);
  board.weekly.entries = upsertLeaderboardEntry(board.weekly.entries, periodEntryFromProfile(profile, "weekly"), LEADERBOARD_STORE_LIMIT);
  board.monthly.entries = upsertLeaderboardEntry(board.monthly.entries, periodEntryFromProfile(profile, "monthly"), LEADERBOARD_STORE_LIMIT);
  board.clans.entries = upsertLeaderboardEntry(board.clans.entries, recruiterEntryFromProfile(profile), LEADERBOARD_STORE_LIMIT);
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

async function getLeaderboardSnapshot(limit = 10){
  const max = Math.max(1, Math.min(25, toInt(limit, 10)));
  const board = normalizeLeaderboardState(await getState(LEADERBOARD_STATE_KEY));
  const week = weekKeyUTC();
  const month = monthKeyUTC();
  const weeklyEntries = (board.weekly.period === week) ? board.weekly.entries : [];
  const monthlyEntries = (board.monthly.period === month) ? board.monthly.entries : [];
  return {
    updatedAt: board.updatedAt,
    periods: {
      weekly: week,
      monthly: month,
    },
    global: board.global.entries.slice(0, max),
    weekly: weeklyEntries.slice(0, max),
    monthly: monthlyEntries.slice(0, max),
    clans: board.clans.entries.slice(0, max),
  };
}

module.exports = {
  getPlayerStats: async (user)=>stripPrivateFields(await getPlayerStats(user)),
  touchPlayer,
  recordInvoiceCreated,
  recordClaimPending,
  recordClaimError,
  recordClaimPaid,
  recordReferralStart,
  getLeaderboardSnapshot,
};

