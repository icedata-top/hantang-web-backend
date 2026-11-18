import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Progress, Tag } from 'antd';
import { DownloadOutlined, PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchVideoAnalysis, fetchVideoAnalysisFile, startVideoAnalysis } from '../../services/Admin/videoAnalysis.api.js';

export default function VideoAnalysisPanel() {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [error, setError] = useState(false);
  const [starting, setStarting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer;
    let controller;
    async function poll() {
      controller = new AbortController();
      let active = false;
      try {
        const data = await fetchVideoAnalysis({ signal: controller.signal });
        active = Boolean(data.active);
        if (alive) { setState(data); setError(false); }
      } catch { if (alive) setError(true); }
      if (alive && active) timer = setTimeout(poll, 1000);
    }
    poll();
    return () => { alive = false; clearTimeout(timer); controller?.abort(); };
  }, [refresh]);

  async function start() {
    setStarting(true);
    try { setState(await startVideoAnalysis()); setError(false); setRefresh(value => value + 1); }
    catch { setError(true); }
    finally { setStarting(false); }
  }

  async function download(file) {
    setDownloading(true);
    try {
      const data = await fetchVideoAnalysisFile(file);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = `qwen-${state.id}-${file}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch { setError(true); }
    finally { setDownloading(false); }
  }

  const summary = state?.summary;
  const total = state?.selected_count ?? 1000;
  const succeeded = summary?.succeeded_count ?? 0;
  const failed = summary?.failed_count ?? 0;
  const percent = total ? Math.round((succeeded + failed) / total * 100) : 0;
  const terminalFailure = ['failed', 'completed_with_failures', 'interrupted'].includes(state?.status);
  const elapsed = state?.elapsed_ms == null ? '—' : `${(state.elapsed_ms / 1000).toFixed(1)} s`;
  const tokens = summary?.reported_usage?.total_tokens;
  return <section className="review-execution ds-surface" aria-labelledby="qwen-execution-title">
    <div className="review-execution-heading">
      <h2 id="qwen-execution-title">{t('analysis.title')}</h2>
      <Tag className="ds-chip">{state?.model || 'Qwen'}</Tag>
      <Button className="ds-button" data-variant="primary" icon={<PlayCircleOutlined />} loading={starting}
        disabled={Boolean(state?.active) || !state || error} onClick={start}>{t('analysis.start')}</Button>
    </div>
    <p className="review-help">{t('analysis.lead')}</p>
    {error && <Alert className="ds-alert review-notice" data-variant="error" type="error" showIcon title={t('analysis.error')}
      action={<Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={() => setRefresh(value => value + 1)}>{t('analysis.refresh')}</Button>} />}
    {state && state.status !== 'idle' && <>
      <p role="status">{t(`analysis.status.${state.status}`, { defaultValue: state.status })}
        {state.active && state.batch_index ? ` · ${t('analysis.batch', { current: state.batch_index, total: state.total_batches, attempt: state.attempt })}` : ''}</p>
      <Progress percent={percent} status={terminalFailure ? 'exception' : state.active ? 'active' : 'normal'} showInfo
        strokeColor={terminalFailure ? 'var(--status-error-text)' : 'var(--theme-primary)'} trailColor="var(--canvas)" />
      <div className="review-execution-metrics">
        <span>{t('analysis.counts', { succeeded, failed, total })}</span>
        <span>{t('analysis.elapsed', { value: elapsed })}</span>
        <span>{t('analysis.tokens', { value: tokens == null ? '—' : tokens.toLocaleString() })}</span>
        <span>{t('analysis.failureRate', { value: summary?.request_failure_rate == null ? '—' : `${(summary.request_failure_rate * 100).toFixed(1)}%` })}</span>
      </div>
      {state.last_error && <p className="review-help">{t('analysis.lastError', { code: state.last_error.code })}</p>}
      {summary?.usage_missing_attempts?.total_tokens > 0 && <p className="review-help">{t('analysis.partialUsage')}</p>}
      <div className="review-file-actions">
        <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />} disabled={!state.has_results || downloading} onClick={() => download('results')}>{t('analysis.downloadResults')}</Button>
        <Button className="ds-button" data-variant="secondary" icon={<DownloadOutlined />} disabled={!state.has_statistics || downloading} onClick={() => download('statistics')}>{t('analysis.downloadStatistics')}</Button>
      </div>
    </>}
  </section>;
}
