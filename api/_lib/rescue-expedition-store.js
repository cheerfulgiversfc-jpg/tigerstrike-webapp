const {randomUUID}=require('node:crypto');
const {getState,setState,compareAndSetState}=require('./metrics-store');
const expedition=require('../../rescue-expedition');
const water=require('../../water-terrain');
const maps=require('../../chapter-maps');

const key=(uid,id='river-gate')=>`rescue_expedition_${id==='river-gate'?'river_gate':id}_${uid}`;
const read=(uid,id='river-gate')=>getState(key(uid,id));

async function prepare(uid,{expeditionId='river-gate',expeditionRoute,expeditionReplay},readRoom){
  const adventure=expedition.definition(expeditionId);
  if(!adventure)throw Error('Choose an available rescue expedition.');
  const previous=await read(uid,adventure.id);
  const room=previous?.roomCode&&await readRoom(previous.roomCode);
  if(room&&room.status!=='closed')throw Error('Resume or leave your current expedition stage first.');
  let run=previous;
  if(!run||run.stage===4){
    if(run&&!expeditionReplay)throw Error('Choose Replay to start a new expedition.');
    if(!Object.hasOwn(adventure.routes,expeditionRoute))throw Error('Choose a route for this expedition first.');
    run={id:randomUUID(),expeditionId:adventure.id,route:expeditionRoute,stage:1,results:[]};
  }
  return {previous,run,expeditionId:adventure.id};
}

async function attach(uid,plan,roomCode){
  return compareAndSetState(key(uid,plan.expeditionId),plan.previous,{...plan.run,roomCode,roomStage:plan.run.stage});
}

async function release(uid,saved,code,completedStage){
  if(completedStage&&Number(saved.roomStage||completedStage)>completedStage)throw Error('The squad advanced to the next stage. Refresh the expedition.');
  if(saved.roomCode!==code)return;
  if(!await compareAndSetState(key(uid,saved.expeditionId),saved,{...saved,roomCode:''})){
    if((await read(uid,saved.expeditionId))?.roomCode===code)throw Error('Could not close the saved stage. Try again.');
  }
}

async function save(session,result){
  const {ownerId,runId,stage,id}=session.expedition;
  for(let attempt=0;attempt<4;attempt++){
    const current=await read(ownerId,id);
    if(current?.id!==runId)throw Error('This expedition run has been replaced.');
    if(current.results.some(row=>row.stage===stage&&row.roomCode===session.code))return current;
    if(current.stage!==stage||current.roomCode!==session.code)throw Error('This stage no longer owns the expedition checkpoint.');
    const next={...current,stage:stage+1,roomStage:stage,results:[...current.results,{...result,stage,roomCode:session.code}]};
    if(await compareAndSetState(key(ownerId,id),current,next))return next;
  }
  throw Error('The checkpoint is busy. Try saving again.');
}

function mission(base,session){
  if(session.expedition.id==='mountain-sos')return mountainMission(base,session);
  if(session.expedition.id==='flooded-village')return floodedMission(base,session);
  const {stage,route}=session.expedition;
  const solo=expedition.isSolo(session.launchType);
  const clinic=route==='clinic';
  const waterZones=maps.forMission(1).waterZones;
  const river=waterZones[0];
  const crossing=water.banks(river,2400);
  const dockX=3510;
  const dockBank=water.banks(river,dockX);
  const dock={x:dockX,y:dockBank.top-46,r:95};
  const boat={x:dockX,y:dockBank.center,endX:4520};
  const site=stage===1
    ? (clinic?{id:'exp_clinic_power',x:1430,y:1510,label:'Restore clinic power'}:{id:'exp_bridge_open',x:2400,y:crossing.top-88,label:'Reopen the bridge'})
    : stage===2
      ? (clinic?{id:'exp_triage',x:1430,y:1510,label:'Stabilize the patients'}:{id:'exp_crossing',x:2400,y:crossing.bottom+75,label:'Defend the crossing'})
      : null;
  const survivors=['Mara','Eli','Nia'].map((name,i)=>({
    id:`exp_civ_${i+1}`,name,look:i===0?'medic':'field',
    x:(stage===3?dockX-430:clinic?1430:2160)+i*85,
    y:stage===3?dock.y-135:clinic?1570:crossing.top-170,
    injured:stage===2&&clinic,
  }));
  const rescueHouse=stage===3
    ? {x:dockX-165,y:dock.y-25,r:95,label:'Dock boarding point'}
    : {x:clinic?2780:2550,y:clinic?1640:crossing.bottom+110,r:95,label:'River Gate shelter'};
  const extraction=stage===3?dock:{x:rescueHouse.x+175,y:rescueHouse.y,r:95};
  const tigerCount=stage===2&&!clinic?2:1;
  const threats=base.tigers.slice(0,tigerCount).map((t,i)=>({
    ...t,boss:false,hpMax:solo?115:165,
    baseX:stage===3?dockX+140:clinic?1710:2480+i*240,
    baseY:stage===3?dock.y-195:clinic?1410:crossing.top-260+i*450,
  }));
  const spawn=stage===3?{x:dockX-565,y:dock.y-285}:clinic?{x:1150,y:1480}:{x:1990,y:crossing.top-255};
  const objective=stage===1
    ? `${site.label}, clear the threat, then regroup at extraction.`
    : stage===2
      ? (clinic?'Stabilize the three patients at the powered clinic, escort them to the shelter, then extract.':'Cross the reopened bridge, clear its patrols, and escort all three civilians to the shelter before extracting.')
      : 'Escort all three survivors to the boarding point, hold the extraction circle while they board, and clear any remaining threats.';
  return {...base,level:1,title:`Stage ${stage} · ${expedition.stages[stage-1]}`,chapterName:expedition.title,
    world:maps.forMission(1).world,waterZones,spawns:[spawn,{x:spawn.x+46,y:spawn.y+34}],rescueHouse,extraction,boat:stage===3?boat:null,
    checkpoints:site?[{...site,r:105,manual:site.id!=='exp_crossing'}]:[],checkpointsBeforeRescue:stage===1||(stage===2&&clinic),
    objective,civilians:stage===1?[]:survivors,rescueRequired:stage===1?0:survivors.length,
    tigers:threats,timeLimitMs:12*60000,captureRequired:0,captureTargetIds:[],playerCount:solo?1:2,
    tigerDamageMultiplier:solo?.65:.85,extractionType:stage===3?'boat':'ground',
    mapTruthLandmarks:[],mapTruthRequiredActionIds:[],fireZones:[]};
}

function floodedMission(base,session){
  const {stage,route}=session.expedition;
  const adventure=expedition.definition('flooded-village');
  const solo=expedition.isSolo(session.launchType);
  const original=maps.forMission(1);
  const source={...original.waterZones[0],ry:[130,190,235][stage-1],bridges:[]};
  const bridgeX=2400;
  const bridgeBank=water.banks(source,bridgeX);
  const river={...source,bridges:[{x:bridgeX-58,y:bridgeBank.top-22,w:116,h:bridgeBank.bottom-bridgeBank.top+44}]};
  const bank=x=>water.banks(river,x);
  const landingX=3200,landing=bank(landingX);
  const shelter={x:3650,y:bank(3650).bottom+145,r:95,label:'Village rescue shelter'};
  const dockX=4140,dockBank=bank(dockX);
  const dock={x:dockX,y:dockBank.bottom+60,r:90};
  const boatRoute=route==='boat';
  const preparation=boatRoute
    ? {id:'fv_boat_repair',x:landingX,y:landing.top-85,r:95,label:'Repair the rescue boat',manual:true}
    : {id:'fv_shelter_power',x:shelter.x,y:shelter.y,r:95,label:'Restore shelter power',manual:true};
  const homes=[
    {id:'fv_home_west',x:2890,y:bank(2890).top-85,r:100,label:'Open the west home exit',manual:true},
    {id:'fv_home_east',x:3440,y:bank(3440).top-85,r:100,label:'Open the east home exit',manual:true},
  ];
  const survivors=['Asha','Jonah','Suri','Tomas'].map((name,i)=>{
    const home=homes[i<2?0:1];
    return {id:`fv_civ_${i+1}`,name,look:i===2?'medic':'field',
      x:stage===3?3770+(i%2)*85:home.x+(i%2?42:-42),
      y:stage===3?dockBank.bottom+130+Math.floor(i/2)*50:home.y+25,
      injured:!boatRoute&&stage>1,
    };
  });
  const ferry=stage===2&&boatRoute?{
    from:{x:landingX,y:landing.top-65,r:125},to:{x:landingX,y:landing.bottom+90},
    boatFrom:{x:landingX,y:landing.top+36},boatTo:{x:landingX,y:landing.bottom-36},duration:5000,
  }:null;
  const checkpoints=stage===1?[preparation]:stage===2?homes:boatRoute?[]:[
    {id:'fv_stabilize',...shelter,label:'Stabilize the villagers',manual:true},
  ];
  const rescueHouse=stage===3?{x:dockX-160,y:dock.y+45,r:95,label:'Village boat boarding point'}:shelter;
  const extraction=stage===3?dock:stage===1?{x:preparation.x+155,y:preparation.y,r:90}:{x:shelter.x+155,y:shelter.y,r:90};
  const spawn=stage===1&&!boatRoute?{x:shelter.x-270,y:shelter.y-25}
    : stage===3?{x:3550,y:dockBank.bottom+145}:{x:2670,y:bank(2670).top-175};
  const threats=base.tigers.slice(0,solo?1:2).map((t,i)=>({
    ...t,boss:false,hpMax:solo?105:150,
    baseX:stage===3?dockX+80-i*230:stage===1&&!boatRoute?shelter.x-100:3060+i*390,
    baseY:stage===3?dock.y+100:stage===1&&!boatRoute?shelter.y-100:bank(3060+i*390).top-155,
  }));
  const boat=stage===3?{x:dockX,y:dockBank.center,endX:4650}:null;
  const objective=stage===1
    ? `${preparation.label}, clear the tiger threat, then regroup at extraction.`
    : stage===2
      ? `Open both marked home exits, rescue all four villagers, and ${boatRoute?'bring the whole party to the ferry landing for a dry crossing':'follow the marked bridge route'} to the village shelter.`
      : `${boatRoute?'Escort':'Stabilize at the restored shelter, then escort'} all four villagers to the boat boarding point. Defend the landing and hold extraction for 8 seconds.`;
  const floodedHomes=homes.map(home=>({id:home.id,x:home.x-88,y:home.y-106,w:176,h:90,label:home.label}));
  const shelterBuilding={x:shelter.x-90,y:shelter.y-148,w:180,h:96};
  return {...base,level:1,title:`Stage ${stage} · ${adventure.stages[stage-1]}`,chapterName:adventure.title,
    world:original.world,waterZones:[river],spawns:[spawn,{x:spawn.x+48,y:spawn.y+28}],
    rescueHouse,extraction,boat,ferry,checkpoints,checkpointsBeforeRescue:stage!==3||!boatRoute,
    objective,civilians:stage===1?[]:survivors,rescueRequired:stage===1?0:4,tigers:threats,
    captureRequired:0,captureTargetIds:[],timeLimitMs:14*60000,playerCount:solo?1:2,
    tigerDamageMultiplier:solo?.6:.8,extractionType:stage===3?'boat':'ground',weatherFx:'rain',
    expeditionScene:{floodStage:stage,homes:floodedHomes,shelter:shelterBuilding,
      shelterPowered:route==='shelter'&&stage>1,preparationBoat:boatRoute&&stage===1?{x:landingX,y:landing.center}:null,
      helicopter:stage===1?{x:spawn.x-60,y:spawn.y-75}:null},
    mapTruthLandmarks:[],mapTruthRequiredActionIds:[],fireZones:[]};
}

function mountainMission(base,session){
  const {stage,route}=session.expedition,solo=expedition.isSolo(session.launchType);
  const adventure=expedition.definition('mountain-sos'),forest=route==='forest';
  const world=maps.forMission(51).world;
  const river={...maps.forMission(51).waterZones[0],y:1500,ry:90,bridges:[],label:'Mountain meltwater river'};
  const bridgeX=forest?1800:3020,b=water.banks(river,bridgeX);
  if(stage>1||session.expeditionBridgeOpen)river.bridges=[{x:bridgeX-58,y:b.top-22,w:116,h:b.bottom-b.top+44}];
  const shelter={x:forest?2460:3300,y:b.bottom+275,r:105,label:'Mountain medical shelter'};
  const landing={x:4050,y:2200,r:110};
  const start=stage===1?{x:forest?880:2240,y:720}:stage===2?{x:forest?1300:2680,y:b.top-285}:{x:shelter.x+180,y:shelter.y+110};
  const signal={id:'ms_signal',x:forest?1050:2480,y:820,r:100,manual:true,label:'Trace the hikers’ distress beacon'};
  const repair={id:forest?'ms_forest_bridge':'ms_ridge_bridge',x:bridgeX,y:b.top-85,r:95,manual:true,requires:['ms_signal'],label:forest?'Repair the forest footbridge':'Repair the ridge crossing'};
  const treatment={id:'ms_treatment',...shelter,r:180,manual:true,requiresParty:true,label:'Treat the hikers with the medical team'};
  const crossing={id:'ms_crossing',x:bridgeX,y:b.bottom+80,r:125,label:'Escort the medical team across the repaired bridge'};
  const checkpoints=stage===1?[signal,repair]:stage===2?[crossing,treatment]:[];
  const civilians=['Medic Rowan','Hiker Imani','Hiker Leo','Hiker June'].map((name,i)=>({
    id:`ms_civ_${i+1}`,name,look:i===0?'medic':'field',injured:stage===2&&i>0,
    x:stage===3?shelter.x+170+(i%2)*55:start.x+85+(i%2)*55,
    y:stage===3?shelter.y+40+Math.floor(i/2)*55:start.y+50+Math.floor(i/2)*55,
  }));
  const path=stage===1?[start,signal,repair]:stage===2
    ? [start,{x:bridgeX,y:b.top-125},crossing,...(forest?[{x:2000,y:shelter.y+160}]:[]),shelter]
    : [start,{x:3570,y:2100},landing];
  const count=(solo?1:2)+(stage===2&&!forest?1:0);
  const tigers=Array.from({length:count},(_,i)=>({...base.tigers[i%base.tigers.length],id:`ms_tiger_${i+1}`,name:'Mountain trail tiger',type:'Standard',boss:false,hpMax:solo?100:145,
    baseX:stage===3?3830+i*160:stage===1?bridgeX+180+i*150:bridgeX+180+i*200,
    baseY:stage===3?2030+i*70:stage===1?b.top-240:b.bottom+185+i*50}));
  return {...base,level:51,title:`Stage ${stage} · ${adventure.stages[stage-1]}`,chapterName:adventure.title,
    world,waterZones:[river],spawns:[start,{x:start.x+48,y:start.y+30}],
    checkpoints,checkpointsBeforeRescue:stage===1,
    rescueHouse:stage===3?{x:landing.x-145,y:landing.y,r:100,label:'Helicopter boarding point'}:shelter,
    extraction:stage===1?{x:bridgeX-175,y:b.top-85,r:95}:stage===2?{x:shelter.x+170,y:shelter.y,r:95}:landing,
    helicopter:stage===3?{x:landing.x,y:landing.y-65,endX:4650,endY:1650}:null,boat:null,ferry:null,
    objective:stage===1?'Trace the distress beacon, repair your chosen crossing, clear the patrol and regroup at extraction.'
      :stage===2?`Rescue the medical team and all three hikers, use the marked ${forest?'forest footbridge':'ridge crossing'}, treat everyone at the medical shelter, then deliver them and extract.`
      :'Bring the medic and all three hikers to the helicopter boarding point. Clear the threats and hold the landing zone for 8 seconds while everyone boards.',
    civilians:stage===1?[]:civilians,rescueRequired:stage===1?0:4,tigers,captureRequired:0,captureTargetIds:[],
    timeLimitMs:18*60000,playerCount:solo?1:2,tigerDamageMultiplier:solo?.55:.75,
    extractionType:stage===3?'helicopter':'ground',weatherFx:'clear',
    expeditionScene:{kind:'mountain',path,bridgeX,shelter:{x:shelter.x-80,y:shelter.y-145,w:160,h:90},
      homes:[],helicopter:stage===3?{x:landing.x,y:landing.y-65}:null,
      peaks:[{x:550,y:440},{x:1560,y:370},{x:3500,y:400},{x:4430,y:1050},{x:600,y:2090}],
      routeLabel:forest?'FOREST TRAIL · FEWER PATROLS':'RIDGE CROSSING · EXTRA PATROL'},
    mapTruthLandmarks:[],mapTruthRequiredActionIds:[],fireZones:[]};
}

async function advance(session){
  const {ownerId,runId,id,stage}=session.expedition;
  for(let attempt=0;attempt<4;attempt++){
    const current=await read(ownerId,id);
    if(current?.id!==runId||current.roomCode!==session.code||current.stage!==stage+1)throw Error('This expedition checkpoint moved. Reopen Rescue Mode.');
    if(current.roomStage===stage+1)return current;
    const next={...current,roomStage:stage+1};
    if(await compareAndSetState(key(ownerId,id),current,next))return next;
  }
  throw Error('The checkpoint is busy. Try continuing again.');
}

const membershipKey=(uid,id)=>`rescue_expedition_member_${uid}_${id}`;
const membership=(uid,id)=>getState(membershipKey(uid,id));
async function remember(session,uid,left=false){
  const {id='river-gate',ownerId,runId}=session.expedition;
  return setState(membershipKey(uid,id),{code:session.code,ownerId,runId,left,expeditionId:id});
}

async function withRoomLock(code,operation){
  const name=`rescue_expedition_transition_${code}`,previous=await getState(name);
  if(Number(previous?.until)>Date.now())throw Error('Your squad is updating. Try again in a moment.');
  const lease={token:randomUUID(),until:Date.now()+90000};
  if(!await compareAndSetState(name,previous,lease))throw Error('Your squad is updating. Try again in a moment.');
  try{return await operation();}
  finally{await compareAndSetState(name,lease,{token:'',until:0});}
}

module.exports={read,prepare,attach,release,save,advance,membership,remember,withRoomLock,mission};
