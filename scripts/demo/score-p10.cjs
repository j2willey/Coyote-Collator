const { getContext } = require('./utils.cjs');

const gameId = "p10";
const gameName = "Ladder Lashing";
const judgeInfo = {
    name: "Demo Judge 2",
    email: "demojudge2@acme.com",
    unit: "Troop 805"
};
const patrols = [
  {
    "name": "Skeleton Fishing",
    "scores": {
      "uniformly_spaced": 3,
      "proper_lashings_2_ea_20_pt": 20,
      "tight_and_sturdy": 5,
      "spirited_celebration": 5,
      "disassemble_ladder_stack_materials": 5,
      "timed": "22:36"
    }
  },
  {
    "name": "Dark Dragons",
    "scores": {
      "proper_lashings_2_ea_20_pt": 6,
      "tight_and_sturdy": 1,
      "secured_to_anchor_post": 2,
      "all_patrol_members_complete_the_climb_within_time_limit": 2,
      "spirited_celebration": 5,
      "disassemble_ladder_stack_materials": 5,
      "more_than_one_scout_on_ladder_at_a_time_5_pt_each_instance": -5,
      "timed": "15:33"
    }
  },
  {
    "name": "Wolves",
    "scores": {
      "uniformly_spaced": 3,
      "proper_lashings_2_ea_20_pt": 20,
      "tight_and_sturdy": 3,
      "spirited_celebration": 5,
      "disassemble_ladder_stack_materials": 5,
      "more_than_one_scout_on_ladder_at_a_time_5_pt_each_instance": -10,
      "timed": "17:04"
    }
  },
  {
    "name": "Space Pirates",
    "scores": {
      "ascending_order": 5,
      "uniformly_spaced": 4,
      "proper_lashings_2_ea_20_pt": 30,
      "tight_and_sturdy": 2,
      "secured_to_anchor_post": 5,
      "all_patrol_members_complete_the_climb_within_time_limit": 5,
      "spirited_celebration": 4,
      "disassemble_ladder_stack_materials": 3,
      "more_than_one_scout_on_ladder_at_a_time_5_pt_each_instance": -10,
      "timed": "9:24"
    }
  },
  {
    "name": "Wolf Warriors",
    "scores": {
      "ascending_order": 5,
      "uniformly_spaced": 5,
      "proper_lashings_2_ea_20_pt": 40,
      "tight_and_sturdy": 5,
      "secured_to_anchor_post": 5,
      "all_patrol_members_complete_the_climb_within_time_limit": 5,
      "spirited_celebration": 5,
      "disassemble_ladder_stack_materials": 5,
      "more_than_one_scout_on_ladder_at_a_time_5_pt_each_instance": -5,
      "timed": "13:03"
    }
  },
  {
    "name": "Fearless Foxes",
    "scores": {
      "ascending_order": 5,
      "uniformly_spaced": 5,
      "proper_lashings_2_ea_20_pt": 40,
      "tight_and_sturdy": 5,
      "spirited_celebration": 5,
      "disassemble_ladder_stack_materials": 5,
      "timed": "30:02"
    }
  },
  {
    "name": "Falcons",
    "scores": {
      "ascending_order": 5,
      "uniformly_spaced": 4,
      "proper_lashings_2_ea_20_pt": 40,
      "tight_and_sturdy": 3,
      "secured_to_anchor_post": 5,
      "all_patrol_members_complete_the_climb_within_time_limit": 5,
      "spirited_celebration": 5,
      "disassemble_ladder_stack_materials": 4,
      "more_than_one_scout_on_ladder_at_a_time_5_pt_each_instance": -10,
      "timed": "11:57"
    }
  }
];
const fieldConfigs = [{"id":"ascending_order","label":"ascending order","type":"number","audience":"judge","kind":"points"},{"id":"uniformly_spaced","label":"uniformly spaced","type":"number","audience":"judge","kind":"points"},{"id":"proper_lashings_2_ea_20_pt","label":"Proper lashings\n(2 ea × 20 pt)","type":"number","audience":"judge","kind":"points"},{"id":"tight_and_sturdy","label":"tight and sturdy","type":"number","audience":"judge","kind":"points"},{"id":"secured_to_anchor_post","label":"secured to anchor post","type":"number","audience":"judge","kind":"points"},{"id":"all_patrol_members_complete_the_climb_within_time_limit","label":"All patrol members complete the climb within time limit","type":"timed","audience":"judge","kind":"points"},{"id":"spirited_celebration","label":"Spirited celebration","type":"number","audience":"judge","kind":"points"},{"id":"disassemble_ladder_stack_materials","label":"Disassemble ladder, \nstack materials","type":"number","audience":"judge","kind":"points"},{"id":"more_than_one_scout_on_ladder_at_a_time_5_pt_each_instance","label":"More than one Scout\non ladder at a time \n(-5 pt each instance)","type":"timed","audience":"judge","kind":"points"},{"id":"timed","label":"Time\nmm:ss","type":"timed","audience":"judge","kind":"points"}];

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
