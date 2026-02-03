import { SyncManager } from './sync-manager.js';

const syncManager = new SyncManager();

const state = {
    config: null,
    entities: [],
    currentStation: null,
    currentEntity: null,
    isOnline: navigator.onLine,
    viewMode: 'patrol', // NEW: Default to Patrols
    drafts: {} // key: "stationId_entityId", value: { fieldId: value }
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
    // 1. Quick Config via URL (QR Code Support)
    const params = new URLSearchParams(window.location.search);
    if (params.has('judge_email')) {
        const j = {
            name: params.get('judge_name') || '',
            email: params.get('judge_email') || '',
            unit: params.get('judge_unit') || ''
        };
        localStorage.setItem('judge_info', JSON.stringify(j));
        // Clean URL so refreshing doesn't reset if they edit it manually later
        window.history.replaceState({}, document.title, window.location.pathname);
    }

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
    els.status.addEventListener('click', handleSync);
    // document.getElementById('btn-reload-data') is now handled in injectModeTabs
    els.entitySearch.addEventListener('input', (e) => renderEntityList(e.target.value));
    document.getElementById('btn-submit').addEventListener('click', submitScore);

    // Initial view setup
    navigate('home');
}

// NEW: Inject Tabs for Patrol vs Troop
function injectModeTabs() {
    const stationList = document.getElementById('station-list');
    if (!stationList) return;

    const container = stationList.parentNode;
    const h3 = stationList.previousElementSibling;

    // Create the tabs container above the station list
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

    // Insert before the H3 header so H3 appears below the buttons
    container.insertBefore(tabContainer, h3 || stationList);
}

function setMode(mode) {
    state.viewMode = mode;

    // Update UI tabs
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

function saveDraft() {
    if (!state.currentStation || !state.currentEntity) return;

    const draftKey = `${state.currentStation.id}_${state.currentEntity.id}`;
    const payload = {};
    const allFields = [...(state.currentStation.fields||[]), ...(state.config.common_scoring||[])];

    for(const f of allFields) {
        const el = document.getElementById(`f_${f.id}`);
        // Handle timed fields separately via their hidden val if needed,
        // but easier to just check the inputs directly for drafts
        if (f.type === 'timed') {
            const mm = document.getElementById(`f_${f.id}_mm`)?.value || '';
            const ss = document.getElementById(`f_${f.id}_ss`)?.value || '';
            if (mm || ss) payload[f.id] = `${mm.padStart(2,'0')}:${ss.padStart(2,'0')}`;
        } else if (f.type === 'boolean') {
            payload[f.id] = el?.checked;
        } else {
            if (el) payload[f.id] = el.value;
        }
    }

    const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
    drafts[draftKey] = payload;
    localStorage.setItem('coyote_drafts', JSON.stringify(drafts));
}

function handleBack() {
    const visibleView = Object.keys(views).find(key => !views[key].classList.contains('hidden'));
    if (visibleView === 'scoring') {
        renderEntityList();
        navigate('entity');
    } else if (visibleView === 'entity') {
        navigate('home');
    }
}

function updateStatusDisplay() {
    state.isOnline = navigator.onLine;
    const unsyncedCount = syncManager.getCounts().unsynced;

    // Update the "Scores to Sync" text line
    if (els.unsyncedCount) els.unsyncedCount.textContent = unsyncedCount;

    // Update the Header Status/Sync Button
    if (unsyncedCount > 0 && state.isOnline) {
        els.status.textContent = 'Sync';
        els.status.className = 'status-sync ms-2';
    } else {
        els.status.textContent = state.isOnline ? 'Online' : 'Offline';
        els.status.className = (state.isOnline ? 'status-online' : 'status-offline') + ' ms-2';
    }
}

function updateOnlineStatus() {
    updateStatusDisplay();
}

function loadJudgeInfo() {
    try {
        const stored = localStorage.getItem('judge_info');
        if (stored) {
            const j = JSON.parse(stored);
            if(els.judgeName) els.judgeName.value = j.name || '';
            if(els.judgeEmail) els.judgeEmail.value = j.email || '';
            if(els.judgeUnit) els.judgeUnit.value = j.unit || '';

            if (j.name) {
                const welcome = document.getElementById('welcome-text');
                if (welcome) welcome.textContent = `Welcome, ${j.name.split(' ')[0]}.`;
            }
        } else {
            // First time or missing info - show modal
            toggleJudgeModal(true);
        }
    } catch(e) {}
}

function toggleJudgeModal(forceShow = null) {
    const modal = document.getElementById('judge-modal');
    if (!modal) return;

    if (forceShow === true) {
        modal.classList.remove('hidden');
    } else if (forceShow === false) {
        modal.classList.add('hidden');
    } else {
        modal.classList.toggle('hidden');
    }
}

function saveJudgeInfo() {
    const name = els.judgeName.value.trim();
    const email = els.judgeEmail.value.trim();
    const unit = els.judgeUnit.value.trim();

    if (!email) {
        alert("Email is required so we can identify your scores.");
        return;
    }

    localStorage.setItem('judge_info', JSON.stringify({ name, email, unit }));

    if (name) {
        const welcome = document.getElementById('welcome-text');
        if (welcome) welcome.textContent = `Welcome, ${name.split(' ')[0]}.`;
    }

    toggleJudgeModal(false);
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
    updateStatusDisplay();
}

async function handleSync() {
    if (!state.isOnline) return;
    const unsynced = syncManager.getCounts().unsynced;
    if (unsynced === 0) return;

    els.status.textContent = '...';
    try {
        const res = await syncManager.sync();
        // If there were any successes, maybe show a brief alert or just update counts
        if (res.synced > 0) {
            console.log(`Synced ${res.synced} scores.`);
        }
        if (res.errors > 0) {
            alert(`Sync completed with ${res.errors} errors.`);
        }
        updateStatusDisplay();
    } catch (e) {
        console.error("Sync failed", e);
        updateStatusDisplay();
    }
}

// --- Navigation & Rendering ---

function navigate(viewName) {
    Object.values(views).forEach(el => el.classList.add('hidden'));
    views[viewName].classList.remove('hidden');

    // Reset Header style unless we are actively scoring (renderForm handles it there)
    if (viewName !== 'scoring') {
        const header = document.querySelector('header');
        header.style.backgroundColor = '';
        header.style.color = '';
        const sub = document.getElementById('header-subtitle');
        if(sub) sub.style.display = 'none';
    }

    // Header buttons logic (Back button vs Status/Profile)
    if (viewName === 'home') {
        els.backBtn.classList.add('hidden');
        els.status.classList.remove('hidden');
        els.profileBtn.classList.remove('hidden');
    } else if (viewName === 'entity') {
        els.backBtn.classList.remove('hidden');
        els.status.classList.add('hidden');
        els.profileBtn.classList.add('hidden');
    } else if (viewName === 'scoring') {
        els.backBtn.classList.remove('hidden');
        els.status.classList.add('hidden');
        els.profileBtn.classList.add('hidden');
    }

    // Reset Header on Home
    if (viewName === 'home') {
        document.getElementById('header-title').textContent = 'Coyote Collator';

        const syncLine = document.getElementById('header-sync-line');
        if(syncLine) syncLine.style.display = 'block';

        // Remove active-dock styling if returning home unexpectedly
        document.body.style.paddingBottom = '0';
    } else {
        const syncLine = document.getElementById('header-sync-line');
        if(syncLine) syncLine.style.display = 'none';
    }

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

    // drafts check
    const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');

    // Get list of already scored entities for this game from sync manager
    const queue = syncManager.getQueue();
    const scoredIds = new Set(queue
        .filter(s => s.game_id === state.currentStation.id)
        .map(s => s.entity_id)
    );

    const filtered = state.entities.filter(e =>
        e.type === requiredType &&
        (e.name.toLowerCase().includes(term) || e.troop_number.includes(term) || e.id.toLowerCase().includes(term))
    );

    // SORTING:
    // 1. Not Done (not in scoredIds) first
    // 2. By Troop Number
    // 3. By Patrol Name
    filtered.sort((a, b) => {
        const doneA = scoredIds.has(a.id);
        const doneB = scoredIds.has(b.id);

        if (doneA !== doneB) return doneA ? 1 : -1;

        const troopA = parseInt(a.troop_number) || 0;
        const troopB = parseInt(b.troop_number) || 0;
        if (troopA !== troopB) return troopA - troopB;

        return a.name.localeCompare(b.name);
    });

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

    const listHtml = filtered.map(e => {
        const isDone = scoredIds.has(e.id);
        const draftKey = `${state.currentStation.id}_${e.id}`;
        const hasDraft = !!drafts[draftKey];

        // Display format: Troop Number, Patrol ID, Patrol Name
        const displayLabel = `Tr ${e.troop_number} | #${e.id} | ${e.name}`;

        return `
            <div class="list-group-item list-group-item-action p-3 d-flex justify-content-between align-items-center"
                onclick="app.selectEntity('${e.id}')"
                style="cursor:pointer; border-left: 5px solid ${isDone ? '#adb5bd' : (hasDraft ? '#ffc107' : '#0d6efd')}; margin-bottom: 6px; ${isDone ? 'background-color: #f1f3f5; opacity: 0.6;' : 'background-color: #fff;'}">
                <div class="fw-bold text-truncate" style="max-width: 85%; font-size: 1.05rem;">
                    ${isDone ? `<del class="text-muted">${displayLabel}</del>` : displayLabel}
                </div>
                <div>
                    ${hasDraft && !isDone ? '<span class="badge bg-warning text-dark me-1">Draft</span>' : ''}
                    ${isDone ? '<span class="badge bg-light text-dark border">Done</span>' : ''}
                </div>
            </div>`;
    }).join('');

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

    // Check for existing score in the local queue
    const queue = syncManager.getQueue();
    const existingScore = queue.find(s => s.game_id === state.currentStation.id && s.entity_id === id);

    renderForm(existingScore);
    navigate('scoring');
}

function showEntitySelect() { navigate('entity'); }

function renderForm(existingScore = null) {
    const s = state.currentStation;
    const e = state.currentEntity;
    const btnSubmit = document.getElementById('btn-submit');
    const header = document.querySelector('header');

    // Check for draft if no existing score
    let draftData = null;
    if (!existingScore) {
        const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
        draftData = drafts[`${s.id}_${e.id}`];
    }

    // Update Header
    if (existingScore) {
        document.getElementById('header-title').textContent = `EDIT: ${formatGameTitle(s)}`;
        header.style.backgroundColor = '#f39c12'; // Warning orange
        header.style.color = '#fff';
        btnSubmit.innerText = 'Re-Submit Score';
        btnSubmit.classList.remove('btn-secondary');
        btnSubmit.classList.add('btn-warning');
    } else {
        document.getElementById('header-title').textContent = formatGameTitle(s);
        header.style.backgroundColor = ''; // Restore to CSS default
        header.style.color = '';
        btnSubmit.innerText = 'Submit Score';
        btnSubmit.classList.add('btn-secondary');
        btnSubmit.classList.remove('btn-warning');
    }

    const sub = document.getElementById('header-subtitle');
    sub.textContent = `${e.troop_number} - ${e.name}`;
    sub.style.display = 'block';

    // (Kept for legacy containers inside the form if needed, masking them via css if redundant)
    els.scoringTitle.style.display = 'none';
    els.scoringTeam.style.display = 'none';
    els.scoreForm.innerHTML = '';

    const sortFn = (a, b) => (a.sortOrder ?? 900) - (b.sortOrder ?? 900);

    const allFields = [
        ...(s.fields || []),
        ...(state.config.common_scoring || [])
    ].sort(sortFn);

    const visibleFields = allFields.filter(f => f.audience === 'judge');

    if (visibleFields.length > 0) {
        visibleFields.forEach(f => {
            let val = null;
            if (existingScore) {
                val = existingScore.score_payload[f.id];
            } else if (draftData) {
                val = draftData[f.id];
            }
            els.scoreForm.innerHTML += generateFieldHTML(f, val);
        });
    }

    // Attach change listeners to save drafts
    const inputs = els.scoreForm.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('input', () => app.saveDraft());
    });
}

if (!window.startStopwatch) {
    window.startStopwatch = startStopwatch;
    window.stopStopwatch = stopStopwatch;
}
// --- Stopwatch Logic ---
let activeTimerId = null;
let activeTimerInterval = null;
let activeTimerStartedAt = 0; // Timestamp when current run started
let activeTimerOffset = 0; // Accumulated time from previous runs (ms)
let isPaused = false;

function startStopwatch(id) {
    if (activeTimerId && activeTimerId !== id) {
        if(!confirm("Another timer is running. Stop it and start this one?")) return;
        stopStopwatch();
    }

    const dock = document.getElementById('stopwatch-dock');
    const dockDisplay = document.getElementById('dock-display');

    // Buttons
    const btnStop = document.getElementById('dock-btn-stop');
    const btnPause = document.getElementById('dock-btn-pause');
    const btnReset = document.getElementById('dock-btn-reset');

    // Init State
    if (activeTimerId !== id) {
        // Fresh start
        activeTimerId = id;
        activeTimerOffset = 0;
        isPaused = false;
        activeTimerStartedAt = Date.now();

        // Reset Inputs just in case
        document.getElementById(`f_${id}_mm`).value = '';
        document.getElementById(`f_${id}_ss`).value = '';
    } else if (isPaused) {
        // Resuming from pause
        isPaused = false;
        activeTimerStartedAt = Date.now();
    }

    // UI Setup
    dock.classList.add('active');
    document.body.style.paddingBottom = '100px';
    btnPause.innerText = "PAUSE";
    btnPause.classList.remove('btn-success');
    btnPause.classList.add('btn-warning');

    // Handlers
    btnStop.onclick = () => stopStopwatch();

    btnPause.onclick = () => {
        if (isPaused) {
            // RESUME
            isPaused = false;
            activeTimerStartedAt = Date.now();
            btnPause.innerText = "PAUSE";
            btnPause.classList.remove('btn-success');
            btnPause.classList.add('btn-warning');

            activeTimerInterval = setInterval(tick, 100);
        } else {
            // PAUSE
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
            // If paused, remain paused but at 0
            if(isPaused) {
                // Should we update display to 00:00?
                dockDisplay.innerText = "00:00";
            }
        }
    };

    // Ticker
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
    const fmt = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;

    document.getElementById('dock-display').innerText = fmt;
}

function stopStopwatch() {
    if(!activeTimerId) return;

    // Calculate final time
    if (!isPaused) {
        activeTimerOffset += (Date.now() - activeTimerStartedAt);
    }

    const finalSec = Math.floor(activeTimerOffset / 1000);
    const m = Math.floor(finalSec / 60);
    const s = finalSec % 60;

    clearInterval(activeTimerInterval);
    activeTimerInterval = null;
    isPaused = false;

    // Hide Dock
    document.getElementById('stopwatch-dock').classList.remove('active');
    document.body.style.paddingBottom = '0';

    // Update Input (The manual edit fields)
    const mmInput = document.getElementById(`f_${activeTimerId}_mm`);
    const ssInput = document.getElementById(`f_${activeTimerId}_ss`);

    if(mmInput && ssInput) {
        mmInput.value = m;
        ssInput.value = s;
        // Trigger combineTime to update hidden val
        app.combineTime(activeTimerId);
    }

    activeTimerId = null;
}

// -----------------------

function generateFieldHTML(field, value = null) {
    const id = field.id;

    // 1. Textarea: Vertical Stack (Exception)
    if (field.type === 'textarea') {
        const isPenalty = field.kind === 'penalty';
        const penaltyStyle = isPenalty ? 'color: red !important; font-weight: bold;' : '';
        return `<div class="mb-4">
            <label class="form-label fw-bold" for="f_${id}" style="${penaltyStyle}">${field.label}</label>
            <textarea class="form-control" id="f_${id}" rows="3" placeholder="${field.placeholder || ''}" style="${penaltyStyle}">${value || ''}</textarea>
        </div>`;
    }

    // 2. All others: Grid Layout (Label Left, Input Right)
    let input = '';
    let labelContent = `<label class="form-label fw-bold mb-0" for="f_${id}">${field.label}</label>`;

    const isPenalty = field.kind === 'penalty';
    const penaltyStyle = isPenalty ? 'color: red !important; font-weight: bold;' : '';

    if (field.type === 'boolean') {
        const checked = value === true ? 'checked' : '';
        input = `<div class="form-check form-switch d-flex justify-content-end mb-0">
                    <input class="form-check-input" type="checkbox" id="f_${id}" style="transform: scale(1.4);" ${checked}>
                 </div>`;
    }
    else if (field.type === 'range') {
        const currentVal = value !== null ? value : Math.ceil((field.max||5)/2);
        input = `<div class="d-flex align-items-center">
                    <input type="range" class="form-range flex-grow-1" id="f_${id}" min="${field.min||0}" max="${field.max||5}" value="${currentVal}" oninput="document.getElementById('d_${id}').innerText=this.value">
                    <span class="fw-bold ms-2" id="d_${id}" style="min-width:1.5em; text-align: right; ${isPenalty ? 'color: red !important;' : 'color: var(--bs-primary);'}">${currentVal}</span>
                 </div>`;
    }
    else if (field.type === 'timed') {
        // Parse "MM:SS"
        let mm = '';
        let ss = '';
        if (value && typeof value === 'string' && value.includes(':')) {
            [mm, ss] = value.split(':');
        }

        // Label col gets the Start button
        labelContent = `<div class="d-flex justify-content-between align-items-center w-100">
                            <label class="form-label fw-bold mb-0" for="f_${id}" style="${penaltyStyle}">${field.label}</label>
                            <button type="button" class="btn btn-success btn-sm mb-0 p-0 fw-bold d-flex align-items-center justify-content-center" style="width: 80px; height: 38px;" onclick="startStopwatch('${id}')">START</button>
                        </div>`;

        // Input col gets the mm:ss edit fields
        input = `<div class="input-group input-group-sm">
                    <input type="number" class="form-control text-center px-1" id="f_${id}_mm" placeholder="MM" inputmode="numeric" pattern="[0-9]*" onchange="app.combineTime('${id}')" value="${mm}" style="${penaltyStyle}">
                    <span class="input-group-text px-1">:</span>
                    <input type="number" class="form-control text-center px-1" id="f_${id}_ss" placeholder="SS" inputmode="numeric" pattern="[0-9]*" onchange="app.combineTime('${id}')" value="${ss}" style="${penaltyStyle}">
                 </div><input type="hidden" id="f_${id}_val" value="${value || ''}">`;
    }
    else if (field.type === 'number') {
        input = `<input type="number" class="form-control form-control-sm" id="f_${id}" inputmode="numeric" pattern="[0-9]*" placeholder="${field.placeholder || ''}" value="${value !== null ? value : ''}" style="${penaltyStyle}">`;
    }
    else if (field.type === 'select') {
        input = `<select class="form-select form-select-sm" id="f_${id}" style="${penaltyStyle}">${field.options.map(o=> {
            const selected = (o === value) ? 'selected' : '';
            return `<option value="${o}" ${selected}>${o}</option>`;
        }).join('')}</select>`;
    }
    else {
        input = `<input type="text" class="form-control form-control-sm" id="f_${id}" value="${value || ''}" style="${penaltyStyle}">`;
    }

    if (field.type !== 'timed' && field.type !== 'textarea') {
         labelContent = `<label class="form-label fw-bold mb-0" for="f_${id}" style="${penaltyStyle}">${field.label}</label>`;
    }

    return `<div class="row py-2 border-bottom align-items-center">
                <div class="col-8">
                    ${labelContent}
                </div>
                <div class="col-4">
                    ${input}
                </div>
            </div>`;
}

// Remove old functions if present
// (cleaned up)

function combineTime(id) {
    const m = document.getElementById(`f_${id}_mm`).value || '00';
    const s = document.getElementById(`f_${id}_ss`).value || '00';
    document.getElementById(`f_${id}_val`).value = `${m.padStart(2,'0')}:${s.padStart(2,'0')}`;
    app.saveDraft();
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
        else if(f.type === 'timed') { combineTime(f.id); payload[f.id] = document.getElementById(`f_${f.id}_val`).value; }
        else payload[f.id] = el.value;
    }

    const queue = syncManager.getQueue();
    const existing = queue.find(s => s.game_id === state.currentStation.id && s.entity_id === state.currentEntity.id);

    const packet = {
        uuid: existing ? existing.uuid : (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)),
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

    // Clear draft on successful submission
    const draftKey = `${state.currentStation.id}_${state.currentEntity.id}`;
    const drafts = JSON.parse(localStorage.getItem('coyote_drafts') || '{}');
    delete drafts[draftKey];
    localStorage.setItem('coyote_drafts', JSON.stringify(drafts));

    updateSyncCounts();
    alert('Score Saved!');

    // Return to the entity list for the same game, not the home screen
    renderEntityList();
    navigate('entity');

    if(state.isOnline) syncManager.sync().then(updateSyncCounts);
}

window.app = { init, navigate, refreshData, selectStation, selectEntity, showEntitySelect, combineTime, submitScore, setMode, promptNewEntity, toggleJudgeModal, saveJudgeInfo, handleBack, saveDraft };
init();