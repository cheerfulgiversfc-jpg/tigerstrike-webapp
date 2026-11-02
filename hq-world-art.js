(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./shared-battlefield-renderer'):root.TigerStrikeBattlefieldRenderer);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerHqWorldArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(R){
 'use strict';let cached=null,signature='';
 function rect(c,x,y,w,h,color,r=4){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
 function facility(c,room,appearance={}){
  const x=room.x-room.w/2,y=room.y-room.h/2;
  // Open-front facilities remain within the existing walkable room footprint.
  rect(c,x+3,y+5,room.w-2,room.h-2,'rgba(8,28,27,.24)',8);
  const floor=c.createLinearGradient(x,y,x+room.w,y+room.h);floor.addColorStop(0,'#b7bea7');floor.addColorStop(1,'#788e80');rect(c,x,y,room.w,room.h,floor,8);
  c.strokeStyle='rgba(229,234,210,.3)';c.lineWidth=1;for(let xx=x+18;xx<x+room.w-10;xx+=24){c.beginPath();c.moveTo(xx,y+10);c.lineTo(xx,y+room.h-7);c.stroke();}
  if(room.id==='pens'){
    rect(c,x+7,y+7,room.w-14,room.h-40,'#638c59',4);c.strokeStyle='#aebdb7';c.lineWidth=3;for(let xx=x+8;xx<x+room.w-4;xx+=16){c.beginPath();c.moveTo(xx,y+6);c.lineTo(xx,y+room.h-34);c.stroke();}c.strokeRect(x+7,y+7,room.w-14,room.h-40);
  }else if(room.id==='training'){
    rect(c,x+8,y+6,room.w-16,room.h-36,'#3b7b6e');c.strokeStyle='#cbd9b5';c.lineWidth=2;c.strokeRect(x+14,y+11,room.w-28,Math.max(8,room.h-47));
  }else if(room.id==='mission'){
    rect(c,x+7,y+7,15,room.h-37,'#667f7f');rect(c,x+room.w-22,y+7,15,room.h-37,'#667f7f');rect(c,x+7,y+5,room.w-14,14,'#405c63');rect(c,x+23,y+9,room.w-46,5,'#8ac4a1');
  }else if(room.id==='vehicle'){
    R.drawVehicle(c,{type:'truck',x:room.x,y:y+25,angle:0},{now:0,scale:.5,moving:false,livery:appearance.extraction});
  }else{
    const large=room.h>=90,roof=({armory:'#8b5a3b',medbay:'#3b7c72',intel:'#486a82',command:'#4c667c',specialists:'#68764c',trophy:'#907440'})[room.id]||'#596e70';
    R.drawMapHouse(c,x+9,y+17,room.w-18,large?Math.max(24,room.h*.32):Math.max(12,room.h*.24),{roof,roofRise:15});
    if(room.id==='medbay'){rect(c,room.x-3,y+19,6,19,'#eef5df',1);rect(c,room.x-9,y+25,18,6,'#eef5df',1);}
    if(['command','intel','weather','research'].includes(room.id)){rect(c,x+room.w-35,y+6,4,17,'#c6d6cb',1);c.strokeStyle='#d0e8da';c.lineWidth=2;c.beginPath();c.arc(x+room.w-33,y+4,9,0,Math.PI);c.stroke();}
  }
 }
 function paint(c,options){const w=options.width||1280,h=options.height||720,rooms=options.rooms||[];
  c.save();const grass=c.createLinearGradient(0,0,w,h);grass.addColorStop(0,'#54834d');grass.addColorStop(.5,'#356e4b');grass.addColorStop(1,'#214f3f');c.fillStyle=grass;c.fillRect(0,0,w,h);R.drawGroundTexture(c,{x:0,y:0,w,h},{heavy:!!options.heavy});
  // These concourses use the same extents as the original HQ walkways.
  rect(c,518,58,244,610,'#849083',24);rect(c,126,318,1028,86,'#849083',18);rect(c,526,66,228,594,'#465b62',20);rect(c,134,326,1012,70,'#465b62',14);
  c.strokeStyle='#ddc77c';c.lineWidth=3;c.setLineDash([14,14]);c.beginPath();c.moveTo(640,118);c.lineTo(640,654);c.moveTo(167,361);c.lineTo(1112,361);c.stroke();c.setLineDash([]);
  for(const [x,y]of [[422,235],[868,235],[406,518],[880,518],[52,155],[65,255],[54,458],[60,555],[1212,162],[1224,265],[1220,466],[1234,554],[364,584],[921,588],[378,151],[900,153]]){if(rooms.some(r=>Math.abs(r.x-x)<r.w/2+30&&Math.abs(r.y-y)<r.h/2+38))continue;R.drawMapTree(c,x,y,.8);}
  for(const room of rooms)facility(c,room,options.appearance||{});
  R.drawMapLighting(c,{x:0,y:0,w,h});if(options.identity==='rogue'){c.fillStyle='rgba(105,30,40,.09)';c.fillRect(0,0,w,h);}c.restore();
 }
 function foundation(c,options={}){
  const key=JSON.stringify([options.width,options.height,options.heavy,options.identity,options.appearance?.extraction,(options.rooms||[]).map(r=>[r.id,r.x,r.y,r.w,r.h])]);
  if(globalThis.document?.createElement){if(!cached||signature!==key){cached=globalThis.document.createElement('canvas');cached.width=options.width||1280;cached.height=options.height||720;paint(cached.getContext('2d'),options);signature=key;}c.drawImage(cached,0,0);}else paint(c,options);
 }
 function minimap(c,options={}){
  const b=options.bounds,v=options.view,p=options.player;c.save();c.globalAlpha=1;c.translate(b.x,b.y);c.scale(b.w/options.width,b.h/options.height);foundation(c,options);c.restore();c.save();c.strokeStyle='#d1ebe1';c.lineWidth=1;c.strokeRect(b.x,b.y,b.w,b.h);c.strokeStyle='#8ae0ed';c.strokeRect(b.x+v.x/options.width*b.w,b.y+v.y/options.height*b.h,Math.min(v.w,options.width)/options.width*b.w,Math.min(v.h,options.height)/options.height*b.h);c.fillStyle='#a3f2a0';c.beginPath();c.arc(b.x+p.x/options.width*b.w,b.y+p.y/options.height*b.h,2.7,0,Math.PI*2);c.fill();c.restore();
 }
 function highlight(c,room,options={}){c.save();c.strokeStyle=options.active?'#b7efcd':options.rank>0?'#9bc5b1':'#617b76';c.lineWidth=options.active?3:1.3;c.beginPath();c.roundRect(room.x-room.w/2,room.y-room.h/2,room.w,room.h,8);c.stroke();c.restore();}
 function person(c,p={},options={}){
  if(options.player)R.drawSoldier(c,{...p,eliteAppearance:options.appearance||{}},{now:options.now,scale:.88,phase:p.step||0,walking:!!options.walking,lowerWeapon:true,showMarker:false,uniformPalette:options.uniformPalette});
  else R.drawCivilian(c,{x:p.x,y:p.y,face:p.face||0,look:/med|doctor/i.test(p.role)?'doctor':/armory|squad|training/i.test(p.role)?'soldier':'scout',shirt:options.color||(/reception/i.test(p.role)?'#24847e':undefined)},{now:options.now,scale:options.scale||.78,phase:p.step||0,walking:!!options.walking});
 }
 function tiger(c,t={},options={}){R.drawTiger(c,{x:t.x,y:t.y,type:t.type||'Standard',hp:100,hpMax:100},{now:options.now,scale:options.scale||.46,facing:options.facing||1,phase:options.now/600,walking:false});}
 return {foundation,minimap,highlight,person,tiger};
});
