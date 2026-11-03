// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/uniseek.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/UniSeekDao.java', import.meta.url), 'utf8');
const template = source.match(/String sql = """([\s\S]*?)"""\.formatted/)[1].replaceAll('\\\\', '\\');
const blocks = [...source.matchAll(/"""([\s\S]*?)"""/g)].map((match) => match[1].replaceAll('\\\\', '\\'));
const bind = (sql) => { let i = 0; return sql.replaceAll('?', () => `$${++i}`); };
const batchA = '00000000-0000-0000-0000-000000000001';
const batchB = '00000000-0000-0000-0000-000000000002';
const pattern = (value) => `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
async function ranked(keyword) {
  const parameters = [keyword, pattern(keyword)];
  const predicates = keyword.split(/\s+/).map((token) => {
    parameters.push(pattern(token), token, token, token);
    return "(p.title ILIKE ? ESCAPE '\\' OR p.tag_new @> ARRAY[?]::varchar[] OR p.participle @> ARRAY[?]::varchar[] OR p.label_singers @> ARRAY[?]::text[])";
  });
  parameters.push(1000);
  return (await db.query(bind(template.replace('%s', predicates.join(' AND '))), parameters)).rows;
}
async function search(keyword, { page = 1, pageSize = 2 } = {}) {
  const rows = (await ranked(keyword)).slice((page - 1) * pageSize, page * pageSize + 1);
  return { hasMore: rows.length > pageSize, rows: rows.slice(0, pageSize) };
}
async function exactVideo(aid) { return (await db.query(bind(blocks[2]), [aid])).rows; }
async function producers(keyword) { return (await db.query(bind(blocks[1]), [keyword, pattern(keyword)])).rows; }
async function exactProducer(uid) { return (await db.query(bind(blocks[3]), [uid])).rows; }
const ids = (result) => result.rows.map((row) => Number(row.aid));
let passed = 0;
const test = async (name, run) => { await run(); passed += 1; console.log(`PASS ${name}`); };
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  await db.exec(await readFile(new URL('../adm_uniseek_videos.sql', import.meta.url), 'utf8'));
  await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
    (aid,bvid,title,pubdate,user_id,tag_new,view,favorite,"like",coin,record_date,batch_id,refreshed_at) VALUES
    (1,'BV1Ts411S7SM','世末歌者',100,1,NULL,0,0,101,0,'2026-10-20','${batchA}',now()),
    (2,'BV2','【乐正绫】世末歌者',100,1,ARRAY['乐正绫','世末歌者'],1000000000,1,102,1,'2026-10-20','${batchA}',now()),
    (3,'BV3','世末歌者 很长的标题',100,1,NULL,1000,1,103,1,'2026-10-20','${batchA}',now()),
    (5,'BV5','标题里没有关键词',100,1,ARRAY['世末歌者','言和'],0,1,104,1,'2026-10-20','${batchA}',now()),
    (6,'BV6','123木头人',100,1,NULL,0,0,105,0,'2026-10-20','${batchA}',now()),
    (123,'BV123','无关歌名',100,1,NULL,0,0,106,0,'2026-10-20','${batchA}',now()),
    (7,'BV7','100%_真实',100,1,NULL,10,0,107,0,'2026-10-20','${batchA}',now()),
    (8,'BV8','言和 但没有标签',100,1,NULL,0,0,108,0,'2026-10-20','${batchA}',now()),
    (10,'BV10','言和',100,1,ARRAY['言和'],NULL,NULL,109,NULL,'2026-10-20','${batchA}',now()),
    (20,'BV20','同分',100,1,NULL,10,0,101,0,'2026-10-20','${batchA}',now()),
    (21,'BV21','同分',100,1,NULL,10,0,101,0,'2026-10-20','${batchA}',now());`);
  await test('keyword and exact-ID SQL run with no raw video or Daily tables present', async () => {
    const tables = (await db.query(`SELECT to_regclass('hantang_dynamic.processed_videos') AS raw,
      to_regclass('hantang_dynamic.video_daily') AS daily`)).rows[0];
    assert.deepEqual(tables, { raw: null, daily: null });
    assert.equal((await exactVideo(123))[0].bvid, 'BV123');
    assert.deepEqual(await exactVideo(404), []);
    assert.ok((await ranked('世末歌者')).length > 0);
  });
  await test('exact titles outrank huge view counts, with stable pages and preserved NULL/zero metrics', async () => {
    const first = await search('世末歌者');
    assert.equal(first.hasMore, true);
    assert.deepEqual(ids(first), [1, 2]);
    assert.deepEqual(ids(await search('世末歌者', { page: 2 })), [3, 5]);
    assert.equal((await search('世末歌者', { page: 2 })).hasMore, false);
    assert.deepEqual(ids(await search('世末歌者', { page: 3 })), []);
    assert.equal(first.rows[0].view, 0);
    assert.equal(first.rows[0].favorite, 0);
    assert.equal(first.rows[0].like, 101);
    assert.equal(first.rows[0].record_date, '2026-10-20');
    assert.equal(first.rows[0].batch_id, batchA);
    assert.equal((await search('言和')).rows[0].view, null);
    assert.equal((await exactVideo(10))[0].favorite, null);
  });
  await test('one/two-character title matches, exact array elements and multiple words retain their meanings', async () => {
    assert.deepEqual(ids(await search('言和')), [10, 8]);
    assert.deepEqual(ids(await search('言和', { page: 2 })), [5]);
    assert.deepEqual(ids(await search('世末', { pageSize: 50 })).sort((a, b) => a - b), [1, 2, 3]);
    assert.deepEqual(ids(await search('歌', { pageSize: 50 })).sort((a, b) => a - b), [1, 2, 3, 123]);
    assert.deepEqual(ids(await search('乐正绫 世末歌者')), [2]);
    await db.exec(`UPDATE hantang_dynamic.adm_uniseek_videos SET participle=ARRAY['分词命中'],label_singers=ARRAY['歌手命中'] WHERE aid=5`);
    assert.deepEqual(ids(await search('分词命中')), [5]);
    assert.deepEqual(ids(await search('歌手命中')), [5]);
  });
  await test('numeric text never becomes an ID LIKE and wildcard characters remain literal', async () => {
    assert.deepEqual(ids(await search('123')), [6]);
    assert.deepEqual(ids(await search('av123')), []);
    assert.deepEqual(ids(await search('BV1Ts411S7SM')), []);
    assert.deepEqual(ids(await search('%_')), [7]);
    assert.deepEqual(ids(await search("' OR true --")), []);
  });
  await test('ties use aid descending and admission requires more than 100 likes', async () => {
    assert.deepEqual(ids(await search('同分', { pageSize: 1 })), [21]);
    assert.equal((await search('同分', { pageSize: 1 })).hasMore, true);
    assert.deepEqual(ids(await search('同分', { page: 2, pageSize: 1 })), [20]);
    for (const likes of [100, 0, null]) {
      await assert.rejects(() => db.query(`INSERT INTO hantang_dynamic.adm_uniseek_videos
        (aid,bvid,"like",record_date,batch_id,refreshed_at) VALUES (99,'BV99',$1,'2026-10-20',$2,now())`, [likes, batchA]));
    }
  });
  await test('all matches are ranked before the beta 1000-row return limit', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
      (aid,bvid,title,view,"like",record_date,batch_id,refreshed_at)
      SELECT i,'BV'||i,'limit test',CASE WHEN i=2000 THEN 1000000000 ELSE 0 END,101,
      '2026-10-20','${batchA}',now() FROM generate_series(2000,3000) i`);
    const rows = await ranked('limit test');
    assert.equal(rows.length, 1000);
    assert.equal(Number(rows[0].aid), 2000, 'high-view match must not be lost by an earlier text-only cutoff');
    assert.equal(rows.some((row) => Number(row.aid) === 2001), false);
    assert.equal((await search('limit test', { page: 20, pageSize: 50 })).hasMore, false);
  });
  await test('same-day publication markers and empty tables come directly from ADM', async () => {
    await db.exec(`UPDATE hantang_dynamic.adm_uniseek_videos SET batch_id='${batchB}'`);
    assert.ok((await ranked('世末歌者')).every((row) => row.batch_id === batchB && row.record_date === '2026-10-20'));
    await db.exec('DELETE FROM hantang_dynamic.adm_uniseek_videos');
    assert.deepEqual(ids(await search('世末歌者')), []);
    assert.deepEqual(await exactVideo(123), []);
  });
  await db.exec(`CREATE TABLE hantang_dynamic.discovered_users(user_id bigint PRIMARY KEY,user_name text,face text,sign text,fans integer,videos_filtered integer,filtered_view bigint);
    INSERT INTO hantang_dynamic.discovered_users VALUES
      (1,'洛天依',NULL,NULL,100000,1,1),(2,'洛天依低粉','https://a',NULL,10,1,1),
      (3,'洛天依高粉','https://a',NULL,100000,1,1),(4,'洛天依未收录','https://a',NULL,999999,0,1),
      (5,'洛天依','https://a',NULL,1,1,1),(6,'洛天依无粉丝数','https://a',NULL,NULL,1,1),
      (7,'洛天依空头像','',NULL,999999,1,1),(8,'洛天依空白头像','  ',NULL,999999,1,1);`);
  await test('producer eligibility and exact-name/follower order remain independent of ADM', async () => {
    assert.deepEqual((await producers('洛天依')).map((row) => Number(row.user_id)), [5, 3, 2, 6]);
    assert.equal((await exactProducer(5)).length, 1);
    for (const uid of [1, 4, 7, 8]) assert.deepEqual(await exactProducer(uid), []);
  });
  console.log(`${passed} UniSeek ADM query SQL checks passed`);
} finally {
  await db.close();
}
