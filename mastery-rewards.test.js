const test=require('node:test'),assert=require('node:assert/strict');
const rewards=require('./mastery-rewards'),debrief=require('./mission-debrief');
function result(level=1,scope='solo',extra={}){return {id:`${scope}:${level}`,scope,missionKey:scope==='coop'?`shared-story:${level}::`:`Story:CAMPAIGN:${level}:${level}:`,campaignLevel:level,mode:'Story',completed:true,durationMs:60000,title:`Story ${level}`,civilianTotal:2,rescued:2,captures:1,kills:0,wipes:scope==='coop'?0:null,...extra};}
function cleared(count=1,scope='solo'){let state={};for(let level=1;level<=count;level++)state=debrief.record(state,result(level,scope)).state;return state;}
test('seventeen cosmetics have exact requirements without granting power or currency',()=>{
  const state=cleared(10),before=JSON.stringify(state),rows=rewards.rewards(state,'solo');
  assert.equal(rows.filter(r=>r.target>0).length,17);assert.equal(rows.filter(r=>r.target>0&&r.unlocked).length,10);
  assert.deepEqual(rewards.progress(state,'solo'),{clears:10,rescues:10,captures:10,chapters:1});
  assert.equal(JSON.stringify(state),before);
  assert(rewards.CATALOG.every(r=>!('damage' in r)&&!('cash' in r)&&!('hp' in r)));
});
test('replays and aliases for the same mission never farm distinct-mission requirements',()=>{
  let state=cleared();
  for(let i=0;i<12;i++)state=debrief.record(state,result(1,'solo',{id:`repeat${i}`,missionKey:`Story:CAMPAIGN:1:${i+100}:`})).state;
  assert.equal(rewards.progress(state,'solo').clears,1);assert.equal(rewards.progress(state,'solo').rescues,1);
  assert(!rewards.rewards(state,'solo').find(r=>r.id==='civilian-guardian').unlocked);
});
test('Solo cannot unlock Co-op rewards; incomplete chapters and unrecorded medals do not count',()=>{
  const state=cleared(9);assert.equal(rewards.progress(state,'solo').chapters,0);
  assert.equal(rewards.progress(state,'coop').clears,0);
  assert.throws(()=>rewards.equip(state,'coop','first-responder'),/locked/);
  const older=debrief.normalize({records:{'solo:Story:CAMPAIGN:1:1:':{clears:4}}});
  assert.equal(rewards.progress(older,'solo').clears,1);assert.equal(rewards.progress(older,'solo').captures,0);
  assert(!rewards.rewards(older,'solo').find(r=>r.id==='lifeline').unlocked);
});
test('locked and unknown selections reject, forged selections are not displayed',()=>{
  assert.throws(()=>rewards.equip({},'solo','wildlife-warden'),/locked/);
  assert.throws(()=>rewards.equip({},'solo','<script>'),/does not exist/);
  assert.deepEqual(rewards.identity({locker:{solo:{title:'first-responder',badge:'lifeline'}}},'solo'),{title:null,badge:null,uniform:null});
});
test('equipment persists through save, normalization, new results and unequip; other scope is preserved',()=>{
  let state=rewards.equip(cleared(),'solo','first-responder');state=rewards.equip(state,'solo','lifeline');
  state=debrief.normalize(JSON.parse(JSON.stringify(state)));
  state=debrief.record(state,result(2)).state;
  assert.equal(rewards.identity(state,'solo').title.name,'First Responder');
  assert.equal(rewards.identity(state,'solo').badge.id,'lifeline');
  const unequipped=rewards.equip(state,'solo','none-title');
  assert.equal(rewards.identity(unequipped,'solo').title,null);assert.equal(rewards.identity(unequipped,'solo').badge.id,'lifeline');
  assert.equal(rewards.identity(state,'solo').title.id,'first-responder','pure equip preserves input');
  assert.deepEqual(rewards.identity(state,'coop'),{title:null,badge:null,uniform:null});
});
test('preview is safe, visible and read-only even for locked cosmetics',()=>{
  const state=cleared(),before=JSON.stringify(state);
  const html=rewards.previewHtml(state,'solo','wildlife-warden','<img onerror=evil>');
  assert(html.includes('Locked preview — not equipped'));assert(html.includes('Wildlife Warden'));assert(!html.includes('<img'));
  assert.equal(JSON.stringify(state),before);
  const locker=rewards.lockerHtml(state,'coop');
  assert(locker.includes('data-squad-command="mastery-preview"'));assert(locker.includes('data-squad-command="mastery-equip"'));
  assert(locker.includes('Locked 0/1'));assert(locker.includes('role="status"'));
});
test('verified unlocks remain earned if older personal-best history is trimmed',()=>{
  const earned=rewards.equip(cleared(10),'solo','chapter-veteran');
  const archived=debrief.normalize({...JSON.parse(JSON.stringify(earned)),records:{}});
  assert.equal(rewards.identity(archived,'solo').title.id,'chapter-veteran');
  assert(rewards.rewards(archived,'solo').find(r=>r.id==='chapter-crest').unlocked);
  assert(!rewards.rewards(archived,'coop').find(r=>r.id==='chapter-crest').unlocked);
  const unknown=debrief.normalize({masteryEarned:{solo:['<script>','not-real']}});
  assert.equal(rewards.rewards(unknown,'solo').filter(r=>r.target>0&&r.unlocked).length,0);
});
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
test('server validates each player, persists Co-op identity and shares only verified cosmetics with teammate',async()=>{
  const host={id:9813101,first_name:'Reward Host'},mate={id:9813102,first_name:'Reward Mate'};
  await assert.rejects(()=>squad.equipCoopMasteryReward(mate,'first-responder'),/locked/);
  const profile=await squad.readCoopProfile(host);profile.missionDebriefs=cleared(1,'coop');
  await squad.writeCoopProfile(profile,host);
  const before=JSON.stringify(await store.getState(`live_squad_profile_v1_${host.id}`));
  await squad.equipCoopMasteryReward(host,'first-responder');await squad.equipCoopMasteryReward(host,'living-paw');
  assert.equal(JSON.stringify(await store.getState(`live_squad_profile_v1_${host.id}`)),before,'cosmetic writes do not rewrite supplies, rewards, or gameplay profile');
  let room=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await squad.joinSession(room.code,mate);
  await squad.updateOwnPresence(room,mate,{masteryIdentity:{title:{name:'Fake unlock'}}});
  const snap=await squad.buildSnapshot(room,mate.id),shown=snap.players.find(p=>p.userId===host.id).masteryIdentity;
  assert.equal(shown.title.id,'first-responder');assert.equal(shown.badge.id,'living-paw');
  assert.deepEqual(snap.players.find(p=>p.userId===mate.id).masteryIdentity,{title:null,badge:null,uniform:null});
  assert.equal((await squad.readCoopProfile(host)).funds,profile.funds);
  assert.equal((await squad.readCoopProfile(mate)).missionDebriefs.locker.coop.title,'');
  await squad.equipCoopMasteryReward(host,'none-title');
  const reconnect=await squad.buildSnapshot(await squad.readSession(room.code),mate.id);
  assert.equal(reconnect.players.find(p=>p.userId===host.id).masteryIdentity.title,null);
  assert.equal(reconnect.players.find(p=>p.userId===host.id).masteryIdentity.badge.id,'living-paw');
  await assert.rejects(()=>squad.equipCoopMasteryReward({},'none-title'),/identity is missing/);
});
test('cosmetic writes cannot overwrite concurrent gameplay progress',async()=>{
  const user={id:9813103,first_name:'Concurrent'};let profile=await squad.readCoopProfile(user);
  profile.missionDebriefs=cleared(1,'coop');await squad.writeCoopProfile(profile,user);
  await Promise.all([squad.equipCoopMasteryReward(user,'lifeline'),squad.writeCoopProfile({...profile,funds:8123,unlockedStoryLevel:12},user)]);
  const saved=await squad.readCoopProfile(user);assert.equal(saved.funds,8123);assert.equal(saved.unlockedStoryLevel,12);
  assert.equal(rewards.identity(saved.missionDebriefs,'coop').badge.id,'lifeline');
});
test('release loads rewards before gameplay; both identity renderers and authenticated endpoint are wired',()=>{
  const fs=require('node:fs'),html=fs.readFileSync('index.html','utf8'),game=fs.readFileSync('game.js','utf8'),client=fs.readFileSync('squad-coop.js','utf8'),route=fs.readFileSync('api/squad/session.js','utf8');
  assert(html.indexOf('mastery-rewards.js?v=5262-chapter4-field')<html.indexOf('game.js?v=5262-chapter4-field'));
  assert(game.includes('function missionMasteryRewardCommand'));assert(game.includes('const missionTitle=window.TigerMasteryRewards?.identity'));
  assert(client.includes("'mastery-equip':()=>masteryRewardCommand"));assert(client.includes('drawMasteryIdentity(ctx,p,draw.x'));
  assert(route.indexOf('validateTelegramInitData(initData, botToken)')<route.indexOf("if(action === 'mastery-equip')"));
});
