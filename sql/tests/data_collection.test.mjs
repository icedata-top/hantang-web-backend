// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/data_collection.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/DataCollectionDao.java', import.meta.url), 'utf8');
function sqlFor(name) {
  const template = source.match(new RegExp(`\\b${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?query\\.apply\\("""([\\s\\S]*?)"""`))[1];
  let i = 0;
  return template.replaceAll('?', () => `$${++i}`);
}
let passed = 0;
async function test(name, run) { await run(); console.log(`PASS ${name}`); passed++; }
const range = ['2026-11-04', '2026-11-10'];
try {
  await db.exec(`CREATE SCHEMA hantang_dynamic;
    CREATE TABLE hantang_dynamic.video_daily(record_date date NOT NULL,aid bigint NOT NULL);
    CREATE TABLE hantang_dynamic.processed_videos(aid bigint);
    SET TIME ZONE 'America/Los_Angeles';`);
  await test('the production presence query emits seven explicit missing dates for an empty table', async () => {
    const rows = (await db.query(sqlFor('dailyPresence'), range)).rows;
    assert.equal(rows.length, 7);
    assert.equal(rows[0].date, range[0]);
    assert.equal(rows[6].date, range[1]);
    assert.ok(rows.every(row => row.has_data === false));
    assert.deepEqual((await db.query(sqlFor('dailyCounts'), range)).rows, []);
  });
  await db.exec(`INSERT INTO hantang_dynamic.video_daily VALUES
    ('2026-11-03',1),('2026-11-04',1),('2026-11-04',2),('2026-11-10',3),('2026-11-11',4);`);
  await test('the production count query is bounded, counts actual rows, and keeps calendar gaps', async () => {
    const presence = (await db.query(sqlFor('dailyPresence'), range)).rows;
    assert.deepEqual(presence.filter(row => row.has_data).map(row => row.date), ['2026-11-04', '2026-11-10']);
    const counts = (await db.query(sqlFor('dailyCounts'), range)).rows;
    assert.deepEqual(counts.map(row => [row.date, Number(row.rows)]), [['2026-11-04', 2], ['2026-11-10', 1]]);
  });
  await test('metadata reports actual columns, unknown estimates, and missing tables without inventing timestamps', async () => {
    const rows = (await db.query(sqlFor('metadata'), ['hantang_dynamic.processed_videos'])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].columns, 'aid');
    assert.equal(rows[0].estimated_rows, null);
    assert.deepEqual((await db.query(sqlFor('metadata'), ['hantang_dynamic.absent'])).rows, []);
  });
  console.log(`${passed} collection SQL checks passed`);
} finally { await db.close(); }
