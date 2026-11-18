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
    private final int batchSize;
    private boolean hasFailures;

    /** A null client loads the private configuration only after output files are reserved. */
    public VideoTypeAndLanguageAnalysisTask(LlmClient client, Path input, Path output, int limit, int batchSize) {
        if (limit < 1 || batchSize < 1 || batchSize > 50) {
            throw new IllegalArgumentException("处理上限必须大于0，单批大小必须为1至50");
        }
        this.client = client; this.input = input; this.output = output;
        this.limit = limit; this.batchSize = batchSize;
    }

    /** Optional arguments: input.json output.json limit batchSize. The default limit is ONE video. */
    public static void main(String[] args) {
        if (args.length > 4 || (args.length > 0 && "--help".equals(args[0]))) {
            System.out.println("参数：[输入JSON] [输出JSON] [处理上限，默认1] [每批条数，默认20，上限50]；每批最多重试2次");
            return;
        }
        try {
            Path input = Path.of(args.length > 0 ? args[0] : "script/uniseek/uniseek_videos.json");
            Path output = Path.of(args.length > 1 ? args[1] : "target/uniseek/analysis-" + UUID.randomUUID() + ".json");
            int limit = args.length > 2 ? Integer.parseInt(args[2]) : 1;
            int batchSize = args.length > 3 ? Integer.parseInt(args[3]) : 20;
            var task = new VideoTypeAndLanguageAnalysisTask(null, input, output, limit, batchSize);
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
            for (int offset = 0, batchIndex = 0; offset < videos.size(); offset += batchSize, batchIndex++) {
                var batch = videos.subList(offset, Math.min(offset + batchSize, videos.size()));
                var batchLog = (ObjectNode) state.batchLogs.get(batchIndex);
                for (int number = 1; number <= MAX_RETRIES + 1; number++) {
                    if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                    batchLog.put("status", "running");
                    var attempt = batchLog.withArray("attempts").addObject();
                    attempt.put("attempt", number).put("status", "running").put("started_at", Instant.now().toString());
                    attempt.set("usage", JSON.valueToTree(new TokenUsage(null, null, null)));
                    stage = "checkpoint";
                    state.persist();
                    long started = System.nanoTime();
                    boolean success = false;
                    try {
                        var response = activeClient.analyze(batch, prompt);
                        for (int i = 0; i < response.results().size(); i++) {
                            state.results.add(reviewEntry(batch.get(i), response.results().get(i)));
                        }
                        var summary = state.successfulBatches.addObject();
                        summary.put("count", response.results().size()).put("elapsed_ms", response.elapsedMs());
                        summary.set("usage", JSON.valueToTree(response.usage()));
                        attempt.put("status", "succeeded").put("http_status", 200);
                        attempt.set("usage", JSON.valueToTree(response.usage()));
                        batchLog.put("status", "succeeded");
                        success = true;
                    } catch (IOException e) {
                        attempt.put("status", "failed");
                        if (e instanceof AnalysisException failure) {
                            attempt.set("error", error(failure.stage(), failure.code(), failure.httpStatus(), failure.responseShape()));
                            attempt.set("usage", JSON.valueToTree(failure.usage()));
                            if (failure.httpStatus() != null) attempt.put("http_status", failure.httpStatus());
                            if (failure.rawModelOutput() != null) attempt.put("raw_model_output", failure.rawModelOutput());
                        } else attempt.set("error", error("request", "CLIENT_IO_ERROR", null, null));
                    } catch (InterruptedException e) {
                        finishAttempt(attempt, started);
                        attempt.put("status", "interrupted");
                        attempt.set("error", error("interrupted", "INTERRUPTED", null, null));
                        state.failBatch(batchLog, batch, attempt.path("error"));
                        throw e;
                    }
                    finishAttempt(attempt, started);
                    if (!success && number == MAX_RETRIES + 1) state.failBatch(batchLog, batch, attempt.path("error"));
                    else if (!success) batchLog.put("status", "retrying");
                    // Persistence failures are fatal, not API errors to retry and pay for again.
                    stage = "checkpoint";
                    state.persist();
                    System.out.printf("批次 %d/%d，尝试 %d/%d：%s；成功 %d 条，失败 %d 条%n",
                            batchIndex + 1, state.batchLogs.size(), number, MAX_RETRIES + 1,
                            success ? "成功" : batchLog.path("status").asText(), state.results.size(), state.failedVideos.size());
                    if (success) break;
                    if (number <= MAX_RETRIES) {
                        try { Thread.sleep(number * 1000L); }
                        catch (InterruptedException e) {
                            state.failBatch(batchLog, batch, error("interrupted", "INTERRUPTED", null, null));
                            throw e;
                        }
                    }
                }
            }
            hasFailures = !state.failedVideos.isEmpty();
            state.report.put("status", !hasFailures ? "completed" : state.results.isEmpty() ? "failed" : "partial");
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
            try { state.persist(); }
            catch (IOException writeFailure) { e.addSuppressed(writeFailure); }
            finally { if (interrupted && !(e instanceof InterruptedException)) Thread.currentThread().interrupt(); }
            throw e;
        } finally {
            if (client == null && activeClient != null) activeClient.close();
        }
    }

    private static void finishAttempt(ObjectNode attempt, long started) {
        attempt.put("finished_at", Instant.now().toString());
        attempt.put("elapsed_ms", elapsed(started));
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

        void persist() throws IOException {
            if (report != null && resultReserved) {
                report.put("processed_count", results.size());
                if ("running".equals(report.path("status").asText()) && !results.isEmpty()) report.put("status", "partial");
                atomicWrite(output, report);
            }
            metrics.put("elapsed_ms", elapsed(started));
            metrics.set("summary", summarize());
            atomicWrite(statistics, metrics);
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
            return summary;
        }

        private static void rate(ObjectNode summary, String key, int numerator, int denominator) {
            if (denominator == 0) summary.putNull(key); else summary.put(key, (double) numerator / denominator);
        }
    }

    private static void atomicWrite(Path path, JsonNode value) throws IOException {
        Path temp = Files.createTempFile(path.toAbsolutePath().getParent(), ".uniseek-", ".json.tmp");
        try {
            Files.writeString(temp, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(value), StandardCharsets.UTF_8);
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
