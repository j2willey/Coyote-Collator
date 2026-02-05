const { getContext } = require('./utils.cjs');

const gameId = "p14";
const gameName = "Mermaid Tails";
const judgeInfo = {
    name: "Demo Judge 6",
    email: "demojudge6@acme.com",
    unit: "District"
};
const patrols = [
  {
    "name": "Flaming Flamingoes",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 78,
      "time_points": 30
    }
  },
  {
    "name": "Atomic Duckies",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 98,
      "time_points": 30
    }
  },
  {
    "name": "Raptors",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 93,
      "time_points": 30
    }
  },
  {
    "name": "Dark Dragons",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 97,
      "time_points": 30
    }
  },
  {
    "name": "Eggos",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 88,
      "time_points": 30
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 94,
      "time_points": 30
    }
  },
  {
    "name": "Card Board Boxes",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 98,
      "time_points": 30
    }
  },
  {
    "name": "Space Pirates",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 97,
      "time_points": 30
    }
  },
  {
    "name": "6'7ers",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 98,
      "time_points": 30
    }
  },
  {
    "name": "Minions",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 88,
      "time_points": 30
    }
  },
  {
    "name": "Fancy Frogs",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 89,
      "time_points": 30
    }
  },
  {
    "name": "Banana Ducks",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 94,
      "time_points": 30
    }
  },
  {
    "name": "Krabbie Patties",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 99,
      "time_points": 30
    }
  },
  {
    "name": "Ice Dragons",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 94,
      "time_points": 30
    }
  },
  {
    "name": "Fearless Firebirds",
    "scores": {
      "patrol_sprirt": 5,
      "knot_correctly_tied": 99,
      "time_points": 30
    }
  }
];
const fieldConfigs = [{"id":"patrol_sprirt","label":"Patrol Sprirt","type":"number","audience":"judge","kind":"points"},{"id":"knot_correctly_tied","label":"Knot correctly tied","type":"number","audience":"judge","kind":"points"},{"id":"knot_rationale","label":"Knot Rationale","type":"number","audience":"judge","kind":"points"},{"id":"time_points","label":"Time Points","type":"timed","audience":"judge","kind":"points"}];

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
