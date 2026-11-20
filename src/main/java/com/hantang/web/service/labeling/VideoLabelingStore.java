package com.hantang.web.service.labeling;

import com.hantang.web.api.LlmClient.AnalysisResponse;
import com.hantang.web.api.LlmClient.VideoInput;
import com.hantang.web.task.VideoTypeAndLanguageAnalysisTask;
import java.io.IOException;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.List;

/** Database boundary; no paid requests or automatic schema creation. */
public interface VideoLabelingStore {
    int MAX_RUN_COUNT = 200_000;
    record Request(String mode, int count, int concurrency) {
        public Request {
            if (!("incremental".equals(mode) || "overwrite".equals(mode)) || count < 1 || count > MAX_RUN_COUNT
                    || !VideoTypeAndLanguageAnalysisTask.CONCURRENCY_OPTIONS.contains(concurrency))
                throw new IllegalArgumentException("INVALID_LABELING_OPTIONS");
        }
    }
    record Overview(long total_count, long labeled_count, long unlabeled_count, long manual_count,
                    long virtual_song_count, long chinese_virtual_song_count) {
        public long available(String mode) { return "overwrite".equals(mode) ? total_count - manual_count : unlabeled_count; }
    }
    record Selection(int count, String batchId, String recordDate) { }
    record Context(String mode, String runId, String model, String promptSha256) { }
    interface Lease extends AutoCloseable {
        void verify() throws SQLException;
        @Override void close() throws SQLException;
    }
    Overview overview() throws SQLException;
    Lease acquire() throws SQLException;
    Selection prepare(Request request, Path batches) throws SQLException, IOException, InterruptedException;
    /** Returns committed row count, excluding conflict/manual-protected rows. All rows commit atomically. */
    int save(List<VideoInput> videos, AnalysisResponse response, Context context) throws SQLException;
}
