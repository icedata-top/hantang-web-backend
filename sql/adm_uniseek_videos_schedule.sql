DO $cron$
DECLARE
    v_jobid bigint;
    v_count integer;
BEGIN
    SELECT count(*), min(jobid) INTO v_count, v_jobid
    FROM cron.job WHERE jobname = 'hantang-uniseek-search-refresh';
    IF v_count > 1 THEN
        RAISE EXCEPTION 'Multiple UniSeek jobs found; reconcile owners and job IDs before changing the schedule';
    ELSIF v_count = 1 THEN
        PERFORM cron.alter_job(
            v_jobid,
            schedule => '*/10 * * * *',
            command => 'CALL hantang_dynamic.adm_refresh_uniseek_videos();',
            database => 'hantang',
            active => true
        );
    ELSE
        PERFORM cron.schedule_in_database(
            'hantang-uniseek-search-refresh',
            '*/10 * * * *',
            'CALL hantang_dynamic.adm_refresh_uniseek_videos();',
            'hantang'
        );
    END IF;
END;
$cron$;
