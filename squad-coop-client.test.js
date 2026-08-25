const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const userId = 910001;
const roomCode = "ASD123";
const storageKey = `ts_live_squad_active_v1:${userId}`;
const storage = new Map([[storageKey, JSON.stringify({
  code:roomCode,
  launchType:"shared-story",
  storyMissionLevel:1,
  savedAt:Date.now(),
})]]);
const timers = [];
const requests = [];
const elements = new Map();

function element(id){
  if(!elements.has(id)){
    elements.set(id, {
      id,
      dataset:{},
      style:{},
      classList:{ add(){}, remove(){}, toggle(){} },
      setAttribute(){},
      addEventListener(){},
      focus(){},
      select(){},
      innerHTML:"",
      textContent:"",
    });
  }
  return elements.get(id);
}

const snapshot = {
  code:roomCode,
  launchType:"shared-story",
  storyMissionLevel:1,
  viewerId:userId,
  hostId:userId,
  isHost:true,
  status:"active",
  memberCount:2,
  serverNow:Date.now(),
  timeLeftMs:300000,
  mission:{ title:"Story Mission 1", objective:"Escort 2 villagers", rescueRequired:2, civilianCount:3 },
  world:{ width:1200, height:1100 },
  extraction:{ x:1045, y:735, r:92 },
  civilians:[],
  tigers:[],
  rescuedIds:[],
  extractionReadyIds:[],
  players:[
    { userId, slot:0, name:"Host", role:"tracker", x:125, y:850, hp:105, maxHp:105, livesRemaining:1, online:true },
    { userId:910002, slot:1, name:"Teammate", role:"medic", x:215, y:850, hp:120, maxHp:120, livesRemaining:1, online:true },
  ],
};

const windowObject = {
  Telegram:{ WebApp:{ initData:"signed-telegram-data", initDataUnsafe:{ user:{ id:userId } } } },
  S:{ paused:true, pauseReason:"base-hq" },
  localStorage:{
    getItem:(key)=>storage.get(key) || null,
    setItem:(key,value)=>storage.set(key,String(value)),
    removeItem:(key)=>storage.delete(key),
  },
  setTimeout:(fn,ms)=>{ if(ms < 5000) timers.push(fn); return timers.length; },
  clearTimeout(){},
  addEventListener(name,fn){ if(name === "load") this.loadHandler = fn; },
  prepareLiveSquadHub(){},
};

const context = {
  window:windowObject,
  document:{
    getElementById:element,
    querySelectorAll:()=>[],
    createElement:()=>element("temporary"),
    body:{ appendChild(){} },
  },
  navigator:{},
  location:{ search:"" },
  URLSearchParams,
  AbortController,
  Map,
  Set,
  Date,
  Math,
  performance:{ now:()=>0 },
  console,
  requestAnimationFrame:()=>1,
  cancelAnimationFrame(){},
  fetch:async (_url, options)=>{
    requests.push(JSON.parse(options.body));
    return { ok:true, json:async()=>({ ok:true, snapshot, roles:[] }) };
  },
};
windowObject.document = context.document;
windowObject.navigator = context.navigator;
windowObject.requestAnimationFrame = context.requestAnimationFrame;
windowObject.cancelAnimationFrame = context.cancelAnimationFrame;
windowObject.performance = context.performance;

vm.runInNewContext(fs.readFileSync("squad-coop.js", "utf8"), context, { filename:"squad-coop.js" });

async function run(){
  assert.equal(typeof windowObject.loadHandler, "function", "load recovery is registered");
  windowObject.loadHandler();
  assert.equal(timers.length, 1, "a saved room schedules automatic recovery");
  const resume = timers.shift();
  const recovery = resume();
  assert(recovery && typeof recovery.then === "function", "the scheduled recovery is awaitable");
  await recovery;
  await new Promise((resolve)=>setImmediate(resolve));
  assert(requests.length >= 1, "reopen makes a recovery request");
  assert.equal(requests[0].action, "status", "reopen checks membership instead of trying to join again");
  assert.equal(requests[0].code, roomCode, "reopen uses the remembered room code");
  assert.equal(element("squadBody").dataset.squadMode, "active", "the restored room opens directly on the active mission");
  assert.equal(JSON.parse(storage.get(storageKey)).code, roomCode, "valid active room remains remembered");
  console.log("PASS: Telegram reopen restores the remembered active Story room");
}

run().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});
