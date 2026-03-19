const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_SECONDS = 120 * 24 * 60 * 60;
const STATE_TTL_SECONDS = 365 * 24 * 60 * 60;
const MEM_KEY = "__TIGER_STRIKE_METRICS_MEM__";

function envText(name){
  return String(process.env[name] || "").trim();
}

function kvUrl(){
  return envText("KV_REST_API_URL") || envText("UPSTASH_REDIS_REST_URL");
}

function kvToken(){
  return envText("KV_REST_API_TOKEN") || envText("UPSTASH_REDIS_REST_TOKEN");
}

function hasKv(){
  return !!(kvUrl() && kvToken());
}

function storageMode(){
  return hasKv() ? "kv" : "memory";
}

function memStore(){
  if(!globalThis[MEM_KEY]){
    globalThis[MEM_KEY] = new Map();
  }
  return globalThis[MEM_KEY];
}

function pad2(n){
  return String(n).padStart(2, "0");
}

function dayIdFromMs(tsMs){
  const d = new Date(Number(tsMs || Date.now()));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function dayIdOffset(offsetDays){
  const ms = Date.now() + (Number(offsetDays || 0) * DAY_MS);
  return dayIdFromMs(ms);
}

function recentDayIds(days){
  const count = Math.max(1, Math.min(30, Number(days || 1)));
  const out = [];
  for(let i = count - 1; i >= 0; i--){
    out.push(dayIdOffset(-i));
  }
  return out;
}

function safePart(value){
  const raw = String(value || "").trim().toLowerCase();
  if(!raw) return "";
  return raw.replace(/[^a-z0-9:_-]/g, "_");
}

function metricKey(dayId, metricName){
  return `ts:metrics:v1:${safePart(dayId)}:${safePart(metricName)}`;
}

function stateKey(name){
  return `ts:state:v1:${safePart(name)}`;
}

function toNumber(value){
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function kvPipeline(commands){
  const url = kvUrl();
  const token = kvToken();
  if(!url || !token){
    throw new Error("KV is not configured.");
  }

  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands || []),
  });

  let data = null;
  try{ data = await res.json(); }catch(e){ data = null; }
  if(!res.ok){
    throw new Error(data?.error || data?.message || `KV pipeline failed (${res.status}).`);
  }

  if(Array.isArray(data)){
    return data.map((entry)=> {
      if(entry && typeof entry === "object" && "result" in entry) return entry.result;
      return entry;
    });
  }

  if(Array.isArray(data?.result)){
    return data.result;
  }

  return [];
}

async function incrMetric(metricName, by = 1, opts = {}){
  const amount = Math.max(1, Number(by || 1));
  const dayId = String(opts?.dayId || dayIdFromMs(Date.now())).trim();
  const key = metricKey(dayId, metricName);

  if(hasKv()){
    await kvPipeline([
      ["INCRBY", key, String(amount)],
      ["EXPIRE", key, String(DEFAULT_TTL_SECONDS)],
    ]);
    return;
  }

  const mem = memStore();
  mem.set(key, toNumber(mem.get(key)) + amount);
}

async function getMetric(metricName, opts = {}){
  const dayId = String(opts?.dayId || dayIdFromMs(Date.now())).trim();
  const key = metricKey(dayId, metricName);

  if(hasKv()){
    const values = await kvPipeline([["GET", key]]);
    return toNumber(values[0]);
  }

  const mem = memStore();
  return toNumber(mem.get(key));
}

async function getMetricsForDay(dayId, metricNames){
  const day = String(dayId || dayIdFromMs(Date.now())).trim();
  const names = Array.isArray(metricNames) ? metricNames : [];
  const cleanNames = names
    .map((name)=>String(name || "").trim())
    .filter(Boolean);

  if(cleanNames.length === 0){
    return {};
  }

  const out = {};
  if(hasKv()){
    const commands = cleanNames.map((name)=>["GET", metricKey(day, name)]);
    const values = await kvPipeline(commands);
    for(let i = 0; i < cleanNames.length; i++){
      out[cleanNames[i]] = toNumber(values[i]);
    }
    return out;
  }

  const mem = memStore();
  for(const name of cleanNames){
    out[name] = toNumber(mem.get(metricKey(day, name)));
  }
  return out;
}

async function summarizeMetrics(metricNames, days = 1){
  const dayIds = recentDayIds(days);
  const perDay = [];
  const totals = {};

  for(const dayId of dayIds){
    const row = await getMetricsForDay(dayId, metricNames);
    perDay.push({ dayId, metrics: row });
    for(const [name, value] of Object.entries(row)){
      totals[name] = toNumber(totals[name]) + toNumber(value);
    }
  }

  return {
    storage: storageMode(),
    dayIds,
    perDay,
    totals,
  };
}

async function setState(name, value){
  const key = stateKey(name);
  const data = JSON.stringify(value === undefined ? null : value);

  if(hasKv()){
    await kvPipeline([
      ["SET", key, data, "EX", String(STATE_TTL_SECONDS)],
    ]);
    return;
  }

  const mem = memStore();
  mem.set(key, data);
}

async function getState(name){
  const key = stateKey(name);
  let raw = null;

  if(hasKv()){
    const values = await kvPipeline([["GET", key]]);
    raw = values[0];
  }else{
    const mem = memStore();
    raw = mem.get(key);
  }

  if(raw === undefined || raw === null || raw === "") return null;
  try{ return JSON.parse(String(raw)); }catch(e){ return null; }
}

module.exports = {
  dayIdFromMs,
  dayIdOffset,
  recentDayIds,
  storageMode,
  incrMetric,
  getMetric,
  getMetricsForDay,
  summarizeMetrics,
  setState,
  getState,
};
