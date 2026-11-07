package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.DailyDao;
import com.hantang.web.service.DailyService;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.*;

class DailyControllerTest {
    private Javalin app;

    @AfterEach
    void stop() {
        if (app != null) app.stop();
    }

    @Test
    void latestDateIsReturnedAsAnIsoCalendarDateWithoutAnAid() throws Exception {
        var response = get((sql, params) -> {
            assertTrue(params.isEmpty());
            return List.of(Map.of("latest_record_date", "2026-11-02"));
        });
        assertEquals(200, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertEquals(200, json.get("code").asInt());
        assertEquals("2026-11-02", json.get("result").get("latestRecordDate").asText());
    }

    @Test
    void emptyDailyTableReturnsExplicitNullRatherThanAnInventedDate() throws Exception {
        var row = new HashMap<String, Object>();
        row.put("latest_record_date", null);
        var response = get((sql, params) -> List.of(row));
        assertEquals(200, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertTrue(json.get("result").get("latestRecordDate").isNull());
    }

    @Test
    void databaseFailureIsHttp500AndDoesNotLeakInternalDetails() throws Exception {
        var response = get((sql, params) -> {
            throw new IllegalStateException("internal database failure");
        });
        assertEquals(500, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertEquals(500, json.get("code").asInt());
        assertFalse(response.body().contains("internal database failure"));
    }

    private HttpResponse<String> get(BiFunction<String, List<Object>, List<Map<String, Object>>> query) throws Exception {
        app = Javalin.create();
        new DailyController(new DailyService(new DailyDao(query))).registerRoutes(app);
        app.start("127.0.0.1", 0);
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + "/daily/latest-date")).GET().build();
        try (var client = HttpClient.newHttpClient()) {
            return client.send(request, HttpResponse.BodyHandlers.ofString());
        }
    }
}
