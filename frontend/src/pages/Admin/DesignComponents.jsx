import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import { getRelativeTimeDetails } from '../../components/custom/RelativeTime/relativeTime.js';
import './DesignComponents.css';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export default function DesignComponents() {
  const { i18n } = useTranslation();
  const isZh = String(i18n.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => isZh ? zh : en;
  const [now] = useState(() => Date.now());
  const [value, setValue] = useState(() => String(Math.floor((now - 25 * 60000) / 1000)));
  const [mode, setMode] = useState('relative');
  const [producerIdInput, setProducerIdInput] = useState('396194');
  const [producerId, setProducerId] = useState('396194');
  const [showProducerAvatar, setShowProducerAvatar] = useState(false);
  const today = Math.floor((now + 8 * HOUR) / DAY) * DAY - 8 * HOUR;
  const modes = [['absolute', t('绝对', 'Absolute')], ['relative', t('相对', 'Relative')], ['absolute-diff', t('绝对 + 日期差', 'Absolute + day difference')]];
  const examples = [
    [t('刚才', 'Just now'), now - 60 * 1000],
    [t('25分钟前', '25 minutes ago'), now - 25 * 60000],
    [t('昨天', 'Yesterday'), today - DAY + 10 * HOUR],
    [t('前天', 'Two days ago'), today - 2 * DAY + 10 * HOUR],
    [t('明天', 'Tomorrow'), today + DAY + 10 * HOUR],
    [t('后天', 'In two days'), today + 2 * DAY + 10 * HOUR],
    [t('一年前', 'A year ago'), now - 366 * DAY],
  ];

  return <main className="design-components" aria-labelledby="components-page-title">
    <header className="components-page-header">
      <p className="components-eyebrow">ICEDATA / COMPONENTS</p>
      <h1 id="components-page-title">{t('组件预览', 'Component previews')}</h1>
      <p>{t('自定义组件的展示与交互。', 'Explore the appearance and behavior of custom components.')}</p>
    </header>
    <section className="ds-surface components-card" aria-labelledby="relative-time-card-title">
      <div className="components-card-heading"><h2 id="relative-time-card-title">RelativeTime</h2><span className="ds-chip" data-variant="neutral">{t('时间文本', 'Time text')}</span></div>
      <p className="components-description">{t('普通文本形式展示时间，悬停或聚焦查看完整信息。', 'Plain time text with full details on hover or keyboard focus.')}</p>
      <div className="relative-time-controls">
        <label className="relative-time-value"><span>{t('时间值', 'Time value')}</span><input aria-label={t('时间值', 'Time value')} value={value} onChange={(event) => setValue(event.target.value)} placeholder="2026-10-29 12:34:56" spellCheck={false} /></label>
        <label><span>{t('显示模式', 'Display mode')}</span><select aria-label={t('显示模式', 'Display mode')} value={mode} onChange={(event) => setMode(event.target.value)}>{modes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <div className="relative-time-presets" role="group" aria-label={t('时间示例', 'Time examples')}>
        {examples.map(([label, timestamp]) => <button type="button" className="ds-button" data-variant="normal" key={label} onClick={() => setValue(String(Math.floor(timestamp / 1000)))}>{label}</button>)}
        <button type="button" className="ds-button" data-variant="normal" onClick={() => setValue(`${getRelativeTimeDetails(now / 1000, now).absolute}:00`)}>{t('日期字符串', 'Date string')}</button>
      </div>
      <div className="relative-time-live-preview"><span>{t('预览', 'Preview')}</span><RelativeTime value={value} mode={mode} /></div>
      <div className="relative-time-mode-grid">{modes.map(([key, label]) => <div key={key}><span>{label}</span><RelativeTime value={value} mode={key} /></div>)}</div>
      <p className="components-note">{t('支持秒级 UNIX 时间戳、日期时间字符串及带时区的 ISO 字符串。无时区字符串按北京时间（UTC+8）解释。', 'Accepts Unix seconds, date-time strings, and ISO strings with time zones. Unzoned strings use Beijing time (UTC+8).')}</p>
      <p className="components-note">{t('本次参考时刻：', 'Reference time for this visit: ')}{getRelativeTimeDetails(now / 1000, now).absolute}{t('。仅在首次显示时取当前时间，切换模式或语言不会刷新时间基准。', '. The clock is captured once on mount and remains fixed when the mode or language changes.')}</p>
      <pre className="components-usage"><code>{`<RelativeTime value={${JSON.stringify(value)}} mode="${mode}" />`}</code></pre>
    </section>
    <section className="ds-surface components-card" aria-labelledby="producer-info-card-title">
      <div className="components-card-heading"><h2 id="producer-info-card-title">ProducerInfo</h2><span className="ds-chip" data-variant="neutral">{t('创作者信息', 'Producer information')}</span></div>
      <p className="components-description">{t('显示创作者名字，悬停、聚焦或点击查看完整资料与访问按钮。', 'Show a producer name; hover, focus, or tap for their profile and links.')}</p>
      <form className="relative-time-controls producer-info-controls" onSubmit={(event) => { event.preventDefault(); setProducerId(producerIdInput); }}>
        <label className="relative-time-value"><span>{t('用户 ID', 'User ID')}</span><input aria-label={t('用户 ID', 'User ID')} inputMode="numeric" value={producerIdInput} onChange={(event) => setProducerIdInput(event.target.value)} placeholder="396194" spellCheck={false} /></label>
        <button type="submit" className="ds-button" data-variant="secondary">{t('加载创作者', 'Load producer')}</button>
        <label className="producer-info-avatar-control"><input type="checkbox" checked={showProducerAvatar} onChange={(event) => setShowProducerAvatar(event.target.checked)} /><span>{t('显示头像', 'Show avatar')}</span></label>
      </form>
      <div className="producer-info-live-preview"><ProducerInfo userId={producerId} showAvatar={showProducerAvatar} /></div>
      <pre className="components-usage"><code>{`<ProducerInfo userId=${JSON.stringify(producerId)}${showProducerAvatar ? ' showAvatar' : ''} />`}</code></pre>
    </section>
  </main>;
}
