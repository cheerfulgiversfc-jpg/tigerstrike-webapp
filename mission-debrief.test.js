const test=require('node:test'),assert=require('node:assert/strict');
const debrief=require('./mission-debrief');
const run=(extra={})=>({id:'run:1',scope:'solo',missionKey:'Story:1',title:'Story Mission 1',mode:'Story',completed:true,durationMs:90000,civilianTotal:2,rescued:2,captures:2,kills:0,reward:{cash:1800},rewardState:'awarded',...extra});
test('personal bests are separate by scope and mission, update only on real improvements, and dedupe runs',()=>{
  let result=debrief.record({},run());
  assert(result.changes.first);assert.equal(result.state.records['solo:Story:1'].clears,1);
  const duplicate=debrief.record(result.state,run());assert.equal(duplicate.applied,false);
  result=debrief.record(result.state,run({id:'run:2',durationMs:80000}));assert(result.changes.faster);
  result=debrief.record(result.state,run({id:'run:3',durationMs:80000}));assert.equal(result.changes.faster,false);
  result=debrief.record(result.state,run({id:'coop:1',scope:'coop',durationMs:60000}));
  assert.equal(result.state.records['coop:Story:1'].fastestMs,60000);assert.equal(result.state.records['solo:Story:1'].fastestMs,80000);
  assert.equal(debrief.record(result.state,run({id:'failed',completed:false})).applied,false);
});
test('unknown legacy times cannot become a fake fastest clear and lower rescues cannot replace a best',()=>{
  let result=debrief.record({},run({durationMs:null,rescued:1}));
  assert.equal(result.state.records['solo:Story:1'].fastestMs,null);
  result=debrief.record(result.state,run({id:'new',durationMs:100000,rescued:2}));
  assert(result.changes.faster&&result.changes.betterRescue);
  result=debrief.record(result.state,run({id:'lower',durationMs:120000,rescued:0}));
  assert.equal(result.state.records['solo:Story:1'].bestRescued,2);
});
test('medals require actual outcomes and never invent legacy wipe history or Survival captures',()=>{
  assert.deepEqual(debrief.medals(debrief.summary(run())),['Everyone Home','Wildlife Guardian']);
  assert(debrief.medals(debrief.summary(run({scope:'coop',wipes:0}))).includes('No Squad Wipe'));
  assert(!debrief.medals(debrief.summary(run({scope:'coop',wipes:null}))).includes('No Squad Wipe'));
  assert(!debrief.medals(debrief.summary(run({scope:'coop',wipes:1}))).includes('No Squad Wipe'));
  assert(!debrief.medals(debrief.summary(run({mode:'Survival'}))).includes('Wildlife Guardian'));
  assert.deepEqual(debrief.medals(debrief.summary(run({completed:false}))),[]);
});
test('active clocks exclude pauses and persisted stopped clocks exclude offline time',()=>{
  let clock=debrief.clock(null,1000,true);clock=debrief.clock(clock,3000,false);
  assert.equal(clock.elapsedMs,2000);clock=debrief.clock(clock,9000,true);
  assert.equal(clock.elapsedMs,2000);clock=debrief.clock(clock,10000,false);
  const restored=debrief.clock(JSON.parse(JSON.stringify(clock)),999999,false);
  assert.equal(restored.elapsedMs,3000);
});
test('debrief rendering escapes names and shows pending, paid and duplicate reward states accurately',()=>{
  const result=debrief.record({},run({title:'<img src=x onerror=bad()>',contributions:[{name:'<script>bad</script>',recruited:0}]}));
  const html=debrief.html(result.run,result.state);assert(!html.includes('<script>'));assert(html.includes('&lt;script&gt;'));assert(html.includes('1 clear'));
  assert(debrief.html(run({rewardState:'pending'}),{}).includes('Reward pending claim'));
  assert(debrief.html(run({rewardState:'already-claimed'}),{}).includes('No additional payout'));
  assert(debrief.html(run({completed:false}),{}).includes('no completion reward'));
});
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
let uid=9812000;
async function createRoom(){
  const host={id:uid++,first_name:'Debrief Host'},mate={id:uid++,first_name:'Debrief Mate'};
  let s=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:1});
  s=await squad.joinSession(s.code,mate);s=await squad.applyAction(s,host,'start');return {s,host,mate};
}
async function finishRoom(s,host,mate,duration=60000){
  s={...await squad.readSession(s.code),startedAt:Date.now()-duration};
  await store.setState(`live_squad_session_${s.code}`,s);
  const snap=await squad.buildSnapshot(s,host.id),civs=snap.civilians.map(c=>c.id),tigers=snap.tigers.map(t=>t.id);
  for(const user of [host,mate]){
    const key=`live_squad_player_${s.code}_${user.id}`,p=await store.getState(key);
    await store.setState(key,{...p,x:snap.extraction.x,y:snap.extraction.y,hp:p.maxHp,downed:false,lastSeenAt:Date.now(),checkpointIds:snap.checkpoints.map(c=>c.id),rescuedIds:civs,securedCivilianIds:civs,capturedIds:user.id===host.id?tigers:[],debriefRecruitIds:user.id===host.id?civs:[]});
  }
  const final=await squad.buildSnapshot(s,host.id);assert.equal(final.status,'complete');
  return squad.readSession(s.code);
}
test('both players retain separate bests; repeated claims and practice replay never pay twice',async()=>{
  let {s,host,mate}=await createRoom();s=await finishRoom(s,host,mate);
  const pending=await squad.buildSnapshot(s,host.id);assert.equal(pending.debrief.rewardState,'pending');
  await assert.rejects(()=>squad.applyAction(s,host,'replay'),/claim the result/);
  const first=await squad.claimReward(s,host);await squad.claimReward(s,mate);
  const reconnected=await squad.joinSession(s.code,host),restored=await squad.buildSnapshot(reconnected,host.id);
  assert.equal(restored.debrief.rewardState,'awarded');assert.equal(restored.debrief.id,first.profile.missionDebriefs.last.id);
  const key=first.profile.missionDebriefs.last.key,best=first.profile.missionDebriefs.records[key];
  assert(best.fastestMs>=60000);assert.equal(best.clears,1);
  assert.equal(best.campaignLevel,1);assert(best.medals.includes('Everyone Home'));
  assert.equal(first.profile.missionDebriefs.last.contributions.reduce((n,p)=>n+p.recruited,0),pending.civilians.length,'following ownership is not mistaken for fresh recruitment');
  const again=await squad.claimReward(s,host);assert.equal(again.profile.funds,first.profile.funds);assert.equal(again.profile.missionDebriefs.records[key].clears,1);
  const mateProfile=await squad.readCoopProfile(mate);assert.equal(mateProfile.missionDebriefs.records[key].clears,1);
  assert.equal(mateProfile.missionDebriefs.records[key].campaignLevel,1);assert.deepEqual(mateProfile.missionDebriefs.records[key].medals,best.medals);
  s=await squad.applyAction(await squad.readSession(s.code),host,'replay');assert.equal(s.storyMissionLevel,1);assert.equal(s.memberIds.length,2);
  s=await finishRoom(s,host,mate,45000);
  const replay=await squad.claimReward(s,host);await squad.claimReward(s,mate);
  assert.equal(replay.firstClaim,false);assert.equal(replay.profile.funds,first.profile.funds);
  assert.equal(replay.profile.missionDebriefs.records[key].clears,2);assert(replay.profile.missionDebriefs.records[key].fastestMs<best.fastestMs);
  assert.equal(replay.profile.missionDebriefs.last.rewardState,'already-claimed');
  s=await squad.applyAction(await squad.readSession(s.code),host,'continue');assert.equal(s.storyMissionLevel,2);assert.equal(s.memberIds.length,2);
});
test('squad-wipe restarts preserve failed-attempt time and cannot earn a no-wipe medal',async()=>{
  let {s,host,mate}=await createRoom();s={...s,startedAt:Date.now()-30000};await store.setState(`live_squad_session_${s.code}`,s);
  for(const user of [host,mate]){const key=`live_squad_player_${s.code}_${user.id}`,p=await store.getState(key);await store.setState(key,{...p,hp:0,downed:true,livesRemaining:0,respawnAt:0});}
  const failed=await squad.buildSnapshot(s,host.id);assert.equal(failed.status,'failed');
  s=await squad.applyAction(await squad.readSession(s.code),host,'restart');assert.equal(s.missionWipes,1);assert(s.missionElapsedMs>=30000);
  s=await finishRoom(s,host,mate,45000);const result=await squad.claimReward(s,host);
  const report=result.profile.missionDebriefs.last;assert(report.durationMs>=75000);assert.equal(report.restarts,1);assert(!debrief.medals(report).includes('No Squad Wipe'));
});
test('older rooms never get a fabricated fastest time or zero-wipe medal',async()=>{
  let {s,host,mate}=await createRoom();s=await finishRoom(s,host,mate);
  s={...s,debriefVersion:0};await store.setState(`live_squad_session_${s.code}`,s);
  const result=await squad.claimReward(s,host),report=result.profile.missionDebriefs.last;
  assert.equal(report.durationMs,null);assert.equal(report.wipes,null);
  assert(!debrief.medals(report).includes('No Squad Wipe'));
});
