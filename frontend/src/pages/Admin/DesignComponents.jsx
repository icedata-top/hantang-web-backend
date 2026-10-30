import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Segmented, Switch } from 'antd';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import VideoInfo from '../../components/custom/VideoInfo/VideoInfo.jsx';
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
  const [videoIdInput, setVideoIdInput] = useState('6009789');
  const [videoId, setVideoId] = useState('6009789');
  const [hangingVideoPunctuation, setHangingVideoPunctuation] = useState(true);
  const [videoPreviewWidth, setVideoPreviewWidth] = useState('360px');
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
        <label className="relative-time-value"><span>{t('时间值', 'Time value')}</span><Input aria-label={t('时间值', 'Time value')} value={value} onChange={(event) => setValue(event.target.value)} placeholder="2026-10-29 12:34:56" spellCheck={false} /></label>
        <div className="components-control-field"><span id="relative-time-mode-label">{t('显示模式', 'Display mode')}</span><Segmented className="ds-segmented" block aria-labelledby="relative-time-mode-label" value={mode} onChange={setMode} options={modes.map(([value, label]) => ({ value, label, tooltip: label }))} /></div>
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
        <label className="relative-time-value"><span>{t('用户 ID', 'User ID')}</span><Input aria-label={t('用户 ID', 'User ID')} inputMode="numeric" value={producerIdInput} onChange={(event) => setProducerIdInput(event.target.value)} placeholder="396194" spellCheck={false} /></label>
        <button type="submit" className="ds-button" data-variant="secondary">{t('加载创作者', 'Load producer')}</button>
        <div className="components-switch-control"><Switch id="producer-info-show-avatar" checked={showProducerAvatar} onChange={setShowProducerAvatar} /><label htmlFor="producer-info-show-avatar">{t('显示头像', 'Show avatar')}</label></div>
      </form>
      <div className="producer-info-live-preview"><ProducerInfo userId={producerId} showAvatar={showProducerAvatar} /></div>
      <pre className="components-usage"><code>{`<ProducerInfo userId=${JSON.stringify(producerId)}${showProducerAvatar ? ' showAvatar' : ''} />`}</code></pre>
    </section>
    <section className="ds-surface components-card" aria-labelledby="video-info-card-title">
      <div className="components-card-heading"><h2 id="video-info-card-title">VideoInfo</h2><span className="ds-chip" data-variant="neutral">{t('视频（歌曲）信息', 'Video / song information')}</span></div>
      <p className="components-description">{t('由 AV 号显示视频标题，悬停、聚焦或点击查看基本信息与访问按钮。', 'Resolve an AV ID to its title; hover, focus, or tap for information and links.')}</p>
      <form className="relative-time-controls video-info-controls" onSubmit={(event) => { event.preventDefault(); setVideoId(videoIdInput); }}>
        <label className="relative-time-value"><span>{t('AV 号 / aid', 'AV ID / aid')}</span><Input aria-label={t('AV 号 / aid', 'AV ID / aid')} value={videoIdInput} onChange={(event) => setVideoIdInput(event.target.value)} placeholder="6009789 / av6009789" spellCheck={false} /></label>
        <button type="submit" className="ds-button" data-variant="secondary">{t('加载视频', 'Load video')}</button>
        <div className="components-control-field"><span id="video-preview-width-label">{t('预览宽度', 'Preview width')}</span><Segmented className="ds-segmented" aria-labelledby="video-preview-width-label" value={videoPreviewWidth} onChange={setVideoPreviewWidth}
          options={[{ value: '240px', label: '240px' }, { value: '360px', label: '360px' }, { value: '100%', label: t('全部宽度', 'Full width') }]} /></div>
        <div className="components-switch-control"><Switch id="video-info-hanging-punctuation" checked={hangingVideoPunctuation} onChange={setHangingVideoPunctuation} /><label htmlFor="video-info-hanging-punctuation">{t('开头标点左对齐', 'Hang opening punctuation')}</label></div>
      </form>
      <div className="video-info-live-preview"><div className="video-info-preview-content" style={{ width: videoPreviewWidth }}>
        <span className="video-info-preview-label">{t('视频标题', 'Video title')}</span>
        <VideoInfo aid={videoId} hangingPunctuation={hangingVideoPunctuation} />
      </div></div>
      <p className="components-note">{t('默认示例为《世末歌者》，可比较「【」开头的对齐效果和长标题省略。', 'The default sample is World’s End Singer. Compare opening bracket alignment and long title truncation.')}</p>
      <pre className="components-usage"><code>{`<VideoInfo aid=${JSON.stringify(videoId)}${hangingVideoPunctuation ? '' : ' hangingPunctuation={false}'} />`}</code></pre>
    </section>
  </main>;
}
