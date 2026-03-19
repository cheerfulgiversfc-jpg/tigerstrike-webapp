const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

let cachedBotMeta = null;
let cachedBotMetaAt = 0;

function envText(name, fallback = ""){
  return String(process.env[name] || fallback).trim();
}

function miniAppUrl(){
  return envText("TELEGRAM_MINI_APP_URL") || envText("MINI_APP_URL");
}

function webhookSecret(){
  return envText("TELEGRAM_WEBHOOK_SECRET");
}

function nowMs(){
  return Date.now();
}

function toInt(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeChatId(value){
  const raw = String(value || "").trim();
  if(!raw) return null;
  if(raw.startsWith("@")) return raw;
  if(/^[-]?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function parseAdminIds(){
  const raw = envText("TELEGRAM_ADMIN_IDS");
  if(!raw) return new Set();
  const ids = raw
    .split(",")
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return new Set(ids);
}

function isAdminUser(user){
  const adminIds = parseAdminIds();
  if(!adminIds.size) return false;
  const userId = String(user?.id || "").trim();
  if(!userId) return false;
  return adminIds.has(userId);
}

function readCommand(text, botUsername){
  const raw = String(text || "").trim();
  if(!raw.startsWith("/")) return null;

  const first = String(raw.split(/\s+/, 1)[0] || "").trim();
  const m = first.match(/^\/([A-Za-z0-9_]{1,64})(?:@([A-Za-z0-9_]{3,}))?$/);
  if(!m) return null;

  const command = String(m[1] || "").toLowerCase();
  const at = String(m[2] || "").toLowerCase();
  const expected = String(botUsername || "").toLowerCase();
  if(at && expected && at !== expected) return null;

  const argsText = String(raw.slice(first.length) || "").trim();
  const args = argsText ? argsText.split(/\s+/).filter(Boolean) : [];

  return { command, argsText, args };
}

function safeName(user){
  const first = String(user?.first_name || "").trim();
  const last = String(user?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  if(full) return full;
  const username = String(user?.username || "").trim();
  if(username) return `@${username}`;
  return "there";
}

async function getBotMeta(botToken){
  const freshForMs = 60 * 1000;
  const age = nowMs() - cachedBotMetaAt;
  if(cachedBotMeta && age < freshForMs){
    return cachedBotMeta;
  }
  const me = await telegramBotApi("getMe", {}, botToken);
  cachedBotMeta = {
    id: toInt(me?.id),
    username: String(me?.username || ""),
  };
  cachedBotMetaAt = nowMs();
  return cachedBotMeta;
}

function botLink(botUsername, startParam){
  const uname = String(botUsername || "").trim();
  if(!uname) return "";
  if(startParam){
    return `https://t.me/${uname}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${uname}`;
}

function buildStartKeyboard(botUsername){
  const rows = [];
  const appUrl = miniAppUrl();
  const openBot = botLink(botUsername);

  if(appUrl){
    rows.push([{ text: "Play Tiger Strike", url: appUrl }]);
  }else if(openBot){
    rows.push([{ text: "Open Bot", url: openBot }]);
  }

  rows.push([
    { text: "Help", callback_data: "help" },
    { text: "Stars", callback_data: "stars" },
  ]);

  return { inline_keyboard: rows };
}

function helpText(){
  return [
    "Tiger Strike Bot Commands:",
    "/start - Start bot and quick actions",
    "/play - Open Tiger Strike mini app",
    "/stars - Stars purchase/spend help",
    "/ref - Get your referral link",
    "/status - Check bot setup status",
    "/settings - Quick settings help",
    "",
    "Admin-only:",
    "/admin",
    "/post_play",
    "/post_stars",
    "/post_premium",
    "/post_campaign",
  ].join("\n");
}

function starsHelpText(botUsername){
  const link = botLink(botUsername, "stars");
  return [
    "Stars flow:",
    "1) Buy Stars in Telegram",
    "2) Spend Stars in Tiger Strike (Cash/Premium)",
    "3) Bot verifies payment server-side, then grants instantly",
    "",
    link ? `Bot link: ${link}` : "",
  ].filter(Boolean).join("\n");
}

function settingsText(){
  return [
    "Settings shortcuts:",
    "- Use /play to open the Mini App",
    "- Use /stars to view payment flow",
    "- Use /ref to copy your referral link",
  ].join("\n");
}

function statusText(ctx){
  const hasToken = !!envText("TELEGRAM_BOT_TOKEN");
  const hasSecret = !!envText("TELEGRAM_WEBHOOK_SECRET");
  const hasMini = !!miniAppUrl();
  const hasSetupKey = !!envText("TELEGRAM_SETUP_KEY");
  const hasAdmins = parseAdminIds().size > 0;
  const hasChannel = !!normalizeChatId(envText("TELEGRAM_CHANNEL_ID"));
  const source = ctx?.chat?.type || "unknown";

  return [
    "Tiger Strike Bot Status:",
    `token: ${hasToken ? "ok" : "missing"}`,
    `webhook secret: ${hasSecret ? "ok" : "not set"}`,
    `mini app url: ${hasMini ? "ok" : "missing"}`,
    `setup key: ${hasSetupKey ? "ok" : "not set"}`,
    `admin ids: ${hasAdmins ? "ok" : "missing"}`,
    `channel id: ${hasChannel ? "ok" : "missing"}`,
    `chat type: ${source}`,
  ].join("\n");
}

function adminHelpText(){
  return [
    "Admin commands:",
    "/post_play - Post Play CTA to channel",
    "/post_stars - Post Stars top-up CTA",
    "/post_premium - Post Premium bundle CTA",
    "/post_campaign - Post campaign update CTA",
    "",
    "Set TELEGRAM_CHANNEL_ID to post from private chat.",
  ].join("\n");
}

function templateForPost(kind, botUsername){
  const appUrl = miniAppUrl();
  const botUrl = botLink(botUsername);
  const starsUrl = botLink(botUsername, "stars");
  const playUrl = appUrl || botLink(botUsername, "play") || botUrl;

  if(kind === "play"){
    return {
      text: [
        "Tiger Strike is live.",
        "Story mode, Arcade, and Survival are ready.",
        "Tap below and deploy your squad.",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Play Tiger Strike", url: playUrl }],
          botUrl ? [{ text: "Open Bot", url: botUrl }] : [],
        ].filter((row) => row.length > 0),
      },
    };
  }

  if(kind === "stars"){
    return {
      text: [
        "Need more Stars for Tiger Strike?",
        "Top up, then spend Stars in Cash and Premium tabs.",
        "All rewards are verified server-side.",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open Stars Shop", url: playUrl }],
          starsUrl ? [{ text: "Open Bot Stars Help", url: starsUrl }] : [],
        ].filter((row) => row.length > 0),
      },
    };
  }

  if(kind === "premium"){
    return {
      text: [
        "Premium bundles are live in Tiger Strike.",
        "Use Stars to unlock high-impact mission loadouts.",
        "Limited-time campaign packs rotate weekly.",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open Premium Shop", url: playUrl }],
          botUrl ? [{ text: "Chat with Bot", url: botUrl }] : [],
        ].filter((row) => row.length > 0),
      },
    };
  }

  return {
    text: [
      "Campaign Alert: Tiger Strike operations updated.",
      "New mission pacing and rewards now active.",
      "Rally your squad and jump in.",
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: "Launch Mission", url: playUrl }],
        botUrl ? [{ text: "Bot Updates", url: botUrl }] : [],
      ].filter((row) => row.length > 0),
    },
  };
}

async function sendMessage(botToken, chatId, text, extra = {}){
  return telegramBotApi("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...extra,
  }, botToken);
}

async function answerCallback(botToken, callbackQueryId, text, showAlert){
  return telegramBotApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text ? String(text) : undefined,
    show_alert: !!showAlert,
  }, botToken);
}

function sourceMessageFromUpdate(update){
  return (
    update?.message
    || update?.channel_post
    || update?.business_message
    || update?.edited_business_message
    || null
  );
}

function targetChannelFrom(source){
  if(source?.chat?.type === "channel") return source.chat.id;
  return normalizeChatId(envText("TELEGRAM_CHANNEL_ID"));
}

async function notifyReferralEvent(botToken, data){
  const logChatId = normalizeChatId(envText("TELEGRAM_REF_LOG_CHAT_ID"));
  if(!logChatId) return;
  const text = [
    "Referral tracked:",
    `user_id: ${data.userId || "-"}`,
    `name: ${data.name || "-"}`,
    `username: ${data.username || "-"}`,
    `ref: ${data.ref || "-"}`,
    `chat_id: ${data.chatId || "-"}`,
  ].join("\n");

  try{ await sendMessage(botToken, logChatId, text); }catch(e){ /* best effort */ }
}

async function handleStartCommand(botToken, ctx, args, botUsername){
  const startParam = String(args?.[0] || "").trim();
  const first = safeName(ctx.from);

  const lines = [
    `Welcome ${first}.`,
    "Tiger Strike is ready.",
    "Use /play to launch the Mini App and /stars for payment help.",
  ];

  if(startParam.startsWith("ref_")){
    const ref = String(startParam.slice(4) || "").trim();
    if(ref){
      lines.push("");
      lines.push(`Referral code detected: ${ref}`);
      lines.push("You are linked. Rewards or attribution can now be tracked server-side.");

      await notifyReferralEvent(botToken, {
        userId: ctx.from?.id,
        name: `${ctx.from?.first_name || ""} ${ctx.from?.last_name || ""}`.trim(),
        username: ctx.from?.username ? `@${ctx.from.username}` : "",
        ref,
        chatId: ctx.chat?.id,
      });
    }
  }

  await sendMessage(botToken, ctx.chat.id, lines.join("\n"), {
    reply_markup: buildStartKeyboard(botUsername),
  });
}

async function handleRefCommand(botToken, ctx, botUsername){
  if(!botUsername){
    await sendMessage(botToken, ctx.chat.id, "Referral link is not ready yet. Try again in a few seconds.");
    return;
  }

  const userId = String(ctx.from?.id || "").trim();
  if(!userId){
    await sendMessage(botToken, ctx.chat.id, "Could not build referral link (missing user id).");
    return;
  }

  const startToken = `ref_${userId}`;
  const link = botLink(botUsername, startToken);

  await sendMessage(botToken, ctx.chat.id, [
    "Your referral link:",
    link,
    "",
    "Share this link. When users start the bot with it, we log the referral.",
  ].join("\n"), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Share Link", switch_inline_query: `Join Tiger Strike: ${link}` }],
      ],
    },
  });
}

async function handlePostCommand(botToken, ctx, botUsername, kind){
  if(!isAdminUser(ctx.from)){
    await sendMessage(botToken, ctx.chat.id, "Unauthorized. Add your Telegram user id to TELEGRAM_ADMIN_IDS.");
    return;
  }

  const target = targetChannelFrom(ctx);
  if(!target){
    await sendMessage(botToken, ctx.chat.id, "Missing TELEGRAM_CHANNEL_ID. Set it, redeploy, then retry.");
    return;
  }

  const tpl = templateForPost(kind, botUsername);
  await sendMessage(botToken, target, tpl.text, {
    reply_markup: tpl.reply_markup,
  });

  if(String(target) !== String(ctx.chat.id)){
    await sendMessage(botToken, ctx.chat.id, `Posted ${kind} template to ${String(target)}.`);
  }
}

async function handleCommand(botToken, update, source){
  const bot = await getBotMeta(botToken);
  const parsed = readCommand(source?.text || source?.caption || "", bot?.username);
  if(!parsed) return false;

  const ctx = {
    chat: source.chat,
    from: source.from,
    message_id: source.message_id,
  };

  switch(parsed.command){
    case "start": {
      await handleStartCommand(botToken, ctx, parsed.args, bot?.username || "");
      return true;
    }
    case "help": {
      await sendMessage(botToken, ctx.chat.id, helpText(), {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Play", callback_data: "play" }, { text: "Stars", callback_data: "stars" }],
          ],
        },
      });
      return true;
    }
    case "settings": {
      await sendMessage(botToken, ctx.chat.id, settingsText());
      return true;
    }
    case "play": {
      const appUrl = miniAppUrl();
      if(appUrl){
        await sendMessage(botToken, ctx.chat.id, "Launch Tiger Strike:", {
          reply_markup: {
            inline_keyboard: [[{ text: "Play Tiger Strike", url: appUrl }]],
          },
        });
      }else{
        await sendMessage(botToken, ctx.chat.id, "Mini app URL is not configured yet. Set TELEGRAM_MINI_APP_URL.");
      }
      return true;
    }
    case "stars": {
      await sendMessage(botToken, ctx.chat.id, starsHelpText(bot?.username || ""));
      return true;
    }
    case "ref": {
      await handleRefCommand(botToken, ctx, bot?.username || "");
      return true;
    }
    case "status": {
      await sendMessage(botToken, ctx.chat.id, statusText(ctx));
      return true;
    }
    case "admin": {
      if(!isAdminUser(ctx.from)){
        await sendMessage(botToken, ctx.chat.id, "Unauthorized. Add your Telegram user id to TELEGRAM_ADMIN_IDS.");
      }else{
        await sendMessage(botToken, ctx.chat.id, adminHelpText());
      }
      return true;
    }
    case "post_play": {
      await handlePostCommand(botToken, ctx, bot?.username || "", "play");
      return true;
    }
    case "post_stars": {
      await handlePostCommand(botToken, ctx, bot?.username || "", "stars");
      return true;
    }
    case "post_premium": {
      await handlePostCommand(botToken, ctx, bot?.username || "", "premium");
      return true;
    }
    case "post_campaign": {
      await handlePostCommand(botToken, ctx, bot?.username || "", "campaign");
      return true;
    }
    default:
      return false;
  }
}

async function handleCallbackQuery(botToken, update){
  const q = update?.callback_query;
  if(!q) return;

  const data = String(q.data || "").trim().toLowerCase();
  const chatId = q?.message?.chat?.id;

  if(data === "help"){
    await answerCallback(botToken, q.id, "Opening help");
    if(chatId) await sendMessage(botToken, chatId, helpText());
    return;
  }

  if(data === "stars"){
    const bot = await getBotMeta(botToken);
    await answerCallback(botToken, q.id, "Opening stars help");
    if(chatId) await sendMessage(botToken, chatId, starsHelpText(bot?.username || ""));
    return;
  }

  if(data === "play"){
    const appUrl = miniAppUrl();
    await answerCallback(botToken, q.id, "Opening play");
    if(chatId && appUrl){
      await sendMessage(botToken, chatId, "Launch Tiger Strike:", {
        reply_markup: { inline_keyboard: [[{ text: "Play Tiger Strike", url: appUrl }]] },
      });
    }
    return;
  }

  await answerCallback(botToken, q.id, "Action received");
}

async function handleInlineQuery(botToken, update){
  const q = update?.inline_query;
  if(!q) return;

  const appUrl = miniAppUrl();
  const bot = await getBotMeta(botToken);
  const deepLink = botLink(bot?.username || "", "play");

  const results = [
    {
      type: "article",
      id: "play_tiger_strike",
      title: "Tiger Strike",
      description: "Launch Tiger Strike mini app",
      input_message_content: {
        message_text: appUrl
          ? `Play Tiger Strike now: ${appUrl}`
          : `Open Tiger Strike bot: ${deepLink}`,
      },
      reply_markup: {
        inline_keyboard: [[{
          text: "Play Tiger Strike",
          url: appUrl || deepLink,
        }]],
      },
    },
  ];

  await telegramBotApi("answerInlineQuery", {
    inline_query_id: q.id,
    cache_time: 3,
    is_personal: true,
    results,
  }, botToken);
}

async function handlePreCheckout(botToken, update){
  const pre = update?.pre_checkout_query;
  if(!pre) return;

  await telegramBotApi("answerPreCheckoutQuery", {
    pre_checkout_query_id: pre.id,
    ok: true,
  }, botToken);
}

async function handleSuccessfulPayment(botToken, source){
  if(!source?.successful_payment || !source?.chat?.id) return;

  const amount = Number(source.successful_payment.total_amount || 0);
  const currency = String(source.successful_payment.currency || "");
  const line = currency === "XTR"
    ? `Payment confirmed: ${amount} Stars.`
    : "Payment confirmed.";

  await sendMessage(botToken, source.chat.id, `${line}\nYour purchase is being processed.`);
}

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 405, { ok: false, error: "Method not allowed." });
  }

  const botToken = envText("TELEGRAM_BOT_TOKEN");
  if(!botToken){
    return json(res, 500, { ok: false, error: "Server misconfigured: TELEGRAM_BOT_TOKEN is missing." });
  }

  const expectedSecret = webhookSecret();
  if(expectedSecret){
    const gotSecret = String(req.headers?.["x-telegram-bot-api-secret-token"] || "").trim();
    if(gotSecret !== expectedSecret){
      return json(res, 401, { ok: false, error: "Unauthorized webhook request." });
    }
  }

  const update = readJsonBody(req);
  if(!update || typeof update !== "object"){
    return json(res, 200, { ok: true, ignored: true });
  }

  try{
    await handlePreCheckout(botToken, update);

    const source = sourceMessageFromUpdate(update);
    if(source){
      await handleSuccessfulPayment(botToken, source);
      await handleCommand(botToken, update, source);
    }

    if(update?.callback_query){
      await handleCallbackQuery(botToken, update);
    }

    if(update?.inline_query){
      await handleInlineQuery(botToken, update);
    }

    return json(res, 200, { ok: true });
  }catch(e){
    return json(res, 500, { ok: false, error: e?.message || "Webhook handling failed." });
  }
};
