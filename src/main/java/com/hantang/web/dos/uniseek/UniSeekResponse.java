package com.hantang.web.dos.uniseek;

import java.util.List;
import java.util.Map;

public record UniSeekResponse(String keyword, int page, int pageSize, boolean hasMore,
                              Integer nextPage, int videoLimit, List<Item> list) {
    public record Matches(List<Item> list) {}
    public record Producers(String keyword, List<Item> list) {}
    /** Scores stay within each SQL query and are never compared across entity types. */
    public record Item(String type, String id, String title, String subTitle,
                       String coverUrl, String jumpUrl, Map<String, Object> payload) {}
}
