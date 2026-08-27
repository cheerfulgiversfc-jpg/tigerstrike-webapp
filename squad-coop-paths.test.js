const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const elements = new Map();
function element(id){
  if(!elements.has(id)){
    const listeners = {};
    elements.set(id, {
      id,
      dataset:{},
      style:{},
      listeners,
      innerHTML:"",
      textContent:"",
      classList:{ add(){}, remove(){}, toggle(){} },
      setAttribute(){},
      addEventListener(name, handler){ listeners[name] = handler; },
      contains(){ return true; },
      focus(){},
      select(){},
    });
  }
  return elements.get(id);
}

let soloLevel = 0;
const windowObject = {
  Telegram:{ WebApp:{ initData:"", initDataUnsafe:{ user:{ id:77 } } } },
  S:{ paused:true, pauseReason:"base-hq", storyLevel:72, storyLastMission:72 },
  localStorage:{ getItem(){ return null; }, setItem(){}, removeItem(){} },
  setTimeout:()=>1,
  clearTimeout(){},
  addEventListener(){},
  prepareLiveSquadHub(){},
  openSoloStoryMissionFromCoop(level){ soloLevel = level; },
};
const documentObject = {
  getElementById:element,
  querySelectorAll:()=>[],
  createElement:()=>element("temporary"),
  body:{ appendChild(){} },
};
const context = {
  window:windowObject,
  document:documentObject,
  navigator:{},
  location:{ search:"" },
  URLSearchParams,
  AbortController,
  Map,
  Set,
  Date,
  Math,
  performance:{ now:()=>0 },
  setTimeout:()=>1,
  clearTimeout(){},
  console,
  requestAnimationFrame:()=>1,
  cancelAnimationFrame(){},
  fetch:async()=>({ ok:false, json:async()=>({ ok:false }) }),
};
windowObject.document = documentObject;
windowObject.navigator = context.navigator;
windowObject.requestAnimationFrame = context.requestAnimationFrame;
windowObject.cancelAnimationFrame = context.cancelAnimationFrame;
windowObject.performance = context.performance;

vm.runInNewContext(fs.readFileSync("squad-coop.js", "utf8"), context, { filename:"squad-coop.js" });

function commandButton(command, extra={}){
  const button = {
    disabled:false,
    dataset:{ squadCommand:command, ...extra },
    classList:{ add(){}, remove(){} },
    closest(){ return button; },
    isConnected:true,
  };
  return button;
}

async function clickCommand(command, extra={}){
  const button = commandButton(command, extra);
  element("liveSquadOverlay").listeners.click({
    target:button,
    preventDefault(){},
    stopPropagation(){},
    stopImmediatePropagation(){},
  });
  await new Promise((resolve)=>setImmediate(resolve));
}

async function run(){
  windowObject.openLiveSquadOps();
  let html = element("squadBody").innerHTML;
  assert(html.includes("Choose how you want to play"), "Live Squad opens on the two-path home");
  assert(html.includes("Story Campaign"), "Story Campaign path is visible");
  assert(html.includes("Special Operations"), "Special Operations path is visible");
  assert(html.includes("Solo supports all 72 unlocked missions"), "home reports the real Solo unlock count");
  assert(html.includes("Two Player is ready for Missions 1–5"), "home reports the exact converted co-op range");

  await clickCommand("hub-story");
  html = element("squadBody").innerHTML;
  assert(html.includes("Unlocked 72/100"), "Story path keeps full Solo campaign progress");
  assert(html.includes("Story Mission 72"), "Story path defaults to the current unlocked mission");
  assert(html.includes("Solo only for now"), "unconverted missions are not presented as working co-op");
  assert(html.includes("Two Player coming later"), "unconverted Two Player button is visibly unavailable");

  await clickCommand("play-solo");
  assert.equal(soloLevel, 72, "Solo choice routes the selected level into normal Story pre-deploy");

  windowObject.openLiveSquadOps();
  html = element("squadBody").innerHTML;
  assert(html.includes("Choose how you want to play"), "returning later opens Co-op Home again");
  await clickCommand("hub-operations");
  html = element("squadBody").innerHTML;
  assert(html.includes("Operation Night Fang"), "Night Fang is inside Special Operations");
  assert(html.includes("does not change your Story mission number"), "Night Fang progression is explained as separate");
  assert(html.includes("not empty menu buttons"), "future operations are previews rather than fake controls");

  console.log("PASS: Co-op Home separates Story Campaign and Special Operations with accurate Solo/Two Player routing");
}

run().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});
