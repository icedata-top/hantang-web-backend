import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Result } from 'antd';
import { ArrowLeftOutlined, ExportOutlined, LoadingOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { fetchProducerInfo, fetchProducerVideos } from '../../services/Producer/producer.api.js';
import { formatVideoText } from '../video/videoDetailFormat.js';
import { formatNumber } from '../../utils/formatNumber.js';
import ProducerVideos from './ProducerVideos.jsx';
import './ProducerDetail.css';

const DEFAULT_QUERY = { sortBy: 'pubdate', order: 'desc', role: 'uploader', page: 1, pageSize: 20 };

function useProducerRequest(userId, query) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, status: 'loading', data: null });
  const key = JSON.stringify([userId, query, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, status: 'loading', data: null });
    const request = query
      ? fetchProducerVideos(userId, query, { signal: controller.signal })
      : fetchProducerInfo(userId, { signal: controller.signal });
    request.then(
      (data) => { if (!controller.signal.aborted) setState({ key, status: 'ready', data }); },
      (error) => {
        if (!controller.signal.aborted) setState({ key, status: Number(error.code) === 404 ? 'missing' : 'error', data: null });
      },
    );
    return () => controller.abort();
  }, [userId, query, attempt, key]);
  return { ...(state.key === key ? state : { status: 'loading', data: null }), retry: () => setAttempt((value) => value + 1) };
}

function ProducerAvatar({ src, name }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const safeSrc = /^https?:\/\//i.test(src ?? '') ? src.replace(/^http:\/\//i, 'https://') : null;
  return safeSrc && failedSrc !== safeSrc
    ? <img className="producer-detail-avatar" src={safeSrc} alt={name} referrerPolicy="no-referrer" onError={() => setFailedSrc(safeSrc)} />
    : <span className="producer-detail-avatar producer-detail-avatar--fallback" role="img" aria-label={name}><UserOutlined /></span>;
}

function ProducerDetailPage({ userId }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [viewMode, setViewMode] = useState('cards');
  const info = useProducerRequest(userId);
  const videos = useProducerRequest(userId, query);
  const producer = info.data;
  const name = producer?.name || t(`创作者 ${userId}`, `Producer ${userId}`);
  const total = videos.data?.total ?? 0;

  useEffect(() => {
    if (videos.status !== 'ready') return;
    const lastPage = Math.max(1, Math.ceil(total / query.pageSize));
    if (query.page > lastPage) setQuery((current) => ({ ...current, page: lastPage }));
  }, [videos.status, total, query.page, query.pageSize]);

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-GB', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }), [isZh]);
  function dateText(value, seconds = false) {
    if (value == null) return '—';
    const date = new Date(seconds ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date);
  }
  function updateQuery(next) { setQuery((current) => ({ ...current, ...next, page: 1 })); }

  return <main className="producer-detail-page">
    <header className="producer-detail-header">
      <nav className="producer-detail-breadcrumb" aria-label={t('面包屑', 'Breadcrumb')}>
        <Link className="ds-link" to="/producers"><ArrowLeftOutlined /> {t('创作者', 'Producers')}</Link>
        <span aria-hidden="true">/</span><span>{t('创作者详情', 'Producer Details')}</span>
      </nav>
      {producer?.lastUpdated && <time className="producer-detail-updated" dateTime={producer.lastUpdated}>{t('资料更新于 ', 'Updated ')}{dateText(producer.lastUpdated)}</time>}
    </header>

    <section className="ds-surface producer-detail-profile" aria-labelledby="producer-detail-name" aria-busy={info.status === 'loading'}>
      <ProducerAvatar src={producer?.face} name={name} />
      <div className="producer-detail-account">
        <h1 id="producer-detail-name">{name}</h1>
        <div className="producer-detail-meta">
          <span className="producer-detail-id">UID {userId}</span>
          {producer?.level != null && <span className="ds-chip" data-variant="neutral">Lv.{producer.level}</span>}
          {producer?.officialTitle && <span className="ds-chip" data-variant="orange">{producer.officialTitle}</span>}
        </div>
        {producer && <p className="producer-detail-sign">{formatVideoText(producer.sign) || t('暂无个人简介', 'No bio available')}</p>}
        {info.status === 'loading' && <p className="producer-detail-caption" role="status"><LoadingOutlined spin /> {t('正在加载创作者资料…', 'Loading producer information…')}</p>}
        {info.status === 'missing' && <p className="producer-detail-caption">{t('该创作者的账号资料暂未收录，仍可查看下方已关联的投稿。', 'Account information has not been indexed. Associated videos are still listed below.')}</p>}
        {info.status === 'error' && <div className="ds-alert producer-detail-error" data-variant="error" role="alert">
          <span>{t('创作者资料加载失败', 'Could not load producer information')}</span>
          <button className="ds-button" data-variant="secondary" type="button" onClick={info.retry}><ReloadOutlined />{t('重试', 'Retry')}</button>
        </div>}
      </div>
      <div className="producer-detail-summary">
        <span className="producer-detail-caption">{t('粉丝', 'Followers')}</span>
        <strong>{producer?.fans == null ? '—' : formatNumber(producer.fans, 'comma')}</strong>
        <a className="ds-link" href={`https://space.bilibili.com/${userId}`} target="_blank" rel="noopener noreferrer">{t('哔哩哔哩主页', 'Bilibili profile')} <ExportOutlined /></a>
      </div>
    </section>

    <ProducerVideos videos={videos} query={query} viewMode={viewMode} onViewModeChange={setViewMode}
      onQueryChange={updateQuery} onPageChange={(page) => setQuery((current) => ({ ...current, page }))} />
  </main>;
}

export default function ProducerDetail() {
  const { userId } = useParams();
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  if (!/^[1-9]\d*$/.test(userId ?? '') || userId.length > 19 || (userId.length === 19 && userId > '9223372036854775807')) {
    return <main className="page-result"><Result status="warning" title={isZh ? '创作者ID不合法' : 'Invalid producer ID'}
      subTitle={isZh ? '请输入不带前导零的正整数用户ID。' : 'Enter a positive numeric user ID without leading zeros.'}
      extra={<Link className="ds-button" data-variant="primary" to="/">{isZh ? '返回首页' : 'Back to Home'}</Link>} /></main>;
  }
  return <ProducerDetailPage key={userId} userId={userId} />;
}
