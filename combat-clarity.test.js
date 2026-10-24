const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const cues=require('./combat-reactions'),experience=require('./player-experience');
const {createHarness,crowdedSnapshot}=require('./qa/coop-harness');
function canvas(){let depth=0;const calls=[];return {calls,depth:()=>depth,ctx:new Proxy({}, {get:(_,key)=>(...args)=>{if(key==='save')depth++;if(key==='restore')depth--;for(const n of args)if(typeof n==='number')assert(Number.isFinite(n));calls.push([key,...args]);},set:()=>true})};}
test('warning clock matches each real attack and never advertises a nonexistent Co-op roll',()=>{
  for(const kind of ['bite','claw','pounce','charge']){
    const a={kind,x:0,y:0,startedAt:1000,resolveAt:1600,targetUserId:1};
    assert.equal(cues.warningState(a,999),null);assert.equal(cues.warningState(a,1600),null);
    const mine=cues.warningState(a,1300,{viewerId:1}),mate=cues.warningState(a,1300,{viewerId:2});
    assert.equal(mine.progress,.5);assert(mine.label.includes(kind.toUpperCase()));assert(mine.label.includes('YOU • MOVE'));assert(mate.label.includes('TEAMMATE • MOVE'));
    assert(cues.warningState(a,1300,{canRoll:true}).label.endsWith('ROLL'));
  }
  assert.equal(cues.warningState({x:NaN,y:2,resolveAt:3000},2000),null);
});
test('target guidance distinguishes weakening, supplies, lethal injury, bosses and kill-only Survival',()=>{
  const t={id:'a',hp:20,hpMax:100,x:0,y:0};
  for(const [entity,opts,expected] of [[t,{},'TRANQ / CAPTURE'],[{...t,hp:80},{},'RUBBER TO WEAKEN'],[{...t,lethalWounded:true},{},'NO CAPTURE • REAL HIT'],[t,{tranqReady:false},'RESTOCK TRANQ'],[t,{bossReady:false},'BOSS STRATEGY FIRST'],[t,{survival:true},'REAL ONLY • SURVIVAL'],[{...t,capturable:false},{},'CANNOT CAPTURE']]){
    assert.equal(cues.targetState(entity,experience.captureStatus(entity,opts)).label,expected);
  }
  assert.equal(cues.targetState(t,{stage:'ready'},{inRange:false}).label,'MOVE CLOSER');
  for(const resolved of [{...t,captured:true},{...t,defeated:true},{...t,hp:0}])assert.equal(cues.targetState(resolved),null);
});
test('shared target and warning art has balanced canvas state, no full-screen fills or state mutation',()=>{
  const t={id:'a',hp:20,hpMax:100,x:160,y:200},a={kind:'bite',x:80,y:200,startedAt:1000,resolveAt:1600},before=JSON.stringify({t,a});
  for(const reducedFlashes of [false,true]){const c=canvas();cues.drawTarget(c.ctx,t,{stage:'ready'});cues.drawWarning(c.ctx,t,a,1300,{reducedFlashes},{canRoll:true});assert.equal(c.depth(),0);assert(c.calls.some(r=>r[0]==='fillText'&&r[1].includes('CAPTURE')));assert(c.calls.some(r=>r[0]==='fillText'&&r[1].includes('BITE')));assert(!c.calls.some(r=>r[0]==='fillRect'&&(r[3]>260||r[4]>30)));}
  assert.equal(JSON.stringify({t,a}),before);
});
test('edge labels stay readable without inventing off-screen target markers',()=>{
  const view={x:100,y:100,w:320,h:240},t={id:'edge',hp:20,x:101,y:101};
  const c=canvas();cues.drawTarget(c.ctx,t,{stage:'blocked'},{view});cues.drawWarning(c.ctx,t,{x:101,y:101,startedAt:1000,resolveAt:1600},1300,{}, {view});
  for(const rect of c.calls.filter(r=>r[0]==='fillRect')){assert(rect[1]>=100&&rect[1]+rect[3]<=420);assert(rect[2]>=100&&rect[2]+rect[4]<=340);}
  const off=canvas();cues.drawTarget(off.ctx,{...t,x:-1000},{stage:'ready'},{view});assert(off.calls.find(r=>r[0]==='fillRect')[1]<0);
});
test('Co-op highlights the actual nearest attack target and disables false capture offers',()=>{
  const s=crowdedSnapshot(),h=createHarness({snapshot:s});s.players[0].moving=false;
  const near=s.tigers.find(t=>!t.defeated);near.x=2205;near.y=1450;near.hp=20;near.hpMax=100;
  for(const t of s.tigers)if(t!==near){t.x=4500;t.y=2500;}
  s.viewerProfile=h.qa.state.profile={ammo:{real:50,rubber:50,tranq:2},supplies:{}};
  let selected;const old=h.ctx.TigerCombatReactions;h.ctx.TigerCombatReactions={...old,drawTarget:(_ctx,t,status)=>selected={id:t.id,status}};
  h.qa.drawArena(1/60);assert.equal(selected.id,near.id);assert.equal(selected.status.stage,'ready');
  h.qa.render();const capture=h.element('squadCaptureButton');
  // Active HUD refresh invokes the actual button updater.
  for(const mode of ['normal','survival','government','far']){
    s.mission.survival=mode==='survival';near.faction=mode==='government'?'government':'';near.x=mode==='far'?2500:2205;s.serverNow+=100;h.qa.applySnapshot(s);
    assert.equal(capture.disabled,mode!=='normal',mode);
  }
});
test('both clients call shared clarity art without adding another DOM overlay or changing server combat',()=>{
  const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8'),encounters=fs.readFileSync('tiger-encounters.js','utf8');
  assert(game.includes("drawSafe('drawCombatTarget'"));assert(game.includes('fieldCaptureStatus(target)'));
  assert(coop.includes('const combatTarget=nearestActiveTiger()'));assert(coop.includes('viewerId:viewerId()'));assert(encounters.includes('TigerCombatReactions.drawWarning'));
});
test('Co-op warns only for live uninterrupted attacks and hides guidance during gear pauses',()=>{
  const s=crowdedSnapshot(),h=createHarness({snapshot:s}),t=s.tigers[0];
  t.attackWarnings=[{x:2200,y:1450,startedAt:99900,resolveAt:100600,targetUserId:900101}];
  let warnings=0,targets=0;h.ctx.TigerEncounters={...require('./tiger-encounters'),drawWarning(){warnings++;}};
  h.ctx.TigerCombatReactions={...h.ctx.TigerCombatReactions,drawTarget(){targets++;}};
  h.qa.drawArena(1/60);assert.equal(warnings,1);assert.equal(targets,1);
  t.lastRubberHitAt=99950;h.qa.drawArena(1/60);assert.equal(warnings,1);
  t.lastRubberHitAt=0;s.paused=true;h.qa.drawArena(1/60);assert.equal(warnings,1);assert.equal(targets,2);
  s.paused=false;t.captured=true;h.qa.drawArena(1/60);assert.equal(warnings,1);
});
