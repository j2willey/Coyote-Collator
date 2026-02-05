import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, './');
const CONFIG_DIR = path.join(ROOT_DIR, 'config');
const GAMES_DIR = path.join(CONFIG_DIR, 'games');
const OUTPUT_DIR = path.join(ROOT_DIR, 'camporee');
const GAMES_OUTPUT_DIR = path.join(OUTPUT_DIR, 'games');
const ZIP_PATH = path.join(ROOT_DIR, 'CamporeeConfig.zip');

// Ensure output directories exist
if (fs.existsSync(OUTPUT_DIR)) {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}
fs.mkdirSync(GAMES_OUTPUT_DIR, { recursive: true });

console.log(`Reading games from: ${GAMES_DIR}`);

// Helper to resolve includes/appends (Sandwich Strategy)
function resolveFields(configPath, contextPath) {
    const paths = Array.isArray(configPath) ? configPath : [configPath];
    let fields = [];
    for (const p of paths) {
        try {
            const fullPath = path.resolve(path.dirname(contextPath), p);
            if (fs.existsSync(fullPath)) {
                const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                fields = fields.concat(Array.isArray(data) ? data : []);
            } else {
                console.warn(`Warning: Included file not found: ${fullPath}`);
            }
        } catch (err) {
            console.warn(`Warning: Could not parse included file ${p}: ${err.message}`);
        }
    }
    return fields;
}

// Helper to map Source Field -> Target Component
function mapFieldToComponent(field) {
    const comp = {
        id: field.id,
        label: field.label,
        audience: field.audience || 'judge',
        sortOrder: field.sortOrder || 900,
        config: {}
    };

    // Map Type
    switch (field.type) {
        case 'timed':
            comp.type = 'stopwatch';
            break;
        case 'boolean':
            comp.type = 'checkbox';
            break;
        case 'range':
            comp.type = 'number'; // Designer doesn't explicitly support range in UI dropdown, fallback to number
            break;
        default:
            comp.type = field.type || 'number';
    }

    // Map Kind & Weight
    comp.kind = field.kind || 'points';
    if (comp.kind === 'points') comp.weight = 1;
    else if (comp.kind === 'penalty') comp.weight = -1;
    else comp.weight = 0;

    // Map Config
    if (field.min !== undefined) comp.config.min = field.min;
    if (field.max !== undefined) comp.config.max = field.max;
    if (field.placeholder) comp.config.placeholder = field.placeholder;
    if (field.defaultValue !== undefined) comp.config.defaultValue = field.defaultValue;

    return comp;
}

// Main Conversion Logic
const playlist = [];
const gameFiles = fs.readdirSync(GAMES_DIR).filter(f => f.endsWith('.json'));

// Sort for consistent order (p1, p2, ...)
gameFiles.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || 999);
    const numB = parseInt(b.match(/\d+/)?.[0] || 999);
    return numA - numB;
});

gameFiles.forEach((file, index) => {
    const filePath = path.join(GAMES_DIR, file);
    const sourceGame = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // 1. Flatten Fields (Sandwich)
    let allFields = [];
    if (sourceGame.includes) allFields = allFields.concat(resolveFields(sourceGame.includes, filePath));
    if (sourceGame.fields) allFields = allFields.concat(sourceGame.fields);
    if (sourceGame.appends) allFields = allFields.concat(resolveFields(sourceGame.appends, filePath));

    // 2. Map to Components
    const components = allFields.map(mapFieldToComponent);

    // 3. Construct Target Game Object
    const targetGame = {
        id: sourceGame.id,
        type: sourceGame.type || 'patrol',
        schemaVersion: "2.7",
        content: {
            title: sourceGame.name,
            story: "",
            instructions: ""
        },
        scoring: {
            method: "points_desc", // Default
            components: components
        }
    };

    // 4. Save Game JSON
    fs.writeFileSync(path.join(GAMES_OUTPUT_DIR, `${sourceGame.id}.json`), JSON.stringify(targetGame, null, 2));

    // 5. Add to Playlist
    playlist.push({
        gameId: sourceGame.id,
        enabled: true,
        order: index + 1
    });

    console.log(`Converted ${sourceGame.id} (${sourceGame.name}) -> ${components.length} fields`);
});

// Create camporee.json
const camporeeJson = {
    schemaVersion: "2.7",
    meta: {
        title: "Converted Camporee",
        theme: "",
        year: new Date().getFullYear(),
        director: ""
    },
    playlist: playlist
};
fs.writeFileSync(path.join(OUTPUT_DIR, 'camporee.json'), JSON.stringify(camporeeJson, null, 2));

// Create presets.json (Default set)
const defaultPresets = [
    { id: 'p_flag', label: "Patrol Flag", type: "number", kind: "points", weight: 10, audience: "judge", config: { min: 0, max: 10, placeholder: "0-10 Points" } },
    { id: 'p_yell', label: "Patrol Yell", type: "number", kind: "points", weight: 5,  audience: "judge", config: { min: 0, max: 5,  placeholder: "0-5 Points" } },
    { id: 'p_spirit', label: "Scout Spirit", type: "number", kind: "points", weight: 10, audience: "judge", config: { min: 0, max: 10, placeholder: "0-10 Points" } },
    { id: 'off_notes', label: "Judges Notes", type: "textarea", kind: "info", weight: 0, audience: "judge", config: { placeholder: "Issues, tie-breakers, etc." } },
    { id: 'off_score', label: "Official Score", type: "number", kind: "points", weight: 1, audience: "admin", config: { placeholder: "Final Calculated Points" } }
];
fs.writeFileSync(path.join(OUTPUT_DIR, 'presets.json'), JSON.stringify(defaultPresets, null, 2));

console.log(`\nIntermediate files saved to: ${OUTPUT_DIR}`);

// Zip it up
try {
    console.log(`Creating ZIP archive: ${ZIP_PATH}`);
    // Using system zip command for simplicity and robustness in this environment
    execSync(`zip -r "${ZIP_PATH}" .`, { cwd: OUTPUT_DIR, stdio: 'inherit' });
    console.log(`\nSUCCESS: CamporeeConfig.zip created at root.`);
} catch (e) {
    console.error("\nERROR: Failed to create zip file.");
    console.error("Please ensure 'zip' is installed on your system, or manually zip the contents of the 'camporee' folder.");
    console.error(e.message);
}