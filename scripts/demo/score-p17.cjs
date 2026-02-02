const { getContext } = require('./utils.cjs');

const gameId = "p17";
const gameName = "Racing Against the Tide";
const patrols = [
  {
    "name": "Skeleton Fishing",
    "scores": {
      "timed": 0.05694444444444444
    }
  },
  {
    "name": "Eaglez",
    "scores": {
      "timed": 0.05763888888888889
    }
  },
  {
    "name": "Inferno Sharks",
    "scores": {
      "timed": 0.059722222222222225
    }
  },
  {
    "name": "Ducks",
    "scores": {
      "timed": 0.05416666666666667
    }
  },
  {
    "name": "Dark Dragons",
    "scores": {
      "timed": 0.10069444444444445
    }
  },
  {
    "name": "Orcas",
    "scores": {
      "timed": 0.05694444444444444
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "timed": 0.05486111111111111
    }
  },
  {
    "name": "Card Board Boxes",
    "scores": {
      "timed": 0.0625
    }
  },
  {
    "name": "Space Pirates",
    "scores": {
      "timed": ":56"
    }
  },
  {
    "name": "Lakshay's Bros",
    "scores": {
      "timed": ":50"
    }
  },
  {
    "name": "Minions",
    "scores": {
      "timed": 0.06319444444444444
    }
  },
  {
    "name": "Goofy Goobers",
    "scores": {
      "timed": 0.07013888888888889
    }
  },
  {
    "name": "Banana Ducks",
    "scores": {
      "timed": 0.04375
    }
  },
  {
    "name": "Krabbie Patties",
    "scores": {
      "timed": 0.044444444444444446
    }
  },
  {
    "name": "Ice Dragons",
    "scores": {
      "timed": 0.052083333333333336
    }
  },
  {
    "name": "Wolf Warriors",
    "scores": {
      "timed": 0.08680555555555555
    }
  },
  {
    "name": "Falcons",
    "scores": {
      "timed": ":46"
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
