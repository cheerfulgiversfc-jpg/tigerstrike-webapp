const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

let cachedBotMeta = null;

function envText(name, fallback = ""){
  return String(process.env[name] || fallback).trim();
}

function miniAppUrl(){
  return envText("TELEGRAM_MINI_APP_URL") || envText("MINI_APP_URL");
}

async function getBotMeta(botToken){
  if(cachedBotMeta?.id && cachedBotMeta?.username){
    return cachedBotMeta;
  }
  const me = await telegramBotApi("getMe", {}, botToken);
  cachedBotMeta = {
    id: Number(me?.id || 0),
    username: String(me?.username || "").trim(),
  };
  return cachedBotMeta;
}

function botDeepLink(username, parameter, group = false){
  const user = String(username || "").trim();
  if(!user) return "";
  const key = group ? "startgroup" : "start";
  const val = encodeURIComponent(String(parameter || "").trim());
  return `https://t.me/${user}?${key}=${val}`;
}

function parseCommand(text, botUsername){
  const raw = String(text || "").trim();
  if(!raw.startsWith("/")) return null;
  const [first, ...rest] = raw.split(/\s+/);
  if(!first) return null;
  const body = first.slice(1);
  if(!body) return null;

  const [cmdRaw, targetRaw] = body.split("@");
  const command = String(cmdRaw || "").trim().toLowerCase();
  const target = String(targetRaw || "").trim().toLowerCase();
  const username = String(botUsername || "").trim().toLowerCase();
  if(target && username && target !== username){
    return null;
  }
  if(!/^[a-z0-9_]{1,32}$/.test(command)){
    return null;
  }
  return {
    command,
    args: rest.join(" ").trim(),
  };
}

function mainKeyboard(url){
  const rows = [];
  if(url){
    rows.push([{ text:"Play Tiger Strike", web_app:{ url } }]);
  }
  rows.push([
    { text:"Help", callback_data:"help" },
    { text:"Settings", callback_data:"settings" },
  ]);
  rows.push([
    { text:"Stars", callback_data:"stars" },
  ]);
  return { inline_keyboard: rows };
}

function commandSummaryText(botUsername, url){
  const user = botUsername ? `@${botUsername}` : "your bot";
  const launchLine = url
    ? "Use the Play Tiger Strike button below to launch the Mini App."
    : `Set TELEGRAM_MINI_APP_URL to add a Play button for ${user}.`;
  return [
    "Tiger Strike bot commands:",
    "/start - open welcome + launch options",
    "/help - command and usage guide",
    "/settings - account/settings shortcuts",
    "/play - open Mini App button",
    "/stars - quick Stars purchase help",
    "/status - bot + checkout status",
    "",
    launchLine,
  ].join("\n");
}

async function sendText(botToken, chatId, text, extra = {}){
  if(!chatId) return;
  await telegramBotApi("sendMessage", {
    chat_id: chatId,
    text: String(text || ""),
    disable_web_page_preview: true,
    ...extra,
  }, botToken);
}

async function answerCallback(botToken, callbackQueryId, text){
  if(!callbackQueryId) return;
  await telegramBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: String(text || ""),
    show_alert: false,
  }, botToken);
}

function startMessage(args, username, url){
  const base = [
    "Welcome to Tiger Strike.",
    "Play the Mini App, buy Stars, and spend them on cash or premium bundles.",
  ];
  const token = String(args || "").trim();
  if(token){
    if(token.startsWith("bizChat")){
      base.push("", "Business chat linked. Use /settings to manage bot options.");
    }else{
      base.push("", `Deep link detected: ${token}`);
    }
  }
  if(!url && username){
    base.push("", `Open bot: https://t.me/${username}`);
  }
  return base.join("\n");
}

function settingsMessage(username, url){
  const groupLink = username ? botDeepLink(username, "channel_setup", true) : "";
  const lines = [
    "Settings shortcuts:",
    "- Use /help for command list",
    "- Use /status to verify webhook/payment health",
    "- Use /stars for purchase guidance",
  ];
  if(url){
    lines.push("- Launch Mini App from the Play button");
  }
  if(groupLink){
    lines.push(`- Add bot to a group/channel: ${groupLink}`);
  }
  return lines.join("\n");
}

function starsHelpMessage(){
  return [
    "Stars purchase flow:",
    "1) Open Mini App",
    "2) Use Stars tab to top up",
    "3) Spend Stars in Cash or Premium tab",
    "If payment finishes but reward is missing, use Claim Pending Purchase.",
  ].join("\n");
}

function statusMessage(url, updateType){
  return [
    "Tiger Strike bot status:",
    `- Webhook update: ${updateType || "unknown"}`,
    `- Mini App URL: ${url ? "configured" : "missing (set TELEGRAM_MINI_APP_URL)"}`,
    "- Stars checkout: enabled",
  ].join("\n");
}

async function handleCommandMessage(botToken, msg, botUsername, appUrl, updateType){
  const chatId = Number(msg?.chat?.id || 0);
  const parsed = parseCommand(msg?.text, botUsername);
  if(!parsed || !chatId) return false;

  if(parsed.command === "start"){
    await sendText(botToken, chatId, startMessage(parsed.args, botUsername, appUrl), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(parsed.command === "help"){
    await sendText(botToken, chatId, commandSummaryText(botUsername, appUrl), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(parsed.command === "settings"){
    await sendText(botToken, chatId, settingsMessage(botUsername, appUrl), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(parsed.command === "play"){
    await sendText(botToken, chatId, appUrl ? "Tap below to launch Tiger Strike." : "Mini App URL not configured yet.", {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(parsed.command === "stars"){
    await sendText(botToken, chatId, starsHelpMessage(), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(parsed.command === "status"){
    await sendText(botToken, chatId, statusMessage(appUrl, updateType), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  return false;
}

async function handleCallbackQuery(botToken, callback, appUrl, botUsername){
  if(!callback?.id) return false;
  const data = String(callback.data || "").trim().toLowerCase();
  const msg = callback.message;
  const chatId = Number(msg?.chat?.id || 0);
  if(!chatId){
    await answerCallback(botToken, callback.id, "Done.");
    return true;
  }
  if(data === "help"){
    await answerCallback(botToken, callback.id, "Help opened.");
    await sendText(botToken, chatId, commandSummaryText(botUsername, appUrl), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(data === "settings"){
    await answerCallback(botToken, callback.id, "Settings opened.");
    await sendText(botToken, chatId, settingsMessage(botUsername, appUrl), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  if(data === "stars"){
    await answerCallback(botToken, callback.id, "Stars help opened.");
    await sendText(botToken, chatId, starsHelpMessage(), {
      reply_markup: mainKeyboard(appUrl),
    });
    return true;
  }
  await answerCallback(botToken, callback.id, "Action received.");
  return true;
}

async function handleInlineQuery(botToken, inlineQuery, appUrl, botUsername){
  if(!inlineQuery?.id) return false;
  const username = String(botUsername || "").trim();
  const url = appUrl || (username ? `https://t.me/${username}` : "");
  const results = [
    {
      type: "article",
      id: "tigerstrike_open_app",
      title: "Tiger Strike Mini App",
      description: "Launch the game and continue your progress.",
      input_message_content: {
        message_text: "Play Tiger Strike in Telegram.",
      },
      reply_markup: {
        inline_keyboard: [
          [{ text:"Open Tiger Strike", url }],
        ],
      },
    },
  ];
  await telegramBotApi("answerInlineQuery", {
    inline_query_id: inlineQuery.id,
    is_personal: true,
    cache_time: 5,
    results,
  }, botToken);
  return true;
}

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 200, { ok:true, info:"Telegram webhook endpoint. Use POST updates only." });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const headerSecret = String(req.headers?.["x-telegram-bot-api-secret-token"] || "").trim();

  if(!botToken){
    return json(res, 500, { ok:false, error:"Server misconfigured: TELEGRAM_BOT_TOKEN is missing." });
  }

  if(expectedSecret && headerSecret !== expectedSecret){
    return json(res, 403, { ok:false, error:"Invalid webhook secret." });
  }

  try{
    const update = readJsonBody(req);
    const appUrl = miniAppUrl();
    const botMeta = await getBotMeta(botToken);
    const botUsername = String(botMeta?.username || "");

    const preCheckout = update?.pre_checkout_query;
    if(preCheckout?.id){
      await telegramBotApi("answerPreCheckoutQuery", {
        pre_checkout_query_id: preCheckout.id,
        ok: true,
      }, botToken);
      return json(res, 200, { ok:true, handled:"pre_checkout_query" });
    }

    // successful_payment updates are optional to process here because claim API
    // verifies against Telegram star transactions server-side.
    if(update?.message?.successful_payment){
      return json(res, 200, { ok:true, handled:"successful_payment" });
    }

    if(update?.inline_query?.id){
      await handleInlineQuery(botToken, update.inline_query, appUrl, botUsername);
      return json(res, 200, { ok:true, handled:"inline_query" });
    }

    if(update?.callback_query?.id){
      await handleCallbackQuery(botToken, update.callback_query, appUrl, botUsername);
      return json(res, 200, { ok:true, handled:"callback_query" });
    }

    const msg = update?.message || update?.channel_post || update?.business_message;
    if(msg?.text){
      const kind = update?.message ? "message" : update?.channel_post ? "channel_post" : "business_message";
      const handled = await handleCommandMessage(botToken, msg, botUsername, appUrl, kind);
      if(handled){
        return json(res, 200, { ok:true, handled:`${kind}_command` });
      }
    }

    return json(res, 200, { ok:true, handled:"ignored" });
  }catch(e){
    return json(res, 200, { ok:false, error:e?.message || "Webhook handler failed." });
  }
};
