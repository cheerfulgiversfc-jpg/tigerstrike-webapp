(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./expedition-mastery'):root.TigerExpeditionMastery,typeof module==='object'&&module.exports?require('./shared-battlefield-renderer'):root.TigerStrikeBattlefieldRenderer);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerRescueCommand=api;
})(globalThis,function(M,R){
  'use strict';
  const titles={'river-gate':'Blackout at River Gate','flooded-village':'Flooded Village','mountain-sos':'Mountain SOS'};
  const count=n=>Math.max(0,Math.floor(Number(n)||0));
  function model(book={},scope='All'){
    if(!['All',...M.modes].includes(scope))throw Error('Choose All, Solo, Co-op or Mixed records.');
    const rows=Object.entries(book.runs||{}).filter(([,r])=>titles[r.expeditionId]&&M.complete(r));
    const records=rows.filter(([,r])=>scope==='All'||M.mode(r)===scope).map(([id,r])=>({id,title:titles[r.expeditionId],expeditionId:r.expeditionId,route:r.route,mode:M.mode(r),
      rescued:count(r.stages[3].survivors),names:Array.isArray(r.stages[3].survivorNames)?r.stages[3].survivorNames.map(n=>String(n).slice(0,80)):null,
      captures:Object.values(r.stages).reduce((n,s)=>n+count(s.captures),0)}));
    const total=rows.length,level=total>=6?3:total>=3?2:total>=1?1:0;
    return {scope,records,clears:records.length,rescued:records.reduce((n,r)=>n+r.rescued,0),captures:records.reduce((n,r)=>n+r.captures,0),level,total,
      name:['Rescue outpost','Medical shelter','Wildlife recovery center','Regional rescue center'][level],
      next:level===3?null:[1,3,6][level],identity:M.identity(book)};
  }
  function box(c,x,y,w,h,color,r=5){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
  function text(c,s,x,y,size=14,color='#edf7ef'){c.fillStyle=color;c.font=`800 ${size}px system-ui`;c.textAlign='center';c.fillText(s,x,y);}
  // The center is a read-only visualization of confirmed outcomes, never a second sanctuary ledger.
  function draw(c,data,{now=0,area='overview',arrival=null,elapsed=0,reduced=false}={}){
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
    const replay=arrival&&elapsed<12000,progress=Math.min(1,Math.max(0,elapsed/12000));
    const civilians=replay?arrival.rescued:data.rescued,tigers=replay?arrival.captures:data.captures;
    for(let i=0;i<Math.min(4,civilians);i++){
      if(replay&&progress<.25)continue;
      const moving=replay&&progress<.65&&!reduced;
      const p=moving?Math.min(1,(progress-.25)/.4):1;
      R.drawCivilian(c,{x:340+i*35+(1-p)*100,y:300+(1-p)*155,face:-1.9,look:i%2?'scout':'field'},
        {now,scale:.7,walking:moving,phase:now/170,celebration:replay&&progress>.7?.55:0});
    }
    R.drawCivilian(c,{x:242,y:298,look:'doctor',face:0},{now,scale:.75});
    for(let i=0;i<Math.min(2,replay&&progress<.5?0:tigers);i++)R.drawTiger(c,{x:720+i*95,y:205,type:'Standard',hp:100,hpMax:100},{now,scale:.48,phase:now/900,walking:false,facing:i?-1:1});
    R.drawSoldier(c,{x:555,y:354,face:-2,eliteAppearance:data.identity?{expeditionUniform:data.identity}:{}},{now,scale:.8,lowerWeapon:true,showMarker:false});
    if(replay){const x=progress<.25?-90+progress*2400:progress>.75?510+(progress-.75)*2400:510;
      R.drawVehicle(c,{type:'truck',x,y:522,angle:0},{now,scale:.8,moving:progress<.25||progress>.75});
      if(arrival.captures>0&&progress<.5)R.drawCaptureCage(c,x-28,492,.48,{now});
    }else R.drawVehicle(c,{type:'truck',x:790,y:522,angle:0},{now,scale:.7,moving:false});
    R.drawMapLighting(c,{x:0,y:0,w:1000,h:650});
    c.restore();
    box(c,220,12,560,47,'#0c2830e8',10);text(c,data.name.toUpperCase(),500,43,20);
    const caption=replay?(progress<.25?'Rescue transport arriving':progress<.75?'Survivors welcomed • Wildlife recovery handover':'Transport departing • Rescue recorded'):
      area==='medical'?'MEDICAL SHELTER · People brought home safely':area==='wildlife'?'PROTECTED HABITATS · Live captures supported this center':'YOUR EXPEDITION RESCUES · One shared home';
    box(c,70,583,860,45,'#0c2830eb',10);text(c,caption,500,611,16);
    c.restore();
  }
  function open({book={},load}={}){
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
    const summary=el('p'),growth=el('p'),details=el('div'),skip=el('button','Skip arrival scene');skip.hidden=true;
    const note=el('p','People shown represent confirmed final evacuees; the same survivors are counted once per completed run. Habitat tigers represent recorded live captures, not tracked individual residents or release eligibility. Arrival scenes replay recorded outcomes; they do not award or transfer anything.');note.className='commandNote';
    d.append(header,intro,label,refresh,status,nav,canvas,skip,summary,growth,details,note);doc.body.append(d);d.showModal();
    let scope='All',area='overview',data=model(book),arrival=null,started=0,frame=0,closed=false,ticket=0,last=0;
    const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    const stop=()=>{arrival=null;skip.hidden=true;paint(performance.now());};
    function paint(now){draw(canvas.getContext('2d'),data,{now,area,arrival,elapsed:now-started,reduced:reduced()});}
    function loop(now){if(closed)return;if(arrival&&now-started>=12000){arrival=null;skip.hidden=true;status.textContent='Arrival replay complete. Your recorded progress is unchanged.';}
      if(!doc.hidden&&now-last>=(reduced()?250:50)){paint(now);last=now;}frame=requestAnimationFrame(loop);}
    function render(){data=model(book,scope);summary.textContent=`${data.clears} completed expeditions · ${data.rescued} people evacuated · ${data.captures} live captures · ${scope} records`;
      growth.textContent=`${data.name} · ${data.total} account expedition clears. `+(data.next===null?'All center facilities unlocked.':`${data.next-data.total} more completed run(s) to the next center upgrade.`);
      details.replaceChildren();details.append(el('h3','Your rescue history'));
      if(!data.records.length)details.append(el('p','No completed three-stage expeditions in this view yet. Finish a run in Rescue Mode; incomplete stage credits remain in expedition rewards.'));
      for(const row of data.records.slice(-20).reverse()){
        const card=el('article');card.append(el('h4',row.title),el('p',`${row.mode} · Route: ${globalThis.TigerRescueExpedition?.definition(row.expeditionId)?.routes[row.route]?.name||row.route} · ${row.rescued} final evacuees · ${row.captures} live captures`),el('p',row.names===null?'Names were not saved in this older receipt.':row.names.length?`Brought home: ${row.names.join(', ')}.`:'No final evacuees recorded.'));
        const watch=el('button','Watch arrival · '+row.title);watch.onclick=()=>{area='overview';render();arrival=row;started=performance.now();skip.hidden=false;status.textContent='Replaying your recorded rescue outcome. Skip is always available.';paint(started);canvas.scrollIntoView({block:'center'});};card.append(watch);details.append(card);
      }
      for(const button of nav.children)button.setAttribute('aria-pressed',String(button.dataset.area===area));paint(performance.now());
    }
    for(const [id,name]of [['overview','Center overview'],['medical','Medical shelter'],['wildlife','Wildlife habitats']]){const b=el('button',name);b.dataset.area=id;b.onclick=()=>{area=id;stop();render();};nav.append(b);}
    async function reload(){const own=++ticket;refresh.disabled=true;status.textContent='Loading confirmed expedition records…';try{const next=await load();if(closed||ticket!==own)return;book=next||{};stop();render();status.textContent='Confirmed records loaded. Co-op outcomes credit each recorded participant; these are your personal records.';}catch(e){if(!closed&&own===ticket)status.textContent='Records could not refresh: '+e.message+'. Previously loaded records remain visible.';}finally{if(!closed&&own===ticket)refresh.disabled=false;}}
    close.onclick=()=>d.close();skip.onclick=()=>{stop();status.textContent='Arrival replay skipped. Progress is unchanged.';};filter.onchange=()=>{scope=filter.value;stop();render();};refresh.onclick=reload;refresh.hidden=!load;
    d.addEventListener('close',()=>{closed=true;ticket++;cancelAnimationFrame(frame);d.remove();},{once:true});render();frame=requestAnimationFrame(loop);if(load)reload();return d;
  }
  return {model,draw,open};
});
