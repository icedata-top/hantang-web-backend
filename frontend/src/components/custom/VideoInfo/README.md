# VideoInfo

将 aid 转成行内视频（歌曲）标题，悬停、点击或键盘聚焦打开资料气泡。使用现有 `fetchVideoInfo`，请求 `GET /videos/{aid}/info`，沿用 DEV / PROD / MOCK 配置。

```jsx
import VideoInfo from './components/custom/VideoInfo/VideoInfo.jsx';

<VideoInfo aid={6009789} />
<VideoInfo aid="av6009789" />
<VideoInfo aid="9007199254740993" hangingPunctuation={false} />
```

- `aid`：正整数数字或十进制字符串，也支持 `av` / `AV` 前缀和两端空白。最大为 `9223372036854775807`；超过 JavaScript 安全整数范围时必须使用字符串。无效 ID 不请求接口。
- `hangingPunctuation`：默认 `true`。识别 `【（《〈「『〔［｛〖“‘` 等开头标点，将行内标题向左悬挂 `0.45em`，浮层标题仅首行悬挂；可传 `false` 关闭。
- `className`：可选，作用于行内触发按钮，默认继承所在位置的字号与颜色。行内偏移可通过该类设置 `--video-info-hanging-offset`；放入列表、表格时，外层需留出标点悬挂空间。

长标题在行内单行省略，气泡中换行展示完整标题，开头标点不会因自身省略样式被裁切。气泡展示封面、AV / BV 标识、投稿人、投稿时间（北京时间）、分区、时长与最多三行简介。标题和简介按纯文本显示，并复用 `&amp;` 转义处理；缺失资料显示占位，封面失败显示图标。

组件需要位于 React Router 内。气泡提供新标签页访问 `https://www.bilibili.com/video/av{aid}` 和站内 `/videos/{aid}` 两个按钮。支持 Tab / 向下方向键进入气泡操作，Escape 关闭并返回标题；颜色沿用当前主题与共享按钮规范。

挂载时请求基本信息，不额外请求日快照或哔哩哔哩 API。加载中、未收录和请求失败时保留 `av{aid}`；404 表示本站暂未收录资料，不代表视频在哔哩哔哩不存在。失败可在气泡中重试。切换 aid 或卸载会取消旧请求，避免旧视频覆盖新资料。

预览入口：`/admin/design/components`（需开启管理入口）。默认使用已有的世末歌者样本 `6009789`，标题以 `【` 开头，可通过对齐开关和宽度选项比较悬挂、截断效果。
