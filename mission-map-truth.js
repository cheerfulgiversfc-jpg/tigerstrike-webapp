(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerStrikeMissionMapTruth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const VERSION = "10.26";
  const MAX_MISSION = 73;
  const point = (x, y)=>Object.freeze({ x, y });
  const mark = (id, type, label, x, y, action="", required=false)=>Object.freeze({
    id, type, label, x, y, action, required:!!required
  });
  const mission = (level, title, chapter, civilians, tigers, captures, extraction, landmarks, route=[])=>Object.freeze({
    level, title, chapter, civilians, tigers, captures, extraction,
    landmarks:Object.freeze(landmarks),
    route:Object.freeze(route),
    requiredActionIds:Object.freeze(landmarks.filter((item)=>item.required).map((item)=>item.id)),
  });

  // Normalized coordinates are the single source of truth used by both the
  // large solo world and the 1200x1100 Live Squad world. Landmarks that have a
  // required action are functional mission objectives, not decorative labels.
  const MISSIONS = Object.freeze({
    1:mission(1,"Jungle Edge Evacuation",1,2,2,0,"ground",[
      mark("edge_homes","home","Jungle Edge Homes",.22,.25), mark("trail_gate","gate","Evacuation Trail Gate",.52,.51,"secure",true), mark("safe_house","safe","Village Safe House",.84,.70)
    ],[point(.22,.25),point(.52,.51),point(.84,.70)]),
    2:mission(2,"Farm Road Rescue",1,3,3,0,"ground",[
      mark("farmstead","farm","Farmstead",.24,.28), mark("farm_road","road","Farm Road",.53,.50,"secure",true), mark("road_evac","safe","Roadside Evacuation",.84,.70)
    ],[point(.24,.28),point(.53,.50),point(.84,.70)]),
    3:mission(3,"First Tiger Encounter",1,0,1,0,"ground",[
      mark("tracking_post","research","Tracking Post",.29,.34,"scan",true), mark("encounter_ground","boss","First Encounter Ground",.57,.51), mark("extraction","safe","Ranger Extraction",.84,.70)
    ],[point(.29,.34),point(.57,.51)]),
    4:mission(4,"Jungle Hut Rescue",1,3,2,0,"ground",[
      mark("rescue_hut","hut","Trapped Villagers' Hut",.34,.32,"search",true), mark("hut_trail","trail","Hut Rescue Trail",.58,.54), mark("safe_house","safe","Village Safe House",.84,.70)
    ],[point(.34,.32),point(.58,.54),point(.84,.70)]),
    5:mission(5,"Jungle Trail Escort",1,4,3,0,"ground",[
      mark("trail_entry","trail","Jungle Trail Entry",.24,.27,"secure",true), mark("trail_crossing","trail","Trail Crossing",.52,.50,"secure",true), mark("trail_exit","safe","Jungle Trail Exit",.83,.70)
    ],[point(.24,.27),point(.52,.50),point(.83,.70)]),
    6:mission(6,"Tall Grass Ambush",1,0,3,0,"ground",[
      mark("grass_west","grass","West Tall Grass",.28,.34), mark("grass_center","grass","Central Ambush Grass",.55,.51,"scan",true), mark("grass_east","grass","East Tall Grass",.78,.36)
    ],[point(.28,.34),point(.55,.51),point(.78,.36)]),
    7:mission(7,"Injured Villager Escort",1,1,2,0,"ground",[
      mark("aid_post","clinic","Field Aid Post",.30,.31,"triage",true), mark("medical_route","trail","Medical Evacuation Route",.57,.53,"secure",true), mark("med_evac","safe","Medical Safe Zone",.84,.70)
    ],[point(.30,.31),point(.57,.53),point(.84,.70)]),
    8:mission(8,"First Research Capture",1,0,1,1,"ground",[
      mark("research_beacon","research","Wildlife Research Beacon",.34,.32,"scan",true), mark("capture_pen","cage","Live Capture Pen",.58,.54,"prepare",true), mark("transport","vehicle","Wildlife Transport Point",.84,.70)
    ],[point(.34,.32),point(.58,.54),point(.84,.70)]),
    9:mission(9,"Village Gate Defense",1,0,4,0,"ground",[
      mark("west_gate","gate","West Village Gate",.29,.50,"defend",true), mark("main_gate","gate","Main Village Gate",.54,.50,"defend",true), mark("east_gate","gate","East Village Gate",.80,.50,"defend",true)
    ],[point(.29,.50),point(.54,.50),point(.80,.50)]),
    10:mission(10,"Village Alpha",1,0,1,0,"ground",[
      mark("village_square","village","Village Square",.31,.31), mark("alpha_territory","boss","Village Alpha Territory",.57,.52,"scan",true), mark("chapter_evac","safe","Chapter Evacuation",.84,.70)
    ],[point(.31,.31),point(.57,.52)]),
    11:mission(11,"Narrow Path Escort",2,4,3,0,"ground",[
      mark("path_entry","trail","Narrow Path Entry",.33,.24,"secure",true), mark("path_choke","trail","Narrow Path Choke",.52,.49,"secure",true), mark("path_exit","safe","Narrow Path Exit",.72,.72,"secure",true)
    ],[point(.33,.24),point(.52,.49),point(.72,.72)]),
    12:mission(12,"Blood Aggression",2,0,4,0,"ground",[
      mark("blood_west","blood","West Blood Trail",.29,.31,"scan",true), mark("aggression_core","boss","Aggression Core",.55,.51), mark("blood_east","blood","East Blood Trail",.78,.68)
    ],[point(.29,.31),point(.55,.51),point(.78,.68)]),
    13:mission(13,"Double Research Capture",2,0,3,2,"ground",[
      mark("capture_lab","research","Research Capture Lab",.31,.30,"prepare",true), mark("capture_zone_a","cage","Capture Zone Alpha",.48,.48), mark("capture_zone_b","cage","Capture Zone Bravo",.72,.61), mark("transport","vehicle","Wildlife Transport",.85,.70)
    ],[point(.31,.30),point(.48,.48),point(.72,.61),point(.85,.70)]),
    14:mission(14,"Protect Doctor Amara",2,1,3,0,"ground",[
      mark("clinic","clinic","Doctor Amara's Clinic",.47,.30,"protect",true), mark("clinic_perimeter","barricade","Clinic Defense Perimeter",.57,.50,"defend",true), mark("medical_evac","safe","Medical Evacuation",.84,.70)
    ],[point(.47,.30),point(.57,.50),point(.84,.70)]),
    15:mission(15,"Caravan Ambush",2,4,4,0,"vehicle",[
      mark("caravan_wreck","caravan","Ambushed Caravan",.29,.49,"repair",true), mark("caravan_rally","road","Caravan Rally Point",.55,.50,"secure",true), mark("convoy_exit","vehicle","Caravan Exit",.83,.70)
    ],[point(.29,.49),point(.55,.50),point(.83,.70)]),
    16:mission(16,"Five-Civilian Forest Escort",2,5,4,0,"ground",[
      mark("forest_entry","forest","Forest Escort Entry",.24,.28,"secure",true), mark("forest_clearing","forest","Protected Forest Clearing",.54,.50,"secure",true), mark("forest_exit","safe","Forest Safe Zone",.84,.70)
    ],[point(.24,.28),point(.54,.50),point(.84,.70)]),
    17:mission(17,"Village Children Rescue",2,4,3,0,"ground",[
      mark("child_home_north","home","North Child Hideout",.22,.25,"search",true), mark("child_home_market","home","Market Child Hideout",.43,.39,"search",true), mark("child_home_east","home","East Child Hideout",.69,.26,"search",true), mark("child_home_south","home","South Child Hideout",.79,.65,"search",true), mark("children_evac","safe","Children's Safe House",.88,.72)
    ],[point(.22,.25),point(.43,.39),point(.69,.26),point(.79,.65),point(.88,.72)]),
    18:mission(18,"Aggressive Pack Capture",2,0,4,2,"ground",[
      mark("pack_scan","research","Aggressive Pack Scanner",.30,.33,"scan",true), mark("capture_lane","cage","Pack Capture Lane",.55,.52,"prepare",true), mark("research_transport","vehicle","Research Transport",.84,.70)
    ],[point(.30,.33),point(.55,.52),point(.84,.70)]),
    19:mission(19,"High-Aggression Swarm",2,0,9,0,"ground",[
      mark("swarm_perimeter","barricade","Swarm Defense Perimeter",.32,.34,"defend",true), mark("swarm_core","boss","High-Aggression Swarm Core",.56,.51), mark("fallback","safe","Emergency Fallback",.84,.70)
    ],[point(.32,.34),point(.56,.51),point(.84,.70)]),
    20:mission(20,"Blood Tiger",2,0,1,0,"ground",[
      mark("blood_lab","research","Blood Research Station",.30,.30,"scan",true), mark("blood_arena","boss","Blood Tiger Territory",.57,.52), mark("chapter_evac","safe","Chapter Evacuation",.84,.70)
    ],[point(.30,.30),point(.57,.52),point(.84,.70)]),
    21:mission(21,"Research Team Escort",3,4,4,0,"ground",[
      mark("research_camp","research","Deep Jungle Research Camp",.33,.35,"secure",true), mark("sample_site","research","Sample Collection Site",.55,.48,"sample",true), mark("deep_exit","safe","Deep Jungle Exit",.77,.66,"secure",true)
    ],[point(.33,.35),point(.55,.48),point(.77,.66)]),
    22:mission(22,"Tall Grass Predators",3,0,5,0,"ground",[
      mark("grass_north","grass","Northern Concealment",.27,.31), mark("grass_core","grass","Hidden Grass Pack",.55,.50,"scan",true), mark("grass_south","grass","Southern Concealment",.76,.66)
    ],[point(.27,.31),point(.55,.50),point(.76,.66)]),
    23:mission(23,"Veil Tiger Capture",3,0,3,1,"ground",[
      mark("veil_scanner","research","Veil Tracking Beacon",.31,.32,"scan",true), mark("veil_capture","cage","Veil Tiger Live-Capture Zone",.55,.50,"prepare",true), mark("veil_transport","vehicle","Veil Wildlife Transport",.84,.70)
    ],[point(.31,.32),point(.55,.50),point(.84,.70)]),
    24:mission(24,"River Trail Escort",3,5,4,0,"ground",[
      mark("river_entry","river","River Trail Entry",.30,.38,"secure",true), mark("river_crossing","bridge","River Crossing",.54,.57,"cross",true), mark("far_bank","safe","Far Bank Safe Route",.77,.68,"secure",true)
    ],[point(.30,.38),point(.54,.57),point(.77,.68)]),
    25:mission(25,"Jungle Bridge Ambush",3,0,5,0,"ground",[
      mark("bridge_approach","bridge","Jungle Bridge Approach",.30,.46,"secure",true), mark("bridge_center","bridge","Jungle Bridge Center",.53,.58,"secure",true), mark("far_bank","barricade","Far Bank Perimeter",.76,.68,"secure",true)
    ],[point(.30,.46),point(.53,.58),point(.76,.68)]),
    26:mission(26,"Lost Hunter Rescue",3,1,4,0,"ground",[
      mark("hunter_camp","camp","Lost Hunter Camp",.47,.28,"search",true), mark("hunter_rally","clinic","Hunter Rally Point",.49,.40,"triage",true), mark("return_trail","trail","Hunter Return Trail",.73,.66,"secure",true)
    ],[point(.47,.28),point(.49,.40),point(.73,.66)]),
    27:mission(27,"Abandoned Camp Escort",3,5,5,0,"ground",[
      mark("camp_gate","camp","Abandoned Camp Gate",.30,.35,"search",true), mark("supply_yard","camp","Empty Supply Yard",.55,.47,"secure",true), mark("escape_lane","safe","Camp Escape Lane",.76,.67,"secure",true)
    ],[point(.30,.35),point(.55,.47),point(.76,.67)]),
    28:mission(28,"Large Pack Attack",3,0,8,0,"ground",[
      mark("pack_warning","research","Pack Warning Beacon",.30,.32,"scan",true), mark("pack_territory","boss","Large Pack Territory",.55,.50), mark("fallback","barricade","Deep Jungle Fallback",.80,.68,"defend",true)
    ],[point(.30,.32),point(.55,.50),point(.80,.68)]),
    29:mission(29,"Helicopter Evacuation",3,7,5,0,"helicopter",[
      mark("lz_approach","trail","Helicopter LZ Approach",.31,.38,"secure",true), mark("lz_perimeter","barricade","Helicopter Perimeter",.55,.50,"defend",true), mark("boarding_zone","helicopter","Helicopter Boarding Zone",.78,.67,"board",true)
    ],[point(.31,.38),point(.55,.50),point(.78,.67)]),
    30:mission(30,"Stealth Tiger",3,0,1,0,"ground",[
      mark("tracking_array","research","Stealth Tracking Array",.31,.32,"scan",true), mark("stealth_territory","boss","Stealth Tiger Territory",.56,.51), mark("chapter_evac","safe","Deep Jungle Extraction",.84,.70)
    ],[point(.31,.32),point(.56,.51),point(.84,.70)]),
    31:mission(31,"Abandoned Home Search",4,4,4,0,"ground",[
      mark("home_north","home","North Abandoned Home",.23,.24,"search",true), mark("home_market","home","Market Abandoned Home",.42,.42,"search",true), mark("home_east","home","East Abandoned Home",.64,.26,"search",true), mark("home_river","home","Riverside Abandoned Home",.77,.66,"search",true), mark("survivor_evac","safe","Survivor Evacuation",.87,.72)
    ],[point(.23,.24),point(.42,.42),point(.64,.26),point(.77,.66),point(.87,.72)]),
    32:mission(32,"Village Street Patrol",4,0,6,0,"ground",[
      mark("north_street","road","North Village Street",.28,.24), mark("market_crossroad","barricade","Market Crossroad",.54,.50,"secure",true), mark("east_street","road","East Village Street",.80,.50), mark("south_street","road","South Village Street",.54,.76)
    ],[point(.28,.24),point(.54,.50),point(.80,.50),point(.54,.76)]),
    33:mission(33,"Survivor Safe Route",4,6,4,0,"ground",[
      mark("safe_lane","trail","Marked Safe Lane",.31,.37,"secure",true), mark("clinic_rally","clinic","Abandoned Clinic Rally",.55,.49,"triage",true), mark("evac_approach","safe","Survivor Evac Approach",.77,.66,"secure",true)
    ],[point(.31,.37),point(.55,.49),point(.77,.66)]),
    34:mission(34,"Triple Research Capture",4,0,5,3,"ground",[
      mark("village_study_lab","research","Village Study Laboratory",.24,.28,"scan",true), mark("capture_pen_alpha","cage","Capture Pen Alpha",.43,.43,"prepare",true), mark("capture_pen_bravo","cage","Capture Pen Bravo",.62,.35,"prepare",true), mark("capture_pen_charlie","cage","Capture Pen Charlie",.70,.61,"prepare",true), mark("study_transport","vehicle","Research Transport",.86,.70)
    ],[point(.24,.28),point(.43,.43),point(.62,.35),point(.70,.61),point(.86,.70)]),
    35:mission(35,"Evacuation Convoy Ambush",4,5,5,0,"vehicle",[
      mark("convoy_wreck","caravan","Disabled Evacuation Convoy",.22,.27,"repair",true), mark("convoy_rally","vehicle","Convoy Rally Point",.31,.47,"secure",true), mark("convoy_crossroad","road","Convoy Crossroad",.54,.47,"secure",true), mark("convoy_exit","vehicle","Convoy Exit Lane",.75,.63,"secure",true), mark("road_extraction","safe","Convoy Extraction",.88,.72)
    ],[point(.22,.27),point(.31,.47),point(.54,.47),point(.75,.63),point(.88,.72)]),
    36:mission(36,"Doctor Imani Sample Route",4,1,4,0,"ground",[
      mark("imani_clinic","clinic","Doctor Imani Field Clinic",.31,.27,"protect",true), mark("sample_north","research","North Sample Site",.31,.35,"sample",true), mark("sample_center","research","Center Sample Site",.54,.47,"sample",true), mark("sample_east","research","East Sample Site",.74,.62,"sample",true), mark("research_evac","safe","Research Evacuation",.88,.72)
    ],[point(.31,.27),point(.31,.35),point(.54,.47),point(.74,.62),point(.88,.72)]),
    37:mission(37,"Burning Village Rescue",4,6,5,0,"ground",[
      mark("north_house_fire","fire","North House Fire",.29,.27), mark("market_fire","fire","Market Fire",.48,.42), mark("east_block_fire","fire","East Block Fire",.67,.29), mark("south_block_fire","fire","South Block Fire",.61,.62), mark("clear_fire_lane","trail","Clear Fire Lane",.33,.47,"secure",true), mark("burning_market_bypass","road","Burning Market Bypass",.56,.52,"secure",true), mark("fire_rescue_exit","safe","Fire Rescue Exit",.76,.64,"secure",true), mark("relief_staging","clinic","Village Relief Staging",.88,.72)
    ],[point(.20,.23),point(.33,.47),point(.56,.52),point(.76,.64),point(.88,.72)]),
    38:mission(38,"Town Center Swarm",4,0,10,0,"ground",[
      mark("west_village_approach","road","West Village Approach",.18,.50), mark("north_town_barricade","barricade","North Town Barricade",.50,.25), mark("town_center_defense","barricade","Town Center Defense Ring",.52,.50), mark("east_village_approach","road","East Village Approach",.82,.50), mark("squad_extraction","safe","Squad Extraction",.84,.72)
    ],[point(.18,.50),point(.50,.25),point(.52,.50),point(.82,.50),point(.84,.72)]),
    39:mission(39,"Massive Village Pack",4,0,12,0,"ground",[
      mark("pack_territory_west","forest","Pack Territory West",.24,.43), mark("pack_territory_north","forest","Pack Territory North",.50,.24), mark("massive_pack_core","boss","Massive Pack Core",.54,.50), mark("pack_territory_south","forest","Pack Territory South",.56,.72), mark("squad_extraction","safe","Squad Extraction",.86,.70)
    ],[point(.24,.43),point(.50,.24),point(.54,.50),point(.56,.72),point(.86,.70)]),
    40:mission(40,"Twin Alpha Tigers",4,0,2,0,"ground",[
      mark("alpha_tracking_command","research","Alpha Tracking Command",.21,.28), mark("ashclaw_territory","boss","Ashclaw Alpha Territory",.39,.48), mark("twin_alpha_divide","barricade","Twin Alpha Divide",.56,.50), mark("ruinstripe_territory","boss","Ruinstripe Alpha Territory",.73,.48), mark("chapter_extraction","safe","Chapter 4 Extraction",.87,.72)
    ],[point(.21,.28),point(.39,.48),point(.56,.50),point(.73,.48),point(.87,.72)]),
    41:mission(41,"Broken Bridge Escort",5,6,4,0,"ground",[
      mark("broken_bridge_entry","bridge","Broken Bridge Entry",.25,.45,"secure",true), mark("emergency_plank_crossing","bridge","Emergency Plank Crossing",.47,.50,"cross",true), mark("far_riverbank_rally","safe","Far Riverbank Rally",.70,.55,"secure",true), mark("river_rescue_extraction","safe","River Rescue Extraction",.88,.72)
    ],[point(.20,.30),point(.25,.45),point(.47,.50),point(.70,.55),point(.88,.72)]),
    42:mission(42,"Riverbank Attack",5,0,7,0,"ground",[
      mark("west_bank_reeds","river","West Bank Reeds",.23,.40), mark("riverbank_shallows","river","Riverbank Shallows",.49,.54), mark("east_bank_reeds","grass","East Bank Reeds",.73,.41), mark("riverbank_fallback","barricade","Riverbank Fallback",.82,.64), mark("river_extraction","safe","Riverbank Extraction",.89,.73)
    ],[point(.23,.40),point(.49,.54),point(.73,.41),point(.82,.64),point(.89,.73)]),
    43:mission(43,"River Tiger Capture",5,0,4,1,"ground",[
      mark("river_study_station","research","River Study Station",.26,.30,"scan",true), mark("currentstripe_pool","river","Currentstripe Capture Pool",.51,.48), mark("live_capture_pen","cage","Currentstripe Live-Capture Pen",.66,.58,"prepare",true), mark("wildlife_transport","vehicle","River Wildlife Transport",.87,.72)
    ],[point(.26,.30),point(.51,.48),point(.66,.58),point(.87,.72)]),
    44:mission(44,"Wounded Water Escort",5,1,4,0,"ground",[
      mark("wounded_villager_aid","clinic","Wounded Villager Aid Point",.20,.29,"triage",true), mark("shallow_water_entry","river","Shallow Water Entry",.31,.46,"secure",true), mark("midstream_safety_point","river","Midstream Safety Point",.53,.54,"cross",true), mark("dry_bank_medical_rally","clinic","Dry Bank Medical Rally",.77,.61,"triage",true), mark("medical_extraction","safe","River Medical Extraction",.89,.73)
    ],[point(.20,.29),point(.31,.46),point(.53,.54),point(.77,.61),point(.89,.73)]),
    45:mission(45,"River Crossing Ambush",5,0,8,0,"ground",[
      mark("west_bank_defense","barricade","West Bank Defense",.29,.43,"defend",true), mark("crossing_center","river","Crossing Center",.52,.52,"secure",true), mark("east_bank_defense","barricade","East Bank Defense",.76,.59,"defend",true), mark("crossing_extraction","safe","Secured Crossing Extraction",.89,.73)
    ],[point(.29,.43),point(.52,.52),point(.76,.59),point(.89,.73)]),
    46:mission(46,"River Supply Convoy",5,4,5,0,"ground",[
      mark("supply_convoy_rally","caravan","Supply Convoy Rally",.20,.31,"protect",true), mark("flooded_road_crossing","river","Flooded Road Crossing",.55,.53,"secure",true), mark("river_supply_depot","vehicle","River Supply Depot",.76,.64,"secure",true), mark("convoy_extraction","safe","Supply Convoy Extraction",.89,.73)
    ],[point(.20,.31),point(.32,.42),point(.55,.53),point(.76,.64),point(.89,.73)]),
    47:mission(47,"River Camp Escort",5,7,5,0,"ground",[
      mark("river_trail_marker","trail","River Trail Marker",.30,.40,"secure",true), mark("river_camp_approach","river","River Camp Approach",.56,.53,"cross",true), mark("river_camp_gate","gate","River Camp Gate",.79,.64,"secure",true), mark("camp_extraction","safe","River Camp Extraction",.90,.73)
    ],[point(.18,.27),point(.30,.40),point(.56,.53),point(.79,.64),point(.90,.73)]),
    48:mission(48,"Rescue Boat Defense",5,4,7,0,"boat",[
      mark("river_rescue_dock","river","River Rescue Dock",.20,.31,"secure",true), mark("boat_channel","river","Rescue Boat Channel",.43,.49,"cross",true), mark("boat_defense_perimeter","barricade","Boat Defense Perimeter",.66,.57,"defend",true), mark("rescue_boat_boarding","vehicle","Rescue Boat Boarding Zone",.88,.72,"board",true)
    ],[point(.20,.31),point(.43,.49),point(.66,.57),point(.88,.72)]),
    49:mission(49,"River Delta Pack",5,0,11,0,"ground",[
      mark("west_delta_channel","river","West Delta Channel",.22,.38,"secure",true), mark("delta_pack_core","boss","Eleven-Tiger Delta Pack",.51,.49,"defend",true), mark("east_delta_channel","river","East Delta Channel",.73,.42,"cross",true), mark("delta_fallback","barricade","Delta Fallback Line",.79,.64,"secure",true), mark("delta_extraction","safe","Delta Extraction",.90,.73)
    ],[point(.22,.38),point(.51,.49),point(.73,.42),point(.79,.64),point(.90,.73)]),
    50:mission(50,"Giant River Tiger",5,0,1,0,"ground",[
      mark("river_command","research","River Command Sonar",.23,.30,"scan",true), mark("giant_tiger_channel","boss","Giant River Tiger Territory",.55,.49,"defend",true), mark("tide_ward","barricade","Tidefang Safety Ward",.72,.60,"defend",true), mark("chapter_extraction","safe","Chapter 5 Extraction",.90,.73)
    ],[point(.23,.30),point(.55,.49),point(.72,.60),point(.90,.73)]),
    51:mission(51,"Mountain Village Escort",6,6,4,0,"ground",[
      mark("lower_ridge_entry","trail","Lower Ridge Entry",.28,.38,"secure",true), mark("mountain_pass","trail","Mountain Pass",.51,.48,"secure",true), mark("shelter_ridge","safe","Shelter Ridge",.75,.62,"secure",true), mark("mountain_village_extraction","safe","Mountain Village Extraction",.90,.73)
    ],[point(.17,.24),point(.28,.38),point(.51,.48),point(.75,.62),point(.90,.73)]),
    52:mission(52,"Cliffside Attack",6,0,7,0,"ground",[
      mark("west_cliff_ledge","mountain","West Cliff Ledge",.24,.31,"scan",true), mark("high_pass_defense","barricade","High Pass Defense",.51,.48,"defend",true), mark("east_cliff_ledge","mountain","East Cliff Ledge",.76,.35,"scan",true), mark("cliffside_fallback","safe","Cliffside Fallback",.90,.73)
    ],[point(.24,.31),point(.51,.48),point(.76,.35),point(.90,.73)]),
    53:mission(53,"Silverpeak Capture",6,0,4,1,"ground",[
      mark("silverpeak_tracking_post","research","Silverpeak Tracking Post",.24,.30,"scan",true), mark("silverpeak_territory","mountain","Silverpeak Tiger Territory",.52,.48,"defend",true), mark("silverpeak_capture_pen","cage","Silverpeak Live-Capture Pen",.69,.60,"prepare",true), mark("mountain_wildlife_transport","vehicle","Mountain Wildlife Transport",.89,.72)
    ],[point(.24,.30),point(.52,.48),point(.69,.60),point(.89,.72)]),
    54:mission(54,"Climber Rescue",6,4,4,0,"ground",[
      mark("climber_search_ledges","mountain","Trapped Climber Ledges",.22,.25,"search",true), mark("upper_ledge_rally","mountain","Upper Ledge Rally",.30,.39,"secure",true), mark("rope_descent","trail","Rope Descent",.54,.52,"secure",true), mark("climber_rescue_shelter","safe","Climber Rescue Shelter",.76,.68,"secure",true), mark("climber_extraction","safe","Climber Extraction",.90,.73)
    ],[point(.22,.25),point(.30,.39),point(.54,.52),point(.76,.68),point(.90,.73)]),
    55:mission(55,"Mountain Road Pack",6,0,9,0,"ground",[
      mark("mountain_road_entry","road","Mountain Road Entry",.28,.42,"secure",true), mark("hairpin_turn","road","Hairpin Turn",.52,.52,"secure",true), mark("nine_tiger_pack_core","boss","Nine-Tiger Road Pack",.63,.43,"defend",true), mark("mountain_road_exit","safe","Mountain Road Exit",.76,.68,"secure",true), mark("road_extraction","safe","Road Extraction",.90,.73)
    ],[point(.28,.42),point(.52,.52),point(.63,.43),point(.76,.68),point(.90,.73)]),
    56:mission(56,"Canyon Caravan",6,5,5,0,"ground",[
      mark("caravan_rally","caravan","Mountain Caravan Rally",.20,.27,"protect",true), mark("canyon_mouth","mountain","Canyon Mouth",.29,.42,"secure",true), mark("narrow_canyon_bend","trail","Narrow Canyon Bend",.53,.53,"secure",true), mark("highland_exit","safe","Highland Exit",.76,.68,"secure",true), mark("caravan_extraction","safe","Caravan Extraction",.90,.73)
    ],[point(.20,.27),point(.29,.42),point(.53,.53),point(.76,.68),point(.90,.73)]),
    57:mission(57,"Whiteout Patrol",6,0,7,0,"ground",[
      mark("lower_visibility_beacon","beacon","Lower Visibility Beacon",.28,.40,"activate",true), mark("mid_ridge_visibility_beacon","beacon","Mid-Ridge Visibility Beacon",.53,.52,"activate",true), mark("whiteout_pack_zone","mountain","Seven-Tiger Whiteout Zone",.64,.42,"scan",true), mark("extraction_visibility_beacon","beacon","Extraction Visibility Beacon",.76,.68,"activate",true), mark("whiteout_extraction","safe","Whiteout Extraction",.90,.73)
    ],[point(.28,.40),point(.53,.52),point(.64,.42),point(.76,.68),point(.90,.73)]),
    58:mission(58,"Mountain Air Rescue",6,5,6,0,"helicopter",[
      mark("mountain_rescue_camp","clinic","Mountain Rescue Crew Camp",.20,.27,"protect",true), mark("mountain_lz_approach","trail","Mountain LZ Approach",.30,.42,"secure",true), mark("mountain_lz_perimeter","barricade","Mountain LZ Perimeter",.55,.54,"defend",true), mark("rescue_helicopter_boarding","helicopter","Rescue Helicopter Boarding",.77,.69,"board",true), mark("air_rescue_departure","safe","Air Rescue Departure Lane",.90,.73)
    ],[point(.20,.27),point(.30,.42),point(.55,.54),point(.77,.69),point(.90,.73)]),
    59:mission(59,"Mountain Swarm",6,0,12,0,"ground",[
      mark("west_swarm_ridge","mountain","West Swarm Ridge",.23,.34,"scan",true), mark("mountain_swarm_core","boss","Twelve-Tiger Mountain Swarm",.52,.49,"defend",true), mark("east_swarm_ridge","mountain","East Swarm Ridge",.76,.36,"scan",true), mark("summit_fallback","barricade","Summit Fallback Line",.78,.66,"defend",true), mark("swarm_extraction","safe","Mountain Swarm Extraction",.90,.73)
    ],[point(.23,.34),point(.52,.49),point(.76,.36),point(.78,.66),point(.90,.73)]),
    60:mission(60,"Mountain Alpha Tiger",6,0,1,0,"ground",[
      mark("summit_tracking_command","research","Summit Alpha Tracking Command",.23,.30,"scan",true), mark("mountain_alpha_territory","boss","Mountain Alpha Territory",.55,.49,"defend",true), mark("summit_rage_ward","barricade","Summit Rage Safety Ward",.72,.61,"defend",true), mark("chapter_six_extraction","safe","Chapter 6 Extraction",.90,.73)
    ],[point(.23,.30),point(.55,.49),point(.72,.61),point(.90,.73)]),
    61:mission(61,"Deep Research Escort",7,6,5,0,"ground",[
      mark("deep_research_camp","research","Deepwild Research Camp",.18,.25,"protect",true), mark("canopy_research_gate","gate","Canopy Research Gate",.30,.40,"secure",true), mark("deep_field_laboratory","research","Deep Field Laboratory",.55,.52,"secure",true), mark("jungle_core_station","research","Jungle Core Station",.78,.67,"secure",true), mark("research_extraction","safe","Research Team Extraction",.90,.73)
    ],[point(.18,.25),point(.30,.40),point(.55,.52),point(.78,.67),point(.90,.73)]),
    62:mission(62,"Guarded Cave Entrances",7,0,8,0,"ground",[
      mark("west_cave_entrance","den","West Cave Entrance",.23,.34,"secure",true), mark("north_cave_entrance","den","North Cave Entrance",.43,.25,"secure",true), mark("core_cave_entrance","den","Core Cave Entrance",.62,.49,"secure",true), mark("east_cave_entrance","den","East Cave Entrance",.80,.67,"secure",true), mark("cave_extraction","safe","Cave Perimeter Extraction",.90,.73)
    ],[point(.23,.34),point(.43,.25),point(.62,.49),point(.80,.67),point(.90,.73)]),
    63:mission(63,"Four-Tiger Research Capture",7,0,6,4,"ground",[
      mark("territory_research_command","research","Territory Research Command",.22,.28,"scan",true), mark("ember_capture_zone","cage","Embercoat Capture Zone",.31,.39), mark("vine_capture_zone","cage","Vinestripe Capture Zone",.46,.30), mark("mist_capture_zone","cage","Mistpaw Capture Zone",.64,.54), mark("dusk_capture_zone","cage","Duskstripe Capture Zone",.78,.65), mark("four_tiger_capture_pen","cage","Four-Tiger Conservation Pen",.70,.64,"prepare",true), mark("wildlife_transport","vehicle","Territory Wildlife Transport",.90,.73)
    ],[point(.22,.28),point(.31,.39),point(.46,.30),point(.64,.54),point(.78,.65),point(.70,.64),point(.90,.73)]),
    64:mission(64,"Cave Tunnel Evacuation",7,7,6,0,"ground",[
      mark("tunnel_village_refuge","camp","Tunnel Village Refuge",.18,.25,"protect",true), mark("cave_tunnel_entry","den","Cave Tunnel Entry",.30,.40,"secure",true), mark("central_tunnel_chamber","den","Central Tunnel Chamber",.55,.52,"secure",true), mark("cave_tunnel_exit","den","Cave Tunnel Exit",.78,.67,"secure",true), mark("tunnel_extraction","safe","Tunnel Evacuation Extraction",.90,.73)
    ],[point(.18,.25),point(.30,.40),point(.55,.52),point(.78,.67),point(.90,.73)]),
    65:mission(65,"Massive Territory Pack",7,0,13,0,"ground",[
      mark("west_canopy_attack","forest","West Canopy Attack",.22,.36), mark("territory_pack_core","boss","Thirteen-Tiger Territory Pack",.52,.49), mark("cave_flank_attack","den","Cave Flank Attack",.76,.35), mark("territory_fallback","barricade","Territory Fallback Line",.78,.66), mark("pack_extraction","safe","Territory Pack Extraction",.90,.73)
    ],[point(.22,.36),point(.52,.49),point(.76,.35),point(.78,.66),point(.90,.73)]),
    66:mission(66,"Temporary Base Defense",7,4,10,0,"ground",[
      mark("temporary_base_camp","camp","Temporary Base Specialists",.22,.28,"protect",true), mark("west_base_perimeter","barricade","West Base Perimeter",.30,.40,"defend",true), mark("base_command_post","research","Base Command Post",.55,.52,"defend",true), mark("east_base_perimeter","barricade","East Base Perimeter",.78,.67,"defend",true), mark("base_extraction","safe","Temporary Base Extraction",.90,.73)
    ],[point(.22,.28),point(.30,.40),point(.55,.52),point(.78,.67),point(.90,.73)]),
    67:mission(67,"Night Stalker Ambush",7,0,8,0,"ground",[
      mark("west_night_beacon","beacon","West Night Beacon",.30,.40,"activate",true), mark("core_night_beacon","beacon","Core Night Beacon",.55,.52,"activate",true), mark("night_ambush_zone","forest","Eight-Stalker Ambush Zone",.64,.40), mark("extraction_night_beacon","beacon","Extraction Night Beacon",.78,.67,"activate",true), mark("night_extraction","safe","Revealed Night Extraction",.90,.73)
    ],[point(.18,.73),point(.30,.40),point(.55,.52),point(.78,.67),point(.90,.73)]),
    68:mission(68,"Research Equipment Defense",7,1,9,0,"ground",[
      mark("lead_equipment_scientist","research","Lead Equipment Scientist",.50,.45,"protect",true), mark("wildlife_sensor_array","research","Wildlife Sensor Array",.30,.40,"activate",true), mark("mobile_sample_laboratory","research","Mobile Sample Laboratory",.55,.52,"activate",true), mark("research_radio_tower","beacon","Research Radio Tower",.78,.67,"activate",true), mark("equipment_extraction","safe","Research Equipment Extraction",.90,.73)
    ],[point(.18,.73),point(.30,.40),point(.50,.45),point(.55,.52),point(.78,.67),point(.90,.73)]),
    69:mission(69,"Extreme Aggression Zone",7,0,14,0,"ground",[
      mark("west_rage_perimeter","forest","West Rage Perimeter",.22,.34,"scan",true), mark("extreme_aggression_core","boss","Fourteen-Tiger Aggression Core",.53,.49,"defend",true), mark("east_rage_perimeter","forest","East Rage Perimeter",.76,.34,"scan",true), mark("blood_scent_fallback","barricade","Blood-Scent Fallback Line",.78,.66,"defend",true), mark("aggression_extraction","safe","Extreme Zone Extraction",.90,.73)
    ],[point(.22,.34),point(.53,.49),point(.76,.34),point(.78,.66),point(.90,.73)]),
    70:mission(70,"Legendary Blood Tiger",7,0,1,0,"ground",[
      mark("blood_tiger_tracking_command","research","Blood Tiger Tracking Command",.23,.30,"scan",true), mark("legendary_blood_tiger_lair","boss","Legendary Blood Tiger Lair",.56,.50,"defend",true), mark("ancient_blood_rage_ward","barricade","Ancient Blood Rage Ward",.73,.62,"defend",true), mark("chapter_seven_extraction","safe","Chapter 7 Extraction",.90,.73)
    ],[point(.23,.30),point(.56,.50),point(.73,.62),point(.90,.73)]),
    71:mission(71,"Jungle Center Evacuation",8,8,8,0,"ground",[
      mark("jungle_center_refuge","village","Jungle Center Refuge",.18,.25,"protect",true), mark("jungle_center_gate","gate","Jungle Center Gate",.30,.40,"secure",true), mark("forest_evacuation_lane","trail","Forest Evacuation Lane",.55,.52,"secure",true), mark("outer_jungle_shelter","safe","Outer Jungle Shelter",.78,.67,"secure",true), mark("center_evacuation_extraction","safe","Jungle Center Extraction",.90,.73)
    ],[point(.18,.25),point(.30,.40),point(.55,.52),point(.78,.67),point(.90,.73)]),
    72:mission(72,"All-Directions Rescue Ambush",8,5,6,0,"ground",[
      mark("surrounded_civilian_rally","camp","Five Surrounded Civilians",.53,.49), mark("north_ambush_sector","forest","North Ambush Sector",.53,.27), mark("east_ambush_sector","forest","East Ambush Sector",.78,.49), mark("south_ambush_sector","forest","South Ambush Sector",.53,.70), mark("west_ambush_sector","forest","West Ambush Sector",.28,.49), mark("focused_ambush_extraction","safe","Focused Ambush Extraction",.90,.73)
    ],[point(.18,.73),point(.28,.49),point(.53,.27),point(.53,.49),point(.78,.49),point(.90,.73)]),
    73:mission(73,"Elite Hunter Capture",8,0,5,2,"ground",[
      mark("elite_hunter_tracking_command","research","Elite Hunter Tracking Command",.22,.28,"scan",true), mark("razorclaw_capture_zone","cage","Razorclaw Capture Zone",.31,.39), mark("shadowfang_capture_zone","cage","Shadowfang Capture Zone",.70,.60), mark("elite_hunter_conservation_pen","cage","Elite Hunter Conservation Pen",.76,.66,"prepare",true), mark("elite_wildlife_transport","vehicle","Elite Wildlife Transport",.90,.73)
    ],[point(.22,.28),point(.31,.39),point(.53,.49),point(.70,.60),point(.76,.66),point(.90,.73)]),
  });

  function get(level){
    const key = Math.floor(Number(level || 0));
    if(key < 1 || key > MAX_MISSION) return null;
    return MISSIONS[key] || null;
  }
  function scale(level, width, height){
    const spec = get(level);
    if(!spec) return null;
    const w = Math.max(1, Number(width || 1));
    const h = Math.max(1, Number(height || 1));
    return {
      ...spec,
      landmarks:spec.landmarks.map((item)=>({ ...item, x:Math.round(item.x*w), y:Math.round(item.y*h) })),
      route:spec.route.map((item)=>({ x:Math.round(item.x*w), y:Math.round(item.y*h) })),
    };
  }
  function validate(){
    const errors = [];
    for(let level=1; level<=MAX_MISSION; level++){
      const spec = MISSIONS[level];
      if(!spec){ errors.push(`Mission ${level} missing`); continue; }
      if(!spec.title || !spec.landmarks.length) errors.push(`Mission ${level} lacks title or landmarks`);
      const ids = new Set();
      for(const item of spec.landmarks){
        if(ids.has(item.id)) errors.push(`Mission ${level} duplicate landmark ${item.id}`);
        ids.add(item.id);
        if(item.x <= 0 || item.x >= 1 || item.y <= 0 || item.y >= 1) errors.push(`Mission ${level} landmark ${item.id} out of bounds`);
        if(item.required && !item.action) errors.push(`Mission ${level} required landmark ${item.id} lacks an action`);
      }
      for(const id of spec.requiredActionIds){
        if(!ids.has(id)) errors.push(`Mission ${level} required action ${id} has no landmark`);
      }
    }
    return errors;
  }

  return Object.freeze({ VERSION, MAX_MISSION, MISSIONS, get, scale, validate });
});
