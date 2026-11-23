(function(root){
 'use strict';
 const EXPEDITIONS=['river-gate','flooded-village','mountain-sos','wildlife-corridor'];
 const clone=x=>JSON.parse(JSON.stringify(x||{}));
 const clean=x=>String(x??'').slice(0,100);
 const key=(run,stage,id)=>JSON.stringify([run,stage,clean(id)]);
 const empty=()=>({version:1,sequence:0,stages:{},people:{},tigers:{},journal:{}});
 function event(c,id,type,resident){if(!c.journal[id])c.journal[id]={id,type,residentId:resident.id,name:resident.name,kind:resident.kind,expeditionId:resident.expeditionId,mode:resident.mode,sequence:c.sequence};}
 function admit(c,runId,row,stage,mode){
  const source={runId,expeditionId:row.expeditionId,route:row.route,stage,mode,admitted:c.sequence};
  const receipt=row.stages[stage];
  if(stage===(row.expeditionId==='wildlife-corridor'?1:3)){
   const people=Array.isArray(receipt.evacuees)?receipt.evacuees:Array.isArray(receipt.survivorNames)?receipt.survivorNames.map((name,i)=>({id:'legacy-'+i,name})):[];
   for(const p of people){const id=key(runId,stage,p.id);if(!p.name||c.people[id])continue;const resident={...source,id,kind:'person',name:clean(p.name),look:clean(p.look||'field'),child:p.child===true,care:0,needed:1,status:'recovering'};c.people[id]=resident;event(c,'arrive:'+id,'arrival',resident);}
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
 const TITLES={'wildlife-corridor':'Wildlife Corridor','river-gate':'Blackout at River Gate','flooded-village':'Flooded Village','mountain-sos':'Mountain SOS'};
 const ROUTE_LINES={
  'wildlife-corridor':{bridge:'Our rescue used the direct convoy bridge.',forest:'Our rescue used the longer forest trail.'},
  'river-gate':{clinic:'Our rescue used the clinic route.',bridge:'Our rescue used the reopened bridge route.'},
  'flooded-village':{boat:'Our rescue used the repaired rescue boat.',shelter:'Our rescue used the shelter route.'},
  'mountain-sos':{forest:'Our rescue followed the forest trail.',ridge:'Our rescue followed the ridge crossing.'}
 };
 function conversation(book,id,topic='rescue'){
  const c=bootstrap(book).center,p=Object.hasOwn(c.people,id)?c.people[id]:null;
  if(!p)throw Error('Choose a survivor recorded in your rescue center.');
  if(!['rescue','recovery'].includes(topic))throw Error('Choose a conversation topic.');
  const route=ROUTE_LINES[p.expeditionId]?.[p.route];
  const line=topic==='rescue'?`I made it here after ${TITLES[p.expeditionId]}. ${route||'Thank you for helping with our evacuation.'}`:
   p.status==='recovered'?'The medical team has finished my recovery. Thank you for getting me to safety.':"The medical team is still looking after me. There is no rush to return; I will be safe here while you help on other expeditions.";
  return {resident:{...p},topic,line,origin:TITLES[p.expeditionId],legacy:JSON.parse(p.id)[2].startsWith('legacy-')};
 }
 function journalReplay(book,eventId,scope='All'){
  const data=view(book,scope),entry=data.journal.find(e=>e.id===eventId);if(!entry)return null;
  const resident=[...data.people,...data.tigers].find(r=>r.id===entry.residentId);if(!resident)return null;
  if(entry.type==='release'&&resident.kind==='tiger'&&resident.status==='released')return {kind:'release',resident};
  if(entry.type==='recovery')return {kind:resident.kind==='person'?'care-person':'care-tiger',resident};
  if(entry.type==='arrival')return {kind:resident.kind==='person'?'arrival-person':'arrival-tiger',resident};
  return null;
 }
 const api={empty,bootstrap,advance,release,view,conversation,journalReplay};if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerRescueResidents=api;
})(globalThis);
