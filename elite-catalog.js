(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TigerEliteCatalog=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
const items={
 midnight:{name:'Midnight Ranger',price:250,kind:'soldier',desc:'Permanent navy field uniform, night-vision helmet, matching portrait and three original synthetic radio lines. Same combat stats as your current soldier.'},
 storm_medic:{name:'Storm Medic',price:350,kind:'soldier',desc:'Permanent blue-and-white medic uniform, detailed medical backpack, matching portrait, synthetic radio lines and custom Med Drone artwork when equipped. Select Med Drone before deploying. Existing healing amounts, cooldowns and charges apply; no drone uses are sold.'},
 guardian:{name:'Guardian Rubber Carbine',price:300,kind:'weapon',desc:'Permanent Solo/Arcade/Survival AR Carbine unlock and exclusive teal Guardian artwork on rubber-enabled weapons in Solo and Co-op. Co-op keeps its own equipped rifle and stats. Uses your mode’s ammunition. Survival uses Real rounds and the normal rifle appearance.'},
 extraction:{name:'Custom Extraction Pack',price:350,kind:'extraction',desc:'Permanent teal-and-gold rescue livery for helicopters, boats and ground evacuation vehicles. Changes appearance, not speed, capacity or extraction rules.'},
 recruit_uniform:{name:'Rescue Recruit uniform',price:35,kind:'soldier',desc:'Orange-and-navy rescue uniform. Same combat stats.'},
 recruit_badge:{name:'Rescue Recruit badge',price:25,kind:'badge',desc:'Visible rescue crest on your soldier’s equipment.'},
 recruit_finish:{name:'Rescue Recruit weapon finish',price:15,kind:'weapon',desc:'Orange-and-white finish for your existing weapon. No stat changes.'}
};
const offers=[{sku:'elite_midnight',name:'Midnight Ranger',stars:250,items:['midnight']},{sku:'elite_guardian',name:'Guardian Rubber Carbine',stars:300,items:['guardian']},{sku:'elite_extraction',name:'Custom Extraction Pack',stars:350,items:['extraction']},{sku:'elite_recruit',name:'Rescue Recruit Pack',stars:75,items:['recruit_uniform','recruit_badge','recruit_finish']},{sku:'elite_storm_medic',name:'Storm Medic',stars:350,items:['storm_medic']}];
function quote(sku,owned=[]){const offer=offers.find(x=>x.sku===sku);if(!offer)throw Error('Unknown Elite offer.');const missing=offer.items.filter(id=>!owned.includes(id));return {...offer,items:[...offer.items],missing,stars:missing.reduce((n,id)=>n+items[id].price,0),owned:missing.length===0};}
const palettes={storm_medic:{body:'#537e9b',light:'#d8e7df',dark:'#223d56',vest:'#254b62',helmet:'#426880',trim:'#8de6d3'},midnight:{body:'#20344f',light:'#476880',dark:'#102032',vest:'#142b3d',helmet:'#17334b',trim:'#61e5d3'},recruit_uniform:{body:'#e47d35',light:'#ffc476',dark:'#27374c',vest:'#293f52',helmet:'#34516b',trim:'#f4f1db'}};
function appearance(owned=[],selection={}){const ok=id=>owned.includes(id);return {soldier:ok(selection.soldier)&&palettes[selection.soldier]?selection.soldier:'',weapon:ok(selection.weapon)&&['guardian','recruit_finish'].includes(selection.weapon)?selection.weapon:'',extraction:ok('extraction')&&selection.extraction==='extraction'?'extraction':'',badge:ok('recruit_badge')&&selection.badge==='recruit_badge'?'recruit_badge':''};}
const voices={
 midnight:{ready:{file:'midnight-ready.wav',text:'Midnight Ranger. Eyes on the rescue route.'},capture:{file:'midnight-capture.wav',text:'Live capture secured. Keep the route clear.'},extract:{file:'midnight-extract.wav',text:'Extraction confirmed. Everyone comes home.'}},
 storm_medic:{ready:{file:'storm-ready.wav',text:'Storm Medic ready. Stay close. We bring everyone home.'},heal:{file:'storm-heal.wav',text:'Medical drone deployed. Recovery in progress.'},extract:{file:'storm-extract.wav',text:'Rescue complete. All survivors accounted for.'}}
};
return {items,offers,quote,palettes,appearance,voices};
});
