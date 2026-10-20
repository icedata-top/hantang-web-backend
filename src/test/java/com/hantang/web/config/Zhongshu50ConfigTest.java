package com.hantang.web.config;

import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.*;

class Zhongshu50ConfigTest {
    @Test
    void bundledConfigLoadsOnceAndPreservesLongIds() {
        var aids = Zhongshu50Config.getAids();
        assertEquals(50, aids.size());
        assertEquals(50, aids.stream().distinct().count());
        assertTrue(aids.contains(113940616973177L));
        assertTrue(aids.contains(116436378916947L));
        assertSame(aids, Zhongshu50Config.getAids());
        assertThrows(UnsupportedOperationException.class, () -> aids.add(1L));
    }

    @Test
    void rejectsIncorrectSizeOrMissingList() {
        for (String json : new String[]{"{}", "null", "{\"aids\":[]}", "{\"aids\":{}}"}) {
            assertThrows(IllegalArgumentException.class, () -> read(json));
        }
    }

    @Test
    void rejectsDuplicateNonPositiveFractionalAndOverflowIds() {
        String rest = LongStream.rangeClosed(1, 49).mapToObj(Long::toString).collect(Collectors.joining(","));
        for (String invalid : new String[]{"1", "0", "-1", "1.5", "\"50\"", "null", "9223372036854775808"}) {
            assertThrows(IllegalArgumentException.class, () -> read("{\"aids\":[" + rest + "," + invalid + "]}"));
        }
    }

    private static void read(String json) throws Exception {
        Zhongshu50Config.readAids(new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)));
    }
}
