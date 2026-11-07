// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/video_list.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/VideoListDao.java', import.meta.url), 'utf8');
const template = source.match(/String sql = """([\s\S]*?)"""\.formatted/)[1];
async function browse(where = 'true', params = [], { column = 'view', order = 'desc', size = 20, offset = 0 } = {}) {
  let i = 0;
  const substitutions = [where, column, order];
  const sql = template.replaceAll('%s', () => substitutions.shift()).replaceAll('?', () => `$${++i}`);
  return (await db.query(sql, [...params, size, offset])).rows;
}
const ids = rows => rows.filter(row => row.aid != null).map(row => Number(row.aid));
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  await db.exec(await readFile(new URL('../adm_uniseek_videos.sql', import.meta.url), 'utf8'));
  await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
    (aid,bvid,title,pubdate,view,favorite,"like",record_date,batch_id,refreshed_at) VALUES
    (1,'BV1','unknown',1793635199,NULL,101,NULL,'2026-11-03','00000000-0000-0000-0000-000000000001',now()),
    (2,'BV2','zero',1793635200,0,102,0,'2026-11-03','00000000-0000-0000-0000-000000000001',now()),
    (3,'BV3','hall',1793721599,100000,110,102,'2026-11-03','00000000-0000-0000-0000-000000000001',now()),
    (4,'BV4','legend',1793721600,1000000,110,103,'2026-11-03','00000000-0000-0000-0000-000000000001',now()),
    (5,'BV5','myth',1793721601,10000000,120,104,'2026-11-03','00000000-0000-0000-0000-000000000001',now());`);
  // With no source or history tables present, the ordinary browse query is executable.
  assert.deepEqual(ids(await browse()), [5, 4, 3, 2, 1]);
  assert.deepEqual(ids(await browse('true', [], { order: 'asc' })), [2, 3, 4, 5, 1]);
  assert.deepEqual(ids(await browse('true', [], { column: 'favorite' })), [5, 4, 3, 2, 1]);
  assert.deepEqual(ids(await browse('p.pubdate >= ? AND p.pubdate < ?', [1793635200, 1793721600])), [3, 2]);
  for (const [where, expected] of [
    ['p.view >= 0 AND p.view < 100000', [2]], ['p.view >= 100000 AND p.view < 1000000', [3]],
    ['p.view >= 1000000 AND p.view < 10000000', [4]], ['p.view >= 10000000', [5]],
  ]) assert.deepEqual(ids(await browse(where)), expected);
  assert.equal((await browse())[3].like, 0);
  assert.equal((await browse())[4].like, null);
  const first = await browse('true', [], { size: 2 });
  assert.equal(Number(first[0].total), 5); assert.deepEqual(ids(first), [5, 4]);
  assert.deepEqual(ids(await browse('true', [], { size: 2, offset: 2 })), [3, 2]);
  const empty = await browse('true', [], { offset: 100 });
  assert.equal(empty[0].aid, null); assert.equal(Number(empty[0].total), 5);
  assert.equal(empty[0].snapshot_date, '2026-11-03');
  assert.equal(Number((await browse('p.view >= ?', [10000001]))[0].total), 0);
  await db.exec('CREATE TABLE hantang_dynamic.processed_videos (aid bigint PRIMARY KEY, type_id integer)');
  await db.exec('INSERT INTO hantang_dynamic.processed_videos VALUES (3,30),(4,28),(5,30)');
  const filtered = await browse('p.view >= ? AND EXISTS (SELECT 1 FROM hantang_dynamic.processed_videos s WHERE s.aid = p.aid AND s.type_id = ?)', [100000, 30]);
  assert.deepEqual(ids(filtered), [5, 3]); assert.equal(Number(filtered[0].total), 2);
  console.log('PASS song browse SQL: dates, honor boundaries, partitions, nulls, stable pages and empty-page totals');
} finally { await db.close(); }
