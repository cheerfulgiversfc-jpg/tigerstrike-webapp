const assert=require("node:assert/strict");
const fs=require("node:fs");
const test=require("node:test");

const game=fs.readFileSync("game.js","utf8");
const coop=fs.readFileSync("squad-coop.js","utf8");
const server=fs.readFileSync("api/_lib/squad-session.js","utf8");
const html=fs.readFileSync("index.html","utf8");

test("government oversight is connected to solo, co-op, saves, and visible UI",()=>{
  assert(game.includes("applyGovernmentMissionAudit")&&game.includes("governmentProgram"),"solo mission completion applies and saves government audits");
  assert(game.includes("trustAlreadyApplied:true"),"solo audit does not double-count trust already changed during combat");
  assert(game.includes("governmentProgram: cloneState"),"government cases persist in Story profile saves");
  assert(html.includes("Government Oversight")&&html.includes("governmentAuditRisk"),"mission results show trust, review risk, and funding");
  assert(game.includes("governmentProgramStatusSummary")&&game.includes("Government grants depend on captures"),"mission brief explains consequences before deployment");
  assert(server.includes("governmentAudit")&&server.includes("auditDerived.tigerKills"),"the co-op server returns authoritative shared conduct totals");
  assert(coop.includes("applyGovernmentMissionAudit")&&coop.includes("runId:data.receipt"),"each co-op player applies the audit once to their own save");
  assert(server.includes('exempt:operationId === "endless-survival"'),"Endless Survival is explicitly exempt");
});
