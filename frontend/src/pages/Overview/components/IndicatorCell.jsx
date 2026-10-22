import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { Statistic } from 'antd';
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
  const { name, value, dod } = data;
  const displayTitle = title ?? INDICATOR_TITLE[name] ?? name;

  return (
    <div className="indicator-cell">
      <div className="indicator-cell-title">{displayTitle}</div>

      <div className="indicator-cell-main-row">
        {value == null ? (
          <span className="indicator-cell-missing">暂缺</span>
        ) : (
          <Statistic className="indicator-cell-main" value={value} valueStyle={{ color: 'var(--text)' }} />
        )}
      </div>

      <span className="indicator-cell-label">环比</span>
      <div className="indicator-cell-num">
        {value != null && dod != null ? (
          <DeltaRate value={dod} precision={precision} />
        ) : (
          <span className="indicator-cell-label">暂缺</span>
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
