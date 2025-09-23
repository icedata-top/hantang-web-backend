package dao;

import dao.foundation.MysqlDao;
import exceptions.InvalidVideoIdentifierException;
import org.apache.commons.lang3.StringUtils;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

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
}
