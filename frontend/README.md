# icedata-web-react

本目录是仓库中的前端，基于 React。与后端分开启动，包管理使用 npm。

## Quick start

在本目录执行：

1. 安装依赖：`npm install`
2. 启动开发服务器：`npm run dev`
3. 打包构建：`npm run build`

锁文件使用 `package-lock.json`。仓库里仍留有 `pnpm-lock.yaml`，当前环境不安装、不使用 pnpm。

启动后默认在 `http://localhost:5173/` 访问。

## 详情页路由

- 视频详情：`/videos/:aid`，例如 `/videos/6009789`。
- 创作者详情：`/producers/:userId`，例如 `/producers/396194`。

视频详情已接入基本信息与最新日快照两个接口，展示标题、分区、投稿时间、封面、上传者、七项累计指标、简介及标签；创作者详情仍为空白占位。详情页分别选中「歌曲」和「创作者」导航项；ID 格式须为不带前导零的正整数，否则显示未找到页面。`/videos`、`/producers` 仍保留原有列表待开发入口。

视频页沿用视觉规范：标题与简要信息放在 Canvas 上，桌面端封面与右侧创作者/数据卡片等高，移动端改为单列。封面悬停或键盘聚焦显示下载与观看操作，触屏设备常显操作；统计日期位于数据卡片右下角，缺失指标保留为 `—`。标题、简介、标签中的 `&amp;` 仅在前端按纯文本替换为 `&`；投稿天数按北京时间日期计算，开头为宽开口标点的标题做首行视觉悬挂。

接口、返回字段和错误约定见[视频详情 API](src/services/Video/video.md)。MOCK 模式仅提供文档中世末歌者的公开基本信息；没有真实日快照样本，最新指标按无记录处理，不编造数值。

完整约定见[详情页 URL 设计](../doc/design/detail-page-urls.md)。

## 环境与后端配置

项目支持三个运行环境：`MOCK`、`DEV`、`PROD`。环境配置与 API base URL 定义在：

- `src/config/runtimeEnv.js`
  - `CURRENT_APP_ENV`：当前环境（优先读取 `VITE_APP_ENV`）
  - `BASE_URL_BY_ENV`：`DEV` / `PROD` 的 base url

### 三个环境的作用

- `MOCK`
  - 各 `xxx.api.js` 直接返回本地 MOCK 数据，不发起后端请求
  - 启动命令：`VITE_APP_ENV=MOCK npm run dev`
- `DEV`
  - 浏览器直接请求本机后端 `http://localhost:8080`
  - `npm run dev` 未设置 `VITE_APP_ENV` 时使用此环境
  - 需要先在仓库根目录启动后端
- `PROD`
  - 前端会发起真实 HTTP 请求
  - 默认请求同源 `/api`，容器部署时由 Caddy 转发到后端服务

### 如何修改 API base URL

容器部署时可通过环境变量注入：

```sh
ICEDATA_API_BASE_URL=/api
ICEDATA_API_UPSTREAM=http://icedata-backend:8080
ICEDATA_DB_URL_LOCAL=jdbc:mysql://...
ICEDATA_DB_USER_LOCAL=...
ICEDATA_DB_PASSWORD_LOCAL=...
ICEDATA_POSTGRE_HOST=...
ICEDATA_POSTGRE_PORT=5432
ICEDATA_POSTGRE_DATABASE=...
ICEDATA_POSTGRE_USER=...
ICEDATA_POSTGRE_PASSWORD=...
ICEDATA_WEB_IMAGE=ghcr.io/icedata-top/icedata-web-react:main
ICEDATA_BACKEND_IMAGE=ghcr.io/icedata-top/hantang-web-backend:main
```

其中 `ICEDATA_API_BASE_URL` 是浏览器请求的同源前缀，`ICEDATA_API_UPSTREAM` 是 Caddy 容器内访问后端的地址。
`ICEDATA_DB_*` 和 `ICEDATA_POSTGRE_*` 会由 `docker-compose.yml` 生成后端需要的 `/app/config.secret.properties`。
`docker-compose.yml` 默认直接从 GHCR 拉取前端和后端的 `main` 镜像，可通过 `ICEDATA_WEB_IMAGE` 和 `ICEDATA_BACKEND_IMAGE` 覆盖。

### 如何切换环境

通过 Vite 环境变量 `VITE_APP_ENV` 设置（可在启动命令前临时设置，或写入 `.env.local`）：

- `VITE_APP_ENV=MOCK`
- `VITE_APP_ENV=DEV`
- `VITE_APP_ENV=PROD`

`npm run dev` 未设置时默认使用 `DEV`，直接请求 `http://localhost:8080`。`npm run build` 未设置时默认使用 `PROD`。

## 管理配置页面

管理配置页面位于 `/admin`。顶部「管理配置」是一级，左侧分组是二级，分组下的页面是三级。「运行环境」展示当前环境、API 地址和管理入口状态；「视觉规范」位于 `/admin/design/spec`，支持白天、夜间和对照预览，展示 Canvas、Surface、按钮三态、文字、Tooltip、三种 Alert、Tabs、Table 与 Pagination。其余条目为施工占位，复用开发中插图，尚未接通数据或写入。
只有显式启用开关时，才注册页面路由和顶部「管理配置」菜单；未配置、空值或 `false` 均关闭，直接访问 `/admin` 返回 404 页面。

本地开发在 `frontend/.env.local` 中配置后重启开发服务器：

```dotenv
VITE_ADMIN_ENABLED=true
```

`.env.local` 已加入 Git 忽略，不提交本地开关。删除此项或设置为 `false` 即可关闭。
Vite 构建也会读取 `.env.local`，发布时应确认开关值。

Docker 部署设置 `ICEDATA_ADMIN_ENABLED=true` 并重新创建前端容器即可开启，无需重新构建镜像；默认关闭。
运行时的 `adminEnabled` 优先于 Vite 的 `VITE_ADMIN_ENABLED`。

此开关仅控制前端页面与菜单，不是身份认证。不要在前端环境变量中存放密码或密钥；后续管理写入接口需要后端权限校验。

## 目录树

```
icedata-web-react/
├── index.html                 # 入口 HTML（站点标题、favicon）
├── package.json
├── package-lock.json
├── pnpm-lock.yaml
├── Caddyfile
├── docker-compose.yml
├── vite.config.js
├── public/
│   ├── png/                   # Logo 等位图
│   └── svg/                   # unDraw 等插图
├── src/
│   ├── main.jsx               # React 挂载、全局样式入口
│   ├── App.jsx                # 根组件与路由
│   ├── components/
│   │   ├── IcedataNavbar.jsx
│   │   └── IcedataNavbar.css
│   ├── pages/
│   │   ├── Home/
│   │   ├── About/
│   │   ├── Overview/
│   │   ├── UniSeek/           # 统一搜索结果页（独立 Item，不复用列表 Item）
│   │   ├── video/             # VideoDetail：视频详情、最新日快照与展示格式化
│   │   ├── vocal/             # 虚拟歌手：VocalList / VocalDetail
│   │   ├── producer/          # ProducerDetail：创作者详情空白占位
│   │   └── …
│   ├── services/              # API / MOCK
│   ├── hooks/
│   └── styles/
│       ├── theme.css          # 统一主题变量，手动调整颜色、字号、字重等
│       ├── global.css         # 全局基础样式与既有组件适配
│       ├── design-system.css  # 可复用的按钮、卡片、Tooltip、Alert 样式
│       └── meshBackground.css # 首页 / 关于弥散背景
└── tests/
```

## 配色方案

颜色、字体、字号、字重、圆角、阴影与边框宽度统一在 **`src/styles/theme.css`** 中手动编辑。公共参数同时影响两种主题，白天为 `:root` 或 `[data-theme='light']`，夜间为 `[data-theme='dark']`（与导航栏主题切换一致）。**品牌色在深浅主题下相同**。

`src/styles/design-system.css` 只负责可复用组件样式，通过变量引用主题；`src/styles/global.css` 负责全局基础样式与既有组件适配。规范页的布局在 `src/pages/Admin/DesignSpec.css`，不重复定义色值与字号。完整约定与页面使用示例见 [视觉规范](../doc/design/visual-spec.md)。

常用手调入口：`--font-size-button`（当前 14px）、`--font-weight-button`（当前 400）、`--font-size-body`、`--text-secondary`，以及 `--button-{类型}-bg/hover/text`。四类按钮、新规范卡片及三种 Alert 均无描边，由 `--button-border-width: 0px`、`--surface-border-width: 0px`、`--alert-border-width: 0px` 控制。后续页面直接使用 `ds-button`、`ds-surface`、`ds-alert` 等公共类与主题变量。Tabs、Table、Pagination 的公共 React 组件从 `src/components/design-system/DataDisplay.jsx` 导入；尺寸和配色仍集中在 `theme.css`，分页器全状态无边框，选中配色直接引用 Info Alert。

白天文字链接、行内「查看」和可用 Tab 文字直接使用 100% 品牌蓝，悬停加深；夜间沿用现有链接派生色。

业务色通过 `color-mix()` 从基础色推导：Primary / Info 使用品牌蓝，Danger / Error / 上涨色统一使用 `--highlight-red`，Warning 使用 `--highlight-orange`。日夜主题分别设置混色比例，正文与辅助、禁用文字也由基础文本色和背景色混合生成。只改基础色即可联动全部相关组件；深浅程度可单独调整 `*-strength` 比例。

### 品牌色（冰数据）

| 用途 | 变量名 | 色值 | 说明 |
|------|--------|------|------|
| 主题主色 | `--theme-primary` | `#438BED` | 链接、强调、导航高亮、搜索按钮默认色等 |
| 品牌高亮 | `--theme-accent` | 品牌蓝 70% + 白 30% | 品牌强调、既有搜索按钮悬停等；随品牌主色联动 |

### 涨跌色（同环比等）

与 **A 股等常见行情色** 一致：**上升为红、下降为绿**；持平为中性灰。变量在 `src/styles/theme.css` 中定义，组件内用 `var(--trend-up)` 等引用。

| 变量名 | 浅色（`:root`） | 深色（`[data-theme='dark']`） | 含义 |
|--------|------------------|-------------------------------|------|
| `--trend-up` | `#F05454` | `#FF7875` | 上升（红），引用 `--highlight-red` |
| `--trend-down` | `#46B970` | `#73D13D` | 下降（绿），引用 `--highlight-green` |
| `--trend-flat` | 正文色与 Canvas 各 50% | 正文色与 Canvas 各 50% | 持平 / 无变化 |

### 浅色主题（`:root`）

| 变量 | 色值 | 典型用途 |
|------|------|----------|
| `--bg` | `#f4f4f4` | 页面主背景 |
| `--bg-hover` | `#ffffff` | 卡片、可悬停表面在 pointer 悬停时的背景 |
| `--text` | `#333333` | 正文与标题文字 |
| `--card-bg` | `#ffffff` | 表单控件、次级块背景等 |
| `--navbar-bg` | `#fafafa` | Surface：导航栏卡片、总览卡片等默认表面背景，悬停使用 `--bg-hover` 提亮 |
| `--border` | 正文色 12% + Surface 88% | 边框、分割线 |
| `--shadow` | 黑色 12% + 透明 88% | **悬停卡片阴影**等较重阴影的基准色 |

### 深色主题（`[data-theme='dark']`）

| 变量 | 色值 | 典型用途 |
|------|------|----------|
| `--bg` | `#1E1F22` | 页面主背景 |
| `--bg-hover` | `#27282D` | 卡片等表面悬停背景 |
| `--text` | `#e0e0e0` | 正文与标题文字 |
| `--card-bg` | `#24262b` | 表单控件、次级块背景等 |
| `--navbar-bg` | `#212226` | Surface：导航栏卡片、总览卡片等默认表面背景 |
| `--border` | 正文色 12% + Surface 88% | 边框 |
| `--shadow` | 黑色 35% + 透明 65% | 悬停卡片阴影的基准色 |

### 卡片与阴影（全局）

| 变量 | 说明 |
|------|------|
| `--radius-card` | 卡片圆角（默认 `8px`，小于早期 `12px`） |
| `--shadow-card` | **默认**较轻、较淡的阴影 |
| `--shadow-card-hover` | **悬停**时加深阴影（与原先「常显重阴影」一致的量级） |

导航栏 `Card`、总览页 `Card` 等使用上述变量，并在 `:hover` 时切换为 `--shadow-card-hover` 与 `--bg-hover`。可选工具类：`.app-card-surface` / `.app-card-surface:hover`（定义在 `global.css`）。

深色下部分卡片边框仍会使用组件级 `#343840`（与导航栏一致），以保证与深灰背景对比度。

浅色下导航条外层背景与 `--bg` 一致，不再使用向白色混合的渐变，避免出现卡片背后类似 `#fafafa` 的色带；Ant Design `Card` 的默认填充色已通过局部样式覆盖为 `var(--navbar-bg)`。

### 使用约定

- 新增样式时优先使用 `var(--theme-primary)`、`var(--text)`、`var(--bg-hover)` 等变量；**同环比涨跌**使用 `var(--trend-up)` / `var(--trend-down)` / `var(--trend-flat)`，勿在组件内写死红绿色值。
- 新建「卡片式」块时优先复用 `--radius-card`、`--shadow-card`、`--shadow-card-hover`，避免写死圆角与阴影。

## 术语约定

- 本项目前端显示的是「歌曲」，但歌曲本质都是带有 MV 的视频，所以变量命名和后端全部使用 `video`
- 前端显示的是「创作者」，**前端约定与领域命名使用 `producer`**（路由、UniSeek 类型、文案等）
- **后端与 HTTP 契约暂时不改**，接口字段与指标名仍可能使用 `user`（如 `userCount`、`activeUserCount`）；前端展示层映射为「创作者 / Producer」，待后端对齐后再统一改名

## 总览页：中术50

前端统一使用「中术50」名称：顶部为「中术50播放」「中术50收藏」，趋势图 Tab 为「中术50视频数据」。它借鉴上证指数等样本观察方式，以相对固定的 50 个作品观察播放、收藏等指标变化，不随日期筛选实时选取 Top 50。

总览页跟随导航栏的中英文切换，覆盖筛选、日期面板与快捷范围、时间窗说明、指标、趋势图例和坐标轴、直方图、过线表格及分页提示。英文模式将「中术50」展示为「Representative Videos」，创作者使用「Producer」；指标标题与趋势图 Tab 提供中英文悬停说明：综合参考播放量、收藏量并经人工筛选，选取 50 个代表性视频，名单相对固定、按需调整。内部代码和配置命名继续使用 `zhongshu`。直方图按分桶 code 映射为 K / M 单位；切换语言保留当前日期、图表选项和页码。

作品名单在后端 `src/main/resources/config/zhongshu-50.json` 的 `aids` 数组中维护。后端在启动时校验并加载 50 个不重复的正整数 aid 到内存，查询通过参数化的 `WHERE aid IN (...)` 限定样本；前端不自行维护或筛选名单。更新配置需重新打包并重启后端。

顶部播放、收藏为样本的结束日次日快照合计减去开始日快照合计，只展示当期值与环比。视频数据趋势为同一名单的逐日快照增量，覆盖播放、收藏、点赞、硬币、分享、评论、弹幕。顶部中术50指标的任一端点缺少完整样本或对应字段时，后端返回 `value=null`，前端显示「暂缺」；环比数据缺失或分母为 0 时，`dod=null`，同样显示「暂缺」。真实零增量显示 0。趋势图逐指标检查 D 与 D+1 快照完整性，任一端缺失则 D 日该指标返回 `null`；前端保留日期并在缺口断线，不补零。MOCK 仍为演示数据。基期、权重、指数点位和样本调整规则尚未定义。

## 路由与页面约定

导航进入「歌曲 / 虚拟歌手 / 创作者」均为**列表页**（复数路径）；从列表或 UniSeek 结果点击某一 Item，进入对应**详情页**（单数路径 + ID）。  
详情 ID 使用**路径参数**（如 `/video/123456`），**不使用**查询串（避免 `/video?id=123456`）。

### URL 一览

| 页面 | URL | 说明 |
|------|-----|------|
| 歌曲列表 | `/videos` | 导航「歌曲」入口 |
| 歌曲详情 | `/video/:id` | `:id` 为作品标识（如 aid；具体以详情契约为准） |
| 虚拟歌手列表 | `/vocals` | 导航「虚拟歌手」入口 |
| 虚拟歌手详情 | `/vocal/:id` | `:id` 为虚拟歌手标识 |
| 创作者列表 | `/producers` | 导航「创作者」入口 |
| 创作者详情 | `/producer/:id` | `:id` 为创作者标识（如 uid） |
| 统一搜索 | `/uniseek` | 首页搜索跳转；可带 `?keyword=` |
| 总览 | `/overview` | |
| 关于 | `/about` | |
| 收藏夹（隐藏） | `/stash` | 无导航入口 |

示例：

```text
/videos
/video/2129461
/vocals
/vocal/luotianyi
/producers
/producer/123456
/uniseek?keyword=普通DISCO
```

### 页面关系

```text
导航栏
  ├─ 歌曲      → /videos         （VideoList）
  ├─ 虚拟歌手  → /vocals         （VocalList）
  └─ 创作者    → /producers      （ProducerList）

列表页 Item 点击 → /video/:id · /vocal/:id · /producer/:id  （Detail）

首页搜索 → /uniseek?keyword=…   （UniSeek 结果页）
  └─ 结果 Item 点击 → 同上详情页 URL
```

### 组件约定

- 列表页 Item 与 UniSeek 结果 Item **不复用**：搜索结果有独立展示与排序语义，目录在 `src/pages/UniSeek/components/`；列表 Item 归属各自 `video` / `vocal` / `producer` 页面目录。
- 详情页为两边共用落点：列表与 UniSeek 均可 `Link` / `navigate` 到 `/video/:id` 等形式。
- 源码目录（占位已建，路由待挂载）：

```text
src/pages/video/VideoList | VideoDetail
src/pages/vocal/VocalList | VocalDetail
src/pages/producer/ProducerList | ProducerDetail
```

> 说明：导航列表路径与现有 `menuPaths.js`（`/videos`、`/vocals`、`/producers`）一致；实现时挂上详情路由 `/video/:id` 等即可。

## 使用的第三方组件/素材

- Ant Design 组件库
- VChart 图表
- unDraw 图片素材
