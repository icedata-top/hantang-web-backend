import { getLanguageSettings, normalizeLanguage } from '../../../locales/languages.js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Descriptions, Tooltip } from 'antd';
import { getRelativeTimeDetails, getRelativeTimeText, RELATIVE_TIME_MODES } from './relativeTime.js';
import './RelativeTime.css';

/** Plain inline time text. value: Unix seconds or date string; mode: absolute | relative | absolute-diff. */
export default function RelativeTime({ value, mode = RELATIVE_TIME_MODES.RELATIVE, className = '' }) {
  const { i18n, t } = useTranslation();
  const [now] = useState(() => Date.now());
  const language = i18n.resolvedLanguage || i18n.language;

  const details = getRelativeTimeDetails(value, now, normalizeLanguage(language));
  const tooltip = details ? <Descriptions className="relative-time-details" column={1} size="small" bordered={false}
    style={{ '--relative-time-label-width': getLanguageSettings(language).timeLabelWidth }}
    styles={{
      label: { color: 'var(--text-secondary)', fontSize: 'var(--font-size-caption)', fontWeight: 'var(--font-weight-regular)' },
      content: { color: 'var(--text-primary)', fontSize: 'var(--font-size-caption)', fontWeight: 'var(--font-weight-regular)' },
    }}
    items={[
      { key: 'absolute', label: t("绝对时间"), children: details.absolute },
      { key: 'relative', label: t("相对时间"), children: details.relative },
      { key: 'distance', label: t("距离现在"), children: details.distance },
      { key: 'unix', label: t("UNIX时间戳"), children: details.unix },
    ]} /> : t("时间无效");

  return <Tooltip title={tooltip} trigger={['hover', 'focus']} classNames={{ root: 'relative-time-tooltip' }}>
    <time className={`relative-time ${className}`.trim()} dateTime={details?.iso} tabIndex={0}>
      {getRelativeTimeText(details, mode)}
    </time>
  </Tooltip>;
}
