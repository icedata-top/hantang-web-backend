package com.hantang.web.dao;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiFunction;
import static org.junit.jupiter.api.Assertions.*;

class LatestVideoSnapshotDateTest {
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-30T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
    @Test void findsActualLatestAcrossGapsAndEmptyNewerChunksAndCachesExactlyTenMinutes() {
        var clock = new MutableClock();
        var dates = new HashSet<>(Set.of("2026-01-03", "2026-01-28", "2026-01-29"));
        var probes = new AtomicInteger();
        var metadataReads = new AtomicInteger();
        var query = (BiFunction<String, List<Object>, List<Map<String, Object>>>) (sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of(Map.of("supported", true));
            if (sql.contains("timescaledb_information.chunks")) {
                metadataReads.incrementAndGet();
                return List.of(Map.of("start_date", "2026-02-01", "end_date", "2026-03-01"),
                        Map.of("start_date", "2026-01-01", "end_date", "2026-02-01"));
            }
            assertTrue(sql.contains("SELECT EXISTS")); probes.incrementAndGet();
            var start = (String) params.get(0); var end = (String) params.get(1);
            return List.of(Map.of("has_data", dates.stream().anyMatch(d -> d.compareTo(start) >= 0 && d.compareTo(end) < 0)));
        };
        var latest = new LatestVideoSnapshotDate(query, clock);
        assertEquals("2026-01-29", latest.get()); // Much older than today; newer empty chunk is ignored.
        assertTrue(probes.get() <= 8);
        dates.add("2026-02-10");
        clock.now = clock.now.plusSeconds(599);
        assertEquals("2026-01-29", latest.get()); assertEquals(1, metadataReads.get());
        clock.now = clock.now.plusSeconds(1);
        assertEquals("2026-02-10", latest.get()); assertEquals(2, metadataReads.get());
    }
    @Test void ordinaryPostgresUsesAnUnrestrictedMaxAndEmptyResultsAreCached() {
        var reads = new AtomicInteger();
        var latest = new LatestVideoSnapshotDate((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of(Map.of("supported", false));
            assertTrue(sql.startsWith("SELECT max(record_date)")); assertFalse(sql.contains("CURRENT_DATE"));
            reads.incrementAndGet(); return List.of();
        });
        assertNull(latest.get()); assertNull(latest.get()); assertEquals(1, reads.get());
    }
    @Test void emptyHypertableReturnsNoDateWithoutScanningAllHistory() {
        var latest = new LatestVideoSnapshotDate((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of(Map.of("supported", true));
            if (sql.contains("timescaledb_information.chunks")) return List.of(Map.of("start_date", "2026-01-01", "end_date", "2026-04-01"));
            assertTrue(sql.contains("SELECT EXISTS")); return List.of(Map.of("has_data", false));
        });
        assertNull(latest.get());
    }
}
