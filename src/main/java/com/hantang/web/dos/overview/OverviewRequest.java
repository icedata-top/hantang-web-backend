package com.hantang.web.dos.overview;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDate;
import java.util.Map;

/**
 * 概览接口统一请求体；起止为日历日（含），JSON 使用 {@code yyyy-MM-dd}。
 * 字段名可用 {@code startDate}/{@code endDate}，或与旧客户端兼容的 {@code startTime}/{@code endTime}。
 */
public class OverviewRequest {
    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate startDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate endDate;

    private Map<String, String> addtionalParams;

    public OverviewRequest() {
    }

    public OverviewRequest(LocalDate startDate, LocalDate endDate, Map<String, String> addtionalParams) {
        this.startDate = startDate;
        this.endDate = endDate;
        this.addtionalParams = addtionalParams;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public Map<String, String> getAddtionalParams() {
        return addtionalParams;
    }

    public void setAddtionalParams(Map<String, String> addtionalParams) {
        this.addtionalParams = addtionalParams;
    }
}
