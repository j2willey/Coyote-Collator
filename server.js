import express from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Database Setup
const db = new Database(path.join(dataDir, 'camporee.db'));

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('patrol', 'troop')) NOT NULL,
    troop_number TEXT NOT NULL,
    parent_id INTEGER
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
    entity_id INTEGER NOT NULL,
    score_payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    judge_id INTEGER,
    FOREIGN KEY(entity_id) REFERENCES entities(id),
    FOREIGN KEY(judge_id) REFERENCES judges(id)
  );

  CREATE TABLE IF NOT EXISTS game_status (
    game_id TEXT PRIMARY KEY,
    status TEXT
  );
`);

// Migration for existing databases
try {
  db.exec("ALTER TABLE entities ADD COLUMN parent_id INTEGER");
} catch (e) { /* Column already exists */ }


app.use(express.json());
app.use(express.static('public'));

// --- API ROUTES ---

// 1. GET /games.json (Configuration)
app.get('/games.json', (req, res) => {
  try {
    const configDir = path.join(__dirname, 'config');
    const commonPath = path.join(configDir, 'common.json');
    const gamesDir = path.join(configDir, 'games');

    // Read common scoring
    let commonScoring = [];
    if (fs.existsSync(commonPath)) {
        commonScoring = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));
    }

    // Read games
    const games = [];
    if (fs.existsSync(gamesDir)) {
      const files = fs.readdirSync(gamesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(gamesDir, file), 'utf-8');
          games.push(JSON.parse(content));
        }
      }
    }

    // Sort games by "Game N" number, placing Exhibition last
    games.sort((a, b) => {
        const getNum = (str) => {
            const match = str.match(/(?:Game|[pte])\s*(\d+)/i);
            return match ? parseInt(match[1], 10) : Infinity;
        };

        const numA = getNum(a.name) !== Infinity ? getNum(a.name) : getNum(a.id);
        const numB = getNum(b.name) !== Infinity ? getNum(b.name) : getNum(b.id);

        if (numA !== numB) return numA - numB;
        return a.name.localeCompare(b.name);
    });

    res.json({
      metadata: { version: "1.0", generated_at: new Date().toISOString() },
      common_scoring: commonScoring,
      games: games
    });
  } catch (err) {
    console.error('Error serving games.json:', err);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// 2. GET /api/entities (THE MISSING ROUTE!)
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

// 3. POST /api/score (Submit Score)
app.post('/api/score', (req, res) => {
  const { uuid, game_id, entity_id, score_payload, timestamp, judge_name, judge_email, judge_unit } = req.body;

  if (!uuid || !game_id || !entity_id || !score_payload) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const transaction = db.transaction(() => {
        let judgeId = null;

        if (judge_email) {
            const getJudge = db.prepare('SELECT id FROM judges WHERE email = ?');
            const existingJudge = getJudge.get(judge_email);

            if (existingJudge) {
                judgeId = existingJudge.id;
            } else if (judge_name) {
                const insertJudge = db.prepare('INSERT INTO judges (name, email, unit) VALUES (?, ?, ?)');
                const info = insertJudge.run(judge_name, judge_email, judge_unit || null);
                judgeId = info.lastInsertRowid;
            }
        }

        const insert = db.prepare(`
          INSERT OR IGNORE INTO scores (uuid, game_id, entity_id, score_payload, timestamp, judge_id)
          VALUES (?, ?, ?, ?, ?, ?)
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

// 4. Admin & Export Routes
app.get('/api/admin/all-data', (req, res) => {
  try {
    const rows = db.prepare(`
        SELECT s.uuid, s.game_id, s.timestamp, e.name as entity_name, e.troop_number, e.type as entity_type, s.score_payload
        FROM scores s JOIN entities e ON s.entity_id = e.id
    `).all();

    // Parse JSON payloads for display
    const parsed = rows.map(r => ({ ...r, score_payload: JSON.parse(r.score_payload) }));

    const stats = {};
    parsed.forEach(r => {
        stats[r.game_id] = (stats[r.game_id] || 0) + 1;
    });

    // Get Game Status
    const statusMap = {};
    const statuses = db.prepare('SELECT * FROM game_status').all();
    for (const s of statuses) {
        statusMap[s.game_id] = s.status;
    }

    res.json({ scores: parsed, stats, game_status: statusMap });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADMIN: Toggle Game Status
app.post('/api/admin/game-status', (req, res) => {
    const { game_id, status } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO game_status (game_id, status) VALUES (?, ?) ON CONFLICT(game_id) DO UPDATE SET status=excluded.status');
        stmt.run(game_id, status);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: RESET DATA
app.delete('/api/admin/data', (req, res) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM scores').run();
            // Optional: db.prepare('DELETE FROM entities').run(); // Determine if we want to nuke entities too
        })();
        res.json({ success: true, message: 'Scores deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Score (Admin)
app.put('/api/scores/:uuid', (req, res) => {
    const { uuid } = req.params;
    const { score_payload } = req.body;

    if (!score_payload) return res.status(400).json({ error: 'Missing score_payload' });

    try {
        const update = db.prepare('UPDATE scores SET score_payload = ? WHERE uuid = ?');
        const info = update.run(JSON.stringify(score_payload), uuid);

        if (info.changes === 0) return res.status(404).json({ error: 'Score not found' });

        res.json({ status: 'updated' });
    } catch (err) {
        console.error('Update error:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// POST /api/entities (Create new Troop or Patrol)
app.post('/api/entities', (req, res) => {
  const { name, type, troop_number, parent_id } = req.body;

  if (!name || !type || !troop_number) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const insert = db.prepare('INSERT INTO entities (name, type, troop_number, parent_id) VALUES (?, ?, ?, ?)');
    const info = insert.run(name, type, troop_number, parent_id || null);
    res.json({ id: info.lastInsertRowid, name, type, troop_number, parent_id: parent_id || null });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});