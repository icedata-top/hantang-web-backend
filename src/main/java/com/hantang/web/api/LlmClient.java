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

/** OpenAI-compatible text client. Never log configuration, headers, or raw provider errors. */
public final class LlmClient implements AutoCloseable {
    private static final ObjectMapper JSON = new ObjectMapper(JsonFactory.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build());
    private static final Set<String> SONG_VALUES = Set.of("是", "否", "不确定");
    private static final Set<String> VOCAL_VALUES = Set.of("是", "否", "混合", "不确定");
    private static final Set<String> LANGUAGE_ALIASES = Set.of("中文", "华语", "国语", "普通话", "粤语", "闽南语", "韩语", "韩国语", "简体中文", "繁体中文");
    private static final Set<String> RESULT_FIELDS = Set.of("aid", "is_song", "is_virtual_singer", "languages");

    private final URI endpoint;
    private final String model;
    private final String apiKey;
    private final HttpClient http;

    private LlmClient(URI endpoint, String model, String apiKey) {
        this.endpoint = endpoint;
        this.model = model;
        this.apiKey = apiKey;
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
        return new LlmClient(endpoint, model, apiKey);
    }

    private static String required(Properties properties, String key) {
        String value = properties.getProperty(key, "").trim();
        if (value.isEmpty()) throw new IllegalArgumentException("缺少配置项：" + key);
        return value;
    }

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
            throw new IOException("LLM请求配置无效");
        }
        long start = System.nanoTime();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            // Exception causes can include the endpoint; provider error bodies can echo credentials.
            throw new IOException("LLM网络请求失败（" + e.getClass().getSimpleName() + "）");
        }
        if (response.statusCode() != 200) {
            throw new IOException("LLM请求失败，HTTP " + response.statusCode() + "（未记录响应正文）");
        }
        JsonNode envelope = parseJson(response.body());
        JsonNode choice = envelope.path("choices").path(0);
        if (!"stop".equals(choice.path("finish_reason").asText())) {
            throw new IOException("LLM未完整完成输出：可能截断、拒答或响应格式不符");
        }
        JsonNode content = choice.path("message").path("content");
        if (!content.isTextual() || content.textValue().isBlank()) {
            throw new IOException("LLM没有返回文本结果");
        }
        List<VideoLabel> results = parseLabels(content.textValue(), videos);
        JsonNode usage = envelope.path("usage");
        return new AnalysisResponse(results, new TokenUsage(tokenCount(usage, "prompt_tokens"),
                tokenCount(usage, "completion_tokens"), tokenCount(usage, "total_tokens")),
                Duration.ofNanos(System.nanoTime() - start).toMillis());
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

    private static List<VideoLabel> parseLabels(String content, List<VideoInput> videos) throws IOException {
        JsonNode rows = parseJson(content);
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
