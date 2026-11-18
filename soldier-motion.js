// Shared presentation-only gait. Actual position, speed and combat aim stay authoritative.
(function(root){
  'use strict';
  const TAU=Math.PI*2,STRIDE_DISTANCE=110;
  const tracks=new WeakMap();
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function sample(previous,point,at){
    const x=Number(point.x),y=Number(point.y),face=Number(point.face)||0;
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(at))return previous||{x:0,y:0,at:0,phase:0,blend:0,facing:1};
    const elapsed=previous?Math.max(0,(at-previous.at)/1000):0;
    const distance=previous?Math.hypot(x-previous.x,y-previous.y):0;
    const discontinuity=elapsed>.25||distance>Math.max(80,600*elapsed);
    const travel=discontinuity?0:distance;
    const speed=elapsed>0?travel/elapsed:0;
    const target=clamp(speed/170,0,1);
    const blend=previous&&!discontinuity?previous.blend+(target-previous.blend)*(1-Math.exp(-14*Math.min(elapsed,.1))):0;
    const horizontal=Math.cos(face);
    // A small dead band prevents a noisy vertical joystick from mirroring the whole body.
    const facing=horizontal<-.16?-1:horizontal>.16?1:previous?.facing||1;
    return {x,y,at,phase:((previous?.phase||0)+travel*TAU/STRIDE_DISTANCE)%TAU,blend,facing};
  }
  function track(entity,point,at){const next=sample(tracks.get(entity),point,at);tracks.set(entity,next);return next;}
  const api={sample,track,STRIDE_DISTANCE};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TigerSoldierMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
