package com.hantang.web.service;

import com.hantang.web.dao.DailyDao;
import com.hantang.web.dos.daily.DailyLatestDateResponse;

public class DailyService {
    private final DailyDao dailyDao;

    public DailyService() {
        this(new DailyDao());
    }

    public DailyService(DailyDao dailyDao) {
        this.dailyDao = dailyDao;
    }

    public DailyLatestDateResponse getLatestDate() {
        return new DailyLatestDateResponse(dailyDao.findLatestRecordDate());
    }
}
