package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.dos.producer.ProducerVideosRequest;
import com.hantang.web.dos.producer.ProducerListRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiFunction;

public class ProducerDao {
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;

    public ProducerDao() {
        this(PostgreDao.getInstance()::queryList);
    }

    public ProducerDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this.query = Objects.requireNonNull(query);
    }

    public Optional<Map<String, Object>> findInfo(long userId) {
        var rows = query.apply("""
                SELECT user_id, user_name, face, sign, fans, level, official_role, official_title,
                       to_char(last_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_updated
                FROM hantang_dynamic.discovered_users
                WHERE user_id = ?
                LIMIT 2
                """, List.of(userId));
        if (rows.size() > 1) throw new IllegalStateException("Duplicate account records for userId=" + userId);
        return rows.stream().findFirst();
    }

    public record VideoPage(long total, List<Map<String, Object>> rows) {}

    public VideoPage findVideos(ProducerVideosRequest request) {
        // Only validated values select SQL fragments; all numeric inputs remain bound parameters.
        String predicate = request.role().equals("staff") ? "p.staff @> ARRAY[?]::bigint[]" : "p.user_id = ?";
        String field = request.sortBy().equals("view") ? "view" : "pubdate";
        String direction = request.order().equals("asc") ? "ASC" : "DESC";
        String sql = """
                WITH candidates AS MATERIALIZED (
                    SELECT p.aid, p.bvid, p.title, p.pubdate, p.pic, p.user_id
                    FROM hantang_dynamic.processed_videos AS p
                    WHERE %s
                ), totals AS (
                    SELECT COUNT(*) AS total, COUNT(DISTINCT aid) AS unique_total FROM candidates
                ), page_rows AS (
                    SELECT p.*, m.view, m.record_date::text AS record_date, m.snapshot_count
                    FROM candidates AS p
                    LEFT JOIN LATERAL (
                        SELECT d.record_date, MIN(d.view) AS view, COUNT(*) AS snapshot_count
                        FROM hantang_dynamic.video_daily AS d
                        WHERE d.aid = p.aid
                          AND d.record_date = (
                              SELECT MAX(latest.record_date)
                              FROM hantang_dynamic.video_daily AS latest WHERE latest.aid = p.aid
                          )
                        GROUP BY d.record_date
                    ) AS m ON TRUE
                    ORDER BY %s %s NULLS LAST, p.aid ASC
                    LIMIT ? OFFSET ?
                )
                SELECT totals.total, totals.unique_total, page_rows.*
                FROM totals LEFT JOIN page_rows ON TRUE
                ORDER BY page_rows.%s %s NULLS LAST, page_rows.aid ASC
                """.formatted(predicate, field, direction, field, direction);
        var result = query.apply(sql, List.of(request.userId(), request.pageSize(), request.offset()));
        if (result.isEmpty()) throw new IllegalStateException("Missing pagination totals");
        long total = ((Number) result.getFirst().get("total")).longValue();
        long uniqueTotal = ((Number) result.getFirst().get("unique_total")).longValue();
        if (total != uniqueTotal) throw new IllegalStateException("Duplicate video metadata for userId=" + request.userId());
        var rows = result.stream().filter(row -> row.get("aid") != null).toList();
        for (var row : rows) {
            if (row.get("snapshot_count") instanceof Number count && count.longValue() > 1) {
                throw new IllegalStateException("Duplicate latest daily snapshots for aid=" + row.get("aid"));
            }
        }
        return new VideoPage(total, rows);
    }

    public record ProducerPage(long total, List<Map<String, Object>> rows) {}

    public ProducerPage findList(ProducerListRequest request) {
        var params = new ArrayList<Object>();
        var filters = new ArrayList<String>();
        // Browse the same eligible accounts as UniSeek, without keyword matching or a result cap.
        filters.add("u.user_id > 0 AND u.videos_filtered > 0 AND u.face IS NOT NULL AND u.face ~ '[^[:space:]]'");
        if (request.minFans() != null) { filters.add("u.fans >= ?"); params.add(request.minFans()); }
        if (request.minVideos() != null) { filters.add("u.videos_filtered >= ?"); params.add(request.minVideos()); }
        String column = switch (request.sortBy()) {
            case "videoCount" -> "videos_filtered";
            case "userId" -> "user_id";
            default -> "fans";
        };
        params.add(request.pageSize());
        params.add(request.offset());
        String sql = """
                WITH filtered AS NOT MATERIALIZED (
                    SELECT u.user_id, u.user_name, u.face, u.sign, u.fans, u.videos_filtered,
                           u.level, u.official_role, u.official_title,
                           to_char(u.last_updated AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_updated
                    FROM hantang_dynamic.discovered_users u
                    WHERE %s
                ), totals AS (
                    SELECT COUNT(*) AS total, COUNT(DISTINCT user_id) AS unique_total FROM filtered
                )
                SELECT page.*, totals.total, totals.unique_total
                FROM totals LEFT JOIN LATERAL (
                    SELECT * FROM filtered ORDER BY %s %s NULLS LAST, user_id DESC LIMIT ? OFFSET ?
                ) page ON true
                ORDER BY page.%s %s NULLS LAST, page.user_id DESC
                """.formatted(String.join(" AND ", filters), column, request.order(), column, request.order());
        var result = query.apply(sql, params);
        if (result.isEmpty()) throw new IllegalStateException("Missing producer pagination totals");
        long total = ((Number) result.getFirst().get("total")).longValue();
        if (total != ((Number) result.getFirst().get("unique_total")).longValue()) {
            throw new IllegalStateException("Duplicate producer account records");
        }
        return new ProducerPage(total, result.stream().filter(row -> row.get("user_id") != null).toList());
    }
}
