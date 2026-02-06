/**
 * Coyote Camporee Designer Logic (v16 - Hybrid Mode - Readable)
 * Features: Auto-Detect Server, Split Tabs, Drag/Drop, Atomic Presets.
 */

import { normalizeGameDefinition } from './core/schema.js';
import { generateFieldHTML } from './core/ui.js';

const designer = {
    // 1. THE STATE
    serverMode: false, // Feature Flag: True if backend is detected

    data: {
        meta: {
            camporeeId: null, // UUID for Server Storage
            title: "New Camporee",
            theme: "",
            year: new Date().getFullYear(),
            director: ""
        },
        games: []
    },

    presets: [
        { id: 'p_flag', label: "Patrol Flag", type: "number", kind: "points", weight: 10, audience: "judge", config: { min: 0, max: 10, placeholder: "0-10 Points" } },
        { id: 'p_yell', label: "Patrol Yell", type: "number", kind: "points", weight: 5,  audience: "judge", config: { min: 0, max: 5,  placeholder: "0-5 Points" } },
        { id: 'p_spirit', label: "Scout Spirit", type: "number", kind: "points", weight: 10, audience: "judge", config: { min: 0, max: 10, placeholder: "0-10 Points" } },
        { id: 'off_notes', label: "Judges Notes", type: "textarea", kind: "info", weight: 0, audience: "judge", config: { placeholder: "Issues, tie-breakers, etc." } },
        { id: 'off_score', label: "Official Score", type: "number", kind: "points", weight: 1, audience: "admin", config: { placeholder: "Final Calculated Points" } }
    ],

    activeGameId: null,
    pendingImportGames: [],
    dragSrcGameId: null,

    // 2. INITIALIZATION
    init: async function() {
        console.log("Designer Initialized");

        // 1. Check if we are online/server-connected
        await this.checkServerStatus();
        console.log("Server Mode Active:", this.serverMode);

        // 2. Setup UI
        this.setupDynamicTabs();
        this.injectModals();

        // 3. Bind File Imports
        const fileInput = document.getElementById('fileInput');
        if(fileInput) fileInput.addEventListener('change', (e) => this.handleCamporeeImport(e));

        // Hidden input for Single Game Import
        const gameInput = document.createElement('input');
        gameInput.type = 'file';
        gameInput.id = 'importGameInput';
        gameInput.accept = '.json,.zip';
        gameInput.style.display = 'none';
        gameInput.addEventListener('change', (e) => this.handleGameImport(e));
        document.body.appendChild(gameInput);

        // 4. Bind Meta Inputs
        ['metaTitle', 'metaTheme'].forEach(id => {
            const el = document.getElementById(id);
            if(el) {
                el.addEventListener('input', (e) => {
                    const key = id === 'metaTitle' ? 'title' : 'theme';
                    this.data.meta[key] = e.target.value;
                });
            }
        });

        // 5. Ensure ID exists
        if(!this.data.meta.camporeeId) {
            this.data.meta.camporeeId = this.generateUUID();
        }

        const titleInput = document.getElementById('metaTitle');
        if (titleInput) {
            titleInput.title = `Camporee UUID: ${this.data.meta.camporeeId}`;
            // Optional: Log it so you can see it in console immediately
            console.log("Current Camporee UUID:", this.data.meta.camporeeId);
        }

        this.renderServerControls();
        this.renderGameLists();
    },

    /**
     * Pings the server to see if we should show "Save to Server" buttons.
     */
    checkServerStatus: async function() {
        try {
            // Short timeout (2s) so offline users don't wait long
            const res = await fetch('/api/status', { method: 'GET', signal: AbortSignal.timeout(2000) });
            if(res.ok) {
                this.serverMode = true;
            }
        } catch(e) {
            this.serverMode = false;
        }
    },

    generateUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // 3. SERVER SYNC (Conditional)

    renderServerControls: function() {
        // If server is offline, DO NOT render controls
        if(!this.serverMode) return;

        const headerBtnGroup = document.querySelector('.d-flex.gap-2');
        if(headerBtnGroup) {
            // Clear old buttons if re-rendering
            const existing = document.getElementById('server-controls');
            if(existing) existing.remove();

            const div = document.createElement('div');
            div.id = 'server-controls';
            div.className = "btn-group ms-2";
            div.innerHTML = `
                <button class="btn btn-outline-light" onclick="designer.initiateServerSave()" title="Save to Server">
                    <i class="fas fa-cloud-upload-alt"></i> Save
                </button>
                <button class="btn btn-outline-light" onclick="designer.openServerLoadModal()" title="Load from Server">
                    <i class="fas fa-cloud-download-alt"></i> Load
                </button>
                <button class="btn btn-outline-light dropdown-toggle dropdown-toggle-split" data-bs-toggle="dropdown"></button>
                <ul class="dropdown-menu">
                    <li><a class="dropdown-item" href="#" onclick="designer.duplicateCamporee()"><i class="fas fa-copy"></i> Duplicate (Save As New)</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item" href="#" onclick="designer.newCamporee()"><i class="fas fa-file"></i> New Empty Camporee</a></li>
                </ul>
            `;
            headerBtnGroup.appendChild(div);
        }
    },

    openServerLoadModal: async function() {
        try {
            const res = await fetch('/api/camporees');
            const list = await res.json();

            const listEl = document.getElementById('serverLoadList');
            if (list.length > 0) {
                listEl.innerHTML = list.map(c => `
                    <a href="#" class="list-group-item list-group-item-action" onclick="designer.loadFromServer('${c.id}')">
                        <div class="d-flex w-100 justify-content-between">
                            <h5 class="mb-1">${c.title || 'Untitled'}</h5>
                            <small>${c.year}</small>
                        </div>
                        <p class="mb-1 small text-muted">${c.theme || 'No theme'}</p>
                        <small class="text-muted">ID: ${c.id}</small>
                    </a>
                `).join('');
            } else {
                listEl.innerHTML = '<div class="p-3 text-center text-muted">No saved camporees found.</div>';
            }

            new bootstrap.Modal(document.getElementById('serverLoadModal')).show();
        } catch(e) {
            alert("Server Error: Could not fetch list.");
        }
    },

    loadFromServer: async function(id) {
        if(!confirm("Load this? Unsaved changes will be lost.")) return;

        try {
            const res = await fetch(`/api/camporee/${id}`);
            if(!res.ok) throw new Error("Load failed");

            const data = await res.json();

            this.data.meta = data.meta;
            this.data.games = data.games || [];
            if(data.presets) this.presets = data.presets;

            // Ensure ID is set (legacy support)
            if(!this.data.meta.camporeeId) this.data.meta.camporeeId = id;

            this.normalizeGameSortOrders();
            this.updateMetaUI();
            this.renderGameLists();
            this.renderPresetManager();

            bootstrap.Modal.getInstance(document.getElementById('serverLoadModal')).hide();
            alert("Loaded from Server!");
        } catch(e) {
            alert("Error: " + e.message);
        }
    },

    initiateServerSave: async function() {
        const id = this.data.meta.camporeeId;

        // If brand new (no ID), just save
        if(!id) {
            this.data.meta.camporeeId = this.generateUUID();
            this.executeSave();
            return;
        }

        // Check for overwrite
        try {
            const res = await fetch(`/api/camporee/${id}/meta`);
            const result = await res.json();

            if(result.exists) {
                // Show Conflict Modal
                document.getElementById('overwriteServerTitle').innerText = result.meta.title;
                document.getElementById('overwriteServerTheme').innerText = result.meta.theme;
                document.getElementById('overwriteClientTitle').innerText = this.data.meta.title;
                document.getElementById('overwriteClientTheme').innerText = this.data.meta.theme;
                new bootstrap.Modal(document.getElementById('overwriteModal')).show();
            } else {
                this.executeSave();
            }
        } catch(e) {
            alert("Server Check Failed. Is server online?");
        }
    },

    executeSave: async function() {
        const id = this.data.meta.camporeeId;
        const payload = {
            meta: this.data.meta,
            games: this.data.games,
            presets: this.presets
        };

        try {
            const res = await fetch(`/api/camporee/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            // Hide overwrite modal if it was open
            const modalEl = document.getElementById('overwriteModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if(modal) modal.hide();

            if(result.success) alert("Saved Successfully!");
            else alert("Error: " + result.error);
        } catch(e) {
            alert("Save Failed: Network Error");
        }
    },

    duplicateCamporee: function() {
        if(confirm("Duplicate this Camporee? This will create a new ID and treat it as a new file.")) {
            this.data.meta.camporeeId = this.generateUUID();
            this.data.meta.title += " (Copy)";
            this.updateMetaUI();
            alert("Duplicated! You are now working on a copy. Click 'Save' to write it to the server.");
        }
    },

    // 4. UI SETUP & MODALS
    setupDynamicTabs: function() {
        const navTabs = document.querySelector('.nav-tabs');
        const tabContent = document.querySelector('.tab-content');
        if(!navTabs || !tabContent) return;

        // Hijack existing "Game Library" tab
        let libraryTab = document.getElementById('library-tab') || navTabs.children[1]?.querySelector('button');
        let libraryPane = document.getElementById('library-pane') || tabContent.children[1];

        if(libraryTab && libraryTab.innerText.includes('Library')) {
            libraryTab.id = 'patrol-tab';
            libraryTab.innerText = 'Patrol Games';
            libraryTab.setAttribute('data-bs-target', '#patrol-pane');

            libraryPane.id = 'patrol-pane';
            libraryPane.innerHTML = `
                <div id="patrolList" class="list-group p-3"></div>
                <div class="p-3">
                    <button class="btn btn-primary w-100" onclick="designer.addGame('patrol')">
                        <i class="fas fa-plus-circle"></i> Add Patrol Game
                    </button>
                </div>`;
        }

        // Insert "Troop Events" Tab
        if(!document.getElementById('troop-tab')) {
            const patrolLi = document.getElementById('patrol-tab')?.parentElement;
            if(patrolLi) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.innerHTML = `<button class="nav-link" id="troop-tab" data-bs-toggle="tab" data-bs-target="#troop-pane" type="button">Troop Events</button>`;
                navTabs.insertBefore(li, patrolLi.nextSibling);
            }

            const patrolPane = document.getElementById('patrol-pane');
            if(patrolPane) {
                const div = document.createElement('div');
                div.className = 'tab-pane fade';
                div.id = 'troop-pane';
                div.innerHTML = `
                    <div id="troopList" class="list-group p-3"></div>
                    <div class="p-3">
                        <button class="btn btn-success w-100" onclick="designer.addGame('troop')">
                            <i class="fas fa-calendar-plus"></i> Add Troop Event
                        </button>
                    </div>`;
                tabContent.insertBefore(div, patrolPane.nextSibling);
            }
        }

        // Insert "Presets" Tab
        if(!document.getElementById('presets-tab')) {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.innerHTML = `<button class="nav-link" id="presets-tab" data-bs-toggle="tab" data-bs-target="#presets-pane" type="button">Presets</button>`;
            navTabs.appendChild(li);

            const pane = document.createElement('div');
            pane.className = 'tab-pane fade';
            pane.id = 'presets-pane';
            pane.innerHTML = `<div id="presets-container" class="p-3"></div>`;
            tabContent.appendChild(pane);

            document.getElementById('presets-tab').addEventListener('shown.bs.tab', () => this.renderPresetManager());
        }
    },

    injectModals: function() {
        const modals = [
            // Preset Picker
            `<div class="modal fade" id="presetModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">Insert Preset Field</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body">
                            <div class="mb-3"><label class="form-label">Choose Field</label><select class="form-select" id="presetSelect"></select></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" onclick="designer.confirmInsertPreset()">Insert</button>
                        </div>
                    </div>
                </div>
            </div>`,
            // Zip Import Picker
            `<div class="modal fade" id="importModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">Import Games from Zip</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body">
                            <p>Select games to import:</p>
                            <div class="list-group" id="importList"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-success" onclick="designer.confirmGameImport()">Import Selected</button>
                        </div>
                    </div>
                </div>
            </div>`,
            // Server Load Picker
            `<div class="modal fade" id="serverLoadModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">Load from Server</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body">
                            <div class="list-group" id="serverLoadList"></div>
                        </div>
                    </div>
                </div>
            </div>`,
            // Overwrite Warning
            `<div class="modal fade" id="overwriteModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content border-danger">
                        <div class="modal-header bg-danger text-white"><h5 class="modal-title">Overwrite Warning</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body">
                            <p>A camporee with this ID already exists on the server. Do you want to overwrite it?</p>
                            <div class="row text-center mb-3">
                                <div class="col-6 border-end">
                                    <h6 class="text-danger">Server Version</h6>
                                    <div id="overwriteServerTitle" class="fw-bold"></div>
                                    <div id="overwriteServerTheme" class="small text-muted"></div>
                                </div>
                                <div class="col-6">
                                    <h6 class="text-success">Your Version</h6>
                                    <div id="overwriteClientTitle" class="fw-bold"></div>
                                    <div id="overwriteClientTheme" class="small text-muted"></div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-danger" onclick="designer.executeSave()">Yes, Overwrite</button>
                        </div>
                    </div>
                </div>
            </div>`
        ];

        modals.forEach(html => {
            // Simple check to avoid duplicates if init runs twice
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const id = tempDiv.firstElementChild.id;
            if (!document.getElementById(id)) {
                document.body.insertAdjacentHTML('beforeend', html);
            }
        });
    },

    // 5. STANDARD LOGIC (Sort, Move)

    normalizeGameSortOrders: function() {
        const groups = { patrol: [], troop: [], exhibition: [] };

        this.data.games.forEach(g => {
            const type = g.type || 'patrol';
            if(!groups[type]) groups[type] = [];
            groups[type].push(g);
        });

        Object.values(groups).forEach(list => {
            list.sort((a, b) => {
                const oa = (a.sortOrder !== undefined) ? a.sortOrder : Infinity;
                const ob = (b.sortOrder !== undefined) ? b.sortOrder : Infinity;
                return oa - ob;
            });

            // Re-assign clean IDs (10, 20, 30...)
            list.forEach((g, i) => {
                g.sortOrder = (i + 1) * 10;
            });
        });
    },

    moveGame: function(srcId, targetId) {
        if(srcId === targetId) return;

        const srcGame = this.data.games.find(g => g.id === srcId);
        const targetGame = this.data.games.find(g => g.id === targetId);

        if(!srcGame || !targetGame) return;
        if(srcGame.type !== targetGame.type) return;

        const type = srcGame.type || 'patrol';
        const list = this.data.games.filter(g => (g.type || 'patrol') === type);

        list.sort((a, b) => a.sortOrder - b.sortOrder);

        const fromIndex = list.findIndex(g => g.id === srcId);
        const toIndex = list.findIndex(g => g.id === targetId);

        list.splice(fromIndex, 1);
        list.splice(toIndex, 0, srcGame);

        list.forEach((g, i) => {
            g.sortOrder = (i + 1) * 10;
        });

        this.renderGameLists();
    },

    newCamporee: function() {
        if(confirm("Start new Camporee? Unsaved changes will be lost.")) {
            this.data.games = [];
            this.data.meta = {
                camporeeId: this.generateUUID(),
                title: "New Camporee",
                theme: "",
                year: new Date().getFullYear()
            };
            this.activeGameId = null;
            this.updateMetaUI();
            this.renderGameLists();
            document.getElementById('editor-container').innerHTML = '<p class="text-muted">Select a game to edit.</p>';
        }
    },

    addGame: function(type = 'patrol') {
        const newId = `game_${Date.now()}`;
        const newGame = {
            id: newId,
            type: type,
            enabled: true,
            content: {
                title: type === 'patrol' ? "New Game" : "New Event",
                story: "",
                instructions: ""
            },
            scoring: {
                method: "points_desc",
                components: [{ id: "score_1", type: "number", kind: "points", label: "Points", weight: 1, audience: "judge", sortOrder: 0 }]
            }
        };
        this.data.games.push(newGame);
        this.normalizeGameSortOrders();
        this.renderGameLists();
        this.editGame(newId);
    },

    duplicateGame: function(gameId) {
        const original = this.data.games.find(g => g.id === gameId);
        if(!original) return;

        const clone = JSON.parse(JSON.stringify(original));
        clone.id = `game_${Date.now()}`;
        clone.content.title += " (Copy)";

        if(clone.scoring.components) {
            clone.scoring.components.forEach(c => {
                c.id = `${c.kind}_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
            });
        }

        this.data.games.push(clone);
        this.normalizeGameSortOrders();
        this.renderGameLists();
        this.editGame(clone.id);
    },

    deleteGame: function(gameId) {
        if(confirm("Are you sure you want to delete this game?")) {
            this.data.games = this.data.games.filter(g => g.id !== gameId);
            if (this.activeGameId === gameId) {
                this.activeGameId = null;
                document.getElementById('editor-container').innerHTML = '<p class="text-muted">Select a game to edit.</p>';
            }
            this.renderGameLists();
        }
    },

    updateMetaUI: function() {
        const titleEl = document.getElementById('metaTitle');
        const themeEl = document.getElementById('metaTheme');
        if(titleEl) titleEl.value = this.data.meta.title || "";
        if(themeEl) themeEl.value = this.data.meta.theme || "";
    },

    // 6. RENDERERS

    renderGameLists: function() {
        const patrolList = document.getElementById('patrolList');
        const troopList = document.getElementById('troopList');

        if(!patrolList || !troopList) return;

        patrolList.innerHTML = '';
        troopList.innerHTML = '';

        if (this.data.games.length === 0) {
            patrolList.innerHTML = '<div class="text-center text-muted">No patrol games.</div>';
            troopList.innerHTML = '<div class="text-center text-muted">No troop events.</div>';
            return;
        }

        this.data.games.sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0));

        this.data.games.forEach(game => {
            const isActive = game.id === this.activeGameId ? 'active' : '';
            const statusClass = game.enabled ? 'text-success' : 'text-secondary';
            const isPatrol = (!game.type || game.type === 'patrol');
            const targetList = isPatrol ? patrolList : troopList;

            const item = document.createElement('div');
            item.className = `list-group-item list-group-item-action d-flex align-items-center ${isActive}`;
            item.draggable = true;

            // Drag Events
            item.ondragstart = (e) => {
                this.dragSrcGameId = game.id;
                e.dataTransfer.effectAllowed = 'move';
                item.classList.add('opacity-50');
            };
            item.ondragend = (e) => {
                item.classList.remove('opacity-50');
                this.dragSrcGameId = null;
            };
            item.ondragover = (e) => { e.preventDefault(); };
            item.ondrop = (e) => {
                e.preventDefault();
                if(this.dragSrcGameId) this.moveGame(this.dragSrcGameId, game.id);
            };

            item.onclick = (e) => {
                e.preventDefault();
                this.editGame(game.id);
            };

            item.innerHTML = `
                <div class="me-3 text-muted" style="cursor: grab;">
                    <i class="fas fa-grip-vertical"></i>
                </div>
                <div class="flex-grow-1 text-truncate">
                    <strong>${game.content.title}</strong><br>
                    <small class="text-muted">${game.id}</small>
                </div>
                <div class="d-flex align-items-center gap-1">
                    <i class="fas fa-circle ${statusClass} me-2" style="font-size: 0.5rem;"></i>
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="event.stopPropagation(); designer.exportSingleGame('${game.id}')">
                        <i class="fas fa-file-download"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary border-0" onclick="event.stopPropagation(); designer.duplicateGame('${game.id}')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-primary border-0" onclick="event.stopPropagation(); designer.renderPreview('${game.id}')" title="Preview Form">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger border-0" onclick="event.stopPropagation(); designer.deleteGame('${game.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>`;
            targetList.appendChild(item);
        });
    },

    editGame: function(gameId) {
        this.activeGameId = gameId;
        const game = this.data.games.find(g => g.id === gameId);
        if (!game) return;
        if(!game.type) game.type = 'patrol';

        const tabTriggerEl = document.querySelector('#editor-tab');
        if (tabTriggerEl && window.bootstrap) { new bootstrap.Tab(tabTriggerEl).show(); }

        const container = document.getElementById('editor-container');
        container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header bg-light"><h5 class="mb-0">Game Metadata</h5></div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-8 mb-3">
                            <label class="form-label">Title</label>
                            <input type="text" class="form-control" id="gameTitle">
                        </div>
                        <div class="col-md-4 mb-3">
                            <label class="form-label">ID</label>
                            <input type="text" class="form-control" id="gameId" readonly>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-4 mb-3">
                            <label class="form-label">Type</label>
                            <select class="form-select" id="gameType">
                                <option value="patrol">Patrol Competition</option>
                                <option value="troop">Troop Competition</option>
                                <option value="exhibition">Exhibition / Individual</option>
                            </select>
                        </div>
                        <div class="col-md-8 mb-3">
                            <label class="form-label">Premise</label>
                            <input type="text" class="form-control" id="gameStory">
                        </div>
                    </div>
                     <div class="mb-3">
                        <label class="form-label">Instructions</label>
                        <textarea class="form-control" rows="2" id="gameInstructions"></textarea>
                    </div>
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="gameEnabled" ${game.enabled ? 'checked' : ''}>
                        <label class="form-check-label">Enabled</label>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header bg-light d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">Scoring Fields</h5>
                    <div class="d-flex align-items-center gap-2">
                        <small class="text-muted">Win Condition:</small>
                        <select class="form-select form-select-sm d-inline-block w-auto" id="gameScoringMethod">
                            <option value="points_desc">Highest Points</option>
                            <option value="timed_asc">Lowest Time</option>
                        </select>
                        <button class="btn btn-sm btn-outline-secondary" onclick="designer.renderPreview('${gameId}')" title="Preview Form">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body bg-light">
                    <div id="scoring-editor" class="d-flex flex-column gap-3"></div>

                    <div class="mt-4 text-center">
                         <div class="btn-group shadow-sm">
                            <button class="btn btn-primary" onclick="designer.addGenericField('${gameId}', 'game')">
                                <i class="fas fa-plus-circle"></i> Add Field
                            </button>
                            <button class="btn btn-outline-primary" onclick="designer.openPresetModal('${gameId}')">
                                <i class="fas fa-magic"></i> Add Preset
                            </button>
                         </div>
                    </div>
                </div>
            </div>`;

        ['gameTitle','gameId','gameStory','gameInstructions'].forEach(fid => {
             const prop = fid === 'gameId' ? 'id' : (fid === 'gameTitle' ? 'title' : (fid==='gameStory'?'story':'instructions'));
             const el = document.getElementById(fid);
             if(el) {
                 el.value = (prop === 'id' ? game.id : game.content[prop]) || '';
                 el.oninput = (e) => this.updateGameField(prop, e.target.value);
             }
        });

        const typeSelect = document.getElementById('gameType');
        typeSelect.value = game.type;
        typeSelect.onchange = (e) => {
            game.type = e.target.value;
            this.normalizeGameSortOrders();
            this.renderGameLists();
        };

        const methodSelect = document.getElementById('gameScoringMethod');
        methodSelect.value = game.scoring.method || 'points_desc';
        methodSelect.onchange = (e) => { game.scoring.method = e.target.value; };

        document.getElementById('gameEnabled').onchange = (e) => {
            game.enabled = e.target.checked;
            this.renderGameLists();
        };

        this.renderScoringInputs(game.scoring.components, game.id, 'game');
    },

    updateGameField: function(field, value) {
        if (!this.activeGameId) return;
        const game = this.data.games.find(g => g.id === this.activeGameId);
        if (!game) return;
        if (field === 'id') { game.id = value; this.activeGameId = value; }
        else { game.content[field] = value; }
        if (field === 'title' || field === 'id') this.renderGameLists();
    },

    // 7. PRESET EDITOR

    renderPresetManager: function() {
        const container = document.getElementById('presets-container');
        if(!container) return;

        container.innerHTML = `
            <div class="card">
                <div class="card-header bg-light">
                    <h5 class="mb-0">Preset Library</h5>
                </div>
                <div class="card-body bg-light">
                    <div id="preset-editor-list" class="d-flex flex-column gap-3"></div>
                    <div class="mt-4 text-center">
                        <button class="btn btn-primary" onclick="designer.addGenericField('global', 'preset_manager')">
                            <i class="fas fa-plus-circle"></i> Add Field
                        </button>
                    </div>
                </div>
            </div>`;

        this.renderScoringInputs(this.presets, 'global', 'preset_manager');
    },

    // 8. SCORING FIELD RENDERER (Expanded)

    renderScoringInputs: function(components, contextId, contextType = 'game') {
        const containerId = contextType === 'preset_manager' ? 'preset-editor-list' : 'scoring-editor';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        if (!components || components.length === 0) {
            container.innerHTML = '<div class="alert alert-white text-center border">No fields defined. Add one below.</div>';
            return;
        }

        components.forEach((comp, index) => {
            let borderClass = 'border-success';
            if (comp.kind === 'penalty') borderClass = 'border-danger';
            else if (comp.kind === 'info') borderClass = 'border-secondary';
            else if (comp.audience === 'admin') borderClass = 'border-info';

            const row = document.createElement('div');
            row.className = `card border-start border-4 shadow-sm ${borderClass}`;
            row.draggable = true;
            row.dataset.index = index;

            // HTML Generation (Verbose for readability)
            row.innerHTML = `
              <div class="card-body p-3 d-flex align-items-start">
                <div class="me-3 mt-4 text-muted" style="cursor: grab;">
                    <i class="fas fa-grip-vertical fa-lg"></i>
                </div>

                <div class="flex-grow-1 me-4">
                  <label class="form-label small text-muted fw-bold mb-1">Field Name (Label)</label>
                  <input type="text" class="form-control form-control-sm fw-bold mb-2" value="${comp.label || ''}"
                        oninput="designer.updateComponent('${contextId}', ${index}, 'label', this.value, '${contextType}')">

                  <label class="form-label small text-muted fw-bold mb-1">Description (for Judge)</label>
                  <input type="text" class="form-control form-control-sm text-muted" value="${comp.config?.placeholder || ''}"
                        oninput="designer.updateConfig('${contextId}', ${index}, 'placeholder', this.value, '${contextType}')">
                </div>

                <div class="d-flex flex-column gap-2 me-4" style="width: 340px;">
                  <div class="row g-2">
                    <div class="col-6">
                        <label class="form-label small text-muted fw-bold mb-1">Input Type</label>
                        <select class="form-select form-select-sm" onchange="designer.updateComponent('${contextId}', ${index}, 'type', this.value, '${contextType}')">
                            ${['number','stopwatch','text','textarea','checkbox'].map(t => `<option value="${t}" ${comp.type===t?'selected':''}>${t}</option>`).join('')}
                        </select>
                    </div>
                    <div class="col-6">
                        <label class="form-label small text-muted fw-bold mb-1">Scoring Purpose</label>
                        <select class="form-select form-select-sm" onchange="designer.handleKindChange('${contextId}', ${index}, this.value, '${contextType}')">
                            ${['points','penalty','metric','info'].map(k => `<option value="${k}" ${comp.kind===k?'selected':''}>${k}</option>`).join('')}
                        </select>
                    </div>
                  </div>

                  <div>
                      <label class="form-label small text-muted fw-bold mb-1">Limits & Weight</label>
                      <div class="input-group input-group-sm">
                        <span class="input-group-text text-muted">Min</span>
                        <input type="number" class="form-control" value="${comp.config?.min || ''}"
                            onchange="designer.updateConfig('${contextId}', ${index}, 'min', this.value, '${contextType}')">

                        <span class="input-group-text text-muted">Max</span>
                        <input type="number" class="form-control" value="${comp.config?.max || ''}"
                            onchange="designer.updateConfig('${contextId}', ${index}, 'max', this.value, '${contextType}')">

                        <span class="input-group-text fw-bold">Wgt</span>
                        <input type="number" class="form-control fw-bold" value="${comp.weight !== undefined ? comp.weight : 0}"
                            onchange="designer.updateComponent('${contextId}', ${index}, 'weight', parseFloat(this.value), '${contextType}')">
                      </div>
                  </div>
                </div>

                <div class="d-flex flex-column align-items-end gap-3 mt-4" style="min-width: 110px;">
                  <div class="form-check form-switch text-end">
                    <input class="form-check-input float-end ms-2" type="checkbox" id="visSwitch${index}" ${comp.audience === 'admin' ? 'checked' : ''}
                        onchange="designer.updateComponent('${contextId}', ${index}, 'audience', this.checked ? 'admin' : 'judge', '${contextType}')">
                    <label class="form-check-label small fw-bold text-muted d-block me-4">Official Only</label>
                  </div>

                  <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" onclick="designer.duplicateComponent('${contextId}', ${index}, '${contextType}')">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="designer.removeComponent('${contextId}', ${index}, '${contextType}')">
                        <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>`;

            // Drag Events
            row.addEventListener('dragstart', (e) => {
                this.dragSrcGameId = index; // Re-using variable name, context specific here
                e.dataTransfer.effectAllowed = 'move';
                row.classList.add('opacity-50');
            });

            row.addEventListener('dragend', (e) => {
                row.classList.remove('opacity-50');
                this.dragSrcGameId = null;
            });

            row.addEventListener('dragover', (e) => { e.preventDefault(); });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                if(this.dragSrcGameId !== null) {
                    this.moveComponent(contextId, this.dragSrcGameId, index, contextType);
                }
            });

            container.appendChild(row);
        });
    },

    // 9. DATA HELPERS (Expanded)

    getContainer: function(id, type) {
        if(type === 'game') {
            return this.data.games.find(g => g.id === id)?.scoring;
        } else {
            return { components: this.presets };
        }
    },

    updateComponent: function(id, index, field, value, type = 'game') {
        const container = this.getContainer(id, type);
        if(container) {
            container.components[index][field] = value;
        }
    },

    updateConfig: function(id, index, field, value, type = 'game') {
        const container = this.getContainer(id, type);
        if(container) {
            if(!container.components[index].config) {
                container.components[index].config = {};
            }
            container.components[index].config[field] = value;
        }
    },

    handleKindChange: function(id, index, newKind, type = 'game') {
        const container = this.getContainer(id, type);
        if(!container) return;

        const comp = container.components[index];
        comp.kind = newKind;

        // Auto-set standard weights
        if (newKind === 'points') comp.weight = 1;
        else if (newKind === 'penalty') comp.weight = -1;
        else comp.weight = 0;

        this.renderScoringInputs(container.components, id, type);
    },

    addGenericField: function(id, type = 'game') {
        const container = this.getContainer(id, type);
        if(!container) return;

        if(!container.components) container.components = [];

        container.components.push({
            id: `field_${Date.now()}`,
            type: 'number',
            kind: 'points',
            label: 'Points',
            weight: 1,
            audience: 'judge',
            config: {}
        });

        this.renderScoringInputs(container.components, id, type);
    },

    removeComponent: function(id, index, type = 'game') {
        const container = this.getContainer(id, type);
        if(container) {
            container.components.splice(index, 1);
            this.renderScoringInputs(container.components, id, type);
        }
    },

    duplicateComponent: function(id, index, type = 'game') {
        const container = this.getContainer(id, type);
        if(container) {
            const copy = JSON.parse(JSON.stringify(container.components[index]));
            copy.id = `copy_${Date.now()}`;
            copy.label += " (Copy)";

            container.components.splice(index + 1, 0, copy);
            this.renderScoringInputs(container.components, id, type);
        }
    },

    moveComponent: function(id, from, to, type = 'game') {
        const container = this.getContainer(id, type);
        if(container) {
            const [moved] = container.components.splice(from, 1);
            container.components.splice(to, 0, moved);
            this.renderScoringInputs(container.components, id, type);
        }
    },

    openPresetModal: function(gameId) {
        this.activeGameId = gameId;
        const select = document.getElementById('presetSelect');
        select.innerHTML = this.presets.map(p => `<option value="${p.id}">${p.label}</option>`).join('');
        new bootstrap.Modal(document.getElementById('presetModal')).show();
    },

    confirmInsertPreset: function() {
        const preset = this.presets.find(p => p.id === document.getElementById('presetSelect').value);
        if(preset && this.activeGameId) {
            const game = this.data.games.find(g => g.id === this.activeGameId);
            const copy = JSON.parse(JSON.stringify(preset));
            copy.id = `preset_${Date.now()}`;

            if(!game.scoring.components) game.scoring.components = [];
            game.scoring.components.push(copy);

            this.renderScoringInputs(game.scoring.components, game.id, 'game');
        }
        bootstrap.Modal.getInstance(document.getElementById('presetModal')).hide();
    },

    // 9.5 PREVIEW
    renderPreview: function(gameId) {
        const game = this.data.games.find(g => g.id === gameId);
        if (!game) return;

        // Normalize using schema.js
        const normalized = normalizeGameDefinition(game);

        // Generate HTML
        const html = normalized.fields.map(f => generateFieldHTML(f)).join('');

        // Inject into modal
        const modalBody = document.getElementById('previewModalBody');
        const modalTitle = document.getElementById('previewModalTitle');
        if (modalBody) modalBody.innerHTML = html;
        if (modalTitle) modalTitle.innerText = "Preview: " + (game.content.title || "Game");

        // Show Modal
        if (window.bootstrap) {
            new bootstrap.Modal(document.getElementById('previewModal')).show();
        }
    },

    // 10. EXPORT LOGIC
    exportCamporee: function() {
        this.normalizeGameSortOrders();
        const zip = new JSZip();

        // Use current sort order for the playlist
        const sortedGames = [...this.data.games].sort((a,b) => (a.sortOrder||0) - (b.sortOrder||0));

        const playlist = sortedGames.map((g, i) => ({
            gameId: g.id,
            enabled: g.enabled,
            order: i + 1
        }));

        const camporeeJson = {
            schemaVersion: "2.9",
            meta: this.data.meta,
            playlist: playlist
        };

        zip.file("camporee.json", JSON.stringify(camporeeJson, null, 2));
        zip.file("presets.json", JSON.stringify(this.presets, null, 2));

        const gamesFolder = zip.folder("games");
        this.data.games.forEach(game => {
            const gameFile = {
                id: game.id,
                type: game.type,
                sortOrder: game.sortOrder,
                schemaVersion: "2.9",
                content: game.content,
                scoring: game.scoring
            };
            gamesFolder.file(`${game.id}.json`, JSON.stringify(gameFile, null, 2));
        });

        zip.generateAsync({type:"blob"}).then(function(content) {
            saveAs(content, "CamporeeConfig.zip");
        });
    },

    handleCamporeeImport: function(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            JSZip.loadAsync(e.target.result).then(async (zip) => {
                const metaFile = await zip.file("camporee.json").async("string");
                const metaObj = JSON.parse(metaFile);

                this.data.meta = metaObj.meta;

                if(zip.file("presets.json")) {
                    this.presets = JSON.parse(await zip.file("presets.json").async("string"));
                }

                this.data.games = [];
                const promises = [];

                zip.folder("games").forEach((p, f) => {
                    promises.push(f.async("string").then(c => JSON.parse(c)));
                });

                const loaded = await Promise.all(promises);

                loaded.forEach(g => {
                    const pItem = metaObj.playlist.find(p => p.gameId === g.id);
                    g.enabled = pItem ? pItem.enabled : false;

                    if(pItem && pItem.order) g.sortOrder = pItem.order * 10;
                    if(!g.scoring.components) g.scoring.components = [];
                    if(!g.type) g.type = 'patrol';

                    this.data.games.push(g);
                });

                if(!this.data.meta.camporeeId) this.data.meta.camporeeId = this.generateUUID();

                this.normalizeGameSortOrders();
                this.updateMetaUI();
                this.renderGameLists();
                this.activeGameId = null;

                document.getElementById('editor-container').innerHTML = '<p class="text-muted">Select a game to edit.</p>';
                alert("Camporee Loaded Successfully!");
            });
        };
        reader.readAsArrayBuffer(file);
    },

    exportSingleGame: function(gameId) {
        const game = this.data.games.find(g => g.id === gameId);
        if(game) {
            const blob = new Blob([JSON.stringify(game, null, 2)], {type: "application/json;charset=utf-8"});
            saveAs(blob, `${game.id}.json`);
        }
    },

    handleGameImport: function(event) {
        const file = event.target.files[0];
        if(!file) return;

        const reader = new FileReader();

        if(file.name.endsWith('.json')) {
            reader.onload = (e) => {
                try {
                    const game = JSON.parse(e.target.result);
                    game.id = `import_${Date.now()}`;
                    game.content.title += " (Imported)";

                    this.data.games.push(game);
                    this.normalizeGameSortOrders();
                    this.renderGameLists();
                    this.editGame(game.id);
                    alert("Game Imported!");
                } catch(err) {
                    alert("Invalid JSON");
                }
            };
            reader.readAsText(file);
        }
        else if (file.name.endsWith('.zip')) {
            reader.onload = (e) => {
                JSZip.loadAsync(e.target.result).then(async (zip) => {
                    this.pendingImportGames = [];
                    const promises = [];

                    zip.folder("games").forEach((p, f) => {
                        promises.push(f.async("string").then(txt => {
                            try { return JSON.parse(txt); } catch(e){return null;}
                        }));
                    });

                    const games = await Promise.all(promises);
                    this.pendingImportGames = games.filter(g => g !== null);

                    this.showImportModal();
                });
            };
            reader.readAsArrayBuffer(file);
        }
    },

    showImportModal: function() {
        const list = document.getElementById('importList');
        list.innerHTML = this.pendingImportGames.map((g, i) => `
            <label class="list-group-item d-flex gap-2">
                <input class="form-check-input flex-shrink-0" type="checkbox" value="${i}" checked>
                <span>
                    <strong>${g.content?.title || g.id}</strong><br>
                    <small class="text-muted">${g.type || 'patrol'}</small>
                </span>
            </label>`).join('');

        new bootstrap.Modal(document.getElementById('importModal')).show();
    },

    confirmGameImport: function() {
        document.querySelectorAll('#importList input:checked').forEach(chk => {
            const game = JSON.parse(JSON.stringify(this.pendingImportGames[parseInt(chk.value)]));
            game.id = `import_${Date.now()}_${chk.value}`;
            this.data.games.push(game);
        });

        this.normalizeGameSortOrders();
        this.renderGameLists();
        bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
    }
};

window.designer = designer;
window.onload = function() { designer.init(); };