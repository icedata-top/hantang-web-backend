package com.hantang.web.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.task.VideoTypeAndLanguageAnalysisTask;
import com.hantang.web.service.labeling.VideoLabelScorer;
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
import java.util.function.BiConsumer;

/** Thin local management entry point: start the existing task, read its progress, download its JSON. */
public final class VideoAnalysisController extends BaseController {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String BASE = "/admin/content/video-analysis";
    private final Path directory;
    private final Executor executor;
    private final BiConsumer<Path, Integer> runner;
    private final Path reference;
    private volatile Run current;

    public VideoAnalysisController() {
        this(Path.of("script/uniseek/runs"), Executors.newSingleThreadExecutor(r -> {
            var thread = new Thread(r, "video-analysis"); thread.setDaemon(true); return thread;
        }), (output, concurrency) -> new VideoTypeAndLanguageAnalysisTask(null,
                Path.of("script/uniseek/uniseek_videos.json"), output, 1000, 20, concurrency).run());
    }

    VideoAnalysisController(Path directory, Executor executor, Consumer<Path> runner) {
        this(directory, executor, (output, concurrency) -> runner.accept(output));
    }

    VideoAnalysisController(Path directory, Executor executor, BiConsumer<Path, Integer> runner) {
        this(directory, executor, runner, VideoLabelScorer.DEFAULT_REFERENCE);
    }

    VideoAnalysisController(Path directory, Executor executor, BiConsumer<Path, Integer> runner, Path reference) {
        this.directory = directory; this.executor = executor; this.runner = runner; this.reference = reference;
        try {
            var saved = JSON.readTree(directory.resolve("latest-run.json").toFile());
            if (saved == null || !saved.isObject()) return;
            String id = saved.path("id").asText();
            int concurrency = saved.path("concurrency").asInt();
            if (id.matches("web-[0-9a-f-]{36}") && VideoTypeAndLanguageAnalysisTask.CONCURRENCY_OPTIONS.contains(concurrency))
                current = new Run(id, directory.resolve(id).resolve("predictions.json"), concurrency);
        } catch (IOException ignored) { }
    }

    @Override public void registerRoutes(Javalin app) {
        app.post(BASE + "/start", ctx -> {
            if (!local(ctx)) return;
            int concurrency = VideoTypeAndLanguageAnalysisTask.DEFAULT_CONCURRENCY;
            if (!ctx.body().isBlank()) {
                try {
                    var options = JSON.readTree(ctx.body());
                    if (!options.isObject()) throw new IllegalArgumentException();
                    if (options.has("concurrency")) {
                        if (!options.path("concurrency").isInt()) throw new IllegalArgumentException();
                        concurrency = options.path("concurrency").intValue();
                    }
                } catch (IOException | IllegalArgumentException e) {
                    ctx.status(400).json(ResponseDTO.error(400, "Invalid concurrency")); return;
                }
            }
            if (!VideoTypeAndLanguageAnalysisTask.CONCURRENCY_OPTIONS.contains(concurrency)) {
                ctx.status(400).json(ResponseDTO.error(400, "Concurrency must be 1, 4, 8, 16, 32 or 64")); return;
            }
            synchronized (this) {
                if (current != null && (current.running || current.scoring)) {
                    ctx.status(409).json(ResponseDTO.error(409, "Analysis is already running")); return;
                }
                String id = "web-" + UUID.randomUUID();
                var run = new Run(id, directory.resolve(id).resolve("predictions.json"), concurrency);
                run.running = true;
                try {
                    Files.createDirectories(directory);
                    Path pointer = Files.createTempFile(directory, ".latest-run-", ".tmp");
                    try {
                        JSON.writeValue(pointer.toFile(), JSON.createObjectNode().put("id", id).put("concurrency", concurrency));
                        try { Files.move(pointer, directory.resolve("latest-run.json"), java.nio.file.StandardCopyOption.REPLACE_EXISTING, java.nio.file.StandardCopyOption.ATOMIC_MOVE); }
                        catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
                            Files.move(pointer, directory.resolve("latest-run.json"), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                        }
                    } finally { Files.deleteIfExists(pointer); }
                } catch (IOException e) {
                    ctx.status(503).json(ResponseDTO.error(503, "Unable to save run configuration")); return;
                }
                current = run;
                try {
                    executor.execute(() -> {
                        try { runner.accept(run.output, run.concurrency); }
                        catch (RuntimeException e) { run.error = "TASK_FAILED"; }
                        finally {
                            try { if (Files.isRegularFile(run.output)) score(run); }
                            finally { run.running = false; }
                        }
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
        app.post(BASE + "/score", ctx -> {
            if (!local(ctx)) return;
            synchronized (this) {
                Run run = current;
                if (run == null) { ctx.status(404).json(ResponseDTO.error(404)); return; }
                if (run.running || run.scoring) { ctx.status(409).json(ResponseDTO.error(409, "A run or scoring is active")); return; }
                if (!snapshot(run).path("has_results").asBoolean()) {
                    ctx.status(409).json(ResponseDTO.error(409, "Saved terminal results are required")); return;
                }
                run.scoring = true;
                run.scoringError = null;
                try { executor.execute(() -> score(run)); }
                catch (RuntimeException e) { run.scoring = false; ctx.status(503).json(ResponseDTO.error(503)); return; }
                ctx.status(202).json(ResponseDTO.success(snapshot(run)));
            }
        });
        app.get(BASE + "/score/details", ctx -> {
            if (!local(ctx)) return;
            Run run = current;
            if (run == null || run.running || run.scoring || !Files.isRegularFile(VideoLabelScorer.reportPath(run.output))
                    || !"completed".equals(snapshot(run).path("evaluation").path("status").asText())) {
                ctx.status(404).json(ResponseDTO.error(404)); return;
            }
            try { ctx.json(ResponseDTO.success(JSON.readTree(VideoLabelScorer.reportPath(run.output).toFile()))); }
            catch (IOException e) { ctx.status(503).json(ResponseDTO.error(503)); }
        });
        app.get(BASE + "/{file}", ctx -> {
            if (!local(ctx)) return;
            Run run = current;
            if (run == null) { ctx.status(404).json(ResponseDTO.error(404)); return; }
            Path path = switch (ctx.pathParam("file")) {
                case "results" -> run.output;
                case "statistics" -> VideoTypeAndLanguageAnalysisTask.statisticsPath(run.output);
                case "score" -> VideoLabelScorer.reportPath(run.output);
                default -> null;
            };
            if (path == null || !Files.isRegularFile(path)) { ctx.status(404).json(ResponseDTO.error(404)); return; }
            if ("score".equals(ctx.pathParam("file")) && (run.running || run.scoring
                    || !"completed".equals(snapshot(run).path("evaluation").path("status").asText()))) {
                ctx.status(409).json(ResponseDTO.error(409, "Scoring is not available")); return;
            }
            if ("results".equals(ctx.pathParam("file")) && !snapshot(run).path("has_results").asBoolean()) {
                ctx.status(409).json(ResponseDTO.error(409, "Results are still being saved")); return;
            }
            try {
                ctx.header("Content-Disposition", "attachment; filename=\"qwen-" + run.id + "-" + ctx.pathParam("file") + ".json\"");
                ctx.contentType("application/json; charset=utf-8").result(Files.newInputStream(path));
            }
            catch (IOException e) { ctx.status(503).json(ResponseDTO.error(503, "Unable to read saved analysis")); }
        });
    }

    private ObjectNode snapshot(Run run) {
        var data = JSON.createObjectNode().put("id", run.id).put("active", run.running || run.scoring);
        data.put("status", run.running ? "queued" : "interrupted");
        data.put("selected_count", 1000).put("concurrency", run.concurrency).put("batch_size", 20).put("run_mode", "new");
        data.put("has_results", false);
        data.put("has_statistics", Files.isRegularFile(VideoTypeAndLanguageAnalysisTask.statisticsPath(run.output)));
        if (run.error != null) data.put("error", run.error);
        try {
            Path snapshot = VideoTypeAndLanguageAnalysisTask.snapshotPath(run.output);
            Path stats = Files.isRegularFile(snapshot) ? snapshot : VideoTypeAndLanguageAnalysisTask.statisticsPath(run.output);
            JsonNode saved = JSON.readTree(stats.toFile());
            for (String field : Set.of("status", "model", "selected_count", "elapsed_ms", "summary", "fatal_error",
                    "concurrency", "batch_size", "snapshot_at", "active_requests", "live", "started_at", "finished_at", "last_error")) {
                if (saved.has(field)) data.set(field, saved.get(field));
            }
            boolean finalized = Set.of("completed", "completed_with_failures", "failed", "interrupted").contains(data.path("status").asText());
            data.put("has_results", finalized && !run.running && Files.isRegularFile(run.output));
            if (!run.running && !finalized) {
                data.put("status", "interrupted").put("active_requests", 0);
                data.remove("live"); // Restart never resumes paid work or keeps a stale ETA.
            }
        } catch (IOException ignored) { /* The task may still be reserving its first checkpoint. */ }
        if (!run.running && run.error != null && !data.has("finished_at")) data.put("status", "failed");
        ObjectNode evaluation = JSON.createObjectNode().put("status", "not_scored");
        try {
            var saved = JSON.readTree(VideoLabelScorer.summaryPath(run.output).toFile());
            if (saved != null && saved.isObject()) evaluation = (ObjectNode) saved;
        } catch (IOException ignored) { }
        if (run.scoring) {
            data.put("status", "scoring");
            evaluation = JSON.createObjectNode().put("status", "scoring");
        } else if ("scoring".equals(evaluation.path("status").asText())) {
            evaluation = JSON.createObjectNode().put("status", "failed").put("error", "SCORING_INTERRUPTED");
        }
        if (run.scoringError != null) evaluation = JSON.createObjectNode().put("status", "failed").put("error", run.scoringError);
        data.set("evaluation", evaluation);
        return data;
    }

    private void score(Run run) {
        run.scoring = true;
        run.scoringError = null;
        try {
            VideoLabelScorer.write(VideoLabelScorer.summaryPath(run.output), JSON.createObjectNode().put("status", "scoring"));
            ObjectNode report = VideoLabelScorer.evaluate(reference, run.output);
            VideoLabelScorer.write(VideoLabelScorer.reportPath(run.output), report);
            VideoLabelScorer.write(VideoLabelScorer.summaryPath(run.output), VideoLabelScorer.summary(report));
        } catch (IOException | RuntimeException e) {
            run.scoringError = e instanceof VideoLabelScorer.ScoringException failure ? failure.code() : "SCORING_IO_ERROR";
            try {
                VideoLabelScorer.write(VideoLabelScorer.summaryPath(run.output), JSON.createObjectNode()
                        .put("status", "failed").put("error", run.scoringError));
            } catch (IOException ignored) { /* The original labeling results stay available. */ }
        } finally { run.scoring = false; }
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
        final int concurrency;
        volatile boolean running;
        volatile boolean scoring;
        volatile String scoringError;
        volatile String error;
        Run(String id, Path output, int concurrency) { this.id = id; this.output = output; this.concurrency = concurrency; }
    }
}
