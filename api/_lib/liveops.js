function envText(name, fallback = ""){
  return String(process.env[name] || fallback).trim();
}

function miniAppUrl(){
  return envText("TELEGRAM_MINI_APP_URL") || envText("MINI_APP_URL");
}

function normalizeChatId(value){
  const raw = String(value || "").trim();
  if(!raw) return null;
  if(raw.startsWith("@")) return raw;
  if(/^[-]?\d+$/.test(raw)) return Number(raw);
  return raw;
}

function botLink(botUsername, startParam){
  const uname = String(botUsername || "").trim();
  if(!uname) return "";
  if(startParam){
    return `https://t.me/${uname}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${uname}`;
}

function buildPostTemplate(kind, botUsername){
  const appUrl = miniAppUrl();
  const botUrl = botLink(botUsername);
  const starsUrl = botLink(botUsername, "stars");
  const playUrl = appUrl || botLink(botUsername, "play") || botUrl;

  if(kind === "play"){
    return {
      kind: "play",
      text: [
        "Tiger Strike is live.",
        "Story mode, Arcade, and Survival are ready.",
        "Tap below and deploy your squad.",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Play Tiger Strike", url: playUrl }],
          botUrl ? [{ text: "Open Bot", url: botUrl }] : [],
        ].filter((row) => row.length > 0),
      },
    };
  }

  if(kind === "stars"){
    return {
      kind: "stars",
      text: [
        "Need more Stars for Tiger Strike?",
        "Top up, then spend Stars in Cash and Premium tabs.",
        "All rewards are verified server-side.",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open Stars Shop", url: playUrl }],
          starsUrl ? [{ text: "Open Bot Stars Help", url: starsUrl }] : [],
        ].filter((row) => row.length > 0),
      },
    };
  }

  if(kind === "premium"){
    return {
      kind: "premium",
      text: [
        "Premium bundles are live in Tiger Strike.",
        "Use Stars to unlock high-impact mission loadouts.",
        "Limited-time campaign packs rotate weekly.",
      ].join("\n"),
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open Premium Shop", url: playUrl }],
          botUrl ? [{ text: "Chat with Bot", url: botUrl }] : [],
        ].filter((row) => row.length > 0),
      },
    };
  }

  return {
    kind: "campaign",
    text: [
      "Campaign Alert: Tiger Strike operations updated.",
      "New mission pacing and rewards now active.",
      "Rally your squad and jump in.",
    ].join("\n"),
    reply_markup: {
      inline_keyboard: [
        [{ text: "Launch Mission", url: playUrl }],
        botUrl ? [{ text: "Bot Updates", url: botUrl }] : [],
      ].filter((row) => row.length > 0),
    },
  };
}

function liveopsKinds(){
  return [
    "campaign",
    "premium",
    "stars",
    "play",
  ];
}

function pickLiveopsKind(tsMs = Date.now()){
  const kinds = liveopsKinds();
  const dayIndex = Math.floor(Number(tsMs || Date.now()) / (24 * 60 * 60 * 1000));
  const idx = Math.abs(dayIndex % kinds.length);
  return kinds[idx] || "campaign";
}

function targetChannelFrom(source){
  if(source?.chat?.type === "channel") return source.chat.id;
  return normalizeChatId(envText("TELEGRAM_CHANNEL_ID"));
}

module.exports = {
  miniAppUrl,
  normalizeChatId,
  botLink,
  buildPostTemplate,
  liveopsKinds,
  pickLiveopsKind,
  targetChannelFrom,
};
