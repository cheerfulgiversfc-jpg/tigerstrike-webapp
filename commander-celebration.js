(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerCommanderCelebration=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function eligible(options={}){return options.confirmed===true&&!!options.runKey&&(options.players||[]).some(p=>p.eliteAppearance?.soldier==='crimson_commander');}
  function createTracker(){const seen=new Set();return {begin(options){if(!eligible(options)||options.animate===false||seen.has(options.runKey))return false;seen.add(options.runKey);if(seen.size>100)seen.delete(seen.values().next().value);return true;}};}
  const tracker=createTracker(),mounted=new WeakMap();
  function mount(host,options={}){
    if(!host||!root.document||!root.TigerShowcaseScene?.drawVictory)return false;
    const prior=mounted.get(host);if(!eligible(options)){if(prior){prior.stop();prior.section.remove();mounted.delete(host);}return false;}if(prior?.key===options.runKey){if(tracker.begin(options))prior.play();return true;}if(prior){prior.stop();prior.section.remove();}
    const section=root.document.createElement('section');section.className='eliteCommanderCelebration';section.setAttribute('aria-label','Crimson Commander mission-completion salute');
    const heading=root.document.createElement('strong');heading.textContent='Mission complete • Crimson Commander';
    const canvas=root.document.createElement('canvas');canvas.width=1200;canvas.height=600;canvas.setAttribute('aria-label','Equipped soldiers celebrating a confirmed mission completion');
    const actions=root.document.createElement('div'),replay=root.document.createElement('button'),hide=root.document.createElement('button');
    replay.type=hide.type='button';replay.textContent='Replay salute';hide.textContent='Hide celebration';actions.append(replay,hide);section.append(heading,canvas,actions);host.append(section);
    let frame=0,last=-Infinity,started=0;
    const stop=()=>{root.cancelAnimationFrame(frame);frame=0;};
    const paint=(now,age,staticPose=false)=>root.TigerShowcaseScene.drawVictory(canvas.getContext('2d'),{players:options.players,now,age,staticPose});
    const tick=now=>{if(!section.isConnected||root.document.hidden){stop();return;}const age=now-started;if(now-last>=33){last=now;paint(now,age);}if(age<2600)frame=root.requestAnimationFrame(tick);else{paint(now,2600);frame=0;}};
    const play=()=>{stop();started=root.performance.now();last=-Infinity;if(root.TigerCombatFeel?.settings()?.reducedFlashes){paint(started,1000,true);return;}frame=root.requestAnimationFrame(tick);};
    replay.onclick=play;hide.onclick=()=>{stop();section.hidden=true;};
    mounted.set(host,{key:options.runKey,stop,section,play});
    if(tracker.begin(options))play();else paint(root.performance.now(),1000,true);
    return true;
  }
  return {eligible,createTracker,mount};
});
