package com.hantang.web.service;

import com.alibaba.fastjson2.JSON;
import com.hantang.web.dao.VideoDao;
import com.hantang.web.dos.video.VideoInfoResponse;
import com.hantang.web.dos.video.VideoLatestMetricsResponse;
import com.hantang.web.dos.video.VideoDailyMetricsRequest;
import com.hantang.web.dos.video.VideoDailyMetricsResponse;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class VideoService {
    public static final List<String> DAILY_METRICS = List.of("view", "like", "coin", "favorite", "share", "reply", "danmaku");
    private final VideoDao videoDao;

    public VideoService() {
        this(new VideoDao());
    }

    public VideoService(VideoDao videoDao) {
        this.videoDao = videoDao;
    }

    public Optional<VideoInfoResponse> getInfo(long aid) {
        return videoDao.findInfo(aid).map(row -> {
            Long userId = number(row, "user_id");
            var uploader = userId == null ? null : new VideoInfoResponse.Uploader(
                    userId, text(row, "user_name"), text(row, "user_face"),
                    text(row, "user_sign"), text(row, "official_title"));
            return new VideoInfoResponse(
                    aid, text(row, "bvid"), text(row, "title"), number(row, "pubdate"),
                    text(row, "description"), text(row, "pic"), tags(row),
                    integer(row, "type_id"), integer(row, "tid_v2"), integer(row, "pid_v2"),
                    integer(row, "copyright"), duration(row), uploader);
        });
    }

    public Optional<VideoLatestMetricsResponse> getLatestMetrics(long aid) {
        return videoDao.findLatestMetrics(aid).map(row -> new VideoLatestMetricsResponse(
                aid, text(row, "record_date"), number(row, "view"), number(row, "like"),
                number(row, "coin"), number(row, "favorite"), number(row, "share"),
                number(row, "reply"), number(row, "danmaku")));
    }

    public VideoDailyMetricsResponse getDailyMetrics(VideoDailyMetricsRequest request) {
        Map<LocalDate, Map<String, Object>> byDate = new LinkedHashMap<>();
        for (Map<String, Object> row : videoDao.findDailyMetrics(request)) {
            LocalDate date = LocalDate.parse(text(row, "record_date"));
            if (byDate.putIfAbsent(date, row) != null) {
                throw new IllegalStateException("Duplicate daily snapshots for aid=" + request.aid() + ", date=" + date);
            }
        }
        var rows = new ArrayList<VideoDailyMetricsResponse.DailySnapshot>();
        for (LocalDate date = request.startDate(); !date.isAfter(request.endDate()); date = date.plusDays(1)) {
            Map<String, Object> snapshot = byDate.get(date);
            Map<String, Long> indicators = new LinkedHashMap<>();
            for (String metric : DAILY_METRICS) {
                indicators.put(metric, snapshot == null ? null : number(snapshot, metric));
            }
            rows.add(new VideoDailyMetricsResponse.DailySnapshot(date.toString(), snapshot == null, indicators));
        }
        return new VideoDailyMetricsResponse(request.aid(), request.startDate().toString(), request.endDate().toString(), rows);
    }

    private static List<String> tags(Map<String, Object> row) {
        String arrayJson = text(row, "tag_new_json");
        List<String> values = arrayJson == null
                ? Arrays.asList(Optional.ofNullable(text(row, "tag")).orElse("").split(";"))
                : JSON.parseArray(arrayJson, String.class);
        if (values == null) return List.of();
        return values.stream().filter(value -> value != null && !value.isBlank())
                .map(String::trim).distinct().toList();
    }

    private static Long duration(Map<String, Object> row) {
        String raw = text(row, "duration");
        if (raw == null) return null;
        try {
            long value = Long.parseLong(raw);
            return value < 0 ? null : value;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String text(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? null : value.toString();
    }

    private static Long number(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? null : ((Number) value).longValue();
    }

    private static Integer integer(Map<String, Object> row, String key) {
        Long value = number(row, key);
        return value == null ? null : Math.toIntExact(value);
    }
}
