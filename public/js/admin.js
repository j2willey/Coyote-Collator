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
let currentViewMode = 'patrol'; // 'patrol', 'troop', or 'exhibition'
let matrixTranspose = false;
let detailSort = { col: '_finalRank', dir: 'asc' };
let activeGameId = null;
let finalMode = false;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupNavigation();

    // Handle initial route from URL
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'dashboard';
    const gameId = params.get('gameId');

    if (view === 'detail' && gameId) {
        switchView('detail', false);
        openGameDetail(gameId);
    } else {
        switchView(view, false);
    }

    // Handle back/forward buttons
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.view) {
            if (event.state.view === 'detail' && event.state.gameId) {
                switchView('detail', false);
                openGameDetail(event.state.gameId);
            } else {
                switchView(event.state.view, false);
            }
        } else {
            switchView('dashboard', false);
        }
    });
});

async function loadData() {
    try {
        const ts = Date.now();
        // Fetch Games Config & Entities
        const [gamesRes, entitiesRes, dataRes] = await Promise.all([
            fetch(`/games.json?t=${ts}`),
            fetch(`/api/entities?t=${ts}`),
            fetch(`/api/admin/all-data?t=${ts}`)
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
    const navDashboard = document.getElementById('nav-dashboard');
    const transposeBtn = document.getElementById('btn-transpose');
    const viewModeSelect = document.getElementById('view-mode-select');
    const clearScoresBtn = document.getElementById('btn-clear-scores');
    const resetDbBtn = document.getElementById('btn-reset-db');
    const exportRawBtn = document.getElementById('btn-export-raw');

    // Branding click goes back to dashboard
    const brand = document.querySelector('header h1');
    if (brand) {
        brand.style.cursor = 'pointer';
        brand.onclick = () => switchView('dashboard');
    }

    if (exportRawBtn) {
        // Raw Export: Database Dump (All Scores) - distinct from Awards CSV
        exportRawBtn.onclick = () => window.location.href = '/api/export';
    }

    if (clearScoresBtn) {
        clearScoresBtn.addEventListener('click', async () => {
            if (confirm('CAUTION: This will delete ALL scoring data but keep the rosters (Troops/Patrols).\n\nAre you sure?')) {
                const check = prompt("Type 'SCORES' to confirm:");
                if (check === 'SCORES') {
                    try {
                        const res = await fetch('/api/admin/scores', { method: 'DELETE' });
                        if (res.ok) {
                            localStorage.clear(); // Purge cache on this device
                            alert('Scores cleared.');
                            window.location.reload();
                        } else {
                            alert('Failed to clear scores.');
                        }
                    } catch (e) {
                        alert('Error: ' + e.message);
                    }
                }
            }
        });
    }

    if (resetDbBtn) {
        resetDbBtn.addEventListener('click', async () => {
            if (confirm('CRITICAL: This will delete ALL scores AND ALL rosters (Troops and Patrols).\n\nAre you sure?')) {
                const check = prompt("Type 'RESET' to confirm:");
                if (check === 'RESET') {
                    try {
                        const res = await fetch('/api/admin/full-reset', { method: 'DELETE' });
                        if (res.ok) {
                            localStorage.clear(); // Purge cache on this device
                            alert('Database has been fully reset.');
                            window.location.reload();
                        } else {
                            alert('Failed to reset database.');
                        }
                    } catch (e) {
                        alert('Error: ' + e.message);
                    }
                }
            }
        });
    }

    if (navDashboard) {
        navDashboard.addEventListener('click', () => switchView('dashboard'));
    }

    const copyEmailsBtn = document.getElementById('btn-copy-emails');
    if (copyEmailsBtn) copyEmailsBtn.onclick = copyJudgeEmails;

    const exportAwardsBtn = document.getElementById('btn-export-awards');
    if (exportAwardsBtn) {
        // Awards CSV: Winners List (Processed Client-Side)
        exportAwardsBtn.onclick = () => exportAwardsCSV();
    }

    const createStickersBtn = document.getElementById('btn-create-stickers');
    if (createStickersBtn) {
        createStickersBtn.onclick = () => renderStickers(false);
    }

    const printPreviewBtn = document.getElementById('btn-print-preview');
    if (printPreviewBtn) {
        printPreviewBtn.onclick = () => window.print();
    }

    // Form Listener
    const regForm = document.getElementById('reg-form');
    if (regForm) {
        regForm.addEventListener('submit', handleRegistration);
    }

    if (transposeBtn) {
        transposeBtn.addEventListener('click', () => {
            matrixTranspose = !matrixTranspose;
            renderMatrix();
        });
    }

    if (viewModeSelect) {
        viewModeSelect.addEventListener('change', (e) => {
            currentViewMode = e.target.value;
            refreshCurrentView();
            // Also hide stickers preview if changing modes
            const previewContainer = document.getElementById('stickers-preview-container');
            const printBtn = document.getElementById('btn-print-preview');
            if (previewContainer) previewContainer.classList.add('hidden');
            if (printBtn) printBtn.classList.add('hidden');
        });
    }
}

function handleBack() {
    if (currentView === 'detail' || currentView === 'matrix') {
        switchView('overview');
    } else {
        switchView('dashboard');
    }
}
window.handleBack = handleBack;

function refreshCurrentView() {
    if (currentView === 'overview') {
        renderOverviewList();
    }
    else if (currentView === 'matrix') {
        renderMatrix();
    }
    else if (currentView === 'awards') {
        // Clear preview container if we switch modes while on Awards view
        const previewContainer = document.getElementById('stickers-preview-container');
        const printBtn = document.getElementById('btn-print-preview');
        if (previewContainer && !previewContainer.classList.contains('hidden')) {
            previewContainer.classList.add('hidden');
        }
        if (printBtn && !printBtn.classList.contains('hidden')) {
            printBtn.classList.add('hidden');
        }
    }
}

function switchView(viewName, pushToHistory = true) {
    currentView = viewName;
    document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));

    const headerActions = document.getElementById('header-actions');
    const modeFilter = document.getElementById('mode-filter-container');
    const navBar = document.querySelector('header nav');
    const backBtn = document.getElementById('header-back-btn');

    // Hide/Show header elements based on view
    if (viewName === 'dashboard') {
        if (headerActions) headerActions.classList.add('hidden');
        if (navBar) navBar.classList.add('hidden');
        if (backBtn) backBtn.classList.add('hidden');
        setSubtitle('');
    } else {
        if (headerActions) headerActions.classList.remove('hidden');
        if (navBar) navBar.classList.remove('hidden');

        // Filter pull-down: only overview and awards
        if (viewName === 'overview' || viewName === 'awards') {
            if (modeFilter) modeFilter.classList.remove('hidden');
        } else {
            if (modeFilter) modeFilter.classList.add('hidden');
        }

        // Back Button: Visible on all views except dashboard
        if (viewName !== 'dashboard') {
            if (backBtn) backBtn.classList.remove('hidden');
        } else {
            if (backBtn) backBtn.classList.add('hidden');
        }
    }

    if (pushToHistory) {
        const url = new URL(window.location);
        url.searchParams.set('view', viewName);
        if (viewName !== 'detail') url.searchParams.delete('gameId');
        window.history.pushState({ view: viewName, gameId: activeGameId }, '', url);
    }

    if (viewName === 'dashboard') {
        document.getElementById('view-dashboard').classList.remove('hidden');
    } else if (viewName === 'overview') {
        document.getElementById('view-overview').classList.remove('hidden');
        setSubtitle('Game Overview');
        refreshCurrentView();
    } else if (viewName === 'matrix') {
        document.getElementById('view-matrix').classList.remove('hidden');
        // renderMatrix sets its own subtitle
        renderMatrix();
    } else if (viewName === 'detail') {
        document.getElementById('view-detail').classList.remove('hidden');
    } else if (viewName === 'registration') {
        document.getElementById('view-registration').classList.remove('hidden');
        setSubtitle('Registration');
        renderRoster();
    } else if (viewName === 'awards') {
        document.getElementById('view-awards').classList.remove('hidden');
        setSubtitle('Awards & Exports');
    } else if (viewName === 'judges') {
        document.getElementById('view-judges').classList.remove('hidden');
        setSubtitle('Judges Directory');
        renderJudgesView();
    } else if (viewName === 'debug') {
        document.getElementById('view-debug').classList.remove('hidden');
        setSubtitle('System Tools');
    } else if (viewName === 'qrcode') {
        document.getElementById('view-qrcode').classList.remove('hidden');
        setSubtitle('QR Generator');
        const urlInput = document.getElementById('qr-url');
        if (urlInput && !urlInput.value) {
            urlInput.value = window.location.origin;
        }
    }
}
window.switchView = switchView;

function setSubtitle(text) {
    const subtitle = document.getElementById('header-subtitle');
    if (subtitle) {
        subtitle.innerText = text ? ` - ${text}` : '';
    }
}

function exportAwardsCSV() {
    const el1 = document.getElementById('awards-line1');
    const el2 = document.getElementById('awards-line2');
    const line1 = el1?.value || el1?.placeholder || "";
    const line2 = el2?.value || el2?.placeholder || "";

    const rows = [];
    if (line1) rows.push([line1]);
    if (line2) rows.push([line2]);
    if (line1 || line2) rows.push([]); // Spacer row

    rows.push(["Category", "Rank", "Entity Name", "Troop #"]);
    const pointsMap = calculateScoreContext();

    // 1. All Individual Games
    const games = appData.games.filter(g => (g.type || 'patrol') === currentViewMode);

    // Identify any "entryname" fields across these games to include in the export
    const entryNameFieldConfigs = [];
    games.forEach(g => {
        const fields = [...(g.fields||[]), ...(appData.commonScoring||[])];
        fields.forEach(f => {
            if (f.kind === 'entryname' && !entryNameFieldConfigs.find(x => x.id === f.id)) {
                entryNameFieldConfigs.push(f);
            }
        });
    });

    rows.push(["Category", "Rank", "Entity Name", "Troop #", ...entryNameFieldConfigs.map(f => f.label)]);

    games.forEach(game => {
        const gameScores = appData.scores.filter(s => s.game_id === game.id).map(score => {
            let total = 0;
            const fields = [...(game.fields || []), ...(appData.commonScoring || [])];
            fields.forEach(f => {
                if (f.kind === 'points' || f.kind === 'penalty') {
                    const val = parseFloat(score.score_payload[f.id]);
                    if (!isNaN(val)) {
                        if (f.kind === 'penalty') total -= val;
                        else total += val;
                    }
                }
            });
            return { ...score, _total: total };
        });

        // Dense Rank for this game
        const sorted = [...gameScores].sort((a,b) => b._total - a._total);
        let curRank = 0;
        let lastT = null;
        sorted.forEach(s => {
            if (s._total !== lastT) {
                curRank++;
                lastT = s._total;
            }
            s._autoRank = getOrdinalSuffix(curRank);

            const finalRank = s.score_payload.manual_rank || s._autoRank;
            const rankClean = String(finalRank).toLowerCase().trim();
            const topRanks = ['1', '1st', '2', '2nd', '3', '3rd'];

            if (topRanks.includes(rankClean)) {
                const row = [
                    formatGameTitle(game),
                    finalRank,
                    s.entity_name,
                    s.troop_number
                ];
                // Append any entryname field values
                entryNameFieldConfigs.forEach(f => {
                    row.push(s.score_payload[f.id] || "");
                });
                rows.push(row);
            }
        });
    });

    // 2. Overall Leaderboard
    const entities = appData.entities.filter(e => e.type === currentViewMode);
    entities.forEach(p => {
        let total = 0;
        games.forEach(g => {
            if (pointsMap[p.id] && pointsMap[p.id][g.id]) {
                total += pointsMap[p.id][g.id];
            }
        });
        p._leaderboardTotal = total;
    });

    const lbSorted = [...entities].sort((a,b) => b._leaderboardTotal - a._leaderboardTotal);
    let curLBRank = 0;
    let lastLBT = null;
    lbSorted.forEach(p => {
        if (p._leaderboardTotal !== lastLBT) {
            curLBRank++;
            lastLBT = p._leaderboardTotal;
        }
        p._autoOverallRank = getOrdinalSuffix(curLBRank);
        const finalRank = p.manual_rank || p._autoOverallRank;
        const rankClean = String(finalRank).toLowerCase().trim();

        // Match 1st-3rd OR if it has ANY text but isn't 4th+?
        // User asked for: 1st-3rd OR custom text like 'Top Dog'
        const topRanks = ['1', '1st', '2', '2nd', '3', '3rd'];
        const isStandardTop = topRanks.includes(rankClean);
        const isCustom = p.manual_rank && p.manual_rank.length > 0;

        if (isStandardTop || isCustom) {
            const row = [
                "OVERALL",
                finalRank,
                p.name,
                p.troop_number
            ];
            // Spacer cells for entryname columns on the overall leaderboard
            entryNameFieldConfigs.forEach(() => row.push(""));
            rows.push(row);
        }
    });

    if (rows.length === 1) {
        alert("No award-level ranks found yet.");
        return;
    }

    const csvContent = "data:text/csv;charset=utf-8,"
        + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Coyote_Awards_${currentViewMode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderStickers(autoPrint = true) {
    const el1 = document.getElementById('awards-line1');
    const el2 = document.getElementById('awards-line2');
    const headerLine1 = el1?.value || "";
    const headerLine2 = el2?.value || "";

    const pointsMap = calculateScoreContext();
    const games = appData.games.filter(g => (g.type || 'patrol') === currentViewMode);

    const resultsByGroup = []; // Each item is { title: string, winners: [] }

    // 1. Individual Games
    games.forEach(game => {
        const gameScores = appData.scores.filter(s => s.game_id === game.id).map(score => {
            let total = 0;
            const fields = [...(game.fields || []), ...(appData.commonScoring || [])];
            fields.forEach(f => {
                if (f.kind === 'points' || f.kind === 'penalty') {
                    const val = parseFloat(score.score_payload[f.id]);
                    if (!isNaN(val)) {
                        if (f.kind === 'penalty') total -= val;
                        else total += val;
                    }
                }
            });
            return { ...score, _total: total };
        });

        const sorted = [...gameScores].sort((a,b) => b._total - a._total);
        let curRank = 0;
        let lastT = null;
        const gameWinners = [];

        // Identify any "entryname" fields for this game
        const entryFields = [...(game.fields || []), ...(appData.commonScoring || [])].filter(f => f.kind === 'entryname');

        sorted.forEach(s => {
            if (s._total !== lastT) {
                curRank++;
                lastT = s._total;
            }
            s._autoRank = getOrdinalSuffix(curRank);
            const finalRank = s.score_payload.manual_rank || s._autoRank;
            const rankClean = String(finalRank).toLowerCase().trim();
            const topRanks = ['1', '1st', '2', '2nd', '3', '3rd'];

            if (topRanks.includes(rankClean)) {
                // Line 4: "(1st|2nd|3rd) Place" - "Tnnn" + patrol name if patrol games + ,entryname
                let line4 = `${finalRank} Place - T${s.troop_number}`;
                if (currentViewMode === 'patrol') {
                    line4 += ` ${s.entity_name}`;
                }

                if (entryFields.length > 0) {
                    const entryVals = entryFields.map(f => s.score_payload[f.id]).filter(v => v).join(", ");
                    if (entryVals) line4 += `, ${entryVals}`;
                }

                gameWinners.push({
                    gameName: formatGameTitle(game),
                    line4: line4
                });
            }
        });
        if (gameWinners.length > 0) {
            resultsByGroup.push({ title: game.id, winners: gameWinners });
        }
    });

    // 2. Overall Leaderboard
    const entities = appData.entities.filter(e => e.type === currentViewMode);
    entities.forEach(p => {
        let total = 0;
        games.forEach(g => {
            if (pointsMap[p.id] && pointsMap[p.id][g.id]) {
                total += pointsMap[p.id][g.id];
            }
        });
        p._leaderboardTotal = total;
    });

    const lbSorted = [...entities].sort((a,b) => b._leaderboardTotal - a._leaderboardTotal);
    let curLBRank = 0;
    let lastLBT = null;
    const overallWinners = [];

    lbSorted.forEach(p => {
        if (p._leaderboardTotal !== lastLBT) {
            curLBRank++;
            lastLBT = p._leaderboardTotal;
        }
        p._autoOverallRank = getOrdinalSuffix(curLBRank);
        const finalRank = p.manual_rank || p._autoOverallRank;
        const rankClean = String(finalRank).toLowerCase().trim();
        const topRanks = ['1', '1st', '2', '2nd', '3', '3rd'];

        if (topRanks.includes(rankClean) || (p.manual_rank && p.manual_rank.length > 0)) {
            let line4 = `${finalRank}${topRanks.includes(rankClean) ? " Place" : ""} - T${p.troop_number}`;
            if (currentViewMode === 'patrol') {
                line4 += ` ${p.name}`;
            }

            overallWinners.push({
                gameName: "OVERALL LEADERBOARD",
                line4: line4
            });
        }
    });
    if (overallWinners.length > 0) {
        resultsByGroup.push({ title: 'OVERALL', winners: overallWinners });
    }

    if (resultsByGroup.length === 0) {
        alert("No awards found to print.");
        return;
    }

    // Build the table(s)
    const printContainer = document.getElementById('stickers-container');
    const previewWrapper = document.getElementById('stickers-preview-table-wrapper');
    const previewContainer = document.getElementById('stickers-preview-container');
    const printBtn = document.getElementById('btn-print-preview');

    printContainer.innerHTML = '';
    previewWrapper.innerHTML = '';

    const printTable = document.createElement('table');
    printTable.className = 'sticker-table';

    const previewTable = document.createElement('table');
    previewTable.className = 'sticker-preview-table';

    resultsByGroup.forEach(group => {
        let cellsInCurrentRow = 0;
        let trPrint = document.createElement('tr');
        let trPreview = document.createElement('tr');

        printTable.appendChild(trPrint);
        previewTable.appendChild(trPreview);

        group.winners.forEach((w, idx) => {
            if (cellsInCurrentRow === 3) {
                trPrint = document.createElement('tr');
                trPreview = document.createElement('tr');
                printTable.appendChild(trPrint);
                previewTable.appendChild(trPreview);
                cellsInCurrentRow = 0;
            }

            const innerHtml = `
                <div class="sticker-content">
                    ${headerLine1 ? `<div class="sticker-header">${headerLine1}</div>` : ''}
                    ${headerLine2 ? `<div class="sticker-header">${headerLine2}</div>` : ''}
                    <div class="sticker-game">${w.gameName}</div>
                    <div class="sticker-info">${w.line4}</div>
                </div>
            `;

            const tdPrint = document.createElement('td');
            tdPrint.innerHTML = innerHtml;
            trPrint.appendChild(tdPrint);

            const tdPreview = document.createElement('td');
            tdPreview.innerHTML = innerHtml;
            trPreview.appendChild(tdPreview);

            cellsInCurrentRow++;
        });

        // Pad the remainder
        if (cellsInCurrentRow > 0 && cellsInCurrentRow < 3) {
            for (let i = cellsInCurrentRow; i < 3; i++) {
                trPrint.appendChild(document.createElement('td'));
                trPreview.appendChild(document.createElement('td'));
            }
        }
    });

    printContainer.appendChild(printTable);
    previewWrapper.appendChild(previewTable);

    // Show preview area
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (printBtn) printBtn.classList.remove('hidden');

    if (autoPrint) {
        window.print();
    } else {
        // Scroll to preview
        previewContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

function toggleFinalMode(checked) {
    finalMode = checked;
    const main = document.querySelector('main');
    if (main) {
        if (finalMode) main.classList.add('compact-mode');
        else main.classList.remove('compact-mode');
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

// --- Score & Ranking Utils ---

function getOrdinalSuffix(i) {
    const j = i % 10, k = i % 100;
    if (j === 1 && k !== 11) return i + "st";
    if (j === 2 && k !== 12) return i + "nd";
    if (j === 3 && k !== 13) return i + "rd";
    return i + "th";
}

function getPointsForRank(r) {
    const m = String(r).match(/\d+/);
    const n = m ? parseInt(m[0]) : 999;
    if (n === 1) return 100;
    if (n === 2) return 90;
    if (n === 3) return 80;
    if (n === 4) return 70;
    if (n === 5) return 60;
    return 50;
}

function calculateScoreContext() {
    // 1. Calculate totals for every score
    const enrichedScores = appData.scores.map(score => {
        const game = appData.games.find(g => g.id === score.game_id);
        let total = 0;
        if (game) {
            const fields = game.fields || [];
            fields.forEach(f => {
                if (f.kind === 'points' || f.kind === 'penalty') {
                    const val = parseFloat(score.score_payload[f.id]);
                    if (!isNaN(val)) {
                        if (f.kind === 'penalty') total -= val;
                        else total += val;
                    }
                }
            });
        }
        return { ...score, _total: total };
    });

    // 2. Group by game to calculate dense ranks
    const gameGroups = {};
    enrichedScores.forEach(s => {
        if (!gameGroups[s.game_id]) gameGroups[s.game_id] = [];
        gameGroups[s.game_id].push(s);
    });

    const finalPointsMap = {}; // { entity_id: { game_id: points } }

    Object.keys(gameGroups).forEach(gameId => {
        const scores = gameGroups[gameId];
        scores.sort((a, b) => b._total - a._total);

        let currentAutoRank = 0;
        let lastTotal = null;
        scores.forEach(s => {
            if (s._total !== lastTotal) {
                currentAutoRank++;
                lastTotal = s._total;
            }
            s._autoRank = getOrdinalSuffix(currentAutoRank);

            // Apply Manual Overrides
            const finalRank = s.score_payload.manual_rank || s._autoRank;
            const autoPts = getPointsForRank(finalRank);
            const mPts = s.score_payload.manual_points;
            const finalPoints = (mPts !== undefined && mPts !== "" && mPts !== null) ? parseFloat(mPts) : autoPts;

            if (!finalPointsMap[s.entity_id]) finalPointsMap[s.entity_id] = {};
            finalPointsMap[s.entity_id][gameId] = finalPoints;
        });
    });

    return finalPointsMap;
}

// --- Overview ---

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

    // Inject Leaderboard row
    const lbTr = document.createElement('tr');
    lbTr.style.cursor = 'pointer';
    lbTr.className = 'table-info';
    lbTr.onclick = () => switchView('matrix');
    lbTr.innerHTML = `
        <td class="fw-bold">Game 0. Leader Board</td>
        <td>-</td>
        <td class="text-center">
            <span class="badge bg-info text-dark">Aggregated</span>
        </td>
        <td class="text-end">
            <button class="btn btn-sm btn-info">Open</button>
        </td>
    `;
    tbody.appendChild(lbTr);

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

    if (activeGameId !== gameId) {
        activeGameId = gameId;
        detailSort = { col: 'troop_number', dir: 'asc' };

        // Update URL/History if we are already in detail view
        if (currentView === 'detail') {
            const url = new URL(window.location);
            url.searchParams.set('view', 'detail');
            url.searchParams.set('gameId', gameId);
            window.history.pushState({ view: 'detail', gameId: gameId }, '', url);
        }
    }

    const title = formatGameTitle(game);
    document.getElementById('detail-title').innerText = title;
    setSubtitle(title);
    const table = document.getElementById('detail-table');
    table.innerHTML = '';
    table.className = 'spreadsheet-table'; // Enforce spreadsheet look

    const sortOrderFn = (a, b) => (a.sortOrder ?? 900) - (b.sortOrder ?? 900);
    const allFields = [
        ...(game.fields || []),
        ...(appData.commonScoring || [])
    ].sort(sortOrderFn);

    const scoringFields = allFields.filter(f => f.id !== 'judge_notes');
    const notesField = allFields.find(f => f.id === 'judge_notes');

    // Filter and Enrich
    const gameScores = appData.scores.filter(s => s.game_id === gameId).map(score => {
        let total = 0;
        scoringFields.forEach(f => {
            // Only sum if kind is "points" or "penalty"
            if (f.kind === 'points' || f.kind === 'penalty') {
                const val = parseFloat(score.score_payload[f.id]);
                if (!isNaN(val)) {
                    if (f.kind === 'penalty') {
                        total -= val;
                    } else {
                        total += val;
                    }
                }
            }
        });
        return { ...score, _total: total };
    });

    // 1. Calculate Auto Ranks (Dense: 1, 1, 2)
    const sortedForRank = [...gameScores].sort((a,b) => (b._total || 0) - (a._total || 0));
    let currentAutoRank = 0;
    let lastTotal = null;
    sortedForRank.forEach(s => {
        if (s._total !== lastTotal) {
            currentAutoRank++;
            lastTotal = s._total;
        }
        s._autoRank = getOrdinalSuffix(currentAutoRank);
    });

    // 2. Finalize Rank/Points
    gameScores.forEach(s => {
        s._finalRank = s.score_payload.manual_rank || s._autoRank;
        const autoPts = getPointsForRank(s._finalRank);
        const mPts = s.score_payload.manual_points;
        s._finalPoints = (mPts !== undefined && mPts !== "" && mPts !== null) ? parseFloat(mPts) : autoPts;
    });

    // Sort Detail Table
    gameScores.sort((a, b) => {
        let valA, valB;
        if (detailSort.col === 'troop_number') {
            valA = parseInt(a.troop_number) || 0;
            valB = parseInt(b.troop_number) || 0;
        } else if (detailSort.col === 'entity_name') {
            valA = String(a.entity_name || '').toLowerCase();
            valB = String(b.entity_name || '').toLowerCase();
        } else if (detailSort.col === 'timestamp') {
            valA = new Date(a.timestamp).getTime();
            valB = new Date(b.timestamp).getTime();
        } else if (detailSort.col === '_total') {
            valA = a._total;
            valB = b._total;
        } else if (detailSort.col === '_finalRank') {
            const getRankNum = (v) => {
                const m = String(v).match(/\d+/);
                return m ? parseInt(m[0]) : 999;
            };
            valA = getRankNum(a._finalRank);
            valB = getRankNum(b._finalRank);
        } else if (detailSort.col === '_finalPoints') {
            valA = parseFloat(a._finalPoints) || 0;
            valB = parseFloat(b._finalPoints) || 0;
        } else {
            // Dynamic Field ID
            valA = a.score_payload[detailSort.col];
            valB = b.score_payload[detailSort.col];

            // Normalize for comparison
            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = String(valA).toLowerCase();
                valB = String(valB).toLowerCase();
            }
        }

        if (valA < valB) return detailSort.dir === 'asc' ? -1 : 1;
        if (valA > valB) return detailSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    // Build Headers
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const addSortBtn = (th, colId) => {
        th.style.cursor = 'pointer';
        th.classList.add('sortable-header');

        if (detailSort.col === colId) {
            const arrow = detailSort.dir === 'asc' ? ' ▲' : ' ▼';
            const innerDiv = th.querySelector('.header-text') || th.querySelector('div');
            if (innerDiv) {
                const arrowSpan = document.createElement('span');
                arrowSpan.innerText = arrow;
                innerDiv.appendChild(arrowSpan);
            } else {
                th.innerText += arrow;
            }
            th.classList.add('sorted');
        }

        th.onclick = () => {
            if (detailSort.col === colId) {
                detailSort.dir = detailSort.dir === 'asc' ? 'desc' : 'asc';
            } else {
                detailSort.col = colId;
                detailSort.dir = 'asc';
            }
            openGameDetail(gameId);
        };
    };

    const thTroop = createTh('Troop');
    addSortBtn(thTroop, 'troop_number');
    headerRow.appendChild(thTroop);

    const thName = createTh('Name');
    addSortBtn(thName, 'entity_name');
    headerRow.appendChild(thName);

    const thTime = createTh('Time');
    addSortBtn(thTime, 'timestamp');
    thTime.classList.add('collapsible-col');
    headerRow.appendChild(thTime);

    // Edit Column (Emoji only, positioned after Time)
    const thEdit = createTh('✏️');
    thEdit.classList.add('collapsible-col');
    headerRow.appendChild(thEdit);

    scoringFields.forEach(field => {
        const th = createTh(field.label);
        th.className += ' rotate-header';
        if (field.kind !== 'entryname') th.className += ' collapsible-col';
        th.title = field.label; // Tooltip for readability
        addSortBtn(th, field.id);
        headerRow.appendChild(th);
    });

    const thTotal = createTh('Game<br>Total');
    addSortBtn(thTotal, '_total');
    headerRow.appendChild(thTotal);

    const thRank = document.createElement('th');
    thRank.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; padding:2px;">
            <div class="form-check form-switch p-0" style="min-height:auto; display:flex; align-items:center; justify-content:center;" onclick="event.stopPropagation()">
                <input class="form-check-input ms-0" type="checkbox" id="toggle-compact-view" ${finalMode ? 'checked' : ''} onchange="toggleFinalMode(this.checked)" style="transform: scale(0.9); cursor:pointer; margin-top:0;">
                <span class="fw-bold text-uppercase ms-1" style="font-size: 0.6rem; color:#666;">Final</span>
            </div>
            <div class="header-text" style="font-weight:bold; line-height:1.1;">Game<br>Rank</div>
        </div>
    `;
    addSortBtn(thRank, '_finalRank');
    headerRow.appendChild(thRank);

    const thPoints = createTh('Overall<br>Points');
    addSortBtn(thPoints, '_finalPoints');
    headerRow.appendChild(thPoints);

    if (notesField) {
        const thNotes = createTh('Notes');
        thNotes.style.minWidth = '250px';
        headerRow.appendChild(thNotes);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    gameScores.forEach(score => {
        const tr = document.createElement('tr');

        tr.appendChild(createTd(score.troop_number));
        tr.appendChild(createTd(score.entity_name));

        // Time format: HH:MM
        const ts = new Date(score.timestamp);
        const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const tdTime = createTd(timeStr);
        tdTime.classList.add('collapsible-col');
        tr.appendChild(tdTime);

        // Action: Edit (Positioned after Time, emoji only)
        const actionTd = document.createElement('td');
        actionTd.classList.add('collapsible-col');
        const btn = document.createElement('button');
        btn.innerHTML = '✏️';
        btn.className = 'btn-link';
        btn.onclick = () => showEditModal(score, game);
        actionTd.appendChild(btn);
        tr.appendChild(actionTd);

        scoringFields.forEach(field => {
            const val = score.score_payload[field.id];
            if (field.audience === 'admin') {
                const td = document.createElement('td');
                if (field.kind !== 'entryname') td.classList.add('collapsible-col');
                const input = document.createElement('input');
                input.className = 'admin-input';
                input.type = field.type === 'number' ? 'number' : 'text';
                input.value = val !== undefined ? val : (field.defaultValue || '');
                input.onchange = async () => {
                    let newVal = input.value;
                    if (field.type === 'number') {
                        newVal = parseFloat(input.value);
                        if (isNaN(newVal)) newVal = 0;
                    }
                    await updateScoreField(score.uuid, field.id, newVal);

                    // Live update the total if it's a points or penalty field
                    if (field.kind === 'points' || field.kind === 'penalty') {
                        // Recalculate local _total
                        let total = 0;
                        scoringFields.forEach(f => {
                            if (f.kind === 'points' || f.kind === 'penalty') {
                                const v = parseFloat(score.score_payload[f.id]);
                                if (!isNaN(v)) {
                                    if (f.kind === 'penalty') {
                                        total -= v;
                                    } else {
                                        total += v;
                                    }
                                }
                            }
                        });
                        score._total = total;
                        // Find the total cell in this row (it's the one before notes if notes exist, OR the last one otherwise)
                        // Actually, safer to just update the innerHTML of the total cell if we can find it.
                        // Or just trigger a re-render of the whole game detail if performance isn't an issue.
                        // Given the context, a re-render is simplest.
                        openGameDetail(activeGameId);
                    }
                };
                td.appendChild(input);
                tr.appendChild(td);
            } else {
                const td = createTd(formatValue(val, field.type));
                if (field.kind !== 'entryname') td.classList.add('collapsible-col');
                if (field.kind === 'penalty') {
                    td.style.color = 'red';
                    td.style.fontWeight = 'bold';
                }
                tr.appendChild(td);
            }
        });

        // Total Column
        tr.appendChild(createTd(`<strong>${score._total}</strong>`));

        // Rank Cell (Manual Input)
        const tdRank = document.createElement('td');
        const inputRank = document.createElement('input');
        inputRank.className = 'admin-input';
        inputRank.style.width = '50px';
        inputRank.value = score.score_payload.manual_rank || '';
        inputRank.placeholder = score._autoRank;
        inputRank.onchange = async () => {
            await updateScoreField(score.uuid, 'manual_rank', inputRank.value);
            openGameDetail(gameId);
        };
        tdRank.appendChild(inputRank);
        tr.appendChild(tdRank);

        // Placement Points Column (Manual Input)
        const tdPoints = document.createElement('td');
        const inputPoints = document.createElement('input');
        inputPoints.className = 'admin-input';
        inputPoints.type = 'number';
        inputPoints.style.width = '60px';
        inputPoints.value = (score.score_payload.manual_points !== undefined && score.score_payload.manual_points !== null) ? score.score_payload.manual_points : '';
        const autoPts = getPointsForRank(score._finalRank);
        inputPoints.placeholder = autoPts;
        inputPoints.onchange = async () => {
            let val = inputPoints.value;
            if (val !== "") val = parseFloat(val);
            else val = null;
            await updateScoreField(score.uuid, 'manual_points', val);
            openGameDetail(gameId);
        };
        tdPoints.appendChild(inputPoints);
        tr.appendChild(tdPoints);

        // Judge Notes (Last)
        if (notesField) {
            const val = score.score_payload[notesField.id] || '';
            const tdNotes = createTd(val);
            tdNotes.style.whiteSpace = 'normal';
            tdNotes.style.textAlign = 'left';
            tdNotes.style.minWidth = '200px';
            tr.appendChild(tdNotes);
        }

        tbody.appendChild(tr);
    });

    if (gameScores.length === 0) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7 + scoringFields.length + (notesField ? 1 : 0);
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
    th.innerHTML = `<div>${text}</div>`;
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
    table.className = 'spreadsheet-table'; // Match the scoreboard look

    const modeTitle = currentViewMode.charAt(0).toUpperCase() + currentViewMode.slice(1);
    const lbTitle = `${modeTitle} Leader Board`;
    document.getElementById('matrix-title').innerText = lbTitle;
    setSubtitle(lbTitle);

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
    // 1. Calculate points map (points for every score)
    const pointsMap = calculateScoreContext();

    // 2. Calculate totals per patrol
    patrols.forEach(p => {
        let total = 0;
        games.forEach(g => {
            if (pointsMap[p.id] && pointsMap[p.id][g.id]) {
                total += pointsMap[p.id][g.id];
            }
        });
        p._leaderboardTotal = total;
    });

    // 3. Dense Rank the patrol leaderboard totals
    const sortedForRank = [...patrols].sort((a,b) => b._leaderboardTotal - a._leaderboardTotal);
    let curRank = 0;
    let lastLT = null;
    sortedForRank.forEach(p => {
        if (p._leaderboardTotal !== lastLT) {
            curRank++;
            lastLT = p._leaderboardTotal;
        }
        p._autoOverallRank = getOrdinalSuffix(curRank);
    });

    // 4. Sort patrols based on Leaderboard Total (desc) by default
    patrols.sort((a, b) => {
        if (b._leaderboardTotal !== a._leaderboardTotal) return b._leaderboardTotal - a._leaderboardTotal;
        const numA = parseInt(a.troop_number) || 0;
        const numB = parseInt(b.troop_number) || 0;
        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name);
    });

    // Header: Entity Info + Games
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createTh('Troop'));
    headerRow.appendChild(createTh(currentViewMode === 'patrol' ? 'Patrol' : 'Troop Name'));

    games.forEach(g => {
        const th = createTh(formatGameTitle(g));
        th.className = 'rotate-header';
        th.title = g.name;
        headerRow.appendChild(th);
    });

    const thTotal = createTh('Overall<br>Points');
    headerRow.appendChild(thTotal);

    const thRank = document.createElement('th');
    thRank.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:5px; padding:2px;">
            <div class="form-check form-switch p-0" style="min-height:auto; display:flex; align-items:center; justify-content:center;" onclick="event.stopPropagation()">
                <input class="form-check-input ms-0" type="checkbox" id="toggle-compact-view" ${finalMode ? 'checked' : ''} onchange="toggleFinalMode(this.checked)" style="transform: scale(0.9); cursor:pointer; margin-top:0;">
                <span class="fw-bold text-uppercase ms-1" style="font-size: 0.6rem; color:#666;">Final</span>
            </div>
            <div class="header-text" style="font-weight:bold; line-height:1.1;">Overall<br>Rank</div>
        </div>
    `;
    headerRow.appendChild(thRank);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    patrols.forEach(patrol => {
        const tr = document.createElement('tr');
        tr.appendChild(createTd(patrol.troop_number));
        tr.appendChild(createTd(patrol.name));

        games.forEach(game => {
            const pts = (pointsMap[patrol.id] && pointsMap[patrol.id][game.id]) || 0;
            const td = document.createElement('td');
            td.className = 'cell-center';
            if (pts > 0) {
                td.innerText = pts;
            } else {
                td.innerHTML = '<span style="color:#eee">0</span>';
            }
            tr.appendChild(td);
        });

        // Total Column
        const tdTotal = createTd(patrol._leaderboardTotal);
        tdTotal.style.fontWeight = 'bold';
        tdTotal.classList.add('cell-center');
        tr.appendChild(tdTotal);

        // Editable Rank Column
        const tdRank = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.style.width = '100px';
        input.value = patrol.manual_rank || patrol._autoOverallRank;
        input.onchange = (e) => updateEntityField(patrol.id, 'manual_rank', e.target.value);
        tdRank.appendChild(input);
        tr.appendChild(tdRank);

        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
}

function renderMatrixTransposed(table, games, patrols) {
    const pointsMap = calculateScoreContext();

    // Calculate totals per patrol
    patrols.forEach(p => {
        let total = 0;
        games.forEach(g => {
            if (pointsMap[p.id] && pointsMap[p.id][g.id]) {
                total += pointsMap[p.id][g.id];
            }
        });
        p._leaderboardTotal = total;
    });

    // Dense Rank the patrol leaderboard totals
    const sortedForRankTrans = [...patrols].sort((a,b) => b._leaderboardTotal - a._leaderboardTotal);
    let curRankTrans = 0;
    let lastLTTrans = null;
    sortedForRankTrans.forEach(p => {
        if (p._leaderboardTotal !== lastLTTrans) {
            curRankTrans++;
            lastLTTrans = p._leaderboardTotal;
        }
        p._autoOverallRank = getOrdinalSuffix(curRankTrans);
    });

    // Header: Game Name + Patrols
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.appendChild(createTh('Game Name'));

    patrols.forEach(p => {
        const th = createTh(`${p.troop_number}<br>${p.name}`);
        th.className = 'rotate-header';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    games.forEach(game => {
        const tr = document.createElement('tr');
        tr.appendChild(createTd(formatGameTitle(game)));

        patrols.forEach(patrol => {
            const pts = (pointsMap[patrol.id] && pointsMap[patrol.id][game.id]) || 0;
            const td = document.createElement('td');
            td.className = 'cell-center';
            if (pts > 0) {
                td.innerText = pts;
            } else {
                td.innerHTML = '<span style="color:#eee">0</span>';
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });

    // Add Net Score row
    const totalRow = document.createElement('tr');
    const tdLabel = createTd('Overall<br>Points');
    tdLabel.style.fontWeight = 'bold';
    totalRow.appendChild(tdLabel);
    patrols.forEach(p => {
        const td = createTd(p._leaderboardTotal);
        td.style.fontWeight = 'bold';
        td.className = 'cell-center';
        totalRow.appendChild(td);
    });
    tbody.appendChild(totalRow);

    // Add Overall Rank row
    const rankRow = document.createElement('tr');
    const tdRankLabel = createTd('Overall<br>Rank');
    tdRankLabel.style.fontWeight = 'bold';
    rankRow.appendChild(tdRankLabel);
    patrols.forEach(p => {
        const td = document.createElement('td');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control form-control-sm';
        input.style.width = '60px'; // Smaller for transposed
        input.value = p.manual_rank || p._autoOverallRank;
        input.onchange = (e) => updateEntityField(p.id, 'manual_rank', e.target.value);
        td.appendChild(input);
        rankRow.appendChild(td);
    });
    tbody.appendChild(rankRow);

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
    troops.forEach((troop, index) => {
        const myPatrols = [
            ...(patrolsByParent[troop.id] || []),
            ...(patrolsByNum[troop.troop_number] || [])
        ];

        // Remove from fallback map so they don't appear in orphans
        if (patrolsByNum[troop.troop_number]) delete patrolsByNum[troop.troop_number];

        const details = document.createElement('details');
        details.open = true; // Default expanded
        details.className = "roster-group";
        // File-manager style: Compact, single borders, no gaps
        const isLastTroop = index === troops.length - 1;
        details.style = `border-bottom:${isLastTroop ? '0' : '1px solid #dee2e6'}; background:white; margin:0;`;

        const summary = document.createElement('summary');
        summary.style = "font-weight:bold; cursor:pointer; list-style:none; display:flex; align-items:center; padding: 4px 10px; background-color: #f1f3f4; border-bottom: 1px solid #e0e0e0;";
        summary.innerHTML = `
            <span style="font-size:0.8rem; margin-right:8px; color:#5f6368; transition: transform 0.2s;">▼</span>
            <span style="font-size:0.95rem;">${troop.name.startsWith('T') ? '' : 'Troop '}${troop.name}</span>
            <button class="btn btn-sm btn-link ms-auto text-decoration-none p-0 text-success fw-bold" style="font-size: 0.8rem;" onclick="addEntity('${troop.id}')">+ Add Patrol</button>
        `;

        // Simple arrow toggle logic
        summary.addEventListener('click', (e) => {
             // We need to wait for the open state to toggle or check current
             const arrow = summary.querySelector('span:first-child');
             // details.open is about to change
             setTimeout(() => {
                 arrow.style.transform = details.open ? '' : 'rotate(-90deg)';
             }, 10);
        });

        details.appendChild(summary);

        const list = document.createElement('div');
        list.style = "margin-left: 0;"; // Indentation handled by inner items

        if (myPatrols.length === 0) {
            list.innerHTML = '<div class="text-muted small p-2 fst-italic" style="padding-left: 35px !important;">No patrols registered</div>';
        } else {
            myPatrols.forEach(p => {
                const div = document.createElement('div');
                div.className = "d-flex justify-content-between align-items-center py-1 px-2 border-bottom";
                div.style.paddingLeft = "30px";
                div.style.backgroundColor = "transparent";
                div.innerHTML = `
                    <span style="font-size: 0.9rem;"><span style="color:#bdc1c6; margin-right:8px;">├─</span>${p.name} <small class="text-muted" style="font-size:0.75em">(${p.id})</small></span>
                    <span class="badge bg-light text-dark border-0 text-muted" style="font-size: 0.7rem;">PATROL</span>
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

    const sortFn = (a, b) => (a.sortOrder ?? 900) - (b.sortOrder ?? 900);
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

        const isPenalty = field.kind === 'penalty';
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.fontWeight = 'bold';
        if (isPenalty) label.style.color = 'red';
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
            if (isPenalty) {
                input.style.color = 'red';
                input.style.fontWeight = 'bold';
                input.style.borderColor = 'red';
            }
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

async function updateScoreField(uuid, fieldId, value) {
    const score = appData.scores.find(s => s.uuid === uuid);
    if (!score) return;

    // Update local copy
    score.score_payload[fieldId] = value;

    try {
        const response = await fetch('/api/scores/' + uuid, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ score_payload: score.score_payload })
        });

        if (!response.ok) {
            throw new Error('Failed to update score');
        }
    } catch (err) {
        console.error('Update failed:', err);
        alert('Failed to save change. Please refresh.');
    }
}

// --- QR Code Generator ---
let qrMode = 'wifi';

function setQrMode(mode) {
    qrMode = mode;
    const wifiTab = document.getElementById('tab-wifi');
    const urlTab = document.getElementById('tab-url');
    const wifiForm = document.getElementById('qr-wifi-form');
    const urlForm = document.getElementById('qr-url-form');

    if (mode === 'wifi') {
        wifiTab.classList.add('active');
        urlTab.classList.remove('active');
        wifiForm.classList.remove('hidden');
        urlForm.classList.add('hidden');
    } else {
        wifiTab.classList.remove('active');
        urlTab.classList.add('active');
        wifiForm.classList.add('hidden');
        urlForm.classList.remove('hidden');
    }
    // Clear previous QR
    document.getElementById('qr-output').innerHTML = '';
}

function generateQRCode() {
    const container = document.getElementById('qr-output');
    container.innerHTML = '';

    let text = '';
    let title = '';
    let instructions = '';

    if (qrMode === 'wifi') {
        const ssid = document.getElementById('qr-ssid').value.trim();
        const password = document.getElementById('qr-password').value.trim();
        const encryption = document.getElementById('qr-encryption').value;
        title = document.getElementById('qr-wifi-title').value.trim();
        instructions = document.getElementById('qr-wifi-instructions').value.trim();

        if (!ssid) {
            alert('Please enter an SSID');
            return;
        }
        // WIFI:T:WPA;S:mynetwork;P:mypass;;
        text = `WIFI:T:${encryption};S:${ssid};P:${password};;`;
    } else {
        const url = document.getElementById('qr-url').value.trim();
        title = document.getElementById('qr-url-title').value.trim();
        instructions = document.getElementById('qr-url-instructions').value.trim();
        if (!url) {
            alert('Please enter a URL');
            return;
        }
        text = url;
    }

    if (typeof QRCode === 'undefined') {
        container.innerHTML = '<div class="alert alert-danger">QR Library not loaded. Please ensure you have internet access or have downloaded qrcode.min.js to public/js/.</div>';
        return;
    }

    // Create a printable wrapper
    const wrapper = document.createElement('div');
    wrapper.style.textAlign = 'center';
    wrapper.style.padding = '20px';
    wrapper.style.border = '1px solid #ccc';
    wrapper.style.borderRadius = '8px';
    wrapper.style.backgroundColor = 'white';
    wrapper.style.display = 'inline-block';

    if (title) {
        const h2 = document.createElement('h2');
        h2.innerText = title;
        h2.style.marginBottom = '20px';
        wrapper.appendChild(h2);
    }

    const qrDiv = document.createElement('div');
    qrDiv.style.display = 'inline-block';
    wrapper.appendChild(qrDiv);

    if (instructions) {
        const p = document.createElement('p');
        p.innerText = instructions;
        p.style.marginTop = '20px';
        p.style.whiteSpace = 'pre-wrap';
        p.style.fontSize = '1.1rem';
        wrapper.appendChild(p);
    }

    container.appendChild(wrapper);

    new QRCode(qrDiv, {
        text: text,
        width: 256,
        height: 256
    });

    const printBtn = document.createElement('button');
    printBtn.className = 'btn btn-secondary mt-3 no-print';
    printBtn.innerText = '🖨️ Print QR Code';
    printBtn.onclick = () => window.print();
    container.appendChild(printBtn);
}

window.setQrMode = setQrMode;
window.generateQRCode = generateQRCode;

async function renderJudgesView() {
    const container = document.getElementById('judges-list');
    container.innerHTML = '<p class="text-muted">Loading judges...</p>';

    try {
        const res = await fetch('/api/admin/judges');
        if (!res.ok) throw new Error('Failed to load judges');
        const judges = await res.json();

        // Store for copy action
        appData.judges = judges;

        if (judges.length === 0) {
            container.innerHTML = '<div class="alert alert-info">No judges found.</div>';
            return;
        }

        let html = `
            <table class="table table-striped table-hover">
                <thead class="table-dark">
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Unit</th>
                        <th class="text-center">Scores</th>
                        <th>Games Judged</th>
                    </tr>
                </thead>
                <tbody>
        `;

        judges.forEach(j => {
            const gameNames = (j.games_judged || []).map(gid => {
                const g = appData.games.find(x => x.id === gid);
                return g ? formatGameTitle(g) : gid;
            }).join(', ');

            html += `
                <tr>
                    <td class="fw-bold">${j.name || '-'}</td>
                    <td><a href="mailto:${j.email}">${j.email}</a></td>
                    <td>${j.unit || '-'}</td>
                    <td class="text-center">${j.score_count}</td>
                    <td><small class="text-muted">${gameNames}</small></td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
    }
}

function copyJudgeEmails() {
    if (!appData.judges || appData.judges.length === 0) {
        alert('No judges loaded.');
        return;
    }
    // Filter out empty emails and join with semicolon
    const emails = appData.judges.map(j => j.email).filter(e => e).join('; ');

    if (!emails) {
        alert('No emails found.');
        return;
    }

    navigator.clipboard.writeText(emails).then(() => {
        alert('Emails copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy', err);
        prompt("Copy these emails:", emails);
    });
}

async function updateEntityField(entityId, fieldId, value) {
    const entity = appData.entities.find(e => e.id === entityId);
    if (!entity) return;

    // Update local copy
    entity[fieldId] = value;

    try {
        const response = await fetch('/api/entities/' + entityId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [fieldId]: value })
        });

        if (!response.ok) {
            throw new Error('Failed to update entity');
        }
    } catch (err) {
        console.error('Update failed:', err);
        alert('Failed to save change. Please refresh.');
    }
}
