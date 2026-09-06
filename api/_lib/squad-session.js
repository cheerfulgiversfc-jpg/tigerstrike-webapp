const crypto = require("crypto");
const { getState, setState, setStateIfAbsent } = require("./metrics-store");
const ammoRules = require("../../ammo-modes");
const tigerIntelligence = require("../../tiger-intelligence");

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
  6:Object.freeze({
    level:6, chapter:1, chapterName:"The First Attack", title:"Story Mission 6",
    objective:"Tigers attack from tall grass. Clear the hidden pack together.", rescueRequired:0,
    timeLimitMs:7 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"story6_grass_scout", name:"Grassline Scout", type:"Scout", hpMax:180, baseX:315, baseY:360, rangeX:104, rangeY:76, speed:.78, phase:.5 }),
      Object.freeze({ id:"story6_hidden_hunter", name:"Hidden Hunter", type:"Standard", hpMax:210, baseX:675, baseY:535, rangeX:122, rangeY:94, speed:.66, phase:2.6 }),
      Object.freeze({ id:"story6_reed_stalker", name:"Reed Stalker", type:"Standard", hpMax:225, baseX:930, baseY:700, rangeX:116, rangeY:90, speed:.70, phase:4.4 }),
    ]),
  }),
  7:Object.freeze({
    level:7, chapter:1, chapterName:"The First Attack", title:"Story Mission 7",
    objective:"Escort the injured villager to the safe zone, clear the road tigers, and extract.", rescueRequired:1,
    timeLimitMs:7 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([
      Object.freeze({ id:"story7_injured_villager", x:515, y:330, name:"Injured Villager", look:"medic" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"story7_road_scout", name:"Roadside Scout", type:"Scout", hpMax:195, baseX:405, baseY:540, rangeX:98, rangeY:78, speed:.76, phase:.9 }),
      Object.freeze({ id:"story7_escort_breaker", name:"Escort Breaker", type:"Armored", hpMax:260, baseX:865, baseY:690, rangeX:104, rangeY:86, speed:.54, phase:3.8 }),
    ]),
  }),
  8:Object.freeze({
    level:8, chapter:1, chapterName:"The First Attack", title:"Story Mission 8",
    objective:"Capture your first tiger for research, then extract together.", rescueRequired:0, captureRequired:1,
    timeLimitMs:7 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"story8_research_tiger", name:"Research Tiger", type:"Standard", hpMax:280, baseX:650, baseY:535, rangeX:138, rangeY:106, speed:.64, phase:1.7 }),
    ]),
  }),
  9:Object.freeze({
    level:9, chapter:1, chapterName:"The First Attack", title:"Story Mission 9",
    objective:"Multiple tigers attack the village gate. Defend the gate and clear the pack.", rescueRequired:0,
    timeLimitMs:8 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"story9_north_gate", name:"North Gate Prowler", type:"Scout", hpMax:205, baseX:285, baseY:425, rangeX:104, rangeY:80, speed:.80, phase:.4 }),
      Object.freeze({ id:"story9_center_gate", name:"Center Gate Tiger", type:"Standard", hpMax:235, baseX:540, baseY:335, rangeX:118, rangeY:92, speed:.68, phase:2.0 }),
      Object.freeze({ id:"story9_wall_stalker", name:"Wall Stalker", type:"Standard", hpMax:245, baseX:790, baseY:480, rangeX:110, rangeY:88, speed:.70, phase:3.6 }),
      Object.freeze({ id:"story9_gate_breaker", name:"Gate Breaker", type:"Armored", hpMax:310, baseX:925, baseY:710, rangeX:100, rangeY:84, speed:.52, phase:5.0 }),
    ]),
  }),
  10:Object.freeze({
    level:10, chapter:1, chapterName:"The First Attack", title:"Story Mission 10",
    objective:"Boss: Alpha Tiger appears near the village. Defeat or capture the Alpha, then extract.", rescueRequired:0,
    timeLimitMs:8 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"story10_village_alpha", name:"Village Alpha", type:"Alpha", hpMax:1000, baseX:655, baseY:570, rangeX:172, rangeY:136, speed:.43, phase:1.25, boss:true }),
    ]),
  }),
  11:Object.freeze({
    level:11, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 11",
    objective:"Escort four villagers through the narrow jungle path, clear the patrol, and extract.", rescueRequired:4,
    timeLimitMs:8 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s11_path_mid", x:520, y:445, r:125, label:"Narrow Path Midpoint" }),
      Object.freeze({ id:"s11_path_exit", x:860, y:625, r:125, label:"Narrow Path Exit" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s11_path_elder", x:260, y:220, name:"Path Elder", look:"field" }),
      Object.freeze({ id:"s11_family_guide", x:475, y:410, name:"Family Guide", look:"scout" }),
      Object.freeze({ id:"s11_trail_worker", x:760, y:265, name:"Trail Worker", look:"driver" }),
      Object.freeze({ id:"s11_village_scout", x:900, y:700, name:"Village Scout", look:"medic" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s11_path_scout", name:"Path Scout", type:"Scout", hpMax:235, baseX:340, baseY:500, rangeX:105, rangeY:78, speed:.80, phase:.5 }),
      Object.freeze({ id:"s11_bend_stalker", name:"Bend Stalker", type:"Standard", hpMax:275, baseX:680, baseY:350, rangeX:126, rangeY:94, speed:.69, phase:2.5 }),
      Object.freeze({ id:"s11_narrow_guard", name:"Narrow Path Guard", type:"Armored", hpMax:335, baseX:900, baseY:720, rangeX:106, rangeY:86, speed:.54, phase:4.7 }),
    ]),
  }),
  12:Object.freeze({
    level:12, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 12",
    objective:"Killing a tiger increases the surviving pack's aggression. Clear or capture the pack together.", rescueRequired:0,
    dangerNote:"Every tiger killed adds 2 damage to the surviving tigers. Captures do not raise aggression.", aggressionLabel:"Rising Blood Aggression", aggressionPerKill:2,
    timeLimitMs:8 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s12_blood_scout", name:"Blood Trail Scout", type:"Scout", hpMax:245, baseX:290, baseY:420, rangeX:112, rangeY:82, speed:.84, phase:.4 }),
      Object.freeze({ id:"s12_rage_hunter", name:"Rage Hunter", type:"Standard", hpMax:290, baseX:520, baseY:300, rangeX:132, rangeY:98, speed:.72, phase:1.8 }),
      Object.freeze({ id:"s12_blood_stalker", name:"Blood Stalker", type:"Standard", hpMax:305, baseX:790, baseY:500, rangeX:126, rangeY:96, speed:.74, phase:3.5 }),
      Object.freeze({ id:"s12_rage_guard", name:"Rage Guard", type:"Armored", hpMax:370, baseX:925, baseY:720, rangeX:108, rangeY:88, speed:.57, phase:5.1 }),
    ]),
  }),
  13:Object.freeze({
    level:13, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 13",
    objective:"Capture two tigers for the scientists, clear the remaining threat, and extract.", rescueRequired:0, captureRequired:2,
    timeLimitMs:9 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s13_sample_scout", name:"Sample Scout", type:"Scout", hpMax:260, baseX:315, baseY:390, rangeX:114, rangeY:84, speed:.80, phase:.7 }),
      Object.freeze({ id:"s13_sample_tiger", name:"Research Sample Tiger", type:"Standard", hpMax:320, baseX:660, baseY:510, rangeX:138, rangeY:105, speed:.68, phase:2.6 }),
      Object.freeze({ id:"s13_sample_guard", name:"Sample Guard", type:"Armored", hpMax:385, baseX:920, baseY:700, rangeX:112, rangeY:90, speed:.55, phase:4.8 }),
    ]),
  }),
  14:Object.freeze({
    level:14, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 14",
    objective:"Protect Doctor Amara, escort her to safety, clear the tigers, and extract.", rescueRequired:1,
    timeLimitMs:8 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([
      Object.freeze({ id:"s14_doctor_amara", x:560, y:315, name:"Doctor Amara", look:"medic", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s14_clinic_scout", name:"Clinic Scout", type:"Scout", hpMax:255, baseX:330, baseY:480, rangeX:108, rangeY:82, speed:.82, phase:.6 }),
      Object.freeze({ id:"s14_doctor_hunter", name:"Doctor Hunter", type:"Standard", hpMax:310, baseX:700, baseY:410, rangeX:132, rangeY:102, speed:.71, phase:2.7 }),
      Object.freeze({ id:"s14_clinic_guard", name:"Clinic Guard", type:"Armored", hpMax:380, baseX:910, baseY:710, rangeX:108, rangeY:88, speed:.54, phase:4.9 }),
    ]),
  }),
  15:Object.freeze({
    level:15, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 15",
    objective:"Tigers ambush the caravan. Rescue all four crew members, clear the ambush, and extract.", rescueRequired:4,
    timeLimitMs:9 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s15_route_1", x:390, y:550, r:130, label:"Caravan Rally Point" }),
      Object.freeze({ id:"s15_route_2", x:660, y:550, r:130, label:"Caravan Crossroads" }),
      Object.freeze({ id:"s15_route_3", x:900, y:675, r:130, label:"Caravan Safe Approach" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s15_driver", x:245, y:300, name:"Caravan Driver", look:"driver" }),
      Object.freeze({ id:"s15_merchant", x:465, y:520, name:"Caravan Merchant", look:"field" }),
      Object.freeze({ id:"s15_medic", x:735, y:295, name:"Caravan Medic", look:"medic" }),
      Object.freeze({ id:"s15_guard", x:925, y:690, name:"Caravan Guard", look:"scout" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s15_road_scout", name:"Caravan Scout", type:"Scout", hpMax:270, baseX:300, baseY:430, rangeX:112, rangeY:84, speed:.84, phase:.5 }),
      Object.freeze({ id:"s15_wagon_stalker", name:"Wagon Stalker", type:"Standard", hpMax:320, baseX:520, baseY:350, rangeX:132, rangeY:100, speed:.72, phase:2.0 }),
      Object.freeze({ id:"s15_cargo_hunter", name:"Cargo Hunter", type:"Standard", hpMax:335, baseX:780, baseY:510, rangeX:126, rangeY:98, speed:.70, phase:3.7 }),
      Object.freeze({ id:"s15_caravan_breaker", name:"Caravan Breaker", type:"Armored", hpMax:405, baseX:930, baseY:720, rangeX:108, rangeY:90, speed:.55, phase:5.2 }),
    ]),
  }),
  16:Object.freeze({
    level:16, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 16",
    objective:"Escort five civilians through the forest, clear the tiger patrol, and extract.", rescueRequired:5,
    timeLimitMs:9 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s16_forest_mid", x:545, y:430, r:125, label:"Forest Midpoint" }),
      Object.freeze({ id:"s16_forest_exit", x:850, y:650, r:125, label:"Forest Exit" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s16_forester", x:230, y:230, name:"Forester", look:"field" }),
      Object.freeze({ id:"s16_ranger", x:410, y:465, name:"Forest Ranger", look:"scout" }),
      Object.freeze({ id:"s16_healer", x:595, y:260, name:"Village Healer", look:"medic" }),
      Object.freeze({ id:"s16_farmer", x:790, y:510, name:"Forest Farmer", look:"driver" }),
      Object.freeze({ id:"s16_guide", x:930, y:705, name:"Trail Guide", look:"field" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s16_forest_scout", name:"Forest Scout", type:"Scout", hpMax:275, baseX:315, baseY:390, rangeX:116, rangeY:86, speed:.84, phase:.4 }),
      Object.freeze({ id:"s16_tree_stalker", name:"Tree Stalker", type:"Standard", hpMax:330, baseX:585, baseY:540, rangeX:136, rangeY:104, speed:.71, phase:2.2 }),
      Object.freeze({ id:"s16_trail_hunter", name:"Trail Hunter", type:"Standard", hpMax:345, baseX:790, baseY:330, rangeX:128, rangeY:98, speed:.73, phase:3.8 }),
      Object.freeze({ id:"s16_forest_guard", name:"Forest Guard", type:"Armored", hpMax:420, baseX:925, baseY:715, rangeX:110, rangeY:90, speed:.55, phase:5.3 }),
    ]),
  }),
  17:Object.freeze({
    level:17, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 17",
    objective:"Rescue four children hiding in the village, clear the prowlers, and extract.", rescueRequired:4,
    timeLimitMs:9 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([
      Object.freeze({ id:"s17_child_maya", x:250, y:245, name:"Maya", look:"field", child:true }),
      Object.freeze({ id:"s17_child_leo", x:480, y:385, name:"Leo", look:"scout", child:true }),
      Object.freeze({ id:"s17_child_nia", x:735, y:250, name:"Nia", look:"medic", child:true }),
      Object.freeze({ id:"s17_child_omar", x:905, y:680, name:"Omar", look:"driver", child:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s17_home_scout", name:"Village Home Scout", type:"Scout", hpMax:280, baseX:320, baseY:450, rangeX:114, rangeY:84, speed:.85, phase:.6 }),
      Object.freeze({ id:"s17_alley_stalker", name:"Village Alley Stalker", type:"Standard", hpMax:340, baseX:665, baseY:370, rangeX:136, rangeY:102, speed:.72, phase:2.8 }),
      Object.freeze({ id:"s17_square_guard", name:"Village Square Guard", type:"Armored", hpMax:430, baseX:910, baseY:710, rangeX:112, rangeY:92, speed:.56, phase:4.9 }),
    ]),
  }),
  18:Object.freeze({
    level:18, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 18",
    objective:"Capture two aggressive pack tigers, clear the remaining pack, and extract together.", rescueRequired:0, captureRequired:2,
    dangerNote:"Aggressive pack tigers deal 2 extra damage at close range.", aggressionLabel:"Aggressive Capture Pack", hazardDamageBonus:2,
    timeLimitMs:9 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s18_pack_scout", name:"Aggressive Pack Scout", type:"Scout", hpMax:295, baseX:300, baseY:400, rangeX:118, rangeY:88, speed:.88, phase:.5 }),
      Object.freeze({ id:"s18_pack_hunter", name:"Aggressive Pack Hunter", type:"Standard", hpMax:350, baseX:535, baseY:305, rangeX:140, rangeY:106, speed:.76, phase:2.0 }),
      Object.freeze({ id:"s18_pack_stalker", name:"Aggressive Pack Stalker", type:"Standard", hpMax:365, baseX:785, baseY:500, rangeX:134, rangeY:102, speed:.77, phase:3.7 }),
      Object.freeze({ id:"s18_pack_guard", name:"Aggressive Pack Guard", type:"Armored", hpMax:445, baseX:930, baseY:710, rangeX:112, rangeY:92, speed:.59, phase:5.2 }),
    ]),
  }),
  19:Object.freeze({
    level:19, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 19",
    objective:"Survive the high-aggression tiger swarm, clear all nine threats, and extract.", rescueRequired:0,
    dangerNote:"The swarm attacks faster and deals 4 extra damage at close range.", aggressionLabel:"High Aggression", hazardDamageBonus:4, hazardCooldownMs:900,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s19_swarm_1", name:"Swarm Scout One", type:"Scout", hpMax:240, baseX:225, baseY:350, rangeX:110, rangeY:82, speed:.92, phase:.2 }),
      Object.freeze({ id:"s19_swarm_2", name:"Swarm Scout Two", type:"Scout", hpMax:250, baseX:410, baseY:260, rangeX:116, rangeY:86, speed:.94, phase:1.1 }),
      Object.freeze({ id:"s19_swarm_3", name:"Swarm Hunter One", type:"Standard", hpMax:300, baseX:585, baseY:430, rangeX:138, rangeY:104, speed:.80, phase:2.0 }),
      Object.freeze({ id:"s19_swarm_4", name:"Swarm Hunter Two", type:"Standard", hpMax:310, baseX:760, baseY:290, rangeX:136, rangeY:102, speed:.82, phase:2.8 }),
      Object.freeze({ id:"s19_swarm_5", name:"Swarm Hunter Three", type:"Standard", hpMax:320, baseX:930, baseY:410, rangeX:134, rangeY:100, speed:.84, phase:3.6 }),
      Object.freeze({ id:"s19_swarm_6", name:"Swarm Prowler One", type:"Scout", hpMax:270, baseX:285, baseY:690, rangeX:118, rangeY:88, speed:.93, phase:4.4 }),
      Object.freeze({ id:"s19_swarm_7", name:"Swarm Prowler Two", type:"Standard", hpMax:325, baseX:500, baseY:750, rangeX:134, rangeY:102, speed:.82, phase:5.2 }),
      Object.freeze({ id:"s19_swarm_8", name:"Swarm Guard One", type:"Armored", hpMax:390, baseX:740, baseY:690, rangeX:114, rangeY:92, speed:.64, phase:6.0 }),
      Object.freeze({ id:"s19_swarm_9", name:"Swarm Guard Two", type:"Armored", hpMax:410, baseX:955, baseY:735, rangeX:112, rangeY:90, speed:.65, phase:6.8 }),
    ]),
  }),
  20:Object.freeze({
    level:20, chapter:2, chapterName:"Blood in the Jungle", title:"Story Mission 20",
    objective:"Boss: Blood Tiger appears. Defeat or capture it before Blood Rage overwhelms the squad.", rescueRequired:0,
    dangerNote:"Blood Rage activates below 35% health: the Blood Tiger attacks faster and deals 6 extra damage.", aggressionLabel:"Blood Tiger Boss", hazardDamageBonus:3,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s20_blood_tiger", name:"Blood Tiger", type:"Berserker", hpMax:1800, baseX:655, baseY:565, rangeX:190, rangeY:150, speed:.50, phase:1.2, boss:true, bloodRage:true }),
    ]),
  }),
  21:Object.freeze({
    level:21, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 21",
    objective:"Escort the four-person research team through the Deep Jungle route, clear the tiger patrol, and extract.", rescueRequired:4,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s21_research_camp", x:390, y:390, r:125, label:"Research Camp" }),
      Object.freeze({ id:"s21_sample_site", x:665, y:520, r:125, label:"Sample Site" }),
      Object.freeze({ id:"s21_deep_exit", x:905, y:690, r:125, label:"Deep Jungle Exit" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s21_lead_biologist", x:240, y:245, name:"Lead Biologist", look:"medic", vip:true }),
      Object.freeze({ id:"s21_field_researcher", x:455, y:420, name:"Field Researcher", look:"field" }),
      Object.freeze({ id:"s21_sample_technician", x:735, y:270, name:"Sample Technician", look:"driver" }),
      Object.freeze({ id:"s21_radio_analyst", x:915, y:690, name:"Radio Analyst", look:"scout" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s21_territory_scout", name:"Territory Scout", type:"Scout", hpMax:305, baseX:315, baseY:455, rangeX:120, rangeY:88, speed:.88, phase:.4 }),
      Object.freeze({ id:"s21_brush_stalker", name:"Brush Stalker", type:"Stalker", hpMax:365, baseX:555, baseY:320, rangeX:145, rangeY:108, speed:.76, phase:2.0 }),
      Object.freeze({ id:"s21_camp_hunter", name:"Research Camp Hunter", type:"Standard", hpMax:385, baseX:785, baseY:515, rangeX:138, rangeY:104, speed:.73, phase:3.7 }),
      Object.freeze({ id:"s21_pack_guard", name:"Deep Jungle Guard", type:"Armored", hpMax:470, baseX:935, baseY:715, rangeX:114, rangeY:92, speed:.59, phase:5.1 }),
    ]),
  }),
  22:Object.freeze({
    level:22, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 22",
    objective:"Find the tigers hiding in tall grass, clear the concealed pack, and extract together.", rescueRequired:0,
    dangerNote:"Tall-grass tigers begin suspicious and close distance quickly after gunfire. Watch their awareness labels and stay together.", aggressionLabel:"Tall Grass Ambush", hazardDamageBonus:1,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s22_grass_scout", name:"Grassline Scout", type:"Scout", hpMax:290, baseX:245, baseY:370, rangeX:126, rangeY:92, speed:.92, phase:.2 }),
      Object.freeze({ id:"s22_hidden_hunter", name:"Hidden Hunter", type:"Stalker", hpMax:355, baseX:455, baseY:270, rangeX:150, rangeY:110, speed:.80, phase:1.5 }),
      Object.freeze({ id:"s22_reed_stalker", name:"Reed Stalker", type:"Stalker", hpMax:370, baseX:665, baseY:505, rangeX:148, rangeY:112, speed:.81, phase:2.8 }),
      Object.freeze({ id:"s22_brush_mauler", name:"Brush Mauler", type:"Standard", hpMax:395, baseX:835, baseY:340, rangeX:140, rangeY:106, speed:.76, phase:4.1 }),
      Object.freeze({ id:"s22_grass_guard", name:"Grassland Guard", type:"Armored", hpMax:485, baseX:940, baseY:710, rangeX:116, rangeY:94, speed:.60, phase:5.5 }),
    ]),
  }),
  23:Object.freeze({
    level:23, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 23",
    objective:"Use Rubber ammunition to weaken and capture the Veil Tiger alive, clear its two guards, and extract.", rescueRequired:0, captureRequired:1,
    captureTargetIds:Object.freeze(["s23_veil_tiger"]),
    dangerNote:"Only the Veil Tiger counts for the capture objective. A Real-ammo hit makes it ineligible, so begin and remain on Rubber ammunition.", aggressionLabel:"Live Stealth Capture",
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s23_veil_scout", name:"Veil Scout", type:"Scout", hpMax:315, baseX:330, baseY:440, rangeX:126, rangeY:94, speed:.91, phase:.5 }),
      Object.freeze({ id:"s23_veil_tiger", name:"Veil Tiger", type:"Stalker", hpMax:620, baseX:655, baseY:520, rangeX:185, rangeY:142, speed:.78, phase:2.2 }),
      Object.freeze({ id:"s23_veil_guard", name:"Veil Guard", type:"Armored", hpMax:500, baseX:925, baseY:700, rangeX:118, rangeY:96, speed:.60, phase:4.8 }),
    ]),
  }),
  24:Object.freeze({
    level:24, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 24",
    objective:"Escort five villagers through the river trail checkpoints, clear the riverbank tigers, and extract.", rescueRequired:5,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s24_river_entry", x:360, y:420, r:125, label:"River Trail Entry" }),
      Object.freeze({ id:"s24_river_crossing", x:645, y:625, r:125, label:"River Crossing" }),
      Object.freeze({ id:"s24_far_bank", x:900, y:720, r:125, label:"Far Bank Safe Route" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s24_river_guide", x:230, y:250, name:"River Guide", look:"scout" }),
      Object.freeze({ id:"s24_fisher", x:420, y:420, name:"Village Fisher", look:"driver" }),
      Object.freeze({ id:"s24_healer", x:590, y:260, name:"River Healer", look:"medic" }),
      Object.freeze({ id:"s24_farmer", x:770, y:520, name:"River Farmer", look:"field" }),
      Object.freeze({ id:"s24_elder", x:925, y:700, name:"River Elder", look:"field", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s24_bank_scout", name:"Riverbank Scout", type:"Scout", hpMax:320, baseX:305, baseY:430, rangeX:124, rangeY:92, speed:.89, phase:.4 }),
      Object.freeze({ id:"s24_reed_hunter", name:"Reed Hunter", type:"Stalker", hpMax:380, baseX:560, baseY:350, rangeX:146, rangeY:110, speed:.78, phase:2.1 }),
      Object.freeze({ id:"s24_crossing_tiger", name:"Crossing Tiger", type:"Standard", hpMax:410, baseX:785, baseY:535, rangeX:140, rangeY:108, speed:.74, phase:3.8 }),
      Object.freeze({ id:"s24_far_bank_guard", name:"Far Bank Guard", type:"Armored", hpMax:505, baseX:930, baseY:710, rangeX:116, rangeY:94, speed:.60, phase:5.3 }),
    ]),
  }),
  25:Object.freeze({
    level:25, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 25",
    objective:"Survive the jungle bridge ambush, secure all three bridge checkpoints, clear the pack, and extract.", rescueRequired:0,
    dangerNote:"The bridge pack hits from both banks and deals 2 extra close-range damage. Secure each checkpoint with both soldiers.", aggressionLabel:"Bridge Ambush", hazardDamageBonus:2, hazardCooldownMs:1050,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s25_bridge_approach", x:355, y:510, r:125, label:"Bridge Approach" }),
      Object.freeze({ id:"s25_bridge_center", x:635, y:640, r:125, label:"Jungle Bridge Center" }),
      Object.freeze({ id:"s25_far_bank", x:900, y:700, r:125, label:"Far Bank Perimeter" }),
    ]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s25_bridge_scout_1", name:"Bridge Scout One", type:"Scout", hpMax:315, baseX:275, baseY:405, rangeX:128, rangeY:94, speed:.93, phase:.3 }),
      Object.freeze({ id:"s25_bridge_scout_2", name:"Bridge Scout Two", type:"Scout", hpMax:325, baseX:440, baseY:690, rangeX:128, rangeY:96, speed:.94, phase:1.3 }),
      Object.freeze({ id:"s25_center_hunter", name:"Bridge Center Hunter", type:"Stalker", hpMax:395, baseX:655, baseY:520, rangeX:152, rangeY:114, speed:.80, phase:2.5 }),
      Object.freeze({ id:"s25_bank_mauler", name:"Far Bank Mauler", type:"Standard", hpMax:420, baseX:825, baseY:365, rangeX:140, rangeY:108, speed:.76, phase:4.0 }),
      Object.freeze({ id:"s25_bridge_guard", name:"Bridge Guard", type:"Armored", hpMax:520, baseX:945, baseY:710, rangeX:118, rangeY:96, speed:.62, phase:5.4 }),
    ]),
  }),
  26:Object.freeze({
    level:26, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 26",
    objective:"Find the lost hunter, escort him through both return checkpoints, clear the pursuing tigers, and extract.", rescueRequired:1,
    timeLimitMs:10 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s26_hunter_rally", x:545, y:430, r:125, label:"Hunter Rally Point" }),
      Object.freeze({ id:"s26_return_trail", x:865, y:680, r:125, label:"Return Trail" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s26_lost_hunter", x:585, y:285, name:"Lost Hunter", look:"scout", vip:true, injured:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s26_track_scout", name:"Hunter Track Scout", type:"Scout", hpMax:325, baseX:305, baseY:465, rangeX:126, rangeY:94, speed:.91, phase:.5 }),
      Object.freeze({ id:"s26_trail_stalker", name:"Trail Stalker", type:"Stalker", hpMax:395, baseX:570, baseY:420, rangeX:150, rangeY:114, speed:.80, phase:2.2 }),
      Object.freeze({ id:"s26_pursuit_tiger", name:"Pursuit Tiger", type:"Standard", hpMax:425, baseX:800, baseY:525, rangeX:140, rangeY:108, speed:.77, phase:3.8 }),
      Object.freeze({ id:"s26_return_guard", name:"Return Trail Guard", type:"Armored", hpMax:525, baseX:930, baseY:710, rangeX:118, rangeY:96, speed:.62, phase:5.2 }),
    ]),
  }),
  27:Object.freeze({
    level:27, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 27",
    objective:"Escort five survivors through the abandoned camp checkpoints, clear the occupying pack, and extract.", rescueRequired:5,
    timeLimitMs:11 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s27_camp_gate", x:360, y:390, r:125, label:"Abandoned Camp Gate" }),
      Object.freeze({ id:"s27_supply_yard", x:655, y:515, r:125, label:"Empty Supply Yard" }),
      Object.freeze({ id:"s27_escape_lane", x:900, y:700, r:125, label:"Camp Escape Lane" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s27_camp_cook", x:235, y:245, name:"Camp Cook", look:"field" }),
      Object.freeze({ id:"s27_radio_guard", x:420, y:410, name:"Radio Guard", look:"scout" }),
      Object.freeze({ id:"s27_supply_medic", x:590, y:270, name:"Supply Medic", look:"medic" }),
      Object.freeze({ id:"s27_mechanic", x:780, y:510, name:"Camp Mechanic", look:"driver" }),
      Object.freeze({ id:"s27_route_lead", x:925, y:690, name:"Route Leader", look:"field", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s27_gate_scout", name:"Camp Gate Scout", type:"Scout", hpMax:335, baseX:285, baseY:420, rangeX:128, rangeY:96, speed:.93, phase:.4 }),
      Object.freeze({ id:"s27_tent_stalker", name:"Tent Stalker", type:"Stalker", hpMax:400, baseX:485, baseY:305, rangeX:152, rangeY:114, speed:.81, phase:1.7 }),
      Object.freeze({ id:"s27_yard_hunter", name:"Supply Yard Hunter", type:"Standard", hpMax:430, baseX:675, baseY:525, rangeX:144, rangeY:110, speed:.77, phase:3.0 }),
      Object.freeze({ id:"s27_lane_mauler", name:"Escape Lane Mauler", type:"Standard", hpMax:445, baseX:835, baseY:370, rangeX:140, rangeY:108, speed:.78, phase:4.2 }),
      Object.freeze({ id:"s27_camp_guard", name:"Abandoned Camp Guard", type:"Armored", hpMax:545, baseX:940, baseY:710, rangeX:120, rangeY:98, speed:.63, phase:5.5 }),
    ]),
  }),
  28:Object.freeze({
    level:28, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 28",
    objective:"Survive the large tiger pack attack, clear all eight threats, and extract together.", rescueRequired:0,
    dangerNote:"Eight coordinated tigers attack faster and deal 3 extra close-range damage. Real-ammo kills make the surviving pack even more aggressive.", aggressionLabel:"Large Pack Attack", hazardDamageBonus:3, hazardCooldownMs:875,
    timeLimitMs:11 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s28_pack_1", name:"Deep Pack Scout One", type:"Scout", hpMax:295, baseX:225, baseY:350, rangeX:126, rangeY:94, speed:.96, phase:.2 }),
      Object.freeze({ id:"s28_pack_2", name:"Deep Pack Scout Two", type:"Scout", hpMax:305, baseX:405, baseY:255, rangeX:128, rangeY:96, speed:.97, phase:1.0 }),
      Object.freeze({ id:"s28_pack_3", name:"Deep Pack Stalker One", type:"Stalker", hpMax:375, baseX:565, baseY:430, rangeX:152, rangeY:114, speed:.84, phase:1.9 }),
      Object.freeze({ id:"s28_pack_4", name:"Deep Pack Stalker Two", type:"Stalker", hpMax:385, baseX:745, baseY:290, rangeX:150, rangeY:112, speed:.85, phase:2.8 }),
      Object.freeze({ id:"s28_pack_5", name:"Deep Pack Hunter One", type:"Standard", hpMax:410, baseX:925, baseY:410, rangeX:144, rangeY:110, speed:.82, phase:3.7 }),
      Object.freeze({ id:"s28_pack_6", name:"Deep Pack Hunter Two", type:"Standard", hpMax:420, baseX:305, baseY:695, rangeX:142, rangeY:108, speed:.82, phase:4.6 }),
      Object.freeze({ id:"s28_pack_7", name:"Deep Pack Guard One", type:"Armored", hpMax:510, baseX:650, baseY:720, rangeX:120, rangeY:98, speed:.66, phase:5.5 }),
      Object.freeze({ id:"s28_pack_8", name:"Deep Pack Guard Two", type:"Armored", hpMax:530, baseX:940, baseY:715, rangeX:120, rangeY:98, speed:.67, phase:6.4 }),
    ]),
  }),
  29:Object.freeze({
    level:29, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 29",
    objective:"Escort all seven civilians through the landing-zone checkpoints, clear the tigers, and board the helicopter zone together.", rescueRequired:7,
    extractionType:"helicopter",
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s29_lz_approach", x:365, y:420, r:130, label:"Helicopter LZ Approach" }),
      Object.freeze({ id:"s29_lz_perimeter", x:650, y:545, r:130, label:"Helicopter Perimeter" }),
      Object.freeze({ id:"s29_boarding_zone", x:905, y:700, r:130, label:"Helicopter Boarding Zone" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s29_civilian_1", x:210, y:230, name:"Village Teacher", look:"field" }),
      Object.freeze({ id:"s29_civilian_2", x:350, y:410, name:"Village Medic", look:"medic" }),
      Object.freeze({ id:"s29_civilian_3", x:490, y:245, name:"Radio Operator", look:"scout" }),
      Object.freeze({ id:"s29_civilian_4", x:620, y:520, name:"Village Driver", look:"driver" }),
      Object.freeze({ id:"s29_civilian_5", x:745, y:270, name:"Forest Worker", look:"field" }),
      Object.freeze({ id:"s29_civilian_6", x:855, y:510, name:"Village Nurse", look:"medic" }),
      Object.freeze({ id:"s29_civilian_7", x:930, y:690, name:"Village Elder", look:"field", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s29_lz_scout", name:"Landing Zone Scout", type:"Scout", hpMax:345, baseX:285, baseY:430, rangeX:130, rangeY:98, speed:.95, phase:.4 }),
      Object.freeze({ id:"s29_lz_stalker", name:"Landing Zone Stalker", type:"Stalker", hpMax:420, baseX:505, baseY:325, rangeX:154, rangeY:116, speed:.83, phase:1.9 }),
      Object.freeze({ id:"s29_perimeter_hunter", name:"Perimeter Hunter", type:"Standard", hpMax:450, baseX:690, baseY:525, rangeX:146, rangeY:112, speed:.79, phase:3.1 }),
      Object.freeze({ id:"s29_boarding_mauler", name:"Boarding Zone Mauler", type:"Standard", hpMax:465, baseX:845, baseY:360, rangeX:142, rangeY:110, speed:.80, phase:4.3 }),
      Object.freeze({ id:"s29_lz_guard", name:"Landing Zone Guard", type:"Armored", hpMax:565, baseX:945, baseY:715, rangeX:122, rangeY:100, speed:.64, phase:5.6 }),
    ]),
  }),
  30:Object.freeze({
    level:30, chapter:3, chapterName:"The Deep Jungle", title:"Story Mission 30",
    objective:"Track down the Stealth Tiger boss, defeat or capture it, and extract to finish Chapter 3.", rescueRequired:0,
    dangerNote:"The Stealth Tiger moves quickly through concealment and deals 4 extra close-range damage. Watch its awareness state before it attacks.", aggressionLabel:"Stealth Tiger Boss", hazardDamageBonus:4, hazardCooldownMs:900,
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s30_stealth_tiger", name:"Stealth Tiger", type:"Stalker", hpMax:2200, baseX:655, baseY:565, rangeX:220, rangeY:168, speed:.58, phase:1.25, boss:true }),
    ]),
  }),
  31:Object.freeze({
    level:31, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 31",
    objective:"Search four abandoned homes, find all four survivors, clear the prowlers, and escort everyone to extraction.", rescueRequired:4, checkpointsBeforeRescue:true,
    timeLimitMs:11 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s31_home_north", x:280, y:260, r:120, label:"North Abandoned Home" }),
      Object.freeze({ id:"s31_home_market", x:505, y:455, r:120, label:"Market Abandoned Home" }),
      Object.freeze({ id:"s31_home_east", x:765, y:285, r:120, label:"East Abandoned Home" }),
      Object.freeze({ id:"s31_home_river", x:910, y:700, r:120, label:"Riverside Abandoned Home" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s31_survivor_north", x:285, y:270, name:"North Home Survivor", look:"field" }),
      Object.freeze({ id:"s31_survivor_market", x:510, y:465, name:"Market Home Survivor", look:"medic" }),
      Object.freeze({ id:"s31_survivor_east", x:770, y:295, name:"East Home Survivor", look:"scout" }),
      Object.freeze({ id:"s31_survivor_river", x:915, y:710, name:"Riverside Survivor", look:"driver" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s31_alley_scout", name:"Empty Alley Scout", type:"Scout", hpMax:350, baseX:350, baseY:520, rangeX:132, rangeY:98, speed:.95, phase:.4 }),
      Object.freeze({ id:"s31_home_stalker", name:"Abandoned Home Stalker", type:"Stalker", hpMax:430, baseX:625, baseY:340, rangeX:158, rangeY:118, speed:.83, phase:2.2 }),
      Object.freeze({ id:"s31_river_hunter", name:"Riverside Hunter", type:"Standard", hpMax:455, baseX:820, baseY:545, rangeX:146, rangeY:112, speed:.79, phase:3.9 }),
      Object.freeze({ id:"s31_village_guard", name:"Village Ruin Guard", type:"Armored", hpMax:560, baseX:940, baseY:720, rangeX:122, rangeY:100, speed:.64, phase:5.4 }),
    ]),
  }),
  32:Object.freeze({
    level:32, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 32",
    objective:"Patrol the abandoned village streets, clear all six roaming tigers, and extract together.", rescueRequired:0,
    dangerNote:"Street tigers use buildings and intersections to close distance. Their patrol deals 2 extra close-range damage.", aggressionLabel:"Village Street Patrol", hazardDamageBonus:2,
    timeLimitMs:11 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s32_street_1", name:"North Street Scout", type:"Scout", hpMax:330, baseX:230, baseY:350, rangeX:132, rangeY:98, speed:.97, phase:.2 }),
      Object.freeze({ id:"s32_street_2", name:"Market Street Scout", type:"Scout", hpMax:340, baseX:410, baseY:255, rangeX:134, rangeY:100, speed:.98, phase:1.1 }),
      Object.freeze({ id:"s32_street_3", name:"Crossroad Stalker", type:"Stalker", hpMax:420, baseX:600, baseY:465, rangeX:158, rangeY:120, speed:.85, phase:2.2 }),
      Object.freeze({ id:"s32_street_4", name:"East Street Hunter", type:"Standard", hpMax:450, baseX:790, baseY:300, rangeX:148, rangeY:114, speed:.81, phase:3.3 }),
      Object.freeze({ id:"s32_street_5", name:"South Street Hunter", type:"Standard", hpMax:465, baseX:480, baseY:715, rangeX:146, rangeY:112, speed:.82, phase:4.5 }),
      Object.freeze({ id:"s32_street_6", name:"Village Street Guard", type:"Armored", hpMax:575, baseX:940, baseY:710, rangeX:122, rangeY:100, speed:.65, phase:5.7 }),
    ]),
  }),
  33:Object.freeze({
    level:33, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 33",
    objective:"Escort six village survivors through three safe-route checkpoints, clear the tigers, and extract.", rescueRequired:6,
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s33_safe_lane", x:370, y:405, r:130, label:"Marked Safe Lane" }),
      Object.freeze({ id:"s33_clinic_rally", x:650, y:535, r:130, label:"Abandoned Clinic Rally" }),
      Object.freeze({ id:"s33_evac_approach", x:905, y:700, r:130, label:"Survivor Evac Approach" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s33_survivor_1", x:215, y:235, name:"Village Carpenter", look:"field" }),
      Object.freeze({ id:"s33_survivor_2", x:355, y:410, name:"Village Nurse", look:"medic" }),
      Object.freeze({ id:"s33_survivor_3", x:500, y:255, name:"Village Scout", look:"scout" }),
      Object.freeze({ id:"s33_survivor_4", x:645, y:530, name:"Village Driver", look:"driver" }),
      Object.freeze({ id:"s33_survivor_5", x:790, y:285, name:"Village Teacher", look:"field" }),
      Object.freeze({ id:"s33_survivor_6", x:920, y:695, name:"Village Elder", look:"field", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s33_route_scout", name:"Safe Route Scout", type:"Scout", hpMax:355, baseX:305, baseY:455, rangeX:132, rangeY:100, speed:.96, phase:.5 }),
      Object.freeze({ id:"s33_clinic_stalker", name:"Clinic Stalker", type:"Stalker", hpMax:435, baseX:565, baseY:340, rangeX:158, rangeY:120, speed:.84, phase:2.1 }),
      Object.freeze({ id:"s33_evac_hunter", name:"Evac Route Hunter", type:"Standard", hpMax:470, baseX:800, baseY:525, rangeX:148, rangeY:114, speed:.80, phase:3.8 }),
      Object.freeze({ id:"s33_route_guard", name:"Safe Zone Guard", type:"Armored", hpMax:580, baseX:935, baseY:715, rangeX:124, rangeY:102, speed:.65, phase:5.3 }),
    ]),
  }),
  34:Object.freeze({
    level:34, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 34",
    objective:"Use Rubber ammunition to capture three tigers alive for the village study, clear the remaining threats, and extract.", rescueRequired:0, captureRequired:3,
    dangerNote:"Three live captures are mandatory. Real ammunition permanently disqualifies the tiger it hits from the study.", aggressionLabel:"Triple Research Capture",
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s34_sample_scout", name:"Village Sample Scout", type:"Scout", hpMax:350, baseX:260, baseY:370, rangeX:132, rangeY:100, speed:.95, phase:.3 }),
      Object.freeze({ id:"s34_sample_stalker", name:"Village Sample Stalker", type:"Stalker", hpMax:430, baseX:455, baseY:270, rangeX:158, rangeY:120, speed:.84, phase:1.5 }),
      Object.freeze({ id:"s34_sample_tiger", name:"Village Sample Tiger", type:"Standard", hpMax:460, baseX:650, baseY:510, rangeX:150, rangeY:114, speed:.80, phase:2.8 }),
      Object.freeze({ id:"s34_sample_hunter", name:"Village Sample Hunter", type:"Standard", hpMax:475, baseX:825, baseY:350, rangeX:148, rangeY:114, speed:.81, phase:4.1 }),
      Object.freeze({ id:"s34_sample_guard", name:"Village Sample Guard", type:"Armored", hpMax:590, baseX:940, baseY:710, rangeX:124, rangeY:102, speed:.65, phase:5.5 }),
    ]),
  }),
  35:Object.freeze({
    level:35, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 35",
    objective:"Rescue the five-person evacuation convoy, secure its three route checkpoints, clear the ambush, and extract.", rescueRequired:5,
    dangerNote:"The convoy route is under a coordinated ambush. Both soldiers must secure every checkpoint before the vehicles can advance.", aggressionLabel:"Evacuation Convoy Ambush", hazardDamageBonus:2,
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s35_convoy_rally", x:370, y:520, r:130, label:"Convoy Rally Point" }),
      Object.freeze({ id:"s35_convoy_crossroad", x:650, y:520, r:130, label:"Convoy Crossroad" }),
      Object.freeze({ id:"s35_convoy_exit", x:900, y:690, r:130, label:"Convoy Exit Lane" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s35_convoy_driver", x:235, y:285, name:"Evacuation Driver", look:"driver", vip:true }),
      Object.freeze({ id:"s35_convoy_medic", x:420, y:495, name:"Evacuation Medic", look:"medic" }),
      Object.freeze({ id:"s35_convoy_guard", x:590, y:275, name:"Convoy Guard", look:"scout" }),
      Object.freeze({ id:"s35_convoy_mechanic", x:775, y:510, name:"Convoy Mechanic", look:"field" }),
      Object.freeze({ id:"s35_convoy_dispatcher", x:925, y:690, name:"Evacuation Dispatcher", look:"field" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s35_road_scout", name:"Convoy Road Scout", type:"Scout", hpMax:365, baseX:285, baseY:430, rangeX:134, rangeY:100, speed:.97, phase:.4 }),
      Object.freeze({ id:"s35_wreck_stalker", name:"Convoy Wreck Stalker", type:"Stalker", hpMax:445, baseX:475, baseY:315, rangeX:160, rangeY:120, speed:.85, phase:1.8 }),
      Object.freeze({ id:"s35_cargo_hunter", name:"Evacuation Cargo Hunter", type:"Standard", hpMax:475, baseX:675, baseY:525, rangeX:150, rangeY:114, speed:.81, phase:3.0 }),
      Object.freeze({ id:"s35_exit_mauler", name:"Exit Lane Mauler", type:"Standard", hpMax:490, baseX:835, baseY:365, rangeX:148, rangeY:114, speed:.81, phase:4.3 }),
      Object.freeze({ id:"s35_convoy_guard_tiger", name:"Convoy Breaker", type:"Armored", hpMax:605, baseX:945, baseY:715, rangeX:126, rangeY:102, speed:.66, phase:5.6 }),
    ]),
  }),
  36:Object.freeze({
    level:36, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 36",
    objective:"Protect Doctor Imani while both soldiers collect samples at three research sites, clear the tigers, and extract.", rescueRequired:1,
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s36_sample_north", x:375, y:390, r:125, label:"North Sample Site" }),
      Object.freeze({ id:"s36_sample_center", x:650, y:520, r:125, label:"Center Sample Site" }),
      Object.freeze({ id:"s36_sample_east", x:890, y:680, r:125, label:"East Sample Site" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s36_doctor_imani", x:540, y:300, name:"Doctor Imani", look:"medic", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s36_sample_scout", name:"Sample Site Scout", type:"Scout", hpMax:370, baseX:305, baseY:455, rangeX:134, rangeY:100, speed:.97, phase:.5 }),
      Object.freeze({ id:"s36_scientist_stalker", name:"Scientist Stalker", type:"Stalker", hpMax:450, baseX:570, baseY:350, rangeX:160, rangeY:122, speed:.85, phase:2.2 }),
      Object.freeze({ id:"s36_research_hunter", name:"Research Site Hunter", type:"Standard", hpMax:485, baseX:800, baseY:520, rangeX:150, rangeY:116, speed:.81, phase:3.8 }),
      Object.freeze({ id:"s36_sample_guard", name:"Research Guard Tiger", type:"Armored", hpMax:615, baseX:935, baseY:710, rangeX:126, rangeY:104, speed:.66, phase:5.2 }),
    ]),
  }),
  37:Object.freeze({
    level:37, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 37",
    objective:"Escort six civilians through the burning village route, avoid the fire zones, clear the tigers, and extract.", rescueRequired:6,
    dangerNote:"Burning-building zones deal 8 damage every 1.4 seconds. Follow the marked route around the flames and keep the civilians moving.", aggressionLabel:"Burning Village", fireHazardDamage:8, fireHazardCooldownMs:1400,
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    fireZones:Object.freeze([
      Object.freeze({ id:"s37_fire_north", x:350, y:300, r:72, label:"North House Fire" }),
      Object.freeze({ id:"s37_fire_market", x:570, y:465, r:80, label:"Market Fire" }),
      Object.freeze({ id:"s37_fire_east", x:800, y:320, r:74, label:"East Block Fire" }),
      Object.freeze({ id:"s37_fire_south", x:735, y:680, r:82, label:"South Block Fire" }),
    ]),
    checkpoints:Object.freeze([
      Object.freeze({ id:"s37_fire_route_1", x:390, y:520, r:125, label:"Clear Fire Lane" }),
      Object.freeze({ id:"s37_fire_route_2", x:670, y:575, r:125, label:"Burning Market Bypass" }),
      Object.freeze({ id:"s37_fire_route_3", x:910, y:705, r:125, label:"Fire Rescue Exit" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s37_civilian_1", x:205, y:235, name:"North Block Survivor", look:"field" }),
      Object.freeze({ id:"s37_civilian_2", x:350, y:475, name:"Market Survivor", look:"medic" }),
      Object.freeze({ id:"s37_civilian_3", x:495, y:260, name:"Village Fire Warden", look:"scout", vip:true }),
      Object.freeze({ id:"s37_civilian_4", x:640, y:545, name:"East Block Survivor", look:"driver" }),
      Object.freeze({ id:"s37_civilian_5", x:785, y:275, name:"School Survivor", look:"field" }),
      Object.freeze({ id:"s37_civilian_6", x:925, y:690, name:"South Block Survivor", look:"field" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s37_smoke_scout", name:"Smoke Scout", type:"Scout", hpMax:370, baseX:285, baseY:430, rangeX:134, rangeY:100, speed:.98, phase:.4 }),
      Object.freeze({ id:"s37_flame_stalker", name:"Flame Stalker", type:"Stalker", hpMax:455, baseX:475, baseY:320, rangeX:160, rangeY:122, speed:.86, phase:1.8 }),
      Object.freeze({ id:"s37_market_hunter", name:"Burning Market Hunter", type:"Standard", hpMax:490, baseX:675, baseY:525, rangeX:152, rangeY:116, speed:.82, phase:3.0 }),
      Object.freeze({ id:"s37_ember_mauler", name:"Ember Mauler", type:"Standard", hpMax:505, baseX:835, baseY:370, rangeX:150, rangeY:114, speed:.82, phase:4.3 }),
      Object.freeze({ id:"s37_fire_guard", name:"Burning Village Guard", type:"Armored", hpMax:625, baseX:945, baseY:715, rangeX:126, rangeY:104, speed:.67, phase:5.6 }),
    ]),
  }),
  38:Object.freeze({
    level:38, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 38",
    objective:"Hold the town center against the ten-tiger swarm, clear every threat, and extract together.", rescueRequired:0,
    dangerNote:"Ten tigers converge on the town center with a faster attack cycle and 4 extra close-range damage.", aggressionLabel:"Town Center Swarm", hazardDamageBonus:4, hazardCooldownMs:825,
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s38_swarm_1", name:"Town Scout One", type:"Scout", hpMax:320, baseX:205, baseY:335, rangeX:132, rangeY:100, speed:1.00, phase:.1 }),
      Object.freeze({ id:"s38_swarm_2", name:"Town Scout Two", type:"Scout", hpMax:330, baseX:360, baseY:245, rangeX:134, rangeY:100, speed:1.01, phase:.8 }),
      Object.freeze({ id:"s38_swarm_3", name:"Town Scout Three", type:"Scout", hpMax:340, baseX:515, baseY:400, rangeX:136, rangeY:102, speed:1.02, phase:1.5 }),
      Object.freeze({ id:"s38_swarm_4", name:"Town Stalker One", type:"Stalker", hpMax:415, baseX:670, baseY:275, rangeX:160, rangeY:122, speed:.88, phase:2.2 }),
      Object.freeze({ id:"s38_swarm_5", name:"Town Stalker Two", type:"Stalker", hpMax:425, baseX:830, baseY:420, rangeX:160, rangeY:122, speed:.89, phase:2.9 }),
      Object.freeze({ id:"s38_swarm_6", name:"Town Hunter One", type:"Standard", hpMax:460, baseX:950, baseY:290, rangeX:150, rangeY:116, speed:.84, phase:3.6 }),
      Object.freeze({ id:"s38_swarm_7", name:"Town Hunter Two", type:"Standard", hpMax:470, baseX:300, baseY:700, rangeX:150, rangeY:116, speed:.85, phase:4.3 }),
      Object.freeze({ id:"s38_swarm_8", name:"Town Hunter Three", type:"Standard", hpMax:480, baseX:550, baseY:735, rangeX:152, rangeY:118, speed:.85, phase:5.0 }),
      Object.freeze({ id:"s38_swarm_9", name:"Town Guard One", type:"Armored", hpMax:570, baseX:760, baseY:690, rangeX:126, rangeY:104, speed:.69, phase:5.7 }),
      Object.freeze({ id:"s38_swarm_10", name:"Town Guard Two", type:"Armored", hpMax:590, baseX:955, baseY:720, rangeX:128, rangeY:104, speed:.70, phase:6.4 }),
    ]),
  }),
  39:Object.freeze({
    level:39, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 39",
    objective:"Survive the massive twelve-tiger village pack, clear every threat, and reach extraction together.", rescueRequired:0,
    dangerNote:"Twelve coordinated tigers hunt across the village. The pack begins with 5 extra damage and attacks faster at close range.", aggressionLabel:"Massive Village Pack", hazardDamageBonus:5, hazardCooldownMs:775,
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s39_pack_1", name:"Massive Pack Scout One", type:"Scout", hpMax:320, baseX:185, baseY:300, rangeX:132, rangeY:100, speed:1.02, phase:.1 }),
      Object.freeze({ id:"s39_pack_2", name:"Massive Pack Scout Two", type:"Scout", hpMax:330, baseX:335, baseY:420, rangeX:134, rangeY:102, speed:1.03, phase:.7 }),
      Object.freeze({ id:"s39_pack_3", name:"Massive Pack Scout Three", type:"Scout", hpMax:340, baseX:470, baseY:245, rangeX:136, rangeY:102, speed:1.04, phase:1.3 }),
      Object.freeze({ id:"s39_pack_4", name:"Massive Pack Stalker One", type:"Stalker", hpMax:420, baseX:600, baseY:430, rangeX:162, rangeY:124, speed:.90, phase:1.9 }),
      Object.freeze({ id:"s39_pack_5", name:"Massive Pack Stalker Two", type:"Stalker", hpMax:430, baseX:740, baseY:260, rangeX:162, rangeY:124, speed:.91, phase:2.5 }),
      Object.freeze({ id:"s39_pack_6", name:"Massive Pack Stalker Three", type:"Stalker", hpMax:440, baseX:875, baseY:430, rangeX:164, rangeY:126, speed:.92, phase:3.1 }),
      Object.freeze({ id:"s39_pack_7", name:"Massive Pack Hunter One", type:"Standard", hpMax:470, baseX:955, baseY:275, rangeX:152, rangeY:118, speed:.86, phase:3.7 }),
      Object.freeze({ id:"s39_pack_8", name:"Massive Pack Hunter Two", type:"Standard", hpMax:480, baseX:260, baseY:710, rangeX:152, rangeY:118, speed:.87, phase:4.3 }),
      Object.freeze({ id:"s39_pack_9", name:"Massive Pack Hunter Three", type:"Standard", hpMax:490, baseX:470, baseY:735, rangeX:154, rangeY:120, speed:.87, phase:4.9 }),
      Object.freeze({ id:"s39_pack_10", name:"Massive Pack Hunter Four", type:"Standard", hpMax:500, baseX:670, baseY:690, rangeX:154, rangeY:120, speed:.88, phase:5.5 }),
      Object.freeze({ id:"s39_pack_11", name:"Massive Pack Guard One", type:"Armored", hpMax:600, baseX:830, baseY:735, rangeX:128, rangeY:106, speed:.71, phase:6.1 }),
      Object.freeze({ id:"s39_pack_12", name:"Massive Pack Guard Two", type:"Armored", hpMax:620, baseX:960, baseY:700, rangeX:130, rangeY:106, speed:.72, phase:6.7 }),
    ]),
  }),
  40:Object.freeze({
    level:40, chapter:4, chapterName:"Abandoned Villages", title:"Story Mission 40",
    objective:"Defeat or capture both Twin Alpha Tigers, then extract together to finish Chapter 4.", rescueRequired:0,
    dangerNote:"Ashclaw and Ruinstripe hunt as a pair. When one twin falls, its death adds 3 damage to the surviving Alpha.", aggressionLabel:"Twin Alpha Bosses", hazardDamageBonus:4, aggressionPerKill:3, hazardCooldownMs:850,
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s40_ashclaw_alpha", name:"Ashclaw Alpha", type:"Alpha", hpMax:1850, baseX:500, baseY:525, rangeX:205, rangeY:158, speed:.58, phase:.7, boss:true }),
      Object.freeze({ id:"s40_ruinstripe_alpha", name:"Ruinstripe Alpha", type:"Alpha", hpMax:1850, baseX:795, baseY:545, rangeX:205, rangeY:158, speed:.59, phase:3.6, boss:true }),
    ]),
  }),
  41:Object.freeze({
    level:41, chapter:5, chapterName:"River Territory", title:"Story Mission 41",
    objective:"Escort six civilians across the broken bridge, secure all three crossing checkpoints, clear the river tigers, and extract together.", rescueRequired:6,
    dangerNote:"The center bridge is broken. Keep both soldiers and the civilians on the marked plank route across the river.", aggressionLabel:"Broken Bridge Crossing",
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.58,
    waterZones:Object.freeze([Object.freeze({ id:"s41_river", x:555, y:545, rx:520, ry:105, label:"Broken Bridge River" })]),
    checkpoints:Object.freeze([
      Object.freeze({ id:"s41_bridge_entry", x:305, y:500, r:125, label:"Broken Bridge Entry" }),
      Object.freeze({ id:"s41_plank_crossing", x:555, y:545, r:115, label:"Emergency Plank Crossing" }),
      Object.freeze({ id:"s41_far_bank", x:830, y:600, r:125, label:"Far Riverbank Rally" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s41_civilian_1", x:205, y:245, name:"Bridge Engineer", look:"scout", vip:true }),
      Object.freeze({ id:"s41_civilian_2", x:315, y:390, name:"River Farmer", look:"field" }),
      Object.freeze({ id:"s41_civilian_3", x:430, y:260, name:"Village Nurse", look:"medic" }),
      Object.freeze({ id:"s41_civilian_4", x:560, y:420, name:"Boat Mechanic", look:"driver" }),
      Object.freeze({ id:"s41_civilian_5", x:710, y:270, name:"Fisher", look:"field" }),
      Object.freeze({ id:"s41_civilian_6", x:865, y:430, name:"River Guide", look:"scout" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s41_bank_scout", name:"Broken Bank Scout", type:"Scout", hpMax:385, baseX:300, baseY:455, rangeX:140, rangeY:102, speed:.99, phase:.4 }),
      Object.freeze({ id:"s41_bridge_stalker", name:"Bridge Plank Stalker", type:"Stalker", hpMax:465, baseX:545, baseY:540, rangeX:165, rangeY:120, speed:.87, phase:2.0 }),
      Object.freeze({ id:"s41_far_bank_hunter", name:"Far Bank Hunter", type:"Standard", hpMax:505, baseX:785, baseY:590, rangeX:152, rangeY:116, speed:.83, phase:3.7 }),
      Object.freeze({ id:"s41_crossing_guard", name:"Broken Bridge Guard", type:"Armored", hpMax:640, baseX:945, baseY:710, rangeX:130, rangeY:106, speed:.68, phase:5.4 }),
    ]),
  }),
  42:Object.freeze({
    level:42, chapter:5, chapterName:"River Territory", title:"Story Mission 42",
    objective:"Clear all seven tigers attacking the riverbank and extract together.", rescueRequired:0,
    dangerNote:"Riverbank tigers use reeds and shallow water to close distance. Water slows both soldiers while the pack keeps full speed.", aggressionLabel:"Riverbank Attack", hazardDamageBonus:2,
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.60,
    waterZones:Object.freeze([Object.freeze({ id:"s42_riverbank", x:565, y:590, rx:525, ry:125, label:"Riverbank Shallows" })]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s42_bank_1", name:"West Bank Scout", type:"Scout", hpMax:350, baseX:205, baseY:420, rangeX:138, rangeY:102, speed:1.00, phase:.2 }),
      Object.freeze({ id:"s42_bank_2", name:"Reed Scout", type:"Scout", hpMax:360, baseX:360, baseY:585, rangeX:140, rangeY:104, speed:1.01, phase:1.0 }),
      Object.freeze({ id:"s42_bank_3", name:"Shallow Stalker", type:"Stalker", hpMax:440, baseX:505, baseY:430, rangeX:164, rangeY:122, speed:.88, phase:1.9 }),
      Object.freeze({ id:"s42_bank_4", name:"Riverbank Stalker", type:"Stalker", hpMax:450, baseX:650, baseY:605, rangeX:164, rangeY:122, speed:.89, phase:2.8 }),
      Object.freeze({ id:"s42_bank_5", name:"East Bank Hunter", type:"Standard", hpMax:490, baseX:790, baseY:445, rangeX:152, rangeY:116, speed:.84, phase:3.7 }),
      Object.freeze({ id:"s42_bank_6", name:"Delta Hunter", type:"Standard", hpMax:505, baseX:910, baseY:610, rangeX:154, rangeY:118, speed:.85, phase:4.6 }),
      Object.freeze({ id:"s42_bank_7", name:"Riverbank Guard", type:"Armored", hpMax:625, baseX:965, baseY:725, rangeX:130, rangeY:106, speed:.69, phase:5.5 }),
    ]),
  }),
  43:Object.freeze({
    level:43, chapter:5, chapterName:"River Territory", title:"Story Mission 43",
    objective:"Use Rubber ammunition to capture the named River Tiger alive, clear its guards, and extract together.", rescueRequired:0, captureRequired:1,
    captureTargetIds:Object.freeze(["s43_currentstripe"]),
    dangerNote:"Currentstripe must be captured alive. A Real-ammo hit permanently disqualifies it from this research mission.", aggressionLabel:"River Tiger Capture",
    timeLimitMs:12 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.62,
    waterZones:Object.freeze([Object.freeze({ id:"s43_capture_pool", x:610, y:520, rx:315, ry:150, label:"Currentstripe Pool" })]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s43_reed_scout", name:"Currentstripe Scout", type:"Scout", hpMax:380, baseX:330, baseY:390, rangeX:140, rangeY:104, speed:.99, phase:.5 }),
      Object.freeze({ id:"s43_currentstripe", name:"Currentstripe River Tiger", type:"Standard", hpMax:760, baseX:610, baseY:520, rangeX:185, rangeY:140, speed:.82, phase:2.2 }),
      Object.freeze({ id:"s43_pool_stalker", name:"Capture Pool Stalker", type:"Stalker", hpMax:475, baseX:790, baseY:390, rangeX:166, rangeY:124, speed:.88, phase:3.8 }),
      Object.freeze({ id:"s43_bank_guard", name:"River Study Guard", type:"Armored", hpMax:650, baseX:945, baseY:710, rangeX:130, rangeY:106, speed:.69, phase:5.4 }),
    ]),
  }),
  44:Object.freeze({
    level:44, chapter:5, chapterName:"River Territory", title:"Story Mission 44",
    objective:"Rescue the wounded villager, escort them across the water through three safe crossings, clear the tigers, and extract.", rescueRequired:1,
    dangerNote:"The wounded villager follows slowly. Both soldiers must secure every shallow-water crossing before the escort can continue.", aggressionLabel:"Wounded Water Escort",
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.52,
    waterZones:Object.freeze([Object.freeze({ id:"s44_floodwater", x:575, y:550, rx:525, ry:135, label:"Flooded Crossing" })]),
    checkpoints:Object.freeze([
      Object.freeze({ id:"s44_shallow_entry", x:330, y:500, r:125, label:"Shallow Water Entry" }),
      Object.freeze({ id:"s44_midstream", x:585, y:555, r:120, label:"Midstream Safety Point" }),
      Object.freeze({ id:"s44_dry_bank", x:855, y:625, r:125, label:"Dry Bank Medical Rally" }),
    ]),
    civilians:Object.freeze([Object.freeze({ id:"s44_wounded_villager", x:245, y:320, name:"Wounded River Villager", look:"medic", vip:true, injured:true })]),
    tigers:Object.freeze([
      Object.freeze({ id:"s44_water_scout", name:"Floodwater Scout", type:"Scout", hpMax:390, baseX:340, baseY:480, rangeX:142, rangeY:104, speed:1.00, phase:.4 }),
      Object.freeze({ id:"s44_crossing_stalker", name:"Crossing Stalker", type:"Stalker", hpMax:475, baseX:590, baseY:555, rangeX:166, rangeY:124, speed:.88, phase:2.1 }),
      Object.freeze({ id:"s44_bank_hunter", name:"Medical Route Hunter", type:"Standard", hpMax:515, baseX:820, baseY:615, rangeX:154, rangeY:118, speed:.84, phase:3.8 }),
      Object.freeze({ id:"s44_rescue_guard", name:"Wounded Escort Guard", type:"Armored", hpMax:655, baseX:950, baseY:720, rangeX:130, rangeY:106, speed:.69, phase:5.4 }),
    ]),
  }),
  45:Object.freeze({
    level:45, chapter:5, chapterName:"River Territory", title:"Story Mission 45",
    objective:"Break the eight-tiger crossing ambush, secure all three river checkpoints, and extract together.", rescueRequired:0,
    dangerNote:"The ambush attacks from both banks while the current slows soldiers in the water. Secure the crossing in order.", aggressionLabel:"River Crossing Ambush", hazardDamageBonus:3, hazardCooldownMs:875,
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.56,
    waterZones:Object.freeze([Object.freeze({ id:"s45_ambush_current", x:560, y:535, rx:525, ry:125, label:"Ambush Current" })]),
    checkpoints:Object.freeze([
      Object.freeze({ id:"s45_west_bank", x:305, y:470, r:125, label:"West Bank Defense" }),
      Object.freeze({ id:"s45_crossing_center", x:560, y:535, r:120, label:"Crossing Center" }),
      Object.freeze({ id:"s45_east_bank", x:845, y:610, r:125, label:"East Bank Defense" }),
    ]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s45_ambush_1", name:"West Bank Scout", type:"Scout", hpMax:350, baseX:205, baseY:410, rangeX:138, rangeY:102, speed:1.01, phase:.1 }),
      Object.freeze({ id:"s45_ambush_2", name:"Reed Scout", type:"Scout", hpMax:360, baseX:355, baseY:590, rangeX:140, rangeY:104, speed:1.02, phase:.9 }),
      Object.freeze({ id:"s45_ambush_3", name:"Current Stalker One", type:"Stalker", hpMax:440, baseX:500, baseY:430, rangeX:164, rangeY:122, speed:.89, phase:1.7 }),
      Object.freeze({ id:"s45_ambush_4", name:"Current Stalker Two", type:"Stalker", hpMax:450, baseX:640, baseY:605, rangeX:166, rangeY:124, speed:.90, phase:2.5 }),
      Object.freeze({ id:"s45_ambush_5", name:"East Bank Hunter One", type:"Standard", hpMax:485, baseX:770, baseY:445, rangeX:152, rangeY:116, speed:.85, phase:3.3 }),
      Object.freeze({ id:"s45_ambush_6", name:"East Bank Hunter Two", type:"Standard", hpMax:495, baseX:885, baseY:610, rangeX:154, rangeY:118, speed:.86, phase:4.1 }),
      Object.freeze({ id:"s45_ambush_7", name:"Crossing Guard One", type:"Armored", hpMax:600, baseX:420, baseY:700, rangeX:130, rangeY:106, speed:.70, phase:4.9 }),
      Object.freeze({ id:"s45_ambush_8", name:"Crossing Guard Two", type:"Armored", hpMax:620, baseX:960, baseY:720, rangeX:132, rangeY:108, speed:.71, phase:5.7 }),
    ]),
  }),
  46:Object.freeze({
    level:46, chapter:5, chapterName:"River Territory", title:"Story Mission 46",
    objective:"Protect the four-person supply convoy, secure its three river-road checkpoints, clear the attackers, and extract.", rescueRequired:4,
    dangerNote:"The supply trucks cannot advance until both soldiers secure each flooded road checkpoint.", aggressionLabel:"River Supply Convoy", hazardDamageBonus:2,
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.64,
    waterZones:Object.freeze([Object.freeze({ id:"s46_flooded_road", x:580, y:585, rx:510, ry:95, label:"Flooded Convoy Road" })]),
    checkpoints:Object.freeze([
      Object.freeze({ id:"s46_supply_rally", x:340, y:455, r:130, label:"Supply Convoy Rally" }),
      Object.freeze({ id:"s46_flooded_road", x:615, y:555, r:130, label:"Flooded Road Crossing" }),
      Object.freeze({ id:"s46_river_depot", x:895, y:680, r:130, label:"River Supply Depot" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s46_driver", x:230, y:275, name:"Supply Driver", look:"driver", vip:true }),
      Object.freeze({ id:"s46_medic", x:430, y:425, name:"Convoy Medic", look:"medic" }),
      Object.freeze({ id:"s46_guard", x:650, y:300, name:"Supply Guard", look:"scout" }),
      Object.freeze({ id:"s46_mechanic", x:850, y:520, name:"Truck Mechanic", look:"field" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s46_road_scout", name:"Flooded Road Scout", type:"Scout", hpMax:395, baseX:300, baseY:430, rangeX:142, rangeY:104, speed:1.00, phase:.4 }),
      Object.freeze({ id:"s46_supply_stalker", name:"Supply Stalker", type:"Stalker", hpMax:480, baseX:510, baseY:335, rangeX:166, rangeY:124, speed:.89, phase:1.8 }),
      Object.freeze({ id:"s46_convoy_hunter", name:"Convoy Hunter", type:"Standard", hpMax:520, baseX:700, baseY:560, rangeX:154, rangeY:118, speed:.85, phase:3.0 }),
      Object.freeze({ id:"s46_depot_mauler", name:"River Depot Mauler", type:"Standard", hpMax:535, baseX:855, baseY:390, rangeX:154, rangeY:118, speed:.86, phase:4.2 }),
      Object.freeze({ id:"s46_supply_guard_tiger", name:"Supply Route Guard", type:"Armored", hpMax:670, baseX:950, baseY:715, rangeX:132, rangeY:108, speed:.70, phase:5.5 }),
    ]),
  }),
  47:Object.freeze({
    level:47, chapter:5, chapterName:"River Territory", title:"Story Mission 47",
    objective:"Escort seven civilians through the river-camp route, clear every tiger, and reach camp extraction together.", rescueRequired:7,
    dangerNote:"Keep the group together through the flooded approach and secure all three camp checkpoints.", aggressionLabel:"River Camp Escort",
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.62,
    waterZones:Object.freeze([Object.freeze({ id:"s47_camp_approach", x:600, y:585, rx:510, ry:110, label:"River Camp Approach" })]),
    checkpoints:Object.freeze([
      Object.freeze({ id:"s47_trail_marker", x:350, y:440, r:130, label:"River Trail Marker" }),
      Object.freeze({ id:"s47_camp_approach", x:640, y:555, r:130, label:"River Camp Approach" }),
      Object.freeze({ id:"s47_camp_gate", x:910, y:690, r:130, label:"River Camp Gate" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s47_civilian_1", x:195, y:230, name:"River Camp Cook", look:"field" }),
      Object.freeze({ id:"s47_civilian_2", x:315, y:390, name:"Camp Nurse", look:"medic" }),
      Object.freeze({ id:"s47_civilian_3", x:440, y:245, name:"Boat Scout", look:"scout" }),
      Object.freeze({ id:"s47_civilian_4", x:560, y:420, name:"Camp Driver", look:"driver" }),
      Object.freeze({ id:"s47_civilian_5", x:690, y:265, name:"River Worker", look:"field" }),
      Object.freeze({ id:"s47_civilian_6", x:815, y:505, name:"Camp Medic", look:"medic" }),
      Object.freeze({ id:"s47_civilian_7", x:930, y:690, name:"River Camp Leader", look:"scout", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s47_camp_scout", name:"Camp Trail Scout", type:"Scout", hpMax:400, baseX:285, baseY:430, rangeX:142, rangeY:104, speed:1.00, phase:.4 }),
      Object.freeze({ id:"s47_approach_stalker", name:"Camp Approach Stalker", type:"Stalker", hpMax:485, baseX:505, baseY:335, rangeX:166, rangeY:124, speed:.89, phase:1.9 }),
      Object.freeze({ id:"s47_river_hunter", name:"River Camp Hunter", type:"Standard", hpMax:525, baseX:700, baseY:545, rangeX:154, rangeY:118, speed:.85, phase:3.1 }),
      Object.freeze({ id:"s47_gate_mauler", name:"Camp Gate Mauler", type:"Standard", hpMax:540, baseX:850, baseY:385, rangeX:154, rangeY:118, speed:.86, phase:4.3 }),
      Object.freeze({ id:"s47_camp_guard", name:"River Camp Guard", type:"Armored", hpMax:680, baseX:950, baseY:715, rangeX:132, rangeY:108, speed:.70, phase:5.6 }),
    ]),
  }),
  48:Object.freeze({
    level:48, chapter:5, chapterName:"River Territory", title:"Story Mission 48",
    objective:"Rescue the four-person boat crew, defend the rescue boat from seven tigers, and board the boat extraction together.", rescueRequired:4,
    extractionType:"boat",
    dangerNote:"The rescue boat waits in the river. Clear the attack, escort its crew back aboard, and put both soldiers inside the boat zone.", aggressionLabel:"Rescue Boat Defense", hazardDamageBonus:3,
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.58,
    waterZones:Object.freeze([Object.freeze({ id:"s48_boat_channel", x:615, y:650, rx:525, ry:150, label:"Rescue Boat Channel" })]),
    civilians:Object.freeze([
      Object.freeze({ id:"s48_captain", x:260, y:310, name:"Rescue Boat Captain", look:"driver", vip:true }),
      Object.freeze({ id:"s48_medic", x:465, y:440, name:"Boat Medic", look:"medic" }),
      Object.freeze({ id:"s48_deckhand", x:690, y:315, name:"Rescue Deckhand", look:"field" }),
      Object.freeze({ id:"s48_radio", x:865, y:535, name:"Marine Radio Operator", look:"scout" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s48_boat_1", name:"Dock Scout", type:"Scout", hpMax:370, baseX:210, baseY:430, rangeX:140, rangeY:104, speed:1.01, phase:.2 }),
      Object.freeze({ id:"s48_boat_2", name:"Channel Scout", type:"Scout", hpMax:380, baseX:365, baseY:620, rangeX:142, rangeY:104, speed:1.02, phase:1.0 }),
      Object.freeze({ id:"s48_boat_3", name:"Dock Stalker", type:"Stalker", hpMax:460, baseX:520, baseY:445, rangeX:166, rangeY:124, speed:.90, phase:1.8 }),
      Object.freeze({ id:"s48_boat_4", name:"Channel Stalker", type:"Stalker", hpMax:470, baseX:665, baseY:625, rangeX:168, rangeY:126, speed:.91, phase:2.6 }),
      Object.freeze({ id:"s48_boat_5", name:"Rescue Boat Hunter", type:"Standard", hpMax:510, baseX:800, baseY:455, rangeX:154, rangeY:118, speed:.86, phase:3.4 }),
      Object.freeze({ id:"s48_boat_6", name:"River Dock Hunter", type:"Standard", hpMax:525, baseX:910, baseY:625, rangeX:156, rangeY:120, speed:.87, phase:4.2 }),
      Object.freeze({ id:"s48_boat_7", name:"Boat Channel Guard", type:"Armored", hpMax:660, baseX:965, baseY:735, rangeX:132, rangeY:108, speed:.71, phase:5.0 }),
    ]),
  }),
  49:Object.freeze({
    level:49, chapter:5, chapterName:"River Territory", title:"Story Mission 49",
    objective:"Survive the eleven-tiger river-delta pack, clear every threat, and extract together.", rescueRequired:0,
    dangerNote:"Eleven coordinated tigers attack from delta islands and both banks. The pack begins with 5 extra damage and a faster attack cycle.", aggressionLabel:"River Delta Pack", hazardDamageBonus:5, hazardCooldownMs:775,
    timeLimitMs:15 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.60,
    waterZones:Object.freeze([
      Object.freeze({ id:"s49_delta_west", x:350, y:520, rx:265, ry:120, label:"West Delta Channel" }),
      Object.freeze({ id:"s49_delta_east", x:790, y:600, rx:290, ry:130, label:"East Delta Channel" }),
    ]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s49_pack_1", name:"Delta Scout One", type:"Scout", hpMax:340, baseX:175, baseY:310, rangeX:138, rangeY:102, speed:1.03, phase:.1 }),
      Object.freeze({ id:"s49_pack_2", name:"Delta Scout Two", type:"Scout", hpMax:350, baseX:315, baseY:500, rangeX:140, rangeY:104, speed:1.04, phase:.7 }),
      Object.freeze({ id:"s49_pack_3", name:"Delta Scout Three", type:"Scout", hpMax:360, baseX:450, baseY:285, rangeX:142, rangeY:104, speed:1.05, phase:1.3 }),
      Object.freeze({ id:"s49_pack_4", name:"Delta Stalker One", type:"Stalker", hpMax:440, baseX:570, baseY:520, rangeX:166, rangeY:124, speed:.91, phase:1.9 }),
      Object.freeze({ id:"s49_pack_5", name:"Delta Stalker Two", type:"Stalker", hpMax:450, baseX:700, baseY:300, rangeX:168, rangeY:126, speed:.92, phase:2.5 }),
      Object.freeze({ id:"s49_pack_6", name:"Delta Stalker Three", type:"Stalker", hpMax:460, baseX:825, baseY:540, rangeX:170, rangeY:126, speed:.93, phase:3.1 }),
      Object.freeze({ id:"s49_pack_7", name:"Delta Hunter One", type:"Standard", hpMax:500, baseX:945, baseY:315, rangeX:156, rangeY:120, speed:.87, phase:3.7 }),
      Object.freeze({ id:"s49_pack_8", name:"Delta Hunter Two", type:"Standard", hpMax:510, baseX:275, baseY:710, rangeX:156, rangeY:120, speed:.88, phase:4.3 }),
      Object.freeze({ id:"s49_pack_9", name:"Delta Hunter Three", type:"Standard", hpMax:520, baseX:535, baseY:725, rangeX:158, rangeY:122, speed:.88, phase:4.9 }),
      Object.freeze({ id:"s49_pack_10", name:"Delta Guard One", type:"Armored", hpMax:640, baseX:770, baseY:700, rangeX:132, rangeY:108, speed:.72, phase:5.5 }),
      Object.freeze({ id:"s49_pack_11", name:"Delta Guard Two", type:"Armored", hpMax:660, baseX:960, baseY:715, rangeX:134, rangeY:110, speed:.73, phase:6.1 }),
    ]),
  }),
  50:Object.freeze({
    level:50, chapter:5, chapterName:"River Territory", title:"Story Mission 50",
    objective:"Defeat or capture the Giant River Tiger, then reach river extraction together to finish Chapter 5.", rescueRequired:0,
    dangerNote:"The Giant River Tiger hits with tidal force near the water and enters River Rage below 35% health.", aggressionLabel:"Giant River Tiger Boss", hazardDamageBonus:5, hazardCooldownMs:850,
    timeLimitMs:15 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    waterSlowMultiplier:.58,
    waterZones:Object.freeze([Object.freeze({ id:"s50_boss_channel", x:645, y:555, rx:430, ry:165, label:"Giant Tiger Channel" })]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s50_giant_river_tiger", name:"Giant River Tiger", type:"Alpha", hpMax:2850, baseX:650, baseY:555, rangeX:235, rangeY:175, speed:.57, phase:1.4, boss:true, bloodRage:true }),
    ]),
  }),
  51:Object.freeze({
    level:51, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 51",
    objective:"Escort six mountain villagers through three ridge checkpoints, clear the tigers, and extract together.", rescueRequired:6,
    dangerNote:"Stay on the marked ridge trail. Both soldiers must reach every checkpoint before the villagers can continue.", aggressionLabel:"Mountain Village Escort",
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s51_ridge_entry", x:335, y:420, r:125, label:"Lower Ridge Entry" }),
      Object.freeze({ id:"s51_mountain_pass", x:610, y:515, r:125, label:"Mountain Pass" }),
      Object.freeze({ id:"s51_shelter_ridge", x:895, y:675, r:130, label:"Shelter Ridge" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s51_villager_1", x:200, y:235, name:"Mountain Farmer", look:"field" }),
      Object.freeze({ id:"s51_villager_2", x:330, y:390, name:"Village Nurse", look:"medic" }),
      Object.freeze({ id:"s51_villager_3", x:465, y:250, name:"Ridge Scout", look:"scout" }),
      Object.freeze({ id:"s51_villager_4", x:600, y:470, name:"Mountain Driver", look:"driver" }),
      Object.freeze({ id:"s51_villager_5", x:750, y:285, name:"Village Guide", look:"field" }),
      Object.freeze({ id:"s51_villager_6", x:910, y:665, name:"Mountain Elder", look:"scout", vip:true }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s51_ridge_scout", name:"Lower Ridge Scout", type:"Scout", hpMax:410, baseX:290, baseY:430, rangeX:144, rangeY:106, speed:1.01, phase:.4 }),
      Object.freeze({ id:"s51_pass_stalker", name:"Mountain Pass Stalker", type:"Stalker", hpMax:500, baseX:520, baseY:335, rangeX:170, rangeY:126, speed:.90, phase:2.0 }),
      Object.freeze({ id:"s51_slope_hunter", name:"Shelter Slope Hunter", type:"Standard", hpMax:545, baseX:755, baseY:545, rangeX:158, rangeY:120, speed:.86, phase:3.7 }),
      Object.freeze({ id:"s51_ridge_guard", name:"Mountain Village Guard", type:"Armored", hpMax:690, baseX:950, baseY:715, rangeX:134, rangeY:110, speed:.71, phase:5.4 }),
    ]),
  }),
  52:Object.freeze({
    level:52, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 52",
    objective:"Clear all seven tigers attacking from the cliff ledges and extract together.", rescueRequired:0,
    dangerNote:"Cliff tigers attack from elevated ledges and deal 3 extra close-range damage. Watch both sides of the pass.", aggressionLabel:"Cliffside Attack", hazardDamageBonus:3,
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s52_cliff_1", name:"West Cliff Scout", type:"Scout", hpMax:370, baseX:205, baseY:315, rangeX:140, rangeY:104, speed:1.02, phase:.2 }),
      Object.freeze({ id:"s52_cliff_2", name:"High Ledge Scout", type:"Scout", hpMax:380, baseX:365, baseY:520, rangeX:142, rangeY:104, speed:1.03, phase:1.0 }),
      Object.freeze({ id:"s52_cliff_3", name:"Pass Stalker", type:"Stalker", hpMax:460, baseX:520, baseY:300, rangeX:168, rangeY:126, speed:.91, phase:1.8 }),
      Object.freeze({ id:"s52_cliff_4", name:"Ravine Stalker", type:"Stalker", hpMax:470, baseX:670, baseY:545, rangeX:170, rangeY:126, speed:.92, phase:2.6 }),
      Object.freeze({ id:"s52_cliff_5", name:"East Cliff Hunter", type:"Standard", hpMax:515, baseX:805, baseY:330, rangeX:156, rangeY:120, speed:.87, phase:3.4 }),
      Object.freeze({ id:"s52_cliff_6", name:"Summit Hunter", type:"Standard", hpMax:530, baseX:915, baseY:585, rangeX:158, rangeY:122, speed:.88, phase:4.2 }),
      Object.freeze({ id:"s52_cliff_7", name:"Cliffside Guard", type:"Armored", hpMax:670, baseX:965, baseY:720, rangeX:134, rangeY:110, speed:.72, phase:5.0 }),
    ]),
  }),
  53:Object.freeze({
    level:53, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 53",
    objective:"Use Rubber ammunition to capture the rare Silverpeak Tiger alive, clear its guards, and extract together.", rescueRequired:0, captureRequired:1,
    captureTargetIds:Object.freeze(["s53_silverpeak"]),
    dangerNote:"Silverpeak must be captured alive. A Real-ammo hit permanently disqualifies the rare tiger from the study.", aggressionLabel:"Rare Mountain Capture",
    timeLimitMs:13 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s53_slope_scout", name:"Silverpeak Scout", type:"Scout", hpMax:400, baseX:325, baseY:405, rangeX:144, rangeY:106, speed:1.02, phase:.5 }),
      Object.freeze({ id:"s53_silverpeak", name:"Silverpeak Mountain Tiger", type:"Stalker", hpMax:860, baseX:620, baseY:500, rangeX:195, rangeY:145, speed:.86, phase:2.2 }),
      Object.freeze({ id:"s53_peak_hunter", name:"Rare Tiger Hunter", type:"Standard", hpMax:545, baseX:805, baseY:360, rangeX:158, rangeY:122, speed:.87, phase:3.8 }),
      Object.freeze({ id:"s53_peak_guard", name:"Silverpeak Guard", type:"Armored", hpMax:700, baseX:950, baseY:710, rangeX:134, rangeY:110, speed:.72, phase:5.4 }),
    ]),
  }),
  54:Object.freeze({
    level:54, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 54",
    objective:"Rescue four trapped climbers, escort them through three descent checkpoints, clear the tigers, and extract.", rescueRequired:4,
    dangerNote:"The climbers are separated on high ledges. Rescue all four before guiding the group down the marked descent.", aggressionLabel:"Climber Rescue",
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s54_upper_ledge", x:350, y:390, r:125, label:"Upper Ledge Rally" }),
      Object.freeze({ id:"s54_rope_descent", x:635, y:520, r:125, label:"Rope Descent" }),
      Object.freeze({ id:"s54_rescue_shelter", x:900, y:685, r:130, label:"Climber Rescue Shelter" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s54_climber_1", x:215, y:245, name:"Lead Climber", look:"scout", vip:true }),
      Object.freeze({ id:"s54_climber_2", x:415, y:410, name:"Injured Climber", look:"medic", injured:true }),
      Object.freeze({ id:"s54_climber_3", x:665, y:265, name:"Rope Specialist", look:"field" }),
      Object.freeze({ id:"s54_climber_4", x:865, y:505, name:"Mountain Photographer", look:"driver" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s54_ledge_scout", name:"Climber Ledge Scout", type:"Scout", hpMax:415, baseX:300, baseY:430, rangeX:144, rangeY:106, speed:1.02, phase:.4 }),
      Object.freeze({ id:"s54_rope_stalker", name:"Rope Route Stalker", type:"Stalker", hpMax:505, baseX:545, baseY:340, rangeX:170, rangeY:126, speed:.91, phase:2.0 }),
      Object.freeze({ id:"s54_descent_hunter", name:"Descent Hunter", type:"Standard", hpMax:550, baseX:790, baseY:555, rangeX:158, rangeY:122, speed:.87, phase:3.7 }),
      Object.freeze({ id:"s54_shelter_guard", name:"Rescue Shelter Guard", type:"Armored", hpMax:705, baseX:950, baseY:715, rangeX:134, rangeY:110, speed:.72, phase:5.4 }),
    ]),
  }),
  55:Object.freeze({
    level:55, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 55",
    objective:"Break the nine-tiger pack attacking the mountain road, secure three road checkpoints, and extract together.", rescueRequired:0,
    dangerNote:"Nine coordinated tigers attack along the narrow mountain road with 4 extra close-range damage.", aggressionLabel:"Mountain Road Pack", hazardDamageBonus:4, hazardCooldownMs:825,
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s55_road_entry", x:325, y:425, r:125, label:"Mountain Road Entry" }),
      Object.freeze({ id:"s55_hairpin", x:610, y:520, r:125, label:"Hairpin Turn" }),
      Object.freeze({ id:"s55_road_exit", x:895, y:675, r:130, label:"Mountain Road Exit" }),
    ]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s55_pack_1", name:"Road Scout One", type:"Scout", hpMax:350, baseX:185, baseY:310, rangeX:140, rangeY:104, speed:1.03, phase:.1 }),
      Object.freeze({ id:"s55_pack_2", name:"Road Scout Two", type:"Scout", hpMax:360, baseX:325, baseY:495, rangeX:142, rangeY:104, speed:1.04, phase:.8 }),
      Object.freeze({ id:"s55_pack_3", name:"Hairpin Scout", type:"Scout", hpMax:370, baseX:465, baseY:300, rangeX:144, rangeY:106, speed:1.05, phase:1.5 }),
      Object.freeze({ id:"s55_pack_4", name:"Road Stalker One", type:"Stalker", hpMax:450, baseX:600, baseY:520, rangeX:168, rangeY:126, speed:.92, phase:2.2 }),
      Object.freeze({ id:"s55_pack_5", name:"Road Stalker Two", type:"Stalker", hpMax:460, baseX:735, baseY:320, rangeX:170, rangeY:126, speed:.93, phase:2.9 }),
      Object.freeze({ id:"s55_pack_6", name:"Road Hunter One", type:"Standard", hpMax:505, baseX:850, baseY:535, rangeX:158, rangeY:122, speed:.88, phase:3.6 }),
      Object.freeze({ id:"s55_pack_7", name:"Road Hunter Two", type:"Standard", hpMax:515, baseX:955, baseY:340, rangeX:158, rangeY:122, speed:.89, phase:4.3 }),
      Object.freeze({ id:"s55_pack_8", name:"Road Guard One", type:"Armored", hpMax:630, baseX:620, baseY:720, rangeX:134, rangeY:110, speed:.73, phase:5.0 }),
      Object.freeze({ id:"s55_pack_9", name:"Road Guard Two", type:"Armored", hpMax:650, baseX:960, baseY:715, rangeX:136, rangeY:112, speed:.74, phase:5.7 }),
    ]),
  }),
  56:Object.freeze({
    level:56, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 56",
    objective:"Escort the five-person caravan through three canyon checkpoints, clear the ambush, and extract.", rescueRequired:5,
    dangerNote:"The canyon narrows around the caravan. Both soldiers must secure each bend before the group advances.", aggressionLabel:"Canyon Caravan",
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s56_canyon_mouth", x:340, y:425, r:125, label:"Canyon Mouth" }),
      Object.freeze({ id:"s56_narrow_bend", x:625, y:530, r:125, label:"Narrow Canyon Bend" }),
      Object.freeze({ id:"s56_highland_exit", x:900, y:680, r:130, label:"Highland Exit" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s56_driver", x:220, y:260, name:"Caravan Driver", look:"driver", vip:true }),
      Object.freeze({ id:"s56_medic", x:400, y:410, name:"Caravan Medic", look:"medic" }),
      Object.freeze({ id:"s56_guide", x:585, y:275, name:"Canyon Guide", look:"scout" }),
      Object.freeze({ id:"s56_trader", x:760, y:500, name:"Mountain Trader", look:"field" }),
      Object.freeze({ id:"s56_guard", x:920, y:675, name:"Caravan Guard", look:"scout" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s56_mouth_scout", name:"Canyon Mouth Scout", type:"Scout", hpMax:420, baseX:290, baseY:430, rangeX:144, rangeY:106, speed:1.02, phase:.4 }),
      Object.freeze({ id:"s56_bend_stalker", name:"Narrow Bend Stalker", type:"Stalker", hpMax:510, baseX:520, baseY:335, rangeX:170, rangeY:126, speed:.91, phase:1.9 }),
      Object.freeze({ id:"s56_caravan_hunter", name:"Caravan Canyon Hunter", type:"Standard", hpMax:555, baseX:720, baseY:550, rangeX:158, rangeY:122, speed:.87, phase:3.1 }),
      Object.freeze({ id:"s56_exit_mauler", name:"Highland Exit Mauler", type:"Standard", hpMax:570, baseX:860, baseY:385, rangeX:158, rangeY:122, speed:.88, phase:4.3 }),
      Object.freeze({ id:"s56_canyon_guard", name:"Canyon Caravan Guard", type:"Armored", hpMax:715, baseX:950, baseY:715, rangeX:134, rangeY:110, speed:.72, phase:5.6 }),
    ]),
  }),
  57:Object.freeze({
    level:57, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 57",
    objective:"Navigate the snowstorm, clear all seven hidden tigers, secure three visibility beacons, and extract together.", rescueRequired:0,
    dangerNote:"Heavy snow reduces map visibility. Both soldiers must activate the three route beacons to reveal the extraction path.", aggressionLabel:"Whiteout Patrol", hazardDamageBonus:2, snowstormIntensity:.78,
    timeLimitMs:14 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s57_beacon_1", x:335, y:400, r:125, label:"Lower Visibility Beacon" }),
      Object.freeze({ id:"s57_beacon_2", x:625, y:515, r:125, label:"Mid-Ridge Visibility Beacon" }),
      Object.freeze({ id:"s57_beacon_3", x:900, y:680, r:130, label:"Extraction Visibility Beacon" }),
    ]),
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s57_snow_1", name:"Whiteout Scout One", type:"Scout", hpMax:380, baseX:210, baseY:320, rangeX:142, rangeY:104, speed:1.03, phase:.2 }),
      Object.freeze({ id:"s57_snow_2", name:"Whiteout Scout Two", type:"Scout", hpMax:390, baseX:370, baseY:525, rangeX:144, rangeY:106, speed:1.04, phase:1.0 }),
      Object.freeze({ id:"s57_snow_3", name:"Snow Stalker One", type:"Stalker", hpMax:470, baseX:525, baseY:305, rangeX:170, rangeY:126, speed:.92, phase:1.8 }),
      Object.freeze({ id:"s57_snow_4", name:"Snow Stalker Two", type:"Stalker", hpMax:480, baseX:680, baseY:550, rangeX:172, rangeY:128, speed:.93, phase:2.6 }),
      Object.freeze({ id:"s57_snow_5", name:"Whiteout Hunter One", type:"Standard", hpMax:525, baseX:820, baseY:330, rangeX:158, rangeY:122, speed:.88, phase:3.4 }),
      Object.freeze({ id:"s57_snow_6", name:"Whiteout Hunter Two", type:"Standard", hpMax:540, baseX:920, baseY:590, rangeX:160, rangeY:124, speed:.89, phase:4.2 }),
      Object.freeze({ id:"s57_snow_7", name:"Snowstorm Guard", type:"Armored", hpMax:680, baseX:965, baseY:720, rangeX:136, rangeY:112, speed:.73, phase:5.0 }),
    ]),
  }),
  58:Object.freeze({
    level:58, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 58",
    objective:"Protect the five-person rescue crew, secure the three landing-zone checkpoints, clear the tigers, and board the helicopter together.", rescueRequired:5,
    extractionType:"helicopter",
    dangerNote:"Keep the rescue crew alive while both soldiers secure the approach, perimeter, and helicopter boarding zone.", aggressionLabel:"Mountain Rescue LZ", hazardDamageBonus:3,
    timeLimitMs:15 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    checkpoints:Object.freeze([
      Object.freeze({ id:"s58_lz_approach", x:350, y:420, r:130, label:"Mountain LZ Approach" }),
      Object.freeze({ id:"s58_lz_perimeter", x:650, y:545, r:130, label:"Mountain LZ Perimeter" }),
      Object.freeze({ id:"s58_boarding", x:910, y:700, r:130, label:"Rescue Helicopter Boarding" }),
    ]),
    civilians:Object.freeze([
      Object.freeze({ id:"s58_pilot", x:220, y:255, name:"Rescue Pilot", look:"driver", vip:true }),
      Object.freeze({ id:"s58_medic", x:410, y:415, name:"Flight Medic", look:"medic" }),
      Object.freeze({ id:"s58_spotter", x:600, y:275, name:"Mountain Spotter", look:"scout" }),
      Object.freeze({ id:"s58_engineer", x:780, y:505, name:"Helicopter Engineer", look:"field" }),
      Object.freeze({ id:"s58_rescuer", x:925, y:690, name:"Rescue Specialist", look:"scout" }),
    ]),
    tigers:Object.freeze([
      Object.freeze({ id:"s58_lz_scout", name:"Landing Ridge Scout", type:"Scout", hpMax:420, baseX:285, baseY:430, rangeX:144, rangeY:106, speed:1.03, phase:.4 }),
      Object.freeze({ id:"s58_lz_stalker", name:"Landing Zone Stalker", type:"Stalker", hpMax:510, baseX:490, baseY:330, rangeX:170, rangeY:126, speed:.92, phase:1.7 }),
      Object.freeze({ id:"s58_perimeter_hunter", name:"LZ Perimeter Hunter", type:"Standard", hpMax:550, baseX:680, baseY:545, rangeX:158, rangeY:122, speed:.88, phase:3.0 }),
      Object.freeze({ id:"s58_boarding_hunter", name:"Boarding Zone Hunter", type:"Standard", hpMax:565, baseX:835, baseY:375, rangeX:160, rangeY:124, speed:.89, phase:4.1 }),
      Object.freeze({ id:"s58_lz_guard_1", name:"Rescue LZ Guard One", type:"Armored", hpMax:700, baseX:740, baseY:705, rangeX:136, rangeY:112, speed:.73, phase:5.2 }),
      Object.freeze({ id:"s58_lz_guard_2", name:"Rescue LZ Guard Two", type:"Armored", hpMax:720, baseX:960, baseY:720, rangeX:138, rangeY:114, speed:.74, phase:6.3 }),
    ]),
  }),
  59:Object.freeze({
    level:59, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 59",
    objective:"Survive the twelve-tiger aggressive mountain swarm, clear every threat, and extract together.", rescueRequired:0,
    dangerNote:"Twelve aggressive tigers converge across the mountain edge with 6 extra damage and a faster attack cycle.", aggressionLabel:"Mountain Swarm", hazardDamageBonus:6, hazardCooldownMs:750,
    timeLimitMs:15 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s59_swarm_1", name:"Mountain Scout One", type:"Scout", hpMax:350, baseX:170, baseY:295, rangeX:140, rangeY:104, speed:1.05, phase:.1 }),
      Object.freeze({ id:"s59_swarm_2", name:"Mountain Scout Two", type:"Scout", hpMax:360, baseX:300, baseY:490, rangeX:142, rangeY:104, speed:1.06, phase:.7 }),
      Object.freeze({ id:"s59_swarm_3", name:"Mountain Scout Three", type:"Scout", hpMax:370, baseX:430, baseY:285, rangeX:144, rangeY:106, speed:1.07, phase:1.3 }),
      Object.freeze({ id:"s59_swarm_4", name:"Mountain Stalker One", type:"Stalker", hpMax:450, baseX:555, baseY:505, rangeX:170, rangeY:126, speed:.94, phase:1.9 }),
      Object.freeze({ id:"s59_swarm_5", name:"Mountain Stalker Two", type:"Stalker", hpMax:460, baseX:680, baseY:300, rangeX:172, rangeY:128, speed:.95, phase:2.5 }),
      Object.freeze({ id:"s59_swarm_6", name:"Mountain Stalker Three", type:"Stalker", hpMax:470, baseX:805, baseY:520, rangeX:174, rangeY:128, speed:.96, phase:3.1 }),
      Object.freeze({ id:"s59_swarm_7", name:"Mountain Hunter One", type:"Standard", hpMax:510, baseX:925, baseY:310, rangeX:158, rangeY:122, speed:.90, phase:3.7 }),
      Object.freeze({ id:"s59_swarm_8", name:"Mountain Hunter Two", type:"Standard", hpMax:520, baseX:250, baseY:700, rangeX:160, rangeY:124, speed:.91, phase:4.3 }),
      Object.freeze({ id:"s59_swarm_9", name:"Mountain Hunter Three", type:"Standard", hpMax:530, baseX:475, baseY:720, rangeX:160, rangeY:124, speed:.91, phase:4.9 }),
      Object.freeze({ id:"s59_swarm_10", name:"Mountain Hunter Four", type:"Standard", hpMax:540, baseX:680, baseY:690, rangeX:162, rangeY:126, speed:.92, phase:5.5 }),
      Object.freeze({ id:"s59_swarm_11", name:"Mountain Guard One", type:"Armored", hpMax:670, baseX:835, baseY:725, rangeX:136, rangeY:112, speed:.75, phase:6.1 }),
      Object.freeze({ id:"s59_swarm_12", name:"Mountain Guard Two", type:"Armored", hpMax:690, baseX:965, baseY:700, rangeX:138, rangeY:114, speed:.76, phase:6.7 }),
    ]),
  }),
  60:Object.freeze({
    level:60, chapter:6, chapterName:"Mountain Edge", title:"Story Mission 60",
    objective:"Defeat or capture the Mountain Alpha Tiger, then reach extraction together to finish Chapter 6.", rescueRequired:0,
    dangerNote:"The Mountain Alpha hits harder at close range and enters Summit Rage below 35% health.", aggressionLabel:"Mountain Alpha Boss", hazardDamageBonus:6, hazardCooldownMs:825, snowstormIntensity:.30,
    timeLimitMs:16 * 60 * 1000, world:WORLD, extraction:EXTRACTION, spawns:SPAWNS,
    civilians:Object.freeze([]),
    tigers:Object.freeze([
      Object.freeze({ id:"s60_mountain_alpha", name:"Mountain Alpha Tiger", type:"Alpha", hpMax:3200, baseX:650, baseY:545, rangeX:245, rangeY:185, speed:.58, phase:1.4, boss:true, bloodRage:true }),
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
  6:Object.freeze({ width:4500, height:2520 }),
  7:Object.freeze({ width:4560, height:2560 }),
  8:Object.freeze({ width:4620, height:2600 }),
  9:Object.freeze({ width:4680, height:2640 }),
  10:Object.freeze({ width:4740, height:2680 }),
  11:Object.freeze({ width:4800, height:2800 }),
  12:Object.freeze({ width:4800, height:2800 }),
  13:Object.freeze({ width:4800, height:2800 }),
  14:Object.freeze({ width:4800, height:2800 }),
  15:Object.freeze({ width:4800, height:2800 }),
  16:Object.freeze({ width:4800, height:2800 }),
  17:Object.freeze({ width:4800, height:2800 }),
  18:Object.freeze({ width:4800, height:2800 }),
  19:Object.freeze({ width:4800, height:2800 }),
  20:Object.freeze({ width:4800, height:2800 }),
  21:Object.freeze({ width:4800, height:2800 }),
  22:Object.freeze({ width:4800, height:2800 }),
  23:Object.freeze({ width:4800, height:2800 }),
  24:Object.freeze({ width:4800, height:2800 }),
  25:Object.freeze({ width:4800, height:2800 }),
  26:Object.freeze({ width:4800, height:2800 }),
  27:Object.freeze({ width:4800, height:2800 }),
  28:Object.freeze({ width:4800, height:2800 }),
  29:Object.freeze({ width:4800, height:2800 }),
  30:Object.freeze({ width:4800, height:2800 }),
  31:Object.freeze({ width:4800, height:2800 }),
  32:Object.freeze({ width:4800, height:2800 }),
  33:Object.freeze({ width:4800, height:2800 }),
  34:Object.freeze({ width:4800, height:2800 }),
  35:Object.freeze({ width:4800, height:2800 }),
  36:Object.freeze({ width:4800, height:2800 }),
  37:Object.freeze({ width:4800, height:2800 }),
  38:Object.freeze({ width:4800, height:2800 }),
  39:Object.freeze({ width:4800, height:2800 }),
  40:Object.freeze({ width:4800, height:2800 }),
  41:Object.freeze({ width:4800, height:2800 }),
  42:Object.freeze({ width:4800, height:2800 }),
  43:Object.freeze({ width:4800, height:2800 }),
  44:Object.freeze({ width:4800, height:2800 }),
  45:Object.freeze({ width:4800, height:2800 }),
  46:Object.freeze({ width:4800, height:2800 }),
  47:Object.freeze({ width:4800, height:2800 }),
  48:Object.freeze({ width:4800, height:2800 }),
  49:Object.freeze({ width:4800, height:2800 }),
  50:Object.freeze({ width:4800, height:2800 }),
  51:Object.freeze({ width:4800, height:2800 }),
  52:Object.freeze({ width:4800, height:2800 }),
  53:Object.freeze({ width:4800, height:2800 }),
  54:Object.freeze({ width:4800, height:2800 }),
  55:Object.freeze({ width:4800, height:2800 }),
  56:Object.freeze({ width:4800, height:2800 }),
  57:Object.freeze({ width:4800, height:2800 }),
  58:Object.freeze({ width:4800, height:2800 }),
  59:Object.freeze({ width:4800, height:2800 }),
  60:Object.freeze({ width:4800, height:2800 }),
});
const NIGHT_FANG_WORLD_SIZE = Object.freeze({ width:4200, height:2360 });
const TIGER_DEN_WORLD_SIZE = Object.freeze({ width:4560, height:2560 });
const VILLAGE_SIEGE_WORLD_SIZE = Object.freeze({ width:4680, height:2640 });
const CONVOY_RESCUE_WORLD_SIZE = Object.freeze({ width:4800, height:2720 });
const ALPHA_HUNT_WORLD_SIZE = Object.freeze({ width:4800, height:2800 });
const STORM_EXTRACTION_WORLD_SIZE = Object.freeze({ width:4800, height:2800 });
const ENDLESS_SURVIVAL_WORLD_SIZE = Object.freeze({ width:4800, height:2800 });
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
const ENDLESS_SURVIVAL_TIGERS = Object.freeze([
  Object.freeze({ id:"survival_raider", name:"Basin Raider", type:"Scout", hpMax:420, baseX:310, baseY:430, rangeX:120, rangeY:90, speed:.84, phase:.4 }),
  Object.freeze({ id:"survival_stalker", name:"Night Stalker", type:"Standard", hpMax:470, baseX:540, baseY:310, rangeX:132, rangeY:100, speed:.72, phase:2.1 }),
  Object.freeze({ id:"survival_breaker", name:"Last Stand Breaker", type:"Armored", hpMax:560, baseX:900, baseY:675, rangeX:112, rangeY:92, speed:.58, phase:4.4 }),
  Object.freeze({ id:"survival_alpha", name:"Relentless Alpha", type:"Alpha", hpMax:1500, baseX:660, baseY:590, rangeX:190, rangeY:150, speed:.46, phase:1.2, boss:true }),
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
  const fireZone = (src)=>Object.freeze({
    ...src,
    x:Math.round(Number(src.x || 0) * sx),
    y:Math.round(Number(src.y || 0) * sy),
    r:Math.round(Number(src.r || 72) * Math.min(sx, sy)),
  });
  const waterZone = (src)=>Object.freeze({
    ...src,
    x:Math.round(Number(src.x || 0) * sx),
    y:Math.round(Number(src.y || 0) * sy),
    rx:Math.round(Number(src.rx || 180) * sx),
    ry:Math.round(Number(src.ry || 90) * sy),
  });
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
    checkpoints:Object.freeze((base.checkpoints || []).map(point)),
    fireZones:Object.freeze((base.fireZones || []).map(fireZone)),
    waterZones:Object.freeze((base.waterZones || []).map(waterZone)),
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
const EXPANDED_ENDLESS_SURVIVAL_MISSION = expandMissionDefinition({
  level:0,
  chapter:0,
  chapterName:"Last Stand Basin",
  title:"Endless Survival",
  objective:"Real ammunition only. Kill every tiger in each escalating wave; captures are disabled. After Wave 3, extract together or keep fighting.",
  rescueRequired:0,
  timeLimitMs:SESSION_TTL_MS,
  world:WORLD,
  extraction:EXTRACTION,
  spawns:SPAWNS,
  civilians:Object.freeze([]),
  tigers:ENDLESS_SURVIVAL_TIGERS,
}, ENDLESS_SURVIVAL_WORLD_SIZE);
const SPECIAL_OPERATION_MISSIONS = Object.freeze({
  "live-squad":EXPANDED_NIGHT_FANG_MISSION,
  "tiger-den":EXPANDED_TIGER_DEN_MISSION,
  "village-siege":EXPANDED_VILLAGE_SIEGE_MISSION,
  "convoy-rescue":EXPANDED_CONVOY_RESCUE_MISSION,
  "alpha-hunt":EXPANDED_ALPHA_HUNT_MISSION,
  "storm-extraction":EXPANDED_STORM_EXTRACTION_MISSION,
  "endless-survival":EXPANDED_ENDLESS_SURVIVAL_MISSION,
});
const VALID_LAUNCH_TYPES = Object.freeze(["shared-story", ...Object.keys(SPECIAL_OPERATION_MISSIONS)]);
const ALL_COOP_MISSIONS = Object.freeze([
  ...Object.values(EXPANDED_SHARED_STORY_MISSIONS),
  ...Object.values(SPECIAL_OPERATION_MISSIONS),
]);
const ALL_COOP_TIGERS = Object.freeze(ALL_COOP_MISSIONS.flatMap((mission)=>mission.tigers || []));
const ALL_COOP_CIVILIANS = Object.freeze(ALL_COOP_MISSIONS.flatMap((mission)=>mission.civilians || []));
const ALL_COOP_CHECKPOINTS = Object.freeze(ALL_COOP_MISSIONS.flatMap((mission)=>mission.checkpoints || []));

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
  const requestedStoryMissionLevel = clamp(Math.floor(Number(raw.storyMissionLevel || 0)), 0, 100);
  const requestedLaunchType = normalizeLaunchType(raw.launchType);
  const launchType = requestedLaunchType === "shared-story" && !EXPANDED_SHARED_STORY_MISSIONS[requestedStoryMissionLevel]
    ? "live-squad"
    : requestedLaunchType;
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
    storyMissionLevel:launchType === "shared-story" ? requestedStoryMissionLevel : 0,
    launchType,
    survivalWave:clamp(Math.floor(Number(raw.survivalWave || 1)), 1, 50),
    survivalWavesCleared:clamp(Math.floor(Number(raw.survivalWavesCleared || 0)), 0, 50),
    survivalIntermissionUntil:Math.max(0, Number(raw.survivalIntermissionUntil || 0)),
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
    ammoMode:"rubber",
    lethalWoundedIds:[],
    rubberSlowUntil:{},
    killSites:{},
    captureSites:{},
    capturedIds:[],
    rescuedIds:[],
    securedCivilianIds:[],
    checkpointIds:[],
    revives:0,
    joinedAt:nowMs(),
    lastSeenAt:nowMs(),
    lastMoveAt:nowMs(),
    lastAttackAt:0,
    lastNoiseAt:0,
    lastNoiseX:spawn.x,
    lastNoiseY:spawn.y,
    lastNoiseIntensity:0,
    lastNoiseSource:"",
    lastHazardAt:0,
    lastFireAt:0,
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
    const damage = clamp(src?.tigerDamage?.[tiger.id], 0, Math.max(tiger.hpMax, tiger.hpMax * 20));
    if(damage > 0) tigerDamage[tiger.id] = damage;
  }
  const rubberSlowUntil = {};
  for(const tiger of ALL_COOP_TIGERS){
    const until = Math.max(0, Number(src?.rubberSlowUntil?.[tiger.id] || 0));
    if(until > 0) rubberSlowUntil[tiger.id] = until;
  }
  const killSites = {};
  for(const tiger of ALL_COOP_TIGERS){
    const site = src?.killSites?.[tiger.id];
    if(!site || typeof site !== "object") continue;
    killSites[tiger.id] = {
      x:clamp(site.x, 24, MAX_COOP_WORLD.width - 24),
      y:clamp(site.y, 24, MAX_COOP_WORLD.height - 24),
      killedAt:Math.max(0, Number(site.killedAt || 0)),
    };
  }
  const captureSites = {};
  for(const tiger of ALL_COOP_TIGERS){
    const site = src?.captureSites?.[tiger.id];
    if(!site || typeof site !== "object") continue;
    captureSites[tiger.id] = {
      x:clamp(site.x, 24, MAX_COOP_WORLD.width - 24),
      y:clamp(site.y, 24, MAX_COOP_WORLD.height - 24),
      capturedAt:Math.max(0, Number(site.capturedAt || 0)),
    };
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
    ammoMode:ammoRules.normalizeAmmoMode(src.ammoMode, base.ammoMode) === "rubber" ? "rubber" : "real",
    lethalWoundedIds:[...new Set((Array.isArray(src.lethalWoundedIds) ? src.lethalWoundedIds : []).map((id)=>cleanText(id, 32)).filter((id)=>ALL_COOP_TIGERS.some((t)=>t.id === id)))],
    rubberSlowUntil,
    killSites,
    captureSites,
    rescuedIds:[...new Set((Array.isArray(src.rescuedIds) ? src.rescuedIds : []).map((id)=>cleanText(id, 24)).filter((id)=>ALL_COOP_CIVILIANS.some((c)=>c.id === id)))],
    securedCivilianIds:[...new Set((Array.isArray(src.securedCivilianIds) ? src.securedCivilianIds : []).map((id)=>cleanText(id, 24)).filter((id)=>ALL_COOP_CIVILIANS.some((c)=>c.id === id)))],
    checkpointIds:[...new Set((Array.isArray(src.checkpointIds) ? src.checkpointIds : []).map((id)=>cleanText(id, 32)).filter((id)=>ALL_COOP_CHECKPOINTS.some((checkpoint)=>checkpoint.id === id)))],
    capturedIds:[...new Set((Array.isArray(src.capturedIds) ? src.capturedIds : []).map((id)=>cleanText(id, 32)).filter((id)=>ALL_COOP_TIGERS.some((t)=>t.id === id)))],
    revives:clamp(src.revives, 0, 999),
    joinedAt:Math.max(0, Number(src.joinedAt || base.joinedAt)),
    lastSeenAt:Math.max(0, Number(src.lastSeenAt || base.lastSeenAt)),
    lastMoveAt:Math.max(0, Number(src.lastMoveAt || base.lastMoveAt)),
    lastAttackAt:Math.max(0, Number(src.lastAttackAt || 0)),
    lastNoiseAt:Math.max(0, Number(src.lastNoiseAt || 0)),
    lastNoiseX:clamp(src.lastNoiseX ?? base.lastNoiseX, 24, MAX_COOP_WORLD.width - 24),
    lastNoiseY:clamp(src.lastNoiseY ?? base.lastNoiseY, 24, MAX_COOP_WORLD.height - 24),
    lastNoiseIntensity:clamp(src.lastNoiseIntensity, 0, 3),
    lastNoiseSource:cleanText(src.lastNoiseSource, 24),
    lastHazardAt:Math.max(0, Number(src.lastHazardAt || 0)),
    lastFireAt:Math.max(0, Number(src.lastFireAt || 0)),
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
  const survivalWave = session?.launchType === "endless-survival" ? clamp(Math.floor(Number(session.survivalWave || 1)), 1, 50) : 1;
  const survivalScale = 1 + (survivalWave - 1) * 0.22;
  const balance = tigerIntelligence.balanceFor({ playerCount:Math.max(2, players.length), mode:session?.launchType === "endless-survival" ? "Survival" : "Co-op", level:session?.storyMissionLevel || 1 });
  const killSites = players.flatMap((player)=>Object.values(player?.killSites || {})).filter(Boolean);
  return missionDefinition(session).tigers.map((baseDef)=>{
    const def = session?.launchType === "endless-survival"
      ? { ...baseDef, hpMax:Math.round(baseDef.hpMax * survivalScale), name:`${baseDef.name} • Wave ${survivalWave}` }
      : baseDef;
    const captured = players.some((player)=>(player?.capturedIds || []).includes(def.id));
    const lethalWounded = players.some((player)=>(player?.lethalWoundedIds || []).includes(def.id));
    const rubberSlowed = players.some((player)=>Number(player?.rubberSlowUntil?.[def.id] || 0) > at);
    let damage = players.reduce((sum, player)=>sum + clamp(player?.tigerDamage?.[def.id], 0, def.hpMax), 0);
    if(session?.launchType === "live-squad" && def.boss && damage <= 0){
      // Keep rooms created by the first V5 release playable after this update.
      damage = players.reduce((sum, player)=>sum + clamp(player?.bossDamage, 0, BOSS_HP_MAX), 0);
    }
    const hp = captured ? 0 : clamp(def.hpMax - damage, 0, def.hpMax);
    const defeated = hp <= 0;
    const killSite = players.map((player)=>player?.killSites?.[def.id]).find(Boolean);
    const captureSite = players.map((player)=>player?.captureSites?.[def.id]).find(Boolean);
    const position = captured && captureSite
      ? { x:Number(captureSite.x), y:Number(captureSite.y) }
      : (defeated && killSite ? { x:Number(killSite.x), y:Number(killSite.y) } : tigerPosition(session, def, at));
    const nearestPlayerDistance = players.filter((player)=>!player.downed).reduce((nearest, player)=>Math.min(nearest, distance(position, player)), Infinity);
    const nearestBloodDistance = killSites.reduce((nearest, site)=>Math.min(nearest, distance(position, site)), Infinity);
    let noiseScore = 0;
    for(const player of players){
      if(!player?.lastNoiseAt || !player?.lastNoiseIntensity) continue;
      const event = tigerIntelligence.noiseEvent({ x:player.lastNoiseX, y:player.lastNoiseY, intensity:player.lastNoiseIntensity, source:player.lastNoiseSource, at:player.lastNoiseAt });
      noiseScore = Math.max(noiseScore, tigerIntelligence.noiseAt(event, position.x, position.y, at));
    }
    const awareness = tigerIntelligence.awarenessFor({
      distance:nearestPlayerDistance,
      detectionRange:(def.boss ? 310 : 250) * balance.detectMul,
      noise:noiseScore,
      bloodScent:nearestBloodDistance <= 360 ? 0.82 : 0,
      targetVisible:nearestPlayerDistance <= (def.boss ? 310 : 250) * balance.detectMul,
      enraged:!!def.bloodRage && hp <= def.hpMax * 0.35,
    });
    return {
      ...def,
      ...position,
      hp,
      defeated,
      captured,
      cage:captured,
      capturedAt:captured ? Math.max(0, Number(captureSite?.capturedAt || 0)) : 0,
      lethalWounded,
      rubberSlowed,
      carcass:defeated && !captured,
      killedAt:defeated && !captured ? Math.max(0, Number(killSite?.killedAt || 0)) : 0,
      bloodScentRadius:defeated && !captured ? 360 : 0,
      awarenessState:awareness.key,
      awarenessLabel:awareness.label,
      awarenessColor:awareness.color,
      awarenessIcon:awareness.icon,
      awarenessScore:awareness.score,
    };
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
  const requestedStoryMissionLevel = clamp(Math.floor(Number(opts?.storyMissionLevel || 0)), 0, 100);
  const requestedLaunchType = normalizeLaunchType(opts?.launchType);
  const launchType = requestedLaunchType === "shared-story" && !EXPANDED_SHARED_STORY_MISSIONS[requestedStoryMissionLevel]
    ? "live-squad"
    : requestedLaunchType;
  let session = await writeSession({
    code,
    hostId:uid,
    memberIds:[uid],
    status:"waiting",
    createdAt:nowMs(),
    updatedAt:nowMs(),
    startedAt:0,
    completedAt:0,
    storyMissionLevel:launchType === "shared-story" ? requestedStoryMissionLevel : 0,
    launchType,
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
  const missionCivilianIds = new Set(mission.civilians.map((civilian)=>civilian.id));
  const rescuedIds = [...new Set(players.flatMap((p)=>p.rescuedIds || []))]
    .filter((id)=>missionCivilianIds.has(id));
  const securedCivilianIds = [...new Set(players.flatMap((p)=>p.securedCivilianIds || []))]
    .filter((id)=>missionCivilianIds.has(id) && rescuedIds.includes(id));
  const missionTigerIds = new Set(mission.tigers.map((tiger)=>tiger.id));
  const capturedIds = [...new Set(players.flatMap((p)=>p.capturedIds || []))]
    .filter((id)=>missionTigerIds.has(id));
  const tigers = tigerSnapshots(session, players, at);
  const boss = tigers.find((t)=>t.boss && !t.defeated) || tigers.find((t)=>t.boss) || tigers[tigers.length - 1];
  const bossHpMax = Math.max(1, Number(boss?.hpMax || BOSS_HP_MAX));
  const bossDamage = clamp(bossHpMax - Number(boss?.hp || 0), 0, bossHpMax);
  const bossHp = Number(boss?.hp || 0);
  const onlineIds = players.filter((p)=>at - p.lastSeenAt <= 15000).map((p)=>p.userId);
  const extractionReadyIds = players
    .filter((p)=>!p.downed && distance(p, mission.extraction) <= mission.extraction.r)
    .map((p)=>p.userId);
  const allTigersCleared = tigers.every((t)=>t.defeated);
  const tigerKills = tigers.filter((t)=>t.defeated && !t.captured).length;
  const aggressionPerKill = Number.isFinite(Number(mission.aggressionPerKill))
    ? Math.max(0, Number(mission.aggressionPerKill))
    : 2;
  const bloodRageActive = !!boss?.bloodRage && !boss.defeated && Number(boss.hp || 0) <= Number(boss.hpMax || 1) * 0.35;
  const aggressionBonus = Math.max(0, Number(mission.hazardDamageBonus || 0))
    + tigerKills * aggressionPerKill
    + (bloodRageActive ? 6 : 0);
  const legacyBossOnlyRoom = session.launchType === "live-squad" && players.every((p)=>Object.keys(p?.tigerDamage || {}).length === 0) && players.some((p)=>Number(p?.bossDamage || 0) > 0);
  const captureRequired = Math.max(0, Number(mission.captureRequired || 0));
  const captureTargetIds = (mission.captureTargetIds || []).filter((id)=>missionTigerIds.has(id));
  const captureTargetsReady = captureTargetIds.length === 0
    ? capturedIds.length >= captureRequired
    : captureTargetIds.every((id)=>capturedIds.includes(id));
  const checkpoints = mission.checkpoints || [];
  const checkpointCompletedIds = checkpoints
    .filter((checkpoint)=>players.length === session.memberIds.length && players.every((player)=>(player.checkpointIds || []).includes(checkpoint.id)))
    .map((checkpoint)=>checkpoint.id);
  const checkpointsReady = checkpointCompletedIds.length >= checkpoints.length;
  const objectivesReady = securedCivilianIds.length >= mission.rescueRequired && captureTargetsReady && checkpointsReady && (allTigersCleared || legacyBossOnlyRoom);
  const squadWiped = players.length === session.memberIds.length && players.every((p)=>p.downed && Number(p.respawnAt || 0) <= 0 && Number(p.livesRemaining || 0) <= 0);
  return { rescuedIds, securedCivilianIds, capturedIds, checkpointCompletedIds, checkpointsReady, bossDamage, bossHp, boss, tigers, tigerKills, aggressionPerKill, aggressionBonus, bloodRageActive, onlineIds, extractionReadyIds, objectivesReady, allTigersCleared, squadWiped };
}

function rescueHouseFor(mission){
  const extraction = mission.extraction;
  const offset = Math.max(170, Number(extraction.r || 90) + 95);
  return {
    x:clamp(Number(extraction.x || 0) - offset, 120, Number(mission.world.width || 1200) - 120),
    y:clamp(Number(extraction.y || 0), 120, Number(mission.world.height || 1100) - 120),
    r:105,
    label:"Rescue House",
  };
}

function civilianSnapshots(session, players, rescuedIds, securedCivilianIds){
  const mission = missionDefinition(session);
  const rescueHouse = rescueHouseFor(mission);
  return mission.civilians.map((civilian, index)=>{
    const owner = players.find((player)=>(player.rescuedIds || []).includes(civilian.id));
    if(!owner) return { ...civilian, following:false, followingUserId:0, secured:false };
    const row = Math.floor(index / 2);
    const side = index % 2 === 0 ? -1 : 1;
    const secured = securedCivilianIds.includes(civilian.id);
    return {
      ...civilian,
      x:secured ? rescueHouse.x + side * (28 + row * 7) : clamp(Number(owner.x || 0) + side * (38 + row * 8), 24, mission.world.width - 24),
      y:secured ? rescueHouse.y + 28 + row * 25 : clamp(Number(owner.y || 0) + 42 + row * 30, 24, mission.world.height - 24),
      following:!secured,
      followingUserId:owner.userId,
      secured,
      rescued:rescuedIds.includes(civilian.id),
    };
  });
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
  if(session.launchType === "endless-survival"){
    const wave = clamp(Math.floor(Number(session.survivalWave || 1)), 1, 50);
    if(derived.allTigersCleared){
      if(Number(session.survivalWavesCleared || 0) < wave){
        session.survivalWavesCleared = wave;
        session.survivalIntermissionUntil = now + 12000;
        session = await writeSession(session);
      }
      const canExtract = Number(session.survivalWavesCleared || 0) >= 3
        && derived.onlineIds.length === session.memberIds.length
        && derived.extractionReadyIds.length === session.memberIds.length;
      if(canExtract){
        session.status = "complete";
        session.completedAt = now;
        return writeSession(session);
      }
      if(now >= Number(session.survivalIntermissionUntil || 0)){
        session.survivalWave = clamp(wave + 1, 1, 50);
        session.survivalIntermissionUntil = 0;
        for(const player of players){
          player.bossDamage = 0;
          player.tigerDamage = {};
          player.ammoMode = "real";
          player.lethalWoundedIds = [];
          player.rubberSlowUntil = {};
          player.killSites = {};
          player.captureSites = {};
          player.capturedIds = [];
          await writePlayer(session.code, player);
        }
        return writeSession(session);
      }
      return session;
    }
    if(Number(session.survivalIntermissionUntil || 0) > 0){
      session.survivalIntermissionUntil = 0;
      return writeSession(session);
    }
    return session;
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
      captureRequired:Math.max(0, Number(mission.captureRequired || 0)),
      captureTargetIds:[...(mission.captureTargetIds || [])],
      captureTargetNames:(mission.captureTargetIds || []).map((id)=>mission.tigers.find((tiger)=>tiger.id === id)?.name || id),
      extractionType:cleanText(mission.extractionType || "ground", 20),
      aggressionLabel:cleanText(mission.aggressionLabel || "Blood Scent", 50),
      dangerNote:cleanText(mission.dangerNote || "Real-ammo kills leave bodies. Blood scent makes every surviving tiger hunt harder and deal more damage. Captures do not create blood scent.", 180),
      aggressionPerKill:derived.aggressionPerKill,
      aggressionBonus:derived.aggressionBonus,
      tigerKills:derived.tigerKills,
      bloodRageActive:derived.bloodRageActive,
      civilianCount:mission.civilians.length,
      tigerCount:mission.tigers.length,
      checkpointRequired:(mission.checkpoints || []).length,
      checkpointsBeforeRescue:!!mission.checkpointsBeforeRescue,
      waterSlowMultiplier:clamp(Number(mission.waterSlowMultiplier || 1), .35, 1),
      snowstormIntensity:clamp(Number(mission.snowstormIntensity || 0), 0, .9),
      checkpointCompletedIds:derived.checkpointCompletedIds,
      timeLimitMs:missionLimitMs(session),
      survival:session.launchType === "endless-survival",
      survivalWave:session.launchType === "endless-survival" ? Number(session.survivalWave || 1) : 0,
      survivalWavesCleared:session.launchType === "endless-survival" ? Number(session.survivalWavesCleared || 0) : 0,
      survivalIntermissionMs:session.launchType === "endless-survival" ? Math.max(0, Number(session.survivalIntermissionUntil || 0) - at) : 0,
      survivalExtractAvailable:session.launchType === "endless-survival" && Number(session.survivalWavesCleared || 0) >= 3,
    },
    world:mission.world,
    spawns:mission.spawns,
    extraction:mission.extraction,
    rescueHouse:rescueHouseFor(mission),
    civilians:civilianSnapshots(session, players, derived.rescuedIds, derived.securedCivilianIds),
    checkpoints:mission.checkpoints || [],
    fireZones:mission.fireZones || [],
    waterZones:mission.waterZones || [],
    tigers:derived.tigers,
    boss:derived.boss,
    rescuedIds:derived.rescuedIds,
    securedCivilianIds:derived.securedCivilianIds,
    capturedIds:derived.capturedIds,
    checkpointCompletedIds:derived.checkpointCompletedIds,
    objectivesReady:derived.objectivesReady,
    allRewardsClaimed:players.length === session.memberIds.length && players.every((player)=>player.rewardClaimed),
    nextStoryMissionLevel:session.launchType === "shared-story" && EXPANDED_SHARED_STORY_MISSIONS[Number(session.storyMissionLevel || 0) + 1]
      ? Number(session.storyMissionLevel || 0) + 1
      : 0,
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
  const defaultSpawn = mission.spawns[slot === 0 ? 0 : 1];
  const lastCheckpoint = (mission.checkpoints || []).reduce((last, checkpoint)=>(player.checkpointIds || []).includes(checkpoint.id) ? checkpoint : last, null);
  const spawn = lastCheckpoint
    ? { x:lastCheckpoint.x + (slot === 0 ? -42 : 42), y:lastCheckpoint.y + 54 }
    : defaultSpawn;
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
    const priorPosition = { x:player.x, y:player.y };
    const elapsed = clamp(now - player.lastMoveAt, 100, 1800);
    const maxMove = 70 + elapsed * 0.34 * def.speed;
    const moveDist = distance(player, proposed);
    if(moveDist <= maxMove){
      player.x = proposed.x;
      player.y = proposed.y;
      if(Number.isFinite(Number(patch.face))) player.face = clamp(patch.face, -Math.PI * 4, Math.PI * 4);
      if(distance(priorPosition, proposed) >= 18 && now - Number(player.lastNoiseAt || 0) >= 900){
        player.lastNoiseAt = now;
        player.lastNoiseX = proposed.x;
        player.lastNoiseY = proposed.y;
        player.lastNoiseIntensity = 0.34;
        player.lastNoiseSource = "footsteps";
      }
    }
    player.lastMoveAt = now;
  }
  if(session.status === "active" && !player.downed && (mission.checkpoints || []).length){
    const routePlayers = await memberPlayers(session);
    const routeRows = routePlayers.map((row)=>row.userId === player.userId ? player : row);
    const rescued = new Set(routeRows.flatMap((row)=>row.rescuedIds || []));
    if(mission.checkpointsBeforeRescue || rescued.size >= Number(mission.rescueRequired || 0)){
      if(!Array.isArray(player.checkpointIds)) player.checkpointIds = [];
      for(let index=0; index<mission.checkpoints.length; index++){
        const checkpoint = mission.checkpoints[index];
        const priorReady = index === 0 || player.checkpointIds.includes(mission.checkpoints[index - 1].id);
        if(priorReady && !player.checkpointIds.includes(checkpoint.id) && distance(player, checkpoint) <= Number(checkpoint.r || 120)){
          player.checkpointIds.push(checkpoint.id);
          break;
        }
      }
    }
  }
  if(session.status === "active" && !player.downed && (mission.fireZones || []).length){
    const fireZone = mission.fireZones.find((zone)=>distance(player, zone) <= Number(zone.r || 0));
    const fireCooldown = Math.max(700, Number(mission.fireHazardCooldownMs || 1400));
    if(fireZone && now - Number(player.lastFireAt || 0) >= fireCooldown){
      player.hp = clamp(player.hp - Math.max(1, Number(mission.fireHazardDamage || 8)), 0, player.maxHp);
      player.lastFireAt = now;
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
  if(session.status === "active" && !player.downed){
    const players = await memberPlayers(session);
    const threats = tigerSnapshots(session, players, now);
    const threat = threats
      .filter((t)=>!t.defeated)
      .sort((a,b)=>distance(player,a)-distance(player,b))[0];
    const tigerKills = threats.filter((t)=>t.defeated && !t.captured).length;
    const aggressionPerKill = Number.isFinite(Number(mission.aggressionPerKill))
      ? Math.max(0, Number(mission.aggressionPerKill))
      : 2;
    const nearestCarcassDistance = threat
      ? threats.filter((t)=>t.carcass).reduce((nearest, body)=>Math.min(nearest, distance(threat, body)), Infinity)
      : Infinity;
    const bloodScentActive = nearestCarcassDistance <= 360;
    const bloodRage = !!threat?.bloodRage && Number(threat.hp || 0) <= Number(threat.hpMax || 1) * 0.35;
    const livingBalance = tigerIntelligence.balanceFor({ playerCount:2, mode:session.launchType === "endless-survival" ? "Survival" : "Co-op", level:session.storyMissionLevel || 1 });
    const hazardCooldown = Math.max(650, Number(mission.hazardCooldownMs || 1250) - (bloodRage ? 300 : 0) - (bloodScentActive ? 120 : 0)) * (threat?.rubberSlowed ? 1.65 : 1) * livingBalance.pounceCooldownMul;
    const huntRange = ((threat?.boss ? 122 : 102) + (bloodScentActive ? 26 : 0)) * livingBalance.detectMul;
    if(threat && distance(player, threat) <= huntRange && now - player.lastHazardAt >= hazardCooldown){
      const armor = player.role === "assault" ? 3 : (player.role === "medic" ? 1 : 0);
      const baseDamage = threat.boss ? 13 : (threat.type === "Armored" ? 11 : 9);
      const aggressionDamage = Math.max(0, Number(mission.hazardDamageBonus || 0))
        + tigerKills * aggressionPerKill
        + (bloodRage ? 6 : 0);
      player.hp = clamp(player.hp - Math.max(5, Math.round((baseDamage + aggressionDamage - armor) * livingBalance.damageMul)), 0, player.maxHp);
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
  if(action === "start" || action === "restart" || action === "continue"){
    if(session.hostId !== uid) throw new Error("Only the squad leader can start the mission.");
    if(session.memberIds.length < 2) throw new Error("Invite one teammate before starting.");
    if(action === "start" && session.status !== "waiting") return session;
    if(action === "restart" && session.status !== "failed") throw new Error("Restart is available after the mission ends.");
    if(action === "continue"){
      if(session.launchType !== "shared-story") throw new Error("Continue Together is available for Shared Story missions.");
      if(session.status !== "complete") throw new Error("Finish this mission before continuing.");
      const finishedPlayers = await memberPlayers(session);
      if(!finishedPlayers.every((row)=>row.rewardClaimed)) throw new Error("Both players must claim this mission's reward before continuing.");
      const nextLevel = Number(session.storyMissionLevel || 0) + 1;
      if(!EXPANDED_SHARED_STORY_MISSIONS[nextLevel]) throw new Error("The next Shared Story mission has not been converted yet. You may stay in the squad or leave.");
      session.storyMissionLevel = nextLevel;
    }
    session.status = "active";
    session.startedAt = now;
    session.completedAt = 0;
    session.failureReason = "";
    session.pausedAt = 0;
    session.pausedBy = {};
    session.survivalWave = 1;
    session.survivalWavesCleared = 0;
    session.survivalIntermissionUntil = 0;
    await writeSession(session);
    const mission = missionDefinition(session);
    const players = await memberPlayers(session);
    const completedCheckpointIndex = action === "restart"
      ? (mission.checkpoints || []).reduce((last, checkpoint, index)=>players.every((row)=>(row.checkpointIds || []).includes(checkpoint.id)) ? index : last, -1)
      : -1;
    const restartCheckpoint = completedCheckpointIndex >= 0 ? mission.checkpoints[completedCheckpointIndex] : null;
    for(const p of players){
      const def = ROLE_DEFS[p.role];
      const defaultSpawn = mission.spawns[p.slot === 0 ? 0 : 1];
      const spawn = restartCheckpoint
        ? { x:restartCheckpoint.x + (p.slot === 0 ? -42 : 42), y:restartCheckpoint.y + 54 }
        : defaultSpawn;
      p.hp = def.maxHp;
      p.maxHp = def.maxHp;
      p.downed = false;
      p.livesRemaining = STARTING_LIVES;
      p.knockdowns = 0;
      p.respawnAt = 0;
      p.x = spawn.x;
      p.y = spawn.y;
      p.face = 0;
      p.ammoMode = session.launchType === "endless-survival" ? "real" : "rubber";
      if(!restartCheckpoint){
        p.bossDamage = 0;
        p.tigerDamage = {};
        p.lethalWoundedIds = [];
        p.rubberSlowUntil = {};
        p.killSites = {};
        p.captureSites = {};
        p.capturedIds = [];
        p.rescuedIds = [];
        p.securedCivilianIds = [];
        p.checkpointIds = [];
      }
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
  if(action === "ammo-mode"){
    if(session.launchType === "endless-survival") throw new Error("Endless Survival is kill-only and uses Real ammunition only.");
    player.ammoMode = ammoRules.normalizeAmmoMode(payload.ammoMode, "real") === "rubber" ? "rubber" : "real";
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "attack"){
    const players = await memberPlayers(session);
    const tigers = tigerSnapshots(session, players, now).filter((t)=>!t.defeated);
    const requestedId = cleanText(payload.tigerId, 32);
    const target = requestedId ? tigers.find((t)=>t.id === requestedId) : tigers.sort((a,b)=>distance(player,a)-distance(player,b))[0];
    if(!target) throw new Error("The tiger threat is already cleared.");
    if(distance(player, target) > (target.boss ? 178 : 164)) throw new Error(`Move closer to ${target.name}.`);
    if(now - player.lastAttackAt < 560) throw new Error("Weapon is cooling down.");
    const def = ROLE_DEFS[player.role];
    const combo = clamp(payload.combo || 0, 0, 3);
    const ammoMode = session.launchType === "endless-survival" ? "real" : (player.ammoMode === "rubber" ? "rubber" : "real");
    const rawHit = def.damage + combo * 2;
    const hit = ammoMode === "rubber"
      ? Math.max(1, Math.round(rawHit * ammoRules.damageMultiplier("rubber")))
      : Math.max(1, Math.round(rawHit * 1.18));
    const appliedHit = ammoMode === "rubber" ? Math.min(hit, Math.max(0, Number(target.hp || 0) - 1)) : hit;
    if(!player.tigerDamage || typeof player.tigerDamage !== "object") player.tigerDamage = {};
    player.tigerDamage[target.id] = clamp(Number(player.tigerDamage[target.id] || 0) + appliedHit, 0, target.hpMax);
    if(ammoMode === "real"){
      if(!Array.isArray(player.lethalWoundedIds)) player.lethalWoundedIds = [];
      if(!player.lethalWoundedIds.includes(target.id)) player.lethalWoundedIds.push(target.id);
      if(appliedHit >= Number(target.hp || 0)){
        if(!player.killSites || typeof player.killSites !== "object") player.killSites = {};
        player.killSites[target.id] = { x:Number(target.x), y:Number(target.y), killedAt:now };
      }
    }else{
      if(!player.rubberSlowUntil || typeof player.rubberSlowUntil !== "object") player.rubberSlowUntil = {};
      player.rubberSlowUntil[target.id] = now + 5200;
    }
    if(target.boss) player.bossDamage = clamp(player.bossDamage + appliedHit, 0, BOSS_HP_MAX);
    player.lastAttackAt = now;
    player.lastNoiseAt = now;
    player.lastNoiseX = Number(player.x);
    player.lastNoiseY = Number(player.y);
    player.lastNoiseIntensity = 1.35;
    player.lastNoiseSource = "gunshot";
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "capture"){
    if(session.launchType === "endless-survival") throw new Error("Capture is disabled in Endless Survival. Eliminate every tiger to clear the wave.");
    const players = await memberPlayers(session);
    const tigers = tigerSnapshots(session, players, now).filter((t)=>!t.defeated);
    const requestedId = cleanText(payload.tigerId, 32);
    const target = requestedId ? tigers.find((t)=>t.id === requestedId) : tigers.sort((a,b)=>distance(player,a)-distance(player,b))[0];
    if(!target) throw new Error("This tiger was already captured or cleared.");
    if(distance(player, target) > (target.boss ? 178 : 164)) throw new Error(`Move closer to ${target.name}.`);
    if(target.lethalWounded) throw new Error("Capture blocked: Real ammunition caused a lethal injury. Use Rubber ammunition on a fresh tiger.");
    if(Number(target.hp || 0) > Number(target.hpMax || 1) * 0.30) throw new Error("Weaken the tiger to 30% health before capture.");
    const captured = await setStateIfAbsent(`live_squad_capture_${session.code}_${session.startedAt}_${target.id}`, { userId:uid, capturedAt:now });
    if(!captured) throw new Error("Your teammate already captured this tiger.");
    if(!Array.isArray(player.capturedIds)) player.capturedIds = [];
    if(!player.capturedIds.includes(target.id)) player.capturedIds.push(target.id);
    if(!player.captureSites || typeof player.captureSites !== "object") player.captureSites = {};
    player.captureSites[target.id] = { x:Number(target.x), y:Number(target.y), capturedAt:now };
    player.lastAttackAt = now;
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "rescue"){
    const id = cleanText(payload.civilianId, 24);
    const rescueMission = missionDefinition(session);
    const civilian = rescueMission.civilians.find((c)=>c.id === id);
    if(!civilian) throw new Error("Civilian not found.");
    if(rescueMission.checkpointsBeforeRescue){
      const routePlayers = await memberPlayers(session);
      const routeState = sessionDerived(session, routePlayers, now);
      if(routeState.checkpointCompletedIds.length < (rescueMission.checkpoints || []).length){
        throw new Error("Search all marked homes with your teammate before rescuing survivors.");
      }
    }
    if(distance(player, civilian) > 82) throw new Error("Move closer to the civilian.");
    const routePlayers = await memberPlayers(session);
    const currentOwner = routePlayers.find((row)=>(row.rescuedIds || []).includes(id));
    if(currentOwner && currentOwner.userId !== uid) throw new Error(`${civilian.name} is already following your teammate.`);
    const reserved = currentOwner || await setStateIfAbsent(`live_squad_rescue_${session.code}_${session.startedAt}_${id}`, { userId:uid, rescuedAt:now });
    if(!reserved) throw new Error(`${civilian.name} is already following your teammate.`);
    if(!player.rescuedIds.includes(id)) player.rescuedIds.push(id);
    player.lastSeenAt = now;
    await writePlayer(session.code, player);
  }else if(action === "deliver"){
    const rescueMission = missionDefinition(session);
    const rescueHouse = rescueHouseFor(rescueMission);
    if(distance(player, rescueHouse) > rescueHouse.r) throw new Error("Bring your following civilians inside the Rescue House circle first.");
    const ownedFollowing = (player.rescuedIds || []).filter((id)=>!(player.securedCivilianIds || []).includes(id));
    if(!ownedFollowing.length) throw new Error("No civilians are following you right now.");
    if(!Array.isArray(player.securedCivilianIds)) player.securedCivilianIds = [];
    player.securedCivilianIds.push(...ownedFollowing);
    player.securedCivilianIds = [...new Set(player.securedCivilianIds)];
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
  const sharedLevel = sharedStory ? clamp(Math.floor(Number(session.storyMissionLevel || 1)), 1, 60) : 0;
  const sharedRewards = {
    1:{ cash:1800, perkPoints:1, seasonPoints:6, badge:"Shared Story First Patrol" },
    2:{ cash:2050, perkPoints:1, seasonPoints:7, badge:"Farm Road Guardians" },
    3:{ cash:2250, perkPoints:1, seasonPoints:8, badge:"First Encounter Duo" },
    4:{ cash:2450, perkPoints:1, seasonPoints:9, badge:"Jungle Hut Rescue" },
    5:{ cash:2700, perkPoints:1, seasonPoints:10, badge:"Jungle Trail Team" },
    6:{ cash:2950, perkPoints:1, seasonPoints:11, badge:"Tall Grass Patrol" },
    7:{ cash:3200, perkPoints:1, seasonPoints:12, badge:"Injured Escort Team" },
    8:{ cash:3500, perkPoints:2, seasonPoints:13, badge:"First Research Capture" },
    9:{ cash:3850, perkPoints:2, seasonPoints:14, badge:"Village Gate Defenders" },
    10:{ cash:4500, perkPoints:2, seasonPoints:16, badge:"Village Alpha Breakers" },
    11:{ cash:4800, perkPoints:2, seasonPoints:17, badge:"Narrow Path Guides" },
    12:{ cash:5100, perkPoints:2, seasonPoints:18, badge:"Blood Aggression Control" },
    13:{ cash:5450, perkPoints:2, seasonPoints:19, badge:"Double Research Capture" },
    14:{ cash:5800, perkPoints:2, seasonPoints:20, badge:"Doctor Amara Guard" },
    15:{ cash:6200, perkPoints:2, seasonPoints:21, badge:"Caravan Ambush Response" },
    16:{ cash:6600, perkPoints:3, seasonPoints:22, badge:"Forest Escort Team" },
    17:{ cash:7000, perkPoints:3, seasonPoints:23, badge:"Village Children Rescue" },
    18:{ cash:7500, perkPoints:3, seasonPoints:24, badge:"Aggressive Pack Researchers" },
    19:{ cash:8200, perkPoints:3, seasonPoints:26, badge:"Swarm Survivors" },
    20:{ cash:9500, perkPoints:4, seasonPoints:30, badge:"Blood Tiger Breakers" },
    21:{ cash:9900, perkPoints:4, seasonPoints:31, badge:"Deep Jungle Researchers" },
    22:{ cash:10300, perkPoints:4, seasonPoints:32, badge:"Tall Grass Trackers" },
    23:{ cash:11000, perkPoints:4, seasonPoints:34, badge:"Veil Tiger Researchers" },
    24:{ cash:11400, perkPoints:4, seasonPoints:35, badge:"River Trail Guides" },
    25:{ cash:11900, perkPoints:4, seasonPoints:36, badge:"Jungle Bridge Defenders" },
    26:{ cash:12400, perkPoints:4, seasonPoints:37, badge:"Lost Hunter Rescue" },
    27:{ cash:12900, perkPoints:5, seasonPoints:38, badge:"Abandoned Camp Escorts" },
    28:{ cash:13750, perkPoints:5, seasonPoints:40, badge:"Deep Pack Survivors" },
    29:{ cash:14600, perkPoints:5, seasonPoints:42, badge:"Helicopter Evac Team" },
    30:{ cash:16000, perkPoints:6, seasonPoints:46, badge:"Stealth Tiger Breakers" },
    31:{ cash:16600, perkPoints:6, seasonPoints:47, badge:"Abandoned Home Searchers" },
    32:{ cash:17200, perkPoints:6, seasonPoints:48, badge:"Village Street Patrol" },
    33:{ cash:17900, perkPoints:6, seasonPoints:50, badge:"Survivor Safe Route" },
    34:{ cash:18750, perkPoints:6, seasonPoints:52, badge:"Triple Capture Researchers" },
    35:{ cash:19600, perkPoints:6, seasonPoints:54, badge:"Evacuation Convoy Guard" },
    36:{ cash:20500, perkPoints:7, seasonPoints:56, badge:"Doctor Imani Protection" },
    37:{ cash:21500, perkPoints:7, seasonPoints:58, badge:"Burning Village Rescuers" },
    38:{ cash:22600, perkPoints:7, seasonPoints:60, badge:"Town Center Defenders" },
    39:{ cash:23800, perkPoints:7, seasonPoints:62, badge:"Massive Pack Survivors" },
    40:{ cash:25000, perkPoints:8, seasonPoints:65, badge:"Twin Alpha Breakers" },
    41:{ cash:25750, perkPoints:8, seasonPoints:67, badge:"Broken Bridge Guides" },
    42:{ cash:26500, perkPoints:8, seasonPoints:69, badge:"Riverbank Defenders" },
    43:{ cash:27400, perkPoints:8, seasonPoints:71, badge:"Currentstripe Researchers" },
    44:{ cash:28300, perkPoints:8, seasonPoints:73, badge:"Wounded Water Rescue" },
    45:{ cash:29250, perkPoints:8, seasonPoints:75, badge:"River Crossing Breakers" },
    46:{ cash:30250, perkPoints:9, seasonPoints:78, badge:"River Supply Guardians" },
    47:{ cash:31300, perkPoints:9, seasonPoints:81, badge:"River Camp Lifeline" },
    48:{ cash:32400, perkPoints:9, seasonPoints:84, badge:"Rescue Boat Defenders" },
    49:{ cash:33600, perkPoints:9, seasonPoints:87, badge:"Delta Pack Survivors" },
    50:{ cash:35000, perkPoints:10, seasonPoints:92, badge:"Giant River Tiger Breakers" },
    51:{ cash:35900, perkPoints:10, seasonPoints:94, badge:"Mountain Village Guides" },
    52:{ cash:36800, perkPoints:10, seasonPoints:96, badge:"Cliffside Defenders" },
    53:{ cash:37800, perkPoints:10, seasonPoints:98, badge:"Silverpeak Researchers" },
    54:{ cash:38800, perkPoints:10, seasonPoints:100, badge:"Climber Rescue Team" },
    55:{ cash:39900, perkPoints:10, seasonPoints:103, badge:"Mountain Road Breakers" },
    56:{ cash:41000, perkPoints:11, seasonPoints:106, badge:"Canyon Caravan Guard" },
    57:{ cash:42200, perkPoints:11, seasonPoints:109, badge:"Whiteout Trackers" },
    58:{ cash:43500, perkPoints:11, seasonPoints:112, badge:"Mountain Air Rescue" },
    59:{ cash:44900, perkPoints:11, seasonPoints:116, badge:"Mountain Swarm Survivors" },
    60:{ cash:46500, perkPoints:12, seasonPoints:122, badge:"Mountain Alpha Breakers" },
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
  const survivalWaves = clamp(Math.floor(Number(session.survivalWavesCleared || 0)), 3, 50);
  const operationReward = operationId === "endless-survival"
    ? {
        cash:6000 + survivalWaves * 2500,
        perkPoints:1 + Math.floor(survivalWaves / 3),
        seasonPoints:10 + survivalWaves * 4,
        badge:"Last Stand Survivor",
      }
    : (operationRewards[operationId] || operationRewards["live-squad"]);
  const auditPlayers = await memberPlayers(session);
  const auditDerived = sessionDerived(session, auditPlayers, nowMs());
  const governmentAudit = {
    runId:`coop:${session.code}:${uid}`,
    mode:operationId === "endless-survival" ? "Survival" : (sharedStory ? "Story" : "Arcade"),
    captures:auditDerived.capturedIds.length,
    kills:auditDerived.tigerKills,
    evac:auditDerived.securedCivilianIds.length,
    civDead:0,
    exempt:operationId === "endless-survival",
  };
  return {
    firstClaim,
    receipt:`${sharedStory ? `shared-story-${sharedLevel}` : operationId}:${session.code}:${uid}`,
    storyProgress:sharedStory ? { completedLevel:sharedLevel, unlockLevel:Math.min(100, sharedLevel + 1) } : null,
    reward:sharedStory
      ? sharedRewards[sharedLevel]
      : operationReward,
    governmentAudit,
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
