(() => {
  "use strict";
  const API = "/api/squad/session";
  const ACTIVE_ROOM_STORAGE_PREFIX = "ts_live_squad_active_v1";
  const ACTIVE_ROOM_MAX_AGE_MS = 3 * 60 * 60 * 1000;
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
    equipmentOpen:"",
    equipmentResumePending:false,
    equipmentResumeTimer:0,
    camera:{ x:0, y:0, ready:false, worldKey:"" },
    move:{ up:false, down:false, left:false, right:false },
    keys:new Set(),
    priorPause:true,
    message:"Create a private squad or enter a teammate's six-character code.",
    error:"",
    storyMissionLevel:1,
    launchType:"shared-story",
  };
  const SHARED_STORY_LEVELS = Object.freeze([
    { level:1, title:"Escort 2 villagers", description:"Escort two villagers, clear two tigers, and extract." },
    { level:2, title:"Farm Road Rescue", description:"Escort three civilians while tigers attack the farm road." },
    { level:3, title:"First Tiger Encounter", description:"Kill or capture the first Story tiger together, then extract." },
    { level:4, title:"Jungle Hut Rescue", description:"Rescue three villagers trapped near the jungle huts." },
    { level:5, title:"Jungle Trail Escort", description:"Escort four civilians through the jungle trail." },
  ]);

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
  const sharedStoryActive = () => state.launchType === "shared-story" || state.snapshot?.launchType === "shared-story";
  const missionName = () => sharedStoryActive() ? `Shared Story Mission ${Math.max(1, Number(state.snapshot?.storyMissionLevel || state.storyMissionLevel || 1))}` : "Operation Night Fang";
  const missionMeta = () => state.snapshot?.mission || {};
  const rescueRequired = () => Math.max(0, Number(missionMeta().rescueRequired ?? (sharedStoryActive() ? 2 : 4)));
  const civilianCount = () => Math.max(rescueRequired(), Number(missionMeta().civilianCount ?? state.snapshot?.civilians?.length ?? 4));
  const selectedStoryMeta = () => SHARED_STORY_LEVELS.find((row)=>row.level === Math.max(1, Number(state.storyMissionLevel || 1))) || SHARED_STORY_LEVELS[0];
  const maxUnlockedSharedStoryLevel = () => clamp(Math.floor(Math.max(Number(window.S?.storyLastMission || 1), Number(window.S?.storyLevel || 1))), 1, 5);

  function equipmentButtonsHtml(){
    const active = state.snapshot?.status === "active";
    return `<div class="squadPrepBar">
      <div><b>🎒 Squad Gear</b><small>${active ? "Opening gear pauses the shared mission for both players." : "Buy supplies or arrange your loadout before deployment."}</small></div>
      <button type="button" class="squadBtn" data-squad-command="shop">🛒 Shop</button>
      <button type="button" class="squadBtn" data-squad-command="inventory">🎒 Inventory</button>
    </div>`;
  }

  function activeRoomStorageKey(){
    const userId = viewerId();
    return userId > 0 ? `${ACTIVE_ROOM_STORAGE_PREFIX}:${userId}` : "";
  }

  function persistActiveRoom(snapshot=state.snapshot){
    const key = activeRoomStorageKey();
    const code = cleanCode(snapshot?.code || state.code);
    if(!key || code.length !== 6) return;
    const record = {
      code,
      launchType:snapshot?.launchType === "shared-story" || state.launchType === "shared-story" ? "shared-story" : "live-squad",
      storyMissionLevel:Math.max(0, Math.floor(Number(snapshot?.storyMissionLevel || state.storyMissionLevel || 0))),
      savedAt:Date.now(),
    };
    try{ window.localStorage.setItem(key, JSON.stringify(record)); }catch(error){}
  }

  function readActiveRoom(){
    const key = activeRoomStorageKey();
    if(!key) return null;
    try{
      const record = JSON.parse(window.localStorage.getItem(key) || "null");
      if(!record || cleanCode(record.code).length !== 6 || Date.now() - Number(record.savedAt || 0) > ACTIVE_ROOM_MAX_AGE_MS){
        window.localStorage.removeItem(key);
        return null;
      }
      return {
        code:cleanCode(record.code),
        launchType:record.launchType === "shared-story" ? "shared-story" : "live-squad",
        storyMissionLevel:Math.max(0, Math.floor(Number(record.storyMissionLevel || 0))),
      };
    }catch(error){ return null; }
  }

  function clearActiveRoom(){
    const key = activeRoomStorageKey();
    if(!key) return;
    try{ window.localStorage.removeItem(key); }catch(error){}
  }

  function updateHeader(){
    const versionLabel = $("liveSquadVersionLabel");
    const titleLabel = $("liveSquadTitle");
    if(versionLabel) versionLabel.textContent = state.snapshot && sharedStoryActive()
      ? `Tiger Strike V6.0 • Story Mission ${Math.max(1, Number(state.storyMissionLevel || 1))}`
      : "Tiger Strike V6.0 • Co-op Home";
    if(titleLabel) titleLabel.textContent = state.snapshot && sharedStoryActive()
      ? `📖 Story Mission ${Math.max(1, Number(state.storyMissionLevel || 1))} — Two Player`
      : "🐅 Live Squad";
  }

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
    state.launchType = snapshot.launchType === "shared-story" ? "shared-story" : "live-squad";
    state.storyMissionLevel = Number(snapshot.storyMissionLevel || 0);
    state.code = cleanCode(snapshot.code);
    const worldKey = `${Number(snapshot.world?.width || 0)}x${Number(snapshot.world?.height || 0)}:${snapshot.status}`;
    if(state.camera.worldKey !== worldKey && snapshot.status === "active"){
      state.camera = { x:0, y:0, ready:false, worldKey };
    }
    persistActiveRoom(snapshot);
    updateHeader();
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
    set("squadBossHud", `${snap.boss?.boss ? `Alpha ${Math.round(snap.boss?.hp || 0)} HP` : `${activeThreats} tiger${activeThreats===1?"":"s"}`} • ${activeThreats} active`);
    set("squadCivHud", rescueRequired() > 0 ? `${snap.rescuedIds?.length || 0}/${rescueRequired()} escorted` : "No escort objective");
    set("squadMissionHud", snap.paused ? "PAUSED" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`);
    set("squadLivesHud", livesHudText());
    const connection = $("squadConnection");
    if(connection) connection.textContent = playerConnectionText();
    set("squadObjective", objectiveText());
    const pauseNotice = $("squadPauseNotice");
    if(pauseNotice){
      pauseNotice.hidden = !snap.paused;
      pauseNotice.textContent = snap.paused ? pauseSummary() : "";
    }
    document.querySelectorAll("#liveSquadOverlay [data-move]").forEach((button)=>{ button.disabled = !!snap.paused; });
    updateActionButtons();
  }

  function activeTigers(){ return (state.snapshot?.tigers || (state.snapshot?.boss ? [state.snapshot.boss] : [])).filter((t)=>!t.defeated && Number(t.hp || 0) > 0); }
  function nearestActiveTiger(){ return activeTigers().sort((a,b)=>distance(state.local,a)-distance(state.local,b))[0] || null; }
  function nearestUnrescuedCivilian(){
    if((state.snapshot?.rescuedIds || []).length >= rescueRequired()) return null;
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
    const unavailable = !!state.local.downed || !!state.snapshot?.paused;
    const captureReady = tiger && Number(tiger.hp || 0) <= Number(tiger.hpMax || 1) * 0.30;
    const unavailableLabel = state.snapshot?.paused ? "⏸️ Paused<br><small>Gear menu open</small>" : "⏳ Down<br><small>Recovery</small>";
    if(attack){ attack.innerHTML = unavailable ? unavailableLabel : (tiger ? (tigerNear ? (captureReady ? `🛟 Capture<br><small>${esc(tiger.type || "Tiger")}</small>` : `🎯 Attack<br><small>${esc(tiger.type || "Tiger")}</small>`) : `🐅 Move Closer<br><small>${Math.round(distance(state.local,tiger))}m</small>`) : "✅ Threat Clear"); attack.disabled = unavailable || !tiger; }
    if(rescue){ rescue.innerHTML = unavailable ? unavailableLabel : (civilian ? (civNear ? `🛟 Rescue<br><small>${esc(civilian.name || "Civilian")}</small>` : `👤 Find Civilian<br><small>${Math.round(distance(state.local,civilian))}m</small>`) : "✅ Civilians Safe"); rescue.disabled = unavailable || !civilian; }
    if(revive){ revive.innerHTML = unavailable ? unavailableLabel : (teammate?.downed ? (reviveNear ? "💚 Revive<br><small>Teammate</small>" : `💚 Reach Teammate<br><small>${Math.round(distance(state.local,teammate))}m</small>`) : "💚 Revive<br><small>Not needed</small>"); revive.disabled = unavailable || !teammate?.downed; }
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
        <div class="squadMemberMeta">❤️ Life ${Math.round(player.livesRemaining || 0)} • Tiger damage ${Math.round(Object.values(player.tigerDamage || {}).reduce((sum,value)=>sum+Number(value||0),0))} • Rescues ${(player.rescuedIds || []).length} • Revives ${Math.round(player.revives || 0)}</div>
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
        ${equipmentButtonsHtml()}
        <div class="squadMissionPicker" aria-label="Choose a two-player mission">
          ${SHARED_STORY_LEVELS.map((mission)=>`<button type="button" class="squadMissionChoice ${sharedStoryActive() && Number(state.storyMissionLevel) === mission.level ? "active" : ""}" ${mission.level > maxUnlockedSharedStoryLevel() ? "disabled" : ""} data-squad-command="select-story" data-squad-story-level="${mission.level}">
            <span>${mission.level > maxUnlockedSharedStoryLevel() ? "🔒" : "📖"} Story Mission ${mission.level}</span><small>${mission.level > maxUnlockedSharedStoryLevel() ? `Finish Mission ${mission.level - 1} first` : esc(mission.title)}</small>
          </button>`).join("")}
          <button type="button" class="squadMissionChoice ${sharedStoryActive() ? "" : "active"}" data-squad-command="select-operation">
            <span>🐅 Operation Night Fang</span><small>The original Live Squad rescue operation</small>
          </button>
        </div>
        <div class="squadHero">
          <div><div class="squadKicker">${sharedStoryActive() ? "V6.0 Shared Story" : "V6.0 Live Operation"}</div><div class="squadMissionName">${esc(missionName())}</div><div class="squadDesc">${sharedStoryActive() ? esc(selectedStoryMeta().description) : "Two real Telegram players enter an expanded Night Fang District with independent cameras, civilians, a tiger pack, an Alpha, field lives, mission restart, and synchronized gear access."}</div></div>
          <div class="squadCodeBox"><div class="squadSmall">PRIVATE TWO-PLAYER MISSION</div><div style="font-size:44px;margin:5px">🐅🐅</div><div class="squadSmall">One leader • One teammate</div></div>
        </div>
        <div class="squadRow"><button type="button" class="squadBtn good" data-squad-command="create">Create Squad</button></div>
        <div class="squadSmall squadJoinLabel">Enter the six-character code from your teammate</div>
        <div class="squadJoinRow"><input class="squadInput" id="squadJoinCode" value="${esc(state.joinDraft)}" maxlength="6" placeholder="ABC123" aria-label="Six-character squad code" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" inputmode="text" enterkeyhint="go"><button type="button" class="squadBtn" data-squad-command="paste-code">Paste</button><button type="button" class="squadBtn primary" data-squad-command="join">Join</button></div>
        <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
        <div class="squadSmall">Telegram requires both players to open the game through the Tiger Strike bot. If Telegram closes, Tiger Strike remembers this room and reconnects automatically when reopened. Rooms expire automatically.</div>
      </div>`;
    }
    const full = snapshot.memberCount >= 2;
    const waiting = snapshot.status === "waiting";
    return `<div class="squadPanel">
      ${equipmentButtonsHtml()}
      <div class="squadHero">
        <div><div class="squadKicker">${sharedStoryActive() ? "Private Shared Story Squad" : "Private Live Squad"}</div><div class="squadMissionName">${esc(missionName())}</div><div class="squadDesc">Choose a role. The squad leader starts when both players are connected.</div></div>
        <button type="button" class="squadCodeBox" data-squad-command="copy-code" aria-label="Copy squad code ${esc(snapshot.code)}"><span class="squadSmall">SQUAD CODE • TAP TO COPY</span><span class="squadCode">${esc(displayCode(snapshot.code))}</span><span class="squadSmall" id="squadMemberCount">${snapshot.memberCount}/2 players connected</span></button>
      </div>
      <div class="squadRoster" id="squadRoster">${rosterHtml()}</div>
      <div class="squadSmall">Choose your field role</div><div class="squadRoleGrid">${roleButtonsHtml()}</div>
      <details class="squadHowTo" open><summary>How ${sharedStoryActive() ? "Shared Story" : "Live Squad"} works</summary><div><b>1.</b> Cyan soldier = you. Purple soldier = your real teammate.<br><b>2.</b> Both phones see the same civilians, tigers, health, and extraction.<br><b>3.</b> Move near a person to Rescue, near a tiger to Attack, or near a downed teammate to Revive.<br><b>4.</b> ${sharedStoryActive() ? `${rescueRequired() > 0 ? `Escort ${rescueRequired()} civilians, ` : ""}clear the Story tigers, then extract together. Completion unlocks Story Mission ${Math.min(100, Number(state.storyMissionLevel || 1) + 1)} for both players.` : "Rescue all four, defeat Night Fang, then extract together."}</div></details>
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
    const required = rescueRequired();
    const activeThreats = (snap.tigers || []).filter((t)=>!t.defeated).length;
    const seconds = Math.max(0, Math.ceil(Number(snap?.timeLeftMs || 0) / 1000));
    const statusText = snap?.status === "complete" ? "MISSION COMPLETE" : (snap?.status === "failed" ? "MISSION FAILED" : (snap?.paused ? "PAUSED" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`));
    const controlsDisabled = snap?.paused ? "disabled" : "";
    return `<div class="squadPanel squadArenaPanel">
      ${equipmentButtonsHtml()}
      <div class="squadHud">
        <div class="squadHudCard"><div class="squadHudLabel">Tiger Threats</div><div class="squadHudValue" id="squadBossHud">${snap.boss?.boss ? `Alpha ${Math.round(snap.boss.hp)} HP` : `${activeThreats} Story tigers`} • ${activeThreats} active</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Civilians</div><div class="squadHudValue" id="squadCivHud">${required > 0 ? `${rescued}/${required} escorted` : "No escort objective"}</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Mission</div><div class="squadHudValue" id="squadMissionHud">${statusText}</div></div>
        <div class="squadHudCard"><div class="squadHudLabel">Field Lives</div><div class="squadHudValue" id="squadLivesHud">${esc(livesHudText())}</div></div>
      </div>
      <div class="squadStoryStrip"><span>📖 ${esc(missionMeta().title || missionName())}</span><span>🎯 ${esc(missionMeta().objective || "Shared objectives")}</span><span>🏘️ Shared Story District</span></div>
      <div class="squadConnection ${remoteSnapshotPlayer()?.online === false ? "bad" : ""}" id="squadConnection">${esc(playerConnectionText())}</div>
      <div class="squadPauseNotice" id="squadPauseNotice" ${snap?.paused ? "" : "hidden"}>${snap?.paused ? esc(pauseSummary()) : ""}</div>
      <div class="squadObjective" id="squadObjective">${objectiveText()}</div>
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadMapLegend"><span><i class="you"></i>You</span><span><i class="team"></i>Teammate</span><span>👤 Civilian</span><span>🐅 Tiger</span></div>
      <canvas id="squadArena" width="1200" height="760" aria-label="${esc(missionName())} expanded shared Story battlefield with a player-following camera"></canvas>
      <div class="squadBanner ${["complete","failed"].includes(snap.status) ? "show" : ""}" id="squadResultBanner">
        <div class="squadBannerTitle">${snap.status === "complete" ? "🏆 Squad Extracted!" : (snap.failureReason === "squad_wipe" ? "💀 Squad Wiped" : "⏱️ Operation Failed")}</div>
        <div class="squadBannerText">${snap.status === "complete" ? `${sharedStoryActive() ? `Story Mission ${Number(state.storyMissionLevel || 1)} completed together. Story Mission ${Math.min(100, Number(state.storyMissionLevel || 1) + 1)} unlocks when each player claims the result.` : "Both players cleared Operation Night Fang and extracted together."}` : (snap.failureReason === "squad_wipe" ? "Both soldiers used their field life and went down. The squad leader can restart this mission with both lives restored." : `Time expired. The squad leader can restart ${esc(missionName())}.`)}</div>
        ${snap.status === "complete" ? `<button type="button" class="squadBtn good" data-squad-command="claim">Claim Co-op Reward</button>` : ""}
        ${snap.status === "failed" && snap.isHost ? `<button type="button" class="squadBtn good" data-squad-command="restart">Restart Mission</button>` : ""}
        ${snap.status === "failed" && !snap.isHost ? `<button type="button" class="squadBtn" disabled>Waiting for Leader to Restart</button>` : ""}
        ${snap.status === "failed" ? `<button type="button" class="squadBtn" data-squad-command="leave">Back to Co-op Menu</button>` : `<div class="squadSmall">Claim your reward to save progress and return to the co-op menu.</div>`}
      </div>
      <div class="squadControls">
        <div class="squadDpad">
          <button type="button" class="squadPadBtn up" data-move="up" ${controlsDisabled}>▲</button><button type="button" class="squadPadBtn left" data-move="left" ${controlsDisabled}>◀</button><button type="button" class="squadPadBtn right" data-move="right" ${controlsDisabled}>▶</button><button type="button" class="squadPadBtn down" data-move="down" ${controlsDisabled}>▼</button>
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
    if(state.snapshot?.paused) return pauseSummary();
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
    if(snap.paused) return "Shared mission paused safely. The clock, tigers, movement, damage, and respawn timer are stopped.";
    const mine = localSnapshotPlayer();
    const respawn = respawnSeconds(mine);
    if(mine?.downed && respawn > 0) return `Recovery: Your field life is returning you to Base Camp in ${respawn}s.`;
    if(snap.failureReason === "squad_wipe") return "Squad wipe: Restart Mission restores both soldiers, both field lives, civilians, tigers, and the mission clock.";
    if(rescueRequired() > 0 && (snap.rescuedIds || []).length < rescueRequired()) return `Objective 1: ${missionMeta().objective || "Escort the civilians"} (${snap.rescuedIds.length}/${rescueRequired()} escorted).`;
    const threats = (snap.tigers || (snap.boss ? [snap.boss] : [])).filter((t)=>!t.defeated && Number(t.hp || 0) > 0);
    if(threats.length) return `Objective 2: Clear the Story tiger threat together (${threats.length} tiger${threats.length===1?"":"s"} active).`;
    const ready = snap.extractionReadyIds || [];
    return `Objective: Both players stand inside the green extraction circle (${ready.length}/2 ready).`;
  }

  function pauseSummary(){
    const pausedBy = state.snapshot?.pausedBy || [];
    if(!pausedBy.length) return "Squad mission paused for gear changes.";
    const labels = pausedBy.map((row)=>`${Number(row.userId) === viewerId() ? "You" : row.name} opened ${row.reason === "inventory" ? "Inventory" : "the Shop"}`);
    return `⏸️ ${labels.join(" • ")}. The mission resumes after every open gear screen is closed.`;
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
      "select-story":()=>selectMission("shared-story", Number(button?.dataset?.squadStoryLevel || 1)),
      "select-operation":()=>selectMission("live-squad"),
      create:()=>create(),
      join:()=>join(),
      role:()=>chooseRole(role),
      invite:()=>invite(),
      start:()=>start(),
      restart:()=>restart(),
      action:()=>action(actionName),
      shop:()=>openEquipment("shop"),
      inventory:()=>openEquipment("inventory"),
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

  function selectMission(launchType, storyLevel=1){
    if(state.snapshot) return;
    state.launchType = launchType === "shared-story" ? "shared-story" : "live-squad";
    state.storyMissionLevel = state.launchType === "shared-story" ? clamp(Math.floor(Number(storyLevel || 1)), 1, 5) : 0;
    state.message = state.launchType === "shared-story"
      ? `Story Mission ${state.storyMissionLevel} selected. Create a squad or enter your teammate's code.`
      : "Operation Night Fang selected. Create a squad or enter your teammate's code.";
    state.error = "";
    updateHeader();
    render();
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

  async function openEquipment(kind="shop"){
    const equipment = kind === "inventory" ? "inventory" : "shop";
    if(state.equipmentOpen) return;
    state.equipmentOpen = equipment;
    state.equipmentResumePending = false;
    window.clearTimeout(state.equipmentResumeTimer);
    try{
      if(state.snapshot?.status === "active"){
        setMessage(`Pausing the squad while you open ${equipment === "inventory" ? "Inventory" : "the Shop"}…`);
        await api("pause", { reason:equipment });
      }
      const liveOverlay = $("liveSquadOverlay");
      liveOverlay?.classList.remove("open");
      liveOverlay?.setAttribute("aria-hidden", "true");
      if(equipment === "inventory") window.openInventory?.();
      else window.openShop?.();
      const gearOverlay = $(equipment === "inventory" ? "invOverlay" : "shopOverlay");
      if(gearOverlay?.style?.display !== "flex") throw new Error(`${equipment === "inventory" ? "Inventory" : "Shop"} could not open. Please try again.`);
    }catch(error){
      state.equipmentOpen = "";
      const liveOverlay = $("liveSquadOverlay");
      liveOverlay?.classList.add("open");
      liveOverlay?.setAttribute("aria-hidden", "false");
      if(state.snapshot?.status === "active"){
        state.equipmentResumePending = true;
        finishEquipmentResume();
      }
      setMessage(error.message, true);
    }
  }

  async function finishEquipmentResume(){
    window.clearTimeout(state.equipmentResumeTimer);
    state.equipmentResumeTimer = 0;
    if(!state.equipmentResumePending || !state.code || state.snapshot?.status !== "active"){
      state.equipmentResumePending = false;
      return;
    }
    try{
      await api("resume");
      state.equipmentResumePending = false;
      setMessage(state.snapshot?.paused ? pauseSummary() : "Squad mission resumed. Both players can continue.");
    }catch(error){
      setMessage(`${error.message} Tiger Strike will keep trying to return you safely.`, true);
      state.equipmentResumeTimer = window.setTimeout(finishEquipmentResume, 1500);
    }
  }

  function returnFromEquipment(kind=""){
    const equipment = kind === "inventory" ? "inventory" : "shop";
    if(state.equipmentOpen !== equipment) return false;
    state.equipmentOpen = "";
    const liveOverlay = $("liveSquadOverlay");
    liveOverlay?.classList.add("open");
    liveOverlay?.setAttribute("aria-hidden", "false");
    render();
    if(state.snapshot?.status === "active"){
      setMessage("Returning to your squad…");
      state.equipmentResumePending = true;
      finishEquipmentResume();
    }else{
      setMessage("Gear saved. Continue preparing your squad.");
    }
    return true;
  }

  function open(opts={}){
    if(!state.open){
      try{ window.prepareLiveSquadHub?.(); }catch(error){}
    }
    const overlay = $("liveSquadOverlay");
    if(!overlay) return;
    const requestedStoryLevel = Math.max(0, Math.floor(Number(opts?.storyMissionLevel || 0)));
    if(!state.snapshot){
      if(requestedStoryLevel >= 1 && requestedStoryLevel <= 5){
        state.storyMissionLevel = requestedStoryLevel;
        state.launchType = "shared-story";
      }else if(opts?.launchType === "live-squad"){
        state.storyMissionLevel = 0;
        state.launchType = "live-squad";
      }
    }
    updateHeader();
    bindOverlay();
    state.open = true;
    state.priorPause = !!window.S?.paused;
    if(window.S && !state.priorPause){ window.S.paused = true; window.S.pauseReason = "live-squad"; }
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden","false");
    render();
    if(!hasTelegramAuth()) setMessage(sharedStoryActive()
      ? "Open Tiger Strike inside Telegram to create or join this two-player Story mission."
      : "Open Tiger Strike inside Telegram to create or join a live squad.", true);
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
    try{ window.returnToLiveSquadMenuBackground?.(); }catch(error){}
  }

  async function create(){
    if(!hasTelegramAuth()) return setMessage("Please open the game inside Telegram first.", true);
    try{
      setMessage("Creating your private squad…");
      const payload = await api("create", {
        storyMissionLevel:state.storyMissionLevel,
        launchType:state.launchType,
      });
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
    const text = String(shareText || state.inviteText || `Join my live Tiger Strike squad for ${missionName()}. Code: ${state.code}`);
    const url = `https://t.me/share/url?url=${encodeURIComponent(playUrl || state.inviteUrl || "")}&text=${encodeURIComponent(text)}`;
    if(typeof tgApp?.openTelegramLink === "function") tgApp.openTelegramLink(url);
    else window.open(url,"_blank","noopener");
  }

  async function start(){
    if(Number(state.snapshot?.memberCount || 0) < 2){
      setMessage("Start Mission needs 2/2 players. Invite one teammate or have them join with the code first.", true);
      return;
    }
    try{ setMessage("Deploying both players…"); await api("start"); setMessage(`${missionName()} is live.`); ensureFrame(); }
    catch(error){ setMessage(error.message, true); }
  }

  async function restart(){
    if(!state.snapshot?.isHost) return setMessage("Only the squad leader can restart the mission.", true);
    try{
      setMessage(`Restarting ${missionName()} with both field lives restored…`);
      await api("restart");
      setMessage("Mission restarted. Both soldiers are back at Base Camp.");
      ensureFrame();
    }catch(error){ setMessage(error.message, true); }
  }

  async function action(kind){
    if(state.actionBusy || state.snapshot?.status !== "active" || state.snapshot?.paused) return;
    state.actionBusy = true;
    try{
      // Send the newest local position before judging action range. This keeps
      // a fast move-then-tap from being rejected using an older server position.
      if(state.local){
        await api("sync", { player:{ x:state.local.x, y:state.local.y, face:state.local.face } });
        state.lastSyncAt = Date.now();
      }
      const extra = {};
      let apiAction = kind;
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
        if(Number(target.hp || 0) <= Number(target.hpMax || 1) * 0.30) apiAction = "capture";
      }
      await api(apiAction, extra);
      setMessage(apiAction === "capture" ? "Tiger captured together!" : (kind === "rescue" ? "Civilian secured!" : (kind === "revive" ? "Teammate revived!" : "Hit confirmed.")));
    }catch(error){ setMessage(error.message, true); }
    finally{ state.actionBusy = false; }
  }

  async function claim(){
    try{
      const payload = await api("claim");
      applyReward(payload.reward);
      returnToCoopMenu("Co-op reward claimed and saved. Choose another mission when you are ready.");
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
    try{ if(typeof window.grantSeasonPassPoints === "function") window.grantSeasonPassPoints(Number(data.reward.seasonPoints || 0), missionName()); }catch(error){}
    try{
      if(data.storyProgress && typeof window.applySharedStoryCompletion === "function"){
        window.applySharedStoryCompletion(data.storyProgress, data.receipt);
      }
    }catch(error){}
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

  function resetRoomState(){
    state.roomEpoch += 1;
    state.pending.clear();
    state.code = "";
    state.joinDraft = "";
    state.inviteUrl = "";
    state.inviteText = "";
    state.snapshot = null;
    state.local = null;
    state.remoteDraw.clear();
    state.camera = { x:0, y:0, ready:false, worldKey:"" };
    state.equipmentOpen = "";
    state.equipmentResumePending = false;
    window.clearTimeout(state.equipmentResumeTimer);
    state.equipmentResumeTimer = 0;
    clearActiveRoom();
  }

  function returnToCoopMenu(message="Choose a two-player mission, then create or join a private squad."){
    stopPolling();
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    Object.keys(state.move).forEach((key)=>{ state.move[key] = false; });
    resetRoomState();
    state.message = message;
    state.error = "";
    try{ window.prepareLiveSquadHub?.(); }catch(error){}
    updateHeader();
    if(!state.open) open();
    else render();
  }

  async function leave(){
    const oldCode = state.code;
    if(oldCode){
      try{ await api("leave", { code:oldCode }); }catch(error){}
    }
    returnToCoopMenu("You left the squad. Choose a mission when you are ready to play again.");
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
    if(!state.local || state.local.downed || state.snapshot?.status !== "active" || state.snapshot?.paused) return;
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

  function drawExpandedDistrict(ctx, snap, view){
    const worldW = Math.max(view.w, Number(snap.world?.width || view.w));
    const worldH = Math.max(view.h, Number(snap.world?.height || view.h));
    const roadW = 112;
    const verticalRoads = [worldW*.28, worldW*.54, worldW*.81];
    const horizontalRoads = [worldH*.24, worldH*.50, worldH*.76];
    const riverTop = worldH*.88;
    const visible = (x,y,pad=120)=>x >= view.x-pad && x <= view.x+view.w+pad && y >= view.y-pad && y <= view.y+view.h+pad;
    const nearRoad = (x,y,pad=75)=>verticalRoads.some((road)=>Math.abs(x-road)<pad)||horizontalRoads.some((road)=>Math.abs(y-road)<pad);

    const terrain=ctx.createLinearGradient(0,0,0,worldH);terrain.addColorStop(0,"#3f7b4d");terrain.addColorStop(.52,"#2f6944");terrain.addColorStop(1,"#24583c");ctx.fillStyle=terrain;ctx.fillRect(view.x,view.y,view.w,view.h);
    ctx.fillStyle="rgba(102,164,91,.20)";
    const tileW=132,tileH=96,startX=Math.floor(view.x/tileW)*tileW,startY=Math.floor(view.y/tileH)*tileH;
    for(let y=startY;y<view.y+view.h+tileH;y+=tileH){for(let x=startX;x<view.x+view.w+tileW;x+=tileW){ctx.fillRect(x+(((y/tileH)|0)%2)*28,y,96,68);}}

    ctx.fillStyle="rgba(35,117,145,.80)";ctx.beginPath();ctx.moveTo(0,riverTop);
    for(let x=0;x<=worldW+180;x+=180){ctx.lineTo(x,riverTop+Math.sin((x/worldW)*Math.PI*5)*42);}
    ctx.lineTo(worldW,worldH);ctx.lineTo(0,worldH);ctx.closePath();ctx.fill();

    ctx.fillStyle="#4b5563";
    for(const y of horizontalRoads) ctx.fillRect(0,y-roadW/2,worldW,roadW);
    for(const x of verticalRoads) ctx.fillRect(x-roadW/2,0,roadW,worldH);
    ctx.strokeStyle="rgba(241,245,249,.58)";ctx.lineWidth=4;
    for(const y of horizontalRoads){ctx.beginPath();ctx.moveTo(0,y-roadW/2+8);ctx.lineTo(worldW,y-roadW/2+8);ctx.moveTo(0,y+roadW/2-8);ctx.lineTo(worldW,y+roadW/2-8);ctx.stroke();}
    for(const x of verticalRoads){ctx.beginPath();ctx.moveTo(x-roadW/2+8,0);ctx.lineTo(x-roadW/2+8,worldH);ctx.moveTo(x+roadW/2-8,0);ctx.lineTo(x+roadW/2-8,worldH);ctx.stroke();}
    ctx.strokeStyle="rgba(250,204,21,.78)";ctx.lineWidth=5;ctx.setLineDash([34,28]);
    for(const y of horizontalRoads){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(worldW,y);ctx.stroke();}
    for(const x of verticalRoads){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,worldH);ctx.stroke();}
    ctx.setLineDash([]);

    for(const roadX of verticalRoads){
      const bridgeY=riverTop-34;ctx.fillStyle="#765a3b";ctx.fillRect(roadX-roadW*.63,bridgeY,roadW*1.26,94);ctx.strokeStyle="#e8c178";ctx.lineWidth=6;
      for(let x=roadX-roadW*.52;x<roadX+roadW*.53;x+=24){ctx.beginPath();ctx.moveTo(x,bridgeY-8);ctx.lineTo(x,bridgeY+102);ctx.stroke();}
    }

    for(let i=0;i<240;i++){
      const x=70+((i*337+53)%Math.max(100,Math.floor(worldW-140)));
      const y=80+((i*191+97)%Math.max(100,Math.floor(worldH-180)));
      if(!visible(x,y,70)||nearRoad(x,y,88)||y>riverTop-55) continue;
      drawStoryTree(ctx,x,y,.68+(i%5)*.075);
    }
    const roofColors=["#9a5c38","#7c4a32","#72452f","#a1623c"];
    for(let i=0;i<34;i++){
      const x=100+((i*421+160)%Math.max(140,Math.floor(worldW-280)));
      const y=110+((i*263+120)%Math.max(140,Math.floor(riverTop-260)));
      if(!visible(x,y,210)||nearRoad(x+80,y+52,125)) continue;
      drawStoryBuilding(ctx,x,y,142+(i%3)*14,88+(i%2)*12,roofColors[i%roofColors.length]);
    }

    const spawns=(snap.spawns||snap.players||[]).map((player)=>({x:Number(player.x||0),y:Number(player.y||0)}));
    const baseX=spawns.length?spawns.reduce((sum,row)=>sum+row.x,0)/spawns.length:worldW*.12;
    const baseY=spawns.length?spawns.reduce((sum,row)=>sum+row.y,0)/spawns.length:worldH*.78;
    if(visible(baseX,baseY,260)){
      ctx.fillStyle="rgba(15,23,42,.86)";roundRect(ctx,baseX-118,baseY-112,236,78,16);ctx.fill();ctx.strokeStyle="#67e8f9";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#cffafe";ctx.font="950 19px system-ui";ctx.textAlign="center";ctx.fillText("🛡️ BASE CAMP",baseX,baseY-82);ctx.font="800 13px system-ui";ctx.fillText("Respawn • Rally • Safe Start",baseX,baseY-57);
    }

    const ex=snap.extraction;ctx.fillStyle="rgba(34,197,94,.23)";ctx.strokeStyle="#4ade80";ctx.lineWidth=6;ctx.beginPath();ctx.arc(ex.x,ex.y,ex.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle="#dcfce7";ctx.font="950 18px system-ui";ctx.textAlign="center";ctx.fillText("SQUAD EXTRACTION",ex.x,ex.y+6);
    const guideTarget=nearestUnrescuedCivilian()||nearestActiveTiger()||ex;
    if(state.local&&guideTarget){ctx.strokeStyle="rgba(103,232,249,.62)";ctx.lineWidth=4;ctx.setLineDash([12,11]);ctx.beginPath();ctx.moveTo(state.local.x,state.local.y);ctx.lineTo(guideTarget.x,guideTarget.y);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle="rgba(103,232,249,.30)";ctx.lineWidth=3;ctx.beginPath();ctx.arc(guideTarget.x,guideTarget.y,guideTarget.hpMax?(guideTarget.boss?178:164):82,0,Math.PI*2);ctx.stroke();}
    ctx.strokeStyle="rgba(191,219,254,.7)";ctx.lineWidth=8;ctx.strokeRect(4,4,worldW-8,worldH-8);
  }

  function drawCoopMiniMap(ctx,snap,view,canvasW){
    const worldW=Math.max(1,Number(snap.world?.width||1)),worldH=Math.max(1,Number(snap.world?.height||1));
    const mw=220,mh=128,mx=canvasW-mw-18,my=18,sx=mw/worldW,sy=mh/worldH;
    ctx.fillStyle="rgba(2,6,23,.88)";roundRect(ctx,mx,my,mw,mh,12);ctx.fill();ctx.strokeStyle="#60a5fa";ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle="rgba(250,204,21,.45)";ctx.lineWidth=2;
    for(const x of [worldW*.28,worldW*.54,worldW*.81]){ctx.beginPath();ctx.moveTo(mx+x*sx,my);ctx.lineTo(mx+x*sx,my+mh);ctx.stroke();}
    for(const y of [worldH*.24,worldH*.50,worldH*.76]){ctx.beginPath();ctx.moveTo(mx,my+y*sy);ctx.lineTo(mx+mw,my+y*sy);ctx.stroke();}
    ctx.fillStyle="#4ade80";ctx.beginPath();ctx.arc(mx+snap.extraction.x*sx,my+snap.extraction.y*sy,5,0,Math.PI*2);ctx.fill();
    for(const civ of (snap.civilians||[])){if((snap.rescuedIds||[]).includes(civ.id))continue;ctx.fillStyle="#e0f2fe";ctx.fillRect(mx+civ.x*sx-2,my+civ.y*sy-2,4,4);}
    for(const tiger of (snap.tigers||[])){if(tiger.defeated)continue;ctx.fillStyle="#fb923c";ctx.beginPath();ctx.arc(mx+tiger.x*sx,my+tiger.y*sy,tiger.boss?5:3.5,0,Math.PI*2);ctx.fill();}
    for(const player of (snap.players||[])){const mine=Number(player.userId)===viewerId();const src=mine&&state.local?state.local:player;ctx.fillStyle=mine?"#22d3ee":"#a78bfa";ctx.beginPath();ctx.arc(mx+src.x*sx,my+src.y*sy,5,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle="#f8fafc";ctx.lineWidth=1.5;ctx.strokeRect(mx+view.x*sx,my+view.y*sy,Math.min(mw,view.w*sx),Math.min(mh,view.h*sy));
    ctx.fillStyle="#dbeafe";ctx.font="900 11px system-ui";ctx.textAlign="center";ctx.fillText("LIVE DISTRICT MAP",mx+mw/2,my+mh-7);
  }

  function drawOffscreenTeammate(ctx,snap,view,w,h){
    const teammate=remoteSnapshotPlayer();
    if(!teammate||!state.local)return;
    const sx=Number(teammate.x)-view.x,sy=Number(teammate.y)-view.y;
    if(sx>=42&&sx<=w-42&&sy>=42&&sy<=h-42)return;
    const dx=Number(teammate.x)-Number(state.local.x),dy=Number(teammate.y)-Number(state.local.y),angle=Math.atan2(dy,dx);
    const cx=w/2,cy=h/2,limitX=w/2-54,limitY=h/2-54,scale=Math.min(limitX/Math.max(1,Math.abs(dx)),limitY/Math.max(1,Math.abs(dy)));
    const x=clamp(cx+dx*scale,54,w-54),y=clamp(cy+dy*scale,54,h-54);
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle="#a78bfa";ctx.strokeStyle="#ede9fe";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(20,0);ctx.lineTo(-12,-12);ctx.lineTo(-7,0);ctx.lineTo(-12,12);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    ctx.fillStyle="rgba(2,6,23,.82)";roundRect(ctx,x-52,y+19,104,24,9);ctx.fill();ctx.fillStyle="#ede9fe";ctx.font="900 11px system-ui";ctx.textAlign="center";ctx.fillText(`TEAM ${Math.round(Math.hypot(dx,dy))}m`,x,y+35);
  }

  function drawArena(){
    const canvas=$("squadArena"),snap=state.snapshot;if(!canvas||!snap)return;
    const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height,now=Number(snap.serverNow||Date.now());
    const worldW=Math.max(w,Number(snap.world?.width||w)),worldH=Math.max(h,Number(snap.world?.height||h));
    const focus=state.local||localSnapshotPlayer()||{x:worldW*.5,y:worldH*.5};
    const targetX=clamp(Number(focus.x)-w*.5,0,Math.max(0,worldW-w)),targetY=clamp(Number(focus.y)-h*.5,0,Math.max(0,worldH-h));
    if(!state.camera.ready){state.camera.x=targetX;state.camera.y=targetY;state.camera.ready=true;}
    else{state.camera.x+=(targetX-state.camera.x)*.16;state.camera.y+=(targetY-state.camera.y)*.16;}
    const view={x:state.camera.x,y:state.camera.y,w,h};ctx.clearRect(0,0,w,h);ctx.save();ctx.translate(-view.x,-view.y);
    drawExpandedDistrict(ctx,snap,view);
    for(const civ of (snap.civilians||[])) drawStoryCivilian(ctx,civ,(snap.rescuedIds||[]).includes(civ.id));
    for(const tiger of (snap.tigers||[snap.boss]).filter(Boolean)) drawStoryTiger(ctx,tiger,now);
    for(const p of (snap.players||[])){
      const mine=Number(p.userId)===viewerId(),source=mine&&state.local?state.local:p;let draw=state.remoteDraw.get(p.userId)||{x:source.x,y:source.y};draw.x+=(Number(source.x)-draw.x)*.22;draw.y+=(Number(source.y)-draw.y)*.22;state.remoteDraw.set(p.userId,draw);
      ctx.globalAlpha=p.online===false?.5:1;drawStorySoldier(ctx,p,source,draw,mine);ctx.globalAlpha=1;
    }
    ctx.restore();
    ctx.fillStyle="rgba(2,6,23,.84)";roundRect(ctx,18,18,350,54,12);ctx.fill();ctx.fillStyle="#d1fae5";ctx.font="950 16px system-ui";ctx.textAlign="left";ctx.fillText(sharedStoryActive()?"EXPANDED STORY DISTRICT":"EXPANDED NIGHT FANG",34,43);ctx.fillStyle="#93c5fd";ctx.font="850 12px system-ui";ctx.fillText(`${Math.round(worldW/100)/10}km × ${Math.round(worldH/100)/10}km • CAMERA FOLLOW`,34,61);
    drawCoopMiniMap(ctx,snap,view,w);drawOffscreenTeammate(ctx,snap,view,w,h);
  }

  function startParam(){
    const direct = String(tgApp?.initDataUnsafe?.start_param || "").trim();
    if(direct) return direct;
    try{ const params=new URLSearchParams(location.search);return String(params.get("tgWebAppStartParam")||params.get("startapp")||"").trim(); }catch(error){ return ""; }
  }
  async function resumeSavedRoom(record){
    if(!record || !hasTelegramAuth()) return;
    state.code = cleanCode(record.code);
    state.launchType = record.launchType === "shared-story" ? "shared-story" : "live-squad";
    state.storyMissionLevel = Math.max(0, Math.floor(Number(record.storyMissionLevel || 0)));
    open({ storyMissionLevel:state.storyMissionLevel, launchType:state.launchType });
    setMessage(`Reconnecting to ${missionName()}…`);
    try{
      await api("status", { code:state.code });
      setMessage(state.snapshot?.status === "active"
        ? `Reconnected to ${missionName()}. Continue with your teammate.`
        : `Reconnected to ${missionName()}.`);
      startPolling();
    }catch(error){
      resetRoomState();
      state.message = "Your previous squad has ended or expired. Create a new squad or enter a teammate's code.";
      state.error = "";
      updateHeader();
      render();
    }
  }
  function autoJoinFromTelegram(){
    if(!hasTelegramAuth()) return;
    const match=startParam().match(/^squad_([A-Z0-9]{6})$/i);
    if(match){
      window.setTimeout(()=>{ open(); join(match[1]); },1400);
      return;
    }
    const savedRoom = readActiveRoom();
    if(savedRoom) window.setTimeout(()=>resumeSavedRoom(savedRoom),1400);
  }


  const isTypingTarget = (target)=>!!target?.closest?.("input,textarea,select,[contenteditable='true']");
  window.addEventListener("keydown",(event)=>{ if(!state.open||isTypingTarget(event.target))return;const key=String(event.key||"").toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright","w","a","s","d"].includes(key)){event.preventDefault();state.keys.add(key);} });
  window.addEventListener("keyup",(event)=>{ if(isTypingTarget(event.target))return;state.keys.delete(String(event.key||"").toLowerCase()); });
  window.openLiveSquadOps=open;
  window.openLiveSquadStoryMission=(storyMissionLevel=1)=>open({ storyMissionLevel });
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
  window.TigerLiveSquad = Object.freeze({
    returnFromEquipment,
    equipmentOpen:()=>state.equipmentOpen,
    isOpen:()=>state.open,
  });
  window.addEventListener("load",autoJoinFromTelegram,{once:true});
})();
