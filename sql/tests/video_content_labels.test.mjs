// Isolated PostgreSQL via PGlite; never connects to the business database.
// PGLITE_MODULE_PATH=/tmp/uniseek-label-ddl-test/node_modules/@electric-sql/pglite/dist/index.js node sql/tests/video_content_labels.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const insert = (aid, song = '是', voice = '是', languages = ['汉语'], source = 'manual', extra = {}) => q(`
  INSERT INTO hantang_dynamic.video_content_labels
    (aid,is_song,is_virtual_singer,languages,label_source,input_sha256,model,prompt_sha256,source_run_id)
  VALUES ($1,$2,$3,$4::text[],$5,$6,$7,$8,$9) RETURNING *`,
  [aid, song, voice, languages, source, extra.input ?? 'a'.repeat(64), extra.model ?? null, extra.prompt ?? null, extra.run ?? null]);
const ids = rows => rows.map(row => Number(row.aid)).sort((a, b) => a - b);
let passed = 0;
const test = async (name, run) => { await run(); passed++; console.log(`PASS ${name}`); };
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  const ddl = await read('video_content_labels.sql');
  assert.ok(ddl.trimEnd().split(/\r?\n/).every(line => line.trim()), 'direct execution SQL must have no blank lines');
  assert.doesNotMatch(ddl, /CREATE EXTENSION|IF NOT EXISTS|DROP TABLE/i);
  await db.exec(ddl);
  await test('a separately created app role needs explicit grants; empty labels are readable after the table-only grant', async () => {
    await db.exec('CREATE ROLE app_icedata_web; GRANT USAGE ON SCHEMA hantang_dynamic TO app_icedata_web; SET ROLE app_icedata_web;');
    try {
      await assert.rejects(() => q('SELECT count(*) FROM hantang_dynamic.video_content_labels'), { code: '42501' });
    } finally { await db.exec('RESET ROLE'); }
    await db.exec(await read('video_content_labels_permissions.sql'));
    assert.equal((await one("SELECT has_table_privilege('app_icedata_web','hantang_dynamic.video_content_labels','DELETE') AS allowed")).allowed, false);
    await db.exec('SET ROLE app_icedata_web');
    try {
      assert.equal(Number((await one('SELECT count(*) AS count FROM hantang_dynamic.video_content_labels')).count), 0);
      await insert(900001);
      assert.equal(Number((await one('UPDATE hantang_dynamic.video_content_labels SET labeled_at=CURRENT_TIMESTAMP WHERE aid=900001 RETURNING aid')).aid), 900001);
      await assert.rejects(() => q('DELETE FROM hantang_dynamic.video_content_labels WHERE aid=900001'), { code: '42501' });
    } finally { await db.exec('RESET ROLE'); }
    await q('DELETE FROM hantang_dynamic.video_content_labels WHERE aid=900001');
  });
  await test('labels install without raw, daily, or ADM tables and use two stored generated columns', async () => {
    assert.equal((await one("SELECT to_regclass('hantang_dynamic.adm_uniseek_videos') AS name")).name, null);
    const generated = await q(`SELECT column_name,is_generated,generation_expression FROM information_schema.columns
      WHERE table_schema='hantang_dynamic' AND table_name='video_content_labels' AND is_generated='ALWAYS' ORDER BY column_name`);
    assert.deepEqual(generated.map(row => row.column_name), ['is_chinese_virtual_singer_song', 'is_virtual_singer_song']);
    const indexes = await q("SELECT indexname FROM pg_indexes WHERE schemaname='hantang_dynamic' AND tablename='video_content_labels'");
    assert.equal(indexes.length, 3);
    assert.equal(Number((await one(`SELECT count(*) AS count FROM pg_constraint
      WHERE conrelid='hantang_dynamic.video_content_labels'::regclass AND contype='f'`)).count), 0);
  });
  await test('all 24 song/voice/language combinations preserve raw labels and include mixed Chinese vocals', async () => {
    let aid = 1;
    for (const song of ['是','否','不确定']) for (const voice of ['是','否','混合','不确定']) for (const languages of [['汉语','日语'],['未知语言']]) {
      const [row] = await insert(aid++, song, voice, languages);
      const virtual = song === '是' && ['是','混合'].includes(voice);
      assert.equal(row.is_virtual_singer_song, virtual);
      assert.equal(row.is_chinese_virtual_singer_song, virtual && languages.includes('汉语'));
      assert.equal(row.is_virtual_singer, voice);
      assert.deepEqual(row.languages, languages);
    }
  });
  await test('updating source fields automatically recalculates both flags and direct writes are rejected', async () => {
    await insert(101, '否', '混合', ['日语']);
    await q("UPDATE hantang_dynamic.video_content_labels SET is_song='是', languages=ARRAY['汉语'] WHERE aid=101");
    const row = await one('SELECT * FROM hantang_dynamic.video_content_labels WHERE aid=101');
    assert.equal(row.is_virtual_singer_song, true); assert.equal(row.is_chinese_virtual_singer_song, true);
    await assert.rejects(q('UPDATE hantang_dynamic.video_content_labels SET is_virtual_singer_song=false WHERE aid=101'), { code: '428C9' });
    await assert.rejects(insert(101), /duplicate key/);
  });
  await test('unknown and no-language are explicit while empty/null/multidimensional/alias language values are rejected', async () => {
    await insert(201, '不确定', '不确定', ['未知语言']);
    await insert(202, '否', '不确定', ['无语言']);
    for (const languages of [[], [null], [''], ['中文'], ['普通话'], ['韩语'], ['无语言','汉语']])
      await assert.rejects(insert(299, '是', '是', languages), /constraint/);
    await assert.rejects(q(`INSERT INTO hantang_dynamic.video_content_labels
      (aid,is_song,is_virtual_singer,languages,label_source,input_sha256)
      VALUES (299,'是','是',ARRAY[['汉语','日语'],['汉语','日语']],'manual',repeat('a',64))`), /constraint/);
    await assert.rejects(insert(299, '是', '是', null), /null value/);
    await assert.rejects(insert(299, '未知', '是'), /constraint/);
    await assert.rejects(insert(-1), /constraint/);
  });
  await test('LLM provenance and per-video hashes are required; manual rows need no fake model metadata', async () => {
    await assert.rejects(insert(301, '是', '是', ['汉语'], 'llm'), /provenance/);
    const [row] = await insert(301, '是', '是', ['汉语'], 'llm', { model:'test-qwen', prompt:'b'.repeat(64), run:'web-test' });
    assert.equal(row.schema_version, 1); assert.equal(row.source_run_id, 'web-test');
    await assert.rejects(insert(302, '是', '是', ['汉语'], 'manual', { input:'not-a-hash' }), /constraint/);
    await assert.rejects(insert(302, '是', '是', ['汉语'], 'manual', { prompt:'z'.repeat(64) }), /constraint/);
    assert.equal((await insert(302))[0].model, null);
  });
  await db.exec(await read('adm_uniseek_videos.sql'));
  const statements = (await read('video_content_labels_queries.sql')).replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim());
  assert.equal(statements.length, 4);
  const candidates = [
    [1001,10,'是','是',['汉语']], [1002,20,'是','混合',['日语','汉语']],
    [1003,10,'是','是',['日语']], [1004,10,'否','不确定',['未知语言']],
    [1005,20,'是','否',['汉语']], [1006,10,'不确定','是',['汉语']],
    [1007,20,'是','不确定',['汉语']], [1008,10], [1009,30], [1010,null],
  ];
  for (const [aid, user, song, voice, languages] of candidates) {
    await q(`INSERT INTO hantang_dynamic.adm_uniseek_videos
      (aid,bvid,title,user_id,view,favorite,record_date,batch_id,refreshed_at)
      VALUES ($1,$2,$3,$4,100,101,'2026-11-19','00000000-0000-0000-0000-000000000001',now())`, [aid,`BV${aid}`,`投稿${aid}`,user]);
    if (song) await insert(aid,song,voice,languages);
  }
  await insert(9999); // Has a positive historical label but is outside today's hard-filtered candidate set.
  await test('all preserves unlabeled videos; virtual and default Chinese ranges are nested and exclude noncandidate labels', async () => {
    const all = await q(statements[0]), virtual = await q(statements[1]), chinese = await q(statements[2]);
    assert.deepEqual(ids(all), candidates.map(row => row[0]));
    assert.deepEqual(ids(virtual), [1001,1002,1003]);
    assert.deepEqual(ids(chinese), [1001,1002]);
    assert.equal(all.find(row => Number(row.aid) === 1008).is_song, null);
    assert.ok(!ids(all).includes(9999));
  });
  await test('UP ratios retain non-songs and distinguish unmarked/unknown from decided; zero denominator stays null', async () => {
    const rows = await q(statements[3]);
    assert.equal(rows.length, 3);
    const up = id => rows.find(row => Number(row.user_id) === id);
    assert.equal(Number(up(10).candidate_count), 5);
    assert.equal(Number(up(10).labeled_count), 4);
    assert.equal(Number(up(10).decided_count), 3);
    assert.equal(Number(up(10).virtual_song_count), 2);
    assert.equal(Number(up(10).chinese_virtual_song_count), 1);
    assert.equal(Number(up(10).labeling_coverage), 0.8);
    assert.equal(Number(up(10).decision_coverage), 0.6);
    assert.ok(Math.abs(Number(up(10).virtual_share_decided) - 2 / 3) < 1e-12);
    assert.equal(Number(up(10).virtual_share_lower_bound), 0.4);
    assert.equal(Number(up(20).virtual_share_decided), 0.5);
    assert.equal(up(30).virtual_share_decided, null);
    assert.equal(Number(up(30).decision_coverage), 0);
  });
  await test('daily DELETE/INSERT preserves labels and only current candidates become visible', async () => {
    const before = await one('SELECT count(*) AS count FROM hantang_dynamic.video_content_labels');
    await db.exec('BEGIN; DELETE FROM hantang_dynamic.adm_uniseek_videos; COMMIT;');
    assert.equal((await one('SELECT count(*) AS count FROM hantang_dynamic.video_content_labels')).count, before.count);
    assert.deepEqual(await q(statements[2]), []);
    await q(`INSERT INTO hantang_dynamic.adm_uniseek_videos
      (aid,bvid,favorite,record_date,batch_id,refreshed_at)
      VALUES (1002,'BV1002',101,'2026-11-20','00000000-0000-0000-0000-000000000002',now())`);
    assert.deepEqual(ids(await q(statements[2])), [1002]);
    assert.equal((await one('SELECT is_virtual_singer FROM hantang_dynamic.video_content_labels WHERE aid=1002')).is_virtual_singer, '混合');
    assert.equal(Number((await one('SELECT count(*) AS count FROM hantang_dynamic.video_content_labels WHERE aid=9999')).count), 1);
  });
  console.log(`PASS ${passed} isolated video label schema/query checks`);
} finally { await db.close(); }
