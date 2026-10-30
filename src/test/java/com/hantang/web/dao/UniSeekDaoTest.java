package com.hantang.web.dao;

import com.hantang.web.dos.uniseek.UniSeekRequest;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class UniSeekDaoTest {
    private UniSeekRequest request(String q) { return new UniSeekRequest(q, null, null).validated(); }
    @Test void numericKeywordsNeverBecomeIdQueries() {
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", "2026-10-28"));
            assertFalse(sql.contains("aid::text"));
            assertFalse(sql.contains("p.aid = i.aid"));
            assertFalse(sql.contains("p.bvid = i.bvid"));
            assertTrue(sql.contains("p.title ILIKE ?"));
            assertTrue(sql.contains("ORDER BY score DESC, aid DESC"));
            assertEquals("%123%", params.get(2));
            return List.of();
        });
        dao.videos(request("123"));
    }
    @Test void shortTokensUseExistingArrayIndexesAndWildcardsAreLiteral() {
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", "2026-10-28"));
            assertFalse(sql.contains("p.title ILIKE ?"));
            assertTrue(sql.contains("p.participle @> ARRAY[?]::varchar[]"));
            assertTrue(params.contains("言和"));
            return List.of();
        });
        dao.videos(request("言和"));
        assertEquals("%a\\%b\\_c\\\\%", UniSeekRequest.containsPattern("a%b_c\\"));
    }
    @Test void invalidRequestsAndPagesBeyondCandidateLimitDoNotQuery() {
        for (var r : List.of(new UniSeekRequest(" ", 1, 30), new UniSeekRequest("x", 0, 30),
                new UniSeekRequest("x", 1, 51), new UniSeekRequest("x", 1001, 30))) {
            assertThrows(IllegalArgumentException.class, r::validated);
        }
        new UniSeekDao((sql, params) -> { fail("no query past limit"); return List.of(); })
                .videos(new UniSeekRequest("洛天依", 35, 30).validated());
    }
    @Test void sharedSnapshotDateIsCachedIncludingAnEmptyDate() {
        var dates = new java.util.concurrent.atomic.AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT max")) dates.incrementAndGet();
            return List.of();
        });
        dao.videos(request("洛天依")); dao.videos(request("言和"));
        assertEquals(1, dates.get());
    }

    @Test void scrollingReusesBoundedSqlResultsWithoutReordering() {
        var queries = new java.util.concurrent.atomic.AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", "2026-10-28"));
            queries.incrementAndGet();
            return java.util.stream.IntStream.range(0, 65)
                    .mapToObj(i -> java.util.Map.<String, Object>of("aid", i)).toList();
        });
        assertEquals(31, dao.videos(request("洛天依")).size());
        var next = dao.videos(new UniSeekRequest("洛天依", 2, 30).validated());
        assertEquals(30, next.getFirst().get("aid"));
        assertEquals(31, next.size());
        assertEquals(5, dao.videos(new UniSeekRequest("洛天依", 3, 30).validated()).size());
        assertEquals(1, queries.get());
    }

    @Test void newSnapshotDateInvalidatesKeywordResultsBeforeTheirOwnCacheExpires() {
        class TestClock extends java.time.Clock {
            java.time.Instant now = java.time.Instant.parse("2026-10-30T00:00:00Z");
            public java.time.ZoneId getZone() { return java.time.ZoneOffset.UTC; }
            public java.time.Clock withZone(java.time.ZoneId zone) { return this; }
            public java.time.Instant instant() { return now; }
        }
        var clock = new TestClock();
        var date = new java.util.concurrent.atomic.AtomicReference<>("2026-10-28");
        var queries = new java.util.concurrent.atomic.AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", date.get()));
            queries.incrementAndGet();
            assertTrue(params.contains(date.get()));
            return List.of(java.util.Map.of("aid", date.get()));
        }, clock);
        assertEquals("2026-10-28", dao.videos(request("洛天依")).getFirst().get("aid"));
        date.set("2026-10-29"); clock.now = clock.now.plusSeconds(600);
        assertEquals("2026-10-29", dao.videos(request("洛天依")).getFirst().get("aid"));
        assertEquals(2, queries.get());
    }

}
