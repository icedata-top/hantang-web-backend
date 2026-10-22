package com.hantang.web.dao;

import com.hantang.web.config.Zhongshu50Config;
import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.dos.overview.OverviewRequest;
import com.hantang.web.utils.IsoTimeUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class OverviewDao {

    private final PostgreDao postgreDao;

    public OverviewDao() {
        this.postgreDao = PostgreDao.getInstance();
    }

    /**
     * 按时间范围统计 processed_videos：视频条数、去重用户数（pubdate 为 Unix 秒，与 BETWEEN 边界对齐）。
     */
    public ProcessedVideoUserCounts countProcessedVideosAndUsers(OverviewRequest request) {
        List<Object> params = new ArrayList<>();
        String filter = buildFilterSql(request, params);
        String sql = "SELECT COUNT(*)::bigint AS video_count, "
                + "COUNT(DISTINCT user_id)::bigint AS user_count "
                + "FROM hantang_dynamic.processed_videos WHERE 1=1 "
                + filter;
        List<Map<String, Object>> rows = postgreDao.queryList(sql, params);
        if (rows.isEmpty()) {
            return new ProcessedVideoUserCounts(0L, 0L);
        }
        Map<String, Object> row = rows.get(0);
        return new ProcessedVideoUserCounts(toLong(row.get("video_count")), toLong(row.get("user_count")));
    }

    /**
     * 某一自然日 {@code video_daily} 中术50样本的播放、收藏合计。
     * 每个指标分别检查 50 个样本及字段是否完整，不完整的指标返回 null。
     *
     * @param recordDateYyyyMmDd {@code yyyy-MM-dd}
     */
    public DailyViewFavoriteSums sumViewAndFavoriteForRecordDate(String recordDateYyyyMmDd) {
        if (recordDateYyyyMmDd == null || recordDateYyyyMmDd.isBlank()) {
            throw new IllegalArgumentException("recordDate 不能为空");
        }
        try {
            LocalDate.parse(recordDateYyyyMmDd.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("recordDate 须为 yyyy-MM-dd: " + recordDateYyyyMmDd, e);
        }
        List<Object> params = new ArrayList<>();
        params.add(recordDateYyyyMmDd.trim());
        String sampleFilter = buildZhongshu50Filter(params);
        int sampleCount = Zhongshu50Config.getAids().size();
        String sql = "SELECT CASE WHEN COUNT(DISTINCT aid) = " + sampleCount
                + " AND COUNT(view) = " + sampleCount + " THEN SUM(view)::bigint END AS view_count, "
                + "CASE WHEN COUNT(DISTINCT aid) = " + sampleCount
                + " AND COUNT(favorite) = " + sampleCount + " THEN SUM(favorite)::bigint END AS favorite_count "
                + "FROM hantang_dynamic.video_daily "
                + "WHERE record_date = ?::date" + sampleFilter;
        List<Map<String, Object>> rows = postgreDao.queryList(sql, params);
        if (rows.isEmpty()) {
            return new DailyViewFavoriteSums(null, null);
        }
        Map<String, Object> row = rows.get(0);
        return new DailyViewFavoriteSums(toNullableLong(row.get("view_count")), toNullableLong(row.get("favorite_count")));
    }

    public List<Map<String, Object>> getTrend(OverviewRequest request, String trendType) {
        if (request == null || request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 startDate、endDate 不能为空");
        }

        String type = trendType == null ? "" : trendType.trim();
        if (type.isEmpty() || "newVideo".equals(type)) {
            return queryDailyCountTrend(request, "COUNT(*)::bigint", "newVideoCount");
        }
        if ("activeUser".equals(type)) {
            return queryDailyCountTrend(request, "COUNT(DISTINCT user_id)::bigint", "activeUserCount");
        }
        if ("videoStats".equals(type)) {
            return queryZhongshu50DailyTrend(request);
        }
        throw new IllegalArgumentException("未知 trendType: " + trendType);
    }

    public List<Map<String, Object>> getPartitionSubmissions(OverviewRequest request, String scope) {
        if (request == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 endDate 不能为空");
        }
        String normalizedScope = scope == null ? "all" : scope.trim();
        List<Object> params = new ArrayList<>();
        String filter;
        if ("new".equals(normalizedScope)) {
            if (request.getStartDate() == null) {
                throw new IllegalArgumentException("scope=new 时 startDate 不能为空");
            }
            filter = buildFilterSql(request, params);
        } else {
            String endYmd = request.getEndDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
            long endSec = IsoTimeUtils.dateOnlyToEndOfDayEpochSecondsInclusive(endYmd);
            params.add(endSec);
            filter = " AND pubdate <= ? ";
        }
        String sql = "SELECT type_id::int AS type_id, COUNT(*)::bigint AS cnt "
                + "FROM hantang_dynamic.processed_videos "
                + "WHERE type_id IS NOT NULL "
                + filter
                + "GROUP BY type_id "
                + "ORDER BY cnt DESC";
        return postgreDao.queryList(sql, params);
    }

    public List<Map<String, Object>> getViewHistogram(OverviewRequest request) {
        if (request == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 endDate 不能为空");
        }
        String endDate = request.getEndDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
        String sql = "SELECT "
                + "CASE "
                + "WHEN \"view\" < 0 THEN 'E01' "
                + "WHEN \"view\" < 10 THEN 'E02' "
                + "WHEN \"view\" < 100 THEN 'E03' "
                + "WHEN \"view\" < 1000 THEN 'E04' "
                + "WHEN \"view\" < 10000 THEN 'E05' "
                + "WHEN \"view\" < 100000 THEN 'E06' "
                + "WHEN \"view\" < 1000000 THEN 'E07' "
                + "WHEN \"view\" < 10000000 THEN 'E08' "
                + "ELSE 'E09' "
                + "END AS code, "
                + "COUNT(*)::bigint AS cnt "
                + "FROM hantang_dynamic.video_daily "
                + "WHERE record_date = ?::date "
                + "GROUP BY 1 "
                + "ORDER BY 1";
        return postgreDao.queryList(sql, List.of(endDate));
    }

    public GateCrossingQueryResult getGateCrossings(OverviewRequest request, Long aid, int page, int pageSize) {
        if (request == null || request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 startDate、endDate 不能为空");
        }
        if (endBeforeStart(request)) {
            throw new IllegalArgumentException("endDate 不能早于 startDate");
        }

        List<Object> filterParams = new ArrayList<>();
        String filter = buildGateCrossingFilterSql(request, aid, filterParams);

        String countSql = "SELECT COUNT(*)::bigint AS total "
                + "FROM hantang_dynamic.video_collection_gate_crossings "
                + "WHERE 1=1 "
                + filter;
        List<Map<String, Object>> countRows = postgreDao.queryList(countSql, filterParams);
        long total = countRows.isEmpty() ? 0L : toLong(countRows.get(0).get("total"));

        List<Object> rowParams = new ArrayList<>(filterParams);
        rowParams.add(pageSize);
        rowParams.add((long) (page - 1) * pageSize);
        String rowsSql = "SELECT id, aid, gate_value, previous_view, current_view, crossed_at, created_at "
                + "FROM hantang_dynamic.video_collection_gate_crossings "
                + "WHERE 1=1 "
                + filter
                + "ORDER BY crossed_at DESC, id DESC "
                + "LIMIT ? OFFSET ?";
        List<Map<String, Object>> rows = postgreDao.queryList(rowsSql, rowParams);
        return new GateCrossingQueryResult(rows, total);
    }

    private List<Map<String, Object>> queryDailyCountTrend(
            OverviewRequest request,
            String metricSql,
            String metricKey
    ) {
        List<Object> params = new ArrayList<>();
        String filter = buildFilterSql(request, params);
        String sql = "SELECT to_timestamp(pubdate)::date AS d, " + metricSql + " AS c "
                + "FROM hantang_dynamic.processed_videos "
                + "WHERE 1=1 " + filter
                + "GROUP BY d ORDER BY d";

        List<Map<String, Object>> rows = postgreDao.queryList(sql, params);
        Map<LocalDate, Long> byDate = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object dateObj = row.get("d");
            if (dateObj == null) {
                continue;
            }
            LocalDate date = LocalDate.parse(dateObj.toString());
            byDate.put(date, toLong(row.get("c")));
        }

        List<Map<String, Object>> result = new ArrayList<>();
        LocalDate cursor = request.getStartDate();
        LocalDate end = request.getEndDate();
        while (!cursor.isAfter(end)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("date", cursor.format(DateTimeFormatter.ISO_LOCAL_DATE));
            item.put(metricKey, byDate.getOrDefault(cursor, 0L));
            result.add(item);
            cursor = cursor.plusDays(1);
        }
        return result;
    }

    /** 与顶部指标一致：次日快照合计减去当日快照合计。 */
    private List<Map<String, Object>> queryZhongshu50DailyTrend(OverviewRequest request) {
        if (endBeforeStart(request)) {
            throw new IllegalArgumentException("endDate 不能早于 startDate");
        }
        List<Object> params = new ArrayList<>();
        params.add(request.getStartDate().toString());
        params.add(request.getEndDate().plusDays(1).toString());
        String sampleFilter = buildZhongshu50Filter(params);
        List<String> metrics = List.of("view", "favorite", "like", "coin", "share", "reply", "danmaku");
        List<String> sums = new ArrayList<>();
        List<String> deltas = new ArrayList<>();
        for (String metric : metrics) {
            // 指标列来自固定名单，不接受请求参数作为 SQL 标识符。
            String column = "\"" + metric + "\"";
            sums.add("COALESCE(SUM(" + column + "), 0)::bigint AS " + column);
            deltas.add("(COALESCE(end_snapshot." + column + ", 0) - COALESCE(start_snapshot."
                    + column + ", 0))::bigint AS " + column);
        }
        String sql = "WITH daily AS (SELECT record_date, " + String.join(", ", sums)
                + " FROM hantang_dynamic.video_daily WHERE record_date BETWEEN ?::date AND ?::date"
                + sampleFilter + " GROUP BY record_date) "
                + "SELECT day.d::date::text AS date, " + String.join(", ", deltas)
                + " FROM generate_series(?::date, ?::date, interval '1 day') AS day(d)"
                + " LEFT JOIN daily start_snapshot ON start_snapshot.record_date = day.d::date"
                + " LEFT JOIN daily end_snapshot ON end_snapshot.record_date = day.d::date + 1"
                + " ORDER BY day.d";
        params.add(request.getStartDate().toString());
        params.add(request.getEndDate().toString());
        return postgreDao.queryList(sql, params);
    }

    private static String buildZhongshu50Filter(List<Object> params) {
        List<Long> aids = Zhongshu50Config.getAids();
        params.addAll(aids);
        return " AND aid IN (" + String.join(", ", Collections.nCopies(aids.size(), "?")) + ") ";
    }

    /** 同 {@link #sumViewAndFavoriteForRecordDate(String)}，入参为日历日。 */
    public DailyViewFavoriteSums sumViewAndFavoriteForRecordDate(LocalDate recordDate) {
        if (recordDate == null) {
            throw new IllegalArgumentException("recordDate 不能为空");
        }
        return sumViewAndFavoriteForRecordDate(recordDate.format(DateTimeFormatter.ISO_LOCAL_DATE));
    }

    /**
     * 生成 {@code AND pubdate BETWEEN ? AND ?}，并在 {@code params} 中放入起止 Unix 秒。
     * 起止为 {@link LocalDate}，按「开始日 00:00:00、结束日含当日最后一秒」换算为时间戳。
     */
    private static String buildFilterSql(OverviewRequest request, List<Object> params) {
        if (request == null || request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 startDate、endDate 不能为空");
        }
        LocalDate start = request.getStartDate();
        LocalDate end = request.getEndDate();
        if (endBeforeStart(request)) {
            throw new IllegalArgumentException("endDate 不能早于 startDate");
        }
        String startYmd = start.format(DateTimeFormatter.ISO_LOCAL_DATE);
        String endYmd = end.format(DateTimeFormatter.ISO_LOCAL_DATE);
        long startSec = IsoTimeUtils.dateOnlyToStartOfDayEpochSeconds(startYmd);
        long endSec = IsoTimeUtils.dateOnlyToEndOfDayEpochSecondsInclusive(endYmd);
        params.add(startSec);
        params.add(endSec);
        return " AND pubdate BETWEEN ? AND ? ";
    }

    private static String buildGateCrossingFilterSql(OverviewRequest request, Long aid, List<Object> params) {
        LocalDate start = request.getStartDate();
        LocalDate endExclusive = request.getEndDate().plusDays(1);
        params.add(start.format(DateTimeFormatter.ISO_LOCAL_DATE));
        params.add(endExclusive.format(DateTimeFormatter.ISO_LOCAL_DATE));

        StringBuilder filter = new StringBuilder(" AND crossed_at >= ?::date AND crossed_at < ?::date ");
        if (aid != null) {
            filter.append("AND aid = ? ");
            params.add(aid);
        }
        return filter.toString();
    }

    private static boolean endBeforeStart(OverviewRequest request) {
        return request.getEndDate().isBefore(request.getStartDate());
    }

    private static long toLong(Object o) {
        if (o == null) {
            return 0L;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(o.toString());
    }

    private static Long toNullableLong(Object o) {
        return o == null ? null : toLong(o);
    }

    public record ProcessedVideoUserCounts(long videoCount, long userCount) {
    }

    /** 某日中术50样本的累计值；某项样本不完整时，该项为 null，真实 0 保留。 */
    public record DailyViewFavoriteSums(Long viewSum, Long favoriteSum) {
    }

    public record GateCrossingQueryResult(List<Map<String, Object>> rows, long total) {
    }
}
