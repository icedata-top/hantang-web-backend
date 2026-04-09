package com.hantang.web.dos.overview;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class OverviewIndicatorsResponse {
    private List<Indicator> indicators;

    public OverviewIndicatorsResponse(List<Indicator> indicators) {
        this.indicators = indicators;
    }

    public List<Indicator> getIndicators() {
        return indicators;
    }

    public void setIndicators(List<Indicator> indicators) {
        this.indicators = indicators;
    }

    @Data
    @AllArgsConstructor
    public static class Indicator {
        private String name;
        private Long value;
        private Double yoy;
        private Double dod;

        public Indicator(String name, Long value, Double yoy, Double dod) {
            this.name = name;
            this.value = value;
            this.yoy = yoy;
            this.dod = dod;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public Long getValue() {
            return value;
        }

        public void setValue(Long value) {
            this.value = value;
        }

        public Double getYoy() {
            return yoy;
        }

        public void setYoy(Double yoy) {
            this.yoy = yoy;
        }

        public Double getDod() {
            return dod;
        }

        public void setDod(Double dod) {
            this.dod = dod;
        }
    }
}
