BEGIN;
CREATE OR REPLACE FUNCTION hantang_dynamic.adm_valid_sample_aids(p_aids bigint[])
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$
    SELECT COALESCE(
        array_ndims(p_aids) = 1 AND cardinality(p_aids) = 50
        AND (SELECT count(DISTINCT aid) FROM unnest(p_aids) AS s(aid) WHERE aid > 0) = 50,
        false
    );
$fn$;
CREATE TABLE hantang_dynamic.adm_aggregation_task (
    stat_date date PRIMARY KEY,
    request_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status text NOT NULL DEFAULT 'pending',
    priority integer NOT NULL DEFAULT 0,
    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    retry_delay_seconds integer NOT NULL DEFAULT 60,
    next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attempt_id uuid,
    definition_version integer NOT NULL DEFAULT 1,
    collection_policy text NOT NULL DEFAULT 'non_deleted_processed',
    sample_scope text NOT NULL,
    sample_aids bigint[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at timestamptz,
    finished_at timestamptz,
    last_error_sqlstate text,
    last_error text,
    result_summary jsonb,
    CONSTRAINT adm_aggregation_task_status_ck CHECK (
        status IN ('pending', 'running', 'retry_wait', 'succeeded', 'failed')
    ),
    CONSTRAINT adm_aggregation_task_attempts_ck CHECK (
        max_attempts > 0 AND attempt_count BETWEEN 0 AND max_attempts
        AND retry_delay_seconds BETWEEN 1 AND 86400
    ),
    CONSTRAINT adm_aggregation_task_definition_ck CHECK (definition_version > 0),
    CONSTRAINT adm_aggregation_task_policy_ck CHECK (collection_policy = 'non_deleted_processed'),
    CONSTRAINT adm_aggregation_task_scope_ck CHECK (
        sample_scope = btrim(sample_scope)
        AND length(sample_scope) BETWEEN 1 AND 100
        AND sample_scope <> 'all'
    ),
    CONSTRAINT adm_aggregation_task_sample_ck CHECK (hantang_dynamic.adm_valid_sample_aids(sample_aids)),
    CONSTRAINT adm_aggregation_task_running_ck CHECK (
        status NOT IN ('running', 'succeeded') OR (attempt_id IS NOT NULL AND attempt_count > 0)
    )
);
CREATE INDEX adm_aggregation_task_ready_idx
    ON hantang_dynamic.adm_aggregation_task (priority DESC, next_attempt_at, stat_date)
    WHERE status IN ('pending', 'retry_wait');
COMMENT ON TABLE hantang_dynamic.adm_aggregation_task IS '按业务日唯一的ADM任务队列；有限重试，领取次数先提交，结果和成功状态同事务';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.stat_date IS '业务日D；D+1凌晨观测快照减D快照归入D增长';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.request_id IS '当前执行请求；显式重排生成新值，不代表另建一行历史';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.attempt_count IS '已领取次数，进程中断也不会退回次数；不是额外重试次数';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.max_attempts IS '总尝试次数上限，3表示首次加最多两次重试';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.retry_delay_seconds IS '基础重试等待秒数，worker按次数退避且最大等待1小时';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.collection_policy IS 'non_deleted_processed：排除is_deleted=true，不依据is_filtered过滤';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.sample_aids IS '本请求规范化50个样本aid；同scope必须保持同名单';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.attempt_id IS '本次尝试UUID；成功后对应正式结果batch_id';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.result_summary IS '成功行数与完整性摘要；任务成功不等于源数据完整';
CREATE OR REPLACE FUNCTION hantang_dynamic.adm_enqueue_aggregation_days(
    p_start_date date,
    p_end_date date,
    p_sample_aids bigint[],
    p_sample_scope text DEFAULT 'zhongshu50-v1',
    p_max_attempts integer DEFAULT 3,
    p_retry_delay_seconds integer DEFAULT 60,
    p_priority integer DEFAULT 0,
    p_force_refresh boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_aids bigint[];
    v_affected integer;
BEGIN
    IF p_start_date IS NULL OR p_end_date IS NULL OR p_start_date > p_end_date
       OR NOT isfinite(p_start_date) OR NOT isfinite(p_end_date)
       OR p_end_date >= (clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date THEN
        RAISE EXCEPTION '日期必须有限、有序，且业务日必须早于北京时间今天' USING ERRCODE = '22023';
    END IF;
    IF NOT hantang_dynamic.adm_valid_sample_aids(p_sample_aids)
       OR p_sample_scope IS NULL OR p_sample_scope <> btrim(p_sample_scope)
       OR length(p_sample_scope) NOT BETWEEN 1 AND 100 OR p_sample_scope = 'all'
       OR p_max_attempts IS NULL OR p_max_attempts < 1
       OR p_retry_delay_seconds IS NULL OR p_retry_delay_seconds NOT BETWEEN 1 AND 86400
       OR p_priority IS NULL OR p_force_refresh IS NULL THEN
        RAISE EXCEPTION '任务配置非法：检查50个唯一正数样本、scope和重试参数' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(aid ORDER BY aid) INTO v_aids FROM unnest(p_sample_aids) AS s(aid);
    PERFORM pg_advisory_xact_lock(18291, 2);
    IF EXISTS (
        SELECT 1 FROM hantang_dynamic.adm_aggregation_task
        WHERE sample_scope = p_sample_scope AND sample_aids IS DISTINCT FROM v_aids
    ) THEN
        RAISE EXCEPTION '同一sample_scope不能对应不同样本名单，请使用新scope' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM hantang_dynamic.adm_aggregation_task
        WHERE stat_date BETWEEN p_start_date AND p_end_date AND sample_scope <> p_sample_scope
    ) THEN
        RAISE EXCEPTION '本期不支持同日期切换样本版本；需单独设计历史版本发布' USING ERRCODE = '22023';
    END IF;
    INSERT INTO hantang_dynamic.adm_aggregation_task AS existing (
        stat_date, sample_scope, sample_aids, max_attempts, retry_delay_seconds, priority
    )
    SELECT p_start_date + n, p_sample_scope, v_aids, p_max_attempts, p_retry_delay_seconds, p_priority
    FROM generate_series(0, p_end_date - p_start_date) AS dates(n)
    ON CONFLICT (stat_date) DO UPDATE SET
        request_id = gen_random_uuid(), status = 'pending', priority = EXCLUDED.priority,
        attempt_count = 0, max_attempts = EXCLUDED.max_attempts,
        retry_delay_seconds = EXCLUDED.retry_delay_seconds, next_attempt_at = clock_timestamp(),
        attempt_id = NULL, definition_version = 1, collection_policy = 'non_deleted_processed',
        sample_aids = EXCLUDED.sample_aids, updated_at = clock_timestamp(), started_at = NULL,
        finished_at = NULL, last_error_sqlstate = NULL, last_error = NULL, result_summary = NULL
    WHERE p_force_refresh AND existing.status IN ('succeeded', 'failed');
    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected;
END;
$fn$;
CREATE OR REPLACE FUNCTION hantang_dynamic.adm_calculate_daily_metrics(
    p_stat_date date,
    p_sample_scope text,
    p_sample_aids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
AS $fn$
DECLARE
    v_start_epoch bigint;
    v_end_epoch bigint;
    v_payload jsonb;
    v_check record;
    v_metric text;
    v_total numeric;
    v_partition_sum numeric;
    v_complete boolean;
BEGIN
    IF p_stat_date IS NULL OR NOT isfinite(p_stat_date)
       OR p_stat_date >= (clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date
       OR p_sample_scope IS NULL OR length(btrim(p_sample_scope)) = 0 OR p_sample_scope = 'all'
       OR NOT hantang_dynamic.adm_valid_sample_aids(p_sample_aids) THEN
        RAISE EXCEPTION '业务日、scope或样本配置非法' USING ERRCODE = '22023';
    END IF;
    v_start_epoch := extract(epoch FROM (p_stat_date::timestamp AT TIME ZONE 'Asia/Shanghai'))::bigint;
    v_end_epoch := extract(epoch FROM ((p_stat_date + 1)::timestamp AT TIME ZONE 'Asia/Shanghai'))::bigint;
    WITH metadata AS MATERIALIZED (
        SELECT aid, pubdate, type_id, tid_v2
        FROM hantang_dynamic.processed_videos
        WHERE is_deleted IS NOT TRUE
    ), candidates AS MATERIALIZED (
        SELECT * FROM metadata WHERE pubdate >= 0 AND pubdate < v_end_epoch
    ), snapshots AS MATERIALIZED (
        SELECT d.* FROM hantang_dynamic.video_daily AS d
        JOIN (SELECT DISTINCT aid FROM candidates) AS c ON c.aid = d.aid
        WHERE d.record_date IN (p_stat_date, p_stat_date + 1)
    ), base AS MATERIALIZED (
        SELECT c.aid, c.pubdate, c.type_id, c.tid_v2,
            c.aid = ANY(p_sample_aids) AS is_sample,
            num_nulls(e."view", e."favorite", e."like", e."coin", e."share", e."reply", e."danmaku") = 0 AS end_ok,
            num_nulls(s."view", s."favorite", s."like", s."coin", s."share", s."reply", s."danmaku", e."view", e."favorite", e."like", e."coin", e."share", e."reply", e."danmaku") = 0 AS delta_ok,
            e."view"::bigint AS view_total,
            e."view"::bigint - s."view"::bigint AS view_delta,
            e."favorite"::bigint AS favorite_total,
            e."favorite"::bigint - s."favorite"::bigint AS favorite_delta,
            e."like"::bigint AS like_total,
            e."like"::bigint - s."like"::bigint AS like_delta,
            e."coin"::bigint AS coin_total,
            e."coin"::bigint - s."coin"::bigint AS coin_delta,
            e."share"::bigint AS share_total,
            e."share"::bigint - s."share"::bigint AS share_delta,
            e."reply"::bigint AS reply_total,
            e."reply"::bigint - s."reply"::bigint AS reply_delta,
            e."danmaku"::bigint AS danmaku_total,
            e."danmaku"::bigint - s."danmaku"::bigint AS danmaku_delta
        FROM candidates AS c
        LEFT JOIN snapshots AS s ON s.aid = c.aid AND s.record_date = p_stat_date
        LEFT JOIN snapshots AS e ON e.aid = c.aid AND e.record_date = p_stat_date + 1
    ), all_groups AS (
        SELECT 'all'::text AS scope_key,
            CASE WHEN GROUPING(type_id) = 0 THEN 'partition_v1'
                 WHEN GROUPING(tid_v2) = 0 THEN 'partition_v2' ELSE 'total' END AS dimension_type,
            CASE WHEN GROUPING(type_id) = 0 THEN COALESCE(type_id::text, '__unknown__')
                 WHEN GROUPING(tid_v2) = 0 THEN COALESCE(tid_v2::text, '__unknown__') ELSE '__all__' END AS dimension_key,
            count(*)::bigint AS video_count,
            count(*) FILTER (WHERE pubdate >= v_start_epoch)::bigint AS submission_count,
            count(*) FILTER (WHERE end_ok)::bigint AS end_snapshot_count,
            count(*) FILTER (WHERE delta_ok)::bigint AS delta_covered_count,
            CASE WHEN count(view_total) = count(*) THEN COALESCE(sum(view_total), 0)::bigint END AS view_total,
            CASE WHEN count(favorite_total) = count(*) THEN COALESCE(sum(favorite_total), 0)::bigint END AS favorite_total,
            CASE WHEN count(like_total) = count(*) THEN COALESCE(sum(like_total), 0)::bigint END AS like_total,
            CASE WHEN count(coin_total) = count(*) THEN COALESCE(sum(coin_total), 0)::bigint END AS coin_total,
            CASE WHEN count(share_total) = count(*) THEN COALESCE(sum(share_total), 0)::bigint END AS share_total,
            CASE WHEN count(reply_total) = count(*) THEN COALESCE(sum(reply_total), 0)::bigint END AS reply_total,
            CASE WHEN count(danmaku_total) = count(*) THEN COALESCE(sum(danmaku_total), 0)::bigint END AS danmaku_total,
            CASE WHEN count(view_delta) = count(*) THEN COALESCE(sum(view_delta), 0)::bigint END AS view_delta,
            CASE WHEN count(favorite_delta) = count(*) THEN COALESCE(sum(favorite_delta), 0)::bigint END AS favorite_delta,
            CASE WHEN count(like_delta) = count(*) THEN COALESCE(sum(like_delta), 0)::bigint END AS like_delta,
            CASE WHEN count(coin_delta) = count(*) THEN COALESCE(sum(coin_delta), 0)::bigint END AS coin_delta,
            CASE WHEN count(share_delta) = count(*) THEN COALESCE(sum(share_delta), 0)::bigint END AS share_delta,
            CASE WHEN count(reply_delta) = count(*) THEN COALESCE(sum(reply_delta), 0)::bigint END AS reply_delta,
            CASE WHEN count(danmaku_delta) = count(*) THEN COALESCE(sum(danmaku_delta), 0)::bigint END AS danmaku_delta
        FROM base
        GROUP BY GROUPING SETS ((), (type_id), (tid_v2))
    ), sample_group AS (
        SELECT p_sample_scope AS scope_key, 'total'::text AS dimension_type, '__all__'::text AS dimension_key,
            count(*)::bigint AS video_count,
            count(*) FILTER (WHERE pubdate >= v_start_epoch)::bigint AS submission_count,
            count(*) FILTER (WHERE end_ok)::bigint AS end_snapshot_count,
            count(*) FILTER (WHERE delta_ok)::bigint AS delta_covered_count,
            CASE WHEN count(view_total) = count(*) THEN COALESCE(sum(view_total), 0)::bigint END AS view_total,
            CASE WHEN count(favorite_total) = count(*) THEN COALESCE(sum(favorite_total), 0)::bigint END AS favorite_total,
            CASE WHEN count(like_total) = count(*) THEN COALESCE(sum(like_total), 0)::bigint END AS like_total,
            CASE WHEN count(coin_total) = count(*) THEN COALESCE(sum(coin_total), 0)::bigint END AS coin_total,
            CASE WHEN count(share_total) = count(*) THEN COALESCE(sum(share_total), 0)::bigint END AS share_total,
            CASE WHEN count(reply_total) = count(*) THEN COALESCE(sum(reply_total), 0)::bigint END AS reply_total,
            CASE WHEN count(danmaku_total) = count(*) THEN COALESCE(sum(danmaku_total), 0)::bigint END AS danmaku_total,
            CASE WHEN count(view_delta) = count(*) THEN COALESCE(sum(view_delta), 0)::bigint END AS view_delta,
            CASE WHEN count(favorite_delta) = count(*) THEN COALESCE(sum(favorite_delta), 0)::bigint END AS favorite_delta,
            CASE WHEN count(like_delta) = count(*) THEN COALESCE(sum(like_delta), 0)::bigint END AS like_delta,
            CASE WHEN count(coin_delta) = count(*) THEN COALESCE(sum(coin_delta), 0)::bigint END AS coin_delta,
            CASE WHEN count(share_delta) = count(*) THEN COALESCE(sum(share_delta), 0)::bigint END AS share_delta,
            CASE WHEN count(reply_delta) = count(*) THEN COALESCE(sum(reply_delta), 0)::bigint END AS reply_delta,
            CASE WHEN count(danmaku_delta) = count(*) THEN COALESCE(sum(danmaku_delta), 0)::bigint END AS danmaku_delta
        FROM base WHERE is_sample
    ), combined AS (
        SELECT * FROM all_groups UNION ALL SELECT * FROM sample_group
    ), rows AS (
        SELECT combined.*, end_snapshot_count = video_count AND delta_covered_count = video_count AS is_complete
        FROM combined
    ), diagnostics AS (
        SELECT
            (SELECT count(*) FROM metadata WHERE pubdate IS NULL OR pubdate < 0 OR aid <= 0) AS invalid_metadata_count,
            (SELECT count(*) FROM (SELECT aid FROM metadata GROUP BY aid HAVING count(*) > 1) AS x) AS duplicate_metadata_count,
            (SELECT count(*) FROM (SELECT record_date, aid FROM snapshots GROUP BY record_date, aid HAVING count(*) > 1) AS x) AS duplicate_snapshot_count,
            (SELECT count(*) FROM unnest(p_sample_aids) AS configured(aid)
             WHERE NOT EXISTS (SELECT 1 FROM hantang_dynamic.processed_videos AS v WHERE v.aid = configured.aid)) AS missing_sample_metadata_count,
            (SELECT count(*) FROM base WHERE is_sample) AS eligible_sample_count
    )
    SELECT jsonb_build_object(
        'rows', (SELECT jsonb_agg(to_jsonb(r) ORDER BY scope_key, dimension_type, dimension_key) FROM rows AS r),
        'diagnostics', (SELECT to_jsonb(d) FROM diagnostics AS d)
    ) INTO v_payload;
    FOR v_check IN SELECT key, value FROM jsonb_each_text(v_payload -> 'diagnostics') LOOP
        IF v_check.key <> 'eligible_sample_count' AND v_check.value::bigint > 0 THEN
            RAISE EXCEPTION '源数据校验失败：%=%', v_check.key, v_check.value USING ERRCODE = '21000';
        END IF;
    END LOOP;
    FOREACH v_metric IN ARRAY ARRAY['video_count', 'submission_count', 'end_snapshot_count', 'delta_covered_count', 'view_total', 'favorite_total', 'like_total', 'coin_total', 'share_total', 'reply_total', 'danmaku_total', 'view_delta', 'favorite_delta', 'like_delta', 'coin_delta', 'share_delta', 'reply_delta', 'danmaku_delta'] LOOP
        SELECT (r ->> v_metric)::numeric INTO v_total
        FROM jsonb_array_elements(v_payload -> 'rows') AS r
        WHERE r ->> 'scope_key' = 'all' AND r ->> 'dimension_type' = 'total';
        FOR v_check IN SELECT unnest(ARRAY['partition_v1', 'partition_v2']) AS dimension_type LOOP
            SELECT COALESCE(sum((r ->> v_metric)::numeric), 0),
                   count(*) = count(r ->> v_metric)
            INTO v_partition_sum, v_complete
            FROM jsonb_array_elements(v_payload -> 'rows') AS r
            WHERE r ->> 'scope_key' = 'all' AND r ->> 'dimension_type' = v_check.dimension_type;
            IF v_total IS NOT NULL AND (NOT v_complete OR v_total <> v_partition_sum) THEN
                RAISE EXCEPTION '分区对账失败：%/%', v_check.dimension_type, v_metric USING ERRCODE = '21000';
            END IF;
        END LOOP;
    END LOOP;
    RETURN v_payload;
END;
$fn$;
CREATE OR REPLACE PROCEDURE hantang_dynamic.adm_process_one_aggregation_task()
LANGUAGE plpgsql
AS $proc$
DECLARE
    v_task hantang_dynamic.adm_aggregation_task%ROWTYPE;
    v_payload jsonb;
    v_error_state text;
    v_error_message text;
    v_failed boolean := false;
    v_retryable boolean;
    v_rows integer;
    v_computed_at timestamptz;
BEGIN
    COMMIT;
    IF NOT pg_try_advisory_lock(18291, 1) THEN
        RAISE NOTICE '另一个ADM worker正在运行，本次不消耗尝试次数';
        RETURN;
    END IF;
    BEGIN
        UPDATE hantang_dynamic.adm_aggregation_task
        SET status = CASE WHEN attempt_count < max_attempts THEN 'retry_wait' ELSE 'failed' END,
            next_attempt_at = clock_timestamp() + make_interval(secs => retry_delay_seconds),
            updated_at = clock_timestamp(), finished_at = clock_timestamp(),
            last_error_sqlstate = '08006', last_error = '上次worker中断；业务结果未提交则已回滚'
        WHERE status = 'running';
        SELECT * INTO v_task FROM hantang_dynamic.adm_aggregation_task
        WHERE status IN ('pending', 'retry_wait') AND attempt_count < max_attempts
          AND next_attempt_at <= clock_timestamp()
        ORDER BY priority DESC, next_attempt_at, stat_date
        LIMIT 1 FOR UPDATE;
        IF FOUND THEN
            UPDATE hantang_dynamic.adm_aggregation_task
            SET status = 'running', attempt_count = attempt_count + 1, attempt_id = gen_random_uuid(),
                started_at = clock_timestamp(), finished_at = NULL, updated_at = clock_timestamp(),
                last_error_sqlstate = NULL, last_error = NULL, result_summary = NULL
            WHERE stat_date = v_task.stat_date RETURNING * INTO v_task;
        END IF;
    EXCEPTION WHEN OTHERS OR query_canceled THEN
        PERFORM pg_advisory_unlock(18291, 1);
        RAISE;
    END;
    COMMIT;
    IF v_task.stat_date IS NULL THEN
        PERFORM pg_advisory_unlock(18291, 1);
        RETURN;
    END IF;
    BEGIN
        PERFORM 1 FROM hantang_dynamic.adm_aggregation_task
        WHERE stat_date = v_task.stat_date AND request_id = v_task.request_id
          AND attempt_id = v_task.attempt_id AND status = 'running'
        FOR UPDATE;
        IF NOT FOUND OR v_task.definition_version <> 1
           OR v_task.collection_policy <> 'non_deleted_processed' THEN
            RAISE EXCEPTION '任务已变化或统计版本/收录策略不受当前实现支持' USING ERRCODE = '22023';
        END IF;
        IF EXISTS (
            SELECT 1 FROM hantang_dynamic.adm_aggregation_task
            WHERE sample_scope = v_task.sample_scope AND sample_aids IS DISTINCT FROM v_task.sample_aids
        ) THEN
            RAISE EXCEPTION '相同scope存在不同样本名单' USING ERRCODE = '22023';
        END IF;
        v_payload := hantang_dynamic.adm_calculate_daily_metrics(
            v_task.stat_date, v_task.sample_scope, v_task.sample_aids
        );
        v_computed_at := clock_timestamp();
        DELETE FROM hantang_dynamic.adm_entity_metrics_daily
        WHERE stat_date = v_task.stat_date AND (
            (scope_key = 'all' AND dimension_type IN ('total', 'partition_v1', 'partition_v2'))
            OR (scope_key = v_task.sample_scope AND dimension_type = 'total')
        );
        INSERT INTO hantang_dynamic.adm_entity_metrics_daily (
            stat_date, scope_key, dimension_type, dimension_key,
            video_count, submission_count, end_snapshot_count, delta_covered_count,
            view_total, favorite_total, like_total, coin_total, share_total, reply_total, danmaku_total, view_delta, favorite_delta, like_delta, coin_delta, share_delta, reply_delta, danmaku_delta,
            is_complete, definition_version, batch_id, computed_at
        )
        SELECT v_task.stat_date, r.scope_key, r.dimension_type, r.dimension_key,
            r.video_count, r.submission_count, r.end_snapshot_count, r.delta_covered_count,
            r.view_total, r.favorite_total, r.like_total, r.coin_total, r.share_total, r.reply_total, r.danmaku_total, r.view_delta, r.favorite_delta, r.like_delta, r.coin_delta, r.share_delta, r.reply_delta, r.danmaku_delta,
            r.is_complete, v_task.definition_version, v_task.attempt_id, v_computed_at
        FROM jsonb_to_recordset(v_payload -> 'rows') AS r (
            scope_key text, dimension_type text, dimension_key text,
            video_count bigint, submission_count bigint, end_snapshot_count bigint, delta_covered_count bigint,
            view_total bigint, favorite_total bigint, like_total bigint, coin_total bigint, share_total bigint, reply_total bigint, danmaku_total bigint, view_delta bigint, favorite_delta bigint, like_delta bigint, coin_delta bigint, share_delta bigint, reply_delta bigint, danmaku_delta bigint,
            is_complete boolean
        );
        GET DIAGNOSTICS v_rows = ROW_COUNT;
        UPDATE hantang_dynamic.adm_aggregation_task
        SET status = 'succeeded', updated_at = clock_timestamp(), finished_at = clock_timestamp(),
            last_error_sqlstate = NULL, last_error = NULL,
            result_summary = jsonb_build_object(
                'row_count', v_rows, 'batch_id', v_task.attempt_id,
                'all_rows_complete', (SELECT bool_and((r ->> 'is_complete')::boolean)
                                     FROM jsonb_array_elements(v_payload -> 'rows') AS r),
                'diagnostics', v_payload -> 'diagnostics'
            )
        WHERE stat_date = v_task.stat_date AND attempt_id = v_task.attempt_id;
    EXCEPTION WHEN OTHERS OR query_canceled THEN
        GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE, v_error_message = MESSAGE_TEXT;
        v_failed := true;
    END;
    IF v_failed THEN
        v_retryable := v_error_state IN ('40001', '40P01', '55P03', '57014', '53300', '53400', '57P01', '57P02', '57P03')
                       OR left(v_error_state, 2) = '08';
        UPDATE hantang_dynamic.adm_aggregation_task
        SET status = CASE WHEN v_retryable AND attempt_count < max_attempts THEN 'retry_wait' ELSE 'failed' END,
            next_attempt_at = clock_timestamp() + make_interval(
                secs => LEAST(3600::bigint, retry_delay_seconds::bigint * LEAST(attempt_count, 60))::integer
            ),
            updated_at = clock_timestamp(), finished_at = clock_timestamp(),
            last_error_sqlstate = v_error_state, last_error = v_error_message
        WHERE stat_date = v_task.stat_date AND attempt_id = v_task.attempt_id;
        RAISE WARNING 'ADM任务%本次失败 [%] %', v_task.stat_date, v_error_state, v_error_message;
    END IF;
    COMMIT;
    PERFORM pg_advisory_unlock(18291, 1);
END;
$proc$;
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
