package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.overview.OverviewIndicatorsResponse;
import com.hantang.web.dos.overview.OverviewPartitionSubmissionsResponse;
import com.hantang.web.dos.overview.OverviewRequest;
import com.hantang.web.dos.overview.OverviewTrendResponse;
import com.hantang.web.dos.overview.OverviewViewHistogramResponse;
import com.hantang.web.service.OverviewService;
import io.javalin.Javalin;
import io.javalin.http.Context;

import java.util.List;

public class OverviewController extends BaseController {
    private final OverviewService overviewService;

    public OverviewController() {
        this.overviewService = new OverviewService();
    }

    @Override
    public void registerRoutes(Javalin app) {
        app.post("/overview/get-indicators", this::getIndicators);
        app.post("/overview/get-trend", this::getTrend);
        app.post("/overview/get-partition-submissions", this::getPartitionSubmissions);
        app.post("/overview/get-view-histogram", this::getViewHistogram);
    }

    private void getIndicators(Context context) {
        try {
            OverviewRequest request = context.bodyAsClass(OverviewRequest.class);
            OverviewIndicatorsResponse response = overviewService.getIndicators(request);
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }

    private void getTrend(Context context) {
        try {
            OverviewRequest request = context.bodyAsClass(OverviewRequest.class);
            OverviewTrendResponse response = overviewService.getTrend(request);
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }

    private void getPartitionSubmissions(Context context) {
        try {
            OverviewRequest request = context.bodyAsClass(OverviewRequest.class);
            OverviewPartitionSubmissionsResponse response = overviewService.getPartitionSubmissions(request);
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
