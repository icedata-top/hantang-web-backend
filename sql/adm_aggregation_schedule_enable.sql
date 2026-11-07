SELECT cron.schedule_in_database(
    'hantang-adm-daily',
    '*/5 * * * *',
    'CALL hantang_dynamic.adm_schedule_aggregation_tick();',
    'hantang'
);
