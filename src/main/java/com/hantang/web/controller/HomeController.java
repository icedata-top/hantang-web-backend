package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.home.HomeIndicatorResponse;

import io.javalin.Javalin;
import io.javalin.http.Context;

public class HomeController extends BaseController {
    @Override
    public void registerRoutes(Javalin app) {
        app.post("/home/indicator", this::getHomeIndicator);
    }

    private void getHomeIndicator(Context context) {
        try {
            HomeIndicatorResponse response = new HomeIndicatorResponse(
                    554593,
                    30,
                    101086,
                    543
            );
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }
}