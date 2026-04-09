package com.hantang.web.dao;

import com.hantang.web.dao.foundation.PostgreDao;

public class HomeDao {
    private final PostgreDao postgreDao = new PostgreDao();

    // 统计视频总数
    public long countVideos() {
        String sql = "SELECT COUNT(*) FROM hantang_dynamic.processed_videos";
        return postgreDao.queryLong(sql);
    }

    // 统计独立用户数
    public long countDistinctUsers() {
        String sql = "SELECT COUNT(*) FROM hantang_dynamic.discovered_users";
        return postgreDao.queryLong(sql);
    }
}
