const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./elite-catalog'),R=require('./shared-battlefield-renderer'),T=require('./rescue-tools'),Scene=require('./showcase-scene');
process.env.TS_ELITE_TEST_MEMORY='1';
const store=require('./api/_lib/elite-store'),squad=require('./api/_lib/squad-session'),metrics=require('./api/_lib/metrics-store');
function canvas(){let depth=0;const colors=[],calls=[];return {colors,calls,depth:()=>depth,ctx:new Proxy({canvas:{width:1200,height:720},globalAlpha:1},{get:(o,k)=>k in o?o[k]:/create.*Gradient/.test(k)?()=>({addColorStop:(p,v)=>colors.push(v)}):(...args)=>{if(k==='save')depth++;if(k==='restore')depth--;for(const n of args)if(typeof n==='number')assert(Number.isFinite(n),'finite '+k);calls.push([k,...args]);},set:(o,k,v)=>{o[k]=v;if(k==='fillStyle'||k==='strokeStyle')colors.push(v);return true;}})};}
async function purchase(user,sku,charge){const q=await store.reserve(user.id,sku);await store.grant(user.id,{currency:'XTR',invoice_payload:q.order.ref,total_amount:q.stars,telegram_payment_charge_id:charge});return q;}
test('200-Star equipment ownership is independent, duplicate safe, refundable and grants no supplies or gameplay changes',async()=>{
 const user={id:776201,first_name:'Equipment'},before=await squad.readCoopProfile(user);
 assert.equal(C.quote('elite_rescue_equipment').stars,200);assert.equal(C.appearance([],{equipment:'rescue_equipment'}).equipment,'');
 for(const sku of ['elite_storm_medic','elite_guardian','elite_extraction'])await purchase(user,sku,'equipment-other-'+sku);
 const q=await store.reserve(user.id,'elite_rescue_equipment');assert.equal(await store.validate(user.id,q.order.ref,199,'XTR','wrong'),false);
 const payment={currency:'XTR',invoice_payload:q.order.ref,total_amount:200,telegram_payment_charge_id:'equipment-test'};await store.grant(user.id,payment);await store.grant(user.id,payment);
 const selection={soldier:'storm_medic',weapon:'guardian',extraction:'extraction',equipment:'rescue_equipment'};await store.equip(user.id,selection);
 const a=await store.visual(user.id);for(const [key,value]of Object.entries(selection))assert.equal(a[key],value);
 await assert.rejects(()=>store.reserve(user.id,'elite_rescue_equipment'),/already own/);
 const after=await squad.readCoopProfile(user);for(const key of ['funds','ammo','supplies','stats','ownedWeapons'])assert.deepEqual(after[key],before[key]);
 await store.refund(user.id,payment.telegram_payment_charge_id);const refunded=await store.visual(user.id);assert.equal(refunded.equipment,'');assert.equal(refunded.soldier,'storm_medic');assert.equal(refunded.weapon,'guardian');assert.equal(refunded.extraction,'extraction');
});
test('Detailed matching models are finite, balanced and simulation-only in every preview and loading/departure stage',()=>{
 const c=canvas(),appearance={soldier:'storm_medic',equipment:'rescue_equipment'},before=JSON.stringify(appearance),cages=[{livery:'rescue_equipment'},{livery:''}],old=global.TigerStrikeBattlefieldRenderer;global.TigerStrikeBattlefieldRenderer=R;
 try{R.drawMedDrone(c.ctx,{x:300,y:100},{variant:'rescue_equipment',now:1000});for(const kind of ['smoke','flare'])R.drawRescueDevice(c.ctx,{x:300,y:100},{kind,variant:'rescue_equipment',active:true,now:1000});assert(R.drawCaptureCageFinish(c.ctx,{livery:'rescue_equipment'}));assert.equal(R.drawCaptureCageFinish(c.ctx,{livery:'forged'}),false);
 for(const equipment of ['med-drone','smoke','flare','cage']){const result=Scene.draw(c.ctx,{current:'rescue_equipment',equipment,now:2000,appearance});assert.equal(result.kind,equipment);}
 for(const progress of [0,.4,.9,1])Scene.drawTransfer(c.ctx,{progress,count:2,cages,now:2000});assert.equal(c.depth(),0);assert(c.colors.includes('#287f80'));assert(c.colors.includes('#2e7d79'));assert(c.colors.includes('#dfbd77'));assert.equal(JSON.stringify(appearance),before);assert.deepEqual(cages,[{livery:'rescue_equipment'},{livery:''}]);
 }finally{global.TigerStrikeBattlefieldRenderer=old;}
});
test('Smoke keeps exactly the same visible cloud coverage and flare routes remain identical; collection takes drone finish priority',()=>{
 const old=global.TigerStrikeBattlefieldRenderer,variants=[];global.TigerStrikeBattlefieldRenderer={...R,drawMedDrone:(ctx,e,o)=>{variants.push(o.variant);R.drawMedDrone(ctx,e,o);}};
 try{const effects=[{kind:'smoke',x:400,y:500,until:12000},{kind:'flare',origin:{x:400,y:500},target:{x:600,y:700,label:'Objective'},extraction:{x:800,y:900,label:'Extraction'},until:12000}];
 for(const effect of effects){const a=canvas(),b=canvas(),original=JSON.stringify(effect);T.drawEffect(a.ctx,effect,10000);T.drawEffect(b.ctx,{...effect,eliteAppearance:{equipment:'rescue_equipment'}},10000);assert.deepEqual(a.calls.filter(x=>x[0]==='arc'),b.calls.filter(x=>x[0]==='arc'));for(const target of effect.kind==='flare'?[effect.target,effect.extraction]:[])assert(b.calls.some(x=>x[0]==='lineTo'&&x[1]===target.x&&x[2]===target.y));assert.equal(JSON.stringify(effect),original);assert.equal(a.depth(),0);assert.equal(b.depth(),0);}
 const c=canvas();for(const equipment of ['rescue_equipment',''])T.drawEffect(c.ctx,{kind:'med-drone',x:100,y:100,until:12000,healed:38,eliteAppearance:{soldier:'storm_medic',equipment}},10000);assert.deepEqual(variants,['rescue_equipment','storm_medic']);
 }finally{global.TigerStrikeBattlefieldRenderer=old;}
});
test('Equipping the collection never changes actual Solo drone healing, cooldowns or remaining mission uses',()=>{
 const systems=require('./field-systems'),saved={S:global.S,document:global.document,elite:global.TigerEliteArmory};let equipped=true;
 global.document={getElementById:()=>null};global.TigerEliteArmory={appearance:()=>({equipment:equipped?'rescue_equipment':'',soldier:'storm_medic'})};
 try{global.S={mode:'Story',paused:false,missionEnded:false,gameOver:false,_missionRunId:'equipment-solo',worldMapPrepLast:{secondaryId:'med-drone'},me:{x:0,y:0},hp:50,tigers:[],civilians:[]};systems.resetMissionSecondaryForMission(global.S);systems.useSelectedMissionSecondary();assert.equal(global.S.hp,88);assert.equal(global.S.missionSecondary.charges,1);const cooldown=global.S.missionSecondary.cooldownUntil;equipped=false;systems.useSelectedMissionSecondary();assert.equal(global.S.hp,88);assert.equal(global.S.missionSecondary.charges,1);assert.equal(global.S.missionSecondary.cooldownUntil,cooldown);
 }finally{global.S=saved.S;global.document=saved.document;global.TigerEliteArmory=saved.elite;}
});
test('Verified Co-op equipment, actual healing and permanently recorded cage finishes survive rejoin and later unequip',async()=>{
 const host={id:776210,first_name:'Equipped'},mate={id:776211,first_name:'Partner'};await purchase(host,'elite_rescue_equipment','equipment-coop');await store.equip(host.id,{equipment:'rescue_equipment'});
 let room=await squad.createSession(host,{launchType:'shared-story',storyMissionLevel:8});room=await squad.joinSession(room.code,mate);await squad.applyAction(room,host,'tool-select',{toolId:'med-drone'});room=await squad.applyAction(room,host,'start');
 const key=`live_squad_player_${room.code}_${host.id}`,mateKey=`live_squad_player_${room.code}_${mate.id}`,patch=async changes=>metrics.setState(key,{...await metrics.getState(key),...changes});
 const partner=await metrics.getState(mateKey);await metrics.setState(mateKey,{...partner,hp:50});await squad.applyAction(room,host,'tool-use');assert.equal((await metrics.getState(mateKey)).hp,88);assert.equal((await metrics.getState(key)).rescueTool.charges,1);
 await squad.updateOwnPresence(room,mate,{eliteAppearance:{equipment:'rescue_equipment'},captureSites:{forged:{x:0,y:0,livery:'rescue_equipment'}}});let snap=await squad.buildSnapshot(room,mate.id);assert.equal(snap.players.find(p=>p.userId===mate.id).eliteAppearance.equipment,'');assert(!snap.players.find(p=>p.userId===mate.id).captureSites.forged);
 const before=await squad.readCoopProfile(host),first=snap.tigers[0];await patch({x:first.x,y:first.y,tigerDamage:{[first.id]:first.hpMax-1},lastAttackAt:0});
 // An old per-instance visual cache cannot permanently give a new cage the wrong finish.
 const originalVisual=store.visual;store.visual=async()=>({});try{room=await squad.applyAction(room,host,'capture',{tigerId:first.id});}finally{store.visual=originalVisual;}
 for(const user of [host,mate]){snap=await squad.buildSnapshot(room,user.id);assert.equal(snap.tigers.find(t=>t.id===first.id).cageLivery,'rescue_equipment');}
 assert.equal((await squad.readCoopProfile(host)).ammo.tranq,before.ammo.tranq-1);
 await store.equip(host.id,{equipment:''});room=await squad.joinSession(room.code,host);snap=await squad.buildSnapshot(room,mate.id);assert.equal(snap.tigers.find(t=>t.id===first.id).cageLivery,'rescue_equipment');assert.equal((await metrics.getState(key)).rescueTool.charges,1);
 const next=snap.tigers.find(t=>!t.defeated),raw=await metrics.getState(key);await patch({x:next.x,y:next.y,tigerDamage:{...raw.tigerDamage,[next.id]:next.hpMax-1},lastAttackAt:0});store.visual=async()=>({equipment:'rescue_equipment'});try{room=await squad.applyAction(room,host,'capture',{tigerId:next.id});}finally{store.visual=originalVisual;}
 snap=await squad.buildSnapshot(room,mate.id);assert.equal(snap.tigers.find(t=>t.id===next.id).cageLivery,'');assert.equal(snap.tigers.find(t=>t.id===first.id).cageLivery,'rescue_equipment');await assert.rejects(()=>squad.applyAction(room,host,'capture',{tigerId:first.id}),/already captured|cleared/);assert.equal((await squad.readCoopProfile(host)).ammo.tranq,before.ammo.tranq-2);
});
test('Solo freezes cage finish at capture time and legacy cages retain their original appearance',()=>{
 const vm=require('node:vm'),source=fs.readFileSync('game.js','utf8'),start=source.indexOf('function captureCageFromTiger('),end=source.indexOf('\nfunction registerTigerCaptureCage',start),scope={window:{TigerEliteArmory:{appearance:()=>({equipment:'rescue_equipment'})}}};vm.createContext(scope);vm.runInContext(source.slice(start,end),scope);const t={id:'real-tiger',x:10,y:20,type:'Scout'},c=scope.captureCageFromTiger(t);assert.equal(c.livery,'rescue_equipment');scope.window.TigerEliteArmory.appearance=()=>({});assert.equal(scope.captureCageFromTiger(t).livery,'');assert.equal(c.livery,'rescue_equipment');const a=canvas(),b=canvas();R.drawCaptureCage(a.ctx,10,20,1,{now:1000});R.drawCaptureCage(b.ctx,10,20,1,{now:1000,livery:''});assert.deepEqual(a.calls,b.calls);
});
test('Both clients pass equipment identity to smoke, drone and flare, and preserve livery through the shared transport renderer',()=>{
 const field=fs.readFileSync('field-systems.js','utf8'),game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8'),shop=fs.readFileSync('elite-armory.js','utf8');assert(field.includes("kind:'smoke',until:state.secondarySmokeUntil,eliteAppearance:"));assert(field.includes('origin:state.me,eliteAppearance:'));assert(coop.includes('{...effect,eliteAppearance:player.eliteAppearance,target:'));assert(game.includes('cages:__wildlifeTransportScene.cages'));assert(coop.includes('livery:t.cageLivery'));for(const label of ['Med Drone','Smoke Grenade','Signal Flare','Capture Cage'])assert(shop.includes("'"+label+"'"));
});
