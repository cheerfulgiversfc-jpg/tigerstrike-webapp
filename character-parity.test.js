const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const art=require('./shared-battlefield-renderer');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
function canvas(){const calls=[],colors=[];const ctx=new Proxy({}, {get:(_,name)=>/create.*Gradient/.test(name)?()=>({addColorStop:(_n,c)=>colors.push(c)}):(...args)=>calls.push([name,...args]),set:(_,name,value)=>{if(name==='fillStyle'||name==='strokeStyle')if(typeof value==='string')colors.push(value);return true;}});return {ctx,calls,colors};}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function civilianAdapter(ctx,renderer=art){const scope={ctx,clamp,premiumGaitBlend:()=>0,TigerStrikeBattlefieldRenderer:renderer};vm.runInNewContext(game.slice(game.indexOf('function drawRealisticCivilianModel('),game.indexOf('function drawRealisticSoldierModel(')),scope);return scope;}
function soldierAdapters(scope){vm.runInNewContext(game.slice(game.indexOf('function drawRealisticSoldierModel('),game.indexOf('function drawAnimatedTigerLegCycle(')),scope);return scope;}
const people=[{id:1,look:'field'},{id:2,look:'driver',injured:true},{id:3,look:'medic',vip:true},{id:4,look:'scout',child:true},{id:5,shirt:'#c58365',pants:'#344c55',skin:'#815d44',hair:2,riskState:'critical'}];
test('Solo civilian adapter uses identical shared art for clothing, injury, children and faces',()=>{
  for(const person of people)for(const face of [0,Math.PI]){
    const entity=Object.freeze({...person,x:40,y:60,face,step:.7}),before=JSON.stringify(entity),a=canvas(),b=canvas();
    civilianAdapter(a.ctx).drawRealisticCivilianModel(entity,40,60,{blend:.6,phase:.2,now:10000});
    art.drawCivilian(b.ctx,entity,{blend:.6,phase:.7*3.1+.2,now:10000});
    assert.deepEqual(a.calls,b.calls);assert.deepEqual(a.colors,b.colors);assert.equal(JSON.stringify(entity),before);
  }
});
test('actual Co-op civilian entry point paints the same model as Solo, not a simpler substitute',()=>{
  for(const person of people){
    const model=canvas(),expected=canvas(),entity=Object.freeze({...person,x:40,y:60,face:0,step:0,name:'Civilian'});
    let sharedCalls;
    const renderer={...art,drawCivilian:(ctx,e,opts)=>{const before=model.calls.length;const r=art.drawCivilian(ctx,e,opts);sharedCalls=model.calls.slice(before);return r;}};
    const scope={window:{TigerStrikeBattlefieldRenderer:renderer},state:{snapshot:{code:'TEST',startedAt:1,tigers:[]},snapshotReceivedAt:10000,walkVisual:new Map()},performance:{now:()=>10000},viewerId:()=>1};
    scope.coopSwimmingAt=()=>false;
    vm.runInNewContext(coop.slice(coop.indexOf('function drawStoryCivilian('),coop.indexOf('function drawStoryTiger(')),scope);
    scope.drawStoryCivilian(model.ctx,entity,false);
    civilianAdapter(expected.ctx).drawRealisticCivilianModel(entity,40,60,{blend:0,now:10000});
    assert.deepEqual(sharedCalls,expected.calls);
  }
});
test('shared civilians stay upright and idle; role size and rescue ownership are presentation-only',()=>{
  for(const person of people){
    const entity=Object.freeze({...person,x:10,y:20,following:true,followingUserId:22,hp:70,hpMax:100}),before=JSON.stringify(entity),a=canvas(),b=canvas();
    art.drawCivilian(a.ctx,entity,{phase:0,now:10000});art.drawCivilian(b.ctx,entity,{phase:3,now:10000});
    assert.deepEqual(a.calls,b.calls);assert(!a.calls.some(r=>r[0]==='rotate'));
    assert.equal(a.calls.filter(r=>r[0]==='save').length,a.calls.filter(r=>r[0]==='restore').length);
    for(const row of a.calls)for(const n of row.slice(1))if(typeof n==='number')assert(Number.isFinite(n));
    assert.equal(JSON.stringify(entity),before);
  }
  const child=canvas();art.drawCivilian(child.ctx,{child:true},{now:10000});assert(child.calls.some(r=>r[0]==='scale'&&r[1]===.76&&r[2]===.76));
});
test('rescue arrival keeps the shared model and honors fading without changing the saved civilian',()=>{
  const entity=Object.freeze({id:7,x:1,y:2,secured:true,followingUserId:22,rescueArrival:{id:'arrival'}}),before=JSON.stringify(entity),c=canvas();
  const seen=[];
  const scope={window:{TigerStrikeBattlefieldRenderer:{drawCivilian:(ctx,e,opts)=>{seen.push({e,opts});return art.drawCivilian(ctx,e,opts);}},TigerCivilianRescue:{arrivalFrame:()=>({x:40,y:20,alpha:.25,done:false}),drawReaction:()=>{}}},state:{snapshot:{code:'TEST',startedAt:1,tigers:[]},snapshotReceivedAt:10000,walkVisual:new Map()},performance:{now:()=>10000},viewerId:()=>1};
  scope.coopSwimmingAt=()=>false;
  vm.runInNewContext(coop.slice(coop.indexOf('function drawStoryCivilian('),coop.indexOf('function drawStoryTiger(')),scope);scope.drawStoryCivilian(c.ctx,entity,true);
  assert.equal(seen.length,1);assert.equal(seen[0].opts.alpha,.25);assert.equal(seen[0].e.x,40);assert.equal(entity.x,1);assert.equal(JSON.stringify(entity),before);
});
test('Solo support troops use only one shared soldier and keep earned NPC uniform colors',()=>{
  const c=canvas(),seen=[];
  const scope={ctx:c.ctx,clamp,S:{},TigerStrikeBattlefieldRenderer:{...art,drawSoldier:(ctx,e,o)=>{seen.push(o);return art.drawSoldier(ctx,e,o);}},premiumGaitBlend:()=>0,syncUnitSquadProgression:()=>{},squadProfileForUnit:()=>({uniform:'Elite Gold'}),animMoveBlend:()=>0,smoothedDrawPoint:e=>e,drawMotionAfterImages:()=>{},drawWaterRipple:()=>{},drawPremiumFootstepDust:()=>{},frameLagTier:()=>2,safeCanvasLayer:(_key,fn)=>fn(),LEGACY_PREMIUM_BIPED_OVERLAYS_ENABLED:false,drawAnimatedBipedGait:()=>{throw Error('old body must not paint beneath shared soldier');}};
  scope.DECORATIVE_UNIT_RINGS_ENABLED=false;
  soldierAdapters(scope);vm.runInNewContext(game.slice(game.indexOf('function drawSupportUnit('),game.indexOf('function drawRivalHunter(')),scope);
  scope.drawSupportUnit({id:1,x:10,y:20,hp:100,hpMax:100,role:'rescue'});
  assert.equal(seen.length,1);assert.equal(seen[0].uniformPalette.body,'rgba(146,103,22,.98)');
});
test('government responders in both modes use the shared soldier model and faction uniform',()=>{
  const c=canvas(),seen=[];
  const renderer={...art,drawSoldier:(ctx,e,o)=>{seen.push({e,o});return art.drawSoldier(ctx,e,o);}};
  const scope={ctx:c.ctx,clamp,S:{},TigerStrikeBattlefieldRenderer:renderer,window:{TigerStrikeBattlefieldRenderer:renderer},premiumGaitBlend:()=>0,animMoveBlend:()=>0,smoothedDrawPoint:e=>e,drawWaterRipple:()=>{},RIVAL_FACTION_BY_KEY:{gov:{government:true}},RIVAL_FACTION_DEFS:[{}],roundedRectFill:()=>{},drawAnimatedBipedGait:()=>{throw Error('legacy NPC body');}};
  soldierAdapters(scope);vm.runInNewContext(game.slice(game.indexOf('function drawRivalHunter('),game.indexOf('const TIGER_VISUAL_PALETTES')),scope);
  scope.drawRivalHunter({id:1,x:10,y:20,alive:true,hp:100,hpMax:100,factionKey:'gov'});
  assert.equal(seen.at(-1).e.role,'government');assert(c.colors.includes('#586c78'));
  const coopScope={window:{TigerStrikeBattlefieldRenderer:renderer},state:{snapshot:{code:'TEST',startedAt:1},snapshotReceivedAt:10000,walkVisual:new Map()},performance:{now:()=>10000},clamp,roundRect:()=>{}};
  vm.runInNewContext(coop.slice(coop.indexOf('function drawStoryTiger('),coop.indexOf('function drawTigerCarcass(')),coopScope);
  coopScope.drawStoryTiger(c.ctx,{id:'gov1',x:10,y:20,hp:100,hpMax:100,faction:'government'},10000);
  assert.equal(seen.length,2);assert.equal(seen.at(-1).e.role,'government');assert.equal(seen.at(-1).o.showMarker,false);
});
test('both modes use shared tiger art for bodies as well as live and captured animals',()=>{
  const solo=game.slice(game.indexOf('function drawCarcass('),game.indexOf('function drawCaptureCage('));
  const pair=coop.slice(coop.indexOf('function drawTigerCarcass('),coop.indexOf('function drawTigerCage('));
  for(const source of [solo,pair]){assert(source.includes('BattlefieldRenderer.drawTiger'));assert(source.includes('carcass:true'));assert(source.includes('showState:false'));assert(source.includes('BLOOD SCENT'));}
  assert(game.includes('if(!globalThis.TigerStrikeBattlefieldRenderer?.drawCivilian)'));
  assert(coop.includes('uniformPalette:cloth,shotKick'));
});
