package controller;
import io.javalin.Javalin;

/**
 * 抽象的基类 Controller
 */
public abstract class BaseController {
    /**
     * 子类必须实现，注册自己的路由
     * @param app Javalin 实例
     */
    public abstract void registerRoutes(Javalin app);
}
