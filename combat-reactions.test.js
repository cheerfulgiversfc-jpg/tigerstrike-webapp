const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const reactions=require('./combat-reactions'),art=require('./shared-battlefield-renderer');
const player={userId:1,x:200,y:240,hp:100,armor:100},boss={id:'boss',boss:true,x:400,y:240,hp:500};
const snap=(at=1000,extra={})=>({code:'TEST',startedAt:1,serverNow:at,status:'active',players:[{...player}],tigers:[],civilians:[],securedCivilianIds:[],...extra});
function canvas(){const calls=[];return {calls,ctx:new Proxy({}, {get:(_,key)=>/create.*Gradient/.test(key)?()=>({addColorStop(){}}):(...args)=>calls.push([key,...args]),set:()=>true})};}
test('damage reactions follow real health or armor loss, not healing, duplicate snapshots or reconnect',()=>{
  const c=reactions.create();c.observe(snap(),1000);assert.equal(c.pose('soldier',1,1050),0);
  c.observe(snap(1100,{players:[{...player,hp:80}]}),1100);const pose=c.pose('soldier',1,1200);assert(pose>0);
  c.observe(snap(1100,{players:[{...player,hp:80}]}),1200);assert.equal(c.pose('soldier',1,1200),pose);
  c.observe(snap(1200,{players:[{...player,hp:90}]}),1200);assert.equal(c.pose('soldier',1,1500),0);
  c.observe(snap(900,{players:[{...player,hp:1}]}),1500);assert.equal(c.pose('soldier',1,1600),0);
  c.observe(snap(1700,{startedAt:2,players:[{...player,hp:1}]}),1700);assert.equal(c.pose('soldier',1,1750),0);
});
test('paused damage does not replay on resume; both soldiers can react independently',()=>{
  const c=reactions.create(),players=[player,{...player,userId:2}];c.observe(snap(1000,{players}),1000);
  c.observe(snap(1100,{paused:true,players:players.map(p=>({...p,hp:70}))}),1100);
  c.observe(snap(1200,{players:players.map(p=>({...p,hp:70}))}),1200);assert.equal(c.pose('soldier',1,1250),0);
  c.observe(snap(1300,{players:players.map(p=>({...p,hp:60}))}),1300);assert(c.pose('soldier',1,1400)>0&&c.pose('soldier',2,1400)>0);
});
test('Rubber and Tranq hits use brief cosmetic stagger, while successful capture has its own moment',()=>{
  const c=reactions.create();c.shot({id:'r',targetId:'t',mode:'rubber'},1000);assert(c.pose('tiger','t',1120)>0);assert.equal(c.count(),0);
  c.shot({id:'t',targetId:'t2',mode:'tranq'},1000);assert(c.pose('tiger','t2',1100)>0);
  c.shot({id:'cap',targetId:'t',mode:'tranq',captured:true,x2:200,y2:200},1200);assert.equal(c.count(),1);
  c.shot({id:'cap',targetId:'t',mode:'tranq',captured:true,x2:200,y2:200},1300);assert.equal(c.count(),1);
  c.shot({id:'dead',targetId:'dead',mode:'real',killed:true},1300);assert.equal(c.pose('tiger','dead',1400),0);
});
test('celebration requires a living civilian actually secured, evacuated or boarded, and expires',()=>{
  const event={rescueArrival:{at:1000}};
  assert.equal(reactions.celebration({...event,following:true},1400),0);
  for(const flag of ['secured','evac'])assert(reactions.celebration({...event,[flag]:true},1400)>0);
  assert.equal(reactions.celebration({...event,secured:true,alive:false},1400),0);
  assert.equal(reactions.celebration({...event,secured:true},5000),0);
  assert(reactions.celebration({boardedAt:1000},1400)>0);
});
test('rescue transition celebrates only newly secured civilians; group rescues aggregate exact counts',()=>{
  const c=reactions.create(),civilians=[{id:'a',x:200,y:300},{id:'b',x:205,y:300}];
  c.observe(snap(1000,{civilians,securedCivilianIds:['a']}),1000);assert.equal(c.count(),0);
  c.observe(snap(1100,{civilians,securedCivilianIds:['a','b']}),1100);assert.equal(c.count(),1);
  c.moment('rescue','third',{x:205,y:300},1150);const view=canvas();c.draw(view.ctx,1200);assert(view.calls.some(c=>c[0]==='fillText'&&c[1]==='2 CIVILIANS SAFE'));
});
test('boss encounter triggers on approach or a real mission start, not old reconnects or defeated bosses',()=>{
  const c=reactions.create();c.observe(snap(1000,{tigers:[boss]}),1000);assert.equal(c.count(),0);
  c.observe(snap(1100,{tigers:[boss]}),1100);assert.equal(c.count(),0);
  c.observe(snap(1200,{tigers:[{...boss,id:'new',x:2000}]}),1200);assert.equal(c.count(),0);
  c.observe(snap(1300,{tigers:[{...boss,id:'new'}]}),1300);assert.equal(c.count(),1);
  c.reset();c.observe(snap(1400,{status:'waiting'}),1400);c.observe(snap(1500,{startedAt:2,tigers:[boss]}),1500);assert.equal(c.count(),1);
  c.observe(snap(1600,{startedAt:2,tigers:[{...boss,id:'dead',hp:0,defeated:true}]}),1600);assert.equal(c.count(),1);
});
test('escape cue requires a fresh server-confirmed dodge and never replays on reconnect',()=>{
  const c=reactions.create(),receipt={id:'evade1',kind:'dodged',x:200,y:240,at:1000};
  c.observe(snap(1050,{players:[{...player,lastEvasion:receipt}]}),1050);
  c.observe(snap(1100,{players:[{...player,lastEvasion:receipt}]}),1100);assert.equal(c.count(),0);
  c.observe(snap(1200,{players:[{...player,lastEvasion:{...receipt,id:'evade2',at:1150}}]}),1200);assert.equal(c.count(),1);
  c.observe(snap(1300,{players:[{...player,lastEvasion:{...receipt,id:'not-a-dodge',kind:'hit',at:1250}}]}),1300);assert.equal(c.count(),1);
  c.observe(snap(4000,{players:[{...player,lastEvasion:{...receipt,id:'stale'}}]}),4000);assert.equal(c.count(),1);
});
test('moments deduplicate, stay bounded, expire and remain readable under reduced flashes',()=>{
  let callbacks=0;const c=reactions.create(()=>callbacks++);
  for(let i=0;i<30;i++){c.moment('capture',`${i}`,{x:200,y:200},1000);c.moment('capture',`${i}`,{x:200,y:200},1000);}assert.equal(callbacks,30);assert.equal(c.count(),8);
  const small=canvas();c.draw(small.ctx,1100,{reducedFlashes:true},{x:0,y:0,w:390,h:700});assert(small.calls.some(c=>c[0]==='fillText'));assert(!small.calls.some(c=>c[0]==='lineTo'));
  assert(small.calls.filter(c=>c[0]==='fillRect').every(c=>c[3]===188&&c[4]===30));c.draw(canvas().ctx,2300);assert.equal(c.count(),0);
});
test('shared character reactions stay finite, upright and input-only for every uniform and resting tiger',()=>{
  const wardrobe=require('./mastery-rewards'),uniforms=wardrobe.CATALOG.filter(r=>r.slot==='uniform').map(r=>wardrobe.uniformPalette(r.id)).filter(Boolean);
  const models=[...uniforms.flatMap(uniformPalette=>[0,Math.PI].map(face=>(ctx)=>art.drawSoldier(ctx,Object.freeze({x:100,y:150,face}),{reaction:1,uniformPalette}))),(ctx)=>art.drawCivilian(ctx,Object.freeze({x:100,y:150,secured:true,injured:true}),{celebration:1}),(ctx)=>art.drawTiger(ctx,Object.freeze({...boss,hp:100}),{reaction:1,now:1100}),(ctx)=>art.drawTiger(ctx,Object.freeze({...boss,captured:true}),{reaction:1,now:1100})];
  assert.equal(uniforms.length,10);
  for(const model of models){const c=canvas();assert.doesNotThrow(()=>model(c.ctx));assert.equal(c.calls.filter(c=>c[0]==='save').length,c.calls.filter(c=>c[0]==='restore').length);for(const [name,...args] of c.calls)for(const n of args)if(typeof n==='number')assert(Number.isFinite(n),name);}
  const c=canvas();art.drawSoldier(c.ctx,player,{reaction:1});assert(c.calls.filter(c=>c[0]==='rotate').every(c=>Math.abs(c[1])<.2),'no upside-down hurt pose');
});
test('comfort reduces flinch amplitude; observers never modify simulation or trigger actions',()=>{
  const c=reactions.create();c.hurt('a',1000);assert(c.pose('soldier','a',1100,{reducedFlashes:true})<c.pose('soldier','a',1100));
  const frozen=Object.freeze(snap(1000,{players:Object.freeze([Object.freeze({...player})]),tigers:Object.freeze([Object.freeze({...boss})])}));const before=JSON.stringify(frozen);c.observe(frozen,1000);assert.equal(JSON.stringify(frozen),before);
});
test('both modes use the shared reactions and retain Part 1 comfort controls without new overlays',()=>{
  const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8'),html=fs.readFileSync('index.html','utf8'),module=fs.readFileSync('combat-reactions.js','utf8');
  assert(game.includes('observeSoloCombatReactions();'));assert(coop.includes('reactionPresentation?.observe(snapshot'));
  assert(game.includes("pose('soldier'"));assert(coop.includes("pose('soldier'"));assert(game.includes("pose('tiger'"));assert(coop.includes("pose('tiger'"));
  assert(html.indexOf('src="./combat-reactions.js')<html.indexOf('src="./game.js'));assert(html.includes('id="combatComfortDialog"'));
  assert(!/setTimeout|setInterval|setPaused|showModal|preventDefault|pointerEvents|document\./.test(module),'moments must never block controls or pause a mission');
});
