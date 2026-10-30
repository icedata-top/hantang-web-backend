import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Popover } from 'antd';
import { ExportOutlined, LoadingOutlined, PictureOutlined, ReloadOutlined } from '@ant-design/icons';
import { fetchVideoInfo } from '../../../services/Video/video.api.js';
import { getBilibiliSubPartitionName } from '../../../constants/bilibili/type.id.js';
import { formatVideoText } from '../../../pages/video/videoDetailFormat.js';
import RelativeTime from '../RelativeTime/RelativeTime.jsx';
import { formatVideoDuration, hasHangingOpeningPunctuation, normalizeVideoAid } from './videoInfo.js';
import './VideoInfo.css';

function VideoCover({ src, alt }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const safeSrc = /^https?:\/\//i.test(src ?? '') ? src.replace(/^http:\/\//i, 'https://') : null;
  return safeSrc && failedSrc !== safeSrc
    ? <img className="video-info-cover" src={safeSrc} alt={alt} referrerPolicy="no-referrer" onError={() => setFailedSrc(safeSrc)} />
    : <div className="video-info-cover video-info-cover--fallback" role="img" aria-label={alt}><PictureOutlined /></div>;
}

function VideoInfoContent({ aid, hangingPunctuation, className }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null });
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const focusCardOnOpen = useRef(false);
  const cardId = useId();
  const titleId = `${cardId}-title`;

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null });
    fetchVideoInfo(aid, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: data ? 'ready' : 'missing', data });
      },
      (error) => {
        if (!controller.signal.aborted) setState({ status: Number(error.code) === 404 ? 'missing' : 'error', data: null });
      },
    );
    return () => controller.abort();
  }, [aid, attempt]);

  const video = state.data;
  const title = formatVideoText(video?.title).trim() || `av${aid}`;
  const description = formatVideoText(video?.description).trim();
  const hanging = hangingPunctuation && hasHangingOpeningPunctuation(title);
  const duration = formatVideoDuration(video?.duration);
  const uploader = video?.uploader;
  const uploaderName = uploader?.name?.trim() || (uploader?.userId != null ? `UID ${uploader.userId}` : '—');

  function closeCard() {
    focusCardOnOpen.current = false;
    setOpen(false);
  }

  function onOpenChange(nextOpen) {
    // Keep interactive content available while keyboard focus is inside the card.
    if (!nextOpen && cardRef.current?.contains(document.activeElement)) return;
    if (!nextOpen) focusCardOnOpen.current = false;
    setOpen(nextOpen);
  }

  function onBlur(event) {
    const next = event.relatedTarget;
    if (!triggerRef.current?.contains(next) && !cardRef.current?.contains(next)) closeCard();
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.focus();
    closeCard();
  }

  function focusFirstAction() {
    const action = cardRef.current?.querySelector('button, a');
    if (!action || action.getClientRects().length === 0) return;
    action.focus();
    focusCardOnOpen.current = false;
  }

  const card = <div className="video-info-card" id={cardId} ref={cardRef} role="dialog"
    aria-labelledby={titleId} onBlur={onBlur} onKeyDown={onKeyDown}>
    {state.status === 'ready' && <div className="video-info-cover-wrap">
      <VideoCover src={video.pic} alt={t(`${title} 的封面`, `Cover for ${title}`)} />
      {duration != null && <span className="video-info-duration">{duration}</span>}
    </div>}
    <div className="video-info-card-content">
      <strong id={titleId} className={`video-info-card-title${hanging ? ' video-info-card-title--hanging' : ''}`}>{title}</strong>
      <div className="video-info-identifiers"><span>av{aid}</span>{video?.bvid && <span>{video.bvid}</span>}</div>
      {state.status === 'ready' && <>
        <dl className="video-info-metadata">
          <div><dt>{t('投稿人', 'Contributor')}</dt><dd>{uploaderName}</dd></div>
          <div><dt>{t('投稿时间', 'Published')}</dt><dd><RelativeTime value={video.pubdate} mode="absolute" /></dd></div>
          <div><dt>{t('分区', 'Category')}</dt><dd>{getBilibiliSubPartitionName(video.typeId) || '—'}</dd></div>
        </dl>
        <p className="video-info-description">{description || t('暂无简介', 'No description available')}</p>
      </>}
      {state.status === 'loading' && <p className="video-info-status" role="status"><LoadingOutlined spin /> {t('正在加载视频资料…', 'Loading video information…')}</p>}
      {state.status === 'missing' && <p className="video-info-status" role="status">{t('暂未收录该视频的资料', 'This video’s information has not been indexed')}</p>}
      {state.status === 'error' && <div className="video-info-status" role="alert">
        <span>{t('视频资料加载失败', 'Could not load video information')}</span>
        <button type="button" className="ds-button" data-variant="normal" onClick={() => setAttempt((value) => value + 1)}><ReloadOutlined />{t('重试', 'Retry')}</button>
      </div>}
      <div className="video-info-actions">
        <a className="ds-button" data-variant="secondary" href={`https://www.bilibili.com/video/av${aid}`} target="_blank" rel="noopener noreferrer">{t('访问 Bilibili', 'Visit Bilibili')} <ExportOutlined /></a>
        <Link className="ds-button" data-variant="primary" to={`/videos/${aid}`} onClick={closeCard}>{t('视频详情', 'Video details')}</Link>
      </div>
    </div>
  </div>;

  return <Popover content={card} placement="bottomLeft" trigger={['hover', 'click']} open={open} onOpenChange={onOpenChange}
    afterOpenChange={(nextOpen) => { if (nextOpen && focusCardOnOpen.current) focusFirstAction(); }}
    mouseEnterDelay={0.15} mouseLeaveDelay={0.2} classNames={{ root: 'video-info-popover' }}>
    <button ref={triggerRef} type="button" className={`video-info${hanging ? ' video-info--hanging' : ''} ${className}`.trim()}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? cardId : undefined} aria-busy={state.status === 'loading'}
      onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setOpen(true); }} onBlur={onBlur}
      onKeyDown={(event) => {
        onKeyDown(event);
        if ((event.key === 'Tab' && !event.shiftKey && open) || event.key === 'ArrowDown') {
          event.preventDefault();
          focusCardOnOpen.current = true;
          setOpen(true);
          focusFirstAction();
        }
      }}>
      <span className="video-info-title">{title}</span>
    </button>
  </Popover>;
}

/** Inline video title with a detail card. Pass large 64-bit aids as decimal strings. */
export default function VideoInfo({ aid, hangingPunctuation = true, className = '' }) {
  const { i18n } = useTranslation();
  const id = normalizeVideoAid(aid);
  if (!id) return <span className={`video-info-invalid ${className}`.trim()}>{String(i18n.language || 'zh').toLowerCase().startsWith('zh') ? '无效的视频ID' : 'Invalid video ID'}</span>;
  return <VideoInfoContent key={id} aid={id} hangingPunctuation={hangingPunctuation} className={className} />;
}
