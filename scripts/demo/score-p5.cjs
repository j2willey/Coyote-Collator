const { getContext } = require('./utils.cjs');

const gameId = "p5";
const gameName = "Catch Fish Fry Fly";
const patrols = [
  {
    "name": "Spooky Shrimp",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 10,
      "fully_cook_pancake": 5,
      "catch_eat": 5,
      "wash_and_clean_up": 8,
      "sum": 53,
      "timed": 0.3298611111111111
    }
  },
  {
    "name": "Eaglez",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 4,
      "pancake_resembles_fish": 6,
      "fully_cook_pancake": 2,
      "catch_eat": 10,
      "wash_and_clean_up": 10,
      "sum": 53,
      "timed": 0.2152777777777778
    }
  },
  {
    "name": "Shampoo Drinkers",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 4,
      "pancake_resembles_fish": 10,
      "fully_cook_pancake": 5,
      "catch_eat": 10,
      "wash_and_clean_up": 9,
      "sum": 62,
      "timed": 0.26944444444444443
    }
  },
  {
    "name": "Chunky Monkeys",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 3,
      "fully_cook_pancake": 4,
      "catch_eat": 5,
      "sum": 42,
      "timed": 0.25
    }
  },
  {
    "name": "Atomic Duckies",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 7,
      "fully_cook_pancake": 5,
      "catch_eat": 5,
      "wash_and_clean_up": 10,
      "sum": 59,
      "timed": 0.24444444444444444
    }
  },
  {
    "name": "Raptors",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 2,
      "fully_cook_pancake": 5,
      "catch_eat": 5,
      "wash_and_clean_up": 10,
      "sum": 54,
      "timed": 0.15347222222222223
    }
  },
  {
    "name": "Orcas",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 4,
      "pancake_resembles_fish": 8,
      "fully_cook_pancake": 5,
      "catch_eat": 10,
      "wash_and_clean_up": 10,
      "sum": 66,
      "timed": 0.18472222222222223
    }
  },
  {
    "name": "Eggos",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 4,
      "fully_cook_pancake": 5,
      "catch_eat": 2,
      "wash_and_clean_up": 8,
      "sum": 40,
      "timed": 0.2013888888888889
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 8,
      "fully_cook_pancake": 5,
      "catch_eat": 10,
      "wash_and_clean_up": 8,
      "sum": 61,
      "timed": 0.3055555555555556
    }
  },
  {
    "name": "Card Board Boxes",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 10,
      "fully_cook_pancake": 5,
      "catch_eat": 10,
      "sum": 60,
      "timed": 0.27847222222222223
    }
  },
  {
    "name": "Space Pirates",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 5,
      "fully_cook_pancake": 5,
      "catch_eat": 10,
      "wash_and_clean_up": 4,
      "sum": 59,
      "timed": 0.3055555555555556
    }
  },
  {
    "name": "Banana Ducks",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 5,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 7,
      "fully_cook_pancake": 5,
      "catch_eat": 9,
      "wash_and_clean_up": 10,
      "sum": 66,
      "timed": 0.15555555555555556
    }
  },
  {
    "name": "Fearless Foxes",
    "scores": {
      "mix_batter": 5,
      "prep_skillet": 3,
      "batter_into_skillet": 5,
      "pancake_resembles_fish": 2,
      "fully_cook_pancake": 5,
      "catch_eat": 2,
      "wash_and_clean_up": 10,
      "sum": 47,
      "timed": 0.29305555555555557
    }
  }
];
const fieldConfigs = [{"id":"mix_batter","label":"Mix batter","type":"number","audience":"judge","kind":"points"},{"id":"prep_skillet","label":"prep skillet","type":"number","audience":"judge","kind":"points"},{"id":"batter_into_skillet","label":"batter into skillet","type":"number","audience":"judge","kind":"points"},{"id":"pancake_resembles_fish","label":"Pancake resembles Fish","type":"number","audience":"judge","kind":"points"},{"id":"fully_cook_pancake","label":"Fully Cook Pancake","type":"number","audience":"judge","kind":"points"},{"id":"catch_eat","label":"Catch & Eat....","type":"number","audience":"judge","kind":"points"},{"id":"wash_and_clean_up","label":"Wash and Clean up","type":"number","audience":"judge","kind":"points"},{"id":"sum","label":"SUM","type":"number","audience":"judge","kind":"points"},{"id":"timed","label":"Time\nmm:ss","type":"timed","audience":"judge","kind":"points"}];

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
