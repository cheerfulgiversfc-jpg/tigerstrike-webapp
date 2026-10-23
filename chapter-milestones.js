(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerChapterMilestones=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const NAMES=['The First Attack','Blood in the Jungle','The Deep Jungle','Abandoned Villages','River Territory','Mountain Edge','Tiger Territory','The Tiger King','The Hidden Jungle','The Ancient Guardian'];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function counts(records={},scope='solo'){
    const levels=new Set(Object.entries(records).filter(([key,r])=>key.startsWith(`${scope}:`)&&Number.isInteger(r?.campaignLevel)&&r.campaignLevel>=1&&r.campaignLevel<=100&&r.clears>0).map(([,r])=>r.campaignLevel));
    return Array.from({length:10},(_,c)=>Array.from({length:10},(_,i)=>c*10+i+1).filter(n=>levels.has(n)).length);
  }
  function normalize(raw={},records={}){
    return Object.fromEntries(['solo','coop'].map(scope=>{
      const known=counts(records,scope),stored=Array.isArray(raw?.[scope]?.trophies)?raw[scope].trophies:[];
      return [scope,{trophies:Array.from({length:10},(_,i)=>i+1).filter(c=>known[c-1]===10||stored.includes(c)),bossCaptureRecorded:raw?.[scope]?.bossCaptureRecorded===true}];
    }));
  }
  function capture(state,run,changes){
    const previous=normalize(state.milestones),next=normalize(previous,state.records),scope=run.scope==='coop'?'coop':'solo';
    changes.newChapters=next[scope].trophies.filter(c=>!previous[scope].trophies.includes(c));
    const highlights=[];
    if(run.bossCaptures>0&&!previous[scope].bossCaptureRecorded){next[scope].bossCaptureRecorded=true;highlights.push('First recorded boss capture');}
    if(run.civilianTotal>0&&run.rescued===run.civilianTotal&&run.civilianLost===0)highlights.push(`Everyone home: ${run.rescued}/${run.civilianTotal} civilians saved`);
    if(changes.personalBest)highlights.push('New fastest recorded clear');
    changes.highlights=highlights;
    return next;
  }
  function celebration(chapter,key,automatic=false){
    return `<section class="chapterCelebration" data-chapter-celebration="${esc(key)}" data-auto="${automatic?'yes':'no'}"><h3>🏆 Chapter ${chapter} secured</h3><b>${esc(NAMES[chapter-1])}</b><div class="chapterCelebrationScene"><div class="chapterTrophyEmblem">🏆</div><p>All ten mission clears recorded. Your chapter trophy is saved.</p><div class="chapterMissionLights" aria-label="Ten missions complete">${Array.from({length:10},(_,i)=>`<span style="--step:${i}">✓ ${chapter*10-9+i}</span>`).join('')}</div><div class="chapterCelebrationTimer"></div></div><div class="chapterCelebrationButtons"><button type="button" data-celebration-skip onclick="TigerChapterMilestones.skip(this)">Skip celebration</button><button type="button" onclick="TigerChapterMilestones.replay(this)">Watch again</button></div><small>Recognition only • no extra payout or difficulty.</small></section>`;
  }
  const memory=new Set(),timers=new WeakMap();
  function seen(key){try{const saved=JSON.parse(localStorage.getItem('ts_chapter_celebrations_v1')||'[]');if(Array.isArray(saved)&&saved.includes(key))return true;}catch(e){}return memory.has(key);}
  function mark(key){memory.add(key);try{const saved=JSON.parse(localStorage.getItem('ts_chapter_celebrations_v1')||'[]');localStorage.setItem('ts_chapter_celebrations_v1',JSON.stringify([...new Set([...(Array.isArray(saved)?saved:[]),key])].slice(-200)));}catch(e){}}
  function finish(panel){if(!panel)return;clearTimeout(timers.get(panel));panel.dataset.finished='yes';}
  function play(panel){if(!panel)return;clearTimeout(timers.get(panel));delete panel.dataset.finished;panel.dataset.playing='yes';const scene=panel.querySelector('.chapterCelebrationScene');scene?.getAnimations?.({subtree:true}).forEach(animation=>{animation.cancel();animation.play();});timers.set(panel,setTimeout(()=>finish(panel),6500));}
  function skip(button){finish(button.closest('[data-chapter-celebration]'));}
  function replay(button){play(button.closest('[data-chapter-celebration]'));}
  function mount(doc=globalThis.document){
    if(!doc)return;
    doc.querySelectorAll('[data-chapter-celebration]:not([data-mounted])').forEach(panel=>{
      panel.dataset.mounted='yes';
      const key=panel.dataset.chapterCelebration;
      if(panel.dataset.auto==='yes'&&!seen(key)){mark(key);play(panel);}else finish(panel);
    });
  }
  function schedule(){if(typeof document!=='undefined')queueMicrotask(()=>mount());}
  function reportHtml(state,run){
    if(!run.completed||state.last?.id!==run.id)return '';
    const changes=state.lastChanges||{},chapters=(changes.newChapters||[]).filter(c=>Number.isInteger(c)&&c>=1&&c<=10),highlights=(changes.highlights||[]).slice(0,4);
    schedule();
    return `${highlights.length?`<section class="missionHighlights"><h3>Mission highlights</h3><ul>${highlights.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></section>`:''}${chapters.map(c=>celebration(c,`${run.scope}:${run.id}:${c}`,true)).join('')}`;
  }
  function hubHtml(state={},scope='solo',unlockedLevel=1,rewardApi){
    scope=scope==='coop'?'coop':'solo';
    const data=normalize(state.milestones,state.records),progress=counts(state.records,scope),earned=data[scope].trophies;
    const next=Math.min(100,Math.max(1,Math.floor(Number(unlockedLevel)||1))),all=earned.length===10;
    const candidates=rewardApi?.rewards(state,scope).filter(r=>r.target>0&&!r.unlocked).sort((a,b)=>b.progress/b.target-a.progress/a.target)||[];
    const closest=candidates.find(r=>r.metric!=='chapter'||r.chapter*10-9<=next)||candidates[0];
    const future=closest?.metric==='chapter'&&closest.chapter*10-9>next;
    schedule();
    return `<section class="chapterTrophyShelf"><h3>🏆 ${scope==='coop'?'Co-op':'Solo'} Chapter Trophy Shelf • ${earned.length}/10</h3><p>Earn a trophy by recording clears on all ten missions in a chapter. Unlocking a mission is not a clear. Older recorded clears count; missing history is not invented.</p><p>${all?'All ten chapter trophies earned. Replay any unlocked mission.':`Next available Story mission: ${next}. Use Story Campaign or World Map to prepare it.`}</p>${closest?`<p>${future?`Next chapter mastery goal (future chapter; first unlock Mission ${closest.chapter*10-9})`:'Closest mastery reward by displayed requirement percentage'}: <b>${esc(closest.name)}</b> • ${closest.progress}/${closest.target}. ${esc(closest.requirement)} See all unlock paths in the reward locker.</p>`:'<p>All currently listed mastery rewards earned.</p>'}<details><summary>View chapter trophies</summary><div class="chapterShelfGrid">${NAMES.map((name,i)=>`<article><b>${earned.includes(i+1)?'🏆':'🔒'} Chapter ${i+1} • ${esc(name)}</b><p>Missions ${i*10+1}–${i*10+10} • ${earned.includes(i+1)?'Trophy earned':`${progress[i]}/10 clears recorded`}</p>${earned.includes(i+1)?celebration(i+1,`shelf:${scope}:${i+1}`):''}</article>`).join('')}</div></details></section>`;
  }
  return Object.freeze({VERSION:'12.4',NAMES:Object.freeze(NAMES),counts,normalize,capture,reportHtml,hubHtml,mount,skip,replay});
});
