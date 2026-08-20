const { json, readJsonBody } = require("../_lib/http");
const { validateTelegramInitData } = require("../_lib/telegram-auth");
const {
  recordGameplaySnapshot,
  getClanCloudSnapshot,
  recordReferralStart,
  recordReferralQualification,
  referralMilestoneFromCount,
} = require("../_lib/player-stats");
const { getCommunitySnapshot } = require("../_lib/community");
const liveops = require("../_lib/liveops");

module.exports = async function handler(req, res){
  if(req.method !== "POST"){
    return json(res, 405, { ok:false, error:"Method not allowed." });
  }

  try{
    const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if(!botToken){
      return json(res, 500, { ok:false, error:"Server misconfigured: TELEGRAM_BOT_TOKEN is missing." });
    }

    const body = readJsonBody(req);
    const initData = String(body?.initData || "");
    if(!initData){
      return json(res, 400, { ok:false, error:"Missing initData." });
    }

    const { user } = validateTelegramInitData(initData, botToken);
    const snapshot = (body?.snapshot && typeof body.snapshot === "object") ? body.snapshot : {};
    const startParam = String(snapshot?.startParam || "").trim();
    const referralMatch = startParam.match(/^ref_(\d{1,20})$/);
    if(referralMatch){
      const referrerId = Number(referralMatch[1] || 0);
      if(Number.isSafeInteger(referrerId) && referrerId > 0){
        try{ await recordReferralStart({ referredUser:user, referrerId }); }catch(e){ /* best effort */ }
      }
    }
    const profile = await recordGameplaySnapshot({ user, snapshot });
    if(!profile){
      return json(res, 400, { ok:false, error:"Could not update gameplay stats." });
    }
    const clan = await getClanCloudSnapshot(user);
    const community = await getCommunitySnapshot({ botToken, userId:Number(user?.id || 0) });
    const referredBy = Number(profile.referredBy || 0);
    const missionsCleared = Math.max(0, Number(profile?.ops?.missionsCleared || 0));
    let qualification = {
      eligible:referredBy > 0,
      qualified:Number(profile.referralQualifiedAt || 0) > 0,
      needsGroup:referredBy > 0 && !community.isMember,
      needsMission:referredBy > 0 && missionsCleared < 1,
    };
    if(referredBy > 0 && community.isMember && missionsCleared >= 1 && !qualification.qualified){
      try{
        const result = await recordReferralQualification({ referredUser:user, referrerId:referredBy });
        qualification = { ...qualification, qualified:!!(result?.qualified || result?.alreadyQualified), needsGroup:false, needsMission:false };
      }catch(e){ /* best effort */ }
    }
    const botUsername = String(process.env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_PUBLIC_USERNAME || "").trim().replace(/^@+/, "");
    const userId = Number(profile.userId || 0);
    const referralLink = (botUsername && userId > 0) ? `https://t.me/${botUsername}?startapp=ref_${userId}` : "";
    const botLink = botUsername ? `https://t.me/${botUsername}` : "";
    const referral = {
      ...referralMilestoneFromCount(profile.referralsQualified || 0),
      opened:Math.max(0, Number(profile.referralsStarted || 0)),
      qualified:Math.max(0, Number(profile.referralsQualified || 0)),
      link: referralLink,
      botLink,
    };
    const eventDrop = liveops.eventDropSnapshot(Date.now());

    return json(res, 200, {
      ok: true,
      userId,
      daily: profile.daily || null,
      weekly: profile.weekly || null,
      season: profile.season || null,
      monthly: profile.monthly || null,
      lifetimeScore: Number(profile.lifetimeScore || 0),
      balance: {
        deaths: Math.max(0, Math.floor(Number(profile?.ops?.deaths || 0))),
        missionFails: Math.max(0, Math.floor(Number(profile?.ops?.missionFails || 0))),
        freezeRecovers: Math.max(0, Math.floor(Number(profile?.ops?.freezeRecovers || 0))),
        freezeSpikes: Math.max(0, Math.floor(Number(profile?.ops?.freezeSpikes || 0))),
        autoTune: Number.isFinite(Number(profile?.ops?.autoTune)) ? Number(profile.ops.autoTune) : 1,
      },
      clan: clan || null,
      referral,
      community:{ ...community, qualification },
      eventDrop,
    });
  }catch(e){
    return json(res, 500, { ok:false, error:e?.message || "Gameplay sync failed." });
  }
};
