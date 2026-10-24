(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./water-terrain'):root.TigerWaterTerrain);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TigerChapterMaps=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(water){
  'use strict';
  const names=['Border Jungle','Blood Path Villages','Deep Jungle Corridor','Abandoned Villages','River Territory','Mountain Edge','Tiger Territory','Jungle Warfront','Hidden Jungle Rim','Ancient Temple Zone'];
  const families=['forest','suburbs','forest','downtown','suburbs','industrial','forest','downtown','suburbs','industrial'];
  const palettes=[['#286b40','#17462c'],['#397a4c','#235b39'],['#215a39','#123c2a'],['#436254','#293e37'],['#36784c','#205a3d'],['#586450','#34453b'],['#28633a','#16452c'],['#4b6250','#2d4536'],['#346b49','#1c4934'],['#55654b','#344635']];
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  const chapters=freeze(names.map((name,i)=>{
    const width=4800,height=2800,family=families[i];
    // River Territory keeps its capture pool and central channel throughout
    // all ten missions, rather than moving the water for each objective.
    const river=water.river(width,height,[]);
    if(i===4){river.y=height*.52;river.ry=140;river.label='River Territory Channel';}
    const vertical=family==='suburbs'?[.18,.70]:family==='downtown'?[.12,.32,.52,.72,.90]:family==='industrial'?[.52]:[.5];
    const suburbX=t=>t<=.3?.18+(.02*t/.3):t<=.62?.20-(.02*(t-.3)/.32):.18+(.03*(t-.62)/.38);
    river.bridges=vertical.map((fraction,index)=>{
      let x=fraction*width;
      // Match the curved village road at the river, not an approximate x.
      if(family==='suburbs')for(let n=0;n<8;n++)x=(suburbX(water.banks(river,x).center/height)+(index===1?.52:0))*width;
      const b=water.banks(river,x);return {x:x-58,y:b.top-22,w:116,h:b.bottom-b.top+44};
    });
    const zones=[river];
    if(i===4)zones.push({id:'chapter_5_capture_pool',kind:'pond',label:'Currentstripe Pool',x:width*.51,y:height*.34,rx:240,ry:120});
    return {id:`story_chapter_${i+1}_v1`,chapter:i+1,name,family,seed:137*(i+1),palette:palettes[i],world:{width,height},waterZones:zones};
  }));
  function forMission(level){return chapters[Math.max(0,Math.min(9,Math.floor((Math.max(1,Number(level)||1)-1)/10)))];}
  return Object.freeze({VERSION:1,chapters,forMission});
});
