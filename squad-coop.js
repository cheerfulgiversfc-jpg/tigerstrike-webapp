(() => {
  "use strict";
  const API = "/api/squad/session";
  const tgApp = window.Telegram?.WebApp || null;
  const state = {
    open:false,
    code:"",
    joinDraft:"",
    inviteUrl:"",
    inviteText:"",
    roomEpoch:0,
    snapshot:null,
    roles:[],
    local:null,
    remoteDraw:new Map(),
    polling:false,
    pollTimer:0,
    frame:0,
    lastFrameAt:0,
    lastSyncAt:0,
    lastActionUiAt:0,
    syncBusy:false,
    actionBusy:false,
    pending:new Set(),
    overlayBound:false,
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
  const displayCode = (value) => {
    const code = cleanCode(value);
    return code.length > 3 ? `${code.slice(0,3)} ${code.slice(3)}` : code;
  };
  const extractCode = (value) => {
    const text = String(value || "").trim().toUpperCase();
    const tagged = text.match(/(?:SQUAD[_\s:/=-]*|STARTAPP=SQUAD_)([A-Z0-9]{6})/);
    if(tagged) return cleanCode(tagged[1]);
    const exact = text.match(/^([A-Z0-9]{6})$/);
    if(exact) return cleanCode(exact[1]);
    const tokens = text.match(/\b[A-Z0-9]{6}\b/g);
    return tokens?.length ? cleanCode(tokens[tokens.length - 1]) : "";
  };
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
    const requestEpoch = state.roomEpoch;
    const controller = new AbortController();
    const timeout = window.setTimeout(()=>controller.abort(), 14000);
    let response;
    try{
      response = await fetch(API, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ initData:String(tgApp?.initData || ""), action, code:state.code, ...extra }),
        signal:controller.signal,
      });
    }catch(error){
      if(error?.name === "AbortError") throw new Error("Live Squad took too long to answer. Please try again.");
      throw new Error("Live Squad could not connect. Check your signal and try again.");
    }finally{ window.clearTimeout(timeout); }
    const payload = await response.json().catch(()=>null);
    if(!response.ok || !payload?.ok) throw new Error(payload?.error || "Live squad request failed.");
    if(payload.snapshot && requestEpoch === state.roomEpoch) applySnapshot(payload.snapshot, payload.roles);
    return payload;
  }

  function applySnapshot(snapshot, roles){
    if(!snapshot || typeof snapshot !== "object") return;
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
      state.local.livesRemaining = Number(mine.livesRemaining || 0);
      state.local.respawnAt = Number(mine.respawnAt || 0);
      state.local.role = mine.role;
    }
    const bodyMode = $("squadBody")?.dataset?.squadMode || "";
    if(snapshot.status === "active" && bodyMode === "active" && $("squadArena")){
      updateActiveHud();
    }else if(snapshot.status === "waiting" && bodyMode === "waiting"){
      updateWaitingLobby();
    }else if(["complete","failed"].includes(snapshot.status) && bodyMode === snapshot.status){
      updateActiveHud();
    }else{
      render();
    }
    maybeApplyReward();
  }

  function updateWaitingLobby(){
    const snapshot = state.snapshot;
    if(!snapshot) return;
    const count = $("squadMemberCount");
    if(count) count.textContent = `${snapshot.memberCount}/2 players connected`;
    const roster = $("squadRoster");
    if(roster) roster.innerHTML = rosterHtml();
    const mine = localSnapshotPlayer();
    document.querySelectorAll("#liveSquadOverlay [data-squad-role]").forEach((button)=>{
      button.classList.toggle("active", button.dataset.squadRole === mine?.role);
    });
    const startButton = $("squadStartButton");
    if(startButton){
      startButton.disabled = state.pending.has("start");
      startButton.textContent = snapshot.memberCount < 2 ? "Need Teammate" : "Start Mission";
    }
  }

  function updateActiveHud(){
    const snap = state.snapshot;
    if(!snap) return;
    const bossPct = Math.round((Number(snap.boss?.hp || 0) / Math.max(1, Number(snap.boss?.hpMax || 1))) * 100);
    const seconds = Math.max(0, Math.ceil(Number(snap.timeLeftMs || 0) / 1000));
    const set = (id, text)=>{ const node=$(id); if(node) node.textContent=text; };
    const activeThreats = (snap.tigers || []).filter((t)=>!t.defeated).length;
    set("squadBossHud", `Alpha ${Math.round(snap.boss?.hp || 0)} HP • ${activeThreats} active`);
    set("squadCivHud", `${snap.rescuedIds?.length || 0}/4 rescued`);
    set("squadMissionHud", `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`);
    set("squadLivesHud", livesHudText());
    const connection = $("squadConnection");
    if(connection) connection.textContent = playerConnectionText();
    set("squadObjective", objectiveText());
    updateActionButtons();
  }

  function activeTigers(){ return (state.snapshot?.tigers || (state.snapshot?.boss ? [state.snapshot.boss] : [])).filter((t)=>!t.defeated && Number(t.hp || 0) > 0); }
  function nearestActiveTiger(){ return activeTigers().sort((a,b)=>distance(state.local,a)-distance(state.local,b))[0] || null; }
  function nearestUnrescuedCivilian(){
    return (state.snapshot?.civilians || [])
      .filter((c)=>!(state.snapshot?.rescuedIds || []).includes(c.id))
      .sort((a,b)=>distance(state.local,a)-distance(state.local,b))[0] || null;
  }
  function updateActionButtons(){
    if(!state.local || state.snapshot?.status !== "active") return;
    const tiger = nearestActiveTiger();
    const civilian = nearestUnrescuedCivilian();
    const teammate = remoteSnapshotPlayer();
    const attack = $("squadAttackButton");
    const rescue = $("squadRescueButton");
    const revive = $("squadReviveButton");
    const tigerNear = tiger && distance(state.local,tiger) <= (tiger.boss ? 178 : 164);
    const civNear = civilian && distance(state.local,civilian) <= 82;
    const reviveNear = teammate?.downed && distance(state.local,teammate) <= 108;
    const unavailable = !!state.local.downed;
    if(attack){ attack.innerHTML = unavailable ? "⏳ Down<br><small>Recovery</small>" : (tiger ? (tigerNear ? `🎯 Attack<br><small>${esc(tiger.type || "Tiger")}</small>` : `🐅 Move Closer<br><small>${Math.round(distance(state.local,tiger))}m</small>`) : "✅ Threat Clear"); attack.disabled = unavailable || !tiger; }
    if(rescue){ rescue.innerHTML = unavailable ? "⏳ Down<br><small>Recovery</small>" : (civilian ? (civNear ? `🛟 Rescue<br><small>${esc(civilian.name || "Civilian")}</small>` : `👤 Find Civilian<br><small>${Math.round(distance(state.local,civilian))}m</small>`) : "✅ Civilians Safe"); rescue.disabled = unavailable || !civilian; }
    if(revive){ revive.innerHTML = unavailable ? "⏳ Down<br><small>Recovery</small>" : (teammate?.downed ? (reviveNear ? "💚 Revive<br><small>Teammate</small>" : `💚 Reach Teammate<br><small>${Math.round(distance(state.local,teammate))}m</small>`) : "💚 Revive<br><small>Not needed</small>"); revive.disabled = unavailable || !teammate?.downed; }
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
      const respawn = respawnSeconds(player);
      const status = player.downed ? (respawn > 0 ? `RESPAWNING IN ${respawn}s` : "DOWNED — needs revive") : (player.online ? `HP ${Math.round(player.hp)}/${Math.round(player.maxHp)}` : "Reconnecting…");
      return `<div class="squadMember ${mine ? "me" : ""} ${player.online ? "" : "offline"}">
        <div class="squadMemberName">${mine ? "⭐ " : ""}${esc(player.name)}</div>
        <div class="squadMemberMeta">${esc(roleLabel(player.role))} • ${esc(status)}</div>
        <div class="squadMemberMeta">❤️ Life ${Math.round(player.livesRemaining || 0)} • Alpha damage ${Math.round(player.bossDamage || 0)} • Rescues ${(player.rescuedIds || []).length} • Revives ${Math.round(player.revives || 0)}</div>
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
    return roles.map((role)=>`<button type="button" class="squadRole ${mine?.role === role.key ? "active" : ""}" ${waiting ? "" : "disabled"} data-squad-command="role" data-squad-role="${esc(role.key)}">${esc(role.label)}</button>`).join("");
  }

  function lobbyHtml(){
    const snapshot = state.snapshot;
    if(!snapshot){
      return `<div class="squadPanel">
        <div class="squadHero">
          <div><div class="squadKicker">V5.4 Co-op Field Lives</div><div class="squadMissionName">Operation Night Fang</div><div class="squadDesc">Two real Telegram players enter an expanded Story-style district with soldiers, civilians, a tiger pack, Night Fang Alpha, one field life each, and a full mission restart after a squad wipe.</div></div>
          <div class="squadCodeBox"><div class="squadSmall">PRIVATE TWO-PLAYER MISSION</div><div style="font-size:44px;margin:5px">🐅🐅</div><div class="squadSmall">One leader • One teammate</div></div>
        </div>
        <div class="squadRow"><button type="button" class="squadBtn good" data-squad-command="create">Create Squad</button></div>
        <div class="squadSmall squadJoinLabel">Enter the six-character code from your teammate</div>
        <div class="squadJoinRow"><input class="squadInput" id="squadJoinCode" value="${esc(state.joinDraft)}" maxlength="6" placeholder="ABC123" aria-label="Six-character squad code" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" inputmode="text" enterkeyhint="go"><button type="button" class="squadBtn" data-squad-command="paste-code">Paste</button><button type="button" class="squadBtn primary" data-squad-command="join">Join</button></div>
        <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
        <div class="squadSmall">Telegram requires both players to open the game through the Tiger Strike bot. Rooms expire automatically.</div>
      </div>`;
    }
    const full = snapshot.memberCount >= 2;
    const waiting = snapshot.status === "waiting";
    return `<div class="squadPanel">
      <div class="squadHero">
        <div><div class="squadKicker">Private Live Squad</div><div class="squadMissionName">Operation Night Fang</div><div class="squadDesc">Choose a role. The squad leader starts when both players are connected.</div></div>
        <button type="button" class="squadCodeBox" data-squad-command="copy-code" aria-label="Copy squad code ${esc(snapshot.code)}"><span class="squadSmall">SQUAD CODE • TAP TO COPY</span><span class="squadCode">${esc(displayCode(snapshot.code))}</span><span class="squadSmall" id="squadMemberCount">${snapshot.memberCount}/2 players connected</span></button>
      </div>
      <div class="squadRoster" id="squadRoster">${rosterHtml()}</div>
      <div class="squadSmall">Choose your field role</div><div class="squadRoleGrid">${roleButtonsHtml()}</div>
      <details class="squadHowTo" open><summary>How two-player Live Squad works</summary><div><b>1.</b> Cyan soldier = you. Purple soldier = your real teammate.<br><b>2.</b> Both phones see the same civilians, tiger pack, Alpha health, and extraction.<br><b>3.</b> Move near a person to Rescue, near a tiger to Attack, or near a downed teammate to Revive.<br><b>4.</b> Rescue all four, defeat Night Fang, then both soldiers enter the green extraction zone.</div></details>
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadRow">
        ${waiting ? `<button type="button" class="squadBtn primary" data-squad-command="invite">Invite Teammate</button>` : ""}
        ${waiting && snapshot.isHost ? `<button type="button" class="squadBtn good" id="squadStartButton" data-squad-command="start">${full ? "Start Mission" : "Need Teammate"}</button>` : ""}
        ${waiting && !snapshot.isHost ? `<button type="button" class="squadBtn good" disabled>Waiting for Leader</button>` : ""}
        <button type="button" class="squadBtn" data-squad-command="copy-code">Copy Code</button>
        <button type="button" class="squadBtn" data-squad-command="copy-link">Copy Invite Link</button>
        <button type="button" class="squadBtn danger" data-squad-command="leave">Leave Squad</button>
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
        <div class="squadHudCard"><div class="squadHudLabel">Tiger Threats</div><div class="squadHudValue" id="squadBossHud">Alpha ${Math.round(snap.boss.hp)} HP • ${(snap.tigers || []).filter((t)=>!t.defeated).length || 1} active</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Civilians</div><div class="squadHudValue" id="squadCivHud">${rescued}/4 rescued</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Mission</div><div class="squadHudValue" id="squadMissionHud">${statusText}</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Field Lives</div><div class="squadHudValue" id="squadLivesHud">${esc(livesHudText())}</div></div>
      </div>
      <div class="squadStoryStrip"><span>🌤️ Daylight Patrol</span><span>🧭 Base Camp Respawn</span><span>🏘️ Night Fang District</span></div>
      <div class="squadConnection ${remoteSnapshotPlayer()?.online === false ? "bad" : ""}" id="squadConnection">${esc(playerConnectionText())}</div>
      <div class="squadObjective" id="squadObjective">${objectiveText()}</div>
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadMapLegend"><span><i class="you"></i>You</span><span><i class="team"></i>Teammate</span><span>👤 Civilian</span><span>🐅 Tiger</span></div>
      <canvas id="squadArena" width="1200" height="1100" aria-label="Operation Night Fang expanded Story-style live co-op battlefield"></canvas>
      <div class="squadBanner ${["complete","failed"].includes(snap.status) ? "show" : ""}" id="squadResultBanner">
        <div class="squadBannerTitle">${snap.status === "complete" ? "🏆 Squad Extracted!" : (snap.failureReason === "squad_wipe" ? "💀 Squad Wiped" : "⏱️ Operation Failed")}</div>
        <div class="squadBannerText">${snap.status === "complete" ? "Both players rescued the civilians, cleared the tiger pack, defeated Night Fang, and reached extraction together." : (snap.failureReason === "squad_wipe" ? "Both soldiers used their field life and went down. The squad leader can restart this mission with both lives restored." : "Time expired. The squad leader can restart Operation Night Fang.")}</div>
        ${snap.status === "complete" ? `<button type="button" class="squadBtn good" data-squad-command="claim">Claim Co-op Reward</button>` : ""}
        ${snap.status === "failed" && snap.isHost ? `<button type="button" class="squadBtn good" data-squad-command="restart">Restart Mission</button>` : ""}
        ${snap.status === "failed" && !snap.isHost ? `<button type="button" class="squadBtn" disabled>Waiting for Leader to Restart</button>` : ""}
        <button type="button" class="squadBtn" data-squad-command="leave">Return to HQ</button>
      </div>
      <div class="squadControls">
        <div class="squadDpad">
          <button type="button" class="squadPadBtn up" data-move="up">▲</button><button type="button" class="squadPadBtn left" data-move="left">◀</button><button type="button" class="squadPadBtn right" data-move="right">▶</button><button type="button" class="squadPadBtn down" data-move="down">▼</button>
        </div>
        <div class="squadActions">
          <button type="button" class="squadActionBtn attack" id="squadAttackButton" data-squad-command="action" data-squad-action="attack">🎯 Attack</button>
          <button type="button" class="squadActionBtn rescue" id="squadRescueButton" data-squad-command="action" data-squad-action="rescue">🛟 Rescue</button>
          <button type="button" class="squadActionBtn revive" id="squadReviveButton" data-squad-command="action" data-squad-action="revive">💚 Revive</button>
        </div>
      </div>
      <div class="squadSmall" style="margin-top:8px">Hold the arrows to move your soldier. Each player has one automatic field life. After both lives are used, the leader can restart the mission. Both players must finish inside extraction.</div>
    </div>`;
  }

  function connectionText(){
    const remote = remoteSnapshotPlayer();
    if(!remote) return "Waiting for your teammate…";
    return remote.online ? `${remote.name} is connected live.` : `${remote.name} is reconnecting…`;
  }
  function respawnSeconds(player){
    const at = Number(player?.respawnAt || 0);
    if(!at) return 0;
    return Math.max(0, Math.ceil((at - Number(state.snapshot?.serverNow || Date.now())) / 1000));
  }
  function livesHudText(){
    const players = state.snapshot?.players || [];
    return players.map((p)=>`${Number(p.userId) === viewerId() ? "You" : "Team"} ${Math.round(p.livesRemaining || 0)}`).join(" • ") || "1 each";
  }
  function playerConnectionText(){
    const mine = localSnapshotPlayer();
    if(mine?.downed){
      const seconds = respawnSeconds(mine);
      if(seconds > 0) return `Field life activated—respawning at Base Camp in ${seconds}s.`;
      return "You are out of lives—your teammate must revive you. If both soldiers are down, the leader can restart.";
    }
    return connectionText();
  }
  function objectiveText(){
    const snap = state.snapshot;
    if(!snap) return "";
    const mine = localSnapshotPlayer();
    const respawn = respawnSeconds(mine);
    if(mine?.downed && respawn > 0) return `Recovery: Your field life is returning you to Base Camp in ${respawn}s.`;
    if(snap.failureReason === "squad_wipe") return "Squad wipe: Restart Mission restores both soldiers, both field lives, civilians, tigers, and the mission clock.";
    if((snap.rescuedIds || []).length < 4) return `Objective 1: Find the human civilians and tap Rescue when close (${snap.rescuedIds.length}/4 safe).`;
    const threats = (snap.tigers || (snap.boss ? [snap.boss] : [])).filter((t)=>!t.defeated && Number(t.hp || 0) > 0);
    if(threats.length) return `Objective 2: Clear the tiger pack and defeat Night Fang together (${threats.length} tiger${threats.length===1?"":"s"} active • ${Math.round(snap.boss?.hp || 0)} Alpha HP).`;
    const ready = snap.extractionReadyIds || [];
    return `Objective: Both players stand inside the green extraction circle (${ready.length}/2 ready).`;
  }

  function render(){
    const body = $("squadBody");
    if(!body) return;
    if(state.snapshot && ["active","complete","failed"].includes(state.snapshot.status)){
      body.dataset.squadMode = state.snapshot.status;
      body.innerHTML = arenaHtml();
    }else{
      body.dataset.squadMode = state.snapshot ? "waiting" : "landing";
      body.innerHTML = lobbyHtml();
    }
    bindCommandButtons();
    bindMoveButtons();
    bindLobbyInput();
    if(state.snapshot?.status === "active") ensureFrame();
    else drawArena();
  }

  function bindLobbyInput(){
    const input = $("squadJoinCode");
    if(!input) return;
    input.addEventListener("input", ()=>{
      const code = cleanCode(input.value);
      state.joinDraft = code;
      if(input.value !== code) input.value = code;
    });
    input.addEventListener("focus", ()=>{
      state.keys.clear();
      Object.keys(state.move).forEach((key)=>{ state.move[key] = false; });
    });
    input.addEventListener("paste", ()=>window.setTimeout(()=>{
      const code = extractCode(input.value);
      if(code){ state.joinDraft = code; input.value = code; }
    },0));
    input.addEventListener("keydown", (event)=>{
      if(event.key !== "Enter") return;
      event.preventDefault();
      dispatchCommand("join", input);
    });
  }

  function bindMoveButtons(){
    document.querySelectorAll("#liveSquadOverlay [data-move]").forEach((button)=>{
      const direction = button.dataset.move;
      const on = (event)=>{
        event.preventDefault();
        event.stopPropagation();
        try{ button.setPointerCapture?.(event.pointerId); }catch(error){}
        state.move[direction] = true;
      };
      const off = (event)=>{ event.preventDefault(); event.stopPropagation(); state.move[direction] = false; };
      button.addEventListener("pointerdown", on);
      button.addEventListener("pointerup", off);
      button.addEventListener("pointercancel", off);
      button.addEventListener("pointerleave", off);
    });
  }

  function bindCommandButtons(){
    document.querySelectorAll("#liveSquadOverlay [data-squad-command]").forEach((button)=>{
      if(button.dataset.squadControlBound === "1") return;
      button.dataset.squadControlBound = "1";
      const activate = (event)=>{
        if(button.disabled) return;
        const now = Date.now();
        if(now - Number(button.dataset.squadLastActivationAt || 0) < 500){
          event?.preventDefault?.();
          event?.stopPropagation?.();
          event?.stopImmediatePropagation?.();
          return;
        }
        button.dataset.squadLastActivationAt = String(now);
        event?.preventDefault?.();
        event?.stopPropagation?.();
        event?.stopImmediatePropagation?.();
        dispatchCommand(button.dataset.squadCommand, button);
      };
      button.addEventListener("pointerup", activate, { passive:false });
      button.addEventListener("touchend", activate, { passive:false });
      button.addEventListener("click", activate, true);
    });
  }

  async function dispatchCommand(command, source){
    const button = source?.closest?.("button") || null;
    if(button?.disabled) return;
    const actionName = button?.dataset?.squadAction || "";
    const role = button?.dataset?.squadRole || "";
    const commandName = String(command || "");
    const lockKey = commandName === "role" ? `role:${role}` : (commandName === "action" ? `action:${actionName}` : commandName);
    if(state.pending.has(lockKey)) return;
    const commands = {
      create:()=>create(),
      join:()=>join(),
      role:()=>chooseRole(role),
      invite:()=>invite(),
      start:()=>start(),
      restart:()=>restart(),
      action:()=>action(actionName),
      claim:()=>claim(),
      leave:()=>leave(),
      "paste-code":()=>pasteJoinCode(),
      "copy-code":()=>copyCode(),
      "copy-link":()=>copyInviteLink(),
    };
    const run = commands[commandName];
    if(!run) return;
    state.pending.add(lockKey);
    if(button) button.classList.add("busy");
    try{ await run(); }
    finally{
      state.pending.delete(lockKey);
      if(button?.isConnected) button.classList.remove("busy");
      if(state.snapshot?.status === "waiting") updateWaitingLobby();
    }
  }

  function bindOverlay(){
    const overlay = $("liveSquadOverlay");
    if(!overlay || state.overlayBound) return;
    state.overlayBound = true;
    ["pointerdown","pointerup","touchstart","touchend"].forEach((name)=>{
      overlay.addEventListener(name, (event)=>event.stopPropagation(), { passive:name.startsWith("touch") });
    });
    overlay.addEventListener("click", (event)=>{
      const button = event.target?.closest?.("[data-squad-command]");
      if(!button || !overlay.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      dispatchCommand(button.dataset.squadCommand, button);
    }, false);
  }

  function open(){
    const overlay = $("liveSquadOverlay");
    if(!overlay) return;
    bindOverlay();
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
    const code = extractCode(codeValue || state.joinDraft || $("squadJoinCode")?.value);
    if(code.length !== 6) return setMessage("Enter the complete six-character squad code.", true);
    try{
      state.joinDraft = code;
      state.code = code;
      setMessage(`Joining squad ${code}…`);
      await api("join", { code });
      state.joinDraft = "";
      setMessage("Connected. Choose your role and wait for the squad leader.");
      startPolling();
    }catch(error){
      state.code = "";
      setMessage(`${error.message} Check the six characters and try again.`, true);
      const input = $("squadJoinCode");
      if(input){ input.value = state.joinDraft; input.focus({ preventScroll:true }); input.select(); }
    }
  }

  async function chooseRole(role){
    if(!state.snapshot || state.snapshot.status !== "waiting") return;
    const mine = localSnapshotPlayer();
    if(mine) mine.role = role;
    if(state.local) state.local.role = role;
    updateWaitingLobby();
    setMessage(`${roleLabel(role)} selected. Saving…`);
    try{ await api("role", { role }); setMessage(`${roleLabel(role)} selected.`); }
    catch(error){
      setMessage(`${error.message} Your role will be retried when the connection returns.`, true);
      sync().catch(()=>{});
    }
  }

  async function invite(){
    if(!state.code) return;
    const inviteCode = state.code;
    try{
      setMessage("Preparing your Telegram squad invitation…");
      const payload = await api("invite");
      const invitation = payload.invitation || {};
      if(!state.open || state.code !== inviteCode) return;
      state.inviteUrl = String(invitation.playUrl || "");
      state.inviteText = String(invitation.shareText || "");
      if(invitation.preparedMessageId && typeof tgApp?.shareMessage === "function"){
        const sent = await new Promise((resolve)=>{
          let done = false;
          const finish = (value)=>{ if(done) return; done = true; resolve(value === true); };
          try{ tgApp.shareMessage(invitation.preparedMessageId, finish); setTimeout(()=>finish(false),30000); }
          catch(error){ finish(false); }
        });
        if(sent){
          if(!state.open || state.code !== inviteCode) return;
          setMessage("Invitation sent. Waiting for your teammate…");
        }else{
          if(!state.open || state.code !== inviteCode) return;
          openTelegramShare(invitation.playUrl, invitation.shareText);
          setMessage("Choose a Telegram friend and send the invitation.");
        }
      }else{
        openTelegramShare(invitation.playUrl, invitation.shareText);
        setMessage("Telegram share opened. Choose a teammate to invite.");
      }
    }catch(error){ setMessage(error.message, true); }
  }

  function openTelegramShare(playUrl="", shareText=""){
    const text = String(shareText || state.inviteText || `Join my live Tiger Strike squad for Operation Night Fang. Code: ${state.code}`);
    const url = `https://t.me/share/url?url=${encodeURIComponent(playUrl || state.inviteUrl || "")}&text=${encodeURIComponent(text)}`;
    if(typeof tgApp?.openTelegramLink === "function") tgApp.openTelegramLink(url);
    else window.open(url,"_blank","noopener");
  }

  async function start(){
    if(Number(state.snapshot?.memberCount || 0) < 2){
      setMessage("Start Mission needs 2/2 players. Invite one teammate or have them join with the code first.", true);
      return;
    }
    try{ setMessage("Deploying both players…"); await api("start"); setMessage("Operation Night Fang is live."); ensureFrame(); }
    catch(error){ setMessage(error.message, true); }
  }

  async function restart(){
    if(!state.snapshot?.isHost) return setMessage("Only the squad leader can restart the mission.", true);
    try{
      setMessage("Restarting Operation Night Fang with both field lives restored…");
      await api("restart");
      setMessage("Mission restarted. Both soldiers are back at Base Camp.");
      ensureFrame();
    }catch(error){ setMessage(error.message, true); }
  }

  async function action(kind){
    if(state.actionBusy || state.snapshot?.status !== "active") return;
    state.actionBusy = true;
    try{
      // Send the newest local position before judging action range. This keeps
      // a fast move-then-tap from being rejected using an older server position.
      if(state.local){
        await api("sync", { player:{ x:state.local.x, y:state.local.y, face:state.local.face } });
        state.lastSyncAt = Date.now();
      }
      const extra = {};
      if(kind === "rescue"){
        const target = nearestUnrescuedCivilian();
        if(!target || distance(state.local,target) > 82) throw new Error("Move next to a blue civilian marker first.");
        extra.civilianId = target.id;
      }else if(kind === "revive"){
        const teammate = remoteSnapshotPlayer();
        if(!teammate?.downed) throw new Error("Your teammate does not need a revive.");
        if(distance(state.local,teammate) > 108) throw new Error("Move next to your downed teammate first.");
        extra.targetUserId = teammate.userId;
      }else if(kind === "attack"){
        const target = nearestActiveTiger();
        if(!target) throw new Error("The tiger threat is already cleared.");
        if(distance(state.local,target) > (target.boss ? 178 : 164)) throw new Error(`Move closer to ${target.name || "the tiger"} before attacking.`);
        extra.tigerId = target.id;
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

  function leave(){
    const oldCode = state.code;
    state.roomEpoch += 1;
    state.pending.clear();
    state.code = ""; state.joinDraft = ""; state.inviteUrl = ""; state.inviteText = ""; state.snapshot = null; state.local = null; state.remoteDraw.clear();
    setMessage("Create a private squad or enter a teammate's six-character code.");
    close();
    if(oldCode) api("leave", { code:oldCode }).catch(()=>{});
  }

  async function copyTextReliable(text){
    const value = String(text || "");
    if(!value) return false;
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(value);
        return true;
      }
    }catch(error){}
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    let copied = false;
    try{ copied = document.execCommand("copy") === true; }catch(error){}
    field.remove();
    return copied;
  }

  function copyFeedback(text){
    try{ tgApp?.HapticFeedback?.notificationOccurred?.("success"); }catch(error){}
    setMessage(text);
  }

  async function pasteJoinCode(){
    const input = $("squadJoinCode");
    try{
      const clipboardText = await navigator.clipboard?.readText?.();
      const code = extractCode(clipboardText);
      if(code.length !== 6) throw new Error("No complete squad code was found on the clipboard.");
      state.joinDraft = code;
      if(input) input.value = code;
      setMessage(`Code ${displayCode(code)} is ready. Tap Join.`);
    }catch(error){
      setMessage("Press and hold inside the code box, then choose Paste.", true);
      input?.focus({ preventScroll:true });
    }
  }

  async function copyCode(){
    const text = state.code || "";
    const copied = await copyTextReliable(text);
    if(copied) copyFeedback(`Copied! Squad code: ${text}`);
    else{
      setMessage(`Squad code: ${text}. Press and hold the large code above to copy it.`, true);
      try{ tgApp?.showAlert?.(`Squad code: ${text}`); }catch(error){}
    }
  }

  async function copyInviteLink(){
    try{
      if(!state.inviteUrl){
        setMessage("Preparing the invite link…");
        const payload = await api("invite");
        state.inviteUrl = String(payload?.invitation?.playUrl || "");
        state.inviteText = String(payload?.invitation?.shareText || "");
      }
      if(!state.inviteUrl){
        const copiedCode = await copyTextReliable(state.code);
        if(copiedCode) return copyFeedback(`Join link unavailable, so the squad code was copied: ${state.code}`);
        throw new Error("Invite link is unavailable. Tap the large squad code to copy it.");
      }
      const copied = await copyTextReliable(state.inviteUrl);
      if(copied) copyFeedback("Copied! Send the invite link to your teammate.");
      else{
        setMessage(`Invite link ready: ${state.inviteUrl}`, true);
        try{ tgApp?.showAlert?.(state.inviteUrl); }catch(error){}
      }
    }catch(error){ setMessage(error.message, true); }
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
      if(node){ node.textContent = playerConnectionText(); node.classList.toggle("bad", remoteSnapshotPlayer()?.online === false); }
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
    const world = state.snapshot?.world || { width:1000, height:760 };
    state.local.x = clamp(state.local.x + (dx/len)*speed*dt, 24, Number(world.width || 1000) - 24);
    state.local.y = clamp(state.local.y + (dy/len)*speed*dt, 24, Number(world.height || 760) - 24);
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
      if(at - state.lastActionUiAt > 160){ state.lastActionUiAt = at; updateActionButtons(); }
      drawArena();
      state.frame = requestAnimationFrame(tick);
    };
    state.frame = requestAnimationFrame(tick);
  }

  function roundRect(ctx,x,y,w,h,r=8){
    const radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
  }

  function drawStoryTree(ctx,x,y,size=1){
    ctx.fillStyle="rgba(15,23,42,.28)";ctx.beginPath();ctx.ellipse(x+5,y+15,25*size,9*size,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#65462c";ctx.fillRect(x-4*size,y-2*size,8*size,25*size);
    for(const [dx,dy,r,c] of [[0,-12,19,"#166534"],[-13,-4,15,"#15803d"],[13,-3,15,"#14532d"],[0,-25,14,"#22c55e"]]){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x+dx*size,y+dy*size,r*size,0,Math.PI*2);ctx.fill();}
  }

  function drawStoryBuilding(ctx,x,y,w,h,roof="#9a5c38"){
    ctx.fillStyle="rgba(2,6,23,.28)";roundRect(ctx,x+8,y+10,w,h,9);ctx.fill();
    ctx.fillStyle="#c7b79c";roundRect(ctx,x,y,w,h,8);ctx.fill();
    ctx.fillStyle=roof;ctx.beginPath();ctx.moveTo(x-8,y+6);ctx.lineTo(x+w*.5,y-28);ctx.lineTo(x+w+8,y+6);ctx.closePath();ctx.fill();
    ctx.fillStyle="#5b4333";ctx.fillRect(x+w*.43,y+h*.48,w*.18,h*.52);
    ctx.fillStyle="#93c5fd";ctx.fillRect(x+w*.12,y+h*.26,w*.18,h*.2);ctx.fillRect(x+w*.7,y+h*.26,w*.18,h*.2);
  }

  function drawStoryCivilian(ctx,civ,rescued){
    const colors={field:["#f59e0b","#334155"],medic:["#f8fafc","#ef4444"],scout:["#60a5fa","#374151"],driver:["#f97316","#1f2937"]};
    const [shirt,pants]=colors[civ.look]||colors.field;ctx.save();ctx.translate(civ.x,civ.y);ctx.globalAlpha=rescued?.24:1;
    ctx.fillStyle="rgba(2,6,23,.32)";ctx.beginPath();ctx.ellipse(3,18,17,7,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=pants;ctx.lineWidth=6;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-4,9);ctx.lineTo(-8,24);ctx.moveTo(4,9);ctx.lineTo(9,24);ctx.stroke();
    ctx.strokeStyle=shirt;ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(0,-5);ctx.lineTo(0,11);ctx.moveTo(-2,0);ctx.lineTo(-13,9);ctx.moveTo(2,0);ctx.lineTo(13,8);ctx.stroke();
    ctx.fillStyle="#d7a47f";ctx.beginPath();ctx.arc(0,-14,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#3f2d22";ctx.beginPath();ctx.arc(0,-17,8,Math.PI,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.font="900 12px system-ui";ctx.textAlign="center";ctx.fillStyle=rescued?"#bbf7d0":"#e0f2fe";ctx.fillText(rescued?"SAFE":`RESCUE • ${civ.name}`,0,-32);ctx.restore();
  }

  function drawStoryTiger(ctx,tiger,now){
    if(tiger.defeated) return;const alpha=!!tiger.boss;const s=alpha?1.28:(tiger.type==="Armored"?1.08:.94);const facing=Math.sin((now/900)+(String(tiger.id).length))>=0?1:-1;
    ctx.save();ctx.translate(tiger.x,tiger.y);ctx.scale(facing*s,s);
    if(alpha){ctx.fillStyle="rgba(239,68,68,.18)";ctx.beginPath();ctx.arc(0,0,62,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(251,113,133,.55)";ctx.lineWidth=3;ctx.stroke();}
    ctx.fillStyle="rgba(2,6,23,.35)";ctx.beginPath();ctx.ellipse(3,22,40,10,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#f59e0b";ctx.lineWidth=9;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-29,2);ctx.quadraticCurveTo(-54,-15,-64,4);ctx.stroke();
    ctx.strokeStyle="#111827";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-47,-6);ctx.lineTo(-51,2);ctx.stroke();
    ctx.fillStyle="#f59e0b";ctx.beginPath();ctx.ellipse(0,0,35,20,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(30,-7,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#fbbf24";ctx.beginPath();ctx.moveTo(22,-17);ctx.lineTo(23,-29);ctx.lineTo(31,-20);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(34,-19);ctx.lineTo(40,-28);ctx.lineTo(43,-15);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#111827";ctx.lineWidth=4;for(const x of [-20,-7,7,18]){ctx.beginPath();ctx.moveTo(x,-15);ctx.lineTo(x+8,13);ctx.stroke();}
    ctx.strokeStyle="#d97706";ctx.lineWidth=7;for(const x of [-18,9]){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x-2,28);ctx.stroke();}
    ctx.fillStyle="#111827";ctx.beginPath();ctx.arc(37,-9,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f8fafc";ctx.beginPath();ctx.arc(44,-3,3,0,Math.PI*2);ctx.fill();ctx.restore();
    const pct=clamp(Number(tiger.hp||0)/Math.max(1,Number(tiger.hpMax||1)),0,1);const barW=alpha?105:72;ctx.fillStyle="rgba(2,6,23,.8)";roundRect(ctx,tiger.x-barW/2,tiger.y-(alpha?65:50),barW,11,5);ctx.fill();ctx.fillStyle=alpha?"#fb7185":"#f59e0b";roundRect(ctx,tiger.x-barW/2+2,tiger.y-(alpha?63:48),(barW-4)*pct,7,4);ctx.fill();ctx.fillStyle="#fff7ed";ctx.font=`900 ${alpha?14:11}px system-ui`;ctx.textAlign="center";ctx.fillText(alpha?"NIGHT FANG ALPHA":String(tiger.type||"TIGER").toUpperCase(),tiger.x,tiger.y-(alpha?72:57));
  }

  function drawStorySoldier(ctx,p,source,draw,mine){
    const body=mine?"#0ea5e9":"#8b5cf6";const outline=p.downed?"#fb7185":(mine?"#67e8f9":"#c4b5fd");const face=Number(source.face||0);ctx.save();ctx.translate(draw.x,draw.y);ctx.rotate(face);
    ctx.fillStyle="rgba(2,6,23,.38)";ctx.beginPath();ctx.ellipse(1,19,18,7,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#1e293b";ctx.lineWidth=7;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-5,10);ctx.lineTo(-8,25);ctx.moveTo(5,10);ctx.lineTo(8,25);ctx.stroke();
    ctx.fillStyle=body;roundRect(ctx,-11,-7,22,25,6);ctx.fill();ctx.strokeStyle=outline;ctx.lineWidth=2.5;ctx.stroke();
    ctx.fillStyle="#334155";roundRect(ctx,-13,-4,26,15,4);ctx.fill();ctx.fillStyle="#6b7c65";ctx.beginPath();ctx.arc(0,-15,11,Math.PI,Math.PI*2);ctx.fill();ctx.fillRect(-11,-15,22,6);
    ctx.strokeStyle="#dbeafe";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(8,-1);ctx.lineTo(27,0);ctx.stroke();ctx.fillStyle="#0f172a";ctx.fillRect(18,-4,15,5);ctx.restore();
    const recovery=respawnSeconds(p);const downLabel=p.downed?(recovery>0?` • RESPAWN ${recovery}s`:" • DOWN"):"";ctx.fillStyle=outline;ctx.font="950 13px system-ui";ctx.textAlign="center";ctx.fillText(`${mine?"YOU":p.name}${downLabel}`,draw.x,draw.y-35);
    ctx.fillStyle="rgba(2,6,23,.82)";roundRect(ctx,draw.x-26,draw.y+31,52,7,4);ctx.fill();ctx.fillStyle=p.downed?"#ef4444":"#22c55e";roundRect(ctx,draw.x-25,draw.y+32,50*clamp(Number(p.hp||0)/Math.max(1,Number(p.maxHp||1)),0,1),5,3);ctx.fill();
    ctx.fillStyle="#fef3c7";ctx.font="900 11px system-ui";ctx.fillText(`❤️ ${Math.round(p.livesRemaining||0)}`,draw.x,draw.y+52);
  }

  function drawArena(){
    const canvas = $("squadArena");
    const snap = state.snapshot;
    if(!canvas || !snap) return;
    const ctx = canvas.getContext("2d");
    const w=canvas.width,h=canvas.height,now=Number(snap.serverNow||Date.now());ctx.clearRect(0,0,w,h);
    const terrain=ctx.createLinearGradient(0,0,0,h);terrain.addColorStop(0,"#376b43");terrain.addColorStop(.52,"#2b5b3b");terrain.addColorStop(1,"#204b35");ctx.fillStyle=terrain;ctx.fillRect(0,0,w,h);
    ctx.fillStyle="rgba(91,139,81,.22)";for(let y=0;y<h;y+=82){for(let x=0;x<w;x+=100){ctx.fillRect(x+((y/82)%2)*24,y,76,58);}}
    // Expanded Story district river, two main roads, and a real bridge route.
    ctx.fillStyle="rgba(39,112,137,.68)";ctx.beginPath();ctx.moveTo(0,930);ctx.bezierCurveTo(250,865,430,1035,650,970);ctx.bezierCurveTo(880,905,1015,1035,1200,965);ctx.lineTo(1200,1100);ctx.lineTo(0,1100);ctx.closePath();ctx.fill();
    ctx.fillStyle="#4b5563";ctx.fillRect(0,470,w,132);ctx.fillRect(540,0,132,h);ctx.fillStyle="#354052";ctx.fillRect(0,482,w,108);ctx.fillRect(552,0,108,h);
    ctx.strokeStyle="rgba(250,204,21,.48)";ctx.lineWidth=5;ctx.setLineDash([30,26]);ctx.beginPath();ctx.moveTo(0,536);ctx.lineTo(w,536);ctx.moveTo(606,0);ctx.lineTo(606,h);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle="#765a3b";ctx.fillRect(530,900,152,58);ctx.strokeStyle="#e0bc73";ctx.lineWidth=6;for(let x=542;x<675;x+=22){ctx.beginPath();ctx.moveTo(x,892);ctx.lineTo(x,967);ctx.stroke();}
    [[68,86,150,94,"#9a5c38"],[930,82,165,100,"#7c4a32"],[82,650,154,102,"#72452f"],[735,700,142,94,"#9a5c38"],[980,855,156,104,"#8b5a3c"],[335,730,138,90,"#7c4a32"]].forEach((b)=>drawStoryBuilding(ctx,...b));
    for(let i=0;i<48;i++){const x=(i*173+51)%1160+20,y=(i*113+37)%1040+22;if((x>515&&x<700)||(y>440&&y<630)||((x>40&&x<255)&&(y>45&&y<210))||((x>900&&x<1165)&&(y>45&&y<220))||((x>55&&x<265)&&(y>620&&y<790))||((x>700&&x<900)&&(y>670&&y<825))||((x>950&&y>820)))continue;drawStoryTree(ctx,x,y,.72+(i%4)*.1);}
    // Story-mode landmarks make navigation readable instead of feeling like a test arena.
    ctx.fillStyle="rgba(15,23,42,.82)";roundRect(ctx,52,790,235,92,16);ctx.fill();ctx.strokeStyle="#67e8f9";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#cffafe";ctx.font="950 20px system-ui";ctx.textAlign="center";ctx.fillText("🛡️ BASE CAMP",170,825);ctx.font="800 14px system-ui";ctx.fillText("Respawn • Rally • Safe Start",170,852);
    ctx.fillStyle="rgba(15,23,42,.72)";roundRect(ctx,315,835,188,46,12);ctx.fill();ctx.fillStyle="#fee2e2";ctx.font="900 15px system-ui";ctx.fillText("🏥 MEDICAL POST",409,864);
    const ex=snap.extraction;ctx.fillStyle="rgba(34,197,94,.2)";ctx.strokeStyle="#4ade80";ctx.lineWidth=6;ctx.beginPath();ctx.arc(ex.x,ex.y,ex.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#dcfce7";ctx.font="950 18px system-ui";ctx.textAlign="center";ctx.fillText("SQUAD EXTRACTION",ex.x,ex.y+6);
    const guideTarget=nearestUnrescuedCivilian()||nearestActiveTiger()||ex;if(state.local&&guideTarget){ctx.strokeStyle="rgba(103,232,249,.55)";ctx.lineWidth=4;ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(state.local.x,state.local.y);ctx.lineTo(guideTarget.x,guideTarget.y);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle="rgba(103,232,249,.25)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(guideTarget.x,guideTarget.y,guideTarget.hpMax?(guideTarget.boss?178:164):82,0,Math.PI*2);ctx.stroke();}
    for(const civ of (snap.civilians||[])) drawStoryCivilian(ctx,civ,(snap.rescuedIds||[]).includes(civ.id));
    for(const tiger of (snap.tigers||[snap.boss]).filter(Boolean)) drawStoryTiger(ctx,tiger,now);
    for(const p of (snap.players||[])){
      const mine=Number(p.userId)===viewerId();const source=mine&&state.local?state.local:p;let draw=state.remoteDraw.get(p.userId)||{x:source.x,y:source.y};draw.x+=(Number(source.x)-draw.x)*.22;draw.y+=(Number(source.y)-draw.y)*.22;state.remoteDraw.set(p.userId,draw);
      ctx.globalAlpha=p.online===false?.5:1;drawStorySoldier(ctx,p,source,draw,mine);ctx.globalAlpha=1;
    }
    ctx.fillStyle="rgba(2,6,23,.78)";roundRect(ctx,18,18,330,50,12);ctx.fill();ctx.fillStyle="#d1fae5";ctx.font="950 16px system-ui";ctx.textAlign="left";ctx.fillText("STORY MAP • NIGHT FANG DISTRICT",34,49);
    ctx.fillStyle="rgba(2,6,23,.68)";roundRect(ctx,w-300,18,282,50,12);ctx.fill();ctx.fillStyle="#bfdbfe";ctx.textAlign="center";ctx.fillText("MISSION 1 • DAYLIGHT PATROL",w-159,49);
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


  const isTypingTarget = (target)=>!!target?.closest?.("input,textarea,select,[contenteditable='true']");
  window.addEventListener("keydown",(event)=>{ if(!state.open||isTypingTarget(event.target))return;const key=String(event.key||"").toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(key)){event.preventDefault();state.keys.add(key);} });
  window.addEventListener("keyup",(event)=>{ if(isTypingTarget(event.target))return;state.keys.delete(String(event.key||"").toLowerCase()); });
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
