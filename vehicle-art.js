(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerVehicleArt=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TAU=Math.PI*2;
  function box(c,x,y,w,h,color,r=2){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function path(c,points,color,stroke='#172d35',width=1.5){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=color;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}}
  function line(c,points,color,width=1){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
  function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
  function metal(c,x,y,w,h,base,light='#b4c8c4'){const g=c.createLinearGradient(x,y,x+w*.3,y+h);g.addColorStop(0,light);g.addColorStop(.22,base);g.addColorStop(.7,base);g.addColorStop(1,'#243940');box(c,x,y,w,h,g,4);}
  function glass(c,x,y,w,h){const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'#c2ece8');g.addColorStop(.3,'#598b9b');g.addColorStop(1,'#183d55');box(c,x,y,w,h,g,3);line(c,[[x+2,y+h-3],[x+w*.65,y+2]],'rgba(226,249,242,.65)',1.2);}
  function crew(c,x,y,w,h){
    const paint=globalThis.TigerStrikeBattlefieldRenderer?.drawSoldier;if(!paint)return;
    c.save();c.beginPath();c.rect(x+1,y+1,w-2,h-2);c.clip();
    paint(c,{x:x+w*.45,y:y+h*1.38,face:0},{scale:.34,showMarker:false});
    c.restore();line(c,[[x+2,y+h-3],[x+w*.65,y+2]],'rgba(226,249,242,.35)',.8);
  }
  function rivets(c,x,y,count,step=10){for(let i=0;i<count;i++){oval(c,x+i*step,y,1,1,'#a9bab4');oval(c,x+i*step,y+.5,.45,.45,'#263f45');}}
  function tire(c,x,y,phase=0,r=9){oval(c,x+1,y+2,r+1,r,'#15232b');oval(c,x,y,r,r,'#0e1b21');oval(c,x,y,r*.66,r*.66,'#485b64');oval(c,x,y,r*.42,r*.42,'#91a5a8');oval(c,x,y,2,2,'#2c424b');for(let i=0;i<6;i++){const a=i*TAU/6+phase;line(c,[[x+Math.cos(a)*r*.47,y+Math.sin(a)*r*.47],[x+Math.cos(a)*r*.64,y+Math.sin(a)*r*.64]],'#c3ceca',.8);}for(let i=0;i<10;i++){const a=i*TAU/10;line(c,[[x+Math.cos(a)*r*.88,y+Math.sin(a)*r*.88],[x+Math.cos(a)*r,y+Math.sin(a)*r]],'#33464d',1);}}
  function livery(c,kind,premium){const teal=premium?'#27bcb4':'#d9e9d8',gold=premium?'#f4d18a':'#7a9988';const y=kind==='boat'?4:kind==='helicopter'?0:-5,w=kind==='truck'?94:44;box(c,-w/2,y,w,5,teal,1);line(c,[[-w/2,y+6],[w/2,y+6]],gold,1.5);box(c,-4,y-5,8,8,'#e7e8d1',1);line(c,[[-2,y-1],[0,y+1],[3,y-3]],'#346d66',1.4);}
  function draw(c,entity={},options={}){
    if(!c)return;const aliases={convoy:'truck',ground:'truck',timed_escape:'truck',street:'suv',safe_hold:'suv'},kind=aliases[entity.type]||entity.type||'truck';
    const now=Number(options.now??Date.now()),phase=options.moving?now/110:0,scale=Math.max(.1,Math.min(4,Number(options.scale)||1)),heading=Number(entity.angle)||0,premium=options.livery==='extraction',base=options.color||(premium?'#296d72':'#466553');
    const quiet=options.reducedMotion??globalThis.TigerCombatFeel?.settings()?.reducedFlashes??false;
    c.save();c.translate(Number(entity.x)||0,Number(entity.y)||0);c.scale(scale,scale);
    if(options.shadow!==false)oval(c,kind==='helicopter'?8:4,kind==='helicopter'?38:25,kind==='truck'?85:kind==='plane'?88:55,kind==='boat'?7:11,'rgba(3,16,22,.32)');
    c.scale(Math.cos(heading)<0?-1:1,1);
    if(kind==='helicopter'){
      line(c,[[-32,16],[-39,30],[35,30],[28,16]],'#172c35',4);line(c,[[-39,31],[41,31]],'#a1b5b4',2);
      path(c,[[-26,-9],[-76,-18],[-85,-38],[-68,-28],[-65,-16],[-25,-1]],base);
      const fuselage=c.createLinearGradient(-20,-27,20,25);fuselage.addColorStop(0,'#b1c4b5');fuselage.addColorStop(.3,base);fuselage.addColorStop(.7,base);fuselage.addColorStop(1,'#203c43');
      c.beginPath();c.moveTo(-33,11);c.bezierCurveTo(-47,-1,-33,-24,-13,-25);c.lineTo(22,-24);c.bezierCurveTo(45,-24,62,-8,51,9);c.bezierCurveTo(43,25,-9,27,-33,11);c.closePath();c.fillStyle=fuselage;c.fill();c.strokeStyle='#263f45';c.lineWidth=1.5;c.stroke();
      line(c,[[-27,17],[-9,20],[29,20],[43,13]],'#7b9a91',1);
      glass(c,22,-20,24,22);crew(c,22,-20,24,22);glass(c,-23,-16,17,18);glass(c,-2,-16,17,18);
      box(c,-24,3,38,13,'#263e41',3);line(c,[[-22,4],[-22,15],[12,15],[12,4]],'#839b93',1);
      box(c,-7,-34,30,12,'#354b4b',4);for(let i=0;i<6;i++)line(c,[[i*3-3,-31],[i*3-2,-25]],'#14272d',1.5);
      box(c,-2,-39,5,13,'#a4b7b5',1);rivets(c,-27,18,7,10);rivets(c,-29,-19,7,9);
      line(c,[[-5,-23],[-5,-2]],'#a4b8b1',1);box(c,-10,-1,8,2,'#d4dcd1',1);
      livery(c,kind,premium);
      const rotor=quiet?.7:now/95;line(c,[[-82,-21],[-82,-44]],'#b6c7c2',2);line(c,[[-92,-33],[-72,-33]],'#c4d0c8',2);
      if(!quiet){c.save();c.globalAlpha=.09;oval(c,0,-40,84,11,'#e2eee6');c.restore();}
      const rx=Math.cos(rotor)*85,ry=Math.sin(rotor)*9;line(c,[[-rx,-40-ry],[rx,-40+ry]],'#d1ded6',3.5);line(c,[[-rx*.55,-40+ry*.55],[rx*.55,-40-ry*.55]],'#66858a',2);oval(c,0,-40,5,3,'#324e54');
      box(c,45,5,6,3,'#e9e3bb',1);box(c,-34,-15,3,3,'#e7a284',1);
    }else if(kind==='boat'){
      if(options.wake!==false){c.save();c.globalAlpha=options.moving?.65:.28;for(let i=0;i<4;i++){const drift=quiet?0:(now/90+i*9)%20;line(c,[[-58-drift-i*9,3-i*5],[-34-i*9,8-i*4]],'#b7e5df',1.6);line(c,[[-58-drift-i*9,15+i*5],[-34-i*9,10+i*4]],'#5ab7c0',1.4);}c.restore();}
      const hull=c.createLinearGradient(0,-17,0,25);hull.addColorStop(0,'#bdcebf');hull.addColorStop(.35,base);hull.addColorStop(1,'#142e3a');
      path(c,[[-62,-13],[35,-16],[66,0],[39,20],[-55,20],[-67,7]],hull,'#a9c6c3',2);
      path(c,[[-52,-9],[31,-11],[50,0],[29,11],[-48,11]],'#7b958c','#c0cfc1',1);
      metal(c,-22,-33,44,30,'#d2d7c4','#f1efda');glass(c,2,-29,16,14);crew(c,2,-29,16,14);glass(c,-17,-29,14,14);box(c,-11,-11,23,14,'#2f5058',2);
      for(const x of[-43,-31]){box(c,x,-7,8,14,'#365a5e',2);line(c,[[x+2,-5],[x+6,-5]],'#87a7a0',1);}
      box(c,-69,-5,9,15,'#253d46',2);box(c,-67,-7,6,4,'#9bb6b6',1);
      line(c,[[-54,-15],[-54,-22],[34,-23],[52,-9]],'#d0d8c6',1.5);for(const x of[-43,-21,4,29])line(c,[[x,-21],[x,-12]],'#b9cec3',1);
      line(c,[[8,-34],[8,-48]],'#4a666c',2);line(c,[[2,-48],[20,-48]],'#aacac7',1.5);box(c,-6,-39,15,3,'#d2c989',1);
      for(const x of[-40,35]){line(c,[[x,0],[x,9]],'#ccd9c9',1);box(c,x-3,8,6,13,'#193540',3);line(c,[[x-1,10],[x-1,17]],'#577a82',1);}livery(c,kind,premium);
      line(c,[[40,9],[52,2]],'#e7e7d1',1);rivets(c,-45,18,8,10);
    }else if(kind==='plane'){
      path(c,[[-85,-6],[-12,-12],[53,-10],[84,0],[53,11],[-70,9]],'#b6c8c1');path(c,[[-7,-7],[-39,-53],[-16,-48],[22,-7]],'#738e8e');path(c,[[-7,7],[-39,49],[-17,45],[22,7]],'#718b8d');path(c,[[-71,-4],[-91,-30],[-72,-28],[-51,-4]],base);glass(c,47,-7,20,8);for(let i=0;i<7;i++)glass(c,-33+i*10,-7,5,4);livery(c,kind,premium);line(c,[[-35,-31],[-35,-60]],'#d2ddd1',2);line(c,[[-35,29],[-35,58]],'#d2ddd1',2);
    }else{
      const bus=kind==='bus',suv=kind==='suv',semi=kind==='transport',long=bus||semi,left=semi?-127:bus?-82:suv?-49:-68,right=semi?125:bus?82:suv?50:68;
      line(c,[[left,20],[right,20]],'#1b3037',6);
      if(semi){
        // Open conservation carrier: live cages remain visible on the deck.
        box(c,-128,-42,183,43,'rgba(22,45,46,.12)',1);metal(c,-128,0,183,16,'#8ba396','#cbd6c4');
        line(c,[[-128,-42],[55,-42],[55,0]],'#829f96',3);line(c,[[-128,-42],[-128,0]],'#b8cbb9',3);
        for(let i=0;i<6;i++)line(c,[[-126+i*36,-41],[-126+i*36,0]],'#567c73',1.4);
        rivets(c,-120,13,17,10);box(c,-112,2,100,11,'#1f5952',1);c.fillStyle='#e4edda';c.font='bold 7px system-ui';c.textAlign='center';c.fillText('WILDLIFE RECOVERY',-63,10);
        metal(c,66,-27,62,47,base,'#a5bda4');box(c,69,-39,23,18,base,4);glass(c,98,-23,22,19);crew(c,98,-23,22,19);glass(c,73,-23,18,14);line(c,[[96,-23],[96,14]],'#9cb7ac',1);box(c,104,1,9,2,'#c0d0c0',1);box(c,72,16,24,5,'#758f91',1);
        for(const x of[-105,-83,42,63]){tire(c,x-2,24,phase,9);tire(c,x+3,24,phase,9);}tire(c,115,24,phase,10);
      }else if(bus){
        metal(c,-82,-34,164,56,options.color||'#b9973e','#e0d49c');box(c,-77,-26,151,21,'#233f4e',3);for(let i=0;i<9;i++)glass(c,-73+i*16,-24,12,17);box(c,50,-1,17,22,'#43665e',2);line(c,[[58,0],[58,19]],'#b5c6b9',1);tire(c,-53,25,phase,11);tire(c,54,25,phase,11);
      }else if(suv){
        path(c,[[-50,-7],[-33,-29],[17,-30],[36,-13],[49,-7],[51,20],[-49,20]],base);glass(c,-29,-25,23,16);glass(c,0,-25,20,16);crew(c,0,-25,20,16);box(c,-48,-2,95,17,base,4);line(c,[[-5,-27],[-5,16]],'#90aaa0',1);box(c,0,0,8,2,'#cad8cc',1);box(c,-29,-34,48,3,'#364d52',1);tire(c,-30,22,phase,11);tire(c,31,22,phase,11);
      }else{
        metal(c,-68,-25,82,45,base,'#94b39f');box(c,-64,-30,74,7,'#314e4e',2);for(let i=0;i<7;i++)line(c,[[-60+i*10,-20],[-60+i*10,16]],'#557b6a',1);
        path(c,[[17,-29],[48,-29],[66,-10],[69,20],[17,20]],base);glass(c,24,-25,20,17);glass(c,48,-22,12,14);crew(c,48,-22,12,14);box(c,48,0,8,2,'#d1d9c7',1);line(c,[[21,-5],[21,15]],'#a0baaa',1);tire(c,-45,23,phase,11);tire(c,43,23,phase,11);
      }
      const grilleX=right-6;box(c,grilleX,4,6,13,'#273e45',1);for(let i=0;i<4;i++)line(c,[[grilleX+1,6+i*3],[grilleX+5,6+i*3]],'#b5c8c4',.7);box(c,right-2,-2,4,5,'#eae4bb',1);box(c,left,8,3,5,'#b77863',1);line(c,[[right-6,21],[right+3,21]],'#a4b8b5',3);line(c,[[right-25,-24],[right-19,-35],[right-11,-35]],'#405c65',1.5);livery(c,semi?'truck':kind,premium);
    }
    if(options.damaged){line(c,[[-13,-15],[2,-1],[-8,6],[9,18]],'#543b35',2);line(c,[[12,-17],[18,-9],[12,-3]],'#d0b7a4',1);}
    c.restore();return {kind,x:Number(entity.x)||0,y:Number(entity.y)||0};
  }
  return Object.freeze({VERSION:1,draw});
});
