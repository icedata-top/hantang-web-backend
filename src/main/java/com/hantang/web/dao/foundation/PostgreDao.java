package com.hantang.web.dao.foundation;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.FileInputStream;
import java.sql.*;
import java.util.*;
import java.util.Date;

public class PostgreDao {

    private static final Logger logger = LoggerFactory.getLogger(PostgreDao.class);
    private static final HikariDataSource dataSource;

    /** 连接池在下方 static 块中初始化完成后，再创建唯一实例 */
    private static final PostgreDao INSTANCE;

    static {
        try {
            Properties prop = new Properties();
            try (FileInputStream in = new FileInputStream("config.secret.properties")) {
                prop.load(in);
            }

            String host = prop.getProperty("db.postgre_host");
            String port = prop.getProperty("db.postgre_port", "5432");
            String db = prop.getProperty("db.postgre_database");
            String user = prop.getProperty("db.postgre_user");
            String pwd = prop.getProperty("db.postgre_password");

            HikariConfig config = new HikariConfig();
            config.setJdbcUrl("jdbc:postgresql://" + host + ":" + port + "/" + db);
            config.setUsername(user);
            config.setPassword(pwd);
            config.setMinimumIdle(2);
            config.setMaximumPoolSize(10);
            dataSource = new HikariDataSource(config);
            logger.info("PostgreSQL 连接池初始化成功");
            INSTANCE = new PostgreDao();
        } catch (Exception e) {
            throw new RuntimeException("PostgreDao 初始化失败", e);
        }
    }

    private PostgreDao() {
    }

    public static PostgreDao getInstance() {
        return INSTANCE;
    }

    // ===================== 你想要的：对外极简接口 =====================

    // 查询一个数字（COUNT、SUM、MAX 等）
    public long queryLong(String sql) {
        try (Connection conn = dataSource.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql);
                ResultSet rs = ps.executeQuery()) {
            if (rs.next())
                return rs.getLong(1);
            return 0;
        } catch (SQLException e) {
            logger.error("queryLong 错误", e);
            throw new RuntimeException(e);
        }
    }

    // 查询日期
    public Date queryDate(String sql) {
        try (Connection conn = dataSource.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql);
                ResultSet rs = ps.executeQuery()) {
            if (rs.next())
                return rs.getDate(1);
            return null;
        } catch (SQLException e) {
            logger.error("queryDate 错误", e);
            throw new RuntimeException(e);
        }
    }

    // 查询列表
    public List<Map<String, Object>> queryList(String sql) {
        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql);
                ResultSet rs = ps.executeQuery()) {

            ResultSetMetaData meta = rs.getMetaData();
            int cols = meta.getColumnCount();

            while (rs.next()) {
                Map<String, Object> row = new HashMap<>();
                for (int i = 1; i <= cols; i++) {
                    String name = meta.getColumnLabel(i);
                    Object value = rs.getObject(i);
                    row.put(name, value);
                }
                list.add(row);
            }
        } catch (SQLException e) {
            logger.error("queryList 错误", e);
            throw new RuntimeException(e);
        }
        return list;
    }

    // 查询列表（支持 ? 占位符，参数用 List<Object> 传入）
    public List<Map<String, Object>> queryList(String sql, List<Object> params) {
        List<Map<String, Object>> list = new ArrayList<>();

        try (Connection conn = dataSource.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql)) {

            // 填充参数（自动对应 ? 占位符）
            if (params != null && !params.isEmpty()) {
                for (int i = 0; i < params.size(); i++) {
                    ps.setObject(i + 1, params.get(i));
                }
            }

            // 执行查询
            try (ResultSet rs = ps.executeQuery()) {
                ResultSetMetaData meta = rs.getMetaData();
                int cols = meta.getColumnCount();

                // 遍历结果集，封装成 List<Map<String,Object>>
                while (rs.next()) {
                    Map<String, Object> row = new HashMap<>();
                    for (int i = 1; i <= cols; i++) {
                        String name = meta.getColumnLabel(i);
                        Object value = rs.getObject(i);
                        row.put(name, value);
                    }
                    list.add(row);
                }
            }
        } catch (SQLException e) {
            logger.error("queryList 执行错误", e);
            throw new RuntimeException(e);
        }

        return list;
    }
}