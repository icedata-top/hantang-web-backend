import { useEffect, useMemo, useRef } from 'react';
import { Card, Tabs, Typography } from 'antd';
import VChart from '@visactor/vchart';
import { useDocThemeDark } from '../../../hooks/useDocThemeDark.js';
import './OverviewTrendChart.css';

const { Text } = Typography;

/** @typedef {{ date: string, indicators: Record<string, number> }} TrendDay */

export const TAB_NEW_VIDEO = 'newVideo';
export const TAB_ACTIVE_USER = 'activeUser';
export const TAB_VIDEO_STATS = 'videoStats';

/** 视频数据 Tab：折线维度（与后端字段一致） */
export const VIDEO_TREND_METRICS = [
  { key: 'view', label: '播放量' },
  { key: 'favorite', label: '收藏量' },
  { key: 'like', label: '点赞量' },
  { key: 'coin', label: '硬币量' },
  { key: 'share', label: '分享量' },
  { key: 'reply', label: '评论量' },
  { key: 'danmaku', label: '弹幕量' },
];

/**
 * 中术300 七条系列固定色板：自蓝起绕回，不含青/绿
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

function readVideoStatsPalette() {
  if (typeof document === 'undefined') return [];
  const styles = getComputedStyle(document.documentElement);
  return VIDEO_STATS_HIGHLIGHT_VARS.map((name) => styles.getPropertyValue(name).trim()).filter(Boolean);
}

/**
 * @param {string} tab
 * @param {TrendDay[]} trend
 * @param {string[]} [videoStatsColors]
 */
function buildLineSpec(tab, trend, videoStatsColors = []) {
  if (!trend?.length) {
    return null;
  }

  const transparent = { background: 'transparent' };

  if (tab === TAB_NEW_VIDEO) {
    const values = trend.map((row) => ({
      date: row.date,
      value: row.indicators?.newVideoCount ?? 0,
    }));
    return {
      ...transparent,
      type: 'line',
      data: [{ id: 'trend', values }],
      xField: 'date',
      yField: 'value',
      point: { visible: true },
      line: { style: { lineWidth: 2 } },
      tooltip: { visible: true },
      crosshair: { xField: { visible: true } },
      axes: [
        { orient: 'bottom', type: 'band' },
        { orient: 'left', title: { visible: true, text: '新投稿视频数' } },
      ],
    };
  }

  if (tab === TAB_ACTIVE_USER) {
    const values = trend.map((row) => ({
      date: row.date,
      value: row.indicators?.activeUserCount ?? 0,
    }));
    return {
      ...transparent,
      type: 'line',
      data: [{ id: 'trend', values }],
      xField: 'date',
      yField: 'value',
      point: { visible: true },
      line: { style: { lineWidth: 2 } },
      tooltip: { visible: true },
      crosshair: { xField: { visible: true } },
      axes: [
        { orient: 'bottom', type: 'band' },
        { orient: 'left', title: { visible: true, text: '活跃创作者数' } },
      ],
    };
  }

  /** 长表：多折线 */
  const values = [];
  for (const row of trend) {
    const ind = row.indicators ?? {};
    for (const { key, label } of VIDEO_TREND_METRICS) {
      values.push({
        date: row.date,
        series: label,
        value: ind[key] ?? 0,
      });
    }
  }

  return {
    ...transparent,
    type: 'line',
    data: [{ id: 'trend', values }],
    xField: 'date',
    yField: 'value',
    seriesField: 'series',
    ...(videoStatsColors.length === VIDEO_TREND_METRICS.length ? { color: videoStatsColors } : {}),
    point: { visible: true },
    line: { style: { lineWidth: 1.5 } },
    tooltip: { visible: true },
    legends: { visible: true, orient: 'bottom', padding: { top: 12 } },
    crosshair: { xField: { visible: true } },
    axes: [
      { orient: 'bottom', type: 'band' },
      { orient: 'left', title: { visible: true, text: '数值' } },
    ],
  };
}

/**
 * @param {object} props
 * @param {TrendDay[]} props.trend
 * @param {string} [props.activeTab]
 * @param {(tab: string) => void} [props.onTabChange]
 */
export default function OverviewTrendChart({ trend, activeTab = TAB_NEW_VIDEO, onTabChange }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const isDark = useDocThemeDark();

  const videoStatsColors = useMemo(() => readVideoStatsPalette(), [isDark]);
  const spec = useMemo(
    () => buildLineSpec(activeTab, trend, videoStatsColors),
    [activeTab, trend, videoStatsColors],
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
      { key: TAB_NEW_VIDEO, label: '新投稿视频数' },
      { key: TAB_ACTIVE_USER, label: '活跃创作者数' },
      { key: TAB_VIDEO_STATS, label: '中术300视频数据' },
    ],
    [],
  );

  const empty = !trend?.length;

  return (
    <Card className="overview-panel overview-panel--trend" bordered={false} title="趋势图">
      <div className="overview-trend-card-inner">
        <Tabs
          activeKey={activeTab}
          onChange={(tab) => onTabChange?.(tab)}
          items={tabItems}
          size="small"
          className="overview-trend-tabs"
        />
        {empty ? (
          <div className="overview-trend-chart-empty">
            <Text type="secondary">暂无趋势数据，请先选择日期范围。</Text>
          </div>
        ) : (
          <div className="overview-trend-chart-host" ref={hostRef} role="img" aria-label="指标趋势折线图" />
        )}
      </div>
    </Card>
  );
}
