const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('./api/_lib/squad-session');
const {getState,setState}=require('./api/_lib/metrics-store');
const scope=require('./api/_lib/rescue-profile-scope');
const {holdMs}=require('./rescue-expedition');
const W=require('./water-terrain');

const host={id:960771,first_name:'Captain'},guest={id:960772,first_name:'Partner'};
const solo='expedition-solo',duo='expedition-squad';
const sessionKey=room=>`live_squad_session_${room.code}`;
async function place(room,user,point,patch={}){
  const key=`live_squad_player_${room.code}_${user.id}`;
  await setState(key,{...await getState(key),...point,lastSeenAt:Date.now(),...patch});
}
const snapshot=async(room,user=host)=>S.buildSnapshot(await S.readSession(room.code),user.id);
const action=async(room,user,kind,body)=>S.applyAction(await S.readSession(room.code),user,kind,body);

async function create(type,opts={}){
  return S.createSession(host,{launchType:type,...opts});
}
async function start(room){
  if(room.memberIds.length===2){
    await assert.rejects(()=>action(room,host,'start'),/confirm/);
    for(const user of [host,guest])await action(room,user,'ready',{ready:true,readyRevision:room.readyRevision});
  }
  return action(room,host,'start');
}

async function clearThreats(room){
  for(const tiger of (await snapshot(room)).tigers){
    // The test controls enemy health and movement; capture itself uses the real action.
    await place(room,host,tiger,{tigerDamage:{
      ...(await getState(`live_squad_player_${room.code}_${host.id}`)).tigerDamage,
      [tiger.id]:Math.ceil(tiger.hpMax*.8),
    }});
    await action(room,host,'capture',{tigerId:tiger.id});
  }
}

async function escort(room,party){
  let snap=await snapshot(room);
  const owners=new Map();
  for(const [i,civ] of snap.civilians.entries()){
    const user=party[i%party.length];
    await place(room,user,civ);
    await action(room,user,'rescue',{civilianId:civ.id});
    owners.set(civ.id,user.id);
  }
  snap=await snapshot(room);
  assert.deepEqual(snap.civilians.map(c=>c.followingUserId),[...owners.values()]);
  for(const user of party){
    const escorts=Object.fromEntries(snap.civilians.filter(c=>c.followingUserId===user.id).map(c=>[c.id,{...snap.rescueHouse,path:[],updatedAt:Date.now()}]));
    await place(room,user,snap.rescueHouse,{civilianEscorts:escorts});
    await action(room,user,'deliver');
  }
  assert.equal((await snapshot(room)).securedCivilianIds.length,3);
}

async function finish(room,party){
  const snap=await snapshot(room);
  for(const user of party)await place(room,user,snap.extraction);
  if(snap.expedition.stage===3){
    assert.equal((await snapshot(room)).status,'active','boarding must take time');
    assert((await snapshot(room)).expedition.boardingMs>0);
    await place(room,host,snap.spawns[0]);
    assert.equal((await snapshot(room)).expedition.boardingMs,0,'leaving resets the hold');
    await place(room,host,snap.extraction);
    await snapshot(room);
    const active=await S.readSession(room.code);
    await setState(sessionKey(room),{...active,expeditionBoardingAt:Date.now()-holdMs});
  }
  assert.equal((await snapshot(room)).status,'complete');
  room=await S.readSession(room.code);
  const claims=await Promise.all(party.map(user=>S.claimReward(room,user)));
  assert(claims.every(claim=>claim.expedition.stage===snap.expedition.stage+1));
  assert.equal(claims[0].expedition.results.length,snap.expedition.stage);
  await S.closeSession(room,host);
  assert.equal((await S.expeditionStatus(host)).roomCode,'');
  return claims[0].expedition;
}

test('River Gate checkpoints survive retries and mode switches, and both branches finish',async()=>{
  const regular=await S.readCoopProfile(host);
  await scope.run(solo,async()=>{
    const launches=await Promise.allSettled([create(solo,{expeditionRoute:'clinic'}),create(solo,{expeditionRoute:'clinic'})]);
    assert.equal(launches.filter(row=>row.status==='fulfilled').length,1,'simultaneous launches cannot own the same checkpoint');
    let room=launches.find(row=>row.status==='fulfilled').value;
    assert.equal((await S.expeditionStatus(host)).roomCode,room.code);
    await assert.rejects(()=>S.joinSession(room.code,guest),/Solo expedition/);
    room=await start(room);
    await assert.rejects(()=>action(room,host,'expedition-interact'),/marked objective/);
    await place(room,host,{}, {hp:0,downed:true,livesRemaining:0,respawnAt:0});
    assert.equal((await snapshot(room)).status,'failed');
    room=await action(room,host,'restart');
    assert.equal((await snapshot(room)).players[0].livesRemaining,1);
    const site=(await snapshot(room)).checkpoints[0];
    await place(room,host,site);
    await action(room,host,'expedition-interact');
    await clearThreats(room);
    await finish(room,[host]);
  });

  await scope.run(duo,async()=>{
    let room=await create(duo,{expeditionRoute:'bridge'});
    assert.equal(room.expedition.route,'clinic','a stage cannot swap the saved route');
    room=await S.joinSession(room.code,guest);
    room=await start(room);
    let snap=await snapshot(room);
    assert(snap.civilians.every(c=>c.hp===55));
    await place(room,guest,snap.civilians[0]);
    await assert.rejects(()=>action(room,guest,'rescue',{civilianId:snap.civilians[0].id}),/route objective/);
    await place(room,guest,snap.checkpoints[0]);
    await action(room,guest,'expedition-interact');
    snap=await snapshot(room);
    assert(snap.civilians.every(c=>c.hp===100));
    assert.equal((await S.joinSession(room.code,guest)).code,room.code);
    await assert.rejects(()=>action(room,host,'handoff'),/captain/);
    await escort(room,[host,guest]);
    await clearThreats(room);
    await finish(room,[host,guest]);
    assert.equal(await S.expeditionStatus(guest),null,'teammate has separate captain progress');
  });

  await scope.run(solo,async()=>{
    let room=await start(await create(solo));
    let snap=await snapshot(room);
    assert(snap.expedition.boat);
    const {x,endX}=snap.expedition.boat;
    for(let at=x;at<=endX;at+=30)assert(W.swimming(snap.waterZones,at,W.banks(snap.waterZones[0],at).center));
    await escort(room,[host]);
    await clearThreats(room);
    const completed=await finish(room,[host]);
    assert.equal(completed.stage,4);
    assert.deepEqual(completed.results[2].survivors,['Mara','Eli','Nia']);
    assert.deepEqual(completed.results.map(row=>row.mode),['Solo','Co-op','Solo']);
    await assert.rejects(()=>create(solo),/Replay/);

    room=await start(await create(solo,{expeditionReplay:true,expeditionRoute:'bridge'}));
    snap=await snapshot(room);
    assert.equal(snap.waterZones[0].bridges.length,0);
    await place(room,host,snap.checkpoints[0]);
    await action(room,host,'expedition-interact');
    assert.equal((await snapshot(room)).waterZones[0].bridges.length,1);
    await clearThreats(room);
    await finish(room,[host]);

    room=await start(await create(solo));
    snap=await snapshot(room);
    assert.equal(snap.tigers.length,2,'shorter crossing has an extra patrol');
    assert(snap.civilians.every(c=>c.hp===100));
    await place(room,host,snap.checkpoints[0],{rescuedIds:snap.civilians.map(c=>c.id)});
    await S.updateOwnPresence(room,host,{});
    assert.deepEqual((await snapshot(room)).checkpointCompletedIds,['exp_crossing']);
    await place(room,host,snap.spawns[0],{rescuedIds:[],civilianEscorts:{}});
    await escort(room,[host]);
    await clearThreats(room);
    await finish(room,[host]);

    room=await start(await create(solo));
    await escort(room,[host]);
    await clearThreats(room);
    assert.equal((await finish(room,[host])).stage,4);
  });
  const after=await S.readCoopProfile(host);
  assert.deepEqual({...after,updatedAt:regular.updatedAt},regular,'no expedition spending or captures leak into regular Co-op');
});
