# PostgreSQL ADM 聚合 SQL 安装与调用

更新：2026-10-26。用户已确认辅助表和核心脚本安装成功，并完成一次2026-10-20聚合（约112.6秒、346行）；源21日快照缺失，结果不完整。9:00调度增量SQL已生成但尚未在业务库执行。

## 安装

适用PostgreSQL 14+，已有hantang_dynamic schema及adm_entity_metrics_daily结果表。

在目标数据库连接中完整执行[无空行安装脚本](adm_aggregation_install.sql)。它在一个安装事务中新增唯一业务辅助表、创建校验函数、入队函数、计算函数、worker及9:00调度过程；不创建schema，不重建结果表，不注册cron，也不立即计算或写入结果。

安装脚本包含BEGIN/COMMIT，勿把后面的worker CALL追加在该事务中。已有失败事务先单独ROLLBACK并确认其影响。安装仅执行一次：若辅助表已存在，先核对结构，不用IF NOT EXISTS掩盖差异。

带注释的维护源文件是[任务表DDL](adm_aggregation_task.sql)、[函数/过程SQL](adm_aggregation_routines.sql)和[9:00调度过程](adm_aggregation_schedule.sql)。也可以按此顺序安装这三份文件，与合并安装脚本二选一，不重复建表。改动源文件时同步无空行版本；集成测试会检查两者一致。

## 已安装核心脚本：启用北京时间9:00调度

用户已经安装辅助表和核心脚本，不要重新执行完整安装脚本。只需在业务数据库（仓库字段快照记载为hantang）执行[无空行增量更新](adm_aggregation_schedule_update.sql)：仅CREATE OR REPLACE两个调度例程，不改表、不删数据、不立即聚合。

调度行为：

- 每天北京时间09:00首次尝试入队昨天，priority=1000，总尝试次数上限3。
- 此后每5分钟处理最多一个到期任务，覆盖有限重试及存量队列；成功日期不反复聚合，失败日期不重置次数。
- 00:00至09:00前直接返回，不领取任务。日期判断固定Asia/Shanghai，不依赖连接或cron的小时设置；无需修改全局cron.timezone。
- 中术50名单固化为当前仓库配置，变更名单/版本需重新评估，不自动读取Java文件。
- 存量建议使用默认priority=0；若手工任务优先级等于或超过1000，可能排在当天任务之前。
- 9:00相对约4点的采集启动预留约5小时，并不证明采集/同步完成；源缺失仍如实保存NULL及is_complete=false。已有成功但不完整的日期需要补数后显式重排。

确认集群已配置pg_cron后，在安装了该扩展的数据库连接中执行[启用SQL](adm_aggregation_schedule_enable.sql)（通常是postgres连接，不一定是业务库）：

```sql
SELECT cron.schedule_in_database(
    'hantang-adm-daily',
    '*/5 * * * *',
    'CALL hantang_dynamic.adm_schedule_aggregation_tick();',
    'hantang'
);
```

末参数是目标数据库名，不是schema。实际库名不是hantang时先修改。cron每5分钟唤醒，数据库过程内保证北京时间09:00前不处理；这不是每5分钟重算已成功日期。同名job按pg_cron规则管理，使用固定账号维护。SQL仅交付给开发者，不在本次执行注册。

若提示cron schema或函数不存在，应先由服务器管理员安装/配置pg_cron；不要在每个业务库重复安装。检查扩展与job：

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';
SELECT jobid, jobname, schedule, command, database, active FROM cron.job WHERE jobname = 'hantang-adm-daily';
```

停用该调度（在同一pg_cron元数据库、同一维护账号执行）：

```sql
SELECT cron.unschedule('hantang-adm-daily');
```

关于跨库调度及同job串行规则见[pg_cron官方说明](https://github.com/citusdata/pg_cron)。服务器扩展安装与实际cron触发仍需现场验证，本地测试仅验证过程行为。

## 固定口径

- 排除processed_videos.is_deleted=true；NULL或false保留；不依据is_filtered过滤。
- 投稿时间未知、非法aid、相关元数据/快照重复等情况使任务明确失败，不静默漏计或取MAX消歧。
- 源数据只读，单个SELECT读取同一快照。D+1凌晨快照减D凌晨快照归入D日增长；D行累计取D+1。
- 新投稿缺期初不补零；任何成员缺少某指标则对应合计NULL。负增量保留。空集合是0，缺失不是0。
- 只生成全量总计、全量旧分区、全量新分区和中术50总计；不产生样本分区、旧分区×新分区。
- 目标日集合排除D+1凌晨才投稿的视频。样本中被删除或当时尚未投稿的视频按统一规则不纳入当日集合，摘要记录有效样本数。

## 入队示例：开发者决定何时执行

以下为独立示例，不包含在安装脚本内。该函数仅插入任务，不立即运行聚合。

以2026-10-20为例，名单来自当前仓库的config/zhongshu-50.json：

```sql
SELECT hantang_dynamic.adm_enqueue_aggregation_days(
    p_start_date => DATE '2026-10-20',
    p_end_date => DATE '2026-10-20',
    p_sample_aids => ARRAY[
    2129461, 43426592, 113940616973177, 3905462, 2075941, 9372087, 285205499, 6009789, 115745711199311, 8506694,
    114747835942125, 116231361268602, 115061704298471, 113139018439424, 21551703, 938641073, 2251501, 24929108, 3060153, 7400996,
    625038011, 1971745, 114589861682758, 14911611, 114550502396425, 17632970, 67647585, 26659364, 4188543, 2609801,
    1844227, 115978277029671, 55888297, 114907756497074, 80155822, 957890888, 963864778, 482844, 45020985, 817114652,
    234884693, 3444039, 24180113, 116436378916947, 114251834398682, 928296531, 375265162, 114969630936061, 990224432, 437888226
]::bigint[],
    p_sample_scope => 'zhongshu50-v1',
    p_max_attempts => 3,
    p_retry_delay_seconds => 60
);
```

提供日期区间即可排入存量任务。默认仅补不存在的日期，不重置已有失败/成功/运行中任务。修正数据后明确重排，额外传入p_force_refresh=>true；仅重排succeeded/failed。max_attempts=3为总计三次尝试，不是首次加三次重试。高priority先执行。

同一sample_scope必须对应同一规范化名单。本期辅助表一日一行且是名单追溯依据，不支持重排同一日期时切换样本版本，函数会明确拒绝；未来历史样本版本切换需另行设计，不默认覆盖。

## 原子执行

下面这条必须单独在自动提交模式下执行，不要置于外部BEGIN/COMMIT中，也不要与其他命令一起放进一次多语句调用：

```sql
CALL hantang_dynamic.adm_process_one_aggregation_task();
```

一次最多领取一个已到执行时间的日期。领取次数先提交；当天四类结果和任务成功状态原子提交。失败时旧ADM结果保留，任务记录retry_wait/failed。重试需要等待next_attempt_at，再次调用同一worker；一次CALL不在数据库内sleep或循环耗尽全部次数。未到时间或无任务则不处理。

该过程用会话advisory lock(18291,1)跨事务串行化，入队配置锁使用(18291,2)。必须使用专用连接；正常返回会释放锁，异常退出需断开连接，不能将可能遗留锁的会话放回连接池。手动处理可以调用此worker；每日自动调度调用上面的adm_schedule_aggregation_tick，当前只提供SQL、不连接服务器注册。

若恢复上次中断任务，先按次数写回retry_wait/failed；未耗尽次数的任务等待退避后再被领取。SQL错误若被捕获并保存，CALL本身可正常返回，聚合是否成功以任务表status为准。

## 查询状态

```sql
SELECT stat_date, status, attempt_count, max_attempts, next_attempt_at, attempt_id, last_error_sqlstate, last_error, result_summary
FROM hantang_dynamic.adm_aggregation_task
ORDER BY stat_date DESC;
```

succeeded仅表示计算和发布成功，数据可能is_complete=false。源快照补齐后显式重排受影响日期，不要把源缺失当作瞬时SQL故障反复重试。快照D修正影响业务日D-1和D。

## 验证记录与限制

使用PGlite 0.5.11（PostgreSQL 18.6内核）和虚构数据，通过[15组集成验证](tests/adm_aggregation.test.mjs)：安装DDL、名单约束、四类聚合、覆盖重算、分区残留清理、缺失传播、重复明细失败、中途回滚、有限重试、中断恢复、大整数差分、空历史集合、样本版本约束、存量逐日执行及外部事务误用、北京时间9:00边界、调度幂等及重试额度保持。

开发者已手动执行核心脚本并提供一次运行结果；本Agent未连接业务库，未验证数据库角色权限、跨连接锁竞争、网络断连和pg_cron部署。PGlite单连接测试不能替代生产PostgreSQL多连接并发测试。

测试运行时只安装在临时目录，不是项目或生产依赖：

```sh
npm install --prefix /tmp/adm-sql-test @electric-sql/pglite
PGLITE_MODULE_PATH=/tmp/adm-sql-test/node_modules/@electric-sql/pglite/dist/index.js node sql/tests/adm_aggregation.test.mjs
```

设计详情见[PostgreSQL日聚合与回刷方案](../doc/design/adm-postgresql-aggregation.md)。
