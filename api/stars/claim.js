const { getOffer } = require("../_lib/stars-catalog");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

function parseOrderRef(orderRef){
  const ref = String(orderRef || "").trim();
  const parts = ref.split(":");
  if(parts.length !== 4) return null;
  const [prefix, sku, userIdRaw, nonce] = parts;
  const userId = Number(userIdRaw || 0);
  if(prefix !== "ts1" || !sku || !nonce || !Number.isFinite(userId) || userId <= 0){
    return null;
  }
  return { ref, sku, userId };
}

async function findMatchingTransaction(orderRef, userId, expectedStars, botToken){
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
      const amount = Math.abs(Number(tx?.amount || 0));
      if(sourceUserId !== userId) continue;
      if(payload !== orderRef) continue;
      if(amount !== expectedStars) continue;
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
    const orderRef = String(body?.orderRef || "").trim();
    const initData = String(body?.initData || "");
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

    const parsed = parseOrderRef(orderRef);
    if(!parsed){
      return json(res, 400, { ok:false, error:"Invalid order reference." });
    }

    const offer = getOffer(parsed.sku);
    if(!offer){
      return json(res, 400, { ok:false, error:"Unknown order SKU." });
    }

    const { user } = validateTelegramInitData(initData, botToken);
    if(user.id !== parsed.userId){
      return json(res, 403, { ok:false, error:"Order does not belong to this user." });
    }

    const tx = await findMatchingTransaction(orderRef, user.id, offer.stars, botToken);
    if(!tx){
      return json(res, 200, { ok:true, status:"pending" });
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
