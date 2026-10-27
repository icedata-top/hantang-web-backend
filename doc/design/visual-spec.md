# 冰数据视觉规范

视觉预览入口：`/admin/design/spec`，随管理入口开关启用。页面可切换白天、夜间或对照，窄屏下对照样本上下排列。页面顶部的主题预览不改变全站主题，导航栏的主题切换仍控制外层界面。

沿用 `frontend/README.md` 的品牌蓝、现有表面层级、8px 卡片圆角、普通与悬停阴影。本次补齐按钮、文字、Tooltip 与三种 Alert。现有页面继续使用原来的样式，新规范通过语义变量和 `ds-*` 样式供后续页面采用。

## 手动编辑与页面复用

**主题值的唯一编辑入口是 `frontend/src/styles/theme.css`**，包含颜色、字体栈、字号、字重、行高、圆角、阴影及边框宽度。文件按公共参数、日夜基础色与混色比例、公共派生配方组织。保存后开发页面自动更新，预览中的色值、字号与字重标注也随实际变量同步；修改设计时同步维护本文档。

`frontend/src/styles/design-system.css` 只定义公共组件样式；`global.css` 只负责基础样式和既有组件适配。预览页的 `DesignSpec.css` 只负责样本布局，字体与颜色引用主题变量。三个公共样式文件已在 `main.jsx` 加载，业务页面无需重复引入或复制配色。

配色分三层：基础色（`--text`、`--theme-primary`、九种 `--highlight-*`、中性背景、黑白端点）→ 日夜混色比例 → 语义颜色。只有基础色直接写色值；文本、按钮、Tooltip、Alert、分割线、阴影等通过变量和 `color-mix(in srgb, ...)` 派生。

红色统一来源：`--highlight-red` → `--button-danger-bg/hover`、`--alert-error-bg/border/text`、`--trend-up`。删除按钮按配置比例使用强调红或将其加深，错误提示将同一个红混入表面色；日夜分别使用各自的强调红与混色比例，不再单独挑另一组业务红色。信息提示使用品牌蓝，警告提示使用 `--highlight-orange`。

手调时优先修改基础色；需要只改深浅时，修改 `--danger-solid-strength`、`--danger-hover-strength`、`--alert-fill-strength` 等比例。与黑色混合时，原色占比越低越深；与白色混合时，原色占比越低越浅。基础色大幅变化后需重新检查对比度，配方不会自动选择对比度最高的颜色。

常用变量：

- 按钮字号：`--font-size-button`，当前引用 14px 的 `--font-size-body`；可以单独改成其他 px 值。
- 按钮字重：`--font-weight-button`，当前为 400。
- 卡片 / 按钮 / Alert 描边宽度：`--surface-border-width` / `--button-border-width` / `--alert-border-width`，当前均为 0px。
- 主题配色：`--canvas`、`--surface`、`--surface-hover`、`--text-primary`、`--text-secondary`、`--button-{类型}-bg/hover/text`。

新页面直接使用公共组件类，主题自动继承全站设置：

```jsx
<section className="ds-surface">
  <h2>内容标题</h2>
  <button className="ds-button" data-variant="primary">保存更改</button>
  <button className="ds-button" data-variant="secondary">筛选条件</button>
  <button className="ds-button" data-variant="normal">取消</button>
  <button className="ds-button" data-variant="danger" disabled>删除记录</button>
</section>
```

页面自己的内容样式继续引用主题值：

```css
.page-description {
  color: var(--text-secondary);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--line-height-body);
}
```

## Canvas 与 Surface

| 角色 | 语义变量 | 白天 | 夜间 |
| --- | --- | --- | --- |
| 页面最底层 Canvas | `--canvas` → `--bg` | #F4F4F4 | #1E1F22 |
| 卡片 Surface | `--surface` → `--navbar-bg` | #FAFAFA | #212226 |
| 卡片悬停 | `--surface-hover` → `--bg-hover` | #FFFFFF | #27282D |
| 分割线 / 可选描边 | `--surface-border` | 正文色 12% + Surface 88% | 正文色 12% + Surface 88% |
| 品牌主色 | `--theme-primary` | #438BED | #438BED |
| 品牌高亮 | `--theme-accent` | 品牌蓝 70% + 白 30% | 品牌蓝 70% + 白 30% |

卡片采用 8px 圆角，无描边（`--surface-border-width: 0px`），靠底色与阴影表达层级。普通阴影复用 `--shadow-card`，悬停复用 `--shadow-card-hover`，背景与阴影过渡 200ms。预览页同时保留普通样本与固定悬停样本，普通卡片可用鼠标和键盘体验变化。两种主题的预览容器也使用无描边样式。

## 按钮

Primary 用于核心操作，Secondary 用于次要操作，Normal 用于常规操作，Danger 用于破坏性操作。规范页的所有按钮仅提供演示反馈。

品牌主色保持 #438BED。Primary 使用品牌蓝与黑色按配置比例混色，Danger 使用当前主题的 `--highlight-red` 与黑色混色；原色占比为 100% 时直接使用基础色。下表比例均表示原色占比，余量混入所列端点；预览页显示最终解析出的 HEX。

| 类型 | 来源 / 混色端点 | 白天普通 / 悬停 | 夜间普通 / 悬停 | 文字 |
| --- | --- | --- | --- | --- |
| Primary | 品牌蓝 / 黑 | 100% / 80% | 100% / 80% | 白色 |
| Secondary | 品牌蓝 / Surface | 8% / 14% | 18% / 28% | `--text-link` |
| Normal | Surface / Surface Hover | 直接引用 | 直接引用 | `--text-primary` |
| Danger | 强调红 / 黑 | 100% / 78% | 80% / 60% | 白色 |

四类按钮的普通、悬停、禁用状态全部无描边，由 `--button-border-width: 0px` 统一控制。键盘聚焦仍显示独立的焦点外环。

四种按钮共用禁用态：背景使用正文色混入 Surface，白天原色占比 6%、夜间 8%；文字直接引用 `--text-disabled`。使用真实 `disabled` 属性，不响应点击，也不进入 Tab 顺序。

高度 36px，字体统一为 14px / 400，行高 22px，圆角 6px，水平内边距基准 16px。窄容器中的样本压缩水平内边距以保证三态可同屏查看。悬停过渡 160ms；键盘聚焦用 2px 品牌蓝外环，偏移 3px。尊重系统减少动态效果设置。

实现：`.ds-button` 配合 `data-variant="primary|secondary|normal|danger"`，固定悬停样本使用 `data-preview-state="hover"`。颜色使用 `--button-{类型}-bg/hover/text`，字号和字重使用独立的按钮变量。

## 字体与文字颜色

沿用系统无衬线字体栈。

| 层级 | 字号 | 字重 | 行高 | 颜色变量 |
| --- | --- | --- | --- | --- |
| 页面标题 | 24px | 600 | 1.4 | `--text-primary` |
| 分组标题 | 18px | 600 | 1.5 | `--text-primary` |
| 正文 | 14px | 400 | 1.6 | `--text-primary` |
| 重点正文 | 14px | 600 | 1.6 | `--text-primary` |
| 辅助文本 | 12px | 400 | 1.6 | `--text-secondary` |
| 禁用文本 | 14px | 400 | 1.6 | `--text-disabled` |
| 文字链接 | 14px | 500 | 1.6 | `--text-link`，悬停 `--text-link-hover` |

| 文字颜色 | 白天派生配方 | 夜间派生配方 |
| --- | --- | --- |
| 正文与标题 | 直接引用 `--text` | 直接引用 `--text` |
| 辅助文本 | 正文 72% + Canvas 28% | 正文 72% + Canvas 28% |
| 禁用文本 | 正文 45% + Canvas 55% | 正文 35% + Canvas 65% |
| 链接 | 品牌蓝 72% + 黑 28% | 品牌蓝 70% + 白 30% |
| 链接悬停 | 品牌蓝 64% + 黑 36% | 品牌蓝 55% + 白 45% |

辅助文字使用明确颜色，避免父容器透明度降低整个内容的可读性。对齐的数字使用 `font-variant-numeric: tabular-nums`。链接悬停增加下划线，键盘聚焦有外环。

## Tooltip

背景直接引用 `--text-primary`，文字引用 `--canvas`，由日夜主题的正文色与页面底色自然形成反色提示。字号 12px、字重 400、行高 1.6；内边距 8px × 12px，圆角 6px，最大宽度 240px，箭头与背景同色，阴影复用悬停阴影。

鼠标悬停或键盘聚焦时出现；移开鼠标、失焦或按 Esc 关闭。提示内容可被鼠标指向，触发按钮通过 `aria-describedby` 关联 `role="tooltip"`。预览同时提供常显样本与可交互样本。

## 三种 Alert

| 类型 | 唯一原色 |
| --- | --- |
| Info 信息 | `--theme-primary` |
| Warning 警告 | `--highlight-orange` |
| Error 错误 | `--highlight-red` |

三种提示共享同一套配方：背景将原色混入 Surface（白天 20%、夜间 16%）；文字与图标将原色混入当前主题的 `--text`（白天原色占比 60%、夜间 70%），混色端点由 `--alert-text-anchor` 控制。调整对应基础色即可同时改变该提示的背景、文字与图标。预览直接标注基础色来源。描边默认关闭；可选描边色仍从同一原色混入 Surface 得到（白天 28%、夜间 35%）。

标题 14px / 600，正文 14px / 400，行高 1.6，图标 16px，内边距 14px × 16px，圆角 8px，无边框（`--alert-border-width: 0px`）。语义由颜色、图标和文字共同表达。

实现：`.ds-alert` 配合 `data-variant="info|warning|error"`，颜色对应 `--alert-{类型}-bg/border/text`。规范页是静态样本，不主动播报错误；业务页面在动态状态变化时按场景配置适当的播报语义。
