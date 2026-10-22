const test=require('node:test'),assert=require('node:assert/strict');
const api=require('./mission-debrief');
const run=(extra={})=>({id:'mastery1',scope:'solo',missionKey:'Story:CAMPAIGN:1:1:',campaignLevel:1,title:'First Hunt',mode:'Story',completed:true,durationMs:60000,civilianTotal:2,rescued:2,captures:1,kills:0,...extra});
test('earned medals persist across reloads and accumulate without duplication or reward changes',()=>{
  let result=api.record({},run());
  assert.deepEqual(result.state.records[result.run.key].medals,['Everyone Home','Wildlife Guardian']);
  result=api.record(JSON.parse(JSON.stringify(result.state)),run({id:'mastery2',kills:2,captures:0,rescued:0}));
  const record=result.state.records[result.run.key];
  assert.equal(record.clears,2);assert.equal(record.medals.length,2);
  assert.equal(api.record(result.state,run({id:'mastery2'})).applied,false);
  assert.equal(result.state.funds,undefined);
});
test('legacy campaign PB migration preserves known clears but invents no medals',()=>{
  const state=api.normalize({records:{'solo:Story:CAMPAIGN:11:11:':{clears:2,fastestMs:70000},'solo:Story:GAUNTLET:11:111:':{clears:4},'coop:shared-story:20::':{clears:1}}});
  assert.equal(state.records['solo:Story:CAMPAIGN:11:11:'].campaignLevel,11);
  assert.deepEqual(state.records['solo:Story:CAMPAIGN:11:11:'].medals,[]);
  assert.equal(state.records['solo:Story:GAUNTLET:11:111:'].campaignLevel,0);
  assert.equal(state.records['coop:shared-story:20::'].campaignLevel,20);
});
test('chapter journey renders all 100 missions, ten chapters, and guarded real selection paths',()=>{
  const html=api.journeyHtml({maxLevel:11,selectedLevel:11});
  assert.equal((html.match(/class="journeyMission /g)||[]).length,100);
  assert.equal((html.match(/<details /g)||[]).length,10);
  assert(html.includes('onclick="setWorldMapPrep(\'selectedLevel\',11)"'));
  assert(!html.includes('onclick="setWorldMapPrep(\'selectedLevel\',12)"'));
  assert(html.includes('Mission 100'));assert(html.includes('aria-pressed="true"'));
  const coop=api.journeyHtml({scope:'coop',maxLevel:2});
  assert(coop.includes('data-squad-command="select-story" data-squad-story-level="2"'));
  assert(!coop.includes('data-squad-story-level="3"'));
});
test('journey filters Solo, Co-op and noncampaign results and escapes authored titles',()=>{
  let state=api.record({},run()).state;
  state=api.record(state,run({id:'coop',scope:'coop',campaignLevel:2,missionKey:'shared-story:2::',wipes:0})).state;
  state=api.record(state,run({id:'op',scope:'coop',campaignLevel:0,mode:'Special Operation',missionKey:'alpha-hunt:0::'})).state;
  const solo=api.journeyHtml({state,missions:[{title:'<img onerror=evil>'}]});
  assert(solo.includes('1/100 missions with recorded clears'));assert(solo.includes('2 earned mission medals'));
  assert(!solo.includes('<img'));assert(solo.includes('&lt;img'));
  const coop=api.journeyHtml({scope:'coop',state,maxLevel:2,selectedLevel:2});
  assert(coop.includes('1/100 missions with recorded clears'));assert(coop.includes('3 earned mission medals'));
  assert(coop.includes('beat your own 1:00 clear'));
});
test('empty, failed and duplicate runs cannot manufacture journey completion',()=>{
  const state=api.record({},run({completed:false})).state;
  assert(api.journeyHtml({state,maxLevel:100}).includes('0/100 missions with recorded clears'));
  assert.deepEqual(api.medals(api.summary(run({civilianTotal:0,rescued:0,captures:0,kills:1}))),[]);
});
test('both selectors connect the board and server assigns campaign identity only to shared Story',()=>{
  const fs=require('node:fs');
  assert(fs.readFileSync('game.js','utf8').includes("report.campaignLevel=S.mode==='Story'&&meta.storyVariant===STORY_VARIANTS.CAMPAIGN?meta.number:0"));
  assert(fs.readFileSync('squad-coop.js','utf8').includes("journeyHtml?.({scope:'coop',state:state.profile?.missionDebriefs"));
  assert(fs.readFileSync('api/_lib/squad-session.js','utf8').includes("campaignLevel:session.launchType==='shared-story'?session.storyMissionLevel:0"));
});
