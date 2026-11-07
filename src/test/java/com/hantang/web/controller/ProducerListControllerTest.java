package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.ProducerDao;
import com.hantang.web.dos.producer.ProducerListRequest;
import com.hantang.web.service.ProducerService;
import io.javalin.Javalin;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.net.http.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class ProducerListControllerTest {
    @Test
    void validatesBeforeQueryingAndPreservesIdsNullsAndEmptyPageTotals() throws Exception {
        var calls = new AtomicInteger();
        var dao = new ProducerDao((sql, params) -> {
            calls.incrementAndGet();
            if (params.contains(1L)) throw new IllegalStateException("private database error");
            var row = new HashMap<String, Object>();
            row.put("total", 51L); row.put("unique_total", 51L);
            if (params.getLast().equals(0L)) {
                row.put("user_id", 9007199254740993L); row.put("user_name", "COPY");
                row.put("fans", null); row.put("videos_filtered", 5);
                row.put("level", 0); row.put("official_role", 0);
            }
            return List.of(row);
        });
        var app = Javalin.create();
        new ProducerController(new ProducerService(dao)).registerRoutes(app);
        app.start("127.0.0.1", 0);
        try (var client = HttpClient.newHttpClient()) {
            for (String query : List.of("page=0", "pageSize=101", "page=1.5", "page=2147483648", "minFans=-1",
                    "minFans=01", "minFans=9223372036854775808", "minVideos=-1", "minVideos=2147483648",
                    "order=DROP", "sortBy=user_name")) {
                assertEquals(400, get(client, app.port(), query).statusCode(), query);
            }
            assertEquals(0, calls.get());
            var mapper = new ObjectMapper();
            var response = get(client, app.port(), "");
            assertEquals(200, response.statusCode());
            var page = mapper.readTree(response.body()).get("result");
            assertEquals(51, page.get("total").asLong());
            assertEquals(20, page.get("pageSize").asInt());
            var producer = page.get("rows").get(0);
            assertEquals("9007199254740993", producer.get("userId").asText());
            assertTrue(producer.get("userId").isTextual());
            assertTrue(producer.get("fans").isNull());
            assertEquals(5, producer.get("videoCount").asInt());
            assertEquals(0, producer.get("level").asInt());
            assertFalse(producer.has("isFollowing"));
            var empty = mapper.readTree(get(client, app.port(), "page=4").body()).get("result");
            assertEquals(51, empty.get("total").asLong());
            assertTrue(empty.get("rows").isEmpty());
            var error = get(client, app.port(), "minFans=1");
            assertEquals(500, error.statusCode());
            assertFalse(error.body().contains("private database error"));
        } finally { app.stop(); }
    }

    @Test
    void duplicateAccountsFailAndLargeOffsetsDoNotOverflow() {
        var request = ProducerListRequest.from(Map.of("page", "2147483647", "pageSize", "100"));
        assertEquals(214748364600L, request.offset());
        var dao = new ProducerDao((sql, params) -> List.of(Map.of("total", 2L, "unique_total", 1L)));
        assertThrows(IllegalStateException.class, () -> new ProducerService(dao).getList(request));
    }

    private HttpResponse<String> get(HttpClient client, int port, String query) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/producers?" + query)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
}
