package com.hantang.web.service.labeling;

import com.hantang.web.api.LlmClient.VideoInput;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class VideoLabelInputTest {
    @Test void perVideoDigestUsesFixedFieldOrderUtf8AndPreservesNullAndArrayOrder() throws Exception {
        var input=new VideoInput(116282565529774L,"汉语🎵",List.of("甲","乙"),null);
        String canonical="{\"aid\":116282565529774,\"title\":\"汉语🎵\",\"tag_new\":[\"甲\",\"乙\"],\"description\":null}";
        String expected=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical.getBytes(StandardCharsets.UTF_8)));
        assertEquals(expected,VideoLabelInput.digest(input));
        assertNotEquals(expected,VideoLabelInput.digest(new VideoInput(input.aid(),input.title(),List.of("乙","甲"),null)));
        assertNotEquals(VideoLabelInput.digest(new VideoInput(1,null,null,null)),VideoLabelInput.digest(new VideoInput(1,null,List.of(),null)));
    }
}
