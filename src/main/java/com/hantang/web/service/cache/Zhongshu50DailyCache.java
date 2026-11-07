package com.hantang.web.service.cache;

import com.hantang.web.dao.CacheDao;
import com.hantang.web.dao.OverviewDao.DailyViewFavoriteSums;

import java.time.LocalDate;
import java.util.Objects;
import java.util.function.Function;

/** 按快照日期缓存中术50累计播放、收藏；区间查询通过相减复用这些快照。 */
public final class Zhongshu50DailyCache {
    private static final int MAX_DATES = 64;
    private static final int EXPIRE_SECONDS = 60 * 60;

    private final CacheDao<DailyViewFavoriteSums> cache;
    private final Function<LocalDate, DailyViewFavoriteSums> loader;
    // 固定数量的锁避免按日期无限创建锁；数据库查询不持有缓存 Map 的全局锁。
    private final Object[] loadLocks = new Object[MAX_DATES];

    public Zhongshu50DailyCache(Function<LocalDate, DailyViewFavoriteSums> loader) {
        this(loader, new CacheDao<>(MAX_DATES));
    }

    Zhongshu50DailyCache(
            Function<LocalDate, DailyViewFavoriteSums> loader,
            CacheDao<DailyViewFavoriteSums> cache
    ) {
        this.loader = Objects.requireNonNull(loader);
        this.cache = Objects.requireNonNull(cache);
        for (int i = 0; i < loadLocks.length; i++) {
            loadLocks[i] = new Object();
        }
    }

    public DailyViewFavoriteSums get(LocalDate date) {
        Objects.requireNonNull(date, "recordDate 不能为空");
        String key = date.toString();
        DailyViewFavoriteSums cached = cache.get(key);
        if (cached != null) {
            return cached;
        }
        synchronized (loadLocks[Math.floorMod(date.hashCode(), loadLocks.length)]) {
            // 等待同一天的查询完成后，再检查一次缓存。
            cached = cache.get(key);
            if (cached != null) {
                return cached;
            }
            DailyViewFavoriteSums value = Objects.requireNonNull(loader.apply(date), "每日合计不能为 null");
            // TTL 从查询成功后开始；异常不缓存，下次请求可以重试。
            // 缺失/不完整快照不缓存，补数后下一次请求即可恢复。
            if (value.viewSum() != null && value.favoriteSum() != null) {
                cache.set(key, value, EXPIRE_SECONDS);
            }
            return value;
        }
    }
}
