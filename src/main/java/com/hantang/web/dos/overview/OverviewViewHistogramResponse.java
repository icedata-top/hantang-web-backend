package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class OverviewViewHistogramResponse {
    private List<ViewHistogramRow> rows;

    @Data
    @AllArgsConstructor
    public static class ViewHistogramRow {
        private String code;
        private String label;
        private Long count;
    }
}
