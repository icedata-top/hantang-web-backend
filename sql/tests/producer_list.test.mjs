// Independent in-memory PostgreSQL; never reads or modifies the business database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/ProducerDao.java', import.meta.url), 'utf8');
const method = source.slice(source.indexOf('public ProducerPage findList'));
const template = method.match(/String sql = """([\s\S]*?)"""\.formatted/)[1];
const baseFilter = method.match(/filters.add\("([^"]+)"\);/)[1];
async function producers({ minFans = null, minVideos = null, sortBy = 'fans', order = 'desc', page = 1, pageSize = 20 } = {}) {
  const filters = [baseFilter];
  const params = [];
  if (minFans != null) { filters.push('u.fans >= ?'); params.push(minFans); }
  if (minVideos != null) { filters.push('u.videos_filtered >= ?'); params.push(minVideos); }
  const column = { fans: 'fans', videoCount: 'videos_filtered', userId: 'user_id' }[sortBy];
  const parts = [filters.join(' AND '), column, order, column, order];
  let index = 0;
  const sql = template.replaceAll('%s', () => parts.shift()).replaceAll('?', () => `$${++index}`);
  const { rows } = await db.query(sql, [...params, pageSize, (page - 1) * pageSize]);
  return { total: Number(rows[0].total), uniqueTotal: Number(rows[0].unique_total), rows: rows.filter(row => row.user_id != null) };
}
const ids = page => page.rows.map(row => String(row.user_id));
try {
  await db.exec(`CREATE SCHEMA hantang_dynamic;
    CREATE TABLE hantang_dynamic.discovered_users(user_id bigint, user_name text, face text, sign text,
      fans integer, videos_filtered integer, level integer, official_role integer, official_title text, last_updated timestamptz);
    INSERT INTO hantang_dynamic.discovered_users VALUES
      (1,'one','https://one',NULL,100,5,6,0,'official','2026-11-01T08:00:00+08:00'),
      (2,'two','https://two','bio',100,10,5,0,NULL,NULL),
      (3,'three','https://three',NULL,NULL,2,NULL,NULL,NULL,NULL),
      (4,'zero','https://four',NULL,0,1,0,0,NULL,NULL),
      (5,'no works','https://five',NULL,999,0,NULL,NULL,NULL,NULL),
      (6,'null works','https://six',NULL,999,NULL,NULL,NULL,NULL,NULL),
      (7,'blank avatar','   ',NULL,999,5,NULL,NULL,NULL,NULL),
      (8,'null avatar',NULL,NULL,999,5,NULL,NULL,NULL,NULL),
      (9,'empty avatar','',NULL,999,5,NULL,NULL,NULL,NULL),
      (9007199254740993,'large','https://large',NULL,50,3,6,0,NULL,NULL);`);
  assert.deepEqual(ids(await producers()), ['2', '1', '9007199254740993', '4', '3']);
  assert.deepEqual(ids(await producers({ order: 'asc' })), ['4', '9007199254740993', '2', '1', '3']);
  assert.deepEqual(ids(await producers({ sortBy: 'videoCount' })), ['2', '1', '9007199254740993', '3', '4']);
  assert.deepEqual(ids(await producers({ sortBy: 'userId', order: 'asc' })), ['1', '2', '3', '4', '9007199254740993']);
  assert.deepEqual(ids(await producers({ minFans: 100, minVideos: 6 })), ['2']);
  assert.deepEqual(ids(await producers({ minFans: 0 })), ['2', '1', '9007199254740993', '4']);
  assert.equal((await producers({ minFans: 1000 })).total, 0);
  const first = await producers({ pageSize: 2 });
  assert.equal(first.total, 5);
  assert.deepEqual(ids(first), ['2', '1']);
  assert.deepEqual(ids(await producers({ page: 2, pageSize: 2 })), ['9007199254740993', '4']);
  const empty = await producers({ page: 99 });
  assert.equal(empty.total, 5);
  assert.deepEqual(ids(empty), []);
  assert.equal(first.rows.find(row => String(row.user_id) === '1').last_updated, '2026-11-01T00:00:00Z');
  assert.equal((await producers()).rows.find(row => String(row.user_id) === '4').fans, 0);
  assert.equal((await producers()).rows.find(row => String(row.user_id) === '3').fans, null);
  await db.exec(`INSERT INTO hantang_dynamic.discovered_users SELECT * FROM hantang_dynamic.discovered_users WHERE user_id=1`);
  const duplicate = await producers();
  assert.notEqual(duplicate.total, duplicate.uniqueTotal);
  console.log('PASS producer list SQL: eligibility, filters, stable sorting, NULL/zero, large IDs, paging, UTC timestamps, duplicates');
} finally { await db.close(); }
