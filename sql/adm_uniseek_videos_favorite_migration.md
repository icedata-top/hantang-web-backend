# UniSeek：从点赞 >100 切换到收藏 >100，并重刷与更新 CRON

更新日期：2026-11-05。本文适用于已经运行旧点赞版 `adm_uniseek_videos` 的环境。脚本已在隔离 PostgreSQL 中验证；交付文件不代表已在业务库执行。

本次规则：`processed_videos.is_deleted = false AND video_daily.favorite > 100`，所有指标仍取明确确认的同一个数据日 D。收藏为 100、0、NULL 的视频不入表；点赞不参与收录，保留来源的 0 或 NULL。改门槛可以绕开此次点赞异常造成的漏收录，但不会修复来源点赞指标本身。

## 先分清两个数据库连接和账号

- **业务库连接：`114.66.27.201:5432/hantang`**，对应本次排查时后端实际目标。使用搜索表和刷新过程的所有者，或让 DBA 执行迁移及第一次重刷。迁移需要 ALTER TABLE、CREATE OR REPLACE PROCEDURE 权限，第一次成功重刷还会校验新约束。
- **pg_cron 管理库连接**：连接现有 `cron.job` 所在数据库，使用原任务注册账号，或由 DBA 代理修改。管理库默认可能为 `postgres`，实际以服务器 `cron.database_name` 配置为准；`hantang_dynamic` 是业务 schema，不是数据库名。
- **应用账号 `app_icedata_web` 继续只读**。不需要为网页账号授予表所有权、扩展所有权或 CRON 管理权限。

pg_cron 的行级权限通常只显示当前账号的任务；查不到任务不代表服务器没有任务。先让 DBA 核实账号与管理库，再注册，避免另一个账号重复创建同名任务。[pg_cron 官方说明](https://github.com/citusdata/pg_cron#managing-and-creating-jobs)

## 第 1 步：查看并暂停原 CRON

在 **pg_cron 管理库**执行：

```sql
SELECT current_database(), current_user;
SELECT jobid, jobname, schedule, command, database, username, active FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh';
SELECT cron.alter_job(jobid, active => false) FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh';
SELECT jobid, status, start_time, end_time, return_message FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh') ORDER BY start_time DESC LIMIT 10;
```

确认 `active=false`。暂停只阻止后续调度，不会中止已经运行的任务；如果有 `running` / `starting` 状态，先等待该次结束。不要删除任务，保留原 jobid 和运行日志。若有多个同名任务，交给 DBA 核对并停用重复项，再继续。

## 第 2 步：检查旧表结构和发布日

在 **业务库 `hantang`**，用对象所有者或 DBA 账号执行：

```sql
SELECT current_database(), current_user;
SELECT conname, pg_get_constraintdef(oid) AS definition, convalidated FROM pg_constraint WHERE conrelid = 'hantang_dynamic.adm_uniseek_videos'::regclass ORDER BY conname;
SELECT requested_record_date, published_record_date, published_at, published_row_count, requested_batch_id IS DISTINCT FROM published_batch_id AS pending FROM hantang_dynamic.adm_uniseek_refresh_state;
```

旧版应有 `adm_uniseek_videos_like_check`（点赞 >100），且没有 `adm_uniseek_videos_favorite_check`。只有确认是这个旧结构才执行下一步。若已存在收藏约束，说明可能已迁移，不要重跑迁移；继续检查约束是否验证、是否已经完成收藏版重刷。

本次只读检查时，在线表来源日为 **2026-11-02**，有 72,992 行，最新投稿 2024-01-25。该日 aid ≥10 亿的 482,469 条 Daily 记录点赞均为 0；例如《下等马》有 6,458,720 播放、240,109 收藏而点赞为 0。原点赞门槛因此系统性排除了新 aid。`processed_videos` 已有 2026-11-05 投稿。上述结果是当次检查证据，实际执行前以当前查询为准。

## 第 3 步：执行一次性迁移

仍在 **业务库 `hantang`**，完整选中并执行 [adm_uniseek_videos_favorite_migrate.sql](adm_uniseek_videos_favorite_migrate.sql)。文件已包含 `BEGIN` / `COMMIT`，没有空行。启用遇错停止，看到全部语句和 COMMIT 成功后再继续。

脚本会：移除旧点赞 CHECK 和 NOT NULL 限制，添加收藏 CHECK，替换刷新过程，更新表注释。保留表对象、索引、授权和旧在线批次，不执行清空或重建搜索表。旧数据可能不满足收藏门槛，因此收藏约束先以 `NOT VALID` 添加，仍会检查之后插入或更新的行；第一次成功刷新后再验证全表并设置收藏 NOT NULL。[PostgreSQL 约束迁移说明](https://www.postgresql.org/docs/current/sql-altertable.html)

脚本使用与发布过程相同的互斥锁，并将等待锁的超时设为 5 秒；若锁等待失败，应先确认旧刷新已结束，再重试。事务报错时停止后续操作，检查最早错误；需要退出失败事务时单独执行 `ROLLBACK;`，它会撤销该事务的全部未提交操作。不要重新运行首次安装或续装脚本代替迁移。

## 第 4 步：预览候选，确认数据日，立即重刷

最直接的首次切换方式，是**重刷原来已经确认并发布的数据日**。本次示例沿用 **2026-11-02**，从而只改变收录条件。若上游确认更近日期已经完整入库且收藏指标可用，可以改为该日；下列预览、确认中的日期应一致，且不得早于当前已发布日。不要用 `MAX(record_date)` 自动替代上游完成确认。

先预览收藏条件下的候选数和最新投稿，SQL 工具允许查询完成（应用接口的 5 秒超时不适用于人工重刷）：

```sql
WITH source AS MATERIALIZED (SELECT aid, favorite, "like" FROM hantang_dynamic.video_daily WHERE record_date = DATE '2026-11-02' AND favorite > 100) SELECT count(*) AS expected_rows, min(d.favorite) AS min_favorite, count(*) FILTER (WHERE d."like" = 0) AS zero_like_rows, count(*) FILTER (WHERE d."like" IS NULL) AS missing_like_rows, to_timestamp(max(p.pubdate)) AT TIME ZONE 'Asia/Shanghai' AS latest_publication FROM source d INNER JOIN hantang_dynamic.processed_videos p ON p.aid = d.aid WHERE p.is_deleted = false;
```

检查候选包含预期的近年投稿、规模合理，且收藏字段已由上游确认可用。预览计数本身不能证明整个源日完整，也不能代替刷新过程对重复记录的校验。

接着完整执行下面这一组。**即便日期不变，也必须重新调用确认函数生成新 batch_id**；单独 CALL 刷新不会重算已经成功发布的同一请求。

```sql
BEGIN;
SET LOCAL statement_timeout = '15min';
SET LOCAL lock_timeout = '5s';
SET LOCAL jit = off;
SELECT hantang_dynamic.adm_confirm_uniseek_source_date(DATE '2026-11-02');
CALL hantang_dynamic.adm_refresh_uniseek_videos();
COMMIT;
```

15 分钟是本次人工执行的保护上限，不是已测得的刷新耗时承诺。默认最少结果数为 1；完成预览后，可通过 `p_minimum_result_rows` 指定合理的正整数下限。例如主文档中的 100,000 仅演示参数用法，不是已核实的收藏版生产阈值，不要直接套用。

首次成功重刷会完成收藏约束校验和 NOT NULL 设置。若失败，事务回滚，旧在线批次及发布信息保留；修复错误后再重新确认并刷新，暂不恢复 CRON。不要手动 DELETE 在线表。

## 第 5 步：验证结果

仍在 **业务库 `hantang`**执行：

```sql
SELECT requested_record_date, published_record_date, published_at, published_row_count, requested_batch_id IS DISTINCT FROM published_batch_id AS pending FROM hantang_dynamic.adm_uniseek_refresh_state;
SELECT record_date, batch_id, count(*) AS rows, min(favorite) AS min_favorite, count(*) FILTER (WHERE favorite IS NULL OR favorite <= 100) AS invalid_rows, to_timestamp(max(pubdate)) AT TIME ZONE 'Asia/Shanghai' AS latest_publication FROM hantang_dynamic.adm_uniseek_videos GROUP BY record_date, batch_id;
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'hantang_dynamic.adm_uniseek_videos'::regclass AND conname IN ('adm_uniseek_videos_like_check', 'adm_uniseek_videos_favorite_check');
SELECT attname, attnotnull FROM pg_attribute WHERE attrelid = 'hantang_dynamic.adm_uniseek_videos'::regclass AND attname IN ('favorite', 'like');
SELECT aid, title, favorite, "like", record_date, to_timestamp(pubdate) AT TIME ZONE 'Asia/Shanghai' AS published FROM hantang_dynamic.adm_uniseek_videos WHERE aid IN (114589861682758, 114550502396425, 1305196045);
```

期望：`pending=false`，一组来源日及 batch_id；`min_favorite >=101`，`invalid_rows=0`；只有收藏 CHECK，且 `convalidated=true`；收藏 `attnotnull=true`、点赞 `attnotnull=false`。样本若源日有记录、未删除且收藏达标，应进入搜索集。最新投稿应与预览一致，而不是硬性要求等于今天。

## 第 6 步：修改并恢复 CRON

切回 **pg_cron 管理库**，使用第 1 步相同的原任务账号或 DBA，完整执行 [adm_uniseek_videos_schedule.sql](adm_uniseek_videos_schedule.sql)。已有一个同名任务时使用 `cron.alter_job` 更新并启用，保留 jobid、username 和历史日志；确实没有任务时才创建；发现多个可见同名任务时明确报错。

目标配置为：名称 `hantang-uniseek-search-refresh`，每 10 分钟检查，命令 `CALL hantang_dynamic.adm_refresh_uniseek_videos();`，目标业务库 `hantang`，`active=true`。收藏条件位于更新后的存储过程，不需要把筛选 SQL 放进 CRON command。

```sql
SELECT jobid, jobname, schedule, command, database, username, active FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh';
SELECT jobid, status, start_time, end_time, return_message FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh') ORDER BY start_time DESC LIMIT 10;
```

**CRON 只处理新确认请求，不会每天自行选择日期。** 每日采集／同步成功且确认该日完整后，维护账号仍需在 `hantang` 调用 `adm_confirm_uniseek_source_date(D)`。下一轮 CRON 才会发布；没有新确认，保留旧批次。任务的 `username` 必须能在业务库读取源表、读写发布表与控制表、创建临时表、执行确认函数及刷新过程；连接认证和 pg_cron 安装由 DBA 维护。

## 第 7 步：部署页面文案并验收

本次同时更新了歌曲列表的中／英／日收录说明，部署前端后访问 `/videos`，重置筛选并按投稿时间降序查看，再用 UniSeek 搜索预期样本。数据库成功换批后，搜索缓存按新 batch_id 自动失效；后端查询接口不用修改或重启才能识别新批次。页面显示原始点赞 0 仍可能来自已知上游异常，收藏门槛变更不代表这些点赞已修复。

失败时保留 CRON 暂停状态，先定位具体错误，再重新确认和刷新；上述步骤不会操作 `processed_videos` / `video_daily` 的源数据。
