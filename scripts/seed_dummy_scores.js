import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'camporee.db');

const db = new Database(dbPath);

const GAME_ID = 'game_01_boil';
const PAYLOAD = { "boil_time": "05:00", "matches_used": 10 };

console.log('--- Seeding Dummy Scores ---');

try {
    // Get all entity IDs
    // We probably only want to score 'patrol' types, but the prompt said "random entity_id from the entities table"
    const entities = db.prepare('SELECT id FROM entities').all();

    if (entities.length === 0) {
        console.error('No entities found! Cannot seed scores. Run db:import first.');
        process.exit(1);
    }

    const insertStmt = db.prepare(`
        INSERT INTO scores (uuid, game_id, entity_id, score_payload, timestamp)
        VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction(() => {
        for (let i = 0; i < 5; i++) {
            const randomEntity = entities[Math.floor(Math.random() * entities.length)];
            const uuid = crypto.randomUUID();
            const timestamp = Date.now();

            insertStmt.run(uuid, GAME_ID, randomEntity.id, JSON.stringify(PAYLOAD), timestamp);
            console.log(`Inserted score for entity ${randomEntity.id} (Game: ${GAME_ID})`);
        }
    });

    transaction();
    console.log('Successfully inserted 5 dummy scores.');

} catch (err) {
    if (err.message.includes('no such table')) {
        console.error('Error: Table missing. Make sure the database is initialized.');
    } else {
        console.error('Error seeding scores:', err);
    }
}
