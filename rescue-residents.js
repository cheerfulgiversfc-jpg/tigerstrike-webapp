(function(root){
 'use strict';
 const EXPEDITIONS=['river-gate','flooded-village','mountain-sos'];
 const clone=x=>JSON.parse(JSON.stringify(x||{}));
 const clean=x=>String(x??'').slice(0,100);
 const key=(run,stage,id)=>JSON.stringify([run,stage,clean(id)]);
 const empty=()=>({version:1,sequence:0,stages:{},people:{},tigers:{},journal:{}});
 function event(c,id,type,resident){if(!c.journal[id])c.journal[id]={id,type,residentId:resident.id,name:resident.name,kind:resident.kind,expeditionId:resident.expeditionId,mode:resident.mode,sequence:c.sequence};}
 function admit(c,runId,row,stage,mode){
  const source={runId,expeditionId:row.expeditionId,route:row.route,stage,mode,admitted:c.sequence};
  const receipt=row.stages[stage];
  if(stage===3){
   const people=Array.isArray(receipt.evacuees)?receipt.evacuees:Array.isArray(receipt.survivorNames)?receipt.survivorNames.map((name,i)=>({id:'legacy-'+i,name})):[];
   for(const p of people){const id=key(runId,3,p.id);if(!p.name||c.people[id])continue;const resident={...source,id,kind:'person',name:clean(p.name),look:clean(p.look||'field'),child:p.child===true,care:0,needed:1,status:'recovering'};c.people[id]=resident;event(c,'arrive:'+id,'arrival',resident);}
  }
  // Counts without recorded tiger identities never create invented animals.
  for(const t of Array.isArray(receipt.capturedTigers)?receipt.capturedTigers:[]){
   if(!t.id)continue;const id=key(runId,stage,t.id);if(c.tigers[id])continue;
   const resident={...source,id,kind:'tiger',name:clean(t.name||t.type||'Rescued tiger'),type:clean(t.type||'Standard'),boss:t.boss===true,care:0,needed:2,status:'recovering'};
   c.tigers[id]=resident;event(c,'arrive:'+id,'arrival',resident);
  }
 }
 function bootstrap(book={}){
  const out=clone(book);if(out.center?.version===1)return out;
  const c=empty();out.center=c;
  // Existing receipts retain provenance. Recovery begins here, without invented historic care.
  for(const [id,row]of Object.entries(out.runs||{}))if(EXPEDITIONS.includes(row.expeditionId))for(const stage of [1,2,3])if(row.stages?.[stage]){
   c.stages[key(id,stage,'stage')]=0;admit(c,id,row,stage,row.stages[stage].mode);
  }
  return out;
 }
 function advance(book,runId,stages){
  const out=bootstrap(book),c=out.center,row=out.runs?.[runId];if(!row||!EXPEDITIONS.includes(row.expeditionId))return out;
  for(const stage of stages){const receipt=row.stages?.[stage],token=key(runId,stage,'stage');if(!receipt||Object.hasOwn(c.stages,token))continue;
   c.sequence++;c.stages[token]=c.sequence;admit(c,runId,row,stage,receipt.mode);
   for(const resident of [...Object.values(c.people),...Object.values(c.tigers)]){
    if(resident.status!=='recovering')continue;resident.care=Math.min(resident.needed,Math.max(0,c.sequence-resident.admitted));
    if(resident.care===resident.needed){resident.status=resident.kind==='tiger'?'release-ready':'recovered';event(c,'care:'+resident.id,'recovery',resident);}
   }
  }
  return out;
 }
 function release(book,id){
  const out=bootstrap(book),c=out.center,resident=Object.hasOwn(c.tigers,id)?c.tigers[id]:null;
  if(!resident)throw Error('Choose a tiger recorded in your rescue center.');
  if(resident.status==='released')return out;
  if(resident.status!=='release-ready')throw Error(`Complete ${resident.needed-resident.care} more expedition stage(s) to finish this tiger’s recovery.`);
  resident.status='released';resident.releasedAtSequence=c.sequence;event(c,'release:'+id,'release',resident);return out;
 }
 function view(book={},scope='All'){
  const c=bootstrap(book).center,runMode=r=>{const values=[...new Set(Object.values(book.runs?.[r.runId]?.stages||{}).map(s=>s.mode))];return values.length>1?'Mixed':values[0]||r.mode;},withMode=r=>({...r,mode:runMode(r)}),filter=r=>scope==='All'||r.mode===scope;
  return {sequence:c.sequence,people:Object.values(c.people).map(withMode).filter(filter),tigers:Object.values(c.tigers).map(withMode).filter(filter),journal:Object.values(c.journal).map(e=>({...e,mode:runMode(c.people[e.residentId]||c.tigers[e.residentId]||e)})).filter(filter).sort((a,b)=>b.sequence-a.sequence)};
 }
 const api={empty,bootstrap,advance,release,view};if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerRescueResidents=api;
})(globalThis);
