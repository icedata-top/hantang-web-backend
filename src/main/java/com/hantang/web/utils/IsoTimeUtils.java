package com.hantang.web.utils;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

public class IsoTimeUtils {
    // 定义线程安全的日期格式化器
    private static final DateTimeFormatter formatter =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 将 ISO 8601 日期时间字符串解析为秒级 UNIX 时间戳
     * @param isoString ISO 8601 格式，如 "2025-07-05" 或 "2025-07-05T14:30:00Z"
     * @return 秒级 UNIX 时间戳
     */
    public static int toUnixTimestamp(String isoString) {
        if (isoString == null || isoString.isBlank()) {
            throw new IllegalArgumentException("Input string cannot be null or blank");
        }

        try {
            // 尝试解析为 OffsetDateTime（带时区）
            OffsetDateTime offsetDateTime = OffsetDateTime.parse(isoString);
            return (int) offsetDateTime.toEpochSecond();
        } catch (DateTimeParseException e) {
            // 如果没有时区信息，尝试解析为 LocalDateTime（假设为 UTC）
            try {
                LocalDateTime localDateTime = LocalDateTime.parse(isoString);
                return (int) localDateTime.toEpochSecond(ZoneOffset.UTC);
            } catch (DateTimeParseException ex) {
                // 如果只有日期，解析为 LocalDate
                LocalDate localDate = LocalDate.parse(isoString);
                return (int) localDate.atStartOfDay().toEpochSecond(ZoneOffset.UTC);
            }
        }
    }

    /**
     * 将 ISO 8601 日期时间字符串解析为 yyyy-MM-dd 格式的字符串
     * @param isoString ISO 8601 格式，如 "2025-07-05T14:30:00Z"
     * @return yyyy-MM-dd 格式字符串
     */
    public static String toDateString(String isoString) {
        if (isoString == null || isoString.isBlank()) {
            throw new IllegalArgumentException("Input string cannot be null or blank");
        }

        try {
            // 优先尝试解析为带时区的 OffsetDateTime
            OffsetDateTime offsetDateTime = OffsetDateTime.parse(isoString);
            return offsetDateTime.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            try {
                // 如果没有时区信息，解析为 LocalDateTime
                LocalDateTime localDateTime = LocalDateTime.parse(isoString);
                return localDateTime.toLocalDate().format(DateTimeFormatter.ISO_LOCAL_DATE);
            } catch (DateTimeParseException ex) {
                // 如果只有日期
                LocalDate localDate = LocalDate.parse(isoString);
                return localDate.format(DateTimeFormatter.ISO_LOCAL_DATE);
            }
        }
    }

    /**
     * 将秒级 UNIX 时间戳转换为指定格式的日期时间字符串
     * @param timestamp 秒级时间戳（int）
     * @return 格式化后的日期时间字符串
     */
    public static String formatTimestamp(int timestamp) {
        // 将秒级时间戳转换为 Instant，再转换为系统默认时区的 LocalDateTime
        LocalDateTime dateTime = LocalDateTime.ofInstant(
                Instant.ofEpochSecond(timestamp),
                ZoneId.systemDefault()
        );
        return dateTime.format(formatter);
    }

    /**
     * {@code yyyy-MM-dd}：该日 00:00:00（{@link ZoneId#systemDefault()}）对应的 Unix 秒。
     */
    public static long dateOnlyToStartOfDayEpochSeconds(String yyyyMmDd) {
        if (yyyyMmDd == null || yyyyMmDd.isBlank()) {
            throw new IllegalArgumentException("date string cannot be null or blank");
        }
        LocalDate d = LocalDate.parse(yyyyMmDd.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        return d.atStartOfDay(ZoneId.systemDefault()).toEpochSecond();
    }

    /**
     * {@code yyyy-MM-dd}：该日最后一秒（含）对应的 Unix 秒，即次日 00:00:00 前一秒。
     */
    public static long dateOnlyToEndOfDayEpochSecondsInclusive(String yyyyMmDd) {
        if (yyyyMmDd == null || yyyyMmDd.isBlank()) {
            throw new IllegalArgumentException("date string cannot be null or blank");
        }
        LocalDate d = LocalDate.parse(yyyyMmDd.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        return d.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toEpochSecond() - 1;
    }
}
