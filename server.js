import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import multer from 'multer';
import AdmZip from 'adm-zip';

// --- CONFIGURATION & PATHS ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;

// Directory Structure
const DATA_DIR = path.join(__dirname, 'data');
const ACTIVE_DIR = path.join(__dirname, 'camporee', 'active');
const ARCHIVE_DIR = path.join(__dirname, 'data', 'archive');
const UPLOAD_TEMP = path.join(__dirname, 'temp_uploads');

// Ensure all directories exist
[DATA_DIR, ACTIVE_DIR, ARCHIVE_DIR, UPLOAD_TEMP].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Setup Upload handling
const upload = multer({ dest: UPLOAD_TEMP });

// --- DATABASE SETUP (Preserved) ---
const db = new Database(path.join(DATA_DIR, 'camporee.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('patrol', 'troop')) NOT NULL,
    troop_number TEXT NOT NULL,
    parent_id TEXT,
    manual_rank TEXT
  );
  CREATE TABLE IF NOT EXISTS judges (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    unit TEXT
  );
  CREATE TABLE IF NOT EXISTS scores (
    uuid TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    score_payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    judge_id INTEGER,
    FOREIGN KEY(entity_id) REFERENCES entities(id),
    FOREIGN KEY(judge_id) REFERENCES judges(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_game_entity ON scores (game_id, entity_id);
  CREATE TABLE IF NOT EXISTS game_status (
    game_id TEXT PRIMARY KEY,
    status TEXT
  );
`);

// Migrations
try { db.exec("ALTER TABLE entities ADD COLUMN parent_id TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE entities ADD COLUMN manual_rank TEXT"); } catch (e) {}

// --- HELPER FUNCTIONS (New Logic) ---

function getActiveMeta() {
    const metaPath = path.join(ACTIVE_DIR, 'camporee.json');
    if (!fs.existsSync(metaPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(metaPath, 'utf8')).meta;
    } catch (e) { return null; }
}

function archiveDatabase() {
    // Only archive if we actually have a database file
    const dbFile = path.join(DATA_DIR, 'camporee.db');
    if (fs.existsSync(dbFile)) {
        // We close the DB connection briefly to rename the file (safe on SQLite)
        // actually better-sqlite3 holds a lock. Ideally we'd copy it, or trust the file system.
        // For simple deployment, copying is safer while running.
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `camporee_backup_${timestamp}.db`;
        fs.copyFileSync(dbFile, path.join(ARCHIVE_DIR, backupName));

        // Nuke the tables to "reset" (cleaner than deleting the file while open)
        db.exec("DELETE FROM scores; DELETE FROM judges; DELETE FROM game_status;");
        console.log(`[System] Archived DB to ${backupName} and cleared active tables.`);
    }
}

function installCartridge(zipPath) {
    // 1. Wipe Active Directory
    fs.rmSync(ACTIVE_DIR, { recursive: true, force: true });
    fs.mkdirSync(ACTIVE_DIR, { recursive: true });

    // 2. Extract New Cartridge
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(ACTIVE_DIR, true);

    // 3. Cleanup Zip
    fs.unlinkSync(zipPath);
    console.log("[System] New Camporee Cartridge Installed.");
}

function loadCamporeeData() {
    const manifestPath = path.join(ACTIVE_DIR, 'camporee.json');
    // Return empty if not found (or let the middleware handle it)
    if (!fs.existsSync(manifestPath)) return { metadata: {}, games: [] };

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const games = [];

        if (manifest.playlist) {
            manifest.playlist.forEach(item => {
                if (item.enabled) {
                    const gamePath = path.join(ACTIVE_DIR, 'games', `${item.gameId}.json`);
                    if (fs.existsSync(gamePath)) {
                        const gameDef = JSON.parse(fs.readFileSync(gamePath, 'utf8'));

                        // --- THE TRANSLATION LAYER ---
                        // Map Designer Schema (scoring.components) -> Collator Schema (fields)
                        if (gameDef.scoring && gameDef.scoring.components) {
                            gameDef.fields = gameDef.scoring.components.map(comp => ({
                                id: comp.id,
                                label: comp.label,
                                type: comp.type === 'stopwatch' ? 'timed' : comp.type,
                                kind: comp.kind,
                                weight: comp.weight,
                                audience: comp.audience,
                                ...comp.config // Spread min/max/placeholder into root
                            }));
                        } else if (!gameDef.fields) {
                            gameDef.fields = [];
                        }

                        // Inject runtime sort order from playlist
                        gameDef.sortOrder = item.order * 10;

                        // Ensure legacy 'name' property exists (Designer uses content.title)
                        if (!gameDef.name && gameDef.content && gameDef.content.title) {
                            gameDef.name = gameDef.content.title;
                        }

                        games.push(gameDef);
                    }
                }
            });
        }

        // Sort by playlist order
        games.sort((a, b) => a.sortOrder - b.sortOrder);

        return {
            metadata: manifest.meta,
            games: games,
            common_scoring: [] // Can be populated from presets.json if needed later
        };

    } catch (err) {
        console.error("Error hydrating camporee data:", err);
        return { metadata: {}, games: [] };
    }
}

function getNextEntityId(type) {
    if (type === 'patrol') {
        const row = db.prepare("SELECT id FROM entities WHERE type='patrol' AND id LIKE 'p%' ORDER BY id DESC LIMIT 1").get();
        let nextNum = 4300;
        if (row && row.id) {
            const currentNum = parseInt(row.id.substring(1));
            if (!isNaN(currentNum)) nextNum = currentNum + 1;
        }
        return `p${nextNum}`;
    } else {
        const row = db.prepare("SELECT id FROM entities WHERE type='troop' AND id LIKE 't%' ORDER BY id DESC LIMIT 1").get();
        let nextNum = 1000;
        if (row && row.id) {
            const currentNum = parseInt(row.id.substring(1));
            if (!isNaN(currentNum)) nextNum = currentNum + 1;
        }
        return `t${nextNum}`;
    }
}

// --- MIDDLEWARE ---
app.use(express.json());
// Allow static files to be served (CSS/JS needed for setup page)
// Important: { index: false } prevents judge.html from hijacking the setup flow
app.use(express.static('public', { index: false }));

// Guard: Force setup if no camporee is loaded
const requireConfig = (req, res, next) => {
    const bypassRoutes = ['/setup', '/api/setup/upload', '/api/setup/confirm', '/setup/conflict'];

    // Allow static resources (css, js, images) and bypass routes
    if (bypassRoutes.includes(req.path) || req.path.startsWith('/css/') || req.path.startsWith('/js/') || req.path.startsWith('/img/')) {
        return next();
    }

    if (!getActiveMeta()) {
        return res.redirect('/setup');
    }
    next();
};
app.use(requireConfig);

// --- SETUP ROUTES (New) ---

app.get('/setup', (req, res) => {
    res.send(`
        <html>
            <head><title>Setup</title><link rel="stylesheet" href="/css/bootstrap.min.css"></head>
            <body class="bg-dark text-light d-flex align-items-center justify-content-center vh-100">
                <div class="card bg-secondary text-white p-5 text-center" style="max-width: 500px;">
                    <h1>Coyote Collator</h1>
                    <p class="lead">System Ready. Load Cartridge.</p>
                    <form action="/api/setup/upload" method="post" enctype="multipart/form-data">
                        <input class="form-control mb-3" type="file" name="configZip" accept=".zip" required>
                        <button type="submit" class="btn btn-primary w-100">Upload Configuration</button>
                    </form>
                </div>
            </body>
        </html>
    `);
});

app.post('/api/setup/upload', upload.single('configZip'), (req, res) => {
    if (!req.file) return res.redirect('/setup');
    const zipPath = req.file.path;
    const zip = new AdmZip(zipPath);

    let newMeta = null;
    try {
        const metaEntry = zip.getEntry("camporee.json");
        if (!metaEntry) throw new Error("Invalid Zip");
        newMeta = JSON.parse(metaEntry.getData().toString('utf8')).meta;
    } catch (e) {
        fs.unlinkSync(zipPath);
        return res.send("Error: Invalid Camporee Zip (Missing camporee.json)");
    }

    const currentMeta = getActiveMeta();
    const pendingPath = path.join(UPLOAD_TEMP, 'pending_update.zip');

    // Case 1: Brand New or UUID Mismatch -> Wipe & Install
    if (!currentMeta || newMeta.camporeeId !== currentMeta.camporeeId) {
        archiveDatabase();
        installCartridge(zipPath);
        return res.redirect('/admin.html');
    }

    // Case 2: Update Detected -> Ask User
    fs.renameSync(zipPath, pendingPath);
    res.redirect('/setup/conflict');
});

app.get('/setup/conflict', (req, res) => {
    const meta = getActiveMeta();
    res.send(`
        <html>
            <head><title>Update Detected</title><link rel="stylesheet" href="/css/bootstrap.min.css"></head>
            <body class="bg-dark text-light d-flex align-items-center justify-content-center vh-100">
                <div class="card bg-secondary text-white p-5 text-center">
                    <h2 class="text-warning">Update Detected</h2>
                    <p>Updating <strong>${meta.title}</strong>.</p>
                    <div class="d-grid gap-3">
                        <form action="/api/setup/confirm" method="post">
                            <input type="hidden" name="action" value="update_keep">
                            <button class="btn btn-success btn-lg w-100">Update Config (Keep Scores)</button>
                        </form>
                        <form action="/api/setup/confirm" method="post">
                            <input type="hidden" name="action" value="update_wipe">
                            <button class="btn btn-danger btn-lg w-100">Update & Reset Scores</button>
                        </form>
                        <a href="/admin.html" class="btn btn-outline-light">Cancel</a>
                    </div>
                </div>
            </body>
        </html>
    `);
});

app.post('/api/setup/confirm', express.urlencoded({ extended: true }), (req, res) => {
    const action = req.body.action;
    const pendingPath = path.join(UPLOAD_TEMP, 'pending_update.zip');
    if (!fs.existsSync(pendingPath)) return res.redirect('/setup');

    if (action === 'update_wipe') archiveDatabase();

    installCartridge(pendingPath);
    res.redirect('/admin.html');
});

// --- CORE ROUTES (Preserved Traffic Cop) ---

app.get('/', (req, res) => {
    const ua = req.headers['user-agent'] ? req.headers['user-agent'].toLowerCase() : '';
    const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|kindle|silk-accelerated|(hpw|web)os|opera m(obi|ini)/i.test(ua);
    if (isMobile) {
        console.log(`[Router] Mobile Device detected (${req.ip}). Sending to Judge View.`);
        res.redirect('/judge.html');
    } else {
        console.log(`[Router] Desktop Device detected (${req.ip}). Sending to Admin Dashboard.`);
        res.redirect('/admin.html');
    }
});

// --- API ROUTES ---

// 1. GET /games.json (REPLACED with Cartridge Loader)
app.get('/games.json', (req, res) => {
  const data = loadCamporeeData();
  res.json(data);
});

// 2. GET /api/entities (Preserved)
app.get('/api/entities', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM entities ORDER BY troop_number ASC, name ASC');
    const rows = stmt.all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching entities:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/entities/:id', (req, res) => {
    const { id } = req.params;
    const { manual_rank } = req.body;
    try {
        const stmt = db.prepare('UPDATE entities SET manual_rank = ? WHERE id = ?');
        stmt.run(manual_rank, id);
        res.json({ status: 'success' });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

// 3. POST /api/score (Preserved)
app.post('/api/score', (req, res) => {
  const { uuid, game_id, entity_id, score_payload, timestamp, judge_name, judge_email, judge_unit } = req.body;
  if (!uuid || !game_id || !entity_id || !score_payload) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const transaction = db.transaction(() => {
        let judgeId = null;
        if (judge_email) {
            const getJudge = db.prepare('SELECT id, name, unit FROM judges WHERE email = ?');
            const existingJudge = getJudge.get(judge_email);
            if (existingJudge) {
                judgeId = existingJudge.id;
                if ((judge_name && existingJudge.name !== judge_name) || (judge_unit && existingJudge.unit !== judge_unit)) {
                    db.prepare('UPDATE judges SET name = ?, unit = ? WHERE id = ?')
                      .run(judge_name || existingJudge.name, judge_unit || existingJudge.unit, judgeId);
                }
            } else if (judge_name) {
                const insertJudge = db.prepare('INSERT INTO judges (name, email, unit) VALUES (?, ?, ?)');
                const info = insertJudge.run(judge_name, judge_email, judge_unit || null);
                judgeId = info.lastInsertRowid;
            }
        }
        const insert = db.prepare(`
          INSERT INTO scores (uuid, game_id, entity_id, score_payload, timestamp, judge_id)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(game_id, entity_id) DO UPDATE SET
            score_payload = excluded.score_payload,
            timestamp = excluded.timestamp,
            judge_id = excluded.judge_id,
            uuid = excluded.uuid
        `);
        return insert.run(uuid, game_id, entity_id, JSON.stringify(score_payload), timestamp, judgeId);
    });
    const result = transaction();
    if (result.changes === 0) return res.status(200).json({ status: 'already_exists' });
    res.status(201).json({ status: 'success' });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 4. Admin & Export Routes (Preserved)
app.get('/api/admin/all-data', (req, res) => {
  try {
    const rows = db.prepare(`
        SELECT s.uuid, s.game_id, s.entity_id, s.timestamp, e.name as entity_name, e.troop_number, e.type as entity_type, s.score_payload
        FROM scores s JOIN entities e ON s.entity_id = e.id
    `).all();
    const parsed = rows.map(r => ({ ...r, score_payload: JSON.parse(r.score_payload) }));
    const stats = {};
    parsed.forEach(r => { stats[r.game_id] = (stats[r.game_id] || 0) + 1; });
    const statusMap = {};
    const statuses = db.prepare('SELECT * FROM game_status').all();
    for (const s of statuses) { statusMap[s.game_id] = s.status; }
    const meta = getActiveMeta();
    res.json({ scores: parsed, stats, game_status: statusMap, metadata: meta });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/judges', (req, res) => {
  try {
    const judges = db.prepare('SELECT * FROM judges').all();
    const scores = db.prepare('SELECT judge_id, game_id FROM scores WHERE judge_id IS NOT NULL').all();
    const stats = {};
    scores.forEach(s => {
        if (!stats[s.judge_id]) stats[s.judge_id] = { count: 0, games: new Set() };
        stats[s.judge_id].count++;
        stats[s.judge_id].games.add(s.game_id);
    });
    const result = judges.map(j => {
        const s = stats[j.id] || { count: 0, games: new Set() };
        return { ...j, score_count: s.count, games_judged: Array.from(s.games).sort() };
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/export', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT s.uuid, s.game_id, s.entity_id, s.timestamp, e.name as entity_name, e.troop_number, e.type as entity_type, s.score_payload
            FROM scores s JOIN entities e ON s.entity_id = e.id
            ORDER BY s.timestamp DESC
        `).all();
        if (rows.length === 0) return res.send("No scores to export.");

        const fieldSet = new Set();
        const parsedRows = rows.map(r => {
            const payload = JSON.parse(r.score_payload);
            Object.keys(payload).forEach(k => fieldSet.add(k));
            return { ...r, payload };
        });
        const dynamicFields = Array.from(fieldSet).sort();
        const headers = ['UUID', 'Game ID', 'Timestamp', 'Troop', 'Entity Name', 'Entity Type', ...dynamicFields];
        let csv = headers.join(',') + '\n';
        parsedRows.forEach(r => {
            const line = [
                r.uuid, r.game_id, new Date(r.timestamp).toISOString(), r.troop_number, `"${r.entity_name}"`, r.entity_type,
                ...dynamicFields.map(f => {
                    const val = r.payload[f];
                    return (val === undefined || val === null) ? '' : `"${String(val).replace(/"/g, '""')}"`;
                })
            ];
            csv += line.join(',') + '\n';
        });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=camporee_scores.csv');
        res.send(csv);
    } catch (err) { res.status(500).send('Error generating export'); }
});

app.post('/api/admin/game-status', (req, res) => {
    const { game_id, status } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO game_status (game_id, status) VALUES (?, ?) ON CONFLICT(game_id) DO UPDATE SET status=excluded.status');
        stmt.run(game_id, status);
        res.json({ success: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/scores', (req, res) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM scores').run();
            db.prepare('DELETE FROM judges').run();
            db.prepare('DELETE FROM game_status').run();
        })();
        res.json({ success: true, message: 'Scores, judges, and game statuses deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/full-reset', (req, res) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM scores').run();
            db.prepare('DELETE FROM entities').run();
            db.prepare('DELETE FROM judges').run();
            db.prepare('DELETE FROM game_status').run();
        })();
        res.json({ success: true, message: 'Everything deleted.' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/scores/:uuid', (req, res) => {
    const { uuid } = req.params;
    const { score_payload } = req.body;
    if (!score_payload) return res.status(400).json({ error: 'Missing score_payload' });
    try {
        const update = db.prepare('UPDATE scores SET score_payload = ? WHERE uuid = ?');
        const info = update.run(JSON.stringify(score_payload), uuid);
        if (info.changes === 0) return res.status(404).json({ error: 'Score not found' });
        res.json({ status: 'updated' });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/entities', (req, res) => {
  const { name, type, troop_number, parent_id } = req.body;
  if (!name || !type || !troop_number) return res.status(400).json({ error: 'Missing fields' });
  try {
    const id = getNextEntityId(type);
    const insert = db.prepare('INSERT INTO entities (id, name, type, troop_number, parent_id) VALUES (?, ?, ?, ?, ?)');
    insert.run(id, name, type, troop_number, parent_id || null);
    res.json({ id, name, type, troop_number, parent_id: parent_id || null });
  } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});