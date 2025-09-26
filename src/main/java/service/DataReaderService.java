package service;

import dao.DataReaderDao;
import dos.data.reader.MetricAchievedTimeRequest;
import dos.data.reader.VideoMetricsRequest;
import dos.data.reader.VideoMetricsResponse;
import enums.Granularity;
import enums.Metric;
import exceptions.InvalidVideoIdentifierException;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.collections.MapUtils;
import utils.BilibiliUtils;
import utils.DeltaCalculator;
import utils.IsoTimeUtils;

import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

public class DataReaderService {
    private final DataReaderDao dataReaderDao;

    public DataReaderService() {
        this.dataReaderDao = new DataReaderDao();
    }

    /**
     * 将视频标识符转化成 AV 号
     * @param videoIdentifier 前端传入的视频标识符，可能是 av123456 / BV1xxx / 视频名等
     * @return BV 号或纯数字（如果是 AV），否则需要从数据库查询
     */
    protected long videoIdentifierToAid(String videoIdentifier)
    throws InvalidVideoIdentifierException, SQLException{
        if (videoIdentifier == null || videoIdentifier.isBlank()) {
            throw new IllegalArgumentException("videoIdentifier cannot be null or blank");
        }

        String trimmed = videoIdentifier.trim();

        // ① 如果是纯数字
        if (trimmed.matches("\\d+")) {
            return Long.parseLong(trimmed);
        }

        // ① 如果是 av + 数字
        if (trimmed.toLowerCase().startsWith("av") && trimmed.length() > 2) {
            String numberPart = trimmed.substring(2);
            if (numberPart.matches("\\d+")) {
                return Long.parseLong(numberPart);
            }
        }

        // ② 如果是 bv + 英数字混合
        if (trimmed.length() > 2 && trimmed.substring(0, 2).equalsIgnoreCase("bv")) {
            String rest = trimmed.substring(2);
            // 这里简单校验后缀部分，长度和格式可根据需要补充
            if (rest.matches("[a-zA-Z0-9]+")) {
                return BilibiliUtils.bvToAv("BV" + rest);
            }
        }

        // ③ 其他情况，交给 DAO 或其他逻辑处理
        return dataReaderDao.getAidByVideoName(videoIdentifier);
    }


    /**
     * 查询某个视频的某项指标在什么时候达成指定数值
     */
    public String getMetricAchievedTime(MetricAchievedTimeRequest request)
            throws InvalidVideoIdentifierException, SQLException {
        long aid = videoIdentifierToAid(request.videoIdentifier());
        Metric metric = Metric.fromString(request.metric());
        int target = request.target();
        if (target < 1 || aid < 1) {
            throw new IllegalArgumentException("Target or aid is illegal. target: " + target + ", aid: " + aid);
        }

        // 从 DAO 层查询数据
        Map<String, Integer> achievedData = dataReaderDao.getMetricAchievedTime(aid, metric, target, true);
        Map<String, Integer> lastData = dataReaderDao.getMetricAchievedTime(aid, metric, target, false);

        boolean achievedTimeExist = MapUtils.getIntValue(achievedData, "timestamp", -1) != -1;
        boolean lastTimeExist = MapUtils.getIntValue(lastData, "timestamp", -1) != -1;
        if (!achievedTimeExist) {
            if (!lastTimeExist) {
                return String.format("数据库中没有该视频的数据. aid: %d.", aid); // 没有达成时间，也没有最新时间
            } else {
                String lastTime = IsoTimeUtils.formatTimestamp(lastData.get("timestamp"));
                return String.format("该视频至今没有达成目标数据. aid: %d, target value: %d, latest record value: %d, latest record time: %s",
                        aid, target, lastData.get("value"), lastTime); // 未达成
            }
        } else {
            int achieveValue = achievedData.get("value");
            String achieveTime = IsoTimeUtils.formatTimestamp(achievedData.get("timestamp"));
            if (!lastTimeExist) {
                return String.format("在开始记录该视频时，该视频就已经达成目标数据. aid: %d, target: %d, first record value: %d, first record time: %s",
                        aid, target, achieveValue, achieveTime);
            } else {
                int lastValue = lastData.get("value");
                String lastTime = IsoTimeUtils.formatTimestamp(lastData.get("timestamp"));
                return String.format("该视频达成目标数据. aid: %d, target: %d, achieved record value: %d, achieved record time: %s, before record value: %d, before record time: %s",
                        aid, target, achieveValue, achieveTime, lastValue, lastTime);
            }
        }
    }

    /**
     * 查询某个视频在时间段内，按粒度统计多项指标
     */
    public List<VideoMetricsResponse.MetricDataPoint> getVideoMetrics(VideoMetricsRequest request)
            throws InvalidVideoIdentifierException, SQLException {
        // 读取请求
        long aid = videoIdentifierToAid(request.videoIdentifier());
        List<Metric> metricList = request.metrics().stream().map(Metric::fromString).toList();
        Granularity granularity = Granularity.fromString(request.granularity());
        if (CollectionUtils.isEmpty(metricList)) {
            throw new IllegalArgumentException("指标数组不能为空");
        }
        // 按日和按分钟不同，从DAO层读取数据
        List<Map<String, Integer>> data;
        if (Granularity.DAY.equals(granularity)) {
            String startDate = IsoTimeUtils.toDateString(request.startTime());
            String endDate = IsoTimeUtils.toDateString(request.endTime());
            data = dataReaderDao.getVideoMetricsByDay(aid, metricList, startDate, endDate);
        } else {
            int startUnixTimestamp = IsoTimeUtils.toUnixTimestamp(request.startTime());
            int endUnixTimestamp = IsoTimeUtils.toUnixTimestamp(request.endTime());
            data = dataReaderDao.getVideoMetricsByMinute(aid, metricList, startUnixTimestamp, endUnixTimestamp);
        }

        return new DeltaCalculator(data, metricList).calc();
    }
}
