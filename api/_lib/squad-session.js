const crypto = require("crypto");
const { getState, setState } = require("./metrics-store");

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MISSION_LIMIT_MS = 6 * 60 * 1000;
const RESPAWN_DELAY_MS = 3000;
const STARTING_LIVES = 1;
const BOSS_HP_MAX = 1200;
const WORLD = Object.freeze({ width:1200, height:1100 });
const EXTRACTION = Object.freeze({ x:1045, y:735, r:92 });
const SPAWNS = Object.freeze([
  Object.freeze({ x:125, y:850 }),
  Object.freeze({ x:215, y:850 }),
]);
const CIVILIANS = Object.freeze([
  Object.freeze({ id:"civ_north", x:245, y:205, name:"Radio Operator", look:"field" }),
  Object.freeze({ id:"civ_market", x:445, y:735, name:"Field Medic", look:"medic" }),
  Object.freeze({ id:"civ_bridge", x:930, y:225, name:"Bridge Scout", look:"scout" }),
  Object.freeze({ id:"civ_river", x:790, y:935, name:"Evac Driver", look:"driver" }),
]);
const TIGER_DEFS = Object.freeze([
  Object.freeze({ id:"tiger_scout", name:"Scout Tiger", type:"Scout", hpMax:210, baseX:325, baseY:495, rangeX:72, rangeY:58, speed:.72, phase:.4 }),
  Object.freeze({ id:"tiger_ambush", name:"Ambush Tiger", type:"Standard", hpMax:260, baseX:760, baseY:245, rangeX:88, rangeY:64, speed:.54, phase:2.1 }),
  Object.freeze({ id:"tiger_guard", name:"Guard Tiger", type:"Armored", hpMax:330, baseX:900, baseY:735, rangeX:78, rangeY:72, speed:.47, phase:4.2 }),
  Object.freeze({ id:"night_fang_alpha", name:"Night Fang Alpha", type:"Alpha", hpMax:BOSS_HP_MAX, baseX:650, baseY:570, rangeX:140, rangeY:112, speed:.36, phase:1.25, boss:true }),
]);
const SHARED_STORY_MISSION_1 = Object.freeze({
  level:1,
  chapter:1,
  chapterName:"Forest Edge",
  title:"Story Mission 1",
  objective:"Escort 2 villagers from the jungle edge.",
  rescueRequired:2,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:Object.freeze(CIVILIANS.slice(0, 3)),
  tigers:Object.freeze([
    Object.freeze({ ...TIGER_DEFS[0], name:"Jungle Tiger", type:"Standard", hpMax:124, baseX:760, baseY:330, rangeX:86, rangeY:62 }),
    Object.freeze({ ...TIGER_DEFS[1], name:"Forest Scout", type:"Scout", hpMax:112, baseX:390, baseY:560, rangeX:74, rangeY:54 }),
  ]),
});
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
function missionDefinition(session){
  if(session?.launchType === "shared-story" && Number(session.storyMissionLevel || 0) === 1) return SHARED_STORY_MISSION_1;
  return {
    level:0,
    chapter:0,
    chapterName:"Night Fang District",
    title:"Operation Night Fang",
    objective:"Rescue four civilians, defeat the tiger pack and Night Fang Alpha, then extract together.",
    rescueRequired:CIVILIANS.length,
    world:WORLD,
    extraction:EXTRACTION,
    spawns:SPAWNS,
    civilians:CIVILIANS,
    tigers:TIGER_DEFS,
  };
}

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
    failureReason:cleanText(raw.failureReason, 32),
    storyMissionLevel:clamp(Math.floor(Number(raw.storyMissionLevel || 0)), 0, 100),
    launchType:raw.launchType === "shared-story" ? "shared-story" : "live-squad",
    title:raw.launchType === "shared-story" ? `Shared Story Mission ${clamp(Math.floor(Number(raw.storyMissionLevel || 1)), 1, 100)}` : "Operation Night Fang",
  };
}

function newPlayer(user, slot=0){
  const uid = userIdOf(user);
  const role = slot === 0 ? "tracker" : "medic";
  const def = ROLE_DEFS[role];
  const spawn = SPAWNS[slot === 0 ? 0 : 1];
  return {
    version:1,
    userId:uid,
    name:playerName(user),
    slot:slot === 0 ? 0 : 1,
    role,
    x:spawn.x,
    y:spawn.y,
    face:0,
    hp:def.maxHp,
    maxHp:def.maxHp,
    downed:false,
    livesRemaining:STARTING_LIVES,
    knockdowns:0,
    respawnAt:0,
    bossDamage:0,
    tigerDamage:{},
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
  const tigerDamage = {};
  for(const tiger of TIGER_DEFS){
    const damage = clamp(src?.tigerDamage?.[tiger.id], 0, tiger.hpMax);
    if(damage > 0) tigerDamage[tiger.id] = damage;
  }
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
    livesRemaining:clamp(src.livesRemaining ?? STARTING_LIVES, 0, STARTING_LIVES),
    knockdowns:clamp(src.knockdowns, 0, 999),
    respawnAt:Math.max(0, Number(src.respawnAt || 0)),
    bossDamage:clamp(src.bossDamage, 0, BOSS_HP_MAX),
    tigerDamage,
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

function tigerPosition(session, tiger, at=nowMs()){
  const world = missionDefinition(session).world;
  if(!session?.startedAt) return { x:tiger.baseX, y:tiger.baseY };
  const elapsed = Math.max(0, at - session.startedAt) / 1000;
  return {
    x:clamp(tiger.baseX + Math.cos(elapsed * tiger.speed + tiger.phase) * tiger.rangeX, 70, world.width - 70),
    y:clamp(tiger.baseY + Math.sin(elapsed * tiger.speed * .83 + tiger.phase) * tiger.rangeY, 90, world.height - 80),
  };
}

function tigerSnapshots(session, players, at=nowMs()){
  return missionDefinition(session).tigers.map((def)=>{
    let damage = players.reduce((sum, player)=>sum + clamp(player?.tigerDamage?.[def.id], 0, def.hpMax), 0);
    if(session?.launchType !== "shared-story" && def.boss && damage <= 0){
      // Keep rooms created by the first V5 release playable after this update.
      damage = players.reduce((sum, player)=>sum + clamp(player?.bossDamage, 0, BOSS_HP_MAX), 0);
    }
    const hp = clamp(def.hpMax - damage, 0, def.hpMax);
    return { ...def, ...tigerPosition(session, def, at), hp, defeated:hp <= 0 };
  });
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

async function createSession(user, opts={}){
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
    storyMissionLevel:clamp(Math.floor(Number(opts?.storyMissionLevel || 0)), 0, 100),
    launchType:opts?.launchType === "shared-story" ? "shared-story" : "live-squad",
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
  const mission = missionDefinition(session);
  const rescuedIds = [...new Set(players.flatMap((p)=>p.rescuedIds || []))];
  const tigers = tigerSnapshots(session, players, at);
  const boss = tigers.find((t)=>t.boss) || tigers[tigers.length - 1];
  const bossHpMax = Math.max(1, Number(boss?.hpMax || BOSS_HP_MAX));
  const bossDamage = clamp(bossHpMax - Number(boss?.hp || 0), 0, bossHpMax);
  const bossHp = Number(boss?.hp || 0);
  const onlineIds = players.filter((p)=>at - p.lastSeenAt <= 15000).map((p)=>p.userId);
  const extractionReadyIds = players
    .filter((p)=>!p.downed && distance(p, mission.extraction) <= mission.extraction.r)
    .map((p)=>p.userId);
  const allTigersCleared = tigers.every((t)=>t.defeated);
  const legacyBossOnlyRoom = session.launchType !== "shared-story" && players.every((p)=>Object.keys(p?.tigerDamage || {}).length === 0) && players.some((p)=>Number(p?.bossDamage || 0) > 0);
  const objectivesReady = rescuedIds.length >= mission.rescueRequired && (allTigersCleared || legacyBossOnlyRoom);
  const squadWiped = players.length === session.memberIds.length && players.every((p)=>p.downed && Number(p.respawnAt || 0) <= 0 && Number(p.livesRemaining || 0) <= 0);
  return { rescuedIds, bossDamage, bossHp, boss, tigers, onlineIds, extractionReadyIds, objectivesReady, squadWiped };
}

async function maybeFinishSession(session, players){
  if(session.status !== "active") return session;
  const now = nowMs();
  if(now - session.startedAt > MISSION_LIMIT_MS){
    session.status = "failed";
    session.failureReason = "timeout";
    session.completedAt = now;
    return writeSession(session);
  }
  const derived = sessionDerived(session, players, now);
  if(derived.squadWiped){
    session.status = "failed";
    session.failureReason = "squad_wipe";
    session.completedAt = now;
    return writeSession(session);
  }
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
  const mission = missionDefinition(session);
  const derived = sessionDerived(session, players, at);
  return {
    code:session.code,
    title:session.title,
    storyMissionLevel:session.storyMissionLevel,
    launchType:session.launchType,
    hostId:session.hostId,
    viewerId:userIdOf(viewerId),
    isHost:session.hostId === userIdOf(viewerId),
    status:session.status,
    memberCount:session.memberIds.length,
    capacity:2,
    createdAt:session.createdAt,
    startedAt:session.startedAt,
    completedAt:session.completedAt,
    failureReason:session.failureReason,
    serverNow:at,
    expiresAt:session.updatedAt + SESSION_TTL_MS,
    timeLeftMs:session.status === "active" ? Math.max(0, MISSION_LIMIT_MS - (at - session.startedAt)) : MISSION_LIMIT_MS,
    mission:{
      level:mission.level,
      chapter:mission.chapter,
      chapterName:mission.chapterName,
      title:mission.title,
      objective:mission.objective,
      rescueRequired:mission.rescueRequired,
      civilianCount:mission.civilians.length,
      tigerCount:mission.tigers.length,
    },
    world:mission.world,
    extraction:mission.extraction,
    civilians:mission.civilians,
    tigers:derived.tigers,
    boss:derived.boss,
    rescuedIds:derived.rescuedIds,
    objectivesReady:derived.objectivesReady,
    squadWiped:derived.squadWiped,
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
  const mission = missionDefinition(session);
  const spawn = mission.spawns[slot === 0 ? 0 : 1];
  player.name = playerName(user);
  if(session.status === "waiting" && patch.role) player.role = roleKey(patch.role);
  const def = ROLE_DEFS[player.role];
  player.maxHp = def.maxHp;
  player.hp = clamp(player.hp ?? def.maxHp, 0, def.maxHp);
  // Recover legacy rooms that were already stuck with a downed player before
  // personal lives were introduced.
  if(session.status === "active" && player.downed && !player.respawnAt && player.livesRemaining > 0){
    player.livesRemaining = clamp(player.livesRemaining - 1, 0, STARTING_LIVES);
    player.respawnAt = now + RESPAWN_DELAY_MS;
  }
  if(session.status === "active" && player.downed && player.respawnAt > 0 && now >= player.respawnAt){
    player.hp = def.maxHp;
    player.downed = false;
    player.respawnAt = 0;
    player.x = spawn.x;
    player.y = spawn.y;
    player.face = 0;
    player.lastHazardAt = now;
    player.lastMoveAt = now;
  }
  if(!player.downed && session.status === "active" && patch && Number.isFinite(Number(patch.x)) && Number.isFinite(Number(patch.y))){
    const proposed = { x:clamp(patch.x, 24, mission.world.width - 24), y:clamp(patch.y, 24, mission.world.height - 24) };
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
    const players = await memberPlayers(session);
    const threat = tigerSnapshots(session, players, now)
      .filter((t)=>!t.defeated)
      .sort((a,b)=>distance(player,a)-distance(player,b))[0];
    if(threat && distance(player, threat) <= (threat.boss ? 122 : 102) && now - player.lastHazardAt >= 1250){
      const armor = player.role === "assault" ? 3 : (player.role === "medic" ? 1 : 0);
      const baseDamage = threat.boss ? 13 : (threat.type === "Armored" ? 11 : 9);
      player.hp = clamp(player.hp - Math.max(6, baseDamage - armor), 0, player.maxHp);
      player.lastHazardAt = now;
      if(player.hp <= 0){
        player.downed = true;
        player.knockdowns = clamp(player.knockdowns + 1, 0, 999);
        if(player.livesRemaining > 0){
          player.livesRemaining = clamp(player.livesRemaining - 1, 0, STARTING_LIVES);
          player.respawnAt = now + RESPAWN_DELAY_MS;
        }else{
          player.respawnAt = 0;
        }
      }
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
  if(action === "start" || action === "restart"){
    if(session.hostId !== uid) throw new Error("Only the squad leader can start the mission.");
    if(session.memberIds.length < 2) throw new Error("Invite one teammate before starting.");
    if(action === "start" && session.status !== "waiting") return session;
    if(action === "restart" && session.status !== "failed") throw new Error("Restart is available after the mission ends.");
    session.status = "active";
    session.startedAt = now;
    session.completedAt = 0;
    session.failureReason = "";
    await writeSession(session);
    const mission = missionDefinition(session);
    const players = await memberPlayers(session);
    for(const p of players){
      const def = ROLE_DEFS[p.role];
      const spawn = mission.spawns[p.slot === 0 ? 0 : 1];
      p.hp = def.maxHp;
      p.maxHp = def.maxHp;
      p.downed = false;
      p.livesRemaining = STARTING_LIVES;
      p.knockdowns = 0;
      p.respawnAt = 0;
      p.x = spawn.x;
      p.y = spawn.y;
      p.face = 0;
      p.bossDamage = 0;
      p.tigerDamage = {};
      p.rescuedIds = [];
      p.rewardClaimed = false;
      p.lastSeenAt = now;
      await writePlayer(session.code, p);
    }
    return session;
  }
  if(session.status !== "active") throw new Error("The co-op mission is not active.");
  if(player.downed){
    if(player.respawnAt > now) throw new Error("Your field life is bringing you back at Base Camp.");
    throw new Error("You are out of lives. Your teammate must revive you or the leader can restart after a squad wipe.");
  }
  if(action === "attack"){
    const players = await memberPlayers(session);
    const tigers = tigerSnapshots(session, players, now).filter((t)=>!t.defeated);
    const requestedId = cleanText(payload.tigerId, 32);
    const target = tigers.find((t)=>t.id === requestedId) || tigers.sort((a,b)=>distance(player,a)-distance(player,b))[0];
    if(!target) throw new Error("The tiger threat is already cleared.");
    if(distance(player, target) > (target.boss ? 178 : 164)) throw new Error(`Move closer to ${target.name}.`);
    if(now - player.lastAttackAt < 560) throw new Error("Weapon is cooling down.");
    const def = ROLE_DEFS[player.role];
    const combo = clamp(payload.combo || 0, 0, 3);
    const hit = def.damage + combo * 2;
    if(!player.tigerDamage || typeof player.tigerDamage !== "object") player.tigerDamage = {};
    player.tigerDamage[target.id] = clamp(Number(player.tigerDamage[target.id] || 0) + hit, 0, target.hpMax);
    if(target.boss) player.bossDamage = clamp(player.bossDamage + hit, 0, BOSS_HP_MAX);
    player.lastAttackAt = now;
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "rescue"){
    const id = cleanText(payload.civilianId, 24);
    const civilian = missionDefinition(session).civilians.find((c)=>c.id === id);
    if(!civilian) throw new Error("Civilian not found.");
    if(distance(player, civilian) > 82) throw new Error("Move closer to the civilian.");
    if(!player.rescuedIds.includes(id)) player.rescuedIds.push(id);
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "revive"){
    const targetId = userIdOf(payload.targetUserId);
    if(!targetId || targetId === uid || !session.memberIds.includes(targetId)) throw new Error("Teammate not found.");
    const targetSlot = session.memberIds.indexOf(targetId);
    const target = await readPlayer(session.code, targetId, targetId, targetSlot);
    if(!target.downed) throw new Error("Your teammate is already standing.");
    if(distance(player, target) > 108) throw new Error("Move closer to your teammate.");
    target.downed = false;
    target.hp = Math.max(45, Math.round(target.maxHp * 0.5));
    target.respawnAt = 0;
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
  const sharedStory = session.launchType === "shared-story" && Number(session.storyMissionLevel || 0) === 1;
  return {
    firstClaim,
    receipt:`${sharedStory ? "shared-story-1" : "night-fang"}:${session.code}:${uid}`,
    storyProgress:sharedStory ? { completedLevel:1, unlockLevel:2 } : null,
    reward:sharedStory
      ? { cash:1800, perkPoints:1, seasonPoints:6, badge:"Shared Story First Patrol" }
      : { cash:6500, perkPoints:1, seasonPoints:12, badge:"Night Fang First Response" },
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
  TIGER_DEFS,
  SHARED_STORY_MISSION_1,
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
