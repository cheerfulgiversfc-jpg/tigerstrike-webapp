(function(){
 'use strict';
 let owner=false,statusMemo=null;
 const playerStatus=()=>statusMemo||(statusMemo=api('status').catch(e=>{statusMemo=null;throw e;}));
 const tg=()=>window.Telegram?.WebApp;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 async function api(action,extra={}){
  if(!tg()?.initData)throw Error('Open Tiger Strike through Telegram to send feedback or view private reports.');
  const r=await fetch('/api/player/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg().initData,action,...extra}),signal:AbortSignal.timeout(8000)}),d=await r.json();
  if(!r.ok||!d.ok)throw Error(d.error||'Player hub unavailable. Please try again.');return d;
 }
 function context(){
  const S=window.getGameState?.()||window.S||{},coop=window.TigerLiveSquad?.isOpen?.()&&window.TigerLiveSquad?.reportContext?.();
  return {build:document.querySelector('meta[name="tiger-build"]')?.content||'unknown',mode:coop?.mode||(window.__TUTORIAL_MODE__?'Training':S.mode==='Story'?'Solo':['Arcade','Survival'].includes(S.mode)?S.mode:'Menu'),mission:coop?.mission||Number(S.storyLevel||0),scene:coop?.scene||(['shopOverlay','invOverlay'].find(id=>document.getElementById(id)?.style.display==='flex')==='shopOverlay'?'shop':document.getElementById('invOverlay')?.style.display==='flex'?'inventory':S.missionEnded?'results':document.body.classList.contains('baseHqActive')?'hq':'mission')};
 }
 function shell(title,onClose){
  if(document.getElementById('playerLaunchHub'))return null;
  const d=el('dialog');d.id='playerLaunchHub';const h=el('header'),close=el('button','Close player hub');h.append(el('h2',title),close);d.append(h);close.onclick=()=>d.close();
  d.addEventListener('keydown',e=>e.stopPropagation());d.addEventListener('close',()=>{d.remove();onClose?.();},{once:true});document.body.append(d);d.showModal();return {d,close};
 }
 const receipt=()=>window.crypto?.randomUUID?.()||('report-'+Date.now()+'-'+Math.random().toString(36).slice(2));
 function report(kind='feedback',options={}){
  const ui=shell(kind==='bug'?'Report a problem':'First mission feedback',options.onClose);if(!ui)return;
  const {d,close}=ui,attached={...context(),...options.context},status=el('p');status.setAttribute('role','status');
  const form=el('form'),id=receipt();let busy=false;
  form.append(el('p',kind==='feedback'?'Optional: tell us how your mission felt. This gives no gameplay reward. One first-mission response is saved per Telegram account.':'Describe what happened and what you expected. Your report goes to the Tiger Strike owner dashboard.'));
  const rating=el('select');rating.id='launchFun';
  if(kind==='feedback'){
   form.append(el('label','Was it fun?'));form.lastChild.htmlFor=rating.id;
   for(const [v,t]of [['','Choose an answer'],['yes','Yes'],['mixed','Some parts'],['no','Not yet']]){const o=el('option',t);o.value=v;rating.append(o);}rating.required=true;form.append(rating);
  }
  const label=el('label',kind==='feedback'?'What was confusing? (optional)':'What went wrong?');label.htmlFor='launchReportText';const text=el('textarea');text.id='launchReportText';text.maxLength=800;text.rows=5;text.required=kind==='bug';text.minLength=kind==='bug'?10:0;
  const send=el('button',kind==='bug'?'Send bug report':'Send feedback');send.type='submit';
  form.append(label,text,el('p',`Attached: build ${attached.build} • ${attached.mode} • mission ${attached.mission} • ${attached.scene}. Your Telegram account identifies this report to the owner.`),send,status);d.append(form);
  form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;send.disabled=close.disabled=true;status.textContent='Saving your report…';try{const r=await api(kind,{id,text:text.value,fun:rating.value,context:attached});status.textContent=r.result==='saved'?'Saved. Thank you for helping improve Tiger Strike.':'Your response was already saved; no duplicate was created.';send.textContent='Saved';if(kind==='feedback')statusMemo=null;form.querySelectorAll('input,select,textarea').forEach(n=>n.disabled=true);options.onSaved?.();}catch(error){status.textContent=error.message;send.disabled=false;}finally{busy=false;close.disabled=false;}};
  d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 }
 async function hub(options={}){
  const ui=shell('Player Launch & Feedback',options.onClose);if(!ui)return;const {d}=ui;
  const p=el('p','Share feedback or report a problem. Sending is optional and does not change your supplies, rewards or progress.');
  const feedback=el('button','Give first-mission feedback'),bug=el('button','Report a bug'),link=el('a','View the public Tiger Strike showcase');link.href='/discover';link.target='_blank';link.rel='noopener';
  const openReport=kind=>{d.addEventListener('close',()=>options.reopen?.(kind),{once:true});d.close();};feedback.onclick=()=>openReport('feedback');bug.onclick=()=>openReport('bug');d.append(p,feedback,bug,link);
  try{const s=await playerStatus();owner=s.canManage;if(s.feedbackSubmitted){feedback.disabled=true;feedback.textContent='First-mission feedback already saved';}if(owner){const admin=el('button','Owner dashboard');admin.onclick=()=>dashboard(d);d.append(admin);}}catch(e){d.append(el('p',e.message));}
 }
 async function dashboard(d){
  if(d.dataset.dashboardBusy==='1')return;d.dataset.dashboardBusy='1';d.querySelector('[data-launch-status]')?.remove();
  const status=el('p','Loading verified stored activity…');status.setAttribute('role','status');status.dataset.launchStatus='1';d.append(status);
  try{const data=await api('dashboard');if(!d.isConnected)return;status.textContent='Recorded since V16.3. Historical player totals are not estimated. Today means UTC.';
   const content=el('section');content.setAttribute('aria-label','Owner launch dashboard');
   const labels=[['players','Telegram accounts first observed'],['returned','Accounts returning on a later UTC day'],['tutorial-start','Tutorial started (client reported)'],['tutorial-complete','Tutorial finished (client reported)'],['solo-clear','Single-player clear on synced record'],['coop-clear','Co-op clear verified by server'],['feedback','First-mission feedback responses'],['bug','Bug reports saved']];
   for(const [key,label] of labels)content.append(el('p',`${label}: ${Number(data.totals[key]||0)}`));
   content.append(el('p',`Active accounts today (${data.today} UTC): ${data.todayPlayers}`),el('p','Single-player progress is reported by the game client and can include earlier clears. Co-op completion comes from server-checked mission claims. Repeated opens and retries do not create another account or first clear.'),el('p',`Fun responses: Yes ${data.totals.fun_yes||0} • Some parts ${data.totals.fun_mixed||0} • Not yet ${data.totals.fun_no||0}`),el('h3','Latest player reports (up to 30)'));
   if(!data.reports.length)content.append(el('p','No player reports recorded yet.'));
   for(const r of data.reports){const card=el('article');card.append(el('h4',`${r.kind==='bug'?'Bug report':'Mission feedback'} • ${r.at}`),el('p',`Account ${r.account} • build ${r.context.build} • ${r.context.mode} ${r.context.mission} • ${r.context.scene}${r.fun?' • Fun: '+r.fun:''}`),el('p',r.text||'No written comment.'));content.append(card);}
   d.querySelector('[aria-label="Owner launch dashboard"]')?.remove();d.append(content);content.scrollIntoView({block:'start'});
  }catch(e){status.textContent=e.message;}finally{delete d.dataset.dashboardBusy;}
 }
 function mountFirstFeedback(node,options={}){
  if(!node)return;const uid=String(tg()?.initDataUnsafe?.user?.id||'guest'),key='ts_first_feedback_prompt_v1_'+uid;
  let dismissed=false;try{dismissed=!!localStorage.getItem(key);}catch{}
  node.replaceChildren();node.hidden=true;if(!options.eligible||dismissed)return;node.hidden=false;
  const dismiss=()=>{try{localStorage.setItem(key,'1');}catch{}node.hidden=true;};
  const give=el('button','Tell us about your first mission'),later=el('button','Not now');give.onclick=()=>options.open?.(dismiss);later.onclick=dismiss;
  node.append(el('h3','How was your first mission?'),el('p','Optional feedback helps us improve the next rescue. No purchase or reward is involved.'),give,later);
  if(tg()?.initData)playerStatus().then(s=>{if(s.feedbackSubmitted)dismiss();}).catch(()=>{});
 }
 async function showInvite(code,onJoin){
  const ui=shell('Your Tiger Strike invitation');if(!ui)return;const {d,close}=ui,status=el('p','Checking this squad…');d.append(status);
  try{const {invitation:i}=await api('invite',{code});
   if(i.returning){d.close();onJoin();return;}
   status.textContent=`${i.title} • ${i.level?'Story Mission '+i.level:'Special Operation'} • ${i.players}/2 players • ${i.status}.`;
   d.append(el('p',i.objective),el('p','You will join this exact squad. Your own Co-op supplies and rewards stay separate from your teammate’s.'));
   const join=el('button','Join this squad');join.disabled=i.status!=='waiting'||i.players>=2;join.onclick=()=>{d.close();onJoin();};d.append(join);
   if(join.disabled)d.append(el('p','This invitation is full or already underway. Ask the host for an available room.'));
  }catch(e){status.textContent=e.message;d.append(el('p','No squad was joined. Close this window and use the Live Squad menu to create or join another room.'));}
 }
 const activity=action=>api(action).catch(()=>null);
 window.TigerPlayerHub={hub,report,mountFirstFeedback,showInvite,activity,context};
})();
