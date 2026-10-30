package com.hantang.web.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.VideoDao;
import com.hantang.web.dos.video.VideoDailyMetricsRequest;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class VideoDailyMetricsTest {
    private static final LocalDate START = LocalDate.of(2026, 10, 20);

    @Test
    void validatesStrictDatesAndInclusiveRangeBeforeQuerying() {
        assertEquals(366, new VideoDailyMetricsRequest(1, START, START.plusDays(365)).endDate().toEpochDay() - START.toEpochDay() + 1);
        for (String date : List.of("", "2026-1-01", "2026-02-30", "2025-02-29", "0000-01-01", "2026-10-20T00:00:00", "2026-10-20 OR 1=1")) {
            assertThrows(IllegalArgumentException.class, () -> VideoDailyMetricsRequest.from(1, date, "2026-10-21"), date);
        }
        assertThrows(IllegalArgumentException.class, () -> VideoDailyMetricsRequest.from(1, null, "2026-10-21"));
        assertThrows(IllegalArgumentException.class, () -> VideoDailyMetricsRequest.from(1, "2026-10-20", null));
        assertThrows(IllegalArgumentException.class, () -> new VideoDailyMetricsRequest(0, START, START));
        assertThrows(IllegalArgumentException.class, () -> new VideoDailyMetricsRequest(1, START, START.minusDays(1)));
        assertThrows(IllegalArgumentException.class, () -> new VideoDailyMetricsRequest(1, START, START.plusDays(366)));
        assertEquals(LocalDate.of(2024, 2, 29), VideoDailyMetricsRequest.from(1, "2024-02-29", "2024-02-29").startDate());
    }

    @Test
    void queriesOnlyBoundVideoAndInclusiveSnapshotDatesWithoutComputingDeltas() {
        var dao = new VideoDao((sql, params) -> {
            assertEquals(List.of(Long.MAX_VALUE, "2026-10-20", "2026-10-22"), params);
            assertTrue(sql.contains("aid = ? AND record_date BETWEEN ?::date AND ?::date"));
            assertTrue(sql.contains("ORDER BY record_date ASC"));
            assertFalse(sql.contains("LAG("));
            return List.of(snapshot(0, 100L), snapshot(2, 150L));
        });
        var response = new VideoService(dao).getDailyMetrics(new VideoDailyMetricsRequest(Long.MAX_VALUE, START, START.plusDays(2)));
        assertEquals(3, response.rows().size());
        assertEquals(100L, response.rows().getFirst().indicators().get("view"));
        assertEquals(150L, response.rows().getLast().indicators().get("view"));
        assertTrue(response.rows().get(1).snapshotMissing());
        assertFalse(response.rows().getFirst().snapshotMissing());
    }

    @Test
    void missingDatesPartialMetricsAndRealZeroRemainDistinctInJson() throws Exception {
        var partial = snapshot(1, 0L);
        partial.put("like", null);
        var response = new VideoService(new VideoDao((sql, params) -> List.of(partial)))
                .getDailyMetrics(new VideoDailyMetricsRequest(1, START, START.plusDays(2)));
        var json = new ObjectMapper().valueToTree(response);
        assertEquals("2026-10-20", json.get("startDate").asText());
        assertEquals("2026-10-22", json.get("endDate").asText());
        var rows = json.get("rows");
        for (int index : List.of(0, 2)) {
            assertEquals(START.plusDays(index).toString(), rows.get(index).get("date").asText());
            assertTrue(rows.get(index).get("snapshotMissing").asBoolean());
            assertEquals(7, rows.get(index).get("indicators").size());
            for (String metric : VideoService.DAILY_METRICS) assertTrue(rows.get(index).get("indicators").get(metric).isNull());
        }
        assertFalse(rows.get(1).get("snapshotMissing").asBoolean());
        assertEquals(0L, rows.get(1).get("indicators").get("view").asLong());
        assertTrue(rows.get(1).get("indicators").get("like").isNull());
    }

    @Test
    void whollyMissingRangeStillReturnsAllSevenMetricsOnEveryDate() {
        var response = new VideoService(new VideoDao((sql, params) -> List.of()))
                .getDailyMetrics(new VideoDailyMetricsRequest(1, START, START.plusDays(30)));
        assertEquals(31, response.rows().size());
        for (var row : response.rows()) {
            assertTrue(row.snapshotMissing());
            assertEquals(7, row.indicators().size());
            assertTrue(row.indicators().values().stream().allMatch(value -> value == null));
        }
    }

    @Test
    void duplicateDailySnapshotsFailRatherThanPickingAnArbitraryValue() {
        var service = new VideoService(new VideoDao((sql, params) -> List.of(snapshot(0, 100L), snapshot(0, 110L))));
        assertThrows(IllegalStateException.class, () -> service.getDailyMetrics(new VideoDailyMetricsRequest(1, START, START)));
    }

    private static Map<String, Object> snapshot(int day, Long total) {
        var row = new HashMap<String, Object>();
        row.put("record_date", START.plusDays(day).toString());
        VideoService.DAILY_METRICS.forEach(metric -> row.put(metric, total));
        return row;
    }
}
