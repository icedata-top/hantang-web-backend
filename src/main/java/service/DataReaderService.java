package service;

import dao.DataReaderDao;
import dos.data.reader.MetricAchievedTimeRequest;
import utils.BilibiliUtils;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

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
    protected long videoIdentifierToAid(String videoIdentifier) {
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
    public String getMetricAchievedTime(MetricAchievedTimeRequest request) {
        return LocalDateTime.now()
                .minusDays(10)  // 假设 10 天前达成
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }


}
