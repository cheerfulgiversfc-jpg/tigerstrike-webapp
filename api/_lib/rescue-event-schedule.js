const { EVENT } = require('../../live-rescue-event');
const store = require('./rescue-event-store');
const key = 'ts:rescue:' + EVENT.id + ':schedule';
const DURATION = 14 * 24 * 60 * 60 * 1000;
const defaults = () => ({ paused:true, remainingMs:DURATION, endsAt:0, startedAt:0, revision:0 });

// One atomic edit preserves remaining time, including concurrent and repeated clicks.
const lua = `
local s=cjson.decode(redis.call('GET',KEYS[1]) or ARGV[3])
local now=tonumber(ARGV[2])
if ARGV[1]=='pause' and not s.paused then
  s.remainingMs=math.max(0,s.endsAt-now);s.paused=true
elseif ARGV[1]=='resume' and s.paused and s.remainingMs>0 then
  s.endsAt=now+s.remainingMs;s.paused=false
  if s.startedAt==0 then s.startedAt=now end
end
s.revision=(s.revision or 0)+1
redis.call('SET',KEYS[1],cjson.encode(s))
return cjson.encode(s)`;
function view(s, now=Date.now()) {
  const remainingMs = s.paused ? s.remainingMs : Math.max(0,s.endsAt-now);
  return { ...s, remainingMs, phase:remainingMs<=0?'ended':s.paused?'paused':'active', serverNow:now };
}
async function read() {
  const raw = await store.redis(['GET',key]);
  const s = raw === null ? (process.env.TS_RESCUE_EVENT_TEST_MEMORY==='1' ? globalThis.__TS_RESCUE_EVENT_SCHEDULE__ : null) : JSON.parse(raw);
  return view(s || defaults());
}
async function set(action) {
  if(!['pause','resume'].includes(action)) throw Error('Invalid event schedule action.');
  const now=Date.now(), raw=await store.redis(['EVAL',lua,1,key,action,now,JSON.stringify(defaults())]);
  if(raw!==null)return view(JSON.parse(raw),now);
  const s={...(globalThis.__TS_RESCUE_EVENT_SCHEDULE__||defaults())};
  if(action==='pause'&&!s.paused){s.remainingMs=Math.max(0,s.endsAt-now);s.paused=true;}
  else if(action==='resume'&&s.paused&&s.remainingMs>0){s.endsAt=now+s.remainingMs;s.paused=false;if(!s.startedAt)s.startedAt=now;}
  s.revision++;globalThis.__TS_RESCUE_EVENT_SCHEDULE__=s;return view(s,now);
}
function canManage(user) {
  return String(process.env.TELEGRAM_ADMIN_IDS||'').split(',').map(s=>s.trim()).includes(String(user?.id||''));
}
module.exports={read,set,canManage,DURATION};
