package com.hantang.web.service;

import com.hantang.web.dao.VideoListDao;
import com.hantang.web.dos.video.VideoListRequest;
import com.hantang.web.dos.video.VideoListResponse;
import java.util.Map;

public class VideoListService {
    private final VideoListDao dao;
    public VideoListService() { this(new VideoListDao()); }
    public VideoListService(VideoListDao dao) { this.dao = dao; }
    public VideoListResponse list(VideoListRequest request) {
        var rows = dao.list(request);
        long total = rows.isEmpty() ? 0 : ((Number) rows.getFirst().get("total")).longValue();
        String date = rows.isEmpty() ? null : text(rows.getFirst(), "snapshot_date");
        var videos = rows.stream().filter(row -> row.get("aid") != null).map(row -> new VideoListResponse.Video(
                text(row, "aid"), text(row, "bvid"), text(row, "title"), text(row, "pic"), number(row, "pubdate"),
                text(row, "user_id"), number(row, "view"), number(row, "favorite"), number(row, "like"), number(row, "coin"),
                text(row, "record_date"))).toList();
        return new VideoListResponse(request.page(), request.pageSize(), total, date, videos);
    }
    private static String text(Map<String, Object> row, String key) { return row.get(key) == null ? null : row.get(key).toString(); }
    private static Long number(Map<String, Object> row, String key) { return row.get(key) == null ? null : ((Number) row.get(key)).longValue(); }
}
