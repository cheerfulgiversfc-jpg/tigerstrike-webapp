(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerRescueTools=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const DEFS=Object.freeze({
    smoke:Object.freeze({id:'smoke',name:'Smoke Grenade',icon:'💨',charges:2,cooldown:12000,duration:8000}),
    'med-drone':Object.freeze({id:'med-drone',name:'Med Drone',icon:'🚑',charges:2,cooldown:10000,duration:3000}),
    flare:Object.freeze({id:'flare',name:'Signal Flare',icon:'🚨',charges:3,cooldown:9000,duration:14000})
  });
  function create(id='smoke'){const def=DEFS[id]||DEFS.smoke;return {id:def.id,charges:def.charges,cooldownUntil:0,uses:0,effect:null,lastEffect:''};}
  function ready(tool,now=Date.now()){
    if(!DEFS[tool?.id])throw new Error('Choose a valid rescue tool.');
    if(tool.charges<=0)throw new Error('No rescue-tool charges remain this mission.');
    if(now<tool.cooldownUntil)throw new Error(`Rescue tool recharges in ${Math.ceil((tool.cooldownUntil-now)/1000)} seconds.`);
    return DEFS[tool.id];
  }
  function used(tool,effect,message,now=Date.now()){
    const def=ready(tool,now);
    return {...tool,charges:tool.charges-1,uses:tool.uses+1,cooldownUntil:now+def.cooldown,lastEffect:message,effect:{...effect,kind:tool.id,until:now+def.duration}};
  }
  function smokeAt(players,point,now=Date.now()){
    return players.some(p=>{const e=p.rescueTool?.effect;return e?.kind==='smoke'&&e.until>now&&Math.hypot(e.x-point.x,e.y-point.y)<=300;});
  }
  function healingTarget(players=[],civilians=[],player={}){
    return [...players.filter(p=>!p.downed&&p.hp>0&&p.hp<p.maxHp).map(p=>({target:p,kind:'soldier',ratio:p.hp/p.maxHp})),...civilians.filter(c=>!c.secured&&!c.evac&&c.alive!==false&&c.hp>0&&c.hp<c.hpMax).map(c=>({target:c,kind:'civilian',ratio:c.hp/c.hpMax}))].filter(row=>Math.hypot(row.target.x-player.x,row.target.y-player.y)<=360).sort((a,b)=>a.ratio-b.ratio||String(a.target.userId||a.target.id).localeCompare(String(b.target.userId||b.target.id)))[0]||null;
  }
  function preview(tool,players,civilians,player){
    if(tool?.id==='smoke')return {x:player.x,y:player.y,r:300,label:'Smoke here • 300m cover • 8 seconds • breaks sound investigations'};
    if(tool?.id==='med-drone'){
      const pick=healingTarget(players,civilians,player);
      if(!pick)return {label:'No injured target within 360m • no charge will be used'};
      const t=pick.target,healed=Math.min(pick.kind==='soldier'?38:48,(t.maxHp||t.hpMax)-t.hp);
      return {x:t.x,y:t.y,r:28,label:`${t.name||'You'} +${healed} HP`,targetId:t.userId||t.id};
    }
    if(tool?.id==='flare')return {label:'Flare reveals the current objective and extraction • 14 seconds'};
    return {label:tool?.id==='tranq-kit'?'Tranq Kit prepares a nearby live tiger without lethal damage':tool?.id==='shock'?'Shock Baton staggers a nearby tiger without lethal damage':'Select a rescue tool before deployment'};
  }
  function drawPreview(ctx,p){
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return;
    ctx.save();ctx.strokeStyle='#67e8f9';ctx.lineWidth=2;ctx.setLineDash([9,7]);ctx.beginPath();ctx.arc(p.x,p.y,p.r||28,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  }
  function drawEffect(ctx,e,now=Date.now()){
    if(!ctx||!e||now>=e.until)return;
    ctx.save();ctx.textAlign='center';ctx.font='900 12px system-ui';
    if(e.kind==='smoke'){
      for(let i=0;i<12;i++){const a=i*.55+now*.0003,r=55+(i%4)*65;ctx.fillStyle='rgba(203,213,225,.12)';ctx.beginPath();ctx.arc(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,58,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle='#f1f5f9';ctx.fillText(`SMOKE COVER • ${Math.ceil((e.until-now)/1000)}s`,e.x,e.y-72);
    }else if(e.kind==='med-drone'){
      const x=e.x+Math.cos(now*.006)*22,y=e.y-42;
      globalThis.TigerStrikeBattlefieldRenderer?.drawMedDrone(ctx,{x,y},{now,variant:e.eliteAppearance?.soldier==='storm_medic'?'storm_medic':'base'});
      ctx.fillStyle='#bbf7d0';ctx.fillText(`${e.name||'Rescue target'} +${e.healed} HP`,e.x,e.y-65);
    }else if(e.kind==='flare'){
      const origin=e.origin||e;ctx.setLineDash([10,8]);ctx.lineWidth=3;
      for(const [p,color] of [[e.target,'#facc15'],[e.extraction,'#4ade80']]){if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.lineTo(p.x,p.y);ctx.stroke();ctx.fillStyle=color;ctx.fillText(p.action||p.label||'Extraction',p.x,p.y-36);}
      ctx.setLineDash([]);ctx.fillStyle='#facc15';ctx.fillText('FLARE • OBJECTIVE ROUTE',origin.x,origin.y-52);
    }
    ctx.restore();
  }
  return Object.freeze({VERSION:'11.8',DEFS,create,ready,used,smokeAt,healingTarget,preview,drawPreview,drawEffect});
});
