const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const maps=require('./chapter-maps'),water=require('./water-terrain'),art=require('./shared-battlefield-renderer'),server=require('./api/_lib/squad-session');
const game=fs.readFileSync('game.js','utf8'),coop=fs.readFileSync('squad-coop.js','utf8');
function canvas(){const calls=[];const ctx=new Proxy({}, {get:(_,key)=>key==='globalAlpha'?1:/create.*Gradient/.test(key)?(...a)=>{calls.push([key,...a]);return {addColorStop:(...v)=>calls.push(['color',...v])};}:(...a)=>calls.push([key,...a]),set:(_,key,value)=>{calls.push(['style',key,typeof value==='object'?'gradient':value]);return true;}});return {ctx,calls};}
test('all 100 Story missions lock to exactly ten immutable chapter plans',()=>{
  assert.equal(maps.chapters.length,10);assert.equal(new Set(maps.chapters.map(p=>p.id)).size,10);
  for(let level=1;level<=100;level++){
    const plan=maps.forMission(level),first=Math.floor((level-1)/10)*10+1;
    assert.equal(plan,maps.forMission(first));assert.equal(plan.chapter,Math.ceil(level/10));
    assert(Object.isFrozen(plan)&&Object.isFrozen(plan.waterZones)&&Object.isFrozen(plan.world));
    const mission=server.missionDefinition({launchType:'shared-story',storyMissionLevel:level});
    assert.deepEqual(mission.world,plan.world);assert.equal(mission.waterZones,plan.waterZones);
    assert.equal(mission.level,level);assert(mission.tigers.length>0);
  }
});
test('Solo bounds and swimming terrain match the server for all missions on every viewport',()=>{
  const scope={TigerChapterMaps:maps,window:{},WORLD_BASE_WIDTH:960,WORLD_BASE_HEIGHT:540,normalizeModeName:x=>x,missionProgressForWorld:s=>s.storyLevel};
  vm.runInNewContext(game.slice(game.indexOf('function desiredWorldLayout('),game.indexOf('function ensureWorldLayout(')),scope);
  vm.runInNewContext(game.slice(game.indexOf('function buildMapWaterZones('),game.indexOf('function waterZoneRadii(')),scope);
  for(let level=1;level<=100;level++)for(const size of [[390,844],[844,390],[1920,1080]]){
    scope.cv={width:size[0],height:size[1]};scope.S={mode:'Story',storyLevel:level};
    const result=scope.desiredWorldLayout(scope.S),plan=maps.forMission(level);
    assert.equal(result.w,plan.world.width);assert.equal(result.h,plan.world.height);
    assert.equal(scope.buildMapWaterZones('',plan.chapter,result.w,result.h),plan.waterZones);
  }
  assert(game.includes("mode==='Story'&&!window.__TUTORIAL_MODE__&&chapterMap"),'tutorial and other modes keep their own bounds');
});
test('base-map drawing is identical from first through boss mission in every chapter',()=>{
  for(const plan of maps.chapters){
    const first=(plan.chapter-1)*10+1,view={x:plan.world.width*.35,y:plan.waterZones[0].y-350,w:1100,h:700};
    const draw=level=>{const c=canvas();art.drawStoryMapFoundation(c.ctx,{level,worldW:4800,worldH:2800,view,now:5000,weather:'clear'});return c.calls;};
    const expected=draw(first);assert(expected.length>100);
    for(let level=first+1;level<first+10;level++)assert.deepEqual(draw(level),expected,`chapter ${plan.chapter}, mission ${level}`);
  }
  assert(game.includes('BattlefieldRenderer.drawStoryMapFoundation(ctx,{level:missionProgressForWorld(S)'));
  assert(coop.includes('BattlefieldRenderer.drawStoryMapFoundation(ctx,{level:storyLevel'));
  assert(!coop.includes('ctx.fillStyle=chapterTint;ctx.fillRect'));
});
test('all chapters have real dry bridge decks and one continuous river; Chapter 5 keeps its capture pool',()=>{
  for(const plan of maps.chapters){
    const river=plan.waterZones[0];assert.equal(river.kind,'river');assert.equal(river.rx*2,plan.world.width);
    assert(river.bridges.length>0);
    for(const b of river.bridges){const x=b.x+b.w/2,y=water.banks(river,x).center;assert.equal(water.depth(river,x,y),0);}
    assert(water.swimming(plan.waterZones,100,water.banks(river,100).center));
  }
  assert.equal(maps.forMission(41).waterZones,maps.forMission(50).waterZones);
  assert.equal(maps.forMission(43).waterZones[1].label,'Currentstripe Pool');
  const boatMission=server.missionDefinition({launchType:'shared-story',storyMissionLevel:48});
  assert(water.contains(boatMission.waterZones[0],boatMission.extraction.x,boatMission.extraction.y),'Mission 48 boat must stay in the permanent river');
});
test('new chapter dependency loads before both map clients and rendering',()=>{
  const html=fs.readFileSync('index.html','utf8'),at=html.indexOf('src="./chapter-maps.js');
  assert(at>html.indexOf('src="./water-terrain.js'));
  for(const file of ['shared-battlefield-renderer.js','game.js','squad-coop.js'])assert(at<html.indexOf(`src="./${file}`));
});
