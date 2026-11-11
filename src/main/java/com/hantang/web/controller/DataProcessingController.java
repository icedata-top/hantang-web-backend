package com.hantang.web.controller;

import com.hantang.web.dao.DataProcessingDao.Source;
import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.service.DataProcessingService;
import io.javalin.Javalin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.CompletionException;
import java.util.concurrent.RejectedExecutionException;

public class DataProcessingController extends BaseController {
    private static final Logger logger = LoggerFactory.getLogger(DataProcessingController.class);
    private final DataProcessingService service;
    public DataProcessingController() { this(new DataProcessingService()); }
    public DataProcessingController(DataProcessingService service) { this.service = service; }
    @Override public void registerRoutes(Javalin app) {
        app.get("/admin/data/processing/{source}", context -> {
            Source source;
            try { source = Source.from(context.pathParam("source")); }
            catch (IllegalArgumentException error) { context.status(404).json(ResponseDTO.error(404, "Unknown processing source")); return; }
            try { context.json(ResponseDTO.success(service.get(source).join())); }
            catch (Exception error) {
                var cause = error instanceof CompletionException ? error.getCause() : error;
                if (cause instanceof RejectedExecutionException) context.status(503).json(ResponseDTO.error(503, "Processing status is busy"));
                else {
                    logger.error("Processing status query failed, source={}", source.id, error);
                    context.status(500).json(ResponseDTO.error(500, "Unable to load processing status"));
                }
            }
        });
    }
}
