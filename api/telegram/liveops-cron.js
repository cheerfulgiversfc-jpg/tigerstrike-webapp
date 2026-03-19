const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");
const { incrMetric, getState, setState } = require("../_lib/metrics-store");
const liveops = require("../_lib/liveops");

function envText(name, fallback = ""){
  return String(process.env[name] || fallback).trim();
}

function dayIdUtc(ms = Date.now()){
  const d = new Date(Number(ms || Date.now()));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function requestKey(req){
  const byQuery = String(req.query?.key || "").trim();
  const byHeader = String(req.headers?.["x-liveops-key"] || "").trim();
  const auth = String(req.headers?.authorization || "").trim();
  if(auth.toLowerCase().startsWith("bearer ")){
    return String(auth.slice(7) || "").trim();
  }
  return byHeader || byQuery;
}

function isAuthorized(req){
  const got = requestKey(req);
  const liveopsKey = envText("TELEGRAM_LIVEOPS_KEY");
  const cronSecret = envText("CRON_SECRET");

  if(!liveopsKey && !cronSecret) return true;
  if(!got) return false;

  return (
    (liveopsKey && got === liveopsKey)
    || (cronSecret && got === cronSecret)
  );
}

function pickKind(req){
  const body = readJsonBody(req);
  const raw = String(req.query?.kind || body?.kind || "").trim().toLowerCase();
  if(!raw) return "";
  const allowed = new Set(liveops.liveopsKinds());
  return allowed.has(raw) ? raw : "";
}

async function metric(name){
  try{ await incrMetric(name, 1); }catch(e){ /* best effort */ }
}

async function metricKind(prefix, kind){
  try{
    const safe = String(kind || "").trim().toLowerCase().replace(/[^a-z0-9:_-]/g, "_");
    if(!safe) return;
    await incrMetric(`${prefix}:${safe}`, 1);
  }catch(e){ /* best effort */ }
}

module.exports = async function handler(req, res){
  if(req.method !== "GET" && req.method !== "POST"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  if(!isAuthorized(req)){
    return json(res, 401, { ok:false, error:"Unauthorized liveops request." });
  }

  const botToken = envText("TELEGRAM_BOT_TOKEN");
  if(!botToken){
    return json(res, 500, { ok:false, error:"Server misconfigured: TELEGRAM_BOT_TOKEN is missing." });
  }

  const channelId = liveops.normalizeChatId(envText("TELEGRAM_CHANNEL_ID"));
  if(!channelId){
    return json(res, 400, { ok:false, error:"Missing TELEGRAM_CHANNEL_ID." });
  }

  try{
    const nowMs = Date.now();
    const today = dayIdUtc(nowMs);
    const forcedKind = pickKind(req);

    if(!forcedKind){
      const already = await getState("liveops_last_day_utc");
      if(String(already || "") === today){
        return json(res, 200, {
          ok: true,
          skipped: true,
          reason: "already_posted_today",
          day: today,
        });
      }
    }

    const bot = await telegramBotApi("getMe", {}, botToken);
    const kind = forcedKind || liveops.pickLiveopsKind(nowMs);
    const tpl = liveops.buildPostTemplate(kind, String(bot?.username || ""));
    const text = `LiveOps Drop (${String(kind).toUpperCase()})\n\n${tpl.text}`;

    const sent = await telegramBotApi("sendMessage", {
      chat_id: channelId,
      text,
      disable_web_page_preview: true,
      reply_markup: tpl.reply_markup,
    }, botToken);

    if(!forcedKind){
      await setState("liveops_last_day_utc", today);
    }
    await setState("liveops_last_post", {
      at: new Date(nowMs).toISOString(),
      day: today,
      kind,
      channelId,
      messageId: Number(sent?.message_id || 0),
      forced: !!forcedKind,
    });

    await metric("liveops_posted");
    await metricKind("liveops_post_kind", kind);

    return json(res, 200, {
      ok: true,
      posted: true,
      day: today,
      kind,
      channel_id: channelId,
      message_id: Number(sent?.message_id || 0),
      forced: !!forcedKind,
    });
  }catch(e){
    await metric("liveops_error");
    return json(res, 500, { ok:false, error:e?.message || "LiveOps post failed." });
  }
};
