package com.hantang.web.dos.producer;

import java.util.Map;
import java.util.Set;

public record ProducerListRequest(Long minFans, Integer minVideos, String sortBy, String order, int page, int pageSize) {
    public ProducerListRequest {
        if (minFans != null && minFans < 0) throw new IllegalArgumentException("minFans must be nonnegative");
        if (minVideos != null && minVideos < 0) throw new IllegalArgumentException("minVideos must be nonnegative");
        if (!Set.of("fans", "videoCount", "userId").contains(sortBy)) throw new IllegalArgumentException("Invalid sortBy");
        if (!Set.of("asc", "desc").contains(order)) throw new IllegalArgumentException("Invalid order");
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("Invalid page or pageSize (1–100)");
    }

    public static ProducerListRequest from(Map<String, String> params) {
        return new ProducerListRequest(number(params.get("minFans")), integer(params.get("minVideos"), null),
                params.getOrDefault("sortBy", "fans"), params.getOrDefault("order", "desc"),
                integer(params.get("page"), 1), integer(params.get("pageSize"), 20));
    }

    private static Long number(String raw) {
        if (raw == null) return null;
        try {
            if (!raw.matches("0|[1-9][0-9]*")) throw new IllegalArgumentException();
            return Long.parseLong(raw);
        } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Invalid nonnegative integer"); }
    }

    private static Integer integer(String raw, Integer fallback) {
        Long value = number(raw);
        if (value == null) return fallback;
        if (value > Integer.MAX_VALUE) throw new IllegalArgumentException("Integer is too large");
        return value.intValue();
    }

    public long offset() { return (long) (page - 1) * pageSize; }
}
