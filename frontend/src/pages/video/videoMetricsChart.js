import { VIDEO_METRICS } from '../../constants/video/metrics.js';
import { formatNumber } from '../../utils/formatNumber.js';

export function buildVideoMetricsChartSpec(rows, colors, isZh, mode) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return {
    type: 'line',
    background: 'transparent',
    invalidType: 'break',
    stack: false,
    data: [{
      id: 'video-metrics',
      values: rows.flatMap((row) => VIDEO_METRICS.map(({ key, label, labelEn }) => ({
        date: row.date, series: isZh ? label : labelEn, value: row.indicators[key],
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
        // Include missing metrics in the date tooltip instead of silently omitting them.
        content: (data) => {
          const row = byDate.get(String(data?.[0]?.value));
          return row ? VIDEO_METRICS.map(({ key, label, labelEn }, index) => ({
            key: isZh ? label : labelEn,
            value: row.indicators[key] == null ? (isZh ? '暂缺' : 'Unavailable') : formatNumber(row.indicators[key], 'comma'),
            hasShape: true, shapeType: 'circle', shapeFill: colors[index],
          })) : [];
        },
      },
    },
    legends: { visible: true, orient: 'bottom', padding: { top: 16 }, item: { shape: { style: { symbolType: 'circle' } } } },
    crosshair: { xField: { visible: true } },
    axes: [
      { orient: 'bottom', type: 'band' },
      { orient: 'left', title: { visible: true, text: mode === 'delta' ? (isZh ? '每日增量' : 'Daily change') : (isZh ? '累计值' : 'Cumulative value') } },
    ],
  };
}
