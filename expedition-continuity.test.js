const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('./api/_lib/squad-session');
const M=require('./api/_lib/metrics-store');
const scope=require('./api/_lib/rescue-profile-scope');
const {createHarness}=require('./qa/coop-harness');

const captain={id:960971,first_name:'Expedition Captain'},guest={id:960972,first_name:'Expedition Partner'};
const roomKey=room=>`live_squad_session_${room.code}`;
const playerKey=(room,user)=>`live_squad_player_${room.code}_${user.id}`;
const snapshot=async room=>S.buildSnapshot(await S.readSession(room.code),captain.id);
const action=async(room,user,kind,payload)=>S.applyAction(await S.readSession(room.code),user,kind,payload);

async function readyAndStart(room){
  room=await S.readSession(room.code);
  if(room.memberIds.length===2){
    await assert.rejects(()=>action(room,captain,'start'),/confirm/);
    for(const user of [captain,guest])await action(room,user,'ready',{ready:true,readyRevision:room.readyRevision});
  }
  return action(room,captain,'start');
}

// Enemy and escort outcomes are fixtures. Stage completion, saving, continuation,
// ready checks, departures and mode changes all use the actual service.
async function finish(room){
  const snap=await snapshot(room);
  for(const [slot,userId] of room.memberIds.entries()){
    const key=playerKey(room,{id:userId}),player=await M.getState(key);
    await M.setState(key,{...player,...snap.extraction,lastSeenAt:Date.now(),hp:player.maxHp,
      downed:false,checkpointIds:snap.checkpoints.map(p=>p.id),
      rescuedIds:slot===0?snap.civilians.map(c=>c.id):[],securedCivilianIds:slot===0?snap.civilians.map(c=>c.id):[],
      capturedIds:slot===0?snap.tigers.map(t=>t.id):[]});
  }
  if(snap.expedition.stage===3)await M.setState(roomKey(room),{...await S.readSession(room.code),expeditionBoardingAt:Date.now()-9000});
  const result=await snapshot(room);
  assert.equal(result.status,'complete');
  return result;
}

test('one expedition squad continues through fresh ready checks, reconnects and switches modes safely',async()=>scope.run('expedition-squad',async()=>{
  let room=await S.createSession(captain,{launchType:'expedition-squad',expeditionRoute:'clinic'});
  room=await S.joinSession(room.code,guest);
  const code=room.code;
  room=await readyAndStart(room);
  const first=await finish(room);
  const revision=first.readyRevision;
  await assert.rejects(()=>action(room,guest,'expedition-continue',{stage:1}),/captain/);
  const requests=await Promise.allSettled([
    action(room,captain,'expedition-continue',{stage:1}),
    action(room,captain,'expedition-continue',{stage:1}),
  ]);
  assert(requests.some(result=>result.status==='fulfilled'));
  room=await S.readSession(code);
  assert.equal(room.expedition.stage,2);
  assert.equal(room.code,code);
  assert.equal(room.status,'waiting');
  assert.deepEqual(room.memberIds,[captain.id,guest.id]);
  assert.equal(room.readyRevision,revision+1);
  let snap=await snapshot(room);
  assert.deepEqual(snap.capturedIds,[],'last-stage captures never clear the next lobby');
  assert.deepEqual(snap.securedCivilianIds,[]);
  assert.equal(snap.readyCount,0);
  assert(snap.tigers.every(t=>!t.defeated));
  const repeat=await action(room,captain,'expedition-continue',{stage:1});
  assert.equal(repeat.readyRevision,room.readyRevision,'a retry cannot prepare another stage');
  await assert.rejects(()=>action(room,captain,'ready',{ready:true,readyRevision:revision}),/squad changed/);
  await assert.rejects(()=>action(room,captain,'expedition-mode',{stage:1,mode:'solo'}),/current checkpoint/);

  const teammate=await S.expeditionStatus(guest);
  assert.equal(teammate.roomCode,code);
  assert(teammate.shared);
  assert.equal(await S.expeditionStatus(guest,'river-gate',true),null);
  // The room remains available across a multi-hour break between stages.
  await M.setState(roomKey(room),{...room,updatedAt:Date.now()-3*60*60*1000});
  assert.equal((await S.expeditionStatus(guest)).roomCode,code);
  await S.joinSession(code,guest);
  await S.joinSession(code,captain);
  room=await readyAndStart(await S.readSession(code));
  await finish(room);

  await S.closeSession(await S.readSession(code),guest,{stage:2});
  assert.equal((await S.expeditionStatus(guest)).roomCode,'','a deliberate departure revokes direct resume');
  room=await action(room,captain,'expedition-continue',{stage:2});
  await assert.rejects(()=>S.closeSession(room,captain,{stage:2}),/advanced/);
  room=await action(room,captain,'expedition-mode',{stage:3,mode:'solo'});
  assert.equal(room.launchType,'expedition-solo');
  await assert.rejects(()=>S.joinSession(code,guest),/Solo expedition/);
  room=await action(room,captain,'expedition-mode',{stage:3,mode:'squad'});
  await assert.rejects(()=>action(room,captain,'start'),/Invite one teammate/);
  room=await S.joinSession(code,guest);
  await assert.rejects(()=>action(room,captain,'expedition-mode',{stage:3,mode:'solo'}),/teammate must/);
  await S.closeSession(room,guest,{stage:3});
  room=await action(room,captain,'expedition-mode',{stage:3,mode:'solo'});
  room=await readyAndStart(room);
  snap=await finish(room);
  assert.equal(snap.expedition.report.stages,3);
  assert.equal(snap.expedition.report.rescued.length,3,'the same villagers are counted once in the final evacuation');
  assert.equal(snap.expedition.report.captures,3);
  assert.deepEqual(snap.expedition.report.team.map(p=>p.name),[captain.first_name,guest.first_name]);
  const guestReport=await S.expeditionStatus(guest);
  assert.equal(guestReport.report.captures,3);
  await assert.rejects(()=>action(room,captain,'expedition-continue',{stage:3}),/completed stage/);
  const a=await S.claimReward(await S.readSession(code),captain);
  const b=await S.claimReward(await S.readSession(code),captain);
  assert.equal(a.expedition.results.length,3);
  assert.deepEqual(a.expedition,b.expedition);
  assert.equal((await S.readCoopProfile(captain)).funds,2500,'continuing grants no duplicate stage payout');

  const h=createHarness({userId:captain.id,snapshot:snap,transport:async()=>({ok:true,snapshot:snap,reward:a})});
  let opened;
  h.ctx.openRescueExpedition=id=>{opened=id;};
  await h.qa.dispatchCommand('expedition-save-exit');
  assert.equal(opened,'river-gate');
  assert.equal(h.qa.state.snapshot.code,code);
  assert(!h.requests.some(request=>request.action==='leave'),'save and return does not remove a squad member');
}));

test('new squad continuation leaves ordinary Co-op room expiration unchanged',async()=>{
  const room=await S.createSession({id:960979,first_name:'Regular'});
  assert.throws(()=>S.ensureLiveSession({...room,updatedAt:Date.now()-3*60*60*1000}),/expired/);
});

test('a remaining client returns to Rescue Mode when the captain ends the room',async()=>scope.run('expedition-squad',async()=>{
  const a={id:960975,first_name:'Ending Captain'},b={id:960976,first_name:'Remaining Partner'};
  let room=await S.createSession(a,{launchType:'expedition-squad',expeditionRoute:'clinic'});
  room=await S.joinSession(room.code,b);
  const snapshot=await S.buildSnapshot(room,b.id);
  const h=createHarness({userId:b.id,snapshot,transport:async()=>({ok:false,error:'This squad room is closed.'})});
  let opened;
  h.ctx.openRescueExpedition=id=>{opened=id;};
  await S.closeSession(room,a,{stage:1});
  await h.qa.sync();
  assert.equal(h.qa.state.snapshot,null);
  assert.equal(h.qa.state.code,'');
  assert.equal(opened,'river-gate');
}));
