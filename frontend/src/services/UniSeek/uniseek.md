# UniSeek beta：独立搜索、按到达顺序展示

歌手在前端本地搜索；视频关键词、UP 主关键词和可选编号查询互不等待。前端收到一批结果就追加到列表，不做跨类型 score 排序、不保留固定占位。相同 type/id 只保留一张卡片，后到的资料或指标补充原位置，不挪到列表末尾。

2026-11-04 更新：开发者已完成 ADM 搜索宽表及首批数据构建，歌曲关键词和 AV/BV 搜索统一改读 `hantang_dynamic.adm_uniseek_videos`，并已反馈应用使用新表的响应样本。在线不再关联原始视频或 Daily，不探测 Daily 最新日期；数据生成、授权与发布见 [ADM SQL 使用说明](../../../../sql/adm_uniseek_videos.md)。

## 查询来源

- **虚拟歌手**：前端打包 [18 位歌手的轻量配置](../../constants/vocal/vocal-search-info.json)，同步匹配名称和别名的子串，忽略大小写；“初音”命中“初音未来”，“天依”命中“洛天依”。名称/别名完全匹配在本地同类结果中优先。不分页，不发后端请求。ID 和立绘与前端详情目录保持一致，不伪造相关投稿数。
- **歌曲关键词**：`GET /uniseek/videos?keyword=洛天依&page=1&pageSize=30`。page 从 1 开始，pageSize 默认 30（1–50）。响应 result 包含 keyword、page、pageSize、list、hasMore、nextPage、videoLimit（1000）。仅在 hasMore=true 时继续请求 nextPage，翻页无需等待其他来源。
- **UP 主关键词**：`GET /uniseek/producers?keyword=天依`。仅检索 videos_filtered > 0 且 face 含非空白字符的账号，按名称匹配，最多返回 20 位，不分页。响应 result 为 keyword、list。不会联查视频或快照。
- **视频编号**：`GET /uniseek/videos/{aid}`。纯正整数字符串额外尝试精确 AV；显式 av/AV 或 BV/bv 先在前端解析成 aid，仅查询精确视频而不再发歌曲关键词请求。ID 按字符串传输，保持 64 位精度。直接按 ADM 主键等值查询，与关键词入口使用同一收录集，不另查原表或旧日快照。
- **UP 主编号**：`GET /uniseek/producers/{userId}`。纯正整数字符串额外精确查 UID，且仍要求 videos_filtered > 0、face 含非空白字符。带 AV/BV 前缀的输入不当成 UID。

编号接口统一响应 result.list，无匹配或未进入已发布搜索集时成功返回空数组。未收录不代表视频在原始库中不存在；站内详情资料接口仍用于页面资料展示。

普通文本同时启动两个关键词请求；纯数字同时启动两个关键词请求和两个编号请求。数字文本搜索仍然保留，不做 aid/user_id 转字符串的 LIKE。`123abc`、超出正 64 位范围或带前导零的数字文本不发编号查询。“天依”会先显示本地歌手，后面的歌曲与 UP 主按实际网络返回顺序出现；不保证 UP 主一定比歌曲先返回。数字对应的 AV 或 UID 通常等值查询更快，但仍以实际返回先后为准，不强制置顶。

搜索接口均使用项目 `ResponseDTO` 信封。无匹配是正常成功结果 `list: []`。服务端失败保留为独立、可重试的错误。切换关键词或离开页面会取消 fetch，并阻止旧响应写入新结果。某一路失败不清空已加载结果，重试只重新调用失败来源。下一页失败保留列表和 nextPage，可单独重试。

## 数据与同类排序

页面以紫色虚拟歌手 Tag、橙色创作者 Tag、绿色歌曲 Tag 区分实体类型，均适配日夜主题。虚拟歌手的内部 ID 只用于链接与去重，不在卡片上展示。

每项为 type、id、title、subTitle、coverUrl、jumpUrl、payload，不对外提供可跨类型比较的 score。所有列表实体 ID 为字符串。

视频封面来自 ADM 的 pic，头像来自 discovered_users.face，立绘复用 frontend/public/vocals。歌曲关键词与编号查询的 payload 包含 bvid、play、favorite、like、coin、publishDate（Unix 秒）、producerId、recordDate。recordDate 为已发布批次的来源日 D，不要求是今天，也不使用每个视频各自的最新日期。ADM 离线发布时已过滤 `processed_videos.is_deleted = false`、D 日有 Daily 记录且累计收藏数严格 **> 100** 的视频；100、0、NULL 均不入表。其他指标缺失时保留 null，真实 0 保留 0。

旧点赞版的数据库约束及刷新过程需按[迁移操作步骤](../../../../sql/adm_uniseek_videos_favorite_migration.md)升级并重新发布。点赞不参与新门槛，原始 0 / NULL 保留，不由此次改动补齐。

UP 主关键词 payload 包含 uid、fanCount、videoCount（videos_filtered，上游过滤投稿数）、totalView（filtered_view）；编号查询使用相同的收录投稿数与头像条件。

视频和 UP 主各自在 SQL 中排序，服务端不合并两类数据或做跨类型比较：

- 视频标题完全一致 900、包含完整短语 600、其他多词/精确标签命中 400；短语命中加 `60 × 关键词长度 / 标题长度`。按空白拆分词，每个词都必须在标题或某个精确 tag_new/participle/label_singers 元素中命中，不搜索 description 或旧 tag 原文。
- 一、二字符短词也参与标题子串匹配，不再受原大表路径的短词限制。标签/分词/歌手数组仍为完整元素匹配；输入中的 `%`、`_`、反斜杠按字面搜索，参数化查询不拼接用户输入。
- 在 ADM 所有匹配项上计算上述文本分及播放量加分 `min(40, 4 × ln(1 + max(播放量, 0)))`（NULL 播放量仅在评分时视为 0），再按 `score DESC, aid DESC` 截取最多 1,000 首。先完成收录和全体匹配项评分，再限制返回数量，避免先截断导致高分结果丢失。单个关键词的 1,000 首上限仍是 beta 契约。
- UP 主先在 WHERE 过滤 videos_filtered > 0（0/NULL 不参与）且 face 含非空白字符（NULL、空字符串、纯空白均不参与），再按名称与去除首尾空白的关键词逐字完全一致优先（大小写也需一致）、fans 降序 NULLS LAST、user_id 降序排序，最后 LIMIT 20。名称候选仍由 ILIKE 不区分大小写匹配。完全命中不会因粉丝少被候选截断。

## 发布批次、缓存与分页

歌曲排序结果按原关键词和发布批次 UUID 缓存 **60 秒**，最多 **16 个键**、每个最多 1,000 首。每页先从 ADM 读取一行 batch_id；发现新批次后不复用旧缓存，同日补算也能生效。缓存未命中时只运行一条 ADM 排序查询，并以该查询实际返回的批次存储缓存，避免两次查询之间发生发布而错误标记缓存。无匹配不缓存；空表返回空数组并清空结果缓存。

翻页复用排序结果的原顺序，不重新搜索 UP 主或歌手。接口没有固定批次游标，跨发布或缓存过期时仍可能发生跨页漂移，前端继续去重；正式快照分页留作后续。AV/BV 等值查询独立于关键词评分与结果缓存。

## 部署与验证

[ADM 建表与同步 SQL](../../../../sql/adm_uniseek_videos.md) 由开发者手动执行；用户已确认首批构建完成，截图客户端显示 72,992 行，该数字不作为日常发布规模保证。应用只要求搜索表及其发布字段可读，不查询发布控制表，不自动安装扩展或注册 CRON。新路径无需 pg_trgm 或原表的 [旧搜索索引脚本](../../../../sql/uniseek_search_indexes.sql)；使用 ADM 自身的 aid 主键、bvid 唯一索引和三组数组 GIN。标题 ILIKE 可能扫描小表，实际计划取决于词和数据。

其他环境部署时需要重新构建、重启后端，并确认应用实际账号的 schema USAGE 与搜索表 SELECT 权限；建表账号有权限不代表应用账号也有。查询在只读事务中禁用本次 JIT，每条查询超时 5 秒；工作线程最多 4 个，队列 32 个，队列满返回 503。参数错误返回 400，数据库失败（包括缺表、权限不足）返回 500，不伪造为空列表、不隐式回源。刷新失败由离线事务保留上一成功批次。

前端测试验证独立到达顺序、两字歌手名、数字与 AV/BV 分流、编号资格过滤与空结果、去重与补充字段、部分失败及单路重试、翻页并发和切换关键词取消。后端 HTTP 测试阻塞歌曲查询，确认 UP 主响应仍能先完成。页面手动验收入口 `/uniseek?keyword=天依`、`/uniseek?keyword=初音`、`/uniseek?keyword=123456`。

后端 DAO/Service/HTTP 回归覆盖 ADM 来源、同日批次失效、发布与读取交错、缓存容量/过期、64 位编号、分页、空表与独立错误。SQL 回归直接提取生产 DAO 的查询，在只建 ADM、不建原始视频或 Daily 表的内存 PostgreSQL 上验证标题/数组匹配、完整评分后截取、NULL/0 指标及 UP 主排序：

```sh
PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/uniseek.test.mjs
```

开发者反馈新表搜索首次视频响应约 **700 ms**，第二次及后续下滑约 **100 ms/次**。旧聊天记录中的热门二字词、应用缓存未命中首查约 **3–4 秒**，粗略对比首次提速约 **4.3–5.7 倍**、耗时减少约 **77%–83%**；旧分页响应未单独记录。此前约 512 ms 是最新日期定位子步骤，不是整次搜索响应。

本次使用已有聊天数据，没有重新测试旧逻辑或连接业务库。关键词、负载、测量位置及数据库缓冲区状态未统一，不能当作 P50/P95 或纯 SQL 基准；后续持续测量新路径的热门词、短词、编号及并发分布。过程、职责和边界见 [技改复盘](../../../../doc/design/uniseek/adm-search-retrospective.md)，后续见 [Elasticsearch 与正式排序 TODO](../../../../doc/todo/uniseek-elasticsearch-ranking.md)。

## 设计子文档与待办

- [每日生成 ADM 歌曲搜索宽表](../../../../doc/design/uniseek/adm-search-snapshot.md)：已实现离线发布 SQL 和应用读取，记录日期确认、批次与门槛。
- [宽表化技改复盘](../../../../doc/design/uniseek/adm-search-retrospective.md)：开发者提出的方向与实际操作、Codex 工程实现、响应样本及经验。
- [ADM 搜索宽表 TODO](../../../../doc/todo/uniseek-adm-search-snapshot.md)：跟踪后端部署、每日日期确认与 CRON、生产性能验收。
