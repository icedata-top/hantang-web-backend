import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import {
  InfoCircleOutlined,
  MoonOutlined,
  SunOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import './DesignSpec.css';
import { PaginationSample, TableSample, TabsSample } from './DataDisplaySamples.jsx';
import { TokenContext, Token, Value, TypeMetrics } from './SpecTokens.jsx';
import VideoHonor from '../../components/custom/VideoHonor/VideoHonor.jsx';
import { VIDEO_VIEW_HONORS } from '../../constants/video/viewHonors.js';

const TOKEN_NAMES = [
  'canvas', 'surface', 'surface-hover', 'surface-border', 'theme-primary', 'theme-accent',
  'text-primary', 'text-secondary', 'text-disabled', 'text-link', 'text-link-hover',
  'button-primary-bg', 'button-primary-hover', 'button-primary-text',
  'button-secondary-bg', 'button-secondary-hover', 'button-secondary-text',
  'button-normal-bg', 'button-normal-hover', 'button-normal-text',
  'button-danger-bg', 'button-danger-hover', 'button-danger-text',
  'button-disabled-bg', 'button-disabled-text',
  'tooltip-bg', 'tooltip-text',
  'chip-neutral-bg', 'chip-neutral-text', 'chip-orange-bg', 'chip-orange-text',
  ...['hall', 'legend', 'myth'].flatMap((level) => ['bg', 'text'].map((part) => `honor-${level}-${part}`)),
  'font-size-title', 'font-size-heading', 'font-size-body', 'font-size-caption', 'font-size-button',
  'font-weight-regular', 'font-weight-medium', 'font-weight-semibold', 'font-weight-button',
  'line-height-title', 'line-height-heading', 'line-height-body',
  'radius-card', 'radius-control', 'control-height', 'button-border-width', 'surface-border-width', 'alert-border-width',
  'tabs-height', 'tabs-gap', 'tabs-indicator-size',
  'table-row-height', 'table-cell-padding-block', 'table-cell-padding-inline',
  'pagination-item-size', 'pagination-item-size-compact', 'pagination-gap', 'pagination-border-width',
  'pagination-active-bg', 'pagination-active-text',
  ...['info', 'warning', 'error'].flatMap((type) => ['bg', 'border', 'text'].map((part) => `alert-${type}-${part}`)),
];

function formatColor(value) {
  // color-mix(in srgb, ...) 的计算结果可能为 color(srgb ...)。
  if (!value.startsWith('rgb') && !value.startsWith('color(srgb ')) return value;
  const channels = value.match(/-?(?:\d*\.)?\d+(?:e[+-]?\d+)?/gi)?.map(Number);
  if (!channels || channels.length < 3) return value;
  const scale = value.startsWith('color(srgb ') ? 255 : 1;
  const hex = (channel) => Math.round(Math.max(0, Math.min(255, channel))).toString(16).padStart(2, '0');
  const rgb = channels.slice(0, 3).map((channel) => hex(channel * scale)).join('');
  const alpha = channels[3] ?? 1;
  return `#${rgb}${alpha < 1 ? hex(alpha * 255) : ''}`.toUpperCase();
}

function Swatch({ name, label }) {
  return (
    <div className="spec-swatch">
      <span className="spec-swatch-color" style={{ background: `var(--${name})` }} aria-hidden="true" />
      <span><span className="spec-swatch-label">{label}</span><Token name={name} /></span>
    </div>
  );
}

function ThemePreview({ theme, t, children }) {
  const ref = useRef(null);
  const [tokens, setTokens] = useState({});
  useLayoutEffect(() => {
    const syncTokens = () => {
      const styles = getComputedStyle(ref.current);
      const probe = document.createElement('span');
      probe.hidden = true;
      ref.current.appendChild(probe);
      const tokens = Object.fromEntries(TOKEN_NAMES.map((name) => {
        const raw = styles.getPropertyValue(`--${name}`).trim();
        probe.style.backgroundColor = 'transparent';
        probe.style.backgroundColor = `var(--${name})`;
        const computed = getComputedStyle(probe).backgroundColor;
        const shown = computed && computed !== 'rgba(0, 0, 0, 0)'
          ? formatColor(computed)
          : raw.replace(/#[\da-f]+/gi, (hex) => hex.toUpperCase());
        return [name, shown];
      }));
      probe.remove();
      setTokens(tokens);
    };
    syncTokens();
    // 手动保存 theme.css 后，让标注随样式一起更新。
    if (import.meta.hot) {
      import.meta.hot.on('vite:afterUpdate', syncTokens);
      return () => import.meta.hot.off('vite:afterUpdate', syncTokens);
    }
  }, [theme]);

  return (
    <div className="spec-theme" data-theme={theme} ref={ref}>
      <div className="spec-theme-heading">
        <span>{theme === 'light' ? <SunOutlined /> : <MoonOutlined />}{theme === 'light' ? t('白天', 'Light') : t('夜间', 'Dark')}</span>
        <span className="spec-theme-caption">{theme === 'light' ? 'LIGHT' : 'DARK'}</span>
      </div>
      <TokenContext.Provider value={tokens}>
        <div className="spec-preview-body">{children}</div>
      </TokenContext.Provider>
    </div>
  );
}

function Surfaces({ t }) {
  return (
    <>
      <div className="spec-canvas-label"><span className="spec-layer-label">Canvas</span><Token name="canvas" /></div>
      <div className="spec-surface-grid">
        <div className="ds-surface spec-surface" tabIndex={0} aria-label={t('Surface 普通状态，可悬停预览', 'Surface default; hover to preview')}>
          <span className="spec-layer-label">Surface</span>
          <strong>{t('普通卡片', 'Default card')}</strong>
          <p>{t('内容位于 Canvas 之上。', 'Content sits above the canvas.')}</p>
          <Token name="surface" />
        </div>
        <div className="ds-surface spec-surface" data-preview-state="hover">
          <span className="spec-layer-label">Surface · Hover</span>
          <strong>{t('悬停卡片', 'Hovered card')}</strong>
          <p>{t('表面提亮，阴影加深。', 'Brighter surface, deeper shadow.')}</p>
          <Token name="surface-hover" />
        </div>
      </div>
      <div className="spec-swatch-grid">
        <Swatch name="canvas" label="Canvas" />
        <Swatch name="surface" label="Surface" />
        <Swatch name="surface-hover" label="Hover" />
        <Swatch name="surface-border" label={t('分割线', 'Divider')} />
        <Swatch name="theme-primary" label={t('品牌主色', 'Brand')} />
        <Swatch name="theme-accent" label={t('品牌高亮', 'Accent')} />
      </div>
      <p className="spec-footnote">{t('圆角', 'Radius')} <Value name="radius-card" /> · {t('描边', 'Border')} <Value name="surface-border-width" /> · {t('过渡 200ms。左侧卡片支持实际悬停与键盘聚焦。', '200ms transition. Hover or focus the default card to try it.')}</p>
    </>
  );
}

const BUTTONS = [
  { type: 'primary', name: 'Primary', label: ['保存更改', 'Save'], usage: ['核心操作', 'Main action'] },
  { type: 'secondary', name: 'Secondary', label: ['取消', 'Cancel'], usage: ['次要操作', 'Supporting action'] },
  { type: 'normal', name: 'Normal', label: ['更多', 'More'], usage: ['常规操作', 'Routine action'] },
  { type: 'danger', name: 'Danger', label: ['删除记录', 'Delete'], usage: ['破坏性操作', 'Destructive action'] },
];

function Buttons({ t }) {
  const [feedback, setFeedback] = useState('');
  return (
    <>
      <div className="spec-button-heading" aria-hidden="true">
        <span>{t('类型', 'Type')}</span><span>{t('普通', 'Default')}</span><span>{t('悬停', 'Hover')}</span><span>{t('禁用', 'Disabled')}</span>
      </div>
      <div className="spec-button-rows">
        {BUTTONS.map(({ type, name, label, usage }) => (
          <div className="spec-button-row" key={type}>
            <div className="spec-button-name"><strong>{name}</strong><span>{t(...usage)}</span></div>
            {['default', 'hover', 'disabled'].map((state) => (
              <div className="spec-button-cell" key={state}>
                <button
                  type="button"
                  className="ds-button"
                  data-variant={type}
                  data-preview-state={state}
                  disabled={state === 'disabled'}
                  aria-label={`${name} · ${t(...label)} · ${state}`}
                  onClick={() => setFeedback(t(`已体验 ${name} 按钮，仅作视觉演示。`, `${name} preview clicked. This is a visual demo.`))}
                >{t(...label)}</button>
                <span className="spec-button-color"><span>{t('底', 'BG')}</span><Token name={state === 'disabled' ? 'button-disabled-bg' : `button-${type}-${state === 'hover' ? 'hover' : 'bg'}`} /></span>
                <span className="spec-button-color"><span>{t('字', 'Text')}</span><Token name={state === 'disabled' ? 'button-disabled-text' : `button-${type}-text`} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="spec-footnote">{t('高度', 'Height')} <Value name="control-height" /> · {t('字号', 'Type')} <Value name="font-size-button" /> / <Value name="font-weight-button" /> · {t('圆角', 'Radius')} <Value name="radius-control" /> · {t('描边', 'Border')} <Value name="button-border-width" />。{t('Tab 聚焦显示 2px 蓝色外环；禁用态不响应操作。', 'Tab focus adds a 2px blue ring. Disabled buttons are inactive.')}</p>
      <p className="spec-demo-feedback" role="status">{feedback || t('点击可用按钮，体验交互反馈。悬停列固定显示 Hover。', 'Click an enabled button to try it. The Hover column keeps its hover appearance.')}</p>
    </>
  );
}

function Typography({ t }) {
  const samples = [
    ['title', t('页面标题', 'Page title'), ['title', 'semibold', 'title'], 'text-primary'],
    ['heading', t('内容分组标题', 'Section heading'), ['heading', 'semibold', 'heading'], 'text-primary'],
    ['body', t('正文用于呈现内容，清晰、平静、易读。', 'Body text makes content clear and easy to read.'), ['body', 'regular', 'body'], 'text-primary'],
    ['secondary', t('辅助文本说明时间、来源与补充信息。', 'Supporting text explains dates, sources, and context.'), ['caption', 'regular', 'body'], 'text-secondary'],
    ['disabled', t('禁用文本 · 当前操作不可用', 'Disabled text · Action unavailable'), ['body', 'regular', 'body'], 'text-disabled'],
  ];
  return (
    <>
      <div className="spec-type-list">
        {samples.map(([type, label, metrics, token]) => (
          <div className="spec-type-row" key={type}>
            <p className={`spec-type-${type}`}>{label}</p>
            <span className="spec-type-meta"><TypeMetrics size={metrics[0]} weight={metrics[1]} lineHeight={metrics[2]} /><Token name={token} /></span>
          </div>
        ))}
        <div className="spec-type-row">
          <p className="spec-type-body"><strong>{t('重点文字使用 600 字重。', 'Use weight 600 for emphasis.')}</strong></p>
          <span className="spec-type-meta"><TypeMetrics size="body" weight="semibold" /><Token name="text-primary" /></span>
        </div>
        <div className="spec-type-row">
          <a className="ds-link" href="#spec-surfaces">{t('文字链接，悬停显示下划线', 'Text link, underlined on hover')} ↗</a>
          <span className="spec-type-meta"><TypeMetrics size="body" weight="medium" /><Token name="text-link" /><span>→</span><Token name="text-link-hover" /></span>
        </div>
      </div>
      <p className="spec-footnote">{t('标注顺序：字号 px / 字重 / 行高。沿用系统无衬线字体；数字使用等宽数字，辅助文字直接指定颜色。', 'Notation: font size in px / weight / line height. Use the system sans-serif stack, tabular numbers, and an explicit supporting text color.')}</p>
    </>
  );
}

function Tooltips({ t }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const copy = t('统计周期按北京时间计算。', 'Reporting periods use Beijing time.');
  return (
    <>
      <div className="spec-tooltip-stage">
        <div className="spec-tooltip-example">
          <div className="ds-tooltip-bubble">{copy}</div>
          <span className="spec-tooltip-static-label"><InfoCircleOutlined /> {t('常显样本', 'Static sample')}</span>
        </div>
        <div
          className="spec-tooltip-interactive"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
        >
          <button type="button" className="ds-button" aria-describedby={open ? id : undefined}>
            <InfoCircleOutlined /> {t('悬停或聚焦试试', 'Hover or focus me')}
          </button>
          {open && <div className="ds-tooltip-bubble spec-tooltip-popup" role="tooltip" id={id}>{copy}</div>}
        </div>
      </div>
      <div className="spec-swatch-grid">
        <Swatch name="tooltip-bg" label={t('提示背景', 'Background')} />
        <Swatch name="tooltip-text" label={t('提示文字', 'Text')} />
      </div>
      <p className="spec-footnote">{t('悬浮层使用当前主题的 Surface 背景和正文颜色，可承载说明文字及其他组件。', 'Floating layers use the current theme’s Surface and text colors, supporting both text and embedded components.')}</p>
      <p className="spec-footnote"><TypeMetrics size="caption" /> · {t('圆角', 'Radius')} <Value name="radius-control" /> · {t('内边距 8 × 12px · 最大宽度 240px。移开鼠标、失焦或按 Esc 关闭。', '8 × 12px padding · 240px max width. Dismiss on mouse leave, blur, or Esc.')}</p>
    </>
  );
}

const ALERTS = [
  { type: 'info', Icon: InfoCircleOutlined, name: ['信息', 'Information'], title: ['数据正在更新', 'Data is updating'], description: ['更新完成后会展示最新统计结果。', 'The latest statistics will appear when the update completes.'] },
  { type: 'warning', Icon: WarningOutlined, name: ['警告', 'Warning'], title: ['部分数据暂缺', 'Some data is missing'], description: ['当前周期尚未收集完整，请留意统计范围。', 'This period is incomplete. Check the reporting range.'] },
  { type: 'error', Icon: CloseCircleOutlined, name: ['错误', 'Error'], title: ['更新未能完成', 'Update failed'], description: ['请检查连接后重试，已有数据仍然保留。', 'Check the connection and try again. Existing data is retained.'] },
];

function Alerts({ t }) {
  return (
    <>
      <div className="spec-alert-list">
        {ALERTS.map(({ type, Icon, name, title, description }) => (
          <div key={type}>
            <div className="spec-alert-caption"><strong>{t(...name)} · {type[0].toUpperCase() + type.slice(1)}</strong></div>
            <div className="ds-alert" data-variant={type}>
              <Icon aria-hidden="true" />
              <div><strong>{t(...title)}</strong><p>{t(...description)}</p></div>
            </div>
            <div className="spec-alert-colors">
              <span>{t('底', 'BG')} <Token name={`alert-${type}-bg`} /></span>
              <span>{t('来源', 'Source')} <code>--{type === 'info' ? 'theme-primary' : type === 'warning' ? 'highlight-orange' : 'highlight-red'}</code></span>
              <span>{t('字 / 图标', 'Text / icon')} <Token name={`alert-${type}-text`} /></span>
            </div>
          </div>
        ))}
      </div>
      <p className="spec-footnote">{t('标题', 'Title')} <TypeMetrics size="body" weight="semibold" /> · {t('正文', 'Body')} <TypeMetrics size="body" /> · {t('圆角', 'Radius')} <Value name="radius-card" /> · {t('描边', 'Border')} <Value name="alert-border-width" />。{t('颜色、图标与标题共同表达状态。', 'Color, icon, and title communicate the state together.')}</p>
    </>
  );
}

function Chips({ t }) {
  return <>
    <div className="spec-chip-list">
      <div><span className="ds-chip" data-variant="neutral">VOCALOID·UTAU</span>
        <p className="spec-type-meta"><Token name="chip-neutral-bg" /><Token name="chip-neutral-text" /></p></div>
      <div><span className="ds-chip" data-variant="orange">{t('bilibili 知名音乐UP主', 'bilibili Music Creator')}</span>
        <p className="spec-type-meta"><Token name="chip-orange-bg" /><Token name="chip-orange-text" /></p></div>
    </div>
    <p className="spec-footnote">{t('灰色用于分区与普通标签，橙色用于认证头衔。标签仅展示信息，不冒充可点击按钮。', 'Gray labels identify categories; orange labels show official titles. These labels are informational, not buttons.')}</p>
    <p className="spec-footnote">{t('播放荣誉示例：殿堂 ≥ 10万，传说 ≥ 100万，神话 ≥ 1000万。每个示例独立判定，视频详情只显示最高一级。', 'View honor examples: Hall of Fame ≥ 100K, Legendary ≥ 1M, Mythic ≥ 10M. Each example is independent; a video shows only its highest honor.')}</p>
    <div className="spec-chip-list spec-honor-list">
      {[...VIDEO_VIEW_HONORS].reverse().map(({ id, threshold }) => <div key={id}>
        <VideoHonor views={threshold} />
        <p className="spec-type-meta"><Token name={`honor-${id}-bg`} /><Token name={`honor-${id}-text`} /></p>
      </div>)}
    </div>
  </>;
}

const SECTIONS = [
  { id: 'surfaces', en: 'Canvas & Surface', zh: '背景与卡片', description: ['从页面底色到内容表面，建立清晰的层级。', 'Build a clear hierarchy from the page canvas to content surfaces.'], Component: Surfaces },
  { id: 'buttons', en: 'Buttons', zh: '按钮', description: ['四种用途，三种状态。每一个状态都可以直接对照。', 'Four purposes, three states. Compare every state directly.'], Component: Buttons },
  { id: 'typography', en: 'Typography', zh: '文字', description: ['用字号、字重和颜色表达内容的重要程度。', 'Express content hierarchy through size, weight, and color.'], Component: Typography },
  { id: 'chips', en: 'Tag / Chip', zh: '标签', description: ['分类、认证与播放荣誉，使用共享主题变量。', 'Categories, verification, and view honors use shared theme tokens.'], Component: Chips },
  { id: 'tooltips', en: 'Tooltip', zh: '悬停提示', description: ['沿用当前主题的 Surface 配色，支持文字和组件内容。', 'Use the current Surface colors for text and embedded components.'], Component: Tooltips },
  { id: 'alerts', en: 'Alert', zh: '状态提示', description: ['信息、警告、错误三种语义，使用同一套结构。', 'Information, warning, and error share a consistent structure.'], Component: Alerts },
  { id: 'tabs', en: 'Tabs', zh: '标签页', description: ['同一内容区域内切换视图，选中、悬停、禁用与键盘操作保持一致。', 'Switch views within one content area, with consistent selection, hover, disabled, and keyboard behavior.'], Component: TabsSample },
  { id: 'table', en: 'Table', zh: '表格', description: ['以对齐、留白和分隔线组织数据，覆盖排序、空态与加载。', 'Organize data through alignment, spacing, and dividers, including sorting, empty, and loading states.'], Component: TableSample },
  { id: 'pagination', en: 'Pagination', zh: '分页', description: ['轻量、无边框，沿用 Info Alert 的 Primary 派生色。', 'Lightweight and borderless, using the Primary-derived Info Alert colors.'], Component: PaginationSample },
];

export default function DesignSpec() {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const [mode, setMode] = useState('compare');
  const themes = mode === 'compare' ? ['light', 'dark'] : [mode];

  return (
    <main className="design-spec" aria-labelledby="spec-page-title">
      <header className="spec-page-header">
        <p className="spec-eyebrow">ICEDATA / DESIGN SYSTEM</p>
        <h1 id="spec-page-title">{t('视觉规范', 'Visual specification')}<span>01</span></h1>
        <p className="spec-page-description">{t('一套界面，两种光线。让颜色、层级与交互保持一致。', 'One interface, two kinds of light. A consistent language for color, hierarchy, and interaction.')}</p>
        <div className="spec-source-note"><span className="spec-source-dot" />{t('沿用现有品牌色与卡片规范，补齐组件状态。', 'Built on the existing brand and surface styles, with complete component states.')}</div>
      </header>

      <aside className="ds-alert spec-component-policy" data-variant="info" aria-label={t('基础组件使用约定', 'Basic component policy')}>
        <strong>{t('基础组件优先使用 Ant Design', 'Use Ant Design for basic components')}</strong>
        <p>{t('输入、选择、开关等基础控件，Ant Design 已提供的就直接复用，不自行重写，也不使用原生 HTML 表单控件替代。主题与业务组合按项目规范扩展。', 'Reuse Ant Design inputs, selectors, switches, and other available controls instead of rebuilding them or using native HTML form controls. Apply project themes and business composition on top.')}</p>
        <p>{t('少量简短选项（通常 2–4 个）用 Segmented 或 Radio.Group 横排；选项较多用 Select；独立布尔设置用 Switch，多选用 Checkbox。', 'Show a few short options (usually 2–4) inline with Segmented or Radio.Group; use Select for longer lists, Switch for independent boolean settings, and Checkbox for multiple selections.')}</p>
      </aside>

      <div className="spec-toolbar">
        <nav className="spec-section-nav" aria-label={t('规范章节', 'Specification sections')}>
          {SECTIONS.map(({ id, zh, en }) => <a key={id} href={`#spec-${id}`}>{t(zh, en)}</a>)}
        </nav>
        <Segmented className="ds-segmented spec-mode-switch" aria-label={t('预览模式', 'Preview mode')} value={mode} onChange={setMode} options={[
          { value: 'light', icon: <SunOutlined />, label: t('白天', 'Light') },
          { value: 'dark', icon: <MoonOutlined />, label: t('夜间', 'Dark') },
          { value: 'compare', label: t('对照', 'Compare') },
        ]} />
      </div>

      {SECTIONS.map(({ id, zh, en, description, Component }, index) => (
        <section className="spec-section" id={`spec-${id}`} key={id} aria-labelledby={`spec-${id}-title`}>
          <div className="spec-section-heading">
            <span className="spec-section-number">{String(index + 1).padStart(2, '0')}</span>
            <div><h2 id={`spec-${id}-title`}>{t(zh, en)}{isZh && <span>{en}</span>}</h2><p>{t(...description)}</p></div>
          </div>
          <div className={`spec-theme-grid${mode === 'compare' ? ' is-compare' : ''}`}>
            {themes.map((theme) => <ThemePreview theme={theme} t={t} key={theme}><Component t={t} /></ThemePreview>)}
          </div>
        </section>
      ))}
      <footer className="spec-page-footer">{t('冰数据 · 视觉规范', 'Icedata · Visual specification')}<span>{t('所有色值取自实际主题变量', 'All colors read from the actual theme tokens')}</span></footer>
    </main>
  );
}
