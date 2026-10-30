# RelativeTime

纯文本时间组件，不请求后端、不设置定时器。预览入口 `/admin/design/components`（需开启管理入口）。

```jsx
import RelativeTime from './components/custom/RelativeTime/RelativeTime.jsx';

<RelativeTime value={1793246400} mode="relative" />
<RelativeTime value="2026-10-29 12:00:00" mode="absolute" />
<RelativeTime value="2026-10-29T04:00:00Z" mode="absolute-diff" />
```

- `value`：秒级 UNIX 时间戳（数字或数字字符串），或 `yyyy-MM-dd`、`yyyy-MM-dd HH:mm[:ss]`、带 `Z` / 数字时区偏移的 ISO 字符串。
- `mode`：`absolute`、`relative`（默认）、`absolute-diff`。
- `className`：可选，组件自身继承普通文本的字号、颜色与字重。

不带时区的日期按北京时间 UTC+8 解析，所有输出也使用 UTC+8；不依赖浏览器所在时区。无效日期或空值显示 `—`。UNIX 数字一律按秒解释，不猜测毫秒单位。

组件首次挂载时只读取一次 `Date.now()`。输入值、模式或中英文切换后仍使用这个固定参考时刻；离开页面再次挂载时重新读取。没有自动刷新、后端请求或倒计时。

## 显示规则

- 绝对：`yyyy-MM-dd HH:mm`。
- 绝对 + 日期差：`yyyy-MM-dd HH:mm （xx天前）`，未来为 `xx天后`。天数按实际时间差的绝对值除以 24 小时向下取整，与经过多少次午夜无关。
- 相对：时间差 ≤120 秒显示「刚才」/「马上」；不足 1 小时显示整数分钟；其后按北京时间日历显示今天、昨天、前天及明天、后天，加上 `HH:mm`。其余同年显示 `MM-dd`，跨年显示 `yyyy-MM-dd`。
- 英文对应 `Just now` / `In a moment`、`N minutes ago` / `In N minutes`、`Today`、`Yesterday`、`Tomorrow`。前天与后天直接显示日期。

悬停或键盘聚焦显示四项详情：绝对时间、相对时间、距离现在（完整天数与剩余小时，均向下取整）、秒级 UNIX 时间戳。详情使用单列、小尺寸、无边框的 Ant Design `Descriptions`，气泡随内容收缩并限制在视口内，标签列统一宽度并右对齐，内容列左对齐；悬浮背景及文字沿用当前主题的 Surface 配色。详情始终使用同一个固定参考时刻。
