# 世末歌者与 COPY：视频、账号实例

整理日期：2026-10-28。来源：用户在本次会话中粘贴的三条数据库记录、字段查询结果，以及四张查询截图。没有重新查询数据库；实际查询时刻未记录，整理日期不等同于采集时间。

完整数据保存在 [video_creator_sample.json](video_creator_sample.json)，字段说明见[视频与创作者表文档](../video_creator_reference.md)，重新查询可使用[只读 SQL](../video_creator_queries.sql)。JSON 是这份实例的完整值来源，本文说明如何解读和复用。

## 实例对象与来源约定

- 视频：`aid=6009789`，`bvid=BV1Qs411k7Qv`，标题为 `【乐正绫原创】世末歌者【PV付/COSMOSⅡ】`。
- 上传者：`user_id=396194`，账号名称为 `COPY`。简介中的署名 `COP` 保留原文，不擅自改成账号名称。
- 关联：`processed_videos.user_id = discovered_users.user_id = 396194`。
- 视频静态信息统一来自 `hantang_dynamic.processed_videos`。**如无必要，不得使用 `video_static`，也不得默认回退到该表。**
- JSON 中的 `legacy_reference.video_static` 仅保存用户已经提供的存量对照记录，不是默认测试或页面的数据来源。

## JSON 组织与完整性

- `source`：来源、整理日期、示例对象及转录方式。
- `records.processed_videos`：该视频的全部 35 个原始字段，按表字段顺序保存。
- `records.discovered_users`：该账号的全部 16 个有效字段，按表字段顺序保存。原始列序号缺少 7 不影响 JSON 字段完整性。
- `derived.pubdate_beijing`：查询计算出的北京时间投稿时间，单独保存；它不是 `processed_videos` 的第 36 个数据库字段。
- `legacy_reference.video_static`：已有对照记录的全部 11 个字段。

JSON 为设计和只读测试的静态实例，不是数据库导出备份或可直接写入的迁移数据。没有为缺失值推测额外内容，也没有补造数据库约束。

## 文本与截图核对结果

截图补充了复制文本中丢失或显示不清的值：

- `processed_videos.is_filtered=false`、`processed_videos.is_deleted=false`。
- `processed_videos.staff=null`、`dynamic=null`、`label_affiliations=null`、`label_singers=null`、`label_confidence=null`、`label_origin=null`、`mission_id=null`、`cover43=null`、`tag_ids=null`。
- `processed_videos.label_sources=[]`：数据库显示为 `{}`，是空数组，且该字段不允许 NULL。
- `discovered_users.sign=null`、`discovered_users.official_role=0`。

长文本、完整 URL、嵌套 JSON 和时间的小数秒/偏移使用用户粘贴的完整文本；截图用于确认可见的布尔值、NULL、空数组和认证角色，未用截断文本覆盖完整值。

简介保留换行，原文 `hello&amp;bye，days` 中的 `&amp;` 也保持原样。JSON 中用 `\n` 表示换行；读取 JSON 后仍是换行字符。PostgreSQL 数组转为 JSON 数组，`extras`、`notes` 保留为 JSON 对象，数值和布尔值保留原始类型。

## 已确认的核对点

- 投稿时间戳为 `1472134541`，北京时间为 `2016-08-25 22:15:41`，对应 UTC 的 `2016-08-25 14:15:41+00`。
- 旧版分区 `type_id=30`，新版分区 `tid_v2=2016`，新版父分区 `pid_v2=1003`，三个字段分别保留。
- 封面来自 `processed_videos.pic`，上传者名称/头像来自 `discovered_users.user_name` / `face`。
- `fans=265636`、`videos_seen=63`、`videos_filtered=5`、`filter_pass_rate=0.07936508`、`filtered_view=0` 是该记录的实际值，不代表已核实其全局统计公式或账号全部作品的表现。
- `extras.duration=363`、`extras.cid=35302832`，扩展字段只在实例中按原样记录，不据此补造额外表字段。
- `notes.check_status=pending`、`label_content_type=maybe_vocaloid`、`label_source=rule`、`labeled_by=tid_rule`；`label_singers` 仍为 NULL，不能当作已完成歌手识别的样本。
- `notes.prediction_confidence=0.7993224336146333` 与 `label_confidence=null` 同时保留，不能互相替代。

## 存量对照的差异

`video_static` 与 `processed_videos` 的 `aid`、`bvid`、标题、投稿时间点和上传者在该实例中一致。投稿时间分别存储为 `timestamptz` 和秒级时间戳；只有转换后才可直接比较时间点。

标签并不完全一致：`processed_videos.tag` 包含 `发现《世末歌者》`，标签排列也有差别；两表 `updated_at` 分别是 `2026-08-30 20:00:59.166464+00` 和 `2026-03-21 07:00:00.037083+00`。这说明不能在设计时把两表当成可以随意替换的数据源，亦不足以推断全库的数据新旧或同步状态。

仅在确有必要对账时，可单独执行以下 SQL 获取带字段名的存量记录；常规查询使用配套文件中的 `processed_videos` SQL：

```sql
SELECT to_jsonb(s) AS legacy_video_static
FROM hantang_dynamic.video_static AS s
WHERE s.aid = 6009789
LIMIT 1;
```

## 后续设计与测试的使用边界

可以用本实例设计视频详情、标题/封面展示、投稿时间转换、上传者资料联查、JSON 输出、NULL 展示、布尔值和空数组处理。账号资料的 `last_updated` 与视频记录的 `updated_at` 不同，不能把这些值视作投稿时或同一天的历史快照。

本实例不含 `video_daily` 或其他日指标记录，因此不能支持播放、点赞、收藏、粉丝等历史趋势的测试。协作者、歌手标签均为 NULL，也不能验证多人合作、合唱关系、账号签名为空字符串、账号缺失或重复记录的处理；需要这些场景时另行补充并注明来源。后续重新查询返回的可变值发生变化时，应记录新的来源和日期，不把本静态实例当作线上恒定值。
