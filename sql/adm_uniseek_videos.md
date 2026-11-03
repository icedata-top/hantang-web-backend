# UniSeek ADM 搜索宽表：手动安装与每日同步

2026-11-04 更新：开发者已完成宽表及首批数据构建，截图客户端显示 72,992 行，并已运行改读 ADM 的 Java 搜索，反馈首次约 700 ms、后续分页约 100 ms。职责分工、历史对比及测量边界见 [技改复盘](../doc/design/uniseek/adm-search-retrospective.md)。Codex 未连接或操作业务库，CRON 注册及每日日期确认接入状态尚未核实。已安装的环境无需重复执行首次安装 SQL。

完整表名：`hantang_dynamic.adm_uniseek_videos`，每个 aid 一行，仅保存当前成功批次。字段、类型、约束、注释与索引的唯一维护入口是[建表文档版 SQL](adm_uniseek_videos.sql)，刷新逻辑在[过程文档版 SQL](adm_uniseek_videos_refresh.sql)。方案背景见[UniSeek 子设计](../doc/design/uniseek/adm-search-snapshot.md)。

## 1. 首次安装

在业务库 `hantang` 中完整选中[无空行执行版](adm_uniseek_videos_install.sql)执行。它包含 `BEGIN` / `COMMIT`、两张新表、索引、注释、确认函数与刷新过程；不要只执行 CREATE TABLE 的部分字段。手动提交模式需确认事务已提交。

- 搜索表：标题、封面、投稿时间、UID，原有标签/分词/歌手标签，七项累计指标，以及来源日、批次 UUID 和生成时间。不复制简介、JSON 大字段或整个源表。
- 单行控制表：`hantang_dynamic.adm_uniseek_refresh_state`，保存本次确认日期、源总行数、结果行数下限及最近成功发布信息。
- 搜索表包含 aid 主键、bvid 唯一索引，以及三个 PostgreSQL 内置数组 GIN。初次建表为空表，使用普通 CREATE INDEX，不修改大源表索引，也不创建数据库扩展。
- 按用户要求，本版已移除 `pg_trgm` 及标题 trigram 索引。普通标题 `ILIKE '%关键词%'` 可继续使用，但子串匹配可能扫描整个 ADM 小表；数组精确匹配和编号查询仍有索引，不以普通 B-tree 冒充子串搜索索引。

### Java 项目账号的只读授权

开发者反馈建表账号与 Java 账号不同，应用账号 `app_icedata_web` 曾报 `permission denied for table adm_uniseek_videos`。在 **Java 连接的同一个数据库**中，用对象所有者或有相应授权权限的管理员执行：

```sql
BEGIN;
GRANT USAGE ON SCHEMA hantang_dynamic TO app_icedata_web;
GRANT SELECT ON TABLE hantang_dynamic.adm_uniseek_videos TO app_icedata_web;
COMMIT;
```

检查两个结果均为 true，再用应用实际账号重试搜索：

```sql
SELECT has_schema_privilege('app_icedata_web', 'hantang_dynamic', 'USAGE') AS schema_usage,
       has_table_privilege('app_icedata_web', 'hantang_dynamic.adm_uniseek_videos', 'SELECT') AS table_select;
```

Java 在线搜索只读该表，不需要访问控制表或执行刷新过程，也不需要写入权限。刷新维护账号的权限另行配置；每日 DELETE / INSERT 保留表对象及其授权。其他环境按实际应用角色替换账号名，不扩大为整个 schema 的所有表授权。

### 旧安装版停在 CREATE EXTENSION 权限错误时

如当前连接处于此次安装失败的事务中，先**单独**执行下面的语句恢复事务状态；它会撤销当前事务全部未提交的操作，不会只撤销报错语句，不要用它回滚其他尚需保留的工作：

```sql
ROLLBACK;
```

再检查本次安装对象是否已提交存在：

```sql
SELECT to_regclass('hantang_dynamic.adm_uniseek_videos') AS search_table,
       to_regclass('hantang_dynamic.adm_uniseek_refresh_state') AS state_table;
```

- 两列均为 NULL：完整执行新版[安装 SQL](adm_uniseek_videos_install.sql)。旧版在 BEGIN 内执行时通常走这一路径，但应以查询结果为准。
- 搜索表已存在、状态表为 NULL，且你确实停在旧版扩展语句：执行[续装 SQL](adm_uniseek_videos_continue.sql)。它保留已创建的搜索表，从数组索引开始继续安装；不重复建搜索表、不清空数据。
- 若状态表或数组索引也已存在，表示执行进度与上述情形不同；先核实已执行对象，再选择剩余完整语句执行，不盲目重跑，也不用 DROP / IF NOT EXISTS 隐藏结构差异。

## 2. 每日入库完成后，明确确认日期

当前没有可用的上游完成标记，**确认函数调用本身表示你或上游任务确认该日已完整入库**。它记录源行数用于后续漂移检查；行数多少、MAX 日期或凌晨几点均不能代替完成声明。

例如，确认 `2026-11-02`（先替换成实际已完成日期）：

```sql
SELECT hantang_dynamic.adm_confirm_uniseek_source_date(DATE '2026-11-02');
```

可选指定本批允许发布的最少结果数。例如现场核实资格集规模后，认为至少应有 100,000 行：

```sql
SELECT hantang_dynamic.adm_confirm_uniseek_source_date(DATE '2026-11-02', p_minimum_result_rows => 100000);
```

默认下限为 1，仅阻止清空搜索集；100,000 是调用方式示例，不是已核实的生产阈值。每次确认都会生成新 UUID，所以同一天补数、修正指标或静态信息后，重新确认即可重算。禁止把已发布日期回退到更早日期。

确认函数不会立即刷新搜索表。需要立刻发布时执行：

```sql
CALL hantang_dynamic.adm_refresh_uniseek_videos();
```

## 3. 注册 CRON

在**已安装 pg_cron 的管理数据库连接**中完整执行[调度 SQL](adm_uniseek_videos_schedule.sql)。沿用现有跨库调度方式，目标业务库为 `hantang`；末参数是数据库名，不是 schema。如实际库名不同，先修改。

```sql
SELECT cron.schedule_in_database(
    'hantang-uniseek-search-refresh',
    '*/10 * * * *',
    'CALL hantang_dynamic.adm_refresh_uniseek_videos();',
    'hantang'
);
```

每 10 分钟检查一次确认请求；**只在有新批次时生成数据**，成功请求不会重复扫描 Daily。上游每日确认一个日期，即形成每日刷新，不必依赖 CRON 的全局时区或猜测入库耗时。确认晚于检查时刻时，下一轮自动处理。没有确认时保留上一批。

失败会回滚并记录为 pg_cron 失败，下次检查重试；本版没有自动重试次数上限。数据持续异常时应修复后重新确认，或先暂停调度。使用固定维护账号注册；该账号需具备源表 SELECT、新表写入、临时表创建及过程执行权限。

跨库调度、权限及 CRON 日志行为以 [pg_cron 官方文档](https://github.com/citusdata/pg_cron)为准。脚本不会为你安装或配置服务器的 pg_cron 扩展。

## 4. 刷新与发布语义

- 只读取确认日 D 的 `video_daily`，一次物化该日快照，然后 `INNER JOIN processed_videos`。不使用 `video_daily_latest`、`video_static` 或每个 aid 的各自最后一日。
- 保持当前 UniSeek 的删除过滤：`p.is_deleted = false`；true、NULL 均不入表。只增加严格的 `d."like" > 100`，不额外用 `is_filtered` 筛选。
- 100、0、NULL 赞均不入表。其他指标、数组的 NULL 和真实 0 / 空数组原样保留，不从旧日补齐。
- 确认后源日期总行数改变、D 日 aid 重复、候选静态 aid / bvid 重复、结果数低于指定下限，都会阻止发布。行数不变的修改不能通过这项漂移检查被全部识别；入库完成仍由确认者保证。
- 获取事务级互斥锁，持有控制行锁直至提交；同一时刻只有一个发布者。先在会话临时表中准备并校验，再在同一事务内 DELETE / INSERT 正式表、更新批次元数据及 ANALYZE。没有 TRUNCATE、正式表重建或逐步对外填充。
- 在 PostgreSQL 的 MVCC 下，普通单条 SELECT 读取提交前的旧批次或提交后的新批次；失败回滚恢复旧数据。API 缓存已按 `batch_id` 区分，并使用实际排序查询返回的批次，避免两次读取跨发布时误标；跨页会话还没有固定快照游标。参见 [PostgreSQL 事务隔离](https://www.postgresql.org/docs/current/transaction-iso.html)。
- 每日全量替换会产生 WAL 和旧行版本；沿用 PostgreSQL 自动清理，部署后按实际刷新耗时、磁盘、VACUUM 和查询计划评估。不在 SQL 交付阶段承诺具体延迟。

## 5. 查看发布结果与任务

业务库：

```sql
SELECT *, requested_batch_id IS DISTINCT FROM published_batch_id AS pending
FROM hantang_dynamic.adm_uniseek_refresh_state;
SELECT record_date, batch_id, count(*) AS rows, min("like") AS min_likes
FROM hantang_dynamic.adm_uniseek_videos
GROUP BY record_date, batch_id;
```

pg_cron 管理库：

```sql
SELECT jobid, jobname, schedule, command, database, active
FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh';
SELECT jobid, status, start_time, end_time, return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh')
ORDER BY start_time DESC LIMIT 10;
```

暂停后仍保留搜索数据：

```sql
SELECT cron.unschedule('hantang-uniseek-search-refresh');
```

## 6. 本地验证与接入边界

独立内存 PostgreSQL（PGlite）在未安装 pg_trgm 的环境中验证完整安装、已提交搜索表的续装路径、内置索引、无确认不刷新、非法确认、101/100/0/NULL 赞、固定日期、删除及缺静态记录、NULL/0、源行数变化、Daily 和静态重复、规模下限、发布中途失败回滚、同日新批次重算及事务内重跑。

```sh
PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/adm_uniseek_videos.test.mjs
```

另有 [搜索查询 SQL 回归](tests/uniseek.test.mjs)，提取生产 DAO 查询，在只建 ADM、不建原始视频和 Daily 表的环境验证关键词与编号、短词、完整评分后截取及 NULL/0。Java 测试验证发布批次缓存、同日更新、读取交错和独立 HTTP 响应；接口契约见 [UniSeek beta](../frontend/src/services/UniSeek/uniseek.md)。

开发者已反馈应用访问新表的响应样本；Codex 未独立实测业务库角色权限、Timescale 压缩分区刷新性能、多连接竞争或 pg_cron 部署。剩余每日确认/调度、运行监控、精确编号及同日重发验收、固定快照分页见 [ADM TODO](../doc/todo/uniseek-adm-search-snapshot.md)。
