const crypto = require("crypto");
const { getState, setState } = require("./metrics-store");
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
  const missionTigerIds = new Set(mission.tigers.map((tiger)=>tiger.id));
  const capturedIds = [...new Set(players.flatMap((p)=>p.capturedIds || []))]
    .filter((id)=>missionTigerIds.has(id));
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
  const objectivesReady = rescuedIds.length >= mission.rescueRequired && captureTargetsReady && checkpointsReady && (allTigersCleared || legacyBossOnlyRoom);
  const squadWiped = players.length === session.memberIds.length && players.every((p)=>p.downed && Number(p.respawnAt || 0) <= 0 && Number(p.livesRemaining || 0) <= 0);
  return { rescuedIds, capturedIds, checkpointCompletedIds, checkpointsReady, bossDamage, bossHp, boss, tigers, tigerKills, aggressionPerKill, aggressionBonus, bloodRageActive, onlineIds, extractionReadyIds, objectivesReady, allTigersCleared, squadWiped };
}

function civilianSnapshots(session, players, rescuedIds){
  const mission = missionDefinition(session);
  return mission.civilians.map((civilian, index)=>{
    const owner = players.find((player)=>(player.rescuedIds || []).includes(civilian.id));
    if(!owner) return { ...civilian, following:false, followingUserId:0, secured:false };
    const row = Math.floor(index / 2);
    const side = index % 2 === 0 ? -1 : 1;
    return {
      ...civilian,
      x:clamp(Number(owner.x || 0) + side * (38 + row * 8), 24, mission.world.width - 24),
      y:clamp(Number(owner.y || 0) + 42 + row * 30, 24, mission.world.height - 24),
      following:true,
      followingUserId:owner.userId,
      secured:distance(owner, mission.extraction) <= mission.extraction.r,
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
    civilians:civilianSnapshots(session, players, derived.rescuedIds),
    checkpoints:mission.checkpoints || [],
    tigers:derived.tigers,
    boss:derived.boss,
    rescuedIds:derived.rescuedIds,
    capturedIds:derived.capturedIds,
    checkpointCompletedIds:derived.checkpointCompletedIds,
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
    if(rescued.size >= Number(mission.rescueRequired || 0)){
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
    const target = tigers.find((t)=>t.id === requestedId) || tigers.sort((a,b)=>distance(player,a)-distance(player,b))[0];
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
    const target = tigers.find((t)=>t.id === requestedId) || tigers.sort((a,b)=>distance(player,a)-distance(player,b))[0];
    if(!target) throw new Error("The tiger threat is already cleared.");
    if(distance(player, target) > (target.boss ? 178 : 164)) throw new Error(`Move closer to ${target.name}.`);
    if(target.lethalWounded) throw new Error("Capture blocked: Real ammunition caused a lethal injury. Use Rubber ammunition on a fresh tiger.");
    if(Number(target.hp || 0) > Number(target.hpMax || 1) * 0.30) throw new Error("Weaken the tiger to 30% health before capture.");
    if(!Array.isArray(player.capturedIds)) player.capturedIds = [];
    if(!player.capturedIds.includes(target.id)) player.capturedIds.push(target.id);
    if(!player.captureSites || typeof player.captureSites !== "object") player.captureSites = {};
    player.captureSites[target.id] = { x:Number(target.x), y:Number(target.y), capturedAt:now };
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
  const sharedLevel = sharedStory ? clamp(Math.floor(Number(session.storyMissionLevel || 1)), 1, 30) : 0;
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
    evac:auditDerived.rescuedIds.length,
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
