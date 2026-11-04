const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('./mission-debrief'),R=require('./mastery-rewards');
const game=fs.readFileSync('game.js','utf8'),tutorial=fs.readFileSync('tutorial.js','utf8');
const completed={id:'first-rescue',scope:'solo',missionKey:'Story:CAMPAIGN:1:1:',campaignLevel:1,mode:'Story',completed:true,civilianTotal:2,rescued:1,civilianLost:1};
const unlocked=s=>R.rewards(s,'solo').find(r=>r.id==='rescue-recruit').unlocked;
test('Recruit badge needs a recorded rescue clear, survives reload and history trimming, and stays scoped',()=>{
 assert(!unlocked({}));assert(!unlocked(D.record({}, {...completed,completed:false}).state));assert(!unlocked(D.record({}, {...completed,rescued:0}).state));
 assert(!unlocked(D.record({}, {...completed,mode:'Survival',campaignLevel:0}).state));
 let state=D.record({},completed).state;assert(unlocked(state));assert(!R.rewards(state,'coop').find(r=>r.id==='rescue-recruit').unlocked);
 state=R.equip(state,'solo','rescue-recruit');assert.equal(R.identity(D.normalize(JSON.parse(JSON.stringify(state))),'solo').badge.id,'rescue-recruit');
 assert.equal(R.identity(D.normalize({...state,records:{}}),'solo').badge.id,'rescue-recruit');
 assert.equal(D.record(state,completed).applied,false);assert.equal(state.records['solo:Story:CAMPAIGN:1:1:'].clears,1);
});
function fn(source,name,next){return source.slice(source.indexOf('function '+name+'('),source.indexOf('function '+next+'('));}
test('Actual primary and lite save entry points do not write or sync training supplies',()=>{
 let writes=0,syncs=0;const ctx={window:{__TUTORIAL_MODE__:true},localStorage:{setItem(){writes++}},requestGameplayCloudSync(){syncs++},Date,console,S:{mode:'Story'}};vm.createContext(ctx);
 vm.runInContext(fn(game,'flushSaveNow','flushStoryLiteNow')+fn(game,'flushStoryLiteNow','save'),ctx);
 ctx.flushSaveNow();ctx.flushStoryLiteNow();assert.equal(writes,0);assert.equal(syncs,0);
});
test('Persisted-state builder returns the pre-practice snapshot without capturing a training mode profile',()=>{
 const snapshot={funds:1234,ammoReserve:{RUBBER:8},storyLevel:19,missionDebriefs:{records:{}}};let captured=0;
 const ctx={window:{__TUTORIAL_MODE__:true},S:{funds:999999,ammoReserve:{RUBBER:999},_tutorialSnapshot:snapshot},cloneState:x=>JSON.parse(JSON.stringify(x)),captureActiveModeProfile(){captured++}};vm.createContext(ctx);
 vm.runInContext(game.slice(game.indexOf('function buildPersistedState(){'),game.indexOf('let __lastSave =')),ctx);
 const out=ctx.buildPersistedState();assert.deepEqual(out,snapshot);assert.equal(captured,0);assert.notEqual(out,snapshot);
});
test('Short practice lanes retain real action gates and a finish/exit without requiring the entire tutorial',()=>{
 const ctx={window:{TigerTutorial:{}},getTutorialConfig:()=>({})};vm.createContext(ctx);
 vm.runInContext(tutorial.slice(tutorial.indexOf('  function getStepList(){'),tutorial.indexOf('  window.TigerTutorial = {')),ctx);
 const full=ctx.getStepList();assert(full.length>25);
 for(const kind of ['movement','rescue','capture','combat']){
  ctx.window.TigerTutorial.practiceKind=kind;const steps=ctx.getStepList();assert(steps.length<full.length);assert.equal(steps[0].key,'intro');assert(steps.at(-1).finish);
  assert(steps[0].text.includes('No mission rewards')||steps[0].text.includes('no mission rewards'));
  assert(steps.every(s=>typeof s.canNext==='function'));assert(steps.some(s=>s.key===(kind==='movement'?'controls_layout':kind==='rescue'?'escort':'resolve_tiger')));
 }
});
test('Training completion cannot create a real mission record or recruit badge',()=>{
 const ctx={window:{__TUTORIAL_MODE__:true},S:{missionDebriefs:{records:{}}}};vm.createContext(ctx);
 vm.runInContext(fn(game,'recordSoloMissionDebrief','renderRecruitVictoryCard'),ctx);ctx.recordSoloMissionDebrief({}, {},0,0);assert.deepEqual(ctx.S.missionDebriefs,{records:{}});
});

test('Real Solo completion records the recruit unlock once and leaves supplies unchanged',()=>{
 const original={funds:1234,ammoReserve:{RUBBER:8}},ctx={Date,STORY_VARIANTS:{CAMPAIGN:'CAMPAIGN'},currentMissionLabel:()=> 'Story Mission 1',fieldContext:()=>null,S:{mode:'Story',missionDebriefs:{},_missionRunId:'actual-first',captureCages:[],...original},window:{TigerMissionDebrief:D,TigerMasteryRewards:R}};vm.createContext(ctx);
 vm.runInContext(fn(game,'recordSoloMissionDebrief','renderRecruitVictoryCard'),ctx);
 ctx.recordSoloMissionDebrief({number:1,storyVariant:'CAMPAIGN'}, {evac:1,captures:1,kills:0,cashEarned:500},2,1);
 assert(unlocked(ctx.S.missionDebriefs));assert.equal(ctx.S.missionDebriefs.lastChanges.recruitEarned,true);assert.equal(ctx.S.funds,1234);assert.equal(ctx.S.ammoReserve.RUBBER,8);
 ctx.recordSoloMissionDebrief({number:1,storyVariant:'CAMPAIGN'}, {evac:1,captures:1,kills:0,cashEarned:500},2,1);
 assert.equal(ctx.S.missionDebriefs.lastChanges.recruitEarned,false);assert.equal(Object.values(ctx.S.missionDebriefs.records)[0].clears,1);
});
