const {performance}=require('node:perf_hooks');
const {createHarness,crowdedSnapshot}=require('./coop-harness');
const harness=createHarness({snapshot:crowdedSnapshot()});
for(let i=0;i<10;i++){harness.setClock(100000+i*16.7);harness.qa.drawArena(1/60);}
harness.resetStats();const costs=[];
for(let i=0;i<60;i++){harness.setClock(101000+i*16.7);const start=performance.now();harness.qa.drawArena(1/60);costs.push(performance.now()-start);}
costs.sort((a,b)=>a-b);
console.log(JSON.stringify({scene:'60 tigers, 40 civilians, two soldiers, chapter river, one cage',frames:60,medianCpuMs:+costs[30].toFixed(2),p95CpuMs:+costs[56].toFixed(2),canvasCallsPerFrame:Math.round(harness.stats().calls/60),tigerModelsPerFrame:harness.drawn.tigers.length/60,civilianModelsPerFrame:harness.drawn.civilians.length/60,balancedCanvas:harness.stats().depth===0,note:'Node command-generation benchmark, not phone FPS.'},null,2));
