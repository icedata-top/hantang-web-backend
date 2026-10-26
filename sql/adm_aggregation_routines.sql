-- PostgreSQL 14+，先执行adm_aggregation_task.sql，已有ADM结果表保持不变。
-- 仅安装函数/过程，不执行任务、不注册cron。当前统计实现版本为1。
-- worker必须在自动提交连接上以独立顶层CALL执行，不能置于BEGIN/COMMIT块内。
-- worker会跨事务持有会话锁；异常退出后使用专用连接并断开，避免池化连接遗留锁。

-- 入队函数只用于保存任务参数；默认只补缺失日期，显式force才重排终态任务。
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
    -- 配置锁与worker锁分开。入队函数不领取任务，也不改动running行。
    PERFORM pg_advisory_xact_lock(18291, 2);
    IF EXISTS (
        SELECT 1 FROM hantang_dynamic.adm_aggregation_task
        WHERE sample_scope = p_sample_scope AND sample_aids IS DISTINCT FROM v_aids
    ) THEN
        RAISE EXCEPTION '同一sample_scope不能对应不同样本名单，请使用新scope' USING ERRCODE = '22023';
    END IF;
    -- 任务表是名单版本的追溯依据，不允许覆盖一个日期原先使用的样本版本。
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

-- 单个源SELECT获得一致快照：只返回聚合结果和诊断，不返回逐视频明细。
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
    -- 按已知收录与投稿日期确定集合，已删除或尚未投稿的样本不计入当日有效样本数。
    -- 各套分区的计数必须与全量一致；完整指标才做合计对账。
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

-- 一次CALL最多处理一个日期；每次尝试完整重算，不按页写入。
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
    -- 在拿会话锁前验证顶层自动提交调用；外部BEGIN内调用会在这里报错。
    COMMIT;
    IF NOT pg_try_advisory_lock(18291, 1) THEN
        RAISE NOTICE '另一个ADM worker正在运行，本次不消耗尝试次数';
        RETURN;
    END IF;
    BEGIN
        -- 全局锁已取得：不存在另一条遵守协议的活跃worker，遗留running来自中断。
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
    -- 尝试次数先提交：即使连接中断，也不会无上限地免费重试。
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
        -- 自动回滚此块的删除、插入和成功状态；不得在异常子事务内COMMIT。
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
    -- 成功：四类结果与成功标记一起提交。失败：只提交错误及重试状态。
    COMMIT;
    PERFORM pg_advisory_unlock(18291, 1);
END;
$proc$;
