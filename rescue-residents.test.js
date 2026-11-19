const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const M=require('./expedition-mastery'),R=require('./rescue-residents'),store=require('./api/_lib/expedition-mastery-store'),C=require('./rescue-command');
function run(id,uid=987001){return {id,expeditionId:'river-gate',route:'clinic',results:[1,2,3].map(stage=>({stage,mode:'Co-op',team:[{userId:uid},{userId:uid+1}],survivors:stage===3?['Mara']:[],evacuees:stage===3?[{id:'civilian-1',name:'Mara',look:'medic'}]:[],captures:1,capturedTigers:[{id:'tiger-1',name:'River Alpha',type:'Alpha',boss:true}],kills:0,recordVersion:1,wipes:0,durationMs:30000,rescueRequired:stage===3?1:0}))};}
test('actual identities survive retries, progress through real later stages, and release once without changing source records',()=>{
 const a=run('residents');let b=M.credit(null,{...a,results:a.results.slice(0,1)},987001);const first=R.view(b).tigers[0];
 assert.equal(first.care,0);assert.equal(first.status,'recovering');assert.throws(()=>R.release(b,first.id),/2 more/);
 const before=JSON.stringify(b);for(let i=0;i<5;i++){R.view(b);C.model(b);b=M.credit(b,{...a,results:a.results.slice(0,1)},987001);}assert.equal(JSON.stringify(b),before);
 b=M.credit(b,{...a,results:a.results.slice(0,2)},987001);assert.equal(R.view(b).tigers[0].care,1);
 b=M.credit(b,a,987001);let view=R.view(b);assert.equal(view.tigers.length,3);assert.equal(view.tigers[0].status,'release-ready');assert.equal(view.tigers[1].care,1);assert.equal(view.people[0].name,'Mara');assert.equal(view.people[0].status,'recovering');
 const prior=JSON.stringify(b);const released=R.release(b,first.id);assert.equal(JSON.stringify(b),prior);assert.equal(R.view(released).tigers[0].status,'released');assert.equal(R.view(released).journal.filter(e=>e.type==='release').length,1);assert.deepEqual(R.release(released,first.id),released);
 b=M.credit(released,{...run('later'),results:run('later').results.slice(0,1)},987001);assert.equal(R.view(b).people[0].status,'recovered');assert.equal(R.view(b).tigers[0].status,'released');assert.equal(R.view(b).journal.filter(e=>e.type==='recovery'&&e.kind==='person').length,1);
 assert.equal(b.runs.residents.stages[1].captures,1);assert.equal(M.summary(b,'river-gate').modes[1].clears,1);
});
test('legacy totals never invent tiger identities or past care, while named evacuees keep their recorded origin',()=>{
 const old={runs:{old:{expeditionId:'river-gate',route:'clinic',stages:{1:{mode:'Solo',captures:12},2:{mode:'Solo',captures:12},3:{mode:'Solo',captures:12,survivors:2,survivorNames:['Mara','Eli']}}}}};
 const view=R.view(old);assert.equal(view.tigers.length,0);assert.equal(view.people.length,2);assert.equal(view.people[0].care,0);assert.equal(view.sequence,0);assert.deepEqual(R.bootstrap(R.bootstrap(old)),R.bootstrap(old));assert.equal(old.center,undefined);
});
test('Co-op credits and CAS releases remain separate, concurrent retries cannot duplicate journal events or drop outfits',async()=>{
 const a=run('concurrent',987011);a.results[2].team.push({userId:987013});await Promise.all([store.creditRun(a),store.creditRun(a)]);
 const first=(await store.read(987011)).center.tigers,one=Object.keys(first)[0];
 await Promise.all([store.release(987011,one),store.release(987011,one),store.equip(987011,'river-gate')]);
 const host=await store.read(987011),guest=await store.read(987012),late=await store.read(987013);
 assert.equal(host.uniform,'river-gate');assert.equal(host.center.tigers[one].status,'released');assert.equal(guest.center.tigers[one].status,'release-ready');assert.equal(R.view(host).journal.filter(e=>e.type==='release').length,1);
 assert.equal(R.view(late).tigers.length,1);assert.equal(R.view(late).tigers[0].care,0);assert.equal(R.view(late).people.length,1);
 const mixed=run('mixed');mixed.results[1].mode='Solo';const b=M.credit(null,mixed,987001);assert.equal(R.view(b,'Mixed').tigers.length,3);assert.equal(R.view(b,'Solo').tigers.length,0);
});
test('signed release API rejects forged ownership and premature release; repeat requests return the same permanent result',async()=>{
 const handler=require('./api/squad/session'),old=process.env.TELEGRAM_BOT_TOKEN;process.env.TELEGRAM_BOT_TOKEN='LOCAL_RESIDENT_AUTH_TEST';
 const uid=987021;await store.creditRun(run('signed',uid));const list=R.view(await store.read(uid)).tigers;
 const signed=id=>{const p=new URLSearchParams({user:JSON.stringify({id,first_name:'Test'}),auth_date:String(Math.floor(Date.now()/1000))}),check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n'),secret=crypto.createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();p.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));return p.toString();};
 async function request(body){let status,result;await handler({method:'POST',body},{status(n){status=n;return this;},setHeader(){},json(v){result=v;return this;}});return {status,result};}
 try{
  assert.equal((await request({action:'expedition-release',residentId:list[0].id})).status,400);
  assert.equal((await request({initData:signed(uid+99),userId:uid,action:'expedition-release',residentId:list[0].id})).status,400);
  assert.equal((await request({initData:signed(uid),action:'expedition-release',residentId:list[2].id})).status,400);
  for(let i=0;i<2;i++){const response=await request({initData:signed(uid),action:'expedition-release',residentId:list[0].id});assert.equal(response.status,200);assert.equal(R.view(response.result.mastery).journal.filter(e=>e.type==='release').length,1);}
  assert.equal((await request({initData:signed(uid),action:'expedition-release',residentId:'__proto__'})).status,400);
 }finally{if(old===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=old;}
});
test('care and protected-habitat releases render the production actors with balanced finite canvas state',()=>{
 const b=M.credit(null,run('art'),987001),data=C.model(b),before=JSON.stringify(data);let depth=0;
 const c=new Proxy({}, {get:(_o,k)=>k==='measureText'?s=>({width:String(s).length*5}):/create.*Gradient/.test(k)?()=>({addColorStop(){}}):(...args)=>{if(k==='save')depth++;if(k==='restore')depth--;assert(depth>=0);for(const a of args)if(typeof a==='number')assert(Number.isFinite(a));},set:()=>true});
 for(const kind of ['care-person','care-tiger','release'])for(const elapsed of [0,3000,6000,11999])for(const reduced of [true,false]){C.draw(c,data,{scene:{kind,resident:kind==='care-person'?data.residents.people[0]:data.residents.tigers[0]},elapsed,now:elapsed,reduced});assert.equal(depth,0);}
 assert.equal(JSON.stringify(data),before);
});
test('survivor conversations use recorded routes and recovery, reject unknown residents and never advance care',()=>{
 const a=run('conversation'),book=M.credit(null,a,987001),id=R.view(book).people[0].id,before=JSON.stringify(book);
 assert.match(R.conversation(book,id).line,/Blackout at River Gate.*clinic/);
 assert.match(R.conversation(book,id,'recovery').line,/still looking after/);
 for(let i=0;i<10;i++)R.conversation(book,id,i%2?'rescue':'recovery');assert.equal(JSON.stringify(book),before);
 const later=M.credit(book,{...run('conversation-next'),results:run('conversation-next').results.slice(0,1)},987001);
 assert.match(R.conversation(later,id,'recovery').line,/finished my recovery/);
 assert.throws(()=>R.conversation(book,'missing'),/recorded/);assert.throws(()=>R.conversation(book,id,'grant-rewards'),/topic/);
 const routes=[['flooded-village','boat',/repaired rescue boat/],['flooded-village','shelter',/shelter route/],['mountain-sos','forest',/forest trail/],['mountain-sos','ridge',/ridge crossing/],['river-gate','bridge',/bridge route/]];
 for(const [expeditionId,route,expected]of routes){const b=M.credit(null,{...a,id:expeditionId+route,expeditionId,route},987001);assert.match(R.conversation(b,R.view(b).people[0].id).line,expected);}
 const unknown=M.credit(null,{...a,id:'unknown-route',route:'legacy-unrecorded'},987001);assert(!R.conversation(unknown,R.view(unknown).people[0].id).line.includes('clinic'));
});
test('journal replays require a real event and resident, respect mode scope and leave release and care receipts untouched',()=>{
 let b=M.credit(null,run('journal'),987001);const first=R.view(b).tigers[0];b=R.release(b,first.id);const before=JSON.stringify(b),events=R.view(b).journal;
 for(const event of events){const replay=R.journalReplay(b,event.id,'Co-op');assert(replay);assert.equal(replay.resident.id,event.residentId);assert.equal(R.journalReplay(b,event.id,'Solo'),null);}
 assert.equal(R.journalReplay(b,'invented-event'),null);assert.equal(JSON.stringify(b),before);
 assert(events.some(e=>R.journalReplay(b,e.id)?.kind==='release'));assert(events.some(e=>R.journalReplay(b,e.id)?.kind==='care-tiger'));
 const data=C.model(b);let depth=0;const c=new Proxy({}, {get:(_o,k)=>k==='measureText'?s=>({width:String(s).length*5}):/create.*Gradient/.test(k)?()=>({addColorStop(){}}):(...args)=>{if(k==='save')depth++;if(k==='restore')depth--;assert(depth>=0);for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg));},set:()=>true});
 for(const scene of [...events.map(e=>R.journalReplay(b,e.id)),{kind:'talk-person',resident:data.residents.people[0]}])for(const elapsed of [0,4000,8000]){C.draw(c,data,{scene,elapsed,now:elapsed});assert.equal(depth,0);}
 assert.equal(JSON.stringify(b),before);
});
