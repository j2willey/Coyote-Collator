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

// Migration for existing databases
try {
  db.exec("ALTER TABLE entities ADD COLUMN parent_id TEXT");
} catch (e) { /* Column already exists */ }

try {
  db.exec("ALTER TABLE entities ADD COLUMN manual_rank TEXT");
} catch (e) { /* Column already exists */ }

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

app.use(express.json());

// Redirect desktop users to admin dashboard, mobile users to judge UI
app.get('/', (req, res, next) => {
    const ua = req.headers['user-agent'] || '';
    const isMobile = /Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua);
    if (!isMobile) {
        return res.redirect('/admin.html');
    }
    next();
});

app.use(express.static('public'));

// --- API ROUTES ---

// 1. GET /games.json (Configuration)
app.get('/games.json', (req, res) => {
  try {
    const configDir = path.join(__dirname, 'config');
    const gamesDir = path.join(configDir, 'games');

    // Read games
    const games = [];
    if (fs.existsSync(gamesDir)) {
      const files = fs.readdirSync(gamesDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(gamesDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const game = JSON.parse(content);

          // Sandwich Composition Logic
          let finalFields = [];

          // Helper to resolve and read fields from a path or array of paths
          const resolveFields = (configPath) => {
            const paths = Array.isArray(configPath) ? configPath : [configPath];
            let fields = [];
            for (const p of paths) {
              try {
                const fullPath = path.resolve(path.dirname(filePath), p);
                if (fs.existsSync(fullPath)) {
                  const includeData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                  fields = fields.concat(Array.isArray(includeData) ? includeData : []);
                } else {
                  console.warn(`Warning: File not found: ${fullPath} in ${file}`);
                }
              } catch (err) {
                console.warn(`Warning: Could not parse file ${p} for ${file}: ${err.message}`);
              }
            }
            return fields;
          };

          // Step A: Header (includes)
          if (game.includes) finalFields = finalFields.concat(resolveFields(game.includes));
          // Compatibility for previous "include" singular
          if (game.include && !game.includes) finalFields = finalFields.concat(resolveFields(game.include));

          // Step B: Meat (fields)
          finalFields = finalFields.concat(game.fields || []);

          // Step C: Footer (appends)
          if (game.appends) finalFields = finalFields.concat(resolveFields(game.appends));

          game.fields = finalFields;

          games.push(game);
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
      common_scoring: [], // Empty now that fields are merged per-game
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

app.put('/api/entities/:id', (req, res) => {
    const { id } = req.params;
    const { manual_rank } = req.body;
    try {
        const stmt = db.prepare('UPDATE entities SET manual_rank = ? WHERE id = ?');
        stmt.run(manual_rank, id);
        res.json({ status: 'success' });
    } catch (err) {
        console.error('Update entity error:', err);
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

// 4. Admin & Export Routes
app.get('/api/admin/all-data', (req, res) => {
  try {
    const rows = db.prepare(`
        SELECT s.uuid, s.game_id, s.entity_id, s.timestamp, e.name as entity_name, e.troop_number, e.type as entity_type, s.score_payload
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

// GET /api/export (Download CSV)
app.get('/api/export', (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT s.uuid, s.game_id, s.entity_id, s.timestamp, e.name as entity_name, e.troop_number, e.type as entity_type, s.score_payload
            FROM scores s JOIN entities e ON s.entity_id = e.id
            ORDER BY s.timestamp DESC
        `).all();

        if (rows.length === 0) {
            return res.send("No scores to export.");
        }

        // Get unique fields from all payloads (to handle dynamic schema)
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
                r.uuid,
                r.game_id,
                new Date(r.timestamp).toISOString(),
                r.troop_number,
                `"${r.entity_name}"`,
                r.entity_type,
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

    } catch (err) {
        console.error('Export error:', err);
        res.status(500).send('Error generating export');
    }
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

// ADMIN: CLEAR SCORES
app.delete('/api/admin/scores', (req, res) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM scores').run();
            db.prepare('DELETE FROM judges').run();
            db.prepare('DELETE FROM game_status').run();
        })();
        res.json({ success: true, message: 'Scores, judges, and game statuses deleted.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ADMIN: FULL RESET (Scores + Rosters)
app.delete('/api/admin/full-reset', (req, res) => {
    try {
        db.transaction(() => {
            db.prepare('DELETE FROM scores').run();
            db.prepare('DELETE FROM entities').run();
            db.prepare('DELETE FROM judges').run();
            db.prepare('DELETE FROM game_status').run();
        })();
        res.json({ success: true, message: 'Everything deleted.' });
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
    const id = getNextEntityId(type);
    const insert = db.prepare('INSERT INTO entities (id, name, type, troop_number, parent_id) VALUES (?, ?, ?, ?, ?)');
    insert.run(id, name, type, troop_number, parent_id || null);
    res.json({ id, name, type, troop_number, parent_id: parent_id || null });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});