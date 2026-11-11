package com.hantang.web.dos.admin;

import java.util.List;

/** Presence is observed; estimatedRows is a planner estimate, never an exact count. */
public record DataCollectionResponse(
        String source, String table, String checkedAt, String startDate, String endDate,
        String health, boolean hasData, Long estimatedRows, String latestRecordDate,
        String latestAt, String timeKind, Long fanRows, boolean partial, List<Day> days
) {
    public record Day(String date, boolean hasData, Long rows) {}
}
