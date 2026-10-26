const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const encounters=require('./tiger-encounters'),art=require('./shared-battlefield-renderer');
const base={id:'t',x:120,y:150,hp:100,hpMax:100};
test('existing Solo identities are preserved; Co-op defaults are deterministic and shared',()=>{
  for(const key of ['Hunter','Ambusher','Sentinel','Fury'])assert.equal(encounters.profile({...base,personality:key,type:'Stalker'}).key,key);
  for(const [type,key] of [['Standard','Hunter'],['Stalker','Ambusher'],['Scout','Ambusher'],['Armored','Sentinel'],['Berserker','Fury'],['Alpha','Sentinel']]){
    assert.equal(encounters.profile({type}).key,key);assert.equal(encounters.profile({type}).key,encounters.profile({type}).key);
  }
  assert.equal(encounters.profile(null).key,'Hunter');
});
test('body language describes active decisions rather than inventing a chase, guard or sleep state',()=>{
  assert.equal(encounters.intent({...base,personality:'Ambusher',awarenessState:'stalking'},1000).key,'watching');
  assert.equal(encounters.intent({...base,huntState:'stalk',huntStateUntil:2000},1000).key,'stalking');
  assert.equal(encounters.intent({...base,huntState:'stalk',huntStateUntil:900},1000).key,'patrol');
  assert.equal(encounters.intent({...base,_ai2Behavior:'flank_player',_ai2BehaviorUntil:2000},1000).label,'FLANKING');
  assert.equal(encounters.intent({...base,intent:'Guard Wounded',intentUntil:2000},1000).key,'guarding');
  assert.equal(encounters.intent({...base,personality:'Sentinel'},1000).key,'patrol');
  assert.equal(encounters.intent({...base,huntState:'recover',huntStateUntil:2000},1000).key,'recovering');
  assert.equal(encounters.intent({...base,hp:1},1000).label,'PATROLLING');
});
test('real warning wins over personality, and interruptions or resolved tigers never prepare another strike',()=>{
  const warning={startedAt:900,resolveAt:1500},t={...base,personality:'Ambusher',tranqTagged:true,rubberSlowed:true,attackWarnings:[warning]};
  assert.equal(encounters.intent(t,1000).key,'windup');
  for(const changed of [{captured:true},{defeated:true},{hp:0},{lastRubberHitAt:950},{staggerUntil:1100},{holdUntil:1100}])assert.notEqual(encounters.intent({...t,...changed},1000).key,'windup');
  assert.notEqual(encounters.intent(t,1600).key,'windup');
  assert.equal(encounters.intent({...base,rubberSlowUntil:2000},1000).key,'slowed');
  assert.equal(encounters.intent({...base,rubberSlowUntil:900},1000).key,'patrol');
  assert.equal(encounters.intent({...base,tranqTagged:true},1000).key,'drowsy');
  assert.equal(art.tigerVisualState({...base,hp:20,rubberSlowed:true},{now:1000}).label,'WEAKENED • SLOWED');
});
test('idle personalities have distinct subtle poses while authoritative cues expire safely',()=>{
  const poses=['Hunter','Ambusher','Sentinel','Fury'].map(personality=>encounters.intent({...base,personality,awarenessState:'suspicious'},1000).pose);
  assert.equal(new Set(poses.map(JSON.stringify)).size,4);
  const server=encounters.intent({...base,awarenessState:'suspicious'},1000,{server:true});
  assert.equal(encounters.intent({...base,behaviorIntent:server},1500).key,'watching');
  assert.equal(encounters.intent({...base,behaviorIntent:server},5000).key,'patrol');
  assert.notEqual(encounters.intent({...base,behaviorIntent:{...server,key:'stalking',label:'fake chase'}},1500).key,'stalking');
});
test('shared artwork keeps poses finite, upright, balanced and simulation-only across both facings and water',()=>{
  for(const personality of ['Hunter','Ambusher','Sentinel','Fury'])for(const extra of [{},{awarenessState:'suspicious'},{huntState:'stalk',huntStateUntil:2000},{rubberSlowed:true,hp:20},{tranqTagged:true},{captured:true,hp:0},{defeated:true,hp:0}])for(const facing of [-1,1])for(const swimming of [false,true]){
    const entity=Object.freeze({...base,personality,...extra}),before=JSON.stringify(entity);let depth=0;
    const ctx=new Proxy({}, {get:(_,k)=>/create.*Gradient/.test(k)?()=>({addColorStop(){}}):(...args)=>{if(k==='save')depth++;if(k==='restore')depth--;for(const n of args)if(typeof n==='number')assert(Number.isFinite(n));},set:()=>true});
    art.drawTiger(ctx,entity,{now:1000,facing,swimming,phase:2,walking:true});assert.equal(depth,0);assert.equal(JSON.stringify(entity),before);
  }
});
test('both real memory-backed Co-op viewers receive matching authoritative personality and windup cues',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const users=[{id:983601,first_name:'Intent Host'},{id:983602,first_name:'Intent Mate'}];
  let room=await server.createSession(users[0],{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,users[1]);room=await server.applyAction(room,users[0],'start');
  const initial=await server.buildSnapshot(room,users[0].id),tiger=initial.tigers[0],key=`live_squad_player_${room.code}_${users[0].id}`;
  const p=await store.getState(key),now=Date.now();
  await store.setState(key,{...p,x:tiger.x,y:tiger.y,lastHazardAt:0,pendingTigerAttack:{tigerId:tiger.id,tigerX:tiger.x,tigerY:tiger.y,x:tiger.x,y:tiger.y,startedAt:now-100,resolveAt:now+1000,runId:`${room.code}:${room.startedAt}`}});
  const a=await server.buildSnapshot(room,users[0].id),b=await server.buildSnapshot(room,users[1].id);
  const ta=a.tigers.find(t=>t.id===tiger.id),tb=b.tigers.find(t=>t.id===tiger.id);
  assert.equal(ta.personality,tb.personality);assert.equal(ta.behaviorIntent.key,'windup');assert.equal(tb.behaviorIntent.key,'windup');assert(!('pose' in ta.behaviorIntent));
  assert.deepEqual(encounters.intent(ta,Date.now()).pose,encounters.intent(tb,Date.now()).pose);
  assert.equal(ta.hp,initial.tigers[0].hp);assert.equal(ta.hpMax,initial.tigers[0].hpMax);assert.equal(ta.lethalWounded,false);
});
test('Solo fairness limits, damage rules and Co-op attack resolution remain existing systems',()=>{
  const solo=require('./tiger-intelligence').balanceFor({playerCount:1,level:100});assert.equal(solo.maxCoordinatedAttackers,2);
  const game=fs.readFileSync('game.js','utf8');assert(game.includes('livingBalance.maxCoordinatedAttackers'));assert(game.includes('const bodyCue=window.TigerEncounters?.intent'));
  const coop=fs.readFileSync('squad-coop.js','utf8');assert(coop.includes('TigerEncounters?.posture(tiger,now)'));
});
