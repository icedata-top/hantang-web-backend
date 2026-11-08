# 冰数据视觉规范

视觉预览入口：`/admin/design/spec`，业务组件预览入口：`/admin/design/components`，均随管理入口开关启用。规范页可切换白天、夜间或对照，窄屏下对照样本上下排列。页面顶部的主题预览不改变全站主题，导航栏的主题切换仍控制外层界面。

本文是 UI 与配色的统一约定，[前端 README](../../frontend/README.md) 提供入口与速查。沿用品牌蓝、现有表面层级、8px 卡片圆角、普通与悬停阴影，覆盖控件、文字、标签、浮层、数据展示、图表和移动端布局。新增及修改的界面遵循本规范；既有页面的遗留样式不作为继续复制硬编码色值或重复基础控件的依据。

## 基础组件选型

基础组件优先使用 Ant Design。已有的输入、选择、开关、日期等组件直接复用，不自行重写，也不使用原生 HTML 表单控件替代；项目主题和业务组合基于这些组件扩展。

- 少量简短选项（通常 2–4 个）：用 `Segmented` 或 `Radio.Group` 横排展示。
- 选项较多：用 Ant Design `Select`，需要时启用搜索，不使用原生 `<select>` / `<option>`。
- 输入：用 `Input`、`InputNumber`、`Input.TextArea`；日期用 `DatePicker`。
- 独立布尔设置用 `Switch`，多选用 `Checkbox`。
- 按钮、标签、信息描述和浮层复用 `Button`、`Tag`、`Descriptions`、`Tooltip` / `Popover` / `Drawer` 等已有组件；日期范围使用 `DatePicker.RangePicker`。

导航语言选择采用明确选项，顺序为「中文、English、日本語」，使用语言自身名称，不使用国旗或 Emoji。桌面端用无描边、无按钮阴影的 Ant Design 文本 Button 打开纵向 Dropdown 菜单，显示当前语言与选中状态，保留键盘焦点外环；移动端 Drawer 使用 Segmented，保留原生组件的键盘和焦点行为。语言选择与日夜主题切换独立。

输入框直接使用 Ant Design 输入框本体，不再额外包一层相同外观的圆角矩形。图标优先复用 `@ant-design/icons`；装饰图标跟随文字色，纯图标操作提供可访问的名称。

筛选用的 `Input`、`Input.TextArea`、`InputNumber`、`Select`、`DatePicker` / `DatePicker.RangePicker` 等统一使用 `variant="borderless"`，配合公共类 `.ds-filter-control`，不添加描边或额外外框。普通、悬停、聚焦 / 展开和禁用状态遵循下文的筛选控件规范。

项目已有的 `ProducerInfo`、`VideoInfo`、`VideoCard`、`RelativeTime`、`VideoHonor` 和 `DsTabs` / `DsTable` / `DsPagination` 按适用场景直接复用，业务页面不复制其请求、弹层或分页交互。`ds-*` 是已有的共享样式与兼容层，新增基础控件仍优先使用 Ant Design；语义化 HTML 可用于组织页面内容。

这条约定同时展示在 `/admin/design/spec`。保持控件原有的键盘、焦点、禁用和可访问性行为，样式通过项目主题变量适配，不重复实现基础交互。

## 手动编辑与页面复用

**主题值的唯一编辑入口是 `frontend/src/styles/theme.css`**，包含颜色、字体栈、字号、字重、行高、圆角、阴影及边框宽度。文件按公共参数、日夜基础色与混色比例、公共派生配方组织。保存后开发页面自动更新，预览中的色值、字号与字重标注也随实际变量同步；修改设计时同步维护本文档。

`frontend/src/styles/design-system.css` 只定义公共组件样式；`global.css` 只负责基础样式和既有组件适配。预览页的 `DesignSpec.css` 只负责样本布局，字体与颜色引用主题变量。三个公共样式文件已在 `main.jsx` 加载，业务页面无需重复引入或复制配色。

Ant Design 通过 `LocaleProvider` 开启 CSS 变量模式，公共样式中的 `icedata-antd` 适配将控件、表单标签、占位文字、下拉选项、日期面板、聚焦及禁用状态连接到上述主题变量。浮层挂到触发控件最近的显式主题容器，普通页面沿用 body，保证日夜对照样本中的浮层跟随各自主题。不要在业务页另写一套控件配色。

配色分三层：基础色（`--text`、`--theme-primary`、九种 `--highlight-*`、中性背景、黑白端点）→ 日夜混色比例 → 语义颜色。只有基础色直接写色值；文本、按钮、Tooltip、Alert、分割线、阴影等通过变量和 `color-mix(in srgb, ...)` 派生。

红色统一来源：`--highlight-red` → `--button-danger-bg/hover`、`--alert-error-bg/border/text`、`--trend-up`。删除按钮按配置比例使用强调红或将其加深，错误提示将同一个红混入表面色；日夜分别使用各自的强调红与混色比例，不再单独挑另一组业务红色。信息提示使用品牌蓝，警告提示使用 `--highlight-orange`。

### highlight 与业务配色

现有强调色共九种：红 `--highlight-red`、橙 `--highlight-orange`、黄 `--highlight-yellow`、绿 `--highlight-green`、青 `--highlight-cyan`、蓝 `--highlight-blue`、靛 `--highlight-indigo`、紫 `--highlight-violet`、浅紫 `--highlight-faint-purple`。具体日夜色值以 [theme.css](../../frontend/src/styles/theme.css) 为准；品牌色 `--theme-primary` 在两种主题下相同，highlight 则有各自的日夜色值，不能把夜间 highlight 蓝误当成品牌主色。

- 已有语义颜色优先直接引用，例如 `--text-link`、`--alert-info-bg`、`--trend-up`，不在页面重复混色配方。
- 新的业务强调色从现有 highlight 派生，在 `theme.css` 定义语义变量；组件的 CSS、行内样式与图表配置均不硬编码 HEX / RGB / HSL，也不自行新增一套业务色板。
- Ant Design 的默认色或 `Tag color="blue"` 等预设色不能代替项目主题色。复用组件后仍需用项目变量适配日夜状态。
- 正向增量用 `--trend-up`（红），负向用 `--trend-down`（绿），零用 `--trend-flat`；缺失值使用辅助文字色并明确写出「暂缺」或 `—`，不能当成零或持平。
- 播放荣誉固定为殿堂蓝、传说橙、神话紫；图表系列的颜色表示指标身份，不随每天涨跌换色。

派生变量在每个显式 `[data-theme]` 容器下重新计算，保证日夜对照不串色。新增变量同时检查普通、悬停、聚焦、禁用和浮层状态；文字与背景的对比度需分别检查两种主题，不能仅靠降低整个容器的透明度实现浅色文字。颜色语义同时配合文字、图标或正负号表达。

虚拟歌手应援色作为角色资料，允许用于正方形色块及半透明的斜线几何底纹。色块中心以加粗等宽字显示色号，色号为黑或白；四角框在色块外侧，使用正文色。颜色从已校验的配置数据传入局部变量，仅用于这两类展示，不替换正文、按钮、标签或焦点的主题配色。详见[虚拟歌手详情](vocal-detail.md)。

手调时优先修改基础色；需要只改深浅时，修改 `--danger-solid-strength`、`--danger-hover-strength`、`--alert-fill-strength` 等比例。与黑色混合时，原色占比越低越深；与白色混合时，原色占比越低越浅。基础色大幅变化后需重新检查对比度，配方不会自动选择对比度最高的颜色。

常用变量：

- 按钮字号：`--font-size-button`，当前引用 14px 的 `--font-size-body`；可以单独改成其他 px 值。
- 按钮字重：`--font-weight-button`，当前为 400。
- 卡片 / 按钮 / Alert 描边宽度：`--surface-border-width` / `--button-border-width` / `--alert-border-width`，当前均为 0px。
- 主题配色：`--canvas`、`--surface`、`--surface-hover`、`--text-primary`、`--text-secondary`、`--button-{类型}-bg/hover/text`。

新页面复用 Ant Design 组件，并通过公共组件类引用项目主题：

```jsx
import { Button } from 'antd';

<section className="ds-surface">
  <h2>内容标题</h2>
  <Button className="ds-button" data-variant="primary">保存更改</Button>
  <Button className="ds-button" data-variant="secondary">取消</Button>
  <Button className="ds-button" data-variant="normal">更多</Button>
  <Button className="ds-button" data-variant="danger" disabled>删除记录</Button>
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

首页 `/` 的顶部导航使用独立的轻表面：首屏将 Surface 以白天 12%、夜间 18% 混入透明底色，取消卡片阴影与整块悬停提亮，让弥散背景连续透出。向下滚动超过 24px 后，填充提高为白天 60%、夜间 72%，配合 16px 背景模糊保证内容滚过时导航仍可辨识；不支持背景模糊时回退到实色 Surface。背景过渡为 200ms，尊重减少动态效果设置。

首页导航的未选中文字使用辅助文字色与常规字重，选中和悬停仍使用品牌蓝，选中下划线细化为 1px。语言、主题和移动端菜单按钮默认透明，悬停时只对控件提供轻填充，保留键盘焦点外环；抽屉与浮层继续使用标准 Surface。上述颜色、混色比例和尺寸统一在 `theme.css` 的 `--navbar-home-*` 变量中维护；其余页面导航沿用普通卡片。`/admin/design/spec#spec-surfaces` 提供首屏、滚动后的日夜样本。

总览 `/overview` 左侧的筛选区域与右侧数据卡片共用 `.ds-surface` 标准样式：实色 Surface、8px 圆角及普通卡片阴影，悬停时使用 Surface Hover 与统一悬停阴影，不再按筛选是否激活改变卡片透明度。日夜主题、过渡与减少动态效果设置均沿用公共卡片规范；日历浮层与移动端抽屉继续使用正常表面。`/admin/design/spec#spec-surfaces` 使用真实筛选组件展示标准卡片样本。

「筛选条件」与「数据趋势」沿用相同的卡片标题排版：`--font-size-heading`（18px）、常规字重、正文色及分组标题行高。筛选内容采用单列布局，日期选择器铺满内容区，右侧与常驻的「查询」按钮右侧对齐。日期选择器使用 Ant Design `variant="borderless"`，默认背景直接引用 Surface（白天 `#FAFAFA`），与未悬停的卡片融为一体；卡片悬停变为 Surface Hover 时，选择器仍保留 Surface 底色，鼠标悬停在选择器上时改用 Canvas 中性填充以表明可交互。选择器获得焦点或展开日历时，背景引用 `--button-secondary-bg`，不显示蓝色边框、外环或底部指示线；键盘操作同样以 Secondary 填充反馈焦点。关闭日历并失焦后恢复普通背景，未提交修改和查询加载不作为选择器激活状态。三态颜色通过 `--overview-filter-control-{bg|hover-bg|active-bg}` 连接现有主题变量，圆角、高度与禁用状态继续复用公共主题，PC 与移动端使用同一套控件样式。

## 按钮

Primary 用于核心操作，Secondary 用于取消、重置等次要操作，Normal 用于更多等常规操作，Danger 用于破坏性操作。总览筛选的「重置」使用 Secondary，「查询」使用 Primary，两者携带图标、常驻显示并整体居右。查询在最后一次点击后等待 300ms 执行，连续点击合并为一次；查询期间显示加载状态并禁用查询，修改日期、重置或卸载时取消待执行查询。未改动日期也可重新查询，重置仍恢复最近一次已应用的筛选范围。按钮文案支持中、英、日三语。规范页的所有按钮仅提供演示反馈。

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

Ant Design Button 的状态变量同样由 `.ds-button` 适配，悬停与按下时保持对应用途的文字、底色及无描边状态。规范页按钮样本使用真实 Ant Design Button。

## 筛选控件

`/admin/design/spec#spec-controls` 提供文本输入、日期范围、Select、数字输入和筛选按钮的日夜对照，并可切换禁用状态。筛选输入控件统一采用无边框设计，参考总览页的日期范围选择器：

- 使用 Ant Design `variant="borderless"` 和公共类 `.ds-filter-control`，高度与圆角复用 `--control-height`、`--radius-control`。
- 普通状态使用 Surface；悬停使用 Canvas；获得焦点或展开下拉 / 日历时使用 Secondary 填充。键盘聚焦同样以底色明确反馈，不显示蓝色边框、外环或日期范围底部指示线；失焦且浮层关闭后恢复普通背景。
- 禁用时使用公共禁用底色与文字色，不响应悬停和聚焦，保留组件原有禁用及键盘行为。浮层继续使用标准 Surface 与现有主题配色。
- 三态背景统一由 `theme.css` 中的 `--filter-control-{bg|hover-bg|active-bg}` 维护，总览已有的 `--overview-filter-control-*` 变量引用同一组值；业务页面直接复用，不重复实现配色。尊重系统减少动态效果设置。

歌曲列表的「荣誉」使用竖向 Ant Design `Radio.Group`，配合公共类 `.ds-radio-group-vertical`，完整列出不限、未达殿堂、殿堂、传说和神话五项互斥条件。单选项保留组件原有的主题配色、选中态与键盘焦点；`/admin/design/spec#spec-controls` 提供同款单选样本。

## 字体与文字颜色

使用本机系统无衬线字体，按内容的 `lang` 选择字体栈，唯一配置入口为 `theme.css`：中文 `--font-family-zh` 优先 PingFang SC / Microsoft YaHei / Noto Sans SC，英文 `--font-family-en` 使用系统拉丁字体，日文 `--font-family-ja` 优先 Hiragino Sans / Yu Gothic UI / Meiryo / Noto Sans JP。`--font-family-sans` 随页面语言绑定，Ant Design 的 `fontFamily` token 使用同一个变量，浮层和控件保持一致。嵌入其他语言的内容须标注自身 `lang`；日夜主题预览同样遵循语言边界。

`/admin/design/spec#spec-typography` 同时展示中文、English、日本語，包含标题、正文、拉丁字母、数字及相同码位的汉字「骨 直 令 返 角」，并展示各自配置的字体栈。三列保持相同的字号、字重与行高，窄容器纵向排列；在白天、夜间和对照模式均可查看。不加载网络字体，最终字形取决于本机已安装字体；字体栈标注不代表逐字实际使用的字体。不同语言下相同汉字的细节可能不同，参见 [W3C 的语言与字体选择说明](https://www.w3.org/International/questions/qa-lang-why#fontselection)。

日文核心术语的选用、业务含义与官方参考资料见[日文本地化约定](localization-ja.md)。

| 层级 | 字号 | 字重 | 行高 | 颜色变量 |
| --- | --- | --- | --- | --- |
| 页面标题 | 24px | `--font-weight-semibold` | 1.4 | `--text-primary` |
| 分组标题 | 18px | `--font-weight-semibold` | 1.5 | `--text-primary` |
| 正文 | 14px | `--font-weight-regular` | 1.6 | `--text-primary` |
| 重点正文 | 14px | `--font-weight-semibold` | 1.6 | `--text-primary` |
| 辅助文本 | 12px | `--font-weight-regular` | 1.6 | `--text-secondary` |
| 禁用文本 | 14px | `--font-weight-regular` | 1.6 | `--text-disabled` |
| 文字链接 | 14px | `--font-weight-medium` | 1.6 | `--text-link`，悬停 `--text-link-hover` |

字重以实际变量为准，不按 `medium` / `semibold` 名称推断为固定的 500 / 600；规范页的数值标注直接读取主题。

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

标签无描边，圆角引用 `--radius-control`，最小高度 24px，内边距 2px × 8px，字号为 `--font-size-caption`，字重为 `--font-weight-medium`。新增 Ant Design Tag 使用 `variant="filled"` 并覆盖为项目语义色。长内容标签可换行；过线值、播放荣誉等短标签保持单行，数字标签随所在数值列右对齐。

颜色在 `theme.css` 集中维护：`--chip-neutral-bg/text` 使用中性文本与 Surface 派生灰色；`--chip-orange-bg/text` 由 `--highlight-orange` 与 Surface/正文色派生。橙色文字的原色占比通过 `--chip-orange-text-strength` 调整，白天 55%、夜间 85%。

实体类型 Tag 固定为虚拟歌手紫、创作者橙、歌曲绿，文字与底色引用 `--entity-{vocal|producer|video}-tag-{text|bg}`，由现有 highlight 色在 `theme.css` 派生；不使用品牌蓝区分实体类型。UniSeek 虚拟歌手卡片不展示内部 ID，创作者展示 UID，歌曲展示 av 号。

UniSeek 结果以优先缓冲队列每 90ms 逐项呈现，新卡片采用 270ms 的 4px 高斯模糊与淡入；不为既有卡片重复入场，不常驻 will-change。结果数量旁使用 Ant Design Switch 控制「结果入场动画」，偏好保存在本地；关闭动画不改变交错释放规则。系统减少动态效果时禁用动画。

播放荣誉复用 Ant Design `Tag variant="filled"`，统一使用 `TrophyOutlined` 奖杯图标，无边框。殿堂（≥10万）、传说（≥100万）、神话（≥1000万）分别从 `--highlight-blue`、`--highlight-orange`、`--highlight-violet` 派生颜色；背景和文字使用 `--honor-{hall|legend|myth}-bg/text`，不硬编码颜色。视频详情标题下只显示最高荣誉；本页三个日夜样本各自对应独立播放量。完整数据口径见[视频播放荣誉](video-view-honors.md)。

歌曲列表的表格、卡片模式及 UniSeek 歌曲结果统一复用 `VideoHonor`，使用 `.ds-chip.video-honor-tag` 保持同款形状、颜色和奖杯图标；图标跟随标签文字色。表格中的荣誉位于播放量旁，卡片中与绿色「歌曲」标签并排成组，av 号独立展示。每首作品仅显示达到的最高一级，未达 10 万或播放量缺失时不展示；UniSeek 直接使用搜索结果的累计播放量，不追加逐首快照请求。门槛说明支持悬停、键盘聚焦和触屏点击。

视频封面悬停操作使用 `--media-overlay-bg` 的半透明黑色蒙层，按钮为无背景白字，文字引用 `--media-overlay-text`。键盘聚焦同样显示操作；移动端或无悬停设备常显底部操作，并使用 `--media-overlay-gradient`。这些媒体蒙层不随日夜主题变成浅色，以保证白字可读。

桌面端的「下载封面」「在哔哩哔哩观看」作为左右两组操作，整体居于封面中央；每组图标在上、文字在下，均居中对齐。图标使用 `--media-action-icon-size`（36px），文字使用正文字号（14px）。移动端图标缩为 26px，文字缩为 12px，保留上下结构。

## Tooltip

悬浮层使用当前主题的 Surface 配色：背景 `--tooltip-bg` 引用 `--surface`，文字 `--tooltip-text` 引用 `--text-primary`；日间与夜间分别沿用对应的 Surface，内部组件也使用正常主题文字色，不使用反色。Tooltip 与 Popover 统一遵循此规则，便于后续放入更多组件。字号 12px、字重引用 `--font-weight-regular`、行高 1.6；Tooltip 内边距 8px × 12px，圆角 6px，普通说明最大宽度 240px（组件内容可按需放宽），箭头与背景同色，阴影复用悬停阴影。

鼠标悬停或键盘聚焦时出现；移开鼠标、失焦或按 Esc 关闭。提示内容可被鼠标指向，触发按钮通过 `aria-describedby` 关联 `role="tooltip"`。预览同时提供常显样本与可交互样本。

RelativeTime 的四项悬停详情使用 Ant Design `Descriptions`，单列、小尺寸、无边框；标签列统一宽度并右对齐，内容列左对齐；标签用辅助文字色、内容用正文色。组件示例见 `/admin/design/components`。

气泡宽度随内容收缩，`max-width` 只是上限，不为简短内容设置固定宽度。RelativeTime 上限为 `min(360px, 视口宽度 - 24px)`，避免右侧空白；复杂资料气泡也应限制在视口内。VideoInfo / ProducerInfo 的资料操作复用现有组件的点击、悬停和键盘行为，触屏可通过点击打开。

## 三种 Alert

| 类型 | 唯一原色 |
| --- | --- |
| Info 信息 | `--theme-primary` |
| Warning 警告 | `--highlight-orange` |
| Error 错误 | `--highlight-red` |

三种提示共享同一套配方：背景将原色混入 Surface（白天 20%、夜间 16%）；文字与图标将原色混入当前主题的 `--text`（白天原色占比 60%、夜间 70%），混色端点由 `--alert-text-anchor` 控制。调整对应基础色即可同时改变该提示的背景、文字与图标。预览直接标注基础色来源。描边默认关闭；可选描边色仍从同一原色混入 Surface 得到（白天 28%、夜间 35%）。

标题 14px，字重引用 `--font-weight-semibold`；正文 14px，字重引用 `--font-weight-regular`。行高 1.6，图标 16px，内边距 14px × 16px，圆角 8px，无边框（`--alert-border-width: 0px`）。语义由颜色、图标和文字共同表达。

实现：`.ds-alert` 配合 `data-variant="info|warning|error"`，颜色对应 `--alert-{类型}-bg/border/text`。规范页是静态样本，不主动播报错误；业务页面在动态状态变化时按场景配置适当的播报语义。

虚拟歌手列表 `/vocals` 的收录提示使用可关闭的 Ant Design Alert，图标、正文及关闭按钮垂直居中；单段提示不叠加标题或段落的默认外边距。正文中的「虚拟歌手」链接到 `/about/virtual-singers`，关闭按钮提供中／英／日文可访问名称，悬停和键盘焦点沿用现有主题变量。

## Tabs

正文 14px，普通和选中项分别引用 `--font-weight-regular` 与 `--font-weight-medium`，默认高度 40px、间距 24px、选中下划线 2px，分别由 `--tabs-height`、`--tabs-gap`、`--tabs-indicator-size` 控制。没有外框，底部分隔线引用 `--tabs-divider`。

白天可用 Tab 文字和选中下划线直接使用 100% `--theme-primary`，悬停时文字与选中下划线使用 80% 品牌色加黑。夜间未选中项使用辅助文本色，选中及悬停文字引用现有夜间链接色，下划线保持品牌主色。禁用项始终使用 `--text-disabled`，不响应点击、不参与方向键切换。

同一时刻只有一个选中项。左右方向键循环切换并自动选中，Home / End 跳到首尾可用项；Tab 进入内容区域。窄屏横向滚动，键盘聚焦外环放在控件内部以避免裁切。组件提供完整的 tablist / tab / tabpanel 关联。

公共组件：`DsTabs`，接收 `items`（key、label、children、disabled）、`value`、`onChange` 和 `label`。

## Table

正文 14px，正文与表头字重分别引用 `--font-weight-regular`、`--font-weight-medium`。最小行高 52px，单元格内边距 12px × 16px，通过 `--table-row-height`、`--table-cell-padding-block`、`--table-cell-padding-inline` 调整。无外框和纵向边线，仅保留横向分隔线，末行不画底线。

表头背景由正文色 4% 混入 Surface 得到，行悬停引用 Primary 的次要按钮浅底，避免新增独立颜色。数字右对齐、使用等宽数字和千分位；缺失数据用 —，真实零使用 0。长名称单行省略，完整名称可悬停查看。表格最小宽度 480px，窄容器内部横向滚动。

常规桌面宽度优先让表格完整适应容器，名称列吸收剩余空间，数值与时间列按内容伸缩，避免全部固定宽度导致必须左右滑动。过线值等短标签及其表头保持单行、数值右对齐。窄屏确实放不下时再在表格区域滚动，不让整页横向溢出。

总览的播放过线记录表在移动端复用 Ant Design Table 的 `scroll.x` 和左列 `fixed`：视频列保留 160px，整表最小横向宽度由各列宽度合计，表格在卡片内部左右滑动。视频列不随横向滚动移走，表头保持单行，数值不挤占标题空间；固定列与普通单元格均使用不透明的主题表面及悬停色，防止文字叠透。滑动提示支持中、英、日三语；PC 端继续自动分配列宽。`/admin/design/spec#spec-table` 提供 360px 窄容器的真实组件空状态样本，可检查表头横向滚动与视频列固定。

展示视频时优先使用 `VideoInfo` 显示可读标题，aid / av 号保留为标识或缺资料时的回退。创作者使用 `ProducerInfo`，时间使用 `RelativeTime`；表格中同样保留开头标点悬挂、长标题省略及完整资料气泡。

支持可排序表头，显示方向与 `aria-sort`。样本以播放量排序，缺失值在升降序中均排在最后。行内「查看」使用公共文字链接色，白天直接使用 100% 品牌主色，悬停加深并出现下划线。

空数据与加载采用同一居中区域，尺寸由 `--table-empty-height` 控制；空数据给出筛选建议，加载显示状态图标与文字并设置 `aria-busy`。样本中空数据、加载状态的分页按钮均禁用。

公共组件：`DsTable`，接收 `columns`（key、title、width、align、sortable、render）、`rows`（每行有唯一 id）、`caption`、`loading`、`sortKey`、`sortDirection`、`onSort` 与 `emptyText`。排序与数据请求由使用页面管理。

## Pagination

所有状态均无边框，由 `--pagination-border-width: 0px` 控制。页码默认 32px、间距 4px、圆角 6px，正文 14px，普通与当前页字重分别引用 `--font-weight-regular`、`--font-weight-semibold`。窄容器中页码缩小到 28px；对应尺寸由 `--pagination-item-size`、`--pagination-gap`、`--pagination-item-size-compact` 控制。

当前页背景和文字直接引用 `--alert-info-bg` / `--alert-info-text`，每页条数控件的选中态也沿用这两个变量；悬停背景将 Info 背景 60% 与 Surface 40% 混合，文字保持 Info 前景色。禁用文字引用 `--text-disabled`。没有另设硬编码业务颜色，日夜自动随 Info Alert 一起变化。每页条数选项不超过 4 个时使用 Ant Design `Segmented` 横排展示，更多时使用无边框的 Ant Design `Select`；不使用原生下拉框。

首尾禁用对应方向按钮，整体禁用时所有控件不可操作；空数据展示总数 0 和禁用的第 1 页。超过 7 页时保留首尾、当前页附近页码和省略号，省略号不进入焦点顺序。当前页通过 `aria-current="page"` 标注，每个分页区域有独立名称。修改每页条数后由页面重置到第 1 页，键盘聚焦显示 2px 外环。

公共组件：`DsPagination`，接收正整数 `current` / `pageSize`、非负 `total`、`onChange`、`disabled`、`label`，可选 `pageSizeOptions` / `onPageSizeChange`。

以上组件从 `frontend/src/components/design-system/DataDisplay.jsx` 导入，共享已全局加载的主题与样式。规范页的尺寸与颜色标注直接读取实际主题变量，保存 `theme.css` 后同步更新。

## 歌曲卡片与展示切换

歌曲卡片复用 [VideoCard](../../frontend/src/components/custom/VideoCard/README.md)，统一搜索和创作者详情共享封面、标题、标识与指标展示。创作者投稿用带图标及可访问名称的 Segmented 切换列表 / 卡片，桌面卡片一行多列、窄屏减列；两种视图保留同一查询和分页状态。未提供的额外指标不生成计数，明确缺失的指标显示 `—`，真实零仍为 `0`。

歌曲列表 `/videos` 同样复用 VideoCard、DsTable 和 DsPagination，默认紧凑表格，通过图标 Segmented 切换卡片；两种视图共用筛选、排序和页码。PC 筛选卡在左侧吸顶，移动端（不超过 767px）默认折叠为左侧 Drawer，页面保持整页纵向滚动。筛选仅提供「投稿日期」「荣誉」和「分区限定」：日期范围与分区 Select 复用无边框样式，荣誉采用竖向 Radio.Group，不提供最低播放量输入框，日期标签不附加时区备注，实际日期口径仍为北京时间。排序 Select 同样无边框；卡片列数按结果区可用宽度调整。

页面顶部集中展示简短介绍、当前结果总数、排序与视图切换，Uni Seek 使用小字号入口；移动端的筛选入口也放在此处。收录范围、统计日期和快照缺失值说明放入介绍旁的问号 Tooltip，支持悬停、键盘聚焦和触屏点击。右侧正文不再重复「全部歌曲 / 筛选结果」小标题及说明，表格或首排歌曲卡片与左侧筛选卡顶边对齐。

歌曲筛选的「重置」使用 Secondary，「查询」使用 Primary，两者携带图标、常驻显示并整体居右。重置撤销尚未提交的修改，恢复最近一次已应用条件；查询在最后一次点击后等待 300ms 执行，连续点击合并，查询期间显示加载并禁用查询。修改条件、重置或卸载时取消待执行查询；相同条件可以再次查询，查询从第 1 页开始，移动端提交后收起抽屉，关闭抽屉不清空条件。

标题复用 VideoInfo 的已有标题模式：点击进入详情，悬停或聚焦后加载资料气泡；播放量旁显示 VideoHonor，投稿人复用 ProducerInfo。页面使用现有主题变量，不另建配色或基础控件。

创作者列表 `/producers` 复用 ProducerInfo、DsTable 和 DsPagination，默认表格，可切换卡片；名称直接链接详情，头像、简介及资料浮层使用列表已返回的公开资料，不逐行请求。页面沿用歌曲列表布局：PC 左侧筛选卡吸顶，移动端（不超过 767px）默认折叠为左侧 Drawer。最低粉丝数、最低收录投稿数使用无边框 InputNumber；排序 Select 同样无边框，配合 Segmented 切换方向与视图。

顶部简介合并当前结果总数、排序、视图切换及小字号 Uni Seek 入口，移动端筛选入口也放在顶部。收录条件、收录投稿数口径、缺失资料和账号资料更新方式集中在问号 Tooltip，支持悬停、键盘聚焦和触屏点击；不将各账号资料标为统一日期的快照。正文不重复「全部创作者 / 筛选结果」小标题及说明，表格或首排卡片与左侧筛选卡顶边对齐，卡片列数随结果区宽度调整。

创作者筛选的「重置 / 查询」沿用歌曲列表的图标、Secondary / Primary 配色、右对齐和查询加载状态。重置恢复最近一次已应用条件；查询等待最后一次点击后 300ms 执行，相同条件可刷新并回到第 1 页，修改条件、重置或卸载时取消待执行查询。查询后关闭移动端抽屉，关闭或切换屏幕宽度时保留条件草稿；排序、分页及视图切换不丢弃尚未提交的筛选修改。页面不提供搜索框，查找具体创作者通过 Uni Seek 进入。

## 关于页的术语引文与收录范围

`/about` 简介中的「虚拟歌手」链接到 `/about/virtual-singers`。子页采用适合阅读的单列布局，三方引文以独立区块呈现，保留中文原文及其 `lang`，界面说明支持中／英／日文。引用区仅保留来源名称、引文及出处与协议链接，不额外添加总标题、内容概括、协议全称或排版说明；未声明 CC 许可的引用单独标明，不沿用其他引文的协议。

本站收录范围说明与外部定义分开。自然人、真人扮演的 VTuber / VUP、SVC 声音转换三类图示复用 Ant Design 主题图标和 `StopOutlined` 禁止图标，以文字明确表达排除含义；图标本体引用辅助文字色，禁止标识引用已有 `--alert-error-text`，不新增业务色。桌面三列，窄屏纵向排列；外链保留文字、悬停及键盘聚焦状态，标注来源而不暗示其为冰数据自己的定义。

歌曲与创作者的说明页分别位于 `/about/songs`、`/about/creators`，使用中／英／日文自然语言段落介绍本站用语及范围，沿用正文、标题、链接和面包屑的主题样式，不添加 Alert、引用卡片或图示。入口嵌入对应列表页的简介及 About 正文，相关概念之间通过正文链接互相访问。

## 图表与数据状态

总览四张 Indicator 卡片将标题、主数值、环比分为独立行，环比行使用可换行的弹性布局，长标签不参与主数值的列宽计算；箭头、百分比数值与 `%` 保持在同一行。PC 主列可用宽度达到 400px / 720px 时分别排列为两列 / 四列，移动端继续单列。英文环比标签使用 `vs. prev.`，鼠标悬停或键盘聚焦时说明它与紧邻当前区间之前的等长区间比较，不能标为固定的日比或月比。中文、英文、日文沿用同一布局与完整数值，主数值字号与字重通过 `--font-size-indicator` / `--font-weight-indicator` 维护。`/admin/design/components` 的 IndicatorCell 样本提供 320px / 640px / 800px 的容器宽度切换，使用总览已有 MOCK 数据检查各语言排版。

图表沿用 VChart，Canvas 配色同样读取当前主题变量，并在主题切换后更新。图例、坐标轴、提示和空状态一并适配日夜主题；不能只更换折线颜色。

七项视频指标共用 [metrics.js](../../frontend/src/constants/video/metrics.js) 的顺序和配色：播放蓝、收藏靛、点赞紫、硬币浅紫、分享红、评论橙、弹幕黄。总览页和单视频详情使用同一映射，当前七条系列不加入青或绿。切换累计 / 增量、语言或日期范围时，同一指标保持同一语义颜色。

缺失数据必须与真实零区分：保留日期和 NULL，折线在缺口断开，不补零、不插值、不跨缺口计算每日增量。某指标缺失只影响该指标，真实零和负增量照常展示。累计 / 增量模式及区间摘要的日期边界见[单视频历史数据与趋势](video-metrics-history.md)，总览口径见[总览 API](../../frontend/src/services/Overview/overview.md)。

视频详情趋势有明确的投稿日基线例外：范围包含投稿日且当日整日无快照时，七项初始累计值按 0 展示，并用辅助文字说明这是初始基线；真实快照、其余日期及部分指标缺失沿用上述规则，不补零。默认最近 14 天以 Daily 最新快照前一天为结束日，手动日期下限为投稿日，上限仍为昨天。

加载中、请求失败、查询成功但无记录、部分指标缺失分别显示对应状态。错误可重试，部分缺失说明受影响的日期或指标；不能把请求失败显示为「暂无数据」，也不能用未知值生成增长、日均或荣誉。

## 响应式与移动端

虚拟歌手详情采用紧凑的海报式布局：立绘直接位于 Canvas，文案靠近立绘，资料复用 Ant Design。优先在常规首屏呈现基本信息，官方及来源入口排在权利说明下方。背景使用半透明应援色的斜线几何图形，面积达到约屏幕三分之一的量级，可位于部分文字后方，不用弥散渐变；白天可提高线条不透明度和粗细，叠字优先保证对比度。控件仍使用项目主题色，来源按钮直接标注所属平台。内部编号不作为用户文案或背景水印。图片完整展示，窄屏按名称、立绘、资料的顺序纵向排列，只上下滚动。赤羽示例 `/vocals/304`，详见[虚拟歌手详情](vocal-detail.md)。

页面、卡片及子容器允许伸缩，长文本省略或换行，图表随容器调整尺寸；避免固定总宽度造成整页横向滚动。宽表可保留局部滚动，筛选和分页控件在窄屏换行。

### 筛选布局

总览 `/overview`、歌曲列表 `/videos` 和创作者列表 `/producers` 统一遵循以下布局约定，规范页顶部同步展示：

- **PC 端左侧固定**：筛选项在页面左侧单列排列，结果或数据内容位于右侧。浏览右侧内容时，筛选区保持固定可见，并避开顶部导航；筛选卡片复用标准 Surface 与现有 Ant Design 控件。
- **移动端默认折叠**：仅保留「筛选条件」入口，点击后通过左侧 Ant Design Drawer 展开筛选项。页面使用整页纵向滚动，关闭抽屉不清空已应用的条件。

总览、歌曲列表与创作者列表均采用上述布局。

总览 `/overview` 在不超过 767px 时使用整页纵向滚动，筛选入口和所有内容卡片一起向上移动，仅顶部 NavBar 保持吸顶。移除 PC 主列的固定高度、内部纵向滚动、额外左右内边距及滚动条预留空间；卡片与 NavBar 共同使用 `--page-gutter-inline`（20px）对齐外沿。移动端表格保留局部横向滚动，表头不设置纵向吸顶；PC 的左右分栏与主列内部滚动继续保留。

当前顶栏在宽度不超过 767px 时使用选项按钮打开右侧 Ant Design Drawer，菜单与语言、主题开关集中在抽屉中。选择站内入口后关闭抽屉，回到桌面宽度时关闭抽屉并恢复横向导航。沿用组件的关闭、遮罩及键盘行为，不自行重写浮层基础交互。

触屏操作不能只依赖 hover。视频封面的必要操作在无悬停设备常显，资料气泡可点击，所有交互保留键盘焦点与可访问名称；图标、文字、焦点外环都引用主题变量。

## 维护与验收

新增公共业务组件注册到 `/admin/design/components`；新增视觉状态或语义样式在 `/admin/design/spec` 提供适当样本，并同步本文档。预览中的输入、模式选择与开关也遵循同一套 Ant Design 选型约定。

按[验收方式](../../.cursor/rules/verification.mdc)完成必要的检查、测试或构建，报告页面入口；常规视觉、布局和交互由用户手动验收，不默认启动浏览器或反复截图。涉及配色时关注日夜主题，涉及布局时关注窄屏、长标题和长数值，但不把这些检查扩展成每次任务都要执行的浏览器流程。
