BEGIN;
CREATE TABLE hantang_dynamic.adm_uniseek_videos (
    aid bigint PRIMARY KEY,
    bvid varchar NOT NULL UNIQUE,
    title varchar,
    pic varchar,
    pubdate bigint,
    user_id bigint,
    tag_new varchar[],
    participle varchar[],
    label_singers text[],
    view integer,
    favorite integer,
    "like" integer NOT NULL CHECK ("like" > 100),
    coin integer,
    share integer,
    reply integer,
    danmaku integer,
    record_date date NOT NULL,
    batch_id uuid NOT NULL,
    refreshed_at timestamptz NOT NULL
);
CREATE INDEX adm_uniseek_videos_tag_new_idx ON hantang_dynamic.adm_uniseek_videos USING gin (tag_new);
CREATE INDEX adm_uniseek_videos_participle_idx ON hantang_dynamic.adm_uniseek_videos USING gin (participle);
CREATE INDEX adm_uniseek_videos_label_singers_idx ON hantang_dynamic.adm_uniseek_videos USING gin (label_singers);
COMMENT ON TABLE hantang_dynamic.adm_uniseek_videos IS 'UniSeek当前已发布歌曲搜索宽表；每aid一行，统一来源日期，未删除且累计点赞>100';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.aid IS '视频AV号；保留bigint，不按子串检索';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.bvid IS '视频BV号；唯一，供精确检索';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.title IS 'processed_videos原始标题；标题子串匹配不依赖数据库扩展';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.pic IS 'processed_videos封面URL';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.pubdate IS '原始投稿时间，秒级Unix时间戳';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.user_id IS '投稿账号UID，不推断具体创作职责';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.tag_new IS '原始varchar标签数组；NULL不替换为空数组';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.participle IS '原始varchar分词数组';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.label_singers IS '原始text歌手标签数组';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.view IS '来源日累计播放量；NULL为缺失，0为真实零';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.favorite IS '来源日累计收藏量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos."like" IS '来源日累计点赞量，严格大于100';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.coin IS '来源日累计硬币量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.share IS '来源日累计分享量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.reply IS '来源日累计评论量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.danmaku IS '来源日累计弹幕量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.record_date IS '全批次统一的video_daily观测日期，不是投稿日期';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.batch_id IS '本次确认请求的UUID；同日重算生成新值，供查询缓存失效';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.refreshed_at IS '本批生成时间；一批所有行相同';
CREATE TABLE hantang_dynamic.adm_uniseek_refresh_state (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    requested_record_date date,
    requested_batch_id uuid,
    requested_at timestamptz,
    confirmed_source_rows bigint,
    minimum_result_rows bigint NOT NULL DEFAULT 1 CHECK (minimum_result_rows > 0),
    published_record_date date,
    published_batch_id uuid,
    published_at timestamptz,
    published_row_count bigint NOT NULL DEFAULT 0 CHECK (published_row_count >= 0),
    CONSTRAINT adm_uniseek_request_ck CHECK (
        (requested_record_date IS NULL AND requested_batch_id IS NULL AND requested_at IS NULL AND confirmed_source_rows IS NULL)
        OR (requested_record_date IS NOT NULL AND requested_batch_id IS NOT NULL AND requested_at IS NOT NULL AND confirmed_source_rows IS NOT NULL AND confirmed_source_rows > 0)
    ),
    CONSTRAINT adm_uniseek_published_ck CHECK (
        (published_record_date IS NULL AND published_batch_id IS NULL AND published_at IS NULL AND published_row_count = 0)
        OR (published_record_date IS NOT NULL AND published_batch_id IS NOT NULL AND published_at IS NOT NULL AND published_row_count > 0)
    )
);
INSERT INTO hantang_dynamic.adm_uniseek_refresh_state (singleton) VALUES (true);
COMMENT ON TABLE hantang_dynamic.adm_uniseek_refresh_state IS 'UniSeek单行发布控制；调用确认函数明确声明源日期已完整入库，再由cron发布';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.singleton IS '恒为true，确保表内最多一行';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.requested_record_date IS '人为或上游确认完成的源日期，不自动取MAX(record_date)';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.requested_batch_id IS '每次确认生成新UUID；与published_batch_id不同即待发布';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.requested_at IS '确认时间；确认动作才是完成声明，行数本身不证明完整';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.confirmed_source_rows IS '确认时源日期的总行数；刷新时校验行数未改变';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.minimum_result_rows IS '本次允许发布的最少搜索结果数，默认1；可在确认时指定业务阈值';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.published_record_date IS '最近成功发布的源日期';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.published_batch_id IS '最近成功批次UUID';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.published_at IS '最近成功发布的时间';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_refresh_state.published_row_count IS '最近成功批次行数，未发布时为0';
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
    WHERE p.is_deleted = false AND d."like" > 100;
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
