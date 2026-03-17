const { getOffer } = require("../_lib/stars-catalog");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

function parseOrderRef(orderRef){
  const ref = String(orderRef || "").trim();
  if(!ref) return null;
  if(ref.length > 220) return null;
  const parts = ref.split(":");
  if(parts.length < 4) return null;

  const version = parts[0];
  if(version !== "ts1" && version !== "ts2") return null;

  const sku = String(parts[1] || "").trim();
  const userId = Number(parts[2] || 0);
  if(!sku || !Number.isFinite(userId) || userId <= 0) return null;

  let createdAtMs = 0;
  if(version === "ts2" && parts.length >= 5){
    const tsPart = String(parts[3] || "").trim();
    const parsedTs = parseInt(tsPart, 36);
    if(Number.isFinite(parsedTs) && parsedTs > 0){
      createdAtMs = parsedTs;
    }
  }else if(version === "ts1"){
    const mixed = String(parts[3] || "").trim();
    if(mixed.length > 12){
      const nonce = mixed.slice(-12);
      const tsPart = mixed.slice(0, -12);
      if(/^[a-f0-9]{12}$/i.test(nonce)){
        const parsedTs = parseInt(tsPart, 36);
        if(Number.isFinite(parsedTs) && parsedTs > 0){
          createdAtMs = parsedTs;
        }
      }
    }
  }

  return {
    raw: ref,
    version,
    sku,
    userId,
    createdAtMs,
  };
}

function parseExcludedTxIds(input){
  if(!Array.isArray(input)) return new Set();
  const out = new Set();
  for(const raw of input){
    const txId = String(raw || "").trim();
    if(!txId || txId.length > 120) continue;
    out.add(txId);
    if(out.size >= 200) break;
  }
  return out;
}

function extractInvoicePayload(tx){
  const payload = [
    tx?.source?.invoice_payload,
    tx?.source?.paid_media_payload,
    tx?.invoice_payload,
    tx?.payload,
  ].find((value)=>typeof value === "string" && value.trim().length > 0);
  return payload ? String(payload).trim() : "";
}

function extractSourceUserId(tx){
  const candidates = [
    tx?.source?.user?.id,
    tx?.source?.sender_user?.id,
    tx?.source?.from?.id,
    tx?.source?.owner?.id,
  ];
  for(const value of candidates){
    const id = Number(value || 0);
    if(Number.isFinite(id) && id > 0){
      return id;
    }
  }
  return 0;
}

function isExcludedTx(tx, excludedTxIds){
  const txId = String(tx?.id || "").trim();
  if(!txId) return false;
  return excludedTxIds.has(txId);
}

async function findMatchingTransaction(orderMeta, offer, userId, excludedTxIds, botToken){
  const pageSize = 100;
  const maxPages = 8;
  let fallback = null;
  const minTxMs = orderMeta.createdAtMs > 0 ? (orderMeta.createdAtMs - (2 * 60 * 1000)) : 0;

  for(let page=0; page<maxPages; page++){
    const offset = page * pageSize;
    const pageData = await telegramBotApi("getStarTransactions", {
      offset,
      limit: pageSize,
    }, botToken);

    const txs = Array.isArray(pageData?.transactions) ? pageData.transactions : [];
    for(const tx of txs){
      if(isExcludedTx(tx, excludedTxIds)) continue;

      const starsAmount = Math.abs(Number(tx?.amount || 0));
      if(starsAmount !== Number(offer.stars)) continue;

      const sourceUserId = extractSourceUserId(tx);
      if(sourceUserId > 0 && sourceUserId !== userId) continue;

      const payload = extractInvoicePayload(tx);
      if(payload && payload === orderMeta.raw){
        return tx;
      }

      if(sourceUserId !== userId) continue;

      if(orderMeta.createdAtMs > 0){
        const txDateSec = Number(tx?.date || 0);
        const txMs = Number.isFinite(txDateSec) && txDateSec > 0 ? txDateSec * 1000 : 0;
        if(txMs > 0 && txMs >= minTxMs && !fallback){
          fallback = tx;
        }
      }
    }
    if(txs.length < pageSize) break;
  }
  return fallback;
}

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  try{
    const body = readJsonBody(req);
    const orderMeta = parseOrderRef(body?.orderRef);
    const initData = String(body?.initData || "");
    const excludedTxIds = parseExcludedTxIds(body?.excludeTxIds);
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";

    if(!orderMeta){
      return json(res, 400, { ok:false, error:"Invalid order reference." });
    }

    const { user } = validateTelegramInitData(initData, botToken);
    if(Number(orderMeta.userId) !== Number(user.id)){
      return json(res, 400, { ok:false, error:"Order does not belong to this user." });
    }

    const offer = getOffer(orderMeta.sku);
    if(!offer){
      return json(res, 400, { ok:false, error:"Unknown Stars offer in order reference." });
    }

    const tx = await findMatchingTransaction(orderMeta, offer, user.id, excludedTxIds, botToken);
    if(!tx){
      return json(res, 200, { ok:true, status:"pending" });
    }

    const starsAmount = Math.abs(Number(tx?.amount || 0));
    if(starsAmount !== Number(offer.stars)){
      return json(res, 400, { ok:false, error:"Transaction amount does not match this order." });
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
