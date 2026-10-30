package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.dos.uniseek.UniSeekRequest;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.BiFunction;

public class UniSeekDao {
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;

    private record VideoResults(List<Map<String, Object>> rows, Instant expiresAt) {}
    private final Map<String, VideoResults> videoCache = new LinkedHashMap<>(16, 0.75f, true);

    private List<Map<String, Object>> page(List<Map<String, Object>> rows, UniSeekRequest request) {
        int start = (int) Math.min(request.offset(), rows.size());
        return rows.subList(start, Math.min(start + request.pageSize() + 1, rows.size()));
    }

    private final LatestVideoSnapshotDate snapshotDate;

    public UniSeekDao() { this((sql, params) -> PostgreDao.getInstance().queryList(sql, params, 5)); }
    public UniSeekDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this(query, Clock.systemUTC());
    }
    UniSeekDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query, Clock clock) {
        this.query = query; this.snapshotDate = new LatestVideoSnapshotDate(query, clock);
    }

    public List<Map<String, Object>> videos(UniSeekRequest request) {
        if (request.offset() >= UniSeekRequest.VIDEO_LIMIT) return List.of();
        String date = snapshotDate.get();
        if (date == null) return List.of();
        String cacheKey = request.keyword() + "\0" + date;
        synchronized (videoCache) {
            var cached = videoCache.get(cacheKey);
            if (cached != null && Instant.now().isBefore(cached.expiresAt())) return page(cached.rows(), request);
        }
        var params = new ArrayList<Object>();
        params.add(request.keyword());
        params.add(UniSeekRequest.containsPattern(request.keyword()));
        var predicates = new ArrayList<String>();
        for (String token : request.tokens()) {
            // All words must occur in the title or as an exact tag/token/singer.
            String titleMatch = token.codePointCount(0, token.length()) >= 3 ? "p.title ILIKE ? ESCAPE '\\' OR " : "";
            predicates.add("(" + titleMatch + "p.tag_new @> ARRAY[?]::varchar[] "
                    + "OR p.participle @> ARRAY[?]::varchar[] OR p.label_singers @> ARRAY[?]::text[])");
            if (!titleMatch.isEmpty()) params.add(UniSeekRequest.containsPattern(token));
            params.add(token); params.add(token); params.add(token);
        }
        params.add(date);
        params.add(UniSeekRequest.VIDEO_LIMIT);
        params.add(0L);
        String sql = """
                WITH input AS (SELECT ?::text AS keyword, ?::text AS pattern),
                candidates AS MATERIALIZED (
                    SELECT p.aid, p.bvid, p.title, p.pic, p.pubdate, p.user_id,
                           CASE WHEN lower(p.title) = lower(i.keyword) THEN 900
                                WHEN p.title ILIKE i.pattern ESCAPE '\\' THEN 600
                                ELSE 400 END
                           + CASE WHEN p.title ILIKE i.pattern ESCAPE '\\'
                                  THEN 60.0::double precision * length(i.keyword) / greatest(length(p.title), 1) ELSE 0 END AS text_score
                    FROM hantang_dynamic.processed_videos p CROSS JOIN input i
                    WHERE p.is_deleted = false AND
                          (%s)
                    ORDER BY text_score DESC, p.aid DESC
                    LIMIT 1000
                ), ranked AS (
                    SELECT p.*, d.view, d.favorite, d."like", d.coin, d.record_date::text, d.snapshot_count,
                           p.text_score + least(40.0, 4.0 * ln(1.0::double precision + greatest(coalesce(d.view, 0), 0))) AS score
                    FROM candidates p
                    JOIN LATERAL (
                        SELECT min(view) AS view, min(favorite) AS favorite, min("like") AS "like",
                               min(coin) AS coin, record_date, count(*) AS snapshot_count
                        FROM hantang_dynamic.video_daily
                        WHERE aid = p.aid AND record_date = ?::date
                        GROUP BY record_date
                    ) d ON TRUE
                    WHERE d."like" > 10
                )
                SELECT * FROM ranked ORDER BY score DESC, aid DESC LIMIT ? OFFSET ?
                """.formatted(String.join(" AND ", predicates));
        var rows = query.apply(sql, params);
        if (rows.stream().anyMatch(row -> row.get("snapshot_count") instanceof Number count && count.longValue() > 1)) {
            throw new IllegalStateException("Duplicate search-day video snapshots");
        }
        synchronized (videoCache) {
            videoCache.put(cacheKey, new VideoResults(List.copyOf(rows), Instant.now().plusSeconds(60)));
            while (videoCache.size() > 16) videoCache.remove(videoCache.keySet().iterator().next());
        }
        return page(rows, request);
    }

    public List<Map<String, Object>> producers(UniSeekRequest request) {
        return query.apply("""
                SELECT user_id, user_name, face, sign, fans, videos_filtered, filtered_view,
                       (user_name = ?) AS exact_match
                FROM hantang_dynamic.discovered_users
                WHERE videos_filtered > 0 AND face IS NOT NULL AND face ~ '[^[:space:]]'
                  AND user_name ILIKE ? ESCAPE '\\'
                ORDER BY exact_match DESC, fans DESC NULLS LAST, user_id DESC LIMIT 20
                """, List.of(request.keyword(), UniSeekRequest.containsPattern(request.keyword())));
    }

    public List<Map<String, Object>> videoById(long aid) {
        String date = snapshotDate.get();
        if (date == null) return List.of();
        var rows = query.apply("""
                WITH input AS (SELECT ?::bigint AS aid, ?::date AS record_date)
                SELECT p.aid, p.bvid, p.title, p.pic, p.pubdate, p.user_id,
                       d.view, d.favorite, d."like", d.coin, d.record_date::text, d.snapshot_count
                FROM input i
                JOIN hantang_dynamic.processed_videos p ON p.aid = i.aid
                JOIN LATERAL (
                    SELECT min(view) AS view, min(favorite) AS favorite, min("like") AS "like",
                           min(coin) AS coin, record_date, count(*) AS snapshot_count
                    FROM hantang_dynamic.video_daily
                    WHERE aid = p.aid AND record_date = i.record_date
                    GROUP BY record_date
                ) d ON TRUE
                WHERE p.is_deleted = false AND d."like" > 10
                LIMIT 1
                """, List.of(aid, date));
        if (rows.stream().anyMatch(row -> row.get("snapshot_count") instanceof Number count && count.longValue() > 1)) {
            throw new IllegalStateException("Duplicate search-day video snapshots");
        }
        return rows;
    }

    public List<Map<String, Object>> producerById(long userId) {
        return query.apply("""
                SELECT user_id, user_name, face, sign, fans, videos_filtered, filtered_view
                FROM hantang_dynamic.discovered_users
                WHERE user_id = ? AND videos_filtered > 0
                  AND face IS NOT NULL AND face ~ '[^[:space:]]'
                LIMIT 1
                """, List.of(userId));
    }
}
