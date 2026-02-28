// tutorial.js
// Tutorial overlay + step tracker. Works anytime via TigerTutorial.start().
// Requires: window.S and window.setPaused from game.js (now provided).

(function () {
  const tg = window.Telegram?.WebApp;

  const STORAGE_KEY = "ts_tutorial_v1";
  const state = loadState();

  function $(sel) { return document.querySelector(sel); }
  function el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }
  function safeCall(fn) { try { fn(); } catch (_) {} }
  function haptic(type = "light") {
    safeCall(() => {
      const h = tg?.HapticFeedback;
      if (h?.impactOccurred) h.impactOccurred(type);
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

  const steps = [
    {
      id: "welcome",
      title: "Welcome",
      text:
        "This quick tutorial will show you the basics:\n" +
        "• Tap to move\n• Scan to locate a tiger\n• Engage to battle\n• Evacuate civilians (Story/Arcade)\n\n" +
        "Tip: You can Pause, Shop, or Inventory anytime outside battle.",
      hint: "Tap NEXT to begin.",
    },
    {
      id: "move",
      title: "Move",
      text:
        "Tap anywhere on the map to set a destination.\n" +
        "Your soldier will move there and spend stamina.",
      hint: "Tap on the map now.",
      watch: () => {
        const S = window.S;
        return !!S?.target || (S && (Math.abs((S.me?.x || 0) - 160) > 10 || Math.abs((S.me?.y || 0) - 420) > 10));
      },
    },
    {
      id: "scan",
      title: "Scan",
      text:
        "Press SCAN to ping the nearest/locked tiger.\n" +
        "Scan costs stamina, but helps you locate threats quickly.",
      hint: "Press the SCAN button once.",
      onEnter: () => pulse("#scanBtn"),
      onExit: () => stopPulse("#scanBtn"),
      watch: () => {
        const S = window.S;
        return (S?.achievements && S.achievements.scan1) || (S?.scanPing || 0) > 0;
      },
    },
    {
      id: "lock",
      title: "Lock a Tiger",
      text:
        "Tap directly on a tiger to lock it.\n" +
        "A blue ring shows the lock and your HUD targets that tiger.",
      hint: "Tap on a tiger (if you see one). If none are nearby, scan again.",
      watch: () => {
        const S = window.S;
        return !!S?.lockedTigerId;
      },
    },
    {
      id: "engage",
      title: "Engage (Battle)",
      text:
        "Move close to a tiger, then press ENGAGE to enter battle.\n" +
        "In battle, you can ATTACK, PROTECT (Story/Arcade), CAPTURE, or KILL.",
      hint: "Get near a tiger and press ENGAGE.",
      onEnter: () => pulse("#engageBtn"),
      onExit: () => stopPulse("#engageBtn"),
      watch: () => {
        const S = window.S;
        return !!S?.inBattle || (S?.stats && (S.stats.shots || 0) > 0);
      },
    },
    {
      id: "civs",
      title: "Civilians & Evac",
      text:
        "In Story/Arcade, civilians follow you when you're nearby.\n" +
        "Lead them into the green evac zone to evacuate them.\n" +
        "If civilians die, you lose lives.",
      hint: "Lead at least one civilian into the evac circle.",
      watch: () => {
        const S = window.S;
        if (!S) return false;
        if (S.mode === "Survival") return true;
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
      onEnter: () => { pulse("#shopBtn"); pulse("#invBtn"); },
      onExit: () => { stopPulse("#shopBtn"); stopPulse("#invBtn"); },
      watch: () => isVisible("#shopOverlay") || isVisible("#invOverlay"),
    },
    {
      id: "done",
      title: "You’re Ready",
      text:
        "That’s it!\n\n" +
        "Remember:\n• Traps hold tigers 3–5s (one-time)\n• Carcasses block movement\n• Backup costs $50,000 and freezes tigers temporarily\n\n" +
        "Good luck out there.",
      hint: "Press FINISH to close tutorial.",
    },
  ];

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

  ui.skip.onclick = () => {
    haptic("medium");
    finishTutorial(true);
  };

  let watcher = null;
  function startWatcher() {
    stopWatcher();
    watcher = setInterval(() => {
      if (!ui.overlay || ui.overlay.style.display !== "flex") return;
      const st = steps[state.stepIndex];
      if (!st?.watch) return;

      if (st.watch()) {
        state.completed[st.id] = true;
        saveState();
        nextStep(false);
      }
    }, 350);
  }
  function stopWatcher() {
    if (watcher) clearInterval(watcher);
    watcher = null;
  }

  window.TigerTutorial = {
    start: () => showTutorial(false),
    reset: () => { localStorage.removeItem(STORAGE_KEY); location.reload(); },
    skip: () => finishTutorial(true),
    state,
  };

  // Auto-start only first time
  if (!state.done) setTimeout(() => showTutorial(true), 600);

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
    ui.next.textContent = (st.id === "done") ? "FINISH" : "NEXT";

    ui.next.onclick = () => {
      haptic("light");
      if (st.id === "done") finishTutorial(false);
      else nextStep(true);
    };
  }

  function isVisible(sel) {
    const n = $(sel);
    if (!n) return false;
    return getComputedStyle(n).display !== "none";
  }

  const pulses = new Map();
  function pulse(sel) {
    const n = $(sel);
    if (!n) return;
    if (pulses.has(sel)) return;

    const original = n.style.boxShadow;
    let on = false;
    const t = setInterval(() => {
      on = !on;
      n.style.boxShadow = on
        ? "0 0 0 3px rgba(74, 222, 128, .55)"
        : "0 0 0 0 rgba(0,0,0,0)";
    }, 650);
    pulses.set(sel, { t, original });
  }
  function stopPulse(sel) {
    const p = pulses.get(sel);
    if (!p) return;
    clearInterval(p.t);
    const n = $(sel);
    if (n) n.style.boxShadow = p.original || "";
    pulses.delete(sel);
  }

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

    const style = el("style", { textContent:
      `
      #tutorialOverlay button{
        padding:10px 12px; border-radius:12px; border:1px solid rgba(148,163,184,.25);
        background:rgba(30,41,59,.85); color:#f8fafc; font-weight:700;
      }
      #tutorialOverlay button.good{
        background:rgba(34,197,94,.22);
        border-color: rgba(34,197,94,.55);
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
