package com.hantang.web.dos.overview;

import java.util.List;

public class OverviewGateCrossingsResponse {
    private List<GateCrossingRow> rows;
    private Long total;
    private Integer page;
    private Integer pageSize;

    public OverviewGateCrossingsResponse() {
    }

    public OverviewGateCrossingsResponse(List<GateCrossingRow> rows, Long total, Integer page, Integer pageSize) {
        this.rows = rows;
        this.total = total;
        this.page = page;
        this.pageSize = pageSize;
    }

    public List<GateCrossingRow> getRows() {
        return rows;
    }

    public void setRows(List<GateCrossingRow> rows) {
        this.rows = rows;
    }

    public Long getTotal() {
        return total;
    }

    public void setTotal(Long total) {
        this.total = total;
    }

    public Integer getPage() {
        return page;
    }

    public void setPage(Integer page) {
        this.page = page;
    }

    public Integer getPageSize() {
        return pageSize;
    }

    public void setPageSize(Integer pageSize) {
        this.pageSize = pageSize;
    }

    public static class GateCrossingRow {
        private Long id;
        private Long aid;
        private Long gateValue;
        private Long previousView;
        private Long currentView;
        private String crossedAt;
        private String createdAt;

        public GateCrossingRow() {
        }

        public GateCrossingRow(
                Long id,
                Long aid,
                Long gateValue,
                Long previousView,
                Long currentView,
                String crossedAt,
                String createdAt
        ) {
            this.id = id;
            this.aid = aid;
            this.gateValue = gateValue;
            this.previousView = previousView;
            this.currentView = currentView;
            this.crossedAt = crossedAt;
            this.createdAt = createdAt;
        }

        public Long getId() {
            return id;
        }

        public void setId(Long id) {
            this.id = id;
        }

        public Long getAid() {
            return aid;
        }

        public void setAid(Long aid) {
            this.aid = aid;
        }

        public Long getGateValue() {
            return gateValue;
        }

        public void setGateValue(Long gateValue) {
            this.gateValue = gateValue;
        }

        public Long getPreviousView() {
            return previousView;
        }

        public void setPreviousView(Long previousView) {
            this.previousView = previousView;
        }

        public Long getCurrentView() {
            return currentView;
        }

        public void setCurrentView(Long currentView) {
            this.currentView = currentView;
        }

        public String getCrossedAt() {
            return crossedAt;
        }

        public void setCrossedAt(String crossedAt) {
            this.crossedAt = crossedAt;
        }

        public String getCreatedAt() {
            return createdAt;
        }

        public void setCreatedAt(String createdAt) {
            this.createdAt = createdAt;
        }
    }
}
