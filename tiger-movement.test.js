const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const cues=require('./tiger-encounters');
const base={id:'a',type:'Standard',personality:'Hunter',x:500,y:500,hp:60,hpMax:100,alive:true};
test('cautious retreats are short, have a cooldown and never apply to capture-ready, boss or engaged targets',()=>{
  const threat={x:440,y:500},r=cues.retreat(base,threat,1000);assert(r);assert.equal(r.until-r.at,1600);assert.equal(r.cooldownUntil-r.at,10000);assert.equal(r.dx,1);
  for(const change of [{hp:30},{hp:35},{hp:100},{boss:true},{captured:true},{defeated:true},{tranqTagged:true},{faction:'government'},{holdUntil:2000}])assert.equal(cues.retreat({...base,...change},threat,1000),null);
  for(const option of [{engaged:true},{survival:true},{requiredCapture:true},{cooldownUntil:2000}])assert.equal(cues.retreat(base,threat,1000,option),null);
  assert.equal(cues.retreat(base,{x:0,y:0},1000),null);
});
test('authoritative retreat offsets are continuous, bounded and cannot compound or relaunch a second pending response',()=>{
  const r={...cues.retreat(base,{x:440,y:500},1000),runAt:10},world={width:4800,height:2800};
  let previous=base;
  for(let at=1000;at<=2600;at+=10){const p=cues.retreatPoint(base,r,at,world);assert(Math.hypot(p.x-base.x,p.y-base.y)<=24+1e-8);assert(Math.hypot(p.x-previous.x,p.y-previous.y)<.5);previous=p;}
  assert.equal(cues.retreatPoint(base,r,2600).x,base.x);assert.equal(cues.retreatPoint(base,r,1800).x,base.x+24);
  const second={...r,at:1500,until:3100,cooldownUntil:11500,dx:-1};
  assert.equal(cues.activeReaction([r,second],10,1800).at,1000);assert.equal(cues.activeReaction([r,second],10,2700),null);assert.equal(cues.activeReaction([r],11,1800),null);
});
test('territorial patrols stay around home and preserve legacy, boss and Survival trajectories',()=>{
  const t={...base,type:'Armored',personality:'Sentinel',baseX:1000,baseY:700,rangeX:100,rangeY:80,speed:.6,phase:.4},world={width:4800,height:2800};
  for(let elapsed=0;elapsed<30;elapsed+=.05){const p=cues.patrol(t,elapsed,world,true);assert(p.guarding);assert(Math.abs(p.x-t.baseX)<=100);assert(Math.abs(p.y-t.baseY)<=80);if(elapsed>=4){assert(Math.abs(p.x-t.baseX)<=68+1e-8);assert(Math.abs(p.y-t.baseY)<=54.4+1e-8);}}
  const legacy=cues.patrol(t,5,world,false);assert.equal(legacy.x,t.baseX+Math.cos(5*t.speed+t.phase)*t.rangeX);assert.equal(cues.patrol({...t,boss:true},5,world,true).x,legacy.x);
});
test('Solo field plans stop for engagement, capture missions, obstacles and nearby civilians',()=>{
  const threat={x:440,y:500},plan=cues.fieldPlan(base,threat,1000,{world:{width:4800,height:2800}});assert.equal(plan.kind,'retreat');assert.equal(plan.goal.x,524);
  assert.equal(cues.fieldPlan({...base,x:plan.goal.x},threat,1200,{previous:plan}),null);
  assert.equal(cues.fieldPlan(base,threat,1200,{previous:plan,engaged:true}),null);
  const guard={...base,personality:'Sentinel',hp:100},home={x:500,y:500},far={x:900,y:900};
  assert.equal(cues.fieldPlan(guard,far,1000,{home}).kind,'guard');
  for(const option of [{nearCivilian:true},{guardBlocked:true},{requiredCapture:true},{survival:true}])assert.equal(cues.fieldPlan(guard,far,1000,{home,...option}),null);
  const game=fs.readFileSync('game.js','utf8');assert(game.includes('if(encounterSteering)speedCap=Math.min'));assert(game.includes('t._encounterGuardBlockedUntil=now+3000'));assert(game.includes('tryMoveEntity(t, t.x + t.vx, t.y + t.vy'));
});
test('new movement cues never override a real windup or a confirmed capture',()=>{
  const t={...base,encounterRetreating:true,encounterUntil:3000};assert.equal(cues.intent(t,1000).key,'retreating');
  assert.equal(cues.intent({...t,attackWarnings:[{startedAt:900,resolveAt:1400}]},1000).key,'windup');
  assert.equal(cues.intent({...t,captured:true},1000).key,'resting');assert.notEqual(cues.intent(t,4000).key,'retreating');
});
test('real Co-op retreat survives pause/reconnect, is shared, and still permits exactly one live capture',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const original=Date.now;let now=1800000000000;Date.now=()=>now;
  try{
    const host={id:983621,first_name:'Movement Host'},mate={id:983622,first_name:'Movement Mate'};
    let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');
    assert.equal(room.encounterVersion,2);const runAt=room.encounterRunAt;
    const initial=await server.buildSnapshot(room,host.id),target=initial.tigers.find(t=>!t.boss&&cues.profile(t).key==='Hunter'),key=`live_squad_player_${room.code}_${host.id}`;
    let p=await store.getState(key);p={...p,x:target.x-40,y:target.y,tigerDamage:{[target.id]:Math.round(target.hpMax*.36)},ammoMode:'rubber'};await store.setState(key,p);
    await server.applyAction(room,host,'attack',{tigerId:target.id});p=await store.getState(key);assert(p.encounterReactions[target.id]);
    now+=800;let a=await server.buildSnapshot(await server.readSession(room.code),host.id),b=await server.buildSnapshot(await server.readSession(room.code),mate.id);
    const ta=a.tigers.find(t=>t.id===target.id),tb=b.tigers.find(t=>t.id===target.id);assert(ta.encounterRetreating);assert.equal(ta.x,tb.x);assert.equal(ta.y,tb.y);assert.equal(ta.behaviorIntent.key,'retreating');assert.equal(ta.lethalWounded,false);
    room=await server.applyAction(await server.readSession(room.code),host,'pause',{reason:'shop'});now+=5000;
    const paused=(await server.buildSnapshot(await server.readSession(room.code),host.id)).tigers.find(t=>t.id===target.id);assert.equal(paused.x,ta.x);assert.equal(paused.y,ta.y);
    room=await server.applyAction(await server.readSession(room.code),host,'resume');assert.equal(room.encounterRunAt,runAt);
    const resumed=(await server.buildSnapshot(room,host.id)).tigers.find(t=>t.id===target.id);assert.equal(resumed.x,ta.x);assert.equal(resumed.y,ta.y);
    p=await store.getState(key);await store.setState(key,{...p,x:resumed.x,y:resumed.y,tigerDamage:{...p.tigerDamage,[target.id]:Math.round(target.hpMax*.76)}});
    await server.applyAction(room,host,'capture',{tigerId:target.id});a=await server.buildSnapshot(room,host.id);b=await server.buildSnapshot(room,mate.id);
    assert(a.capturedIds.includes(target.id));assert(b.capturedIds.includes(target.id));assert(!a.tigers.find(t=>t.id===target.id).encounterRetreating);
    await assert.rejects(()=>server.applyAction(room,mate,'capture',{tigerId:target.id}),/already|cleared/i);
    now+=1;const ended=await store.getState(`live_squad_session_${room.code}`);await store.setState(`live_squad_session_${room.code}`,{...ended,status:'failed',failureReason:'squad_wipe',completedAt:now});
    room=await server.applyAction(await server.readSession(room.code),host,'restart');assert.notEqual(room.encounterRunAt,runAt);assert.deepEqual((await store.getState(key)).encounterReactions,{});
  }finally{Date.now=original;}
});
test('legacy active rooms retain the original patrol until a mission restart',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const host={id:983623,first_name:'Legacy Host'},mate={id:983624,first_name:'Legacy Mate'};
  let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');
  const key=`live_squad_session_${room.code}`,raw=await store.getState(key);delete raw.encounterVersion;delete raw.encounterRunAt;await store.setState(key,raw);
  room=await server.readSession(room.code);assert.equal(room.encounterVersion,0);const snap=await server.buildSnapshot(room,host.id);assert(snap.tigers.every(t=>!t.encounterGuarding&&!t.encounterRetreating));
  await store.setState(key,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:Date.now()});room=await server.readSession(room.code);
  room=await server.applyAction(room,host,'restart');assert.equal(room.encounterVersion,2);
});
