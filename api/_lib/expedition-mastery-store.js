const {getState,compareAndSetState}=require('./metrics-store');
const mastery=require('../../expedition-mastery');
const residents=require('../../rescue-residents');
const key=uid=>`expedition_mastery_v1_${Number(uid)}`;
const read=async uid=>residents.bootstrap((await getState(key(uid)))||mastery.empty());
async function mutate(uid,fn){
  for(let retry=0;retry<12;retry++){
    const previous=await getState(key(uid)),next=fn(previous||mastery.empty());
    if(JSON.stringify(previous)===JSON.stringify(next))return next;
    // Earned outfits and completion receipts persist without an expiry.
    if(await compareAndSetState(key(uid),previous,next,null))return next;
  }
  throw Error('Your expedition records are busy. Refresh to retry.');
}
async function creditRun(run){
  const ids=[...new Set((run?.results||[]).flatMap(r=>r.team||[]).map(p=>Number(p.userId)).filter(id=>Number.isSafeInteger(id)&&id>0))];
  for(const uid of ids)await mutate(uid,state=>mastery.credit(state,run,uid));
}
const equip=(uid,id)=>mutate(uid,state=>mastery.equip(state,id));
async function appearance(uid,base){
  const identity=mastery.identity(await read(uid));
  return identity?{...base,expeditionUniform:identity}:base;
}
const release=(uid,id)=>mutate(uid,state=>residents.release(state,id));
module.exports={read,creditRun,equip,appearance,release};
