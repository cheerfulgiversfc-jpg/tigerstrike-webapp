(function(){
 'use strict';let dialog=null;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 async function api(action,extra={}){const tg=window.Telegram?.WebApp;if(!tg?.initData)throw Error('Open Tiger Strike through Telegram to view your rescue partners.');const r=await fetch('/api/player/partners',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData,action,...extra}),signal:AbortSignal.timeout(20000)}),d=await r.json();if(!r.ok||!d.ok)throw Error(d.error||'Rescue partners unavailable.');return d;}
 function open(options={}){
  if(dialog)return false;const d=el('dialog');dialog=d;d.id='rescuePartnersDialog';d.setAttribute('aria-labelledby','rescuePartnersTitle');let busy=false,afterClose=null;
  const h=el('header'),title=el('h2','Rescue Partners & Team Progress'),close=el('button','Close');close.setAttribute('aria-label','Close rescue partners');title.id='rescuePartnersTitle';h.append(title,close);d.append(h,el('p','Complete Co-op missions together to build your team record. Records begin with V16.6. Both players must agree to a partnership; invitations are always your choice.'));
  const toolbar=el('div');toolbar.className='partnerToolbar';const refresh=el('button','Refresh teammates'),retry=el('button','Retry team records');toolbar.append(refresh,retry);d.append(toolbar);const status=el('p');status.setAttribute('role','status');const body=el('div');d.append(status,body);
  function button(label,fn){const b=el('button',label);b.type='button';b.onclick=fn;return b;}
  async function task(fn){if(busy)return;busy=true;refresh.disabled=retry.disabled=true;body.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){if(d.isConnected)status.textContent=e.message;}finally{busy=false;if(d.isConnected){refresh.disabled=retry.disabled=false;body.querySelectorAll('button[data-unlocked]').forEach(b=>b.disabled=b.dataset.unlocked!=='yes');}}}
  async function load(action='list'){status.textContent='Loading your recorded teammates…';const data=await api(action);if(!d.isConnected)return;render(data);status.textContent=data.pending?`${data.pending} shared results are pending. Retry team records when the connection returns.`:'Records loaded. Refresh to check for new partnership requests.';}
  function render(data){body.replaceChildren();const rows=data.rows||[];if(!rows.length){body.append(el('p','No recorded teammates yet. Complete a Co-op mission and claim its result to start your team history.'));return;}
    for(const row of rows){const card=el('article');card.className='partnerCard';card.append(el('h3',row.name+' • '+({partners:'Rescue partner',incoming:'Wants to be partners',outgoing:'Request sent',recent:'Recent teammate'}[row.status]||'Recent teammate')));
      card.append(el('p',`${row.runs} completed run${row.runs===1?'':'s'} • ${row.distinct} different mission${row.distinct===1?'':'s'} • ${row.rescued} civilians saved • ${row.captures} live captures • ${row.perfect} perfect rescue${row.perfect===1?'':'s'}`),el('p','Last shared rescue: '+new Date(row.lastPlayed).toLocaleDateString()));
      const canvas=el('canvas');canvas.width=1200;canvas.height=680;canvas.setAttribute('aria-label','Your recorded soldiers and equipped team cosmetics');card.append(canvas);
      const actions=el('div');actions.className='partnerToolbar';function action(label,name){const b=button(label,()=>task(async()=>{await api(name,{peerId:row.peerId});await load();}));b.dataset.unlocked='yes';actions.append(b);}
      if(row.status==='incoming'){action('Accept partnership','accept');action('Decline request','decline');}else if(row.status==='outgoing')action('Cancel request','cancel');else if(row.status==='partners')action('Remove partnership','remove');else action('Request rescue partnership','request');
      if(row.status==='partners'){
        const room=options.room?.(),available=room?.status==='waiting'&&room.memberCount===1;
        if(available){const b=button('Another rescue? Invite '+row.name,()=>task(async()=>{await options.invite?.(row.peerId);status.textContent='Choose your friend in Telegram and confirm sending the actual squad invitation.';}));b.dataset.unlocked='yes';actions.append(b);}
        else if(!room){const b=button('Prepare a squad to invite',()=>{afterClose=options.prepareSquad;d.close();});b.dataset.unlocked='yes';actions.append(b);}
        else actions.append(el('span',room.memberCount>=2?'Your squad is full. Continue together or free a seat before inviting.':'Invitations open from a waiting squad with one free seat.'));
      }
      card.append(actions);const awards=el('div');awards.className='partnerAwards';awards.append(el('h4','Earned team cosmetics • no combat bonuses'));
      for(const reward of row.rewards){const wrap=el('div');wrap.append(el('b',reward.name),el('p',`${reward.description} ${Math.min(reward.progress,reward.goal)}/${reward.goal}${reward.earned?' • Earned':''}`));const usable=reward.earned&&row.status==='partners',equipped=row.myStyle===reward.id,b=button(equipped?'Equipped • remove':usable?'Equip for this partnership':reward.earned?'Accept partnership to equip':'Locked');b.disabled=!usable;b.dataset.unlocked=usable?'yes':'no';b.onclick=()=>task(async()=>{await api('equip',{peerId:row.peerId,style:equipped?'':reward.id});await load();});wrap.append(b);awards.append(wrap);}
      if(row.status!=='partners')awards.append(el('small','Both players must accept before equipping team cosmetics. Recorded progress stays saved.'));card.append(awards);
      const details=el('details'),summary=el('summary','Mission records & fastest shared clears');details.append(summary);for(const m of row.missions||[])details.append(el('p',`${m.title} • ${m.clears} completed • fastest ${m.fastestMs?window.TigerMissionDebrief.time(m.fastestMs):'not recorded'}`));card.append(details);body.append(card);
      const players=(row.players||[]).map(p=>({...p,uniformPalette:p.masteryIdentity?.uniform?.palette}));window.TigerShowcaseScene?.drawSquadDisplay(canvas.getContext('2d'),{players,now:1200});if(players.some(p=>p.partnerStyle==='conservation-team')){const c=canvas.getContext('2d');c.strokeStyle='#74ddb1';c.lineWidth=10;c.strokeRect(5,5,1190,670);}
    }
  }
  refresh.onclick=()=>task(()=>load());retry.onclick=()=>task(()=>load('retry'));close.onclick=()=>d.close();d.addEventListener('keydown',e=>e.stopPropagation());d.addEventListener('close',()=>{dialog=null;d.remove();options.onClose?.();afterClose?.();},{once:true});document.body.append(d);d.showModal();task(()=>load());return true;
 }
 window.TigerRescuePartners={open,close:()=>dialog?.close()};
})();
