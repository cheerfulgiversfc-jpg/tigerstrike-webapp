(function(root){
 'use strict';
 function length(path){return path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0);}
 function position(path,distance){let left=Math.max(0,distance);for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],n=Math.hypot(b.x-a.x,b.y-a.y);if(left<=n)return {x:a.x+(b.x-a.x)*left/n,y:a.y+(b.y-a.y)*left/n,angle:Math.atan2(b.y-a.y,b.x-a.x)};left-=n;}return {...path.at(-1),angle:Math.atan2(path.at(-1).y-path.at(-2).y,path.at(-1).x-path.at(-2).x)};}
 function step(previous,{attempt,now,path,players=[],tigers=[],routeReady=false,active=false,paused=false}){
  const prior=previous?.attempt===attempt?previous:{attempt,distance:0,at:now};
  const point=position(path,prior.distance),total=length(path),dt=Math.max(0,Math.min(750,now-prior.at));
  const connected=players.length>0&&players.every(p=>now-Number(p.lastSeenAt||0)<=15000);
  const escort=players.some(p=>!p.downed&&Math.hypot(p.x-point.x,p.y-point.y)<=450);
  const danger=tigers.some(t=>!t.defeated&&Number(t.hp)>0&&Math.hypot(t.x-point.x,t.y-point.y)<330);
  const reason=!active?'Waiting for deployment':paused?'Paused':!routeReady?'Open the chosen route':!connected?'Waiting for squad connection':!escort?'Bring a standing escort within 450m':danger?'Tiger near convoy — clear the threat':prior.distance>=total?'Convoy delivered':'Convoy moving';
  const distance=Math.min(total,prior.distance+(reason==='Convoy moving'?dt*.13:0));
  return {attempt,distance,at:now,total,reason:distance>=total?'Convoy delivered':reason,...position(path,distance),arrived:distance>=total};
 }
 const api={length,position,step};if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerWildlifeCorridor=api;
})(globalThis);
