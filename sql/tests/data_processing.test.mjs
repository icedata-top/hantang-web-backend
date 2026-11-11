// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/data_processing.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/DataProcessingDao.java', import.meta.url), 'utf8');
const bind = sql => { let index = 0; return sql.replaceAll('?', () => `$${++index}`); };
function sqlFor(name) {
  return bind(source.match(new RegExp(`\\b${name}\\([^)]*\\)\\s*\\{[\\s\\S]*?query\\.apply\\("""([\\s\\S]*?)"""`))[1]);
}
const jobsSql = [...source.slice(source.indexOf('String sql = history')).matchAll(/"""([\s\S]*?)"""/g)].map(match => bind(match[1]));
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
try {
  await db.exec(`CREATE SCHEMA hantang_dynamic; CREATE SCHEMA cron;
    CREATE TABLE hantang_dynamic.adm_uniseek_videos(aid bigint,record_date date,batch_id uuid,refreshed_at timestamptz);
    CREATE TABLE hantang_dynamic.adm_entity_metrics_daily(stat_date date,batch_id uuid,is_complete boolean,computed_at timestamptz);
    CREATE TABLE hantang_dynamic.adm_aggregation_task(stat_date date,status text,attempt_count integer,max_attempts integer,started_at timestamptz,finished_at timestamptz,updated_at timestamptz);
    CREATE TABLE hantang_dynamic.adm_uniseek_refresh_state(singleton boolean,requested_record_date date,published_record_date date,requested_batch_id uuid,published_batch_id uuid);
    CREATE TABLE cron.job(jobid bigint,jobname text,schedule text,active boolean,database text,command text);
    CREATE TABLE cron.job_run_details(runid bigint,jobid bigint,status text,start_time timestamptz,end_time timestamptz);`);
  await test('full snapshots report current rows and detect mixed dates and batches without history scans', async () => {
    assert.equal(Number((await db.query(sqlFor('searchSnapshot'))).rows[0].rows), 0);
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos VALUES
      (1,'2026-11-09','00000000-0000-0000-0000-000000000001','2026-11-10T01:00:00Z'),
      (2,'2026-11-09','00000000-0000-0000-0000-000000000001','2026-11-10T01:00:00Z');`);
    const first = (await db.query(sqlFor('searchSnapshot'))).rows[0];
    assert.equal(Number(first.rows), 2); assert.equal(Number(first.batches), 1);
    assert.equal(first.data_date, '2026-11-09'); assert.equal(first.updated_at, '2026-11-10T01:00:00Z');
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos VALUES
      (3,'2026-11-10','00000000-0000-0000-0000-000000000002','2026-11-11T01:00:00Z');`);
    const mixed = (await db.query(sqlFor('searchSnapshot'))).rows[0];
    assert.equal(Number(mixed.batches), 2); assert.notEqual(mixed.first_date, mixed.data_date);
  });
  await test('daily replacement reports only the latest business day and preserves incompleteness', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_entity_metrics_daily VALUES
      ('2026-11-01','00000000-0000-0000-0000-000000000001',true,'2026-11-02T01:00:00Z'),
      ('2026-11-09','00000000-0000-0000-0000-000000000002',true,'2026-11-10T01:00:00Z'),
      ('2026-11-09','00000000-0000-0000-0000-000000000002',false,'2026-11-10T01:00:00Z');`);
    const row = (await db.query(sqlFor('aggregateSnapshot'))).rows[0];
    assert.equal(Number(row.rows), 2); assert.equal(row.data_date, '2026-11-09'); assert.equal(row.complete, false);
  });
  await test('latest task means latest update, including an older historical backfill', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_aggregation_task(stat_date,status,updated_at) VALUES
      ('2026-11-09','succeeded','2026-11-10T01:00:00Z'),('2026-11-01','failed','2026-11-11T01:00:00Z');`);
    const row = (await db.query(sqlFor('latestTask'))).rows[0];
    assert.equal(row.date, '2026-11-01'); assert.equal(row.status, 'failed');
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_refresh_state VALUES
      (true,'2026-11-10','2026-11-09','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001');`);
    assert.equal((await db.query(sqlFor('publication'))).rows[0].pending, true);
  });
  await test('cron inventory filters the target database, keeps jobs with no logs, and never returns commands', async () => {
    await db.exec(`INSERT INTO cron.job VALUES
      (1,'known','*/10 * * * *',true,current_database(),'private command'),
      (2,'no-history','*/5 * * * *',true,current_database(),'another private command'),
      (3,'outside','* * * * *',true,'another-database','outside');
      INSERT INTO cron.job_run_details VALUES
      (1,1,'succeeded','2026-11-10T01:00:00Z','2026-11-10T01:00:01Z'),
      (2,1,'failed','2026-11-11T01:00:00Z','2026-11-11T01:00:01Z');`);
    const jobs = (await db.query(jobsSql[0])).rows;
    assert.equal(jobs.length, 2); assert.equal(jobs[0].last_status, 'failed'); assert.equal(jobs[1].last_status, null);
    assert.equal(Object.hasOwn(jobs[0], 'command'), false);
    assert.equal((await db.query(jobsSql[1])).rows.length, 2);
  });
  await test('catalog observation distinguishes missing tables from denied schema and table privileges', async () => {
    await db.exec(`CREATE ROLE processing_viewer; GRANT USAGE ON SCHEMA hantang_dynamic TO processing_viewer;
      GRANT SELECT ON hantang_dynamic.adm_uniseek_videos TO processing_viewer; SET ROLE processing_viewer;`);
    try {
      assert.equal((await db.query(sqlFor('metadata'), ['hantang_dynamic', 'adm_uniseek_videos'])).rows[0].readable, true);
      assert.equal((await db.query(sqlFor('metadata'), ['hantang_dynamic', 'adm_entity_metrics_daily'])).rows[0].readable, false);
      assert.equal((await db.query(sqlFor('metadata'), ['cron', 'job'])).rows[0].readable, false);
      assert.deepEqual((await db.query(sqlFor('metadata'), ['hantang_dynamic', 'missing'])).rows, []);
    } finally { await db.exec('RESET ROLE'); }
  });
  console.log(`${passed} processing SQL checks passed`);
} finally { await db.close(); }
