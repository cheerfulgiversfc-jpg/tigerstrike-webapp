(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./shared-battlefield-renderer'):root.TigerStrikeBattlefieldRenderer,typeof module==='object'&&module.exports?require('./chapter-maps'):root.TigerChapterMaps,typeof module==='object'&&module.exports?require('./water-terrain'):root.TigerWaterTerrain,typeof module==='object'&&module.exports?require('./elite-catalog'):root.TigerEliteCatalog,typeof module==='object'&&module.exports?require('./wildlife-tranq'):root.TigerWildlifeTranq,typeof module==='object'&&module.exports?require('./rescue-tools'):root.TigerRescueTools);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerShowcaseScene=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,maps,water,C,W,T){
  'use strict';
  function backdrop(c,options={}){
    const w=options.width||600,h=options.height||360,boat=options.type==='boat';
    const view={x:boat?600:1800,y:boat?2000:1100,w:1200,h:720};
    const clear=(options.clear||[]).map(p=>({x:view.x+p.x*2,y:view.y+p.y*2,r:(p.r||50)*2,objective:true}));
    c.save();c.scale(w/view.w,h/view.h);c.translate(-view.x,-view.y);
    R.drawStoryMapFoundation(c,{level:1,worldW:4800,worldH:2800,view,now:options.now,routesEnabled:false,fieldsEnabled:false,clearZones:clear,weather:'clear'});
    if(!boat){R.drawMapHouse(c,1890,1182,138,92,{roof:'#8f5437',roofRise:49});R.drawMapTree(c,2110,1180,1.7);R.drawMapTree(c,2880,1140,1.55);R.drawMapTree(c,2960,1670,1.5);}
    R.drawMapLighting(c,view);c.restore();return view;
  }
  function routeAt(x){const pts=[[0,1540],[1152,1344],[2256,1512],[3312,1176],[4800,1372]];for(let i=1;i<pts.length;i++)if(x<=pts[i][0]){const a=pts[i-1],b=pts[i],u=(x-a[0])/(b[0]-a[0]);return {y:a[1]+(b[1]-a[1])*u,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}return {y:1372,angle:0};}
  function draw(c,options={}){
    const w=600,h=360,now=Number(options.now)||0,current=options.current||'midnight',practice=!!options.practice,pos=options.pos||{x:140,y:190};
    if(current==='rescue_equipment')return drawEquipment(c,options);
    if(current==='commander_collection')return drawCollection(c,options);
    c.save();c.clearRect(0,0,c.canvas.width,c.canvas.height);c.scale(c.canvas.width/w,c.canvas.height/h);
    const elapsed=(now-Number(options.openedAt||0))/1000;
    if(current==='extraction'){
      const names=['helicopter','boat','truck'],type=options.vehicle||names[Math.floor(elapsed/6)%3],p=((elapsed%6)+6)%6/6;
      const view=backdrop(c,{width:w,height:h,type,now});let x=-95+p*790,y=185,angle=0;
      if(type==='boat'){const zone=maps.forMission(1).waterZones[0],wx=view.x+x*2,b=water.banks(zone,wx);y=(b.center-view.y)/2;angle=Math.atan2(water.banks(zone,wx+4).center-b.center,4);}
      else if(type==='truck'){const path=routeAt(view.x+x*2);y=(path.y-view.y)/2-23*1.65;angle=path.angle;}
      else y=190-Math.sin(p*Math.PI)*90;
      R.drawVehicle(c,{type,x,y,angle},{now,scale:type==='helicopter'?1.9:1.65,moving:true,livery:'extraction'});
      c.restore();return {type,x,y};
    }
    const sx=practice?pos.x:190,sy=(practice?pos.y:185)+35,tx=471,ty=195;
    backdrop(c,{width:w,height:h,now,clear:[{x:sx,y:sy,r:65},{x:tx,y:ty,r:70}]});
    const medic=current==='storm_medic',wildlife=current==='wildlife_tranq',cycle=((elapsed%6)+6)%6;const tranq=wildlife?(practice?options.practiceTranq:{hp:20,hpMax:100,ammo:3,captured:cycle>2.2,captureAt:now-Math.max(0,cycle-2.2)*1000,shotAt:now-(cycle-1.7)*1000,lastKind:'tranq'}):null;
    // The training target and actors are production models, with isolated visual state.
    let a={soldier:C.palettes[current]?current:(options.appearance?.soldier||''),weapon:current==='guardian'?'guardian':current==='recruit_finish'?'recruit_finish':wildlife?'wildlife_tranq':'',badge:current==='recruit_badge'?'recruit_badge':''};
    if(wildlife)a=W.presentation(a,{tranq:!(practice&&tranq.lastKind==='rubber'&&now-tranq.shotAt<350)});
    const fired=wildlife?(tranq.shotAt>0&&now-tranq.shotAt>=0&&now-tranq.shotAt<160):!medic&&(practice?now-Number(options.shot||-99999)<160:elapsed%2<.13);
    const face=Math.atan2(ty-sy,tx-sx),count=Number(options.hits)||0;
    if(medic){const hp=practice?Number(options.practiceDrone?.hp||34):82;R.drawCivilian(c,{x:tx,y:ty,hp,hpMax:100,injured:hp<100,look:'field',face:Math.PI},{now,scale:1.6,walking:false});if(!practice||now<Number(options.healUntil||0))R.drawMedDrone(c,{x:tx-12+Math.sin(now/500)*20,y:ty-75},{now,scale:1.2,variant:'storm_medic'});}
    else if(wildlife){if(tranq.captured){R.drawCaptureCage(c,tx,ty,.95,{now});W.drawCaptureEffect(c,{x:tx,y:ty},now-tranq.captureAt);}else R.drawTiger(c,{id:'practice-tiger',x:tx,y:ty,hp:tranq.hp,hpMax:100,rubberSlowed:tranq.lastKind==='rubber',hitFlashUntil:fired?now+60:0},{now,scale:practice?1:1.28,facing:-1,showState:false});W.drawFeedback(c,{...tranq,x:tx,y:ty},{stage:tranq.hp<=25?'ready':'weaken'});}
    else R.drawTiger(c,{id:'practice-tiger',name:'Practice target',x:tx,y:ty,face:Math.PI,hp:Math.max(1,100-count*8),hpMax:100,hitFlashUntil:fired?now+60:0},{now,scale:1.28,facing:-1,phase:now/280,walking:false,showState:false});
    R.drawSoldier(c,{x:sx,y:sy,face,eliteAppearance:a},{now,scale:wildlife&&practice?1.45:2,walking:!practice||options.walking,phase:elapsed*5,shotKick:fired?1:0,lowerWeapon:medic,showMarker:false});
    if(fired){const gunScale=wildlife&&practice?.725:1,mx=sx+Math.cos(face)*61*gunScale,my=sy+(-11+Math.sin(face)*48)*gunScale;c.save();c.strokeStyle='rgba(223,208,128,.7)';c.lineWidth=1.5;c.setLineDash([5,7]);c.beginPath();c.moveTo(mx,my);c.lineTo(tx-25,ty-8);c.stroke();c.restore();}
    if(wildlife&&practice){c.save();c.fillStyle='rgba(6,22,30,.89)';c.beginPath();c.roundRect(18,302,564,40,8);c.fill();c.fillStyle='#cde7dc';c.font='bold 12px system-ui';c.textAlign='left';c.fillText(`PRACTICE • HP ${tranq.hp}/100 • Darts ${tranq.ammo}/3 • ${tranq.captured?'LIVE CAPTURE SECURED':tranq.hp<=25?'CAPTURE READY':'USE RUBBER TO WEAKEN'}`,30,326);c.restore();}
    if(!wildlife){
    c.save();c.fillStyle='rgba(6,22,30,.89)';c.beginPath();c.roundRect(407,238,172,45,8);c.fill();c.fillStyle='#cde7dc';c.font='bold 11px system-ui';c.textAlign='center';c.fillText(medic?'MED DRONE • CIVILIAN '+(practice?options.practiceDrone?.hp||34:82)+'/100 HP':'TRAINING SIMULATION',493,255);c.fillStyle='#78d8b8';c.fillRect(420,264,medic?146*((practice?Number(options.practiceDrone?.hp||34):82)/100):Math.max(8,146-count*11),4);c.restore();
    }
    R.drawMapLighting(c,{x:0,y:0,w,h});c.restore();return {soldier:{x:sx,y:sy},tiger:{x:tx,y:ty}};
  }
  function drawCollection(c,options={}){
    const now=Number(options.now)||0,a={soldier:'crimson_commander',weapon:'guardian',equipment:'rescue_equipment',extraction:'extraction'};
    c.save();c.clearRect(0,0,c.canvas.width,c.canvas.height);c.scale(c.canvas.width/600,c.canvas.height/360);
    backdrop(c,{now,clear:[{x:160,y:230,r:80},{x:430,y:210,r:100}]});
    R.drawVehicle(c,{type:'helicopter',x:425,y:95,angle:0},{now,scale:1.45,moving:true,livery:'extraction'});
    R.drawCaptureCage(c,440,232,1.1,{now,livery:'rescue_equipment'});
    R.drawMedDrone(c,{x:290,y:155+Math.sin(now/700)*5},{now,scale:1.7,variant:'rescue_equipment'});
    R.drawSoldier(c,{x:150,y:240,face:0,eliteAppearance:a},{now,scale:2.4,walking:false,shotKick:Math.sin(now/750)>0.96?0.4:0,showMarker:false});
    c.fillStyle='rgba(8,25,32,.95)';c.beginPath();c.roundRect(18,286,564,59,9);c.fill();c.textAlign='center';c.fillStyle='#efd89a';c.font='bold 17px system-ui';c.fillText('COMMANDER COLLECTION',300,307);c.fillStyle='#d2e7db';c.font='11px system-ui';c.fillText('Commander • Guardian • Rescue Equipment • Custom Extraction',300,323);c.fillText('Appearance preview only • existing gameplay rules apply',300,338);c.restore();
    return a;
  }
  function drawLoadout(c,options={}){
    const p=options.preset||{},a=W.presentation(p.appearance||{},{survival:options.mode==='Survival',tranq:p.ammoMode==='tranq',ammoMode:p.ammoMode}),now=0;
    c.save();c.clearRect(0,0,c.canvas.width,c.canvas.height);c.scale(c.canvas.width/600,c.canvas.height/360);
    backdrop(c,{now,clear:[{x:190,y:205,r:80},{x:435,y:180,r:100}]});
    R.drawSoldier(c,{x:190,y:205,face:0,eliteAppearance:a},{now,scale:2.4,showMarker:false,walking:false,lowerWeapon:true,uniformPalette:options.uniformPalette});
    const finish=a.equipment==='rescue_equipment'?'rescue_equipment':a.soldier==='storm_medic'?'storm_medic':'base';
    if(p.toolId==='med-drone')R.drawMedDrone(c,{x:435,y:160},{now,scale:2.3,variant:finish});
    else if(['smoke','flare'].includes(p.toolId))R.drawRescueDevice(c,{x:435,y:180},{now,scale:3,kind:p.toolId,variant:finish});
    c.fillStyle='rgba(7,23,32,.94)';c.beginPath();c.roundRect(18,275,564,68,9);c.fill();c.textAlign='left';c.fillStyle='#efdba7';c.font='bold 16px system-ui';c.fillText(String(p.name||'Loadout preview').slice(0,32),30,297);
    c.fillStyle='#d2e7db';c.font='12px system-ui';c.fillText(String(options.weaponName||p.weaponId||'Weapon').slice(0,48)+' • '+String(p.ammoMode||'').toUpperCase(),30,315);c.fillText(`${options.mode==='Coop'?'Co-op':options.mode||'Story'} • ${{smoke:'Smoke Grenade','med-drone':'Med Drone',flare:'Signal Flare','tranq-kit':'Tranq Kit',shock:'Shock Baton'}[p.toolId]||'Current rescue tool'} • Preview only`,30,332);c.restore();
  }
  function drawEquipment(c,options={}){
    const now=Number(options.now)||0,elapsed=Math.max(0,now-Number(options.openedAt||0)),names=['med-drone','smoke','flare','cage'],kind=names.includes(options.equipment)?options.equipment:names[Math.floor(elapsed/5000)%names.length],appearance={...options.appearance,equipment:'rescue_equipment'},labels={'med-drone':'MED DRONE',smoke:'SMOKE GRENADE',flare:'SIGNAL FLARE',cage:'LIVE CAPTURE CAGE'};
    c.save();c.clearRect(0,0,c.canvas.width,c.canvas.height);c.scale(c.canvas.width/600,c.canvas.height/360);
    backdrop(c,{now,clear:[{x:140,y:215,r:80},{x:435,y:190,r:135}]});
    R.drawSoldier(c,{x:140,y:215,face:0,eliteAppearance:appearance},{now,scale:2,walking:false,showMarker:false,lowerWeapon:true});
    if(kind==='med-drone'){
      R.drawCivilian(c,{x:425,y:235,hp:100,hpMax:100,look:'field',face:Math.PI},{now,scale:1.35,walking:false});
      R.drawMedDrone(c,{x:435+Math.sin(now/600)*8,y:135},{now,scale:2.7,variant:'rescue_equipment'});
    }else if(kind==='smoke'){
      c.save();c.translate(435,185);c.scale(.37,.37);T.drawEffect(c,{kind:'smoke',x:0,y:0,until:now+8000-(elapsed%5000),eliteAppearance:appearance},now,{showOriginLabel:false});c.restore();
      R.drawRescueDevice(c,{x:435,y:190},{kind,variant:'rescue_equipment',now,scale:3.6});
    }else if(kind==='flare'){
      T.drawEffect(c,{kind:'flare',origin:{x:410,y:190},target:{x:470,y:85,label:'Practice objective'},extraction:{x:535,y:245,label:'Practice extraction'},until:now+14000-(elapsed%5000),eliteAppearance:appearance},now,{showOriginLabel:false});
      R.drawRescueDevice(c,{x:410,y:190},{kind,variant:'rescue_equipment',now,scale:3.6,active:true});
    }else R.drawCaptureCage(c,435,192,1.7,{now,livery:'rescue_equipment'});
    c.fillStyle='rgba(8,25,32,.94)';c.beginPath();c.roundRect(18,290,564,52,9);c.fill();c.textAlign='center';c.fillStyle='#efd89a';c.font='bold 16px system-ui';c.fillText('RESCUE EQUIPMENT • '+labels[kind],300,312);c.fillStyle='#c6e2d8';c.font='12px system-ui';c.fillText('Appearance preview • no supplies, healing or mission progress changed',300,330);
    c.restore();return {kind};
  }
  function drawVictory(c,options={}){
    const now=Number(options.now)||0,age=Math.max(0,Number(options.age)||0),w=600,h=300;
    const actors=(options.players||[{eliteAppearance:{soldier:'crimson_commander'}}]).slice(0,2);
    const salute=options.staticPose?1:Math.sin(Math.PI/2*Math.min(1,age/550))*(age>1800?Math.max(0,1-(age-1800)/650):1);
    c.save();c.clearRect(0,0,c.canvas.width,c.canvas.height);c.scale(c.canvas.width/w,c.canvas.height/h);
    const positions=actors.map((p,i)=>({x:actors.length===1?300:210+i*180,y:168,r:90}));
    backdrop(c,{width:w,height:h,now,clear:positions});
    for(let i=0;i<actors.length;i++){const p=actors[i],a=p.eliteAppearance||{};R.drawSoldier(c,{...p,x:positions[i].x,y:168,face:0,eliteAppearance:a},{now,scale:2.45,walking:false,showMarker:false,lowerWeapon:true,celebration:salute,uniformPalette:p.masteryIdentity?.uniform?.palette});}
    c.fillStyle='rgba(8,20,30,.91)';c.beginPath();c.roundRect(18,240,564,43,9);c.fill();c.fillStyle='#f4dfac';c.textAlign='center';c.font='bold 16px system-ui';
    c.fillText(options.preview?'VICTORY SALUTE PREVIEW':'MISSION COMPLETE • COMMANDER SALUTE',300,260);c.fillStyle='#d2ded8';c.font='11px system-ui';c.fillText(options.preview?'Cosmetic animation • no mission progress or rewards':'Review your mission results and continue whenever you are ready',300,276);
    c.restore();
  }
  function drawTransfer(c,options={}){
    const w=c.canvas.width,h=c.canvas.height,p=Math.max(0,Math.min(1,Number(options.progress)||0)),count=Math.max(1,Math.min(6,Number(options.count)||1)),now=Number(options.now)||0;
    c.save();c.clearRect(0,0,w,h);c.scale(w/960,h/300);
    c.fillStyle='#286640';c.fillRect(0,0,960,300);R.drawGroundTexture(c,{x:0,y:0,w:960,h:300},{family:'forest'});
    for(let i=0;i<9;i++)R.drawMapTree(c,30+i*113,80+(i%2)*16,.92);R.drawMapHouse(c,710,54,100,70,{roofRise:36});
    c.fillStyle='#243c43';c.fillRect(0,172,960,128);c.fillStyle='#44555c';c.fillRect(0,180,960,120);c.strokeStyle='#c6cdb6';c.lineWidth=2;c.beginPath();c.moveTo(0,185);c.lineTo(960,185);c.stroke();
    c.strokeStyle='#d2bc72';c.lineWidth=4;c.setLineDash([32,26]);c.beginPath();c.moveTo(0,263);c.lineTo(960,263);c.stroke();c.setLineDash([]);
    const arrive=Math.min(1,p/.24),depart=Math.max(0,(p-.68)/.32),tx=p<.68?-330+arrive*510:180+depart*900;
    R.drawVehicle(c,{type:'transport',x:tx+190,y:194},{now,scale:1.5,moving:p<.24||p>.68,color:'#416c58'});
    for(let i=0;i<count;i++){const loaded=Math.max(0,Math.min(1,(p-(.24+i*(.4/count)))/.12)),gx=600+i*48,cx=gx+(tx+28+i*43-gx)*loaded,cy=208+(185-208)*loaded;R.drawCaptureCage(c,cx+16,cy,.44,{now,livery:options.cages?.[i]?.livery});}
    R.drawMapLighting(c,{x:0,y:0,w:960,h:300});c.fillStyle='rgba(8,25,32,.9)';c.beginPath();c.roundRect(12,10,470,49,8);c.fill();c.fillStyle='#e6f0dc';c.font='bold 15px system-ui';c.textAlign='left';c.fillText(p<.24?'Wildlife recovery truck arriving':p<.68?'Loading secured live tiger cages':'Cages secured • wildlife transport departing',24,30);c.fillStyle='#b9dbc0';c.font='12px system-ui';c.fillText(`${Number(options.count)||0} live tigers • no blood scent`,24,48);c.restore();
  }
  return Object.freeze({draw,backdrop,routeAt,drawTransfer,drawVictory,drawEquipment,drawLoadout,drawCollection});
});
