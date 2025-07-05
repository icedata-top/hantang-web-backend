package controller;
import dos.common.ResponseDTO;
import dos.data.reader.MetricAchievedTimeRequest;
import dos.data.reader.MetricAchievedTimeResponse;
import dos.data.reader.VideoMetricsRequest;
import dos.data.reader.VideoMetricsResponse;
import io.javalin.Javalin;
import io.javalin.http.Context;
import service.DataReaderService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * 数据读取 Controller
 */
public class DataReaderController extends BaseController  {
    private final DataReaderService dataReaderService;

    public DataReaderController() {
        // 不是 Spring Boot 框架，不能自动装填，只能手动。
        this.dataReaderService = new DataReaderService();
    }

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
        MetricAchievedTimeRequest request = context.bodyAsClass(MetricAchievedTimeRequest.class);
        String achievedTime = dataReaderService.getMetricAchievedTime(request);
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
        List<VideoMetricsResponse.MetricDataPoint> dataPoints = dataReaderService.getVideoMetrics(request);
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
