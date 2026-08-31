(function(root){
  "use strict";

  const clampLocal=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const distance=(a,b)=>Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
  const escapeHtml=(value)=>String(value??"").replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const saveNow=()=>{ try{ root.save?.(true); }catch(e){} };
  const notify=(message,opts={})=>{
    if(typeof root.interactionFeedback==="function") return root.interactionFeedback(message,opts);
    if(typeof root.toast==="function") return root.toast(message);
    return message;
  };

  const SECONDARY_DEFS=Object.freeze({
    "tranq-kit":Object.freeze({id:"tranq-kit",name:"Tranq Kit",icon:"💉",charges:3,cooldown:7000,description:"Nonlethal capture preparation"}),
    smoke:Object.freeze({id:"smoke",name:"Smoke Grenade",icon:"💨",charges:2,cooldown:12000,description:"Breaks nearby tiger pressure for 8 seconds"}),
    "med-drone":Object.freeze({id:"med-drone",name:"Med Drone",icon:"🚑",charges:2,cooldown:10000,description:"Heals the most injured nearby rescue target"}),
    flare:Object.freeze({id:"flare",name:"Signal Flare",icon:"🚨",charges:3,cooldown:9000,description:"Reveals tigers, civilians, and extraction for 14 seconds"}),
    shock:Object.freeze({id:"shock",name:"Shock Baton",icon:"⚡",charges:3,cooldown:8000,description:"Nonlethally staggers a tiger at close range"}),
  });

  function selectedSecondaryId(state=root.S){
    const requested=String(state?.worldMapPrepLast?.secondaryId||state?.worldMapCampaign?.prep?.secondaryId||"tranq-kit");
    return SECONDARY_DEFS[requested]?requested:"tranq-kit";
  }
  function ensureMissionSecondary(state=root.S){
    if(!state) return null;
    const id=selectedSecondaryId(state);
    const def=SECONDARY_DEFS[id];
    const runId=String(state._missionRunId||"");
    const current=state.missionSecondary&&typeof state.missionSecondary==="object"?state.missionSecondary:null;
    if(!current||current.id!==id||current.runId!==runId){
      state.missionSecondary={id,runId,charges:def.charges,cooldownUntil:0,activeUntil:0,uses:0,lastEffect:""};
    }
    return state.missionSecondary;
  }
  function resetMissionSecondaryForMission(state=root.S){
    if(!state) return null;
    const id=selectedSecondaryId(state);
    const def=SECONDARY_DEFS[id];
    state.missionSecondary={id,runId:String(state._missionRunId||""),charges:def.charges,cooldownUntil:0,activeUntil:0,uses:0,lastEffect:""};
    state.secondarySmokeUntil=0;
    state.secondaryFlareUntil=0;
    state.secondaryDroneUntil=0;
    state.secondaryShockUntil=0;
    return state.missionSecondary;
  }
  function nearestTiger(state=root.S,maxRange=Infinity){
    if(!state?.me) return null;
    const active=(state.tigers||[]).find((t)=>t&&t.alive&&Number(t.id)===Number(state.activeTigerId||state.lockedTigerId));
    if(active&&distance(active,state.me)<=maxRange) return active;
    return (state.tigers||[]).filter((t)=>t&&t.alive&&distance(t,state.me)<=maxRange).sort((a,b)=>distance(a,state.me)-distance(b,state.me))[0]||null;
  }
  function useTranqKit(state,now){
    if(state.mode==="Survival") return {ok:false,message:"Survival is lethal-only. Tranq capture equipment is unavailable."};
    const tiger=nearestTiger(state,280);
    if(!tiger) return {ok:false,message:"No living tiger is close enough for the Tranq Kit."};
    if(tiger.lethalWounded) return {ok:false,message:"This tiger was hit by Real ammunition and cannot be prepared for a live capture."};
    const hpMax=Math.max(1,Number(tiger.hpMax||100));
    const capMax=typeof root.captureWindowHp==="function"?root.captureWindowHp(tiger):Math.ceil(hpMax*.30);
    const capMin=typeof root.captureWindowMinHp==="function"?root.captureWindowMinHp(tiger):1;
    const safeFloor=Math.max(capMin+1,2);
    const requested=Math.max(5,Math.round(hpMax*.12));
    const damage=Math.max(0,Math.min(requested,Number(tiger.hp||hpMax)-safeFloor));
    tiger.tranqTagged=true;
    tiger.rubberSlowStacks=clampLocal(Number(tiger.rubberSlowStacks||0)+1,1,4);
    tiger.rubberSlowUntil=now+6200;
    tiger.holdUntil=Math.max(Number(tiger.holdUntil||0),now+1500);
    if(damage>0){
      if(typeof root.applyTigerDamage==="function") root.applyTigerDamage(tiger,damage,{floorOne:true,floorHp:safeFloor,tranq:true,sourceX:state.me.x,sourceY:state.me.y});
      else tiger.hp=Math.max(safeFloor,Number(tiger.hp||hpMax)-damage);
    }
    state.ammoReserve=state.ammoReserve&&typeof state.ammoReserve==="object"?state.ammoReserve:{};
    state.ammoReserve.TRANQ_DARTS=Math.max(0,Number(state.ammoReserve.TRANQ_DARTS||0))+2;
    state.lockedTigerId=tiger.id;
    state.secondaryTranqFx={x:tiger.x,y:tiger.y,until:now+1100};
    const ready=Number(tiger.hp||0)<=capMax;
    return {ok:true,message:ready?"Tranq Kit applied. Capture window ready—use Tranq and Capture.":"Tranq Kit applied safely. Keep using Rubber rounds until the capture window opens."};
  }
  function useSmoke(state,now){
    state.secondarySmokeUntil=now+8000;
    for(const tiger of (state.tigers||[])){
      if(!tiger?.alive||distance(tiger,state.me)>300) continue;
      tiger.holdUntil=Math.max(Number(tiger.holdUntil||0),now+4200);
      tiger._fieldPounceResolveAt=0;
      tiger.attackTelegraphUntil=0;
    }
    if(state.inBattle&&typeof root.endBattle==="function") root.endBattle();
    return {ok:true,message:"Smoke deployed. Nearby tigers lost sight of soldiers and civilians for 8 seconds."};
  }
  function useMedDrone(state,now){
    const candidates=[];
    if(Number(state.hp||0)<100) candidates.push({kind:"soldier",target:state.me,ratio:Number(state.hp||0)/100});
    if(state.mode!=="Survival"){
      for(const civ of (state.civilians||[])){
        if(!civ?.alive||civ.evac||distance(civ,state.me)>360) continue;
        const max=Math.max(1,Number(civ.hpMax||100));
        if(Number(civ.hp||0)<max) candidates.push({kind:"civilian",target:civ,ratio:Number(civ.hp||0)/max});
      }
    }
    candidates.sort((a,b)=>a.ratio-b.ratio);
    const pick=candidates[0];
    if(!pick) return {ok:false,message:"The Med Drone found nobody injured nearby, so no charge was used."};
    let healed=0;
    if(pick.kind==="soldier"){
      const before=Number(state.hp||0);state.hp=clampLocal(before+38,0,100);healed=Math.round(state.hp-before);
    }else{
      const max=Math.max(1,Number(pick.target.hpMax||100));
      const before=Number(pick.target.hp||0);pick.target.hp=clampLocal(before+48,0,max);healed=Math.round(pick.target.hp-before);
    }
    state.secondaryDroneUntil=now+3000;
    state.secondaryDroneTarget={x:pick.target.x,y:pick.target.y,kind:pick.kind};
    return {ok:true,message:`Med Drone healed ${pick.kind} +${healed} HP.`};
  }
  function useFlare(state,now){
    state.secondaryFlareUntil=now+14000;
    state.scanPing=Math.max(Number(state.scanPing||0),900);
    const tiger=nearestTiger(state,Infinity);
    if(tiger){state.scanTargetTigerId=tiger.id;state.scanTargetUntil=now+14000;}
    return {ok:true,message:"Signal Flare launched. Tigers, civilians, and the extraction route are revealed for 14 seconds."};
  }
  function useShock(state,now){
    if(state.mode==="Survival") return {ok:false,message:"The Shock Baton is disabled in Survival."};
    const tiger=nearestTiger(state,155);
    if(!tiger) return {ok:false,message:"Move closer—the Shock Baton only reaches a nearby tiger."};
    if(tiger.lethalWounded) return {ok:false,message:"Shock stopped: this tiger already has a lethal injury."};
    const hpMax=Math.max(1,Number(tiger.hpMax||100));
    const floor=typeof root.captureWindowMinHp==="function"?Math.max(2,root.captureWindowMinHp(tiger)+1):2;
    const damage=Math.min(Math.max(4,Math.round(hpMax*.07)),Math.max(0,Number(tiger.hp||hpMax)-floor));
    if(damage>0&&typeof root.applyTigerDamage==="function") root.applyTigerDamage(tiger,damage,{floorOne:true,floorHp:floor,rubber:true,sourceX:state.me.x,sourceY:state.me.y});
    else tiger.hp=Math.max(floor,Number(tiger.hp||hpMax)-damage);
    tiger.holdUntil=Math.max(Number(tiger.holdUntil||0),now+6000);
    tiger.rubberSlowUntil=now+8000;
    tiger.rubberSlowStacks=4;
    state.secondaryShockUntil=now+900;
    state.secondaryShockTarget={x:tiger.x,y:tiger.y};
    return {ok:true,message:"Shock Baton connected. Tiger staggered for 6 seconds without blocking capture."};
  }
  function useSelectedMissionSecondary(){
    const state=root.S;
    if(!state||state.paused||state.missionEnded||state.gameOver) return notify("Secondary gear is unavailable while the mission is paused.",{warn:true});
    const runtime=ensureMissionSecondary(state);
    const def=SECONDARY_DEFS[runtime.id];
    const now=Date.now();
    if(runtime.charges<=0) return notify(`${def.name} has no charges left this mission.`,{warn:true,battle:!!state.inBattle});
    if(now<Number(runtime.cooldownUntil||0)) return notify(`${def.name} recharges in ${Math.ceil((runtime.cooldownUntil-now)/1000)} seconds.`,{warn:true,battle:!!state.inBattle});
    const effect=runtime.id==="tranq-kit"?useTranqKit(state,now):runtime.id==="smoke"?useSmoke(state,now):runtime.id==="med-drone"?useMedDrone(state,now):runtime.id==="flare"?useFlare(state,now):useShock(state,now);
    if(!effect.ok) return notify(effect.message,{warn:true,battle:!!state.inBattle});
    runtime.charges=Math.max(0,Number(runtime.charges||0)-1);
    runtime.uses=Math.max(0,Number(runtime.uses||0))+1;
    runtime.cooldownUntil=now+def.cooldown;
    runtime.activeUntil=Math.max(Number(runtime.activeUntil||0),now+900);
    runtime.lastEffect=effect.message;
    try{root.sfx?.("ui");root.hapticImpact?.("medium");}catch(e){}
    saveNow();
    renderSecondaryHud(state);
    return notify(effect.message,{success:true,battle:!!state.inBattle,seconds:3});
  }
  function renderSecondaryHud(state=root.S){
    if(!state) return;
    const runtime=ensureMissionSecondary(state);
    const def=SECONDARY_DEFS[runtime.id];
    const now=Date.now();
    const cooldown=Math.max(0,Math.ceil((Number(runtime.cooldownUntil||0)-now)/1000));
    const unavailable=state.mode==="Survival"&&(runtime.id==="tranq-kit"||runtime.id==="shock");
    const disabled=!!(state.paused||state.missionEnded||state.gameOver||runtime.charges<=0||cooldown>0||unavailable);
    const compact=unavailable?"N/A":(cooldown>0?`${cooldown}s`:`${runtime.charges}`);
    for(const id of ["touchSecondaryBtn","touchCombatSecondaryBtn"]){
      const button=document.getElementById(id);if(!button) continue;
      const icon=button.querySelector(".touchBtnIcon");const label=button.querySelector(".touchBtnLabel");
      if(icon) icon.textContent=def.icon;if(label) label.textContent=`${def.name.split(" ")[0]} ${compact}`;
      button.disabled=disabled;button.title=`${def.name} • ${runtime.charges} charge${runtime.charges===1?"":"s"}${cooldown?` • ${cooldown}s cooldown`:""}`;
    }
    for(const id of ["secondaryActionBtn","combatSecondaryActionBtn"]){
      const button=document.getElementById(id);if(!button) continue;
      button.textContent=`${def.icon} ${def.name} • ${compact}`;button.disabled=disabled;button.title=def.description;
    }
  }
  function drawMissionSecondaryEffects(context,state=root.S,now=Date.now()){
    if(!context||!state?.me) return;
    context.save();
    if(now<Number(state.secondarySmokeUntil||0)){
      for(let i=0;i<9;i++){
        const angle=(now/900)+(i*.72);const radius=24+(i%3)*24;const x=state.me.x+Math.cos(angle)*radius;const y=state.me.y+Math.sin(angle*.8)*radius*.55;
        context.beginPath();context.fillStyle=`rgba(203,213,225,${.08+(i%3)*.035})`;context.arc(x,y,28+(i%2)*12,0,Math.PI*2);context.fill();
      }
    }
    if(now<Number(state.secondaryFlareUntil||0)){
      const pulse=18+Math.sin(now/130)*5;context.strokeStyle="rgba(251,191,36,.92)";context.lineWidth=3;context.beginPath();context.arc(state.me.x,state.me.y,pulse,0,Math.PI*2);context.stroke();
      const points=[...(state.tigers||[]).filter((t)=>t?.alive),...(state.civilians||[]).filter((c)=>c?.alive&&!c.evac),...(state.evacZone?[state.evacZone]:[])];
      context.setLineDash([7,7]);context.lineWidth=2;
      for(const point of points.slice(0,18)){context.strokeStyle=point===state.evacZone?"rgba(74,222,128,.75)":((state.tigers||[]).includes(point)?"rgba(251,113,133,.66)":"rgba(56,189,248,.62)");context.beginPath();context.moveTo(state.me.x,state.me.y);context.lineTo(point.x,point.y);context.stroke();}
      context.setLineDash([]);
    }
    if(now<Number(state.secondaryDroneUntil||0)){
      const target=state.secondaryDroneTarget||state.me;const x=Number(target.x||state.me.x)+Math.cos(now/180)*28;const y=Number(target.y||state.me.y)-38+Math.sin(now/160)*5;
      context.font="24px system-ui";context.textAlign="center";context.fillText("🚑",x,y);context.strokeStyle="rgba(74,222,128,.8)";context.beginPath();context.arc(Number(target.x||state.me.x),Number(target.y||state.me.y),24,0,Math.PI*2);context.stroke();
    }
    if(now<Number(state.secondaryShockUntil||0)){
      const target=state.secondaryShockTarget||state.me;const pct=1-((Number(state.secondaryShockUntil||0)-now)/900);context.strokeStyle=`rgba(250,204,21,${1-pct})`;context.lineWidth=4;context.beginPath();context.arc(target.x,target.y,20+pct*62,0,Math.PI*2);context.stroke();
    }
    if(now<Number(state.secondaryTranqFx?.until||0)){
      context.strokeStyle="rgba(103,232,249,.95)";context.lineWidth=4;context.beginPath();context.moveTo(state.me.x,state.me.y-8);context.lineTo(state.secondaryTranqFx.x,state.secondaryTranqFx.y);context.stroke();
    }
    context.restore();
  }

  const QUESTIONS=Object.freeze([
    Object.freeze({title:"Evidence Review",prompt:"Investigators show your mission record. What do you say about lethal choices?",choices:Object.freeze([
      Object.freeze({text:"I accept responsibility and will use nonlethal options when capture is possible.",trust:3,correct:true}),
      Object.freeze({text:"The evidence is wrong, so I refuse to discuss it.",trust:-4,correct:false}),
      Object.freeze({text:"Finishing quickly matters more than the consequences.",trust:-5,correct:false}),
      Object.freeze({text:"I only care about collecting the mission reward.",trust:-6,correct:false}),
    ])}),
    Object.freeze({title:"Civilian Safety Hearing",prompt:"A civilian and the tiger target are both in danger. What comes first?",choices:Object.freeze([
      Object.freeze({text:"Protect the civilian, control the area, then handle the tiger safely.",trust:3,correct:true}),
      Object.freeze({text:"Ignore the civilian and chase the tiger immediately.",trust:-5,correct:false}),
      Object.freeze({text:"Fire through the civilian if the tiger is behind them.",trust:-8,correct:false}),
      Object.freeze({text:"Leave both behind and collect supplies.",trust:-6,correct:false}),
    ])}),
    Object.freeze({title:"Wildlife Conduct Statement",prompt:"A tiger can still be captured alive. What is the approved response?",choices:Object.freeze([
      Object.freeze({text:"Use Rubber rounds, apply Tranq, secure the tiger, and cage it.",trust:4,correct:true}),
      Object.freeze({text:"Use Real rounds because they finish the fight faster.",trust:-7,correct:false}),
      Object.freeze({text:"Keep firing Rubber rounds and never use Tranq.",trust:-2,correct:false}),
      Object.freeze({text:"Leave the weakened tiger loose near civilians.",trust:-6,correct:false}),
    ])}),
  ]);
  const REHAB_MISSIONS=Object.freeze([
    Object.freeze({title:"Nonlethal Certification",brief:"Move into range, weaken the training tiger with Rubber rounds, apply Tranq, and secure it in a cage."}),
    Object.freeze({title:"Civilian Rescue Exercise",brief:"Reach the trainee civilian and escort them through the marked safe zone without abandoning them."}),
    Object.freeze({title:"Wildlife Transfer Duty",brief:"Inspect and tag the tiger cage, attach it, and deliver it to the conservation truck."}),
  ]);
  const GRID_W=7,GRID_H=5;
  const cellKey=(x,y)=>`${x},${y}`;
  function moveCell(position,dx,dy,walls=[],width=GRID_W,height=GRID_H){
    const x=clampLocal(Number(position?.x||0)+Number(dx||0),0,width-1);
    const y=clampLocal(Number(position?.y||0)+Number(dy||0),0,height-1);
    return walls.includes(cellKey(x,y))?{x:Number(position?.x||0),y:Number(position?.y||0),blocked:true}:{x,y,blocked:false};
  }
  function governmentExperience(program){
    const current=program.experience&&typeof program.experience==="object"?program.experience:{};
    program.experience={
      cuffPins:clampLocal(Math.floor(Number(current.cuffPins||0)),0,3),
      cuffUnlocked:current.cuffUnlocked===true,
      lockpickTarget:clampLocal(Number(current.lockpickTarget||38),12,82),
      lockpickAttempts:Math.max(0,Math.floor(Number(current.lockpickAttempts||0))),
      answers:Array.isArray(current.answers)?current.answers.slice(0,QUESTIONS.length):[],
      hearingAttempts:Math.max(0,Math.floor(Number(current.hearingAttempts||0))),
      notice:String(current.notice||""),
      escape:current.escape&&typeof current.escape==="object"?current.escape:null,
      rehab:current.rehab&&typeof current.rehab==="object"?current.rehab:null,
      rehabResult:String(current.rehabResult||""),
    };
    return program.experience;
  }
  function programState(){return root.ensureGovernmentProgramState?.(root.S)||root.S?.governmentProgram;}
  function roomSceneHtml(exp){
    return `<div class="governmentScene"><div class="governmentSceneTitle">Federal Wildlife Operations • Interview Room 4</div><div class="interrogationCast"><div class="interrogationActor"><span class="person">🕵🏽</span>Lead Investigator</div><div><div class="interrogationActor soldier"><span class="person">🪖</span>Your Soldier<br><span class="cuffBadge ${exp.cuffUnlocked?"open":""}">${exp.cuffUnlocked?"🔓 Cuffs unlocked":"🔒 Handcuffed"}</span></div><div class="interrogationTable"></div></div><div class="interrogationActor"><span class="person">👮🏾</span>Agency Officer</div></div></div>`;
  }
  function lockpickPanelHtml(exp){
    if(exp.cuffUnlocked) return `<div class="lockpickPanel"><b>🔓 Handcuffs unlocked.</b> “Run” is now available as an answer. Choosing it begins the escape.</div>`;
    const left=clampLocal(exp.lockpickTarget,8,84);
    return `<div class="lockpickPanel"><b>🧷 Secret escape option: pick the handcuffs</b><div class="small">Tap Set Pin while the white marker is inside the green area. Open all 3 pins. A miss can knock one pin loose.</div><div class="lockpickTrack"><span class="lockpickTarget" style="left:${left}%;width:16%"></span><span class="lockpickMarker"></span></div><div class="row"><button class="warn" type="button" onclick="attemptGovernmentLockpick()">Set Pin ${Math.min(3,exp.cuffPins+1)}</button><span class="tag">Pins ${exp.cuffPins}/3</span></div></div>`;
  }
  function answerOutcome(answers){return answers.length===QUESTIONS.length&&answers.every((answer)=>answer?.correct===true);}
  function renderQuestioning(body,actions,program,exp){
    const step=clampLocal(Math.floor(Number(program.questioningStep||0)),0,QUESTIONS.length-1);
    const question=QUESTIONS[step];
    const choices=question.choices.map((choice,index)=>{
      const runSlot=exp.cuffUnlocked&&index===3;
      const label=runSlot?"🏃 RUN — begin the escape":choice.text;
      const klass=runSlot?"danger":(index===0?"good":"ghost");
      const handler=runSlot?"chooseGovernmentRun()":`answerGovernmentQuestion(${index})`;
      return `<button class="${klass}" type="button" onclick="${handler}">${escapeHtml(label)}</button>`;
    }).join("");
    body.innerHTML=`${roomSceneHtml(exp)}<div class="governmentStepKicker">Question ${step+1} of ${QUESTIONS.length}</div><div class="governmentStepTitle">${escapeHtml(question.title)}</div><div class="governmentStepText">${escapeHtml(question.prompt)}</div>${exp.notice?`<div class="governmentDecisionWarning" style="margin-top:10px">${escapeHtml(exp.notice)}</div>`:""}<div class="governmentAnswerGrid">${choices}</div>${lockpickPanelHtml(exp)}<div class="governmentProgress"><span style="width:${Math.round((step/QUESTIONS.length)*100)}%"></span></div>`;
    actions.innerHTML=`<button class="ghost" type="button" onclick="closeGovernmentConsequence()">Save and Decide Later</button>`;
  }
  function attemptGovernmentLockpick(){
    const program=programState();if(!program||program.consequenceStage!=="QUESTIONING")return;
    const exp=governmentExperience(program);if(exp.cuffUnlocked)return;
    const track=document.querySelector("#governmentConsequenceBody .lockpickTrack");
    const marker=document.querySelector("#governmentConsequenceBody .lockpickMarker");
    const target=document.querySelector("#governmentConsequenceBody .lockpickTarget");
    if(!track||!marker||!target)return;
    const markerRect=marker.getBoundingClientRect(),targetRect=target.getBoundingClientRect();
    const center=markerRect.left+(markerRect.width/2);
    const hit=center>=targetRect.left&&center<=targetRect.right;
    exp.lockpickAttempts+=1;
    if(hit){
      exp.cuffPins=Math.min(3,exp.cuffPins+1);
      exp.notice=exp.cuffPins>=3?"The lock clicks open. Keep calm—or choose Run.":`Pin ${exp.cuffPins} set quietly.`;
      if(exp.cuffPins>=3)exp.cuffUnlocked=true;
    }else{
      exp.cuffPins=Math.max(0,exp.cuffPins-1);
      exp.notice="The pick slipped. Stay still before an officer notices.";
    }
    exp.lockpickTarget=12+((exp.lockpickAttempts*23+exp.cuffPins*17)%67);
    saveNow();root.renderGovernmentConsequence();
  }
  function beginGovernmentQuestioning(){
    const program=programState();if(!program||program.path==="ROGUE")return;
    program.consequenceStage="QUESTIONING";program.questioningStep=0;program.questioningScore=0;program.status="DETAINED";
    program.experience={cuffPins:0,cuffUnlocked:false,lockpickTarget:38,lockpickAttempts:0,answers:[],hearingAttempts:0,notice:"",escape:null,rehab:null,rehabResult:""};
    saveNow();root.renderGovernmentConsequence();
  }
  function answerGovernmentQuestion(choiceIndex=0){
    const program=programState();if(!program||program.consequenceStage!=="QUESTIONING")return;
    const exp=governmentExperience(program);const step=clampLocal(Math.floor(Number(program.questioningStep||0)),0,QUESTIONS.length-1);const question=QUESTIONS[step];
    const index=typeof choiceIndex==="boolean"?(choiceIndex?0:1):clampLocal(Math.floor(Number(choiceIndex||0)),0,3);
    const choice=question.choices[index];
    exp.answers[step]={index,correct:choice.correct,trust:choice.trust};
    root.S.trust=clampLocal(Number(root.S.trust||0)+choice.trust,0,100);
    program.reviewPoints=clampLocal(Number(program.reviewPoints||0)+(choice.correct?-3:5),0,100);
    program.questioningScore=exp.answers.filter((answer)=>answer?.correct).length*2;
    program.questioningStep=step+1;
    exp.notice=choice.correct?`Responsible answer: government trust ${choice.trust>=0?"+":""}${choice.trust}.`:`Unsafe answer: government trust ${choice.trust}.`;
    if(program.questioningStep>=QUESTIONS.length){
      if(answerOutcome(exp.answers)){
        program.questioningStep=3;program.consequenceStage="REHABILITATION";program.rehabilitationStep=0;program.rehabilitationTaskStep=0;program.status="REHABILITATION";exp.rehab=null;exp.rehabResult="";exp.notice="All answers passed. Three playable rehabilitation missions are now required.";
      }else{
        exp.hearingAttempts+=1;program.questioningStep=0;program.questioningScore=0;exp.answers=[];exp.notice="The panel did not approve those answers. The hearing restarts—choose the safest rescue response each time.";
      }
    }
    saveNow();root.renderGovernmentConsequence();
  }
  function chooseGovernmentRun(){
    const program=programState();if(!program||program.consequenceStage!=="QUESTIONING")return;
    const exp=governmentExperience(program);if(!exp.cuffUnlocked)return notify("Unlock the handcuffs before attempting to run.",{warn:true});
    program.consequenceStage="ESCAPE";program.status="DETAINED";
    exp.escape={x:0,y:4,caught:0,moves:0,notice:"The interview-room door is open. Reach the green exit without stepping onto an officer."};
    saveNow();root.renderGovernmentConsequence();
  }
  function escapeGridHtml(exp){
    const escape=exp.escape||{x:0,y:4};const walls=["1,3","2,3","4,1","4,2"];const guards=["3,2","5,1"];const cells=[];
    for(let y=0;y<GRID_H;y++)for(let x=0;x<GRID_W;x++){
      const key=cellKey(x,y);const icons=[];let cls="";
      if(walls.includes(key))cls="wall";if(key==="6,0"){cls="exit";icons.push("🚪");}if(guards.includes(key))icons.push("👮🏾");if(x===escape.x&&y===escape.y)icons.push("🪖");
      cells.push(`<div class="governmentGridCell ${cls}"><span class="stack">${icons.join("")}</span></div>`);
    }
    return `<div class="governmentSceneTitle">Detention Wing • Service Corridor</div><div class="governmentGrid">${cells.join("")}</div><div class="small">🪖 You • 👮🏾 Officer • 🚪 Exit • striped cells are blocked</div>`;
  }
  function movementPadHtml(handler){return `<div class="governmentMovePad"><button class="ghost up" onclick="${handler}(0,-1)">▲</button><button class="ghost left" onclick="${handler}(-1,0)">◀</button><button class="ghost down" onclick="${handler}(0,1)">▼</button><button class="ghost right" onclick="${handler}(1,0)">▶</button></div>`;}
  function moveGovernmentEscape(dx,dy){
    const program=programState();if(!program||program.consequenceStage!=="ESCAPE")return;
    const exp=governmentExperience(program);if(!exp.escape)exp.escape={x:0,y:4,caught:0,moves:0,notice:"Escape started."};
    const walls=["1,3","2,3","4,1","4,2"];const guards=["3,2","5,1"];
    const next=moveCell(exp.escape,dx,dy,walls);
    exp.escape.x=next.x;exp.escape.y=next.y;exp.escape.moves+=1;
    if(next.blocked)exp.escape.notice="That corridor is blocked. Find another route.";
    else if(guards.includes(cellKey(next.x,next.y))){exp.escape.x=0;exp.escape.y=4;exp.escape.caught+=1;exp.escape.notice="An officer stopped you. You slipped free and returned to the interview-room doorway.";}
    else exp.escape.notice="Keep moving toward the green exit.";
    if(exp.escape.x===6&&exp.escape.y===0)return finishGovernmentEscape();
    saveNow();root.renderGovernmentConsequence();
  }
  function finishGovernmentEscape(){
    const program=programState();if(!program)return;
    program.path="ROGUE";program.consequenceStage="CLEAR";program.status="GONE_ROGUE";program.rogueSince=Date.now();program.lastResolution="Picked the detention cuffs, escaped the interrogation wing, and entered GONE ROGUE status.";program.activeCaseId=program.activeCaseId||`ROGUE-${Date.now().toString(36).toUpperCase().slice(-6)}`;root.S.trust=Math.min(Math.round(Number(root.S.trust||0)),15);saveNow();notify("GONE ROGUE: the detention escape succeeded. Government response squads are now active.",{warn:true});root.renderGovernmentConsequence();root.renderGovernmentProgramCard?.();
  }
  function beginGovernmentEscape(){
    const program=programState();if(!program||program.path==="ROGUE")return;
    program.consequenceStage="QUESTIONING";program.status="DETAINED";const exp=governmentExperience(program);exp.notice="You must pick the handcuffs inside the interrogation room before Run becomes available.";saveNow();root.renderGovernmentConsequence();
  }

  const REHAB_WALLS=["2,1","2,2","4,3"];
  function newRehabState(index){
    if(index===0)return{mission:0,active:true,x:0,y:4,tiger:{x:5,y:1,hp:100,hpMax:100,tranq:false,caged:false},notice:"Move within two squares of the tiger."};
    if(index===1)return{mission:1,active:true,x:0,y:4,civilian:{x:1,y:4},evac:{x:6,y:0},notice:"Move beside the civilian. They will follow one step behind you."};
    return{mission:2,active:true,x:0,y:4,cage:{x:3,y:2,inspected:false,tagged:false,attached:false},truck:{x:6,y:0},notice:"Reach the cage and inspect it."};
  }
  function startGovernmentRehabilitationMission(){
    const program=programState();if(!program||program.consequenceStage!=="REHABILITATION")return;
    const exp=governmentExperience(program);const index=clampLocal(Math.floor(Number(program.rehabilitationStep||0)),0,2);exp.rehab=newRehabState(index);exp.rehabResult="";saveNow();root.renderGovernmentConsequence();
  }
  function trainingGridHtml(rehab){
    const cells=[];const walls=REHAB_WALLS;
    for(let y=0;y<GRID_H;y++)for(let x=0;x<GRID_W;x++){
      const key=cellKey(x,y);const icons=[];let cls=walls.includes(key)?"wall":"";
      if(rehab.mission===0&&x===rehab.tiger.x&&y===rehab.tiger.y)icons.push(rehab.tiger.caged?"🔒":"🐅");
      if(rehab.mission===1&&x===rehab.civilian.x&&y===rehab.civilian.y)icons.push("🧑🏽");
      if(rehab.mission===1&&x===rehab.evac.x&&y===rehab.evac.y){cls="evac";icons.push("✅");}
      if(rehab.mission===2&&x===rehab.cage.x&&y===rehab.cage.y)icons.push("🦁");
      if(rehab.mission===2&&x===rehab.truck.x&&y===rehab.truck.y){cls="truck";icons.push("🚛");}
      if(x===rehab.x&&y===rehab.y)icons.push("🪖");
      cells.push(`<div class="governmentGridCell ${cls}"><span class="stack">${icons.join("")}</span></div>`);
    }
    return `<div class="governmentGrid">${cells.join("")}</div>`;
  }
  function rehabActionHtml(rehab){
    if(rehab.mission===0){
      return `<div class="trainingMeters"><div class="trainingMeter"><b>Tiger HP</b><br>${Math.round(rehab.tiger.hp)}/${rehab.tiger.hpMax}</div><div class="trainingMeter"><b>Capture state</b><br>${rehab.tiger.caged?"Caged":(rehab.tiger.tranq?"Tranq applied":(rehab.tiger.hp<=30?"Ready for Tranq":"Weaken with Rubber"))}</div></div><div class="row"><button class="warn" onclick="governmentTrainingAction('rubber')">🟡 Rubber Shot</button><button class="good" onclick="governmentTrainingAction('tranq')">💉 Apply Tranq</button><button class="good" onclick="governmentTrainingAction('cage')">🔒 Secure Cage</button></div>`;
    }
    if(rehab.mission===2){
      const label=!rehab.cage.inspected?"Inspect Cage":(!rehab.cage.tagged?"Tag Cage":(!rehab.cage.attached?"Attach Cage":"Load on Truck"));
      return `<div class="row"><button class="good" onclick="governmentTrainingAction('transfer')">${escapeHtml(label)}</button><span class="tag">${rehab.cage.inspected?"✓ inspected":"inspect"} • ${rehab.cage.tagged?"✓ tagged":"tag"} • ${rehab.cage.attached?"✓ attached":"attach"}</span></div>`;
    }
    return `<div class="small">The civilian follows only while you stay close. Lead them into the green evacuation square.</div>`;
  }
  function moveGovernmentTraining(dx,dy){
    const program=programState();if(!program||program.consequenceStage!=="REHABILITATION")return;
    const exp=governmentExperience(program);const rehab=exp.rehab;if(!rehab?.active)return;
    const before={x:rehab.x,y:rehab.y};const next=moveCell(rehab,dx,dy,REHAB_WALLS);rehab.x=next.x;rehab.y=next.y;
    if(next.blocked)rehab.notice="Training barrier blocked that route.";
    if(rehab.mission===1){
      if(distance(before,rehab.civilian)<=1.5){rehab.civilian.x=before.x;rehab.civilian.y=before.y;rehab.notice="Civilian following. Continue to the green evacuation zone.";}
      else rehab.notice="You moved too far away. Return beside the civilian.";
      if(distance(rehab.civilian,rehab.evac)<=.1){return completeGovernmentTrainingMission("Civilian escorted safely through the marked route.");}
    }
    if(rehab.mission===2&&rehab.cage.attached){rehab.cage.x=before.x;rehab.cage.y=before.y;rehab.notice="Cage attached. Tow it beside the conservation truck.";}
    saveNow();root.renderGovernmentConsequence();
  }
  function governmentTrainingAction(action){
    const program=programState();if(!program||program.consequenceStage!=="REHABILITATION")return;
    const exp=governmentExperience(program);const rehab=exp.rehab;if(!rehab?.active)return;
    if(rehab.mission===0){
      if(distance(rehab,rehab.tiger)>2.25){rehab.notice="Move closer. Training weapons are locked outside the marked range.";saveNow();return root.renderGovernmentConsequence();}
      if(action==="rubber"){
        if(rehab.tiger.tranq){rehab.notice="Tranq is already applied. Secure the cage.";}
        else{rehab.tiger.hp=Math.max(18,rehab.tiger.hp-18);rehab.notice=rehab.tiger.hp<=30?"Capture window open. Apply Tranq now.":"Safe Rubber hit. Continue until HP is 30 or lower.";}
      }else if(action==="tranq"){
        if(rehab.tiger.hp>30)rehab.notice="Tiger HP is too high. Rubber rounds must open the capture window first.";
        else{rehab.tiger.tranq=true;rehab.notice="Tranq applied. Secure the tiger in its cage.";}
      }else if(action==="cage"){
        if(!rehab.tiger.tranq)rehab.notice="Capture is not ready. Weaken with Rubber and apply Tranq first.";
        else{rehab.tiger.caged=true;return completeGovernmentTrainingMission("Training tiger captured alive with no lethal injury.");}
      }
    }else if(rehab.mission===2&&action==="transfer"){
      const nearCage=distance(rehab,rehab.cage)<=1.25;const nearTruck=distance(rehab,rehab.truck)<=1.25&&distance(rehab.cage,rehab.truck)<=1.5;
      if(!rehab.cage.inspected){if(!nearCage)rehab.notice="Move beside the cage before inspecting it.";else{rehab.cage.inspected=true;rehab.notice="Cage inspected. Apply the wildlife transport tag.";}}
      else if(!rehab.cage.tagged){if(!nearCage)rehab.notice="Return beside the cage to attach its tag.";else{rehab.cage.tagged=true;rehab.notice="Transport tag verified. Attach the cage to your tow rig.";}}
      else if(!rehab.cage.attached){if(!nearCage)rehab.notice="Move beside the cage before attaching it.";else{rehab.cage.attached=true;rehab.notice="Cage attached. Tow it to the conservation truck.";}}
      else if(!nearTruck)rehab.notice="Bring both your soldier and the cage beside the truck.";
      else return completeGovernmentTrainingMission("Tagged cage loaded safely onto the conservation truck.");
    }
    saveNow();root.renderGovernmentConsequence();
  }
  function completeGovernmentTrainingMission(message){
    const program=programState();const exp=governmentExperience(program);if(!exp.rehab?.active)return;
    exp.rehab.active=false;exp.rehabResult=message;program.rehabilitationStep=Math.min(3,Number(program.rehabilitationStep||0)+1);program.rehabilitationTaskStep=0;
    if(program.rehabilitationStep>=3)return finishRehabilitationProgram();
    saveNow();root.renderGovernmentConsequence();
  }
  function finishRehabilitationProgram(){
    const program=programState();const exp=governmentExperience(program);program.rehabilitationStep=3;program.rehabilitationTaskStep=0;program.rehabilitationsCompleted=Math.max(0,Number(program.rehabilitationsCompleted||0))+1;program.reviewPoints=Math.min(Number(program.reviewPoints||0),18);root.S.trust=Math.max(Math.round(Number(root.S.trust||0)),78);program.path="PROGRAM";program.consequenceStage="CLEAR";program.activeCaseId="";program.caseOpenedAt=0;program.cleanMissionStreak=0;program.lastResolution=`Completed three playable rehabilitation missions ${new Date().toISOString()}`;program.status=typeof root.governmentStatusFor==="function"?root.governmentStatusFor(program.reviewPoints,root.S.trust):"GOOD_STANDING";exp.rehabResult="All three field certifications passed. Government rescue funding restored.";root.S.lastGovernmentAudit={runId:`rehab:${Date.now()}`,mode:"Government",exempt:false,status:program.status,statusLabel:"Good Standing",funding:0,reviewPoints:program.reviewPoints,reviewDelta:0,trust:root.S.trust,trustDelta:0,captures:1,kills:0,civDead:0,clean:true,caseId:""};saveNow();notify("Rehabilitation complete. Government standing and rescue funding restored.",{success:true});root.renderGovernmentConsequence();root.renderGovernmentProgramCard?.(root.S.lastGovernmentAudit);
  }
  function renderRehabilitation(body,actions,program,exp){
    const index=clampLocal(Math.floor(Number(program.rehabilitationStep||0)),0,2);const mission=REHAB_MISSIONS[index];const rehab=exp.rehab;
    if(!rehab?.active){
      body.innerHTML=`<div class="governmentStepKicker">Playable Rehabilitation Mission ${index+1} of 3</div><div class="governmentStepTitle">${escapeHtml(mission.title)}</div><div class="governmentStepText">${escapeHtml(mission.brief)}</div>${exp.rehabResult?`<div class="governmentDecisionWarning" style="margin-top:12px;border-color:#4ade80;background:rgba(20,83,45,.32)">${escapeHtml(exp.rehabResult)}</div>`:""}<div class="governmentScene"><div class="governmentSceneTitle">Federal Training Grounds</div><div style="display:grid;place-items:center;height:180px;font-size:70px">${index===0?"🪖　🐅":(index===1?"🪖　🧑🏽　✅":"🪖　🦁　🚛")}</div></div>`;
      actions.innerHTML=`<button class="good" onclick="startGovernmentRehabilitationMission()">Begin ${escapeHtml(mission.title)}</button><button class="ghost" onclick="closeGovernmentConsequence()">Save and Leave</button>`;return;
    }
    body.innerHTML=`<div class="governmentStepKicker">Playable Rehabilitation Mission ${index+1} of 3</div><div class="governmentStepTitle">${escapeHtml(mission.title)}</div><div class="governmentStepText">${escapeHtml(mission.brief)}</div>${trainingGridHtml(rehab)}<div class="governmentDecisionWarning" style="margin-top:8px;border-color:#60a5fa;background:rgba(30,58,138,.24)">${escapeHtml(rehab.notice||"")}</div>${movementPadHtml("moveGovernmentTraining")}${rehabActionHtml(rehab)}`;
    actions.innerHTML=`<button class="ghost" onclick="closeGovernmentConsequence()">Save Training Progress</button>`;
  }
  function renderGovernmentConsequence(){
    const body=document.getElementById("governmentConsequenceBody"),actions=document.getElementById("governmentConsequenceActions");if(!body||!actions)return;
    const program=programState();const exp=governmentExperience(program);const title=document.getElementById("governmentConsequenceTitle"),status=document.getElementById("governmentConsequenceStatus");
    if(title)title.textContent=program.path==="ROGUE"?"⚠️ GONE ROGUE":"🚔 Government Detention";
    if(status)status.textContent=`${program.status||"DETAINED"} • ${program.activeCaseId||"Case pending"} • Trust ${Math.round(Number(root.S.trust||0))}/100 • Review ${Math.round(Number(program.reviewPoints||0))}/100`;
    if(program.path==="ROGUE"){
      body.innerHTML=`<div class="governmentScene"><div class="governmentSceneTitle">Agency Alert • Fugitive Status</div><div style="display:grid;place-items:center;height:190px;font-size:72px">🪖　🚨　🚓</div></div><div class="governmentDecisionWarning"><b>You escaped detention and are now GONE ROGUE.</b><br>Government grants and official armory purchases are stopped. Armed response squads may enter future solo non-Survival missions. Story progress remains safe.</div>`;actions.innerHTML=`<button class="ghost" onclick="closeGovernmentConsequence()">Return</button>`;return;
    }
    if(program.consequenceStage==="QUESTIONING")return renderQuestioning(body,actions,program,exp);
    if(program.consequenceStage==="ESCAPE"){
      body.innerHTML=`<div class="governmentStepKicker">Interactive Detention Escape</div><div class="governmentStepTitle">Reach the Service Exit</div>${escapeGridHtml(exp)}<div class="governmentDecisionWarning">${escapeHtml(exp.escape?.notice||"")}</div>${movementPadHtml("moveGovernmentEscape")}<div class="small">Caught ${Math.max(0,Number(exp.escape?.caught||0))} time(s) • Moves ${Math.max(0,Number(exp.escape?.moves||0))}. GONE ROGUE begins only after you reach the exit.</div>`;actions.innerHTML=`<button class="ghost" onclick="closeGovernmentConsequence()">Save Escape Progress</button>`;return;
    }
    if(program.consequenceStage==="REHABILITATION")return renderRehabilitation(body,actions,program,exp);
    if(program.consequenceStage==="ESCAPE_CONFIRM"){program.consequenceStage="QUESTIONING";exp.notice="Escape now requires unlocking the handcuffs inside the interrogation room.";saveNow();return renderQuestioning(body,actions,program,exp);}
    body.innerHTML=`${roomSceneHtml(exp)}<div class="governmentDecisionWarning"><b>Funding is suspended and deployment is on hold.</b><br>Enter the interrogation room. You must answer all three questions correctly to begin rehabilitation. A hidden escape path exists, but it requires actually picking the handcuffs first.</div>`;
    actions.innerHTML=`<button class="good" onclick="beginGovernmentQuestioning()">Enter Interrogation Room</button><button class="ghost" onclick="closeGovernmentConsequence()">Decide Later</button>`;
  }

  const api={SECONDARY_DEFS,QUESTIONS,REHAB_MISSIONS,selectedSecondaryId,ensureMissionSecondary,resetMissionSecondaryForMission,useSelectedMissionSecondary,renderSecondaryHud,drawMissionSecondaryEffects,moveCell,answerOutcome};
  root.TigerFieldSystems=api;
  root.useSelectedMissionSecondary=useSelectedMissionSecondary;
  root.renderGovernmentConsequence=renderGovernmentConsequence;
  root.beginGovernmentQuestioning=beginGovernmentQuestioning;
  root.answerGovernmentQuestion=answerGovernmentQuestion;
  root.attemptGovernmentLockpick=attemptGovernmentLockpick;
  root.chooseGovernmentRun=chooseGovernmentRun;
  root.beginGovernmentEscape=beginGovernmentEscape;
  root.confirmGovernmentEscape=chooseGovernmentRun;
  root.moveGovernmentEscape=moveGovernmentEscape;
  root.advanceGovernmentEscape=()=>notify("Use the arrow controls and physically reach the service exit.",{warn:true});
  root.startGovernmentRehabilitationMission=startGovernmentRehabilitationMission;
  root.moveGovernmentTraining=moveGovernmentTraining;
  root.governmentTrainingAction=governmentTrainingAction;
  root.completeGovernmentRehabilitationStep=()=>notify("Rehabilitation progress now comes only from completing the playable training mission.",{warn:true});
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
