(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TigerPlayerExperience=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function captureStatus(tiger,options={}){
    if(options.survival)return {stage:'survival',text:'Survival: Real rounds only. Eliminate the tiger to clear the wave.'};
    if(!tiger)return {stage:'none',text:'Scan to find a tiger.'};
    if(tiger.captured||tiger.missionOutcome==='CAPTURE')return {stage:'captured',text:'Captured alive — secured for wildlife transport.'};
    if(tiger.defeated||tiger.alive===false||Number(tiger.hp)<=0)return {stage:'resolved',text:'Tiger cleared. Follow your next objective.'};
    if(tiger.lethalWounded)return {stage:'blocked',text:'Capture blocked: this tiger was hit by Real rounds. Use Rubber on a fresh tiger.'};
    const threshold=Number(options.threshold||.30);
    if(Number(tiger.hp)>Number(tiger.hpMax)*threshold)return {stage:'weaken',text:`Use Rubber to weaken this tiger to ${Math.round(threshold*100)}% health. Rubber cannot kill it.`};
    if(options.bossReady===false)return {stage:'boss',text:options.bossHint||'Tiger weakened. Complete its boss capture strategy first.'};
    if(options.tranqReady===false)return {stage:'supply',text:'Tiger weakened. Restock or equip a compatible tranquilizer to capture it alive.'};
    return {stage:'ready',text:'READY TO CAPTURE — use tranquilizer / Capture now. More Rubber hits are unnecessary.'};
  }
  function nextObjective({player={},landmarks=[],civilians=[],tigers=[],evac=null,captures=0,captureRequired=0}={}){
    const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
    const nearest=rows=>rows.filter(valid).slice().sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y))[0];
    const result=(target,action,why)=>target?{id:String(target.id||action),x:target.x,y:target.y,label:String(target.label||target.name||action),action,why,distance:valid(player)?Math.round(Math.hypot(target.x-player.x,target.y-player.y)):0}:null;
    const landmark=landmarks.find(valid);
    if(landmark)return result(landmark,'Engage mission location','This location is required to finish the mission.');
    const pending=civilians.filter(c=>c&&c.alive!==false&&!c.evac);
    if(pending.some(c=>c.following)&&valid(evac))return result(evac,'Escort to safety','Bring your followers inside the rescue zone.');
    if(pending.length)return result(nearest(pending),'Rescue civilian','Reach the civilian, then guide them to safety.');
    const active=tigers.filter(t=>t&&t.alive!==false&&!t.defeated&&Number(t.hp)>0);
    if(!active.length&&captures<captureRequired)return {id:'capture-blocked',action:'Required capture incomplete',label:'Restart mission',why:'No live capture target remains. Restart and use Rubber for required captures.',distance:0};
    if(active.length){
      const capture=captures<captureRequired;
      const candidates=capture?active.filter(t=>!t.lethalWounded):active;
      if(capture&&!candidates.length)return {id:'capture-blocked',action:'Required capture blocked',label:'Restart mission',why:'All remaining tigers have lethal injuries. Restart and use Rubber for required captures.',distance:0};
      return result(nearest(candidates),capture?'Capture tiger alive':'Clear tiger threat',capture?'Use Rubber, then tranquilize. Real rounds block this objective.':'Clear the remaining threat before extraction.');
    }
    return result(evac,'Extract','Enter the extraction zone and hold until departure.');
  }
  function performancePolicy({mobile=false,preference='AUTO',lagTier=0}={}){
    const adaptive=mobile&&String(preference).toUpperCase()==='AUTO';
    const smooth=mobile&&(String(preference).toUpperCase()==='PERFORMANCE'||(adaptive&&lagTier>=1));
    return {fastMap:smooth,reduceEffects:smooth,label:smooth?'Smooth rendering active':(adaptive?'Automatic rendering':'Manual rendering')};
  }
  return Object.freeze({VERSION:'11.5',captureStatus,nextObjective,performancePolicy});
});
