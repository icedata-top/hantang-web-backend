import { getLanguageSettings } from '../../locales/languages.js';
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

function HistoryRange({ range, onChange, language }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => [dayjs(range.startDate), dayjs(range.endDate)]);
  const locale = getLanguageSettings(language).dateLocale;
  const dirty = draft?.[0]?.format('YYYY-MM-DD') !== range.startDate || draft?.[1]?.format('YYYY-MM-DD') !== range.endDate;
  const valid = draft?.[0] && draft?.[1] && !isDateRangeDisabled(draft[0]) && !isDateRangeDisabled(draft[1], { from: draft[0] });
  return <div className="video-history-range">
    <label id="video-history-range-label">{t("日期范围")}</label>
    <RangePicker value={draft?.map((date) => date?.locale(locale)) ?? null} allowClear={false}
      presets={getDateRangePresets(language)} disabledDate={isDateRangeDisabled} onChange={setDraft}
      defaultPickerValue={[dayjs().locale(locale).subtract(1, 'month').startOf('month'), dayjs().locale(locale).startOf('month')]}
      format="YYYY-MM-DD" aria-labelledby="video-history-range-label" />
    {dirty && <div className="video-history-range-actions">
      <Button onClick={() => setDraft([dayjs(range.startDate), dayjs(range.endDate)])}>{t("重置")}</Button>
      <Button type="primary" disabled={!valid} onClick={() => onChange({ startDate: draft[0].format('YYYY-MM-DD'), endDate: draft[1].format('YYYY-MM-DD') })}>
        {t("确定")}
      </Button>
    </div>}
  </div>;
}

export function VideoMetricsHistoryView({ range, onRangeChange, mode, onModeChange, state, onRetry }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  const model = useMemo(() => state.status === 'ready' ? buildVideoMetricsModel(state.data?.rows, range.startDate, range.endDate) : null,
    [state.status, state.data, range.startDate, range.endDate]);
  const rows = model?.[mode === 'delta' ? 'delta' : 'cumulative'] ?? [];
  const hasValues = rows.some((row) => VIDEO_METRICS.some(({ key }) => row.indicators[key] != null));
  const missingRows = rows.filter((row) => VIDEO_METRICS.some(({ key }) => row.indicators[key] == null));
  const closingDate = addSnapshotDays(range.endDate, 1);
  const hasMissing = model && (model.missingSnapshots.length > 0 || model.partialSnapshots.length > 0);

  return <section className="ds-surface video-history-panel" aria-labelledby="video-history-title" aria-busy={state.status === 'loading'}>
    <div className="video-history-heading">
      <h2 id="video-history-title">{t("数据趋势")}</h2>
      <Segmented className="ds-segmented" value={mode} onChange={onModeChange}
        options={[{ value: 'cumulative', label: t("累计值") }, { value: 'delta', label: t("增量") }]}
        aria-label={t("图表模式")} />
    </div>
    <HistoryRange range={range} onChange={onRangeChange} language={language} />
    <p className="video-history-caption">{t("累计值展示 {{value0}} 至 {{value1}} 的凌晨快照；每日增量为次日凌晨减当日凌晨，与总览页口径一致。", { value0: range.startDate, value1: closingDate })}</p>

    {state.status === 'loading' && <div className="video-history-state" role="status"><Spin /><span>{t("正在加载趋势数据…")}</span></div>}
    {state.status === 'error' && <div className="ds-alert video-history-notice" data-variant="error" role="alert">
      <WarningOutlined /><span>{t("趋势数据加载失败，请重试。")}</span>
      <Button icon={<ReloadOutlined />} onClick={onRetry}>{t("重试")}</Button>
    </div>}
    {model && <>
      <p className="video-history-summary" role="status">
        {model.growth == null ? t("所选日期范围内，播放量增长与日均增长暂缺：区间起点或终点的播放数据缺失。")
          : t("所选日期范围内，播放量增长 ")}
        {model.growth != null && <><strong>{formatNumber(model.growth, 'comma')}</strong>{t("，日均 ")}
          <strong>{formatNumber(Math.round(model.average * 100) / 100, 'comma')}</strong>{t("（共 {{value0}} 天）。", { value0: model.days })}</>}
      </p>
      {hasMissing && <div className="ds-alert video-history-notice" data-variant="info" role="status">
        <InfoCircleOutlined /><span>{t("所需快照中，{{value0}} 个日期未收录，{{value1}} 个日期的部分指标暂缺。图表保留缺口，不补零、不跨缺失日期计算增量。", { value0: model.missingSnapshots.length, value1: model.partialSnapshots.length })}{model.growth != null && t("区间增长按两端快照计算，不受中间缺口影响；日均按完整所选天数计算。")}</span>
      </div>}
      {hasValues ? <VideoMetricsChart rows={rows} mode={mode} />
        : <div className="video-history-state" role="status">{mode === 'delta'
          ? t("所选日期范围暂无可计算的每日增量，需要相邻两日的有效快照。")
          : t("所选日期范围的七项数据均暂缺。")}</div>}
      {hasMissing && <Collapse ghost className="video-history-missing" items={[{
        key: 'missing', label: t("查看缺失日期与指标"),
        children: <>
          {model.missingSnapshots.length > 0 && <p>{t("未收录快照：")}{model.missingSnapshots.join('、')}</p>}
          {model.partialSnapshots.length > 0 && <ul>{model.partialSnapshots.map((row) => <li key={row.date}>
            <time dateTime={row.date}>{row.date}</time>：{VIDEO_METRICS.filter(({ key }) => row.indicators[key] == null).map(({ label }) => t(label)).join('、')}{t("暂缺")}
          </li>)}</ul>}
          {mode === 'delta' && missingRows.length > 0 && <><p>{t("无法计算的每日增量：")}</p>
            <ul>{missingRows.map((row) => <li key={row.date}><time dateTime={row.date}>{row.date}</time>：
              {VIDEO_METRICS.filter(({ key }) => row.indicators[key] == null).map(({ label }) => t(label)).join('、')}</li>)}</ul></>}
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
