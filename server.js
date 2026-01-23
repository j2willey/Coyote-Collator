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
    troop_number TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scores (
    uuid TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    score_payload TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY(entity_id) REFERENCES entities(id)
  );
`);

// Seed Entities if empty
const entCount = db.prepare('SELECT count(*) as count FROM entities').get();
if (entCount.count === 0) {
  const insert = db.prepare('INSERT INTO entities (id, name, type, troop_number) VALUES (?, ?, ?, ?)');
  const seedData = [
    [101, 'Flaming Flamingoes', 'patrol', '101'],
    [102, 'Screaming Eagles', 'patrol', '101'],
    [201, 'Troop 101', 'troop', '101'],
    [301, 'Muddy Otters', 'patrol', '55'],
    [302, 'Silent Owls', 'patrol', '55'],
    [401, 'Troop 55', 'troop', '55']
  ];
  const transaction = db.transaction((data) => {
    for (const row of data) insert.run(row);
  });
  transaction(seedData);
  console.log('Seeded entities table.');
}

app.use(express.json());
app.use(express.static('public'));

// --- API ROUTES ---

// Get Games Configuration
app.get('/games.json', (req, res) => {
  try {
    const configDir = path.join(__dirname, 'config');
    const commonPath = path.join(configDir, 'common.json');
    const gamesDir = path.join(configDir, 'games');

    // Read common scoring
    const commonScoring = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));

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

    // Sort games by id
    games.sort((a, b) => {
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    res.json({
      metadata: {
        version: "1.0",
        generated_at: new Date().toISOString()
      },
      common_scoring: commonScoring,
      games: games
    });
  } catch (err) {
    console.error('Error serving games.json:', err);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Get Roster
app.get('/api/entities', (req, res) => {
  const rows = db.prepare('SELECT * FROM entities ORDER BY troop_number, name').all();
  res.json(rows);
});

// Submit Score
app.post('/api/submit-score', (req, res) => {
  const { uuid, game_id, entity_id, score_payload, timestamp } = req.body;

  if (!uuid || !game_id || !entity_id || !score_payload) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO scores (uuid, game_id, entity_id, score_payload, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = insert.run(uuid, game_id, entity_id, JSON.stringify(score_payload), timestamp);

    if (result.changes === 0) {
      // Record already exists (idempotency by uuid)
      return res.status(200).json({ status: 'already_exists' });
    }

    res.status(201).json({ status: 'success' });
  } catch (err) {
    console.error('Insert error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Export CSV
app.get('/api/export', (req, res) => {
  try {
    const rows = db.prepare(`
        SELECT s.uuid, s.game_id, s.timestamp, e.name as entity_name, e.troop_number, e.type as entity_type, s.score_payload
        FROM scores s
        JOIN entities e ON s.entity_id = e.id
    `).all();

    if (rows.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.send('uuid,game_id,timestamp,entity_name,troop_number,entity_type,score_data\n');
        return;
    }

    // Flatten JSON
    // We need to discover all potential keys to make a consistent CSV header, or just dump the JSON string.
    // Requirement says: "parse the JSON score_payload into separate columns"
    // Since keys vary by game, we'll create a superset of columns or just include all found keys.
    // simpler approach: One CSV per game type? The requirement says "A route... Generates A flattened CSV".
    // Mixed schemas in one CSV is messy (sparse matrix).
    // I will collect ALL unique keys across ALL records to build the header.

    const allKeys = new Set(['uuid', 'game_id', 'timestamp', 'entity_name', 'troop_number', 'entity_type']);
    const processedRows = rows.map(row => {
        const payload = JSON.parse(row.score_payload);
        const flatRow = {
            uuid: row.uuid,
            game_id: row.game_id,
            timestamp: new Date(row.timestamp).toISOString(),
            entity_name: row.entity_name,
            troop_number: row.troop_number,
            entity_type: row.entity_type
        };

        for (const [key, val] of Object.entries(payload)) {
            const cleanKey = `data_${key}`; // Prefix to avoid collisions
            allKeys.add(cleanKey);
            flatRow[cleanKey] = val;
        }
        return flatRow;
    });

    const headers = Array.from(allKeys).sort();

    const csvRows = [headers.join(',')];

    for (const row of processedRows) {
        const values = headers.map(header => {
            const val = row[header] === undefined ? '' : row[header];
            const strVal = String(val).replace(/"/g, '""'); // Escape quotes
            return `"${strVal}"`;
        });
        csvRows.push(values.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="scores.csv"');
    res.send(csvRows.join('\n'));

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).send('Export failed');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
