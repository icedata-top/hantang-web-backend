package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.service.DailyService;
import io.javalin.Javalin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DailyController extends BaseController {
    private static final Logger logger = LoggerFactory.getLogger(DailyController.class);
    private final DailyService service;

    public DailyController() {
        this(new DailyService());
    }

    public DailyController(DailyService service) {
        this.service = service;
    }

    @Override
    public void registerRoutes(Javalin app) {
        app.get("/daily/latest-date", context -> {
            try {
                context.json(ResponseDTO.success(service.getLatestDate()));
            } catch (Exception e) {
                logger.error("Latest daily record date query failed", e);
                context.status(500).json(ResponseDTO.error(500, "Unable to load latest daily record date"));
            }
        });
    }
}
