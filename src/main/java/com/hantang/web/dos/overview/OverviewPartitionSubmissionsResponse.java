package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class OverviewPartitionSubmissionsResponse {
    private List<PartitionSubmissionRow> rows;

    public OverviewPartitionSubmissionsResponse(List<PartitionSubmissionRow> rows) {
        this.rows = rows;
    }

    public List<PartitionSubmissionRow> getRows() {
        return rows;
    }

    public void setRows(List<PartitionSubmissionRow> rows) {
        this.rows = rows;
    }

    @Data
    @AllArgsConstructor
    public static class PartitionSubmissionRow {
        private Integer typeId;
        private Long count;

        public PartitionSubmissionRow(Integer typeId, Long count) {
            this.typeId = typeId;
            this.count = count;
        }

        public Integer getTypeId() {
            return typeId;
        }

        public void setTypeId(Integer typeId) {
            this.typeId = typeId;
        }

        public Long getCount() {
            return count;
        }

        public void setCount(Long count) {
            this.count = count;
        }
    }
}
