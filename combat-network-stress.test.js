const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createHarness,crowdedSnapshot}=require('./qa/coop-harness');
const motion=require('./squad-motion'),smooth=require('./smooth-play');
const copy=value=>JSON.parse(JSON.stringify(value));
test('presence refreshes preserve equipment buttons while real profile changes refresh them',()=>{
  const s=crowdedSnapshot(),h=createHarness({snapshot:s}),body=h.element('squadBody');
  let writes=0,markup='';Object.defineProperty(body,'innerHTML',{get:()=>markup,set:value=>{writes++;markup=value;}});
  h.qa.state.equipmentOpen='shop';h.qa.render();const initial=writes;
  for(let i=1;i<=10;i++){const next=copy(s);next.serverNow+=i*100;h.qa.applySnapshot(next);}
  assert.equal(writes,initial,'unchanged gear controls must not be replaced by presence packets');
  const changed=copy(s);changed.serverNow+=2000;changed.viewerProfile.funds-=440;h.qa.applySnapshot(changed);
  assert.equal(writes,initial+1,'actual purchases still refresh balances');
});
test('crowded Co-op skips only off-camera models; minimap, warnings and authoritative snapshots remain intact',()=>{
  const s=crowdedSnapshot(),original=JSON.stringify(s),h=createHarness({snapshot:s});h.resetStats();h.qa.drawArena(1/60);
  assert.equal(h.drawn.tigers.length,15);assert.equal(h.drawn.civilians.length,10);assert.equal(h.drawn.soldiers.length,2);
  assert(h.drawn.tigers.includes('t0'),'nearby boss still draws');assert(h.drawn.tigers.includes('t1'),'nearby cage still draws');
  assert.equal(JSON.stringify(s),original);assert.equal(s.tigers.length,60);assert.equal(s.civilians.length,40);assert.equal(h.stats().depth,0);
  const actor=crowdedSnapshot().tigers[30];assert(!smooth.visible(actor,{x:1600,y:1070,w:1200,h:760}));
  h.qa.state.local.x=actor.x;h.qa.state.local.y=actor.y;h.qa.state.camera.ready=false;h.resetStats();h.qa.drawArena(1/60);assert(h.drawn.tigers.includes('t30'),'moving the camera reveals previously skipped actors');
});
test('visible blood halos and civilians arriving at a rescue door are never clipped by actor culling',()=>{
  const s=crowdedSnapshot();s.tigers[20]={...s.tigers[20],x:1450,y:1450,defeated:true,carcass:true,captured:false};
  const h=createHarness({snapshot:s});let arrivalDrawn=false;
  h.ctx.TigerCivilianRescue={...h.ctx.TigerCivilianRescue,arrivalFrame:record=>record?{x:2200,y:1450,alpha:1,done:false}:null};
  const old=h.ctx.TigerStrikeBattlefieldRenderer.drawCivilian;h.ctx.TigerStrikeBattlefieldRenderer.drawCivilian=(ctx,civ,opts)=>{if(civ.id==='arriving')arrivalDrawn=true;return old(ctx,civ,opts);};
  s.civilians.push({id:'arriving',x:4500,y:2600,secured:true,hp:100,name:'Arriving',rescueArrival:{at:100000}});
  h.resetStats();h.qa.drawArena(1/60);assert(arrivalDrawn);assert(h.drawn.tigers.includes('t20'),'blood halo overlaps the view even when its body is outside');assert.equal(h.stats().depth,0);
});
test('slow stationary receiver polls promptly while its teammate moves; paused squads do not predict movement',()=>{
  const s=crowdedSnapshot(),h=createHarness({snapshot:s});assert.equal(smooth.pollInterval(s,false),300);
  assert.equal(smooth.pollInterval({...s,players:s.players.map(p=>({...p,moving:false}))},false),750);
  const p=copy(s);p.serverNow+=100;p.paused=true;h.qa.applySnapshot(p);
  const remote=h.qa.state.remoteDraw.get(900102);assert(!remote.moving);const next=motion.step(remote,h.clock()+5000,.05,185,s.world);assert.equal(next.drawX,remote.x);
});
test('irregular packets, losses, 15/30/60 FPS and reconnect corrections stay bounded without altering authority',()=>{
  for(const fps of [15,30,60]){
    let sample=null,lastX=500,latestAt=-1;const world={width:4800,height:2800};
    const arrivals=[0,280,700,1250,2600,2950,6500];let packet=0;
    for(let frame=0;frame<fps*9;frame++){
      const now=frame*1000/fps;
      if(packet<arrivals.length&&now>=arrivals[packet]){const x=500+Math.min(arrivals[packet],3000)*.10;sample=motion.accept(sample,{x,y:500,moving:arrivals[packet]<3000,moveX:1,moveY:0,online:true},now,world);latestAt=now;packet++;}
      if(!sample)continue;
      const before=sample.drawX;sample=motion.step(sample,now,1/fps,185,world);
      assert(Math.abs(sample.drawX-before)<=185*2.2/fps+1e-7,'a late packet cannot create a one-frame correction jump');
      assert(sample.drawX>=24&&sample.drawX<=4776);assert(sample.drawX<=sample.x+185*.360+1e-7,'lost packets cannot walk forever');lastX=sample.drawX;
    }
    assert(Math.abs(lastX-800)<1,'reconnection settles to the verified stop point');assert(latestAt>=6500);
  }
});
test('old snapshots cannot roll a room back, and restarts reset stale motion and held inputs',()=>{
  const s=crowdedSnapshot(),h=createHarness({snapshot:s});const next=copy(s);next.serverNow+=100;next.players[1].x+=80;h.qa.applySnapshot(next);
  const old=copy(s);old.players[1].x=40;h.qa.applySnapshot(old);assert.equal(h.qa.state.snapshot.players[1].x,next.players[1].x);
  h.qa.state.keys.add('d');h.qa.state.local.x=4000;const restart=copy(next);restart.serverNow+=100;restart.startedAt+=1000;restart.players[1].moving=false;h.qa.applySnapshot(restart);
  assert.equal(h.qa.state.keys.size,0);assert.equal(h.qa.state.local.x,restart.players[0].x);assert.equal(h.qa.state.remoteDraw.get(900102).drawX,restart.players[1].x);
});
test('Solo reaction sampling reads only combat scalars, not hundreds of equipment fields per soldier',()=>{
  const source=fs.readFileSync('game.js','utf8'),start=source.indexOf('function observeSoloCombatReactions('),end=source.indexOf('\nfunction ',start+1);let reads=0,seen;
  const unit={id:1,hp:70,armor:5,x:100,y:100};Object.defineProperty(unit,'equipment',{enumerable:true,get(){reads++;return Array(1000).fill('unused');}});
  const ctx={S:{me:{x:0,y:0},hp:100,armor:10,supportUnits:[unit],tigers:[{id:'boss',hp:100,x:300,y:300,alive:true}],civilians:[]},__soloReactionRun:1,isBossTiger:()=>true,soloCombatReactions:()=>({observe:s=>seen=s})};
  vm.runInNewContext(source.slice(start,end),ctx);for(let i=0;i<120;i++)ctx.observeSoloCombatReactions();
  assert.equal(reads,0);assert.equal(seen.players[1].hp,70);assert.equal(seen.tigers[0].boss,true);
});
test('two isolated clients combine real capture, crowded river rendering, Shop/Inventory and failed resume safely',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');assert.equal(store.storageMode(),'memory','never run this fixture against production storage');
  const users=[{id:982101,first_name:'Stress Host'},{id:982102,first_name:'Stress Partner'}];
  let room=await server.createSession(users[0],{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,users[1]);room=await server.applyAction(room,users[0],'start');
  for(const user of users){const profile=await server.readCoopProfile(user);profile.funds=100000;await server.writeCoopProfile(profile,user);}
  let failure='';
  const enrich=s=>{const crowd=crowdedSnapshot(s.viewerId);return {...s,tigers:[...s.tigers,...crowd.tigers],civilians:[...s.civilians,...crowd.civilians],waterZones:crowd.waterZones};};
  const clients=[];
  for(const user of users){
    const transport=async request=>{
      if(failure===request.action){failure='';throw Error('simulated lost response');}
      room=await server.readSession(room.code);
      if(request.action==='sync')await server.updateOwnPresence(room,user,request.player||{});
      else if(request.action.startsWith('gear-'))await server.applyCoopEquipmentAction(room,user,request.action,request);
      else if(request.action!=='status')room=await server.applyAction(room,user,request.action,request);
      return {ok:true,snapshot:enrich(await server.buildSnapshot(await server.readSession(room.code),user.id))};
    };
    const snapshot=enrich(await server.buildSnapshot(room,user.id)),h=createHarness({userId:user.id,transport});h.setClock(snapshot.serverNow);h.seed(snapshot);clients.push(h);
  }
  const [host,partner]=clients,base=await server.buildSnapshot(room,users[0].id),target=base.tigers.find(t=>!t.boss&&!t.defeated);
  const key=`live_squad_player_${room.code}_${users[0].id}`,player=await store.getState(key);
  await store.setState(key,{...player,x:target.x,y:target.y,tigerDamage:{[target.id]:Math.ceil(target.hpMax*.85)},lastActionAt:0});
  await host.qa.api('capture',{tigerId:target.id});await partner.qa.api('status');assert(host.qa.state.snapshot.capturedIds.includes(target.id));assert(partner.qa.state.snapshot.capturedIds.includes(target.id));
  for(const h of clients){h.qa.state.local.x=2200;h.qa.state.local.y=1450;h.qa.state.camera.ready=false;h.qa.drawArena(1/30);assert.equal(h.stats().depth,0);}
  await host.qa.openEquipment('shop');await partner.qa.api('status');await partner.qa.openEquipment('inventory');
  assert.equal(host.element('squadBody').dataset.squadMode,'equipment');assert.equal(partner.element('squadBody').dataset.squadMode,'equipment');
  const funds=(await server.readCoopProfile(users[0])).funds,other=(await server.readCoopProfile(users[1])).funds;
  await host.qa.gearCommand('gear-buy','rubber_rounds');assert.equal((await server.readCoopProfile(users[0])).funds,funds-440);assert.equal((await server.readCoopProfile(users[1])).funds,other);
  host.qa.returnFromEquipment();await new Promise(setImmediate);await partner.qa.api('status');assert(partner.qa.state.snapshot.paused,'one player closing gear cannot resume the other player');
  failure='resume';partner.qa.returnFromEquipment();await new Promise(setImmediate);assert(partner.qa.state.equipmentResumePending);await partner.advance(1600);await new Promise(setImmediate);assert(!partner.qa.state.equipmentResumePending);
  await host.qa.api('status');assert(!host.qa.state.snapshot.paused);assert(host.qa.state.snapshot.capturedIds.includes(target.id));
  failure='sync';await host.qa.sync();assert(host.qa.state.connectionFailed);await host.qa.sync();assert(!host.qa.state.connectionFailed);
  for(const h of clients){h.qa.drawArena(1/30);assert.equal(h.stats().depth,0);assert.equal(h.qa.state.code,room.code);}
});
