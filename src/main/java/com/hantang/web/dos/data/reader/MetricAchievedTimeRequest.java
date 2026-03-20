package com.hantang.web.dos.data.reader;

public record MetricAchievedTimeRequest(
        String videoIdentifier,
        String metric,
        int target
) {
}
