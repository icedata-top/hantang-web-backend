package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;

/**
 * 首页统计。行数使用 {@code pg_class.reltuples} 估算，避免全表 COUNT(*)；
 * 数据以 ANALYZE / autovacuum 更新为准，略有偏差可接受。
 */
public class HomeDao {
    private final PostgreDao postgreDao = PostgreDao.getInstance();

    /** reltuples 未统计时可能为 -1，这里按 0 处理 */
    private static final String ESTIMATED_ROWS_PROCESSED_VIDEOS =
            "SELECT CASE WHEN c.reltuples < 0 THEN 0 ELSE COALESCE(c.reltuples::bigint, 0) END AS estimated_count "
                    + "FROM pg_class c "
                    + "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    + "WHERE c.relname = 'processed_videos' "
                    + "AND n.nspname = 'hantang_dynamic'";

    private static final String ESTIMATED_ROWS_DISCOVERED_USERS =
            "SELECT CASE WHEN c.reltuples < 0 THEN 0 ELSE COALESCE(c.reltuples::bigint, 0) END AS estimated_count "
                    + "FROM pg_class c "
                    + "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    + "WHERE c.relname = 'discovered_users' "
                    + "AND n.nspname = 'hantang_dynamic'";

    /** 已处理视频表估算行数 */
    public long countVideos() {
        return postgreDao.queryLong(ESTIMATED_ROWS_PROCESSED_VIDEOS);
    }

    /** 发现用户表估算行数 */
    public long countDistinctUsers() {
        return postgreDao.queryLong(ESTIMATED_ROWS_DISCOVERED_USERS);
    }
}
