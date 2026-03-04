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
  function tutorialTarget(id){
    if(id === "shopBtn") return visibleEl("shopBtn") || visibleEl("navShopBtn");
    if(id === "invBtn") return visibleEl("invBtn") || visibleEl("navInvBtn");
    if(id === "scanBtn") return visibleEl("scanBtn") || visibleEl("touchScanBtn");
    if(id === "engageBtn") return visibleEl("engageBtn") || visibleEl("touchEngageBtn");
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
        title:"Tutorial",
        text:"Welcome to Tiger Strike.\nYou will learn movement, escorting civilians, scanning, locking targets, and basic combat.",
        hint:"Tap Next to begin.",
        arrow:null,
        canNext: () => true
      },
      {
        key:"move",
        title:"Move",
        text:"Step 1: Tap anywhere on the map to move your agent.",
        hint:"Tap the map once.",
        arrow:"cv",
        canNext: () => window.TigerTutorial.mapClicked === true
      },
      {
        key:"escort",
        title:"Escort Civilian",
        text:"Step 2: Move close to the civilian, then guide them into the green evac zone.",
        hint:"Stay near the civilian so they follow you to safety.",
        arrow:"evacZone",
        canNext: () => (getS()?.evacDone || 0) >= 1
      },
      {
        key:"scan",
        title:"Scan",
        text:"Step 3: Press Scan to reveal the tiger.",
        hint:"Tap the Scan button once.",
        arrow:"scanBtn",
        canNext: () => (getS()?.scanPing || 0) > 0
      },
      {
        key:"lock",
        title:"Lock Target",
        text:"Step 4: Tap the tiger on the map to lock onto it.",
        hint:"The lock is working when a blue ring appears around the tiger.",
        arrow:"tiger",
        canNext: () => {
          const S = getS();
          return !!(S && S.lockedTigerId);
        }
      },
      {
        key:"engage",
        title:"Engage",
        text:"Step 5: Move close to the tiger, then tap Engage.",
        hint:"Engage becomes available when you are close enough.",
        arrow:"engageBtn",
        canNext: () => {
          const S = getS();
          return !!(S && S.inBattle === true);
        }
      },
      {
        key:"attack",
        title:"Attack",
        text:"Step 6: Press Attack once to learn the battle flow.",
        hint:"Fire one shot, then tap Next.",
        arrow:"atkBtn",
        canNext: () => (getS()?.stats?.shots || 0) >= 1
      },
      {
        key:"shop",
        title:"Shop",
        text:"Step 7: Open the Shop to buy ammo, gear, armor, and tools.",
        hint:"Tap Shop once.",
        arrow:"shopBtn",
        canNext: () => {
          const el = byId("shopOverlay");
          return !!(el && el.style.display === "flex");
        }
      },
      {
        key:"inventory",
        title:"Inventory",
        text:"Step 8: Open Inventory to review weapons and supplies.",
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
        text:"Step 9: Tutorial complete.\nYou are ready to protect civilians, evacuate survivors, and deal with tigers.",
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

    try{ window.deploy?.(); }catch(e){}
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
    if(step.key === "shop"){
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
