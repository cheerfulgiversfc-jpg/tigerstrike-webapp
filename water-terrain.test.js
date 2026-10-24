const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const water=require('./water-terrain'),art=require('./shared-battlefield-renderer'),extraction=require('./extraction-geometry');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8'),html=fs.readFileSync('index.html','utf8');
function canvas(){const calls=[],data={globalAlpha:1};const ctx=new Proxy(data,{get:(o,k)=>k in o?o[k]:/create.*Gradient/.test(k)?()=>({addColorStop:()=>{}}):(...a)=>calls.push([k,...a]),set:(o,k,v)=>{o[k]=v;calls.push(['set',k,v]);return true;}});return {ctx,calls};}
test('continuous river has no district seams, closed straight bottoms or legacy oval stamps',()=>{
  for(const [w,h] of [[1200,1100],[2400,2200],[4228,2800],[9600,6200]]){
    const z=water.river(w,h,water.crossings(w,'district'));
    for(let x=0;x<=w;x+=17){const b=water.banks(z,x);assert(b.top>0&&b.bottom<h);assert(water.contains({...z,bridges:[]},x,b.center));assert(!water.contains(z,x,b.top-1));}
    for(let x=1200;x<w;x+=1200){const a=water.banks(z,x-.001),b=water.banks(z,x+.001);assert(Math.abs(a.top-b.top)<.01&&Math.abs(a.bottom-b.bottom)<.01);}
    const points=water.outline(z);assert.equal(points[0][0],0);assert(points.some(p=>p[0]===w));assert(new Set(points.map(p=>p[1].toFixed(1))).size>15);
  }
});
test('bridges are dry and swimming begins only beyond the shallows',()=>{
  const z=water.river(2400,2200,[606]),b=water.banks(z,606),dry=water.banks(z,400);
  assert(!water.contains(z,606,b.center));assert(!water.swimming([z],606,b.center));
  assert(water.swimming([z],400,dry.center));assert(!water.swimming([z],400,dry.top+1));assert(!water.contains(z,400,dry.top-1));
});
test('captured tiger cages go onto a dry bank rather than floating in deep water',()=>{
  for(const z of [water.river(2400,2200),{kind:'pond',x:300,y:400,rx:150,ry:60,rot:.4}]){
    const p=water.dryPoint([z],z.x,z.y);assert(!water.contains(z,p.x,p.y));assert(Number.isFinite(p.x+p.y));
  }
});
test('natural pond shoreline is shared by rendering and water detection without changing source records',()=>{
  const original=Object.freeze({id:'pool',label:'Capture Pool',x:300,y:400,rx:150,ry:60,rot:.4}),z=water.natural(original);
  assert.equal(z.kind,'pond');assert.equal(original.kind,undefined);
  const outline=water.outline(z);assert.equal(outline.length,48);assert(water.contains(z,z.x,z.y));
  for(const p of outline){const inside={x:z.x+(p[0]-z.x)*.98,y:z.y+(p[1]-z.y)*.98};assert(water.contains(z,inside.x,inside.y));assert(!water.contains(z,z.x+(p[0]-z.x)*1.03,z.y+(p[1]-z.y)*1.03));}
});
test('boat pickups and departures follow the continuous river and avoid bridge decks',()=>{
  for(const [w,h] of [[1200,1100],[2400,2200],[4228,2800],[9600,6200]])for(const x of [100,606,w/2,w-100]){
    const z=water.river(w,h,water.crossings(w,'district')),p=extraction.sharedStoryRiverPlacement(w,h,{x,y:100});
    assert(water.contains(z,p.x,p.y));assert(!water.onBridge(z,p.x,p.y));assert(!water.contains(z,p.shoreX,p.shoreY));
    for(const t of [0,.2,.5,1]){const d=water.boatDeparture(z,p,t),b=water.banks(z,d.x);assert(d.y>b.top&&d.y<b.bottom);assert(Number.isFinite(d.angle));}
  }
});
test('water currents and fish animate, stay clipped, and render with finite isolated canvas state',()=>{
  const z=water.river(1200,1100,[]),view={x:0,y:700,w:1200,h:400},a=canvas(),b=canvas();
  art.drawMapWater(a.ctx,z,{view,now:1000});art.drawMapWater(b.ctx,z,{view,now:2000});assert.notDeepEqual(a.calls,b.calls);
  assert(a.calls.some(c=>c[0]==='clip'));assert(a.calls.some(c=>c[0]==='ellipse'&&c[3]===5&&c[4]===1.8),'fish have small submerged silhouettes');
  for(const row of a.calls)for(const n of row.slice(1))if(typeof n==='number')assert(Number.isFinite(n));
  assert.equal(a.calls.filter(c=>c[0]==='save').length,a.calls.filter(c=>c[0]==='restore').length);
});
test('small irregular rain puddles exist only in rain or storms, never over buildings or permanent water',()=>{
  const view={x:0,y:0,w:1200,h:700};
  for(const weather of ['clear','snow','mist','dust']){const c=canvas();art.drawRainPuddles(c.ctx,view,{weather});assert.equal(c.calls.length,0);}
  for(const weather of ['rain','storm']){const c=canvas();art.drawRainPuddles(c.ctx,view,{weather,now:1000});assert(c.calls.some(c=>c[0]==='fill'));assert(!c.calls.some(c=>c[0]==='ellipse'&&c[3]>20));}
  const c=canvas();art.drawRainPuddles(c.ctx,view,{weather:'rain',blockedRects:[{x:-100,y:-100,w:1500,h:1000}]});assert.equal(c.calls.length,0);
});
test('swimming uses shared soldier, civilian and tiger art, clips submerged legs and never changes game state',()=>{
  for(const paint of [art.drawSoldier,art.drawCivilian,art.drawTiger]){
    const entity=Object.freeze({x:300,y:400,face:0,hp:80,hpMax:100,role:'player'}),before=JSON.stringify(entity),c=canvas();
    const result=paint(c.ctx,entity,{swimming:true,now:1000,scale:1});
    assert(c.calls.some(row=>row[0]==='clip'));assert(c.calls.some(row=>row[0]==='ellipse'));assert.equal(result.x,300);assert.equal(result.y,400);assert.equal(JSON.stringify(entity),before);
    assert.equal(c.calls.filter(c=>c[0]==='save').length,c.calls.filter(c=>c[0]==='restore').length);
  }
});
test('real Solo scene and physics use the same single river, painted before decorative houses and trees',()=>{
  const calls=[],renderer={...art,drawMapWater:(_c,z)=>calls.push(['water',z]),drawMapHouse:(_c,x,y,w,h)=>calls.push(['house',{x,y,w,h}]),drawMapTree:(_c,x,y,s)=>calls.push(['tree',{x:x-38*s,y:y-47*s,w:80*s,h:76*s}])};
  const scope={ctx:canvas().ctx,TigerWaterTerrain:water,TigerStrikeBattlefieldRenderer:renderer};
  vm.runInNewContext(game.slice(game.indexOf('function drawSharedStoryTree('),game.indexOf('function drawMissionMapTruthOverlay(')),scope);
  scope.drawSharedStoryDistrictFoundation(2400,2200,false,{x:0,y:1400,w:2400,h:800});
  const river=calls.find(row=>row[0]==='water')[1];assert.equal(calls.filter(row=>row[0]==='water').length,1);
  assert(calls.findIndex(row=>row[0]==='water')<calls.findIndex(row=>row[0]==='house'));
  for(const [kind,rect] of calls)if(kind!=='water')assert(!water.overlaps(river,rect),`${kind} must be on dry ground`);
  const fast=game.slice(game.indexOf('function drawMapSceneMobileFast('),game.indexOf('function drawDynamicObjectiveMarker('));assert(!fast.includes('drawMapWater?.(ctx,water,'));
});
test('both clients use the same depth check for soldier and tiger swimming, and water loads before consumers',()=>{
  assert(game.includes("fieldSwimmingAt(x,y)"));assert(coop.includes('swimming:coopSwimmingAt(tiger.x,tiger.y)'));assert(coop.includes('swimming:coopSwimmingAt(draw.x,draw.y)'));
  assert(html.indexOf('src="./water-terrain.js')<html.indexOf('src="./extraction-geometry.js'));assert(html.indexOf('src="./water-terrain.js')<html.indexOf('src="./shared-battlefield-renderer.js'));
});
