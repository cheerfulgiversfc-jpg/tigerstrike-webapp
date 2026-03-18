const { telegramBotApi } = require("../_lib/telegram-api");
const { json, readJsonBody } = require("../_lib/http");

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

    return json(res, 200, { ok:true, handled:"ignored" });
  }catch(e){
    return json(res, 200, { ok:false, error:e?.message || "Webhook handler failed." });
  }
};

