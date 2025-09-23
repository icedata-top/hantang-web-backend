package dao.foundation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileInputStream;
import java.io.IOException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

public class MysqlDao {

    private static final String URL_LOCAL;
    private static final String USER_LOCAL;
    private static final String PASSWORD_LOCAL;
    private static final Logger logger = LoggerFactory.getLogger(MysqlDao.class);
    // 使用 volatile 确保多线程环境下的可见性
    private volatile Connection connection;
    // 用于同步的对象
    private final Object lock = new Object();
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

            // 加载 MySQL 驱动
            Class.forName("com.mysql.cj.jdbc.Driver");

        } catch (IOException | ClassNotFoundException e) {
            e.fillInStackTrace();
            throw new RuntimeException("无法加载数据库配置文件", e);
        }
    }

    /**
     * 获取数据库连接（线程安全的双重检查懒加载）
     * @return 数据库连接
     */
    public Connection getConnection() {
        // 第一次检查（不加锁），提高性能
        if (connection == null) {
            synchronized (lock) {
                // 第二次检查（加锁），确保线程安全
                if (connection == null) {
                    try {
                        connection = DriverManager.getConnection(URL_LOCAL, USER_LOCAL, PASSWORD_LOCAL);
                        logger.info("数据库连接创建成功");
                    } catch (SQLException e) {
                        logger.error("创建数据库连接失败", e);
                        throw new RuntimeException("无法创建数据库连接", e);
                    }
                }
            }
        }

        // 检查连接是否有效
        try {
            if (connection.isClosed()) {
                synchronized (lock) {
                    if (connection.isClosed()) {
                        try {
                            connection = DriverManager.getConnection(URL_LOCAL, USER_LOCAL, PASSWORD_LOCAL);
                            logger.info("重新创建已关闭的数据库连接");
                        } catch (SQLException e) {
                            logger.error("重新创建数据库连接失败", e);
                            throw new RuntimeException("无法重新创建数据库连接", e);
                        }
                    }
                }
            }
        } catch (SQLException e) {
            logger.error("检查数据库连接状态失败", e);
            throw new RuntimeException("数据库连接状态检查失败", e);
        }

        return connection;
    }

    /**
     * 关闭数据库连接
     */
    public void closeConnection() {
        if (connection != null) {
            try {
                connection.close();
                connection = null; // 重置为null，下次调用会重新创建
                logger.info("数据库连接已关闭");
            } catch (SQLException e) {
                logger.error("关闭数据库连接失败", e);
            }
        }
    }
}
