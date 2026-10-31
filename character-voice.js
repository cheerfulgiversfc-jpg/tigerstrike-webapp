(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerCharacterVoice=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';let audio=null,lastAt=-Infinity,captionTimer=0,previous=null;const seen=new Set();
 const enabled=()=>{try{return root.localStorage?.getItem('ts_character_voice')!=='off';}catch(e){return true;}};
 function soundOn(){return typeof S==='undefined'||S.soundOn!==false;}
 function stop(){if(audio){audio.pause();audio.removeAttribute?.('src');audio.load?.();}root.clearTimeout?.(captionTimer);root.document?.getElementById('characterVoiceCaption')?.remove();}
 function setEnabled(value){try{root.localStorage?.setItem('ts_character_voice',value?'on':'off');}catch(e){}if(!value)stop();return !!value;}
 function caption(text){if(!root.document)return;let el=root.document.getElementById('characterVoiceCaption');if(!el){el=root.document.createElement('div');el.id='characterVoiceCaption';el.className='characterVoiceCaption';el.setAttribute('role','status');root.document.body.append(el);}const host=root.document.getElementById('eliteArmory');if(host?.open){if(el.parentElement!==host)host.querySelector('header').after(el);}else if(el.parentElement!==root.document.body)root.document.body.append(el);el.textContent=text;root.clearTimeout(captionTimer);captionTimer=root.setTimeout(()=>el.remove(),4200);}
 function play(cue,options={}){
  const soldier=Object.prototype.hasOwnProperty.call(options,'soldier')?options.soldier:root.TigerEliteArmory?.appearance().soldier,line=root.TigerEliteCatalog?.voices[soldier]?.[cue],now=Date.now();
  if(!line||!enabled()||!soundOn()||root.document?.hidden||!root.Audio)return false;
  const key=options.key&&`${soldier}:${cue}:${options.key}`;if(key&&seen.has(key))return false;
  if(!options.preview&&now-lastAt<6500)return false;
  if(!audio){audio=new root.Audio();audio.id='characterVoiceAudio';audio.setAttribute?.('aria-hidden','true');if(audio.style)audio.style.display='none';root.document?.body?.append(audio);}audio.pause();audio.volume=.42;audio.loop=false;audio.preload='none';audio.src=`/assets/audio/elite/${line.file}`;
  lastAt=now;if(key){seen.add(key);if(seen.size>160)seen.delete(seen.values().next().value);}caption(`${root.TigerEliteCatalog.items[soldier].name}: ${line.text}`);
  try{Promise.resolve(audio.play()).catch(()=>{});}catch(e){}return true;
 }
 function observe(snapshot,viewerId){const mine=snapshot?.players?.find(p=>Number(p.userId)===Number(viewerId));if(!mine)return;const run=`${snapshot.code}:${snapshot.startedAt}`,same=previous?.run===run,now={run,status:snapshot.status,captures:mine.capturedIds?.length||0,effect:mine.rescueTool?.effect?.until||0};
  if(snapshot.status==='active'&&!snapshot.paused){if(!same)play('ready',{soldier:mine.eliteAppearance?.soldier,key:run});else if(now.effect!==previous.effect&&mine.rescueTool?.effect?.kind==='med-drone')play('heal',{soldier:mine.eliteAppearance?.soldier,key:run+now.effect});else if(now.captures>previous.captures)play('capture',{soldier:mine.eliteAppearance?.soldier,key:run+now.captures});}
  if(same&&previous.status==='active'&&snapshot.status==='complete')play('extract',{soldier:mine.eliteAppearance?.soldier,key:run});previous=now;
 }
 root.document?.addEventListener('visibilitychange',()=>{if(root.document.hidden)stop();});
 return {play,stop,enabled,setEnabled,observe};
});
