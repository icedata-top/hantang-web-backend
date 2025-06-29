package mapper;

import com.alibaba.fastjson2.JSON;
import io.javalin.http.Context;
import io.javalin.json.JsonMapper;
import org.jetbrains.annotations.NotNull;

import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Type;
import java.util.stream.Stream;

public class Fastjson2Mapper implements JsonMapper {
    @Override
    public <T> T fromJsonStream(@NotNull InputStream json, @NotNull Type targetType) {
        throw new UnsupportedOperationException("Fastjson2Mapper does not support fromJsonStream yet.");
    }

    @Override
    public <T> T fromJsonString(@NotNull String json, @NotNull Type targetType) {
        return JSON.parseObject(json, targetType);
    }

    @Override
    public InputStream toJsonStream(@NotNull Object obj, @NotNull Type type) {
        throw new UnsupportedOperationException("Fastjson2Mapper does not support toJsonStream yet.");
    }

    @Override
    public String toJsonString(@NotNull Object obj, @NotNull Type type) {
        return JSON.toJSONString(obj);
    }

    @Override
    public void writeToOutputStream(@NotNull Stream<?> stream, @NotNull OutputStream outputStream) {
        throw new UnsupportedOperationException("Fastjson2Mapper does not support writeToOutputStream yet.");
    }

}
