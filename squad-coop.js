(() => {
  "use strict";
  const API = "/api/squad/session";
  const tgApp = window.Telegram?.WebApp || null;
  const state = {
    open:false,
    code:"",
    snapshot:null,
    roles:[],
    local:null,
    remoteDraw:new Map(),
    polling:false,
    pollTimer:0,
    frame:0,
    lastFrameAt:0,
    lastSyncAt:0,
    syncBusy:false,
    actionBusy:false,
    move:{ up:false, down:false, left:false, right:false },
    keys:new Set(),
    priorPause:false,
    message:"Create a private squad or enter a teammate's six-character code.",
    error:"",
  };

  const $ = (id) => document.getElementById(id);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, Number(v || 0)));
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  const distance = (a,b) => Math.hypot(Number(a?.x||0)-Number(b?.x||0),Number(a?.y||0)-Number(b?.y||0));
  const cleanCode = (value) => String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0,6);
  const hasTelegramAuth = () => !!String(tgApp?.initData || "");
  const viewerId = () => Number(tgApp?.initDataUnsafe?.user?.id || state.snapshot?.viewerId || 0);
  const localSnapshotPlayer = () => (state.snapshot?.players || []).find((p)=>Number(p.userId) === viewerId()) || null;
  const remoteSnapshotPlayer = () => (state.snapshot?.players || []).find((p)=>Number(p.userId) !== viewerId()) || null;

  function setMessage(message, error=false){
    state.message = String(message || "");
    state.error = error ? state.message : "";
    const node = $("squadStatus");
    if(node){
      node.textContent = state.message;
      node.style.borderColor = error ? "#fb7185" : "#304b70";
    }
  }

  async function api(action, extra={}){
    const response = await fetch(API, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ initData:String(tgApp?.initData || ""), action, code:state.code, ...extra }),
    });
    const payload = await response.json().catch(()=>null);
    if(!response.ok || !payload?.ok) throw new Error(payload?.error || "Live squad request failed.");
    if(payload.snapshot) applySnapshot(payload.snapshot, payload.roles);
    return payload;
  }

  function applySnapshot(snapshot, roles){
    if(!snapshot || typeof snapshot !== "object") return;
    const previousStatus = state.snapshot?.status || "";
    state.snapshot = snapshot;
    state.code = cleanCode(snapshot.code);
    if(Array.isArray(roles) && roles.length) state.roles = roles;
    const mine = localSnapshotPlayer();
    if(mine){
      if(!state.local || Number(state.local.userId) !== Number(mine.userId)){
        state.local = { ...mine };
      }else if(!Object.values(state.move).some(Boolean) && !state.keys.size){
        state.local.x = Number(mine.x);
        state.local.y = Number(mine.y);
        state.local.face = Number(mine.face || 0);
      }
      state.local.hp = Number(mine.hp || 0);
      state.local.maxHp = Number(mine.maxHp || 100);
      state.local.downed = !!mine.downed;
      state.local.role = mine.role;
    }
    if(previousStatus === "active" && snapshot.status === "active" && $("squadArena")) updateActiveHud();
    else render();
    maybeApplyReward();
  }

  function updateActiveHud(){
    const snap = state.snapshot;
    if(!snap) return;
    const bossPct = Math.round((Number(snap.boss?.hp || 0) / Math.max(1, Number(snap.boss?.hpMax || 1))) * 100);
    const seconds = Math.max(0, Math.ceil(Number(snap.timeLeftMs || 0) / 1000));
    const set = (id, text)=>{ const node=$(id); if(node) node.textContent=text; };
    set("squadBossHud", `${Math.round(snap.boss?.hp || 0)}/${Math.round(snap.boss?.hpMax || 0)} HP (${bossPct}%)`);
    set("squadCivHud", `${snap.rescuedIds?.length || 0}/4 rescued`);
    set("squadMissionHud", `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`);
    set("squadObjective", objectiveText());
  }

  function roleLabel(key){
    return state.roles.find((role)=>role.key === key)?.label || String(key || "Tracker");
  }

  function rosterHtml(){
    const snapshot = state.snapshot;
    const players = snapshot?.players || [];
    const cards = [0,1].map((slot)=>{
      const player = players.find((p)=>Number(p.slot) === slot);
      if(!player){
        return `<div class="squadMember"><div class="squadMemberName">Waiting for teammate…</div><div class="squadMemberMeta">Send the invitation or share code ${esc(state.code)}</div></div>`;
      }
      const mine = Number(player.userId) === viewerId();
      const status = player.downed ? "DOWNED — needs revive" : (player.online ? `HP ${Math.round(player.hp)}/${Math.round(player.maxHp)}` : "Reconnecting…");
      return `<div class="squadMember ${mine ? "me" : ""} ${player.online ? "" : "offline"}">
        <div class="squadMemberName">${mine ? "⭐ " : ""}${esc(player.name)}</div>
        <div class="squadMemberMeta">${esc(roleLabel(player.role))} • ${esc(status)}</div>
        <div class="squadMemberMeta">Alpha damage ${Math.round(player.bossDamage || 0)} • Rescues ${(player.rescuedIds || []).length} • Revives ${Math.round(player.revives || 0)}</div>
      </div>`;
    });
    return cards.join("");
  }

  function roleButtonsHtml(){
    const mine = localSnapshotPlayer();
    const waiting = state.snapshot?.status === "waiting";
    const roles = state.roles.length ? state.roles : [
      {key:"tracker",label:"Tracker"},{key:"medic",label:"Medic"},{key:"assault",label:"Assault"},{key:"trapper",label:"Trapper"},
    ];
    return roles.map((role)=>`<button class="squadRole ${mine?.role === role.key ? "active" : ""}" ${waiting ? "" : "disabled"} onclick="liveSquadChooseRole('${esc(role.key)}')">${esc(role.label)}</button>`).join("");
  }

  function lobbyHtml(){
    const snapshot = state.snapshot;
    if(!snapshot){
      return `<div class="squadPanel">
        <div class="squadHero">
          <div><div class="squadKicker">V5.0 Live Co-op</div><div class="squadMissionName">Operation Night Fang</div><div class="squadDesc">Two real Telegram players enter one rescue arena. Save four civilians, defeat the Night Fang Alpha, revive each other, and stand together at extraction.</div></div>
          <div class="squadCodeBox"><div class="squadSmall">PRIVATE TWO-PLAYER MISSION</div><div style="font-size:44px;margin:5px">🐅🐅</div><div class="squadSmall">One leader • One teammate</div></div>
        </div>
        <div class="squadRow"><button class="squadBtn good" onclick="liveSquadCreate()">Create Squad</button></div>
        <div class="squadJoinRow"><input class="squadInput" id="squadJoinCode" maxlength="6" placeholder="SQUAD CODE" autocomplete="off" inputmode="text"><button class="squadBtn primary" onclick="liveSquadJoin()">Join</button></div>
        <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
        <div class="squadSmall">Telegram requires both players to open the game through the Tiger Strike bot. Rooms expire automatically.</div>
      </div>`;
    }
    const full = snapshot.memberCount >= 2;
    const waiting = snapshot.status === "waiting";
    return `<div class="squadPanel">
      <div class="squadHero">
        <div><div class="squadKicker">Private Live Squad</div><div class="squadMissionName">Operation Night Fang</div><div class="squadDesc">Choose a role. The squad leader starts when both players are connected.</div></div>
        <div class="squadCodeBox"><div class="squadSmall">SQUAD CODE</div><div class="squadCode">${esc(snapshot.code)}</div><div class="squadSmall">${snapshot.memberCount}/2 players connected</div></div>
      </div>
      <div class="squadRoster">${rosterHtml()}</div>
      <div class="squadSmall">Choose your field role</div><div class="squadRoleGrid">${roleButtonsHtml()}</div>
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadRow">
        ${waiting ? `<button class="squadBtn primary" onclick="liveSquadInvite()">Invite Teammate</button>` : ""}
        ${waiting && snapshot.isHost ? `<button class="squadBtn good" ${full ? "" : "disabled"} onclick="liveSquadStart()">Start Mission</button>` : ""}
        ${waiting && !snapshot.isHost ? `<button class="squadBtn good" disabled>Waiting for Leader</button>` : ""}
        <button class="squadBtn" onclick="liveSquadCopyCode()">Copy Code</button>
        <button class="squadBtn danger" onclick="liveSquadLeave()">Leave Squad</button>
      </div>
    </div>`;
  }

  function arenaHtml(){
    const snap = state.snapshot;
    const mine = localSnapshotPlayer();
    const bossPct = snap?.boss ? Math.round((snap.boss.hp / snap.boss.hpMax) * 100) : 100;
    const rescued = snap?.rescuedIds?.length || 0;
    const seconds = Math.max(0, Math.ceil(Number(snap?.timeLeftMs || 0) / 1000));
    const statusText = snap?.status === "complete" ? "MISSION COMPLETE" : (snap?.status === "failed" ? "MISSION FAILED" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`);
    return `<div class="squadPanel squadArenaPanel">
      <div class="squadHud">
        <div class="squadHudCard"><div class="squadHudLabel">Night Fang</div><div class="squadHudValue" id="squadBossHud">${Math.round(snap.boss.hp)}/${snap.boss.hpMax} HP (${bossPct}%)</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Civilians</div><div class="squadHudValue" id="squadCivHud">${rescued}/4 rescued</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Mission</div><div class="squadHudValue" id="squadMissionHud">${statusText}</div></div>
      </div>
      <div class="squadConnection ${remoteSnapshotPlayer()?.online === false ? "bad" : ""}" id="squadConnection">${mine?.downed ? "You are down—your teammate must revive you." : connectionText()}</div>
      <div class="squadObjective" id="squadObjective">${objectiveText()}</div>
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <canvas id="squadArena" width="1000" height="600" aria-label="Operation Night Fang live co-op arena"></canvas>
      <div class="squadBanner ${["complete","failed"].includes(snap.status) ? "show" : ""}" id="squadResultBanner">
        <div class="squadBannerTitle">${snap.status === "complete" ? "🏆 Squad Extracted!" : "⏱️ Operation Failed"}</div>
        <div class="squadBannerText">${snap.status === "complete" ? "Both players rescued the civilians, defeated Night Fang, and reached extraction together." : "Create another squad and try the rescue again."}</div>
        ${snap.status === "complete" ? `<button class="squadBtn good" onclick="liveSquadClaim()">Claim Co-op Reward</button>` : ""}
        <button class="squadBtn" onclick="liveSquadLeave()">Return to HQ</button>
      </div>
      <div class="squadControls">
        <div class="squadDpad">
          <button class="squadPadBtn up" data-move="up">▲</button><button class="squadPadBtn left" data-move="left">◀</button><button class="squadPadBtn right" data-move="right">▶</button><button class="squadPadBtn down" data-move="down">▼</button>
        </div>
        <div class="squadActions">
          <button class="squadActionBtn attack" onclick="liveSquadAction('attack')">🎯 Attack</button>
          <button class="squadActionBtn rescue" onclick="liveSquadAction('rescue')">🛟 Rescue</button>
          <button class="squadActionBtn revive" onclick="liveSquadAction('revive')">💚 Revive</button>
        </div>
      </div>
      <div class="squadSmall" style="margin-top:8px">Move with the arrows or WASD. Actions work only when you are close enough. If disconnected, reopen the same invitation to reconnect.</div>
    </div>`;
  }

  function connectionText(){
    const remote = remoteSnapshotPlayer();
    if(!remote) return "Waiting for your teammate…";
    return remote.online ? `${remote.name} is connected live.` : `${remote.name} is reconnecting…`;
  }
  function objectiveText(){
    const snap = state.snapshot;
    if(!snap) return "";
    if((snap.rescuedIds || []).length < 4) return `Objective: Reach the blue civilian markers and tap Rescue (${snap.rescuedIds.length}/4).`;
    if(Number(snap.boss?.hp || 0) > 0) return `Objective: Fight Night Fang together (${Math.round(snap.boss.hp)} HP remaining).`;
    const ready = snap.extractionReadyIds || [];
    return `Objective: Both players stand inside the green extraction circle (${ready.length}/2 ready).`;
  }

  function render(){
    const body = $("squadBody");
    if(!body) return;
    if(state.snapshot && ["active","complete","failed"].includes(state.snapshot.status)) body.innerHTML = arenaHtml();
    else body.innerHTML = lobbyHtml();
    bindMoveButtons();
    if(state.snapshot?.status === "active") ensureFrame();
    else drawArena();
  }

  function bindMoveButtons(){
    document.querySelectorAll("#liveSquadOverlay [data-move]").forEach((button)=>{
      const direction = button.dataset.move;
      const on = (event)=>{ event.preventDefault(); state.move[direction] = true; };
      const off = (event)=>{ event.preventDefault(); state.move[direction] = false; };
      button.addEventListener("pointerdown", on);
      button.addEventListener("pointerup", off);
      button.addEventListener("pointercancel", off);
      button.addEventListener("pointerleave", off);
    });
  }

  function open(){
    const overlay = $("liveSquadOverlay");
    if(!overlay) return;
    state.open = true;
    state.priorPause = !!window.S?.paused;
    if(window.S && !state.priorPause){ window.S.paused = true; window.S.pauseReason = "live-squad"; }
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
    render();
    if(!hasTelegramAuth()) setMessage("Open Tiger Strike inside Telegram to create or join a live squad.", true);
    if(state.snapshot) startPolling();
  }

  function close(){
    state.open = false;
    stopPolling();
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    Object.keys(state.move).forEach((key)=>{ state.move[key] = false; });
    const overlay = $("liveSquadOverlay");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden","true");
    if(window.S && !state.priorPause && window.S.pauseReason === "live-squad"){
      window.S.paused = false;
      window.S.pauseReason = null;
    }
  }

  async function create(){
    if(!hasTelegramAuth()) return setMessage("Please open the game inside Telegram first.", true);
    try{
      setMessage("Creating your private squad…");
      const payload = await api("create");
      state.code = payload.snapshot.code;
      setMessage("Squad created. Invite one teammate, choose roles, then start.");
      startPolling();
    }catch(error){ setMessage(error.message, true); }
  }

  async function join(codeValue=""){
    if(!hasTelegramAuth()) return setMessage("Please open the game inside Telegram first.", true);
    const code = cleanCode(codeValue || $("squadJoinCode")?.value);
    if(code.length !== 6) return setMessage("Enter the complete six-character squad code.", true);
    try{
      state.code = code;
      setMessage(`Joining squad ${code}…`);
      await api("join", { code });
      setMessage("Connected. Choose your role and wait for the squad leader.");
      startPolling();
    }catch(error){ state.code = ""; setMessage(error.message, true); render(); }
  }

  async function chooseRole(role){
    if(!state.snapshot || state.snapshot.status !== "waiting") return;
    try{ await api("role", { role }); setMessage(`${roleLabel(role)} selected.`); }
    catch(error){ setMessage(error.message, true); }
  }

  async function invite(){
    if(!state.code) return;
    try{
      setMessage("Preparing your Telegram squad invitation…");
      const payload = await api("invite");
      const invitation = payload.invitation || {};
      if(invitation.preparedMessageId && typeof tgApp?.shareMessage === "function"){
        const sent = await new Promise((resolve)=>{
          let done = false;
          const finish = (value)=>{ if(done) return; done = true; resolve(value === true); };
          try{ tgApp.shareMessage(invitation.preparedMessageId, finish); setTimeout(()=>finish(false),30000); }
          catch(error){ finish(false); }
        });
        setMessage(sent ? "Invitation sent. Waiting for your teammate…" : "Invitation was not sent.", !sent);
      }else{
        const text = `Join my live Tiger Strike squad for Operation Night Fang. Code: ${state.code}`;
        const url = `https://t.me/share/url?url=${encodeURIComponent(invitation.playUrl || "")}&text=${encodeURIComponent(text)}`;
        if(typeof tgApp?.openTelegramLink === "function") tgApp.openTelegramLink(url); else window.open(url,"_blank","noopener");
        setMessage("Telegram share opened. Choose a teammate to invite.");
      }
    }catch(error){ setMessage(error.message, true); }
  }

  async function start(){
    try{ setMessage("Deploying both players…"); await api("start"); setMessage("Operation Night Fang is live."); ensureFrame(); }
    catch(error){ setMessage(error.message, true); }
  }

  async function action(kind){
    if(state.actionBusy || state.snapshot?.status !== "active") return;
    state.actionBusy = true;
    try{
      const extra = {};
      if(kind === "rescue"){
        const remaining = (state.snapshot.civilians || []).filter((c)=>!(state.snapshot.rescuedIds || []).includes(c.id));
        const target = remaining.sort((a,b)=>distance(state.local,a)-distance(state.local,b))[0];
        if(!target || distance(state.local,target) > 82) throw new Error("Move next to a blue civilian marker first.");
        extra.civilianId = target.id;
      }else if(kind === "revive"){
        const teammate = remoteSnapshotPlayer();
        if(!teammate?.downed) throw new Error("Your teammate does not need a revive.");
        if(distance(state.local,teammate) > 108) throw new Error("Move next to your downed teammate first.");
        extra.targetUserId = teammate.userId;
      }else if(kind === "attack"){
        if(distance(state.local,state.snapshot.boss) > 178) throw new Error("Move closer to Night Fang before attacking.");
      }
      await api(kind, extra);
      setMessage(kind === "rescue" ? "Civilian secured!" : (kind === "revive" ? "Teammate revived!" : "Hit confirmed."));
    }catch(error){ setMessage(error.message, true); }
    finally{ state.actionBusy = false; }
  }

  async function claim(){
    try{
      const payload = await api("claim");
      applyReward(payload.reward);
      setMessage("Co-op reward claimed and saved.");
    }catch(error){ setMessage(error.message, true); }
  }

  function applyReward(rewardPayload){
    const data = rewardPayload;
    if(!data?.receipt || !data?.reward || !window.S) return false;
    if(!window.S.liveSquadRewardReceipts || typeof window.S.liveSquadRewardReceipts !== "object") window.S.liveSquadRewardReceipts = {};
    if(window.S.liveSquadRewardReceipts[data.receipt]) return false;
    window.S.liveSquadRewardReceipts[data.receipt] = Date.now();
    window.S.funds = Math.max(0, Number(window.S.funds || 0)) + Math.max(0, Number(data.reward.cash || 0));
    window.S.perkPoints = Math.max(0, Number(window.S.perkPoints || 0)) + Math.max(0, Number(data.reward.perkPoints || 0));
    if(!window.S.liveSquadBadges || typeof window.S.liveSquadBadges !== "object") window.S.liveSquadBadges = {};
    window.S.liveSquadBadges[String(data.reward.badge || "Night Fang First Response")] = Date.now();
    try{ if(typeof window.grantSeasonPassPoints === "function") window.grantSeasonPassPoints(Number(data.reward.seasonPoints || 0), "Operation Night Fang"); }catch(error){}
    try{ window.saveGameNow?.(); }catch(error){}
    return true;
  }

  async function maybeApplyReward(){
    if(state.snapshot?.status !== "complete" || state.actionBusy) return;
    const mine = localSnapshotPlayer();
    if(!mine?.rewardClaimed) return;
    // A previously claimed server receipt is intentionally restored through the
    // Claim button if it was not yet applied to this local save.
  }

  async function leave(){
    if(state.code){ try{ await api("leave"); }catch(error){} }
    state.code = ""; state.snapshot = null; state.local = null; state.remoteDraw.clear();
    setMessage("Create a private squad or enter a teammate's six-character code.");
    close();
  }

  async function copyCode(){
    const text = state.code || "";
    try{ await navigator.clipboard.writeText(text); setMessage(`Squad code ${text} copied.`); }
    catch(error){ setMessage(`Squad code: ${text}`); }
  }

  function startPolling(){
    if(state.polling) return;
    state.polling = true;
    const run = async ()=>{
      if(!state.polling || !state.open || !state.code) return;
      await sync().catch(()=>{});
      state.pollTimer = window.setTimeout(run, state.snapshot?.status === "active" ? 800 : 1100);
    };
    run();
  }
  function stopPolling(){ state.polling = false; clearTimeout(state.pollTimer); state.pollTimer = 0; }

  async function sync(){
    if(state.syncBusy || !state.code) return;
    state.syncBusy = true;
    try{
      const player = state.local ? { x:state.local.x, y:state.local.y, face:state.local.face } : {};
      await api("sync", { player });
      state.lastSyncAt = Date.now();
      const node = $("squadConnection");
      if(node){ node.textContent = localSnapshotPlayer()?.downed ? "You are down—your teammate must revive you." : connectionText(); node.classList.toggle("bad", remoteSnapshotPlayer()?.online === false); }
    }catch(error){
      const node = $("squadConnection");
      if(node){ node.textContent = "Connection interrupted—reconnecting…"; node.classList.add("bad"); }
    }finally{ state.syncBusy = false; }
  }

  function updateMovement(dt){
    if(!state.local || state.local.downed || state.snapshot?.status !== "active") return;
    let dx = 0, dy = 0;
    if(state.move.left || state.keys.has("arrowleft") || state.keys.has("a")) dx -= 1;
    if(state.move.right || state.keys.has("arrowright") || state.keys.has("d")) dx += 1;
    if(state.move.up || state.keys.has("arrowup") || state.keys.has("w")) dy -= 1;
    if(state.move.down || state.keys.has("arrowdown") || state.keys.has("s")) dy += 1;
    if(!dx && !dy) return;
    const len = Math.hypot(dx,dy) || 1;
    const roleSpeed = state.local.role === "tracker" ? 1.08 : (state.local.role === "assault" ? .96 : 1);
    const speed = 185 * roleSpeed;
    state.local.x = clamp(state.local.x + (dx/len)*speed*dt, 24, 976);
    state.local.y = clamp(state.local.y + (dy/len)*speed*dt, 24, 576);
    state.local.face = Math.atan2(dy,dx);
  }

  function ensureFrame(){
    if(state.frame) return;
    state.lastFrameAt = performance.now();
    const tick = (at)=>{
      state.frame = 0;
      if(!state.open || !state.snapshot || !["active","complete","failed"].includes(state.snapshot.status)) return;
      const dt = clamp((at - state.lastFrameAt)/1000,0,.05);
      state.lastFrameAt = at;
      updateMovement(dt);
      drawArena();
      state.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);
  }

  function drawArena(){
    const canvas = $("squadArena");
    const snap = state.snapshot;
    if(!canvas || !snap) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const sky = ctx.createLinearGradient(0,0,0,h); sky.addColorStop(0,"#07151e"); sky.addColorStop(1,"#0d2419"); ctx.fillStyle=sky; ctx.fillRect(0,0,w,h);
    ctx.fillStyle="rgba(51,65,85,.58)"; ctx.fillRect(0,260,w,82); ctx.fillRect(430,0,94,h);
    ctx.strokeStyle="rgba(226,232,240,.22)"; ctx.lineWidth=4; ctx.setLineDash([18,16]); ctx.beginPath(); ctx.moveTo(0,301);ctx.lineTo(w,301);ctx.moveTo(477,0);ctx.lineTo(477,h);ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<26;i++){
      const x=(i*137)%970+15,y=(i*83)%560+20;if((x>405&&x<550)||(y>235&&y<360))continue;
      ctx.fillStyle="rgba(22,101,52,.45)";ctx.beginPath();ctx.arc(x,y,13+(i%4)*3,0,Math.PI*2);ctx.fill();
    }
    const ex=snap.extraction;ctx.fillStyle="rgba(34,197,94,.15)";ctx.strokeStyle="#4ade80";ctx.lineWidth=5;ctx.beginPath();ctx.arc(ex.x,ex.y,ex.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#bbf7d0";ctx.font="900 16px system-ui";ctx.textAlign="center";ctx.fillText("EXTRACT",ex.x,ex.y+5);
    for(const civ of (snap.civilians||[])){
      const rescued=(snap.rescuedIds||[]).includes(civ.id);ctx.globalAlpha=rescued?.28:1;ctx.fillStyle=rescued?"#64748b":"#38bdf8";ctx.beginPath();ctx.arc(civ.x,civ.y,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#e0f2fe";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#e0f2fe";ctx.font="800 12px system-ui";ctx.fillText(rescued?"SAFE":"RESCUE",civ.x,civ.y-22);ctx.globalAlpha=1;
    }
    const boss=snap.boss;if(boss&&!boss.defeated){ctx.fillStyle="rgba(251,113,133,.16)";ctx.beginPath();ctx.arc(boss.x,boss.y,72,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f97316";ctx.beginPath();ctx.ellipse(boss.x,boss.y,38,24,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#111827";ctx.beginPath();ctx.arc(boss.x+26,boss.y-5,15,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fed7aa";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(boss.x-18,boss.y-16);ctx.lineTo(boss.x+28,boss.y+14);ctx.moveTo(boss.x-24,boss.y);ctx.lineTo(boss.x+20,boss.y+23);ctx.stroke();ctx.fillStyle="#fecaca";ctx.font="950 14px system-ui";ctx.fillText("NIGHT FANG",boss.x,boss.y-42);}
    for(const p of (snap.players||[])){
      const mine=Number(p.userId)===viewerId();const source=mine&&state.local?state.local:p;let draw=state.remoteDraw.get(p.userId)||{x:source.x,y:source.y};draw.x+=(Number(source.x)-draw.x)*.22;draw.y+=(Number(source.y)-draw.y)*.22;state.remoteDraw.set(p.userId,draw);
      ctx.globalAlpha=p.online===false?.5:1;ctx.fillStyle=p.downed?"#ef4444":(mine?"#22d3ee":"#a78bfa");ctx.beginPath();ctx.arc(draw.x,draw.y,18,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#f8fafc";ctx.lineWidth=3;ctx.stroke();const face=Number(source.face||0);ctx.beginPath();ctx.moveTo(draw.x,draw.y);ctx.lineTo(draw.x+Math.cos(face)*28,draw.y+Math.sin(face)*28);ctx.stroke();ctx.fillStyle="#f8fafc";ctx.font="900 13px system-ui";ctx.fillText(`${mine?"YOU":p.name}${p.downed?" • DOWN":""}`,draw.x,draw.y-29);ctx.globalAlpha=1;
    }
  }

  function startParam(){
    const direct = String(tgApp?.initDataUnsafe?.start_param || "").trim();
    if(direct) return direct;
    try{ const params=new URLSearchParams(location.search);return String(params.get("tgWebAppStartParam")||params.get("startapp")||"").trim(); }catch(error){ return ""; }
  }
  function autoJoinFromTelegram(){
    const match=startParam().match(/^squad_([A-Z0-9]{6})$/i);if(!match||!hasTelegramAuth())return;
    window.setTimeout(()=>{ open(); join(match[1]); },1400);
  }


  window.addEventListener("keydown",(event)=>{ if(!state.open)return;const key=String(event.key||"").toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(key)){event.preventDefault();state.keys.add(key);} });
  window.addEventListener("keyup",(event)=>{ state.keys.delete(String(event.key||"").toLowerCase()); });
  window.openLiveSquadOps=open;
  window.closeLiveSquadOps=close;
  window.liveSquadCreate=create;
  window.liveSquadJoin=()=>join();
  window.liveSquadChooseRole=chooseRole;
  window.liveSquadInvite=invite;
  window.liveSquadStart=start;
  window.liveSquadAction=action;
  window.liveSquadClaim=claim;
  window.liveSquadLeave=leave;
  window.liveSquadCopyCode=copyCode;
  window.addEventListener("load",autoJoinFromTelegram,{once:true});
})();
