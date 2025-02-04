package dao;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.FileInputStream;
import java.io.IOException;
import java.util.Properties;

public class MysqlDao {

    private static final String URL_LOCAL;
    private static final String USER_LOCAL;
    private static final String PASSWORD_LOCAL;
    private static final Logger logger = LogManager.getLogger(MysqlDao.class);

    static {
        try {
            // 加载配置文件
            Properties properties = new Properties();
            FileInputStream input = new FileInputStream("config.secret.properties");
            properties.load(input);

            // 读取配置
            URL_LOCAL = properties.getProperty("db.url_local");
            USER_LOCAL = properties.getProperty("db.user_local");
            PASSWORD_LOCAL = properties.getProperty("db.password_local");

        } catch (IOException e) {
            e.fillInStackTrace();
            throw new RuntimeException("无法加载数据库配置文件", e);
        }
    }
}
