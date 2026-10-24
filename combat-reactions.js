(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerCombatReactions=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  function celebration(entity,now=Date.now()){
    if(!(entity?.evac||entity?.secured||entity?.boardedAt)||entity.alive===false)return 0;
    const at=Number(entity?.rescueArrival?.at||entity?.boardedAt||0),age=now-at;
    return at>0&&age>=0&&age<1800?Math.sin(Math.PI*Math.min(1,age/1800)):0;
  }
  function create(onMoment=()=>{}){
    let run='',previous=null,latest=-Infinity,allowStart=false;
    const poses=new Map(),seen=new Set(),bosses=new Set();let moments=[];
    function reset(key='',announce=false){run=key;previous=null;latest=-Infinity;poses.clear();seen.clear();bosses.clear();moments=[];allowStart=announce;}
    function moment(kind,id,point,now=Date.now()){
      if(!['boss','capture','escape','rescue'].includes(kind)||!valid(point)||seen.has(id))return false;
      seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);
      if(kind==='rescue'){
        const existing=moments.find(m=>m.kind==='rescue'&&now-m.born<200&&Math.hypot(m.x-point.x,m.y-point.y)<150);
        if(existing){existing.count=Number(existing.count||1)+1;return true;}
      }
      const m={kind,id,x:point.x,y:point.y,born:now};moments.push(m);if(moments.length>8)moments.shift();try{onMoment(m);}catch(_){}return true;
    }
    function hurt(id,now=Date.now()){poses.set(`soldier:${id}`,{at:now,duration:340});if(poses.size>64)poses.delete(poses.keys().next().value);}
    function shot(e,now=Date.now()){
      if(!e?.id)return;
      if(e.captured)moment('capture',`capture:${e.id}`,{x:e.x2,y:e.y2},now);
      else if(!e.killed&&!e.civilian){poses.set(`tiger:${e.targetId}`,{at:now,duration:e.mode==='rubber'?380:240});if(poses.size>64)poses.delete(poses.keys().next().value);}
    }
    function pose(kind,id,now=Date.now(),comfort={}){
      const p=poses.get(`${kind}:${id}`);if(!p)return 0;
      const age=now-p.at;if(age<0||age>=p.duration){poses.delete(`${kind}:${id}`);return 0;}
      return Math.sin(age/p.duration*Math.PI)*(comfort.reducedFlashes?.35:1);
    }
    function observe(s,now=Date.now()){
      if(!s||!Number.isFinite(s.serverNow))return;
      const key=`${s.code}:${s.startedAt}`,start=previous?.code===s.code&&['waiting','complete','failed'].includes(previous.status)&&s.status==='active';
      const fresh=key!==run||!previous;
      if(key!==run)reset(key,start);
      if(s.serverNow<latest)return;latest=s.serverNow;
      const players=s.players||[],active=s.status==='active'&&!s.paused;
      for(const p of players)if((fresh||!active)&&p.lastEvasion?.id)seen.add(p.lastEvasion.id);
      if(active){
        for(const p of players){
          const old=previous?.players.get(String(p.userId));
          if(!fresh&&old&&(p.hp<old.hp||p.armor<old.armor))hurt(p.userId,now);
          const escape=p.lastEvasion,age=s.serverNow-Number(escape?.at);
          if(!fresh&&escape?.kind==='dodged'&&age>=0&&age<1500)moment('escape',escape.id,escape,now);
        }
        const oldSafe=previous?.safe||new Set(),safe=new Set(s.securedCivilianIds||[]);
        if(!fresh)for(const id of safe)if(!oldSafe.has(id)){
          const c=(s.civilians||[]).find(c=>String(c.id)===String(id));
          const point=c?.rescueArrival?.door||c||s.rescueHouse;if(valid(point))moment('rescue',`${run}:safe:${id}`,point,now);
        }
        for(const t of s.tigers||[]){
          if(!t.boss||t.defeated||t.captured||t.alive===false||!(t.hp>0)||!valid(t))continue;
          if(!players.some(p=>valid(p)&&Math.hypot(p.x-t.x,p.y-t.y)<650)||bosses.has(String(t.id)))continue;
          bosses.add(String(t.id));
          if(!fresh||allowStart)moment('boss',`${run}:boss:${t.id}`,t,now);
        }
      }
      previous={code:s.code,status:s.status,players:new Map(players.map(p=>[String(p.userId),{hp:Number(p.hp),armor:Number(p.armor)}])),safe:new Set(s.securedCivilianIds||[])};
      allowStart=false;
    }
    function draw(ctx,now=Date.now(),comfort={},view=null){
      moments=moments.filter(m=>now-m.born>=0&&now-m.born<1200);
      for(const m of moments)drawMoment(ctx,m,now-m.born,comfort,view);
    }
    return {reset,moment,hurt,shot,pose,observe,draw,count:()=>moments.length};
  }
  function drawMoment(ctx,m,age,comfort={},view=null){
    if(age<0||age>=1200)return;
    const colors={boss:'#fbbf24',capture:'#a5f3cf',escape:'#bfe5f5',rescue:'#86efac'},labels={boss:'BOSS ENCOUNTER',capture:'CAPTURE SECURED',escape:'ATTACK EVADED',rescue:'CIVILIAN SAFE'};
    if(!labels[m.kind])return;
    const x=view?clamp(m.x,view.x+100,view.x+view.w-100):m.x,y=view?clamp(m.y-80,view.y+110,view.y+view.h-38):m.y-80;
    const text=m.kind==='rescue'&&m.count>1?`${m.count} CIVILIANS SAFE`:labels[m.kind];
    ctx.save();ctx.globalAlpha=Math.min(1,(1200-age)/240);ctx.lineWidth=1.5;ctx.strokeStyle=colors[m.kind];ctx.fillStyle='rgba(6,24,29,.92)';ctx.fillRect(x-94,y-18,188,30);ctx.strokeRect(x-94,y-18,188,30);ctx.fillStyle=colors[m.kind];ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.fillText(text,x,y+2);
    // No full-screen flash, camera takeover, timer or input mutation.
    if(!comfort.reducedFlashes)for(let i=0;i<6;i++){
      const angle=i*Math.PI/3,spread=20+Math.min(1,age/700)*22;
      ctx.beginPath();ctx.moveTo(x+Math.cos(angle)*spread,y-32+Math.sin(angle)*8);ctx.lineTo(x+Math.cos(angle)*(spread+4),y-32+Math.sin(angle)*8-3);ctx.stroke();
    }
    ctx.restore();
  }
  return Object.freeze({create,celebration,drawMoment});
});
