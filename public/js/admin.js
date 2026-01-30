// State
let appData = {
    games: [],
    entities: [],
    commonScoring: [],
    scores: [], // Full raw score list
    stats: {}, // Counts
    gameStatuses: {} // NEW: Map of game_id -> status
};

let currentView = 'overview';
let currentViewType = 'list'; // 'card' or 'list'
let currentViewMode = 'patrol'; // 'patrol' or 'troop'
let matrixTranspose = false;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupNavigation();
    refreshCurrentView();
});

async function loadData() {
    try {
        // Fetch Games Config & Entities
        const [gamesRes, entitiesRes, dataRes] = await Promise.all([
            fetch('/games.json'),
            fetch('/api/entities'),
            fetch('/api/admin/all-data')
        ]);

        const gamesResult = await gamesRes.json();
        appData.games = gamesResult.games;
        appData.commonScoring = gamesResult.common_scoring;

        appData.entities = await entitiesRes.json();

        // Fetch Data
        const dataResult = await dataRes.json();
        appData.scores = dataResult.scores || [];
        appData.stats = dataResult.stats || {};
        appData.gameStatuses = dataResult.game_status || {};

        console.log('Loaded Data:', appData);

    } catch (err) {
        console.error('Failed to load data', err);
        alert('Error loading dashboard data');
    }
}

function setupNavigation() {
    const navOverview = document.getElementById('nav-overview');
    const navMatrix = document.getElementById('nav-matrix');
    const navRegistration = document.getElementById('nav-registration');
    const backBtn = document.getElementById('back-to-overview');
    const transposeBtn = document.getElementById('btn-transpose');
    const viewModeSelect = document.getElementById('view-mode-select');
    const resetDbBtn = document.getElementById('btn-reset-db');

    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', async () => {
            if (confirm('DANGER: This will delete ALL scores from the database. This cannot be undone.\n\nAre you sure?')) {
                const check = prompt("Type 'DELETE' to confirm:");
                if (check === 'DELETE') {
                    try {
                        const res = await fetch('/api/admin/data', { method: 'DELETE' });
                        if (res.ok) {
                            alert('Database cleared.');
                            window.location.reload();
                        } else {
                            alert('Failed to clear database.');
                        }
                    } catch (e) {
                        alert('Error: ' + e.message);
                    }
                }
            }
        });
    }

    navOverview.addEventListener('click', () => switchView('overview'));
    navMatrix.addEventListener('click', () => switchView('matrix'));

    if (navRegistration) {
        navRegistration.addEventListener('click', () => switchView('registration'));
    }

    backBtn.addEventListener('click', () => switchView('overview'));

    // ... rest of listeners
    // Form Listener
    const regForm = document.getElementById('reg-form');
    if (regForm) {
        regForm.addEventListener('submit', handleRegistration);
    }

    transposeBtn.addEventListener('click', () => {
        matrixTranspose = !matrixTranspose;
        renderMatrix();
    });

    if (viewModeSelect) {
        viewModeSelect.addEventListener('change', (e) => {
            currentViewMode = e.target.value;
            refreshCurrentView();
        });
    }

    // View Type Toggles
    const rdCard = document.getElementById('view-type-card');
    const rdList = document.getElementById('view-type-list');
    if(rdCard) rdCard.addEventListener('change', () => { currentViewType = 'card'; refreshCurrentView(); });
    if(rdList) rdList.addEventListener('change', () => { currentViewType = 'list'; refreshCurrentView(); });
}

function refreshCurrentView() {
    if (currentView === 'overview') {
        if(currentViewType === 'list') renderOverviewList();
        else renderOverview();
    }
    else if (currentView === 'matrix') renderMatrix();
}

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));

    if (viewName === 'overview') {
        document.getElementById('view-overview').classList.remove('hidden');
        document.getElementById('nav-overview').classList.add('active');
        refreshCurrentView();
    } else if (viewName === 'matrix') {
        document.getElementById('view-matrix').classList.remove('hidden');
        document.getElementById('nav-matrix').classList.add('active');
        renderMatrix();
    } else if (viewName === 'detail') {
        document.getElementById('view-detail').classList.remove('hidden');
        document.getElementById('nav-overview').classList.add('active');
    } else if (viewName === 'registration') {
        document.getElementById('view-registration').classList.remove('hidden');
        const regBtn = document.getElementById('nav-registration');
        if(regBtn) regBtn.classList.add('active');
        renderRoster();
    }
}

// Helper: Format Game Title (handles clean names)
function formatGameTitle(game) {
    if (!game) return '';
    // If name already has "Game" or number prefix, assume legacy and leave it
    if (game.name.match(/^(Game|Exhibition|p\d)/i)) return game.name;

    // Extract Number from ID (p1 -> 1, t10 -> 10)
    const match = game.id.match(/(\d+)/);
    const num = match ? match[1] : '';

    if (num) return `Game ${num}. ${game.name}`;
    return game.name; // Fallback for Exhibition etc
}

// --- Overview ---

function renderOverview() {
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    // Show grid container
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
    grid.style.gap = '20px';

    const games = getFilteredGames();

    if (games.length === 0) {
        grid.innerHTML = `<p>No ${currentViewMode} games found.</p>`;
        return;
    }

    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'card';
        const count = appData.stats[game.id] || 0;
        const isFinal = appData.gameStatuses[game.id] === 'finalized';

        card.innerHTML = `
            <h3>${formatGameTitle(game)}</h3>
            <div class="stat">${count} Scores</div>
            ${isFinal ? '<div class="badge bg-success mt-2">Finalized</div>' : ''}
        `;
        card.addEventListener('click', () => openGameDetail(game.id));
        grid.appendChild(card);
    });
}

function renderOverviewList() {
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    // Use block for table
    grid.style.display = 'block';

    const games = getFilteredGames();

    if (games.length === 0) {
        grid.innerHTML = `<p>No ${currentViewMode} games found.</p>`;
        return;
    }

    const table = document.createElement('table');
    table.className = 'table table-striped table-hover';
    table.innerHTML = `
        <thead class="table-dark">
            <tr>
                <th>Game</th>
                <th>Scores Input</th>
                <th class="text-center">Status</th>
                <th class="text-end">Action</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');
    games.forEach(game => {
        const count = appData.stats[game.id] || 0;
        const isFinal = appData.gameStatuses[game.id] === 'finalized';

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
             // Don't trigger if clicked checkbox or button
             if(e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') openGameDetail(game.id)
        };

        tr.innerHTML = `
            <td class="fw-bold">${formatGameTitle(game)}</td>
            <td>${count}</td>
            <td class="text-center">
                <div class="form-check form-switch d-inline-block">
                    <input class="form-check-input" type="checkbox" id="status_${game.id}" ${isFinal ? 'checked' : ''} onclick="toggleGameStatus('${game.id}', this.checked)">
                    <label class="form-check-label small ${isFinal ? 'text-success fw-bold' : 'text-muted'}" for="status_${game.id}">${isFinal ? 'Final' : 'Draft'}</label>
                </div>
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-primary">Open</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    grid.appendChild(table);
}

function getFilteredGames() {
    return appData.games.filter(g => {
        const gType = g.type || 'patrol';
        return gType === currentViewMode;
    });
}

async function toggleGameStatus(gameId, isFinal) {
    const status = isFinal ? 'finalized' : 'open';
    // Optimistic Update
    appData.gameStatuses[gameId] = status;
    refreshCurrentView(); // Re-render to update badges/labels

    try {
        await fetch('/api/admin/game-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: gameId, status })
        });
    } catch(err) {
        console.error(err);
        alert('Failed to save status');
    }
}

if (!window.toggleGameStatus) window.toggleGameStatus = toggleGameStatus; // Export for onclick

function openGameDetail(gameId) {
    const game = appData.games.find(g => g.id === gameId);
    if (!game) return;

    document.getElementById('detail-title').innerText = formatGameTitle(game);
    const table = document.getElementById('detail-table');
    table.innerHTML = '';
    table.className = 'spreadsheet-table'; // Enforce spreadsheet look

    // Filter scores for this game
    const gameScores = appData.scores.filter(s => s.game_id === gameId);

    // Sort by troop number
    gameScores.sort((a, b) => {
        const numA = parseInt(a.troop_number) || 0;
        const numB = parseInt(b.troop_number) || 0;
        return numA - numB;
    });

    const sortFn = (a, b) => (a.sortOrder ?? 900) - (b.sortOrder ?? 900);
    // Dynamic Cols (merged)
    const allFields = [
        ...(game.fields || []),
        ...(appData.commonScoring || [])
    ].sort(sortFn);

    // Build Headers
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Standard Cols
    const stdHeaders = ['Troop', 'Name', 'Time'];
    stdHeaders.forEach(h => {
        const th = document.createElement('th');
        th.innerText = h;
        headerRow.appendChild(th);
    });

    allFields.forEach(field => {
        const th = document.createElement('th');
        th.className = 'rotate-header';
        th.innerHTML = `<div>${field.label}</div>`;
        th.title = field.label; // Tooltip for readability
        headerRow.appendChild(th);
    });

    const thTotal = document.createElement('th');
    thTotal.innerText = 'Total';
    thTotal.className = 'rotate-header';
    thTotal.innerHTML = `<div>Total</div>`;
    headerRow.appendChild(thTotal);

    const thActions = document.createElement('th');
    thActions.innerText = 'Edit';
    headerRow.appendChild(thActions);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Build Body
    const tbody = document.createElement('tbody');
    gameScores.forEach(score => {
        const tr = document.createElement('tr');

        tr.appendChild(createTd(score.troop_number));
        tr.appendChild(createTd(score.entity_name));
        tr.appendChild(createTd(new Date(score.timestamp).toLocaleTimeString()));

        let totalScore = 0;

        allFields.forEach(field => {
            const val = score.score_payload[field.id];
            tr.appendChild(createTd(formatValue(val, field.type)));

            // Calculate Total
            if (!field.excludeFromTotal) {
                const n = parseFloat(val);
                if (!isNaN(n)) totalScore += n;
            }
        });

        // Total Column
        tr.appendChild(createTd(`<strong>${totalScore}</strong>`));

        // Action: Edit
        const actionTd = document.createElement('td');
        const btn = document.createElement('button');
        btn.innerText = '✏️ Score';
        btn.className = 'btn-link'; // Minimal styling
        btn.onclick = () => showEditModal(score, game);
        actionTd.appendChild(btn);
        tr.appendChild(actionTd);

        tbody.appendChild(tr);
    });

    if (gameScores.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 5 + allFields.length;
        td.innerText = "No scores submitted yet.";
        td.style.textAlign = 'center';
        td.style.padding = '20px';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }

    table.appendChild(tbody);

    switchView('detail');
}

function createTh(text) {
    const th = document.createElement('th');
    th.innerText = text;
    return th;
}

function createTd(text) {
    const td = document.createElement('td');
    td.innerHTML = text !== undefined && text !== null ? text : '-';
    return td;
}

function formatValue(val, type) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return val;
}

// --- Matrix View ---

function renderMatrix() {
    const table = document.getElementById('matrix-table');
    table.innerHTML = '';

    const entities = appData.entities.filter(e => e.type === currentViewMode);

    // Sort Entities
    entities.sort((a, b) => {
        const numA = parseInt(a.troop_number) || 0;
        const numB = parseInt(b.troop_number) || 0;
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name);
    });

    const games = appData.games.filter(g => {
        const gType = g.type || 'patrol';
        return gType === currentViewMode;
    });

    if (matrixTranspose) {
        renderMatrixTransposed(table, games, entities);
    } else {
        renderMatrixNormal(table, games, entities);
    }
}

function renderMatrixNormal(table, games, patrols) {
    // Header: Entity Info + Games
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createTh('Troop'));
    headerRow.appendChild(createTh(currentViewMode === 'patrol' ? 'Patrol' : 'Troop Name'));

    games.forEach(g => {
        const th = createTh(formatGameTitle(g));
        // truncate if too long?
        th.title = g.name;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    patrols.forEach(patrol => {
        const tr = document.createElement('tr');
        tr.appendChild(createTd(patrol.troop_number));
        tr.appendChild(createTd(patrol.name));

        games.forEach(game => {
            const hasScore = appData.scores.some(s => s.entity_id === patrol.id && s.game_id === game.id);
            const td = document.createElement('td');
            td.className = 'cell-center';
            if (hasScore) {
                td.innerHTML = '<span class="check">✅</span>';
            } else {
                td.innerHTML = '<span style="color:#eee">.</span>';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

function renderMatrixTransposed(table, games, patrols) {
    // Header: Game Name + Patrols
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createTh('Game Name'));

    patrols.forEach(p => {
        const th = createTh(`${p.troop_number}\n${p.name}`);
        th.style.fontSize = '10px';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    games.forEach(game => {
        const tr = document.createElement('tr');
        tr.appendChild(createTd(formatGameTitle(game)));

        patrols.forEach(patrol => {
            const hasScore = appData.scores.some(s => s.entity_id === patrol.id && s.game_id === game.id);
            const td = document.createElement('td');
            td.className = 'cell-center';
            if (hasScore) {
                td.innerHTML = '<span class="check">✅</span>';
            } else {
                td.innerHTML = '<span style="color:#eee">.</span>';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

// --- Registration View (Tree) ---

function renderRoster() {
    const container = document.getElementById('roster-tree');
    container.innerHTML = '';

    const troops = appData.entities.filter(e => e.type === 'troop')
        .sort((a,b) => (parseInt(a.troop_number)||0) - (parseInt(b.troop_number)||0));

    const patrols = appData.entities.filter(e => e.type === 'patrol');

    // Group Patrols
    const patrolsByParent = {};
    const patrolsByNum = {}; // Fallback
    const orphans = [];

    patrols.forEach(p => {
        if (p.parent_id) {
            if (!patrolsByParent[p.parent_id]) patrolsByParent[p.parent_id] = [];
            patrolsByParent[p.parent_id].push(p);
        } else {
            // Check formatted number for fallback matching
            if (!patrolsByNum[p.troop_number]) patrolsByNum[p.troop_number] = [];
            patrolsByNum[p.troop_number].push(p);
        }
    });

    // Render Troops
    troops.forEach(troop => {
        const myPatrols = [
            ...(patrolsByParent[troop.id] || []),
            ...(patrolsByNum[troop.troop_number] || [])
        ];

        // Remove from fallback map so they don't appear in orphans
        if (patrolsByNum[troop.troop_number]) delete patrolsByNum[troop.troop_number];

        const details = document.createElement('details');
        details.open = true; // Default expanded
        details.style = "margin-bottom:10px; border:1px solid #ddd; padding:10px; border-radius:4px; background:white;";

        const summary = document.createElement('summary');
        summary.style = "font-weight:bold; cursor:pointer; list-style:none; display:flex; align-items:center;";
        summary.innerHTML = `
            <span style="font-size:1.2rem; margin-right:10px; color:#3498db;">⚑</span>
            <span style="font-size:1.2rem;">Troop ${troop.troop_number} - ${troop.name}</span>
            <button class="btn btn-sm btn-outline-success ms-auto" onclick="addEntity(${troop.id})">+ Add Patrol</button>
        `;
        details.appendChild(summary);

        const list = document.createElement('div');
        list.style = "margin-left:35px; margin-top:10px; border-left: 2px solid #eee; padding-left: 10px;";

        if (myPatrols.length === 0) {
            list.innerHTML = '<div class="text-muted small">No patrols registered</div>';
        } else {
            myPatrols.forEach(p => {
                const div = document.createElement('div');
                div.className = "d-flex justify-content-between align-items-center p-2 border-bottom";
                div.innerHTML = `
                    <span>${p.name} <small class="text-muted">(${p.id})</small></span>
                    <span class="badge bg-secondary">Patrol</span>
                `;
                list.appendChild(div);
            });
        }
        details.appendChild(list);
        container.appendChild(details);
    });

    // Handle Remaining Orphans (Patrols with no matching Troop)
    const trulyOrphaned = [];
    Object.values(patrolsByNum).forEach(arr => trulyOrphaned.push(...arr));
    orphans.push(...trulyOrphaned);

    if (orphans.length > 0) {
        const orphanContainer = document.createElement('div');
        orphanContainer.style = "margin-top:20px; border:2px dashed #e67e22; padding:10px; border-radius:4px; background:#fff8e1;";
        orphanContainer.innerHTML = `<h4 class="text-warning">⚠ Unassigned Patrols</h4>`;

        orphans.forEach(p => {
             const div = document.createElement('div');
             div.className = "d-flex justify-content-between align-items-center p-2 border-bottom";
             div.innerHTML = `
                <span>${p.name} <small class="text-muted">(Troop ${p.troop_number} - No Parent Link)</small></span>
                <span class="badge bg-warning text-dark">Orphan</span>
            `;
            orphanContainer.appendChild(div);
        });
        container.appendChild(orphanContainer);
    }
}

async function addEntity(parentId) {
    let type = 'troop';
    let troopNum = '';
    let name = '';
    let parent = null;

    if (parentId) {
        type = 'patrol';
        parent = appData.entities.find(e => e.id === parentId);
        if (!parent) return alert("Parent troop not found");
        troopNum = parent.troop_number;
        name = prompt(`New Patrol Name for Troop ${troopNum}:`);
    } else {
        type = 'troop';
        troopNum = prompt("Enter Troop Number:");
        if (!troopNum) return;
        name = prompt("Enter Troop Name (or description):");
    }

    if (!name) return;

    const payload = {
        name: name.trim(),
        type: type,
        troop_number: (troopNum+'').trim(),
        parent_id: parentId
    };

    try {
        const res = await fetch('/api/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Failed to register');
        const newEntity = await res.json();

        // Update Local State
        appData.entities.push(newEntity);

        renderRoster(); // Refresh Tree

    } catch (err) {
        console.error(err);
        alert("Failed to add entity: " + err.message);
    }
}
window.addEntity = addEntity; // Export

// (Old handleRegistration removed)



// --- Editing Support ---

function showEditModal(score, game) {
    // Remove existing modal
    const existing = document.getElementById('edit-modal');
    if (existing) existing.remove();

    const sortFn = (a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
    const allFields = [
        ...(game.fields || []),
        ...(appData.commonScoring || [])
    ].sort(sortFn);

    const backdrop = document.createElement('div');
    backdrop.id = 'edit-modal';
    backdrop.style = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;';

    const card = document.createElement('div');
    card.style = 'background: white; padding: 20px; border-radius: 8px; width: 500px; max-width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.3);';

    card.innerHTML = '<h3>Edit Score: ' + score.entity_name + '</h3><form id="edit-form"></form>';
    backdrop.appendChild(card);

    const form = card.querySelector('form');

    // Generate Inputs
    allFields.forEach(field => {
        const val = score.score_payload[field.id];
        const group = document.createElement('div');
        group.style.marginBottom = '15px';

        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.fontWeight = 'bold';
        label.innerText = field.label + (field.adminOnly ? ' (Admin Only)' : '');
        group.appendChild(label);

        let input;
        if (field.type === 'boolean') {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = !!val;
        } else {
            input = document.createElement('input');
            input.type = field.type === 'number' || field.type === 'range' ? 'number' : 'text';
            input.value = val !== undefined ? val : '';
            input.style.width = '100%';
            input.style.padding = '8px';
        }
        input.dataset.fieldId = field.id;
        input.dataset.fieldType = field.type;

        group.appendChild(input);
        form.appendChild(group);
    });

    // Buttons
    const btnDiv = document.createElement('div');
    btnDiv.style.display = 'flex';
    btnDiv.style.gap = '10px';
    btnDiv.style.justifyContent = 'flex-end';

    const saveBtn = document.createElement('button');
    saveBtn.innerText = 'Save Changes';
    saveBtn.className = 'btn btn-primary';
    saveBtn.type = 'submit';

    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = 'Cancel';
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.type = 'button';
    cancelBtn.onclick = () => backdrop.remove();

    form.onsubmit = async (e) => {
        e.preventDefault();
        const payload = { ...score.score_payload };

        // Harvest Data
        const inputs = form.querySelectorAll('input');
        inputs.forEach(inp => {
            const fid = inp.dataset.fieldId;
            const type = inp.dataset.fieldType;
            let val;
            if (type === 'boolean') val = inp.checked;
            else if (type === 'number' || type === 'range') val = parseFloat(inp.value);
            else val = inp.value;

            payload[fid] = val;
        });

        // Send Update
        try {
            const res = await fetch('/api/scores/' + score.uuid, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ score_payload: payload })
            });

            if (res.ok) {
                backdrop.remove();
                await init(); // Refresh all data
                openGameDetail(game.id); // Re-open view
            } else {
                alert('Save failed');
            }
        } catch (err) {
            console.error(err);
            alert('Error saving');
        }
    };

    btnDiv.appendChild(cancelBtn);
    btnDiv.appendChild(saveBtn);
    form.appendChild(btnDiv);

    document.body.appendChild(backdrop);
}
