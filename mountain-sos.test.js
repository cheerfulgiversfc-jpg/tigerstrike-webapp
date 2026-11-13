const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('./api/_lib/squad-session');
const M=require('./api/_lib/metrics-store');
const E=require('./rescue-expedition');
const W=require('./water-terrain');
const scope=require('./api/_lib/rescue-profile-scope');
const {createHarness}=require('./qa/coop-harness');
const roomKey=r=>`live_squad_session_${r.code}`;
const playerKey=(r,u)=>`live_squad_player_${r.code}_${u.id}`;
async function place(r,u,point,patch={}){await M.setState(playerKey(r,u),{...await M.getState(playerKey(r,u)),...point,...patch,lastSeenAt:Date.now()});}
const snap=async(r,u)=>S.buildSnapshot(await S.readSession(r.code),u.id);
const action=async(r,u,kind,body)=>S.applyAction(await S.readSession(r.code),u,kind,body);
async function deploy(r,party){
  r=await S.readSession(r.code);
  if(party.length===2)for(const u of party)await action(r,u,'ready',{ready:true,readyRevision:r.readyRevision});
  return action(r,party[0],'start');
}
async function captureThreats(r,u){
  for(const t of (await snap(r,u)).tigers){
    const p=await M.getState(playerKey(r,u));
    // Controlled enemy health and positions, real capture authorization and supply use.
    await place(r,u,t,{tigerDamage:{...p.tigerDamage,[t.id]:Math.ceil(t.hpMax*.8)}});
    await action(r,u,'capture',{tigerId:t.id});
  }
}
for(const route of ['forest','ridge'])for(const count of [1,2]){
  test(`Mountain SOS ${route} route completes all three stages with ${count} soldier(s)`,async()=>scope.run(count===1?'expedition-solo':'expedition-squad',async()=>{
    const id=971000+(route==='ridge'?20:0)+count*2;
    const party=[{id,first_name:'Mountain Captain'},...(count===2?[{id:id+1,first_name:'Mountain Partner'}]:[])],host=party[0];
    let room=await S.createSession(host,{launchType:count===1?'expedition-solo':'expedition-squad',expeditionId:'mountain-sos',expeditionRoute:route});
    if(count===2)room=await S.joinSession(room.code,party[1]);
    const code=room.code;
    for(let stage=1;stage<=3;stage++){
      room=await deploy(room,party);
      let view=await snap(room,host);
      if(stage===2&&route==='ridge'&&count===2){
        for(const u of party)await place(room,u,view.spawns[0],{hp:0,downed:true,livesRemaining:0,respawnAt:0});
        assert.equal((await snap(room,host)).failureReason,'squad_wipe');
        await action(room,host,'restart');room=await deploy(room,party);view=await snap(room,host);
        assert(view.players.every(p=>!p.downed&&p.hp>0&&p.livesRemaining===1));
        assert.equal((await S.expeditionStatus(host,'mountain-sos')).results.length,1,'a wipe keeps the earlier stage checkpoint');
      }
      assert.equal(view.expedition.stage,stage);
      assert.equal(view.expedition.scene.kind,'mountain');
      assert.equal(view.world.width,4800);
      assert.equal(view.tigers.length,(count===1?1:2)+(stage===2&&route==='ridge'?1:0));
      assert(view.tigers.every(t=>t.hpMax===(count===1?100:145)));
      for(const point of [...view.spawns,view.extraction,view.rescueHouse,...view.civilians,...view.checkpoints])assert(!W.swimming(view.waterZones,point.x,point.y),'objectives must be on a reachable bank');
      if(stage===1){
        assert.equal(view.waterZones[0].bridges.length,0);
        const repair=view.checkpoints[1];
        await place(room,host,repair);
        await assert.rejects(()=>action(room,host,'expedition-interact'),/distress beacon/);
        for(const site of view.checkpoints){await place(room,host,site);await action(room,host,'expedition-interact');}
        assert.equal((await snap(room,host)).waterZones[0].bridges.length,1);
      }else{
        assert.equal(view.waterZones[0].bridges.length,1,'repair survives the stage transition');
        if(stage===2){
          await place(room,host,view.rescueHouse);
          await assert.rejects(()=>action(room,host,'expedition-interact'),/Bring the medic/);
          const h=createHarness({userId:host.id,snapshot:view});h.qa.render();
          assert.equal(h.element('squadRescueButton').dataset.squadAction,'rescue','medical task never hides the Rescue button before the party is found');
        }
        for(const [i,c] of view.civilians.entries()){
          const u=party[i%count];await place(room,u,c);await action(room,u,'rescue',{civilianId:c.id});
        }
        if(stage===2){
          // Both soldiers must physically visit the crossing through presence updates.
          const crossing=view.checkpoints.find(c=>c.id==='ms_crossing');
          for(const u of party){await place(room,u,crossing);await S.updateOwnPresence(await S.readSession(code),u,{});}
          const owned=(await snap(room,host)).civilians;
          for(const u of party)await place(room,u,view.rescueHouse,{civilianEscorts:Object.fromEntries(owned.filter(c=>c.followingUserId===u.id).map(c=>[c.id,{...view.rescueHouse,path:[],updatedAt:Date.now()}]))});
          await action(room,host,'expedition-interact');
          assert((await snap(room,host)).civilians.every(c=>c.hp===100),'treatment heals all three hikers');
        }
        const owned=(await snap(room,host)).civilians;
        for(const u of party){
          await place(room,u,view.rescueHouse,{civilianEscorts:Object.fromEntries(owned.filter(c=>c.followingUserId===u.id).map(c=>[c.id,{...view.rescueHouse,path:[],updatedAt:Date.now()}]))});
          await action(room,u,'deliver');
        }
      }
      if(stage===3){
        for(const u of party)await place(room,u,view.extraction);
        assert.equal((await snap(room,host)).expedition.boardingMs,0,'boarding cannot bypass a live tiger threat');
      }
      await captureThreats(room,host);
      for(const u of party)await place(room,u,view.extraction);
      if(stage===3){
        view=await snap(room,host);assert(view.expedition.helicopter);assert(!view.expedition.boat);
        assert(view.expedition.boardingMs>0);
        await place(room,host,view.spawns[0]);assert.equal((await snap(room,host)).expedition.boardingMs,0);
        await place(room,host,view.extraction);await snap(room,host);
        await M.setState(roomKey(room),{...await S.readSession(code),expeditionBoardingAt:Date.now()-E.holdMs});
      }
      view=await snap(room,host);assert.equal(view.status,'complete');
      const saved=await S.claimReward(await S.readSession(code),host);
      assert.equal(saved.expedition.results.length,stage);
      if(stage===2)assert.equal(saved.expedition.results[1].stabilized,3);
      if(stage<3){
        room=await action(room,host,'expedition-continue',{stage});
        assert.equal(room.code,code);assert.equal(room.status,'waiting');
        assert.equal((await S.expeditionStatus(party.at(-1),'mountain-sos')).roomCode,code);
      }else{
        assert.equal(view.expedition.report.rescued.length,4);
        assert.equal(view.expedition.report.kills,0);
        assert.equal(view.expedition.report.team.length,count);
        assert.equal(await S.expeditionStatus(host,'river-gate'),null);
        const h=createHarness({userId:host.id,snapshot:view});h.qa.render();h.qa.drawArena();
        assert(!h.element('squadDebrief').innerHTML.includes('Reward pending'));
        await h.qa.dispatchCommand('expedition-movie');await h.advance(1800);await h.advance(4000);
        await h.qa.dispatchCommand('expedition-skip');
        assert.equal(h.stats().depth,0);assert(h.drawn.civilians.length>0&&h.drawn.soldiers.length>0);
        assert.equal((await S.claimReward(await S.readSession(code),host)).expedition.results.length,3);
      }
    }
  }));
}
