import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Skeleton, Tag } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DatabaseOutlined, ExperimentOutlined, ReloadOutlined, ScheduleOutlined, TagsOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { fetchProcessingStatus } from '../../services/Admin/processing.api.js';
import { isMockEnv } from '../../config/runtimeEnv.js';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { formatNumber } from '../../utils/formatNumber.js';
import { PROCESSING_SOURCES, PROCESSING_TODOS, processingJobMode, processingRunHealth, processingRunLabel } from './processingModel.js';
import './DataProcessing.css';

function useProcessingSource(source, refresh) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: false });
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: false }));
    fetchProcessingStatus(source, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ loading: false, data, error: false });
    }).catch(() => { if (!controller.signal.aborted) setState({ loading: false, data: null, error: true }); });
    return () => controller.abort();
  }, [source, refresh, retry]);
  return { ...state, retry: () => setRetry(value => value + 1) };
}

function Health({ health, children }) {
  const Icon = health === 'healthy' ? CheckCircleOutlined : health === 'loading' || health === 'todo' ? ClockCircleOutlined : WarningOutlined;
  return <Tag className="ds-chip ds-status-tag" data-health={health}><Icon />{children}</Tag>;
}

function Notes({ notes = [] }) {
  const { t } = useTranslation();
  return <>{notes.map(note => <p className="processing-note" key={note} data-warning={note !== 'cron_scope'}>{t(`processing.note.${note}`)}</p>)}</>;
}

function Failed({ retry }) {
  const { t } = useTranslation();
  return <div className="processing-error" role="status"><p>{t('processing.loadError')}</p>
    <Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={retry}>{t('重试')}</Button></div>;
}

function ProcessingResult({ source, refresh }) {
  const { t } = useTranslation();
  const state = useProcessingSource(source, refresh);
  const { data, loading, error } = state;
  const snapshot = data?.snapshot;
  const health = loading ? 'loading' : error ? 'unavailable' : data.health;
  const status = loading ? 'loading' : error ? 'loadFailed' : data.status;
  const count = value => value == null ? '—' : formatNumber(value, 'comma');
  return <Card className="ds-surface processing-card" variant="borderless" aria-busy={loading} aria-labelledby={`processing-${source}`}>
    <div className="processing-card-heading"><h2 id={`processing-${source}`}><DatabaseOutlined />{t(`processing.title.${source}`)}</h2>
      <Health health={health}>{t(`processing.status.${status}`)}</Health></div>
    <p className="processing-description">{t(`processing.description.${source}`)}</p>
    {data ? <p className="processing-badges"><Tag className="ds-chip">{data.engine}</Tag><Tag className="ds-chip">{t(`processing.mode.${data.mode}`)}</Tag></p> : null}
    {loading && !data ? <Skeleton active title={false} paragraph={{ rows: 4 }} /> : null}
    {error ? <Failed retry={state.retry} /> : null}
    {snapshot ? <>
      <dl className="processing-statistics">
        <div><dt>{t(snapshot.rows != null ? 'processing.resultRows' : 'collection.estimatedRows')}</dt><dd>{count(snapshot.rows ?? snapshot.estimatedRows)}</dd></div>
        {snapshot.dataDate ? <div><dt>{t('processing.resultDate')}</dt><dd className="processing-date">{snapshot.dataDate}</dd></div> : null}
      </dl>
      {snapshot.updatedAt ? <p className="processing-time"><span>{t('processing.publishedAt')}</span><RelativeTime value={snapshot.updatedAt} mode="absolute" /></p> : null}
      {data.publication?.pending ? <p className="processing-note" data-warning="true">{t('processing.pendingPublication', { value0: data.publication.requestedDate ?? '—' })}</p> : null}
      {data.task ? <div className="processing-task">
        <h3>{t('processing.latestTask')}</h3>
        <p>{data.task.date} · {t(`processing.task.${data.task.status}`)} · {t('processing.attempts', { value0: data.task.attempts ?? '—', value1: data.task.maxAttempts ?? '—' })}</p>
        {data.task.updatedAt ? <RelativeTime value={data.task.updatedAt} mode="absolute" /> : null}
      </div> : null}
      <Notes notes={data.notes} />
      {data.expectedJob ? <div className="processing-definition"><span>{t('processing.repositorySchedule')}</span><code>{data.expectedJob}</code><code>{data.expectedSchedule}</code></div> : null}
      <footer className="processing-card-footer"><code>{snapshot.table}</code><span>{t('collection.checkedAt')} <RelativeTime key={data.checkedAt} value={data.checkedAt} /></span></footer>
    </> : null}
  </Card>;
}

function Scheduler({ refresh }) {
  const { t } = useTranslation();
  const state = useProcessingSource('scheduler', refresh);
  const { data, loading, error } = state;
  return <Card className="ds-surface processing-card processing-scheduler" variant="borderless" aria-busy={loading} aria-labelledby="processing-scheduler-title">
    <div className="processing-card-heading"><h2 id="processing-scheduler-title"><ScheduleOutlined />{t('processing.scheduler')}</h2>
      <Health health={loading ? 'loading' : error ? 'unavailable' : data.health}>{t(!loading && !error && data.status === 'ready'
        ? 'processing.schedulerReady' : `processing.status.${loading ? 'loading' : error ? 'loadFailed' : data.status}`)}</Health></div>
    <p className="processing-description">{t('processing.schedulerDescription')}</p>
    {loading && !data ? <Skeleton active title={false} paragraph={{ rows: 3 }} /> : null}
    {error ? <Failed retry={state.retry} /> : null}
    {data ? <>
      <Notes notes={data.notes} />
      {data.jobs.length ? <div className="processing-job-list">{data.jobs.map(job => <article className="processing-job" key={job.id}>
        <div className="processing-job-heading"><code>{job.name || `#${job.id}`}</code><Health health={processingRunHealth(job)}>
          {t(`processing.${processingRunLabel(job)}`)}</Health></div>
        <div className="processing-job-meta"><code>{job.schedule}</code><span>{t(`processing.mode.${processingJobMode(job.name, data.expectedJobs)}`)}</span><span>#{job.id}</span></div>
        {job.startedAt ? <p className="processing-time"><span>{t('processing.startedAt')}</span><RelativeTime value={job.startedAt} mode="absolute" /></p> : null}
        {job.finishedAt ? <p className="processing-time"><span>{t('processing.finishedAt')}</span><RelativeTime value={job.finishedAt} mode="absolute" /></p> : null}
      </article>)}</div> : data.availability === 'available' ? <p className="processing-note">{t('processing.noVisibleJobs')}</p> : null}
      <h3 className="processing-expected-title">{t('processing.expectedJobs')}</h3>
      <p className="processing-note">{t('processing.expectedNote')}</p>
      <div className="processing-expected">{data.expectedJobs.map(job => <div key={job.source}>
        <strong>{t(`processing.title.${job.source}`)}</strong><code>{job.name}</code><span><code>{job.schedule}</code> · {t(`processing.mode.${job.mode}`)}</span>
      </div>)}</div>
      <footer className="processing-card-footer"><span>{t('collection.checkedAt')} <RelativeTime key={data.checkedAt} value={data.checkedAt} /></span></footer>
    </> : null}
  </Card>;
}

function Planned({ id }) {
  const { t } = useTranslation();
  const Icon = id === 'videoLabels' ? TagsOutlined : TeamOutlined;
  return <Card className="ds-surface processing-card processing-planned" variant="borderless" aria-labelledby={`processing-${id}`}>
    <div className="processing-card-heading"><h2 id={`processing-${id}`}><Icon />{t(`processing.title.${id}`)}</h2><Health health="todo">TODO</Health></div>
    <p className="processing-description">{t('processing.todo')}</p>
    <p className="processing-plan-flow">{t(`processing.flow.${id}`)}</p>
    <ul className="processing-plan-points">{[1, 2, 3].map(index => <li key={index}>{t(`processing.${id}.${index}`)}</li>)}</ul>
    <p className="processing-note">{t(`processing.plan.${id}`)}</p>
  </Card>;
}

export default function DataProcessing() {
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  return <main className="admin-page processing-page">
    <header className="processing-page-heading"><div><p className="processing-breadcrumb">{t('数据中心')}</p><h1>{t('数据处理')}</h1><p className="admin-lead">{t('processing.lead')}</p></div>
      <Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={() => setRefresh(value => value + 1)}>{t('collection.refresh')}</Button></header>
    <p className="processing-scope">{t('processing.scope')}</p>
    {isMockEnv() ? <Alert className="ds-alert processing-mock" type="info" showIcon title={t('processing.mock')} /> : null}
    <div className="processing-grid">{PROCESSING_SOURCES.filter(source => source !== 'scheduler').map(source => <ProcessingResult key={source} source={source} refresh={refresh} />)}
      <Scheduler refresh={refresh} />
      {PROCESSING_TODOS.map(id => <Planned key={id} id={id} />)}</div>
    <p className="processing-future"><ExperimentOutlined /> {t('processing.future')}</p>
    <p className="processing-cache">{t('collection.cache')}</p>
  </main>;
}
