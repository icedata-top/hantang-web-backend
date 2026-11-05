// Isolated PostgreSQL via PGlite; never connects to the business database.
// PGLITE_MODULE_PATH=/tmp/uniseek-adm-sql-test/node_modules/@electric-sql/pglite/dist/index.js node sql/tests/adm_uniseek_videos.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const modulePath = process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite';
const { PGlite } = await import(modulePath);
const db = new PGlite();
const read = (name) => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const q = async (sql, parameters = []) => (await db.query(sql, parameters)).rows;
const one = async (sql, parameters = []) => (await q(sql, parameters))[0];
const confirm = (date = '2026-10-20', minimum = 1) => one(
  'SELECT hantang_dynamic.adm_confirm_uniseek_source_date($1::date, $2::bigint) AS batch', [date, minimum],
);
const refresh = () => q('CALL hantang_dynamic.adm_refresh_uniseek_videos()');
const publication = () => one(`SELECT published_record_date::text AS date, published_batch_id AS batch,
  published_at::text AS time, published_row_count AS count FROM hantang_dynamic.adm_uniseek_refresh_state`);
const snapshot = () => one(`SELECT jsonb_agg(to_jsonb(v) ORDER BY aid) AS data FROM hantang_dynamic.adm_uniseek_videos v`);
let passed = 0;
const test = async (name, run) => { await run(); passed += 1; console.log(`PASS ${name}`); };
async function unchangedOnFailure(pattern) {
  const before = await snapshot(), published = await publication();
  await assert.rejects(refresh, pattern);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await publication(), published);
}
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  const schema = await read('hantang_dynamic_schema.sql');
  await db.exec(schema.slice(schema.indexOf('CREATE TABLE hantang_dynamic.processed_videos'),
    schema.indexOf('CREATE TABLE hantang_dynamic.discovered_users')).replace('    like integer', '    "like" integer'));
  const compact = ['adm_uniseek_videos.sql', 'adm_uniseek_videos_refresh.sql'];
  const expected = (await Promise.all(compact.map(read))).flatMap((text) => text.split(/\r?\n/))
    .filter((line) => line.trim() && !line.trimStart().startsWith('--')).join('\n');
  const install = await read('adm_uniseek_videos_install.sql');
  assert.equal(install, `BEGIN;\n${expected}\nCOMMIT;\n`);
  assert.ok(install.trimEnd().split('\n').every((line) => line.trim()), 'direct-execution SQL must have no blank lines');
  assert.doesNotMatch(install, /CREATE EXTENSION|gin_trgm_ops/i);
  const continuation = await read('adm_uniseek_videos_continue.sql');
  const remaining = expected.slice(expected.indexOf('CREATE INDEX adm_uniseek_videos_tag_new_idx'));
  assert.equal(continuation, `BEGIN;\n${remaining}\nCOMMIT;\n`);
  await test('an already committed search table can finish installation without recreating it', async () => {
    const tableOnly = expected.slice(0, expected.indexOf('CREATE INDEX adm_uniseek_videos_tag_new_idx'));
    await db.exec(tableOnly);
    await db.exec(continuation);
    await refresh();
    assert.equal((await publication()).batch, null);
    await db.exec(`DROP PROCEDURE hantang_dynamic.adm_refresh_uniseek_videos();
      DROP FUNCTION hantang_dynamic.adm_confirm_uniseek_source_date(date,bigint);
      DROP TABLE hantang_dynamic.adm_uniseek_refresh_state, hantang_dynamic.adm_uniseek_videos;`);
  });
  await db.exec(install);
  await test('installation uses native indexes without pg_trgm; an unconfirmed cron tick is a no-op', async () => {
    assert.equal((await q(`SELECT indexname FROM pg_indexes WHERE schemaname='hantang_dynamic' AND tablename='adm_uniseek_videos'`)).length, 5);
    assert.equal((await q(`SELECT extname FROM pg_extension WHERE extname='pg_trgm'`)).length, 0);
    await refresh();
    assert.equal((await publication()).batch, null);
    assert.equal((await snapshot()).data, null);
  });
  await test('confirmation rejects absent, future, invalid minimum and incomplete control data', async () => {
    await assert.rejects(confirm(), /No video_daily rows/);
    await assert.rejects(confirm(null), /explicitly confirmed date/);
    await assert.rejects(confirm('2026-10-20', 0), /minimum_result_rows/);
    await assert.rejects(() => q(`SELECT hantang_dynamic.adm_confirm_uniseek_source_date(
      (clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date + 1)`), /future date/);
    await assert.rejects(() => db.exec(`UPDATE hantang_dynamic.adm_uniseek_refresh_state
      SET requested_record_date='2026-10-20', requested_batch_id=gen_random_uuid(), requested_at=now()`), /adm_uniseek_request_ck/);
  });
  await db.exec(`INSERT INTO hantang_dynamic.processed_videos (aid,bvid,title,pic,pubdate,user_id,is_filtered,is_deleted,tag_new,participle,label_singers) VALUES
    (1,'BV1','初音未来','https://example.com/1.jpg',100,10,false,false,ARRAY['初音'],NULL,ARRAY['初音未来']),
    (2,'BV2','100 favorites',NULL,NULL,NULL,false,false,NULL,NULL,NULL),
    (3,'BV3','0 favorites',NULL,NULL,NULL,false,false,NULL,NULL,NULL),
    (4,'BV4','NULL favorites',NULL,NULL,NULL,false,false,NULL,NULL,NULL),
    (5,'BV5','deleted',NULL,NULL,NULL,false,true,NULL,NULL,NULL),
    (6,'BV6','unknown deletion status',NULL,NULL,NULL,false,NULL,NULL,NULL,NULL),
    (7,'BV7','no selected-day snapshot',NULL,NULL,NULL,false,false,NULL,NULL,NULL),
    (8,'BV8','is_filtered is not a search predicate',NULL,NULL,NULL,true,false,NULL,ARRAY['test'],NULL);
    INSERT INTO hantang_dynamic.video_daily(record_date,aid,view,favorite,"like",coin,share,reply,danmaku) VALUES
    ('2026-10-19',1,999,999,999,999,999,999,999),('2026-10-19',7,999,999,999,999,999,999,999),
    ('2026-10-20',1,NULL,101,0,NULL,7,NULL,1),('2026-10-20',2,1,100,999,1,1,1,1),
    ('2026-10-20',3,1,0,999,1,1,1,1),('2026-10-20',4,1,NULL,999,1,1,1,1),
    ('2026-10-20',5,1,200,0,1,1,1,1),('2026-10-20',6,1,200,0,1,1,1,1),
    ('2026-10-20',8,0,102,NULL,0,NULL,0,NULL),('2026-10-20',99,1,200,0,1,1,1,1);`);
  await test('only 101+ favorites with zero or missing likes, explicit nondeleted metadata and the selected source day enter publication', async () => {
    const requested = await confirm();
    assert.equal((await snapshot()).data, null, 'confirmation does not publish');
    await refresh();
    const rows = await q('SELECT *, record_date::text AS day FROM hantang_dynamic.adm_uniseek_videos ORDER BY aid');
    assert.deepEqual(rows.map((row) => Number(row.aid)), [1, 8]);
    assert.equal(rows[0].view, null);
    assert.equal(rows[0].favorite, 101);
    assert.equal(rows[0].like, 0);
    assert.equal(rows[0].share, 7);
    assert.deepEqual(rows[0].tag_new, ['初音']);
    assert.equal(rows[0].participle, null);
    assert.equal(rows[1].view, 0);
    assert.equal(rows[1].favorite, 102);
    assert.equal(rows[1].like, null);
    assert.ok(rows.every((row) => row.batch_id === requested.batch && row.day === '2026-10-20'));
    assert.equal(rows[0].refreshed_at.getTime(), rows[1].refreshed_at.getTime());
    const before = await snapshot();
    await refresh();
    assert.deepEqual(await snapshot(), before, 'same confirmation is not recalculated');
  });
  await test('a changed source row count blocks publication until the date is confirmed again', async () => {
    await confirm();
    await db.exec(`INSERT INTO hantang_dynamic.video_daily(record_date,aid,"like") VALUES ('2026-10-20',777,101)`);
    await unchangedOnFailure(/row count changed/);
    await db.exec(`DELETE FROM hantang_dynamic.video_daily WHERE aid=777`);
  });
  await test('even duplicate snapshots below the search threshold reject the whole source day', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.video_daily(record_date,aid,"like") VALUES ('2026-10-20',2,0)`);
    await confirm();
    await unchangedOnFailure({ code: '23505' });
    await db.exec(`DELETE FROM hantang_dynamic.video_daily WHERE aid=2 AND "like"=0`);
  });
  await test('duplicate static aids or BV IDs cannot be silently deduplicated', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.processed_videos(aid,bvid,is_filtered,is_deleted) VALUES (1,'BV-other',false,false)`);
    await confirm();
    await unchangedOnFailure({ code: '23505' });
    await db.exec(`DELETE FROM hantang_dynamic.processed_videos WHERE bvid='BV-other';
      UPDATE hantang_dynamic.processed_videos SET bvid='BV1' WHERE aid=8`);
    await unchangedOnFailure({ code: '23505' });
    await db.exec(`UPDATE hantang_dynamic.processed_videos SET bvid='BV8' WHERE aid=8`);
  });
  await test('configured result-count guards and an empty search set retain the last successful batch', async () => {
    await confirm('2026-10-20', 3);
    await unchangedOnFailure(/below the confirmed minimum/);
    await db.exec(`UPDATE hantang_dynamic.processed_videos SET is_deleted=true WHERE aid IN (1,8)`);
    await confirm();
    await unchangedOnFailure(/below the confirmed minimum/);
    await db.exec(`UPDATE hantang_dynamic.processed_videos SET is_deleted=false WHERE aid IN (1,8)`);
  });
  await test('failure after DELETE rolls back both online rows and publication metadata', async () => {
    await db.exec(`CREATE FUNCTION hantang_dynamic.test_uniseek_fail_publish() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'forced publication failure'; END; $$;
      CREATE TRIGGER test_uniseek_fail BEFORE INSERT ON hantang_dynamic.adm_uniseek_videos
      FOR EACH ROW EXECUTE FUNCTION hantang_dynamic.test_uniseek_fail_publish();`);
    await confirm();
    await unchangedOnFailure(/forced publication failure/);
    await db.exec(`DROP TRIGGER test_uniseek_fail ON hantang_dynamic.adm_uniseek_videos;
      DROP FUNCTION hantang_dynamic.test_uniseek_fail_publish()`);
  });
  await test('same-day reconfirmation publishes a new batch and removes ineligible videos', async () => {
    const oldBatch = (await publication()).batch;
    await db.exec(`UPDATE hantang_dynamic.video_daily SET favorite=100 WHERE aid=1 AND record_date='2026-10-20';
      UPDATE hantang_dynamic.processed_videos SET title='updated title' WHERE aid=8;`);
    const requested = await confirm();
    assert.notEqual(requested.batch, oldBatch);
    await refresh();
    const rows = await q('SELECT aid,title,batch_id FROM hantang_dynamic.adm_uniseek_videos');
    assert.deepEqual(rows.map((row) => Number(row.aid)), [8]);
    assert.equal(rows[0].title, 'updated title');
    assert.equal(rows[0].batch_id, requested.batch);
    assert.equal(Number((await publication()).count), 1);
    await assert.rejects(confirm('2026-10-19'), /older date/);
  });
  await test('two same-day refreshes in one explicit transaction clean up their staging tables', async () => {
    await db.exec('BEGIN');
    await confirm(); await refresh();
    await confirm(); await refresh();
    await db.exec('COMMIT');
    assert.equal(Number((await publication()).count), 1);
  });
  console.log(`${passed} UniSeek ADM SQL checks passed`);
} finally {
  await db.close();
}
