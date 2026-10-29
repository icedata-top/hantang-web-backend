# 冰数据视觉规范

视觉预览入口：`/admin/design/spec`，随管理入口开关启用。页面可切换白天、夜间或对照，窄屏下对照样本上下排列。页面顶部的主题预览不改变全站主题，导航栏的主题切换仍控制外层界面。

沿用 `frontend/README.md` 的品牌蓝、现有表面层级、8px 卡片圆角、普通与悬停阴影。规范覆盖按钮、文字、Tooltip、三种 Alert、Tabs、Table 与 Pagination。现有页面继续使用原来的样式，新规范通过语义变量、`ds-*` 样式与公共组件供后续页面采用。

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
  <button className="ds-button" data-variant="secondary">取消</button>
  <button className="ds-button" data-variant="normal">更多</button>
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

Primary 用于核心操作，Secondary 用于取消、重置等次要操作，Normal 用于更多等常规操作，Danger 用于破坏性操作。总览筛选的「重置」使用 Secondary，「确定」使用 Primary。规范页的所有按钮仅提供演示反馈。

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
| 链接 | 品牌蓝 100% | 品牌蓝 70% + 白 30% |
| 链接悬停 | 品牌蓝 80% + 黑 20% | 品牌蓝 55% + 白 45% |

辅助文字使用明确颜色，避免父容器透明度降低整个内容的可读性。对齐的数字使用 `font-variant-numeric: tabular-nums`。链接悬停增加下划线，键盘聚焦有外环。

视频标题以 `【`、`（`、`《`、`〈`、`「`、`『`、`〔`、`［`、`｛`、`〖` 等宽开口标点开头时，首行使用 `text-indent: -0.45em` 做视觉悬挂，使标题与分区及封面的左边缘对齐。保留完整标题和标点，换行后的文字仍按内容左边缘排列；普通文字开头的标题不偏移。

## Tag / Chip

公共样式 `.ds-chip` 用于信息标签，搭配 `data-variant="neutral|orange"`。灰色用于分区和普通标签，橙色用于已有认证头衔；只展示信息，不增加按钮交互。规范页提供日夜对照。

标签无描边，圆角引用 `--radius-control`，最小高度 24px，内边距 2px × 8px，字号为 `--font-size-caption`，字重为 `--font-weight-medium`。长标签可换行。

颜色在 `theme.css` 集中维护：`--chip-neutral-bg/text` 使用中性文本与 Surface 派生灰色；`--chip-orange-bg/text` 由 `--highlight-orange` 与 Surface/正文色派生。橙色文字的原色占比通过 `--chip-orange-text-strength` 调整，白天 55%、夜间 85%。

视频封面悬停操作使用 `--media-overlay-bg` 的半透明黑色蒙层，按钮为无背景白字，文字引用 `--media-overlay-text`。键盘聚焦同样显示操作；移动端或无悬停设备常显底部操作，并使用 `--media-overlay-gradient`。这些媒体蒙层不随日夜主题变成浅色，以保证白字可读。

桌面端的「下载封面」「在哔哩哔哩观看」作为左右两组操作，整体居于封面中央；每组图标在上、文字在下，均居中对齐。图标使用 `--media-action-icon-size`（36px），文字使用正文字号（14px）。移动端图标缩为 26px，文字缩为 12px，保留上下结构。

## Tooltip

悬浮层使用当前主题的 Surface 配色：背景 `--tooltip-bg` 引用 `--surface`，文字 `--tooltip-text` 引用 `--text-primary`；日间与夜间分别沿用对应的 Surface，内部组件也使用正常主题文字色，不使用反色。Tooltip 与 Popover 统一遵循此规则，便于后续放入更多组件。字号 12px、字重引用 `--font-weight-regular`、行高 1.6；Tooltip 内边距 8px × 12px，圆角 6px，普通说明最大宽度 240px（组件内容可按需放宽），箭头与背景同色，阴影复用悬停阴影。

鼠标悬停或键盘聚焦时出现；移开鼠标、失焦或按 Esc 关闭。提示内容可被鼠标指向，触发按钮通过 `aria-describedby` 关联 `role="tooltip"`。预览同时提供常显样本与可交互样本。

RelativeTime 的四项悬停详情使用 Ant Design `Descriptions`，单列、小尺寸、无边框；标签列统一宽度并右对齐，内容列左对齐；标签用辅助文字色、内容用正文色。组件示例见 `/admin/design/components`。

## 三种 Alert

| 类型 | 唯一原色 |
| --- | --- |
| Info 信息 | `--theme-primary` |
| Warning 警告 | `--highlight-orange` |
| Error 错误 | `--highlight-red` |

三种提示共享同一套配方：背景将原色混入 Surface（白天 20%、夜间 16%）；文字与图标将原色混入当前主题的 `--text`（白天原色占比 60%、夜间 70%），混色端点由 `--alert-text-anchor` 控制。调整对应基础色即可同时改变该提示的背景、文字与图标。预览直接标注基础色来源。描边默认关闭；可选描边色仍从同一原色混入 Surface 得到（白天 28%、夜间 35%）。

标题 14px / 600，正文 14px / 400，行高 1.6，图标 16px，内边距 14px × 16px，圆角 8px，无边框（`--alert-border-width: 0px`）。语义由颜色、图标和文字共同表达。

实现：`.ds-alert` 配合 `data-variant="info|warning|error"`，颜色对应 `--alert-{类型}-bg/border/text`。规范页是静态样本，不主动播报错误；业务页面在动态状态变化时按场景配置适当的播报语义。

## Tabs

正文 14px / 400，选中项为 500 字重，默认高度 40px、间距 24px、选中下划线 2px，分别由 `--tabs-height`、`--tabs-gap`、`--tabs-indicator-size` 控制。没有外框，底部分隔线引用 `--tabs-divider`。

白天可用 Tab 文字和选中下划线直接使用 100% `--theme-primary`，悬停时文字与选中下划线使用 80% 品牌色加黑。夜间未选中项使用辅助文本色，选中及悬停文字引用现有夜间链接色，下划线保持品牌主色。禁用项始终使用 `--text-disabled`，不响应点击、不参与方向键切换。

同一时刻只有一个选中项。左右方向键循环切换并自动选中，Home / End 跳到首尾可用项；Tab 进入内容区域。窄屏横向滚动，键盘聚焦外环放在控件内部以避免裁切。组件提供完整的 tablist / tab / tabpanel 关联。

公共组件：`DsTabs`，接收 `items`（key、label、children、disabled）、`value`、`onChange` 和 `label`。

## Table

正文 14px / 400，表头 500 字重。最小行高 52px，单元格内边距 12px × 16px，通过 `--table-row-height`、`--table-cell-padding-block`、`--table-cell-padding-inline` 调整。无外框和纵向边线，仅保留横向分隔线，末行不画底线。

表头背景由正文色 4% 混入 Surface 得到，行悬停引用 Primary 的次要按钮浅底，避免新增独立颜色。数字右对齐、使用等宽数字和千分位；缺失数据用 —，真实零使用 0。长名称单行省略，完整名称可悬停查看。表格最小宽度 480px，窄容器内部横向滚动。

支持可排序表头，显示方向与 `aria-sort`。样本以播放量排序，缺失值在升降序中均排在最后。行内「查看」使用公共文字链接色，白天直接使用 100% 品牌主色，悬停加深并出现下划线。

空数据与加载采用同一居中区域，尺寸由 `--table-empty-height` 控制；空数据给出筛选建议，加载显示状态图标与文字并设置 `aria-busy`。样本中空数据、加载状态的分页按钮均禁用。

公共组件：`DsTable`，接收 `columns`（key、title、width、align、sortable、render）、`rows`（每行有唯一 id）、`caption`、`loading`、`sortKey`、`sortDirection`、`onSort` 与 `emptyText`。排序与数据请求由使用页面管理。

## Pagination

所有状态均无边框，由 `--pagination-border-width: 0px` 控制。页码默认 32px、间距 4px、圆角 6px，正文 14px / 400，当前页为 600 字重。窄容器中页码缩小到 28px；对应尺寸由 `--pagination-item-size`、`--pagination-gap`、`--pagination-item-size-compact` 控制。

当前页背景和文字直接引用 `--alert-info-bg` / `--alert-info-text`，每页条数选择框也沿用这两个变量；悬停背景将 Info 背景 60% 与 Surface 40% 混合，文字保持 Info 前景色。禁用文字引用 `--text-disabled`。没有另设硬编码业务颜色，日夜自动随 Info Alert 一起变化。

首尾禁用对应方向按钮，整体禁用时所有控件不可操作；空数据展示总数 0 和禁用的第 1 页。超过 7 页时保留首尾、当前页附近页码和省略号，省略号不进入焦点顺序。当前页通过 `aria-current="page"` 标注，每个分页区域有独立名称。修改每页条数后由页面重置到第 1 页，键盘聚焦显示 2px 外环。

公共组件：`DsPagination`，接收正整数 `current` / `pageSize`、非负 `total`、`onChange`、`disabled`、`label`，可选 `pageSizeOptions` / `onPageSizeChange`。

以上组件从 `frontend/src/components/design-system/DataDisplay.jsx` 导入，共享已全局加载的主题与样式。规范页的尺寸与颜色标注直接读取实际主题变量，保存 `theme.css` 后同步更新。
