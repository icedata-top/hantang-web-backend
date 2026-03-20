package com.hantang.web.dos.common;

import java.time.Instant;

public record ResponseDTO<T>(
        int code,
        int timestamp,
        String msg,
        T result
) {
    // 成功：带数据
    public static <T> ResponseDTO<T> success(T data) {
        return new ResponseDTO<>(200, currentTimestamp(), "Success", data);
    }

    // 成功：无数据
    public static <T> ResponseDTO<T> success() {
        return new ResponseDTO<>(200, currentTimestamp(), "Success", null);
    }

    // 失败：只传错误码
    public static <T> ResponseDTO<T> error(int code) {
        return new ResponseDTO<>(code, currentTimestamp(), defaultMessage(code), null);
    }

    // 失败：错误码 + 自定义消息
    public static <T> ResponseDTO<T> error(int code, String msg) {
        return new ResponseDTO<>(code, currentTimestamp(), msg, null);
    }

    // 获取当前秒级时间戳（int）
    private static int currentTimestamp() {
        return (int) Instant.now().getEpochSecond();
    }

    // 常见 HTTP 错误码对应的默认消息
    private static String defaultMessage(int code) {
        return switch (code) {
            case 400 -> "Bad Request";
            case 401 -> "Unauthorized";
            case 403 -> "Forbidden";
            case 404 -> "Not Found";
            case 500 -> "Internal Server Error";
            default -> "Unknown Error";
        };
    }
}
