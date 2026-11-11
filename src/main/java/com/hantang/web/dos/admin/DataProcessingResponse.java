package com.hantang.web.dos.admin;

import java.util.List;

/** Processing results and scheduler observations are intentionally separate. */
public record DataProcessingResponse(
        String source, String engine, String mode, String checkedAt, String availability,
        String status, String health, String expectedJob, String expectedSchedule,
        Snapshot snapshot, Task task, Publication publication, List<Job> jobs, List<ExpectedJob> expectedJobs, List<String> notes
) {
    public record Snapshot(String table, Long rows, Long estimatedRows, String dataDate,
                           String updatedAt, String batchId, Boolean complete) {}
    public record Task(String date, String status, Integer attempts, Integer maxAttempts,
                       String startedAt, String finishedAt, String updatedAt) {}
    public record Publication(String requestedDate, String publishedDate, boolean pending) {}
    public record Job(String id, String name, String schedule, boolean active, String lastStatus,
                      String startedAt, String finishedAt) {}
    public record ExpectedJob(String source, String name, String schedule, String engine, String mode) {}
}
