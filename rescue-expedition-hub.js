(function(){
  const expedition=window.TigerRescueExpedition;
  const tg=()=>window.Telegram?.WebApp;
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function status(expeditionId){
    const response=await fetch('/api/squad/session',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({initData:tg()?.initData,action:'expedition-status',expeditionId}),
      signal:AbortSignal.timeout(10000),
    });
    const data=await response.json();
    if(!response.ok||!data.ok)throw Error(data.error||'Rescue Mode could not load.');
    return data.expedition;
  }

  function open({play,onClose,expeditionId='river-gate'}){
    let selected=expedition.definition(expeditionId)||expedition.definition();
    let request=0;
    if(document.getElementById('rescueExpeditionDialog')?.open)return false;
    const dialog=document.createElement('dialog');
    dialog.id='rescueExpeditionDialog';
    dialog.setAttribute('aria-labelledby','rescueExpeditionTitle');
    dialog.innerHTML=`<header><div><small>🛟 RESCUE MODE</small><h2 id="rescueExpeditionTitle">${escape(selected.title)}</h2></div><button class="ghost" data-exp-close autofocus>Back</button></header>
      <nav class="expAdventures" aria-label="Rescue expeditions">${Object.values(expedition.adventures).map(adventure=>`<button class="ghost" data-exp-select="${adventure.id}" aria-pressed="${adventure.id===selected.id}">${escape(adventure.title)}</button>`).join('')}</nav>
      <div class="expBody" aria-live="polite">Loading your expedition checkpoint…</div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-exp-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{dialog.remove();onClose?.();},{once:true});
    const body=dialog.querySelector('.expBody');
    dialog.showModal();

    function show(run,replay=false){
      if(!dialog.open)return;
      const choosing=!run||replay;
      const completed=run?.stage===4;
      const route=selected.routes[run?.route];
      const summary=run?.results?.map(row=>`<li><b>${escape(selected.stages[row.stage-1])}</b> · ${escape(row.mode)}${row.stage>1?` · ${row.survivors.length} survivors safe`:''} · ${row.captures} live captures</li>`).join('')||'';
      body.innerHTML=`
        ${choosing?`<p>${escape(selected.description)}</p>`:`<p><b>Chosen route:</b> ${escape(route?.name)}.</p>`}
        <ol class="expStages">${selected.stages.map((stage,i)=>`<li class="${!choosing&&i+1===run?.stage?'current':''}">${escape(stage)}${!choosing&&i+1<(run?.stage||1)?' ✓':''}</li>`).join('')}</ol>
        ${summary&&!choosing?`<details ${completed?'open':''}><summary>${completed?'Expedition debrief':'Saved stage results'}</summary><ul>${summary}</ul>
          ${run.stage>=3?`<p>${escape(completed?route?.result:route?.checkpointResult||route?.result)}</p>`:''}
          ${completed?`<p><b>Evacuated by boat:</b> ${escape(run.results.at(-1).survivors.join(', '))}.</p>`:''}</details>`:''}
        ${choosing?`<fieldset><legend>Choose a route</legend>${Object.entries(selected.routes).map(([id,option])=>`<label class="expRoute"><input type="radio" name="expeditionRoute" value="${id}" ${replay&&run?.route!==id?'checked':''}><span><b>${escape(option.name)}</b><small>${escape(option.choice)}</small></span></label>`).join('')}</fieldset>`:''}
        <div class="expActions">
          ${run?.roomCode&&!replay?`<button class="primary" data-exp-play="resume">${run.roomStatus==='complete'?'Open stage results':'Return to your stage'}</button>`
            : completed&&!replay?'<button class="primary" data-exp-replay>Replay expedition</button>'
            : '<button class="primary" data-exp-play="solo">Play Solo</button><button class="ghost" data-exp-play="squad">Invite a teammate</button>'}
        </div>
        <p class="expNote">Your Telegram account saves the expedition between stages. Choose Solo or Co-op each time. An invited teammate joins your expedition and can start a separate run from their own Rescue Mode. Expedition supplies are separate from your other modes.</p>
        <p class="expError" role="alert"></p>`;
      body.querySelector('[data-exp-replay]')?.addEventListener('click',()=>show(run,true));
      body.querySelectorAll('[data-exp-play]').forEach(button=>button.onclick=async()=>{
        const routeChoice=body.querySelector('input[name="expeditionRoute"]:checked')?.value;
        const error=body.querySelector('.expError');
        if(choosing&&!routeChoice){error.textContent='Choose a rescue route first.';return;}
        const actions=Array.from(dialog.querySelectorAll('button'));
        actions.forEach(node=>node.disabled=true);
        const close=dialog.querySelector('[data-exp-close]');
        close.disabled=true;
        error.textContent='Opening the stage…';
        const preventCancel=event=>event.preventDefault();
        dialog.addEventListener('cancel',preventCancel);
        try{await play({expeditionId:selected.id,mode:button.dataset.expPlay,code:run?.roomCode,route:routeChoice,replay});dialog.close();}
        catch(e){console.error('Rescue expedition could not open',e);error.textContent=e.message;actions.forEach(node=>node.disabled=false);close.disabled=false;}
        finally{dialog.removeEventListener('cancel',preventCancel);}
      });
    }

    dialog.querySelectorAll('[data-exp-select]').forEach(button=>button.onclick=()=>{
      selected=expedition.definition(button.dataset.expSelect);
      dialog.querySelector('#rescueExpeditionTitle').textContent=selected.title;
      dialog.querySelectorAll('[data-exp-select]').forEach(node=>node.setAttribute('aria-pressed',node===button?'true':'false'));
      body.textContent='Loading your expedition checkpoint…';
      refresh();
    });

    async function refresh(){
      const current=++request;
      try{const run=await status(selected.id);if(current===request)show(run);}
      catch(error){
        if(!dialog.open||current!==request)return;
        body.innerHTML='<p class="expError" role="alert"></p><button class="ghost">Try again</button>';
        body.querySelector('p').textContent=error.message;
        body.querySelector('button').onclick=refresh;
      }
    }
    if(tg()?.initData)refresh();
    else body.textContent='Open Tiger Strike in Telegram to play Rescue Mode and save your expedition.';
    return true;
  }

  window.TigerRescueExpeditionHub={open};
})();
