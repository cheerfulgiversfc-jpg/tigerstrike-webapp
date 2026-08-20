const { telegramBotApi } = require("./telegram-api");
const { getState, setState } = require("./metrics-store");

const COMMUNITY_STATE_KEY = "telegram_community_chat";
let cachedChat = null;
let cachedChatId = "";
let cachedChatAt = 0;

function envText(name){
  return String(process.env[name] || "").trim();
}

function normalizeChatId(value){
  const raw = String(value || "").trim();
  if(!raw) return null;
  if(raw.startsWith("@")) return raw;
  if(/^-?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function isCommunityChatType(type){
  const value = String(type || "").toLowerCase();
  return value === "group" || value === "supergroup";
}

function isCommunityMember(member){
  const status = String(member?.status || "").toLowerCase();
  if(status === "creator" || status === "administrator" || status === "member") return true;
  return status === "restricted" && member?.is_member === true;
}

function communityChatEnv(){
  return normalizeChatId(
    envText("TELEGRAM_COMMUNITY_CHAT_ID") ||
    envText("TELEGRAM_GROUP_ID")
  );
}

async function configuredCommunityChatId(){
  const explicit = communityChatEnv();
  if(explicit) return explicit;
  const stored = await getState(COMMUNITY_STATE_KEY);
  if(stored?.chatId) return normalizeChatId(stored.chatId);
  return normalizeChatId(envText("TELEGRAM_CHANNEL_ID"));
}

async function saveCommunityChat(chat){
  const type = String(chat?.type || "").toLowerCase();
  if(!isCommunityChatType(type)) throw new Error("Community chat must be a Telegram group or supergroup.");
  const chatId = normalizeChatId(chat?.id);
  if(!chatId) throw new Error("Community chat id is missing.");
  const snapshot = {
    chatId,
    type,
    title: String(chat?.title || "Tiger Strike Community").trim().slice(0, 120),
    username: String(chat?.username || "").trim().replace(/^@+/, "").slice(0, 80),
    updatedAt: Date.now(),
  };
  await setState(COMMUNITY_STATE_KEY, snapshot);
  cachedChat = null;
  cachedChatId = "";
  cachedChatAt = 0;
  return snapshot;
}

async function getCommunityChat(botToken, chatId){
  const key = String(chatId || "");
  if(cachedChat && cachedChatId === key && (Date.now() - cachedChatAt) < 60_000){
    return cachedChat;
  }
  const chat = await telegramBotApi("getChat", { chat_id:chatId }, botToken);
  cachedChat = chat;
  cachedChatId = key;
  cachedChatAt = Date.now();
  return chat;
}

function joinUrlForChat(chat){
  const configured = envText("TELEGRAM_COMMUNITY_INVITE_URL") || envText("TELEGRAM_GROUP_INVITE_URL");
  if(configured) return configured;
  const username = String(chat?.username || "").trim().replace(/^@+/, "");
  if(username) return `https://t.me/${username}`;
  return String(chat?.invite_link || "").trim();
}

async function getCommunitySnapshot({ botToken, userId = 0 } = {}){
  const chatId = await configuredCommunityChatId();
  if(!chatId){
    return {
      configured:false,
      title:"Tiger Strike Community",
      type:"",
      joinUrl:"",
      isMember:false,
      memberStatus:"unconfigured",
    };
  }

  try{
    const chat = await getCommunityChat(botToken, chatId);
    if(!isCommunityChatType(chat?.type)){
      return {
        configured:false,
        title:"Tiger Strike Community",
        type:String(chat?.type || ""),
        joinUrl:"",
        isMember:false,
        memberStatus:"wrong_chat_type",
      };
    }
    let member = null;
    const uid = Number(userId || 0);
    if(Number.isSafeInteger(uid) && uid > 0){
      try{
        member = await telegramBotApi("getChatMember", { chat_id:chat.id, user_id:uid }, botToken);
      }catch(e){
        member = null;
      }
    }
    let joinUrl = joinUrlForChat(chat);
    if(!joinUrl){
      try{
        const invite = await telegramBotApi("createChatInviteLink", {
          chat_id:chat.id,
          name:"Tiger Strike Recruit a Squad",
        }, botToken);
        joinUrl = String(invite?.invite_link || "").trim();
        if(joinUrl) chat.invite_link = joinUrl;
      }catch(e){ /* bot may not have invite permission */ }
    }
    return {
      configured:true,
      chatId:chat.id,
      title:String(chat.title || "Tiger Strike Community").trim().slice(0, 120),
      type:String(chat.type || ""),
      username:String(chat.username || "").trim().replace(/^@+/, ""),
      joinUrl,
      isMember:isCommunityMember(member),
      memberStatus:String(member?.status || (uid > 0 ? "not_member" : "unknown")),
    };
  }catch(e){
    return {
      configured:false,
      title:"Tiger Strike Community",
      type:"",
      joinUrl:"",
      isMember:false,
      memberStatus:"unavailable",
    };
  }
}

module.exports = {
  configuredCommunityChatId,
  getCommunitySnapshot,
  isCommunityChatType,
  isCommunityMember,
  saveCommunityChat,
};
