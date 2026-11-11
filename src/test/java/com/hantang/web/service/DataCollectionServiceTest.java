package com.hantang.web.service;

import com.hantang.web.dao.DataCollectionDao;
import com.hantang.web.dao.DataCollectionDao.Source;
import org.junit.jupiter.api.Test;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class DataCollectionServiceTest {
    private static class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-11T12:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private static class StubDao extends DataCollectionDao {
        int loads;
        boolean exists = true, fail = false;
        Long estimate = 42L;
        Set<String> columns = Set.of("record_date", "updated_at", "created_at", "last_updated", "fans");
        StubDao() { super((sql, params) -> { throw new AssertionError("Unexpected database access"); }); }
        @Override public Metadata metadata(Source source) {
            loads++;
            if (fail) throw new IllegalStateException("private failure");
            return new Metadata(estimate, columns);
        }
        @Override public boolean hasData(Source source) { return exists; }
        @Override public List<Map<String, Object>> dailyPresence(LocalDate start, LocalDate end) {
            assertEquals(6, end.toEpochDay() - start.toEpochDay());
            var rows = new ArrayList<Map<String, Object>>();
            for (int i = 0; i < 7; i++) rows.add(Map.of("date", start.plusDays(i).toString(), "has_data", exists && i != 2));
            return rows;
        }
        @Override public List<Map<String, Object>> dailyCounts(LocalDate start, LocalDate end) {
            return dailyPresence(start, end).stream().filter(row -> Boolean.TRUE.equals(row.get("has_data")))
                    .map(row -> Map.of("date", row.get("date"), "rows", (Object) 100L)).toList();
        }
        @Override public String latestTime(Source source) { return "2026-11-11T04:00:00Z"; }
        @Override public long fanRows() { return 0L; }
    }

    private DataCollectionService service(StubDao dao) { return new DataCollectionService(dao, new TestClock(), Runnable::run); }

    @Test void dailyChecksSevenCompletedBeijingDatesWithExplicitGapsAndNoInventedUpdateTime() {
        var result = service(new StubDao()).get(Source.DAILY).join();
        assertEquals("2026-11-04", result.startDate());
        assertEquals("2026-11-10", result.endDate());
        assertEquals("2026-11-10", result.latestRecordDate());
        assertEquals("gaps", result.health());
        assertEquals(7, result.days().size());
        assertEquals(6, result.days().stream().filter(day -> day.hasData()).count());
        assertEquals(0L, result.days().get(2).rows());
        assertEquals(600L, result.days().stream().mapToLong(day -> day.rows()).sum());
        assertNull(result.latestAt());
        assertNull(result.estimatedRows(), "Timescale parent estimates must not be shown as totals");
        assertFalse(result.partial());
    }

    @Test void countTimeoutPreservesPresenceWithoutInventingCounts() {
        var dao = new StubDao() {
            @Override public List<Map<String, Object>> dailyCounts(LocalDate start, LocalDate end) { throw new IllegalStateException("timeout"); }
        };
        var result = service(dao).get(Source.DAILY).join();
        assertTrue(result.partial());
        assertTrue(result.days().getFirst().hasData());
        assertNull(result.days().getFirst().rows());
        assertFalse(result.days().get(2).hasData());
        assertEquals(0L, result.days().get(2).rows());
        assertEquals("gaps", result.health());
    }

    @Test void sevenPresentDatesAreHealthyEvenWhenTheParentEstimateIsUnknown() {
        var dao = new StubDao() {
            @Override public List<Map<String, Object>> dailyPresence(LocalDate start, LocalDate end) {
                return super.dailyPresence(start, end).stream()
                        .map(row -> Map.of("date", row.get("date"), "has_data", (Object) true)).toList();
            }
        };
        dao.estimate = null;
        var result = service(dao).get(Source.DAILY).join();
        assertEquals("healthy", result.health());
        assertEquals(7, result.days().stream().filter(day -> day.hasData()).count());
        assertNull(result.estimatedRows());
    }

    @Test void followerCountFailurePreservesUnknownInsteadOfUnboxingItAsZero() {
        var dao = new StubDao() {
            @Override public long fanRows() { throw new IllegalStateException("timeout"); }
        };
        var result = service(dao).get(Source.ACCOUNTS).join();
        assertTrue(result.partial());
        assertTrue(result.hasData());
        assertNull(result.fanRows());
    }

    @Test void absentTimeColumnsAreNotQueriedOrPresented() {
        var dao = new StubDao() {
            @Override public String latestTime(Source source) { throw new AssertionError("Missing column must not be queried"); }
        };
        dao.columns = Set.of("aid");
        var result = service(dao).get(Source.VIDEOS).join();
        assertEquals("healthy", result.health());
        assertNull(result.latestAt());
        assertNull(result.timeKind());
        assertFalse(result.partial());
    }

    @Test void failedOptionalTimeDoesNotTurnAnExistingTableIntoMissingData() {
        var dao = new StubDao() {
            @Override public String latestTime(Source source) { throw new IllegalStateException("timeout"); }
        };
        var result = service(dao).get(Source.CROSSINGS).join();
        assertTrue(result.hasData());
        assertEquals("healthy", result.health());
        assertTrue(result.partial());
        assertNull(result.latestAt());
    }

    @Test void estimatesDoNotDecidePresenceAndEmptyTablesHaveAnObservedZero() {
        var dao = new StubDao();
        dao.estimate = 0L;
        var existing = service(dao).get(Source.VIDEOS).join();
        assertTrue(existing.hasData());
        assertNull(existing.estimatedRows());
        dao.exists = false;
        dao.estimate = 999L;
        var empty = service(dao).get(Source.DAILY).join();
        assertEquals("empty", empty.health());
        assertTrue(empty.days().stream().allMatch(day -> !day.hasData() && day.rows() == 0));
        var staticEmpty = service(dao).get(Source.VIDEOS).join();
        assertEquals(0L, staticEmpty.estimatedRows());
        assertNull(staticEmpty.latestAt());
    }

    @Test void crossingInsertTimesAndFollowerZeroHaveDistinctMeanings() {
        var service = service(new StubDao());
        var crossings = service.get(Source.CROSSINGS).join();
        assertEquals("ingested", crossings.timeKind());
        assertTrue(crossings.days().isEmpty(), "No daily-event requirement for milestones");
        var accounts = service.get(Source.ACCOUNTS).join();
        assertEquals(0L, accounts.fanRows());
        assertEquals("updated", accounts.timeKind());
    }

    @Test void concurrentRequestsShareOneLoadAndSuccessfulResultsExpireAfterSixtySeconds() {
        var dao = new StubDao();
        var clock = new TestClock();
        var tasks = new ArrayList<Runnable>();
        var service = new DataCollectionService(dao, clock, tasks::add);
        var first = service.get(Source.VIDEOS);
        assertSame(first, service.get(Source.VIDEOS));
        assertEquals(1, tasks.size());
        tasks.removeFirst().run();
        assertEquals(1, dao.loads);
        clock.now = clock.now.plusSeconds(59);
        assertSame(first, service.get(Source.VIDEOS));
        clock.now = clock.now.plusSeconds(1);
        assertNotSame(first, service.get(Source.VIDEOS));
        tasks.removeFirst().run();
        assertEquals(2, dao.loads);
    }

    @Test void beijingMidnightInvalidatesTheWindowBeforeTtlExpires() {
        var clock = new TestClock();
        clock.now = Instant.parse("2026-11-11T15:59:50Z");
        var service = new DataCollectionService(new StubDao(), clock, Runnable::run);
        var before = service.get(Source.DAILY).join();
        clock.now = clock.now.plusSeconds(11);
        var after = service.get(Source.DAILY).join();
        assertEquals("2026-11-10", before.endDate());
        assertEquals("2026-11-11", after.endDate());
    }

    @Test void coreFailuresAreNotCachedOrReturnedAsEmptySuccessesAndSourcesStayIndependent() {
        var dao = new StubDao();
        var service = service(dao);
        dao.fail = true;
        assertThrows(CompletionException.class, () -> service.get(Source.DAILY).join());
        dao.fail = false;
        assertTrue(service.get(Source.DAILY).join().hasData());
        assertTrue(service.get(Source.VIDEOS).join().hasData());
        assertEquals(3, dao.loads);
        assertThrows(IllegalArgumentException.class, () -> Source.from("video_daily; DROP TABLE x"));
    }
}
