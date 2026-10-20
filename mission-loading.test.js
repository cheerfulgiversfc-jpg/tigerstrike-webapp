const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('game.js','utf8');
function functions(names){
  return names.map(name=>{
    const start=source.indexOf(`function ${name}(`);
    assert(start>=0, name);
    return source.slice(start,source.indexOf('\nfunction ',start+1));
  }).join('\n');
}
function loader({civilians=0,required=0,interactables=[],cache=false,small=false}={}){
  const S={mode:'Story',me:{x:100,y:100},tigers:[{alive:true,x:200,y:200,hp:100}],civilians:Array.from({length:civilians},()=>({alive:true,x:100,y:100,hp:100})),mapInteractables:interactables,evacZone:{x:200,y:200,r:50},lives:5,funds:1000,score:0,hp:100,armor:20,armorCap:100,stamina:100,mag:{},ownedWeapons:['starter']};
  const context={S,Math,Number,Date,normalizeModeName:v=>v,storyMissionForState:()=>({civilians:required}),activeArcadeMission:()=>({civilians:required}),clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),ensureSectorStreamingState:()=>({size:400,discoveredKeys:Array(small?4:100),activeKeys:Array(small?4:100)}),STREAM_SECTOR_SIZE:400,worldWidth:()=>small?800:4800,worldHeight:()=>small?800:2800,missionIndexForMode:()=>3,chapterIndexForMode:()=>1,currentMap:()=>({key:'forest'}),__startupLoadingGuard:{active:true,startedAt:10,stageScores:{},detailedFrames:7},__mapObstacleSig:'ready',__mapObstacleRects:[],__mapObstacleCircles:[],__mapWaterZones:[],ensureMissionTwistState:()=>({}),ENABLE_BIOME_SYSTEM:false,ensureMissionDirectorState:()=>({}),STARTUP_LOADING_DETAIL_READY_FRAMES:7,__mapFrameCacheCanvas:cache?{}:null,__mapFrameCacheAt:100,__startupLastDetailedMapAt:100};
  vm.createContext(context);
  vm.runInContext(functions(['startupPreloadExpectedSectorCount','missionExpectsCivilians','computeStartupPreloadProgress','startupCriticalPreloadReady','startupPlayablePreloadReady','missionEntityStateInvalid','beginStartupLoadingGuard']),context);
  return context;
}
test('combat-only maps finish loading without civilians, interactions, or a full-frame cache',()=>{
  const c=loader();c.computeStartupPreloadProgress(100);
  assert.equal(c.startupPlayablePreloadReady(),true);
  assert.equal(c.missionEntityStateInvalid(c.S),'');
});
test('escort maps still reject missing required civilians',()=>{
  const c=loader({required:2});c.computeStartupPreloadProgress(100);
  assert.equal(c.startupPlayablePreloadReady(),false);
  assert.equal(c.missionEntityStateInvalid(c.S),'civilians-empty');
  c.S.civilians=[{alive:true,x:100,y:100,hp:100}];c.computeStartupPreloadProgress(100);
  assert.equal(c.startupPlayablePreloadReady(),true);
});
test('small maps can load with only their available sectors',()=>{
  const c=loader({small:true});c.computeStartupPreloadProgress(100);
  assert.equal(c.startupPreloadExpectedSectorCount(c.S),4);
  assert.equal(c.startupPlayablePreloadReady(),true);
});
test('repeated launch guards preserve the original loading deadline',()=>{
  const c=loader();c.beginStartupLoadingGuard('repeat');
  assert.equal(c.__startupLoadingGuard.startedAt,10);
});
test('HQ redraws preserve existing menu buttons and their in-progress taps',()=>{
  let writes=0,armed=0,html='';
  const bar={style:{},classList:{toggle(){}},get innerHTML(){return html;},set innerHTML(v){html=v;writes++;}};
  const c={document:{getElementById:()=>bar,body:{classList:{contains:()=>false}}},__baseHqActive:true,__baseHqQuickMenuCollapsed:true,S:{mode:'Story'},baseHqModeMissionSnapshot:()=>({}),baseHqActionButtonHtml:(label,fn)=>`${label}:${fn}`,armBaseHqButtons:()=>armed++};
  vm.createContext(c);vm.runInContext(functions(['renderBaseHqQuickBar']),c);
  for(let i=0;i<60;i++)c.renderBaseHqQuickBar();
  assert.equal(writes,1);assert.equal(armed,1);
});
