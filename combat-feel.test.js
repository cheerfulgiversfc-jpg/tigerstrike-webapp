const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),vm=require('node:vm');
const feel=require('./combat-feel');
const shot=(id='a',mode='rubber',at=1000)=>({id,mode,at,x1:100,y1:200,x2:250,y2:200,actorId:'1',targetId:'t1'});
const snapshot=(events=[],serverNow=1000,extra={})=>({code:'TEST',startedAt:50,status:'active',serverNow,players:[{userId:1,combatEvents:events}],...extra});
function canvas(){const calls=[];return {calls,ctx:new Proxy({}, {get:(_,key)=>(...a)=>calls.push([key,...a]),set:(_,key,value)=>{calls.push(['style',key,value]);return true;}})};}
test('comfort clamps malformed values and respects reduced-motion defaults',()=>{
  assert.deepEqual(feel.normalizeSettings({},true),{vibration:false,reducedFlashes:true,shake:0});
  assert.deepEqual(feel.normalizeSettings({vibration:'yes',shake:1000}),{vibration:false,reducedFlashes:false,shake:100});
  assert.equal(feel.normalizeSettings({shake:-10}).shake,0);
});
test('invalid effects are rejected and input entities stay untouched',()=>{
  const e=Object.freeze(shot()),c=feel.create();assert(c.emit(e,1000));assert(!c.emit({...e,id:'bad',x1:NaN},1000));assert(!c.emit({...e,id:'bad',mode:'mystery'},1000));
  assert.equal(e.at,1000);assert.equal(c.count(),1);
});
test('Real, Rubber and Tranq report only the real outcome, never invented sedation or kills',()=>{
  assert.equal(feel.label(shot('r','real')),'REAL • CAPTURE BLOCKED');
  assert.equal(feel.label({...shot('r','real'),killed:true}),'ELIMINATED');
  assert.equal(feel.label(shot()),'RUBBER • NONLETHAL');
  assert.equal(feel.label({...shot('t','tranq'),tagged:true}),'TRANQ TAGGED');
  assert.equal(feel.label({...shot('t','tranq'),captured:true}),'CAPTURED');
});
test('polling, duplicate action responses and delayed packets cannot replay sound or impacts',()=>{
  const sounds=[],c=feel.create(e=>sounds.push(e.id));c.ingest(snapshot(),1000);
  const s=snapshot([shot()],1050);c.ingest(s,1100);c.ingest(s,1200);c.ingest(snapshot([shot('older')],1020),1300);
  assert.deepEqual(sounds,['a']);assert.equal(c.count(),1);
  c.ingest(snapshot([shot('stale','real',10)],2000),1400);assert.deepEqual(sounds,['a']);
});
test('reconnect and a new mission seed old receipts silently, while both players retain distinct shots',()=>{
  const played=[],c=feel.create(e=>played.push(e.id));c.ingest(snapshot([shot('old')]),1000);assert.equal(played.length,0);
  const s=snapshot([shot('a')],1200);s.players.push({userId:2,combatEvents:[{...shot('b','real',1100),actorId:'2'}]});c.ingest(s,1200);assert.deepEqual(played,['a','b']);
  c.ingest(snapshot([shot('prior')],1500,{startedAt:51}),1500);assert.equal(c.count(),0);assert.deepEqual(played,['a','b']);
  c.ingest(snapshot([shot('new','real',1510)],1520,{startedAt:51}),1520);assert.equal(played.at(-1),'new');
});
test('paused, inactive and future-dated receipts are silent; queues remain bounded and expire by time',()=>{
  const played=[],c=feel.create(e=>played.push(e.id));c.ingest(snapshot(),1000);
  c.ingest(snapshot([shot('pause')],1050,{paused:true}),1100);c.ingest(snapshot([shot('future','real',3000)],1100),1200);assert.equal(played.length,0);
  for(let i=0;i<80;i++)c.emit(shot(`local${i}`),2000);assert.equal(c.count(),32);
  c.draw(canvas().ctx,2700,feel.normalizeSettings());assert.equal(c.count(),0);
});
test('reduced flashes remove muzzle/tracer flashes but preserve truthful impact labels, with no shake',()=>{
  const full=canvas(),reduced=canvas(),e=feel.event(shot('a','real'));
  feel.drawEvent(full.ctx,e,40,feel.normalizeSettings());feel.drawEvent(reduced.ctx,e,40,feel.normalizeSettings({reducedFlashes:true}));
  assert(full.calls.some(c=>c[0]==='rotate'));assert(!reduced.calls.some(c=>c[0]==='rotate'));
  assert(reduced.calls.some(c=>c[0]==='fillText'&&c[1]==='REAL • CAPTURE BLOCKED'));
  const c=feel.create();c.emit(e,1000);assert.deepEqual(c.shake(1040,feel.normalizeSettings({shake:0})),{x:0,y:0});assert.deepEqual(c.shake(1040,feel.normalizeSettings({shake:100,reducedFlashes:true})),{x:0,y:0});
});
test('shared impacts have finite geometry, balanced canvas state, distinct modes and small local labels',()=>{
  for(const mode of ['real','rubber','tranq'])for(const age of [0,45,200,619]){
    const {ctx,calls}=canvas();feel.drawEvent(ctx,feel.event(shot('a',mode)),age,feel.normalizeSettings());
    assert.equal(calls.filter(c=>c[0]==='save').length,calls.filter(c=>c[0]==='restore').length);
    for(const [method,...args] of calls)for(const n of args)if(typeof n==='number')assert(Number.isFinite(n),method);
    assert(calls.filter(c=>c[0]==='fillRect').every(c=>c[3]<=215&&c[4]<=20),'no fullscreen flash');
  }
});
test('recoil and aim are presentation-only and expire; failing audio cannot interrupt gameplay',()=>{
  const c=feel.create(()=>{throw new Error('audio unavailable');});assert.doesNotThrow(()=>c.emit(shot(),1000));
  assert(c.pose('1',1070).kick>0);assert.equal(c.pose('2',1070),null);assert.equal(c.pose('1',1200),null);
});
test('Solo, Co-op and comfort controls use the shared pipeline without replacing the music system',()=>{
  const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8'),html=fs.readFileSync('index.html','utf8');
  assert(game.includes('recordWeaponImpact(t,w.type'));assert(game.includes("soloCombatPresentation()?.draw(ctx"));assert(coop.includes('combatPresentation?.ingest(snapshot'));assert(coop.includes('combatPresentation?.draw(ctx'));
  assert(html.includes('id="combatComfortDialog"'));assert(coop.includes("'combat-comfort':()=>window.TigerCombatFeel?.openComfort()"));
  assert(html.indexOf('src="./combat-feel.js')<html.indexOf('src="./game.js'));
  const previous=cp.execFileSync('git',['show','HEAD:game.js'],{encoding:'utf8',maxBuffer:20*1024*1024});
  // The supplied full-length tracks and their routing stay exactly as shipped.
  const trackLines=s=>s.split('\n').filter(l=>/No One Stands Alone\.mp3|Testing\.mp3|Tiger Strike\.mp3/.test(l));assert.deepEqual(trackLines(game),trackLines(previous));
});
test('server records accepted shots/captures, not failed or speculative actions',async()=>{
  const server=require('./api/_lib/squad-session'),store=require('./api/_lib/metrics-store');
  const host={id:913001,first_name:'Impact'},peer={id:913002,first_name:'Witness'};
  let room=await server.createSession(host,{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,peer);room=await server.applyAction(room,host,'start');
  let snap=await server.buildSnapshot(room,host.id);const target=snap.tigers.find(t=>!t.defeated),key=`live_squad_player_${room.code}_${host.id}`;
  let player=await store.getState(key);await store.setState(key,{...player,x:target.x,y:target.y,ammoMode:'rubber'});
  const before=await server.readCoopProfile(host);room=await server.applyAction(room,host,'attack',{tigerId:target.id});snap=await server.buildSnapshot(room,host.id);
  const mine=snap.players.find(p=>p.userId===host.id),event=mine.combatEvents.at(-1);
  assert.equal(event.mode,'rubber');assert.equal(event.killed,false);assert.equal(mine.combatSequence,1);assert.equal((await server.readCoopProfile(host)).ammo.rubber,before.ammo.rubber-1);
  assert.deepEqual((await server.buildSnapshot(await server.readSession(room.code),peer.id)).players.find(p=>p.userId===host.id).combatEvents,mine.combatEvents);
  await assert.rejects(()=>server.applyAction(room,host,'attack',{tigerId:target.id}),/cooling down/);
  assert.equal((await store.getState(key)).combatEvents.length,1);
  player=await store.getState(key);await store.setState(key,{...player,tigerDamage:{...player.tigerDamage,[target.id]:target.hpMax-1},x:target.x,y:target.y});
  room=await server.applyAction(room,host,'capture',{tigerId:target.id});const captured=(await server.buildSnapshot(room,host.id)).players.find(p=>p.userId===host.id);
  assert.equal(captured.combatEvents.at(-1).mode,'tranq');assert.equal(captured.combatEvents.at(-1).captured,true);assert.equal(captured.combatSequence,2);
});
test('actual weapon sound branch respects mute, distinguishes ammunition and stops/disconnects audio nodes',()=>{
  const source=fs.readFileSync('game.js','utf8'),start=source.indexOf('function sfx(name){'),end=source.indexOf('\nfunction ',start+1),frequencies=[],sources=[],tones=[];
  let disconnected=0;
  const node=()=>({connect(){},disconnect(){disconnected++;}});
  const scope={S:{soundOn:false},sfxGate:()=>true,ensureAudio(){},beep:(...a)=>tones.push(a),__audioMasterGain:{},AC:{sampleRate:8000,currentTime:10,createBuffer:(_channels,n)=>({getChannelData:()=>new Float32Array(n)}),createBufferSource(){const s={...node(),start(){this.started=true;},stop(at){this.stoppedAt=at;}};sources.push(s);return s;},createBiquadFilter(){const n=node();n.frequency={set value(v){frequencies.push(v);}};n.Q={value:0};return n;},createGain:()=>({...node(),gain:{value:0}})}};
  vm.runInNewContext(source.slice(start,end),scope);
  scope.sfx('weapon-real');assert.equal(sources.length,0);scope.S.soundOn=true;
  for(const mode of ['real','rubber','tranq'])scope.sfx(`weapon-${mode}`);
  assert.deepEqual(frequencies,[1600,380,2400]);assert.equal(tones.length,3);assert.equal(sources.length,3);
  for(const s of sources){assert(s.started&&s.stoppedAt>10&&s.stoppedAt<10.2);s.onended();}assert.equal(disconnected,9);
});
