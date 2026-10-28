package com.hantang.web.service;

import com.alibaba.fastjson2.JSON;
import com.hantang.web.dao.VideoDao;
import com.hantang.web.dos.video.VideoInfoResponse;
import com.hantang.web.dos.video.VideoLatestMetricsResponse;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public class VideoService {
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
