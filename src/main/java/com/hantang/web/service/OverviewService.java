package com.hantang.web.service;

import com.hantang.web.dao.OverviewDao;
import com.hantang.web.dos.overview.OverviewGateCrossingsResponse;
import com.hantang.web.dos.overview.OverviewIndicatorsResponse;
import com.hantang.web.dos.overview.OverviewPartitionSubmissionsResponse;
import com.hantang.web.dos.overview.OverviewRequest;
import com.hantang.web.dos.overview.OverviewViewHistogramResponse;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.hantang.web.dos.overview.OverviewTrendResponse;

public class OverviewService {
    private static final int DEFAULT_GATE_CROSSING_PAGE = 1;
    private static final int DEFAULT_GATE_CROSSING_PAGE_SIZE = 20;
    private static final int MAX_GATE_CROSSING_PAGE_SIZE = 100;

    private final OverviewDao overviewDao;

    public OverviewService() {
        this.overviewDao = new OverviewDao();
    }

    public OverviewIndicatorsResponse getIndicators(OverviewRequest request) {
        if (request == null || request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 startDate、endDate 不能为空");
        }
        LocalDate start = request.getStartDate();
        LocalDate end = request.getEndDate();
        long started = System.nanoTime();
        try {
            return buildIndicators(request, start, end, started);
        } catch (RuntimeException e) {
            System.out.println(
                    "overview get-indicators 失败 range=" + start + ".." + end
                            + " elapsedMs=" + elapsedMs(started)
                            + " error=" + e.getMessage()
            );
            throw e;
        }
    }

    private OverviewIndicatorsResponse buildIndicators(
            OverviewRequest request,
            LocalDate start,
            LocalDate end,
            long started
    ) {
        OverviewIndicatorValues current = computeIndicatorValues("current", request);

        long spanDays = ChronoUnit.DAYS.between(start, end) + 1;
        LocalDate dodStart = start.minusDays(spanDays);
        LocalDate dodEnd = start.minusDays(1);
        OverviewIndicatorValues dodBase = computeIndicatorValues(
                "dod",
                new OverviewRequest(dodStart, dodEnd, request.getAddtionalParams())
        );

        LocalDate yoyStart = start.minusYears(1);
        LocalDate yoyEnd = end.minusYears(1);
        OverviewIndicatorValues yoyBase = computeIndicatorValues(
                "yoy",
                new OverviewRequest(yoyStart, yoyEnd, request.getAddtionalParams())
        );

        System.out.println(
                "overview get-indicators 完成 range=" + start + ".." + end
                        + " totalMs=" + elapsedMs(started)
        );

        return new OverviewIndicatorsResponse(
                List.of(
                        new OverviewIndicatorsResponse.Indicator(
                                "newVideoCount",
                                current.submissionCountInRange(),
                                ratio(current.submissionCountInRange(), yoyBase.submissionCountInRange()),
                                ratio(current.submissionCountInRange(), dodBase.submissionCountInRange())
                        ),
                        new OverviewIndicatorsResponse.Indicator(
                                "activeUserCount",
                                current.distinctUpCountInRange(),
                                ratio(current.distinctUpCountInRange(), yoyBase.distinctUpCountInRange()),
                                ratio(current.distinctUpCountInRange(), dodBase.distinctUpCountInRange())
                        ),
                        new OverviewIndicatorsResponse.Indicator(
                                "view",
                                current.viewDelta(),
                                ratio(current.viewDelta(), yoyBase.viewDelta()),
                                ratio(current.viewDelta(), dodBase.viewDelta())
                        ),
                        new OverviewIndicatorsResponse.Indicator(
                                "favorite",
                                current.favoriteDelta(),
                                ratio(current.favoriteDelta(), yoyBase.favoriteDelta()),
                                ratio(current.favoriteDelta(), dodBase.favoriteDelta())
                        )
                )
        );
    }

    /**
     * 单个区间只取 4 个值：投稿数、UP 数、播放增量、收藏增量。
     * 投稿数和活跃创作者在同一次 processed_videos 扫描里算出，日志里的 processedVideosMs 覆盖这两项。
     */
    private OverviewIndicatorValues computeIndicatorValues(String window, OverviewRequest request) {
        LocalDate start = request.getStartDate();
        LocalDate end = request.getEndDate();
        LocalDate endPlusOne = end.plusDays(1);

        long processedStarted = System.nanoTime();
        OverviewDao.ProcessedVideoUserCounts range = overviewDao.countProcessedVideosAndUsers(request);
        long processedVideosMs = elapsedMs(processedStarted);

        long dailyStartStarted = System.nanoTime();
        OverviewDao.DailyViewFavoriteSums atStart = overviewDao.sumViewAndFavoriteForRecordDate(start);
        long dailyStartMs = elapsedMs(dailyStartStarted);

        long dailyEndStarted = System.nanoTime();
        OverviewDao.DailyViewFavoriteSums atEndPlusOne = overviewDao.sumViewAndFavoriteForRecordDate(endPlusOne);
        long dailyEndMs = elapsedMs(dailyEndStarted);

        System.out.println(
                "overview get-indicators 分段 window=" + window
                        + " range=" + start + ".." + end
                        + " processedVideosMs=" + processedVideosMs
                        + " videoCount=" + range.videoCount()
                        + " activeUserCount=" + range.userCount()
                        + " dailyStart=" + start
                        + " dailyStartMs=" + dailyStartMs
                        + " dailyEnd=" + endPlusOne
                        + " dailyEndMs=" + dailyEndMs
        );

        return new OverviewIndicatorValues(
                range.videoCount(),
                range.userCount(),
                atEndPlusOne.viewSum() - atStart.viewSum(),
                atEndPlusOne.favoriteSum() - atStart.favoriteSum()
        );
    }

    private static long elapsedMs(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000L;
    }

    /** 相对增幅：(current - base) / base；base 为 0 时返回 0。 */
    private static double ratio(long current, long base) {
        if (base == 0L) {
            return 0.0;
        }
        return (double) (current - base) / (double) base;
    }

    private record OverviewIndicatorValues(
            long submissionCountInRange,
            long distinctUpCountInRange,
            long viewDelta,
            long favoriteDelta
    ) {
    }

    public OverviewTrendResponse getTrend(OverviewRequest request) {
        if (request == null || request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 startDate、endDate 不能为空");
        }
        String trendType = "newVideo";
        if (request.getAddtionalParams() != null) {
            String raw = request.getAddtionalParams().get("trendType");
            if (raw != null && !raw.isBlank()) {
                trendType = raw.trim();
            }
        }

        List<Map<String, Object>> trendRows = overviewDao.getTrend(request, trendType);
        List<OverviewTrendResponse.TrendRow> rows = new ArrayList<>();
        for (Map<String, Object> row : trendRows) {
            Object dateObj = row.get("date");
            if (dateObj == null) {
                continue;
            }
            Map<String, Long> indicators = new LinkedHashMap<>();
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                if ("date".equals(entry.getKey())) {
                    continue;
                }
                Object value = entry.getValue();
                if (value instanceof Number n) {
                    indicators.put(entry.getKey(), n.longValue());
                } else if (value instanceof String s) {
                    indicators.put(entry.getKey(), Long.parseLong(s));
                }
            }
            rows.add(new OverviewTrendResponse.TrendRow(dateObj.toString(), indicators));
        }
        return new OverviewTrendResponse(rows);
    }

    public OverviewPartitionSubmissionsResponse getPartitionSubmissions(OverviewRequest request) {
        if (request == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 endDate 不能为空");
        }
        String scope = "all";
        if (request.getAddtionalParams() != null) {
            String raw = request.getAddtionalParams().get("scope");
            if (raw != null && !raw.isBlank()) {
                scope = raw.trim();
            }
        }
        List<Map<String, Object>> rows = overviewDao.getPartitionSubmissions(request, scope);
        List<OverviewPartitionSubmissionsResponse.PartitionSubmissionRow> resultRows = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object typeIdObj = row.get("type_id");
            if (!(typeIdObj instanceof Number typeIdNum)) {
                continue;
            }
            long count = 0L;
            Object countObj = row.get("cnt");
            if (countObj instanceof Number countNum) {
                count = countNum.longValue();
            } else if (countObj instanceof String countStr) {
                count = Long.parseLong(countStr);
            }
            resultRows.add(new OverviewPartitionSubmissionsResponse.PartitionSubmissionRow(typeIdNum.intValue(), count));
        }
        return new OverviewPartitionSubmissionsResponse(resultRows);
    }

    public OverviewViewHistogramResponse getViewHistogram(OverviewRequest request) {
        List<Map<String, Object>> rows = overviewDao.getViewHistogram(request);
        List<OverviewViewHistogramResponse.ViewHistogramRow> resultRows = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Object codeObj = row.get("code");
            if (!(codeObj instanceof String code)) {
                continue;
            }
            long count = 0L;
            Object countObj = row.get("cnt");
            if (countObj instanceof Number countNum) {
                count = countNum.longValue();
            } else if (countObj instanceof String countStr) {
                count = Long.parseLong(countStr);
            }
            resultRows.add(new OverviewViewHistogramResponse.ViewHistogramRow(code, histogramLabel(code), count));
        }
        return new OverviewViewHistogramResponse(resultRows);
    }

    private static String histogramLabel(String code) {
        return switch (code) {
            case "E01" -> "<0";
            case "E02" -> "0-10";
            case "E03" -> "10-100";
            case "E04" -> "100-1k";
            case "E05" -> "1k-1w";
            case "E06" -> "1w-10w";
            case "E07" -> "10w-100w";
            case "E08" -> "100w-1000w";
            default -> "1000w+";
        };
    }

    public OverviewGateCrossingsResponse getGateCrossings(OverviewRequest request) {
        if (request == null || request.getStartDate() == null || request.getEndDate() == null) {
            throw new IllegalArgumentException("OverviewRequest 及 startDate、endDate 不能为空");
        }
        if (request.getEndDate().isBefore(request.getStartDate())) {
            throw new IllegalArgumentException("endDate 不能早于 startDate");
        }

        Map<String, String> params = request.getAddtionalParams();
        Long aid = parseOptionalPositiveLong(params == null ? null : params.get("aid"), "aid");
        int page = parsePositiveInt(params == null ? null : params.get("page"), DEFAULT_GATE_CROSSING_PAGE, "page");
        int pageSize = parsePositiveInt(
                params == null ? null : params.get("pageSize"),
                DEFAULT_GATE_CROSSING_PAGE_SIZE,
                "pageSize"
        );
        if (pageSize > MAX_GATE_CROSSING_PAGE_SIZE) {
            pageSize = MAX_GATE_CROSSING_PAGE_SIZE;
        }

        OverviewDao.GateCrossingQueryResult result = overviewDao.getGateCrossings(request, aid, page, pageSize);
        List<OverviewGateCrossingsResponse.GateCrossingRow> rows = new ArrayList<>();
        for (Map<String, Object> row : result.rows()) {
            rows.add(new OverviewGateCrossingsResponse.GateCrossingRow(
                    toNullableLong(row.get("id")),
                    toNullableLong(row.get("aid")),
                    toNullableLong(row.get("gate_value")),
                    toNullableLong(row.get("previous_view")),
                    toNullableLong(row.get("current_view")),
                    toIsoString(row.get("crossed_at")),
                    toIsoString(row.get("created_at"))
            ));
        }
        return new OverviewGateCrossingsResponse(rows, result.total(), page, pageSize);
    }

    private static int parsePositiveInt(String raw, int defaultValue, String fieldName) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            int value = Integer.parseInt(raw.trim());
            if (value <= 0) {
                throw new IllegalArgumentException(fieldName + " 必须大于 0");
            }
            return value;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(fieldName + " 必须为整数: " + raw, e);
        }
    }

    private static Long parseOptionalPositiveLong(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            long value = Long.parseLong(raw.trim());
            if (value <= 0L) {
                throw new IllegalArgumentException(fieldName + " 必须大于 0");
            }
            return value;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(fieldName + " 必须为整数: " + raw, e);
        }
    }

    private static Long toNullableLong(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(o.toString());
    }

    private static String toIsoString(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof OffsetDateTime odt) {
            return odt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        }
        if (o instanceof Timestamp timestamp) {
            return timestamp.toInstant().toString();
        }
        if (o instanceof Instant instant) {
            return instant.toString();
        }
        if (o instanceof LocalDateTime ldt) {
            return ldt.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        }
        return o.toString();
    }
}
