(function(root, factory){
  const api = factory(root || globalThis);
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.TigerPostCampaign = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(root){
  "use strict";

  const VERSION = "11.1";
  const CYCLE_MS = 12 * 60 * 60 * 1000;
  const CRISIS_TYPES = Object.freeze([
    Object.freeze({
      id:"settlement_siege", coopLaunchType:"crisis-settlement-siege", icon:"🏘️", name:"Settlement Siege",
      desc:"A tiger pack has surrounded a populated settlement. Rescue every civilian, hold the route, and clear the pack.",
      objective:"Post-Campaign Crisis: rescue every civilian from the besieged settlement, then secure extraction.",
      civilians:6, tigers:8, captures:0, rewardCash:18000, rewardXp:360,
    }),
    Object.freeze({
      id:"escaped_alpha", coopLaunchType:"crisis-escaped-alpha", icon:"👑", name:"Escaped Alpha Transport",
      desc:"A captured Alpha broke out during transport. Track it, weaken it nonlethally, and return it alive.",
      objective:"Post-Campaign Crisis: recapture the escaped Alpha alive and secure the wildlife route.",
      civilians:2, tigers:1, captures:1, boss:true, bossType:"Alpha", rewardCash:24000, rewardXp:520,
    }),
    Object.freeze({
      id:"government_raid", coopLaunchType:"crisis-government-raid", icon:"🚨", name:"Government Response Raid",
      desc:"An armed response unit entered an unstable district while tigers closed on civilians. Survive both threats and evacuate the settlement.",
      objective:"Post-Campaign Crisis: survive the government response raid, protect civilians, and clear the tiger threat.",
      civilians:4, tigers:5, captures:0, government:true, rewardCash:22000, rewardXp:460,
    }),
  ]);

  const hash=(value)=>{
    let h=2166136261;
    for(const ch of String(value||"")){ h^=ch.charCodeAt(0); h=Math.imul(h,16777619); }
    return h>>>0;
  };
  const crisisById=(id)=>CRISIS_TYPES.find((row)=>row.id===String(id||""))||null;
  const crisisByLaunchType=(launchType)=>CRISIS_TYPES.find((row)=>row.coopLaunchType===String(launchType||""))||null;
  const isCrisisLaunchType=(launchType)=>!!crisisByLaunchType(launchType);
  function difficultyForPlayers(playerCount=1){
    const players=Math.max(1,Math.min(2,Math.floor(Number(playerCount||1))));
    return Object.freeze({
      playerCount:players,
      tigerHpMultiplier:players===2?1.24:1,
      tigerDamageMultiplier:players===2?1.12:1,
      timeMultiplier:players===2?1.08:1,
      label:players===2?"Two Player":"Solo",
    });
  }
  const normalizeDistricts=(districts)=>Array.isArray(districts)?districts.filter((row)=>row&&row.id):[];

  function cycleKey(now=Date.now()){
    return Math.floor(Math.max(0,Number(now)||Date.now())/CYCLE_MS);
  }
  function crisisBoard(districts, livingState=null, now=Date.now()){
    const rows=normalizeDistricts(districts);
    if(!rows.length) return [];
    const cycle=cycleKey(now);
    const ranked=rows.map((district,index)=>({
      district,index,
      pressure:Number(livingState?.districts?.[district.id]?.tigerPressure ?? district.tigerPressure ?? 50),
      score:hash(`${cycle}:${district.id}`),
    })).sort((a,b)=>(b.pressure-a.pressure)||(b.score-a.score));
    const used=new Set();
    return CRISIS_TYPES.map((type,index)=>{
      const pool=ranked.filter((row)=>!used.has(row.district.id));
      const pick=pool[(hash(`${cycle}:${type.id}`)+index)%Math.max(1,pool.length)]||ranked[index%ranked.length];
      used.add(pick.district.id);
      const span=Math.max(1,Number(pick.district.maxMission||1)-Number(pick.district.minMission||1)+1);
      const missionLevel=Math.max(1,Math.min(100,Number(pick.district.minMission||1)+(hash(`${cycle}:${type.id}:mission`)%span)));
      return { ...type, districtId:pick.district.id, districtName:pick.district.name, missionLevel, cycle };
    });
  }
  function applyCrisisProfile(config, operation){
    const base={...(config||{})};
    const type=crisisById(operation?.typeId);
    if(!type) return base;
    base.postCampaignCrisis=true;
    base.postCampaignCrisisType=type.id;
    base.postCampaignDistrictId=String(operation?.districtId||"");
    base.chapterName=`World After the Ancient Tiger • ${type.name}`;
    base.objective=type.objective;
    base.civilians=Math.max(0,Number(type.civilians||0));
    base.civiliansExact=true;
    base.tigers=Math.max(1,Number(type.tigers||1));
    base.tigersExact=true;
    base.captureRequired=Math.max(0,Number(type.captures||0));
    base.convoyMission=type.id==="settlement_siege";
    base.boss=!!type.boss;
    base.bossTwin=false;
    base.bossType=type.bossType||base.bossType;
    base.forceGovernmentResponse=!!type.government;
    base.endgameHpMul=Math.max(1.05,Number(base.endgameHpMul||1));
    base.endgameAggroMul=Math.max(1.08,Number(base.endgameAggroMul||1));
    base.endgamePayoutMul=Math.max(1.18,Number(base.endgamePayoutMul||1));
    return base;
  }

  const ENDING_SCENES=Object.freeze({
    CAPTURE:Object.freeze([
      Object.freeze({at:0,title:"THE ANCIENT TIGER LIVES",caption:"The jungle falls silent as the Ancient Tiger is secured alive."}),
      Object.freeze({at:4200,title:"A NEW PROTECTORATE",caption:"Conservation teams carry the living Alpha toward the sanctuary transport."}),
      Object.freeze({at:8500,title:"THIRTY DISTRICTS CALL",caption:"Every rescued settlement lights up the command map with a new crisis."}),
      Object.freeze({at:12600,title:"YOUR WATCH CONTINUES",caption:"Mission 100 ended the hunt. It did not end your duty."}),
    ]),
    KILL:Object.freeze([
      Object.freeze({at:0,title:"THE ANCIENT TIGER FALLS",caption:"The final shot echoes through the temple and the jungle answers with a roar."}),
      Object.freeze({at:4200,title:"A VACANT THRONE",caption:"Without the Ancient Tiger, rival packs push into the empty territory."}),
      Object.freeze({at:8500,title:"THIRTY DISTRICTS CALL",caption:"Settlements report migrations, raids, and new Alphas fighting for control."}),
      Object.freeze({at:12600,title:"YOUR WATCH CONTINUES",caption:"Mission 100 ended one war. The living world has begun another."}),
    ]),
  });
  const ENDING_DURATION=16000;
  let movie=null;
  const el=(id)=>root.document?.getElementById(id)||null;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const sceneFor=(choice,elapsed)=>{
    const scenes=ENDING_SCENES[choice]||ENDING_SCENES.KILL;
    return [...scenes].reverse().find((scene)=>elapsed>=scene.at)||scenes[0];
  };
  function drawEndingFrame(ctx,choice,elapsed){
    const w=ctx.canvas.width,h=ctx.canvas.height,p=clamp(elapsed/ENDING_DURATION,0,1);
    ctx.clearRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,choice==="CAPTURE"?"#0f766e":"#3f1d2e"); sky.addColorStop(.55,"#164e3b"); sky.addColorStop(1,"#052e16");
    ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    ctx.fillStyle="rgba(34,197,94,.22)";for(let x=0;x<w;x+=70)ctx.fillRect(x+(x%140?18:0),80+(x%210),46,h);
    ctx.fillStyle="#334155";ctx.fillRect(0,h*.68,w,h*.32);ctx.strokeStyle="#facc15";ctx.lineWidth=5;ctx.setLineDash([28,22]);ctx.beginPath();ctx.moveTo(0,h*.84);ctx.lineTo(w,h*.84);ctx.stroke();ctx.setLineDash([]);
    const tigerX=w*(.72-(p*.34)); const tigerY=h*.61;
    ctx.save();ctx.translate(tigerX,tigerY);ctx.fillStyle="#f97316";ctx.beginPath();ctx.ellipse(0,0,62,31,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(56,-12,27,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#111827";ctx.lineWidth=6;[-32,-10,12,32].forEach((x)=>{ctx.beginPath();ctx.moveTo(x,-24);ctx.lineTo(x+8,15);ctx.stroke();});ctx.restore();
    if(choice==="CAPTURE"){
      ctx.strokeStyle="#94a3b8";ctx.lineWidth=7;ctx.strokeRect(tigerX-82,tigerY-58,170,112);for(let x=tigerX-60;x<tigerX+80;x+=28){ctx.beginPath();ctx.moveTo(x,tigerY-58);ctx.lineTo(x,tigerY+54);ctx.stroke();}
      ctx.fillStyle="#166534";ctx.fillRect(w*.10,h*.55,180,70);ctx.fillStyle="#86efac";ctx.font="900 20px system-ui";ctx.fillText("WILDLIFE TRANSPORT",w*.12,h*.61);
    }else{
      ctx.fillStyle="rgba(239,68,68,.28)";ctx.beginPath();ctx.arc(tigerX,tigerY+26,52+Math.sin(elapsed/200)*6,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#1e293b";ctx.fillRect(w*.10,h*.54,150,78);ctx.fillStyle="#fca5a5";ctx.font="900 20px system-ui";ctx.fillText("ALPHA ALERT",w*.13,h*.61);
    }
    const scene=sceneFor(choice,elapsed);ctx.fillStyle="rgba(2,6,23,.78)";ctx.fillRect(0,0,w,78);ctx.fillStyle="#f8fafc";ctx.font="1000 30px system-ui";ctx.textAlign="center";ctx.fillText(scene.title,w/2,48);
  }
  function stopMovie(){ if(movie?.frame&&root.cancelAnimationFrame) root.cancelAnimationFrame(movie.frame); movie=null; }
  function tick(now){
    if(!movie)return;const elapsed=clamp(now-movie.startedAt,0,ENDING_DURATION);drawEndingFrame(movie.ctx,movie.choice,elapsed);
    const scene=sceneFor(movie.choice,elapsed);const caption=el("postCampaignEndingCaption"),progress=el("postCampaignEndingProgress");
    if(caption)caption.textContent=scene.caption;if(progress)progress.style.width=`${Math.round(elapsed/ENDING_DURATION*100)}%`;
    if(elapsed>=ENDING_DURATION){movie.ended=true;const replay=el("postCampaignEndingReplayBtn");if(replay)replay.style.display="inline-flex";return;}
    movie.frame=root.requestAnimationFrame?.(tick)||0;
  }
  function openEnding(choice="KILL",endingInfo={}){
    const overlay=el("postCampaignEndingOverlay"),canvas=el("postCampaignEndingCanvas");if(!overlay||!canvas)return false;
    stopMovie();const normalized=String(choice).toUpperCase()==="CAPTURE"?"CAPTURE":"KILL";const title=el("postCampaignEndingTitle"),route=el("postCampaignEndingRoute"),replay=el("postCampaignEndingReplayBtn");
    if(title)title.textContent=normalized==="CAPTURE"?"The Sanctuary Dawn":"The Empty Throne";
    if(route)route.textContent=`${endingInfo.ending||"Campaign Ending"} • ${endingInfo.rewardTitle||"Tiger Strike Commander"}`;
    if(replay)replay.style.display="none";overlay.style.display="flex";movie={choice:normalized,endingInfo,ctx:canvas.getContext("2d"),startedAt:performance.now(),frame:0,ended:false};movie.frame=root.requestAnimationFrame?.(tick)||0;return true;
  }
  function replayEnding(){ if(!movie)return false;const info=movie.endingInfo,choice=movie.choice;return openEnding(choice,info); }
  function closeEnding(){ const overlay=el("postCampaignEndingOverlay");if(overlay)overlay.style.display="none";stopMovie();return false; }

  root.openPostCampaignEnding=openEnding;
  root.replayPostCampaignEnding=replayEnding;
  root.closePostCampaignEnding=closeEnding;
  return Object.freeze({VERSION,CYCLE_MS,CRISIS_TYPES,ENDING_SCENES,ENDING_DURATION,crisisById,crisisByLaunchType,isCrisisLaunchType,difficultyForPlayers,cycleKey,crisisBoard,applyCrisisProfile,sceneFor,drawEndingFrame,openEnding,replayEnding,closeEnding});
});
