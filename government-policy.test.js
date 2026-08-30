const assert=require("node:assert/strict");
const test=require("node:test");
const policy=require("./government-policy");

test("humane missions reduce review risk and receive full funding",()=>{
  const result=policy.audit({reviewPoints:22,trust:80,captures:2,evac:3,kills:0,civDead:0});
  assert.equal(result.status,"GOOD_STANDING");
  assert.equal(result.reviewPoints,0);
  assert.equal(result.fundingRate,1);
  assert.equal(result.funding,2325);
  assert(result.trustDelta>0);
});

test("repeated lethal missions open an investigation and cut funding",()=>{
  const first=policy.audit({reviewPoints:0,trust:80,kills:2});
  assert.equal(first.status,"MONITORED");
  assert.equal(first.fundingRate,.6);
  const second=policy.audit({reviewPoints:first.reviewPoints,trust:first.trust,kills:2});
  assert.equal(second.status,"INVESTIGATION");
  assert.equal(second.fundingRate,.25);
  assert(second.funding<first.funding);
});

test("severe case risk suspends funding while clean work can restore it",()=>{
  const suspended=policy.audit({reviewPoints:70,trust:30,kills:1,civDead:1});
  assert.equal(suspended.status,"FUNDING_SUSPENDED");
  assert.equal(suspended.funding,0);
  const recovery=policy.audit({reviewPoints:54,trust:65,captures:3,evac:4});
  assert.equal(recovery.status,"GOOD_STANDING");
  assert(recovery.reviewPoints<25);
  assert(recovery.funding>0);
});

test("detention and rehabilitation suspend funding until the case is resolved",()=>{
  assert.equal(policy.effectiveStatus({reviewPoints:82,trust:18,stage:"DETENTION_NOTICE"}),"DETAINED");
  assert.equal(policy.effectiveStatus({reviewPoints:40,trust:60,stage:"REHABILITATION"}),"REHABILITATION");
  const detained=policy.audit({reviewPoints:82,trust:18,captures:3,evac:4,stage:"QUESTIONING"});
  assert.equal(detained.status,"DETAINED");
  assert.equal(detained.funding,0);
});

test("GONE ROGUE permanently overrides trust and mission conduct funding",()=>{
  const rogue=policy.audit({reviewPoints:0,trust:100,captures:5,evac:8,path:"ROGUE"});
  assert.equal(rogue.status,"GONE_ROGUE");
  assert.equal(rogue.fundingRate,0);
  assert.equal(rogue.funding,0);
});
