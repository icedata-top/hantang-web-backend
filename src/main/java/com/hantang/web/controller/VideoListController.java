package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.video.VideoListRequest;
import com.hantang.web.service.VideoListService;
import io.javalin.Javalin;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.HashMap;

public class VideoListController extends BaseController {
    private static final Logger logger = LoggerFactory.getLogger(VideoListController.class);
    private final VideoListService service;
    public VideoListController() { this(new VideoListService()); }
    public VideoListController(VideoListService service) { this.service = service; }
    @Override public void registerRoutes(Javalin app) {
        app.get("/videos", context -> {
            VideoListRequest request;
            try {
                var params = new HashMap<String, String>();
                for (String key : new String[]{"startDate", "endDate", "honor", "typeId", "minView", "sortBy", "order", "page", "pageSize"}) {
                    if (context.queryParam(key) != null) params.put(key, context.queryParam(key));
                }
                request = VideoListRequest.from(params);
            } catch (IllegalArgumentException e) {
                context.status(400).json(ResponseDTO.error(400, e.getMessage())); return;
            }
            try { context.json(ResponseDTO.success(service.list(request))); }
            catch (Exception e) {
                logger.error("Video list query failed, request={}", request, e);
                context.status(500).json(ResponseDTO.error(500, "Unable to load video list"));
            }
        });
    }
}
