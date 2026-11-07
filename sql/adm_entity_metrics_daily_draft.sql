-- ADM 日聚合表结构文档（第一期草案）
-- 日期：2026-10-21。
-- 状态更新（2026-10-26）：用户确认下方CREATE TABLE已成功执行。
-- 辅助索引及COMMENT是否执行尚未确认；本文是结构文档，不是自动迁移，勿直接重复建表。
-- 本次不连接数据库验证，也不执行DDL。
-- 面向直接执行的版本需移除空行，并完整选中每条语句执行。
-- 方案背景：../doc/design/adm-daily-aggregation-draft.md
-- 待办：../doc/todo/adm-daily-aggregation.md
-- 当前任务方案：../doc/design/adm-postgresql-aggregation.md；SQL已生成，未在业务库部署。
-- 安装与调用：adm_aggregation_usage.md
-- 唯一业务辅助表设计：adm_aggregation_task_draft.md（用户已确认创建）
--
-- 行粒度：数据范围 × 维度类型 × 维度对象 × 业务日。
-- 本期组合：
--   all / total / __all__                  全量总计
--   zhongshu50-v1 / total / __all__        中术50固定版本样本总计
--   all / partition_v1 / type_id文本       旧分区
--   all / partition_v2 / tid_v2文本        新分区，不处理pid_v2
-- 歌手、uploader、staff暂缓。未来扩展dimension_type约束，不预生成空行。
-- 两套分区分别独立聚合；不同scope或dimension_type的结果不能混加。
-- 仅生成上述四类组合，不生成中术50×旧分区或中术50×新分区。
-- 任务按日事务覆盖重算，失败回滚；不采用逐页持久化或在旧指标上递增。
--
-- 时间口径：record_date是北京时间凌晨约3±1小时的观测日期。
-- D+1快照减D快照归入D日增长；D行累计值取D+1快照，与增量期末对齐。
-- 它不是严格零点自然日增量。累计值不可跨日相加。
-- 指标增量应逐aid对齐快照后求差再汇总，保留负数。
-- video_count按D日结束前已投稿且满足收录规则的视频集合计算。
-- 收录排除is_deleted=true，不依据is_filtered过滤；新投稿缺期初不补零。
--
-- 缺失策略草案：任一成员缺少某指标的期末值，则该total为NULL；
-- 任一成员无法计算某指标差值，则该delta为NULL，不伪造0或跨日差分。
-- D快照缺失会影响D-1、D两个业务日的增量。
-- 覆盖计数是七项指标整体覆盖，不代表逐指标覆盖率。

CREATE TABLE hantang_dynamic.adm_entity_metrics_daily (
    stat_date date NOT NULL,
    scope_key text NOT NULL,
    dimension_type text NOT NULL,
    dimension_key text NOT NULL,

    -- 期末集合大小、当日投稿数，以及快照完整覆盖数。
    video_count bigint NOT NULL,
    submission_count bigint NOT NULL,
    end_snapshot_count bigint NOT NULL,
    delta_covered_count bigint NOT NULL,

    -- 七项期末累计指标。NULL表示无法给出完整合计，不默认填0。
    view_total bigint,
    favorite_total bigint,
    like_total bigint,
    coin_total bigint,
    share_total bigint,
    reply_total bigint,
    danmaku_total bigint,

    -- 七项当日增量。完整连续日期可相加，允许源端修正产生负数。
    view_delta bigint,
    favorite_delta bigint,
    like_delta bigint,
    coin_delta bigint,
    share_delta bigint,
    reply_delta bigint,
    danmaku_delta bigint,

    -- 由ETL完成集合及指标校验；约束不能证明源数据已完整采集。
    is_complete boolean NOT NULL,
    definition_version integer NOT NULL,
    batch_id uuid NOT NULL,
    computed_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT adm_entity_metrics_daily_pk PRIMARY KEY (
        scope_key, dimension_type, dimension_key, stat_date
    ),
    CONSTRAINT adm_entity_metrics_daily_dimension_ck CHECK (
        dimension_type IN ('total', 'partition_v1', 'partition_v2')
    ),
    CONSTRAINT adm_entity_metrics_daily_keys_ck CHECK (
        scope_key = btrim(scope_key)
        AND length(scope_key) BETWEEN 1 AND 100
        AND dimension_key = btrim(dimension_key)
        AND length(dimension_key) BETWEEN 1 AND 200
    ),
    CONSTRAINT adm_entity_metrics_daily_total_key_ck CHECK (
        (dimension_type = 'total' AND dimension_key = '__all__')
        OR (dimension_type <> 'total' AND dimension_key <> '__all__')
    ),
    CONSTRAINT adm_entity_metrics_daily_counts_ck CHECK (
        video_count >= 0
        AND submission_count BETWEEN 0 AND video_count
        AND end_snapshot_count BETWEEN 0 AND video_count
        AND delta_covered_count BETWEEN 0 AND end_snapshot_count
    ),
    CONSTRAINT adm_entity_metrics_daily_version_ck CHECK (
        definition_version > 0
    ),
    CONSTRAINT adm_entity_metrics_daily_complete_ck CHECK (
        NOT is_complete OR (
            end_snapshot_count = video_count
            AND delta_covered_count = video_count
            AND view_total IS NOT NULL AND favorite_total IS NOT NULL
            AND like_total IS NOT NULL AND coin_total IS NOT NULL
            AND share_total IS NOT NULL AND reply_total IS NOT NULL
            AND danmaku_total IS NOT NULL
            AND view_delta IS NOT NULL AND favorite_delta IS NOT NULL
            AND like_delta IS NOT NULL AND coin_delta IS NOT NULL
            AND share_delta IS NOT NULL AND reply_delta IS NOT NULL
            AND danmaku_delta IS NOT NULL
        )
    )
);

-- 主键支持单对象日期趋势；辅助索引支持某类对象的单日/区间查询。
CREATE INDEX adm_entity_metrics_daily_scope_type_date_idx
    ON hantang_dynamic.adm_entity_metrics_daily (
        scope_key, dimension_type, stat_date
    );

COMMENT ON TABLE hantang_dynamic.adm_entity_metrics_daily IS
    'ADM日聚合草案：全量、中术50、旧分区和新分区；按业务日保存累计值及增量';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.stat_date IS
    '业务日D；D+1凌晨快照减D凌晨快照归入D日增长，累计取D+1快照';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.scope_key IS
    'all为统一收录全量，zhongshu50-v1为固定版本样本；样本版本与名单对应';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.dimension_type IS
    'total总计；partition_v1使用type_id；partition_v2使用tid_v2，不处理pid_v2';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.dimension_key IS
    '总计固定__all__；分区使用ID文本；未知分区可使用__unknown__';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.video_count IS
    '业务日D结束前已投稿且符合收录规则的去重aid数，不能跨日相加';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.submission_count IS
    '收录集合中业务日D投稿的视频数';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.end_snapshot_count IS
    '期末七项指标均非NULL的去重视频数，不代表逐指标覆盖率';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.delta_covered_count IS
    '七项增量均可有效计算的去重视频数；零基线必须由ETL验证，不能用于旧视频补收录';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.view_total IS
    '期末累计播放合计；成员播放值缺失则NULL，其他total列同理';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.view_delta IS
    '逐aid期末减期初播放后汇总；任一差值不可计算则NULL，其他delta列同理';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.is_complete IS
    '集合、关联、投稿日期及全部指标均完整并通过批次校验';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.definition_version IS
    '统计规则版本，历史重算期间不得静默混用不同版本';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.batch_id IS
    '聚合作业生成的UUID，同一范围和日期的结果需一致发布';
COMMENT ON COLUMN hantang_dynamic.adm_entity_metrics_daily.computed_at IS
    '聚合计算时间，不是源采集时间；更新时ETL需显式刷新';
