(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerMasteryRewards=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CATALOG=Object.freeze([
    {id:'none-title',slot:'title',name:'Previous title',icon:'🪖',metric:'clears',target:0,requirement:'Remove the mastery title; restore your existing title.'},
    {id:'first-responder',slot:'title',name:'First Responder',icon:'🎖️',metric:'clears',target:1,requirement:'Record a clear on 1 distinct Story mission.'},
    {id:'civilian-guardian',slot:'title',name:'Civilian Guardian',icon:'🛡️',metric:'rescues',target:3,requirement:'Earn Everyone Home on 3 distinct Story missions.'},
    {id:'wildlife-warden',slot:'title',name:'Wildlife Warden',icon:'🌿',metric:'captures',target:5,requirement:'Earn Wildlife Guardian on 5 distinct Story missions.'},
    {id:'chapter-veteran',slot:'title',name:'Chapter Veteran',icon:'🏆',metric:'chapters',target:1,requirement:'Record clears on all 10 missions in any Story chapter.'},
    {id:'none-badge',slot:'badge',name:'No mastery badge',icon:'○',metric:'clears',target:0,requirement:'Remove the mastery badge.'},
    {id:'lifeline',slot:'badge',name:'Lifeline',icon:'💚',metric:'rescues',target:1,requirement:'Earn Everyone Home on 1 Story mission.'},
    {id:'living-paw',slot:'badge',name:'Living Paw',icon:'🐾',metric:'captures',target:1,requirement:'Earn Wildlife Guardian on 1 Story mission.'},
    {id:'chapter-crest',slot:'badge',name:'Chapter Crest',icon:'🏅',metric:'chapters',target:1,requirement:'Record clears on all 10 missions in any Story chapter.'},
  ].map(Object.freeze));
  const scopeKey=value=>value==='coop'?'coop':'solo';
  function progress(state={},scope='solo'){
    scope=scopeKey(scope);
    const levels=new Map();
    for(const [key,r] of Object.entries(state?.records||{})){
      const level=Number(r?.campaignLevel);
      if(!key.startsWith(`${scope}:`)||!Number.isInteger(level)||level<1||level>100||!(r?.clears>0))continue;
      if(!levels.has(level))levels.set(level,new Set());
      for(const name of (Array.isArray(r.medals)?r.medals:[]))levels.get(level).add(name);
    }
    let chapters=0;
    for(let chapter=0;chapter<10;chapter++)if(Array.from({length:10},(_,i)=>chapter*10+i+1).every(level=>levels.has(level)))chapters++;
    return {clears:levels.size,rescues:[...levels.values()].filter(m=>m.has('Everyone Home')).length,captures:[...levels.values()].filter(m=>m.has('Wildlife Guardian')).length,chapters};
  }
  function rewards(state,scope){
    const counts=progress(state,scope);
    const earned=Array.isArray(state?.masteryEarned?.[scopeKey(scope)])?state.masteryEarned[scopeKey(scope)]:[];
    return CATALOG.map(r=>({...r,progress:Math.min(r.target,counts[r.metric]),unlocked:counts[r.metric]>=r.target||earned.includes(r.id)}));
  }
  function remember(state={},scope='solo'){
    scope=scopeKey(scope);
    return {...state,masteryEarned:{...state.masteryEarned,[scope]:rewards(state,scope).filter(r=>r.target>0&&r.unlocked).map(r=>r.id)}};
  }
  function identity(state={},scope='solo'){
    scope=scopeKey(scope);
    const saved=state?.locker?.[scope]||{},rows=rewards(state,scope);
    const pick=slot=>rows.find(r=>r.slot===slot&&r.id===saved[slot]&&r.unlocked&&!r.id.startsWith('none-'));
    const publicItem=r=>r?{id:r.id,name:r.name,icon:r.icon}:null;
    return {title:publicItem(pick('title')),badge:publicItem(pick('badge'))};
  }
  function equip(state={},scope,id){
    scope=scopeKey(scope);
    const item=rewards(state,scope).find(r=>r.id===id);
    if(!item)throw new Error('That mastery reward does not exist.');
    if(!item.unlocked)throw new Error(`Reward locked: ${item.requirement}`);
    return {...remember(state,scope),locker:{...state.locker,[scope]:{...state.locker?.[scope],[item.slot]:item.id.startsWith('none-')?'':item.id}}};
  }
  function identityText(value){return [value?.badge,value?.title].filter(Boolean).map(r=>`${r.icon} ${r.name}`).join(' • ');}
  function previewHtml(state,scope,id,name='Your Soldier'){
    const item=rewards(state,scope).find(r=>r.id===id),current=identity(state,scope);
    if(item)current[item.slot]=item.id.startsWith('none-')?null:item;
    return `<div class="masteryIdentityPreview"><b>${esc(name)}</b><p>${esc(identityText(current)||'Your existing soldier identity')}</p><small>${item?`${item.unlocked?'Unlocked preview':'Locked preview — not equipped'} • ${esc(item.requirement)}`:'Equipped identity • titles and badges only; soldier appearance is unchanged.'}</small></div>`;
  }
  function lockerHtml(state={},scope='solo',name='Your Soldier'){
    scope=scopeKey(scope);
    const current=identity(state,scope),rows=rewards(state,scope),label=scope==='coop'?'Co-op':'Solo';
    const button=(action,r,text,disabled=false)=>`<button type="button" ${scope==='coop'?`data-squad-command="mastery-${action}" data-squad-item="${r.id}"`:`onclick="missionMasteryRewardCommand('${action}','${r.id}',this)"`} ${disabled?'disabled':''}>${text}</button>`;
    return `<section class="masteryLocker" data-mastery-locker="${scope}" aria-label="${label} mastery reward locker"><h3>🎖️ ${label} Mastery Reward Locker</h3><p>Titles and profile badges earned from recorded Story results in this mode only. Replaying the same mission does not count as another distinct mission. No purchases, combat boosts, or extra difficulty.</p><div data-mastery-preview="${scope}">${previewHtml(state,scope,'',name)}</div><details><summary>Browse titles and badges • ${rows.filter(r=>r.target>0&&r.unlocked).length}/${rows.filter(r=>r.target>0).length} unlocked</summary><div class="masteryRewardGrid">${rows.map(r=>{
      const equipped=r.id.startsWith('none-')?!current[r.slot]:current[r.slot]?.id===r.id;
      return `<article class="masteryReward ${equipped?'equipped':''}"><b>${esc(r.icon)} ${esc(r.name)}</b><small>${label} • ${r.slot==='title'?'Title':'Profile badge'} • ${r.unlocked?'Unlocked':`Locked ${r.progress}/${r.target}`}</small><p>${esc(r.requirement)}</p><div class="masteryRewardActions">${button('preview',r,'Preview')}${button('equip',r,equipped?'Equipped':r.unlocked?'Equip':'Locked',equipped||!r.unlocked)}</div></article>`;
    }).join('')}</div></details><p class="masteryLockerStatus" role="status" aria-live="polite"></p></section>`;
  }
  return Object.freeze({VERSION:'12.1',CATALOG,progress,rewards,remember,identity,equip,identityText,previewHtml,lockerHtml});
});
