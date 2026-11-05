package com.hantang.web.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.VideoListDao;
import com.hantang.web.dos.video.VideoListRequest;
import com.hantang.web.service.VideoListService;
import io.javalin.Javalin;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.net.http.*;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;

class VideoListControllerTest {
    @Test void validatesBeforeQueryingAndPreservesLargeIdsMissingValuesAndEmptyPageTotals() throws Exception {
        var calls = new AtomicInteger();
        var dao = new VideoListDao((sql, params) -> {
            calls.incrementAndGet();
            assertTrue(sql.contains("hantang_dynamic.adm_uniseek_videos"));
            assertFalse(sql.contains("video_daily"));
            if (params.contains(1L)) throw new IllegalStateException("private database error");
            var row = new HashMap<String, Object>();
            row.put("total", 51L); row.put("snapshot_date", "2026-11-03");
            if (params.getLast().equals(0L)) {
                row.put("aid", 9007199254740993L); row.put("user_id", 9007199254740995L);
                row.put("view", null); row.put("favorite", 0); row.put("like", 101);
                row.put("title", "【歌曲】"); row.put("record_date", "2026-11-03");
            }
            return List.of(row);
        });
        var app = Javalin.create(); new VideoListController(new VideoListService(dao)).registerRoutes(app); app.start(0);
        try {
            var client = HttpClient.newHttpClient();
            for (String query : List.of("page=0", "pageSize=101", "pageSize=1.5", "page=2147483648", "typeId=0", "minView=-1",
                    "minView=9223372036854775808", "honor=invalid", "order=DROP", "sortBy=aid", "startDate=2026-02-30",
                    "endDate=2008-01-01", "startDate=2026-11-04&endDate=2026-11-03")) {
                assertEquals(400, get(client, app.port(), query).statusCode(), query);
            }
            assertEquals(0, calls.get());
            var mapper = new ObjectMapper();
            var first = mapper.readTree(get(client, app.port(), "").body()).get("result");
            assertEquals(51, first.get("total").asLong()); assertEquals(20, first.get("pageSize").asInt());
            assertEquals("2026-11-03", first.get("recordDate").asText());
            var video = first.get("rows").get(0);
            assertTrue(video.get("aid").isTextual()); assertEquals("9007199254740993", video.get("aid").asText());
            assertEquals("9007199254740995", video.get("userId").asText());
            assertTrue(video.get("view").isNull()); assertEquals(0, video.get("favorite").asInt());
            var empty = mapper.readTree(get(client, app.port(), "page=4").body()).get("result");
            assertTrue(empty.get("rows").isEmpty()); assertEquals(51, empty.get("total").asLong());
            var failure = get(client, app.port(), "minView=1");
            assertEquals(500, failure.statusCode()); assertFalse(failure.body().contains("private database error"));
        } finally { app.stop(); }
    }

    @Test void bindsBeijingDateBoundsAndPartitionWithoutJoiningDailyHistory() {
        var request = VideoListRequest.from(Map.of("startDate", "2026-11-03", "endDate", "2026-11-03",
                "typeId", "30", "honor", "hall", "minView", "200000", "sortBy", "like", "order", "asc", "page", "2"));
        assertEquals(1793635200L, request.startEpoch());
        assertEquals(86400, request.endEpochExclusive() - request.startEpoch());
        var dao = new VideoListDao((sql, params) -> {
            assertTrue(sql.contains("p.pubdate >= ?")); assertTrue(sql.contains("p.pubdate < ?"));
            assertTrue(sql.contains("p.view >= 100000 AND p.view < 1000000"));
            assertTrue(sql.contains("s.aid = p.aid AND s.type_id = ?"));
            assertTrue(sql.contains("ORDER BY \"like\" asc NULLS LAST, aid DESC"));
            assertFalse(sql.contains("video_daily"));
            assertEquals(List.of(request.startEpoch(), request.endEpochExclusive(), 200000L, 30, 20, 20L), params);
            return List.of();
        });
        assertEquals(0, new VideoListService(dao).list(request).total());
        var defaults = VideoListRequest.from(Map.of());
        new VideoListDao((sql, params) -> {
            assertFalse(sql.contains("processed_videos"));
            assertEquals(List.of(20, 0L), params); return List.of();
        }).list(defaults);
        assertEquals(214748364600L, VideoListRequest.from(Map.of("page", "2147483647", "pageSize", "100")).offset());
        assertEquals(LocalDate.of(2026, 11, 3), request.startDate());
    }
    private HttpResponse<String> get(HttpClient client, int port, String query) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + "/videos?" + query)).GET().build(), HttpResponse.BodyHandlers.ofString());
    }
}
