import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Popover } from 'antd';
import { ExportOutlined, LoadingOutlined, ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { fetchProducerInfo } from '../../../services/Producer/producer.api.js';
import { formatNumber } from '../../../utils/formatNumber.js';
import './ProducerInfo.css';

function normalizeUserId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const id = String(value);
  return /^[1-9]\d*$/.test(id) && (id.length < 19 || (id.length === 19 && id <= '9223372036854775807')) ? id : null;
}

function ProducerAvatar({ src, large = false }) {
  const [failedSrc, setFailedSrc] = useState(null);
  const safeSrc = /^https?:\/\//i.test(src ?? '') ? src.replace(/^http:\/\//i, 'https://') : null;
  const className = `producer-info-avatar${large ? ' producer-info-avatar--large' : ''}`;
  return safeSrc && failedSrc !== safeSrc
    ? <img className={className} src={safeSrc} alt="" referrerPolicy="no-referrer" onError={() => setFailedSrc(safeSrc)} />
    : <span className={`${className} producer-info-avatar--fallback`} aria-hidden="true"><UserOutlined /></span>;
}

function ProducerInfoContent({ userId, showAvatar, className }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null });
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const cardRef = useRef(null);
  const cardId = useId();

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', data: null });
    fetchProducerInfo(userId, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setState({ status: 'ready', data }); },
      (error) => {
        if (!controller.signal.aborted) setState({ status: Number(error.code) === 404 ? 'missing' : 'error', data: null });
      },
    );
    return () => controller.abort();
  }, [userId, attempt]);

  const producer = state.data;
  const name = producer?.name?.trim() || `UID ${userId}`;

  function onOpenChange(nextOpen) {
    // Keep the actions available while keyboard focus is inside the card.
    if (!nextOpen && cardRef.current?.contains(document.activeElement)) return;
    setOpen(nextOpen);
  }

  function onBlur(event) {
    const next = event.relatedTarget;
    if (!triggerRef.current?.contains(next) && !cardRef.current?.contains(next)) setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    triggerRef.current?.focus();
    setOpen(false);
  }

  const card = <div className="producer-info-card" id={cardId} ref={cardRef} role="dialog"
    aria-label={t(`${name} 的创作者资料`, `Producer information for ${name}`)} onBlur={onBlur} onKeyDown={onKeyDown}>
    <div className="producer-info-header">
      <ProducerAvatar src={producer?.face} large />
      <div className="producer-info-account">
        <strong className="producer-info-title">{name}</strong>
        <span className="producer-info-uid">UID {userId}</span>
        {producer?.level != null && <span className="ds-chip" data-variant="neutral">Lv.{producer.level}</span>}
      </div>
    </div>
    {state.status === 'ready' && <>
      {producer.officialTitle && <div className="producer-info-official"><span className="ds-chip" data-variant="orange">{producer.officialTitle}</span></div>}
      <p className="producer-info-sign">{producer.sign?.trim() || t('暂无个人简介', 'No bio available')}</p>
      <div className="producer-info-fans"><span>{t('粉丝', 'Followers')}</span><strong>{producer.fans == null ? '—' : formatNumber(producer.fans, 'comma')}</strong></div>
    </>}
    {state.status === 'loading' && <p className="producer-info-status" role="status"><LoadingOutlined spin /> {t('正在加载创作者资料…', 'Loading producer information…')}</p>}
    {state.status === 'missing' && <p className="producer-info-status" role="status">{t('暂未收录该创作者的资料', 'This producer’s information has not been indexed')}</p>}
    {state.status === 'error' && <div className="producer-info-status" role="alert">
      <span>{t('创作者资料加载失败', 'Could not load producer information')}</span>
      <button type="button" className="ds-button" data-variant="normal" onClick={() => setAttempt((value) => value + 1)}><ReloadOutlined />{t('重试', 'Retry')}</button>
    </div>}
    <div className="producer-info-actions">
      <a className="ds-button" data-variant="secondary" href={`https://space.bilibili.com/${userId}`} target="_blank" rel="noopener noreferrer">{t('访问 Bilibili', 'Visit Bilibili')} <ExportOutlined /></a>
      <Link className="ds-button" data-variant="primary" to={`/producers/${userId}`} onClick={() => setOpen(false)}>{t('创作者详情', 'Producer details')}</Link>
    </div>
  </div>;

  return <Popover content={card} placement="bottomLeft" trigger={['hover', 'click']} open={open} onOpenChange={onOpenChange}
    mouseEnterDelay={0.15} mouseLeaveDelay={0.2} classNames={{ root: 'producer-info-popover' }}>
    <button ref={triggerRef} type="button" className={`producer-info ${className}`.trim()} aria-haspopup="dialog"
      aria-expanded={open} aria-controls={open ? cardId : undefined} aria-busy={state.status === 'loading'}
      onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setOpen(true); }} onBlur={onBlur}
      onKeyDown={(event) => {
        onKeyDown(event);
        if ((event.key === 'Tab' && !event.shiftKey && open) || event.key === 'ArrowDown') {
          setOpen(true);
          const firstAction = cardRef.current?.querySelector('button, a');
          if (firstAction) { event.preventDefault(); firstAction.focus(); }
        }
      }}>
      {showAvatar && <ProducerAvatar src={producer?.face} />}
      <span className="producer-info-name">{name}</span>
    </button>
  </Popover>;
}

/** Inline producer name with a profile card. Pass large 64-bit IDs as decimal strings. */
export default function ProducerInfo({ userId, showAvatar = false, className = '' }) {
  const { i18n } = useTranslation();
  const id = normalizeUserId(userId);
  if (!id) return <span className={`producer-info-invalid ${className}`.trim()}>{String(i18n.language || 'zh').toLowerCase().startsWith('zh') ? '无效的创作者ID' : 'Invalid producer ID'}</span>;
  return <ProducerInfoContent key={id} userId={id} showAvatar={showAvatar} className={className} />;
}
