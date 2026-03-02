// tutorial.js — Tiger Strike Tutorial (11 steps, no sprint)

(function(){
  const overlay = document.getElementById("tutorialOverlay");
  const card    = document.getElementById("tutorialCard");
  const titleEl = document.getElementById("tutorialTitle");
  const stepEl  = document.getElementById("tutorialStep");
  const textEl  = document.getElementById("tutorialText");
  const hintEl  = document.getElementById("tutorialHint");
  const nextBtn = document.getElementById("tutorialNext");
  const skipBtn = document.getElementById("tutorialSkip");
  const arrow   = document.getElementById("tutorialArrow");

  // IDs in index.html you already have:
  // shopBtn, invBtn, tutorialBtn
  // plus in action strip: scanBtn, engageBtn

  function byId(id){ return document.getElementById(id); }

  // Exposed object so game.js can detect it
  window.TigerTutorial = {
    isRunning:false,
    step:0,
    mapClicked:false,
    lastLockedTigerId:null
  };

  function showArrowAtEl(el){
    if(!el){ arrow.style.display="none"; return; }
    const r = el.getBoundingClientRect();
    arrow.style.display="block";
    arrow.style.left = (r.left + r.width/2) + "px";
    arrow.style.top  = (r.top  - 18) + "px";
  }

  function hideArrow(){ arrow.style.display="none"; }

  function open(){
    overlay.style.display="flex";
    // IMPORTANT: your CSS overlay has pointer-events:none (click-through)
    // That’s OK — the card itself is clickable.
  }

  function close(){
    overlay.style.display="none";
    hideArrow();
  }

  function setNextEnabled(on){
    nextBtn.disabled = !on;
  }

  function getS(){
    // Use your live state
    return (typeof window.getGameState === "function") ? window.getGameState() : window.S;
  }

  function safeToast(msg){
    try{ window.toast?.(msg); }catch(e){}
  }

  function startTutorial(){
    const T = window.TigerTutorial;
    if(T.isRunning) return;

    T.isRunning = true;
    T.step = 0;
    T.mapClicked = false;
    T.lastLockedTigerId = null;

    // Reset the game clean then force tutorial spawns
    try{ window.deploy?.(); }catch(e){}
    try{ window.enterTutorialMode?.(); }catch(e){}

    // Make sure the game is NOT paused so buttons are not greyed out
    // (we freeze simulation in game.js draw() instead)
    try{
      const S = getS();
      if(S){ S.paused = false; S.pauseReason = null; }
    }catch(e){}

    open();
    render();
  }

  function endTutorial(){
    const T = window.TigerTutorial;
    T.isRunning = false;
    T.step = 0;
    T.mapClicked = false;
    T.lastLockedTigerId = null;

    try{ window.exitTutorialMode?.(); }catch(e){}
    close();
    safeToast("Tutorial complete ✅");
  }

  function stepData(){
    // 11 steps (no sprint)
    return [
      {
        title:"Tutorial",
        text:"Welcome to Tiger Strike.\nThis tutorial will guide you through the basics.",
        hint:"Tap Next to begin.",
        arrow:null,
        canNext: () => true
      },
      {
        title:"Move",
        text:"Step 1: Tap anywhere on the MAP to move.",
        hint:"Tap the map once.",
        arrow:"cv",
        canNext: () => window.TigerTutorial.mapClicked === true
      },
      {
        title:"Scan",
        text:"Step 2: Press 🛰️ Scan to locate a tiger.",
        hint:"Tap the Scan button.",
        arrow:"scanBtn",
        canNext: () => (getS()?.scanPing || 0) > 0
      },
      {
        title:"Lock Target",
        text:"Step 3: Tap the tiger on the map to LOCK it.",
        hint:"You should see a blue circle around the tiger.",
        arrow:"cv",
        canNext: () => {
          const S = getS();
          return !!(S && S.lockedTigerId);
        }
      },
      {
        title:"Engage",
        text:"Step 4: Move close to the tiger, then press 🎯 Engage.",
        hint:"Engage activates when you’re close enough.",
        arrow:"engageBtn",
        canNext: () => {
          const S = getS();
          return !!(S && S.inBattle === true);
        }
      },
      {
        title:"Weapon Select",
        text:"Step 5: You can switch weapons here anytime.",
        hint:"Tap Next to continue.",
        arrow:null,
        canNext: () => true
      },
      {
        title:"Attack",
        text:"Step 6: Press Attack to damage the tiger.",
        hint:"Attack at least once.",
        arrow:"atkBtn",
        canNext: () => {
          const S = getS();
          return (S?.stats?.shots || 0) >= 1;
        }
      },
      {
        title:"Capture / Kill",
        text:"Step 7: When tiger HP is low (≤15), you can Capture or Kill.",
        hint:"Tap Next (no need to finish the tiger in tutorial).",
        arrow:null,
        canNext: () => true
      },
      {
        title:"Shop",
        text:"Step 8: Open the 🛒 Shop to buy weapons, ammo, armor, medkits, traps.",
        hint:"Tap Shop once.",
        arrow:"shopBtn",
        canNext: () => {
          const el = byId("shopOverlay");
          return el && el.style.display === "flex";
        }
      },
      {
        title:"Inventory",
        text:"Step 9: Open 🎒 Inventory to equip weapons and use supplies.",
        hint:"Tap Inventory once.",
        arrow:"invBtn",
        canNext: () => {
          const el = byId("invOverlay");
          return el && el.style.display === "flex";
        }
      },
      {
        title:"Done",
        text:"Step 10: Tutorial is complete.\nYou will return to normal gameplay.",
        hint:"Tap Finish.",
        arrow:null,
        finish:true,
        canNext: () => true
      }
    ];
  }

  function render(){
    const T = window.TigerTutorial;
    const steps = stepData();
    const s = steps[T.step];

    titleEl.innerText = s.title;
    stepEl.innerText  = `Step ${T.step+1} / ${steps.length}`;
    textEl.innerText  = s.text;
    hintEl.innerText  = s.hint || "";

    // arrow targeting
    if(s.arrow === "cv"){
      const el = document.getElementById("cv");
      showArrowAtEl(el);
    } else if(typeof s.arrow === "string"){
      showArrowAtEl(byId(s.arrow));
    } else {
      hideArrow();
    }

    // next button label
    nextBtn.innerText = s.finish ? "Finish" : "Next";

    // determine if next is allowed
    setNextEnabled(!!s.canNext());

    // keep re-checking while this step is active
    clearInterval(window.__tutTimer);
    window.__tutTimer = setInterval(() => {
      if(!window.TigerTutorial.isRunning) return;
      setNextEnabled(!!s.canNext());
    }, 250);
  }

  nextBtn.addEventListener("click", () => {
    const T = window.TigerTutorial;
    if(!T.isRunning) return;

    const steps = stepData();
    const s = steps[T.step];

    if(!s.canNext()) return;

    if(s.finish){
      endTutorial();
      return;
    }

    T.step++;
    T.mapClicked = false;
    render();
  });

  skipBtn.addEventListener("click", () => {
    endTutorial();
  });

  // Expose startTutorial for index.html button
  window.startTutorial = startTutorial;

})();
