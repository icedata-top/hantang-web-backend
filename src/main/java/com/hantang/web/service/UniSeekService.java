package com.hantang.web.service;

import com.hantang.web.dao.UniSeekDao;
import com.hantang.web.dos.uniseek.UniSeekRequest;
import com.hantang.web.dos.uniseek.UniSeekResponse;
import com.hantang.web.dos.uniseek.UniSeekResponse.Item;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.*;

public class UniSeekService {
    // Bound both DB concurrency and pending work; leave pool capacity for other endpoints.
    private static final Executor SEARCH_EXECUTOR = new ThreadPoolExecutor(4, 4, 0L, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(32), Thread.ofPlatform().daemon().name("uniseek-", 0).factory());
    private final UniSeekDao dao;
    private final Executor executor;

    public UniSeekService() { this(new UniSeekDao(), SEARCH_EXECUTOR); }
    public UniSeekService(UniSeekDao dao, Executor executor) {
        this.dao = dao; this.executor = executor;
    }

    public UniSeekResponse searchVideos(UniSeekRequest raw) {
        var request = raw.validated();
        var rows = CompletableFuture.supplyAsync(() -> dao.videos(request), executor).join();
        boolean hasMore = rows.size() > request.pageSize();
        var items = rows.stream().limit(request.pageSize()).map(this::video).toList();
        return new UniSeekResponse(request.keyword(), request.page(), request.pageSize(), hasMore,
                hasMore ? request.page() + 1 : null, UniSeekRequest.VIDEO_LIMIT, items);
    }

    public UniSeekResponse.Producers searchProducers(String keyword) {
        var request = new UniSeekRequest(keyword, 1, 20).validated();
        var rows = CompletableFuture.supplyAsync(() -> dao.producers(request), executor).join();
        return new UniSeekResponse.Producers(request.keyword(), rows.stream().map(this::producer).toList());
    }

    public UniSeekResponse.Matches searchVideoById(long aid) {
        var rows = CompletableFuture.supplyAsync(() -> dao.videoById(aid), executor).join();
        return new UniSeekResponse.Matches(rows.stream().map(this::video).toList());
    }
    public UniSeekResponse.Matches searchProducerById(long userId) {
        var rows = CompletableFuture.supplyAsync(() -> dao.producerById(userId), executor).join();
        return new UniSeekResponse.Matches(rows.stream().map(this::producer).toList());
    }

    private Item video(Map<String, Object> row) {
        var payload = new LinkedHashMap<String, Object>();
        payload.put("bvid", row.get("bvid")); payload.put("play", row.get("view"));
        payload.put("favorite", row.get("favorite")); payload.put("like", row.get("like"));
        payload.put("coin", row.get("coin")); payload.put("publishDate", row.get("pubdate"));
        payload.put("producerId", text(row, "user_id")); payload.put("recordDate", text(row, "record_date"));
        return new Item("video", text(row, "aid"), text(row, "title"), "",
                image(text(row, "pic")), "/videos/" + text(row, "aid"), payload);
    }
    private Item producer(Map<String, Object> row) {
        var payload = new LinkedHashMap<String, Object>();
        payload.put("uid", text(row, "user_id")); payload.put("fanCount", row.get("fans"));
        payload.put("videoCount", row.get("videos_filtered")); payload.put("totalView", row.get("filtered_view"));
        return new Item("producer", text(row, "user_id"), text(row, "user_name"), text(row, "sign"),
                image(text(row, "face")), "/producers/" + text(row, "user_id"), payload);
    }
    private static String text(Map<String, Object> row, String key) { return row.get(key) == null ? null : row.get(key).toString(); }
    private static String image(String value) {
        if (value == null || value.isBlank()) return null;
        if (value.startsWith("//")) return "https:" + value;
        return value.replaceFirst("(?i)^http://", "https://");
    }
}
