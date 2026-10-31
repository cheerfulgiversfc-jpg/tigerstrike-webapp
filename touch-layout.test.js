const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const layout=require('./touch-layout'),source=fs.readFileSync('game.js','utf8');
const items=Array.from({length:13},(_,i)=>({id:'control'+i,stick:i===0}));
test('layouts keep touch targets on screen and separated at phone sizes, including extreme settings',()=>{
 for(const [w,h]of [[320,380],[390,700],[640,420],[844,380]])for(const settings of [{},{joystick:240,button:84,gap:36},{joystick:120,button:44,gap:10}]){
  const boxes=layout.plan(items,w,h,settings,'field');for(const b of boxes){assert(b.x>=0&&b.y>=0&&b.x+b.w<=w&&b.y+b.h<=h);if(!b.stick)assert(b.w>=44);for(const other of boxes)if(b!==other)assert(!layout.overlaps(b,other,7.9),`${w}x${h} ${b.id}/${other.id}`);}
 }
 const normal=layout.plan(items,390,700,{});assert(normal[0].w>=176);assert(normal[1].w>=58);
});
test('saved positions are bounded, invalid saves recover, and field/combat layouts remain independent',()=>{
 assert.equal(layout.normalize(null).joystick,176);assert.equal(layout.normalize({opacity:'bad'}).opacity,65);
 const s=layout.normalize({opacity:25,positions:{field:{control0:{x:2,y:-1}},combat:{control0:{x:.5,y:.5}},coop:{evil:{x:NaN,y:0}}}});assert.deepEqual(s.positions.field.control0,{x:1,y:0});assert.deepEqual(s.positions.coop,{});
 const field=layout.plan(items,390,700,s,'field'),combat=layout.plan(items,390,700,s,'combat');assert.notDeepEqual(field[0],combat[0]);assert.equal(s.opacity,25);
});
function button(){const events={},b={dataset:{},disabled:false,count:0,getBoundingClientRect:()=>({left:0,top:0,right:80,bottom:80}),addEventListener:(n,f)=>{(events[n]||=[]).push(f);}};b.emit=(n,args={})=>{let stop=false;const e={pointerId:1,pointerType:'touch',clientX:20,clientY:20,isTrusted:true,preventDefault(){},stopImmediatePropagation(){stop=true;},...args};for(const f of events[n]||[]){f(e);if(stop)return false;}if(n==='click')b.count++;return true;};b.click=()=>b.emit('click',{isTrusted:false});return b;}
test('touch release activates once without a compatibility click and preserves keyboard/mouse, cancel and disabled behavior',()=>{
 const b=button();layout.bindPress(b);layout.bindPress(b);b.emit('pointerdown');b.emit('pointerup');assert.equal(b.count,1);b.emit('click');assert.equal(b.count,1);
 b.emit('pointerdown');b.emit('pointercancel');b.emit('pointerup');assert.equal(b.count,1);
 b.emit('pointerdown');b.emit('pointerup',{pointerId:2});assert.equal(b.count,1);b.emit('pointerup',{clientX:100});assert.equal(b.count,1);
 b.disabled=true;b.emit('pointerdown');b.emit('pointerup');assert.equal(b.count,1);b.disabled=false;b.click();assert.equal(b.count,2);
});
function func(name){const start=source.indexOf(`function ${name}(`),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
test('unrelated touch releases never consume attack input or release a different joystick finger',()=>{
 let reset=0,blocked=0;const ctx={TOUCH_STICK:{active:false,pointerId:null},resetTouchStick:()=>reset++,stopTouchOverlayEvent:()=>blocked++};vm.createContext(ctx);vm.runInContext(func('touchEndListener'),ctx);
 ctx.touchEndListener({pointerId:2});assert.equal(blocked,0);ctx.TOUCH_STICK={active:true,pointerId:1};ctx.touchEndListener({pointerId:2});assert.equal(reset,0);ctx.touchEndListener({pointerId:1});assert.equal(reset,1);assert.equal(blocked,1);
});
test('empty Rubber ammo cannot silently switch to a Real weapon',()=>{
 const weapons={rubber:{id:'rubber',type:'lethal',mode:'rubber'},real:{id:'real',type:'lethal',mode:'real'},rubber2:{id:'rubber2',type:'lethal',mode:'rubber'}};
 const ctx={S:{ownedWeapons:['rubber','real','rubber2'],preferredLethalWeaponId:'real'},equippedWeapon:()=>weapons.rubber,selectedAmmoModeForWeapon:w=>w.mode,getWeapon:id=>weapons[id],hasAmmoForWeaponId:id=>id!=='rubber'};vm.createContext(ctx);vm.runInContext(func('preferredAttackWeaponId'),ctx);assert.equal(ctx.preferredAttackWeaponId(),null);ctx.S.preferredLethalWeaponId='rubber2';assert.equal(ctx.preferredAttackWeaponId(),'rubber2');
 assert(source.includes('interactionFeedback(emptyAttackAmmoMessage()'));assert(!source.includes('Out of lethal ammo. Buy ammo in Shop or use Capture when the tiger is weak enough.'));
});
test('actual Attack handler fires once through reliable touch and keeps long-press weapon selection',()=>{
 const b=button();let shots=0;const ctx={ATTACK_HOLD:{longPress:false},S:{inBattle:true},playerAction:a=>{assert.equal(a,'ATTACK');shots++;},playerAttackLockedRival:()=>false};vm.createContext(ctx);vm.runInContext(func('onAttackClick'),ctx);layout.bindPress(b);b.addEventListener('click',ctx.onAttackClick);b.emit('pointerdown');b.emit('pointerup');b.emit('click');assert.equal(shots,1);ctx.ATTACK_HOLD.longPress=true;b.click();assert.equal(shots,1);assert.equal(ctx.ATTACK_HOLD.longPress,false);
});
test('Co-op controls pause uses the existing personal pause ownership and cannot resume a teammate screen',async()=>{
 const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory');const host={id:1009101},mate={id:1009102};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');room=await server.applyAction(room,mate,'pause',{reason:'inventory'});room=await server.applyAction(room,host,'pause',{reason:'controls'});room=await server.readSession(room.code);let snap=await server.buildSnapshot(room,host.id);assert(snap.paused);assert(snap.pausedBy.some(p=>p.reason==='controls'));room=await server.applyAction(room,host,'resume');snap=await server.buildSnapshot(room,host.id);assert(snap.paused);assert.equal(snap.pausedBy.length,1);assert.equal(snap.pausedBy[0].userId,mate.id);room=await server.applyAction(room,mate,'resume');assert.equal((await server.buildSnapshot(room,host.id)).paused,false);
});
test('editor loads before gameplay, both clients expose it, and tutorial teaches a real practice step',()=>{
 const html=fs.readFileSync('index.html','utf8'),tutorial=fs.readFileSync('tutorial.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');assert(html.indexOf('touch-layout.js?')<html.indexOf('game.js?'));assert(tutorial.includes('key:"controls_layout"'));assert(tutorial.includes('tutorialArrangeControls'));assert(tutorial.includes('controlsPracticed===true'));assert(coop.includes("'arrange-controls':async()"));assert(coop.includes('data-squad-command="arrange-controls"'));assert(coop.includes('TigerTouchLayout?.applyCoop()'));assert(source.includes('if(window.PointerEvent) return;'));
});

test('actual Co-op editor command pauses and resumes through the service and exposes the settings button',async()=>{
 const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store'),{createHarness}=require('./qa/coop-harness');assert.equal(store.storageMode(),'memory');const host={id:1009103},mate={id:1009104};let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,mate);room=await server.applyAction(room,host,'start');
 const h=createHarness({userId:host.id,snapshot:await server.buildSnapshot(room,host.id),transport:async request=>{room=await server.applyAction(await server.readSession(room.code),host,request.action,request);return {ok:true,snapshot:await server.buildSnapshot(room,host.id)};}});let opened;h.ctx.TigerTouchLayout={open:o=>opened=o,applyCoop(){}};h.qa.render();assert(h.element('squadBody').innerHTML.includes('data-squad-command="arrange-controls"'));await h.qa.dispatchCommand('arrange-controls');assert(opened);assert.equal(opened.mode,'coop');assert(h.qa.state.snapshot.paused);assert.equal(h.requests.at(-1).reason,'controls');opened.onClose();await new Promise(setImmediate);assert.equal(h.requests.at(-1).action,'resume');assert.equal(h.qa.state.snapshot.paused,false);
});
test('overlapping saved controls are separated again after phone rotation',()=>{
 const positions=Object.fromEntries(items.map(p=>[p.id,{x:.99,y:.99}]));for(const [w,h]of [[320,380],[844,380],[390,700]]){const boxes=layout.plan(items,w,h,{positions:{combat:positions}},'combat');for(const b of boxes)for(const other of boxes)if(b!==other)assert(!layout.overlaps(b,other,7.9));}
});
