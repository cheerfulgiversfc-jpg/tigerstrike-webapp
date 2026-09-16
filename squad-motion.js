// Presentation-only motion for the teammate on the other phone. Mission
// actions and interaction range still use the server's authoritative position.
(function(root, factory){
  const motion = factory();
  if(typeof module === "object" && module.exports) module.exports = motion;
  if(root) root.TigerStrikeSquadMotion = motion;
})(typeof window !== "undefined" ? window : null, function(){
  "use strict";
  const MAX_PREDICTION_MS = 360;
  const SNAP_DISTANCE = 420;
  const clamp = (value, min, max)=>Math.max(min, Math.min(max, Number(value) || 0));

  function accept(previous, player, receivedAt, world){
    const width = Math.max(48, Number(world?.width || 1200));
    const height = Math.max(48, Number(world?.height || 760));
    const x = clamp(player?.x, 24, width - 24);
    const y = clamp(player?.y, 24, height - 24);
    const priorX = Number(previous?.drawX);
    const priorY = Number(previous?.drawY);
    const changedDownState = previous && !!previous.downed !== !!player?.downed;
    const jumped = previous && Math.hypot(x - Number(previous.x), y - Number(previous.y)) > SNAP_DISTANCE;
    const snap = !previous || !Number.isFinite(priorX) || !Number.isFinite(priorY) || changedDownState || jumped;
    const dx = clamp(player?.moveX, -1, 1);
    const dy = clamp(player?.moveY, -1, 1);
    const length = Math.hypot(dx, dy);
    const moving = !!player?.moving && player?.online !== false && !player?.downed && length > .05;
    return {
      x, y,
      drawX:snap ? x : priorX,
      drawY:snap ? y : priorY,
      moveX:moving ? dx / Math.max(1, length) : 0,
      moveY:moving ? dy / Math.max(1, length) : 0,
      moving,
      downed:!!player?.downed,
      receivedAt:Number(receivedAt) || 0,
    };
  }

  function step(sample, frameAt, dt, speed, world){
    if(!sample) return null;
    const width = Math.max(48, Number(world?.width || 1200));
    const height = Math.max(48, Number(world?.height || 760));
    const predictionMs = sample.moving ? clamp(Number(frameAt) - sample.receivedAt, 0, MAX_PREDICTION_MS) : 0;
    const travel = Math.max(0, Number(speed) || 0) * predictionMs / 1000;
    const targetX = clamp(sample.x + sample.moveX * travel, 24, width - 24);
    const targetY = clamp(sample.y + sample.moveY * travel, 24, height - 24);
    const blend = 1 - Math.exp(-18 * clamp(dt, 0, .05));
    return {
      ...sample,
      drawX:sample.drawX + (targetX - sample.drawX) * blend,
      drawY:sample.drawY + (targetY - sample.drawY) * blend,
    };
  }

  return Object.freeze({ accept, step, MAX_PREDICTION_MS });
});
