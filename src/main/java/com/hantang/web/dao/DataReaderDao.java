package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;
import com.hantang.web.enums.Metric;
import com.hantang.web.exceptions.InvalidVideoIdentifierException;
import org.apache.commons.lang3.StringUtils;

import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Deprecated
public class DataReaderDao {

    private final PostgreDao postgreDao;

    public DataReaderDao() {
        postgreDao = PostgreDao.getInstance();
    }

    /**
     * 根据视频名称查询视频的 AV 号
     * @param videoName 视频名称
     * @return 视频的 AV 号
     */
    public long getAidByVideoName(String videoName) throws InvalidVideoIdentifierException, SQLException {
        if (StringUtils.isEmpty(videoName)) {
            throw new InvalidVideoIdentifierException("Empty videoName" + videoName);
        }
        String sql = """
                SELECT aid
                FROM hantang_dynamic.video_static
                WHERE title ILIKE ? AND priority > 0
                ORDER BY priority, pubdate
                LIMIT 1
                """;
        List<Map<String, Object>> rows = postgreDao.queryList(sql, List.of("%" + videoName + "%"));
        if (!rows.isEmpty()) {
            return toLong(rows.getFirst().get("aid"));
        }
        throw new InvalidVideoIdentifierException("Cannot find in DB for videoName: " + videoName);
    }

    /**
     * 获取某指标超越目标的最早时间点
     * @param aid 视频的 AV 号
     * @param metric 指标
     * @param target 目标数据
     * @param upper True 达成之后的第一条数据；False 达成之前的最后一条数据。
     * @return UNIX时间戳和指标
     */
    public Map<String, Integer> getMetricAchievedTime(long aid, Metric metric, int target, boolean upper) throws SQLException {
        String field = quoteMetricField(metric);
        String sqlTemplate = upper ?
                """
                SELECT EXTRACT(EPOCH FROM "time")::int AS time, %s
                FROM hantang_dynamic.video_minute
                WHERE aid = ? AND %s >= ?
                ORDER BY "view", "time"
                LIMIT 1
                """ :
                """
                SELECT EXTRACT(EPOCH FROM "time")::int AS time, %s
                FROM hantang_dynamic.video_minute
                WHERE aid = ? AND %s < ?
                ORDER BY "view" DESC, "time" DESC
                LIMIT 1
                """;
        String sql = String.format(sqlTemplate, field, field);
        List<Map<String, Object>> rows = postgreDao.queryList(sql, List.of(aid, target));
        if (!rows.isEmpty()) {
             Map<String, Object> row = rows.getFirst();
             return Map.of("timestamp", toInt(row.get("time")), "value", toInt(row.get(metric.getField())));
        }
        // 没有找到符合条件的记录
        return Map.of("timestamp", -1, "value", -1);
    }

    /**
     * 按天查询某个视频在时间段内各个指标数据
     * @param aid 视频的 AV 号
     * @param metricList 指标列表
     * @param startDate 开始日期（含）
     * @param endDate 结束日期（含）
     * @return UNIX时间戳和指标 的列表
     */
    public List<Map<String, Integer>> getVideoMetricsByDay(long aid, List<Metric> metricList, String startDate, String endDate) throws SQLException {
        List<String> metricNameList = metricList.stream()
                .map(this::quoteMetricField)
                .toList();
        String fieldsString = String.join(", ", metricNameList);
        String sql = String.format("""
                SELECT EXTRACT(EPOCH FROM record_date::timestamp)::int AS time, %s
                FROM hantang_dynamic.video_daily
                WHERE aid = ?
                  AND record_date BETWEEN ?::date AND ?::date
                ORDER BY record_date
                LIMIT 100
                """, fieldsString);
        List<Map<String, Object>> rows = postgreDao.queryList(sql, List.of(aid, startDate, endDate));
        List<Map<String, Integer>> rowList = new ArrayList<>();
        for (Map<String, Object> dbRow : rows) {
            Map<String, Integer> row = new HashMap<>();
            row.put("timestamp", toInt(dbRow.get("time")));
            for (Metric metric : metricList) {
                String metricField = metric.getField();
                row.put(metricField, toInt(dbRow.get(metricField)));
            }
            rowList.add(row);
        }
        return rowList;
    }

    /**
     * 按分钟查询某个视频在时间段内各个指标数据
     * @param aid 视频的 AV 号
     * @param metricList 指标列表
     * @param startUnixTimestamp 开始时间戳（含）
     * @param endUnixTimestamp 结束时间戳（含）
     * @return UNIX时间戳和指标 的列表
     */
    public List<Map<String, Integer>> getVideoMetricsByMinute(long aid, List<Metric> metricList, int startUnixTimestamp, int endUnixTimestamp) {
        List<Map<String, Integer>> rowList = new ArrayList<>();

        return rowList;
    }

    private String quoteMetricField(Metric metric) {
        return "\"" + metric.getField() + "\"";
    }

    private int toInt(Object o) {
        if (o == null) {
            return 0;
        }
        if (o instanceof Number n) {
            return n.intValue();
        }
        return Integer.parseInt(o.toString());
    }

    private long toLong(Object o) {
        if (o == null) {
            return 0L;
        }
        if (o instanceof Number n) {
            return n.longValue();
        }
        return Long.parseLong(o.toString());
    }
}
