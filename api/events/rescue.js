const { json, readJsonBody } = require('../_lib/http');
const { validateTelegramInitData } = require('../_lib/telegram-auth');
const C = require('../../live-rescue-event');
const store = require('../_lib/rescue-event-store');
const scheduleStore = require('../_lib/rescue-event-schedule');
const E = require('../_lib/elite-store');

function calendar(schedule) {
  return { event:{...C.EVENT,start:schedule.startedAt||null,end:schedule.paused?null:schedule.endsAt}, schedule, phase:schedule.phase };
}
module.exports = async(req,res) => {
  res.setHeader?.('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,error:'Method not allowed.'});
  try {
    if(req.method==='GET')return json(res,200,{ok:true,...calendar(await scheduleStore.read()),organizerConfigured:!!String(process.env.TELEGRAM_ADMIN_IDS||'').trim()});
    const b=readJsonBody(req),{user}=validateTelegramInitData(String(b.initData||''),process.env.TELEGRAM_BOT_TOKEN||'');
    const canManage=scheduleStore.canManage(user);
    if(['pause','resume'].includes(b.action)) {
      if(!canManage)throw Error('Only a configured Tiger Strike administrator can pause or resume this event.');
      await scheduleStore.set(b.action);
    }
    const progress=await store.get(user.id);
    if(b.action==='equip') {
      const id=String(b.id||'');
      if(!['monsoon_uniform','monsoon_finish'].includes(id)||!progress.earned.includes(id))throw Error('Earn this event reward before equipping it.');
      await E.grantEarned(user.id,progress.earned);
      const a=await E.get(user.id);
      await E.equip(user.id,{...a.selection,[id==='monsoon_uniform'?'soldier':'weapon']:id});
    } else if(b.action==='rewards')await E.grantEarned(user.id,progress.earned);
    else if(!['stats','share','pause','resume',undefined].includes(b.action))throw Error('Unknown event action.');
    const account=await E.get(user.id),schedule=await scheduleStore.read();
    const rewards=C.EVENT.rewards.filter(r=>progress.earned.includes(r.id)).map(r=>r.name);
    const username=String(process.env.TELEGRAM_BOT_USERNAME||process.env.TELEGRAM_BOT_PUBLIC_USERNAME||'').trim().replace(/^@+/,'');
    const share={url:username?`https://t.me/${username}?startapp=monsoon`:'https://tigerstrike-webapp.vercel.app',text:`Tiger Strike • ${C.EVENT.title}\nI rescued ${progress.rescues} villagers in ${progress.clears} completed event missions.${rewards.length?'\nEarned: '+rewards.join(', '):''}\nCommunity: ${progress.total} / ${C.EVENT.goal} rescues.\n${schedule.phase==='paused'?'The event is paused until the organizer resumes it.':'Play Solo or team up for the rescue.'}`};
    return json(res,200,{ok:true,...calendar(schedule),canManage,progress,owned:account.owned,selection:E.catalog.appearance(account.owned,account.selection),...(b.action==='share'?{share}:{})});
  } catch(e) {return json(res,req.method==='GET'?503:400,{ok:false,error:e.message||'Could not load the rescue event.'});}
};
