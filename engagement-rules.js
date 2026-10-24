(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerEngagement=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ROLL_CHAIN_MS=3000,ROLL_RECOVERY_MS=520;
  function roll(previous,targetId,now){
    const target=String(targetId??''),age=now-Number(previous?.at);
    const escape=!!target&&String(previous?.target??'')===target&&age>=ROLL_RECOVERY_MS&&age<=ROLL_CHAIN_MS;
    return {escape,chain:escape?null:{target,at:now}};
  }
  function canFire(a,b,range){return !!a&&!!b&&[a.x,a.y,b.x,b.y,range].every(Number.isFinite)&&Math.hypot(b.x-a.x,b.y-a.y)<=range;}
  function face(a,b,fallback=0){return a&&b&&[a.x,a.y,b.x,b.y].every(Number.isFinite)?Math.atan2(b.y-a.y,b.x-a.x):fallback;}
  return Object.freeze({ROLL_CHAIN_MS,ROLL_RECOVERY_MS,roll,canFire,face});
});
