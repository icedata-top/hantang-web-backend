package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class OverviewIndicatorsResponse {
    private List<Indicator> indicators;

    @Data
    @AllArgsConstructor
    public static class Indicator {
        private String name;
        private Long value;
        private Double yoy;
        private Double dod;
    }
}
