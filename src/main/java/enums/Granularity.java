package enums;

public enum Granularity {
    MINUTE,
    DAY;

    public static Granularity fromString(String s) {
        if (s == null) {
            throw new IllegalArgumentException("Input string cannot be null");
        }
        return switch (s.toLowerCase()) {
            case "minute" -> MINUTE;
            case "day" -> DAY;
            default -> throw new IllegalArgumentException("No matching Granularity for string: '" + s + "'");
        };
    }
}

