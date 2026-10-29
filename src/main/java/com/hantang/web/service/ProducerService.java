package com.hantang.web.service;

import com.hantang.web.dao.ProducerDao;
import com.hantang.web.dos.producer.ProducerInfoResponse;
import com.hantang.web.dos.producer.ProducerVideosRequest;
import com.hantang.web.dos.producer.ProducerVideosResponse;

import java.util.Map;
import java.util.Optional;

public class ProducerService {
    private final ProducerDao producerDao;

    public ProducerService() { this(new ProducerDao()); }
    public ProducerService(ProducerDao producerDao) { this.producerDao = producerDao; }

    public Optional<ProducerInfoResponse> getInfo(long userId) {
        return producerDao.findInfo(userId).map(row -> new ProducerInfoResponse(
                text(row, "user_id"), text(row, "user_name"), text(row, "face"), text(row, "sign"),
                number(row, "fans"), integer(row, "level"), integer(row, "official_role"),
                text(row, "official_title"), text(row, "last_updated")));
    }

    public ProducerVideosResponse getVideos(ProducerVideosRequest request) {
        var page = producerDao.findVideos(request);
        var rows = page.rows().stream().map(row -> new ProducerVideosResponse.Video(
                text(row, "aid"), text(row, "bvid"), text(row, "title"), number(row, "pubdate"),
                text(row, "pic"), text(row, "user_id"), number(row, "view"), text(row, "record_date"))).toList();
        return new ProducerVideosResponse(Long.toString(request.userId()), request.sortBy(), request.order(),
                request.role(), request.page(), request.pageSize(), page.total(), rows);
    }

    private static String text(Map<String, Object> row, String key) {
        return row.get(key) == null ? null : row.get(key).toString();
    }
    private static Long number(Map<String, Object> row, String key) {
        return row.get(key) instanceof Number value ? value.longValue() : null;
    }
    private static Integer integer(Map<String, Object> row, String key) {
        Long value = number(row, key);
        return value == null ? null : Math.toIntExact(value);
    }
}
