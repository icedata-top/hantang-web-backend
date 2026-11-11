import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Skeleton, Spin, Tag, Tooltip } from 'antd';
import { CalendarOutlined, CheckCircleOutlined, DatabaseOutlined, FlagOutlined, MinusCircleOutlined, ReloadOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import { isMockEnv } from '../../config/runtimeEnv.js';
import { fetchCollectionStatus } from '../../services/Admin/collection.api.js';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { formatNumber } from '../../utils/formatNumber.js';
import { getLanguageSettings } from '../../locales/languages.js';
import { COLLECTION_SOURCES, summarizeCollectionDays } from './collectionModel.js';
import './DataCollection.css';

const ICONS = { daily: CalendarOutlined, videos: DatabaseOutlined, crossings: FlagOutlined, accounts: TeamOutlined };

function DailyRecords({ days }) {
  const { t, i18n } = useTranslation();
  const { numberFormat } = getLanguageSettings(i18n.resolvedLanguage || i18n.language);
  return <div className="collection-days" role="group" aria-label={t('collection.daysChart')} tabIndex={0}>
    {days.map(day => <div key={day.date} className="collection-day" data-present={day.hasData}>
      <time dateTime={day.date}>{day.date.slice(5)}</time>
      <span className="collection-day-bar" aria-hidden="true" />
      <span className="collection-day-presence">
        {day.hasData ? <CheckCircleOutlined /> : <MinusCircleOutlined />}
        {t(day.hasData ? 'collection.present' : 'collection.missing')}
      </span>
      <Tooltip title={day.rows == null ? t('collection.countMissing') : formatNumber(day.rows, 'comma')}>
        <span className="collection-day-count" tabIndex={0}>{day.rows == null ? '—' : formatNumber(day.rows, numberFormat)}</span>
      </Tooltip>
    </div>)}
  </div>;
}

function CollectionCard({ source, refresh }) {
  const { t } = useTranslation();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: false });
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: false }));
    fetchCollectionStatus(source, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ loading: false, data, error: false });
    }).catch(() => {
      if (!controller.signal.aborted) setState({ loading: false, data: null, error: true });
    });
    return () => controller.abort();
  }, [source, refresh, retry]);

  const { data, loading, error } = state;
  const Icon = ICONS[source];
  const summary = summarizeCollectionDays(data?.days);
  const health = loading ? 'loading' : error ? 'unavailable' : data?.health;
  const count = value => value == null ? '—' : formatNumber(value, 'comma');
  return <Card className={`ds-surface collection-card collection-card--${source}`} variant="borderless"
    aria-labelledby={`collection-title-${source}`} aria-busy={loading}>
    <div className="collection-card-heading">
      <h2 id={`collection-title-${source}`}><Icon />{t(`collection.${source}`)}</h2>
      <Tag className="ds-chip ds-status-tag" data-health={health}>
        {loading ? <Spin size="small" /> : health === 'healthy' ? <CheckCircleOutlined /> : <WarningOutlined />}
        {t(`collection.health.${health}`)}
      </Tag>
    </div>
    <p className="collection-description">{t(`collection.description.${source}`)}</p>
    <p className="collection-pipeline">{source === 'daily' ? 'Bilibili → MySQL → PostgreSQL' : 'Bilibili → PostgreSQL'}</p>
    {loading && !data ? <Skeleton active paragraph={{ rows: source === 'daily' ? 4 : 3 }} title={false} /> : null}
    {error ? <div className="collection-error" role="status">
      <p>{t('collection.loadError')}</p>
      <Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={() => setRetry(value => value + 1)}>{t('重试')}</Button>
    </div> : null}
    {data ? <>
      <dl className="collection-statistics">
        {source === 'daily' ? <>
          <div><dt>{t('collection.covered')}</dt><dd>{summary.covered}<small> / 7</small></dd></div>
          <div><dt>{t('collection.periodRows')}</dt><dd>{count(summary.rows)}</dd></div>
          <div><dt>{t('collection.latestDate')}</dt><dd className="collection-stat-date">{data.latestRecordDate ?? '—'}</dd></div>
        </> : <>
          <div><dt>{t('collection.estimatedRows')}</dt><dd>{count(data.estimatedRows)}</dd></div>
          {data.fanRows != null ? <div><dt>{t('collection.fanRows')}</dt><dd>{count(data.fanRows)}</dd></div> : null}
        </>}
      </dl>
      {source === 'daily' ? <>
        <p className="collection-window">{t('collection.window', { value0: data.startDate, value1: data.endDate })}</p>
        <DailyRecords days={data.days} />
      </> : <p className="collection-note">{t(source === 'crossings' ? 'collection.crossingNote' : 'collection.estimateNote')}</p>}
      {data.latestAt ? <div className="collection-time"><span>{t(data.timeKind === 'ingested' ? 'collection.ingested' : 'collection.updated')}</span>
        <RelativeTime value={data.latestAt} mode="absolute" />
      </div> : null}
      {data.partial ? <p className="collection-partial" role="status"><WarningOutlined /> {t('collection.partial')}</p> : null}
      <div className="collection-card-footer">
        <code>{data.table}</code>
        <span>{t('collection.checkedAt')} <RelativeTime key={data.checkedAt} value={data.checkedAt} /></span>
      </div>
    </> : null}
  </Card>;
}

export default function DataCollection() {
  const { t } = useTranslation();
  const [refresh, setRefresh] = useState(0);
  return <main className="admin-page collection-page">
    <div className="collection-page-heading">
      <div><p className="collection-breadcrumb">{t('数据中心')}</p><h1>{t('数据采集')}</h1><p className="admin-lead">{t('collection.lead')}</p></div>
      <Button className="ds-button" data-variant="secondary" icon={<ReloadOutlined />} onClick={() => setRefresh(value => value + 1)}>{t('collection.refresh')}</Button>
    </div>
    <p className="collection-scope">{t('collection.scope')}</p>
    {isMockEnv() ? <Alert className="ds-alert collection-mock" type="info" showIcon title={t('collection.mock')} /> : null}
    <div className="collection-grid">{COLLECTION_SOURCES.map(source => <CollectionCard key={source} source={source} refresh={refresh} />)}</div>
    <p className="collection-cache-note">{t('collection.cache')}</p>
  </main>;
}
