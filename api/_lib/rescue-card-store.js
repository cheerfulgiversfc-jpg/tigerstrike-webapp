const crypto=require('node:crypto');
const PREFIX='ts:share-photo:v1:',TTL=86400,MAX_BYTES=600*1024;
const memory=()=>globalThis.__TS_CARD_MEMORY__||(globalThis.__TS_CARD_MEMORY__={images:new Map(),receipts:new Map(),rates:new Map()});
async function redis(command){
 const url=process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,token=process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN;
 if(!url||!token){if(process.env.TS_CARD_TEST_MEMORY==='1')return null;throw Error('Photo sharing storage is unavailable. Save or share the image from your device instead.');}
 const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(4000)}),data=await response.json();
 if(!response.ok||data.error)throw Error('Photo sharing storage is unavailable. Please try again.');return data.result;
}
function jpegBytes(value){
 if(typeof value!=='string'||!value.startsWith('data:image/jpeg;base64,')||value.length>MAX_BYTES*4/3+30)throw Error('Use the generated JPEG card, up to 600 KB.');
 const encoded=value.slice(23);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Invalid card image.');
 const data=Buffer.from(encoded,'base64');if(data.length<20||data.length>MAX_BYTES||data[0]!==255||data[1]!==216||data.at(-2)!==255||data.at(-1)!==217)throw Error('Invalid JPEG card.');
 let at=2,dimensions=null;
 while(at+4<data.length){if(data[at++]!==255)break;while(data[at]===255)at++;const marker=data[at++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  const len=data.readUInt16BE(at);if(len<2||at+len>data.length)break;
  if([0xc0,0xc1,0xc2].includes(marker)&&len>=8){dimensions={height:data.readUInt16BE(at+3),width:data.readUInt16BE(at+5)};break;}at+=len;
 }
 if(dimensions?.width!==1200||dimensions?.height!==1000)throw Error('The rescue card must be 1200 × 1000 pixels.');return data;
}
const putLua=`
local old=redis.call('GET',KEYS[2])
if old then return old end
local count=tonumber(redis.call('GET',KEYS[1]) or 0)
if count>=10 then return 'limited' end
redis.call('INCR',KEYS[1]);redis.call('EXPIRE',KEYS[1],172800)
redis.call('SET',KEYS[3],ARGV[1],'EX',86400)
redis.call('SET',KEYS[2],ARGV[2],'EX',86400)
return ARGV[2]`;
async function put(userId,runId,data){
 if(!Number.isSafeInteger(Number(userId))||Number(userId)<=0)throw Error('Invalid player.');
 const digest=crypto.createHash('sha256').update(String(runId)).update(data).digest('hex'),id=crypto.randomBytes(24).toString('hex'),expiresAt=Date.now()+TTL*1000,record={id,expiresAt},receipt=userId+':'+digest,rate=userId+':'+new Date().toISOString().slice(0,10);
 let result=await redis(['EVAL',putLua,3,PREFIX+'rate:'+rate,PREFIX+'receipt:'+receipt,PREFIX+'image:'+id,data.toString('base64'),JSON.stringify(record)]);
 if(result===null){const m=memory(),old=m.receipts.get(receipt);if(old&&old.expiresAt>Date.now())return old;if((m.rates.get(rate)||0)>=10)throw Error('Daily photo limit reached. You can still save or share the image from your device.');m.rates.set(rate,(m.rates.get(rate)||0)+1);m.images.set(id,{data:data.toString('base64'),expiresAt});m.receipts.set(receipt,record);return record;}
 if(result==='limited')throw Error('Daily photo limit reached. You can still save or share the image from your device.');return JSON.parse(result);
}
async function get(id){
 if(!/^[0-9a-f]{48}$/.test(String(id)))return null;
 const result=await redis(['GET',PREFIX+'image:'+id]);if(result!==null)return Buffer.from(result,'base64');
 if(process.env.TS_CARD_TEST_MEMORY!=='1')return null;const value=memory().images.get(id);return value&&value.expiresAt>Date.now()?Buffer.from(value.data,'base64'):null;
}
module.exports={put,get,jpegBytes,TTL,MAX_BYTES};
