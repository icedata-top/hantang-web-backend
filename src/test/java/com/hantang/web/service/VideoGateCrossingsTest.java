package com.hantang.web.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.VideoDao;
import com.hantang.web.utils.IsoTimeUtils;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class VideoGateCrossingsTest {
    private static final String TABLE = "hantang_dynamic.video_collection_gate_crossings";
    private static final Instant CROSSED_AT = Instant.parse("2026-10-01T12:00:00Z");

    @Test
    void queriesOnlyThatVideoFromTheGateCrossingsTableWithDatabaseOrdering() {
        var sqlHolder = new String[1];
        var dao = new VideoDao((sql, params) -> {
            sqlHolder[0] = sql;
            assertEquals(List.of(Long.MAX_VALUE), params);
            return List.of(gateRow(2_000_000L, 1_900_000L, 2_000_000L), gateRow(1_930_000L, null, 1_930_000L));
        });

        var response = new VideoService(dao).getGateCrossings(Long.MAX_VALUE);

        assertEquals(Long.MAX_VALUE, response.aid());
        var sql = sqlHolder[0];
        assertTrue(sql.contains("FROM " + TABLE), sql);
        assertTrue(sql.contains("WHERE aid = ?"), sql);
        assertTrue(sql.contains("ORDER BY gate_value DESC, id DESC"), sql);
        assertFalse(sql.contains("video_daily"), sql);
        assertFalse(sql.contains("hantang_dynamic.processed_videos"), sql);
        assertEquals(List.of(2_000_000L, 1_930_000L), response.rows().stream().map(row -> row.gateValue()).toList());
    }

    @Test
    void emptyResultIsAnEmptyArrayRatherThanNull() {
        var response = new VideoService(new VideoDao((sql, params) -> List.of())).getGateCrossings(42L);

        assertEquals(42L, response.aid());
        assertNotNull(response.rows());
        assertTrue(response.rows().isEmpty());
    }

    @Test
    void nullableViewsStayNullAndRealZeroIsPreserved() throws Exception {
        var missing = new HashMap<String, Object>();
        missing.put("gate_value", 1_930_000L);
        missing.put("current_view", 0L);
        missing.put("crossed_at", Timestamp.from(CROSSED_AT));
        var zero = gateRow(1_000L, 0L, 0L);

        var response = new VideoService(new VideoDao((sql, params) -> List.of(missing, zero))).getGateCrossings(1L);
        assertEquals(2, response.rows().size());
        assertNull(response.rows().get(0).previousView());
        assertEquals(0L, response.rows().get(0).currentView());
        assertEquals(0L, response.rows().get(1).previousView());

        var json = new ObjectMapper().valueToTree(response);
        var rows = json.get("rows");
        assertEquals(1_930_000L, rows.get(0).get("gateValue").asLong());
        assertTrue(rows.get(0).get("previousView").isNull());
        assertEquals(0L, rows.get(0).get("currentView").asLong());
        assertFalse(rows.get(0).get("previousView").isMissingNode());
        assertEquals(0L, rows.get(1).get("previousView").asLong());
        assertEquals("2026-10-01T12:00:00Z", rows.get(0).get("crossedAt").asText());
    }

    @Test
    void crossedAtIsRenderedAsIso8601ForEveryJdbcShape() {
        assertEquals("2026-10-01T12:00:00Z", IsoTimeUtils.toIsoString(Timestamp.from(CROSSED_AT)));
        assertEquals("2026-10-01T12:00:00Z", IsoTimeUtils.toIsoString(CROSSED_AT));
        assertEquals("2026-10-01T12:00:30+08:00",
                IsoTimeUtils.toIsoString(OffsetDateTime.of(2026, 10, 1, 12, 0, 30, 0, ZoneOffset.ofHours(8))));
        assertEquals("2026-10-01T12:00:30", IsoTimeUtils.toIsoString(LocalDateTime.of(2026, 10, 1, 12, 0, 30)));
        assertNull(IsoTimeUtils.toIsoString(null));
    }

    private static Map<String, Object> gateRow(long gateValue, Long previousView, long currentView) {
        var row = new HashMap<String, Object>();
        row.put("gate_value", gateValue);
        row.put("previous_view", previousView);
        row.put("current_view", currentView);
        row.put("crossed_at", Timestamp.from(CROSSED_AT));
        return row;
    }
}
