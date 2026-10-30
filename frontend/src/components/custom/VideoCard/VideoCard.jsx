import { useState } from 'react';
import { Card, Tag, Tooltip } from 'antd';
import { LikeOutlined, PictureOutlined, PlayCircleOutlined, StarOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ProducerInfo from '../ProducerInfo/ProducerInfo.jsx';
import RelativeTime from '../RelativeTime/RelativeTime.jsx';
import { hasHangingOpeningPunctuation, normalizeVideoAid } from '../VideoInfo/videoInfo.js';
import { formatVideoText } from '../../../pages/video/videoDetailFormat.js';
import { formatNumber } from '../../../utils/formatNumber.js';
import { splitHighlightParts } from '../../../utils/highlightText.js';
import './VideoCard.css';

const METRICS = [
  ['view', '播放', 'Views', PlayCircleOutlined],
  ['favorite', '收藏', 'Favorites', StarOutlined],
  ['like', '点赞', 'Likes', LikeOutlined],
];

/** Shared song presentation from UniSeek. Uses supplied data; never fetches video metrics. */
export default function VideoCard({ video, keyword = '', showProducer = false }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const [failedSrc, setFailedSrc] = useState(null);
  const aid = normalizeVideoAid(video.aid);
  const title = formatVideoText(video.title)?.trim() || (aid ? `av${aid}` : t('歌曲资料暂缺', 'Song information unavailable'));
  const href = aid ? `/videos/${aid}` : null;
  const src = /^https?:\/\//i.test(video.pic ?? '') ? video.pic.replace(/^http:\/\//i, 'https://') : null;
  const cover = src && failedSrc !== src
    ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />
    : <span className="video-card-cover-fallback" role="img" aria-label={t('封面暂缺', 'Cover unavailable')}><PictureOutlined aria-hidden="true" /></span>;
  const titleContent = splitHighlightParts(title, keyword).map((part, index) => part.hit
    ? <mark className="video-card-hit" key={index}>{part.text}</mark> : part.text);
  const titleClass = `video-card-title${hasHangingOpeningPunctuation(title) ? ' video-card-title--hanging' : ''}`;

  return <Card className="ds-surface video-card" variant="borderless">
    {href ? <Link className="video-card-cover video-card-link" to={href} aria-label={title}>{cover}</Link>
      : <div className="video-card-cover">{cover}</div>}
    <div className="video-card-top">
      <Tag className="video-card-type" variant="filled">{t('歌曲', 'Song')}</Tag>
      {aid && <span className="video-card-id">av{aid}</span>}
    </div>
    <div className="video-card-title-wrap">
      {href ? <Link className={`${titleClass} video-card-link`} to={href} title={title}>{titleContent}</Link>
        : <span className={titleClass}>{titleContent}</span>}
    </div>
    <div className="video-card-stats">
      {METRICS.filter(([key]) => key === 'view' || Object.hasOwn(video, key)).map(([key, zh, en, Icon]) => {
        const value = Number.isFinite(video[key]) ? video[key] : null;
        const label = t(zh, en);
        const description = `${label}：${value == null ? t('暂缺', 'Unavailable') : formatNumber(value, 'comma')}${key === 'view' && video.recordDate ? t(`；统计于 ${video.recordDate}`, `; recorded on ${video.recordDate}`) : ''}`;
        return <Tooltip key={key} title={description} trigger={['hover', 'focus']}>
          <span className="video-card-stat" tabIndex={0} aria-label={description}><Icon aria-hidden="true" />
            <span>{value == null ? '—' : formatNumber(value, isZh ? 'zh' : 'en')}</span>
          </span>
        </Tooltip>;
      })}
    </div>
    {video.pubdate != null && <div className="video-card-published"><span>{t('投稿于', 'Published')}</span><RelativeTime value={video.pubdate} /></div>}
    {showProducer && video.userId && <div className="video-card-producer"><ProducerInfo userId={video.userId} showAvatar /></div>}
  </Card>;
}
