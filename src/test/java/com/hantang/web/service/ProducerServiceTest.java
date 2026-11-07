package com.hantang.web.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.dao.ProducerDao;
import com.hantang.web.dos.producer.ProducerVideosRequest;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ProducerServiceTest {
    @Test
    void defaultsAndLargePageOffsetsAreValidated() {
        var request = ProducerVideosRequest.from(396194, null, null, null, null, null);
        assertEquals(new ProducerVideosRequest(396194, "pubdate", "desc", "uploader", 1, 20), request);
        assertEquals(214748364600L, new ProducerVideosRequest(1, "view", "asc", "staff", Integer.MAX_VALUE, 100).offset());
        for (String page : List.of("0", "-1", "1.5", "", "2147483648", "1 OR 1=1")) {
            assertThrows(IllegalArgumentException.class, () -> ProducerVideosRequest.from(1, null, null, null, page, null));
        }
        for (String size : List.of("0", "101", "-1", "foo")) {
            assertThrows(IllegalArgumentException.class, () -> ProducerVideosRequest.from(1, null, null, null, null, size));
        }
        assertThrows(IllegalArgumentException.class, () -> new ProducerVideosRequest(1, "view; DROP TABLE x", "desc", "uploader", 1, 20));
        assertThrows(IllegalArgumentException.class, () -> new ProducerVideosRequest(1, "view", "DESC", "uploader", 1, 20));
        assertThrows(IllegalArgumentException.class, () -> new ProducerVideosRequest(1, "view", "asc", "all", 1, 20));
    }

    @Test
    void accountResponseOnlyContainsPublicFieldsAndPreservesMissingValues() throws Exception {
        var row = new HashMap<String, Object>();
        row.put("user_id", Long.MAX_VALUE);
        row.put("user_name", "COPY");
        row.put("fans", 0);
        row.put("official_role", 0);
        row.put("notes", "internal metadata");
        var service = new ProducerService(new ProducerDao((sql, params) -> {
            assertEquals(List.of(Long.MAX_VALUE), params);
            assertFalse(sql.contains("SELECT *"));
            return List.of(row);
        }));
        var info = service.getInfo(Long.MAX_VALUE).orElseThrow();
        assertEquals(Long.toString(Long.MAX_VALUE), info.userId());
        assertEquals(0L, info.fans());
        assertNull(info.sign());
        var json = new ObjectMapper().readTree(new ObjectMapper().writeValueAsString(info));
        assertTrue(json.get("userId").isTextual());
        assertFalse(json.has("notes"));
        assertFalse(json.has("isFollowing"));
    }

    @Test
    void unknownAndDuplicateAccountsAreDistinct() {
        assertTrue(new ProducerService(new ProducerDao((sql, params) -> List.of())).getInfo(1).isEmpty());
        var dao = new ProducerDao((sql, params) -> List.of(Map.of("user_id", 1), Map.of("user_id", 1)));
        assertThrows(IllegalStateException.class, () -> dao.findInfo(1));
    }

    @Test
    void bothRolesAndAllSortOptionsUseBoundIdsAndStablePagination() {
        for (String role : List.of("uploader", "staff")) {
            for (String sort : List.of("view", "pubdate")) {
                for (String order : List.of("asc", "desc")) {
                    var request = new ProducerVideosRequest(396194, sort, order, role, 3, 10);
                    var dao = new ProducerDao((sql, params) -> {
                        assertEquals(List.of(396194L, 10, 20L), params);
                        assertTrue(sql.contains(role.equals("staff") ? "p.staff @> ARRAY[?]::bigint[]" : "p.user_id = ?"));
                        assertTrue(sql.contains("ORDER BY " + sort + " " + order.toUpperCase() + " NULLS LAST, p.aid ASC"));
                        assertFalse(sql.contains("video_static"));
                        return List.of(pageRow());
                    });
                    var page = new ProducerService(dao).getVideos(request);
                    assertEquals(21, page.total());
                    assertEquals(3, page.page());
                    assertEquals("114714449413822", page.rows().getFirst().aid());
                    assertNull(page.rows().getFirst().view());
                }
            }
        }
    }

    @Test
    void outOfRangePagesKeepTotalAndReturnAnEmptyList() {
        var service = new ProducerService(new ProducerDao((sql, params) -> List.of(Map.of("total", 21L, "unique_total", 21L))));
        var page = service.getVideos(new ProducerVideosRequest(1, "view", "desc", "staff", 99, 20));
        assertEquals(21L, page.total());
        assertTrue(page.rows().isEmpty());
    }

    @Test
    void duplicateVideoOrLatestSnapshotFailsInsteadOfChoosingArbitraryData() {
        var duplicateMetadata = pageRow();
        duplicateMetadata.put("unique_total", 20L);
        assertThrows(IllegalStateException.class, () -> new ProducerDao((sql, params) -> List.of(duplicateMetadata))
                .findVideos(new ProducerVideosRequest(1, "view", "desc", "uploader", 1, 20)));
        var duplicateSnapshot = pageRow();
        duplicateSnapshot.put("snapshot_count", 2L);
        assertThrows(IllegalStateException.class, () -> new ProducerDao((sql, params) -> List.of(duplicateSnapshot))
                .findVideos(new ProducerVideosRequest(1, "view", "desc", "uploader", 1, 20)));
    }

    private static HashMap<String, Object> pageRow() {
        var row = new HashMap<String, Object>();
        row.put("total", 21L);
        row.put("unique_total", 21L);
        row.put("aid", 114714449413822L);
        row.put("user_id", 396194L);
        row.put("pubdate", 1472134541L);
        row.put("snapshot_count", 1L);
        return row;
    }
}
