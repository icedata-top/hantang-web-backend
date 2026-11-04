import { normalizeLanguage } from '../../../locales/languages.js';
import { useTranslation } from 'react-i18next';
import { Tag, Tooltip } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { getVideoViewHonor } from '../../../constants/video/viewHonors.js';
import { formatNumber } from '../../../utils/formatNumber.js';
import './VideoHonor.css';

/** Informational Tag: one highest honor, or nothing for missing/sub-threshold views. */
export default function VideoHonor({ views }) {
  const { i18n, t } = useTranslation();
  const honor = getVideoViewHonor(views);
  if (!honor) return null;
  const language = i18n.resolvedLanguage || i18n.language;
  const name = t(honor.zh);
  const threshold = formatNumber(honor.threshold, normalizeLanguage(language));
  const description = t("{{value0}}：累计播放量 ≥ {{value1}}，仅显示最高荣誉。", { value0: name, value1: threshold });

  return <Tooltip title={description} trigger={['hover', 'focus']}>
    <Tag className="video-honor-tag" data-honor={honor.id} variant="filled" icon={<TrophyOutlined aria-hidden="true" />}
      tabIndex={0} aria-label={description}>{name}</Tag>
  </Tooltip>;
}
