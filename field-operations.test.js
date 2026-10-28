const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const ops=require('./field-operations'),maps=require('./chapter-maps'),truth=require('./mission-map-truth'),water=require('./water-terrain');
const world=maps.forMission(1).world,sites=ops.fixtures(1,world),player={...sites[1],hp:20,maxHp:100,armor:10,armorCap:100};
test('cached guidance refreshes its origin after a field detour and explicit dialog reset',()=>{
  const routes=require('./mission-routes');routes.reset();
  const options={level:1,world,from:{x:500,y:500},to:{x:1000,y:500},waterZones:[],selected:'direct'};
  const first=routes.cached(options,'field-detour');
  assert.equal(routes.cached({...options,from:{x:510,y:500}},'field-detour'),first);
  const moved=routes.cached({...options,from:{x:800,y:500}},'field-detour');
  assert.notEqual(moved,first);assert.deepEqual(moved.path[0],{x:800,y:500});
  routes.reset();assert.notEqual(routes.cached(options,'field-detour'),first);
});
test('all ten pilot maps share dry tower/cache geometry with Map Truth and retain required objectives',()=>{
  for(let level=1;level<=10;level++){assert.deepEqual(ops.fixtures(level,world),sites);assert.deepEqual(truth.scale(level,4800,2800).fieldFixtures,sites);assert.deepEqual(truth.scale(level,4800,2800).requiredActionIds,truth.get(level).requiredActionIds);for(const p of sites)assert(maps.forMission(level).waterZones.every(z=>!water.contains(z,p.x,p.y)));}
  assert.deepEqual(ops.fixtures(41,world),[]);
});
test('field supplies are limited, usable equipment, not permanent profile loot or repeatable healing',()=>{
  let state=ops.act({},'cache',{level:1,world,player}).state;assert.equal(state.medkits,1);assert.equal(state.armor,1);assert.throws(()=>ops.act(state,'cache',{level:1,world,player}),/already/);
  let r=ops.act(state,'medkit',{level:1,world,player});assert.equal(r.heal,40);state=r.state;assert.equal(state.healed,40);assert.throws(()=>ops.act(state,'medkit',{level:1,world,player}),/required/);
  r=ops.act(state,'armor',{level:1,world,player});assert.equal(r.armor,40);assert.equal(r.state.armor,0);assert.equal(r.state.armored,40);
  assert.throws(()=>ops.act({},'cache',{level:1,world,player:{...player,x:100,y:100}}),/110m/);assert.throws(()=>ops.act({},'cache',{level:1,world,player:{...player,hp:0}}),/standing/);
  assert.throws(()=>ops.act({},'cache',{level:41,world,player}),/1–40/);
});
test('tower scans and live path danger use real living threats and expire',()=>{
  const result=ops.act({},'tower',{level:1,world,player:{...player,...sites[0]},now:5000});assert.equal(result.state.towerUntil,35000);assert.equal(result.state.towerReadyAt,50000);assert.throws(()=>ops.act(result.state,'tower',{level:1,world,player:{...player,...sites[0]},now:6000}),/recharging/);
  const path={path:[{x:100,y:100},{x:500,y:100}]};assert.equal(ops.danger(path,[{x:300,y:120,hp:10},{x:300,y:120,hp:0},{x:1000,y:1000,hp:10},{x:300,y:120,hp:10,captured:true}]),1);
});
test('optional rescue leads have stable real civilian identities, fair windows and no new completion requirements',()=>{
  const civilians=[{id:'b',x:300,y:300},{id:'a',x:200,y:200}];assert.equal(ops.lead(1,civilians,59000).status,'pending');assert.equal(ops.lead(1,civilians,60000).status,'active');assert.equal(ops.lead(1,civilians,150001).status,'missed');assert.equal(ops.lead(1,civilians,90000,80000).status,'rescued');assert.equal(ops.lead(1,civilians,90000,50000).status,'early');assert.equal(ops.lead(1,civilians,90000).id,'a');assert.equal(ops.lead(3,civilians,90000),null);
  const located=ops.act({},'locate-tower',{level:1,world,player}).state;assert.equal(ops.destination({action:'Rescue civilian'},null,located,1,world).id,sites[0].id);assert.equal(ops.destination({action:'Revive teammate'},null,located,1,world).action,'Revive teammate');
});
for(const level of [1,11,16,17,21,26,27,31,33,37])test(`Mission ${level}: real Co-op tower, personal supplies, pause, rescue delivery and restart work together`,async()=>{
  const sites=ops.fixtures(level,world);
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');const original=Date.now;let now=1800000700000;Date.now=()=>now;
  try{
    const host={id:983991+level*10},mate={id:983992+level*10};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:level});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');assert.equal(room.fieldVersion,1);
    const key=u=>`live_squad_player_${room.code}_${u.id}`,patch=async(u,fields)=>store.setState(key(u),{...await store.getState(key(u)),...fields});
    const profileBefore=await server.readCoopProfile(host);await patch(host,{x:sites[0].x,y:sites[0].y});await server.applyAction(room,host,'field-use',{kind:'tower'});
    let snap=await server.buildSnapshot(room,mate.id);assert.equal(snap.fieldTowerUntil,30000);assert.equal(snap.players.find(p=>p.userId===mate.id).fieldOps.towerUses,0);
    await assert.rejects(()=>server.applyAction(room,host,'field-use',{kind:'cache'}),/110m/);await patch(host,{x:sites[1].x,y:sites[1].y,hp:20,armor:10});
    const duplicate=await Promise.allSettled([server.applyAction(room,host,'field-use',{kind:'cache'}),server.applyAction(room,host,'field-use',{kind:'cache'})]);assert.equal(duplicate.filter(r=>r.status==='fulfilled').length,1);
    await patch(mate,{x:sites[1].x,y:sites[1].y});await server.applyAction(room,mate,'field-use',{kind:'cache'});
    await server.applyAction(room,host,'field-use',{kind:'medkit'});await server.applyAction(room,host,'field-use',{kind:'armor'});let p=await store.getState(key(host));assert.equal(p.hp,60);assert.equal(p.armor,50);assert.equal(p.fieldOps.healed,40);assert.equal(p.fieldOps.armored,40);assert.equal((await store.getState(key(mate))).fieldOps.medkits,1);assert.deepEqual((await server.readCoopProfile(host)).supplies,profileBefore.supplies);
    now+=5000;room=await server.applyAction(room,host,'pause',{reason:'shop'});now+=5000;snap=await server.buildSnapshot(await server.readSession(room.code),mate.id);assert.equal(snap.fieldNow,5000);assert(snap.fieldNow<snap.fieldTowerUntil);await assert.rejects(async()=>server.applyAction(await server.readSession(room.code),host,'field-use',{kind:'medkit'}),/paused/);
    room=await server.applyAction(await server.readSession(room.code),host,'resume');now+=56000;snap=await server.buildSnapshot(room,host.id);assert.equal(snap.fieldLead.status,'active');const civ=snap.civilians.find(c=>c.id===snap.fieldLead.id);
    for(const u of [host,mate])await patch(u,{checkpointIds:snap.checkpoints.map(c=>c.id)});
    await patch(host,{x:civ.x,y:civ.y});await server.applyAction(room,host,'field-use',{kind:'lead'});await server.applyAction(room,host,'rescue',{civilianId:civ.id});snap=await server.buildSnapshot(room,host.id);const house=snap.rescueHouse;p=await store.getState(key(host));await patch(host,{x:house.x,y:house.y,civilianEscorts:{...p.civilianEscorts,[civ.id]:{x:house.x,y:house.y,path:[],updatedAt:now}}});room=await server.applyAction(room,host,'deliver');snap=await server.buildSnapshot(room,mate.id);assert.equal(snap.fieldLead.status,'rescued');assert(snap.securedCivilianIds.includes(civ.id));
    const raw=await store.getState(`live_squad_session_${room.code}`);await store.setState(`live_squad_session_${room.code}`,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:now});room=await server.readSession(room.code);snap=await server.buildSnapshot(room,host.id);assert.equal(snap.debrief.field.healed,40);assert.equal(snap.debrief.field.leadStatus,'rescued');
    room=await server.applyAction(room,host,'restart');p=await store.getState(key(host));assert.equal(p.fieldOps.collected,false);assert.equal(p.fieldOps.medkits,0);assert.equal(room.fieldLeadRescuedAt,null);
  }finally{Date.now=original;}
});
for(const level of [1,11,20,21,30,31,40])test(`Mission ${level}: Co-op Field Actions uses current health and applies the server response`,async()=>{
  const sites=ops.fixtures(level,world);
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store'),{createHarness}=require('./qa/coop-harness');assert.equal(store.storageMode(),'memory');
  const host={id:983993+level*10},mate={id:983994+level*10};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:level});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');const key=`live_squad_player_${room.code}_${host.id}`;await store.setState(key,{...await store.getState(key),x:sites[0].x,y:sites[0].y,hp:50});
  const h=createHarness({userId:host.id,snapshot:await server.buildSnapshot(room,host.id),transport:async request=>{room=await server.applyAction(await server.readSession(room.code),host,request.action,request);return {ok:true,snapshot:await server.buildSnapshot(room,host.id)};}});h.qa.state.local.hp=100;let opened;h.ctx.TigerFieldOperations={...h.ctx.TigerFieldOperations,open:o=>{opened=o;}};h.qa.render();assert(h.element('squadBody').innerHTML.includes('data-squad-command="field-actions"'));await h.qa.dispatchCommand('field-actions');assert.equal(opened.player.hp,50);await opened.action('tower');assert.equal(h.requests.at(-1).action,'field-use');assert(h.qa.state.snapshot.fieldTowerUntil>h.qa.state.snapshot.fieldNow);
  const html=fs.readFileSync('index.html','utf8');assert(html.indexOf('field-operations.js?')<html.indexOf('shared-battlefield-renderer.js?'));assert(fs.readFileSync('api/squad/session.js','utf8').includes('"field-use"'));
});
