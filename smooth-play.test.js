const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const smooth=require('./smooth-play');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8'),html=fs.readFileSync('index.html','utf8');
function fn(source,name,next){const start=source.indexOf(`function ${name}(`);assert(start>=0,name);return source.slice(start,source.indexOf(`\n${next||'function '}`,start+1));}
test('graphics preferences are normalized, persisted locally and retain legacy Performance on migration',()=>{
  const storage=new Map(),ctx={module:{exports:{}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(fs.readFileSync('smooth-play.js','utf8'),ctx);const api=ctx.module.exports;
  assert.equal(api.settings('BATTERY'),'BATTERY');assert.equal(api.save('HIGH'),'HIGH');assert.equal(storage.get('tiger_graphics_mode'),'HIGH');
  assert.equal(api.normalize('PERFORMANCE'),'AUTO');assert.equal(api.normalize(null),'AUTO');
  assert.equal(api.save('BATTERY'),'BATTERY');assert.equal(api.settings(),'BATTERY');
  vm.runInNewContext(fs.readFileSync('smooth-play.js','utf8'),ctx);assert.equal(ctx.module.exports.settings(),'BATTERY');
});
test('graphics still work if local storage is blocked; quality never disables safety guards',()=>{
  const ctx={module:{exports:{}},localStorage:{getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}}};
  vm.runInNewContext(fs.readFileSync('smooth-play.js','utf8'),ctx);const api=ctx.module.exports;
  assert.equal(api.settings(),'AUTO');assert.equal(api.save('HIGH'),'HIGH');
  assert(api.policy('HIGH').preferredDetail);assert(!api.policy('HIGH',true).preferredDetail);
  assert.equal(api.policy('BATTERY').cooperativeFrameMs,1000/30);assert.equal(api.policy('AUTO').cooperativeFrameMs,0);
  const perf=fn(game,'performanceMode');assert(perf.indexOf('iphoneStabilityModeActive()')<perf.indexOf("if(preference)"));
});
test('rolling profiling is finite, bounded and independent of mission state',()=>{
  const p=smooth.createMetrics();for(let i=0;i<200;i++)p.record('draw',i);
  let row=p.report()[0];assert.equal(row.count,120);assert.equal(row.max,199);assert.equal(row.average,139.5);
  p.record('invalid',NaN);p.record('invalid',Infinity);p.record('invalid',-1);
  for(let i=0;i<200;i++)p.record(`task${i}`,i);
  assert.equal(p.report().length,96);assert(!p.report().some(row=>row.name==='invalid'));p.clear();assert.equal(p.report().length,0);
});
test('connection warnings distinguish stale and failed updates and clear on a fresh receipt',()=>{
  assert.equal(smooth.connection(1000,2500),'');assert.match(smooth.connection(1000,3100),/delayed/);
  assert.match(smooth.connection(1000,5000),/Reconnecting/);assert.match(smooth.connection(4900,5000,true),/Reconnecting/);
  assert.equal(smooth.connection(5000,5100,false),'');assert.equal(smooth.connection(undefined,5000),'');
});
test('HQ does not rebuild information twice per frame; room changes and explicit refresh bypass its gate',()=>{
  let now=1000,builds=0,quick=0;const hud={style:{},__refreshAt:0};
  const ctx={Date:{now:()=>now},document:{getElementById:()=>hud},__baseHqActive:true,__baseHqHudUntil:0,__baseHqSelectedRoom:'command',__baseHqDialogNpc:'',__baseHqDialogIndex:0,__baseHqFactOffset:0,__baseHqQuickMenuCollapsed:false,armBaseHqHudScroll(){builds++;},setBaseHqHudOpenClass(){},renderBaseHqQuickBar(){quick++;}};
  vm.createContext(ctx);vm.runInContext(fn(game,'renderBaseHqWorldHud'),ctx);
  for(let i=0;i<120;i++){now=1000+Math.floor(i/2)*16;ctx.renderBaseHqWorldHud(false);}
  assert(builds<=4);assert.equal(quick,builds);
  ctx.__baseHqSelectedRoom='mission';ctx.renderBaseHqWorldHud(false);const before=builds;
  ctx.renderBaseHqWorldHud();assert.equal(builds,before+1);
  assert.match(fn(game,'baseHqMoveTick'),/renderBaseHqWorldHud\(false\)/);
});
function frameHarness(mode='AUTO'){
  let now=0,queued,draws=0,moves=0,updates=0;const diagnostics=smooth.createMetrics();
  const ctx={state:{open:true,snapshot:{status:'active'},frame:0,lastActionUiAt:0},window:{TigerSmoothPlay:{policy:()=>smooth.policy(mode),metrics:diagnostics,connection:()=>''}},document:{hidden:false},performance:{now:()=>now},Date:{now:()=>now},requestAnimationFrame:cb=>{queued=cb;return 1;},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),updateMovement:()=>moves++,updateActionButtons:()=>updates++,$:()=>null,remoteSnapshotPlayer:()=>null,playerConnectionText:()=>'',drawArena:()=>draws++};
  vm.createContext(ctx);vm.runInContext(fn(coop,'ensureFrame','  function '),ctx);ctx.ensureFrame();
  return {ctx,step(at){now=at;queued(at);},counts:()=>({draws,moves,updates})};
}
test('Battery Saver caps only Co-op drawing; movement still receives every frame',()=>{
  const low=frameHarness('BATTERY'),auto=frameHarness();
  for(let i=1;i<=120;i++){low.step(i*1000/60);auto.step(i*1000/60);}
  assert.equal(low.counts().moves,120);assert.equal(auto.counts().moves,120);
  assert(low.counts().draws>=59&&low.counts().draws<=61);assert.equal(auto.counts().draws,120);
  assert.equal(low.counts().updates,auto.counts().updates);
});
test('hidden Co-op and gear screens skip canvas work without stopping the frame loop',()=>{
  const f=frameHarness();f.ctx.document.hidden=true;f.step(16);assert.deepEqual(f.counts(),{draws:0,moves:0,updates:0});
  f.ctx.document.hidden=false;f.ctx.state.equipmentOpen='shop';f.step(32);assert.equal(f.counts().draws,0);
  f.ctx.state.equipmentOpen='';f.step(48);assert.equal(f.counts().draws,1);
});
test('Co-op camera approaches the same position over equal time at 30 and 60 FPS',()=>{
  const expression=coop.match(/const cameraBlend=([^;]+);/)[1];
  const context={clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};vm.createContext(context);
  const progress=fps=>{let x=0;context.dt=1/fps;for(let i=0;i<fps;i++)x+=(100-x)*vm.runInContext(expression,context);return x;};
  assert(Math.abs(progress(30)-progress(60))<1e-9);
});
test('graphics uses a native top-layer dialog and input guards; no multiplayer pause or music mutation',()=>{
  assert(html.indexOf('src="./smooth-play.js')<html.indexOf('src="./game.js'));
  assert(html.includes('smooth-play.js?v=5266-chapter8-field'));
  assert.match(html,/<dialog id="smoothPlayDialog"/);assert.match(html,/<select id="graphicsMode"/);assert.match(html,/<form method="dialog">/);
  assert.match(coop,/'smooth-play':\(\)=>window.TigerSmoothPlay\?\.open\(\)/);
  assert.match(fn(game,'pollGamepadControls'),/smoothPlayDialog/);const guarded=/smoothPlayDialog'\)\?\.open(?:\s*\|\|\s*document.getElementById\('missionRouteDialog'\)\?\.open)?\)return/;assert.match(game,guarded);assert.match(coop,guarded);
  const module=fs.readFileSync('smooth-play.js','utf8');assert(!/fetch\(|setInterval\(|setTimeout\(|\.paused\s*=|\.hp\s*=|\.funds\s*=/.test(module));
});
test('paused Solo world yields the screen to live squad before any HQ or mission rendering',()=>{
  const draw=fn(game,'draw');assert(draw.indexOf('TigerLiveSquad?.isOpen()')<draw.indexOf('drawBaseHQScene'));
  assert.match(draw,/!startupLoading && S.paused && window.TigerLiveSquad\?\.isOpen\(\)/);
});
test('crowded shared scenes retain actors, water and confirmed capture feedback across all graphics preferences',()=>{
  const art=require('./shared-battlefield-renderer'),combat=require('./combat-feel');
  const actors=Object.freeze(Array.from({length:36},(_,i)=>Object.freeze({id:String(i),x:1900+i*18,y:1300+(i%6)*24,hp:100,hpMax:100,boss:i===0})));
  const original=JSON.stringify(actors),counts={};
  for(const mode of ['AUTO','BATTERY','HIGH']){
    smooth.save(mode);let depth=0,calls=0;
    const ctx=new Proxy({}, {get:(_target,key)=>{
      if(key==='globalAlpha')return 1;
      if(/create.*Gradient/.test(key))return ()=>({addColorStop(){}});
      if(key==='measureText')return text=>({width:String(text).length*7});
      return (...args)=>{calls++;for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg),`${mode}:${key}`);if(key==='save')depth++;if(key==='restore')depth--;assert(depth>=0);};
    },set:()=>true});
    const view={x:1700,y:1100,w:1200,h:760};
    art.drawStoryMapFoundation(ctx,{level:50,worldW:4800,worldH:2800,view,now:5000,weather:'storm'});
    for(const tiger of actors)art.drawTiger(ctx,tiger,{now:5000,walking:true,swimming:Number(tiger.id)%2===0});
    for(let i=0;i<20;i++)art.drawCivilian(ctx,{id:`c${i}`,x:1900+i*12,y:1280,hp:100},{now:5000,walking:true});
    for(let i=0;i<2;i++)art.drawSoldier(ctx,{id:i,x:2000+i*25,y:1350,hp:100},{now:5000,walking:true});
    const effects=combat.create();for(let i=0;i<200;i++)effects.emit({id:`capture${i}`,mode:'tranq',at:5000,x1:2000,y1:1300,x2:2100,y2:1340,captured:true},5000);
    assert.equal(effects.count(),32);effects.draw(ctx,5100,{reducedFlashes:true});assert.equal(depth,0);assert.equal(JSON.stringify(actors),original);counts[mode]=calls;
  }
  assert(counts.BATTERY<counts.AUTO,'Battery Saver reduces decorative drawing rather than actors');smooth.save('AUTO');
});
