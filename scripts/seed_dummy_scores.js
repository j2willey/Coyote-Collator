import Database from 'better-sqlite3';
import path from 'path';
import { randomUUID } from 'crypto';

// Connect to DB
const dbPath = path.join(process.cwd(), 'data', 'camporee.db');
const db = new Database(dbPath);

console.log('🌱 Seeding dummy scores...');

try {
    // 1. Ensure we have a Judge
    // We need a judge to attach scores to, or the Foreign Key constraint will fail.
    const judgeInfo = db.prepare(`
        INSERT INTO judges (name, email, unit)
        VALUES ('Judge Dredd', 'dredd@mega-city.com', 'Hall of Justice')
        ON CONFLICT(email) DO UPDATE SET name=name
        RETURNING id
    `).get();

    const judgeId = judgeInfo.id;
    console.log(`   Using Judge ID: ${judgeId}`);

    // 2. Get some Entities (Patrols)
    const entities = db.prepare("SELECT id, name FROM entities WHERE type='patrol' LIMIT 5").all();

    if (entities.length === 0) {
        throw new Error("No patrols found! Run 'npm run import:roster' first.");
    }

    // 3. Insert Scores
    const insertScore = db.prepare(`
        INSERT INTO scores (uuid, game_id, entity_id, score_payload, timestamp, judge_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    let count = 0;

    // START LOOP
    entities.forEach(entity => {
        const payload = JSON.stringify({
            attempt_friction_fire: Math.floor(Math.random() * 5) + 1,
            ignite_tinder: Math.floor(Math.random() * 5) + 1,
            water_boils: Math.floor(Math.random() * 5) + 1,
            judge_notes: "Automatically seeded demo score."
        });

        insertScore.run(
            randomUUID(),
            'p1',
            entity.id,
            payload,
            Date.now(),
            judgeId
        );
        count++;
    });
    // END LOOP (This brace was likely missing or mismatched)

    console.log(`✅ Successfully seeded ${count} dummy scores.`);

} catch (err) { // END TRY
    console.error('❌ Seeding failed:', err);
}