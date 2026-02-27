/* Tiger Strike Tutorial (STRICT STEP LOCK)
   - Blocks actions until required step is completed.
   - Shows overlay text + highlights what to do.
   - Uses window.S from game.js.

   Action keys used by game.js:
   OPEN_MODE, SET_MODE, DEPLOY, CANVAS_TAP, SCAN, ENGAGE,
   BATTLE_SHOOT, BATTLE_RELOAD, CAPTURE,
   OPEN_SHOP, OPEN_INVENTORY, USE_MED, EQUIP_WEAPON, BUY_AMMO, BUY_WEAPON, BUY_MED,
   TOGGLE_PAUSE, RESET_GAME, START_NEXT_MISSION, RESTART_MISSION, OPEN_ABOUT
*/

(() => {
  const $ = (id) => document.getElementById(id);

  const Tutorial = {
    active: false,
    step: 0,

    // "strict" means: ONLY allow actions listed for current step.
    strict: true,

    steps: [
      {
        title: "Welcome to Tiger Strike",
        text:
          "This tutorial is STRICT step-lock.\n\nStep 1: Press “Deploy” to spawn your mission.",
        allow: ["DEPLOY"],
        onEnter() {
          showOverlay(true);
          setTip(this.title, this.text);
          pulse("btnDeploy");
        },
        onExit() {
          unpulse("btnDeploy");
        },
      },
      {
        title: "Movement",
        text:
          "Step 2: Tap anywhere on the map to move your player circle.\n\n(Just tap once.)",
        allow: ["CANVAS_TAP"],
        onEnter() {
          setTip(this.title, this.text);
        },
        requires: { moved: true },
      },
      {
        title: "Scan",
        text:
          "Step 3: Press “Scan”.\n\nThis creates a blue ping ring around you.",
        allow: ["SCAN"],
        onEnter() {
          pulse("btnScan");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnScan");
        },
      },
      {
        title: "Lock a Tiger",
        text:
          "Step 4: Tap directly on a tiger to lock it.\n\nYou should see a white ring around the tiger.",
        allow: ["CANVAS_TAP"],
        requires: { lockedTiger: true },
      },
      {
        title: "Engage",
        text:
          "Step 5: Move close to the locked tiger, then press “Engage”.\n\nTip: If it says “Get closer”, tap near the tiger first.",
        allow: ["CANVAS_TAP", "ENGAGE"],
        onEnter() {
          pulse("btnEngage");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnEngage");
        },
        requires: { enteredBattle: true },
      },
      {
        title: "Reload",
        text:
          "Step 6: Press “Reload” in the battle screen.",
        allow: ["BATTLE_RELOAD"],
        onEnter() {
          pulse("btnReload");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnReload");
        },
      },
      {
        title: "Tranq / Shoot",
        text:
          "Step 7: Press “Tranq/Shoot” in battle.\n\nIf you are using a tranq weapon, keep tranq-ing until the tiger sleeps.",
        allow: ["BATTLE_SHOOT"],
        onEnter() {
          pulse("btnShoot");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnShoot");
        },
        requires: { didShoot: true },
      },
      {
        title: "Capture",
        text:
          "Step 8: When the tiger is asleep, press “Capture”.\n\nIf it’s not asleep yet, keep using Tranq.",
        allow: ["BATTLE_SHOOT", "CAPTURE"],
        onEnter() {
          pulse("btnCapture");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnCapture");
        },
        requires: { captured: true },
      },
      {
        title: "Shop",
        text:
          "Step 9: Open the Shop and buy 1 ammo pack (any ammo).\n\nThen close Shop.",
        allow: ["OPEN_SHOP", "BUY_AMMO"],
        onEnter() {
          pulse("btnShop");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnShop");
        },
        requires: { boughtAmmo: true },
      },
      {
        title: "Inventory + Heal",
        text:
          "Step 10: Open Inventory and use a Med Kit (if you have one).\n\nTutorial will allow “Use” even if HP is full.",
        allow: ["OPEN_INVENTORY", "USE_MED"],
        onEnter() {
          pulse("btnInv");
          setTip(this.title, this.text);
        },
        onExit() {
          unpulse("btnInv");
        },
        requires: { usedMed: true },
      },
      {
        title: "Done ✅",
        text:
          "Tutorial complete.\n\nYou are now unlocked to play normally!",
        allow: ["*"],
        onEnter() {
          setTip(this.title, this.text);
          showFinish();
        },
      },
    ],

    // ------- Public API -------
    isActive() {
      return this.active;
    },

    start() {
      this.active = true;
      this.step = 0;
      showOverlay(true);
      this._enterStep();
    },

    stop() {
      this._exitStep();
      this.active = false;
      showOverlay(false);
      clearFinish();
    },

    allow(actionKey) {
      if (!this.active) return true;
      const stepDef = this.steps[this.step];
      if (!stepDef) return true;

      // wildcard step unlock
      if (stepDef.allow && stepDef.allow.includes("*")) return true;

      // strict lock
      if (this.strict) {
        return stepDef.allow?.includes(actionKey) || false;
      }

      // non-strict: allow everything, only guide
      return true;
    },

    // hooks called from game.js
    onDeploy() {
      if (!this.active) return;
      if (this.step === 0) this.next();
    },

    onCanvasTap(x, y) {
      if (!this.active) return;
      const S = window.S;

      // step 1 movement: any tap that creates target counts
      if (this.step === 1) {
        // we can’t see internal movement completion reliably, so accept a tap here
        this._flag("moved", true);
        this.next();
      }

      // lock tiger step: if game locked tiger, accept
      if (this.step === 3) {
        // game locks tiger when tap hits a tiger
        // we check shortly after tap
        setTimeout(() => {
          if (window.S?.lockedTigerId) {
            this._flag("lockedTiger", true);
            this.next();
          }
        }, 50);
      }
    },

    onScan() {
      if (!this.active) return;
      if (this.step === 2) this.next();
    },

    onEngage() {
      if (!this.active) return;
      if (this.step === 4) {
        this._flag("enteredBattle", true);
        this.next();
      }
    },

    onShoot() {
      if (!this.active) return;
      if (this.step === 6) {
        this._flag("didShoot", true);
        this.next();
      }
    },

    onTranqSleep() {
      // optional: could show extra hint, but not required
    },

    onCapture() {
      if (!this.active) return;
      if (this.step === 7) {
        this._flag("captured", true);
        this.next();
      }
    },

    // "consume" lets tutorial simulate some actions even if game would block (like using med at full HP)
    consume(kind) {
      if (!this.active) return true;

      if (kind === "RELOAD") {
        if (this.step === 5) {
          this.next();
          return true;
        }
        return false;
      }

      if (kind === "MEDKIT") {
        if (this.step === 9) {
          this._flag("usedMed", true);
          this.next();
          return true;
        }
        return false;
      }

      return true;
    },

    // shop buys
    onBoughtAmmo() {
      if (!this.active) return;
      if (this.step === 8) {
        this._flag("boughtAmmo", true);
        this.next();
      }
    },

    next() {
      if (!this.active) return;
      this._exitStep();
      this.step = Math.min(this.step + 1, this.steps.length - 1);
      this._enterStep();
    },

    // ------- internals -------
    _enterStep() {
      clearFinish();
      const def = this.steps[this.step];
      if (!def) return;
      def.onEnter?.call(def);
      updateProgress(this.step, this.steps.length - 1);
    },

    _exitStep() {
      const def = this.steps[this.step];
      def?.onExit?.call(def);
    },

    _flag(k, v) {
      const def = this.steps[this.step];
      def.requires = def.requires || {};
      def.requires[k] = v;
    },
  };

  // expose
  window.Tutorial = Tutorial;

  // ---------- Overlay UI ----------
  function showOverlay(on) {
    const ov = $("tutorialOverlay");
    if (!ov) return;
    ov.style.display = on ? "flex" : "none";
  }

  function setTip(title, text) {
    $("tTitle").textContent = title || "Tutorial";
    $("tText").textContent = text || "";
  }

  function updateProgress(step, total) {
    const p = $("tProgress");
    if (!p) return;
    if (total <= 0) {
      p.textContent = "";
      return;
    }
    p.textContent = `Step ${Math.min(step + 1, total + 1)} of ${total + 1}`;
  }

  function pulse(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add("pulse");
  }

  function unpulse(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove("pulse");
  }

  function showFinish() {
    const btn = $("tDone");
    if (btn) btn.style.display = "inline-flex";
  }

  function clearFinish() {
    const btn = $("tDone");
    if (btn) btn.style.display = "none";
  }

  // ---------- Wire tutorial buttons ----------
  window.addEventListener("DOMContentLoaded", () => {
    const startBtn = $("btnTutorial");
    if (startBtn) {
      startBtn.addEventListener("click", () => Tutorial.start());
    }

    const doneBtn = $("tDone");
    if (doneBtn) {
      doneBtn.addEventListener("click", () => Tutorial.stop());
    }
  });

  // ---------- Intercept buyAmmo to notify tutorial ----------
  // (We wrap the global buyAmmo function after game.js defines it.)
  function wrapBuyAmmo() {
    const original = window.buyAmmo;
    if (!original || original.__wrapped) return;

    const wrapped = function (...args) {
      const before = window.S?.funds;
      original.apply(this, args);

      // if funds decreased, treat as buy success (good enough for tutorial)
      const after = window.S?.funds;
      if (Tutorial.isActive() && Tutorial.step === 8 && typeof before === "number" && typeof after === "number" && after < before) {
        Tutorial.onBoughtAmmo();
      }
    };
    wrapped.__wrapped = true;
    window.buyAmmo = wrapped;
  }

  // poll a few times until game.js is loaded
  let tries = 0;
  const timer = setInterval(() => {
    wrapBuyAmmo();
    tries++;
    if (tries > 40) clearInterval(timer);
    if (window.buyAmmo?.__wrapped) clearInterval(timer);
  }, 50);
})();
