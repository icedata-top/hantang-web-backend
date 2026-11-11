package com.hantang.web.task;

import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.api.LlmClient;
import com.hantang.web.api.LlmClient.VideoInput;
import com.hantang.web.api.LlmClient.VideoLabel;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;

/** Explicit offline entry point; it is never registered with the web server or a scheduler. */
public final class VideoTypeAndLanguageAnalysisTask implements Runnable {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String PROMPT_RESOURCE = "/prompt/VideoTypeAndLanguageAnalysis.md";
    private final LlmClient client;
    private final Path input;
    private final Path output;
    private final int limit;
    private final int batchSize;

    public VideoTypeAndLanguageAnalysisTask(LlmClient client, Path input, Path output, int limit, int batchSize) {
        if (limit < 1 || batchSize < 1 || batchSize > 50) {
            throw new IllegalArgumentException("处理上限必须大于0，单批大小必须为1至50");
        }
        this.client = client;
        this.input = input;
        this.output = output;
        this.limit = limit;
        this.batchSize = batchSize;
    }

    /** Optional arguments: input.json output.json limit batchSize. The default limit is ONE video. */
    public static void main(String[] args) {
        if (args.length > 4 || (args.length > 0 && "--help".equals(args[0]))) {
            System.out.println("参数：[输入JSON] [输出JSON] [处理上限，默认1] [每批条数，默认20，上限50]");
            return;
        }
        try {
            Path input = Path.of(args.length > 0 ? args[0] : "script/uniseek/uniseek_videos.json");
            Path output = Path.of(args.length > 1 ? args[1] : "target/uniseek/analysis-" + UUID.randomUUID() + ".json");
            int limit = args.length > 2 ? Integer.parseInt(args[2]) : 1;
            int batchSize = args.length > 3 ? Integer.parseInt(args[3]) : 20;
            try (LlmClient client = LlmClient.fromConfig(Path.of("config.secret.properties"))) {
                new VideoTypeAndLanguageAnalysisTask(client, input, output, limit, batchSize).run();
            }
        } catch (Exception e) {
            // Do not print stack traces or configuration values to the console.
            System.err.println("视频分析任务失败：" + e.getMessage());
            System.exit(1);
        }
    }

    @Override
    public void run() {
        try {
            execute();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("视频分析任务被中断");
        } catch (IOException e) {
            throw new UncheckedIOException("视频分析任务未完成：" + e.getMessage(), e);
        }
    }

    private void execute() throws IOException, InterruptedException {
        if (Files.exists(output)) throw new IOException("输出文件已存在，请指定新文件，避免覆盖结果");
        List<VideoInput> videos = readVideos();
        String prompt;
        try (var stream = getClass().getResourceAsStream(PROMPT_RESOURCE)) {
            if (stream == null) throw new IOException("未找到视频分析提示词资源");
            prompt = new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
        Path parent = output.toAbsolutePath().getParent();
        Files.createDirectories(parent);
        var results = new ArrayList<VideoLabel>();
        var batches = JSON.createArrayNode();
        var report = JSON.createObjectNode();
        report.put("selected_count", videos.size());
        report.put("processed_count", 0);
        report.put("status", "running");
        report.set("results", JSON.createArrayNode());
        report.set("batches", batches);
        // Reserve the output before making a paid request. Existing files, including the input/config, cannot be overwritten.
        Files.writeString(output, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(report),
                StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
        try {
            for (int offset = 0; offset < videos.size(); offset += batchSize) {
                var batch = videos.subList(offset, Math.min(offset + batchSize, videos.size()));
                var response = client.analyze(batch, prompt);
                results.addAll(response.results());
                var summary = batches.addObject();
                summary.put("count", response.results().size());
                summary.put("elapsed_ms", response.elapsedMs());
                summary.set("usage", JSON.valueToTree(response.usage()));
                report.put("processed_count", results.size());
                report.put("status", results.size() == videos.size() ? "completed" : "partial");
                report.set("results", JSON.valueToTree(results));
                report.set("batches", batches);
                // Persist each completed batch. A later failure leaves a valid partial report, not false labels.
                Files.writeString(output, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(report),
                        StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING);
                System.out.printf("已解析 %d/%d 条，当前批次耗时 %d ms%n", results.size(), videos.size(), response.elapsedMs());
            }
            System.out.println("结果文件：" + output.toAbsolutePath());
        } catch (IOException | InterruptedException e) {
            report.put("status", "failed");
            try {
                Files.writeString(output, JSON.writerWithDefaultPrettyPrinter().writeValueAsString(report),
                        StandardCharsets.UTF_8, StandardOpenOption.TRUNCATE_EXISTING);
            } catch (IOException writeFailure) {
                e.addSuppressed(writeFailure);
            }
            throw e;
        }
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
