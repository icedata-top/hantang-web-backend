package dao.foundation;

import org.junit.jupiter.api.Test;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import static org.junit.jupiter.api.Assertions.*;

class MysqlDaoTest {

    @Test
    void testSelectVideoByAid() {
        MysqlDao dao = new MysqlDao();

        try (Connection conn = dao.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(
                     "SELECT * FROM hantang.video_static WHERE aid = 6009789");
             ResultSet rs = pstmt.executeQuery()) {

            if (rs.next()) {
                System.out.println("找到视频记录:");
                System.out.println("aid: " + rs.getLong("aid"));
                System.out.println("title: " + rs.getString("title"));
                // 根据需要添加其他字段

                assertEquals(6009789L, rs.getLong("aid"));
            } else {
                System.out.println("未找到aid=6009789的视频记录");
            }

        } catch (Exception e) {
            fail("测试失败: " + e.getMessage());
            e.fillInStackTrace();
        }
    }
}