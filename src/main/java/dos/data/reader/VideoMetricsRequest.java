package dos.data.reader;

import java.util.List;

public record VideoMetricsRequest(
        String videoIdentifier,
        String startTime,
        String endTime,
        String granularity,
        List<String> metrics
) {}
