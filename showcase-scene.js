(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./shared-battlefield-renderer'):root.TigerStrikeBattlefieldRenderer,typeof module==='object'&&module.exports?require('./chapter-maps'):root.TigerChapterMaps,typeof module==='object'&&module.exports?require('./water-terrain'):root.TigerWaterTerrain,typeof module==='object'&&module.exports?require('./elite-catalog'):root.TigerEliteCatalog);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerShowcaseScene=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R,maps,water,C){
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
    // The training target and actors are production models, with isolated visual state.
    const a={soldier:C.palettes[current]?current:(options.appearance?.soldier||''),weapon:current==='guardian'?'guardian':current==='recruit_finish'?'recruit_finish':'',badge:current==='recruit_badge'?'recruit_badge':''};
    const fired=practice?now-Number(options.shot||-99999)<160:elapsed%2<.13;
    const face=Math.atan2(ty-sy,tx-sx),count=Number(options.hits)||0;
    R.drawTiger(c,{id:'practice-tiger',name:'Practice target',x:tx,y:ty,face:Math.PI,hp:Math.max(1,100-count*8),hpMax:100,hitFlashUntil:fired?now+60:0},{now,scale:1.28,facing:-1,phase:now/280,walking:false,showState:false});
    R.drawSoldier(c,{x:sx,y:sy,face,eliteAppearance:a},{now,scale:2,walking:!practice||options.walking,phase:elapsed*5,shotKick:fired?1:0,showMarker:false});
    if(fired){const mx=sx+Math.cos(face)*61,my=sy-11+Math.sin(face)*48;c.save();c.strokeStyle='rgba(223,208,128,.7)';c.lineWidth=1.5;c.setLineDash([5,7]);c.beginPath();c.moveTo(mx,my);c.lineTo(tx-25,ty-8);c.stroke();c.restore();}
    c.save();c.fillStyle='rgba(6,22,30,.89)';c.beginPath();c.roundRect(407,238,172,45,8);c.fill();c.fillStyle='#cde7dc';c.font='bold 11px system-ui';c.textAlign='center';c.fillText('TRAINING SIMULATION',493,255);c.fillStyle='#78d8b8';c.fillRect(420,264,Math.max(8,146-count*11),4);c.restore();
    R.drawMapLighting(c,{x:0,y:0,w,h});c.restore();return {soldier:{x:sx,y:sy},tiger:{x:tx,y:ty}};
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
    for(let i=0;i<count;i++){const loaded=Math.max(0,Math.min(1,(p-(.24+i*(.4/count)))/.12)),gx=600+i*48,cx=gx+(tx+28+i*43-gx)*loaded,cy=208+(185-208)*loaded;R.drawCaptureCage(c,cx+16,cy,.44,{now});}
    R.drawMapLighting(c,{x:0,y:0,w:960,h:300});c.fillStyle='rgba(8,25,32,.9)';c.beginPath();c.roundRect(12,10,470,49,8);c.fill();c.fillStyle='#e6f0dc';c.font='bold 15px system-ui';c.textAlign='left';c.fillText(p<.24?'Wildlife recovery truck arriving':p<.68?'Loading secured live tiger cages':'Cages secured • wildlife transport departing',24,30);c.fillStyle='#b9dbc0';c.font='12px system-ui';c.fillText(`${Number(options.count)||0} live tigers • no blood scent`,24,48);c.restore();
  }
  return Object.freeze({draw,backdrop,routeAt,drawTransfer});
});
