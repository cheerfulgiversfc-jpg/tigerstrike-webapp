const {test}=require('node:test'),assert=require('node:assert/strict');
const C=require('./wildlife-corridor'),E=require('./rescue-expedition'),S=require('./api/_lib/squad-session'),DB=require('./api/_lib/metrics-store'),scope=require('./api/_lib/rescue-profile-scope'),mastery=require('./api/_lib/expedition-mastery-store'),MM=require('./expedition-mastery'),R=require('./rescue-residents'),water=require('./water-terrain'),{createHarness}=require('./qa/coop-harness');
const roomKey=r=>'live_squad_session_'+r.code,pKey=(r,u)=>`live_squad_player_${r.code}_${u.id}`;
test('convoy moves only on an open route with a present escort, stops for danger, pause and disconnect, and never catches up while absent',()=>{
 const path=[{x:100,y:100},{x:500,y:100},{x:500,y:500}],players=[{x:100,y:100,lastSeenAt:1000,downed:false}],a={attempt:'a',path,players,tigers:[],active:true,routeReady:true,now:1000};
 let state=C.step(null,a);state=C.step(state,{...a,now:1500});assert.equal(state.distance,65);
 for(const extra of [{routeReady:false},{paused:true},{players:[]},{players:[{...players[0],x:1200}]},{players:[{...players[0],downed:true}]},{tigers:[{x:state.x,y:state.y,hp:100,defeated:false}]}]){const next=C.step(state,{...a,now:2000,...extra});assert.equal(next.distance,state.distance);}
 const away=C.step(state,{...a,now:30000});assert.equal(away.distance,state.distance);const returnTo=C.step(away,{...a,now:30100,players:[{...players[0],lastSeenAt:30100}]});assert.equal(returnTo.distance,state.distance+13);
 assert.equal(C.step(returnTo,{...a,attempt:'restart',now:30200}).distance,0);
 assert.deepEqual(C.position(path,400),{x:500,y:100,angle:0});assert(C.length(path)===800);
});
async function party(route,solo,id){
 const host={id,first_name:'Corridor Captain'},guest={id:id+1,first_name:'Corridor Partner'};
 let room=await S.createSession(host,{launchType:solo?'expedition-solo':'expedition-squad',expeditionId:'wildlife-corridor',expeditionRoute:route});
 if(!solo){room=await S.joinSession(room.code,guest);for(const u of [host,guest])await S.applyAction(room,u,'ready',{ready:true,readyRevision:room.readyRevision});}
 room=await S.applyAction(room,host,'start');return {host,guest,room,users:solo?[host]:[host,guest]};
}
async function setPlayers(room,users,point,fields={}){for(const u of users){const key=pKey(room,u),p=await DB.getState(key);await DB.setState(key,{...p,...point,...fields,lastSeenAt:Date.now()});}}
test('both authored routes have truthful bridges, real interactions, safer Solo pressure, and detailed shared rendering',async()=>scope.run('expedition-squad',async()=>{
 let forestLength=0;
 for(const [route,solo,id]of [['forest',true,988001],['bridge',false,988011]]){
  const {host,room,users}=await party(route,solo,id);let snap=await S.buildSnapshot(room,host.id);assert.equal(snap.expedition.stageCount,3);assert.equal(snap.expedition.convoy.distance,0);assert.equal(snap.expedition.convoy.reason,'Open the chosen route');
  const site=snap.checkpoints[0];await setPlayers(room,users,site);await S.applyAction(await S.readSession(room.code),host,'expedition-interact');snap=await S.buildSnapshot(await S.readSession(room.code),host.id);
  assert(snap.checkpointCompletedIds.includes(site.id));if(route==='forest')forestLength=C.length(snap.expedition.scene.path);else assert(C.length(snap.expedition.scene.path)<forestLength);
  const path=snap.expedition.scene.path;for(let d=0;d<C.length(path);d+=20){const p=C.position(path,d);assert(!water.swimming(snap.waterZones,p.x,p.y),'convoy stays on land or its rendered bridge');}
  const harness=createHarness({userId:host.id,snapshot:snap});harness.qa.render();harness.qa.drawArena();assert.equal(harness.stats().depth,0);
  assert.equal(snap.tigers.length,solo?1:3);assert.equal(snap.civilians.length,2);
 }
}));
test('the real Solo convoy cannot finish early; checkpoint, workers, reconnect, delivery, durable credit and replay remain independent of Story supplies',async()=>scope.run('expedition-solo',async()=>{
 const original=Date.now;let tick=original();Date.now=()=>tick;
 try{
  const {host,room,users}=await party('bridge',true,988101),profile=await S.readCoopProfile(host);let snap=await S.buildSnapshot(room,host.id);
  const site=snap.checkpoints[0];await setPlayers(room,users,site);await S.applyAction(await S.readSession(room.code),host,'expedition-interact');
  const ids=snap.civilians.map(c=>c.id),captured=snap.tigers.map(t=>t.id);
  await setPlayers(room,users,snap.extraction,{rescuedIds:ids,securedCivilianIds:ids,capturedIds:captured});
  snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.status,'active');assert.equal(snap.objectivesReady,false);assert.equal(snap.expedition.convoy.distance,0);
  // A disconnected/reopened client retains the same truck position and does not auto-drive it.
  const initial=snap.expedition.convoy.distance;tick+=21000;snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.expedition.convoy.distance,initial);
  for(let i=0;i<140&&!snap.expedition.convoy.arrived;i++){
   tick+=700;await setPlayers(room,users,snap.expedition.convoy);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);
  }
  assert(snap.expedition.convoy.arrived);await setPlayers(room,users,snap.extraction);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.status,'complete');
  const book=await mastery.read(host.id);assert.equal(MM.summary(book,'wildlife-corridor').modes[0].clears,0);assert.equal(R.view(book).people.length,2);assert.equal(R.view(book).tigers.length,captured.length,'cargo animals are not credited as player captures');
  await S.claimReward(await S.readSession(room.code),host);assert.equal(MM.summary(await mastery.read(host.id),'wildlife-corridor').modes[0].clears,0);
  snap=await finishReserve(room,host,users,ms=>tick+=ms);
  assert.equal(snap.expedition.report.cargoReleased.length,2);assert.equal(MM.summary(await mastery.read(host.id),'wildlife-corridor').modes[0].clears,1);
  assert.equal((await S.readCoopProfile(host)).funds,profile.funds);
  assert.equal((await S.expeditionStatus(host,'wildlife-corridor')).report.stages,3);
 }finally{Date.now=original;}
}));
test('a real squad reconnects, restarts after a wipe, finishes together and credits both participants once',async()=>scope.run('expedition-squad',async()=>{
 const original=Date.now;let tick=original();Date.now=()=>tick;
 try{
  const {host,guest,room,users}=await party('forest',false,988201);let snap=await S.buildSnapshot(room,host.id),site=snap.checkpoints[0];
  await setPlayers(room,users,site);await S.applyAction(await S.readSession(room.code),host,'expedition-interact');
  const completeFields={rescuedIds:snap.civilians.map(c=>c.id),securedCivilianIds:snap.civilians.map(c=>c.id),capturedIds:snap.tigers.map(t=>t.id)};
  for(let i=0;i<4;i++){tick+=700;await setPlayers(room,users,snap.expedition.convoy,completeFields);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);}
  const savedDistance=snap.expedition.convoy.distance;assert(savedDistance>0);tick+=21000;snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.expedition.convoy.distance,savedDistance);
  await S.joinSession(room.code,guest);assert.equal((await S.expeditionStatus(guest,'wildlife-corridor')).roomCode,room.code);
  await setPlayers(room,users,snap.expedition.convoy,{...completeFields,hp:0,downed:true,livesRemaining:0,respawnAt:0});snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.status,'failed');
  const oldAttempt=snap.expedition.convoy.attempt;tick+=100;await S.applyAction(await S.readSession(room.code),host,'restart');const waiting=await S.readSession(room.code);assert.equal(waiting.status,'waiting');for(const u of users)await S.applyAction(waiting,u,'ready',{ready:true,readyRevision:waiting.readyRevision});await S.applyAction(await S.readSession(room.code),host,'start');snap=await S.buildSnapshot(await S.readSession(room.code),host.id);
  assert.equal(snap.status,'active');assert.notEqual(snap.expedition.convoy.attempt,oldAttempt);assert.equal(snap.expedition.convoy.distance,0);assert.equal(snap.checkpointCompletedIds.length,0);assert(snap.players.every(p=>!p.downed&&p.livesRemaining>=1));
  await setPlayers(room,users,snap.checkpoints[0]);await S.applyAction(await S.readSession(room.code),host,'expedition-interact');
  for(let i=0;i<140&&!snap.expedition.convoy.arrived;i++){tick+=700;await setPlayers(room,users,snap.expedition.convoy,completeFields);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);}
  assert(snap.expedition.convoy.arrived);await setPlayers(room,users,snap.extraction);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.status,'complete');
  for(const u of users){await S.claimReward(await S.readSession(room.code),u);await S.claimReward(await S.readSession(room.code),u);const book=await mastery.read(u.id);assert.equal(MM.summary(book,'wildlife-corridor').modes[1].clears,0);assert.equal(R.view(book).people.length,2);}
  const h=createHarness({userId:host.id,snapshot:snap});h.qa.render();h.qa.drawArena();assert(h.element('squadBody').innerHTML.includes('data-squad-command="expedition-continue"'));
  snap=await finishReserve(room,host,users,ms=>tick+=ms);
  for(const u of users){await S.claimReward(await S.readSession(room.code),u);await S.claimReward(await S.readSession(room.code),u);assert.equal(MM.summary(await mastery.read(u.id),'wildlife-corridor').modes[1].clears,1);}
  const final=createHarness({userId:host.id,snapshot:snap});final.qa.render();final.qa.drawArena();assert(!final.element('squadBody').innerHTML.includes('data-squad-command="expedition-continue"'));assert(final.element('squadBody').innerHTML.includes('Skip scene'));
  await S.closeSession(await S.readSession(room.code),host,{stage:3});const replay=await S.createSession(host,{launchType:'expedition-solo',expeditionId:'wildlife-corridor',expeditionRoute:'bridge',expeditionReplay:true});assert.equal(replay.expedition.stage,1);assert.notEqual(replay.expedition.runId,room.expedition.runId);
 }finally{Date.now=original;}
}));

async function finishReserve(room,host,users,advance){
 let snap;const manifest=(await S.readSession(room.code)).expedition.cargo.map(t=>t.id);
 for(const stage of [2,3]){
  await S.applyAction(await S.readSession(room.code),host,'expedition-continue',{stage:stage-1});
  const waiting=await S.readSession(room.code);assert.equal(waiting.status,'waiting');
  if(users.length===2)for(const u of users)await S.applyAction(waiting,u,'ready',{ready:true,readyRevision:waiting.readyRevision});
  await S.applyAction(await S.readSession(room.code),host,'start');snap=await S.buildSnapshot(await S.readSession(room.code),host.id);
  assert.equal(snap.expedition.stage,stage);assert.equal(snap.expedition.convoy,null);assert.equal(snap.civilians.length,0,'rescued workers are not spawned for duplicate credit');
  assert.deepEqual(snap.expedition.cargo.map(t=>t.id),manifest);
  for(const p of [...snap.checkpoints,snap.extraction,snap.expedition.scene.parkedTruck])assert(!water.swimming(snap.waterZones,p.x,p.y),'reserve objectives and truck are on dry land');
  const last=snap.checkpoints.at(-1);await setPlayers(room,users,last);
  if(stage===2)await assert.rejects(async()=>S.applyAction(await S.readSession(room.code),host,'expedition-interact'),/prerequisite/);
  for(const site of snap.checkpoints){
   await setPlayers(room,users,site);
   if(site.requiresClearThreats){
    await assert.rejects(async()=>S.applyAction(await S.readSession(room.code),host,'expedition-interact'),/Clear the reserve/);
    await setPlayers(room,users,site,{capturedIds:snap.tigers.map(t=>t.id)});
   }
   await S.applyAction(await S.readSession(room.code),host,'expedition-interact');
  }
  await setPlayers(room,users,snap.extraction,{capturedIds:snap.tigers.map(t=>t.id)});
  snap=await S.buildSnapshot(await S.readSession(room.code),host.id);
  if(stage===3){
   assert.equal(snap.status,'active');assert(snap.expedition.release.startedAt>0);
   // Reconnection is safe: an absent teammate resets unloading instead of completing offline.
   advance(16000);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.status,'active');assert.equal(snap.expedition.release.startedAt,0);
   await setPlayers(room,users,snap.extraction);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);advance(8100);await setPlayers(room,users,snap.extraction);snap=await S.buildSnapshot(await S.readSession(room.code),host.id);
  }
  assert.equal(snap.status,'complete');
  const harness=createHarness({userId:host.id,snapshot:snap});harness.qa.render();harness.qa.drawArena();if(stage===3){for(const progress of [0,.4,1])harness.qa.drawExpeditionDeparture(progress);for(const id of manifest)assert(harness.drawn.tigers.includes(id),'release movie uses the recorded cargo animal');}assert.equal(harness.stats().depth,0);
 }
 assert.deepEqual(snap.expedition.report.cargoReleased.map(t=>t.id),manifest);
 assert.equal(snap.expedition.report.rescued.length,2,'workers remain credited from the escort');
 await assert.rejects(async()=>S.applyAction(await S.readSession(room.code),host,'expedition-continue',{stage:3}));
 return snap;
}
test('earlier one-stage escort receipts remain complete without fabricating the new habitat or release stages',()=>{
 const book=MM.credit(null,{id:'legacy-corridor',expeditionId:'wildlife-corridor',route:'bridge',results:[{stage:1,mode:'Solo',team:[{userId:22}],survivors:['Ranger Amara','Driver Luis'],evacuees:[{id:'wc_worker_1',name:'Ranger Amara'},{id:'wc_worker_2',name:'Driver Luis'}],captures:0,kills:0}]},22);
 assert.equal(MM.summary(book,'wildlife-corridor').modes[0].clears,1);assert.equal(R.view(book).people.length,2);assert.equal(R.view(book).tigers.length,0);assert(!book.runs['legacy-corridor'].stages[3]);
});
test('an already-completed pilot room can continue without losing its workers and receives one durable transport manifest',async()=>scope.run('expedition-solo',async()=>{
 const {host,room,users}=await party('forest',true,988301);let snap=await S.buildSnapshot(room,host.id);
 await setPlayers(room,users,snap.extraction,{checkpointIds:snap.checkpoints.map(p=>p.id),capturedIds:snap.tigers.map(t=>t.id),rescuedIds:snap.civilians.map(c=>c.id),securedCivilianIds:snap.civilians.map(c=>c.id)});
 await DB.setState(`corridor_convoy_${room.code}_${room.corridorAttempt}`,{...snap.expedition.convoy,distance:snap.expedition.convoy.total,arrived:true});
 snap=await S.buildSnapshot(await S.readSession(room.code),host.id);assert.equal(snap.status,'complete');
 const savedKey=`rescue_expedition_wildlife-corridor_${host.id}`,saved=await DB.getState(savedKey),oldRoom=await S.readSession(room.code);
 delete saved.cargo;delete saved.results[0].corridorStages;delete oldRoom.expedition.cargo;await DB.setState(savedKey,saved);await DB.setState(roomKey(room),oldRoom);
 await S.applyAction(await S.readSession(room.code),host,'expedition-continue',{stage:1});
 const next=await S.readSession(room.code);assert.equal(next.expedition.stage,2);assert.equal(next.expedition.safeWorkers.length,2);assert.equal(next.expedition.cargo.length,2);
 assert.deepEqual(next.expedition.cargo,(await DB.getState(savedKey)).cargo);assert.equal((await S.expeditionStatus(host,'wildlife-corridor')).roomCode,room.code);
}));
