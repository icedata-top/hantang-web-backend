package com.hantang.web.utils;

import com.hantang.web.dos.data.reader.VideoMetricsResponse;
import com.hantang.web.enums.Metric;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.apache.commons.collections.CollectionUtils;

import java.util.*;

/**
 * 差分计算工具
 */
@AllArgsConstructor
@Getter
public class DeltaCalculator {
    private final List<Map<String, Integer>> data;
    private final List<Metric> metrics;

    public List<VideoMetricsResponse.MetricDataPoint> calc() {
        List<VideoMetricsResponse.MetricDataPoint> list = new ArrayList<>();
        if (CollectionUtils.isEmpty(data)) {
            return list;
        }

        // 升序排序
        data.sort(Comparator.comparing(
                map -> map.get("timestamp"),
                Comparator.nullsFirst(Integer::compareTo)
        ));

        // 处理每一行
        for (int i = 0; i < data.size(); i++) {
            Map<String, Integer> curRow = data.get(i);
            String timePoint = IsoTimeUtils.formatTimestamp(curRow.get("timestamp"));
            VideoMetricsResponse.MetricDataPoint point = new VideoMetricsResponse.MetricDataPoint(
                    timePoint, new HashMap<>(), new HashMap<>()
            );
            // 本时间点的全部数据
            point.metrics().putAll(curRow);
            // 和上一个时间点的全部数据做差（如果有上一期）
            if (i == 0) {
                continue;
            }
            Map<String, Integer> lastRow = data.get(i - 1);
            for (String field : curRow.keySet()) {
                int curValue = curRow.get(field);
                int lastValue = lastRow.get(field);
                point.deltaMetrics().put(field, curValue - lastValue);
            }
            list.add(point);
        }
        return list;
    }
}
