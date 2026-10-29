package com.hantang.web.dos.producer;

/** Public account fields only. IDs remain strings for browser integer precision. */
public record ProducerInfoResponse(
        String userId, String name, String face, String sign, Long fans,
        Integer level, Integer officialRole, String officialTitle, String lastUpdated
) {}
