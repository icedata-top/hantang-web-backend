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
}
