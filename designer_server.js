import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001; // Ensure this matches your Docker port map

// Increase payload limit for large Zip uploads
app.use(bodyParser.json({ limit: '50mb' }));

// SERVE STATIC FILES
// Important: { index: false } prevents Express from automatically serving
// 'index.html' (the Collator App) when you hit '/', allowing the route below to handle it.
app.use(express.static('public', { index: false }));

app.set('view engine', 'ejs');

// Ensure root storage directory exists
const STORAGE_ROOT = path.join(__dirname, 'camporees');
if (!fs.existsSync(STORAGE_ROOT)) {
    console.log(`Creating storage root at: ${STORAGE_ROOT}`);
    fs.mkdirSync(STORAGE_ROOT);
}

// --- FRONTEND ROUTES ---

// FIX: Passed the 'title' variable required by index.ejs
app.get('/', (req, res) => {
    res.render('designer/index', {
        title: 'Camporee Designer'
    });
});

// --- API ROUTES ---

/**
 * 1. STATUS CHECK
 * Used by the client to determine if "Server Mode" features should be enabled.
 */
app.get('/api/status', (req, res) => {
    res.json({
        online: true,
        version: '1.0',
        message: 'Camporee Designer Server is Online'
    });
});

/**
 * 2. LIST CAMPOREES
 * Scans the /camporees/ directory for valid projects.
 */
app.get('/api/camporees', (req, res) => {
    try {
        const camporees = [];
        const entries = fs.readdirSync(STORAGE_ROOT, { withFileTypes: true });

        entries.forEach(entry => {
            if (entry.isDirectory()) {
                const metaPath = path.join(STORAGE_ROOT, entry.name, 'camporee.json');

                // Only include if a valid manifest exists
                if (fs.existsSync(metaPath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        camporees.push({
                            id: entry.name, // The UUID directory name
                            title: data.meta.title,
                            year: data.meta.year,
                            theme: data.meta.theme
                        });
                    } catch (e) {
                        console.warn(`Skipping corrupt camporee in dir: ${entry.name}`);
                    }
                }
            }
        });

        res.json(camporees);
    } catch (err) {
        console.error("List Error:", err);
        res.status(500).json({ error: "Failed to scan camporees" });
    }
});

/**
 * 3. GET SINGLE CAMPOREE
 * Loads the manifest, games, and presets for a specific ID.
 */
app.get('/api/camporee/:id', (req, res) => {
    try {
        const id = req.params.id;

        // Security: Prevent directory traversal
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return res.status(400).json({ error: "Invalid ID format" });
        }

        const dir = path.join(STORAGE_ROOT, id);
        const metaPath = path.join(dir, 'camporee.json');

        if (!fs.existsSync(metaPath)) {
            return res.status(404).json({ error: "Camporee not found" });
        }

        // Load Manifest
        const camporeeData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

        // Load Presets (Optional)
        const presetsPath = path.join(dir, 'presets.json');
        let presets = [];
        if (fs.existsSync(presetsPath)) {
            presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
        }

        // Load Games
        const gamesDir = path.join(dir, 'games');
        const games = [];
        if (fs.existsSync(gamesDir)) {
            const files = fs.readdirSync(gamesDir);
            files.forEach(file => {
                if (file.endsWith('.json')) {
                    try {
                        const gameData = JSON.parse(fs.readFileSync(path.join(gamesDir, file), 'utf8'));
                        games.push(gameData);
                    } catch (e) {
                        console.warn(`Failed to parse game: ${file}`);
                    }
                }
            });
        }

        res.json({
            meta: camporeeData.meta,
            games: games,
            presets: presets
        });

    } catch (err) {
        console.error("Load Error:", err);
        res.status(500).json({ error: "Failed to load camporee data" });
    }
});

/**
 * 4. CHECK METADATA (For Overwrite Warning)
 * Returns just the meta block to compare client vs server versions.
 */
app.get('/api/camporee/:id/meta', (req, res) => {
    try {
        const id = req.params.id;
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: "Invalid ID" });

        const metaPath = path.join(STORAGE_ROOT, id, 'camporee.json');

        if (fs.existsSync(metaPath)) {
            const data = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            res.json({ exists: true, meta: data.meta });
        } else {
            res.json({ exists: false });
        }
    } catch (err) {
        console.error("Check Error:", err);
        res.status(500).json({ error: "Check failed" });
    }
});

/**
 * 5. SAVE CAMPOREE
 * Writes all data to the disk structure.
 */
app.post('/api/camporee/:id', (req, res) => {
    try {
        const id = req.params.id;
        const payload = req.body; // { meta, games, presets }

        if (!/^[a-zA-Z0-9_-]+$/.test(id)) return res.status(400).json({ error: "Invalid ID" });

        const dir = path.join(STORAGE_ROOT, id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // 1. Save Presets
        fs.writeFileSync(path.join(dir, 'presets.json'), JSON.stringify(payload.presets, null, 2));

        // 2. Save Games
        const gamesDir = path.join(dir, 'games');
        if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir);

        // Clean directory (delete old files to handle game deletions)
        const existingFiles = fs.readdirSync(gamesDir);
        for (const file of existingFiles) {
            fs.unlinkSync(path.join(gamesDir, file));
        }

        const playlist = [];

        payload.games.forEach((game, i) => {
            game.sortOrder = (game.sortOrder !== undefined) ? game.sortOrder : (i * 10);

            playlist.push({
                gameId: game.id,
                enabled: game.enabled,
                order: i + 1
            });

            const gameFile = {
                id: game.id,
                type: game.type,
                sortOrder: game.sortOrder,
                schemaVersion: "2.9",
                content: game.content,
                scoring: game.scoring
            };
            fs.writeFileSync(path.join(gamesDir, `${game.id}.json`), JSON.stringify(gameFile, null, 2));
        });

        // 3. Save Manifest
        const manifest = {
            schemaVersion: "2.9",
            meta: payload.meta,
            playlist: playlist
        };
        manifest.meta.camporeeId = id;

        fs.writeFileSync(path.join(dir, 'camporee.json'), JSON.stringify(manifest, null, 2));

        console.log(`Saved Camporee: ${id} (${payload.meta.title})`);
        res.json({ success: true });

    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ error: "Save failed" });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Designer Server running at http://localhost:${PORT}`);
    console.log(`Storage Root: ${STORAGE_ROOT}`);
});