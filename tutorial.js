// tutorial.js — Tiger Strike Tutorial

(function(){
  const overlay = document.getElementById("tutorialOverlay");
  const titleEl = document.getElementById("tutorialTitle");
  const stepEl = document.getElementById("tutorialStep");
  const textEl = document.getElementById("tutorialText");
  const hintEl = document.getElementById("tutorialHint");
  const cardEl = document.getElementById("tutorialCard");
  const nextBtn = document.getElementById("tutorialNext");
  const skipBtn = document.getElementById("tutorialSkip");
  const arrow = document.getElementById("tutorialArrow");
  let highlightedEl = null;

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
    if(id === "sprintBtn") return visibleEl("touchSprintBtn");
    if(id === "shieldBtn") return visibleSelector("[data-shield-btn]") || visibleEl("touchShieldBtn");
    if(id === "atkBtn") return visibleEl("atkBtn") || visibleEl("touchAttackBtn") || visibleEl("combatAttackBtn");
    if(id === "weaponBtn") return visibleEl("touchNextWeaponBtn") || visibleEl("combatNextWeaponBtn");
    if(id === "squadCmdBtn") return visibleEl("squadCmdBtn") || visibleEl("squadCmdBtnMobile") || visibleEl("touchSquadWheelBtn");
    if(id === "squadFormBtn") return visibleEl("squadFormBtn") || visibleEl("squadFormBtnMobile");
    return visibleEl(id);
  }
  function getS(){
    return (typeof window.getGameState === "function") ? window.getGameState() : window.S;
  }
  function getTutorialConfig(){
    try{
      if(typeof window.getTutorialConfig === "function") return window.getTutorialConfig() || {};
    }catch(e){}
    return {};
  }
  function pickTutorialTiger(S){
    if(!S || !Array.isArray(S.tigers)) return null;
    const byId = (id) => S.tigers.find((t)=>t && t.alive && t.id === id) || null;
    const active = byId(Number(S.activeTigerId || 0));
    if(active) return active;
    const locked = byId(Number(S.lockedTigerId || 0));
    if(locked) return locked;
    const alive = S.tigers.filter((t)=>t && t.alive && t.hpMax > 0);
    if(!alive.length) return null;
    alive.sort((a,b)=>((a.hp/a.hpMax) - (b.hp/b.hpMax)));
    return alive[0] || null;
  }
  function parseHudCaptureState(){
    const cfg = getTutorialConfig();
    const defaultCap = Math.max(1, Number(cfg.capturePct || 25));
    const capTxt = byId("capturePctTxt")?.innerText || `${defaultCap}%`;
    const cap = capTxt.match(/(\d+)/);
    const capPct = Number(cap?.[1] || defaultCap);

    const S = getS();
    const tiger = pickTutorialTiger(S);
    if(tiger && tiger.hpMax > 0){
      const hp = Number(tiger.hp || 0);
      const hpMax = Number(tiger.hpMax || 0);
      const ready = hp <= Math.ceil(hpMax * (capPct / 100));
      return { hp, hpMax, capPct, ready };
    }

    const tigerTxt = byId("tigerTxt")?.innerText || "";
    const m = tigerTxt.match(/(\d+)\s*\/\s*(\d+)/);
    if(!m) return null;
    const hp = Number(m[1] || 0);
    const hpMax = Number(m[2] || 0);
    if(!(hpMax > 0)) return null;
    const ready = hp <= Math.ceil(hpMax * (capPct / 100));
    return { hp, hpMax, capPct, ready };
  }
  function captureReadyFromUi(){
    try{
      if(typeof window.tutorialAnyCaptureWindowReady === "function" && window.tutorialAnyCaptureWindowReady()) return true;
      if(typeof window.tutorialCaptureWindowReady === "function" && window.tutorialCaptureWindowReady()) return true;
    }catch(e){}
    const hudState = parseHudCaptureState();
    if(hudState?.ready) return true;
    const capButtons = ["capBtn", "combatCaptureBtn", "touchCaptureBtn"];
    for(const id of capButtons){
      const el = byId(id);
      if(!el) continue;
      if(el.getClientRects().length === 0) continue;
      if(window.getComputedStyle(el).display === "none") continue;
      if(!el.disabled) return true;
    }
    return false;
  }
  function updateWeakenTigerHint(){
    const hudState = parseHudCaptureState();
    if(hudState){
      const pct = Math.max(0, Math.round((hudState.hp / hudState.hpMax) * 100));
      hintEl.innerText = `Current tiger HP: ${Math.round(hudState.hp)}/${Math.round(hudState.hpMax)} (${pct}%). Get to ${hudState.capPct}% or lower.`;
      return;
    }
    hintEl.innerText = "Stay in battle and lower a tiger to capture range.";
  }
  function updateProgressFlags(){
    const T = window.TigerTutorial;
    if(!T?.isRunning) return;
    const S = getS();

    if(S){
      if(Number.isFinite(T.startX) && Number.isFinite(T.startY) && Number.isFinite(S?.me?.x) && Number.isFinite(S?.me?.y)){
        const dx = Number(S.me.x) - Number(T.startX);
        const dy = Number(S.me.y) - Number(T.startY);
        if(Math.hypot(dx, dy) >= 36) T.movedOnce = true;
      }
      if(S.inBattle) T.engagedOnce = true;
      const shots = Number(S.stats?.shots || 0);
      if(shots > (T.baseShots || 0)) T.attackedOnce = true;
      if(Number(S.scanPing || 0) > 0) T.scanUsed = true;
      if(Number(S.lockedTigerId || 0) > 0) T.lockedOnce = true;
      if(Number(T.lastLockedTigerId || 0) > 0) T.lockedOnce = true;
      const activeTigerId = Number(S.activeTigerId || 0);
      const tiger = activeTigerId > 0 ? (S.tigers || []).find((it)=>it && it.id === activeTigerId && it.alive) : null;
      if(!T.captureWindowReached){
        let ready = false;
        try{
          ready = captureReadyFromUi();
        }catch(e){}
        if(!ready && Array.isArray(S?.tigers)){
          const capPct = parseHudCaptureState()?.capPct || Math.max(1, Number(getTutorialConfig().capturePct || 25));
          ready = S.tigers.some((it)=>it && it.alive && it.hpMax > 0 && Number(it.hp || 0) <= Math.ceil(Number(it.hpMax || 0) * (capPct / 100)));
        }
        if(!ready && tiger && tiger.hpMax > 0 && (tiger.hp / tiger.hpMax) <= 0.28){
          // Fallback tolerance to avoid step-lock from rounding/cross-frame timing.
          ready = true;
        }
        if(ready) T.captureWindowReached = true;
      }
      const shieldUntil = Number(S.shieldUntil || 0);
      if(shieldUntil > Date.now() && shieldUntil > (T.lastShieldUntil || 0)) T.shieldUsed = true;
      T.lastShieldUntil = shieldUntil;

      // Any interactable activation should count (alarm, barricade, cache).
      if(Array.isArray(S.mapInteractables)){
        for(const it of S.mapInteractables){
          if(!it || !it.id) continue;
          const key = String(it.id);
          const baseline = T.baseInteractables?.[key] || {};
          const curUses = Number.isFinite(Number(it.uses)) ? Number(it.uses) : null;
          const baseUses = Number.isFinite(Number(baseline.uses)) ? Number(baseline.uses) : null;
          const curCd = Number(it.cooldownUntil || 0);
          const baseCd = Number(baseline.cooldownUntil || 0);
          const curActive = Number(it.activeUntil || 0);
          const baseActive = Number(baseline.activeUntil || 0);
          if((baseUses != null && curUses != null && curUses < baseUses) || curCd > baseCd || curActive > baseActive){
            T.interactableUsed = true;
            break;
          }
        }
      }
    }

    const shop = byId("shopOverlay");
    if(shop && shop.style.display === "flex") T.shopOpened = true;
    const squadTab = byId("tabSquad");
    if(T.shopOpened && squadTab && squadTab.classList.contains("active")) T.squadOpened = true;
    const inv = byId("invOverlay");
    if(inv && inv.style.display === "flex") T.inventoryOpened = true;
    if(T.inventoryOpened && byId("invTabCosmetics")?.classList.contains("active")) T.cosmeticsOpened = true;
  }
  function setCardPlacement(step){
    if(!cardEl) return;
    const key = (typeof step === "string") ? step : (step?.key || "");
    const mobile = !!window.matchMedia?.("(max-width:760px)")?.matches;
    const baseTop = mobile ? 12 : 70;
    const margin = mobile ? 8 : 12;
    const maxH = key === "squad"
      ? (mobile ? "min(34vh, 280px)" : "min(36vh, 300px)")
      : (mobile ? "min(42vh, 340px)" : "min(44vh, 360px)");

    cardEl.style.left = "50%";
    cardEl.style.transform = "translateX(-50%)";
    cardEl.style.maxHeight = maxH;
    cardEl.style.bottom = "auto";
    cardEl.style.top = `${baseTop}px`;

    // Keep the tutorial card away from whichever visible control the player must tap.
    const target = typeof step?.arrow === "string" && !["cv","evacZone","tiger"].includes(step.arrow)
      ? tutorialTarget(step.arrow)
      : null;
    if(!target) return;

    const priorVisibility = cardEl.style.visibility;
    const priorTop = cardEl.style.top;
    const priorBottom = cardEl.style.bottom;
    cardEl.style.visibility = "hidden";
    cardEl.style.top = `${baseTop}px`;
    cardEl.style.bottom = "auto";
    const measured = cardEl.getBoundingClientRect();
    const cardH = Math.max(180, measured.height || (mobile ? 240 : 260));
    cardEl.style.visibility = priorVisibility;
    cardEl.style.top = priorTop;
    cardEl.style.bottom = priorBottom;

    const vpH = window.innerHeight || document.documentElement.clientHeight || 800;
    const minTop = margin;
    const maxTop = Math.max(minTop, vpH - cardH - margin);
    const tr = target.getBoundingClientRect();
    const aboveTop = Math.round(tr.top - cardH - margin);
    const belowTop = Math.round(tr.bottom + margin);
    const canAbove = aboveTop >= minTop;
    const canBelow = belowTop <= maxTop;
    let top = baseTop;

    if(canAbove && canBelow){
      const roomAbove = tr.top;
      const roomBelow = vpH - tr.bottom;
      top = roomBelow >= roomAbove ? belowTop : aboveTop;
    } else if(canBelow){
      top = belowTop;
    } else if(canAbove){
      top = aboveTop;
    } else {
      top = Math.round(Math.max(minTop, Math.min(maxTop, baseTop)));
    }

    top = Math.round(Math.max(minTop, Math.min(maxTop, top)));
    cardEl.style.top = `${top}px`;
    cardEl.style.bottom = "auto";

    // Final overlap guard for very small screens.
    const cardRect = cardEl.getBoundingClientRect();
    const overlaps = !(cardRect.right < tr.left || cardRect.left > tr.right || cardRect.bottom < tr.top || cardRect.top > tr.bottom);
    if(overlaps){
      const nudgeUp = Math.max(minTop, Math.round(tr.top - cardH - margin));
      const nudgeDown = Math.min(maxTop, Math.round(tr.bottom + margin));
      cardEl.style.top = `${(tr.top > vpH * 0.5 ? nudgeUp : nudgeDown)}px`;
    }
  }
  function getStepList(){
    const cfg = getTutorialConfig();
    const capturePct = Math.max(1, Number(cfg.capturePct || 25));
    const shieldDurationSec = Math.max(1, Number(cfg.shieldDurationSec || 5));
    const shieldCooldownSec = Math.max(1, Number(cfg.shieldCooldownSec || 12));
    const squadUnlockLevel = Math.max(1, Number(cfg.squadUnlockLevel || 15));
    const squadUnitPrice = Math.max(1, Number(cfg.squadUnitPrice || 50000));
    const squadBundlePrice = Math.max(1, Number(cfg.squadBundlePrice || 80000));
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
        hint:"Move your agent a short distance.",
        arrow:"cv",
        canNext: () => window.TigerTutorial.movedOnce === true
      },
      {
        key:"sprint",
        title:"Sprint + Stamina",
        text:"Sprint helps you reach civilians, clues, and extraction vehicles quickly. Sprint consumes stamina and then enters cooldown.",
        hint:"Tap Sprint once.",
        arrow:"sprintBtn",
        canNext: () => window.TigerTutorial.sprintUsed === true
      },
      {
        key:"escort",
        title:"Escort Civilian",
        text:"Move close to the civilian, then guide them into the green SAFE ZONE. Rescued civilians remain protected there while you finish the mission.",
        hint:"Stay near the civilian so they follow you into safety.",
        arrow:"evacZone",
        canNext: () => {
          const S = getS();
          if((S?.evacDone || 0) >= 1) return true;
          if(!S?.evacZone || !Array.isArray(S?.civilians)) return false;
          const ez = S.evacZone;
          const outer = (ez.r || 70) + 42;
          return S.civilians.some((c)=>c && c.alive && !c.evac && dist(c.x, c.y, ez.x, ez.y) <= outer);
        }
      },
      {
        key:"scan",
        title:"Scan",
        text:"Press Scan to locate and lock the nearest tiger. Scan creates a blue guidance line that leads from your agent to the target.",
        hint:"Tap Scan once, then follow the blue line.",
        arrow:"scanBtn",
        canNext: () => window.TigerTutorial.scanUsed === true
      },
      {
        key:"lock",
        title:"Lock Target",
        text:"Tap a tiger on the map to lock it.",
        hint:"Blue ring = locked.",
        arrow:"tiger",
        canNext: () => {
          const T = window.TigerTutorial;
          return !!T?.lockedOnce;
        }
      },
      {
        key:"engage",
        title:"Engage On Map",
        text:"Tap the locked tiger again. If you are out of range, the agent will move toward it while the blue line and lock remain active. Tap it again when close enough to engage.",
        hint:"If you tap elsewhere by mistake, tap the highlighted tiger again.",
        arrow:"tiger",
        canNext: () => {
          const S = getS();
          const T = window.TigerTutorial;
          return !!((S && S.inBattle === true) || T?.engagedOnce);
        }
      },
      {
        key:"weaken_tiger",
        title:"Weaken Tiger",
        text:`Attack until the tiger is at ${capturePct}% HP or lower.`,
        hint:"Keep attacking until the tiger health bar reaches capture range.",
        arrow:"atkBtn",
        canNext: () => {
          const T = window.TigerTutorial;
          const S = getS();
          const activeTigerId = Number(S?.activeTigerId || 0);
          const tiger = activeTigerId > 0 ? (S?.tigers || []).find((it)=>it && it.id === activeTigerId && it.alive) : null;
          const hpWindowReady = !!(tiger && tiger.hpMax > 0 && (tiger.hp / tiger.hpMax) <= 0.34);
          return !!(T?.captureWindowReached || captureReadyFromUi() || hpWindowReady || T?.combatOutcome);
        }
      },
      {
        key:"weapon_switch",
        title:"Weapons + Ammo",
        text:"Different weapons use different ammo families and ranges. Your chosen weapon stays equipped until you change it. During combat, use the weapon arrows to switch.",
        hint:"Tap the next-weapon arrow once.",
        arrow:"weaponBtn",
        canNext: () => window.TigerTutorial.weaponSwitched === true
      },
      {
        key:"resolve_tiger",
        title:"Capture Or Kill",
        text:`Now finish the fight.\nCapture: available at ${capturePct}% HP or lower and preserves the tiger for research.\nKill: faster clear, but raises aggression. Capture highlights when it is ready.`,
        hint:"Capture or kill this tiger to continue.",
        arrow:"tiger",
        canNext: () => {
          const outcome = window.TigerTutorial.combatOutcome;
          return outcome === "CAPTURE" || outcome === "KILL";
        }
      },
      {
        key:"interactables",
        title:"Map Interactables",
        text:"Story maps include interactables:\n• Alarm: reveals nearby tigers and briefly staggers them\n• Barricade: creates a temporary block zone\n• Cache: gives cash + ammo.",
        hint:"Use any one interactable once (Alarm, Barricade, or Cache).",
        arrow:"cv",
        canNext: () => window.TigerTutorial.interactableUsed === true
      },
      {
        key:"shield",
        title:"Shield Ability",
        text:`Use Shield to protect yourself and nearby civilians for ${shieldDurationSec} seconds. Repeated shields and traps receive longer anti-spam cooldowns.`,
        hint:"Tap Shield once.",
        arrow:"shieldBtn",
        canNext: () => window.TigerTutorial.shieldUsed === true
      },
      {
        key:"squad_command",
        title:"Squad Commands",
        text:"Owned specialists obey Auto, Attack Target, Rescue, Regroup, and Hold commands. Commands never create a soldier you do not own.",
        hint:"Open the squad command wheel/menu and choose a different command.",
        arrow:"squadCmdBtn",
        canNext: () => window.TigerTutorial.squadCommandUsed === true
      },
      {
        key:"squad_formation",
        title:"Squad Formations",
        text:"Formations change how specialists move and protect the team. Wedge attacks forward, Line controls space, Split Escort protects civilians, and Flank pressures tigers.",
        hint:"Cycle the squad formation once.",
        arrow:"squadFormBtn",
        canNext: () => window.TigerTutorial.squadFormationUsed === true
      },
      {
        key:"shop",
        title:"Shop",
        text:"Open Shop to buy weapons, stronger ammo, supplies, traps, bundles, specialists, and long-term upgrades. Shop filters help find mission-ready gear.",
        hint:"Tap Shop.",
        arrow:"shopBtn",
        canNext: () => {
          if(window.TigerTutorial.shopOpened) return true;
          const el = byId("shopOverlay");
          return !!(el && el.style.display === "flex");
        }
      },
      {
        key:"squad",
        title:"Squad Specialists",
        text:`Open the Squad tab.\nTiger Specialist + Rescue Specialist unlock at Mission ${squadUnlockLevel}. Specialists must be purchased and revived; they do not respawn for free.`,
        hint:"Tap Squad tab in Shop.",
        arrow:"tabSquad",
        canNext: () => {
          if(window.TigerTutorial.squadOpened) return true;
          const shop = byId("shopOverlay");
          const tab = byId("tabSquad");
          return !!(shop && tab && shop.style.display === "flex" && tab.classList.contains("active"));
        }
      },
      {
        key:"inventory",
        title:"Inventory",
        text:"Open Inventory to claim and equip gear, review operations, manage settlements, cosmetics, and your prestige showcase.",
        hint:"Tap Inventory once.",
        arrow:"invBtn",
        canNext: () => {
          if(window.TigerTutorial.inventoryOpened) return true;
          const el = byId("invOverlay");
          return !!(el && el.style.display === "flex");
        }
      },
      {
        key:"cosmetics",
        title:"Cosmetics + Showcase",
        text:"Cosmetics change appearance without changing combat balance. Showcase displays achievements, titles, trophies, and captured Nemesis records.",
        hint:"Open the Cosmetics tab in Inventory.",
        arrow:"invTabCosmetics",
        canNext: () => window.TigerTutorial.cosmeticsOpened === true
      },
      {
        key:"investigation",
        title:"Tracking + Investigation",
        text:"Some missions begin before combat. Scan footprints, fur, blood trails, scratches, sounds, and damaged objects to reveal tiger direction, health, behavior, hidden dens, or missing civilians.",
        hint:"Weather can erase clues, so investigate early. Tap Next.",
        arrow:"scanBtn",
        canNext: () => true
      },
      {
        key:"live_world",
        title:"Living Missions",
        text:"Watch the LIVE panel and the map. Weather, tiger packs, rivals, helicopter crashes, flooded routes, convoy ambushes, interactive gates, generators, bridges, and vehicles have real gameplay effects.",
        hint:"React to what visibly happens on the map. Tap Next.",
        arrow:"objTxt",
        canNext: () => true
      },
      {
        key:"extraction",
        title:"Real Extraction",
        text:"After objectives are complete, reach the marked evacuation vehicle. River missions use boats, air missions use helicopters, and road missions use convoys. Board and hold the extraction point until the vehicle departs.",
        hint:"New tigers stop spawning during final extraction. Tap Next.",
        arrow:"evacZone",
        canNext: () => true
      },
      {
        key:"modes",
        title:"Game Modes + Progress",
        text:"Story, Arcade, and Survival keep separate money, inventory, achievements, pass progress, and mission statistics. Mission results only count the current attempt.",
        hint:"Choose the mode that matches how you want to play. Tap Next.",
        arrow:null,
        canNext: () => true
      },
      {
        key:"done",
        title:"Done",
        text:"Tutorial complete.\nYou are ready to rescue civilians, investigate threats, command specialists, respond to live events, and extract from the city.",
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
    movedOnce:false,
    sprintUsed:false,
    lastLockedTigerId:null,
    baseShots:0,
    engagedOnce:false,
    attackedOnce:false,
    scanUsed:false,
    lockedOnce:false,
    interactableUsed:false,
    startX:0,
    startY:0,
    baseInteractables:null,
    captureWindowReached:false,
    combatOutcome:null,
    weaponSwitched:false,
    shieldUsed:false,
    squadCommandUsed:false,
    squadFormationUsed:false,
    shopOpened:false,
    squadOpened:false,
    inventoryOpened:false,
    cosmeticsOpened:false,
    lastShieldUntil:0
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
  function clearStepHighlight(){
    if(highlightedEl){
      highlightedEl.classList.remove("tutorialStepPulse");
      highlightedEl = null;
    }
    window.__tutorialTigerHighlight = null;
  }
  function applyStepHighlight(step, S){
    clearStepHighlight();
    if(!step) return;
    if(step.arrow === "tiger"){
      const tiger = pickTutorialTiger(S);
      if(tiger && Number.isFinite(tiger.x) && Number.isFinite(tiger.y)){
        window.__tutorialTigerHighlight = { x:tiger.x, y:tiger.y, at:Date.now() };
      }
      return;
    }
    if(typeof step.arrow !== "string") return;
    const target = tutorialTarget(step.arrow);
    if(!target) return;
    target.classList.add("tutorialStepPulse");
    highlightedEl = target;
  }

  function open(){
    overlay.style.display = "flex";
  }

  function close(){
    overlay.style.display = "none";
    hideArrow();
    clearStepHighlight();
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
    updateProgressFlags();
    let text = step.text;
    let hint = step.hint || "";
    if(step.key === "resolve_tiger"){
      const outcome = T.combatOutcome;
      if(outcome === "CAPTURE"){
        text = "Capture complete.\nYou preserved the tiger for research and kept aggression lower than a kill.";
        hint = "Good control. Tap Next.";
      } else if(outcome === "KILL"){
        text = "Kill complete.\nYou removed the threat fast, but blood raises jungle aggression more.";
        hint = "Fast clear with higher risk later. Tap Next.";
      }
    } else if(step.key === "weaken_tiger"){
      updateWeakenTigerHint();
      hint = hintEl.innerText || hint;
    }

    T.currentKey = step.key;
    titleEl.innerText = step.title;
    stepEl.innerText = `Step ${T.step + 1} / ${steps.length}`;
    textEl.innerText = text;
    hintEl.innerText = hint;
    nextBtn.innerText = step.finish ? "Finish" : "Next";
    setCardPlacement(step);

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
    applyStepHighlight(step, S);

    setNextEnabled(!!step.canNext());
    clearInterval(window.__tutTimer);
    window.__tutTimer = setInterval(() => {
      if(!window.TigerTutorial.isRunning) return;
      updateProgressFlags();
      if(step.key === "weaken_tiger") updateWeakenTigerHint();
      setCardPlacement(step);
      if(["lock","engage","weaken_tiger","weapon_switch","resolve_tiger"].includes(step.key)){
        const target = pickTutorialTiger(getS());
        if(target && target.alive && getS()){
          getS().scanTargetTigerId = target.id;
          getS().scanTargetUntil = Date.now() + 600000;
        }
      }
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
    T.movedOnce = false;
    T.sprintUsed = false;
    T.lastLockedTigerId = null;
    T.baseShots = Number(getS()?.stats?.shots || 0);
    T.engagedOnce = false;
    T.attackedOnce = false;
    T.scanUsed = false;
    T.lockedOnce = false;
    T.interactableUsed = false;
    T.startX = Number(getS()?.me?.x || 0);
    T.startY = Number(getS()?.me?.y || 0);
    T.baseInteractables = {};
    for(const it of (getS()?.mapInteractables || [])){
      if(!it?.id) continue;
      T.baseInteractables[String(it.id)] = {
        uses: Number.isFinite(Number(it.uses)) ? Number(it.uses) : null,
        cooldownUntil: Number(it.cooldownUntil || 0),
        activeUntil: Number(it.activeUntil || 0)
      };
    }
    T.captureWindowReached = false;
    T.combatOutcome = null;
    T.weaponSwitched = false;
    T.shieldUsed = false;
    T.squadCommandUsed = false;
    T.squadFormationUsed = false;
    T.shopOpened = false;
    T.squadOpened = false;
    T.inventoryOpened = false;
    T.cosmeticsOpened = false;
    T.lastShieldUntil = Number(getS()?.shieldUntil || 0);
    try{ window.enterTutorialMode?.(); }catch(e){}

    const S = getS();
    if(S){
      S.paused = false;
      S.pauseReason = null;
    }

    open();
    render();
  }

  function endTutorial(openModePicker=false){
    const T = window.TigerTutorial;
    T.isRunning = false;
    T.step = 0;
    T.currentKey = null;
    T.mapClicked = false;
    T.movedOnce = false;
    T.sprintUsed = false;
    T.lastLockedTigerId = null;
    T.baseShots = 0;
    T.engagedOnce = false;
    T.attackedOnce = false;
    T.scanUsed = false;
    T.lockedOnce = false;
    T.interactableUsed = false;
    T.startX = 0;
    T.startY = 0;
    T.baseInteractables = null;
    T.captureWindowReached = false;
    T.combatOutcome = null;
    T.weaponSwitched = false;
    T.shieldUsed = false;
    T.squadCommandUsed = false;
    T.squadFormationUsed = false;
    T.shopOpened = false;
    T.squadOpened = false;
    T.inventoryOpened = false;
    T.cosmeticsOpened = false;
    T.lastShieldUntil = 0;
    clearStepHighlight();

    try{ window.closeShop?.(); }catch(e){}
    try{ window.closeInventory?.(); }catch(e){}
    try{ window.endBattle?.(); }catch(e){}
    try{ window.exitTutorialMode?.(); }catch(e){}
    if(openModePicker){
      setTimeout(() => {
        try{
          if(typeof window.openModeOverlay === "function") window.openModeOverlay();
          else if(typeof window.openMode === "function") window.openMode();
        }catch(e){}
      }, 60);
    }

    close();
    try{ window.toast?.("Tutorial complete ✅"); }catch(e){}
  }

  nextBtn.addEventListener("click", () => {
    const T = window.TigerTutorial;
    if(!T.isRunning) return;
    if(nextBtn.disabled) return;

    const steps = getStepList();
    const step = steps[T.step];
    if(!step.canNext || !step.canNext()) return;

    if(step.finish){
      endTutorial(true);
      return;
    }

    if(step.key === "squad"){
      try{ window.closeShop?.(); }catch(e){}
    }
    if(step.key === "inventory"){
      // Keep Inventory open for the Cosmetics lesson that follows.
      setTimeout(() => {
        const cosmeticsTab = tutorialTarget("invTabCosmetics");
        try{ cosmeticsTab?.scrollIntoView?.({ block:"center", inline:"center" }); }catch(e){}
        setCardPlacement(getStepList()[window.TigerTutorial.step]);
      }, 80);
    }
    if(step.key === "cosmetics"){
      try{ window.closeInventory?.(); }catch(e){}
    }

    T.step += 1;
    T.mapClicked = false;
    render();
  });

  skipBtn.addEventListener("click", () => {
    endTutorial(false);
  });

  window.startTutorial = startTutorial;
})();
