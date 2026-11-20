// Isolated PGlite only; never connects to the business database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const read = name => readFile(new URL(`../${name}`, import.meta.url),'utf8');
const source = await readFile(new URL('../../src/main/java/com/hantang/web/dao/VideoContentLabelDao.java',import.meta.url),'utf8');
const block = name => source.match(new RegExp(`String ${name} = """([\\s\\S]*?)""";`))[1];
const quoted = name => source.match(new RegExp(`String ${name} = "([^"]+)";`))[1];
const bind = text => { let i=0;return text.replaceAll('?',()=>`$${++i}`); };
const q = async (text,params=[]) => (await db.query(text,params)).rows;
const selection = mode => q(bind(block('SELECT_SQL').replace('%s',quoted(mode==='incremental'?'INCREMENTAL_FILTER':'OVERWRITE_FILTER'))),[20]);
const sql = (count,mode) => bind(block('INSERT_HEADER')+Array(count).fill(quoted('INSERT_ROW')).join(',')+'\n'+(mode==='incremental'?quoted('INCREMENTAL_CONFLICT'):block('OVERWRITE_CONFLICT')));
const row = (aid,voice='是') => [aid,'是',voice,['汉语'],'test-qwen','b'.repeat(64),'a'.repeat(64),'bulk-test'];
const write = (aids,mode='incremental') => q(sql(aids.length,mode),aids.flatMap(aid=>row(aid)));
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  await db.exec(await read('video_content_labels.sql'));
  await db.exec(await read('adm_uniseek_videos.sql'));
  await db.exec('CREATE TABLE hantang_dynamic.processed_videos(aid bigint,description text)');
  for(let aid=1;aid<=5;aid++) {
    await q(`INSERT INTO hantang_dynamic.adm_uniseek_videos(aid,bvid,title,tag_new,favorite,record_date,batch_id,refreshed_at)
      VALUES($1,$2,'标题',ARRAY['标签'],101,'2026-11-20','00000000-0000-0000-0000-000000000001',now())`,[aid,`BV${aid}`]);
    await q('INSERT INTO hantang_dynamic.processed_videos VALUES($1,$2)',[aid,`简介${aid}`]);
  }
  const overview=()=>q(block('OVERVIEW_SQL'));
  assert.equal(Number((await overview())[0].unlabeled_count),5);
  assert.deepEqual((await selection('incremental')).map(r=>Number(r.aid)),[1,2,3,4,5]);
  assert.equal((await write([1,2])).length,2);
  assert.deepEqual((await selection('incremental')).map(r=>Number(r.aid)),[3,4,5]);
  assert.equal((await write([2,3])).length,1); // A competing successful insert is preserved in incremental mode.
  await q("UPDATE hantang_dynamic.video_content_labels SET label_source='manual',is_virtual_singer='否' WHERE aid=1");
  assert.deepEqual((await selection('overwrite')).map(r=>Number(r.aid)),[2,3,4,5]);
  assert.equal((await write([1,2,4],'overwrite')).length,2);
  const manual=(await q('SELECT * FROM hantang_dynamic.video_content_labels WHERE aid=1'))[0];
  assert.equal(manual.label_source,'manual');assert.equal(manual.is_virtual_singer,'否');
  assert.equal(Number((await overview())[0].labeled_count),4);
  assert.equal(Number((await overview())[0].unlabeled_count),1);
  // One malformed row rolls back the entire multirow statement.
  const params=[...row(5),...row(6)];params[9]='非法歌曲枚举';
  await assert.rejects(q(sql(2,'incremental'),params),/constraint/);
  assert.equal((await q('SELECT aid FROM hantang_dynamic.video_content_labels WHERE aid IN(5,6)')).length,0);
  await write([5]);assert.equal(Number((await overview())[0].unlabeled_count),0);
  // The source query exposes missing input metadata rather than silently shrinking the selected scope.
  await q('DELETE FROM hantang_dynamic.processed_videos WHERE aid=5');
  const rows=await selection('overwrite');assert.equal(rows.find(r=>Number(r.aid)===5).input_aid,null);
  // Reproduce the requested 200k backlog: label 10k, then continue with the next 20k.
  await db.exec(`DELETE FROM hantang_dynamic.video_content_labels;
    DELETE FROM hantang_dynamic.adm_uniseek_videos;
    DELETE FROM hantang_dynamic.processed_videos;
    INSERT INTO hantang_dynamic.adm_uniseek_videos(aid,bvid,title,favorite,record_date,batch_id,refreshed_at)
    SELECT g,'BV'||g,'投稿'||g,101,'2026-11-20','00000000-0000-0000-0000-000000000001',now() FROM generate_series(1,200000) g;
    INSERT INTO hantang_dynamic.processed_videos SELECT g,'简介'||g FROM generate_series(1,200000) g;
    INSERT INTO hantang_dynamic.video_content_labels(aid,is_song,is_virtual_singer,languages,label_source,model,prompt_sha256,input_sha256,source_run_id)
    SELECT g,'是','混合',ARRAY['汉语'],'llm','test-qwen',repeat('b',64),repeat('a',64),'bulk-first-10k' FROM generate_series(1,10000) g;`);
  assert.equal(Number((await overview())[0].unlabeled_count),190000);
  const second=await q(bind(block('SELECT_SQL').replace('%s',quoted('INCREMENTAL_FILTER'))),[20000]);
  assert.equal(second.length,20000); assert.equal(Number(second[0].aid),10001); assert.equal(Number(second.at(-1).aid),30000);
  await db.exec(`INSERT INTO hantang_dynamic.video_content_labels(aid,is_song,is_virtual_singer,languages,label_source,model,prompt_sha256,input_sha256,source_run_id)
    SELECT g,'是','混合',ARRAY['汉语'],'llm','test-qwen',repeat('b',64),repeat('a',64),'bulk-next-20k' FROM generate_series(10001,30000) g;`);
  const after=(await overview())[0];
  assert.equal(Number(after.total_count),200000); assert.equal(Number(after.labeled_count),30000); assert.equal(Number(after.unlabeled_count),170000);
  console.log('PASS isolated 200k backlog: first 10k then next 20k without repeats, 170k remain');
  console.log('PASS production DAO SQL: incremental continuation, overwrite, manual protection, atomic batches, coverage and missing metadata');
} finally {await db.close();}
