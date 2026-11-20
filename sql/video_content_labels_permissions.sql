-- 在应用连接的同一个数据库中，由表所有者或有授权权限的管理员执行。
-- 仅授权此表的读取及打标写入；其他环境请替换实际应用角色名。
BEGIN;
GRANT SELECT, INSERT, UPDATE ON TABLE hantang_dynamic.video_content_labels TO app_icedata_web;
COMMIT;
SELECT has_schema_privilege('app_icedata_web','hantang_dynamic','USAGE') AS schema_usage,
       has_table_privilege('app_icedata_web','hantang_dynamic.video_content_labels','SELECT') AS can_select,
       has_table_privilege('app_icedata_web','hantang_dynamic.video_content_labels','INSERT') AS can_insert,
       has_table_privilege('app_icedata_web','hantang_dynamic.video_content_labels','UPDATE') AS can_update;
