import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Segmented, Switch } from 'antd';
import RelativeTime from '../../components/custom/RelativeTime/RelativeTime.jsx';
import ProducerInfo from '../../components/custom/ProducerInfo/ProducerInfo.jsx';
import VideoInfo from '../../components/custom/VideoInfo/VideoInfo.jsx';
import VideoCard from '../../components/custom/VideoCard/VideoCard.jsx';
import { producerInfo, producerVideos } from '../../services/Producer/producer.mock.js';
import { getRelativeTimeDetails } from '../../components/custom/RelativeTime/relativeTime.js';
import './DesignComponents.css';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export default function DesignComponents() {
  const { t } = useTranslation();

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
  const [browseCard, setBrowseCard] = useState(false);
  const today = Math.floor((now + 8 * HOUR) / DAY) * DAY - 8 * HOUR;
  const modes = [['absolute', t("绝对")], ['relative', t("相对")], ['absolute-diff', t("绝对 + 日期差")]];
  const examples = [
    [t("刚才"), now - 60 * 1000],
    [t("25分钟前"), now - 25 * 60000],
    [t("昨天"), today - DAY + 10 * HOUR],
    [t("前天"), today - 2 * DAY + 10 * HOUR],
    [t("明天"), today + DAY + 10 * HOUR],
    [t("后天"), today + 2 * DAY + 10 * HOUR],
    [t("一年前"), now - 366 * DAY],
  ];

  return <main className="design-components" aria-labelledby="components-page-title">
    <header className="components-page-header">
      <p className="components-eyebrow">ICEDATA / COMPONENTS</p>
      <h1 id="components-page-title">{t("组件预览")}</h1>
      <p>{t("自定义组件的展示与交互。")}</p>
    </header>
    <section className="ds-surface components-card" aria-labelledby="relative-time-card-title">
      <div className="components-card-heading"><h2 id="relative-time-card-title">RelativeTime</h2><span className="ds-chip" data-variant="neutral">{t("时间文本")}</span></div>
      <p className="components-description">{t("普通文本形式展示时间，悬停或聚焦查看完整信息。")}</p>
      <div className="relative-time-controls">
        <label className="relative-time-value"><span>{t("时间值")}</span><Input aria-label={t("时间值")} value={value} onChange={(event) => setValue(event.target.value)} placeholder="2026-10-29 12:34:56" spellCheck={false} /></label>
        <div className="components-control-field"><span id="relative-time-mode-label">{t("显示模式")}</span><Segmented className="ds-segmented" block aria-labelledby="relative-time-mode-label" value={mode} onChange={setMode} options={modes.map(([value, label]) => ({ value, label, tooltip: label }))} /></div>
      </div>
      <div className="relative-time-presets" role="group" aria-label={t("时间示例")}>
        {examples.map(([label, timestamp]) => <button type="button" className="ds-button" data-variant="normal" key={label} onClick={() => setValue(String(Math.floor(timestamp / 1000)))}>{label}</button>)}
        <button type="button" className="ds-button" data-variant="normal" onClick={() => setValue(`${getRelativeTimeDetails(now / 1000, now).absolute}:00`)}>{t("日期字符串")}</button>
      </div>
      <div className="relative-time-live-preview"><span>{t("预览")}</span><RelativeTime value={value} mode={mode} /></div>
      <div className="relative-time-mode-grid">{modes.map(([key, label]) => <div key={key}><span>{label}</span><RelativeTime value={value} mode={key} /></div>)}</div>
      <p className="components-note">{t("支持秒级 UNIX 时间戳、日期时间字符串及带时区的 ISO 字符串。无时区字符串按北京时间（UTC+8）解释。")}</p>
      <p className="components-note">{t("本次参考时刻：")}{getRelativeTimeDetails(now / 1000, now).absolute}{t("。仅在首次显示时取当前时间，切换模式或语言不会刷新时间基准。")}</p>
      <pre className="components-usage"><code>{`<RelativeTime value={${JSON.stringify(value)}} mode="${mode}" />`}</code></pre>
    </section>
    <section className="ds-surface components-card" aria-labelledby="producer-info-card-title">
      <div className="components-card-heading"><h2 id="producer-info-card-title">ProducerInfo</h2><span className="ds-chip" data-variant="neutral">{t("创作者信息")}</span></div>
      <p className="components-description">{t("显示创作者名字，悬停、聚焦或点击查看完整资料与访问按钮。")}</p>
      <form className="relative-time-controls producer-info-controls" onSubmit={(event) => { event.preventDefault(); setProducerId(producerIdInput); }}>
        <label className="relative-time-value"><span>{t("用户 ID")}</span><Input aria-label={t("用户 ID")} inputMode="numeric" value={producerIdInput} onChange={(event) => setProducerIdInput(event.target.value)} placeholder="396194" spellCheck={false} /></label>
        <button type="submit" className="ds-button" data-variant="secondary">{t("加载创作者")}</button>
        <div className="components-switch-control"><Switch id="producer-info-show-avatar" checked={showProducerAvatar} onChange={setShowProducerAvatar} /><label htmlFor="producer-info-show-avatar">{t("显示头像")}</label></div>
      </form>
      <div className="producer-info-live-preview"><ProducerInfo userId={producerId} showAvatar={showProducerAvatar} /></div>
      <p className="components-note">{t('创作者列表')}</p>
      <div className="producer-info-live-preview"><ProducerInfo userId={producerInfo.userId} initialProducer={producerInfo} showAvatar linkToDetail /></div>
      <pre className="components-usage"><code>{`<ProducerInfo userId=${JSON.stringify(producerId)}${showProducerAvatar ? ' showAvatar' : ''} />`}</code></pre>
    </section>
    <section className="ds-surface components-card" aria-labelledby="video-card-preview-title">
      <div className="components-card-heading"><h2 id="video-card-preview-title">VideoCard</h2><span className="ds-chip" data-variant="neutral">{t("共享歌曲卡片")}</span></div>
      <p className="components-description">{t("统一搜索和创作者详情共用歌曲卡片；封面及标题可跳转到视频详情，缺失指标明确显示为「—」。")}</p>
      <div className="components-switch-control"><Switch id="video-card-browse-mode" checked={browseCard} onChange={setBrowseCard} /><label htmlFor="video-card-browse-mode">{t("歌曲列表")}</label></div>
      <div className="components-video-card-preview"><VideoCard video={producerVideos[0]} titlePreview={browseCard} showHonor={browseCard} showProducer={browseCard} showLike={!browseCard} /></div>
      <p className="components-note">{t("使用已有《世末歌者》公开样本，播放量暂缺，不生成演示计数。")}</p>
      <pre className="components-usage"><code>{browseCard ? '<VideoCard video={video} titlePreview showHonor showProducer showLike={false} />' : '<VideoCard video={video} />'}</code></pre>
    </section>
    <section className="ds-surface components-card" aria-labelledby="video-info-card-title">
      <div className="components-card-heading"><h2 id="video-info-card-title">VideoInfo</h2><span className="ds-chip" data-variant="neutral">{t("视频（歌曲）信息")}</span></div>
      <p className="components-description">{t("由 AV 号显示视频标题，悬停、聚焦或点击查看基本信息与访问按钮。")}</p>
      <form className="relative-time-controls video-info-controls" onSubmit={(event) => { event.preventDefault(); setVideoId(videoIdInput); }}>
        <label className="relative-time-value"><span>{t("AV 号 / aid")}</span><Input aria-label={t("AV 号 / aid")} value={videoIdInput} onChange={(event) => setVideoIdInput(event.target.value)} placeholder="6009789 / av6009789" spellCheck={false} /></label>
        <button type="submit" className="ds-button" data-variant="secondary">{t("加载视频")}</button>
        <div className="components-control-field"><span id="video-preview-width-label">{t("预览宽度")}</span><Segmented className="ds-segmented" aria-labelledby="video-preview-width-label" value={videoPreviewWidth} onChange={setVideoPreviewWidth}
          options={[{ value: '240px', label: '240px' }, { value: '360px', label: '360px' }, { value: '100%', label: t("全部宽度") }]} /></div>
        <div className="components-switch-control"><Switch id="video-info-hanging-punctuation" checked={hangingVideoPunctuation} onChange={setHangingVideoPunctuation} /><label htmlFor="video-info-hanging-punctuation">{t("开头标点左对齐")}</label></div>
      </form>
      <div className="video-info-live-preview"><div className="video-info-preview-content" style={{ width: videoPreviewWidth }}>
        <span className="video-info-preview-label">{t("视频标题")}</span>
        <VideoInfo aid={videoId} hangingPunctuation={hangingVideoPunctuation} />
      </div></div>
      <p className="components-note">{t("默认示例为《世末歌者》，可比较「【」开头的对齐效果和长标题省略。")}</p>
      <pre className="components-usage"><code>{`<VideoInfo aid=${JSON.stringify(videoId)}${hangingVideoPunctuation ? '' : ' hangingPunctuation={false}'} />`}</code></pre>
    </section>
  </main>;
}
