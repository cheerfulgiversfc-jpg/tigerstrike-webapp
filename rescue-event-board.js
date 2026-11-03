(function(){
  'use strict';
  const C=window.TigerRescueEventConfig;
  async function request(action='stats',extra={}){
    const initData=window.Telegram?.WebApp?.initData;
    if(!initData)throw Error('Open Tiger Strike through Telegram to load verified event progress.');
    const r=await fetch('/api/events/rescue',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,initData,...extra}),signal:AbortSignal.timeout(12000)}),d=await r.json();
    if(!r.ok||!d.ok)throw Error(d.error||'Could not load event progress.');
    return d;
  }
  function open(options={}){
    if(document.getElementById('rescueEventBoard'))return;
    const d=document.createElement('dialog');d.id='rescueEventBoard';
    let closed=false,busy=false,data=null,receivedAt=Date.now(),animation=0;
    const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
    const h=el('header'),title=el('h2',C.EVENT.title),close=el('button','Close event board');
    close.onclick=()=>{if(!busy)d.close();};h.append(title,close);
    const dates=el('p','Loading the server-controlled event schedule…'),phase=el('p'),status=el('p');status.setAttribute('role','status');
    const actions=el('div'),progress=el('section'),rewards=el('section'),community=el('section'),admin=el('section'),shareCard=el('section');
    const solo=el('button','Play event Solo'),find=el('button','Find event teammate'),coop=el('button','Create private event Squad'),refresh=el('button','Refresh event progress'),claim=el('button','Claim earned event rewards'),share=el('button','Preview my Telegram achievement card');
    actions.append(solo,find,coop,refresh,claim,share);
    const preview=el('canvas');preview.width=1200;preview.height=720;preview.setAttribute('aria-label','Free Monsoon Ranger event reward appearance preview');
    const movie=el('section'),movieCanvas=el('canvas'),skip=el('button','Skip celebration');movie.hidden=true;movieCanvas.width=1200;movieCanvas.height=600;movie.append(movieCanvas,skip);
    const rules='Solo: 3 villagers and 2 tigers. Squad: 5 villagers and 3 tigers. Secure three river-route checkpoints, rescue every villager to the riverside house, capture the marked tiger alive, clear the other threats, then board the boat. Each soldier has one automatic field life. Restart a failed attempt while the event is open.';
    d.append(h,el('p','A free rescue event. Play alone, find another waiting Telegram player, or invite a friend. Matchmaking never adds a pretend teammate.'),dates,phase,admin,actions,status,progress,community,rewards,shareCard,movie,el('details'),preview);
    const details=d.querySelector('details');details.append(el('summary','Mission rules and separate supplies'),el('p',rules),el('p','Your personal rescue total combines Solo and Squad wins. Event Solo and Event Squad supplies, money and statistics are separate from each other and from Story, Arcade, Survival and normal Co-op. Claim Mission Reward after extraction. Each completed mission counts once for the community and once personally for each participant. After both rewards are claimed, Play Again keeps the same squad together.'));
    document.body.append(d);d.showModal();
    function accept(value){data=value;receivedAt=Date.now();}
    function scheduleNow(){const s=data?.schedule;if(!s)return null;const now=s.serverNow+Math.max(0,Date.now()-receivedAt);return {...s,phase:C.phase(now,s),remainingMs:s.paused?s.remainingMs:Math.max(0,s.endsAt-now)};}
    function scheduleText(){const s=scheduleNow();if(!s)return;const hours=Math.ceil(s.remainingMs/3600000),days=Math.floor(hours/24),rest=hours%24;
      dates.textContent=s.phase==='paused'?`Event paused • ${days} days ${rest} hours preserved. The organizer will resume it when ready. November 16 is no longer the deadline.`:s.phase==='active'?`Event active • Ends ${new Date(s.endsAt).toLocaleString()} (your local time). ${days} days ${rest} hours remaining. Active attempts have a 20-minute completion grace after closing.`:'Event ended. Earned rewards remain yours.';
      phase.textContent='Event '+s.phase+' • Community goal: '+C.EVENT.goal+' completed rescues.';
    }
    const showPreview=id=>window.TigerShowcaseScene.drawLoadout(preview.getContext('2d'),{preset:{name:'Monsoon reward preview',weaponId:'W_AR_CARBINE',ammoMode:'rubber',toolId:'med-drone',appearance:{soldier:'monsoon_uniform',weapon:id==='monsoon_finish'?'monsoon_finish':''}},mode:'Story',weaponName:'AR Carbine'});
    function stopMovie(){cancelAnimationFrame(animation);animation=0;movie.hidden=true;}
    function celebrate(total){
      stopMovie();movie.hidden=false;movie.scrollIntoView({block:'center'});const start=performance.now();let last=-Infinity;
      const paint=(now,staticPose)=>window.TigerShowcaseScene.drawVictory(movieCanvas.getContext('2d'),{players:[{eliteAppearance:data?.selection||{}}],now,age:now-start,staticPose,title:total>=C.EVENT.goal?'MONSOON RESCUE • COMMUNITY GOAL REACHED':'MONSOON RESCUE • '+total+' COMMUNITY RESCUES',subtitle:'Verified community milestone • Thank you, rescuers'});
      if(window.TigerCombatFeel?.settings()?.reducedFlashes){paint(start,true);return;}
      function tick(now){if(closed||document.hidden){stopMovie();return;}if(now-last>=33){paint(now,false);last=now;}if(now-start<4000)animation=requestAnimationFrame(tick);else animation=0;}
      animation=requestAnimationFrame(tick);
    }
    skip.onclick=stopMovie;
    function render(){
      const p=data?.progress,s=scheduleNow(),playable=!!p&&s?.phase==='active'&&!!window.Telegram?.WebApp?.initData;
      scheduleText();solo.disabled=find.disabled=coop.disabled=busy||!playable;close.disabled=refresh.disabled=busy;share.disabled=busy||!p||p.rescues<1;
      claim.disabled=busy||!p?.earned?.some(id=>['monsoon_uniform','monsoon_finish'].includes(id)&&!data.owned.includes(id));
      progress.replaceChildren(el('h3','Your next reward'));
      if(p){
        const next=C.EVENT.rewards.find(r=>!p.earned.includes(r.id));
        progress.append(el('p',next?`${Math.max(0,next.rescues-p.rescues)} more rescues until ${next.name}.`:'All three personal event rewards earned!'),el('p',`Your verified progress: ${p.rescues} villagers rescued across ${p.clears} successful missions.`));
        const bar=el('progress');bar.max=C.EVENT.goal;bar.value=Math.min(C.EVENT.goal,p.total);bar.setAttribute('aria-label','Community rescue goal');progress.append(el('p',`Community: ${p.total} / ${C.EVENT.goal} rescued${p.total>=C.EVENT.goal?' • Goal reached!':''}`),bar);
      }else progress.append(el('p','Verified counts are unavailable. No estimated or simulated progress is displayed.'));
      community.replaceChildren(el('h3','Community milestones'));
      for(const n of [250,500,750,1000]){
        const card=el('article');card.append(el('h4',`${n} community rescues`),el('p',p?(p.total>=n?'Reached • verified community progress':`${n-p.total} more community rescues to go`):'Progress unavailable'));
        const watch=el('button',n===1000?'Watch event finale':'Watch milestone celebration');watch.disabled=busy||!p||p.total<n;watch.onclick=()=>celebrate(n);card.append(watch);community.append(card);
      }
      rewards.replaceChildren(el('h3','Earnable event rewards'));
      for(const r of C.EVENT.rewards){
        const card=el('article'),got=p?.earned?.includes(r.id);card.append(el('h4',r.name),el('p',r.rescues+' personal rescues • '+(got?'Earned':p?Math.min(r.rescues,p.rescues)+'/'+r.rescues+' recorded':'Progress unavailable')));
        if(r.id!=='monsoon_trophy'){
          const view=el('button','Preview '+r.name);view.onclick=()=>{stopMovie();showPreview(r.id);preview.scrollIntoView({block:'center'});};view.disabled=busy;
          const equipped=data?.selection?.[r.id==='monsoon_uniform'?'soldier':'weapon']===r.id,equip=el('button',equipped?'Equipped '+r.name:'Equip '+r.name);equip.disabled=busy||!got||equipped;
          equip.onclick=()=>run(async()=>{accept(await request('equip',{id:r.id}));await window.TigerEliteArmory?.sync();status.textContent='Earned appearance equipped.';});card.append(view,equip);
        }else card.append(el('p','Displayed in Personal Rescue HQ once earned.'));
        rewards.append(card);
      }
      admin.replaceChildren();if(data?.canManage){
        admin.append(el('h3','Organizer controls'),el('p','Resume starts the preserved countdown. Pause freezes its remaining time. Active missions may finish and claim rewards.'));
        const control=el('button',s?.phase==='paused'?'Resume event':'Pause event');control.disabled=busy||s?.phase==='ended';control.onclick=()=>run(async()=>{accept(await request(s.phase==='paused'?'resume':'pause'));status.textContent=data.phase==='paused'?'Event paused. Remaining time and all progress are preserved.':'Event resumed. The new closing date is shown above.';});admin.append(control);
      }
    }
    async function run(fn){if(busy)return;busy=true;render();try{await fn();}catch(e){if(!closed)status.textContent=e.message;}finally{busy=false;if(!closed)render();}}
    async function load(){
      if(window.Telegram?.WebApp?.initData){accept(await request());if(!closed)status.textContent='Verified event progress loaded.';}
      else{const r=await fetch('/api/events/rescue',{signal:AbortSignal.timeout(12000)}),v=await r.json();if(!r.ok||!v.ok)throw Error(v.error||'Event schedule unavailable.');accept(v);status.textContent='Open Tiger Strike through Telegram to load your verified progress and play.';}
    }
    refresh.onclick=()=>run(load);claim.onclick=()=>run(async()=>{accept(await request('rewards'));await window.TigerEliteArmory?.sync();status.textContent='Earned event rewards saved.';});
    for(const [button,mode] of [[solo,'solo'],[coop,'coop'],[find,'match']])button.onclick=()=>run(async()=>{await options.play(mode);d.close();});
    share.onclick=()=>run(async()=>{
      const v=await request('share');accept(v);shareCard.replaceChildren(el('h3','Your verified achievement card'),el('p',v.share.text));
      const send=el('a','Choose a Telegram chat to share');send.href='https://t.me/share/url?url='+encodeURIComponent(v.share.url)+'&text='+encodeURIComponent(v.share.text);send.target='_blank';send.rel='noopener';
      send.onclick=e=>{if(window.Telegram?.WebApp?.openTelegramLink){e.preventDefault();window.Telegram.WebApp.openTelegramLink(send.href);}};shareCard.append(send,el('p','You choose the chat and confirm sending in Telegram.'));shareCard.scrollIntoView({block:'center'});
    });
    const timer=setInterval(()=>{if(!closed){const old=solo.disabled;scheduleText();const s=scheduleNow();if(s?.phase!=='active'&&!old)render();}},1000);
    d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});d.addEventListener('close',()=>{closed=true;clearInterval(timer);stopMovie();d.remove();options.onClose?.();},{once:true});
    render();showPreview('monsoon_uniform');run(load);return d;
  }
  window.TigerRescueEventBoard={open,readProgress:()=>request()};
})();
