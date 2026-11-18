package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.task.VideoTypeAndLanguageAnalysisTask;
import io.javalin.Javalin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URI;
import java.net.http.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.*;

class VideoAnalysisControllerTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    @TempDir Path directory;
    private Javalin app;
    @AfterEach void stop() { if (app != null) app.stop(); }

    private HttpResponse<String> request(String method, String path, String... headers) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + "/admin/content/video-analysis" + path));
        if (headers.length > 0) builder.headers(headers);
        builder.method(method, HttpRequest.BodyPublishers.noBody());
        try (var client = HttpClient.newHttpClient()) { return client.send(builder.build(), HttpResponse.BodyHandlers.ofString()); }
    }

    @Test void onlyStartQueuesWorkDuplicateStartsAreBlockedAndSavedProgressAndDownloadsAreAvailable() throws Exception {
        var queued = new ArrayList<Runnable>();
        app = Javalin.create();
        new VideoAnalysisController(directory, queued::add, output -> {
            try {
                Files.createDirectories(output.getParent());
                Files.writeString(output, "{\"status\":\"completed\",\"processed_count\":1000}");
                Files.writeString(VideoTypeAndLanguageAnalysisTask.statisticsPath(output), """
                        {"status":"completed","selected_count":1000,"model":"test-model","elapsed_ms":10,
                         "summary":{"succeeded_count":1000,"failed_count":0},"batches":[]}
                        """);
            } catch (Exception e) { throw new IllegalStateException("test IO failure"); }
        }).registerRoutes(app);
        app.start("127.0.0.1", 0);
        assertEquals("idle", JSON.readTree(request("GET", "").body()).path("result").path("status").asText());
        assertTrue(queued.isEmpty());
        assertEquals(202, request("POST", "/start", "Origin", "http://localhost:5173").statusCode());
        assertEquals(1, queued.size());
        assertEquals(409, request("POST", "/start").statusCode());
        assertTrue(JSON.readTree(request("GET", "").body()).path("result").path("active").asBoolean());
        queued.get(0).run();
        var status = JSON.readTree(request("GET", "").body()).path("result");
        assertFalse(status.path("active").asBoolean());
        assertEquals("completed", status.path("status").asText());
        assertEquals(1000, status.path("summary").path("succeeded_count").asInt());
        assertEquals(1000, JSON.readTree(request("GET", "/results").body()).path("result").path("processed_count").asInt());
        assertEquals(200, request("GET", "/statistics").statusCode());
        assertEquals(404, request("GET", "/config.secret.properties").statusCode());
    }

    @Test void publicOriginsAndForwardedRequestsCannotStartPaidWork() throws Exception {
        var queued = new ArrayList<Runnable>();
        app = Javalin.create();
        new VideoAnalysisController(directory, queued::add, output -> fail("unexpected execution")).registerRoutes(app);
        app.start("127.0.0.1", 0);
        assertEquals(403, request("POST", "/start", "Origin", "https://example.invalid").statusCode());
        assertEquals(403, request("POST", "/start", "Origin", "invalid origin").statusCode());
        assertEquals(403, request("POST", "/start", "X-Forwarded-For", "203.0.113.1").statusCode());
        assertTrue(queued.isEmpty());
        assertEquals("idle", JSON.readTree(request("GET", "").body()).path("result").path("status").asText());
    }
}
