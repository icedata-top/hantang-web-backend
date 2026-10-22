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

- **用途**：返回顶部指标卡片的当期值和环比（`dod`），不再计算或返回同比
- **环比口径**：与紧邻当前区间之前的等长区间比较
- **样本口径**：`view`、`favorite` 仅统计后端 `config/zhongshu-50.json` 中的 50 个作品，取结束日次日快照合计减去开始日快照合计；新投稿和活跃创作者不受该名单限制。
- **缺失口径**：对 `view`、`favorite` 分别检查开始日与结束日次日是否有完整的 50 个样本及非空字段；任一端不完整时返回 `value: null`，不作差。缺少当期或上期增量、或上期增量为 0 时返回 `dod: null`。前端对缺失项显示「暂缺」，真实零值仍显示 `0`。不完整快照不写入每日缓存。
- **路径**：`POST /overview/get-indicators`

**响应体**

```json
{
  "indicators": [
    { "name": "newVideoCount", "value": 1435, "dod": 0.11 },
    { "name": "activeUserCount", "value": 107, "dod": -0.03 },
    { "name": "view", "value": 1274561, "dod": 0.008 },
    { "name": "favorite", "value": 109143, "dod": 0.015 }
  ]
}
```

---

## 2) 趋势折线图 API

- **用途**：返回按天趋势数据
- **路径**：`POST /overview/get-trend`
- **视频数据趋势**：`addtionalParams.trendType=videoStats` 时，按中术50名单返回每天的播放、收藏、点赞、硬币、分享、评论、弹幕增量（次日快照合计减去当日快照合计）。

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
- **页面状态**：分区饼图暂时隐藏，总览页不发起此请求；API 与图表组件保留
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
