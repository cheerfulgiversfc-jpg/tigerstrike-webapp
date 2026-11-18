(function(root){
  'use strict';
  const CATALOG={
    'river-gate':{id:'river-gate',name:'River Gate Rescuer',tailoring:'river',body:'#258d86',light:'#8de0c5',dark:'#173f43',vest:'#294c53',helmet:'#347c74',trim:'#f6c878'},
    'flooded-village':{id:'flooded-village',name:'Floodplain Lifeguard',tailoring:'rescue',body:'#dc783b',light:'#ffd495',dark:'#384f65',vest:'#254f70',helmet:'#de8242',trim:'#b6eef4'},
    'mountain-sos':{id:'mountain-sos',name:'Summit Responder',tailoring:'mountain',body:'#b74043',light:'#f4c1af',dark:'#3c4859',vest:'#c4d2d8',helmet:'#c14549',trim:'#eff8ff'},
  };
  const modes=['Solo','Co-op','Mixed'];
  function empty(){return {version:1,runs:{},uniform:''};}
  function validRun(run){return !!CATALOG[run?.expeditionId]&&typeof run?.id==='string'&&run.id.length<=80&&typeof run.route==='string'&&Array.isArray(run.results);}
  function credit(raw,run,uid){
    const state=JSON.parse(JSON.stringify(raw||empty()));
    if(!validRun(run))return state;
    state.runs=state.runs||{};
    const stages=run.results.filter(r=>[1,2,3].includes(r.stage)&&['Solo','Co-op'].includes(r.mode)&&r.team?.some(p=>Number(p.userId)===Number(uid)));
    if(!stages.length)return state;
    const old=state.runs[run.id]||{expeditionId:run.expeditionId,route:run.route,stages:{}};
    if(old.expeditionId!==run.expeditionId||old.route!==run.route)throw Error('Expedition receipt does not match its recorded run.');
    for(const r of stages)if(!old.stages[r.stage])old.stages[r.stage]={mode:r.mode,roomCode:r.roomCode,
      survivorNames:Array.isArray(r.survivors)?r.survivors.map(name=>String(name).slice(0,80)):null,
      survivors:Array.isArray(r.survivors)?r.survivors.length:0,captures:Number(r.captures)||0,kills:Number(r.kills)||0,
      metrics:r.recordVersion===1,durationMs:Number.isFinite(r.durationMs)&&r.durationMs>=0?r.durationMs:null,
      wipes:Number.isFinite(r.wipes)&&r.wipes>=0?r.wipes:null,rescueRequired:Number.isFinite(r.rescueRequired)?r.rescueRequired:null};
    state.runs[run.id]=old;
    return state;
  }
  function complete(row){return [1,2,3].every(s=>row.stages?.[s]);}
  function mode(row){const values=new Set(Object.values(row.stages||{}).map(s=>s.mode));return values.size===1?[...values][0]:'Mixed';}
  function earned(state,id){return Object.values(state?.runs||{}).some(r=>r.expeditionId===id&&complete(r));}
  function mastered(state,id){return new Set(Object.values(state?.runs||{}).filter(r=>r.expeditionId===id&&complete(r)).map(r=>r.route)).size>=2;}
  function equip(state,id){if(id&&!earned(state,id))throw Error('Complete all three stages of one expedition run to earn this outfit.');return {...(state||empty()),uniform:id||''};}
  function identity(state){const item=CATALOG[state?.uniform];return item&&earned(state,item.id)?{id:item.id,name:item.name,palette:item,patch:mastered(state,item.id)}:null;}
  function summary(state,id){
    const rows=Object.values(state?.runs||{}).filter(r=>r.expeditionId===id);
    return {uniform:CATALOG[id],earned:earned(state,id),equipped:state?.uniform===id&&earned(state,id),mastered:mastered(state,id),
      modes:modes.map(scope=>{
        const done=rows.filter(r=>complete(r)&&mode(r)===scope);
        const medals=new Set(),times=[];
        for(const r of done){const stages=Object.values(r.stages),known=stages.every(s=>s.metrics);
          if(known&&stages.every(s=>s.survivors===s.rescueRequired))medals.add('Everyone evacuated');
          if(known&&stages.every(s=>s.kills===0))medals.add('No lethal kills');
          if(known&&stages.every(s=>s.wipes===0))medals.add('No squad wipe');
          if(known&&stages.every(s=>s.durationMs!==null))times.push(stages.reduce((n,s)=>n+s.durationMs,0));
        }
        return {mode:scope,clears:done.length,routes:[...new Set(done.map(r=>r.route))],medals:[...medals],bestMs:times.length?Math.min(...times):null};
      }),
      recent:rows.slice(-6).reverse().map(r=>({route:r.route,mode:mode(r),stages:Object.keys(r.stages).map(Number).sort(),complete:complete(r)})),
    };
  }
  const api={CATALOG,modes,empty,credit,complete,mode,earned,mastered,equip,identity,summary};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerExpeditionMastery=api;
})(globalThis);
