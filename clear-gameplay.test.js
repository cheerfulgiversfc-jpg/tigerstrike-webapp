const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const art=require('./shared-battlefield-renderer');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
const cut=(src,a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
function canvas(){
  const calls=[],target={globalAlpha:1};
  const ctx=new Proxy(target,{get:(obj,k)=>k in obj?obj[k]:/create.*Gradient/.test(k)?()=>({addColorStop:()=>{}}):(...args)=>calls.push([k,...args]),set:(obj,k,v)=>{calls.push(['set',k,v]);obj[k]=v;return true;}});
  return {ctx,calls};
}
test('decorative clearance protects whole objective labels and cuts away near actors without mutations',()=>{
  const bounds=Object.freeze({x:100,y:100,w:150,h:100});
  const actor=Object.freeze({x:200,y:150,r:44}),objective=Object.freeze({x:275,y:80,r:86,objective:true});
  assert.equal(art.sceneryOpacity(bounds),1);
  assert.equal(art.sceneryOpacity(bounds,Object.freeze([actor])),.18);
  assert.equal(art.sceneryOpacity(bounds,Object.freeze([actor,objective])),0);
  assert.equal(art.sceneryOpacity(bounds,[{x:NaN,y:150,r:10}]),1);
  assert.equal(art.sceneryOpacity(bounds,[{x:900,y:900,r:44,objective:true}]),1);
});
test('tree canopies and whole house roofs never paint into reserved objective areas',()=>{
  for(const draw of [c=>art.drawMapTree(c,200,200,1,{clearZones:[{x:200,y:155,r:1,objective:true}]}),c=>art.drawMapHouse(c,100,200,150,94,{clearZones:[{x:175,y:175,r:1,objective:true}]})]){
    const c=canvas();draw(c.ctx);assert.equal(c.calls.length,0);
  }
  const c=canvas();art.drawMapTree(c.ctx,200,200,1,{clearZones:[{x:200,y:200,r:44}]});
  assert(c.calls.some(row=>row[0]==='set'&&row[1]==='globalAlpha'&&row[2]===.18));
});
test('Co-op decorative buildings in every chapter family respect clearance without altering roads or water',()=>{
  for(const family of ['forest','suburbs','downtown','industrial']){
    const c=canvas(),waterZones=Object.freeze([{x:400,y:600,rx:100,ry:45}]);
    const zones=Object.freeze([{x:1200,y:1100,r:10000,objective:true}]);
    art.drawStoryMapFoundation(c.ctx,Object.freeze({family,worldW:2400,worldH:2200,clearZones:zones,waterZones}));
    assert(!c.calls.some(row=>row[0]==='set'&&row[1]==='strokeStyle'&&row[2]==='#94a3b8'),'no decorative tower should cover an objective');
    assert(c.calls.some(row=>row[0]==='setLineDash'),'roads remain visible');
    assert.equal(waterZones[0].rx,100);
  }
});
test('route blocker shapes preserve gate, bridge and timed flood rules exactly',()=>{
  const state=Object.freeze({mapInteractables:Object.freeze([
    Object.freeze({kind:'gate',x:100,y:200,routeOpen:false}),Object.freeze({kind:'bridge',x:300,y:400,routeOpen:false}),
    Object.freeze({kind:'gate',x:900,y:900,routeOpen:true}),Object.freeze({kind:'barricade',x:50,y:50,routeOpen:false})]),
    missionTwists:Object.freeze({bridge:Object.freeze({active:true,x:600,y:700,r:92,until:1001}),worldEvent:Object.freeze({active:true,type:'flooded_route',x:800,y:400,r:130,until:1001})})});
  assert.deepEqual(art.routeBlockers(state,1000).map(p=>[p.x,p.y,p.r]),[[600,700,92],[100,200,48],[300,400,62],[800,400,130]]);
  assert.deepEqual(art.routeBlockers(state,1001).map(p=>p.r),[48,62]);
});
test('collision boundary artwork uses exact physics circles and rectangles, not a tiny object icon',()=>{
  for(const shape of [{x:200,y:200,r:62,label:'REPAIR BRIDGE'},{x:100,y:80,w:72,h:48}]){
    const c=canvas();art.drawCollisionBoundary(c.ctx,shape);
    assert(c.calls.some(row=>row[0]===(shape.r?'arc':'rect')&&row[1]===shape.x&&row[2]===shape.y&&row[3]===(shape.r||shape.w)));
    assert.equal(c.calls.filter(row=>row[0]==='save').length,c.calls.filter(row=>row[0]==='restore').length);
    if(shape.label)assert(c.calls.some(row=>row[0]==='fillText'&&row[1]==='REPAIR BRIDGE'));
  }
  const c=canvas();art.drawCollisionBoundary(c.ctx,{x:9000,y:9000,r:48},{view:{x:0,y:0,w:900,h:700}});assert.equal(c.calls.length,0);
});
test('objective beacons remain readable above scenery and both clients draw them after the world art',()=>{
  const c=canvas(),point=Object.freeze({x:300,y:250,label:'RESCUE SAFE HOUSE',color:'#86efac'});
  art.drawObjectiveBeacon(c.ctx,point,{x:0,y:0,w:900,h:700});
  assert(c.calls.some(row=>row[0]==='fillText'&&row[1]===point.label));
  assert(c.calls.some(row=>row[0]==='set'&&row[1]==='globalAlpha'&&row[2]===1));
  assert.equal(c.calls.filter(row=>row[0]==='save').length,c.calls.filter(row=>row[0]==='restore').length);
  assert(game.indexOf('drawSafe("drawFieldObjectiveBeacons"')>game.indexOf('drawSafe("drawSoldier"'));
  assert(coop.indexOf('const drawBeacon=')>coop.indexOf('drawNightVisibilityOverlay(ctx,snap,view)'));
});
test('lightweight Solo map paints the actual water ellipses used by movement',()=>{
  const fast=cut(game,'function drawMapSceneMobileFast(','function drawDynamicObjectiveMarker(');
  assert(fast.includes('for(const water of __mapWaterZones)'));
  assert(fast.includes('drawMapWater?.(ctx,water,'));
  assert(fast.indexOf('ensureMapObstacleCache()')<fast.indexOf('for(const water of __mapWaterZones)'));
});
function obstacleScope(mode){
  const scope={S:{mode},window:{},__mapObstacleSig:'',__mapObstacleRects:[],__mapObstacleCircles:[],__mapWaterSig:'',__mapWaterZones:[],__mapDenseLandmarks:[],__mapDenseLandmarksSig:'',__blockedAtCache:new Map(),fast:false,
    currentMap:()=>({key:'ST_FOREST'}),chapterIndexForMode:()=>1,worldWidth:()=>2400,worldHeight:()=>2200,normalizeModeName:v=>v,
    shouldUseMobileFastMapRenderer:()=>scope.fast,buildMapWaterZones:()=>[{x:700,y:800,rx:100,ry:50}],mapFamilyKey:()=> 'ST_FOREST',
    buildDenseLandmarks:()=>[{x:400,y:500,kind:'house'}],MAP_REALISM_PROPS:{},inMapScenarioKeepout:()=>false,
    addMapObstacleForLandmark:rects=>rects.push({x:384,y:488,w:32,h:24})};
  vm.runInNewContext(cut(game,'function ensureMapObstacleCache(','function mobileControlKeepoutZones('),scope);
  return scope;
}
test('Story, Arcade and Survival refresh geometry and point caches in both renderer-switch directions',()=>{
  for(const mode of ['Story','Arcade','Survival']){
    const s=obstacleScope(mode);s.ensureMapObstacleCache();assert.equal(s.__mapObstacleRects.length,1);
    s.__blockedAtCache.set('old',true);s.fast=true;s.ensureMapObstacleCache();
    assert.equal(s.__mapObstacleRects.length,0);assert.equal(s.__blockedAtCache.size,0);assert(s.__mapObstacleSig.endsWith('district'));
    assert.equal(s.__mapWaterZones[0].rx,100);
    s.__blockedAtCache.set('old',false);s.fast=false;s.ensureMapObstacleCache();
    assert.equal(s.__mapObstacleRects.length,1);assert.equal(s.__blockedAtCache.size,0);assert(s.__mapObstacleSig.endsWith('detailed'));
  }
});
test('real movement checks agree with route boundary art at both sides of the collision edge',()=>{
  const gate={kind:'gate',x:100,y:200,routeOpen:false};
  const s={S:{mapInteractables:[gate]},TigerStrikeBattlefieldRenderer:art,Date:{now:()=>1000},__blockedAtCache:new Map(),__frameBudgetState:{frameNo:1},
    __blockedAtCacheFrame:0,ensureMapObstacleCache:()=>{},dist:Math.hypot.bind(Math),blockedByMapObstacle:()=>false};
  s.dist=(x,y,a,b)=>Math.hypot(x-a,y-b);
  vm.runInNewContext(cut(game,'function blockedCacheKey(','function entityNeedsRecovery('),s);
  assert(s.blockedAt(158,200,10));assert(!s.blockedAt(158.01,200,10));
  assert.notEqual(s.blockedCacheKey(158,200,10),s.blockedCacheKey(158.01,200,10));
  gate.routeOpen=true;s.__blockedAtCache.clear();assert(!s.blockedAt(100,200,10));
  s.blockedByMapObstacle=()=>true;s.__blockedAtCache.clear();assert(s.blockedAt(100,200,10),'world walls must not depend on HUD position');
});
test('on-screen gameplay objects bypass count caps but still cull off-screen and invalid positions',()=>{
  const scope={pointInViewportPad:(x,y)=>x>=0&&x<=900&&y>=0&&y<=700};
  vm.runInNewContext(cut(game,'function visibleGameplayObjects(','function drawMapCollisionBoundaries('),scope);
  const objects=Array.from({length:40},(_,id)=>Object.freeze({id,x:id*15,y:200}));
  assert.equal(scope.visibleGameplayObjects([...objects,{x:9000,y:500},{x:NaN,y:200}]).length,40);
  assert(game.includes('const drawInteractables = visibleGameplayObjects(S.mapInteractables,propsPad)'));
  assert(game.includes('const interactablesDraw = visibleGameplayObjects(S.mapInteractables,pickupPad)'));
});
test('both actual scene adapters reserve rescue, extraction and mission-objective markers',()=>{
  const solo={missionMapTruthScaled:()=>({landmarks:[{x:400,y:450}]})};
  vm.runInNewContext(cut(game,'function mapSceneryClearZones(','function visibleGameplayObjects('),solo);
  const single=solo.mapSceneryClearZones(Object.freeze({mode:'Story',evacZone:{x:100,y:200,r:70},mapInteractables:[{x:300,y:350}],me:{x:200,y:200}}));
  assert(single.some(p=>p.x===100&&p.r===100&&p.objective));assert(single.some(p=>p.x===400&&p.objective));assert(single.some(p=>p.x===200&&!p.objective));
  const team={};vm.runInNewContext(cut(coop,'function coopSceneryClearZones(','function drawStoryTree('),team);
  const dual=team.coopSceneryClearZones(Object.freeze({extraction:{x:100,y:200,r:70},rescueHouse:{x:300,y:350},mapTruthLandmarks:[{x:400,y:450}],players:[{x:200,y:200},{x:220,y:220}]}));
  assert(dual.some(p=>p.x===100&&p.r===100&&p.objective));assert.equal(dual.filter(p=>!p.objective).length,2);
  assert(coop.includes('clearZones:sceneryClearZones'));
});
test('authored Co-op mission buildings are never removed by decorative clearance',()=>{
  const calls=[],scope={sceneryClearZones:[{x:100,y:100,r:100,objective:true}],window:{TigerStrikeBattlefieldRenderer:{drawMapHouse:(...args)=>calls.push(args)}}};
  vm.runInNewContext(cut(coop,'function drawStoryBuilding(','function drawDenCave('),scope);
  scope.drawStoryBuilding({},100,100,150,90,'#0f766e');assert.equal(calls[0][5].clearZones.length,0);
  scope.drawStoryBuilding({},100,100,150,90,'#0f766e',true);assert.equal(calls[1][5].clearZones,scope.sceneryClearZones);
});
