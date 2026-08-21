const crypto = require("crypto");
const { getState, setState } = require("./metrics-store");

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MISSION_LIMIT_MS = 6 * 60 * 1000;
const BOSS_HP_MAX = 1200;
const WORLD = Object.freeze({ width:1000, height:600 });
const EXTRACTION = Object.freeze({ x:875, y:485, r:72 });
const CIVILIANS = Object.freeze([
  Object.freeze({ id:"civ_north", x:255, y:145, name:"Radio Operator" }),
  Object.freeze({ id:"civ_market", x:485, y:425, name:"Field Medic" }),
  Object.freeze({ id:"civ_bridge", x:735, y:155, name:"Bridge Scout" }),
  Object.freeze({ id:"civ_river", x:650, y:500, name:"Evac Driver" }),
]);
const ROLE_DEFS = Object.freeze({
  tracker:Object.freeze({ key:"tracker", label:"Tracker", damage:28, maxHp:105, speed:1.08 }),
  medic:Object.freeze({ key:"medic", label:"Medic", damage:23, maxHp:120, speed:1.00 }),
  assault:Object.freeze({ key:"assault", label:"Assault", damage:36, maxHp:110, speed:0.96 }),
  trapper:Object.freeze({ key:"trapper", label:"Trapper", damage:30, maxHp:112, speed:1.00 }),
});

function nowMs(){ return Date.now(); }
function clamp(value, min, max){ return Math.max(min, Math.min(max, Number(value || 0))); }
function cleanText(value, max=80){ return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max); }
function userIdOf(user){
  const id = Number(user?.id || user || 0);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}
function playerName(user){
  const username = cleanText(user?.username, 40).replace(/^@+/, "");
  const full = cleanText(`${user?.first_name || ""} ${user?.last_name || ""}`, 60);
  return username ? `@${username}` : (full || `Player ${userIdOf(user)}`);
}
function cleanCode(value){ return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6); }
function sessionKey(code){ return `live_squad_session_${cleanCode(code)}`; }
function playerKey(code, userId){ return `live_squad_player_${cleanCode(code)}_${userIdOf(userId)}`; }
function roleKey(value){ return ROLE_DEFS[String(value || "").toLowerCase()] ? String(value).toLowerCase() : "tracker"; }
function distance(a, b){ return Math.hypot(Number(a?.x || 0) - Number(b?.x || 0), Number(a?.y || 0) - Number(b?.y || 0)); }

function randomCode(){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for(let i=0; i<6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function normalizeSession(raw){
  if(!raw || typeof raw !== "object") return null;
  const code = cleanCode(raw.code);
  const hostId = userIdOf(raw.hostId);
  const memberIds = [...new Set((Array.isArray(raw.memberIds) ? raw.memberIds : []).map(userIdOf).filter(Boolean))].slice(0, 2);
  if(!code || !hostId || !memberIds.includes(hostId)) return null;
  return {
    version:1,
    code,
    hostId,
    memberIds,
    status:["waiting","active","complete","failed","closed"].includes(raw.status) ? raw.status : "waiting",
    createdAt:Math.max(0, Number(raw.createdAt || nowMs())),
    updatedAt:Math.max(0, Number(raw.updatedAt || nowMs())),
    startedAt:Math.max(0, Number(raw.startedAt || 0)),
    completedAt:Math.max(0, Number(raw.completedAt || 0)),
    title:"Operation Night Fang",
  };
}

function newPlayer(user, slot=0){
  const uid = userIdOf(user);
  const role = slot === 0 ? "tracker" : "medic";
  const def = ROLE_DEFS[role];
  return {
    version:1,
    userId:uid,
    name:playerName(user),
    slot:slot === 0 ? 0 : 1,
    role,
    x:slot === 0 ? 135 : 205,
    y:470,
    face:0,
    hp:def.maxHp,
    maxHp:def.maxHp,
    downed:false,
    bossDamage:0,
    rescuedIds:[],
    revives:0,
    joinedAt:nowMs(),
    lastSeenAt:nowMs(),
    lastMoveAt:nowMs(),
    lastAttackAt:0,
    lastHazardAt:0,
    rewardClaimed:false,
  };
}

function normalizePlayer(raw, fallbackUser=null, slot=0){
  const base = newPlayer(fallbackUser || raw?.userId, slot);
  const src = raw && typeof raw === "object" ? raw : {};
  const role = roleKey(src.role || base.role);
  const def = ROLE_DEFS[role];
  const maxHp = def.maxHp;
  const hp = clamp(src.hp ?? maxHp, 0, maxHp);
  return {
    ...base,
    ...src,
    userId:userIdOf(src.userId || fallbackUser),
    name:cleanText(src.name || playerName(fallbackUser), 60),
    slot:Number(src.slot) === 1 ? 1 : 0,
    role,
    x:clamp(src.x ?? base.x, 24, WORLD.width - 24),
    y:clamp(src.y ?? base.y, 24, WORLD.height - 24),
    face:clamp(src.face, -Math.PI * 4, Math.PI * 4),
    hp,
    maxHp,
    downed:!!src.downed || hp <= 0,
    bossDamage:clamp(src.bossDamage, 0, BOSS_HP_MAX),
    rescuedIds:[...new Set((Array.isArray(src.rescuedIds) ? src.rescuedIds : []).map((id)=>cleanText(id, 24)).filter((id)=>CIVILIANS.some((c)=>c.id === id)))],
    revives:clamp(src.revives, 0, 999),
    joinedAt:Math.max(0, Number(src.joinedAt || base.joinedAt)),
    lastSeenAt:Math.max(0, Number(src.lastSeenAt || base.lastSeenAt)),
    lastMoveAt:Math.max(0, Number(src.lastMoveAt || base.lastMoveAt)),
    lastAttackAt:Math.max(0, Number(src.lastAttackAt || 0)),
    lastHazardAt:Math.max(0, Number(src.lastHazardAt || 0)),
    rewardClaimed:!!src.rewardClaimed,
  };
}

function bossPosition(session, at=nowMs()){
  if(!session?.startedAt) return { x:650, y:250 };
  const elapsed = Math.max(0, at - session.startedAt) / 1000;
  const rush = Math.sin(elapsed * 0.43) * 92;
  return {
    x:clamp(620 + Math.cos(elapsed * 0.31) * 118 + rush * 0.22, 390, 830),
    y:clamp(270 + Math.sin(elapsed * 0.47) * 96, 105, 455),
  };
}

async function readSession(code){ return normalizeSession(await getState(sessionKey(code))); }
async function writeSession(session){
  const clean = normalizeSession({ ...session, updatedAt:nowMs() });
  await setState(sessionKey(clean.code), clean);
  return clean;
}
async function readPlayer(code, userId, fallbackUser=null, slot=0){
  const raw = await getState(playerKey(code, userId));
  return normalizePlayer(raw, fallbackUser || userId, slot);
}
async function writePlayer(code, player){
  const clean = normalizePlayer(player, player?.userId, player?.slot || 0);
  await setState(playerKey(code, clean.userId), clean);
  return clean;
}

function ensureLiveSession(session){
  if(!session) throw new Error("Squad room not found.");
  if(nowMs() - session.updatedAt > SESSION_TTL_MS) throw new Error("This squad room expired. Create a new one.");
  if(session.status === "closed") throw new Error("This squad room is closed.");
}

async function createSession(user){
  const uid = userIdOf(user);
  if(!uid) throw new Error("Telegram player identity is missing.");
  let code = "";
  for(let i=0; i<8; i++){
    const candidate = randomCode();
    if(!(await readSession(candidate))){ code = candidate; break; }
  }
  if(!code) throw new Error("Could not create a squad code. Try again.");
  let session = await writeSession({
    code,
    hostId:uid,
    memberIds:[uid],
    status:"waiting",
    createdAt:nowMs(),
    updatedAt:nowMs(),
    startedAt:0,
    completedAt:0,
  });
  await writePlayer(code, newPlayer(user, 0));
  return session;
}

async function joinSession(codeValue, user){
  const code = cleanCode(codeValue);
  const uid = userIdOf(user);
  const session = await readSession(code);
  ensureLiveSession(session);
  if(session.status !== "waiting" && !session.memberIds.includes(uid)) throw new Error("This mission already started.");
  if(!session.memberIds.includes(uid)){
    if(session.memberIds.length >= 2) throw new Error("This squad already has two players.");
    session.memberIds.push(uid);
    await writeSession(session);
    await writePlayer(code, newPlayer(user, 1));
  }else{
    const slot = session.memberIds.indexOf(uid);
    const player = await readPlayer(code, uid, user, slot);
    player.name = playerName(user);
    player.lastSeenAt = nowMs();
    await writePlayer(code, player);
  }
  return readSession(code);
}

async function memberPlayers(session){
  return Promise.all(session.memberIds.map((uid, slot)=>readPlayer(session.code, uid, uid, slot)));
}

function sessionDerived(session, players, at=nowMs()){
  const rescuedIds = [...new Set(players.flatMap((p)=>p.rescuedIds || []))];
  const bossDamage = players.reduce((sum, p)=>sum + clamp(p.bossDamage, 0, BOSS_HP_MAX), 0);
  const bossHp = clamp(BOSS_HP_MAX - bossDamage, 0, BOSS_HP_MAX);
  const onlineIds = players.filter((p)=>at - p.lastSeenAt <= 15000).map((p)=>p.userId);
  const extractionReadyIds = players
    .filter((p)=>!p.downed && distance(p, EXTRACTION) <= EXTRACTION.r)
    .map((p)=>p.userId);
  const objectivesReady = rescuedIds.length >= CIVILIANS.length && bossHp <= 0;
  return { rescuedIds, bossDamage, bossHp, onlineIds, extractionReadyIds, objectivesReady };
}

async function maybeFinishSession(session, players){
  if(session.status !== "active") return session;
  const now = nowMs();
  if(now - session.startedAt > MISSION_LIMIT_MS){
    session.status = "failed";
    session.completedAt = now;
    return writeSession(session);
  }
  const derived = sessionDerived(session, players, now);
  if(
    derived.objectivesReady &&
    derived.onlineIds.length === session.memberIds.length &&
    derived.extractionReadyIds.length === session.memberIds.length
  ){
    session.status = "complete";
    session.completedAt = now;
    return writeSession(session);
  }
  return session;
}

async function buildSnapshot(session, viewerId){
  const players = await memberPlayers(session);
  session = await maybeFinishSession(session, players);
  const at = nowMs();
  const derived = sessionDerived(session, players, at);
  return {
    code:session.code,
    title:session.title,
    hostId:session.hostId,
    viewerId:userIdOf(viewerId),
    isHost:session.hostId === userIdOf(viewerId),
    status:session.status,
    memberCount:session.memberIds.length,
    capacity:2,
    createdAt:session.createdAt,
    startedAt:session.startedAt,
    completedAt:session.completedAt,
    serverNow:at,
    expiresAt:session.updatedAt + SESSION_TTL_MS,
    timeLeftMs:session.status === "active" ? Math.max(0, MISSION_LIMIT_MS - (at - session.startedAt)) : MISSION_LIMIT_MS,
    world:WORLD,
    extraction:EXTRACTION,
    civilians:CIVILIANS,
    boss:{ ...bossPosition(session, at), hp:derived.bossHp, hpMax:BOSS_HP_MAX, defeated:derived.bossHp <= 0, name:"Night Fang Alpha" },
    rescuedIds:derived.rescuedIds,
    objectivesReady:derived.objectivesReady,
    extractionReadyIds:derived.extractionReadyIds,
    players:players.map((p)=>({ ...p, online:at - p.lastSeenAt <= 15000 })),
  };
}

async function updateOwnPresence(session, user, patch={}){
  const uid = userIdOf(user);
  const slot = session.memberIds.indexOf(uid);
  if(slot < 0) throw new Error("You are not a member of this squad.");
  let player = await readPlayer(session.code, uid, user, slot);
  const now = nowMs();
  player.name = playerName(user);
  if(session.status === "waiting" && patch.role) player.role = roleKey(patch.role);
  const def = ROLE_DEFS[player.role];
  player.maxHp = def.maxHp;
  player.hp = clamp(player.hp ?? def.maxHp, 0, def.maxHp);
  if(!player.downed && session.status === "active" && patch && Number.isFinite(Number(patch.x)) && Number.isFinite(Number(patch.y))){
    const proposed = { x:clamp(patch.x, 24, WORLD.width - 24), y:clamp(patch.y, 24, WORLD.height - 24) };
    const elapsed = clamp(now - player.lastMoveAt, 100, 1800);
    const maxMove = 70 + elapsed * 0.34 * def.speed;
    const moveDist = distance(player, proposed);
    if(moveDist <= maxMove){
      player.x = proposed.x;
      player.y = proposed.y;
      if(Number.isFinite(Number(patch.face))) player.face = clamp(patch.face, -Math.PI * 4, Math.PI * 4);
    }
    player.lastMoveAt = now;
  }
  if(session.status === "active" && !player.downed){
    const boss = bossPosition(session, now);
    if(distance(player, boss) <= 118 && now - player.lastHazardAt >= 1250){
      const armor = player.role === "assault" ? 3 : (player.role === "medic" ? 1 : 0);
      player.hp = clamp(player.hp - Math.max(7, 12 - armor), 0, player.maxHp);
      player.lastHazardAt = now;
      if(player.hp <= 0) player.downed = true;
    }
  }
  player.lastSeenAt = now;
  return writePlayer(session.code, player);
}

async function applyAction(session, user, action, payload={}){
  const uid = userIdOf(user);
  const slot = session.memberIds.indexOf(uid);
  if(slot < 0) throw new Error("You are not a member of this squad.");
  let player = await readPlayer(session.code, uid, user, slot);
  const now = nowMs();
  if(action === "start"){
    if(session.hostId !== uid) throw new Error("Only the squad leader can start the mission.");
    if(session.memberIds.length < 2) throw new Error("Invite one teammate before starting.");
    if(session.status !== "waiting") return session;
    session.status = "active";
    session.startedAt = now;
    await writeSession(session);
    const players = await memberPlayers(session);
    for(const p of players){
      const def = ROLE_DEFS[p.role];
      p.hp = def.maxHp;
      p.maxHp = def.maxHp;
      p.downed = false;
      p.bossDamage = 0;
      p.rescuedIds = [];
      p.rewardClaimed = false;
      p.lastSeenAt = now;
      await writePlayer(session.code, p);
    }
    return session;
  }
  if(session.status !== "active") throw new Error("The co-op mission is not active.");
  if(player.downed) throw new Error("Your teammate must revive you first.");
  if(action === "attack"){
    const boss = bossPosition(session, now);
    if(distance(player, boss) > 175) throw new Error("Move closer to Night Fang.");
    if(now - player.lastAttackAt < 560) throw new Error("Weapon is cooling down.");
    const def = ROLE_DEFS[player.role];
    const combo = clamp(payload.combo || 0, 0, 3);
    player.bossDamage = clamp(player.bossDamage + def.damage + combo * 2, 0, BOSS_HP_MAX);
    player.lastAttackAt = now;
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "rescue"){
    const id = cleanText(payload.civilianId, 24);
    const civilian = CIVILIANS.find((c)=>c.id === id);
    if(!civilian) throw new Error("Civilian not found.");
    if(distance(player, civilian) > 78) throw new Error("Move closer to the civilian.");
    if(!player.rescuedIds.includes(id)) player.rescuedIds.push(id);
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "revive"){
    const targetId = userIdOf(payload.targetUserId);
    if(!targetId || targetId === uid || !session.memberIds.includes(targetId)) throw new Error("Teammate not found.");
    const targetSlot = session.memberIds.indexOf(targetId);
    const target = await readPlayer(session.code, targetId, targetId, targetSlot);
    if(!target.downed) throw new Error("Your teammate is already standing.");
    if(distance(player, target) > 105) throw new Error("Move closer to your teammate.");
    target.downed = false;
    target.hp = Math.max(45, Math.round(target.maxHp * 0.5));
    target.lastHazardAt = now;
    player.revives = clamp(player.revives + 1, 0, 999);
    player.lastSeenAt = now;
    await writePlayer(session.code, target);
    await writePlayer(session.code, player);
  }
  return session;
}

async function claimReward(session, user){
  const uid = userIdOf(user);
  const slot = session.memberIds.indexOf(uid);
  if(slot < 0) throw new Error("You are not a member of this squad.");
  if(session.status !== "complete") throw new Error("Complete the mission before claiming rewards.");
  const player = await readPlayer(session.code, uid, user, slot);
  const firstClaim = !player.rewardClaimed;
  player.rewardClaimed = true;
  await writePlayer(session.code, player);
  return {
    firstClaim,
    receipt:`night-fang:${session.code}:${uid}`,
    reward:{ cash:6500, perkPoints:1, seasonPoints:12, badge:"Night Fang First Response" },
  };
}

async function closeSession(session, user){
  const uid = userIdOf(user);
  if(session.hostId === uid){
    session.status = "closed";
  }else{
    session.memberIds = session.memberIds.filter((id)=>id !== uid);
  }
  return writeSession(session);
}

module.exports = {
  ROLE_DEFS,
  cleanCode,
  createSession,
  joinSession,
  readSession,
  buildSnapshot,
  updateOwnPresence,
  applyAction,
  claimReward,
  closeSession,
  ensureLiveSession,
  userIdOf,
};
