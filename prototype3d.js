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
  const PERF_SPIKE_MS = 44;
  const PERF_CRITICAL_SPIKE_MS = 68;
  const FRAME_BUDGET_DEFAULT_MS = 11.8;
  const VFX_POOL_MAX = 48;

  const QUALITY_PRESETS = {
    high:{
      key:"high",
      maxDpr:1.5,
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
      maxDpr:1.15,
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
      maxDpr:0.95,
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
    clarity:{
      key:"clarity",
      maxDpr:1.9,
      keepRadius:3,
      dropRadius:4,
      chunkBuildPerFrame:1,
      hudIntervalMs:90,
      healthBarEveryNFrames:1,
      antialias:true,
      roadBase:1, roadVar:2,
      houseBase:1, houseVar:2,
      carBase:2, carVar:3,
      treeBase:14, treeVar:12,
      pondChance:0.4,
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
  const SHOW_COMBAT_DUEL_CHIPS = false;
  const JOY_BASE_SIZE = 124;
  const JOY_KNOB_SIZE = 54;
  const JOY_LEFT_ZONE_RATIO = 0.6;
  const JOY_DEADZONE_PX = 10;
  const CORE_SYNC_MS = 800;
  const CORE_SAVE_MIN_MS = 3400;
  const READINESS_KEY_PREFIX = "ts_3d_readiness_v1";
  const MAIN_MODE_PREF_PREFIX = "ts_3d_main_mode_pref_v1";
  const READINESS_FLUSH_MS = 4000;
  const READINESS_THRESHOLDS = Object.freeze({
    minSessions:3,
    minMissionStarts:8,
    minResolvedMissions:6,
    minActiveMinutes:12,
    minAvgFps:52,
    maxSpikesPerMin:8,
    maxCriticalSpikesPerMin:0.9,
    minClearRate:0.45,
  });

  const CIV_FOLLOW_DISTANCE = 7.2;
  const CIV_PICKUP_RADIUS = 8.2;
  const SAFE_ZONE_RADIUS = 12;
  const MISSION_DIRECTOR_TICK_MS = 220;
  const MISSION_FAIL_RESET_MS = 1800;
  const MISSION_SPAWN_MIN_CIV_TO_PLAYER = 28;
  const MISSION_SPAWN_MIN_SAFEZONE_TO_CIV = 120;
  const MISSION_SPAWN_MIN_TIGER_TO_PLAYER = 82;
  const MISSION_SPAWN_MIN_TIGER_TO_CIV = 56;
  const MISSION_SPAWN_MIN_TIGER_TO_SAFEZONE = 70;
  const BOSS_REINFORCE_COOLDOWN_MS = 9800;
  const GAMEPAD_DEADZONE = 0.18;

  const CAMERA_PRESETS = {
    tactical:{
      key:"tactical",
      label:"Preset: Tactical",
      third:{
        backLandscape:34,
        backPortrait:42,
        heightLandscape:28,
        heightPortrait:36,
        smoothXZ:6.2,
        smoothY:4.8,
      },
      first:{
        eyeY:4.1,
        pitch:-8,
        lookDist:22,
        smooth:10.5,
      },
    },
    combat:{
      key:"combat",
      label:"Preset: Combat",
      third:{
        backLandscape:28,
        backPortrait:34,
        heightLandscape:23,
        heightPortrait:29,
        smoothXZ:7.2,
        smoothY:5.5,
      },
      first:{
        eyeY:4.0,
        pitch:-6,
        lookDist:19,
        smooth:11.5,
      },
    },
    cinematic:{
      key:"cinematic",
      label:"Preset: Cinematic",
      third:{
        backLandscape:40,
        backPortrait:48,
        heightLandscape:31,
        heightPortrait:40,
        smoothXZ:5.4,
        smoothY:4.2,
      },
      first:{
        eyeY:4.2,
        pitch:-10,
        lookDist:25,
        smooth:9.6,
      },
    },
  };
  const CAMERA_PRESET_ORDER = ["tactical", "combat", "cinematic"];

  const TIGER_TYPES = [
    { name:"Standard", maxHp:120, speed:10.6, damage:9,  color:0xf59e0b, pounce:1.8 },
    { name:"Scout",    maxHp:105, speed:12.8, damage:8,  color:0xfbbf24, pounce:2.0 },
    { name:"Stalker",  maxHp:138, speed:11.9, damage:11, color:0xf97316, pounce:2.15 },
    { name:"Berserker",maxHp:162, speed:11.2, damage:13, color:0xfb7185, pounce:2.35 },
    { name:"Alpha",    maxHp:196, speed:12.2, damage:16, color:0xf43f5e, pounce:2.55 },
  ];

  const BOSS_CHAPTER_PROFILES = [
    { chapter:1,  name:"Alpha Commander", behavior:"roar" },
    { chapter:2,  name:"Blood Commander", behavior:"frenzy" },
    { chapter:3,  name:"Stealth Commander", behavior:"stealth" },
    { chapter:4,  name:"Twin Alpha", behavior:"reinforce" },
    { chapter:5,  name:"River Titan", behavior:"surge" },
    { chapter:6,  name:"Mountain Alpha", behavior:"armor" },
    { chapter:7,  name:"Legend Blood", behavior:"frenzy" },
    { chapter:8,  name:"Tiger King", behavior:"reinforce" },
    { chapter:9,  name:"Phantom King", behavior:"stealth" },
    { chapter:10, name:"Ancient Tiger", behavior:"all" },
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
    vfxBursts:[],
    vfxPool:[],
    cameraCtl:{
      mode:"third",
      preset:"tactical",
      zoomOffset:0,
      heightOffset:0,
      pitchOffset:0,
      visualMode:"auto",
      hudMode:"auto",
      camBarVisible:false,
    },
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
      joystickAnchorX:0,
      joystickAnchorY:0,
      joystickRadius:42,
      moveSmoothX:0,
      moveSmoothY:0,
      gamepad:{
        connected:false,
        moveX:0,
        moveY:0,
        lastButtons:Object.create(null),
      },
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
    nav:{
      staticScratch:[],
    },
    safeZone:null,
    guideArrow:null,
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
      phase:"rescue",
      objectiveText:"",
      pendingCivilians:0,
      aggressionMult:1,
      failed:false,
      failAt:0,
      failReason:"",
      directorTickAt:0,
      chapter:1,
      bossMission:false,
      spawnGraceUntil:0,
      bossUnit:null,
      bossPhase:0,
      bossReinforceAt:0,
      bossRoarUntil:0,
      bossPhase2Announced:false,
      bossPhase3Announced:false,
      lastPhase:"",
    },
    core:{
      enabled:false,
      mode:"Story",
      level:1,
      nextSyncAt:0,
      nextSaveAt:0,
      saveDirty:false,
      rewardCash:0,
    },
    statusText:"3D prototype loaded. Move to civilians, then escort to safe zone.",
    statusUntil:0,
    perf:{
      tier:"med",
      preset:QUALITY_PRESETS.med,
      autoEnabled:true,
      frameAccumMs:0,
      frameCount:0,
      evalAt:0,
      avgMs:16.7,
      lastFrameMs:16.7,
      spikeHits:0,
      criticalSpikeHits:0,
      lowHits:0,
      highHits:0,
      frameNo:0,
      budget:{
        frameStartAt:0,
        limitMs:FRAME_BUDGET_DEFAULT_MS,
        spentMs:0,
        skipped:0,
      },
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
    readiness:{
      loaded:false,
      dirty:false,
      data:null,
      lastFlushAt:0,
      sessionStartAt:0,
      missionActive:false,
    },
  };

  function el(id){ return document.getElementById(id); }
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function smoothStep(current, target, lambda, dt){ return lerp(current, target, 1 - Math.exp(-lambda * dt)); }

  function nowMs(){
    return (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  }

  function readinessUserKey(){
    try{
      if(typeof window.tgUserKey === "function"){
        const key = String(window.tgUserKey() || "").trim();
        if(key) return key;
      }
    }catch(_){}
    return "local";
  }

  function readinessStorageKey(){
    return `${READINESS_KEY_PREFIX}_${readinessUserKey()}`;
  }

  function mainModePrefKey(){
    return `${MAIN_MODE_PREF_PREFIX}_${readinessUserKey()}`;
  }

  function defaultReadinessData(){
    return {
      version:1,
      sessions:0,
      missionStarts:0,
      missionClears:0,
      missionFails:0,
      activeMs:0,
      frameSamples:0,
      frameMsTotal:0,
      spikeFrames:0,
      criticalFrames:0,
      lastSessionAt:0,
      lastMissionAt:0,
      updatedAt:0,
    };
  }

  function mergeReadinessData(raw){
    const base = defaultReadinessData();
    const src = (raw && typeof raw === "object") ? raw : {};
    const out = { ...base };
    out.version = 1;
    out.sessions = Math.max(0, Math.floor(Number(src.sessions || 0)));
    out.missionStarts = Math.max(0, Math.floor(Number(src.missionStarts || 0)));
    out.missionClears = Math.max(0, Math.floor(Number(src.missionClears || 0)));
    out.missionFails = Math.max(0, Math.floor(Number(src.missionFails || 0)));
    out.activeMs = Math.max(0, Math.floor(Number(src.activeMs || 0)));
    out.frameSamples = Math.max(0, Math.floor(Number(src.frameSamples || 0)));
    out.frameMsTotal = Math.max(0, Number(src.frameMsTotal || 0));
    out.spikeFrames = Math.max(0, Math.floor(Number(src.spikeFrames || 0)));
    out.criticalFrames = Math.max(0, Math.floor(Number(src.criticalFrames || 0)));
    out.lastSessionAt = Math.max(0, Math.floor(Number(src.lastSessionAt || 0)));
    out.lastMissionAt = Math.max(0, Math.floor(Number(src.lastMissionAt || 0)));
    out.updatedAt = Math.max(0, Math.floor(Number(src.updatedAt || 0)));
    return out;
  }

  function ensureReadinessData(){
    if(state.readiness.loaded && state.readiness.data) return state.readiness.data;
    let raw = null;
    try{
      raw = JSON.parse(localStorage.getItem(readinessStorageKey()) || "null");
    }catch(_){
      raw = null;
    }
    state.readiness.data = mergeReadinessData(raw);
    state.readiness.loaded = true;
    state.readiness.dirty = false;
    state.readiness.lastFlushAt = nowMs();
    return state.readiness.data;
  }

  function flushReadinessData(force=false){
    const data = ensureReadinessData();
    if(!state.readiness.dirty && !force) return;
    const now = nowMs();
    if(!force && (now - state.readiness.lastFlushAt) < READINESS_FLUSH_MS) return;
    data.updatedAt = Date.now();
    try{
      localStorage.setItem(readinessStorageKey(), JSON.stringify(data));
      state.readiness.lastFlushAt = now;
      state.readiness.dirty = false;
    }catch(_){}
  }

  function markReadinessDirty(){
    state.readiness.dirty = true;
  }

  function recordReadinessSessionStart(){
    const data = ensureReadinessData();
    data.sessions += 1;
    data.lastSessionAt = Date.now();
    state.readiness.sessionStartAt = nowMs();
    state.readiness.missionActive = false;
    markReadinessDirty();
    flushReadinessData(false);
  }

  function recordReadinessMissionStart(){
    const data = ensureReadinessData();
    data.missionStarts += 1;
    data.lastMissionAt = Date.now();
    state.readiness.missionActive = true;
    markReadinessDirty();
  }

  function recordReadinessMissionClear(){
    const data = ensureReadinessData();
    data.missionClears += 1;
    state.readiness.missionActive = false;
    markReadinessDirty();
  }

  function recordReadinessMissionFail(){
    const data = ensureReadinessData();
    data.missionFails += 1;
    state.readiness.missionActive = false;
    markReadinessDirty();
  }

  function sampleReadinessFrame(frameMs){
    const data = ensureReadinessData();
    const ms = Math.max(0, Number(frameMs || 0));
    if(ms <= 0) return;
    data.frameSamples += 1;
    data.frameMsTotal += ms;
    data.activeMs += ms;
    if(ms >= PERF_SPIKE_MS) data.spikeFrames += 1;
    if(ms >= PERF_CRITICAL_SPIKE_MS) data.criticalFrames += 1;
    markReadinessDirty();
  }

  function shouldTrackReadinessFrame(){
    const core = coreState();
    const pauseReason = String(core?.pauseReason || "");
    if(core?.paused && pauseReason && pauseReason !== "prototype3d"){
      return false;
    }
    const overlays = [
      "modeOverlay","shopOverlay","invOverlay","aboutOverlay","launchIntroOverlay",
      "dailyRewardOverlay","storyIntroOverlay","missionBriefOverlay","overOverlay",
      "completeOverlay","weaponQuickOverlay","hudOverlay",
    ];
    for(const id of overlays){
      const n = el(id);
      if(!n) continue;
      const display = String(n.style?.display || "").toLowerCase();
      if(display === "flex" || display === "block"){
        return false;
      }
    }
    return true;
  }

  function closeReadinessSession(){
    state.readiness.sessionStartAt = 0;
    state.readiness.missionActive = false;
    flushReadinessData(true);
  }

  function round1(v){
    return Math.round(Number(v || 0) * 10) / 10;
  }

  function buildReadinessReport(dataInput){
    const data = mergeReadinessData(dataInput || ensureReadinessData());
    const activeMinutes = data.activeMs / 60000;
    const avgFps = data.frameMsTotal > 0
      ? (data.frameSamples * 1000) / data.frameMsTotal
      : 0;
    const spikesPerMin = activeMinutes > 0 ? (data.spikeFrames / activeMinutes) : 0;
    const criticalPerMin = activeMinutes > 0 ? (data.criticalFrames / activeMinutes) : 0;
    const resolved = Math.max(0, data.missionClears + data.missionFails);
    const clearRate = resolved > 0 ? (data.missionClears / resolved) : 0;
    const blockers = [];
    const th = READINESS_THRESHOLDS;
    if(data.sessions < th.minSessions){
      blockers.push(`need ${th.minSessions}+ sessions (${data.sessions})`);
    }
    if(data.missionStarts < th.minMissionStarts){
      blockers.push(`need ${th.minMissionStarts}+ mission starts (${data.missionStarts})`);
    }
    if(resolved < th.minResolvedMissions){
      blockers.push(`need ${th.minResolvedMissions}+ resolved missions (${resolved})`);
    }
    if(activeMinutes < th.minActiveMinutes){
      blockers.push(`need ${th.minActiveMinutes}+ active minutes (${round1(activeMinutes)})`);
    }
    if(avgFps < th.minAvgFps){
      blockers.push(`avg FPS below ${th.minAvgFps} (${round1(avgFps)})`);
    }
    if(spikesPerMin > th.maxSpikesPerMin){
      blockers.push(`spike rate above ${th.maxSpikesPerMin}/min (${round1(spikesPerMin)})`);
    }
    if(criticalPerMin > th.maxCriticalSpikesPerMin){
      blockers.push(`critical spikes above ${th.maxCriticalSpikesPerMin}/min (${round1(criticalPerMin)})`);
    }
    if(clearRate < th.minClearRate){
      blockers.push(`clear rate below ${Math.round(th.minClearRate * 100)}% (${Math.round(clearRate * 100)}%)`);
    }
    return {
      passed:blockers.length === 0,
      blockers,
      thresholds:{ ...th },
      metrics:{
        sessions:data.sessions,
        missionStarts:data.missionStarts,
        missionClears:data.missionClears,
        missionFails:data.missionFails,
        resolvedMissions:resolved,
        activeMinutes:round1(activeMinutes),
        avgFps:round1(avgFps),
        spikesPerMin:round1(spikesPerMin),
        criticalSpikesPerMin:round1(criticalPerMin),
        clearRatePct:Math.round(clearRate * 100),
      },
      updatedAt:data.updatedAt || 0,
    };
  }

  function get3DReadinessGateStatus(){
    flushReadinessData(false);
    return buildReadinessReport(ensureReadinessData());
  }

  function refresh3DReadinessGateTelemetry(){
    flushReadinessData(true);
    return buildReadinessReport(ensureReadinessData());
  }

  function get3DMainModePreference(){
    try{
      return localStorage.getItem(mainModePrefKey()) === "1";
    }catch(_){
      return false;
    }
  }

  function set3DMainModePreference(enabled){
    const next = !!enabled;
    if(next){
      const report = get3DReadinessGateStatus();
      if(!report.passed){
        return { ok:false, enabled:false, report };
      }
    }
    try{
      localStorage.setItem(mainModePrefKey(), next ? "1" : "0");
    }catch(_){}
    return { ok:true, enabled:next, report:get3DReadinessGateStatus() };
  }

  function frameBudgetLimitForTier(){
    const tier = state.perf.tier || "med";
    const avg = Number(state.perf.avgMs || 16.7);
    let base = 11.8;
    if(tier === "high") base = 12.6;
    else if(tier === "low") base = 9.6;
    else if(tier === "clarity") base = 10.9;
    if(avg > 24) base -= 2.0;
    else if(avg > 20) base -= 1.2;
    else if(avg > 18) base -= 0.6;
    return clamp(base, 7.8, 14.5);
  }

  function beginFrameBudget(){
    state.perf.budget.frameStartAt = nowMs();
    state.perf.budget.limitMs = frameBudgetLimitForTier();
    state.perf.budget.spentMs = 0;
    state.perf.budget.skipped = 0;
  }

  function runFrameTask(fn, opts={}){
    if(typeof fn !== "function") return false;
    const critical = !!opts.critical;
    const estimatedCost = Math.max(0, Number(opts.cost || 0));
    const every = Math.max(1, Math.floor(Number(opts.every || 1)));
    if(!critical && every > 1 && (state.perf.frameNo % every) !== 0){
      state.perf.budget.skipped += 1;
      return false;
    }
    if(!critical && (state.perf.budget.spentMs + estimatedCost) > state.perf.budget.limitMs){
      state.perf.budget.skipped += 1;
      return false;
    }
    const t0 = nowMs();
    fn();
    const elapsed = Math.max(0, nowMs() - t0);
    state.perf.budget.spentMs += elapsed + estimatedCost;
    return true;
  }

  function healthBarCullDistanceForTier(){
    const tier = state.perf.tier || "med";
    if(tier === "high" || tier === "clarity") return 360;
    if(tier === "low") return 190;
    return 260;
  }

  function unitInHealthBarRange(unit){
    if(!unit || !unit.alive || !unit.healthBar) return false;
    if(unit.role === "civilian" && unit.rescued) return false;
    if(unit === state.player) return true;
    const p = state.player;
    if(!p || !p.mesh || !unit.mesh) return true;
    const maxD = healthBarCullDistanceForTier();
    const dx = unit.mesh.position.x - p.mesh.position.x;
    const dz = unit.mesh.position.z - p.mesh.position.z;
    return (dx * dx + dz * dz) <= (maxD * maxD);
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

  function currentVisualLabel(){
    switch(state.cameraCtl.visualMode){
      case "perf": return "Visual: Perf";
      case "balanced": return "Visual: Balanced";
      case "clarity": return "Visual: Clarity";
      default: return "Visual: Auto";
    }
  }

  function cameraPreset(){
    return CAMERA_PRESETS[state.cameraCtl.preset] || CAMERA_PRESETS.tactical;
  }

  function cameraPresetLabel(){
    const preset = cameraPreset();
    return preset.label || "Preset: Tactical";
  }

  function cameraModeLabel(){
    return state.cameraCtl.mode === "first" ? "Cam: 1st" : "Cam: 3rd";
  }

  function cycleCameraPreset(){
    const current = String(state.cameraCtl.preset || "tactical");
    const idx = Math.max(0, CAMERA_PRESET_ORDER.indexOf(current));
    const next = CAMERA_PRESET_ORDER[(idx + 1) % CAMERA_PRESET_ORDER.length];
    state.cameraCtl.preset = next;
    updateCameraButtons();
    setStatus(`${cameraPresetLabel()} selected.`, 1000);
  }

  function hudModeLabel(){
    switch(state.cameraCtl.hudMode){
      case "full": return "HUD: Full";
      case "compact": return "HUD: Compact";
      case "combat": return "HUD: Combat";
      default: return "HUD: Auto";
    }
  }

  function resolveHudMode(){
    const mode = String(state.cameraCtl.hudMode || "auto");
    if(mode !== "auto") return mode;
    if(state.combat.active && state.combat.target && state.combat.target.alive) return "combat";
    return "compact";
  }

  function cycleHudMode(){
    const order = ["auto", "full", "compact", "combat"];
    const current = String(state.cameraCtl.hudMode || "auto");
    const idx = Math.max(0, order.indexOf(current));
    state.cameraCtl.hudMode = order[(idx + 1) % order.length];
    updateCameraButtons();
    setStatus(`${hudModeLabel()} selected.`, 1000);
  }

  function applyVisualModeSetting(){
    const mode = state.cameraCtl.visualMode || "auto";
    if(mode === "auto"){
      state.perf.autoEnabled = true;
      return;
    }
    state.perf.autoEnabled = false;
    if(mode === "perf") applyQualityTier("low");
    else if(mode === "balanced") applyQualityTier("med");
    else if(mode === "clarity") applyQualityTier("clarity");
  }

  function updateCameraButtons(){
    if(state.ui.camModeBtn) state.ui.camModeBtn.innerText = cameraModeLabel();
    if(state.ui.camPresetBtn) state.ui.camPresetBtn.innerText = cameraPresetLabel();
    if(state.ui.hudModeBtn) state.ui.hudModeBtn.innerText = hudModeLabel();
    if(state.ui.qualityBtn) state.ui.qualityBtn.innerText = currentVisualLabel();
    if(state.ui.camToggleBtn){
      state.ui.camToggleBtn.innerText = state.cameraCtl.camBarVisible ? "Camera UI: ON" : "Camera UI: OFF";
    }
    if(state.ui.camBar){
      state.ui.camBar.classList.toggle("hidden", !state.cameraCtl.camBarVisible);
    }
  }

  function setCamBarVisible(on){
    state.cameraCtl.camBarVisible = !!on;
    updateCameraButtons();
  }

  function toggleCamBarVisible(){
    setCamBarVisible(!state.cameraCtl.camBarVisible);
  }

  function evaluatePerformanceTier(){
    if(!state.perf.autoEnabled) return;
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
    const spikeHits = Math.max(0, Math.floor(state.perf.spikeHits || 0));
    const criticalSpikeHits = Math.max(0, Math.floor(state.perf.criticalSpikeHits || 0));

    if(avg > 23.5) state.perf.lowHits += 1;
    else state.perf.lowHits = Math.max(0, state.perf.lowHits - 1);

    if(avg < 17.1) state.perf.highHits += 1;
    else state.perf.highHits = Math.max(0, state.perf.highHits - 1);

    if(criticalSpikeHits >= 2 || avg > 33){
      state.perf.lowHits = 0;
      state.perf.highHits = 0;
      applyQualityTier("low", "auto");
      return;
    }

    if(state.perf.tier === "high" && (state.perf.lowHits >= 2 || spikeHits >= 4 || avg > 26.5)){
      state.perf.lowHits = 0;
      applyQualityTier("med", "auto");
      return;
    }
    if(state.perf.tier === "med" && (state.perf.lowHits >= 2 || spikeHits >= 6 || avg > 29)){
      state.perf.lowHits = 0;
      applyQualityTier("low", "auto");
      return;
    }
    if(state.perf.tier === "low" && state.perf.highHits >= 4 && spikeHits <= 1){
      state.perf.highHits = 0;
      applyQualityTier("med", "auto");
      return;
    }
    if(state.perf.tier === "med" && state.perf.highHits >= 5 && spikeHits === 0 && avg < 16.5){
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

  function coreState(){
    const src = window.S;
    return (src && typeof src === "object") ? src : null;
  }

  function coreModeName(core){
    const mode = String(core?.mode || "Story");
    if(mode === "Arcade" || mode === "Survival") return mode;
    return "Story";
  }

  function coreModeLevel(core){
    const mode = coreModeName(core);
    if(mode === "Arcade"){
      return Math.max(1, Math.floor(Number(core?.arcadeLevel || 1)));
    }
    if(mode === "Survival"){
      return Math.max(1, Math.floor(Number(core?.survivalWave || 1)));
    }
    return Math.max(
      1,
      Math.floor(
        Number(core?.storyLevel || core?.storyLastMission || 1)
      )
    );
  }

  function ensureCoreBuckets(core){
    if(!core || typeof core !== "object") return;
    if(!core.stats || typeof core.stats !== "object"){
      core.stats = { shots:0, captures:0, kills:0, evac:0, cashEarned:0, trapsPlaced:0, trapsTriggered:0 };
    }
    if(!core.opsTotals || typeof core.opsTotals !== "object"){
      core.opsTotals = { kills:0, captures:0, evac:0, civiliansLost:0, missionsCleared:0, cashEarned:0 };
    }
    if(!core.modeWallets || typeof core.modeWallets !== "object"){
      const funds = Math.max(0, Math.round(Number(core.funds || 1000)));
      core.modeWallets = { Story:funds, Arcade:funds, Survival:funds };
    }
    if(!Number.isFinite(Number(core.funds))) core.funds = 0;
    if(!Number.isFinite(Number(core.hp))) core.hp = 100;
    if(!Number.isFinite(Number(core.armorCap)) || Number(core.armorCap) <= 0) core.armorCap = 100;
    if(!Number.isFinite(Number(core.armor))) core.armor = 0;
    if(!Number.isFinite(Number(core.stamina))) core.stamina = 100;
    if(!Number.isFinite(Number(core.shields))) core.shields = 0;
    if(!core.abilityCooldowns || typeof core.abilityCooldowns !== "object"){
      core.abilityCooldowns = { scan:0, sprint:0, shield:0 };
    }
  }

  function coreMissionCivilianTarget(core){
    const fromLive = Array.isArray(core?.civilians)
      ? core.civilians.filter((c)=>c && c.alive !== false && !c.evac).length
      : 0;
    if(fromLive > 0) return clamp(fromLive, 2, 12);
    const lv = coreModeLevel(core);
    return clamp(2 + Math.floor((lv - 1) * 0.16), 2, 12);
  }

  function coreMissionTigerTarget(core){
    const fromLive = Array.isArray(core?.tigers)
      ? core.tigers.filter((t)=>t && t.alive !== false).length
      : 0;
    if(fromLive > 0) return clamp(fromLive, 2, 14);
    const lv = coreModeLevel(core);
    return clamp(2 + Math.floor((lv - 1) * 0.18), 2, 14);
  }

  function markCoreDirty(){
    if(!state.core.enabled) return;
    state.core.saveDirty = true;
  }

  function syncCoreVitals(force=false){
    const core = coreState();
    if(!core || !state.player) return;
    const now = state.now || nowMs();
    if(!force && now < state.core.nextSyncAt) return;
    ensureCoreBuckets(core);
    const hp = clamp(Math.round(Number(state.player.hp || 0)), 0, 100);
    const armorCap = Math.max(100, Math.round(Number(state.player.maxArmor || core.armorCap || 100)));
    const armor = clamp(Math.round(Number(state.player.armor || 0)), 0, armorCap);
    const stamina = clamp(Math.round(Number(state.player.stamina || 0)), 0, 100);
    const shieldUntil = Math.max(0, Math.floor(Number(state.fx.shieldUntil || 0)));
    let changed = false;
    if(core.hp !== hp){ core.hp = hp; changed = true; }
    if(core.armorCap !== armorCap){ core.armorCap = armorCap; changed = true; }
    if(core.armor !== armor){ core.armor = armor; changed = true; }
    if(core.stamina !== stamina){ core.stamina = stamina; changed = true; }
    if(core.shieldUntil !== shieldUntil){ core.shieldUntil = shieldUntil; changed = true; }
    state.core.nextSyncAt = now + CORE_SYNC_MS;
    if(changed) markCoreDirty();
  }

  function addCoreCash(amount){
    const core = coreState();
    if(!core) return;
    const add = Math.max(0, Math.round(Number(amount || 0)));
    if(add <= 0) return;
    ensureCoreBuckets(core);
    const mode = coreModeName(core);
    const currentWallet = Math.max(0, Math.round(Number(core.modeWallets?.[mode] || core.funds || 0)));
    const next = currentWallet + add;
    core.modeWallets[mode] = next;
    core.funds = next;
    core.stats.cashEarned = Math.max(0, Math.round(Number(core.stats.cashEarned || 0))) + add;
    core.opsTotals.cashEarned = Math.max(0, Math.round(Number(core.opsTotals.cashEarned || 0))) + add;
    state.core.rewardCash += add;
    markCoreDirty();
  }

  function addCoreStat(key, amount){
    const core = coreState();
    if(!core) return;
    const add = Math.max(0, Math.floor(Number(amount || 0)));
    if(add <= 0) return;
    ensureCoreBuckets(core);
    core.stats[key] = Math.max(0, Math.floor(Number(core.stats[key] || 0))) + add;
    if(key === "kills" || key === "captures" || key === "evac"){
      core.opsTotals[key] = Math.max(0, Math.floor(Number(core.opsTotals[key] || 0))) + add;
    }
    markCoreDirty();
  }

  function markCoreMissionClear(){
    const core = coreState();
    if(!core) return;
    ensureCoreBuckets(core);
    core.opsTotals.missionsCleared = Math.max(0, Math.floor(Number(core.opsTotals.missionsCleared || 0))) + 1;
    markCoreDirty();
  }

  function saveCoreProgress(force=false){
    if(!state.core.enabled) return;
    const now = state.now || nowMs();
    if(!force && !state.core.saveDirty) return;
    if(!force && now < state.core.nextSaveAt) return;
    syncCoreVitals(true);
    state.core.nextSaveAt = now + CORE_SAVE_MIN_MS;
    state.core.saveDirty = false;
    try{
      if(typeof window.forceSaveNow === "function"){
        window.forceSaveNow();
        return;
      }
      if(force){
        const core = coreState();
        if(core && coreModeName(core) === "Story" && typeof window.saveGameNow === "function"){
          window.saveGameNow();
        }
      }
    }catch(_){}
  }

  function beginCoreSession(){
    const core = coreState();
    state.core.enabled = !!core;
    state.core.mode = "Story";
    state.core.level = 1;
    state.core.nextSyncAt = 0;
    state.core.nextSaveAt = 0;
    state.core.saveDirty = false;
    state.core.rewardCash = 0;
    if(!core) return null;
    ensureCoreBuckets(core);
    state.core.mode = coreModeName(core);
    state.core.level = coreModeLevel(core);
    return core;
  }

  function manualAdvanceCoreProgressionFallback(){
    const core = coreState();
    if(!core) return;
    ensureCoreBuckets(core);
    const mode = coreModeName(core);
    if(mode === "Story"){
      const cap = 100;
      const nextStory = clamp(
        Math.floor(Number(core.storyLevel || core.storyLastMission || 1)) + 1,
        1,
        cap
      );
      core.storyLevel = nextStory;
      core.storyLastMission = Math.max(
        Math.floor(Number(core.storyLastMission || 1)),
        nextStory
      );
      core.mode = "Story";
    }else if(mode === "Arcade"){
      const cap = 100;
      core.arcadeLevel = clamp(Math.floor(Number(core.arcadeLevel || 1)) + 1, 1, cap);
      core.mode = "Arcade";
    }else{
      core.survivalWave = Math.max(1, Math.floor(Number(core.survivalWave || 1)) + 1);
      core.mode = "Survival";
    }
    markCoreDirty();
    saveCoreProgress(true);
  }

  function advanceMissionParityAndReset3D(){
    syncCoreVitals(true);
    const coreBefore = coreState();
    const beforeMode = coreModeName(coreBefore);
    const beforeLevel = coreModeLevel(coreBefore);

    let used2dFlow = false;
    if(typeof window.startNextMission === "function"){
      try{
        window.startNextMission();
        used2dFlow = true;
      }catch(_){}
    }
    if(!used2dFlow){
      manualAdvanceCoreProgressionFallback();
    }

    if(typeof window.closeMissionBrief === "function"){
      try{ window.closeMissionBrief(true); }catch(_){}
    }

    setPauseForPrototype(true);
    beginCoreSession();
    const coreAfter = coreState();
    const afterMode = coreModeName(coreAfter);
    const afterLevel = coreModeLevel(coreAfter);
    resetScenario();

    const modeWord = afterMode === "Survival" ? "Wave" : "Mission";
    const advanced = (afterMode !== beforeMode) || (afterLevel > beforeLevel);
    if(advanced){
      setStatus(`3D clear synced. ${afterMode} ${modeWord} ${afterLevel} is now active.`, 2600);
    }else{
      setStatus(`3D clear synced. ${afterMode} progression updated.`, 2200);
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
      camBar: el("proto3dCamBar"),
      camToggleBtn: el("proto3dCamToggleBtn"),
      camModeBtn: el("proto3dCamModeBtn"),
      camPresetBtn: el("proto3dCamPresetBtn"),
      hudModeBtn: el("proto3dHudModeBtn"),
      zoomOutBtn: el("proto3dZoomOutBtn"),
      zoomInBtn: el("proto3dZoomInBtn"),
      pitchDownBtn: el("proto3dPitchDownBtn"),
      pitchUpBtn: el("proto3dPitchUpBtn"),
      heightDownBtn: el("proto3dHeightDownBtn"),
      heightUpBtn: el("proto3dHeightUpBtn"),
      qualityBtn: el("proto3dQualityBtn"),
      menuBtn: el("proto3dMenuBtn"),
      shopBtn: el("proto3dShopBtn"),
      inventoryBtn: el("proto3dInventoryBtn"),
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

  function normalizeAngle(a){
    let out = Number(a || 0);
    while(out > Math.PI) out -= Math.PI * 2;
    while(out < -Math.PI) out += Math.PI * 2;
    return out;
  }

  function lerpAngle(from, to, t){
    const ff = Number(from || 0);
    const tt = Number(to || 0);
    const k = clamp(Number(t || 0), 0, 1);
    const delta = normalizeAngle(tt - ff);
    return ff + (delta * k);
  }

  function unitNavRadius(unit){
    if(!unit) return 1.0;
    if(unit.role === "player") return 1.12;
    if(unit.role === "tiger") return 1.54;
    if(unit.role === "civilian") return 0.96;
    return 1.04;
  }

  function gatherNearbyStaticColliders(x, z, range=18){
    const out = state.nav.staticScratch;
    out.length = 0;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const ring = Math.max(1, Math.ceil(Math.max(4, Number(range || 18)) / CHUNK_SIZE) + 1);
    for(let dz=-ring; dz<=ring; dz++){
      for(let dx=-ring; dx<=ring; dx++){
        const chunk = state.chunks.get(`${cx + dx}:${cz + dz}`);
        if(!chunk || !Array.isArray(chunk.colliders) || !chunk.colliders.length) continue;
        for(let i=0; i<chunk.colliders.length; i++){
          out.push(chunk.colliders[i]);
        }
      }
    }
    return out;
  }

  function isBlockedByStatic(unit, x, z, opts={}){
    const navR = Number.isFinite(opts.radius) ? opts.radius : unitNavRadius(unit);
    const colliders = gatherNearbyStaticColliders(x, z, navR + 10);
    for(let i=0; i<colliders.length; i++){
      const c = colliders[i];
      if(!c) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const minD = navR + c.r;
      if((dx * dx + dz * dz) < (minD * minD)){
        return true;
      }
    }
    return false;
  }

  function freeClearanceAt(unit, x, z, opts={}){
    const navR = Number.isFinite(opts.radius) ? opts.radius : unitNavRadius(unit);
    const colliders = gatherNearbyStaticColliders(x, z, navR + 12);
    let best = 9999;
    for(let i=0; i<colliders.length; i++){
      const c = colliders[i];
      if(!c) continue;
      const dx = x - c.x;
      const dz = z - c.z;
      const d = Math.hypot(dx, dz) - (navR + c.r);
      if(d < best) best = d;
    }
    return best;
  }

  function resolveStaticOverlap(unit){
    if(!unit || !unit.alive || !unit.mesh) return;
    const navR = unitNavRadius(unit);
    const pos = unit.mesh.position;
    const colliders = gatherNearbyStaticColliders(pos.x, pos.z, navR + 10);
    for(let iter=0; iter<2; iter++){
      let nudged = false;
      for(let i=0; i<colliders.length; i++){
        const c = colliders[i];
        if(!c) continue;
        let dx = pos.x - c.x;
        let dz = pos.z - c.z;
        let d = Math.hypot(dx, dz);
        const minD = navR + c.r;
        if(d >= minD) continue;
        if(d < 0.001){
          const a = hash01(Math.floor(pos.x), Math.floor(pos.z), i + iter * 17) * Math.PI * 2;
          dx = Math.cos(a);
          dz = Math.sin(a);
          d = 1;
        }
        const push = (minD - d) + 0.02;
        pos.x += (dx / d) * push;
        pos.z += (dz / d) * push;
        nudged = true;
      }
      if(!nudged) break;
    }
  }

  function moveByAngleWithCollision(unit, angle, step, opts={}){
    if(!unit || !unit.mesh) return 0;
    const dist = Math.max(0, Number(step || 0));
    if(dist <= 0.0001) return 0;
    const pos = unit.mesh.position;
    const baseYaw = normalizeAngle(Number(angle || 0));
    const offsets = [0, 0.20, -0.20, 0.42, -0.42, 0.74, -0.74, 1.02, -1.02];
    let best = null;
    let bestScore = -1e9;
    for(let i=0; i<offsets.length; i++){
      const yaw = normalizeAngle(baseYaw + offsets[i]);
      const nx = Math.sin(yaw);
      const nz = Math.cos(yaw);
      const tx = pos.x + nx * dist;
      const tz = pos.z + nz * dist;
      if(isBlockedByStatic(unit, tx, tz, opts)) continue;
      const align = Math.cos(normalizeAngle(yaw - baseYaw));
      const clearance = freeClearanceAt(unit, tx, tz, opts);
      const score = (align * 3.4) + Math.min(5.5, clearance * 0.18) - (Math.abs(offsets[i]) * 0.14);
      if(score > bestScore){
        bestScore = score;
        best = { yaw, tx, tz };
      }
    }
    if(!best){
      if(opts.allowSlide){
        const reduced = dist * 0.42;
        if(reduced > 0.03){
          return moveByAngleWithCollision(unit, baseYaw, reduced, { ...opts, allowSlide:false });
        }
      }
      return 0;
    }
    const moved = Math.hypot(best.tx - pos.x, best.tz - pos.z);
    pos.x = best.tx;
    pos.z = best.tz;
    const turnLerp = Number.isFinite(opts.turnLerp) ? clamp(opts.turnLerp, 0.05, 1) : clamp(1 - Math.exp(-14 * state.dt), 0.05, 1);
    unit.mesh.rotation.y = lerpAngle(unit.mesh.rotation.y, best.yaw, turnLerp);
    resolveStaticOverlap(unit);
    return moved;
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
    const visible = unitInHealthBarRange(unit);
    if(unit.healthBar.root) unit.healthBar.root.visible = visible;
    if(!visible) return;
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
      if(unit && unit.healthBar && unit.healthBar.root && unit.healthBar.root.visible){
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

  function createGuideArrow(){
    const THREE = state.three;
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 1.95, 12),
      new THREE.MeshBasicMaterial({ color:0x7dd3fc, transparent:true, opacity:0.95, depthWrite:false })
    );
    shaft.rotation.x = Math.PI * 0.5;
    shaft.position.z = 0.86;
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.05, 12),
      new THREE.MeshBasicMaterial({ color:0xbfe6ff, transparent:true, opacity:0.98, depthWrite:false })
    );
    head.rotation.x = Math.PI * 0.5;
    head.position.z = 1.82;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.62, 20),
      new THREE.MeshBasicMaterial({ color:0x34d399, transparent:true, opacity:0.72, depthWrite:false, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.position.y = -0.18;
    ring.renderOrder = 27;
    g.add(shaft, head, ring);
    g.visible = false;
    g.renderOrder = 28;
    state.effectsRoot.add(g);
    state.guideArrow = { mesh:g, ring };
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

  function createClawArc(parent, color=0xf59e0b){
    const THREE = state.three;
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.12, 8, 22, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.86, depthWrite:false })
    );
    arc.position.set(1.95, 1.45, 0);
    arc.rotation.y = Math.PI * 0.5;
    arc.visible = false;
    arc.renderOrder = 33;
    parent.add(arc);
    return arc;
  }

  function ensureFloatingLabel(unit, tint="#cfe8ff"){
    if(!unit || !unit.mesh) return null;
    if(unit.floatLabel) return unit.floatLabel;
    const THREE = state.three;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if(!ctx) return null;
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    if(THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map:tex,
      transparent:true,
      depthWrite:false,
      depthTest:true,
      opacity:0.95,
    }));
    sprite.scale.set(7.1, 1.75, 1);
    sprite.position.set(0, unit.role === "player" ? 7.2 : 6.8, 0);
    sprite.visible = false;
    sprite.renderOrder = 54;
    unit.mesh.add(sprite);
    unit.floatLabel = {
      canvas,
      ctx,
      tex,
      sprite,
      lastText:"",
      lastTint:"",
      tint,
    };
    return unit.floatLabel;
  }

  function drawFloatingLabel(unit, text, tint){
    const label = ensureFloatingLabel(unit, tint || "#cfe8ff");
    if(!label || !label.ctx) return;
    const safeText = String(text || "");
    const safeTint = String(tint || label.tint || "#cfe8ff");
    if(label.lastText === safeText && label.lastTint === safeTint){
      label.sprite.visible = true;
      return;
    }
    label.lastText = safeText;
    label.lastTint = safeTint;
    label.ctx.clearRect(0, 0, label.canvas.width, label.canvas.height);
    label.ctx.fillStyle = "rgba(7, 12, 21, 0.88)";
    label.ctx.strokeStyle = "rgba(53, 98, 171, 0.9)";
    label.ctx.lineWidth = 4;
    if(typeof label.ctx.roundRect === "function"){
      label.ctx.beginPath();
      label.ctx.roundRect(6, 6, label.canvas.width - 12, label.canvas.height - 12, 20);
      label.ctx.fill();
      label.ctx.stroke();
    }else{
      label.ctx.fillRect(6, 6, label.canvas.width - 12, label.canvas.height - 12);
      label.ctx.strokeRect(6, 6, label.canvas.width - 12, label.canvas.height - 12);
    }
    label.ctx.fillStyle = safeTint;
    label.ctx.font = "bold 28px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    label.ctx.textAlign = "center";
    label.ctx.textBaseline = "middle";
    label.ctx.fillText(safeText, label.canvas.width * 0.5, label.canvas.height * 0.54);
    label.tex.needsUpdate = true;
    label.sprite.visible = true;
  }

  function hideFloatingLabel(unit){
    if(unit && unit.floatLabel && unit.floatLabel.sprite){
      unit.floatLabel.sprite.visible = false;
    }
  }

  function releaseImpactFx(fx){
    if(!fx) return;
    fx.active = false;
    fx.born = 0;
    fx.duration = 220;
    fx.startY = 0;
    if(fx.mesh){
      fx.mesh.visible = false;
      fx.mesh.scale.set(1, 1, 1);
      fx.mesh.position.set(0, -9999, 0);
    }
    if(fx.core && fx.core.material){
      fx.core.material.opacity = 0;
    }
    if(fx.ring && fx.ring.material){
      fx.ring.material.opacity = 0;
    }
    if(fx.slash && fx.slash.material){
      fx.slash.visible = false;
      fx.slash.material.opacity = 0;
    }
  }

  function makeImpactFxSlot(){
    if(!state.three || !state.effectsRoot) return null;
    const THREE = state.three;
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshBasicMaterial({ color:0xfbbf24, transparent:true, opacity:0, depthWrite:false })
    );
    core.renderOrder = 52;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.24, 0.42, 20),
      new THREE.MeshBasicMaterial({ color:0xfbbf24, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI * 0.5;
    ring.renderOrder = 53;
    const slash = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.2),
      new THREE.MeshBasicMaterial({ color:0xfbbf24, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide })
    );
    slash.position.y = 0.16;
    slash.rotation.y = Math.PI * 0.18;
    slash.visible = false;
    slash.renderOrder = 53;
    group.add(core, ring, slash);
    group.visible = false;
    group.position.set(0, -9999, 0);
    state.effectsRoot.add(group);
    return {
      mesh:group,
      core,
      ring,
      slash,
      born:0,
      duration:220,
      startY:0,
      active:false,
    };
  }

  function acquireImpactFx(){
    for(const fx of state.vfxPool){
      if(fx && !fx.active){
        return fx;
      }
    }
    if(state.vfxPool.length < VFX_POOL_MAX){
      const created = makeImpactFxSlot();
      if(created){
        state.vfxPool.push(created);
        return created;
      }
    }
    const recycled = state.vfxBursts.shift();
    if(recycled){
      releaseImpactFx(recycled);
      return recycled;
    }
    return null;
  }

  function spawnImpactFx(unit, color=0xfbbf24, kind="hit"){
    if(!unit || !unit.mesh || !state.effectsRoot) return;
    const fx = acquireImpactFx();
    if(!fx) return;

    const tier = state.perf.tier || "med";
    const activeCap = (tier === "low") ? 18 : (tier === "med" ? 28 : (tier === "high" ? 40 : 44));
    while(state.vfxBursts.length >= activeCap){
      const old = state.vfxBursts.shift();
      if(!old) break;
      releaseImpactFx(old);
    }

    const born = state.now || nowMs();
    const y = unit.mesh.position.y + 1.25;
    fx.active = true;
    fx.born = born;
    fx.duration = (kind === "pounce") ? 300 : 220;
    fx.startY = y;
    fx.mesh.visible = true;
    fx.mesh.position.set(unit.mesh.position.x, y, unit.mesh.position.z);
    fx.mesh.scale.set(1, 1, 1);

    if(fx.core && fx.core.material){
      fx.core.material.color.setHex(color);
      fx.core.material.opacity = 0.95;
    }
    if(fx.ring && fx.ring.material){
      fx.ring.material.color.setHex(color);
      fx.ring.material.opacity = 0.84;
    }
    if(fx.slash){
      const showSlash = (kind === "claw" || kind === "pounce");
      fx.slash.visible = showSlash;
      if(fx.slash.material){
        fx.slash.material.color.setHex(color);
        fx.slash.material.opacity = showSlash ? 0.76 : 0;
      }
      if(showSlash){
        fx.slash.position.y = (kind === "pounce") ? 0.2 : 0.16;
        fx.slash.rotation.y = Math.PI * (kind === "pounce" ? 0.32 : 0.18) + (Math.random() - 0.5) * 0.22;
        const s = (kind === "pounce") ? 1.2 : 1;
        fx.slash.scale.set(s, 1, 1);
      }
    }
    state.vfxBursts.push(fx);
  }

  function updateImpactFx(){
    const now = state.now || nowMs();
    for(let i=state.vfxBursts.length - 1; i>=0; i--){
      const fx = state.vfxBursts[i];
      if(!fx || !fx.active){
        state.vfxBursts.splice(i, 1);
        continue;
      }
      const t = clamp((now - fx.born) / Math.max(1, fx.duration), 0, 1);
      const k = 1 + t * 1.45;
      fx.mesh.scale.set(k, k, k);
      fx.mesh.position.y = fx.startY + t * 0.42;
      if(fx.core && fx.core.material) fx.core.material.opacity = 0.95 * (1 - t);
      if(fx.ring && fx.ring.material) fx.ring.material.opacity = 0.84 * (1 - t);
      if(fx.slash && fx.slash.material) fx.slash.material.opacity = (fx.slash.visible ? 0.72 : 0) * (1 - t);
      if(t >= 1){
        releaseImpactFx(fx);
        state.vfxBursts.splice(i, 1);
      }
    }
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
    state.mission.phase = "rescue";
    state.mission.objectiveText = "";
    state.mission.pendingCivilians = 0;
    state.mission.aggressionMult = 1;
    state.mission.failed = false;
    state.mission.failAt = 0;
    state.mission.failReason = "";
    state.mission.directorTickAt = 0;
    state.mission.chapter = 1;
    state.mission.bossMission = false;
    state.mission.spawnGraceUntil = 0;
    state.mission.bossUnit = null;
    state.mission.bossPhase = 0;
    state.mission.bossReinforceAt = 0;
    state.mission.bossRoarUntil = 0;
    state.mission.bossPhase2Announced = false;
    state.mission.bossPhase3Announced = false;
    state.mission.lastPhase = "";
  }

  function missionLevel(){
    return Math.max(1, Math.floor(Number(state.core.level || 1)));
  }

  function missionChapter(level){
    return clamp(Math.floor((Math.max(1, Number(level || 1)) - 1) / 10) + 1, 1, 10);
  }

  function isStoryBossMission(core, level){
    return coreModeName(core) === "Story" && (Math.max(1, Number(level || 1)) % 10 === 0);
  }

  function bossProfileForChapter(chapter){
    const ch = clamp(Math.floor(Number(chapter || 1)), 1, 10);
    return BOSS_CHAPTER_PROFILES[ch - 1] || BOSS_CHAPTER_PROFILES[0];
  }

  function distSqXZ(a, b){
    const dx = Number(a.x || 0) - Number(b.x || 0);
    const dz = Number(a.z || 0) - Number(b.z || 0);
    return (dx * dx) + (dz * dz);
  }

  function minDistToList(pos, list){
    if(!Array.isArray(list) || list.length === 0) return Infinity;
    let best = Infinity;
    for(const p of list){
      const d2 = distSqXZ(pos, p);
      if(d2 < best) best = d2;
    }
    return Math.sqrt(best);
  }

  function randomSpawnPoint(seedA, seedB, index, minR, maxR, jitter=20){
    const t = hash01(seedA, seedB, 911 + (index * 7));
    const a = (Math.PI * 2 * t) + ((hash01(seedA, seedB, 917 + (index * 9)) - 0.5) * 0.52);
    const r = minR + (hash01(seedA, seedB, 923 + (index * 11)) * Math.max(1, maxR - minR));
    const jx = (hash01(seedA, seedB, 929 + (index * 13)) - 0.5) * jitter;
    const jz = (hash01(seedA, seedB, 937 + (index * 15)) - 0.5) * jitter;
    return new state.three.Vector3(
      Math.cos(a) * r + jx,
      0,
      Math.sin(a) * r + jz
    );
  }

  function buildCivilianSpawns(civTarget, level){
    const spots = [];
    const playerPos = { x:0, z:0 };
    for(let i=0; i<civTarget; i++){
      let picked = null;
      for(let tries=0; tries<56; tries++){
        const idx = i * 67 + tries;
        const candidate = randomSpawnPoint(level + 17, civTarget + 31, idx, 70, 205, 28);
        const dPlayer = Math.sqrt(distSqXZ(candidate, playerPos));
        if(dPlayer < MISSION_SPAWN_MIN_CIV_TO_PLAYER) continue;
        const dCivs = minDistToList(candidate, spots);
        if(dCivs < 14) continue;
        picked = candidate;
        break;
      }
      if(!picked){
        picked = randomSpawnPoint(level + 41, civTarget + 53, i + 1, 80, 190, 16);
      }
      spots.push(picked);
    }
    return spots;
  }

  function chooseSafeZonePosition(civilianSpawns, level){
    const playerPos = { x:0, z:0 };
    const candidates = [];
    for(let i=0; i<14; i++){
      candidates.push(randomSpawnPoint(level + 71, civilianSpawns.length + 19, i + 1, 150, 280, 34));
    }
    let best = candidates[0] || new state.three.Vector3(180, 0, -180);
    let bestScore = -Infinity;
    for(const c of candidates){
      const dCivs = minDistToList(c, civilianSpawns);
      const dPlayer = Math.sqrt(distSqXZ(c, playerPos));
      const score = (dCivs * 1.25) + (dPlayer * 0.8);
      if(score > bestScore){
        bestScore = score;
        best = c;
      }
    }
    if(minDistToList(best, civilianSpawns) < MISSION_SPAWN_MIN_SAFEZONE_TO_CIV){
      best = randomSpawnPoint(level + 211, civilianSpawns.length + 101, 1, 220, 305, 10);
    }
    return best;
  }

  function selectTigerTypeForMission(level, i, bossMission){
    const baseTier = clamp(Math.floor((Math.max(1, level) - 1) / 14), 0, TIGER_TYPES.length - 1);
    const jitter = Math.floor(hash01(level, i + 1, 83 + i) * 3);
    let typeIndex = clamp(baseTier + jitter, 0, TIGER_TYPES.length - 1);
    if(bossMission && i === 0){
      typeIndex = TIGER_TYPES.length - 1;
    }
    return TIGER_TYPES[typeIndex];
  }

  function buildTigerSpawnPlan(tigerTarget, level, civilianSpawns, safeZonePos, bossMission){
    const plan = [];
    const playerPos = { x:0, z:0 };
    for(let i=0; i<tigerTarget; i++){
      const type = selectTigerTypeForMission(level, i, bossMission);
      let picked = null;
      for(let tries=0; tries<80; tries++){
        const idx = i * 131 + tries;
        const minR = (bossMission && i === 0) ? 165 : 120;
        const maxR = (bossMission && i === 0) ? 290 : 250;
        const candidate = randomSpawnPoint(level + 137, tigerTarget + 47, idx, minR, maxR, 30);
        const dPlayer = Math.sqrt(distSqXZ(candidate, playerPos));
        const dCivs = minDistToList(candidate, civilianSpawns);
        const dSafe = Math.sqrt(distSqXZ(candidate, safeZonePos));
        const dOther = minDistToList(candidate, plan.map((p)=>p.pos));
        if(dPlayer < MISSION_SPAWN_MIN_TIGER_TO_PLAYER) continue;
        if(dCivs < MISSION_SPAWN_MIN_TIGER_TO_CIV) continue;
        if(dSafe < MISSION_SPAWN_MIN_TIGER_TO_SAFEZONE) continue;
        if(dOther < 18) continue;
        picked = candidate;
        break;
      }
      if(!picked){
        picked = randomSpawnPoint(level + 177, tigerTarget + 59, i + 1, 160, 290, 20);
      }
      plan.push({ pos:picked, type, isBoss:(bossMission && i === 0) });
    }
    return plan;
  }

  function missionObjectiveText(){
    if(state.mission.failed){
      return `FAIL: ${state.mission.failReason || "Mission failed"}. Resetting...`;
    }
    const aliveTigers = state.tigers.filter((t)=>t.alive).length;
    const pending = state.civilians.filter((c)=>c.alive && !c.rescued).length;
    if(state.mission.phase === "rescue"){
      return `Rescue civilians (${state.mission.rescued}/${state.mission.totalCivilians}). Pending ${pending}.`;
    }
    if(state.mission.phase === "clear"){
      return `All civilians safe. Clear remaining tigers (${aliveTigers} left).`;
    }
    if(state.mission.phase === "boss"){
      const boss = state.mission.bossUnit;
      if(boss && boss.alive){
        const hpPct = Math.round((boss.hp / Math.max(1, boss.maxHp)) * 100);
        return `Boss ${boss.name} phase ${state.mission.bossPhase}/3 • HP ${hpPct}%`;
      }
      return `Boss down. Clean up remaining tigers (${aliveTigers} left).`;
    }
    if(state.mission.phase === "complete"){
      return "Mission clear. Well done.";
    }
    return "Move out and secure the sector.";
  }

  function resetScenario(){
    clearWorldUnits();
    const THREE = state.three;
    const core = beginCoreSession();
    const missionLv = missionLevel();
    const chapter = missionChapter(missionLv);
    const bossMission = isStoryBossMission(core, missionLv);
    const bossProfile = bossProfileForChapter(chapter);
    const civTarget = coreMissionCivilianTarget(core);
    const tigerTarget = coreMissionTigerTarget(core);
    const startHp = core ? clamp(Math.round(Number(core.hp || 100)), 1, 100) : 100;
    const startArmorCap = core ? Math.max(100, Math.round(Number(core.armorCap || 100))) : 100;
    const startArmor = core ? clamp(Math.round(Number(core.armor || 20)), 0, startArmorCap) : 80;
    const startStamina = core ? clamp(Math.round(Number(core.stamina || 100)), 0, 100) : 100;
    const playerName = core && String(core.title || "").trim() ? String(core.title).trim() : "Commander";

    const player = createUnit({
      id:"player",
      role:"player",
      mesh:makeSoldierMesh(0x3b82f6),
      maxHp:100,
      hp:startHp,
      maxStamina:100,
      stamina:startStamina,
      armor:startArmor,
      maxArmor:startArmorCap,
      speed:PLAYER_BASE_SPEED,
      position:new THREE.Vector3(0, 0, 0),
      name:playerName,
    });
    addHealthBar(player, 0x4ade80);
    player.ring = createSelectionRing(player.mesh, 0x22d3ee, 2.4);
    player.ring.visible = true;
    state.player = player;

    const attackerOwned = core ? Math.max(0, Math.floor(Number(core.soldierAttackersOwned || 0))) : 1;
    const rescuerOwned = core ? Math.max(0, Math.floor(Number(core.soldierRescuersOwned || 0))) : 1;
    if(attackerOwned > 0){
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
      state.squad.push(squadA);
    }
    if(rescuerOwned > 0){
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
      state.squad.push(squadB);
    }

    const civilianSpawns = buildCivilianSpawns(civTarget, missionLv);
    const safeZonePos = chooseSafeZonePosition(civilianSpawns, missionLv);
    if(state.safeZone && state.safeZone.mesh){
      state.safeZone.mesh.position.set(safeZonePos.x, 0, safeZonePos.z);
    }

    for(let i=0; i<civilianSpawns.length; i++){
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

    const tigerSpawns = buildTigerSpawnPlan(tigerTarget, missionLv, civilianSpawns, safeZonePos, bossMission);
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
        scoreValue:Math.round(spawn.type.maxHp * (spawn.isBoss ? 2.4 : 1.6)),
        position:spawn.pos.clone(),
        name:spawn.type.name,
      });
      if(spawn.isBoss){
        t.isBoss = true;
        t.name = `${bossProfile.name}`;
        t.maxHp = Math.round(t.maxHp * 2.3);
        t.hp = t.maxHp;
        t.speed = t.speed * 1.1;
        t.tigerType = {
          ...t.tigerType,
          damage:Math.round(Number(t.tigerType.damage || 14) * 1.4),
          pounce:Number(t.tigerType.pounce || 2.2) * 1.18,
        };
      }
      t.nextPounceAt = nowMs() + 1400 + Math.random() * 1400;
      t.nextAttackAt = nowMs() + 400;
      t.ring = createSelectionRing(t.mesh, 0x60a5fa, 2.6);
      t.telegraphRing = createTelegraphRing(t.mesh, 0xf59e0b, 2.62);
      t.clawArc = createClawArc(t.mesh, 0xfb923c);
      addHealthBar(t, 0xfb7185);
      t.mesh.userData.__tiger = t;
      state.tigers.push(t);
      state.tigerPickRoots.push(t.mesh);
    }

    resolveStaticOverlap(state.player);
    for(const u of state.squad) resolveStaticOverlap(u);
    for(const u of state.civilians) resolveStaticOverlap(u);
    for(const u of state.tigers) resolveStaticOverlap(u);

    state.mission.totalCivilians = state.civilians.length;
    state.mission.totalTigers = state.tigers.length;
    state.mission.clearAnnounced = false;
    state.mission.phase = bossMission ? "boss" : "rescue";
    state.mission.pendingCivilians = state.civilians.length;
    state.mission.aggressionMult = 1;
    state.mission.failed = false;
    state.mission.failAt = 0;
    state.mission.failReason = "";
    state.mission.directorTickAt = nowMs() + MISSION_DIRECTOR_TICK_MS;
    state.mission.chapter = chapter;
    state.mission.bossMission = bossMission;
    state.mission.spawnGraceUntil = nowMs() + 4400;
    state.mission.bossUnit = state.tigers.find((t)=>!!t.isBoss) || null;
    state.mission.bossPhase = state.mission.bossUnit ? 1 : 0;
    state.mission.bossReinforceAt = nowMs() + BOSS_REINFORCE_COOLDOWN_MS;
    state.mission.bossRoarUntil = 0;
    state.mission.bossPhase2Announced = false;
    state.mission.bossPhase3Announced = false;
    state.mission.lastPhase = state.mission.phase;
    state.mission.objectiveText = missionObjectiveText();
    state.fx.shieldUntil = 0;
    state.fx.rollUntil = 0;
    state.fx.sprintUntil = 0;
    state.fx.nextAttackAt = 0;
    state.fx.nextCaptureAt = 0;
    state.selectedTiger = null;
    for(const fx of state.vfxBursts){
      releaseImpactFx(fx);
    }
    state.vfxBursts.length = 0;
    for(const fx of state.vfxPool){
      releaseImpactFx(fx);
    }
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
    syncCoreVitals(true);
    recordReadinessMissionStart();
    if(bossMission){
      setStatus(`Boss mission online: ${bossProfile.name}. Secure civilians, then defeat boss.`, 2200);
    }else{
      setStatus("3D ready. Rescue civilians and clear tigers.");
    }
  }

  function createWorldScene(){
    const THREE = state.three;
    const initialTier = detectInitialQualityTier();
    state.perf.tier = initialTier;
    state.perf.preset = QUALITY_PRESETS[initialTier] || QUALITY_PRESETS.med;
    state.perf.evalAt = nowMs();
    state.perf.avgMs = 16.7;
    state.perf.lowHits = 0;
    state.perf.highHits = 0;
    state.perf.spikeHits = 0;
    state.perf.criticalSpikeHits = 0;
    state.perf.lastFrameMs = 16.7;
    state.perf.frameAccumMs = 0;
    state.perf.frameCount = 0;
    state.perf.frameNo = 0;
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
      antialias:true,
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
    createGuideArrow();
    resetScenario();
    applyVisualModeSetting();
    updateCameraButtons();
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
    const colliders = [];
    const worldX = group.position.x;
    const worldZ = group.position.z;

    const pushCollider = (lx, lz, r)=>{
      colliders.push({
        x: worldX + lx,
        z: worldZ + lz,
        r: Math.max(0.42, Number(r || 0.42))
      });
    };

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
      pushCollider(h.position.x, h.position.z, 2.7);
    }

    const carCount = preset.carBase + Math.floor(hash01(cx, cz, 121) * preset.carVar);
    for(let i=0;i<carCount;i++){
      const isTruck = hash01(cx, cz, 130 + i) > 0.75;
      const c = isTruck ? makeTruck() : makeCar();
      c.position.set(
        (hash01(cx, cz, 140 + i) - 0.5) * CHUNK_SIZE * 0.78,
        0,
        (hash01(cx, cz, 150 + i) - 0.5) * CHUNK_SIZE * 0.78
      );
      c.rotation.y = hash01(cx, cz, 160 + i) * Math.PI * 2;
      group.add(c);
      if(isTruck){
        pushCollider(c.position.x - 1.25, c.position.z, 1.1);
        pushCollider(c.position.x + 1.45, c.position.z, 1.2);
      }else{
        pushCollider(c.position.x - 0.75, c.position.z, 0.95);
        pushCollider(c.position.x + 0.68, c.position.z, 0.95);
      }
    }

    const treeCount = preset.treeBase + Math.floor(hash01(cx, cz, 171) * preset.treeVar);
    for(let i=0;i<treeCount;i++){
      const t = makeTree();
      const treeScale = 0.82 + hash01(cx, cz, 180 + i) * 0.5;
      t.scale.setScalar(treeScale);
      t.position.set(
        (hash01(cx, cz, 210 + i) - 0.5) * CHUNK_SIZE * 0.94,
        0,
        (hash01(cx, cz, 250 + i) - 0.5) * CHUNK_SIZE * 0.94
      );
      group.add(t);
      pushCollider(t.position.x, t.position.z, 0.78 * treeScale);
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
    state.chunks.set(key, { cx, cz, group, colliders });
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
    let budget = Math.max(1, Math.floor(preset.chunkBuildPerFrame || 1));
    const frameMs = Number(state.perf.lastFrameMs || 16.7);
    if(frameMs > 26) budget -= 1;
    if(frameMs > 38 || state.perf.criticalSpikeHits >= 2) budget = 0;
    if(state.perf.tier === "low") budget = Math.min(budget, 1);
    if(budget <= 0) return;
    for(let i=0;i<budget;i++){
      const next = state.chunkQueue[0];
      if(!next) break;
      const built = runFrameTask(()=>{
        addChunk(next.cx, next.cz);
      }, { cost:3.4, every:1 });
      if(!built) break;
      state.chunkQueue.shift();
      state.chunkQueued.delete(next.key);
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
        let minD = unitNavRadius(a) + unitNavRadius(b);
        const tigerVsPlayer =
          (a.role === "tiger" && b.role === "player") ||
          (a.role === "player" && b.role === "tiger");
        const tigerVsCivilian =
          (a.role === "tiger" && b.role === "civilian") ||
          (a.role === "civilian" && b.role === "tiger");
        if(tigerVsPlayer) minD = Math.max(minD, COMBAT_MIN_SEPARATION);
        if(tigerVsCivilian) minD = Math.max(minD, 2.15);
        if(a.role === "civilian" && b.role === "civilian"){
          minD *= 0.84;
        }
        if(d > 0 && d < minD){
          const pushScale = (a.role === "civilian" || b.role === "civilian") ? 0.34 : 0.5;
          const push = (minD - d) * pushScale;
          const nx = dx / d;
          const nz = dz / d;
          pa.x -= nx * push;
          pa.z -= nz * push;
          pb.x += nx * push;
          pb.z += nz * push;
        }
      }
      resolveStaticOverlap(a);
    }
  }

  function controlsVector(){
    const kb = state.controls.keyboard;
    const kx = (kb.ArrowRight || kb.KeyD ? 1 : 0) - (kb.ArrowLeft || kb.KeyA ? 1 : 0);
    const ky = (kb.ArrowDown || kb.KeyS ? 1 : 0) - (kb.ArrowUp || kb.KeyW ? 1 : 0);
    const gx = clamp(Number(state.controls.gamepad.moveX || 0), -1, 1);
    const gy = clamp(Number(state.controls.gamepad.moveY || 0), -1, 1);
    const rawX = clamp(state.controls.moveX + gx + kx, -1, 1);
    const rawY = clamp(state.controls.moveY + gy + ky, -1, 1);
    const lerpT = clamp(1 - Math.exp(-18 * Math.max(0.001, state.dt || 0.016)), 0.15, 0.9);
    state.controls.moveSmoothX = lerp(state.controls.moveSmoothX || 0, rawX, lerpT);
    state.controls.moveSmoothY = lerp(state.controls.moveSmoothY || 0, rawY, lerpT);
    const x = Math.abs(state.controls.moveSmoothX) < 0.015 ? 0 : state.controls.moveSmoothX;
    const y = Math.abs(state.controls.moveSmoothY) < 0.015 ? 0 : state.controls.moveSmoothY;
    const turn = clamp(x, -1, 1);
    const forward = clamp(-y, -1, 1);
    return { x, y, turn, forward };
  }

  function moveToward(unit, targetX, targetZ, speed){
    const pos = unit.mesh.position;
    const dx = targetX - pos.x;
    const dz = targetZ - pos.z;
    const d = Math.hypot(dx, dz);
    if(d < 0.01) return 0;
    const step = Math.min(d, speed * state.dt);
    if(step <= 0.001) return 0;
    const desiredYaw = Math.atan2(dx, dz);
    const moved = moveByAngleWithCollision(unit, desiredYaw, step, {
      radius:unitNavRadius(unit),
      allowSlide:true
    });
    return moved / Math.max(0.0001, state.dt);
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
      if(left > 0) spawnImpactFx(unit, 0xfca5a5, "hit");
      if(unit.hp <= 0){
        const core = coreState();
        if(core){
          const nextLives = Math.max(0, Math.floor(Number(core.lives || 5)) - 1);
          core.lives = nextLives;
          markCoreDirty();
        }
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
      spawnImpactFx(unit, 0xfb923c, "hit");
      if(unit.hp <= 0){
        unit.alive = false;
        unit.following = false;
        unit.mesh.visible = false;
        const core = coreState();
        if(core){
          ensureCoreBuckets(core);
          core.opsTotals.civiliansLost = Math.max(0, Math.floor(Number(core.opsTotals.civiliansLost || 0))) + 1;
          markCoreDirty();
        }
        setStatus(`${unit.name} was lost.`, 2200);
      }
      return;
    }
    flashUnit(unit);
    unit.hp = Math.max(0, unit.hp - dmg);
    spawnImpactFx(unit, 0xfbbf24, "hit");
  }

  function cleanupDeadTiger(tiger, reason){
    if(!tiger || !tiger.alive) return;
    tiger.alive = false;
    tiger.mesh.visible = false;
    tiger.ring.visible = false;
    if(state.selectedTiger === tiger) state.selectedTiger = null;
    if(reason === "capture"){
      state.mission.captured += 1;
      addCoreStat("captures", 1);
      addCoreCash(185);
    }else{
      state.mission.killed += 1;
      addCoreStat("kills", 1);
      addCoreCash(140);
    }
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
    addCoreStat("shots", 1);
    const nearBonus = clamp((PLAYER_ATTACK_RANGE - d) / PLAYER_ATTACK_RANGE, 0, 1);
    const dmg = Math.round(12 + nearBonus * 16);
    damageTarget(t, dmg);
    spawnImpactFx(t, 0xfef08a, "hit");
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
    spawnImpactFx(t, 0x6ee7b7, "hit");
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
    const core = coreState();
    if(core){
      ensureCoreBuckets(core);
      const shieldsLeft = Math.max(0, Math.floor(Number(core.shields || 0)));
      if(shieldsLeft <= 0){
        setStatus("No shields left. Buy more in Shop.", 1400);
        return;
      }
      core.shields = shieldsLeft - 1;
      markCoreDirty();
    }
    state.fx.shieldUntil = now + 5000;
    if(core){
      ensureCoreBuckets(core);
      core.shieldUntil = state.fx.shieldUntil;
      core.abilityCooldowns.shield = state.fx.shieldUntil;
      markCoreDirty();
    }
    setStatus("Escort shield active for 5 seconds.");
  }

  function rollDodge(){
    const vec = controlsVector();
    if(Math.hypot(vec.turn || 0, vec.forward || 0) < 0.1){
      const fwd = unitForward(state.player.mesh);
      state.fx.dodgeAngle = Math.atan2(fwd.x, fwd.z);
    }else{
      let yaw = Number(state.player?.mesh?.rotation?.y || 0);
      yaw += (vec.turn || 0) * 0.95;
      if((vec.forward || 0) < -0.35) yaw += Math.PI;
      state.fx.dodgeAngle = normalizeAngle(yaw);
    }
    state.fx.rollUntil = nowMs() + 460;
    setStatus("Roll dodge active.");
  }

  function triggerSprint(){
    state.fx.sprintUntil = nowMs() + 2200;
    setStatus("Sprint burst enabled.");
  }

  function cycleCameraMode(){
    state.cameraCtl.mode = (state.cameraCtl.mode === "third") ? "first" : "third";
    updateCameraButtons();
    setStatus(state.cameraCtl.mode === "first" ? "Camera: First-person." : "Camera: Third-person.", 900);
  }

  function adjustCameraZoom(step, quiet=false){
    state.cameraCtl.zoomOffset = clamp(state.cameraCtl.zoomOffset + Number(step || 0), -18, 22);
    if(!quiet){
      setStatus(`Zoom ${state.cameraCtl.zoomOffset > 0 ? "+" : ""}${Math.round(state.cameraCtl.zoomOffset)}.`, 700);
    }
  }

  function adjustCameraPitch(step){
    state.cameraCtl.pitchOffset = clamp(state.cameraCtl.pitchOffset + Number(step || 0), -22, 30);
    setStatus(`Pitch ${state.cameraCtl.pitchOffset > 0 ? "+" : ""}${Math.round(state.cameraCtl.pitchOffset)}.`, 700);
  }

  function adjustCameraHeight(step){
    state.cameraCtl.heightOffset = clamp(state.cameraCtl.heightOffset + Number(step || 0), -14, 24);
    setStatus(`Height ${state.cameraCtl.heightOffset > 0 ? "+" : ""}${Math.round(state.cameraCtl.heightOffset)}.`, 700);
  }

  function cycleVisualMode(){
    const order = ["auto", "perf", "balanced", "clarity"];
    const idx = Math.max(0, order.indexOf(state.cameraCtl.visualMode || "auto"));
    const next = order[(idx + 1) % order.length];
    state.cameraCtl.visualMode = next;
    applyVisualModeSetting();
    updateCameraButtons();
    setStatus(`3D ${currentVisualLabel().replace("Visual: ", "")} mode.`, 1100);
    resize3d();
  }

  function open3dModeOverlay(){
    syncCoreVitals(true);
    saveCoreProgress(true);
    if(typeof window.openMode === "function") window.openMode();
  }

  function open3dShopOverlay(){
    syncCoreVitals(true);
    saveCoreProgress(true);
    if(typeof window.openShop === "function") window.openShop();
  }

  function open3dInventoryOverlay(){
    syncCoreVitals(true);
    saveCoreProgress(true);
    if(typeof window.openInventory === "function") window.openInventory();
  }

  function updatePlayer(){
    const p = state.player;
    if(!p || !p.alive) return;
    if(!Number.isFinite(p.stamina)) p.stamina = Number.isFinite(p.maxStamina) ? p.maxStamina : 100;
    if(!Number.isFinite(p.maxStamina) || p.maxStamina <= 0) p.maxStamina = 100;

    const c = controlsVector();
    const turnIn = clamp(Number(c.turn || 0), -1, 1);
    const fwdIn = clamp(Number(c.forward || 0), -1, 1);
    const moving = Math.abs(fwdIn) > 0.06;
    const sprinting = state.controls.sprintHold || nowMs() < state.fx.sprintUntil;
    const rolling = nowMs() < state.fx.rollUntil;
    let speed = PLAYER_BASE_SPEED;
    if(rolling) speed = PLAYER_ROLL_SPEED;
    else if(sprinting && p.stamina > 2) speed = PLAYER_SPRINT_SPEED;

    if(Math.abs(turnIn) > 0.04){
      const turnRate = 2.55;
      p.mesh.rotation.y = normalizeAngle(p.mesh.rotation.y + (turnIn * turnRate * state.dt));
    }

    if(moving || rolling){
      let moveYaw = Number(p.mesh.rotation.y || 0);
      const absFwd = Math.abs(fwdIn);
      if(!rolling && fwdIn < -0.25){
        // Pulling down turns the soldier around quickly, then moves out.
        const desired = normalizeAngle(moveYaw + Math.PI);
        p.mesh.rotation.y = lerpAngle(moveYaw, desired, clamp(1 - Math.exp(-13.5 * state.dt), 0.08, 0.34));
        moveYaw = p.mesh.rotation.y;
      }else if(!rolling){
        moveYaw += turnIn * 0.32;
      }else{
        moveYaw = state.fx.dodgeAngle;
      }
      const moved = moveByAngleWithCollision(p, moveYaw, speed * state.dt * (rolling ? 1 : absFwd), {
        radius:unitNavRadius(p),
        allowSlide:true,
        turnLerp:rolling ? clamp(1 - Math.exp(-18 * state.dt), 0.1, 1) : clamp(1 - Math.exp(-14 * state.dt), 0.08, 1),
      });
      animateHumanoid(p, moved / Math.max(0.0001, state.dt));
    }else{
      animateHumanoid(p, 0.05);
    }

    if(sprinting && moving && fwdIn > 0){
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
    const combatTiger = getActiveCombatTiger();
    for(const mate of state.squad){
      if(!mate || !mate.alive || !mate.followOffset) continue;
      let targetX = p.mesh.position.x + mate.followOffset.x;
      let targetZ = p.mesh.position.z + mate.followOffset.z;
      if(combatTiger){
        const tp = combatTiger.mesh.position;
        const pp = p.mesh.position;
        let vx = pp.x - tp.x;
        let vz = pp.z - tp.z;
        const vd = Math.hypot(vx, vz) || 1;
        vx /= vd;
        vz /= vd;
        const sx = -vz;
        const sz = vx;
        const flank = (mate === state.squad[0]) ? -1 : 1;
        targetX = tp.x + vx * 3.6 + sx * flank * 3.4;
        targetZ = tp.z + vz * 3.6 + sz * flank * 3.4;
      }
      const moveSpeed = moveToward(mate, targetX, targetZ, mate.speed * (combatTiger ? 1.08 : 1));
      animateHumanoid(mate, moveSpeed);

      if(combatTiger){
        const d = horizontalDistance(mate, combatTiger);
        if(d <= 24 && nowMs() > mate.nextAttackAt){
          const dmg = (mate === state.squad[0]) ? 7 : 5;
          damageTarget(combatTiger, dmg);
          spawnImpactFx(combatTiger, mate === state.squad[0] ? 0xfca5a5 : 0x93c5fd, "hit");
          mate.nextAttackAt = nowMs() + (mate === state.squad[0] ? 490 : 620);
          if(combatTiger.hp <= 0){
            cleanupDeadTiger(combatTiger, "kill");
          }
        }
      }
    }
  }

  function nearestThreatTiger(civ){
    let bestTiger = null;
    let bestDist = Infinity;
    for(const t of state.tigers){
      if(!t || !t.alive) continue;
      const d = horizontalDistance(civ, t);
      if(d < bestDist){
        bestDist = d;
        bestTiger = t;
      }
    }
    return { tiger:bestTiger, dist:bestDist };
  }

  function updateCivilians(){
    const p = state.player;
    const safePos = state.safeZone?.mesh?.position || null;
    for(let i=0;i<state.civilians.length;i++){
      const civ = state.civilians[i];
      if(!civ || !civ.alive || civ.rescued) continue;
      const dToPlayer = horizontalDistance(civ, p);
      if(!civ.following && dToPlayer <= CIV_PICKUP_RADIUS){
        civ.following = true;
        if(civ.ring) civ.ring.visible = true;
        setStatus(`${civ.name} is following you.`, 1200);
      }

      const threat = nearestThreatTiger(civ);
      const threatTiger = threat.tiger;
      const threatDist = Number(threat.dist || Infinity);
      const panic = !!(threatTiger && threatDist <= 25);
      let moveSpeed = 0;

      if(panic && threatTiger && safePos){
        const cp = civ.mesh.position;
        const tp = threatTiger.mesh.position;
        const away = { x:cp.x - tp.x, z:cp.z - tp.z };
        const awayLen = Math.hypot(away.x, away.z) || 1;
        away.x /= awayLen;
        away.z /= awayLen;

        const toPlayer = { x:p.mesh.position.x - cp.x, z:p.mesh.position.z - cp.z };
        const toPlayerLen = Math.hypot(toPlayer.x, toPlayer.z) || 1;
        toPlayer.x /= toPlayerLen;
        toPlayer.z /= toPlayerLen;

        const toSafe = { x:safePos.x - cp.x, z:safePos.z - cp.z };
        const toSafeLen = Math.hypot(toSafe.x, toSafe.z) || 1;
        toSafe.x /= toSafeLen;
        toSafe.z /= toSafeLen;

        let dirX = (away.x * 1.15) + (toPlayer.x * (civ.following ? 0.9 : 0.5)) + (toSafe.x * 0.38);
        let dirZ = (away.z * 1.15) + (toPlayer.z * (civ.following ? 0.9 : 0.5)) + (toSafe.z * 0.38);
        const dirLen = Math.hypot(dirX, dirZ) || 1;
        dirX /= dirLen;
        dirZ /= dirLen;

        const fleeStep = 10 + clamp((25 - threatDist) * 0.7, 0, 8);
        const tx = cp.x + dirX * fleeStep;
        const tz = cp.z + dirZ * fleeStep;
        const panicSpeed = civ.speed * (civ.following ? 1.38 : 1.28);
        moveSpeed = moveToward(civ, tx, tz, panicSpeed);
        animateHumanoid(civ, moveSpeed);
      }else if(civ.following){
        const offsetIndex = i % 3;
        const side = (offsetIndex - 1) * 2.2;
        const back = 3.2 + Math.floor(i / 3) * 1.6;
        const fwd = unitForward(p.mesh);
        const rightX = Math.cos(p.mesh.rotation.y);
        const rightZ = -Math.sin(p.mesh.rotation.y);
        const tx = p.mesh.position.x - fwd.x * back + rightX * side;
        const tz = p.mesh.position.z - fwd.z * back + rightZ * side;
        const catchBoost = clamp((dToPlayer - 8) / 16, 0, 1);
        moveSpeed = moveToward(civ, tx, tz, civ.speed * (1 + catchBoost * 0.62));
        animateHumanoid(civ, moveSpeed);
      }else{
        animateHumanoid(civ, 0.03);
      }

      if(civ.ring) civ.ring.visible = !!civ.following;
      const dz = horizontalDistance(civ, state.safeZone);
      if(dz <= state.safeZone.radius - 0.8){
        civ.rescued = true;
        civ.following = false;
        civ.mesh.visible = false;
        state.mission.rescued += 1;
        addCoreStat("evac", 1);
        addCoreCash(120);
        setStatus(`${civ.name} evacuated.`, 1200);
      }
    }
  }

  function spawnDirectorReinforcement(boss){
    if(!boss || !boss.mesh || !boss.alive) return false;
    const THREE = state.three;
    const alive = state.tigers.filter((t)=>t && t.alive).length;
    const maxLive = state.mission.bossMission ? 9 : 7;
    if(alive >= maxLive) return false;
    const center = boss.mesh.position;
    let pos = null;
    for(let i=0; i<18; i++){
      const a = (Math.PI * 2 * (i / 18)) + (hash01(state.mission.chapter, alive, i + 1) - 0.5) * 0.35;
      const r = 18 + (hash01(state.mission.chapter, alive, i + 21) * 8);
      const c = new THREE.Vector3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r);
      if(horizontalDistance({ position:c }, state.player) < 34) continue;
      if(minDistToList(c, state.civilians.filter((x)=>x && x.alive && !x.rescued).map((x)=>x.mesh.position)) < 24) continue;
      pos = c;
      break;
    }
    if(!pos) return false;
    const type = TIGER_TYPES[0];
    const t = createUnit({
      id:`tiger-rf-${Math.random().toString(36).slice(2, 7)}`,
      role:"tiger",
      mesh:makeTigerMesh(type.color),
      maxHp:Math.round(type.maxHp * 1.06),
      hp:Math.round(type.maxHp * 1.06),
      speed:type.speed * 1.05,
      tigerType:{ ...type, damage:Math.round(type.damage * 1.08), pounce:type.pounce * 1.06 },
      scoreValue:Math.round(type.maxHp * 1.8),
      position:pos,
      name:`Reinforcement`,
    });
    t.nextPounceAt = nowMs() + 1200 + Math.random() * 700;
    t.nextAttackAt = nowMs() + 300;
    t.ring = createSelectionRing(t.mesh, 0x60a5fa, 2.6);
    t.telegraphRing = createTelegraphRing(t.mesh, 0xf59e0b, 2.62);
    t.clawArc = createClawArc(t.mesh, 0xfb923c);
    addHealthBar(t, 0xfb7185);
    t.mesh.userData.__tiger = t;
    state.tigers.push(t);
    state.tigerPickRoots.push(t.mesh);
    resolveStaticOverlap(t);
    state.mission.totalTigers += 1;
    setStatus("Boss called reinforcements.", 900);
    return true;
  }

  function updateBossDirector(now){
    const boss = state.mission.bossUnit;
    if(!boss || !boss.alive) return;
    const hpPct = boss.hp / Math.max(1, boss.maxHp);
    const profile = bossProfileForChapter(state.mission.chapter);
    if(hpPct <= 0.66 && !state.mission.bossPhase2Announced){
      state.mission.bossPhase = Math.max(2, state.mission.bossPhase || 1);
      state.mission.bossPhase2Announced = true;
      state.mission.bossRoarUntil = now + 6200;
      setStatus(`${boss.name} used ${profile.behavior.toUpperCase()} phase.`, 1400);
    }
    if(hpPct <= 0.33 && !state.mission.bossPhase3Announced){
      state.mission.bossPhase = Math.max(3, state.mission.bossPhase || 2);
      state.mission.bossPhase3Announced = true;
      state.mission.bossRoarUntil = now + 7000;
      setStatus(`${boss.name} entered final phase.`, 1500);
    }
    if(state.mission.bossPhase >= 3 && now >= state.mission.bossReinforceAt){
      if(spawnDirectorReinforcement(boss)){
        const chapterBoost = Math.max(0, state.mission.chapter - 1);
        state.mission.bossReinforceAt = now + Math.max(5600, BOSS_REINFORCE_COOLDOWN_MS - (chapterBoost * 240));
      }else{
        state.mission.bossReinforceAt = now + 2200;
      }
    }
  }

  function updateMissionDirector(){
    const now = state.now || nowMs();
    if(now < state.mission.directorTickAt) return true;
    state.mission.directorTickAt = now + MISSION_DIRECTOR_TICK_MS;
    const phaseBefore = String(state.mission.phase || "");

    if(state.mission.failed){
      if(state.mission.failAt > 0 && now >= state.mission.failAt){
        resetScenario();
        return false;
      }
      return true;
    }

    const aliveTigers = state.tigers.filter((t)=>t.alive).length;
    const pendingCivs = state.civilians.filter((c)=>c.alive && !c.rescued).length;
    const deadCivs = state.civilians.filter((c)=>!c.alive && !c.rescued).length;
    state.mission.pendingCivilians = pendingCivs;

    if(deadCivs > 0){
      state.mission.failed = true;
      state.mission.failReason = "Civilian lost";
      state.mission.failAt = now + MISSION_FAIL_RESET_MS;
      recordReadinessMissionFail();
      state.mission.objectiveText = missionObjectiveText();
      setStatus("Civilian lost. Mission restarting...", 1700);
      return true;
    }

    if(state.mission.bossMission){
      if(pendingCivs > 0){
        state.mission.phase = "boss";
      }else if(state.mission.bossUnit && state.mission.bossUnit.alive){
        state.mission.phase = "boss";
      }else if(aliveTigers > 0){
        state.mission.phase = "clear";
      }else{
        state.mission.phase = "complete";
      }
      updateBossDirector(now);
    }else{
      if(pendingCivs > 0) state.mission.phase = "rescue";
      else if(aliveTigers > 0) state.mission.phase = "clear";
      else state.mission.phase = "complete";
    }

    const lv = missionLevel();
    const killPressure = Math.max(0, state.mission.killed - state.mission.captured);
    const clearPressure = (state.mission.phase === "clear" || state.mission.phase === "boss") ? 0.18 : 0;
    const roarBoost = now < state.mission.bossRoarUntil ? 0.2 : 0;
    const chapterBoost = Math.max(0, (state.mission.chapter - 1) * 0.03);
    const levelBoost = Math.max(0, (lv - 1) * 0.012);
    state.mission.aggressionMult = clamp(1 + levelBoost + chapterBoost + (killPressure * 0.04) + clearPressure + roarBoost, 0.9, 3.2);
    state.mission.objectiveText = missionObjectiveText();
    if(phaseBefore !== state.mission.phase){
      if(state.mission.phase === "clear"){
        setStatus("All civilians rescued. Clear the remaining tigers.", 1200);
      }else if(state.mission.phase === "boss"){
        setStatus("Boss phase active. Watch telegraphs and hold formation.", 1100);
      }else if(state.mission.phase === "complete"){
        setStatus("Mission objectives complete.", 1000);
      }
      state.mission.lastPhase = state.mission.phase;
    }
    return true;
  }

  function chooseTigerTarget(tiger){
    const now = state.now || nowMs();
    const phase = String(state.mission.phase || "rescue");
    const preferPlayer = phase === "clear" || phase === "complete" || tiger?.isBoss;
    const spawnGrace = now < Math.max(0, Number(state.mission.spawnGraceUntil || 0));
    let best = null;
    let bestScore = Infinity;
    for(const civ of state.civilians){
      if(!civ.alive || civ.rescued) continue;
      const d = horizontalDistance(tiger, civ);
      let score = d;
      if(preferPlayer) score += 16;
      if(spawnGrace) score += 42;
      if(civ.following) score -= 7;
      if(score < bestScore){
        bestScore = score;
        best = civ;
      }
    }
    const dPlayer = horizontalDistance(tiger, state.player);
    let playerScore = dPlayer;
    if(preferPlayer) playerScore -= 14;
    if(spawnGrace) playerScore -= 18;
    if(tiger && tiger.isBoss) playerScore -= 6;
    if(playerScore <= bestScore || best == null){
      best = state.player;
      bestScore = playerScore;
    }
    return { target:best, dist:horizontalDistance(tiger, best || state.player) };
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
    const aggro = Math.max(0.86, Number(state.mission.aggressionMult || 1));
    const spawnGrace = now < Math.max(0, Number(state.mission.spawnGraceUntil || 0));
    const roarBuff = now < Math.max(0, Number(state.mission.bossRoarUntil || 0));
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

      let speed = t.speed * aggro;
      let mode = "patrol";
      if(dist < 52){
        mode = "stalk";
        if(now > t.nextPounceAt && dist > 5 && dist < 26 && now > t.pounceUntil && now > t.recoverUntil){
          t.telegraphPounceUntil = now + TIGER_WINDUP_MS;
          t.nextPounceAt = now + Math.max(980, 2400 / Math.max(0.75, aggro)) + Math.random() * 900;
          setStatus(`${t.name} pounce incoming!`, 700);
        }
      }
      if(spawnGrace && target && target.role === "civilian"){
        mode = "patrol";
        speed *= 0.62;
      }
      if(roarBuff){
        speed *= t.isBoss ? 1.26 : 1.12;
      }
      if(now < t.telegraphPounceUntil){
        mode = "windup";
        speed *= 0.35;
      }else if(t.telegraphPounceUntil > 0 && now >= t.telegraphPounceUntil && now > t.pounceUntil){
        t.pounceUntil = now + 560;
        t.recoverUntil = t.pounceUntil + 520;
        t.telegraphPounceUntil = 0;
        state.combat.pounceFxUntil = now + 180;
        spawnImpactFx(t, 0xfb7185, "pounce");
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
          if(t.pendingAttackTarget.role === "player" && now < state.fx.rollUntil){
            setStatus("Perfect dodge window hit!", 620);
            spawnImpactFx(state.player, 0x34d399, "hit");
          }else{
            damageTarget(t.pendingAttackTarget, t.pendingAttackDamage || t.tigerType.damage);
            spawnImpactFx(t.pendingAttackTarget, 0xfb923c, "claw");
          }
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
        const damageScale = t.isBoss ? 1.2 : 1;
        let pendingDamage = (t.tigerType.damage || 10) * damageScale * Math.max(0.85, aggro);
        if(target.role === "civilian"){
          pendingDamage *= 0.46;
          if(t.isBoss) pendingDamage *= 1.2;
          pendingDamage = clamp(pendingDamage, 2, 8.5);
        }
        t.pendingAttackDamage = Math.round(pendingDamage);
        const baseCd = (target.role === "civilian" ? 3200 : 1300);
        const cd = baseCd / Math.max(0.8, aggro);
        const minCd = (target.role === "civilian" ? 2200 : 680);
        t.nextAttackAt = now + Math.max(minCd, cd);
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

  function updateGuideArrow(){
    if(!state.guideArrow || !state.guideArrow.mesh || !state.player) return;
    const p = state.player.mesh.position;
    let target = null;
    let best = Infinity;
    // Prioritize civilians currently under direct pressure.
    for(const civ of state.civilians){
      if(!civ || !civ.alive || civ.rescued) continue;
      const threat = nearestThreatTiger(civ);
      if(threat.tiger && threat.dist <= 24){
        const d = horizontalDistance(state.player, civ);
        if(d < best){
          best = d;
          target = civ;
        }
      }
    }
    for(const civ of state.civilians){
      if(!civ || !civ.alive || civ.rescued) continue;
      const d = horizontalDistance(state.player, civ);
      if(d < best){
        best = d;
        target = civ;
      }
    }
    const tp = target
      ? target.mesh.position
      : (state.safeZone?.mesh?.position || null);
    if(!tp){
      state.guideArrow.mesh.visible = false;
      return;
    }
    const dx = tp.x - p.x;
    const dz = tp.z - p.z;
    const yaw = Math.atan2(dx, dz);
    state.guideArrow.mesh.visible = true;
    state.guideArrow.mesh.position.set(p.x, 8.0, p.z);
    state.guideArrow.mesh.rotation.y = yaw;
    const pulse = 1 + Math.sin((state.now || nowMs()) * 0.011) * 0.14;
    state.guideArrow.mesh.scale.set(1.12 * pulse, 1.12 * pulse, 1.12 * pulse);
    if(state.guideArrow.ring){
      state.guideArrow.ring.rotation.z += state.dt * 1.2;
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
      if(t.clawArc){
        const meleeWindup = !!(t.telegraphMeleeUntil && now < t.telegraphMeleeUntil);
        const pouncing = !!(t.pounceUntil && now < t.pounceUntil);
        if(meleeWindup || pouncing){
          t.clawArc.visible = true;
          const pulse = 1 + Math.sin((now + (t.scoreValue || 0)) * 0.025) * 0.1;
          t.clawArc.scale.set(pulse, pulse, pulse);
          if(t.clawArc.material){
            t.clawArc.material.opacity = meleeWindup ? 0.82 : 0.66;
            t.clawArc.material.color.setHex(meleeWindup ? 0xf59e0b : 0xef4444);
          }
        }else{
          t.clawArc.visible = false;
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
    const ctl = state.cameraCtl;
    const preset = cameraPreset();
    const presetThird = preset.third || CAMERA_PRESETS.tactical.third;
    const presetFirst = preset.first || CAMERA_PRESETS.tactical.first;
    const cameraMode = ctl.mode || "third";
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if(cameraMode === "first"){
      const pp = p.mesh.position;
      const yaw = p.mesh.rotation.y;
      const pitch = clamp(Number(presetFirst.pitch || -8) + ctl.pitchOffset, -24, 24) * (Math.PI / 180);
      const eyeY = Number(presetFirst.eyeY || 4.05) + ctl.heightOffset * 0.1;
      const lookDist = clamp(Number(presetFirst.lookDist || 20) + ctl.zoomOffset * 0.8, 11, 40);
      const firstSmooth = clamp(Number(presetFirst.smooth || 10.5), 6.5, 14);
      const fx = Math.sin(yaw) * Math.cos(pitch);
      const fz = Math.cos(yaw) * Math.cos(pitch);
      const fy = Math.sin(pitch);
      state.camera.position.x = smoothStep(state.camera.position.x, pp.x, firstSmooth, state.dt);
      state.camera.position.y = smoothStep(state.camera.position.y, eyeY, firstSmooth, state.dt);
      state.camera.position.z = smoothStep(state.camera.position.z, pp.z, firstSmooth, state.dt);
      const lx = pp.x + fx * lookDist;
      const ly = eyeY + fy * lookDist;
      const lz = pp.z + fz * lookDist;
      state.camera.lookAt(lx, ly, lz);
      return;
    }
    const lock = state.combat.active ? state.combat.target : null;
    const blend = clamp(state.combat.lockBlend || 0, 0, 1);
    const followHeightBase =
      Number(isLandscape ? presetThird.heightLandscape : presetThird.heightPortrait) + ctl.heightOffset * 0.42;
    const followBackBase =
      Number(isLandscape ? presetThird.backLandscape : presetThird.backPortrait) + ctl.zoomOffset;
    const smoothXZ = clamp(Number(presetThird.smoothXZ || 6.3), 3.5, 9.5);
    const smoothY = clamp(Number(presetThird.smoothY || 4.8), 2.5, 8);
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
      const lockBack = clamp(18 + d * 0.5 + ctl.zoomOffset * 0.45, 16, 40);
      followBack = lerp(followBackBase, lockBack, blend);
      followHeight = lerp(followHeightBase, (isLandscape ? 24 : 29) + ctl.heightOffset * 0.32, blend);
      tx = midX + nx * followBack;
      tz = midZ + nz * followBack;
      lookX = lerp(pp.x, midX, clamp(blend * 0.9, 0, 1));
      lookZ = lerp(pp.z, midZ, clamp(blend * 0.9, 0, 1));
    }else{
      const fwd = unitForward(p.mesh);
      tx = p.mesh.position.x - fwd.x * followBack;
      tz = p.mesh.position.z - fwd.z * followBack;
    }
    state.camera.position.x = smoothStep(state.camera.position.x, tx, smoothXZ, state.dt);
    state.camera.position.y = smoothStep(state.camera.position.y, followHeight, smoothY, state.dt);
    state.camera.position.z = smoothStep(state.camera.position.z, tz, smoothXZ, state.dt);
    const lookY = (isLandscape ? 2.3 : 2.8) + ctl.pitchOffset * 0.06;
    state.camera.lookAt(lookX, lookY, lookZ);
  }

  function updateCombatFloatingLabels(){
    const tiger = state.combat.active ? state.combat.target : null;
    const player = state.player;
    if(player && tiger && tiger.alive){
      const playerPct = Math.round((player.hp / Math.max(1, player.maxHp)) * 100);
      const tigerPct = Math.round((tiger.hp / Math.max(1, tiger.maxHp)) * 100);
      drawFloatingLabel(player, `YOU ${playerPct}%`, "#bbf7d0");
      drawFloatingLabel(tiger, `${tiger.name.toUpperCase()} ${tigerPct}%`, "#fecdd3");
    }else{
      hideFloatingLabel(player);
      hideFloatingLabel(tiger);
    }
    for(const u of state.squad) hideFloatingLabel(u);
    for(const u of state.civilians) hideFloatingLabel(u);
    for(const u of state.tigers){
      if(!tiger || u !== tiger) hideFloatingLabel(u);
    }
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
      const core = coreState();
      const shieldCount = core ? Math.max(0, Math.floor(Number(core.shields || 0))) : 0;
      const left = Math.max(0, state.fx.shieldUntil - now);
      const shieldLabel = left > 0
        ? `Shield ${Math.ceil(left / 1000)}s`
        : `Shield (${shieldCount})`;
      if(state.perf.lastHud.shieldLabel !== shieldLabel){
        state.perf.lastHud.shieldLabel = shieldLabel;
        state.ui.shieldBtn.innerText = shieldLabel;
      }
    }

    const hudEvery = clamp(Number(preset.hudIntervalMs || 120), PERF_HUD_MIN_MS, PERF_HUD_MAX_MS);
    if(!force && (now - state.perf.hudLastAt) < hudEvery) return;
    state.perf.hudLastAt = now;
    const hudMode = resolveHudMode();
    if(state.overlay){
      state.overlay.classList.toggle("hudCompact", hudMode === "compact");
      state.overlay.classList.toggle("hudCombat", hudMode === "combat");
      state.overlay.classList.toggle("hudFull", hudMode === "full");
    }

    if(hudMode === "combat" && state.combat.active && state.combat.target && state.combat.target.alive){
      setHudText(
        "mission",
        state.ui.hudMission,
        `COMBAT • ${state.combat.target.name.toUpperCase()} • Aggro x${Number(state.mission.aggressionMult || 1).toFixed(2)}`
      );
    }else if(hudMode === "compact"){
      setHudText(
        "mission",
        state.ui.hudMission,
        `${state.core.mode} L${state.core.level} • Civ ${rescued}/${state.mission.totalCivilians} • Tigers ${aliveTigers}`
      );
    }else{
      setHudText(
        "mission",
        state.ui.hudMission,
        `${state.core.mode} L${state.core.level} • ${String(state.mission.phase || "rescue").toUpperCase()} • Civ ${rescued}/${state.mission.totalCivilians} • Pending ${aliveCivs} • Tigers ${aliveTigers} • Aggro x${Number(state.mission.aggressionMult || 1).toFixed(2)}`
      );
    }
    if(p){
      const staminaNow = Math.round(Number.isFinite(p.stamina) ? p.stamina : 100);
      if(hudMode === "compact"){
        setHudText("agent", state.ui.hudAgent, `YOU HP ${Math.round(p.hp)} • AR ${Math.round(p.armor)} • ST ${staminaNow}`);
      }else{
        setHudText(
          "agent",
          state.ui.hudAgent,
          `YOU HP ${Math.round(p.hp)}/${p.maxHp} • AR ${Math.round(p.armor)}/${p.maxArmor} • ST ${staminaNow}`
        );
      }
    }

    const st = state.selectedTiger;
    if(st && st.alive){
      const pct = Math.round((st.hp / st.maxHp) * 100);
      const bossInfo = st.isBoss ? ` • BOSS P${Math.max(1, Math.floor(Number(state.mission.bossPhase || 1)))}` : "";
      if(hudMode === "compact"){
        setHudText("tiger", state.ui.hudTiger, `${st.name}${bossInfo} • ${pct}% • ${tigerStatusText(st)}`);
      }else{
        setHudText("tiger", state.ui.hudTiger, `LOCK ${st.name}${bossInfo} • HP ${Math.round(st.hp)}/${st.maxHp} (${pct}%) • ${tigerStatusText(st)}`);
      }
    }else{
      setHudText("tiger", state.ui.hudTiger, "LOCK: Tap tiger to engage.");
    }

    if(state.ui.duelHud){
      const engaged = !!(state.combat.active && state.combat.target && state.combat.target.alive);
      state.ui.duelHud.classList.toggle("active", engaged && SHOW_COMBAT_DUEL_CHIPS);
      if(state.overlay) state.overlay.classList.toggle("combatLock", engaged);
      if(engaged){
        if(SHOW_COMBAT_DUEL_CHIPS){
          const tiger = state.combat.target;
          const youPct = Math.round((p.hp / Math.max(1, p.maxHp)) * 100);
          const tigerPct = Math.round((tiger.hp / Math.max(1, tiger.maxHp)) * 100);
          setHudText("duelYou", state.ui.duelYou, `YOU ${youPct}% • AR ${Math.round((p.armor / Math.max(1, p.maxArmor || 100)) * 100)}%`);
          setHudText("duelTiger", state.ui.duelTiger, `${tiger.name.toUpperCase()} ${tigerPct}% • ${tigerStatusText(tiger)}`);
        }
      }else{
        if(state.overlay) state.overlay.classList.remove("combatLock");
        setHudText("duelYou", state.ui.duelYou, "");
        setHudText("duelTiger", state.ui.duelTiger, "");
      }
    }

    if(state.ui.hint){
      if(state.statusUntil > now){
        if(state.combat.active){
          state.ui.hint.classList.add("hidden");
        }else{
          state.ui.hint.classList.remove("hidden");
          setHudText("hint", state.ui.hint, state.statusText);
        }
      }else{
        state.ui.hint.classList.add("hidden");
      }
    }
  }

  function updateGameState(){
    state.now = nowMs();
    state.dt = clamp(state.clock.getDelta(), 0.001, 0.050);
    const frameMs = state.dt * 1000;
    state.perf.lastFrameMs = frameMs;
    if(shouldTrackReadinessFrame()){
      sampleReadinessFrame(frameMs);
    }
    if(frameMs >= PERF_SPIKE_MS) state.perf.spikeHits = Math.min(24, (state.perf.spikeHits || 0) + 1);
    else state.perf.spikeHits = Math.max(0, (state.perf.spikeHits || 0) - 1);
    if(frameMs >= PERF_CRITICAL_SPIKE_MS) state.perf.criticalSpikeHits = Math.min(12, (state.perf.criticalSpikeHits || 0) + 1);
    else state.perf.criticalSpikeHits = Math.max(0, (state.perf.criticalSpikeHits || 0) - 1);
    state.perf.frameNo += 1;
    if(!state.active) return;
    if(state.overlay && state.overlay.style.display !== "flex"){
      closePrototype();
      return;
    }
    if(!state.player || !state.player.mesh){
      return;
    }
    beginFrameBudget();
    evaluatePerformanceTier();
    pollGamepadInput();

    const tier = state.perf.tier || "med";
    const lowTier = tier === "low";
    runFrameTask(()=>{
      ensureChunksAround(state.player.mesh.position.x, state.player.mesh.position.z);
    }, { cost:2.4, every:lowTier ? 2 : 1 });

    updatePlayer();
    runFrameTask(()=>{ updateSquad(); }, { cost:1.6, every:lowTier ? 2 : 1 });
    runFrameTask(()=>{ updateCivilians(); }, { cost:1.9, every:lowTier ? 2 : 1 });
    const directorOk = updateMissionDirector();
    if(!directorOk) return;
    updateTigers();
    updateCombatDirector();

    const liveUnits = state.liveUnitsCache;
    liveUnits.length = 0;
    if(state.player && state.player.alive) liveUnits.push(state.player);
    for(const u of state.squad){ if(u && u.alive) liveUnits.push(u); }
    for(const u of state.civilians){ if(u && u.alive && !u.rescued) liveUnits.push(u); }
    for(const u of state.tigers){ if(u && u.alive) liveUnits.push(u); }
    runFrameTask(()=>{
      resolveSeparation(liveUnits);
    }, { cost:2.2, every:lowTier ? 2 : 1 });

    runFrameTask(()=>{
      updateHitFlash(state.player);
      for(const u of state.squad) updateHitFlash(u);
      for(const u of state.civilians) updateHitFlash(u);
      for(const u of state.tigers) updateHitFlash(u);
    }, { cost:0.95, every:lowTier ? 2 : 1 });

    runFrameTask(()=>{ updateSelectionRings(); }, { cost:0.55, every:lowTier ? 2 : 1 });
    runFrameTask(()=>{ updateSafeZoneVisual(); }, { cost:0.2, every:lowTier ? 2 : 1 });
    runFrameTask(()=>{ updateGuideArrow(); }, { cost:0.65, every:lowTier ? 2 : 1 });
    runFrameTask(()=>{ updateImpactFx(); }, { cost:0.6, every:1 });

    const barsEvery = Math.max(1, Math.floor(qualityPreset().healthBarEveryNFrames || 1));
    runFrameTask(()=>{
      updateHealthBar(state.player);
      for(const u of state.squad) updateHealthBar(u);
      for(const u of state.civilians) updateHealthBar(u);
      for(const u of state.tigers) updateHealthBar(u);
      orientHealthBarsToCamera();
    }, { cost:1.7, every:barsEvery });

    updateCamera();
    runFrameTask(()=>{ updateCombatFloatingLabels(); }, { cost:0.45, every:lowTier ? 2 : 1 });
    runFrameTask(()=>{ updateHud(); }, { cost:0.45, every:1 });
    syncCoreVitals();
    saveCoreProgress(false);
    flushReadinessData(false);

    const missionClear = state.mission.rescued >= state.mission.totalCivilians && state.tigers.every((t)=>!t.alive);
    if(missionClear && !state.mission.clearAnnounced){
      state.mission.clearAnnounced = true;
      recordReadinessMissionClear();
      markCoreMissionClear();
      const missionBonus = 320 + (state.mission.rescued * 90) + (state.mission.captured * 140) + (state.mission.killed * 110);
      addCoreCash(missionBonus);
      saveCoreProgress(true);
      advanceMissionParityAndReset3D();
      return;
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

  function pickTigerAtScreen(clientX, clientY){
    if(!state.active || !state.renderer || !state.camera) return null;
    const canvas = state.renderer.domElement;
    if(!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if(clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    state.pointer2D.set(x, y);
    state.raycaster.setFromCamera(state.pointer2D, state.camera);
    const hits = state.raycaster.intersectObjects(state.tigerPickRoots, true);
    if(!hits || !hits.length) return null;
    const tiger = tigerFromHit(hits[0].object);
    return (tiger && tiger.alive) ? tiger : null;
  }

  function onWorldPointerDown(ev){
    if(!state.active || !state.renderer) return;
    if(ev.target !== state.renderer.domElement) return;
    const tiger = pickTigerAtScreen(ev.clientX, ev.clientY);
    if(tiger){
      state.selectedTiger = tiger;
      setStatus(`${tiger.name} locked. Attack or capture when ready.`);
    }
  }

  function onWorldWheel(ev){
    if(!state.active) return;
    ev.preventDefault();
    const direction = ev.deltaY > 0 ? 1 : -1;
    adjustCameraZoom(direction * 1.25, true);
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

  function onGamepadConnected(){
    state.controls.gamepad.connected = true;
    setStatus("Gamepad connected.");
  }

  function onGamepadDisconnected(){
    state.controls.gamepad.connected = false;
    state.controls.gamepad.moveX = 0;
    state.controls.gamepad.moveY = 0;
    state.controls.sprintHold = false;
    state.controls.gamepad.lastButtons = Object.create(null);
    setStatus("Gamepad disconnected.");
  }

  function applyGamepadDeadzone(v){
    const n = Number(v || 0);
    const abs = Math.abs(n);
    if(abs <= GAMEPAD_DEADZONE) return 0;
    const norm = (abs - GAMEPAD_DEADZONE) / Math.max(0.0001, 1 - GAMEPAD_DEADZONE);
    return Math.sign(n) * clamp(norm, 0, 1);
  }

  function gamepadButtonPressed(buttons, idx){
    const b = buttons && buttons[idx];
    return !!(b && (b.pressed || b.value > 0.5));
  }

  function pollGamepadInput(){
    if(typeof navigator === "undefined" || typeof navigator.getGamepads !== "function"){
      state.controls.gamepad.moveX = 0;
      state.controls.gamepad.moveY = 0;
      return;
    }
    const pads = navigator.getGamepads();
    let gp = null;
    for(let i=0; i<pads.length; i++){
      if(pads[i] && pads[i].connected){
        gp = pads[i];
        break;
      }
    }
    if(!gp){
      state.controls.gamepad.connected = false;
      state.controls.gamepad.moveX = 0;
      state.controls.gamepad.moveY = 0;
      state.controls.sprintHold = false;
      return;
    }

    state.controls.gamepad.connected = true;
    state.controls.gamepad.moveX = applyGamepadDeadzone(gp.axes?.[0] || 0);
    state.controls.gamepad.moveY = applyGamepadDeadzone(gp.axes?.[1] || 0);

    const buttons = gp.buttons || [];
    const last = state.controls.gamepad.lastButtons || (state.controls.gamepad.lastButtons = Object.create(null));
    const edge = (idx)=>{
      const nowPressed = gamepadButtonPressed(buttons, idx);
      const wasPressed = !!last[idx];
      last[idx] = nowPressed;
      return nowPressed && !wasPressed;
    };

    if(edge(0)) attackTiger(); // A / Cross
    if(edge(2)) captureTiger(); // X / Square
    if(edge(1)) rollDodge(); // B / Circle
    if(edge(3)) useShield(); // Y / Triangle
    if(edge(4)) triggerSprint(); // LB / L1 burst
    if(edge(9)) cycleCameraMode(); // Start / Options

    state.controls.sprintHold = gamepadButtonPressed(buttons, 5); // RB / R1 hold
  }

  function updateJoystickVisual(nx, ny){
    const maxR = state.controls.joystickRadius || 42;
    const baseHalf = JOY_BASE_SIZE * 0.5;
    const knobHalf = JOY_KNOB_SIZE * 0.5;
    const anchorX = state.controls.joystickAnchorX || 0;
    const anchorY = state.controls.joystickAnchorY || 0;
    const x = clamp(nx, -1, 1) * maxR;
    const y = clamp(ny, -1, 1) * maxR;
    if(state.ui.joyBase){
      state.ui.joyBase.style.opacity = state.controls.joystickActive ? "1" : "0";
      state.ui.joyBase.style.transform = `translate(${anchorX - baseHalf}px, ${anchorY - baseHalf}px)`;
    }
    if(state.ui.joyKnob){
      state.ui.joyKnob.style.opacity = state.controls.joystickActive ? "1" : "0";
      state.ui.joyKnob.style.transform = `translate(${anchorX - knobHalf + x}px, ${anchorY - knobHalf + y}px)`;
    }
  }

  function resetJoystick(){
    state.controls.moveX = 0;
    state.controls.moveY = 0;
    state.controls.moveSmoothX = 0;
    state.controls.moveSmoothY = 0;
    state.controls.joystickPointerId = null;
    state.controls.joystickActive = false;
    updateJoystickVisual(0,0);
  }

  function onJoyPointerDown(ev){
    if(!state.active || !state.ui.joyBase) return;
    if(ev.clientX > window.innerWidth * JOY_LEFT_ZONE_RATIO) return;
    const tappedTiger = pickTigerAtScreen(ev.clientX, ev.clientY);
    if(tappedTiger){
      ev.preventDefault();
      state.selectedTiger = tappedTiger;
      setStatus(`${tappedTiger.name} locked. Attack or capture when ready.`);
      return;
    }
    ev.preventDefault();
    const rect = state.ui.joyArea.getBoundingClientRect();
    state.controls.joystickCenterX = ev.clientX;
    state.controls.joystickCenterY = ev.clientY;
    state.controls.joystickAnchorX = ev.clientX - rect.left;
    state.controls.joystickAnchorY = ev.clientY - rect.top;
    state.controls.joystickPointerId = ev.pointerId;
    state.controls.joystickActive = true;
    state.controls.joystickRadius = 42;
    state.controls.moveX = 0;
    state.controls.moveY = 0;
    updateJoystickVisual(0, 0);
    ev.target.setPointerCapture?.(ev.pointerId);
  }

  function onJoyPointerMove(ev){
    if(!state.active || !state.controls.joystickActive) return;
    if(state.controls.joystickPointerId !== ev.pointerId) return;
    ev.preventDefault();
    const maxR = state.controls.joystickRadius || 42;
    const driftLimit = maxR * 0.92;
    let dx = ev.clientX - state.controls.joystickCenterX;
    let dy = ev.clientY - state.controls.joystickCenterY;
    let r = Math.hypot(dx, dy);
    if(r > driftLimit){
      const pull = clamp((r - driftLimit) / Math.max(1, maxR), 0, 1) * 0.26;
      state.controls.joystickCenterX += dx * pull;
      state.controls.joystickCenterY += dy * pull;
      const rect = state.ui.joyArea.getBoundingClientRect();
      const baseHalf = JOY_BASE_SIZE * 0.5;
      state.controls.joystickAnchorX = clamp(state.controls.joystickCenterX - rect.left, baseHalf, rect.width - baseHalf);
      state.controls.joystickAnchorY = clamp(state.controls.joystickCenterY - rect.top, baseHalf, rect.height - baseHalf);
      dx = ev.clientX - state.controls.joystickCenterX;
      dy = ev.clientY - state.controls.joystickCenterY;
      r = Math.hypot(dx, dy);
    }
    const nx = r > 0 ? dx / r : 0;
    const ny = r > 0 ? dy / r : 0;
    const rr = clamp((r - JOY_DEADZONE_PX) / Math.max(1, maxR - JOY_DEADZONE_PX), 0, 1);
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
    if(state.ui.camToggleBtn) state.ui.camToggleBtn.onclick = ()=>toggleCamBarVisible();
    if(state.ui.sprintBtn){
      state.ui.sprintBtn.onpointerdown = (ev)=>{ ev.preventDefault(); state.controls.sprintHold = true; triggerSprint(); };
      state.ui.sprintBtn.onpointerup = (ev)=>{ ev.preventDefault(); state.controls.sprintHold = false; };
      state.ui.sprintBtn.onpointercancel = ()=>{ state.controls.sprintHold = false; };
    }
    if(state.ui.camModeBtn) state.ui.camModeBtn.onclick = ()=>cycleCameraMode();
    if(state.ui.camPresetBtn) state.ui.camPresetBtn.onclick = ()=>cycleCameraPreset();
    if(state.ui.hudModeBtn) state.ui.hudModeBtn.onclick = ()=>cycleHudMode();
    if(state.ui.zoomOutBtn) state.ui.zoomOutBtn.onclick = ()=>adjustCameraZoom(2.5);
    if(state.ui.zoomInBtn) state.ui.zoomInBtn.onclick = ()=>adjustCameraZoom(-2.5);
    if(state.ui.pitchDownBtn) state.ui.pitchDownBtn.onclick = ()=>adjustCameraPitch(-3);
    if(state.ui.pitchUpBtn) state.ui.pitchUpBtn.onclick = ()=>adjustCameraPitch(3);
    if(state.ui.heightDownBtn) state.ui.heightDownBtn.onclick = ()=>adjustCameraHeight(-2);
    if(state.ui.heightUpBtn) state.ui.heightUpBtn.onclick = ()=>adjustCameraHeight(2);
    if(state.ui.qualityBtn) state.ui.qualityBtn.onclick = ()=>cycleVisualMode();
    if(state.ui.menuBtn) state.ui.menuBtn.onclick = ()=>open3dModeOverlay();
    if(state.ui.shopBtn) state.ui.shopBtn.onclick = ()=>open3dShopOverlay();
    if(state.ui.inventoryBtn) state.ui.inventoryBtn.onclick = ()=>open3dInventoryOverlay();
    if(state.ui.resetBtn) state.ui.resetBtn.onclick = ()=>resetScenario();
    if(state.ui.closeBtn) state.ui.closeBtn.onclick = ()=>window.close3DPrototype();
    updateCameraButtons();

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
    window.addEventListener("gamepadconnected", onGamepadConnected);
    window.addEventListener("gamepaddisconnected", onGamepadDisconnected);
  }

  function unbindUiEvents(){
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("gamepadconnected", onGamepadConnected);
    window.removeEventListener("gamepaddisconnected", onGamepadDisconnected);
    window.removeEventListener("resize", resize3d);
    window.removeEventListener("orientationchange", onOrientationChanged);
    document.removeEventListener("visibilitychange", onVisibilityChanged);
  }

  function bindWorldEvents(){
    if(state.renderer && state.renderer.domElement){
      state.renderer.domElement.addEventListener("pointerdown", onWorldPointerDown, { passive:true });
      state.renderer.domElement.addEventListener("wheel", onWorldWheel, { passive:false });
    }
  }

  function unbindWorldEvents(){
    if(state.renderer && state.renderer.domElement){
      state.renderer.domElement.removeEventListener("pointerdown", onWorldPointerDown);
      state.renderer.domElement.removeEventListener("wheel", onWorldWheel);
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
    if(state.ready && state.player){
      resetScenario();
    }
    setPauseForPrototype(true);
    state.active = true;
    if(state.overlay) state.overlay.style.display = "flex";
    document.body.classList.add("proto3dOpen");
    setCamBarVisible(false);
    resize3d();
    state.clock.getDelta();
    stopRenderLoop();
    recordReadinessSessionStart();
    state.raf = requestAnimationFrame(renderFrame);
    setStatus("3D online. Landscape recommended.");
  }

  function closePrototype(){
    closeReadinessSession();
    syncCoreVitals(true);
    saveCoreProgress(true);
    state.active = false;
    stopRenderLoop();
    resetJoystick();
    if(state.overlay) state.overlay.style.display = "none";
    if(state.overlay) state.overlay.classList.remove("combatLock");
    document.body.classList.remove("proto3dOpen");
    restorePauseState();
  }

  function forceDispose(){
    closeReadinessSession();
    syncCoreVitals(true);
    saveCoreProgress(true);
    state.active = false;
    stopRenderLoop();
    for(const fx of state.vfxBursts){
      releaseImpactFx(fx);
      if(fx && fx.mesh && fx.mesh.parent) fx.mesh.parent.remove(fx.mesh);
    }
    state.vfxBursts.length = 0;
    for(const fx of state.vfxPool){
      releaseImpactFx(fx);
      if(fx && fx.mesh && fx.mesh.parent) fx.mesh.parent.remove(fx.mesh);
    }
    state.vfxPool.length = 0;
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
  window.get3DReadinessGateStatus = function(){
    return get3DReadinessGateStatus();
  };
  window.refresh3DReadinessGateTelemetry = function(){
    return refresh3DReadinessGateTelemetry();
  };
  window.get3DMainModePreference = function(){
    return get3DMainModePreference();
  };
  window.set3DMainModePreference = function(enabled){
    return set3DMainModePreference(enabled);
  };
  window.close3DPrototype = function(){ closePrototype(); };
  window.reset3DPrototype = function(){ resetScenario(); };
  window.dispose3DPrototype = function(){ forceDispose(); };
})();
