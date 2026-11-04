const PREFIX='ts:launch:v1:';
const memory=()=>globalThis.__TS_LAUNCH_MEMORY__||(globalThis.__TS_LAUNCH_MEMORY__={totals:{},users:new Map(),days:new Map(),reports:[],receipts:new Set(),rates:new Map()});
async function redis(command){
  const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token){if(process.env.TS_LAUNCH_TEST_MEMORY==='1')return null;throw Error('Player feedback storage is unavailable. Please try again later.');}
  const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(2000)}),d=await r.json();
  if(!r.ok||d.error)throw Error('Player feedback storage is unavailable. Please try again later.');return d.result;
}
const trackLua=`
local first=redis.call('HSETNX',KEYS[1],'firstDay',ARGV[2])
if first==1 then redis.call('HINCRBY',KEYS[2],'players',1) end
local day=redis.call('HGET',KEYS[1],'firstDay')
if day~=ARGV[2] and redis.call('HSETNX',KEYS[1],'returned','1')==1 then redis.call('HINCRBY',KEYS[2],'returned',1) end
redis.call('SADD',KEYS[3],ARGV[1]);redis.call('EXPIRE',KEYS[3],3024000)
if ARGV[3]~='open' and redis.call('HSETNX',KEYS[1],ARGV[3],'1')==1 then redis.call('HINCRBY',KEYS[2],ARGV[3],1) end
return 1`;
const submitLua=`
if redis.call('EXISTS',KEYS[3])==1 then return 'duplicate' end
if ARGV[1]=='feedback' and redis.call('HEXISTS',KEYS[1],'feedbackId')==1 then return 'already' end
local count=tonumber(redis.call('GET',KEYS[4]) or 0)
if count>=tonumber(ARGV[4]) then return 'limited' end
redis.call('SET',KEYS[3],'1','EX',2592000)
redis.call('INCR',KEYS[4]);redis.call('EXPIRE',KEYS[4],172800)
redis.call('LPUSH',KEYS[2],ARGV[2]);redis.call('LTRIM',KEYS[2],0,99)
redis.call('HINCRBY',KEYS[5],ARGV[1],1)
if ARGV[1]=='feedback' then redis.call('HSET',KEYS[1],'feedbackId',ARGV[3]);redis.call('HINCRBY',KEYS[5],'fun_'..ARGV[5],1) end
return 'saved'`;
function uid(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid player account.');return String(n);}
const day=()=>new Date().toISOString().slice(0,10);
const allowedEvents=new Set(['open','tutorial-start','tutorial-complete','solo-clear','coop-clear']);
async function track(userId,event='open'){
  userId=uid(userId);if(!allowedEvents.has(event))throw Error('Invalid launch activity.');const today=day();
  const result=await redis(['EVAL',trackLua,3,PREFIX+'user:'+userId,PREFIX+'totals',PREFIX+'day:'+today,userId,today,event]);
  if(result!==null)return;
  const m=memory(),u=m.users.get(userId)||{firstDay:today,events:new Set()};
  if(!m.users.has(userId)||!u.firstDay){u.firstDay=today;m.totals.players=(m.totals.players||0)+1;}
  if(u.firstDay!==today&&!u.returned){u.returned=true;m.totals.returned=(m.totals.returned||0)+1;}
  if(event!=='open'&&!u.events.has(event)){u.events.add(event);m.totals[event]=(m.totals[event]||0)+1;}
  m.users.set(userId,u);const seen=m.days.get(today)||new Set();seen.add(userId);m.days.set(today,seen);
}
function cleanContext(raw={}){
  return {build:/^\d{4}$/.test(String(raw.build||''))?String(raw.build):'unknown',mode:['Solo','Co-op','Arcade','Survival','Training','Menu'].includes(raw.mode)?raw.mode:'Menu',mission:Math.max(0,Math.min(100,Math.floor(Number(raw.mission)||0))),scene:['welcome','hq','mission','results','shop','inventory','loading','connection','other'].includes(raw.scene)?raw.scene:'other'};
}
function text(value){return String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim().slice(0,800);}
async function submit(userId,kind,raw={}){
  userId=uid(userId);if(!['feedback','bug'].includes(kind))throw Error('Invalid report type.');
  const id=String(raw.id||'');if(!/^[a-zA-Z0-9_-]{12,80}$/.test(id))throw Error('Invalid report receipt.');
  const fun=String(raw.fun||'');if(kind==='feedback'&&!['yes','mixed','no'].includes(fun))throw Error('Choose whether the mission was fun.');
  const message=text(raw.text);if(kind==='bug'&&message.length<10)throw Error('Please describe the problem in at least 10 characters.');
  const report={id,kind,account:userId,at:new Date().toISOString(),context:cleanContext(raw.context),text:message,...(kind==='feedback'?{fun}:{})};
  const key=userId+':'+id,rate=userId+':'+day()+':'+kind;
  let result=await redis(['EVAL',submitLua,5,PREFIX+'user:'+userId,PREFIX+'reports',PREFIX+'receipt:'+key,PREFIX+'rate:'+rate,PREFIX+'totals',kind,JSON.stringify(report),id,kind==='feedback'?1:10,fun]);
  if(result===null){const m=memory(),u=m.users.get(userId)||{events:new Set()};if(m.receipts.has(key))result='duplicate';else if(kind==='feedback'&&u.feedbackId)result='already';else if((m.rates.get(rate)||0)>=(kind==='feedback'?1:10))result='limited';else{m.receipts.add(key);m.rates.set(rate,(m.rates.get(rate)||0)+1);m.reports.unshift(report);m.reports=m.reports.slice(0,100);m.totals[kind]=(m.totals[kind]||0)+1;if(kind==='feedback'){u.feedbackId=id;m.totals['fun_'+fun]=(m.totals['fun_'+fun]||0)+1;}m.users.set(userId,u);result='saved';}}
  if(result==='limited')throw Error('Daily report limit reached. Please try again tomorrow.');return {result};
}
async function status(userId){userId=uid(userId);const value=await redis(['HGET',PREFIX+'user:'+userId,'feedbackId']);return {feedbackSubmitted:value!==null?!!value:!!memory().users.get(userId)?.feedbackId};}
async function dashboard(){
  const raw=await redis(['HGETALL',PREFIX+'totals']),reports=await redis(['LRANGE',PREFIX+'reports',0,29]);
  if(raw===null){const m=memory();return {totals:{...m.totals},reports:m.reports.slice(0,30),since:'V16.3',today:new Date().toISOString().slice(0,10),todayPlayers:m.days.get(day())?.size||0};}
  const totals={};for(let i=0;i<(raw||[]).length;i+=2)totals[raw[i]]=Number(raw[i+1])||0;
  return {totals,reports:(reports||[]).map(x=>{try{return JSON.parse(x)}catch{return null}}).filter(Boolean),since:'V16.3',today:day(),todayPlayers:Number(await redis(['SCARD',PREFIX+'day:'+day()]))||0};
}
module.exports={track,submit,status,dashboard,cleanContext};
