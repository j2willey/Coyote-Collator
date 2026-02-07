const { getContext } = require('./utils.cjs');

const gameId = "p1";
const gameName = "Boiling the Ocean";
const judgeInfo = {
    name: "Demo Judge 1",
    email: "demojudge1@acme.com",
    unit: "Troop 489"
};
const patrols = [
  {
    "name": "Spooky Shrimp",
    "scores": {
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 2,
      "matches_used_count": "x",
      "time_to_boil": 585
    }
  },
  {
    "name": "Shadow Panther",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 2,
      "ignite_kindling": 2,
      "extinguish_fire_reset": 5,
      "matches_used_count": 2
    }
  },
  {
    "name": "Grease Fires",
    "scores": {
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "extinguish_fire_reset": 5,
      "matches_used_count": 5
    }
  },
  {
    "name": "Shampoo Drinkers",
    "scores": {
      "patrol_flag": "  "
    }
  },
  {
    "name": "Ducks",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 5,
      "time_to_boil": 356
    }
  },
  {
    "name": "Raptors",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 3,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 4,
      "time_to_boil": 810
    }
  },
  {
    "name": "Eggos",
    "scores": {
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 5,
      "time_to_boil": 599
    }
  },
  {
    "name": "Card Board Boxes",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 5,
      "time_to_boil": 869
    }
  },
  {
    "name": "Space Pirates",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 5,
      "time_to_boil": 720
    }
  },
  {
    "name": "Krabbie Patties",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "water_boils": 5,
      "extinguish_fire_reset": 5,
      "matches_used_count": "2x",
      "time_to_boil": 385
    }
  },
  {
    "name": "Wolf Warriors",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 4,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 5,
      "extinguish_fire_reset": 5
    }
  },
  {
    "name": "Fearless Firebirds",
    "scores": {
      "patrol_flag": 5,
      "patrol_yell": 5,
      "attempt_friction_fire": 4,
      "charing_or_powder": 2,
      "smoke": 2,
      "ember": 2,
      "ignite_tinder": 5,
      "ignite_kindling": 3,
      "water_boils": 2,
      "extinguish_fire_reset": 4,
      "matches_used_count": 1
    }
  }
];
const fieldConfigs = [{"id":"patrol_flag","label":"Patrol Flag?","audience":"judge","sortOrder":1,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"patrol_yell","label":"Patrol Yell?","audience":"judge","sortOrder":2,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"patrol_spirit","label":"Patrol Spirit","audience":"judge","sortOrder":3,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"attempt_friction_fire","label":"Attempt Friction Fire","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"charing_or_powder","label":"charing or powder","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"smoke","label":"smoke","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"ember","label":"ember","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"ignite_tinder","label":"Ignite tinder","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"ignite_kindling","label":"ignite kindling","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"water_boils","label":"water boils","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"extinguish_fire_reset","label":"Extinguish fire & reset","audience":"judge","sortOrder":900,"config":{"min":0,"max":5,"defaultValue":0},"type":"number","kind":"points","weight":1},{"id":"matches_used_count","label":"Matches Used\n(Count)","audience":"judge","sortOrder":900,"config":{"min":0,"max":20,"defaultValue":0},"type":"number","kind":"metric","weight":0},{"id":"matches_score","label":"Matches points\n","audience":"admin","sortOrder":900,"config":{},"type":"number","kind":"points","weight":1},{"id":"time_to_boil","label":"Time to Boil or N.A.\n\nmm:ss","audience":"judge","sortOrder":900,"config":{},"type":"stopwatch","kind":"metric","weight":0},{"id":"time_to_boil_score","label":"Boil time Bonus","audience":"admin","sortOrder":900,"config":{},"type":"number","kind":"points","weight":1},{"id":"judges_points_calc","label":"Calculated Points","audience":"admin","sortOrder":900,"config":{},"type":"number","kind":"points","weight":1},{"id":"unscoutlike","label":"Un-Scout-like Behavior (Penalty)","audience":"judge","sortOrder":998,"config":{"min":0,"max":100,"defaultValue":0},"type":"number","kind":"penalty","weight":-1},{"id":"judge_notes","label":"Judge Notes / Comments","audience":"judge","sortOrder":999,"config":{"placeholder":"Optional notes on performance..."},"type":"textarea","kind":"metric","weight":0}];

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
