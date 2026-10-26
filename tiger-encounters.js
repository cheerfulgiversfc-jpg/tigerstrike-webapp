(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerEncounters=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function personality(t={}){const type=String(t.type||'').toLowerCase();return t.boss||type==='alpha'?'Alpha • pack leader':type==='armored'?'Armored • heavy advance':/scout|stalker/.test(type)?'Stalker • ambush hunter':'Hunter • close pursuit';}
  const IDENTITIES=Object.freeze({Hunter:'Hunter',Ambusher:'Ambusher',Sentinel:'Sentinel',Fury:'Fury'});
  function profile(t={}){
    t=t&&typeof t==='object'?t:{};
    const saved=Object.keys(IDENTITIES).find(k=>k.toLowerCase()===String(t.personality||'').toLowerCase());
    const type=String(t.type||'').toLowerCase();
    const key=saved||(t.boss||type==='alpha'||type==='armored'?'Sentinel':/stalker|scout/.test(type)?'Ambusher':type==='berserker'?'Fury':'Hunter');
    return {key,label:IDENTITIES[key]};
  }
  const POSES=Object.freeze({
    resting:{head:0,ears:0,tail:0,crouch:0},patrol:{head:0,ears:0,tail:0,crouch:0},
    watching:{head:-1,ears:.18,tail:-3,crouch:0},stalking:{head:3,ears:-.22,tail:8,crouch:2},
    guarding:{head:-2,ears:.12,tail:1,crouch:0},recovering:{head:4,ears:-.32,tail:9,crouch:1},
    slowed:{head:2,ears:-.18,tail:6,crouch:1},drowsy:{head:5,ears:-.4,tail:10,crouch:2},
    windup:{head:1,ears:-.5,tail:9,crouch:5},alert:{head:-2,ears:-.18,tail:-3,crouch:0}
  });
  function intent(t={},now=Date.now(),options={}){
    t=t&&typeof t==='object'?t:{};now=Number.isFinite(now)?now:Date.now();
    const identity=profile(t),make=(key,label,until=0)=>{
      const pose={...POSES[key]};
      if(['patrol','watching','alert'].includes(key)){
        if(identity.key==='Ambusher'){pose.head+=1;pose.crouch+=1;pose.tail+=3;}
        if(identity.key==='Sentinel'){pose.head-=1;pose.ears+=.08;}
        if(identity.key==='Fury'){pose.ears-=.12;pose.tail+=3;}
        if(identity.key==='Hunter'&&key==='watching')pose.head-=1;
      }
      return {version:1,key,label,personality:identity.key,observedAt:now,until,pose};
    };
    if(t.faction==='government')return make('resting','');
    if(t.captured||t.cage)return make('resting','TRANQUILIZED');
    if(t.defeated||t.carcass||t.alive===false||Number(t.hp)<=0)return make('resting','DEAD');
    const interrupted=now<Number(t.holdUntil||0)||now<Number(t.staggerUntil||0);
    const attacks=[options.attack,t._battleAttack,...(Array.isArray(t.attackWarnings)?t.attackWarnings:[])].filter(Boolean);
    const warning=!interrupted&&attacks.find(a=>now>=Number(a.startedAt||0)&&now<Number(a.resolveAt)&&Number(t.lastRubberHitAt||0)<=Number(a.startedAt||0));
    const fieldWarning=!interrupted&&now<Number(t.pounceWindupUntil||0)&&Number(t.lastRubberHitAt||0)<=Number(t.pounceWindupStart||t.attackTelegraphStart||0);
    if(warning||fieldWarning)return make('windup','PREPARING STRIKE',Number(warning?.resolveAt||t.pounceWindupUntil));
    // These are presentation states, never commands to start an attack or flee.
    if(t.tranqTagged)return make('drowsy','TRANQ TAGGED');
    if(t.rubberSlowed||now<Number(t.rubberSlowUntil||0))return make('slowed','RUBBER • SLOWED',Number(t.rubberSlowUntil||0));
    if(t.huntState==='recover'&&now<Number(t.huntStateUntil||0))return make('recovering','RECOVERING',Number(t.huntStateUntil));
    const currentIntent=now<Number(t.intentUntil||0)?String(t.intent||'').toLowerCase():'';
    if(/guard wounded/.test(currentIntent))return make('guarding','GUARDING PACK',Number(t.intentUntil));
    const aiActive=now<Number(t._ai2BehaviorUntil||0);
    if(t.huntState==='stalk'&&now<Number(t.huntStateUntil||0)||aiActive&&['ambush','flank_player'].includes(t._ai2Behavior))return make('stalking',aiActive&&t._ai2Behavior==='flank_player'?'FLANKING':'STALKING',Math.max(Number(t.huntStateUntil||0),Number(t._ai2BehaviorUntil||0)));
    // Co-op clients consume the same server-issued idle/awareness intent. Its
    // patrol is not misrepresented as a new chase or retreat AI.
    const authoritative=t.behaviorIntent;
    if(!options.server&&authoritative?.version===1&&['patrol','watching','alert'].includes(authoritative.key)&&now>=Number(authoritative.observedAt)&&now-Number(authoritative.observedAt)<1800)return make(authoritative.key,authoritative.key==='patrol'?'PATROLLING':authoritative.key==='watching'?'WATCHING':t.awarenessState==='blood_frenzy'?'BLOOD FRENZY':'ALERT');
    const awareness=String(t.awarenessState||'calm');
    if(['attacking','blood_frenzy'].includes(awareness))return make('alert',awareness==='blood_frenzy'?'BLOOD FRENZY':'ALERT');
    if(['suspicious','stalking'].includes(awareness))return make('watching','WATCHING');
    return make('patrol','PATROLLING');
  }
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
    const cue=intent(t,now);
    return {warning,hit,crouch:warning?.20:0,slowed:!!t.rubberSlowed||now<Number(t.rubberSlowUntil||0),label:warning?'POUNCE — MOVE!':`${profile(t).label} • ${cue.label}`,cue};
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
  return Object.freeze({VERSION:'13.6',personality,profile,intent,beginAttack,resolveAttack,posture,drawWarning});
});
