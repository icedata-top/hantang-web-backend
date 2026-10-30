# 汉唐 Web

本仓库同时包含前端和后端。两边独立构建、独立启动，互不打包进对方的产物。

本项目负责数据查询接口、查询口径及前端展示。数据爬取、MySQL 到 PostgreSQL 的数据同步、上游数据预处理由其他仓库及其 owner 负责；本仓库记录相关外部依赖，并在查询与展示中正确处理数据缺失。已确认的同步缺失问题见[MySQL 到 PostgreSQL 同步数据缺失](doc/todo/mysql-postgresql-sync-data-loss.md)。

## 目录

| 路径 | 说明 |
|------|------|
| `frontend/` | 前端 |
| `src/` | 后端源码 |
| `sql/` | 数据库 DDL、表文档、查询示例与实例数据 |
| `doc/todo/`、`doc/design/`、`doc/rule/` | 待办、设计、约定 |

## 视频与创作者数据

视频静态信息（标题、投稿时间、简介、封面、上传者等）统一来自 PostgreSQL 的 `hantang_dynamic.processed_videos`；如无必要，不得使用 `hantang_dynamic.video_static`，也不得将其作为默认回退来源。创作者账号信息来自 `hantang_dynamic.discovered_users`，上传者关联为 `processed_videos.user_id = discovered_users.user_id`。

字段含义、时间及缺失值口径见[视频与创作者表文档](sql/video_creator_reference.md)，可执行的只读 SQL 见[查询示例](sql/video_creator_queries.sql)，世末歌者（`aid=6009789`）与 COPY（`user_id=396194`）的完整实例见[实例数据说明](sql/examples/video_creator_sample.md)。

创作者详情提供账号基本信息和分页投稿两个接口，支持以第一作者（`user_id`）或参与作者（`staff`）筛选，按播放量 / 投稿时间升降序排列；接口约定与验证方式见[创作者详情 API](frontend/src/services/Producer/producer.md)。

单视频每日明细通过 `GET /videos/{aid}/daily-metrics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` 查询七项累计指标。按请求日期补齐行，未收录快照显式标记 `snapshotMissing`，缺失指标保留 `null`，不在后端计算增量。视频详情简介下方提供累计 / 增量图表与区间播放增长摘要；前端只对相邻有效快照作差。日期边界、日均及缺失数据口径见[单视频历史数据与趋势](doc/design/video-metrics-history.md)和[视频详情 API](frontend/src/services/Video/video.md)。

## 技术栈

### 前端

目录：`frontend/`。细节见 `frontend/README.md`。

- React 18、Vite 5、Ant Design、React Router、i18next、VChart
- 包管理使用 npm，锁文件是 `frontend/package-lock.json`
- 开发服务器端口 `5173`

### 后端

目录：仓库根目录，源码在 `src/main/java`。

- Java 21、Maven、Javalin 6
- MySQL、PostgreSQL（HikariCP）
- 入口类 `com.hantang.web.App`，监听 `8080`
- 数据库连接读取仓库根目录的 `config.secret.properties`。该文件已在 `.gitignore` 中，不提交

## 总览页：中术50

「中术50」借鉴上证指数等以样本观察整体变化的思路，选取相对固定的 50 个作品作为观测对象，跟踪这些作品的播放、收藏等指标变化。它不是按所选日期实时排序得到的 Top 50。作品名单已配置；样本调整规则及是否采用指数化计算尚未确定，目前不定义基期、权重或指数点位。

- 顶部展示名称为「中术50播放」「中术50收藏」，趋势图对应「中术50视频数据」。
- 样本配置位于 `src/main/resources/config/zhongshu-50.json`，`aids` 数组维护 50 个作品的 aid，`name` 为名称。
- Java 后端在启动 HTTP 服务前读取配置，校验恰好 50 个不重复的正整数 aid，并缓存为不可变内存名单；配置缺失或不合法时启动失败。修改名单后需重新打包并重启（Docker 需重新构建镜像）。
- 顶部播放、收藏及视频数据趋势均使用参数化的 `WHERE aid IN (?, ...)` 限定这份样本；新投稿、活跃创作者及其他图表不受此名单影响。
- 顶部播放、收藏按 `hantang_dynamic.video_daily` 中样本的结束日次日快照合计减去开始日快照合计；视频数据趋势按相同样本计算每天的次日快照减去当日快照，返回播放、收藏、点赞、硬币、分享、评论、弹幕增量。顶部指标逐项校验两个端点均有完整的 50 个样本及对应字段，任一端缺失则该项 `value=null`，不作差；缺少当期或上期增量、或上期增量为 0 时，`dod=null`。前端以「暂缺」展示，真实零增量仍为 0。趋势图逐指标检查 D 与 D+1 快照完整性，任一端缺失则 D 日该指标返回 `null`；前端保留日期并在缺口断线，不补零。
- 顶部指标保留当期值与前一等长区间的环比，不计算同比。
- 顶部指标的中术50每日累计播放、累计收藏在 Service 与 DAO 之间按 `record_date` 缓存，复用 `CacheDao` 的线程安全内存 Map：成功加载后有效期 60 分钟，最多 64 个日期，容量满时按写入顺序淘汰。过期后由下一次读取重新查询；同一天并发未命中时合并查询，失败或样本不完整时不缓存，补数后下次请求重查。缓存随进程重启清空，不缓存整个日期区间，也不缓存新投稿、活跃创作者或趋势图。

## 启动

前后端各开一个终端。

### 前端

```sh
cd frontend
npm install
npm run dev
```

浏览器访问 `http://localhost:5173/`。`npm run dev` 默认直接请求本机后端 `http://localhost:8080/`，请先启动后端。只使用前端 MOCK 数据时：

```sh
VITE_APP_ENV=MOCK npm run dev
```

生产打包：

```sh
npm run build
```

产物在 `frontend/dist/`，该目录不提交。

### 后端

在仓库根目录准备好 `config.secret.properties`，然后运行主类 `com.hantang.web.App`。

用 Maven 打包后启动：

```sh
mvn package
java -jar target/hantang-web-backend-1.0-SNAPSHOT.jar
```

接口在 `http://localhost:8080/`。开发环境已允许跨域，前端可以从 `5173` 访问后端。

---

# 后端结构说明

后端基于 Javalin，采用分层结构。

## Docker 运行

镜像不会打包 `config.secret.properties`。运行容器时需要把运行环境的数据库配置文件挂载到 `/app/config.secret.properties`：

```bash
docker build -t hantang-web-backend:local .
docker run --rm -p 8080:8080 \
  -v /path/to/config.secret.properties:/app/config.secret.properties:ro \
  hantang-web-backend:local
```

## 📂 项目包结构

```text
src/main/java
├── api # 第三方API调用相关封装（如Bilibili接口、WBI签名等）
├── controller # 控制器层：接收请求，参数解析，响应封装
├── dao # 数据访问层：与数据库或外部存储交互
├── dos # 数据对象（DO），包括数据库实体和业务传输对象
│ ├── common # 通用数据结构，如统一响应体 ResponseDTO
│ └── data.reader # 与“数据读取”功能相关的请求/响应体
├── mapper # JSON序列化/反序列化等映射器封装
├── service # 服务层（可选）：编写核心业务逻辑，解耦控制器和DAO
└── App # 应用入口 com.hantang.web.App
```


---

## 📌 各包功能说明

| 包名            | 说明 |
|-----------------|------|
| `api`           | 封装对外部系统（如Bilibili）的 API 调用逻辑，便于统一管理签名、HTTP 请求等 |
| `controller`    | 路由注册与控制器：仅做参数校验、调用 Service、封装统一响应 |
| `dao`           | 数据访问层：封装 SQL、ORM 或其他数据源操作逻辑 |
| `dos`           | 数据对象：含数据库实体（DO）和前后端交互的请求体、响应体（Request/Response） |
| `mapper`        | JSON 序列化与反序列化配置（如自定义 Fastjson2 Mapper） |
| `service`       | 业务逻辑层（可选）：编写可单元测试的复杂业务逻辑，控制器只负责调用 |
| `resources`     | 配置文件，如日志、数据库、JSON Schema 等 |

---

## 🧩 分层设计规范

### ✅ Controller 层

- **职责单一**：仅负责解析请求、调用 Service、封装返回。
- **无复杂业务逻辑**：只做简单校验（如必填字段）。
- **统一返回结构**：使用 `ResponseDTO<T>` 封装结果，包含 `code`、`msg`、`timestamp`、`result`。
- **URL 命名规范**：推荐使用短横线（kebab-case）风格，示例：
```text
GET /hello-world
POST /hantang/metric-achieved-time
POST /hantang/video-metrics
```


---

### ✅ Service 层

- **可选**：对于复杂逻辑建议放到 Service 层，便于单元测试。
- **只做业务逻辑**：不处理路由、响应封装、不直接操作 HTTP 对象。
- **依赖注入**：可依赖 DAO 层获取数据，保证可替换性。

---

### ✅ DAO 层

- **与数据源交互**：仅负责 SQL、ORM 或第三方数据源调用。
- **命名建议**：以 `Dao` 结尾，如 `MysqlDao`。
- **接口隔离**：不同表/功能独立实现，方便后期更换数据源。

---

## 🗂️ 统一响应体示例

使用 `ResponseDTO<T>` 统一封装所有 API 响应。

```java
public record ResponseDTO<T>(
  int code,
  int timestamp,
  String msg,
  T result
) 
```

# 契约

## 说明

### 视频识别码 (videoIdentifier)
- **说明**：用于唯一标识一个视频。系统将按以下优先级尝试匹配：AV号 > BV号 > 视频名称。
- **格式**：字符串类型。

### 枚举定义

#### 时间粒度 (granularity)
指定数据聚合的时间维度。
```json
["MINUTE", "HOUR", "DAY", "WEEK", "MONTH"]
```

#### 指标类型 (metrics)
定义需要查询的数据指标。
```json
["view", "favorite", "like", "reply", "danmaku", "share", "coin"]
```

## 接口1：查询视频时间序列数据
### 描述
根据指定的时间范围、粒度和指标，查询视频的历史数据序列。

### 请求
POST `/hantang/video-time-series`

```json
{
    "videoIdentifier": "BV1Ab421k7EQ",
    "startTime": "2025-06-23",
    "endTime": "2025-06-28",
    "granularity": "DAY",
    "metrics": ["view", "like", "favorite"]
}
```

## 接口2：查询指标达成时间
### 描述
查询指定视频的某个数据指标达到目标数值的预估时间或历史达成时间点。

### 请求
POST `/hantang/metric-achieved-time`
```json
{
    "videoIdentifier": "霜雪千年",
    "metric": "view", 
    "target": 3000000
}
```
