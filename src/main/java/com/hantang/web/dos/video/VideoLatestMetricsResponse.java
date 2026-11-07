package com.hantang.web.dos.video;

/** One dated cumulative snapshot; null metrics are missing, not zero. */
public record VideoLatestMetricsResponse(
        long aid, String recordDate, Long view, Long like, Long coin, Long favorite,
        Long share, Long reply, Long danmaku
) {}
