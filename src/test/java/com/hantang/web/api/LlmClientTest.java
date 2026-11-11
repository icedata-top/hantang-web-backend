package com.hantang.web.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

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

    @BeforeEach
    void startServer() throws Exception {
        response.set(envelope(labels(AID), "stop"));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            calls.incrementAndGet();
            request.set(JSON.readTree(exchange.getRequestBody()));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            if (redirect.get() != null) exchange.getResponseHeaders().set("Location", redirect.get());
            byte[] body = response.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status.get(), body.length);
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
        assertEquals("completed", report.path("status").asText());
        assertEquals(1, report.path("processed_count").intValue());
        assertEquals(AID, report.path("results").get(0).path("aid").longValue());
        assertEquals("不确定", report.path("results").get(0).path("is_virtual_singer").asText());
        assertEquals(135, report.path("batches").get(0).path("usage").path("total_tokens").intValue());
        assertFalse(Files.readString(output).contains(FAKE_KEY));
    }

    @Test
    void rejectsWrongIdsIncompleteOutputsAndInvalidLabels() throws Exception {
        String valid = labels(AID);
        var invalid = List.of(labels(2), "[]", "{}", valid + " trailing",
                valid.replace("\"否\"", "false"), valid.replace("\"否\"", "\"不是\""),
                valid.replace("\"未知语言\"", "\"韩语\""), valid.replace("\"未知语言\"", "\"英语\",\"英语\""),
                valid.replace("\"未知语言\"", "\"无语言\",\"英语\""),
                valid.replace("\"aid\":", "\"extra\":true,\"aid\":"),
                "```json\n" + valid + "\n```",
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
    void failedCallWritesFailedStatusWithoutFalseBusinessLabelsOrRetry() throws Exception {
        status.set(429);
        response.set(FAKE_KEY);
        Path output = temporary.resolve("failed.json");
        try (var client = client(false)) {
            var task = new VideoTypeAndLanguageAnalysisTask(client, input(), output, 1, 1);
            assertSecretAbsent(assertThrows(UncheckedIOException.class, task::run));
        }
        var report = JSON.readTree(Files.readString(output));
        assertEquals("failed", report.path("status").asText());
        assertEquals(0, report.path("processed_count").asInt());
        assertTrue(report.path("results").isEmpty());
        assertEquals(1, calls.get());
        assertFalse(Files.readString(output).contains(FAKE_KEY));
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
