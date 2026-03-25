const { json, readJsonBody } = require("../_lib/http");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { recordGameplaySnapshot } = require("../_lib/player-stats");

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  try{
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if(!botToken){
      return json(res, 500, { ok:false, error:"Server misconfigured: TELEGRAM_BOT_TOKEN is missing." });
    }

    const body = readJsonBody(req);
    const initData = String(body?.initData || "");
    if(!initData){
      return json(res, 400, { ok:false, error:"Missing initData." });
    }

    const { user } = validateTelegramInitData(initData, botToken);
    const snapshot = (body?.snapshot && typeof body.snapshot === "object") ? body.snapshot : {};
    const profile = await recordGameplaySnapshot({ user, snapshot });
    if(!profile){
      return json(res, 400, { ok:false, error:"Could not update gameplay stats." });
    }

    return json(res, 200, {
      ok: true,
      userId: Number(profile.userId || 0),
      daily: profile.daily || null,
      weekly: profile.weekly || null,
      monthly: profile.monthly || null,
      lifetimeScore: Number(profile.lifetimeScore || 0),
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Gameplay sync failed." });
  }
};

