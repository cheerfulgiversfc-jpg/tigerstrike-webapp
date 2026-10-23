const test=require('node:test'),assert=require('node:assert/strict');
const wardrobe=require('./mastery-rewards'),debrief=require('./mission-debrief');
const uniforms=wardrobe.CATALOG.filter(r=>r.slot==='uniform'&&r.target>0);
function clear(state,level,scope='solo',extra={}){return debrief.record(state,{id:`${scope}:${level}`,scope,missionKey:`chapter-test:${level}`,campaignLevel:level,mode:'Story',completed:true,civilianTotal:0,captures:0,kills:1,...extra}).state;}
function chapter(chapter,scope='solo',skip=0){let state={};for(let n=chapter*10-9;n<=chapter*10;n++)if(n!==skip)state=clear(state,n,scope);return state;}
test('ten uniforms cover chapters 1–10 exactly once, with seven new unique palettes',()=>{
  assert.equal(uniforms.length,10);assert.deepEqual(uniforms.map(r=>r.chapter),[1,2,3,4,5,6,7,8,9,10]);
  assert.equal(new Set(uniforms.map(r=>r.id)).size,10);assert.equal(new Set(uniforms.map(r=>wardrobe.uniformPalette(r.id).body)).size,10);
  for(const row of uniforms.slice(3)){assert.equal(row.metric,'chapter');assert.equal(row.target,10);assert(row.requirement.includes(`Chapter ${row.chapter}`));assert(row.requirement.includes(`${row.chapter*10-9}–${row.chapter*10}`));}
});
test('every new chapter uniform requires every mission in that specific chapter, not any ten clears',()=>{
  for(const row of uniforms.slice(3)){
    const full=chapter(row.chapter);assert(wardrobe.rewards(full,'solo').find(r=>r.id===row.id).unlocked);
    for(let missing=row.chapter*10-9;missing<=row.chapter*10;missing++){
      let state=chapter(row.chapter,'solo',missing);
      state=clear(state,missing===row.chapter*10?row.chapter*10-1:row.chapter*10,'solo',{id:`repeat:${missing}`,missionKey:`alias:${missing}`});
      const item=wardrobe.rewards(state,'solo').find(r=>r.id===row.id);
      assert.equal(item.progress,9);assert(!item.unlocked,'replaying an already completed mission cannot replace a different missing mission');assert.throws(()=>wardrobe.equip(state,'solo',row.id),/locked/);
    }
    assert(!wardrobe.rewards(chapter(1),'solo').find(r=>r.id===row.id).unlocked);
    assert(!wardrobe.rewards(full,'coop').find(r=>r.id===row.id).unlocked);
  }
});
test('legacy early unlocks remain valid and chapters 1–3 offer an alternative without requiring medals',()=>{
  const early=clear({},1,'solo',{civilianTotal:2,rescued:2,captures:1,kills:0});
  assert(wardrobe.rewards(early,'solo').find(r=>r.id==='jungle-ranger').unlocked);
  const original=uniforms.slice(0,3);
  assert.deepEqual(original.map(r=>[r.metric,r.target]),[['clears',1],['rescues',3],['captures',5]]);
  for(const row of original){const state=chapter(row.chapter);assert(wardrobe.rewards(state,'solo').find(r=>r.id===row.id).unlocked);assert(wardrobe.lockerHtml(state,'solo').includes(`Alternatively, record clears on all 10 missions in Chapter ${row.chapter}`));}
});
test('all chapter uniforms survive save, history trimming and removal without affecting older cosmetics',()=>{
  let state={};for(let n=1;n<=100;n++)state=clear(state,n);
  state=wardrobe.equip(state,'solo','first-responder');state=wardrobe.equip(state,'solo','ancient-guardian');
  state=debrief.normalize(JSON.parse(JSON.stringify(state)));assert.equal(state.masteryEarned.solo.length,13);
  state=debrief.normalize({...state,records:{}});assert(uniforms.every(r=>wardrobe.rewards(state,'solo').find(item=>item.id===r.id).unlocked));
  assert.equal(wardrobe.identity(state,'solo').uniform.id,'ancient-guardian');state=wardrobe.equip(state,'solo','none-uniform');assert.equal(wardrobe.identity(state,'solo').title.id,'first-responder');
  assert.equal(wardrobe.rewards(state,'coop').filter(r=>r.target>0&&r.unlocked).length,0);
});
test('unlocks and failed attempts do not invent chapter clears; locker and locked preview show accurate requirements',()=>{
  let state={unlockedStoryLevel:100,storyLastMission:100};
  state=clear(state,100,'solo',{completed:false});assert.equal(wardrobe.chapterProgress(state,'solo')[9],0);
  assert(!wardrobe.rewards(state,'solo').find(r=>r.id==='ancient-guardian').unlocked);
  const html=wardrobe.lockerHtml(chapter(10,'solo',99),'solo');assert(html.includes('Chapter 10 • Missions 91–100 • 9/10 recorded clears'));assert(html.includes('Locked 9/10'));
  const preview=wardrobe.previewHtml({},'coop','ancient-guardian');assert(preview.includes('data-uniform-id="ancient-guardian"'));assert(preview.includes('Locked preview — not equipped'));assert(preview.includes('Chapter 10 (Missions 91–100)'));
});
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
test('server only equips earned chapter uniforms for that player and shares them on reconnect',async()=>{
  const host={id:9813301,first_name:'Village'},mate={id:9813302,first_name:'Ancient'};
  for(const [user,c] of [[host,4],[mate,10]]){const p=await squad.readCoopProfile(user);p.missionDebriefs=chapter(c,'coop');p.unlockedStoryLevel=100;await squad.writeCoopProfile(p,user);}
  await assert.rejects(()=>squad.equipCoopMasteryReward(host,'ancient-guardian'),/locked/);
  const before=JSON.stringify(await store.getState(`live_squad_profile_v1_${mate.id}`));
  await squad.equipCoopMasteryReward(host,'village-sentinel');await squad.equipCoopMasteryReward(mate,'ancient-guardian');assert.equal(JSON.stringify(await store.getState(`live_squad_profile_v1_${mate.id}`)),before);
  let room=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await squad.joinSession(room.code,mate);
  const snap=await squad.buildSnapshot(await squad.readSession(room.code),host.id);
  assert.equal(snap.players.find(p=>p.userId===host.id).masteryIdentity.uniform.id,'village-sentinel');assert.equal(snap.players.find(p=>p.userId===mate.id).masteryIdentity.uniform.id,'ancient-guardian');
});
