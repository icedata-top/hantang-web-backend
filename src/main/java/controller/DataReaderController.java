package controller;
import dos.common.ResponseDTO;
import dos.data.reader.MetricAchievedTimeRequest;
import dos.data.reader.MetricAchievedTimeResponse;
import dos.data.reader.VideoMetricsRequest;
import dos.data.reader.VideoMetricsResponse;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 数据读取 Controller
 */
public class DataReaderController extends BaseController  {
    @Override
    public void registerRoutes(Javalin app) {
        app.get("/hello-world", this::getHelloWorld);
        app.post("/hantang/metric-achieved-time", this::getMetricAchievedTime);
        app.post("/hantang/video-metrics", this::getVideoMetrics);
    }

    /**
     * Hello World 用于点火测试后端框架是否正常启动
     */
    private void getHelloWorld(Context context) {
        context.json("Hello World");
    }

    /**
     * 查询某个视频的某项指标在什么时候达成指定数值
     * MOCK: {
     *   "videoIdentifier": "霜雪千年",
     *   "metric": "view",
     *   "target": 3000000
     * }
     */
    private void getMetricAchievedTime(Context context) {
        // 1. 解析请求体
        MetricAchievedTimeRequest request = context.bodyAsClass(MetricAchievedTimeRequest.class);

        // 2. TODO: 这里是实际业务逻辑，查询数据库或其他服务
        // 模拟返回一个固定时间
        String achievedTime = LocalDateTime.now()
                .minusDays(10)  // 假设 10 天前达成
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));

        // 3. 返回结果
        MetricAchievedTimeResponse response = new MetricAchievedTimeResponse(
                request.videoIdentifier(),
                request.metric(),
                request.target(),
                achievedTime
        );
        context.json(ResponseDTO.success(response));
    }

    /**
     * 查询某个视频在时间段内，按粒度统计多项指标
     * MOCK Request:
     * {
     *   "videoIdentifier": "霜雪千年",
     *   "startTime": "2025-06-23",
     *   "endTime": "2025-06-28",
     *   "granularity": "DAY",
     *   "metrics": ["view", "favorite", "like"]
     * }
     */
    private void getVideoMetrics(Context context) {
        VideoMetricsRequest request = context.bodyAsClass(VideoMetricsRequest.class);
        // TODO: 实际逻辑调用 Service，这里是 MOCK
        List<VideoMetricsResponse.MetricDataPoint> dataPoints = List.of(
                new VideoMetricsResponse.MetricDataPoint(
                        "2025-06-25",
                        Map.of("view", 1200, "favorite", 100, "like", 30),
                        Map.of("view", 0, "favorite", 0, "like", 0)
                ),
                new VideoMetricsResponse.MetricDataPoint(
                        "2025-06-26",
                        Map.of("view", 1500, "favorite", 120, "like", 40),
                        Map.of("view", 300, "favorite", 20, "like", 10)
                ),
                new VideoMetricsResponse.MetricDataPoint(
                        "2025-06-27",
                        Map.of("view", 1800, "favorite", 150, "like", 50),
                        Map.of("view", 300, "favorite", 30, "like", 10)
                ),
                new VideoMetricsResponse.MetricDataPoint(
                        "2025-06-28",
                        Map.of("view", 2000, "favorite", 180, "like", 60),
                        Map.of("view", 200, "favorite", 30, "like", 10)
                )
        );
        VideoMetricsResponse response = new VideoMetricsResponse(
                request.videoIdentifier(),
                request.startTime(),
                request.endTime(),
                request.granularity(),
                dataPoints
        );
        context.json(ResponseDTO.success(response));
    }
}
