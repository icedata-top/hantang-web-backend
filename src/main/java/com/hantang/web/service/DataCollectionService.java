package com.hantang.web.service;

import com.hantang.web.dao.DataCollectionDao;
import com.hantang.web.dao.DataCollectionDao.Source;
import com.hantang.web.dos.admin.DataCollectionResponse;
import com.hantang.web.dos.admin.DataCollectionResponse.Day;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Supplier;

public class DataCollectionService {
    private static final Logger logger = LoggerFactory.getLogger(DataCollectionService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final Executor EXECUTOR = new ThreadPoolExecutor(2, 2, 0L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(16), Thread.ofPlatform().daemon().name("collection-", 0).factory());
    private record Cached(LocalDate today, Instant expiresAt, CompletableFuture<DataCollectionResponse> result) {}
    private final Map<Source, Cached> cache = new EnumMap<>(Source.class);
    private final DataCollectionDao dao;
    private final Clock clock;
    private final Executor executor;

    public DataCollectionService() { this(new DataCollectionDao(), Clock.systemUTC(), EXECUTOR); }
    public DataCollectionService(DataCollectionDao dao, Clock clock, Executor executor) {
        this.dao = dao; this.clock = clock; this.executor = executor;
    }

    /** One shared in-flight request/cache per card; Beijing midnight invalidates yesterday's window. */
    public synchronized CompletableFuture<DataCollectionResponse> get(Source source) {
        var now = clock.instant();
        var today = LocalDate.ofInstant(now, ZONE);
        var existing = cache.get(source);
        if (existing != null && existing.today.equals(today) && now.isBefore(existing.expiresAt)
                && !existing.result.isCompletedExceptionally()) return existing.result;
        var future = CompletableFuture.supplyAsync(() -> load(source, today), executor);
        cache.put(source, new Cached(today, now.plusSeconds(60), future));
        return future;
    }

    private DataCollectionResponse load(Source source, LocalDate today) {
        var start = today.minusDays(7);
        var end = today.minusDays(1);
        var metadata = dao.metadata(source);
        boolean hasData = source != Source.DAILY && dao.hasData(source);
        Long estimate = metadata.estimatedRows();
        if (!hasData) estimate = 0L;
        else if (estimate != null && estimate <= 0) estimate = null;
        var partial = new boolean[1];
        var days = new ArrayList<Day>();
        String latestDate = null, latestAt = null;
        Long fanRows = null;
        if (source == Source.DAILY) {
            // A single bounded count also proves presence. Only fall back to indexed
            // EXISTS probes when counting times out; never scan history for a latest date.
            var counts = optional(source, () -> dao.dailyCounts(start, end), partial);
            var byDate = new HashMap<String, Long>();
            if (counts != null) for (var row : counts) byDate.put((String) row.get("date"), ((Number) row.get("rows")).longValue());
            var presence = new HashMap<String, Boolean>();
            if (counts == null) {
                var observed = dao.dailyPresence(start, end);
                if (observed.size() != 7) throw new IllegalStateException("Expected seven collection dates");
                for (var row : observed) presence.put((String) row.get("date"), Boolean.TRUE.equals(row.get("has_data")));
            }
            for (int i = 0; i < 7; i++) {
                var date = start.plusDays(i).toString();
                boolean present = counts != null ? byDate.getOrDefault(date, 0L) > 0 : Boolean.TRUE.equals(presence.get(date));
                Long count = counts != null ? byDate.getOrDefault(date, 0L) : null;
                if (!present) count = 0L;
                days.add(new Day(date, present, count));
                if (present) latestDate = date;
            }
            hasData = days.stream().anyMatch(Day::hasData);
            // Timescale parent estimates do not include its compressed/hypertable chunks.
            estimate = null;
        } else if (hasData && metadata.columns().contains(source.timeColumn)) {
            latestAt = optional(source, () -> dao.latestTime(source), partial);
        }
        if (source == Source.ACCOUNTS && metadata.columns().contains("fans")) {
            if (hasData) fanRows = optional(source, dao::fanRows, partial);
            else fanRows = 0L;
        }
        String health = !hasData ? "empty" : source == Source.DAILY && days.stream().anyMatch(day -> !day.hasData()) ? "gaps" : "healthy";
        return new DataCollectionResponse(source.id, source.table, clock.instant().toString(), start.toString(), end.toString(),
                health, hasData, estimate, latestDate, latestAt, latestAt == null ? null : source.timeKind, fanRows, partial[0], List.copyOf(days));
    }

    private <T> T optional(Source source, Supplier<T> query, boolean[] partial) {
        try { return query.get(); }
        catch (RuntimeException error) {
            partial[0] = true;
            logger.warn("Optional collection statistic unavailable, source={}", source.id);
            return null;
        }
    }
}
