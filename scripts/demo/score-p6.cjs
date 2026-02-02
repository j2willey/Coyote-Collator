const { getContext } = require('./utils.cjs');

const gameId = "p6";
const gameName = "Compass Game";
const patrols = [
  {
    "name": "Spooky Shrimp",
    "scores": {
      "start": 10,
      "target_destination": 6,
      "distance_from_target": -5,
      "flag_height": -6,
      "vball_width": -5,
      "timed": 0.20833333333333334
    }
  },
  {
    "name": "Atomic Duckies",
    "scores": {
      "start": 7,
      "target_destination": 17,
      "distance_from_target": -13,
      "flag_height": -1.5,
      "vball_width": -4,
      "timed": 0.1875
    }
  },
  {
    "name": "Orcas",
    "scores": {
      "start": 10,
      "target_destination": 6,
      "distance_from_target": -8,
      "flag_height": -1,
      "vball_width": -1,
      "timed": 0.3958333333333333
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "start": 8,
      "target_destination": 16,
      "distance_from_target": -13,
      "flag_height": -2,
      "vball_width": -2.5,
      "timed": 0.22916666666666666
    }
  },
  {
    "name": "Goofy Goobers",
    "scores": {
      "start": 18,
      "target_destination": 5,
      "distance_from_target": -3,
      "flag_height": -0.5,
      "vball_width": -10,
      "timed": 0.3958333333333333
    }
  },
  {
    "name": "Fancy Frogs",
    "scores": {
      "start": 10,
      "target_destination": 6,
      "distance_from_target": -1,
      "flag_height": -3.5,
      "vball_width": -13.5,
      "timed": 0.4166666666666667
    }
  },
  {
    "name": "Ice Dragons",
    "scores": {
      "start": 10,
      "target_destination": 6,
      "distance_from_target": -9,
      "flag_height": -2,
      "vball_width": -3.5,
      "timed": 0.2916666666666667
    }
  },
  {
    "name": "Wolf Warriors",
    "scores": {
      "start": 10,
      "target_destination": 6,
      "distance_from_target": -6,
      "flag_height": -5,
      "vball_width": -2,
      "timed": 0.1527777777777778
    }
  },
  {
    "name": "Falcons",
    "scores": {
      "start": 10,
      "target_destination": 6,
      "distance_from_target": -8,
      "flag_height": -7,
      "vball_width": -5,
      "timed": 0.4166666666666667
    }
  }
];
const fieldConfigs = [{"id":"check_folder_column_info_change","label":"Check folder Column info change","type":"number","audience":"judge","kind":"points"},{"id":"start","label":"Start","type":"number","audience":"judge","kind":"points"},{"id":"target_destination","label":"Target Destination","type":"number","audience":"judge","kind":"points"},{"id":"distance_from_target","label":"Distance from \nTarget","type":"number","audience":"judge","kind":"points"},{"id":"flag_height","label":"Flag Height","type":"number","audience":"judge","kind":"points"},{"id":"vball_width","label":"Vball width","type":"number","audience":"judge","kind":"points"},{"id":"timed","label":"Time\nmm:ss","type":"timed","audience":"judge","kind":"points"},{"id":"time","label":"Time","type":"timed","audience":"judge","kind":"points"}];

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
