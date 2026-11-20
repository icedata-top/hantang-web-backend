package com.hantang.web.task;

import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hantang.web.api.LlmClient;
import com.hantang.web.api.LlmClient.AnalysisException;
import com.hantang.web.api.LlmClient.TokenUsage;
import com.hantang.web.api.LlmClient.VideoInput;
import com.hantang.web.api.LlmClient.VideoLabel;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.Comparator;
import java.util.HashMap;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/** Explicit offline entry point; it is never registered with the web server or a scheduler. */
public final class VideoTypeAndLanguageAnalysisTask implements Runnable {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PROMPT_RESOURCE = "/prompt/VideoTypeAndLanguageAnalysis.md";
    private static final int MAX_RETRIES = 2;
    private final LlmClient client;
    private final Path input;
    private final Path output;
    private final int limit;
    public static final Set<Integer> CONCURRENCY_OPTIONS = Set.of(1, 4, 8, 16, 32, 64);
    public static final int DEFAULT_CONCURRENCY = 8;
    private final int batchSize;
    private final int concurrency;
    private boolean hasFailures;

    /** A null client loads the private configuration only after output files are reserved. */
    public VideoTypeAndLanguageAnalysisTask(LlmClient client, Path input, Path output, int limit, int batchSize) {
        this(client, input, output, limit, batchSize, 1);
    }

    public VideoTypeAndLanguageAnalysisTask(LlmClient client, Path input, Path output, int limit, int batchSize, int concurrency) {
        if (!CONCURRENCY_OPTIONS.contains(concurrency)) throw new IllegalArgumentException("并发数必须为1、4、8、16、32或64");
        if (limit < 1 || batchSize < 1 || batchSize > 50) {
            throw new IllegalArgumentException("处理上限必须大于0，单批大小必须为1至50");
        }
        this.client = client; this.input = input; this.output = output;
        this.limit = limit; this.batchSize = batchSize; this.concurrency = concurrency;
    }

    /** Optional arguments: input.json output.json limit batchSize concurrency. The default limit is ONE video. */
    public static void main(String[] args) {
        if (args.length > 5 || (args.length > 0 && "--help".equals(args[0]))) {
            System.out.println("参数：[输入JSON] [输出JSON] [处理上限，默认1] [每批条数，默认20，上限50] [并发数，默认1]；每批最多重试2次");
            return;
        }
        try {
            Path input = Path.of(args.length > 0 ? args[0] : "script/uniseek/uniseek_videos.json");
            Path output = Path.of(args.length > 1 ? args[1] : "target/uniseek/analysis-" + UUID.randomUUID() + ".json");
            int limit = args.length > 2 ? Integer.parseInt(args[2]) : 1;
            int batchSize = args.length > 3 ? Integer.parseInt(args[3]) : 20;
            var task = new VideoTypeAndLanguageAnalysisTask(null, input, output, limit, batchSize, args.length > 4 ? Integer.parseInt(args[4]) : 1);
            task.run();
            if (task.hasFailures()) System.exit(2);
        } catch (Exception e) {
            // Do not print exception bodies, configuration values or provider error text.
            System.err.println("视频分析任务未完成，请查看运行统计JSON；未输出配置或接口正文");
            System.exit(Thread.currentThread().isInterrupted() ? 130 : 1);
        }
    }

    public boolean hasFailures() { return hasFailures; }

    public static Path statisticsPath(Path output) {
        String name = output.getFileName().toString().replaceFirst("(?i)\\.json$", "");
        return output.resolveSibling(name + ".run.json");
    }

    public static Path snapshotPath(Path output) {
        return output.resolveSibling(output.getFileName().toString().replaceFirst("(?i)\\.json$", "") + ".status.json");
    }

    @Override
    public void run() {
        try { execute(); }
        catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("视频分析任务被中断，已有进度已保存");
        } catch (IOException e) {
            throw new UncheckedIOException("视频分析任务未完成，请查看运行统计JSON", e);
        }
    }

    private void execute() throws IOException, InterruptedException {
        var state = new RunState(output, statisticsPath(output));
        state.reserve(); // No HTTP request is allowed until a durable run record exists.
        LlmClient activeClient = client;
        String stage = "input";
        try {
            List<VideoInput> videos = readVideos();
            state.initialize(videos, batchSize);
            state.metrics.put("concurrency", concurrency).put("run_mode", "new");
            stage = "checkpoint";
            state.reserveResults();
            state.persist();
            stage = "prompt";
            String prompt;
            try (var stream = getClass().getResourceAsStream(PROMPT_RESOURCE)) {
                if (stream == null) throw new IOException("未找到视频分析提示词资源");
                prompt = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            }
            state.metrics.put("prompt_sha256", sha256(prompt.getBytes(StandardCharsets.UTF_8)));
            state.metrics.put("selected_input_sha256", sha256(JSON.writeValueAsBytes(videos)));
            stage = "configuration";
            if (activeClient == null) activeClient = LlmClient.fromConfig(Path.of("config.secret.properties"));
            state.metrics.put("model", activeClient.modelName());
            stage = "execution";
            executeBatches(state, videos, activeClient, prompt);
            state.metrics.put("status", "saving");
            state.persist();
            hasFailures = !state.failedVideos.isEmpty();
            state.report.put("status", !hasFailures ? "completed" : state.results.isEmpty() ? "failed" : "partial");
            state.persistResults();
            state.metrics.put("status", hasFailures ? "completed_with_failures" : "completed");
            state.metrics.put("finished_at", Instant.now().toString());
            state.persist();
            System.out.println("结果文件：" + output.toAbsolutePath());
            System.out.println("运行统计：" + state.statistics.toAbsolutePath());
        } catch (IOException | RuntimeException | InterruptedException e) {
            hasFailures = true;
            if (state.report != null) state.report.put("status", "failed");
            state.metrics.put("status", e instanceof InterruptedException ? "interrupted" : "failed");
            state.metrics.put("finished_at", Instant.now().toString());
            state.metrics.set("fatal_error", error(e instanceof InterruptedException ? "interrupted" : stage,
                    e instanceof InterruptedException ? "INTERRUPTED" : "TASK_ABORTED", null, null));
            // Clear an interrupt only for the final file write, then restore it in run().
            boolean interrupted = Thread.interrupted();
            try { state.persistResults(); state.persist(); }
            catch (IOException writeFailure) { e.addSuppressed(writeFailure); }
            finally { if (interrupted && !(e instanceof InterruptedException)) Thread.currentThread().interrupt(); }
            throw e;
        } finally {
            if (client == null && activeClient != null) activeClient.close();
        }
    }

    private record PendingBatch(int index, long readyAt) { }
    private record RunningBatch(int index, ObjectNode attempt, long started, LlmRequestBudget.Reservation reservation) { }
    private record AttemptResult(LlmClient.AnalysisResponse response, Exception failure, long elapsedMs) { }

    /** Only this coordinator touches JSON or disk. Workers only make HTTP calls. */
    private void executeBatches(RunState state, List<VideoInput> videos, LlmClient activeClient, String prompt)
            throws IOException, InterruptedException {
        var workers = Executors.newFixedThreadPool(concurrency, runnable -> {
            var thread = new Thread(runnable, "qwen-http"); thread.setDaemon(true); return thread;
        });
        var completed = new ExecutorCompletionService<AttemptResult>(workers);
        var running = new HashMap<Future<AttemptResult>, RunningBatch>();
        var pending = new PriorityQueue<PendingBatch>(Comparator.comparingLong(PendingBatch::readyAt).thenComparingInt(PendingBatch::index));
        for (int i = 0; i < state.batchLogs.size(); i++) pending.add(new PendingBatch(i, 0));
        var budget = new LlmRequestBudget(activeClient.executionTpm(), activeClient.executionRpm());
        state.metrics.putObject("dispatch_budget").put("tpm", activeClient.executionTpm()).put("rpm", activeClient.executionRpm());
        var estimates = new long[state.batchLogs.size()];
        for (int i = 0; i < estimates.length; i++) {
            var batch = videos.subList(i * batchSize, Math.min((i + 1) * batchSize, videos.size()));
            estimates[i] = prompt.length() + JSON.writeValueAsString(batch).length() + batch.size() * 192L + 512;
        }
        long nextDispatch = 0;
        long nextSnapshot = 0;
        try {
            while (!pending.isEmpty() || !running.isEmpty()) {
                if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                long now = System.nanoTime();
                if (!pending.isEmpty() && running.size() < concurrency && now >= pending.peek().readyAt() && now >= nextDispatch) {
                    long budgetWait = budget.waitMs(elapsed(state.started), estimates[pending.peek().index()]);
                    if (budgetWait > 0) {
                        nextDispatch = now + TimeUnit.MILLISECONDS.toNanos(budgetWait);
                        state.waitUntil = nextDispatch;
                    } else {
                        var work = pending.remove();
                        var log = (ObjectNode) state.batchLogs.get(work.index());
                        var batch = videos.subList(work.index() * batchSize, Math.min((work.index() + 1) * batchSize, videos.size()));
                        log.put("status", "running");
                        var attempt = log.withArray("attempts").addObject();
                        attempt.put("attempt", log.path("attempts").size()).put("status", "running").put("started_at", Instant.now().toString());
                        attempt.set("usage", JSON.valueToTree(new TokenUsage(null, null, null)));
                        state.persistBatch(work.index());
                        state.persist(); // A durable attempt record precedes every paid request.
                        long started = System.nanoTime();
                        var reservation = budget.reserve(elapsed(state.started), estimates[work.index()]);
                        state.requestStarts.add(new WindowEvent(elapsed(state.started), 1));
                        Future<AttemptResult> future = completed.submit(() -> {
                            state.activeRequests.incrementAndGet();
                            try {
                                var response = activeClient.analyze(batch, prompt);
                                return new AttemptResult(response, null, response.elapsedMs());
                            } catch (IOException | InterruptedException | RuntimeException e) {
                                return new AttemptResult(null, e, e instanceof AnalysisException failure ? failure.elapsedMs() : elapsed(started));
                            } finally { state.activeRequests.decrementAndGet(); }
                        });
                        running.put(future, new RunningBatch(work.index(), attempt, started, reservation));
                        nextDispatch = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(100);
                        state.waitUntil = 0;
                    }
                }
                var future = completed.poll(100, TimeUnit.MILLISECONDS);
                if (future != null) {
                    var work = running.remove(future);
                    AttemptResult result;
                    try { result = future.get(); }
                    catch (java.util.concurrent.ExecutionException e) { throw new IOException("批次工作线程异常"); }
                    var log = (ObjectNode) state.batchLogs.get(work.index());
                    var batch = videos.subList(work.index() * batchSize, Math.min((work.index() + 1) * batchSize, videos.size()));
                    var attempt = work.attempt();
                    attempt.put("finished_at", Instant.now().toString()).put("elapsed_ms", result.elapsedMs());
                    if (result.failure() == null) {
                        var response = result.response();
                        var entries = log.putArray("results");
                        for (int i = 0; i < batch.size(); i++) entries.add(reviewEntry(batch.get(i), response.results().get(i)));
                        attempt.put("status", "succeeded").put("http_status", 200);
                        attempt.set("usage", JSON.valueToTree(response.usage()));
                        log.put("status", "succeeded");
                        // Commit this batch before exposing its count in the progress snapshot.
                        state.persistBatch(work.index());
                        entries.forEach(state.results::add);
                        var summary = state.successfulBatches.addObject().put("count", batch.size()).put("elapsed_ms", response.elapsedMs());
                        summary.set("usage", JSON.valueToTree(response.usage()));
                        log.remove("results"); // The batch file retains entries; statistics do not duplicate them.
                        state.finishes.add(new WindowEvent(elapsed(state.started), batch.size()));
                    } else {
                        attempt.put("status", "failed");
                        if (result.failure() instanceof AnalysisException failure) {
                            attempt.set("error", error(failure.stage(), failure.code(), failure.httpStatus(), failure.responseShape()));
                            attempt.set("usage", JSON.valueToTree(failure.usage()));
                            if (failure.httpStatus() != null) attempt.put("http_status", failure.httpStatus());
                            if (failure.rawModelOutput() != null) attempt.put("raw_model_output", failure.rawModelOutput());
                        } else attempt.set("error", error("request", "CLIENT_IO_ERROR", null, null));
                        if (log.path("attempts").size() > MAX_RETRIES) {
                            log.put("status", "failed");
                            state.persistBatch(work.index());
                            state.failBatch(log, batch, attempt.path("error"));
                            state.finishes.add(new WindowEvent(elapsed(state.started), batch.size()));
                        } else {
                            log.put("status", "retrying");
                            long delay = TimeUnit.MILLISECONDS.toNanos(1000L * log.path("attempts").size()
                                    + ThreadLocalRandom.current().nextLong(250));
                            if (result.failure() instanceof AnalysisException failure && failure.retryAfterMs() != null)
                                delay = Math.max(delay, TimeUnit.MILLISECONDS.toNanos(failure.retryAfterMs()));
                            pending.add(new PendingBatch(work.index(), System.nanoTime() + delay));
                            state.persistBatch(work.index());
                        }
                        state.metrics.set("last_error", attempt.path("error").deepCopy());
                    }
                    var usage = attempt.path("usage").path("total_tokens");
                    if (usage.isIntegralNumber()) state.tokens.add(new WindowEvent(elapsed(state.started), usage.longValue()));
                    budget.reconcile(work.reservation(), usage.isIntegralNumber() ? usage.longValue() : null);
                    // Actual usage can release reservations sooner than their estimates.
                    if (state.waitUntil > 0) { nextDispatch = 0; state.waitUntil = 0; }
                    state.persist();
                }
                if (System.nanoTime() >= nextSnapshot) {
                    state.persistSnapshot();
                    nextSnapshot = System.nanoTime() + TimeUnit.SECONDS.toNanos(1);
                }
            }
        } catch (IOException | RuntimeException | InterruptedException e) {
            for (var entry : running.entrySet()) {
                entry.getKey().cancel(true);
                var work = entry.getValue();
                work.attempt().put("status", "interrupted").put("finished_at", Instant.now().toString()).put("elapsed_ms", elapsed(work.started()));
                var reason = error("interrupted", "OUTCOME_UNCERTAIN", null, null);
                work.attempt().set("error", reason);
                var batch = videos.subList(work.index() * batchSize, Math.min((work.index() + 1) * batchSize, videos.size()));
                state.failBatch((ObjectNode) state.batchLogs.get(work.index()), batch, reason);
                try { state.persistBatch(work.index()); } catch (IOException writeFailure) { e.addSuppressed(writeFailure); }
            }
            throw e;
        } finally {
            workers.shutdownNow();
        }
    }

    private record WindowEvent(long atMs, long value) { }

    static Long estimateRemainingMs(long elapsedMs, int completedBatches, int remaining, long windowFinished,
                                    long budgetWaitMs, boolean executing) {
        if (!executing || elapsedMs < 30_000 || completedBatches < 2 || remaining <= 0
                || windowFinished <= 0 || budgetWaitMs > 10_000) return null;
        return Math.round((double) remaining * Math.min(60_000, elapsedMs) / windowFinished);
    }

    private static ObjectNode error(String stage, String code, Integer httpStatus, String shape) {
        var result = JSON.createObjectNode().put("stage", stage).put("code", code);
        if (httpStatus == null) result.putNull("http_status"); else result.put("http_status", httpStatus);
        if (shape == null) result.putNull("response_shape"); else result.put("response_shape", shape);
        return result;
    }

    private static long elapsed(long started) { return (System.nanoTime() - started) / 1_000_000; }

    private static String sha256(byte[] bytes) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256不可用"); }
    }

    private static ObjectNode reviewEntry(VideoInput video, VideoLabel label) {
        var entry = JSON.createObjectNode().put("aid", label.aid());
        ObjectNode input = JSON.valueToTree(video); input.remove("aid"); entry.set("input", input);
        ObjectNode output = JSON.valueToTree(label); output.remove("aid"); entry.set("output", output);
        entry.putObject("review").put("status", "待复核").put("note", "");
        return entry;
    }

    private static final class RunState {
        private final AtomicInteger activeRequests = new AtomicInteger();
        private long waitUntil;
        private final HashMap<Long, Integer> inputOrder = new HashMap<>();
        private long frozenElapsed = -1;
        private final ArrayDeque<WindowEvent> finishes = new ArrayDeque<>();
        private final ArrayDeque<WindowEvent> requestStarts = new ArrayDeque<>();
        private final ArrayDeque<WindowEvent> tokens = new ArrayDeque<>();
        private final Path output;
        private final Path statistics;
        private final long started = System.nanoTime();
        private final ObjectNode metrics = JSON.createObjectNode();
        private ObjectNode report;
        private boolean resultReserved;
        private final ArrayNode results = JSON.createArrayNode();
        private final ArrayNode successfulBatches = JSON.createArrayNode();
        private final ArrayNode batchLogs = JSON.createArrayNode();
        private final ArrayNode failedVideos = JSON.createArrayNode();

        RunState(Path output, Path statistics) { this.output = output; this.statistics = statistics; }

        void reserve() throws IOException {
            if (Files.exists(output) || Files.exists(statistics)) throw new IOException("结果或运行统计文件已存在，请指定新文件");
            Files.createDirectories(output.toAbsolutePath().getParent());
            metrics.put("schema_version", 1).put("report_type", "video_label_run").put("status", "initializing");
            metrics.put("result_file", output.getFileName().toString()).put("started_at", Instant.now().toString());
            metrics.put("max_retries", MAX_RETRIES).put("max_attempts_per_batch", MAX_RETRIES + 1);
            metrics.putNull("selected_count");
            metrics.put("usage_scope", "reported_usage仅累加接口实际返回的用量；缺失次数另记，不代表完整账单");
            metrics.set("batches", batchLogs); metrics.set("failed_videos", failedVideos);
            Files.writeString(statistics, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(metrics),
                    StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
        }

        void initialize(List<VideoInput> videos, int size) {
            metrics.put("status", "running").put("selected_count", videos.size()).put("batch_size", size);
            for (int i = 0; i < videos.size(); i++) inputOrder.put(videos.get(i).aid(), i);
            for (int offset = 0; offset < videos.size(); offset += size) {
                var batch = batchLogs.addObject();
                batch.put("batch_index", batchLogs.size()).put("status", "pending");
                var ids = batch.putArray("aids");
                videos.subList(offset, Math.min(offset + size, videos.size())).forEach(video -> ids.add(video.aid()));
                batch.putArray("attempts");
            }
            report = JSON.createObjectNode();
            report.put("schema_version", 1).put("source", "llm").put("selected_count", videos.size());
            report.put("processed_count", 0).put("status", "running");
            report.set("results", results); report.set("batches", successfulBatches);
        }

        void reserveResults() throws IOException {
            Files.createFile(output);
            resultReserved = true;
            atomicWrite(output, report);
        }

        void failBatch(ObjectNode batchLog, List<VideoInput> batch, JsonNode reason) {
            batchLog.put("status", "failed");
            batchLog.set("error", reason.deepCopy());
            for (VideoInput video : batch) {
                var failed = failedVideos.addObject().put("aid", video.aid()).put("batch_index", batchLog.path("batch_index").asInt());
                ObjectNode input = JSON.valueToTree(video); input.remove("aid"); failed.set("input", input);
                failed.set("error", reason.deepCopy());
            }
        }

        void sortResults() {
            var sorted = new ArrayList<JsonNode>();
            results.forEach(sorted::add);
            sorted.sort(Comparator.comparingInt(row -> inputOrder.get(row.path("aid").asLong())));
            results.removeAll(); sorted.forEach(results::add);
        }

        void persistBatch(int index) throws IOException {
            Path directory = output.resolveSibling(output.getFileName() + ".batches");
            Files.createDirectories(directory);
            atomicWrite(directory.resolve(String.format("%05d.json", index + 1)), batchLogs.get(index));
        }

        void persistResults() throws IOException {
            if (report != null && resultReserved) {
                sortResults();
                report.put("processed_count", results.size());
                if ("running".equals(report.path("status").asText()) && !results.isEmpty()) report.put("status", "partial");
                atomicWrite(output, report);
            }
        }

        void persist() throws IOException {
            metrics.set("summary", summarize());
            updateLiveMetrics();
            atomicWrite(statistics, metrics);
            atomicWrite(snapshotPath(output), snapshot());
        }

        void persistSnapshot() throws IOException {
            updateLiveMetrics();
            atomicWrite(snapshotPath(output), snapshot());
        }

        private ObjectNode snapshot() {
            var snapshot = metrics.deepCopy();
            snapshot.remove(List.of("batches", "failed_videos"));
            return snapshot;
        }

        private long windowSum(ArrayDeque<WindowEvent> events, long now) {
            while (!events.isEmpty() && events.peek().atMs() <= now - 60_000) events.remove();
            return events.stream().mapToLong(WindowEvent::value).sum();
        }

        private void updateLiveMetrics() {
            boolean terminal = metrics.has("finished_at");
            if (terminal && frozenElapsed < 0) frozenElapsed = elapsed(started);
            long now = frozenElapsed >= 0 ? frozenElapsed : elapsed(started);
            metrics.put("elapsed_ms", now).put("snapshot_at", Instant.now().toString()).put("active_requests", terminal ? 0 : activeRequests.get());
            long finished = windowSum(finishes, now);
            double windowMinutes = Math.max(1, Math.min(60_000, now)) / 60_000.0;
            var live = metrics.putObject("live");
            live.put("videos_per_minute", finished / windowMinutes);
            long knownTokens = windowSum(tokens, now);
            if (metrics.path("summary").path("reported_usage").path("total_tokens").isIntegralNumber())
                live.put("tpm", knownTokens / windowMinutes);
            else live.putNull("tpm");
            live.put("rpm", windowSum(requestStarts, now) / windowMinutes);
            int retries = 0;
            for (JsonNode batch : batchLogs) if ("retrying".equals(batch.path("status").asText())) retries++;
            live.put("waiting_retries", retries);
            int remaining = Math.max(0, metrics.path("selected_count").asInt() - results.size() - failedVideos.size());
            live.put("remaining_count", remaining);
            long budgetWait = Math.max(0, TimeUnit.NANOSECONDS.toMillis(waitUntil - System.nanoTime()));
            live.put("budget_wait_ms", budgetWait);
            live.putNull("eta_ms"); live.putNull("estimated_completion_at");
            int completedBatches = successfulBatches.size() + metrics.path("summary").path("failed_batches").asInt();
            boolean executing = !terminal && !"saving".equals(metrics.path("status").asText());
            String etaState = !executing || remaining == 0 || budgetWait > 10_000 ? "unavailable"
                    : now < 30_000 || completedBatches < 2
                    ? "warming_up" : finished == 0 ? "unavailable" : "available";
            live.put("eta_state", etaState);
            Long eta = estimateRemainingMs(now, completedBatches, remaining, finished, budgetWait, executing);
            if (eta != null) {
                live.put("eta_ms", eta).put("estimated_completion_at", Instant.now().plusMillis(eta).toString());
            }
        }

        ObjectNode summarize() {
            int succeededBatches = 0, failedBatches = 0, attemptCount = 0, failedAttempts = 0, retryCount = 0;
            var durations = new ArrayList<Long>();
            var usages = new ArrayList<JsonNode>();
            for (JsonNode batch : batchLogs) {
                if ("succeeded".equals(batch.path("status").asText())) succeededBatches++;
                if ("failed".equals(batch.path("status").asText())) failedBatches++;
                var attempts = batch.path("attempts");
                retryCount += Math.max(0, attempts.size() - 1);
                attemptCount += attempts.size();
                for (JsonNode attempt : attempts) {
                    if ("running".equals(attempt.path("status").asText())) continue;
                    if (!"succeeded".equals(attempt.path("status").asText())) failedAttempts++;
                    durations.add(attempt.path("elapsed_ms").asLong());
                    usages.add(attempt.path("usage"));
                }
            }
            var summary = JSON.createObjectNode();
            summary.put("succeeded_count", results.size()).put("failed_count", failedVideos.size());
            int selected = metrics.path("selected_count").asInt();
            summary.put("pending_count", Math.max(0, selected - results.size() - failedVideos.size()));
            summary.put("total_batches", batchLogs.size()).put("succeeded_batches", succeededBatches).put("failed_batches", failedBatches);
            summary.put("pending_batches", batchLogs.size() - succeededBatches - failedBatches);
            summary.put("request_attempt_count", attemptCount).put("finished_attempt_count", durations.size());
            summary.put("failed_attempt_count", failedAttempts).put("retry_count", retryCount);
            rate(summary, "request_failure_rate", failedAttempts, durations.size());
            rate(summary, "batch_failure_rate", failedBatches, succeededBatches + failedBatches);
            rate(summary, "video_failure_rate", failedVideos.size(), results.size() + failedVideos.size());
            if (durations.isEmpty()) {
                summary.putNull("request_elapsed_ms_total"); summary.putNull("request_elapsed_ms_avg"); summary.putNull("request_elapsed_ms_max");
            } else {
                summary.put("request_elapsed_ms_total", durations.stream().mapToLong(Long::longValue).sum());
                summary.put("request_elapsed_ms_avg", durations.stream().mapToLong(Long::longValue).average().orElseThrow());
                summary.put("request_elapsed_ms_max", durations.stream().mapToLong(Long::longValue).max().orElseThrow());
            }
            var totals = summary.putObject("reported_usage");
            var missing = summary.putObject("usage_missing_attempts");
            for (String key : List.of("prompt_tokens", "completion_tokens", "total_tokens")) {
                BigInteger sum = BigInteger.ZERO; int known = 0;
                for (JsonNode usage : usages) {
                    if (usage.path(key).isIntegralNumber()) { sum = sum.add(usage.path(key).bigIntegerValue()); known++; }
                }
                if (known == 0) totals.putNull(key); else totals.put(key, sum);
                missing.put(key, usages.size() - known);
            }
            var labels = summary.putObject("labels");
            var songs = labels.putObject("is_song");
            var voices = labels.putObject("is_virtual_singer");
            var languages = labels.putObject("languages");
            int virtualSongs = 0, chineseVirtualSongs = 0, uncertain = 0;
            for (JsonNode entry : results) {
                var label = entry.path("output");
                String song = label.path("is_song").asText(), voice = label.path("is_virtual_singer").asText();
                songs.put(song, songs.path(song).asInt() + 1);
                voices.put(voice, voices.path(voice).asInt() + 1);
                boolean chinese = false, unknownLanguage = false;
                for (JsonNode language : label.path("languages")) {
                    String value = language.asText();
                    languages.put(value, languages.path(value).asInt() + 1);
                    chinese |= "汉语".equals(value); unknownLanguage |= "未知语言".equals(value);
                }
                if ("是".equals(song) && "是".equals(voice)) { virtualSongs++; if (chinese) chineseVirtualSongs++; }
                if ("不确定".equals(song) || "不确定".equals(voice) || unknownLanguage) uncertain++;
            }
            labels.put("virtual_singer_songs", virtualSongs).put("chinese_virtual_singer_songs", chineseVirtualSongs).put("uncertain_count", uncertain);
            return summary;
        }

        private static void rate(ObjectNode summary, String key, int numerator, int denominator) {
            if (denominator == 0) summary.putNull(key); else summary.put(key, (double) numerator / denominator);
        }
    }

    private static void atomicWrite(Path path, JsonNode value) throws IOException {
        Path temp = Files.createTempFile(path.toAbsolutePath().getParent(), ".uniseek-", ".json.tmp");
        try {
            JSON.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), value);
            try { Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException e) { Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING); }
        } finally { Files.deleteIfExists(temp); }
    }

    private List<VideoInput> readVideos() throws IOException {
        var videos = new ArrayList<VideoInput>();
        var ids = new HashSet<Long>();
        try (var parser = JSON.getFactory().createParser(input.toFile())) {
            if (parser.nextToken() != JsonToken.START_ARRAY) throw new IOException("输入视频列表必须为JSON数组");
            while (videos.size() < limit && parser.nextToken() != JsonToken.END_ARRAY) {
                JsonNode row = JSON.readTree(parser);
                if (row == null || !row.isObject() || !row.path("aid").isIntegralNumber()
                        || !row.path("aid").canConvertToLong() || row.path("aid").longValue() <= 0
                        || !ids.add(row.path("aid").longValue())) {
                    throw new IOException("输入视频的aid缺失、无效或重复");
                }
                videos.add(new VideoInput(row.path("aid").longValue(), nullableText(row.get("title")),
                        tags(row.get("tag_new")), nullableText(row.get("description"))));
            }
        }
        if (videos.isEmpty()) throw new IOException("输入视频列表为空");
        return List.copyOf(videos);
    }

    private static String nullableText(JsonNode node) throws IOException {
        if (node == null || node.isNull()) return null;
        if (!node.isTextual()) throw new IOException("视频标题和简介必须为字符串或null");
        return node.textValue();
    }

    private static List<String> tags(JsonNode node) throws IOException {
        if (node == null || node.isNull()) return null;
        if (!node.isArray()) throw new IOException("视频tag_new必须为字符串数组或null");
        var tags = new ArrayList<String>();
        for (JsonNode value : node) {
            if (!value.isTextual()) throw new IOException("视频标签必须为字符串");
            tags.add(value.textValue());
        }
        return List.copyOf(tags);
    }
}
