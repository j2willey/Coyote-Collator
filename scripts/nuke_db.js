import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', 'data', 'camporee.db');

if (fs.existsSync(dbPath)) {
    try {
        fs.unlinkSync(dbPath);
        console.log(`Deleted database file: ${dbPath}`);
        console.warn('WARNING: The database has been deleted. You must RESTART the server to recreate the database and tables.');
    } catch (err) {
        console.error('Error deleting database file:', err);
    }
} else {
    console.log('Database file not found. Nothing to delete.');
}
