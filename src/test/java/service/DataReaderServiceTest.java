package service;


import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

class DataReaderServiceTest {

    private final DataReaderService dataReaderService = new DataReaderService();
    private static final long EXPECTED_AID = 6009789L;

    @Test
    void testVideoIdentifierToAidWithAllCases() throws Exception {
        // 测试用例数组：包含各种标识符类型
        String[] testCases = {
                "6009789",       // 纯数字
                "av6009789",     // 小写av
                "AV6009789",     // 大写AV
                "BV1Qs411k7Qv",  // BV号
                "世末歌者"       // 视频名称
        };

        // 循环测试每个用例
        for (String identifier : testCases) {
            long aid = dataReaderService.videoIdentifierToAid(identifier);
            assertEquals(EXPECTED_AID, aid,
                    String.format("标识符 '%s' 解析结果不正确", identifier));
        }
    }
}