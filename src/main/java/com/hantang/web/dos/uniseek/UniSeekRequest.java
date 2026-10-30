package com.hantang.web.dos.uniseek;

import java.util.List;

/** Keyword search only. Exact AV/BV/UID lookups use the existing detail endpoints. */
public record UniSeekRequest(String keyword, Integer page, Integer pageSize) {
    public static final int VIDEO_LIMIT = 1000;

    public UniSeekRequest validated() {
        String q = keyword == null ? "" : keyword.strip();
        if (q.isEmpty() || q.length() > 100) throw new IllegalArgumentException("keyword must contain 1–100 characters");
        int p = page == null ? 1 : page;
        int size = pageSize == null ? 30 : pageSize;
        if (p < 1 || p > VIDEO_LIMIT || size < 1 || size > 50) {
            throw new IllegalArgumentException("page must be 1–1000 and pageSize must be 1–50");
        }
        return new UniSeekRequest(q, p, size);
    }

    public static UniSeekRequest from(String keyword, String page, String pageSize) {
        return new UniSeekRequest(keyword, positiveInteger(page), positiveInteger(pageSize)).validated();
    }
    private static Integer positiveInteger(String value) {
        if (value == null) return null;
        if (!value.matches("[1-9][0-9]*")) throw new IllegalArgumentException("Invalid page or pageSize");
        try { return Integer.valueOf(value); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("Invalid page or pageSize"); }
    }
    public long offset() { return (long) (page - 1) * pageSize; }
    public List<String> tokens() { return List.of(keyword.split("(?U)\\s+")); }
    public static String containsPattern(String value) {
        return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
}
