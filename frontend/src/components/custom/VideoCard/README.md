# VideoCard

从 UniSeek 原有的歌曲结果 Item 提取的共享歌曲卡片。统一搜索与创作者详情使用同一个组件，不复制第二套卡片展示；搜索的类型选择、关键词、排序和请求仍由搜索页管理。

```jsx
import VideoCard from './components/custom/VideoCard/VideoCard.jsx';

<VideoCard video={video} />
<VideoCard video={video} keyword="世末" showProducer />
```

- `video`：直接接受创作者分页投稿接口的行数据，含 `aid`、`title`、`pic`、`view`、`recordDate`、`pubdate`、`userId`。大整数 ID 使用十进制字符串。
- `keyword`：可选的搜索关键词，沿用已有纯文本切分高亮，正则特殊字符按字面处理，不注入 HTML。
- `showProducer`：默认关闭；参与作者模式下开启，显示实际上传者的 ProducerInfo。
- `favorite` / `like`：可选的额外累计指标。未提供字段时不显示该项，明确为 NULL 时显示 `—`；真实零显示 `0`。

保留原歌曲 Item 的 16:9 封面、歌曲标签、ID、标题和指标结构。封面和标题使用 `/videos/{aid}` 站内链接；标题两行省略，开口标点只在首行悬挂。封面为空或加载失败时使用图标占位。时间复用 RelativeTime，播放量提示注明接口提供的统计日期。配色、字重、圆角和阴影引用项目主题变量，标签无边框。

UniSeek 用 `videoCardFromSearchItem` 将 `id` / `coverUrl` 和 `payload.play` 等字段适配为上述结构，优先使用 payload 中的值；显式 NULL 不回退到兼容字段中的旧值。创作者列表直接传入原始行，不经过搜索接口或搜索 MOCK。卡片不请求视频基本信息或日指标；开启 ProducerInfo 时仅沿用该组件的账号资料请求。

创作者详情默认卡片模式，通过图标 Segmented 切换列表 / 卡片。网格按容器宽度排列多列，最小卡片宽度基准为 240px，窄屏可缩为一列；少量结果保留相同的列宽，不将单张卡片拉满桌面宽度。两种模式共用身份、排序、页码、每页条数和同一份响应；仅切换展示不重置查询或重新发请求。空数据、加载及错误状态在两种模式中分别显示。

预览入口：`/admin/design/components` 的 VideoCard，使用已有《世末歌者》公开样本，不编造播放量。页面入口：`/producers/396194`、`/uniseek?keyword=世末`；后者的查询数据仍取决于现有搜索接口 / MOCK 配置。
