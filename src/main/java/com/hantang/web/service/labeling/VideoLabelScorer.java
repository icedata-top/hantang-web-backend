package com.hantang.web.service.labeling;

import com.fasterxml.jackson.core.JsonFactory;
import com.fasterxml.jackson.core.StreamReadFeature;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Deterministic local scoring, shared by the web completion flow and the offline CLI. No LLM or DB access. */
public final class VideoLabelScorer {
    public static final String RULES_VERSION = "song-eligibility-v1";
    public static final Path DEFAULT_REFERENCE = Path.of("script/uniseek/reference_answers.reviewed-final.json");
    private static final ObjectMapper JSON = new ObjectMapper(JsonFactory.builder()
            .enable(StreamReadFeature.STRICT_DUPLICATE_DETECTION).build())
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final String VIRTUAL = "virtual_song", NON_SONG = "non_song", HUMAN = "non_virtual_song", UNKNOWN = "unknown";
    private static final Set<String> SONG_VALUES = Set.of("是", "否", "不确定");
    private static final Set<String> VOICE_VALUES = Set.of("是", "否", "混合", "不确定");
    private static final Set<Long> PROMPT_EXAMPLES = Set.of(2075941L, 116282565529774L, 113918135501604L,
            1904434315L, 1604449L, 4205873L);

    private VideoLabelScorer() { }

    public static final class ScoringException extends IOException {
        private final String code;
        private ScoringException(String code) { super("Label scoring failed: " + code); this.code = code; }
        public String code() { return code; }
    }

    public static Path reportPath(Path predictions) { return sibling(predictions, ".score.json"); }
    public static Path summaryPath(Path predictions) { return sibling(predictions, ".score-summary.json"); }
    private static Path sibling(Path predictions, String suffix) {
        return predictions.resolveSibling(predictions.getFileName().toString().replaceFirst("(?i)\\.json$", "") + suffix);
    }

    public static ObjectNode evaluate(Path referenceFile, Path predictionFile) throws IOException {
        byte[] referenceBytes = Files.readAllBytes(referenceFile), predictionBytes = Files.readAllBytes(predictionFile);
        JsonNode reference = JSON.readTree(referenceBytes), prediction = JSON.readTree(predictionBytes);
        ObjectNode report = evaluate(reference, prediction);
        report.set("reference", metadata(referenceFile, referenceBytes));
        report.set("prediction", metadata(predictionFile, predictionBytes));
        return report;
    }

    public static ObjectNode evaluate(JsonNode reference, JsonNode prediction) throws ScoringException {
        var references = entries(reference, true);
        var predictions = entries(prediction, false);
        if (reference.path("selected_count").asInt() != prediction.path("selected_count").asInt())
            throw new ScoringException("SCOPE_MISMATCH");
        for (var row : predictions.entrySet()) {
            if (!references.containsKey(row.getKey())) throw new ScoringException("UNEXPECTED_AID");
            if (!references.get(row.getKey()).path("input").equals(row.getValue().path("input")))
                throw new ScoringException("INPUT_MISMATCH");
        }
        var report = JSON.createObjectNode().put("schema_version", 1).put("report_type", "video_label_score")
                .put("rules_version", RULES_VERSION).put("status", "completed").put("created_at", Instant.now().toString())
                .put("scope", "all_reference_entries");
        var summary = report.putObject("summary");
        var classes = summary.putObject("classes");
        for (String key : new String[]{VIRTUAL, NON_SONG, HUMAN})
            classes.putObject(key).put("scorable_count", 0).put("correct_count", 0).put("incorrect_count", 0)
                    .put("missing_prediction_count", 0).put("unknown_prediction_count", 0);
        var details = report.putArray("entries");
        int correct = 0, scorable = 0, missing = 0, unknownPrediction = 0, examples = 0;
        for (var item : references.entrySet()) {
            long aid = item.getKey();
            JsonNode expected = item.getValue(), actual = predictions.get(aid);
            String expectedClass = category(expected.path("output"));
            String actualClass = actual == null ? "missing" : category(actual.path("output"));
            boolean eligible = !UNKNOWN.equals(expectedClass), matches = eligible && expectedClass.equals(actualClass);
            var detail = details.addObject().put("aid", aid).put("title", expected.path("input").path("title").asText(""))
                    .put("reference_class", expectedClass).put("prediction_class", actualClass);
            detail.set("reference", expected.path("output").deepCopy());
            if (actual == null) detail.putNull("prediction"); else detail.set("prediction", actual.path("output").deepCopy());
            String outcome = !eligible ? "unscorable" : actual == null ? "missing_prediction" : matches ? "correct" : "incorrect";
            if (eligible) detail.put("points", matches ? 1 : 0); else detail.putNull("points");
            detail.put("outcome", outcome).put("reason", !eligible ? "reference_unknown" : actual == null ? "missing_prediction"
                    : UNKNOWN.equals(actualClass) ? "prediction_unknown" : matches ? "matched" : "class_mismatch");
            if (PROMPT_EXAMPLES.contains(aid)) examples++;
            if (!eligible) continue;
            scorable++;
            var group = (ObjectNode) classes.path(expectedClass);
            increment(group, "scorable_count");
            if (matches) { correct++; increment(group, "correct_count"); }
            else increment(group, "incorrect_count");
            if (actual == null) { missing++; increment(group, "missing_prediction_count"); }
            if (UNKNOWN.equals(actualClass)) { unknownPrediction++; increment(group, "unknown_prediction_count"); }
        }
        summary.put("total_count", references.size()).put("prediction_count", predictions.size())
                .put("scorable_count", scorable).put("correct_count", correct).put("incorrect_count", scorable - correct)
                .put("unscorable_count", references.size() - scorable).put("missing_prediction_count", missing)
                .put("unknown_prediction_count", unknownPrediction).put("prompt_example_count", examples);
        accuracy(summary);
        classes.elements().forEachRemaining(value -> accuracy((ObjectNode) value));
        return report;
    }

    private static void increment(ObjectNode node, String field) { node.put(field, node.path(field).asInt() + 1); }
    private static void accuracy(ObjectNode node) {
        int denominator = node.path("scorable_count").asInt();
        if (denominator == 0) node.putNull("accuracy");
        else node.put("accuracy", (double) node.path("correct_count").asInt() / denominator);
    }

    private static String category(JsonNode output) {
        if ("否".equals(output.path("is_song").asText())) return NON_SONG;
        if (!"是".equals(output.path("is_song").asText())) return UNKNOWN;
        return switch (output.path("is_virtual_singer").asText()) {
            case "是", "混合" -> VIRTUAL;
            case "否" -> HUMAN;
            default -> UNKNOWN;
        };
    }

    private static Map<Long, JsonNode> entries(JsonNode report, boolean reference) throws ScoringException {
        if (report == null || !report.isObject() || report.path("schema_version").asInt() != 1
                || !report.path("selected_count").isInt() || report.path("selected_count").asInt() < 1
                || !report.path("processed_count").isInt() || !report.path("results").isArray()
                || report.path("processed_count").asInt() != report.path("results").size()
                || report.path("processed_count").asInt() > report.path("selected_count").asInt()
                || !(reference ? Set.of("completed") : Set.of("completed", "partial", "failed")).contains(report.path("status").asText())
                || (reference && report.path("processed_count").asInt() != report.path("selected_count").asInt())
                || (!reference && !"llm".equals(report.path("source").asText()))
                || ("completed".equals(report.path("status").asText()) && report.path("processed_count").asInt() != report.path("selected_count").asInt()))
            throw new ScoringException(reference ? "INVALID_REFERENCE" : "INVALID_PREDICTION");
        var result = new LinkedHashMap<Long, JsonNode>();
        for (JsonNode row : report.path("results")) {
            JsonNode aid = row.path("aid"), output = row.path("output");
            if (!aid.isIntegralNumber() || !aid.canConvertToLong() || aid.asLong() < 1 || result.putIfAbsent(aid.asLong(), row) != null)
                throw new ScoringException("INVALID_OR_DUPLICATE_AID");
            if (!row.path("input").isObject() || !output.isObject()
                    || !SONG_VALUES.contains(output.path("is_song").asText()) || !VOICE_VALUES.contains(output.path("is_virtual_singer").asText())
                    || !output.path("languages").isArray() || output.path("languages").isEmpty()
                    || (reference && !"已确认".equals(row.path("review").path("status").asText())))
                throw new ScoringException(reference ? "INVALID_REFERENCE" : "INVALID_PREDICTION");
        }
        return result;
    }

    private static ObjectNode metadata(Path file, byte[] bytes) {
        try {
            return JSON.createObjectNode().put("file", file.toString())
                    .put("sha256", HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)));
        } catch (NoSuchAlgorithmException e) { throw new IllegalStateException("SHA-256 unavailable"); }
    }

    public static ObjectNode summary(ObjectNode report) {
        var summary = report.deepCopy(); summary.remove("entries"); return summary;
    }

    public static void write(Path output, JsonNode value) throws IOException {
        Files.createDirectories(output.toAbsolutePath().getParent());
        Path temp = Files.createTempFile(output.toAbsolutePath().getParent(), ".label-score-", ".tmp");
        try {
            JSON.writerWithDefaultPrettyPrinter().writeValue(temp.toFile(), value);
            try { Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
            catch (AtomicMoveNotSupportedException ignored) { Files.move(temp, output, StandardCopyOption.REPLACE_EXISTING); }
        } finally { Files.deleteIfExists(temp); }
    }

    /** Arguments: predictions.json [reference.json] [new-score.json]. Never calls a model. */
    public static void main(String[] args) throws IOException {
        if (args.length < 1 || args.length > 3 || "--help".equals(args[0])) {
            System.out.println("参数：预测JSON [人工参考答案JSON] [新评分JSON]；仅本地评分，不调用模型"); return;
        }
        Path predictions = Path.of(args[0]), reference = args.length > 1 ? Path.of(args[1]) : DEFAULT_REFERENCE;
        Path output = args.length > 2 ? Path.of(args[2]) : Path.of("target/uniseek/scores/score-" + UUID.randomUUID() + ".json");
        if (Files.exists(output) || output.toAbsolutePath().normalize().equals(predictions.toAbsolutePath().normalize())
                || output.toAbsolutePath().normalize().equals(reference.toAbsolutePath().normalize()))
            throw new IOException("评分输出必须为新文件");
        ObjectNode report = evaluate(reference, predictions);
        write(output, report);
        JsonNode summary = report.path("summary");
        System.out.printf("得分 %d / %d；无法判分 %d；评分文件：%s%n", summary.path("correct_count").asInt(),
                summary.path("scorable_count").asInt(), summary.path("unscorable_count").asInt(), output.toAbsolutePath());
    }
}
