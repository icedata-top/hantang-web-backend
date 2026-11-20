package com.hantang.web.api;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Pattern;

/** OpenAI-compatible text client. Never log configuration, headers, or raw provider errors. */
public final class LlmClient implements AutoCloseable {
    private static final ObjectMapper JSON = new ObjectMapper(JsonFactory.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build());
    private static final Set<String> SONG_VALUES = Set.of("是", "否", "不确定");
    private static final Set<String> VOCAL_VALUES = Set.of("是", "否", "混合", "不确定");
    private static final Set<String> LANGUAGE_ALIASES = Set.of("中文", "华语", "国语", "普通话", "粤语", "闽南语", "韩语", "韩国语", "简体中文", "繁体中文");
    private static final Set<String> RESULT_FIELDS = Set.of("aid", "is_song", "is_virtual_singer", "languages");
    private static final Pattern JSON_CODE_FENCE = Pattern.compile("\\A```(?:json)?[ \\t]*\\R(.*)\\R[ \\t]*```\\z",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private final URI endpoint;
    private final String model;
    private final String apiKey;
    private final HttpClient http;
    private final long executionTpm;
    private final int executionRpm;

    private LlmClient(URI endpoint, String model, String apiKey, long executionTpm, int executionRpm) {
        this.endpoint = endpoint;
        this.model = model;
        this.apiKey = apiKey;
        this.executionTpm = executionTpm;
        this.executionRpm = executionRpm;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NEVER).build();
    }

    public static LlmClient fromConfig(Path path) throws IOException {
        Properties properties = new Properties();
        try (var reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            properties.load(reader);
        }
        String model = required(properties, "llm.model");
        String baseUrl = required(properties, "llm.base_url").replaceAll("/+$", "");
        String apiKey = required(properties, "llm.api_key");
        URI endpoint;
        try {
            endpoint = URI.create(baseUrl.endsWith("/chat/completions") ? baseUrl : baseUrl + "/chat/completions");
            boolean localHttp = "http".equals(endpoint.getScheme()) && endpoint.getHost() != null
                    && Set.of("localhost", "127.0.0.1", "[::1]").contains(endpoint.getHost());
            if (endpoint.getHost() == null || endpoint.getUserInfo() != null || endpoint.getQuery() != null
                    || endpoint.getFragment() != null || !("https".equals(endpoint.getScheme()) || localHttp)) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("llm.base_url 必须为HTTPS API地址（本机调试可使用HTTP）");
        }
        if (apiKey.contains("\r") || apiKey.contains("\n")) {
            throw new IllegalArgumentException("llm.api_key 格式无效");
        }
        long tpm = Long.parseLong(properties.getProperty("llm.execution_tpm", "1000000").trim());
        int rpm = Integer.parseInt(properties.getProperty("llm.execution_rpm", "600").trim());
        if (tpm < 1 || rpm < 1) throw new IllegalArgumentException("执行TPM和RPM预算必须为正整数");
        return new LlmClient(endpoint, model, apiKey, tpm, rpm);
    }

    private static String required(Properties properties, String key) {
        String value = properties.getProperty(key, "").trim();
        if (value.isEmpty()) throw new IllegalArgumentException("缺少配置项：" + key);
        return value;
    }

    public String modelName() { return model; }
    public long executionTpm() { return executionTpm; }
    public int executionRpm() { return executionRpm; }

    public AnalysisResponse analyze(List<VideoInput> videos, String prompt) throws IOException, InterruptedException {
        if (videos.isEmpty() || videos.size() > 50 || prompt == null || prompt.isBlank()) {
            throw new IllegalArgumentException("每次请求须包含1至50条视频及非空提示词");
        }
        var ids = new HashSet<Long>();
        for (VideoInput video : videos) {
            if (video == null || video.aid() <= 0 || !ids.add(video.aid())) {
                throw new IllegalArgumentException("输入视频aid必须是唯一的正整数");
            }
        }
        var body = JSON.createObjectNode();
        body.put("model", model);
        body.put("stream", false);
        body.put("enable_thinking", false);
        body.put("max_completion_tokens", Math.max(512, videos.size() * 192));
        var messages = body.putArray("messages");
        messages.addObject().put("role", "system").put("content", prompt);
        messages.addObject().put("role", "user").put("content", JSON.writeValueAsString(videos));
        // The prompt requires a top-level array; json_object would impose a conflicting object format.
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(120))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "application/json; charset=utf-8")
                    .POST(HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body), StandardCharsets.UTF_8)).build();
        } catch (IllegalArgumentException e) {
            throw failure("request", "REQUEST_CONFIGURATION", null, System.nanoTime(), null, null);
        }
        long start = System.nanoTime();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            // Exception causes can include the endpoint; provider error bodies can echo credentials.
            throw failure("network", "NETWORK_ERROR", null, start, null, null);
        }
        if (response.statusCode() != 200) {
            TokenUsage usage = null;
            try { usage = readUsage(parseJson(response.body())); } catch (IOException ignored) { }
            var failure = failure("http", "HTTP_ERROR", response.statusCode(), start, usage, null);
            response.headers().firstValue("Retry-After").ifPresent(value -> {
                try {
                    long millis;
                    try { millis = Math.multiplyExact(Long.parseLong(value.trim()), 1000L); }
                    catch (NumberFormatException ignored) {
                        millis = java.time.Duration.between(java.time.Instant.now(),
                                java.time.ZonedDateTime.parse(value, java.time.format.DateTimeFormatter.RFC_1123_DATE_TIME).toInstant()).toMillis();
                    }
                    if (millis >= 0) failure.retryAfterMs = Math.min(millis, 86_400_000L);
                } catch (IllegalArgumentException | java.time.DateTimeException | ArithmeticException ignored) { }
            });
            throw failure;
        }
        JsonNode envelope;
        try { envelope = parseJson(response.body()); }
        catch (IOException e) { throw failure("response_json", "RESPONSE_JSON_INVALID", 200, start, null, response.body()); }
        TokenUsage usage = readUsage(envelope);
        JsonNode choice = envelope.path("choices").path(0);
        JsonNode content = choice.path("message").path("content");
        String modelOutput = content.isTextual() ? content.textValue() : null;
        if (!"stop".equals(choice.path("finish_reason").asText())) {
            throw failure("model_output", "OUTPUT_INCOMPLETE", 200, start, usage, modelOutput);
        }
        if (modelOutput == null || modelOutput.isBlank()) {
            throw failure("model_output", "OUTPUT_MISSING", 200, start, usage, modelOutput);
        }
        JsonNode rows;
        try {
            var fenced = JSON_CODE_FENCE.matcher(modelOutput.strip());
            rows = parseJson(fenced.matches() ? fenced.group(1) : modelOutput);
        } catch (IOException e) { throw failure("label_json", "LABEL_JSON_INVALID", 200, start, usage, modelOutput); }
        List<VideoLabel> results;
        try { results = parseLabels(rows, videos); }
        catch (IOException e) { throw failure("label_validation", "LABEL_VALIDATION_FAILED", 200, start, usage, modelOutput); }
        return new AnalysisResponse(results, usage, Duration.ofNanos(System.nanoTime() - start).toMillis());
    }

    private static TokenUsage readUsage(JsonNode envelope) {
        JsonNode usage = envelope.path("usage");
        return new TokenUsage(tokenCount(usage, "prompt_tokens"), tokenCount(usage, "completion_tokens"), tokenCount(usage, "total_tokens"));
    }

    private AnalysisException failure(String stage, String code, Integer status, long start, TokenUsage usage, String body) {
        String shape = null;
        if (body != null) {
            String trimmed = body.stripLeading();
            shape = trimmed.isEmpty() ? "empty" : trimmed.startsWith("```") ? "markdown"
                    : trimmed.startsWith("data:") ? "sse" : trimmed.startsWith("<") ? "html"
                    : trimmed.startsWith("[") ? "array" : trimmed.startsWith("{") ? "object"
                    : trimmed.startsWith("\uFEFF") ? "bom" : "other";
        }
        // Retain decoded model content only, never HTTP error bodies, envelopes or headers.
        String rawModelOutput = body != null && Set.of("model_output", "label_json", "label_validation").contains(stage)
                ? body.replace(apiKey, "[REDACTED]") : null;
        return new AnalysisException(stage, code, status, Duration.ofNanos(System.nanoTime() - start).toMillis(),
                usage == null ? new TokenUsage(null, null, null) : usage, shape, rawModelOutput);
    }

    /** Messages and stack traces contain fixed metadata only; model diagnostics require an explicit accessor. */
    public static final class AnalysisException extends IOException {
        private final String stage;
        private final String code;
        private final Integer httpStatus;
        private final long elapsedMs;
        private final TokenUsage usage;
        private final String responseShape;
        private final String rawModelOutput;
        private Long retryAfterMs;

        private AnalysisException(String stage, String code, Integer httpStatus, long elapsedMs, TokenUsage usage, String responseShape,
                                  String rawModelOutput) {
            super("LLM请求未成功：" + code + (httpStatus == null ? "" : "，HTTP " + httpStatus));
            this.stage = stage; this.code = code; this.httpStatus = httpStatus;
            this.elapsedMs = elapsedMs; this.usage = usage; this.responseShape = responseShape;
            this.rawModelOutput = rawModelOutput;
        }
        public String stage() { return stage; }
        public String code() { return code; }
        public Integer httpStatus() { return httpStatus; }
        public long elapsedMs() { return elapsedMs; }
        public TokenUsage usage() { return usage; }
        public String responseShape() { return responseShape; }
        public String rawModelOutput() { return rawModelOutput; }
        public Long retryAfterMs() { return retryAfterMs; }
    }

    private static JsonNode parseJson(String text) throws IOException {
        try {
            JsonNode result = JSON.reader().with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).readTree(text);
            if (result == null) throw new IOException("empty");
            return result;
        } catch (IOException e) {
            throw new IOException("LLM响应不是合法JSON（未记录响应正文）");
        }
    }

    private static List<VideoLabel> parseLabels(JsonNode rows, List<VideoInput> videos) throws IOException {
        if (!rows.isArray() || rows.size() != videos.size()) {
            throw new IOException("LLM结果条数或数组格式与输入不一致");
        }
        var result = new ArrayList<VideoLabel>();
        for (int i = 0; i < rows.size(); i++) {
            JsonNode row = rows.get(i);
            var fields = new HashSet<String>();
            row.fieldNames().forEachRemaining(fields::add);
            if (!row.isObject() || !fields.equals(RESULT_FIELDS) || !row.path("aid").isIntegralNumber()
                    || !row.path("aid").canConvertToLong() || row.path("aid").longValue() != videos.get(i).aid()
                    || !row.path("is_song").isTextual() || !SONG_VALUES.contains(row.path("is_song").textValue())
                    || !row.path("is_virtual_singer").isTextual() || !VOCAL_VALUES.contains(row.path("is_virtual_singer").textValue())) {
                throw new IOException("LLM结果的字段、aid顺序或分类枚举不符合约定");
            }
            JsonNode languages = row.path("languages");
            if (!languages.isArray() || languages.isEmpty()) throw new IOException("LLM语言字段必须为非空数组");
            var values = new ArrayList<String>();
            for (JsonNode language : languages) {
                if (!language.isTextual() || !language.textValue().matches("[\\p{IsHan}]{1,20}")
                        || LANGUAGE_ALIASES.contains(language.textValue()) || values.contains(language.textValue())) {
                    throw new IOException("LLM语言标签类型、名称或去重不符合约定");
                }
                values.add(language.textValue());
            }
            if (values.contains("无语言") && values.size() != 1) throw new IOException("无语言不能与其他语种并存");
            result.add(new VideoLabel(row.path("aid").longValue(), row.path("is_song").textValue(),
                    row.path("is_virtual_singer").textValue(), List.copyOf(values)));
        }
        return List.copyOf(result);
    }

    private static Long tokenCount(JsonNode usage, String field) {
        JsonNode value = usage.path(field);
        return value.isIntegralNumber() && value.canConvertToLong() && value.longValue() >= 0 ? value.longValue() : null;
    }

    @Override
    public void close() {
        http.close();
    }

    public record VideoInput(long aid, String title, @JsonProperty("tag_new") List<String> tagNew, String description) { }

    public record VideoLabel(long aid, @JsonProperty("is_song") String isSong,
                             @JsonProperty("is_virtual_singer") String isVirtualSinger, List<String> languages) { }

    public record TokenUsage(@JsonProperty("prompt_tokens") Long promptTokens,
                             @JsonProperty("completion_tokens") Long completionTokens,
                             @JsonProperty("total_tokens") Long totalTokens) { }

    public record AnalysisResponse(List<VideoLabel> results, TokenUsage usage,
                                   @JsonProperty("elapsed_ms") long elapsedMs) { }
}
