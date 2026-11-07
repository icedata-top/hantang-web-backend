BEGIN;
CREATE OR REPLACE FUNCTION hantang_dynamic.adm_scheduled_business_day(p_now timestamptz)
RETURNS date
LANGUAGE sql STABLE PARALLEL SAFE STRICT
AS $fn$
    SELECT CASE WHEN (p_now AT TIME ZONE 'Asia/Shanghai')::time >= TIME '09:00'
                THEN (p_now AT TIME ZONE 'Asia/Shanghai')::date - 1 END;
$fn$;
CREATE OR REPLACE PROCEDURE hantang_dynamic.adm_schedule_aggregation_tick()
LANGUAGE plpgsql
AS $proc$
DECLARE
    v_day date := hantang_dynamic.adm_scheduled_business_day(clock_timestamp());
BEGIN
    IF v_day IS NULL THEN
        RETURN;
    END IF;
    COMMIT;
    PERFORM hantang_dynamic.adm_enqueue_aggregation_days(
        p_start_date => v_day,
        p_end_date => v_day,
        p_sample_aids => ARRAY[
            2129461, 43426592, 113940616973177, 3905462, 2075941, 9372087, 285205499, 6009789, 115745711199311, 8506694,
            114747835942125, 116231361268602, 115061704298471, 113139018439424, 21551703, 938641073, 2251501, 24929108, 3060153, 7400996,
            625038011, 1971745, 114589861682758, 14911611, 114550502396425, 17632970, 67647585, 26659364, 4188543, 2609801,
            1844227, 115978277029671, 55888297, 114907756497074, 80155822, 957890888, 963864778, 482844, 45020985, 817114652,
            234884693, 3444039, 24180113, 116436378916947, 114251834398682, 928296531, 375265162, 114969630936061, 990224432, 437888226
        ]::bigint[],
        p_sample_scope => 'zhongshu50-v1',
        p_max_attempts => 3,
        p_retry_delay_seconds => 60,
        p_priority => 1000,
        p_force_refresh => false
    );
    COMMIT;
    CALL hantang_dynamic.adm_process_one_aggregation_task();
END;
$proc$;
COMMIT;
