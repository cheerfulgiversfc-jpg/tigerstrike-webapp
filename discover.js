(function(){
 'use strict';
 const canvas=document.getElementById('launchPreview'),c=canvas.getContext('2d'),play=document.getElementById('playPreview'),caption=document.getElementById('sceneCaption'),cinema=window.TigerStoryCinema;
 let frame=0,started=0,last=0;
 const stop=()=>{cancelAnimationFrame(frame);frame=0;play.textContent='↻ Replay mission preview';};
 cinema.drawScene(c,17500);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)play.textContent='View still mission preview';
 window.TigerShowcaseScene.drawSquadDisplay(document.getElementById('teamPreview').getContext('2d'),{players:[{name:'Solo soldier',eliteAppearance:{}},{name:'Teammate',eliteAppearance:{}}],now:0});
 function tick(now){if(document.hidden){stop();return;}const age=Math.min(cinema.DURATION,now-started);if(now-last>33){last=now;cinema.drawScene(c,age);caption.textContent=cinema.sceneAt(age).caption;}if(age<cinema.DURATION)frame=requestAnimationFrame(tick);else stop();}
 play.onclick=()=>{if(frame){stop();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){cinema.drawScene(c,17500);caption.textContent='Reduced-motion preview: two soldiers arriving to protect the village.';return;}started=performance.now();last=0;play.textContent='Pause preview';frame=requestAnimationFrame(tick);};
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 const code=(new URLSearchParams(location.search).get('squad')||'').toUpperCase(),valid=/^[A-Z0-9]{6}$/.test(code);
 fetch('/api/player/launch'+(valid?'?squad='+encodeURIComponent(code):''),{signal:AbortSignal.timeout(8000)}).then(r=>r.json()).then(d=>{
  if(!d.ok)throw Error('Official Telegram link is temporarily unavailable.');
  const links=document.querySelectorAll('.telegramPlay');if(d.botUrl){for(const a of links){a.href=d.botUrl+(valid?'?startapp=squad_'+code:'?startapp=launch');a.rel='noopener';}document.getElementById('launchLinkStatus').textContent='Opens the official Tiger Strike bot in Telegram.';}else throw Error('The Telegram link is temporarily unavailable. You can open the browser version below.');
  if(code){const box=document.getElementById('invitation');box.hidden=false;const h=document.createElement('h2'),p=document.createElement('p');h.textContent=d.invitation?'You’ve been invited to '+d.invitation.title:'This squad invitation needs checking';p.textContent=d.invitation?`${d.invitation.objective} Squad ${code} • ${d.invitation.players}/2 players • ${d.invitation.status}. Confirm the room inside Telegram before joining.`:d.inviteError||'Ask the host for an available six-character squad code.';box.append(h,p);}
 }).catch(e=>{document.getElementById('launchLinkStatus').textContent=e.message;for(const a of document.querySelectorAll('.telegramPlay')){a.href='/';a.textContent='Open Tiger Strike ↗';}});
 if(code&&!valid){const box=document.getElementById('invitation');box.hidden=false;box.textContent='This invitation code is invalid. Ask the host for a current squad invitation.';}
 fetch('/api/events/rescue',{signal:AbortSignal.timeout(8000)}).then(r=>r.json()).then(d=>{if(d.ok)document.getElementById('publicEventStatus').textContent=d.phase==='paused'?'The event is paused while the community gets ready. Its remaining time is preserved until the organizer resumes it.':d.phase==='active'?'The event is active. Open HQ → Live Rescue Event to see verified progress and the closing date.':'The event is currently closed. Earned rewards remain yours.';}).catch(()=>{});
})();
