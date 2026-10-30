package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.video.VideoDailyMetricsRequest;
import com.hantang.web.service.VideoService;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;
import java.util.function.LongFunction;

public class VideoController extends BaseController {
    private static final Logger logger = LoggerFactory.getLogger(VideoController.class);
    private final VideoService videoService;

    public VideoController() {
        this(new VideoService());
    }

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
    }

    @Override
    public void registerRoutes(Javalin app) {
        app.get("/videos/{aid}/info", this::getInfo);
        app.get("/videos/{aid}/latest-metrics", this::getLatestMetrics);
        app.get("/videos/{aid}/daily-metrics", this::getDailyMetrics);
    }

    void getInfo(Context context) {
        respond(context, videoService::getInfo, "Video not found");
    }

    void getLatestMetrics(Context context) {
        respond(context, videoService::getLatestMetrics, "No daily snapshot available");
    }

    void getDailyMetrics(Context context) {
        VideoDailyMetricsRequest request;
        try {
            request = VideoDailyMetricsRequest.from(parseAid(context), context.queryParam("startDate"), context.queryParam("endDate"));
        } catch (IllegalArgumentException e) {
            context.status(400).json(ResponseDTO.error(400, e.getMessage()));
            return;
        }
        try {
            context.json(ResponseDTO.success(videoService.getDailyMetrics(request)));
        } catch (Exception e) {
            logger.error("Video daily metrics query failed, request={}", request, e);
            context.status(500).json(ResponseDTO.error(500, "Unable to load video daily metrics"));
        }
    }

    private static long parseAid(Context context) {
        try {
            String raw = context.pathParam("aid");
            if (!raw.matches("[1-9]\\d*")) throw new IllegalArgumentException();
            return Long.parseLong(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("aid must be a positive 64-bit integer without leading zeros");
        }
    }

    private <T> void respond(Context context, LongFunction<Optional<T>> query, String notFoundMessage) {
        long aid;
        try {
            aid = parseAid(context);
        } catch (IllegalArgumentException e) {
            context.status(400).json(ResponseDTO.error(400, "aid must be a positive 64-bit integer without leading zeros"));
            return;
        }
        try {
            Optional<T> result = query.apply(aid);
            if (result.isEmpty()) {
                context.status(404).json(ResponseDTO.error(404, notFoundMessage));
            } else {
                context.json(ResponseDTO.success(result.get()));
            }
        } catch (Exception e) {
            logger.error("Video query failed, aid={}", aid, e);
            context.status(500).json(ResponseDTO.error(500, "Unable to load video data"));
        }
    }
}
