const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rules=require('./engagement-rules'),art=require('./shared-battlefield-renderer'),feel=require('./combat-feel'),reactions=require('./combat-reactions');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
function fn(name){const start=game.indexOf(`function ${name}(`);assert(start>=0,name);return game.slice(start,game.indexOf('\nfunction ',start+1));}
function battle(){
  let now=10000,damage=0,ends=0;const messages=[],events=[];
  const tiger={id:7,alive:true,x:82,y:0,hp:100,hpMax:100,type:'Normal'},S={inBattle:true,activeTigerId:7,lockedTigerId:7,me:{x:0,y:0,face:0,step:0},aggro:0,_protectTicks:0,_combatTigerAttackAt:999999};
  const ctx={S,Math,Date:{now:()=>now},window:{TigerEngagement:rules},dist:(x,y,a,b)=>Math.hypot(x-a,y-b),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),activeTiger:()=>tiger,lockedTiger:()=>tiger,equippedWeaponRange:()=>94,equippedWeapon:()=>({name:'Pump Shotgun'}),keepBattleTigerBesidePlayer(){},weaponRangeBand:()=>'short',isBossTiger:()=>false,endBattle:()=>{ends++;S.inBattle=false;S.activeTigerId=null;tiger._battleAttack=null;S._rollEscapeChain=null;},setBattleMsg:m=>messages.push(m),save(){},toast(){},interactionFeedback:m=>messages.push(m),rollCooldownLeftMs:at=>Math.max(0,(S.rollCooldownUntil||0)-at),rollCooldownLabel:()=>'',ROLL_TRAVEL_DIST:92,ROLL_INVULN_MS:520,ROLL_COOLDOWN_MS:2800,ROLL_ANIM_MS:420,tryMoveEntity:(p,x,y)=>{p.x=x;p.y=y;return true;},emitCombatParticles(){},sfx(){},hapticImpact(){},renderCombatControls(){},shieldActiveNow:()=>false,emitCombatFx(){},triggerCombatInteraction:(kind)=>events.push(kind),updateBattleButtons(){},updateAttackButton(){},renderBattleStatus(){},carcassDifficulty:()=>1,tigerPersonalityProfile:()=>({}),rand:()=>10,tigerDamageScale:()=>1,livingWorldPlayerDamageReduction:()=>0,worldEventMotionMods:()=>({}),liveOpsMissionModifierValue:(_k,v)=>v,setTigerIntent(){},triggerPhase18TigerMoment(){},emitDamagePopup(){},applyCombatKnockback(){},applyPlayerDamage:n=>damage+=n};
  ctx.missionShelterDamage=n=>n; // This baseline arena is outside any mission shelter.
  vm.createContext(ctx);vm.runInContext(['tigerTurn','combatTick','rollDodge'].map(fn).join('\n'),ctx);
  return {ctx,S,tiger,messages,events,at:n=>now=n,damage:()=>damage,ends:()=>ends};
}
test('shotgun stagger, single-roll separation and an idle heartbeat do not disconnect the active tiger',()=>{
  const b=battle();for(let i=0;i<5;i++){b.tiger.x+=16;b.at(10000+i*400);b.ctx.combatTick();assert(b.S.inBattle);assert.equal(b.S.lockedTigerId,7);}
  b.S._battleHeartbeatAt=1;b.at(40000);b.ctx.combatTick();assert.equal(b.ends(),0);
  assert(!rules.canFire(b.S.me,b.tiger,94),'retaining engagement does not grant extra weapon range');
  assert.match(fn('playerAction'),/TigerEngagement.canFire/);
});
test('repeated real shotgun knockback stays inside firing range, without altering damage or movement collision checks',()=>{
  const b=battle();vm.runInContext(fn('applyCombatKnockback'),b.ctx);
  for(let i=0;i<8;i++){b.ctx.applyCombatKnockback(b.tiger,0,0,16,18);b.ctx.combatTick();assert(rules.canFire(b.S.me,b.tiger,94));assert(b.S.inBattle);assert.equal(b.tiger.hp,100);}
  assert.equal(b.tiger.x,92);
  b.S.inBattle=false;b.ctx.applyCombatKnockback(b.tiger,0,0,16,18);assert.equal(b.tiger.x,108,'non-engaged knockback is not capped');
});
test('an out-of-range shot stays engaged without consuming ammo or inventing a hit',()=>{
  const b=battle();b.tiger.x=110;b.S.equippedWeaponId='shotgun';b.S.mag={loaded:5};b.S.stats={shots:0};
  Object.assign(b.ctx,{startupLoadingGuardActive:()=>false,tigerById:()=>b.tiger,preferredAttackWeaponId:()=>'shotgun'});
  vm.runInContext(fn('playerAction'),b.ctx);b.ctx.playerAction('ATTACK');
  assert.equal(b.S.mag.loaded,5);assert.equal(b.S.stats.shots,0);assert(b.S.inBattle);assert.match(b.messages.at(-1),/out of firing range/);
});
test('one roll remains engaged; a distinct second roll within 3 seconds disengages and clears the target',()=>{
  const b=battle();b.ctx.rollDodge();assert(b.S.inBattle);assert.equal(b.ends(),0);assert.equal(b.S.rollBufferedDodges,0);
  b.at(10300);b.ctx.rollDodge();assert.equal(b.ends(),0,'cooldown rejects a double tap within the same roll animation');
  b.at(10600);b.ctx.rollDodge();assert.equal(b.ends(),1);assert(!b.S.inBattle);assert.equal(b.S.lockedTigerId,null);
});
test('escape combo expires, cannot transfer to another tiger, and includes the 3-second boundary',()=>{
  const first=rules.roll(null,7,1000);assert(!first.escape);
  assert(rules.roll(first.chain,7,4000).escape);assert(!rules.roll(first.chain,7,4001).escape);assert(!rules.roll(first.chain,8,2000).escape);assert(!rules.roll(first.chain,7,1200).escape);
  const b=battle();b.ctx.rollDodge();b.at(14000);b.ctx.rollDodge();assert(b.S.inBattle);assert.equal(b.ends(),0);
});
test('bite/claw/pounce wind-ups cause no early damage and resolve only once',()=>{
  for(const kind of ['strike','pounce','charge']){
    const b=battle();b.ctx.tigerTurn(b.tiger,false,{kind,maxRange:120});const warning=b.tiger._battleAttack;
    assert(warning.resolveAt>10000);assert.equal(b.damage(),0);
    b.at(warning.resolveAt-1);b.ctx.combatTick();assert.equal(b.damage(),0);
    b.at(warning.resolveAt);b.ctx.combatTick();assert(b.damage()>0);const damage=b.damage();
    b.at(warning.resolveAt+1);b.ctx.combatTick();assert.equal(b.damage(),damage);
  }
});
test('a correctly timed roll dodges without disengaging; an early expired roll does not buffer a future dodge',()=>{
  const b=battle();b.ctx.tigerTurn(b.tiger);const due=b.tiger._battleAttack.resolveAt;b.at(due-100);b.ctx.rollDodge();b.at(due);b.ctx.combatTick();assert.equal(b.damage(),0);assert(b.S.inBattle);assert(b.events.includes('dodge'));
  const early=battle();early.ctx.rollDodge();early.S.me.x=0;early.at(11000);early.ctx.tigerTurn(early.tiger);const later=early.tiger._battleAttack.resolveAt;early.at(later);early.ctx.combatTick();assert(early.damage()>0);assert(early.S.inBattle);
});
test('interrupted, defeated, ended or stale queued strikes cannot hit the player later',()=>{
  for(const flag of ['staggerUntil','holdUntil']){const b=battle();b.ctx.tigerTurn(b.tiger);b.tiger[flag]=12000;b.at(10600);b.ctx.combatTick();assert.equal(b.damage(),0);assert.equal(b.tiger._battleAttack,null);}
  const b=battle();b.ctx.tigerTurn(b.tiger);b.at(14000);b.ctx.combatTick();assert.equal(b.damage(),0);
  const c=battle();c.ctx.tigerTurn(c.tiger);c.tiger.alive=false;c.at(10600);c.ctx.combatTick();assert.equal(c.damage(),0);assert.equal(c.ends(),1);
  assert.match(fn('endBattle'),/focusTiger\._battleAttack=null/);
});
function canvas(){let depth=0;const calls=[];return {calls,depth:()=>depth,ctx:new Proxy({}, {get:(_,key)=>key==='globalAlpha'?1:/create.*Gradient/.test(key)?()=>({addColorStop(){}}):(...args)=>{calls.push([key,...args]);if(key==='save')depth++;if(key==='restore')depth--;for(const arg of args)if(typeof arg==='number')assert(Number.isFinite(arg));},set:()=>true})};}
test('each accepted shot gets a visible first-paint tracer even when the frame arrives late; reduced flashes stays respected',()=>{
  for(const reducedFlashes of [false,true]){const c=feel.create(),view=canvas();c.emit({id:'shot',at:1000,mode:'real',x1:0,y1:0,x2:100,y2:0},1000);c.draw(view.ctx,1300,{reducedFlashes});assert(view.calls.some(row=>row[0]==='lineTo'&&row[1]===100));assert.equal(view.depth(),0);}
});
test('claw and bite have distinct grounded reactions and readable isolated strike shapes',()=>{
  const tiger={x:100,y:100,hp:100,hpMax:100};for(const kind of ['claw','bite']){const attack={kind,startedAt:1000,resolveAt:1560,x:50,y:100,tigerX:100,tigerY:100};
    const state=art.tigerVisualState(tiger,{attack,now:1660});assert(state.striking);assert(!state.pouncing);assert.equal(state.strikeKind,kind);
    const c=canvas();reactions.drawStrike(c.ctx,attack,1300,{});assert(c.calls.some(row=>row[0]==='fillText'&&row[1].includes(kind.toUpperCase())));reactions.drawStrike(c.ctx,attack,1660,{reducedFlashes:true});assert(c.calls.some(row=>row[0]==='quadraticCurveTo'));assert.equal(c.depth(),0);
  }
});
test('combat art continuously aims at the active target, rather than falling back to movement facing between shots',()=>{
  assert.match(fn('drawSoldier'),/combatTarget\?\.alive\?Math.atan2/);assert.match(fn('drawSharedMissionTiger'),/const facing=focused\?/);
  assert.match(coop,/const face=aimFace\?\?impactPose/);assert.match(coop,/const visualFacing=combatFacing\?\?/);
  for(const target of [{x:20,y:0},{x:-20,y:0},{x:0,y:20},{x:0,y:-20}])assert.equal(rules.face({x:0,y:0},target),Math.atan2(target.y,target.x));
});
