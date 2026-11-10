const {randomUUID}=require('node:crypto');
const {getState,compareAndSetState}=require('./metrics-store');
const expedition=require('../../rescue-expedition');
const water=require('../../water-terrain');
const maps=require('../../chapter-maps');

const key=uid=>`rescue_expedition_river_gate_${uid}`;
const read=uid=>getState(key(uid));
const hasRoute=route=>Object.hasOwn(expedition.routes,route);

async function prepare(uid,{expeditionRoute,expeditionReplay},readRoom){
  const previous=await read(uid);
  const room=previous?.roomCode&&await readRoom(previous.roomCode);
  if(room&&room.status!=='closed')throw Error('Resume or leave your current expedition stage first.');
  let run=previous;
  if(!run||run.stage===4){
    if(run&&!expeditionReplay)throw Error('Choose Replay to start a new expedition.');
    if(!hasRoute(expeditionRoute))throw Error('Choose the clinic or bridge route first.');
    run={id:randomUUID(),route:expeditionRoute,stage:1,results:[]};
  }
  return {previous,run};
}

async function attach(uid,plan,roomCode){
  return compareAndSetState(key(uid),plan.previous,{...plan.run,roomCode});
}

async function release(uid,saved,code){
  if(saved.roomCode!==code)return;
  if(!await compareAndSetState(key(uid),saved,{...saved,roomCode:''})){
    if((await read(uid))?.roomCode===code)throw Error('Could not close the saved stage. Try again.');
  }
}

async function save(session,result){
  const {ownerId,runId,stage}=session.expedition;
  for(let attempt=0;attempt<4;attempt++){
    const current=await read(ownerId);
    if(current?.id!==runId)throw Error('This expedition run has been replaced.');
    if(current.results.some(row=>row.stage===stage&&row.roomCode===session.code))return current;
    if(current.stage!==stage||current.roomCode!==session.code)throw Error('This stage no longer owns the expedition checkpoint.');
    const next={...current,stage:stage+1,results:[...current.results,{...result,stage,roomCode:session.code}]};
    if(await compareAndSetState(key(ownerId),current,next))return next;
  }
  throw Error('The checkpoint is busy. Try saving again.');
}

function mission(base,session){
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

module.exports={read,prepare,attach,release,save,mission};
