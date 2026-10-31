(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./water-terrain'):root.TigerWaterTerrain,typeof module==='object'&&module.exports?require('./chapter-maps'):root.TigerChapterMaps,typeof module==='object'&&module.exports?require('./tiger-encounters'):root.TigerEncounters,typeof module==='object'&&module.exports?require('./mission-routes'):root.TigerMissionRoutes,typeof module==='object'&&module.exports?require('./field-operations'):root.TigerFieldOperations);
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.TigerStrikeBattlefieldRenderer=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(waterTerrain,chapterMaps,encounters,routes,fields){
  "use strict";

  const VERSION="10.22";
  const TAU=Math.PI*2;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

  // Presentation-only clearance. Objectives reserve their whole marker/label
  // area; actors use a cutaway so walk-through background art cannot hide them.
  function sceneryOpacity(bounds,zones=[]){
    let alpha=1;
    for(const p of zones){
      if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))continue;
      const r=Math.max(0,Number(p.r)||0);
      if(p.x+r<bounds.x||p.x-r>bounds.x+bounds.w||p.y+r<bounds.y||p.y-r>bounds.y+bounds.h)continue;
      if(p.objective)return 0;
      alpha=.18;
    }
    return alpha;
  }

  // The same route shapes are consumed by Solo collision and its boundary art.
  // Water is a slowing surface, not a hard blocker, except an active flood.
  function routeBlockers(state={},now=Date.now()){
    const out=[],tw=state.missionTwists||{};
    const add=(p,r,label)=>{if(Number.isFinite(p?.x)&&Number.isFinite(p?.y))out.push({x:p.x,y:p.y,r:Math.max(0,Number(r)||0),label});};
    if(tw.bridge?.active&&now<Number(tw.bridge.until||0))add(tw.bridge,tw.bridge.r,'BRIDGE CLOSED');
    for(const it of state.mapInteractables||[]){
      if(it?.routeOpen===false&&(it.kind==='bridge'||it.kind==='gate'))add(it,it.kind==='bridge'?62:48,it.kind==='bridge'?'REPAIR BRIDGE':'OPEN GATE');
    }
    const flood=tw.worldEvent;
    if(flood?.active&&flood.type==='flooded_route'&&now<Number(flood.until||0))add(flood,flood.r,'FLOODED • ROUTE CLOSED');
    return out;
  }

  function drawCollisionBoundary(ctx,shape,options={}){
    const circle=Number.isFinite(shape.r),x=Number(shape.x),y=Number(shape.y);
    const w=circle?shape.r*2:Number(shape.w),h=circle?shape.r*2:Number(shape.h),view=options.view;
    if(!Number.isFinite(x+y+w+h)||w<=0||h<=0)return;
    const left=circle?x-shape.r:x,top=circle?y-shape.r:y;
    if(view&&(left+w<view.x-70||top+h<view.y-70||left>view.x+view.w+70||top>view.y+view.h+70))return;
    ctx.save();ctx.globalAlpha=1;
    ctx.fillStyle=shape.label?'rgba(127,29,29,.24)':'rgba(18,28,35,.22)';
    ctx.strokeStyle=shape.label?'#fb923c':'#b3b8a6';ctx.lineWidth=2;
    ctx.beginPath();if(circle)ctx.arc(x,y,shape.r,0,TAU);else ctx.rect(x,y,w,h);ctx.fill();ctx.stroke();
    if(shape.label){
      ctx.save();ctx.clip();ctx.strokeStyle='rgba(251,146,60,.42)';ctx.lineWidth=3;
      for(let offset=-h;offset<w;offset+=18){ctx.beginPath();ctx.moveTo(left+offset,top+h);ctx.lineTo(left+offset+h,top);ctx.stroke();}ctx.restore();
      const label=String(shape.label),width=Math.min(230,Math.max(112,label.length*6.8));
      ctx.fillStyle='#17202b';rounded(ctx,left+w/2-width/2,top-26,width,22,5);ctx.fill();
      ctx.fillStyle='#ffdfb1';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText(label,left+w/2,top-11);
    }
    ctx.restore();
  }

  function drawObjectiveBeacon(ctx,point,view){
    const x=Number(point?.x),y=Number(point?.y);if(!Number.isFinite(x)||!Number.isFinite(y))return;
    if(view&&(x<view.x-80||y<view.y-80||x>view.x+view.w+80||y>view.y+view.h+100))return;
    const label=String(point.label||'OBJECTIVE'),width=Math.min(230,Math.max(96,label.length*6.5));
    ctx.save();ctx.globalAlpha=1;ctx.strokeStyle=point.color||'#67e8f9';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x,y-8);ctx.lineTo(x,y-34);ctx.stroke();
    ctx.fillStyle='#101e2b';rounded(ctx,x-width/2,y-58,width,23,5);ctx.fill();ctx.stroke();
    ctx.fillStyle='#f0fdfa';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText(label,x,y-42);ctx.restore();
  }

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
  const NPC_UNIFORMS=Object.freeze({government:Object.freeze({body:'#586c78',light:'#9bacb4',dark:'#273b48',vest:'#314b5a',helmet:'#536b79',trim:'#b8d5df'})});
  function drawSwimming(ctx,entity,options,paint,animal=false){
    const x=Number(entity.x)||0,y=Number(entity.y)||0,scale=Number(options.scale)||1,now=Number(options.now??Date.now()),phase=now/230;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    for(let i=0;i<3;i++){
      ctx.strokeStyle=`rgba(186,235,236,${.55-i*.13})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.ellipse(-i*5,3+i*4,(animal?35:21)+i*5,5+i*2,0,0,TAU);ctx.stroke();
    }
    // Paddles alternate at the waterline; legs are submerged, not walking.
    for(const side of [-1,1])line(ctx,animal?'#c78d42':(options.uniformPalette?.body||'#687d53'),animal?4:5,[[side*(animal?20:9),0],[side*(animal?29:20),Math.sin(phase+side)*4+2]]);
    ctx.restore();ctx.save();ctx.beginPath();ctx.rect(x-130*scale,y-140*scale,260*scale,140*scale);ctx.clip();
    const drawn=paint(ctx,{...entity,y:y+(animal?5:15)*scale+Math.sin(phase)*.6},{...options,swimming:false,walking:false,running:false,pouncing:false,blend:0});ctx.restore();
    return {...drawn,x,y,labelY:y-(animal?63:43)*scale,barY:y+28*scale};
  }
  function drawSoldier(ctx,entity={},options={}){
    if(options.swimming&&!entity.downed)return drawSwimming(ctx,entity,options,drawSoldier);
    const x=Number(entity.x)||0,y=Number(entity.y)||0,face=Number(entity.face)||0;
    const blend=clamp(options.blend??(options.walking?1:0),0,1),phase=Number(options.phase)||0;
    const downed=!!entity.downed,facing=Math.cos(face)<0?-1:1;
    const reaction=downed?0:clamp(options.reaction,0,1);
    const mine=!!options.mine,accent=downed?"#fb7185":(mine?"#67e8f9":"#c4b5fd");
    const elite=entity.eliteAppearance||options.eliteAppearance||{};
    const role=String(entity.role||"support"),cloth=globalThis.TigerEliteCatalog?.palettes[elite.soldier]||options.uniformPalette||NPC_UNIFORMS[role]||{};
    const body=cloth.body||"#456b48",light=cloth.light||"#83a66b",dark=cloth.dark||"#263d32";
    const vest=cloth.vest||"#293e3a",helmet=cloth.helmet||"#567b49",trim=cloth.trim||"#c6d49b";
    const tailoring=elite.soldier==='midnight'?'night':elite.soldier==='recruit_uniform'?'rescue':SOLDIER_TAILORING[body]||"ranger";
    const stride=Math.sin(phase)*5.4*blend,lift=Math.max(0,Math.cos(phase))*2.5*blend;
    const bob=Math.abs(Math.cos(phase))*1.1*blend,scale=clamp(options.scale??1,.25,4);
    const box=(x,y,w,h,color,r=2)=>{ctx.fillStyle=color;rounded(ctx,x,y,w,h,r);ctx.fill();};
    ctx.save();ctx.translate(x,y);ctx.scale(facing*scale,scale);
    ellipse(ctx,0,27,20,5,"rgba(2,6,23,.38)");
    ctx.translate(0,-bob+(downed?8:0));
    if(reaction>0){ctx.translate(-reaction*1.8,reaction*1.5);ctx.rotate(-reaction*.085);}
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
    ctx.save();ctx.translate(0,-5);ctx.rotate(aim+reaction*.14);ctx.translate(-recoil,0);
    line(ctx,dark,6,[[-9,-4],[-11,3],[3,3]]);
    line(ctx,body,4,[[-9,-4],[-11,3],[3,3]]);
    line(ctx,dark,6,[[9,-4],[14,2],[18,-1]]);
    line(ctx,body,4,[[9,-4],[14,2],[18,-1]]);
    box(-5,0,8,4,"#26353c");box(15,-3,5,4,"#26353c");
    box(-3,-5,25,6,"#19272f");box(1,-5,17,2,"#63767d",1);
    box(22,-4,9,3,"#8b999a",1);box(29,-5,3,5,"#1c2a31",1);
    box(5,1,5,7,"#273640",1);box(11,-8,8,3,"#1d2c32",1);box(16,-7,2,1,"#90cbd2",.5);
    box(-9,-4,7,4,dark,1);line(ctx,trim,.7,[[-7,-3],[-3,-3]]);
    if(elite.weapon==='guardian'||elite.weapon==='recruit_finish'){
      box(0,-5,21,3,elite.weapon==='guardian'?'#35c4bc':'#e99542',1);line(ctx,'#f1e4b8',1,[[4,-4],[18,-4]]);
      if(elite.weapon==='guardian'){box(11,-9,10,3,'#8fe5d4',1);box(6,1,4,7,'#2f9f9b',1);}
    }
    ctx.restore();
    if(elite.badge==='recruit_badge'){box(-4,-8,8,7,'#f9df86',1);line(ctx,'#296675',1.5,[[-2,-5],[0,-3],[3,-7]]);}
    if(role==="medic"||role==="rescue"){
      box(-5,-11,10,7,"#edf3df",1);box(-1,-10,2,5,"#c9584b",.5);box(-3,-8,6,1.5,"#c9584b",.5);
    }
    if(options.showMarker!==false){line(ctx,accent,2.2,[[-13,15],[-7,17],[7,17],[13,15]]);}
    ctx.restore();
    return {x,y,labelY:y-43,barY:y+34,accent};
  }

  function drawCivilian(ctx,entity={},options={}){
    if(options.swimming&&!entity.secured)return drawSwimming(ctx,entity,options,drawCivilian);
    const x=Number(entity.x)||0,y=Number(entity.y)||0,face=Number(options.face??entity.face)||0;
    const phase=Number(options.phase)||0,now=Number(options.now??Date.now());
    const blend=entity.secured?0:clamp(options.blend??(options.walking?1:0),0,1);
    const child=entity.child===true||entity.look==="child",scale=clamp(options.scale??1,.25,4)*(child?.76:1);
    const look=String(entity.look||"field"),palette={field:["#bd913f","#384c50"],medic:["#ebeee0","#53646b"],doctor:["#ebeee0","#53646b"],scout:["#508b91","#3a4d57"],driver:["#c38343","#38464d"],soldier:["#627d48","#38483a"],child:["#b987a6","#3e4d59"]};
    const colors=palette[look]||palette.field,shirt=entity.shirt||colors[0],pants=entity.pants||colors[1],skin=entity.skin||"#d8a47d";
    const injured=!!entity.injured||entity.aiState==="injured",panic=!!entity.panic||["critical","threatened"].includes(entity.riskState)||now<Number(entity._panicUntil||0);
    const cheer=clamp(options.celebration,0,1);
    const stride=Math.sin(phase)*5*blend,bob=Math.abs(Math.cos(phase))*.8*blend;
    const hair=Number(entity.hair)||0,facing=Math.cos(face)<0?-1:1;
    const box=(x,y,w,h,color,r=2)=>{ctx.fillStyle=color;rounded(ctx,x,y,w,h,r);ctx.fill();};
    ctx.save();ctx.translate(x,y);ctx.scale(facing*scale,scale);
    if(Number.isFinite(options.alpha))ctx.globalAlpha=clamp(options.alpha,0,1);
    else if(entity.secured)ctx.globalAlpha=.44;
    ellipse(ctx,2,27,17,4.5,"rgba(2,6,23,.32)");
    ctx.translate(0,-bob);
    for(const side of [-1,1]){
      const swing=side*stride*(injured&&side<0?.5:1),foot=side*5+swing;
      const lift=Math.max(0,Math.cos(phase+(side<0?Math.PI:0)))*2.5*blend;
      line(ctx,"#23343a",6,[[side*5,8],[side*5+swing*.4,17],[foot,25-lift]]);
      line(ctx,pants,4.5,[[side*5,8],[side*5+swing*.4,17],[foot,24-lift]]);
      box(foot-3,24-lift,8,3.8,"#1b282d");
      line(ctx,"#7c8781",.7,[[foot-1,27-lift],[foot+4,27-lift]]);
    }
    box(-10,-14,20,28,shirt,4);
    box(-9,-11,3,17,"rgba(255,244,215,.14)",1);
    box(6,-10,3,21,"rgba(9,29,37,.18)",1);
    line(ctx,"rgba(28,45,49,.38)",1,[[0,-11],[0,10]]);
    line(ctx,"rgba(243,232,204,.5)",1,[[-5,-13],[0,-8],[5,-13]]);
    box(-7,-5,5,6,"rgba(29,45,47,.20)",1);box(-8,10,16,3,pants,1);
    // Civilian sleeves, natural arm swing and hands use the soldier's detail level.
    for(const side of [-1,1]){
      const wave=injured&&side<0?0:cheer;
      const elbow=side*(12+Math.abs(stride)*.12),handY=5+side*stride*.35-wave*35;
      line(ctx,"rgba(27,40,44,.55)",5.8,[[side*9,-10],[elbow,-2-wave*16],[side*12,handY]]);
      line(ctx,shirt,4.5,[[side*9,-10],[elbow,-2-wave*16],[side*12,handY]]);
      ellipse(ctx,side*12,handY+1,2.5,3,skin);
    }
    if(look==="medic"||look==="doctor"){
      box(-8,-12,16,24,shirt,2);line(ctx,"#a0b4a6",1,[[-5,-11],[0,-5],[5,-11]]);
      box(4,-4,4,6,"#a5bfb1",1);box(5,-3,2,4,"#e4eddd",.5);
      if(entity.vip){line(ctx,"#4d6869",1.3,[[-5,-9],[-5,-1],[1,2],[5,-2],[5,-9]]);ellipse(ctx,1,2,2,2,"#5d7575");}
    }else if(look==="driver"){
      for(const px of [-7,5])box(px,-12,2,21,"#e2c67a",.5);
    }else if(look==="scout"){
      line(ctx,"#547167",2,[[-8,-12],[8,8]]);box(7,4,5,8,"#3b5750",1);
    }
    if(injured){
      line(ctx,"#e8e6d6",3,[[-8,-8],[8,7]]);
      box(-5,-2,5,5,"#efeddf",1);line(ctx,"#ac7266",1,[[-4,0],[-1,2]]);
    }
    // Same readable eyes, brows, nose and jaw treatment as the shared soldier.
    ellipse(ctx,-7.2,-22,2,3,skin);ellipse(ctx,7.2,-22,2,3,skin);
    ellipse(ctx,0,-23,7.7,8.7,skin);ellipse(ctx,-1,-25,4.8,3,"rgba(255,229,193,.18)",-.2);
    const hairColor=hair===1?"#604333":hair===2?"#263137":"#3b342c";
    ctx.fillStyle=hairColor;ctx.beginPath();ctx.ellipse(0,-28,8,5,0,Math.PI,TAU);ctx.fill();
    box(-8,-29,16,hair===1?5:3,hairColor,2);
    if(hair===2){ellipse(ctx,-7,-23,2.5,6,hairColor);ellipse(ctx,7,-23,2.5,6,hairColor);}
    if(hair===3)box(-7,-32,12,3,hairColor,1);
    const gaze=Math.abs(Math.cos(face))*.65;
    line(ctx,"#584435",.8,[[-5,-25],[-2,-25.3]]);line(ctx,"#584435",.8,[[2,-25.3],[5,-25]]);
    ellipse(ctx,-3+gaze,-23,1,1.2,"#243238");ellipse(ctx,3+gaze,-23,1,1.2,"#243238");
    ellipse(ctx,-2.7+gaze,-23.4,.3,.35,"#fff0d5");ellipse(ctx,3.3+gaze,-23.4,.3,.35,"#fff0d5");
    line(ctx,"rgba(139,89,64,.6)",.8,[[0,-22],[.7,-20],[-.4,-20]]);
    if(panic){ellipse(ctx,0,-17.5,1.8,2,"#785848");}
    else line(ctx,injured?"#946c61":"#79543f",.8,[[-2,-17],[0,injured?-17.7:-16.5],[2,-17]]);
    ctx.restore();
    return {x,y,labelY:y-42*scale,barY:y+33*scale};
  }

  // Derive presentation from real state only; never alter damage, capture or AI.
  function tigerVisualState(entity={},options={}){
    const now=Number(options.now??Date.now()),hp=Number(entity.hp),max=Number(entity.hpMax);
    const asleep=!!entity.captured||!!entity.cage;
    const dead=!asleep&&(!!entity.carcass||!!entity.defeated||entity.alive===false||(Number.isFinite(hp)&&hp<=0));
    const tagged=!dead&&!asleep&&!!entity.tranqTagged;
    const slowed=!dead&&!asleep&&(!!entity.rubberSlowed||now<Number(entity.rubberSlowUntil||0));
    const injured=!dead&&!asleep&&max>0&&Number.isFinite(hp)&&hp/max<=.36;
    const lethal=!asleep&&!!entity.lethalWounded;
    const attack=options.attack||(entity.attackWarnings||[]).find(a=>now<Number(a.resolveAt)+420);
    const interrupted=now<Number(entity.holdUntil||0)||now<Number(entity.staggerUntil||0);
    const validAttack=!dead&&!asleep&&!interrupted&&attack&&Number(entity.lastRubberHitAt||0)<=Number(attack.startedAt||0);
    const strikeKind=String(attack?.kind||'pounce'),groundStrike=['claw','bite','strike'].includes(strikeKind);
    const warning=!dead&&!asleep&&!interrupted&&(validAttack&&now<Number(attack.resolveAt)||now<Number(entity.pounceWindupUntil||0));
    const pounceProgress=validAttack&&now>=Number(attack.resolveAt)?clamp((now-Number(attack.resolveAt))/420,0,1):
      options.pouncing&&Number(entity.pounceWindupUntil)>0?clamp((now-Number(entity.pounceWindupUntil))/Math.max(420,Number(entity.huntStateUntil||0)-Number(entity.pounceWindupUntil)),0,1):0;
    const striking=!!validAttack&&now>=Number(attack.resolveAt)&&now<Number(attack.resolveAt)+420;
    const pouncing=!dead&&!asleep&&!warning&&!groundStrike&&(pounceProgress>0&&pounceProgress<1||!!options.pouncing);
    const awareness=String(entity.awarenessState||"calm").toLowerCase();
    const aggressive=!dead&&!asleep&&(warning||pouncing||options.roaring||["attacking","blood_frenzy"].includes(awareness));
    const labels=asleep?["TRANQUILIZED"]:dead?["DEAD"]:lethal?["LETHAL WOUND"]:tagged?["TRANQ TAGGED"]:warning?[`${strikeKind.toUpperCase()} — DODGE!`]:pouncing?["POUNCE"]:striking?[strikeKind.toUpperCase()]:aggressive?[awareness==="blood_frenzy"?"BLOOD FRENZY":"AGGRESSIVE"]:injured?["WEAKENED"]:[];
    if(!asleep&&!dead&&slowed)labels.push("SLOWED");
    const healthLabel=lethal?'INJURED':'WEAKENED';
    if(!asleep&&!dead&&injured&&!labels.includes(healthLabel))labels.push(healthLabel);
    const cue=(encounters||globalThis.TigerEncounters)?.intent(entity,now,{attack});
    return {asleep,dead,tagged,slowed,injured,lethal,warning:!!warning,pouncing:!!pouncing,pounceProgress,aggressive,striking,strikeKind,cue,label:labels.join(" • ")};
  }
  function drawTiger(ctx,entity={},options={}){
    if(options.swimming&&!entity.captured&&!entity.carcass&&Number(entity.hp)>0)return drawSwimming(ctx,entity,options,drawTiger,true);
    const now=Number(options.now??Date.now()),state=tigerVisualState(entity,{...options,now});
    const x=Number(entity.x)||0,y=Number(entity.y)||0,boss=!!entity.boss;
    const scale=clamp(options.scale??(boss?1.28:entity.type==="Armored"?1.08:.98),.2,4);
    const facing=Number(options.facing)<0?-1:1,phase=Number(options.phase)||0;
    const moving=!!options.walking&&!state.asleep&&!state.dead&&!state.warning;
    const running=moving&&(options.running||options.gait==="run"||options.gait==="sprint");
    const stride=moving?Math.sin(phase)*(running?10:5):0;
    const leap=state.pouncing?(state.pounceProgress>0?Math.sin(state.pounceProgress*Math.PI):.85):0;
    const posture=state.cue?.pose||{head:0,ears:0,tail:0,crouch:0};
    const crouch=state.warning?5:Math.max(options.crouching?2:0,posture.crouch);
    const bob=moving?Math.abs(Math.sin(phase))*(running?2.2:.7):0;
    const rest=state.asleep||state.dead;
    const motion=globalThis.TigerCombatFeel?.settings().reducedFlashes ? .3 : 1;
    const hitLeft=Number(entity.hitFlashUntil||entity.hitUntil||0)-now;
    const hitReaction=hitLeft>0&&hitLeft<400?Math.sin(Math.PI*clamp(hitLeft/320,0,1))*motion:0;
    const reaction=rest?0:Math.max(clamp(options.reaction,0,1),hitReaction);
    const identity=String(entity.id||"")+" "+String(entity.name||entity.alias||"");
    const ghost=/ghost|shade|phantom/i.test(identity),blood=/blood/i.test(identity),ancient=/ancient/i.test(identity);
    const colors=options.palette||{};
    const coat=colors.body||(blood?"#b9432f":ghost?"#dbe6ed":ancient?"#eabd48":"#e89432");
    const dark=blood?"#682c26":ghost?"#91a6b3":ancient?"#9d7024":"#a85520";
    const stripe=colors.stripe||"#242b2b",cream=colors.belly||(ghost?"#f4f8fa":"#ffedc9");
    const hit=!globalThis.TigerCombatFeel?.settings().reducedFlashes&&now<Number(entity.hitFlashUntil||entity.hitUntil||0);
    const legBase=rest?17:26;
    const box=(x,y,w,h,color,r=2)=>{ctx.fillStyle=color;rounded(ctx,x,y,w,h,r);ctx.fill();};
    ctx.save();ctx.translate(x,y);ctx.scale(facing*scale,scale);
    ellipse(ctx,-2,28,39-leap*4,5-leap,"rgba(2,6,23,.32)");
    ctx.translate(0,crouch-bob-leap*9+(rest?13:0));
    if(reaction>0||leap>0){ctx.rotate(-reaction*.10-leap*.12*motion);ctx.translate(-reaction*2,reaction*2);}
    // Tail, body and chest silhouette: a flexible spine, not a sliding oval.
    const tailWave=(moving?Math.sin(phase-.7)*(running?7:3):0)+(rest?0:posture.tail);
    line(ctx,dark,6,[[-29,-3],[-45,-8+tailWave],[-57,-17+tailWave*.5],[-62,-15+tailWave*.4]]);
    line(ctx,coat,4.5,[[-29,-4],[-45,-9+tailWave],[-57,-18+tailWave*.5],[-62,-16+tailWave*.4]]);
    for(let i=0;i<4;i++)line(ctx,stripe,2,[[-42-i*5,-7-i*2+tailWave*.7],[-44-i*5,-11-i*2+tailWave*.7]]);
    function leg(lx,index,front){
      const paired=index===0||index===3;
      const swing=rest?0:state.pouncing?(lx<0?-12:16):state.striking&&lx>0?Math.sin(state.pounceProgress*Math.PI)*15:(paired?stride:-stride)*(state.injured&&index===2?.45:1);
      const lift=moving?Math.max(0,Math.cos(phase+(paired?0:Math.PI)))*(running?6:3):0;
      const knee=lx+swing*.4+(front?2:-3),foot=lx+swing;
      const fy=legBase-lift-crouch-(state.pouncing?5:0);
      line(ctx,dark,7,[[lx,7],[knee,16],[foot,fy]]);
      line(ctx,front?coat:dark,4.5,[[lx,7],[knee,16],[foot,fy-1]]);
      line(ctx,stripe,2,[[knee-2,14],[knee+2,17]]);
      ellipse(ctx,foot+2,fy+1,5.5,2.8,cream);
      for(let n=0;n<2;n++)line(ctx,"#bda98d",.6,[[foot+n*2,fy],[foot+1+n*2,fy+2]]);
    }
    // Four articulated legs are distance-driven; idle tigers do not tread in place.
    leg(-18,0,false);leg(14,1,false);
    ctx.save();
    if(rest){ctx.translate(0,1);ctx.scale(1,.67);}
    const body=ctx.createLinearGradient(0,-21,0,19);
    body.addColorStop(0,dark);body.addColorStop(.26,coat);body.addColorStop(.67,coat);body.addColorStop(1,cream);
    ellipse(ctx,-5,-1,33,18,body,-.04);ellipse(ctx,-22,1,16,17,coat,-.16);
    ellipse(ctx,17,-3,17,20,coat,.14);ellipse(ctx,0,11,24,5.5,cream);
    // Tapered stripes and short fur marks stay clipped inside the coat silhouette.
    ctx.save();ctx.beginPath();ctx.ellipse(-5,-1,33,18,-.04,0,TAU);ctx.clip();
    for(let i=0;i<7;i++){
      const sx=-32+i*8.5;
      ctx.fillStyle=stripe;ctx.beginPath();ctx.moveTo(sx,-21);ctx.bezierCurveTo(sx+1,-11,sx+9,-6,sx+4,12);
      ctx.bezierCurveTo(sx+12,2,sx+8,-10,sx+5,-21);ctx.closePath();ctx.fill();
      if(i%2===0)line(ctx,stripe,1.3,[[sx+7,-5],[sx+12,2],[sx+10,7]]);
    }
    for(let i=0;i<18;i++){
      const fx=-30+(i%9)*6.5,fy=-12+Math.floor(i/9)*16;
      line(ctx,i%3===0?cream:dark,.65,[[fx,fy],[fx+3,fy+1.2]]);
    }
    ctx.restore();
    // Chest ruff breaks up the outline and catches the same warm rim light.
    for(let i=0;i<5;i++){
      ctx.fillStyle=i%2?coat:cream;ctx.beginPath();ctx.moveTo(19+i*.8,-3+i*3);
      ctx.lineTo(30+i*.5,1+i*3);ctx.lineTo(23+i*.5,5+i*3);ctx.fill();
    }
    if(entity.type==="Armored"){
      box(-19,-20,31,11,"#425360",3);line(ctx,"#b2c3c8",1,[[-16,-18],[9,-18]]);
      for(const px of [-13,-3,7])ellipse(ctx,px,-14,1,1,"#d3dfe1");
    }
    ctx.restore();
    leg(-26,2,true);leg(21,3,true);
    // Head, muzzle, ears, eyes and whiskers.
    const headY=-11+(rest?7:state.injured?Math.max(3,posture.head):posture.head),headX=30+(state.pouncing?4:0);
    ctx.save();ctx.translate(headX,headY);
    const earTilt=rest?0:posture.ears;
    ellipse(ctx,-6,-11,5.5,6,stripe,earTilt);ellipse(ctx,6,-12,5.5,6,stripe,-earTilt);
    ellipse(ctx,-6,-11,3.2,3.6,coat,earTilt);ellipse(ctx,6,-12,3.2,3.6,coat,-earTilt);
    ellipse(ctx,-6,-11,1.5,2,"#c98f7a",earTilt);ellipse(ctx,6,-12,1.5,2,"#c98f7a",-earTilt);
    ellipse(ctx,0,0,15,14,coat,.08);ellipse(ctx,-6,6,8,7,cream,-.1);
    ellipse(ctx,10,5,10,7,cream);ellipse(ctx,17,2,3.2,2.4,"#353333");
    line(ctx,stripe,2,[[-11,-7],[-4,-3],[-9,0]]);line(ctx,stripe,2,[[1,-12],[3,-7],[0,-5]]);
    line(ctx,stripe,2,[[8,-10],[7,-6],[11,-4]]);
    if(rest){
      line(ctx,stripe,1.4,[[2,-2],[8,-1]]);
    }else{
      ellipse(ctx,5,-3,3.4,2.6,cream);
      if(state.tagged)line(ctx,stripe,1.5,[[2,-3],[8,-3]]);
      else{
        ellipse(ctx,5,-3,2.2,state.aggressive?1.7:2.2,state.aggressive?"#ff9b64":"#cfb754");
        ellipse(ctx,5.5,-3,.8,1.9,stripe);ellipse(ctx,6,-3.8,.6,.6,"#fff7e0");
      }
    }
    line(ctx,stripe,1,[[17,4],[16,8],[11,9]]);
    if((state.aggressive||state.striking)&&!rest){ellipse(ctx,13,10,6,state.strikeKind==='bite'&&state.striking?6:3.5,"#542e2c");line(ctx,cream,1.5,[[11,8],[12,11]]);line(ctx,cream,1.5,[[16,8],[15,11]]);}
    for(let i=0;i<3;i++)line(ctx,cream,.7,[[11,5+i*2],[25,2+i*4]]);
    for(const [dx,dy] of [[9,4],[12,5],[10,7]])ellipse(ctx,dx,dy,.6,.6,stripe);
    ctx.restore();
    if(state.tagged&&!rest){
      line(ctx,"#8eddd9",1.7,[[-13,-6],[-20,-14]]);box(-22,-17,5,4,"#b6f3f0",1);
    }
    if(state.slowed&&!rest)line(ctx,"#83cedd",1.5,[[-18,18],[-10,21],[-3,18]]);
    if(state.lethal&&!rest)line(ctx,"#8a3d32",1.7,[[-16,-4],[-11,1],[-13,5]]);
    if(hit){ctx.strokeStyle=state.slowed?"#a5dce9":"#f0c79e";ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(8,-6,6,0,TAU);ctx.stroke();}
    ctx.restore();
    if(options.showState!==false&&state.label){
      ctx.save();ctx.font="800 9px system-ui";ctx.textAlign="center";ctx.textBaseline="middle";
      const w=Math.min(210,Math.max(90,state.label.length*5.7));
      ctx.fillStyle="rgba(6,17,24,.9)";rounded(ctx,x-w/2,y+35*scale,w,17,5);ctx.fill();
      ctx.fillStyle=state.asleep||state.tagged?"#b3e7df":state.lethal?"#ffb7a8":state.aggressive?"#ffc3a5":"#e5d9bd";
      ctx.fillText(state.label,x,y+43.5*scale);
      ctx.restore();
    }
    return {x,y,labelY:y-(boss?79:61),barY:y-(boss?67:50),state};
  }

  function storyFamilyForLevel(level=1){
    const chapter=clamp(Math.ceil(Math.max(1,Number(level)||1)/10),1,10);
    return ["forest","suburbs","forest","downtown","suburbs","industrial","forest","downtown","suburbs","industrial"][chapter-1];
  }

  function seeded(index,seed=17){
    const value=Math.sin((index+1)*12.9898+seed*78.233)*43758.5453;
    return value-Math.floor(value);
  }

  // Shared map art only. These helpers never create terrain, collision or objectives.
  function drawGroundTexture(ctx,view={},options={}){
    if(globalThis.TigerSmoothPlay?.policy().battery)options={...options,heavy:true};
    const x=Number(view.x)||0,y=Number(view.y)||0,w=Math.max(1,Number(view.w)||1),h=Math.max(1,Number(view.h)||1);
    const heavy=!!options.heavy,urban=/downtown|industrial/i.test(String(options.family||""));
    const step=Math.max(heavy?96:56,Math.ceil(Math.sqrt(w*h/(heavy?100:220))/8)*8);
    const x0=Math.floor(x/step)*step,y0=Math.floor(y/step)*step;
    ctx.save();
    for(let py=y0;py<y+h+step;py+=step)for(let px=x0;px<x+w+step;px+=step){
      const index=Math.floor(px/step)*173+Math.floor(py/step)*317;
      const n=seeded(index,43),gx=px+n*step*.7,gy=py+seeded(index,71)*step*.7;
      if(urban){
        ctx.fillStyle=n>.5?"rgba(202,197,171,.12)":"rgba(2,12,18,.15)";ctx.fillRect(gx,gy,2+n*3,1);
      }else{
        ellipse(ctx,gx+3,gy+3,8+n*8,2+n*2,"rgba(12,39,26,.12)",-.3);
        line(ctx,n>.5?"rgba(170,206,113,.26)":"rgba(59,119,67,.38)",.9,[[gx-3,gy+3],[gx-5,gy-3],[gx-6,gy-4]]);
        line(ctx,"rgba(152,194,105,.24)",.9,[[gx,gy+3],[gx+1,gy-5],[gx+3,gy-7]]);
        if(!heavy)line(ctx,"rgba(198,213,139,.19)",.7,[[gx+3,gy+3],[gx+6,gy-2]]);
      }
      if(n>.72){ctx.fillStyle="rgba(225,219,164,.16)";ctx.fillRect(gx+12,gy+4,2,1);}
    }
    ctx.restore();
  }
  function drawMapTree(ctx,x,y,size=1,options={}){
    const s=clamp(size,.25,3),heavy=!!options.heavy;
    const opacity=sceneryOpacity({x:x-38*s,y:y-47*s,w:80*s,h:76*s},options.clearZones);
    if(!opacity)return;
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    if(opacity<1)ctx.globalAlpha*=opacity;
    // One consistent top-left sun; cast shadows always fall down and right.
    ellipse(ctx,12,19,30,9,"rgba(5,24,22,.24)",.3);
    ellipse(ctx,4,22,12,4,"rgba(2,15,19,.25)");
    const trunk=ctx.createLinearGradient(-6,0,7,0);trunk.addColorStop(0,"#a87943");trunk.addColorStop(.42,"#76502f");trunk.addColorStop(1,"#3f3425");
    ctx.fillStyle=trunk;ctx.beginPath();ctx.moveTo(-5,25);ctx.lineTo(-4,-14);ctx.lineTo(3,-17);ctx.lineTo(6,25);ctx.closePath();ctx.fill();
    line(ctx,"#5b432b",2,[[-1,8],[-10,-9]]);line(ctx,"#ad8049",1,[[-2,17],[-1,-6]]);
    const clusters=[[-18,-6,16], [15,-5,18],[0,-12,23],[-12,-22,17],[9,-26,16],[0,-32,13]];
    for(const [dx,dy,r] of clusters){
      const crown=ctx.createRadialGradient(dx-r*.3,dy-r*.38,1,dx,dy,r);
      crown.addColorStop(0,"#66a953");crown.addColorStop(.45,"#37894b");crown.addColorStop(1,"#185638");
      ellipse(ctx,dx,dy,r,r*.88,crown);
      if(!heavy)for(let i=0;i<3;i++){
        const lx=dx-r*.45+i*r*.3,ly=dy-r*.22+(i%2)*4;
        ellipse(ctx,lx,ly,3.2,1.5,"rgba(190,216,118,.22)",-.4);
      }
    }
    line(ctx,"rgba(153,199,106,.38)",1.3,[[-25,-10],[-20,-16],[-15,-17]]);
    ctx.restore();
  }
  function drawMapHouse(ctx,x,y,w,h,options={}){
    const roof=String(options.roof||"#965a3e"),rise=Number(options.roofRise??28),s=clamp(w/150,.4,2.5);
    const opacity=sceneryOpacity({x:x-8*s,y:y-rise,w:w+22*s,h:h+rise+14*s},options.clearZones);
    if(!opacity)return;
    ctx.save();
    if(opacity<1)ctx.globalAlpha*=opacity;
    ctx.fillStyle="rgba(5,23,25,.25)";ctx.beginPath();ctx.moveTo(x+7,y+4);ctx.lineTo(x+w+13,y+16);ctx.lineTo(x+w+13,y+h+13);ctx.lineTo(x+8,y+h+8);ctx.closePath();ctx.fill();
    const wall=ctx.createLinearGradient(x,y,x+w,y+h);wall.addColorStop(0,"#eddfba");wall.addColorStop(.55,"#d3c09a");wall.addColorStop(1,"#a99476");
    ctx.fillStyle=wall;rounded(ctx,x,y,w,h,5*s);ctx.fill();
    ctx.fillStyle="rgba(86,70,53,.20)";ctx.fillRect(x+w*.88,y,w*.12,h);
    line(ctx,"#f0dfb9",1.5*s,[[x+2,y+h],[x+2,y+8]]);
    ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x-7*s,y+6*s);ctx.lineTo(x+w*.5,y-rise);ctx.lineTo(x+w+7*s,y+6*s);ctx.closePath();ctx.fill();
    ctx.save();ctx.beginPath();ctx.moveTo(x-7*s,y+6*s);ctx.lineTo(x+w*.5,y-rise);ctx.lineTo(x+w+7*s,y+6*s);ctx.closePath();ctx.clip();
    for(let row=0;row<4;row++){
      const yy=y-rise+7*s+row*8*s;
      line(ctx,"rgba(250,202,147,.26)",.9*s,[[x,yy],[x+w,yy]]);
      for(let col=0;col<6;col++){const xx=x+col*w/6+(row%2)*w/12;line(ctx,"rgba(55,32,27,.22)",.8*s,[[xx,yy],[xx+4*s,yy+7*s]]);}
    }
    ctx.restore();
    line(ctx,"rgba(255,222,168,.60)",1.5*s,[[x-5*s,y+4*s],[x+w*.5,y-rise+2*s]]);
    ctx.fillStyle="rgba(61,39,29,.25)";ctx.fillRect(x,y+6*s,w,5*s);
    const doorX=x+w*.42,doorY=y+h*.46,doorW=w*.18,doorH=h*.54;
    ctx.fillStyle="#66503a";ctx.fillRect(doorX-2*s,doorY-2*s,doorW+4*s,doorH+2*s);
    ctx.fillStyle="#785536";ctx.fillRect(doorX,doorY,doorW,doorH);
    line(ctx,"#a17a4a",1*s,[[doorX+doorW*.3,doorY+2*s],[doorX+doorW*.3,y+h-2*s]]);
    ellipse(ctx,doorX+doorW*.78,doorY+doorH*.55,1.4*s,1.4*s,"#e3be68");
    ctx.fillStyle="#a4977c";ctx.fillRect(doorX-4*s,y+h-2*s,doorW+8*s,4*s);
    for(const wx of [x+w*.12,x+w*.70]){
      const wy=y+h*.25,ww=w*.18,hh=h*.22;
      ctx.fillStyle="#7d6d53";ctx.fillRect(wx-2*s,wy-2*s,ww+4*s,hh+4*s);
      const glass=ctx.createLinearGradient(wx,wy,wx+ww,wy+hh);glass.addColorStop(0,"#c0e5dd");glass.addColorStop(1,"#629da5");
      ctx.fillStyle=glass;ctx.fillRect(wx,wy,ww,hh);
      line(ctx,"#e6d8ad",1.5*s,[[wx+ww*.5,wy],[wx+ww*.5,wy+hh]]);
      line(ctx,"rgba(250,255,229,.54)",1*s,[[wx+2*s,wy+hh*.6],[wx+ww*.55,wy+2*s]]);
      ctx.fillStyle="#94886a";ctx.fillRect(wx-3*s,wy+hh,ww+6*s,3*s);
    }
    ctx.restore();
  }
  function drawMapWaterSurface(ctx,trace,bounds={},options={}){
    if(globalThis.TigerSmoothPlay?.policy().battery)options={...options,heavy:true};
    const x=Number(bounds.x)||0,y=Number(bounds.y)||0,w=Math.max(1,Number(bounds.w)||1),h=Math.max(1,Number(bounds.h)||1);
    ctx.save();
    trace(ctx);ctx.strokeStyle="#756f4d";ctx.lineWidth=12;ctx.stroke();
    const water=ctx.createLinearGradient(x,y,x+w*.4,y+h);
    water.addColorStop(0,"#5dada6");water.addColorStop(.18,"#338f96");water.addColorStop(1,options.deepColor||"#205867");
    ctx.fillStyle=water;trace(ctx);ctx.fill();
    ctx.save();trace(ctx);ctx.clip();
    ctx.strokeStyle="rgba(173,218,176,.55)";ctx.lineWidth=6;trace(ctx);ctx.stroke();
    ctx.strokeStyle="rgba(214,240,217,.40)";ctx.lineWidth=1.3;trace(ctx);ctx.stroke();
    const visible=options.view||{x,y,w,h};
    const fromY=Math.max(y,Number(visible.y)||0),toY=Math.min(y+h,(Number(visible.y)||0)+(Number(visible.h)||h));
    const fromX=Math.max(x,Number(visible.x)||0),toX=Math.min(x+w,(Number(visible.x)||0)+(Number(visible.w)||w));
    const now=Number(options.now??Date.now()),flow=(now*.025)%120;
    const gap=options.heavy?46:28;
    for(let py=Math.floor(fromY/gap)*gap;py<toY+gap;py+=gap)for(let px=Math.floor(fromX/120)*120;px<toX+120;px+=120){
      const n=seeded(Math.floor(px/120)*37+Math.floor(py/gap)*61,19);
      const sx=px+flow,sy=py+Math.sin(now/900+px*.01)*2;
      line(ctx,n>.5?"rgba(188,233,224,.23)":"rgba(12,68,88,.22)",1,[[sx+12,sy],[sx+38+n*30,sy-2],[sx+64+n*20,sy]]);
    }
    // Small fish schools and drifting highlights stay clipped beneath water.
    if(options.fish!==false)for(let py=Math.floor(fromY/180)*180;py<toY+180;py+=180)for(let px=Math.floor(fromX/260)*260;px<toX+260;px+=260){
      const n=seeded(Math.floor(px/260)*13+Math.floor(py/180)*7,38),fx=px+40+((now*.012+n*170)%190),fy=py+70+Math.sin(now/1600+n*6)*12;
      for(let f=0;f<(options.heavy?1:3);f++){
        const xx=fx-f*13,yy=fy+f*7;ellipse(ctx,xx,yy,5,1.8,'rgba(13,61,67,.50)');
        line(ctx,'rgba(113,173,158,.55)',1,[[xx-4,yy],[xx-8,yy-3],[xx-8,yy+3],[xx-4,yy]]);
      }
    }
    ctx.restore();ctx.restore();
  }
  function drawMapWater(ctx,zone={},options={}){
    const x=Number(zone.x)||0,y=Number(zone.y)||0,rx=Math.max(1,Number(zone.rx)||180),ry=Math.max(1,Number(zone.ry)||90),rot=Number(zone.rot)||0;
    const ex=Math.hypot(rx*Math.cos(rot),ry*Math.sin(rot)),ey=Math.hypot(rx*Math.sin(rot),ry*Math.cos(rot)),v=options.view;
    if(v&&(x+ex*1.12<v.x||x-ex*1.12>v.x+v.w||y+ey*1.8<v.y||y-ey*1.8>v.y+v.h))return;
    const points=waterTerrain.outline({...zone,x,y,rx,ry,rot},options.view);
    const trace=c=>{c.beginPath();c.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))c.lineTo(p[0],p[1]);c.closePath();};
    // Both rendering and swim/depth checks use this same natural shoreline.
    drawMapWaterSurface(ctx,trace,{x:x-ex*1.12,y:y-ey*1.8,w:ex*2.24,h:ey*3.6},options);
  }
  function drawWaterBridges(ctx,zones=[],options={}){
    for(const zone of zones)for(const b of zone.bridges||[]){
      const v=options.view;if(v&&(b.x+b.w<v.x||b.x>v.x+v.w||b.y+b.h<v.y||b.y>v.y+v.h))continue;
      ctx.save();ctx.fillStyle='#765a3b';ctx.fillRect(b.x,b.y,b.w,b.h);
      for(let y=b.y+3;y<b.y+b.h;y+=12){ctx.strokeStyle='#bd945d';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(b.x,y);ctx.lineTo(b.x+b.w,y);ctx.stroke();}
      ctx.strokeStyle='#d7c39a';ctx.lineWidth=5;for(const x of [b.x+3,b.x+b.w-3]){ctx.beginPath();ctx.moveTo(x,b.y-6);ctx.lineTo(x,b.y+b.h+6);ctx.stroke();}ctx.restore();
    }
  }
  function drawRainPuddles(ctx,view={},options={}){
    if(!['rain','storm'].includes(String(options.weather||'')))return;
    const now=Number(options.now??Date.now()),zones=options.waterZones||[],blocked=options.blockedRects||[];
    for(let y=Math.floor(view.y/210)*210;y<view.y+view.h;y+=210)for(let x=Math.floor(view.x/230)*230;x<view.x+view.w;x+=230){
      const n=seeded(Math.floor(x/230)*19+Math.floor(y/210)*29,83),px=x+50+n*90,py=y+60+n*65,rx=14+n*17,ry=5+n*6;
      if(zones.some(z=>waterTerrain.overlaps(z,{x:px-rx,y:py-ry,w:rx*2,h:ry*2},8))||blocked.some(b=>px+rx>=b.x&&px-rx<=b.x+b.w&&py+ry>=b.y&&py-ry<=b.y+b.h))continue;
      const points=waterTerrain.outline({kind:'puddle',x:px,y:py,rx,ry,rot:n});ctx.save();ctx.fillStyle='rgba(129,179,186,.27)';ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();ctx.clip();
      const r=3+((now/400+n*4)%1)*12;ctx.strokeStyle='rgba(213,238,237,.48)';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(px,py,r,r*.3,0,0,TAU);ctx.stroke();ctx.restore();
    }
  }

  function drawMapLighting(ctx,view={}){
    const x=Number(view.x)||0,y=Number(view.y)||0,w=Math.max(1,Number(view.w)||1),h=Math.max(1,Number(view.h)||1);
    ctx.save();const light=ctx.createLinearGradient(x,y,x+w,y+h);
    light.addColorStop(0,"rgba(255,232,174,.055)");light.addColorStop(.5,"rgba(255,255,255,0)");light.addColorStop(1,"rgba(10,32,39,.065)");
    ctx.fillStyle=light;ctx.fillRect(x,y,w,h);ctx.restore();
  }

  function territorySites(tigers=[],view={}){
    const sites=[];
    for(const t of tigers){
      if(!t||t.alive===false||t.defeated||t.captured||t.faction==='government'||!(t.hp>0))continue;
      const p=t._encounterHome||{x:t.baseX,y:t.baseY};
      if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<view.x-40||p.x>view.x+view.w+40||p.y<view.y-40||p.y>view.y+view.h+40||sites.some(s=>Math.hypot(s.x-p.x,s.y-p.y)<120))continue;
      sites.push({x:p.x,y:p.y});if(sites.length===3)break;
    }
    return sites;
  }
  function drawTerritoryClues(ctx,tigers,view,options={}){
    const sites=territorySites(tigers,view);
    ctx.save();
    for(const site of sites){
      if(sceneryOpacity({x:site.x-38,y:site.y-22,w:76,h:44},options.clearZones)===0)continue;
      ctx.fillStyle='rgba(35,26,15,.58)';
      for(let i=0;i<6;i++){
        const x=site.x-32+i*12,y=site.y+(i%2?7:-7);
        ctx.beginPath();ctx.ellipse(x,y,3.5,2.7,-.35,0,TAU);ctx.fill();
        for(let j=0;j<3;j++){ctx.beginPath();ctx.ellipse(x-3+j*2.7,y-4.5,1.1,1.5,0,0,TAU);ctx.fill();}
      }
      ctx.strokeStyle='rgba(179,188,104,.58)';ctx.lineWidth=1.5;ctx.beginPath();
      for(let i=0;i<5;i++){const x=site.x-20+i*10;ctx.moveTo(x,site.y+17);ctx.quadraticCurveTo(x+3,site.y+13,x+9,site.y+14);}ctx.stroke();
    }
    ctx.restore();return sites;
  }

  function drawStoryMapFoundation(ctx,options={}){
    options={...options,clearZones:[...(options.clearZones||[]),...(routes?.shelters(options.routesEnabled===false?0:options.level,{width:options.worldW,height:options.worldH})||[]).map(s=>({...s,r:120,objective:true})),...(fields?.fixtures(options.fieldsEnabled===false?0:options.level,{width:options.worldW,height:options.worldH})||[]).map(s=>({...s,r:100,objective:true}))]};
    const chapterMap=Number(options.level)>0?chapterMaps?.forMission(options.level):null;
    if(chapterMap)options={...options,family:chapterMap.family,waterZones:chapterMap.waterZones};
    const random=(i,salt)=>seeded(i+(chapterMap?.seed||0),salt);
    const worldW=Math.max(900,Number(options.worldW)||900),worldH=Math.max(760,Number(options.worldH)||760);
    const view=options.view||{x:0,y:0,w:worldW,h:worldH},family=String(options.family||storyFamilyForLevel(options.level));
    const visible=(x,y,pad=100)=>x>=view.x-pad&&x<=view.x+view.w+pad&&y>=view.y-pad&&y<=view.y+view.h+pad;
    const roadSegments=[];
    const onRoad=(x,y,pad)=>roadSegments.some(([points,width])=>points.slice(1).some((b,i)=>{const a=points[i],dx=b[0]-a[0],dy=b[1]-a[1],u=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(x-a[0]-dx*u,y-a[1]-dy*u)<width/2+pad;}));
    const wet=(x,y,pad)=>(options.waterZones||[]).some(zone=>waterTerrain.overlaps(zone,{x:x-pad,y:y-pad,w:pad*2,h:pad*2}));
    const path=(points,width,color,edge="rgba(15,23,42,.45)",dash=false)=>{
      roadSegments.push([points,width]);
      ctx.save();
      for(const zone of options.waterZones||[]){const bank=waterTerrain.outline(zone,view);ctx.beginPath();ctx.rect(view.x-200,view.y-200,view.w+400,view.h+400);ctx.moveTo(...bank[0]);for(const p of bank.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.clip('evenodd');}
      ctx.lineCap="round";ctx.lineJoin="round";ctx.strokeStyle=edge;ctx.lineWidth=width+14;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();
      ctx.strokeStyle=family==="forest"?"rgba(214,180,125,.36)":"rgba(250,204,21,.78)";ctx.lineWidth=Math.max(3,width*.055);ctx.setLineDash(dash?[22,24]:[36,30]);ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    };
    const tree=(x,y,s=1)=>{if(visible(x,y,58*s)&&!onRoad(x,y,20*s)&&!wet(x,y,16*s))drawMapTree(ctx,x,y,s,{heavy:options.heavy,clearZones:options.clearZones});};
    const house=(x,y,s=1)=>{if(visible(x,y,85*s)&&!onRoad(x,y,43*s)&&!wet(x,y,40*s))drawMapHouse(ctx,x-34*s,y-21*s,68*s,48*s,{roof:'#8f5437',roofRise:27*s,clearZones:options.clearZones});};
    const building=(x,y,w,h)=>{
      if(!visible(x,y,Math.max(w,h))||wet(x,y,Math.max(w,h)*.65))return;
      const opacity=sceneryOpacity({x:x-w/2,y:y-h/2,w:w+12,h:h+14},options.clearZones);if(!opacity)return;
      ctx.save();if(opacity<1)ctx.globalAlpha*=opacity;
      ctx.fillStyle="rgba(2,6,23,.35)";rounded(ctx,x-w/2+9,y-h/2+11,w,h,7);ctx.fill();const g=ctx.createLinearGradient(x-w/2,y-h/2,x+w/2,y+h/2);g.addColorStop(0,"#64748b");g.addColorStop(1,"#273449");ctx.fillStyle=g;rounded(ctx,x-w/2,y-h/2,w,h,7);ctx.fill();ctx.strokeStyle="#94a3b8";ctx.lineWidth=2;ctx.stroke();for(let row=0;row<3;row++)for(let col=0;col<3;col++){ctx.fillStyle=(row+col)%2?"#7dd3fc":"#334155";ctx.fillRect(x-w*.31+col*w*.23,y-h*.28+row*h*.22,w*.12,h*.11);}ctx.restore();
    };

    const palettes={forest:["#17492e","#0f2f20"],suburbs:["#276641","#174b31"],downtown:["#26394a","#172534"],industrial:["#4a463d","#292b2d"]};
    const colors=chapterMap?.palette||palettes[family]||palettes.forest,g=ctx.createLinearGradient(0,0,0,worldH);g.addColorStop(0,colors[0]);g.addColorStop(1,colors[1]);ctx.fillStyle=g;ctx.fillRect(view.x,view.y,view.w,view.h);
    const tile=96,startX=Math.floor(view.x/tile)*tile,startY=Math.floor(view.y/tile)*tile;for(let y=startY;y<view.y+view.h+tile;y+=tile)for(let x=startX;x<view.x+view.w+tile;x+=tile){ctx.fillStyle=(Math.floor(x/tile)+Math.floor(y/tile))%2?"rgba(255,255,255,.025)":"rgba(2,6,23,.035)";ctx.fillRect(x,y,tile,tile);}
    drawGroundTexture(ctx,view,{family,heavy:options.heavy});
    // Ground clues belong below water, roads and scenery; never paint a paw
    // print over a roof or bridge. Anchors come from real tiger territories.
    drawTerritoryClues(ctx,options.tigers||[],view,options);
    for(const zone of options.waterZones||[])drawMapWater(ctx,zone,{view,heavy:options.heavy,now:options.now});
    drawRainPuddles(ctx,view,{weather:options.weather,now:options.now,waterZones:options.waterZones,blockedRects:options.blockedRects});

    if(family==="forest"){
      // A permanent north/south track connects the river bridge to both banks.
      path([[worldW*.5,0],[worldW*.5,worldH]],72,"#665038","rgba(31,41,30,.68)",true);
      path([[0,worldH*.18],[worldW*.25,worldH*.29],[worldW*.49,worldH*.23],[worldW*.75,worldH*.35],[worldW,worldH*.28]],72,"#665038","rgba(31,41,30,.68)",true);
      path([[0,worldH*.55],[worldW*.24,worldH*.48],[worldW*.47,worldH*.54],[worldW*.69,worldH*.42],[worldW,worldH*.49]],88,"#70583e","rgba(31,41,30,.68)",true);
      path([[0,worldH*.79],[worldW*.28,worldH*.72],[worldW*.51,worldH*.78],[worldW*.73,worldH*.66],[worldW,worldH*.72]],80,"#69533b","rgba(31,41,30,.68)",true);
      for(let i=0;i<190;i++){const x=50+random(i,23)*(worldW-100),y=55+random(i,61)*(worldH-110);const band=[.18,.29,.23,.35,.28];if(Math.abs(y-worldH*(band[i%band.length]||.5))<75)continue;tree(x,y,.72+random(i,91)*.38);}
      // Permanent ranger hamlets belong to the chapter, not one mission.
      for(const [x,y] of [[.10,.39],[.14,.39],[.38,.37],[.42,.37],[.62,.60],[.66,.60],[.83,.56],[.87,.56]])house(worldW*x,worldH*y,1.3);
    }else if(family==="suburbs"){
      const roads=[worldH*.21,worldH*.52,worldH*.80];for(const y of roads)path([[0,y],[worldW*.25,y-worldH*.015],[worldW*.5,y+worldH*.018],[worldW*.75,y-worldH*.012],[worldW,y]],96,"#4b5563","#26303d");
      path([[worldW*.18,0],[worldW*.20,worldH*.3],[worldW*.18,worldH*.62],[worldW*.21,worldH]],78,"#4b5563","#26303d");path([[worldW*.70,0],[worldW*.72,worldH*.34],[worldW*.70,worldH*.65],[worldW*.73,worldH]],78,"#4b5563","#26303d");
      for(let i=0;i<48;i++){const col=i%8,row=Math.floor(i/8),x=worldW*(.08+col*.12),y=worldH*(.10+row*.16);house(x,y,.82+((i%3)*.08));}
      for(let i=0;i<52;i++)tree(40+random(i,33)*(worldW-80),40+random(i,79)*(worldH-80),.65+random(i,17)*.28);
    }else if(family==="downtown"){
      const xs=[.12,.32,.52,.72,.90].map(v=>worldW*v),ys=[.15,.36,.58,.80].map(v=>worldH*v);for(const x of xs)path([[x,0],[x,worldH]],92,"#475569","#172033");for(const y of ys)path([[0,y],[worldW,y]],96,"#475569","#172033");
      for(let i=0;i<38;i++){const x=worldW*(.05+(i%6)*.17),y=worldH*(.08+Math.floor(i/6)*.15);building(x,y,105+(i%3)*22,76+(i%4)*14);}
    }else{
      ctx.fillStyle="rgba(245,158,11,.08)";for(let i=0;i<7;i++){const x=worldW*(.08+i*.14);ctx.save();ctx.translate(x,worldH*.18);ctx.rotate(-.42);ctx.fillRect(-8,-160,16,320);ctx.restore();}
      path([[0,worldH*.48],[worldW,worldH*.48]],108,"#44464b","#202226");path([[worldW*.52,0],[worldW*.52,worldH]],96,"#44464b","#202226");
      for(let i=0;i<24;i++){const x=worldW*(.08+(i%6)*.17),y=worldH*(.16+Math.floor(i/6)*.22);building(x,y,130+(i%3)*28,88+(i%2)*32);}
      ctx.strokeStyle="rgba(250,204,21,.48)";ctx.lineWidth=7;for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(worldW*(.04+i*.08),worldH*.69);ctx.lineTo(worldW*(.09+i*.08),worldH*.79);ctx.stroke();}
    }
    drawWaterBridges(ctx,options.waterZones,{view});
    routes?.drawShelters(ctx,options.routesEnabled===false?0:options.level,{width:worldW,height:worldH},view);
    return {family};
  }

  function drawBattlefieldFinish(ctx,view={},options={}){
    const x=Number(view.x)||0,y=Number(view.y)||0,w=Math.max(1,Number(view.w)||1),h=Math.max(1,Number(view.h)||1),now=Number(options.now)||0;
    ctx.save();
    drawMapLighting(ctx,{x,y,w,h});
    for(let i=0;i<26;i++){const px=x+((i*311+73)%Math.ceil(w)),py=y+((i*179+41)%Math.ceil(h));ctx.strokeStyle=i%3?"rgba(220,252,231,.13)":"rgba(253,224,71,.10)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py+5);ctx.quadraticCurveTo(px+Math.sin(now/800+i)*3,py,px+2,py-8);ctx.stroke();}
    ctx.restore();
  }

  return Object.freeze({VERSION,sceneryOpacity,routeBlockers,drawCollisionBoundary,drawObjectiveBeacon,storyFamilyForLevel,drawGroundTexture,drawMapTree,drawMapHouse,drawMapWaterSurface,drawMapWater,drawWaterBridges,drawRainPuddles,drawMapLighting,territorySites,drawTerritoryClues,drawStoryMapFoundation,drawSoldier,drawCivilian,tigerVisualState,drawTiger,drawBattlefieldFinish});
});
