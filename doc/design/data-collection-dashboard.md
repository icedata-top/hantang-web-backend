# 数据中心：数据采集看板

入口：`/admin/data/collection`，沿用管理入口开关。数据分组改名为「数据中心」，只保留「数据采集」「数据处理」两个子页面；数据处理暂为施工占位，旧时间点、时间链和收录视频入口移除。

## 数据来源与状态

四个来源各自调用 `GET /admin/data/collection/{source}`，使用标准 ResponseDTO 信封；任一卡片失败不影响其他卡片，可单独重试。白名单来源为 `daily`、`videos`、`crossings`、`accounts`；其他值返回 404，不能指定任意表或列。

- Daily：只读 `hantang_dynamic.video_daily`。页面说明上游 Bilibili → MySQL → PostgreSQL，仅验证 PostgreSQL 的实际记录，不连接 MySQL。以北京时间今天为基准检查 `[今天-7, 今天-1]` 七个完整自然日，逐日显示是否有记录与精确行数，同时从该区间结果推导最新 `record_date`，不查全历史最新日期。不把数据日期冒充更新时间。
- 视频静态数据：只读 `hantang_dynamic.processed_videos`，展示实际有无记录、数据库统计估算的全表规模及 `MAX(updated_at)`；不回退 `video_static`。
- 过线记录：只读 `hantang_dynamic.video_collection_gate_crossings`，展示实际有无记录、估算规模及 `MAX(created_at)`，标为「最近入库」。事件日期 `crossed_at` 不冒充入库时间；不要求每天产生事件。
- UP 主账号与粉丝数：只读 `hantang_dynamic.discovered_users`，展示实际有无记录、估算账号数、`fans IS NOT NULL` 的实际账号数和 `MAX(last_updated)`。0 粉丝仍是已有数值，不解释为粉丝历史快照，也不以账号资料更新时间证明粉丝数当时重新采集。

`healthy` 表示来源有记录，Daily 还要求七日均有记录；`gaps` 表示 Daily 部分日期缺失；`empty` 表示未检出记录（Daily 仅指这七天，不断言历史空表）。它们都不证明上游任务成功、资料新鲜或整批完整。数据库错误保留为失败（HTTP 500），工作队列满返回 503，不伪装为空表；前端明确显示「查询失败」。

时间字段通过 PostgreSQL 字段元数据检查，缺列或值为 NULL 时不展示对应时间。可选计数或更新时间查询失败／超时时，返回 `partial: true` 并显示「部分统计暂缺」；计数未知保留 NULL，不能变成 0。Daily 精确计数失败后，仍使用逐日 EXISTS 的真实存在性结果。

## 查询成本

- 不执行 DDL、写入、刷新、ANALYZE、建索引或权限变更。查询通过现有 DAO 的只读事务，单条 SQL 超时 2 秒并关闭本次 JIT。
- 每个来源独立缓存 60 秒并合并同来源并发请求；最多占用 2 个工作线程，等待队列 16。北京跨日立即失效，失败不缓存。刷新按钮重新获取卡片，缓存期间可能返回原检查时刻的数据。
- 静态表全量规模读取 `pg_class.reltuples`，明确标为估算；实际存在性单独 EXISTS 检查，不用估算值判断有没有数据。估算未知或估算为 0 但实际有记录时，数量显示 —。Daily 不使用 Timescale 父表估算冒充全部分块规模。
- Daily 优先以一次近七天计数同时判断存在性、数量和区间最新数据日，仅在计数失败时回退逐日 EXISTS，不扫描所有历史日期，也不逐视频读取指标。时间聚合和账号数也受单条超时保护，失败不拖垮其他卡片。实际耗时受现有索引、Timescale 分块与缓存状态影响。

## 页面与验证

复用 Ant Design Card、Tag、Button、Skeleton、Tooltip 及现有 RelativeTime；健康状态统一连接 `--status-*` 语义变量，由既有 highlight 色派生：健康绿、缺失与部分统计暂缺橙、失败红、检查中灰；卡片标签、日历条与图标保持一致，日夜文字对比度至少 4.5:1。Daily 占整行，其余卡片响应式排列，窄屏日历可横向滚动。MOCK 明确展示示例说明，接口失败不会回退示例数据。

前端回归检查菜单替换、北京日期跨日及未知计数；Java 回归覆盖窗口、缺日、缺列、可选查询失败、估算与存在性分离、并发缓存、午夜失效、失败重试与 HTTP 响应。SQL 回归在隔离 PostgreSQL 提取生产 DAO 查询，验证真实记录、范围边界、空表和元数据：

```sh
PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/data_collection.test.mjs
```

页面手动验收：开启管理入口，访问 `/admin/data/collection`；检查四卡片独立加载、缺日及单路失败状态、刷新、日夜主题和窄屏布局。数据处理入口为 `/admin/data/processing`。
