import { SyncManager } from './sync-manager.js';
import { generateFieldHTML } from './core/ui.js';

const syncManager = new SyncManager();

const state = {
    config: null,
    entities: [],
    currentStation: null,
    currentEntity: null,
    isOnline: navigator.onLine,
    viewMode: 'patrol',
    drafts: {},
    // Bracket State
    bracketData: JSON.parse(localStorage.getItem('coyote_bracket_data') || '{}'),
    currentRoundIdx: 0,
    currentHeatId: null
};

// UI References
const els = {
    status: document.getElementById('status-indicator'),
    unsyncedCount: document.getElementById('unsynced-count'),
    backBtn: document.getElementById('header-back-btn'),
    profileBtn: document.getElementById('judge-profile-btn'),
    stationList: document.getElementById('station-list'),
    entityList: document.getElementById('entity-list'),
    entitySearch: document.getElementById('entity-search'),
    entityHeader: document.getElementById('entity-header'),
    scoreForm: document.getElementById('score-form'),
    scoringTitle: document.getElementById('scoring-title'),
    scoringTeam: document.getElementById('scoring-team'),
    judgeName: document.getElementById('judge-name'),
    judgeEmail: document.getElementById('judge-email'),
    judgeUnit: document.getElementById('judge-unit'),
    // Bracket Refs
    lobbyList: document.getElementById('bracket-lobby-list'),
    roundPool: document.getElementById('bracket-round-pool'),
    heatList: document.getElementById('bracket-heat-list'),
    heatContainer: document.getElementById('heat-scoring-container')
};

const views = {
    home: document.getElementById('view-home'),
    entity: document.getElementById('view-entity'),
    scoring: document.getElementById('view-scoring'),
    // Bracket Views
    bracketLobby: document.getElementById('view-bracket-lobby'),
    bracketRound: document.getElementById('view-bracket-round'),
    bracketHeat: document.getElementById('view-bracket-heat')
};

// --- Initialization ---

async function init() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('judge_email')) {
        const j = {
            name: params.get('judge_name') || '',
            email: params.get('judge_email') || '',
            unit: params.get('judge_unit') || ''
        };
        localStorage.setItem('judge_info', JSON.stringify(j));
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    loadLocalData();
    loadJudgeInfo();
    injectModeTabs();

    if (state.isOnline) await refreshData();

    renderStationList();
    updateSyncCounts();

    els.status.addEventListener('click', handleSync);
    els.entitySearch.addEventListener('input', (e) => renderEntityList(e.target.value));
    document.getElementById('btn-submit').addEventListener('click', submitScore);

    navigate('home');
}

// --- DATA MANAGEMENT ---

function resetAppData() {
    if(!confirm("⚠️ RESET WARNING ⚠️\n\nThis will wipe all local tournament brackets and draft scores.\nIt effectively 'Fresh Installs' the app.\n\nData already sent to the server is safe.\n\nProceed?")) return;

    // 1. Preserve Judge Identity
    const judge = localStorage.getItem('judge_info');

    // 2. Nuke everything else
    localStorage.clear();

    // 3. Restore Judge Identity
    if(judge) localStorage.setItem('judge_info', judge);

    // 4. Reload to fetch fresh server state
    window.location.reload();
}

// --- Navigation ---

function navigate(viewName) {
    Object.values(views).forEach(el => {
        if(el) el.classList.add('hidden');
    });
    if(views[viewName]) views[viewName].classList.remove('hidden');

    const isHome = viewName === 'home';
    els.backBtn.classList.toggle('hidden', isHome);
    els.status.classList.toggle('hidden', !isHome);
    els.profileBtn.classList.toggle('hidden', !isHome);

    if (viewName !== 'scoring') {
        const header = document.querySelector('header');
        header.style.backgroundColor = '';
        header.style.color = '';
        const sub = document.getElementById('header-subtitle');
        if(sub) sub.style.display = 'none';
    }

    if (isHome) {
        document.getElementById('header-title').textContent = 'Camporee Collator';
        const syncLine = document.getElementById('header-sync-line');
        if(syncLine) syncLine.style.display = 'block';
        document.body.style.paddingBottom = '0';
    } else {
        const syncLine = document.getElementById('header-sync-line');
        if(syncLine) syncLine.style.display = 'none';
    }
    window.scrollTo(0,0);
}

function handleBack() {
    // 1. Heat -> Round (Existing)
    if (state.view === 'bracketHeat') {
        navigate('bracketRound');
        return;
    }

    // 2. Round -> Lobby (NEW: No confirmation, just go "Up" a level)
    if (state.view === 'bracketRound') {
        navigate('bracketLobby');
        return;
    }

    // 3. Lobby -> Home (Exit Confirmation)
    if (state.view === 'bracketLobby') {
        if (confirm("Exit Tournament Manager?")) {
            navigate('home');
        }
        return;
    }

    // 4. Default Handling
    const history = state.navHistory || [];
    if (history.length > 0) {
        const prev = history.pop(); // Remove current
        const target = history.pop(); // Get previous
        if (target) navigate(target);
        else navigate('home');
    } else {
        navigate('home');
    }
}


// --- Mode Tabs & Station Selection ---

function injectModeTabs() {
    const stationList = document.getElementById('station-list');
    if (!stationList) return;
    const container = stationList.parentNode;
    const h3 = stationList.previousElementSibling;

    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = "display: flex; gap: 8px; margin-bottom: 1rem; align-items: stretch;";

    tabContainer.innerHTML = `
        <div style="flex: 1.25">
            <input type="radio" name="vmode" id="mode-patrol" style="display:none" ${state.viewMode === 'patrol' ? 'checked' : ''}>
            <label class="btn px-1 ${state.viewMode === 'patrol' ? '' : 'btn-outline'}" id="btn-mode-patrol" for="mode-patrol" onclick="app.setMode('patrol')" style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; margin-bottom: 0;">Patrol Events</label>
        </div>
        <div style="flex: 1.25">
            <input type="radio" name="vmode" id="mode-troop" style="display:none" ${state.viewMode === 'troop' ? 'checked' : ''}>
            <label class="btn px-1 ${state.viewMode === 'troop' ? '' : 'btn-outline'}" id="btn-mode-troop" for="mode-troop" onclick="app.setMode('troop')" style="height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; margin-bottom: 0;">Troop Events</label>
        </div>
        <div style="flex: 0.75">
            <button class="btn btn-outline px-1" id="btn-reload-data" onclick="app.refreshData()" style="height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; margin-bottom: 0;">Reload</button>
        </div>
    `;
    container.insertBefore(tabContainer, h3 || stationList);
}

function setMode(mode) {
    state.viewMode = mode;
    const pBtn = document.getElementById('btn-mode-patrol');
    const tBtn = document.getElementById('btn-mode-troop');
    if (pBtn && tBtn) {
        if (mode === 'patrol') {
            pBtn.classList.remove('btn-outline');
            tBtn.classList.add('btn-outline');
        } else {
            pBtn.classList.add('btn-outline');
            tBtn.classList.remove('btn-outline');
        }
    }
    renderStationList();
}

function selectStation(id) {
    state.currentStation = state.config.stations.find(s => s.id === id);
    if(!state.currentStation) return;

    if (state.currentStation.bracketMode) {
        const bData = initBracketState(id);
        if (bData.active && bData.rounds.length > 0) {
            state.currentRoundIdx = bData.rounds.length - 1;
            renderBracketRound();
            navigate('bracketRound');
        } else {
            renderBracketLobby();
            navigate('bracketLobby');
        }
    } else {
        renderEntityList();
        navigate('entity');
    }
}

// --- HELPER: Smart Name Formatting ---
function formatEntityLabel(e) {
    if (!e) return '';
    // Normalize
    const tNum = String(e.troop_number || '').trim();
    const name = String(e.name || '').trim();
    const type = e.type || 'patrol';

    // Regex to detect redundant names (e.g. "13", "T13", "Tr 13", "Troop 13")
    const isRedundant = new RegExp(`^(t|tr|troop)?\\s*${tNum}$`, 'i').test(name);

    if (type === 'troop') {
        // Troop Mode: "Troop 13" or "Troop 13 - The Avengers"
        const base = `Troop ${tNum}`;
        if (isRedundant || !name) return base;
        return `${base} - ${name}`;
    } else {
        // Patrol Mode: "T101" or "T101 Flaming Arrows"
        const base = `T${tNum}`;
        if (isRedundant || !name) return base;
        return `${base} ${name}`;
    }
}

function formatGameTitle(game) {
    if (!game) return '';
    if (game.name.match(/^(Game|Exhibition|p\d)/i)) return game.name;
    const match = game.id.match(/(\d+)/);
    const num = match ? match[1] : '';
    if (num) return `Game ${num}. ${game.name}`;
    return game.name;
}

// --- Standard Entity & Form Logic ---

function renderStationList() {
    if (!state.config || !state.config.stations) {
        els.stationList.innerHTML = `<div class="p-4 text-center text-muted">Loading games...</div>`;
        return;
    }
    const filteredStations = state.config.stations.filter(s => !s.type || s.type === state.viewMode);
    if (filteredStations.length === 0) {
        els.stationList.innerHTML = `<div class="alert alert-info text-center">No ${state.viewMode} games found.</div>`;
        return;
    }
    els.stationList.innerHTML = filteredStations.map(s => `
        <button class="btn btn-outline-dark w-100 mb-2 text-start p-3 shadow-sm" onclick="app.selectStation('${s.id}')">
            <div class="fw-bold">${formatGameTitle(s)}</div>
            <small class="text-muted text-uppercase" style="font-size:0.75rem;">${s.type || 'General'}</small>
        </button>`).join('');
}

function renderEntityList(filter = '') {
    if (!state.currentStation) return;
    const requiredType = state.currentStation.type || state.viewMode;
    const term = filter.toLowerCase();
    const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
    const queue = syncManager.getQueue();
    const scoredIds = new Set(queue.filter(s => s.game_id === state.currentStation.id).map(s => s.entity_id));

    const filtered = state.entities.filter(e =>
        e.type === requiredType && (e.name.toLowerCase().includes(term) || e.troop_number.includes(term))
    );

    filtered.sort((a, b) => {
        const doneA = scoredIds.has(a.id);
        const doneB = scoredIds.has(b.id);
        if (doneA !== doneB) return doneA ? 1 : -1;
        return (parseInt(a.troop_number)||0) - (parseInt(b.troop_number)||0);
    });

    els.entityHeader.textContent = `Select ${requiredType === 'patrol' ? 'Patrol' : 'Troop'}`;
    const addButton = `<button class="list-group-item list-group-item-action p-3 text-center text-primary fw-bold" onclick="app.promptNewEntity('${requiredType}')" style="border: 2px dashed var(--bs-primary); margin-bottom: 8px;"><span style="font-size: 1.2rem;">➕ Register New ${requiredType}</span></button>`;

    els.entityList.innerHTML = addButton + filtered.map(e => {
        const isDone = scoredIds.has(e.id);
        const draftKey = `${state.currentStation.id}_${e.id}`;
        const hasDraft = !!drafts[draftKey];
        const displayLabel = formatEntityLabel(e); // USE FORMATTER

        return `
            <div class="list-group-item list-group-item-action p-3 d-flex justify-content-between align-items-center"
                onclick="app.selectEntity('${e.id}')"
                style="cursor:pointer; border-left: 5px solid ${isDone ? '#adb5bd' : (hasDraft ? '#ffc107' : '#0d6efd')}; margin-bottom: 6px; ${isDone ? 'background-color: #f1f3f5; opacity: 0.6;' : 'background-color: #fff;'}">
                <div class="fw-bold text-truncate" style="max-width: 85%; font-size: 1.05rem;">${isDone ? `<del class="text-muted">${displayLabel}</del>` : displayLabel}</div>
                <div>${hasDraft && !isDone ? '<span class="badge bg-warning text-dark me-1">Draft</span>' : ''}${isDone ? '<span class="badge bg-light text-dark border">Done</span>' : ''}</div>
            </div>`;
    }).join('');
}

function selectEntity(id) {
    state.currentEntity = state.entities.find(e => e.id === id);
    const queue = syncManager.getQueue();
    const existingScore = queue.find(s => s.game_id === state.currentStation.id && s.entity_id === id);
    renderForm(existingScore);
    navigate('scoring');
}

function renderForm(existingScore = null) {
    const s = state.currentStation;
    const e = state.currentEntity;
    const btnSubmit = document.getElementById('btn-submit');
    const header = document.querySelector('header');

    let draftData = null;
    if (!existingScore) {
        const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
        draftData = drafts[`${s.id}_${e.id}`];
    }

    if (existingScore) {
        document.getElementById('header-title').textContent = `EDIT: ${formatGameTitle(s)}`;
        header.style.backgroundColor = '#f39c12';
        header.style.color = '#fff';
        btnSubmit.innerText = 'Re-Submit Score';
        btnSubmit.classList.add('btn-warning');
    } else {
        document.getElementById('header-title').textContent = formatGameTitle(s);
        header.style.backgroundColor = '';
        header.style.color = '';
        btnSubmit.innerText = 'Submit Score';
        btnSubmit.classList.remove('btn-warning');
        btnSubmit.classList.add('btn-secondary');
    }

    document.getElementById('header-subtitle').textContent = formatEntityLabel(e); // USE FORMATTER
    document.getElementById('header-subtitle').style.display = 'block';

    els.scoreForm.innerHTML = '';
    const fields = [...(s.fields||[]), ...(state.config.common_scoring||[])].filter(f => f.audience === 'judge');

    if (fields.length > 0) {
        fields.forEach(f => {
            let val = null;
            if (existingScore) val = existingScore.score_payload[f.id];
            else if (draftData) val = draftData[f.id];
            els.scoreForm.innerHTML += generateFieldHTML(f, val);
        });
    }

    els.scoreForm.querySelectorAll('input, select, textarea').forEach(input => {
        input.addEventListener('input', () => saveDraft());
    });
}

function saveDraft() {
    if (!state.currentStation || !state.currentEntity) return;
    const draftKey = `${state.currentStation.id}_${state.currentEntity.id}`;
    const payload = {};
    const allFields = [...(state.currentStation.fields||[]), ...(state.config.common_scoring||[])];
    for(const f of allFields) {
        const el = document.getElementById(`f_${f.id}`);
        if (f.type === 'timed' || f.type === 'stopwatch') {
            const mm = document.getElementById(`f_${f.id}_mm`)?.value || '';
            const ss = document.getElementById(`f_${f.id}_ss`)?.value || '';
            if (mm || ss) payload[f.id] = `${mm.padStart(2,'0')}:${ss.padStart(2,'0')}`;
        } else if (f.type === 'boolean') payload[f.id] = el?.checked;
        else if (el) payload[f.id] = el.value;
    }
    const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
    drafts[draftKey] = payload;
    localStorage.setItem('coyote_drafts', JSON.stringify(drafts));
}

function submitScore(e) {
    e.preventDefault();
    if(!state.currentStation || !state.currentEntity) return;
    const payload = {};
    const fields = [...(state.currentStation.fields||[]), ...(state.config.common_scoring||[])];
    fields.forEach(f => {
        const el = document.getElementById(`f_${f.id}`);
        if(f.type === 'boolean') payload[f.id] = el?.checked;
        else if(f.type === 'timed' || f.type === 'stopwatch') {
            combineTime(f.id);
            payload[f.id] = document.getElementById(`f_${f.id}_val`).value;
        }
        else if(el) payload[f.id] = el.value;
    });
    const queue = syncManager.getQueue();
    const existing = queue.find(s => s.game_id === state.currentStation.id && s.entity_id === state.currentEntity.id);
    const packet = {
        uuid: existing ? existing.uuid : crypto.randomUUID(),
        game_id: state.currentStation.id,
        entity_id: state.currentEntity.id,
        score_payload: payload,
        timestamp: Date.now(),
        judge_name: els.judgeName.value,
        judge_email: els.judgeEmail.value,
        judge_unit: els.judgeUnit.value
    };
    if(packet.judge_email) localStorage.setItem('judge_info', JSON.stringify({name:packet.judge_name, email:packet.judge_email, unit:packet.judge_unit}));
    syncManager.addToQueue(packet);
    const draftKey = `${state.currentStation.id}_${state.currentEntity.id}`;
    const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
    delete drafts[draftKey];
    localStorage.setItem('coyote_drafts', JSON.stringify(drafts));
    updateSyncCounts();
    alert('Score Saved!');
    renderEntityList();
    navigate('entity');
    if(state.isOnline) syncManager.sync().then(updateSyncCounts);
}

// --- STOPWATCH LOGIC ---
let activeTimerId = null;
let activeTimerInterval = null;
let activeTimerStartedAt = 0;
let activeTimerOffset = 0;
let isPaused = false;

function startStopwatch(id) {
    if (activeTimerId && activeTimerId !== id) {
        if(!confirm("Another timer is running. Stop it and start this one?")) return;
        stopStopwatch();
    }
    const dock = document.getElementById('stopwatch-dock');
    const btnPause = document.getElementById('dock-btn-pause');
    const btnReset = document.getElementById('dock-btn-reset');
    const btnStop = document.getElementById('dock-btn-stop');

    if (activeTimerId !== id) {
        activeTimerId = id;
        activeTimerOffset = 0;
        isPaused = false;
        activeTimerStartedAt = Date.now();
        document.getElementById(`f_${id}_mm`).value = '';
        document.getElementById(`f_${id}_ss`).value = '';
    } else if (isPaused) {
        isPaused = false;
        activeTimerStartedAt = Date.now();
    }
    dock.classList.add('active');
    document.body.style.paddingBottom = '100px';
    btnPause.innerText = "PAUSE";
    btnPause.classList.remove('btn-success');
    btnPause.classList.add('btn-warning');
    btnStop.onclick = () => stopStopwatch();
    btnPause.onclick = () => {
        if (isPaused) {
            isPaused = false;
            activeTimerStartedAt = Date.now();
            btnPause.innerText = "PAUSE";
            btnPause.classList.remove('btn-success');
            btnPause.classList.add('btn-warning');
            activeTimerInterval = setInterval(tick, 100);
        } else {
            isPaused = true;
            clearInterval(activeTimerInterval);
            activeTimerOffset += (Date.now() - activeTimerStartedAt);
            btnPause.innerText = "RESUME";
            btnPause.classList.remove('btn-warning');
            btnPause.classList.add('btn-success');
        }
    };
    btnReset.onclick = () => {
        if(confirm("Reset timer to 00:00?")) {
            activeTimerOffset = 0;
            activeTimerStartedAt = Date.now();
            if(isPaused) document.getElementById('dock-display').innerText = "00:00";
        }
    };
    if (activeTimerInterval) clearInterval(activeTimerInterval);
    activeTimerInterval = setInterval(tick, 100);
}

function tick() {
    if (isPaused) return;
    const now = Date.now();
    const totalMs = (now - activeTimerStartedAt) + activeTimerOffset;
    const totSec = Math.floor(totalMs / 1000);
    const m = Math.floor(totSec / 60);
    const s = totSec % 60;
    document.getElementById('dock-display').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
}

function stopStopwatch() {
    if(!activeTimerId) return;
    if (!isPaused) activeTimerOffset += (Date.now() - activeTimerStartedAt);
    const finalSec = Math.floor(activeTimerOffset / 1000);
    const m = Math.floor(finalSec / 60);
    const s = finalSec % 60;
    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
    isPaused = false;
    document.getElementById('stopwatch-dock').classList.remove('active');
    document.body.style.paddingBottom = '0';
    const mmInput = document.getElementById(`f_${activeTimerId}_mm`);
    const ssInput = document.getElementById(`f_${activeTimerId}_ss`);
    if(mmInput && ssInput) {
        mmInput.value = m;
        ssInput.value = s;
        combineTime(activeTimerId);
    }
    activeTimerId = null;
}

function combineTime(id) {
    const m = document.getElementById(`f_${id}_mm`).value || '00';
    const s = document.getElementById(`f_${id}_ss`).value || '00';
    document.getElementById(`f_${id}_val`).value = `${m.padStart(2,'0')}:${s.padStart(2,'0')}`;
    saveDraft();
}

// --- BRACKET LOGIC (UPDATED) ---

function initBracketState(gameId) {
    if (!state.bracketData[gameId]) {
        state.bracketData[gameId] = { rounds: [], active: false };
    }
    return state.bracketData[gameId];
}

function saveBracketState() {
    localStorage.setItem('coyote_bracket_data', JSON.stringify(state.bracketData));
}

// 1. LOBBY
function renderBracketLobby() {
    const s = state.currentStation;

    // Update Header
    document.getElementById('header-title').textContent = `${s.name} (Lobby)`;

    // 1. Detect if Event is already running
    const bracket = state.bracketData[s.id];
    const activeIds = new Set();
    let isRunning = false;

    if (bracket && bracket.rounds.length > 0) {
        isRunning = true;
        // Collect all teams currently in the active round (Pool + Heats)
        const round = bracket.rounds[state.currentRoundIdx];
        if (round) {
            round.pool.forEach(id => activeIds.add(id));
            round.heats.forEach(h => h.teams.forEach(id => activeIds.add(id)));
        }
    }

    // 2. Render Team List (Pre-check active teams)
    const requiredType = s.type || state.viewMode;
    const entities = state.entities.filter(e => e.type === requiredType).sort((a,b) => (parseInt(a.troop_number)||0) - (parseInt(b.troop_number)||0));

    els.lobbyList.innerHTML = entities.map(e => {
        const isChecked = activeIds.has(e.id) ? 'checked' : '';
        // Visual cue: If they are already in, maybe bold them or dim the checkbox slightly?
        // For now, simple check is sufficient.
        return `
        <label class="list-group-item d-flex gap-3 align-items-center py-3">
            <input class="form-check-input flex-shrink-0" type="checkbox" value="${e.id}" ${isChecked} style="transform: scale(1.3);">
            <div>
                <div class="fw-bold" style="font-size: 1.1rem;">${formatEntityLabel(e)}</div>
                <div class="small text-muted">ID: #${e.id}</div>
            </div>
        </label>`;
    }).join('');

    // 3. Update Button Text (Start vs Update)
    // We look for the green button in the sticky header
    const btnStart = document.querySelector('#view-bracket-lobby .btn-success');
    if (btnStart) {
        btnStart.textContent = isRunning ? "Update Event" : "Start Event";
    }
}

function bracketSelectAll(checked) {
    els.lobbyList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = checked);
}

function bracketStartEvent() {
    const s = state.currentStation;
    const checked = [...document.querySelectorAll('#bracket-lobby-list input:checked')].map(i => i.value);

    if (checked.length < 2) return alert("Select at least 2 teams.");

    let bracket = state.bracketData[s.id];

    if (!bracket) {
        // CASE A: NEW EVENT
        state.bracketData[s.id] = {
            rounds: [{ name: "Round 1", pool: checked, heats: [] }]
        };
        state.currentRoundIdx = 0;
    } else {
        // CASE B: LATE ADD (Update Existing)
        const round = bracket.rounds[state.currentRoundIdx];

        // 1. Identify who is already here
        const existing = new Set([...round.pool]);
        round.heats.forEach(h => h.teams.forEach(t => existing.add(t)));

        // 2. Find the "New" folks
        const newTeams = checked.filter(id => !existing.has(id));

        if (newTeams.length > 0) {
            // 3. Add them to the pool
            round.pool.push(...newTeams);
            alert(`✅ Added ${newTeams.length} new team(s) to ${round.name}.`);
        } else {
            // No new teams found. (User might have just clicked "Update" without changing anything)
            // We just proceed.
        }
    }

    saveBracketState();
    navigate('bracketRound');
}

// 2. ROUND MANAGER
function renderBracketRound() {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];

    // Header Updates
    document.getElementById('header-title').textContent = state.currentStation.name;
    document.getElementById('bracket-round-title').innerText = round.name;
    document.getElementById('bracket-pool-count').innerText = round.pool.length;

    const container = document.getElementById('bracket-unified-list');
    let html = '';

    // SECTION A: The Pool
    if (round.pool.length > 0) {
        html += `<h6 class="text-uppercase text-muted fw-bold small mt-2 mb-2 ps-1">Holding Pool</h6>`;
        html += '<div class="list-group mb-4 shadow-sm">';
        html += round.pool.map(eid => {
            const e = state.entities.find(x => x.id === eid);
            const label = formatEntityLabel(e);
            return `
            <label class="list-group-item d-flex justify-content-between align-items-center p-3">
                <div class="d-flex align-items-center gap-3 overflow-hidden">
                    <input class="form-check-input form-check-pool flex-shrink-0" type="checkbox" value="${eid}" style="transform: scale(1.3);">
                    <div class="fw-bold text-truncate">${label}</div>
                </div>
                <div class="d-flex gap-2">
                     <button class="btn btn-sm btn-outline-danger py-0 px-2" onclick="event.preventDefault(); app.bracketScratchTeam('${eid}')" style="font-size: 0.8rem;">Scratch</button>
                     <button class="btn btn-sm btn-outline-secondary py-0 px-2" onclick="event.preventDefault(); app.bracketGrantBye('${eid}')" style="font-size: 0.8rem;">Bye</button>
                </div>
            </label>`;
        }).join('');
        html += '</div>';
    } else {
        html += `<div class="alert alert-light text-center text-muted border border-dashed mb-4">All teams assigned to heats.</div>`;
    }

    // SECTION B: The Heats (Button Style Fix)
    if (round.heats.length > 0) {
        html += `<h6 class="text-uppercase text-muted fw-bold small mb-2 ps-1 border-top pt-3">Active Heats</h6>`;

        const sortedHeats = [...round.heats].sort((a,b) => (a.complete === b.complete) ? 0 : a.complete ? 1 : -1);

        html += sortedHeats.map((heat) => {
            const originalIdx = round.heats.findIndex(h => h.id === heat.id);
            const teamListHtml = heat.teams.map(eid => {
                const e = state.entities.find(x => x.id === eid);
                const label = formatEntityLabel(e);
                const res = heat.results[eid] || {};
                const advIcon = res.advance ? '⏩' : '⏹️';
                const advClass = res.advance ? 'active' : '';
                const rowClass = res.advance ? 'bg-success-subtle' : '';

                return `
                    <div class="d-flex justify-content-between align-items-center py-2 px-2 border-bottom ${rowClass}">
                        <span>${label}</span>
                        <span class="advance-star ${advClass}" onclick="app.bracketToggleAdvance(${originalIdx}, '${eid}', event)" title="Toggle Advance" style="font-size: 1.4rem;">${advIcon}</span>
                    </div>`;
            }).join('');

            // Status Badge OR Quick Save Button
            let statusAction = '';
            let borderClass = '';

            if (heat.complete) {
                statusAction = '<span class="badge bg-success">Scored</span>';
                borderClass = 'border-success';
            } else {
                // FIXED: w-auto, flex-grow-0, and outline-secondary (Grey)
                statusAction = `
                    <button class="btn btn-sm btn-outline-secondary py-0 px-2 w-auto flex-grow-0 shadow-none" onclick="event.stopPropagation(); app.bracketQuickSave(${originalIdx})" title="Quick Save Results" style="line-height: 1.5;">
                        💾 Save
                    </button>`;
                borderClass = 'border-warning';
            }

            return `
            <div class="card shadow-sm mb-3 border-start border-4 ${borderClass}" onclick="app.bracketOpenHeat(${originalIdx})">
                <div class="card-header bg-white d-flex justify-content-between align-items-center py-2">
                    <span class="fw-bold text-truncate me-2">${heat.name}</span>
                    ${statusAction}
                </div>
                <div class="card-body p-0">
                    ${teamListHtml}
                </div>
            </div>`;
        }).join('');
    }

    container.innerHTML = html;

    // SECTION C: Footer (Unchanged)
    const footerOpts = document.getElementById('bracket-footer-options');
    const advanceBtn = document.getElementById('btn-bracket-advance');

    if (footerOpts && advanceBtn) {
        const isSingleHeatAndEmpty = (round.heats.length === 1 && round.pool.length === 0);
        const showOptions = isSingleHeatAndEmpty || (round.isFinalRound === true);

        if (showOptions) {
            if (round.isFinalRound === undefined) round.isFinalRound = true;
            const checkedAttr = round.isFinalRound ? 'checked' : '';
            footerOpts.innerHTML = `
                <div class="form-check form-switch d-flex justify-content-center align-items-center gap-2 p-2 bg-light rounded border">
                    <input class="form-check-input" type="checkbox" id="chk-is-final" ${checkedAttr} style="cursor:pointer; transform: scale(1.2);">
                    <label class="form-check-label fw-bold" for="chk-is-final" style="cursor:pointer;">This is the Final Round</label>
                </div>`;
            const updateButton = () => {
                const isFinal = document.getElementById('chk-is-final').checked;
                round.isFinalRound = isFinal;
                saveBracketState();
                if (isFinal) {
                    advanceBtn.innerHTML = "🏆 SUBMIT FINAL RESULTS";
                    advanceBtn.classList.remove('btn-success');
                    advanceBtn.classList.add('btn-warning');
                } else {
                    advanceBtn.innerHTML = "NEXT ROUND >>";
                    advanceBtn.classList.remove('btn-warning');
                    advanceBtn.classList.add('btn-success');
                }
            };
            document.getElementById('chk-is-final').onchange = updateButton;
            updateButton();
        } else {
            footerOpts.innerHTML = '';
            advanceBtn.innerHTML = "NEXT ROUND >>";
            advanceBtn.classList.remove('btn-warning');
            advanceBtn.classList.add('btn-success');
        }
    }
}

// 1. Unified Bye Logic
function bracketGrantBye(eid) {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];

    // Find or Create a "Byes" heat
    let byeHeat = round.heats.find(h => h.name === "Byes");
    if (!byeHeat) {
        byeHeat = {
            id: crypto.randomUUID(),
            name: "Byes",
            teams: [],
            results: {},
            complete: true // Byes are auto-complete
        };
        round.heats.push(byeHeat);
    }

    // Move Team
    const poolIdx = round.pool.indexOf(eid);
    if (poolIdx > -1) round.pool.splice(poolIdx, 1);

    byeHeat.teams.push(eid);
    byeHeat.results[eid] = { advance: true, notes: "Bye" }; // Auto-advance

    saveBracketState();
    renderBracketRound();
}

// 2. Scratch Logic
function bracketScratchTeam(eid) {
    if (!confirm("Scratch this team? They will be removed from the tournament.")) return;

    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];

    // Find or Create a "Scratched" heat (to keep record)
    let scratchHeat = round.heats.find(h => h.name === "Scratched");
    if (!scratchHeat) {
        scratchHeat = {
            id: crypto.randomUUID(),
            name: "Scratched",
            teams: [],
            results: {},
            complete: true
        };
        round.heats.push(scratchHeat);
    }

    // Move Team
    const poolIdx = round.pool.indexOf(eid);
    if (poolIdx > -1) round.pool.splice(poolIdx, 1);

    scratchHeat.teams.push(eid);
    scratchHeat.results[eid] = { advance: false, notes: "Scratched" }; // Do NOT advance

    saveBracketState();
    renderBracketRound();
}

// 3. Quick Save Logic
function bracketQuickSave(heatIdx) {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];
    const heat = round.heats[heatIdx];

    // Validate: At least one person must be marked (Advance or Not)
    // Actually, simply clicking save is enough to "Complete" it.

    heat.complete = true;

    // Generate UUIDs for results if missing
    heat.teams.forEach(eid => {
        if (!heat.results[eid]) heat.results[eid] = { advance: false };
        if (!heat.results[eid].uuid) heat.results[eid].uuid = crypto.randomUUID();
    });

    saveBracketState();
    updateSyncCounts();
    if (state.isOnline) syncManager.sync();

    renderBracketRound();
    // Don't alert, just update UI (Speed!)
}

function bracketAdvanceRound() {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];

    // 1. Calculate Winners/Losers (Relaxed Logic)
    const winners = [];
    const losers = [];

    round.heats.forEach(h => {
        // We now iterate ALL teams in the heat, ignoring the 'complete' status.
        // This allows "Quick Toggles" on Pending heats to work.
        h.teams.forEach(eid => {
            const res = h.results[eid];
            if (res && res.advance) {
                winners.push(eid);
            } else {
                // If they have no result OR advance is false, they are a loser
                losers.push(eid);
            }
        });
    });

    if (winners.length === 0) return alert("No teams marked to advance! Select winners using the arrows (⏩).");

    // 2. DETECT END GAME
    const finalCheckbox = document.getElementById('chk-is-final');
    const isExplicitFinal = finalCheckbox ? finalCheckbox.checked : false;

    // Logic: Explicit Checkbox OR Implicit Single Winner
    const shouldFinish = (finalCheckbox && isExplicitFinal) || (!finalCheckbox && winners.length === 1);

    if (shouldFinish) {
        openPodiumModal(winners, losers);
        return;
    }

    // 3. Normal Advance (Create Next Round)
    if (!confirm(`Create Round ${state.currentRoundIdx + 2} with ${winners.length} advancing teams?`)) return;

    state.bracketData[gameId].rounds.push({
        name: `Round ${state.currentRoundIdx + 2}`,
        pool: winners,
        heats: []
    });
    saveBracketState();
    state.currentRoundIdx++;
    renderBracketRound();
}

function bracketToggleAdvance(heatIdx, eid, event) {
    event.stopPropagation();
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];
    const heat = round.heats[heatIdx];
    if(!heat.results[eid]) heat.results[eid] = {};
    heat.results[eid].advance = !heat.results[eid].advance;
    saveBracketState();
    renderBracketRound();
}

function bracketCreateHeat() {
    const checked = Array.from(document.querySelectorAll('.form-check-pool:checked')).map(cb => cb.value);
    if (checked.length === 0) return alert("Select teams from pool first.");
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];
    round.pool = round.pool.filter(id => !checked.includes(id));
    const heatNum = round.heats.length + 1;
    round.heats.push({ id: Date.now(), name: `Heat ${heatNum}`, teams: checked, complete: false, results: {} });
    saveBracketState();
    renderBracketRound();
}

// Add this helper for the Heat View (Toggles UI only, save happens later)
function toggleHeatAdvance(el) {
    el.classList.toggle('active');
    // Swap icon based on state
    el.innerText = el.classList.contains('active') ? '⏩' : '⏹️';
}

function bracketOpenHeat(heatIdx) {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];
    const heat = round.heats[heatIdx];
    state.currentHeatId = heat.id;
    document.getElementById('heat-title').innerText = `${round.name} - ${heat.name}`;

    const fields = [...(state.currentStation.fields||[]), ...(state.config.common_scoring||[])].filter(f => f.audience === 'judge');

    const headerLabel = fields.length === 1 ? fields[0].label : "Results";
    document.getElementById('heat-header-score').innerText = headerLabel;

    els.heatContainer.innerHTML = heat.teams.map(eid => {
        const e = state.entities.find(x => x.id === eid);
        const label = formatEntityLabel(e);
        const result = heat.results[eid] || {};

        // Icon Logic: Match the Round View style
        const advIcon = result.advance ? '⏩' : '⏹️';
        const advClass = result.advance ? 'active' : '';

        const inputsHtml = fields.map(f => {
            const val = result[f.id] || '';

            if (f.type === 'timed' || f.type === 'stopwatch') {
                 let [mm, ss] = (val && val.includes(':')) ? val.split(':') : ['',''];
                 return `
                 <div class="input-group input-group-sm mb-1 justify-content-center">
                    <input type="number" class="form-control text-center px-0 heat-input-mm" data-fid="${f.id}" value="${mm}" placeholder="MM" style="max-width: 45px;">
                    <span class="input-group-text px-1">:</span>
                    <input type="number" class="form-control text-center px-0 heat-input-ss" data-fid="${f.id}" value="${ss}" placeholder="SS" style="max-width: 45px;">
                 </div>`;
            } else if (f.type === 'boolean') {
                 const checked = val === true ? 'checked' : '';
                 return `<div class="d-flex justify-content-center mb-1"><input type="checkbox" class="form-check-input heat-input-bool" data-fid="${f.id}" ${checked}></div>`;
            } else {
                const type = f.type === 'number' ? 'number' : 'text';
                return `<input type="${type}" class="form-control form-control-sm text-center mb-1 heat-input" data-fid="${f.id}" value="${val}" placeholder="${f.placeholder||''}" style="max-width: 100%;">`;
            }
        }).join('');

        return `
        <div class="d-flex align-items-center border-bottom py-3 entity-score-row" data-id="${eid}">
            <div style="width: 45%;" class="ps-3 fw-bold text-truncate" title="${label}">${label}</div>
            <div style="width: 35%;" class="px-1">${inputsHtml}</div>
            <div style="width: 20%;" class="text-center">
                <span class="advance-star ${advClass}" onclick="app.toggleHeatAdvance(this)" style="cursor: pointer; font-size: 1.5rem;">${advIcon}</span>
            </div>
        </div>`;
    }).join('');

    navigate('bracketHeat');
}

function bracketSaveHeat() {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];
    const heat = round.heats.find(h => h.id === state.currentHeatId);
    if (!heat) return;

    document.querySelectorAll('.entity-score-row').forEach(row => {
        const eid = row.dataset.id;
        const payload = {};
        const fields = [...(state.currentStation.fields||[]), ...(state.config.common_scoring||[])];

        fields.forEach(f => {
             if (f.type === 'timed' || f.type === 'stopwatch') {
                 const mm = row.querySelector(`.heat-input-mm[data-fid="${f.id}"]`)?.value || '00';
                 const ss = row.querySelector(`.heat-input-ss[data-fid="${f.id}"]`)?.value || '00';
                 payload[f.id] = `${mm.padStart(2,'0')}:${ss.padStart(2,'0')}`;
             } else if (f.type === 'boolean') {
                 const el = row.querySelector(`.heat-input-bool[data-fid="${f.id}"]`);
                 payload[f.id] = el ? el.checked : false;
             } else {
                 const el = row.querySelector(`.heat-input[data-fid="${f.id}"]`);
                 if(el) payload[f.id] = el.value;
             }
        });

        // Updated Logic: Check for 'active' class on the span instead of checkbox
        const shouldAdvance = row.querySelector('.advance-star').classList.contains('active');
        heat.results[eid] = { ...payload, advance: shouldAdvance };

        if (!heat.results[eid].uuid) heat.results[eid].uuid = crypto.randomUUID();

        const serverPayload = { ...payload, heat: heat.name, round: round.name };
        const packet = {
            uuid: heat.results[eid].uuid,
            game_id: gameId,
            entity_id: eid,
            score_payload: serverPayload,
            timestamp: Date.now(),
            judge_name: els.judgeName.value,
            judge_email: els.judgeEmail.value,
            judge_unit: els.judgeUnit.value
        };
        syncManager.addToQueue(packet);
    });

    heat.complete = true;
    saveBracketState();
    updateSyncCounts();
    if (state.isOnline) syncManager.sync();

    renderBracketRound();
    alert("Heat Saved.");
    navigate('bracketRound');
}

// Don't forget to export the new helper!
window.app = {
    init, navigate, handleBack, refreshData, selectStation, selectEntity,
    submitScore, setMode, promptNewEntity, toggleJudgeModal, saveJudgeInfo,
    saveDraft, combineTime, resetAppData, bracketQuickSave, bracketScratchTeam,
    // Bracket Exports
    bracketSelectAll, bracketStartEvent, bracketCreateHeat, bracketOpenHeat,
    bracketSaveHeat, bracketAdvanceRound, bracketRenameRound, bracketToggleAdvance,
    bracketGrantBye, toggleHeatAdvance
};

function bracketRenameRound() {
    const gameId = state.currentStation.id;
    const round = state.bracketData[gameId].rounds[state.currentRoundIdx];
    const newName = prompt("Rename Round:", round.name);
    if (newName) {
        round.name = newName;
        saveBracketState();
        renderBracketRound();
    }
}

// --- Data & Helpers ---

function updateOnlineStatus() {
    state.isOnline = navigator.onLine;
    const c = syncManager.getCounts().unsynced;
    if(els.unsyncedCount) els.unsyncedCount.textContent = c;
    if (c > 0 && state.isOnline) { els.status.textContent = 'Sync'; els.status.className = 'status-sync ms-2'; }
    else { els.status.textContent = state.isOnline ? 'Online' : 'Offline'; els.status.className = (state.isOnline ? 'status-online' : 'status-offline') + ' ms-2'; }
}

async function refreshData() {
    try {
        const ts = Date.now();
        const [cRes, eRes] = await Promise.all([fetch('/games.json?t='+ts), fetch('/api/entities?t='+ts)]);
        if (cRes.ok && eRes.ok) {
            const sc = await cRes.json();
            const config = { stations: sc.games, common_scoring: sc.common_scoring||[] };
            state.config = config;
            state.entities = await eRes.json();
            localStorage.setItem('coyote_config', JSON.stringify(config));
            localStorage.setItem('coyote_entities', JSON.stringify(state.entities));
            renderStationList();
        }
    } catch(e) { console.error(e); }
}

function loadLocalData() {
    try {
        const c = localStorage.getItem('coyote_config');
        const e = localStorage.getItem('coyote_entities');
        if (c) state.config = JSON.parse(c);
        if (e) state.entities = JSON.parse(e);
    } catch (e) {}
}

function loadJudgeInfo() {
    const j = JSON.parse(localStorage.getItem('judge_info')||'{}');
    if(els.judgeName) els.judgeName.value = j.name||'';
    if(els.judgeEmail) els.judgeEmail.value = j.email||'';
    if(els.judgeUnit) els.judgeUnit.value = j.unit||'';
    if(j.name && document.getElementById('welcome-text')) document.getElementById('welcome-text').textContent = `Welcome, ${j.name.split(' ')[0]}.`;
    else toggleJudgeModal(true);
}

function toggleJudgeModal(show) {
    const m = document.getElementById('judge-modal');
    if(show===true) m.classList.remove('hidden');
    else if(show===false) m.classList.add('hidden');
    else m.classList.toggle('hidden');
}

function saveJudgeInfo() {
    const j = { name: els.judgeName.value.trim(), email: els.judgeEmail.value.trim(), unit: els.judgeUnit.value.trim() };
    if(!j.email) return alert("Email required.");
    localStorage.setItem('judge_info', JSON.stringify(j));
    if(j.name) document.getElementById('welcome-text').textContent = `Welcome, ${j.name.split(' ')[0]}.`;
    toggleJudgeModal(false);
}

async function promptNewEntity(type) {
    const n = prompt(`Name for new ${type}:`); if(!n) return;
    const t = prompt("Troop Number:"); if(!t) return;
    try {
        const r = await fetch('/api/entities', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:n, type, troop_number:t}) });
        if(r.ok) {
            state.entities.push(await r.json());
            localStorage.setItem('coyote_entities', JSON.stringify(state.entities));
            renderEntityList();
        }
    } catch(e) { alert("Error"); }
}

function showEntitySelect() { navigate('entity'); }
function updateSyncCounts() { updateOnlineStatus(); }
async function handleSync() { if(state.isOnline) await syncManager.sync(); updateSyncCounts(); }


if (!window.startStopwatch) {
    window.startStopwatch = startStopwatch;
    window.stopStopwatch = stopStopwatch;
}

window.onload = init;