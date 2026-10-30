# UniSeek beta：独立搜索、按到达顺序展示

歌手在前端本地搜索；视频关键词、UP 主关键词和可选编号查询互不等待。前端收到一批结果就追加到列表，不做跨类型 score 排序、不保留固定占位。相同 type/id 只保留一张卡片，后到的资料或指标补充原位置，不挪到列表末尾。

## 查询来源

- **虚拟歌手**：前端打包 [18 位歌手的轻量配置](../../constants/vocal/vocal-search-info.json)，同步匹配名称和别名的子串，忽略大小写；“初音”命中“初音未来”，“天依”命中“洛天依”。名称/别名完全匹配在本地同类结果中优先。不分页，不发后端请求。ID 和立绘与前端详情目录保持一致，不伪造相关投稿数。
- **歌曲关键词**：`GET /uniseek/videos?keyword=洛天依&page=1&pageSize=30`。page 从 1 开始，pageSize 默认 30（1–50）。响应 result 包含 keyword、page、pageSize、list、hasMore、nextPage、videoLimit（1000）。仅在 hasMore=true 时继续请求 nextPage，翻页无需等待其他来源。
- **UP 主关键词**：`GET /uniseek/producers?keyword=天依`。仅检索 videos_filtered > 0 且 face 含非空白字符的账号，按名称匹配，最多返回 20 位，不分页。响应 result 为 keyword、list。不会联查视频或快照。
- **视频编号**：`GET /uniseek/videos/{aid}`。纯正整数字符串额外尝试精确 AV；显式 av/AV 或 BV/bv 先在前端解析成 aid，仅查询精确视频而不再发歌曲关键词请求。ID 按字符串传输，保持 64 位精度。与歌曲关键词一样，只返回最新有数据日存在 Daily 快照、该日点赞数 > 10、且未删除的视频，直接携带该日指标。
- **UP 主编号**：`GET /uniseek/producers/{userId}`。纯正整数字符串额外精确查 UID，且仍要求 videos_filtered > 0、face 含非空白字符。带 AV/BV 前缀的输入不当成 UID。

编号接口统一响应 result.list，无匹配或不满足收录/快照条件时成功返回空数组。搜索使用独立的编号接口，让编号和关键词入口的资格条件保持一致；站内详情资料接口仍用于页面资料展示。

普通文本同时启动两个关键词请求；纯数字同时启动两个关键词请求和两个编号请求。数字文本搜索仍然保留，不做 aid/user_id 转字符串的 LIKE。`123abc`、超出正 64 位范围或带前导零的数字文本不发编号查询。“天依”会先显示本地歌手，后面的歌曲与 UP 主按实际网络返回顺序出现；不保证 UP 主一定比歌曲先返回。数字对应的 AV 或 UID 通常等值查询更快，但仍以实际返回先后为准，不强制置顶。

两个搜索接口都使用项目 `ResponseDTO` 信封。无匹配是正常成功结果 `list: []`。编号搜索也正常返回 `list: []`；服务端失败保留为独立、可重试的错误。切换关键词或离开页面会取消 fetch，并阻止旧响应写入新结果。某一路失败不清空已加载结果，重试只重新调用失败来源。下一页失败保留列表和 nextPage，可单独重试。

## 数据与同类排序

页面以紫色虚拟歌手 Tag、橙色创作者 Tag、绿色歌曲 Tag 区分实体类型，均适配日夜主题。虚拟歌手的内部 ID 只用于链接与去重，不在卡片上展示。

每项为 type、id、title、subTitle、coverUrl、jumpUrl、payload，不对外提供可跨类型比较的 score。所有列表实体 ID 为字符串。

视频封面来自 pic，头像来自 face，立绘复用 frontend/public/vocals。歌曲关键词 payload 包含 bvid、play、favorite、like、coin、publishDate（Unix 秒）、producerId、recordDate；UP 主关键词 payload 包含 uid、fanCount、videoCount（videos_filtered，上游过滤投稿数）、totalView（filtered_view）。视频编号查询使用相同的快照指标，UP 主编号使用相同的收录投稿数与头像条件。Daily 中没有该视频行或该日点赞数未超过 10 时不返回视频；其他指标缺失时保留 null，真实 0 保留 0。

视频和 UP 主各自在 SQL 中排序，服务端不合并两类数据或做跨类型比较：

- 视频标题完全一致 900、包含完整短语 600、其他多词/精确标签命中 400；短语命中加 `60 × 关键词长度 / 标题长度`。按空白拆分词，每个词都必须在标题或某个精确 tag_new/participle/label_singers 元素中命中，不搜索 description 或旧 tag 原文。
- 一、二字符短词只走精确标签/分词/歌手数组，不做标题子串扫描，避免大表无有效 trigram 时的全扫描。这是 beta 召回限制，与前端本地歌手子串匹配无关。
- SQL 按文本分、aid 降序截取最多 1000 首候选，再用 INNER JOIN 按 aid 和最新有数据的共同快照日精确关联 video_daily。仅该日期存在视频行且该日点赞数 > 10 时才返回（10、0、NULL 均不返回）；不回退到该视频自己的旧快照。候选截取是 beta 的召回上限，剔除没有该日快照的视频后结果可能少于 1000 首。候选内加 `min(40, 4 × ln(1 + max(播放量, 0)))`，最终 `score DESC, aid DESC`。
- UP 主先在 WHERE 过滤 videos_filtered > 0（0/NULL 不参与）且 face 含非空白字符（NULL、空字符串、纯空白均不参与），再按名称与去除首尾空白的关键词逐字完全一致优先（大小写也需一致）、fans 降序 NULLS LAST、user_id 降序排序，最后 LIMIT 20。名称候选仍由 ILIKE 不区分大小写匹配。完全命中不会因粉丝少被候选截断。

最新有数据日按实际 Daily 记录探测，缓存 **10 分钟**；不限定今天或最近 7 天。Timescale 表按公开的分区时间范围从新到旧检查真实记录，并用范围 EXISTS 二分定位最后一个有数据日；空分区与中间断档不影响结果。普通 PostgreSQL 表使用不带日期限制的 MAX(record_date)。全表无数据时缓存空日期，视频搜索返回空数组。分区字段来源见 [Timescale chunks 文档](https://www.tigerdata.com/docs/reference/timescaledb/informational-views/chunks)。

歌曲排序结果按原关键词和快照日期缓存 60 秒，最多 16 个键、每个最多 1000 首；最新日期变化后不复用旧日结果。翻页复用 SQL 原顺序，不重新搜索 UP 主或歌手；缓存过期时数据库变化仍可能造成跨页漂移，前端去重。精确编号查询独立于这个较慢的候选评分过程。

## 部署与验证

[搜索索引 SQL](../../../../sql/uniseek_search_indexes.sql) 仍由开发者手动执行，不假定已经建成。现有 tag_new、participle、label_singers GIN 和 video_daily(aid, record_date) 索引继续复用。关键词查询在只读事务中禁用本次 JIT，每条查询超时 5 秒；工作线程最多 4 个，队列 32 个，队列满返回 503。参数错误返回 400，数据库失败返回 500，不伪造为空列表。

前端测试验证独立到达顺序、两字歌手名、数字与 AV/BV 分流、编号资格过滤与空结果、去重与补充字段、部分失败及单路重试、翻页并发和切换关键词取消。后端 HTTP 测试阻塞歌曲查询，确认 UP 主响应仍能先完成。页面手动验收入口 `/uniseek?keyword=天依`、`/uniseek?keyword=初音`、`/uniseek?keyword=123456`。

此前实库热门二字词冷查询约 3–4 秒；本次拆分消除了其他来源等待它的首屏障碍，并未宣称歌曲 SQL 本身已降至毫秒。通用标题子串搜索耗时需手动建索引后测量。后续见 [Elasticsearch 与正式排序 TODO](../../../../doc/todo/uniseek-elasticsearch-ranking.md)。

2026-10-30 只读验证：最新有数据日为 2026-10-28，最终实现首次定位耗时约 512 毫秒（含元数据查询），再次读取日期缓存新增 SQL 数为 0（单次样本，不含关键词查询，也不是 P95 保证）。SQL 回归覆盖当日无数据、超过 7 天的历史日期、缺少最新日快照、零/NULL 指标，以及 UP 主的收录过滤、精确名称优先和粉丝降序。
