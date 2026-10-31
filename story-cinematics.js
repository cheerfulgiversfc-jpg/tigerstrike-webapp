(function(root){
  "use strict";

  const MOVIE_ID="story:campaign:1:opening";
  const DURATION=25500;
  const TAP_DEDUPE_MS=260;
  const SCENES=Object.freeze([
    Object.freeze({id:"dawn",start:0,end:4200,kicker:"BORDER JUNGLE • 06:12 AM",caption:"The village woke to another quiet morning at the edge of tiger country."}),
    Object.freeze({id:"patrol",start:4200,end:8500,kicker:"EASTERN VILLAGE ROAD",caption:"Villager: “The rescue patrol said this road was safe.”"}),
    Object.freeze({id:"attack",start:8500,end:14000,kicker:"EMERGENCY CHANNEL OPEN",caption:"Village radio: “Mayday! A tiger is inside the village—people are trapped!”"}),
    Object.freeze({id:"arrival",start:14000,end:20000,kicker:"TIGER STRIKE RESPONSE",caption:"Commander Vale: “Tiger Strike team, protect the civilians. Use nonlethal force if you can.”"}),
    Object.freeze({id:"mission",start:20000,end:DURATION,kicker:"MISSION 1 • FIRST RESPONSE",caption:"Escort both villagers to safety, then secure the tiger threat."}),
  ]);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
  const lerp=(a,b,t)=>a+(b-a)*clamp(t,0,1);
  const ease=(t)=>{const n=clamp(t,0,1);return n*n*(3-2*n);};
  const sceneAt=(elapsed)=>SCENES.find((scene)=>elapsed>=scene.start&&elapsed<scene.end)||SCENES[SCENES.length-1];
  const sceneProgress=(scene,elapsed)=>clamp((elapsed-scene.start)/Math.max(1,scene.end-scene.start),0,1);
  let runtime=null;

  function supports(card){
    const mission=card?.mission||{};
    const variant=String(mission.storyVariant||root.S?.storyVariant||"Campaign").toLowerCase();
    return card?.mode==="Story"&&Number(mission.number||0)===1&&(variant.includes("campaign")||variant.includes("story"));
  }
  function el(id){return root.document?.getElementById(id)||null;}
  function consumeTapEvent(event){
    event?.preventDefault?.();
    event?.stopPropagation?.();
    event?.stopImmediatePropagation?.();
  }
  function bindTap(button,action){
    if(!button||button.dataset.storyCinemaTapBound==="1")return false;
    button.dataset.storyCinemaTapBound="1";
    button.style.touchAction="manipulation";
    button.style.pointerEvents="auto";
    let lastTapAt=0;
    const guard=(event)=>{
      if(button.disabled){consumeTapEvent(event);return;}
      const now=Date.now();
      if(now-lastTapAt<TAP_DEDUPE_MS){consumeTapEvent(event);return;}
      lastTapAt=now;
      consumeTapEvent(event);
      action();
    };
    const shield=(event)=>event?.stopPropagation?.();
    button.addEventListener("pointerdown",shield,{capture:true,passive:false});
    button.addEventListener("touchstart",shield,{capture:true,passive:true});
    button.addEventListener("pointerup",guard,{capture:true,passive:false});
    button.addEventListener("touchend",guard,{capture:true,passive:false});
    button.addEventListener("click",guard,{capture:true,passive:false});
    return true;
  }
  function bindControls(){
    const actions={
      storyMoviePlayBtn:()=>toggle(),
      storyMovieReplayBtn:()=>replay(),
      missionCinemaTopSkipBtn:()=>root.skipMissionCinematicIntro?.(),
      missionCinemaBottomSkipBtn:()=>root.skipMissionCinematicIntro?.(),
      missionCinemaContinueBtn:()=>root.continueMissionCinematicIntro?.(),
    };
    Object.entries(actions).forEach(([id,action])=>bindTap(el(id),action));
    const overlay=el("missionCinemaOverlay");
    if(overlay&&overlay.dataset.storyCinemaShieldBound!=="1"){
      overlay.dataset.storyCinemaShieldBound="1";
      overlay.style.pointerEvents="auto";
      overlay.style.touchAction="manipulation";
      ["pointerdown","pointerup","touchstart","touchend","click"].forEach((eventName)=>{
        overlay.addEventListener(eventName,(event)=>event.stopPropagation(),{passive:true});
      });
    }
    return Object.keys(actions).every((id)=>Boolean(el(id)?.dataset.storyCinemaTapBound));
  }
  function rounded(context,x,y,w,h,r){
    const radius=Math.min(r,w/2,h/2);context.beginPath();context.moveTo(x+radius,y);context.arcTo(x+w,y,x+w,y+h,radius);context.arcTo(x+w,y+h,x,y+h,radius);context.arcTo(x,y+h,x,y,radius);context.arcTo(x,y,x+w,y,radius);context.closePath();
  }
  function drawHouse(c,x,y,scale=1,lights=false){
    root.TigerStrikeBattlefieldRenderer.drawMapHouse(c,x-55*scale,y-24*scale,110*scale,66*scale,{roof:'#8f5437',roofRise:44*scale});
  }
  function drawTree(c,x,y,scale=1){root.TigerStrikeBattlefieldRenderer.drawMapTree(c,x,y+30*scale,scale*1.6);}
  function drawCivilian(c,x,y,scale=1,run=0,color="#f59e0b"){
    root.TigerStrikeBattlefieldRenderer.drawCivilian(c,{x,y:y+12*scale,face:Math.PI,shirt:color,look:'field'},{scale:scale*1.2,walking:true,phase:run*1.5});
  }
  function drawSoldier(c,x,y,scale=1,run=0,uniform="#3f5c35"){
    root.TigerStrikeBattlefieldRenderer.drawSoldier(c,{x,y:y+11*scale,face:0,eliteAppearance:root.TigerEliteArmory?.appearance()},{scale:scale*1.4,walking:true,phase:run*1.5,showMarker:false,uniformPalette:{body:uniform,light:'#86a287',dark:'#233b37',vest:'#2c4943',helmet:uniform,trim:'#d4d8a7'}});
  }
  function drawTiger(c,x,y,scale=1,step=0,direction=1){
    root.TigerStrikeBattlefieldRenderer.drawTiger(c,{id:'intro-tiger',x,y,face:direction<0?Math.PI:0,hp:100,hpMax:100},{scale:scale*1.4,facing:direction,walking:true,phase:step,now:step*130});
  }
  function drawHelicopter(c,x,y,scale=1){
    root.TigerStrikeBattlefieldRenderer.drawVehicle(c,{type:'helicopter',x,y},{scale:scale*1.25,now:typeof performance==='object'?performance.now():Date.now(),livery:root.TigerEliteArmory?.appearance().extraction});
  }
  function drawScene(context,elapsed){
    const c=context,w=c.canvas.width,h=c.canvas.height,scene=sceneAt(elapsed),p=sceneProgress(scene,elapsed);c.clearRect(0,0,w,h);
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,scene.id==="dawn"?"#f59e72":"#60a5fa");sky.addColorStop(.45,"#bae6fd");sky.addColorStop(.46,"#38a169");sky.addColorStop(1,"#166534");c.fillStyle=sky;c.fillRect(0,0,w,h);
    c.fillStyle="rgba(255,244,194,.86)";c.beginPath();c.arc(130,82,38,0,Math.PI*2);c.fill();
    root.TigerStrikeBattlefieldRenderer.drawGroundTexture(c,{x:0,y:235,w,h:h-235},{family:'forest'});
    for(let x=0;x<w;x+=130)root.TigerStrikeBattlefieldRenderer.drawMapTree(c,x,260,.65);
    drawTree(c,85,265,.8);drawTree(c,350,250,1);drawTree(c,850,245,.9);drawHouse(c,220,280,1.05,true);drawHouse(c,748,265,1.1,true);
    c.fillStyle="#475569";c.fillRect(0,360,w,145);c.strokeStyle="#facc15";c.lineWidth=6;c.setLineDash([36,26]);c.beginPath();c.moveTo(0,432);c.lineTo(w,432);c.stroke();c.setLineDash([]);
    c.fillStyle="#315a3c";c.fillRect(0,505,w,35);
    let civ1x=450,civ2x=535,tigerX=1080,heliX=-260,heliY=90;
    if(scene.id==="patrol"){civ1x=lerp(410,565,ease(p));civ2x=lerp(500,650,ease(p));}
    if(scene.id==="attack"){civ1x=lerp(565,300,ease(p));civ2x=lerp(650,375,ease(p));tigerX=lerp(1040,655,ease(Math.min(1,p*1.25)));}
    if(scene.id==="arrival"){civ1x=300;civ2x=375;tigerX=650;heliX=lerp(-240,640,ease(Math.min(1,p*1.3)));heliY=lerp(65,135,ease(p));}
    if(scene.id==="mission"){civ1x=290;civ2x=365;tigerX=700;heliX=lerp(640,1120,ease(p));heliY=lerp(135,70,ease(p));}
    drawCivilian(c,civ1x,390,1,Math.sin(elapsed/120),"#f59e0b");drawCivilian(c,civ2x,395,.94,-Math.sin(elapsed/115),"#38bdf8");
    if(scene.id==="attack"||scene.id==="arrival"||scene.id==="mission")drawTiger(c,tigerX,401,1.2,elapsed/130,-1);
    if(scene.id==="arrival"){
      drawHelicopter(c,heliX,heliY,.85);const drop1=ease((p-.28)/.38),drop2=ease((p-.46)/.38);const s1={x:lerp(heliX-28,500,drop1),y:lerp(heliY+48,390,drop1)},s2={x:lerp(heliX+34,565,drop2),y:lerp(heliY+48,394,drop2)};
      if(p>.28){if(drop1<.99){c.strokeStyle="#dbeafe";c.lineWidth=3;c.beginPath();c.moveTo(heliX-28,heliY+22);c.lineTo(s1.x,s1.y-46);c.stroke();}drawSoldier(c,s1.x,s1.y,1.05,Math.sin(elapsed/110),"#3f5c35");}
      if(p>.46){if(drop2<.99){c.strokeStyle="#dbeafe";c.lineWidth=3;c.beginPath();c.moveTo(heliX+34,heliY+22);c.lineTo(s2.x,s2.y-46);c.stroke();}drawSoldier(c,s2.x,s2.y,1.02,-Math.sin(elapsed/115),"#365f63");}
    }else if(scene.id==="mission"){
      drawHelicopter(c,heliX,heliY,.85);drawSoldier(c,500,390,1.08,Math.sin(elapsed/110),"#3f5c35");drawSoldier(c,565,394,1.04,-Math.sin(elapsed/115),"#365f63");
    }
    if(scene.id==="attack"){
      c.fillStyle=`rgba(239,68,68,${.09+.08*Math.sin(elapsed/120)})`;c.fillRect(0,0,w,h);c.fillStyle="#fee2e2";c.font="900 28px system-ui";c.textAlign="center";c.fillText("⚠ TIGER INSIDE THE VILLAGE",w/2,80);
    }
    if(scene.id==="mission"){
      const fade=ease(p);c.fillStyle=`rgba(3,7,18,${.28+.48*fade})`;c.fillRect(0,0,w,h);c.textAlign="center";c.fillStyle=`rgba(134,239,172,${fade})`;c.font="900 22px system-ui";c.fillText("TIGER STRIKE",w/2,170);c.fillStyle=`rgba(255,255,255,${fade})`;c.font="1000 57px system-ui";c.fillText("FIRST RESPONSE",w/2,235);c.fillStyle=`rgba(219,234,254,${fade})`;c.font="800 22px system-ui";c.fillText("MISSION 1",w/2,275);
    }
    c.fillStyle="rgba(0,0,0,.72)";c.fillRect(0,0,w,34);c.fillRect(0,h-34,w,34);
  }
  function updateUi(elapsed,force=false){
    if(!runtime)return;const scene=sceneAt(elapsed);if(force||runtime.sceneId!==scene.id){runtime.sceneId=scene.id;const kicker=el("storyMovieKicker"),caption=el("storyMovieCaption");if(kicker)kicker.textContent=scene.kicker;if(caption)caption.textContent=scene.caption;if(root.S?.soundOn){try{root.sfx?.(scene.id==="attack"?"danger":"ui");}catch(e){}}}
    const progress=el("storyMovieProgress");if(progress)progress.style.width=`${Math.round(clamp(elapsed/DURATION,0,1)*100)}%`;
    const time=el("storyMovieTime");if(time)time.textContent=`${Math.min(26,Math.floor(elapsed/1000)+1)} / 26 sec`;
  }
  function renderFrame(now){
    if(!runtime)return;const elapsed=runtime.ended?DURATION:(runtime.paused?runtime.pauseElapsed:clamp(now-runtime.startedAt,0,DURATION));drawScene(runtime.context,elapsed);updateUi(elapsed);
    if(elapsed>=DURATION&&!runtime.ended){runtime.ended=true;runtime.paused=true;runtime.pauseElapsed=DURATION;const play=el("storyMoviePlayBtn"),replayButton=el("storyMovieReplayBtn"),continueBtn=el("missionCinemaContinueBtn");if(play)play.textContent="▶ Watch Again";if(replayButton)replayButton.style.display="none";if(continueBtn)continueBtn.textContent="🎮 Start Mission";}
    runtime.frame=root.requestAnimationFrame?.(renderFrame)||0;
  }
  function mount(card){
    bindControls();
    const player=el("storyMoviePlayer"),staticHero=el("missionCinemaStaticHero"),grid=el("missionCinemaGrid"),timeline=el("missionCinemaTimeline"),replay=el("storyMovieReplayBtn");const active=supports(card);
    if(player)player.style.display=active?"block":"none";if(staticHero)staticHero.style.display=active?"none":"block";if(grid)grid.style.display=active?"none":"grid";if(timeline)timeline.style.display=active?"none":"grid";if(replay)replay.style.display=active?"inline-flex":"none";
    return active;
  }
  function open(card){
    stop();bindControls();if(!mount(card))return false;const canvas=el("storyMovieCanvas");if(!canvas)return false;const context=canvas.getContext("2d");runtime={card,context,startedAt:performance.now(),paused:false,pauseElapsed:0,ended:false,sceneId:"",frame:0};
    const continueBtn=el("missionCinemaContinueBtn"),play=el("storyMoviePlayBtn"),replayButton=el("storyMovieReplayBtn");if(continueBtn)continueBtn.textContent="🎮 Start Mission";if(play)play.textContent="⏸ Pause";if(replayButton)replayButton.style.display="inline-flex";
    if(root.S){root.S.storyCinematicsSeen=root.S.storyCinematicsSeen&&typeof root.S.storyCinematicsSeen==="object"?root.S.storyCinematicsSeen:{};root.S.storyCinematicsSeen[MOVIE_ID]=Date.now();try{root.save?.(true);}catch(e){}}
    updateUi(0,true);runtime.frame=root.requestAnimationFrame?.(renderFrame)||0;return true;
  }
  function stop(){if(runtime?.frame&&root.cancelAnimationFrame)root.cancelAnimationFrame(runtime.frame);runtime=null;}
  function toggle(){
    if(!runtime)return;if(runtime.ended){runtime.ended=false;runtime.paused=false;runtime.pauseElapsed=0;runtime.startedAt=performance.now();runtime.sceneId="";const button=el("storyMoviePlayBtn"),replayButton=el("storyMovieReplayBtn");if(button)button.textContent="⏸ Pause";if(replayButton)replayButton.style.display="inline-flex";return;}
    if(runtime.paused){runtime.paused=false;runtime.startedAt=performance.now()-runtime.pauseElapsed;}else{runtime.pauseElapsed=clamp(performance.now()-runtime.startedAt,0,DURATION);runtime.paused=true;}const button=el("storyMoviePlayBtn");if(button)button.textContent=runtime.paused?"▶ Play":"⏸ Pause";
  }
  function replay(){if(!runtime)return;runtime.ended=false;runtime.paused=false;runtime.pauseElapsed=0;runtime.startedAt=performance.now();runtime.sceneId="";const button=el("storyMoviePlayBtn"),replayButton=el("storyMovieReplayBtn");if(button)button.textContent="⏸ Pause";if(replayButton)replayButton.style.display="inline-flex";updateUi(0,true);}

  const api={MOVIE_ID,DURATION,TAP_DEDUPE_MS,SCENES,supports,sceneAt,sceneProgress,bindTap,bindControls,mount,open,stop,toggle,replay,drawScene};
  root.TigerStoryCinema=api;root.toggleStoryMoviePlayback=toggle;root.replayCurrentStoryMovie=replay;
  if(root.document?.readyState==="loading")root.document.addEventListener("DOMContentLoaded",bindControls,{once:true});else bindControls();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
