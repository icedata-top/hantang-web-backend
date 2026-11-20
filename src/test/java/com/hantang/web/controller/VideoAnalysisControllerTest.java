package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.task.VideoTypeAndLanguageAnalysisTask;
import com.hantang.web.service.labeling.VideoLabelScorer;
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
        assertEquals(1000, JSON.readTree(request("GET", "/results").body()).path("processed_count").asInt());
        assertEquals(200, request("GET", "/statistics").statusCode());
        assertTrue(request("GET", "/results").headers().firstValue("Content-Disposition").orElse("").contains("attachment"));
        assertEquals(404, request("GET", "/config.secret.properties").statusCode());
    }

    private HttpResponse<String> startWithBody(String body) throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + app.port() + "/admin/content/video-analysis/start"))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(body)).build();
        try (var client = HttpClient.newHttpClient()) { return client.send(request, HttpResponse.BodyHandlers.ofString()); }
    }

    @Test void validatesConcurrencyPersistsItAndRestoresStatusWithoutRestartingPaidWork() throws Exception {
        var queued = new ArrayList<Runnable>();
        var selected = new java.util.concurrent.atomic.AtomicInteger();
        app = Javalin.create();
        new VideoAnalysisController(directory, queued::add, (output, concurrency) -> selected.set(concurrency)).registerRoutes(app);
        app.start("127.0.0.1", 0);
        for (String body : new String[]{"{", "null", "[]", "{\"concurrency\":0}", "{\"concurrency\":3}",
                "{\"concurrency\":65}", "{\"concurrency\":8.5}", "{\"concurrency\":\"8\"}"})
            assertEquals(400, startWithBody(body).statusCode(), body);
        assertTrue(queued.isEmpty());
        assertEquals(202, startWithBody("{\"concurrency\":16}").statusCode());
        assertEquals(16, JSON.readTree(request("GET", "").body()).path("result").path("concurrency").asInt());
        assertEquals(404, request("GET", "/results").statusCode());
        queued.get(0).run(); assertEquals(16, selected.get());
        app.stop();
        var unexpected = new ArrayList<Runnable>();
        app = Javalin.create();
        new VideoAnalysisController(directory, unexpected::add, (output, concurrency) -> fail("must not restart paid work")).registerRoutes(app);
        app.start("127.0.0.1", 0);
        var restored = JSON.readTree(request("GET", "").body()).path("result");
        assertFalse(restored.path("active").asBoolean());
        assertEquals(16, restored.path("concurrency").asInt());
        assertEquals("interrupted", restored.path("status").asText());
        assertTrue(unexpected.isEmpty());
    }

    @Test void completionScoresSaved1000ResultsAndRescoringNeverCallsTheRunnerAgain() throws Exception {
        var queued = new ArrayList<Runnable>();
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        app = Javalin.create();
        new VideoAnalysisController(directory, queued::add, (output, concurrency) -> {
            calls.incrementAndGet();
            try {
                Files.createDirectories(output.getParent());
                Files.copy(Path.of("script/uniseek/runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.json"), output);
                Files.writeString(VideoTypeAndLanguageAnalysisTask.statisticsPath(output), "{\"status\":\"completed\",\"finished_at\":\"2026-11-20T00:00:00Z\"}");
            } catch (Exception e) { throw new IllegalStateException(e); }
        }).registerRoutes(app);
        app.start("127.0.0.1", 0);
        assertEquals(202, request("POST", "/start").statusCode());
        assertEquals(409, request("POST", "/score").statusCode());
        queued.get(0).run();
        var status = JSON.readTree(request("GET", "").body()).path("result");
        assertEquals("completed", status.path("evaluation").path("status").asText());
        assertEquals(858, status.path("evaluation").path("summary").path("scorable_count").asInt());
        assertEquals(142, status.path("evaluation").path("summary").path("unscorable_count").asInt());
        assertFalse(status.path("evaluation").has("entries"));
        assertEquals(1000, JSON.readTree(request("GET", "/score/details").body()).path("result").path("entries").size());
        assertEquals(200, request("GET", "/score").statusCode());
        assertEquals(403, request("POST", "/score", "Origin", "https://example.invalid").statusCode());
        assertEquals(202, request("POST", "/score").statusCode());
        assertEquals(409, request("POST", "/start").statusCode());
        queued.get(1).run();
        assertEquals(1, calls.get());
        assertEquals("completed", JSON.readTree(request("GET", "").body()).path("result").path("evaluation").path("status").asText());
        app.stop();
        app = Javalin.create();
        new VideoAnalysisController(directory, queued::add, (output, concurrency) -> fail("must not run Qwen on refresh")).registerRoutes(app);
        app.start("127.0.0.1", 0);
        var restored = JSON.readTree(request("GET", "").body()).path("result");
        assertEquals(status.path("evaluation").path("summary"), restored.path("evaluation").path("summary"));
        assertFalse(restored.path("active").asBoolean());
    }

    @Test void invalidReferenceFailsOnlyScoringAndKeepsSuccessfulLabelsDownloadable() throws Exception {
        var queued = new ArrayList<Runnable>();
        app = Javalin.create();
        new VideoAnalysisController(directory, queued::add, (output, concurrency) -> {
            try {
                Files.createDirectories(output.getParent());
                Files.copy(Path.of("script/uniseek/runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.json"), output);
                Files.writeString(VideoTypeAndLanguageAnalysisTask.statisticsPath(output), "{\"status\":\"completed\"}");
            } catch (Exception e) { throw new IllegalStateException(e); }
        }, directory.resolve("missing-reference.json")).registerRoutes(app);
        app.start("127.0.0.1", 0);
        request("POST", "/start"); queued.get(0).run();
        var status = JSON.readTree(request("GET", "").body()).path("result");
        assertEquals("completed", status.path("status").asText());
        assertEquals("failed", status.path("evaluation").path("status").asText());
        assertTrue(status.path("has_results").asBoolean());
        assertEquals(200, request("GET", "/results").statusCode());
        assertEquals(404, request("GET", "/score/details").statusCode());
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
