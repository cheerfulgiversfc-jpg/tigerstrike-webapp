const { json, readJsonBody } = require("../_lib/http");
const { telegramBotApi } = require("../_lib/telegram-api");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { getCommunitySnapshot } = require("../_lib/community");

function envText(name){
  return String(process.env[name] || "").trim();
}

function botUsername(){
  return (envText("TELEGRAM_BOT_USERNAME") || envText("TELEGRAM_BOT_PUBLIC_USERNAME"))
    .replace(/^@+/, "");
}

function referralAppLink(username, userId){
  if(!username || !userId) return "";
  return `https://t.me/${username}?startapp=${encodeURIComponent(`ref_${userId}`)}`;
}

module.exports = async function handler(req, res){
  if(req.method !== "POST") return json(res, 405, { ok:false, error:"Method not allowed." });

  try{
    const botToken = envText("TELEGRAM_BOT_TOKEN");
    if(!botToken) return json(res, 500, { ok:false, error:"Telegram bot is not configured." });
    const body = readJsonBody(req);
    const initData = String(body?.initData || "");
    if(!initData) return json(res, 400, { ok:false, error:"Missing Telegram authorization." });
    const { user } = validateTelegramInitData(initData, botToken);
    const userId = Number(user?.id || 0);
    const community = await getCommunitySnapshot({ botToken, userId });
    const username = botUsername();
    const playUrl = referralAppLink(username, userId);

    if(String(body?.action || "status") !== "prepare_invite"){
      return json(res, 200, { ok:true, community, playUrl });
    }
    if(!username || !playUrl){
      return json(res, 503, { ok:false, error:"Bot username is not configured.", community });
    }

    const title = community.configured ? community.title : "Tiger Strike Community";
    const buttons = [[{ text:"🐅 Play Tiger Strike", url:playUrl }]];
    if(community.joinUrl){
      buttons.push([{ text:`👥 Join ${title}`.slice(0, 64), url:community.joinUrl }]);
    }
    const result = {
      type:"article",
      id:`tiger_invite_${userId}`.slice(0, 64),
      title:"Join my Tiger Strike squad",
      description:"Play the first mission and join our Telegram community.",
      input_message_content:{
        message_text:[
          "🐅 I need backup in Tiger Strike!",
          "Rescue civilians, track dangerous tigers, and build your squad with me.",
          "Complete your first mission to count as a verified recruit.",
        ].join("\n\n"),
      },
      reply_markup:{ inline_keyboard:buttons },
    };
    const prepared = await telegramBotApi("savePreparedInlineMessage", {
      user_id:userId,
      result,
      allow_user_chats:true,
      allow_group_chats:true,
      allow_channel_chats:false,
      allow_bot_chats:false,
    }, botToken);
    return json(res, 200, {
      ok:true,
      preparedMessageId:String(prepared?.id || ""),
      expirationDate:Number(prepared?.expiration_date || 0),
      community,
      playUrl,
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Could not prepare the squad invitation." });
  }
};
