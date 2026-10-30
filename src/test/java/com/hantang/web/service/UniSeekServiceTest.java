package com.hantang.web.service;

import com.hantang.web.dao.UniSeekDao;
import com.hantang.web.dos.uniseek.UniSeekRequest;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class UniSeekServiceTest {
    private Map<String, Object> video(String aid, double score) {
        var row = new HashMap<String, Object>();
        row.put("aid", aid); row.put("title", "洛天依"); row.put("score", score);
        row.put("pic", "http://i0.hdslb.com/cover.jpg"); row.put("view", null); row.put("like", 0);
        return row;
    }
    @Test void videosNeverQueryProducersAndRetainSqlOrderAndMissingMetrics() {
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", "2026-10-28"));
            assertFalse(sql.contains("discovered_users"));
            return List.of(video("9007199254740993", 400), video("2", 900));
        });
        var result = new UniSeekService(dao, Runnable::run).searchVideos(new UniSeekRequest("洛天依", 1, 1));
        assertEquals(List.of("video"), result.list().stream().map(i -> i.type()).toList());
        assertTrue(result.hasMore()); assertEquals(2, result.nextPage());
        var item = result.list().getFirst();
        assertEquals("9007199254740993", item.id()); assertNull(item.payload().get("play"));
        assertEquals(0, item.payload().get("like")); assertEquals("https://i0.hdslb.com/cover.jpg", item.coverUrl());
    }
    @Test void secondPageOnlyReturnsTheNextVideosWithoutSortingAgain() {
        var calls = new AtomicInteger();
        var dao = new UniSeekDao((sql, params) -> {
            if (sql.startsWith("SELECT to_regclass")) return List.of();
            if (sql.startsWith("SELECT max")) return List.of(java.util.Map.of("record_date", "2026-10-28"));
            calls.incrementAndGet(); assertFalse(sql.contains("discovered_users"));
            var rows = new ArrayList<Map<String, Object>>();
            for (int i = 0; i < 30; i++) rows.add(video("skip" + i, 900));
            rows.add(video("2", 400)); rows.add(video("1", 600));
            return rows;
        });
        var result = new UniSeekService(dao, Runnable::run).searchVideos(new UniSeekRequest("洛天依", 2, 30));
        assertEquals(1, calls.get()); assertFalse(result.hasMore()); assertNull(result.nextPage());
        assertEquals(List.of("2", "1"), result.list().stream().map(i -> i.id()).toList());
    }
    @Test void producersNeverQueryVideosAndEmptyResultsAreSuccessful() {
        var service = new UniSeekService(new UniSeekDao((sql, params) -> {
            assertTrue(sql.contains("discovered_users"));
            assertTrue(sql.contains("LIMIT 20"));
            return params.getFirst().equals("missing") ? List.of()
                    : List.of(Map.of("user_id", 123L, "user_name", "洛天依", "fans", 0, "face", "//i0.hdslb.com/avatar.jpg"));
        }), Runnable::run);
        assertTrue(service.searchProducers("missing").list().isEmpty());
        var item = service.searchProducers("天依").list().getFirst();
        assertEquals("producer", item.type()); assertEquals("123", item.id());
        assertEquals(0, item.payload().get("fanCount")); assertEquals("https://i0.hdslb.com/avatar.jpg", item.coverUrl());
    }
    @Test void saturatedSearchExecutorRejectsWithoutDatabaseWork() {
        var service = new UniSeekService(new UniSeekDao((sql, params) -> { fail("must not query"); return List.of(); }),
                task -> { throw new RejectedExecutionException(); });
        assertThrows(RejectedExecutionException.class, () -> service.searchProducers("天依"));
    }
}
