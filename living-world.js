(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerLivingWorld = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const PILOT_MAX_MISSION = 10;
  const DISTRICTS = Object.freeze([
    Object.freeze({ id:"river_gate", name:"River Gate", missions:"1–3", minMission:1, maxMission:3, tigerPressure:52, settlementSafety:18 }),
    Object.freeze({ id:"jungle_spine", name:"Jungle Spine", missions:"4–7", minMission:4, maxMission:7, tigerPressure:62, settlementSafety:12 }),
    Object.freeze({ id:"iron_roar", name:"Iron Roar", missions:"8–10", minMission:8, maxMission:10, tigerPressure:72, settlementSafety:8 }),
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
    if(!definition || definition.id !== "river_gate"){
      return {
        enabled:false,
        districtId:definition?.id || "",
        districtName:definition?.name || "",
        missionLevel:whole(missionLevel),
        extraPatrols:0,
        startingAggroBoost:0,
        directorPressureBonus:0,
        damageBonus:0,
        support:{ safeHouse:false, medkitMinimum:0, armorFloor:0, ammoMinimum:0, scanPing:0 },
        brief:"No active district consequence for this mission.",
        supportLabel:"No district support",
      };
    }

    const district = state.districts[definition.id];
    const rawPatrols = district.tigerPressure >= 82 ? 2 : (district.tigerPressure >= 65 ? 1 : 0);
    const extraPatrols = playerCount <= 1 ? Math.min(1, rawPatrols) : rawPatrols;
    const startingAggroBoost = clamp(
      Math.max(0, district.tigerPressure - 45) * 0.003 + district.bloodScent * 0.0045,
      0,
      0.65
    );
    const directorPressureBonus = clamp(Math.round(Math.max(0, district.tigerPressure - 50) * 0.16 + district.bloodScent * 0.10), 0, 18);
    const damageBonus = clamp(Math.floor(district.bloodScent / 20), 0, 4);
    const support = {
      safeHouse:district.settlementSafety >= 15,
      medkitMinimum:district.settlementSafety >= 15 ? 2 : 1,
      armorFloor:district.settlementSafety >= 35 ? 45 : (district.settlementSafety >= 15 ? 25 : 0),
      ammoMinimum:district.settlementSafety >= 55 ? 20 : 0,
      scanPing:district.settlementSafety >= 75 ? 280 : 0,
    };
    const pressureText = extraPatrols > 0
      ? `${extraPatrols} extra tiger patrol${extraPatrols === 1 ? "" : "s"}`
      : "no extra patrol";
    const scentText = district.bloodScent > 0
      ? `blood scent adds +${damageBonus} close-range damage and faster starting aggression`
      : "no persistent blood-scent damage";
    const supportBits = [
      support.safeHouse ? "River Gate Safe House" : "no Safe House",
      `${support.medkitMinimum} Med Kit minimum`,
    ];
    if(support.armorFloor > 0) supportBits.push(`${support.armorFloor} starting armor minimum`);
    if(support.ammoMinimum > 0) supportBits.push(`${support.ammoMinimum} reserve-ammo minimum`);
    if(support.scanPing > 0) supportBits.push("settlement scout ping");

    return {
      enabled:true,
      districtId:definition.id,
      districtName:definition.name,
      missionLevel:whole(missionLevel),
      tigerPressure:district.tigerPressure,
      settlementSafety:district.settlementSafety,
      bloodScent:district.bloodScent,
      extraPatrols,
      startingAggroBoost:Number(startingAggroBoost.toFixed(3)),
      directorPressureBonus,
      damageBonus,
      support,
      brief:`River Gate consequence: ${pressureText}; ${scentText}. Settlement support: ${supportBits.join(", ")}.`,
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
