package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.DataCollectionDao;
import com.hantang.web.service.DataCollectionService;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.*;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.RejectedExecutionException;

import static org.junit.jupiter.api.Assertions.*;

class DataCollectionControllerTest {
    private Javalin app;
    @AfterEach void stop() { if (app != null) app.stop(); }

    private HttpResponse<String> get(String source, DataCollectionService service) throws Exception {
        app = Javalin.create();
        new DataCollectionController(service).registerRoutes(app);
        app.start("127.0.0.1", 0);
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + "/admin/data/collection/" + source))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
        }
    }

    @Test void emptySourcesUseTheStandardEnvelopeAndUnknownSourcesNeverReachTheDatabase() throws Exception {
        var dao = new DataCollectionDao((sql, params) -> {
            if (sql.contains("pg_class")) return List.of(Map.of("columns", "aid", "estimated_rows", 100));
            if (sql.startsWith("SELECT EXISTS")) return List.of(Map.of("has_data", false));
            throw new AssertionError(sql);
        });
        var response = get("videos", new DataCollectionService(dao, Clock.systemUTC(), Runnable::run));
        assertEquals(200, response.statusCode());
        var json = new ObjectMapper().readTree(response.body());
        assertEquals(200, json.get("code").asInt());
        assertEquals("empty", json.get("result").get("health").asText());
        assertEquals(0, json.get("result").get("estimatedRows").asLong());
        assertTrue(json.get("result").get("latestAt").isNull());
        app.stop();
        var unused = new DataCollectionDao((sql, params) -> { throw new AssertionError("Invalid source reached DB"); });
        assertEquals(404, get("unknown", new DataCollectionService(unused, Clock.systemUTC(), Runnable::run)).statusCode());
    }

    @Test void databaseErrorsAreFailuresWithoutLeakingDetails() throws Exception {
        var dao = new DataCollectionDao((sql, params) -> { throw new IllegalStateException("private database details"); });
        var response = get("accounts", new DataCollectionService(dao, Clock.systemUTC(), Runnable::run));
        assertEquals(500, response.statusCode());
        assertFalse(response.body().contains("private database details"));
    }

    @Test void exhaustedWorkQueueReturns503() throws Exception {
        var service = new DataCollectionService(new DataCollectionDao((sql, params) -> List.of()), Clock.systemUTC(),
                task -> { throw new RejectedExecutionException(); });
        assertEquals(503, get("daily", service).statusCode());
    }
}
