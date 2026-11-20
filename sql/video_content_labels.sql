-- 首次安装：独立保存每个aid当前生效的内容标签，不随UniSeek每日换批删除；完整选中执行。
-- 仅新建标签表及索引、注释，不修改源表、搜索宽表或应用查询；采用STORED生成列。
BEGIN;
CREATE TABLE hantang_dynamic.video_content_labels (
    aid bigint PRIMARY KEY CHECK (aid > 0),
    is_song text NOT NULL CHECK (is_song IN ('是', '否', '不确定')),
    is_virtual_singer text NOT NULL CHECK (is_virtual_singer IN ('是', '否', '混合', '不确定')),
    languages text[] NOT NULL,
    is_virtual_singer_song boolean GENERATED ALWAYS AS (
        is_song = '是' AND is_virtual_singer IN ('是', '混合')
    ) STORED NOT NULL,
    is_chinese_virtual_singer_song boolean GENERATED ALWAYS AS (
        is_song = '是' AND is_virtual_singer IN ('是', '混合') AND languages @> ARRAY['汉语']::text[]
    ) STORED NOT NULL,
    label_source text NOT NULL CHECK (label_source IN ('llm', 'manual')),
    schema_version smallint NOT NULL DEFAULT 1 CHECK (schema_version = 1),
    model text CHECK (model IS NULL OR btrim(model) <> ''),
    prompt_sha256 text CHECK (prompt_sha256 IS NULL OR prompt_sha256 ~ '^[0-9a-f]{64}$'),
    input_sha256 text NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
    source_run_id text CHECK (source_run_id IS NULL OR btrim(source_run_id) <> ''),
    labeled_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT video_content_labels_languages_ck CHECK (
        CASE WHEN array_ndims(languages) = 1 THEN
            cardinality(languages) > 0
            AND array_position(languages, NULL) IS NULL
            AND NOT (languages && ARRAY['', '中文', '华语', '国语', '普通话', '粤语', '闽南语', '韩语', '韩国语', '简体中文', '繁体中文']::text[])
            AND (NOT (languages @> ARRAY['无语言']::text[]) OR cardinality(languages) = 1)
        ELSE false END
    ),
    CONSTRAINT video_content_labels_llm_provenance_ck CHECK (
        label_source <> 'llm' OR (model IS NOT NULL AND prompt_sha256 IS NOT NULL AND source_run_id IS NOT NULL)
    )
);
CREATE INDEX video_content_labels_virtual_song_aid_idx ON hantang_dynamic.video_content_labels (aid) WHERE is_virtual_singer_song;
CREATE INDEX video_content_labels_chinese_virtual_song_aid_idx ON hantang_dynamic.video_content_labels (aid) WHERE is_chinese_virtual_singer_song;
COMMENT ON TABLE hantang_dynamic.video_content_labels IS '每aid当前生效的内容标签；独立于每日全量刷新的UniSeek候选集；不存待处理/调用失败占位行，不级联删除';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.aid IS '视频AV号；每视频一行；不外键关联每日换批的adm_uniseek_videos';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.is_song IS '视频主体是否歌曲：是/否/不确定；无记录代表尚无生效标签，不将调用失败写成否';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.is_virtual_singer IS '演唱来源：是/否/混合/不确定；原始混合信息保留';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.languages IS '实际演唱语言数组；汉语含普通话及方言；未知语言为显式未知，无语言须单独使用；导入端继续校验完整v1契约和去重';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.is_virtual_singer_song IS '生成列：歌曲=是且声源为是或混合；false只表示未满足肯定资格，不代表所有原始维度均已确定';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.is_chinese_virtual_singer_song IS '生成列：虚拟歌手歌曲且演唱语言含汉语；多语含汉语也纳入；两个生成列均直接引用基础字段';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.label_source IS '当前生效标签来源：llm自动结果/manual人工采用或修正；自动导入不得覆盖manual';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.schema_version IS '导入的结果契约版本，当前仅v1；不是评分规则版本';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.model IS '产生自动标签的模型标识；llm来源必填，人工结果可为空';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.prompt_sha256 IS '本次推理提示词UTF-8内容的SHA-256；llm来源必填；不是评分规则版本';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.input_sha256 IS '每个aid实际推理输入的SHA-256；固定aid/title/tag_new/description字段及序列化约定；不是1000条运行级输入摘要';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.source_run_id IS '来源运行或导入标识，如web-UUID；llm来源必填；独立运行文件保留审计与失败信息';
COMMENT ON COLUMN hantang_dynamic.video_content_labels.labeled_at IS '当前标签的标注/最后修订时间；导入端应提供实际时间并在更新时显式维护，缺省为本次事务时间';
COMMIT;
