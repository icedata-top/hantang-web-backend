-- 日聚合任务辅助表。PostgreSQL 14+；使用已有hantang_dynamic schema。
-- 2026-10-26：用户确认辅助表已创建。本文件用于文档与首次安装，勿重复建表。
-- 规则：排除is_deleted=true，不依据is_filtered过滤；未知投稿日期使任务失败，避免静默漏计。
-- 执行顺序：本文件，然后adm_aggregation_routines.sql。文档版允许空行和注释。

CREATE OR REPLACE FUNCTION hantang_dynamic.adm_valid_sample_aids(p_aids bigint[])
RETURNS boolean
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $fn$
    SELECT COALESCE(
        array_ndims(p_aids) = 1 AND cardinality(p_aids) = 50
        AND (SELECT count(DISTINCT aid) FROM unnest(p_aids) AS s(aid) WHERE aid > 0) = 50,
        false
    );
$fn$;

CREATE TABLE hantang_dynamic.adm_aggregation_task (
    stat_date date PRIMARY KEY,
    request_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    status text NOT NULL DEFAULT 'pending',
    priority integer NOT NULL DEFAULT 0,
    attempt_count integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    retry_delay_seconds integer NOT NULL DEFAULT 60,
    next_attempt_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attempt_id uuid,
    definition_version integer NOT NULL DEFAULT 1,
    collection_policy text NOT NULL DEFAULT 'non_deleted_processed',
    sample_scope text NOT NULL,
    sample_aids bigint[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at timestamptz,
    finished_at timestamptz,
    last_error_sqlstate text,
    last_error text,
    result_summary jsonb,
    CONSTRAINT adm_aggregation_task_status_ck CHECK (
        status IN ('pending', 'running', 'retry_wait', 'succeeded', 'failed')
    ),
    CONSTRAINT adm_aggregation_task_attempts_ck CHECK (
        max_attempts > 0 AND attempt_count BETWEEN 0 AND max_attempts
        AND retry_delay_seconds BETWEEN 1 AND 86400
    ),
    CONSTRAINT adm_aggregation_task_definition_ck CHECK (definition_version > 0),
    CONSTRAINT adm_aggregation_task_policy_ck CHECK (collection_policy = 'non_deleted_processed'),
    CONSTRAINT adm_aggregation_task_scope_ck CHECK (
        sample_scope = btrim(sample_scope)
        AND length(sample_scope) BETWEEN 1 AND 100
        AND sample_scope <> 'all'
    ),
    CONSTRAINT adm_aggregation_task_sample_ck CHECK (hantang_dynamic.adm_valid_sample_aids(sample_aids)),
    CONSTRAINT adm_aggregation_task_running_ck CHECK (
        status NOT IN ('running', 'succeeded') OR (attempt_id IS NOT NULL AND attempt_count > 0)
    )
);

CREATE INDEX adm_aggregation_task_ready_idx
    ON hantang_dynamic.adm_aggregation_task (priority DESC, next_attempt_at, stat_date)
    WHERE status IN ('pending', 'retry_wait');

COMMENT ON TABLE hantang_dynamic.adm_aggregation_task IS '按业务日唯一的ADM任务队列；有限重试，领取次数先提交，结果和成功状态同事务';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.stat_date IS '业务日D；D+1凌晨观测快照减D快照归入D增长';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.request_id IS '当前执行请求；显式重排生成新值，不代表另建一行历史';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.attempt_count IS '已领取次数，进程中断也不会退回次数；不是额外重试次数';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.max_attempts IS '总尝试次数上限，3表示首次加最多两次重试';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.retry_delay_seconds IS '基础重试等待秒数，worker按次数退避且最大等待1小时';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.collection_policy IS 'non_deleted_processed：排除is_deleted=true，不依据is_filtered过滤';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.sample_aids IS '本请求规范化50个样本aid；同scope必须保持同名单';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.attempt_id IS '本次尝试UUID；成功后对应正式结果batch_id';
COMMENT ON COLUMN hantang_dynamic.adm_aggregation_task.result_summary IS '成功行数与完整性摘要；任务成功不等于源数据完整';
