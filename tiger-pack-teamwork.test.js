const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const encounters=require('./tiger-encounters'),art=require('./shared-battlefield-renderer');
const player={userId:1,x:500,y:500},world={width:4800,height:2800};
const tigers=[{id:'a',x:700,y:500,hp:100,hpMax:100,type:'Standard',alive:true},{id:'b',x:700,y:580,hp:100,hpMax:100,type:'Scout',alive:true}];
test('one shared pack decision announces exactly one approach and one lateral circling step',()=>{
  const plans=encounters.packPlans(tigers,[player],1000,{world});
  assert.equal(plans.length,2);assert.deepEqual(plans.map(p=>p.kind),['approach','circle']);
  assert.deepEqual(plans,encounters.packPlans([...tigers].reverse(),[player],1000,{world}));
  const lead=plans[0],flank=plans[1];assert.equal(lead.until-lead.at,3000);assert.equal(lead.cooldownUntil-lead.at,12000);
  assert.equal(lead.goal.x,684);const toward={x:player.x-tigers[1].x,y:player.y-tigers[1].y};assert(Math.abs(flank.dx*toward.x+flank.dy*toward.y)<1e-8);
  for(const p of plans)assert(Math.hypot(p.goal.x-tigers.find(t=>t.id===p.id).x,p.goal.y-tigers.find(t=>t.id===p.id).y)<=24+1e-8);
});
test('pack preparation has a full second lead-in, smooth bounded offsets, an open side and no stacking',()=>{
  const plans=encounters.packPlans(tigers,[player],1000,{world});
  for(const plan of plans){
    const tiger=tigers.find(t=>t.id===plan.id);let previous=tiger;
    for(let at=1000;at<=4000;at+=10){const p=encounters.packPoint(tiger,plan,at,world);if(at<=2000)assert.equal(p.x,tiger.x);assert(Math.hypot(p.x-tiger.x,p.y-tiger.y)<=24+1e-8);assert(Math.hypot(p.x-previous.x,p.y-previous.y)<.5);previous=p;}
    assert.equal(encounters.packPoint(tiger,plan,4000,world).packRole,'');
  }
  assert.deepEqual(encounters.packPlans(tigers.map(t=>({...t,encounterCooldownUntil:13000})),[player],4000,{world}),[]);
  const solo=encounters.fieldPlan({...tigers[0],_encounterMotion:plans[0]},player,1500,{previous:plans[0]});assert(solo.waiting);assert.equal(solo.goal.x,684);
  assert.equal(encounters.fieldPlan(tigers[0],player,2200,{previous:solo}).goal.x,684,'holding must preserve the real movement goal');
});
test('required capture, Survival, active engagement, low health and civilians prevent new pack maneuvers',()=>{
  for(const options of [{survival:true},{requiredCapture:true},{engaged:true},{lockedId:'a'},{civilians:[{x:700,y:500,alive:true}]}])assert.deepEqual(encounters.packPlans(tigers,[player],1000,{world,...options}),[]);
  for(const patch of [{hp:35},{boss:true},{tranqTagged:true},{rubberSlowed:true},{holdUntil:2000},{attackWarnings:[{resolveAt:2000}]},{faction:'government'}])assert.deepEqual(encounters.packPlans([{...tigers[0],...patch},tigers[1]],[player],1000,{world}),[]);
  assert.deepEqual(encounters.packPlans(tigers.map((t,i)=>({...t,packId:i+1})),[player],1000,{world}),[]);
  assert.equal(encounters.fieldPlan({...tigers[0],hp:35},player,2200,{previous:encounters.packPlans(tigers,[player],1000,{world})[0]}),null);
  assert.equal(require('./tiger-intelligence').balanceFor({playerCount:1,level:100}).maxCoordinatedAttackers,2);
});
test('pack cues yield to attack warnings, Rubber, tranquilizers and confirmed capture',()=>{
  const t={...tigers[1],encounterPackRole:'circle',encounterPackUntil:4000};assert.equal(encounters.intent(t,1500).key,'circling');
  assert.equal(encounters.intent({...t,attackWarnings:[{startedAt:1000,resolveAt:2000}]},1500).key,'windup');
  assert.equal(encounters.intent({...t,rubberSlowed:true},1500).key,'slowed');assert.equal(encounters.intent({...t,tranqTagged:true},1500).key,'drowsy');
  assert.equal(encounters.intent({...t,captured:true},1500).label,'TRANQUILIZED');assert.notEqual(encounters.intent(t,5000).key,'circling');
});
test('territory clues use real living home anchors, stay bounded and render underneath scenery',()=>{
  const view={x:0,y:0,w:1000,h:800},rows=tigers.map((t,i)=>({...t,baseX:200+i*200,baseY:250}));
  assert.equal(art.territorySites(rows,view).length,2);assert.equal(art.territorySites([...rows,{...rows[0],baseX:220}],view).length,2);
  assert.equal(art.territorySites(rows.map(t=>({...t,captured:true})),view).length,0);assert.equal(art.territorySites([{...rows[0],baseX:5000}],view).length,0);
  let depth=0,operations=0;const ctx=new Proxy({}, {get:(_,key)=>/create.*Gradient/.test(key)?()=>({addColorStop(){}}):(...args)=>{operations++;if(key==='save')depth++;if(key==='restore')depth--;for(const n of args)if(typeof n==='number')assert(Number.isFinite(n));},set:()=>true});
  for(const family of ['forest','suburbs','downtown','industrial'])art.drawStoryMapFoundation(ctx,{family,worldW:4800,worldH:2800,view,tigers:rows,now:1000});
  assert.equal(depth,0);assert(operations<20000);const src=fs.readFileSync('shared-battlefield-renderer.js','utf8'),foundation=src.slice(src.indexOf('function drawStoryMapFoundation'));
  assert(foundation.indexOf('drawTerritoryClues(')<foundation.indexOf('drawMapWater(ctx'));
  assert(foundation.indexOf('drawTerritoryClues(')<foundation.indexOf('if(family==='));
});
test('real Co-op presence shares the pair and its mission clock across pause, reconnect and restart',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const original=Date.now;let now=1800000100000;Date.now=()=>now;
  try{
    const host={id:983921,first_name:'Pack Host'},mate={id:983922,first_name:'Pack Mate'};
    let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:49});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');assert.equal(room.packVersion,1);
    let initial=await server.buildSnapshot(room,host.id),point=null;
    for(let y=900;y<1900&&!point;y+=30)for(let x=1700;x<2600;x+=30)if(encounters.packPlans(initial.tigers,[{x,y,userId:host.id}],0,{world:initial.world,civilians:initial.civilians}).length){point={x,y};break;}
    assert(point,'actual mission 49 has an eligible pack encounter');
    const key=`live_squad_player_${room.code}_${host.id}`;let p=await store.getState(key);await store.setState(key,{...p,...point});
    await server.updateOwnPresence(room,host,{});p=await store.getState(key);assert.equal(Object.values(p.encounterReactions).filter(r=>r.kind).length,2);
    now+=2000;let a=await server.buildSnapshot(room,host.id),b=await server.buildSnapshot(room,mate.id),pair=a.tigers.filter(t=>t.encounterPackRole);assert.equal(pair.length,2);
    for(const t of pair){const other=b.tigers.find(v=>v.id===t.id);assert.equal(t.x,other.x);assert.equal(t.y,other.y);assert.equal(t.hp,initial.tigers.find(v=>v.id===t.id).hp);assert.equal(t.attackWarnings.length,0);}
    room=await server.applyAction(room,host,'pause',{reason:'shop'});now+=5000;
    a=await server.buildSnapshot(await server.readSession(room.code),mate.id);for(const t of pair)assert.equal(a.tigers.find(v=>v.id===t.id).x,t.x);
    room=await server.applyAction(await server.readSession(room.code),host,'resume');a=await server.buildSnapshot(room,host.id);for(const t of pair)assert.equal(a.tigers.find(v=>v.id===t.id).x,t.x);
    now+=1100;a=await server.buildSnapshot(room,host.id);assert(a.tigers.every(t=>!t.encounterPackRole));
    const raw=await store.getState(`live_squad_session_${room.code}`);await store.setState(`live_squad_session_${room.code}`,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:now});
    room=await server.applyAction(await server.readSession(room.code),host,'restart');assert.deepEqual((await store.getState(key)).encounterReactions,{});
    const legacy=await store.getState(`live_squad_session_${room.code}`);delete legacy.packVersion;await store.setState(`live_squad_session_${room.code}`,legacy);room=await server.readSession(room.code);assert.equal(room.packVersion,0);
    initial=await server.buildSnapshot(room,host.id);p=await store.getState(key);await store.setState(key,{...p,...point});await server.updateOwnPresence(room,host,{});assert.deepEqual((await store.getState(key)).encounterReactions,{});
  }finally{Date.now=original;}
});
