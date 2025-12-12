package com.hantang.web.utils;

import static com.hantang.web.utils.BilibiliUtils.avToBv;
import static com.hantang.web.utils.BilibiliUtils.bvToAv;

class BilibiliUtilsTest {

    /**
     * 简单单元测试
     */
    public static void main(String[] args) {
        long[] avIds = {
                114714449413822L, 114714516390983L, 114714516393596L, 114714801607676L, 114714851938267L,
                1250263852L, 881414260L, 1650146742L, 1350120063L, 750868301L,
                113054142433458L, 411334292L, 1706029576L, 1851691384L, 1051353039L
        };

        String[] bvIds = {
                "BV1XfKAzwEi3", "BV1LXKAzKEpP", "BV15XKAzKER2", "BV18xKAz9E7k", "BV1roKwzCEm9",
                "BV16J4m147St", "BV1zK4y1q7yf", "BV1L7421T7B6", "BV1rB42167Vg", "BV1Yk4y1X7tj",
                "BV1Ypn9eJEKR", "BV1uV411X7Dk", "BV1tT421Y7fV", "BV16W421c7ic", "BV1KH4y1j7Rg"
        };

        for (int i = 0; i < avIds.length; i++) {
            String encoded = avToBv(avIds[i]);
            if (!encoded.equals(bvIds[i])) {
                System.err.printf("AV to BV failed: AV%s -> %s (expected %s)%n", avIds[i], encoded, bvIds[i]);
            } else {
                System.out.printf("AV%s -> %s ✅%n", avIds[i], encoded);
            }

            long decoded = bvToAv(bvIds[i]);
            if (decoded != avIds[i]) {
                System.err.printf("BV to AV failed: %s -> AV%s (expected AV%s)%n", bvIds[i], decoded, avIds[i]);
            } else {
                System.out.printf("%s -> AV%s ✅%n", bvIds[i], decoded);
            }
        }
        System.out.println("All tests completed.");
    }
}