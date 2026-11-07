-- UniSeek beta 部署前置：先核实 pg_extension / pg_indexes，已有同等索引时跳过对应语句。
-- 以下各条独立执行；CONCURRENTLY 不能放在事务中。大型表建索引需要时间及额外磁盘空间。
-- 不由应用启动时执行，不改动业务表字段或数据。
CREATE EXTENSION pg_trgm;
CREATE INDEX CONCURRENTLY idx_uniseek_video_title_trgm ON hantang_dynamic.processed_videos USING gin (title gin_trgm_ops) WHERE is_deleted = false;
CREATE INDEX CONCURRENTLY idx_uniseek_producer_name_trgm ON hantang_dynamic.discovered_users USING gin (user_name gin_trgm_ops);
