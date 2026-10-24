(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerEncounters=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function personality(t={}){const type=String(t.type||'').toLowerCase();return t.boss||type==='alpha'?'Alpha • pack leader':type==='armored'?'Armored • heavy advance':/scout|stalker/.test(type)?'Stalker • ambush hunter':'Hunter • close pursuit';}
  function beginAttack(tiger,player,now=Date.now(),solo=false,runId=''){
    return {tigerId:tiger.id,tigerX:tiger.x,tigerY:tiger.y,targetUserId:player.userId,x:player.x,y:player.y,startedAt:now,resolveAt:now+(solo?1250:1000),runId};
  }
  function resolveAttack(attack,tiger,player,now=Date.now(),runId=''){
    if(!attack||attack.runId!==runId||!tiger||tiger.defeated||tiger.hp<=0)return 'cancelled';
    if(Number(tiger.lastRubberHitAt||0)>attack.startedAt)return 'interrupted';
    if(now<attack.resolveAt)return 'warning';
    if(now>attack.resolveAt+1800)return 'expired';
    return Math.hypot(player.x-attack.x,player.y-attack.y)<=62?'hit':'dodged';
  }
  function posture(t={},now=Date.now()){
    const warning=(t.attackWarnings||[]).some(a=>now<a.resolveAt)||now<Number(t.pounceWindupUntil||0);
    const hit=now<Number(t.hitFlashUntil||t.hitUntil||0);
    return {warning,hit,crouch:warning?.20:0,slowed:!!t.rubberSlowed||now<Number(t.rubberSlowUntil||0),label:warning?'POUNCE — MOVE!':hit?'HIT':(t.rubberSlowed||now<Number(t.rubberSlowUntil||0)?'SLOWED':personality(t))};
  }
  function drawWarning(ctx,tiger,attack,now=Date.now(),options={}){
    if(typeof globalThis.TigerCombatReactions?.drawWarning==='function'){
      globalThis.TigerCombatReactions.drawWarning(ctx,tiger,attack,now,globalThis.TigerCombatFeel?.settings?.()||{},options);return;
    }
    if(!attack||now>=attack.resolveAt)return;
    ctx.save();ctx.strokeStyle='#fb7185';ctx.fillStyle='rgba(251,113,133,.16)';ctx.lineWidth=3;
    const angle=Math.atan2(attack.y-tiger.y,attack.x-tiger.x),side=25;
    ctx.beginPath();ctx.moveTo(tiger.x-Math.sin(angle)*side,tiger.y+Math.cos(angle)*side);ctx.lineTo(attack.x,attack.y);ctx.lineTo(tiger.x+Math.sin(angle)*side,tiger.y-Math.cos(angle)*side);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(attack.x-20,attack.y-20);ctx.lineTo(attack.x+20,attack.y+20);ctx.moveTo(attack.x+20,attack.y-20);ctx.lineTo(attack.x-20,attack.y+20);ctx.stroke();
    ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffe4e6';ctx.fillText('POUNCE — MOVE!',attack.x,attack.y-35);ctx.restore();
  }
  return Object.freeze({VERSION:'11.7',personality,beginAttack,resolveAttack,posture,drawWarning});
});
