(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerLivingIntelligence = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const STATES = Object.freeze({
    CALM:Object.freeze({ key:"calm", label:"Calm", color:"#4ade80", icon:"🟢", rank:0 }),
    SUSPICIOUS:Object.freeze({ key:"suspicious", label:"Suspicious", color:"#facc15", icon:"🟡", rank:1 }),
    STALKING:Object.freeze({ key:"stalking", label:"Stalking", color:"#fb923c", icon:"🟠", rank:2 }),
    ATTACKING:Object.freeze({ key:"attacking", label:"Attacking", color:"#fb7185", icon:"🔴", rank:3 }),
    BLOOD_FRENZY:Object.freeze({ key:"blood_frenzy", label:"Blood Frenzy", color:"#c084fc", icon:"🟣", rank:4 }),
  });
  const ORDER = Object.freeze([STATES.CALM, STATES.SUSPICIOUS, STATES.STALKING, STATES.ATTACKING, STATES.BLOOD_FRENZY]);
  const clamp = (value, min, max)=>Math.max(min, Math.min(max, Number(value) || 0));

  function balanceFor(input={}){
    const playerCount = Math.max(1, Math.floor(Number(input.playerCount || 1)));
    const solo = playerCount <= 1;
    const survival = String(input.mode || "").toLowerCase().includes("survival");
    const level = clamp(Math.floor(Number(input.level || 1)), 1, 100);
    const lateGame = clamp((level - 1) / 99, 0, 1);
    if(solo){
      return Object.freeze({
        solo:true,
        detectMul:survival ? 0.90 : 0.84 + lateGame * 0.03,
        damageMul:survival ? 0.90 : 0.82 + lateGame * 0.04,
        civilianDamageMul:survival ? 1 : 0.88 + lateGame * 0.04,
        pounceChanceMul:survival ? 0.78 : 0.64 + lateGame * 0.06,
        pounceCooldownMul:survival ? 1.16 : 1.30 - lateGame * 0.05,
        packDecisionMul:survival ? 0.72 : 0.56 + lateGame * 0.06,
        maxCoordinatedAttackers:2,
        warningMsMul:survival ? 1.18 : 1.36,
        memoryMs:survival ? 4400 : 3500,
      });
    }
    return Object.freeze({
      solo:false,
      detectMul:0.98,
      damageMul:0.96,
      civilianDamageMul:0.96,
      pounceChanceMul:0.90,
      pounceCooldownMul:1.04,
      packDecisionMul:0.90,
      maxCoordinatedAttackers:playerCount >= 3 ? 4 : 3,
      warningMsMul:1.12,
      memoryMs:4800,
    });
  }

  function noiseEvent(input={}){
    const intensity = clamp(input.intensity == null ? 1 : input.intensity, 0, 3);
    const noiseMul = clamp(input.noiseMul == null ? 1 : input.noiseMul, 0.1, 3);
    const at = Math.max(0, Number(input.at || Date.now()));
    const power = intensity * noiseMul;
    return Object.freeze({
      x:Number(input.x || 0),
      y:Number(input.y || 0),
      source:String(input.source || "movement"),
      at,
      radius:clamp(105 + power * 180, 90, 620),
      expiresAt:at + clamp(900 + power * 1050, 900, 5200),
      power,
    });
  }

  function noiseAt(event, x, y, now=Date.now()){
    if(!event || now > Number(event.expiresAt || 0)) return 0;
    const dx = Number(x || 0) - Number(event.x || 0);
    const dy = Number(y || 0) - Number(event.y || 0);
    const distance = Math.hypot(dx, dy);
    const radius = Math.max(1, Number(event.radius || 1));
    if(distance >= radius) return 0;
    const life = clamp((Number(event.expiresAt || now) - now) / Math.max(1, Number(event.expiresAt || now) - Number(event.at || now)), 0, 1);
    return clamp((1 - distance / radius) * Number(event.power || 0) * (0.55 + life * 0.45), 0, 3);
  }

  function stateForScore(score, bloodFrenzy=false){
    if(bloodFrenzy && score >= 0.45) return STATES.BLOOD_FRENZY;
    if(score >= 0.78) return STATES.ATTACKING;
    if(score >= 0.50) return STATES.STALKING;
    if(score >= 0.22) return STATES.SUSPICIOUS;
    return STATES.CALM;
  }

  function awarenessFor(input={}){
    const distance = Math.max(0, Number(input.distance == null ? Infinity : input.distance));
    const detectionRange = Math.max(1, Number(input.detectionRange || 1));
    const proximity = Number.isFinite(distance) ? clamp(1 - distance / detectionRange, 0, 1) : 0;
    const noise = clamp(input.noise, 0, 3);
    const blood = clamp(input.bloodScent, 0, 2);
    const visible = input.targetVisible === false ? 0 : 0.12;
    const enraged = input.enraged ? 0.16 : 0;
    const current = visualFor(input.current);
    const carry = current.rank >= STATES.STALKING.rank ? 0.08 : (current.rank === STATES.SUSPICIOUS.rank ? 0.035 : 0);
    const score = clamp(proximity * 0.74 + Math.min(1, noise) * 0.38 + Math.min(1, blood) * 0.42 + visible + enraged + carry, 0, 1.4);
    const state = stateForScore(score, blood >= 0.28 || !!input.bloodFrenzy);
    return Object.freeze({ ...state, score });
  }

  function visualFor(value){
    const key = typeof value === "string" ? value : value?.key;
    return ORDER.find((entry)=>entry.key === key) || STATES.CALM;
  }

  function rememberTarget(memory, target, now=Date.now(), durationMs=3500){
    const current = memory && typeof memory === "object" ? memory : null;
    if(target && Number.isFinite(Number(target.x)) && Number.isFinite(Number(target.y))){
      return { x:Number(target.x), y:Number(target.y), until:now + Math.max(500, Number(durationMs || 3500)) };
    }
    return current && now < Number(current.until || 0) ? current : null;
  }

  return Object.freeze({ STATES, ORDER, balanceFor, noiseEvent, noiseAt, awarenessFor, visualFor, rememberTarget });
});
