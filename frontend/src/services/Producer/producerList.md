# 创作者列表 API

网页 `/producers` 使用 `GET /producers`，PROD 沿用同源 `/api` 前缀。不提供关键词、名称或 UID 搜索，查找具体创作者引导到 `/uniseek`。

## 收录与字段

直接读取 `hantang_dynamic.discovered_users`，沿用 UniSeek 的 `videos_filtered > 0` 和头像含非空白字符条件，并要求 `user_id > 0`。不联查视频或 Daily，不受 UniSeek 的 20 位关键词结果上限限制。

`videoCount` 为 `videos_filtered`，沿用当前搜索页的「收录投稿」口径，不宣称是账号全站总投稿数。不展示统计口径尚未核实的 `filtered_view` 为创作者总播放量。粉丝数、头像和认证信息来自各自当前账号资料，不能当作同一天的历史快照。

响应沿用 `ResponseDTO`，`result` 包含 `page`、`pageSize`、`total`、`rows`。每行包含：

- `userId`：十进制字符串，保留 64 位 UID 精度。
- `name`、`face`、`sign`：名称、头像、简介。
- `fans`、`videoCount`：粉丝及收录投稿数，真实零保留，NULL 不补零。
- `level`、`officialRole`、`officialTitle`：账号等级与认证资料。
- `lastUpdated`：该账号资料更新时间，UTC ISO 字符串，可为 NULL。

不返回关注、来源账号、过滤通过率等采集字段。名称和头像复用 `ProducerInfo`，通过 `initialProducer` 提供本行完整公开资料，不为每一行额外请求账号信息；点击名称进入详情，悬停或聚焦查看资料浮层。

## 查询参数

- `minFans`：可选，非负 64 位整数，最低粉丝数，含边界。
- `minVideos`：可选，0 至 2147483647，最低收录投稿数，含边界。
- `sortBy`：`fans`（默认）、`videoCount`、`userId`。
- `order`：`desc`（默认）或 `asc`。粉丝数 NULL 在两种方向均排末尾，同值按 UID 降序稳定排列。
- `page`：从 1 开始的正整数，默认 1。
- `pageSize`：1–100，默认 20；页面提供 20 / 50 / 100。

数字使用绑定参数，排序字段与方向使用白名单。总数与分页数据在同一 SQL 快照中查询；越界页返回空行及真实总数，前端回到末页。零条结果仍为 HTTP 200。参数错误返回 400；查询失败或收录集合中同一 UID 重复返回 500，不暴露内部异常。

## 页面与验收

默认表格，支持卡片，两种展示保留 URL 中的筛选、排序、页码和每页条数，切换展示不重新查询。修改筛选、排序或条数回到第一页。界面支持中、英、日与窄屏；表格仅在自身区域横向滚动。加载、空结果和请求失败分别展示，错误可重试。没有搜索输入框。

MOCK 仅使用仓库已有 COPY 账号的公开样本；`videoCount=5` 来自[记录实例](../../../../sql/examples/video_creator_sample.md)，不生成额外账号或计数。

验证：前端 `npm test`、`npm run build`；Java `ProducerListControllerTest` 及既有 `ProducerControllerTest` / `ProducerServiceTest`；SQL `sql/tests/producer_list.test.mjs` 使用独立 PGlite，覆盖收录条件、边界筛选、同值排序、NULL/0、大整数、分页及重复检测，不连接业务库。
