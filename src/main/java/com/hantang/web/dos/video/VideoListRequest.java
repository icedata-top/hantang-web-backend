package com.hantang.web.dos.video;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.Set;

/** Browsing is independent of UniSeek's keyword ranking and 1,000-result limit. */
public record VideoListRequest(LocalDate startDate, LocalDate endDate, String honor, Integer typeId,
                               Long minView, String sortBy, String order, int page, int pageSize) {
    private static final ZoneId BEIJING = ZoneId.of("Asia/Shanghai");
    public VideoListRequest {
        if (startDate != null && endDate != null && startDate.isAfter(endDate))
            throw new IllegalArgumentException("startDate must not be after endDate");
        if (!Set.of("all", "none", "hall", "legend", "myth").contains(honor))
            throw new IllegalArgumentException("Invalid honor");
        if (typeId != null && typeId < 1) throw new IllegalArgumentException("typeId must be positive");
        if (minView != null && minView < 0) throw new IllegalArgumentException("minView must be nonnegative");
        if (!Set.of("pubdate", "view", "favorite", "like").contains(sortBy))
            throw new IllegalArgumentException("Invalid sortBy");
        if (!Set.of("asc", "desc").contains(order)) throw new IllegalArgumentException("Invalid order");
        if (page < 1 || pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("Invalid page or pageSize (1–100)");
    }

    public static VideoListRequest from(Map<String, String> params) {
        return new VideoListRequest(date(params.get("startDate")), date(params.get("endDate")),
                params.getOrDefault("honor", "all"), integer(params.get("typeId"), null),
                number(params.get("minView")), params.getOrDefault("sortBy", "pubdate"),
                params.getOrDefault("order", "desc"), integer(params.get("page"), 1), integer(params.get("pageSize"), 20));
    }
    private static LocalDate date(String raw) {
        if (raw == null) return null;
        try {
            if (!raw.matches("\\d{4}-\\d{2}-\\d{2}")) throw new IllegalArgumentException();
            var date = LocalDate.parse(raw);
            if (date.getYear() < 2009 || date.getYear() > 2100) throw new IllegalArgumentException();
            return date;
        } catch (IllegalArgumentException | java.time.DateTimeException e) {
            throw new IllegalArgumentException("Dates must be YYYY-MM-DD between 2009 and 2100");
        }
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
        if (value < 1 || value > Integer.MAX_VALUE) throw new IllegalArgumentException("Invalid positive integer");
        return value.intValue();
    }
    public long offset() { return (long) (page - 1) * pageSize; }
    public Long startEpoch() { return startDate == null ? null : startDate.atStartOfDay(BEIJING).toEpochSecond(); }
    public Long endEpochExclusive() { return endDate == null ? null : endDate.plusDays(1).atStartOfDay(BEIJING).toEpochSecond(); }
}
