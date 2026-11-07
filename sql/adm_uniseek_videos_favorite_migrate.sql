BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_advisory_xact_lock(18291, 2);
ALTER TABLE hantang_dynamic.adm_uniseek_videos DROP CONSTRAINT adm_uniseek_videos_like_check;
ALTER TABLE hantang_dynamic.adm_uniseek_videos ALTER COLUMN "like" DROP NOT NULL;
ALTER TABLE hantang_dynamic.adm_uniseek_videos ADD CONSTRAINT adm_uniseek_videos_favorite_check CHECK (favorite IS NOT NULL AND favorite > 100) NOT VALID;
COMMENT ON TABLE hantang_dynamic.adm_uniseek_videos IS 'UniSeek当前已发布歌曲搜索宽表；每aid一行，统一来源日期，未删除且累计收藏>100';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.favorite IS '来源日累计收藏量，严格大于100；作为收录门槛';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos."like" IS '来源日累计点赞量；NULL为缺失，0保留原值，不作为收录门槛';
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
    CREATE TEMP TABLE adm_uniseek_daily_stage ON COMMIT DROP AS
    SELECT aid, view, favorite, "like", coin, share, reply, danmaku
    FROM hantang_dynamic.video_daily WHERE record_date = v_state.requested_record_date;
    GET DIAGNOSTICS v_source_rows = ROW_COUNT;
    IF v_source_rows = 0 OR v_source_rows <> v_state.confirmed_source_rows THEN
        RAISE EXCEPTION 'Source row count changed after confirmation: expected %, got %; confirm the date again', v_state.confirmed_source_rows, v_source_rows;
    END IF;
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
    WHERE p.is_deleted = false AND d.favorite > 100;
    GET DIAGNOSTICS v_result_rows = ROW_COUNT;
    IF v_result_rows < v_state.minimum_result_rows THEN
        RAISE EXCEPTION 'Search result count % is below the confirmed minimum %; previous publication retained', v_result_rows, v_state.minimum_result_rows;
    END IF;
    LOCK TABLE hantang_dynamic.adm_uniseek_videos IN SHARE ROW EXCLUSIVE MODE;
    DELETE FROM hantang_dynamic.adm_uniseek_videos;
    INSERT INTO hantang_dynamic.adm_uniseek_videos (
        aid, bvid, title, pic, pubdate, user_id, tag_new, participle, label_singers,
        view, favorite, "like", coin, share, reply, danmaku, record_date, batch_id, refreshed_at
    )
    SELECT aid, bvid, title, pic, pubdate, user_id, tag_new, participle, label_singers,
           view, favorite, "like", coin, share, reply, danmaku, record_date, batch_id, refreshed_at
    FROM pg_temp.adm_uniseek_videos_stage;
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'hantang_dynamic.adm_uniseek_videos'::regclass
          AND conname = 'adm_uniseek_videos_favorite_check' AND NOT convalidated
    ) THEN
        ALTER TABLE hantang_dynamic.adm_uniseek_videos VALIDATE CONSTRAINT adm_uniseek_videos_favorite_check;
        ALTER TABLE hantang_dynamic.adm_uniseek_videos ALTER COLUMN favorite SET NOT NULL;
    END IF;
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
COMMIT;
