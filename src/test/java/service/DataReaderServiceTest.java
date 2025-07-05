package service;

class DataReaderServiceTest {
    public static void main(String[] args) {
        DataReaderService dataReaderService = new DataReaderService();

        String[] testCases = {
                "170001",       // 纯数字
                "av170001",     // 小写av
                "AV170001",     // 大写AV
                "BV17x411w7KC"  // BV号
        };

        for (String identifier : testCases) {
            long aid = dataReaderService.videoIdentifierToAid(identifier);
            System.out.printf("输入: %-12s 解析AID: %d%n", identifier, aid);
        }

        // 你也可以断言一下
        assert dataReaderService.videoIdentifierToAid("170001") == 170001L : "纯数字失败";
        assert dataReaderService.videoIdentifierToAid("av170001") == 170001L : "av小写失败";
        assert dataReaderService.videoIdentifierToAid("AV170001") == 170001L : "AV大写失败";
        assert dataReaderService.videoIdentifierToAid("BV17x411w7KC") == 170001L : "BV号失败";

        System.out.println("✅ 所有测试通过！");
    }
}