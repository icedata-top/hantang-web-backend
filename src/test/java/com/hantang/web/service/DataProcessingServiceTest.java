package com.hantang.web.service;

import com.hantang.web.dao.DataProcessingDao;
import com.hantang.web.dao.DataProcessingDao.Source;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class DataProcessingServiceTest {
    private static class StubDao extends DataProcessingDao {
        int loads, jobLoads;
        boolean readable = true, exists = true, controlReadable = false, history = false, fail = false;
        int batches = 1;
        boolean complete = true;
        String taskStatus = "succeeded";
        List<Map<String, Object>> jobRows = List.of(Map.of("jobid", 1, "jobname", "other-job", "schedule", "0 * * * *", "active", true));
        StubDao() { super((sql, params) -> { throw new AssertionError("Unexpected database access"); }); }
        @Override public Metadata metadata(String schema, String table) {
            if (table.equals("job_run_details")) return new Metadata(true, history, null);
            if (table.equals("adm_uniseek_refresh_state") || table.equals("adm_aggregation_task")) return new Metadata(true, controlReadable, null);
            loads++;
            if (fail) throw new IllegalStateException("private db error");
            return new Metadata(exists, readable, 300L);
        }
        @Override public Map<String, Object> searchSnapshot() {
            if (!readable) throw new AssertionError("Unreadable result queried");
            return Map.of("rows", 10L, "first_date", "2026-11-09", "data_date", "2026-11-09", "batch_id", "new-batch",
                    "batches", batches, "updated_at", "2026-11-10T01:00:00Z");
        }
        @Override public Map<String, Object> aggregateSnapshot() {
            if (!readable) throw new AssertionError("Unreadable result queried");
            return Map.of("rows", 5L, "data_date", "2026-11-08", "batch_id", "day-batch", "batches", batches,
                    "complete", complete, "updated_at", "2026-11-09T01:00:00Z");
        }
        @Override public List<Map<String, Object>> publication() {
            return List.of(Map.of("requested_date", "2026-11-08", "published_date", "2026-11-08", "pending", false));
        }
        @Override public List<Map<String, Object>> latestTask() {
            return List.of(Map.of("date", "2026-11-07", "status", taskStatus, "attempt_count", 2, "max_attempts", 3));
        }
        @Override public List<Map<String, Object>> jobs(boolean includeHistory) {
            if (!readable) throw new AssertionError("Unreadable CRON queried");
            assertEquals(history, includeHistory);
            jobLoads++;
            return jobRows;
        }
    }
    private static class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-11T08:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }
    private DataProcessingService service(StubDao dao) { return new DataProcessingService(dao, new TestClock(), Runnable::run); }

    @Test void fullPublishedResultsRemainObservableWithoutClaimingSchedulerSuccess() {
        var result = service(new StubDao()).get(Source.SEARCH).join();
        assertEquals("full", result.mode());
        assertEquals("ready", result.status());
        assertEquals(10L, result.snapshot().rows());
        assertEquals("2026-11-09", result.snapshot().dataDate());
        assertTrue(result.notes().contains("control_forbidden"));
        assertNull(result.publication());
        assertEquals("*/10 * * * *", result.expectedSchedule());
    }

    @Test void permissionAndMissingTablesNeverProduceFakeZeroOrHealthyStatus() {
        var dao = new StubDao();
        dao.readable = false;
        var denied = service(dao).get(Source.AGGREGATION).join();
        assertEquals("forbidden", denied.availability());
        assertEquals("unobservable", denied.status());
        assertEquals("gaps", denied.health());
        assertNull(denied.snapshot().rows());
        assertEquals(300L, denied.snapshot().estimatedRows());
        dao.exists = false;
        var missing = service(dao).get(Source.SEARCH).join();
        assertEquals("missing", missing.availability());
        assertNull(missing.snapshot().dataDate());
    }

    @Test void mixedBatchesAreUnhealthyAndDailyAggregationDoesNotMeanFullHistoryReplacement() {
        var dao = new StubDao();
        dao.batches = 2;
        var mixed = service(dao).get(Source.SEARCH).join();
        assertEquals("inconsistent", mixed.status());
        assertEquals("unavailable", mixed.health());
        dao.batches = 0;
        assertEquals("inconsistent", service(dao).get(Source.SEARCH).join().status());
        dao.batches = 1;
        var daily = service(dao).get(Source.AGGREGATION).join();
        assertEquals("by_day", daily.mode());
        assertEquals(5L, daily.snapshot().rows());
        assertEquals("2026-11-08", daily.snapshot().dataDate());
    }

    @Test void aPublicationBetweenReadsDoesNotCreateAnInventedMismatch() {
        var dao = new StubDao();
        dao.controlReadable = true;
        var result = service(dao).get(Source.SEARCH).join();
        assertEquals("ready", result.status());
        assertEquals("2026-11-09", result.snapshot().dataDate());
        assertEquals("2026-11-08", result.publication().publishedDate());
    }

    @Test void pendingPublicationAndOptionalControlFailureKeepThePublishedRows() {
        var dao = new StubDao() {
            @Override public List<Map<String, Object>> publication() { return List.of(Map.of("requested_date", "2026-11-10", "pending", true)); }
        };
        dao.controlReadable = true;
        var pending = service(dao).get(Source.SEARCH).join();
        assertEquals("waiting", pending.status());
        assertEquals(10L, pending.snapshot().rows());
        var broken = new StubDao() {
            @Override public List<Map<String, Object>> publication() { throw new IllegalStateException("control timeout"); }
        };
        broken.controlReadable = true;
        var retained = service(broken).get(Source.SEARCH).join();
        assertEquals(10L, retained.snapshot().rows());
        assertTrue(retained.notes().contains("control_unavailable"));
    }

    @Test void latestTaskFailureDoesNotEraseOldResultsAndIncompleteDataIsNotGreen() {
        var dao = new StubDao();
        dao.controlReadable = true;
        dao.taskStatus = "failed";
        var failed = service(dao).get(Source.AGGREGATION).join();
        assertEquals("failed", failed.status());
        assertEquals(5L, failed.snapshot().rows());
        assertEquals("2026-11-07", failed.task().date());
        dao.taskStatus = "running";
        assertEquals("loading", service(dao).get(Source.AGGREGATION).join().health());
        dao.taskStatus = "succeeded";
        dao.complete = false;
        assertEquals("incomplete", service(dao).get(Source.AGGREGATION).join().status());
    }

    @Test void cronPermissionFailureIsNotAnEmptySuccessfulInventory() {
        var dao = new StubDao();
        dao.readable = false;
        var result = service(dao).get(Source.SCHEDULER).join();
        assertEquals("forbidden", result.availability());
        assertEquals("unobservable", result.status());
        assertEquals(0, dao.jobLoads);
        assertEquals(2, result.expectedJobs().size());
        assertEquals(List.of("full", "by_day"), result.expectedJobs().stream().map(job -> job.mode()).toList());
        assertTrue(result.notes().contains("cron_scope"));
    }

    @Test void enabledJobsWithoutReadableOrVisibleHistoryAreNotReportedAsSucceeded() {
        var dao = new StubDao();
        var noPermission = service(dao).get(Source.SCHEDULER).join();
        assertEquals("attention", noPermission.status());
        assertTrue(noPermission.notes().contains("cron_history_unavailable"));
        assertNull(noPermission.jobs().getFirst().lastStatus());
        dao.history = true;
        assertEquals("attention", service(dao).get(Source.SCHEDULER).join().status());
        dao.jobRows = List.of(Map.of("jobid", 1, "jobname", "other-job", "active", true, "last_status", "future-state"));
        assertEquals("attention", service(dao).get(Source.SCHEDULER).join().status());
        dao.jobRows = List.of(Map.of("jobid", 1, "jobname", "other-job", "active", true, "last_status", "running"));
        assertEquals("running", service(dao).get(Source.SCHEDULER).join().status());
        dao.jobRows = List.of(Map.of("jobid", 1, "jobname", "other-job", "schedule", "* * * * *", "active", true, "last_status", "failed"));
        assertEquals("failed", service(dao).get(Source.SCHEDULER).join().status());
    }

    @Test void inventoriesAreBoundedAndTruncationIsExplicit() {
        var dao = new StubDao();
        dao.jobRows = java.util.stream.IntStream.range(0, 101)
                .mapToObj(i -> Map.<String, Object>of("jobid", i, "jobname", "job-" + i, "active", true)).toList();
        var result = service(dao).get(Source.SCHEDULER).join();
        assertEquals(100, result.jobs().size());
        assertTrue(result.notes().contains("cron_truncated"));
    }

    @Test void requestsShareOneLoadExpireAfterSixtySecondsAndFailuresAreRetryable() {
        var dao = new StubDao();
        var clock = new TestClock();
        var tasks = new ArrayList<Runnable>();
        var service = new DataProcessingService(dao, clock, tasks::add);
        var first = service.get(Source.SEARCH);
        assertSame(first, service.get(Source.SEARCH));
        assertEquals(1, tasks.size());
        tasks.removeFirst().run();
        clock.now = clock.now.plusSeconds(59);
        assertSame(first, service.get(Source.SEARCH));
        clock.now = clock.now.plusSeconds(1);
        assertNotSame(first, service.get(Source.SEARCH));
        dao.fail = true;
        tasks.removeFirst().run();
        var failed = service.get(Source.AGGREGATION);
        tasks.removeFirst().run();
        assertThrows(CompletionException.class, failed::join);
        dao.fail = false;
        var retried = service.get(Source.AGGREGATION);
        tasks.removeFirst().run();
        assertEquals("ready", retried.join().status());
    }
}
