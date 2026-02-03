/**
 * Coyote Camporee Designer Logic
 * Handles state management, UI rendering, and Zip Import/Export.
 */

const designer = {
    // 1. THE STATE
    // This object mirrors the structure of the zip file content
    data: {
        meta: {
            title: "New Camporee",
            theme: "",
            year: new Date().getFullYear(),
            director: ""
        },
        games: [] // Array of game objects
    },

    activeGameId: null, // Which game is currently being edited

    // 2. INITIALIZATION
    init: function() {
        console.log("Designer Initialized");

        // Setup Event Listeners
        document.getElementById('fileInput').addEventListener('change', this.handleFileUpload.bind(this));

        // Auto-save Meta changes to state
        ['metaTitle', 'metaTheme'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                const key = id === 'metaTitle' ? 'title' : 'theme';
                this.data.meta[key] = e.target.value;
            });
        });

        // Initial Render
        this.renderGameList();
    },

    // 3. CORE ACTIONS (New, Add, Delete)
    newCamporee: function() {
        if(confirm("Start a new Camporee? Unsaved changes will be lost.")) {
            this.data.games = [];
            this.data.meta = { title: "New Camporee", theme: "", year: new Date().getFullYear() };
            this.activeGameId = null;
            this.updateMetaUI();
            this.renderGameList();
        }
    },

    addGame: function() {
        const newId = `game_${Date.now()}`;
        const newGame = {
            id: newId,
            enabled: true,
            content: {
                title: "New Game",
                story: "",
                instructions: "",
                judge_instructions: ""
            },
            scoring: {
                method: "timed_asc", // default: lowest time wins
                components: [
                    { id: "time", type: "time", label: "Time", weight: 1 }
                ]
            }
        };
        this.data.games.push(newGame);
        this.renderGameList();
        this.editGame(newId); // Jump straight to editing it
    },

    deleteGame: function(gameId) {
        if(confirm("Are you sure you want to delete this game?")) {
            this.data.games = this.data.games.filter(g => g.id !== gameId);
            if (this.activeGameId === gameId) {
                this.activeGameId = null;
                document.getElementById('editor-container').innerHTML = '<p class="text-muted">Select a game to edit.</p>';
            }
            this.renderGameList();
        }
    },

    // 4. UI RENDERING
    updateMetaUI: function() {
        document.getElementById('metaTitle').value = this.data.meta.title || "";
        document.getElementById('metaTheme').value = this.data.meta.theme || "";
    },

    renderGameList: function() {
        const listEl = document.getElementById('gameList');
        listEl.innerHTML = '';

        if (this.data.games.length === 0) {
            listEl.innerHTML = '<div class="text-center text-muted p-4">No games loaded.</div>';
            return;
        }

        this.data.games.forEach(game => {
            const isActive = game.id === this.activeGameId ? 'active' : '';
            const statusClass = game.enabled ? 'text-success' : 'text-secondary';

            const item = document.createElement('a');
            item.className = `list-group-item list-group-item-action d-flex justify-content-between align-items-center ${isActive}`;
            item.href = "#";
            item.onclick = (e) => { e.preventDefault(); this.editGame(game.id); };

            item.innerHTML = `
                <div>
                    <strong>${game.content.title}</strong>
                    <br><small class="text-muted">${game.id}</small>
                </div>
                <div>
                    <i class="fas fa-circle ${statusClass} me-2" title="${game.enabled ? 'Enabled' : 'Disabled'}"></i>
                    <button class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); designer.deleteGame('${game.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            listEl.appendChild(item);
        });
    },

    editGame: function(gameId) {
        this.activeGameId = gameId;
        const game = this.data.games.find(g => g.id === gameId);

        // Switch to Editor Tab
        const tabTrigger