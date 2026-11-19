const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('./rescue-command'),M=require('./expedition-mastery'),store=require('./api/_lib/expedition-mastery-store');
function run(id,uid,mode='Solo'){return {id,expeditionId:'river-gate',route:'clinic',results:[1,2,3].map(stage=>({stage,mode,team:[{userId:uid},{userId:uid+1}],survivors:stage===1?[]:['Mara','Nia'],captures:stage,recordVersion:1,kills:0,wipes:0,durationMs:40000,rescueRequired:stage===1?0:2}))};}
test('Rescue Command counts final evacuees once per run, preserves names and never mutates records',()=>{
 let book=M.credit(null,run('one',31),31);book=M.credit(book,run('one',31),31);const before=JSON.stringify(book),view=C.model(book);
 assert.equal(view.clears,1);assert.equal(view.rescued,2);assert.equal(view.captures,6);assert.deepEqual(view.records[0].names,['Mara','Nia']);assert.equal(view.level,1);assert.equal(JSON.stringify(book),before);
 const old=structuredClone(book);delete old.runs.one.stages[3].survivorNames;assert.equal(C.model(old).records[0].names,null);
 const incomplete=run('partial',31);incomplete.results.pop();assert.equal(C.model(M.credit(null,incomplete,31)).clears,0);
 assert.equal(C.model({}).level,0);assert.throws(()=>C.model(book,'fake'));
});
test('Co-op participants keep personal provenance; late joiners do not gain unplayed full runs',async()=>{
 const r=run('command-credit',986001,'Co-op');r.results[2].team.push({userId:986003});await Promise.all([store.creditRun(r),store.creditRun(r)]);
 for(const uid of [986001,986002]){const b=await store.read(uid);assert.equal(C.model(b,'Co-op').rescued,2);assert.equal(C.model(b,'Solo').clears,0);assert.equal(C.model(b).clears,1);}
 assert.equal(C.model(await store.read(986003)).clears,0);
});
test('center facilities grow only through recorded complete runs; viewing mode does not erase account upgrades',()=>{
 let b=M.empty();for(let i=0;i<6;i++){const r=run('grow'+i,12,i%2?'Co-op':'Solo');if(i===5)r.results[1].mode='Solo';b=M.credit(b,r,12);assert.equal(C.model(b).level,i<2?1:i<5?2:3);}
 assert.equal(C.model(b,'Mixed').clears,1);assert.equal(C.model(b,'Solo').clears,3);assert.equal(C.model(b,'Co-op').clears,2);assert.equal(C.model(b,'Mixed').level,3);
});
test('all center areas and arrival phases use production art, finite geometry, and balanced canvas state',()=>{
 let depth=0,calls=0;const c=new Proxy({}, {get:(_o,k)=>k==='measureText'?s=>({width:String(s).length*6}):/create.*Gradient/.test(k)?()=>({addColorStop(){}}):(...args)=>{calls++;if(k==='save')depth++;if(k==='restore')depth--;assert(depth>=0);for(const a of args)if(typeof a==='number')assert(Number.isFinite(a));},set:()=>true});
 const b=M.credit(null,run('art',12),12),data=C.model(b),before=JSON.stringify(data);
 for(const area of ['overview','medical','wildlife'])for(const elapsed of [0,2000,4000,7000,11000,13000]){C.draw(c,data,{area,arrival:data.records[0],elapsed,now:elapsed});assert.equal(depth,0);}
 C.draw(c,C.model({}),{now:0});assert.equal(depth,0);assert(calls>1000);assert.equal(JSON.stringify(data),before);
 const source=fs.readFileSync('rescue-command.js','utf8');for(const name of ['drawGroundTexture','drawMapHouse','drawMapTree','drawMapLighting','drawCivilian','drawTiger','drawSoldier','drawVehicle'])assert(source.includes('R.'+name));
 assert(!/localStorage|setState|claimReward|\/api\//.test(source));
});
test('Rescue Mode exposes the center with signed status loading and ordered cache-busted dependencies',()=>{
 const page=fs.readFileSync('index.html','utf8'),hub=fs.readFileSync('rescue-expedition-hub.js','utf8');
 assert(page.indexOf('./expedition-mastery.js')<page.indexOf('./rescue-command.js'));assert(page.indexOf('./rescue-command.js')<page.indexOf('./rescue-expedition-hub.js'));
 assert(page.includes('rescue-command.css?v=5298'));assert(hub.includes('data-rescue-command'));assert(hub.includes('TigerRescueCommand?.open'));assert(hub.includes('initData:tg()?.initData'));assert(hub.includes('recordBook=result.mastery||{}'));
});
