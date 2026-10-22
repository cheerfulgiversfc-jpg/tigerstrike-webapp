(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerCivilianRescue=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ARRIVAL_MS=2000;
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const point=p=>({x:p.x,y:p.y});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function start(civilian,leader,now=Date.now()){
    return {...point(civilian),path:[point(leader)],updatedAt:now};
  }
  // Follow the leader's verified route, not an offset that cuts across corners.
  function advance(raw,leader,now=Date.now(),{injured=false,paused=false,gap=36}={}){
    const state={...raw,path:(raw?.path||[]).filter(valid).map(point).slice(0,256)};
    if(!valid(state)||!valid(leader))return state;
    const tail=state.path[state.path.length-1]||state;
    if(distance(tail,leader)>6)state.path.push(point(leader));
    let budget=paused?0:Math.min(1000,Math.max(0,now-Number(state.updatedAt||now)))*(injured?.36:.50);
    const length=()=>{let last=state,total=0;for(const p of state.path){total+=distance(last,p);last=p;}return total;};
    budget=Math.min(budget,Math.max(0,length()-gap));
    while(budget>0&&state.path.length){
      const target=state.path[0],d=distance(state,target);
      if(d<=budget){state.x=target.x;state.y=target.y;budget-=d;state.path.shift();}
      else{state.x+=(target.x-state.x)*budget/d;state.y+=(target.y-state.y)*budget/d;budget=0;}
    }
    state.updatedAt=now;
    return state;
  }
  function arrival(from,door,at=Date.now()){
    return {from:point(from),door:point(door),at};
  }
  function arrivalFrame(event,now=Date.now()){
    if(!event||!valid(event.from)||!valid(event.door))return null;
    const progress=Math.max(0,Math.min(1,(now-event.at)/ARRIVAL_MS));
    return {x:event.from.x+(event.door.x-event.from.x)*progress,y:event.from.y+(event.door.y-event.from.y)*progress,alpha:Math.min(1,(1-progress)*4),done:progress>=1,progress};
  }
  function status(c={},viewerId=0){
    if(c.secured||c.evac)return 'Safely rescued';
    const injured=c.injured||c.aiState==='injured'||(Number.isFinite(c.hp)&&c.hp<Number(c.hpMax||100)*.5);
    if(c.following){const owner=c.escortOwner==='rescue'?'Rescue team':(!c.followingUserId||Number(c.followingUserId)===Number(viewerId)?'Following you':'Following teammate');return injured?`Injured • ${owner}`:owner;}
    return injured?'Injured • needs rescue':'Available to rescue';
  }
  function reaction(c={},tigers=[],now=Date.now()){
    if(c.secured||c.evac){const f=arrivalFrame(c.rescueArrival,now);return f&&!f.done?'Entering safety':'Safely rescued';}
    if(c.alive===false||c.dead)return '';
    if(tigers.some(t=>t.alive!==false&&!t.defeated&&Number(t.hp||0)>0&&distance(c,t)<180))return 'Tiger nearby!';
    if(c.following)return 'Stay together';
    return 'Help here!';
  }
  function drawReaction(ctx,c,tigers=[],now=Date.now()){
    const label=reaction(c,tigers,now);if(!label)return;
    if(label==='Stay together')return;
    ctx.save();ctx.translate(c.x,c.y);ctx.textAlign='center';ctx.font='900 11px system-ui';
    ctx.fillStyle=label==='Tiger nearby!'?'#fecaca':'#d1fae5';
    ctx.fillText(label,0,-66);
    if(label==='Entering safety'){
      ctx.strokeStyle=c.skin||'#d7a47f';ctx.lineWidth=5;ctx.lineCap='round';
      for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*12,-3);ctx.lineTo(side*22,-27+Math.sin(now*.009)*4);ctx.stroke();}
    }else if(!c.following&&!c.secured&&!c.evac){
      const handY=-25+Math.sin(now*.009)*5;
      ctx.strokeStyle=c.skin||'#d7a47f';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(12,-3);ctx.lineTo(22,handY);ctx.stroke();
    }
    ctx.restore();
  }
  return Object.freeze({VERSION:'11.8',ARRIVAL_MS,start,advance,arrival,arrivalFrame,status,reaction,drawReaction});
});
