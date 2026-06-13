package com.hantang.web.service;

import com.hantang.web.dao.CacheDao;
import com.hantang.web.dao.HomeDao;
import com.hantang.web.dos.home.HomeIndicatorResponse;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

public class HomeService {
    private static final int SINGER_COUNT_FIXED = 30;
    /** 首页「运营跨度」统计用固定起始日 */
    private static final LocalDate SPAN_START_DATE = LocalDate.of(2024, 10, 7);

    private static final String HOME_INDICATOR_CACHE_KEY = "home:indicator";
    private static final int HOME_INDICATOR_CACHE_SECONDS = 3600;

    private final HomeDao homeDao;
    private final CacheDao<HomeIndicatorResponse> homeIndicatorCache;

    public HomeService() {
        this.homeDao = new HomeDao();
        this.homeIndicatorCache = new CacheDao<>();
    }

    /**
     * 首页指标：已处理视频数、固定歌姬数、发现用户数、自固定起始日（{@link #SPAN_START_DATE}）起至今天数。
     * 结果缓存 1 小时。
     */
    public HomeIndicatorResponse getHomeIndicator() {
        HomeIndicatorResponse cached = homeIndicatorCache.get(HOME_INDICATOR_CACHE_KEY);
        if (cached != null) {
            return cached;
        }
        HomeIndicatorResponse fresh = loadHomeIndicatorUncached();
        homeIndicatorCache.set(HOME_INDICATOR_CACHE_KEY, fresh, HOME_INDICATOR_CACHE_SECONDS);
        return fresh;
    }

    private HomeIndicatorResponse loadHomeIndicatorUncached() {
        long videoCount = homeDao.countVideos();
        long userCount = homeDao.countDistinctUsers();

        LocalDate today = LocalDate.now(ZoneId.systemDefault());
        long spanDays = ChronoUnit.DAYS.between(SPAN_START_DATE, today);
        if (spanDays < 0) {
            spanDays = 0;
        }

        return new HomeIndicatorResponse(
                toIntBounded(videoCount),
                SINGER_COUNT_FIXED,
                toIntBounded(userCount),
                toIntBounded(spanDays)
        );
    }

    private static int toIntBounded(long value) {
        if (value > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        if (value < Integer.MIN_VALUE) {
            return Integer.MIN_VALUE;
        }
        return (int) value;
    }
}
