const test=require('node:test'),assert=require('node:assert/strict');
const cues=require('./tiger-encounters');
const tiger={id:'a',type:'Standard',x:600,y:500,hp:100,hpMax:100,alive:true},noise={x:400,y:500,at:1000,source:'gunshot'},world={width:4800,height:2800};
test('verified recent gunshots attract one eligible tiger toward the recorded location, not a moving soldier',()=>{
  const plans=cues.investigationPlans([tiger,{...tiger,id:'b',x:650}],[noise],1200,{world});assert.equal(plans.length,1);assert.equal(plans[0].id,'a');assert.equal(plans[0].goal.x,536);assert.equal(plans[0].goal.y,500);
  assert.equal(plans[0].until,7200);assert.equal(plans[0].cooldownUntil,15200);
  assert.deepEqual(cues.investigationPlans([tiger],[{...noise,source:'footsteps'}],1200,{world}),[]);
  assert.deepEqual(cues.investigationPlans([tiger],[noise],6000,{world}),[]);
  assert.deepEqual(cues.investigationPlans([tiger],[{...noise,at:2000}],1200,{world}),[]);
  assert.deepEqual(cues.investigationPlans([tiger],[{...noise,expiresAt:1100}],1200,{world}),[]);
});
test('investigation preparation and smoke return are continuous, bounded and stop without a teleport',()=>{
  const plan=cues.investigationPlans([tiger],[noise],1200,{world})[0];let previous=tiger;
  for(let at=1200;at<=7200;at+=10){const p=cues.investigationPoint(tiger,plan,at,world);if(at<=1800)assert.equal(p.x,tiger.x);assert(Math.hypot(p.x-tiger.x,p.y-tiger.y)<=64+1e-8);assert(Math.hypot(p.x-previous.x,p.y-previous.y)<.5);previous=p;}
  const breakAt=3900,before=cues.investigationPoint(tiger,plan,breakAt,world),broken=cues.investigationPoint(tiger,plan,breakAt,world,breakAt);assert.equal(broken.x,before.x);assert(broken.searching);assert(!broken.investigating);
  previous=broken;for(let at=breakAt;at<=breakAt+600;at+=10){const p=cues.investigationPoint(tiger,plan,at,world,breakAt);assert(Math.abs(p.x-previous.x)<2);previous=p;}assert.equal(previous.x,tiger.x);
  assert.equal(cues.investigationPoint(tiger,plan,breakAt+1200,world,breakAt).searching,false);
});
test('sound lures preserve capture, Survival and engagement rules and cannot steer toward civilians',()=>{
  for(const option of [{engaged:true},{survival:true},{requiredCapture:true},{lockedId:'a'},{smokes:[{x:400,y:500,until:9000}]},{civilians:[{x:460,y:500,alive:true}]}])assert.deepEqual(cues.investigationPlans([tiger],[noise],1200,{world,...option}),[]);
  for(const patch of [{hp:35},{boss:true},{tranqTagged:true},{rubberSlowed:true},{holdUntil:2000},{attackWarnings:[{}]},{faction:'government'},{encounterCooldownUntil:9000}])assert.deepEqual(cues.investigationPlans([{...tiger,...patch}],[noise],1200,{world}),[]);
  assert.equal(cues.investigationPlans([tiger],[noise],1200,{world,civilians:[{x:660,y:500,alive:true}]}).length,1,'moving away from an endangered civilian is allowed');
});
test('Solo keeps the original sound goal, stops at it and visibly loses the trail in smoke',()=>{
  const plan=cues.investigationPlans([tiger],[noise],1200,{world})[0],player={x:800,y:800};
  const preparing=cues.fieldPlan(tiger,player,1500,{previous:plan});assert(preparing.waiting);assert.equal(preparing.goal.x,536);
  const moving=cues.fieldPlan(tiger,player,2500,{previous:preparing});assert(!moving.waiting);assert.equal(moving.goal.x,536);
  assert(cues.fieldPlan({...tiger,x:536},player,2600,{previous:moving}).waiting);
  const search=cues.fieldPlan(tiger,player,3000,{previous:moving,smokes:[{x:400,y:500,until:9000}]});assert.equal(search.kind,'search');assert(search.waiting);
  assert.equal(cues.intent({...tiger,_encounterMotion:search},3100).label,'LOST THE TRAIL');
  assert.equal(cues.intent({...tiger,_encounterMotion:moving},3100).label,'INVESTIGATING SOUND');
  assert.equal(cues.intent({...tiger,_encounterMotion:moving,attackWarnings:[{startedAt:3000,resolveAt:4000}]},3100).key,'windup');
  assert.equal(cues.intent({...tiger,_encounterMotion:moving,captured:true},3100).label,'TRANQUILIZED');
  assert.notEqual(cues.intent({...tiger,encounterInvestigating:true,encounterInvestigationUntil:2000},5000).key,'investigating','stale network cues expire');
  assert.notEqual(cues.intent({...tiger,encounterSearching:true,encounterSearchUntil:2000},5000).key,'searching');
});
test('real Co-op Rubber fire, movement, smoke, pause/reconnect and restart share truthful investigation state',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');
  const original=Date.now;let now=1800000200000;Date.now=()=>now;
  try{
    const host={id:983941,first_name:'Sound Host'},mate={id:983942,first_name:'Sound Mate'};
    let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:49});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');assert.equal(room.soundVersion,1);
    const initial=await server.buildSnapshot(room,host.id);let shot=null;
    for(const target of initial.tigers.filter(t=>!t.boss)){
      for(let angle=0;angle<Math.PI*2;angle+=.25){const point={x:target.x+Math.cos(angle)*140,y:target.y+Math.sin(angle)*140};
        const plans=cues.investigationPlans(initial.tigers.map(t=>({...t,rubberSlowed:t.id===target.id})),[{...point,at:now,source:'gunshot'}],now,{world:initial.world,civilians:initial.civilians,motionAt:0});if(plans.length){shot={target,point,investigatorId:plans[0].id};break;}
      }if(shot)break;
    }
    assert(shot,'actual mission has a safe sound-investigation opportunity');
    const key=`live_squad_player_${room.code}_${host.id}`,mateKey=`live_squad_player_${room.code}_${mate.id}`;let p=await store.getState(key);await store.setState(key,{...p,...shot.point,ammoMode:'rubber'});
    await server.applyAction(room,host,'attack',{tigerId:shot.target.id});p=await store.getState(key);assert.equal(p.lastGunshotNoise.source,'gunshot');
    now+=1000;await server.updateOwnPresence(room,host,{x:shot.point.x-65,y:shot.point.y,moving:true,moveX:-1,moveY:0});
    p=await store.getState(key);assert.equal(p.lastNoiseSource,'footsteps');assert(p.encounterReactions[shot.investigatorId]?.kind==='investigate','footsteps must not overwrite the last shot location');
    now+=2700;let a=await server.buildSnapshot(room,host.id),b=await server.buildSnapshot(room,mate.id),t=a.tigers.find(t=>t.id===shot.investigatorId);assert(t.encounterInvestigating);assert.equal(t.x,b.tigers.find(v=>v.id===t.id).x);assert.equal(t.hp,initial.tigers.find(v=>v.id===t.id).hp);assert(!t.lethalWounded);
    room=await server.applyAction(room,host,'pause',{reason:'shop'});now+=5000;a=await server.buildSnapshot(await server.readSession(room.code),mate.id);assert.equal(a.tigers.find(v=>v.id===t.id).x,t.x);
    room=await server.applyAction(await server.readSession(room.code),host,'resume');a=await server.buildSnapshot(room,host.id);assert.equal(a.tigers.find(v=>v.id===t.id).x,t.x);
    const m=await store.getState(mateKey);await store.setState(mateKey,{...m,x:t.x,y:t.y});await server.applyAction(room,mate,'tool-use');
    a=await server.buildSnapshot(room,host.id);b=await server.buildSnapshot(room,mate.id);let after=a.tigers.find(v=>v.id===t.id);assert(after.encounterSearching);assert(!after.encounterInvestigating);assert.equal(after.x,t.x,'smoke cannot teleport the tiger');assert.equal(after.x,b.tigers.find(v=>v.id===t.id).x);
    now+=600;after=(await server.buildSnapshot(room,host.id)).tigers.find(v=>v.id===t.id);assert(after.encounterSearching);assert.equal(after.behaviorIntent.key,'searching');
    now+=700;after=(await server.buildSnapshot(room,host.id)).tigers.find(v=>v.id===t.id);assert(!after.encounterSearching);assert(!after.encounterInvestigating);
    const raw=await store.getState(`live_squad_session_${room.code}`);await store.setState(`live_squad_session_${room.code}`,{...raw,status:'failed',failureReason:'squad_wipe',completedAt:now});room=await server.applyAction(await server.readSession(room.code),host,'restart');
    assert.deepEqual((await store.getState(key)).encounterReactions,{});assert.deepEqual((await store.getState(mateKey)).encounterBreaks,{});assert.equal((await store.getState(key)).lastGunshotNoise,null);
  }finally{Date.now=original;}
});
