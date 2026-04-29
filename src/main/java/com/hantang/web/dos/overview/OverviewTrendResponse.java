package com.hantang.web.dos.overview;

import java.util.List;
import java.util.Map;

public class OverviewTrendResponse {
    private List<TrendRow> rows;

    public OverviewTrendResponse() {
    }

    public OverviewTrendResponse(List<TrendRow> rows) {
        this.rows = rows;
    }

    public List<TrendRow> getRows() {
        return rows;
    }

    public void setRows(List<TrendRow> rows) {
        this.rows = rows;
    }

    public static class TrendRow {
        private String date;
        private Map<String, Long> indicators;

        public TrendRow() {
        }

        public TrendRow(String date, Map<String, Long> indicators) {
            this.date = date;
            this.indicators = indicators;
        }

        public String getDate() {
            return date;
        }

        public void setDate(String date) {
            this.date = date;
        }

        public Map<String, Long> getIndicators() {
            return indicators;
        }

        public void setIndicators(Map<String, Long> indicators) {
            this.indicators = indicators;
        }
    }
}
