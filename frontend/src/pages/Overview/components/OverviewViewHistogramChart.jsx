import { useEffect, useMemo, useRef } from 'react';
import { Card, Segmented, Typography } from 'antd';
import VChart from '@visactor/vchart';
import { useDocThemeDark } from '../../../hooks/useDocThemeDark.js';
import './OverviewViewHistogramChart.css';

const { Text } = Typography;

/** @typedef {'all' | 'new'} HistogramSubmissionScope */

/**
 * @typedef {{ code: string, label: string, count: number }} ViewHistogramRow
 */

const SCOPE_ALL = 'all';
const SCOPE_NEW = 'new';

/**
 * @param {ViewHistogramRow[]} rows
 */
function buildBarSpec(rows) {
  if (!rows?.length) return null;

  const values = [...rows].sort((a, b) => a.code.localeCompare(b.code, 'en'));
  return {
    background: 'transparent',
    type: 'bar',
    data: [{ id: 'view_hist', values }],
    xField: 'label',
    yField: 'count',
    bar: {
      style: { cornerRadius: 4 },
    },
    tooltip: { visible: true },
    crosshair: { xField: { visible: true } },
    axes: [
      { orient: 'bottom', type: 'band', label: { style: { fontSize: 11 } } },
      { orient: 'left', title: { visible: true, text: '视频数' } },
    ],
  };
}

/**
 * @param {object} props
 * @param {ViewHistogramRow[]} props.rows 当前 scope 分桶数据
 * @param {string} [props.asOfDate] YYYY-MM-DD，筛选结束日（数据截至日）
 * @param {HistogramSubmissionScope} [props.scope]
 * @param {(scope: HistogramSubmissionScope) => void} [props.onScopeChange]
 */
export default function OverviewViewHistogramChart({ rows, asOfDate, scope = SCOPE_ALL, onScopeChange }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const isDark = useDocThemeDark();

  const activeRows = rows ?? [];

  const spec = useMemo(() => buildBarSpec(activeRows), [activeRows]);

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

  const empty = !activeRows?.length;

  return (
    <Card className="overview-panel overview-panel--histogram" bordered={false} title="播放量直方图">
      <div className="overview-view-histogram-inner">
        <div className="overview-view-histogram-toolbar">
          {asOfDate ? (
            <Text type="secondary" className="overview-view-histogram-toolbar-hint">
              数据截至 {asOfDate} （您所选的日期范围结束日）
            </Text>
          ) : (
            <span className="overview-view-histogram-toolbar-hint" aria-hidden />
          )}
          <Segmented
            className="overview-view-histogram-segmented"
            value={scope}
            onChange={(v) => onScopeChange?.(/** @type {HistogramSubmissionScope} */ (v))}
            options={[
              { label: '全部投稿', value: SCOPE_ALL },
              { label: '新投稿', value: SCOPE_NEW },
            ]}
          />
        </div>
        {empty ? (
          <div className="overview-view-histogram-empty">
            <Text type="secondary">暂无直方图数据，请先选择日期范围。</Text>
          </div>
        ) : (
          <div className="overview-view-histogram-host" ref={hostRef} role="img" aria-label="播放量分桶柱状图" />
        )}
      </div>
    </Card>
  );
}
