# 汉唐 Web

本仓库同时包含前端和后端。两边独立构建、独立启动，互不打包进对方的产物。

## 目录

| 路径 | 说明 |
|------|------|
| `frontend/` | 前端 |
| `src/` | 后端源码 |
| `sql/` | 数据库 DDL |
| `doc/todo/`、`doc/design/`、`doc/rule/` | 待办、设计、约定 |

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
- 顶部播放、收藏按 `hantang_dynamic.video_daily` 中样本的结束日次日快照合计减去开始日快照合计；视频数据趋势按相同样本计算每天的次日快照减去当日快照，返回播放、收藏、点赞、硬币、分享、评论、弹幕增量。缺失快照合计按 0 处理，数据不完整时可能产生失真或负值。
- 顶部指标保留当期值与前一等长区间的环比，不计算同比。

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
