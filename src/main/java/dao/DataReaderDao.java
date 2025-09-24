package dao;

import dao.foundation.MysqlDao;
import enums.Metric;
import exceptions.InvalidVideoIdentifierException;
import org.apache.commons.lang3.StringUtils;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;

public class DataReaderDao {

    MysqlDao mysqlDao;

    public DataReaderDao() {
        mysqlDao = new MysqlDao();
    }

    /**
     * 根据视频名称查询视频的 AV 号
     * @param videoName 视频名称
     * @return 视频的 AV 号
     */
    public long getAidByVideoName(String videoName) throws InvalidVideoIdentifierException, SQLException {
        if (StringUtils.isEmpty(videoName)) {
            throw new InvalidVideoIdentifierException("Empty videoName" + videoName);
        }
        Connection connection = mysqlDao.getConnection();
        PreparedStatement preparedStatement = connection.prepareStatement(
                "SELECT aid FROM hantang.video_static WHERE title LIKE ? AND priority > 0 ORDER BY priority, pubdate LIMIT 1;"
        );
        // 在参数值前后添加%通配符
        preparedStatement.setString(1, "%" + videoName + "%");
        ResultSet resultSet = preparedStatement.executeQuery();
        if (resultSet.next()) {
            return resultSet.getLong("aid");
        } else {
            throw new InvalidVideoIdentifierException("Cannot find in DB for videoName: " + videoName);
        }
    }

    /**
     * 获取某指标超越目标的最早时间点
     * @param aid 视频的 AV 号
     * @param metric 指标
     * @param target 目标数据
     * @param upper True 达成之后的第一条数据；False 达成之前的最后一条数据。
     * @return UNIX时间戳和指标
     */
    public Map<String, Integer> getMetricAchievedTime(long aid, Metric metric, int target, boolean upper) throws SQLException {
        String filed = metric.getField();
        String sqlTemplate = upper ?
                "SELECT time, %s FROM hantang.video_minute WHERE aid = ? AND %s >= ? ORDER BY view, time LIMIT 1;" :
                "SELECT time, %s FROM hantang.video_minute WHERE aid = ? AND %s < ? ORDER BY view DESC, time DESC LIMIT 1;";
        String sql = String.format(sqlTemplate, filed, filed);
        Connection connection = mysqlDao.getConnection();
        PreparedStatement preparedStatement = connection.prepareStatement(sql);
        // 设置参数
        preparedStatement.setLong(1, aid);
        preparedStatement.setInt(2, target);

        // 执行查询
        ResultSet resultSet = preparedStatement.executeQuery();
        if (resultSet.next()) {
             int time = resultSet.getInt("time");
             int value = resultSet.getInt(filed);
             return Map.of("timestamp", time, "value", value);
        } else {
            // 没有找到符合条件的记录
            return Map.of("timestamp", -1, "value", -1);
        }
    }
}
