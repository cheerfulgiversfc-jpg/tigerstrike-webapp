async function telegramBotApi(method, payload, botToken){
  if(!botToken) throw new Error("Server misconfigured: TELEGRAM_BOT_TOKEN is missing.");

  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });

  let data = null;
  try{ data = await res.json(); }catch(e){ data = null; }
  if(!res.ok || !data?.ok){
    throw new Error(data?.description || `Telegram API ${method} failed.`);
  }
  return data.result;
}

module.exports = {
  telegramBotApi,
};
