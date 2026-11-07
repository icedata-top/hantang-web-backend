-- UniSeek 当前歌曲搜索集：每个 aid 一行，不积累逐日历史。
-- 正式来源：processed_videos INNER JOIN video_daily（显式确认的同一 record_date）。
-- 资格：processed_videos.is_deleted = false，且该日累计收藏数严格大于 100。
-- 表、索引及注释均为首次安装语句；不会修改源表或切换在线搜索代码。
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
    favorite integer NOT NULL CHECK (favorite > 100),
    "like" integer,
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
COMMENT ON TABLE hantang_dynamic.adm_uniseek_videos IS 'UniSeek当前已发布歌曲搜索宽表；每aid一行，统一来源日期，未删除且累计收藏>100';
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
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.favorite IS '来源日累计收藏量，严格大于100；作为收录门槛';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos."like" IS '来源日累计点赞量；NULL为缺失，0保留原值，不作为收录门槛';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.coin IS '来源日累计硬币量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.share IS '来源日累计分享量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.reply IS '来源日累计评论量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.danmaku IS '来源日累计弹幕量；NULL为缺失';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.record_date IS '全批次统一的video_daily观测日期，不是投稿日期';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.batch_id IS '本次确认请求的UUID；同日重算生成新值，供查询缓存失效';
COMMENT ON COLUMN hantang_dynamic.adm_uniseek_videos.refreshed_at IS '本批生成时间；一批所有行相同';
-- 只存一行：上游确认请求与最近成功发布信息；任务失败不会覆盖成功信息。
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
