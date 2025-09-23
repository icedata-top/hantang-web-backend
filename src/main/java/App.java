import controller.BaseController;
import controller.DataReaderController;
import io.javalin.Javalin;

public class App {
    /**
     * 主入口
     */
    public static void main(String[] args) {
        Javalin app = Javalin.create(config -> {
            config.http.defaultContentType = "application/json";
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
                new DataReaderController()
        };

        for (BaseController controller : controllers) {
            controller.registerRoutes(app);
        }
    }
}
