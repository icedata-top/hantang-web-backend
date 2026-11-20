package com.hantang.web.dao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.api.LlmClient.AnalysisResponse;
import com.hantang.web.api.LlmClient.VideoInput;
import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.service.labeling.VideoLabelInput;
import com.hantang.web.service.labeling.VideoLabelingStore;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public final class VideoContentLabelDao implements VideoLabelingStore {
    @FunctionalInterface public interface Connections { Connection open() throws SQLException; }
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final long LOCK_KEY = 746812950214L;
    private final Connections connections;
    public VideoContentLabelDao() { this(() -> PostgreDao.getInstance().openConnection()); }
    public VideoContentLabelDao(Connections connections) { this.connections = connections; }

    static final String OVERVIEW_SQL = """
            SELECT count(*) AS total_count, count(l.aid) AS labeled_count,
                   count(*) FILTER (WHERE l.aid IS NULL) AS unlabeled_count,
                   count(*) FILTER (WHERE l.label_source = 'manual') AS manual_count,
                   count(*) FILTER (WHERE l.is_virtual_singer_song) AS virtual_song_count,
                   count(*) FILTER (WHERE l.is_chinese_virtual_singer_song) AS chinese_virtual_song_count
            FROM hantang_dynamic.adm_uniseek_videos v
            LEFT JOIN hantang_dynamic.video_content_labels l ON l.aid = v.aid
            """;
    static final String SELECT_SQL = """
            SELECT v.aid, v.title, v.tag_new, v.batch_id::text AS batch_id, v.record_date::text AS record_date,
                   p.aid AS input_aid, p.description
            FROM hantang_dynamic.adm_uniseek_videos v
            LEFT JOIN hantang_dynamic.video_content_labels l ON l.aid = v.aid
            LEFT JOIN hantang_dynamic.processed_videos p ON p.aid = v.aid
            WHERE %s
            ORDER BY v.aid ASC LIMIT ?
            """;
    static final String INCREMENTAL_FILTER = "l.aid IS NULL";
    static final String OVERWRITE_FILTER = "l.aid IS NULL OR l.label_source <> 'manual'";
    static final String INSERT_HEADER = """
            INSERT INTO hantang_dynamic.video_content_labels AS existing
              (aid,is_song,is_virtual_singer,languages,label_source,schema_version,model,prompt_sha256,input_sha256,source_run_id,labeled_at)
            VALUES
            """;
    static final String INSERT_ROW = "(?,?,?,?::text[],'llm',1,?,?,?,?,CURRENT_TIMESTAMP)";
    static final String INCREMENTAL_CONFLICT = "ON CONFLICT (aid) DO NOTHING RETURNING aid";
    static final String OVERWRITE_CONFLICT = """
            ON CONFLICT (aid) DO UPDATE SET
              is_song=EXCLUDED.is_song, is_virtual_singer=EXCLUDED.is_virtual_singer, languages=EXCLUDED.languages,
              label_source=EXCLUDED.label_source, schema_version=EXCLUDED.schema_version, model=EXCLUDED.model,
              prompt_sha256=EXCLUDED.prompt_sha256, input_sha256=EXCLUDED.input_sha256,
              source_run_id=EXCLUDED.source_run_id, labeled_at=EXCLUDED.labeled_at
            WHERE existing.label_source <> 'manual'
            RETURNING aid
            """;

    @Override public Overview overview() throws SQLException {
        try (var connection = connections.open(); var statement = connection.prepareStatement(OVERVIEW_SQL)) {
            statement.setQueryTimeout(30);
            try (var rows = statement.executeQuery()) {
                if (!rows.next()) throw new SQLException("OVERVIEW_UNAVAILABLE");
                return new Overview(rows.getLong("total_count"), rows.getLong("labeled_count"), rows.getLong("unlabeled_count"),
                        rows.getLong("manual_count"), rows.getLong("virtual_song_count"), rows.getLong("chinese_virtual_song_count"));
            }
        }
    }

    @Override public Lease acquire() throws SQLException {
        var connection = connections.open();
        try {
            try (var permission = connection.prepareStatement("""
                    SELECT has_table_privilege('hantang_dynamic.video_content_labels','INSERT')
                       AND has_table_privilege('hantang_dynamic.video_content_labels','UPDATE') AS writable
                    """)) {
                permission.setQueryTimeout(10);
                try (var rows = permission.executeQuery()) {
                    if (!rows.next() || !rows.getBoolean(1)) throw new SQLException("LABEL_TABLE_NOT_WRITABLE", "42501");
                }
            }
            try (var statement = connection.prepareStatement("SELECT pg_try_advisory_lock(?)")) {
                statement.setLong(1, LOCK_KEY); statement.setQueryTimeout(10);
                try (var rows = statement.executeQuery()) {
                    if (!rows.next() || !rows.getBoolean(1)) throw new SQLException("LABELING_ALREADY_RUNNING", "55P03");
                }
            }
            return new Lease() {
                @Override public void verify() throws SQLException {
                    if (!connection.isValid(2)) throw new SQLException("LABELING_LOCK_LOST");
                }
                @Override public void close() throws SQLException {
                    try (var statement = connection.prepareStatement("SELECT pg_advisory_unlock(?)")) {
                        statement.setLong(1, LOCK_KEY); statement.setQueryTimeout(5); statement.execute();
                    } catch (SQLException e) {
                        // Never return a session holding an advisory lock to the pool.
                        try { connection.abort(Runnable::run); } catch (SQLException abort) { e.addSuppressed(abort); }
                        throw e;
                    } finally { connection.close(); }
                }
            };
        } catch (SQLException e) { connection.close(); throw e; }
    }

    @Override public Selection prepare(Request request, Path batches) throws SQLException, IOException, InterruptedException {
        int count = 0;
        long previousAid = 0;
        String batchId = null, recordDate = null;
        try (var connection = connections.open()) {
            connection.setReadOnly(true); connection.setAutoCommit(false);
            try (var statement = connection.prepareStatement(SELECT_SQL.formatted(
                    "incremental".equals(request.mode()) ? INCREMENTAL_FILTER : OVERWRITE_FILTER));
                 var writer = Files.newBufferedWriter(batches, StandardCharsets.UTF_8)) {
                statement.setInt(1, request.count()); statement.setFetchSize(500); statement.setQueryTimeout(120);
                try (var rows = statement.executeQuery()) {
                    var batch = new ArrayList<VideoInput>(20);
                    while (rows.next()) {
                        if (Thread.currentThread().isInterrupted()) throw new InterruptedException();
                        long aid = rows.getLong("aid");
                        if (aid <= previousAid || rows.getObject("input_aid") == null)
                            throw new SQLException("DUPLICATE_OR_MISSING_INPUT");
                        previousAid = aid;
                        String rowBatch = rows.getString("batch_id");
                        if (rowBatch == null || batchId != null && !batchId.equals(rowBatch)) throw new SQLException("MIXED_SOURCE_BATCH");
                        batchId = rowBatch; recordDate = rows.getString("record_date");
                        batch.add(new VideoInput(aid, rows.getString("title"), tags(rows.getArray("tag_new")), rows.getString("description")));
                        count++;
                        if (batch.size() == 20) { writer.write(JSON.writeValueAsString(batch)); writer.newLine(); batch.clear(); }
                    }
                    if (!batch.isEmpty()) { writer.write(JSON.writeValueAsString(batch)); writer.newLine(); }
                }
                connection.commit();
            } catch (SQLException | IOException | InterruptedException e) { connection.rollback(); throw e; }
        }
        return new Selection(count, batchId, recordDate);
    }

    private static List<String> tags(java.sql.Array array) throws SQLException {
        if (array == null) return null;
        try {
            var values = new ArrayList<String>();
            for (Object value : (Object[]) array.getArray()) {
                if (!(value instanceof String text)) throw new SQLException("INVALID_INPUT_TAGS");
                values.add(text);
            }
            return List.copyOf(values);
        } finally { array.free(); }
    }

    @Override public int save(List<VideoInput> videos, AnalysisResponse response, Context context) throws SQLException {
        if (videos.isEmpty() || videos.size() != response.results().size()) throw new SQLException("INVALID_BATCH");
        String values = String.join(",", java.util.Collections.nCopies(videos.size(), INSERT_ROW));
        String sql = INSERT_HEADER + values + "\n" + ("incremental".equals(context.mode()) ? INCREMENTAL_CONFLICT : OVERWRITE_CONFLICT);
        try (var connection = connections.open()) {
            connection.setAutoCommit(false);
            var arrays = new ArrayList<java.sql.Array>();
            try (var statement = connection.prepareStatement(sql)) {
                statement.setQueryTimeout(30);
                int parameter = 1;
                for (int i = 0; i < videos.size(); i++) {
                    var input = videos.get(i); var label = response.results().get(i);
                    if (input.aid() != label.aid()) throw new SQLException("BATCH_AID_MISMATCH");
                    statement.setLong(parameter++, input.aid());
                    statement.setString(parameter++, label.isSong()); statement.setString(parameter++, label.isVirtualSinger());
                    var languages = connection.createArrayOf("text", label.languages().toArray(String[]::new)); arrays.add(languages);
                    statement.setArray(parameter++, languages);
                    statement.setString(parameter++, context.model()); statement.setString(parameter++, context.promptSha256());
                    statement.setString(parameter++, VideoLabelInput.digest(input)); statement.setString(parameter++, context.runId());
                }
                int stored = 0;
                try (var rows = statement.executeQuery()) { while (rows.next()) stored++; }
                connection.commit();
                return stored;
            } catch (SQLException | RuntimeException e) { connection.rollback(); throw e; }
            finally { for (var array : arrays) try { array.free(); } catch (SQLException ignored) { } }
        }
    }
}
