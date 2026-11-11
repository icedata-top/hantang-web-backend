package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;

import java.time.LocalDate;
import java.util.*;
import java.util.function.BiFunction;

/** Read-only, bounded probes of existing detail tables. No schema/maintenance operations. */
public class DataCollectionDao {
    public enum Source {
        DAILY("daily", "video_daily", null, null),
        VIDEOS("videos", "processed_videos", "updated_at", "updated"),
        CROSSINGS("crossings", "video_collection_gate_crossings", "created_at", "ingested"),
        ACCOUNTS("accounts", "discovered_users", "last_updated", "updated");

        public final String id, table, timeColumn, timeKind;
        Source(String id, String table, String timeColumn, String timeKind) {
            this.id = id; this.table = "hantang_dynamic." + table;
            this.timeColumn = timeColumn; this.timeKind = timeKind;
        }
        public static Source from(String id) {
            return Arrays.stream(values()).filter(source -> source.id.equals(id)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown collection source"));
        }
    }

    public record Metadata(Long estimatedRows, Set<String> columns) {}
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;

    public DataCollectionDao() { this((sql, params) -> PostgreDao.getInstance().queryList(sql, params, 2)); }
    public DataCollectionDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this.query = Objects.requireNonNull(query);
    }

    public Metadata metadata(Source source) {
        var rows = query.apply("""
                SELECT CASE WHEN c.reltuples >= 0 THEN round(c.reltuples)::bigint END AS estimated_rows,
                       (SELECT string_agg(a.attname, ',') FROM pg_attribute a
                        WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns
                FROM pg_class c WHERE c.oid = to_regclass(?)
                """, List.of(source.table));
        if (rows.isEmpty()) throw new IllegalStateException("Collection table is unavailable");
        var row = rows.getFirst();
        var count = row.get("estimated_rows");
        return new Metadata(count instanceof Number n ? n.longValue() : null,
                Set.copyOf(Arrays.asList(Objects.toString(row.get("columns"), "").split(","))));
    }

    public boolean hasData(Source source) {
        return Boolean.TRUE.equals(query.apply("SELECT EXISTS (SELECT 1 FROM " + source.table + ") AS has_data", List.of())
                .getFirst().get("has_data"));
    }

    public List<Map<String, Object>> dailyPresence(LocalDate start, LocalDate end) {
        return query.apply("""
                SELECT d.day::date::text AS date,
                       EXISTS (SELECT 1 FROM hantang_dynamic.video_daily v WHERE v.record_date = d.day::date) AS has_data
                FROM generate_series(?::date, ?::date, interval '1 day') d(day) ORDER BY d.day
                """, List.of(start.toString(), end.toString()));
    }

    public List<Map<String, Object>> dailyCounts(LocalDate start, LocalDate end) {
        return query.apply("""
                SELECT record_date::text AS date, COUNT(*) AS rows
                FROM hantang_dynamic.video_daily
                WHERE record_date >= ?::date AND record_date <= ?::date
                GROUP BY record_date ORDER BY record_date
                """, List.of(start.toString(), end.toString()));
    }

    public String latestTime(Source source) {
        // Identifiers come exclusively from Source, never from the URL or request body.
        return (String) query.apply("SELECT to_char(MAX(" + source.timeColumn
                + ") AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS latest_at FROM " + source.table, List.of())
                .getFirst().get("latest_at");
    }

    public long fanRows() {
        return ((Number) query.apply("""
                SELECT COUNT(*) AS rows FROM hantang_dynamic.discovered_users WHERE fans IS NOT NULL
                """, List.of()).getFirst().get("rows")).longValue();
    }
}
