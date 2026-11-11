package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.DataProcessingDao;
import com.hantang.web.service.DataProcessingService;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.*;
import java.time.Clock;
import java.util.*;
import java.util.concurrent.RejectedExecutionException;
import static org.junit.jupiter.api.Assertions.*;

class DataProcessingControllerTest {
    private Javalin app;
    @AfterEach void stop() { if (app != null) app.stop(); }
    private HttpResponse<String> get(String source, DataProcessingService service) throws Exception {
        app = Javalin.create();
        new DataProcessingController(service).registerRoutes(app);
        app.start("127.0.0.1", 0);
        try (var client = HttpClient.newHttpClient()) {
            return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + "/admin/data/processing/" + source))
                    .GET().build(), HttpResponse.BodyHandlers.ofString());
        }
    }
    @Test void unavailableCronIsAnExplicitObservationAndDefinitionsAreNotClaimedAsLiveJobs() throws Exception {
        var dao = new DataProcessingDao((sql, params) -> List.of(Map.of("readable", false, "estimated_rows", 20)));
        var response = get("scheduler", new DataProcessingService(dao, Clock.systemUTC(), Runnable::run));
        assertEquals(200, response.statusCode());
        var json = new ObjectMapper().readTree(response.body()).get("result");
        assertEquals("forbidden", json.get("availability").asText());
        assertEquals("unobservable", json.get("status").asText());
        assertEquals(0, json.get("jobs").size());
        assertEquals(2, json.get("expectedJobs").size());
    }
    @Test void plannedWorkNeverQueriesTheDatabaseAndErrorsDoNotLeakDetails() throws Exception {
        var unused = new DataProcessingDao((sql, params) -> { throw new AssertionError("Planned work queried DB"); });
        assertEquals(404, get("videoLabels", new DataProcessingService(unused, Clock.systemUTC(), Runnable::run)).statusCode());
        app.stop();
        var failed = new DataProcessingDao((sql, params) -> { throw new IllegalStateException("private database details"); });
        var response = get("search", new DataProcessingService(failed, Clock.systemUTC(), Runnable::run));
        assertEquals(500, response.statusCode());
        assertFalse(response.body().contains("private database details"));
    }
    @Test void queueRejectionReturns503() throws Exception {
        var service = new DataProcessingService(new DataProcessingDao((sql, params) -> List.of()), Clock.systemUTC(),
                task -> { throw new RejectedExecutionException(); });
        assertEquals(503, get("aggregation", service).statusCode());
    }
}
