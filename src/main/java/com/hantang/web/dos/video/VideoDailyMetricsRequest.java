package com.hantang.web.dos.video;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/** Inclusive snapshot dates. The API returns cumulative values, never deltas. */
public record VideoDailyMetricsRequest(long aid, LocalDate startDate, LocalDate endDate) {
    public VideoDailyMetricsRequest {
        if (aid < 1) throw new IllegalArgumentException("aid must be positive");
        if (startDate == null || endDate == null) {
            throw new IllegalArgumentException("startDate and endDate are required (YYYY-MM-DD)");
        }
        if (startDate.getYear() < 1 || endDate.getYear() > 9999 || endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("dates must be between 0001-01-01 and 9999-12-31, with endDate >= startDate");
        }
        if (ChronoUnit.DAYS.between(startDate, endDate) >= 366) {
            throw new IllegalArgumentException("date range must contain at most 366 snapshot dates");
        }
    }

    public static VideoDailyMetricsRequest from(long aid, String startDate, String endDate) {
        return new VideoDailyMetricsRequest(aid, parseDate(startDate), parseDate(endDate));
    }

    private static LocalDate parseDate(String value) {
        if (value == null || !value.matches("\\d{4}-\\d{2}-\\d{2}")) {
            throw new IllegalArgumentException("startDate and endDate are required (YYYY-MM-DD)");
        }
        try {
            return LocalDate.parse(value);
        } catch (java.time.format.DateTimeParseException e) {
            throw new IllegalArgumentException("startDate and endDate must be valid calendar dates (YYYY-MM-DD)");
        }
    }
}
