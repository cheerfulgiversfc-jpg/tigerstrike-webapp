// Optional isolated integration check. Requires a temporary loopback Redis server.
// Only touches unique qa:organizer:* keys, then removes those exact test keys.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const filename=path.resolve(__dirname,'../api/_lib/elite-store.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(fs.readFileSync(filename,'utf8').replace('module.exports={','module.exports={testLua:lua,testCoopLua:coopPresetLua,'),filename);
const cli=process.env.REDIS_TEST_CLI||'/tmp/redis-7.2.5/src/redis-cli',port=process.env.REDIS_TEST_PORT||'6389';
function command(...args){return execFileSync(cli,['-h','127.0.0.1','-p',port,'--raw',...args.map(String)],{encoding:'utf8'}).trim();}
function set(k,v){command('SET',k,JSON.stringify(v));}function get(k){return JSON.parse(command('GET',k)||'null');}
const prefix='qa:organizer:'+process.pid+':'+Date.now(),keys=['elite','room','player','profile','weapon'].map(k=>prefix+':'+k),[elite,room,player,profile,weapon]=keys;
const preset={name:'Test Rescue',weaponId:'field_carbine',ammoMode:'rubber',toolId:'med-drone',roleId:'tracker',appearance:{soldier:'midnight',weapon:'',equipment:'',badge:'',extraction:''}};
const evalLua=(script,scriptKeys,arg)=>JSON.parse(command('EVAL',script,scriptKeys.length,...scriptKeys,JSON.stringify(arg)));
try{
 set(elite,{owned:['organizer','midnight'],selection:{},charges:{},orders:{}});
 const crud=m.exports.testLua;
 let s;
 // The production script receives operation and JSON as two separate arguments.
 const edit=(op,args)=>JSON.parse(command('EVAL',crud,1,elite,op,JSON.stringify(args)));
 s=edit('preset-save',{mode:'Coop',slot:0,expectedRevision:0,preset,now:100});assert.equal(s.organizer.Coop['0'].revision,1);
 assert.match(edit('preset-save',{mode:'Coop',slot:0,expectedRevision:0,preset,now:101}).error,/another device/);
 s=edit('preset-save',{mode:'Story',slot:0,expectedRevision:0,preset:{...preset,weaponId:'W_TEST'},now:102});assert(s.organizer.Coop['0'].preset);assert(s.organizer.Story['0'].preset);
 s=edit('preset-delete',{mode:'Story',slot:0,expectedRevision:1,now:103});assert.equal(s.organizer.Story['0'].preset,null);assert.equal(s.organizer.Story['0'].revision,2);
 set(room,{status:'waiting',createdAt:22,launchType:'shared-story',memberIds:[8,9]});set(player,{userId:8,hp:25,armor:17,rescueTool:{id:'smoke',charges:0,uses:2,cooldownUntil:99999},stats:{captures:9},tigerDamage:{test:5}});set(profile,{ownedWeaponIds:['field_carbine'],funds:1234,ammo:{rubber:12,real:9},supplies:{medkits:2},stats:{captures:9}});
 const args={uid:8,slot:0,expectedRevision:1,createdAt:22,selection:preset.appearance,profile:{}};
 const beforeProfile=get(profile),before=get(player);assert.equal(evalLua(m.exports.testCoopLua,keys,args).ok,true);assert.deepEqual(get(profile),beforeProfile);const after=get(player);for(const field of ['hp','armor','stats','tigerDamage'])assert.deepEqual(after[field],before[field]);assert.equal(after.rescueTool.charges,0);assert.equal(after.rescueTool.id,'med-drone');assert.equal(get(weapon).weaponId,'field_carbine');
 set(room,{...get(room),status:'active'});const frozen=keys.map(get);assert.match(evalLua(m.exports.testCoopLua,keys,args).error,/already started/);assert.deepEqual(keys.map(get),frozen);
 set(room,{...get(room),status:'waiting'});set(profile,{funds:1234});args.profile=beforeProfile;assert.equal(evalLua(m.exports.testCoopLua,keys,args).ok,true);assert.deepEqual(get(profile),{funds:1234});
 set(profile,{...beforeProfile,ammo:{rubber:0,real:9}});assert.match(evalLua(m.exports.testCoopLua,keys,args).error,/Restock/);
 s=get(elite);s.owned=['midnight'];set(elite,s);assert.match(edit('preset-delete',{mode:'Coop',slot:0,expectedRevision:1,now:104}).error,/Own Armory/);assert.match(evalLua(m.exports.testCoopLua,keys,args).error,/Own Armory/);
 console.log('Actual Redis Lua passed: save, stale revision, mode isolation, tombstone delete, atomic waiting-room apply, supply conservation, mission-start race, zero ammo and revoked entitlement.');
}finally{command('DEL',...keys);}
