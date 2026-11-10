const {AsyncLocalStorage}=require('node:async_hooks'),{isEvent}=require('../../live-rescue-event');const expedition=require('../../rescue-expedition');const scopes=new AsyncLocalStorage();
const suffix=()=>scopes.getStore()||'';
function run(type,fn){return scopes.run(expedition.isExpedition(type)?'_expedition':isEvent(type)?(type==='monsoon-solo'?'_rescue_solo':'_rescue_squad'):'',fn);}
module.exports={run,suffix};
