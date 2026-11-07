package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.VideoDao;
import com.hantang.web.service.VideoService;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class VideoControllerTest {
    private Javalin app;
    private final AtomicInteger queries = new AtomicInteger();
    private final HttpClient client = HttpClient.newHttpClient();
    private static final String RANGE = "?startDate=2026-10-20&endDate=2026-10-22";

    @BeforeEach
    void start() {
        var service = new VideoService(new VideoDao((sql, params) -> {
            queries.incrementAndGet();
            if (params.getFirst().equals(500L)) throw new IllegalStateException("internal database failure");
            if (sql.contains("video_collection_gate_crossings")) {
                if (params.getFirst().equals(600L)) {
                    var missing = new HashMap<String, Object>();
                    missing.put("gate_value", 2_000_000L);
                    missing.put("current_view", 2_000_000L);
                    missing.put("crossed_at", Timestamp.from(Instant.parse("2026-10-01T12:00:00Z")));
                    return List.of(missing, Map.of("gate_value", 1_930_000L, "previous_view", 0L,
                            "current_view", 1_930_000L, "crossed_at", Timestamp.from(Instant.parse("2026-09-01T12:00:00Z"))));
                }
                return List.of();
            }
            if (params.getFirst().equals(501L)) return List.of(Map.of("record_date", "2026-10-20"), Map.of("record_date", "2026-10-20"));
            return List.of();
        }));
        app = Javalin.create();
        new VideoController(service).registerRoutes(app);
        app.start("127.0.0.1", 0);
    }

    @AfterEach
    void stop() { if (app != null) app.stop(); }

    @Test
    void absentHistoryIsSuccessfulAndExplicitRatherThan404OrZero() throws Exception {
        var response = get("/videos/123/daily-metrics" + RANGE);
        assertEquals(200, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertEquals(200, json.get("code").asInt());
        var rows = json.get("result").get("rows");
        assertEquals(3, rows.size());
        assertTrue(rows.get(0).get("snapshotMissing").asBoolean());
        assertTrue(rows.get(0).get("indicators").get("view").isNull());
    }

    @Test
    void invalidAidOrRangeIs400WithoutQuerying() throws Exception {
        for (String id : List.of("0", "01", "abc", "9223372036854775808")) {
            assertEquals(400, get("/videos/" + id + "/daily-metrics" + RANGE).statusCode());
        }
        for (String query : List.of("", "?startDate=2026-10-20", "?startDate=2026-2-01&endDate=2026-10-22",
                "?startDate=2026-02-30&endDate=2026-10-22", "?startDate=2026-10-23&endDate=2026-10-22",
                "?startDate=2025-10-01&endDate=2026-10-22")) {
            assertEquals(400, get("/videos/1/daily-metrics" + query).statusCode(), query);
        }
        assertEquals(0, queries.get());
    }

    @Test
    void databaseErrorsAndDuplicateSnapshotsRemain500WithoutLeakingDetails() throws Exception {
        for (String aid : List.of("500", "501")) {
            var response = get("/videos/" + aid + "/daily-metrics" + RANGE);
            assertEquals(500, response.statusCode());
            assertFalse(response.body().contains("internal database failure"));
            assertFalse(response.body().contains("Duplicate daily"));
        }
    }

    @Test
    void gateCrossingsWithoutRecordsIs200WithEmptyRows() throws Exception {
        var response = get("/videos/123/gate-crossings");
        assertEquals(200, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertEquals(200, json.get("code").asInt());
        assertEquals(123L, json.get("result").get("aid").asLong());
        assertTrue(json.get("result").get("rows").isArray());
        assertEquals(0, json.get("result").get("rows").size());
    }

    @Test
    void gateCrossingsRendersNullableViewsAndIsoTimestamps() throws Exception {
        var response = get("/videos/600/gate-crossings");
        assertEquals(200, response.statusCode());
        var rows = new ObjectMapper().readTree(response.body()).get("result").get("rows");
        assertEquals(2, rows.size());
        assertEquals(2_000_000L, rows.get(0).get("gateValue").asLong());
        assertTrue(rows.get(0).get("previousView").isNull());
        assertEquals(2_000_000L, rows.get(0).get("currentView").asLong());
        assertEquals("2026-10-01T12:00:00Z", rows.get(0).get("crossedAt").asText());
        assertEquals(1_930_000L, rows.get(1).get("gateValue").asLong());
        assertEquals(0L, rows.get(1).get("previousView").asLong());
        assertEquals("2026-09-01T12:00:00Z", rows.get(1).get("crossedAt").asText());
    }

    @Test
    void gateCrossingsInvalidAidIs400WithoutQuerying() throws Exception {
        for (String id : List.of("0", "01", "abc", "-1", "9223372036854775808")) {
            assertEquals(400, get("/videos/" + id + "/gate-crossings").statusCode(), id);
        }
        assertEquals(0, queries.get());
    }

    @Test
    void gateCrossingsDatabaseErrorsAre500WithoutLeakingDetails() throws Exception {
        var response = get("/videos/500/gate-crossings");
        assertEquals(500, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertEquals(500, json.get("code").asInt());
        assertEquals("Unable to load video gate crossings", json.get("msg").asText());
        assertFalse(response.body().contains("internal database failure"));
        assertFalse(response.body().contains("video_collection_gate_crossings"));
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
}
