package com.hantang.web.service.labeling;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hantang.web.api.LlmClient.VideoInput;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class VideoLabelInput {
    private static final ObjectMapper JSON = new ObjectMapper();
    private VideoLabelInput() { }
    public static String digest(VideoInput video) {
        var input = JSON.createObjectNode().put("aid", video.aid()).put("title", video.title());
        input.set("tag_new", JSON.valueToTree(video.tagNew()));
        input.put("description", video.description());
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(JSON.writeValueAsString(input).getBytes(StandardCharsets.UTF_8))); }
        catch (java.io.IOException | NoSuchAlgorithmException e) { throw new IllegalStateException("INPUT_DIGEST_FAILED"); }
    }
}
