const crypto=require('node:crypto'),D=require('../../mission-debrief'),rules=require('../../rescue-partners');
const PREFIX='ts:partners:v1:';
const memory=()=>globalThis.__TS_PARTNER_MEMORY__||(globalThis.__TS_PARTNER_MEMORY__={pairs:new Map(),seen:new Set(),recent:new Map(),connections:new Map(),rates:new Map()});
const clean=s=>String(s||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,60);
function uid(n){n=Number(n);if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid teammate.');return String(n);}
function ids(a,b){a=uid(a);b=uid(b);if(a===b)throw Error('Choose a teammate, not your own account.');return [a,b].sort((x,y)=>Number(x)-Number(y));}
function key(a,b){return PREFIX+'pair:'+ids(a,b).join(':');}
async function redis(command,timeout=3500){const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;if(!url||!token){if(process.env.TS_PARTNER_TEST_MEMORY==='1')return null;throw Error('Rescue partner records are temporarily unavailable. Your mission rewards are unaffected.');}const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(timeout)}),d=await r.json();if(!r.ok||d.error)throw Error('Could not save rescue partner records. Please retry.');return d.result;}
function event(raw){
 const run=D.summary(raw?.run||{}),members=Array.isArray(raw?.members)?raw.members:[];
 if(!run.completed||run.scope!=='coop'||members.length!==2||!run.id)return null;
 let pair;try{pair=ids(members[0].id,members[1].id);}catch{return null;}
 const actors=D.summary({actors:members}).actors;
 return {run,members:pair.map(id=>{const i=members.findIndex(m=>String(m.id)===id);return {...actors[i],id,name:clean(members[i].name)||'Rescue teammate'};})};
}
const recordLua=`
if redis.call('HEXISTS',KEYS[1],'receipt:'..ARGV[2])==1 then return 'duplicate' end
local e=cjson.decode(ARGV[1]);local raw=redis.call('HGET',KEYS[1],'data');local p=raw and cjson.decode(raw) or {runs=0,rescued=0,captures=0,kills=0,distinct=0,perfect=0,missions={},want={},selection={},cooldown={}}
p.members=e.members;p.lastPlayed=tonumber(ARGV[3]);p.runs=p.runs+1;p.rescued=p.rescued+e.run.rescued;p.captures=p.captures+e.run.captures;p.kills=p.kills+e.run.kills
if e.run.civilianTotal>0 and e.run.rescued==e.run.civilianTotal and e.run.civilianLost==0 then p.perfect=p.perfect+1 end
local mission=p.missions[e.run.key];if not mission then mission={title=e.run.title,clears=0};p.distinct=p.distinct+1 end
mission.clears=mission.clears+1;if e.run.durationMs and e.run.durationMs~=cjson.null and e.run.durationMs>0 and (not mission.fastestMs or e.run.durationMs<mission.fastestMs) then mission.fastestMs=e.run.durationMs end
p.missions[e.run.key]=mission
redis.call('HSET',KEYS[1],'receipt:'..ARGV[2],'1','data',cjson.encode(p))
redis.call('ZADD',KEYS[2],ARGV[3],e.members[2].id);redis.call('ZREMRANGEBYRANK',KEYS[2],0,-21)
redis.call('ZADD',KEYS[3],ARGV[3],e.members[1].id);redis.call('ZREMRANGEBYRANK',KEYS[3],0,-21)
return 'recorded'`;
const actionLua=`
local raw=redis.call('HGET',KEYS[1],'data');if not raw then return 'missing' end
local p=cjson.decode(raw);local me=ARGV[1];local peer=ARGV[2];local action=ARGV[3];local now=tonumber(ARGV[4]);local value=ARGV[5]
if action=='request' or action=='accept' then
 if action=='accept' and not p.want[peer] then return 'no-request' end
 if (p.cooldown[me] or 0)>now then return 'cooldown' end
 if not p.want[me] then
  if action=='request' and tonumber(redis.call('GET',KEYS[4]) or 0)>=10 then return 'limited' end
  if (redis.call('ZSCORE',KEYS[2],peer)==false and redis.call('ZCARD',KEYS[2])>=20) or (redis.call('ZSCORE',KEYS[3],me)==false and redis.call('ZCARD',KEYS[3])>=20) then return 'full' end
  p.want[me]=true;redis.call('ZADD',KEYS[2],now,peer);redis.call('ZADD',KEYS[3],now,me)
  if action=='request' then redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],172800) end
 end
elseif action=='decline' or action=='remove' or action=='cancel' then
 if action=='decline' then p.cooldown[peer]=now+86400000 end
 p.want[me]=nil;p.want[peer]=nil;redis.call('ZREM',KEYS[2],peer);redis.call('ZREM',KEYS[3],me)
elseif action=='equip' then
 if not p.want[me] or not p.want[peer] then return 'not-partners' end
 local earned=value=='' or (value=='first-response' and p.runs>=1) or (value=='rescue-link' and p.distinct>=5) or (value=='conservation-team' and p.captures>=10)
 if not earned then return 'locked' end;p.selection[me]=value
else return 'invalid' end
redis.call('HSET',KEYS[1],'data',cjson.encode(p));return 'ok'`;
async function record(raw){const e=event(raw);if(!e)throw Error('A completed two-player Co-op result is required.');const [a,b]=e.members.map(m=>m.id),receipt=crypto.createHash('sha256').update(e.run.id).digest('hex'),at=Date.now();let result=await redis(['EVAL',recordLua,3,key(a,b),PREFIX+'recent:'+a,PREFIX+'recent:'+b,JSON.stringify(e),receipt,at]);if(result!==null){styleCache.delete(key(a,b));return result;}
 styleCache.delete(key(a,b));const m=memory(),k=key(a,b),r=k+':'+receipt;if(m.seen.has(r))return 'duplicate';m.seen.add(r);const p=m.pairs.get(k)||{runs:0,rescued:0,captures:0,kills:0,distinct:0,perfect:0,missions:{},want:{},selection:{},cooldown:{}};p.members=e.members;p.lastPlayed=at;p.runs++;p.rescued+=e.run.rescued;p.captures+=e.run.captures;p.kills+=e.run.kills;if(e.run.civilianTotal>0&&e.run.rescued===e.run.civilianTotal&&!e.run.civilianLost)p.perfect++;const old=p.missions[e.run.key]||{title:e.run.title,clears:0};if(!old.clears)p.distinct++;old.clears++;if(e.run.durationMs&&(!old.fastestMs||e.run.durationMs<old.fastestMs))old.fastestMs=e.run.durationMs;p.missions[e.run.key]=old;m.pairs.set(k,p);
 for(const [who,peer] of [[a,b],[b,a]]){const list=m.recent.get(who)||new Map();list.set(peer,at);m.recent.set(who,new Map([...list].sort((x,y)=>y[1]-x[1]).slice(0,20)));}return 'recorded';}
async function pair(a,b,timeout){const raw=await redis(['HGET',key(a,b),'data'],timeout);if(raw!==null)return JSON.parse(raw);return process.env.TS_PARTNER_TEST_MEMORY==='1'?memory().pairs.get(key(a,b))||null:null;}
function view(p,me){const peer=p.members.find(m=>m.id!==me),mutual=!!p.want[me]&&!!p.want[peer.id];return {peerId:peer.id,name:peer.name,lastPlayed:p.lastPlayed,status:mutual?'partners':p.want[me]?'outgoing':p.want[peer.id]?'incoming':'recent',runs:p.runs,rescued:p.rescued,captures:p.captures,kills:p.kills,distinct:p.distinct,perfect:p.perfect,missions:Object.values(p.missions).slice(-160),rewards:rules.rewards(p),myStyle:rules.style(p,me),players:p.members.map(m=>({...m,self:m.id===me,partnerStyle:rules.style(p,m.id)}))};}
async function list(userId){const me=uid(userId),[recent,connections]=await Promise.all([redis(['ZREVRANGE',PREFIX+'recent:'+me,0,19]),redis(['ZREVRANGE',PREFIX+'connections:'+me,0,19])]);const peers=recent===null?[...new Set([...(memory().recent.get(me)?.keys()||[]),...(memory().connections.get(me)?.keys()||[])])]:[...new Set([...(recent||[]),...(connections||[])])];let pairs;if(recent===null)pairs=peers.map(id=>memory().pairs.get(key(me,id)));else if(peers.length){const raw=await redis(['EVAL',"local a={} for i=1,#KEYS do a[i]=redis.call('HGET',KEYS[i],'data') or '' end return a",peers.length,...peers.map(id=>key(me,id))]);pairs=raw.map(v=>v?JSON.parse(v):null);}else pairs=[];return pairs.filter(Boolean).map(p=>view(p,me)).sort((a,b)=>Number(b.status==='incoming')-Number(a.status==='incoming')||Number(b.status==='partners')-Number(a.status==='partners')||b.lastPlayed-a.lastPlayed);}

async function act(userId,peerId,action,value=''){const me=uid(userId),peer=uid(peerId);ids(me,peer);if(!['request','accept','decline','remove','cancel','equip'].includes(action))throw Error('Unknown partner action.');if(!['',...rules.STYLES.map(s=>s.id)].includes(value))throw Error('Unknown team cosmetic.');const at=Date.now(),rate=me+':'+new Date().toISOString().slice(0,10);let result=await redis(['EVAL',actionLua,4,key(me,peer),PREFIX+'connections:'+me,PREFIX+'connections:'+peer,PREFIX+'rate:'+rate,me,peer,action,at,value]);
 if(result===null){const m=memory(),p=m.pairs.get(key(me,peer));if(!p)result='missing';else{const mine=m.connections.get(me)||new Map(),theirs=m.connections.get(peer)||new Map();result='ok';if(['request','accept'].includes(action)){if(action==='accept'&&!p.want[peer])result='no-request';else if((p.cooldown[me]||0)>at)result='cooldown';else if(!p.want[me]){if(action==='request'&&(m.rates.get(rate)||0)>=10)result='limited';else if(!mine.has(peer)&&mine.size>=20||!theirs.has(me)&&theirs.size>=20)result='full';else{p.want[me]=true;mine.set(peer,at);theirs.set(me,at);if(action==='request')m.rates.set(rate,(m.rates.get(rate)||0)+1);}}}else if(['decline','remove','cancel'].includes(action)){if(action==='decline')p.cooldown[peer]=at+86400000;delete p.want[me];delete p.want[peer];mine.delete(peer);theirs.delete(me);}else if(!p.want[me]||!p.want[peer])result='not-partners';else if(value&&!rules.rewards(p).some(s=>s.id===value&&s.earned))result='locked';else p.selection[me]=value;m.connections.set(me,mine);m.connections.set(peer,theirs);}}
 const errors={missing:'Complete a Co-op mission with this teammate first.','no-request':'There is no incoming request to accept.',cooldown:'This player declined recently. Please give them time.',limited:'Daily partnership request limit reached.',full:'One player has 20 partnerships or requests. Clear an old request first.','not-partners':'Both players must agree to the partnership first.',locked:'Complete the displayed team milestone to unlock this cosmetic.',invalid:'Unknown partner action.'};if(result!=='ok')throw Error(errors[result]||'Partner action unavailable.');styleCache.delete(key(me,peer));return view(await pair(me,peer),me);}
const styleCache=new Map();
async function styles(a,b){const k=key(a,b),cached=styleCache.get(k);if(cached&&Date.now()-cached.at<3000)return cached.value;try{const p=await pair(a,b,700),value=p?Object.fromEntries(p.members.map(m=>[m.id,rules.style(p,m.id)])):{};styleCache.set(k,{at:Date.now(),value});if(styleCache.size>500)styleCache.delete(styleCache.keys().next().value);return value;}catch(error){if(cached)return cached.value;styleCache.set(k,{at:Date.now(),value:{}});return {};}}
const metrics=require('./metrics-store');
function pendingStorage(){if(!(process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL)||!(process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN)){if(process.env.TS_PARTNER_TEST_MEMORY!=='1'&&process.env.TS_PARTNER_TEST_PENDING_MEMORY!=='1')throw Error('Durable team record retry storage is unavailable.');}}
async function pending(userId){pendingStorage();const me=uid(userId),raw=await metrics.getState('rescue_partner_pending_'+me);return (Array.isArray(raw)?raw:[]).map(event).filter(e=>e&&e.members.some(m=>m.id===me)).slice(-32);}
async function queue(userId,raw){pendingStorage();const me=uid(userId),e=event(raw);if(!e||!e.members.some(m=>m.id===me))throw Error('Invalid pending team result.');const k='rescue_partner_pending_'+me;for(let i=0;i<4;i++){const old=await metrics.getState(k),rows=Array.isArray(old)?old:[];if(rows.some(r=>r.run.id===e.run.id))return;if(rows.length>=32)throw Error('Retry pending team records before adding more.');if(await metrics.compareAndSetState(k,old,[...rows,e]))return;}throw Error('Team record retry is busy.');}
async function retry(userId){pendingStorage();const me=uid(userId),rows=await pending(me),done=new Set();for(let i=0;i<rows.length;i+=4)await Promise.all(rows.slice(i,i+4).map(async e=>{try{await record(e);done.add(e.run.id);}catch{}}));const k='rescue_partner_pending_'+me;for(let i=0;i<4;i++){const old=await metrics.getState(k);if(!old)return 0;const next=old.filter(e=>!done.has(e.run.id));if(await metrics.compareAndSetState(k,old,next))return next.length;}throw Error('Team records were saved. Refresh to retry the pending list.');}
module.exports={record,event,pair,list,act,styles,view,pending,queue,retry};
