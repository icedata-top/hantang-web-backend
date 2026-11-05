import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Spin } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { RELATIVE_TIME_MODES } from '../../components/custom/RelativeTime/relativeTime.js';
import { fetchVideoGateCrossings } from '../../services/Video/video.api.js';
import {
  GATE_CROSSING_ALL_LEVEL,
  GATE_CROSSING_PAGE_SIZE,
  buildGateCrossingLevelOptions,
  filterGateCrossings,
  getGateCrossingDelta,
  paginateGateCrossings,
} from '../../constants/video/gateCrossings.js';
import { formatNumber } from '../../utils/formatNumber.js';
import './VideoGateCrossings.css';

const MISSING = '—';

function formatCount(value) {
  return value == null ? MISSING : formatNumber(value, 'comma');
}

function DeltaCell({ row }) {
  const delta = getGateCrossingDelta(row);
  if (delta == null) return MISSING;
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const text = formatNumber(delta, 'comma');
  return <span className="video-gate-crossings-delta" data-trend={trend}>{delta > 0 ? `+${text}` : text}</span>;
}

/** 纯展示组件：接收已加载的过线记录，量级筛选与分页都在本地完成。 */
export function VideoGateCrossingsView({ rows = [], status, onRetry }) {
  const { t } = useTranslation();
  const [levelId, setLevelId] = useState(GATE_CROSSING_ALL_LEVEL.id);
  const [page, setPage] = useState(1);

  const levelOptions = useMemo(() => buildGateCrossingLevelOptions(rows).map(({ level, count, disabled }) => ({
    value: level.id,
    disabled,
    label: t('{{value0}}（{{value1}} 条）', { value0: t(level.label), value1: count }),
  })), [rows, t]);

  const filtered = useMemo(() => filterGateCrossings(rows, levelId), [rows, levelId]);
  const current = useMemo(() => paginateGateCrossings(filtered, page), [filtered, page]);

  const tableRows = current.rows.map((row) => ({ ...row, id: String(row.gateValue) }));
  const columns = [
    {
      key: 'gateValue',
      title: t('过线值'),
      width: 140,
      align: 'right',
      render: (value) => <span className="ds-chip video-gate-crossings-gate" data-variant="neutral">{formatCount(value)}</span>,
    },
    { key: 'previousView', title: t('上次播放'), width: 130, align: 'right', render: formatCount },
    { key: 'currentView', title: t('当前播放'), width: 130, align: 'right', render: formatCount },
    { key: 'delta', title: t('增量'), width: 130, align: 'right', render: (_value, row) => <DeltaCell row={row} /> },
    {
      key: 'crossedAt',
      title: t('过线时间'),
      width: 170,
      render: (value) => <RelativeTime value={value} mode={RELATIVE_TIME_MODES.ABSOLUTE} />,
    },
  ];

  const loading = status === 'loading';
  const hasRows = status === 'ready' && rows.length > 0;

  function changeLevel(nextLevel) {
    setLevelId(nextLevel);
    setPage(1);
  }

  return <section className="ds-surface video-gate-crossings-panel" aria-labelledby="video-gate-crossings-title"
    aria-busy={loading}>
    <div className="video-gate-crossings-heading">
      <h2 id="video-gate-crossings-title">{t('播放过线记录')}</h2>
      {hasRows && <div className="video-gate-crossings-filter">
        <span id="video-gate-crossings-level-label">{t('过线值精度')}</span>
        <Select className="video-gate-crossings-select" value={levelId} options={levelOptions}
          onChange={changeLevel} aria-labelledby="video-gate-crossings-level-label"
          popupMatchSelectWidth={false} />
      </div>}
    </div>

    {hasRows && <p className="video-gate-crossings-caption">
      {t('按取整精度分档：整千为千位整数，整万为万位整数，依次到整亿；每个过线值只归入最粗的一档。过线时间以北京时间显示到分，悬停查看相对时间等详情。')}
    </p>}

    {loading && <div className="video-gate-crossings-state" role="status">
      <Spin /><span>{t('正在加载过线记录…')}</span>
    </div>}

    {status === 'error' && <div className="ds-alert video-gate-crossings-notice" data-variant="error" role="alert">
      <WarningOutlined /><span>{t('过线记录加载失败，请重试。')}</span>
      <Button icon={<ReloadOutlined />} onClick={onRetry}>{t('重试')}</Button>
    </div>}

    {status === 'ready' && rows.length === 0 && <div className="video-gate-crossings-state" role="status">
      {t('该视频暂无过线记录')}
    </div>}

    {hasRows && <>
      <DsTable columns={columns} rows={tableRows} caption={t('播放过线记录明细')} />
      <div className="video-gate-crossings-pagination">
        <DsPagination current={current.page} pageSize={GATE_CROSSING_PAGE_SIZE} total={current.total}
          label={t('播放过线记录分页')} onChange={setPage} />
      </div>
    </>}
  </section>;
}

/** 请求层：切换视频时中止旧请求，旧响应不会覆盖新视频。 */
export default function VideoGateCrossings({ aid }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', rows: [] });
  const requestKey = JSON.stringify([aid, attempt]);

  useEffect(() => {
    const controller = new AbortController();
    setState({ key: requestKey, status: 'loading', rows: [] });
    fetchVideoGateCrossings(aid, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ key: requestKey, status: 'ready', rows: data?.rows ?? [] });
      },
      () => {
        if (!controller.signal.aborted) setState({ key: requestKey, status: 'error', rows: [] });
      },
    );
    return () => controller.abort();
  }, [aid, attempt, requestKey]);

  return <VideoGateCrossingsView rows={state.rows}
    status={state.key === requestKey ? state.status : 'loading'}
    onRetry={() => setAttempt((value) => value + 1)} />;
}
