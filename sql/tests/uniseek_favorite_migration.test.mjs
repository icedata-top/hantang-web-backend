// Isolated PostgreSQL only; no connection to the business database.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH ?? '@electric-sql/pglite');
const db = new PGlite();
const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
const q = async sql => (await db.query(sql)).rows;
const one = async sql => (await q(sql))[0];
const compact = text => text.split(/\r?\n/).filter(line => line.trim() && !line.trimStart().startsWith('--')).join('\n') + '\n';
try {
  await db.exec('CREATE SCHEMA hantang_dynamic');
  const schema = await read('hantang_dynamic_schema.sql');
  await db.exec(schema.slice(schema.indexOf('CREATE TABLE hantang_dynamic.processed_videos'), schema.indexOf('CREATE TABLE hantang_dynamic.discovered_users')).replace('    like integer', '    "like" integer'));
  const install = await read('adm_uniseek_videos_install.sql');
  await db.exec(install);
  // Model the already-published likes-based production schema and one low-favorite legacy row.
  await db.exec(`ALTER TABLE hantang_dynamic.adm_uniseek_videos DROP CONSTRAINT adm_uniseek_videos_favorite_check;
    ALTER TABLE hantang_dynamic.adm_uniseek_videos ALTER COLUMN favorite DROP NOT NULL;
    ALTER TABLE hantang_dynamic.adm_uniseek_videos ALTER COLUMN "like" SET NOT NULL;
    ALTER TABLE hantang_dynamic.adm_uniseek_videos ADD CONSTRAINT adm_uniseek_videos_like_check CHECK ("like">100);
    INSERT INTO hantang_dynamic.adm_uniseek_videos(aid,bvid,title,favorite,"like",record_date,batch_id,refreshed_at)
      VALUES (1,'BV1','legacy',0,101,'2026-10-20','00000000-0000-0000-0000-000000000001',now());
    UPDATE hantang_dynamic.adm_uniseek_refresh_state SET
      published_record_date='2026-10-20',published_batch_id='00000000-0000-0000-0000-000000000001',published_at=now(),published_row_count=1;
    CREATE ROLE test_uniseek_reader;
    GRANT USAGE ON SCHEMA hantang_dynamic TO test_uniseek_reader;
    GRANT SELECT ON hantang_dynamic.adm_uniseek_videos TO test_uniseek_reader;
    INSERT INTO hantang_dynamic.processed_videos(aid,bvid,title,pubdate,is_filtered,is_deleted) VALUES
      (1,'BV1','old',100,false,false),(9007199254740993,'BV2','recent',1793635200,false,false),
      (3,'BV3','missing likes',200,false,false),(4,'BV4','100 favorites',300,false,false);
    INSERT INTO hantang_dynamic.video_daily(record_date,aid,favorite,"like") VALUES
      ('2026-10-20',1,0,999),('2026-10-20',9007199254740993,101,0),
      ('2026-10-20',3,200,NULL),('2026-10-20',4,100,999);`);
  const oid = (await one("SELECT 'hantang_dynamic.adm_uniseek_videos'::regclass::oid AS oid")).oid;
  const migration = await read('adm_uniseek_videos_favorite_migrate.sql');
  const procedure = (await read('adm_uniseek_videos_refresh.sql')).split('CREATE OR REPLACE PROCEDURE')[1];
  assert.ok(migration.includes(compact('CREATE OR REPLACE PROCEDURE' + procedure)));
  assert.ok(migration.trimEnd().split('\n').every(line => line.trim()));
  assert.doesNotMatch(migration.split('CREATE OR REPLACE PROCEDURE')[0], /DROP TABLE|TRUNCATE|DELETE FROM/i);
  await db.exec(migration);
  assert.equal(Number((await one('SELECT favorite FROM hantang_dynamic.adm_uniseek_videos')).favorite), 0, 'migration preserves the prior online batch');
  assert.equal((await one("SELECT convalidated FROM pg_constraint WHERE conrelid='hantang_dynamic.adm_uniseek_videos'::regclass AND conname='adm_uniseek_videos_favorite_check'")).convalidated, false);
  for (const favorites of ['NULL', '0', '100']) {
    await assert.rejects(() => db.exec(`INSERT INTO hantang_dynamic.adm_uniseek_videos(aid,bvid,favorite,record_date,batch_id,refreshed_at)
      VALUES (99,'BV99',${favorites},'2026-10-20','00000000-0000-0000-0000-000000000001',now())`));
  }
  await db.exec(`SELECT hantang_dynamic.adm_confirm_uniseek_source_date('2026-10-20');
    CREATE FUNCTION hantang_dynamic.test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced failure'; END; $$;
    CREATE TRIGGER test_fail BEFORE INSERT ON hantang_dynamic.adm_uniseek_videos FOR EACH ROW EXECUTE FUNCTION hantang_dynamic.test_fail();`);
  await assert.rejects(() => db.exec('CALL hantang_dynamic.adm_refresh_uniseek_videos()'), /forced failure/);
  assert.equal((await one('SELECT title FROM hantang_dynamic.adm_uniseek_videos')).title, 'legacy');
  assert.equal((await one('SELECT published_batch_id::text AS batch FROM hantang_dynamic.adm_uniseek_refresh_state')).batch, '00000000-0000-0000-0000-000000000001');
  await db.exec('DROP TRIGGER test_fail ON hantang_dynamic.adm_uniseek_videos; DROP FUNCTION hantang_dynamic.test_fail(); CALL hantang_dynamic.adm_refresh_uniseek_videos();');
  const rows = await q('SELECT aid::text,favorite,"like" FROM hantang_dynamic.adm_uniseek_videos ORDER BY aid');
  assert.deepEqual(rows, [{ aid: '3', favorite: 200, like: null }, { aid: '9007199254740993', favorite: 101, like: 0 }]);
  assert.equal((await one("SELECT convalidated FROM pg_constraint WHERE conrelid='hantang_dynamic.adm_uniseek_videos'::regclass AND conname='adm_uniseek_videos_favorite_check'")).convalidated, true);
  assert.equal((await one("SELECT attnotnull FROM pg_attribute WHERE attrelid='hantang_dynamic.adm_uniseek_videos'::regclass AND attname='favorite'")).attnotnull, true);
  assert.equal((await one("SELECT 'hantang_dynamic.adm_uniseek_videos'::regclass::oid AS oid")).oid, oid);
  assert.equal((await one("SELECT has_table_privilege('test_uniseek_reader','hantang_dynamic.adm_uniseek_videos','SELECT') AS allowed")).allowed, true);
  assert.notEqual((await one('SELECT published_batch_id::text AS batch FROM hantang_dynamic.adm_uniseek_refresh_state')).batch, '00000000-0000-0000-0000-000000000001');
  await db.exec(`SELECT hantang_dynamic.adm_confirm_uniseek_source_date('2026-10-20'); CALL hantang_dynamic.adm_refresh_uniseek_videos();`);
  await assert.rejects(() => db.exec(migration), /does not exist/);
  await db.exec('ROLLBACK');
  assert.equal(Number((await one('SELECT count(*) AS count FROM hantang_dynamic.adm_uniseek_videos')).count), 2);
  console.log('PASS legacy migration: retained online batch and grants, favorite gate, NULL/zero likes, rollback, first validation and same-day republish');

  // Fake only pg_cron's documented management signatures to exercise our schedule script's branches.
  await db.exec(`CREATE SCHEMA cron;
    CREATE TABLE cron.job(jobid bigserial PRIMARY KEY,jobname text,schedule text,command text,database text,username text DEFAULT current_user,active boolean DEFAULT true);
    CREATE FUNCTION cron.schedule_in_database(job_name text,schedule text,command text,database text,username text DEFAULT NULL,active boolean DEFAULT true)
    RETURNS bigint LANGUAGE sql AS $$ INSERT INTO cron.job(jobname,schedule,command,database,username,active) VALUES ($1,$2,$3,$4,coalesce($5,current_user),$6) RETURNING jobid $$;
    CREATE FUNCTION cron.alter_job(job_id bigint,schedule text DEFAULT NULL,command text DEFAULT NULL,database text DEFAULT NULL,username text DEFAULT NULL,active boolean DEFAULT NULL)
    RETURNS void LANGUAGE sql AS $$ UPDATE cron.job j SET schedule=coalesce($2,j.schedule),command=coalesce($3,j.command),database=coalesce($4,j.database),username=coalesce($5,j.username),active=coalesce($6,j.active) WHERE jobid=$1 $$;`);
  const schedule = await read('adm_uniseek_videos_schedule.sql');
  await db.exec(schedule);
  const job = await one('SELECT * FROM cron.job');
  await db.exec("UPDATE cron.job SET active=false,command='old command'");
  await db.exec(schedule);
  assert.equal(Number((await one('SELECT count(*) AS count FROM cron.job')).count), 1);
  assert.deepEqual(await one('SELECT * FROM cron.job'), job);
  assert.equal(job.database, 'hantang');
  assert.equal(job.schedule, '*/10 * * * *');
  assert.equal(job.command, 'CALL hantang_dynamic.adm_refresh_uniseek_videos();');
  await db.exec("INSERT INTO cron.job(jobname) VALUES ('hantang-uniseek-search-refresh')");
  await assert.rejects(() => db.exec(schedule), /Multiple UniSeek jobs/);
  console.log('PASS schedule management: create, update and reactivate preserve jobid; duplicate jobs fail clearly');
} finally { await db.close(); }
