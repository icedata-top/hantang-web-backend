import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Collapse, InputNumber, Progress, Segmented, Select, Tag, Tooltip } from 'antd';
import { DownloadOutlined, PlayCircleOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { fetchLabelingOverview, fetchVideoLabeling, labelingDownloadUrl, startVideoLabeling, stopVideoLabeling } from '../../services/Admin/videoLabeling.api.js';
import { analysisProgress, CONCURRENCY_OPTIONS, DEFAULT_CONCURRENCY, formatAnalysisDuration } from './videoAnalysisModel.js';
import { clampLabelingCount, labelingAvailability, labelingOverviewRequestError, MAX_LABELING_COUNT, overallLabelingPercent, validLabelingCount } from './videoLabelingModel.js';
import './VideoLabelReview.css';

export default function VideoLabelReview() {
  const { t } = useTranslation();
  const [overview, setOverview] = useState(null);
  const [state, setState] = useState(null);
  const [mode, setMode] = useState('incremental');
  const [count, setCount] = useState(10000);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const restored = useRef(null);
  const active = Boolean(state?.active);
  useEffect(() => {
    let alive = true, timer, controller;
    async function poll() {
      controller = new AbortController(); let repeat = true;
      try {
        const next = await fetchVideoLabeling({ signal: controller.signal });
        if (alive) {
          setState(next); setError(value => value === 'bulk.connectionError' ? '' : value);
          if (next.id && next.id !== restored.current) {
            restored.current = next.id; setMode(next.mode); setCount(next.requested_count); setConcurrency(next.concurrency);
          }
        }
        repeat = next.active;
      } catch { if (alive) setError('bulk.connectionError'); }
      if (alive && repeat) timer = setTimeout(poll, 1000);
    }
    poll();
    return () => { alive = false; clearTimeout(timer); controller?.abort(); };
  }, [refresh]);
  useEffect(() => {
    let alive = true, timer, controller;
    async function poll() {
      controller = new AbortController();
      try { const next = await fetchLabelingOverview({ signal: controller.signal }); if (alive) setOverview(next); }
      catch (failure) { if (alive) setOverview({ available: false, error: labelingOverviewRequestError(failure) }); }
      if (alive) timer = setTimeout(poll, 5000);
    }
    poll();
    return () => { alive = false; clearTimeout(timer); controller?.abort(); };
  }, [refresh, active]);
  const available = labelingAvailability(overview, mode);
  useEffect(() => { if (!active) setCount(value => clampLabelingCount(value, available)); }, [available, active]);
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);
  }, [active]);
  async function start() {
    setBusy(true); setError('');
    try { setState(await startVideoLabeling({ mode, count, concurrency })); setRefresh(value => value + 1); }
    catch { setError('bulk.startFailed'); setRefresh(value => value + 1); }
    finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true);
    try { setState(await stopVideoLabeling()); setRefresh(value => value + 1); }
    catch { setError('bulk.stopFailed'); }
    finally { setBusy(false); }
  }
  const progress = analysisProgress(state, now);
  const summary = state?.summary;
  const number = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const metric = (key, value) => <div><dt>{t(key)}</dt><dd>{value ?? '—'}</dd></div>;
  const eta = progress.eta == null ? t(`analysis.eta.${progress.etaState}`) : formatAnalysisDuration(progress.eta);
  const overall = overallLabelingPercent(overview);
  const showRun = state && state.status !== 'idle';
  const failed = ['failed', 'completed_with_failures'].includes(state?.status);
  return <div className="admin-page review-page labeling-page">
    <h1>{t('bulk.title')}</h1>
    <p className="review-help">{t('bulk.lead')}</p>
    <section className="ds-surface review-execution labeling-overview" aria-labelledby="labeling-overall-title">
      <Progress type="circle" percent={overall ?? 0} size={124} strokeColor="var(--theme-primary)" trailColor="var(--canvas)"
        format={() => overall == null ? '—' : `${overall}%`} />
      <div className="labeling-overview-copy">
        <h2 id="labeling-overall-title">{t('bulk.overall')}</h2>
        <dl className="review-execution-stats">
          {metric('bulk.total', overview?.available ? number(overview.total_count) : '—')}
          {metric('bulk.labeled', overview?.available ? number(overview.labeled_count) : '—')}
          {metric('bulk.unlabeled', overview?.available ? number(overview.unlabeled_count) : '—')}
        </dl>
        <p className="review-help">{t('bulk.overallHint')}</p>
        {overview?.snapshot_at && <p className="review-help">{t('bulk.updated')} <RelativeTime value={overview.snapshot_at} mode="absolute" /></p>}
      </div>
    </section>
    {overview && !overview.available && <Alert className="ds-alert review-notice" data-variant="warning" type="warning" showIcon
      title={t(`bulk.error.${overview.error}`, { defaultValue: t('bulk.error.OVERVIEW_UNAVAILABLE') })} />}
    <section className="ds-surface review-execution" aria-labelledby="labeling-task-title">
      <div className="review-execution-heading">
        <h2 id="labeling-task-title">{t('bulk.task')}</h2><Tag className="ds-chip">{state?.model || 'Qwen'}</Tag>
      </div>
      <div className="labeling-controls">
        <label className="labeling-control"><span>{t('bulk.mode')}</span>
          <Segmented disabled={active || busy} value={mode} onChange={setMode} className="ds-segmented"
            options={['incremental', 'overwrite'].map(value => ({ value, label: t(`bulk.mode.${value}`) }))} />
        </label>
        <label className="labeling-control" htmlFor="labeling-count"><span>{t('bulk.count')}</span>
          <InputNumber id="labeling-count" className="ds-filter-control" variant="borderless" value={count || null} min={1}
            max={Math.min(available || MAX_LABELING_COUNT, MAX_LABELING_COUNT)} step={1000} precision={0}
            disabled={active || busy || available === 0} onChange={setCount} />
        </label>
        <label className="labeling-control" htmlFor="labeling-concurrency"><span>{t('analysis.concurrency')}</span>
          <Select id="labeling-concurrency" className="ds-filter-control" variant="borderless" value={concurrency} onChange={setConcurrency}
            disabled={active || busy} options={CONCURRENCY_OPTIONS.map(value => ({ value, label: t('analysis.concurrencyOption', { count: value }) }))} />
        </label>
        <Button className="ds-button labeling-start" data-variant="primary" icon={<PlayCircleOutlined />} loading={busy && !active}
          disabled={active || busy || !state || Boolean(error) || !validLabelingCount(count, available)} onClick={start}>{t('analysis.start')}</Button>
        {active && <Button className="ds-button" data-variant="secondary" icon={<StopOutlined />} loading={busy}
          disabled={state.status === 'stopping'} onClick={stop}>{t('bulk.stop')}</Button>}
      </div>
      <p className="review-help">{t(`bulk.modeHint.${mode}`, { count: number(available) })}</p>
      <p className="review-help">{t('bulk.batchHint')}</p>
      {error && <Alert className="ds-alert review-notice" data-variant="error" type="error" showIcon title={t(error)}
        action={<Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={() => { setError(''); setRefresh(value => value + 1); }}>{t('analysis.refresh')}</Button>} />}
      {showRun && <>
        <p role="status">{t(`bulk.status.${state.status}`, { defaultValue: state.status })}</p>
        <Progress percent={progress.percent} status={failed ? 'exception' : active ? 'active' : 'normal'}
          strokeColor={failed ? 'var(--status-error-text)' : 'var(--theme-primary)'} trailColor="var(--canvas)" />
        <p className="review-help">{t('bulk.runCounts', { ...progress, skipped: summary?.skipped_count ?? 0 })}</p>
        {active && <>
          <dl className="review-execution-stats review-execution-primary">
            {metric('analysis.speed', number(progress.speed))}{metric('analysis.remaining', number(progress.remaining))}{metric('analysis.eta', eta)}
          </dl>
          <dl className="review-execution-stats">
            {metric('analysis.activeRequests', <Tooltip title={t('analysis.activeHint')}><span>{progress.stale ? '—' : state.active_requests} / {state.concurrency}</span></Tooltip>)}
            {metric('analysis.apiAverage', summary?.request_elapsed_ms_avg == null ? '—' : `${number(summary.request_elapsed_ms_avg / 1000)} s`)}
            {metric('analysis.elapsedLabel', formatAnalysisDuration(state.elapsed_ms))}
            {metric('analysis.estimatedCompletion', progress.estimatedCompletion ? <RelativeTime value={progress.estimatedCompletion} mode="absolute" /> : eta)}
          </dl>
          {progress.stale && <p className="review-help">{t('analysis.stale')}</p>}
        </>}
        {!active && <div className="review-execution-summary">
          <h3>{t('analysis.summary')}</h3>
          <dl className="review-execution-stats">
            {metric('analysis.elapsedLabel', formatAnalysisDuration(state.elapsed_ms))}
            {metric('analysis.finishedAt', state.finished_at ? <RelativeTime value={state.finished_at} mode="absolute" /> : '—')}
            {metric('analysis.averageSpeed', number(progress.averageSpeed))}
            {metric('analysis.requests', number(summary?.request_attempt_count))}{metric('analysis.retries', number(summary?.retry_count))}
            {metric('analysis.totalTokens', number(summary?.reported_usage?.total_tokens))}
          </dl>
          <p className="review-help">{t(state.mode === 'overwrite' ? 'bulk.overwriteContinueHint' : 'bulk.continueHint')}</p>
        </div>}
        {state.fatal_error && <Alert className="ds-alert review-notice" data-variant="error" type="error" showIcon
          title={t(`bulk.error.${state.fatal_error.code}`, { defaultValue: t('bulk.error.EXECUTION_FAILED') })} />}
        <Collapse ghost className="review-execution-details" items={[{ key:'details', label:t('analysis.details'), children:<>
          <dl className="review-execution-stats">
            {metric('analysis.inputTokens', number(summary?.reported_usage?.prompt_tokens))}{metric('analysis.outputTokens', number(summary?.reported_usage?.completion_tokens))}
            {metric('analysis.tpm', progress.stale ? '—' : number(state.live?.tpm))}{metric('analysis.rpm', progress.stale ? '—' : number(state.live?.rpm))}
            {metric('analysis.waitingRetries', number(state.live?.waiting_retries))}
            {metric('analysis.failureRateLabel', summary?.request_failure_rate == null ? '—' : `${number(summary.request_failure_rate * 100)}%`)}
          </dl>
          {state.last_error && <p className="review-help">{t('analysis.lastError', { code:state.last_error.code })}</p>}
          {summary?.usage_missing_attempts?.total_tokens > 0 && <p className="review-help">{t('analysis.partialUsage')}</p>}
          <p className="review-help">{t(state.selection_prepared ? 'bulk.selectionHint' : 'bulk.preparingHint', { count:number(state.selected_count), requested:number(state.requested_count) })}</p>
          <div className="review-file-actions">
            <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />} href={labelingDownloadUrl('statistics')}>{t('analysis.downloadStatistics')}</Button>
            {summary?.request_attempt_count > 0 && <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />} href={labelingDownloadUrl('attempts')}>{t('bulk.downloadAttempts')}</Button>}
          </div>
        </> }]} />
      </>}
    </section>
  </div>;
}
