package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
public class OverviewTrendResponse {
    private List<TrendRow> rows;

    @Data
    @AllArgsConstructor
    public static class TrendRow {
        private String date;
        private Map<String, Long> indicators;
    }
}
