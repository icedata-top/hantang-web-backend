import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Collapse, Progress, Select, Tag, Tooltip } from 'antd';
import { DownloadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import VideoAnalysisScore from './VideoAnalysisScore.jsx';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { fetchVideoAnalysis, scoreSavedVideoAnalysis, startVideoAnalysis, videoAnalysisDownloadUrl } from '../../services/Admin/videoAnalysis.api.js';
import { analysisProgress, CONCURRENCY_OPTIONS, DEFAULT_CONCURRENCY, formatAnalysisDuration } from './videoAnalysisModel.js';

export default function VideoAnalysisPanel() {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [concurrency, setConcurrency] = useState(DEFAULT_CONCURRENCY);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    let timer;
    let controller;
    async function poll() {
      controller = new AbortController();
      let active = true;
      let retryDelay = 1000;
      try {
        const data = await fetchVideoAnalysis({ signal: controller.signal });
        active = Boolean(data.active);
        if (alive) {
          setState(data); setError(false);
          if (data.concurrency) setConcurrency(data.concurrency);
        }
      } catch { if (alive) setError(true); retryDelay = 3000; }
      if (alive && active) timer = setTimeout(poll, retryDelay);
    }
    poll();
    return () => { alive = false; clearTimeout(timer); controller?.abort(); };
  }, [refresh]);

  useEffect(() => {
    if (!state?.active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state?.active]);

  async function start() {
    setStarting(true);
    try { setState(await startVideoAnalysis(concurrency)); setError(false); setRefresh(value => value + 1); }
    catch { setError(true); }
    finally { setStarting(false); }
  }

  async function rescore() {
    setStarting(true);
    try { setState(await scoreSavedVideoAnalysis()); setError(false); setRefresh(value => value + 1); }
    catch { setError(true); }
    finally { setStarting(false); }
  }

  const summary = state?.summary;
  const live = state?.live;
  const progress = analysisProgress(state, now);
  const terminalFailure = ['failed', 'completed_with_failures', 'interrupted'].includes(state?.status);
  const number = value => value == null ? '—' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  const rate = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
  const duration = formatAnalysisDuration;
  const etaText = progress.eta != null ? duration(progress.eta) : t(`analysis.eta.${progress.etaState}`);
  const metric = (label, value) => <div><dt>{t(label)}</dt><dd>{value}</dd></div>;
  const downloads = <div className="review-file-actions">
    <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />}
      disabled={!state?.has_results} href={state?.has_results ? videoAnalysisDownloadUrl('results') : undefined}>{t('analysis.downloadResults')}</Button>
    <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />}
      disabled={!state?.has_statistics} href={state?.has_statistics ? videoAnalysisDownloadUrl('statistics') : undefined}>{t('analysis.downloadStatistics')}</Button>
  </div>;

  return <section className="review-execution ds-surface" aria-labelledby="qwen-execution-title">
    <div className="review-execution-heading">
      <h2 id="qwen-execution-title">{t('analysis.title')}</h2>
      <Tag className="ds-chip">{state?.model || 'Qwen'}</Tag>
      <label className="review-concurrency" htmlFor="qwen-concurrency">
        <span>{t('analysis.concurrency')}</span>
        <Select id="qwen-concurrency" className="ds-filter-control" variant="borderless" value={concurrency}
          disabled={Boolean(state?.active) || starting} onChange={setConcurrency}
          options={CONCURRENCY_OPTIONS.map(value => ({ value, label: t('analysis.concurrencyOption', { count: value }) }))} />
      </label>
      <Button className="ds-button" data-variant="primary" icon={<PlayCircleOutlined />} loading={starting}
        disabled={Boolean(state?.active) || !state || error} onClick={start}>{t('analysis.start')}</Button>
    </div>
    <p className="review-help">{t('analysis.lead')}</p>
    <p className="review-help">{t('analysis.concurrencyHint')}</p>
    {error && <Alert className="ds-alert review-notice" data-variant="error" type="error" showIcon title={t('analysis.error')}
      action={<Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={() => setRefresh(value => value + 1)}>{t('analysis.refresh')}</Button>} />}
    {state && state.status !== 'idle' && <>
      <p role="status">{t(`analysis.status.${state.status}`, { defaultValue: state.status })}</p>
      <Progress percent={progress.percent} status={terminalFailure ? 'exception' : state.active ? 'active' : 'normal'} showInfo
        strokeColor={terminalFailure ? 'var(--status-error-text)' : 'var(--theme-primary)'} trailColor="var(--canvas)" />
      <p className="review-help">{t('analysis.progress', progress)} · {t('analysis.counts', progress)}</p>
      {state.active && state.status !== 'scoring' && <>
        <dl className="review-execution-stats review-execution-primary">
          {metric('analysis.speed', number(progress.speed))}
          {metric('analysis.remaining', number(progress.remaining))}
          {metric('analysis.eta', etaText)}
        </dl>
        <dl className="review-execution-stats">
          {metric('analysis.activeRequests', <Tooltip title={t('analysis.activeHint')}><span>{progress.stale ? '—' : state.active_requests ?? 0} / {state.concurrency}</span></Tooltip>)}
          {metric('analysis.apiAverage', summary?.request_elapsed_ms_avg == null ? '—' : `${number(summary.request_elapsed_ms_avg / 1000)} s`)}
          {metric('analysis.elapsedLabel', duration(state.elapsed_ms))}
          {metric('analysis.estimatedCompletion', progress.estimatedCompletion ? <RelativeTime value={progress.estimatedCompletion} mode="absolute" /> : etaText)}
        </dl>
        {progress.stale && <p className="review-help">{t('analysis.stale')}</p>}
      </>}
      {progress.terminal && <div className="review-execution-summary">
        <h3>{t('analysis.summary')}</h3>
        <dl className="review-execution-stats">
          {metric('analysis.elapsedLabel', duration(state.elapsed_ms))}
          {metric('analysis.finishedAt', state.finished_at ? <RelativeTime value={state.finished_at} mode="absolute" /> : '—')}
          {metric('analysis.averageSpeed', number(progress.averageSpeed))}
          {metric('analysis.apiAverage', summary?.request_elapsed_ms_avg == null ? '—' : `${number(summary.request_elapsed_ms_avg / 1000)} s`)}
          {metric('analysis.requests', number(summary?.request_attempt_count))}
          {metric('analysis.retries', number(summary?.retry_count))}
          {metric('analysis.totalTokens', number(summary?.reported_usage?.total_tokens))}
        </dl>
        {summary?.labels && <>
          <p className="review-help">{t('analysis.labelSummaryHint')}</p>
          <dl className="review-execution-stats">
            {metric('analysis.songCount', number(summary.labels.is_song?.['是'] ?? 0))}
            {metric('analysis.virtualSongs', number(summary.labels.virtual_singer_songs))}
            {metric('analysis.chineseVirtualSongs', number(summary.labels.chinese_virtual_singer_songs))}
            {metric('analysis.uncertainCount', number(summary.labels.uncertain_count))}
          </dl>
        </>}
        {downloads}
      </div>}
      {(progress.terminal || state.status === 'scoring') && <VideoAnalysisScore
        key={`${state.id}-${state.evaluation?.created_at ?? state.evaluation?.status}`} evaluation={state.evaluation}
        canScore={state.has_results && !state.active && !starting} onRescore={rescore} />}
      <Collapse ghost className="review-execution-details" items={[{ key: 'details', label: t('analysis.details'), children: <>
        <dl className="review-execution-stats">
          {metric('analysis.inputTokens', number(summary?.reported_usage?.prompt_tokens))}
          {metric('analysis.outputTokens', number(summary?.reported_usage?.completion_tokens))}
          {metric('analysis.totalTokens', number(summary?.reported_usage?.total_tokens))}
          {metric('analysis.tpm', progress.stale ? '—' : number(live?.tpm))}
          {metric('analysis.rpm', progress.stale ? '—' : number(live?.rpm))}
          {metric('analysis.retries', number(summary?.retry_count))}
          {metric('analysis.waitingRetries', progress.stale ? '—' : number(live?.waiting_retries))}
          {metric('analysis.failureRateLabel', rate(summary?.request_failure_rate))}
        </dl>
        {state.last_error && <p className="review-help">{t('analysis.lastError', { code: state.last_error.code })}</p>}
        {state.fatal_error && <p className="review-help">{t('analysis.lastError', { code: state.fatal_error.code })}</p>}
        {summary?.usage_missing_attempts?.total_tokens > 0 && <p className="review-help">{t('analysis.partialUsage')}</p>}
        {!progress.terminal && downloads}
      </> }]} />
    </>}
  </section>;
}
