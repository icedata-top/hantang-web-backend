package utils;

public class BilibiliUtils {

    private static final String TABLE = "FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf";
    private static final int BASE = 58;
    private static final long MAX_AVID = 1L << 51;                // 51 bits
    private static final long XOR = 23442827791579L;
    private static final long MASK = 2251799813685247L;           // 51 bits mask
    private static final int BVID_LEN = 12;

    private static final int[] TR = new int[128]; // ASCII table size

    static {
        for (int i = 0; i < TABLE.length(); i++) {
            TR[TABLE.charAt(i)] = i;
        }
    }

    /**
     * AV号转BV号（仅使用 long）
     */
    public static String avToBv(long avid) {
        char[] r = new char[BVID_LEN];
        r[0] = 'B';
        r[1] = 'V';
        for (int i = 2; i < BVID_LEN; i++) {
            r[i] = '1'; // 占位符
        }

        long tmp = (MAX_AVID | avid) ^ XOR;

        int idx = BVID_LEN - 1;
        while (tmp != 0) {
            r[idx] = TABLE.charAt((int) (tmp % BASE));
            tmp /= BASE;
            idx--;
        }

        // 交换位置
        char t;
        t = r[3]; r[3] = r[9]; r[9] = t;
        t = r[4]; r[4] = r[7]; r[7] = t;

        return new String(r);
    }

    /**
     * BV号转AV号（仅使用 long）
     */
    public static long bvToAv(String bvid) {
        if (bvid == null || bvid.length() != BVID_LEN || !bvid.startsWith("BV")) {
            throw new IllegalArgumentException("Invalid BV id: " + bvid);
        }

        char[] r = bvid.toCharArray();

        // 交换回去
        char t;
        t = r[3]; r[3] = r[9]; r[9] = t;
        t = r[4]; r[4] = r[7]; r[7] = t;

        long tmp = 0;
        for (int i = 3; i < BVID_LEN; i++) {
            int idx = TR[r[i]];
            tmp = tmp * BASE + idx;
        }

        long avid = (tmp & MASK) ^ XOR;
        return avid;
    }
}
