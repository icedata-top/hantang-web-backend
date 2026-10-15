# Overview API 契约（草案）

总览页共 4 个 API，对应 4 张卡片。  
统一约定如下：

- 统一请求体：`OverviewRequest`
- 本文响应示例仅展示 `data` 对象（省略 `code` / `message` 外层）

## 通用请求体（全 API 复用）

```java
public class OverviewRequest {
    String startDate;
    String endDate;
    Map<String, String> addtionalParams;
}
```

`addtionalParams` 用于未来扩展：
- 左侧 `OverviewFilter` 新字段
- 右侧局部切换（如某图表 tab/scope）

---

## 1) 指标卡片 API

- **用途**：返回顶部指标卡片数据
- **路径**：`POST /overview/get-indicators`

**响应体**

```json
{
  "indicators": [
    { "name": "newVideoCount", "value": 1435, "yoy": 0.15, "dod": 0.11 },
    { "name": "activeUserCount", "value": 107, "yoy": -0.05, "dod": -0.03 },
    { "name": "view", "value": 1274561, "yoy": 0.012, "dod": 0.008 },
    { "name": "favorite", "value": 109143, "yoy": -0.011, "dod": 0.015 }
  ]
}
```

---

## 2) 趋势折线图 API

- **用途**：返回按天趋势数据
- **路径**：`POST /overview/get-trend`

**响应体**

```json
{
  "rows": [
    {
      "date": "2026-04-01",
      "indicators": {
        "newVideoCount": 118,
        "activeUserCount": 92,
        "view": 920000,
        "favorite": 88500,
        "like": 12100,
        "coin": 8200,
        "share": 2100,
        "reply": 5100,
        "danmaku": 1580
      }
    }
  ]
}
```

---

## 3) 分区投稿饼图 API

- **用途**：返回分区投稿量（全部投稿 / 新投稿）
- **路径**：`POST /overview/get-partition-submissions`
- **范围参数**：通过 `OverviewRequest.addtionalParams.scope` 区分 `all` / `new`

**响应体**

```json
{
  "rows": [
    { "typeId": 30, "count": 469 },
    { "typeId": 21, "count": 418 }
  ]
}
```

---

## 4) 播放量直方图 API

- **用途**：返回播放量分桶（全部投稿 / 新投稿）
- **路径**：`POST /overview/get-view-histogram`
- **范围参数**：通过 `OverviewRequest.addtionalParams.scope` 区分 `all` / `new`

**响应体**

```json
{
  "rows": [
    { "code": "E02", "label": "0-10", "count": 60683 },
    { "code": "E03", "label": "10-100", "count": 19334 }
  ]
}
```
