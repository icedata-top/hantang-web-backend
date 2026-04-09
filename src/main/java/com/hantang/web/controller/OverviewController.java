package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.overview.OverviewIndicatorsResponse;
import com.hantang.web.dos.overview.OverviewPartitionSubmissionsResponse;
import com.hantang.web.dos.overview.OverviewRequest;
import com.hantang.web.dos.overview.OverviewTrendResponse;
import com.hantang.web.dos.overview.OverviewViewHistogramResponse;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.util.List;
import java.util.Map;

public class OverviewController extends BaseController {
    @Override
    public void registerRoutes(Javalin app) {
        app.post("/overview/get-indicators", this::getIndicators);
        app.post("/overview/get-trend", this::getTrend);
        app.post("/overview/get-partition-submissions", this::getPartitionSubmissions);
        app.post("/overview/get-view-histogram", this::getViewHistogram);
    }

    private void getIndicators(Context context) {
        try {
            context.bodyAsClass(OverviewRequest.class);
            OverviewIndicatorsResponse response = new OverviewIndicatorsResponse(
                    List.of(
                            new OverviewIndicatorsResponse.Indicator("newVideoCount", 1435L, 0.15, 0.11),
                            new OverviewIndicatorsResponse.Indicator("activeUserCount", 107L, -0.05, -0.03),
                            new OverviewIndicatorsResponse.Indicator("view", 1274561L, 0.012, 0.008),
                            new OverviewIndicatorsResponse.Indicator("favorite", 109143L, -0.011, 0.015)
                    )
            );
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }

    private void getTrend(Context context) {
        try {
            context.bodyAsClass(OverviewRequest.class);
            OverviewTrendResponse response = new OverviewTrendResponse(
                    List.of(
                            new OverviewTrendResponse.TrendRow(
                                    "2026-04-01",
                                    Map.of(
                                            "newVideoCount", 118L,
                                            "activeUserCount", 92L,
                                            "view", 920000L,
                                            "favorite", 88500L,
                                            "like", 12100L,
                                            "coin", 8200L,
                                            "share", 2100L,
                                            "reply", 5100L,
                                            "danmaku", 1580L
                                    )
                            )
                    )
            );
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }

    private void getPartitionSubmissions(Context context) {
        try {
            OverviewRequest request = context.bodyAsClass(OverviewRequest.class);
            String scope = request.getAddtionalParams() == null ? null : request.getAddtionalParams().get("scope");
            OverviewPartitionSubmissionsResponse response;
            if ("new".equals(scope)) {
                response = new OverviewPartitionSubmissionsResponse(
                        List.of(
                                new OverviewPartitionSubmissionsResponse.PartitionSubmissionRow(30, 58L),
                                new OverviewPartitionSubmissionsResponse.PartitionSubmissionRow(21, 44L)
                        )
                );
            } else {
                response = new OverviewPartitionSubmissionsResponse(
                        List.of(
                                new OverviewPartitionSubmissionsResponse.PartitionSubmissionRow(30, 469L),
                                new OverviewPartitionSubmissionsResponse.PartitionSubmissionRow(21, 418L)
                        )
                );
            }
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }

    private void getViewHistogram(Context context) {
        try {
            OverviewRequest request = context.bodyAsClass(OverviewRequest.class);
            String scope = request.getAddtionalParams() == null ? null : request.getAddtionalParams().get("scope");
            OverviewViewHistogramResponse response;
            if ("new".equals(scope)) {
                response = new OverviewViewHistogramResponse(
                        List.of(
                                new OverviewViewHistogramResponse.ViewHistogramRow("E02", "0-10", 8634L),
                                new OverviewViewHistogramResponse.ViewHistogramRow("E03", "10-100", 2944L)
                        )
                );
            } else {
                response = new OverviewViewHistogramResponse(
                        List.of(
                                new OverviewViewHistogramResponse.ViewHistogramRow("E02", "0-10", 60683L),
                                new OverviewViewHistogramResponse.ViewHistogramRow("E03", "10-100", 19334L)
                        )
                );
            }
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }
}
