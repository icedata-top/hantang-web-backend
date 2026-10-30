package com.hantang.web.dao;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.function.BiFunction;

/** Latest actual daily record, including data older than today or the last seven days. */
public final class LatestVideoSnapshotDate {
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;
    private final Clock clock;
    private record Cached(String date, Instant expiresAt) {}
    private volatile Cached cached;

    public LatestVideoSnapshotDate(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this(query, Clock.systemUTC());
    }
    LatestVideoSnapshotDate(BiFunction<String, List<Object>, List<Map<String, Object>>> query, Clock clock) {
        this.query = query; this.clock = clock;
    }
    public String get() {
        var value = cached;
        if (value != null && clock.instant().isBefore(value.expiresAt())) return value.date();
        synchronized (this) {
            value = cached;
            if (value != null && clock.instant().isBefore(value.expiresAt())) return value.date();
            String date = findLatest();
            cached = new Cached(date, clock.instant().plusSeconds(600));
            return date;
        }
    }
    private String findLatest() {
        var support = query.apply("SELECT to_regclass('timescaledb_information.chunks') IS NOT NULL AS supported", List.of());
        if (!support.isEmpty() && Boolean.TRUE.equals(support.getFirst().get("supported"))) {
            // Public Timescale metadata, not compressed table internals. The range is only a bound:
            // EXISTS verifies actual rows, including holes and completely empty newer chunks.
            var chunks = query.apply("""
                    SELECT DISTINCT (range_start AT TIME ZONE 'UTC')::date::text AS start_date,
                                    (range_end AT TIME ZONE 'UTC')::date::text AS end_date
                    FROM timescaledb_information.chunks
                    WHERE hypertable_schema = 'hantang_dynamic' AND hypertable_name = 'video_daily'
                    ORDER BY start_date DESC
                    """, List.of());
            if (!chunks.isEmpty()) {
                for (var chunk : chunks) {
                    LocalDate low = LocalDate.parse(chunk.get("start_date").toString());
                    LocalDate high = LocalDate.parse(chunk.get("end_date").toString());
                    LocalDate end = high;
                    if (!hasData(low, end)) continue;
                    // hasData([day,end)) is monotonic, so gaps between days do not matter.
                    while (ChronoUnit.DAYS.between(low, high) > 1) {
                        LocalDate middle = low.plusDays(ChronoUnit.DAYS.between(low, high) / 2);
                        if (hasData(middle, end)) low = middle;
                        else high = middle;
                    }
                    return low.toString();
                }
                return null;
            }
        }
        // Ordinary PostgreSQL tables can use their record_date index for this aggregate.
        var rows = query.apply("SELECT max(record_date)::text AS record_date FROM hantang_dynamic.video_daily", List.of());
        return rows.isEmpty() || rows.getFirst().get("record_date") == null
                ? null : rows.getFirst().get("record_date").toString();
    }
    private boolean hasData(LocalDate start, LocalDate end) {
        var rows = query.apply("""
                SELECT EXISTS (
                    SELECT 1 FROM hantang_dynamic.video_daily
                    WHERE record_date >= ?::date AND record_date < ?::date
                ) AS has_data
                """, List.of(start.toString(), end.toString()));
        return !rows.isEmpty() && Boolean.TRUE.equals(rows.getFirst().get("has_data"));
    }
}
