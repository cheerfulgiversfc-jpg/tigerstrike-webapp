// tutorial.js
// Tiger Strike — Guided Tutorial Overlay
// Strict Step Lock + Click-Through + Arrow + REAL move detection + Tutorial Mode hook

(function () {
  const tg = window.Telegram?.WebApp;

  const STORAGE_KEY = "ts_tutorial_v4";
  const state = loadState();

  // ---------------- helpers ----------------
  function $(sel) { return document.querySelector(sel); }
  function safeCall(fn) { try { return fn(); } catch { return undefined; } }
  function haptic(type="light"){
    safeCall(()=> {
      const h = tg?.HapticFeedback;
      if(h?.impactOccurred) h.impactOccurred(type);
      else if(h?.notificationOccurred) h.notificationOccurred("success");
    });
  }
  function loadState(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null") || {
        done:false, stepIndex:0, completed:{}, firstSeenAt:Date.now()
      };
    }catch{
      return { done:false, stepIndex:0, completed:{}, firstSeenAt:Date.now() };
    }
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

  // Game state accessor (optional)
  function getS(){ return window.S || window.__TS_STATE__ || null; }
  function isVisible(sel){
    const n = $(sel); if(!n) return false;
    return getComputedStyle(n).display !== "none";
  }

  // ---------------- Arrow ----------------
  let tutorialArrow = null;

  function ensureArrow(){
    tutorialArrow = document.getElementById("tutorialArrow");
    if(!tutorialArrow){
      tutorialArrow = document.createElement("div");
      tutorialArrow.id = "tutorialArrow";
      tutorialArrow.textContent = "👇";
      document.body.appendChild(tutorialArrow);
    }
  }
  function showArrowAt(selector){
    ensureArrow();
    const el = document.querySelector(selector);
    if(!el || !tutorialArrow) return;
    const r = el.getBoundingClientRect();
    tutorialArrow.style.left = (r.left + r.width/2) + "px";
    tutorialArrow.style.top  = (r.top - 18) + "px";
    tutorialArrow.style.display = "block";
  }
  function hideArrow(){ if(tutorialArrow) tutorialArrow.style.display="none"; }

  // ---------------- Step flags (UI-based) ----------------
  const doneByUI = {
    moveConfirmed:false,
    scanPressed:false,
    engagePressed:false,
    shopOpened:false,
    invOpened:false,
  };

  // ✅ “REAL MOVE” detector: only mark move complete if the game actually sets a target OR player position changes.
  let moveProbe = { started:false, x:0, y:0 };

  function beginMoveProbe(){
    const S = getS();
    moveProbe.started = true;
    moveProbe.x = S?.me?.x ?? null;
    moveProbe.y = S?.me?.y ?? null;
  }

  function confirmMoveIfHappened(){
    const S = getS();

    // If game sets a target/destination, count as moved:
    if (S && (S.target || S.moveTarget || S.dest || S.goto)) {
      doneByUI.moveConfirmed = true;
      return true;
    }

    // If player actually changed position, count as moved:
    if (S && S.me && moveProbe.started && moveProbe.x != null && moveProbe.y != null) {
      const dx = Math.abs((S.me.x ?? 0) - moveProbe.x);
      const dy = Math.abs((S.me.y ?? 0) - moveProbe.y);
      if (dx > 2 || dy > 2) {
        doneByUI.moveConfirmed = true;
        return true;
      }
    }

    return false;
  }

  // ---------------- Steps ----------------
  const steps = [
    { id:"welcome", title:"Welcome",
      text:
        "This quick tutorial will show you the basics:\n" +
        "• Tap to move\n• Scan to locate a tiger\n• Engage to battle\n\n" +
        "Tip: You can Shop or Inventory anytime outside battle.",
      hint:"Press NEXT to begin.",
      lock:false
    },

    { id:"move", title:"Move",
      text:"Tap anywhere on the map to set a destination.\nYour soldier will move there and spend stamina.",
      hint:"Tap on the map now.",
      lock:true,
      watch:()=> doneByUI.moveConfirmed || confirmMoveIfHappened()
    },

    { id:"scan", title:"Scan",
      text:"Press SCAN to ping the nearest/locked tiger.\nScan costs stamina, but helps you locate threats.",
      hint:"Press SCAN once.",
      lock:true,
      watch:()=> doneByUI.scanPressed || ((getS()?.scanPing||0)>0) || !!getS()?.achievements?.scan1
    },

    { id:"engage", title:"Engage (Battle)",
      text:"Move close to the tiger, then press ENGAGE to enter battle.",
      hint:"Get near the tiger and press ENGAGE.",
      lock:true,
      watch:()=> doneByUI.engagePressed || isVisible("#battleOverlay") || !!getS()?.inBattle
    },

    { id:"shop", title:"Shop / Inventory",
      text:"Open Shop or Inventory once.",
      hint:"Tap Shop or Inventory.",
      lock:true,
      watch:()=> doneByUI.shopOpened || doneByUI.invOpened || isVisible("#shopOverlay") || isVisible("#invOverlay")
    },

    { id:"done", title:"You’re Ready",
      text:"That’s it!\n\nGood luck out there.",
      hint:"Press FINISH to close tutorial.",
      lock:false
    }
  ];

  // ---------------- UI refs ----------------
  const ui = {
    overlay: $("#tutorialOverlay"),
    title: $("#tutorialTitle"),
    text: $("#tutorialText"),
    step: $("#tutorialStep"),
    hint: $("#tutorialHint"),
    next: $("#tutorialNext"),
    skip: $("#tutorialSkip"),
  };

  if(!ui.overlay || !ui.title || !ui.text || !ui.step || !ui.hint || !ui.next || !ui.skip){
    console.warn("Tutorial UI not found. Make sure index.html has #tutorialOverlay structure.");
    return;
  }

  // ---------------- Detectors ----------------
  // Canvas tap: start move probe and let the game handle movement
  const cv = document.getElementById("cv");
  if(cv){
    cv.addEventListener("pointerdown", () => {
      const st = steps[state.stepIndex];
      if(st?.id === "move"){
        beginMoveProbe();
        // give the game a moment to set target/position
        setTimeout(() => {
          confirmMoveIfHappened();
          syncNextButtonLock();
        }, 120);
      }
    }, { passive:true });
  }

  // Button taps
  const scanBtn = document.getElementById("scanBtn");
  if(scanBtn){
    scanBtn.addEventListener("click", () => {
      if(steps[state.stepIndex]?.id === "scan") doneByUI.scanPressed = true;
      syncNextButtonLock();
    });
  }

  const engageBtn = document.getElementById("engageBtn");
  if(engageBtn){
    engageBtn.addEventListener("click", () => {
      if(steps[state.stepIndex]?.id === "engage") doneByUI.engagePressed = true;
      syncNextButtonLock();
    });
  }

  const shopBtn = document.getElementById("shopBtn");
  if(shopBtn) shopBtn.addEventListener("click", () => { doneByUI.shopOpened = true; syncNextButtonLock(); });

  const invBtn = document.getElementById("invBtn");
  if(invBtn) invBtn.addEventListener("click", () => { doneByUI.invOpened = true; syncNextButtonLock(); });

  // Skip
  ui.skip.onclick = () => { haptic("medium"); finishTutorial(true); };

  // ---------------- Public API ----------------
  window.TigerTutorial = {
    start: () => {
      // Reset tutorial flags
      doneByUI.moveConfirmed = false;
      doneByUI.scanPressed = false;
      doneByUI.engagePressed = false;
      doneByUI.shopOpened = false;
      doneByUI.invOpened = false;
      moveProbe = { started:false, x:0, y:0 };

      // Force tutorial mode in game (YOU add this in game.js below)
      safeCall(() => window.enterTutorialMode?.());

      state.done = false;
      state.stepIndex = 0;
      state.completed = {};
      saveState();
      showTutorial(false);
    },
    reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); },
    skip: () => finishTutorial(true),
    state
  };

  window.startTutorial = function(){ window.TigerTutorial?.start?.(); };

  // Optional auto-start (comment this out if you don't want it to pop up automatically)
  // if(!state.done){ setTimeout(() => showTutorial(true), 600); }

  // ---------------- Watcher ----------------
  let watcher = null;

  function startWatcher(){
    stopWatcher();
    watcher = setInterval(() => {
      if(ui.overlay.style.display !== "flex") return;

      const st = steps[state.stepIndex];
      if(!st) return;

      // Arrow logic
      hideArrow();
      if(st.id === "scan")   showArrowAt("#scanBtn");
      if(st.id === "engage") showArrowAt("#engageBtn");
      if(st.id === "shop")   showArrowAt("#shopBtn");

      if(st.watch && st.watch()){
        state.completed[st.id] = true;
        saveState();
        nextStep(false);
      }else{
        syncNextButtonLock();
      }
    }, 250);
  }

  function stopWatcher(){
    if(watcher) clearInterval(watcher);
    watcher = null;
  }

  // ---------------- Core UI ----------------
  function showTutorial(firstAuto){
    safeCall(() => window.setPaused?.(false, null));
    ui.overlay.style.display = "flex";
    render();
    startWatcher();
    if(firstAuto) haptic("light");
  }

  function hideTutorial(){
    ui.overlay.style.display = "none";
    stopWatcher();
    hideArrow();
    safeCall(() => window.setPaused?.(false, null));
  }

  function nextStep(fromButton){
    const prev = steps[state.stepIndex];
    if(fromButton && prev?.id) state.completed[prev.id] = true;

    state.stepIndex = Math.min(state.stepIndex + 1, steps.length - 1);
    saveState();
    render();
  }

  function finishTutorial(bySkip){
    state.done = true;
    saveState();
    hideTutorial();
    safeCall(() => window.exitTutorialMode?.());
    safeCall(() => window.toast?.(bySkip ? "Tutorial skipped." : "Tutorial complete!"));
  }

  function render(){
    const st = steps[state.stepIndex];
    ui.title.textContent = st.title;
    ui.text.textContent  = st.text;
    ui.hint.textContent  = st.hint || "";
    ui.step.textContent  = `Step ${state.stepIndex + 1} / ${steps.length}`;

    hideArrow();
    if(st.id === "scan")   showArrowAt("#scanBtn");
    if(st.id === "engage") showArrowAt("#engageBtn");
    if(st.id === "shop")   showArrowAt("#shopBtn");

    ui.next.onclick = () => {
      haptic("light");
      if(st.id === "done") return finishTutorial(false);
      if(st.watch && st.lock !== false && !st.watch()){
        safeCall(() => window.toast?.("Complete the step first."));
        return;
      }
      nextStep(true);
    };

    syncNextButtonLock();
  }

  function syncNextButtonLock(){
    const st = steps[state.stepIndex];

    if(st.id === "done"){
      ui.next.textContent = "FINISH";
      ui.next.disabled = false;
      return;
    }

    if(st.watch && st.lock !== false){
      const ok = !!st.watch();
      ui.next.textContent = ok ? "NEXT" : "LOCKED";
      ui.next.disabled = !ok;
      return;
    }

    ui.next.textContent = "NEXT";
    ui.next.disabled = false;
  }
})();
