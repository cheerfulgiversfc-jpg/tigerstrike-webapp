const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const wardrobe=require('./mastery-rewards'),debrief=require('./mission-debrief'),renderer=require('./shared-battlefield-renderer');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
function clears(scope='solo',count=5){let state={};for(let n=1;n<=count;n++)state=debrief.record(state,{id:`${scope}:${n}`,scope,missionKey:`campaign:${n}`,campaignLevel:n,mode:'Story',completed:true,civilianTotal:2,rescued:2,captures:1,kills:0}).state;return state;}
function context(){
  const geometry=[],colors=[];
  const ctx=new Proxy({}, {get:(_,key)=>key==='createLinearGradient'?()=>({addColorStop:(at,color)=>colors.push(color)}):(...args)=>geometry.push([key,...args]),set:(_,key,value)=>{if(key==='fillStyle'||key==='strokeStyle')colors.push(value);return true;}});
  return {ctx,geometry,colors};
}
function soloRenderer(){
  const sandbox={clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),premiumGaitBlend:()=>0,animLean:()=>0};
  vm.runInNewContext(game.slice(game.indexOf('function drawMissionUniformPreview('),game.indexOf('function drawAnimatedTigerLegCycle(')),sandbox);
  return sandbox;
}
test('three uniforms have clear fair requirements and palettes cannot inject gameplay properties',()=>{
  const rows=wardrobe.rewards(clears(),'solo').filter(r=>r.slot==='uniform'&&r.target>0);
  assert.deepEqual(rows.map(r=>r.id),['jungle-ranger','rescue-guardian','midnight-tracker']);assert(rows.every(r=>r.unlocked));
  for(const row of rows){const palette=wardrobe.uniformPalette(row.id);assert.deepEqual(Object.keys(palette).sort(),['body','dark','helmet','light','trim','vest']);assert(Object.isFrozen(palette));}
  assert.equal(wardrobe.uniformPalette('__proto__'),null);assert.equal(wardrobe.uniformPalette('toString'),null);
  assert.throws(()=>wardrobe.equip({},'solo','jungle-ranger'),/locked/);
});
test('uniform save, reload, legacy migration, archiving and removal preserve title and badge selections',()=>{
  let state=wardrobe.equip(clears(),'solo','first-responder');state=wardrobe.equip(state,'solo','lifeline');
  const before=JSON.stringify(state);assert(wardrobe.previewHtml(state,'solo','midnight-tracker').includes('data-uniform-id="midnight-tracker"'));assert.equal(JSON.stringify(state),before);
  state=wardrobe.equip(state,'solo','midnight-tracker');state=debrief.normalize(JSON.parse(JSON.stringify(state)));
  assert.equal(wardrobe.identity(state,'solo').uniform.id,'midnight-tracker');assert.equal(wardrobe.identity(state,'coop').uniform,null);
  state=debrief.normalize({...state,records:{}});assert.equal(wardrobe.identity(state,'solo').uniform.id,'midnight-tracker');
  assert.equal(wardrobe.rewards(state,'solo').filter(r=>r.target>0&&r.unlocked).length,8);
  state=wardrobe.equip(state,'solo','none-uniform');
  assert.equal(wardrobe.identity(state,'solo').uniform,null);assert.equal(wardrobe.identity(state,'solo').title.id,'first-responder');assert.equal(wardrobe.identity(state,'solo').badge.id,'lifeline');
  const old=debrief.normalize({locker:{solo:{title:'first-responder'}},records:clears().records});assert.equal(wardrobe.identity(old,'solo').uniform,null);assert.equal(wardrobe.identity(old,'solo').title.id,'first-responder');
});
test('all ten cosmetic unlocks survive normalization rather than truncating the new uniforms',()=>{
  const state=debrief.normalize(wardrobe.remember(clears('solo',10),'solo'));
  assert.equal(state.masteryEarned.solo.length,10);
  assert(wardrobe.rewards({...state,records:{}},'solo').find(r=>r.id==='midnight-tracker').unlocked);
});
test('shared renderer changes only color, retaining geometry, player markers and movement poses',()=>{
  const entity={x:120,y:90,face:2,role:'medic'},before=JSON.stringify(entity);
  for(const mine of [true,false]){
    const standard=context(),baseline=renderer.drawSoldier(standard.ctx,entity,{mine,walking:true,phase:1.2});
    for(const id of ['jungle-ranger','rescue-guardian','midnight-tracker']){
      const alternate=context(),palette=wardrobe.uniformPalette(id),drawn=renderer.drawSoldier(alternate.ctx,entity,{mine,walking:true,phase:1.2,uniformPalette:palette});
      assert.deepEqual(alternate.geometry,standard.geometry);assert.deepEqual(drawn,baseline);assert(alternate.colors.includes(palette.body));assert(alternate.colors.includes(palette.helmet));assert(alternate.colors.includes(palette.vest));
    }
  }
  assert.equal(JSON.stringify(entity),before);
});
test('actual Solo model retains geometry and animation while using the selected body, vest and helmet colors',()=>{
  const solo=soloRenderer(),entity={id:17,face:2,step:.4},standard=context();
  solo.drawSoldierModelOnContext(standard.ctx,entity,20,30,{blend:.6});
  for(const id of ['jungle-ranger','rescue-guardian','midnight-tracker']){
    const alternate=context(),palette=wardrobe.uniformPalette(id);
    solo.drawSoldierModelOnContext(alternate.ctx,entity,20,30,{blend:.6,uniformPalette:palette});
    assert.deepEqual(alternate.geometry,standard.geometry);assert(alternate.colors.includes(palette.body));assert(alternate.colors.includes(palette.vest));assert(alternate.colors.includes(palette.helmet));
  }
});
test('preview canvases use the actual mode renderer, and paint once without a background animation loop',()=>{
  const previousSolo=globalThis.drawMissionUniformPreview,previousShared=globalThis.TigerStrikeBattlefieldRenderer,solo=soloRenderer();
  try{
    globalThis.drawMissionUniformPreview=solo.drawMissionUniformPreview;globalThis.TigerStrikeBattlefieldRenderer=renderer;
    for(const scope of ['solo','coop']){
      const drawing=context(),canvas={width:240,height:170,dataset:{uniformPreview:scope,uniformId:'rescue-guardian'},getContext:()=>drawing.ctx};
      wardrobe.paintPreviews({querySelectorAll:()=>[canvas]});assert.equal(canvas.dataset.painted,'true');assert(drawing.colors.includes(wardrobe.uniformPalette('rescue-guardian').body));
    }
  }finally{globalThis.drawMissionUniformPreview=previousSolo;globalThis.TigerStrikeBattlefieldRenderer=previousShared;}
  assert(!fs.readFileSync('mastery-rewards.js','utf8').includes('requestAnimationFrame'));
});
for(const key of ['KV_REST_API_URL','KV_REST_API_TOKEN','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'])process.env[key]='';
const squad=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
test('both players independently equip uniforms that survive reconnect and cannot be spoofed by presence packets',async()=>{
  const host={id:9813201,first_name:'Ranger'},mate={id:9813202,first_name:'Tracker'};
  for(const user of [host,mate]){const p=await squad.readCoopProfile(user);p.missionDebriefs=clears('coop');await squad.writeCoopProfile(p,user);}
  const profileBefore=JSON.stringify(await store.getState(`live_squad_profile_v1_${host.id}`));
  await squad.equipCoopMasteryReward(host,'jungle-ranger');await squad.equipCoopMasteryReward(mate,'midnight-tracker');
  assert.equal(JSON.stringify(await store.getState(`live_squad_profile_v1_${host.id}`)),profileBefore);
  let room=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await squad.joinSession(room.code,mate);room=await squad.applyAction(room,host,'start');
  await squad.updateOwnPresence(room,host,{masteryIdentity:{uniform:{id:'rescue-guardian'}},uniform:'rescue-guardian'});
  for(const viewer of [host,mate]){const snap=await squad.buildSnapshot(await squad.readSession(room.code),viewer.id);assert.equal(snap.players.find(p=>p.userId===host.id).masteryIdentity.uniform.id,'jungle-ranger');assert.equal(snap.players.find(p=>p.userId===mate.id).masteryIdentity.uniform.id,'midnight-tracker');}
  await squad.equipCoopMasteryReward(host,'none-uniform');assert.equal((await squad.readCoopProfile(host)).missionDebriefs.locker.coop.uniform,'');
  assert.equal(wardrobe.identity((await squad.readCoopProfile(mate)).missionDebriefs,'coop').uniform.id,'midnight-tracker');
  await assert.rejects(()=>squad.equipCoopMasteryReward({id:9813203},'rescue-guardian'),/locked/);
});
test('mission and fallback render paths use cosmetics without touching simulation or role colors',()=>{
  assert(game.includes('uniformPalette:palette.masteryUniform'));assert(game.includes('return drawSoldierModelOnContext(ctx,entity,x,y,opts)'));
  assert(coop.includes('uniformPalette:cloth'));assert(coop.includes('const body=cloth?.body||"#64734b"'));
  assert(fs.readFileSync('shared-battlefield-renderer.js','utf8').includes('mine?"#67e8f9":"#c4b5fd"'));
});
