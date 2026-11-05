const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const D=require('./mission-debrief'),C=require('./result-cards'),store=require('./api/_lib/rescue-card-store'),handler=require('./api/player/rescue-card');
const run=(id='first',scope='solo',extra={})=>({id,scope,missionKey:'Story:10',mode:'Story',title:'Boss rescue',completed:true,rewardState:'awarded',bossCaptures:1,captures:1,civilianTotal:2,rescued:2,kills:0,durationMs:90000,...extra});
const record=r=>D.record({},r).state;
function jpeg(){const bytes=Buffer.from([255,216,255,192,0,17,8,3,232,4,176,3,1,17,0,2,17,1,3,17,1,255,217]);return 'data:image/jpeg;base64,'+bytes.toString('base64');}
function auth(id=9981605){const params=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Local Card QA'})}),check=[...params].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>k+'='+v).join('\n'),secret=crypto.createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();params.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));return params.toString();}
async function call(method,body={},query={}){let status=200,result,headers={};const res={setHeader:(k,v)=>headers[k]=v,status(n){status=n;return this;},json(v){result=v;},end(v){result=v;}};await handler({method,body,query},res);return {status,result,headers};}
const originalFetch=global.fetch;const vars=['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'];for(const k of vars)process.env[k]='';process.env.TS_CARD_TEST_MEMORY='1';process.env.TELEGRAM_BOT_TOKEN='LOCAL_CARD_TEST_ONLY';process.env.TS_ELITE_TEST_MEMORY='1';
test('first boss capture retains its exact receipt, survives reloads and replays, and is separate for each mode',()=>{
 let state=record(run());assert.equal(state.milestones.solo.firstBossCaptureRunId,'first');assert(C.model(state.last,state).highlights.includes('First recorded boss capture'));
 const duplicate=D.record(state,run());assert(!duplicate.applied);assert.equal(duplicate.state.milestones.solo.firstBossCaptureRunId,'first');
 state=D.normalize(JSON.parse(JSON.stringify(state)));state=D.record(state,run('second')).state;assert(!C.model(state.last,state).highlights.includes('First recorded boss capture'));assert.equal(state.milestones.solo.firstBossCaptureRunId,'first');
 state=D.record(state,run('team','coop')).state;assert.equal(state.milestones.coop.firstBossCaptureRunId,'team');assert(C.model(state.last,state).highlights.includes('First recorded boss capture'));
 const older=D.record({milestones:{solo:{bossCaptureRecorded:true}}},run('new')).state;assert(!C.model(older.last,older).highlights.includes('First recorded boss capture'),'unknown old boss identity is not invented');
 const historic=record(run());delete historic.milestones.solo.firstBossCaptureRunId;assert(C.model(historic.last,historic).highlights.includes('First recorded boss capture'),'existing lastChanges evidence is preserved');
 const failed=D.record({},run('failed','solo',{completed:false}));assert(!failed.applied);assert(!failed.state.milestones.solo.bossCaptureRecorded);
});
test('photo storage validates format, limits size and dimensions, deduplicates retries and enforces rate limits',async()=>{
 assert.equal(store.jpegBytes(jpeg()).length,23);for(const bad of ['data:image/png;base64,AAAA','data:image/jpeg;base64,AAAA',jpeg().replace('base64,','base64,!!!!')])assert.throws(()=>store.jpegBytes(bad));
 const bad=store.jpegBytes(jpeg());bad[10]=175;assert.throws(()=>store.jpegBytes('data:image/jpeg;base64,'+bad.toString('base64')),/1200/);
 const bytes=store.jpegBytes(jpeg()),a=await store.put(9981601,'run',bytes),b=await store.put(9981601,'run',bytes);assert.deepEqual(a,b);assert(/^[a-f0-9]{48}$/.test(a.id));assert.deepEqual(await store.get(a.id),bytes);
 assert.equal(await store.get('unknown'),null);
 for(let i=1;i<10;i++)await store.put(9981601,'run'+i,bytes);
 await assert.rejects(()=>store.put(9981601,'over-limit',bytes),/Daily photo limit/);
 const mem=global.__TS_CARD_MEMORY__,old=mem.images.get(a.id);old.expiresAt=Date.now()-1;assert.equal(await store.get(a.id),null);
});
test('native sharing prepares a real photo for the signed user, never sends messages, and serves only its expiring image',async()=>{
 let seen=[];global.fetch=async(url,options)=>{assert(url.endsWith('/savePreparedInlineMessage'));const payload=JSON.parse(options.body);seen.push(payload);return {ok:true,json:async()=>({ok:true,result:{id:'prepared-local',expiration_date:Math.floor(Date.now()/1000)+300}})};};
 try{
  const r=run(),state=record(r),response=await call('POST',{initData:auth(),scope:'solo',runId:r.id,records:state,jpeg:jpeg()});assert.equal(response.status,200);assert.equal(response.result.preparedMessageId,'prepared-local');assert(response.result.expiresAt>Date.now());
  const payload=seen[0];assert.equal(payload.user_id,9981605);assert.equal(payload.result.type,'photo');assert(payload.result.caption.includes('First recorded boss capture'));assert.equal(payload.result.input_message_content,undefined);assert.equal(payload.allow_bot_chats,false);assert(!JSON.stringify(payload.result).includes('initData'));assert(!JSON.stringify(payload.result).includes('9981605'));
  const id=new URL(payload.result.photo_url).searchParams.get('id'),image=await call('GET',{}, {id});assert.equal(image.status,200);assert.equal(image.headers['Content-Type'],'image/jpeg');assert(Buffer.isBuffer(image.result));
  assert.equal((await call('GET',{}, {id:'deadbeef'})).status,404);
  assert.equal((await call('POST',{scope:'solo',runId:r.id,records:state,jpeg:jpeg()})).status,400);assert.equal(seen.length,1);
  assert.equal((await call('POST',{initData:auth(),scope:'solo',runId:'another',records:state,jpeg:jpeg()})).status,400);
  global.fetch=async()=>({ok:false,json:async()=>({ok:false})});const unavailable=await call('POST',{initData:auth(),scope:'solo',runId:r.id,records:state,jpeg:jpeg()});assert.equal(unavailable.status,400);assert(unavailable.result.error.includes('Telegram could not prepare'));
 }finally{global.fetch=originalFetch;}
});
test('Co-op photos use the signed player’s server record rather than client-supplied achievements',async()=>{
 const S=require('./api/_lib/squad-session'),user={id:9981607,first_name:'Coop Card QA'},p=await S.readCoopProfile(user);p.missionDebriefs=record(run('server-run','coop'));await S.writeCoopProfile(p,user);
 let seen;global.fetch=async(url,options)=>{seen=JSON.parse(options.body);return {ok:true,json:async()=>({ok:true,result:{id:'coop-prepared',expiration_date:Math.floor(Date.now()/1000)+300}})};};
 try{
  const fake=record(run('client-invented','coop',{rescued:999}));assert.equal((await call('POST',{initData:auth(user.id),scope:'coop',runId:'client-invented',records:fake,jpeg:jpeg()})).status,400);
  assert.equal((await call('POST',{initData:auth(user.id),scope:'coop',runId:'server-run',records:fake,jpeg:jpeg()})).status,200);assert(seen.result.caption.includes('2/2'));assert(!seen.result.caption.includes('999'));
  assert.equal((await call('POST',{initData:auth(9981699),scope:'coop',runId:'server-run',jpeg:jpeg()})).status,400);
 }finally{global.fetch=originalFetch;}
});
test('photo sharing fails closed when durable storage is absent',async()=>{const flag=process.env.TS_CARD_TEST_MEMORY;delete process.env.TS_CARD_TEST_MEMORY;try{await assert.rejects(()=>store.put(9981609,'run',store.jpegBytes(jpeg())),/storage is unavailable/);}finally{process.env.TS_CARD_TEST_MEMORY=flag;}});
