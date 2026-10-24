(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerCombatFeel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  const COLORS=Object.freeze({real:'#ffb66e',rubber:'#5eead4',tranq:'#a5b4fc'});
  function normalizeSettings(raw={},reducedMotion=false){return {vibration:raw.vibration===true,reducedFlashes:raw.reducedFlashes===undefined?!!reducedMotion:!!raw.reducedFlashes,shake:clamp(raw.shake===undefined?(reducedMotion?0:25):raw.shake,0,100)};}
  let cached=null;
  function settings(){
    if(cached)return cached;
    let raw={},reduced=false;try{raw=JSON.parse(localStorage.getItem('tiger_combat_comfort')||'{}');}catch(_){}
    try{reduced=!!matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(_){}
    return cached=normalizeSettings(raw||{},reduced);
  }
  function saveSettings(raw){cached=normalizeSettings({...settings(),...raw});try{localStorage.setItem('tiger_combat_comfort',JSON.stringify(cached));}catch(_){}return cached;}
  function event(raw){
    if(!raw||!['real','rubber','tranq'].includes(raw.mode)||typeof raw.id!=='string'||!raw.id)return null;
    if(![raw.at,raw.x1,raw.y1,raw.x2,raw.y2].every(Number.isFinite))return null;
    return {id:raw.id.slice(0,140),at:raw.at,mode:raw.mode,x1:raw.x1,y1:raw.y1,x2:raw.x2,y2:raw.y2,actorId:String(raw.actorId||''),targetId:String(raw.targetId||''),killed:raw.killed===true,captured:raw.captured===true,tagged:raw.tagged===true,civilian:raw.civilian===true,accent:typeof raw.accent==='string'?raw.accent.slice(0,60):'',width:clamp(raw.width||2,1,6)};
  }
  function label(e){return e.mode==='real'?(e.civilian?'REAL HIT':e.killed?'ELIMINATED':'REAL • CAPTURE BLOCKED'):e.mode==='rubber'?(e.civilian?'RUBBER HIT':'RUBBER • NONLETHAL'):(e.captured?'CAPTURED':e.tagged?'TRANQ TAGGED':'TRANQ');}
  function create(onEvent=()=>{}){
    const seen=new Set();let active=[],run=null,latestServer=-Infinity;
    function remember(id){seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value);}
    function emit(raw,now=Date.now(),silent=false){
      const e=event(raw);if(!e||seen.has(e.id))return false;remember(e.id);
      if(silent)return false;
      active.push({...e,born:now});if(active.length>32)active.shift();try{onEvent(e);}catch(_){}return true;
    }
    function ingest(snapshot,now=Date.now()){
      const key=`${snapshot.code}:${snapshot.startedAt}`,fresh=key!==run;
      if(fresh){run=key;active=[];seen.clear();latestServer=-Infinity;}
      if(!Number.isFinite(snapshot.serverNow)||snapshot.serverNow<latestServer)return;
      latestServer=snapshot.serverNow;
      for(const p of snapshot.players||[])for(const raw of (p.combatEvents||[]).slice(-8)){
        const e=event(raw);if(!e)continue;
        const age=Number(snapshot.serverNow)-e.at;
        emit(e,now,fresh||snapshot.status!=='active'||snapshot.paused||age<0||age>900);
      }
    }
    function live(now){active=active.filter(e=>now-e.born>=0&&now-e.born<620);return active;}
    function draw(ctx,now=Date.now(),comfort=settings()){
      for(const e of live(now))drawEvent(ctx,e,now-e.born,comfort);
    }
    function shake(now=Date.now(),comfort=settings()){
      if(!comfort.shake||comfort.reducedFlashes)return {x:0,y:0};
      const e=live(now).filter(e=>now-e.born<150).at(-1);if(!e)return {x:0,y:0};
      const t=now-e.born,amp=(1-t/150)*comfort.shake/100*(e.mode==='real'?2:1);
      return {x:Math.sin(t*.13)*amp,y:Math.cos(t*.11)*amp*.65};
    }
    function pose(actorId,now=Date.now()){
      const e=live(now).filter(e=>e.actorId===String(actorId)&&now-e.born<140).at(-1);
      return e?{face:Math.atan2(e.y2-e.y1,e.x2-e.x1),kick:Math.sin((now-e.born)/140*Math.PI)}:null;
    }
    return {emit,ingest,draw,shake,pose,clear(){active=[];seen.clear();run=null;latestServer=-Infinity;},count:()=>active.length};
  }
  function drawEvent(ctx,e,age,comfort){
    if(age<0||age>=620)return;
    const color=COLORS[e.mode],dx=e.x2-e.x1,dy=e.y2-e.y1,angle=Math.atan2(dy,dx),ux=Math.cos(angle),uy=Math.sin(angle),mx=e.x1+ux*32,my=e.y1+uy*32-5;
    ctx.save();ctx.lineCap='round';ctx.lineWidth=2;ctx.strokeStyle=color;ctx.fillStyle=color;
    if(age<100&&!comfort.reducedFlashes){
      ctx.save();ctx.translate(mx,my);ctx.rotate(angle);ctx.globalAlpha=1-age/100;ctx.beginPath();ctx.moveTo(-3,0);ctx.lineTo(8,-4);ctx.lineTo(16,0);ctx.lineTo(8,4);ctx.closePath();ctx.fill();ctx.restore();
      ctx.globalAlpha=(1-age/100)*.7;ctx.strokeStyle=e.accent||color;ctx.lineWidth=e.width||2;ctx.setLineDash(e.mode==='tranq'?[4,8]:[]);ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(e.x2,e.y2-10);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle=color;ctx.lineWidth=2;
    }
    ctx.globalAlpha=comfort.reducedFlashes?.65:Math.max(.15,1-age/620);
    const r=7+Math.min(age,220)/22;
    ctx.beginPath();
    if(e.mode==='rubber'){
      for(const dir of [-1,1]){ctx.moveTo(e.x2+dir*(r+7),e.y2-16);ctx.lineTo(e.x2+dir*r,e.y2-10);ctx.lineTo(e.x2+dir*(r+7),e.y2-4);}
    }else if(e.mode==='tranq'){ctx.arc(e.x2,e.y2-10,r,0,Math.PI*1.6);}
    else for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.moveTo(e.x2+Math.cos(a)*r,e.y2-10+Math.sin(a)*r);ctx.lineTo(e.x2+Math.cos(a)*(r+6),e.y2-10+Math.sin(a)*(r+6));}
    ctx.stroke();ctx.globalAlpha=Math.min(1,(620-age)/140);ctx.font='900 11px system-ui';ctx.textAlign='center';
    const text=label(e),width=Math.min(215,text.length*7+12),y=e.y2-47-(comfort.reducedFlashes?0:age/55);
    ctx.fillStyle='rgba(6,18,26,.9)';ctx.fillRect(e.x2-width/2,y-13,width,20);ctx.fillStyle=color;ctx.fillText(text,e.x2,y+1);ctx.restore();
  }
  function openComfort(){
    const dialog=document.getElementById('combatComfortDialog');if(!dialog)return;
    window.resetControlInputState?.('combat-comfort');window.dispatchEvent(new Event('combat-comfort-open'));
    const value=settings();document.getElementById('combatVibration').checked=value.vibration;document.getElementById('combatReducedFlashes').checked=value.reducedFlashes;document.getElementById('combatShake').value=value.shake;document.getElementById('combatShakeValue').textContent=`${value.shake}%`;
    if(!dialog.open)dialog.showModal();
  }
  function updateComfort(){const value=saveSettings({vibration:document.getElementById('combatVibration').checked,reducedFlashes:document.getElementById('combatReducedFlashes').checked,shake:document.getElementById('combatShake').value});document.getElementById('combatShakeValue').textContent=`${value.shake}%`;}
  return Object.freeze({COLORS,normalizeSettings,settings,saveSettings,event,label,create,drawEvent,openComfort,updateComfort});
});
