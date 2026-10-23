(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerMissionDebrief=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const number=n=>Math.min(999999999,Math.max(0,Math.floor(Number(n)||0)));
  const clean=s=>String(s||'').slice(0,150);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const MEDALS=['Everyone Home','Wildlife Guardian','No Squad Wipe'];
  const medalList=value=>MEDALS.filter(name=>Array.isArray(value)&&value.includes(name));
  function campaignLevelForRecord(key,r){
    const match=String(key).match(/^(?:solo:Story:CAMPAIGN:|coop:shared-story:)(\d+):/);
    const level=number(r?.campaignLevel||match?.[1]);
    return level<=100?level:0;
  }
  function summary(raw={}){
    const scope=raw.scope==='coop'?'coop':'solo';
    return {id:clean(raw.id),key:`${scope}:${clean(raw.missionKey||String(raw.key||'').replace(/^(solo|coop):/,''))}`,scope,title:clean(raw.title||'Mission'),completed:!!raw.completed,mode:clean(raw.mode),durationMs:raw.durationMs>0?number(raw.durationMs):null,
      campaignLevel:raw.mode==='Story'&&number(raw.campaignLevel)>=1&&number(raw.campaignLevel)<=100?number(raw.campaignLevel):0,
      rescued:number(raw.rescued),civilianTotal:number(raw.civilianTotal),civilianLost:number(raw.civilianLost),captures:number(raw.captures),kills:number(raw.kills),wipes:raw.wipes==null?null:number(raw.wipes),restarts:number(raw.restarts),
      reward:raw.reward?{cash:number(raw.reward.cash),xp:number(raw.reward.xp),perkPoints:number(raw.reward.perkPoints),seasonPoints:number(raw.reward.seasonPoints)}:null,
      rewardState:['awarded','pending','already-claimed'].includes(raw.rewardState)?raw.rewardState:'pending',
      contributions:(raw.contributions||[]).slice(0,2).map(p=>({name:clean(p.name),recruited:p.recruited==null?null:number(p.recruited),captures:number(p.captures),kills:number(p.kills),damage:number(p.damage),revives:number(p.revives)}))};
  }
  function normalize(raw={}){
    const masteryEarned=Object.fromEntries(['solo','coop'].map(scope=>[scope,(Array.isArray(raw?.masteryEarned?.[scope])?raw.masteryEarned[scope]:[]).map(clean).slice(0,9)]));
    const records=Object.fromEntries(Object.entries(raw?.records||{}).filter(([key])=>/^(solo|coop):/.test(key)).slice(-400).map(([key,r])=>[clean(key),{title:clean(r?.title||key),campaignLevel:campaignLevelForRecord(key,r),medals:medalList(r?.medals),fastestMs:r?.fastestMs>0?number(r.fastestMs):null,bestRescued:number(r?.bestRescued),civilianTotal:number(r?.civilianTotal),clears:number(r?.clears)}]));
    return {records,masteryEarned,receipts:(Array.isArray(raw?.receipts)?raw.receipts:[]).map(clean).slice(-600),last:raw?.last?summary({...raw.last,missionKey:String(raw.last.key||'').replace(/^(solo|coop):/,'')}):null,lastChanges:raw?.lastChanges||{},locker:Object.fromEntries(['solo','coop'].map(scope=>[scope,{title:clean(raw?.locker?.[scope]?.title),badge:clean(raw?.locker?.[scope]?.badge)}]))};
  }
  function medals(run){
    if(!run.completed)return [];
    const result=[];
    if(run.civilianTotal>0&&run.rescued===run.civilianTotal&&!run.civilianLost)result.push('Everyone Home');
    if(run.mode!=='Survival'&&run.captures>0&&run.kills===0)result.push('Wildlife Guardian');
    if(run.scope==='coop'&&run.wipes===0)result.push('No Squad Wipe');
    return result;
  }
  function record(rawState,raw){
    const state=normalize(rawState),run=summary(raw);
    if(!run.completed||!run.id||state.receipts.includes(run.id))return {state,run,applied:false,changes:{}};
    const previous=state.records[run.key],first=!previous;
    const faster=run.durationMs!=null&&(!previous?.fastestMs||run.durationMs<previous.fastestMs);
    const betterRescue=run.civilianTotal>0&&(!previous||run.rescued>previous.bestRescued);
    state.records[run.key]={title:run.title,campaignLevel:run.campaignLevel,medals:medalList([...(previous?.medals||[]),...medals(run)]),fastestMs:faster?run.durationMs:(previous?.fastestMs||null),bestRescued:Math.max(previous?.bestRescued||0,run.rescued),civilianTotal:run.civilianTotal,clears:(previous?.clears||0)+1};
    state.receipts=[...state.receipts,run.id].slice(-600);state.last=run;
    state.lastChanges={first,faster,betterRescue};
    return {state,run,applied:true,changes:state.lastChanges};
  }
  function clock(raw,now=Date.now(),running=false){
    if(!raw)return {elapsedMs:0,lastAt:now,running};
    return {elapsedMs:number(raw.elapsedMs)+(raw.running?Math.max(0,now-Number(raw.lastAt||now)):0),lastAt:now,running};
  }
  function time(ms){if(!(ms>0))return 'Unavailable for this older run';const s=Math.floor(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
  function recordsHtml(state,scope){
    const rows=Object.entries(state.records).filter(([key])=>key.startsWith(`${scope}:`)).slice(-30);
    if(!rows.length)return '';
    return `<details><summary>Your ${scope==='coop'?'Co-op':'Solo'} Personal Bests</summary><small>Showing up to 30 recent mission records. Records grant no extra rewards.</small>${rows.map(([,r])=>`<p>${esc(r.title)} • ${esc(time(r.fastestMs))}${r.civilianTotal?` • ${r.bestRescued}/${r.civilianTotal} best rescue`:''} • ${r.clears} clear${r.clears===1?'':'s'}</p>`).join('')}</details>`;
  }
  function html(raw,stateRaw){
    const run=summary(raw),state=normalize(stateRaw),best=state.records[run.key],same=state.last?.id===run.id,changes=same?state.lastChanges:{};
    const reward=run.reward,medalNames=medals(run);
    const payout=!run.completed?'Attempt failed • no completion reward.':run.rewardState==='pending'?'Reward pending claim.':run.rewardState==='already-claimed'?'No additional payout • this mission reward was already claimed.':`Mission payout: $${(reward?.cash||0).toLocaleString()}${reward?.xp?` • ${reward.xp} XP`:''}${reward?.perkPoints?` • ${reward.perkPoints} perk points`:''}${reward?.seasonPoints?` • ${reward.seasonPoints} season points`:''}`;
    return `<section class="missionDebrief"><h3>${esc(run.title)} • ${run.completed?'Mission Debrief':'Attempt Debrief'}</h3>
      <p>${run.scope==='coop'?'Co-op':'Solo'} • Time: ${esc(time(run.durationMs))}${run.restarts?` • Includes ${run.restarts} restart${run.restarts===1?'':'s'}`:''}</p>
      <p>Civilians saved: ${run.rescued}/${run.civilianTotal} • Captured: ${run.captures} • Killed: ${run.kills}</p><p>${payout}</p>
      ${run.scope==='solo'?'<small>Other bonuses remain itemized in the existing reward breakdown.</small>':''}
      ${best?`<p>${changes.first?'First clear recorded.':changes.faster?'New fastest clear!':changes.betterRescue?'New best rescue result!':'Personal bests'} Fastest: ${esc(time(best.fastestMs))}${best.civilianTotal?` • Best rescue: ${best.bestRescued}/${best.civilianTotal}`:''} • ${best.clears} clear${best.clears===1?'':'s'}</p>`:''}
      ${medalNames.length?`<p>🏅 ${medalNames.map(esc).join(' • ')} <small>(recognition only; no extra payout)</small></p>`:''}
      ${run.contributions.length?`<details><summary>Team contributions • ${run.mode==='Survival'?'final wave':'final attempt'}</summary>${run.contributions.map(p=>`<p>${esc(p.name)}: ${p.recruited==null?'Recruitment unavailable for older run':`${p.recruited} civilians first recruited`} • ${p.captures} captures • ${p.kills} kills • ${p.damage} tiger damage • ${p.revives} revives</p>`).join('')}<small>Handoffs and deliveries do not award another recruitment credit.</small></details>`:''}${recordsHtml(state,run.scope)}</section>`;
  }
  function journeyHtml({scope='solo',state={},maxLevel=1,selectedLevel=1,missions=[]}={}){
    scope=scope==='coop'?'coop':'solo';
    const records=Object.entries(normalize(state).records).filter(([key,r])=>key.startsWith(`${scope}:`)&&r.campaignLevel>0);
    const unlocked=Math.min(100,Math.max(1,number(maxLevel))),selected=Math.min(unlocked,Math.max(1,number(selectedLevel)));
    const rows=Array.from({length:100},(_,i)=>{
      const level=i+1,entries=records.filter(([,r])=>r.campaignLevel===level).map(([,r])=>r);
      const times=entries.map(r=>r.fastestMs).filter(n=>n>0);
      return {level,title:missions[i]?.title||missions[i]?.objective||`Story Mission ${level}`,clears:entries.reduce((n,r)=>n+r.clears,0),medals:medalList(entries.flatMap(r=>r.medals)),fastest:times.length?Math.min(...times):null};
    });
    const current=rows[selected-1],total=rows.filter(r=>r.clears>0).length;
    return `<section class="missionJourney" aria-label="${scope==='coop'?'Co-op':'Solo'} chapter journey"><h3>🧭 ${scope==='coop'?'Co-op':'Solo'} Chapter Journey</h3><p>${total}/100 missions with recorded clears • ${rows.reduce((n,r)=>n+r.medals.length,0)} earned mission medals. Unlocks and rewards are unchanged.</p><p>Choose an unlocked mission below, then use the existing preparation and deployment controls. Medals are optional recognition, not extra difficulty or payout. Solo and Co-op records stay separate.</p>${Array.from({length:10},(_,chapter)=>{
      const batch=rows.slice(chapter*10,chapter*10+10),active=selected>chapter*10&&selected<=(chapter+1)*10;
      return `<details ${active?'open':''}><summary>Chapter ${chapter+1} • Missions ${chapter*10+1}–${(chapter+1)*10} • ${batch.filter(r=>r.clears).length}/10 recorded</summary><div class="journeyGrid">${batch.map(r=>`<button type="button" class="journeyMission ${r.level===selected?'selected':''}" ${r.level>unlocked?'disabled':scope==='coop'?`data-squad-command="select-story" data-squad-story-level="${r.level}"`:`onclick="setWorldMapPrep('selectedLevel',${r.level})"`} aria-pressed="${r.level===selected}"><b>${r.level>unlocked?'🔒 ':''}Mission ${r.level}</b><span>${esc(r.title)}</span><small>${r.level>unlocked?'Locked':r.clears?`${r.clears} recorded clear${r.clears===1?'':'s'} • ${r.medals.length} medals`:'No clear recorded yet'}</small></button>`).join('')}</div></details>`;
    }).join('')}<div class="journeyBest"><b>Mission ${selected} • ${esc(current.title)}</b><p>${current.fastest?`Optional replay challenge: beat your own ${esc(time(current.fastest))} clear.`:'Finish this mission to start your personal-best record.'}</p><p>Earned medals: ${current.medals.length?current.medals.map(esc).join(' • '):'Not recorded yet'}</p><small>Medals come only from real outcomes: Everyone Home needs civilians and no losses; Wildlife Guardian needs a capture and no kills; No Squad Wipe needs a tracked Co-op clear with zero wipes. Not every medal applies to every mission. Older clears are not retroactively awarded medals.</small></div></section>`;
  }
  return Object.freeze({VERSION:'12.0',summary,normalize,medals,record,clock,time,html,journeyHtml});
});
