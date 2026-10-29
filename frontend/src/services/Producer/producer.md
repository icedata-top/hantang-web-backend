# 创作者详情 API

日期：2026-10-29。网页路径 `/producers/:userId`。DEV 请求本机后端，PROD 默认增加 `/api` 前缀；以下为不含前缀的后端路径。

## 账号基本信息

`GET /producers/{userId}/info`

例如 `/producers/396194/info`。`userId` 必须为无前导零的正 64 位整数。

读取 `hantang_dynamic.discovered_users` 的公开账号字段，响应 `result` 包含：

- `userId`：十进制字符串，避免浏览器大整数精度损失。
- `name`、`face`、`sign`：用户名、头像、个人简介。
- `fans`、`level`、`officialRole`、`officialTitle`：本条账号资料的粉丝数、等级及认证信息。NULL 保留，真实 0 保留。
- `lastUpdated`：本条账号资料更新时间，UTC ISO 时间字符串；与视频投稿时间、播放快照日期分别显示。

不返回采集关注状态、过滤通过率、来源用户、内部计数等运维字段。资料不存在返回 404；不调用哔哩哔哩 API 判断账号是否存在。发现多条同 ID 资料时返回 500，不任取一行。

## 分页投稿列表

`GET /producers/{userId}/videos?sortBy=pubdate&order=desc&role=uploader&page=1&pageSize=20`

- `userId`：路径参数，被查询的创作者用户 ID，与上面的 ID 规则一致。
- `sortBy`：`pubdate`（投稿时间，默认）或 `view`（播放量）。
- `order`：`asc`（升序）或 `desc`（降序，默认）。
- `role`：`uploader`（第一作者，默认）严格匹配 `processed_videos.user_id`；`staff`（参与作者）严格匹配 `processed_videos.staff` 数组成员。两种角色分别查询，不做 OR 合并，不排除同时满足两种身份的视频。
- `page`：正整数，从 1 开始，默认 1。
- `pageSize`：1–100，默认 20。前端提供 10 / 20 / 50 / 100。

静态信息只来自 `processed_videos`，不回退到 `video_static`。按此次业务约定展示 `user_id` / `staff` 对应的身份，不推断词曲、调教等具体角色，也不推断未收录作品或 NULL staff 的完整名单。不擅自追加尚未确认的上游过滤标记规则。

播放量读取**每个视频各自最新日期**的 `video_daily.view`，响应同时返回 `recordDate`。不取历史最大播放量，不以较早的非 NULL 值补最新快照的 NULL；没有快照时播放量和日期均为 NULL。升序和降序都把 NULL 排在末尾，同值按 `aid ASC` 稳定排序。

响应 `result` 包含：`userId`、`sortBy`、`order`、`role`、`page`、`pageSize`、`total`、`rows`。每行字段：

- `aid`、`userId`：十进制字符串；`userId` 是该视频上传者，可跳转其创作者详情。
- `bvid`、`title`、`pic`：BV 号、标题、封面。
- `pubdate`：秒级 Unix 投稿时间戳；前端以北京时间显示。
- `view`、`recordDate`：最新已收录累计播放量及对应日期，均可为 NULL。

总数和分页数据在同一 SQL 语句、同一数据库快照中查询。页码超出范围返回空 `rows` 并保留真实 `total`；总数为 0 也是 200。账号资料缺失不阻止查询关联的视频。发现重复视频资料或当前页视频的最新日快照重复时返回 500，避免静默合并歧义数据。

部署前应核实查询索引：`processed_videos(user_id)`、`staff` 的 GIN 索引和 `video_daily(aid, record_date DESC)`。本次未连接业务数据库核验执行计划，也未创建或修改线上索引。

## 错误与界面

沿用 `ResponseDTO`：`code`、`timestamp`、`msg`、`result`；成功 HTTP 200，错误 HTTP 400 / 404 / 500。

- 参数格式、枚举或分页范围不合法：400，在访问数据库前拒绝；SQL 排序片段只由白名单生成，ID、分页均绑定参数。
- 账号资料未收录：基本信息接口 404；页面保留资料缺失提示和投稿列表。
- 服务或网络失败：页面允许分别重试资料和列表，不显示成无投稿。

第一版使用表格，提供作者身份、排序字段、升降序及分页。改变身份、排序或每页条数会回到第一页；切换条件和创作者时取消旧请求，避免迟到的响应覆盖新结果。标题链接使用 `/videos/{aid}`。支持中英文和窄屏横向表格滚动。

MOCK 仅使用仓库已有 COPY / 世末歌者的公开样本，播放量保持缺失；staff 无已提供样本，因此显示没有匹配的已收录参与投稿，不编造视频或计数。

## 验证

不连接业务数据库的后端测试：`mvn test-compile org.apache.maven.plugins:maven-surefire-plugin:3.2.5:test -Dtest=ProducerServiceTest,ProducerControllerTest`。

SQL 语义验证：`PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite/dist/index.js node sql/tests/producer_videos.test.mjs`。测试使用独立内存 PostgreSQL，覆盖角色分离、四种排序、同值顺序、分页、最新快照、NULL、真实 0 和重复记录。
