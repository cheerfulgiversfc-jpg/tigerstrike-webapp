(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerPursuit=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PHASES=['warn','pursuit','search','regroup','rest','held','strike'];
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function normalize(s){
    if(!s||!PHASES.includes(s.phase)||![s.at,s.until,s.startedAt,s.deadline,s.lastSeenAt,s.cooldownUntil,s.phaseUntil,s.runAt].every(Number.isFinite)||![s.home,s.from,s.goal,s.lastKnown].every(p=>valid(p)&&p.x>=0&&p.y>=0&&p.x<=50000&&p.y<=50000)||distance(s.from,s.goal)>51||s.until<s.at||s.until-s.at>10000||s.runAt<=0||s.deadline!==s.startedAt+8000)return null;
    return {phase:s.phase,at:s.at,until:s.until,startedAt:s.startedAt,deadline:s.deadline,lastSeenAt:s.lastSeenAt,cooldownUntil:s.cooldownUntil,phaseUntil:s.phaseUntil,runAt:s.runAt,targetId:String(s.targetId||'').slice(0,32),home:{...s.home},from:{...s.from},goal:{...s.goal},lastKnown:{...s.lastKnown}};
  }
  function latest(states=[],runAt){const order={held:7,strike:6,rest:5,regroup:4,search:3,warn:2,pursuit:1};return states.filter(s=>s?.runAt===runAt).sort((a,b)=>b.at-a.at||b.startedAt-a.startedAt||order[b.phase]-order[a.phase])[0]||null;}
  function frame(s,at){
    if(!s)return null;const u=clamp((at-s.at)/Math.max(1,s.until-s.at),0,1);
    return {x:s.from.x+(s.goal.x-s.from.x)*u,y:s.from.y+(s.goal.y-s.from.y)*u,phase:at<s.phaseUntil?s.phase:'',phaseUntil:s.phaseUntil};
  }
  function smoked(p,smokes,at){return smokes.some(s=>valid(s)&&s.until>at&&distance(p,s)<=300);}
  function eligible(t,options={}){
    return valid(t)&&t.alive!==false&&!t.defeated&&!t.captured&&!t.boss&&String(t.type).toLowerCase()!=='alpha'&&t.faction!=='government'&&t.hp>t.hpMax*.35&&!t.tranqTagged&&!t.rubberSlowed&&!options.engaged&&!options.requiredCapture&&!options.survival&&t.id!==options.lockedId;
  }
  function step(t,previous,players=[],at,options={}){
    const smokes=options.smokes||[],clock=Number.isFinite(options.wallAt)?options.wallAt:at;
    const targetVisible=p=>valid(p)&&p.alive!==false&&!p.downed&&p.online!==false&&distance(t,p)<=300&&!smoked(p,smokes,clock)&&!smoked(t,smokes,clock);
    const warnings=t.attackWarnings?.length||t._battleAttack||t.huntState==='pounce'||clock<Number(t.pounceWindupUntil||0);
    const held=!eligible(t,options)||clock<Number(t.holdUntil||0)||clock<Number(t.staggerUntil||0)||clock<Number(t.rubberSlowUntil||0);
    let s=previous?{...previous}:null;
    if(!s){
      if(held||warnings||!options.allowStart||options.shortResponse)return null;
      const p=players.filter(targetVisible).filter(p=>distance(t,p)>=180).sort((a,b)=>distance(t,a)-distance(t,b)||String(a.userId||a.id).localeCompare(String(b.userId||b.id)))[0];if(!p)return null;
      s={phase:'warn',at,until:at+1000,phaseUntil:at+1000,startedAt:at,deadline:at+8000,lastSeenAt:at,cooldownUntil:at+18000,runAt:options.runAt||1,targetId:String(p.userId||p.id||'solo'),home:{x:t.x,y:t.y},from:{x:t.x,y:t.y},goal:{x:t.x,y:t.y},lastKnown:{x:p.x,y:p.y}};
      return s;
    }
    const enter=(phase,duration)=>{s.phase=phase;s.phaseUntil=at+duration;};
    if(held){enter('held',1000);}
    else if(warnings){enter('strike',1000);}
    else if(s.phase==='held'||s.phase==='strike'){enter('search',2000);}
    else if(s.phase==='rest'){
      if(at>=s.cooldownUntil&&options.allowStart&&!options.shortResponse)return step(t,null,players,at,options);
    }else if(s.phase==='regroup'){
      if(distance(t,s.home)<8||options.blocked||at>=s.phaseUntil){enter('rest',8000);s.cooldownUntil=at+8000;}
    }else if(s.phase==='search'){
      if(at>=s.phaseUntil){enter('regroup',8000);}
    }else{
      const p=players.find(p=>String(p.userId||p.id||'solo')===s.targetId),visible=targetVisible(p);
      if(visible){s.lastKnown={x:p.x,y:p.y};s.lastSeenAt=at;}
      if(at>=s.deadline||!visible&&(at-s.lastSeenAt>=1000||smoked(t,smokes,clock)||valid(p)&&smoked(p,smokes,clock))||options.blocked){enter('search',2000);if(at>=s.deadline||options.blocked||smoked(t,smokes,clock)||valid(p)&&smoked(p,smokes,clock))s.lastKnown={x:t.x,y:t.y};}
      else if(s.phase==='warn'&&at>=s.phaseUntil){s.phase='pursuit';s.phaseUntil=s.deadline;}
    }
    let goal={x:t.x,y:t.y};
    if(s.phase==='pursuit'||s.phase==='search'){
      goal={...s.lastKnown};
      if(s.phase==='pursuit'){
        const d=distance(t,goal),stop=Math.min(110,d);if(d>0)goal={x:goal.x+(t.x-goal.x)*stop/d,y:goal.y+(t.y-goal.y)*stop/d};
      }
    }else if(s.phase==='regroup')goal={...s.home};
    const leash=distance(goal,s.home);if(['pursuit','search','regroup'].includes(s.phase)&&leash>240)goal={x:s.home.x+(goal.x-s.home.x)*240/leash,y:s.home.y+(goal.y-s.home.y)*240/leash};
    const w=Math.max(48,Number(options.world?.width)||4800),h=Math.max(48,Number(options.world?.height)||2800);goal={x:clamp(goal.x,24,w-24),y:clamp(goal.y,24,h-24)};
    if((options.civilians||[]).some(c=>valid(c)&&c.alive!==false&&!c.evac&&!c.secured&&distance(goal,c)<Math.min(140,distance(t,c))))goal={x:t.x,y:t.y};
    const speed=50*clamp(Number(options.speedMul)||1,.35,1),duration=Math.max(1,Math.min(1000,distance(t,goal)/speed*1000,s.phaseUntil-at));
    const d=distance(t,goal),travel=Math.min(d,speed*duration/1000);if(d>0)goal={x:t.x+(goal.x-t.x)*travel/d,y:t.y+(goal.y-t.y)*travel/d};
    return {...s,at,until:at+duration,from:{x:t.x,y:t.y},goal};
  }
  function steering(s,at){
    if(!s||s.phase==='strike')return null;
    return {kind:s.phase==='warn'?'pursuit':s.phase,until:s.phaseUntil,goal:s.goal,waiting:['warn','rest','held'].includes(s.phase)||Math.hypot(s.goal.x-s.from.x,s.goal.y-s.from.y)<1};
  }
  return Object.freeze({VERSION:'13.9',normalize,latest,frame,eligible,step,steering});
});
