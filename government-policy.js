(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.TigerGovernmentPolicy=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value||0)));
  const STATUS=Object.freeze({
    GOOD_STANDING:{label:"Good Standing",fundingRate:1},
    MONITORED:{label:"Monitored",fundingRate:.6},
    INVESTIGATION:{label:"Active Investigation",fundingRate:.25},
    FUNDING_SUSPENDED:{label:"Funding Suspended",fundingRate:0},
    DETAINED:{label:"Detained for Questioning",fundingRate:0},
    REHABILITATION:{label:"Rehabilitation Program",fundingRate:0},
    GONE_ROGUE:{label:"GONE ROGUE",fundingRate:0},
  });
  function statusFor(reviewPoints=0,trust=80){
    const review=clamp(Math.round(reviewPoints),0,100),score=clamp(Math.round(trust),0,100);
    if(review>=75||score<=20)return "FUNDING_SUSPENDED";
    if(review>=50||score<=35)return "INVESTIGATION";
    if(review>=25||score<=55)return "MONITORED";
    return "GOOD_STANDING";
  }
  function effectiveStatus(input={}){
    const path=String(input.path||"PROGRAM").toUpperCase();
    const stage=String(input.stage||"CLEAR").toUpperCase();
    if(path==="ROGUE")return "GONE_ROGUE";
    if(stage==="DETENTION_NOTICE"||stage==="QUESTIONING"||stage==="ESCAPE_CONFIRM"||stage==="ESCAPE")return "DETAINED";
    if(stage==="REHABILITATION")return "REHABILITATION";
    return statusFor(input.reviewPoints,input.trust);
  }
  function audit(input={}){
    const captures=Math.max(0,Math.floor(Number(input.captures||0)));
    const kills=Math.max(0,Math.floor(Number(input.kills||0)));
    const evac=Math.max(0,Math.floor(Number(input.evac||0)));
    const civDead=Math.max(0,Math.floor(Number(input.civDead||0)));
    const clean=kills===0&&civDead===0;
    const beforeReview=clamp(Math.round(Number(input.reviewPoints||0)),0,100);
    const reviewRaw=(kills*18)+(civDead*28)-(captures*9)-(evac*2)-(clean&&(captures>0||evac>0)?8:0);
    const reviewPoints=clamp(beforeReview+reviewRaw,0,100);
    const trustAlreadyApplied=!!input.trustAlreadyApplied;
    const trustDelta=trustAlreadyApplied?0:clamp((captures*4)-(kills*5)-(civDead*10)+(clean&&(captures>0||evac>0)?2:0),-40,24);
    const trust=clamp(Math.round(Number(input.trust??80))+trustDelta,0,100);
    const status=effectiveStatus({reviewPoints,trust,path:input.path,stage:input.stage});
    const fundingRate=STATUS[status].fundingRate;
    const baseFunding=450+(captures*750)+(evac*125);
    const funding=Math.max(0,Math.round(baseFunding*fundingRate));
    return {captures,kills,evac,civDead,clean,beforeReview,reviewPoints,reviewDelta:reviewPoints-beforeReview,trust,trustDelta,status,fundingRate,funding};
  }
  return {STATUS,statusFor,effectiveStatus,audit};
});
