package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class OverviewViewHistogramResponse {
    private List<ViewHistogramRow> rows;

    public OverviewViewHistogramResponse(List<ViewHistogramRow> rows) {
        this.rows = rows;
    }

    public List<ViewHistogramRow> getRows() {
        return rows;
    }

    public void setRows(List<ViewHistogramRow> rows) {
        this.rows = rows;
    }

    @Data
    @AllArgsConstructor
    public static class ViewHistogramRow {
        private String code;
        private String label;
        private Long count;

        public ViewHistogramRow(String code, String label, Long count) {
            this.code = code;
            this.label = label;
            this.count = count;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getLabel() {
            return label;
        }

        public void setLabel(String label) {
            this.label = label;
        }

        public Long getCount() {
            return count;
        }

        public void setCount(Long count) {
            this.count = count;
        }
    }
}
