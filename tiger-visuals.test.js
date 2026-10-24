const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const renderer=require('./shared-battlefield-renderer');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
function canvas(){
  const calls=[],colors=[];
  const ctx=new Proxy({}, {get:(_,name)=>name==='createLinearGradient'?()=>({addColorStop:(_at,color)=>colors.push(color)}):(...args)=>calls.push([name,...args]),set:(_,name,value)=>{if(name==='fillStyle'||name==='strokeStyle')colors.push(value);return true;}});
  return {ctx,calls,colors};
}
const base={id:'hunter',x:120,y:150,hp:100,hpMax:100};
test('Rubber-only injuries and slowing are never presented as lethal, asleep or capture guaranteed',()=>{
  for(const hp of [99,35,1]){
    const state=renderer.tigerVisualState({...base,hp,rubberSlowed:true},{now:10000});
    assert(state.slowed);assert(!state.lethal);assert(!state.asleep);assert(!state.dead);
    assert(!/LETHAL|TRANQUILIZED|CAPTURE READY/.test(state.label));
  }
  assert(renderer.tigerVisualState({...base,hp:35},{now:10000}).injured);
  assert(!renderer.tigerVisualState(base,{now:10000}).injured);
  assert(!renderer.tigerVisualState({...base,rubberSlowUntil:9999},{now:10000}).slowed);
});
test('tranq-tagged, caged tranquilized and lethal states remain distinct and truthful',()=>{
  const tagged=renderer.tigerVisualState({...base,tranqTagged:true},{now:10000});
  assert(tagged.tagged);assert.equal(tagged.label,'TRANQ TAGGED');assert(!tagged.asleep);
  const caged=renderer.tigerVisualState({...base,hp:0,captured:true,defeated:true,awarenessState:'attacking'},{now:10000});
  assert(caged.asleep);assert(!caged.dead);assert(!caged.aggressive);assert.equal(caged.label,'TRANQUILIZED');
  const lethal=renderer.tigerVisualState({...base,hp:20,lethalWounded:true,tranqTagged:true},{now:10000});
  assert(lethal.lethal);assert(lethal.label.startsWith('LETHAL WOUND'));assert(!/CAPTURE READY/.test(lethal.label));
  assert.equal(renderer.tigerVisualState({...base,hp:0,carcass:true},{now:10000}).label,'DEAD');
});
test('pounce windup, leap and landing follow real timestamps and Rubber interruption',()=>{
  const attack={startedAt:1000,resolveAt:2000};
  assert(renderer.tigerVisualState(base,{now:1500,attack}).warning);
  const leap=renderer.tigerVisualState(base,{now:2210,attack});
  assert(leap.pouncing);assert.equal(leap.pounceProgress,.5);
  assert(!renderer.tigerVisualState(base,{now:2450,attack}).pouncing);
  const interrupted=renderer.tigerVisualState({...base,lastRubberHitAt:1501},{now:2210,attack});
  assert(!interrupted.warning);assert(!interrupted.pouncing);
  assert(!renderer.tigerVisualState({...base,captured:true},{now:2210,attack}).pouncing);
  assert(!renderer.tigerVisualState({...base,hp:0},{now:1500,attack}).warning);
});
test('aggression presentation reads actual awareness instead of inventing new difficulty',()=>{
  for(const awarenessState of ['attacking','blood_frenzy'])assert(renderer.tigerVisualState({...base,awarenessState},{now:10000}).aggressive);
  for(const awarenessState of ['calm','suspicious','stalking'])assert(!renderer.tigerVisualState({...base,awarenessState},{now:10000}).aggressive);
});
test('idle and captured tigers never tread in place; running and pouncing have distinct geometry',()=>{
  const draw=(entity,options)=>{const c=canvas();renderer.drawTiger(c.ctx,entity,{now:10000,...options});return c.calls;};
  assert.deepEqual(draw(base,{phase:0}),draw(base,{phase:2}));
  assert.deepEqual(draw({...base,captured:true},{walking:true,phase:0}),draw({...base,captured:true},{walking:true,phase:2}));
  assert.notDeepEqual(draw(base,{walking:true,phase:.7}),draw(base,{walking:true,phase:2}));
  assert.notDeepEqual(draw(base,{walking:true,phase:.7}),draw(base,{walking:true,running:true,phase:.7}));
  assert.notDeepEqual(draw(base,{}),draw(base,{pouncing:true}));
});
test('every visual state preserves simulation, balances canvas transforms and remains finite',()=>{
  for(const entity of [base,{...base,hp:10},{...base,tranqTagged:true},{...base,rubberSlowed:true},{...base,captured:true,hp:0},{...base,awarenessState:'blood_frenzy'},{...base,type:'Armored',boss:true}])for(const facing of [-1,1]){
    const before=JSON.stringify(entity),c=canvas();renderer.drawTiger(c.ctx,entity,{walking:true,phase:1.3,facing,now:10000});
    assert.equal(JSON.stringify(entity),before);
    for(const row of c.calls)for(const arg of row.slice(1))if(typeof arg==='number')assert(Number.isFinite(arg));
    assert.equal(c.calls.filter(r=>r[0]==='save').length,c.calls.filter(r=>r[0]==='restore').length);
    assert(!c.calls.some(r=>r[0]==='setLineDash'),'do not bring back oval target markers');
    assert(c.calls.filter(r=>r[0]==='clip').length===1,'fur and stripes are clipped to the coat');
    assert(c.calls.length<650,'bounded drawing work rather than particle or texture loops');
  }
});
test('Solo adapter delegates to the shared tiger artwork without modifying entities or stats',()=>{
  const actual=canvas(),expected=canvas();
  const scope={ctx:actual.ctx,TigerStrikeBattlefieldRenderer:renderer,isBossTiger:t=>!!t.boss};
  vm.runInNewContext(game.slice(game.indexOf('function drawSharedMissionTiger('),game.indexOf('function drawRealisticTigerModel(')),scope);
  const entity={...base,vx:3,vy:0,step:.5,heading:Math.PI,drawDir:-1};
  const before=JSON.stringify(entity),colors={body:'#e89432',belly:'#ffedc9',stripe:'#242b2b'};
  scope.drawSharedMissionTiger(entity,120,150,1,colors,{},10000);
  renderer.drawTiger(expected.ctx,{...entity,boss:false},{facing:-1,scale:1,palette:colors,now:10000,walking:true,running:true,phase:.5*2.18});
  assert.deepEqual(actual.calls,expected.calls);assert.equal(JSON.stringify(entity),before);
});
test('Solo and Co-op cages use the same resting tiger and retain existing cage bars',()=>{
  const soloCage=game.slice(game.indexOf('function drawCaptureCage('),game.indexOf('function drawDangerMarker('));
  const coopCage=coop.slice(coop.indexOf('function drawTigerCage('),coop.indexOf('function drawSquadTransportMovie('));
  for(const source of [soloCage,coopCage]){assert(source.includes('BattlefieldRenderer.drawTiger'));assert(source.includes('captured:true'));assert(source.includes('showState:false'));assert(source.includes('TRANSPORT PENDING'));assert(source.includes('strokeRect'));}
  assert(coop.includes('facing:visualFacing'));assert(coop.includes('if(Math.abs(dx)>.05)prior.facing=dx<0?-1:1'));
});
test('Co-op smooths tiger artwork between packets without moving authoritative targets or replaying old attacks',()=>{
  let frameAt=1000;const frames=[],c=canvas();
  const state={walkVisual:new Map(),snapshotReceivedAt:1000,snapshot:{code:'TEST',startedAt:1000,players:[]}};
  const scope={state,performance:{now:()=>frameAt},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),window:{TigerStrikeBattlefieldRenderer:{drawTiger:(_ctx,t,opts)=>{frames.push({x:t.x,...opts});return {labelY:0,barY:0};}}},roundRect:()=>{}};
  vm.runInNewContext(coop.slice(coop.indexOf('function drawStoryTiger('),coop.indexOf('function drawTigerCarcass(')),scope);
  const target=Object.freeze({...base,hp:100,hpMax:100});scope.drawStoryTiger(c.ctx,target,1000);
  const next=Object.freeze({...target,x:160});frameAt+=16;scope.drawStoryTiger(c.ctx,next,1016);
  const first=frames.at(-1).x;assert(first>120&&first<160);assert(frames.at(-1).walking);
  frameAt+=16;scope.drawStoryTiger(c.ctx,next,1032);assert(frames.at(-1).x>first);assert(frames.at(-1).walking);
  assert.equal(next.x,160);assert.equal(state.snapshot.players.length,0);
  state.snapshot.startedAt=2000;frameAt=2000;scope.drawStoryTiger(c.ctx,next,2000);
  assert.equal(frames.at(-1).x,160);assert.equal(frames.at(-1).phase,0);assert.equal(frames.at(-1).attack,null);
});
