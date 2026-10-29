(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./water-terrain'):root.TigerWaterTerrain,typeof module==='object'&&module.exports?require('./chapter-maps'):root.TigerChapterMaps);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TigerMissionRoutes=api;})(typeof globalThis!=='undefined'?globalThis:this,function(water,maps){
  'use strict';
  const valid=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const enabled=level=>Number.isInteger(Number(level))&&level>=1&&level<=100;
  const choice=value=>value==='shelter'?'shelter':'direct';
  const length=path=>path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
  const cache=new Map();
  function shelters(level,world){
    if(!enabled(level))return [];
    const layout=[[['Ranger Shelter',.32,.38],['Trail Shelter',.72,.60]],[['Village Ranger Shelter',.38,.35],['Forest Escort Shelter',.60,.65]],[['Research Trail Shelter',.21,.36],['Deep Jungle Shelter',.70,.59]],[['North Block Shelter',.42,.24],['South Block Shelter',.62,.69]],[['North Bank Shelter',.37,.34],['South Bank Shelter',.61,.68]],[['Ridge Shelter',.36,.32],['Highland Shelter',.64,.66]],[['Canopy Shelter',.38,.43],['Territory Shelter',.70,.56]],[['West Front Shelter',.42,.66],['East Front Shelter',.62,.24]],[['Expedition Shelter',.36,.39],['Ruins Trail Shelter',.60,.67]],[['Temple Approach Shelter',.34,.27],['Guardian Trail Shelter',.62,.68]]][Math.floor((Number(level)-1)/10)];
    return layout.map(([label,x,y],i)=>({id:i?'south_refuge':'north_refuge',label,x:world.width*x,y:world.height*y,w:140,h:80}));
  }
  function inside(p,s){return valid(p)&&Math.abs(p.x-s.x)<=60&&p.y>=s.y-50&&p.y<=s.y+10;}
  function cover({level,world,point,lastShotAt=0,now=Date.now(),faction='tiger'}={}){return enabled(level)&&faction!=='government'&&(!lastShotAt||now-lastShotAt>=3000)&&shelters(level,world).some(s=>inside(point,s))?.5:1;}
  function damage(amount,options){const n=Math.max(0,Number(amount)||0);return cover(options)<1&&n>0?Math.min(n,Math.max(1,Math.round(n*.5))):n;}
  function walkable(world,zones,blocked=[]){
    const raw=(zones||[]).map(z=>({...z,bridges:[]}));
    return p=>valid(p)&&p.x>=18&&p.y>=18&&p.x<=world.width-18&&p.y<=world.height-18&&!blocked.some(b=>p.x>b.x-18&&p.x<b.x+b.w+18&&p.y>b.y-18&&p.y<b.y+b.h+18)&&!raw.some((z,i)=>water.depth(z,p.x,p.y)>0&&!water.onBridge(zones[i],p.x,p.y,-14));
  }
  function path(from,to,{world,waterZones=[],blockedRects=[]}={}){
    const clear=walkable(world,waterZones,blockedRects),segment=(a,b)=>{const n=Math.ceil(distance(a,b)/12);for(let i=0;i<=n;i++)if(!clear({x:a.x+(b.x-a.x)*i/Math.max(1,n),y:a.y+(b.y-a.y)*i/Math.max(1,n)}))return false;return true;};
    if(!valid(from)||!valid(to)||!clear(from)||!clear(to))return null;if(segment(from,to))return [{...from},{...to}];
    const step=80,cols=Math.ceil((world.width-48)/step)+1,rows=Math.ceil((world.height-48)/step)+1,point=id=>({x:Math.min(world.width-24,24+(id%cols)*step),y:Math.min(world.height-24,24+Math.floor(id/cols)*step)});
    const heap=[],cost=new Map(),parent=new Map();
    function push(item){heap.push(item);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=item.f)break;heap[i]=heap[p];i=p;}heap[i]=item;}
    function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(last.f<=heap[c].f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return top;}
    const startX=Math.round((from.x-24)/step),startY=Math.round((from.y-24)/step);
    for(let y=startY-2;y<=startY+2;y++)for(let x=startX-2;x<=startX+2;x++){if(x<0||x>=cols||y<0||y>=rows)continue;const id=y*cols+x,p=point(id);if(segment(from,p)){const g=distance(from,p);cost.set(id,g);parent.set(id,null);push({id,g,f:g+distance(p,to)});}}
    let visits=0;while(heap.length&&visits++<6000){const row=pop();if(cost.get(row.id)!==row.g)continue;const p=point(row.id);
      if(distance(p,to)<=160&&segment(p,to)){const out=[{...to}];for(let id=row.id;id!==null;id=parent.get(id))out.push(point(id));out.push({...from});out.reverse();const smooth=[out[0]];for(let i=0;i<out.length-1;){let j=out.length-1;while(j>i+1&&!segment(out[i],out[j]))j--;smooth.push(out[j]);i=j;}return smooth;}
      const x=row.id%cols,y=Math.floor(row.id/cols);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||nx>=cols||ny<0||ny>=rows)continue;const id=ny*cols+nx,q=point(id),g=row.g+distance(p,q);if(g>=(cost.get(id)??Infinity)||!segment(p,q))continue;cost.set(id,g);parent.set(id,row.id);push({id,g,f:g+distance(q,to)});}
    }return null;
  }
  function plan({level,world,from,to,selected='direct',waterZones,blockedRects=[]}={}){
    if(!enabled(level)||!valid(from)||!valid(to))return null;
    const options={world,waterZones:waterZones||maps.forMission(level).waterZones,blockedRects},direct=path(from,to,options);if(!direct)return {choice:choice(selected),path:[],message:'No verified dry route. Reposition or use the marked bridge; swimming may be required.'};
    if(choice(selected)==='direct')return {choice:'direct',path:direct,length:length(direct),message:'Direct route • no guaranteed cover'};
    let best=null;for(const s of shelters(level,world)){const a=path(from,s,options),b=path(s,to,options);if(!a||!b)continue;const points=a.concat(b.slice(1)),n=length(points);if(!best||n<best.length)best={choice:'shelter',path:points,length:n,shelter:s,message:'Shelter detour • cover only while inside'};}
    return best||{choice:'shelter',path:[],message:'No verified shelter detour from here. Direct route remains available.'};
  }
  function cached(options,key){const id=`${key}:${choice(options.selected)}:${Math.floor(options.to.x/80)}:${Math.floor(options.to.y/80)}:${JSON.stringify(options.blockedRects||[])}`,old=cache.get(id);if(!old||distance(old.from,options.from)>240){if(cache.size>=12&&!old)cache.delete(cache.keys().next().value);cache.set(id,{from:{x:options.from.x,y:options.from.y},route:plan(options)});}return cache.get(id).route;}
  function reset(){cache.clear();}
  function draw(ctx,route){if(!route?.path?.length)return;ctx.save();ctx.strokeStyle=route.choice==='shelter'?'rgba(134,239,172,.8)':'rgba(253,211,112,.8)';ctx.lineWidth=4;ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(route.path[0].x,route.path[0].y);for(const p of route.path.slice(1))ctx.lineTo(p.x,p.y);ctx.stroke();ctx.restore();}
  function drawShelters(ctx,level,world,view){const art=globalThis.TigerStrikeBattlefieldRenderer;if(!art)return;for(const s of shelters(level,world)){if(s.x<view.x-140||s.x>view.x+view.w+140||s.y<view.y-140||s.y>view.y+view.h+140)continue;art.drawMapHouse(ctx,s.x-70,s.y-78,140,90,{roof:'#48755b',clearZones:[]});ctx.save();ctx.fillStyle='rgba(134,239,172,.16)';ctx.fillRect(s.x-60,s.y-50,120,60);ctx.strokeStyle='#86efac';ctx.lineWidth=2;ctx.strokeRect(s.x-60,s.y-50,120,60);ctx.fillStyle='#e2ffe8';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(s.label,s.x,s.y-100);ctx.font='11px system-ui';ctx.fillText('Inside: 50% tiger damage • firing breaks cover',s.x,s.y+70);ctx.restore();}}
  function open({level,current='direct',choose,preview=null}={}){
    if(typeof document==='undefined'||!enabled(level))return;
    let dialog=document.getElementById('missionRouteDialog');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='missionRouteDialog';dialog.style.cssText='color:#eef8f0;background:#10251f;border:2px solid #8ab99b;border-radius:16px;max-width:430px;width:85vw;padding:20px';document.body.appendChild(dialog);}
    if(dialog.open)dialog.close();dialog.replaceChildren();
    const title=document.createElement('h2');title.id='missionRouteTitle';title.textContent=`Mission ${level} route`;dialog.setAttribute('aria-labelledby',title.id);dialog.appendChild(title);
    const text=document.createElement('p');text.textContent='Routes guide you to the same live objective; you control movement. Inside shelters, tiger damage is halved. Firing removes your cover for 3 seconds. Civilians still need the original Rescue House. This dialog does not pause play.';dialog.appendChild(text);
    const buttons=[];
    for(const id of ['direct','shelter']){
      const button=document.createElement('button'),unavailable=!!preview?.[id]&&!preview[id].path?.length;
      button.type='button';button.style.cssText='display:block;width:100%;padding:14px;margin:10px 0;min-height:48px';
      button.textContent=`${choice(current)===id?'✓ ':''}${id==='direct'?'Direct route • no shelter stop':'Shelter detour • 50% cover inside'}${preview?.[id]?.length?` • ${Math.round(preview[id].length)}m`:''}${unavailable?` • ${preview[id].message}`:''}`;
      if(!unavailable)button.textContent+=preview?.[id]?.danger==null?' • Unscouted: danger unknown':` • ${preview[id].danger} scouted threat${preview[id].danger===1?'':'s'} near route at opening`;
      button.disabled=unavailable;buttons.push({button,unavailable});
      button.onclick=async()=>{buttons.forEach(b=>b.button.disabled=true);try{await choose(id);reset();dialog.close();}catch(e){text.textContent=String(e.message||e);buttons.forEach(b=>b.button.disabled=b.unavailable);}};
      dialog.appendChild(button);
    }
    const close=document.createElement('button');close.textContent='Close';close.type='button';close.onclick=()=>dialog.close();close.style.cssText='padding:12px;min-height:44px';dialog.appendChild(close);
    globalThis.dispatchEvent?.(new Event('mission-route-open'));dialog.showModal();
  }
  return Object.freeze({VERSION:'14.10',enabled,choice,shelters,inside,cover,damage,path,plan,cached,reset,draw,drawShelters,open});
});
