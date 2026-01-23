import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'camporee.db');
const troopPath = path.join(__dirname, '..', 'config', 'troop.csv');
const patrolPath = path.join(__dirname, '..', 'config', 'patrol.csv');

// Connect to Database
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
const db = new Database(dbPath);

console.log(`Connected to database at ${dbPath}`);

// Prepare Statement
const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO entities (id, name, type, troop_number)
    VALUES (?, ?, ?, ?)
`);

// Helper to read CSV lines excluding header
function readCsvLines(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    return lines.slice(1); // Skip header
}

const importData = db.transaction(() => {
    let troopCount = 0;
    let patrolCount = 0;

    // Process Troops
    const troopLines = readCsvLines(troopPath);
    for (const line of troopLines) {
        // Troop ID, Troop (Name)
        // Example: 0013,T13
        const cols = line.split(',');
        if (cols.length < 2) continue;

        const troopIdStr = cols[0].trim();
        const name = cols[1].trim();

        const id = parseInt(troopIdStr, 10);
        if (isNaN(id)) continue;

        // troop_number: Parse Troop ID as string (or integer) to store the number.
        // Convert to int then string to normalize (remove leading zeros)
        const troopNumber = id.toString();

        insertStmt.run(id, name, 'troop', troopNumber);
        troopCount++;
    }

    // Process Patrols
    const patrolLines = readCsvLines(patrolPath);
    for (const line of patrolLines) {
        // Patrol ID, Troop (Number), Patrol (Name), ...
        // Example: 1001,13,Skeleton Fishing,5,,,
        const cols = line.split(',');
        if (cols.length < 3) continue;

        const patrolIdStr = cols[0].trim();
        const troopNumStr = cols[1].trim();
        const name = cols[2].trim();

        const id = parseInt(patrolIdStr, 10);
        if (isNaN(id)) continue;

        insertStmt.run(id, name, 'patrol', troopNumStr);
        patrolCount++;
    }

    return { troopCount, patrolCount };
});

try {
    const results = importData();
    console.log(`Imported ${results.troopCount} Troops`);
    console.log(`Imported ${results.patrolCount} Patrols`);
} catch (err) {
    console.error('Error importing roster:', err);
    process.exit(1);
}
