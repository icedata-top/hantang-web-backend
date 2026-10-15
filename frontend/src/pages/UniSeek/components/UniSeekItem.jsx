import { useMemo } from 'react';
import {
  LikeOutlined,
  PlayCircleOutlined,
  StarOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Card, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatNumber, NUMBER_FORMAT } from '../../../utils/formatNumber.js';
import { splitHighlightParts } from '../highlightText.js';

const { Text } = Typography;

const typeLabelMap = {
  video: { zh: '歌曲', en: 'Song' },
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
  const n = value ?? 0;
  const tip = `${labelZh} / ${labelEn} ${formatNumber(n, NUMBER_FORMAT.COMMA)}`;

  return (
    <Tooltip title={tip}>
      <span className="uniseek-item-stat">
        {icon}
        <span>{formatNumber(n, numFormat)}</span>
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

  const typeLabels = typeLabelMap[item.type];
  const tagText = typeLabels ? t(typeLabels.zh, typeLabels.en) : item.type;
  const typeClass =
    item.type === 'video' || item.type === 'vocal' || item.type === 'producer'
      ? `uniseek-item-tag--${item.type}`
      : '';
  const mediaTypeClass =
    item.type === 'video'
      ? 'uniseek-item-media--video'
      : item.type === 'producer'
        ? 'uniseek-item-media--producer'
        : 'uniseek-item-media--vocal';

  return (
    <Card className="uniseek-item-card" bordered={false}>
      <div className={`uniseek-item-media-wrap ${mediaTypeClass}`}>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} className="uniseek-item-media-image" />
        ) : (
          <div className="uniseek-item-media-placeholder" aria-hidden />
        )}
        <div className="uniseek-item-media-overlay" aria-hidden />
      </div>

      <div className="uniseek-item-top">
        <Tag className={`uniseek-item-tag ${typeClass}`}>{tagText}</Tag>
        <Text type="secondary" className="uniseek-item-id">
          ID {item.id}
        </Text>
      </div>

      <HighlightText text={item.title} keyword={keyword} className="uniseek-item-title" />

      {item.type !== 'video' && item.subTitle ? (
        <HighlightText text={item.subTitle} keyword={keyword} className="uniseek-item-subtitle" />
      ) : null}

      {item.type === 'video' ? (
        <div className="uniseek-item-meta">
          <MetricStat
            icon={<PlayCircleOutlined aria-hidden />}
            value={item.play}
            labelZh="播放"
            labelEn="Views"
            numFormat={numFormat}
          />
          <MetricStat
            icon={<StarOutlined aria-hidden />}
            value={item.favorite}
            labelZh="收藏"
            labelEn="Favorites"
            numFormat={numFormat}
          />
          <MetricStat
            icon={<LikeOutlined aria-hidden />}
            value={item.like}
            labelZh="点赞"
            labelEn="Likes"
            numFormat={numFormat}
          />
        </div>
      ) : null}

      {item.type === 'vocal' ? (
        <div className="uniseek-item-meta">
          <MetricStat
            icon={<VideoCameraOutlined aria-hidden />}
            value={item.songCount}
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
            value={item.fanCount}
            labelZh="粉丝"
            labelEn="Fans"
            numFormat={numFormat}
          />
          <MetricStat
            icon={<VideoCameraOutlined aria-hidden />}
            value={item.videoCount}
            labelZh="投稿"
            labelEn="Videos"
            numFormat={numFormat}
          />
        </div>
      ) : null}
    </Card>
  );
}
