const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./mission-debrief'),C=require('./result-cards');
const raw=(extra={})=>({id:'solo:run1',scope:'solo',missionKey:'Story:CAMPAIGN:10:0',title:'Story Mission 10',campaignLevel:10,mode:'Story',completed:true,rescued:2,civilianTotal:2,captures:1,kills:0,bossCaptures:1,durationMs:120000,rewardState:'awarded',...extra});
const saved=r=>D.record({},r).state;
test('rescue cards require a recorded completed claimed result, never an unlock, failure or pending payout',()=>{
 assert.equal(C.model(raw(),{}),null);
 assert.equal(C.model(raw({completed:false}),saved(raw())),null);
 assert.equal(C.model(raw({rewardState:'pending'}),saved(raw())),null);
 assert.equal(C.model(raw({id:'not-recorded'}),saved(raw())),null);
 const m=C.model(raw(),saved(raw()));assert.equal(m.captures,1);assert.equal(m.time,'2:00');assert(m.highlights.includes('Everyone Home'));assert(m.highlights.includes('First recorded boss capture'));assert(!m.highlights.includes('New personal best'));
});
test('personal best highlights use this run’s recorded improvement, separately from the first clear',()=>{
 let s=saved(raw());const r=raw({id:'solo:run2',durationMs:110000});s=D.record(s,r).state;
 assert(C.model(r,s).highlights.includes('New personal best'));
 assert(!C.model(raw(),s)?.highlights.includes('New personal best'));
 const noCiv=raw({id:'survival',mode:'Survival',rescued:0,civilianTotal:0,captures:0,bossCaptures:0,kills:20});
 const m=C.model(noCiv,saved(noCiv));assert(!m.highlights.includes('Everyone Home'));assert(!m.highlights.includes('Wildlife Guardian'));
});
test('team and solo result records stay separate and share text contains no account IDs or invitation codes',()=>{
 const r=raw({scope:'coop',id:'SECRET123:990900',actors:[{name:'Private Name',userId:990900,eliteAppearance:{soldier:'midnight',evil:'discard'},masteryIdentity:{uniform:{palette:{body:'#123abc',evil:'#123456',trim:'url(https://evil)'}}}}]});
 const s=saved(r),m=C.model(r,s),url=C.telegramUrl(m);
 assert.equal(m.scope,'coop');assert.equal(new URL(url).searchParams.get('url'),'https://tigerstrike-webapp.vercel.app/discover');
 assert(!C.caption(m).includes('Private Name'));assert(!url.includes('990900'));assert(!url.includes('SECRET123'));
 assert.equal(s.last.actors[0].userId,undefined);assert.equal(s.last.actors[0].eliteAppearance.evil,undefined);assert.deepEqual(s.last.actors[0].masteryIdentity.uniform.palette,{body:'#123abc'});
 assert.equal(D.normalize(s).last.actors[0].eliteAppearance.soldier,'midnight');
});
test('next rescue invites require a real waiting squad with exactly one open seat',()=>{
 assert(C.invitationAvailable({code:'ABC234',status:'waiting',memberCount:1}));
 for(const r of [null,{code:'ABC234',status:'complete',memberCount:1},{code:'ABC234',status:'active',memberCount:1},{code:'ABC234',status:'waiting',memberCount:2},{code:'ABC234',status:'waiting',memberCount:0},{code:'oops',status:'waiting',memberCount:1}])assert(!C.invitationAvailable(r));
});
test('result UI shares are user actions, with image fallbacks, privacy default and production artwork',()=>{
 const fs=require('node:fs'),source=fs.readFileSync('result-cards.js','utf8'),squad=fs.readFileSync('squad-coop.js','utf8');
 assert(source.includes('TigerShowcaseScene.drawVictory'));assert(source.includes('navigator.canShare'));assert(source.includes('navigator.share'));assert(source.includes('URL.revokeObjectURL'));assert(!source.includes('names.checked=true'));assert(!source.includes('localStorage'));assert(!source.includes('innerHTML'));assert(!source.includes('sendMessage'));assert(squad.includes("await api('sync')"));assert(squad.includes('invitationAvailable(state.snapshot)'));
});
