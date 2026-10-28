(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerFieldOperations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const enabled=n=>Number.isInteger(Number(n))&&n>=1&&n<=30;
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const number=n=>Math.max(0,Math.min(999999,Math.floor(Number(n)||0))),clock=n=>Math.max(0,Math.min(9e12,Number(n)||0));
  function normalize(raw={}){return {collected:!!raw.collected,medkits:Math.min(1,number(raw.medkits)),armor:Math.min(1,number(raw.armor)),towerUntil:clock(raw.towerUntil),towerReadyAt:clock(raw.towerReadyAt),towerUses:number(raw.towerUses),healed:number(raw.healed),armored:number(raw.armored),leadTracked:!!raw.leadTracked,destination:['tower','cache'].includes(raw.destination)?raw.destination:''};}
  function fixtures(level,world){
    if(!enabled(level))return [];
    const layout=[[['Ranger Watchtower',.38,.37],['Mission Supply Cache',.67,.55]],[['Village Watchtower',.57,.37],['Escort Supply Cache',.39,.64]],[['Jungle Watchtower',.40,.62],['Research Supply Cache',.86,.39]]][Math.floor((Number(level)-1)/10)];
    return layout.map(([label,x,y],i)=>({id:i?'field_cache':'ranger_tower',kind:i?'cache':'tower',label,x:world.width*x,y:world.height*y}));
  }
  function lead(level,civilians=[],elapsed=0,rescuedAt=null){
    if(![1,4,7,11,16,17,21,26,27].includes(Number(level))||!civilians.length)return null;
    const target=[...civilians].sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];
    const status=rescuedAt!==null&&Number.isFinite(rescuedAt)?rescuedAt<60000?'early':rescuedAt<=150000?'rescued':'missed':elapsed<60000?'pending':elapsed<=150000?'active':'missed';
    return {id:target.id,x:target.x,y:target.y,name:target.name||'Civilian',status,remaining:Math.max(0,150000-elapsed)};
  }
  function act(raw,kind,{level,world,player,now=0,lead:opportunity=null}={}){
    if(!enabled(level))throw Error('Field actions are available in Story missions 1–30.');
    if(!(player?.hp>0)||player.downed)throw Error('Your soldier must be standing to use field actions.');
    const s=normalize(raw),site=fixtures(level,world).find(p=>p.kind===kind);let heal=0,armor=0;
    if(site&&(!valid(player)||dist(player,site)>110))throw Error(`Move within 110m of ${site.label}.`);
    if(kind==='locate-tower'||kind==='locate-cache'){s.destination=kind.slice(7);}
    else if(kind==='tower'){if(now<s.towerReadyAt)throw Error('The watchtower is recharging.');s.towerUntil=now+30000;s.towerReadyAt=now+45000;s.towerUses++;s.destination='';}
    else if(kind==='cache'){if(s.collected)throw Error('Your mission supplies have already been collected.');s.collected=true;s.medkits=1;s.armor=1;s.destination='';}
    else if(kind==='medkit'){if(!s.medkits||player.hp>=player.maxHp)throw Error('A field medkit and missing health are required.');heal=Math.min(40,player.maxHp-player.hp);s.medkits--;s.healed+=heal;}
    else if(kind==='armor'){if(!s.armor||player.armor>=player.armorCap)throw Error('A field armor plate and missing armor are required.');armor=Math.min(40,player.armorCap-player.armor);s.armor--;s.armored+=armor;}
    else if(kind==='lead'){if(opportunity?.status!=='active')throw Error('No active rescue lead right now.');s.leadTracked=true;s.destination='';}
    else throw Error('Choose a valid field action.');
    return {state:s,heal,armor};
  }
  function danger(route,tigers=[]){
    if(!route?.path?.length)return 0;
    return tigers.filter(t=>valid(t)&&t.alive!==false&&!t.defeated&&!t.captured&&t.hp>0&&route.path.slice(1).some((b,i)=>{const a=route.path[i],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((t.x-a.x)*dx+(t.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(t.x-a.x-dx*u,t.y-a.y-dy*u)<=180;})).length;
  }
  function destination(base,opportunity,s,level,world){if(/revive|restart|required.*(?:blocked|incomplete)/i.test(base?.action||''))return base;const site=world&&fixtures(level,world).find(p=>p.kind===s?.destination);if(site)return {...site,action:'Use Field Actions',label:site.label};return s?.leadTracked&&opportunity?.status==='active'&&/rescue civilian|rescue civil/i.test(base?.action||'')?{...opportunity,action:'Rescue lead',label:opportunity.name}:base;}
  function draw(ctx,{level,world,view,state,lead:opportunity,tigers=[],now=0}={}){
    if(!enabled(level))return;const s=normalize(state);ctx.save();
    for(const p of fixtures(level,world)){if(p.x<view.x-160||p.x>view.x+view.w+160||p.y<view.y-160||p.y>view.y+view.h+160)continue;
      ctx.strokeStyle='#c0d5bd';ctx.lineWidth=5;ctx.fillStyle='#65503a';
      if(p.kind==='tower'){ctx.beginPath();ctx.moveTo(p.x-28,p.y+15);ctx.lineTo(p.x-20,p.y-72);ctx.lineTo(p.x+20,p.y-72);ctx.lineTo(p.x+28,p.y+15);ctx.moveTo(p.x-22,p.y-35);ctx.lineTo(p.x+22,p.y-35);ctx.stroke();ctx.fillRect(p.x-32,p.y-85,64,21);ctx.fillStyle='#b6e5bf';ctx.fillRect(p.x-25,p.y-110,50,25);}
      else{ctx.fillStyle=s.collected?'#574f40':'#967342';ctx.fillRect(p.x-24,p.y-18,48,36);ctx.strokeRect(p.x-24,p.y-18,48,36);ctx.fillStyle='#eef7d9';ctx.fillRect(p.x-2,p.y-15,4,30);}
      ctx.fillStyle='#efffe3';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(p.label,p.x,p.y+(p.kind==='tower'?-124:-35));ctx.font='11px system-ui';ctx.fillText(p.kind==='tower'?'Field Actions • scan threats for 30s':s.collected?'Your supplies collected':'Field Actions • 1 medkit + 1 plate',p.x,p.y+35);
    }
    if(now<s.towerUntil)for(const t of tigers.filter(t=>valid(t)&&t.alive!==false&&!t.defeated&&t.hp>0)){if(t.x<view.x||t.x>view.x+view.w||t.y<view.y||t.y>view.y+view.h)continue;ctx.fillStyle='#fecaca';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('SCOUTED THREAT',t.x,t.y-90);}
    if(opportunity?.status==='active'){ctx.strokeStyle='#f9d77e';ctx.lineWidth=3;ctx.strokeRect(opportunity.x-35,opportunity.y-60,70,85);ctx.fillStyle='#fff0bd';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(`OPTIONAL RESCUE LEAD • ${Math.ceil(opportunity.remaining/1000)}s`,opportunity.x,opportunity.y-78);}
    ctx.restore();
  }
  function open({level,world,player,state,lead:opportunity,now,action}={}){
    if(typeof document==='undefined'||!enabled(level))return;let d=document.getElementById('fieldOperationsDialog');if(!d){d=document.createElement('dialog');d.id='fieldOperationsDialog';d.style.cssText='color:#eff8ed;background:#14271e;border:2px solid #9abb91;border-radius:16px;width:85vw;max-width:430px;padding:20px';document.body.appendChild(d);}if(d.open)d.close();d.replaceChildren();
    d.style.maxHeight='85dvh';d.style.overflow='auto';const title=document.createElement('h2');title.id='fieldOperationsTitle';d.setAttribute('aria-labelledby',title.id);title.textContent='Field Actions';d.appendChild(title);const status=document.createElement('p');status.textContent='Optional tasks: one soldier can scout while another rescues. Solo can do both. Supplies are for this attempt only. This dialog does not pause play.';d.appendChild(status);const s=normalize(state),rows=[];
    for(const kind of ['locate-tower','locate-cache','tower','cache','medkit','armor','lead']){const site=fixtures(level,world).find(p=>p.kind===kind),range=site?Math.round(dist(player,site)):0;
      const blocked=site&&range>110||kind==='tower'&&now<s.towerReadyAt||kind==='cache'&&s.collected||kind==='medkit'&&(!s.medkits||player.hp>=player.maxHp)||kind==='armor'&&(!s.armor||player.armor>=player.armorCap)||kind==='lead'&&opportunity?.status!=='active';
      const b=document.createElement('button');b.type='button';b.style.cssText='display:block;width:100%;min-height:44px;margin:8px 0;padding:12px';b.textContent=kind==='locate-tower'?'Locate watchtower on route':kind==='locate-cache'?'Locate supply cache on route':kind==='tower'?`Scan watchtower • ${range}m${now<s.towerReadyAt?` • ready in ${Math.ceil((s.towerReadyAt-now)/1000)}s`:''}`:kind==='cache'?`Collect mission supplies • ${range}m${s.collected?' • collected':''}`:kind==='medkit'?`Use field medkit • ${s.medkits} left • up to 40 HP`:kind==='armor'?`Use field plate • ${s.armor} left • up to 40 armor`:opportunity?.status==='active'?`Locate optional rescue lead • ${Math.ceil(opportunity.remaining/1000)}s`:'No optional rescue lead active';b.disabled=!!blocked;rows.push({b,blocked:!!blocked});b.onclick=async()=>{rows.forEach(r=>r.b.disabled=true);try{await action(kind);d.close();}catch(e){status.textContent=String(e.message||e);rows.forEach(r=>r.b.disabled=r.blocked);}};d.appendChild(b);}
    d.addEventListener('close',()=>globalThis.TigerMissionRoutes?.reset?.(),{once:true});const close=document.createElement('button');close.type='button';close.textContent='Close';close.style.cssText='min-height:44px;padding:12px';close.onclick=()=>d.close();d.appendChild(close);globalThis.dispatchEvent?.(new Event('mission-route-open'));d.showModal();
  }
  return Object.freeze({VERSION:'14.3',enabled,normalize,fixtures,lead,act,danger,destination,draw,open});
});
