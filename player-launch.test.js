const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
process.env.TS_LAUNCH_TEST_MEMORY='1';process.env.TS_ELITE_TEST_MEMORY='1';
const store=require('./api/_lib/player-launch-store'),handler=require('./api/player/launch');
function sign(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Launch QA'})}),s=crypto.createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();p.set('hash',crypto.createHmac('sha256',s).update([...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return p.toString();}
async function call(id,body){let out;await handler({method:'POST',body:{initData:sign(id),...body}},{setHeader(){},status(){return this},json(v){out=v}});return out;}
const reset=()=>{delete globalThis.__TS_LAUNCH_MEMORY__;};
test('Launch accounts, UTC returns and activity are actual deduplicated observations',async()=>{
 reset();const RealDate=Date;let now=Date.parse('2026-11-03T23:59:00Z');global.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 try{await Promise.all(Array.from({length:20},()=>store.track(991901,'open')));await store.track(991901,'tutorial-start');await store.track(991901,'tutorial-start');assert.equal((await store.dashboard()).totals.players,1);assert.equal((await store.dashboard()).totals['tutorial-start'],1);assert.equal((await store.dashboard()).totals.returned,undefined);now+=120000;await store.track(991901);await store.track(991901);const d=await store.dashboard();assert.equal(d.totals.returned,1);assert.equal(d.todayPlayers,1);}finally{global.Date=RealDate;}
});
test('Feedback saves once, repeated requests do not inflate counts, bug reports are bounded and rate limited',async()=>{
 reset();const body={id:'feedback-receipt-001',fun:'mixed',text:'The capture button was confusing.',context:{build:'5285',mode:'Solo',mission:1,scene:'results',token:'must not persist'}};
 const replies=await Promise.all(Array.from({length:12},()=>store.submit(991902,'feedback',body)));assert.equal(replies.filter(r=>r.result==='saved').length,1);assert.equal((await store.dashboard()).totals.feedback,1);assert.equal((await store.submit(991902,'feedback',{...body,id:'feedback-receipt-002'})).result,'already');assert((await store.status(991902)).feedbackSubmitted);
 for(let i=0;i<10;i++)await store.submit(991902,'bug',{id:'bug-report-receipt-'+i,text:'The mission did not load.',context:body.context});await assert.rejects(()=>store.submit(991902,'bug',{id:'bug-report-over-limit',text:'Repeated report should fail.'}),/limit/);
 const d=await store.dashboard();assert.equal(d.totals.bug,10);assert(d.reports.every(r=>!('token' in r.context)));assert(d.reports.every(r=>!('initData' in r)));
});
test('Storage failure never pretends a report or dashboard is saved',async()=>{
 delete process.env.TS_LAUNCH_TEST_MEMORY;try{await assert.rejects(()=>store.dashboard(),/unavailable/);await assert.rejects(()=>store.submit(991903,'bug',{id:'unavailable-receipt',text:'Cannot access inventory.'}),/unavailable/);}finally{process.env.TS_LAUNCH_TEST_MEMORY='1';}
});
test('Signed identity and configured admin gate protect reports; clients cannot invent clear counters',async()=>{
 reset();process.env.TELEGRAM_BOT_TOKEN='LAUNCH_TEST_ONLY';process.env.TELEGRAM_ADMIN_IDS='991910';
 try{assert.equal((await call(991911,{action:'dashboard',canManage:true})).ok,false);assert.equal((await call(991911,{action:'coop-clear',count:999})).ok,false);assert.equal((await call(991911,{action:'solo-clear',count:999})).ok,false);assert.equal((await call(991911,{action:'open',initData:'forged'})).ok,false);await call(991911,{action:'open'});await call(991911,{action:'bug',id:'authenticated-bug-01',text:'Cannot click the shop Exit button.',context:{mode:'Co-op',mission:1,build:'5285',scene:'shop'}});const admin=await call(991910,{action:'dashboard'});assert(admin.ok);assert.equal(admin.totals.players,1);assert.equal(admin.reports.length,1);assert.equal(admin.reports[0].account,'991911');}finally{delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_ADMIN_IDS;}
});
test('Public invitation previews use the requested real mission and expose no player identity',async()=>{
 const S=require('./api/_lib/squad-session'),room=await S.createSession({id:991920,first_name:'Private Host'},{launchType:'shared-story',storyMissionLevel:12});process.env.TELEGRAM_BOT_USERNAME='TigerStrike_Test_Bot';let out;
 await handler({method:'GET',query:{squad:room.code}},{setHeader(){},status(){return this},json(v){out=v}});assert(out.ok);assert.equal(out.invitation.level,12);assert.equal(out.invitation.code,room.code);assert(!JSON.stringify(out).includes('Private Host'));assert(!JSON.stringify(out).includes('991920'));assert.equal(out.botUrl,'https://t.me/TigerStrike_Test_Bot');delete process.env.TELEGRAM_BOT_USERNAME;
});
test('Invalid report contents are rejected before writing and context is bounded',async()=>{
 await assert.rejects(()=>store.submit(991930,'bug',{id:'valid-receipt-01',text:'short'}),/10 characters/);await assert.rejects(()=>store.submit(991930,'feedback',{id:'valid-receipt-02',fun:'five stars'}),/Choose/);assert.deepEqual(store.cleanContext({build:'<script>',mode:'admin',mission:999,scene:'secret'}),{build:'unknown',mode:'Menu',mission:100,scene:'other'});
});
