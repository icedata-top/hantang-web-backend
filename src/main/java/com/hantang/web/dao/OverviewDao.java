package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.dos.overview.OverviewRequest;
import com.hantang.web.utils.IsoTimeUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
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
     * 某一自然日 {@code video_daily} 全表播放、收藏合计（按 {@code record_date} 精确匹配一天）。
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
        String sql = "SELECT COALESCE(SUM(view), 0)::bigint AS view_count, "
                + "COALESCE(SUM(favorite), 0)::bigint AS favorite_count "
                + "FROM hantang_dynamic.video_daily "
                + "WHERE record_date = ?::date";
        List<Map<String, Object>> rows = postgreDao.queryList(sql, List.of(recordDateYyyyMmDd.trim()));
        if (rows.isEmpty()) {
            return new DailyViewFavoriteSums(0L, 0L);
        }
        Map<String, Object> row = rows.get(0);
        return new DailyViewFavoriteSums(toLong(row.get("view_count")), toLong(row.get("favorite_count")));
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
        if (end.isBefore(start)) {
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

    private static long toLong(Object o) {
        if (o == null) {
            return 0L;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(o.toString());
    }

    public record ProcessedVideoUserCounts(long videoCount, long userCount) {
    }

    /** 某日 {@code video_daily} 播放量、收藏量总和 */
    public record DailyViewFavoriteSums(long viewSum, long favoriteSum) {
    }
}
