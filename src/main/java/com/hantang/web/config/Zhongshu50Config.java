package com.hantang.web.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;

/** 启动时读取固定样本，之后所有查询复用不可变的内存名单。 */
public final class Zhongshu50Config {
    private static final String RESOURCE = "/config/zhongshu-50.json";

    private Zhongshu50Config() {
    }

    private static class Holder {
        private static final List<Long> AIDS = loadResource();
    }

    public static List<Long> getAids() {
        return Holder.AIDS;
    }

    private static List<Long> loadResource() {
        try (InputStream input = Zhongshu50Config.class.getResourceAsStream(RESOURCE)) {
            if (input == null) {
                throw new IllegalStateException("中术50配置不存在: " + RESOURCE);
            }
            return readAids(input);
        } catch (IOException | IllegalArgumentException e) {
            throw new IllegalStateException("中术50配置加载失败: " + RESOURCE, e);
        }
    }

    static List<Long> readAids(InputStream input) throws IOException {
        JsonNode root = new ObjectMapper().readTree(input);
        JsonNode aids = root == null ? null : root.get("aids");
        if (aids == null || !aids.isArray() || aids.size() != 50) {
            throw new IllegalArgumentException("中术50配置的 aids 必须包含恰好 50 个作品");
        }
        List<Long> result = new ArrayList<>();
        HashSet<Long> unique = new HashSet<>();
        for (JsonNode aid : aids) {
            if (!aid.isIntegralNumber() || !aid.canConvertToLong() || aid.longValue() <= 0) {
                throw new IllegalArgumentException("中术50的 aid 必须是正整数且在 Long 范围内: " + aid);
            }
            long value = aid.longValue();
            if (!unique.add(value)) {
                throw new IllegalArgumentException("中术50的 aid 重复: " + value);
            }
            result.add(value);
        }
        return List.copyOf(result);
    }
}
