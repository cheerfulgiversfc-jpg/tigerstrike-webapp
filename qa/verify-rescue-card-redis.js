// Exercise the production Lua against disposable local Redis keys only.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const filename=path.resolve(__dirname,'../api/_lib/rescue-card-store.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8').replace('module.exports={','module.exports={qaPut:putLua,'),filename);
const cli=process.env.REDIS_TEST_CLI||'/tmp/redis-7.2.5/src/redis-cli',prefix='qa:photo:'+process.pid+':'+Date.now(),keys=['rate','receipt','image','receipt2','image2'].map(x=>prefix+':'+x);
const cmd=(...a)=>execFileSync(cli,['-h','127.0.0.1','-p','6389','--raw',...a.map(String)],{encoding:'utf8'}).trim();
try{
 const put=(receipt,image,id)=>cmd('EVAL',m.exports.qaPut,3,keys[0],receipt,image,'test-jpeg',JSON.stringify({id,expiresAt:Date.now()+86400000}));
 const a=put(keys[1],keys[2],'first');assert.equal(JSON.parse(a).id,'first');assert.equal(put(keys[1],keys[2],'retry'),a);assert.equal(cmd('GET',keys[0]),'1');assert.equal(cmd('GET',keys[2]),'test-jpeg');assert(Number(cmd('TTL',keys[2]))>86390);assert(Number(cmd('TTL',keys[1]))>86390);
 cmd('SET',keys[0],10);assert.equal(put(keys[3],keys[4],'limited'),'limited');assert.equal(cmd('EXISTS',keys[4]),'0');
 cmd('EXPIRE',keys[2],0);assert.equal(cmd('EXISTS',keys[2]),'0');
 console.log('Actual Redis photo transaction passed: retry dedupe, image/receipt expiry, and daily limit without extra image storage.');
}finally{cmd('DEL',...keys);}
