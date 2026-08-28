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
  assert(html.includes("Two Player is ready for Missions 1–20"), "home reports the exact converted co-op range");

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
  await clickCommand("hub-story");
  await clickCommand("select-story", { squadStoryLevel:"6" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Story Mission 6"), "Mission 6 is selectable in Story Campaign");
  assert(html.includes("Tall Grass Ambush"), "Mission 6 exposes its real co-op objective");
  assert(html.includes("Two Player ready"), "Mission 6 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"8" });
  html = element("squadBody").innerHTML;
  assert(html.includes("First Research Capture"), "Mission 8 exposes its research-capture objective");
  assert(html.includes("Create Two Player Squad"), "Mission 8 can create a real shared room");

  await clickCommand("select-story", { squadStoryLevel:"10" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Village Alpha"), "Mission 10 exposes its Village Alpha boss objective");
  assert(html.includes("Two Player ready"), "Mission 10 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"11" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Narrow Path Escort"), "Mission 11 exposes its Chapter 2 escort objective");
  assert(html.includes("Two Player ready"), "Mission 11 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"13" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Double Research Capture"), "Mission 13 exposes its two-capture objective");

  await clickCommand("select-story", { squadStoryLevel:"19" });
  html = element("squadBody").innerHTML;
  assert(html.includes("High-Aggression Swarm"), "Mission 19 exposes its nine-tiger swarm objective");

  await clickCommand("select-story", { squadStoryLevel:"20" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Blood Tiger"), "Mission 20 exposes its Blood Tiger boss objective");
  assert(html.includes("Two Player ready"), "Mission 20 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"21" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Solo only for now"), "Mission 21 remains accurately marked Solo-only");

  windowObject.openLiveSquadOps();
  await clickCommand("hub-operations");
  html = element("squadBody").innerHTML;
  assert(html.includes("Operation Night Fang"), "Night Fang is inside Special Operations");
  assert(html.includes("Tiger Den Assault"), "Tiger Den Assault is a real Special Operation choice");
  assert(html.includes("Village Siege"), "Village Siege is a real Special Operation choice");
  assert(html.includes("Convoy Rescue"), "Convoy Rescue is a real Special Operation choice");
  assert(html.includes("Alpha Hunt"), "Alpha Hunt is a real Special Operation choice");
  assert(html.includes("Storm Extraction"), "Storm Extraction is a real Special Operation choice");
  assert(html.includes("Endless Survival"), "Endless Survival is a real Special Operation choice");
  assert(html.includes("Special Operations do not change your Story mission number"), "Special Operation progression is explained as separate");
  assert(!html.includes("only after its real gameplay is complete"), "no playable operation is left behind a fake preview");

  await clickCommand("select-operation", { squadOperation:"tiger-den" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Cave Wilds"), "Tiger Den selection exposes its own map identity");
  assert(html.includes("Stoneclaw Alpha"), "Tiger Den selection exposes its own boss objective");
  assert(html.includes("$8,200"), "Tiger Den selection shows its exact reward");
  assert(html.includes("Create Tiger Den Assault Squad"), "Tiger Den can create its own squad room");

  await clickCommand("select-operation", { squadOperation:"village-siege" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Suncrest Village"), "Village Siege selection exposes its own map identity");
  assert(html.includes("Ironmane Alpha"), "Village Siege selection exposes its own boss objective");
  assert(html.includes("$9,600"), "Village Siege selection shows its exact reward");
  assert(html.includes("Suncrest Village Shield badge"), "Village Siege selection names its unique badge");
  assert(html.includes("Create Village Siege Squad"), "Village Siege can create its own squad room");

  await clickCommand("select-operation", { squadOperation:"convoy-rescue" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Redwood Convoy Route"), "Convoy Rescue selection exposes its own map identity");
  assert(html.includes("Roadclaw Alpha"), "Convoy Rescue selection exposes its own boss objective");
  assert(html.includes("$11,200"), "Convoy Rescue selection shows its exact reward");
  assert(html.includes("Redwood Convoy Guardian badge"), "Convoy Rescue selection names its unique badge");
  assert(html.includes("Create Convoy Rescue Squad"), "Convoy Rescue can create its own squad room");

  await clickCommand("select-operation", { squadOperation:"alpha-hunt" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Moonshadow Highlands"), "Alpha Hunt selection exposes its own map identity");
  assert(html.includes("Ghoststripe Alpha"), "Alpha Hunt selection exposes its own boss objective");
  assert(html.includes("$13,000"), "Alpha Hunt selection shows its exact reward");
  assert(html.includes("Ghoststripe Apex Hunter badge"), "Alpha Hunt selection names its unique badge");
  assert(html.includes("Create Alpha Hunt Squad"), "Alpha Hunt can create its own squad room");

  await clickCommand("select-operation", { squadOperation:"storm-extraction" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Tempest Coast"), "Storm Extraction selection exposes its own map identity");
  assert(html.includes("Tempest Alpha"), "Storm Extraction selection exposes its own boss objective");
  assert(html.includes("$15,000"), "Storm Extraction selection shows its exact reward");
  assert(html.includes("Tempest Coast Lifeline badge"), "Storm Extraction selection names its unique badge");
  assert(html.includes("Create Storm Extraction Squad"), "Storm Extraction can create its own squad room");

  await clickCommand("select-operation", { squadOperation:"endless-survival" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Last Stand Basin"), "Endless Survival selection exposes its own map identity");
  assert(html.includes("Relentless Alpha"), "Endless Survival selection exposes its recurring Alpha threat");
  assert(html.includes("22% more health"), "Endless Survival explains its real wave scaling");
  assert(html.includes("Wave 3: $13,500"), "Endless Survival shows its exact first extraction reward");
  assert(html.includes("Last Stand Survivor badge"), "Endless Survival selection names its unique badge");
  assert(html.includes("Create Endless Survival Squad"), "Endless Survival can create its own squad room");

  console.log("PASS: Co-op Home separates Story Campaign and seven playable Special Operations with accurate routing");
}

run().catch((error)=>{
  console.error(error);
  process.exitCode = 1;
});
