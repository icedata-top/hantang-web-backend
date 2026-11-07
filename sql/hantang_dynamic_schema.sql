-- hantang_dynamic 字段快照
-- 来源：PostgreSQL 库 hantang，schema hantang_dynamic
-- 只记录字段、类型、是否可空和默认值，不含主键、索引和外键
-- 视频静态信息统一读取 hantang_dynamic.processed_videos；如无必要，不得使用 video_static，亦不得默认回退。
-- 表说明与来源核实范围：video_creator_reference.md；只读查询：video_creator_queries.sql。
-- 用户于 2026-10-28 提供三张视频/账号表的字段、可空性及实例；默认值仍沿用原快照，未重新核验。

-- 视频静态信息的统一数据源，同时保存预处理状态与标签。
CREATE TABLE hantang_dynamic.processed_videos (
    aid bigint NOT NULL,
    bvid varchar NOT NULL,
    pubdate bigint,
    title varchar,
    description text,
    tag text,
    pic varchar,
    type_id integer,
    user_id bigint,
    is_filtered boolean NOT NULL,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    staff bigint[],
    tid_v2 integer,
    dynamic text,
    tag_new varchar[],
    participle varchar[],
    ctime bigint,
    is_deleted boolean DEFAULT false,
    copyright integer,
    extras jsonb,
    notes jsonb,
    label_content_type varchar(100),
    label_affiliations text[],
    label_singers text[],
    label_source varchar(50),
    label_confidence real,
    labeled_at timestamptz,
    labeled_by varchar(200),
    label_origin text,
    label_sources bigint[] NOT NULL DEFAULT ARRAY[]::bigint[],
    pid_v2 integer,
    mission_id bigint,
    cover43 varchar,
    tag_ids bigint[]
);

CREATE TABLE hantang_dynamic.video_daily (
    record_date date NOT NULL,
    aid bigint NOT NULL,
    coin integer,
    favorite integer,
    danmaku integer,
    view integer,
    reply integer,
    share integer,
    like integer
);

-- 创作者账号信息；processed_videos.user_id 对应本表 user_id。
CREATE TABLE hantang_dynamic.discovered_users (
    user_id bigint NOT NULL,
    user_name varchar,
    fans integer DEFAULT 0,
    videos_seen integer DEFAULT 0,
    videos_filtered integer DEFAULT 0,
    filter_pass_rate real DEFAULT 0.0,
    discovered_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    is_following boolean DEFAULT false,
    last_updated timestamptz DEFAULT CURRENT_TIMESTAMP,
    followed_by bigint[] DEFAULT '{}'::bigint[],
    face varchar,
    sign varchar,
    level smallint DEFAULT 0,
    official_role smallint DEFAULT -1,
    official_title varchar,
    filtered_view bigint DEFAULT 0
);

CREATE TABLE hantang_dynamic.video_collection_gate_crossings (
    id bigint NOT NULL DEFAULT nextval('hantang_dynamic.video_collection_gate_crossings_id_seq'::regclass),
    aid bigint NOT NULL,
    gate_value bigint NOT NULL,
    previous_view bigint,
    current_view bigint,
    crossed_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 仅保留已有结构供必要的存量对照；如无必要，不得用于视频信息查询。
CREATE TABLE hantang_dynamic.video_static (
    aid bigint NOT NULL,
    bvid varchar(50) NOT NULL,
    pubdate timestamptz NOT NULL,
    title varchar(255) NOT NULL,
    description text,
    tag text,
    pic varchar(255),
    type_id integer,
    user_id bigint,
    priority integer,
    updated_at timestamptz DEFAULT now()
);
