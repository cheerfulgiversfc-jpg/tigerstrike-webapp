(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerWaitingPractice=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';let current=null;
 function create(){return {x:170,y:225,aimX:470,aimY:205,shots:0,hits:0,lastShot:-1000,flashUntil:0};}
 function step(p,input,dt){const x=Number(input.x)||0,y=Number(input.y)||0,n=Math.max(1,Math.hypot(x,y)),s=130*Math.min(.05,Math.max(0,Number(dt)||0));p.x=Math.max(55,Math.min(550,p.x+x/n*s));p.y=Math.max(100,Math.min(285,p.y+y/n*s));return p;}
 function fire(p,now){if(now-p.lastShot<560)return false;p.lastShot=now;p.shots++;p.flashUntil=now+120;const aim=Math.atan2(p.aimY-p.y,p.aimX-p.x),target=Math.atan2(205-p.y,470-p.x),diff=Math.atan2(Math.sin(aim-target),Math.cos(aim-target));if(Math.abs(diff)<.18&&Math.hypot(470-p.x,205-p.y)<420)p.hits++;return true;}
 function close(){current?.dialog.close();}
 function observe(info){current?.observe(info);}
 function open(options={}){
  if(typeof document==='undefined'||current)return false;
  const initial=options.status();if(initial?.status!=='waiting')return false;
  const player=create(),gear=JSON.parse(JSON.stringify(options.loadout||{})),keys=new Set(),move={x:0,y:0};let firing=false,frame=0,last=0,lastDraw=0,busy=false,practiceError='';
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const dialog=el('dialog');dialog.id='waitingPracticeDialog';dialog.setAttribute('aria-labelledby','waitingPracticeTitle');
  const header=el('header'),title=el('h2','Practice while waiting'),exit=el('button','Return to squad');title.id='waitingPracticeTitle';header.append(title,exit);dialog.append(header);
  const status=el('p'),notice=el('p');status.setAttribute('role','status');notice.setAttribute('aria-live','polite');const info=el('div');info.append(title,status,notice);header.prepend(info);dialog.append(el('p',`${gear.weaponName||'Equipped weapon'} • ${gear.ammoMode==='real'?'Real':gear.ammoMode==='tranq'?'Tranq':'Rubber'} practice feedback. Unlimited training shots. Mission supplies and rewards are untouched.`));
  const canvas=el('canvas');canvas.width=1200;canvas.height=720;canvas.tabIndex=0;canvas.setAttribute('aria-label','Safe practice battlefield. Use the joystick or WASD to move; tap the map to aim.');dialog.append(canvas);
  const controls=el('div');controls.className='waitingPracticeControls';const joystick=el('div');joystick.className='waitingPracticeJoystick';joystick.setAttribute('aria-label','Practice movement joystick');const knob=el('span');joystick.append(knob);
  const shoot=el('button','Fire practice shot'),ready=el('button','I’m ready'),start=el('button','Start mission'),solo=el('button','Leave queue • Solo setup');controls.append(joystick,shoot,ready,start,solo);dialog.append(controls,el('p','Move with the joystick or WASD/arrows. Tap the map to aim, then fire. This training tiger cannot be killed or captured. Practice ends when the real mission starts.'));
  let roomCode=initial.code;function update(info){
    if(info?.code!==roomCode||info.status!=='waiting'){dialog.close();return;}
    status.textContent=`${info.mission} • ${info.memberCount}/${info.targetCount||2} players • ${info.onlineCount}/${info.targetCount||2} online${info.targetCount===1?'':` • ${info.readyCount}/2 ready`}`;
    const message=practiceError||info.notice||'';if(notice.textContent!==message)notice.textContent=message;
    ready.hidden=info.targetCount===1;ready.textContent=info.mineReady?'Not ready':'I’m ready';ready.disabled=busy||info.readyVersion!==1||info.memberCount<2||info.onlineCount<2;
    solo.textContent=info.soloLabel||'Leave queue • Solo setup';start.hidden=!info.isHost;start.disabled=busy||!info.canStart;solo.hidden=!info.canSolo;}
  async function run(fn){if(busy)return;busy=true;practiceError='';update(options.status());notice.textContent='Updating squad…';try{await fn?.();}catch(e){practiceError=e.message;}finally{busy=false;if(current)update(options.status());}}
  ready.onclick=()=>run(options.ready);start.onclick=()=>run(options.start);solo.onclick=()=>run(options.solo);exit.onclick=()=>dialog.close();
  let pointer=null;function release(){pointer=null;move.x=move.y=0;knob.style.transform='translate(0px,0px)';}
  function drag(e){if(pointer!==e.pointerId)return;const r=joystick.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,n=Math.max(36,Math.hypot(dx,dy));move.x=dx/n;move.y=dy/n;knob.style.transform=`translate(${move.x*36}px,${move.y*36}px)`;}
  joystick.onpointerdown=e=>{e.preventDefault();pointer=e.pointerId;joystick.setPointerCapture(pointer);drag(e);};joystick.onpointermove=drag;joystick.onpointerup=joystick.onpointercancel=release;
  canvas.onpointerdown=e=>{const r=canvas.getBoundingClientRect();player.aimX=(e.clientX-r.left)/r.width*600;player.aimY=(e.clientY-r.top)/r.height*360;canvas.focus();};
  shoot.onpointerdown=e=>{e.preventDefault();shoot.setPointerCapture(e.pointerId);firing=true;fire(player,performance.now());};shoot.onpointerup=shoot.onpointercancel=()=>firing=false;shoot.onclick=()=>fire(player,performance.now());
  const reset=()=>{keys.clear();release();firing=false;};window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  dialog.addEventListener('keydown',e=>{e.stopPropagation();const k=e.key.toLowerCase();if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){e.preventDefault();keys.add(k);}if(k===' '&&e.target.tagName!=='BUTTON'){e.preventDefault();fire(player,performance.now());}});dialog.addEventListener('keyup',e=>{e.stopPropagation();keys.delete(e.key.toLowerCase());});
  function draw(now){if(!dialog.open)return;frame=requestAnimationFrame(draw);const dt=last?(now-last)/1000:0;last=now;if(document.hidden)return;step(player,{x:move.x+Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),y:move.y+Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'))},dt);if(firing)fire(player,now);if(now-lastDraw<32)return;lastDraw=now;
    const c=canvas.getContext('2d'),R=window.TigerStrikeBattlefieldRenderer;c.save();c.clearRect(0,0,1200,720);c.scale(2,2);window.TigerShowcaseScene.backdrop(c,{width:600,height:360,now,clear:[{x:player.x,y:player.y,r:65},{x:470,y:205,r:70}]});
    const face=Math.atan2(player.aimY-player.y,player.aimX-player.x);R.drawTiger(c,{x:470,y:205,face:Math.PI,hp:100,hpMax:100},{now,scale:1.35,facing:player.x<470?-1:1});R.drawSoldier(c,{x:player.x,y:player.y,face,eliteAppearance:gear.eliteAppearance||{}},{now,scale:1.6,walking:Math.abs(move.x)+Math.abs(move.y)+keys.size>0,phase:now/130,shotKick:now<player.flashUntil?1:0,showMarker:false,uniformPalette:gear.uniformPalette});
    if(now<player.flashUntil){c.strokeStyle=gear.ammoMode==='real'?'#ffab8e':gear.ammoMode==='tranq'?'#8ff0ea':'#ffe17d';c.lineWidth=3;c.beginPath();c.moveTo(player.x+Math.cos(face)*32,player.y-16);c.lineTo(player.aimX,player.aimY);c.stroke();}
    c.fillStyle='#081c2be8';c.fillRect(12,12,576,40);c.fillStyle='#eef8ef';c.font='bold 15px system-ui';c.fillText(`PRACTICE ONLY • ${player.shots} shots • ${player.hits} target hits`,24,37);c.font='13px system-ui';c.fillStyle='#fff2c4';c.fillText('Training tiger • unlimited practice',365,270);c.restore();}
  current={dialog,observe:update};dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);reset();window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);current=null;dialog.remove();options.onClose?.();},{once:true});document.body.append(dialog);dialog.showModal();update(initial);canvas.focus();frame=requestAnimationFrame(draw);return true;
 }
 return Object.freeze({create,step,fire,open,observe,close});
});
