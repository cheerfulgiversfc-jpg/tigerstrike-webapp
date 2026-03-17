const { STARS_OFFERS } = require("../_lib/stars-catalog");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

function parseOrderRefLite(orderRef){
  const ref = String(orderRef || "").trim();
  if(!ref) return null;
  if(ref.length > 220) return null;
  return ref;
}

async function findMatchingTransaction(orderRef, userId, botToken){
  const pageSize = 100;
  const maxPages = 8;
  for(let page=0; page<maxPages; page++){
    const offset = page * pageSize;
    const pageData = await telegramBotApi("getStarTransactions", {
      offset,
      limit: pageSize,
    }, botToken);

    const txs = Array.isArray(pageData?.transactions) ? pageData.transactions : [];
    for(const tx of txs){
      const source = tx?.source || {};
      const sourceUserId = Number(source?.user?.id || 0);
      const payload = String(source?.invoice_payload || "");
      if(sourceUserId !== userId) continue;
      if(payload !== orderRef) continue;
      return tx;
    }
    if(txs.length < pageSize) break;
  }
  return null;
}

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  try{
    const body = readJsonBody(req);
    const orderRef = parseOrderRefLite(body?.orderRef);
    const initData = String(body?.initData || "");
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

    if(!orderRef){
      return json(res, 400, { ok:false, error:"Invalid order reference." });
    }

    const { user } = validateTelegramInitData(initData, botToken);
    const tx = await findMatchingTransaction(orderRef, user.id, botToken);
    if(!tx){
      return json(res, 200, { ok:true, status:"pending" });
    }

    const starsAmount = Math.abs(Number(tx?.amount || 0));
    const offer = Object.values(STARS_OFFERS).find((candidate)=>Number(candidate.stars) === starsAmount) || null;
    if(!offer){
      return json(res, 400, { ok:false, error:"No matching Stars offer for this transaction amount." });
    }

    return json(res, 200, {
      ok: true,
      status: "paid",
      sku: offer.sku,
      stars: offer.stars,
      funds: offer.funds,
      transactionId: String(tx.id || ""),
      paidAt: Number(tx.date || 0),
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Could not verify Stars purchase." });
  }
};
