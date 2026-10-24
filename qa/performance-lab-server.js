// Optional localhost-only lab. Real client UI and memory-only game services;
// synthetic extra actors provide repeatable render load. Not physical phones.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const server=require('../api/_lib/squad-session'),store=require('../api/_lib/metrics-store'),{crowdedSnapshot}=require('./coop-harness');
const root=path.resolve(__dirname,'..'),users=[{id:983101,first_name:'Lab Host'},{id:983102,first_name:'Lab Partner'}];
if(store.storageMode()!=='memory')throw Error('Lab requires memory storage; refusing configured KV.');
let room,weak=false,requests=0;const counts={};
const scripts=['water-terrain','chapter-maps','ammo-modes','government-policy','player-experience','field-radio','civilian-rescue','rescue-tools','escort-teamwork','mastery-rewards','combat-feel','combat-reactions','smooth-play','squad-motion','shared-battlefield-renderer'];
async function start(){
  room=await server.createSession(users[0],{launchType:'shared-story',storyMissionLevel:1});room=await server.joinSession(room.code,users[1]);room=await server.applyAction(room,users[0],'start');
  for(const [i,user] of users.entries()){
    const profile=await server.readCoopProfile(user);profile.funds=100000;await server.writeCoopProfile(profile,user);
    const key=`live_squad_player_${room.code}_${user.id}`,p=await store.getState(key);await store.setState(key,{...p,x:2200+i*60,y:1450});
  }
  function enrich(snapshot){const crowd=crowdedSnapshot(snapshot.viewerId);return {...snapshot,tigers:[...snapshot.tigers,...crowd.tigers],civilians:[...snapshot.civilians,...crowd.civilians],waterZones:crowd.waterZones};}
  const app=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1:8774');
    try{
      if(url.pathname==='/network'){weak=url.searchParams.get('mode')==='weak';res.setHeader('Content-Type','text/plain');res.end(weak?'Weak link simulation ON: 120–1400 ms response delays; every fifth sync fails.':'Normal local connection');return;}
      if(url.pathname==='/api/squad/session'){
        let body='';for await(const part of req)body+=part;if(body.length>100000)throw Error('oversized request');const request=JSON.parse(body);
        const user=users.find(u=>request.initData===`LOCAL_TEST_ONLY:${u.id}`);if(!user)throw Error('local lab identity required');
        const key=`${user.id}:${request.action}`;counts[key]=Number(counts[key]||0)+1;
        const index=++requests,delay=weak?[120,650,1400,300][index%4]:0;
        if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
        res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
        if(weak&&request.action==='sync'&&counts[key]%5===0){res.statusCode=503;res.end(JSON.stringify({ok:false,error:'Simulated packet loss'}));return;}
        room=await server.readSession(room.code);
        if(request.action==='sync')await server.updateOwnPresence(room,user,request.player||{});
        else if(request.action.startsWith('gear-'))await server.applyCoopEquipmentAction(room,user,request.action,request);
        else if(!['profile','status'].includes(request.action))room=await server.applyAction(room,user,request.action,request);
        const snapshot=enrich(await server.buildSnapshot(await server.readSession(room.code),user.id));
        res.end(JSON.stringify({ok:true,snapshot,profile:snapshot.viewerProfile,gearCatalog:server.COOP_GEAR_CATALOG,roles:[]}));return;
      }
      res.setHeader('Cache-Control','no-store');
      if(url.pathname==='/client'){
        const user=users[url.searchParams.get('slot')==='2'?1:0];res.setHeader('Content-Type','text/html');
        res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/squad-coop.css"><style>body{margin:0;background:#081420;color:#edf5f3;font-family:system-ui}#liveSquadOverlay{position:fixed;inset:0;overflow:auto}.squadModal{max-height:none!important}.overlay.open{display:flex}#squadStatus{font-size:12px}.squadArena{max-width:100%}</style><div id="liveSquadOverlay" class="overlay"><div class="squadShell"><div class="squadHeader"><b id="squadTitle">Local test client</b><div id="squadStatus"></div></div><div id="squadBody"></div></div></div><script>window.Telegram={WebApp:{initData:'LOCAL_TEST_ONLY:${user.id}',initDataUnsafe:{user:{id:${user.id}}}}};window.S={paused:true};localStorage.setItem("ts_live_squad_active_v1:${user.id}",JSON.stringify({code:"${room.code}",launchType:"shared-story",storyMissionLevel:1,savedAt:Date.now()}));</script>${scripts.map(s=>`<script src="/${s}.js"></script>`).join('')}<script src="/squad-coop.js"></script>`);return;
      }
      if(url.pathname==='/'){
        res.setHeader('Content-Type','text/html');res.end(`<!doctype html><meta charset="utf-8"><title>Tiger Strike • two-client weak-link lab</title><style>body{margin:18px;background:#081420;color:#edf5f3;font:15px system-ui}p{max-width:940px}iframe.client{width:440px;height:880px;border:2px solid #7399a6;border-radius:14px}button{padding:12px;margin:5px;background:#254856;color:white;border:1px solid #78b1b4;border-radius:9px}#status{font-size:14px;color:#a7f3d0}</style><h1>V13.3 • Two-client stress lab</h1><p>Actual Co-op client interfaces and memory-only Shop/Inventory services. Extra actors and river are synthetic render load. This is browser simulation—not physical Telegram phones, and it cannot touch production accounts.</p><button onclick="setNetwork('weak')">Simulate weak connections</button><button onclick="setNetwork('normal')">Restore normal connections</button><p id="status">Normal local connection</p><iframe class="client" title="Lab Host" src="/client?slot=1"></iframe> <iframe class="client" title="Lab Partner" src="/client?slot=2"></iframe><script>async function setNetwork(mode){document.getElementById('status').textContent=await(await fetch('/network?mode='+mode)).text();}</script>`);return;
      }
      const file=path.resolve(root,`.${url.pathname}`);if(!file.startsWith(root+path.sep)||!['.js','.css'].includes(path.extname(file))){res.statusCode=404;res.end();return;}
      res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'application/javascript');res.end(fs.readFileSync(file));
    }catch(error){res.statusCode=400;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:false,error:error.message}));}
  });
  app.listen(8774,'127.0.0.1',()=>console.log('Local two-client lab: http://127.0.0.1:8774/ (memory only)'));
}
start().catch(error=>{console.error(error);process.exitCode=1;});
