const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

async function run() {
    console.log(`${yellow}Starting Demo Rebuild...${reset}`);

    try {
        // 0. Regenerate Score Scripts (to ensure they have latest logic/data)
        console.log(`\n${yellow}Step 0: Regenerating Score Scripts...${reset}`);
        execSync('node scripts/demo/generate-score-scripts.cjs', { stdio: 'inherit' });

        // 1. Clear the Database via Admin API
        console.log(`\n${yellow}Step 1: Clearing Database via API...${reset}`);
        // We use fetch (Node 18+) to hit the server's reset endpoint
        // This avoids better-sqlite3 native binding issues in the host terminal
        const response = await fetch('http://localhost:3000/api/admin/full-reset', { method: 'DELETE' });
        if (!response.ok) {
            throw new Error(`Failed to reset database: ${response.statusText}`);
        }
        const result = await response.json();
        console.log(`${green}${result.message || 'Database cleared.'}${reset}`);

        // 2. Run Seed Roster
        console.log(`\n${yellow}Step 2: Seeding Roster...${reset}`);
        execSync('node scripts/demo/seed-roster.cjs', { stdio: 'inherit' });
        console.log(`${green}Roster seeded successfully.${reset}`);

        // 3. Run all Score scripts
        console.log(`\n${yellow}Step 3: Running Score Scripts...${reset}`);
        const files = fs.readdirSync(__dirname);
        const scoreScripts = files.filter(f => f.startsWith('score-p') && f.endsWith('.cjs')).sort();

        for (const script of scoreScripts) {
            console.log(`\n${yellow}Running ${script}...${reset}`);
            // Use --wait=0.1 for faster execution since it's a mass rebuild
            execSync(`node scripts/demo/${script} --wait=0.1`, { stdio: 'inherit' });
            console.log(`${green}${script} completed.${reset}`);
        }

        console.log(`\n${green}✨ Demo Rebuild Complete! ✨${reset}`);

    } catch (error) {
        console.error(`\n${red}❌ Error during rebuild:${reset}`);
        console.error(error.message);
        process.exit(1);
    }
}

run();
