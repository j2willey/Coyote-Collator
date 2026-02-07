const { getContext } = require('./utils.cjs');

const gameId = "p9";
const gameName = "Hook Line and Stretcher";
const judgeInfo = {
    name: "Demo Judge 21",
    email: "demojudge21@acme.com",
    unit: "Troop 353"
};
const patrols = [
  {
    "name": "Inferno Sharks",
    "scores": {
      "patrol_flag": 1,
      "patrol_yell": 3,
      "patrol_sprirt": 5,
      "stretcher_runs_distance_laps_decimals_ok": 6
    }
  },
  {
    "name": "Atomic Duckies",
    "scores": {
      "patrol_flag": 2,
      "patrol_yell": 5,
      "patrol_sprirt": 4,
      "stretcher_runs_distance_laps_decimals_ok": 15
    }
  },
  {
    "name": "Ducks",
    "scores": {
      "patrol_flag": 4,
      "patrol_yell": 4,
      "patrol_sprirt": 5,
      "stretcher_runs_distance_laps_decimals_ok": 11,
      "bonus_for_scout_sea_worthy_puns_jokes": 5
    }
  },
  {
    "name": "Krabbie Patties",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "patrol_sprirt": 5,
      "stretcher_runs_distance_laps_decimals_ok": 7,
      "bonus_for_scout_sea_worthy_puns_jokes": 7
    }
  },
  {
    "name": "Ice Dragons",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "patrol_sprirt": 5,
      "stretcher_runs_distance_laps_decimals_ok": 4
    }
  },
  {
    "name": "Wolf Warriors",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "patrol_sprirt": 5,
      "stretcher_runs_distance_laps_decimals_ok": 12,
      "bonus_for_scout_sea_worthy_puns_jokes": 7
    }
  }
];
const fieldConfigs = [{"id":"patrol_flag","label":"Patrol Flag?","audience":"judge","sortOrder":1,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"patrol_yell","label":"Patrol Yell?","audience":"judge","sortOrder":2,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"patrol_spirit","label":"Patrol Spirit","audience":"judge","sortOrder":3,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"patrol_sprirt","label":"Patrol Sprirt","audience":"judge","sortOrder":900,"config":{},"type":"number","kind":"points","weight":1},{"id":"stretcher_runs_distance_laps_decimals_ok","label":"Stretcher Runs/ Distance (laps, Decimals OK)","audience":"judge","sortOrder":900,"config":{},"type":"number","kind":"points","weight":1},{"id":"bonus_for_scout_sea_worthy_puns_jokes","label":"BONUS for Scout Sea worthy Puns/Jokes","audience":"judge","sortOrder":900,"config":{},"type":"number","kind":"points","weight":1},{"id":"unscoutlike","label":"Un-Scout-like Behavior (Penalty)","audience":"judge","sortOrder":998,"config":{"min":0,"max":100,"defaultValue":0},"type":"number","kind":"penalty","weight":-1},{"id":"judge_notes","label":"Judge Notes / Comments","audience":"judge","sortOrder":999,"config":{"placeholder":"Optional notes on performance..."},"type":"textarea","kind":"metric","weight":0}];

async function run() {
    const { page, waitTime, sleep, finish, startDemo } = await getContext({ mobile: true });

    await startDemo();
    await sleep(waitTime);

    // 0. Set Judge Info
    console.log(`Setting Judge Info: ${judgeInfo.name} (${judgeInfo.unit})`);

    const isModalHidden = await page.evaluate(() => {
        const el = document.getElementById('judge-modal');
        return el ? el.classList.contains('hidden') : true;
    });

    if (isModalHidden) {
        await page.click('#judge-profile-btn');
        await sleep(waitTime / 2);
    }

    await page.fill('#judge-name', judgeInfo.name);
    await page.fill('#judge-email', judgeInfo.email);
    await page.fill('#judge-unit', judgeInfo.unit);

    // Click Save (try button, fallback to JS)
    const saveBtn = await page.$('#judge-modal button.btn-primary');
    if (saveBtn) await saveBtn.click();
    else await page.evaluate(() => app.saveJudgeInfo());
    await sleep(waitTime);

    // 1. Select Game (Only once, app returns to entity list after submit)
    console.log(`Selecting Game ${gameId} (${gameName})...`);
    await page.click(`button:has-text("${gameName}")`);
    await sleep(waitTime);

    for (const p of patrols) {
        console.log(`--- Scoring Patrol: ${p.name} ---`);

        // 2. Select Patrol
        console.log(`Selecting Patrol ${p.name}...`);
        await page.click(`div.list-group-item:has-text("${p.name}")`);
        await sleep(waitTime);

        // 3. Fill Scores
        console.log(`Filling scores for ${p.name}...`);
        for (const [fieldId, val] of Object.entries(p.scores)) {
            const field = fieldConfigs.find(f => f.id === fieldId);
            if (!field) continue;
            if (field.audience === 'admin') continue; // Judges can't see/fill admin fields

            if (field.type === 'timed' || field.type === 'stopwatch') {
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
                await page.fill(`#f_${fieldId}_mm`, mm);
                await page.fill(`#f_${fieldId}_ss`, ss);
            } else if (field.type === 'boolean') {
                await page.fill(`#f_${fieldId}`, val === true || val === 'true' || val === 1 ? '1' : '0');
            } else if (field.type === 'number') {
                let cleanVal = String(val).trim();
                let num = parseFloat(cleanVal);
                if (isNaN(num)) {
                    // Common convention: 'x' means 1 or 'checked'
                    if (cleanVal.toLowerCase() === 'x') num = 1;
                    else {
                        // Try to extract first number found (e.g. "5 pts" -> 5)
                        const match = cleanVal.match(/\d+/); // Double escaped for template string
                        num = match ? parseInt(match[0]) : 0;
                    }
                }
                // Also handle cases where a space or negative sign might be weird
                await page.fill(`#f_${fieldId}`, String(Math.max(0, num)));
            } else {
                await page.fill(`#f_${fieldId}`, String(val));
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
