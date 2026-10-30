import { useMemo, useState } from 'react';
import {
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Card, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatNumber, NUMBER_FORMAT } from '../../../utils/formatNumber.js';
import { splitHighlightParts } from '../../../utils/highlightText.js';
import VideoCard from '../../../components/custom/VideoCard/VideoCard.jsx';
import { videoCardFromSearchItem } from '../../../components/custom/VideoCard/videoCardData.js';

const { Text } = Typography;

const typeLabelMap = {
  vocal: { zh: '虚拟歌手', en: 'Vocal' },
  producer: { zh: '创作者', en: 'Producer' },
};

/**
 * @param {object} props
 * @param {string} [props.text]
 * @param {string} [props.keyword]
 * @param {string} [props.className]
 */
function HighlightText({ text, keyword, className }) {
  const parts = useMemo(() => splitHighlightParts(text, keyword), [text, keyword]);

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.hit ? (
          <mark key={index} className="uniseek-hit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </span>
  );
}

/**
 * @param {object} props
 * @param {React.ReactNode} props.icon
 * @param {number} [props.value]
 * @param {string} props.labelZh
 * @param {string} props.labelEn
 * @param {'zh' | 'en'} props.numFormat
 */
function MetricStat({ icon, value, labelZh, labelEn, numFormat }) {
  const n = Number.isFinite(value) ? value : null;
  const tip = `${labelZh} / ${labelEn} ${n == null ? '—' : formatNumber(n, NUMBER_FORMAT.COMMA)}`;

  return (
    <Tooltip title={tip}>
      <span className="uniseek-item-stat">
        {icon}
        <span>{n == null ? '—' : formatNumber(n, numFormat)}</span>
      </span>
    </Tooltip>
  );
}

/**
 * @param {object} props
 * @param {import('../../../services/UniSeek/uniseek.api.js').SeekItem} props.item
 * @param {string} [props.keyword] 产生当前结果列表的关键词
 */
export default function UniSeekItem({ item, keyword = '' }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const numFormat = isZh ? NUMBER_FORMAT.ZH : NUMBER_FORMAT.EN;
  const t = (zh, en) => (isZh ? zh : en);

  const [failedSrc, setFailedSrc] = useState(null);
  const field = (name) => Object.hasOwn(item.payload ?? {}, name) ? item.payload[name] : item[name];
  const href = item.type === 'vocal' ? `/vocals/${item.id}` : `/producers/${item.id}`;

  if (item.type === 'video') return <VideoCard video={videoCardFromSearchItem(item)} keyword={keyword} />;

  const typeLabels = typeLabelMap[item.type];
  const tagText = typeLabels ? t(typeLabels.zh, typeLabels.en) : item.type;
  const typeClass =
    item.type === 'vocal' || item.type === 'producer'
      ? `uniseek-item-tag--${item.type}`
      : '';
  const mediaTypeClass =
    item.type === 'producer' ? 'uniseek-item-media--producer' : 'uniseek-item-media--vocal';

  return (
    <Card className="ds-surface uniseek-item-card" variant="borderless">
      <Link to={href} aria-label={item.title} className={`uniseek-item-media-wrap ${mediaTypeClass}`}>
        {item.coverUrl && failedSrc !== item.coverUrl ? (
          <img src={item.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer"
            onError={() => setFailedSrc(item.coverUrl)} className="uniseek-item-media-image" />
        ) : (
          <div className="uniseek-item-media-placeholder" aria-hidden />
        )}
        <div className="uniseek-item-media-overlay" aria-hidden />
      </Link>

      <div className="uniseek-item-top">
        <Tag variant="filled" className={`uniseek-item-tag ${typeClass}`}>{tagText}</Tag>
        {item.type === 'producer' ? <Text type="secondary" className="uniseek-item-id">
          UID {item.id}
        </Text> : null}
      </div>

      <Link to={href} className="uniseek-item-title-link"><HighlightText text={item.title} keyword={keyword} className="uniseek-item-title" /></Link>

      {item.subTitle ? (
        <HighlightText text={item.subTitle} keyword={keyword} className="uniseek-item-subtitle" />
      ) : null}

      {item.type === 'vocal' && field('songCount') != null ? (
        <div className="uniseek-item-meta">
          <MetricStat
            icon={<VideoCameraOutlined aria-hidden />}
            value={field('songCount')}
            labelZh="相关投稿"
            labelEn="Related videos"
            numFormat={numFormat}
          />
        </div>
      ) : null}

      {item.type === 'producer' ? (
        <div className="uniseek-item-meta">
          <MetricStat
            icon={<TeamOutlined aria-hidden />}
            value={field('fanCount')}
            labelZh="粉丝"
            labelEn="Fans"
            numFormat={numFormat}
          />
          <MetricStat
            icon={<VideoCameraOutlined aria-hidden />}
            value={field('videoCount')}
            labelZh="收录投稿"
            labelEn="Indexed videos"
            numFormat={numFormat}
          />
        </div>
      ) : null}
    </Card>
  );
}
