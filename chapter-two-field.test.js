const test=require('node:test'),assert=require('node:assert/strict');
const maps=require('./chapter-maps'),routes=require('./mission-routes'),ops=require('./field-operations'),truth=require('./mission-map-truth'),water=require('./water-terrain');
const map=maps.forMission(11),world=map.world;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return distance(p,{x:a.x+dx*u,y:a.y+dy*u});}
const roadPaths=[.21,.52,.80].map(y=>[[0,y],[.25,y-.015],[.5,y+.018],[.75,y-.012],[1,y]]).concat([[[.18,0],[.20,.3],[.18,.62],[.21,1]],[[.70,0],[.72,.34],[.70,.65],[.73,1]]]).map(path=>path.map(([x,y])=>({x:x*world.width,y:y*world.height})));
test('Chapter 2 fixtures share one map and leave water, village roads and mission landmarks clear',()=>{
  assert.notDeepEqual(routes.shelters(11,world),routes.shelters(1,world));assert.notDeepEqual(ops.fixtures(11,world),ops.fixtures(1,world));
  for(let level=11;level<=20;level++){
    const spec=truth.scale(level,world.width,world.height),shelters=routes.shelters(level,world),fixtures=ops.fixtures(level,world);
    assert.deepEqual(shelters,routes.shelters(11,world));assert.deepEqual(fixtures,ops.fixtures(11,world));
    assert.deepEqual(spec.routeShelters,shelters);assert.deepEqual(spec.fieldFixtures,fixtures);assert.deepEqual(spec.requiredActionIds,truth.get(level).requiredActionIds);
    for(const p of [...shelters,...fixtures]){
      for(const dx of [-80,0,80])for(const dy of [-130,0,80])assert(map.waterZones.every(z=>!water.contains(z,p.x+dx,p.y+dy)),`Mission ${level}: fixture must remain on land`);
      for(const path of roadPaths)for(let i=1;i<path.length;i++)assert(segmentDistance(p,path[i-1],path[i])>150,`Mission ${level}: fixture must not cover road`);
      for(const mark of spec.landmarks)assert(distance(p,mark)>180,`Mission ${level}: ${p.label} must not cover ${mark.label}`);
    }
  }
  for(const n of [0,71,100,11.5]){assert.equal(routes.enabled(n),false);assert.equal(ops.enabled(n),false);}
});
test('all Chapter 2 routes cross actual bridges and shelters retain exact cover rules',()=>{
  const from={x:1200,y:1800},to={x:4080,y:2640};
  for(let level=11;level<=20;level++)for(const selected of ['direct','shelter']){
    const route=routes.plan({level,world,from,to,selected});assert(route.path.length,`Mission ${level} ${selected} must be reachable`);assert.deepEqual(route.path.at(-1),to);
    let crossed=false;for(let i=1;i<route.path.length;i++){
      const a=route.path[i-1],b=route.path[i],steps=Math.ceil(distance(a,b)/5);
      for(let j=0;j<=steps;j++){const x=a.x+(b.x-a.x)*j/steps,y=a.y+(b.y-a.y)*j/steps;assert(map.waterZones.every(z=>!water.contains(z,x,y)));if(water.onBridge(map.waterZones[0],x,y,-14))crossed=true;}
    }
    assert(crossed);if(selected==='shelter'){assert(route.path.some(p=>distance(p,route.shelter)===0));const options={level,world,point:route.shelter,now:10000};assert.equal(routes.damage(20,options),10);assert.equal(routes.damage(20,{...options,lastShotAt:9000}),20);assert.equal(routes.damage(20,{...options,faction:'government'}),20);}
  }
  const blocked=routes.plan({level:11,world,from,to,blockedRects:map.waterZones[0].bridges});assert.equal(blocked.path.length,0);assert.match(blocked.message,/No verified/);
});
for(let level=11;level<=20;level++)test(`Mission ${level}: authoritative Co-op routes, scans, supplies and debrief remain personal`,async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const host={id:985000+level*2},mate={id:985001+level*2};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:level});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');
  const key=u=>`live_squad_player_${room.code}_${u.id}`,patch=async(u,fields)=>store.setState(key(u),{...await store.getState(key(u)),...fields}),[tower,cache]=ops.fixtures(level,world);
  const profile=await server.readCoopProfile(host),initial=await server.buildSnapshot(room,host.id);
  assert.equal(initial.mission.level,level);assert.equal(initial.fieldVersion,1);assert.equal(initial.routeVersion,1);
  await server.applyAction(room,host,'route-choice',{choice:'shelter'});await patch(host,{x:tower.x,y:tower.y});await server.applyAction(room,host,'field-use',{kind:'tower'});
  let snap=await server.buildSnapshot(room,mate.id);assert(snap.fieldTowerUntil>snap.fieldNow);assert.equal(snap.players.find(p=>p.userId===mate.id).routeChoice,'direct');
  await patch(host,{x:cache.x,y:cache.y,hp:30,armor:20});await server.applyAction(room,host,'field-use',{kind:'cache'});await assert.rejects(()=>server.applyAction(room,host,'field-use',{kind:'cache'}),/already/);
  await server.applyAction(room,host,'field-use',{kind:'medkit'});await server.applyAction(room,host,'field-use',{kind:'armor'});
  const p=await store.getState(key(host));assert.equal(p.hp,70);assert.equal(p.armor,60);assert.equal((await store.getState(key(mate))).fieldOps.collected,false);
  assert.deepEqual((await server.readCoopProfile(host)).supplies,profile.supplies);
  assert.equal(!!snap.fieldLead,[11,16,17].includes(level));
  const sessionKey=`live_squad_session_${room.code}`,raw=await store.getState(sessionKey);await store.setState(sessionKey,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:Date.now()});room=await server.readSession(room.code);
  snap=await server.buildSnapshot(room,host.id);assert.equal(snap.debrief.field.healed,40);assert.equal(snap.debrief.field.armored,40);assert.equal(snap.debrief.route.choice,'shelter');assert.equal((await server.buildSnapshot(room,mate.id)).debrief.field.healed,0);
  room=await server.applyAction(room,host,'restart');assert.equal((await store.getState(key(host))).fieldOps.collected,false);assert.equal(room.fieldLeadRescuedAt,null);
});
