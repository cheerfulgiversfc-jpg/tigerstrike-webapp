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
    tx?.receiver?.invoice_payload,
    tx?.receiver?.paid_media_payload,
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

function acceptedStarsSet(offer){
  const out = new Set();
  const primary = Math.abs(Number(offer?.stars || 0));
  if(primary > 0) out.add(primary);
  const legacy = Array.isArray(offer?.acceptedStars) ? offer.acceptedStars : [];
  for(const value of legacy){
    const n = Math.abs(Number(value || 0));
    if(n > 0) out.add(n);
  }
  return out;
}

async function findMatchingTransaction(orderMeta, offer, userId, excludedTxIds, botToken){
  const pageSize = 100;
  const maxPages = 6;
  const fallbackUserCandidates = [];
  const fallbackUnknownCandidates = [];
  const minTxMs = orderMeta.createdAtMs > 0 ? (orderMeta.createdAtMs - (2 * 60 * 1000)) : 0;
  const maxTxMs = orderMeta.createdAtMs > 0 ? (orderMeta.createdAtMs + (20 * 60 * 1000)) : 0;
  const acceptedStars = acceptedStarsSet(offer);

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
      if(!acceptedStars.has(starsAmount)) continue;

      const payload = extractInvoicePayload(tx);
      if(payload && payload === orderMeta.raw){
        return tx;
      }

      // If payload exists and is different, this transaction belongs to a different invoice.
      if(payload) continue;

      const sourceUserId = extractSourceUserId(tx);
      if(sourceUserId > 0 && sourceUserId !== userId) continue;

      if(orderMeta.createdAtMs <= 0) continue;
      const txDateSec = Number(tx?.date || 0);
      const txMs = Number.isFinite(txDateSec) && txDateSec > 0 ? txDateSec * 1000 : 0;
      if(txMs <= 0) continue;
      if(txMs < minTxMs || txMs > maxTxMs) continue;
      const candidate = {
        tx,
        distanceMs: Math.abs(txMs - orderMeta.createdAtMs),
      };
      if(sourceUserId === userId){
        fallbackUserCandidates.push(candidate);
      } else {
        fallbackUnknownCandidates.push(candidate);
      }
    }
    if(txs.length < pageSize) break;
  }
  // Prefer user-matched fallback transactions, nearest to order creation.
  if(fallbackUserCandidates.length > 0){
    fallbackUserCandidates.sort((a, b)=>a.distanceMs - b.distanceMs);
    return fallbackUserCandidates[0].tx;
  }

  // If user id is missing in transaction payload, use a conservative nearest fallback.
  if(fallbackUnknownCandidates.length === 1){
    return fallbackUnknownCandidates[0].tx;
  }
  if(fallbackUnknownCandidates.length > 1){
    fallbackUnknownCandidates.sort((a, b)=>a.distanceMs - b.distanceMs);
    const best = fallbackUnknownCandidates[0];
    const second = fallbackUnknownCandidates[1];
    if(best.distanceMs <= (90 * 1000) && (second.distanceMs - best.distanceMs) >= (45 * 1000)){
      return best.tx;
    }
  }
  return null;
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

    let tx = null;
    try{
      tx = await findMatchingTransaction(orderMeta, offer, user.id, excludedTxIds, botToken);
    }catch(e){
      const msg = String(e?.message || "");
      if(/fetch failed|network|timed? out|ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT/i.test(msg)){
        // Treat transient upstream failures as pending so clients can retry cleanly.
        return json(res, 200, { ok:true, status:"pending", transient:true });
      }
      throw e;
    }
    if(!tx){
      return json(res, 200, { ok:true, status:"pending" });
    }

    const starsAmount = Math.abs(Number(tx?.amount || 0));
    if(!acceptedStarsSet(offer).has(starsAmount)){
      return json(res, 400, { ok:false, error:"Transaction amount does not match this order." });
    }

    return json(res, 200, {
      ok: true,
      status: "paid",
      sku: offer.sku,
      kind: String(offer.kind || (Number(offer.funds || 0) > 0 ? "cash" : "bundle")),
      stars: offer.stars,
      funds: Number(offer.funds || 0),
      grant: (offer.grant && typeof offer.grant === "object") ? offer.grant : null,
      transactionId: String(tx.id || ""),
      paidAt: Number(tx.date || 0),
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Could not verify Stars purchase." });
  }
};
