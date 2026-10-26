# adm_aggregation_task：日聚合任务辅助表设计

日期：2026-10-26。状态：已生成[建表SQL](adm_aggregation_task.sql)与[安装脚本](adm_aggregation_install.sql)，用户已确认辅助表及核心SQL创建成功。

完整名称：`hantang_dynamic.adm_aggregation_task`。这是本方案唯一新增的业务辅助表，正式结果仍写入已创建的`adm_entity_metrics_daily`。具体事务流程见[PostgreSQL聚合方案](../doc/design/adm-postgresql-aggregation.md)。

## 用途与行粒度

每个业务日一条当前任务，stat_date作为主键。同一行保存当前请求及最近一次尝试状态；本期不建设完整的每次尝试历史表。完整执行说明见[安装与调用](adm_aggregation_usage.md)。

配置在执行期间不可修改；已结束任务若显式重排，则更新request_id、配置并重置次数。普通幂等入队不能覆盖已有任务或重置重试额度。

## 建议字段

- `stat_date date NOT NULL`：目标业务日，主键。
- `request_id uuid NOT NULL`：本次入队请求标识，重排生成新值，便于区分旧请求。
- `status text NOT NULL`：pending、running、retry_wait、succeeded、failed。
- `priority integer NOT NULL`：区分日常任务和存量回刷，排序规则需固定。
- `attempt_count integer NOT NULL`：已领取次数，初始0，在计算前独立提交递增。
- `max_attempts integer NOT NULL`：总尝试次数上限，候选默认3，不是额外重试3次。
- `retry_delay_seconds integer NOT NULL`：基础退避秒数，默认60，worker按次数增长且等待上限1小时。
- `next_attempt_at timestamptz NOT NULL`：最早可领取时间，用于延后执行与退避。
- `attempt_id uuid`：当前或最近尝试标识；成功时对应正式结果batch_id。
- `definition_version integer NOT NULL`：统计规则版本。
- `collection_policy text NOT NULL`：固定为non_deleted_processed：排除is_deleted=true，不依据is_filtered过滤，不接受任意SQL字符串。
- `sample_scope text NOT NULL`：如zhongshu50-v1，只用于样本总计。
- `sample_aids bigint[] NOT NULL`：本次配置的50个不重复正整数aid，以规范化顺序存储。
- `created_at timestamptz NOT NULL`、`updated_at timestamptz NOT NULL`：当前任务生命周期时间。
- `started_at timestamptz`、`finished_at timestamptz`：最近一次尝试开始和结束时间，重排/领取时正确刷新。
- `last_error_sqlstate text`、`last_error text`：最近错误及归类；进程异常可能只能补记“上次执行中断”。
- `result_summary jsonb`：小型结果摘要，如生成行数、源快照日期、缺失覆盖和整体质量；不保存逐视频明细或完整中间指标结果。

日期任务之间独立，任务完成不意味着所有指标完整；数据完整性以正式表is_complete和摘要为准。

## 约束和索引要求

- 主键stat_date；request_id建议唯一。
- status使用显式CHECK；definition_version>0；0<=attempt_count<=max_attempts且max_attempts>0。
- 领取前检查次数上限，running任务允许attempt_count=max_attempts（最后一次仍可成功）。
- 数组校验必须同时覆盖长度、重复、NULL元素和非正数；不能只检查cardinality=50。
- 同一sample_scope不得对应不同名单，入队/执行需检查已有任务配置；这不是单行CHECK能独立保证的约束。
- 排队索引围绕status、next_attempt_at及实际排序设计，使用真实执行计划确认，不提前堆叠索引。

## 原子性与恢复说明

尝试次数先提交；单日ADM替换及status=succeeded同事务提交；失败业务修改回滚后记录retry_wait/failed。禁止在失败处理中再次抛错却误以为错误记录仍会持久化。

一期全局会话互斥锁贯穿worker的多段事务。拿到锁后可以恢复遗留running；不需要额外租约表或明细暂存表。进程异常不会撤销已提交次数，次数耗尽后停止。

本文件是表文档，不是可执行脚本；对应DDL已放入sql/，使用现有hantang_dynamic schema，不创建新schema。同一日期切换样本scope目前会被入队函数拒绝，以保留样本版本追溯。
