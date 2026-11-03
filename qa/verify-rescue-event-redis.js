// Isolated production-Lua check: touches only unique qa:rescue keys, then deletes them.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict'),filename=path.resolve(__dirname,'../api/_lib/rescue-event-store.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8').replace('module.exports={','module.exports={testLua:lua,'),filename);
const prefix='qa:rescue:'+process.pid+':'+Date.now(),keys=['global','userA','runs','userARuns','userB','userBRuns','elite'].map(x=>prefix+':'+x),cli=process.env.REDIS_TEST_CLI||'/tmp/redis-7.2.5/src/redis-cli';function cmd(...a){return execFileSync(cli,['-h','127.0.0.1','-p','6389','--raw',...a.map(String)],{encoding:'utf8'}).trim();}function apply(user,receipt,n){return JSON.parse(cmd('EVAL',m.exports.testLua,4,keys[0],keys[user?4:1],keys[2],keys[user?5:3],receipt,n));}try{assert.equal(apply(0,'ROOMAA:1',5).total,5);assert.equal(apply(0,'ROOMAA:1',5).rescues,5);assert.equal(apply(1,'ROOMAA:1',5).total,5);assert.equal(apply(1,'ROOMAA:1',5).rescues,5);assert.equal(apply(0,'ROOMAA:2',3).total,8);assert.equal(apply(0,'ROOMAA:2',3).rescues,8);const ef=path.resolve(__dirname,'../api/_lib/elite-store.js'),em=new Module(ef,module);em.filename=ef;em.paths=Module._nodeModulePaths(path.dirname(ef));em._compile(fs.readFileSync(ef,'utf8').replace('module.exports={','module.exports={testLua:lua,'),ef);cmd('SET',keys[6],JSON.stringify({owned:['midnight'],selection:{},charges:{paid:{items:['midnight']}},orders:{}}));const edit=(op,p)=>JSON.parse(cmd('EVAL',em.exports.testLua,1,keys[6],op,JSON.stringify(p)));assert(edit('earned',{ids:['monsoon_uniform']}).owned.includes('monsoon_uniform'));assert.deepEqual(edit('refund',{charge:'paid'}).owned,['monsoon_uniform']);console.log('Actual Redis rescue receipts passed: once per run globally, once per participant personally, duplicate retry and new attempt.');}finally{cmd('DEL',...keys);}

// Exercise the same atomic schedule script with isolated keys and a controlled clock.
const sf=path.resolve(__dirname,'../api/_lib/rescue-event-schedule.js'),sm=new Module(sf,module);sm.filename=sf;sm.paths=Module._nodeModulePaths(path.dirname(sf));sm._compile(fs.readFileSync(sf,'utf8').replace('module.exports={','module.exports={testLua:lua,'),sf);
const scheduleKey=prefix+':schedule',duration=14*86400000,initial=JSON.stringify({paused:true,remainingMs:duration,startedAt:0,endsAt:0,revision:0});
function editSchedule(action,now){return JSON.parse(cmd('EVAL',sm.exports.testLua,1,scheduleKey,action,now,initial));}
try{
 assert.equal(editSchedule('resume',1000).endsAt,1000+duration);
 assert.equal(editSchedule('resume',2000).endsAt,1000+duration);
 const paused=editSchedule('pause',3601000);assert.equal(paused.remainingMs,duration-3600000);
 assert.equal(editSchedule('pause',900000000).remainingMs,paused.remainingMs);
 const resumed=editSchedule('resume',900000000);assert.equal(resumed.endsAt,900000000+paused.remainingMs);
 assert.equal(editSchedule('pause',resumed.endsAt+1).remainingMs,0);
 assert.equal(editSchedule('resume',resumed.endsAt+2).paused,true);
 console.log('Actual Redis event schedule passed: default pause, first resume, repeated actions, preserved time and ended-event guard.');
}finally{cmd('DEL',scheduleKey);}
