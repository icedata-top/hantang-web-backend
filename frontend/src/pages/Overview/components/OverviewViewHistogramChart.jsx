import { normalizeLanguage } from '../../../locales/languages.js';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Segmented, Typography } from 'antd';
import VChart from '@visactor/vchart';
import { useDocThemeDark } from '../../../hooks/useDocThemeDark.js';
import { getTranslator } from '../../../i18n.js';
import { formatNumber } from '../../../utils/formatNumber.js';
import './OverviewViewHistogramChart.css';

const { Text } = Typography;

/** @typedef {'all' | 'new'} HistogramSubmissionScope */

/**
 * @typedef {{ code: string, label: string, count: number }} ViewHistogramRow
 */

const SCOPE_ALL = 'all';
const SCOPE_NEW = 'new';

// 按稳定的分桶 code 翻译，兼容接口与 MOCK 返回的不同中文单位写法。
const BUCKET_RANGES = {
  E02: [0, 10], E03: [10, 100], E04: [100, 1000], E05: [1000, 10000],
  E06: [10000, 100000], E07: [100000, 1000000], E08: [1000000, 10000000], E09: [10000000],
};

/**
 * @param {ViewHistogramRow[]} rows
 * @param {string} primaryColor
 */
function buildBarSpec(rows, primaryColor, language) {
  const t = getTranslator(language);
  if (!rows?.length) return null;

  const values = [...rows]
    .sort((a, b) => a.code.localeCompare(b.code, 'en'))
    .map((row) => {
      const range = BUCKET_RANGES[row.code];
      const labels = range?.map((value) => formatNumber(value, normalizeLanguage(language)));
      return { ...row, label: labels ? labels.join('–') + (labels.length === 1 ? '+' : '') : row.label };
    });
  return {
    background: 'transparent',
    type: 'bar',
    data: [{
      id: 'view_hist',
      values,
      fields: { count: { alias: t("视频数") } },
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
      { orient: 'left', title: { visible: true, text: t("视频数") } },
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
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const isDark = useDocThemeDark();

  const activeRows = rows ?? [];

  const primaryColor = useMemo(
    () => getComputedStyle(document.documentElement).getPropertyValue('--theme-primary').trim(),
    [isDark],
  );
  const spec = useMemo(() => buildBarSpec(activeRows, primaryColor, language), [activeRows, primaryColor, language]);

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
    <Card className="overview-panel ds-surface overview-section-card overview-panel--histogram" variant="borderless" title={t("播放量直方图")}>
      <div className="overview-view-histogram-inner">
        <div className="overview-view-histogram-toolbar">
          {asOfDate ? (
            <Text type="secondary" className="overview-view-histogram-toolbar-hint">
              {t("数据截至 {{value0}} （您所选的日期范围结束日）", { value0: asOfDate })}
            </Text>
          ) : (
            <span className="overview-view-histogram-toolbar-hint" aria-hidden />
          )}
          <Segmented
            className="overview-view-histogram-segmented"
            value={scope}
            onChange={(v) => onScopeChange?.(/** @type {HistogramSubmissionScope} */ (v))}
            options={[
              { label: t("全部投稿"), value: SCOPE_ALL },
              { label: t("新投稿"), value: SCOPE_NEW },
            ]}
          />
        </div>
        {empty ? (
          <div className="overview-view-histogram-empty">
            <Text type="secondary">{t("暂无直方图数据，请先选择日期范围。")}</Text>
          </div>
        ) : (
          <div className="overview-view-histogram-host" ref={hostRef} role="img" aria-label={t("播放量分桶柱状图")} />
        )}
      </div>
    </Card>
  );
}
