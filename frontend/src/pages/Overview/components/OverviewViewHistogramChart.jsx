import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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

// 按稳定的分桶 code 翻译，兼容接口与 MOCK 返回的不同中文单位写法。
const BUCKET_LABELS_EN = {
  E02: '0-10',
  E03: '10-100',
  E04: '100-1K',
  E05: '1K-10K',
  E06: '10K-100K',
  E07: '100K-1M',
  E08: '1M-10M',
  E09: '10M+',
};

/**
 * @param {ViewHistogramRow[]} rows
 * @param {string} primaryColor
 */
function buildBarSpec(rows, primaryColor, isZh) {
  if (!rows?.length) return null;

  const values = [...rows]
    .sort((a, b) => a.code.localeCompare(b.code, 'en'))
    .map((row) => ({ ...row, label: isZh ? row.label : (BUCKET_LABELS_EN[row.code] ?? row.label) }));
  return {
    background: 'transparent',
    type: 'bar',
    data: [{
      id: 'view_hist',
      values,
      fields: { count: { alias: isZh ? '视频数' : 'Videos' } },
    }],
    xField: 'label',
    yField: 'count',
    color: [primaryColor],
    bar: {
      style: { cornerRadius: 4 },
    },
    tooltip: { visible: true },
    crosshair: { xField: { visible: true } },
    axes: [
      { orient: 'bottom', type: 'band', label: { style: { fontSize: 11 } } },
      { orient: 'left', title: { visible: true, text: isZh ? '视频数' : 'Videos' } },
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
  const { i18n } = useTranslation();
  const isZh = String(i18n?.language || 'zh').toLowerCase().startsWith('zh');
  const t = (zh, en) => (isZh ? zh : en);
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const isDark = useDocThemeDark();

  const activeRows = rows ?? [];

  const primaryColor = useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim(),
    [isDark],
  );
  const spec = useMemo(() => buildBarSpec(activeRows, primaryColor, isZh), [activeRows, primaryColor, isZh]);

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
    <Card className="overview-panel ds-surface overview-section-card overview-panel--histogram" variant="borderless" title={t('播放量直方图', 'View Count Histogram')}>
      <div className="overview-view-histogram-inner">
        <div className="overview-view-histogram-toolbar">
          {asOfDate ? (
            <Text type="secondary" className="overview-view-histogram-toolbar-hint">
              {t(`数据截至 ${asOfDate} （您所选的日期范围结束日）`, `Data as of ${asOfDate} (end of the selected date range)`)}
            </Text>
          ) : (
            <span className="overview-view-histogram-toolbar-hint" aria-hidden />
          )}
          <Segmented
            className="overview-view-histogram-segmented"
            value={scope}
            onChange={(v) => onScopeChange?.(/** @type {HistogramSubmissionScope} */ (v))}
            options={[
              { label: t('全部投稿', 'All Videos'), value: SCOPE_ALL },
              { label: t('新投稿', 'New Videos'), value: SCOPE_NEW },
            ]}
          />
        </div>
        {empty ? (
          <div className="overview-view-histogram-empty">
            <Text type="secondary">{t('暂无直方图数据，请先选择日期范围。', 'No histogram data. Select a date range first.')}</Text>
          </div>
        ) : (
          <div className="overview-view-histogram-host" ref={hostRef} role="img" aria-label={t('播放量分桶柱状图', 'Video counts by view range bar chart')} />
        )}
      </div>
    </Card>
  );
}
