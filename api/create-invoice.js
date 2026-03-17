const crypto = require("node:crypto");
const { getOffer } = require("../_lib/stars-catalog");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

function makeOrderRef(sku, userId){
  const nonce = crypto.randomBytes(6).toString("hex");
  const ts = Date.now().toString(36);
  return `ts2:${sku}:${Number(userId)}:${ts}:${nonce}`;
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
      return json(res, 400, { ok:false, error:"Unknown Stars offer." });
    }

    const { user } = validateTelegramInitData(initData, botToken);
    const orderRef = makeOrderRef(sku, user.id);

    const invoiceLink = await telegramBotApi("createInvoiceLink", {
      title: `Tiger Strike: ${offer.name}`,
      description: `${offer.desc} (+$${offer.funds.toLocaleString()} in-game cash)`,
      payload: orderRef,
      provider_token: "",
      currency: "XTR",
      prices: [
        { label: `${offer.name} (${offer.stars} Stars)`, amount: offer.stars },
      ],
    }, botToken);

    return json(res, 200, {
      ok: true,
      sku: offer.sku,
      stars: offer.stars,
      orderRef,
      invoiceLink,
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Could not create invoice." });
  }
};
