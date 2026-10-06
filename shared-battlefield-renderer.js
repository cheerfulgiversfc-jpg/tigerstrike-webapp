(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.TigerStrikeBattlefieldRenderer=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const VERSION="10.22";
  const TAU=Math.PI*2;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

  function rounded(ctx,x,y,w,h,r=8){
    const q=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+q,y);ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();
  }
  function ellipse(ctx,x,y,rx,ry,fill,rotation=0){
    ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,TAU);ctx.fill();
  }
  function line(ctx,color,width,points){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const point of points.slice(1))ctx.lineTo(point[0],point[1]);ctx.stroke();
  }
  function label(ctx,text,x,y,color="#e0f2fe",border="#67e8f9",width=150){
    ctx.fillStyle="rgba(4,12,23,.91)";rounded(ctx,x-width/2,y-19,width,26,9);ctx.fill();ctx.strokeStyle=border;ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=color;ctx.font="900 11px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,x,y-6);
  }

  function drawSoldier(ctx,entity={},options={}){
    const x=Number(entity.x)||0,y=Number(entity.y)||0,face=Number(entity.face)||0;
    const phase=Number(options.phase)||0,walking=!!options.walking,downed=!!entity.downed;
    const stride=walking?Math.sin(phase)*8:0,bob=walking?Math.abs(Math.sin(phase))*2:0;
    const facing=Math.cos(face)<0?-1:1;
    const mine=!!options.mine,accent=downed?"#fb7185":(mine?"#67e8f9":"#c4b5fd");
    const role=String(entity.role||"support");
    ctx.save();ctx.translate(x,y-bob);ctx.scale(facing,1);
    ellipse(ctx,2,27+bob,25,8,"rgba(2,6,23,.43)");
    if(downed){ctx.rotate(facing*.08);ctx.translate(0,9);}

    // Independent articulated legs keep the character upright while walking.
    line(ctx,"#202a24",8,[[-7,10],[-10-stride*.55,26]]);line(ctx,"#202a24",8,[[7,10],[10+stride*.55,26]]);
    line(ctx,"#536548",5,[[-7,11],[-10-stride*.55,24]]);line(ctx,"#536548",5,[[7,11],[10+stride*.55,24]]);
    ellipse(ctx,-11-stride*.55,27,8,3,"#090e12",-.1);ellipse(ctx,11+stride*.55,27,8,3,"#090e12",.1);

    // Uniform, vest, belt, shoulder plates and backpack.
    const uniform=ctx.createLinearGradient(-14,-10,14,20);uniform.addColorStop(0,"#718159");uniform.addColorStop(.55,"#4f6246");uniform.addColorStop(1,"#314235");ctx.fillStyle=uniform;rounded(ctx,-14,-9,28,29,7);ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=2.2;ctx.stroke();
    ctx.fillStyle="#233044";rounded(ctx,-16,-3,32,18,5);ctx.fill();ctx.strokeStyle="#65758a";ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle="#111827";ctx.fillRect(-15,12,30,4);ctx.fillStyle="#8b6f47";rounded(ctx,-3,11,7,7,2);ctx.fill();
    ctx.fillStyle="#172033";rounded(ctx,-20,-5,7,20,3);ctx.fill();
    for(const px of [-9,2]){ctx.fillStyle="#3e4f42";rounded(ctx,px,2,8,9,2);ctx.fill();ctx.strokeStyle="#91a47f";ctx.lineWidth=1;ctx.stroke();}

    // Arms and weapon point toward the aim direction without rotating the body.
    const aimY=clamp(Math.sin(face)*7,-6,6);
    line(ctx,"#455842",7,[[-11,-2],[-20,7+aimY*.2],[-5,5]]);line(ctx,"#455842",7,[[10,-2],[19,5+aimY*.2],[7,5]]);
    ellipse(ctx,-4,4,4,4,"#c98f6c");ellipse(ctx,8,4,4,4,"#c98f6c");
    ctx.save();ctx.translate(3,2);ctx.rotate(facing===1?Math.atan2(Math.sin(face),Math.abs(Math.cos(face))):Math.atan2(Math.sin(face),Math.abs(Math.cos(face))));
    ctx.fillStyle="#101822";rounded(ctx,-7,-4,39,8,2);ctx.fill();ctx.fillStyle="#8da0ae";ctx.fillRect(27,-2,17,4);ctx.fillStyle="#27384b";rounded(ctx,4,-7,17,6,2);ctx.fill();ctx.fillStyle="#121923";ctx.beginPath();ctx.moveTo(10,4);ctx.lineTo(19,14);ctx.lineTo(24,13);ctx.lineTo(20,4);ctx.fill();ctx.fillStyle="#7dd3fc";ctx.fillRect(18,-6,5,2);ctx.restore();

    // Face has features, hair/helmet, chin and headset.
    ellipse(ctx,0,-16,10,11,"#c98f6c");ellipse(ctx,0,-12,8,6,"#d9a27f");
    ctx.fillStyle="#55664c";ctx.beginPath();ctx.arc(0,-21,13,Math.PI,TAU);ctx.fill();ctx.fillRect(-13,-22,26,5);ctx.fillStyle="#29352e";ctx.fillRect(-9,-25,18,4);
    ctx.fillStyle="#0b1119";ctx.beginPath();ctx.arc(-3.4,-17.2,1.35,0,TAU);ctx.arc(3.4,-17.2,1.35,0,TAU);ctx.fill();ctx.strokeStyle="#7c2d12";ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(-2,-11.8);ctx.quadraticCurveTo(0,-10.5,2,-11.8);ctx.stroke();
    ctx.strokeStyle="#111827";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-9,-17,4,Math.PI*.6,Math.PI*1.45);ctx.stroke();ctx.fillStyle="#111827";ctx.beginPath();ctx.arc(-10,-14,2,0,TAU);ctx.fill();
    if(role==="medic"){ctx.fillStyle="#f8fafc";rounded(ctx,-5,-2,10,10,2);ctx.fill();ctx.fillStyle="#ef4444";ctx.fillRect(-1,-1,2,8);ctx.fillRect(-4,2,8,2);}
    ctx.restore();
    return {x,y,labelY:y-43,barY:y+34,accent};
  }

  function drawCivilian(ctx,entity={},options={}){
    const x=Number(entity.x)||0,y=Number(entity.y)||0,phase=Number(options.phase)||0;
    const walking=!!options.walking&&!entity.secured,stride=walking?Math.sin(phase)*7:0,bob=walking?Math.abs(Math.sin(phase))*1.5:0;
    const palette={field:["#f59e0b","#334155"],medic:["#f8fafc","#b91c1c"],scout:["#60a5fa","#374151"],driver:["#f97316","#1f2937"],soldier:["#4d7c0f","#1f2937"],child:["#e879f9","#334155"],doctor:["#f8fafc","#475569"]};
    const colors=palette[String(entity.look||"")]||palette.field,shirt=colors[0],pants=colors[1];
    const skin=String(entity.skin||"#d7a47f");
    ctx.save();ctx.translate(x,y-bob);ctx.globalAlpha=entity.secured?.44:1;
    ellipse(ctx,2,25+bob,21,7,"rgba(2,6,23,.38)");
    line(ctx,pants,7,[[-5,8],[-9-stride*.5,24]]);line(ctx,pants,7,[[5,8],[10+stride*.5,24]]);
    ellipse(ctx,-10-stride*.5,26,6,2.8,"#111827");ellipse(ctx,11+stride*.5,26,6,2.8,"#111827");
    ctx.fillStyle=shirt;rounded(ctx,-11,-7,22,22,5);ctx.fill();ctx.strokeStyle="rgba(255,255,255,.34)";ctx.lineWidth=1.5;ctx.stroke();
    line(ctx,shirt,7,[[-8,-2],[-16,9+stride*.22]]);line(ctx,shirt,7,[[8,-2],[16,8-stride*.22]]);
    ellipse(ctx,-16,10+stride*.22,3.5,4,skin);ellipse(ctx,16,9-stride*.22,3.5,4,skin);
    ellipse(ctx,0,-16,9,10,skin);ctx.fillStyle="#3f2d22";ctx.beginPath();ctx.arc(0,-19,9,Math.PI,TAU);ctx.fill();ctx.fillRect(-8,-21,16,4);
    ctx.fillStyle="#111827";ctx.beginPath();ctx.arc(-3,-16.8,1.2,0,TAU);ctx.arc(3,-16.8,1.2,0,TAU);ctx.fill();ctx.strokeStyle=entity.injured?"#991b1b":"#7c2d12";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-12.6,3,entity.injured?Math.PI*1.15:.12*Math.PI,entity.injured?Math.PI*1.85:.88*Math.PI);ctx.stroke();
    if(entity.injured){ctx.strokeStyle="#f8fafc";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-11,2);ctx.lineTo(8,12);ctx.stroke();ctx.fillStyle="#ef4444";ctx.fillRect(-4,5,6,6);}
    ctx.restore();
    return {x,y,labelY:y-42};
  }

  function drawTiger(ctx,entity={},options={}){
    const x=Number(entity.x)||0,y=Number(entity.y)||0;
    const boss=!!entity.boss,scale=Number(options.scale)||(boss?1.28:(entity.type==="Armored"?1.08:.98));
    const facing=Number(options.facing)<0?-1:1,walking=!!options.walking,phase=Number(options.phase)||0;
    const stride=walking?Math.sin(phase)*7:0,bob=walking?Math.abs(Math.sin(phase))*1.8:0;
    const id=String(entity.id||""),ghost=/ghost|shade|phantom/i.test(id),blood=/blood/i.test(id),ancient=/ancient/i.test(id);
    const coat=blood?"#b91c1c":(ghost?"#dbeafe":(ancient?"#facc15":"#f59e0b"));
    const dark=blood?"#7f1d1d":(ghost?"#94a3b8":(ancient?"#a16207":"#c76808"));
    ctx.save();ctx.translate(x,y-bob);ctx.scale(facing*scale,scale);
    ellipse(ctx,0,25+bob,46,10,"rgba(2,6,23,.42)");

    // Tail, body and chest silhouette.
    ctx.strokeStyle=coat;ctx.lineWidth=11;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-31,1);ctx.bezierCurveTo(-56,-18,-72,-12,-69,9);ctx.bezierCurveTo(-67,20,-78,22,-81,13);ctx.stroke();
    ctx.strokeStyle="#111827";ctx.lineWidth=3;for(const t of [[-48,-8,-55,1],[-61,-5,-67,4],[-70,4,-76,9]]){ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(t[2],t[3]);ctx.stroke();}
    const body=ctx.createLinearGradient(-35,-18,35,19);body.addColorStop(0,dark);body.addColorStop(.35,coat);body.addColorStop(.72,coat);body.addColorStop(1,dark);ctx.fillStyle=body;ctx.beginPath();ctx.ellipse(-3,0,39,22,-.03,0,TAU);ctx.fill();ellipse(ctx,18,3,20,22,coat,.12);ellipse(ctx,1,12,27,9,ghost?"#f8fafc":"#fed7aa");

    // Four legs use actual movement, never an idle clock animation.
    const legs=[[-24,-stride],[-10,stride],[8,-stride],[22,stride]];
    for(const [lx,swing] of legs){line(ctx,dark,8,[[lx,11],[lx+swing*.55,28-Math.abs(swing)*.1]]);line(ctx,coat,5,[[lx,12],[lx+swing*.55,27-Math.abs(swing)*.1]]);ellipse(ctx,lx+swing*.55,29,7,3,"#18181b");}

    // Head, muzzle, ears, eyes and whiskers.
    ellipse(ctx,32,-8,18,17,coat);ctx.fillStyle=coat;ctx.beginPath();ctx.moveTo(20,-19);ctx.lineTo(22,-34);ctx.lineTo(32,-22);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(35,-23);ctx.lineTo(44,-34);ctx.lineTo(47,-17);ctx.closePath();ctx.fill();
    ctx.fillStyle="#fda4af";ctx.beginPath();ctx.moveTo(24,-23);ctx.lineTo(24,-29);ctx.lineTo(29,-23);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(39,-25);ctx.lineTo(43,-29);ctx.lineTo(44,-22);ctx.closePath();ctx.fill();
    ellipse(ctx,42,-4,12,9,ghost?"#f8fafc":"#ffedd5");ellipse(ctx,48,-6,3.5,2.7,"#111827");
    ellipse(ctx,28,-11,3.4,3,"#111827");ellipse(ctx,39,-12,3.4,3,"#111827");ellipse(ctx,29,-12,1.1,1.1,"#fef08a");ellipse(ctx,40,-13,1.1,1.1,"#fef08a");
    ctx.strokeStyle="#111827";ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(48,-2);ctx.quadraticCurveTo(45,3,40,1);ctx.stroke();ctx.strokeStyle="#f8fafc";ctx.lineWidth=1.2;for(const wy of [-7,-3,1]){ctx.beginPath();ctx.moveTo(45,wy);ctx.lineTo(62,wy-3);ctx.stroke();}

    // Body and facial stripes are clipped to the animal, not an oval marker.
    ctx.strokeStyle="#111827";ctx.lineWidth=4;for(const sx of [-27,-14,-1,12,23]){ctx.beginPath();ctx.moveTo(sx,-18);ctx.lineTo(sx+8,10);ctx.stroke();}
    ctx.lineWidth=3;for(const sy of [-17,-10]){ctx.beginPath();ctx.moveTo(22,sy);ctx.lineTo(31,sy+5);ctx.stroke();ctx.beginPath();ctx.moveTo(44,sy+1);ctx.lineTo(37,sy+5);ctx.stroke();}
    if(entity.type==="Armored"){ctx.fillStyle="rgba(51,65,85,.88)";rounded(ctx,-19,-19,34,14,5);ctx.fill();ctx.strokeStyle="#cbd5e1";ctx.lineWidth=2;ctx.stroke();}
    if(boss){ctx.fillStyle="rgba(127,29,29,.48)";ctx.beginPath();ctx.arc(28,-8,24,Math.PI*.6,Math.PI*1.65);ctx.strokeStyle="#fb7185";ctx.lineWidth=4;ctx.stroke();}
    ctx.restore();
    return {x,y,labelY:y-(boss?79:61),barY:y-(boss?67:50)};
  }

  function storyFamilyForLevel(level=1){
    const chapter=clamp(Math.ceil(Math.max(1,Number(level)||1)/10),1,10);
    return ["forest","suburbs","forest","downtown","suburbs","industrial","forest","downtown","suburbs","industrial"][chapter-1];
  }

  function seeded(index,seed=17){
    const value=Math.sin((index+1)*12.9898+seed*78.233)*43758.5453;
    return value-Math.floor(value);
  }

  function drawStoryMapFoundation(ctx,options={}){
    const worldW=Math.max(900,Number(options.worldW)||900),worldH=Math.max(760,Number(options.worldH)||760);
    const view=options.view||{x:0,y:0,w:worldW,h:worldH},family=String(options.family||storyFamilyForLevel(options.level));
    const visible=(x,y,pad=100)=>x>=view.x-pad&&x<=view.x+view.w+pad&&y>=view.y-pad&&y<=view.y+view.h+pad;
    const path=(points,width,color,edge="rgba(15,23,42,.45)",dash=false)=>{
      ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=edge;ctx.lineWidth=width+14;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();
      ctx.strokeStyle=family==="forest"?"rgba(214,180,125,.36)":"rgba(250,204,21,.78)";ctx.lineWidth=Math.max(3,width*.055);ctx.setLineDash(dash?[22,24]:[36,30]);ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();ctx.setLineDash([]);
    };
    const tree=(x,y,s=1)=>{if(!visible(x,y,42*s))return;ellipse(ctx,x+5*s,y+17*s,25*s,8*s,"rgba(2,6,23,.32)");ctx.fillStyle="#6b4428";rounded(ctx,x-5*s,y-3*s,10*s,28*s,3*s);ctx.fill();for(const [dx,dy,r,c] of [[0,-11,20,"#166534"],[-14,-4,15,"#15803d"],[14,-3,15,"#14532d"],[-5,-23,14,"#22c55e"],[8,-21,13,"#16a34a"]])ellipse(ctx,x+dx*s,y+dy*s,r*s,r*s,c);};
    const house=(x,y,s=1)=>{if(!visible(x,y,75*s))return;ellipse(ctx,x+5*s,y+24*s,38*s,10*s,"rgba(2,6,23,.32)");ctx.fillStyle="#d9c7a3";rounded(ctx,x-34*s,y-21*s,68*s,48*s,6*s);ctx.fill();ctx.fillStyle="#8f5437";ctx.beginPath();ctx.moveTo(x-42*s,y-17*s);ctx.lineTo(x,y-48*s);ctx.lineTo(x+42*s,y-17*s);ctx.closePath();ctx.fill();ctx.fillStyle="#5b4333";ctx.fillRect(x-6*s,y+2*s,13*s,25*s);ctx.fillStyle="#7dd3fc";ctx.fillRect(x-25*s,y-9*s,13*s,11*s);ctx.fillRect(x+13*s,y-9*s,13*s,11*s);};
    const building=(x,y,w,h)=>{if(!visible(x,y,Math.max(w,h)))return;ctx.fillStyle="rgba(2,6,23,.35)";rounded(ctx,x-w/2+9,y-h/2+11,w,h,7);ctx.fill();const g=ctx.createLinearGradient(x-w/2,y-h/2,x+w/2,y+h/2);g.addColorStop(0,"#64748b");g.addColorStop(1,"#273449");ctx.fillStyle=g;rounded(ctx,x-w/2,y-h/2,w,h,7);ctx.fill();ctx.strokeStyle="#94a3b8";ctx.lineWidth=2;ctx.stroke();for(let row=0;row<3;row++)for(let col=0;col<3;col++){ctx.fillStyle=(row+col)%2?"#7dd3fc":"#334155";ctx.fillRect(x-w*.31+col*w*.23,y-h*.28+row*h*.22,w*.12,h*.11);}};

    const palettes={forest:["#17492e","#0f2f20"],suburbs:["#276641","#174b31"],downtown:["#26394a","#172534"],industrial:["#4a463d","#292b2d"]};
    const colors=palettes[family]||palettes.forest,g=ctx.createLinearGradient(0,0,0,worldH);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);ctx.fillStyle=g;ctx.fillRect(view.x,view.y,view.w,view.h);
    const tile=96,startX=Math.floor(view.x/tile)*tile,startY=Math.floor(view.y/tile)*tile;for(let y=startY;y<view.y+view.h+tile;y+=tile)for(let x=startX;x<view.x+view.w+tile;x+=tile){ctx.fillStyle=(Math.floor(x/tile)+Math.floor(y/tile))%2?"rgba(255,255,255,.025)":"rgba(2,6,23,.035)";ctx.fillRect(x,y,tile,tile);}

    if(family==="forest"){
      path([[0,worldH*.18],[worldW*.25,worldH*.29],[worldW*.49,worldH*.23],[worldW*.75,worldH*.35],[worldW,worldH*.28]],72,"#665038","rgba(31,41,30,.68)",true);
      path([[0,worldH*.55],[worldW*.24,worldH*.48],[worldW*.47,worldH*.54],[worldW*.69,worldH*.42],[worldW,worldH*.49]],88,"#70583e","rgba(31,41,30,.68)",true);
      path([[0,worldH*.79],[worldW*.28,worldH*.72],[worldW*.51,worldH*.78],[worldW*.73,worldH*.66],[worldW,worldH*.72]],80,"#69533b","rgba(31,41,30,.68)",true);
      for(let i=0;i<190;i++){const x=50+seeded(i,23)*(worldW-100),y=55+seeded(i,61)*(worldH-110);const band=[.18,.29,.23,.35,.28];if(Math.abs(y-worldH*(band[i%band.length]||.5))<75)continue;tree(x,y,.72+seeded(i,91)*.38);}
    }else if(family==="suburbs"){
      const roads=[worldH*.21,worldH*.52,worldH*.80];for(const y of roads)path([[0,y],[worldW*.25,y-worldH*.015],[worldW*.5,y+worldH*.018],[worldW*.75,y-worldH*.012],[worldW,y]],96,"#4b5563","#26303d");
      path([[worldW*.18,0],[worldW*.20,worldH*.3],[worldW*.18,worldH*.62],[worldW*.21,worldH]],78,"#4b5563","#26303d");path([[worldW*.70,0],[worldW*.72,worldH*.34],[worldW*.70,worldH*.65],[worldW*.73,worldH]],78,"#4b5563","#26303d");
      for(let i=0;i<48;i++){const col=i%8,row=Math.floor(i/8),x=worldW*(.08+col*.12),y=worldH*(.10+row*.16);house(x,y,.82+((i%3)*.08));}
      for(let i=0;i<52;i++)tree(40+seeded(i,33)*(worldW-80),40+seeded(i,79)*(worldH-80),.65+seeded(i,17)*.28);
    }else if(family==="downtown"){
      const xs=[.12,.32,.52,.72,.90].map(v=>worldW*v),ys=[.15,.36,.58,.80].map(v=>worldH*v);for(const x of xs)path([[x,0],[x,worldH]],92,"#475569","#172033");for(const y of ys)path([[0,y],[worldW,y]],96,"#475569","#172033");
      for(let i=0;i<38;i++){const x=worldW*(.05+(i%6)*.17),y=worldH*(.08+Math.floor(i/6)*.15);building(x,y,105+(i%3)*22,76+(i%4)*14);}
    }else{
      ctx.fillStyle="rgba(245,158,11,.08)";for(let i=0;i<7;i++){const x=worldW*(.08+i*.14);ctx.save();ctx.translate(x,worldH*.18);ctx.rotate(-.42);ctx.fillRect(-8,-160,16,320);ctx.restore();}
      path([[0,worldH*.48],[worldW,worldH*.48]],108,"#44464b","#202226");path([[worldW*.52,0],[worldW*.52,worldH]],96,"#44464b","#202226");
      for(let i=0;i<24;i++){const x=worldW*(.08+(i%6)*.17),y=worldH*(.16+Math.floor(i/6)*.22);building(x,y,130+(i%3)*28,88+(i%2)*32);}
      ctx.strokeStyle="rgba(250,204,21,.48)";ctx.lineWidth=7;for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(worldW*(.04+i*.08),worldH*.69);ctx.lineTo(worldW*(.09+i*.08),worldH*.79);ctx.stroke();}
    }
    return {family};
  }

  function drawBattlefieldFinish(ctx,view={},options={}){
    const x=Number(view.x)||0,y=Number(view.y)||0,w=Math.max(1,Number(view.w)||1),h=Math.max(1,Number(view.h)||1),now=Number(options.now)||0;
    ctx.save();
    const sunlight=ctx.createLinearGradient(x,y,x+w,y+h);sunlight.addColorStop(0,"rgba(254,240,138,.105)");sunlight.addColorStop(.44,"rgba(134,239,172,.028)");sunlight.addColorStop(1,"rgba(15,23,42,.16)");ctx.fillStyle=sunlight;ctx.fillRect(x,y,w,h);
    for(let i=0;i<26;i++){const px=x+((i*311+73)%Math.ceil(w)),py=y+((i*179+41)%Math.ceil(h));ctx.strokeStyle=i%3?"rgba(220,252,231,.13)":"rgba(253,224,71,.10)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py+5);ctx.quadraticCurveTo(px+Math.sin(now/800+i)*3,py,px+2,py-8);ctx.stroke();}
    ctx.restore();
  }

  return Object.freeze({VERSION,storyFamilyForLevel,drawStoryMapFoundation,drawSoldier,drawCivilian,drawTiger,drawBattlefieldFinish});
});
