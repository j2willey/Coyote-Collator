import { SyncManager } from './sync-manager.js';

const syncManager = new SyncManager();

const state = {
    config: null,
    entities: [],
    currentStation: null,
    currentEntity: null,
    isOnline: navigator.onLine,
    viewMode: 'patrol' // NEW: Default to Patrols
};

// UI References
const els = {
    status: document.getElementById('status-indicator'),
    unsyncedCount: document.getElementById('unsynced-count'),
    stationList: document.getElementById('station-list'),
    entityList: document.getElementById('entity-list'),
    entitySearch: document.getElementById('entity-search'),
    entityHeader: document.getElementById('entity-header'),
    scoreForm: document.getElementById('score-form'),
    scoringTitle: document.getElementById('scoring-title'),
    scoringTeam: document.getElementById('scoring-team'),
    lastUpdated: document.getElementById('last-updated'),
    judgeName: document.getElementById('judge-name'),
    judgeEmail: document.getElementById('judge-email'),
    judgeUnit: document.getElementById('judge-unit'),
    modeTabs: document.getElementById('mode-tabs') // We will add this container in HTML
};

const views = {
    home: document.getElementById('view-home'),
    entity: document.getElementById('view-entity'),
    scoring: document.getElementById('view-scoring')
};

// --- Initialization ---

async function init() {
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    loadLocalData();
    loadJudgeInfo();

    // Inject the Toggle Tabs into the UI if missing
    injectModeTabs();

    if (state.isOnline) await refreshData();

    renderStationList();
    updateSyncCounts();

    // Listeners
    document.getElementById('btn-sync').addEventListener('click', handleSync);
    document.getElementById('btn-reload-data').addEventListener('click', refreshData);
    els.entitySearch.addEventListener('input', (e) => renderEntityList(e.target.value));
    document.getElementById('btn-submit').addEventListener('click', submitScore);
}

// NEW: Inject Tabs for Patrol vs Troop
function injectModeTabs() {
    const stationList = document.getElementById('station-list');
    if (!stationList) return;

    const container = stationList.parentNode;

    // Create the tabs container above the station list
    const tabContainer = document.createElement('div');
    tabContainer.style.cssText = "display: flex; gap: 10px; margin-bottom: 1rem;";

    tabContainer.innerHTML = `
        <div style="flex:1">
            <input type="radio" name="vmode" id="mode-patrol" style="display:none" checked>
            <label class="btn" id="btn-mode-patrol" for="mode-patrol" onclick="app.setMode('patrol')">Patrol Events</label>
        </div>
        <div style="flex:1">
            <input type="radio" name="vmode" id="mode-troop" style="display:none">
            <label class="btn btn-outline" id="btn-mode-troop" for="mode-troop" onclick="app.setMode('troop')">Troop Events</label>
        </div>
    `;

    // Insert before the list
    container.insertBefore(tabContainer, stationList);
}

function setMode(mode) {
    state.viewMode = mode;

    // Update UI tabs
    const pBtn = document.getElementById('btn-mode-patrol');
    const tBtn = document.getElementById('btn-mode-troop');

    if (pBtn && tBtn) {
        if (mode === 'patrol') {
            pBtn.className = 'btn';
            tBtn.className = 'btn btn-outline';
        } else {
            pBtn.className = 'btn btn-outline';
            tBtn.className = 'btn';
        }
    }

    renderStationList();
}

function updateOnlineStatus() {
    state.isOnline = navigator.onLine;
    els.status.textContent = state.isOnline ? 'Online' : 'Offline';
    els.status.className = state.isOnline ? 'status-online' : 'status-offline';
}

function loadJudgeInfo() {
    try {
        const stored = localStorage.getItem('judge_info');
        if (stored) {
            const j = JSON.parse(stored);
            if(els.judgeName) els.judgeName.value = j.name || '';
            if(els.judgeEmail) els.judgeEmail.value = j.email || '';
            if(els.judgeUnit) els.judgeUnit.value = j.unit || '';
        }
    } catch(e) {}
}

// --- Data & Sync ---

function loadLocalData() {
    try {
        const c = localStorage.getItem('coyote_config');
        const e = localStorage.getItem('coyote_entities');
        if (c) state.config = JSON.parse(c);
        if (e) state.entities = JSON.parse(e);
    } catch (err) { console.error(err); }
}

async function refreshData() {
    console.log("Starting data refresh...");
    try {
        const ts = Date.now();
        console.log("Fetching /games.json and /api/entities...");
        const [configRes, entitiesRes] = await Promise.all([
            fetch('/games.json?t=' + ts),
            fetch('/api/entities?t=' + ts)
        ]);

        console.log(`Fetch response: games (${configRes.status}), entities (${entitiesRes.status})`);

        if (configRes.ok && entitiesRes.ok) {
            const serverConfig = await configRes.json();
            const entities = await entitiesRes.json();

            const config = {
                stations: serverConfig.games,
                common_scoring: serverConfig.common_scoring || []
            };

            state.config = config;
            state.entities = entities;

            localStorage.setItem('coyote_config', JSON.stringify(config));
            localStorage.setItem('coyote_entities', JSON.stringify(entities));

            renderStationList();
            console.log("Data refreshed. Mode:", state.viewMode);
        } else {
            throw new Error(`Server returned error: Config ${configRes.status} / Entities ${entitiesRes.status}`);
        }
    } catch (err) {
        console.error('Network error', err);
        els.stationList.innerHTML = `<div class="p-4 text-center text-danger">Failed to load games.<br><small>${err.message}</small><br><button class="btn btn-sm btn-primary mt-2" onclick="app.refreshData()">Retry</button></div>`;
    }
}

function updateSyncCounts() {
    els.unsyncedCount.textContent = syncManager.getCounts().unsynced;
}

async function handleSync() {
    if (!state.isOnline) return alert('Must be online');
    document.getElementById('btn-sync').textContent = 'Syncing...';
    try {
        const res = await syncManager.sync();
        alert(`Synced: ${res.synced}, Errors: ${res.errors}`);
        updateSyncCounts();
    } finally {
        document.getElementById('btn-sync').textContent = 'Sync Scores Now';
    }
}

// --- Navigation & Rendering ---

function navigate(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');
    window.scrollTo(0,0);
}

// Helper: Format
function formatGameTitle(game) {
    if (!game) return '';
    if (game.name.match(/^(Game|Exhibition|p\d)/i)) return game.name;
    const match = game.id.match(/(\d+)/);
    const num = match ? match[1] : '';
    if (num) return `Game ${num}. ${game.name}`;
    return game.name;
}

function renderStationList() {
    if (!state.config || !state.config.stations) {
        els.stationList.innerHTML = `<div class="p-4 text-center text-muted">Loading games...<br><button class="btn btn-sm btn-primary mt-2" onclick="app.refreshData()">Retry</button></div>`;
        return;
    }

    // FILTER: Only show games that match the current view mode (Patrol vs Troop)
    // If a game has no type defined, we show it in both (fail-safe)
    const filteredStations = state.config.stations.filter(s =>
        !s.type || s.type === state.viewMode
    );

    if (filteredStations.length === 0) {
        els.stationList.innerHTML = `<div class="alert alert-info text-center">No ${state.viewMode} games found.</div>`;
        return;
    }

    els.stationList.innerHTML = filteredStations.map(s => `
        <button class="btn btn-outline-dark w-100 mb-2 text-start p-3 shadow-sm" onclick="app.selectStation('${s.id}')">
            <div class="fw-bold">${formatGameTitle(s)}</div>
            <small class="text-muted text-uppercase" style="font-size:0.75rem;">${s.type || 'General'}</small>
        </button>
    `).join('');
}

function selectStation(id) {
    state.currentStation = state.config.stations.find(s => s.id === id);
    if(state.currentStation) {
        renderEntityList();
        navigate('entity');
    }
}

function renderEntityList(filter = '') {
    if (!state.currentStation) return;

    // We enforce the type based on the Game Type (which matches the View Mode)
    const requiredType = state.currentStation.type || state.viewMode;
    const term = filter.toLowerCase();

    const filtered = state.entities.filter(e =>
        e.type === requiredType &&
        (e.name.toLowerCase().includes(term) || e.troop_number.includes(term))
    );

    els.entityHeader.textContent = `Select ${requiredType === 'patrol' ? 'Patrol' : (requiredType === 'exhibition' ? 'Exhibition Team' : 'Troop')}`;

    // REGISTRATION BUTTON (Context Aware)
    const typeLabel = requiredType === 'patrol' ? 'Patrol' : (requiredType === 'exhibition' ? 'Exhibition Team' : 'Troop');
    const addButton = `
        <button class="list-group-item list-group-item-action p-3 text-center text-primary fw-bold"
                onclick="app.promptNewEntity('${requiredType}')"
                style="border: 2px dashed var(--bs-primary); margin-bottom: 8px;">
            <span style="font-size: 1.2rem;">➕ Register New ${typeLabel}</span>
        </button>
    `;

    const listHtml = filtered.map(e => `
        <div class="list-group-item list-group-item-action p-2 d-flex justify-content-between align-items-center"
             onclick="app.selectEntity(${e.id})" style="cursor:pointer; border-left: 4px solid var(--bs-primary); margin-bottom: 4px;">
            <div class="fw-bold text-truncate" style="max-width: 70%;">${e.name}</div>
            <span class="badge bg-secondary rounded-pill">Tr ${e.troop_number}</span>
        </div>
    `).join('');

    els.entityList.innerHTML = addButton + listHtml;
}

// NEW: Registration Function
async function promptNewEntity(type) {
    const name = prompt(`Enter Name for new ${type}:`);
    if (!name) return;

    const troopNum = prompt("Enter Troop Number:");
    if (!troopNum) return;

    if (!confirm(`Register "${name}" for Troop ${troopNum}?`)) return;

    try {
        const res = await fetch('/api/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, troop_number: troopNum })
        });

        if (res.ok) {
            const newEntity = await res.json();
            state.entities.push(newEntity);
            localStorage.setItem('coyote_entities', JSON.stringify(state.entities));

            // Refresh list
            renderEntityList(els.entitySearch.value);
            alert('Registered!');

            // Optional: Auto-select
            // app.selectEntity(newEntity.id);
        } else {
            alert('Server Error: Could not save.');
        }
    } catch (err) {
        console.error(err);
        alert('Network Error');
    }
}

function selectEntity(id) {
    state.currentEntity = state.entities.find(e => e.id === id);
    renderForm();
    navigate('scoring');
}

function showEntitySelect() { navigate('entity'); }

function renderForm() {
    const s = state.currentStation;
    const e = state.currentEntity;
    els.scoringTitle.textContent = formatGameTitle(s);
    els.scoringTeam.textContent = `${e.name} (Troop ${e.troop_number})`;
    els.scoreForm.innerHTML = '';

    const sortFn = (a, b) => (a.sortOrder ?? 900) - (b.sortOrder ?? 900);

    const allFields = [
        ...(s.fields || []),
        ...(state.config.common_scoring || [])
    ].sort(sortFn);

    if (allFields.length > 0) {
        allFields.forEach(f => {
            if (!f.adminOnly) els.scoreForm.innerHTML += generateFieldHTML(f);
        });
    }
}

function generateFieldHTML(field) {
    const id = field.id;
    let input = '';

    if (field.type === 'boolean') {
        input = `<div class="form-check form-switch p-3 border rounded bg-light d-flex justify-content-between align-items-center">
                    <label class="form-check-label fw-bold mb-0" for="f_${id}">${field.label}</label>
                    <input class="form-check-input" type="checkbox" id="f_${id}" style="transform: scale(1.4); margin-left:1rem;">
                 </div>`;
        return `<div class="mb-3">${input}</div>`;
    }
    else if (field.type === 'range') {
        const mid = Math.ceil((field.max||5)/2);
        input = `<div class="d-flex align-items-center gap-2">
                    <span class="fw-bold text-muted">${field.min||0}</span>
                    <input type="range" class="form-range flex-grow-1" id="f_${id}" min="${field.min||0}" max="${field.max||5}" value="${mid}" oninput="document.getElementById('d_${id}').innerText=this.value">
                    <span class="fw-bold text-muted">${field.max||5}</span>
                 </div>
                 <div class="text-center fw-bold text-primary mt-1">Score: <span id="d_${id}" style="font-size:1.2rem">${mid}</span></div>`;
    }
    else if (field.type === 'time_mm_ss') {
        input = `<div class="input-group input-group-lg">
                    <input type="number" class="form-control text-center" id="f_${id}_mm" placeholder="MM" onchange="app.combineTime('${id}')">
                    <span class="input-group-text">:</span>
                    <input type="number" class="form-control text-center" id="f_${id}_ss" placeholder="SS" onchange="app.combineTime('${id}')">
                 </div><input type="hidden" id="f_${id}_val">`;
    }
    else if (field.type === 'select') {
        input = `<select class="form-select form-select-lg" id="f_${id}">${field.options.map(o=>`<option value="${o}">${o}</option>`).join('')}</select>`;
    }
    else if (field.type === 'textarea') {
        input = `<textarea class="form-control" id="f_${id}" rows="3" placeholder="${field.placeholder || ''}"></textarea>`;
    }
    else {
        input = `<input type="text" class="form-control form-control-lg" id="f_${id}">`;
    }

    return `<div class="mb-3"><label class="form-label fw-bold">${field.label}</label>${input}</div>`;
}

function combineTime(id) {
    const m = document.getElementById(`f_${id}_mm`).value || '00';
    const s = document.getElementById(`f_${id}_ss`).value || '00';
    document.getElementById(`f_${id}_val`).value = `${m.padStart(2,'0')}:${s.padStart(2,'0')}`;
}

function submitScore(e) {
    e.preventDefault();
    if(!state.currentStation || !state.currentEntity) return;

    const payload = {};
    const allFields = [...(state.currentStation.fields||[]), ...(state.config.common_scoring||[])];

    for(const f of allFields) {
        const el = document.getElementById(`f_${f.id}`);
        if(!el) continue;
        if(f.type === 'boolean') payload[f.id] = el.checked;
        else if(f.type === 'time_mm_ss') { combineTime(f.id); payload[f.id] = document.getElementById(`f_${f.id}_val`).value; }
        else payload[f.id] = el.value;
    }

    const packet = {
        uuid: crypto.randomUUID(),
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
    updateSyncCounts();
    alert('Score Saved!');
    app.navigate('home');
    if(state.isOnline) syncManager.sync().then(updateSyncCounts);
}

window.app = { init, navigate, refreshData, selectStation, selectEntity, showEntitySelect, combineTime, submitScore, setMode, promptNewEntity };
init();