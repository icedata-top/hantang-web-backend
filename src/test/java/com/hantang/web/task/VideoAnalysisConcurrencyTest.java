package com.hantang.web.task;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.api.LlmClient;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class VideoAnalysisConcurrencyTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    @TempDir Path directory;
    private HttpServer server;
    private ExecutorService serverWorkers;

    @AfterEach void stop() {
        if (server != null) server.stop(0);
        if (serverWorkers != null) serverWorkers.shutdownNow();
    }

    private Path config() throws Exception {
        Path config = directory.resolve("llm.properties");
        Files.writeString(config, "llm.model=test-qwen3\nllm.api_key=local-test-key\nllm.base_url=http://127.0.0.1:"
                + server.getAddress().getPort() + "\nllm.execution_tpm=100000000\n");
        return config;
    }

    private String reply(JsonNode videos) throws Exception {
        var labels = JSON.createArrayNode();
        for (JsonNode video : videos) labels.addObject().put("aid", video.path("aid").asLong())
                .put("is_song", "是").put("is_virtual_singer", "是").putArray("languages").add("汉语");
        var body = JSON.createObjectNode();
        body.putArray("choices").addObject().put("finish_reason", "stop").putObject("message").put("content", labels.toString());
        body.putObject("usage").put("prompt_tokens", 100).put("completion_tokens", 35).put("total_tokens", 135);
        return body.toString();
    }

    @Test void all1000VideosOverlapWithinChosenLimitAndMergeInOriginalOrder() throws Exception {
        var active = new AtomicInteger();
        var peak = new AtomicInteger();
        var calls = new AtomicInteger();
        var firstWave = new CountDownLatch(4);
        var completionOrder = Collections.synchronizedList(new ArrayList<Long>());
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        serverWorkers = Executors.newCachedThreadPool(); server.setExecutor(serverWorkers);
        server.createContext("/chat/completions", exchange -> {
            int inFlight = active.incrementAndGet(); peak.accumulateAndGet(inFlight, Math::max);
            int call = calls.incrementAndGet();
            try {
                var body = JSON.readTree(exchange.getRequestBody());
                var videos = JSON.readTree(body.path("messages").get(1).path("content").asText());
                if (call <= 4) { firstWave.countDown(); assertTrue(firstWave.await(5, TimeUnit.SECONDS)); }
                Thread.sleep(call == 1 ? 250 : 10);
                completionOrder.add(videos.get(0).path("aid").asLong());
                byte[] bytes = reply(videos).getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (Exception e) { throw new RuntimeException(e); }
            finally { active.decrementAndGet(); exchange.close(); }
        });
        server.start();
        Path input = Path.of("script/uniseek/uniseek_videos.json");
        var expected = JSON.readTree(input.toFile());
        Path output = directory.resolve("predictions.json");
        try (var client = LlmClient.fromConfig(config())) {
            new VideoTypeAndLanguageAnalysisTask(client, input, output, 1000, 20, 4).run();
        }
        assertEquals(4, peak.get());
        assertEquals(50, calls.get());
        assertNotEquals(expected.get(0).path("aid").asLong(), completionOrder.get(0));
        var results = JSON.readTree(output.toFile());
        assertEquals(1000, results.path("processed_count").asInt());
        for (int i = 0; i < 1000; i++) assertEquals(expected.get(i).path("aid"), results.path("results").get(i).path("aid"));
        var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
        assertEquals("completed", stats.path("status").asText());
        assertEquals(4, stats.path("concurrency").asInt());
        assertEquals(0, stats.path("active_requests").asInt());
        assertEquals(1000, stats.path("summary").path("succeeded_count").asInt());
        assertEquals(6750, stats.path("summary").path("reported_usage").path("total_tokens").asInt());
        assertEquals(1000, stats.path("summary").path("labels").path("chinese_virtual_singer_songs").asInt());
        assertTrue(stats.path("live").path("eta_ms").isNull());
        var snapshot = JSON.readTree(VideoTypeAndLanguageAnalysisTask.snapshotPath(output).toFile());
        assertFalse(snapshot.has("batches")); assertFalse(snapshot.has("failed_videos"));
        assertEquals(stats.path("summary"), snapshot.path("summary"));
        assertTrue(Files.size(VideoTypeAndLanguageAnalysisTask.snapshotPath(output)) < 16000);
        try (var batches = Files.list(directory.resolve("predictions.json.batches"))) { assertEquals(50, batches.count()); }
        assertEquals(20, JSON.readTree(directory.resolve("predictions.json.batches/00001.json").toFile()).path("results").size());
    }

    @Test void retryDelayFreesTheOnlyHttpSlotAndCountsEachVideoOnce() throws Exception {
        var order = new ArrayList<Long>();
        var firstAttempts = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/chat/completions", exchange -> {
            try {
                var request = JSON.readTree(exchange.getRequestBody());
                var videos = JSON.readTree(request.path("messages").get(1).path("content").asText());
                long aid = videos.get(0).path("aid").asLong(); order.add(aid);
                boolean retry = aid == 1 && firstAttempts.incrementAndGet() == 1;
                String response = retry ? "{}" : reply(videos);
                if (retry) exchange.getResponseHeaders().set("Retry-After", "1");
                byte[] bytes = response.getBytes(java.nio.charset.StandardCharsets.UTF_8);
                exchange.sendResponseHeaders(retry ? 429 : 200, bytes.length);
                exchange.getResponseBody().write(bytes);
            } catch (Exception e) { throw new RuntimeException(e); }
            finally { exchange.close(); }
        });
        server.start();
        Path input = directory.resolve("input.json"); Files.writeString(input, "[{\"aid\":1},{\"aid\":2},{\"aid\":3}]");
        Path output = directory.resolve("retry.json");
        try (var client = LlmClient.fromConfig(config())) {
            new VideoTypeAndLanguageAnalysisTask(client, input, output, 3, 1, 1).run();
        }
        assertEquals(List.of(1L, 2L, 3L, 1L), order);
        var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
        var summary = stats.path("summary");
        assertEquals(3, summary.path("succeeded_count").asInt());
        assertEquals(0, summary.path("failed_count").asInt());
        assertEquals(1, summary.path("retry_count").asInt());
        assertEquals(4, summary.path("request_attempt_count").asInt());
        assertEquals(1, summary.path("usage_missing_attempts").path("total_tokens").asInt());
        var rows = JSON.readTree(output.toFile()).path("results");
        assertEquals(List.of(1L, 2L, 3L), List.of(rows.get(0).path("aid").asLong(), rows.get(1).path("aid").asLong(), rows.get(2).path("aid").asLong()));
    }

    @Test void failedBatchCheckpointStopsBeforeAnyPaidRequest() throws Exception {
        Path input = directory.resolve("input.json"); Files.writeString(input, "[{\"aid\":1}]");
        Path output = directory.resolve("blocked.json");
        Files.writeString(directory.resolve("blocked.json.batches"), "cannot be a directory");
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var calls = new AtomicInteger();
        server.createContext("/chat/completions", exchange -> { calls.incrementAndGet(); exchange.close(); });
        server.start();
        try (var client = LlmClient.fromConfig(config())) {
            assertThrows(java.io.UncheckedIOException.class, () -> new VideoTypeAndLanguageAnalysisTask(client, input, output, 1, 1, 4).run());
        }
        assertEquals(0, calls.get());
        var snapshot = JSON.readTree(VideoTypeAndLanguageAnalysisTask.snapshotPath(output).toFile());
        assertEquals("failed", snapshot.path("status").asText());
        assertEquals(0, snapshot.path("summary").path("succeeded_count").asInt());
    }

    @Test void sharedBudgetRetainsUnknownUsageAndReconcilesActualUsageAcrossWorkers() {
        var budget = new LlmRequestBudget(100, 2);
        var first = budget.reserve(0, 70);
        assertEquals(60000, budget.waitMs(0, 40));
        budget.reconcile(first, null);
        assertEquals(59900, budget.waitMs(100, 40));
        budget.reconcile(first, 10L);
        assertEquals(0, budget.waitMs(100, 40));
        budget.reserve(100, 40);
        assertEquals(59900, budget.waitMs(100, 1)); // RPM also applies to retries.
        assertEquals(0, budget.waitMs(60000, 40));
        assertThrows(IllegalArgumentException.class, () -> budget.waitMs(60000, 101));
    }

    @Test void etaUsesActualStartupWindowAndBecomesUnknownWhenNoOutputOrLongRateWaitOccurs() {
        assertNull(VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(29999, 2, 960, 40, 0, true));
        assertNull(VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(30000, 1, 980, 20, 0, true));
        assertEquals(720000L, VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(30000, 2, 960, 40, 0, true));
        assertEquals(1440000L, VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(90000, 2, 960, 40, 0, true));
        assertNull(VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(90000, 2, 960, 0, 0, true));
        assertNull(VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(90000, 2, 960, 40, 10001, true));
        assertNull(VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(90000, 2, 0, 40, 0, true));
        assertNull(VideoTypeAndLanguageAnalysisTask.estimateRemainingMs(90000, 2, 960, 40, 0, false));
    }
}
