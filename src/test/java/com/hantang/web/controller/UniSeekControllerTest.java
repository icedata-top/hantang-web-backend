package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.UniSeekDao;
import com.hantang.web.service.UniSeekService;
import io.javalin.Javalin;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class UniSeekControllerTest {
    private final ObjectMapper mapper = new ObjectMapper();
    @Test void separateGetEndpointsValidateInputsAndReturnIndependentEmptyResults() throws Exception {
        var queries = new AtomicInteger();
        var service = new UniSeekService(new UniSeekDao((sql, params) -> {
            queries.incrementAndGet();
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(Map.of("record_date", "2026-10-28"));
            if (params.contains("fail")) throw new IllegalStateException("private database error");
            return List.of();
        }), Runnable::run);
        var app = Javalin.create(); new UniSeekController(service).registerRoutes(app); app.start(0);
        try {
            var client = HttpClient.newHttpClient();
            for (String path : List.of("/uniseek/videos", "/uniseek/producers", "/uniseek/videos?keyword=x&page=0",
                    "/uniseek/videos?keyword=x&pageSize=51", "/uniseek/videos?keyword=x&page=1.5",
                    "/uniseek/producers?keyword=" + "x".repeat(101), "/uniseek/videos/0", "/uniseek/videos/9223372036854775808",
                    "/uniseek/producers/01", "/uniseek/producers/nope")) {
                assertEquals(400, get(client, app.port(), path).statusCode(), path);
            }
            assertEquals(0, queries.get());
            var videos = mapper.readTree(get(client, app.port(), "/uniseek/videos?keyword=missing").body()).get("result");
            assertTrue(videos.get("list").isEmpty()); assertFalse(videos.get("hasMore").asBoolean());
            assertEquals(1, videos.get("page").asInt()); assertEquals(30, videos.get("pageSize").asInt());
            var producers = mapper.readTree(get(client, app.port(), "/uniseek/producers?keyword=missing").body()).get("result");
            assertTrue(producers.get("list").isEmpty()); assertFalse(producers.has("score"));
            for (String path : List.of("/uniseek/videos/123", "/uniseek/producers/123")) {
                var exact = mapper.readTree(get(client, app.port(), path).body()).get("result");
                assertTrue(exact.get("list").isEmpty());
            }
            for (String kind : List.of("videos", "producers")) {
                var response = get(client, app.port(), "/uniseek/" + kind + "?keyword=fail");
                assertEquals(500, response.statusCode()); assertFalse(response.body().contains("private database error"));
            }
        } finally { app.stop(); }
    }
    @Test void producerResponseArrivesWhileVideoQueryIsStillBlocked() throws Exception {
        var videoStarted = new CountDownLatch(1);
        var releaseVideo = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var service = new UniSeekService(new UniSeekDao((sql, params) -> {
                if (sql.startsWith("SELECT to_regclass")) return List.of();
                if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", "2026-10-28"));
                if (sql.contains("processed_videos")) {
                    videoStarted.countDown();
                    try { if (!releaseVideo.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("test timed out"); }
                    catch (InterruptedException e) { throw new RuntimeException(e); }
                }
                return List.of();
            }), executor);
            var app = Javalin.create(); new UniSeekController(service).registerRoutes(app); app.start(0);
            try {
                var client = HttpClient.newHttpClient();
                var videoResponse = client.sendAsync(request(app.port(), "/uniseek/videos?keyword=slow"), HttpResponse.BodyHandlers.ofString());
                assertTrue(videoStarted.await(2, TimeUnit.SECONDS));
                assertEquals(200, get(client, app.port(), "/uniseek/producers?keyword=fast").statusCode());
                assertFalse(videoResponse.isDone());
                releaseVideo.countDown(); assertEquals(200, videoResponse.get(3, TimeUnit.SECONDS).statusCode());
            } finally { releaseVideo.countDown(); app.stop(); }
        }
    }
    private HttpRequest request(int port, String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path)).timeout(Duration.ofSeconds(3)).GET().build();
    }
    private HttpResponse<String> get(HttpClient client, int port, String path) throws Exception {
        return client.send(request(port, path), HttpResponse.BodyHandlers.ofString());
    }
}
