import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Descriptions, Tooltip } from 'antd';
import { getRelativeTimeDetails, getRelativeTimeText, RELATIVE_TIME_MODES } from './relativeTime.js';
import './RelativeTime.css';

/** Plain inline time text. value: Unix seconds or date string; mode: absolute | relative | absolute-diff. */
export default function RelativeTime({ value, mode = RELATIVE_TIME_MODES.RELATIVE, className = '' }) {
  const { i18n } = useTranslation();
  const [now] = useState(() => Date.now());
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const details = getRelativeTimeDetails(value, now, isZh ? 'zh' : 'en');
  const tooltip = details ? <Descriptions className="relative-time-details" column={1} size="small" bordered={false}
    style={{ '--relative-time-label-width': isZh ? '7em' : '10em' }}
    styles={{
      label: { color: 'var(--text-secondary)', fontSize: 'var(--font-size-caption)', fontWeight: 'var(--font-weight-regular)' },
      content: { color: 'var(--text-primary)', fontSize: 'var(--font-size-caption)', fontWeight: 'var(--font-weight-regular)' },
    }}
    items={[
      { key: 'absolute', label: t('绝对时间', 'Absolute time'), children: details.absolute },
      { key: 'relative', label: t('相对时间', 'Relative time'), children: details.relative },
      { key: 'distance', label: t('距离现在', 'Time difference'), children: details.distance },
      { key: 'unix', label: t('UNIX时间戳', 'UNIX timestamp'), children: details.unix },
    ]} /> : t('时间无效', 'Invalid time');

  return <Tooltip title={tooltip} trigger={['hover', 'focus']} classNames={{ root: 'relative-time-tooltip' }}>
    <time className={`relative-time ${className}`.trim()} dateTime={details?.iso} tabIndex={0}>
      {getRelativeTimeText(details, mode)}
    </time>
  </Tooltip>;
}
