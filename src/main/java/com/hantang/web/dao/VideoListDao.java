package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.dos.video.VideoListRequest;
import java.util.*;
import java.util.function.BiFunction;

public class VideoListDao {
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;
    public VideoListDao() { this((sql, params) -> PostgreDao.getInstance().queryList(sql, params, 5)); }
    public VideoListDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) { this.query = query; }

    public List<Map<String, Object>> list(VideoListRequest request) {
        var filters = new ArrayList<String>();
        var params = new ArrayList<Object>();
        if (request.startDate() != null) { filters.add("p.pubdate >= ?"); params.add(request.startEpoch()); }
        if (request.endDate() != null) { filters.add("p.pubdate < ?"); params.add(request.endEpochExclusive()); }
        switch (request.honor()) {
            case "none" -> filters.add("p.view >= 0 AND p.view < 100000");
            case "hall" -> filters.add("p.view >= 100000 AND p.view < 1000000");
            case "legend" -> filters.add("p.view >= 1000000 AND p.view < 10000000");
            case "myth" -> filters.add("p.view >= 10000000");
        }
        if (request.minView() != null) { filters.add("p.view >= ?"); params.add(request.minView()); }
        if (request.typeId() != null) {
            // Only metadata is consulted for the legacy partition ID; never join daily history.
            filters.add("EXISTS (SELECT 1 FROM hantang_dynamic.processed_videos s WHERE s.aid = p.aid AND s.type_id = ?)");
            params.add(request.typeId());
        }
        params.add(request.pageSize()); params.add(request.offset());
        // These identifiers are whitelisted by VideoListRequest. Count and page share one SQL snapshot,
        // including an empty page; NOT MATERIALIZED avoids spooling the entire publication to disk.
        String column = "like".equals(request.sortBy()) ? "\"like\"" : request.sortBy();
        String sql = """
                WITH filtered AS NOT MATERIALIZED (
                    SELECT p.aid, p.bvid, p.title, p.pic, p.pubdate, p.user_id,
                           p.view, p.favorite, p."like", p.coin, p.record_date::text AS record_date
                    FROM hantang_dynamic.adm_uniseek_videos p
                    WHERE %s
                ), totals AS (SELECT count(*) AS total, max(record_date) AS record_date FROM filtered)
                SELECT page.*, totals.total, totals.record_date AS snapshot_date
                FROM totals LEFT JOIN LATERAL (
                    SELECT * FROM filtered ORDER BY %s %s NULLS LAST, aid DESC LIMIT ? OFFSET ?
                ) page ON true
                """.formatted(filters.isEmpty() ? "true" : String.join(" AND ", filters), column, request.order());
        return query.apply(sql, params);
    }
}
