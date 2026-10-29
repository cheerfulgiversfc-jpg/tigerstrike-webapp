const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const routes=require('./mission-routes'),maps=require('./chapter-maps'),water=require('./water-terrain'),truth=require('./mission-map-truth');
const map=maps.forMission(1),world=map.world;
test('Missions 1–10 share dry functional shelter locations and Map Truth parity without extra required actions',()=>{
  for(let level=1;level<=10;level++){
    const s=routes.shelters(level,world),spec=truth.scale(level,world.width,world.height);assert.deepEqual(s,spec.routeShelters);assert.deepEqual(spec.routeChoices,['direct','shelter']);assert.deepEqual(spec.requiredActionIds,truth.get(level).requiredActionIds);
    for(const p of s)for(const dx of [-70,70])for(const dy of [-78,50])assert(map.waterZones.every(z=>!water.contains(z,p.x+dx,p.y+dy)));
    assert.deepEqual(s,routes.shelters(1,world));
  }
  assert.deepEqual(routes.shelters(61,world),[]);assert.equal(routes.plan({level:61,world,from:{x:100,y:100},to:{x:400,y:400}}),null);
});
test('direct and shelter guidance reach the real destination through a bridge without cutting across water',()=>{
  const from={x:1000,y:1000},to={x:3800,y:2600};
  for(const selected of ['direct','shelter']){
    const route=routes.plan({level:1,world,from,to,selected});assert(route.path.length);assert.deepEqual(route.path.at(-1),to);assert.deepEqual(route.path[0],from);
    if(selected==='shelter')assert(route.path.some(p=>p.x===route.shelter.x&&p.y===route.shelter.y));
    let bridge=false;for(let i=1;i<route.path.length;i++){const a=route.path[i-1],b=route.path[i],n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/5);for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;assert(map.waterZones.every(z=>!water.contains(z,x,y)));if(water.onBridge(map.waterZones[0],x,y,-14))bridge=true;}}
    assert(bridge);assert(route.length>0&&route.length<10000);
  }
});
test('closed bridges and wet destinations report an unverified route rather than showing a fake path',()=>{
  const bridge=map.waterZones[0].bridges[0];
  const route=routes.plan({level:1,world,from:{x:1000,y:1000},to:{x:3800,y:2600},blockedRects:[bridge]});assert.equal(route.path.length,0);assert.match(route.message,/No verified/);
  const river=map.waterZones[0],bank=water.banks(river,1000);assert.equal(routes.plan({level:1,world,from:{x:1000,y:1000},to:{x:1000,y:bank.center}}).path.length,0);
});
test('cover uses the exact visible rectangle, never gives immunity, and firing removes it for three seconds',()=>{
  const s=routes.shelters(1,world)[0],options={level:1,world,point:s,now:10000};assert.equal(routes.damage(10,options),5);assert.equal(routes.damage(1,options),1);
  assert.equal(routes.damage(10,{...options,point:{x:s.x+61,y:s.y}}),10);assert.equal(routes.damage(10,{...options,lastShotAt:8000}),10);assert.equal(routes.damage(10,{...options,lastShotAt:7000}),5);
  assert.equal(routes.damage(10,{...options,point:{x:s.x,y:s.y+10}}),5);assert.equal(routes.damage(10,{...options,point:{x:s.x,y:s.y+11}}),10);
  assert.equal(routes.damage(10,{...options,faction:'government'}),10);assert.equal(routes.damage(10,{...options,level:61}),10);
});
test('debriefs describe measured cover reduction and final guidance without inventing route completion or rewards',()=>{
  const debrief=require('./mission-debrief'),run=debrief.summary({id:'route-test',completed:true,scope:'solo',route:{choice:'shelter',preventedDamage:13}}),html=debrief.html(run,{});
  assert.equal(run.route.preventedDamage,13);assert.match(html,/Final route guidance: Shelter detour/);assert.match(html,/by 13 this attempt/);assert.match(html,/selection alone earns no completion credit/);
});
for(const level of [1,11,20,21,30,31,40,41,50,51,60])test(`Mission ${level}: Co-op route choices, shelter damage and restart use authoritative state`,async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const original=Date.now;let now=1800000600000;Date.now=()=>now;
  try{
    const host={id:983981+level*10,first_name:'Route Host'},mate={id:983982+level*10,first_name:'Route Mate'};
    let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:level});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');assert.equal(room.routeVersion,1);
    await server.applyAction(room,host,'route-choice',{choice:'shelter'});await assert.rejects(()=>server.applyAction(room,host,'route-choice',{choice:'fake'}),/Choose Direct/);
    const key=`live_squad_player_${room.code}_${host.id}`,mateKey=`live_squad_player_${room.code}_${mate.id}`,s=routes.shelters(level,world)[0];
    let snap=await server.buildSnapshot(room,host.id),t=snap.tigers[0];assert.equal(snap.players.find(p=>p.userId===host.id).routeChoice,'shelter');assert.equal(snap.players.find(p=>p.userId===mate.id).routeChoice,'direct');
    async function hit(point){now+=1000;const p=await store.getState(key);await store.setState(key,{...p,...point,hp:100,armor:0,pendingTigerAttack:{tigerId:t.id,tigerX:point.x,tigerY:point.y,x:point.x,y:point.y,startedAt:now-700,resolveAt:now-1,runId:`${room.code}:${room.startedAt}`}});await server.updateOwnPresence(room,host,{});return store.getState(key);}
    let p=await hit(s),inside=100-p.hp;assert(p.routePrevented>0);const saved=p.routePrevented;
    p=await hit({x:s.x+75,y:s.y});assert(100-p.hp>inside);assert.equal(p.routePrevented,saved);
    p=await store.getState(key);await store.setState(key,{...p,lastAttackAt:now});p=await hit(s);assert(100-p.hp>inside);assert.equal(p.routePrevented,saved,'firing cannot farm protection');
    const raw=await store.getState(`live_squad_session_${room.code}`);await store.setState(`live_squad_session_${room.code}`,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:now});room=await server.readSession(room.code);
    snap=await server.buildSnapshot(room,host.id);assert.equal(snap.debrief.route.preventedDamage,saved);assert.equal((await server.buildSnapshot(room,mate.id)).debrief.route.preventedDamage,0);
    room=await server.applyAction(room,host,'restart');assert.equal((await store.getState(key)).routePrevented,0);assert.equal((await store.getState(mateKey)).routePrevented,0);
  }finally{Date.now=original;}
});
test('the live client loads routes before map truth and rendering, and both modes expose real route controls',()=>{
  const html=fs.readFileSync('index.html','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');assert(html.indexOf('mission-routes.js?')<html.indexOf('mission-map-truth.js?'));assert(html.indexOf('mission-routes.js?')<html.indexOf('shared-battlefield-renderer.js?'));assert.match(html,/onclick="openMissionRoute\(\)"/);assert(coop.includes("api('route-choice',{choice})"));assert(fs.readFileSync('api/squad/session.js','utf8').includes('"route-choice"'));
});
test('the real Co-op route command sends the chosen option and applies the returned server snapshot',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store'),{createHarness}=require('./qa/coop-harness');assert.equal(store.storageMode(),'memory');
  const host={id:983983},mate={id:983984};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');
  const snapshot=await server.buildSnapshot(room,host.id),h=createHarness({userId:host.id,snapshot,transport:async request=>{assert.equal(request.action,'route-choice');room=await server.applyAction(await server.readSession(room.code),host,request.action,request);return {ok:true,snapshot:await server.buildSnapshot(room,host.id)};}});
  let opened=null;h.ctx.TigerMissionRoutes={...h.ctx.TigerMissionRoutes,open:options=>{opened=options;}};
  h.qa.render();assert(h.element('squadBody').innerHTML.includes('data-squad-command="mission-route"'));await h.qa.dispatchCommand('mission-route');assert.equal(opened.level,1);assert(opened.preview.direct.path.length);
  let release;h.qa.state.syncBusy=true;h.qa.state.syncPromise=new Promise(resolve=>release=resolve);const chosen=opened.choose('shelter');assert(h.qa.state.routeBusy);await h.qa.sync();assert.equal(h.requests.length,0,'route changes wait for the previous presence write');h.qa.state.syncBusy=false;release();await chosen;assert(!h.qa.state.routeBusy);assert.equal(h.requests.at(-1).action,'route-choice');assert.equal(h.qa.state.snapshot.players.find(p=>p.userId===host.id).routeChoice,'shelter');assert.equal(h.qa.state.snapshot.players.find(p=>p.userId===mate.id).routeChoice,'direct');
});
