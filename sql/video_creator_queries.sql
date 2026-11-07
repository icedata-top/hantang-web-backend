-- PostgreSQL 数据库 hantang；schema hantang_dynamic。
-- 只读测试与文档查询，无写入或 DDL；本次未连接数据库执行。
-- 视频静态信息统一来自 processed_videos；如无必要，不得使用 video_static，亦不得默认回退。
-- 文档：video_creator_reference.md；实例：examples/video_creator_sample.md。
-- 示例：aid=6009789（世末歌者），user_id=396194（COPY）。
-- 每条 SQL 可单独完整选中执行；LIMIT 1 只用于查看样本，不用于重复记录消歧。

-- 1. 视频完整信息，并显示北京时间投稿时间。
SELECT
    p.*,
    to_timestamp(p.pubdate) AT TIME ZONE 'Asia/Shanghai' AS pubdate_beijing
FROM hantang_dynamic.processed_videos AS p
WHERE p.aid = 6009789
LIMIT 1;

-- 2. 创作者账号完整信息。
SELECT u.*
FROM hantang_dynamic.discovered_users AS u
WHERE u.user_id = 396194
LIMIT 1;

-- 3. 视频与上传者资料联查；账号缺失时仍保留视频。
SELECT
    p.aid,
    p.bvid,
    p.title,
    p.pubdate,
    to_timestamp(p.pubdate) AT TIME ZONE 'Asia/Shanghai' AS pubdate_beijing,
    p.description,
    p.tag,
    p.pic,
    p.type_id,
    p.tid_v2,
    p.pid_v2,
    p.user_id,
    u.user_name,
    u.face AS user_face,
    u.sign AS user_sign,
    u.fans AS user_fans,
    u.official_role,
    u.official_title
FROM hantang_dynamic.processed_videos AS p
LEFT JOIN hantang_dynamic.discovered_users AS u ON u.user_id = p.user_id
WHERE p.aid = 6009789
LIMIT 1;

-- 4. 带字段名的视频 JSON；避免复制查询结果时丢失列名。
-- timestamptz 序列化受会话时区影响，核对时间点时应连同偏移阅读。
SELECT to_jsonb(p) AS processed_video
FROM hantang_dynamic.processed_videos AS p
WHERE p.aid = 6009789
LIMIT 1;

-- 5. 带字段名的账号 JSON，保留 NULL、false、0 和空数组的区别。
SELECT to_jsonb(u) AS discovered_user
FROM hantang_dynamic.discovered_users AS u
WHERE u.user_id = 396194
LIMIT 1;

-- 6. 核对三张表的字段定义；这里只读取元数据，video_static 仅作为存量结构对照。
-- format_type 保留数组元素类型与 varchar 长度，attnum 保留原始列序号并跳过已删除列。
SELECT
    c.relname AS table_name,
    a.attnum AS ordinal_position,
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS column_type,
    CASE WHEN a.attnotnull THEN 'NO' ELSE 'YES' END AS is_nullable,
    pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_catalog.pg_attribute AS a
JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
LEFT JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'hantang_dynamic'
  AND c.relname IN ('processed_videos', 'discovered_users', 'video_static')
  AND a.attnum > 0
  AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

-- 7. 核对约束，包括主键、唯一约束、外键与 CHECK；未查询不代表不存在。
SELECT
    c.relname AS table_name,
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    pg_catalog.pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_catalog.pg_constraint AS con
JOIN pg_catalog.pg_class AS c ON c.oid = con.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'hantang_dynamic'
  AND c.relname IN ('processed_videos', 'discovered_users', 'video_static')
ORDER BY c.relname, con.conname;

-- 8. 核对现有索引定义，不创建或修改索引。
SELECT tablename, indexname, indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'hantang_dynamic'
  AND tablename IN ('processed_videos', 'discovered_users', 'video_static')
ORDER BY tablename, indexname;
