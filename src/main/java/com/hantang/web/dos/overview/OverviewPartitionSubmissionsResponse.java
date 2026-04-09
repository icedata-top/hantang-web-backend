package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class OverviewPartitionSubmissionsResponse {
    private List<PartitionSubmissionRow> rows;

    @Data
    @AllArgsConstructor
    public static class PartitionSubmissionRow {
        private Integer typeId;
        private Long count;
    }
}
