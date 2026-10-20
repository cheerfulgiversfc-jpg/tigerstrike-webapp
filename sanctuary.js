(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerSanctuary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const VERSION = "11.4";
  const FACILITY_DEFS = Object.freeze([
    Object.freeze({ id:"habitat", icon:"🌿", name:"Habitat Expansion", maxLevel:3, costs:[9000,18000,32000], desc:"Adds four safe tiger habitats per level." }),
    Object.freeze({ id:"clinic", icon:"🩺", name:"Veterinary Clinic", maxLevel:3, costs:[11000,22000,38000], desc:"Heals residents faster and widens the Story capture window." }),
    Object.freeze({ id:"ranger", icon:"🛡️", name:"Ranger Station", maxLevel:3, costs:[12500,25000,42000], desc:"Prepares humane ammunition and field support before Story missions." }),
    Object.freeze({ id:"transport", icon:"🚛", name:"Wildlife Transport Depot", maxLevel:3, costs:[14000,28000,46000], desc:"Raises conservation release rewards and Living World recovery." }),
  ]);
  const TIGER_TYPES = Object.freeze(["Standard","Armored","Alpha","Blood","Shadow","Ice","Fire","Boss","Legacy"]);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const clean=(value,fallback="")=>String(value??fallback).trim().slice(0,80);
  const clone=(value)=>JSON.parse(JSON.stringify(value||{}));
  const facilityById=(id)=>FACILITY_DEFS.find((row)=>row.id===String(id||""))||null;
  function defaultState(){
    return { version:1, residents:[], archive:[], upgrades:{habitat:0,clinic:0,ranger:0,transport:0}, captureReceipts:{}, releaseReceipts:{}, missionCareReceipts:{}, selectedResidentId:"", legacyCaptures:0, totalReleased:0, lastEvent:"" };
  }
  function normalizeResident(raw={},released=false){
    const type=TIGER_TYPES.includes(clean(raw.type))?clean(raw.type):"Standard";
    return {
      id:clean(raw.id,`T-${Math.max(1,Math.floor(Number(raw.capturedAt||Date.now())))}`),
      name:clean(raw.name,type), type, rarity:clean(raw.rarity,type==="Boss"||type==="Alpha"?"Legendary":"Field"),
      source:clean(raw.source,"player"), capturedAt:Math.max(0,Math.floor(Number(raw.capturedAt||Date.now()))),
      mission:Math.max(0,Math.floor(Number(raw.mission||0))), condition:clamp(Math.round(Number(raw.condition??76)),0,100),
      status:released?"RELEASED":(["ACTIVE","HOLDING"].includes(raw.status)?raw.status:"ACTIVE"),
      releaseReady:released?true:!!raw.releaseReady, boss:!!raw.boss||type==="Boss", alpha:!!raw.alpha||type==="Alpha"||type==="Boss",
      releasedAt:released?Math.max(0,Math.floor(Number(raw.releasedAt||Date.now()))):0,
      releaseDistrictId:released?clean(raw.releaseDistrictId):"",
    };
  }
  function normalizeState(raw={}){
    const src=raw&&typeof raw==="object"?raw:{};
    const state=defaultState();
    for(const def of FACILITY_DEFS) state.upgrades[def.id]=clamp(Math.floor(Number(src.upgrades?.[def.id]||0)),0,def.maxLevel);
    const seen=new Set();
    state.residents=(Array.isArray(src.residents)?src.residents:[]).map((row)=>normalizeResident(row,false)).filter((row)=>row.id&&!seen.has(row.id)&&seen.add(row.id)).slice(-40);
    state.archive=(Array.isArray(src.archive)?src.archive:[]).map((row)=>normalizeResident(row,true)).filter((row)=>row.id&&!seen.has(row.id)&&seen.add(row.id)).slice(-60);
    state.captureReceipts=src.captureReceipts&&typeof src.captureReceipts==="object"?{...src.captureReceipts}:{};
    state.releaseReceipts=src.releaseReceipts&&typeof src.releaseReceipts==="object"?{...src.releaseReceipts}:{};
    state.missionCareReceipts=src.missionCareReceipts&&typeof src.missionCareReceipts==="object"?{...src.missionCareReceipts}:{};
    state.selectedResidentId=clean(src.selectedResidentId);
    state.legacyCaptures=Math.max(0,Math.floor(Number(src.legacyCaptures||0)));
    state.totalReleased=Math.max(state.archive.length,Math.floor(Number(src.totalReleased||0)));
    state.lastEvent=clean(src.lastEvent);
    return redistributeCapacity(state);
  }
  function capacityFor(raw={}){const state=normalizeStateShallow(raw);return 4+state.upgrades.habitat*4;}
  function normalizeStateShallow(raw={}){
    const upgrades={habitat:0,clinic:0,ranger:0,transport:0};
    for(const def of FACILITY_DEFS) upgrades[def.id]=clamp(Math.floor(Number(raw?.upgrades?.[def.id]||0)),0,def.maxLevel);
    return {upgrades};
  }
  function redistributeCapacity(raw={}){
    const state=raw&&raw.version===1?raw:normalizeState(raw);
    const capacity=capacityFor(state);
    state.residents=state.residents.map((resident,index)=>({...resident,status:index<capacity?"ACTIVE":"HOLDING"}));
    if(!state.residents.some((row)=>row.id===state.selectedResidentId)) state.selectedResidentId=state.residents[0]?.id||"";
    return state;
  }
  function syncLegacyCaptures(raw={},totalCaptures=0){
    const state=normalizeState(raw);
    state.legacyCaptures=Math.max(state.legacyCaptures,Math.max(0,Math.floor(Number(totalCaptures||0)))-state.residents.length-state.archive.length);
    return state;
  }
  function captureReceipt(tiger={},meta={}){return clean(meta.receipt||`${meta.runId||"run"}:${tiger.id||tiger.alias||tiger.name||"tiger"}`);}
  function addCapture(raw={},tiger={},meta={}){
    const state=normalizeState(raw),receipt=captureReceipt(tiger,meta);
    if(!receipt||state.captureReceipts[receipt])return {applied:false,reason:"duplicate",state,resident:null};
    const type=clean(meta.type||tiger.type||((tiger.boss||meta.boss)?"Boss":"Standard"));
    const capturedAt=Math.max(1,Math.floor(Number(meta.capturedAt||Date.now())));
    const id=clean(meta.id||tiger.id||`SAN-${capturedAt.toString(36).toUpperCase()}-${state.residents.length+state.archive.length+1}`);
    const resident=normalizeResident({id,name:tiger.alias||tiger.name||meta.name||type,type,rarity:meta.rarity,source:meta.source||"player",capturedAt,mission:meta.mission,condition:meta.condition??(tiger.boss?58:78),boss:!!tiger.boss||!!meta.boss,alpha:!!tiger.alpha||!!meta.alpha},false);
    state.residents.push(resident);state.captureReceipts[receipt]=capturedAt;state.captureReceipts=Object.fromEntries(Object.entries(state.captureReceipts).slice(-120));
    state.lastEvent=`${resident.name} arrived safely at the sanctuary.`;
    redistributeCapacity(state);
    return {applied:true,state,resident:state.residents.find((row)=>row.id===id)||resident};
  }
  function advanceCare(raw={},runId="",missionStats={}){
    const state=normalizeState(raw),receipt=clean(runId);
    if(!receipt||state.missionCareReceipts[receipt])return {applied:false,reason:"duplicate",state,healed:0,ready:0};
    const clinic=state.upgrades.clinic,humane=Math.max(0,Math.floor(Number(missionStats.captures||0)));
    let healed=0,ready=0;
    state.residents=state.residents.map((resident)=>{
      if(resident.status!=="ACTIVE")return resident;
      const before=resident.condition,gain=6+clinic*4+Math.min(4,humane);
      const condition=clamp(before+gain,0,100),releaseReady=condition>=90;
      if(condition>before)healed++;if(releaseReady&&!resident.releaseReady)ready++;
      return {...resident,condition,releaseReady};
    });
    state.missionCareReceipts[receipt]=Date.now();state.missionCareReceipts=Object.fromEntries(Object.entries(state.missionCareReceipts).slice(-100));
    state.lastEvent=ready?`${ready} tiger${ready===1?" is":"s are"} now ready for conservation release.`:`Veterinary care improved ${healed} resident${healed===1?"":"s"}.`;
    return {applied:true,state,healed,ready};
  }
  function facilityCost(raw={},facilityId=""){
    const state=normalizeState(raw),def=facilityById(facilityId);if(!def)return 0;
    const level=state.upgrades[def.id];return level>=def.maxLevel?0:Number(def.costs[level]||0);
  }
  function upgradeFacility(raw={},facilityId="",funds=0){
    const state=normalizeState(raw),def=facilityById(facilityId);if(!def)return {applied:false,reason:"unavailable",state,fundsRemaining:Math.max(0,Number(funds||0))};
    const level=state.upgrades[def.id],cost=facilityCost(state,def.id),available=Math.max(0,Math.floor(Number(funds||0)));
    if(level>=def.maxLevel)return {applied:false,reason:"max-level",state,cost:0,fundsRemaining:available};
    if(available<cost)return {applied:false,reason:"insufficient-funds",state,cost,fundsRemaining:available};
    state.upgrades[def.id]=level+1;state.lastEvent=`${def.name} upgraded to Level ${level+1}.`;redistributeCapacity(state);
    return {applied:true,state,facility:def,level:level+1,cost,fundsRemaining:available-cost};
  }
  function staffFromRescues(rescues=0){
    const total=Math.max(0,Math.floor(Number(rescues||0)));
    return {total,doctors:Math.floor(total/12),rangers:Math.floor(total/9),mechanics:Math.floor(total/16),researchers:Math.floor(total/20),pilots:Math.floor(total/25)};
  }
  function missionBenefits(raw={}){
    const state=normalizeState(raw),clinic=state.upgrades.clinic,ranger=state.upgrades.ranger,transport=state.upgrades.transport;
    return {captureWindowBonus:clinic*0.01,carePerMission:6+clinic*4,rubberAmmoMinimum:ranger*10,tranqAmmoMinimum:ranger*4,medkitMinimum:clinic>=2?2:1,releaseRewardMultiplier:1+transport*0.25,releasePressureRelief:4+transport*2};
  }
  function baseIdentity(government={}){
    const rogue=!!government.rogue||clean(government.path).toUpperCase()==="GONE_ROGUE"||clean(government.status).toUpperCase().includes("ROGUE");
    if(rogue)return {id:"rogue",icon:"🕶️",name:"Rogue Underground Haven",tone:"danger",desc:"Hidden handlers keep rescued wildlife safe while government hunters search for the squad."};
    const trust=clamp(government.trust??80,0,100),funded=government.funded!==false&&trust>=55;
    if(funded)return {id:"official",icon:"🏛️",name:"Government Wildlife Sanctuary",tone:"good",desc:"An accredited rescue headquarters supported by conservation funding."};
    return {id:"independent",icon:"🌲",name:"Independent Conservation Outpost",tone:"neutral",desc:"A self-funded sanctuary rebuilding trust through humane field work."};
  }
  function releaseTarget(districts=[],livingState={}){
    return (Array.isArray(districts)?districts:[]).map((definition)=>({definition,state:livingState?.districts?.[definition.id]})).filter((row)=>row.state&&Number(row.state.settlementSafety||0)>=55&&Number(row.state.tigerPressure||100)<=65).sort((a,b)=>(Number(b.state.settlementSafety||0)-Number(a.state.settlementSafety||0))+(Number(a.state.tigerPressure||0)-Number(b.state.tigerPressure||0)))[0]||null;
  }
  function releaseResident(raw={},residentId="",district=null,opts={}){
    const state=normalizeState(raw),index=state.residents.findIndex((row)=>row.id===String(residentId||state.selectedResidentId));
    if(index<0)return {applied:false,reason:"resident-missing",state};
    const resident=state.residents[index];if(!resident.releaseReady||resident.condition<90)return {applied:false,reason:"not-ready",state,resident};
    if(!district?.definition?.id)return {applied:false,reason:"district-unavailable",state,resident};
    const receipt=`release:${resident.id}`;if(state.releaseReceipts[receipt])return {applied:false,reason:"duplicate",state,resident};
    const benefits=missionBenefits(state),baseReward=resident.boss||resident.alpha?12000:6000,reward=Math.round(baseReward*benefits.releaseRewardMultiplier);
    const released={...resident,status:"RELEASED",releaseReady:true,releasedAt:Date.now(),releaseDistrictId:district.definition.id};
    state.residents.splice(index,1);state.archive.push(released);state.archive=state.archive.slice(-60);state.totalReleased++;state.releaseReceipts[receipt]=released.releasedAt;state.releaseReceipts=Object.fromEntries(Object.entries(state.releaseReceipts).slice(-100));state.lastEvent=`${resident.name} was released into ${district.definition.name}.`;
    redistributeCapacity(state);
    return {applied:true,state,resident:released,districtId:district.definition.id,districtName:district.definition.name,reward,trustGain:opts.rogue?0:2,pressureRelief:benefits.releasePressureRelief,bloodRelief:3+state.upgrades.transport*2,safetyGain:2+state.upgrades.transport};
  }
  function collectionSummary(raw={}){
    const state=normalizeState(raw),active=state.residents.filter((row)=>row.status==="ACTIVE").length,holding=state.residents.length-active,ready=state.residents.filter((row)=>row.releaseReady).length;
    return {active,holding,ready,residents:state.residents.length,legacy:state.legacyCaptures,released:state.totalReleased,capacity:capacityFor(state),facilities:Object.values(state.upgrades).reduce((sum,n)=>sum+n,0)};
  }
  return Object.freeze({VERSION,FACILITY_DEFS,TIGER_TYPES,defaultState,normalizeState,syncLegacyCaptures,addCapture,advanceCare,facilityById,facilityCost,upgradeFacility,capacityFor,staffFromRescues,missionBenefits,baseIdentity,releaseTarget,releaseResident,collectionSummary});
});
