(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerLivingWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const PILOT_MAX_MISSION = 13;
  const DISTRICTS = Object.freeze([
    Object.freeze({ id:"river_gate", name:"River Gate", missions:"1–3", minMission:1, maxMission:3, tigerPressure:52, settlementSafety:18 }),
    Object.freeze({ id:"jungle_spine", name:"Jungle Spine", missions:"4–7", minMission:4, maxMission:7, tigerPressure:62, settlementSafety:12 }),
    Object.freeze({ id:"iron_roar", name:"Iron Roar", missions:"8–10", minMission:8, maxMission:10, tigerPressure:72, settlementSafety:8 }),
    Object.freeze({ id:"bloodroot_passage", name:"Bloodroot Passage", missions:"11–13", minMission:11, maxMission:13, tigerPressure:68, settlementSafety:10 }),
  ]);

  const clamp = (value, min, max)=>Math.min(max, Math.max(min, Number(value) || 0));
  const whole = (value)=>Math.max(0, Math.floor(Number(value) || 0));
  const districtById = (id)=>DISTRICTS.find((row)=>row.id === String(id || "")) || null;
  const districtForMission = (missionLevel)=>{
    const level = whole(missionLevel);
    return DISTRICTS.find((row)=>level >= row.minMission && level <= row.maxMission) || null;
  };

  function defaultDistrict(definition){
    return {
      tigerPressure:definition.tigerPressure,
      settlementSafety:definition.settlementSafety,
      bloodScent:0,
      clears:0,
      soloClears:0,
      coopClears:0,
      rescues:0,
      captures:0,
      kills:0,
      civiliansLost:0,
      lastMission:0,
      lastUpdatedAt:0,
    };
  }

  function defaultState(){
    return {
      version:1,
      districts:Object.fromEntries(DISTRICTS.map((definition)=>[definition.id, defaultDistrict(definition)])),
      receipts:{},
      history:[],
      headline:"Chapter 1 is waiting for its first lasting result.",
      lastUpdatedAt:0,
    };
  }

  function normalizeDistrict(raw, definition){
    const base = defaultDistrict(definition);
    const src = raw && typeof raw === "object" ? raw : {};
    return {
      tigerPressure:clamp(Math.round(src.tigerPressure ?? base.tigerPressure), 5, 96),
      settlementSafety:clamp(Math.round(src.settlementSafety ?? base.settlementSafety), 0, 100),
      bloodScent:clamp(Math.round(src.bloodScent ?? 0), 0, 100),
      clears:whole(src.clears),
      soloClears:whole(src.soloClears),
      coopClears:whole(src.coopClears),
      rescues:whole(src.rescues),
      captures:whole(src.captures),
      kills:whole(src.kills),
      civiliansLost:whole(src.civiliansLost),
      lastMission:clamp(whole(src.lastMission), 0, PILOT_MAX_MISSION),
      lastUpdatedAt:whole(src.lastUpdatedAt),
    };
  }

  function normalizeState(raw){
    const base = defaultState();
    const src = raw && typeof raw === "object" ? raw : {};
    const receiptEntries = Object.entries(src.receipts && typeof src.receipts === "object" ? src.receipts : {})
      .slice(-80)
      .map(([key, value])=>[String(key).slice(0, 180), whole(value)])
      .filter(([key])=>key);
    return {
      version:1,
      districts:Object.fromEntries(DISTRICTS.map((definition)=>[
        definition.id,
        normalizeDistrict(src.districts?.[definition.id], definition),
      ])),
      receipts:Object.fromEntries(receiptEntries),
      history:Array.isArray(src.history) ? src.history.slice(-20).filter((row)=>row && typeof row === "object") : [],
      headline:String(src.headline || base.headline).slice(0, 240),
      lastUpdatedAt:whole(src.lastUpdatedAt),
    };
  }

  function threatLabel(pressure){
    const value = clamp(Math.round(pressure), 0, 100);
    if(value >= 75) return "Critical";
    if(value >= 55) return "High";
    if(value >= 35) return "Guarded";
    return "Stable";
  }

  function missionConsequences(raw, missionLevel, options={}){
    const state = normalizeState(raw);
    const definition = districtForMission(missionLevel);
    const playerCount = Math.max(1, whole(options.playerCount) || 1);
    const enabledDistrict = definition && ["river_gate", "jungle_spine", "iron_roar", "bloodroot_passage"].includes(definition.id);
    if(!enabledDistrict){
      return {
        enabled:false,
        districtId:definition?.id || "",
        districtName:definition?.name || "",
        missionLevel:whole(missionLevel),
        extraPatrols:0,
        startingAggroBoost:0,
        directorPressureBonus:0,
        damageBonus:0,
        patrolType:"Standard",
        support:{ safeHouse:false, rangerStation:false, armoryDepot:false, fieldClinic:false, researchPost:false, bridgeOpen:false, powerGrid:false, lanternNetwork:false, fortifiedGate:false, safeRoute:false, routeSpeedMul:1, returningCivilians:0, damageReduction:0, medkitMinimum:0, armorFloor:0, ammoMinimum:0, rubberAmmoMinimum:0, tranqMinimum:0, scanPing:0 },
        brief:"No active district consequence for this mission.",
        supportLabel:"No district support",
      };
    }

    const district = state.districts[definition.id];
    const jungle = definition.id === "jungle_spine";
    const iron = definition.id === "iron_roar";
    const bloodroot = definition.id === "bloodroot_passage";
    const bossMission = whole(missionLevel) === 10;
    const protectedCaptureMission = whole(missionLevel) === 13;
    let rawPatrols = (bossMission || protectedCaptureMission) ? 0 : (bloodroot
      ? (district.tigerPressure >= 86 ? 2 : (district.tigerPressure >= 66 ? 1 : 0))
      : iron
      ? (district.tigerPressure >= 88 ? 2 : (district.tigerPressure >= 68 ? 1 : 0))
      : jungle
        ? (district.tigerPressure >= 82 ? 2 : (district.tigerPressure >= 60 ? 1 : 0))
        : (district.tigerPressure >= 82 ? 2 : (district.tigerPressure >= 65 ? 1 : 0)));
    if(bloodroot && whole(missionLevel) === 12) rawPatrols = Math.min(1, rawPatrols);
    const extraPatrols = playerCount <= 1 ? Math.min(1, rawPatrols) : rawPatrols;
    const startingAggroBoost = clamp(
      Math.max(0, district.tigerPressure - (bloodroot ? 40 : (iron ? 38 : (jungle ? 42 : 45)))) * (bloodroot ? 0.0036 : (iron ? 0.0037 : (jungle ? 0.0034 : 0.003))) + district.bloodScent * (bloodroot ? 0.0058 : (iron ? 0.0055 : (jungle ? 0.005 : 0.0045))),
      0,
      0.65
    );
    const directorPressureBonus = clamp(Math.round(Math.max(0, district.tigerPressure - (bloodroot ? 44 : (iron ? 42 : (jungle ? 46 : 50)))) * (bloodroot ? 0.17 : (iron ? 0.18 : 0.16)) + district.bloodScent * (bloodroot ? 0.15 : (iron ? 0.14 : (jungle ? 0.12 : 0.10)))), 0, 18);
    const damageBonus = clamp(Math.floor(district.bloodScent / (bloodroot ? 18 : (iron ? 16 : (jungle ? 18 : 20)))), 0, bloodroot ? 5 : (iron ? 6 : (jungle ? 5 : 4)));
    const support = bloodroot ? {
      safeHouse:false,
      rangerStation:false,
      armoryDepot:false,
      fieldClinic:district.settlementSafety >= 14,
      researchPost:district.settlementSafety >= 55,
      bridgeOpen:false,
      powerGrid:false,
      lanternNetwork:district.settlementSafety >= 26,
      fortifiedGate:false,
      safeRoute:district.settlementSafety >= 38,
      routeSpeedMul:district.settlementSafety >= 38 ? 1.10 : 1,
      returningCivilians:district.settlementSafety >= 68 ? 2 : (district.settlementSafety >= 42 ? 1 : 0),
      damageReduction:district.settlementSafety >= 50 ? 1 : 0,
      medkitMinimum:district.settlementSafety >= 14 ? 2 : 1,
      armorFloor:district.settlementSafety >= 45 ? 45 : (district.settlementSafety >= 20 ? 20 : 0),
      ammoMinimum:0,
      rubberAmmoMinimum:district.settlementSafety >= 55 ? 36 : 0,
      tranqMinimum:district.settlementSafety >= 55 ? 8 : 0,
      scanPing:district.settlementSafety >= 70 ? 360 : (district.settlementSafety >= 26 ? 300 : 0),
    } : iron ? {
      safeHouse:false,
      rangerStation:false,
      armoryDepot:district.settlementSafety >= 15,
      fieldClinic:false,
      researchPost:false,
      bridgeOpen:false,
      powerGrid:district.settlementSafety >= 28,
      lanternNetwork:false,
      fortifiedGate:district.settlementSafety >= 42,
      safeRoute:district.settlementSafety >= 58,
      routeSpeedMul:district.settlementSafety >= 58 ? 1.08 : 1,
      returningCivilians:district.settlementSafety >= 72 ? 2 : (district.settlementSafety >= 45 ? 1 : 0),
      damageReduction:district.settlementSafety >= 60 ? 2 : (district.settlementSafety >= 28 ? 1 : 0),
      medkitMinimum:district.settlementSafety >= 35 ? 2 : 1,
      armorFloor:district.settlementSafety >= 55 ? 65 : (district.settlementSafety >= 20 ? 35 : 0),
      ammoMinimum:district.settlementSafety >= 55 ? 30 : 0,
      rubberAmmoMinimum:0,
      tranqMinimum:0,
      scanPing:district.settlementSafety >= 75 ? 360 : 0,
    } : jungle ? {
      safeHouse:false,
      rangerStation:district.settlementSafety >= 18,
      armoryDepot:false,
      fieldClinic:false,
      researchPost:false,
      bridgeOpen:district.settlementSafety >= 30,
      powerGrid:false,
      lanternNetwork:false,
      fortifiedGate:false,
      safeRoute:district.settlementSafety >= 55,
      routeSpeedMul:district.settlementSafety >= 55 ? 1.12 : 1,
      returningCivilians:district.settlementSafety >= 70 ? 2 : (district.settlementSafety >= 45 ? 1 : 0),
      damageReduction:0,
      medkitMinimum:district.settlementSafety >= 18 ? 2 : 1,
      armorFloor:district.settlementSafety >= 40 ? 40 : (district.settlementSafety >= 18 ? 20 : 0),
      ammoMinimum:district.settlementSafety >= 60 ? 24 : 0,
      rubberAmmoMinimum:0,
      tranqMinimum:0,
      scanPing:district.settlementSafety >= 70 ? 320 : 0,
    } : {
      safeHouse:district.settlementSafety >= 15,
      rangerStation:false,
      armoryDepot:false,
      fieldClinic:false,
      researchPost:false,
      bridgeOpen:false,
      powerGrid:false,
      lanternNetwork:false,
      fortifiedGate:false,
      safeRoute:false,
      routeSpeedMul:1,
      returningCivilians:0,
      damageReduction:0,
      medkitMinimum:district.settlementSafety >= 15 ? 2 : 1,
      armorFloor:district.settlementSafety >= 35 ? 45 : (district.settlementSafety >= 15 ? 25 : 0),
      ammoMinimum:district.settlementSafety >= 55 ? 20 : 0,
      rubberAmmoMinimum:0,
      tranqMinimum:0,
      scanPing:district.settlementSafety >= 75 ? 280 : 0,
    };
    const pressureText = bossMission
      ? "no added patrol in the Alpha boss arena"
      : protectedCaptureMission
        ? "no added patrol around the two protected research targets"
      : extraPatrols > 0
        ? `${extraPatrols} extra ${bloodroot ? "Bloodroot Berserker " : (iron ? "Armored rail-yard " : (jungle ? "roaming Stalker " : "tiger "))}patrol${extraPatrols === 1 ? "" : "s"}`
        : "no extra patrol";
    const scentText = district.bloodScent > 0
      ? `blood scent adds +${damageBonus} close-range damage and faster starting aggression`
      : "no persistent blood-scent damage";
    const supportBits = bloodroot
      ? [
          support.researchPost ? "Bloodroot Research Clinic" : (support.fieldClinic ? "Bloodroot Trail Clinic" : "trail clinic unavailable"),
          support.lanternNetwork ? "lantern network active" : "dark trail—signal lanterns offline",
          support.safeRoute ? "cleared escort path active" : "overgrown narrow path",
          `${support.medkitMinimum} Med Kit minimum`,
        ]
      : iron
      ? [
          support.armoryDepot ? "Iron Roar Armory Depot" : "armory depot unavailable",
          support.powerGrid ? "industrial power grid online" : "district blackout—generator must be activated",
          support.fortifiedGate ? "fortified rail gate open" : "rail gate defenses offline",
          support.safeRoute ? "armored supply lane active" : "standard industrial route",
          `${support.medkitMinimum} Med Kit minimum`,
        ]
      : jungle
      ? [
          support.rangerStation ? "Jungle Spine Ranger Station" : "ranger station unavailable",
          support.bridgeOpen ? "community bridge open" : "bridge damaged—Repair Kit required",
          support.safeRoute ? "safe escort route active" : "standard jungle route",
          `${support.medkitMinimum} Med Kit minimum`,
        ]
      : [
          support.safeHouse ? "River Gate Safe House" : "no Safe House",
          `${support.medkitMinimum} Med Kit minimum`,
        ];
    if((jungle || iron || bloodroot) && support.returningCivilians > 0) supportBits.push(`${support.returningCivilians} returning civilian ${iron ? "worker" : (bloodroot ? "volunteer" : "helper")}${support.returningCivilians === 1 ? "" : "s"}`);
    if((iron || bloodroot) && support.damageReduction > 0) supportBits.push(`${support.damageReduction} ${iron ? "powered-defense" : "clinic-armor"} damage reduction`);
    if(support.armorFloor > 0) supportBits.push(`${support.armorFloor} starting armor minimum`);
    if(support.ammoMinimum > 0) supportBits.push(`${support.ammoMinimum} reserve-ammo minimum`);
    if(support.rubberAmmoMinimum > 0) supportBits.push(`${support.rubberAmmoMinimum} Rubber-round minimum`);
    if(support.tranqMinimum > 0) supportBits.push(`${support.tranqMinimum} tranq-charge minimum`);
    if(support.scanPing > 0) supportBits.push("settlement scout ping");

    return {
      enabled:true,
      districtId:definition.id,
      districtName:definition.name,
      missionLevel:whole(missionLevel),
      tigerPressure:district.tigerPressure,
      settlementSafety:district.settlementSafety,
      bloodScent:district.bloodScent,
      patrolType:bloodroot ? "Berserker" : (iron ? "Armored" : (jungle ? "Stalker" : "Standard")),
      extraPatrols,
      startingAggroBoost:Number(startingAggroBoost.toFixed(3)),
      directorPressureBonus,
      damageBonus,
      support,
      brief:`${definition.name} consequence: ${pressureText}; ${scentText}. Settlement support: ${supportBits.join(", ")}.`,
      supportLabel:supportBits.join(" • "),
    };
  }

  function applyOutcome(raw, input={}){
    const state = normalizeState(raw);
    const missionLevel = whole(input.missionLevel);
    const definition = districtForMission(missionLevel);
    if(!definition) return { state, applied:false, reason:"outside-pilot", district:null };
    const receipt = String(input.receipt || "").trim().slice(0, 180);
    if(receipt && state.receipts[receipt]){
      const current = state.districts[definition.id];
      return { state, applied:false, reason:"duplicate", district:definition, before:{...current}, after:{...current}, summary:"This mission result was already applied." };
    }

    const captures = whole(input.captures);
    const kills = whole(input.kills);
    const rescues = whole(input.rescues);
    const civiliansLost = whole(input.civiliansLost);
    const coop = !!input.coop;
    const at = whole(input.at) || Date.now();
    const before = { ...state.districts[definition.id] };
    const pressureRelief = 6 + captures * 4 + rescues * 2 + Math.min(kills, 2);
    const lethalPressure = Math.max(0, kills - captures) * 2 + civiliansLost * 5;
    const safetyChange = rescues * 3 + captures - civiliansLost * 6;
    const bloodChange = kills * 7 - captures * 2;
    const after = {
      ...before,
      tigerPressure:clamp(Math.round(before.tigerPressure - pressureRelief + lethalPressure), 5, 96),
      settlementSafety:clamp(Math.round(before.settlementSafety + safetyChange), 0, 100),
      bloodScent:clamp(Math.round(before.bloodScent + bloodChange), 0, 100),
      clears:before.clears + 1,
      soloClears:before.soloClears + (coop ? 0 : 1),
      coopClears:before.coopClears + (coop ? 1 : 0),
      rescues:before.rescues + rescues,
      captures:before.captures + captures,
      kills:before.kills + kills,
      civiliansLost:before.civiliansLost + civiliansLost,
      lastMission:missionLevel,
      lastUpdatedAt:at,
    };
    state.districts[definition.id] = after;
    if(receipt) state.receipts[receipt] = at;
    state.receipts = Object.fromEntries(Object.entries(state.receipts).slice(-80));
    const summary = `${definition.name}: tiger pressure ${before.tigerPressure}% → ${after.tigerPressure}%, settlement safety ${before.settlementSafety}% → ${after.settlementSafety}%, blood scent ${before.bloodScent}% → ${after.bloodScent}%.`;
    state.headline = summary;
    state.lastUpdatedAt = at;
    state.history = [...state.history, {
      receipt,
      missionLevel,
      districtId:definition.id,
      coop,
      captures,
      kills,
      rescues,
      civiliansLost,
      beforePressure:before.tigerPressure,
      afterPressure:after.tigerPressure,
      at,
    }].slice(-20);
    return {
      state,
      applied:true,
      district:definition,
      before,
      after,
      summary,
      changes:{ pressure:after.tigerPressure - before.tigerPressure, safety:after.settlementSafety - before.settlementSafety, bloodScent:after.bloodScent - before.bloodScent },
    };
  }

  return Object.freeze({ PILOT_MAX_MISSION, DISTRICTS, districtById, districtForMission, defaultState, normalizeState, threatLabel, missionConsequences, applyOutcome });
});
