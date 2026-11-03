package com.hantang.web.dao;

import com.hantang.web.dos.uniseek.UniSeekRequest;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;

class UniSeekDaoTest {
    private UniSeekRequest request(String q) { return new UniSeekRequest(q, null, null).validated(); }
    private boolean batchQuery(String sql) { return sql.startsWith("SELECT batch_id::text"); }
    private List<Map<String, Object>> batch(String id) { return List.of(Map.of("batch_id", id)); }
    private Map<String, Object> video(Object aid, String batch) { return Map.of("aid", aid, "batch_id", batch); }
    private void onlyAdm(String sql) {
        assertTrue(sql.contains("hantang_dynamic.adm_uniseek_videos"));
        assertFalse(sql.contains("processed_videos"));
        assertFalse(sql.contains("video_daily"));
        assertFalse(sql.contains("timescaledb"));
    }
    private static class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-03T00:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }

    @Test void numericKeywordsOnlySearchTextInThePublishedTable() {
        var dao = new UniSeekDao((sql, params) -> {
            onlyAdm(sql);
            if (batchQuery(sql)) return batch("a");
            assertFalse(sql.contains("aid::text"));
            assertTrue(sql.contains("p.title ILIKE ?"));
            assertTrue(sql.contains("ORDER BY score DESC, aid DESC LIMIT ?"));
            assertEquals("%123%", params.get(2));
            assertEquals(1000, params.getLast());
            return List.of();
        });
        dao.videos(request("123"));
    }
    @Test void shortTokensSearchTitlesAndExactArraysWithLiteralWildcards() {
        var dao = new UniSeekDao((sql, params) -> {
            onlyAdm(sql);
            if (batchQuery(sql)) return batch("a");
            assertTrue(sql.contains("p.title ILIKE ?"));
            assertTrue(sql.contains("p.participle @> ARRAY[?]::varchar[]"));
            assertTrue(params.contains("%言和%"));
            assertTrue(params.contains("言和"));
            return List.of();
        });
        dao.videos(request("言和"));
        assertEquals("%a\\%b\\_c\\\\%", UniSeekRequest.containsPattern("a%b_c\\"));
    }
    @Test void invalidRequestsAndPagesBeyondTheReturnLimitDoNotQuery() {
        for (var r : List.of(new UniSeekRequest(" ", 1, 30), new UniSeekRequest("x", 0, 30),
                new UniSeekRequest("x", 1, 51), new UniSeekRequest("x", 1001, 30))) {
            assertThrows(IllegalArgumentException.class, r::validated);
        }
        new UniSeekDao((sql, params) -> { fail("no query past limit"); return List.of(); })
                .videos(new UniSeekRequest("洛天依", 35, 30).validated());
    }
    @Test void emptyPublicationReturnsEmptyWithoutProbingOrFallingBackToSourceTables() {
        var calls = new AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            onlyAdm(sql); calls.incrementAndGet(); return List.of();
        });
        assertTrue(dao.videos(request("洛天依")).isEmpty());
        assertTrue(dao.videoById(123L).isEmpty());
        assertEquals(2, calls.get());
    }
    @Test void exactIdsReadTheSamePublishedTableWithoutDateDiscovery() {
        var dao = new UniSeekDao((sql, params) -> {
            onlyAdm(sql);
            assertFalse(batchQuery(sql));
            assertTrue(sql.contains("WHERE p.aid = ?"));
            assertEquals(List.of(9007199254740993L), params);
            return List.of(video(9007199254740993L, "a"));
        });
        assertEquals(9007199254740993L, dao.videoById(9007199254740993L).getFirst().get("aid"));
    }
    @Test void scrollingReusesRankedResultsButChecksTheBatchOnEveryPage() {
        var rankedQueries = new AtomicInteger();
        var batchQueries = new AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (batchQuery(sql)) { batchQueries.incrementAndGet(); return batch("a"); }
            rankedQueries.incrementAndGet();
            return java.util.stream.IntStream.range(0, 65).mapToObj(i -> video(i, "a")).toList();
        });
        assertEquals(31, dao.videos(request("洛天依")).size());
        var next = dao.videos(new UniSeekRequest("洛天依", 2, 30).validated());
        assertEquals(30, next.getFirst().get("aid")); assertEquals(31, next.size());
        assertEquals(5, dao.videos(new UniSeekRequest("洛天依", 3, 30).validated()).size());
        assertEquals(1, rankedQueries.get()); assertEquals(3, batchQueries.get());
    }
    @Test void aSameDayPublicationBypassesCachedResultsImmediately() {
        var batch = new AtomicReference<>("a");
        var rankedQueries = new AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (batchQuery(sql)) return batch(batch.get());
            rankedQueries.incrementAndGet();
            return List.of(video(batch.get(), batch.get()));
        }, new TestClock());
        assertEquals("a", dao.videos(request("洛天依")).getFirst().get("aid"));
        batch.set("b");
        assertEquals("b", dao.videos(request("洛天依")).getFirst().get("aid"));
        assertEquals(2, rankedQueries.get());
    }
    @Test void publicationBetweenBatchProbeAndRankingCachesTheActualReturnedBatch() {
        var batch = new AtomicReference<>("a");
        var rankedQueries = new AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (batchQuery(sql)) return batch(batch.get());
            rankedQueries.incrementAndGet(); batch.set("b");
            return List.of(video(2, "b"));
        });
        assertEquals(2, dao.videos(request("洛天依")).getFirst().get("aid"));
        assertEquals(2, dao.videos(request("洛天依")).getFirst().get("aid"));
        assertEquals(1, rankedQueries.get());
    }
    @Test void cacheExpiresAfterSixtySecondsAndEvictsBeyondSixteenKeys() {
        var clock = new TestClock();
        var rankedQueries = new AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (batchQuery(sql)) return batch("a");
            rankedQueries.incrementAndGet(); return List.of(video(1, "a"));
        }, clock);
        dao.videos(request("洛天依"));
        clock.now = clock.now.plusSeconds(59); dao.videos(request("洛天依"));
        assertEquals(1, rankedQueries.get());
        clock.now = clock.now.plusSeconds(1); dao.videos(request("洛天依"));
        assertEquals(2, rankedQueries.get());
        for (int i = 0; i < 16; i++) dao.videos(request("song" + i));
        dao.videos(request("洛天依"));
        assertEquals(19, rankedQueries.get());
    }
    @Test void malformedOrFailedPublicationsAreErrorsRatherThanEmptySuccesses() {
        assertThrows(IllegalStateException.class, () -> new UniSeekDao((sql, params) -> {
            throw new IllegalStateException("database unavailable");
        }).videos(request("洛天依")));
        var dao = new UniSeekDao((sql, params) -> batchQuery(sql) ? batch("a")
                : List.of(video(1, "a"), video(2, "b")));
        assertThrows(IllegalStateException.class, () -> dao.videos(request("洛天依")));
    }
}
