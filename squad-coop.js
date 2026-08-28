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
    hubSection:"home",
  };
  const SHARED_STORY_LEVELS = Object.freeze([
    { level:1, title:"Escort 2 villagers", description:"Escort two villagers, clear two tigers, and extract." },
    { level:2, title:"Farm Road Rescue", description:"Escort three civilians while tigers attack the farm road." },
    { level:3, title:"First Tiger Encounter", description:"Kill or capture the first Story tiger together, then extract." },
    { level:4, title:"Jungle Hut Rescue", description:"Rescue three villagers trapped near the jungle huts." },
    { level:5, title:"Jungle Trail Escort", description:"Escort four civilians through the jungle trail." },
  ]);
  const SPECIAL_OPERATIONS = Object.freeze([
    {
      id:"live-squad",
      icon:"🐅",
      title:"Operation Night Fang",
      short:"Rescue 4 civilians, clear the tiger pack, defeat Night Fang Alpha, and extract together.",
      description:"An expanded team district with civilians, a roaming tiger pack, an Alpha boss, field lives, revives, restart, shared extraction, Shop, and Inventory.",
      reward:"$6,500 • 1 perk point • 12 season points • Night Fang First Response badge",
      mapLabel:"Night Fang District",
    },
    {
      id:"tiger-den",
      icon:"🪨",
      title:"Tiger Den Assault",
      short:"Rescue 2 trapped specialists, clear 3 den guards, defeat Stoneclaw Alpha, and extract.",
      description:"Enter the Cave Wilds on a larger eight-minute assault. Fight through den sentries and armored guards, rescue both trapped specialists, defeat Stoneclaw Alpha, then extract together.",
      reward:"$8,200 • 2 perk points • 16 season points • Stoneclaw Den Breaker badge",
      mapLabel:"Cave Wilds",
    },
    {
      id:"village-siege",
      icon:"🏘️",
      title:"Village Siege",
      short:"Rescue 5 trapped villagers, clear 4 siege tigers, defeat Ironmane Alpha, and extract.",
      description:"Fight across the bright Suncrest Village battlefield during a nine-minute siege. Rescue the elder, teacher, vendor, nurse, and gate keeper, break the four-tiger siege pack, defeat Ironmane Alpha, then extract together.",
      reward:"$9,600 • 2 perk points • 20 season points • Suncrest Village Shield badge",
      mapLabel:"Suncrest Village",
    },
    {
      id:"convoy-rescue",
      icon:"🚚",
      title:"Convoy Rescue",
      short:"Rescue 4 stranded crew, clear 4 ambush tigers, defeat Roadclaw Alpha, and extract.",
      description:"Push through the ten-minute Redwood Convoy Route operation. Rescue the driver, medic, mechanic, and dispatcher, clear the four-tiger road ambush, defeat Roadclaw Alpha, then extract together.",
      reward:"$11,200 • 3 perk points • 24 season points • Redwood Convoy Guardian badge",
      mapLabel:"Redwood Convoy Route",
    },
    {
      id:"alpha-hunt",
      icon:"🎯",
      title:"Alpha Hunt",
      short:"Rescue 2 injured trackers, clear 3 elite tigers, defeat Ghoststripe Alpha, and extract.",
      description:"Enter the Moonshadow Highlands for an eleven-minute apex hunt. Rescue both injured trackers, clear the three elite tigers protecting the range, defeat Ghoststripe Alpha, then extract together.",
      reward:"$13,000 • 3 perk points • 28 season points • Ghoststripe Apex Hunter badge",
      mapLabel:"Moonshadow Highlands",
    },
    {
      id:"storm-extraction",
      icon:"⛈️",
      title:"Storm Extraction",
      short:"Rescue 3 evacuation specialists, clear 4 storm tigers, defeat Tempest Alpha, and extract.",
      description:"Cross the flooded Tempest Coast during a twelve-minute severe-weather operation. Rescue the pilot, engineer, and weather officer, clear the four-tiger storm pack, defeat Tempest Alpha, then reach storm extraction together.",
      reward:"$15,000 • 4 perk points • 32 season points • Tempest Coast Lifeline badge",
      mapLabel:"Tempest Coast",
    },
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
  const normalizeLaunchType = (value) => {
    const type = String(value || "").trim().toLowerCase();
    return type === "shared-story" || SPECIAL_OPERATIONS.some((operation)=>operation.id === type) ? type : "live-squad";
  };
  const sharedStoryActive = () => state.launchType === "shared-story" || state.snapshot?.launchType === "shared-story";
  const selectedOperation = () => SPECIAL_OPERATIONS.find((operation)=>operation.id === normalizeLaunchType(state.snapshot?.launchType || state.launchType)) || SPECIAL_OPERATIONS[0];
  const missionName = () => sharedStoryActive() ? `Shared Story Mission ${Math.max(1, Number(state.snapshot?.storyMissionLevel || state.storyMissionLevel || 1))}` : selectedOperation().title;
  const missionMeta = () => state.snapshot?.mission || {};
  const rescueRequired = () => Math.max(0, Number(missionMeta().rescueRequired ?? (sharedStoryActive() ? 2 : 4)));
  const maxUnlockedStoryLevel = () => clamp(Math.floor(Math.max(Number(window.S?.storyLastMission || 1), Number(window.S?.storyLevel || 1))), 1, 100);
  const twoPlayerStoryReady = (level=state.storyMissionLevel) => Math.max(1, Math.floor(Number(level || 1))) <= SHARED_STORY_LEVELS.length;
  const selectedStoryDescription = () => {
    const level = Math.max(1, Math.floor(Number(state.storyMissionLevel || 1)));
    const converted = SHARED_STORY_LEVELS.find((row)=>row.level === level);
    return converted?.description || `Story Mission ${level} is available Solo. Its Two Player version has not been converted yet.`;
  };

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
      launchType:normalizeLaunchType(snapshot?.launchType || state.launchType),
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
        launchType:normalizeLaunchType(record.launchType),
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
      ? `Tiger Strike V6.6 • Story Mission ${Math.max(1, Number(state.storyMissionLevel || 1))}`
      : (state.snapshot ? `Tiger Strike V6.6 • ${selectedOperation().mapLabel}` : "Tiger Strike V6.6 • Co-op Command");
    if(titleLabel) titleLabel.textContent = state.snapshot && sharedStoryActive()
      ? `📖 Story Mission ${Math.max(1, Number(state.storyMissionLevel || 1))} — Two Player`
      : (state.snapshot ? `${selectedOperation().icon} ${selectedOperation().title}` : (state.hubSection === "story" ? "📖 Story Campaign" : (state.hubSection === "operations" ? "🐅 Special Operations" : "🐅 Live Squad")));
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
    state.launchType = normalizeLaunchType(snapshot.launchType);
    state.hubSection = state.launchType === "shared-story" ? "story" : "operations";
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
      if(state.hubSection === "story") return storyCampaignLandingHtml();
      if(state.hubSection === "operations") return specialOperationsLandingHtml();
      return coopHomeHtml();
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
      <details class="squadHowTo" open><summary>How ${sharedStoryActive() ? "Shared Story" : selectedOperation().title} works</summary><div><b>1.</b> Cyan soldier = you. Purple soldier = your real teammate.<br><b>2.</b> Both phones see the same civilians, tigers, health, and extraction.<br><b>3.</b> Move near a person to Rescue, near a tiger to Attack, or near a downed teammate to Revive.<br><b>4.</b> ${sharedStoryActive() ? `${rescueRequired() > 0 ? `Escort ${rescueRequired()} civilians, ` : ""}clear the Story tigers, then extract together. Completion unlocks Story Mission ${Math.min(100, Number(state.storyMissionLevel || 1) + 1)} for both players.` : `${esc(missionMeta().objective || selectedOperation().short)} Special Operation progress stays separate from Story.`}</div></details>
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

  function joinSquadHtml(){
    return `<div class="squadJoinCard">
      <div><div class="squadKicker">Already invited?</div><div class="squadSectionTitle">Join a teammate</div><div class="squadSmall">A squad code automatically opens the correct Story mission or Special Operation.</div></div>
      <div class="squadJoinRow"><input class="squadInput" id="squadJoinCode" value="${esc(state.joinDraft)}" maxlength="6" placeholder="ABC123" aria-label="Six-character squad code" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" inputmode="text" enterkeyhint="go"><button type="button" class="squadBtn" data-squad-command="paste-code">Paste</button><button type="button" class="squadBtn primary" data-squad-command="join">Join</button></div>
    </div>`;
  }

  function coopHomeHtml(){
    const storyMax = maxUnlockedStoryLevel();
    return `<div class="squadPanel">
      ${equipmentButtonsHtml()}
      <div class="squadHomeHero"><div class="squadKicker">V6.6 Co-op Paths</div><div class="squadMissionName">Choose how you want to play</div><div class="squadDesc">Story Campaign keeps your normal Story progress. Special Operations are separate replayable team challenges.</div></div>
      <div class="squadPathGrid">
        <button type="button" class="squadPathCard story" data-squad-command="hub-story">
          <span class="squadPathIcon">📖</span><span class="squadPathTitle">Story Campaign</span>
          <small>Pick a Story mission, then choose Solo or Two Players. Solo supports all ${storyMax} unlocked mission${storyMax === 1 ? "" : "s"}; Two Player is ready for Missions 1–5.</small>
          <b>Open Story Campaign →</b>
        </button>
        <button type="button" class="squadPathCard ops" data-squad-command="hub-operations">
          <span class="squadPathIcon">🐅</span><span class="squadPathTitle">Special Operations</span>
          <small>Replayable team missions with their own maps, bosses, badges, and rewards. They do not move or replace Story progress.</small>
          <b>Open Special Operations →</b>
        </button>
      </div>
      ${joinSquadHtml()}
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadSmall">Both players must open Tiger Strike through the Telegram bot. Active rooms reconnect automatically when the game is reopened.</div>
    </div>`;
  }

  function storyLevelButtonsHtml(){
    const max = maxUnlockedStoryLevel();
    const selected = clamp(Math.floor(Number(state.storyMissionLevel || 1)), 1, max);
    const start = Math.max(1, selected - 2);
    const end = Math.min(max, Math.max(selected + 2, Math.min(max, 5)));
    const levels = [];
    for(let level=start; level<=end; level++){
      const meta = SHARED_STORY_LEVELS.find((row)=>row.level === level);
      levels.push(`<button type="button" class="squadMissionChoice ${selected === level ? "active" : ""}" data-squad-command="select-story" data-squad-story-level="${level}">
        <span>📖 Story Mission ${level}</span><small>${esc(meta?.title || (level <= SHARED_STORY_LEVELS.length ? "Two Player ready" : "Solo ready • Two Player conversion pending"))}</small>
      </button>`);
    }
    return `<div class="squadLevelNav">
      <button type="button" class="squadBtn" data-squad-command="select-story" data-squad-story-level="1">First</button>
      <button type="button" class="squadBtn" data-squad-command="select-story" data-squad-story-level="${Math.max(1, selected - 1)}" ${selected <= 1 ? "disabled" : ""}>← Previous</button>
      <span>Unlocked ${max}/100</span>
      <button type="button" class="squadBtn" data-squad-command="select-story" data-squad-story-level="${Math.min(max, selected + 1)}" ${selected >= max ? "disabled" : ""}>Next →</button>
      <button type="button" class="squadBtn" data-squad-command="select-story" data-squad-story-level="${max}">Current</button>
    </div><div class="squadMissionPicker" aria-label="Choose a Story mission">${levels.join("")}</div>`;
  }

  function storyCampaignLandingHtml(){
    const level = clamp(Math.floor(Number(state.storyMissionLevel || 1)), 1, maxUnlockedStoryLevel());
    const coopReady = twoPlayerStoryReady(level);
    return `<div class="squadPanel">
      <button type="button" class="squadBackLink" data-squad-command="hub-home">← Co-op Home</button>
      <div class="squadSectionHead"><div><div class="squadKicker">Same campaign • choose every mission</div><div class="squadMissionName">📖 Story Campaign</div><div class="squadDesc">Your normal Story missions and unlocks. Choose Solo when you are alone or Two Players when a teammate is ready.</div></div><span class="squadProgressPill">Story ${maxUnlockedStoryLevel()}/100</span></div>
      ${storyLevelButtonsHtml()}
      <div class="squadSelectedMission"><div><div class="squadKicker">Selected mission</div><div class="squadSectionTitle">Story Mission ${level}</div><div class="squadDesc">${esc(selectedStoryDescription())}</div></div><span class="squadReadyPill ${coopReady ? "ready" : "pending"}">${coopReady ? "Two Player ready" : "Solo only for now"}</span></div>
      <div class="squadPartyChoice">
        <button type="button" class="squadPathCard solo" data-squad-command="play-solo"><span class="squadPathIcon">👤</span><span class="squadPathTitle">Play Solo</span><small>Continue to the normal Story map and pre-deploy setup for Mission ${level}.</small><b>Prepare Solo Mission →</b></button>
        <button type="button" class="squadPathCard team ${coopReady ? "" : "locked"}" data-squad-command="create" ${coopReady ? "" : "disabled"}><span class="squadPathIcon">👥</span><span class="squadPathTitle">Play with Teammate</span><small>${coopReady ? `Create a private two-player Story Mission ${level} room. Both players earn their own reward and unlock.` : "This mission still needs its full Two Player conversion. Play it Solo without losing progress."}</small><b>${coopReady ? "Create Two Player Squad →" : "Two Player coming later"}</b></button>
      </div>
      ${joinSquadHtml()}
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadSmall">Story progression belongs to each player. Special Operation badges and rewards are kept separate.</div>
    </div>`;
  }

  function specialOperationsLandingHtml(){
    const operation = selectedOperation();
    return `<div class="squadPanel">
      <button type="button" class="squadBackLink" data-squad-command="hub-home">← Co-op Home</button>
      ${equipmentButtonsHtml()}
      <div class="squadSectionHead"><div><div class="squadKicker">Replayable team challenges</div><div class="squadMissionName">🐅 Special Operations</div><div class="squadDesc">These missions have their own objectives, badges, and rewards. They never skip, replace, or unlock Story missions.</div></div><span class="squadProgressPill">Team mode</span></div>
      <div class="squadOperationGrid">
        ${SPECIAL_OPERATIONS.map((row)=>`<button type="button" class="squadMissionChoice ${operation.id === row.id ? "active" : ""}" data-squad-command="select-operation" data-squad-operation="${esc(row.id)}"><span>${row.icon} ${esc(row.title)}</span><small>${esc(row.short)}</small></button>`).join("")}
        <div class="squadMissionChoice preview" aria-disabled="true"><span>🔒 More operations</span><small>Endless Survival will arrive only after its real gameplay is complete.</small></div>
      </div>
      <div class="squadSelectedMission"><div><div class="squadKicker">Playable now • ${esc(operation.mapLabel)}</div><div class="squadSectionTitle">${operation.icon} ${esc(operation.title)}</div><div class="squadDesc">${esc(operation.description)}</div><div class="squadSmall"><b>Reward:</b> ${esc(operation.reward)}</div></div><span class="squadReadyPill ready">Two Players</span></div>
      <div class="squadRow"><button type="button" class="squadBtn good" data-squad-command="create">Create ${esc(operation.title)} Squad</button></div>
      ${joinSquadHtml()}
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadSmall">Each Special Operation has its own badge and payout. Special Operations do not change your Story mission number.</div>
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
      <div class="squadStoryStrip"><span>${sharedStoryActive() ? "📖" : selectedOperation().icon} ${esc(missionMeta().title || missionName())}</span><span>🎯 ${esc(missionMeta().objective || "Shared objectives")}</span><span>${sharedStoryActive() ? "🏘️ Story Campaign District" : `🗺️ ${esc(missionMeta().chapterName || selectedOperation().mapLabel)}`}</span></div>
      <div class="squadConnection ${remoteSnapshotPlayer()?.online === false ? "bad" : ""}" id="squadConnection">${esc(playerConnectionText())}</div>
      <div class="squadPauseNotice" id="squadPauseNotice" ${snap?.paused ? "" : "hidden"}>${snap?.paused ? esc(pauseSummary()) : ""}</div>
      <div class="squadObjective" id="squadObjective">${objectiveText()}</div>
      <div class="squadStatus" id="squadStatus">${esc(state.message)}</div>
      <div class="squadMapLegend"><span><i class="you"></i>You</span><span><i class="team"></i>Teammate</span><span>👤 Civilian</span><span>🐅 Tiger</span></div>
      <canvas id="squadArena" width="1200" height="760" aria-label="${esc(missionName())} expanded cooperative battlefield with a player-following camera"></canvas>
      <div class="squadBanner ${["complete","failed"].includes(snap.status) ? "show" : ""}" id="squadResultBanner">
        <div class="squadBannerTitle">${snap.status === "complete" ? "🏆 Squad Extracted!" : (snap.failureReason === "squad_wipe" ? "💀 Squad Wiped" : "⏱️ Operation Failed")}</div>
        <div class="squadBannerText">${snap.status === "complete" ? `${sharedStoryActive() ? `Story Mission ${Number(state.storyMissionLevel || 1)} completed together. Story Mission ${Math.min(100, Number(state.storyMissionLevel || 1) + 1)} unlocks when each player claims the result.` : `Both players cleared ${esc(selectedOperation().title)} and earned its separate Special Operation reward.`}` : (snap.failureReason === "squad_wipe" ? "Both soldiers used their field life and went down. The squad leader can restart this mission with both lives restored." : `Time expired. The squad leader can restart ${esc(missionName())}.`)}</div>
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
    if(threats.length) return `Objective 2: Clear the ${sharedStoryActive() ? "Story" : "Special Operation"} tiger threat together (${threats.length} tiger${threats.length===1?"":"s"} active).`;
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
      "hub-home":()=>selectHubSection("home"),
      "hub-story":()=>selectHubSection("story"),
      "hub-operations":()=>selectHubSection("operations"),
      "select-story":()=>selectMission("shared-story", Number(button?.dataset?.squadStoryLevel || 1)),
      "select-operation":()=>selectMission(button?.dataset?.squadOperation || "live-squad"),
      "play-solo":()=>playSoloStory(),
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

  function selectHubSection(section="home"){
    if(state.snapshot) return;
    state.hubSection = ["story","operations"].includes(section) ? section : "home";
    if(state.hubSection === "story"){
      state.launchType = "shared-story";
      state.storyMissionLevel = clamp(Math.floor(Number(state.storyMissionLevel || 1)), 1, maxUnlockedStoryLevel());
      state.message = "Choose a Story mission, then choose Solo or Two Players.";
    }else if(state.hubSection === "operations"){
      state.launchType = sharedStoryActive() ? "live-squad" : normalizeLaunchType(state.launchType);
      state.storyMissionLevel = 0;
      state.message = `${selectedOperation().title} is ready. Create a squad or join your teammate.`;
    }else{
      state.message = "Choose Story Campaign or Special Operations.";
    }
    state.error = "";
    updateHeader();
    render();
  }

  function selectMission(launchType, storyLevel=1){
    if(state.snapshot) return;
    state.launchType = normalizeLaunchType(launchType);
    state.hubSection = state.launchType === "shared-story" ? "story" : "operations";
    state.storyMissionLevel = state.launchType === "shared-story" ? clamp(Math.floor(Number(storyLevel || 1)), 1, maxUnlockedStoryLevel()) : 0;
    state.message = state.launchType === "shared-story"
      ? `Story Mission ${state.storyMissionLevel} selected. Choose Solo or Two Players.`
      : `${selectedOperation().title} selected. Create a squad or join with your teammate's code.`;
    state.error = "";
    updateHeader();
    render();
  }

  function playSoloStory(){
    if(state.snapshot) return;
    const level = clamp(Math.floor(Number(state.storyMissionLevel || 1)), 1, maxUnlockedStoryLevel());
    if(typeof window.openSoloStoryMissionFromCoop !== "function"){
      setMessage("Solo Story setup is unavailable right now. Open the World Map and choose this mission there.", true);
      return;
    }
    state.open = false;
    stopPolling();
    const overlay = $("liveSquadOverlay");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    state.hubSection = "home";
    window.openSoloStoryMissionFromCoop(level);
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
      if(requestedStoryLevel >= 1 && requestedStoryLevel <= 100){
        state.storyMissionLevel = requestedStoryLevel;
        state.launchType = "shared-story";
        state.hubSection = "story";
      }else if(SPECIAL_OPERATIONS.some((operation)=>operation.id === opts?.launchType)){
        state.storyMissionLevel = 0;
        state.launchType = normalizeLaunchType(opts.launchType);
        state.hubSection = "operations";
      }else if(opts?.hubSection){
        state.hubSection = ["story","operations"].includes(opts.hubSection) ? opts.hubSection : "home";
      }else if(state.hubSection === "home"){
        state.storyMissionLevel = maxUnlockedStoryLevel();
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
    if(!state.snapshot){
      state.hubSection = "home";
      state.storyMissionLevel = maxUnlockedStoryLevel();
      state.message = "Choose Story Campaign or Special Operations.";
      state.error = "";
      updateHeader();
    }
    try{ window.returnToLiveSquadMenuBackground?.(); }catch(error){}
  }

  async function create(){
    if(!hasTelegramAuth()) return setMessage("Please open the game inside Telegram first.", true);
    if(state.launchType === "shared-story" && !twoPlayerStoryReady()){
      return setMessage(`Story Mission ${state.storyMissionLevel} is Solo only right now. Two Player is currently ready for Missions 1–${SHARED_STORY_LEVELS.length}.`, true);
    }
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
    state.hubSection = "home";
    state.launchType = "shared-story";
    state.storyMissionLevel = clamp(Math.floor(Number(window.S?.storyLevel || 1)), 1, maxUnlockedStoryLevel());
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

  function drawDenCave(ctx,x,y,size=1){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    ctx.fillStyle="rgba(2,6,23,.35)";ctx.beginPath();ctx.ellipse(6,24,78,22,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#57534e";ctx.beginPath();ctx.moveTo(-82,20);ctx.quadraticCurveTo(-68,-76,0,-88);ctx.quadraticCurveTo(70,-72,88,20);ctx.closePath();ctx.fill();
    ctx.fillStyle="#292524";ctx.beginPath();ctx.ellipse(0,13,43,55,0,Math.PI,Math.PI*2);ctx.lineTo(43,26);ctx.lineTo(-43,26);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#a8a29e";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-75,13);ctx.quadraticCurveTo(-55,-62,0,-73);ctx.quadraticCurveTo(58,-61,77,14);ctx.stroke();
    ctx.fillStyle="#fbbf24";ctx.font="950 13px system-ui";ctx.textAlign="center";ctx.fillText("TIGER DEN",0,45);ctx.restore();
  }

  function drawVillageBarricade(ctx,x,y,angle=0){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle="rgba(2,6,23,.28)";roundRect(ctx,-60,13,120,18,7);ctx.fill();
    ctx.fillStyle="#9a6a3a";ctx.strokeStyle="#f5d08a";ctx.lineWidth=3;
    for(const offset of [-38,0,38]){ctx.save();ctx.translate(offset,0);ctx.rotate(offset===0?-.08:.08);roundRect(ctx,-8,-28,16,58,4);ctx.fill();ctx.stroke();ctx.restore();}
    ctx.fillStyle="#b7793f";roundRect(ctx,-62,-12,124,20,5);ctx.fill();ctx.stroke();
    ctx.fillStyle="#facc15";ctx.fillRect(-48,-7,24,5);ctx.fillRect(-10,-7,24,5);ctx.fillRect(28,-7,24,5);
    ctx.restore();
  }

  function drawConvoyTruck(ctx,x,y,angle=0,color="#2f855a",damaged=false){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    ctx.fillStyle="rgba(2,6,23,.32)";ctx.beginPath();ctx.ellipse(0,24,72,16,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=color;roundRect(ctx,-62,-24,82,48,8);ctx.fill();ctx.strokeStyle="#d1fae5";ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="#334155";roundRect(ctx,20,-20,44,40,8);ctx.fill();ctx.strokeStyle="#cbd5e1";ctx.stroke();
    ctx.fillStyle="#93c5fd";ctx.fillRect(38,-14,19,14);
    ctx.fillStyle="#111827";for(const wheelX of [-40,39]){ctx.beginPath();ctx.arc(wheelX,25,10,0,Math.PI*2);ctx.fill();ctx.fillStyle="#94a3b8";ctx.beginPath();ctx.arc(wheelX,25,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#111827";}
    ctx.fillStyle="#facc15";ctx.fillRect(-48,-4,16,7);ctx.fillRect(-23,-4,16,7);ctx.fillRect(2,-4,12,7);
    if(damaged){ctx.strokeStyle="#fb7185";ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(-12,-22);ctx.lineTo(14,18);ctx.moveTo(10,-18);ctx.lineTo(-18,18);ctx.stroke();ctx.fillStyle="rgba(71,85,105,.46)";ctx.beginPath();ctx.arc(-18,-48,18,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-6,-70,25,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }

  function drawHighlandPeak(ctx,x,y,size=1){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    ctx.fillStyle="rgba(2,6,23,.32)";ctx.beginPath();ctx.ellipse(5,36,92,20,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#475569";ctx.beginPath();ctx.moveTo(-88,34);ctx.lineTo(-26,-42);ctx.lineTo(2,-12);ctx.lineTo(35,-78);ctx.lineTo(92,34);ctx.closePath();ctx.fill();
    ctx.fillStyle="#94a3b8";ctx.beginPath();ctx.moveTo(14,-42);ctx.lineTo(35,-78);ctx.lineTo(55,-40);ctx.lineTo(39,-47);ctx.lineTo(29,-35);ctx.closePath();ctx.fill();
    ctx.strokeStyle="rgba(191,219,254,.42)";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-88,34);ctx.lineTo(-26,-42);ctx.lineTo(2,-12);ctx.lineTo(35,-78);ctx.lineTo(92,34);ctx.stroke();ctx.restore();
  }

  function drawStormShelter(ctx,x,y,size=1){
    ctx.save();ctx.translate(x,y);ctx.scale(size,size);
    ctx.fillStyle="rgba(2,6,23,.36)";ctx.beginPath();ctx.ellipse(2,34,76,18,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#475569";roundRect(ctx,-58,-24,116,58,7);ctx.fill();ctx.strokeStyle="#bae6fd";ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle="#1e293b";ctx.beginPath();ctx.moveTo(-72,-21);ctx.lineTo(0,-62);ctx.lineTo(72,-21);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle="#7dd3fc";ctx.fillRect(-43,-10,25,18);ctx.fillRect(18,-10,25,18);ctx.fillStyle="#0f172a";ctx.fillRect(-9,2,18,32);
    ctx.strokeStyle="#cbd5e1";ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(48,-49);ctx.lineTo(48,-91);ctx.stroke();ctx.fillStyle="#facc15";ctx.beginPath();ctx.moveTo(50,-88);ctx.lineTo(82,-77);ctx.lineTo(50,-67);ctx.closePath();ctx.fill();ctx.restore();
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
    if(tiger.defeated) return;const alpha=!!tiger.boss;const ghost=String(tiger.id||"")==="ghoststripe_alpha";const coat=ghost?"#dbeafe":"#f59e0b";const ear=ghost?"#e2e8f0":"#fbbf24";const leg=ghost?"#94a3b8":"#d97706";const s=alpha?1.28:(tiger.type==="Armored"?1.08:.94);const facing=Math.sin((now/900)+(String(tiger.id).length))>=0?1:-1;
    ctx.save();ctx.translate(tiger.x,tiger.y);ctx.scale(facing*s,s);
    ctx.strokeStyle=coat;ctx.lineWidth=9;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(-29,2);ctx.quadraticCurveTo(-54,-15,-64,4);ctx.stroke();
    ctx.strokeStyle="#111827";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-47,-6);ctx.lineTo(-51,2);ctx.stroke();
    ctx.fillStyle=coat;ctx.beginPath();ctx.ellipse(0,0,35,20,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(30,-7,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=ear;ctx.beginPath();ctx.moveTo(22,-17);ctx.lineTo(23,-29);ctx.lineTo(31,-20);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(34,-19);ctx.lineTo(40,-28);ctx.lineTo(43,-15);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#111827";ctx.lineWidth=4;for(const x of [-20,-7,7,18]){ctx.beginPath();ctx.moveTo(x,-15);ctx.lineTo(x+8,13);ctx.stroke();}
    ctx.strokeStyle=leg;ctx.lineWidth=7;for(const x of [-18,9]){ctx.beginPath();ctx.moveTo(x,12);ctx.lineTo(x-2,28);ctx.stroke();}
    ctx.fillStyle="#111827";ctx.beginPath();ctx.arc(37,-9,2.5,0,Math.PI*2);ctx.fill();ctx.fillStyle="#f8fafc";ctx.beginPath();ctx.arc(44,-3,3,0,Math.PI*2);ctx.fill();ctx.restore();
    const pct=clamp(Number(tiger.hp||0)/Math.max(1,Number(tiger.hpMax||1)),0,1);const barW=alpha?105:72;ctx.fillStyle="rgba(2,6,23,.8)";roundRect(ctx,tiger.x-barW/2,tiger.y-(alpha?65:50),barW,11,5);ctx.fill();ctx.fillStyle=alpha?"#fb7185":"#f59e0b";roundRect(ctx,tiger.x-barW/2+2,tiger.y-(alpha?63:48),(barW-4)*pct,7,4);ctx.fill();ctx.fillStyle="#fff7ed";ctx.font=`900 ${alpha?14:11}px system-ui`;ctx.textAlign="center";ctx.fillText(alpha?String(tiger.name||"ALPHA").toUpperCase():String(tiger.type||"TIGER").toUpperCase(),tiger.x,tiger.y-(alpha?72:57));
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
    const denAssault = snap.launchType === "tiger-den";
    const villageSiege = snap.launchType === "village-siege";
    const convoyRescue = snap.launchType === "convoy-rescue";
    const alphaHunt = snap.launchType === "alpha-hunt";
    const stormExtraction = snap.launchType === "storm-extraction";
    const roadW = 112;
    const verticalRoads = [worldW*.28, worldW*.54, worldW*.81];
    const horizontalRoads = [worldH*.24, worldH*.50, worldH*.76];
    const riverTop = worldH*.88;
    const visible = (x,y,pad=120)=>x >= view.x-pad && x <= view.x+view.w+pad && y >= view.y-pad && y <= view.y+view.h+pad;
    const nearRoad = (x,y,pad=75)=>verticalRoads.some((road)=>Math.abs(x-road)<pad)||horizontalRoads.some((road)=>Math.abs(y-road)<pad);

    const terrain=ctx.createLinearGradient(0,0,0,worldH);terrain.addColorStop(0,denAssault?"#62533c":(villageSiege?"#66a85c":(convoyRescue?"#6f8f4e":(alphaHunt?"#34435c":(stormExtraction?"#315a66":"#3f7b4d")))));terrain.addColorStop(.52,denAssault?"#3f4936":(villageSiege?"#43814d":(convoyRescue?"#416b46":(alphaHunt?"#28384a":(stormExtraction?"#254956":"#2f6944")))));terrain.addColorStop(1,denAssault?"#29382f":(villageSiege?"#2c6845":(convoyRescue?"#294f3e":(alphaHunt?"#1d2b3f":(stormExtraction?"#193845":"#24583c")))));ctx.fillStyle=terrain;ctx.fillRect(view.x,view.y,view.w,view.h);
    ctx.fillStyle=denAssault?"rgba(168,139,92,.16)":(villageSiege?"rgba(190,228,125,.19)":(convoyRescue?"rgba(217,168,91,.17)":(alphaHunt?"rgba(147,197,253,.12)":(stormExtraction?"rgba(125,211,252,.13)":"rgba(102,164,91,.20)"))));
    const tileW=132,tileH=96,startX=Math.floor(view.x/tileW)*tileW,startY=Math.floor(view.y/tileH)*tileH;
    for(let y=startY;y<view.y+view.h+tileH;y+=tileH){for(let x=startX;x<view.x+view.w+tileW;x+=tileW){ctx.fillRect(x+(((y/tileH)|0)%2)*28,y,96,68);}}

    ctx.fillStyle=denAssault?"rgba(32,31,29,.88)":(villageSiege?"rgba(31,142,174,.86)":(convoyRescue?"rgba(28,102,132,.86)":(alphaHunt?"rgba(23,61,93,.90)":(stormExtraction?"rgba(14,83,112,.94)":"rgba(35,117,145,.80)"))));ctx.beginPath();ctx.moveTo(0,riverTop);
    for(let x=0;x<=worldW+180;x+=180){ctx.lineTo(x,riverTop+Math.sin((x/worldW)*Math.PI*5)*42);}
    ctx.lineTo(worldW,worldH);ctx.lineTo(0,worldH);ctx.closePath();ctx.fill();

    ctx.fillStyle=denAssault?"#49443b":(villageSiege?"#455267":(convoyRescue?"#3f4654":(alphaHunt?"#374151":(stormExtraction?"#334155":"#4b5563"))));
    for(const y of horizontalRoads) ctx.fillRect(0,y-roadW/2,worldW,roadW);
    for(const x of verticalRoads) ctx.fillRect(x-roadW/2,0,roadW,worldH);
    ctx.strokeStyle=denAssault?"rgba(214,180,125,.42)":(villageSiege?"rgba(248,250,252,.78)":(convoyRescue?"rgba(226,232,240,.74)":(alphaHunt?"rgba(191,219,254,.62)":(stormExtraction?"rgba(186,230,253,.72)":"rgba(241,245,249,.58)"))));ctx.lineWidth=4;
    for(const y of horizontalRoads){ctx.beginPath();ctx.moveTo(0,y-roadW/2+8);ctx.lineTo(worldW,y-roadW/2+8);ctx.moveTo(0,y+roadW/2-8);ctx.lineTo(worldW,y+roadW/2-8);ctx.stroke();}
    for(const x of verticalRoads){ctx.beginPath();ctx.moveTo(x-roadW/2+8,0);ctx.lineTo(x-roadW/2+8,worldH);ctx.moveTo(x+roadW/2-8,0);ctx.lineTo(x+roadW/2-8,worldH);ctx.stroke();}
    ctx.strokeStyle=denAssault?"rgba(251,146,60,.62)":(villageSiege?"rgba(253,224,71,.92)":(convoyRescue?"rgba(250,204,21,.96)":(alphaHunt?"rgba(165,180,252,.80)":(stormExtraction?"rgba(125,211,252,.88)":"rgba(250,204,21,.78)"))));ctx.lineWidth=5;ctx.setLineDash(denAssault?[18,34]:[34,28]);
    for(const y of horizontalRoads){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(worldW,y);ctx.stroke();}
    for(const x of verticalRoads){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,worldH);ctx.stroke();}
    ctx.setLineDash([]);

    for(const roadX of verticalRoads){
      const bridgeY=riverTop-34;ctx.fillStyle="#765a3b";ctx.fillRect(roadX-roadW*.63,bridgeY,roadW*1.26,94);ctx.strokeStyle="#e8c178";ctx.lineWidth=6;
      for(let x=roadX-roadW*.52;x<roadX+roadW*.53;x+=24){ctx.beginPath();ctx.moveTo(x,bridgeY-8);ctx.lineTo(x,bridgeY+102);ctx.stroke();}
    }

    for(let i=0;i<(denAssault?150:(villageSiege?185:(convoyRescue?210:(alphaHunt?175:(stormExtraction?125:240)))));i++){
      const x=70+((i*337+53)%Math.max(100,Math.floor(worldW-140)));
      const y=80+((i*191+97)%Math.max(100,Math.floor(worldH-180)));
      if(!visible(x,y,70)||nearRoad(x,y,88)||y>riverTop-55) continue;
      if(denAssault && i%3===0){ctx.fillStyle=i%2?"#78716c":"#57534e";ctx.beginPath();ctx.ellipse(x,y,18+(i%5)*4,13+(i%4)*3,(i%7)*.22,0,Math.PI*2);ctx.fill();}
      else drawStoryTree(ctx,x,y,.68+(i%5)*.075);
    }
    const roofColors=["#9a5c38","#7c4a32","#72452f","#a1623c"];
    for(let i=0;i<(denAssault?12:(villageSiege?58:(convoyRescue?18:(alphaHunt?8:(stormExtraction?14:34)))));i++){
      const x=100+((i*421+160)%Math.max(140,Math.floor(worldW-280)));
      const y=110+((i*263+120)%Math.max(140,Math.floor(riverTop-260)));
      if(!visible(x,y,210)||nearRoad(x+80,y+52,125)) continue;
      drawStoryBuilding(ctx,x,y,142+(i%3)*14,88+(i%2)*12,roofColors[i%roofColors.length]);
    }
    if(denAssault){
      const caves=[[worldW*.18,worldH*.17,1.05],[worldW*.58,worldH*.31,1.3],[worldW*.82,worldH*.62,1.12],[worldW*.43,worldH*.70,.92]];
      for(const [x,y,size] of caves){if(visible(x,y,150))drawDenCave(ctx,x,y,size);}
      ctx.fillStyle="rgba(245,158,11,.14)";ctx.beginPath();ctx.arc(worldW*.62,worldH*.51,230,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(251,146,60,.42)";ctx.lineWidth=8;ctx.setLineDash([20,16]);ctx.stroke();ctx.setLineDash([]);
    }
    if(villageSiege){
      const plazaX=worldW*.54,plazaY=worldH*.50;
      if(visible(plazaX,plazaY,300)){
        ctx.fillStyle="rgba(226,232,240,.24)";ctx.beginPath();ctx.arc(plazaX,plazaY,158,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(254,240,138,.76)";ctx.lineWidth=7;ctx.setLineDash([18,12]);ctx.stroke();ctx.setLineDash([]);
        ctx.fillStyle="rgba(7,35,27,.88)";roundRect(ctx,plazaX-116,plazaY-46,232,52,13);ctx.fill();ctx.strokeStyle="#86efac";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#dcfce7";ctx.font="950 18px system-ui";ctx.textAlign="center";ctx.fillText("SUNCREST SAFEHOUSE",plazaX,plazaY-14);
      }
      const barricades=[
        [worldW*.28,worldH*.24,0],[worldW*.54,worldH*.24,0],[worldW*.81,worldH*.50,Math.PI/2],
        [worldW*.28,worldH*.76,Math.PI/2],[worldW*.54,worldH*.76,0],[worldW*.81,worldH*.76,0],
      ];
      for(const [x,y,angle] of barricades){if(visible(x,y,110))drawVillageBarricade(ctx,x,y,angle);}
    }
    if(convoyRescue){
      const routeY=worldH*.50;
      if(visible(worldW*.52,routeY,420)){
        ctx.fillStyle="rgba(15,23,42,.88)";roundRect(ctx,worldW*.52-146,routeY-118,292,48,12);ctx.fill();ctx.strokeStyle="#facc15";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#fef9c3";ctx.font="950 17px system-ui";ctx.textAlign="center";ctx.fillText("REDWOOD CONVOY ROUTE",worldW*.52,routeY-87);
      }
      const trucks=[
        [worldW*.20,routeY-17,0,"#2f855a",false],[worldW*.38,routeY+18,Math.PI,"#2563eb",true],
        [worldW*.66,routeY-18,0,"#b45309",false],[worldW*.84,routeY+17,Math.PI,"#475569",true],
      ];
      for(const [x,y,angle,color,damaged] of trucks){if(visible(x,y,130))drawConvoyTruck(ctx,x,y,angle,color,damaged);}
      const checkpoints=[[worldW*.28,worldH*.24],[worldW*.54,worldH*.76],[worldW*.81,worldH*.24]];
      for(const [x,y] of checkpoints){if(!visible(x,y,100))continue;ctx.strokeStyle="rgba(56,189,248,.65)";ctx.lineWidth=5;ctx.setLineDash([14,10]);ctx.beginPath();ctx.arc(x,y,66,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
    }
    if(alphaHunt){
      const peaks=[[worldW*.16,worldH*.18,1.12],[worldW*.43,worldH*.31,1.35],[worldW*.72,worldH*.17,1.05],[worldW*.86,worldH*.61,1.28],[worldW*.34,worldH*.70,.96]];
      for(const [x,y,size] of peaks){if(visible(x,y,160))drawHighlandPeak(ctx,x,y,size);}
      const moonPools=[[worldW*.24,worldH*.42,170],[worldW*.63,worldH*.57,240],[worldW*.79,worldH*.32,145]];
      for(const [x,y,r] of moonPools){if(!visible(x,y,r+40))continue;ctx.fillStyle="rgba(147,197,253,.09)";ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(165,180,252,.32)";ctx.lineWidth=5;ctx.setLineDash([18,14]);ctx.stroke();ctx.setLineDash([]);}
      if(visible(worldW*.60,worldH*.46,360)){ctx.fillStyle="rgba(15,23,42,.90)";roundRect(ctx,worldW*.60-144,worldH*.46-50,288,48,12);ctx.fill();ctx.strokeStyle="#c4b5fd";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#ede9fe";ctx.font="950 17px system-ui";ctx.textAlign="center";ctx.fillText("GHOSTSTRIPE RANGE",worldW*.60,worldH*.46-19);}
    }
    if(stormExtraction){
      const floodZones=[[worldW*.20,worldH*.38,240,105],[worldW*.48,worldH*.67,310,120],[worldW*.76,worldH*.34,270,110],[worldW*.86,worldH*.72,230,100]];
      for(const [x,y,rx,ry] of floodZones){if(!visible(x,y,rx+60))continue;ctx.fillStyle="rgba(14,165,233,.22)";ctx.beginPath();ctx.ellipse(x,y,rx,ry,-.08,0,Math.PI*2);ctx.fill();ctx.strokeStyle="rgba(125,211,252,.42)";ctx.lineWidth=5;ctx.stroke();}
      const shelters=[[worldW*.17,worldH*.20,1.05],[worldW*.51,worldH*.31,.92],[worldW*.82,worldH*.61,1.12]];
      for(const [x,y,size] of shelters){if(visible(x,y,150))drawStormShelter(ctx,x,y,size);}
      const stormNow=Number(snap.serverNow||Date.now()),rainShift=(stormNow/22)%140;
      ctx.strokeStyle="rgba(186,230,253,.46)";ctx.lineWidth=3;
      for(let i=0;i<72;i++){const x=view.x+((i*89+rainShift)%Math.max(1,view.w+120))-60;const y=view.y+((i*137+rainShift*1.7)%Math.max(1,view.h+120))-60;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-18,y+42);ctx.stroke();}
      if(Math.floor(stormNow/900)%7===0){const lx=worldW*.72,ly=worldH*.15;if(visible(lx,ly,240)){ctx.strokeStyle="#fef9c3";ctx.lineWidth=10;ctx.shadowColor="#e0f2fe";ctx.shadowBlur=28;ctx.beginPath();ctx.moveTo(lx,ly-110);ctx.lineTo(lx-34,ly-25);ctx.lineTo(lx+8,ly-35);ctx.lineTo(lx-44,ly+80);ctx.stroke();ctx.shadowBlur=0;}}
    }

    const spawns=(snap.spawns||snap.players||[]).map((player)=>({x:Number(player.x||0),y:Number(player.y||0)}));
    const baseX=spawns.length?spawns.reduce((sum,row)=>sum+row.x,0)/spawns.length:worldW*.12;
    const baseY=spawns.length?spawns.reduce((sum,row)=>sum+row.y,0)/spawns.length:worldH*.78;
    if(visible(baseX,baseY,260)){
      ctx.fillStyle="rgba(15,23,42,.86)";roundRect(ctx,baseX-118,baseY-112,236,78,16);ctx.fill();ctx.strokeStyle="#67e8f9";ctx.lineWidth=3;ctx.stroke();ctx.fillStyle="#cffafe";ctx.font="950 19px system-ui";ctx.textAlign="center";ctx.fillText("🛡️ BASE CAMP",baseX,baseY-82);ctx.font="800 13px system-ui";ctx.fillText("Respawn • Rally • Safe Start",baseX,baseY-57);
    }

    const ex=snap.extraction;ctx.fillStyle=stormExtraction?"rgba(14,165,233,.26)":"rgba(34,197,94,.23)";ctx.strokeStyle=stormExtraction?"#7dd3fc":"#4ade80";ctx.lineWidth=6;ctx.beginPath();ctx.arc(ex.x,ex.y,ex.r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=stormExtraction?"#e0f2fe":"#dcfce7";ctx.font="950 18px system-ui";ctx.textAlign="center";ctx.fillText(stormExtraction?"STORM EXTRACTION":"SQUAD EXTRACTION",ex.x,ex.y+6);if(stormExtraction){ctx.font="950 44px system-ui";ctx.fillText("H",ex.x,ex.y-24);}
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
    const mapName=sharedStoryActive()?"STORY DISTRICT MAP":`${String(selectedOperation().mapLabel||"SPECIAL OPERATION").toUpperCase()} MAP`;
    ctx.fillStyle="#dbeafe";ctx.font="900 11px system-ui";ctx.textAlign="center";ctx.fillText(mapName,mx+mw/2,my+mh-7);
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
    ctx.fillStyle="rgba(2,6,23,.84)";roundRect(ctx,18,18,350,54,12);ctx.fill();ctx.fillStyle="#d1fae5";ctx.font="950 16px system-ui";ctx.textAlign="left";ctx.fillText(sharedStoryActive()?"EXPANDED STORY DISTRICT":String(selectedOperation().mapLabel||"SPECIAL OPERATION").toUpperCase(),34,43);ctx.fillStyle="#93c5fd";ctx.font="850 12px system-ui";ctx.fillText(`${Math.round(worldW/100)/10}km × ${Math.round(worldH/100)/10}km • CAMERA FOLLOW`,34,61);
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
    state.launchType = normalizeLaunchType(record.launchType);
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
