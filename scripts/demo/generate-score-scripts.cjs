const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const gamesDir = path.join(__dirname, '../../config/games');
const outputDir = __dirname;
const excelPath = path.join(__dirname, '../../patrol.xlsx');
const commonPath = path.join(__dirname, '../../config/common.json');

const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

const commonScoring = fs.existsSync(commonPath) ? JSON.parse(fs.readFileSync(commonPath, 'utf8')) : [];

if (!fs.existsSync(excelPath)) {
    console.error(`Excel file not found: ${excelPath}`);
    process.exit(1);
}

const workbook = XLSX.readFile(excelPath);
const files = fs.readdirSync(gamesDir);

files.forEach(file => {
    if (!file.startsWith('p') || !file.endsWith('.json')) return;

    const game = JSON.parse(fs.readFileSync(path.join(gamesDir, file), 'utf8'));
    const gameId = game.id;
    const gameName = game.name;
    const scriptPath = path.join(outputDir, `score-${gameId}.cjs`);

    // --- Excel Matching ---
    const normId = normalize(gameId);
    const normName = normalize(gameName);
    const sheetName = workbook.SheetNames.find(s => {
        const ns = normalize(s);
        return ns === normId || ns === normName || ns.includes(normId) || (ns.length > 2 && normId.startsWith(ns)) || (normId.length > 2 && ns.startsWith(normId));
    });

    if (!sheetName) {
        console.warn(`No sheet found for ${gameId}.`);
        return;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

    // Find Header Row
    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].some(c => c && (normalize(String(c)) === 'patrolname' || normalize(String(c)) === 'patrolid'))) {
            headerRowIdx = i;
            break;
        }
    }

    if (headerRowIdx === -1) return;

    const headers = rows[headerRowIdx];
    const patrolNameIdx = headers.findIndex(h => h && normalize(String(h)) === 'patrolname');
    const patrolIdIdx = headers.findIndex(h => h && normalize(String(h)) === 'patrolid');

    if (patrolNameIdx === -1 && patrolIdIdx === -1) return;

    // Map columns to fields
    const allFields = [...(game.fields || []), ...commonScoring];
    const fieldMap = [];
    headers.forEach((h, idx) => {
        if (!h) return;
        const normH = normalize(String(h));
        const field = allFields.find(f => normalize(f.id) === normH || normalize(f.label) === normH || (normH.length > 3 && normalize(f.label).includes(normH)));
        if (field) fieldMap.push({ colIdx: idx, field });
    });

    // Extract Patrol Data
    const patrolsToScore = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const name = row[patrolNameIdx] || row[patrolIdIdx];
        if (!name) continue;

        const scores = {};
        let hasAnyScore = false;
        fieldMap.forEach(({ colIdx, field }) => {
            const val = row[colIdx];
            if (val !== null && val !== undefined && val !== '' && val !== 0 && val !== '0') {
                hasAnyScore = true;
                scores[field.id] = val;
            }
        });

        if (hasAnyScore) {
            const normPName = normalize(String(name));
            if (!['maxpossible', 'score', 'total', 'place'].includes(normPName)) {
                patrolsToScore.push({ name: String(name).trim(), scores });
            }
        }
    }

    if (patrolsToScore.length === 0) return;

    const scriptContent = `const { getContext } = require('./utils.cjs');

const gameId = "${gameId}";
const gameName = "${gameName}";
const patrols = ${JSON.stringify(patrolsToScore, null, 2)};
const fieldConfigs = ${JSON.stringify(allFields)};

async function run() {
    const { page, waitTime, sleep, finish, startDemo } = await getContext({ mobile: true });

    await startDemo();
    await sleep(waitTime);

    for (const p of patrols) {
        console.log(\`--- Scoring Patrol: \${p.name} ---\`);

        // 1. Select Game
        console.log(\`Selecting Game \${gameId} (\${gameName})...\`);
        await page.click(\`button:has-text("\${gameName}")\`);
        await sleep(waitTime);

        // 2. Select Patrol
        console.log(\`Selecting Patrol \${p.name}...\`);
        await page.click(\`div.list-group-item:has-text("\${p.name}")\`);
        await sleep(waitTime);

        // 3. Fill Scores
        console.log(\`Filling scores for \${p.name}...\`);
        for (const [fieldId, val] of Object.entries(p.scores)) {
            const field = fieldConfigs.find(f => f.id === fieldId);
            if (!field) continue;
            if (field.audience === 'admin') continue; // Judges can't see/fill admin fields

            if (field.type === 'timed') {
                let mm = '00', ss = '00';
                if (typeof val === 'number') {
                    const totalSeconds = Math.round(val * 24 * 60 * 60);
                    mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
                    ss = String(totalSeconds % 60).padStart(2, '0');
                } else if (String(val).includes(':')) {
                    const parts = String(val).split(':');
                    mm = (parts[0] || '00').padStart(2, '0');
                    ss = (parts[1] || '00').padStart(2, '0');
                }
                await page.fill(\`#f_\${fieldId}_mm\`, mm);
                await page.fill(\`#f_\${fieldId}_ss\`, ss);
            } else if (field.type === 'boolean') {
                await page.fill(\`#f_\${fieldId}\`, val === true || val === 'true' || val === 1 ? '1' : '0');
            } else if (field.type === 'number') {
                let cleanVal = String(val).trim();
                let num = parseFloat(cleanVal);
                if (isNaN(num)) {
                    // Common convention: 'x' means 1 or 'checked'
                    if (cleanVal.toLowerCase() === 'x') num = 1;
                    else {
                        // Try to extract first number found (e.g. "5 pts" -> 5)
                        const match = cleanVal.match(/\\d+/); // Double escaped for template string
                        num = match ? parseInt(match[0]) : 0;
                    }
                }
                // Also handle cases where a space or negative sign might be weird
                await page.fill(\`#f_\${fieldId}\`, String(Math.max(0, num)));
            } else {
                await page.fill(\`#f_\${fieldId}\`, String(val));
            }
            await sleep(waitTime / 2);
        }

        // 4. Submit
        console.log("Submitting...");
        const dialogHandler = async dialog => {
            console.log(`  DIALOG [${dialog.type()}]: "${dialog.message()}"`);
            // Wait so the user can read the confirmation
            await new Promise(r => setTimeout(r, waitTime));
            await dialog.accept();
        };
        page.on('dialog', dialogHandler);
        await page.click('#btn-submit');

        // Wait for page to navigate back to station list
        await sleep(waitTime * 2);
        page.off('dialog', dialogHandler);
    }

    await finish();
}

run().catch(console.error);
`;

    fs.writeFileSync(scriptPath, scriptContent);
    console.log(`Generated ${scriptPath} with ${patrolsToScore.length} patrols.`);
});
