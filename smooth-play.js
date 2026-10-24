(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerSmoothPlay=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MODES=['AUTO','BATTERY','HIGH'];
  function normalize(value){return MODES.includes(value)?value:'AUTO';}
  let cached;
  function settings(legacy='AUTO'){if(cached!==undefined)return cached;try{const stored=localStorage.getItem('tiger_graphics_mode');cached=stored===null?normalize(legacy):normalize(stored);}catch(_){cached=normalize(legacy);}return cached;}
  function save(value){cached=normalize(value);try{localStorage.setItem('tiger_graphics_mode',cached);}catch(_){}return cached;}
  function policy(mode=settings(),slow=false){return {battery:mode==='BATTERY',preferredDetail:mode==='HIGH'&&!slow,cooperativeFrameMs:mode==='BATTERY'?1000/30:0};}
  function visible(point,view,pad=220){return !!point&&[point.x,point.y,view.x,view.y,view.w,view.h].every(Number.isFinite)&&point.x>=view.x-pad&&point.x<=view.x+view.w+pad&&point.y>=view.y-pad&&point.y<=view.y+view.h+pad;}
  function pollInterval(snapshot,localMoving=false){return snapshot?.status==='active'?(localMoving||(!snapshot.paused&&(snapshot.players||[]).some(p=>p.online!==false&&!p.downed&&p.moving))?300:750):1100;}
  // Bounded, local-only diagnostics. No account data, network logging, or timers.
  function createMetrics(){
    const rows=new Map();
    function record(key,cost){if(!Number.isFinite(cost)||cost<0||cost>10000)return;key=String(key).slice(0,64);if(!rows.has(key)){if(rows.size>=96)return;rows.set(key,[]);}const samples=rows.get(key);samples.push(cost);if(samples.length>120)samples.shift();}
    function report(){return Array.from(rows,([name,samples])=>({name,count:samples.length,average:samples.reduce((a,b)=>a+b,0)/samples.length,max:Math.max(...samples)})).sort((a,b)=>b.average-a.average);}
    return {record,report,clear:()=>rows.clear()};
  }
  const metrics=createMetrics();
  function connection(lastSuccess,now=Date.now(),failed=false){const age=Math.max(0,now-Number(lastSuccess||now));return failed||age>=4000?'Reconnecting… Inputs resume syncing when the connection returns.':age>=2000?'Connection delayed… waiting for a fresh update.':'';}
  function renderDiagnostics(){
    const node=document.getElementById('smoothPlayDiagnostics');if(!node)return;
    const rows=metrics.report(),frames=rows.find(row=>row.name==='solo.frame'),gap=rows.find(row=>row.name==='solo.gap'),coopGap=rows.find(row=>row.name==='coop.gap');
    const tasks=rows.filter(row=>!row.name.endsWith('.gap')&&!row.name.endsWith('.frame')).slice(0,6);
    node.textContent=(gap?`Recent Solo loop cadence: ${(1000/Math.max(1,gap.average)).toFixed(0)} FPS. `:'')+(frames?`Main-loop work: ${frames.average.toFixed(1)} ms average.\n`:'')+(coopGap?`Recent Co-op drawing cadence: ${(1000/Math.max(1,coopGap.average)).toFixed(0)} FPS.\n`:'')+tasks.map(row=>`${row.name}: ${row.average.toFixed(2)} ms avg / ${row.max.toFixed(1)} ms max (${row.count} samples)`).join('\n')+'\nLocal rolling samples; not a guaranteed device FPS. Refresh after playing to compare.';
  }
  function open(){
    const dialog=document.getElementById('smoothPlayDialog');if(!dialog)return;
    window.resetControlInputState?.('smooth-play');window.dispatchEvent(new Event('combat-comfort-open'));
    document.getElementById('graphicsMode').value=settings();renderDiagnostics();if(!dialog.open)dialog.showModal();
  }
  function change(value){save(value);window.dispatchEvent(new Event('smooth-play-change'));}
  return Object.freeze({normalize,settings,save,policy,visible,pollInterval,createMetrics,metrics,connection,open,change,renderDiagnostics});
});
