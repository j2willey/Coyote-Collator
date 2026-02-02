const { getContext } = require('./utils.cjs');

const gameId = "p12";
const gameName = "Stepping Shells";
const patrols = [
  {
    "name": "Spooky Shrimp",
    "scores": {
      "patrol_sprirt": 5,
      "timed": "DNF"
    }
  },
  {
    "name": "Eaglez",
    "scores": {
      "patrol_sprirt": 4,
      "timed": 0.9270833333333334
    }
  },
  {
    "name": "Chunky Monkeys",
    "scores": {
      "patrol_sprirt": 5,
      "timed": 0.5
    }
  },
  {
    "name": "Raptors",
    "scores": {
      "patrol_sprirt": 4,
      "timed": 0.6881944444444444
    }
  },
  {
    "name": "Orcas",
    "scores": {
      "patrol_sprirt": 5,
      "timed": 0.6458333333333334
    }
  },
  {
    "name": "Ice Dragons",
    "scores": {
      "patrol_sprirt": 5,
      "timed": 0.5763888888888888
    }
  },
  {
    "name": "Fearless Firebirds",
    "scores": {
      "patrol_sprirt": 5,
      "timed": 0.8395833333333333
    }
  },
  {
    "name": "Falcons",
    "scores": {
      "patrol_sprirt": 5,
      "timed": 0.6375
    }
  }
];
const fieldConfigs = [{"id":"patrol_sprirt","label":"Patrol Sprirt","type":"number","audience":"judge","kind":"points"},{"id":"timed","label":"Time\nmm:ss","type":"timed","audience":"judge","kind":"points"}];

async function run() {
    const { page, waitTime, sleep, finish, startDemo } = await getContext({ mobile: true });

    await startDemo();
    await sleep(waitTime);

    for (const p of patrols) {
        console.log(`--- Scoring Patrol: ${p.name} ---`);

        // 1. Select Game
        console.log(`Selecting Game ${gameId} (${gameName})...`);
        await page.click(`button:has-text("${gameName}")`);
        await sleep(waitTime);

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
            // Add tiny delay so it doesn't flash
            await new Promise(r => setTimeout(r, 400));
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
