package com.hantang.web.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.ProducerDao;
import com.hantang.web.service.ProducerService;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ProducerControllerTest {
    private Javalin app;
    private final AtomicInteger queries = new AtomicInteger();
    private final HttpClient client = HttpClient.newHttpClient();
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void start() {
        var dao = new ProducerDao((sql, params) -> {
            queries.incrementAndGet();
            if (params.getFirst().equals(500L)) throw new IllegalStateException("internal database failure");
            if (sql.contains("FROM hantang_dynamic.discovered_users")) {
                return params.getFirst().equals(396194L) ? List.of(Map.of("user_id", 396194L, "user_name", "COPY")) : List.of();
            }
            return List.of(Map.of("total", 0L, "unique_total", 0L));
        });
        app = Javalin.create();
        new ProducerController(new ProducerService(dao)).registerRoutes(app);
        app.start(0);
    }

    @AfterEach
    void stop() { if (app != null) app.stop(); }

    @Test
    void publicInfoAndMissingAccountReturnAppropriateEnvelopes() throws Exception {
        var found = get("/producers/396194/info");
        assertEquals(200, found.statusCode());
        assertEquals("396194", body(found).get("result").get("userId").asText());
        assertEquals(404, get("/producers/999/info").statusCode());
    }

    @Test
    void invalidIdsAndQueryValuesNeverReachDatabase() throws Exception {
        for (String path : List.of("/producers/0/info", "/producers/01/info", "/producers/nope/info",
                "/producers/9223372036854775808/info", "/producers/1/videos?role=all",
                "/producers/1/videos?sortBy=title", "/producers/1/videos?order=DESC",
                "/producers/1/videos?page=0", "/producers/1/videos?pageSize=101")) {
            assertEquals(400, get(path).statusCode(), path);
        }
        assertEquals(0, queries.get());
    }

    @Test
    void videoListWorksWithoutProfileAndEchoesValidatedPagination() throws Exception {
        var response = get("/producers/999/videos?sortBy=view&order=asc&role=staff&page=2&pageSize=10");
        assertEquals(200, response.statusCode());
        JsonNode data = body(response).get("result");
        assertEquals("staff", data.get("role").asText());
        assertEquals("view", data.get("sortBy").asText());
        assertEquals("asc", data.get("order").asText());
        assertEquals(2, data.get("page").asInt());
        assertEquals(10, data.get("pageSize").asInt());
        assertEquals(0, data.get("total").asInt());
        assertTrue(data.get("rows").isEmpty());
    }

    @Test
    void databaseFailureIsNotMisreportedAsNotFoundOrBadRequest() throws Exception {
        for (String resource : List.of("info", "videos")) {
            var response = get("/producers/500/" + resource);
            assertEquals(500, response.statusCode());
            assertFalse(response.body().contains("internal database failure"));
        }
    }

    private HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + path)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
    private JsonNode body(HttpResponse<String> response) throws Exception { return mapper.readTree(response.body()); }
}
