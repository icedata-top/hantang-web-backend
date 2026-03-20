# 项目结构说明

本项目基于 Javalin 构建，采用简洁的分层结构，方便后期维护和扩展。

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
└── Main # 应用入口
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