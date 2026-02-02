const { getContext } = require('./utils.cjs');

const gameId = "p2";
const gameName = "Kraken the First Aid Code";
const patrols = [
  {
    "name": "Skeleton Fishing",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Spooky Shrimp",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Shadow Panther",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "Cold Flames",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Jackalopes",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Flaming Flamingoes",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Eaglez",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Inferno Sharks",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Grease Fires",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Shampoo Drinkers",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "Chunky Monkeys",
    "scores": {
      "patrol_flag": 8
    }
  },
  {
    "name": "Atomic Duckies",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Ducks",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Raptors",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Dark Dragons",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Orcas",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Eggos",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Card Board Boxes",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "Space Pirates",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "Lakshay's Bros",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "6'7ers",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Minions",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Fearless Foxes",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Krabbie Patties",
    "scores": {
      "patrol_flag": 4
    }
  },
  {
    "name": "Ice Dragons",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Wolf Warriors",
    "scores": {
      "patrol_flag": 5
    }
  },
  {
    "name": "Goofy Goobers",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "Fancy Frogs",
    "scores": {
      "patrol_flag": 6
    }
  },
  {
    "name": "Banana Ducks",
    "scores": {
      "patrol_flag": 7
    }
  },
  {
    "name": "Fearless Firebirds",
    "scores": {
      "patrol_flag": 9
    }
  },
  {
    "name": "Falcons",
    "scores": {
      "patrol_flag": 8
    }
  }
];
const fieldConfigs = [{"id":"time","label":"Time","type":"timed","audience":"judge","kind":"points"},{"id":"patrol_flag","label":"Patrol Flag?","sortOrder":1,"type":"range","min":0,"max":5,"defaultValue":0},{"id":"patrol_yell","label":"Patrol Yell?","sortOrder":2,"type":"range","min":0,"max":5,"defaultValue":0},{"id":"patrol_spirit","label":"Patrol Spirit","sortOrder":3,"type":"range","min":0,"max":5,"defaultValue":0},{"id":"unscoutlike","label":"Un-Scout-like Behavior (Penalty)","sortOrder":998,"type":"number","min":0,"max":100,"helperText":"Enter POSITIVE number to deduct points","defaultValue":0},{"id":"judge_notes","label":"Judge Notes / Comments","sortOrder":999,"type":"textarea","placeholder":"Optional notes on performance..."}];

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
        const dialogHandler = async dialog => { await dialog.accept(); };
        page.on('dialog', dialogHandler);
        await page.click('#btn-submit');

        // Wait for page to navigate back to station list
        await sleep(waitTime * 2);
        page.off('dialog', dialogHandler);
    }

    await finish();
}

run().catch(console.error);
