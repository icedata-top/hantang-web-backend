package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiFunction;

public class DailyDao {
    private final BiFunction<String, List<Object>, List<Map<String, Object>>> query;

    public DailyDao() {
        this(PostgreDao.getInstance()::queryList);
    }

    public DailyDao(BiFunction<String, List<Object>, List<Map<String, Object>>> query) {
        this.query = Objects.requireNonNull(query);
    }

    /** 全表最新记录日；空表（或日期全为 NULL）返回 null。 */
    public String findLatestRecordDate() {
        var rows = query.apply("""
                SELECT MAX(record_date)::text AS latest_record_date
                FROM hantang_dynamic.video_daily
                """, List.of());
        return (String) rows.getFirst().get("latest_record_date");
    }
}
