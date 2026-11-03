const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.TS_ELITE_TEST_MEMORY='1';process.env.TS_RESCUE_EVENT_TEST_MEMORY='1';
const schedule=require('./api/_lib/rescue-event-schedule'),C=require('./live-rescue-event'),S=require('./api/_lib/squad-session'),scope=require('./api/_lib/rescue-profile-scope'),store=require('./api/_lib/rescue-event-store'),handler=require('./api/events/rescue'),sessionHandler=require('./api/squad/session');
function signed(id){const p=new URLSearchParams({auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id,first_name:'Event QA'})}),s=crypto.createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();p.set('hash',crypto.createHmac('sha256',s).update([...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n')).digest('hex'));return p.toString();}
async function invoke(fn,id,body){let result;await fn({method:'POST',body:{initData:signed(id),...body}},{status(){return this},json(v){result=v}});return result;}

test('Paused by default, owner-only resume, frozen remaining time and idempotent schedule edits',async()=>{
 const now=Date.now;let time=C.EVENT.end+86400000;Date.now=()=>time;process.env.TELEGRAM_BOT_TOKEN='HUB_TEST_ONLY';process.env.TELEGRAM_ADMIN_IDS='991801';delete globalThis.__TS_RESCUE_EVENT_SCHEDULE__;
 try{
  let s=await schedule.read();assert.equal(s.phase,'paused');assert.equal(s.remainingMs,14*86400000);
  assert.equal((await invoke(handler,991802,{action:'resume',canManage:true})).ok,false);
  const owner=await invoke(handler,991801,{action:'stats'});assert.equal(owner.canManage,true);assert.equal(owner.phase,'paused');
  s=(await invoke(handler,991801,{action:'resume'})).schedule;assert.equal(s.phase,'active');assert.equal(s.endsAt,time+14*86400000);
  const deadline=s.endsAt;time+=3600000;assert.equal((await schedule.set('resume')).endsAt,deadline);
  s=await schedule.set('pause');assert.equal(s.remainingMs,14*86400000-3600000);const remaining=s.remainingMs;time+=40*86400000;
  assert.equal((await schedule.read()).remainingMs,remaining);assert.equal((await schedule.set('pause')).remainingMs,remaining);
  s=await schedule.set('resume');assert.equal(s.endsAt,time+remaining);assert.equal(s.phase,'active');
  time=s.endsAt;assert.equal((await schedule.read()).phase,'ended');await schedule.set('pause');assert.equal((await schedule.set('resume')).phase,'ended');
 }finally{Date.now=now;delete globalThis.__TS_RESCUE_EVENT_SCHEDULE__;delete process.env.TELEGRAM_ADMIN_IDS;delete process.env.TELEGRAM_BOT_TOKEN;}
});

test('Pausing blocks new Solo, private and public entries; active runs retain a fixed claim deadline',async()=>{
 delete globalThis.__TS_RESCUE_EVENT_SCHEDULE__;
 await assert.rejects(()=>S.createSession({id:991810},{launchType:'monsoon-solo'}),/not open/);
 await assert.rejects(()=>S.quickMatch({id:991810},{launchType:'monsoon-rescue'}),/paused/);
 await schedule.set('resume');
 await scope.run('monsoon-solo',async()=>{
  let r=await S.createSession({id:991810},{launchType:'monsoon-solo'});r=await S.applyAction(r,{id:991810},'start');const deadline=r.eventDeadline;assert(deadline>Date.now());
  await schedule.set('pause');const snap=await S.buildSnapshot(r,991810);assert.equal(snap.status,'active');assert.equal(snap.eventSchedule.phase,'paused');
  assert(C.eligible({...r,status:'complete',completedAt:Date.now()+1000}));
  await assert.rejects(()=>S.applyAction({...r,status:'failed'},{id:991810},'restart'),/paused/);
  assert.equal((await S.readSession(r.code)).eventDeadline,deadline);
 });
});

test('Authenticated event matchmaking joins two real accounts in the same event scope and replay retains the squad',async()=>{
 delete globalThis.__TS_RESCUE_EVENT_SCHEDULE__;await schedule.set('resume');process.env.TELEGRAM_BOT_TOKEN='EVENT_MATCH_TEST_ONLY';
 try{
  const a=await invoke(sessionHandler,991820,{action:'quick-match',launchType:'monsoon-rescue'});assert(a.ok,a.error);assert.equal(a.snapshot.launchType,'monsoon-rescue');assert.equal(a.profileScope,'_rescue_squad');assert.equal(a.snapshot.memberCount,1);
  const b=await invoke(sessionHandler,991821,{action:'quick-match',launchType:'monsoon-rescue'});assert(b.ok,b.error);assert.equal(b.snapshot.code,a.snapshot.code);assert.equal(b.snapshot.memberCount,2);assert.equal(b.profileScope,'_rescue_squad');
  await scope.run('monsoon-rescue',async()=>{
   let room=await S.readSession(a.snapshot.code);room=await S.applyAction(room,{id:991820},'start');
   const M=require('./api/_lib/metrics-store'),mission=S.missionDefinition(room);
   for(const id of room.memberIds){const key=`live_squad_player_${room.code}_${id}`,p=await M.getState(key);await M.setState(key,{...p,x:mission.extraction.x,y:mission.extraction.y,lastSeenAt:Date.now(),checkpointIds:mission.checkpoints.map(c=>c.id),...(id===991820?{rescuedIds:mission.civilians.map(c=>c.id),securedCivilianIds:mission.civilians.map(c=>c.id),capturedIds:mission.captureTargetIds,tigerDamage:Object.fromEntries(mission.tigers.filter(t=>!mission.captureTargetIds.includes(t.id)).map(t=>[t.id,t.hpMax]))}:{})});}
   await S.buildSnapshot(room,991820);room=await S.readSession(room.code);assert.equal(room.status,'complete');
   await S.claimReward(room,{id:991820});await assert.rejects(()=>S.applyAction(room,{id:991820},'replay'),/Every player/);await S.claimReward(room,{id:991821});
   const again=await S.applyAction(room,{id:991820},'replay');assert.equal(again.status,'active');assert.equal(again.code,room.code);assert.deepEqual(again.memberIds,[991820,991821]);
  });
  await schedule.set('pause');assert.equal((await invoke(sessionHandler,991822,{action:'quick-match',launchType:'monsoon-rescue'})).ok,false);
 }finally{delete process.env.TELEGRAM_BOT_TOKEN;}
});

test('Achievement cards derive rescues and owned milestones from recorded results, never request counts',async()=>{
 process.env.TELEGRAM_BOT_TOKEN='EVENT_SHARE_TEST_ONLY';
 try{
  await store.record(991830,'HUBAAA:'+Date.now(),3);await store.record(991830,'HUBAAB:'+Date.now(),3);
  const result=await invoke(handler,991830,{action:'share',rescues:9999,earned:['monsoon_trophy']});assert(result.ok,result.error);assert.match(result.share.text,/rescued 6 villagers/);assert.match(result.share.text,/Monsoon Ranger uniform/);assert(!result.share.text.includes('9999'));assert(!result.share.text.includes('Monsoon Rescue HQ trophy'));
 }finally{delete process.env.TELEGRAM_BOT_TOKEN;}
});
