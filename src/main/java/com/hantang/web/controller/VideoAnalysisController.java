package com.hantang.web.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.task.VideoTypeAndLanguageAnalysisTask;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

/** Thin local management entry point: start the existing task, read its progress, download its JSON. */
public final class VideoAnalysisController extends BaseController {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BASE = "/admin/content/video-analysis";
    private final Path directory;
    private final Executor executor;
    private final Consumer<Path> runner;
    private volatile Run current;

    public VideoAnalysisController() {
        this(Path.of("script/uniseek/runs"), Executors.newSingleThreadExecutor(r -> {
            var thread = new Thread(r, "video-analysis"); thread.setDaemon(true); return thread;
        }), output -> new VideoTypeAndLanguageAnalysisTask(null,
                Path.of("script/uniseek/uniseek_videos.json"), output, 1000, 20).run());
    }

    VideoAnalysisController(Path directory, Executor executor, Consumer<Path> runner) {
        this.directory = directory; this.executor = executor; this.runner = runner;
    }

    @Override public void registerRoutes(Javalin app) {
        app.post(BASE + "/start", ctx -> {
            if (!local(ctx)) return;
            synchronized (this) {
                if (current != null && current.running) {
                    ctx.status(409).json(ResponseDTO.error(409, "Analysis is already running")); return;
                }
                String id = "web-" + UUID.randomUUID();
                var run = new Run(id, directory.resolve(id).resolve("predictions.json"));
                current = run;
                try {
                    executor.execute(() -> {
                        try { runner.accept(run.output); }
                        catch (RuntimeException e) { run.error = "TASK_FAILED"; }
                        finally { run.running = false; }
                    });
                } catch (RuntimeException e) {
                    run.error = "START_FAILED"; run.running = false;
                    ctx.status(503).json(ResponseDTO.error(503, "Unable to start analysis")); return;
                }
                ctx.status(202).json(ResponseDTO.success(snapshot(run)));
            }
        });
        app.get(BASE, ctx -> {
            if (local(ctx)) ctx.json(ResponseDTO.success(current == null ? JSON.createObjectNode().put("status", "idle").put("active", false) : snapshot(current)));
        });
        app.get(BASE + "/{file}", ctx -> {
            if (!local(ctx)) return;
            Run run = current;
            if (run == null) { ctx.status(404).json(ResponseDTO.error(404)); return; }
            Path path = switch (ctx.pathParam("file")) {
                case "results" -> run.output;
                case "statistics" -> VideoTypeAndLanguageAnalysisTask.statisticsPath(run.output);
                default -> null;
            };
            if (path == null || !Files.isRegularFile(path)) { ctx.status(404).json(ResponseDTO.error(404)); return; }
            try { ctx.json(ResponseDTO.success(JSON.readTree(path.toFile()))); }
            catch (IOException e) { ctx.status(503).json(ResponseDTO.error(503, "Unable to read saved analysis")); }
        });
    }

    private ObjectNode snapshot(Run run) {
        var data = JSON.createObjectNode().put("id", run.id).put("active", run.running);
        data.put("status", run.running ? "queued" : "failed");
        data.put("selected_count", 1000);
        data.put("has_results", Files.isRegularFile(run.output));
        data.put("has_statistics", Files.isRegularFile(VideoTypeAndLanguageAnalysisTask.statisticsPath(run.output)));
        if (run.error != null) data.put("error", run.error);
        try {
            JsonNode stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(run.output).toFile());
            for (String field : Set.of("status", "model", "selected_count", "elapsed_ms", "summary", "fatal_error")) {
                if (stats.has(field)) data.set(field, stats.get(field));
            }
            JsonNode last = null;
            for (JsonNode batch : stats.path("batches")) if (!"pending".equals(batch.path("status").asText())) last = batch;
            data.put("total_batches", stats.path("batches").size());
            if (last != null) {
                data.set("batch_index", last.path("batch_index"));
                data.put("attempt", last.path("attempts").size());
                if (!last.path("attempts").isEmpty()) {
                    JsonNode attempt = last.path("attempts").get(last.path("attempts").size() - 1);
                    if (attempt.has("error")) data.set("last_error", attempt.get("error"));
                }
            }
        } catch (IOException ignored) { /* The task may still be reserving its first checkpoint. */ }
        if (!run.running && run.error != null) data.put("status", "failed");
        return data;
    }

    // The existing admin switch is UI-only. Paid execution must not be exposed by the public API.
    private static boolean local(Context ctx) {
        boolean allowed = false;
        try {
            allowed = InetAddress.getByName(ctx.req().getRemoteAddr()).isLoopbackAddress()
                    && ctx.header("Forwarded") == null && ctx.header("X-Forwarded-For") == null;
            String origin = ctx.header("Origin");
            if (origin != null) allowed &= Set.of("localhost", "127.0.0.1", "[::1]").contains(URI.create(origin).getHost());
        } catch (Exception ignored) { allowed = false; }
        if (!allowed) ctx.status(403).json(ResponseDTO.error(403, "Use the local management page"));
        return allowed;
    }

    private static final class Run {
        final String id;
        final Path output;
        volatile boolean running = true;
        volatile String error;
        Run(String id, Path output) { this.id = id; this.output = output; }
    }
}
