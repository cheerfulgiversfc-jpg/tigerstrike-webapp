(function(root, factory){
  const api = factory(root || globalThis);
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerPostCampaign = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root){
  "use strict";

  const VERSION = "11.4";
  const CYCLE_MS = 12 * 60 * 60 * 1000;
  const RECOVERY_PROJECTS = Object.freeze([
    Object.freeze({ id:"field_clinic", icon:"🏥", name:"Field Clinic", desc:"Protects civilians and restores settlement safety.", baseCost:10000, maxLevel:3, safety:8, pressure:-3, bloodScent:0 }),
    Object.freeze({ id:"ranger_watch", icon:"🗼", name:"Ranger Watch", desc:"Detects roaming packs before they reach the district.", baseCost:15000, maxLevel:3, safety:5, pressure:-8, bloodScent:-2 }),
    Object.freeze({ id:"conservation_corridor", icon:"🌿", name:"Conservation Corridor", desc:"Moves tigers away from settlements and clears blood scent.", baseCost:20000, maxLevel:3, safety:4, pressure:-6, bloodScent:-10 }),
  ]);
  const RESPONSE_OPTIONS = Object.freeze([
    Object.freeze({ id:"rescue_first", icon:"🛟", label:"Protect Civilians First", desc:"Adds emergency evacuation support and gives the district extra safety after success.", rewardBonusCash:2500, safetyBonus:5, pressureBonus:0, bloodBonus:0 }),
    Object.freeze({ id:"contain_pack", icon:"🐅", label:"Contain the Tiger Migration", desc:"Prioritizes stopping the pack before it spreads again and grants stronger pressure relief.", rewardBonusCash:3500, safetyBonus:0, pressureBonus:-5, bloodBonus:0 }),
    Object.freeze({ id:"humane_route", icon:"🌿", label:"Use the Humane Route", desc:"Prioritizes nonlethal control and conservation, reducing blood scent after success.", rewardBonusCash:4500, safetyBonus:2, pressureBonus:-2, bloodBonus:-7 }),
  ]);
  const EMERGENCY_TYPES = Object.freeze([
    Object.freeze({ id:"civilian_exodus", icon:"🚐", name:"Civilian Exodus", crisisTypeId:"settlement_siege", desc:"Families are fleeing the spreading tiger front. Reach the new district and secure the evacuation route." }),
    Object.freeze({ id:"alpha_migration", icon:"🐾", name:"Alpha Migration", crisisTypeId:"escaped_alpha", desc:"A migrating Alpha followed the spreading pressure into a neighboring district and must be recovered alive." }),
    Object.freeze({ id:"response_blockade", icon:"🚧", name:"Response Blockade", crisisTypeId:"government_raid", desc:"A government blockade trapped civilians between armed units and the spreading pack." }),
  ]);
  const RARE_EVENT_TYPES = Object.freeze([
    Object.freeze({ id:"white_tiger_sighting", icon:"🐯", name:"White Tiger Sighting", crisisTypeId:"escaped_alpha", desc:"A rare pale Alpha has appeared along a conservation route. Capture it alive before it vanishes.", rewardBonusCash:14000 }),
    Object.freeze({ id:"sanctuary_airdrop", icon:"🪂", name:"Sanctuary Medical Airdrop", crisisTypeId:"settlement_siege", desc:"A sanctuary aircraft dropped emergency medicine inside a besieged settlement. Rescue the civilians and recover the route.", rewardBonusCash:10000 }),
    Object.freeze({ id:"rogue_unit_cache", icon:"📡", name:"Abandoned Response Cache", crisisTypeId:"government_raid", desc:"A vanished response team left rare field equipment inside an active tiger corridor.", rewardBonusCash:12000 }),
  ]);
  const CRISIS_TYPES = Object.freeze([
    Object.freeze({
      id:"settlement_siege", coopLaunchType:"crisis-settlement-siege", icon:"🏘️", name:"Settlement Siege",
      desc:"A tiger pack has surrounded a populated settlement. Rescue every civilian, hold the route, and clear the pack.",
      objective:"Post-Campaign Crisis: rescue every civilian from the besieged settlement, then secure extraction.",
      civilians:6, tigers:8, captures:0, rewardCash:18000, rewardXp:360,
    }),
    Object.freeze({
      id:"escaped_alpha", coopLaunchType:"crisis-escaped-alpha", icon:"👑", name:"Escaped Alpha Transport",
      desc:"A captured Alpha broke out during transport. Track it, weaken it nonlethally, and return it alive.",
      objective:"Post-Campaign Crisis: recapture the escaped Alpha alive and secure the wildlife route.",
      civilians:2, tigers:1, captures:1, boss:true, bossType:"Alpha", rewardCash:24000, rewardXp:520,
    }),
    Object.freeze({
      id:"government_raid", coopLaunchType:"crisis-government-raid", icon:"🚨", name:"Government Response Raid",
      desc:"An armed response unit entered an unstable district while tigers closed on civilians. Survive both threats and evacuate the settlement.",
      objective:"Post-Campaign Crisis: survive the government response raid, protect civilians, and clear the tiger threat.",
      civilians:4, tigers:5, captures:0, government:true, rewardCash:22000, rewardXp:460,
    }),
  ]);

  const hash=(value)=>{
    let h=2166136261;
    for(const ch of String(value||"")){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
    return h>>>0;
  };
  const crisisById=(id)=>CRISIS_TYPES.find((row)=>row.id===String(id||""))||null;
  const crisisByLaunchType=(launchType)=>CRISIS_TYPES.find((row)=>row.coopLaunchType===String(launchType||""))||null;
  const isCrisisLaunchType=(launchType)=>!!crisisByLaunchType(launchType);
  function difficultyForPlayers(playerCount=1){
    const players=Math.max(1,Math.min(2,Math.floor(Number(playerCount||1))));
    return Object.freeze({
      playerCount:players,
      tigerHpMultiplier:players===2?1.24:1,
      tigerDamageMultiplier:players===2?1.12:1,
      timeMultiplier:players===2?1.08:1,
      label:players===2?"Two Player":"Solo",
    });
  }
  const normalizeDistricts=(districts)=>Array.isArray(districts)?districts.filter((row)=>row&&row.id):[];
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const clone=(value)=>JSON.parse(JSON.stringify(value||{}));
  const projectById=(id)=>RECOVERY_PROJECTS.find((row)=>row.id===String(id||""))||null;
  const responseById=(id)=>RESPONSE_OPTIONS.find((row)=>row.id===String(id||""))||null;
  const emergencyTypeById=(id)=>EMERGENCY_TYPES.find((row)=>row.id===String(id||""))||null;
  const rareEventTypeById=(id)=>RARE_EVENT_TYPES.find((row)=>row.id===String(id||""))||null;
  function normalizeRecovery(raw={},districts=[]){
    const src=raw&&typeof raw==="object"?raw:{};
    const projects={};
    for(const district of normalizeDistricts(districts)){
      const current=src.projects?.[district.id]||{};
      projects[district.id]={};
      for(const project of RECOVERY_PROJECTS) projects[district.id][project.id]=clamp(Math.floor(Number(current[project.id]||0)),0,project.maxLevel);
    }
    return {
      version:2,
      projects,
      totalInvested:Math.max(0,Math.floor(Number(src.totalInvested||0))),
      totalProjects:Math.max(0,Math.floor(Number(src.totalProjects||0))),
      lastCycle:Math.max(0,Math.floor(Number(src.lastCycle||0))),
      spreadReceipts:src.spreadReceipts&&typeof src.spreadReceipts==="object"?{...src.spreadReceipts}:{},
      spreadEvents:Array.isArray(src.spreadEvents)?src.spreadEvents.slice(-10):[],
      emergencies:Array.isArray(src.emergencies)?src.emergencies.filter((row)=>row&&row.id).slice(-12):[],
      resolvedEvents:src.resolvedEvents&&typeof src.resolvedEvents==="object"?{...src.resolvedEvents}:{},
    };
  }
  function eventMissionLevel(district,seed=""){
    const span=Math.max(1,Number(district?.maxMission||1)-Number(district?.minMission||1)+1);
    return Math.max(1,Math.min(100,Number(district?.minMission||1)+(hash(seed)%span)));
  }
  function emergencyFromSpread(event,districts=[]){
    const target=normalizeDistricts(districts).find((row)=>row.id===event?.targetId);
    if(!target)return null;
    const type=EMERGENCY_TYPES[hash(`${event.cycle}:${event.sourceId}:${event.targetId}`)%EMERGENCY_TYPES.length];
    return {
      id:`EMG-${event.cycle}-${type.id}-${target.id}`,
      kind:"emergency",typeId:type.id,name:type.name,icon:type.icon,desc:type.desc,crisisTypeId:type.crisisTypeId,
      districtId:target.id,districtName:target.name,sourceId:event.sourceId,sourceName:event.sourceName,
      missionLevel:eventMissionLevel(target,`${event.cycle}:${type.id}:${target.id}`),cycle:event.cycle,expiresCycle:event.cycle+2,rewardBonusCash:5000,
    };
  }
  function activeEmergencies(rawRecovery,currentCycle=cycleKey()){
    const recovery=rawRecovery&&typeof rawRecovery==="object"?rawRecovery:{};
    const cycle=Math.max(0,Math.floor(Number(currentCycle||0)));
    return (Array.isArray(recovery.emergencies)?recovery.emergencies:[]).filter((event)=>event&&Number(event.cycle||0)<=cycle&&Number(event.expiresCycle||0)>=cycle&&!recovery.resolvedEvents?.[event.id]);
  }
  function resolveWorldEvent(rawRecovery,eventId,at=Date.now()){
    const recovery={...(rawRecovery||{}),resolvedEvents:{...(rawRecovery?.resolvedEvents||{})}};
    const id=String(eventId||"");if(!id)return recovery;
    recovery.resolvedEvents[id]=Math.max(0,Number(at||Date.now()));recovery.resolvedEvents=Object.fromEntries(Object.entries(recovery.resolvedEvents).slice(-40));return recovery;
  }
  function rareEventForCycle(districts,livingState,currentCycle=cycleKey()){
    const defs=normalizeDistricts(districts),cycle=Math.max(0,Math.floor(Number(currentCycle||0)));
    if(!defs.length)return null;
    const anchor=cycle-(cycle%5);
    if(cycle-anchor>1)return null;
    const type=RARE_EVENT_TYPES[hash(`rare:${anchor}`)%RARE_EVENT_TYPES.length];
    // Rare-event identity is global for the cycle so a Solo command map and
    // the server-owned Shared Living World always agree on the same room.
    const ranked=defs.map((district)=>({district,score:hash(`${anchor}:${district.id}`)})).sort((a,b)=>b.score-a.score);
    const district=ranked[hash(`${anchor}:${type.id}`)%Math.min(6,ranked.length)].district;
    return {
      id:`RARE-${anchor}-${type.id}-${district.id}`,
      kind:"rare",typeId:type.id,name:type.name,icon:type.icon,desc:type.desc,crisisTypeId:type.crisisTypeId,
      districtId:district.id,districtName:district.name,missionLevel:eventMissionLevel(district,`${anchor}:${type.id}`),cycle:anchor,expiresCycle:anchor+1,rewardBonusCash:type.rewardBonusCash,
    };
  }
  function responseOptionsForOperation(){ return RESPONSE_OPTIONS.map((row)=>({...row})); }
  function operationForEvent(event){
    if(!event)return null;
    const crisis=crisisById(event.crisisTypeId),runId=String(event.id||"");
    if(!crisis||!runId)return null;
    return {
      typeId:crisis.id,launchType:crisis.coopLaunchType,districtId:String(event.districtId||""),districtName:String(event.districtName||""),missionLevel:Math.max(1,Math.min(100,Math.floor(Number(event.missionLevel||1)))),cycle:Math.max(0,Math.floor(Number(event.cycle||0))),runId,
      eventId:runId,eventKind:String(event.kind||"emergency"),eventTypeId:String(event.typeId||""),eventName:String(event.name||crisis.name),eventIcon:String(event.icon||crisis.icon),eventDescription:String(event.desc||crisis.desc),rewardBonusCash:Math.max(0,Math.floor(Number(event.rewardBonusCash||0))),responseOptions:responseOptionsForOperation(event),
    };
  }
  function recoveryCost(projectId,currentLevel=0){
    const project=projectById(projectId);
    if(!project)return 0;
    return Math.round(project.baseCost*(1+clamp(Math.floor(Number(currentLevel||0)),0,project.maxLevel)*0.55));
  }
  function recoveryStatus(districtState={},districtRecovery={}){
    const levels=RECOVERY_PROJECTS.reduce((sum,project)=>sum+clamp(Math.floor(Number(districtRecovery?.[project.id]||0)),0,project.maxLevel),0);
    const pressure=clamp(districtState.tigerPressure,0,100),safety=clamp(districtState.settlementSafety,0,100),blood=clamp(districtState.bloodScent,0,100);
    const risk=clamp(Math.round(pressure+blood*.45-safety*.30-levels*4),0,100);
    const tier=levels>=8?"Restored":levels>=5?"Rebuilding":levels>=2?"Stabilizing":"Exposed";
    return { levels, tier, risk, spreadShield:clamp(levels*2,0,18) };
  }
  function fundRecoveryProject(rawRecovery,rawLiving,districts,districtId,projectId,availableFunds=0){
    const defs=normalizeDistricts(districts),district=defs.find((row)=>row.id===String(districtId||"")),project=projectById(projectId);
    const recovery=normalizeRecovery(rawRecovery,defs),living=clone(rawLiving);
    if(!district||!project||!living?.districts?.[district.id]) return {applied:false,reason:"unavailable",recovery,livingState:living,fundsRemaining:availableFunds};
    const level=clamp(Math.floor(Number(recovery.projects[district.id]?.[project.id]||0)),0,project.maxLevel);
    if(level>=project.maxLevel)return {applied:false,reason:"max-level",recovery,livingState:living,fundsRemaining:availableFunds};
    const cost=recoveryCost(project.id,level),funds=Math.max(0,Math.floor(Number(availableFunds||0)));
    if(funds<cost)return {applied:false,reason:"insufficient-funds",cost,recovery,livingState:living,fundsRemaining:funds};
    recovery.projects[district.id][project.id]=level+1;
    recovery.totalInvested+=cost;recovery.totalProjects+=1;
    const before={...living.districts[district.id]};
    const after={...before,
      settlementSafety:clamp(Math.round(Number(before.settlementSafety||0)+project.safety),0,100),
      tigerPressure:clamp(Math.round(Number(before.tigerPressure||0)+project.pressure),5,96),
      bloodScent:clamp(Math.round(Number(before.bloodScent||0)+project.bloodScent),0,100),
      lastUpdatedAt:Date.now(),
    };
    living.districts[district.id]=after;
    living.headline=`${district.name}: ${project.name} upgraded to Level ${level+1}. Safety ${before.settlementSafety}% → ${after.settlementSafety}%.`;
    living.lastUpdatedAt=Date.now();
    return {applied:true,cost,level:level+1,project,district,before,after,recovery,livingState:living,fundsRemaining:funds-cost,summary:living.headline};
  }
  function applyCrisisDistrictOutcome(rawLiving,operation={},stats={}){
    const living=clone(rawLiving),districtId=String(operation.districtId||""),district=living?.districts?.[districtId];
    if(!district)return {applied:false,reason:"district-missing",state:living};
    living.receipts=living.receipts&&typeof living.receipts==="object"?living.receipts:{};
    const receipt=`crisis:${String(operation.runId||`${operation.typeId}:${districtId}`)}`;
    if(living.receipts[receipt])return {applied:false,reason:"duplicate",state:living,before:{...district},after:{...district}};
    const rescues=Math.max(0,Math.floor(Number(stats.rescues??stats.evac??0))),captures=Math.max(0,Math.floor(Number(stats.captures||0))),kills=Math.max(0,Math.floor(Number(stats.kills||0))),lost=Math.max(0,Math.floor(Number(stats.civiliansLost??stats.civDead??0)));
    const profile=operation.typeId==="escaped_alpha"?{pressure:-14,safety:6,blood:-6}:operation.typeId==="government_raid"?{pressure:-9,safety:9,blood:-2}:{pressure:-11,safety:12,blood:-3};
    const response=responseById(stats.responseId||operation.responseId);
    const before={...district};
    const after={...before,
      tigerPressure:clamp(Math.round(Number(before.tigerPressure||0)+profile.pressure+Number(response?.pressureBonus||0)-captures*2+kills+lost*4),5,96),
      settlementSafety:clamp(Math.round(Number(before.settlementSafety||0)+profile.safety+Number(response?.safetyBonus||0)+rescues-lost*5),0,100),
      bloodScent:clamp(Math.round(Number(before.bloodScent||0)+profile.blood+Number(response?.bloodBonus||0)+kills*5-captures*2),0,100),
      clears:Math.max(0,Number(before.clears||0))+1,
      soloClears:Math.max(0,Number(before.soloClears||0))+(stats.coop?0:1),
      coopClears:Math.max(0,Number(before.coopClears||0))+(stats.coop?1:0),
      rescues:Math.max(0,Number(before.rescues||0))+rescues,
      captures:Math.max(0,Number(before.captures||0))+captures,
      kills:Math.max(0,Number(before.kills||0))+kills,
      civiliansLost:Math.max(0,Number(before.civiliansLost||0))+lost,
      lastUpdatedAt:Date.now(),
    };
    living.districts[districtId]=after;living.receipts[receipt]=Date.now();living.receipts=Object.fromEntries(Object.entries(living.receipts).slice(-100));
    living.headline=`${operation.districtName||districtId}: crisis resolved. Tiger pressure ${before.tigerPressure}% → ${after.tigerPressure}%; safety ${before.settlementSafety}% → ${after.settlementSafety}%.`;
    living.lastUpdatedAt=Date.now();
    return {applied:true,receipt,state:living,before,after,summary:living.headline};
  }
  function advanceCrisisSpread(rawLiving,districts,rawRecovery,currentCycle=cycleKey()){
    const defs=normalizeDistricts(districts),living=clone(rawLiving),recovery=normalizeRecovery(rawRecovery,defs),cycle=Math.max(0,Math.floor(Number(currentCycle||0)));
    if(!recovery.lastCycle){recovery.lastCycle=cycle;return {applied:false,reason:"initialized",state:living,recovery,events:[]};}
    const receipt=`spread:${cycle}`;
    if(cycle<=recovery.lastCycle||recovery.spreadReceipts[receipt])return {applied:false,reason:"already-applied",state:living,recovery,events:[]};
    const sources=defs.map((definition,index)=>({definition,index,status:recoveryStatus(living.districts?.[definition.id],recovery.projects[definition.id])})).filter((row)=>row.status.risk>=62).sort((a,b)=>b.status.risk-a.status.risk).slice(0,3);
    const used=new Set(),events=[];
    for(const source of sources){
      const direction=hash(`${cycle}:${source.definition.id}`)%2?1:-1;
      const target=defs[(source.index+direction+defs.length)%defs.length];
      if(!target||target.id===source.definition.id||used.has(target.id)||!living.districts?.[target.id])continue;
      used.add(target.id);
      const targetRecovery=recoveryStatus(living.districts[target.id],recovery.projects[target.id]);
      const pressureRise=Math.max(1,8-Math.floor(targetRecovery.spreadShield/3)),bloodRise=Math.max(0,4-Math.floor(targetRecovery.spreadShield/5)),safetyLoss=Math.max(0,3-Math.floor(targetRecovery.spreadShield/6));
      const before={...living.districts[target.id]};
      const after={...before,tigerPressure:clamp(Number(before.tigerPressure||0)+pressureRise,5,96),bloodScent:clamp(Number(before.bloodScent||0)+bloodRise,0,100),settlementSafety:clamp(Number(before.settlementSafety||0)-safetyLoss,0,100),lastUpdatedAt:Date.now()};
      living.districts[target.id]=after;
      events.push({cycle,sourceId:source.definition.id,sourceName:source.definition.name,targetId:target.id,targetName:target.name,pressureRise,bloodRise,safetyLoss,shield:targetRecovery.spreadShield});
    }
    const emergencies=events.map((event)=>emergencyFromSpread(event,defs)).filter(Boolean);
    recovery.lastCycle=cycle;recovery.spreadReceipts[receipt]=Date.now();recovery.spreadReceipts=Object.fromEntries(Object.entries(recovery.spreadReceipts).slice(-24));recovery.spreadEvents=[...recovery.spreadEvents,...events].slice(-10);recovery.emergencies=[...(recovery.emergencies||[]),...emergencies].filter((event,index,rows)=>rows.findIndex((row)=>row.id===event.id)===index).slice(-12);
    if(events.length){living.headline=`Crisis spread: ${events.map((event)=>`${event.sourceName} → ${event.targetName}`).join(" • ")}.`;living.lastUpdatedAt=Date.now();}
    return {applied:events.length>0,reason:events.length?"spread":"stable",state:living,recovery,events,emergencies};
  }

  function cycleKey(now=Date.now()){
    return Math.floor(Math.max(0,Number(now)||Date.now())/CYCLE_MS);
  }
  function crisisBoard(districts, livingState=null, now=Date.now(), rawRecovery=null){
    const rows=normalizeDistricts(districts);
    if(!rows.length) return [];
    const cycle=cycleKey(now);
    const ranked=rows.map((district,index)=>({
      district,index,
      pressure:Number(livingState?.districts?.[district.id]?.tigerPressure ?? district.tigerPressure ?? 50),
      score:hash(`${cycle}:${district.id}`),
    })).sort((a,b)=>(b.pressure-a.pressure)||(b.score-a.score));
    const used=new Set();
    return CRISIS_TYPES.map((type,index)=>{
      const pool=ranked.filter((row)=>!used.has(row.district.id));
      const pick=pool[(hash(`${cycle}:${type.id}`)+index)%Math.max(1,pool.length)]||ranked[index%ranked.length];
      used.add(pick.district.id);
      const span=Math.max(1,Number(pick.district.maxMission||1)-Number(pick.district.minMission||1)+1);
      const missionLevel=Math.max(1,Math.min(100,Number(pick.district.minMission||1)+(hash(`${cycle}:${type.id}:mission`)%span)));
      const recovery=normalizeRecovery(rawRecovery,rows),status=recoveryStatus(livingState?.districts?.[pick.district.id]||pick.district,recovery.projects[pick.district.id]);
      return { ...type, districtId:pick.district.id, districtName:pick.district.name, missionLevel, cycle, risk:status.risk, recoveryTier:status.tier };
    });
  }
  function applyCrisisProfile(config, operation){
    const base={...(config||{})};
    const type=crisisById(operation?.typeId);
    if(!type) return base;
    base.postCampaignCrisis=true;
    base.postCampaignCrisisType=type.id;
    base.postCampaignDistrictId=String(operation?.districtId||"");
    base.chapterName=`World After the Ancient Tiger • ${type.name}`;
    base.objective=type.objective;
    base.civilians=Math.max(0,Number(type.civilians||0));
    base.civiliansExact=true;
    base.tigers=Math.max(1,Number(type.tigers||1));
    base.tigersExact=true;
    base.captureRequired=Math.max(0,Number(type.captures||0));
    base.convoyMission=type.id==="settlement_siege";
    base.boss=!!type.boss;
    base.bossTwin=false;
    base.bossType=type.bossType||base.bossType;
    base.forceGovernmentResponse=!!type.government;
    base.endgameHpMul=Math.max(1.05,Number(base.endgameHpMul||1));
    base.endgameAggroMul=Math.max(1.08,Number(base.endgameAggroMul||1));
    base.endgamePayoutMul=Math.max(1.18,Number(base.endgamePayoutMul||1));
    return base;
  }

  const ENDING_SCENES=Object.freeze({
    CAPTURE:Object.freeze([
      Object.freeze({at:0,title:"THE ANCIENT TIGER LIVES",caption:"The jungle falls silent as the Ancient Tiger is secured alive."}),
      Object.freeze({at:4200,title:"A NEW PROTECTORATE",caption:"Conservation teams carry the living Alpha toward the sanctuary transport."}),
      Object.freeze({at:8500,title:"THIRTY DISTRICTS CALL",caption:"Every rescued settlement lights up the command map with a new crisis."}),
      Object.freeze({at:12600,title:"YOUR WATCH CONTINUES",caption:"Mission 100 ended the hunt. It did not end your duty."}),
    ]),
    KILL:Object.freeze([
      Object.freeze({at:0,title:"THE ANCIENT TIGER FALLS",caption:"The final shot echoes through the temple and the jungle answers with a roar."}),
      Object.freeze({at:4200,title:"A VACANT THRONE",caption:"Without the Ancient Tiger, rival packs push into the empty territory."}),
      Object.freeze({at:8500,title:"THIRTY DISTRICTS CALL",caption:"Settlements report migrations, raids, and new Alphas fighting for control."}),
      Object.freeze({at:12600,title:"YOUR WATCH CONTINUES",caption:"Mission 100 ended one war. The living world has begun another."}),
    ]),
  });
  const ENDING_DURATION=16000;
  let movie=null;
  const el=(id)=>root.document?.getElementById(id)||null;
  const sceneFor=(choice,elapsed)=>{
    const scenes=ENDING_SCENES[choice]||ENDING_SCENES.KILL;
    return [...scenes].reverse().find((scene)=>elapsed>=scene.at)||scenes[0];
  };
  function drawEndingFrame(ctx,choice,elapsed){
    const w=ctx.canvas.width,h=ctx.canvas.height,p=clamp(elapsed/ENDING_DURATION,0,1);
    ctx.clearRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,choice==="CAPTURE"?"#0f766e":"#3f1d2e"); sky.addColorStop(.55,"#164e3b"); sky.addColorStop(1,"#052e16");
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    ctx.fillStyle="rgba(34,197,94,.22)";for(let x=0;x<w;x+=70)ctx.fillRect(x+(x%140?18:0),80+(x%210),46,h);
    ctx.fillStyle="#334155";ctx.fillRect(0,h*.68,w,h*.32);ctx.strokeStyle="#facc15";ctx.lineWidth=5;ctx.setLineDash([28,22]);ctx.beginPath();ctx.moveTo(0,h*.84);ctx.lineTo(w,h*.84);ctx.stroke();ctx.setLineDash([]);
    const tigerX=w*(.72-(p*.34)); const tigerY=h*.61;
    ctx.save();ctx.translate(tigerX,tigerY);ctx.fillStyle="#f97316";ctx.beginPath();ctx.ellipse(0,0,62,31,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(56,-12,27,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#111827";ctx.lineWidth=6;[-32,-10,12,32].forEach((x)=>{ctx.beginPath();ctx.moveTo(x,-24);ctx.lineTo(x+8,15);ctx.stroke();});ctx.restore();
    if(choice==="CAPTURE"){
      ctx.strokeStyle="#94a3b8";ctx.lineWidth=7;ctx.strokeRect(tigerX-82,tigerY-58,170,112);for(let x=tigerX-60;x<tigerX+80;x+=28){ctx.beginPath();ctx.moveTo(x,tigerY-58);ctx.lineTo(x,tigerY+54);ctx.stroke();}
      ctx.fillStyle="#166534";ctx.fillRect(w*.10,h*.55,180,70);ctx.fillStyle="#86efac";ctx.font="900 20px system-ui";ctx.fillText("WILDLIFE TRANSPORT",w*.12,h*.61);
    }else{
      ctx.fillStyle="rgba(239,68,68,.28)";ctx.beginPath();ctx.arc(tigerX,tigerY+26,52+Math.sin(elapsed/200)*6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#1e293b";ctx.fillRect(w*.10,h*.54,150,78);ctx.fillStyle="#fca5a5";ctx.font="900 20px system-ui";ctx.fillText("ALPHA ALERT",w*.13,h*.61);
    }
    const scene=sceneFor(choice,elapsed);ctx.fillStyle="rgba(2,6,23,.78)";ctx.fillRect(0,0,w,78);ctx.fillStyle="#f8fafc";ctx.font="1000 30px system-ui";ctx.textAlign="center";ctx.fillText(scene.title,w/2,48);
  }
  function stopMovie(){ if(movie?.frame&&root.cancelAnimationFrame) root.cancelAnimationFrame(movie.frame); movie=null; }
  function tick(now){
    if(!movie)return;const elapsed=clamp(now-movie.startedAt,0,ENDING_DURATION);drawEndingFrame(movie.ctx,movie.choice,elapsed);
    const scene=sceneFor(movie.choice,elapsed);const caption=el("postCampaignEndingCaption"),progress=el("postCampaignEndingProgress");
    if(caption)caption.textContent=scene.caption;if(progress)progress.style.width=`${Math.round(elapsed/ENDING_DURATION*100)}%`;
    if(elapsed>=ENDING_DURATION){movie.ended=true;const replay=el("postCampaignEndingReplayBtn");if(replay)replay.style.display="inline-flex";return;}
    movie.frame=root.requestAnimationFrame?.(tick)||0;
  }
  function openEnding(choice="KILL",endingInfo={}){
    const overlay=el("postCampaignEndingOverlay"),canvas=el("postCampaignEndingCanvas");if(!overlay||!canvas)return false;
    stopMovie();const normalized=String(choice).toUpperCase()==="CAPTURE"?"CAPTURE":"KILL";const title=el("postCampaignEndingTitle"),route=el("postCampaignEndingRoute"),replay=el("postCampaignEndingReplayBtn");
    if(title)title.textContent=normalized==="CAPTURE"?"The Sanctuary Dawn":"The Empty Throne";
    if(route)route.textContent=`${endingInfo.ending||"Campaign Ending"} • ${endingInfo.rewardTitle||"Tiger Strike Commander"}`;
    if(replay)replay.style.display="none";overlay.style.display="flex";movie={choice:normalized,endingInfo,ctx:canvas.getContext("2d"),startedAt:performance.now(),frame:0,ended:false};movie.frame=root.requestAnimationFrame?.(tick)||0;return true;
  }
  function replayEnding(){ if(!movie)return false;const info=movie.endingInfo,choice=movie.choice;return openEnding(choice,info); }
  function closeEnding(){ const overlay=el("postCampaignEndingOverlay");if(overlay)overlay.style.display="none";stopMovie();return false; }

  root.openPostCampaignEnding=openEnding;
  root.replayPostCampaignEnding=replayEnding;
  root.closePostCampaignEnding=closeEnding;
  return Object.freeze({VERSION,CYCLE_MS,CRISIS_TYPES,RECOVERY_PROJECTS,RESPONSE_OPTIONS,EMERGENCY_TYPES,RARE_EVENT_TYPES,ENDING_SCENES,ENDING_DURATION,crisisById,crisisByLaunchType,isCrisisLaunchType,difficultyForPlayers,projectById,responseById,emergencyTypeById,rareEventTypeById,normalizeRecovery,recoveryCost,recoveryStatus,fundRecoveryProject,eventMissionLevel,emergencyFromSpread,activeEmergencies,resolveWorldEvent,rareEventForCycle,responseOptionsForOperation,operationForEvent,applyCrisisDistrictOutcome,advanceCrisisSpread,cycleKey,crisisBoard,applyCrisisProfile,sceneFor,drawEndingFrame,openEnding,replayEnding,closeEnding});
});
