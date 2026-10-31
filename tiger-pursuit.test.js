const test=require('node:test'),assert=require('node:assert/strict');
const pursuit=require('./tiger-pursuit'),cues=require('./tiger-encounters');
const tiger={id:'a',x:500,y:500,hp:100,hpMax:100,alive:true},player={userId:1,x:720,y:500},options={allowStart:true,runAt:1,world:{width:4800,height:2800}};
test('the shared pursuit module loads before Solo and uses the release cache key',()=>{
  const fs=require('node:fs'),html=fs.readFileSync('index.html','utf8');assert(html.includes('tiger-pursuit.js?v=5270-elite-armory'));assert(html.indexOf('tiger-pursuit.js?')<html.indexOf('game.js?'));
});
test('pursuit warns, follows last sighting for a fixed duration, searches and returns without teleporting',()=>{
  let t={...tiger},s=null;const phases=new Set();let home;
  for(let at=0;at<=18000;at+=100){
    if(s){const p=pursuit.frame(s,at);assert(Math.hypot(p.x-t.x,p.y-t.y)<=5.01);t={...t,...p};}
    s=pursuit.step(t,s,[player],at,{...options,allowStart:at===0});assert(s);phases.add(s.phase);home=s.home;
    assert(Math.hypot(t.x-home.x,t.y-home.y)<=240.01);if(at<1000)assert.equal(t.x,500);
    if(at>=8000)assert.notEqual(s.phase,'pursuit');
  }
  for(const phase of ['warn','pursuit','search','regroup','rest'])assert(phases.has(phase));assert(Math.hypot(t.x-500,t.y-500)<8);
});
test('lost contact and Smoke stop tracking the moving soldier; cooldown prevents endless re-engagement',()=>{
  let s=pursuit.step(tiger,null,[player],0,options);s=pursuit.step(tiger,s,[player],1000,options);
  const t={...tiger,...pursuit.frame(s,1500)};
  s=pursuit.step(t,s,[{...player,x:1500}],2100,options);assert.equal(s.phase,'search');assert.equal(s.lastKnown.x,720);
  const smoked=pursuit.step(t,pursuit.step(tiger,null,[player],0,options),[player],1200,{...options,smokes:[{...player,until:9000}]});assert.equal(smoked.phase,'search');assert.equal(smoked.lastKnown.x,t.x);
  const resting={...smoked,phase:'rest',phaseUntil:12000,cooldownUntil:12000};assert.equal(pursuit.step(t,resting,[player],5000,options).phase,'rest');
});
test('capture, bosses, Survival, engagement and existing warnings are protected; state and artwork expire safely',()=>{
  for(const patch of [{hp:35},{boss:true},{type:'Alpha'},{captured:true},{tranqTagged:true},{rubberSlowed:true},{attackWarnings:[{}]}])assert.equal(pursuit.step({...tiger,...patch},null,[player],0,options),null);
  for(const patch of [{engaged:true},{requiredCapture:true},{survival:true},{lockedId:'a'},{shortResponse:true}])assert.equal(pursuit.step(tiger,null,[player],0,{...options,...patch}),null);
  const state=pursuit.step(tiger,null,[player],0,options);assert(pursuit.normalize(state));assert.equal(pursuit.normalize({...state,deadline:999999}),null);assert.equal(pursuit.normalize({...state,goal:{x:NaN,y:1}}),null);
  assert.equal(pursuit.step({...tiger,hp:35},state,[player],1500,options).phase,'held');
  assert.equal(cues.intent({...tiger,pursuitPhase:'pursuit',pursuitUntil:3000},2000).label,'PURSUING');assert.notEqual(cues.intent({...tiger,pursuitPhase:'pursuit',pursuitUntil:3000},5000).label,'PURSUING');
  assert.equal(cues.intent({...tiger,pursuitPhase:'pursuit',pursuitUntil:3000,attackWarnings:[{startedAt:1000,resolveAt:3000}]},2000).key,'windup');
});
test('regrouping handles blocked or timed-out paths without teleporting or looping forever',()=>{
  let state=pursuit.step(tiger,null,[player],0,options);state={...state,phase:'regroup',phaseUntil:5000,home:{x:100,y:500}};
  const blocked=pursuit.step(tiger,state,[],1000,{...options,blocked:true});assert.equal(blocked.phase,'rest');assert.equal(blocked.goal.x,500);
  assert.equal(pursuit.step(tiger,state,[],6000,options).phase,'rest');
});
test('actual Co-op pursuit shares continuous positions, Smoke escape, pause/reconnect, low-health capture and restart',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const original=Date.now;let now=1800000300000;Date.now=()=>now;
  try{
    const host={id:983961,first_name:'Pursuit Host'},mate={id:983962,first_name:'Pursuit Mate'};
    let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');assert.equal(room.pursuitVersion,1);
    now+=5000;const initial=await server.buildSnapshot(room,host.id),t=initial.tigers[0],key=`live_squad_player_${room.code}_${host.id}`,mateKey=`live_squad_player_${room.code}_${mate.id}`;
    let p=await store.getState(key);await store.setState(key,{...p,x:t.x-220,y:t.y});await server.updateOwnPresence(room,host,{});
    let a=await server.buildSnapshot(room,host.id);assert.equal(a.tigers[0].pursuitPhase,'warn');assert.equal(a.tigers[0].x,t.x);
    now+=1000;await server.updateOwnPresence(room,host,{});now+=500;
    a=await server.buildSnapshot(room,host.id);let b=await server.buildSnapshot(room,mate.id),moving=a.tigers[0];assert.equal(moving.pursuitPhase,'pursuit');assert(moving.x<t.x);assert.equal(moving.x,b.tigers[0].x);
    room=await server.applyAction(room,host,'pause',{reason:'shop'});now+=5000;a=await server.buildSnapshot(await server.readSession(room.code),mate.id);assert.equal(a.tigers[0].x,moving.x);
    room=await server.applyAction(await server.readSession(room.code),host,'resume');assert.equal((await server.buildSnapshot(room,mate.id)).tigers[0].x,moving.x);
    await server.applyAction(room,host,'tool-use');a=await server.buildSnapshot(room,mate.id);assert.equal(a.tigers[0].pursuitPhase,'search');assert.equal(a.tigers[0].x,moving.x);
    now+=2100;await server.updateOwnPresence(room,host,{});a=await server.buildSnapshot(room,host.id);assert.equal(a.tigers[0].pursuitPhase,'regroup');
    for(let i=0;i<10;i++){now+=500;await server.updateOwnPresence(room,host,{});}a=await server.buildSnapshot(room,mate.id);assert.equal(a.tigers[0].pursuitPhase,'rest');assert(Math.abs(a.tigers[0].x-t.x)<8);
    p=await store.getState(key);await store.setState(key,{...p,x:a.tigers[0].x,y:a.tigers[0].y,tigerDamage:{[t.id]:Math.round(t.hpMax*.76)}});
    await server.applyAction(room,host,'capture',{tigerId:t.id});a=await server.buildSnapshot(room,host.id);b=await server.buildSnapshot(room,mate.id);assert(a.capturedIds.includes(t.id));assert(b.capturedIds.includes(t.id));assert(!a.tigers[0].pursuitPhase);
    const raw=await store.getState(`live_squad_session_${room.code}`);await store.setState(`live_squad_session_${room.code}`,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:now});room=await server.applyAction(await server.readSession(room.code),host,'restart');assert.deepEqual((await store.getState(key)).pursuits,{});assert.deepEqual((await store.getState(mateKey)).pursuits,{});
    const legacy=await store.getState(`live_squad_session_${room.code}`);delete legacy.pursuitVersion;await store.setState(`live_squad_session_${room.code}`,legacy);assert.equal((await server.readSession(room.code)).pursuitVersion,0);
  }finally{Date.now=original;}
});
test('concurrent phone presence cannot allocate more than two authoritative pursuers',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const original=Date.now;let now=1800000400000;Date.now=()=>now;
  try{
    const host={id:983963},mate={id:983964};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:49});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');now+=5000;
    const snap=await server.buildSnapshot(room,host.id),keys=[host,mate].map(u=>`live_squad_player_${room.code}_${u.id}`);
    for(const [i,key] of keys.entries()){const p=await store.getState(key),t=snap.tigers[i?snap.tigers.length-1:0];await store.setState(key,{...p,x:t.x-220,y:t.y});}
    await Promise.all([server.updateOwnPresence(room,host,{}),server.updateOwnPresence(room,mate,{})]);
    const records=await Promise.all(keys.map(key=>store.getState(key))),ids=new Set(records.flatMap(p=>Object.keys(p.pursuits)));assert(ids.size>0);assert(ids.size<=2);
    const a=await server.buildSnapshot(room,host.id),b=await server.buildSnapshot(room,mate.id);assert.deepEqual(a.tigers.map(t=>[t.id,t.x,t.y]),b.tigers.map(t=>[t.id,t.x,t.y]));
  }finally{Date.now=original;}
});
