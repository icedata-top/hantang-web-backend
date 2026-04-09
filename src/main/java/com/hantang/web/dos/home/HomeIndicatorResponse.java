package com.hantang.web.dos.home;

import lombok.Data;

@Data
public class HomeIndicatorResponse {
    private Integer videoCount;
    private Integer singerCount;
    private Integer userCount;
    private Integer spanDays;

    public HomeIndicatorResponse(Integer videoCount, Integer singerCount, Integer userCount, Integer spanDays) {
        this.videoCount = videoCount;
        this.singerCount = singerCount;
        this.userCount = userCount;
        this.spanDays = spanDays;
    }
}
