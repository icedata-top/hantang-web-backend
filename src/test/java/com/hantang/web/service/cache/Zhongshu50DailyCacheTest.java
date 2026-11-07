package com.hantang.web.service.cache;

import com.hantang.web.dao.CacheDao;
import com.hantang.web.dao.OverviewDao.DailyViewFavoriteSums;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

@Timeout(10)
class Zhongshu50DailyCacheTest {
    private static final LocalDate DATE = LocalDate.of(2026, 10, 20);

    @Test
    void reusesCumulativeValuesAcrossRangesAndSetsOneHourTtl() {
        AtomicInteger queries = new AtomicInteger();
        AtomicInteger ttl = new AtomicInteger();
        CacheDao<DailyViewFavoriteSums> store = new CacheDao<>(64) {
            @Override
            public void set(String key, DailyViewFavoriteSums value, int expireSeconds) {
                ttl.set(expireSeconds);
                super.set(key, value, expireSeconds);
            }
        };
        var cache = new Zhongshu50DailyCache(date -> {
            queries.incrementAndGet();
            return new DailyViewFavoriteSums(date.toEpochDay() * 100, date.toEpochDay() * 10);
        }, store);

        var start = cache.get(DATE);
        var end = cache.get(DATE.plusDays(7));
        assertEquals(700, end.viewSum() - start.viewSum());
        assertEquals(70, end.favoriteSum() - start.favoriteSum());
        // 改变区间时，已读取的端点继续复用。
        assertSame(end, cache.get(DATE.plusDays(7)));
        cache.get(DATE.plusDays(14));
        assertSame(start, cache.get(DATE));
        assertEquals(3, queries.get());
        assertEquals(3600, ttl.get());
    }

    @Test
    void evictsOldestDateAfter64Dates() {
        AtomicInteger queries = new AtomicInteger();
        var cache = new Zhongshu50DailyCache(date -> new DailyViewFavoriteSums((long) queries.incrementAndGet(), 1L));
        for (int i = 0; i < 65; i++) {
            cache.get(DATE.plusDays(i));
        }
        cache.get(DATE.plusDays(1));
        assertEquals(65, queries.get());
        cache.get(DATE);
        assertEquals(66, queries.get());
    }

    @Test
    void failedQueriesAreRetriedAndZeroValuesAreCached() {
        AtomicInteger queries = new AtomicInteger();
        var cache = new Zhongshu50DailyCache(date -> {
            if (queries.incrementAndGet() == 1) {
                throw new IllegalStateException("database unavailable");
            }
            return new DailyViewFavoriteSums(0L, 0L);
        });
        assertThrows(IllegalStateException.class, () -> cache.get(DATE));
        var value = cache.get(DATE);
        assertEquals(new DailyViewFavoriteSums(0L, 0L), value);
        assertSame(value, cache.get(DATE));
        assertEquals(2, queries.get());
    }

    @Test
    void missingOrPartialSnapshotsReloadAfterBackfill() {
        for (var incomplete : java.util.List.of(
                new DailyViewFavoriteSums(null, null),
                new DailyViewFavoriteSums(100L, null),
                new DailyViewFavoriteSums(null, 20L))) {
            AtomicInteger queries = new AtomicInteger();
            var cache = new Zhongshu50DailyCache(date -> queries.incrementAndGet() == 1
                    ? incomplete : new DailyViewFavoriteSums(100L, 20L));
            assertSame(incomplete, cache.get(DATE));
            var complete = cache.get(DATE);
            assertEquals(new DailyViewFavoriteSums(100L, 20L), complete);
            assertSame(complete, cache.get(DATE));
            assertEquals(2, queries.get());
        }
    }

    @Test
    void concurrentRequestsForSameDateQueryOnlyOnce() throws Exception {
        AtomicInteger queries = new AtomicInteger();
        CountDownLatch ready = new CountDownLatch(8);
        CountDownLatch start = new CountDownLatch(1);
        var cache = new Zhongshu50DailyCache(date -> {
            queries.incrementAndGet();
            return new DailyViewFavoriteSums(100L, 20L);
        });
        try (var executor = Executors.newFixedThreadPool(8)) {
            var results = new ArrayList<Future<DailyViewFavoriteSums>>();
            for (int i = 0; i < 8; i++) {
                results.add(executor.submit(() -> {
                    ready.countDown();
                    assertTrue(start.await(5, TimeUnit.SECONDS));
                    return cache.get(DATE);
                }));
            }
            assertTrue(ready.await(5, TimeUnit.SECONDS));
            start.countDown();
            for (var result : results) {
                assertEquals(new DailyViewFavoriteSums(100L, 20L), result.get(5, TimeUnit.SECONDS));
            }
        }
        assertEquals(1, queries.get());
    }

    @Test
    void slowMissDoesNotBlockHitsOrOtherDateQueries() throws Exception {
        CountDownLatch loading = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        var cache = new Zhongshu50DailyCache(date -> {
            if (date.equals(DATE)) {
                loading.countDown();
                try {
                    assertTrue(release.await(5, TimeUnit.SECONDS));
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(e);
                }
            }
            return new DailyViewFavoriteSums(100L, 20L);
        });
        var hit = cache.get(DATE.plusDays(1));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var slow = executor.submit(() -> cache.get(DATE));
            try {
                assertTrue(loading.await(5, TimeUnit.SECONDS));
                assertSame(hit, executor.submit(() -> cache.get(DATE.plusDays(1))).get(1, TimeUnit.SECONDS));
                assertEquals(hit, executor.submit(() -> cache.get(DATE.plusDays(2))).get(1, TimeUnit.SECONDS));
            } finally {
                release.countDown();
            }
            assertEquals(hit, slow.get(5, TimeUnit.SECONDS));
        }
    }
}
