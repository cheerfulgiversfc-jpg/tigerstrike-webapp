const crypto = require("node:crypto");

function safeEqualHex(a, b){
  if(typeof a !== "string" || typeof b !== "string") return false;
  if(a.length !== b.length) return false;
  try{
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  }catch(e){
    return false;
  }
}

function parseInitData(initData){
  const data = String(initData || "").trim();
  if(!data) throw new Error("Missing initData.");
  return new URLSearchParams(data);
}

function validateTelegramInitData(initData, botToken, maxAgeSec = 60 * 60 * 24){
  if(!botToken) throw new Error("Server misconfigured: TELEGRAM_BOT_TOKEN is missing.");
  const params = parseInitData(initData);
  const hash = params.get("hash");
  if(!hash) throw new Error("Invalid initData: hash is missing.");

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b])=>a.localeCompare(b))
    .map(([k, v])=>`${k}=${v}`)
    .join("\n");

  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  if(!safeEqualHex(expectedHash, hash)){
    throw new Error("Invalid initData signature.");
  }

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if(!Number.isFinite(authDate) || authDate <= 0){
    throw new Error("Invalid initData auth_date.");
  }
  if(authDate > now + 60){
    throw new Error("Invalid initData timestamp.");
  }
  if((now - authDate) > maxAgeSec){
    throw new Error("initData expired. Please reopen the Mini App.");
  }

  let user = null;
  const userRaw = params.get("user");
  if(userRaw){
    try{ user = JSON.parse(userRaw); }catch(e){ user = null; }
  }
  if(!user || !Number.isFinite(Number(user.id))){
    throw new Error("initData does not contain a valid user.");
  }

  return {
    user: {
      id: Number(user.id),
      username: typeof user.username === "string" ? user.username : "",
      first_name: typeof user.first_name === "string" ? user.first_name : "",
      last_name: typeof user.last_name === "string" ? user.last_name : "",
    },
    authDate,
  };
}

module.exports = {
  validateTelegramInitData,
};
