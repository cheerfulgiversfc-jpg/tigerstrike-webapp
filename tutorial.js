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
  function overlayVisible(id){
    const el = byId(id);
    if(!el) return false;
    if(el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  }
  function stepElapsedMs(){
    const started = Number(window.TigerTutorial?.stepStartedAt || 0);
    return started > 0 ? Math.max(0, Date.now() - started) : 0;
  }
  function tutorialTarget(id){
    if(id === "shopBtn") return visibleEl("shopBtn") || visibleEl("navShopBtn") || visibleSelector('button[onclick*="openShop"]');
    if(id === "invBtn") return visibleEl("invBtn") || visibleEl("navInvBtn") || visibleSelector('button[onclick*="openInventory"]');
    if(id === "scanBtn") return visibleEl("scanBtn") || visibleEl("touchScanBtn");
    if(id === "sprintBtn") return visibleEl("touchSprintBtn");
    if(id === "shieldBtn") return visibleSelector("[data-shield-btn]") || visibleEl("touchShieldBtn") || visibleEl("combatArmorBtn") || visibleEl("touchCombatArmorBtn");
    if(id === "atkBtn") return visibleEl("atkBtn") || visibleEl("touchAttackBtn") || visibleEl("combatAttackBtn");
    if(id === "captureBtn") return visibleEl("capBtn") || visibleEl("touchCaptureBtn") || visibleEl("combatCaptureBtn");
    if(id === "medBtn") return visibleEl("touchCombatMedkitBtn") || visibleEl("combatMedkitBtn") || visibleEl("touchMedkitBtn");
    if(id === "armorBtn") return visibleEl("touchCombatArmorBtn") || visibleEl("combatArmorBtn") || visibleEl("touchShieldBtn");
    if(id === "weaponBtn") return visibleEl("touchNextWeaponBtn") || visibleEl("combatNextWeaponBtn");
    if(id === "squadCmdBtn") return visibleEl("squadCmdBtn") || visibleEl("squadCmdBtnMobile") || visibleEl("touchSquadWheelBtn");
    if(id === "squadFormBtn") return visibleEl("squadFormBtn") || visibleEl("squadFormBtnMobile");
    if(id === "worldMapBtn") return visibleSelector('button[onclick*="openWorldMapCampaign"]');
    if(id === "hqBtn") return visibleSelector('button[onclick*="openBaseHQ"]') || visibleSelector('button[onclick*="openBaseHQFromLaunchIntro"]');
    if(id === "tabSquad") return visibleEl("tabSquad") || visibleSelector('button[onclick*="shopTab"][onclick*="squad"]');
    if(id === "invTabCosmetics") return visibleEl("invTabCosmetics") || visibleSelector('button[onclick*="inventoryTab"][onclick*="cosmetics"]');
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

    if(S?.inBattle || visibleEl("touchAttackBtn") || visibleEl("combatAttackBtn")) T.combatButtonsSeen = true;
    if(captureReadyFromUi()) T.captureButtonReady = true;
    if(S?.evacZone && (S?.evacRoute || S?.extractionSequence || Number(S?.evacDone || 0) > 0)) T.evacRouteSeen = true;

    const shop = byId("shopOverlay");
    if(overlayVisible("shopOverlay")) T.shopOpened = true;
    const squadTab = byId("tabSquad");
    const squadPageVisible = !!(byId("shopList")?.innerText || "").match(/specialist|squad|revive|rescue/i);
    if(T.shopOpened && ((squadTab && squadTab.classList.contains("active")) || squadPageVisible)) T.squadOpened = true;
    if(overlayVisible("invOverlay")) T.inventoryOpened = true;
    const cosmeticsTab = byId("invTabCosmetics");
    const cosmeticsPage = byId("invCosmeticsPage");
    if(T.inventoryOpened && (
      cosmeticsTab?.classList.contains("active") ||
      (cosmeticsPage && window.getComputedStyle(cosmeticsPage).display !== "none") ||
      (byId("invCosmeticSummary")?.innerText || "").length > 0
    )) T.cosmeticsOpened = true;
    if(overlayVisible("worldMapCampaignOverlay")) T.worldMapOpened = true;
    if(overlayVisible("baseHqOverlay") || document.body.classList.contains("baseHqActive") || S?.pauseReason === "base-hq") T.hqSeen = true;
  }
  function setCardPlacement(step){
    if(!cardEl) return;
    const key = (typeof step === "string") ? step : (step?.key || "");
    const mobile = !!window.matchMedia?.("(max-width:760px)")?.matches;
    const baseTop = mobile ? 12 : 70;
    const margin = mobile ? 8 : 12;
    const maxH = key === "squad_shop"
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
    const squadUnitPrice = Math.max(1, Number(cfg.squadUnitPrice || 100000));
    const squadBundlePrice = Math.max(1, Number(cfg.squadBundlePrice || 175000));
    return [
      {
        key:"intro",
        title:"Current Game Tutorial",
        text:"Welcome to the rebuilt Tiger Strike tutorial. This version teaches the current game: HQ, mission HUD, civilians, scan line, capture window, combat buttons, squad, shop, inventory, World Map, and real evacuation routes.",
        hint:"Tap Next to begin.",
        arrow:null,
        canNext: () => true
      },
      {
        key:"hq_overview",
        title:"Base HQ Main Menu",
        text:"Base HQ is the main menu. Use it to start Story, Arcade, Survival, Tutorial, Shop, Inventory, Mission Briefing, World Map, Barracks, Armory, Medbay, Intel, and Trophy rooms.",
        hint:"After this tutorial finishes, you will return to HQ. Tap Next.",
        arrow:"hqBtn",
        canNext: () => true
      },
      {
        key:"mission_hud",
        title:"Mission HUD",
        text:"The Mission panel shows objectives, civilians, tigers left, weather, world events, and extraction status. The Agent panel shows health, armor, ammo, money, stars, squad status, and active gear.",
        hint:"Read the top mission cards, then tap Next.",
        arrow:"objTxt",
        canNext: () => true
      },
      {
        key:"move",
        title:"Move",
        text:"Tap anywhere on the map to move your agent. The camera follows you, but important targets stay marked so you can find them again.",
        hint:"Move your agent a short distance.",
        arrow:"cv",
        canNext: () => window.TigerTutorial.movedOnce === true
      },
      {
        key:"sprint",
        title:"Sprint + Stamina",
        text:"Sprint helps you reach civilians, clues, and extraction routes faster. Sprint uses stamina and then enters cooldown, so save it for danger moments.",
        hint:"Tap Sprint once.",
        arrow:"sprintBtn",
        canNext: () => window.TigerTutorial.sprintUsed === true
      },
      {
        key:"escort",
        title:"Civilian Rescue",
        text:"Move close to the civilian so they follow you. Guide them into the green safe/extraction zone. Rescued civilians should count immediately and stay protected.",
        hint:"Escort the civilian into the green zone.",
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
        key:"evac_routes",
        title:"Real Evac Routes",
        text:"Later missions can extract by safe house, street convoy, boat dock, or helicopter pad. Civilians board the route, boarding can pause if tigers are too close, and the vehicle departs when extraction is secure.",
        hint:"This tutorial uses the safe zone. Tap Next.",
        arrow:"evacZone",
        canNext: () => true
      },
      {
        key:"scan_line",
        title:"Scan Line",
        text:"Press Scan to locate and lock the nearest tiger. Scan creates a blue guidance line from your agent to the target tiger.",
        hint:"Tap Scan once and look for the blue line.",
        arrow:"scanBtn",
        canNext: () => {
          const S = getS();
          return window.TigerTutorial.scanUsed === true || Number(S?.scanPing || 0) > 0 || Number(S?.scanTargetTigerId || 0) > 0;
        }
      },
      {
        key:"lock_target",
        title:"Lock A Tiger",
        text:"Tap a tiger on the map to lock it. Blue ring means locked. If you accidentally tap away, tap the tiger again.",
        hint:"Tap the highlighted tiger until the blue lock ring appears.",
        arrow:"tiger",
        canNext: () => {
          const S = getS();
          return !!window.TigerTutorial?.lockedOnce || Number(S?.lockedTigerId || 0) > 0;
        }
      },
      {
        key:"engage_tiger",
        title:"Engage On Map",
        text:"Tap the locked tiger again. If you are too far away, your agent moves closer while the scan line stays active. Tap again when close enough to start combat.",
        hint:"Engage the highlighted tiger.",
        arrow:"tiger",
        canNext: () => {
          const S = getS();
          const T = window.TigerTutorial;
          return !!((S && S.inBattle === true) || T?.engagedOnce);
        }
      },
      {
        key:"combat_buttons",
        title:"Combat Buttons",
        text:"During combat, the buttons become your survival kit: Attack damages, Capture uses tranquilizers, Med restores HP, Armor/Shield protects, Weapon arrows switch weapons, and Roll dodges danger.",
        hint:"Find the combat buttons, then tap Next.",
        arrow:"atkBtn",
        canNext: () => {
          const S = getS();
          return !!(S?.inBattle || window.TigerTutorial.combatButtonsSeen || visibleEl("touchAttackBtn") || visibleEl("combatAttackBtn"));
        }
      },
      {
        key:"weaken_tiger",
        title:"Weaken Tiger",
        text:`Attack until the tiger is at ${capturePct}% HP or lower. The capture button will highlight when the tiger is in capture range.`,
        hint:"Keep attacking until capture becomes available.",
        arrow:"atkBtn",
        canNext: () => {
          const T = window.TigerTutorial;
          const S = getS();
          const activeTigerId = Number(S?.activeTigerId || 0);
          const tiger = activeTigerId > 0 ? (S?.tigers || []).find((it)=>it && it.id === activeTigerId && it.alive) : null;
          const hpWindowReady = !!(tiger && tiger.hpMax > 0 && (tiger.hp / tiger.hpMax) <= 0.34);
          return !!(T?.captureWindowReached || T?.captureButtonReady || captureReadyFromUi() || hpWindowReady || T?.combatOutcome);
        }
      },
      {
        key:"capture_window",
        title:"Capture Window",
        text:`Capture is best when the tiger is at ${capturePct}% HP or lower. If you press Capture with no tranquilizers, the game should tell you you are out instead of leaving you guessing.`,
        hint:"When Capture is highlighted, tap Next.",
        arrow:"captureBtn",
        canNext: () => !!(window.TigerTutorial.captureWindowReached || window.TigerTutorial.captureButtonReady || captureReadyFromUi() || window.TigerTutorial.combatOutcome)
      },
      {
        key:"weapon_switch",
        title:"Weapons + Ammo",
        text:"Your weapon choice should stay under your control. Different guns use different ammo families and ranges; stronger ammo should be used before weaker ammo when available.",
        hint:"Tap the next-weapon arrow once. If the tiger is already resolved, you can continue.",
        arrow:"weaponBtn",
        canNext: () => {
          if(window.TigerTutorial.weaponSwitched === true || !!window.TigerTutorial.combatOutcome) return true;
          // If the weapon switch control is unavailable on a compact HUD, don't strand the lesson.
          return stepElapsedMs() > 2500 && !tutorialTarget("weaponBtn");
        }
      },
      {
        key:"ammo_warnings",
        title:"Ammo + Icon Warnings",
        text:"Combat icons should always explain what happened. If Attack, Capture, Medkit, Armor, Shield, Trap, Scan, or Cache cannot work, the game tells you why: out of ammo, no tranquilizers, capture not ready, shield cooldown, no medkits, no armor, or no target found.",
        hint:"Watch for toast and LIVE messages when an icon cannot work. Tap Next.",
        arrow:"atkBtn",
        canNext: () => true
      },
      {
        key:"resolve_tiger",
        title:"Capture Or Kill",
        text:`Now finish the fight. Capture preserves the tiger for research. Kill removes the threat quickly. Strong tigers may require better timing, ammo, and armor.`,
        hint:"Capture or kill this tiger to continue.",
        arrow:"captureBtn",
        canNext: () => {
          const outcome = window.TigerTutorial.combatOutcome;
          return outcome === "CAPTURE" || outcome === "KILL";
        }
      },
      {
        key:"map_interactables",
        title:"Map Interactables",
        text:"Story maps include real interactables: Alarm reveals or disrupts threats, Barrier blocks danger lanes, and Cache grants resources. Other missions add gates, generators, bridges, crash sites, and convoy objects.",
        hint:"Use any one interactable once: Alarm, Barrier, or Cache.",
        arrow:"cv",
        canNext: () => {
          if(window.TigerTutorial.interactableUsed === true) return true;
          const S = getS();
          if(!Array.isArray(S?.mapInteractables)) return false;
          return S.mapInteractables.some((it)=>it && (Number(it.cooldownUntil || 0) > 0 || Number(it.activeUntil || 0) > 0 || Number(it.uses || 0) < 1));
        }
      },
      {
        key:"shield",
        title:"Shield, Armor + Cooldowns",
        text:`Shield protects you and nearby civilians for ${shieldDurationSec} seconds. Shields and traps use anti-spam cooldowns that grow by 5 seconds each repeated use, starting around ${shieldCooldownSec} seconds.`,
        hint:"Tap Shield once.",
        arrow:"shieldBtn",
        canNext: () => window.TigerTutorial.shieldUsed === true || Number(getS()?.shieldUntil || 0) > Date.now()
      },
      {
        key:"squad_command",
        title:"Squad Commands",
        text:"Owned specialists can follow Auto, Attack Target, Rescue, Regroup, and Hold. They should not appear unless owned, and downed specialists must be revived before returning.",
        hint:"Open the squad command wheel/menu and choose a command.",
        arrow:"squadCmdBtn",
        canNext: () => window.TigerTutorial.squadCommandUsed === true || stepElapsedMs() > 2500 && !tutorialTarget("squadCmdBtn")
      },
      {
        key:"squad_formation",
        title:"Squad Formations",
        text:"Formations change team behavior. Wedge pushes forward, Line controls space, Split Escort protects civilians, and Flank pressures tigers from the side.",
        hint:"Cycle the squad formation once.",
        arrow:"squadFormBtn",
        canNext: () => window.TigerTutorial.squadFormationUsed === true || stepElapsedMs() > 2500 && !tutorialTarget("squadFormBtn")
      },
      {
        key:"shop",
        title:"Shop",
        text:"Open Shop to buy weapons, ammo, med kits, armor, traps, bundles, specialists, cosmetics, and progression supplies. Bundles should be better value than buying each item alone.",
        hint:"Tap Shop.",
        arrow:"shopBtn",
        canNext: () => {
          if(window.TigerTutorial.shopOpened) return true;
          return overlayVisible("shopOverlay");
        }
      },
      {
        key:"squad_shop",
        title:"Squad In Shop",
        text:`Open the Squad tab. Specialists unlock normally at Mission ${squadUnlockLevel}, can be bought early with Stars, cost $${squadUnitPrice.toLocaleString()} each, or $${squadBundlePrice.toLocaleString()} for both. Revive is $150,000.`,
        hint:"Tap Squad tab in Shop.",
        arrow:"tabSquad",
        canNext: () => {
          if(window.TigerTutorial.squadOpened) return true;
          const tab = byId("tabSquad");
          return !!(overlayVisible("shopOverlay") && tab && tab.classList.contains("active"));
        }
      },
      {
        key:"inventory",
        title:"Inventory",
        text:"Open Inventory to claim and equip items, review operations, manage settlements, view cosmetics, and inspect achievements. Claim buttons should change state after they are claimed.",
        hint:"Tap Inventory once.",
        arrow:"invBtn",
        canNext: () => {
          if(window.TigerTutorial.inventoryOpened) return true;
          return overlayVisible("invOverlay");
        }
      },
      {
        key:"cosmetics",
        title:"Cosmetics + Showcase",
        text:"Cosmetics, titles, trails, trophies, captured tiger displays, and safe-zone visuals let players show progress without breaking balance.",
        hint:"Open the Cosmetics tab in Inventory.",
        arrow:"invTabCosmetics",
        canNext: () => {
          if(window.TigerTutorial.cosmeticsOpened === true) return true;
          return overlayVisible("invOverlay") && (
            byId("invTabCosmetics")?.classList.contains("active") ||
            window.getComputedStyle(byId("invCosmeticsPage") || document.body).display !== "none"
          );
        }
      },
      {
        key:"investigation",
        title:"Tracking + Investigation",
        text:"Some missions begin before combat. Scan footprints, fur, blood trails, scratches, sounds, and damaged objects to reveal tiger direction, type, health, age, behavior, dens, or missing civilians.",
        hint:"Weather can erase clues, so investigate early. Tap Next.",
        arrow:"scanBtn",
        canNext: () => true
      },
      {
        key:"live_world",
        title:"Living Missions",
        text:"LIVE events are real map events: tiger behavior changes, rivals can interfere, weather changes routes, helicopters can crash, floods can block paths, and convoy ambushes can create new objectives.",
        hint:"Watch the LIVE panel during missions. Tap Next.",
        arrow:"objTxt",
        canNext: () => true
      },
      {
        key:"world_map",
        title:"World Map Campaign",
        text:"The World Map lets you choose regions, defend territory, respond to crisis events, track rival/tiger control, protect supply lines, and earn regional rewards.",
        hint:"Open World Map once. You cannot launch a separate World Map mission during the tutorial.",
        arrow:"worldMapBtn",
        canNext: () => window.TigerTutorial.worldMapOpened === true
      },
      {
        key:"mode_separation",
        title:"Modes Stay Separate",
        text:"Story, Arcade, and Survival keep separate money, ammo, inventory, pass progress, achievements, and stats. Starting over at Mission 1 resets earned progress, purchases, equipment, money, and inventory for that run.",
        hint:"Tap Next.",
        arrow:null,
        canNext: () => true
      },
      {
        key:"done",
        title:"Done",
        text:"Tutorial complete. You are ready to rescue civilians, scan and track tigers, use capture windows, command specialists, manage HQ, shop wisely, use the World Map, and extract safely.",
        hint:"Tap Finish to return to Base HQ.",
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
    worldMapOpened:false,
    hqSeen:false,
    combatButtonsSeen:false,
    captureButtonReady:false,
    evacRouteSeen:false,
    lastShieldUntil:0,
    stepStartedAt:0,
    renderedKey:null
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
    if(T.renderedKey !== step.key){
      T.renderedKey = step.key;
      T.stepStartedAt = Date.now();
    }
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
      const tiger = pickTutorialTiger(S);
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
      if(["lock_target","engage_tiger","combat_buttons","weaken_tiger","capture_window","weapon_switch","ammo_warnings","resolve_tiger"].includes(step.key)){
        const target = pickTutorialTiger(getS());
        if(target && target.alive && getS()){
          getS().scanTargetTigerId = target.id;
          getS().scanTargetUntil = Date.now() + 600000;
        }
      }
      setNextEnabled(!!step.canNext());
    }, 200);
  }

  function startTutorial(opts={}){
    const T = window.TigerTutorial;
    if(T.isRunning) return;
    const steps = getStepList();
    const startKey = typeof opts === "string" ? opts : String(opts?.startKey || "");
    const startIndex = startKey ? steps.findIndex((step)=>step.key === startKey) : -1;

    T.isRunning = true;
    T.step = startIndex >= 0 ? startIndex : 0;
    T.currentKey = steps[T.step]?.key || "intro";
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
    T.worldMapOpened = false;
    T.hqSeen = false;
    T.combatButtonsSeen = false;
    T.captureButtonReady = false;
    T.evacRouteSeen = false;
    T.lastShieldUntil = Number(getS()?.shieldUntil || 0);
    T.stepStartedAt = Date.now();
    T.renderedKey = null;
    try{ window.enterTutorialMode?.(); }catch(e){}

    const S = getS();
    if(S){
      S.paused = false;
      S.pauseReason = null;
      T.baseShots = Number(S.stats?.shots || 0);
      T.startX = Number(S.me?.x || 0);
      T.startY = Number(S.me?.y || 0);
      T.baseInteractables = {};
      for(const it of (S.mapInteractables || [])){
        if(!it?.id) continue;
        T.baseInteractables[String(it.id)] = {
          uses: Number.isFinite(Number(it.uses)) ? Number(it.uses) : null,
          cooldownUntil: Number(it.cooldownUntil || 0),
          activeUntil: Number(it.activeUntil || 0)
        };
      }
      T.lastShieldUntil = Number(S.shieldUntil || 0);
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
    T.worldMapOpened = false;
    T.hqSeen = false;
    T.combatButtonsSeen = false;
    T.captureButtonReady = false;
    T.evacRouteSeen = false;
    T.lastShieldUntil = 0;
    T.stepStartedAt = 0;
    T.renderedKey = null;
    clearStepHighlight();

    try{ window.closeWorldMapCampaign?.(); }catch(e){}
    try{ window.closeShop?.(); }catch(e){}
    try{ window.closeInventory?.(); }catch(e){}
    try{ window.endBattle?.(); }catch(e){}
    try{ window.exitTutorialMode?.(); }catch(e){}
    if(openModePicker){
      setTimeout(() => {
        try{
          if(typeof window.openBaseHQ === "function") window.openBaseHQ({ fromTutorial:true, home:true });
          else if(typeof window.openModeOverlay === "function") window.openModeOverlay();
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

    if(step.key === "squad_shop"){
      try{ window.closeShop?.(); }catch(e){}
    }
    if(step.key === "world_map"){
      try{ window.closeWorldMapCampaign?.(); }catch(e){}
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
    T.stepStartedAt = Date.now();
    T.renderedKey = null;
    render();
  });

  skipBtn.addEventListener("click", () => {
    endTutorial(false);
  });

  window.startTutorial = startTutorial;
})();
