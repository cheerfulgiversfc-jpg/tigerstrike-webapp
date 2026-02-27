/* Tiger Strike 🐅
   Minimal complete build (game.js + tutorial.js + index.html)
   - Tap to move
   - Scan ping
   - Lock tiger by tapping it
   - Engage -> battle overlay
   - Tranq / Shoot / Reload
   - Civilians + Evac zone (Story/Arcade)
   - Survival mode (no civilians)
   - Basic shop + inventory
   - Strict tutorial step-lock supported (tutorial.js)
*/

(() => {
  // ---------- Safe Telegram WebApp hook ----------
  const tg = window.Telegram?.WebApp;
  if (tg) {
    try {
      tg.expand?.();
      tg.ready?.();
      tg.setHeaderColor?.("#0b0d12");
      tg.setBackgroundColor?.("#0b0d12");
    } catch {}
  }

  // ---------- DOM helpers ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function toast(msg) {
    const t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.style.display = "block";
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => (t.style.display = "none"), 2200);
  }

  // ---------- Tutorial gate ----------
  function allowAction(actionKey) {
    if (window.Tutorial?.isActive?.()) return window.Tutorial.allow(actionKey);
    return true;
  }

  // ---------- Data ----------
  const STORAGE_KEY = "tiger_strike_v1_split";

  const MODES = ["Story", "Arcade", "Survival"];

  const WEAPONS = [
    { id: "TRQ_PISTOL", name: "Tranq Pistol", type: "tranq", mag: 6, dmg: [10, 14], price: 50 },
    { id: "SIDEARM", name: "9mm Sidearm", type: "lethal", mag: 12, dmg: [10, 16], price: 150 },
    { id: "SHOTGUN", name: "Pump Shotgun", type: "lethal", mag: 5, dmg: [18, 26], price: 500 },
    { id: "TRQ_RIFLE", name: "Tranq Rifle", type: "tranq", mag: 5, dmg: [14, 20], price: 2500 },
  ];

  const AMMO = [
    { id: "TRANQ", name: "Tranq Darts", pack: 10, price: 50 },
    { id: "NINE", name: "9mm Ammo", pack: 25, price: 80 },
    { id: "SHELLS", name: "12ga Shells", pack: 12, price: 120 },
  ];

  const MEDS = [
    { id: "MED_SMALL", name: "Small Med Kit", heal: 10, price: 50 },
    { id: "MED_MED", name: "Med Kit", heal: 25, price: 150 },
  ];

  const AMMO_FOR_WEAPON = {
    TRQ_PISTOL: "TRANQ",
    TRQ_RIFLE: "TRANQ",
    SIDEARM: "NINE",
    SHOTGUN: "SHELLS",
  };

  const TIGER_TYPES = [
    { key: "Scout", hp: 70, spd: 3.3, civBias: 0.8 },
    { key: "Standard", hp: 110, spd: 2.6, civBias: 0.45 },
    { key: "Stalker", hp: 95, spd: 3.0, civBias: 0.55 },
    { key: "Berserker", hp: 120, spd: 2.7, civBias: 0.3 },
    { key: "Alpha", hp: 160, spd: 2.4, civBias: 0.35 },
  ];

  // ---------- State ----------
  const DEFAULT = {
    v: 1,
    mode: "Story",
    storyLevel: 1,
    arcadeLevel: 1,
    survivalWave: 1,

    paused: false,

    // player
    me: { x: 140, y: 420 },
    target: null,
    hp: 100,
    armor: 20,
    stamina: 100,
    lives: 3,

    // economy
    funds: 1000,
    score: 0,

    // loadout
    ownedWeapons: ["TRQ_PISTOL", "SIDEARM", "TRQ_RIFLE"],
    equippedWeaponId: "TRQ_PISTOL",
    ammoReserve: { TRANQ: 20, NINE: 40, SHELLS: 0 },
    mag: { loaded: 6, cap: 6 },
    meds: { MED_SMALL: 1, MED_MED: 0 },

    // map/mission
    evacZone: { x: 860, y: 460, r: 72 },
    evacDone: 0,
    civilians: [],
    tigers: [],
    lockedTigerId: null,
    scanPing: 0,

    inBattle: false,
    activeTigerId: null,

    missionEnded: false,
    gameOver: false,

    // survival clock
    survivalStart: null,
    surviveSeconds: 0,
  };

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!s) return structuredClone(DEFAULT);
      const m = { ...DEFAULT, ...s };
      m.me = { ...DEFAULT.me, ...(s.me || {}) };
      m.mag = { ...DEFAULT.mag, ...(s.mag || {}) };
      m.ammoReserve = { ...DEFAULT.ammoReserve, ...(s.ammoReserve || {}) };
      m.meds = { ...DEFAULT.meds, ...(s.meds || {}) };
      m.civilians = Array.isArray(s.civilians) ? s.civilians : [];
      m.tigers = Array.isArray(s.tigers) ? s.tigers : [];
      return m;
    } catch {
      return structuredClone(DEFAULT);
    }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
  }

  let S = load();
  window.S = S; // allow tutorial.js to reference

  // ---------- Canvas ----------
  const cv = $("cv");
  const ctx = cv.getContext("2d");

  // ---------- Game helpers ----------
  const getWeapon = (id) => WEAPONS.find((w) => w.id === id) || WEAPONS[0];
  const weapon = () => getWeapon(S.equippedWeaponId);

  function ammoIdForEquipped() {
    return AMMO_FOR_WEAPON[S.equippedWeaponId] || "TRANQ";
  }

  function randomEvacZone() {
    return { x: rand(120, 920), y: rand(120, 520), r: 72 };
  }

  function spawnCivilians() {
    const n =
      S.mode === "Story"
        ? clamp(3 + (S.storyLevel - 1), 3, 7)
        : S.mode === "Arcade"
        ? clamp(2 + (S.arcadeLevel - 1), 2, 7)
        : 0;

    S.civilians = [];
    for (let i = 0; i < n; i++) {
      S.civilians.push({
        id: i + 1,
        x: 260 + (i % 3) * 180 + rand(-20, 20),
        y: 140 + Math.floor(i / 3) * 160 + rand(-20, 20),
        hp: 100,
        alive: true,
        evac: false,
      });
    }
    S.evacDone = 0;
  }

  function pickTigerType() {
    const r = Math.random();
    if (S.mode === "Survival") {
      if (r < 0.25) return TIGER_TYPES[0];
      if (r < 0.55) return TIGER_TYPES[2];
      if (r < 0.8) return TIGER_TYPES[3];
      if (r < 0.93) return TIGER_TYPES[1];
      return TIGER_TYPES[4];
    }
    if (r < 0.2) return TIGER_TYPES[0];
    if (r < 0.55) return TIGER_TYPES[1];
    if (r < 0.7) return TIGER_TYPES[2];
    if (r < 0.88) return TIGER_TYPES[3];
    return TIGER_TYPES[4];
  }

  function spawnTigers() {
    let count = 3;
    if (S.mode === "Story") count = clamp(3 + Math.floor((S.storyLevel - 1) * 0.5), 3, 10);
    if (S.mode === "Arcade") count = clamp(4 + Math.floor((S.arcadeLevel - 1) * 0.6), 4, 12);
    if (S.mode === "Survival") count = clamp(4 + (S.survivalWave - 1), 4, 14);

    S.tigers = [];
    for (let i = 0; i < count; i++) {
      const def = pickTigerType();
      const hp = def.hp + (S.mode === "Survival" ? (S.survivalWave - 1) * 10 : 0);
      S.tigers.push({
        id: i + 1,
        type: def.key,
        x: 620 + (i % 4) * 90,
        y: 140 + Math.floor(i / 4) * 120,
        vx: (Math.random() < 0.5 ? -1 : 1) * def.spd * 0.6,
        vy: (Math.random() < 0.5 ? -1 : 1) * def.spd * 0.5,
        spd: def.spd,
        hp,
        hpMax: hp,
        alive: true,
        civBias: def.civBias,
        tranqTagged: false,
        asleep: false,
        sleepUntil: 0,
      });
    }
  }

  function deploy() {
    S.gameOver = false;
    S.missionEnded = false;
    S.inBattle = false;
    S.activeTigerId = null;

    S.paused = false;
    S.me = { x: 140, y: 420 };
    S.target = null;
    S.lockedTigerId = null;

    S.hp = 100;
    S.armor = 20;
    S.stamina = 100;

    if (S.mode !== "Survival") S.evacZone = randomEvacZone();
    spawnCivilians();
    spawnTigers();

    // reset mag to weapon cap if needed
    const w = weapon();
    S.mag.cap = w.mag;
    if (S.mag.loaded > S.mag.cap) S.mag.loaded = S.mag.cap;
    if (S.mag.loaded <= 0) autoReload(true);

    if (S.mode === "Survival") {
      S.survivalStart = Date.now();
      S.surviveSeconds = 0;
    }

    save();
    renderHUD();
  }

  // ---------- UI actions ----------
  window.openMode = () => {
    if (!allowAction("OPEN_MODE")) return;
    S.paused = true;
    $("modeOverlay").style.display = "flex";
    markModeTabs();
    updateModeDesc();
    save();
  };

  window.closeMode = () => {
    $("modeOverlay").style.display = "none";
    S.paused = false;
    save();
  };

  window.setMode = (m) => {
    if (!allowAction("SET_MODE")) return;
    if (!MODES.includes(m)) return;
    S.mode = m;
    S.storyLevel = 1;
    S.arcadeLevel = 1;
    S.survivalWave = 1;
    deploy();
    markModeTabs();
    updateModeDesc();
    save();
  };

  window.deploy = () => {
    if (!allowAction("DEPLOY")) return;
    deploy();
    window.Tutorial?.onDeploy?.();
  };

  window.togglePause = () => {
    if (!allowAction("TOGGLE_PAUSE")) return;
    if (S.gameOver) return;
    if (S.inBattle) return toast("Finish battle first.");
    S.paused = !S.paused;
    $("pauseLbl").textContent = S.paused ? "Resume" : "Pause";
    save();
  };

  window.resetGame = () => {
    if (!allowAction("RESET_GAME")) return;
    localStorage.removeItem(STORAGE_KEY);
    S = structuredClone(DEFAULT);
    window.S = S;
    save();
    toast("Reset ✅");
    window.openMode();
    renderHUD();
  };

  // ---------- Shop / Inventory ----------
  let shopTab = "weapons";

  window.openShop = () => {
    if (!allowAction("OPEN_SHOP")) return;
    if (S.gameOver) return;
    S.paused = true;
    $("shopOverlay").style.display = "flex";
    setShopTab(shopTab);
    save();
  };
  window.closeShop = () => {
    $("shopOverlay").style.display = "none";
    S.paused = false;
    save();
  };

  window.openInventory = () => {
    if (!allowAction("OPEN_INVENTORY")) return;
    if (S.gameOver) return;
    S.paused = true;
    $("invOverlay").style.display = "flex";
    renderInventory();
    save();
  };
  window.closeInventory = () => {
    $("invOverlay").style.display = "none";
    S.paused = false;
    save();
  };

  window.setShopTab = (t) => setShopTab(t);

  function setShopTab(t) {
    shopTab = t;
    ["tabWeapons", "tabAmmo", "tabMeds"].forEach((id) => $(id).classList.remove("active"));
    if (t === "weapons") $("tabWeapons").classList.add("active");
    if (t === "ammo") $("tabAmmo").classList.add("active");
    if (t === "meds") $("tabMeds").classList.add("active");
    renderShop();
  }

  function renderShop() {
    $("shopMoney").textContent = S.funds.toLocaleString();
    const list = $("shopList");
    if (shopTab === "weapons") {
      list.innerHTML = WEAPONS.map((w) => {
        const owned = S.ownedWeapons.includes(w.id);
        return `
          <div class="item">
            <div>
              <div class="itemName">${w.name} <span class="tag">${w.type}</span> <span class="tag">${owned ? "Owned" : "Not owned"}</span></div>
              <div class="itemDesc">Mag ${w.mag} • Damage ${w.dmg[0]}–${w.dmg[1]}</div>
            </div>
            <div style="text-align:right">
              <div class="price">$${w.price.toLocaleString()}</div>
              <button ${owned ? "disabled" : ""} onclick="buyWeapon('${w.id}')">${owned ? "Owned" : "Buy"}</button>
              <button class="ghost" ${owned ? "" : "disabled"} onclick="equipWeapon('${w.id}')">Equip</button>
            </div>
          </div>
        `;
      }).join("");
      return;
    }
    if (shopTab === "ammo") {
      list.innerHTML = AMMO.map((a) => {
        const owned = S.ammoReserve[a.id] || 0;
        return `
          <div class="item">
            <div>
              <div class="itemName">${a.name} <span class="tag">Owned: ${owned}</span></div>
              <div class="itemDesc">+${a.pack} reserve</div>
            </div>
            <div style="text-align:right">
              <div class="price">$${a.price.toLocaleString()}</div>
              <button onclick="buyAmmo('${a.id}')">Buy</button>
            </div>
          </div>
        `;
      }).join("");
      return;
    }
    // meds
    list.innerHTML = MEDS.map((m) => {
      const owned = S.meds[m.id] || 0;
      return `
        <div class="item">
          <div>
            <div class="itemName">${m.name} <span class="tag">Owned: ${owned}</span></div>
            <div class="itemDesc">Heals +${m.heal}</div>
          </div>
          <div style="text-align:right">
            <div class="price">$${m.price.toLocaleString()}</div>
            <button onclick="buyMed('${m.id}')">Buy</button>
          </div>
        </div>
      `;
    }).join("");
  }

  window.buyWeapon = (id) => {
    if (!allowAction("BUY_WEAPON")) return;
    const w = getWeapon(id);
    if (S.ownedWeapons.includes(id)) return toast("Already owned.");
    if (S.funds < w.price) return toast("Not enough money.");
    S.funds -= w.price;
    S.ownedWeapons.push(id);
    save();
    renderShop();
    renderHUD();
  };

  window.buyAmmo = (id) => {
    if (!allowAction("BUY_AMMO")) return;
    const a = AMMO.find((x) => x.id === id);
    if (!a) return;
    if (S.funds < a.price) return toast("Not enough money.");
    S.funds -= a.price;
    S.ammoReserve[id] = (S.ammoReserve[id] || 0) + a.pack;
    save();
    renderShop();
    renderHUD();
  };

  window.buyMed = (id) => {
    if (!allowAction("BUY_MED")) return;
    const m = MEDS.find((x) => x.id === id);
    if (!m) return;
    if (S.funds < m.price) return toast("Not enough money.");
    S.funds -= m.price;
    S.meds[id] = (S.meds[id] || 0) + 1;
    save();
    renderShop();
    renderHUD();
  };

  window.equipWeapon = (id) => {
    if (!allowAction("EQUIP_WEAPON")) return;
    if (!S.ownedWeapons.includes(id)) return;
    S.equippedWeaponId = id;
    const w = weapon();
    S.mag.cap = w.mag;
    S.mag.loaded = clamp(S.mag.loaded, 0, S.mag.cap);
    if (S.mag.loaded === 0) autoReload(true);
    save();
    renderHUD();
    renderInventory();
    window.Tutorial?.onEquip?.(id);
  };

  function renderInventory() {
    const w = weapon();
    const aid = ammoIdForEquipped();
    $("invSummary").innerHTML = `
      <b>Money:</b> $${S.funds.toLocaleString()} • <b>Score:</b> ${S.score.toLocaleString()}<br/>
      <b>HP:</b> ${Math.round(S.hp)}/100 • <b>Armor:</b> ${Math.round(S.armor)}/100 • <b>Lives:</b> ${S.lives}<br/>
      <b>Equipped:</b> ${w.name} • <b>Ammo:</b> ${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[aid] || 0})
    `;

    $("invWeapons").innerHTML = S.ownedWeapons
      .map((id) => {
        const ww = getWeapon(id);
        const active = id === S.equippedWeaponId;
        return `
          <div class="item">
            <div>
              <div class="itemName">${active ? "✅ " : ""}${ww.name} <span class="tag">${ww.type}</span></div>
              <div class="itemDesc">Mag ${ww.mag} • Damage ${ww.dmg[0]}–${ww.dmg[1]}</div>
            </div>
            <div style="text-align:right">
              <button ${active ? "disabled" : ""} onclick="equipWeapon('${id}')">Equip</button>
            </div>
          </div>
        `;
      })
      .join("");

    const medsCount = Object.values(S.meds || {}).reduce((a, b) => a + (b || 0), 0);
    $("invSupplies").innerHTML = `
      <div class="item">
        <div>
          <div class="itemName">❤️ Med Kits <span class="tag">Owned: ${medsCount}</span></div>
          <div class="itemDesc">Use the best med kit you have.</div>
        </div>
        <div style="text-align:right">
          <button ${medsCount <= 0 ? "disabled" : ""} onclick="useMed()">Use</button>
          <button class="ghost" onclick="openShop()">Buy</button>
        </div>
      </div>
    `;
  }

  window.useMed = () => {
    if (!allowAction("USE_MED")) return;

    // tutorial can “simulate” using items
    if (window.Tutorial?.isActive?.()) {
      if (!window.Tutorial.consume("MEDKIT")) return;
    }

    if (S.hp >= 100) return toast("HP already full.");
    const pick = (S.meds.MED_MED || 0) > 0 ? "MED_MED" : (S.meds.MED_SMALL || 0) > 0 ? "MED_SMALL" : null;
    if (!pick) return toast("No medkits.");
    const m = MEDS.find((x) => x.id === pick);
    S.meds[pick] -= 1;
    S.hp = clamp(S.hp + m.heal, 0, 100);
    save();
    renderHUD();
    renderInventory();
    toast(`Healed +${m.heal}`);
  };

  // ---------- Mode overlay helpers ----------
  function markModeTabs() {
    ["mStory", "mArcade", "mSurvival"].forEach((id) => $(id).classList.remove("active"));
    if (S.mode === "Story") $("mStory").classList.add("active");
    if (S.mode === "Arcade") $("mArcade").classList.add("active");
    if (S.mode === "Survival") $("mSurvival").classList.add("active");
  }

  function updateModeDesc() {
    const el = $("modeDesc");
    if (S.mode === "Story") el.textContent = "Story: Save + evacuate civilians. Clear all tigers to finish.";
    if (S.mode === "Arcade") el.textContent = "Arcade: Faster pacing. Civilians still present. Clear all tigers + evacuate.";
    if (S.mode === "Survival") el.textContent = "Survival: No civilians. Survive as long as possible while tigers pressure you.";
  }

  // ---------- Scanning ----------
  window.scan = () => {
    if (!allowAction("SCAN")) return;
    if (S.paused) return toast("Resume to scan.");
    if (S.inBattle) return toast("Finish battle first.");
    if (S.stamina < 12) return toast("Not enough stamina.");
    S.stamina -= 12;
    S.scanPing = 140;
    save();
    renderHUD();
    window.Tutorial?.onScan?.();
  };

  // ---------- Reload ----------
  function autoReload(force = false) {
    const aid = ammoIdForEquipped();
    if (!force && S.mag.loaded > 0) return true;
    const reserve = S.ammoReserve[aid] || 0;
    if (reserve <= 0) return false;
    const need = S.mag.cap - S.mag.loaded;
    const take = Math.min(need, reserve);
    S.mag.loaded += take;
    S.ammoReserve[aid] = reserve - take;
    return true;
  }

  // ---------- Engage & Battle ----------
  window.engage = () => {
    if (!allowAction("ENGAGE")) return;
    if (S.paused) return toast("Resume to engage.");
    if (S.inBattle) return;
    if (S.gameOver) return;

    const t = getTargetTiger();
    if (!t) return toast("No tiger nearby.");
    if (dist(S.me.x, S.me.y, t.x, t.y) > 95) return toast("Get closer to the tiger.");

    S.inBattle = true;
    S.activeTigerId = t.id;
    $("battleOverlay").style.display = "flex";
    renderBattle();
    save();
    window.Tutorial?.onEngage?.();
  };

  window.closeBattle = () => {
    $("battleOverlay").style.display = "none";
    S.inBattle = false;
    S.activeTigerId = null;
    save();
  };

  function getTigerById(id) {
    return S.tigers.find((x) => x.id === id);
  }

  function getTargetTiger() {
    const locked = getTigerById(S.lockedTigerId);
    if (locked && locked.alive) return locked;
    const alive = S.tigers.filter((x) => x.alive);
    if (!alive.length) return null;
    // nearest
    let best = alive[0], bd = 1e9;
    for (const t of alive) {
      const d = dist(S.me.x, S.me.y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  function battleTiger() {
    return getTigerById(S.activeTigerId);
  }

  function renderBattle() {
    const t = battleTiger();
    if (!t) {
      window.closeBattle();
      return;
    }
    $("battleTitle").textContent = `Tiger: ${t.type} (#${t.id})`;
    $("battleHP").textContent = `${Math.max(0, Math.round(t.hp))} / ${t.hpMax}`;
    $("playerHP").textContent = `${Math.max(0, Math.round(S.hp))} / 100`;
    $("battleAmmo").textContent = `${S.mag.loaded}/${S.mag.cap} (reserve ${S.ammoReserve[ammoIdForEquipped()] || 0})`;
    $("btnShoot").textContent = weapon().type === "tranq" ? "Tranq" : "Shoot";
  }

  window.battleReload = () => {
    if (!allowAction("BATTLE_RELOAD")) return;
    if (window.Tutorial?.isActive?.()) {
      if (!window.Tutorial.consume("RELOAD")) return;
    }
    const ok = autoReload(true);
    if (!ok) toast("No reserve ammo.");
    renderBattle();
    renderHUD();
    save();
  };

  window.battleShoot = () => {
    if (!allowAction("BATTLE_SHOOT")) return;

    const t = battleTiger();
    if (!t || !t.alive) return;

    if (S.mag.loaded <= 0) {
      toast("Empty mag. Reload.");
      return;
    }

    S.mag.loaded -= 1;

    const w = weapon();
    const dmg = rand(w.dmg[0], w.dmg[1]);

    if (w.type === "tranq") {
      // tranq makes tiger fall asleep if tagged enough
      t.tranqTagged = true;
      t.hp -= Math.floor(dmg * 0.55);
      if (t.hp <= t.hpMax * 0.35 && !t.asleep) {
        t.asleep = true;
        t.sleepUntil = Date.now() + 6000; // 6 seconds asleep
        toast("Tiger fell asleep! ✅ Capture window!");
        window.Tutorial?.onTranqSleep?.();
      } else {
        toast("Tranq hit.");
      }
    } else {
      t.hp -= dmg;
      toast(`Hit for ${dmg}`);
    }

    // tiger counter-attacks if not asleep
    tigerCounter(t);

    if (t.hp <= 0) {
      t.alive = false;
      toast("Tiger down.");
      S.score += 250;
      S.funds += 150;
      // close battle
      window.closeBattle();
      checkMissionEnd();
    } else {
      renderBattle();
    }

    save();
    renderHUD();
    window.Tutorial?.onShoot?.();
  };

  window.capture = () => {
    if (!allowAction("CAPTURE")) return;

    const t = battleTiger();
    if (!t || !t.alive) return;

    if (!t.asleep || Date.now() > t.sleepUntil) {
      toast("Tiger not asleep. Use tranq first.");
      return;
    }

    // capture success
    t.alive = false;
    toast("Captured! 🐅✅");
    S.score += 500;
    S.funds += 350;

    window.closeBattle();
    checkMissionEnd();
    save();
    renderHUD();
    window.Tutorial?.onCapture?.();
  };

  function tigerCounter(t) {
    if (t.asleep && Date.now() < t.sleepUntil) return;

    const hit = rand(8, 14) + (t.type === "Alpha" ? 4 : 0);
    // armor first
    if (S.armor > 0) {
      const used = Math.min(S.armor, hit);
      S.armor -= used;
      const spill = hit - used;
      if (spill > 0) S.hp -= spill;
    } else {
      S.hp -= hit;
    }
    if (S.hp <= 0) playerDown();
  }

  function playerDown() {
    S.lives -= 1;
    if (S.lives > 0) {
      toast(`You went down. Respawned. Lives left: ${S.lives}`);
      S.hp = 100;
      S.armor = 20;
      // exit battle
      window.closeBattle();
      S.me = { x: 140, y: 420 };
    } else {
      S.gameOver = true;
      S.paused = true;
      $("overOverlay").style.display = "flex";
      $("overText").textContent = "GAME OVER\n\nRestart or Reset?";
      $("battleOverlay").style.display = "none";
    }
    save();
    renderHUD();
  }

  window.restartCurrentMission = () => {
    if (!allowAction("RESTART_MISSION")) return;
    $("overOverlay").style.display = "none";
    deploy();
  };

  // ---------- Movement / click ----------
  cv.addEventListener("click", (e) => {
    if (S.paused || S.inBattle || S.gameOver) return;
    if (!allowAction("CANVAS_TAP")) return;

    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * (cv.width / r.width);
    const y = (e.clientY - r.top) * (cv.height / r.height);

    // tutorial hook
    window.Tutorial?.onCanvasTap?.(x, y);

    const tappedTiger = S.tigers.find((t) => t.alive && dist(x, y, t.x, t.y) < 34);
    if (tappedTiger) {
      S.lockedTigerId = tappedTiger.id;
      toast(`Locked tiger #${tappedTiger.id}`);
      save();
      return;
    }

    S.target = { x, y };
    save();
  });

  function movePlayer() {
    if (!S.target) return;
    if (S.stamina <= 0) return;

    const dx = S.target.x - S.me.x;
    const dy = S.target.y - S.me.y;
    const d = Math.hypot(dx, dy);

    if (d < 6) {
      S.target = null;
      return;
    }

    const speed = 2.8;
    S.me.x += (dx / d) * speed;
    S.me.y += (dy / d) * speed;

    // stamina drain
    S.stamina = clamp(S.stamina - 0.08, 0, 100);
  }

  // ---------- Civilians / evac ----------
  function updateCivilians() {
    if (S.mode === "Survival") return;

    // civilians wander slightly
    for (const c of S.civilians) {
      if (!c.alive || c.evac) continue;
      c.x += rand(-1, 1) * 0.6;
      c.y += rand(-1, 1) * 0.6;
      c.x = clamp(c.x, 60, 980);
      c.y = clamp(c.y, 60, 560);

      // evac check
      if (dist(c.x, c.y, S.evacZone.x, S.evacZone.y) < S.evacZone.r) {
        c.evac = true;
        S.evacDone += 1;
        S.score += 50;
      }
    }

    // tigers may hit civilians
    for (const t of S.tigers) {
      if (!t.alive) continue;
      if (t.asleep && Date.now() < t.sleepUntil) continue;

      // pick nearest civilian sometimes
      const aliveCivs = S.civilians.filter((c) => c.alive && !c.evac);
      if (!aliveCivs.length) break;

      const goCiv = Math.random() < t.civBias;
      if (!goCiv) continue;

      let best = aliveCivs[0], bd = 1e9;
      for (const c of aliveCivs) {
        const d = dist(t.x, t.y, c.x, c.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (bd < 40) {
        best.hp -= rand(4, 8) + (t.type === "Alpha" ? 3 : 0);
        if (best.hp <= 0) best.alive = false;
      }
    }
  }

  // ---------- Tiger movement ----------
  function updateTigers() {
    for (const t of S.tigers) {
      if (!t.alive) continue;

      if (t.asleep && Date.now() < t.sleepUntil) continue;
      if (t.asleep && Date.now() >= t.sleepUntil) t.asleep = false;

      // simple bounce movement
      t.x += t.vx;
      t.y += t.vy;

      if (t.x < 60 || t.x > 980) t.vx *= -1;
      if (t.y < 60 || t.y > 560) t.vy *= -1;

      // drift slightly toward player sometimes
      if (Math.random() < 0.02) {
        const dx = S.me.x - t.x;
        const dy = S.me.y - t.y;
        const d = Math.hypot(dx, dy) || 1;
        t.vx = (dx / d) * t.spd * 0.6;
        t.vy = (dy / d) * t.spd * 0.55;
      }
    }
  }

  // ---------- Mission end ----------
  function allTigersCleared() {
    return S.tigers.every((t) => !t.alive);
  }
  function allCivsHandled() {
    // living civs must be evacuated in Story/Arcade
    return S.civilians.every((c) => !c.alive || c.evac);
  }

  function checkMissionEnd() {
    if (!allTigersCleared()) return;

    if (S.mode === "Survival") {
      // survival wave clear => next wave option
      showComplete("Wave cleared! Start next wave?");
      return;
    }

    if (!allCivsHandled()) {
      toast("Tigers cleared! Evacuate remaining civilians.");
      return;
    }

    showComplete("Mission complete! Start next mission?");
  }

  function showComplete(text) {
    S.missionEnded = true;
    S.paused = true;
    $("completeText").textContent = text;
    $("completeOverlay").style.display = "flex";
    save();
  }

  window.closeComplete = () => {
    $("completeOverlay").style.display = "none";
    S.paused = false;
    save();
  };

  window.startNextMission = () => {
    if (!allowAction("START_NEXT_MISSION")) return;
    $("completeOverlay").style.display = "none";

    if (S.mode === "Story") S.storyLevel += 1;
    if (S.mode === "Arcade") S.arcadeLevel += 1;
    if (S.mode === "Survival") S.survivalWave += 1;

    deploy();
    toast("Next mission started.");
    save();
  };

  // ---------- HUD ----------
  function renderHUD() {
    $("money").textContent = S.funds.toLocaleString();
    $("score").textContent = S.score.toLocaleString();
    $("modeLbl").textContent =
      S.mode === "Story"
        ? `Story L${S.storyLevel}`
        : S.mode === "Arcade"
        ? `Arcade L${S.arcadeLevel}`
        : `Survival W${S.survivalWave}`;

    $("hp").textContent = `${Math.round(S.hp)}/100`;
    $("armor").textContent = `${Math.round(S.armor)}/100`;
    $("stamina").textContent = `${Math.round(S.stamina)}/100`;
    $("lives").textContent = `${S.lives}`;

    const w = weapon();
    const aid = ammoIdForEquipped();
    $("weapon").textContent = w.name;
    $("ammo").textContent = `${S.mag.loaded}/${S.mag.cap} (R ${S.ammoReserve[aid] || 0})`;

    $("pauseLbl").textContent = S.paused ? "Resume" : "Pause";
  }

  // ---------- Render ----------
  function draw() {
    // background
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "#0b0d12";
    ctx.fillRect(0, 0, cv.width, cv.height);

    // map bounds
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 40, 960, 540);

    // scan ping
    if (S.scanPing > 0) {
      const a = S.scanPing / 140;
      ctx.beginPath();
      ctx.arc(S.me.x, S.me.y, (1 - a) * 320, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(80,200,255,${0.25 * a})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // evac zone
    if (S.mode !== "Survival") {
      ctx.beginPath();
      ctx.arc(S.evacZone.x, S.evacZone.y, S.evacZone.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(80,255,160,0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(80,255,160,0.22)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(80,255,160,0.85)";
      ctx.font = "14px system-ui";
      ctx.fillText("EVAC", S.evacZone.x - 18, S.evacZone.y + 5);
    }

    // civilians
    if (S.mode !== "Survival") {
      for (const c of S.civilians) {
        if (!c.alive) continue;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = c.evac ? "rgba(80,255,160,0.9)" : "rgba(255,255,255,0.8)";
        ctx.fill();

        // hp bar
        if (!c.evac) {
          ctx.fillStyle = "rgba(255,255,255,0.15)";
          ctx.fillRect(c.x - 16, c.y - 22, 32, 5);
          ctx.fillStyle = "rgba(80,255,160,0.85)";
          ctx.fillRect(c.x - 16, c.y - 22, 32 * clamp(c.hp / 100, 0, 1), 5);
        }
      }
    }

    // tigers
    for (const t of S.tigers) {
      if (!t.alive) continue;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 18, 0, Math.PI * 2);
      ctx.fillStyle = t.asleep && Date.now() < t.sleepUntil ? "rgba(255,200,80,0.95)" : "rgba(255,120,80,0.95)";
      ctx.fill();

      // lock ring
      if (S.lockedTigerId === t.id) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 26, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // hp bar
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(t.x - 22, t.y - 30, 44, 6);
      ctx.fillStyle = "rgba(255,80,80,0.9)";
      ctx.fillRect(t.x - 22, t.y - 30, 44 * clamp(t.hp / t.hpMax, 0, 1), 6);

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "12px system-ui";
      ctx.fillText(t.type, t.x - 18, t.y + 36);
    }

    // player
    ctx.beginPath();
    ctx.arc(S.me.x, S.me.y, 16, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(80,170,255,0.95)";
    ctx.fill();

    // target marker
    if (S.target) {
      ctx.beginPath();
      ctx.arc(S.target.x, S.target.y, 7, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function tick(now) {
    const dt = now - last;
    last = now;

    if (!S.paused && !S.inBattle && !S.gameOver) {
      movePlayer();
      updateTigers();
      updateCivilians();

      // stamina regen
      S.stamina = clamp(S.stamina + 0.12, 0, 100);

      // survival timer pressure
      if (S.mode === "Survival" && S.survivalStart) {
        S.surviveSeconds = Math.floor((Date.now() - S.survivalStart) / 1000);
        if (Math.random() < 0.01) {
          // random pressure tick
          const hit = rand(2, 5);
          if (S.armor > 0) S.armor = Math.max(0, S.armor - hit);
          else S.hp -= hit;
          if (S.hp <= 0) playerDown();
        }
      }

      // scan decay
      if (S.scanPing > 0) S.scanPing -= 1;

      // check if mission should end (tigers cleared)
      if (!S.missionEnded) checkMissionEnd();

      // autosave occasionally
      if (Math.random() < 0.02) save();
    }

    draw();
    renderHUD();
    if (S.inBattle) renderBattle();

    requestAnimationFrame(tick);
  }

  // ---------- Initial UI wiring ----------
  // Start in mode overlay if first run
  function firstRunCheck() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      $("modeOverlay").style.display = "flex";
      S.paused = true;
      markModeTabs();
      updateModeDesc();
      save();
    }
  }

  // expose about overlay (optional)
  window.openAbout = () => {
    if (!allowAction("OPEN_ABOUT")) return;
    S.paused = true;
    $("aboutOverlay").style.display = "flex";
    $("aboutBody").innerHTML = `
      <div class="hudLine"><b>Tap</b> to move. Tap a tiger to <b>lock</b> it.</div>
      <div class="hudLine"><b>Scan</b> shows a ping ring.</div>
      <div class="hudLine"><b>Engage</b> near a tiger to start battle.</div>
      <div class="hudLine"><b>Tranq</b> can put tigers asleep → <b>Capture</b>.</div>
      <div class="hudLine"><b>Story/Arcade:</b> evacuate living civilians + clear tigers.</div>
      <div class="hudLine"><b>Survival:</b> no civilians, survive as long as possible.</div>
    `;
    save();
  };
  window.closeAbout = () => {
    $("aboutOverlay").style.display = "none";
    S.paused = false;
    save();
  };

  // lock engage button press from HUD
  window.tryEngage = () => window.engage();

  // Hook for tutorial start button (in tutorial overlay)
  window.startTutorial = () => {
    if (window.Tutorial?.start) window.Tutorial.start();
  };

  // ---------- boot ----------
  renderHUD();
  firstRunCheck();
  requestAnimationFrame(tick);
})();
