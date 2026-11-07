# ADM 分页聚合方案（已废弃）

更新：2026-10-26。

此前提出的按页保存进度、跨进程续跑和三张辅助表方案已被用户的新需求替代，不作为实施依据，未实现或部署。

当前方案为 PostgreSQL 内按日原子聚合，最多一张业务任务辅助表；失败后完整重算当天，支持有限重试及存量按日回刷。

请阅读[PostgreSQL 日聚合与存量回刷方案](adm-postgresql-aggregation.md)。已有结果表结构见[SQL 表文档](../../sql/adm_entity_metrics_daily_draft.sql)，唯一辅助表设计见[任务表文档](../../sql/adm_aggregation_task_draft.md)。
