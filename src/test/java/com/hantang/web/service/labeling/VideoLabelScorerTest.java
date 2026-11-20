package com.hantang.web.service.labeling;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class VideoLabelScorerTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    @TempDir Path directory;

    private ObjectNode row(long aid, String song, String voice) {
        var row = JSON.createObjectNode().put("aid", aid);
        row.putObject("input").put("title", "视频" + aid).put("description", "原始输入").putArray("tag_new");
        row.putObject("output").put("is_song", song).put("is_virtual_singer", voice).putArray("languages").add("未知语言");
        row.putObject("review").put("status", "已确认").put("note", "");
        return row;
    }
    private ObjectNode report(int selected, ObjectNode... rows) {
        var report = JSON.createObjectNode().put("schema_version", 1).put("source", "llm").put("selected_count", selected)
                .put("processed_count", rows.length).put("status", selected == rows.length ? "completed" : rows.length == 0 ? "failed" : "partial");
        var results = report.putArray("results"); for (var row : rows) results.add(row); report.putArray("batches");
        return report;
    }

    @Test void all144ReferencePredictionCombinationsFollowTheThreeBusinessRules() throws Exception {
        var reference = report(144); var prediction = report(144);
        var refs = reference.withArray("results"); var preds = prediction.withArray("results");
        long aid = 1;
        for (String rs : new String[]{"是", "否", "不确定"}) for (String rv : new String[]{"是", "否", "混合", "不确定"})
            for (String ps : new String[]{"是", "否", "不确定"}) for (String pv : new String[]{"是", "否", "混合", "不确定"}) {
                refs.add(row(aid, rs, rv)); preds.add(row(aid++, ps, pv));
            }
        for (var report : new ObjectNode[]{reference, prediction}) report.put("processed_count", 144).put("status", "completed");
        var result = VideoLabelScorer.evaluate(reference, prediction);
        assertEquals(84, result.path("summary").path("scorable_count").asInt());
        assertEquals(21, result.path("summary").path("correct_count").asInt());
        assertEquals(60, result.path("summary").path("unscorable_count").asInt());
        assertEquals(0.25, result.path("summary").path("accuracy").asDouble());
        assertEquals(16, result.path("summary").path("classes").path("non_song").path("correct_count").asInt());
        assertEquals(4, result.path("summary").path("classes").path("virtual_song").path("correct_count").asInt());
        assertEquals(1, result.path("summary").path("classes").path("non_virtual_song").path("correct_count").asInt());
    }

    @Test void missingPredictionsCountAsWrongButUnknownReferencesNeverEnterTheDenominator() throws Exception {
        var reference = report(5, row(1, "是", "是"), row(2, "否", "不确定"), row(3, "是", "否"),
                row(4, "不确定", "是"), row(5, "是", "不确定"));
        var prediction = report(5, row(5, "是", "是"), row(3, "是", "不确定"), row(2, "否", "是"));
        var result = VideoLabelScorer.evaluate(reference, prediction);
        var summary = result.path("summary");
        assertEquals(3, summary.path("scorable_count").asInt());
        assertEquals(1, summary.path("correct_count").asInt());
        assertEquals(2, summary.path("incorrect_count").asInt());
        assertEquals(2, summary.path("unscorable_count").asInt());
        assertEquals(1, summary.path("missing_prediction_count").asInt());
        assertEquals(1, summary.path("unknown_prediction_count").asInt());
        assertEquals("missing_prediction", result.path("entries").get(0).path("outcome").asText());
        assertEquals("unscorable", result.path("entries").get(3).path("outcome").asText());
        assertEquals(1.0 / 3, summary.path("accuracy").asDouble());
    }

    @Test void mixedCountsAsVirtualOnBothSidesAndLanguagesAreIgnored() throws Exception {
        var ref = row(1, "是", "混合");
        var pred = row(1, "是", "是"); pred.withObject("output").putArray("languages").add("日语");
        assertEquals(1, VideoLabelScorer.evaluate(report(1, ref), report(1, pred)).path("summary").path("correct_count").asInt());
        ref.withObject("output").put("is_virtual_singer", "是"); pred.withObject("output").put("is_virtual_singer", "混合");
        assertEquals(1, VideoLabelScorer.evaluate(report(1, ref), report(1, pred)).path("summary").path("correct_count").asInt());
    }

    @Test void allFailedGetsZeroAndAllUnknownHasNoAccuracyRatherThanFakeFullMarks() throws Exception {
        var ref = report(2, row(1, "是", "是"), row(2, "否", "不确定"));
        var failed = VideoLabelScorer.evaluate(ref, report(2)).path("summary");
        assertEquals(0, failed.path("correct_count").asInt());
        assertEquals(2, failed.path("missing_prediction_count").asInt());
        assertEquals(0, failed.path("accuracy").asDouble());
        var unknown = VideoLabelScorer.evaluate(report(1, row(1, "不确定", "是")), report(1)).path("summary");
        assertTrue(unknown.path("accuracy").isNull());
        assertTrue(unknown.path("classes").path("virtual_song").path("accuracy").isNull());
    }

    @Test void duplicateUnexpectedIdsScopeMismatchesAndChangedInputCannotSilentlyEarnCredit() throws Exception {
        var ref = report(2, row(1, "是", "是"), row(2, "否", "不确定"));
        assertThrows(VideoLabelScorer.ScoringException.class, () -> VideoLabelScorer.evaluate(ref, report(2, row(1, "是", "是"), row(1, "否", "否"))));
        assertEquals("UNEXPECTED_AID", assertThrows(VideoLabelScorer.ScoringException.class,
                () -> VideoLabelScorer.evaluate(ref, report(2, row(3, "是", "是")))).code());
        assertEquals("SCOPE_MISMATCH", assertThrows(VideoLabelScorer.ScoringException.class,
                () -> VideoLabelScorer.evaluate(ref, report(1, row(1, "是", "是")))).code());
        var changed = row(1, "是", "是"); changed.withObject("input").put("description", "不同版本");
        assertEquals("INPUT_MISMATCH", assertThrows(VideoLabelScorer.ScoringException.class,
                () -> VideoLabelScorer.evaluate(ref, report(2, changed))).code());
        ref.withArray("results").get(0).withObject("review").put("status", "待复核");
        assertEquals("INVALID_REFERENCE", assertThrows(VideoLabelScorer.ScoringException.class,
                () -> VideoLabelScorer.evaluate(ref, report(2))).code());
    }

    @Test void archived1000ResultsScoreByAidWithoutChangingEitherInputAndMetadataIsReproducible() throws Exception {
        Path ref = VideoLabelScorer.DEFAULT_REFERENCE;
        Path pred = Path.of("script/uniseek/runs/web-419ec03b-65e9-4a64-a01d-46bab4ae2642/predictions.json");
        byte[] beforeRef = Files.readAllBytes(ref), beforePred = Files.readAllBytes(pred);
        var result = VideoLabelScorer.evaluate(ref, pred);
        assertEquals(1000, result.path("summary").path("total_count").asInt());
        assertEquals(858, result.path("summary").path("scorable_count").asInt());
        assertEquals(797, result.path("summary").path("correct_count").asInt());
        assertEquals(142, result.path("summary").path("unscorable_count").asInt());
        assertEquals(6, result.path("summary").path("prompt_example_count").asInt());
        assertEquals("2a825bafffd5fe11de49fcb0f1213012dc6b8cbbf01feb16c2d59834191ec374", result.path("reference").path("sha256").asText());
        Path out = directory.resolve("score.json"); VideoLabelScorer.write(out, result);
        assertTrue(JSON.writeValueAsString(result).equals(JSON.writeValueAsString(JSON.readTree(out.toFile()))));
        assertFalse(VideoLabelScorer.summary(result).has("entries"));
        assertArrayEquals(beforeRef, Files.readAllBytes(ref)); assertArrayEquals(beforePred, Files.readAllBytes(pred));
        assertThrows(java.io.IOException.class, () -> VideoLabelScorer.main(new String[]{pred.toString(), ref.toString(), ref.toString()}));
    }
}
