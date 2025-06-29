package dos.data.reader;

import java.util.List;
import java.util.Map;

public record VideoMetricsResponse(
        String videoIdentifier,
        String startTime,
        String endTime,
        String granularity,
        List<MetricDataPoint> dataPoints
) {
    public record MetricDataPoint(
            String timePoint,               // 按粒度分的日期或时间
            Map<String, Integer> metrics, // 每个指标的数值
            Map<String, Integer> deltaMetrics // 每个指标数值相较于上一个时间点的增幅
    ) {}
}
