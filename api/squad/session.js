const { json, readJsonBody } = require("../_lib/http");
const { telegramBotApi } = require("../_lib/telegram-api");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const { getCommunitySnapshot } = require("../_lib/community");
const { storageMode } = require("../_lib/metrics-store");
const {
  ROLE_DEFS,
  cleanCode,
  createSession,
  joinSession,
  readSession,
  buildSnapshot,
  updateOwnPresence,
  applyAction,
  claimReward,
  closeSession,
  ensureLiveSession,
  userIdOf,
} = require("../_lib/squad-session");

function envText(name){ return String(process.env[name] || "").trim(); }
function botUsername(){
  return (envText("TELEGRAM_BOT_USERNAME") || envText("TELEGRAM_BOT_PUBLIC_USERNAME")).replace(/^@+/, "");
}
let discoveredBotUsername = "";
async function resolveBotUsername(botToken){
  const configured = botUsername();
  if(configured) return configured;
  if(discoveredBotUsername) return discoveredBotUsername;
  try{
    const bot = await telegramBotApi("getMe", {}, botToken);
    discoveredBotUsername = String(bot?.username || "").trim().replace(/^@+/, "");
  }catch(error){}
  return discoveredBotUsername;
}
function appLink(code, username=""){
  return username && code ? `https://t.me/${username}?startapp=${encodeURIComponent(`squad_${code}`)}` : "";
}

async function prepareInvite(botToken, user, session){
  const username = await resolveBotUsername(botToken);
  const playUrl = appLink(session.code, username);
  const community = await getCommunitySnapshot({ botToken, userId:userIdOf(user) });
  const sharedStory = session.launchType === "shared-story";
  const operation = {
    "tiger-den":{
        id:"tiger_den",
        name:"Tiger Den Assault",
        button:"🪨 Join Tiger Den Assault",
        heading:"🪨 TIGER DEN ASSAULT REQUEST",
        detail:"Rescue two trapped field specialists, clear the den guards, defeat Stoneclaw Alpha, revive each other, and extract together.",
      },
    "village-siege":{
        id:"village_siege",
        name:"Village Siege",
        button:"🏘️ Join Village Siege",
        heading:"🏘️ VILLAGE SIEGE TEAMMATE REQUEST",
        detail:"Rescue five trapped villagers, clear the siege pack, defeat Ironmane Alpha, revive each other, and extract together.",
      },
    "convoy-rescue":{
        id:"convoy_rescue",
        name:"Convoy Rescue",
        button:"🚚 Join Convoy Rescue",
        heading:"🚚 CONVOY RESCUE TEAMMATE REQUEST",
        detail:"Rescue four stranded convoy crew members, clear the road ambush, defeat Roadclaw Alpha, revive each other, and extract together.",
      },
  }[session.launchType] || {
        id:"night_fang",
        name:"Operation Night Fang",
        button:"🐅 Join Operation Night Fang",
        heading:"🐅 NIGHT FANG TEAMMATE REQUEST",
        detail:"Rescue four civilians, defeat the tiger pack and Night Fang Alpha, revive each other, and extract together.",
      };
  const buttons = [];
  const sharedLevel = Math.max(1, Number(session.storyMissionLevel || 1));
  if(playUrl) buttons.push([{ text:sharedStory ? `📖 Join Story Mission ${sharedLevel}` : operation.button, url:playUrl }]);
  if(community.joinUrl) buttons.push([{ text:`👥 Join ${community.title}`.slice(0, 64), url:community.joinUrl }]);
  const missionName = sharedStory ? `Shared Story Mission ${Math.max(1, Number(session.storyMissionLevel || 1))}` : operation.name;
  const shareText = [
    sharedStory ? `📖 STORY MISSION ${sharedLevel} TEAMMATE REQUEST` : operation.heading,
    `I need one teammate for ${missionName}.`,
    sharedStory
      ? `Play Story Mission ${sharedLevel} together on the shared map, finish its real objective, and extract.`
      : operation.detail,
    `Squad code: ${session.code}`,
  ].join("\n\n");
  const result = {
    type:"article",
    id:`${sharedStory ? `story_m${sharedLevel}` : operation.id}_${session.code}`.slice(0, 64),
    title:`Join ${missionName}`,
    description:`Private two-player Tiger Strike squad • Code ${session.code}`,
    input_message_content:{
      message_text:shareText,
    },
  };
  if(buttons.length) result.reply_markup = { inline_keyboard:buttons };
  let prepared = null;
  let preparedError = "";
  try{
    prepared = await telegramBotApi("savePreparedInlineMessage", {
      user_id:userIdOf(user),
      result,
      allow_user_chats:true,
      allow_group_chats:true,
      allow_channel_chats:false,
      allow_bot_chats:false,
    }, botToken);
  }catch(error){
    // Older Telegram clients/bots may not support prepared messages. The
    // ordinary Telegram share URL below is a fully functional fallback.
    preparedError = String(error?.message || "Prepared message unavailable.").slice(0, 180);
  }
  return {
    preparedMessageId:String(prepared?.id || ""),
    expirationDate:Number(prepared?.expiration_date || 0),
    preparedError,
    playUrl,
    shareText,
    botUsername:username,
    community,
  };
}

module.exports = async function handler(req, res){
  if(req.method === "GET"){
    const storage = storageMode();
    return json(res, 200, { ok:true, service:"live-squad", storage, durable:storage === "kv" });
  }
  if(req.method !== "POST") return json(res, 405, { ok:false, error:"Method not allowed." });
  try{
    const botToken = envText("TELEGRAM_BOT_TOKEN");
    if(!botToken) return json(res, 500, { ok:false, error:"Telegram bot is not configured." });
    const body = readJsonBody(req);
    const initData = String(body?.initData || "");
    if(!initData) return json(res, 400, { ok:false, error:"Open Live Squad Operations inside Telegram." });
    const { user } = validateTelegramInitData(initData, botToken);
    const action = String(body?.action || "status").trim().toLowerCase();
    let session = null;

    if(action === "create"){
      const requestedStoryLevel = Math.max(0, Math.min(100, Math.floor(Number(body?.storyMissionLevel || 0))));
      const requestedLaunchType = String(body?.launchType || "").trim().toLowerCase();
      session = await createSession(user, {
        storyMissionLevel:requestedStoryLevel,
        launchType:requestedLaunchType === "shared-story" && requestedStoryLevel >= 1 && requestedStoryLevel <= 5
          ? "shared-story"
          : (["tiger-den","village-siege","convoy-rescue"].includes(requestedLaunchType) ? requestedLaunchType : "live-squad"),
      });
    }else if(action === "join"){
      session = await joinSession(cleanCode(body?.code), user);
    }else{
      session = await readSession(cleanCode(body?.code));
      ensureLiveSession(session);
      if(!session.memberIds.includes(userIdOf(user))) throw new Error("Join this squad before using it.");
    }

    let invitation = null;
    let reward = null;
    if(action === "sync" || action === "status" || action === "role"){
      await updateOwnPresence(session, user, body?.player || (action === "role" ? { role:body?.role } : {}));
    }else if(["start","restart","pause","resume","attack","capture","rescue","revive"].includes(action)){
      session = await applyAction(session, user, action, body || {});
    }else if(action === "invite"){
      invitation = await prepareInvite(botToken, user, session);
    }else if(action === "claim"){
      reward = await claimReward(session, user);
    }else if(action === "leave"){
      await closeSession(session, user);
      return json(res, 200, { ok:true, left:true });
    }

    session = await readSession(session.code);
    ensureLiveSession(session);
    const snapshot = await buildSnapshot(session, userIdOf(user));
    return json(res, 200, {
      ok:true,
      storage:storageMode(),
      snapshot,
      invitation,
      reward,
      roles:Object.values(ROLE_DEFS).map(({ key, label, damage, maxHp, speed })=>({ key, label, damage, maxHp, speed })),
    });
  }catch(e){
    return json(res, 400, { ok:false, error:e?.message || "Live squad request failed." });
  }
};
