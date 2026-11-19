(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./expedition-mastery'):root.TigerExpeditionMastery,typeof module==='object'&&module.exports?require('./shared-battlefield-renderer'):root.TigerStrikeBattlefieldRenderer);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerRescueCommand=api;
})(globalThis,function(M,R){
  const residents=typeof module==='object'&&module.exports?require('./rescue-residents'):globalThis.TigerRescueResidents;
  'use strict';
  const titles={'river-gate':'Blackout at River Gate','flooded-village':'Flooded Village','mountain-sos':'Mountain SOS'};
  const count=n=>Math.max(0,Math.floor(Number(n)||0));
  function model(book={},scope='All'){
    if(!['All',...M.modes].includes(scope))throw Error('Choose All, Solo, Co-op or Mixed records.');
    const rows=Object.entries(book.runs||{}).filter(([,r])=>titles[r.expeditionId]&&M.complete(r));
    const records=rows.filter(([,r])=>scope==='All'||M.mode(r)===scope).map(([id,r])=>({id,title:titles[r.expeditionId],expeditionId:r.expeditionId,route:r.route,mode:M.mode(r),
      rescued:count(r.stages[3].survivors),names:Array.isArray(r.stages[3].survivorNames)?r.stages[3].survivorNames.map(n=>String(n).slice(0,80)):null,
      captures:Object.values(r.stages).reduce((n,s)=>n+count(s.captures),0),tigers:Object.values(r.stages).flatMap(s=>s.capturedTigers||[]),evacuees:r.stages[3].evacuees||(r.stages[3].survivorNames||[]).map(name=>({name,look:'field'}))}));
    const total=rows.length,level=total>=6?3:total>=3?2:total>=1?1:0;
    return {residents:residents.view(book,scope),scope,records,clears:records.length,rescued:records.reduce((n,r)=>n+r.rescued,0),captures:records.reduce((n,r)=>n+r.captures,0),level,total,
      name:['Rescue outpost','Medical shelter','Wildlife recovery center','Regional rescue center'][level],
      next:level===3?null:[1,3,6][level],identity:M.identity(book)};
  }
  function box(c,x,y,w,h,color,r=5){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function text(c,s,x,y,size=14,color='#edf7ef'){c.fillStyle=color;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
  // Resident care and releases are expedition-only records; Story sanctuary supplies stay separate.
  function draw(c,data,{now=0,area='overview',arrival=null,scene=null,elapsed=0,reduced=false}={}){
    if(scene?.kind==='release')return drawRelease(c,scene.resident,{now,elapsed,reduced});
    c.save();c.clearRect(0,0,1000,650);c.save();
    if(area==='medical'){c.scale(1.8,1.8);c.translate(-90,-55);}else if(area==='wildlife'){c.scale(2,2);c.translate(-485,-55);}
    const grass=c.createLinearGradient(0,0,1000,650);grass.addColorStop(0,'#54834d');grass.addColorStop(1,'#214f3f');c.fillStyle=grass;c.fillRect(0,0,1000,650);
    R.drawGroundTexture(c,{x:0,y:0,w:1000,h:650},{heavy:true});
    box(c,0,475,1000,95,'#445a61');box(c,25,275,940,55,'#819584');box(c,460,260,65,240,'#819584');
    c.strokeStyle='#dbc879';c.lineWidth=3;c.setLineDash([19,21]);c.beginPath();c.moveTo(0,522);c.lineTo(1000,522);c.stroke();c.setLineDash([]);
    for(const [x,y,s]of [[40,88,1],[120,100,1.1],[385,110,.9],[620,85,1],[935,100,1.1],[50,390,.8],[940,400,.85],[80,630,1],[905,620,1]])R.drawMapTree(c,x,y,s);
    R.drawMapHouse(c,170,125,185,110,{roof:'#357a70',roofRise:40});
    box(c,250,139,12,39,'#f0f5e1',2);box(c,237,152,38,12,'#f0f5e1',2);
    text(c,data.level?'MEDICAL SHELTER':'FIELD AID STATION',262,267,13);
    if(data.level>=2)R.drawMapHouse(c,380,110,140,90,{roof:'#536f85',roofRise:30});
    box(c,650,140,245,125,'#689a5b');
    c.save();c.beginPath();c.rect(652,142,241,121);c.clip();R.drawGroundTexture(c,{x:652,y:142,w:241,h:121},{heavy:true});c.restore();
    R.drawMapTree(c,675,170,.5);R.drawMountainRock(c,864,172,.19);
    // A protected habitat boundary, not a cage over the animal or an invented capture.
    c.strokeStyle='#bed0bd';c.lineWidth=3;c.strokeRect(650,140,245,125);
    for(let x=652;x<896;x+=21){c.beginPath();c.moveTo(x,250);c.lineTo(x,274);c.stroke();}
    text(c,'WILDLIFE RECOVERY',772,298,13);
    if(data.level>=3)R.drawMapHouse(c,660,360,185,85,{roof:'#8c6946',roofRise:30});
    const arrivalData=arrival||(scene?.kind==='arrival-person'?{evacuees:[scene.resident],tigers:[]}:scene?.kind==='arrival-tiger'?{evacuees:[],tigers:[scene.resident]}:null);
    const replay=arrivalData&&elapsed<12000,progress=Math.min(1,Math.max(0,elapsed/12000));
    const basePatients=replay?(arrivalData.evacuees||[]):data.residents?.people||[],baseAnimals=replay?(arrivalData.tigers||[]):(data.residents?.tigers||[]).filter(t=>t.status!=='released');
    const carePatient=['care-person','talk-person'].includes(scene?.kind)?scene.resident:area==='medical'?basePatients.find(p=>p.status==='recovering'):null,careTiger=scene?.kind==='care-tiger'?scene.resident:area==='wildlife'?baseAnimals.find(t=>t.status==='recovering'):null;
    const patients=carePatient?[carePatient,...basePatients.filter(p=>p.id!==carePatient.id)]:basePatients,animals=careTiger?[careTiger,...baseAnimals.filter(t=>t.id!==careTiger.id)]:baseAnimals;
    const civilians=patients.length,tigers=animals.length;
    for(let i=0;i<Math.min(4,civilians);i++){
      if(replay&&progress<.25)continue;
      const moving=replay&&progress<.65&&!reduced;
      const p=moving?Math.min(1,(progress-.25)/.4):1;
      const patient=carePatient&&i===0?carePatient:patients[i];
      R.drawCivilian(c,{x:340+i*50+(1-p)*100,y:300+(1-p)*155,face:-1.9,look:patient?.look||(i%2?'scout':'field'),child:patient?.child},
        {now,scale:.7,walking:moving,phase:now/170,celebration:replay&&progress>.7?.55:0});
      if(!replay&&patient)text(c,patient.name.slice(0,18),340+i*50,334,7);
      if(carePatient&&i===0&&scene?.kind!=='talk-person'){R.drawCivilian(c,{x:315,y:300,look:'doctor',face:0},{now,scale:.7,caring:!reduced});carePulse(c,340,300,now,reduced);}
    }
    R.drawCivilian(c,{x:242,y:298,look:'doctor',face:0},{now,scale:.75});
    for(let i=0;i<Math.min(2,replay&&progress<.5?0:tigers);i++){const tiger=careTiger&&i===0?careTiger:animals[i];
      R.drawTiger(c,{...tiger,x:720+i*95,y:205,type:tiger?.type||'Standard',hp:100,hpMax:100,captured:!!careTiger&&i===0},{now,scale:.48,phase:now/900,walking:false,facing:i?-1:1,showState:false});
      if(!replay&&tiger)text(c,tiger.name.slice(0,18),720+i*95,245,8);
      if(careTiger&&i===0){R.drawCivilian(c,{x:700,y:225,look:'doctor',face:0},{now,scale:.55,caring:!reduced});carePulse(c,720,205,now,reduced);}
    }
    R.drawSoldier(c,{x:scene?.kind==='talk-person'?295:555,y:scene?.kind==='talk-person'?300:354,face:scene?.kind==='talk-person'?0:-2,eliteAppearance:data.identity?{expeditionUniform:data.identity}:{}},{now,scale:.8,lowerWeapon:true,showMarker:false});
    if(replay){const x=progress<.25?-90+progress*2400:progress>.75?510+(progress-.75)*2400:510;
      R.drawVehicle(c,{type:'truck',x,y:522,angle:0},{now,scale:.8,moving:progress<.25||progress>.75});
      if(animals.length>0&&progress<.5)R.drawCaptureCage(c,x-28,492,.48,{now,tiger:animals[0]});
    }else R.drawVehicle(c,{type:'truck',x:790,y:522,angle:0},{now,scale:.7,moving:false});
    R.drawMapLighting(c,{x:0,y:0,w:1000,h:650});
    c.restore();
    box(c,220,12,560,47,'#0c2830e8',10);text(c,data.name.toUpperCase(),500,43,20);
    const caption=scene?.kind==='talk-person'?`Talking with ${scene.resident.name}`:scene&&!replay?`Care replay · ${scene.resident.name} · ${scene.resident.status==='recovering'?'Recovery checks':'Care completed'}`:replay?(progress<.25?'Rescue transport arriving':progress<.75?(civilians?(tigers?'Survivors welcomed • Wildlife recovery handover':'Survivor welcomed to medical care'):'Wildlife recovery handover'):'Transport departing • Rescue recorded'):
      area==='medical'?'MEDICAL SHELTER · People brought home safely':area==='wildlife'?'PROTECTED HABITATS · Live captures supported this center':'YOUR EXPEDITION RESCUES · One shared home';
    box(c,70,583,860,45,'#0c2830eb',10);text(c,caption,500,611,16);
    c.restore();
  }
  function carePulse(c,x,y,now,reduced){
    c.save();c.strokeStyle='#a8f4d3';c.lineWidth=2;c.globalAlpha=.55;
    c.beginPath();c.arc(x,y-8,27+(reduced?0:Math.sin(now/400)*3),0,Math.PI*2);c.stroke();
    box(c,x+16,y-34,15,15,'#f4f8e8',3);box(c,x+22,y-32,3,11,'#348a73',1);box(c,x+18,y-28,11,3,'#348a73',1);c.restore();
  }
  function drawRelease(c,resident,{now,elapsed,reduced}){
    const p=Math.max(0,Math.min(1,elapsed/12000)),mountain=resident.expeditionId==='mountain-sos';
    c.save();c.clearRect(0,0,1000,650);const grass=c.createLinearGradient(0,0,1000,650);grass.addColorStop(0,mountain?'#4e756a':'#568c55');grass.addColorStop(1,'#1d4f3c');c.fillStyle=grass;c.fillRect(0,0,1000,650);R.drawGroundTexture(c,{x:0,y:0,w:1000,h:650},{heavy:true});
    const trace=ctx=>{ctx.beginPath();ctx.moveTo(0,80);ctx.bezierCurveTo(300,30,700,190,1000,90);ctx.lineTo(1000,0);ctx.lineTo(0,0);ctx.closePath();};
    R.drawMapWaterSurface(c,trace,{x:0,y:0,w:1000,h:180},{now:reduced?0:now,heavy:true});
    for(const [x,y,s]of [[55,230,1.4],[150,260,1],[430,240,1.2],[650,250,1.4],[870,270,1.5],[990,350,1.3],[80,590,1.1],[530,600,1.2],[750,600,1.4],[990,590,1.1]])R.drawMapTree(c,x,y,s);
    if(mountain)for(const x of [250,570,850])R.drawMountainRock(c,x,215,.5);
    box(c,0,450,420,95,'#748274',20);R.drawVehicle(c,{type:'truck',x:160,y:486,angle:0},{now,scale:.95,moving:false});
    R.drawSoldier(c,{x:275,y:400,face:0},{now,scale:.9,lowerWeapon:true,showMarker:false});R.drawCivilian(c,{x:230,y:405,face:0,look:'doctor'},{now,scale:.8});
    R.drawCaptureCage(c,350,400,.85,{now,tiger:resident,empty:p>=.25,openGate:p>=.25});
    if(p>=.25){const stride=(p-.25)/.75;R.drawTiger(c,{...resident,x:350+stride*780,y:405+Math.sin(stride*Math.PI)*35,hp:100,hpMax:100,captured:false},{now,scale:.85,walking:!reduced,phase:stride*32,facing:1,showState:false});}
    R.drawMapLighting(c,{x:0,y:0,w:1000,h:650});box(c,90,15,820,60,'#102b31eb',10);text(c,'PROTECTED '+(mountain?'MOUNTAIN FOREST':'RIVER FOREST')+' RELEASE',500,43,19);text(c,resident.name+' · Recorded wildlife release',500,64,13);
    box(c,90,580,820,45,'#102b31eb',10);text(c,p<.25?'Rangers prepare the recovered tiger':p<.8?'Gate open · Returning to a protected habitat':'Back in the wild · Your rescue journal remembers',500,608,16);c.restore();
  }
  function open({book={},load,release}={}){
    const doc=globalThis.document;if(!doc||doc.getElementById('rescueCommandDialog'))return;
    const el=(tag,value)=>{const n=doc.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
    const d=el('dialog');d.id='rescueCommandDialog';d.setAttribute('aria-labelledby','rescueCommandTitle');
    const header=el('header'),title=el('h2','Rescue Command');title.id='rescueCommandTitle';const close=el('button','Back to expeditions');header.append(title,close);
    const intro=el('p','Your expedition rescue center. Completed runs support its growth. This optional visit does not change mission supplies, rewards or the existing Tiger Sanctuary.');
    const filter=el('select');filter.setAttribute('aria-label','Rescue Command records');for(const mode of ['All',...M.modes]){const option=el('option',mode);filter.append(option);}
    const label=el('label','Show records ');label.append(filter);
    const refresh=el('button','Refresh records'),status=el('p');status.setAttribute('role','status');
    const canvas=el('canvas');canvas.width=1000;canvas.height=650;canvas.setAttribute('aria-label','Detailed expedition rescue center with medical shelter and protected wildlife habitat');
    const nav=el('nav');nav.setAttribute('aria-label','Rescue center areas');
    const summary=el('p'),growth=el('p'),details=el('div'),skip=el('button','Skip arrival scene');skip.hidden=true;skip.className='commandSkip';header.insertBefore(skip,close);
    const talk=el('section');talk.className='commandConversation';talk.hidden=true;talk.setAttribute('aria-label','Survivor conversation');
    const note=el('p','This is your personal expedition center. Each Co-op participant keeps the same rescue provenance with separate care and release records. Recovery needs one later completed expedition stage for people and two for tigers. Watching or skipping scenes does not advance care. Older capture totals without saved identities remain history only. Story sanctuary records and mission supplies are unchanged.');note.className='commandNote';
    d.append(header,intro,label,refresh,status,nav,canvas,talk,summary,growth,details,note);doc.body.append(d);d.showModal();
    let scope='All',area='overview',data=model(book),scene=null,conversation=null,limit=12,busy=false,arrival=null,started=0,frame=0,closed=false,ticket=0,last=0;
    const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    const stop=()=>{endTalk();arrival=null;scene=null;skip.hidden=true;paint(performance.now());};
    function playScene(kind,resident){endTalk();arrival=null;scene={kind,resident};area=kind==='care-person'?'medical':kind==='care-tiger'?'wildlife':'overview';for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.area===area));started=performance.now();skip.textContent='Skip scene';skip.hidden=false;status.textContent=kind==='release'?'Replaying the saved wildlife release. Skip does not undo the release.':kind.startsWith('arrival-')?'Arrival replay from this resident’s saved rescue. No rewards or care are added.':'Medical care replay. Recovery advances only through completed expedition stages.';paint(started);canvas.scrollIntoView({block:'center'});}
    function endTalk(){conversation=null;talk.hidden=true;talk.replaceChildren();if(scene?.kind==='talk-person')scene=null;}
    function showTalk(id,topic='rescue',scroll=true){
      const response=residents.conversation(book,id,topic),p=response.resident;conversation={id,topic};arrival=null;scene={kind:'talk-person',resident:p};area='medical';skip.hidden=true;
      talk.hidden=false;talk.replaceChildren();const h=el('h3','Talk with '+p.name),origin=el('p',response.origin+' · '+(data.residents.people.find(r=>r.id===id)?.mode||p.mode)),portrait=el('canvas');portrait.width=190;portrait.height=170;portrait.className='commandPortrait';portrait.setAttribute('aria-label','Detailed portrait of '+p.name);
      const quote=el('blockquote',response.line);quote.setAttribute('aria-live','polite');talk.append(h,origin,portrait,quote);
      const ctx=portrait.getContext('2d');ctx.fillStyle='#183b40';ctx.fillRect(0,0,190,170);R.drawCivilian(ctx,{...p,x:95,y:98,face:0},{scale:2.4,now:0});
      for(const [next,label]of [['rescue','Tell me about your rescue'],['recovery','How are you feeling?']]){const b=el('button',label);b.setAttribute('aria-pressed',String(next===topic));b.onclick=()=>showTalk(id,next,false);talk.append(b);}
      const done=el('button','End conversation');done.onclick=()=>{endTalk();paint(performance.now());status.textContent='Conversation ended. Your rescue records are unchanged.';};talk.append(done);
      status.textContent='Talking with '+p.name+'. Conversations do not change care, rewards or supplies.';for(const b of nav.children)b.setAttribute('aria-pressed',String(b.dataset.area===area));paint(performance.now());if(scroll)talk.scrollIntoView({block:'center'});
    }
    function paint(now){draw(canvas.getContext('2d'),data,{now,area,arrival,scene,elapsed:now-started,reduced:reduced()});}
    function loop(now){if(closed)return;if((arrival||scene&&scene.kind!=='talk-person')&&now-started>=12000){arrival=null;scene=null;skip.hidden=true;status.textContent='Scene complete. Saved records are unchanged by playback.';}
      if(!doc.hidden&&now-last>=(reduced()?250:50)){paint(now);last=now;}frame=requestAnimationFrame(loop);}
    function render(){data=model(book,scope);summary.textContent=`${data.clears} completed expeditions · ${data.rescued} people evacuated · ${data.captures} live captures · ${scope} records`;
      growth.textContent=`${data.name} · ${data.total} account expedition clears. `+(data.next===null?'All center facilities unlocked.':`${data.next-data.total} more completed run(s) to the next center upgrade.`);
      if(conversation){if(data.residents.people.some(p=>p.id===conversation.id))showTalk(conversation.id,conversation.topic,false);else endTalk();}
      details.replaceChildren();mountResidents();details.append(el('h3','Your rescue history'));
      if(!data.records.length)details.append(el('p','No completed three-stage expeditions in this view yet. Finish a run in Rescue Mode; incomplete stage credits remain in expedition rewards.'));
      for(const row of data.records.slice(-20).reverse()){
        const card=el('article');card.append(el('h4',row.title),el('p',`${row.mode} · Route: ${globalThis.TigerRescueExpedition?.definition(row.expeditionId)?.routes[row.route]?.name||row.route} · ${row.rescued} final evacuees · ${row.captures} live captures`),el('p',row.names===null?'Names were not saved in this older receipt.':row.names.length?`Brought home: ${row.names.join(', ')}.`:'No final evacuees recorded.'));
        const watch=el('button','Watch arrival · '+row.title);watch.onclick=()=>{endTalk();area='overview';render();scene=null;arrival=row;skip.textContent='Skip arrival scene';started=performance.now();skip.hidden=false;status.textContent='Replaying your recorded rescue outcome. Skip is always available.';paint(started);canvas.scrollIntoView({block:'center'});};card.append(watch);details.append(card);
      }
      for(const button of nav.children)button.setAttribute('aria-pressed',String(button.dataset.area===area));paint(performance.now());
    }
    function mountResidents(){
      details.append(el('h3','People and wildlife in your care'));
      const list=[...data.residents.people,...data.residents.tigers].reverse();
      if(!list.length)details.append(el('p','No individual residents recorded yet. Complete an expedition stage with live captures, or finish an evacuation. Older totals without identities stay in rescue history.'));
      for(const resident of list.slice(0,limit)){
        const card=el('article'),origin=titles[resident.expeditionId],stateLabel=resident.status==='release-ready'?'Ready for wildlife release':resident.status==='recovered'?'Recovered safely':resident.status==='released'?'Released to protected habitat':`Recovering · ${resident.care}/${resident.needed} later expedition stages completed`;
        card.append(el('h4',resident.name),el('p',`${resident.kind==='tiger'?resident.type:'Civilian'} · ${origin} · Stage ${resident.stage} · ${resident.mode}`),el('p',stateLabel),el('small',`Rescue ${resident.runId.slice(0,8)} · Field tag ${JSON.parse(resident.id)[2]}`));
        if(resident.kind==='person'){const chat=el('button','Talk with '+resident.name);chat.onclick=()=>showTalk(resident.id);card.append(chat);}
        if(resident.status!=='released'){const care=el('button','Watch care · '+resident.name);care.onclick=()=>playScene(resident.kind==='tiger'?'care-tiger':'care-person',resident);card.append(care);}
        if(resident.kind==='tiger'){
          const action=el('button',resident.status==='released'?'Watch release · '+resident.name:resident.status==='release-ready'?'Release to protected habitat · '+resident.name:'Release locked · Finish recovery');
          action.disabled=resident.status!=='released'&&(resident.status!=='release-ready'||!release||busy);
          action.onclick=async()=>{
            if(resident.status==='released'){playScene('release',resident);return;}if(busy)return;busy=true;ticket++;filter.disabled=true;refresh.disabled=true;render();status.textContent='Saving the wildlife release…';
            try{const next=await release(resident.id);if(closed)return;book=next;data=model(book,scope);const saved=data.residents.tigers.find(t=>t.id===resident.id);if(saved?.status!=='released')throw Error('Release is not confirmed. Refresh and retry.');render();playScene('release',saved);}
            catch(e){status.textContent='Release could not be confirmed: '+e.message+'. Refresh records or retry; the same tiger cannot be released twice.';}
            finally{busy=false;if(!closed){filter.disabled=false;refresh.disabled=false;render();}}
          };card.append(action);
        }
        details.append(card);
      }
      if(list.length>limit){const more=el('button','Show more residents');more.onclick=()=>{limit+=12;render();};details.append(more);}
      const journal=el('details'),caption=el('summary','Rescue journal · arrivals, care and releases');journal.append(caption);
      for(const entry of data.residents.journal.slice(0,limit*3)){
        const row=el('article');row.append(el('p',`${entry.type==='arrival'?'Arrived':entry.type==='recovery'?'Recovery completed':'Released to protected habitat'} · ${entry.name} · ${titles[entry.expeditionId]} · ${entry.mode}`));
        const replay=residents.journalReplay(book,entry.id,scope);if(replay){const b=el('button',`Replay ${entry.type==='arrival'?'arrival':entry.type==='recovery'?'care':'release'} · ${entry.name}`);b.onclick=()=>playScene(replay.kind,replay.resident);row.append(b);}journal.append(row);
      }
      details.append(journal);
    }
    for(const [id,name]of [['overview','Center overview'],['medical','Medical shelter'],['wildlife','Wildlife habitats']]){const b=el('button',name);b.dataset.area=id;b.onclick=()=>{area=id;stop();render();};nav.append(b);}
    async function reload(){const own=++ticket;if(busy)return;refresh.disabled=true;status.textContent='Loading confirmed expedition records…';try{const next=await load();if(closed||ticket!==own)return;book=next||{};stop();render();status.textContent='Confirmed records loaded. Co-op outcomes credit each recorded participant; these are your personal records.';}catch(e){if(!closed&&own===ticket)status.textContent='Records could not refresh: '+e.message+'. Previously loaded records remain visible.';}finally{if(!closed&&own===ticket)refresh.disabled=false;}}
    close.onclick=()=>d.close();skip.onclick=()=>{stop();status.textContent='Scene skipped. Saved records are unchanged.';};filter.onchange=()=>{scope=filter.value;limit=12;stop();render();};refresh.onclick=reload;refresh.hidden=!load;
    d.addEventListener('close',()=>{closed=true;ticket++;cancelAnimationFrame(frame);d.remove();},{once:true});render();frame=requestAnimationFrame(loop);if(load)reload();return d;
  }
  return {model,draw,drawRelease,open};
});
