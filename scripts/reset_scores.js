import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'camporee.db');

const db = new Database(dbPath);
console.log(`Connected to ${dbPath}`);

try {
    const result = db.prepare('DELETE FROM scores').run();
    console.log(`Deleted ${result.changes} rows from scores table.`);
} catch (err) {
    if (err.message.includes('no such table')) {
        console.log('Table "scores" does not exist yet.');
    } else {
        console.error('Error resetting scores:', err);
    }
}
