package com.hantang.web.dos.producer;

import java.util.List;

public record ProducerVideosResponse(
        String userId, String sortBy, String order, String role, int page, int pageSize,
        long total, List<Video> rows
) {
    public record Video(String aid, String bvid, String title, Long pubdate, String pic,
                        String userId, Long view, String recordDate) {}
}
