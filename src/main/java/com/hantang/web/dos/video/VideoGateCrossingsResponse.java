package com.hantang.web.dos.video;

import java.util.List;

/** All gate crossings recorded for one video, ordered by gate value descending. */
public record VideoGateCrossingsResponse(long aid, List<GateCrossingRow> rows) {
    /** One recorded crossing; missing previous/current views stay null instead of becoming zero. */
    public record GateCrossingRow(Long gateValue, Long previousView, Long currentView, String crossedAt) {}
}
