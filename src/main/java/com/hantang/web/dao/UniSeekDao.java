package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.config.UniSeekVocalCatalog;
import com.hantang.web.dos.uniseek.UniSeekRequest;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.BiFunction;

public class UniSeekDao {
    static final String VIRTUAL_SONG_FILTER = "EXISTS (SELECT 1 FROM hantang_dynamic.video_content_labels l WHERE l.aid = p.aid AND l.is_virtual_singer_song)";
    static final String CHINESE_VIRTUAL_SONG_FILTER = "EXISTS (SELECT 1 FROM hantang_dynamic.video_content_labels l WHERE l.aid = p.aid AND l.is_chinese_virtual_singer_song)";
    static String scopePredicate(String scope) {
        return switch (UniSeekRequest.validateContentScope(scope)) {
            case "all" -> "true";
            case "virtual_song" -> VIRTUAL_SONG_FILTER;
            default -> CHINESE_VIRTUAL_SONG_FILTER;
        };
    }
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;
    private final Clock clock;

    private record VideoCacheKey(String keyword, String batchId) {}
    private record VideoResults(List<Map<String, Object>> rows, Instant expiresAt) {}
    private final Map<VideoCacheKey, VideoResults> videoCache = new LinkedHashMap<>(16, 0.75f, true);

    private List<Map<String, Object>> page(List<Map<String, Object>> rows, UniSeekRequest request) {
        int start = (int) Math.min(request.offset(), rows.size());
        return rows.subList(start, Math.min(start + request.pageSize() + 1, rows.size()));
    }

    public UniSeekDao() { this((sql, params) -> PostgreDao.getInstance().queryList(sql, params, 5)); }
    public UniSeekDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this(query, Clock.systemUTC());
    }
    UniSeekDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query, Clock clock) {
        this.query = query; this.clock = clock;
    }

    public List<Map<String, Object>> videos(UniSeekRequest request) {
        if (request.offset() >= UniSeekRequest.VIDEO_LIMIT) return List.of();
        // Label-filtered searches read committed labels on every page. Only the all-video
        // scope uses this ADM-only cache, so writes from another labeling process cannot
        // leave the default scope stale while the ADM batch remains unchanged.
        boolean cacheable = "all".equals(UniSeekRequest.validateContentScope(request.contentScope()));
        if (cacheable) {
            var batches = query.apply("SELECT batch_id::text AS batch_id FROM hantang_dynamic.adm_uniseek_videos LIMIT 1", List.of());
            if (batches.isEmpty()) {
                synchronized (videoCache) { videoCache.clear(); }
                return List.of();
            }
            var cacheKey = new VideoCacheKey(request.keyword(), batchId(batches.getFirst()));
            synchronized (videoCache) {
                var cached = videoCache.get(cacheKey);
                if (cached != null && clock.instant().isBefore(cached.expiresAt())) return page(cached.rows(), request);
            }
        }
        var params = new ArrayList<Object>();
        params.add(request.keyword());
        params.add(UniSeekRequest.containsPattern(request.keyword()));
        params.add(UniSeekVocalCatalog.isExactName(request.keyword()) ? 10.0 : 1.0);
        var predicates = new ArrayList<String>();
        for (String token : request.tokens()) {
            // All words must occur in the title or as an exact tag/token/singer.
            predicates.add("(p.title ILIKE ? ESCAPE '\\' OR p.tag_new @> ARRAY[?]::varchar[] "
                    + "OR p.participle @> ARRAY[?]::varchar[] OR p.label_singers @> ARRAY[?]::text[])");
            params.add(UniSeekRequest.containsPattern(token));
            params.add(token); params.add(token); params.add(token);
        }
        params.add(UniSeekRequest.VIDEO_LIMIT);
        // Provisional song ranking: source + title length ratio + logarithmic views,
        // each capped at 100. Exact singer names/aliases divide only source by 10.
        // c=100, legend reference=10,000,000 views. A unified model for all three
        // entity types will replace this heuristic later; scores are not comparable
        // with creator or vocal priorities in the frontend presentation queue.
        String sql = """
                WITH input AS (SELECT ?::text AS keyword, ?::text AS pattern, ?::double precision AS source_divisor),
                ranked AS (
                    SELECT p.aid, p.bvid, p.title, p.pic, p.pubdate, p.user_id,
                           p.view, p.favorite, p."like", p.coin, p.record_date::text, p.batch_id::text,
                           (CASE WHEN lower(p.title) = lower(i.keyword) THEN 100
                                 WHEN p.title ILIKE i.pattern ESCAPE '\\' THEN 70
                                 ELSE 40 END) / i.source_divisor
                           + CASE WHEN length(p.title) > 0
                                  THEN least(100.0, 100.0::double precision * length(i.keyword) / length(p.title))
                                  ELSE 0 END
                           + 100.0 * least(1.0, ln(1.0::double precision
                               + greatest(coalesce(p.view, 0), 0)::double precision / 100.0)
                               / ln(10000001.0::double precision / 100.0)) AS score
                    FROM hantang_dynamic.adm_uniseek_videos p CROSS JOIN input i
                    WHERE (%s) AND %s
                )
                SELECT * FROM ranked ORDER BY score DESC, aid DESC LIMIT ?
                """.formatted(String.join(" AND ", predicates), scopePredicate(request.contentScope()));
        var rows = query.apply(sql, params);
        if (!rows.isEmpty()) {
            // Publication may have committed since the cheap batch read. Cache under the batch
            // actually returned by this single SQL snapshot, never under the earlier hint.
            var resultBatch = batchId(rows.getFirst());
            if (rows.stream().anyMatch(row -> !resultBatch.equals(batchId(row)))) {
                throw new IllegalStateException("Mixed UniSeek publication batches");
            }
            if (cacheable) {
                synchronized (videoCache) {
                    videoCache.put(new VideoCacheKey(request.keyword(), resultBatch),
                            new VideoResults(List.copyOf(rows), clock.instant().plusSeconds(60)));
                    while (videoCache.size() > 16) videoCache.remove(videoCache.keySet().iterator().next());
                }
            }
        }
        return page(rows, request);
    }

    private static String batchId(Map<String, Object> row) {
        if (row.get("batch_id") == null) throw new IllegalStateException("Missing UniSeek publication batch");
        return row.get("batch_id").toString();
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
        return videoById(aid, UniSeekRequest.DEFAULT_CONTENT_SCOPE);
    }
    public List<Map<String, Object>> videoById(long aid, String contentScope) {
        return query.apply("""
                SELECT p.aid, p.bvid, p.title, p.pic, p.pubdate, p.user_id,
                       p.view, p.favorite, p."like", p.coin, p.record_date::text, p.batch_id::text
                FROM hantang_dynamic.adm_uniseek_videos p
                WHERE p.aid = ? AND %s
                LIMIT 1
                """.formatted(scopePredicate(contentScope)), List.of(aid));
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
