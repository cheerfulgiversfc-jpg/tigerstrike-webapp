(()=>{
  "use strict";
  document.documentElement.setAttribute("data-extraction-qa-loaded", "1");
  let params;
  try{ params = new URLSearchParams(window.location.search || ""); }catch(e){ return; }
  const type = String(params.get("extractQa") || "").toLowerCase();
  document.documentElement.setAttribute("data-extraction-qa", type || "none");
  if(params.get("debug") !== "1" || !["river","helicopter","vehicle"].includes(type)) return;

  const qaStyle = document.createElement("style");
  qaStyle.textContent = "#baseHqOverlay,#dailyRewardOverlay,#modeOverlay,#shopOverlay,#invOverlay,#storyIntroOverlay,#launchIntroOverlay,#missionCinemaOverlay,#missionBriefOverlay,#worldMapCampaignOverlay{display:none!important}";
  document.head.appendChild(qaStyle);

  const hideStartupOverlays = ()=>{
    for(const id of ["baseHqOverlay","dailyRewardOverlay","modeOverlay","shopOverlay","invOverlay","storyIntroOverlay","launchIntroOverlay","missionCinemaOverlay","missionBriefOverlay","worldMapCampaignOverlay"]){
      const element = document.getElementById(id);
      if(!element) continue;
      element.style.display = "none";
      element.classList.remove("show","open","active");
      element.setAttribute("aria-hidden","true");
    }
  };
  let hidePasses = 0;
  const hideTimer = window.setInterval(()=>{
    hideStartupOverlays();
    hidePasses += 1;
    if(hidePasses >= 30) window.clearInterval(hideTimer);
  }, 250);

  let attempts = 0;
  const prepare = ()=>{
    let state = window.S;
    const geometry = window.TigerExtractionGeometry;
    if((!state || !geometry) && attempts++ < 30) return window.setTimeout(prepare, 200);
    if(!state || !geometry) return;

    const now = Date.now();
    document.documentElement.setAttribute("data-extraction-qa-prepared", String(now));
    window.__tigerExtractionQaLeaveBaseHq?.();
    // Leaving HQ can restore/rebind the saved runtime object. Always mutate
    // the active state reference, not the object that existed before exit.
    state = window.__tigerExtractionQaWithState?.((activeState)=>activeState) || window.S;
    if(!state) return;
    const worldW = Math.max(1200, Number(state.world?.w || 4800));
    const worldH = Math.max(1100, Number(state.world?.h || 2800));
    state.mode = "Story";
    // Keep the draw loop active so browser QA captures the newly positioned
    // river/road/air scene instead of the last frame painted before setup.
    state.paused = false;
    state.pauseReason = null;
    state.gameOver = false;
    state.missionEnded = false;
    const placement = type === "river"
      ? geometry.sharedStoryRiverPlacement(worldW, worldH, { x:180, y:180 })
      : (type === "vehicle"
        ? geometry.sharedStoryRoadPlacement(worldW, worldH, { x:180, y:180 })
        : { x:860, y:720, vehicleX:860, vehicleY:720, vehicleAngle:0 });
    const key = type === "river" ? "boat" : (type === "helicopter" ? "helicopter" : "suv");
    const icon = type === "river" ? "🚤" : (type === "helicopter" ? "🚁" : "🚙");
    const label = type === "river" ? "River Extraction" : (type === "helicopter" ? "Helicopter Extraction" : "Armored SUV Extraction");
    const color = type === "river" ? "rgba(34,211,238,.98)" : (type === "helicopter" ? "rgba(96,165,250,.98)" : "rgba(52,211,153,.98)");
    const departing = params.get("depart") === "1";

    state.me = { ...(state.me || {}), x:placement.shoreX || placement.x, y:placement.shoreY || placement.y, vx:0, vy:0 };
    state.camera = { x:state.me.x, y:state.me.y };
    document.documentElement.setAttribute("data-extraction-qa-player", `${state.me.x},${state.me.y}`);
    state.evacZone = { x:placement.x, y:placement.y, r:74 };
    state.evacRoute = departing ? { active:false } : {
      active:true,key,icon,label,instruction:`Board ${label}.`,color,vehicle:key,
      x:placement.x,y:placement.y,r:74,startX:180,startY:180,midX:(180 + placement.x) * 0.5,midY:(180 + (placement.shoreY || placement.y)) * 0.5,
      altX:placement.x - 180,altY:placement.y,vehicleX:placement.vehicleX,vehicleY:placement.vehicleY,vehicleAngle:placement.vehicleAngle,
      blocked:false,blockedUntil:0,noticeAt:now + 999999,lastTickAt:now,boardedCount:2,boardingTotal:2,boardingPaused:false,boardingPauseReason:"",
      departStartedAt:0,departUntil:0,departing:false,departed:false,departedAt:0,cinematicStartedAt:now,cinematicBoardPulseAt:0,lastBoardedCount:2,
      lastCinematicPhase:"route_set",successRecap:"",problemType:"",problemLabel:"",problemStartedAt:0,problemUntil:0,problemResolvedAt:0,problemNoticeAt:0
    };
    state.extractionSequence = departing ? {
      active:true,complete:false,departing:true,playerBoarded:true,key,label,icon,color,x:placement.x,y:placement.y,r:74,
      vehicleX:placement.vehicleX,vehicleY:placement.vehicleY,vehicleAngle:placement.vehicleAngle,startedAt:now - 1000,deadlineAt:now + 60000,
      holdStartedAt:now - 3000,holdProgressMs:16000,holdRequiredMs:16000,departStartedAt:now,
      departUntil:now + geometry.departureDurationMs(key),lastTickAt:now,nextNoticeAt:now + 999999,pursuitSpawned:true,emergency:false,bonusCash:0
    } : { active:false,complete:false,departing:false,playerBoarded:false };

    for(const civilian of (state.civilians || [])){
      civilian.alive = true;
      civilian.evac = true;
      civilian.safeZoneLocked = true;
      civilian.boardingAt = now - 5000;
      civilian.boardedAt = now - 2000;
      civilian.x = placement.vehicleX;
      civilian.y = placement.vehicleY;
    }
    state.evacDone = (state.civilians || []).length;
    hideStartupOverlays();
  };
  // Startup can legitimately open HQ or a Story briefing. Run after that
  // sequence settles so the QA scenario remains the final visible state.
  window.setTimeout(prepare, 7000);
})();
