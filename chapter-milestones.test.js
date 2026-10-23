const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('./chapter-milestones'),debrief=require('./mission-debrief'),rewards=require('./mastery-rewards');
const run=(level,scope='solo',extra={})=>({id:`${scope}:${level}`,scope,missionKey:`Story:${level}`,campaignLevel:level,mode:'Story',title:`Mission ${level}`,completed:true,durationMs:90000,civilianTotal:2,rescued:2,kills:0,captures:1,...extra});
function records(levels,scope='solo'){let state={};for(const level of levels)state=debrief.record(state,run(level,scope)).state;return state;}
test('chapter trophies require all ten distinct recorded clears and trigger on the actual final missing mission',()=>{
  let state=records([1,2,3,4,5,6,7,8,10]);assert.deepEqual(state.milestones.solo.trophies,[]);
  state=debrief.record(state,run(1,'solo',{id:'repeat',missionKey:'alias:1'})).state;assert.deepEqual(state.milestones.solo.trophies,[]);
  const final=debrief.record(state,run(9));assert.deepEqual(final.state.lastChanges.newChapters,[1]);assert.deepEqual(final.state.milestones.solo.trophies,[1]);
  assert.deepEqual(final.state.milestones.coop.trophies,[]);
  const duplicate=debrief.record(final.state,run(9));assert.equal(duplicate.applied,false);assert.equal(duplicate.state.records['solo:Story:9'].clears,1);
  const replay=debrief.record(final.state,run(9,'solo',{id:'replay'}));assert.deepEqual(replay.state.lastChanges.newChapters,[]);
});
test('legacy migration preserves verified chapter clears without invented medals or fresh celebrations',()=>{
  const state=records(Array.from({length:10},(_,i)=>i+11));
  const old=debrief.normalize({records:state.records,storyLastMission:100});assert.deepEqual(old.milestones.solo.trophies,[2]);assert.equal(old.lastChanges.newChapters,undefined);
  const unverified=debrief.normalize({storyLastMission:100,unlockedStoryLevel:100});assert.deepEqual(unverified.milestones.solo.trophies,[]);
  const archived=debrief.normalize({...state,records:{}});assert.deepEqual(archived.milestones.solo.trophies,[2]);assert.deepEqual(archived.milestones.coop.trophies,[]);
  assert.deepEqual(api.normalize({solo:{trophies:[0,1,1,11,'2'],bossCaptureRecorded:'yes'}}).solo,{trophies:[1],bossCaptureRecorded:false});
});
test('all ten chapters award separately; failed runs and other modes cannot create Story trophies',()=>{
  let state={};for(let n=1;n<=100;n++)state=debrief.record(state,run(n)).state;
  assert.deepEqual(state.milestones.solo.trophies,[1,2,3,4,5,6,7,8,9,10]);
  assert.deepEqual(state.lastChanges.newChapters,[10]);
  const failed=debrief.record({},run(10,'solo',{completed:false}));assert.deepEqual(failed.state.milestones.solo.trophies,[]);
  let arcade={};for(let n=1;n<=10;n++)arcade=debrief.record(arcade,run(n,'solo',{mode:'Arcade'})).state;assert.deepEqual(arcade.milestones.solo.trophies,[]);
});
test('highlights require real outcomes, known timing improvement and explicit boss capture evidence',()=>{
  let state=debrief.record({},run(10)).state;assert(!state.lastChanges.highlights.includes('First recorded boss capture'));assert(!state.lastChanges.highlights.includes('New fastest recorded clear'));
  state=debrief.record(state,run(10,'solo',{id:'boss',bossCaptures:1,durationMs:80000})).state;
  assert(state.lastChanges.highlights.includes('First recorded boss capture'));assert(state.lastChanges.highlights.includes('New fastest recorded clear'));assert(state.lastChanges.highlights.some(s=>s.includes('Everyone home')));
  state=debrief.record(state,run(10,'solo',{id:'slower',bossCaptures:1,durationMs:85000,civilianLost:1,rescued:1})).state;assert.deepEqual(state.lastChanges.highlights,[]);
  state=debrief.record(debrief.normalize(JSON.parse(JSON.stringify(state))),run(20,'solo',{bossCaptures:1})).state;assert(!state.lastChanges.highlights.includes('First recorded boss capture'));
  const unknown=debrief.record({},run(1,'solo',{durationMs:null})).state;assert(!debrief.record(unknown,run(1,'solo',{id:'first-timed'})).state.lastChanges.highlights.includes('New fastest recorded clear'));
});
test('results and trophy shelf escape content, show exact next steps and recognition-only replays',()=>{
  let state=records([1,2,3,4,5,6,7,8,9]);state=debrief.record(state,run(10)).state;
  const report=debrief.html(state.last,state);assert(report.includes('Skip celebration'));assert(report.includes('Watch again'));assert(report.includes('Chapter 1 secured'));
  const shelf=api.hubHtml(state,'solo',11,rewards);assert(shelf.includes('Next available Story mission: 11'));assert(shelf.includes('View chapter trophies'));assert(shelf.includes('future chapter; first unlock Mission 31'));
  assert(shelf.includes('no extra payout'));assert.equal((shelf.match(/data-chapter-celebration=/g)||[]).length,1);
  const unsafe={...state,lastChanges:{...state.lastChanges,highlights:['<img onerror=evil>']}};assert(!debrief.html(state.last,unsafe).includes('<img'));
  assert(!api.hubHtml(state,'solo',100,rewards).includes('mission: 101'));
});
test('celebrations can skip, finish and replay without mutations, and automatic playback is not repeated',()=>{
  const originalSet=global.setTimeout,originalClear=global.clearTimeout;let finish,scheduled=0;
  try{
    global.setTimeout=callback=>{finish=callback;scheduled++;return 1;};global.clearTimeout=()=>{};
    const panel=()=>({dataset:{chapterCelebration:'test:unique-event',auto:'yes'},querySelector:()=>({getAnimations:()=>[]})});
    const first=panel();api.mount({querySelectorAll:()=>[first]});assert.equal(scheduled,1);assert.equal(first.dataset.playing,'yes');
    api.skip({closest:()=>first});assert.equal(first.dataset.finished,'yes');api.replay({closest:()=>first});assert.equal(first.dataset.finished,undefined);finish();assert.equal(first.dataset.finished,'yes');
    const second=panel(),before=scheduled;api.mount({querySelectorAll:()=>[second]});assert.equal(second.dataset.finished,'yes');assert.equal(scheduled,before);
  }finally{global.setTimeout=originalSet;global.clearTimeout=originalClear;}
});
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
test('server saves each player trophy separately and duplicate reward claims cannot award again',async()=>{
  const host={id:9813401,first_name:'Chapter Host'},mate={id:9813402,first_name:'Chapter Mate'};
  for(const [user,total] of [[host,9],[mate,8]]){const p=await squad.readCoopProfile(user);p.unlockedStoryLevel=10;p.missionDebriefs=records(Array.from({length:total},(_,i)=>i+1),'coop');await squad.writeCoopProfile(p,user);}
  let room=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:10});room=await squad.joinSession(room.code,mate);room=await squad.applyAction(room,host,'start');
  const snap=await squad.buildSnapshot(room,host.id),civs=snap.civilians.map(c=>c.id);
  for(const user of [host,mate]){const key=`live_squad_player_${room.code}_${user.id}`,p=await store.getState(key);await store.setState(key,{...p,x:snap.extraction.x,y:snap.extraction.y,hp:p.maxHp,downed:false,lastSeenAt:Date.now(),checkpointIds:snap.checkpoints.map(c=>c.id),rescuedIds:civs,securedCivilianIds:civs,capturedIds:user.id===host.id?snap.tigers.map(t=>t.id):[]});}
  const complete=await squad.buildSnapshot(room,host.id);assert.equal(complete.status,'complete');room=await squad.readSession(room.code);
  const a=await squad.claimReward(room,host),b=await squad.claimReward(room,mate);assert.deepEqual(a.profile.missionDebriefs.milestones.coop.trophies,[1]);assert.deepEqual(b.profile.missionDebriefs.milestones.coop.trophies,[]);
  assert(a.profile.missionDebriefs.last.bossCaptures>0);assert(a.profile.missionDebriefs.lastChanges.highlights.includes('First recorded boss capture'));
  const again=await squad.claimReward(room,host);assert.equal(again.profile.funds,a.profile.funds);assert.equal(again.profile.missionDebriefs.records[a.profile.missionDebriefs.last.key].clears,1);
  assert.deepEqual((await squad.buildSnapshot(await squad.readSession(room.code),host.id)).viewerProfile.missionDebriefs.milestones.coop.trophies,[1]);
});
test('scripts, HQ trophy shelf and stable Co-op results are wired into the game',()=>{
  const html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
  assert(html.indexOf('chapter-milestones.js')<html.indexOf('mission-debrief.js'));assert(game.includes('hubHtml(window.TigerMissionDebrief?.normalize(S.missionDebriefs)'));
  assert(coop.includes('if(debrief.__renderedHtml!==html)'));assert(coop.includes('function chapterShelfHtml()'));assert(game.includes('cage.tigerId&&isBossTiger(tiger)'));
});
