package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hantang.web.api.LlmClient;
import com.hantang.web.dao.VideoContentLabelDao;
import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.service.labeling.VideoLabelingStore;
import com.hantang.web.service.labeling.VideoLabelingStore.Request;
import com.hantang.web.task.UniSeekLabelingTask;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.nio.file.*;
import java.sql.SQLException;
import java.sql.SQLTimeoutException;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/** Explicit local operator commands. GETs never create jobs, write labels, or call a model. */
public final class VideoLabelingController extends BaseController {
    private static final String BASE = "/admin/content/video-labeling";
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Logger logger = LoggerFactory.getLogger(VideoLabelingController.class);
    private final VideoLabelingStore store;
    private final Path directory;
    private final Executor executor;
    private final UniSeekLabelingTask.Clients clients;
    private volatile UniSeekLabelingTask current;
    private volatile String latestId;
    private ObjectNode cachedOverview;
    private long overviewAt;

    public VideoLabelingController() {
        this(new VideoContentLabelDao(), Path.of("script/uniseek/labeling-runs"), Executors.newSingleThreadExecutor(r -> {
            var thread = new Thread(r, "uniseek-labeling"); thread.setDaemon(true); return thread;
        }), () -> LlmClient.fromConfig(Path.of("config.secret.properties")));
    }
    VideoLabelingController(VideoLabelingStore store, Path directory, Executor executor, UniSeekLabelingTask.Clients clients) {
        this.store = store; this.directory = directory; this.executor = executor; this.clients = clients;
        try {
            String id = JSON.readTree(directory.resolve("latest.json").toFile()).path("id").asText();
            if (id.matches("bulk-[0-9a-f-]{36}")) latestId = id;
        } catch (IOException | RuntimeException ignored) { }
    }
    @Override public void registerRoutes(Javalin app) {
        app.get(BASE, ctx -> { if (local(ctx)) ctx.json(ResponseDTO.success(snapshot())); });
        app.get(BASE + "/overview", ctx -> { if (local(ctx)) ctx.json(ResponseDTO.success(overview(false))); });
        app.post(BASE + "/start", ctx -> {
            if (!local(ctx)) return;
            Request options;
            try {
                var body = JSON.readTree(ctx.body());
                if (body == null || !body.isObject() || !body.path("count").isInt() || !body.path("concurrency").isInt()
                        || !body.path("mode").isTextual()) throw new IllegalArgumentException();
                options = new Request(body.path("mode").asText(), body.path("count").asInt(), body.path("concurrency").asInt());
            } catch (IOException | IllegalArgumentException e) { ctx.status(400).json(ResponseDTO.error(400, "INVALID_LABELING_OPTIONS")); return; }
            synchronized (this) {
                if (current != null && current.isActive()) { ctx.status(409).json(ResponseDTO.error(409, "LABELING_ALREADY_RUNNING")); return; }
                var source = overview(true);
                if (!source.path("available").asBoolean()) { ctx.status(503).json(ResponseDTO.error(503, source.path("error").asText())); return; }
                long available = "incremental".equals(options.mode()) ? source.path("unlabeled_count").asLong()
                        : source.path("total_count").asLong() - source.path("manual_count").asLong();
                if (available == 0) { ctx.status(409).json(ResponseDTO.error(409, "NO_ELIGIBLE_VIDEOS")); return; }
                String id = "bulk-" + UUID.randomUUID();
                try {
                    var task = new UniSeekLabelingTask(store, options, clients, id, directory.resolve(id));
                    Path temp = Files.createTempFile(directory, ".latest-", ".tmp");
                    try {
                        JSON.writeValue(temp.toFile(), JSON.createObjectNode().put("id", id));
                        try { Files.move(temp, directory.resolve("latest.json"), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING); }
                        catch (AtomicMoveNotSupportedException ignored) { Files.move(temp, directory.resolve("latest.json"), StandardCopyOption.REPLACE_EXISTING); }
                    } finally { Files.deleteIfExists(temp); }
                    current = task; latestId = id;
                    try { executor.execute(() -> { try { task.run(); } finally { invalidateOverview(); } }); }
                    catch (RuntimeException e) { task.failToStart(); ctx.status(503).json(ResponseDTO.error(503, "START_FAILED")); return; }
                    ctx.status(202).json(ResponseDTO.success(task.snapshot()));
                } catch (IOException e) { ctx.status(503).json(ResponseDTO.error(503, "RUN_STORAGE_UNAVAILABLE")); }
            }
        });
        app.post(BASE + "/stop", ctx -> {
            if (!local(ctx)) return;
            UniSeekLabelingTask task = current;
            if (task == null || !task.isActive()) { ctx.status(409).json(ResponseDTO.error(409, "NO_ACTIVE_JOB")); return; }
            task.requestStop(); ctx.status(202).json(ResponseDTO.success(task.snapshot()));
        });
        app.get(BASE + "/{file}", ctx -> {
            if (!local(ctx)) return;
            String file = switch (ctx.pathParam("file")) { case "statistics" -> "status.json"; case "attempts" -> "attempts.jsonl"; default -> null; };
            if (latestId == null || file == null) { ctx.status(404); return; }
            Path path = directory.resolve(latestId).resolve(file);
            if (!Files.isRegularFile(path)) { ctx.status(404); return; }
            try {
                ctx.header("Content-Disposition", "attachment; filename=\"" + latestId + "-" + file + "\"")
                        .contentType(file.endsWith("jsonl") ? "application/x-ndjson" : "application/json").result(Files.newInputStream(path));
            } catch (IOException e) { ctx.status(503); }
        });
    }
    private ObjectNode snapshot() {
        if (current != null) return current.snapshot();
        if (latestId != null) try {
            var saved = (ObjectNode) JSON.readTree(directory.resolve(latestId).resolve("status.json").toFile());
            if (saved.path("active").asBoolean()) {
                saved.put("active", false).put("status", "interrupted").put("active_requests", 0);
                saved.remove("live");
            }
            return saved;
        } catch (IOException | RuntimeException ignored) { }
        return JSON.createObjectNode().put("status", "idle").put("active", false);
    }
    private synchronized ObjectNode overview(boolean force) {
        if (!force && cachedOverview != null && System.nanoTime() - overviewAt < 3_000_000_000L) return cachedOverview.deepCopy();
        ObjectNode result;
        try {
            result = JSON.valueToTree(store.overview());
            result.put("available", true).put("snapshot_at", Instant.now().toString());
        } catch (SQLException | RuntimeException e) {
            String code = overviewError(e);
            logger.error("UniSeek labeling overview failed, code={}", code, e);
            result = JSON.createObjectNode().put("available", false).put("error", code);
        }
        cachedOverview = result; overviewAt = System.nanoTime();
        return result.deepCopy();
    }
    private static String overviewError(Exception failure) {
        for (Throwable cause = failure; cause != null; cause = cause.getCause()) {
            if (cause instanceof SQLException sql) {
                String state = sql.getSQLState();
                if ("42501".equals(state)) return "DATABASE_PERMISSION_DENIED";
                if ("42P01".equals(state) || "42703".equals(state)) return "DATABASE_SCHEMA_NOT_READY";
                if (sql instanceof SQLTimeoutException || "57014".equals(state)) return "DATABASE_QUERY_TIMEOUT";
                if (state != null && state.startsWith("08")) return "DATABASE_UNAVAILABLE";
                return "DATABASE_QUERY_FAILED";
            }
        }
        return "OVERVIEW_UNAVAILABLE";
    }
    private synchronized void invalidateOverview() { cachedOverview = null; }
    private static boolean local(Context ctx) {
        boolean allowed = false;
        try {
            allowed = InetAddress.getByName(ctx.req().getRemoteAddr()).isLoopbackAddress()
                    && ctx.header("Forwarded") == null && ctx.header("X-Forwarded-For") == null;
            String origin = ctx.header("Origin");
            if (origin != null) allowed &= Set.of("localhost", "127.0.0.1", "[::1]").contains(URI.create(origin).getHost());
        } catch (Exception ignored) { }
        if (!allowed) ctx.status(403).json(ResponseDTO.error(403, "Use the local management page"));
        return allowed;
    }
}
