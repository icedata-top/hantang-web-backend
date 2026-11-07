// 独立内存PostgreSQL验证，不连接业务库。仅测试依赖PGlite，不是生产运行依赖。
// npm install --prefix /tmp/adm-sql-test @electric-sql/pglite
// PGLITE_MODULE_PATH=/tmp/adm-sql-test/node_modules/@electric-sql/pglite/dist/index.js node sql/tests/adm_aggregation.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => (await q(sql, params))[0];
const metrics = ['view', 'favorite', 'like', 'coin', 'share', 'reply', 'danmaku'];
const aids = Array.from({ length: 50 }, (_, i) => i + 1);
const enqueue = async (force = false, maxAttempts = 3) => one(
  `SELECT hantang_dynamic.adm_enqueue_aggregation_days('2026-10-20', '2026-10-20', $1::bigint[], 'zhongshu50-v1', $2, 1, 0, $3) AS n`,
  [aids, maxAttempts, force],
);
const run = () => q('CALL hantang_dynamic.adm_process_one_aggregation_task()');
const task = () => one('SELECT * FROM hantang_dynamic.adm_aggregation_task');
const total = () => one(`SELECT * FROM hantang_dynamic.adm_entity_metrics_daily WHERE scope_key='all' AND dimension_type='total'`);
const snapshot = () => one(`SELECT jsonb_agg(to_jsonb(t) ORDER BY scope_key,dimension_type,dimension_key) AS rows FROM hantang_dynamic.adm_entity_metrics_daily t`);
let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
try {
  console.log((await one('SELECT version() AS version')).version);
  await db.exec('CREATE SCHEMA hantang_dynamic');
  const source = await read('hantang_dynamic_schema.sql');
  await db.exec(source.slice(source.indexOf('CREATE TABLE hantang_dynamic.processed_videos'), source.indexOf('CREATE TABLE hantang_dynamic.discovered_users')).replace('    like integer', '    \"like\" integer'));
  await db.exec(await read('adm_entity_metrics_daily_draft.sql'));
  const install = await read('adm_aggregation_install.sql');
  const maintained = (await read('adm_aggregation_task.sql')) + '\n' + (await read('adm_aggregation_routines.sql')) + '\n' + (await read('adm_aggregation_schedule.sql'));
  const normalized = maintained.split(/\r?\n/).filter(line=>line.trim() && !line.trimStart().startsWith('--')).join('\n');
  assert.equal(install, `BEGIN;\n${normalized}\nCOMMIT;\n`, '直接执行版与带注释维护版必须保持一致');
  assert.ok(install.split(/\r?\n/).slice(0,-1).every(line=>line.trim()), '直接执行版不能有空行');
  const schedule = await read('adm_aggregation_schedule.sql');
  const scheduleCompact = schedule.split(/\r?\n/).filter(line=>line.trim() && !line.trimStart().startsWith('--')).join('\n');
  assert.equal(await read('adm_aggregation_schedule_update.sql'), `BEGIN;\n${scheduleCompact}\nCOMMIT;\n`);
  const scheduledAids = schedule.match(/p_sample_aids => ARRAY\[([\s\S]*?)\]::bigint\[\]/)[1].split(',').map(s=>Number(s.trim()));
  const configuredAids = JSON.parse(await readFile(new URL('../../src/main/resources/config/zhongshu-50.json',import.meta.url),'utf8')).aids;
  assert.deepEqual(scheduledAids,configuredAids);
  await db.exec(install);
  await db.exec(await read('adm_aggregation_schedule_update.sql'));
  await db.exec(`INSERT INTO hantang_dynamic.processed_videos(aid,bvid,pubdate,type_id,tid_v2,is_filtered,is_deleted)
    SELECT i,'BV'||i,extract(epoch FROM '2027-01-01 00:00+08'::timestamptz)::bigint,1,101,false,false FROM generate_series(1,50) i;
    UPDATE hantang_dynamic.processed_videos SET pubdate=extract(epoch FROM '2026-10-01 00:00+08'::timestamptz)::bigint WHERE aid<=3;
    UPDATE hantang_dynamic.processed_videos SET type_id=2,tid_v2=202 WHERE aid=2;
    UPDATE hantang_dynamic.processed_videos SET pubdate=extract(epoch FROM '2026-10-20 12:00+08'::timestamptz)::bigint,type_id=NULL,tid_v2=NULL WHERE aid=3;
    INSERT INTO hantang_dynamic.processed_videos(aid,bvid,pubdate,type_id,tid_v2,is_filtered,is_deleted) VALUES
      (52,'BV52',1700000000,9,909,false,true),(53,'BV53',1700000000,1,101,true,false);`);
  for (const [date, values] of [['2026-10-20', [[1,100],[2,200],[3,300],[52,900],[53,50]]], ['2026-10-21',[[1,150],[2,190],[3,330],[52,999],[53,55]]]]) {
    for (const [aid, n] of values) await q(`INSERT INTO hantang_dynamic.video_daily(record_date,aid,${metrics.map(m=>`"${m}"`).join(',')}) VALUES ($1,$2,${metrics.map((_,i)=>`$${i+3}`).join(',')})`,[date,aid,...metrics.map(()=>n)]);
  }
  await test('DDL和函数/过程可创建；样本约束拒绝重复、NULL和非正数', async () => {
    assert.equal((await one('SELECT hantang_dynamic.adm_valid_sample_aids($1) AS ok',[aids])).ok,true);
    for (const bad of [[...aids.slice(0,49),1],[...aids.slice(0,49),null],[...aids.slice(0,49),0]]) {
      assert.equal((await one('SELECT hantang_dynamic.adm_valid_sample_aids($1) AS ok',[bad])).ok,false);
    }
  });
  await test('幂等入队和一个业务日四类结果',async()=>{
    assert.equal((await enqueue()).n,1); assert.equal((await enqueue()).n,0);
    await run(); const t=await task(), row=await total();
    assert.equal(t.status,'succeeded'); assert.equal(t.attempt_count,1);
    assert.equal(Number(row.video_count),4); assert.equal(Number(row.submission_count),1);
    assert.equal(Number(row.view_total),725); assert.equal(Number(row.view_delta),75);
    assert.equal(row.is_complete,true); assert.equal(row.batch_id,t.attempt_id);
    assert.equal(Number((await one('SELECT count(*) AS n FROM hantang_dynamic.adm_entity_metrics_daily')).n),8);
    assert.equal(Number((await one(`SELECT count(*) AS n FROM hantang_dynamic.adm_entity_metrics_daily WHERE scope_key<>'all' AND dimension_type<>'total'`)).n),0);
    const sample=await one(`SELECT * FROM hantang_dynamic.adm_entity_metrics_daily WHERE scope_key='zhongshu50-v1'`);
    assert.equal(Number(sample.video_count),3); assert.equal(Number(sample.view_total),670);
    const batch=t.attempt_id; await run(); assert.equal((await task()).attempt_id,batch);
  });
  await test('显式重算覆盖，不重复累加，并清除消失的分区行',async()=>{
    await db.exec(`UPDATE hantang_dynamic.processed_videos SET type_id=1,tid_v2=101 WHERE aid=2`);
    assert.equal((await enqueue(true)).n,1); await run();
    assert.equal(Number((await total()).view_delta),75);
    assert.equal(Number((await one(`SELECT count(*) AS n FROM hantang_dynamic.adm_entity_metrics_daily WHERE dimension_key IN ('2','202')`)).n),0);
  });
  await test('缺失期初不补零，保留其他完整指标与覆盖计数',async()=>{
    await db.exec(`UPDATE hantang_dynamic.video_daily SET view=NULL WHERE aid=2 AND record_date='2026-10-20'`);
    await enqueue(true); await run(); const row=await total();
    assert.equal(row.view_delta,null); assert.equal(Number(row.view_total),725);
    assert.equal(Number(row.favorite_delta),75); assert.equal(Number(row.end_snapshot_count),4);
    assert.equal(Number(row.delta_covered_count),3); assert.equal(row.is_complete,false);
    await db.exec(`UPDATE hantang_dynamic.video_daily SET view=200 WHERE aid=2 AND record_date='2026-10-20'`);
  });
  await test('整页快照缺失影响相邻两个业务日的差分',async()=>{
    await db.exec(`DELETE FROM hantang_dynamic.video_daily WHERE aid=1 AND record_date='2026-10-20'`);
    const a=await one(`SELECT hantang_dynamic.adm_calculate_daily_metrics('2026-10-19','zhongshu50-v1',$1) AS p`,[aids]);
    const b=await one(`SELECT hantang_dynamic.adm_calculate_daily_metrics('2026-10-20','zhongshu50-v1',$1) AS p`,[aids]);
    assert.equal(a.p.rows.find(r=>r.scope_key==='all'&&r.dimension_type==='total').view_delta,null);
    assert.equal(b.p.rows.find(r=>r.scope_key==='all'&&r.dimension_type==='total').view_delta,null);
    await q(`INSERT INTO hantang_dynamic.video_daily(record_date,aid,${metrics.map(m=>`"${m}"`).join(',')}) VALUES ('2026-10-20',1,100,100,100,100,100,100,100)`);
  });
  await test('源重复记录失败且保留此前正式结果',async()=>{
    const before=await snapshot();
    await db.exec(`INSERT INTO hantang_dynamic.video_daily SELECT * FROM hantang_dynamic.video_daily WHERE aid=1 AND record_date='2026-10-20'`);
    await enqueue(true); await run();
    assert.equal((await task()).status,'failed'); assert.equal((await task()).last_error_sqlstate,'21000');
    assert.deepEqual(await snapshot(),before);
    await db.exec(`DELETE FROM hantang_dynamic.video_daily WHERE aid=1 AND record_date='2026-10-20'; INSERT INTO hantang_dynamic.video_daily(record_date,aid,${metrics.map(m=>`"${m}"`).join(',')}) VALUES ('2026-10-20',1,100,100,100,100,100,100,100)`);
  });
  await test('插入中途出错回滚删除与所有已插入行；有限重试不超限',async()=>{
    const before=await snapshot();
    await db.exec(`CREATE FUNCTION hantang_dynamic.test_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN IF NEW.dimension_type='partition_v2' THEN RAISE EXCEPTION 'test transient failure' USING ERRCODE='40001'; END IF; RETURN NEW; END;$$;
      CREATE TRIGGER fail_insert BEFORE INSERT ON hantang_dynamic.adm_entity_metrics_daily FOR EACH ROW EXECUTE FUNCTION hantang_dynamic.test_fail_insert();`);
    await enqueue(true,2); await run();
    assert.equal((await task()).status,'retry_wait'); assert.equal((await task()).attempt_count,1);
    assert.deepEqual(await snapshot(),before);
    await db.exec(`UPDATE hantang_dynamic.adm_aggregation_task SET next_attempt_at=clock_timestamp()`);
    await run(); assert.equal((await task()).status,'failed'); assert.equal((await task()).attempt_count,2);
    assert.deepEqual(await snapshot(),before);
    await run(); assert.equal((await task()).attempt_count,2);
    assert.equal((await enqueue(false)).n,0); assert.equal((await task()).attempt_count,2);
    await db.exec('DROP TRIGGER fail_insert ON hantang_dynamic.adm_entity_metrics_daily');
  });
  await test('遗留running恢复保留已提交次数',async()=>{
    await enqueue(true,2);
    await db.exec(`UPDATE hantang_dynamic.adm_aggregation_task SET status='running',attempt_count=1,attempt_id=gen_random_uuid()`);
    await run(); assert.equal((await task()).status,'retry_wait'); assert.equal((await task()).attempt_count,1);
    await db.exec(`UPDATE hantang_dynamic.adm_aggregation_task SET next_attempt_at=clock_timestamp()`);
    await run(); assert.equal((await task()).status,'succeeded'); assert.equal((await task()).attempt_count,2);
    await db.exec(`UPDATE hantang_dynamic.adm_aggregation_task SET status='running',attempt_count=2`);
    await run(); assert.equal((await task()).status,'failed'); assert.equal((await task()).attempt_count,2);
  });
  await test('integer差分先转bigint，允许负值及大于integer范围',async()=>{
    await db.exec(`UPDATE hantang_dynamic.video_daily SET view=-2147483648 WHERE aid=1 AND record_date='2026-10-20'; UPDATE hantang_dynamic.video_daily SET view=2147483647 WHERE aid=1 AND record_date='2026-10-21'`);
    await enqueue(true); await run(); assert.equal(Number((await total()).view_delta),4294967320);
  });
  await test('空历史集合返回两个零值total，不虚构分区或样本作品',async()=>{
    const result=await one(`SELECT hantang_dynamic.adm_calculate_daily_metrics('2000-01-01','zhongshu50-v1',$1) AS p`,[aids]);
    assert.equal(result.p.rows.length,2);
    assert.ok(result.p.rows.every(r=>r.video_count===0&&r.view_delta===0&&r.is_complete));
  });
  await test('同scope更换样本名单被拒绝，样本版本不可静默变更',async()=>{
    const changed=[...aids.slice(0,49),51];
    await assert.rejects(q(`SELECT hantang_dynamic.adm_enqueue_aggregation_days('2026-10-19','2026-10-19',$1::bigint[])`,[changed]),e=>e.code==='22023');
  });
  await test('存量按日入队，调用一次仅完成一个日期',async()=>{
    assert.equal((await one(`SELECT hantang_dynamic.adm_enqueue_aggregation_days('2026-10-18','2026-10-19',$1::bigint[]) AS n`,[aids])).n,2);
    await run();
    assert.equal(Number((await one(`SELECT count(*) AS n FROM hantang_dynamic.adm_aggregation_task WHERE stat_date IN ('2026-10-18','2026-10-19') AND status='succeeded'`)).n),1);
    await run();
    assert.equal(Number((await one(`SELECT count(*) AS n FROM hantang_dynamic.adm_aggregation_task WHERE stat_date IN ('2026-10-18','2026-10-19') AND status='succeeded'`)).n),2);
  });
  await test('显式事务内CALL拒绝执行且未遗留会话锁',async()=>{
    await db.exec('BEGIN');
    await assert.rejects(run(),e=>e.code==='2D000');
    await db.exec('ROLLBACK');
    assert.equal((await one('SELECT pg_advisory_unlock(18291,1) AS held')).held,false);
  });
  await test('调度使用北京时间09:00边界，不受会话时区影响',async()=>{
    await db.exec("SET TIME ZONE 'America/Los_Angeles'");
    assert.equal((await one("SELECT hantang_dynamic.adm_scheduled_business_day('2026-10-26 08:59:59+08')::text AS d")).d,null);
    assert.equal((await one("SELECT hantang_dynamic.adm_scheduled_business_day('2026-10-26 09:00:00+08')::text AS d")).d,'2026-10-25');
    assert.equal((await one("SELECT hantang_dynamic.adm_scheduled_business_day('2026-10-26 23:59:59+08')::text AS d")).d,'2026-10-25');
    assert.equal((await one("SELECT hantang_dynamic.adm_scheduled_business_day('2026-10-27 00:00:00+08')::text AS d")).d,null);
  });
  await test('调度重复调用不重复聚合成功日期或重置失败任务次数',async()=>{
    const realAids=JSON.parse(await readFile(new URL('../../src/main/resources/config/zhongshu-50.json',import.meta.url),'utf8')).aids;
    for(const aid of realAids) await q("INSERT INTO hantang_dynamic.processed_videos(aid,bvid,pubdate,is_filtered,is_deleted) VALUES($1,'BVschedule',1798732800,false,false)",[aid]);
    await db.exec('DELETE FROM hantang_dynamic.adm_aggregation_task');
    const day=(await one('SELECT hantang_dynamic.adm_scheduled_business_day(clock_timestamp())::text AS d')).d;
    await q('CALL hantang_dynamic.adm_schedule_aggregation_tick()');
    if(day===null){ assert.equal(Number((await one('SELECT count(*) AS n FROM hantang_dynamic.adm_aggregation_task')).n),0); }
    else {
      const first=await task(); assert.equal(first.status,'succeeded'); assert.equal(first.attempt_count,1);
      await q('CALL hantang_dynamic.adm_schedule_aggregation_tick()'); assert.equal((await task()).attempt_id,first.attempt_id);
      await db.exec("UPDATE hantang_dynamic.adm_aggregation_task SET status='failed',attempt_count=max_attempts");
      await q('CALL hantang_dynamic.adm_schedule_aggregation_tick()'); assert.equal((await task()).status,'failed'); assert.equal((await task()).attempt_count,3);
    }
  });
  console.log(`PASS ${passed} integration scenarios`);
} catch (error) {
  console.error(error.message, error.code ?? '', error.where ?? '');
  process.exitCode = 1;
} finally { await db.close(); }
