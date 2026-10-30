package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.uniseek.UniSeekRequest;
import com.hantang.web.service.UniSeekService;
import io.javalin.Javalin;
import io.javalin.http.Context;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.concurrent.RejectedExecutionException;
import java.util.function.Supplier;

public class UniSeekController extends BaseController {
    private static final Logger logger = LoggerFactory.getLogger(UniSeekController.class);
    private final UniSeekService service;
    public UniSeekController() { this(new UniSeekService()); }
    public UniSeekController(UniSeekService service) { this.service = service; }

    @Override public void registerRoutes(Javalin app) {
        app.get("/uniseek/videos", context -> {
            UniSeekRequest request;
            try { request = UniSeekRequest.from(context.queryParam("keyword"), context.queryParam("page"), context.queryParam("pageSize")); }
            catch (IllegalArgumentException e) { badRequest(context, e); return; }
            respond(context, () -> service.searchVideos(request));
        });
        app.get("/uniseek/producers", context -> {
            UniSeekRequest request;
            try { request = new UniSeekRequest(context.queryParam("keyword"), 1, 20).validated(); }
            catch (IllegalArgumentException e) { badRequest(context, e); return; }
            respond(context, () -> service.searchProducers(request.keyword()));
        });
        app.get("/uniseek/videos/{aid}", context -> {
            long aid;
            try { aid = positiveId(context.pathParam("aid")); }
            catch (IllegalArgumentException e) { badRequest(context, e); return; }
            respond(context, () -> service.searchVideoById(aid));
        });
        app.get("/uniseek/producers/{userId}", context -> {
            long userId;
            try { userId = positiveId(context.pathParam("userId")); }
            catch (IllegalArgumentException e) { badRequest(context, e); return; }
            respond(context, () -> service.searchProducerById(userId));
        });
    }
    private static long positiveId(String value) {
        if (!value.matches("[1-9][0-9]*")) throw new IllegalArgumentException("ID must be a positive 64-bit integer");
        try { return Long.parseLong(value); }
        catch (NumberFormatException e) { throw new IllegalArgumentException("ID must be a positive 64-bit integer"); }
    }
    private void badRequest(Context context, IllegalArgumentException error) {
        context.status(400).json(ResponseDTO.error(400, error.getMessage()));
    }
    private void respond(Context context, Supplier<?> search) {
        try { context.json(ResponseDTO.success(search.get())); }
        catch (RejectedExecutionException e) {
            context.status(503).json(ResponseDTO.error(503, "搜索繁忙，请稍后重试"));
        } catch (Exception e) {
            logger.error("UniSeek query failed, path={}", context.path(), e);
            context.status(500).json(ResponseDTO.error(500, "搜索暂时不可用，请缩小关键词范围或稍后重试"));
        }
    }
}
