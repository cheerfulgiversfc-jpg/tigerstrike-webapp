// tutorial.js — Tiger Strike Tutorial

(function(){
  const overlay = document.getElementById("tutorialOverlay");
  const titleEl = document.getElementById("tutorialTitle");
  const stepEl = document.getElementById("tutorialStep");
  const textEl = document.getElementById("tutorialText");
  const hintEl = document.getElementById("tutorialHint");
  const nextBtn = document.getElementById("tutorialNext");
  const skipBtn = document.getElementById("tutorialSkip");
  const arrow = document.getElementById("tutorialArrow");

  function byId(id){ return document.getElementById(id); }
  function visibleEl(id){
    const el = byId(id);
    if(!el) return null;
    if(el.getClientRects().length === 0) return null;
    if(window.getComputedStyle(el).display === "none") return null;
    return el;
  }
  function visibleSelector(selector){
    const nodes = document.querySelectorAll(selector);
    for(const el of nodes){
      if(!el) continue;
      if(el.getClientRects().length === 0) continue;
      if(window.getComputedStyle(el).display === "none") continue;
      return el;
    }
    return null;
  }
  function tutorialTarget(id){
    if(id === "shopBtn") return visibleEl("shopBtn") || visibleEl("navShopBtn");
    if(id === "invBtn") return visibleEl("invBtn") || visibleEl("navInvBtn");
    if(id === "scanBtn") return visibleEl("scanBtn") || visibleEl("touchScanBtn");
    if(id === "shieldBtn") return visibleSelector("[data-shield-btn]") || visibleEl("touchShieldBtn");
    if(id === "atkBtn") return visibleEl("atkBtn") || visibleEl("touchAttackBtn") || visibleEl("combatAttackBtn");
    return visibleEl(id);
  }
  function getS(){
    return (typeof window.getGameState === "function") ? window.getGameState() : window.S;
  }
  function getStepList(){
    return [
      {
        key:"intro",
        title:"Story Tutorial",
        text:"Welcome to Tiger Strike Story Mode.\nYou will learn movement, escorting civilians, on-map combat, and your new systems.",
        hint:"Tap Next to begin.",
        arrow:null,
        canNext: () => true
      },
      {
        key:"storyflow",
        title:"Mission Flow",
        text:"Story missions are objective-based:\n1) Keep civilians alive\n2) Escort them to SAFE ZONE\n3) Clear or capture tigers.\nYour Agent + Mission HUD stays above the map.",
        hint:"Tap Next to begin.",
        arrow:"objTxt",
        canNext: () => true
      },
      {
        key:"move",
        title:"Move",
        text:"Tap anywhere on the map to move your agent.",
        hint:"Tap the map once.",
        arrow:"cv",
        canNext: () => window.TigerTutorial.mapClicked === true
      },
      {
        key:"escort",
        title:"Escort Civilian",
        text:"Move close to the civilian, then guide them into the green SAFE ZONE.",
        hint:"Stay near them so they follow you.",
        arrow:"evacZone",
        canNext: () => (getS()?.evacDone || 0) >= 1
      },
      {
        key:"scan",
        title:"Scan",
        text:"Press Scan to locate the tiger.",
        hint:"Tap Scan once.",
        arrow:"scanBtn",
        canNext: () => (getS()?.scanPing || 0) > 0
      },
      {
        key:"lock",
        title:"Lock Target",
        text:"Tap a tiger on the map to lock it.",
        hint:"Blue ring = locked.",
        arrow:"tiger",
        canNext: () => {
          const S = getS();
          return !!(S && S.lockedTigerId);
        }
      },
      {
        key:"engage",
        title:"Engage On Map",
        text:"Move into range and tap that same locked tiger again to engage.",
        hint:"Combat stays on the main map screen.",
        arrow:"tiger",
        canNext: () => {
          const S = getS();
          return !!(S && S.inBattle === true);
        }
      },
      {
        key:"attack",
        title:"Fire Weapon",
        text:"Press Attack once.",
        hint:"Fire one shot to continue.",
        arrow:"atkBtn",
        canNext: () => (getS()?.stats?.shots || 0) >= 1
      },
      {
        key:"capture_rules",
        title:"Capture Rules",
        text:"Capture uses the tranq weapon required for that tiger type.\nCapture is available at 25% HP or lower.",
        hint:"Tap Next.",
        arrow:"tigerTxt",
        canNext: () => true
      },
      {
        key:"interactables",
        title:"Map Interactables",
        text:"Story maps include interactables:\n• Alarm (stagger/reveal)\n• Barricade (block zone)\n• Cache (supplies/cash).",
        hint:"Tap Next.",
        arrow:"cv",
        canNext: () => true
      },
      {
        key:"shield",
        title:"Shield Ability",
        text:"Use Shield to protect yourself and nearby civilians for 5 seconds.",
        hint:"Tap Shield once.",
        arrow:"shieldBtn",
        canNext: () => (getS()?.shieldUntil || 0) > Date.now()
      },
      {
        key:"shop",
        title:"Shop",
        text:"Open Shop. You can buy during a run when needed.",
        hint:"Tap Shop.",
        arrow:"shopBtn",
        canNext: () => {
          const el = byId("shopOverlay");
          return !!(el && el.style.display === "flex");
        }
      },
      {
        key:"squad",
        title:"Squad Specialists",
        text:"Open the Squad tab.\nTiger Specialist + Rescue Specialist unlock at Level 15 and cost $50,000 each.",
        hint:"Tap Squad tab in Shop.",
        arrow:"tabSquad",
        canNext: () => {
          const shop = byId("shopOverlay");
          const tab = byId("tabSquad");
          return !!(shop && tab && shop.style.display === "flex" && tab.classList.contains("active"));
        }
      },
      {
        key:"inventory",
        title:"Inventory",
        text:"Open Inventory to review weapons, ammo, supplies, and squad status.",
        hint:"Tap Inventory once.",
        arrow:"invBtn",
        canNext: () => {
          const el = byId("invOverlay");
          return !!(el && el.style.display === "flex");
        }
      },
      {
        key:"done",
        title:"Done",
        text:"Tutorial complete.\nYou are ready for Story missions.",
        hint:"Tap Finish.",
        arrow:null,
        finish:true,
        canNext: () => true
      }
    ];
  }

  window.TigerTutorial = {
    isRunning:false,
    step:0,
    currentKey:null,
    mapClicked:false,
    lastLockedTigerId:null
  };

  function showArrowAtEl(el){
    if(!el){ arrow.style.display = "none"; return; }
    const r = el.getBoundingClientRect();
    arrow.style.display = "block";
    arrow.style.left = (r.left + r.width / 2) + "px";
    arrow.style.top = (r.top - 18) + "px";
  }

  function showArrowAtCanvasPoint(x, y){
    const cv = byId("cv");
    if(!cv || x == null || y == null){ arrow.style.display = "none"; return; }
    const r = cv.getBoundingClientRect();
    arrow.style.display = "block";
    arrow.style.left = (r.left + (x / cv.width) * r.width) + "px";
    arrow.style.top = (r.top + (y / cv.height) * r.height - 22) + "px";
  }

  function hideArrow(){
    arrow.style.display = "none";
  }

  function open(){
    overlay.style.display = "flex";
  }

  function close(){
    overlay.style.display = "none";
    hideArrow();
    clearInterval(window.__tutTimer);
  }

  function setNextEnabled(on){
    nextBtn.disabled = !on;
  }

  function render(){
    const T = window.TigerTutorial;
    const steps = getStepList();
    const step = steps[T.step];
    const S = getS();

    T.currentKey = step.key;
    titleEl.innerText = step.title;
    stepEl.innerText = `Step ${T.step + 1} / ${steps.length}`;
    textEl.innerText = step.text;
    hintEl.innerText = step.hint || "";
    nextBtn.innerText = step.finish ? "Finish" : "Next";

    if(step.arrow === "cv"){
      showArrowAtEl(byId("cv"));
    } else if(step.arrow === "evacZone"){
      showArrowAtCanvasPoint(S?.evacZone?.x, S?.evacZone?.y);
    } else if(step.arrow === "tiger"){
      const tiger = S?.tigers?.find((t) => t.alive);
      showArrowAtCanvasPoint(tiger?.x, tiger?.y);
    } else if(typeof step.arrow === "string"){
      showArrowAtEl(tutorialTarget(step.arrow));
    } else {
      hideArrow();
    }

    setNextEnabled(!!step.canNext());
    clearInterval(window.__tutTimer);
    window.__tutTimer = setInterval(() => {
      if(!window.TigerTutorial.isRunning) return;
      setNextEnabled(!!step.canNext());
    }, 200);
  }

  function startTutorial(){
    const T = window.TigerTutorial;
    if(T.isRunning) return;

    T.isRunning = true;
    T.step = 0;
    T.currentKey = "intro";
    T.mapClicked = false;
    T.lastLockedTigerId = null;
    try{ window.enterTutorialMode?.(); }catch(e){}

    const S = getS();
    if(S){
      S.paused = false;
      S.pauseReason = null;
    }

    open();
    render();
  }

  function endTutorial(){
    const T = window.TigerTutorial;
    T.isRunning = false;
    T.step = 0;
    T.currentKey = null;
    T.mapClicked = false;
    T.lastLockedTigerId = null;

    try{ window.closeShop?.(); }catch(e){}
    try{ window.closeInventory?.(); }catch(e){}
    try{ window.endBattle?.(); }catch(e){}
    try{ window.exitTutorialMode?.(); }catch(e){}

    close();
    try{ window.toast?.("Tutorial complete ✅"); }catch(e){}
  }

  nextBtn.addEventListener("click", () => {
    const T = window.TigerTutorial;
    if(!T.isRunning) return;

    const steps = getStepList();
    const step = steps[T.step];
    if(!step.canNext()) return;

    if(step.finish){
      endTutorial();
      return;
    }

    if(step.key === "attack"){
      try{ window.endBattle?.(); }catch(e){}
    }
    if(step.key === "squad"){
      try{ window.closeShop?.(); }catch(e){}
    }
    if(step.key === "inventory"){
      try{ window.closeInventory?.(); }catch(e){}
    }

    T.step += 1;
    T.mapClicked = false;
    render();
  });

  skipBtn.addEventListener("click", () => {
    endTutorial();
  });

  window.startTutorial = startTutorial;
})();
