package com.hantang.web.dos.video;

import java.util.List;
import java.util.Map;

/** Every requested date is present; absent snapshots and individual null metrics stay explicit. */
public record VideoDailyMetricsResponse(long aid, String startDate, String endDate, List<DailySnapshot> rows) {
    public record DailySnapshot(String date, boolean snapshotMissing, Map<String, Long> indicators) {}
}
