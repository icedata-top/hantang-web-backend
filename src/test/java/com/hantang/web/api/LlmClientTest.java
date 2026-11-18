package com.hantang.web.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.hantang.web.task.VideoTypeAndLanguageAnalysisTask;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BiFunction;

import static org.junit.jupiter.api.Assertions.*;

class LlmClientTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String FAKE_KEY = "test-secret-never-log";
    private static final long AID = 116282565529774L;
    @TempDir Path temporary;
    private HttpServer server;
    private final AtomicInteger calls = new AtomicInteger();
    private final AtomicInteger status = new AtomicInteger(200);
    private final AtomicReference<String> response = new AtomicReference<>();
    private final AtomicReference<JsonNode> request = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> redirect = new AtomicReference<>();
    private final AtomicReference<Map<Long, JsonNode>> replayLabels = new AtomicReference<>();
    private final AtomicReference<BiFunction<Integer, JsonNode, Reply>> scenario = new AtomicReference<>();

    private record Reply(int status, String body) { }

    @BeforeEach
    void startServer() throws Exception {
        response.set(envelope(labels(AID), "stop"));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            int call = calls.incrementAndGet();
            request.set(JSON.readTree(exchange.getRequestBody()));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            if (redirect.get() != null) exchange.getResponseHeaders().set("Location", redirect.get());
            String responseBody = response.get();
            var replay = replayLabels.get();
            if (replay != null) {
                var selected = JSON.readTree(request.get().path("messages").get(1).path("content").asText());
                var labels = JSON.createArrayNode();
                for (JsonNode video : selected) {
                    long aid = video.path("aid").longValue();
                    ObjectNode label = replay.get(aid).deepCopy();
                    label.put("aid", aid);
                    labels.add(label);
                }
                responseBody = envelope(labels.toString(), "stop");
            }
            int statusCode = status.get();
            if (scenario.get() != null) {
                var reply = scenario.get().apply(call, request.get());
                statusCode = reply.status(); responseBody = reply.body();
            }
            byte[] body = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(statusCode, body.length);
            try (var stream = exchange.getResponseBody()) {
                stream.write(body);
            }
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void readsOnlySelectedVideoSendsRequiredFieldsAndWritesParsedReport() throws Exception {
        response.set(envelope("```json\n" + labels(AID) + "\n```", "stop"));
        Path input = temporary.resolve("videos.json");
        Files.writeString(input, """
                [{"aid":116282565529774,"title":"测试","tag_new":null,"description":"第一行\\n第二行","label_singers":["不得发送"]},
                 {"aid":2,"title":"不能发送的第二条","tag_new":[],"description":""}]
                """);
        Path output = temporary.resolve("output.json");
        try (var client = client(false)) {
            new VideoTypeAndLanguageAnalysisTask(client, input, output, 1, 20).run();
            assertFalse(client.toString().contains(FAKE_KEY));
        }
        assertEquals(1, calls.get());
        assertEquals("Bearer " + FAKE_KEY, authorization.get());
        var body = request.get();
        assertEquals("test-model", body.path("model").asText());
        assertFalse(body.path("stream").asBoolean());
        assertFalse(body.path("enable_thinking").asBoolean());
        assertEquals(512, body.path("max_completion_tokens").asInt());
        assertTrue(body.path("messages").get(0).path("content").asText().contains("三个独立属性"));
        assertFalse(body.toString().contains(FAKE_KEY));
        var selected = JSON.readTree(body.path("messages").get(1).path("content").asText());
        assertEquals(1, selected.size());
        assertEquals(AID, selected.get(0).path("aid").longValue());
        assertTrue(selected.get(0).path("tag_new").isNull());
        assertFalse(selected.get(0).has("label_singers"));
        assertEquals("第一行\n第二行", selected.get(0).path("description").asText());
        var report = JSON.readTree(Files.readString(output));
        assertEquals(1, report.path("schema_version").intValue());
        assertEquals("llm", report.path("source").asText());
        assertEquals("completed", report.path("status").asText());
        assertEquals(1, report.path("processed_count").intValue());
        assertEquals(AID, report.path("results").get(0).path("aid").longValue());
        var entry = report.path("results").get(0);
        assertEquals("不确定", entry.path("output").path("is_virtual_singer").asText());
        assertEquals("第一行\n第二行", entry.path("input").path("description").asText());
        assertFalse(entry.path("input").has("aid"));
        assertFalse(entry.path("output").has("aid"));
        assertEquals("待复核", entry.path("review").path("status").asText());
        assertEquals("", entry.path("review").path("note").asText());
        assertEquals(135, report.path("batches").get(0).path("usage").path("total_tokens").intValue());
        assertFalse(Files.readString(output).contains(FAKE_KEY));
        var attempt = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile())
                .path("batches").get(0).path("attempts").get(0);
        assertEquals("succeeded", attempt.path("status").asText());
        assertFalse(attempt.has("raw_model_output"));
    }

    @Test
    void allReferenceAnswersRoundTripThroughTheTaskWithoutChangingIdsInputsOrOutputContract() throws Exception {
        Path input = Path.of("script/uniseek/uniseek_videos.json");
        var videos = JSON.readTree(input.toFile());
        var reference = JSON.readTree(Path.of("script/uniseek/reference_answers.json").toFile());
        var expected = reference.path("results");
        assertEquals(1000, videos.size());
        assertEquals(videos.size(), expected.size());
        assertEquals(expected.size(), reference.path("selected_count").asInt());
        assertEquals(expected.size(), reference.path("processed_count").asInt());
        assertEquals("completed", reference.path("status").asText());
        var replay = new HashMap<Long, JsonNode>();
        for (int i = 0; i < videos.size(); i++) {
            ObjectNode original = videos.get(i).deepCopy();
            long aid = original.remove("aid").longValue();
            assertEquals(aid, expected.get(i).path("aid").longValue());
            assertEquals(original, expected.get(i).path("input"), "输入元数据必须原样保留");
            assertNull(replay.put(aid, expected.get(i).path("output")), "aid不能重复");
        }
        replayLabels.set(replay);
        Path output = temporary.resolve("all-results.json");
        try (var client = client(false)) {
            new VideoTypeAndLanguageAnalysisTask(client, input, output, 1000, 50).run();
        }
        var actual = JSON.readTree(output.toFile());
        assertEquals(20, calls.get());
        assertEquals(reference.path("schema_version"), actual.path("schema_version"));
        assertEquals("llm", actual.path("source").asText());
        assertEquals("completed", actual.path("status").asText());
        assertEquals(1000, actual.path("processed_count").asInt());
        assertEquals(20, actual.path("batches").size());
        assertEquals(reference.size(), actual.size());
        reference.fieldNames().forEachRemaining(field -> assertTrue(actual.has(field)));
        for (int i = 0; i < expected.size(); i++) {
            var entry = actual.path("results").get(i);
            assertEquals(expected.get(i).path("aid"), entry.path("aid"));
            assertEquals(expected.get(i).path("input"), entry.path("input"));
            assertEquals(expected.get(i).path("output"), entry.path("output"));
            assertEquals(4, entry.size());
            assertEquals("待复核", entry.path("review").path("status").asText());
            assertEquals("", entry.path("review").path("note").asText());
        }
        assertFalse(Files.readString(output).contains(FAKE_KEY));
    }

    @Test
    void acceptsOneCompleteCodeFenceWithOrWithoutJsonLanguageAndWithSurroundingWhitespace() throws Exception {
        String valid = labels(AID);
        try (var client = client(false)) {
            for (String content : List.of(valid, "```json\n" + valid + "\n```", "```\n" + valid + "\n```",
                    " \r\n```JSON \t\r\n" + valid + "\r\n  ```\r\n ")) {
                response.set(envelope(content, "stop"));
                var parsed = client.analyze(videos(), "test prompt");
                assertEquals(AID, parsed.results().get(0).aid());
                assertEquals(135, parsed.usage().totalTokens());
            }
        }
        assertEquals(4, calls.get());
    }

    @Test
    void rejectsWrongIdsIncompleteOutputsAndInvalidLabels() throws Exception {
        String valid = labels(AID);
        var invalid = List.of(labels(2), "[]", "{}", valid + " trailing",
                valid.replace("\"否\"", "false"), valid.replace("\"否\"", "\"不是\""),
                valid.replace("\"未知语言\"", "\"韩语\""), valid.replace("\"未知语言\"", "\"英语\",\"英语\""),
                valid.replace("\"未知语言\"", "\"无语言\",\"英语\""),
                valid.replace("\"aid\":", "\"extra\":true,\"aid\":"),
                "```json\n" + valid,
                "```json\n" + valid + "\n```\n解释",
                "解释\n```json\n" + valid + "\n```",
                "```json\n" + valid + "\n```\n```json\n" + valid + "\n```",
                "```json\n```json\n" + valid + "\n```\n```",
                "```javascript\n" + valid + "\n```",
                "```json\n" + labels(2) + "\n```",
                "```json\n" + valid + " trailing\n```",
                valid.replace("\"is_song\":\"否\"", "\"is_song\":\"是\",\"is_song\":\"否\""));
        try (var client = client(true)) {
            for (String content : invalid) {
                response.set(envelope(content, "stop"));
                assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt"));
            }
            response.set(envelope(valid, "length"));
            assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt"));
            response.set(envelope("", "stop"));
            assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt"));
        }
    }

    @Test
    void neverIncludesProviderErrorOrMalformedBodyInExceptions() throws Exception {
        try (var client = client(false)) {
            status.set(401);
            response.set("rejected secret: " + FAKE_KEY);
            var failure = assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt"));
            assertTrue(failure.getMessage().contains("401"));
            assertSecretAbsent(failure);
            status.set(200);
            response.set(FAKE_KEY);
            assertSecretAbsent(assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt")));
            response.set(envelope(FAKE_KEY, "stop"));
            assertSecretAbsent(assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt")));
        }
    }

    @Test
    void exhaustedBatchIsPersistedAfterAtMostTwoRetriesWithoutFalseBusinessLabels() throws Exception {
        status.set(429);
        response.set(FAKE_KEY);
        Path output = temporary.resolve("failed.json");
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1);
            task.run();
            assertTrue(task.hasFailures());
        }
        var report = JSON.readTree(Files.readString(output));
        assertEquals("failed", report.path("status").asText());
        assertEquals(0, report.path("processed_count").asInt());
        assertTrue(report.path("results").isEmpty());
        assertEquals(3, calls.get());
        var metrics = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
        assertEquals("completed_with_failures", metrics.path("status").asText());
        assertEquals(1, metrics.path("failed_videos").size());
        assertEquals(AID, metrics.path("failed_videos").get(0).path("aid").asLong());
        assertFalse(metrics.path("failed_videos").get(0).has("output"));
        assertEquals(1.0, metrics.path("summary").path("request_failure_rate").asDouble());
        assertEquals(1.0, metrics.path("summary").path("video_failure_rate").asDouble());
        assertEquals(2, metrics.path("summary").path("retry_count").asInt());
        assertTrue(metrics.path("summary").path("reported_usage").path("total_tokens").isNull());
        assertEquals(3, metrics.path("summary").path("usage_missing_attempts").path("total_tokens").asInt());
        for (JsonNode attempt : metrics.path("batches").get(0).path("attempts")) assertFalse(attempt.has("raw_model_output"));
        assertFalse(metrics.toString().contains(FAKE_KEY));
        assertFalse(Files.readString(output).contains(FAKE_KEY));
    }

    @Test
    void retriesRecoverAndPersistEveryAttemptIncludingReturnedErrorUsage() throws Exception {
        var errorBody = JSON.createObjectNode();
        errorBody.put("error", FAKE_KEY);
        errorBody.putObject("usage").put("prompt_tokens", 10).put("completion_tokens", 5).put("total_tokens", 15);
        scenario.set((call, body) -> call < 3 ? new Reply(503, errorBody.toString()) : new Reply(200, response.get()));
        Path output = temporary.resolve("recovered.json");
        var durableBeforeRequest = new AtomicBoolean(true);
        var reply = scenario.get();
        scenario.set((call, body) -> {
            try {
                var report = JSON.readTree(output.toFile());
                var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
                if (!report.path("results").isArray() || stats.path("batches").get(0).path("attempts").size() != call)
                    durableBeforeRequest.set(false);
            } catch (IOException e) { durableBeforeRequest.set(false); }
            return reply.apply(call, body);
        });
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1);
            task.run();
            assertFalse(task.hasFailures());
        }
        assertTrue(durableBeforeRequest.get());
        assertEquals(3, calls.get());
        var result = JSON.readTree(output.toFile());
        var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
        assertEquals("completed", result.path("status").asText());
        assertEquals(1, result.path("results").size());
        assertEquals("completed", stats.path("status").asText());
        var summary = stats.path("summary");
        assertEquals(2.0 / 3, summary.path("request_failure_rate").asDouble(), 1e-9);
        assertEquals(0.0, summary.path("batch_failure_rate").asDouble());
        assertEquals(165, summary.path("reported_usage").path("total_tokens").asInt());
        assertEquals(0, summary.path("usage_missing_attempts").path("total_tokens").asInt());
        assertEquals(3, stats.path("batches").get(0).path("attempts").size());
        assertTrue(summary.path("request_elapsed_ms_total").asLong() >= summary.path("request_elapsed_ms_max").asLong());
        assertTrue(stats.path("elapsed_ms").asLong() >= summary.path("request_elapsed_ms_total").asLong());
        assertFalse(stats.toString().contains(FAKE_KEY));
    }

    @Test
    void exhaustedBatchDoesNotBlockLaterBatchesAndLabelParseFailuresKeepTheirUsage() throws Exception {
        Path input = temporary.resolve("three.json");
        Files.writeString(input, """
                [{"aid":1,"title":"失败项","tag_new":[],"description":"保留原始输入"},
                 {"aid":2,"title":"成功项2","tag_new":null,"description":""},
                 {"aid":3,"title":"成功项3","tag_new":[],"description":null}]
                """);
        scenario.set((call, body) -> {
            try {
                long aid = JSON.readTree(body.path("messages").get(1).path("content").asText()).get(0).path("aid").asLong();
                return new Reply(200, envelope(aid == 1 ? "```json\n[invalid labels]\n```" : labels(aid), "stop"));
            } catch (IOException e) { throw new UncheckedIOException(e); }
        });
        Path output = temporary.resolve("continued.json");
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input, output, 3, 1);
            task.run();
            assertTrue(task.hasFailures());
        }
        assertEquals(5, calls.get());
        var report = JSON.readTree(output.toFile());
        assertEquals("partial", report.path("status").asText());
        assertEquals(3, report.path("selected_count").asInt());
        assertEquals(2, report.path("processed_count").asInt());
        assertEquals(List.of(2L, 3L), List.of(report.path("results").get(0).path("aid").asLong(), report.path("results").get(1).path("aid").asLong()));
        var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
        var summary = stats.path("summary");
        assertEquals(1, summary.path("failed_count").asInt());
        assertEquals(0, summary.path("pending_count").asInt());
        assertEquals(3, summary.path("total_batches").asInt());
        assertEquals(2, summary.path("succeeded_batches").asInt());
        assertEquals(1, summary.path("failed_batches").asInt());
        assertEquals(3.0 / 5, summary.path("request_failure_rate").asDouble(), 1e-9);
        assertEquals(1.0 / 3, summary.path("batch_failure_rate").asDouble(), 1e-9);
        assertEquals(1.0 / 3, summary.path("video_failure_rate").asDouble(), 1e-9);
        assertEquals(675, summary.path("reported_usage").path("total_tokens").asInt());
        var failed = stats.path("failed_videos").get(0);
        assertEquals(1, failed.path("aid").asInt());
        assertEquals("保留原始输入", failed.path("input").path("description").asText());
        assertFalse(failed.has("output"));
        assertEquals("label_json", failed.path("error").path("stage").asText());
        assertEquals("markdown", failed.path("error").path("response_shape").asText());
        for (JsonNode attempt : stats.path("batches").get(0).path("attempts")) {
            assertEquals("```json\n[invalid labels]\n```", attempt.path("raw_model_output").asText());
        }
        assertFalse(failed.path("error").has("raw_model_output"));
        assertFalse(stats.path("batches").get(0).path("error").has("raw_model_output"));
        assertFalse(stats.toString().contains(FAKE_KEY));
    }

    @Test
    void recoveredBatchKeepsFailedModelTextWithCredentialRedacted() throws Exception {
        String invalid = "```json\n排查用原文：" + FAKE_KEY + "\n```";
        scenario.set((call, body) -> {
            try { return new Reply(200, envelope(call == 1 ? invalid : labels(AID), "stop")); }
            catch (IOException e) { throw new UncheckedIOException(e); }
        });
        Path output = temporary.resolve("raw-recovered.json");
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1);
            task.run();
            assertFalse(task.hasFailures());
        }
        assertEquals(2, calls.get());
        var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
        assertEquals("completed", stats.path("status").asText());
        var attempts = stats.path("batches").get(0).path("attempts");
        assertEquals(invalid.replace(FAKE_KEY, "[REDACTED]"), attempts.get(0).path("raw_model_output").asText());
        assertFalse(attempts.get(1).has("raw_model_output"));
        assertFalse(stats.toString().contains(FAKE_KEY));
    }

    @Test
    void failureStagesDistinguishResponseJsonFromLabelsAndValidationWithoutExposingBodies() throws Exception {
        try (var client = client(false)) {
            response.set("<html>" + FAKE_KEY + "</html>");
            var responseError = assertThrows(LlmClient.AnalysisException.class, () -> client.analyze(videos(), "test"));
            assertEquals("response_json", responseError.stage());
            assertEquals("html", responseError.responseShape());
            assertNull(responseError.usage().totalTokens());
            assertNull(responseError.rawModelOutput());
            assertSecretAbsent(responseError);
            response.set(envelope(FAKE_KEY, "stop"));
            var labelError = assertThrows(LlmClient.AnalysisException.class, () -> client.analyze(videos(), "test"));
            assertEquals("label_json", labelError.stage());
            assertEquals(135, labelError.usage().totalTokens());
            assertEquals("[REDACTED]", labelError.rawModelOutput());
            assertSecretAbsent(labelError);
            response.set(envelope(labels(2), "stop"));
            var validation = assertThrows(LlmClient.AnalysisException.class, () -> client.analyze(videos(), "test"));
            assertEquals("label_validation", validation.stage());
            assertEquals(135, validation.usage().totalTokens());
            assertEquals(labels(2), validation.rawModelOutput());
            response.set(envelope("```json\n[{\"aid\":", "length"));
            var incomplete = assertThrows(LlmClient.AnalysisException.class, () -> client.analyze(videos(), "test"));
            assertEquals("OUTPUT_INCOMPLETE", incomplete.code());
            assertEquals("```json\n[{\"aid\":", incomplete.rawModelOutput());
            assertFalse(incomplete.getMessage().contains("```"));
        }
    }

    @Test
    void taskMissingUsageStaysUnknownAndInvalidInputStillLeavesADurableFailureRecord() throws Exception {
        var body = (ObjectNode) JSON.readTree(response.get());
        body.remove("usage"); response.set(body.toString());
        Path output = temporary.resolve("no-usage.json");
        try (var client = client(false)) {
            new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1).run();
            var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
            assertTrue(stats.path("summary").path("reported_usage").path("total_tokens").isNull());
            assertEquals(1, stats.path("summary").path("usage_missing_attempts").path("total_tokens").asInt());
            Path invalid = temporary.resolve("bad-input.json");
            Files.writeString(invalid, "[{\"aid\":1.5}]");
            Path badOutput = temporary.resolve("bad-result.json");
            assertThrows(UncheckedIOException.class, () -> new VideoTypeAndLanguageAnalysisTask(client, invalid, badOutput, 1, 1).run());
            var failure = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(badOutput).toFile());
            assertEquals("failed", failure.path("status").asText());
            assertEquals("input", failure.path("fatal_error").path("stage").asText());
            assertEquals(0, failure.path("summary").path("request_attempt_count").asInt());
            assertTrue(failure.path("summary").path("request_failure_rate").isNull());
            assertFalse(Files.exists(badOutput));
        }
        assertEquals(1, calls.get());
    }

    @Test
    void statisticsFileCollisionAlsoPreventsCallingTheModelOrOverwritingData() throws Exception {
        Path output = temporary.resolve("collision.json");
        Path stats = VideoTypeAndLanguageAnalysisTask.statisticsPath(output);
        Files.writeString(stats, "keep stats");
        try (var client = client(false)) {
            assertThrows(UncheckedIOException.class, () -> new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1).run());
        }
        assertEquals("keep stats", Files.readString(stats));
        assertFalse(Files.exists(output));
        assertEquals(0, calls.get());
    }

    @Test
    void interruptionPersistsTheInFlightFailureAndPendingBatchesWithoutFurtherRequests() throws Exception {
        var arrived = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        scenario.set((call, body) -> {
            arrived.countDown();
            try { release.await(5, TimeUnit.SECONDS); }
            catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            return new Reply(200, response.get());
        });
        Path input = temporary.resolve("interrupt-input.json");
        Files.writeString(input, "[{\"aid\":1},{\"aid\":2}]");
        Path output = temporary.resolve("interrupted.json");
        var thrown = new AtomicReference<Throwable>();
        var interrupted = new AtomicBoolean();
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input, output, 2, 1);
            var thread = new Thread(() -> {
                try { task.run(); } catch (Throwable e) { thrown.set(e); interrupted.set(Thread.currentThread().isInterrupted()); }
            });
            thread.start();
            try {
                assertTrue(arrived.await(3, TimeUnit.SECONDS));
                thread.interrupt();
                thread.join(4000);
                assertFalse(thread.isAlive());
                assertInstanceOf(IllegalStateException.class, thrown.get());
                assertTrue(interrupted.get());
                var stats = JSON.readTree(VideoTypeAndLanguageAnalysisTask.statisticsPath(output).toFile());
                assertEquals("interrupted", stats.path("status").asText());
                assertEquals(1, stats.path("summary").path("failed_count").asInt());
                assertEquals(1, stats.path("summary").path("pending_count").asInt());
                assertEquals("failed", JSON.readTree(output.toFile()).path("status").asText());
                assertEquals(1, calls.get());
            } finally { release.countDown(); thread.interrupt(); thread.join(1000); }
        }
    }

    @Test
    void doesNotOverwriteExistingFilesOrCallModelForInvalidInput() throws Exception {
        Path output = temporary.resolve("existing.json");
        Files.writeString(output, "keep me");
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1);
            assertThrows(UncheckedIOException.class, task::run);
            assertEquals("keep me", Files.readString(output));
            Path invalid = temporary.resolve("invalid.json");
            Files.writeString(invalid, "[{\"aid\":1.5}]");
            assertThrows(UncheckedIOException.class, () -> new VideoTypeAndLanguageAnalysisTask(
                    client, invalid, temporary.resolve("unused.json"), 1, 1).run());
            assertThrows(IllegalArgumentException.class, () -> new VideoTypeAndLanguageAnalysisTask(
                    client, input(), output, 0, 1));
        }
        assertEquals(0, calls.get());
    }

    @Test
    void missingUsageStaysNullAndUnknownIsPreserved() throws Exception {
        var envelope = JSON.readTree(envelope(labels(AID), "stop"));
        ((com.fasterxml.jackson.databind.node.ObjectNode) envelope).remove("usage");
        response.set(envelope.toString());
        try (var client = client(false)) {
            var parsed = client.analyze(videos(), "test prompt");
            assertNull(parsed.usage().totalTokens());
            assertEquals(List.of("未知语言"), parsed.results().get(0).languages());
        }
    }

    @Test
    void neverFollowsRedirectsToAnotherEndpointWithTheCredential() throws Exception {
        var destinationCalls = new AtomicInteger();
        var destination = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        destination.createContext("/redirected", exchange -> {
            destinationCalls.incrementAndGet();
            exchange.sendResponseHeaders(200, -1);
            exchange.close();
        });
        destination.start();
        try (var client = client(false)) {
            status.set(302);
            redirect.set("http://127.0.0.1:" + destination.getAddress().getPort() + "/redirected");
            var failure = assertThrows(IOException.class, () -> client.analyze(videos(), "test prompt"));
            assertTrue(failure.getMessage().contains("302"));
            assertSecretAbsent(failure);
            assertEquals(1, calls.get());
            assertEquals(0, destinationCalls.get());
        } finally {
            destination.stop(0);
        }
    }

    @Test
    void invalidConfigurationErrorsDoNotExposeCredentialValues() throws Exception {
        Path config = temporary.resolve("invalid-config.properties");
        for (String url : List.of("https://user:" + FAKE_KEY + "@example.invalid/v1",
                "https://example.invalid/v1?key=" + FAKE_KEY, "http://example.invalid/v1")) {
            Files.writeString(config, "llm.model=test-model\nllm.base_url=" + url + "\nllm.api_key=" + FAKE_KEY + "\n");
            assertSecretAbsent(assertThrows(IllegalArgumentException.class, () -> LlmClient.fromConfig(config)));
        }
        assertEquals(0, calls.get());
    }

    private LlmClient client(boolean fullEndpoint) throws IOException {
        Path config = temporary.resolve("config.properties");
        String url = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1/";
        if (fullEndpoint) url += "chat/completions";
        Files.writeString(config, "llm.model=test-model\nllm.base_url=" + url + "\nllm.api_key=" + FAKE_KEY + "\n");
        return LlmClient.fromConfig(config);
    }

    private Path input() throws IOException {
        Path input = temporary.resolve("input.json");
        Files.writeString(input, "[{\"aid\":" + AID + ",\"title\":\"测试\",\"tag_new\":[],\"description\":null}]");
        return input;
    }

    private List<LlmClient.VideoInput> videos() {
        return List.of(new LlmClient.VideoInput(AID, "测试", List.of(), ""));
    }

    private String labels(long aid) {
        return "[{\"aid\":" + aid + ",\"is_song\":\"否\",\"is_virtual_singer\":\"不确定\",\"languages\":[\"未知语言\"]}]";
    }

    private String envelope(String content, String finish) throws IOException {
        var root = JSON.createObjectNode();
        var choice = root.putArray("choices").addObject();
        choice.put("finish_reason", finish);
        choice.putObject("message").put("role", "assistant").put("content", content);
        root.putObject("usage").put("prompt_tokens", 100).put("completion_tokens", 35).put("total_tokens", 135);
        return JSON.writeValueAsString(root);
    }

    private void assertSecretAbsent(Throwable error) {
        var trace = new StringWriter();
        error.printStackTrace(new PrintWriter(trace));
        assertFalse(trace.toString().contains(FAKE_KEY));
    }
}
