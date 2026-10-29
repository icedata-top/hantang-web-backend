// 独立内存 PostgreSQL 验证，不连接业务库，不修改生产数据。
// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/producer_videos.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/ProducerDao.java', import.meta.url), 'utf8');
const template = source.match(/String sql = """([\s\S]*?)"""\.formatted/)[1];
async function videos({ userId = 1, role = 'uploader', sortBy = 'pubdate', order = 'desc', page = 1, pageSize = 20 } = {}) {
  const parts = [role === 'staff' ? 'p.staff @> ARRAY[?]::bigint[]' : 'p.user_id = ?', sortBy, order.toUpperCase(), sortBy, order.toUpperCase()];
  let index = 0;
  const sql = template.replaceAll('%s', () => parts.shift()).replaceAll('?', () => `$${++index}`);
  const { rows } = await db.query(sql, [userId, pageSize, (page - 1) * pageSize]);
  return { total: Number(rows[0].total), unique: Number(rows[0].unique_total), rows: rows.filter(row => row.aid != null) };
}
const ids = page => page.rows.map(row => Number(row.aid));
try {
  await db.exec(`CREATE SCHEMA hantang_dynamic;
    CREATE TABLE hantang_dynamic.processed_videos(aid bigint, bvid text, title text, pubdate bigint, pic text, user_id bigint, staff bigint[]);
    CREATE TABLE hantang_dynamic.video_daily(aid bigint, record_date date, view integer);
    INSERT INTO hantang_dynamic.processed_videos VALUES
      (11,'BV11','one',100,NULL,1,NULL), (12,'BV12','two',300,NULL,1,ARRAY[2]),
      (13,'BV13','three',NULL,NULL,1,ARRAY[1,2,2]), (14,'BV14','four',200,NULL,2,ARRAY[1]),
      (15,'BV15','five',300,NULL,1,ARRAY[]::bigint[]), (17,'BV17','seven',250,NULL,1,NULL);
    INSERT INTO hantang_dynamic.video_daily VALUES
      (11,'2026-10-20',900), (11,'2026-10-21',300), (12,'2026-10-21',200),
      (13,'2026-10-20',500), (13,'2026-10-21',NULL), (14,'2026-10-21',0), (17,'2026-10-21',200);`);
  assert.deepEqual(ids(await videos()), [12, 15, 17, 11, 13]);
  assert.deepEqual(ids(await videos({ order: 'asc' })), [11, 17, 12, 15, 13]);
  assert.deepEqual(ids(await videos({ sortBy: 'view' })), [11, 12, 17, 13, 15]);
  assert.deepEqual(ids(await videos({ sortBy: 'view', order: 'asc' })), [12, 17, 11, 13, 15]);
  assert.deepEqual(ids(await videos({ role: 'staff' })), [14, 13]);
  assert.deepEqual(ids(await videos({ userId: 2, role: 'staff' })), [12, 13]);
  const first = await videos({ pageSize: 2 });
  const second = await videos({ pageSize: 2, page: 2 });
  assert.equal(first.total, 5);
  assert.deepEqual(ids(first), [12, 15]);
  assert.deepEqual(ids(second), [17, 11]);
  assert.deepEqual(ids(await videos({ page: 99 })), []);
  assert.equal((await videos({ page: 99 })).total, 5);
  assert.equal((await videos({ userId: 999 })).total, 0);
  assert.deepEqual(ids(await videos({ userId: 999 })), []);
  const zero = await videos({ userId: 2 });
  assert.equal(zero.rows[0].view, 0);
  const missing = (await videos()).rows.find(row => Number(row.aid) === 13);
  assert.equal(missing.view, null);
  assert.equal(missing.record_date, '2026-10-21');
  await db.exec(`INSERT INTO hantang_dynamic.video_daily VALUES (11,'2026-10-21',999)`);
  assert.equal(Number((await videos()).rows.find(row => Number(row.aid) === 11).snapshot_count), 2);
  await db.exec(`INSERT INTO hantang_dynamic.processed_videos SELECT * FROM hantang_dynamic.processed_videos WHERE aid=11`);
  const duplicate = await videos();
  assert.notEqual(duplicate.total, duplicate.unique);
  console.log('PASS producer SQL: both author roles, four sorts, ties, pagination, latest/NULL/zero snapshots, duplicate detection');
} finally { await db.close(); }
