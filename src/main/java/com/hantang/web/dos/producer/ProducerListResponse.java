package com.hantang.web.dos.producer;

import java.util.List;

public record ProducerListResponse(int page, int pageSize, long total, List<Producer> rows) {
    public record Producer(String userId, String name, String face, String sign, Long fans, Long videoCount,
                           Integer level, Integer officialRole, String officialTitle, String lastUpdated) {}
}
