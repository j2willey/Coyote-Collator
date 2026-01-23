// State
let appData = {
    games: [],
    commonScoring: [],
    scores: [], // Full raw score list
    stats: {}, // Counts
};

let currentView = 'overview';
let matrixTranspose = false;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupNavigation();
    renderOverview();
});

async function loadData() {
    try {
        // Fetch Games Config
        const gamesRes = await fetch('/games.json');
        const gamesResult = await gamesRes.json();
        appData.games = gamesResult.games;
        appData.commonScoring = gamesResult.common_scoring;

        // Fetch Data
        const dataRes = await fetch('/api/admin/all-data');
        const dataResult = await dataRes.json();
        appData.scores = dataResult.scores;
        appData.stats = dataResult.stats;

        console.log('Loaded Data:', appData);

    } catch (err) {
        console.error('Failed to load data', err);
        alert('Error loading dashboard data');
    }
}

function setupNavigation() {
    const navOverview = document.getElementById('nav-overview');
    const navMatrix = document.getElementById('nav-matrix');
    const backBtn = document.getElementById('back-to-overview');
    const transposeBtn = document.getElementById('btn-transpose');

    navOverview.addEventListener('click', () => switchView('overview'));
    navMatrix.addEventListener('click', () => switchView('matrix'));
    backBtn.addEventListener('click', () => switchView('overview'));
    transposeBtn.addEventListener('click', () => {
        matrixTranspose = !matrixTranspose;
        renderMatrix();
    });
}

function switchView(viewName) {
    currentView = viewName;
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(btn => btn.classList.remove('active'));

    if (viewName === 'overview') {
        document.getElementById('view-overview').classList.remove('hidden');
        document.getElementById('nav-overview').classList.add('active');
        renderOverview();
    } else if (viewName === 'matrix') {
        document.getElementById('view-matrix').classList.remove('hidden');
        document.getElementById('nav-matrix').classList.add('active');
        renderMatrix();
    } else if (viewName === 'detail') {
        document.getElementById('view-detail').classList.remove('hidden');
        // keep overview active in nav as parent
        document.getElementById('nav-overview').classList.add('active');
    }
}

// --- Overview ---

function renderOverview() {
    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';

    appData.games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'card';
        const count = appData.stats[game.id] || 0;

        card.innerHTML = `
            <h3>${game.name}</h3>
            <div class="stat">${count} Scores</div>
        `;
        card.addEventListener('click', () => openGameDetail(game.id));
        grid.appendChild(card);
    });
}

// --- Detail View ---

function openGameDetail(gameId) {
    const game = appData.games.find(g => g.id === gameId);
    if (!game) return;

    document.getElementById('detail-title').innerText = game.name;
    const table = document.getElementById('detail-table');
    table.innerHTML = '';

    // Filter scores for this game
    const gameScores = appData.scores.filter(s => s.game_id === gameId);

    // Sort by troop number
    gameScores.sort((a, b) => {
        const numA = parseInt(a.troop_number) || 0;
        const numB = parseInt(b.troop_number) || 0;
        return numA - numB;
    });

    // Build Headers
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Standard Cols
    const stdHeaders = ['Troop', 'Entity', 'Time'];
    stdHeaders.forEach(h => headerRow.appendChild(createTh(h)));

    // Dynamic Cols (from game config)
    const gameFields = game.fields || [];
    gameFields.forEach(field => {
        headerRow.appendChild(createTh(field.label));
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Build Body
    const tbody = document.createElement('tbody');
    gameScores.forEach(score => {
        const tr = document.createElement('tr');

        tr.appendChild(createTd(score.troop_number));
        tr.appendChild(createTd(score.entity_name));
        tr.appendChild(createTd(new Date(score.timestamp).toLocaleTimeString()));

        // Payload Fields
        gameFields.forEach(field => {
            const val = score.score_payload[field.id];
            tr.appendChild(createTd(formatValue(val, field.type)));
        });

        tbody.appendChild(tr);
    });

    if (gameScores.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 3 + gameFields.length;
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

    // Gather all unique Entities (Patrols)
    // We can get this from the scores, or if we had an entities endpoint.
    // relying on scores for now, or just extracting unique entities from loaded scores.
    // Ideally we'd fetch /api/entities but the user only asked for /api/admin/all-data which has scores.
    // We'll extract unique entities from the scores list to be safe, BUT
    // the prompt implies "Rows: All Patrols". The all-data endpoint returns scores joined with entities.
    // If a patrol hasn't played, they won't be in `scores`.
    // However, the prompt instructions for backend only requested `all-data` to return stats and scores.
    // I will fetch /api/entities separately to ensure the Matrix has all patrols.

    fetch('/api/entities').then(res => res.json()).then(entities => {
        const patrols = entities.filter(e => e.type === 'patrol');

        // Sort Patrols
        patrols.sort((a, b) => {
            const numA = parseInt(a.troop_number) || 0;
            const numB = parseInt(b.troop_number) || 0;
            if (numA !== numB) return numA - numB;
            return a.name.localeCompare(b.name);
        });

        const games = appData.games;

        if (matrixTranspose) {
            renderMatrixTransposed(table, games, patrols);
        } else {
            renderMatrixNormal(table, games, patrols);
        }
    });
}

function renderMatrixNormal(table, games, patrols) {
    // Header: Entity Info + Games
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createTh('Troop'));
    headerRow.appendChild(createTh('Patrol'));

    games.forEach(g => {
        const th = createTh(g.name);
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
        tr.appendChild(createTd(game.name));

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
