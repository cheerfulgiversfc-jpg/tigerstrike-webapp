const { telegramBotApi } = require("../_lib/telegram-api");
const { json } = require("../_lib/http");

function firstHeader(value){
  const raw = String(value || "").trim();
  if(!raw) return "";
  return String(raw.split(",")[0] || "").trim();
}

function envText(name, fallback = ""){
  return String(process.env[name] || fallback).trim();
}

function detectWebhookUrl(req){
  const envUrl = envText("TELEGRAM_WEBHOOK_URL");
  if(envUrl) return envUrl;
  const proto = firstHeader(req.headers?.["x-forwarded-proto"]) || "https";
  const host = firstHeader(req.headers?.["x-forwarded-host"]) || firstHeader(req.headers?.host);
  if(!host) return "";
  return `${proto}://${host}/api/telegram/webhook`;
}

function miniAppUrl(){
  return envText("TELEGRAM_MINI_APP_URL") || envText("MINI_APP_URL");
}

function getSetupKey(req){
  const fromHeader = String(req.headers?.["x-setup-key"] || "").trim();
  const fromQuery = String(req.query?.key || "").trim();
  return fromHeader || fromQuery;
}

module.exports = async function handler(req, res){
  if(req.method !== "POST" && req.method !== "GET"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  const botToken = envText("TELEGRAM_BOT_TOKEN");
  if(!botToken){
    return json(res, 500, { ok:false, error:"Server misconfigured: TELEGRAM_BOT_TOKEN is missing." });
  }

  const expectedKey = envText("TELEGRAM_SETUP_KEY");
  const key = getSetupKey(req);
  if(expectedKey && key !== expectedKey){
    return json(res, 401, { ok:false, error:"Unauthorized setup request." });
  }

  try{
    const webhookUrl = detectWebhookUrl(req);
    if(!webhookUrl){
      return json(res, 400, { ok:false, error:"Could not detect webhook URL." });
    }
    const secretToken = envText("TELEGRAM_WEBHOOK_SECRET");
    const appUrl = miniAppUrl();

    const me = await telegramBotApi("getMe", {}, botToken);

    const allowedUpdates = [
      "message",
      "channel_post",
      "inline_query",
      "callback_query",
      "pre_checkout_query",
      "business_connection",
      "business_message",
      "edited_business_message",
      "deleted_business_messages",
    ];
    const webhookPayload = {
      url: webhookUrl,
      allowed_updates: allowedUpdates,
      drop_pending_updates: false,
    };
    if(secretToken){
      webhookPayload.secret_token = secretToken;
    }
    await telegramBotApi("setWebhook", webhookPayload, botToken);

    const privateCommands = [
      { command:"start", description:"Start Tiger Strike bot" },
      { command:"help", description:"Show command guide" },
      { command:"settings", description:"Open bot settings shortcuts" },
      { command:"play", description:"Launch Tiger Strike Mini App" },
      { command:"stars", description:"How to buy/spend Telegram Stars" },
      { command:"ref", description:"Get your personal referral link" },
      { command:"liveops_now", description:"Admin trigger liveops post" },
      { command:"stats_today", description:"Admin funnel stats (today)" },
      { command:"stats_7d", description:"Admin funnel stats (7d)" },
      { command:"status", description:"Check bot/webhook status" },
      { command:"admin", description:"Admin command shortcuts" },
    ];
    const groupCommands = [
      { command:"start", description:"Initialize in this chat" },
      { command:"help", description:"Show available commands" },
      { command:"play", description:"Open Tiger Strike Mini App" },
      { command:"status", description:"Check bot status" },
    ];
    await telegramBotApi("setMyCommands", {
      scope: { type: "default" },
      commands: privateCommands,
    }, botToken);
    await telegramBotApi("setMyCommands", {
      scope: { type: "all_group_chats" },
      commands: groupCommands,
    }, botToken);

    if(appUrl){
      await telegramBotApi("setChatMenuButton", {
        menu_button: {
          type: "web_app",
          text: "Play Tiger Strike",
          web_app: { url: appUrl },
        },
      }, botToken);
    }else{
      await telegramBotApi("setChatMenuButton", {
        menu_button: { type: "commands" },
      }, botToken);
    }

    return json(res, 200, {
      ok: true,
      configured: true,
      bot: {
        id: Number(me?.id || 0),
        username: String(me?.username || ""),
      },
      webhook_url: webhookUrl,
      menu_button: appUrl ? "web_app" : "commands",
      mini_app_url: appUrl || null,
      allowed_updates: allowedUpdates,
      commands: {
        private: privateCommands.length,
        group: groupCommands.length,
      },
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Telegram setup failed." });
  }
};
