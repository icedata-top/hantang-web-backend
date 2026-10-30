// PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/uniseek.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/UniSeekDao.java', import.meta.url), 'utf8');
const template = source.match(/String sql = """([\s\S]*?)"""\.formatted/)[1].replaceAll('\\\\', '\\');
const blocks = [...source.matchAll(/"""([\s\S]*?)"""/g)].map(match => match[1].replaceAll('\\\\', '\\'));
const bind = sql => { let i = 0; return sql.replaceAll('?', () => `$${++i}`); };
async function producers(keyword) { return (await db.query(bind(blocks[1]), [keyword, pattern(keyword)])).rows; }
async function exactVideo(aid) {
  const date = (await db.query('SELECT max(record_date)::text AS date FROM hantang_dynamic.video_daily')).rows[0].date;
  return (await db.query(bind(blocks[2]), [aid, date])).rows;
}
async function exactProducer(uid) { return (await db.query(bind(blocks[3]), [uid])).rows; }
const pattern = value => `%${value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
async function search(keyword, { page = 1, pageSize = 2 } = {}) {
  const params = [keyword, pattern(keyword)];
  const predicates = [];
    for (const token of keyword.split(/\s+/)) {
      const title = [...token].length >= 3 ? "p.title ILIKE ? ESCAPE '\\' OR " : '';
      predicates.push(`(${title}p.tag_new @> ARRAY[?]::varchar[] OR p.participle @> ARRAY[?]::varchar[] OR p.label_singers @> ARRAY[?]::text[])`);
      if (title) params.push(pattern(token));
      params.push(token, token, token);
    }
  let i = 0;
  const sql = template.replace('%s', predicates.join(' AND ') || 'false').replaceAll('?', () => `$${++i}`);
  params.push((await db.query('SELECT max(record_date)::text AS date FROM hantang_dynamic.video_daily')).rows[0].date);
  params.push(Math.min(pageSize + 1, 1000 - (page - 1) * pageSize), (page - 1) * pageSize);
  const { rows } = await db.query(sql, params);
  return { hasMore: rows.length > pageSize, rows: rows.slice(0, pageSize) };
}
const ids = result => result.rows.map(row => Number(row.aid));
try {
  await db.exec(`CREATE SCHEMA hantang_dynamic;
    CREATE TABLE hantang_dynamic.processed_videos(aid bigint PRIMARY KEY,bvid text,title text,pic text,pubdate bigint,user_id bigint,is_deleted boolean,tag_new varchar[],participle varchar[],label_singers text[]);
    CREATE TABLE hantang_dynamic.video_daily(aid bigint,record_date date,view integer,favorite integer,"like" integer,coin integer);
    INSERT INTO hantang_dynamic.processed_videos VALUES
      (1,'BV1Ts411S7SM','世末歌者',NULL,100,1,false,NULL,NULL,NULL),
      (2,'BV2','【乐正绫】世末歌者',NULL,100,1,false,ARRAY['乐正绫','世末歌者'],NULL,NULL),
      (3,'BV3','世末歌者 很长的标题',NULL,100,1,false,NULL,NULL,NULL),
      (4,'BV4','世末歌者 删除',NULL,100,1,true,NULL,NULL,NULL),
      (5,'BV5','标题里没有关键词',NULL,100,1,false,ARRAY['世末歌者','言和'],NULL,NULL),
      (6,'BV6','123木头人',NULL,100,1,false,NULL,NULL,NULL),
      (123,'BV123','无关歌名',NULL,100,1,false,NULL,NULL,NULL),
      (7,'BV7','100%_真实',NULL,100,1,false,NULL,NULL,NULL),
      (8,'BV8','言和 但没有标签',NULL,100,1,false,NULL,NULL,NULL),
      (10,'BV10','言和 有快照但播放量缺失',NULL,100,1,false,ARRAY['言和'],NULL,NULL),
      (11,'BV11','点赞门槛',NULL,100,1,false,NULL,NULL,NULL),
      (12,'BV12','点赞门槛',NULL,100,1,false,NULL,NULL,NULL),
      (13,'BV13','点赞门槛',NULL,100,1,false,NULL,NULL,NULL),
      (14,'BV14','点赞门槛',NULL,100,1,false,NULL,NULL,NULL);
    INSERT INTO hantang_dynamic.video_daily VALUES
      (1,CURRENT_DATE - 123,900000,1,100,1),(1,CURRENT_DATE - 12,0,0,21,0),
      (2,CURRENT_DATE - 12,1000000000,1,11,1),(3,CURRENT_DATE - 12,1000,1,35,1),
      (6,CURRENT_DATE - 12,0,0,12,0),(7,CURRENT_DATE - 12,10,0,11,0),
      (10,CURRENT_DATE - 12,NULL,NULL,11,NULL),
      (11,CURRENT_DATE - 12,100,0,0,0),(12,CURRENT_DATE - 12,100,0,10,0),
      (13,CURRENT_DATE - 12,100,0,NULL,0),(14,CURRENT_DATE - 12,100,0,11,0),
      (12,CURRENT_DATE - 13,100,0,100,0);`);
  const first = await search('世末歌者');
  assert.equal(first.hasMore, true);
  assert.deepEqual(ids(first), [1, 2]); // Exact title still outranks a billion views.
  assert.deepEqual(ids(await search('世末歌者', { page: 2 })), [3]);
  assert.equal((await search('世末歌者', { page: 2 })).hasMore, false);
  assert.deepEqual(ids(await search('世末歌者', { page: 3 })), []);
  assert.equal(first.rows[0].view, 0); // latest snapshot, never MAX(view)
  assert.equal(first.rows[0].like, 21);
  assert.equal((await search('言和')).rows[0].view, null);
  assert.deepEqual(ids(await search('av123')), []);
  assert.deepEqual(ids(await search('BV1Ts411S7SM')), []);
  assert.deepEqual(ids(await search('123')), [6]); // Bare numbers never query aid.
  assert.deepEqual(ids(await search('言和')), [10]); // Short words use exact existing array indexes.
  assert.deepEqual(ids(await search('乐正绫 世末歌者')), [2]);
  assert.deepEqual(ids(await search('100%_')), [7]);
  assert.deepEqual(ids(await search('不存在')), []);
  assert.deepEqual(ids(await search('点赞门槛')), [14]);
  for (const aid of [11,12,13]) assert.equal((await exactVideo(aid)).length, 0);
  assert.equal((await exactVideo(14)).length, 1);
  await db.exec(`INSERT INTO hantang_dynamic.video_daily VALUES (1,CURRENT_DATE - 12,99,99,99,99)`);
  assert.equal(Number((await search('世末歌者')).rows.find(row => Number(row.aid) === 1).snapshot_count), 2);
  assert.equal((await exactVideo(1)).length, 1);
  assert.equal((await exactVideo(5)).length, 0); // No daily records.
  assert.equal((await exactVideo(10))[0].view, null); // A row with an unknown metric still qualifies.
  await db.exec(`CREATE TABLE hantang_dynamic.discovered_users(user_id bigint,user_name text,face text,sign text,fans bigint,videos_filtered integer,filtered_view bigint);
    INSERT INTO hantang_dynamic.discovered_users(user_id,user_name,fans,videos_filtered) VALUES
      (1,'测试UP',100,1),(2,'测试UP精选',100000,2),(3,'测试UP',0,1),
      (4,'测试UP',999999,0),(5,'测试UP',999999,NULL),(6,'测试UP',NULL,2),
      (7,'测试up',999,2),(8,'COPY',1,1),(9,'copy',1000,1);
    UPDATE hantang_dynamic.discovered_users SET face='https://example.test/avatar.jpg';
    INSERT INTO hantang_dynamic.discovered_users(user_id,user_name,fans,videos_filtered,face) VALUES
      (10,'测试UP',999999999,1,NULL),(11,'测试UP',999999999,1,''),
      (12,'测试UP',999999999,1,'   '),(13,'测试UP',999999999,1,chr(9)||chr(10)||chr(13));`);
  assert.deepEqual((await producers('测试UP')).map(row => Number(row.user_id)), [1,3,6,2,7]);
  assert.deepEqual((await producers('COPY')).map(row => Number(row.user_id)), [8,9]);
  assert.equal((await exactProducer(4)).length, 0);
  assert.equal((await exactProducer(5)).length, 0);
  assert.equal((await exactProducer(1)).length, 1);
  for (const uid of [10,11,12,13]) assert.equal((await exactProducer(uid)).length, 0);
  await db.exec(`INSERT INTO hantang_dynamic.discovered_users(user_id,user_name,fans,videos_filtered,face)
    SELECT n,'测试UP-'||n,1000000+n,1,'https://example.test/avatar.jpg' FROM generate_series(20,45) n`);
  const top = await producers('测试UP');
  assert.equal(top.length, 20);
  assert.deepEqual(top.slice(0,3).map(row => Number(row.user_id)), [1,3,6]); // Exact low-fan hits survive LIMIT.
  await db.exec(`INSERT INTO hantang_dynamic.video_daily VALUES (999,CURRENT_DATE - 3,99,99,99,99)`);
  assert.deepEqual(ids(await search('世末歌者')), []); // An older per-video snapshot is not enough.
  assert.equal((await exactVideo(1)).length, 0);
  await db.exec('TRUNCATE hantang_dynamic.video_daily');
  assert.deepEqual(ids(await search('世末歌者')), []);
  console.log('PASS UniSeek SQL: score bands, bounded popularity, latest/NULL/zero, pagination, keyword/ID latest likes > 10 eligibility, producer avatar eligibility and exact-name/fan ranking, numeric text, escaped LIKE, all-word matching, short-token indexes');
} finally { await db.close(); }
