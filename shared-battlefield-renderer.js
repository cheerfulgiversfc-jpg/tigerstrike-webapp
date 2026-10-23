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

  // Visual tailoring only: these profiles never enter combat, unlocks or inventory.
  const SOLDIER_TAILORING=Object.freeze({
    '#356e39':'ranger','#c97026':'rescue','#30416e':'night','#687d8f':'sentinel',
    '#218d92':'river','#b8c8d1':'mountain','#9e3745':'warden','#b28b27':'royal',
    '#75518e':'scout','#d4be86':'ancient'
  });
  function drawSoldier(ctx,entity={},options={}){
    const x=Number(entity.x)||0,y=Number(entity.y)||0,face=Number(entity.face)||0;
    const blend=clamp(options.blend??(options.walking?1:0),0,1),phase=Number(options.phase)||0;
    const downed=!!entity.downed,facing=Math.cos(face)<0?-1:1;
    const mine=!!options.mine,accent=downed?"#fb7185":(mine?"#67e8f9":"#c4b5fd");
    const role=String(entity.role||"support"),cloth=options.uniformPalette||{};
    const body=cloth.body||"#456b48",light=cloth.light||"#83a66b",dark=cloth.dark||"#263d32";
    const vest=cloth.vest||"#293e3a",helmet=cloth.helmet||"#567b49",trim=cloth.trim||"#c6d49b";
    const tailoring=SOLDIER_TAILORING[body]||"ranger";
    const stride=Math.sin(phase)*5.4*blend,lift=Math.max(0,Math.cos(phase))*2.5*blend;
    const bob=Math.abs(Math.cos(phase))*1.1*blend,scale=clamp(options.scale??1,.25,4);
    const box=(x,y,w,h,color,r=2)=>{ctx.fillStyle=color;rounded(ctx,x,y,w,h,r);ctx.fill();};
    ctx.save();ctx.translate(x,y);ctx.scale(facing*scale,scale);
    ellipse(ctx,0,27,20,5,"rgba(2,6,23,.38)");
    ctx.translate(0,-bob+(downed?8:0));
    // Independent articulated legs keep the character upright while walking.
    for(const side of [-1,1]){
      const swing=side*stride,hip=side*5.5,knee=hip+swing*.4,foot=hip+swing;
      const footY=25-(side===1?lift:Math.max(0,-Math.cos(phase))*2.5*blend);
      line(ctx,dark,7,[[hip,8],[knee,17],[foot,footY]]);
      line(ctx,body,5,[[hip,8],[knee,17],[foot,footY-2]]);
      box(knee-2.5,15,5,4,vest,1.5);
      box(foot-4,footY-1,10,4,"#111a20");
      line(ctx,"#67716c",.8,[[foot-2,footY+2],[foot+4,footY+2]]);
    }
    // Uniform, vest, belt, shoulder plates and backpack.
    box(-15,-12,7,22,dark,3);box(-16,-9,5,9,vest);
    line(ctx,"#15252b",1.3,[[-14,-10],[-16,-27]]);ellipse(ctx,-16,-27,1,1,trim);
    const fabric=ctx.createLinearGradient(-12,-14,12,15);
    fabric.addColorStop(0,light);fabric.addColorStop(.45,body);fabric.addColorStop(1,dark);
    box(-11,-14,22,28,fabric,5);
    for(const [cx,cy] of [[-8,-10],[4,-7],[-6,8],[6,11]]){
      box(cx,cy,4,2,light,1);box(cx+2,cy+2,3,2,dark,1);
    }
    box(-9,-12,18,23,vest,3);
    line(ctx,trim,1,[[-8,-10],[-8,8],[8,8],[8,-10]]);
    box(-7,-10,3,6,dark,1);box(4,-10,3,6,dark,1);
    for(const px of [-6,1]){
      box(px,-1,5,7,body,1);line(ctx,light,.7,[[px,1],[px+5,1]]);
    }
    box(-12,10,24,4,"#17232a");box(-2,10,4,4,trim,1);
    box(10,8,4,10,dark);box(-14,5,4,8,vest);
    // Each earned outfit keeps its identity with a distinct cut or field attachment.
    if(tailoring==="rescue"||tailoring==="river"){
      for(const px of [-9,6])box(px,-11,3,21,trim,1);
      if(tailoring==="river"){box(-12,-4,6,11,light);box(6,-4,6,11,light);}
    }else if(tailoring==="night"){
      box(-7,-8,14,3,dark);box(-15,-13,4,6,trim);
    }else if(tailoring==="sentinel"){
      box(-15,-16,8,6,vest);box(7,-16,8,6,vest);box(-5,-8,10,5,light);
    }else if(tailoring==="mountain"){
      box(-13,-17,26,5,light);line(ctx,trim,1.4,[[-12,0],[12,7]]);
      ellipse(ctx,-11,2,2.5,4,trim);
    }else if(tailoring==="warden"){
      line(ctx,trim,3,[[-9,-11],[7,8]]);box(9,3,5,8,light);
    }else if(tailoring==="royal"){
      box(-15,-16,8,4,trim);box(7,-16,8,4,trim);
      line(ctx,trim,1.5,[[-6,-8],[0,-4],[6,-8]]);
    }else if(tailoring==="scout"){
      box(-14,-15,5,23,dark);line(ctx,trim,1,[[-14,-13],[-17,8],[-10,6]]);
    }else if(tailoring==="ancient"){
      box(-8,-12,16,4,trim);line(ctx,trim,1.5,[[-6,-4],[0,1],[6,-4]]);
    }else{
      for(const px of [-12,9])box(px,-14,3,5,light,1);
    }

    // Face has features, hair/helmet, chin and headset.
    ellipse(ctx,-7.5,-23,2.5,3.5,"#bd825e");ellipse(ctx,7.5,-23,2.5,3.5,"#bd825e");
    ellipse(ctx,0,-23,8,9,"#d8a47d");ellipse(ctx,1,-21,6,6,"#e8b98f");
    box(-7,-28,14,2,"#614735",1);
    const look=Math.cos(face)*1.1*facing;
    line(ctx,"#493a2c",.9,[[-5,-25],[-2,-25.5]]);line(ctx,"#493a2c",.9,[[2,-25.5],[5,-25]]);
    ellipse(ctx,-3.2+look,-24,1.1,1.3,"#182b32");ellipse(ctx,3.2+look,-24,1.1,1.3,"#182b32");
    ellipse(ctx,-3+look,-24.5,.35,.4,"#fff3df");ellipse(ctx,3.4+look,-24.5,.35,.4,"#fff3df");
    line(ctx,"#b77c58",.8,[[.5,-23],[1,-20.5],[-.5,-20]]);
    line(ctx,"#754b37",.9,[[-2,-18],[2,-18]]);
    ctx.fillStyle=helmet;ctx.beginPath();ctx.ellipse(0,-29,10,7,0,Math.PI,TAU);ctx.fill();
    box(-10,-30,20,4,helmet);box(-8,-33,16,2,light,1);
    box(-3,-35,6,3,dark,1);box(-1,-34,2,1,trim,0.5);
    if(tailoring==="night"){box(-6,-31,5,4,dark,1);box(1,-31,5,4,dark,1);box(-5,-30,3,1,"#a3dfcd",.5);}
    if(tailoring==="scout")line(ctx,dark,2,[[-9,-32],[-11,-26]]);
    if(tailoring==="royal"||tailoring==="ancient")box(-2,-29,4,2,trim,1);
    line(ctx,"#1b2a31",2,[[-9,-26],[-10,-20],[-5,-19]]);
    ellipse(ctx,-10,-23,2.2,3,"#263a3e");ellipse(ctx,-5,-19,1,1,"#111c22");

    // Arms and weapon point toward the aim direction without rotating the body.
    // Mirroring handles left-facing aim; only the two-arm weapon rig pitches.
    const aim=Math.atan2(Math.sin(face),Math.abs(Math.cos(face)));
    const recoil=clamp(options.shotKick,0,1)*2;
    ctx.save();ctx.translate(0,-5);ctx.rotate(aim);ctx.translate(-recoil,0);
    line(ctx,dark,6,[[-9,-4],[-11,3],[3,3]]);
    line(ctx,body,4,[[-9,-4],[-11,3],[3,3]]);
    line(ctx,dark,6,[[9,-4],[14,2],[18,-1]]);
    line(ctx,body,4,[[9,-4],[14,2],[18,-1]]);
    box(-5,0,8,4,"#26353c");box(15,-3,5,4,"#26353c");
    box(-3,-5,25,6,"#19272f");box(1,-5,17,2,"#63767d",1);
    box(22,-4,9,3,"#8b999a",1);box(29,-5,3,5,"#1c2a31",1);
    box(5,1,5,7,"#273640",1);box(11,-8,8,3,"#1d2c32",1);box(16,-7,2,1,"#90cbd2",.5);
    box(-9,-4,7,4,dark,1);line(ctx,trim,.7,[[-7,-3],[-3,-3]]);
    ctx.restore();
    if(role==="medic"||role==="rescue"){
      box(-5,-11,10,7,"#edf3df",1);box(-1,-10,2,5,"#c9584b",.5);box(-3,-8,6,1.5,"#c9584b",.5);
    }
    if(options.showMarker!==false){line(ctx,accent,2.2,[[-13,15],[-7,17],[7,17],[13,15]]);}
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
    const encounterNow=Number(options.now||Date.now());
    const posture=typeof globalThis!=='undefined'?globalThis.TigerEncounters?.posture(entity,encounterNow):null;
    const x=Number(entity.x)||0,y=Number(entity.y)||0;
    const boss=!!entity.boss,scale=Number(options.scale)||(boss?1.28:(entity.type==="Armored"?1.08:.98));
    const facing=Number(options.facing)<0?-1:1,walking=!!options.walking,phase=Number(options.phase)||0;
    const stride=walking?Math.sin(phase)*7:0,bob=walking?Math.abs(Math.sin(phase))*1.8:0;
    const id=String(entity.id||""),ghost=/ghost|shade|phantom/i.test(id),blood=/blood/i.test(id),ancient=/ancient/i.test(id);
    const coat=posture?.hit?(entity.rubberSlowed?'#bae6fd':'#fda4af'):(blood?"#b91c1c":(ghost?"#dbeafe":(ancient?"#facc15":"#f59e0b")));
    const dark=blood?"#7f1d1d":(ghost?"#94a3b8":(ancient?"#a16207":"#c76808"));
    ctx.save();ctx.translate(x+(posture?.hit?Math.sin(encounterNow*.08)*3:0),y-bob+(posture?.warning?6:0));ctx.scale(facing*scale*(posture?.warning?1.12:1),scale*(posture?.warning?0.80:1));
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
