import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Spin, Tabs, Typography } from 'antd';
import VChart from '@visactor/vchart';
import { useDocThemeDark } from '../../../hooks/useDocThemeDark.js';
import ZhongshuLabel from './ZhongshuLabel.jsx';
import './OverviewTrendChart.css';

const { Text } = Typography;

/** @typedef {{ date: string, indicators: Record<string, number|null> }} TrendDay */

export const TAB_SUBMISSIONS = 'submissions';
export const TAB_VIDEO_STATS = 'videoStats';

const SUBMISSION_TREND_METRICS = [
  { key: 'newVideoCount', label: '新投稿视频数', labelEn: 'New Videos' },
  { key: 'activeUserCount', label: '活跃作者数', labelEn: 'Active Producers' },
];

/** 视频数据 Tab：折线维度（与后端字段一致） */
export const VIDEO_TREND_METRICS = [
  { key: 'view', label: '播放量', labelEn: 'Views' },
  { key: 'favorite', label: '收藏量', labelEn: 'Favorites' },
  { key: 'like', label: '点赞量', labelEn: 'Likes' },
  { key: 'coin', label: '硬币量', labelEn: 'Coins' },
  { key: 'share', label: '分享量', labelEn: 'Shares' },
  { key: 'reply', label: '评论量', labelEn: 'Comments' },
  { key: 'danmaku', label: '弹幕量', labelEn: 'Danmaku' },
];

/**
 * 中术50 七条系列固定色板：自蓝起绕回，不含青/绿
 * 顺序对齐 VIDEO_TREND_METRICS
 */
const VIDEO_STATS_HIGHLIGHT_VARS = [
  '--highlight-blue',
  '--highlight-indigo',
  '--highlight-violet',
  '--highlight-faint-purple',
  '--highlight-red',
  '--highlight-orange',
  '--highlight-yellow',
];

function readTrendColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    submissions: ['--highlight-blue', '--highlight-orange'].map((name) => styles.getPropertyValue(name).trim()),
    videoStats: VIDEO_STATS_HIGHLIGHT_VARS.map((name) => styles.getPropertyValue(name).trim()),
  };
}

/**
 * @param {string} tab
 * @param {TrendDay[]} trend
 * @param {{ submissions: string[], videoStats: string[] }} colors
 */
function buildLineSpec(tab, trend, colors, isZh) {
  if (!trend?.length) {
    return null;
  }

  const transparent = { background: 'transparent' };

  const isSubmissions = tab === TAB_SUBMISSIONS;
  const metrics = isSubmissions ? SUBMISSION_TREND_METRICS : VIDEO_TREND_METRICS;
  const seriesColors = isSubmissions ? colors.submissions : colors.videoStats;

  /** 长表：多折线 */
  const values = [];
  for (const row of trend) {
    const ind = row.indicators ?? {};
    for (const { key, label, labelEn } of metrics) {
      values.push({
        date: row.date,
        series: isZh ? label : labelEn,
        value: ind[key] ?? (isSubmissions ? 0 : null),
      });
    }
  }

  return {
    ...transparent,
    type: 'line',
    invalidType: 'break',
    stack: false,
    data: [{
      id: 'trend',
      values,
      fields: { date: { type: 'ordinal', domain: trend.map((row) => row.date) } },
    }],
    xField: 'date',
    yField: 'value',
    seriesField: 'series',
    color: seriesColors,
    point: { visible: true, style: { symbolType: 'circle' } },
    line: { visible: true, style: { lineWidth: 1.5 } },
    tooltip: { visible: true, style: { shape: { shapeType: 'circle' } } },
    legends: {
      visible: true,
      orient: 'bottom',
      padding: { top: 12 },
      item: { shape: { style: { symbolType: 'circle' } } },
    },
    crosshair: { xField: { visible: true } },
    axes: [
      { orient: 'bottom', type: 'band' },
      { orient: 'left', title: { visible: true, text: isSubmissions ? (isZh ? '数量' : 'Count') : (isZh ? '数值' : 'Value') } },
    ],
  };
}

/**
 * @param {object} props
 * @param {TrendDay[]} props.trend
 * @param {boolean} [props.loading=false]
 * @param {string} [props.activeTab]
 * @param {(tab: string) => void} [props.onTabChange]
 */
export default function OverviewTrendChart({ trend, loading = false, activeTab = TAB_SUBMISSIONS, onTabChange }) {
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const isDark = useDocThemeDark();

  const colors = useMemo(() => readTrendColors(), [isDark]);
  const spec = useMemo(
    () => loading ? null : buildLineSpec(activeTab, trend, colors, isZh),
    [activeTab, trend, colors, loading, isZh],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !spec) {
      if (chartRef.current) {
        chartRef.current.release();
        chartRef.current = null;
      }
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.release();
      chartRef.current = null;
    }

    const chart = new VChart(spec, {
      dom: el,
      theme: isDark ? 'dark' : 'light',
    });
    chartRef.current = chart;
    chart.renderAsync();

    const resize = () => {
      const c = chartRef.current;
      if (!c || !hostRef.current) return;
      const { width, height } = hostRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        c.resize(width, height);
      }
    };

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(resize);
    });
    ro.observe(el);
    requestAnimationFrame(resize);

    return () => {
      ro.disconnect();
      if (chartRef.current) {
        chartRef.current.release();
        chartRef.current = null;
      }
    };
  }, [spec, isDark]);

  const tabItems = useMemo(
    () => [
      { key: TAB_SUBMISSIONS, label: isZh ? '投稿与作者' : 'Videos & Producers' },
      {
        key: TAB_VIDEO_STATS,
        label: <ZhongshuLabel focusable={false}>{isZh ? '中术50视频数据' : 'Representative Videos'}</ZhongshuLabel>,
      },
    ],
    [isZh],
  );

  const empty = !trend?.length;

  return (
    <Card className="overview-panel ds-surface overview-section-card overview-panel--trend" variant="borderless" title={t('数据趋势', 'Data Trends')}>
      <div className="overview-trend-card-inner">
        <Tabs
          activeKey={activeTab}
          onChange={(tab) => onTabChange?.(tab)}
          items={tabItems}
          size="small"
          className="overview-trend-tabs"
        />
        <div className="overview-trend-chart-stage">
          {loading ? (
            <div className="overview-trend-chart-loading" role="status" aria-live="polite" aria-busy="true">
              <div className="overview-trend-chart-loading-content">
                <Spin />
                <Text type="secondary">{t('正在加载趋势数据…', 'Loading trend data…')}</Text>
              </div>
            </div>
          ) : empty ? (
            <div className="overview-trend-chart-empty">
              <Text type="secondary">{t('暂无趋势数据，请先选择日期范围。', 'No trend data. Select a date range first.')}</Text>
            </div>
          ) : (
            <div className="overview-trend-chart-host" ref={hostRef} role="img" aria-label={t('指标趋势折线图', 'Metric trends line chart')} />
          )}
        </div>
      </div>
    </Card>
  );
}
