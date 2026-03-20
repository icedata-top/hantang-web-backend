package com.hantang.web.dos.data.reader;

public record MetricAchievedTimeResponse(
         String videoIdentifier,
         String metric,
         int target,
         String achievedTime
) {
}
