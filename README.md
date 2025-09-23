# hantang-web-backend

计划在本仓库开发若干 Restful HTTP API，以便于 [Dify](https://cloud.dify.ai/app/60ca1d94-fb58-45ef-b142-03b07914ee49/workflow) 架构的大模型 AI 机器人调用。

本项目所使用的技术栈：

- JDK 21
- MySQL / PostgreSQL
- Javalin 服务端框架

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
POST `/api/data/time-series`

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
POST `/api/data/target-achievement`
```json
{
    "videoIdentifier": "霜雪千年",
    "metric": "view", 
    "target": 3000000
}
```

