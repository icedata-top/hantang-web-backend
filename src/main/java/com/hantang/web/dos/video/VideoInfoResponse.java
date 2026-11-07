package com.hantang.web.dos.video;

import java.util.List;

/** Public video metadata only; excludes collection, filtering and labeling configuration. */
public record VideoInfoResponse(
        long aid, String bvid, String title, Long pubdate, String description, String pic,
        List<String> tags, Integer typeId, Integer tidV2, Integer pidV2,
        Integer copyright, Long duration, Uploader uploader
) {
    public record Uploader(long userId, String name, String face, String sign, String officialTitle) {}
}
