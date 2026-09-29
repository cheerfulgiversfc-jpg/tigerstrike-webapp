(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerStrikeMissionMapTruth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const VERSION = "10.13";
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
  });

  function get(level){
    const key = Math.floor(Number(level || 0));
    if(key < 1 || key > 33) return null;
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
    for(let level=1; level<=33; level++){
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

  return Object.freeze({ VERSION, MISSIONS, get, scale, validate });
});
