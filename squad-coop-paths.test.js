const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const game = fs.readFileSync("game.js", "utf8");

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
  Telegram:{ WebApp:{ initData:"signed-profile", initDataUnsafe:{ user:{ id:77 } } } },
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
  fetch:async()=>({ ok:true, json:async()=>({ ok:true, profile:{ userId:77, unlockedStoryLevel:80 }, gearCatalog:[] }) }),
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
  await new Promise((resolve)=>setImmediate(resolve));
  let html = element("squadBody").innerHTML;
  assert(html.includes("Choose how you want to play"), "Live Squad opens on the two-path home");
  assert(html.includes("Story Campaign"), "Story Campaign path is visible");
  assert(html.includes("Special Operations"), "Special Operations path is visible");
  assert(html.includes("Solo supports all 80 unlocked missions"), "home reports the separate co-op profile unlock count");
  assert(html.includes("Two Player is ready for Missions 1–80"), "home reports the exact converted co-op range");
  assert(game.includes("FLEXIBLE_SHARED_STORY_PILOT_MAX_LEVEL = 80"), "normal Story pre-deploy also enables Two Player through Mission 80");

  await clickCommand("hub-story");
  html = element("squadBody").innerHTML;
  assert(html.includes("Unlocked 80/100"), "Story path uses the co-op campaign profile instead of Solo progress");
  assert(html.includes("Story Mission 80"), "Story path defaults to the current co-op mission");
  assert(html.includes("Chapter 3 • 21–30"), "Story path includes a direct Chapter 3 mission shortcut");
  assert(html.includes("Chapter 4 • 31–40"), "Story path includes a direct Chapter 4 mission shortcut");
  assert(html.includes("Chapter 5 • 41–50"), "Story path includes a direct Chapter 5 mission shortcut");
  assert(html.includes("Chapter 6 • 51–60"), "Story path includes a direct Chapter 6 mission shortcut");
  assert(html.includes("Chapter 7 • 61–70"), "Story path includes a direct Chapter 7 mission shortcut");
  assert(html.includes("Chapter 8 • 71–80"), "Story path includes a direct Chapter 8 mission shortcut");

  await clickCommand("play-solo");
  assert.equal(soloLevel, 80, "Solo choice routes the selected co-op campaign level into normal Story pre-deploy");

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
  assert(html.includes("Research Team Escort"), "Mission 21 exposes its Chapter 3 research escort");
  assert(html.includes("Two Player ready"), "Mission 21 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"23" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Veil Tiger Capture"), "Mission 23 names its specific live-capture target");

  await clickCommand("select-story", { squadStoryLevel:"29" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Helicopter Evacuation"), "Mission 29 exposes its seven-person helicopter evacuation");

  await clickCommand("select-story", { squadStoryLevel:"30" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Stealth Tiger"), "Mission 30 exposes its Stealth Tiger boss objective");

  await clickCommand("select-story", { squadStoryLevel:"31" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Abandoned Home Search"), "Mission 31 exposes its real home-search objective");
  assert(html.includes("Two Player ready"), "Mission 31 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"34" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Triple Research Capture"), "Mission 34 exposes its three-capture objective");

  await clickCommand("select-story", { squadStoryLevel:"37" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Burning Village Rescue"), "Mission 37 exposes its real fire-hazard rescue");

  await clickCommand("select-story", { squadStoryLevel:"40" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Twin Alpha Tigers"), "Mission 40 exposes its Twin Alpha boss objective");

  await clickCommand("select-story", { squadStoryLevel:"41" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Broken Bridge Escort"), "Mission 41 exposes its real broken-bridge escort");
  assert(html.includes("Two Player ready"), "Mission 41 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"43" });
  html = element("squadBody").innerHTML;
  assert(html.includes("River Tiger Capture"), "Mission 43 exposes its named live-capture objective");

  await clickCommand("select-story", { squadStoryLevel:"48" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Rescue Boat Defense"), "Mission 48 exposes its real rescue-boat defense");

  await clickCommand("select-story", { squadStoryLevel:"50" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Giant River Tiger"), "Mission 50 exposes its Giant River Tiger boss objective");

  await clickCommand("select-story", { squadStoryLevel:"51" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Mountain Village Escort"), "Mission 51 exposes its real mountain escort");
  assert(html.includes("Two Player ready"), "Mission 51 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"53" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Silverpeak Capture"), "Mission 53 exposes its named rare-tiger capture");

  await clickCommand("select-story", { squadStoryLevel:"57" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Whiteout Patrol"), "Mission 57 exposes its real snowstorm objective");

  await clickCommand("select-story", { squadStoryLevel:"58" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Mountain Air Rescue"), "Mission 58 exposes its helicopter rescue objective");

  await clickCommand("select-story", { squadStoryLevel:"60" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Mountain Alpha Tiger"), "Mission 60 exposes its Mountain Alpha boss objective");

  await clickCommand("select-story", { squadStoryLevel:"61" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Deep Research Escort"), "Mission 61 exposes its deep-jungle scientist escort");
  assert(html.includes("Two Player ready"), "Mission 61 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"63" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Four-Tiger Research Capture"), "Mission 63 exposes its four required live captures");

  await clickCommand("select-story", { squadStoryLevel:"66" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Temporary Base Defense"), "Mission 66 exposes its real base-defense objective");

  await clickCommand("select-story", { squadStoryLevel:"67" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Night Stalker Ambush"), "Mission 67 exposes its reduced-visibility stealth ambush");

  await clickCommand("select-story", { squadStoryLevel:"70" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Legendary Blood Tiger"), "Mission 70 exposes its Legendary Blood Tiger boss objective");

  await clickCommand("select-story", { squadStoryLevel:"71" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Jungle Center Evacuation"), "Mission 71 exposes its real jungle-center evacuation");
  assert(html.includes("Two Player ready"), "Mission 71 is marked playable with a teammate");

  await clickCommand("select-story", { squadStoryLevel:"72" });
  html = element("squadBody").innerHTML;
  assert(html.includes("All-Directions Rescue Ambush"), "Mission 72 exposes its corrected focused rescue ambush");

  await clickCommand("select-story", { squadStoryLevel:"73" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Elite Hunter Capture"), "Mission 73 exposes both required elite live captures");

  await clickCommand("select-story", { squadStoryLevel:"74" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Dangerous Jungle Caravan"), "Mission 74 exposes its moving caravan route");

  await clickCommand("select-story", { squadStoryLevel:"76" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Lost Soldier Rescue"), "Mission 76 exposes its lost patrol rescue");

  await clickCommand("select-story", { squadStoryLevel:"79" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Tiger King Preparation"), "Mission 79 exposes real preparation objectives");

  await clickCommand("select-story", { squadStoryLevel:"80" });
  html = element("squadBody").innerHTML;
  assert(html.includes("Tiger King"), "Mission 80 exposes its Tiger King boss objective");
  assert(html.includes("Two Player ready"), "Mission 80 is marked playable with a teammate");

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
