const test=require('node:test'),assert=require('node:assert/strict');
for(const k of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[k]='';process.env.TS_ELITE_TEST_MEMORY='1';
const S=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store'),P=require('./waiting-practice');let uid=9916500;
async function pair(opts={}){const a={id:uid++,first_name:'Ready Host'},b={id:uid++,first_name:'Ready Mate'};let s=await S.createSession(a,{launchType:'shared-story',storyMissionLevel:1,readyCheck:true,...opts});s=await S.joinSession(s.code,b);return {a,b,s};}
async function ready(s,u,value=true){return S.applyAction(s,u,'ready',{ready:value,readyRevision:s.readyRevision});}
async function finish(s,a,b){const snap=await S.buildSnapshot(s,a.id);for(const u of [a,b]){const key=`live_squad_player_${s.code}_${u.id}`,p=await store.getState(key);await store.setState(key,{...p,lastSeenAt:Date.now(),x:snap.extraction.x,y:snap.extraction.y,checkpointIds:snap.checkpoints.map(c=>c.id),rescuedIds:snap.civilians.map(c=>c.id),securedCivilianIds:snap.civilians.map(c=>c.id),capturedIds:u.id===a.id?snap.tigers.map(t=>t.id):[]});}assert.equal((await S.buildSnapshot(s,a.id)).status,'complete');return S.readSession(s.code);}
test('new ready-check squads require consent from both connected members; client presence cannot forge it',async()=>{
 let {s,a,b}=await pair();await assert.rejects(()=>S.applyAction(s,a,'start'),/both connected/i);
 await S.updateOwnPresence(s,a,{readyRevision:s.readyRevision,ready:true});assert.equal((await S.buildSnapshot(s,a.id)).readyCount,0);
 await ready(s,a);assert.equal((await S.buildSnapshot(s,a.id)).readyCount,1);await assert.rejects(()=>S.applyAction(s,a,'start'),/both connected/i);
 await ready(s,b);assert((await S.buildSnapshot(s,a.id)).allReady);await ready(s,b,false);assert(!(await S.buildSnapshot(s,a.id)).allReady);
 await ready(s,b);await assert.rejects(()=>S.applyAction(s,b,'start'),/Only the squad leader/);s=await S.applyAction(s,a,'start');assert.equal(s.status,'active');await assert.rejects(()=>ready(s,b),/waiting squad/);
});
test('readiness resets after disconnect, role/tool/equipment changes and membership revisions',async()=>{
 let {s,a,b}=await pair();await ready(s,a);await ready(s,b);await S.updateOwnPresence(s,b,{role:'assault'});assert(!(await S.buildSnapshot(s,a.id)).allReady);await ready(s,b);
 await S.applyAction(s,b,'tool-select',{toolId:'flare'});assert(!(await S.buildSnapshot(s,a.id)).allReady);await ready(s,b);
 const p=await S.readCoopProfile(b);p.ownedWeaponIds.push('ranger_rifle');p.equippedWeaponId='ranger_rifle';await S.writeCoopProfile(p,b);assert(!(await S.buildSnapshot(s,a.id)).allReady);await ready(s,b);
 const key=`live_squad_player_${s.code}_${b.id}`,raw=await store.getState(key);await store.setState(key,{...raw,lastSeenAt:Date.now()-20000});await assert.rejects(()=>S.applyAction(s,a,'start'),/both connected/i);await S.updateOwnPresence(s,b,{});assert(!(await S.buildSnapshot(s,a.id)).allReady);
 const revision=s.readyRevision;s=await S.closeSession(s,b);const c={id:uid++,first_name:'Replacement'};s=await S.joinSession(s.code,c);assert(s.readyRevision>revision);await assert.rejects(()=>S.applyAction(s,a,'ready',{ready:true,readyRevision:revision}),/squad changed/i);assert.equal((await S.buildSnapshot(s,a.id)).readyCount,0);
});
test('continue and replay return the same squad to a fresh ready check without starting or paying again',async()=>{
 let {s,a,b}=await pair();await ready(s,a);await ready(s,b);s=await S.applyAction(s,a,'start');s=await finish(s,a,b);const r=await S.claimReward(s,a);await S.claimReward(s,b);
 const rev=s.readyRevision;s=await S.applyAction(s,a,'replay');assert.equal(s.status,'waiting');assert.equal(s.storyMissionLevel,1);assert(s.readyRevision>rev);assert.equal((await S.buildSnapshot(s,a.id)).readyCount,0);await ready(s,a);await ready(s,b);s=await S.applyAction(s,a,'start');s=await finish(s,a,b);const duplicate=await S.claimReward(s,a);await S.claimReward(s,b);assert.equal(duplicate.profile.funds,r.profile.funds);
 const code=s.code;s=await S.applyAction(s,a,'continue');assert.equal(s.status,'waiting');assert.equal(s.code,code);assert.equal(s.storyMissionLevel,2);assert.equal((await S.buildSnapshot(s,a.id)).readyCount,0);await assert.rejects(()=>S.applyAction(s,a,'start'),/both connected/i);await ready(s,a);await ready(s,b);s=await S.applyAction(s,a,'start');assert.equal(s.storyMissionLevel,2);assert.equal(s.status,'active');
});
test('a wiped squad can confirm readiness and restart with its saved elapsed time',async()=>{
 let {s,a,b}=await pair();await ready(s,a);await ready(s,b);s=await S.applyAction(s,a,'start');s={...s,startedAt:Date.now()-30000};await store.setState(`live_squad_session_${s.code}`,s);
 for(const u of [a,b]){const k=`live_squad_player_${s.code}_${u.id}`,p=await store.getState(k);await store.setState(k,{...p,hp:0,downed:true,livesRemaining:0,respawnAt:0});}
 assert.equal((await S.buildSnapshot(s,a.id)).status,'failed');s=await S.readSession(s.code);s=await S.applyAction(s,a,'restart');assert.equal(s.status,'waiting');assert.equal(s.pendingDeployment,'restart');await ready(s,a);await ready(s,b);s=await S.applyAction(s,a,'start');assert.equal(s.status,'active');assert.equal(s.missionRestarts,1);assert(s.missionElapsedMs>=30000);assert((await S.buildSnapshot(s,a.id)).players.every(p=>!p.downed&&p.hp>0));
});
test('matching skips stale hosts and lets a replacement join a public ready-check room',async()=>{
 const a={id:uid++,first_name:'Public A'},b={id:uid++,first_name:'Public B'},c={id:uid++,first_name:'Public C'};
 let s=await S.quickMatch(a,{launchType:'tiger-den',readyCheck:true});const key=`live_squad_player_${s.code}_${a.id}`,p=await store.getState(key);await store.setState(key,{...p,lastSeenAt:Date.now()-20000});let other=await S.quickMatch(b,{launchType:'tiger-den',readyCheck:true});assert.notEqual(other.code,s.code);
 let matched=await S.quickMatch(c,{launchType:'tiger-den',readyCheck:true});assert.equal(matched.code,other.code);matched=await S.closeSession(matched,c);const d={id:uid++,first_name:'Public D'};const replacement=await S.quickMatch(d,{launchType:'tiger-den',readyCheck:true});assert.equal(replacement.code,matched.code);
});
test('practice movement and shots are local, bounded and use the Co-op firing cadence',()=>{
 const p=P.create(),source={...p};P.step(p,{x:1,y:1},100);assert(Math.hypot(p.x-source.x,p.y-source.y)<=6.51);assert(P.fire(p,1000));assert(!P.fire(p,1500));assert(P.fire(p,1560));assert.equal(p.shots,2);for(let i=0;i<2000;i++)P.step(p,{x:-1,y:1},.05);assert(p.x>=55&&p.y<=285);
 const fs=require('node:fs'),code=fs.readFileSync('waiting-practice.js','utf8');assert(!code.includes('fetch('));assert(!code.includes('localStorage'));assert(code.includes('R.drawSoldier'));assert(code.includes('R.drawTiger'));assert(code.includes('cancelAnimationFrame'));assert(code.includes('removeEventListener'));
});
test('actual client Solo fallback waits for a successful leave acknowledgement and keeps the room on failure',async()=>{
 const {createHarness}=require('./qa/coop-harness');const {s,a}=await pair(),snapshot=await S.buildSnapshot(s,a.id);let selected=0,allowLeave=false;
 const h=createHarness({userId:a.id,snapshot,transport:async req=>req.action==='leave'?(allowLeave?{ok:true,left:true}:{ok:false,error:'Local leave failure'}):{ok:true,snapshot}});h.ctx.openSoloStoryMissionFromCoop=level=>{selected=level;};
 await assert.rejects(()=>h.qa.dispatchCommand('waiting-solo'),/Local leave failure/);assert.equal(h.qa.state.code,s.code);assert.equal(h.qa.state.snapshot.status,'waiting');assert.equal(selected,0);
 allowLeave=true;await h.qa.dispatchCommand('waiting-solo');assert.equal(selected,1);assert.equal(h.qa.state.code,'');assert.equal(h.qa.state.snapshot,null);assert.equal(h.requests.filter(r=>r.action==='leave').length,2);
});
test('actual client redraws leader controls after a lobby handoff rather than leaving a dead Start button',async()=>{
 const {createHarness}=require('./qa/coop-harness');const {s,a,b}=await pair(),before=await S.buildSnapshot(s,b.id);const h=createHarness({userId:b.id,snapshot:before});h.qa.render();assert(!h.element('squadBody').innerHTML.includes('id="squadStartButton"'));
 const changed={...before,serverNow:before.serverNow+1,hostId:b.id,isHost:true};h.qa.applySnapshot(changed);assert(h.element('squadBody').innerHTML.includes('id="squadStartButton"'));assert(h.element('squadBody').innerHTML.includes('Both Players Must Be Ready'));
});
test('stale presence writes cannot erase a confirmed server ready marker',async()=>{
 const {s,a}=await pair(),key=`live_squad_player_${s.code}_${a.id}`,old=await store.getState(key);await ready(s,a);await store.setState(key,old);assert.equal((await S.buildSnapshot(s,a.id)).readyCount,1);
});
test('queue slots are reclaimed after more than eight squads and ready protocols never mix',async()=>{
 for(let i=0;i<12;i++){const a={id:uid++,first_name:'Queue A'},b={id:uid++,first_name:'Queue B'};let s=await S.quickMatch(a,{launchType:'convoy-rescue',readyCheck:true});const mate=await S.quickMatch(b,{launchType:'convoy-rescue',readyCheck:true});assert.equal(mate.code,s.code);s=await S.closeSession(mate,b);await S.closeSession(s,a);}
 const a={id:uid++,first_name:'Modern'},b={id:uid++,first_name:'Older'},modern=await S.quickMatch(a,{launchType:'alpha-hunt',readyCheck:true}),legacy=await S.quickMatch(b,{launchType:'alpha-hunt'});assert.notEqual(modern.code,legacy.code);assert.equal(legacy.readyVersion,0);
 const key='local_ready_cas_'+uid;assert(await store.compareAndSetState(key,null,{code:'a'}));assert(!await store.compareAndSetState(key,null,{code:'b'}));assert(await store.compareAndSetState(key,{code:'a'},{code:'b'}));assert.deepEqual(await store.getState(key),{code:'b'});
});
test('a waiting public host refreshes its listing across a matchmaking time bucket',async()=>{
 const a={id:uid++,first_name:'Long wait'},b={id:uid++,first_name:'New arrival'},s=await S.quickMatch(a,{launchType:'storm-extraction',readyCheck:true});const original=Date.now,now=original();
 try{Date.now=()=>now+31*60*1000;await S.updateOwnPresence(s,a,{});const matched=await S.quickMatch(b,{launchType:'storm-extraction',readyCheck:true});assert.equal(matched.code,s.code);}finally{Date.now=original;}
});
