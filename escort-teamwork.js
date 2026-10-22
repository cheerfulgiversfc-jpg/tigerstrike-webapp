(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerEscortTeamwork=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RANGE=200,OFFER_MS=20000;
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function counts(civilians=[],viewerId=0,now=Date.now()){
    const result={you:0,teammate:0,entering:0,safe:0,available:0};
    for(const c of civilians){
      if(c.dead||c.alive===false)continue;
      if(c.secured||c.evac){if((c.rescueArrival&&now<c.rescueArrival.at+2000)||(c.boardingAt&&Number(c.boardedAt)>now))result.entering++;else result.safe++;}
      else if(c.following)result[Number(c.followingUserId||viewerId)===Number(viewerId)?'you':'teammate']++;
      else result.available++;
    }
    return result;
  }
  function followers(civilians,ownerId){return civilians.filter(c=>c.following&&!c.secured&&Number(c.followingUserId)===Number(ownerId));}
  function transferable(civilians,ownerId,receiver){return followers(civilians,ownerId).filter(c=>distance(c,receiver)<=RANGE);}
  function activeOffer(offer,session,now=Date.now()){
    return offer&&offer.expiresAt>now&&offer.runId===`${session.code}:${session.startedAt}`?offer:null;
  }
  return Object.freeze({VERSION:'11.8',RANGE,OFFER_MS,distance,counts,followers,transferable,activeOffer});
});
