const test=require('node:test'),assert=require('node:assert/strict');
const tools=require('./rescue-tools'),rescue=require('./civilian-rescue');
test('rescue tools enforce real charge limits, cooldowns and local smoke coverage',()=>{
  const original=tools.create('smoke'),used=tools.used(original,{x:50,y:50},'Cover deployed',10000);
  assert.equal(used.charges,1);assert.equal(original.charges,2);
  assert.throws(()=>tools.ready(used,11000),/recharges/);
  assert.throws(()=>tools.ready({...used,charges:0},99000),/No rescue-tool charges/);
  assert(tools.smokeAt([{rescueTool:used}],{x:100,y:50},11000));
  assert(!tools.smokeAt([{rescueTool:used}],{x:1000,y:50},11000));
  assert(!tools.smokeAt([{rescueTool:used}],{x:50,y:50},18001));
});
test('civilian reactions reflect real threats, ownership and confirmed arrivals',()=>{
  const c={x:100,y:100};
  assert.equal(rescue.reaction(c,[],1000),'Help here!');
  assert.equal(rescue.reaction({...c,following:true},[],1000),'Stay together');
  assert.equal(rescue.reaction(c,[{x:120,y:100,hp:10}],1000),'Tiger nearby!');
  assert.equal(rescue.reaction(c,[{x:120,y:100,hp:0,defeated:true}],1000),'Help here!');
  const arrival=rescue.arrival(c,{x:200,y:100},1000);
  assert.equal(rescue.reaction({...c,secured:true,rescueArrival:arrival},[],1500),'Entering safety');
  assert.equal(rescue.reaction({...c,secured:true,rescueArrival:arrival},[],4000),'Safely rescued');
});
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
let nextId=9811820;
async function roomWith(toolId,level=1){
  const host={id:nextId++,first_name:'Tool Host'},mate={id:nextId++,first_name:'Tool Partner'};
  let session=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:level});
  session=await squad.joinSession(session.code,mate);
  await squad.applyAction(session,host,'tool-select',{toolId});
  session=await squad.applyAction(session,host,'start');
  const key=`live_squad_player_${session.code}_${host.id}`;
  return {session,host,mate,key};
}
test('co-op smoke cancels a committed pounce and cannot be spammed or changed during play',async()=>{
  const {session,host,key}=await roomWith('smoke');
  const snap=await squad.buildSnapshot(session,host.id),tiger=snap.tigers[0];
  let p=await store.getState(key);
  const pending=require('./tiger-encounters').beginAttack(tiger,{...p,x:tiger.x,y:tiger.y},Date.now()-2000,false,`${session.code}:${session.startedAt}`);
  await store.setState(key,{...p,x:tiger.x,y:tiger.y,pendingTigerAttack:pending});
  await squad.applyAction(session,host,'tool-use');
  await assert.rejects(()=>squad.applyAction(session,host,'tool-use'),/recharges/);
  await assert.rejects(()=>squad.applyAction(session,host,'tool-select',{toolId:'flare'}),/before deployment/);
  await squad.updateOwnPresence(session,host,{});p=await store.getState(key);
  assert.equal(p.hp,p.maxHp);assert.equal(p.armor,100);assert.equal(p.pendingTigerAttack,null);
  assert.equal(p.rescueTool.charges,1);
});
test('co-op Med Drone heals a real nearby teammate and does not waste a charge with no target',async()=>{
  const {session,host,mate,key}=await roomWith('med-drone');
  await assert.rejects(()=>squad.applyAction(session,host,'tool-use'),/No Med Drone charge/);
  assert.equal((await store.getState(key)).rescueTool.charges,2);
  const otherKey=`live_squad_player_${session.code}_${mate.id}`,other=await store.getState(otherKey);
  await store.setState(otherKey,{...other,hp:50});
  await squad.applyAction(session,host,'tool-use');
  assert.equal((await store.getState(otherKey)).hp,88);
  const p=await store.getState(key);assert.equal(p.rescueTool.effect.healed,38);assert.equal(p.rescueTool.charges,1);
  await squad.joinSession(session.code,host);
  assert.equal((await store.getState(key)).rescueTool.charges,1,'reopening never refills tools');
});
test('co-op Med Drone resolves authored civilian injury, visible to both players',async()=>{
  const {session,host,mate,key}=await roomWith('med-drone',7);
  let snap=await squad.buildSnapshot(session,host.id);
  const c=snap.civilians[0],p=await store.getState(key);
  assert(c.injured);await store.setState(key,{...p,x:c.x,y:c.y});
  await squad.applyAction(session,host,'tool-use');
  snap=await squad.buildSnapshot(session,mate.id);
  assert.equal(snap.civilians[0].hp,100);assert.equal(snap.civilians[0].injured,false);
  assert.equal((await store.getState(key)).rescueTool.effect.healed,45);
});
test('co-op flare highlights actual next objective and extraction; paused/downed use is blocked',async()=>{
  const {session,host,key}=await roomWith('flare');
  await squad.applyAction(session,host,'pause',{reason:'shop'});
  let current=await squad.readSession(session.code);
  await assert.rejects(()=>squad.applyAction(current,host,'tool-use'),/paused/);
  current=await squad.applyAction(current,host,'resume');
  await squad.applyAction(current,host,'tool-use');
  const p=await store.getState(key),snap=await squad.buildSnapshot(current,host.id);
  assert(p.rescueTool.effect.target.action);
  assert.equal(p.rescueTool.effect.extraction.x,snap.extraction.x);
  assert.equal(p.rescueTool.charges,2);
  await store.setState(key,{...p,downed:true,hp:0,livesRemaining:0});
  await assert.rejects(()=>squad.applyAction(current,host,'tool-use'),/out of lives/);
});
test('concurrent co-op activations have one effect and consume one charge',async()=>{
  const {session,host,key}=await roomWith('flare');
  const results=await Promise.allSettled([squad.applyAction(session,host,'tool-use'),squad.applyAction(session,host,'tool-use')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await store.getState(key)).rescueTool.charges,2);
});
