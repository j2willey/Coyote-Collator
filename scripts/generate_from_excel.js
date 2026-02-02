import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx'; // Requires: npm install xlsx
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIG
const SOURCE_DIR = process.cwd();
const OUTPUT_DIR = path.join(process.cwd(), 'config', 'games');

// Columns to IGNORE (Common Scoring or metadata)
const IGNORED = [
    'patrol id', 'patrol name', 'troop', 'troop number',
    'patrol flag', 'patrol yell', 'patrol spirit', 'teamwork', 'participation',
    'un-scout-like', 'total', 'place', 'score', 'max possible',
    'game score', 'time score', 'notes', 'comments'
];

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function toSnakeCase(str) {
    return str.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function guessType(header) {
    const h = header.toLowerCase();
    if (h.includes('time')) return 'timed';
    if (h.includes('count') || h.includes('points') || h.includes('number')) return 'number';
    // If it's a checkbox-style column (e.g. "Ignited Tinder")
    if (h.length < 15 && !h.includes('(')) return 'boolean';
    return 'number'; // Default to number for scoring
}

function processWorkbook(filename) {
    console.log(`\n📘 Processing Workbook: ${filename}`);
    const workbook = xlsx.readFile(path.join(SOURCE_DIR, filename));

    workbook.SheetNames.forEach(sheetName => {
        // Skip metadata sheets like "MasterDB" or "Results"
        if (sheetName.toLowerCase().includes('db') || sheetName.toLowerCase().includes('result') || sheetName.toLowerCase().includes('winner')) {
            console.log(`   Start skipping ${sheetName}...`);
            return;
        }

        const ws = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' }); // Get raw rows array

        // 1. Find the Header Row (Look for key identifiers)
        let headerIndex = -1;
        let entityType = 'patrol'; // default

        for (let i = 0; i < Math.min(20, rows.length); i++) {
            const rowStr = (rows[i] || []).join(' ').toLowerCase();
            if (rowStr.includes('patrol id')) {
                headerIndex = i;
                entityType = 'patrol';
                break;
            } else if (rowStr.includes('troop number')) {
                headerIndex = i;
                entityType = 'troop';
                break;
            }
        }

        if (headerIndex === -1) {
            console.log(`   ⚠️  Skipping tab "${sheetName}": No header found.`);
            return;
        }

        // 2. Find Game Name (Look for "Event:" or use Sheet Name)
        let gameName = sheetName;
        // Search rows above header for "Event:"
        for (let i = 0; i < headerIndex; i++) {
            const row = rows[i] || [];
            const rowText = row.join(' ');
            if (rowText.includes('Event:')) {
                // Try to extract text after "Event:"
                const parts = rowText.split('Event:');
                if (parts[1]) gameName = parts[1].trim().replace(/[,"]/g, '');
            }
        }

        // 3. Process Columns
        const headerRow = rows[headerIndex];
        const fields = [];

        headerRow.forEach((colRaw) => {
            if (!colRaw || typeof colRaw !== 'string') return;
            const col = colRaw.trim().replace(/\r\n/g, ' '); // Clean newlines

            if (col.length < 2) return;
            const lowerCol = col.toLowerCase();

            // Skip Ignored Columns
            if (IGNORED.some(ig => lowerCol.includes(ig))) return;
            // Skip "10 E" columns (Standard Essentials)
            if (lowerCol.includes('10 e:')) return;

            fields.push({
                id: toSnakeCase(col),
                label: col,
                type: guessType(col)
            });
        });

        if (fields.length === 0) {
            console.log(`   ⚠️  Skipping tab "${sheetName}": No scoring fields found.`);
            return;
        }

        // 4. Write Config
        const fileId = toSnakeCase(sheetName);
        const config = {
            id: fileId,
            name: gameName,
            type: entityType,
            fields: fields
        };

        fs.writeFileSync(path.join(OUTPUT_DIR, `${fileId}.json`), JSON.stringify(config, null, 2));
        console.log(`   ✅ Generated: ${fileId}.json (${gameName})`);
    });
}

// Run on all .xlsx files in root
const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.xlsx'));
if (files.length === 0) {
    console.log('❌ No .xlsx files found in root directory.');
} else {
    files.forEach(processWorkbook);
}