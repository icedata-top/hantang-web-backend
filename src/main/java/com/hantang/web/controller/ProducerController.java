package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.producer.ProducerVideosRequest;
import com.hantang.web.service.ProducerService;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class ProducerController extends BaseController {
    private static final Logger logger = LoggerFactory.getLogger(ProducerController.class);
    private final ProducerService producerService;

    public ProducerController() { this(new ProducerService()); }
    public ProducerController(ProducerService producerService) { this.producerService = producerService; }

    @Override
    public void registerRoutes(Javalin app) {
        app.get("/producers/{userId}/info", this::getInfo);
        app.get("/producers/{userId}/videos", this::getVideos);
    }

    private long userId(Context context) {
        String value = context.pathParam("userId");
        if (!value.matches("[1-9]\\d*")) throw new IllegalArgumentException("userId must be a positive 64-bit integer without leading zeros");
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("userId must be a positive 64-bit integer without leading zeros");
        }
    }

    private void getInfo(Context context) {
        long userId;
        try { userId = userId(context); }
        catch (IllegalArgumentException e) { badRequest(context, e); return; }
        try {
            var info = producerService.getInfo(userId);
            if (info.isEmpty()) context.status(404).json(ResponseDTO.error(404, "Producer not indexed"));
            else context.json(ResponseDTO.success(info.get()));
        } catch (Exception e) {
            logger.error("Producer info query failed, userId={}", userId, e);
            context.status(500).json(ResponseDTO.error(500, "Unable to load producer information"));
        }
    }

    private void getVideos(Context context) {
        ProducerVideosRequest request;
        try {
            request = ProducerVideosRequest.from(userId(context), context.queryParam("sortBy"),
                    context.queryParam("order"), context.queryParam("role"),
                    context.queryParam("page"), context.queryParam("pageSize"));
        } catch (IllegalArgumentException e) { badRequest(context, e); return; }
        try {
            context.json(ResponseDTO.success(producerService.getVideos(request)));
        } catch (Exception e) {
            logger.error("Producer video query failed, userId={}", request.userId(), e);
            context.status(500).json(ResponseDTO.error(500, "Unable to load producer videos"));
        }
    }

    private void badRequest(Context context, IllegalArgumentException error) {
        context.status(400).json(ResponseDTO.error(400, error.getMessage()));
    }
}
