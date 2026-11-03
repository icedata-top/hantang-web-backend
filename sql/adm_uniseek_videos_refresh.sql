-- 调用者权限执行，无SECURITY DEFINER。确认函数和发布过程均在调用事务内，不自行COMMIT。
CREATE OR REPLACE FUNCTION hantang_dynamic.adm_confirm_uniseek_source_date(
    p_record_date date,
    p_minimum_result_rows bigint DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = pg_catalog, hantang_dynamic, pg_temp
AS $fn$
DECLARE
    v_published_date date;
    v_source_rows bigint;
    v_batch_id uuid := gen_random_uuid();
BEGIN
    IF p_record_date IS NULL OR p_record_date > (clock_timestamp() AT TIME ZONE 'Asia/Shanghai')::date THEN
        RAISE EXCEPTION 'record_date must be an explicitly confirmed date, not NULL or a future date' USING ERRCODE = '22023';
    END IF;
    IF p_minimum_result_rows IS NULL OR p_minimum_result_rows < 1 THEN
        RAISE EXCEPTION 'minimum_result_rows must be positive' USING ERRCODE = '22023';
    END IF;
    SELECT published_record_date INTO v_published_date
    FROM hantang_dynamic.adm_uniseek_refresh_state WHERE singleton FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'UniSeek refresh state row is missing';
    END IF;
    IF p_record_date < v_published_date THEN
        RAISE EXCEPTION 'Cannot replace published date % with older date %', v_published_date, p_record_date USING ERRCODE = '22023';
    END IF;
    SELECT count(*) INTO v_source_rows
    FROM hantang_dynamic.video_daily WHERE record_date = p_record_date;
    IF v_source_rows = 0 THEN
        RAISE EXCEPTION 'No video_daily rows for confirmed date %', p_record_date;
    END IF;
    UPDATE hantang_dynamic.adm_uniseek_refresh_state
    SET requested_record_date = p_record_date, requested_batch_id = v_batch_id,
        requested_at = clock_timestamp(), confirmed_source_rows = v_source_rows,
        minimum_result_rows = p_minimum_result_rows
    WHERE singleton;
    RETURN v_batch_id;
END;
$fn$;
CREATE OR REPLACE PROCEDURE hantang_dynamic.adm_refresh_uniseek_videos()
LANGUAGE plpgsql
SET search_path = pg_catalog, hantang_dynamic, pg_temp
AS $proc$
DECLARE
    v_state hantang_dynamic.adm_uniseek_refresh_state%ROWTYPE;
    v_source_rows bigint;
    v_result_rows bigint;
    v_refreshed_at timestamptz;
BEGIN
    -- 与现有ADM日聚合的(18291,1)区分；事务结束后自动释放，异常也不会残留会话锁。
    IF NOT pg_try_advisory_xact_lock(18291, 2) THEN
        RAISE NOTICE 'Another UniSeek refresh is running; skipped';
        RETURN;
    END IF;
    SELECT * INTO v_state
    FROM hantang_dynamic.adm_uniseek_refresh_state WHERE singleton FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'UniSeek refresh state row is missing';
    END IF;
    IF v_state.requested_batch_id IS NULL OR v_state.requested_batch_id = v_state.published_batch_id THEN
        RETURN;
    END IF;
    IF v_state.requested_record_date < v_state.published_record_date THEN
        RAISE EXCEPTION 'Confirmed source date is older than the published date';
    END IF;
    -- 单条语句读取完整D日，后续验证和关联都复用这份快照；不跨日补指标。
    CREATE TEMP TABLE adm_uniseek_daily_stage ON COMMIT DROP AS
    SELECT aid, view, favorite, "like", coin, share, reply, danmaku
    FROM hantang_dynamic.video_daily WHERE record_date = v_state.requested_record_date;
    GET DIAGNOSTICS v_source_rows = ROW_COUNT;
    IF v_source_rows = 0 OR v_source_rows <> v_state.confirmed_source_rows THEN
        RAISE EXCEPTION 'Source row count changed after confirmation: expected %, got %; confirm the date again', v_state.confirmed_source_rows, v_source_rows;
    END IF;
    -- 验证D日所有aid唯一，包含未达到点赞门槛及缺少静态资料的视频，不用DISTINCT消歧。
    ALTER TABLE pg_temp.adm_uniseek_daily_stage ADD PRIMARY KEY (aid);
    ANALYZE pg_temp.adm_uniseek_daily_stage;
    CREATE TEMP TABLE adm_uniseek_videos_stage (
        LIKE hantang_dynamic.adm_uniseek_videos INCLUDING DEFAULTS INCLUDING CONSTRAINTS
    ) ON COMMIT DROP;
    ALTER TABLE pg_temp.adm_uniseek_videos_stage ADD PRIMARY KEY (aid), ADD UNIQUE (bvid);
    v_refreshed_at := clock_timestamp();
    INSERT INTO pg_temp.adm_uniseek_videos_stage (
        aid, bvid, title, pic, pubdate, user_id, tag_new, participle, label_singers,
        view, favorite, "like", coin, share, reply, danmaku, record_date, batch_id, refreshed_at
    )
    SELECT p.aid, p.bvid, p.title, p.pic, p.pubdate, p.user_id, p.tag_new, p.participle, p.label_singers,
           d.view, d.favorite, d."like", d.coin, d.share, d.reply, d.danmaku,
           v_state.requested_record_date, v_state.requested_batch_id, v_refreshed_at
    FROM pg_temp.adm_uniseek_daily_stage AS d
    INNER JOIN hantang_dynamic.processed_videos AS p ON p.aid = d.aid
    WHERE p.is_deleted = false AND d."like" > 100;
    GET DIAGNOSTICS v_result_rows = ROW_COUNT;
    IF v_result_rows < v_state.minimum_result_rows THEN
        RAISE EXCEPTION 'Search result count % is below the confirmed minimum %; previous publication retained', v_result_rows, v_state.minimum_result_rows;
    END IF;
    -- 表、索引和权限不变；普通SELECT在提交前读旧批次，提交后读新批次。
    LOCK TABLE hantang_dynamic.adm_uniseek_videos IN SHARE ROW EXCLUSIVE MODE;
    DELETE FROM hantang_dynamic.adm_uniseek_videos;
    INSERT INTO hantang_dynamic.adm_uniseek_videos (
        aid, bvid, title, pic, pubdate, user_id, tag_new, participle, label_singers,
        view, favorite, "like", coin, share, reply, danmaku, record_date, batch_id, refreshed_at
    )
    SELECT aid, bvid, title, pic, pubdate, user_id, tag_new, participle, label_singers,
           view, favorite, "like", coin, share, reply, danmaku, record_date, batch_id, refreshed_at
    FROM pg_temp.adm_uniseek_videos_stage;
    UPDATE hantang_dynamic.adm_uniseek_refresh_state
    SET published_record_date = v_state.requested_record_date,
        published_batch_id = v_state.requested_batch_id, published_at = clock_timestamp(),
        published_row_count = v_result_rows
    WHERE singleton;
    ANALYZE hantang_dynamic.adm_uniseek_videos;
    DROP TABLE pg_temp.adm_uniseek_videos_stage, pg_temp.adm_uniseek_daily_stage;
    RAISE NOTICE 'UniSeek published date %, batch %, rows %', v_state.requested_record_date, v_state.requested_batch_id, v_result_rows;
END;
$proc$;
