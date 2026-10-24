const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const awareness=require('./battlefield-awareness'),{createHarness,crowdedSnapshot}=require('./qa/coop-harness');
test('progress counts safe rather than following civilians and exact required capture IDs',()=>{
  const s={mission:{rescueRequired:2,captureRequired:1,captureTargetIds:['boss'],checkpointRequired:2},civilians:[{id:'a',following:true},{id:'b',secured:true}],capturedIds:['other'],checkpointCompletedIds:['x','x'],tigers:[{hp:20},{hp:0},{hp:0,captured:true}]};
  assert.equal(awareness.progress(s),'Safe 1/2 • Captures 0/1 • Locations 1/2 • Threats 1 left');
  s.capturedIds.push('boss');s.securedCivilianIds=['a','b','b'];s.objectivesReady=true;
  assert(awareness.progress(s).includes('Safe 2/2 • Captures 1/1'));assert(awareness.progress(s).endsWith('Extraction open'));
  s.objectivesReady=false;s.mission.survival=true;assert(!awareness.progress(s).includes('Captures'));assert(!awareness.progress(s).includes('Extraction open'));
});
test('guidance prioritizes one endangered civilian, real teammate state and the current objective',()=>{
  const player={x:500,y:500},civilians=[{id:1,x:2000,y:500,hp:100},{id:2,x:2100,y:500,secured:true},{id:3,x:2200,y:500,alive:false}];
  const targets=awareness.targets({player,civilians,tigers:[{x:2000,y:550,hp:30}],teammate:{userId:2,x:50,y:50,downed:true},objective:{id:'exit',x:4000,y:1000,action:'Reach extraction'}});
  assert.equal(targets.length,3);assert.equal(targets[0].id,1);assert.equal(targets[1].label,'TEAM • DOWN');
  const safe=awareness.targets({player,civilians,tigers:[{x:2000,y:550,hp:30,captured:true}]});assert.equal(safe.length,0);
});
test('off-screen projections work in every direction, never show visible points, and remain bounded',()=>{
  const view={x:0,y:0,w:1200,h:760},player={x:600,y:380};
  for(const mobile of [false,true])for(const docked of [false,true])for(const [x,y] of [[-500,380],[1800,380],[600,-600],[600,1800],[-500,-500],[1800,1800]]){
    const points=awareness.edges({view,player,mobile,docked,targets:[{x,y,label:'NEXT'}]});assert.equal(points.length,1);const p=points[0];assert(p.x>=0&&p.x<=1200&&p.y>=0&&p.y<=760);assert(Number.isFinite(p.angle));
  }
  assert.equal(awareness.edges({view,player,targets:[{x:1,y:1},{x:NaN,y:300}]}).length,0);
  assert.equal(awareness.edges({view:{...view,w:0},player,targets:[{x:-100,y:1}]}).length,0);
});
test('crowded edge guidance stays limited, separates labels and never mutates actors',()=>{
  const view={x:0,y:0,w:1200,h:760},player={x:600,y:380},targets=Array.from({length:50},(_,i)=>({x:2000,y:100+i*100,label:'DESTINATION',id:i})),original=JSON.stringify(targets);
  const markers=awareness.edges({view,player,targets});assert(markers.length<=3);
  for(let i=0;i<markers.length;i++)for(let j=0;j<i;j++)assert(Math.hypot(markers[i].x-markers[j].x,markers[i].y-markers[j].y)>=50);
  let depth=0;const ctx=new Proxy({}, {get:(_,k)=>(...args)=>{if(k==='save')depth++;if(k==='restore')depth--;for(const n of args)if(typeof n==='number')assert(Number.isFinite(n));},set:()=>true});
  awareness.draw(ctx,{view,player,targets});assert.equal(depth,0);assert.equal(JSON.stringify(targets),original);
});
test('layout persists per device, handles blocked storage and never edits cloud game state',()=>{
  for(const blocked of [false,true]){
    const storage=new Map(),source=fs.readFileSync('battlefield-awareness.js','utf8');let events=0;
    const ctx={module:{exports:{}},localStorage:{getItem:k=>storage.get(k),setItem(k,v){if(blocked)throw Error('blocked');storage.set(k,v);}},window:{dispatchEvent(){events++;}},Event:class{}};
    vm.runInNewContext(source,ctx);const api=ctx.module.exports;assert.equal(api.layout(),'overlay');assert.equal(api.toggleLayout(),'docked');assert.equal(api.layout(),'docked');assert.equal(events,1);
    if(!blocked){const reload={...ctx,module:{exports:{}}};vm.runInNewContext(source,reload);assert.equal(reload.module.exports.layout(),'docked');}
  }
});
test('actual Co-op client renders shared progress and clears movement on control-layout changes',()=>{
  const s=crowdedSnapshot(),h=createHarness({snapshot:s});h.qa.render();assert(h.element('squadBody').innerHTML.includes('squadMissionProgress'));
  assert(h.element('squadBody').innerHTML.includes('controls-layout'));
  const code=fs.readFileSync('squad-coop.js','utf8'),game=fs.readFileSync('game.js','utf8');assert(code.includes("'battlefield-layout-change',()=>{clearPresentationInput()"));assert(game.includes("resetControlInputState('controls-layout')"));
  const css=fs.readFileSync('battlefield-awareness.css','utf8');assert(css.includes('min-width:44px'));assert(css.includes('body.soloBattleDocked .mapStage #cv'));assert(css.includes('body.battleControlsDocked .squadControls'));
});
test('objective guidance respects extraction readiness and does not chase optional civilians after quota',()=>{
  const radio=require('./field-radio'),s={players:[{userId:1,x:0,y:0}],mission:{rescueRequired:1},civilians:[{id:1,x:50,y:50,secured:true},{id:2,x:150,y:50}],securedCivilianIds:[1],tigers:[{id:'t',hp:100,x:200,y:200}],extraction:{x:400,y:400}};
  assert.equal(radio.guide(s,1).action,'Clear tiger threat');s.objectivesReady=true;assert.equal(radio.guide(s,1).action,'Reach extraction');
});
test('Solo guidance falls back to the actual scaled required landmark during startup restoration',()=>{
  const source=fs.readFileSync('game.js','utf8'),start=source.indexOf('function fieldNextObjective(){'),end=source.indexOf('\nfunction ',start+1);
  const ctx={S:{me:{x:0,y:0},mapInteractables:[],civilians:[],tigers:[],stats:{}},missionMapTruthPending:()=>['gate'],missionMapTruthInteractables:()=>[{missionTruthId:'gate',x:900,y:400,label:'Required Gate'}],currentModeMission:()=>({}),window:{TigerPlayerExperience:require('./player-experience')}};
  vm.runInNewContext(source.slice(start,end),ctx);assert.equal(ctx.fieldNextObjective().label,'Required Gate');assert.equal(ctx.fieldNextObjective().action,'Engage mission location');
});
