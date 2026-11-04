import { getLanguageSettings } from '../../../locales/languages.js';
import { useTranslation } from 'react-i18next';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { Statistic } from 'antd';
import ZhongshuLabel from './ZhongshuLabel.jsx';
import './IndicatorCell.css';

/** 指标 name → 展示名（无映射时回退为 name） */
const INDICATOR_TITLE = {
  newVideoCount: '新投稿视频数',
  activeUserCount: '活跃创作者数',
  view: '中术50播放',
  favorite: '中术50收藏',
};

/**
 * @param {object} props
 * @param {{ name: string, value: number | null, dod?: number | null }} props.data
 * @param {number} [props.precision=1] 环比百分比显示的小数位
 * @param {string} [props.title] 覆盖第一行标题
 */
export default function IndicatorCell({ data, precision = 1, title }) {
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  const { name, value, dod } = data;
  const displayTitle = title ?? t(INDICATOR_TITLE[name] ?? name);
  const isZhongshuMetric = name === 'view' || name === 'favorite';

  return (
    <div className="indicator-cell" lang={getLanguageSettings(language).lang}>
      <div className="indicator-cell-title">
        {isZhongshuMetric ? <ZhongshuLabel>{displayTitle}</ZhongshuLabel> : displayTitle}
      </div>

      <div className="indicator-cell-main-row">
        {value == null ? (
          <span className="indicator-cell-missing">{t("暂缺")}</span>
        ) : (
          <Statistic className="indicator-cell-main" value={value} valueStyle={{ color: 'var(--text)' }} />
        )}
      </div>

      <span className="indicator-cell-label" title={t("环比")}>{t("环比")}</span>
      <div className="indicator-cell-num">
        {value != null && dod != null ? (
          <DeltaRate value={dod} precision={precision} />
        ) : (
          <span className="indicator-cell-label">{t("暂缺")}</span>
        )}
      </div>
    </div>
  );
}

function DeltaRate({ value, precision }) {
  const pct = value * 100;
  const isZero = value === 0 || Math.abs(value) < Number.EPSILON;
  const isUp = value > 0;
  const isDown = value < 0;

  let contentStyle = { color: 'var(--trend-flat)' };
  let prefix = <MinusOutlined />;

  if (isUp) {
    contentStyle = { color: 'var(--trend-up)' };
    prefix = <ArrowUpOutlined />;
  } else if (isDown) {
    contentStyle = { color: 'var(--trend-down)' };
    prefix = <ArrowDownOutlined />;
  }

  return (
    <Statistic
      className="indicator-cell-rate"
      value={isZero ? 0 : Math.abs(pct)}
      precision={precision}
      prefix={prefix}
      suffix="%"
      styles={{ content: contentStyle }}
    />
  );
}
