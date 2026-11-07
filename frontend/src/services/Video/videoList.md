# 歌曲列表

页面 `/videos`，导航「歌曲」进入。默认表格、投稿时间降序；卡片复用 VideoCard。标题点击直接进入 `/videos/:aid`，悬停或键盘聚焦复用 VideoInfo，投稿人复用 ProducerInfo。筛选、排序、页码和布局保存在 URL；切换布局不重新请求列表。筛选点击「应用筛选」生效，重置恢复默认条件。

列表页的表格与卡片仅展示播放、收藏指标，隐藏点赞数及点赞排序；旧 URL 的 `sortBy=like` 回退到投稿时间。接口仍保留点赞字段与排序能力。

## GET /videos

使用现有 ResponseDTO，`result` 为 `{ page, pageSize, total, recordDate, rows }`。

- `startDate` / `endDate`：可选 `YYYY-MM-DD`，支持单边范围，2009–2100。按北京时间包含起止日，SQL 使用 `[开始日00:00, 结束日次日00:00)` 的 Unix 秒区间。
- `honor`：默认 `all`；`none` 为 `[0,100000)`，`hall` 为 `[100000,1000000)`，`legend` 为 `[1000000,10000000)`，`myth` 为 `≥10000000`。互斥最高荣誉，不将播放缺失归入未达殿堂。
- `typeId`：可选正整数，沿用站内 `processed_videos.type_id` 的历史二级分区 ID（如 30：VOCALOID·UTAU），不是 tid_v2。
- `minView`：可选非负整数，含下限，与荣誉条件取交集。
- `sortBy`：`pubdate`（默认）、`view`、`favorite`、`like`。
- `order`：`desc`（默认）或 `asc`。缺失值始终排末尾，同值按 aid 降序。
- `page`：正整数，默认 1；`pageSize`：1–100，默认 20，页面提供 20 / 50 / 100。

每行包含 `aid, bvid, title, pic, pubdate, userId, view, favorite, like, coin, recordDate`。aid / userId 用十进制字符串，避免前端丢失 64 位精度；pubdate 为 Unix 秒；累计指标保留 NULL / 真实零。`recordDate` 为匹配结果的统一快照日期，空匹配时为 null。

列表直接读取 `hantang_dynamic.adm_uniseek_videos`，沿用其发布资格（未删除、来源日累计收藏严格大于 100），没有 UniSeek 关键词搜索的 1,000 条上限。旧点赞版的[数据库迁移与重刷步骤](../../../../sql/adm_uniseek_videos_favorite_migration.md)需要由维护者执行。仅在选择分区时通过 aid 的 EXISTS 查询基础资料，不关联 video_daily，列表页本身不引入新表；本次收藏收录规则升级需要迁移既有 ADM 约束与刷新过程。总数与分页在同一 SQL 快照中查询；越界页仍返回正确 total，前端自动退到末页。跨请求若发生重新发布，结果及总数可能变化。

非法参数返回 400；数据库失败/超时返回 500，页面保留独立错误和重试入口，不伪装为空结果。查询设 5 秒超时。MOCK 仅使用现有已记录的世末歌者资料，不生成虚构累计指标。

必要验证：前端 `npm test` / `npm run build`；后端 JUnit `VideoListControllerTest`；`sql/tests/video_list.test.mjs` 用 PGlite 执行真实查询模板验证日期、荣誉边界、分区、NULL、分页及空页总数。
