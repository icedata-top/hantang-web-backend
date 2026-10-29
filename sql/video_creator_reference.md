# 视频静态信息与创作者账号表

整理日期：2026-10-28。数据库：PostgreSQL `hantang`；schema：`hantang_dynamic`。

依据：用户提供的字段查询结果、世末歌者与 COPY 的完整文本记录及四张查询截图，以及仓库的[字段快照](hantang_dynamic_schema.sql)。本次没有连接数据库、执行 SQL 或修改业务代码。文中区分已观察到的值与尚待上游确认的业务含义。

配套文件：[可执行的只读查询](video_creator_queries.sql)、[实例数据说明](examples/video_creator_sample.md)、[完整实例 JSON](examples/video_creator_sample.json)。

网页详情路径见[视频详情与创作者详情 URL](../doc/design/detail-page-urls.md)：`/videos/:aid`、`/producers/:userId`。视频详情已接入 `processed_videos` 的公开基本信息与 `video_daily` 的最新日快照；创作者详情已接入 `discovered_users` 资料和按 `user_id` / `staff` 身份筛选的分页投稿列表。

## 数据源约定

**视频静态信息统一来自 `hantang_dynamic.processed_videos`。如无必要，不得使用 `hantang_dynamic.video_static`。** 标题、投稿时间、简介、标签、封面、分区和上传者等均遵循此约定，后续页面、接口、查询、测试与设计示例应以此为准。

- 不因为字段名称中有 `static` 就选用 `video_static`。
- `processed_videos` 缺行或字段为 NULL 时，应保留缺失状态，不默认从 `video_static` 补齐。
- 只有明确需要存量数据对账、排查差异或兼容已有逻辑时，才使用 `video_static`，并说明用途。本文保留其结构与实例仅用于存量对照。
- 创作者的账号资料来自 `discovered_users`。视频上传者关联条件为 `processed_videos.user_id = discovered_users.user_id`。
- `user_id` 表示上传者，不能据此断定其承担词曲、调教、绘画等全部创作角色。2026-10-29 用户确认创作者页面以 `user_id` 展示“第一作者”、以 `staff` 数组成员展示“参与作者”，两类分别筛选；这不代表已经核实具体创作职责或完整创作者名单。

## `hantang_dynamic.processed_videos`

用途：视频基本信息、预处理状态、标签与来源信息。业务对象键是 `aid`，一条记录描述一个视频的当前信息，不是逐日快照，也不等同于去重音乐作品。是否由数据库约束保证每个 `aid` 唯一，见下文核实范围。

以下按用户提供的列顺序记录；未标记 `NOT NULL` 的字段允许 NULL。类型长度和数组元素类型结合仓库快照及截图记录。

- `aid`，`bigint NOT NULL`：视频 AV 号，实例为 `6009789`。
- `bvid`，`varchar NOT NULL`：视频 BV 号，实例为 `BV1Qs411k7Qv`。
- `pubdate`，`bigint`：投稿时间，秒级 Unix 时间戳，实例为 `1472134541`。
- `title`，`varchar`：视频标题。
- `description`，`text`：视频简介，可能包含换行及 HTML 实体文本。
- `tag`，`text`：标签原文；实例使用分号分隔，不是数据库数组。
- `pic`，`varchar`：封面地址。
- `type_id`，`integer`：旧版分区 ID，实例为 `30`。
- `user_id`，`bigint`：上传者用户 ID，关联 `discovered_users.user_id`，实例为 `396194`。
- `is_filtered`，`boolean NOT NULL`：上游过滤状态；实例确认为 `false`，真假对应的完整收录规则仍需上游确认，不能仅凭字段名推断。
- `created_at`，`timestamptz`：本表记录创建时间，不是投稿时间。
- `updated_at`，`timestamptz`：本表记录更新时间，不是视频逐日指标的观测时间。
- `staff`，`bigint[]`：协作者 ID 数组；具体角色和覆盖范围待上游确认。实例为 NULL。
- `tid_v2`，`integer`：新版分区 ID，实例为 `2016`；不与旧版 `type_id` 混用。
- `dynamic`，`text`：视频附带的动态文本，实例为 NULL。
- `tag_new`，`varchar[]`：数组形式的标签，实例与 `tag` 内容可对照，不预设两者永远完全一致。
- `participle`，`varchar[]`：分词结果，不能直接当作歌手或创作者实体关系。
- `ctime`，`bigint`：源数据的 `ctime` 时间戳，实例为 `1497423941`；具体业务含义待上游确认，不替代 `pubdate`。
- `is_deleted`，`boolean`：删除标记，实例确认为 `false`；NULL 不等于 `false`。
- `copyright`，`integer`：版权/转载类型编码，实例为 `1`；完整枚举含义待上游确认。
- `extras`，`jsonb`：源视频扩展属性；实例包含 `cid`、`state`、`rights`、`videos`、`duration`、`dimension`、`argue_info`、`honor_reply`。
- `notes`，`jsonb`：处理备注；实例含 `check_status=pending`、`video_category=chinese_v` 和预测置信度。
- `label_content_type`，`varchar(100)`：内容类型标签，实例为 `maybe_vocaloid`，不是已确认的歌手身份。
- `label_affiliations`，`text[]`：归属标签数组，实例为 NULL；完整定义待上游确认。
- `label_singers`，`text[]`：歌手标签数组，实例为 NULL，不能从标题自行补写为已确认数据。
- `label_source`，`varchar(50)`：标注来源，实例为 `rule`。
- `label_confidence`，`real`：标注置信度，实例为 NULL；不能用 `notes.prediction_confidence` 擅自填充。
- `labeled_at`，`timestamptz`：标注时间。
- `labeled_by`，`varchar(200)`：标注者/规则标识，实例为 `tid_rule`。
- `label_origin`，`text`：标注来源补充信息，实例为 NULL；具体约定待上游确认。
- `label_sources`，`bigint[] NOT NULL`：标注来源 ID 数组，ID 指向对象待上游确认；实例为非 NULL 的空数组 `{}`。
- `pid_v2`，`integer`：新版父分区 ID，实例为 `1003`；不代替 `tid_v2`。
- `mission_id`，`bigint`：源视频活动/任务 ID，实例为 NULL，具体关联对象待上游确认。
- `cover43`，`varchar`：源视频 `cover43` 封面字段，实例为 NULL。
- `tag_ids`，`bigint[]`：标签 ID 数组，实例为 NULL。

## `hantang_dynamic.discovered_users`

用途：已发现用户的账号资料与采集/过滤相关状态。业务对象键是 `user_id`，一条记录描述一个账号的当前信息，不是用户每日粉丝历史，也不是作品创作角色关系表。

用户查询返回 16 个有效字段；原始列序号从 6 跳到 8。以下保留有效字段的实际顺序，不补造第 7 列；缺号原因未核实。

- `user_id`，`bigint NOT NULL`：用户 ID，实例为 `396194`。
- `user_name`，`varchar`：当前用户名，实例为 `COPY`。名称可变化，不作为稳定关联键。
- `fans`，`integer`：粉丝数，实例为 `265636`，只代表本条资料记录的值。
- `videos_seen`，`integer`：已发现/处理视频相关计数，实例为 `63`；统计范围待上游确认，不能直接称为账号全站总投稿数。
- `videos_filtered`，`integer`：过滤相关视频计数，实例为 `5`；保留还是排除的业务含义待上游确认。
- `filter_pass_rate`，`real`：过滤通过率字段，实例为 `0.07936508`；该实例约等于 `5/63`，但不能仅凭一个样本认定全局计算规则。
- `discovered_at`，`timestamptz`：发现该账号的时间，不是账号注册时间；用户查询中的原始列序号为 8。
- `is_following`，`boolean`：采集侧的关注状态，实例为 `true`；不表示当前网页访问者是否关注该用户。
- `last_updated`，`timestamptz`：账号资料最近更新时间。
- `followed_by`，`bigint[]`：关注来源用户 ID 数组，实例为 `[507256226]`；完整维护口径待上游确认，不是该账号的全量粉丝列表。
- `face`，`varchar`：头像地址。
- `sign`，`varchar`：签名，实例由截图确认为 NULL。
- `level`，`smallint`：账号等级，实例为 `6`。
- `official_role`，`smallint`：认证角色编码，实例由截图确认为 `0`；保留原始值，不根据默认值或认证标题改写。
- `official_title`，`varchar`：认证标题，实例为 `bilibili 知名音乐UP主`。
- `filtered_view`，`bigint`：过滤相关播放量字段，实例为 `0`；统计集合及更新时间口径待上游确认，不能直接当作创作者总播放量。

## `hantang_dynamic.video_static`（仅供必要的存量对照）

用途：已有视频基本信息表。一条记录描述一个视频的基本信息，业务对象键为 `aid`。保留结构供差异排查，**如无必要，不得用于视频静态信息查询，也不得作为 `processed_videos` 缺失时的默认来源**。

- `aid`，`bigint NOT NULL`：视频 AV 号。
- `bvid`，`varchar(50) NOT NULL`：视频 BV 号。
- `pubdate`，`timestamptz NOT NULL`：投稿时间，已经是时间类型，与 `processed_videos.pubdate` 的类型不同。
- `title`，`varchar(255) NOT NULL`：标题。
- `description`，`text`：简介。
- `tag`，`text`：标签原文。
- `pic`，`varchar(255)`：封面地址。
- `type_id`，`integer`：旧版分区 ID。
- `user_id`，`bigint`：上传者用户 ID。
- `priority`，`integer`：既有优先级字段，完整业务定义待上游确认。
- `updated_at`，`timestamptz`：该表记录的更新时间。

实例中两张视频表的标签、更新时间不同；不得假定它们是可以随意互换的镜像，也不能通过此次样本推断全库同步状态。

## 时间、NULL 与关联口径

- 投稿时间以 `processed_videos.pubdate` 为准，用 `to_timestamp(pubdate) AT TIME ZONE 'Asia/Shanghai'` 得到北京时间。实例为 `2016-08-25 22:15:41`，对应 UTC 的 `2016-08-25 14:15:41+00`。
- `timestamptz` 保存时间点，客户端显示受会话时区影响；需要固定北京时间展示时显式使用 `AT TIME ZONE 'Asia/Shanghai'`。JSON 实例保留用户文本中明确给出的 `+00` 偏移，不把 UTC 文本误写为北京时间。
- 查询产生的 `pubdate_beijing` 是派生列，不是数据库字段，不写入 35 个 `processed_videos` 原始字段中。
- PostgreSQL NULL 对应 JSON `null`，数据库空数组 `{}` 对应 JSON `[]`，空字符串对应 JSON `""`；三者不能相互替代。`false` 和 `0` 是有效值，不能当作缺失。
- 不根据 DDL 默认值推断已有行的值；默认值不能证明某一条记录实际存了什么。
- `label_singers=NULL`、`staff=NULL` 不能解释为已确认“没有歌手/协作者”。本实例不足以建立完整创作角色关系。
- 联查账号资料使用 `LEFT JOIN`，保留缺少账号资料的视频；账号字段 NULL 应按缺失处理。正式接口使用明确字段列表和别名，避免 `SELECT *` 产生重名列。
- 实例是不同记录更新时间下的当前资料，不是同一观测时刻的历史快照；不能把 `fans` 等值当作 2016 年投稿时的数据。

## 约束、索引与核实范围

用户已提供三张表的字段名、类型、可空性和单条查询记录。数组元素类型及字符长度结合仓库快照、截图补充；没有新导出全库默认值、主键、唯一约束、外键、索引、重复行或执行计划。

因此 `aid` / `user_id` 在本文表示业务对象键，不据此宣称已经核实数据库唯一性。`user_id` 的关联是查询约定，不代表已验证存在数据库外键。配套查询文件提供 `pg_constraint`、`pg_indexes` 的只读检查语句，供后续核实；本次未执行。

单记录查询的 `LIMIT 1` 仅用于查看样本，不是重复记录消歧策略，不能证明实际只有一行。正式关联、统计或测试若依赖唯一性，应先核实约束及数据，不能沿用任意取一行来掩盖重复。

仓库字段快照的默认值沿用既有文件，本次没有重新核验，也没有将它转换成迁移脚本。上游业务定义待确认的字段，应继续保留原始值，不自行补充枚举或统计含义。
