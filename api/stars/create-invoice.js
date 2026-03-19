const crypto = require("node:crypto");
const { getOffer } = require("../_lib/stars-catalog");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");
const { incrMetric } = require("../_lib/metrics-store");

function makeOrderRef(sku, userId){
  const nonce = crypto.randomBytes(6).toString("hex");
  const ts = Date.now().toString(36);
  return `ts2:${sku}:${Number(userId)}:${ts}:${nonce}`;
}

function headerFirst(value){
  const raw = String(value || "").trim();
  if(!raw) return "";
  const first = raw.split(",")[0];
  return String(first || "").trim();
}

function detectWebhookUrl(req){
  const envUrl = String(process.env.TELEGRAM_WEBHOOK_URL || "").trim();
  if(envUrl) return envUrl;

  const proto = headerFirst(req.headers?.["x-forwarded-proto"]) || "https";
  const host = headerFirst(req.headers?.["x-forwarded-host"]) || headerFirst(req.headers?.host);
  if(!host) return "";
  return `${proto}://${host}/api/telegram/webhook`;
}

async function ensureTelegramWebhook(req, botToken){
  const url = detectWebhookUrl(req);
  if(!url) throw new Error("Could not detect webhook URL.");

  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const payload = {
    url,
    allowed_updates: [
      "message",
      "channel_post",
      "inline_query",
      "callback_query",
      "pre_checkout_query",
      "business_connection",
      "business_message",
      "edited_business_message",
      "deleted_business_messages",
    ],
    drop_pending_updates: false,
  };
  if(secret){
    payload.secret_token = secret;
  }
  await telegramBotApi("setWebhook", payload, botToken);
}

async function metric(name){
  try{ await incrMetric(name, 1); }catch(e){ /* best effort */ }
}

async function metricSku(name, sku){
  try{
    const safeSku = String(sku || "").trim().toLowerCase().replace(/[^a-z0-9:_-]/g, "_");
    if(!safeSku) return;
    await incrMetric(`${name}:${safeSku}`, 1);
  }catch(e){ /* best effort */ }
}

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  try{
    const body = readJsonBody(req);
    const sku = String(body?.sku || "").trim();
    const initData = String(body?.initData || "");
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

    const offer = getOffer(sku);
    if(!offer){
      await metric("create_invoice_bad_sku");
      return json(res, 400, { ok:false, error:"Unknown Stars offer." });
    }

    await ensureTelegramWebhook(req, botToken);

    const { user } = validateTelegramInitData(initData, botToken);
    const orderRef = makeOrderRef(sku, user.id);

    const extra = Number(offer.funds || 0) > 0
      ? ` (+$${Number(offer.funds).toLocaleString()} in-game cash)`
      : "";

    const invoiceLink = await telegramBotApi("createInvoiceLink", {
      title: `Tiger Strike: ${offer.name}`,
      description: `${offer.desc}${extra}`,
      payload: orderRef,
      provider_token: "",
      currency: "XTR",
      prices: [
        { label: `${offer.name} (${offer.stars} Stars)`, amount: offer.stars },
      ],
    }, botToken);

    await metric("create_invoice_ok");
    await metricSku("create_invoice_ok_sku", offer.sku);

    return json(res, 200, {
      ok: true,
      sku: offer.sku,
      stars: offer.stars,
      orderRef,
      invoiceLink,
    });
  }catch(e){
    await metric("create_invoice_error");
    return json(res, 500, { ok:false, error:e?.message || "Could not create invoice." });
  }
};
