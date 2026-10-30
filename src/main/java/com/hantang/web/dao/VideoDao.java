package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.dos.video.VideoDailyMetricsRequest;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiFunction;

public class VideoDao {
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;

    public VideoDao() {
        this(PostgreDao.getInstance()::queryList);
    }

    public VideoDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this.query = Objects.requireNonNull(query);
    }

    public Optional<Map<String, Object>> findInfo(long aid) {
        List<Map<String, Object>> rows = query.apply("""
                SELECT p.aid, p.bvid, p.title, p.pubdate, p.description, p.pic,
                       p.tag, to_json(p.tag_new)::text AS tag_new_json,
                       p.type_id, p.tid_v2, p.pid_v2, p.copyright,
                       p.extras->>'duration' AS duration,
                       p.user_id, u.user_name, u.face AS user_face,
                       u.sign AS user_sign, u.official_title
                FROM hantang_dynamic.processed_videos AS p
                LEFT JOIN hantang_dynamic.discovered_users AS u ON u.user_id = p.user_id
                WHERE p.aid = ?
                LIMIT 2
                """, List.of(aid));
        if (rows.size() > 1) {
            throw new IllegalStateException("Duplicate video metadata or uploader records for aid=" + aid);
        }
        return rows.stream().findFirst();
    }

    public Optional<Map<String, Object>> findLatestMetrics(long aid) {
        List<Map<String, Object>> rows = query.apply("""
                SELECT aid, record_date::text AS record_date,
                       view, "like", coin, favorite, share, reply, danmaku
                FROM hantang_dynamic.video_daily
                WHERE aid = ?
                ORDER BY record_date DESC
                LIMIT 2
                """, List.of(aid));
        if (rows.size() > 1 && Objects.equals(rows.get(0).get("record_date"), rows.get(1).get("record_date"))) {
            throw new IllegalStateException("Duplicate latest daily snapshots for aid=" + aid);
        }
        return rows.stream().findFirst();
    }

    public List<Map<String, Object>> findDailyMetrics(VideoDailyMetricsRequest request) {
        return query.apply("""
                SELECT record_date::text AS record_date,
                       view, "like", coin, favorite, share, reply, danmaku
                FROM hantang_dynamic.video_daily
                WHERE aid = ? AND record_date BETWEEN ?::date AND ?::date
                ORDER BY record_date ASC
                """, List.of(request.aid(), request.startDate().toString(), request.endDate().toString()));
    }
}
