import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Collapse, DatePicker, Segmented, Spin } from 'antd';
import { InfoCircleOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { fetchVideoDailyMetrics } from '../../services/Video/video.api.js';
import { addSnapshotDays, buildVideoMetricsModel } from '../../services/Video/videoMetrics.js';
import { VIDEO_METRICS } from '../../constants/video/metrics.js';
import { getDefaultDateRange, getDateRangePresets, isDateRangeDisabled } from '../../utils/metricsDateRange.js';
import { formatNumber } from '../../utils/formatNumber.js';
import VideoMetricsChart from './VideoMetricsChart.jsx';
import './VideoMetricsHistory.css';

const { RangePicker } = DatePicker;

function HistoryRange({ range, onChange, isZh }) {
  const [draft, setDraft] = useState(() => [dayjs(range.startDate), dayjs(range.endDate)]);
  const locale = isZh ? 'zh-cn' : 'en';
  const dirty = draft?.[0]?.format('YYYY-MM-DD') !== range.startDate || draft?.[1]?.format('YYYY-MM-DD') !== range.endDate;
  const valid = draft?.[0] && draft?.[1] && !isDateRangeDisabled(draft[0]) && !isDateRangeDisabled(draft[1], { from: draft[0] });
  return <div className="video-history-range">
    <label id="video-history-range-label">{isZh ? '日期范围' : 'Date range'}</label>
    <RangePicker value={draft?.map((date) => date?.locale(locale)) ?? null} allowClear={false}
      presets={getDateRangePresets(isZh)} disabledDate={isDateRangeDisabled} onChange={setDraft}
      defaultPickerValue={[dayjs().locale(locale).subtract(1, 'month').startOf('month'), dayjs().locale(locale).startOf('month')]}
      format="YYYY-MM-DD" aria-labelledby="video-history-range-label" />
    {dirty && <div className="video-history-range-actions">
      <Button onClick={() => setDraft([dayjs(range.startDate), dayjs(range.endDate)])}>{isZh ? '重置' : 'Reset'}</Button>
      <Button type="primary" disabled={!valid} onClick={() => onChange({ startDate: draft[0].format('YYYY-MM-DD'), endDate: draft[1].format('YYYY-MM-DD') })}>
        {isZh ? '确定' : 'Apply'}
      </Button>
    </div>}
  </div>;
}

export function VideoMetricsHistoryView({ range, onRangeChange, mode, onModeChange, state, onRetry }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const model = useMemo(() => state.status === 'ready' ? buildVideoMetricsModel(state.data?.rows, range.startDate, range.endDate) : null,
    [state.status, state.data, range.startDate, range.endDate]);
  const rows = model?.[mode === 'delta' ? 'delta' : 'cumulative'] ?? [];
  const hasValues = rows.some((row) => VIDEO_METRICS.some(({ key }) => row.indicators[key] != null));
  const missingRows = rows.filter((row) => VIDEO_METRICS.some(({ key }) => row.indicators[key] == null));
  const closingDate = addSnapshotDays(range.endDate, 1);
  const hasMissing = model && (model.missingSnapshots.length > 0 || model.partialSnapshots.length > 0);

  return <section className="ds-surface video-history-panel" aria-labelledby="video-history-title" aria-busy={state.status === 'loading'}>
    <div className="video-history-heading">
      <h2 id="video-history-title">{t('数据趋势', 'Metric Trends')}</h2>
      <Segmented className="ds-segmented" value={mode} onChange={onModeChange}
        options={[{ value: 'cumulative', label: t('累计值', 'Cumulative') }, { value: 'delta', label: t('增量', 'Daily change') }]}
        aria-label={t('图表模式', 'Chart mode')} />
    </div>
    <HistoryRange range={range} onChange={onRangeChange} isZh={isZh} />
    <p className="video-history-caption">{t(
      `累计值展示 ${range.startDate} 至 ${closingDate} 的凌晨快照；每日增量为次日凌晨减当日凌晨，与总览页口径一致。`,
      `Cumulative values show early-morning snapshots from ${range.startDate} through ${closingDate}. Daily changes subtract each morning from the next, matching Overview.`,
    )}</p>

    {state.status === 'loading' && <div className="video-history-state" role="status"><Spin /><span>{t('正在加载趋势数据…', 'Loading metric history…')}</span></div>}
    {state.status === 'error' && <div className="ds-alert video-history-notice" data-variant="error" role="alert">
      <WarningOutlined /><span>{t('趋势数据加载失败，请重试。', 'Could not load metric history. Please retry.')}</span>
      <Button icon={<ReloadOutlined />} onClick={onRetry}>{t('重试', 'Retry')}</Button>
    </div>}
    {model && <>
      <p className="video-history-summary" role="status">
        {model.growth == null ? t('所选日期范围内，播放量增长与日均增长暂缺：区间起点或终点的播放数据缺失。', 'View growth and daily average are unavailable: a range endpoint is missing its view count.')
          : t('所选日期范围内，播放量增长 ', 'Over the selected range, views changed by ')}
        {model.growth != null && <><strong>{formatNumber(model.growth, 'comma')}</strong>{t('，日均 ', ', averaging ')}
          <strong>{formatNumber(Math.round(model.average * 100) / 100, 'comma')}</strong>{t(`（共 ${model.days} 天）。`, ` per day (${model.days} days).`)}</>}
      </p>
      {hasMissing && <div className="ds-alert video-history-notice" data-variant="info" role="status">
        <InfoCircleOutlined /><span>{t(
          `所需快照中，${model.missingSnapshots.length} 个日期未收录，${model.partialSnapshots.length} 个日期的部分指标暂缺。图表保留缺口，不补零、不跨缺失日期计算增量。`,
          `${model.missingSnapshots.length} required snapshot dates are absent; ${model.partialSnapshots.length} have incomplete metrics. Gaps stay visible and daily changes never bridge missing data.`,
        )}{model.growth != null && t('区间增长按两端快照计算，不受中间缺口影响；日均按完整所选天数计算。', 'Range growth uses the two endpoint snapshots; the daily average covers all selected days.')}</span>
      </div>}
      {hasValues ? <VideoMetricsChart rows={rows} mode={mode} />
        : <div className="video-history-state" role="status">{mode === 'delta'
          ? t('所选日期范围暂无可计算的每日增量，需要相邻两日的有效快照。', 'No daily changes can be calculated: valid snapshots on adjacent days are required.')
          : t('所选日期范围的七项数据均暂缺。', 'All seven metrics are unavailable for this range.')}</div>}
      {hasMissing && <Collapse ghost className="video-history-missing" items={[{
        key: 'missing', label: t('查看缺失日期与指标', 'Missing dates and metrics'),
        children: <>
          {model.missingSnapshots.length > 0 && <p>{t('未收录快照：', 'Absent snapshots: ')}{model.missingSnapshots.join('、')}</p>}
          {model.partialSnapshots.length > 0 && <ul>{model.partialSnapshots.map((row) => <li key={row.date}>
            <time dateTime={row.date}>{row.date}</time>：{VIDEO_METRICS.filter(({ key }) => row.indicators[key] == null).map(({ label, labelEn }) => isZh ? label : labelEn).join('、')}{t('暂缺', ' unavailable')}
          </li>)}</ul>}
          {mode === 'delta' && missingRows.length > 0 && <><p>{t('无法计算的每日增量：', 'Unavailable daily changes:')}</p>
            <ul>{missingRows.map((row) => <li key={row.date}><time dateTime={row.date}>{row.date}</time>：
              {VIDEO_METRICS.filter(({ key }) => row.indicators[key] == null).map(({ label, labelEn }) => isZh ? label : labelEn).join('、')}</li>)}</ul></>}
        </>,
      }]} />}
    </>}
  </section>;
}

export default function VideoMetricsHistory({ aid }) {
  const [range, setRange] = useState(getDefaultDateRange);
  const [mode, setMode] = useState('cumulative');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null });
  const requestKey = JSON.stringify([aid, range.startDate, range.endDate, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ key: requestKey, status: 'loading', data: null });
    fetchVideoDailyMetrics(aid, range.startDate, addSnapshotDays(range.endDate, 1), { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setState({ key: requestKey, status: 'ready', data }); },
      () => { if (!controller.signal.aborted) setState({ key: requestKey, status: 'error', data: null }); },
    );
    return () => controller.abort();
  }, [aid, range.startDate, range.endDate, attempt, requestKey]);
  return <VideoMetricsHistoryView range={range} onRangeChange={setRange} mode={mode} onModeChange={setMode}
    state={state.key === requestKey ? state : { status: 'loading', data: null }} onRetry={() => setAttempt((value) => value + 1)} />;
}
