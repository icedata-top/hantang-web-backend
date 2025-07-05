package enums;

public enum Metric {
    COIN,
    FAVORITE,
    DANMAKU,
    VIEW,
    REPLY,
    SHARE,
    LIKE;

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

