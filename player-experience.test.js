const test=require('node:test');
const assert=require('node:assert/strict');
const api=require('./player-experience');
test('capture guidance distinguishes rubber weakening, supplies, boss strategy and lethal wounds',()=>{
  const tiger={hp:90,hpMax:100,alive:true};
  assert.equal(api.captureStatus(tiger).stage,'weaken');
  tiger.hp=20;
  assert.equal(api.captureStatus(tiger).stage,'ready');
  assert.equal(api.captureStatus(tiger,{tranqReady:false}).stage,'supply');
  assert.equal(api.captureStatus(tiger,{bossReady:false}).stage,'boss');
  tiger.lethalWounded=true;
  assert.equal(api.captureStatus(tiger).stage,'blocked');
  assert.equal(api.captureStatus(tiger,{survival:true}).stage,'survival');
});
test('locator follows required landmarks, then escorts, threats and extraction',()=>{
  const options={player:{x:0,y:0},landmarks:[{id:'gate',x:10,y:0}],civilians:[{id:'civ',x:20,y:0,alive:true}],tigers:[{id:'tiger',x:30,y:0,hp:100,alive:true}],evac:{id:'evac',x:40,y:0}};
  assert.equal(api.nextObjective(options).id,'gate');
  options.landmarks=[];
  assert.equal(api.nextObjective(options).id,'civ');
  options.civilians[0].following=true;
  assert.equal(api.nextObjective(options).id,'evac');
  options.civilians[0].evac=true;
  assert.equal(api.nextObjective(options).id,'tiger');
  options.tigers[0].alive=false;
  assert.equal(api.nextObjective(options).action,'Extract');
});
test('mandatory live captures never guide a player to a lethally injured target',()=>{
  const options={player:{x:0,y:0},tigers:[{id:'injured',x:1,y:0,hp:10,lethalWounded:true},{id:'fresh',x:50,y:0,hp:50}],captureRequired:1};
  assert.equal(api.nextObjective(options).id,'fresh');
  options.tigers.pop();
  assert.equal(api.nextObjective(options).id,'capture-blocked');
  options.tigers=[];
  assert.equal(api.nextObjective(options).id,'capture-blocked');
});
test('adaptive rendering responds to mobile slowdown and respects manual quality',()=>{
  assert.equal(api.performancePolicy({mobile:true,lagTier:1}).fastMap,true);
  assert.equal(api.performancePolicy({mobile:true,lagTier:0}).fastMap,false);
  assert.equal(api.performancePolicy({mobile:true,lagTier:2,preference:'QUALITY'}).fastMap,false);
  assert.equal(api.performancePolicy({mobile:false,lagTier:2}).fastMap,false);
});
