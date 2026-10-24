(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerBattlefieldAwareness=api;if(root?.document?.body)api.applyLayout();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const live=t=>t&&t.alive!==false&&!t.defeated&&!t.captured&&Number(t.hp)>0;
  let layoutCache;
  function layout(){if(layoutCache)return layoutCache;try{layoutCache=localStorage.getItem('ts_battle_controls_v1')==='docked'?'docked':'overlay';}catch(_){layoutCache='overlay';}return layoutCache;}
  function applyLayout(){if(typeof document==='undefined')return;document.body?.classList.toggle('battleControlsDocked',layout()==='docked');document.querySelectorAll('[data-battlefield-layout]').forEach(b=>{b.textContent=`Controls: ${layout()==='docked'?'Docked':'Overlay'}`;b.setAttribute('aria-pressed',String(layout()==='docked'));});}
  function toggleLayout(){layoutCache=layout()==='docked'?'overlay':'docked';try{localStorage.setItem('ts_battle_controls_v1',layoutCache);}catch(_){}applyLayout();if(typeof window!=='undefined')window.dispatchEvent(new Event('battlefield-layout-change'));return layoutCache;}
  function progress(s={}){
    const mission=s.mission||{},rows=[];
    const required=Math.max(0,Number(s.rescueRequired??mission.rescueRequired)||0);
    const safe=new Set(s.securedCivilianIds||(s.civilians||[]).filter(c=>c?.alive!==false&&(c.evac||c.secured)).map(c=>c.id)).size;
    if(required)rows.push(`Safe ${Math.min(safe,required)}/${required}`);
    const captureRequired=Math.max(0,Number(s.captureRequired??mission.captureRequired)||0);
    const captured=new Set(s.capturedIds||[]),named=mission.captureTargetIds||[];
    const count=s.captures!=null?Math.max(0,Number(s.captures)||0):(named.length?[...new Set(named)].filter(id=>captured.has(id)).length:captured.size);
    if(captureRequired&&!mission.survival)rows.push(`Captures ${Math.min(count,captureRequired)}/${captureRequired}`);
    const checkpointRequired=Math.max(0,Number(s.checkpointRequired??mission.checkpointRequired)||0);
    if(checkpointRequired)rows.push(`Locations ${Math.min(new Set(s.checkpointCompletedIds||[]).size,checkpointRequired)}/${checkpointRequired}`);
    rows.push(`Threats ${(s.tigers||[]).filter(live).length} left`);
    if(s.objectivesReady===true)rows.push('Extraction open');
    return rows.join(' • ');
  }
  function targets({player,teammate,civilians=[],tigers=[],objective=null,dangerCivilianId=null}={}){
    if(!valid(player))return [];
    const threats=tigers.filter(t=>live(t)&&valid(t));
    const exposed=civilians.filter(c=>valid(c)&&c.alive!==false&&!c.secured&&!c.evac&&(String(c.id)===String(dangerCivilianId)||threats.some(t=>{const dx=t.x-c.x,dy=t.y-c.y;return Math.abs(dx)<110&&Math.abs(dy)<110&&dx*dx+dy*dy<12100;})));
    exposed.sort((a,b)=>Math.hypot(a.x-player.x,a.y-player.y)-Math.hypot(b.x-player.x,b.y-player.y));
    const out=[];
    if(exposed[0])out.push({...exposed[0],key:`civilian:${exposed[0].id}`,label:'CIVILIAN IN DANGER',color:'#fda4af'});
    if(valid(teammate))out.push({...teammate,key:`team:${teammate.userId}`,label:teammate.online===false?'TEAM • OFFLINE':teammate.downed?'TEAM • DOWN':'TEAM',color:'#c4b5fd'});
    if(valid(objective))out.push({...objective,key:`objective:${objective.id||objective.action}`,label:String(objective.action||'NEXT OBJECTIVE').toUpperCase().slice(0,32),color:'#fde68a'});
    return out;
  }
  function edges({view,player,targets=[],mobile=false,docked=false}={}){
    if(!view||![view.x,view.y,view.w,view.h].every(Number.isFinite)||view.w<180||view.h<180||!valid(player))return [];
    const left=70,right=view.w-(mobile&&!docked?Math.min(200,view.w*.25):70),top=110,bottom=view.h-(mobile&&!docked?Math.min(210,view.h*.32):65);
    if(right<=left||bottom<=top)return [];
    const ox=clamp(player.x-view.x,left,right),oy=clamp(player.y-view.y,top,bottom),out=[];
    for(const target of targets){
      if(!valid(target)||out.length>=3)continue;
      const sx=target.x-view.x,sy=target.y-view.y;
      if(sx>=0&&sx<=view.w&&sy>=0&&sy<=view.h)continue;
      if(out.some(p=>Math.hypot(p.target.x-target.x,p.target.y-target.y)<70))continue;
      const dx=sx-ox,dy=sy-oy;
      const tx=dx>0?(right-ox)/dx:dx<0?(left-ox)/dx:Infinity,ty=dy>0?(bottom-oy)/dy:dy<0?(top-oy)/dy:Infinity;
      const scale=Math.max(0,Math.min(tx,ty));if(!Number.isFinite(scale))continue;
      let x=clamp(ox+dx*scale,left,right),y=clamp(oy+dy*scale,top,bottom);
      for(const previous of out)if(Math.hypot(x-previous.x,y-previous.y)<65)y=clamp(y+(y<view.h/2?65:-65),top,bottom);
      if(out.some(p=>Math.hypot(x-p.x,y-p.y)<50))continue;
      const distance=Math.round(Math.hypot(target.x-player.x,target.y-player.y));
      const width=Math.min(245,`${target.label} • ${distance}m`.length*6+14),lx=clamp(x,width/2+5,view.w-width/2-5);
      const box={left:lx-width/2,right:lx+width/2,top:y+16,bottom:y+39};
      if(out.some(p=>box.left<p.box.right+6&&box.right>p.box.left-6&&box.top<p.box.bottom+6&&box.bottom>p.box.top-6))continue;
      out.push({target,x,y,angle:Math.atan2(dy,dx),distance,box});
    }
    return out;
  }
  function draw(ctx,options){
    for(const marker of edges(options)){
      const {target,x,y,angle,distance}=marker;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=target.color||'#fde68a';ctx.strokeStyle='#07131f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-9,-9);ctx.lineTo(-5,0);ctx.lineTo(-9,9);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
      ctx.save();const text=`${target.label} • ${distance}m`,width=Math.min(245,text.length*6+14),lx=clamp(x,width/2+5,options.view.w-width/2-5);ctx.fillStyle='rgba(5,16,26,.94)';ctx.fillRect(lx-width/2,y+16,width,23);ctx.fillStyle=target.color||'#fde68a';ctx.font='900 10px system-ui';ctx.textAlign='center';ctx.fillText(text,lx,y+32,width-8);ctx.restore();
    }
  }
  return Object.freeze({layout,applyLayout,toggleLayout,progress,targets,edges,draw});
});
