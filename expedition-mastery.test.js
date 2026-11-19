const {test}=require('node:test'),assert=require('node:assert/strict');
const model=require('./expedition-mastery'),store=require('./api/_lib/expedition-mastery-store'),M=require('./api/_lib/metrics-store'),S=require('./api/_lib/squad-session'),scope=require('./api/_lib/rescue-profile-scope');
const {createHarness}=require('./qa/coop-harness');
function receipt(id,uid,{route='clinic',mode='Solo',stages=[1,2,3],legacy=false,expeditionId='river-gate'}={}){
  return {id,expeditionId,route,stage:4,results:stages.map(stage=>({stage,roomCode:'MS1234',mode,team:[{userId:uid,name:'Recorded rescuer'}],survivors:stage>1?['Mara','Eli','Nia']:[],captures:1,kills:0,...(!legacy?{recordVersion:1,rescueRequired:stage>1?3:0,durationMs:60000,wipes:0}:{})}))};
}
test('separate Solo, Co-op and Mixed credits, route mastery, legacy honesty and idempotent outfit ownership',()=>{
  let book=model.empty(),run=receipt('first',771);
  book=model.credit(book,run,771);book=model.credit(book,run,771);
  assert.equal(model.summary(book,'river-gate').modes[0].clears,1);
  assert.equal(model.summary(book,'river-gate').modes[1].clears,0);
  assert.equal(model.summary(book,'river-gate').modes[0].bestMs,180000);
  assert.deepEqual(model.summary(book,'river-gate').modes[0].medals,['Everyone evacuated','No lethal kills','No squad wipe']);
  assert(!model.mastered(book,'river-gate'));
  book=model.credit(book,receipt('second',771,{route:'bridge',mode:'Co-op'}),771);
  assert(model.mastered(book,'river-gate'));
  assert.equal(model.summary(book,'river-gate').modes[1].clears,1);
  const mixed=receipt('mixed',771);mixed.results[1].mode='Co-op';book=model.credit(book,mixed,771);
  assert.equal(model.summary(book,'river-gate').modes[2].clears,1);
  const legacy=model.credit(null,receipt('old',771,{legacy:true}),771);
  assert(model.earned(legacy,'river-gate'));assert.deepEqual(model.summary(legacy,'river-gate').modes[0].medals,[]);assert.equal(model.summary(legacy,'river-gate').modes[0].bestMs,null);
  const unknown=receipt('unknown',771);delete unknown.results[1].team;
  assert(!model.earned(model.credit(null,unknown,771),'river-gate'));
  const killed=receipt('lethal',772);killed.results[0].kills=1;killed.results[1].wipes=1;
  assert.deepEqual(model.summary(model.credit(null,killed,772),'river-gate').modes[0].medals,['Everyone evacuated']);
  assert.throws(()=>model.equip(null,'mountain-sos'),/all three/);
  const equipped=model.equip(book,'river-gate');assert(model.identity(equipped).patch);
  assert.equal(model.identity(model.equip(equipped,'')),null);
});
test('concurrent receipt retries and outfit selection retain both players’ independent permanent credits',async()=>{
  const a=972001,b=972002;
  const run=receipt('squad-earned',a,{mode:'Co-op'});for(const r of run.results)r.team.push({userId:b});
  await Promise.all(Array.from({length:6},()=>store.creditRun(run)));
  assert.equal(model.summary(await store.read(a),'river-gate').modes[1].clears,1);
  assert.equal(model.summary(await store.read(b),'river-gate').modes[1].clears,1);
  await Promise.all([store.equip(a,'river-gate'),store.creditRun(receipt('next-run',a,{route:'bridge'}))]);
  assert.equal((await store.read(a)).uniform,'river-gate');assert(model.mastered(await store.read(a),'river-gate'));
  assert.equal((await store.read(b)).uniform,'');
  const late=receipt('late',a,{mode:'Co-op'});late.results[2].team.push({userId:972003});await store.creditRun(late);
  assert(!model.earned(await store.read(972003),'river-gate'));
  assert.deepEqual(model.summary(await store.read(972003),'river-gate').recent[0].stages,[3]);
});
const key=(r,u)=>`live_squad_player_${r.code}_${u.id}`;
async function completeStage(room,party){
  let snap=await S.buildSnapshot(await S.readSession(room.code),party[0].id);
  for(const [i,u] of party.entries()){
    const p=await M.getState(key(room,u));
    await M.setState(key(room,u),{...p,...snap.extraction,lastSeenAt:Date.now(),downed:false,hp:p.maxHp,
      checkpointIds:snap.checkpoints.map(c=>c.id),rescuedIds:i?[]:snap.civilians.map(c=>c.id),securedCivilianIds:i?[]:snap.civilians.map(c=>c.id),capturedIds:i?[]:snap.tigers.map(t=>t.id)});
  }
  room=await S.readSession(room.code);
  if(room.expedition.stage===3)await M.setState(`live_squad_session_${room.code}`,{...room,expeditionBoardingAt:Date.now()-9000});
  snap=await S.buildSnapshot(await S.readSession(room.code),party[0].id);assert.equal(snap.status,'complete');return snap;
}
async function start(room,party){
  room=await S.readSession(room.code);
  if(party.length===2)for(const u of party)await S.applyAction(room,u,'ready',{ready:true,readyRevision:room.readyRevision});
  return S.applyAction(room,party[0],'start');
}
test('a real squad grants guest credit before captain replay, archives attire and never affects Story supplies',async()=>scope.run('expedition-squad',async()=>{
  const host={id:972011,first_name:'Captain'},guest={id:972012,first_name:'Guest'},party=[host,guest];
  const supplies=await S.readCoopProfile(host);
  let room=await S.createSession(host,{launchType:'expedition-squad',expeditionRoute:'clinic'});room=await S.joinSession(room.code,guest);
  for(let stage=1;stage<=3;stage++){
    room=await start(room,party);await completeStage(room,party);
    assert.equal(model.earned(await store.read(guest.id),'river-gate'),stage===3);
    if(stage<3)room=await S.applyAction(await S.readSession(room.code),host,'expedition-continue',{stage});
  }
  const residents=require('./rescue-residents').view(await store.read(guest.id));
  assert.equal(residents.people.length,3,'final-stage real evacuees become individual residents once');
  assert(residents.tigers.length>=3,'actual derived captures retain individual tiger records');
  assert(residents.tigers.some(t=>t.status==='release-ready'),'later real stage clears advance early capture recovery');
  await store.equip(guest.id,'river-gate');
  const snapshot=await S.buildSnapshot(await S.readSession(room.code),guest.id);
  assert.equal(snapshot.players.find(p=>p.userId===guest.id).eliteAppearance.expeditionUniform.name,'River Gate Rescuer');
  assert.equal(snapshot.expedition.reward.modes[1].clears,1);
  const h=createHarness({userId:guest.id,snapshot});h.qa.render();h.qa.drawArena();assert.equal(h.stats().depth,0);
  await S.claimReward(await S.readSession(room.code),guest);await S.claimReward(await S.readSession(room.code),guest);
  await S.closeSession(await S.readSession(room.code),host,{stage:3});
  const fresh=await S.createSession(host,{launchType:'expedition-solo',expeditionRoute:'bridge',expeditionReplay:true});
  assert.equal(model.summary(await store.read(guest.id),'river-gate').modes[1].clears,1,'captain replay cannot erase guest rewards');
  assert.equal((await S.readCoopProfile(host)).funds,supplies.funds);
  // The outfit stays in Rescue Mode and never changes normal Story appearance.
  await scope.run('shared-story',async()=>{const normal=await S.createSession(guest,{launchType:'shared-story',storyMissionLevel:1});assert(!(await S.buildSnapshot(normal,guest.id)).players[0].eliteAppearance.expeditionUniform);});
  assert.equal(fresh.expedition.stage,1);
}));
test('permanent expedition CAS uses no Redis expiry while normal state retains its TTL',async()=>{
  const priorUrl=process.env.KV_REST_API_URL,priorToken=process.env.KV_REST_API_TOKEN,fetch=global.fetch,requests=[];
  process.env.KV_REST_API_URL='https://isolated.invalid';process.env.KV_REST_API_TOKEN='TEST_ONLY';
  global.fetch=async(_url,opts)=>{requests.push(JSON.parse(opts.body));return {ok:true,json:async()=>[{result:1}]};};
  try{
    assert(await M.compareAndSetState('permanent-test',null,{ok:true},null));
    assert(await M.compareAndSetState('ttl-test',null,{ok:true},7200));
    assert.equal(requests[0][0].at(-1),'permanent');assert.equal(requests[1][0].at(-1),7200);
    assert(requests[0][0][1].includes("redis.call('SET',KEYS[1],ARGV[2]);"));
  }finally{global.fetch=fetch;if(priorUrl===undefined)delete process.env.KV_REST_API_URL;else process.env.KV_REST_API_URL=priorUrl;if(priorToken===undefined)delete process.env.KV_REST_API_TOKEN;else process.env.KV_REST_API_TOKEN=priorToken;}
});
test('authenticated outfit API only equips the signed account’s earned outfit',async()=>{
  const crypto=require('node:crypto'),handler=require('./api/squad/session'),old=process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN='LOCAL_MASTERY_AUTH_TEST';
  const uid=972041;await store.creditRun(receipt('signed-earned',uid));
  function signed(id){const p=new URLSearchParams({user:JSON.stringify({id,first_name:'Rescuer'}),auth_date:String(Math.floor(Date.now()/1000))});const check=[...p].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n'),secret=crypto.createHmac('sha256','WebAppData').update(process.env.TELEGRAM_BOT_TOKEN).digest();p.set('hash',crypto.createHmac('sha256',secret).update(check).digest('hex'));return p.toString();}
  async function request(body){let status,result;await handler({method:'POST',body},{status(n){status=n;return this;},setHeader(){},json(v){result=v;return this;}});return {status,result};}
  try{
    assert.equal((await request({action:'expedition-outfit',itemId:'river-gate'})).status,400);
    assert.equal((await request({initData:signed(uid+1),action:'expedition-outfit',itemId:'river-gate',userId:uid})).status,400);
    assert.equal((await store.read(uid)).uniform,'');
    const equipped=await request({initData:signed(uid),action:'expedition-outfit',itemId:'river-gate',userId:uid+1});assert.equal(equipped.status,200);assert.equal(equipped.result.mastery.uniform,'river-gate');
    assert.equal((await store.read(uid+1)).uniform,'');
    assert.equal((await request({initData:signed(uid),action:'expedition-outfit',itemId:'unknown'})).status,400);
    const status=await request({initData:signed(uid),action:'expedition-status',expeditionId:'river-gate'});assert.equal(status.result.mastery.uniform,'river-gate');
  }finally{if(old===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=old;}
});
test('lethal kills and squad wipes from a failed attempt prevent clean medals after a successful restart',async()=>scope.run('expedition-solo',async()=>{
  const host={id:972051,first_name:'Retry Rescuer'};
  let room=await S.createSession(host,{launchType:'expedition-solo',expeditionRoute:'clinic'});room=await start(room,[host]);
  const view=await S.buildSnapshot(room,host.id),tiger=view.tigers[0],p=await M.getState(key(room,host));
  await M.setState(key(room,host),{...p,tigerDamage:{[tiger.id]:tiger.hpMax},lethalWoundedIds:[tiger.id],downed:true,hp:0,livesRemaining:0,respawnAt:0,lastSeenAt:Date.now()});
  assert.equal((await S.buildSnapshot(await S.readSession(room.code),host.id)).status,'failed');
  room=await S.applyAction(await S.readSession(room.code),host,'restart');
  assert.equal(room.expeditionPriorKills,1);
  for(let stage=1;stage<=3;stage++){
    await completeStage(room,[host]);
    if(stage<3){room=await S.applyAction(await S.readSession(room.code),host,'expedition-continue',{stage});room=await start(room,[host]);}
  }
  const state=await store.read(host.id),summary=model.summary(state,'river-gate');
  assert(model.earned(state,'river-gate'));assert.deepEqual(summary.modes[0].medals,['Everyone evacuated']);
  assert.equal(Object.values(state.runs)[0].stages[1].kills,1);
}));
