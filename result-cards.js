(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./mission-debrief'):root.TigerMissionDebrief);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerRescueCards=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
 'use strict';
 const HOME='https://tigerstrike-webapp.vercel.app/discover';
 function model(raw,records){
  const state=D.normalize(records),requested=D.summary(raw||{});
  if(!requested.completed||requested.rewardState==='pending'||requested.id!==state.last?.id||requested.scope!==state.last?.scope)return null;
  const run=state.last;
  if(!run.completed||!run.id||!state.receipts.includes(run.id)||run.rewardState==='pending')return null;
  const same=state.last?.id===run.id&&state.last?.scope===run.scope;
  const firstBoss=run.bossCaptures>0&&(state.milestones?.[run.scope]?.firstBossCaptureRunId===run.id||(same&&state.lastChanges.highlights?.includes('First recorded boss capture')));
  const highlights=firstBoss?['First recorded boss capture']:[];highlights.push(...D.medals(run));
  if(same&&state.lastChanges.personalBest&&run.durationMs>0)highlights.push('New personal best');
  if(run.bossCaptures>0&&!firstBoss)highlights.push('Boss captured alive');
  return Object.freeze({id:run.id,scope:run.scope,title:run.title,mode:run.mode,level:run.campaignLevel,rescued:run.rescued,total:run.civilianTotal,captures:run.captures,kills:run.kills,time:run.durationMs?D.time(run.durationMs):'Not recorded',highlights:highlights.slice(0,4)});
 }
 function caption(m){return `Tiger Strike • ${m.scope==='coop'?'Co-op':'Solo'} • ${m.title}\nCivilians saved: ${m.rescued}/${m.total} • Tigers captured: ${m.captures} • Killed: ${m.kills}\nTime: ${m.time}${m.highlights.length?'\n'+m.highlights.join(' • '):''}\nYour next rescue starts here.`;}
 function invitationAvailable(room){return !!room&&room.status==='waiting'&&Number(room.memberCount)===1&&/^[A-Z0-9]{6}$/.test(String(room.code||''));}
 function telegramUrl(m){return 'https://t.me/share/url?url='+encodeURIComponent(HOME)+'&text='+encodeURIComponent(caption(m));}
 function draw(canvas,m,players,includeNames=false){
  const c=canvas.getContext('2d');if(!c||!window.TigerShowcaseScene)throw Error('The production artwork is still loading. Please reopen the card.');
  canvas.width=1200;canvas.height=1000;
  c.fillStyle='#081c25';c.fillRect(0,0,1200,1000);
  const art=document.createElement('canvas');art.width=1200;art.height=600;
  window.TigerShowcaseScene.drawVictory(art.getContext('2d'),{players:players.slice(0,m.scope==='coop'?2:1),staticPose:true,title:'RESCUE COMPLETE',subtitle:'BRING THEM HOME • RESCUE OPERATIONS'});
  c.drawImage(art,0,96,1200,600);
  c.fillStyle='#edd8a4';c.font='bold 38px system-ui';c.fillText('TIGER STRIKE',48,60);c.textAlign='right';c.font='24px system-ui';c.fillText(m.scope==='coop'?'CO-OP RESCUE':'SOLO RESCUE',1152,58);c.textAlign='left';
  function line(text,x,y,max=1104){c.fillText(text,x,y,max);}
  c.fillStyle='#eff8f1';c.font='bold 32px system-ui';line(m.title,48,728);
  c.font='24px system-ui';c.fillStyle='#cce6dc';line(`${m.rescued}/${m.total} civilians saved     ${m.captures} tigers captured     ${m.kills} killed`,48,774);
  line(`Time: ${m.time} • ${m.mode}${m.level?' • Mission '+m.level:''}`,48,816);
  c.fillStyle='#edd8a4';c.font='bold 23px system-ui';line(m.highlights.slice(0,2).join(' • ')||'Mission completed',48,854);if(m.highlights.length>2){c.font='21px system-ui';line(m.highlights.slice(2).join(' • '),48,884);}
  c.fillStyle='#cce6dc';c.font='22px system-ui';line(players.slice(0,m.scope==='coop'?2:1).map((p,i)=>includeNames?String(p.name||'Soldier').slice(0,28):m.scope==='coop'?'Soldier '+(i+1):'Your soldier').join(' + '),48,921);
  c.font='19px system-ui';c.fillStyle='#9dbcb0';line('tigerstrike-webapp.vercel.app/discover',48,956);
 }
 function open(options={}){
  if(typeof document==='undefined'||document.getElementById('rescueCardDialog'))return false;
  const m=model(options.run,options.records);if(!m)return false;
  const recordedActors=D.summary(options.run).actors;
  const players=(recordedActors.length?recordedActors:options.players||[]).slice(0,m.scope==='coop'?2:1).map(p=>({...p}));
  if(!players.length)return false;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const d=el('dialog');d.id='rescueCardDialog';d.setAttribute('aria-labelledby','rescueCardTitle');const h=el('header'),heading=el('h2','Your rescue highlight'),close=el('button','Close rescue card');heading.id='rescueCardTitle';h.append(heading,close);d.append(h);
  const canvas=el('canvas');canvas.setAttribute('aria-label','Tiger Strike completed mission result card');d.append(canvas);
  const details=el('p',caption(m));details.className='rescueCardCaption';d.append(details);
  const privacy=el('label'),names=el('input');names.type='checkbox';privacy.append(names,document.createTextNode(' Include soldier names on the saved image (off by default)'));d.append(privacy);
  const note=el('p',(recordedActors.length?'Equipment recorded at the mission result is shown. ':'Current equipped uniforms are shown for this older result. ')+'Sharing grants no supplies, currency or progression.'),status=el('p');status.setAttribute('role','status');d.append(note);
  const actions=el('div');actions.className='rescueCardActions';const image=el('button','Share card image'),save=el('a','Save card image'),telegram=el('a','Share text & game link');telegram.href=telegramUrl(m);telegram.target='_blank';telegram.rel='noopener noreferrer';actions.append(image,save,telegram);d.append(actions,el('p','Text sharing sends the result and game link. Use the Telegram photo controls below to share the actual artwork, or use device image sharing.'),status);
  const blob=()=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not create the card image. Try again.')),'image/png'));
  let busy=false,objectUrl='';const setBusy=v=>{busy=v;image.disabled=v;save.setAttribute('aria-disabled',String(v));};
  let cachedFile=null,renderEpoch=0;async function paint(){const epoch=++renderEpoch;cachedFile=null;image.disabled=true;try{draw(canvas,m,players,names.checked);const b=await blob();if(epoch!==renderEpoch||!d.isConnected)return;cachedFile=new File([b],'tiger-strike-rescue.png',{type:'image/png'});if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(b);save.href=objectUrl;save.download='tiger-strike-rescue.png';image.disabled=false;prepare.disabled=!nativeShare;}catch(e){status.textContent=e.message;}}
  names.onchange=paint;
  image.onclick=async()=>{if(busy||!cachedFile)return;const file=cachedFile;if(!navigator.canShare?.({files:[file]})||!navigator.share){status.textContent='Image sharing is unavailable here. Save the card, then attach it in Telegram.';return;}setBusy(true);try{await navigator.share({files:[file],title:'Tiger Strike rescue'});status.textContent='Image sharing finished.';}catch(e){status.textContent=e.name==='AbortError'?'Sharing canceled. Your result is unchanged.':'Could not share the image. Save the card and attach it in Telegram.';}finally{if(d.isConnected)setBusy(false);}};
  save.onclick=e=>{if(busy||!cachedFile||!objectUrl){e.preventDefault();status.textContent='The card image is preparing. Please try again.';return;}status.textContent='Card download requested. If your Telegram client blocks downloads, use Share card image or take a screenshot.';};
  telegram.onclick=e=>{if(window.Telegram?.WebApp?.openTelegramLink){e.preventDefault();window.Telegram.WebApp.openTelegramLink(telegram.href);}};
  const tg=window.Telegram?.WebApp,nativeShare=!!tg?.initData&&typeof tg.shareMessage==='function'&&(!tg.isVersionAtLeast||tg.isVersionAtLeast('8.0'));
  const photoArea=el('section');photoArea.className='rescueCardTelegram';photoArea.append(el('h3','Share the actual card photo on Telegram'),el('p','Prepare uploads this exact card image to a temporary link for 24 hours. Anyone with that link can view it until it expires. Names follow the checkbox above. Nothing is sent until you choose a chat and confirm in Telegram. Sent messages remain in their chats.'));
  const prepare=el('button','Prepare Telegram photo'),sendPhoto=el('button','Choose Telegram chat');prepare.disabled=!nativeShare||!cachedFile;sendPhoto.disabled=true;photoArea.append(prepare,sendPhoto);d.append(photoArea);
  if(!nativeShare)photoArea.append(el('p','Open Tiger Strike in an updated Telegram app to use direct photo sharing. Save/device image sharing and the text-link option remain available.'));
  let prepared=null,photoEpoch=0;
  const invalidatePhoto=()=>{photoEpoch++;prepared=null;sendPhoto.disabled=true;prepare.textContent='Prepare Telegram photo';status.textContent='Card changed. Prepare the updated photo before sharing.';};
  names.onchange=()=>{invalidatePhoto();paint();};
  prepare.onclick=async()=>{
    if(busy||!nativeShare||!cachedFile)return;
    const epoch=++photoEpoch;setBusy(true);names.disabled=prepare.disabled=true;sendPhoto.disabled=true;status.textContent='Preparing your card photo. No message has been sent…';
    try{
      const local=D.normalize(options.records),records={last:local.last,receipts:[local.last.id],lastChanges:local.lastChanges,milestones:local.milestones};
      const jpeg=canvas.toDataURL('image/jpeg',.88);
      const response=await fetch('/api/player/rescue-card',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg.initData,scope:m.scope,runId:m.id,profileType:options.profileType||'',records,jpeg}),signal:AbortSignal.timeout(20000)});
      const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'Photo preparation failed. Please try again.');
      if(epoch!==photoEpoch||!d.isConnected)return;prepared=data;sendPhoto.disabled=false;prepare.textContent='Prepare again';status.textContent='Photo ready. Choose Telegram chat to open the recipient picker. No message has been sent.';
    }catch(e){if(d.isConnected)status.textContent=e.message||'Could not prepare the card. Save/device sharing remains available.';}
    finally{if(d.isConnected){setBusy(false);names.disabled=false;prepare.disabled=!nativeShare;}}
  };
  sendPhoto.onclick=()=>{
    if(busy||!prepared)return;
    if(Date.now()>=prepared.expiresAt){invalidatePhoto();status.textContent='This prepared photo expired. Prepare it again before sharing.';return;}
    setBusy(true);names.disabled=prepare.disabled=sendPhoto.disabled=true;status.textContent='Choose a chat and confirm in Telegram, or cancel.';
    let finished=false;const finish=(sent,error)=>{if(finished)return;finished=true;if(!d.isConnected)return;setBusy(false);names.disabled=prepare.disabled=false;sendPhoto.disabled=false;status.textContent=error|| (sent===true?'Card photo shared on Telegram. Your mission result is unchanged.':'Sharing was canceled or the photo was not sent. You can try again.');};
    try{tg.shareMessage(prepared.preparedMessageId,sent=>finish(sent));}catch(e){finish(false,e.message||'Telegram could not open photo sharing.');}
  };
  if(options.squad){const invite=el('button','Join my next rescue • invite teammate');invite.disabled=!invitationAvailable(options.squad());const explain=el('p',invite.disabled?'A squad invitation is available only in a waiting squad with one open space. Both teammates keep the existing Continue controls.':'Invite someone to the actual waiting squad; this never creates a replacement squad.');d.append(invite,explain);invite.onclick=async()=>{if(busy)return;busy=true;invite.disabled=true;try{await options.invite?.();status.textContent='Use the squad invitation controls to choose a teammate.';}catch(e){status.textContent=e.message;}finally{busy=false;invite.disabled=!invitationAvailable(options.squad());}};}
  close.onclick=()=>d.close();d.addEventListener('keydown',e=>e.stopPropagation());d.addEventListener('close',()=>{photoEpoch++;renderEpoch++;if(objectUrl)URL.revokeObjectURL(objectUrl);d.remove();options.onClose?.();},{once:true});document.body.append(d);d.showModal();paint();return true;
 }
 function mount(node,options){if(!node)return;const m=model(options.run,options.records);node.hidden=!m;if(!m){node.dataset.run='';node.replaceChildren();return;}if(node.dataset.run===m.id)return;node.dataset.run=m.id;node.replaceChildren();const b=document.createElement('button');b.type='button';b.textContent='View & share rescue card';b.onclick=()=>options.open();node.append(b);}
 return Object.freeze({model,caption,telegramUrl,invitationAvailable,draw,open,mount});
});
