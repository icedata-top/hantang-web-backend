import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { Tooltip, Typography } from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, ExportOutlined, PictureOutlined,
  PlayCircleOutlined, LikeOutlined, DollarOutlined, StarOutlined,
  ShareAltOutlined, CommentOutlined, MessageOutlined,
  InfoCircleOutlined, WarningOutlined, LoadingOutlined, ReloadOutlined,
} from '@ant-design/icons';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import { fetchVideoInfo, fetchVideoLatestMetrics } from '../../services/Video/video.api.js';
import { getBilibiliSubPartitionName } from '../../constants/bilibili/type.id.js';
import { formatNumber } from '../../utils/formatNumber.js';
import { formatVideoText } from './videoDetailFormat.js';
import { parseVideoIdentifier } from './videoIdentifier.js';
import VideoResult from './VideoResult.jsx';
import './VideoDetail.css';

const METRICS = [
  ['view', '播放', 'Views', PlayCircleOutlined],
  ['favorite', '收藏', 'Favorites', StarOutlined],
  ['like', '点赞', 'Likes', LikeOutlined],
  ['coin', '投币', 'Coins', DollarOutlined],
  ['share', '分享', 'Shares', ShareAltOutlined],
  ['reply', '评论', 'Comments', CommentOutlined],
  ['danmaku', '弹幕', 'Danmaku', MessageOutlined],
];

function useVideoRequest(aid, fetcher) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null });
    fetcher(aid, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'ready', data });
      },
      (error) => {
        if (!controller.signal.aborted) {
          setState({ status: Number(error.code) === 404 ? 'missing' : 'error', data: null });
        }
      },
    );
    return () => controller.abort();
  }, [aid, fetcher, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}

function MediaImage({ src, alt, className }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const safeSrc = /^https?:\/\//i.test(src ?? '') ? src.replace(/^http:\/\//i, 'https://') : null;
  if (!safeSrc || failedSrc === safeSrc) {
    return <span className={`${className} video-detail-image-fallback`} role="img" aria-label={alt}>
      <PictureOutlined />
    </span>;
  }
  return <img className={className} src={safeSrc} alt={alt} referrerPolicy="no-referrer"
    onError={() => setFailedSrc(safeSrc)} />;
}

function durationText(value) {
  if (value == null || value < 0) return null;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

function Notice({ kind = 'info', children, retry, t }) {
  return <div className="ds-alert video-detail-notice" data-variant={kind} role={kind === 'error' ? 'alert' : 'status'}>
    {kind === 'error' ? <WarningOutlined /> : <InfoCircleOutlined />}
    <span>{children}</span>
    {retry && <button type="button" className="ds-button" data-variant="secondary" onClick={retry}>
      <ReloadOutlined />{t('重试', 'Retry')}
    </button>}
  </div>;
}

export function VideoDetailView({ aid, info, latest }) {
  const { i18n } = useTranslation();
  const [downloadState, setDownloadState] = useState('idle');
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  if (info.status === 'missing') return <VideoResult reason="unavailable" />;
  const video = info.data;
  const uploader = video?.uploader;
  const uploaderId = /^[1-9]\d*$/.test(String(uploader?.userId ?? '')) ? uploader.userId : null;
  const title = formatVideoText(video?.title) || `${t('视频', 'Video')} av${aid}`;
  const description = formatVideoText(video?.description);
  const tags = [...new Set((video?.tags ?? []).map(formatVideoText).filter(Boolean))];
  const duration = durationText(video?.duration);
  const partialMetrics = latest.status === 'ready' && METRICS.some(([key]) => latest.data?.[key] == null);

  async function downloadCover() {
    if (downloadState === 'loading' || !/^https?:\/\//i.test(video?.pic ?? '')) return;
    setDownloadState('loading');
    try {
      const response = await fetch(video.pic.replace(/^http:\/\//i, 'https://'), { referrerPolicy: 'no-referrer' });
      if (!response.ok) throw new Error('Cover download failed');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Invalid cover image');
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[blob.type] || 'jpg';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `av${aid}-cover.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadState('idle');
    } catch {
      setDownloadState('error');
    }
  }

  return <main className="video-detail-page">
    <nav className="video-detail-breadcrumb" aria-label={t('面包屑', 'Breadcrumb')}>
      <Link className="ds-link" to="/videos"><ArrowLeftOutlined /> {t('歌曲', 'Songs')}</Link>
      <span aria-hidden="true">/</span><span>{t('视频详情', 'Video Details')}</span>
    </nav>

    {video && <header className="video-detail-header">
      <h1 id="video-detail-title" className={/^[【（《〈「『〔［｛〖]/u.test(title.trimStart()) ? 'video-detail-title--hanging' : undefined}>{title}</h1>
      <div className="video-detail-meta">
        <span className="ds-chip" data-variant="neutral">{getBilibiliSubPartitionName(video.typeId) || t('视频', 'Video')}</span>
        <span className="video-detail-published">
          <span className="ds-sr-only">{t('投稿时间', 'Published')}</span>
          <RelativeTime value={video.pubdate} mode="absolute-diff" />
        </span>
        <span className="video-detail-id" aria-label={t('AV号', 'AV ID')}>av{aid}</span>
        <span className="video-detail-id" aria-label={t('BV号', 'BV ID')}>{video.bvid || '—'}</span>
      </div>
    </header>}

    <div className="video-detail-content-grid">
      <div className="video-detail-cover-column">
        {info.status === 'loading' && <section className="video-detail-loading" aria-busy="true" role="status">
          <LoadingOutlined spin /><span>{t('正在加载视频信息…', 'Loading video information…')}</span>
        </section>}
        {info.status === 'error' && <Notice kind="error" retry={info.retry} t={t}>
          {t('视频信息加载失败，请稍后重试。', 'Could not load video information. Please try again.')}
        </Notice>}
        {video &&
          <figure className="video-detail-cover-wrap">
            <MediaImage className="video-detail-cover" src={video.pic} alt={t('视频封面', 'Video cover')} />
            {duration && <span className="video-detail-duration">{duration}</span>}
            <div className="video-detail-cover-overlay">
              <button type="button" className="video-detail-cover-action" onClick={downloadCover}
                disabled={!video.pic || downloadState === 'loading'}>
                {downloadState === 'loading' ? <LoadingOutlined spin /> : <DownloadOutlined />}
                <span>{downloadState === 'loading' ? t('下载中…', 'Downloading…') : t('下载封面', 'Download cover')}</span>
              </button>
              <a className="video-detail-cover-action" href={`https://www.bilibili.com/video/av${aid}`}
                target="_blank" rel="noopener noreferrer">
                <ExportOutlined /><span>{t('在哔哩哔哩观看', 'Watch on Bilibili')}</span>
              </a>
            </div>
          </figure>}
      </div>

      <aside className="video-detail-sidebar" aria-label={t('创作者与视频数据', 'Creator and video metrics')}>
        {video && <section className="ds-surface video-detail-creator" aria-labelledby="video-detail-creator-title">
          <h2 id="video-detail-creator-title">{t('投稿人', 'Contributor')}</h2>
          {uploaderId
            ? <ProducerInfo userId={uploaderId} showAvatar className="video-detail-producer" />
            : <p className="video-detail-caption">{t('账号资料暂缺', 'Account information unavailable')}</p>}
          {uploader?.officialTitle && <div className="video-detail-uploader-meta">
            <span className="ds-chip" data-variant="orange">{uploader.officialTitle}</span>
          </div>}
          {uploader?.sign && <Tooltip title={uploader.sign} trigger={['hover', 'focus']}>
            <Typography.Paragraph className="video-detail-creator-sign" tabIndex={0}
              ellipsis={{ rows: 1, suffix: '' }}>
              {uploader.sign}
            </Typography.Paragraph>
          </Tooltip>}
        </section>}

    <section className="ds-surface video-detail-metrics" aria-labelledby="video-detail-metrics-title" aria-busy={latest.status === 'loading'}>
      <div className="video-detail-section-header">
        <h2 id="video-detail-metrics-title">{t('最新数据', 'Latest Metrics')}</h2>
      </div>
      {latest.status === 'error' && <Notice kind="error" retry={latest.retry} t={t}>
        {t('最新数据加载失败，视频信息仍可查看。', 'Could not load the latest metrics. Video information is still available.')}
      </Notice>}
      {latest.status === 'missing' && <Notice t={t}>
        {t('该视频暂未收录数据快照。', 'No metrics snapshot has been collected for this video yet.')}
      </Notice>}
      {partialMetrics && <Notice t={t}>{t('部分指标暂缺，以「—」显示。', 'Some metrics are unavailable and shown as “—”.')}</Notice>}
      <dl className="video-detail-metric-list">
        {METRICS.map(([key, zh, en, Icon]) => {
          const value = latest.data?.[key];
          return <div key={key} className={`video-detail-metric-row${key === 'view' ? ' video-detail-metric-row--views' : ''}`}>
            <dt className="video-detail-metric-label"><Icon />{t(zh, en)}</dt>
            <dd className="video-detail-metric-value">{value == null ? '—' : formatNumber(value, 'comma')}</dd>
          </div>;
        })}
      </dl>
      <footer className="video-detail-snapshot-date">
        {latest.status === 'loading' ? <span role="status"><LoadingOutlined spin /> {t('正在加载…', 'Loading…')}</span>
          : latest.data?.recordDate && <time dateTime={latest.data.recordDate}>{t(`统计于 ${latest.data.recordDate} 凌晨`, `Recorded early on ${latest.data.recordDate}`)}</time>}
      </footer>
    </section>
      </aside>
    </div>

    {downloadState === 'error' && <Notice kind="error" retry={downloadCover} t={t}>
      {t('封面下载失败，请重试。', 'Could not download the cover. Please try again.')}
    </Notice>}

    {video && <section className="ds-surface video-detail-description-panel" aria-labelledby="video-detail-description-title">
        <h2 id="video-detail-description-title">{t('视频简介', 'Description')}</h2>
        <p className="video-detail-description">{description || t('暂无简介', 'No description available')}</p>
        {tags.length > 0 && <ul className="video-detail-tags" aria-label={t('标签', 'Tags')}>
          {tags.map((tag) => <li className="ds-chip" data-variant="neutral" key={tag}>{tag}</li>)}
        </ul>}
    </section>}
  </main>;
}

function VideoDetailPage({ aid }) {
  const info = useVideoRequest(aid, fetchVideoInfo);
  const latest = useVideoRequest(aid, fetchVideoLatestMetrics);
  return <VideoDetailView aid={aid} info={info} latest={latest} />;
}

export default function VideoDetail() {
  const { aid: identifier } = useParams();
  const { search, hash } = useLocation();
  const resolved = parseVideoIdentifier(identifier);
  if (resolved.status !== 'valid') return <VideoResult reason={resolved.status} />;
  const { aid } = resolved;
  if (identifier !== aid) {
    return <Navigate to={{ pathname: `/videos/${aid}`, search, hash }} replace />;
  }
  return <VideoDetailPage key={aid} aid={aid} />;
}
