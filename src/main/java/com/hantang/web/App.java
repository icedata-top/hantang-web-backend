package com.hantang.web;

import com.hantang.web.controller.BaseController;
import com.hantang.web.controller.UniSeekController;
import com.hantang.web.config.Zhongshu50Config;
import com.hantang.web.controller.DataReaderController;
import com.hantang.web.controller.HomeController;
import com.hantang.web.controller.OverviewController;
import com.hantang.web.controller.VideoController;
import com.hantang.web.controller.ProducerController;
import io.javalin.Javalin;

public class App {
    /**
     * 主入口
     */
    public static void main(String[] args) {
        Zhongshu50Config.getAids();
        Javalin app = Javalin.create(config -> {
            config.http.defaultContentType = "application/json";
            // 允许前后端联调跨域（开发环境）
            config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()));
        });
        registerAllController(app);
        app.start(8080);
    }

    /**
     * 注册所有的 Controller
     * @param app Javalin APP
     */
    private static void registerAllController(Javalin app) {
        BaseController[] controllers = {
                new DataReaderController(),
                new HomeController(),
                new OverviewController(),
                new VideoController(),
                new ProducerController(),
                new UniSeekController()
        };

        for (BaseController controller : controllers) {
            controller.registerRoutes(app);
        }
    }
}
