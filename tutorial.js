// tutorial.js
// Tiger Strike — Guided Tutorial Overlay (Strict Step Lock)
// - Adds global startTutorial() so you can open tutorial anytime via a button
// - Fixes the double-click/skip-step issue
// - Strict step lock: "NEXT" is disabled until the step action is detected (when possible)
// - Safe fallbacks if game state isn't accessible

(function () {
  const tg = window.Telegram?.WebApp;

  const STORAGE_KEY = "ts_tutorial_v2_strict";
  const state = loadState();

  // ------------------ helpers ------------------
  function $(sel) { return document.querySelector(sel); }
  function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }
  function safeCall(fn) { try { return fn(); } catch (_) { return undefined; } }
  function haptic(type = "light") {
    safeCall(() => {
      const h = tg?.HapticFeedback;
      if (h?.impactOccurred) h.impactOccurred(type);
      else if (h?.notificationOccurred) h.notificationOccurred("success");
    });
  }
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {
        done: false,
        stepIndex: 0,
        completed: {},
        firstSeenAt: Date.now(),
      };
    } catch {
      return { done: false, stepIndex: 0, completed: {}, firstSeenAt: Date.now() };
    }
  }
  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // Try to access the game state (recommended: in game.js expose `window.S = S;`)
  function getS() {
    return window.S || window.__TS_STATE__ || null;
  }

  // ------------------ steps ------------------
  // Strict lock:
  // - If watch exists and we can evaluate it (game state exists), NEXT stays disabled until watch() === true.
  // - If watch exists but state is unavailable, NEXT becomes "I DID IT" (manual confirm).
  const steps = [
    {
      id: "welcome",
      title: "Welcome",
      text:
        "This quick tutorial will show you the basics:\n" +
        "• Tap to move\n• Scan to locate a tiger\n• Engage to battle\n• Evacuate civilians (Story/Arcade)\n\n" +
        "Tip: You can Pause, Shop, or Inventory anytime outside battle.",
      hint: "Press NEXT to begin.",
      lock: false,
    },
    {
      id: "move",
      title: "Move",
      text:
        "Tap anywhere on the map to set a destination.\n" +
        "Your soldier will move there and spend stamina.",
      hint: "Tap on the map now.",
      lock: true,
      watch: () => {
        const S = getS();
        if (!S) return false;
        return !!S.target || (S.me && (Math.abs((S.me.x || 0) - 160) > 10 || Math.abs((S.me.y || 0) - 420) > 10));
      },
    },
    {
      id: "scan",
      title: "Scan",
      text:
        "Press SCAN to ping the nearest/locked tiger.\n" +
        "Scan costs stamina, but helps you locate threats quickly.",
      hint: "Press SCAN once.",
      lock: true,
      onEnter: () => pulseSmart("scan"),
      onExit: () => stopPulseSmart("scan"),
      watch: () => {
        const S = getS();
        if (!S) return false;
        return (S.achievements && S.achievements.scan1) || (S.scanPing || 0) > 0;
      },
    },
    {
      id: "lock",
      title: "Lock a Tiger",
      text:
        "Tap directly on a tiger to lock it.\n" +
        "A blue ring shows the lock and your HUD targets that tiger.",
      hint: "Tap a tiger. If none nearby, scan again and move toward it.",
      lock: true,
      watch: () => {
        const S = getS();
        if (!S) return false;
        return !!S.lockedTigerId;
      },
    },
    {
      id: "engage",
      title: "Engage (Battle)",
      text:
        "Move close to a tiger, then press ENGAGE to enter battle.\n" +
        "In battle, you can ATTACK, PROTECT (Story/Arcade), CAPTURE, or KILL.",
      hint: "Get near a tiger and press ENGAGE.",
      lock: true,
      onEnter: () => pulseBySelector("#engageBtn"),
      onExit: () => stopPulseBySelector("#engageBtn"),
      watch: () => {
        const S = getS();
        if (!S) return false;
        return !!S.inBattle || ((S.stats?.shots || 0) > 0);
      },
    },
    {
      id: "ammo",
      title: "Ammo & Reload",
      text:
        "Each weapon has a magazine + reserve ammo.\n" +
        "If your current weapon is empty, switch weapons.\n" +
        "If ALL weapons have no ammo, buy ammo in the Shop.",
      hint: "In battle, try ATTACK once (or open Shop and buy ammo).",
      lock: true,
      onEnter: () => pulseSmart("shop"),
      onExit: () => stopPulseSmart("shop"),
      watch: () => {
        const S = getS();
        if (!S) return false;
        return (S.stats?.shots || 0) > 0 || (S.funds || 0) !== 1000; // spent/earned money
      },
    },
    {
      id: "civs",
      title: "Civilians & Evac",
      text:
        "In Story/Arcade, civilians follow you when you're nearby.\n" +
        "Lead them into the green evac zone to evacuate them.\n" +
        "If civilians die, you lose lives.",
      hint: "Evacuate at least one civilian (Story/Arcade).",
      lock: true,
      watch: () => {
        const S = getS();
        if (!S) return false;
        if (S.mode === "Survival") return true; // skip
        return (S.stats?.evac || 0) > 0 || (S.evacDone || 0) > 0;
      },
    },
    {
      id: "shop",
      title: "Shop & Inventory",
      text:
        "Use SHOP to buy weapons, ammo, armor, med kits, repair kits, and traps.\n" +
        "Use INVENTORY to equip weapons and use supplies.",
      hint: "Open Shop or Inventory once.",
      lock: true,
      onEnter: () => { pulseSmart("shop"); pulseSmart("inv"); },
      onExit: () => { stopPulseSmart("shop"); stopPulseSmart("inv"); },
      watch: () => {
        const shopOpen = isVisible("#shopOverlay");
        const invOpen = isVisible("#invOverlay");
        return shopOpen || invOpen;
      },
    },
    {
      id: "done",
      title: "You’re Ready",
      text:
        "That’s it!\n\n" +
        "Remember:\n• Traps hold tigers 3–5s (one-time)\n• Carcasses block movement\n• Backup costs $50,000 and freezes tigers temporarily\n\n" +
        "Good luck out there.",
      hint: "Press FINISH to close tutorial.",
      lock: false,
    },
  ];

  // ------------------ overlay creation ------------------
  ensureOverlay();

  const ui = {
    overlay: $("#tutorialOverlay"),
    title: $("#tutorialTitle"),
    text: $("#tutorialText"),
    step: $("#tutorialStep"),
    hint: $("#tutorialHint"),
    next: $("#tutorialNext"),
    skip: $("#tutorialSkip"),
  };

  // Skip
  ui.skip.onclick = () => {
    haptic("medium");
    finishTutorial(true);
  };

  // Public API
  window.TigerTutorial = {
  // ✅ Always start from Step 1 when user taps Tutorial
  start: () => {
    state.done = false;
    state.stepIndex = 0;
    state.completed = {};
    saveState();
    showTutorial(false);
  },

  // Optional: keep reset if you want a full wipe + reload
  reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); },

  skip: () => finishTutorial(true),
  state,
};

  // ✅ This is what your Tutorial button should call
  window.startTutorial = function () {
    window.TigerTutorial?.start?.();
  };

  // Auto-start on first load (unless done)
  if (!state.done) {
    setTimeout(() => showTutorial(true), 600);
  }

  // ------------------ strict lock watcher ------------------
  let watcher = null;
  function startWatcher() {
    stopWatcher();
    watcher = setInterval(() => {
      if (!ui.overlay || ui.overlay.style.display !== "flex") return;

      const st = steps[state.stepIndex];
      if (!st || !st.watch) return;

      // only auto-advance if we can read game state (strict)
      const S = getS();
      if (!S) return;

      if (st.watch()) {
        state.completed[st.id] = true;
        saveState();
        nextStep(false);
      } else {
        // keep button locked
        syncNextButtonLock();
      }
    }, 300);
  }
  function stopWatcher() {
    if (watcher) clearInterval(watcher);
    watcher = null;
  }

  // ------------------ core functions ------------------
  function showTutorial(firstAuto) {
    safeCall(() => window.setPaused?.(true, "tutorial"));
    ui.overlay.style.display = "flex";
    render();
    startWatcher();
    if (firstAuto) haptic("light");
  }

  function hideTutorial() {
    ui.overlay.style.display = "none";
    stopWatcher();
    safeCall(() => window.setPaused?.(false, null));
  }

  function nextStep(fromButton) {
    const prev = steps[state.stepIndex];
    safeCall(() => prev?.onExit?.());

    if (fromButton && prev?.id) state.completed[prev.id] = true;

    state.stepIndex = Math.min(state.stepIndex + 1, steps.length - 1);
    saveState();

    const cur = steps[state.stepIndex];
    safeCall(() => cur?.onEnter?.());

    render();
  }

  function finishTutorial(bySkip) {
    state.done = true;
    state.stepIndex = steps.length - 1;
    saveState();
    hideTutorial();
    safeCall(() => window.toast?.(bySkip ? "Tutorial skipped." : "Tutorial complete!"));
  }

  function render() {
    const st = steps[state.stepIndex];

    ui.title.textContent = st.title;
    ui.text.textContent = st.text;
    ui.hint.textContent = st.hint || "";
    ui.step.textContent = `Step ${state.stepIndex + 1} / ${steps.length}`;

    // Button behavior (no double listeners)
    ui.next.onclick = () => {
      haptic("light");

      if (st.id === "done") return finishTutorial(false);

      // strict lock
      if (st.watch && st.lock !== false) {
        const S = getS();
        if (S) {
          if (!st.watch()) {
            // still not complete
            safeCall(() => window.toast?.("Complete the step first."));
            return;
          }
        }
        // If no game state, allow manual confirm
      }

      nextStep(true);
    };

    // Button labels + lock state
    syncNextButtonLock();

    // Show a small status line if state isn't available
    const S = getS();
    const needsState = !!st.watch && st.lock !== false;
    if (needsState && !S) {
      ui.hint.textContent =
        (st.hint ? st.hint + " " : "") +
        "Note: If the step doesn’t auto-detect, press “I DID IT” after completing it.";
    }
  }

  function syncNextButtonLock() {
    const st = steps[state.stepIndex];

    if (st.id === "done") {
      ui.next.textContent = "FINISH";
      ui.next.disabled = false;
      return;
    }

    // If strict lock step and we can read state -> disable until watch true
    if (st.watch && st.lock !== false) {
      const S = getS();
      if (S) {
        const ok = !!st.watch();
        ui.next.textContent = ok ? "NEXT" : "LOCKED";
        ui.next.disabled = !ok;
        return;
      }

      // No state -> manual confirm mode
      ui.next.textContent = "I DID IT";
      ui.next.disabled = false;
      return;
    }

    ui.next.textContent = "NEXT";
    ui.next.disabled = false;
  }

  // ------------------ utility ------------------
  function isVisible(sel) {
    const n = $(sel);
    if (!n) return false;
    return getComputedStyle(n).display !== "none";
  }

  // ------------------ pulsing highlight (no flashing) ------------------
  const pulses = new Map();

  function pulseBySelector(sel) {
    const n = $(sel);
    if (!n) return;
    if (pulses.has(sel)) return;

    const original = n.style.boxShadow;
    let on = false;
    const t = setInterval(() => {
      on = !on;
      n.style.boxShadow = on
        ? "0 0 0 3px rgba(74, 222, 128, .55)"
        : (original || "");
    }, 650);
    pulses.set(sel, { t, original });
  }

  function stopPulseBySelector(sel) {
    const p = pulses.get(sel);
    if (!p) return;
    clearInterval(p.t);
    const n = $(sel);
    if (n) n.style.boxShadow = p.original || "";
    pulses.delete(sel);
  }

  // Smart pulse: tries id selectors first, then searches buttons by text/emoji
  function pulseSmart(kind) {
    const map = {
      scan: ["#scanBtn", "button[onclick*='scan(']"],
      shop: ["#shopBtn", "button[onclick*='openShop(']"],
      inv:  ["#invBtn", "button[onclick*='openInventory(']"],
    };
    const selectors = map[kind] || [];
    for (const sel of selectors) {
      const n = $(sel);
      if (n) return pulseBySelector(sel);
    }

    // Fallback: match button text
    const btn = findButtonByText(kind);
    if (btn) {
      const key = "__smart__" + kind;
      pulseElement(key, btn);
    }
  }

  function stopPulseSmart(kind) {
    const map = {
      scan: ["#scanBtn", "button[onclick*='scan(']"],
      shop: ["#shopBtn", "button[onclick*='openShop(']"],
      inv:  ["#invBtn", "button[onclick*='openInventory(']"],
    };
    const selectors = map[kind] || [];
    for (const sel of selectors) stopPulseBySelector(sel);

    const key = "__smart__" + kind;
    stopPulseElement(key);
  }

  function findButtonByText(kind) {
    const buttons = Array.from(document.querySelectorAll("button"));
    const t = (s) => (s || "").toLowerCase();

    if (kind === "scan") {
      return buttons.find(b => t(b.textContent).includes("scan") || b.textContent.includes("🛰️"));
    }
    if (kind === "shop") {
      return buttons.find(b => t(b.textContent).includes("shop") || b.textContent.includes("🛒"));
    }
    if (kind === "inv") {
      return buttons.find(b => t(b.textContent).includes("inventory") || b.textContent.includes("🎒"));
    }
    return null;
  }

  function pulseElement(key, node) {
    if (!node) return;
    if (pulses.has(key)) return;
    const original = node.style.boxShadow;
    let on = false;
    const tmr = setInterval(() => {
      on = !on;
      node.style.boxShadow = on
        ? "0 0 0 3px rgba(74, 222, 128, .55)"
        : (original || "");
    }, 650);
    pulses.set(key, { t: tmr, original, node });
  }

  function stopPulseElement(key) {
    const p = pulses.get(key);
    if (!p) return;
    clearInterval(p.t);
    if (p.node) p.node.style.boxShadow = p.original || "";
    pulses.delete(key);
  }

  // ------------------ DOM bootstrap ------------------
  function ensureOverlay() {
    if ($("#tutorialOverlay")) return;

    const overlay = el("div", { id: "tutorialOverlay" });
    overlay.style.cssText =
      "position:fixed; inset:0; display:none; align-items:center; justify-content:center;" +
      "background:rgba(11,13,18,.72); z-index:9999; padding:18px;";

    const card = el("div", { id: "tutorialCard" });
    card.style.cssText =
      "max-width:560px; width:100%; background:rgba(18,24,38,.98); color:#f1f5f9;" +
      "border:1px solid rgba(148,163,184,.25); border-radius:16px; padding:16px;";

    const head = el("div", { style: "display:flex; justify-content:space-between; align-items:center; gap:12px;" }, [
      el("div", {}, [
        el("div", { id: "tutorialTitle", style: "font-weight:800; font-size:18px; margin-bottom:4px;" }, ["Tutorial"]),
        el("div", { id: "tutorialStep", style: "opacity:.8; font-size:12px;" }, ["Step"]),
      ]),
      el("button", { id: "tutorialSkip" }, ["Skip"]),
    ]);

    const body = el("div", { style: "margin-top:12px; white-space:pre-line; line-height:1.35;" }, [
      el("div", { id: "tutorialText", style: "font-size:14px;" }, ["..."]),
      el("div", { id: "tutorialHint", style: "margin-top:10px; font-size:13px; opacity:.9;" }, [""]),
    ]);

    const foot = el("div", { style: "margin-top:14px; display:flex; justify-content:flex-end; gap:10px;" }, [
      el("button", { id: "tutorialNext", className: "good" }, ["Next"]),
    ]);

    const style = el("style", {
      textContent: `
        #tutorialOverlay button{
          padding:10px 12px; border-radius:12px; border:1px solid rgba(148,163,184,.25);
          background:rgba(30,41,59,.85); color:#f8fafc; font-weight:800;
        }
        #tutorialOverlay button.good{
          background:rgba(34,197,94,.22);
          border-color: rgba(34,197,94,.55);
        }
        #tutorialOverlay button:disabled{
          opacity:.55;
        }
        #tutorialOverlay button:active{ transform: translateY(1px); }
      `
    });

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(foot);
    overlay.appendChild(card);

    document.body.appendChild(style);
    document.body.appendChild(overlay);
  }
})();
