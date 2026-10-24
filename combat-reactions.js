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
  function warningState(attack,now=Date.now(),options={}){
    if(!attack||![attack.x,attack.y,attack.resolveAt].every(Number.isFinite))return null;
    const start=Number.isFinite(attack.startedAt)?attack.startedAt:attack.resolveAt-1000;
    if(now<start||now>=attack.resolveAt||attack.resolveAt<=start)return null;
    const requested=String(attack.kind||'').toLowerCase();
    const kind=['bite','claw','charge','pounce'].includes(requested)?requested:'pounce';
    const who=options.viewerId!=null&&attack.targetUserId!=null
      ?(String(options.viewerId)===String(attack.targetUserId)?'YOU':'TEAMMATE'):'';
    return {kind,progress:Math.max(0,Math.min(1,(now-start)/(attack.resolveAt-start))),
      label:`${kind.toUpperCase()}${who?' → '+who:''} • ${options.canRoll?'ROLL':'MOVE'}`};
  }
  function cueLabel(point,width,view,offset){
    if(view&&[view.x,view.y,view.w,view.h].every(Number.isFinite)&&view.w>20&&view.h>32&&point.x>=view.x&&point.x<=view.x+view.w&&point.y>=view.y&&point.y<=view.y+view.h){
      width=Math.min(width,view.w-12);
      return {width,x:clamp(point.x,view.x+width/2+6,view.x+view.w-width/2-6),y:clamp(point.y+offset,view.y+5,view.y+view.h-28)};
    }
    return {width,x:point.x,y:point.y+offset};
  }
  function drawWarning(ctx,tiger,attack,now=Date.now(),comfort={},options={}){
    const warning=warningState(attack,now,options);
    if(!warning||!valid(tiger))return;
    ctx.save();ctx.lineCap='round';ctx.strokeStyle='#fda4af';ctx.lineWidth=comfort.reducedFlashes?2:3;
    // Fixed attack destination, not a false moving hitbox. No flashing fill.
    ctx.globalAlpha=.65;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(tiger.x,tiger.y);ctx.lineTo(attack.x,attack.y);ctx.stroke();ctx.setLineDash([]);
    ctx.globalAlpha=1;ctx.strokeStyle='#fecdd3';ctx.beginPath();ctx.arc(attack.x,attack.y,27,-Math.PI/2,-Math.PI/2+Math.PI*2*warning.progress);ctx.stroke();
    ctx.beginPath();ctx.moveTo(attack.x-7,attack.y-7);ctx.lineTo(attack.x+7,attack.y+7);ctx.moveTo(attack.x+7,attack.y-7);ctx.lineTo(attack.x-7,attack.y+7);ctx.stroke();
    const label=cueLabel(attack,Math.min(260,warning.label.length*6.8+16),options.view,-60);
    ctx.fillStyle='rgba(12,18,29,.94)';ctx.fillRect(label.x-label.width/2,label.y,label.width,23);
    ctx.fillStyle='#ffe4e6';ctx.font='900 11px system-ui';ctx.textAlign='center';ctx.fillText(warning.label,label.x,label.y+16,label.width-8);
    ctx.restore();
  }
  function targetState(tiger,status={},options={}){
    if(!tiger||tiger.captured||tiger.defeated||tiger.alive===false||!(tiger.hp>0))return null;
    const stages={ready:['TRANQ / CAPTURE','#86efac'],weaken:['RUBBER TO WEAKEN','#93c5fd'],blocked:['NO CAPTURE • REAL HIT','#fda4af'],supply:['RESTOCK TRANQ','#fcd34d'],boss:['BOSS STRATEGY FIRST','#fcd34d'],survival:['REAL ONLY • SURVIVAL','#fda4af'],unavailable:['CANNOT CAPTURE','#fda4af']};
    const [hint,color]=stages[status.stage]||['TARGET','#e2e8f0'];
    return {color,label:options.inRange===false?'MOVE CLOSER':hint,id:String(tiger.id??''),inRange:options.inRange!==false};
  }
  function drawTarget(ctx,tiger,status,options={}){
    const target=targetState(tiger,status,options);if(!target||!valid(tiger))return;
    const r=Math.max(32,Math.min(60,Number(options.radius)||38));
    ctx.save();ctx.strokeStyle=target.color;ctx.lineWidth=2;ctx.setLineDash(target.inRange?[]:[4,4]);ctx.beginPath();
    for(const sx of [-1,1])for(const sy of [-1,1]){ctx.moveTo(tiger.x+sx*(r-10),tiger.y+sy*r);ctx.lineTo(tiger.x+sx*r,tiger.y+sy*r);ctx.lineTo(tiger.x+sx*r,tiger.y+sy*(r-10));}ctx.stroke();ctx.setLineDash([]);
    const text=`TARGET • ${target.label}`,label=cueLabel(tiger,Math.min(260,text.length*6.2+16),options.view,r+7);
    ctx.fillStyle='rgba(8,18,28,.94)';ctx.fillRect(label.x-label.width/2,label.y,label.width,22);ctx.fillStyle=target.color;ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText(text,label.x,label.y+15,label.width-8);ctx.restore();
  }
  function drawStrike(ctx,attack,now=Date.now(),comfort={},showWarning=true){
    if(!attack||![attack.x,attack.y,attack.tigerX,attack.tigerY,attack.startedAt,attack.resolveAt].every(Number.isFinite))return;
    const age=now-attack.resolveAt;if(now<attack.startedAt||age>480)return;
    const kind=String(attack.kind||'pounce').toUpperCase();
    ctx.save();ctx.lineCap='round';ctx.strokeStyle=age<0?'#f5b899':'#f3d4be';ctx.lineWidth=comfort.reducedFlashes?2:3;
    if(age<0){
      if(showWarning)drawWarning(ctx,{x:attack.tigerX,y:attack.tigerY},attack,now,comfort,{canRoll:true,view:comfort.view});
    }else{
      ctx.globalAlpha=Math.max(.15,1-age/480);ctx.translate(attack.x,attack.y-10);
      if(kind==='BITE'){
        for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(-19,side*12);ctx.quadraticCurveTo(0,side*(comfort.reducedFlashes?17:22),19,side*12);ctx.stroke();for(const x of [-10,0,10]){ctx.beginPath();ctx.moveTo(x,side*14);ctx.lineTo(x+2,side*6);ctx.stroke();}}
      }else for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-18+i*9,-17);ctx.quadraticCurveTo(3+i*9,-5,12+i*9,17);ctx.stroke();}
    }
    ctx.restore();
  }
  return Object.freeze({create,celebration,drawMoment,drawStrike,warningState,drawWarning,targetState,drawTarget});
});
