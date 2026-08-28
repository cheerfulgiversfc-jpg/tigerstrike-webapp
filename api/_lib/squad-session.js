const crypto = require("crypto");
const { getState, setState } = require("./metrics-store");

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MISSION_LIMIT_MS = 6 * 60 * 1000;
const RESPAWN_DELAY_MS = 3000;
const STARTING_LIVES = 1;
const BOSS_HP_MAX = 1200;
const WORLD = Object.freeze({ width:1200, height:1100 });
const MAX_COOP_WORLD = Object.freeze({ width:4800, height:2800 });
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
const SHARED_STORY_MISSIONS = Object.freeze({
  1:SHARED_STORY_MISSION_1,
  2:Object.freeze({
    level:2, chapter:1, chapterName:"Forest Edge", title:"Story Mission 2",
    objective:"Tigers attack a farm road. Escort 3 civilians to safety.", rescueRequired:3,
    world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze(CIVILIANS.slice(0, 3)),
    tigers:Object.freeze([
      Object.freeze({ ...TIGER_DEFS[0], name:"Farm Road Scout", type:"Scout", hpMax:132, baseX:350, baseY:500 }),
      Object.freeze({ ...TIGER_DEFS[1], name:"Farm Road Tiger", type:"Standard", hpMax:148, baseX:770, baseY:330 }),
      Object.freeze({ ...TIGER_DEFS[2], name:"Road Guard", type:"Armored", hpMax:176, baseX:900, baseY:720 }),
    ]),
  }),
  3:Object.freeze({
    level:3, chapter:1, chapterName:"Forest Edge", title:"Story Mission 3",
    objective:"First tiger encounter. Kill or capture 1 tiger, then extract.", rescueRequired:0,
    world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ ...TIGER_DEFS[0], name:"First Encounter Tiger", type:"Standard", hpMax:190, baseX:650, baseY:540, rangeX:105, rangeY:80 }),
    ]),
  }),
  4:Object.freeze({
    level:4, chapter:1, chapterName:"Forest Edge", title:"Story Mission 4",
    objective:"Rescue 3 villagers trapped near the jungle huts.", rescueRequired:3,
    world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze(CIVILIANS.slice(0, 3)),
    tigers:Object.freeze([
      Object.freeze({ ...TIGER_DEFS[0], name:"Hut Stalker", type:"Scout", hpMax:148, baseX:300, baseY:320 }),
      Object.freeze({ ...TIGER_DEFS[1], name:"Village Tiger", type:"Standard", hpMax:168, baseX:820, baseY:520 }),
    ]),
  }),
  5:Object.freeze({
    level:5, chapter:1, chapterName:"Forest Edge", title:"Story Mission 5",
    objective:"Escort 4 civilians through the jungle trail.", rescueRequired:4,
    world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:CIVILIANS,
    tigers:Object.freeze([
      Object.freeze({ ...TIGER_DEFS[0], name:"Trail Scout", type:"Scout", hpMax:154, baseX:325, baseY:495 }),
      Object.freeze({ ...TIGER_DEFS[1], name:"Trail Tiger", type:"Standard", hpMax:176, baseX:760, baseY:245 }),
      Object.freeze({ ...TIGER_DEFS[2], name:"Trail Guard", type:"Armored", hpMax:205, baseX:900, baseY:735 }),
    ]),
  }),
});
const ROLE_DEFS = Object.freeze({
  tracker:Object.freeze({ key:"tracker", label:"Tracker", damage:28, maxHp:105, speed:1.08 }),
  medic:Object.freeze({ key:"medic", label:"Medic", damage:23, maxHp:120, speed:1.00 }),
  assault:Object.freeze({ key:"assault", label:"Assault", damage:36, maxHp:110, speed:0.96 }),
  trapper:Object.freeze({ key:"trapper", label:"Trapper", damage:30, maxHp:112, speed:1.00 }),
});

const SHARED_STORY_WORLD_SIZES = Object.freeze({
  1:Object.freeze({ width:3840, height:2160 }),
  2:Object.freeze({ width:3984, height:2240 }),
  3:Object.freeze({ width:4128, height:2320 }),
  4:Object.freeze({ width:4272, height:2400 }),
  5:Object.freeze({ width:4416, height:2480 }),
});
const NIGHT_FANG_WORLD_SIZE = Object.freeze({ width:4200, height:2360 });
const TIGER_DEN_WORLD_SIZE = Object.freeze({ width:4560, height:2560 });
const VILLAGE_SIEGE_WORLD_SIZE = Object.freeze({ width:4680, height:2640 });
const CONVOY_RESCUE_WORLD_SIZE = Object.freeze({ width:4800, height:2720 });
const ALPHA_HUNT_WORLD_SIZE = Object.freeze({ width:4800, height:2800 });
const STORM_EXTRACTION_WORLD_SIZE = Object.freeze({ width:4800, height:2800 });
const TIGER_DEN_CIVILIANS = Object.freeze([
  Object.freeze({ id:"den_ranger", x:285, y:255, name:"Trapped Ranger", look:"scout" }),
  Object.freeze({ id:"den_researcher", x:905, y:285, name:"Den Researcher", look:"medic" }),
]);
const TIGER_DEN_TIGERS = Object.freeze([
  Object.freeze({ id:"den_sentry", name:"Den Sentry", type:"Scout", hpMax:300, baseX:360, baseY:515, rangeX:88, rangeY:70, speed:.76, phase:.7 }),
  Object.freeze({ id:"den_guard", name:"Cavern Guard", type:"Armored", hpMax:390, baseX:720, baseY:300, rangeX:94, rangeY:76, speed:.52, phase:2.4 }),
  Object.freeze({ id:"den_stalker", name:"Tunnel Stalker", type:"Standard", hpMax:345, baseX:920, baseY:720, rangeX:105, rangeY:82, speed:.64, phase:4.5 }),
  Object.freeze({ id:"stoneclaw_alpha", name:"Stoneclaw Alpha", type:"Alpha", hpMax:1600, baseX:705, baseY:565, rangeX:155, rangeY:125, speed:.40, phase:1.4, boss:true }),
]);
const VILLAGE_SIEGE_CIVILIANS = Object.freeze([
  Object.freeze({ id:"siege_elder", x:190, y:240, name:"Village Elder", look:"field" }),
  Object.freeze({ id:"siege_teacher", x:520, y:210, name:"School Teacher", look:"scout" }),
  Object.freeze({ id:"siege_vendor", x:970, y:270, name:"Market Vendor", look:"driver" }),
  Object.freeze({ id:"siege_nurse", x:330, y:760, name:"Clinic Nurse", look:"medic" }),
  Object.freeze({ id:"siege_gatekeeper", x:890, y:780, name:"Gate Keeper", look:"field" }),
]);
const VILLAGE_SIEGE_TIGERS = Object.freeze([
  Object.freeze({ id:"siege_scout", name:"North Gate Prowler", type:"Scout", hpMax:340, baseX:310, baseY:430, rangeX:96, rangeY:74, speed:.78, phase:.6 }),
  Object.freeze({ id:"siege_market", name:"Market Mauler", type:"Standard", hpMax:370, baseX:570, baseY:320, rangeX:112, rangeY:86, speed:.64, phase:2.2 }),
  Object.freeze({ id:"siege_alley", name:"Alley Stalker", type:"Standard", hpMax:385, baseX:855, baseY:470, rangeX:106, rangeY:82, speed:.68, phase:3.8 }),
  Object.freeze({ id:"siege_gatebreaker", name:"Gatebreaker Guard", type:"Armored", hpMax:460, baseX:920, baseY:720, rangeX:92, rangeY:78, speed:.50, phase:4.9 }),
  Object.freeze({ id:"ironmane_alpha", name:"Ironmane Alpha", type:"Alpha", hpMax:1800, baseX:625, baseY:580, rangeX:165, rangeY:132, speed:.42, phase:1.1, boss:true }),
]);
const CONVOY_RESCUE_CIVILIANS = Object.freeze([
  Object.freeze({ id:"convoy_driver", x:225, y:250, name:"Convoy Driver", look:"driver" }),
  Object.freeze({ id:"convoy_medic", x:470, y:470, name:"Convoy Medic", look:"medic" }),
  Object.freeze({ id:"convoy_mechanic", x:750, y:250, name:"Convoy Mechanic", look:"field" }),
  Object.freeze({ id:"convoy_dispatcher", x:960, y:700, name:"Route Dispatcher", look:"scout" }),
]);
const CONVOY_RESCUE_TIGERS = Object.freeze([
  Object.freeze({ id:"convoy_scout", name:"Roadside Scout", type:"Scout", hpMax:380, baseX:300, baseY:370, rangeX:102, rangeY:78, speed:.80, phase:.5 }),
  Object.freeze({ id:"convoy_wreck", name:"Wreck Prowler", type:"Standard", hpMax:420, baseX:510, baseY:520, rangeX:118, rangeY:90, speed:.66, phase:2.0 }),
  Object.freeze({ id:"convoy_bridge", name:"Bridge Ambusher", type:"Standard", hpMax:435, baseX:760, baseY:350, rangeX:112, rangeY:86, speed:.70, phase:3.7 }),
  Object.freeze({ id:"convoy_cargo", name:"Cargo Breaker", type:"Armored", hpMax:520, baseX:930, baseY:690, rangeX:98, rangeY:82, speed:.52, phase:5.0 }),
  Object.freeze({ id:"roadclaw_alpha", name:"Roadclaw Alpha", type:"Alpha", hpMax:2000, baseX:665, baseY:600, rangeX:175, rangeY:138, speed:.43, phase:1.2, boss:true }),
]);
const ALPHA_HUNT_CIVILIANS = Object.freeze([
  Object.freeze({ id:"alpha_tracker_lead", x:275, y:250, name:"Lead Tracker", look:"scout" }),
  Object.freeze({ id:"alpha_tracker_field", x:925, y:260, name:"Field Tracker", look:"medic" }),
]);
const ALPHA_HUNT_TIGERS = Object.freeze([
  Object.freeze({ id:"alpha_highland", name:"Highland Prowler", type:"Scout", hpMax:440, baseX:330, baseY:460, rangeX:110, rangeY:84, speed:.82, phase:.6 }),
  Object.freeze({ id:"alpha_mist", name:"Mist Hunter", type:"Standard", hpMax:480, baseX:665, baseY:340, rangeX:124, rangeY:94, speed:.68, phase:2.5 }),
  Object.freeze({ id:"alpha_guard", name:"Apex Guard", type:"Armored", hpMax:600, baseX:900, baseY:660, rangeX:104, rangeY:88, speed:.54, phase:4.6 }),
  Object.freeze({ id:"ghoststripe_alpha", name:"Ghoststripe Alpha", type:"Alpha", hpMax:2300, baseX:640, baseY:585, rangeX:185, rangeY:145, speed:.44, phase:1.3, boss:true }),
]);
const STORM_EXTRACTION_CIVILIANS = Object.freeze([
  Object.freeze({ id:"storm_pilot", x:235, y:250, name:"Evac Pilot", look:"driver" }),
  Object.freeze({ id:"storm_engineer", x:545, y:720, name:"Rescue Engineer", look:"field" }),
  Object.freeze({ id:"storm_officer", x:935, y:265, name:"Weather Officer", look:"scout" }),
]);
const STORM_EXTRACTION_TIGERS = Object.freeze([
  Object.freeze({ id:"storm_surge", name:"Surge Prowler", type:"Scout", hpMax:500, baseX:300, baseY:430, rangeX:118, rangeY:88, speed:.84, phase:.5 }),
  Object.freeze({ id:"storm_flood", name:"Floodplain Hunter", type:"Standard", hpMax:540, baseX:545, baseY:330, rangeX:130, rangeY:98, speed:.70, phase:2.2 }),
  Object.freeze({ id:"storm_breaker", name:"Breakwater Tiger", type:"Armored", hpMax:660, baseX:845, baseY:465, rangeX:112, rangeY:92, speed:.56, phase:3.9 }),
  Object.freeze({ id:"storm_coast", name:"Coastal Stalker", type:"Standard", hpMax:575, baseX:930, baseY:700, rangeX:120, rangeY:94, speed:.66, phase:5.1 }),
  Object.freeze({ id:"tempest_alpha", name:"Tempest Alpha", type:"Alpha", hpMax:2600, baseX:655, baseY:590, rangeX:195, rangeY:152, speed:.45, phase:1.15, boss:true }),
]);

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
function expandMissionDefinition(base, targetWorld){
  const world = Object.freeze({ width:Number(targetWorld.width), height:Number(targetWorld.height) });
  const sx = world.width / WORLD.width;
  const sy = world.height / WORLD.height;
  const tigerRoamScale = Math.min(1.55, Math.max(1.25, ((sx + sy) * .5) * .58));
  const point = (src)=>Object.freeze({ ...src, x:Math.round(Number(src.x || 0) * sx), y:Math.round(Number(src.y || 0) * sy) });
  const tiger = (src)=>Object.freeze({
    ...src,
    baseX:Math.round(Number(src.baseX || 0) * sx),
    baseY:Math.round(Number(src.baseY || 0) * sy),
    rangeX:Math.round(Number(src.rangeX || 0) * tigerRoamScale),
    rangeY:Math.round(Number(src.rangeY || 0) * tigerRoamScale),
  });
  return Object.freeze({
    ...base,
    world,
    extraction:Object.freeze({
      x:Math.round(Number(base.extraction.x || 0) * sx),
      y:Math.round(Number(base.extraction.y || 0) * sy),
      r:110,
    }),
    spawns:Object.freeze((base.spawns || []).map(point)),
    civilians:Object.freeze((base.civilians || []).map(point)),
    tigers:Object.freeze((base.tigers || []).map(tiger)),
  });
}

const EXPANDED_SHARED_STORY_MISSIONS = Object.freeze(Object.fromEntries(
  Object.entries(SHARED_STORY_MISSIONS).map(([level, mission])=>[
    level,
    expandMissionDefinition(mission, SHARED_STORY_WORLD_SIZES[level] || SHARED_STORY_WORLD_SIZES[1]),
  ])
));
const EXPANDED_NIGHT_FANG_MISSION = expandMissionDefinition({
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
}, NIGHT_FANG_WORLD_SIZE);
const EXPANDED_TIGER_DEN_MISSION = expandMissionDefinition({
  level:0,
  chapter:0,
  chapterName:"Cave Wilds",
  title:"Tiger Den Assault",
  objective:"Rescue two trapped field specialists, clear the den guards, defeat Stoneclaw Alpha, then extract together.",
  rescueRequired:TIGER_DEN_CIVILIANS.length,
  timeLimitMs:8 * 60 * 1000,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:TIGER_DEN_CIVILIANS,
  tigers:TIGER_DEN_TIGERS,
}, TIGER_DEN_WORLD_SIZE);
const EXPANDED_VILLAGE_SIEGE_MISSION = expandMissionDefinition({
  level:0,
  chapter:0,
  chapterName:"Suncrest Village",
  title:"Village Siege",
  objective:"Rescue five trapped villagers, clear the four siege tigers, defeat Ironmane Alpha, then extract together.",
  rescueRequired:VILLAGE_SIEGE_CIVILIANS.length,
  timeLimitMs:9 * 60 * 1000,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:VILLAGE_SIEGE_CIVILIANS,
  tigers:VILLAGE_SIEGE_TIGERS,
}, VILLAGE_SIEGE_WORLD_SIZE);
const EXPANDED_CONVOY_RESCUE_MISSION = expandMissionDefinition({
  level:0,
  chapter:0,
  chapterName:"Redwood Convoy Route",
  title:"Convoy Rescue",
  objective:"Rescue four stranded convoy crew members, clear the four ambush tigers, defeat Roadclaw Alpha, then extract together.",
  rescueRequired:CONVOY_RESCUE_CIVILIANS.length,
  timeLimitMs:10 * 60 * 1000,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:CONVOY_RESCUE_CIVILIANS,
  tigers:CONVOY_RESCUE_TIGERS,
}, CONVOY_RESCUE_WORLD_SIZE);
const EXPANDED_ALPHA_HUNT_MISSION = expandMissionDefinition({
  level:0,
  chapter:0,
  chapterName:"Moonshadow Highlands",
  title:"Alpha Hunt",
  objective:"Rescue two injured trackers, clear the three elite tigers, defeat Ghoststripe Alpha, then extract together.",
  rescueRequired:ALPHA_HUNT_CIVILIANS.length,
  timeLimitMs:11 * 60 * 1000,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:ALPHA_HUNT_CIVILIANS,
  tigers:ALPHA_HUNT_TIGERS,
}, ALPHA_HUNT_WORLD_SIZE);
const EXPANDED_STORM_EXTRACTION_MISSION = expandMissionDefinition({
  level:0,
  chapter:0,
  chapterName:"Tempest Coast",
  title:"Storm Extraction",
  objective:"Rescue three stranded evacuation specialists, clear the four storm-pack tigers, defeat Tempest Alpha, then reach storm extraction together.",
  rescueRequired:STORM_EXTRACTION_CIVILIANS.length,
  timeLimitMs:12 * 60 * 1000,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:STORM_EXTRACTION_CIVILIANS,
  tigers:STORM_EXTRACTION_TIGERS,
}, STORM_EXTRACTION_WORLD_SIZE);
const SPECIAL_OPERATION_MISSIONS = Object.freeze({
  "live-squad":EXPANDED_NIGHT_FANG_MISSION,
  "tiger-den":EXPANDED_TIGER_DEN_MISSION,
  "village-siege":EXPANDED_VILLAGE_SIEGE_MISSION,
  "convoy-rescue":EXPANDED_CONVOY_RESCUE_MISSION,
  "alpha-hunt":EXPANDED_ALPHA_HUNT_MISSION,
  "storm-extraction":EXPANDED_STORM_EXTRACTION_MISSION,
});
const VALID_LAUNCH_TYPES = Object.freeze(["shared-story", ...Object.keys(SPECIAL_OPERATION_MISSIONS)]);
const ALL_COOP_MISSIONS = Object.freeze([
  ...Object.values(EXPANDED_SHARED_STORY_MISSIONS),
  ...Object.values(SPECIAL_OPERATION_MISSIONS),
]);
const ALL_COOP_TIGERS = Object.freeze(ALL_COOP_MISSIONS.flatMap((mission)=>mission.tigers || []));
const ALL_COOP_CIVILIANS = Object.freeze(ALL_COOP_MISSIONS.flatMap((mission)=>mission.civilians || []));

function normalizeLaunchType(value){
  const type = String(value || "").trim().toLowerCase();
  return VALID_LAUNCH_TYPES.includes(type) ? type : "live-squad";
}

function missionDefinition(session){
  if(session?.launchType === "shared-story"){
    return EXPANDED_SHARED_STORY_MISSIONS[Number(session.storyMissionLevel || 0)] || EXPANDED_SHARED_STORY_MISSIONS[1];
  }
  return SPECIAL_OPERATION_MISSIONS[normalizeLaunchType(session?.launchType)] || EXPANDED_NIGHT_FANG_MISSION;
}

function missionLimitMs(session){
  return Math.max(60 * 1000, Number(missionDefinition(session).timeLimitMs || MISSION_LIMIT_MS));
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
  const pausedBy = {};
  const rawPausedBy = raw.pausedBy && typeof raw.pausedBy === "object" ? raw.pausedBy : {};
  for(const memberId of memberIds){
    const reason = cleanText(rawPausedBy[String(memberId)] || rawPausedBy[memberId], 20).toLowerCase();
    if(reason) pausedBy[String(memberId)] = reason === "inventory" ? "inventory" : "shop";
  }
  const activePause = raw.status === "active" && Object.keys(pausedBy).length > 0;
  const launchType = normalizeLaunchType(raw.launchType);
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
    pausedAt:activePause ? Math.max(0, Number(raw.pausedAt || nowMs())) : 0,
    pausedBy:activePause ? pausedBy : {},
    failureReason:cleanText(raw.failureReason, 32),
    storyMissionLevel:clamp(Math.floor(Number(raw.storyMissionLevel || 0)), 0, 100),
    launchType,
    title:launchType === "shared-story"
      ? `Shared Story Mission ${clamp(Math.floor(Number(raw.storyMissionLevel || 1)), 1, 100)}`
      : (SPECIAL_OPERATION_MISSIONS[launchType]?.title || "Operation Night Fang"),
  };
}

function sessionPaused(session){
  return session?.status === "active" && Number(session?.pausedAt || 0) > 0 && Object.keys(session?.pausedBy || {}).length > 0;
}

function sessionClockNow(session, at=nowMs()){
  return sessionPaused(session) ? Number(session.pausedAt) : at;
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
    capturedIds:[],
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
  for(const tiger of ALL_COOP_TIGERS){
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
    x:clamp(src.x ?? base.x, 24, MAX_COOP_WORLD.width - 24),
    y:clamp(src.y ?? base.y, 24, MAX_COOP_WORLD.height - 24),
    face:clamp(src.face, -Math.PI * 4, Math.PI * 4),
    hp,
    maxHp,
    downed:!!src.downed || hp <= 0,
    livesRemaining:clamp(src.livesRemaining ?? STARTING_LIVES, 0, STARTING_LIVES),
    knockdowns:clamp(src.knockdowns, 0, 999),
    respawnAt:Math.max(0, Number(src.respawnAt || 0)),
    bossDamage:clamp(src.bossDamage, 0, 2000),
    tigerDamage,
    rescuedIds:[...new Set((Array.isArray(src.rescuedIds) ? src.rescuedIds : []).map((id)=>cleanText(id, 24)).filter((id)=>ALL_COOP_CIVILIANS.some((c)=>c.id === id)))],
    capturedIds:[...new Set((Array.isArray(src.capturedIds) ? src.capturedIds : []).map((id)=>cleanText(id, 32)).filter((id)=>ALL_COOP_TIGERS.some((t)=>t.id === id)))],
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
  const elapsed = Math.max(0, sessionClockNow(session, at) - session.startedAt) / 1000;
  return {
    x:clamp(tiger.baseX + Math.cos(elapsed * tiger.speed + tiger.phase) * tiger.rangeX, 70, world.width - 70),
    y:clamp(tiger.baseY + Math.sin(elapsed * tiger.speed * .83 + tiger.phase) * tiger.rangeY, 90, world.height - 80),
  };
}

function tigerSnapshots(session, players, at=nowMs()){
  return missionDefinition(session).tigers.map((def)=>{
    const captured = players.some((player)=>(player?.capturedIds || []).includes(def.id));
    let damage = players.reduce((sum, player)=>sum + clamp(player?.tigerDamage?.[def.id], 0, def.hpMax), 0);
    if(session?.launchType === "live-squad" && def.boss && damage <= 0){
      // Keep rooms created by the first V5 release playable after this update.
      damage = players.reduce((sum, player)=>sum + clamp(player?.bossDamage, 0, BOSS_HP_MAX), 0);
    }
    const hp = captured ? 0 : clamp(def.hpMax - damage, 0, def.hpMax);
    return { ...def, ...tigerPosition(session, def, at), hp, defeated:hp <= 0, captured };
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
    launchType:normalizeLaunchType(opts?.launchType),
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
  const legacyBossOnlyRoom = session.launchType === "live-squad" && players.every((p)=>Object.keys(p?.tigerDamage || {}).length === 0) && players.some((p)=>Number(p?.bossDamage || 0) > 0);
  const objectivesReady = rescuedIds.length >= mission.rescueRequired && (allTigersCleared || legacyBossOnlyRoom);
  const squadWiped = players.length === session.memberIds.length && players.every((p)=>p.downed && Number(p.respawnAt || 0) <= 0 && Number(p.livesRemaining || 0) <= 0);
  return { rescuedIds, bossDamage, bossHp, boss, tigers, onlineIds, extractionReadyIds, objectivesReady, squadWiped };
}

async function maybeFinishSession(session, players){
  if(session.status !== "active") return session;
  const now = nowMs();
  if(sessionPaused(session)){
    const onlinePausedIds = Object.keys(session.pausedBy || {}).filter((id)=>{
      const player = players.find((row)=>String(row.userId) === String(id));
      return player && now - Number(player.lastSeenAt || 0) <= 30000;
    });
    if(onlinePausedIds.length !== Object.keys(session.pausedBy || {}).length){
      const nextPausedBy = {};
      for(const id of onlinePausedIds) nextPausedBy[id] = session.pausedBy[id];
      session.pausedBy = nextPausedBy;
      if(!onlinePausedIds.length){
        const pausedFor = Math.max(0, now - Number(session.pausedAt || now));
        session.startedAt += pausedFor;
        session.pausedAt = 0;
        for(const player of players){
          if(Number(player.respawnAt || 0) > 0){
            player.respawnAt += pausedFor;
            await writePlayer(session.code, player);
          }
        }
      }
      session = await writeSession(session);
    }
    if(sessionPaused(session)) return session;
  }
  if(now - session.startedAt > missionLimitMs(session)){
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
    paused:sessionPaused(session),
    pausedAt:Number(session.pausedAt || 0),
    pausedBy:Object.entries(session.pausedBy || {}).map(([userId, reason])=>{
      const player = players.find((row)=>String(row.userId) === String(userId));
      return { userId:Number(userId), name:player?.name || `Player ${userId}`, reason };
    }),
    serverNow:at,
    expiresAt:session.updatedAt + SESSION_TTL_MS,
    timeLeftMs:session.status === "active" ? Math.max(0, missionLimitMs(session) - (sessionClockNow(session, at) - session.startedAt)) : missionLimitMs(session),
    mission:{
      level:mission.level,
      chapter:mission.chapter,
      chapterName:mission.chapterName,
      title:mission.title,
      objective:mission.objective,
      rescueRequired:mission.rescueRequired,
      civilianCount:mission.civilians.length,
      tigerCount:mission.tigers.length,
      timeLimitMs:missionLimitMs(session),
    },
    world:mission.world,
    spawns:mission.spawns,
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
  if(sessionPaused(session)){
    player.lastSeenAt = now;
    return writePlayer(session.code, player);
  }
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
  if(action === "pause" || action === "resume"){
    if(session.status !== "active") return session;
    if(!session.pausedBy || typeof session.pausedBy !== "object") session.pausedBy = {};
    if(action === "pause"){
      if(!sessionPaused(session)) session.pausedAt = now;
      session.pausedBy[String(uid)] = cleanText(payload.reason, 20).toLowerCase() === "inventory" ? "inventory" : "shop";
      player.lastSeenAt = now;
      await writePlayer(session.code, player);
      return writeSession(session);
    }
    delete session.pausedBy[String(uid)];
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
    if(!Object.keys(session.pausedBy).length && Number(session.pausedAt || 0) > 0){
      const pausedFor = Math.max(0, now - Number(session.pausedAt || now));
      session.startedAt += pausedFor;
      session.pausedAt = 0;
      const players = await memberPlayers(session);
      for(const row of players){
        if(Number(row.respawnAt || 0) > 0){
          row.respawnAt += pausedFor;
          await writePlayer(session.code, row);
        }
      }
    }
    return writeSession(session);
  }
  if(action === "start" || action === "restart"){
    if(session.hostId !== uid) throw new Error("Only the squad leader can start the mission.");
    if(session.memberIds.length < 2) throw new Error("Invite one teammate before starting.");
    if(action === "start" && session.status !== "waiting") return session;
    if(action === "restart" && session.status !== "failed") throw new Error("Restart is available after the mission ends.");
    session.status = "active";
    session.startedAt = now;
    session.completedAt = 0;
    session.failureReason = "";
    session.pausedAt = 0;
    session.pausedBy = {};
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
      p.capturedIds = [];
      p.rescuedIds = [];
      p.rewardClaimed = false;
      p.lastSeenAt = now;
      await writePlayer(session.code, p);
    }
    return session;
  }
  if(session.status !== "active") throw new Error("The co-op mission is not active.");
  if(sessionPaused(session)) throw new Error("The squad mission is paused while a player uses Shop or Inventory.");
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
  }else if(action === "capture"){
    const players = await memberPlayers(session);
    const tigers = tigerSnapshots(session, players, now).filter((t)=>!t.defeated);
    const requestedId = cleanText(payload.tigerId, 32);
    const target = tigers.find((t)=>t.id === requestedId) || tigers.sort((a,b)=>distance(player,a)-distance(player,b))[0];
    if(!target) throw new Error("The tiger threat is already cleared.");
    if(distance(player, target) > (target.boss ? 178 : 164)) throw new Error(`Move closer to ${target.name}.`);
    if(Number(target.hp || 0) > Number(target.hpMax || 1) * 0.30) throw new Error("Weaken the tiger to 30% health before capture.");
    if(!Array.isArray(player.capturedIds)) player.capturedIds = [];
    if(!player.capturedIds.includes(target.id)) player.capturedIds.push(target.id);
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
  const sharedStory = session.launchType === "shared-story";
  const sharedLevel = sharedStory ? clamp(Math.floor(Number(session.storyMissionLevel || 1)), 1, 5) : 0;
  const sharedRewards = {
    1:{ cash:1800, perkPoints:1, seasonPoints:6, badge:"Shared Story First Patrol" },
    2:{ cash:2050, perkPoints:1, seasonPoints:7, badge:"Farm Road Guardians" },
    3:{ cash:2250, perkPoints:1, seasonPoints:8, badge:"First Encounter Duo" },
    4:{ cash:2450, perkPoints:1, seasonPoints:9, badge:"Jungle Hut Rescue" },
    5:{ cash:2700, perkPoints:1, seasonPoints:10, badge:"Jungle Trail Team" },
  };
  const operationRewards = {
    "live-squad":{ cash:6500, perkPoints:1, seasonPoints:12, badge:"Night Fang First Response" },
    "tiger-den":{ cash:8200, perkPoints:2, seasonPoints:16, badge:"Stoneclaw Den Breaker" },
    "village-siege":{ cash:9600, perkPoints:2, seasonPoints:20, badge:"Suncrest Village Shield" },
    "convoy-rescue":{ cash:11200, perkPoints:3, seasonPoints:24, badge:"Redwood Convoy Guardian" },
    "alpha-hunt":{ cash:13000, perkPoints:3, seasonPoints:28, badge:"Ghoststripe Apex Hunter" },
    "storm-extraction":{ cash:15000, perkPoints:4, seasonPoints:32, badge:"Tempest Coast Lifeline" },
  };
  const operationId = normalizeLaunchType(session.launchType);
  return {
    firstClaim,
    receipt:`${sharedStory ? `shared-story-${sharedLevel}` : operationId}:${session.code}:${uid}`,
    storyProgress:sharedStory ? { completedLevel:sharedLevel, unlockLevel:Math.min(100, sharedLevel + 1) } : null,
    reward:sharedStory
      ? sharedRewards[sharedLevel]
      : (operationRewards[operationId] || operationRewards["live-squad"]),
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
  SPECIAL_OPERATION_MISSIONS,
  SHARED_STORY_MISSION_1,
  SHARED_STORY_MISSIONS,
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
