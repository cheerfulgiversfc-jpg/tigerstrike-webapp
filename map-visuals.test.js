const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const art=require('./shared-battlefield-renderer');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
function canvas(){
  const calls=[];const ctx=new Proxy({}, {get:(_,key)=>/create.*Gradient/.test(key)?(...args)=>{calls.push([key,...args]);return {addColorStop:(...values)=>calls.push(['colorStop',...values])};}:(...args)=>calls.push([key,...args]),set:()=>true});
  return {ctx,calls};
}
function solo(ctx,renderer=art){const scope={ctx,TigerStrikeBattlefieldRenderer:renderer};vm.runInNewContext(game.slice(game.indexOf('function drawSharedStoryTree('),game.indexOf('function drawMissionMapTruthOverlay(')),scope);return scope;}
test('ground texture is deterministic, world anchored and input-only',()=>{
  const view=Object.freeze({x:250,y:340,w:900,h:700}),options=Object.freeze({family:'forest'}),a=canvas(),b=canvas();
  art.drawGroundTexture(a.ctx,view,options);art.drawGroundTexture(b.ctx,view,options);
  assert.deepEqual(a.calls,b.calls);assert(a.calls.some(c=>c[0]==='lineTo'));assert(a.calls.length<8000);
  const light=canvas();art.drawGroundTexture(light.ctx,view,{heavy:true});assert(light.calls.length<a.calls.length);
});
test('shared scenery has finite geometry, isolated canvas state and lighter phone foliage',()=>{
  for(const draw of [c=>art.drawMapTree(c,160,200,1),c=>art.drawMapHouse(c,100,150,150,94,{roof:'#945a3c'}),c=>art.drawMapWater(c,{x:200,y:300,rx:160,ry:80,rot:.45}),c=>art.drawMapLighting(c,{x:100,y:200,w:900,h:700})]){
    const {ctx,calls}=canvas();draw(ctx);
    for(const [, ...args] of calls)for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg));
    assert.equal(calls.filter(c=>c[0]==='save').length,calls.filter(c=>c[0]==='restore').length);
  }
  const full=canvas(),phone=canvas();art.drawMapTree(full.ctx,0,0,1);art.drawMapTree(phone.ctx,0,0,1,{heavy:true});
  assert(phone.calls.length<full.calls.length);assert(full.calls.some(c=>c[0]==='createRadialGradient'));
});
test('water rendering preserves the exact water ellipse instead of painting water on land',()=>{
  const zone=Object.freeze({x:400,y:500,rx:185,ry:82,rot:.75}),view=Object.freeze({x:0,y:0,w:900,h:700}),c=canvas();
  art.drawMapWater(c.ctx,zone,{view});
  const ellipses=c.calls.filter(row=>row[0]==='ellipse');assert(ellipses.length>=4);
  for(const e of ellipses)assert.deepEqual(e.slice(1,6),[400,500,185,82,.75]);
  assert(c.calls.some(row=>row[0]==='clip'),'reflections must be clipped to actual water');
});
test('Solo river keeps both original shoreline curves and bridge clearance',()=>{
  const c=canvas();art.drawDistrictRiver(c.ctx,1200,2200,{view:{x:1200,y:3000,w:1200,h:350}});
  const curves=[...new Set(c.calls.filter(row=>row[0]==='bezierCurveTo').map(row=>JSON.stringify(row.slice(1))))];
  assert.deepEqual(curves,[JSON.stringify([1450,3065,1630,3235,1850,3170]),JSON.stringify([2080,3105,2215,3235,2400,3165])]);
  assert(Math.abs(art.districtShoreY(0)-930)<.02);assert(Math.abs(art.districtShoreY(650)-970)<.02);assert(Math.abs(art.districtShoreY(1200)-965)<.02);
  const reeds=c.calls.filter(row=>row[0]==='ellipse');assert(reeds.every(row=>row[1]-1200<515||row[1]-1200>700));
});
test('large Solo worlds draw only visible district scenery and avoid decorative trees in water',()=>{
  const view={x:400,y:500,w:900,h:700},small=canvas(),large=canvas();
  solo(small.ctx).drawSharedStoryDistrictFoundation(2400,2200,false,view);
  solo(large.ctx).drawSharedStoryDistrictFoundation(24000,22000,false,view);
  assert.equal(large.calls.length,small.calls.length,'world size must not multiply per-frame scenery work');
  const trees=[],spy={...art,drawMapTree:(_ctx,x,y)=>trees.push({x,y})};
  solo(canvas().ctx,spy).drawSharedStoryDistrictFoundation(2400,2200,false,{x:0,y:0,w:1200,h:1100});
  assert(trees.length>0);assert(trees.every(p=>p.y%1100+25<=art.districtShoreY(p.x%1200)));
});
test('Solo and Co-op call shared map art while keeping exact water geometry',()=>{
  for(const helper of ['drawMapTree','drawMapHouse','drawGroundTexture','drawMapWater']){
    assert(game.includes(`BattlefieldRenderer.${helper}`));assert(coop.includes(`BattlefieldRenderer.${helper}`));
  }
  const cut=(a,b)=>game.slice(game.indexOf(a),game.indexOf(b));
  const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
  assert.equal(hash(cut('function buildMapWaterZones(','function waterZoneRadii(')),'3bd66a74afe6c136f0318d79b2efcb88ca6053414ecdb809c085dfabe9187c72');
  // V12.9 intentionally repairs collider invalidation and boundary checks;
  // clear-gameplay.test.js verifies both renderer transitions at runtime.
  assert(game.includes("sharedPremiumDistrict ? 'district' : 'detailed'"));
});
test('all Co-op map families retain their roads while using the richer shared assets',()=>{
  for(const family of ['forest','suburbs','downtown','industrial']){
    const view=Object.freeze({x:0,y:0,w:900,h:700}),input=Object.freeze({family,worldW:2400,worldH:2200,view}),c=canvas();
    assert.equal(art.drawStoryMapFoundation(c.ctx,input).family,family);
    assert(c.calls.some(row=>row[0]==='setLineDash'),'road markings must remain');
    assert(c.calls.length<18000);
  }
});
test('decorative Co-op trees and homes respect actual water keepouts without touching water data',()=>{
  const zone=Object.freeze({x:1200,y:1100,rx:10000,ry:10000}),waterZones=Object.freeze([zone]),c=canvas();
  art.drawStoryMapFoundation(c.ctx,{family:'suburbs',worldW:2400,worldH:2200,view:{x:0,y:0,w:2400,h:2200},waterZones});
  assert(!c.calls.some(row=>row[0]==='colorStop'&&['#eddfba','#66a953'].includes(row[2])),'no decorative house or canopy should be planted in a water zone');
  assert.equal(zone.rx,10000);assert.equal(waterZones.length,1);
});
