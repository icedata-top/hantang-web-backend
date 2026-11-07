# 视频播放荣誉

视频详情页根据最新收录日快照中的累计播放量 `view` 展示播放荣誉。阈值包含等号，每个视频只展示达到的最高一级。

- **殿堂**：累计播放量达到 100,000，且小于 1,000,000。颜色来源为 `--highlight-blue`。
- **传说**：累计播放量达到 1,000,000，且小于 10,000,000。颜色来源为 `--highlight-orange`。
- **神话**：累计播放量达到 10,000,000。颜色来源为 `--highlight-violet`。

例如，999,999 次播放显示「殿堂」，1,000,000 次显示「传说」，10,000,000 次显示「神话」。不足 100,000 次不展示荣誉标签。

## 数据口径

判定使用 `GET /videos/{aid}/latest-metrics` 返回的 `view`，即该视频最新一次收录的累计播放量。该值与详情页「最新数据」中的播放量一致，统计日期沿用快照的 `recordDate`。

荣誉仅在快照请求成功且播放量为有效非负整数时展示。加载中、请求失败、未收录快照或播放量缺失时不展示；其他指标缺失不影响已知播放量的荣誉判定。

## UI 与主题

标签位于视频标题下的信息行，与分区相邻。统一使用 Ant Design `Tag` 的 `filled` 样式和 `TrophyOutlined` 奖杯图标，无边框、无关闭按钮；文字分别为「殿堂」「传说」「神话」，英文为 Hall of Fame、Legendary、Mythic。

标签仅展示最高荣誉，不叠加较低等级。鼠标悬停或键盘聚焦可查看该荣誉的播放量门槛。图标为装饰，名称和阈值同时提供可访问性说明。

颜色在 `frontend/src/styles/theme.css` 中集中维护：

- `--honor-hall-bg/text` 从 `--highlight-blue` 派生。
- `--honor-legend-bg/text` 从 `--highlight-orange` 派生。
- `--honor-myth-bg/text` 从 `--highlight-violet` 派生。

背景使用 `--honor-fill-strength` 与 Surface 混色，文字通过 `--honor-text-strength` 与正文色混色，日夜主题分别计算。组件内不硬编码颜色，也不使用 Ant Design 预设色替代项目 highlight 色。

## 实现与验收

阈值与最高等级判定集中在 `frontend/src/constants/video/viewHonors.js`，`VideoHonor` 组件负责标签展示。边界规则通过 `frontend/tests/videoViewHonors.test.mjs` 验证。

视频详情入口为 `/videos/:aid`。三种标签的日夜主题样本位于 `/admin/design/spec` 的「Tag / Chip」章节；每个样本对应一个独立播放量。MOCK 视频沿用已有公开样本，没有收录日快照时不生成演示播放量或荣誉。
