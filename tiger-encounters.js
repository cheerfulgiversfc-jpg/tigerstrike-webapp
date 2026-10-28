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
    windup:{head:1,ears:-.5,tail:9,crouch:5},alert:{head:-2,ears:-.18,tail:-3,crouch:0},
    retreating:{head:3,ears:-.32,tail:10,crouch:1},
    circling:{head:1,ears:-.12,tail:6,crouch:2},approaching:{head:-1,ears:.08,tail:2,crouch:1},
    investigating:{head:-2,ears:.2,tail:3,crouch:1},searching:{head:1,ears:.12,tail:-2,crouch:0}
  });
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const bounded=(n,a,b)=>Math.max(a,Math.min(b,n));
  function retreat(t,threat,at,options={}){
    if(!valid(t)||!valid(threat)||!Number.isFinite(at)||t.boss||t.faction==='government'||t.captured||t.defeated||t.alive===false||options.survival||options.requiredCapture||options.engaged)return null;
    const ratio=Number(t.hp)/Math.max(1,Number(t.hpMax)||1),identity=profile(t).key;
    if(!Number.isFinite(ratio)||!['Hunter','Ambusher'].includes(identity)||ratio<=.35||ratio>.65||Number(options.cooldownUntil||0)>at)return null;
    if(t.tranqTagged||at<Number(t.holdUntil||0)||at<Number(t.staggerUntil||0)||(t.attackWarnings||[]).length||t._battleAttack||at<Number(t.pounceWindupUntil||0))return null;
    const dx=t.x-threat.x,dy=t.y-threat.y,distance=Math.hypot(dx,dy);
    if(distance>120)return null;
    return {at,until:at+1600,cooldownUntil:at+10000,dx:distance?dx/distance:1,dy:distance?dy/distance:0};
  }
  function retreatPoint(point,reaction,at,world={width:4800,height:2800}){
    if(!valid(point)||!reaction||![reaction.at,reaction.until,reaction.dx,reaction.dy,at].every(Number.isFinite)||at<=reaction.at||at>=reaction.until)return {...point,retreating:false};
    const progress=bounded((at-reaction.at)/Math.max(1,reaction.until-reaction.at),0,1),offset=24*Math.sin(Math.PI*progress)**2;
    const length=Math.max(1,Math.hypot(reaction.dx,reaction.dy)),w=Math.max(48,Number(world.width)||4800),h=Math.max(48,Number(world.height)||2800);
    return {x:bounded(point.x+reaction.dx/length*offset,24,w-24),y:bounded(point.y+reaction.dy/length*offset,24,h-24),retreating:true};
  }
  function activeReaction(reactions,runAt,at){
    const owner=reactions.filter(r=>r&&r.runAt===runAt&&at>=r.at&&at<r.cooldownUntil).sort((a,b)=>a.at-b.at)[0];
    return owner&&at<owner.until?owner:null;
  }
  // One pair at a time, with a visible one-second lead-in. These short steps
  // never grant an attack, change damage, or replace collision/pathfinding.
  function packPlans(tigers=[],players=[],at,options={}){
    if(!Number.isFinite(at)||options.engaged||options.survival||options.requiredCapture||tigers.some(t=>Number(t.encounterCooldownUntil||t._encounterCooldownUntil||0)>at))return [];
    const usable=t=>valid(t)&&t.alive!==false&&!t.defeated&&!t.captured&&!t.boss&&t.faction!=='government'&&Number(t.hp)>Number(t.hpMax)*.35&&!t.tranqTagged&&!t.rubberSlowed&&at>=Number(t.rubberSlowUntil||0)&&at>=Number(t.holdUntil||0)&&at>=Number(t.staggerUntil||0)&&!t.attackWarnings?.length&&!t._battleAttack&&t.huntState!=='pounce'&&at>=Number(t.pounceWindupUntil||0)&&!t._encounterMotion&&t.id!==options.lockedId&&['Hunter','Ambusher'].includes(profile(t).key);
    const candidates=tigers.filter(usable).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
    for(const player of players.filter(p=>valid(p)&&!p.downed&&p.alive!==false&&p.online!==false).sort((a,b)=>String(a.userId||a.id||'').localeCompare(String(b.userId||b.id||'')))){
      const nearby=candidates.filter(t=>{const d=Math.hypot(t.x-player.x,t.y-player.y);return d>=180&&d<=340&&!(options.civilians||[]).some(c=>valid(c)&&c.alive!==false&&!c.evac&&!c.secured&&Math.hypot(c.x-t.x,c.y-t.y)<180);}).sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y)||String(a.id).localeCompare(String(b.id)));
      const lead=nearby[0],flank=lead&&nearby.slice(1).find(t=>(!t.packId||!lead.packId||t.packId===lead.packId)&&Math.hypot(t.x-lead.x,t.y-lead.y)<=240);
      if(!flank)continue;
      return [lead,flank].map((t,i)=>{
        const d=Math.max(1,Math.hypot(player.x-t.x,player.y-t.y)),ux=(player.x-t.x)/d,uy=(player.y-t.y)/d;
        const side=String(flank.id)<String(lead.id)?-1:1,dx=i?-uy*side:ux*2/3,dy=i?ux*side:uy*2/3;
        const w=Math.max(48,Number(options.world?.width)||4800),h=Math.max(48,Number(options.world?.height)||2800);
        return {id:t.id,kind:i?'circle':'approach',partnerId:i?lead.id:flank.id,at,until:at+3000,cooldownUntil:at+12000,dx,dy,goal:{x:bounded(t.x+dx*24,24,w-24),y:bounded(t.y+dy*24,24,h-24)}};
      });
    }
    return [];
  }
  function packPoint(point,reaction,at,world){
    if(!reaction||!['circle','approach'].includes(reaction.kind))return {...point,packRole:''};
    const moved=retreatPoint(point,{...reaction,at:reaction.at+1000},at,world);
    return {...moved,retreating:false,packRole:at>=reaction.at&&at<reaction.until?reaction.kind:''};
  }
  function smokeBreaks(point,noise,smokes=[],at){
    return smokes.some(s=>valid(s)&&Number(s.until)>at&&[point,noise].some(p=>valid(p)&&Math.hypot(s.x-p.x,s.y-p.y)<=300));
  }
  function investigationPlans(tigers=[],noises=[],at,options={}){
    const clock=Number.isFinite(options.motionAt)?options.motionAt:at;
    if(!Number.isFinite(at)||options.engaged||options.survival||options.requiredCapture||tigers.some(t=>Number(t.encounterCooldownUntil||t._encounterCooldownUntil||0)>clock))return [];
    const events=noises.filter(n=>valid(n)&&n.source==='gunshot'&&Number.isFinite(n.at)&&n.at<=at&&at-n.at<=4000&&at<Number(n.expiresAt||n.at+4000)).sort((a,b)=>b.at-a.at||a.x-b.x||a.y-b.y);
    for(const noise of events){
      const candidates=tigers.filter(t=>valid(t)&&t.alive!==false&&!t.defeated&&!t.captured&&!t.boss&&t.faction!=='government'&&Number(t.hp)>Number(t.hpMax)*.35&&!t.tranqTagged&&!t.rubberSlowed&&at>=Number(t.holdUntil||0)&&at>=Number(t.staggerUntil||0)&&at>=Number(t.rubberSlowUntil||0)&&!t.attackWarnings?.length&&!t._battleAttack&&t.huntState!=='pounce'&&at>=Number(t.pounceWindupUntil||0)&&!t._encounterMotion&&t.id!==options.lockedId&&['Hunter','Ambusher'].includes(profile(t).key)&&!smokeBreaks(t,noise,options.smokes,at)).sort((a,b)=>Math.hypot(a.x-noise.x,a.y-noise.y)-Math.hypot(b.x-noise.x,b.y-noise.y)||String(a.id).localeCompare(String(b.id)));
      for(const t of candidates){
        const distance=Math.hypot(noise.x-t.x,noise.y-t.y);if(distance<100||distance>Math.min(360,Number(noise.radius)||360))continue;
        const dx=(noise.x-t.x)/distance,dy=(noise.y-t.y)/distance;
        const w=Math.max(48,Number(options.world?.width)||4800),h=Math.max(48,Number(options.world?.height)||2800),goal={x:bounded(t.x+dx*64,24,w-24),y:bounded(t.y+dy*64,24,h-24)};
        // A lure must not lead toward a civilian or through their position.
        if((options.civilians||[]).some(c=>valid(c)&&c.alive!==false&&!c.evac&&!c.secured&&(Math.hypot(c.x-noise.x,c.y-noise.y)<180||Math.hypot(c.x-goal.x,c.y-goal.y)<Math.min(160,Math.hypot(c.x-t.x,c.y-t.y)+12))))continue;
        return [{id:t.id,kind:'investigate',at:clock,until:clock+6000,cooldownUntil:clock+14000,dx,dy,noiseX:noise.x,noiseY:noise.y,goal}];
      }
    }
    return [];
  }
  function investigationPoint(point,reaction,at,world={width:4800,height:2800},breakAt=null){
    if(!valid(point)||reaction?.kind!=='investigate')return {...point,investigating:false,searching:false};
    const amount=time=>time<=reaction.at+600||time>=reaction.until?0:64*Math.sin(Math.PI*bounded((time-reaction.at-600)/Math.max(1,reaction.until-reaction.at-600),0,1))**2;
    const broken=Number.isFinite(breakAt)&&breakAt>=reaction.at&&at>=breakAt;
    const offset=broken?amount(breakAt)*(1-(1-Math.cos(Math.PI*bounded((at-breakAt)/600,0,1)))/2):amount(at);
    const length=Math.max(1,Math.hypot(reaction.dx,reaction.dy));
    return {x:bounded(point.x+reaction.dx/length*offset,24,Math.max(48,Number(world.width)||4800)-24),y:bounded(point.y+reaction.dy/length*offset,24,Math.max(48,Number(world.height)||2800)-24),investigating:!broken&&at>=reaction.at&&at<reaction.until,searching:broken&&at<Math.min(reaction.until,breakAt+1200)};
  }
  function patrol(t,elapsed,world,territorial=false){
    const guard=territorial&&!t.boss&&t.faction!=='government'&&profile(t).key==='Sentinel';
    const radius=guard?1-.32*bounded(elapsed/4,0,1):1;
    return {x:bounded(t.baseX+Math.cos(elapsed*t.speed+t.phase)*t.rangeX*radius,70,world.width-70),y:bounded(t.baseY+Math.sin(elapsed*t.speed*.83+t.phase)*t.rangeY*radius,90,world.height-80),guarding:guard};
  }
  function fieldPlan(t,threat,at,options={}){
    if(!valid(t)||!valid(threat)||options.engaged||options.survival||options.requiredCapture||t.boss||t.faction==='government'||t.captured||t.defeated||t.alive===false||!(t.hp>0)||t.tranqTagged||at<Number(t.holdUntil||0)||at<Number(t.staggerUntil||0)||t.huntState==='pounce'||at<Number(t._feintUntil||0))return null;
    const previous=options.previous;
    if(previous?.kind==='investigate'&&at<previous.until){
      if(Number(t.hp)<=Number(t.hpMax)*.35)return null;
      if(smokeBreaks(t,{x:previous.noiseX,y:previous.noiseY},options.smokes,at))return {kind:'search',at,until:at+1200,goal:{x:t.x,y:t.y},waiting:true};
      return {...previous,waiting:at<previous.at+600||Math.hypot(t.x-previous.goal.x,t.y-previous.goal.y)<8};
    }
    if(previous?.kind==='search'&&at<previous.until)return previous;
    if(['circle','approach'].includes(previous?.kind)&&at<previous.until){
      if(Number(t.hp)<=Number(t.hpMax)*.35||options.nearCivilian||options.guardBlocked)return null;
      return {...previous,waiting:at<previous.at+1000||Math.hypot(t.x-previous.goal.x,t.y-previous.goal.y)<8};
    }
    if(previous?.kind==='retreat'&&at<previous.until)return valid(previous.goal)&&Math.hypot(t.x-previous.goal.x,t.y-previous.goal.y)>8?previous:null;
    const response=retreat(t,threat,at,options);
    if(response){
      const w=Math.max(48,Number(options.world?.width)||4800),h=Math.max(48,Number(options.world?.height)||2800);
      return {kind:'retreat',until:response.until,cooldownUntil:response.cooldownUntil,goal:{x:bounded(t.x+response.dx*24,24,w-24),y:bounded(t.y+response.dy*24,24,h-24)}};
    }
    if(profile(t).key!=='Sentinel'||options.guardBlocked||options.nearCivilian||!valid(options.home)||Math.hypot(t.x-threat.x,t.y-threat.y)<=240||at<Number(t._ai2BehaviorUntil||0)||at<Number(t._ecoBehaviorUntil||0))return null;
    const home=options.home,away=Math.hypot(t.x-home.x,t.y-home.y),angle=at/3000;
    return {kind:'guard',until:at+250,goal:away>120?{x:home.x,y:home.y}:{x:home.x+Math.cos(angle)*44,y:home.y+Math.sin(angle)*32}};
  }
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
    if((t.encounterRetreating&&now<Number(t.encounterUntil||0))||(t._encounterMotion?.kind==='retreat'&&now<Number(t._encounterMotion.until||0)))return make('retreating','CAUTIOUS RETREAT');
    if(t.rubberSlowed||now<Number(t.rubberSlowUntil||0))return make('slowed','RUBBER • SLOWED',Number(t.rubberSlowUntil||0));
    if(t.huntState==='recover'&&now<Number(t.huntStateUntil||0))return make('recovering','RECOVERING',Number(t.huntStateUntil));
    const pursuitPhase=now<Number(t.pursuitUntil||t._pursuit?.phaseUntil||0)?t.pursuitPhase||t._pursuit?.phase:'';
    if(pursuitPhase==='warn')return make('watching','TRACKING • MOVE');
    if(pursuitPhase==='pursuit')return make('stalking','PURSUING');
    if(pursuitPhase==='search')return make('searching','SEARCHING LAST SIGHTING');
    if(pursuitPhase==='regroup')return make('guarding','RETURNING TO TERRITORY');
    if(t.encounterSearching&&now<Number(t.encounterSearchUntil||0)||t._encounterMotion?.kind==='search'&&now<Number(t._encounterMotion.until||0))return make('searching','LOST THE TRAIL');
    if(t.encounterInvestigating&&now<Number(t.encounterInvestigationUntil||0)||t._encounterMotion?.kind==='investigate'&&now<Number(t._encounterMotion.until||0))return make('investigating','INVESTIGATING SOUND');
    const packRole=t.encounterPackRole||t._encounterMotion?.kind;
    if(['circle','approach'].includes(packRole)&&now<Number(t.encounterPackUntil||t._encounterMotion?.until||0))return make(packRole==='circle'?'circling':'approaching',packRole==='circle'?'CIRCLING • WATCH':'APPROACHING • WATCH');
    const currentIntent=now<Number(t.intentUntil||0)?String(t.intent||'').toLowerCase():'';
    if(/guard wounded/.test(currentIntent))return make('guarding','GUARDING PACK',Number(t.intentUntil));
    if(t.encounterGuarding||t._encounterMotion?.kind==='guard'&&now<Number(t._encounterMotion.until||0))return make('guarding','GUARDING TERRITORY');
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
  return Object.freeze({VERSION:'13.9',personality,profile,intent,retreat,retreatPoint,activeReaction,packPlans,packPoint,smokeBreaks,investigationPlans,investigationPoint,patrol,fieldPlan,beginAttack,resolveAttack,posture,drawWarning});
});
