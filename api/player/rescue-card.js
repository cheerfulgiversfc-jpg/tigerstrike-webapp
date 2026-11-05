const {json,readJsonBody}=require('../_lib/http');
const {validateTelegramInitData}=require('../_lib/telegram-auth');
const store=require('../_lib/rescue-card-store');
const cards=require('../../result-cards'),D=require('../../mission-debrief');
const BASE='https://tigerstrike-webapp.vercel.app';
async function recordsFor(user,body){
 if(body.scope==='solo'){
  const source=body.records;if(!source||JSON.stringify(source).length>48000)throw Error('Invalid recorded result.');
  const state=D.normalize(source);if(state.last?.scope!=='solo')throw Error('Choose your recorded Solo result.');return state;
 }
 if(body.scope!=='coop')throw Error('Invalid result mode.');
 if(!['','monsoon-solo','monsoon-rescue'].includes(String(body.profileType||'')))throw Error('Invalid Co-op profile.');
 return require('../_lib/rescue-profile-scope').run(body.profileType||'',async()=> (await require('../_lib/squad-session').readCoopProfile(user)).missionDebriefs);
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 try{
  if(req.method==='GET'){
   if(!req.query?.id)return json(res,200,{ok:true,service:'rescue-card-photo'});
   const image=await store.get(String(req.query.id));if(!image)return json(res,404,{ok:false,error:'This card image is unavailable or expired.'});
   res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Disposition','inline; filename="tiger-strike-rescue.jpg"');res.setHeader('X-Content-Type-Options','nosniff');return res.status(200).end(image);
  }
  if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed.'});
  const body=readJsonBody(req),token=process.env.TELEGRAM_BOT_TOKEN||'',{user}=validateTelegramInitData(String(body.initData||''),token);
  const bytes=store.jpegBytes(body.jpeg),records=await recordsFor(user,body),m=cards.model(records.last,records);
  if(!m||m.id!==String(body.runId||''))throw Error('Share your latest completed, claimed mission result.');
  const photo=await store.put(user.id,m.id,bytes),photoUrl=BASE+'/api/player/rescue-card?id='+photo.id;
  const payload={user_id:user.id,allow_user_chats:true,allow_group_chats:true,allow_channel_chats:true,allow_bot_chats:false,result:{type:'photo',id:photo.id,photo_url:photoUrl,thumbnail_url:photoUrl,photo_width:1200,photo_height:1000,title:'Tiger Strike rescue highlight',caption:(cards.caption(m)+'\n'+BASE+'/discover'+(m.scope==='solo'?'\nSolo • player-recorded result.':'')).slice(0,1024),reply_markup:{inline_keyboard:[[{text:'Play Tiger Strike',url:BASE+'/discover'}]]}}};
  const response=await fetch('https://api.telegram.org/bot'+token+'/savePreparedInlineMessage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)}),data=await response.json();
  if(!response.ok||!data.ok||!data.result?.id)throw Error('Telegram could not prepare this photo. Retry, or use device image sharing.');
  const expiresAt=Math.min(photo.expiresAt,Number(data.result.expiration_date)*1000||photo.expiresAt);
  return json(res,200,{ok:true,preparedMessageId:String(data.result.id),expiresAt});
 }catch(e){return json(res,400,{ok:false,error:e.message||'Card photo unavailable.'});}
};
