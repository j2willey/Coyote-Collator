import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'camporee.db');

const db = new Database(dbPath, { readonly: true });

console.log('--- Entities Inspection ---');

// Count by type
try {
    const counts = db.prepare('SELECT type, COUNT(*) as count FROM entities GROUP BY type').all();
    console.log('Counts:');
    let total = 0;
    counts.forEach(row => {
        console.log(`  ${row.type}: ${row.count}`);
        total += row.count;
    });
    if (total === 0) console.log('  No entities found.');

} catch (err) {
    if (err.message.includes('no such table')) {
        console.log('Table "entities" does not exist.');
    } else {
        console.error('Error counting entities:', err.message);
    }
}

// First 10 rows
console.log('\nFirst 10 Entities:');
try {
    const rows = db.prepare('SELECT * FROM entities LIMIT 10').all();
    if (rows.length > 0) {
        console.table(rows);
    } else {
        console.log('No rows found.');
    }
} catch (err) {
    if (!err.message.includes('no such table')) {
        console.error('Error selecting entities:', err.message);
    }
}
