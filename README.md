# 冰数据 icedata 前后端一体化

冰数据（icedata）是一支面向虚拟歌手社群的非官方数据中台协作体，围绕公开投稿数据进行整理、分析与呈现。本仓库承载冰数据 Web 应用的前端和查询服务，提供歌曲、创作者与虚拟歌手浏览、视频指标查询、数据总览和 UniSeek 统一搜索。

前后端在同一仓库协作，分别构建、启动和发布。仓库名 `hantang-web-backend`，以及代码包名、数据库对象和镜像中的 `hantang` 均沿用历史工程命名；项目名称统一使用 **冰数据 icedata**。

本仓库负责查询接口、统计口径、前端展示，以及应用层预计算 SQL。数据采集、MySQL 到 PostgreSQL 的同步、上游内容预处理由其他仓库及其维护者负责。

[官方站点](https://www.icedata.top/) · [GitHub 组织](https://github.com/icedata-top) · [前端说明](frontend/README.md)

## 阅读导航

- [概念说明](#概念说明)
- [目录结构](#目录结构)
- [技术栈](#技术栈)
- [表结构设计](#表结构设计)
- [UniSeek 统一搜索](#uniseek-统一搜索)
- [本地开发](#本地开发)
- [开发规范](#开发规范)
- [CI/CD 与部署](#cicd-与部署)

## 概念说明

以下口径与网页 `/about` 及其术语说明页保持一致，用于理解站内内容、实体和数据关系。

### 歌曲与投稿

“歌曲”指以歌曲本身及其演唱为主体的投稿，包括原创、翻唱和翻调。歌词、静态画面或完整 MV 都可以是呈现形式。舞蹈、相声、剪辑、排行榜、教程、专辑试听等，即使包含歌曲，也不属于这一口径。

当前数据以哔哩哔哩视频投稿为记录单位，使用 `aid` 标识，BV 号是同一投稿的另一种编号。同一首歌曲可以有多个版本或多次投稿，因此视频记录数不能直接当作去重后的歌曲作品数。前端向用户称“歌曲”，代码与数据接口主要使用 `video`。

站内说明入口：`/about/songs`。

### 创作者

“创作者”指参与虚拟歌手歌曲创作、在哔哩哔哩投稿这类歌曲，且整体投稿以这类歌曲为主的 UP 主。创作包括词、曲、编曲、调教、混音、绘画、视频制作等环节；主体可以是个人，也可以是社团、企业或机构。单纯搬运、整理他人作品，不等于参与创作。

前端领域命名使用 `producer`。当前页面以投稿账号 `user_id` 展示“第一作者”，以 `staff` 成员展示“参与作者”；这是账号与投稿的关联方式，不代表已经核实全部创作分工。部分后端字段仍沿用 `user`，以现有接口约定为准。

站内说明入口：`/about/creators`。

### 虚拟歌手

冰数据不另立通用的虚拟歌手定义。网页引用 VCPedia、Vocawiki 和周刊虚拟歌手中文曲排行榜的解释，并单独说明本站的数据收录范围：不收录自然人直接演唱、真人扮演并直接演唱的 VTuber / VUP，以及 SVC 声音转换演唱内容。声库由真人录制不等于真人直接演唱，使用 AI 的歌声合成也不因“AI”字样被排除。

当前虚拟歌手的名称、别名、角色资料和立绘由前端本地配置维护，详情使用 `/vocals/:vocalId`。视频与歌手的可靠关联、完整实体归并及歌手聚合仍待完善，不能把标题提及或空的歌手标签当作已确认的演唱关系。

站内说明入口：`/about/virtual-singers`。三类内容的已收录资料均可能仍需补全与核验；业务定义不等于存量数据已全部完成分类。更细的歌曲、演唱来源与语言口径见[投稿内容识别说明](doc/design/uniseek/content-classification.md)。

## 目录结构

```text
.
├── frontend/                         # 前端应用
│   ├── src/pages/                    # 页面与路由对应实现
│   ├── src/components/               # 公共组件与业务组件
│   ├── src/services/                 # API 调用、MOCK 与接口说明
│   ├── src/constants/vocal/          # 虚拟歌手资料与搜索配置
│   ├── src/locales/                  # 中、英、日文案
│   ├── src/styles/                   # 主题变量与公共样式
│   ├── public/                       # 静态素材
│   ├── tests/                        # 前端测试
│   ├── Dockerfile                    # 前端镜像构建
│   ├── Caddyfile                     # 静态资源与 API 反向代理
│   └── docker-compose.yml            # 前后端容器部署模板
├── src/main/java/com/hantang/web/     # Java 后端
│   ├── controller/                   # 路由、参数校验与响应
│   ├── service/                      # 业务规则、查询编排与缓存
│   ├── dao/                          # 数据访问与 SQL
│   ├── dos/                          # 请求、响应及数据对象
│   └── App.java                      # 服务入口
├── src/main/resources/               # 配置资源，含中术50样本名单
├── src/test/                         # 后端测试
├── sql/                              # 字段快照、DDL、聚合与刷新脚本、SQL 测试
├── doc/design/                       # 业务口径与技术设计
├── doc/todo/                         # 实施进度与待办
├── doc/rule/                         # 开发约定
├── .github/workflows/                # GitHub Actions 工作流
├── config.secret.properties.example  # 后端数据库配置示例
├── Dockerfile                        # 后端镜像构建
└── pom.xml                           # Maven 配置
```

## 技术栈

- **前端**：React、Vite、Ant Design、React Router；i18next 负责中、英、日界面，dayjs 处理日期，VChart 绘制图表。依赖版本见 [package.json](frontend/package.json)。
- **后端**：Java 21、Javalin 6、Maven，通过 PostgreSQL JDBC 和 HikariCP 访问数据库。入口为 `com.hantang.web.App`，默认监听 `8080`。依赖版本见 [pom.xml](pom.xml)。
- **数据**：当前 Web 后端读取 PostgreSQL，主要业务对象位于 `hantang_dynamic` schema。MySQL 属于上游数据链路，后端本地启动只需 PostgreSQL 配置。
- **构建与运行**：Docker 分别打包前后端；前端容器使用 Caddy 提供静态资源，并将同源 `/api` 请求转发给后端。GitHub Actions 构建镜像并推送 GHCR，通过 Portainer 部署。

本地前端开发使用 npm 与 `package-lock.json`；当前前端 Dockerfile 使用 pnpm 与 `pnpm-lock.yaml` 做冻结安装。修改依赖时需核对两条构建路径，具体以各自配置为准。

## 表结构设计

数据库按用途分为**明细层**与**应用层（ADM）**：明细层保留基础资料和观测记录，应用层面向页面查询预先整理搜索集或统计结果。当前两层对象都位于 `hantang_dynamic` schema，并非两个独立数据库。

```text
上游采集、同步与预处理
          ↓
明细层：processed_videos / discovered_users / video_daily / 过线记录
          ├──→ 详情、历史指标与当前总览查询
          ├──→ 搜索集发布 → adm_uniseek_videos → UniSeek 与歌曲列表
          └──→ 按日预聚合 → adm_entity_metrics_daily → 总览接入待完成
```

### 明细层：资料与观测记录

- **`processed_videos`**：以 `aid` 为业务对象键，保存标题、投稿时间、简介、封面、分区、上传者、参与账号及预处理标签等当前资料。视频基本信息统一以此表为源，不默认回退到历史 `video_static` 表。
- **`discovered_users`**：以 `user_id` 为业务对象键，保存账号名称、头像、粉丝数、签名及上游收录计数等当前资料。上传者通过 `processed_videos.user_id = discovered_users.user_id` 关联；当前账号资料不代表投稿当时的历史状态。
- **`video_daily`**：以视频和观测日期（`aid`、`record_date`）描述逐日快照，保存播放、收藏、点赞、硬币、分享、评论、弹幕七项累计指标。日增量需要按相邻日期的快照计算。
- **`video_collection_gate_crossings`**：保存采集侧记录的播放过线事件，包括过线值、前后播放量和过线时间，供详情与总览展示。

完整字段见[明细层字段快照](sql/hantang_dynamic_schema.sql)和[视频与创作者表说明](sql/video_creator_reference.md)，查询例子见[只读 SQL](sql/video_creator_queries.sql)。字段快照用于说明现有结构，不作为整库初始化或自动迁移脚本。

### 应用层：搜索宽表与日聚合

**`adm_uniseek_videos`：当前已发布的歌曲搜索集。** 每个 `aid` 一行，将视频资料与同一确认日期的 Daily 快照组合，保存搜索字段、展示资料、七项累计指标，以及 `record_date`、`batch_id` 和刷新时间。仅保留当前成功批次，刷新在一个事务中完成，失败保留原批次。UniSeek 歌曲检索与歌曲列表已读取此表。

当前搜索集的收录条件为 `processed_videos.is_deleted = false`，且来源日累计收藏数严格 **大于 100**；点赞不参与这一门槛。这是当前查询集的筛选条件，不代表每条投稿已完成歌曲内容核验。表结构与维护流程见[搜索宽表说明](sql/adm_uniseek_videos.md)。

**`adm_entity_metrics_daily`：按业务日保存的统计结果。** 行粒度为“数据范围 × 维度类型 × 维度对象 × 日期”，对应 `scope_key`、`dimension_type`、`dimension_key`、`stat_date`。七项指标分别保存期末累计值和日增量，并记录快照覆盖数、完整性、规则版本和发布批次。

第一期聚合范围包括全量总计、中术50固定样本总计、旧版分区（`type_id`）和新版分区（`tid_v2`）。两套分区独立统计，不混加，也不生成中术50与分区的交叉组合。虚拟歌手和创作者维度留待实体关系完善后推进。

中术50以[配置中的固定 50 个投稿](src/main/resources/config/zhongshu-50.json)观察指标变化，不是实时排序的 Top 50；目前不定义基期、权重或指数点位。更新名单需重新构建后端，并同步核对数据库聚合使用的样本版本。

日聚合按天执行并原子替换，任务状态与有限重试由 `adm_aggregation_task` 管理；搜索集的确认日期与发布状态由 `adm_uniseek_refresh_state` 管理。两者是维护辅助表，不是新增的观测明细。

日聚合的结构、执行与调度见[表结构说明](sql/adm_entity_metrics_daily_draft.sql)和[安装与调用](sql/adm_aggregation_usage.md)。**当前总览接口仍直接查询明细，尚未切换为读取这张日聚合表。** 自动调度、历史回刷与接入进度见[日聚合待办](doc/todo/adm-daily-aggregation.md)。

### 时间与缺失值口径

- `record_date` 是北京时间凌晨采集的观测日期，不是精确零点快照。统计 D 日增长时，使用 D+1 快照减 D 快照；日聚合的期末累计值取 D+1 快照。
- 累计值不跨日相加；增量保留真实负值，不因源端修正而截成零。
- 缺失记录、缺失指标、真实零值和空数组分别处理，不把缺失统一补为零，也不跨日期缺口计算单日增量。单视频趋势的投稿日基线等特殊口径见[历史指标与趋势](doc/design/video-metrics-history.md)。

已确认的上游同步缺失由对应维护者修复与补数，见[MySQL 到 PostgreSQL 同步缺失](doc/todo/mysql-postgresql-sync-data-loss.md)；页面展示与聚合需要保留这些缺失信息。

## UniSeek 统一搜索

UniSeek 是站内统一搜索入口，路径为 `/uniseek`，例如 `/uniseek?keyword=天依`。一次输入可以查找虚拟歌手、歌曲和创作者，也支持 AV、BV、UID 精确查询。

### 查询与展示

- **虚拟歌手**：前端用本地名称和别名即时匹配，不等待后端，不分页。
- **歌曲**：后端查询 `adm_uniseek_videos`，支持标题子串及标签、分词等数组元素匹配。AV/BV 查询使用同一已发布搜索集，未进入该集合的投稿不会通过编号绕过收录条件。
- **创作者**：后端查询 `discovered_users`，支持名称和 UID；当前查询要求有上游过滤投稿数及有效头像，这不替代完整的创作者内容核验。

各来源独立请求，结果按实际到达顺序追加，不进行跨实体类型的评分比较。重复实体合并展示，某一路失败可以单独重试；后续滚动仅加载歌曲。歌曲默认每页 30 条，每个关键词最多返回 1,000 条，同类排序结合标题相关性与有上限的播放量加分。

### 数据更新与后续工作

歌曲搜索请求只读取已发布宽表，不在线关联原始视频和 Daily。维护者或上游任务先明确确认已完整入库的来源日期，再离线刷新；不能把最大日期或定时任务触发时间当作数据已完整的证明。缓存随发布批次变化失效，同一天补数后也可以重新发布。

当前仍是 beta：跨批次分页可能发生顺序变化，前端会去重；内容分类、视频与虚拟歌手关系、正式排序及 Elasticsearch 等工作分别记录在待办中。

- [UniSeek 查询与前后端约定](frontend/src/services/UniSeek/uniseek.md)
- [搜索宽表安装、确认日期与刷新](sql/adm_uniseek_videos.md)
- [旧点赞门槛迁移到收藏门槛](sql/adm_uniseek_videos_favorite_migration.md)
- [宽表化技改复盘](doc/design/uniseek/adm-search-retrospective.md)
- [每日同步与运行验收](doc/todo/uniseek-adm-search-snapshot.md)、[内容分类](doc/todo/uniseek-song-classification.md)、[搜索与排序后续计划](doc/todo/uniseek-elasticsearch-ranking.md)

## 本地开发

准备 Java 21、Maven、Node.js（当前前端镜像使用 24）与 npm。连接真实数据时，还需准备可访问的 PostgreSQL 和已获授权的应用账号；只开发前端时可使用 MOCK。

### 启动后端

在仓库根目录复制配置示例，填写真实的 PostgreSQL 连接信息：

```sh
cp config.secret.properties.example config.secret.properties
```

`config.secret.properties` 已被 Git 忽略，不提交密码或本地配置。后端从进程工作目录读取此文件，请在仓库根目录启动：

```sh
mvn package
java -jar target/hantang-web-backend-1.0-SNAPSHOT.jar
```

也可以在 IDE 中以仓库根目录为工作目录运行 `com.hantang.web.App`。服务地址为 `http://localhost:8080`。

### 启动前端

另开终端：

```sh
cd frontend
npm ci
npm run dev
```

浏览器访问 `http://localhost:5173/`。开发模式默认直接请求本机 `8080` 后端；不连接后端时可运行：

```sh
VITE_APP_ENV=MOCK npm run dev
```

生产构建在 `frontend/` 执行 `npm run build`，产物为 `frontend/dist/`。默认生产 API 前缀为同源 `/api`，环境与运行时配置见[前端说明](frontend/README.md#环境与后端配置)。

### 常用页面

- `/overview`：数据总览与中术50。
- `/videos`、`/videos/:aid`：歌曲列表、投稿详情与历史指标；详情也接受 BV 号入口。
- `/producers`、`/producers/:userId`：创作者列表与详情。
- `/vocals`、`/vocals/:vocalId`：虚拟歌手列表与本地角色资料。
- `/uniseek`：统一搜索。
- `/about`：项目介绍与术语说明。

开发规范页 `/admin/design/spec` 和组件预览 `/admin/design/components` 需要显式开启管理入口。本地在 `frontend/.env.local` 设置 `VITE_ADMIN_ENABLED=true` 后重启；容器设置 `ICEDATA_ADMIN_ENABLED=true` 后重新创建。开关只控制页面入口，不提供权限认证。

## 开发规范

- **提交与改动范围**：遵循 [Git commit 规范](doc/rule/commit-conventions.md)，标题使用 `type(scope): 中文摘要`，文档类型为 `doc`。同一功能的前后端、测试和文档可以一起提交，无关改动分开。
- **后端分层**：Controller 负责路由、参数校验与统一响应；Service 负责业务规则、查询编排与缓存；DAO 负责参数化 SQL 和数据访问。请求与响应遵循现有 `ResponseDTO` 及各功能文档。
- **前端与视觉**：遵循[冰数据视觉规范](doc/design/visual-spec.md)，优先复用 Ant Design 和项目公共组件。主题参数集中在 `frontend/src/styles/theme.css`，业务样式引用语义变量，不另写硬编码配色。
- **语言与领域命名**：界面文案同步维护中、英、日三套资源；业务数据保留原文。歌曲、创作者、虚拟歌手的代码命名分别沿用 `video`、`producer`、`vocal`，不自行改写现有 HTTP 字段。
- **数据口径与 SQL**：表结构、字段含义和执行说明放在 `sql/`；设计与进度分别放在 `doc/design/`、`doc/todo/`。修改指标、收录或时间口径时同步维护对应文档，区分已实现、已部署与待办。
- **验证**：遵循[验收方式](.cursor/rules/verification.mdc)，按改动运行必要检查、测试或构建。前端在 `frontend/` 执行 `npm test`、`npm run build`；后端在根目录执行 `mvn test`、`mvn package`。SQL 回归的环境要求与命令见对应专题文档。常规界面由开发者手动验收；仅文档改动检查内容、链接和差异即可。

## CI/CD 与部署

### GitHub Actions：构建与镜像发布

GitHub 已集成前后端流水线，配置见 [CI 工作流](.github/workflows/ci.yml)。推送任意分支、提交或更新 PR，以及手动触发时，分别构建后端和前端 Docker 镜像：

- 后端：`ghcr.io/icedata-top/hantang-web-backend`。
- 前端：`ghcr.io/icedata-top/hantang-web-frontend`。

仓库内事件会推送镜像到 GHCR；来自 fork 的 PR 仅构建，不推送。标签按分支、PR 和提交短 SHA 生成，具体以该次工作流输出为准。两个镜像独立发布，部署时应确认它们对应的提交和标签。

[Build & Release 工作流](.github/workflows/build.yml) 另行提供后端 JAR 构建与 GitHub Release：支持手动构建，在 PR 合入 `main` 或推送 `v*` 标签时创建 Release。当前流水线的 Maven 打包使用 `-DskipTests`，测试需按开发规范单独完成。

### Tailscale：连接发布网络

1. 打开本机 **Tailscale 客户端**，使用已获授权的 **GitHub 账号**登录。
2. 选择 **`icedata-top.org.github`** 网络并连接，确认客户端显示已连接。网页管理后台的登录状态不等于本机已接通网络。
3. 首次加入或权限不足时，由网络管理员处理邀请、设备批准及访问权限。

### Portainer：部署服务

连接 Tailscale 后，访问 **[Portainer](http://portainer.icedata.top/)**，使用具备发布权限的账号登录。镜像构建成功后，由维护者在 Portainer 完成部署：

1. 在 GitHub Actions 确认本次前后端镜像构建和推送成功，记录要发布的标签。
2. 在对应 Stack 或容器配置中更新镜像。前后端组合部署模板见 [docker-compose.yml](frontend/docker-compose.yml)，可通过 `ICEDATA_WEB_IMAGE`、`ICEDATA_BACKEND_IMAGE` 指定镜像及标签，默认使用 `main`。
3. 配置后端 PostgreSQL 连接，并确保运行时存在 `/app/config.secret.properties`。镜像不包含此文件；Compose 模板会通过配置项生成，单独运行后端容器时需挂载。
4. 拉取镜像并重新部署，检查容器状态、日志、页面和 API 是否正常。

前端容器由 Caddy 将 `/api/*` 转发到 `http://icedata-backend:8080`。运行时 API 地址、管理入口等配置见[前端部署说明](frontend/README.md#环境与后端配置)。现有 Compose 模板还要求填写历史变量 `ICEDATA_DB_URL_LOCAL`、`ICEDATA_DB_USER_LOCAL`、`ICEDATA_DB_PASSWORD_LOCAL`，以通过模板校验；当前后端只读取 PostgreSQL 配置。

数据库建表、只读授权、聚合和搜索宽表的调度由维护者按 `sql/` 中的专题说明单独部署。应用启动不会自动建表、安装扩展或注册 CRON；发布镜像后，还需确认目标环境的数据表、权限和已发布数据集可用。
