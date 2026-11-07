# Overview API 契约（草案）

总览页先查询 Daily 最新记录日，再按日期范围加载指标、趋势等数据。统计查询统一约定如下：

- 统一请求体：`OverviewRequest`
- 本文响应示例仅展示 `data` 对象（省略 `code` / `message` 外层）

## Daily 最新日期与页面默认范围

`GET /daily/latest-date`，无需参数，查询：

```sql
SELECT MAX(record_date)::text AS latest_record_date
FROM hantang_dynamic.video_daily;
```

响应沿用后端 `ResponseDTO`：`{ "code": 200, "timestamp": 1793836800, "msg": "Success", "result": { "latestRecordDate": "2026-11-02" } }`（日期及时间戳仅为示例）。空表或日期全为 NULL 时，HTTP 200 且 `latestRecordDate: null`；数据库失败返回 HTTP 500。

总览页等待最新快照日期 D 后再初始化并发起统计请求。快照是凌晨累计值，业务日 E 的增量需要 E+1 快照，因此最新可计算的业务日为 D-1，不能直接用 D 作为范围结束日。默认最近 7 个自然日为 `[D-7, D-1]`，快捷项最近 7 / 14 / 30 天分别为 `[D-7, D-1]`、`[D-14, D-1]`、`[D-30, D-1]`。例如最新快照为 2026-11-02，则默认选 2026-10-26 至 2026-11-01，播放、收藏使用 11-02 凌晨快照减去 10-26 凌晨快照，不再请求不存在的 11-03 快照。

开始日期不早于 2025-10-01。如果 D-1 为今天或以后，页面结束日夹取至昨天；接口本身仍如实返回 MAX 日期，不将快照日期减一天后冒充原始日期。

手动选择上限独立于 D，仍允许选到昨天，今天及未来禁用，区间最多 30 个自然日。最新日期为空或 D-1 早于最早可选日时不自动选择或生成快捷范围，允许手动选择；接口失败提供重试，不用昨天冒充最新数据日。重试成功不覆盖用户已经确认或清空的范围。视频详情趋势共用 D-1 基准，但默认最近 14 天、下限为各自投稿日，见[详情趋势口径](../../../../doc/design/video-metrics-history.md)。MOCK 环境以昨天作为模拟快照日期，同样先换算为业务日。

这里的 MAX 日期只表示最新有记录的数据日，不表示整批数据已完整入库。播放、收藏及视频趋势依旧沿用下述次日快照差分和缺失值口径。

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
- **投稿与作者 Tab**：前端并发请求 `trendType=newVideo` 和 `trendType=activeUser`，按日期合并后，以蓝色「新投稿视频数」和橙色「活跃作者数」展示两条系列；与中术50 Tab 一样提供可切换的图例。两个 Tab 的图例、数据点及提示标记均使用圆形。
- **视频数据趋势**：`addtionalParams.trendType=videoStats` 时，按中术50名单返回每天的播放、收藏、点赞、硬币、分享、评论、弹幕增量（次日快照合计减去当日快照合计）。
- **视频趋势缺失口径**：仍从 `hantang_dynamic.video_daily` 查询累计快照，DAO 按指标检查 50 个样本及字段完整性，Service 逐日作差。D 或 D+1 任一快照缺失或该指标不完整，则 D 日该指标明确返回 `null`；其他完整指标独立计算，真实零值和负增量保留。响应包含请求区间的每个日期；前端保留全部日期与 `null`，缺口断线，不补零或跨日连线。

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
- **统计口径**：两种范围均使用所选结束日的 `video_daily` 累计播放量分桶。`all` 不限制投稿日期；`new` 通过 `aid` 匹配 `processed_videos`，仅统计 `pubdate` 落在用户所选开始日 00:00:00 至结束日 23:59:59 的作品，不对播放量作区间差分。

**响应体**

```json
{
  "rows": [
    { "code": "E02", "label": "0-10", "count": 60683 },
    { "code": "E03", "label": "10-100", "count": 19334 }
  ]
}
```
