const test=require('node:test'),assert=require('node:assert/strict');
const teamwork=require('./escort-teamwork'),tools=require('./rescue-tools');
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
let uid=9811900;
const playerKey=(s,u)=>`live_squad_player_${s.code}_${u.id}`;
async function patch(s,u,values){const key=playerKey(s,u);await store.setState(key,{...await store.getState(key),...values});}
async function room(){
  const host={id:uid++,first_name:'Escort Host'},mate={id:uid++,first_name:'Escort Partner'};
  let s=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:1});
  s=await squad.joinSession(s.code,mate);s=await squad.applyAction(s,host,'start');
  const c=(await squad.buildSnapshot(s,host.id)).civilians[0];
  await patch(s,host,{x:c.x,y:c.y});await patch(s,mate,{x:c.x+40,y:c.y});
  await squad.applyAction(s,host,'rescue',{civilianId:c.id});
  return {s,host,mate,c};
}
test('rescue counters distinguish current owners, entry animations, safe residents and unclaimed civilians',()=>{
  assert.deepEqual(teamwork.counts([{following:true,followingUserId:1},{following:true,followingUserId:2},{secured:true,rescueArrival:{at:1000}},{secured:true},{},{dead:true}],1,1500),{you:1,teammate:1,entering:1,safe:1,available:1});
  const offer={expiresAt:5000,runId:'room:1000'};
  assert(teamwork.activeOffer(offer,{code:'room',startedAt:1000},2000));
  assert.equal(teamwork.activeOffer(offer,{code:'room',startedAt:2000},2000),null);
});
test('live tool preview chooses the same patient as the server without consuming supplies',()=>{
  const p={userId:1,x:0,y:0,hp:70,maxHp:100,name:'Soldier'},c={id:'c',x:50,y:50,hp:55,hpMax:100,name:'Villager'};
  const tool=tools.create('med-drone'),preview=tools.preview(tool,[p],[c],p);
  assert.equal(preview.targetId,tools.healingTarget([p],[c],p).target.id);
  assert.equal(preview.label,'Villager +45 HP');assert.equal(tool.charges,2);
  assert.equal(tools.preview({id:'smoke'},[],[],p).r,300);
  assert.match(tools.preview({id:'tranq-kit'},[],[],p).label,/Tranq Kit/);
});
test('Solo preview preserves charges and predicts the actual Med Drone patient and healing',()=>{
  const systems=require('./field-systems'),oldState=global.S,oldDocument=global.document;
  global.document={getElementById:()=>null};
  try{
    global.S={mode:'Story',_missionRunId:'preview',worldMapPrepLast:{secondaryId:'med-drone'},me:{x:10,y:10},hp:70,civilians:[{id:1,name:'Villager',x:30,y:30,alive:true,hp:55,hpMax:100}],tigers:[]};
    systems.resetMissionSecondaryForMission(global.S);systems.previewMissionSecondary();
    assert.equal(global.S.missionSecondary.charges,2);
    assert.equal(systems.missionToolPreview(global.S).label,'Villager +45 HP');
    systems.useSelectedMissionSecondary();
    assert.equal(global.S.civilians[0].hp,100);assert.equal(global.S.missionSecondary.charges,1);
  }finally{global.S=oldState;global.document=oldDocument;}
});
test('handoffs require recipient acceptance; replay cannot duplicate followers or rescue credits',async()=>{
  const {s,host,mate,c}=await room();
  const beforeHost=await squad.readCoopProfile(host),beforeMate=await squad.readCoopProfile(mate);
  await squad.applyAction(s,host,'escort-offer');
  let current=await squad.readSession(s.code),snap=await squad.buildSnapshot(current,mate.id),offer=snap.escortOffer;
  assert(offer);assert.equal(snap.civilians[0].followingUserId,host.id);
  await assert.rejects(()=>squad.applyAction(current,host,'escort-accept',{offerId:offer.id}),/not addressed/);
  const outcomes=await Promise.allSettled([squad.applyAction(current,mate,'escort-accept',{offerId:offer.id}),squad.applyAction(current,mate,'escort-accept',{offerId:offer.id})]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);
  current=await squad.readSession(s.code);snap=await squad.buildSnapshot(current,host.id);
  assert.equal(snap.civilians[0].followingUserId,mate.id);assert.equal(snap.rescuedIds.filter(id=>id===c.id).length,1);
  assert.equal(snap.escortOffer,null);
  await patch(s,mate,{rescuedIds:[],civilianEscorts:{}});
  await squad.updateOwnPresence(current,mate,{});
  assert((await store.getState(playerKey(s,mate))).rescuedIds.includes(c.id),'an older presence packet cannot erase transferred ownership');
  await assert.rejects(()=>squad.applyAction(current,mate,'escort-accept',{offerId:offer.id}),/expired/);
  const house=snap.rescueHouse;
  await patch(s,host,{x:house.x,y:house.y});
  await assert.rejects(()=>squad.applyAction(s,host,'deliver'),/No civilians/);
  await patch(s,mate,{x:house.x,y:house.y,civilianEscorts:{[c.id]:{x:house.x,y:house.y,path:[],updatedAt:Date.now()}}});
  await squad.applyAction(current,mate,'deliver');
  await assert.rejects(()=>squad.applyAction(current,mate,'deliver'),/No civilians/);
  snap=await squad.buildSnapshot(await squad.readSession(s.code),host.id);assert.equal(snap.securedCivilianIds.length,1);
  assert.equal((await squad.readCoopProfile(host)).stats.rescues,beforeHost.stats.rescues);
  assert.equal((await squad.readCoopProfile(mate)).stats.rescues,beforeMate.stats.rescues);
});
test('decline, expiry, distance and pauses never silently transfer ownership',async()=>{
  const {s,host,mate}=await room();
  await patch(s,mate,{x:3500,y:1800});
  await assert.rejects(()=>squad.applyAction(s,host,'escort-offer'),/160m/);
  const p=await store.getState(playerKey(s,host));await patch(s,mate,{x:p.x+40,y:p.y});
  await squad.applyAction(s,host,'escort-offer');let current=await squad.readSession(s.code);
  await squad.applyAction(current,mate,'escort-decline',{offerId:current.escortOffer.id});
  current=await squad.readSession(s.code);assert.equal(current.escortOffer,null);
  await squad.applyAction(current,host,'escort-offer');current=await squad.readSession(s.code);
  const oldId=current.escortOffer.id;
  await store.setState(`live_squad_session_${s.code}`,{...current,escortOffer:{...current.escortOffer,expiresAt:1}});
  await assert.rejects(()=>squad.applyAction(current,mate,'escort-accept',{offerId:oldId}),/expired/);
  // Wrong IDs are rejected even if a network retry retains an older offer.
  await assert.rejects(()=>squad.applyAction(current,mate,'escort-accept',{offerId:'stale'}),/expired/);
  await squad.applyAction(await squad.readSession(s.code),host,'pause',{reason:'shop'});
  await assert.rejects(async()=>squad.applyAction(await squad.readSession(s.code),mate,'escort-accept',{offerId:oldId}),/paused/);
});
test('nearby followers of a downed rescuer can be recovered and stay assigned after reconnect',async()=>{
  const {s,host,mate,c}=await room();
  await assert.rejects(()=>squad.applyAction(s,mate,'escort-recover'),/only available/);
  await patch(s,host,{downed:true,hp:0,livesRemaining:0,respawnAt:0});
  await patch(s,mate,{x:3500,y:1800});
  await assert.rejects(()=>squad.applyAction(s,mate,'escort-recover'),/200m/);
  await patch(s,mate,{x:c.x+40,y:c.y});await squad.applyAction(s,mate,'escort-recover');
  let current=await squad.joinSession(s.code,mate),snap=await squad.buildSnapshot(current,host.id);
  assert.equal(snap.civilians[0].followingUserId,mate.id);assert.equal(snap.civilians[0].escortOwnerDown,false);
  await squad.updateOwnPresence(current,mate,{});
  await patch(s,mate,{downed:true,hp:0,livesRemaining:0,respawnAt:0});
  await squad.buildSnapshot(current,host.id);current=await squad.readSession(s.code);
  current=await squad.applyAction(current,host,'restart');snap=await squad.buildSnapshot(current,host.id);
  assert.equal(snap.civilians.filter(c=>c.following).length,0);assert.deepEqual(current.escortOwners,{});
});
