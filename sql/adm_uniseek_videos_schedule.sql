SELECT cron.schedule_in_database(
    'hantang-uniseek-search-refresh',
    '*/10 * * * *',
    'CALL hantang_dynamic.adm_refresh_uniseek_videos();',
    'hantang'
);
