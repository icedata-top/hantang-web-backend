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
const vocals = JSON.parse(await readFile(new URL('../../frontend/src/constants/vocal/vocal-search-info.json', import.meta.url), 'utf8'));
const vocalNames = new Set(vocals.flatMap(vocal => [vocal.name, ...vocal.aliases]).map(name => name.toLowerCase()));
const ranking = JSON.parse(await readFile(new URL('../../src/main/resources/config/uniseek-ranking.json', import.meta.url), 'utf8'));
const popularityKeywords = new Set(ranking.popularityKeywords.map(keyword => keyword.trim().toLowerCase()));
const scopeFilters = Object.fromEntries(['VIRTUAL_SONG_FILTER', 'CHINESE_VIRTUAL_SONG_FILTER'].map(name =>
  [name, source.match(new RegExp(`String ${name} = "([^"]+)";`))[1]]));
const scopeFilter = scope => scope === 'all' ? 'true' : scopeFilters[scope === 'virtual_song' ? 'VIRTUAL_SONG_FILTER' : 'CHINESE_VIRTUAL_SONG_FILTER'];
async function ranked(keyword, scope = 'all') {
  const normalized = keyword.trim().toLowerCase();
  const singer = vocalNames.has(normalized);
  const weight = singer || popularityKeywords.has(normalized) ? ranking.popularityViewWeight : ranking.defaultViewWeight;
  const parameters = [keyword, pattern(keyword), singer ? 10 : 1, weight];
  const predicates = keyword.split(/\s+/).map((token) => {
    parameters.push(pattern(token), token, token, token);
    return "(p.title ILIKE ? ESCAPE '\\' OR p.tag_new @> ARRAY[?]::varchar[] OR p.participle @> ARRAY[?]::varchar[] OR p.label_singers @> ARRAY[?]::text[])";
  });
  parameters.push(1000);
  return (await db.query(bind(template.replace('%s', predicates.join(' AND ')).replace('%s', scopeFilter(scope))), parameters)).rows;
}
async function search(keyword, { page = 1, pageSize = 2 } = {}) {
  const rows = (await ranked(keyword)).slice((page - 1) * pageSize, page * pageSize + 1);
  return { hasMore: rows.length > pageSize, rows: rows.slice(0, pageSize) };
}
async function exactVideo(aid, scope = 'all') { return (await db.query(bind(blocks[2].replace('%s', scopeFilter(scope))), [aid])).rows; }
async function producers(keyword) { return (await db.query(bind(blocks[1]), [keyword, pattern(keyword)])).rows; }
async function exactProducer(uid) { return (await db.query(bind(blocks[3]), [uid])).rows; }
const ids = (result) => result.rows.map((row) => Number(row.aid));
let passed = 0;
const test = async (name, run) => { await run(); passed += 1; console.log(`PASS ${name}`); };
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  await db.exec(await readFile(new URL('../adm_uniseek_videos.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../video_content_labels.sql', import.meta.url), 'utf8'));
  await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
    (aid,bvid,title,pubdate,user_id,tag_new,view,favorite,"like",coin,record_date,batch_id,refreshed_at) VALUES
    (1,'BV1Ts411S7SM','世末歌者',100,1,NULL,0,101,0,0,'2026-10-20','${batchA}',now()),
    (2,'BV2','【乐正绫】世末歌者',100,1,ARRAY['乐正绫','世末歌者'],1000000000,102,102,1,'2026-10-20','${batchA}',now()),
    (3,'BV3','世末歌者 很长的标题',100,1,NULL,1000,103,103,1,'2026-10-20','${batchA}',now()),
    (5,'BV5','标题里没有关键词',100,1,ARRAY['世末歌者','言和'],0,104,104,1,'2026-10-20','${batchA}',now()),
    (6,'BV6','123木头人',100,1,NULL,0,105,105,0,'2026-10-20','${batchA}',now()),
    (123,'BV123','无关歌名',100,1,NULL,0,106,106,0,'2026-10-20','${batchA}',now()),
    (7,'BV7','100%_真实',100,1,NULL,10,107,107,0,'2026-10-20','${batchA}',now()),
    (8,'BV8','言和 但没有标签',100,1,NULL,0,108,108,0,'2026-10-20','${batchA}',now()),
    (10,'BV10','言和',100,1,ARRAY['言和'],NULL,109,NULL,NULL,'2026-10-20','${batchA}',now()),
    (20,'BV20','同分',100,1,NULL,10,110,101,0,'2026-10-20','${batchA}',now()),
    (21,'BV21','同分',100,1,NULL,10,110,101,0,'2026-10-20','${batchA}',now());`);
  await test('keyword and exact-ID SQL run with no raw video or Daily tables present', async () => {
    const tables = (await db.query(`SELECT to_regclass('hantang_dynamic.processed_videos') AS raw,
      to_regclass('hantang_dynamic.video_daily') AS daily`)).rows[0];
    assert.deepEqual(tables, { raw: null, daily: null });
    assert.equal((await exactVideo(123))[0].bvid, 'BV123');
    assert.deepEqual(await exactVideo(404), []);
    assert.ok((await ranked('世末歌者')).length > 0);
  });
  await test('three-component scores combine relevance and popularity, with stable pages and preserved NULL/zero metrics', async () => {
    const first = await search('世末歌者');
    assert.equal(first.hasMore, true);
    assert.deepEqual(ids(first), [2, 1]);
    assert.deepEqual(ids(await search('世末歌者', { page: 2 })), [3, 5]);
    assert.equal((await search('世末歌者', { page: 2 })).hasMore, false);
    assert.deepEqual(ids(await search('世末歌者', { page: 3 })), []);
    assert.equal(first.rows[1].view, 0);
    assert.equal(first.rows[1].favorite, 101);
    assert.equal(first.rows[1].like, 0);
    assert.equal(first.rows[0].record_date, '2026-10-20');
    assert.equal(first.rows[0].batch_id, batchA);
    assert.equal((await search('言和')).rows[0].view, null);
    assert.equal((await exactVideo(10))[0].like, null);
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
  await test('normal queries retain 100-point components and singers use the configured popularity weight', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
      (aid,bvid,title,tag_new,view,favorite,record_date,batch_id,refreshed_at) VALUES
      (1200,'BV1200','言和',NULL,0,101,'2026-10-20','${batchA}',now()),
      (1201,'BV1201','【言和】高播放投稿',NULL,10000000,101,'2026-10-20','${batchA}',now()),
      (1202,'BV1202','演唱',ARRAY['言和'],0,101,'2026-10-20','${batchA}',now()),
      (1203,'BV1203','归一化',NULL,0,101,'2026-10-20','${batchA}',now()),
      (1204,'BV1204','归一化与其他',NULL,100,101,'2026-10-20','${batchA}',now()),
      (1205,'BV1205','归一化',NULL,10000000,101,'2026-10-20','${batchA}',now()),
      (1206,'BV1206','归一化',NULL,1000000000,101,'2026-10-20','${batchA}',now()),
      (1207,'BV1207','甲',ARRAY['归一化'],NULL,101,'2026-10-20','${batchA}',now()),
      (1208,'BV1208',NULL,ARRAY['归一化'],0,101,'2026-10-20','${batchA}',now()),
      (1209,'BV1209','',ARRAY['归一化'],0,101,'2026-10-20','${batchA}',now()),
      (1210,'BV1210','归一化',NULL,1000000,101,'2026-10-20','${batchA}',now());`);
    const rows = await ranked('归一化');
    const byAid = new Map(rows.map(row => [Number(row.aid), row]));
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
    near(byAid.get(1203).score, 200);
    near(byAid.get(1204).score, 70 + 50 + 100 * Math.log(2) / Math.log(10000001 / 100));
    near(byAid.get(1205).score, 300);
    near(byAid.get(1206).score, 300);
    near(byAid.get(1207).score, 140);
    near(byAid.get(1208).score, 40);
    near(byAid.get(1209).score, 40);
    near(byAid.get(1210).score, 200 + 100 * Math.log(10001) / Math.log(10000001 / 100));
    assert.ok(byAid.get(1210).score < 300);
    assert.deepEqual(rows.slice(0, 2).map(row => Number(row.aid)), [1206, 1205]);
    const vocalRows = await ranked('言和');
    const vocalByAid = new Map(vocalRows.map(row => [Number(row.aid), row]));
    near(vocalByAid.get(1200).score, 110);
    near(vocalByAid.get(1202).score, 104);
    near(vocalByAid.get(1201).score, 7 + 100 * 2 / 9 + 500);
    assert.ok(vocalRows.findIndex(row => Number(row.aid) === 1201) < vocalRows.findIndex(row => Number(row.aid) === 1200),
      'a high-view title containing 言和 should outrank an exact low-view 言和 title');
  });
  await test('singer and CP searches favor hits while song titles and combined queries keep relevance priority', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
      (aid,bvid,title,view,favorite,record_date,batch_id,refreshed_at) VALUES
      (1300,'BV1300','南北组',0,101,'2026-10-20','${batchA}',now()),
      (1301,'BV1301','【南北组】热门歌曲及创作幕后与制作花絮的加长版本',10000000,101,'2026-10-20','${batchA}',now()),
      (1302,'BV1302','【南北组】热门歌曲及创作幕后与制作花絮的加长版本',1000000000,101,'2026-10-20','${batchA}',now()),
      (1303,'BV1303','【南北组】热门歌曲及创作幕后与制作花絮的加长版本',1000000,101,'2026-10-20','${batchA}',now()),
      (1304,'BV1304','南北组',NULL,101,'2026-10-20','${batchA}',now()),
      (1310,'BV1310','洛天依',0,101,'2026-10-20','${batchA}',now()),
      (1311,'BV1311','【洛天依】热门歌曲及创作幕后与制作花絮的加长版本',10000000,101,'2026-10-20','${batchA}',now()),
      (1312,'BV1312','乐正绫',0,101,'2026-10-20','${batchA}',now()),
      (1313,'BV1313','【乐正绫】热门歌曲及创作幕后与制作花絮的加长版本',10000000,101,'2026-10-20','${batchA}',now()),
      (1320,'BV1320','霜雪千年',0,101,'2026-10-20','${batchA}',now()),
      (1321,'BV1321','【洛天依】霜雪千年——包含创作幕后与制作花絮的加长版本',10000000,101,'2026-10-20','${batchA}',now()),
      (1322,'BV1322','洛天依 霜雪千年',0,101,'2026-10-20','${batchA}',now());`);
    const cp = await ranked('南北组');
    assert.deepEqual(cp.map(row => Number(row.aid)), [1302,1301,1303,1304,1300]);
    assert.equal(cp[0].score, cp[1].score, 'views above ten million must not add score');
    const titleRatio = 100 * 3 / cp[1].title.length;
    assert.ok(Math.abs(cp[1].score - (70 + titleRatio + 500)) < 1e-8);
    assert.ok(70 + titleRatio + 100 < 200, 'the popularity weight should reverse this old relevance-first order');
    assert.equal(cp.at(-1).score, 200, 'CP queries keep the original source score');
    assert.equal(cp.at(-2).score, 200, 'NULL views contribute zero');
    for (const [keyword, hit, exact] of [['洛天依',1311,1310], ['乐正绫',1313,1312]]) {
      const rows = await ranked(keyword);
      assert.ok(rows.findIndex(row => Number(row.aid) === hit) < rows.findIndex(row => Number(row.aid) === exact),
        `${keyword}: the popular song should beat the exact low-view title`);
    }
    const songs = await ranked('霜雪千年');
    assert.equal(Number(songs[0].aid), 1320, 'an exact song title should beat this broader popular video');
    assert.equal(songs[0].score, 200);
    assert.equal(Number((await ranked('洛天依 霜雪千年'))[0].aid), 1322,
      'mentioning a singer alongside a song title must not trigger popularity mode');
    await db.exec('DELETE FROM hantang_dynamic.adm_uniseek_videos WHERE aid BETWEEN 1300 AND 1322');
  });
  await test('ties use aid descending and admission requires more than 100 favorites', async () => {
    assert.deepEqual(ids(await search('同分', { pageSize: 1 })), [21]);
    assert.equal((await search('同分', { pageSize: 1 })).hasMore, true);
    assert.deepEqual(ids(await search('同分', { page: 2, pageSize: 1 })), [20]);
    for (const favorites of [100, 0, null]) {
      await assert.rejects(() => db.query(`INSERT INTO hantang_dynamic.adm_uniseek_videos
        (aid,bvid,favorite,record_date,batch_id,refreshed_at) VALUES (99,'BV99',$1,'2026-10-20',$2,now())`, [favorites, batchA]));
    }
  });
  await test('all matches are ranked before the beta 1000-row return limit', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos
      (aid,bvid,title,view,favorite,record_date,batch_id,refreshed_at)
      SELECT i,'BV'||i,'limit test',CASE WHEN i=2000 THEN 1000000000 ELSE 0 END,101,
      '2026-10-20','${batchA}',now() FROM generate_series(2000,3000) i`);
    const rows = await ranked('limit test');
    assert.equal(rows.length, 1000);
    assert.equal(Number(rows[0].aid), 2000, 'high-view match must not be lost by an earlier text-only cutoff');
    assert.equal(rows.some((row) => Number(row.aid) === 2001), false);
    assert.equal((await search('limit test', { page: 20, pageSize: 50 })).hasMore, false);
    await db.query(`INSERT INTO hantang_dynamic.video_content_labels(aid,is_song,is_virtual_singer,languages,label_source,input_sha256)
      VALUES (2001,'是','是',ARRAY['汉语'],'manual',$1)`, ['a'.repeat(64)]);
    assert.deepEqual((await ranked('limit test', 'chinese_virtual_song')).map(row => Number(row.aid)), [2001],
      'scope filtering must happen before the 1000-result limit, even when a matching song ranked outside the all-video cutoff');
  });
  await test('all, virtual and Chinese scopes include mixed vocals and preserve unmarked videos only in all', async () => {
    await db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos(aid,bvid,title,view,favorite,record_date,batch_id,refreshed_at)
      SELECT i,'BV'||i,'scope test',100,101,'2026-10-20','${batchA}',now() FROM generate_series(4100,4106) i`);
    const labels = [
      [4100,'是','是',['汉语']], [4101,'是','混合',['日语','汉语']], [4102,'是','是',['日语']],
      [4103,'是','否',['汉语']], [4104,'否','否',['无语言']], [4105,'不确定','不确定',['未知语言']],
      [4107,'是','是',['汉语']], // A historical label outside the current candidate set.
    ];
    const write = row => db.query(`INSERT INTO hantang_dynamic.video_content_labels
      (aid,is_song,is_virtual_singer,languages,label_source,input_sha256) VALUES ($1,$2,$3,$4::text[],'manual',$5)`, [...row,'a'.repeat(64)]);
    for (const row of labels) await write(row);
    const aids = async scope => (await ranked('scope test', scope)).map(row => Number(row.aid)).sort((a,b) => a-b);
    assert.deepEqual(await aids('all'), [4100,4101,4102,4103,4104,4105,4106]);
    assert.deepEqual(await aids('virtual_song'), [4100,4101,4102]);
    assert.deepEqual(await aids('chinese_virtual_song'), [4100,4101]);
    assert.equal((await exactVideo(4106, 'all')).length, 1);
    assert.deepEqual(await exactVideo(4106, 'virtual_song'), []);
    assert.deepEqual(await exactVideo(4102, 'chinese_virtual_song'), []);
    assert.equal((await exactVideo(4102, 'virtual_song')).length, 1);
    assert.deepEqual(await exactVideo(4107, 'all'), []);
    await write([4106,'是','是',['汉语']]);
    assert.deepEqual(await aids('chinese_virtual_song'), [4100,4101,4106]);
    await db.exec('DELETE FROM hantang_dynamic.video_content_labels');
    assert.deepEqual(await aids('chinese_virtual_song'), []);
    assert.equal((await aids('all')).length, 7);
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
