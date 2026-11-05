(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerPartnerRules=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';const STYLES=Object.freeze([{id:'first-response',name:'First Response badge',goal:1,metric:'runs',description:'Finish one mission together.'},{id:'rescue-link',name:'Rescue Link uniform patch',goal:5,metric:'distinct',description:'Complete five different missions together.'},{id:'conservation-team',name:'Conservation Team card design',goal:10,metric:'captures',description:'Capture ten tigers alive together.'}]);
 function rewards(pair){return STYLES.map(s=>({...s,progress:Math.max(0,Number(pair?.[s.metric])||0),earned:Number(pair?.[s.metric])>=s.goal}));}
 function style(pair,uid){return pair?.want?.[pair.members?.[0]?.id]&&pair?.want?.[pair.members?.[1]?.id]&&rewards(pair).some(s=>s.id===pair?.selection?.[uid]&&s.earned)?pair.selection[uid]:'';}
 return Object.freeze({STYLES,rewards,style});
});
