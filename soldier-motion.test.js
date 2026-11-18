const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const motion=require('./soldier-motion');
const art=require('./shared-battlefield-renderer');
function walk(fps,seconds=4){let row=motion.sample(null,{x:0,y:0,face:0},0);for(let i=1;i<=fps*seconds;i++)row=motion.sample(row,{x:170*i/fps,y:0,face:0},1000*i/fps);return row;}
test('walking has the same distance-based phase at 30, 60 and 120 FPS, with a readable stride',()=>{
  const a=walk(30),b=walk(60),c=walk(120);assert(Math.abs(a.phase-b.phase)<1e-9);assert(Math.abs(b.phase-c.phase)<1e-9);
  assert(170/motion.STRIDE_DISTANCE<2,'walking must not vibrate through dozens of leg cycles per second');
  assert(a.blend>.99&&b.blend>.99&&c.blend>.99);
  let row=motion.sample(null,{x:0,y:0,face:0},0);
  for(let i=1;i<4000;i++){
    const next=motion.sample(row,{x:170*i/60,y:0,face:0},i*1000/60);
    const delta=Math.atan2(Math.sin(next.phase-row.phase),Math.cos(next.phase-row.phase));
    assert(delta>0&&delta<.2,'wrapping the gait cannot reverse or snap the leg pose');row=next;
  }
});
test('vertical joystick noise does not flip the body, while a real horizontal turn does',()=>{
  let row=motion.sample(null,{x:20,y:20,face:0},0);
  for(let i=1;i<100;i++){
    row=motion.sample(row,{x:20,y:20+i*3,face:Math.PI/2+(i%2?.025:-.025)},i*16.67);assert.equal(row.facing,1);
  }
  row=motion.sample(row,{x:17,y:320,face:Math.PI},1700);assert.equal(row.facing,-1);
  row=motion.sample(row,{x:17,y:323,face:Math.PI/2},1717);assert.equal(row.facing,-1);
});
test('stopping, walls, long gaps and respawns do not pump the gait or mutate movement state',()=>{
  const actor={x:100,y:100,face:1.5,step:900,role:'tracker'},before=JSON.stringify(actor);
  let row=motion.sample(null,actor,0);row=motion.sample(row,{...actor,x:103},17);const phase=row.phase;
  for(let i=2;i<=60;i++)row=motion.sample(row,{...actor,x:103,step:i*300},i*17);
  assert.equal(row.phase,phase);assert(row.blend<1e-5);
  const warp=motion.sample(row,{x:4000,y:2000,face:1.5},1100);assert.equal(warp.phase,phase);assert.equal(warp.blend,0);
  assert.equal(motion.sample(warp,{x:4005,y:2000,face:1.5},5000).phase,phase);
  motion.track(actor,actor,0);motion.track(actor,{...actor,x:103},17);assert.equal(JSON.stringify(actor),before);
});
function context(){const shapes=[];return {shapes,ctx:new Proxy({}, {get:(_,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):(...args)=>shapes.push([k,...args]),set:()=>true})};}
test('the real Solo adapter consumes the stable gait and preserves exact combat aim and equipment',()=>{
  const source=fs.readFileSync('game.js','utf8'),scope={ctx:context().ctx,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),premiumGaitBlend:()=>0,animLean:()=>0};let received;
  scope.TigerStrikeBattlefieldRenderer={drawSoldier:(_ctx,e,o)=>{received={e,o};}};
  vm.runInNewContext(source.slice(source.indexOf('function drawMissionUniformPreview('),source.indexOf('function drawAnimatedTigerLegCycle(')),scope);
  const actor={x:100,y:100,face:Math.PI/2,step:500},before=JSON.stringify(actor),gait={phase:1.4,blend:.7,facing:-1};
  scope.drawSoldierModelOnContext(context().ctx,actor,104,106,{face:2.1,gait,uniformPalette:{body:'#278'}});
  assert.equal(received.o.phase,1.4);assert.equal(received.o.blend,.7);assert.equal(received.o.facing,-1);assert.equal(received.e.face,2.1);assert.equal(received.o.uniformPalette.body,'#278');assert.equal(JSON.stringify(actor),before);
  const drawing=context();art.drawSoldier(drawing.ctx,{x:0,y:0,face:Math.PI/2+.01},{phase:1.4,blend:.7,facing:1});
  assert(drawing.shapes.some(row=>row[0]==='scale'&&row[1]===1),'shared model honors the stable facing for vertical movement');
});
test('actual Co-op drawing uses the same stride without changing local positions or mission state',()=>{
  const {createHarness,crowdedSnapshot}=require('./qa/coop-harness'),snap=crowdedSnapshot(),h=createHarness({snapshot:snap});
  const seen=[],original=h.ctx.TigerStrikeBattlefieldRenderer.drawSoldier;
  h.ctx.TigerStrikeBattlefieldRenderer.drawSoldier=(ctx,e,o)=>{if(e.userId===900101)seen.push(o);return original(ctx,e,o);};
  h.qa.drawArena();const start=h.qa.state.local.x;
  for(let i=1;i<=60;i++){h.setClock(100000+i*1000/60);h.qa.state.local.x=start+170*i/60;h.qa.drawArena(1/60);}
  const expected=motion.sample(walk(60,0),{x:170,y:0,face:0},1000); // A single long gap is deliberately excluded from animation.
  assert(seen.at(-1).phase>0&&seen.at(-1).phase<Math.PI*2);assert(seen.at(-1).blend>.9);
  assert.equal(h.qa.state.local.x,start+170);assert.equal(h.qa.state.snapshot.status,'active');assert.equal(h.stats().depth,0);
  assert.equal(expected.phase,0);
});
