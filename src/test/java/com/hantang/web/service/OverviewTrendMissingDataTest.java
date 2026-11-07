package com.hantang.web.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.OverviewDao;
import com.hantang.web.dos.overview.OverviewRequest;
import com.hantang.web.dos.overview.OverviewTrendResponse;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class OverviewTrendMissingDataTest {
    private static final LocalDate START = LocalDate.of(2026, 10, 19);

    @Test
    void missingMiddleSnapshotMakesBothAdjacentDeltasNull() {
        var response = trend(2, List.of(snapshot(0, 500L), snapshot(1, null), snapshot(2, 600L)));
        assertEquals(List.of("2026-10-19", "2026-10-20"),
                response.getRows().stream().map(OverviewTrendResponse.TrendRow::getDate).toList());
        for (var row : response.getRows()) {
            assertEquals(7, row.getIndicators().size());
            assertTrue(row.getIndicators().values().stream().allMatch(value -> value == null));
        }
    }

    @Test
    void absentRowsDoNotCauseDifferenceAcrossGapAndDataResumesAfterGap() {
        var response = trend(4, List.of(snapshot(4, 625L), snapshot(0, 500L), snapshot(3, 600L)));
        for (int day = 0; day < 3; day++) {
            assertNull(response.getRows().get(day).getIndicators().get("view"));
        }
        assertEquals(25L, response.getRows().get(3).getIndicators().get("view"));
    }

    @Test
    void missingFieldOnlyInvalidatesThatMetric() {
        var start = snapshot(0, 500L);
        var middle = snapshot(1, 550L);
        middle.put("favorite", null);
        middle.remove("coin");
        var end = snapshot(2, 600L);
        var response = trend(2, List.of(start, middle, end));
        for (var row : response.getRows()) {
            assertNull(row.getIndicators().get("favorite"));
            assertNull(row.getIndicators().get("coin"));
            assertEquals(50L, row.getIndicators().get("view"));
            assertEquals(50L, row.getIndicators().get("like"));
        }
    }

    @Test
    void keepsRealZeroAndNegativeCorrections() {
        var response = trend(3, List.of(snapshot(0, 0L), snapshot(1, 0L), snapshot(2, 100L), snapshot(3, 90L)));
        assertEquals(0L, response.getRows().get(0).getIndicators().get("view"));
        assertEquals(100L, response.getRows().get(1).getIndicators().get("view"));
        assertEquals(-10L, response.getRows().get(2).getIndicators().get("view"));
    }

    @Test
    void missingFirstOrEndPlusOneSnapshotRemainsNull() {
        var response = trend(3, List.of(snapshot(1, 500L), snapshot(2, 600L)));
        assertNull(response.getRows().get(0).getIndicators().get("view"));
        assertEquals(100L, response.getRows().get(1).getIndicators().get("view"));
        assertNull(response.getRows().get(2).getIndicators().get("view"));
    }

    @Test
    void allMissingStillReturnsEveryRequestedDateAndMetric() {
        var response = trend(3, List.of());
        assertEquals(3, response.getRows().size());
        for (int day = 0; day < 3; day++) {
            var row = response.getRows().get(day);
            assertEquals(START.plusDays(day).toString(), row.getDate());
            assertEquals(7, row.getIndicators().size());
            assertTrue(row.getIndicators().values().stream().allMatch(value -> value == null));
        }
    }

    @Test
    void readsEndPlusOneSnapshotWithoutExposingAnExtraBusinessDay() {
        var response = trend(1, List.of(snapshot(0, 500L), snapshot(1, 600L)));
        assertEquals(1, response.getRows().size());
        assertEquals(START.toString(), response.getRows().getFirst().getDate());
        assertEquals(100L, response.getRows().getFirst().getIndicators().get("view"));
    }

    @Test
    void jsonKeepsNullKeysDatesAndRealZero() throws Exception {
        var response = trend(3, List.of(snapshot(0, 500L), snapshot(2, 600L), snapshot(3, 600L)));
        var mapper = new ObjectMapper();
        var rows = mapper.readTree(mapper.writeValueAsString(response)).get("rows");
        assertEquals(3, rows.size());
        assertEquals("2026-10-20", rows.get(1).get("date").textValue());
        for (String metric : OverviewDao.ZHONGSHU50_METRICS) {
            assertTrue(rows.get(0).get("indicators").has(metric));
            assertTrue(rows.get(0).get("indicators").get(metric).isNull());
            assertEquals(0L, rows.get(2).get("indicators").get(metric).longValue());
        }
    }

    @Test
    void backfillRestoresPreviouslyMissingDeltas() {
        var snapshots = new ArrayList<>(List.of(snapshot(0, 500L), snapshot(2, 600L)));
        assertNull(trend(2, snapshots).getRows().getFirst().getIndicators().get("view"));
        snapshots.add(snapshot(1, 550L));
        for (var row : trend(2, snapshots).getRows()) {
            assertEquals(50L, row.getIndicators().get("view"));
        }
    }

    private static OverviewTrendResponse trend(int days, List<Map<String, Object>> snapshots) {
        return OverviewService.buildVideoStatsTrend(
                new OverviewRequest(START, START.plusDays(days - 1), Map.of("trendType", "videoStats")), snapshots);
    }

    private static Map<String, Object> snapshot(int day, Long total) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("date", START.plusDays(day).toString());
        for (String metric : OverviewDao.ZHONGSHU50_METRICS) {
            row.put(metric, total);
        }
        return row;
    }
}
