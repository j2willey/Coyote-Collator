import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import crypto from 'crypto';

// CONFIG
const EXCEL_FILE = 'patrol.xlsx'; // In root
const API_BASE = 'http://localhost:3000';
const CONFIG_DIR = path.join(process.cwd(), 'config');
const GAMES_DIR = path.join(CONFIG_DIR, 'games');

if (!fs.existsSync(EXCEL_FILE)) {
    console.error(`Excel file not found: ${EXCEL_FILE}`);
    process.exit(1);
}

// Load Common Scoring Config
let commonScoring = [];
if (fs.existsSync(path.join(CONFIG_DIR, 'common.json'))) {
    commonScoring = JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, 'common.json'), 'utf-8'));
}

// Load All Game Configs
const gameConfigs = [];
if (fs.existsSync(GAMES_DIR)) {
    fs.readdirSync(GAMES_DIR).forEach(file => {
        if (file.endsWith('.json')) {
            const content = fs.readFileSync(path.join(GAMES_DIR, file), 'utf8');
            gameConfigs.push(JSON.parse(content));
        }
    });
} else {
    console.error("Game config directory not found.");
    process.exit(1);
}

// Helper: Normalize strings for matching
const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

// Helper: Convert Excel Value to Type
const convertValue = (val, type) => {
    if (val === undefined || val === null) return null;
    if (type === 'boolean') {
        if (typeof val === 'string') return val.toLowerCase() === 'yes' || val.toLowerCase() === 'true' || val === '1';
        return !!val;
    }
    if (type === 'number' || type === 'range') return Number(val);
    if (type === 'timed') {
        if (typeof val === 'number') {
            const totalSeconds = Math.round(val * 24 * 60 * 60);
            const mm = Math.floor(totalSeconds / 60);
            const ss = totalSeconds % 60;
            return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        }
        return String(val);
    }
    return String(val);
};

// Sort game configs by ID length descending to prevent substring matches (e.g. p1 matching p10)
gameConfigs.sort((a, b) => b.id.length - a.id.length);

// HELPER: Wait for server availability
async function waitForServer() {
    console.log("Checking server availability...");
    try {
        const res = await fetch(`${API_BASE}/games.json`);
        if (res.ok) {
            console.log("Server is UP.");
            return true;
        }
    } catch (e) {
        console.error(`Server unreachable at ${API_BASE}. Please ensure the app is running.`);
        return false;
    }
}

async function runImport() {
    if (!await waitForServer()) return;

    // Fetch Entities used for checking validity (mostly for verification, though we trust Patrol IDs)
    let entities = [];
    try {
        const res = await fetch(`${API_BASE}/api/entities`);
        if (res.ok) entities = await res.json();
        console.log(`Loaded ${entities.length} entities from server.`);
    } catch(e) { console.error("Could not fetch entities", e); }


    const workbook = XLSX.readFile(EXCEL_FILE);
    let totalImported = 0;

    for (const sheetName of workbook.SheetNames) {
        const normSheet = normalize(sheetName);
        console.log(`\nProcessing Sheet: ${sheetName}`);

        // Matching Logic Priority:
        // 1. Exact ID Match (highest confidence)
        // 2. Exact Name Match
        // 3. ID starts with Sheet (e.g. Sheet "P3" -> Game "P3_Skits")
        // 4. Fuzzy fallback (only if unique?)

        let game = gameConfigs.find(g => normalize(g.id) === normSheet);

        if (!game) {
            game = gameConfigs.find(g => normalize(g.name) === normSheet);
        }

        if (!game) {
            // Check if Game ID starts with Sheet Name (e.g. P3 matches P3_Skits, but P2 should NOT match P21)
            // But P2 matches P21_... if we just do startsWith.
            // We want to avoid P2 matching P21.
            // Maybe strict ID match is best for these short codes.

            // Try: Normalizing game name includes sheet name or vice versa
            game = gameConfigs.find(g => normalize(g.name).includes(normSheet) || normSheet.includes(normalize(g.name)));
        }

        // Special handling for legacy sheet names if needed, or ask user.
        // Recover P2 -> P2 match which failed strict because of length sort + includes()
        if (!game) {
             game = gameConfigs.find(g => normalize(g.id).startsWith(normSheet) && normalize(g.id).replace(normSheet, '').match(/^[^0-9]/));
             // match "P3" in "P3_Skits" (underscore/letters follow) but NOT "P2" in "P21" (digit follows)
             // normalize() removes underscores though.
        }

        // Final fallback: original loose match but SKIP if it looks like a prefix conflict (p1 vs p10)
        if (!game) {
             game = gameConfigs.find(g => {
                 const nId = normalize(g.id);
                 // Strict checks:
                 // If normSheet is "p2", nId "p21..." should NOT match just because it contains p2.

                 return nId === normSheet; // We already checked this.
             });
        }

        // Revert to find() with better logic logic
        if (!game) {
             game = gameConfigs.find(g => {
                 const nId = normalize(g.id);
                 // Sheet "P17 Racing" -> "p17racing". Game "p17_racing" -> "p17racing". Match!
                 if (nId === normSheet) return true;

                 // Sheet "P3 Skits" -> "p3skits". Game "p3_skits" -> "p3skits". Match!

                 // Sheet "P2" -> "p2". Game "p2" -> "p2". Match!

                 // If the sheet name is contained in the Game Name
                 if (normalize(g.name).includes(normSheet)) return true;

                 return false;
             });
        }

        if (!game) {
            console.log(`  XX No matching game config found. Skipping.`);
            continue;
        }
        console.log(`  -> Matched Game: ${game.id} ("${game.name}")`);

        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

        let headerRowIdx = -1;
        for(let i=0; i<rows.length; i++) {
            if (rows[i] && rows[i].some(c => c && String(c).toLowerCase().includes('patrol id'))) {
                headerRowIdx = i;
                break;
            }
        }

        if (headerRowIdx === -1) {
            console.log("  XX No header row (looking for 'Patrol Id'). Skipping.");
            continue;
        }

        const headers = rows[headerRowIdx];

        // Sandwich Logic for Import
        let finalFields = [];
        const resolveFields = (configPath, gamePath) => {
            const paths = Array.isArray(configPath) ? configPath : [configPath];
            let fields = [];
            for (const p of paths) {
                try {
                    const fullPath = path.resolve(path.dirname(gamePath), p);
                    if (fs.existsSync(fullPath)) {
                        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                        fields = fields.concat(Array.isArray(data) ? data : []);
                    }
                } catch (e) {
                    console.warn(`    !! Warning: Could not load ${p}`);
                }
            }
            return fields;
        };

        if (game.includes) finalFields = finalFields.concat(resolveFields(game.includes, path.join(GAMES_DIR, `${game.id}.json`)));
        finalFields = finalFields.concat(game.fields || []);
        if (game.appends) finalFields = finalFields.concat(resolveFields(game.appends, path.join(GAMES_DIR, `${game.id}.json`)));

        const allFields = finalFields;
        const fieldMap = {}; // colIndex -> fieldId

        headers.forEach((h, idx) => {
            if (!h) return;
            const hNorm = normalize(h);
            const matchedField = allFields.find(f => {
                return normalize(f.id) === hNorm || normalize(f.label) === hNorm || hNorm.includes(normalize(f.label));
            });
            if (matchedField) fieldMap[idx] = matchedField;
        });

        const patrolIdIdx = headers.findIndex(h => h && normalize(h) === 'patrolid');
        if (patrolIdIdx === -1) continue;

        // Iterate Rows
        for (let r = headerRowIdx + 2; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;

            const entityId = row[patrolIdIdx];
            if (!entityId) continue;

            // Verify entity exists?
            // Optional, but good practice. The API probably relies on FKs so it might fail if bad ID.

            const payload = {};
            let hasData = false;

            for (const [colIdx, field] of Object.entries(fieldMap)) {
                const val = row[colIdx];
                if (val !== null && val !== undefined && val !== '') {
                    payload[field.id] = convertValue(val, field.type);
                    hasData = true;
                }
            }

            if (!hasData) continue;

            // Check if all data is effectively "zero" (e.g. 0, "0", false) which indicates a placeholder row
            // The user noted that some rows have "0" in columns due to excel formulas but aren't real scores.
            const isEffectiveZero = Object.values(payload).every(v =>
                v === 0 ||
                v === "0" ||
                v === false ||
                v === null ||
                v === "00:00" // Time field empty/zero result
            );

            if (isEffectiveZero) {
                 // console.log("Skipping zero-row for entity", entityId);
                 continue;
            }

            // POST SCORE
            const body = {
                uuid: crypto.randomUUID(),
                game_id: game.id,
                entity_id: entityId,
                score_payload: payload,
                timestamp: Date.now(),
                judge_name: 'Excel Import',
                judge_email: 'import@local'
            };

            try {
                const postRes = await fetch(`${API_BASE}/api/score`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (postRes.ok) {
                    process.stdout.write("."); // Progress dot
                    totalImported++;
                } else {
                    const errTxt = await postRes.text();
                     if (errTxt.includes('already_exists')) process.stdout.write("s"); // Skip
                     else console.error(`Failed to post: ${postRes.status} - ${errTxt}`);
                }
            } catch (err) {
                console.error("Network Error posting score:", err);
            }
        }
    }

    console.log(`\n\nImport Complete! Total scores imported: ${totalImported}`);
}

runImport();
