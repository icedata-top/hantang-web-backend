package com.hantang.web.dos.overview;

import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class OverviewRequest {
    private String startTime;
    private String endTime;
    private Map<String, String> addtionalParams;

    public String getStartTime() {
        return startTime;
    }

    public void setStartTime(String startTime) {
        this.startTime = startTime;
    }

    public String getEndTime() {
        return endTime;
    }

    public void setEndTime(String endTime) {
        this.endTime = endTime;
    }

    public Map<String, String> getAddtionalParams() {
        return addtionalParams;
    }

    public void setAddtionalParams(Map<String, String> addtionalParams) {
        this.addtionalParams = addtionalParams;
    }
}
