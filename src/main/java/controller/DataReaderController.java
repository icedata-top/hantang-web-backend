package controller;
import io.javalin.Javalin;
import io.javalin.http.Context;

/**
 * 数据读取 Controller
 */
public class DataReaderController extends BaseController  {
    @Override
    public void registerRoutes(Javalin app) {
        app.get("/users", this::getAllUsers);
        app.get("/users/{id}", this::getUserById);
    }


    private void getAllUsers(Context ctx) {
        ctx.json("Here are all users");
    }

    private void getUserById(Context ctx) {
        ctx.json("One user with ID " + ctx.pathParam("id"));
    }
}
