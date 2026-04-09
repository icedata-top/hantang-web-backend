package com.hantang.web.controller;

import com.hantang.web.dos.common.ResponseDTO;
import com.hantang.web.dos.home.HomeIndicatorResponse;

import com.hantang.web.service.HomeService;
import io.javalin.Javalin;
import io.javalin.http.Context;

public class HomeController extends BaseController {
    private final HomeService homeService;

    public HomeController() {
        this.homeService = new HomeService();
    }

    @Override
    public void registerRoutes(Javalin app) {
        app.post("/home/indicator", this::getHomeIndicator);
    }

    private void getHomeIndicator(Context context) {
        try {
            HomeIndicatorResponse response = homeService.getHomeIndicator();
            context.json(ResponseDTO.success(response));
        } catch (Exception e) {
            context.json(ResponseDTO.error(500, e.getMessage()));
        }
    }
}