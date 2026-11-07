import { VIDEO_METRICS } from '../../constants/video/metrics.js';
import { formatNumber } from '../../utils/formatNumber.js';
import { getTranslator } from '../../i18n.js';

export function buildVideoMetricsChartSpec(rows, colors, language, mode) {
  const t = getTranslator(language);
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return {
    type: 'line',
    background: 'transparent',
    invalidType: 'break',
    stack: false,
    data: [{
      id: 'video-metrics',
      values: rows.flatMap((row) => VIDEO_METRICS.map(({ key, label }) => ({
        date: row.date, series: t(label), value: row.indicators[key],
      }))),
      fields: { date: { type: 'ordinal', domain: rows.map((row) => row.date) } },
    }],
    xField: 'date',
    yField: 'value',
    seriesField: 'series',
    color: colors,
    point: { visible: true, style: { symbolType: 'circle', size: 5 } },
    line: { style: { lineWidth: 1.5 } },
    tooltip: {
      visible: true,
      activeType: 'dimension',
      confine: true,
      dimension: {
        // Replace the combined tooltip once; `content` is expanded once per active datum.
        // Include missing metrics instead of silently omitting them.
        updateContent: (_content, data) => {
          const row = byDate.get(String(data?.[0]?.value));
          return row ? VIDEO_METRICS.map(({ key, label }, index) => ({
            key: t(label),
            value: row.indicators[key] == null ? (t("暂缺")) : formatNumber(row.indicators[key], 'comma'),
            hasShape: true, shapeType: 'circle', shapeFill: colors[index],
          })) : [];
        },
      },
    },
    legends: { visible: true, orient: 'bottom', padding: { top: 16 }, item: { shape: { style: { symbolType: 'circle' } } } },
    crosshair: { xField: { visible: true } },
    axes: [
      { orient: 'bottom', type: 'band' },
      { orient: 'left', title: { visible: true, text: mode === 'delta' ? (t("每日增量")) : (t("累计值")) } },
    ],
  };
}
