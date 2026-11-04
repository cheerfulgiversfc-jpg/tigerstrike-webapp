// Only disposable local keys; exercise the exact production Lua scripts.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const filename=path.resolve(__dirname,'../api/_lib/player-launch-store.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8').replace('module.exports={','module.exports={qaTrack:trackLua,qaSubmit:submitLua,'),filename);
const cli=process.env.REDIS_TEST_CLI||'/tmp/redis-7.2.5/src/redis-cli',prefix='qa:launch:'+process.pid+':'+Date.now(),keys=['user','totals','day','reports','receipt','rate','receipt2','rate2'].map(x=>prefix+':'+x);
const cmd=(...a)=>execFileSync(cli,['-h','127.0.0.1','-p','6389','--raw',...a.map(String)],{encoding:'utf8'}).trim();
try{
 const track=(day,event)=>cmd('EVAL',m.exports.qaTrack,3,keys[0],keys[1],keys[2],'991900',day,event);
 track('2026-11-03','open');track('2026-11-03','open');track('2026-11-03','tutorial-start');track('2026-11-03','tutorial-start');assert.equal(cmd('HGET',keys[1],'players'),'1');assert.equal(cmd('HGET',keys[1],'tutorial-start'),'1');
 track('2026-11-04','open');track('2026-11-04','open');assert.equal(cmd('HGET',keys[1],'returned'),'1');
 const submit=(kind,receipt,rate,id)=>cmd('EVAL',m.exports.qaSubmit,5,keys[0],keys[3],receipt,rate,keys[1],kind,JSON.stringify({id,kind,text:'Local QA only'}),id,kind==='feedback'?1:10,'mixed');
 assert.equal(submit('feedback',keys[4],keys[5],'first'),'saved');assert.equal(submit('feedback',keys[4],keys[5],'first'),'duplicate');assert.equal(submit('feedback',keys[6],keys[5],'other'),'already');assert.equal(cmd('HGET',keys[1],'feedback'),'1');assert.equal(cmd('HGET',keys[1],'fun_mixed'),'1');
 assert.equal(submit('bug',keys[6],keys[7],'bug'),'saved');assert.equal(cmd('LLEN',keys[3]),'2');cmd('SET',keys[7],10);cmd('DEL',keys[6]);assert.equal(submit('bug',keys[6],keys[7],'limited'),'limited');
 console.log('Actual Redis launch reporting passed: account/activity dedupe, UTC returns, feedback receipts, duplicate retries and bug rate limits.');
}finally{cmd('DEL',...keys);}
