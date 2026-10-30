import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { Result, Segmented, Tooltip } from 'antd';
import { ArrowLeftOutlined, ExportOutlined, LoadingOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { DsPagination, DsTable } from '../../components/design-system/DataDisplay.jsx';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { fetchProducerInfo, fetchProducerVideos } from '../../services/Producer/producer.api.js';
import { formatVideoText } from '../video/videoDetailFormat.js';
import { formatNumber } from '../../utils/formatNumber.js';
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
  const columns = [
    { key: 'title', title: t('视频', 'Video'), render: (value, row) => {
      const title = formatVideoText(value) || `av${row.aid}`;
      const hanging = /^[【（《〈「『〔［｛〖]/u.test(title.trimStart());
      return <div className={`producer-video-title${hanging ? ' producer-video-title--hanging' : ''}`}>
        <Link className="ds-link" to={`/videos/${row.aid}`} title={title}>{title}</Link>
        <span className="producer-detail-caption">av{row.aid}</span>
      </div>;
    } },
    { key: 'userId', title: t('投稿人', 'Contributor'), width: 200, render: (value) => value ? <ProducerInfo userId={value} showAvatar={query.role === 'staff'} /> : '—' },
    { key: 'view', title: t('播放量', 'Views'), width: 130, align: 'right', sortable: true, render: (value, row) => <Tooltip title={row.recordDate ? t(`统计日期：${row.recordDate}`, `Recorded on ${row.recordDate}`) : t('暂无日快照', 'No daily snapshot')}>
      <span>{value == null ? '—' : formatNumber(value, 'comma')}</span>
    </Tooltip> },
    { key: 'pubdate', title: t('投稿时间', 'Published'), width: 160, sortable: true, render: (value) => <RelativeTime value={value} /> },
  ];

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

    <section className="ds-surface producer-detail-videos" aria-labelledby="producer-detail-videos-title">
      <div className="producer-detail-toolbar">
        <h2 id="producer-detail-videos-title">{t('投稿', 'Videos')}</h2>
        <Segmented className="ds-segmented producer-detail-role" aria-label={t('作者身份', 'Author role')} value={query.role} onChange={(role) => updateQuery({ role })}
          options={[{ value: 'uploader', label: t('第一作者', 'Primary Author') }, { value: 'staff', label: t('参与作者', 'Contributing Author') }]} />
        <div className="producer-detail-sort">
          <div className="producer-detail-sort-field"><span>{t('排序', 'Sort by')}</span><Segmented
            aria-label={t('排序依据', 'Sort by')} value={query.sortBy} onChange={(sortBy) => updateQuery({ sortBy })}
            options={[{ value: 'pubdate', label: t('投稿时间', 'Published') }, { value: 'view', label: t('播放量', 'Views') }]} /></div>
          <Segmented aria-label={t('排序方向', 'Sort order')} value={query.order} onChange={(order) => updateQuery({ order })}
            options={[{ value: 'desc', label: t('降序 ↓', 'Descending ↓') }, { value: 'asc', label: t('升序 ↑', 'Ascending ↑') }]} />
        </div>
      </div>
      <p className="producer-detail-list-hint">{t('仅展示冰数据已收录的投稿。播放量为各视频最新一次收录的累计值。', 'Only videos indexed by icedata are shown. Views are the latest collected cumulative totals for each video.')}</p>
      {videos.status === 'error' || videos.status === 'missing' ? <div className="ds-alert producer-detail-error" data-variant="error" role="alert">
        <span>{t('投稿列表加载失败，请稍后重试。', 'Could not load videos. Please try again.')}</span>
        <button className="ds-button" type="button" data-variant="secondary" onClick={videos.retry}><ReloadOutlined />{t('重试', 'Retry')}</button>
      </div> : <DsTable columns={columns} rows={(videos.data?.rows ?? []).map((row) => ({ ...row, id: row.aid }))}
        caption={t('创作者投稿列表', 'Producer videos')} loading={videos.status === 'loading'} sortKey={query.sortBy} sortDirection={query.order}
        onSort={(sortBy, order) => updateQuery({ sortBy, order })}
        emptyText={query.role === 'staff' ? t('暂无收录的参与投稿', 'No indexed contributions') : t('暂无收录的第一作者投稿', 'No indexed primary-author videos')} />}
      <div className="producer-detail-pagination"><DsPagination current={query.page} pageSize={query.pageSize} total={total}
        disabled={videos.status !== 'ready'} pageSizeOptions={[10, 20, 50, 100]}
        onChange={(page) => setQuery((current) => ({ ...current, page }))} onPageSizeChange={(pageSize) => updateQuery({ pageSize })} /></div>
    </section>
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
