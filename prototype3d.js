/* prototype3d.js
 * Tiger Strike 3D Prototype (safe overlay path)
 * - Keeps Story/Arcade/Survival untouched
 * - Adds a separate full-screen 3D mode launched from Mode menu
 */
(function(){
  "use strict";

  const THREE_SRC_PRIMARY = "https://unpkg.com/three@0.160.1/build/three.min.js";
  const THREE_SRC_FALLBACK = "https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.min.js";

  const CHUNK_SIZE = 120;
  const CHUNK_KEEP_RADIUS = 3;
  const CHUNK_DROP_RADIUS = 4;
  const PERF_EVAL_MS = 1600;
  const PERF_HUD_MIN_MS = 90;
  const PERF_HUD_MAX_MS = 180;

  const QUALITY_PRESETS = {
    high:{
      key:"high",
      maxDpr:1.35,
      keepRadius:3,
      dropRadius:4,
      chunkBuildPerFrame:2,
      hudIntervalMs:90,
      healthBarEveryNFrames:1,
      antialias:true,
      roadBase:1, roadVar:2,
      houseBase:1, houseVar:2,
      carBase:2, carVar:3,
      treeBase:14, treeVar:12,
      pondChance:0.38,
    },
    med:{
      key:"med",
      maxDpr:1.0,
      keepRadius:3,
      dropRadius:4,
      chunkBuildPerFrame:1,
      hudIntervalMs:120,
      healthBarEveryNFrames:1,
      antialias:true,
      roadBase:1, roadVar:2,
      houseBase:1, houseVar:2,
      carBase:2, carVar:2,
      treeBase:11, treeVar:8,
      pondChance:0.26,
    },
    low:{
      key:"low",
      maxDpr:0.82,
      keepRadius:2,
      dropRadius:3,
      chunkBuildPerFrame:1,
      hudIntervalMs:180,
      healthBarEveryNFrames:2,
      antialias:false,
      roadBase:1, roadVar:1,
      houseBase:1, houseVar:1,
      carBase:1, carVar:2,
      treeBase:7, treeVar:6,
      pondChance:0.16,
    },
  };

  const PLAYER_BASE_SPEED = 16;
  const PLAYER_SPRINT_SPEED = 26;
  const PLAYER_ROLL_SPEED = 42;
  const PLAYER_ATTACK_RANGE = 34;
  const PLAYER_CAPTURE_RANGE = 22;
  const PLAYER_ATTACK_COOLDOWN_MS = 340;
  const PLAYER_CAPTURE_COOLDOWN_MS = 460;
  const COMBAT_LOCK_RANGE = 42;
  const COMBAT_MELEE_LANE_RANGE = 10;
  const COMBAT_MIN_SEPARATION = 3.1;
  const TIGER_WINDUP_MS = 420;
  const TIGER_MELEE_WINDUP_MS = 220;

  const CIV_FOLLOW_DISTANCE = 7.2;
  const CIV_PICKUP_RADIUS = 8.2;
  const SAFE_ZONE_RADIUS = 12;

  const TIGER_TYPES = [
    { name:"Standard", maxHp:120, speed:10.6, damage:9,  color:0xf59e0b, pounce:1.8 },
    { name:"Scout",    maxHp:105, speed:12.8, damage:8,  color:0xfbbf24, pounce:2.0 },
    { name:"Stalker",  maxHp:138, speed:11.9, damage:11, color:0xf97316, pounce:2.15 },
    { name:"Berserker",maxHp:162, speed:11.2, damage:13, color:0xfb7185, pounce:2.35 },
    { name:"Alpha",    maxHp:196, speed:12.2, damage:16, color:0xf43f5e, pounce:2.55 },
  ];

  const state = {
    ready:false,
    opening:false,
    active:false,
    threeLoadingPromise:null,
    pauseBefore: { paused:false, reason:null },
    raf:0,
    now:0,
    dt:0,
    three:null,
    renderer:null,
    scene:null,
    camera:null,
    clock:null,
    raycaster:null,
    pointer2D:null,
    root:null,
    worldRoot:null,
    chunkRoot:null,
    unitsRoot:null,
    effectsRoot:null,
    canvasHost:null,
    overlay:null,
    ui:{},
    controls:{
      moveX:0,
      moveY:0,
      sprintHold:false,
      keyboard:Object.create(null),
      joystickPointerId:null,
      joystickCenterX:0,
      joystickCenterY:0,
      joystickActive:false,
    },
    player:null,
    squad:[],
    civilians:[],
    tigers:[],
    selectedTiger:null,
    tigerPickRoots:[],
    chunks:new Map(),
    chunkQueue:[],
    chunkQueued:new Set(),
    currentChunkX:null,
    currentChunkZ:null,
    nextChunkSweepAt:0,
    liveUnitsCache:[],
    safeZone:null,
    fx:{
      shieldUntil:0,
      rollUntil:0,
      sprintUntil:0,
      nextAttackAt:0,
      nextCaptureAt:0,
      dodgeAngle:0,
    },
    combat:{
      active:false,
      target:null,
      targetStatus:"",
      lockBlend:0,
      pounceFxUntil:0,
    },
    mission:{
      totalCivilians:0,
      totalTigers:0,
      rescued:0,
      captured:0,
      killed:0,
      clearAnnounced:false,
    },
    statusText:"3D prototype loaded. Move to civilians, then escort to safe zone.",
    statusUntil:0,
    perf:{
      tier:"med",
      preset:QUALITY_PRESETS.med,
      frameAccumMs:0,
      frameCount:0,
      evalAt:0,
      avgMs:16.7,
      lowHits:0,
      highHits:0,
      frameNo:0,
      hudLastAt:0,
      lastHud:{
        mission:"",
        agent:"",
        tiger:"",
        duel:"",
        duelYou:"",
        duelTiger:"",
        status:"",
        hint:"",
        shieldLabel:"",
      },
    },
  };

  function el(id){ return document.getElementById(id); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function smoothStep(current, target, lambda, dt){ return lerp(current, target, 1 - Math.exp(-lambda * dt)); }

  function nowMs(){
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function hash01(ix, iz, k){
    let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(k | 0, 1442695);
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177);
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
  }

  function detectInitialQualityTier(){
    const cores = Number(navigator.hardwareConcurrency || 4);
    const mem = Number(navigator.deviceMemory || 4);
    if(cores <= 4 || mem <= 3) return "low";
    if(cores <= 6 || mem <= 6) return "med";
    return "high";
  }

  function qualityPreset(){
    return state.perf.preset || QUALITY_PRESETS.med;
  }

  function setRendererDprByQuality(){
    if(!state.renderer) return;
    const preset = qualityPreset();
    const maxDpr = clamp(Number(preset.maxDpr || 1), 0.62, 1.5);
    const target = Math.min(window.devicePixelRatio || 1, maxDpr);
    state.renderer.setPixelRatio(target);
  }

  function applyQualityTier(tier, reason=""){
    const next = QUALITY_PRESETS[tier] || QUALITY_PRESETS.med;
    if(state.perf.tier === next.key && state.perf.preset === next) return;
    state.perf.tier = next.key;
    state.perf.preset = next;
    setRendererDprByQuality();
    state.perf.hudLastAt = 0;
    if(reason){
      setStatus(`3D performance mode: ${next.key.toUpperCase()}.`, 1200);
    }
  }

  function evaluatePerformanceTier(){
    const now = state.now;
    if(!state.perf.evalAt) state.perf.evalAt = now;
    state.perf.frameAccumMs += state.dt * 1000;
    state.perf.frameCount += 1;
    if((now - state.perf.evalAt) < PERF_EVAL_MS) return;

    const avg = state.perf.frameAccumMs / Math.max(1, state.perf.frameCount);
    state.perf.avgMs = avg;
    state.perf.frameAccumMs = 0;
    state.perf.frameCount = 0;
    state.perf.evalAt = now;

    if(avg > 24) state.perf.lowHits += 1;
    else state.perf.lowHits = Math.max(0, state.perf.lowHits - 1);

    if(avg < 17.2) state.perf.highHits += 1;
    else state.perf.highHits = Math.max(0, state.perf.highHits - 1);

    if(state.perf.tier === "high" && state.perf.lowHits >= 2){
      state.perf.lowHits = 0;
      applyQualityTier("med", "auto");
      return;
    }
    if(state.perf.tier === "med" && state.perf.lowHits >= 3){
      state.perf.lowHits = 0;
      applyQualityTier("low", "auto");
      return;
    }
    if(state.perf.tier === "low" && state.perf.highHits >= 4){
      state.perf.highHits = 0;
      applyQualityTier("med", "auto");
      return;
    }
    if(state.perf.tier === "med" && state.perf.highHits >= 5){
      state.perf.highHits = 0;
      applyQualityTier("high", "auto");
    }
  }

  function setStatus(text, holdMs=1800){
    state.statusText = String(text || "");
    state.statusUntil = nowMs() + holdMs;
    if(state.ui.hint){
      state.ui.hint.classList.remove("hidden");
      state.ui.hint.innerText = state.statusText;
    }
  }

  function ensureThreeLoaded(){
    if(window.THREE) return Promise.resolve(window.THREE);
    if(state.threeLoadingPromise) return state.threeLoadingPromise;

    const tryLoad = (src) => new Promise((resolve, reject)=>{
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = ()=> resolve(window.THREE || null);
      script.onerror = ()=> reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });

    state.threeLoadingPromise = tryLoad(THREE_SRC_PRIMARY)
      .catch(()=>tryLoad(THREE_SRC_FALLBACK))
      .then((THREE)=>{
        if(!THREE) throw new Error("THREE failed to load.");
        return THREE;
      });
    return state.threeLoadingPromise;
  }

  function mat(color, roughness=0.9, metalness=0.03){
    return new state.three.MeshStandardMaterial({ color, roughness, metalness });
  }

  function setupUIRefs(){
    state.overlay = el("proto3dOverlay");
    state.canvasHost = el("proto3dCanvasHost");
    state.ui = {
      hint: el("proto3dHint"),
      hudMission: el("proto3dHudMission"),
      hudAgent: el("proto3dHudAgent"),
      hudTiger: el("proto3dHudTiger"),
      duelHud: el("proto3dDuelHud"),
      duelYou: el("proto3dDuelYou"),
      duelTiger: el("proto3dDuelTiger"),
      landscapeHint: el("proto3dLandscapeHint"),
      attackBtn: el("proto3dAttackBtn"),
      captureBtn: el("proto3dCaptureBtn"),
      shieldBtn: el("proto3dShieldBtn"),
      rollBtn: el("proto3dRollBtn"),
      sprintBtn: el("proto3dSprintBtn"),
      resetBtn: el("proto3dResetBtn"),
      closeBtn: el("proto3dCloseBtn"),
      joyBase: el("proto3dJoyBase"),
      joyKnob: el("proto3dJoyKnob"),
      joyArea: el("proto3dJoyArea"),
    };
  }

  function setPauseForPrototype(on){
    if(typeof window.setPaused === "function"){
      window.setPaused(!!on, on ? "prototype3d" : null);
      return;
    }
    if(window.S) window.S.paused = !!on;
  }

  function rememberPauseState(){
    const S = window.S || {};
    state.pauseBefore.paused = !!S.paused;
    state.pauseBefore.reason = S.pauseReason || null;
  }

  function restorePauseState(){
    const reason = state.pauseBefore.reason;
    const shouldStayPaused = state.pauseBefore.paused && reason && reason !== "mode";
    if(typeof window.setPaused === "function"){
      window.setPaused(shouldStayPaused, shouldStayPaused ? reason : null);
      return;
    }
    if(window.S) window.S.paused = shouldStayPaused;
  }

  function worldPos(obj){
    return obj.mesh ? obj.mesh.position : obj.position;
  }

  function horizontalDistance(a, b){
    const pa = worldPos(a);
    const pb = worldPos(b);
    const dx = pa.x - pb.x;
    const dz = pa.z - pb.z;
    return Math.hypot(dx, dz);
  }

  function addHealthBar(unit, color=0x4ade80){
    const THREE = state.three;
    const bar = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.28),
      new THREE.MeshBasicMaterial({ color:0x0b1220, transparent:true, opacity:0.86, depthWrite:false })
    );
    const fg = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 0.2),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.96, depthWrite:false })
    );
    bg.renderOrder = 50;
    fg.renderOrder = 51;
    fg.position.z = 0.01;
    bar.add(bg);
    bar.add(fg);
    bar.position.y = 5.4;
    unit.mesh.add(bar);
    unit.healthBar = { root:bar, fill:fg, width:2.5 };
  }

  function updateHealthBar(unit){
    if(!unit || !unit.healthBar) return;
    const hpPct = clamp(unit.hp / Math.max(1, unit.maxHp), 0, 1);
    const w = unit.healthBar.width;
    unit.healthBar.fill.scale.x = hpPct;
    unit.healthBar.fill.position.x = -(w * (1 - hpPct)) * 0.5;
  }

  function orientHealthBarsToCamera(){
    if(!state.camera) return;
    const camQuat = state.camera.quaternion;
    const units = [state.player, ...state.squad, ...state.civilians, ...state.tigers];
    for(const unit of units){
      if(unit && unit.healthBar && unit.healthBar.root){
        unit.healthBar.root.quaternion.copy(camQuat);
      }
    }
  }

  function makeSoldierMesh(color=0x4f85ff){
    const THREE = state.three;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.25, 0.9), mat(color, 0.72, 0.05));
    body.position.y = 2.55;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 14), mat(0xf1d2b5, 0.8, 0.01));
    head.position.y = 4.1;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(0x445067, 0.55, 0.2));
    helmet.position.y = 4.28;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.4, 0.42), mat(color, 0.72, 0.05));
    const armR = armL.clone();
    armL.position.set(-1.02, 2.55, 0);
    armR.position.set(1.02, 2.55, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.65, 0.48), mat(0x1d3557, 0.8, 0.05));
    const legR = legL.clone();
    legL.position.set(-0.42, 1.02, 0);
    legR.position.set(0.42, 1.02, 0);
    const rifle = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.18), mat(0x2c384f, 0.55, 0.35));
    rifle.position.set(0.66, 2.28, 0.56);
    rifle.rotation.z = -0.3;
    g.add(body, head, helmet, armL, armR, legL, legR, rifle);
    g.userData = { armL, armR, legL, legR, animT:Math.random() * 6.283 };
    return g;
  }

  function makeCivilianMesh(color=0xf472b6){
    const THREE = state.three;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.4, 8, 12), mat(color, 0.75, 0.02));
    body.position.y = 2.2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 12), mat(0xf3d7bf, 0.85, 0.02));
    head.position.y = 3.65;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.1, 0.38), mat(0x243247, 0.8, 0.05));
    const legR = legL.clone();
    legL.position.set(-0.32, 0.85, 0);
    legR.position.set(0.32, 0.85, 0);
    g.add(body, head, legL, legR);
    g.userData = { legL, legR, animT:Math.random() * 6.283 };
    return g;
  }

  function makeTigerMesh(color=0xf59e0b){
    const THREE = state.three;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.85, 1.2, 1.15), mat(color, 0.68, 0.03));
    body.position.y = 1.35;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.05), mat(color, 0.68, 0.03));
    chest.position.set(1.52, 1.35, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.95), mat(0xf7b733, 0.68, 0.03));
    head.position.set(2.34, 1.6, 0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.25, 0.65), mat(0xfde68a, 0.62, 0.02));
    jaw.position.set(2.56, 1.25, 0);
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.22, 8), mat(0x111827, 0.7, 0.1));
    const earR = earL.clone();
    earL.position.set(2.04, 2.1, 0.26);
    earR.position.set(2.04, 2.1, -0.26);
    earL.rotation.z = -0.2;
    earR.rotation.z = -0.2;
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 1.75, 10), mat(0xf59e0b, 0.68, 0.03));
    tail.position.set(-1.86, 1.55, 0);
    tail.rotation.z = -1.1;
    const stripeMat = mat(0x1f2937, 0.8, 0.02);
    for(let i=0;i<5;i++){
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.88, 1.2), stripeMat);
      stripe.position.set(-0.72 + i * 0.58, 1.58, 0);
      stripe.rotation.z = (i % 2 ? -0.4 : 0.4);
      g.add(stripe);
    }
    const legGeom = new THREE.BoxGeometry(0.35, 0.85, 0.35);
    const legFL = new THREE.Mesh(legGeom, mat(0xf7b733, 0.68, 0.03));
    const legFR = legFL.clone();
    const legBL = legFL.clone();
    const legBR = legFL.clone();
    legFL.position.set(1.05, 0.55, 0.4);
    legFR.position.set(1.05, 0.55, -0.4);
    legBL.position.set(-1.1, 0.55, 0.4);
    legBR.position.set(-1.1, 0.55, -0.4);
    g.add(body, chest, head, jaw, earL, earR, tail, legFL, legFR, legBL, legBR);
    g.userData = { legFL, legFR, legBL, legBR, tail, animT:Math.random() * 6.283 };
    return g;
  }

  function createSafeZone(){
    const THREE = state.three;
    const g = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(SAFE_ZONE_RADIUS, 40),
      new THREE.MeshBasicMaterial({ color:0x34d399, transparent:true, opacity:0.26, depthWrite:false })
    );
    base.rotation.x = -Math.PI * 0.5;
    base.renderOrder = 20;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(SAFE_ZONE_RADIUS - 1.2, SAFE_ZONE_RADIUS - 0.4, 40),
      new THREE.MeshBasicMaterial({ color:0x4ade80, transparent:true, opacity:0.9, depthWrite:false })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.02;
    ring.renderOrder = 21;

    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 12, 14),
      new THREE.MeshBasicMaterial({ color:0x6ee7b7, transparent:true, opacity:0.22, depthWrite:false })
    );
    beacon.position.y = 6;
    beacon.renderOrder = 22;

    g.add(base, ring, beacon);
    g.position.set(180, 0, -180);
    g.userData = { ring };
    state.effectsRoot.add(g);
    state.safeZone = { mesh:g, radius:SAFE_ZONE_RADIUS };
  }

  function createSelectionRing(parent, color=0x60a5fa, r=2.1){
    const THREE = state.three;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.45, 32),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95, depthWrite:false, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.05;
    ring.visible = false;
    ring.renderOrder = 30;
    parent.add(ring);
    return ring;
  }

  function createTelegraphRing(parent, color=0xf59e0b, r=2.55){
    const THREE = state.three;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.42, 32),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.72, depthWrite:false, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = 0.06;
    ring.visible = false;
    ring.renderOrder = 31;
    parent.add(ring);
    return ring;
  }

  function laneSideFromId(id){
    const s = String(id || "");
    let h = 0;
    for(let i=0;i<s.length;i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return (Math.abs(h) % 2) ? 1 : -1;
  }

  function tigerStatusText(t){
    if(!t || !t.alive) return "DOWN";
    const n = state.now || nowMs();
    if(t.telegraphPounceUntil && n < t.telegraphPounceUntil) return "WINDUP";
    if(t.pounceUntil && n < t.pounceUntil) return "POUNCE";
    if(t.recoverUntil && n < t.recoverUntil) return "RECOVER";
    if(t.telegraphMeleeUntil && n < t.telegraphMeleeUntil) return "CLAW-UP";
    return String(t.state || "stalk").toUpperCase();
  }

  function flashUnit(unit){
    if(!unit || !unit.mesh) return;
    unit.hitFlashUntil = (state.now || nowMs()) + 140;
  }

  function updateHitFlash(unit){
    if(!unit || !unit.mesh) return;
    const active = !!(unit.hitFlashUntil && (state.now || nowMs()) < unit.hitFlashUntil);
    const pulse = active ? 1.04 : 1;
    unit.mesh.scale.set(pulse, pulse, pulse);
  }

  function createUnit(opts){
    const THREE = state.three;
    const unit = {
      id: opts.id || `unit-${Math.random().toString(36).slice(2,7)}`,
      role: opts.role || "unit",
      mesh: opts.mesh,
      maxHp: opts.maxHp || 100,
      hp: opts.hp == null ? (opts.maxHp || 100) : opts.hp,
      maxStamina: Number.isFinite(opts.maxStamina) ? opts.maxStamina : 100,
      stamina: Number.isFinite(opts.stamina) ? opts.stamina : 100,
      armor: opts.armor || 0,
      maxArmor: opts.maxArmor || 100,
      speed: opts.speed || 9,
      target:null,
      state:"idle",
      alive:true,
      nextAttackAt:0,
      nextPounceAt:0,
      pounceUntil:0,
      recoverUntil:0,
      telegraphPounceUntil:0,
      telegraphMeleeUntil:0,
      pendingAttackTarget:null,
      pendingAttackDamage:0,
      attackHitAt:0,
      followOffset: opts.followOffset || null,
      following: !!opts.following,
      rescued:false,
      protectedByShield:false,
      tigerType: opts.tigerType || null,
      scoreValue: opts.scoreValue || 0,
      name: opts.name || "",
      ring:null,
      healthBar:null,
      footstepT:Math.random() * 10,
      laneSide:Number.isFinite(opts.laneSide) ? opts.laneSide : laneSideFromId(opts.id),
      hitFlashUntil:0,
    };
    unit.mesh.position.copy(opts.position || new THREE.Vector3());
    unit.mesh.rotation.y = opts.yaw || 0;
    state.unitsRoot.add(unit.mesh);
    return unit;
  }

  function clearWorldUnits(){
    const groups = [state.tigers, state.civilians, state.squad];
    for(const group of groups){
      for(const u of group){
        if(u && u.mesh && u.mesh.parent) u.mesh.parent.remove(u.mesh);
      }
      group.length = 0;
    }
    if(state.player && state.player.mesh && state.player.mesh.parent){
      state.player.mesh.parent.remove(state.player.mesh);
    }
    state.player = null;
    state.selectedTiger = null;
    state.tigerPickRoots.length = 0;
    state.mission.totalCivilians = 0;
    state.mission.totalTigers = 0;
    state.mission.rescued = 0;
    state.mission.captured = 0;
    state.mission.killed = 0;
    state.mission.clearAnnounced = false;
  }

  function resetScenario(){
    clearWorldUnits();
    const THREE = state.three;

    const player = createUnit({
      id:"player",
      role:"player",
      mesh:makeSoldierMesh(0x3b82f6),
      maxHp:100,
      hp:100,
      armor:80,
      maxArmor:100,
      speed:PLAYER_BASE_SPEED,
      position:new THREE.Vector3(0, 0, 0),
      name:"Commander",
    });
    addHealthBar(player, 0x4ade80);
    player.ring = createSelectionRing(player.mesh, 0x22d3ee, 2.4);
    player.ring.visible = true;
    state.player = player;

    const squadA = createUnit({
      id:"squad-a",
      role:"squad",
      mesh:makeSoldierMesh(0x22c55e),
      maxHp:130,
      hp:130,
      armor:110,
      maxArmor:110,
      speed:14,
      followOffset:new THREE.Vector3(-5.2, 0, -4.4),
      position:new THREE.Vector3(-5.2, 0, -4.4),
      name:"Tiger Specialist",
    });
    addHealthBar(squadA, 0x34d399);
    const squadB = createUnit({
      id:"squad-b",
      role:"squad",
      mesh:makeSoldierMesh(0x0ea5e9),
      maxHp:115,
      hp:115,
      armor:70,
      maxArmor:70,
      speed:13.2,
      followOffset:new THREE.Vector3(5.4, 0, -3.8),
      position:new THREE.Vector3(5.4, 0, -3.8),
      name:"Rescue Specialist",
    });
    addHealthBar(squadB, 0x38bdf8);
    state.squad.push(squadA, squadB);

    const civilianSpawns = [
      new THREE.Vector3(52, 0, 36),
      new THREE.Vector3(-62, 0, 58),
      new THREE.Vector3(44, 0, -62),
      new THREE.Vector3(-84, 0, -48),
    ];
    for(let i=0;i<civilianSpawns.length;i++){
      const civ = createUnit({
        id:`civ-${i+1}`,
        role:"civilian",
        mesh:makeCivilianMesh(i % 2 ? 0xf472b6 : 0x60a5fa),
        maxHp:90,
        hp:90,
        armor:0,
        speed:12.6,
        position:civilianSpawns[i],
        name:`Civilian ${i+1}`,
      });
      addHealthBar(civ, 0x86efac);
      civ.ring = createSelectionRing(civ.mesh, 0x4ade80, 2.0);
      civ.ring.visible = false;
      state.civilians.push(civ);
    }

    const tigerSpawns = [
      { pos:new THREE.Vector3(132, 0, 12),  type:TIGER_TYPES[0] },
      { pos:new THREE.Vector3(-144,0,-20),  type:TIGER_TYPES[2] },
      { pos:new THREE.Vector3(92, 0, -130), type:TIGER_TYPES[1] },
      { pos:new THREE.Vector3(-130,0,130),  type:TIGER_TYPES[3] },
    ];
    let tigerN = 1;
    for(const spawn of tigerSpawns){
      const t = createUnit({
        id:`tiger-${tigerN++}`,
        role:"tiger",
        mesh:makeTigerMesh(spawn.type.color),
        maxHp:spawn.type.maxHp,
        hp:spawn.type.maxHp,
        speed:spawn.type.speed,
        tigerType:spawn.type,
        scoreValue:Math.round(spawn.type.maxHp * 1.6),
        position:spawn.pos.clone(),
        name:spawn.type.name,
      });
      t.nextPounceAt = nowMs() + 1400 + Math.random() * 1400;
      t.nextAttackAt = nowMs() + 400;
      t.ring = createSelectionRing(t.mesh, 0x60a5fa, 2.6);
      t.telegraphRing = createTelegraphRing(t.mesh, 0xf59e0b, 2.62);
      addHealthBar(t, 0xfb7185);
      t.mesh.userData.__tiger = t;
      state.tigers.push(t);
      state.tigerPickRoots.push(t.mesh);
    }

    state.mission.totalCivilians = state.civilians.length;
    state.mission.totalTigers = state.tigers.length;
    state.mission.clearAnnounced = false;
    state.fx.shieldUntil = 0;
    state.fx.rollUntil = 0;
    state.fx.sprintUntil = 0;
    state.fx.nextAttackAt = 0;
    state.fx.nextCaptureAt = 0;
    state.selectedTiger = null;
    state.combat.active = false;
    state.combat.target = null;
    state.combat.targetStatus = "";
    state.combat.lockBlend = 0;
    state.combat.pounceFxUntil = 0;
    state.currentChunkX = null;
    state.currentChunkZ = null;
    state.chunkQueue.length = 0;
    state.chunkQueued.clear();
    state.nextChunkSweepAt = 0;
    state.now = nowMs();
    ensureChunksAround(state.player.mesh.position.x, state.player.mesh.position.z);
    processChunkQueue();
    processChunkQueue();
    setStatus("3D ready. Rescue civilians and clear tigers.");
  }

  function createWorldScene(){
    const THREE = state.three;
    const initialTier = detectInitialQualityTier();
    state.perf.tier = initialTier;
    state.perf.preset = QUALITY_PRESETS[initialTier] || QUALITY_PRESETS.med;
    state.perf.evalAt = nowMs();
    state.perf.hudLastAt = 0;
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x112019);
    state.scene.fog = new THREE.FogExp2(0x15281f, 0.0032);

    state.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
    state.camera.position.set(0, 34, 38);
    state.camera.lookAt(0, 0, 0);

    state.raycaster = new THREE.Raycaster();
    state.pointer2D = new THREE.Vector2();
    state.clock = new THREE.Clock();

    state.renderer = new THREE.WebGLRenderer({
      antialias:!!qualityPreset().antialias,
      alpha:false,
      powerPreference:"high-performance",
      precision:"mediump",
    });
    setRendererDprByQuality();
    state.renderer.setSize(100, 100, false);
    state.renderer.outputColorSpace = THREE.SRGBColorSpace || state.renderer.outputEncoding;
    state.renderer.domElement.className = "proto3dCanvas";
    state.canvasHost.innerHTML = "";
    state.canvasHost.appendChild(state.renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xb9f5d0, 0x0c120f, 1.05);
    const dir = new THREE.DirectionalLight(0xfff8e6, 0.92);
    dir.position.set(34, 68, 26);
    state.scene.add(hemi, dir);

    state.root = new THREE.Group();
    state.worldRoot = new THREE.Group();
    state.chunkRoot = new THREE.Group();
    state.unitsRoot = new THREE.Group();
    state.effectsRoot = new THREE.Group();
    state.root.add(state.worldRoot, state.chunkRoot, state.unitsRoot, state.effectsRoot);
    state.scene.add(state.root);

    const baseGround = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000, 24, 24),
      new THREE.MeshStandardMaterial({
        color:0x16402a,
        roughness:0.98,
        metalness:0.02,
      })
    );
    baseGround.rotation.x = -Math.PI * 0.5;
    baseGround.position.y = -0.01;
    state.worldRoot.add(baseGround);

    createSafeZone();
    resetScenario();
    resize3d();
  }

  function makeTree(){
    const THREE = state.three;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.3, 8), mat(0x8b5a2b, 0.95, 0.02));
    trunk.position.y = 1.15;
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.35, 10, 8), mat(0x1e7b45, 0.85, 0.02));
    foliage.position.y = 2.8;
    g.add(trunk, foliage);
    return g;
  }

  function makeHouse(){
    const THREE = state.three;
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 3.5), mat(0xbba98a, 0.9, 0.01));
    base.position.y = 1.2;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.6, 4), mat(0x8b3f2a, 0.72, 0.08));
    roof.position.y = 3.1;
    roof.rotation.y = Math.PI * 0.25;
    g.add(base, roof);
    return g;
  }

  function makeCar(){
    const THREE = state.three;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.9, 1.6), mat(0x9ca3af, 0.5, 0.25));
    body.position.y = 0.75;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.7, 1.3), mat(0xd1d5db, 0.45, 0.2));
    cabin.position.set(-0.15, 1.35, 0);
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.32, 10);
    const wheelMat = mat(0x111827, 0.65, 0.05);
    const wheelPos = [
      [1.02, 0.32, 0.8], [1.02, 0.32, -0.8], [-1.05, 0.32, 0.8], [-1.05, 0.32, -0.8]
    ];
    g.add(body, cabin);
    for(const p of wheelPos){
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI * 0.5;
      w.position.set(p[0], p[1], p[2]);
      g.add(w);
    }
    return g;
  }

  function makeTruck(){
    const THREE = state.three;
    const g = new THREE.Group();
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 2.1), mat(0x64748b, 0.55, 0.16));
    trailer.position.y = 1.0;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 2.0), mat(0x94a3b8, 0.48, 0.2));
    cab.position.set(2.8, 1.08, 0);
    g.add(trailer, cab);
    return g;
  }

  function makeRoadSegment(len=52, width=9){
    const THREE = state.three;
    const g = new THREE.Group();
    const road = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.05, width),
      mat(0x6b5b3f, 0.95, 0.01)
    );
    road.position.y = 0.02;
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(len * 0.76, 0.055, 0.3),
      mat(0xd6c39f, 0.45, 0.01)
    );
    dash.position.set(0, 0.06, 0);
    g.add(road, dash);
    return g;
  }

  function makePond(){
    const THREE = state.three;
    const pond = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 6.8, 0.18, 26),
      new THREE.MeshStandardMaterial({
        color:0x1f7aa8,
        roughness:0.25,
        metalness:0.05,
        transparent:true,
        opacity:0.55,
      })
    );
    pond.position.y = 0.01;
    return pond;
  }

  function clearFarChunks(cx, cz, dropRadius){
    const drop = Number.isFinite(dropRadius) ? dropRadius : CHUNK_DROP_RADIUS;
    for(const [key, chunk] of state.chunks){
      const dx = chunk.cx - cx;
      const dz = chunk.cz - cz;
      if(Math.max(Math.abs(dx), Math.abs(dz)) > drop){
        state.chunkRoot.remove(chunk.group);
        state.chunks.delete(key);
      }
    }
  }

  function addChunk(cx, cz){
    const key = `${cx}:${cz}`;
    if(state.chunks.has(key)) return;
    const preset = qualityPreset();

    const THREE = state.three;
    const group = new THREE.Group();
    group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);

    const roadCount = preset.roadBase + Math.floor(hash01(cx, cz, 11) * preset.roadVar);
    for(let i=0;i<roadCount;i++){
      const road = makeRoadSegment(48 + hash01(cx, cz, 12 + i) * 24, 8 + hash01(cx, cz, 31 + i) * 4);
      road.position.set(
        (hash01(cx, cz, 50 + i) - 0.5) * CHUNK_SIZE * 0.65,
        0,
        (hash01(cx, cz, 60 + i) - 0.5) * CHUNK_SIZE * 0.65
      );
      road.rotation.y = hash01(cx, cz, 70 + i) * Math.PI;
      group.add(road);
    }

    const houseCount = preset.houseBase + Math.floor(hash01(cx, cz, 81) * preset.houseVar);
    for(let i=0;i<houseCount;i++){
      const h = makeHouse();
      h.position.set(
        (hash01(cx, cz, 90 + i) - 0.5) * CHUNK_SIZE * 0.74,
        0,
        (hash01(cx, cz, 100 + i) - 0.5) * CHUNK_SIZE * 0.74
      );
      h.rotation.y = hash01(cx, cz, 110 + i) * Math.PI * 2;
      group.add(h);
    }

    const carCount = preset.carBase + Math.floor(hash01(cx, cz, 121) * preset.carVar);
    for(let i=0;i<carCount;i++){
      const c = (hash01(cx, cz, 130 + i) > 0.75) ? makeTruck() : makeCar();
      c.position.set(
        (hash01(cx, cz, 140 + i) - 0.5) * CHUNK_SIZE * 0.78,
        0,
        (hash01(cx, cz, 150 + i) - 0.5) * CHUNK_SIZE * 0.78
      );
      c.rotation.y = hash01(cx, cz, 160 + i) * Math.PI * 2;
      group.add(c);
    }

    const treeCount = preset.treeBase + Math.floor(hash01(cx, cz, 171) * preset.treeVar);
    for(let i=0;i<treeCount;i++){
      const t = makeTree();
      t.scale.setScalar(0.82 + hash01(cx, cz, 180 + i) * 0.5);
      t.position.set(
        (hash01(cx, cz, 210 + i) - 0.5) * CHUNK_SIZE * 0.94,
        0,
        (hash01(cx, cz, 250 + i) - 0.5) * CHUNK_SIZE * 0.94
      );
      group.add(t);
    }

    if(hash01(cx, cz, 310) > (1 - preset.pondChance)){
      const pond = makePond();
      pond.scale.set(0.7 + hash01(cx, cz, 311) * 0.9, 1, 0.7 + hash01(cx, cz, 312) * 0.9);
      pond.position.set(
        (hash01(cx, cz, 313) - 0.5) * CHUNK_SIZE * 0.65,
        0,
        (hash01(cx, cz, 314) - 0.5) * CHUNK_SIZE * 0.65
      );
      group.add(pond);
    }

    state.chunkRoot.add(group);
    state.chunks.set(key, { cx, cz, group });
  }

  function queueChunk(cx, cz, priority){
    const key = `${cx}:${cz}`;
    if(state.chunks.has(key) || state.chunkQueued.has(key)) return;
    state.chunkQueued.add(key);
    if(priority <= 1) state.chunkQueue.unshift({ key, cx, cz });
    else state.chunkQueue.push({ key, cx, cz });
  }

  function processChunkQueue(){
    const preset = qualityPreset();
    const budget = Math.max(1, Math.floor(preset.chunkBuildPerFrame || 1));
    for(let i=0;i<budget;i++){
      const next = state.chunkQueue.shift();
      if(!next) break;
      state.chunkQueued.delete(next.key);
      addChunk(next.cx, next.cz);
    }
  }

  function ensureChunksAround(x, z){
    const preset = qualityPreset();
    const keepRadius = Number.isFinite(preset.keepRadius) ? preset.keepRadius : CHUNK_KEEP_RADIUS;
    const dropRadius = Number.isFinite(preset.dropRadius) ? preset.dropRadius : CHUNK_DROP_RADIUS;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);

    if(state.currentChunkX !== cx || state.currentChunkZ !== cz){
      state.currentChunkX = cx;
      state.currentChunkZ = cz;
      const pending = [];
      for(let dz=-keepRadius; dz<=keepRadius; dz++){
        for(let dx=-keepRadius; dx<=keepRadius; dx++){
          const tx = cx + dx;
          const tz = cz + dz;
          const dist = Math.max(Math.abs(dx), Math.abs(dz));
          const key = `${tx}:${tz}`;
          if(!state.chunks.has(key) && !state.chunkQueued.has(key)){
            pending.push({ tx, tz, dist });
          }
        }
      }
      pending.sort((a,b)=>a.dist - b.dist);
      for(const p of pending){
        queueChunk(p.tx, p.tz, p.dist);
      }
    }

    processChunkQueue();
    if(state.now >= state.nextChunkSweepAt){
      clearFarChunks(cx, cz, dropRadius);
      state.nextChunkSweepAt = state.now + 260;
    }
  }

  function unitForward(mesh){
    return { x:Math.sin(mesh.rotation.y), z:Math.cos(mesh.rotation.y) };
  }

  function animateHumanoid(unit, moveSpeed){
    const ud = unit.mesh.userData || {};
    if(!ud.legL || !ud.legR) return;
    ud.animT = (ud.animT || 0) + moveSpeed * 0.06 + state.dt * 5.2;
    const swing = Math.sin(ud.animT) * clamp(moveSpeed * 0.06, 0.06, 0.55);
    ud.legL.rotation.x = swing;
    ud.legR.rotation.x = -swing;
    if(ud.armL && ud.armR){
      ud.armL.rotation.x = -swing * 0.8;
      ud.armR.rotation.x = swing * 0.8;
    }
  }

  function animateTiger(unit, moveSpeed){
    const ud = unit.mesh.userData || {};
    ud.animT = (ud.animT || 0) + state.dt * (4.5 + moveSpeed * 0.12);
    const swing = Math.sin(ud.animT) * clamp(moveSpeed * 0.055, 0.05, 0.62);
    if(ud.legFL) ud.legFL.rotation.x = swing;
    if(ud.legFR) ud.legFR.rotation.x = -swing;
    if(ud.legBL) ud.legBL.rotation.x = -swing;
    if(ud.legBR) ud.legBR.rotation.x = swing;
    if(ud.tail) ud.tail.rotation.y = Math.sin(ud.animT * 0.6) * 0.35;
  }

  function resolveSeparation(units){
    for(let i=0;i<units.length;i++){
      const a = units[i];
      if(!a || !a.alive) continue;
      for(let j=i+1;j<units.length;j++){
        const b = units[j];
        if(!b || !b.alive) continue;
        const pa = a.mesh.position;
        const pb = b.mesh.position;
        const dx = pb.x - pa.x;
        const dz = pb.z - pa.z;
        const d = Math.hypot(dx, dz);
        let minD = 2.2;
        const tigerVsPlayer =
          (a.role === "tiger" && b.role === "player") ||
          (a.role === "player" && b.role === "tiger");
        if(tigerVsPlayer) minD = COMBAT_MIN_SEPARATION;
        if(d > 0 && d < minD){
          const push = (minD - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          pa.x -= nx * push;
          pa.z -= nz * push;
          pb.x += nx * push;
          pb.z += nz * push;
        }
      }
    }
  }

  function controlsVector(){
    const kb = state.controls.keyboard;
    const kx = (kb.ArrowRight || kb.KeyD ? 1 : 0) - (kb.ArrowLeft || kb.KeyA ? 1 : 0);
    const ky = (kb.ArrowDown || kb.KeyS ? 1 : 0) - (kb.ArrowUp || kb.KeyW ? 1 : 0);
    const x = clamp(state.controls.moveX + kx, -1, 1);
    const y = clamp(state.controls.moveY + ky, -1, 1);
    return { x, y };
  }

  function moveToward(unit, targetX, targetZ, speed){
    const pos = unit.mesh.position;
    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;
    const d = Math.hypot(dx, dz);
    if(d < 0.01) return 0;
    const step = Math.min(d, speed * state.dt);
    const nx = dx / d;
    const nz = dz / d;
    pos.x += nx * step;
    pos.z += nz * step;
    unit.mesh.rotation.y = Math.atan2(nx, nz);
    return step / Math.max(0.0001, state.dt);
  }

  function isShieldActive(){
    return nowMs() < state.fx.shieldUntil;
  }

  function protectedByShield(unit){
    if(!isShieldActive() || !state.player || !unit) return false;
    if(unit.role === "player") return true;
    const d = horizontalDistance(unit, state.player);
    return d <= 11.5;
  }

  function damageTarget(unit, amount){
    if(!unit || !unit.alive) return;
    const dmg = Math.max(0, amount || 0);
    if(dmg <= 0) return;
    if(unit.role === "player"){
      if(nowMs() < state.fx.rollUntil) return;
      if(protectedByShield(unit)) return;
      flashUnit(unit);
      let left = dmg;
      if(unit.armor > 0){
        const absorb = Math.min(unit.armor, left);
        unit.armor -= absorb;
        left -= absorb;
      }
      if(left > 0) unit.hp = Math.max(0, unit.hp - left);
      if(unit.hp <= 0){
        unit.hp = unit.maxHp;
        unit.armor = Math.max(40, unit.armor);
        unit.mesh.position.copy(state.safeZone.mesh.position).add(new state.three.Vector3(-18, 0, 16));
        setStatus("You were downed. Respawned near safe zone.");
      }
      return;
    }
    if(unit.role === "civilian"){
      if(protectedByShield(unit)) return;
      flashUnit(unit);
      unit.hp = Math.max(0, unit.hp - dmg);
      if(unit.hp <= 0){
        unit.alive = false;
        unit.following = false;
        unit.mesh.visible = false;
        setStatus(`${unit.name} was lost.`, 2200);
      }
      return;
    }
    flashUnit(unit);
    unit.hp = Math.max(0, unit.hp - dmg);
  }

  function cleanupDeadTiger(tiger, reason){
    if(!tiger || !tiger.alive) return;
    tiger.alive = false;
    tiger.mesh.visible = false;
    tiger.ring.visible = false;
    if(state.selectedTiger === tiger) state.selectedTiger = null;
    if(reason === "capture") state.mission.captured += 1;
    else state.mission.killed += 1;
  }

  function attackTiger(target){
    const t = target || state.selectedTiger;
    if(!t || !t.alive) return setStatus("Tap a tiger first to lock target.");
    const now = nowMs();
    if(now < state.fx.nextAttackAt) return;
    const d = horizontalDistance(state.player, t);
    if(d > PLAYER_ATTACK_RANGE){
      setStatus(`Out of range (${Math.round(d)}m). Move closer.`);
      return;
    }
    state.fx.nextAttackAt = now + PLAYER_ATTACK_COOLDOWN_MS;
    const nearBonus = clamp((PLAYER_ATTACK_RANGE - d) / PLAYER_ATTACK_RANGE, 0, 1);
    const dmg = Math.round(12 + nearBonus * 16);
    damageTarget(t, dmg);
    const dirX = Math.sin(state.player.mesh.rotation.y);
    const dirZ = Math.cos(state.player.mesh.rotation.y);
    t.mesh.position.x += dirX * 0.36;
    t.mesh.position.z += dirZ * 0.36;
    setStatus(`Hit ${t.name} for ${dmg}.`, 900);
    if(t.hp <= 0){
      cleanupDeadTiger(t, "kill");
      setStatus(`${t.name} neutralized.`, 1400);
    }
  }

  function captureTiger(target){
    const t = target || state.selectedTiger;
    if(!t || !t.alive) return setStatus("Tap a tiger first to lock target.");
    const now = nowMs();
    if(now < state.fx.nextCaptureAt) return;
    const d = horizontalDistance(state.player, t);
    if(d > PLAYER_CAPTURE_RANGE){
      setStatus(`Capture range is ${PLAYER_CAPTURE_RANGE}m. Move closer.`);
      return;
    }
    const hpPct = t.hp / Math.max(1, t.maxHp);
    if(hpPct > 0.25){
      setStatus(`Lower tiger HP below 25% first (${Math.round(hpPct * 100)}%).`, 1400);
      return;
    }
    state.fx.nextCaptureAt = now + PLAYER_CAPTURE_COOLDOWN_MS;
    flashUnit(t);
    cleanupDeadTiger(t, "capture");
    setStatus(`${t.name} captured for research.`, 1600);
  }

  function useShield(){
    const now = nowMs();
    const current = state.fx.shieldUntil - now;
    if(current > 0){
      setStatus(`Shield already active (${Math.ceil(current / 1000)}s).`);
      return;
    }
    state.fx.shieldUntil = now + 5000;
    setStatus("Escort shield active for 5 seconds.");
  }

  function rollDodge(){
    const vec = controlsVector();
    if(Math.hypot(vec.x, vec.y) < 0.1){
      const fwd = unitForward(state.player.mesh);
      state.fx.dodgeAngle = Math.atan2(fwd.x, fwd.z);
    }else{
      state.fx.dodgeAngle = Math.atan2(vec.x, vec.y);
    }
    state.fx.rollUntil = nowMs() + 460;
    setStatus("Roll dodge active.");
  }

  function triggerSprint(){
    state.fx.sprintUntil = nowMs() + 2200;
    setStatus("Sprint burst enabled.");
  }

  function updatePlayer(){
    const p = state.player;
    if(!p || !p.alive) return;
    if(!Number.isFinite(p.stamina)) p.stamina = Number.isFinite(p.maxStamina) ? p.maxStamina : 100;
    if(!Number.isFinite(p.maxStamina) || p.maxStamina <= 0) p.maxStamina = 100;

    const c = controlsVector();
    const mag = Math.hypot(c.x, c.y);
    const moving = mag > 0.06;
    const normalizedX = moving ? c.x / mag : 0;
    const normalizedY = moving ? c.y / mag : 0;
    const sprinting = state.controls.sprintHold || nowMs() < state.fx.sprintUntil;
    const rolling = nowMs() < state.fx.rollUntil;
    let speed = PLAYER_BASE_SPEED;
    if(rolling) speed = PLAYER_ROLL_SPEED;
    else if(sprinting && p.stamina > 2) speed = PLAYER_SPRINT_SPEED;

    if(moving || rolling){
      const angle = rolling ? state.fx.dodgeAngle : Math.atan2(normalizedX, normalizedY);
      const vx = Math.sin(angle) * speed;
      const vz = Math.cos(angle) * speed;
      p.mesh.position.x += vx * state.dt;
      p.mesh.position.z += vz * state.dt;
      p.mesh.rotation.y = angle;
      animateHumanoid(p, speed);
    }else{
      animateHumanoid(p, 0.05);
    }

    if(sprinting && moving){
      p.stamina = Math.max(0, p.stamina - 20 * state.dt);
      if(p.stamina <= 0){
        state.controls.sprintHold = false;
      }
    }else{
      p.stamina = Math.min(p.maxStamina, p.stamina + 16 * state.dt);
    }
  }

  function updateSquad(){
    const p = state.player;
    if(!p) return;
    for(const mate of state.squad){
      if(!mate || !mate.alive || !mate.followOffset) continue;
      const targetX = p.mesh.position.x + mate.followOffset.x;
      const targetZ = p.mesh.position.z + mate.followOffset.z;
      const moveSpeed = moveToward(mate, targetX, targetZ, mate.speed);
      animateHumanoid(mate, moveSpeed);

      const targetTiger = state.selectedTiger && state.selectedTiger.alive ? state.selectedTiger : null;
      if(targetTiger){
        const d = horizontalDistance(mate, targetTiger);
        if(d <= 26 && nowMs() > mate.nextAttackAt){
          targetTiger.hp = Math.max(0, targetTiger.hp - 4);
          mate.nextAttackAt = nowMs() + 560;
          if(targetTiger.hp <= 0){
            cleanupDeadTiger(targetTiger, "kill");
          }
        }
      }
    }
  }

  function updateCivilians(){
    const p = state.player;
    for(let i=0;i<state.civilians.length;i++){
      const civ = state.civilians[i];
      if(!civ || !civ.alive || civ.rescued) continue;
      const dToPlayer = horizontalDistance(civ, p);
      if(!civ.following && dToPlayer <= CIV_PICKUP_RADIUS){
        civ.following = true;
        if(civ.ring) civ.ring.visible = true;
        setStatus(`${civ.name} is following you.`, 1200);
      }

      if(civ.following){
        const offsetIndex = i % 3;
        const side = (offsetIndex - 1) * 2.8;
        const back = 4.8 + Math.floor(i / 3) * 2.2;
        const fwd = unitForward(p.mesh);
        const rightX = Math.cos(p.mesh.rotation.y);
        const rightZ = -Math.sin(p.mesh.rotation.y);
        const tx = p.mesh.position.x - fwd.x * back + rightX * side;
        const tz = p.mesh.position.z - fwd.z * back + rightZ * side;
        const moveSpeed = moveToward(civ, tx, tz, civ.speed);
        animateHumanoid(civ, moveSpeed);
      }else{
        animateHumanoid(civ, 0.03);
      }

      const dz = horizontalDistance(civ, state.safeZone);
      if(dz <= state.safeZone.radius - 0.8){
        civ.rescued = true;
        civ.following = false;
        civ.mesh.visible = false;
        state.mission.rescued += 1;
        setStatus(`${civ.name} evacuated.`, 1200);
      }
    }
  }

  function chooseTigerTarget(tiger){
    let best = null;
    let bestDist = Infinity;
    for(const civ of state.civilians){
      if(!civ.alive || civ.rescued) continue;
      const d = horizontalDistance(tiger, civ);
      if(d < bestDist){
        bestDist = d;
        best = civ;
      }
    }
    const dPlayer = horizontalDistance(tiger, state.player);
    if(dPlayer < bestDist * 0.92 || best == null){
      best = state.player;
      bestDist = dPlayer;
    }
    return { target:best, dist:bestDist };
  }

  function getActiveCombatTiger(){
    const t = state.selectedTiger;
    if(!t || !t.alive || !state.player || !state.player.alive) return null;
    const d = horizontalDistance(state.player, t);
    if(d > COMBAT_LOCK_RANGE) return null;
    return t;
  }

  function updateCombatDirector(){
    const activeTiger = getActiveCombatTiger();
    if(activeTiger){
      state.combat.active = true;
      state.combat.target = activeTiger;
      state.combat.targetStatus = tigerStatusText(activeTiger);
      state.combat.lockBlend = clamp(state.combat.lockBlend + state.dt * 3.2, 0, 1);
    }else{
      state.combat.active = false;
      state.combat.target = null;
      state.combat.targetStatus = "";
      state.combat.lockBlend = clamp(state.combat.lockBlend - state.dt * 4.6, 0, 1);
    }
  }

  function tigerDesiredLane(t, target){
    const tp = target.mesh.position;
    const pp = state.player.mesh.position;
    let vx = pp.x - tp.x;
    let vz = pp.z - tp.z;
    const vd = Math.hypot(vx, vz) || 1;
    vx /= vd;
    vz /= vd;
    const sideX = -vz;
    const sideZ = vx;
    const sideSign = Number.isFinite(t.laneSide) ? t.laneSide : 1;
    return {
      x: pp.x + vx * 2.4 + sideX * (1.6 * sideSign),
      z: pp.z + vz * 2.4 + sideZ * (1.6 * sideSign),
    };
  }

  function updateTigers(){
    const now = nowMs();
    for(const t of state.tigers){
      if(!t.alive) continue;
      const pick = chooseTigerTarget(t);
      const target = pick.target;
      const dist = pick.dist;
      if(!target){
        animateTiger(t, 0.05);
        continue;
      }
      t.target = target;

      let speed = t.speed;
      let mode = "patrol";
      if(dist < 52){
        mode = "stalk";
        if(now > t.nextPounceAt && dist > 5 && dist < 26 && now > t.pounceUntil && now > t.recoverUntil){
          t.telegraphPounceUntil = now + TIGER_WINDUP_MS;
          t.nextPounceAt = now + 2400 + Math.random() * 1200;
          setStatus(`${t.name} pounce incoming!`, 700);
        }
      }
      if(now < t.telegraphPounceUntil){
        mode = "windup";
        speed *= 0.35;
      }else if(t.telegraphPounceUntil > 0 && now >= t.telegraphPounceUntil && now > t.pounceUntil){
        t.pounceUntil = now + 560;
        t.recoverUntil = t.pounceUntil + 520;
        t.telegraphPounceUntil = 0;
        state.combat.pounceFxUntil = now + 180;
      }
      if(now < t.pounceUntil){
        mode = "pounce";
        speed *= t.tigerType.pounce;
      }else if(now < t.recoverUntil){
        mode = "recover";
        speed *= 0.65;
      }
      t.state = mode;

      if(target && dist > 2.2){
        let tx = target.mesh.position.x;
        let tz = target.mesh.position.z;
        if(target.role === "player" && dist <= COMBAT_MELEE_LANE_RANGE){
          const lane = tigerDesiredLane(t, target);
          tx = lane.x;
          tz = lane.z;
        }
        const moveSpeed = moveToward(t, tx, tz, speed);
        animateTiger(t, moveSpeed);
      }else{
        animateTiger(t, 0.05);
      }

      if(t.attackHitAt > 0 && now >= t.attackHitAt){
        if(t.pendingAttackTarget && t.pendingAttackTarget.alive && horizontalDistance(t, t.pendingAttackTarget) <= 4.4){
          damageTarget(t.pendingAttackTarget, t.pendingAttackDamage || t.tigerType.damage);
        }
        t.attackHitAt = 0;
        t.pendingAttackTarget = null;
        t.pendingAttackDamage = 0;
        t.telegraphMeleeUntil = 0;
      }

      if(dist <= 3.8 && now >= t.nextAttackAt && t.attackHitAt <= 0){
        t.telegraphMeleeUntil = now + TIGER_MELEE_WINDUP_MS;
        t.attackHitAt = t.telegraphMeleeUntil;
        t.pendingAttackTarget = target;
        t.pendingAttackDamage = t.tigerType.damage;
        t.nextAttackAt = now + (target.role === "civilian" ? 3200 : 1300);
      }
    }
  }

  function updateSafeZoneVisual(){
    if(!state.safeZone || !state.safeZone.mesh) return;
    const ring = state.safeZone.mesh.userData.ring;
    if(ring){
      ring.rotation.z += state.dt * 0.5;
    }
  }

  function updateSelectionRings(){
    const now = state.now || nowMs();
    for(const t of state.tigers){
      if(t.ring) t.ring.visible = (state.selectedTiger === t) && t.alive;
      if(t.telegraphRing){
        const pounceWindup = !!(t.telegraphPounceUntil && now < t.telegraphPounceUntil);
        const meleeWindup = !!(t.telegraphMeleeUntil && now < t.telegraphMeleeUntil);
        const pouncing = !!(t.pounceUntil && now < t.pounceUntil);
        if(pounceWindup || meleeWindup || pouncing){
          t.telegraphRing.visible = true;
          const pulse = 1 + Math.sin((now + (t.scoreValue || 0)) * 0.02) * 0.08;
          t.telegraphRing.scale.set(pulse, pulse, pulse);
          if(pounceWindup){
            t.telegraphRing.material.color.setHex(0xfb7185);
            t.telegraphRing.material.opacity = 0.82;
          }else if(meleeWindup){
            t.telegraphRing.material.color.setHex(0xf59e0b);
            t.telegraphRing.material.opacity = 0.74;
          }else{
            t.telegraphRing.material.color.setHex(0xef4444);
            t.telegraphRing.material.opacity = 0.64;
          }
        }else{
          t.telegraphRing.visible = false;
        }
      }
    }
    if(state.player && state.player.ring){
      state.player.ring.visible = true;
    }
    const shieldOn = isShieldActive();
    if(state.player && state.player.ring){
      state.player.ring.material.color.setHex(shieldOn ? 0x34d399 : 0x22d3ee);
    }
  }

  function updateCamera(){
    const p = state.player;
    if(!p) return;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    const lock = state.combat.active ? state.combat.target : null;
    const blend = clamp(state.combat.lockBlend || 0, 0, 1);
    const followHeightBase = isLandscape ? 30 : 38;
    const followBackBase = isLandscape ? 30 : 40;
    let tx;
    let tz;
    let lookX = p.mesh.position.x;
    let lookZ = p.mesh.position.z;
    let followHeight = followHeightBase;
    let followBack = followBackBase;
    if(lock && lock.alive){
      const pp = p.mesh.position;
      const tp = lock.mesh.position;
      const dx = pp.x - tp.x;
      const dz = pp.z - tp.z;
      const d = Math.hypot(dx, dz) || 1;
      const nx = dx / d;
      const nz = dz / d;
      const midX = (pp.x + tp.x) * 0.5;
      const midZ = (pp.z + tp.z) * 0.5;
      const lockBack = clamp(18 + d * 0.5, 18, 34);
      followBack = lerp(followBackBase, lockBack, blend);
      followHeight = lerp(followHeightBase, isLandscape ? 25 : 30, blend);
      tx = midX + nx * followBack;
      tz = midZ + nz * followBack;
      lookX = lerp(pp.x, midX, clamp(blend * 0.9, 0, 1));
      lookZ = lerp(pp.z, midZ, clamp(blend * 0.9, 0, 1));
    }else{
      const fwd = unitForward(p.mesh);
      tx = p.mesh.position.x - fwd.x * followBack;
      tz = p.mesh.position.z - fwd.z * followBack;
    }
    state.camera.position.x = smoothStep(state.camera.position.x, tx, 6.3, state.dt);
    state.camera.position.y = smoothStep(state.camera.position.y, followHeight, 4.8, state.dt);
    state.camera.position.z = smoothStep(state.camera.position.z, tz, 6.3, state.dt);
    const lookY = isLandscape ? 2.3 : 2.8;
    state.camera.lookAt(lookX, lookY, lookZ);
  }

  function setHudText(cacheKey, node, value){
    if(!node) return;
    const v = String(value || "");
    if(state.perf.lastHud[cacheKey] === v) return;
    state.perf.lastHud[cacheKey] = v;
    node.innerText = v;
  }

  function updateHud(force=false){
    const p = state.player;
    const aliveTigers = state.tigers.filter((t)=>t.alive).length;
    const aliveCivs = state.civilians.filter((c)=>c.alive && !c.rescued).length;
    const rescued = state.mission.rescued;
    const now = state.now || nowMs();
    const preset = qualityPreset();

    const attackEnabled = !!(state.selectedTiger && state.selectedTiger.alive);
    if(state.ui.attackBtn){
      const disabled = !attackEnabled;
      if(state.ui.attackBtn.disabled !== disabled) state.ui.attackBtn.disabled = disabled;
    }
    if(state.ui.captureBtn){
      const st = state.selectedTiger;
      const canCapture = !!(st && st.alive && (st.hp / st.maxHp) <= 0.25);
      const disabled = !canCapture;
      if(state.ui.captureBtn.disabled !== disabled) state.ui.captureBtn.disabled = disabled;
    }
    if(state.ui.shieldBtn){
      const left = Math.max(0, state.fx.shieldUntil - now);
      const shieldLabel = left > 0 ? `Shield ${Math.ceil(left / 1000)}s` : "Shield";
      if(state.perf.lastHud.shieldLabel !== shieldLabel){
        state.perf.lastHud.shieldLabel = shieldLabel;
        state.ui.shieldBtn.innerText = shieldLabel;
      }
    }

    const hudEvery = clamp(Number(preset.hudIntervalMs || 120), PERF_HUD_MIN_MS, PERF_HUD_MAX_MS);
    if(!force && (now - state.perf.hudLastAt) < hudEvery) return;
    state.perf.hudLastAt = now;

    setHudText(
      "mission",
      state.ui.hudMission,
      `OBJ Civ ${rescued}/${state.mission.totalCivilians} • Pending ${aliveCivs} • Tigers ${aliveTigers}`
    );
    if(p){
      const staminaNow = Math.round(Number.isFinite(p.stamina) ? p.stamina : 100);
      setHudText(
        "agent",
        state.ui.hudAgent,
        `YOU HP ${Math.round(p.hp)}/${p.maxHp} • AR ${Math.round(p.armor)}/${p.maxArmor} • ST ${staminaNow}`
      );
    }

    const st = state.selectedTiger;
    if(st && st.alive){
      const pct = Math.round((st.hp / st.maxHp) * 100);
      setHudText("tiger", state.ui.hudTiger, `LOCK ${st.name} • HP ${Math.round(st.hp)}/${st.maxHp} (${pct}%) • ${tigerStatusText(st)}`);
    }else{
      setHudText("tiger", state.ui.hudTiger, "LOCK: Tap tiger to engage.");
    }

    if(state.ui.duelHud){
      const engaged = !!(state.combat.active && state.combat.target && state.combat.target.alive);
      state.ui.duelHud.classList.toggle("active", engaged);
      if(state.overlay) state.overlay.classList.toggle("combatLock", engaged);
      if(engaged){
        const tiger = state.combat.target;
        const youPct = Math.round((p.hp / Math.max(1, p.maxHp)) * 100);
        const tigerPct = Math.round((tiger.hp / Math.max(1, tiger.maxHp)) * 100);
        setHudText("duelYou", state.ui.duelYou, `YOU ${youPct}% • AR ${Math.round(p.armor)}%`);
        setHudText("duelTiger", state.ui.duelTiger, `${tiger.name.toUpperCase()} ${tigerPct}% • ${tigerStatusText(tiger)}`);
      }else{
        if(state.overlay) state.overlay.classList.remove("combatLock");
        setHudText("duelYou", state.ui.duelYou, "");
        setHudText("duelTiger", state.ui.duelTiger, "");
      }
    }

    if(state.ui.hint){
      if(state.statusUntil > now){
        state.ui.hint.classList.remove("hidden");
        setHudText("hint", state.ui.hint, state.statusText);
      }else{
        state.ui.hint.classList.add("hidden");
      }
    }
  }

  function updateGameState(){
    state.now = nowMs();
    state.dt = clamp(state.clock.getDelta(), 0.001, 0.050);
    state.perf.frameNo += 1;
    if(!state.active) return;
    if(state.overlay && state.overlay.style.display !== "flex"){
      closePrototype();
      return;
    }
    if(!state.player || !state.player.mesh){
      return;
    }
    evaluatePerformanceTier();
    ensureChunksAround(state.player.mesh.position.x, state.player.mesh.position.z);
    updatePlayer();
    updateSquad();
    updateCivilians();
    updateTigers();
    updateCombatDirector();
    const liveUnits = state.liveUnitsCache;
    liveUnits.length = 0;
    if(state.player && state.player.alive) liveUnits.push(state.player);
    for(const u of state.squad){ if(u && u.alive) liveUnits.push(u); }
    for(const u of state.civilians){ if(u && u.alive && !u.rescued) liveUnits.push(u); }
    for(const u of state.tigers){ if(u && u.alive) liveUnits.push(u); }
    if(state.perf.tier !== "low" || (state.perf.frameNo % 2) === 0){
      resolveSeparation(liveUnits);
    }
    updateHitFlash(state.player);
    for(const u of state.squad) updateHitFlash(u);
    for(const u of state.civilians) updateHitFlash(u);
    for(const u of state.tigers) updateHitFlash(u);
    updateSelectionRings();
    updateSafeZoneVisual();
    const barsEvery = Math.max(1, Math.floor(qualityPreset().healthBarEveryNFrames || 1));
    if((state.perf.frameNo % barsEvery) === 0){
      updateHealthBar(state.player);
      for(const u of state.squad) updateHealthBar(u);
      for(const u of state.civilians) updateHealthBar(u);
      for(const u of state.tigers) updateHealthBar(u);
      orientHealthBarsToCamera();
    }
    updateCamera();
    updateHud();

    const missionClear = state.mission.rescued >= state.mission.totalCivilians && state.tigers.every((t)=>!t.alive);
    if(missionClear && !state.mission.clearAnnounced){
      state.mission.clearAnnounced = true;
      setStatus("3D prototype mission clear. Reset scenario to run again.", 2200);
    }
  }

  function renderFrame(){
    if(!state.active) return;
    updateGameState();
    state.renderer.render(state.scene, state.camera);
    state.raf = requestAnimationFrame(renderFrame);
  }

  function stopRenderLoop(){
    if(state.raf){
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
  }

  function resize3d(){
    if(!state.renderer || !state.camera || !state.canvasHost) return;
    setRendererDprByQuality();
    const w = Math.max(2, state.canvasHost.clientWidth);
    const h = Math.max(2, state.canvasHost.clientHeight);
    state.renderer.setSize(w, h, false);
    state.camera.aspect = w / h;
    state.camera.updateProjectionMatrix();
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if(state.ui.landscapeHint){
      state.ui.landscapeHint.style.display = isLandscape ? "none" : "block";
    }
  }

  function onOrientationChanged(){
    window.setTimeout(resize3d, 40);
  }

  function onVisibilityChanged(){
    if(document.hidden){
      stopRenderLoop();
      return;
    }
    if(state.active && !state.raf){
      state.clock.getDelta();
      state.raf = requestAnimationFrame(renderFrame);
    }
  }

  function tigerFromHit(obj){
    let cur = obj;
    while(cur){
      if(cur.userData && cur.userData.__tiger) return cur.userData.__tiger;
      cur = cur.parent || null;
    }
    return null;
  }

  function onWorldPointerDown(ev){
    if(!state.active || !state.renderer) return;
    if(ev.target !== state.renderer.domElement) return;
    const rect = state.renderer.domElement.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    state.pointer2D.set(x, y);
    state.raycaster.setFromCamera(state.pointer2D, state.camera);
    const hits = state.raycaster.intersectObjects(state.tigerPickRoots, true);
    if(hits && hits.length){
      const tiger = tigerFromHit(hits[0].object);
      if(tiger && tiger.alive){
        state.selectedTiger = tiger;
        setStatus(`${tiger.name} locked. Attack or capture when ready.`);
      }
    }
  }

  function onKeyDown(ev){
    if(!state.active) return;
    if(ev.code in state.controls.keyboard || /^Arrow|^Key[WASD]$/.test(ev.code)){
      state.controls.keyboard[ev.code] = true;
    }
    if(ev.code === "Space"){
      ev.preventDefault();
      attackTiger();
    }
    if(ev.code === "KeyR"){
      ev.preventDefault();
      rollDodge();
    }
    if(ev.code === "ShiftLeft" || ev.code === "ShiftRight"){
      state.controls.sprintHold = true;
    }
    if(ev.code === "KeyE"){
      captureTiger();
    }
    if(ev.code === "KeyQ"){
      useShield();
    }
  }

  function onKeyUp(ev){
    if(!state.active) return;
    if(ev.code in state.controls.keyboard) state.controls.keyboard[ev.code] = false;
    if(ev.code === "ShiftLeft" || ev.code === "ShiftRight"){
      state.controls.sprintHold = false;
    }
  }

  function updateJoystickVisual(nx, ny){
    const maxR = 42;
    const x = clamp(nx, -1, 1) * maxR;
    const y = clamp(ny, -1, 1) * maxR;
    if(state.ui.joyKnob){
      state.ui.joyKnob.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  function resetJoystick(){
    state.controls.moveX = 0;
    state.controls.moveY = 0;
    state.controls.joystickPointerId = null;
    state.controls.joystickActive = false;
    updateJoystickVisual(0,0);
  }

  function onJoyPointerDown(ev){
    if(!state.active || !state.ui.joyBase) return;
    ev.preventDefault();
    const rect = state.ui.joyBase.getBoundingClientRect();
    state.controls.joystickCenterX = rect.left + rect.width * 0.5;
    state.controls.joystickCenterY = rect.top + rect.height * 0.5;
    state.controls.joystickPointerId = ev.pointerId;
    state.controls.joystickActive = true;
    onJoyPointerMove(ev);
    ev.target.setPointerCapture?.(ev.pointerId);
  }

  function onJoyPointerMove(ev){
    if(!state.active || !state.controls.joystickActive) return;
    if(state.controls.joystickPointerId !== ev.pointerId) return;
    ev.preventDefault();
    const dx = ev.clientX - state.controls.joystickCenterX;
    const dy = ev.clientY - state.controls.joystickCenterY;
    const r = Math.hypot(dx, dy);
    const maxR = 42;
    const nx = r > 0 ? dx / r : 0;
    const ny = r > 0 ? dy / r : 0;
    const rr = clamp(r / maxR, 0, 1);
    state.controls.moveX = nx * rr;
    state.controls.moveY = ny * rr;
    updateJoystickVisual(state.controls.moveX, state.controls.moveY);
  }

  function onJoyPointerUp(ev){
    if(!state.active) return;
    if(state.controls.joystickPointerId !== ev.pointerId) return;
    ev.preventDefault();
    resetJoystick();
  }

  function bindUiEvents(){
    if(state.ui.attackBtn) state.ui.attackBtn.onclick = ()=>attackTiger();
    if(state.ui.captureBtn) state.ui.captureBtn.onclick = ()=>captureTiger();
    if(state.ui.shieldBtn) state.ui.shieldBtn.onclick = ()=>useShield();
    if(state.ui.rollBtn) state.ui.rollBtn.onclick = ()=>rollDodge();
    if(state.ui.sprintBtn){
      state.ui.sprintBtn.onpointerdown = (ev)=>{ ev.preventDefault(); state.controls.sprintHold = true; triggerSprint(); };
      state.ui.sprintBtn.onpointerup = (ev)=>{ ev.preventDefault(); state.controls.sprintHold = false; };
      state.ui.sprintBtn.onpointercancel = ()=>{ state.controls.sprintHold = false; };
    }
    if(state.ui.resetBtn) state.ui.resetBtn.onclick = ()=>resetScenario();
    if(state.ui.closeBtn) state.ui.closeBtn.onclick = ()=>window.close3DPrototype();

    if(state.ui.joyArea){
      state.ui.joyArea.addEventListener("pointerdown", onJoyPointerDown, { passive:false });
      state.ui.joyArea.addEventListener("pointermove", onJoyPointerMove, { passive:false });
      state.ui.joyArea.addEventListener("pointerup", onJoyPointerUp, { passive:false });
      state.ui.joyArea.addEventListener("pointercancel", onJoyPointerUp, { passive:false });
    }

    window.addEventListener("resize", resize3d, { passive:true });
    window.addEventListener("orientationchange", onOrientationChanged, { passive:true });
    document.addEventListener("visibilitychange", onVisibilityChanged);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  }

  function unbindUiEvents(){
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", resize3d);
    window.removeEventListener("orientationchange", onOrientationChanged);
    document.removeEventListener("visibilitychange", onVisibilityChanged);
  }

  function bindWorldEvents(){
    if(state.renderer && state.renderer.domElement){
      state.renderer.domElement.addEventListener("pointerdown", onWorldPointerDown, { passive:true });
    }
  }

  function unbindWorldEvents(){
    if(state.renderer && state.renderer.domElement){
      state.renderer.domElement.removeEventListener("pointerdown", onWorldPointerDown);
    }
  }

  async function ensureReady(){
    if(state.ready) return;
    if(state.opening) return;
    state.opening = true;
    try{
      const THREE = await ensureThreeLoaded();
      state.three = THREE;
      setupUIRefs();
      createWorldScene();
      bindUiEvents();
      bindWorldEvents();
      state.ready = true;
    }finally{
      state.opening = false;
    }
  }

  async function openPrototype(){
    await ensureReady();
    rememberPauseState();
    if(typeof window.closeMode === "function"){
      try{ window.closeMode(); }catch(_){}
    }
    setPauseForPrototype(true);
    state.active = true;
    if(state.overlay) state.overlay.style.display = "flex";
    document.body.classList.add("proto3dOpen");
    resize3d();
    state.clock.getDelta();
    stopRenderLoop();
    state.raf = requestAnimationFrame(renderFrame);
    setStatus("3D online. Landscape recommended.");
  }

  function closePrototype(){
    state.active = false;
    stopRenderLoop();
    resetJoystick();
    if(state.overlay) state.overlay.style.display = "none";
    if(state.overlay) state.overlay.classList.remove("combatLock");
    document.body.classList.remove("proto3dOpen");
    restorePauseState();
  }

  function forceDispose(){
    state.active = false;
    stopRenderLoop();
    unbindWorldEvents();
    unbindUiEvents();
    if(state.renderer){
      state.renderer.dispose();
      if(state.renderer.domElement && state.renderer.domElement.parentNode){
        state.renderer.domElement.parentNode.removeChild(state.renderer.domElement);
      }
    }
    state.renderer = null;
    state.scene = null;
    state.camera = null;
    state.ready = false;
  }

  window.open3DPrototype = function(){
    openPrototype().catch((err)=>{
      console.error("[TigerStrike3D] Failed to open prototype:", err);
      if(typeof window.toast === "function") window.toast("3D prototype failed to load.");
    });
  };
  window.close3DPrototype = function(){ closePrototype(); };
  window.reset3DPrototype = function(){ resetScenario(); };
  window.dispose3DPrototype = function(){ forceDispose(); };
})();
