package com.hantang.web.dao;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 进程内 FIFO 缓存（带 TTL）。容量满时淘汰最先放入的条目。
 */
public class CacheDao<T> {

    public static final int DEFAULT_CAPACITY = 127;

    private final Object lock = new Object();
    private final Map<String, CacheEntry<T>> store;

    public CacheDao() {
        this(DEFAULT_CAPACITY);
    }

    public CacheDao(int capacity) {
        if (capacity < 1) {
            throw new IllegalArgumentException("capacity must be >= 1");
        }
        final int cap = capacity;
        this.store = new LinkedHashMap<>(16, 0.75f, false) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, CacheEntry<T>> eldest) {
                return size() > cap;
            }
        };
    }

    public T get(String key) {
        synchronized (lock) {
            return getInternal(key);
        }
    }

    public T getOrDefault(String key, T defaultT) {
        synchronized (lock) {
            T v = getInternal(key);
            return v != null ? v : defaultT;
        }
    }

    private T getInternal(String key) {
        CacheEntry<T> entry = store.get(key);
        if (entry == null) {
            return null;
        }
        if (entry.isExpired()) {
            store.remove(key);
            return null;
        }
        return entry.value;
    }

    public void set(String key, T value, int expireSeconds) {
        long expiryMillis;
        if (expireSeconds <= 0) {
            expiryMillis = Long.MAX_VALUE;
        } else {
            long candidate = System.currentTimeMillis() + expireSeconds * 1000L;
            expiryMillis = candidate < 0 ? Long.MAX_VALUE : candidate;
        }
        synchronized (lock) {
            store.put(key, new CacheEntry<>(value, expiryMillis));
        }
    }

    private static final class CacheEntry<T> {
        final T value;
        final long expiryMillis;

        CacheEntry(T value, long expiryMillis) {
            this.value = value;
            this.expiryMillis = expiryMillis;
        }

        boolean isExpired() {
            return System.currentTimeMillis() > expiryMillis;
        }
    }
}
