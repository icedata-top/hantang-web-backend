package com.hantang.web.dos.producer;

public record ProducerVideosRequest(long userId, String sortBy, String order, String role, int page, int pageSize) {
    public ProducerVideosRequest {
        if (userId < 1) throw new IllegalArgumentException("userId must be positive");
        if (!"view".equals(sortBy) && !"pubdate".equals(sortBy)) {
            throw new IllegalArgumentException("sortBy must be view or pubdate");
        }
        if (!"asc".equals(order) && !"desc".equals(order)) {
            throw new IllegalArgumentException("order must be asc or desc");
        }
        if (!"uploader".equals(role) && !"staff".equals(role)) {
            throw new IllegalArgumentException("role must be uploader or staff");
        }
        if (page < 1) throw new IllegalArgumentException("page must be positive");
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("pageSize must be between 1 and 100");
    }

    public static ProducerVideosRequest from(long userId, String sortBy, String order, String role,
                                             String page, String pageSize) {
        return new ProducerVideosRequest(userId, sortBy == null ? "pubdate" : sortBy,
                order == null ? "desc" : order, role == null ? "uploader" : role,
                integer(page, 1, "page"), integer(pageSize, 20, "pageSize"));
    }

    private static int integer(String value, int fallback, String name) {
        if (value == null) return fallback;
        if (!value.matches("[1-9]\\d*")) throw new IllegalArgumentException(name + " must be a positive integer");
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(name + " is too large");
        }
    }

    public long offset() {
        return (long) (page - 1) * pageSize;
    }
}
