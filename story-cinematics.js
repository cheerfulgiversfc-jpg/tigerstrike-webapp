(function(root){
  "use strict";

  const MOVIE_ID="story:campaign:1:opening";
  const DURATION=25500;
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
  function rounded(context,x,y,w,h,r){
    const radius=Math.min(r,w/2,h/2);context.beginPath();context.moveTo(x+radius,y);context.arcTo(x+w,y,x+w,y+h,radius);context.arcTo(x+w,y+h,x,y+h,radius);context.arcTo(x,y+h,x,y,radius);context.arcTo(x,y,x+w,y,radius);context.closePath();
  }
  function drawHouse(c,x,y,scale=1,lights=false){
    c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle="rgba(0,0,0,.22)";c.fillRect(-60,34,120,12);c.fillStyle="#f2d3a0";rounded(c,-55,-24,110,66,6);c.fill();c.fillStyle="#9a4d2e";c.beginPath();c.moveTo(-66,-22);c.lineTo(0,-68);c.lineTo(66,-22);c.closePath();c.fill();c.fillStyle="#6b3b25";c.fillRect(-12,6,24,36);c.fillStyle=lights?"#fde68a":"#93c5fd";c.fillRect(-43,-7,23,20);c.fillRect(22,-7,23,20);c.restore();
  }
  function drawTree(c,x,y,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle="#6b4423";c.fillRect(-7,12,14,42);c.fillStyle="#0f6b3f";c.beginPath();c.arc(-18,2,25,0,Math.PI*2);c.arc(15,-5,29,0,Math.PI*2);c.arc(0,-25,27,0,Math.PI*2);c.fill();c.fillStyle="#22c55e";c.beginPath();c.arc(5,-29,16,0,Math.PI*2);c.fill();c.restore();
  }
  function drawCivilian(c,x,y,scale=1,run=0,color="#f59e0b"){
    c.save();c.translate(x,y);c.scale(scale,scale);c.lineCap="round";c.strokeStyle="#172033";c.lineWidth=7;c.beginPath();c.moveTo(0,21);c.lineTo(-9+run*8,43);c.moveTo(1,21);c.lineTo(12-run*8,43);c.stroke();c.fillStyle=color;rounded(c,-15,-8,30,34,8);c.fill();c.strokeStyle="#d99b6c";c.lineWidth=6;c.beginPath();c.moveTo(-13,2);c.lineTo(-25-run*7,21);c.moveTo(13,2);c.lineTo(25+run*7,18);c.stroke();c.fillStyle="#b77950";c.beginPath();c.arc(0,-21,13,0,Math.PI*2);c.fill();c.fillStyle="#18212f";c.beginPath();c.arc(0,-25,13,Math.PI,Math.PI*2);c.fill();c.fillStyle="#111827";c.beginPath();c.arc(-4,-21,1.8,0,Math.PI*2);c.arc(4,-21,1.8,0,Math.PI*2);c.fill();c.strokeStyle="#5b2d24";c.lineWidth=1.8;c.beginPath();c.arc(0,-16,4,.15,Math.PI-.15);c.stroke();c.restore();
  }
  function drawSoldier(c,x,y,scale=1,run=0,uniform="#3f5c35"){
    c.save();c.translate(x,y);c.scale(scale,scale);c.lineCap="round";c.strokeStyle="#18212f";c.lineWidth=8;c.beginPath();c.moveTo(-5,22);c.lineTo(-13+run*7,49);c.moveTo(6,22);c.lineTo(14-run*7,49);c.stroke();c.fillStyle=uniform;rounded(c,-18,-12,36,42,8);c.fill();c.fillStyle="#202c20";c.fillRect(-18,9,36,8);c.strokeStyle="#1f2937";c.lineWidth=7;c.beginPath();c.moveTo(-10,0);c.lineTo(-29-run*4,22);c.moveTo(11,1);c.lineTo(30+run*4,18);c.stroke();c.fillStyle="#a87352";c.beginPath();c.arc(0,-26,14,0,Math.PI*2);c.fill();c.fillStyle="#40523a";c.beginPath();c.arc(0,-31,17,Math.PI,Math.PI*2);c.lineTo(17,-27);c.lineTo(-17,-27);c.closePath();c.fill();c.fillStyle="#0f172a";c.beginPath();c.arc(-4,-25,1.8,0,Math.PI*2);c.arc(4,-25,1.8,0,Math.PI*2);c.fill();c.strokeStyle="#5b2d24";c.lineWidth=1.8;c.beginPath();c.moveTo(-3,-19);c.quadraticCurveTo(0,-17,3,-19);c.stroke();c.strokeStyle="#111827";c.lineWidth=6;c.beginPath();c.moveTo(9,4);c.lineTo(39,11);c.stroke();c.restore();
  }
  function drawTiger(c,x,y,scale=1,step=0,direction=1){
    c.save();c.translate(x,y);c.scale(scale*(direction<0?-1:1),scale);const leg=Math.sin(step)*7;c.strokeStyle="#e97817";c.lineWidth=12;c.lineCap="round";c.beginPath();c.moveTo(-22,18);c.lineTo(-29+leg,43);c.moveTo(20,18);c.lineTo(28-leg,43);c.stroke();c.fillStyle="#f38b20";c.beginPath();c.ellipse(0,0,53,29,0,0,Math.PI*2);c.fill();c.beginPath();c.arc(48,-10,25,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(35,-29);c.lineTo(41,-48);c.lineTo(54,-31);c.moveTo(53,-31);c.lineTo(67,-47);c.lineTo(70,-23);c.fill();c.strokeStyle="#de7814";c.lineWidth=10;c.beginPath();c.moveTo(-47,-5);c.quadraticCurveTo(-88,-22,-82,17);c.stroke();c.strokeStyle="#1f2937";c.lineWidth=5;[-30,-12,7,25].forEach((stripe)=>{c.beginPath();c.moveTo(stripe,-21);c.lineTo(stripe+7,10);c.stroke();});c.lineWidth=3;c.beginPath();c.moveTo(41,-23);c.lineTo(49,-6);c.moveTo(57,-27);c.lineTo(58,-8);c.stroke();c.fillStyle="#fff7ed";c.beginPath();c.ellipse(61,0,14,10,0,0,Math.PI*2);c.fill();c.fillStyle="#111827";c.beginPath();c.arc(58,-14,3,0,Math.PI*2);c.arc(72,-1,3,0,Math.PI*2);c.fill();c.strokeStyle="#7f1d1d";c.lineWidth=2;c.beginPath();c.moveTo(64,5);c.quadraticCurveTo(70,10,77,5);c.stroke();c.restore();
  }
  function drawHelicopter(c,x,y,scale=1){
    c.save();c.translate(x,y);c.scale(scale,scale);c.strokeStyle="#111827";c.lineWidth=5;c.beginPath();c.moveTo(-70,-30);c.lineTo(54,-30);c.moveTo(-8,-29);c.lineTo(-8,-54);c.moveTo(-58,-54);c.lineTo(43,-54);c.stroke();c.fillStyle="#334a3a";c.beginPath();c.ellipse(0,0,58,27,0,0,Math.PI*2);c.fill();c.fillRect(48,-8,75,13);c.fillStyle="#6b8c78";c.beginPath();c.moveTo(118,-8);c.lineTo(142,-30);c.lineTo(136,15);c.closePath();c.fill();c.fillStyle="#93c5fd";c.beginPath();c.ellipse(22,-5,24,15,0,Math.PI,Math.PI*2);c.fill();c.strokeStyle="#1f2937";c.lineWidth=4;c.beginPath();c.moveTo(-30,22);c.lineTo(-38,39);c.lineTo(35,39);c.lineTo(29,23);c.stroke();c.restore();
  }
  function drawScene(context,elapsed){
    const c=context,w=c.canvas.width,h=c.canvas.height,scene=sceneAt(elapsed),p=sceneProgress(scene,elapsed);c.clearRect(0,0,w,h);
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,scene.id==="dawn"?"#f59e72":"#60a5fa");sky.addColorStop(.45,"#bae6fd");sky.addColorStop(.46,"#38a169");sky.addColorStop(1,"#166534");c.fillStyle=sky;c.fillRect(0,0,w,h);
    c.fillStyle="rgba(255,244,194,.86)";c.beginPath();c.arc(130,82,38,0,Math.PI*2);c.fill();
    c.fillStyle="#246b3e";for(let x=-30;x<w+60;x+=115)c.fillRect(x,265,92,165);
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
    const player=el("storyMoviePlayer"),staticHero=el("missionCinemaStaticHero"),grid=el("missionCinemaGrid"),timeline=el("missionCinemaTimeline"),replay=el("storyMovieReplayBtn");const active=supports(card);
    if(player)player.style.display=active?"block":"none";if(staticHero)staticHero.style.display=active?"none":"block";if(grid)grid.style.display=active?"none":"grid";if(timeline)timeline.style.display=active?"none":"grid";if(replay)replay.style.display=active?"inline-flex":"none";
    return active;
  }
  function open(card){
    stop();if(!mount(card))return false;const canvas=el("storyMovieCanvas");if(!canvas)return false;const context=canvas.getContext("2d");runtime={card,context,startedAt:performance.now(),paused:false,pauseElapsed:0,ended:false,sceneId:"",frame:0};
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

  const api={MOVIE_ID,DURATION,SCENES,supports,sceneAt,sceneProgress,mount,open,stop,toggle,replay,drawScene};
  root.TigerStoryCinema=api;root.toggleStoryMoviePlayback=toggle;root.replayCurrentStoryMovie=replay;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
