package com.hantang.web.enums;

public enum Metric {
    COIN("coin"),
    FAVORITE("favorite"),
    DANMAKU("danmaku"),
    VIEW("view"),
    REPLY("reply"),
    SHARE("share"),
    LIKE("like");

    private final String field;

    // 构造方法，初始化数据库字段名
    Metric(String field) {
        this.field = field;
    }

    // 获取数据库字段名的方法
    public String getField() {
        return field;
    }

    public static Metric fromString(String s) {
        if (s == null) {
            throw new IllegalArgumentException("Input string cannot be null");
        }
        return switch (s.toLowerCase()) {
            case "coin" -> COIN;
            case "favorite" -> FAVORITE;
            case "danmaku" -> DANMAKU;
            case "view" -> VIEW;
            case "reply" -> REPLY;
            case "share" -> SHARE;
            case "like" -> LIKE;
            default -> throw new IllegalArgumentException("No matching Metric for string: '" + s + "'");
        };
    }
}

