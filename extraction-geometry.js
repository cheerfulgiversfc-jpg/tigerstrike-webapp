(function(root, factory){
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerExtractionGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const clamp = (value, min, max)=>Math.max(min, Math.min(max, value));

  function ellipseBoundaryRadius(zone, worldAngle){
    const rx = Math.max(1, Number(zone?.rx || 1));
    const ry = Math.max(1, Number(zone?.ry || 1));
    const local = Number(worldAngle || 0) - Number(zone?.rot || 0);
    const cos = Math.cos(local);
    const sin = Math.sin(local);
    return 1 / Math.sqrt((cos * cos) / (rx * rx) + (sin * sin) / (ry * ry));
  }

  function largestWaterZone(zones){
    return (Array.isArray(zones) ? zones : [])
      .filter((zone)=>zone && Number(zone.rx) >= 34 && Number(zone.ry) >= 22)
      .sort((a,b)=>(Number(b.rx) * Number(b.ry)) - (Number(a.rx) * Number(a.ry)))[0] || null;
  }

  function ellipseBoatPlacement(zone, player={}){
    if(!zone) return null;
    const zx = Number(zone.x || 0);
    const zy = Number(zone.y || 0);
    const angleToShore = Math.atan2(Number(player.y || zy) - zy, Number(player.x || zx) - zx);
    const boundary = ellipseBoundaryRadius(zone, angleToShore);
    const waterInset = clamp(boundary * 0.24, 24, 48);
    const pickupRadius = Math.max(boundary * 0.24, boundary - waterInset);
    const cos = Math.cos(angleToShore);
    const sin = Math.sin(angleToShore);
    return {
      x:zx + cos * pickupRadius,
      y:zy + sin * pickupRadius,
      vehicleX:zx + cos * pickupRadius,
      vehicleY:zy + sin * pickupRadius,
      vehicleAngle:angleToShore + Math.PI,
      shoreX:zx + cos * (boundary + 10),
      shoreY:zy + sin * (boundary + 10),
      waterCenterX:zx,
      waterCenterY:zy,
      waterBoundaryRadius:boundary
    };
  }

  // Story's bright phone renderer repeats a 1200 x 1100 district. Its river is
  // the wide band at the bottom of every district, so extraction must use that
  // same geometry instead of an unrelated decorative-water cache.
  function sharedStoryRiverPlacement(worldW, worldH, player={}){
    const w = Math.max(320, Number(worldW || 1200));
    const h = Math.max(320, Number(worldH || 1100));
    const px = clamp(Number(player.x || w * 0.5), 0, w);
    const py = clamp(Number(player.y || h * 0.5), 0, h);
    const columns = Math.max(1, Math.ceil(w / 1200));
    const completeRows = [];
    for(let row=0; row<Math.max(1, Math.ceil(h / 1100)); row++){
      const oy = row * 1100;
      if(oy + 990 <= h - 74) completeRows.push(row);
    }
    const rows = completeRows.length ? completeRows : [0];
    const row = rows.reduce((best, candidate)=>{
      const bestY = (best * 1100) + 1012;
      const candidateY = (candidate * 1100) + 1012;
      return Math.abs(candidateY - py) > Math.abs(bestY - py) ? candidate : best;
    }, rows[0]);
    const localX = px < w * 0.5 ? 1010 : 190;
    const completeColumns = [];
    for(let column=0; column<columns; column++){
      const districtX = column * 1200;
      if(districtX + localX <= w - 74) completeColumns.push(column);
    }
    // Never clamp a river pickup into a partial district. On a 4,228px-wide
    // world, clamping x=4,610 to the edge lands on the vertical road instead
    // of water. Use the last complete river segment instead.
    const usableColumns = completeColumns.length ? completeColumns : [0];
    const column = px < w * 0.5 ? usableColumns[usableColumns.length - 1] : usableColumns[0];
    const ox = column * 1200;
    const oy = row * 1100;
    const x = clamp(ox + localX, 74, w - 74);
    const y = clamp(oy + 990, 74, h - 74);
    const travelEast = localX < 600;
    return {
      x,
      y,
      vehicleX:x,
      vehicleY:y,
      vehicleAngle:travelEast ? 0 : Math.PI,
      shoreX:x,
      shoreY:clamp(oy + 925, 40, h - 40),
      waterCenterX:ox + 600,
      waterCenterY:oy + 1010,
      sharedStoryRiver:true
    };
  }

  function sharedStoryRoadPlacement(worldW, worldH, player={}){
    const w = Math.max(320, Number(worldW || 1200));
    const h = Math.max(320, Number(worldH || 1100));
    const px = clamp(Number(player.x || w * 0.5), 0, w);
    const py = clamp(Number(player.y || h * 0.5), 0, h);
    const columns = Math.max(1, Math.ceil(w / 1200));
    const rows = Math.max(1, Math.ceil(h / 1100));
    const localX = px < w * 0.5 ? 1010 : 190;
    const completeColumns = [];
    for(let column=0; column<columns; column++){
      const districtX = column * 1200;
      if(districtX + localX <= w - 74) completeColumns.push(column);
    }
    const usableColumns = completeColumns.length ? completeColumns : [0];
    const column = px < w * 0.5 ? usableColumns[usableColumns.length - 1] : usableColumns[0];
    const completeRows = [];
    for(let row=0; row<rows; row++){
      const districtY = row * 1100;
      if(districtY + 536 <= h - 74) completeRows.push(row);
    }
    const usableRows = completeRows.length ? completeRows : [0];
    const row = py < h * 0.5 ? usableRows[usableRows.length - 1] : usableRows[0];
    const ox = column * 1200;
    const oy = row * 1100;
    const x = clamp(ox + localX, 74, w - 74);
    const y = clamp(oy + 536, 74, h - 74);
    return {
      x,
      y,
      vehicleX:x,
      vehicleY:y,
      vehicleAngle:localX < 600 ? Math.PI : 0,
      sharedStoryRoad:true
    };
  }

  function departureMotion(key, progress, angle=0){
    const pct = clamp(Number(progress || 0), 0, 1);
    if(key === "helicopter"){
      return { dx:pct * 150, dy:-pct * 380, scale:1 - (pct * 0.38) };
    }
    const distance = key === "boat" ? 560 : 520;
    return {
      dx:Math.cos(Number(angle || 0)) * pct * distance,
      dy:Math.sin(Number(angle || 0)) * pct * distance,
      scale:1
    };
  }

  function departureDurationMs(key){
    if(key === "helicopter") return 5200;
    if(key === "boat") return 4800;
    if(key === "plane") return 5200;
    return 4200;
  }

  return Object.freeze({
    ellipseBoundaryRadius,
    largestWaterZone,
    ellipseBoatPlacement,
    sharedStoryRiverPlacement,
    sharedStoryRoadPlacement,
    departureMotion,
    departureDurationMs
  });
});
