import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'camporee.db');

try {
    const db = new Database(dbPath, { readonly: true });

    const stmt = db.prepare(`
        SELECT s.timestamp, s.game_id, e.name, s.score_payload
        FROM scores s
        JOIN entities e ON s.entity_id = e.id
        ORDER BY s.timestamp DESC
        LIMIT 5
    `);

    const rows = stmt.all();

    console.log(`Found ${rows.length} recent scores:\n`);

    rows.forEach((row, index) => {
        let payload = row.score_payload;
        try {
            payload = JSON.parse(row.score_payload);
        } catch (e) {
            // keep as string if parse fails
        }

        console.log(`--- Record ${index + 1} ---`);
        console.log(`Time:   ${new Date(row.timestamp).toISOString()}`);
        console.log(`Game:   ${row.game_id}`);
        console.log(`Entity: ${row.name}`);
        console.log('Score: ', payload);
        console.log('');
    });
} catch (err) {
    if (err.code === 'SQLITE_CANTOPEN') {
        console.error('Could not open database. Does it exist?');
    } else if (err.message.includes('no such table')) {
        console.error('Tables not found. Have you started the server to initialize the DB?');
    } else {
        console.error('Error inspecting scores:', err);
    }
}
