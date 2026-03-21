const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");
const { incrMetric, summarizeMetrics, storageMode } = require("../_lib/metrics-store");
const liveops = require("../_lib/liveops");

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

function mainMenuText(){
  return [
    "Tiger Strike Main Menu",
    "Choose an option below:",
  ].join("\n");
}

function leaderboardMenuText(){
  return [
    "Leaderboard Menu",
    "Pick a leaderboard view:",
  ].join("\n");
}

function helpMenuText(){
  return [
    "Help Menu",
    "Choose a topic:",
  ].join("\n");
}

function howToPlayText(){
  return [
    "How to Play",
    "- Escort civilians into the green EVAC SAFE ZONE.",
    "- Tap a tiger to lock it, then fight when in range.",
    "- Capture is available when tiger HP is at 25% or lower.",
    "- Keep armor/health topped up and manage ammo.",
  ].join("\n");
}

function controlsText(){
  return [
    "Controls",
    "- Left stick: move",
    "- Right buttons: attack/capture/medkit/armor/roll and abilities",
    "- Mode/Map/Shop/Inventory buttons are in menu row",
    "- Gamepad support is available when connected",
  ].join("\n");
}

function faqText(){
  return [
    "FAQ",
    "Q: How do I continue where I left off?",
    "A: Use Continue Last Mission or Load Save on launch.",
    "",
    "Q: How do I capture a tiger?",
    "A: Lower tiger HP to 25% or below, then use Capture.",
    "",
    "Q: Why can’t I post admin actions?",
    "A: Your Telegram user id must be in TELEGRAM_ADMIN_IDS.",
  ].join("\n");
}

function rewardsText(){
  return [
    "Rewards",
    "- Daily reward appears on launch",
    "- Mission clears grant cash and progression",
    "- Chapter rewards unlock through Story progress",
  ].join("\n");
}

function supportText(){
  return [
    "Support",
    "Use /reportbug with details and a screenshot/video if possible.",
    "You can also use /feedback for gameplay suggestions.",
  ].join("\n");
}

function eventsText(){
  return [
    "Events",
    "Live events and campaign drops are announced in-channel.",
    "Use /news and /update for latest notices.",
  ].join("\n");
}

function myStatsText(user){
  const uid = String(user?.id || "-");
  const uname = user?.username ? `@${user.username}` : "-";
  return [
    "My Stats",
    `User: ${safeName(user)}`,
    `Username: ${uname}`,
    `User ID: ${uid}`,
    "",
    "Open the Mini App for full mission stats, inventory, and progression.",
  ].join("\n");
}

function leaderboardSectionText(kind){
  const label = {
    global: "Global Top 10",
    weekly: "Weekly Leaderboard",
    monthly: "Monthly Leaderboard",
    myposition: "My Position",
    clan: "Clan Rankings",
  }[String(kind || "").toLowerCase()] || "Leaderboard";
  return [
    label,
    "Leaderboard backend is being expanded. Use this menu as your command hub.",
    "Open the Mini App for current in-game rank/progression right now.",
  ].join("\n");
}

function mainMenuKeyboard(botUsername){
  const appUrl = miniAppUrl();
  const playBtn = appUrl
    ? { text: "Play Game", url: appUrl }
    : { text: "Play Game", callback_data: "menu_play" };
  return {
    inline_keyboard: [
      [playBtn],
      [
        { text: "My Stats", callback_data: "menu_mystats" },
        { text: "Leaderboard", callback_data: "menu_leaderboard" },
      ],
      [
        { text: "Events", callback_data: "menu_events" },
        { text: "Help", callback_data: "menu_help" },
      ],
      [{ text: "Support", callback_data: "menu_support" }],
    ],
  };
}

function leaderboardMenuKeyboard(){
  return {
    inline_keyboard: [
      [{ text: "Global Top 10", callback_data: "menu_lb_global" }],
      [
        { text: "Weekly", callback_data: "menu_lb_weekly" },
        { text: "Monthly", callback_data: "menu_lb_monthly" },
      ],
      [
        { text: "My Position", callback_data: "menu_lb_myposition" },
        { text: "Clan Rankings", callback_data: "menu_lb_clan" },
      ],
      [{ text: "Back", callback_data: "menu_open" }],
    ],
  };
}

function helpMenuKeyboard(){
  return {
    inline_keyboard: [
      [{ text: "How to Play", callback_data: "menu_help_howtoplay" }],
      [{ text: "Controls", callback_data: "menu_help_controls" }],
      [{ text: "FAQ", callback_data: "menu_help_faq" }],
      [{ text: "Rewards", callback_data: "menu_help_rewards" }],
      [{ text: "Report a Bug", callback_data: "menu_help_reportbug" }],
      [{ text: "Back", callback_data: "menu_open" }],
    ],
  };
}

function supportMenuKeyboard(){
  return {
    inline_keyboard: [
      [{ text: "Report a Bug", callback_data: "menu_help_reportbug" }],
      [{ text: "Back", callback_data: "menu_open" }],
    ],
  };
}

function leafMenuKeyboard(back = "menu_open"){
  return {
    inline_keyboard: [
      [{ text: "Back", callback_data: back }],
      [{ text: "Main Menu", callback_data: "menu_open" }],
    ],
  };
}

async function editMenuMessage(botToken, callbackQuery, text, replyMarkup){
  const chatId = callbackQuery?.message?.chat?.id;
  const messageId = callbackQuery?.message?.message_id;
  if(!chatId || !messageId){
    if(chatId){
      await sendMessage(botToken, chatId, text, { reply_markup: replyMarkup });
    }
    return;
  }
  try{
    await telegramBotApi("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    }, botToken);
  }catch(e){
    await sendMessage(botToken, chatId, text, { reply_markup: replyMarkup });
  }
}

function buildStartKeyboard(botUsername){
  return mainMenuKeyboard(botUsername);
}

function helpText(){
  return [
    "Tiger Strike Bot Commands:",
    "/menu - Open smart button menu",
    "/start - Start bot and quick actions",
    "/play - Open Tiger Strike mini app",
    "/mystats - Open your player stats panel",
    "/leaderboard - Open leaderboard menu",
    "/events - Current game events/news",
    "/stars - Stars purchase/spend help",
    "/about - What Tiger Strike is",
    "/howtoplay - Quick gameplay guide",
    "/controls - Control guide",
    "/faq - Common questions",
    "/rewards - Reward guide",
    "/reportbug - Report a bug",
    "/support - Support options",
    "/ref - Get your referral link",
    "/status - Check bot setup status",
    "/settings - Quick settings help",
    "",
    "Admin-only:",
    "/admin",
    "/stats_today",
    "/stats_7d",
    "/liveops_now",
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
  const hasLiveopsKey = !!envText("TELEGRAM_LIVEOPS_KEY");
  const hasAdmins = parseAdminIds().size > 0;
  const hasChannel = !!normalizeChatId(envText("TELEGRAM_CHANNEL_ID"));
  const source = ctx?.chat?.type || "unknown";

  return [
    "Tiger Strike Bot Status:",
    `token: ${hasToken ? "ok" : "missing"}`,
    `webhook secret: ${hasSecret ? "ok" : "not set"}`,
    `mini app url: ${hasMini ? "ok" : "missing"}`,
    `setup key: ${hasSetupKey ? "ok" : "not set"}`,
    `liveops key: ${hasLiveopsKey ? "ok" : "not set"}`,
    `admin ids: ${hasAdmins ? "ok" : "missing"}`,
    `channel id: ${hasChannel ? "ok" : "missing"}`,
    `stats storage: ${storageMode()}`,
    `chat type: ${source}`,
  ].join("\n");
}

function adminHelpText(){
  return [
    "Admin commands:",
    "/stats_today - Conversion funnel snapshot (today)",
    "/stats_7d - Conversion funnel snapshot (7 days)",
    "/liveops_now - Post today's rotating campaign template",
    "/post_play - Post Play CTA to channel",
    "/post_stars - Post Stars top-up CTA",
    "/post_premium - Post Premium bundle CTA",
    "/post_campaign - Post campaign update CTA",
    "",
    "Set TELEGRAM_CHANNEL_ID to post from private chat.",
  ].join("\n");
}

function templateForPost(kind, botUsername){
  return liveops.buildPostTemplate(kind, botUsername);
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
  return liveops.targetChannelFrom(source);
}

const FUNNEL_METRICS = Object.freeze([
  "create_invoice_ok",
  "create_invoice_error",
  "claim_paid",
  "claim_pending",
  "claim_error",
  "pre_checkout_ok",
  "payment_success",
  "liveops_posted",
]);

async function metric(name){
  try{ await incrMetric(name, 1); }catch(e){ /* best effort */ }
}

async function metricKind(prefix, kind){
  const safeKind = String(kind || "").trim().toLowerCase().replace(/[^a-z0-9:_-]/g, "_");
  if(!safeKind) return;
  await metric(`${prefix}:${safeKind}`);
}

function pct(num, den){
  const n = Number(num || 0);
  const d = Number(den || 0);
  if(!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) return "0.0";
  return ((n / d) * 100).toFixed(1);
}

function parseSkuFromOrderRef(orderRef){
  const raw = String(orderRef || "").trim();
  if(!raw) return "";
  const parts = raw.split(":");
  if(parts.length < 2) return "";
  if(parts[0] !== "ts1" && parts[0] !== "ts2") return "";
  return String(parts[1] || "").trim().toLowerCase();
}

async function buildStatsText(days){
  const count = Math.max(1, Math.min(30, Number(days || 1)));
  const summary = await summarizeMetrics(FUNNEL_METRICS, count);
  const totals = summary?.totals || {};
  const created = Number(totals.create_invoice_ok || 0);
  const paid = Number(totals.claim_paid || 0);
  const pending = Number(totals.claim_pending || 0);
  const failed = Number(totals.claim_error || 0);

  const header = count === 1 ? "Tiger Strike Stats (today, UTC)" : `Tiger Strike Stats (last ${count} days, UTC)`;
  const lines = [
    header,
    `storage: ${summary?.storage || storageMode()}`,
    `invoice_created: ${created}`,
    `invoice_errors: ${Number(totals.create_invoice_error || 0)}`,
    `claims_paid: ${paid}`,
    `claims_pending: ${pending}`,
    `claims_failed: ${failed}`,
    `pre_checkout_ok: ${Number(totals.pre_checkout_ok || 0)}`,
    `successful_payment_updates: ${Number(totals.payment_success || 0)}`,
    `liveops_posts: ${Number(totals.liveops_posted || 0)}`,
    `paid_rate: ${pct(paid, created)}%`,
    `pending_rate: ${pct(pending, created)}%`,
    `error_rate: ${pct(failed, created)}%`,
  ];

  return lines.join("\n");
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
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent("Join me in Tiger Strike")}`;

  await sendMessage(botToken, ctx.chat.id, [
    "Your referral link:",
    link,
    "",
    "Share this link. When users start the bot with it, we log the referral.",
  ].join("\n"), {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Share Link", url: shareUrl }],
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
  await metric("manual_post_sent");
  await metricKind("manual_post_kind", kind);

  if(String(target) !== String(ctx.chat.id)){
    await sendMessage(botToken, ctx.chat.id, `Posted ${kind} template to ${String(target)}.`);
  }
}

async function handleStatsCommand(botToken, ctx, days){
  if(!isAdminUser(ctx.from)){
    await sendMessage(botToken, ctx.chat.id, "Unauthorized. Add your Telegram user id to TELEGRAM_ADMIN_IDS.");
    return;
  }
  const text = await buildStatsText(days);
  await sendMessage(botToken, ctx.chat.id, text);
}

async function handleLiveopsNow(botToken, ctx, botUsername){
  if(!isAdminUser(ctx.from)){
    await sendMessage(botToken, ctx.chat.id, "Unauthorized. Add your Telegram user id to TELEGRAM_ADMIN_IDS.");
    return;
  }

  const target = targetChannelFrom(ctx);
  if(!target){
    await sendMessage(botToken, ctx.chat.id, "Missing TELEGRAM_CHANNEL_ID. Set it, redeploy, then retry.");
    return;
  }

  const kind = liveops.pickLiveopsKind(Date.now());
  const tpl = templateForPost(kind, botUsername);
  await sendMessage(botToken, target, `LiveOps: ${kind.toUpperCase()}\n\n${tpl.text}`, {
    reply_markup: tpl.reply_markup,
  });
  await metric("liveops_posted");
  await metricKind("liveops_post_kind", kind);

  if(String(target) !== String(ctx.chat.id)){
    await sendMessage(botToken, ctx.chat.id, `LiveOps posted: ${kind} -> ${String(target)}.`);
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
    case "menu": {
      await sendMessage(botToken, ctx.chat.id, mainMenuText(), {
        reply_markup: mainMenuKeyboard(bot?.username || ""),
      });
      return true;
    }
    case "start": {
      await handleStartCommand(botToken, ctx, parsed.args, bot?.username || "");
      return true;
    }
    case "help": {
      await sendMessage(botToken, ctx.chat.id, helpText(), {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Open Menu", callback_data: "menu_open" }],
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
    case "mystats": {
      await sendMessage(botToken, ctx.chat.id, myStatsText(ctx.from), {
        reply_markup: leafMenuKeyboard("menu_open"),
      });
      return true;
    }
    case "leaderboard": {
      await sendMessage(botToken, ctx.chat.id, leaderboardMenuText(), {
        reply_markup: leaderboardMenuKeyboard(),
      });
      return true;
    }
    case "events":
    case "news":
    case "update":
    case "season": {
      await sendMessage(botToken, ctx.chat.id, eventsText(), {
        reply_markup: leafMenuKeyboard("menu_open"),
      });
      return true;
    }
    case "about": {
      await sendMessage(botToken, ctx.chat.id, "Tiger Strike is a civilian-rescue action strategy game set across 100 story missions.", {
        reply_markup: leafMenuKeyboard("menu_help"),
      });
      return true;
    }
    case "howtoplay": {
      await sendMessage(botToken, ctx.chat.id, howToPlayText(), {
        reply_markup: leafMenuKeyboard("menu_help"),
      });
      return true;
    }
    case "controls": {
      await sendMessage(botToken, ctx.chat.id, controlsText(), {
        reply_markup: leafMenuKeyboard("menu_help"),
      });
      return true;
    }
    case "faq": {
      await sendMessage(botToken, ctx.chat.id, faqText(), {
        reply_markup: leafMenuKeyboard("menu_help"),
      });
      return true;
    }
    case "rewards":
    case "daily": {
      await sendMessage(botToken, ctx.chat.id, rewardsText(), {
        reply_markup: leafMenuKeyboard("menu_help"),
      });
      return true;
    }
    case "reportbug":
    case "feedback":
    case "support":
    case "contact": {
      await sendMessage(botToken, ctx.chat.id, supportText(), {
        reply_markup: supportMenuKeyboard(),
      });
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
    case "stats":
    case "stats_today": {
      await handleStatsCommand(botToken, ctx, 1);
      return true;
    }
    case "stats_7d": {
      await handleStatsCommand(botToken, ctx, 7);
      return true;
    }
    case "liveops_now": {
      await handleLiveopsNow(botToken, ctx, bot?.username || "");
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
  let bot = null;

  if(data === "help"){
    await answerCallback(botToken, q.id, "Opening help");
    await editMenuMessage(botToken, q, helpMenuText(), helpMenuKeyboard());
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

  if(data === "menu_open"){
    if(!bot) bot = await getBotMeta(botToken);
    await answerCallback(botToken, q.id, "Main menu");
    await editMenuMessage(botToken, q, mainMenuText(), mainMenuKeyboard(bot?.username || ""));
    return;
  }

  if(data === "menu_play"){
    const appUrl = miniAppUrl();
    await answerCallback(botToken, q.id, appUrl ? "Play Tiger Strike" : "Mini App URL missing");
    if(appUrl){
      await editMenuMessage(botToken, q, "Launch Tiger Strike:", {
        inline_keyboard: [
          [{ text: "Play Tiger Strike", url: appUrl }],
          [{ text: "Back", callback_data: "menu_open" }],
        ],
      });
    }else{
      await editMenuMessage(botToken, q, "Mini app URL is not configured yet. Set TELEGRAM_MINI_APP_URL.", leafMenuKeyboard("menu_open"));
    }
    return;
  }

  if(data === "menu_mystats"){
    await answerCallback(botToken, q.id, "My stats");
    await editMenuMessage(botToken, q, myStatsText(q.from), leafMenuKeyboard("menu_open"));
    return;
  }

  if(data === "menu_events"){
    await answerCallback(botToken, q.id, "Events");
    await editMenuMessage(botToken, q, eventsText(), leafMenuKeyboard("menu_open"));
    return;
  }

  if(data === "menu_support"){
    await answerCallback(botToken, q.id, "Support");
    await editMenuMessage(botToken, q, supportText(), supportMenuKeyboard());
    return;
  }

  if(data === "menu_leaderboard"){
    await answerCallback(botToken, q.id, "Leaderboard");
    await editMenuMessage(botToken, q, leaderboardMenuText(), leaderboardMenuKeyboard());
    return;
  }

  if(data === "menu_lb_global"){
    await answerCallback(botToken, q.id, "Global Top 10");
    await editMenuMessage(botToken, q, leaderboardSectionText("global"), leafMenuKeyboard("menu_leaderboard"));
    return;
  }

  if(data === "menu_lb_weekly"){
    await answerCallback(botToken, q.id, "Weekly leaderboard");
    await editMenuMessage(botToken, q, leaderboardSectionText("weekly"), leafMenuKeyboard("menu_leaderboard"));
    return;
  }

  if(data === "menu_lb_monthly"){
    await answerCallback(botToken, q.id, "Monthly leaderboard");
    await editMenuMessage(botToken, q, leaderboardSectionText("monthly"), leafMenuKeyboard("menu_leaderboard"));
    return;
  }

  if(data === "menu_lb_myposition"){
    await answerCallback(botToken, q.id, "My position");
    await editMenuMessage(botToken, q, leaderboardSectionText("myposition"), leafMenuKeyboard("menu_leaderboard"));
    return;
  }

  if(data === "menu_lb_clan"){
    await answerCallback(botToken, q.id, "Clan rankings");
    await editMenuMessage(botToken, q, leaderboardSectionText("clan"), leafMenuKeyboard("menu_leaderboard"));
    return;
  }

  if(data === "menu_help"){
    await answerCallback(botToken, q.id, "Help menu");
    await editMenuMessage(botToken, q, helpMenuText(), helpMenuKeyboard());
    return;
  }

  if(data === "menu_help_howtoplay"){
    await answerCallback(botToken, q.id, "How to play");
    await editMenuMessage(botToken, q, howToPlayText(), leafMenuKeyboard("menu_help"));
    return;
  }

  if(data === "menu_help_controls"){
    await answerCallback(botToken, q.id, "Controls");
    await editMenuMessage(botToken, q, controlsText(), leafMenuKeyboard("menu_help"));
    return;
  }

  if(data === "menu_help_faq"){
    await answerCallback(botToken, q.id, "FAQ");
    await editMenuMessage(botToken, q, faqText(), leafMenuKeyboard("menu_help"));
    return;
  }

  if(data === "menu_help_rewards"){
    await answerCallback(botToken, q.id, "Rewards");
    await editMenuMessage(botToken, q, rewardsText(), leafMenuKeyboard("menu_help"));
    return;
  }

  if(data === "menu_help_reportbug"){
    await answerCallback(botToken, q.id, "Report bug");
    await editMenuMessage(botToken, q, supportText(), leafMenuKeyboard("menu_help"));
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
  await metric("pre_checkout_ok");
}

async function handleSuccessfulPayment(botToken, source){
  if(!source?.successful_payment || !source?.chat?.id) return;

  const amount = Number(source.successful_payment.total_amount || 0);
  const currency = String(source.successful_payment.currency || "");
  const line = currency === "XTR"
    ? `Payment confirmed: ${amount} Stars.`
    : "Payment confirmed.";

  await sendMessage(botToken, source.chat.id, `${line}\nYour purchase is being processed.`);
  await metric("payment_success");

  const sku = parseSkuFromOrderRef(source?.successful_payment?.invoice_payload);
  if(sku){
    await metricKind("payment_success_sku", sku);
  }
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
    await metric("webhook_error");
    return json(res, 500, { ok: false, error: e?.message || "Webhook handling failed." });
  }
};
