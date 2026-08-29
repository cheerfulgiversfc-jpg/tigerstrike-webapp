(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerAmmoRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const MODES = Object.freeze({ REAL:"real", RUBBER:"rubber", TRANQ:"tranq" });

  function normalizeAmmoMode(value, fallback=MODES.REAL){
    const mode = String(value || "").trim().toLowerCase();
    if(mode === MODES.REAL || mode === MODES.RUBBER || mode === MODES.TRANQ) return mode;
    return fallback;
  }

  function damageMultiplier(mode){
    return normalizeAmmoMode(mode) === MODES.RUBBER ? 0.62 : 1;
  }

  function rubberSlowMultiplier(stacks=1, active=true){
    if(!active) return 1;
    const count = Math.max(1, Math.min(4, Math.floor(Number(stacks) || 1)));
    return Math.max(0.52, 0.78 - ((count - 1) * 0.08));
  }

  function applyTigerAmmoDamage({ hp, hpMax, damage, mode, lethalWounded=false }={}){
    const max = Math.max(1, Number(hpMax) || 1);
    const before = Math.max(0, Math.min(max, Number(hp) || 0));
    const ammoMode = normalizeAmmoMode(mode);
    const scaled = Math.max(0, Number(damage) || 0) * damageMultiplier(ammoMode);
    const floor = ammoMode === MODES.RUBBER || ammoMode === MODES.TRANQ ? 1 : 0;
    const after = Math.max(floor, Math.min(max, before - scaled));
    return {
      hp:after,
      dealt:Math.max(0, before - after),
      defeated:after <= 0,
      lethalWounded:!!lethalWounded || ammoMode === MODES.REAL,
      slowed:ammoMode === MODES.RUBBER
    };
  }

  function canCaptureTiger({ hp, hpMax, lethalWounded=false, minRatio=0.01, maxRatio=0.30 }={}){
    const max = Math.max(1, Number(hpMax) || 1);
    const current = Math.max(0, Number(hp) || 0);
    return !lethalWounded && current >= max * minRatio && current <= max * maxRatio;
  }

  function shotModeMatches(selectedMode, loadedMode){
    return normalizeAmmoMode(selectedMode) === normalizeAmmoMode(loadedMode);
  }

  return Object.freeze({ MODES, normalizeAmmoMode, damageMultiplier, rubberSlowMultiplier, applyTigerAmmoDamage, canCaptureTiger, shotModeMatches });
});
