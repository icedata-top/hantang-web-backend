package com.hantang.web.dos.video;

import java.util.List;

public record VideoListResponse(int page, int pageSize, long total, String recordDate, List<Video> rows) {
    public record Video(String aid, String bvid, String title, String pic, Long pubdate, String userId,
                        Long view, Long favorite, Long like, Long coin, String recordDate) {}
}
