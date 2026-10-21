(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerFieldRadio=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SIGNALS=Object.freeze({help:'🆘 Help me',follow:'📍 Follow me',rescue:'🛟 Rescue here',capture:'💉 Capture alive'});
  const COOLDOWN_MS=3000,TTL_MS=12000;
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const nearest=(rows,p)=>rows.filter(valid).slice().sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];
  function makeSignal({kind,player={},tigers=[],civilians=[],survival=false,previous=null,now=Date.now(),runId=''}={}){
    if(!SIGNALS[kind])throw new Error('Choose a valid radio signal.');
    if(previous&&now-Number(previous.createdAt)<COOLDOWN_MS)throw new Error('Radio cooling down. Wait three seconds.');
    let target=player;
    if(kind==='capture'){
      if(survival)throw new Error('Survival has no capture objective.');
      target=nearest(tigers.filter(t=>!t.defeated&&t.alive!==false&&t.hp>0&&!t.lethalWounded&&t.capturable!==false&&t.faction!=='government'),player);
    }
    if(kind==='rescue')target=nearest(civilians.filter(c=>!c.secured&&!c.following&&c.alive!==false),player);
    if(!valid(target))throw new Error('No available target for that signal.');
    return {id:`${runId}:${player.userId||'solo'}:${now}`,kind,label:SIGNALS[kind],userId:player.userId||0,name:String(player.name||'Soldier').slice(0,60),targetId:String(target.id||''),x:target.x,y:target.y,createdAt:now,expiresAt:now+TTL_MS};
  }
  function activeSignals(players=[],now=Date.now(),runId=''){
    return players.map(p=>p.radioSignal).filter(s=>s&&SIGNALS[s.kind]&&valid(s)&&s.expiresAt>now&&s.createdAt<=now&&(!runId||String(s.id).startsWith(`${runId}:`)));
  }
  function guide(snap={},viewerId=0){
    const player=(snap.players||[]).find(p=>Number(p.userId)===Number(viewerId));if(!player)return null;
    const point=(target,action)=>valid(target)?{...target,action,distance:Math.round(Math.hypot(target.x-player.x,target.y-player.y))}:null;
    const down=(snap.players||[]).find(p=>p.userId!==player.userId&&p.downed);if(down)return point(down,'Revive teammate');
    const checkpoint=(snap.checkpoints||[]).find(c=>!(snap.checkpointCompletedIds||[]).includes(c.id));
    if(snap.mission?.checkpointsBeforeRescue&&checkpoint)return point(checkpoint,'Both players inspect');
    const mine=(snap.civilians||[]).filter(c=>c.following&&Number(c.followingUserId)===Number(viewerId)&&!c.secured);
    if(checkpoint&&mine.length)return point(checkpoint,'Escort to checkpoint');
    if(mine.length)return point(snap.rescueHouse,'Take followers to Rescue House');
    const available=(snap.civilians||[]).filter(c=>!c.following&&!c.secured&&!(snap.securedCivilianIds||[]).includes(c.id)&&c.alive!==false);
    if(available.length)return point(nearest(available,player),'Rescue civilian');
    if(checkpoint)return point(checkpoint,'Join teammate at checkpoint');
    const tigers=(snap.tigers||[]).filter(t=>!t.defeated&&t.hp>0);
    const required=Number(snap.mission?.captureRequired||0),ids=snap.mission?.captureTargetIds||[];
    const count=ids.length?(snap.capturedIds||[]).filter(id=>ids.includes(id)).length:(snap.capturedIds||[]).length;
    if(count<required){
      const fresh=tigers.filter(t=>!t.lethalWounded&&t.capturable!==false&&(!ids.length||ids.includes(t.id)));
      return point(nearest(fresh,player),'Capture alive: Rubber then Tranq');
    }
    if(tigers.length)return point(nearest(tigers,player),'Clear tiger threat');
    return point(snap.extraction,'Reach extraction');
  }
  function civilianStatus(civilian={},viewerId=0){
    if(civilian.secured||civilian.evac)return 'Safely rescued';
    if(civilian.following)return Number(civilian.followingUserId)===Number(viewerId)?'Following you':'Following teammate';
    return 'Available to rescue';
  }
  function callout(snap={},viewerId=0){
    if(snap.status!=='active')return '';
    const down=(snap.players||[]).find(p=>Number(p.userId)!==Number(viewerId)&&p.downed);
    if(down)return '🆘 Teammate down — reach them to revive.';
    const endangered=(snap.civilians||[]).find(c=>!c.secured&&(snap.tigers||[]).some(t=>!t.defeated&&t.hp>0&&Math.hypot(t.x-c.x,t.y-c.y)<110));
    if(endangered)return `⚠️ ${endangered.name||'Civilian'} is close to a tiger — protect the rescue route.`;
    const ready=(snap.tigers||[]).find(t=>!snap.mission?.survival&&!t.defeated&&!t.lethalWounded&&t.capturable!==false&&t.hp>0&&t.hp<=t.hpMax*.30);
    if(ready)return `💉 ${ready.name||'Tiger'} is ready for capture.`;
    if(snap.objectivesReady)return '🚁 Extraction open — move to the exit together.';
    return '';
  }
  return Object.freeze({VERSION:'11.6',SIGNALS,COOLDOWN_MS,TTL_MS,makeSignal,activeSignals,guide,civilianStatus,callout});
});
