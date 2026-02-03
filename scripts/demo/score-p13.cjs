const { getContext } = require('./utils.cjs');

const gameId = "p13";
const gameName = "Underwater Treasure Hunt";
const patrols = [
  {
    "name": "Skeleton Fishing",
    "scores": {
      "finds": 51
    }
  },
  {
    "name": "Eaglez",
    "scores": {
      "finds": 40
    }
  },
  {
    "name": "Chunky Monkeys",
    "scores": {
      "finds": 56
    }
  },
  {
    "name": "Atomic Duckies",
    "scores": {
      "finds": 52
    }
  },
  {
    "name": "Ducks",
    "scores": {
      "finds": 57
    }
  },
  {
    "name": "Raptors",
    "scores": {
      "finds": 50
    }
  },
  {
    "name": "Dark Dragons",
    "scores": {
      "finds": 50
    }
  },
  {
    "name": "Orcas",
    "scores": {
      "finds": 57
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "finds": 50
    }
  },
  {
    "name": "Card Board Boxes",
    "scores": {
      "finds": 53
    }
  },
  {
    "name": "Lakshay's Bros",
    "scores": {
      "finds": 55
    }
  },
  {
    "name": "Minions",
    "scores": {
      "finds": 55
    }
  },
  {
    "name": "Fancy Frogs",
    "scores": {
      "finds": 43
    }
  },
  {
    "name": "Banana Ducks",
    "scores": {
      "finds": 54
    }
  },
  {
    "name": "Fearless Firebirds",
    "scores": {
      "finds": 34
    }
  },
  {
    "name": "Falcons",
    "scores": {
      "finds": 56
    }
  }
];
const fieldConfigs = [{"id":"Teamwork","label":"Teamwork","type":"number","audience":"judge","kind":"points"},{"id":"finds","label":"finds","type":"number","audience":"judge","kind":"points"}];

async function run() {
    const { page, waitTime, sleep, finish, startDemo } = await getContext({ mobile: true });

    await startDemo();
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
