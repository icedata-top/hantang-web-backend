package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;

import java.util.*;
import java.util.function.BiFunction;

public class DataProcessingDao {
    public enum Source {
        SEARCH("search", "PostgreSQL", "full", "adm_uniseek_videos", "adm_uniseek_refresh_state",
                "hantang-uniseek-search-refresh", "*/10 * * * *"),
        AGGREGATION("aggregation", "PostgreSQL", "by_day", "adm_entity_metrics_daily", "adm_aggregation_task",
                "hantang-adm-daily", "*/5 * * * *"),
        SCHEDULER("scheduler", "pg_cron", "inventory", null, null, null, null);
        public final String id, engine, mode, table, control, job, schedule;
        Source(String id, String engine, String mode, String table, String control, String job, String schedule) {
            this.id = id; this.engine = engine; this.mode = mode; this.table = table;
            this.control = control; this.job = job; this.schedule = schedule;
        }
        public static Source from(String id) {
            return Arrays.stream(values()).filter(source -> source.id.equals(id)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown processing source"));
        }
    }
    public record Metadata(boolean exists, boolean readable, Long estimatedRows) {}
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;
    public DataProcessingDao() { this((sql, params) -> PostgreDao.getInstance().queryList(sql, params, 2)); }
    public DataProcessingDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) { this.query = Objects.requireNonNull(query); }

    /** OID-based privilege checks work even when schema USAGE is denied. */
    public Metadata metadata(String schema, String table) {
        var rows = query.apply("""
                SELECT has_schema_privilege(n.oid, 'USAGE') AND has_table_privilege(c.oid, 'SELECT') AS readable,
                       CASE WHEN c.reltuples >= 0 THEN round(c.reltuples)::bigint END AS estimated_rows
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = ? AND c.relname = ? AND c.relkind IN ('r', 'p', 'v', 'm')
                """, List.of(schema, table));
        if (rows.isEmpty()) return new Metadata(false, false, null);
        var row = rows.getFirst();
        return new Metadata(true, Boolean.TRUE.equals(row.get("readable")), number(row.get("estimated_rows")));
    }

    public Map<String, Object> searchSnapshot() {
        return query.apply("""
                SELECT COUNT(*) AS rows, MIN(record_date)::text AS first_date, MAX(record_date)::text AS data_date,
                       MIN(batch_id::text) AS batch_id, COUNT(DISTINCT batch_id) AS batches,
                       to_char(MAX(refreshed_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
                FROM hantang_dynamic.adm_uniseek_videos
                """, List.of()).getFirst();
    }

    public Map<String, Object> aggregateSnapshot() {
        return query.apply("""
                WITH latest AS (SELECT MAX(stat_date) AS date FROM hantang_dynamic.adm_entity_metrics_daily)
                SELECT COUNT(*) AS rows, MAX(stat_date)::text AS data_date,
                       MIN(batch_id::text) AS batch_id, COUNT(DISTINCT batch_id) AS batches,
                       BOOL_AND(is_complete) AS complete,
                       to_char(MAX(computed_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
                FROM hantang_dynamic.adm_entity_metrics_daily WHERE stat_date = (SELECT date FROM latest)
                """, List.of()).getFirst();
    }

    public List<Map<String, Object>> publication() {
        return query.apply("""
                SELECT requested_record_date::text AS requested_date, published_record_date::text AS published_date,
                       requested_batch_id IS DISTINCT FROM published_batch_id AS pending
                FROM hantang_dynamic.adm_uniseek_refresh_state WHERE singleton LIMIT 2
                """, List.of());
    }

    public List<Map<String, Object>> latestTask() {
        return query.apply("""
                SELECT stat_date::text AS date, status, attempt_count, max_attempts,
                       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
                       to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at,
                       to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
                FROM hantang_dynamic.adm_aggregation_task ORDER BY updated_at DESC, stat_date DESC LIMIT 1
                """, List.of());
    }

    public List<Map<String, Object>> jobs(boolean history) {
        // Never return SQL commands, connection endpoints, credentials or error messages.
        String sql = history ? """
                SELECT j.jobid, j.jobname, j.schedule, j.active, r.status AS last_status,
                       to_char(r.start_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS started_at,
                       to_char(r.end_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS finished_at
                FROM cron.job j LEFT JOIN LATERAL (
                    SELECT status, start_time, end_time FROM cron.job_run_details
                    WHERE jobid = j.jobid ORDER BY runid DESC LIMIT 1
                ) r ON true
                WHERE j.database = current_database() ORDER BY j.jobid LIMIT 101
                """ : """
                SELECT jobid, jobname, schedule, active FROM cron.job
                WHERE database = current_database() ORDER BY jobid LIMIT 101
                """;
        return query.apply(sql, List.of());
    }

    public static Long number(Object value) { return value instanceof Number n ? n.longValue() : null; }
}
