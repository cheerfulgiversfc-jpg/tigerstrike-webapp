const {json,readJsonBody}=require('../_lib/http');
const {validateTelegramInitData}=require('../_lib/telegram-auth');
const {telegramBotApi}=require('../_lib/telegram-api');
const store=require('../_lib/player-launch-store');
const {canManage}=require('../_lib/rescue-event-schedule');
let discovered='';
async function botUrl(){
 let name=String(process.env.TELEGRAM_BOT_USERNAME||process.env.TELEGRAM_BOT_PUBLIC_USERNAME||discovered||'').trim().replace(/^@+/,'');
 if(!name&&process.env.TELEGRAM_BOT_TOKEN){try{name=String((await telegramBotApi('getMe',{},process.env.TELEGRAM_BOT_TOKEN)).username||'');discovered=name;}catch{}}
 return /^[a-zA-Z0-9_]{5,32}$/.test(name)?'https://t.me/'+name:'';
}
async function invite(code,userId){
 if(!/^[A-Z0-9]{6}$/.test(code))throw Error('Enter the six-character squad code.');
 const S=require('../_lib/squad-session'),room=await S.readSession(code);S.ensureLiveSession(room);
 const mission=S.missionDefinition(room);
 return {code,title:mission.title||room.title||'Tiger Strike Squad',objective:mission.objective||'Complete the shared rescue mission together.',level:room.storyMissionLevel||0,status:room.status,players:room.memberIds.length,launchType:room.launchType,...(userId?{returning:room.memberIds.includes(String(userId))||room.memberIds.includes(Number(userId))}: {})};
}
module.exports=async(req,res)=>{
 res.setHeader?.('Cache-Control','no-store');
 try{
  if(req.method==='GET'){
   const url=await botUrl(),code=String(req.query?.squad||'').toUpperCase();
   let invitation=null,inviteError='';if(code){try{invitation=await invite(code);}catch(e){inviteError=e.message;}}
   return json(res,200,{ok:true,botUrl:url,invitation,inviteError});
  }
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed.'});
  const b=readJsonBody(req),{user}=validateTelegramInitData(String(b.initData||''),process.env.TELEGRAM_BOT_TOKEN||'');
  const owner=canManage(user),action=String(b.action||'status');
  if(action==='dashboard'){if(!owner)throw Error('Only a configured Tiger Strike administrator can view player reports.');return json(res,200,{ok:true,...await store.dashboard()});}
  if(action==='invite')return json(res,200,{ok:true,invitation:await invite(String(b.code||'').toUpperCase(),user.id)});
  if(action==='open')await store.track(user.id,'open');
  else if(['tutorial-start','tutorial-complete'].includes(action))await store.track(user.id,action);
  else if(['feedback','bug'].includes(action))return json(res,200,{ok:true,...await store.submit(user.id,action,b)});
  else if(action!=='status')throw Error('Unknown player hub action.');
  return json(res,200,{ok:true,canManage:owner,...await store.status(user.id)});
 }catch(e){return json(res,400,{ok:false,error:e.message||'Player hub unavailable.'});}
};
