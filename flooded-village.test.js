const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('./api/_lib/squad-session');
const M=require('./api/_lib/metrics-store');
const scope=require('./api/_lib/rescue-profile-scope');
const config=require('./rescue-expedition');
const water=require('./water-terrain');
const {createHarness}=require('./qa/coop-harness');

const captain={id:960881,first_name:'Flood Captain'};
const partner={id:960882,first_name:'Flood Partner'};
const playerKey=(room,u)=>`live_squad_player_${room.code}_${u.id}`;
const roomKey=room=>`live_squad_session_${room.code}`;
async function patch(room,u,values){
  const key=playerKey(room,u);
  const {id,name,...fields}=values;
  await M.setState(key,{...await M.getState(key),lastSeenAt:Date.now(),...fields});
}
const snap=room=>S.buildSnapshot(room,captain.id);
const action=async(room,u,kind,values)=>S.applyAction(await S.readSession(room.code),u,kind,values);

async function deploy(mode,route,replay=false){
  let room=await S.createSession(captain,{
    launchType:mode,expeditionId:'flooded-village',expeditionRoute:route,expeditionReplay:replay,
  });
  if(mode==='expedition-squad'){
    room=await S.joinSession(room.code,partner);
    await assert.rejects(()=>action(room,captain,'start'),/confirm/);
    for(const user of [captain,partner])await action(room,user,'ready',{ready:true,readyRevision:room.readyRevision});
  }
  return action(room,captain,'start');
}

async function inspect(room){
  const points=(await snap(room)).checkpoints;
  // Either player can open an exit independently, including the east exit first.
  for(const [i,point] of [...points].reverse().entries()){
    const user=room.memberIds.length===2&&i===0?partner:captain;
    await patch(room,user,point);
    await action(room,user,'expedition-interact');
  }
  assert.equal((await snap(room)).checkpointCompletedIds.length,points.length);
}

async function recruit(room){
  const snapshot=await snap(room);
  for(const [i,civilian] of snapshot.civilians.entries()){
    const user=room.memberIds.length===2&&i%2?partner:captain;
    await patch(room,user,civilian);
    await action(room,user,'rescue',{civilianId:civilian.id});
  }
  assert.equal((await snap(room)).rescuedIds.length,4);
}

async function deliver(room){
  const snapshot=await snap(room);
  for(const uid of room.memberIds){
    const user=uid===captain.id?captain:partner;
    const followers=snapshot.civilians.filter(c=>c.followingUserId===uid);
    await patch(room,user,{...snapshot.rescueHouse,civilianEscorts:Object.fromEntries(followers.map(c=>[c.id,{...snapshot.rescueHouse,path:[],updatedAt:Date.now()}]))});
    await action(room,user,'deliver');
  }
  assert.equal((await snap(room)).securedCivilianIds.length,4);
}

async function clear(room){
  for(const tiger of (await snap(room)).tigers){
    const player=await M.getState(playerKey(room,captain));
    await patch(room,captain,{...tiger,tigerDamage:{...player.tigerDamage,[tiger.id]:Math.ceil(tiger.hpMax*.8)}});
    await action(room,captain,'capture',{tigerId:tiger.id});
  }
}

async function finish(room){
  const snapshot=await snap(room);
  for(const uid of room.memberIds)await patch(room,{id:uid},snapshot.extraction);
  if(snapshot.expedition.stage===3){
    assert.equal((await snap(room)).status,'active');
    assert((await snap(room)).expedition.boardingMs>0);
    await action(room,captain,'pause',{reason:'shop'});
    assert.equal((await S.readSession(room.code)).expeditionBoardingAt,0,'Shop cannot complete boarding in the background');
    await action(room,captain,'resume');
    await snap(await S.readSession(room.code));
    await M.setState(roomKey(room),{...await S.readSession(room.code),expeditionBoardingAt:Date.now()-config.holdMs});
  }
  const completed=await snap(await S.readSession(room.code));
  assert.equal(completed.status,'complete');
  if(completed.expedition.boat){
    const h=createHarness({userId:captain.id});
    h.setClock(completed.serverNow);h.seed(completed);h.qa.render();await h.advance(16);
    assert.equal(h.stats().depth,0,'the boat finale uses production passengers and leaves canvas transforms balanced');
  }
  const ended=await S.readSession(room.code);
  const [a,b]=await Promise.all([S.claimReward(ended,captain),S.claimReward(ended,captain)]);
  assert.deepEqual(a.expedition,b.expedition,'repeated save preserves one result');
  await S.closeSession(ended,captain);
  return a.expedition;
}

test('Flooded Village supports both routes, real ferry transport, retries and independent expedition saves',async()=>{
  const initial=await S.readCoopProfile(captain);
  const river=await S.createSession(captain,{launchType:'expedition-solo',expeditionRoute:'clinic'});
  await S.closeSession(river,captain);
  const original=await S.expeditionStatus(captain);
  await scope.run('expedition-solo',async()=>{
    await assert.rejects(()=>S.createSession(captain,{launchType:'expedition-solo',expeditionId:'missing',expeditionRoute:'boat'}),/available rescue/);
    let room=await deploy('expedition-solo','boat');
    assert.equal(room.expedition.id,'flooded-village');
    assert.equal((await S.expeditionStatus(captain,'flooded-village')).roomCode,room.code);
    await inspect(room);
    await clear(room);
    await finish(room);
  });

  await scope.run('expedition-squad',async()=>{
    let room=await deploy('expedition-squad','shelter');
    assert.equal(room.expedition.route,'boat','saved choice wins over a client-supplied route');
    let snapshot=await snap(room);
    assert(snapshot.civilians.every(c=>!c.injured));
    await assert.rejects(()=>action(room,captain,'expedition-ferry'),/both home exits/);
    await inspect(room);
    await recruit(room);
    await clear(room);
    snapshot=await snap(room);
    const h=createHarness({userId:captain.id});
    h.setClock(snapshot.serverNow);
    h.seed(snapshot);
    h.qa.drawArena();
    assert.equal(h.stats().depth,0,'flooded terrain and production models draw with balanced transforms');
    const ferry=snapshot.expedition.ferry;
    for(const u of [captain,partner]){
      const p=await M.getState(playerKey(room,u));
      await patch(room,u,{...ferry.from,civilianEscorts:Object.fromEntries(p.rescuedIds.map(id=>[id,{...ferry.from,path:[],updatedAt:Date.now()}]))});
    }
    await patch(room,partner,snapshot.spawns[1]);
    await assert.rejects(()=>action(room,captain,'expedition-ferry'),/every connected/);
    await patch(room,partner,ferry.from);
    const boarding=await Promise.allSettled([action(room,captain,'expedition-ferry'),action(room,partner,'expedition-ferry')]);
    assert.equal(boarding.filter(result=>result.status==='fulfilled').length,1,'one shared ferry departure');
    snapshot=await snap(room);
    assert(snapshot.expedition.ferry.active);
    await assert.rejects(()=>action(room,captain,'attack',{tigerId:'tiger_scout'}),/ferry is crossing/);
    h.setClock(snapshot.serverNow);h.seed(snapshot);h.qa.drawArena();
    assert.equal(h.stats().depth,0);
    assert.equal(h.drawn.soldiers.filter(id=>id===String(captain.id)).length>0,true);
    await S.updateOwnPresence(room,captain,{x:10,y:10,moving:true,moveX:-1,moveY:-1});
    let aboard=(await snap(room)).players.find(p=>p.userId===captain.id);
    assert(aboard.x>3000,'movement packets cannot pull a passenger off the boat');
    const key=`live_squad_expedition_ferry_${room.code}_${room.startedAt}`;
    const marker=await M.getState(key);
    for(let t=0;t<=ferry.duration;t+=500){
      const progress=t/ferry.duration;
      assert(water.contains(snapshot.waterZones[0],ferry.boatFrom.x,ferry.boatFrom.y+(ferry.boatTo.y-ferry.boatFrom.y)*progress),'ferry stays in real water');
    }
    await M.setState(key,{at:marker.at-ferry.duration-1});
    snapshot=await snap(room);
    assert(snapshot.expedition.ferry.completed);
    assert(!snapshot.expedition.ferry.active);
    assert(snapshot.players.every(p=>p.y>=ferry.to.y));
    await assert.rejects(()=>action(room,captain,'expedition-ferry'),/already been used/);
    await deliver(room);
    const saved=await finish(room);
    assert(saved.results[1].ferryUsed);
  });

  await scope.run('expedition-solo',async()=>{
    let room=await deploy('expedition-solo');
    let snapshot=await snap(room);
    assert(snapshot.waterZones[0].ry>190,'flood reaches its final stage');
    assert(snapshot.expedition.boat);
    await recruit(room);await clear(room);await deliver(room);
    const completed=await finish(room);
    assert.equal(completed.stage,4);
    assert.deepEqual(completed.results[2].survivors,['Asha','Jonah','Suri','Tomas']);

    room=await deploy('expedition-solo','shelter',true);
    await inspect(room);await clear(room);await finish(room);
    room=await deploy('expedition-solo');
    snapshot=await snap(room);
    assert.equal(snapshot.expedition.ferry,null);
    assert(snapshot.civilians.every(c=>c.hp===55));
    assert(snapshot.waterZones[0].bridges.length>0,'shelter route keeps a dry bridge crossing');
    await inspect(room);await recruit(room);await clear(room);await deliver(room);await finish(room);
    room=await deploy('expedition-solo');
    snapshot=await snap(room);
    await patch(room,captain,snapshot.civilians[0]);
    await assert.rejects(()=>action(room,captain,'rescue',{civilianId:snapshot.civilians[0].id}),/route objective/);
    await inspect(room);
    assert((await snap(room)).civilians.every(c=>c.hp===100));
    // A wipe restores this stage and its treatment objective, without advancing the checkpoint.
    await patch(room,captain,{hp:0,downed:true,livesRemaining:0,respawnAt:0});
    assert.equal((await snap(room)).status,'failed');
    room=await action(room,captain,'restart');
    assert.deepEqual((await snap(room)).checkpointCompletedIds,[]);
    await inspect(room);await recruit(room);await clear(room);await deliver(room);
    const saved=await finish(room);
    assert.equal(saved.results[2].stabilized,4);
  });
  assert.deepEqual(await S.expeditionStatus(captain),original,'River Gate retains its own checkpoint');
  const after=await S.readCoopProfile(captain);
  assert.deepEqual({...after,updatedAt:initial.updatedAt},initial,'Rescue supplies and records stay isolated');
});

test('the actual expedition menu launches and resumes the selected adventure',async()=>{
  const vm=require('node:vm'),fs=require('node:fs');
  for(const run of [null,{stage:2,route:'boat',roomCode:'QAFLOW',roomStatus:'waiting',results:[]}]){
    let dialog,buttons=[],launched;
    const error={textContent:''},title={textContent:''},closeButton={};
    const body={
      textContent:'',
      set innerHTML(html){buttons=[...html.matchAll(/data-exp-play="([^"]+)"/g)].map(match=>({dataset:{expPlay:match[1]},disabled:false}));},
      querySelector(selector){
        if(selector==='.expError')return error;
        if(selector.includes('input[name="expeditionRoute"]'))return run?null:{value:'boat'};
        return null;
      },
      querySelectorAll:selector=>selector==='[data-exp-play]'||selector==='button'?buttons:[],
    };
    const document={
      getElementById:()=>dialog,
      body:{append(){}},
      createElement:()=>{
        dialog={
          open:false,setAttribute(){},addEventListener(){},removeEventListener(){},
          showModal(){this.open=true;},close(){this.open=false;},
          querySelector:selector=>selector==='.expBody'?body:selector==='#rescueExpeditionTitle'?title:closeButton,
          querySelectorAll:selector=>selector==='button'?[closeButton,...buttons]:[],
        };
        return dialog;
      },
    };
    const context={document,console,AbortSignal,
      fetch:async(_url,request)=>{
        assert.equal(JSON.parse(request.body).expeditionId,'flooded-village');
        return {ok:true,json:async()=>({ok:true,expedition:run})};
      },
    };
    context.window={Telegram:{WebApp:{initData:'ISOLATED-TEST'}},TigerRescueExpedition:config};
    vm.runInNewContext(fs.readFileSync('rescue-expedition-hub.js','utf8'),context);
    context.window.TigerRescueExpeditionHub.open({expeditionId:'flooded-village',play:async options=>{launched=options;}});
    await new Promise(resolve=>setImmediate(resolve));
    await buttons[0].onclick();
    assert.equal(error.textContent,'Opening the stage…');
    assert.equal(dialog.open,false);
    assert.equal(launched.expeditionId,'flooded-village');
    assert.equal(launched.mode,run?'resume':'solo');
    assert.equal(launched.code,run?.roomCode);
    assert.equal(launched.route,run?undefined:'boat');
  }
});
