// Real local Redis, production metrics-store methods, disposable QA keys only.
const {execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const cli=process.env.REDIS_TEST_CLI||'/tmp/redis-7.2.5/src/redis-cli',prefix='qa_match_cas_'+process.pid+'_'+Date.now(),key='ts:state:v1:'+prefix;
const command=(...args)=>JSON.parse(execFileSync(cli,['-h','127.0.0.1','-p','6389','--json',...args.map(String)],{encoding:'utf8'}));
process.env.KV_REST_API_URL='http://qa-only.invalid';process.env.KV_REST_API_TOKEN='qa-only';const original=global.fetch;
global.fetch=async(_url,options)=>({ok:true,json:async()=>JSON.parse(options.body).map(args=>({result:command(...args)}))});
(async()=>{try{const store=require('../api/_lib/metrics-store');assert(await store.compareAndSetState(prefix,null,{code:'FIRST'},7200));assert(!await store.compareAndSetState(prefix,null,{code:'SECOND'},7200));assert(!await store.compareAndSetState(prefix,{code:'OLD'},{code:'SECOND'},7200));assert(await store.compareAndSetState(prefix,{code:'FIRST'},{code:'SECOND'},7200));assert.deepEqual(await store.getState(prefix),{code:'SECOND'});assert(command('TTL',key)>7190);console.log('Actual Redis queue CAS passed: missing slot, stale-reader rejection, exact replacement and queue TTL.');}finally{command('DEL',key);global.fetch=original;}})().catch(error=>{console.error(error);process.exitCode=1;});
