package api;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.util.Random;

public class BilibiliApi {
    private static final Logger logger = LogManager.getLogger(BilibiliApi.class);

    private static final String[] USER_AGENTS = {
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:91.0) Gecko/20100101 Firefox/91.0",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1"
    };

    // 生成随机User-Agent
    private static String getRandomUserAgent() {
        Random random = new Random();
        int index = random.nextInt(USER_AGENTS.length);
        return USER_AGENTS[index];
    }

    // 生成随机的DedeUserID (10位整数)
    private static String getRandomDedeUserID() {
        Random random = new Random();
        int dedeUserID = 1000000000 + random.nextInt(900000000); // 生成10位数字
        return String.valueOf(dedeUserID);
    }

    /**
     * 获取HTTP连接，实际上是准备HTTP请求头的各种参数。
     *
     * @param urlString URL字符串，需要加上已有的WBI验权参数w_rid和wts
     * @return HTTP连接
     */
    private HttpURLConnection getHttpURLConnection(String urlString) throws URISyntaxException, IOException {
        URI uri = new URI(urlString);
        URL apiUrl = uri.toURL();
        HttpURLConnection connection = (HttpURLConnection) apiUrl.openConnection();
        connection.setRequestMethod("GET");
        connection.setConnectTimeout(5000);

        // 随机选取User-Agent
        String userAgent = getRandomUserAgent();
        // 随机生成DedeUserID
        String dedeUserID = getRandomDedeUserID();

        connection.setRequestProperty("User-Agent", userAgent);
        connection.setRequestProperty("Cookie", "buvid_fp_plain=undefined; DedeUserID=" + dedeUserID + ";");
        return connection;
    }

    /**
     * 按URL字符串调用API。考虑到B站的API参数都是带在URL里的，不需要额外写请求体。
     *
     * @param urlString URL字符串，需要带上参数（含WBI验权参数w_rid和wts）
     * @return HTTP响应字符串
     */
    private String callApiByUrlString(String urlString) throws IOException {
        try {
            long startTime = System.currentTimeMillis();
            HttpURLConnection connection = getHttpURLConnection(urlString);
            int responseCode = connection.getResponseCode();

            // 如果响应码是200，则读取响应体
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                connection.disconnect();
                long deltaTime = System.currentTimeMillis() - startTime;
                logger.info("Successfully get HTTP response from Bilibili. Time: {} ms, URL: {}", deltaTime, urlString);
                return response.toString();
            } else {
                connection.disconnect();
                throw new IOException("Failed to fetch video info. HTTP response code: " + responseCode);
            }
        } catch (Exception e) {
            throw new IOException("Failed to construct URL or fetch video info", e);
        }
    }

    public String getSingleVideoApi(long aid) throws IOException {
        String urlString = "https://api.bilibili.com/x/web-interface/wbi/view/detail?aid=" + aid;
        return callApiByUrlString(Wbi.getInstance().addWbiParam(urlString)); // todo 好像用不了，虽然用了Wbi，但是还是-352风控校验失败。
    }
}
