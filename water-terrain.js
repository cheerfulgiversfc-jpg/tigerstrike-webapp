(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerWaterTerrain=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
  function banks(zone,x){
    const wavelength=Math.max(600,Number(zone.wavelength)||2400),phase=x/wavelength*Math.PI*2;
    const center=Number(zone.y)+Math.sin(phase)*32+Math.sin(phase*2+.4)*13;
    const half=Math.max(38,Number(zone.ry)||80)*(1+Math.sin(phase*1.5+.8)*.12);
    return {top:center-half,bottom:center+half,center,half};
  }
  function river(width,height,crossings=[]){
    const w=Math.max(320,Number(width)||1200),h=Math.max(320,Number(height)||1100);
    const zone={id:'living_river',kind:'river',x:w/2,y:h*.82,rx:w/2,ry:Math.min(88,h*.075),wavelength:2400,label:'River',bridges:[]};
    for(const x of crossings){const b=banks(zone,x);zone.bridges.push({x:x-58,y:b.top-22,w:116,h:b.bottom-b.top+44});}
    return zone;
  }
  function natural(zone){const name=String(zone.label||zone.id||'');return zone.kind==='river'?zone:{...zone,kind:!/pool|lake|pond/i.test(name)&&/river|channel|crossing|flood|bank|current|road/i.test(name)?'river':'pond'};}
  function pondRadius(zone,angle){return zone.kind==='puddle'?1+.20*Math.sin(angle*3+.7)+.11*Math.cos(angle*5+1.4)+.06*Math.sin(angle*7):1+.055*Math.sin(angle*3+.7)+.035*Math.cos(angle*5+1.4);}
  function onBridge(zone,x,y,pad=0){return (zone.bridges||[]).some(b=>x>=b.x-pad&&x<=b.x+b.w+pad&&y>=b.y-pad&&y<=b.y+b.h+pad);}
  function depth(zone,x,y){
    if(!zone||!Number.isFinite(x)||!Number.isFinite(y)||onBridge(zone,x,y))return 0;
    if(zone.kind==='river'){
      if(x<zone.x-zone.rx||x>zone.x+zone.rx)return 0;
      const b=banks(zone,x);return clamp(1-Math.abs(y-b.center)/b.half,0,1);
    }
    const a=Number(zone.rot)||0,dx=x-zone.x,dy=y-zone.y;
    const nx=(dx*Math.cos(a)+dy*Math.sin(a))/Math.max(1,zone.rx),ny=(-dx*Math.sin(a)+dy*Math.cos(a))/Math.max(1,zone.ry);
    return clamp(1-Math.hypot(nx,ny)/pondRadius(zone,Math.atan2(ny,nx)),0,1);
  }
  const contains=(zone,x,y)=>depth(zone,x,y)>0;
  const swimming=(zones,x,y)=>(zones||[]).some(z=>depth(z,x,y)>.18);
  function outline(zone,view){
    const out=[];
    if(zone.kind==='river'){
      const left=Math.max(zone.x-zone.rx,view?view.x-160:-Infinity),right=Math.min(zone.x+zone.rx,view?view.x+view.w+160:Infinity),step=48;
      for(let x=left;x<right;x+=step)out.push([x,banks(zone,x).top]);out.push([right,banks(zone,right).top]);
      for(let x=right;x>left;x-=step)out.push([x,banks(zone,x).bottom]);out.push([left,banks(zone,left).bottom]);
    }else{
      const a=Number(zone.rot)||0;
      for(let i=0;i<48;i++){const t=i/48*Math.PI*2,r=pondRadius(zone,t),x=Math.cos(t)*zone.rx*r,y=Math.sin(t)*zone.ry*r;out.push([zone.x+x*Math.cos(a)-y*Math.sin(a),zone.y+x*Math.sin(a)+y*Math.cos(a)]);}
    }
    return out;
  }
  function overlaps(zone,rect,pad=0){
    if(zone.kind==='river'){
      const lo=Math.max(rect.x-pad,zone.x-zone.rx),hi=Math.min(rect.x+rect.w+pad,zone.x+zone.rx);if(lo>hi)return false;
      for(let x=lo;x<=hi+1;x+=Math.max(1,(hi-lo)/8)){const b=banks(zone,x);if(rect.y+rect.h+pad>=b.top&&rect.y-pad<=b.bottom)return true;}return false;
    }
    const ex=Math.hypot(zone.rx*Math.cos(zone.rot||0),zone.ry*Math.sin(zone.rot||0))*1.1,ey=Math.hypot(zone.rx*Math.sin(zone.rot||0),zone.ry*Math.cos(zone.rot||0))*1.1;
    return rect.x+rect.w+pad>=zone.x-ex&&rect.x-pad<=zone.x+ex&&rect.y+rect.h+pad>=zone.y-ey&&rect.y-pad<=zone.y+ey;
  }
  function crossings(width,family='district'){
    if(family==='district'){const out=[];for(let x=606;x<width;x+=1200)out.push(x);return out;}
    return (family==='suburbs'?[.2,.72]:family==='downtown'?[.12,.32,.52,.72,.90]:family==='industrial'?[.52]:family==='forest'?[]:[.28,.54,.81]).map(n=>n*width);
  }
  function boatPlacement(zone,player={}){
    if(zone.kind!=='river')return null;
    let x=clamp(Number(player.x)||zone.x,zone.x-zone.rx+80,zone.x+zone.rx-80);
    for(let tries=0;tries<12&&onBridge(zone,x,banks(zone,x).center,40);tries++)x=clamp(x+150,zone.x-zone.rx+80,zone.x+zone.rx-80);
    if(onBridge(zone,x,banks(zone,x).center,40))x=zone.x-zone.rx+100;
    const b=banks(zone,x),north=Number(player.y||0)<b.center,y=north?b.top+28:b.bottom-28;
    return {x,y,vehicleX:x,vehicleY:y,vehicleAngle:0,shoreX:x,shoreY:north?b.top-12:b.bottom+12,waterCenterX:x,waterCenterY:b.center,sharedStoryRiver:true};
  }
  function boatDeparture(zone,start,progress){
    const x=start.x+clamp(progress,0,1)*560,b=banks(zone,x);
    const offset=clamp(start.y-banks(zone,start.x).center,-b.half*.5,b.half*.5);
    return {x,y:b.center+offset,angle:Math.atan2(banks(zone,x+10).center-banks(zone,x-10).center,20)};
  }
  function dryPoint(zones,x,y,pad=48){
    let point={x,y};
    for(const zone of zones||[]){
      if(!contains(zone,point.x,point.y))continue;
      if(zone.kind==='river'){const b=banks(zone,point.x);point.y=point.y<b.center?b.top-pad:b.bottom+pad;}
      else{const angle=Math.atan2((point.y-zone.y)/zone.ry,(point.x-zone.x)/zone.rx),r=pondRadius(zone,angle);const a=zone.rot||0,dx=Math.cos(angle)*(zone.rx*r+pad),dy=Math.sin(angle)*(zone.ry*r+pad);point={x:zone.x+dx*Math.cos(a)-dy*Math.sin(a),y:zone.y+dx*Math.sin(a)+dy*Math.cos(a)};}
    }
    return point;
  }
  return Object.freeze({banks,river,natural,outline,depth,contains,swimming,overlaps,crossings,boatPlacement,boatDeparture,onBridge,dryPoint});
});
