(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerMasteryRewards=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const UNIFORMS=Object.freeze({
    'jungle-ranger':Object.freeze({light:'#7aaf63',body:'#356e39',dark:'#1d422c',vest:'#203e32',helmet:'#4a7b40',trim:'#c4e68b'}),
    'rescue-guardian':Object.freeze({light:'#ffbf75',body:'#c97026',dark:'#493b32',vest:'#f1d7a4',helmet:'#b56522',trim:'#fff1ca'}),
    'midnight-tracker':Object.freeze({light:'#697dba',body:'#30416e',dark:'#192338',vest:'#1f2d49',helmet:'#35466e',trim:'#a5b4fc'}),
    'village-sentinel':Object.freeze({light:'#b2bfcb',body:'#687d8f',dark:'#2d3f50',vest:'#394856',helmet:'#758b9c',trim:'#e2edf5'}),
    'river-guardian':Object.freeze({light:'#69d7d0',body:'#218d92',dark:'#18474c',vest:'#205960',helmet:'#29979b',trim:'#bbfff2'}),
    'mountain-rescuer':Object.freeze({light:'#eff3f5',body:'#b8c8d1',dark:'#4d6472',vest:'#627e92',helmet:'#d7e1e6',trim:'#f6fdff'}),
    'bloodline-warden':Object.freeze({light:'#e58181',body:'#9e3745',dark:'#472431',vest:'#542c3e',helmet:'#a3434f',trim:'#ffd0c1'}),
    'royal-vanguard':Object.freeze({light:'#f7d572',body:'#b28b27',dark:'#50401e',vest:'#4e412a',helmet:'#bd982e',trim:'#fff0a6'}),
    'hidden-path-scout':Object.freeze({light:'#ba9bdc',body:'#75518e',dark:'#35263f',vest:'#493450',helmet:'#826099',trim:'#eed7ff'}),
    'ancient-guardian':Object.freeze({light:'#fff1ca',body:'#d4be86',dark:'#4b5c48',vest:'#456c57',helmet:'#dcca9b',trim:'#b7e6ba'}),
  });
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
    {id:'none-uniform',slot:'uniform',name:'Previous / default uniform',icon:'🪖',metric:'clears',target:0,requirement:'Remove the mastery uniform; restore your previous appearance.'},
    {id:'jungle-ranger',slot:'uniform',name:'Jungle Ranger',icon:'🌳',chapter:1,metric:'clears',target:1,requirement:'Record a clear on 1 distinct Story mission.'},
    {id:'rescue-guardian',slot:'uniform',name:'Rescue Guardian',icon:'🦺',chapter:2,metric:'rescues',target:3,requirement:'Earn Everyone Home on 3 distinct Story missions.'},
    {id:'midnight-tracker',slot:'uniform',name:'Midnight Tracker',icon:'🌙',chapter:3,metric:'captures',target:5,requirement:'Earn Wildlife Guardian on 5 distinct Story missions.'},
    ...[
      [4,'village-sentinel','Village Sentinel','🏘️'],[5,'river-guardian','River Guardian','🌊'],
      [6,'mountain-rescuer','Mountain Rescuer','🏔️'],[7,'bloodline-warden','Bloodline Warden','🩸'],
      [8,'royal-vanguard','Royal Vanguard','👑'],[9,'hidden-path-scout','Hidden Path Scout','🔮'],
      [10,'ancient-guardian','Ancient Guardian','🏛️'],
    ].map(([chapter,id,name,icon])=>({id,slot:'uniform',name,icon,chapter,metric:'chapter',target:10,requirement:`Record clears on all 10 missions in Chapter ${chapter} (Missions ${chapter*10-9}–${chapter*10}).`})),
  ].map(Object.freeze));
  const scopeKey=value=>value==='coop'?'coop':'solo';
  function chapterProgress(state={},scope='solo'){
    const levels=new Set(Object.entries(state?.records||{}).filter(([key,r])=>key.startsWith(`${scopeKey(scope)}:`)&&Number.isInteger(r?.campaignLevel)&&r.campaignLevel>=1&&r.campaignLevel<=100&&r.clears>0).map(([,r])=>r.campaignLevel));
    return Array.from({length:10},(_,chapter)=>Array.from({length:10},(_,i)=>chapter*10+i+1).filter(level=>levels.has(level)).length);
  }
  function requirementText(item){
    return item?.chapter&&item.metric!=='chapter'?`${item.requirement} Alternatively, record clears on all 10 missions in Chapter ${item.chapter} (Missions ${item.chapter*10-9}–${item.chapter*10}).`:item?.requirement||'';
  }
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
    const chapters=chapterProgress(state,scope);
    const earned=Array.isArray(state?.masteryEarned?.[scopeKey(scope)])?state.masteryEarned[scopeKey(scope)]:[];
    return CATALOG.map(r=>{const count=r.metric==='chapter'?chapters[r.chapter-1]:counts[r.metric];return {...r,chapterClears:r.chapter?chapters[r.chapter-1]:null,progress:Math.min(r.target,count),unlocked:count>=r.target||(r.chapter&&chapters[r.chapter-1]===10)||earned.includes(r.id)};});
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
    return {title:publicItem(pick('title')),badge:publicItem(pick('badge')),uniform:publicItem(pick('uniform'))};
  }
  function equip(state={},scope,id){
    scope=scopeKey(scope);
    const item=rewards(state,scope).find(r=>r.id===id);
    if(!item)throw new Error('That mastery reward does not exist.');
    if(!item.unlocked)throw new Error(`Reward locked: ${requirementText(item)}`);
    return {...remember(state,scope),locker:{...state.locker,[scope]:{...state.locker?.[scope],[item.slot]:item.id.startsWith('none-')?'':item.id}}};
  }
  function identityText(value){return [value?.badge,value?.title].filter(Boolean).map(r=>`${r.icon} ${r.name}`).join(' • ');}
  function uniformPalette(id){return Object.prototype.hasOwnProperty.call(UNIFORMS,id)?UNIFORMS[id]:null;}
  function paintPreviews(doc=globalThis.document){
    if(!doc)return;
    doc.querySelectorAll('canvas[data-uniform-preview]:not([data-painted])').forEach(canvas=>{
      const ctx=canvas.getContext('2d');if(!ctx)return;
      const palette=uniformPalette(canvas.dataset.uniformId);
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#102333';ctx.fillRect(0,0,canvas.width,canvas.height);
      if(canvas.dataset.uniformPreview==='solo'){
        if(typeof globalThis.drawMissionUniformPreview!=='function')return;
        globalThis.drawMissionUniformPreview(ctx,palette);
      }else{
        const renderer=globalThis.TigerStrikeBattlefieldRenderer;if(!renderer?.drawSoldier)return;
        ctx.save();ctx.translate(120,88);ctx.scale(2,2);renderer.drawSoldier(ctx,{x:0,y:0,face:0,role:'tracker'},{mine:true,uniformPalette:palette});ctx.restore();
      }
      canvas.dataset.painted='true';
    });
  }
  function schedulePreviews(){if(typeof document!=='undefined'&&typeof queueMicrotask==='function')queueMicrotask(()=>paintPreviews());}
  function previewHtml(state,scope,id,name='Your Soldier'){
    const item=rewards(state,scope).find(r=>r.id===id),current=identity(state,scope);
    const equipped=item&&(item.id.startsWith('none-')?!current[item.slot]:current[item.slot]?.id===item.id);
    if(item)current[item.slot]=item.id.startsWith('none-')?null:item;
    schedulePreviews();
    const command=item?(scope==='coop'?`data-squad-command="mastery-equip" data-squad-item="${item.id}"`:`onclick="missionMasteryRewardCommand('equip','${item.id}',this)"`):'';
    const equipButton=item?`<div class="masteryRewardActions"><button type="button" ${command} ${equipped||!item.unlocked?'disabled':''}>${equipped?'Equipped':item.unlocked?'Equip preview':'Locked'}</button></div>`:'';
    return `<div class="masteryIdentityPreview"><b>${esc(name)}</b><canvas width="240" height="170" data-uniform-preview="${scopeKey(scope)}" data-uniform-id="${esc(current.uniform?.id||'')}" role="img" aria-label="${esc(current.uniform?.name||'Default uniform')} soldier preview"></canvas><p>${esc(identityText(current)||'Your existing soldier identity')}</p><p>${esc(current.uniform?.name||'Previous / default uniform')}</p><small>${item?`${item.unlocked?'Unlocked preview':'Locked preview — not equipped'} • ${esc(requirementText(item))}`:'Equipped identity • uniform colors only; movement and combat are unchanged.'}</small>${equipButton}</div>`;
  }
  function lockerHtml(state={},scope='solo',name='Your Soldier'){
    scope=scopeKey(scope);
    const current=identity(state,scope),rows=rewards(state,scope),label=scope==='coop'?'Co-op':'Solo';
    const button=(action,r,text,disabled=false)=>`<button type="button" ${scope==='coop'?`data-squad-command="mastery-${action}" data-squad-item="${r.id}"`:`onclick="missionMasteryRewardCommand('${action}','${r.id}',this)"`} ${disabled?'disabled':''}>${text}</button>`;
    return `<section class="masteryLocker" data-mastery-locker="${scope}" aria-label="${label} mastery reward locker"><h3>🎖️ ${label} Mastery Reward Locker</h3><p>Titles, badges and uniforms earned from recorded Story results in this mode only. Replaying the same mission does not count as another distinct mission. No purchases, combat boosts, or extra difficulty.</p><div data-mastery-preview="${scope}">${previewHtml(state,scope,'',name)}</div><details><summary>Browse titles, badges and uniforms • ${rows.filter(r=>r.target>0&&r.unlocked).length}/${rows.filter(r=>r.target>0).length} unlocked</summary><div class="masteryRewardGrid">${rows.map(r=>{
      const equipped=r.id.startsWith('none-')?!current[r.slot]:current[r.slot]?.id===r.id;
      return `<article class="masteryReward ${equipped?'equipped':''}"><b>${esc(r.icon)} ${esc(r.name)}</b><small>${label} • ${r.slot==='title'?'Title':r.slot==='uniform'?'Uniform':'Profile badge'} • ${r.unlocked?'Unlocked':`Locked ${r.progress}/${r.target}`}</small>${r.chapter?`<small>Chapter ${r.chapter} • Missions ${r.chapter*10-9}–${r.chapter*10} • ${r.chapterClears}/10 recorded clears</small>`:''}<p>${esc(requirementText(r))}</p><div class="masteryRewardActions">${button('preview',r,'Preview')}${button('equip',r,equipped?'Equipped':r.unlocked?'Equip':'Locked',equipped||!r.unlocked)}</div></article>`;
    }).join('')}</div></details><p class="masteryLockerStatus" role="status" aria-live="polite"></p></section>`;
  }
  return Object.freeze({VERSION:'12.3',CATALOG,progress,chapterProgress,rewards,remember,identity,equip,identityText,uniformPalette,paintPreviews,previewHtml,lockerHtml});
});
