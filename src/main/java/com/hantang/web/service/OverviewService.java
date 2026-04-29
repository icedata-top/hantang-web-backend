package com.hantang.web.service;

import com.hantang.web.dao.OverviewDao;
import com.hantang.web.dos.overview.OverviewIndicatorsResponse;
import com.hantang.web.dos.overview.OverviewRequest;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.hantang.web.dos.overview.OverviewTrendResponse;

public class OverviewService {
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

        OverviewIndicatorValues current = computeIndicatorValues(request);

        long spanDays = ChronoUnit.DAYS.between(start, end) + 1;
        LocalDate dodStart = start.minusDays(spanDays);
        LocalDate dodEnd = start.minusDays(1);
        OverviewIndicatorValues dodBase = computeIndicatorValues(
                new OverviewRequest(dodStart, dodEnd, request.getAddtionalParams())
        );

        LocalDate yoyStart = start.minusYears(1);
        LocalDate yoyEnd = end.minusYears(1);
        OverviewIndicatorValues yoyBase = computeIndicatorValues(
                new OverviewRequest(yoyStart, yoyEnd, request.getAddtionalParams())
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
     */
    private OverviewIndicatorValues computeIndicatorValues(OverviewRequest request) {
        OverviewDao.ProcessedVideoUserCounts range = overviewDao.countProcessedVideosAndUsers(request);

        LocalDate start = request.getStartDate();
        LocalDate end = request.getEndDate();
        LocalDate endPlusOne = end.plusDays(1);

        OverviewDao.DailyViewFavoriteSums atStart = overviewDao.sumViewAndFavoriteForRecordDate(start);
        OverviewDao.DailyViewFavoriteSums atEndPlusOne = overviewDao.sumViewAndFavoriteForRecordDate(endPlusOne);

        return new OverviewIndicatorValues(
                range.videoCount(),
                range.userCount(),
                atEndPlusOne.viewSum() - atStart.viewSum(),
                atEndPlusOne.favoriteSum() - atStart.favoriteSum()
        );
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
}
