import { useTranslation } from 'react-i18next';
import { Tag, Tooltip } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { getVideoViewHonor } from '../../../constants/video/viewHonors.js';
import { formatNumber } from '../../../utils/formatNumber.js';
import './VideoHonor.css';

/** Informational Tag: one highest honor, or nothing for missing/sub-threshold views. */
export default function VideoHonor({ views }) {
  const { i18n } = useTranslation();
  const honor = getVideoViewHonor(views);
  if (!honor) return null;
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const name = isZh ? honor.zh : honor.en;
  const threshold = formatNumber(honor.threshold, isZh ? 'zh' : 'en');
  const description = isZh ? `${name}：累计播放量 ≥ ${threshold}，仅显示最高荣誉。`
    : `${name}: at least ${threshold} cumulative views. Only the highest honor is shown.`;

  return <Tooltip title={description} trigger={['hover', 'focus']}>
    <Tag className="video-honor-tag" data-honor={honor.id} variant="filled" icon={<TrophyOutlined aria-hidden="true" />}
      tabIndex={0} aria-label={description}>{name}</Tag>
  </Tooltip>;
}
