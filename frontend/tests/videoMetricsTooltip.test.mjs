import assert from 'node:assert/strict';
import test from 'node:test';
import { BaseTooltipProcessor } from '@visactor/vchart/cjs/component/tooltip/processor/base.js';
import { BaseSeriesTooltipHelper } from '@visactor/vchart/cjs/series/base/tooltip-helper.js';
import { VIDEO_METRICS } from '../src/constants/video/metrics.js';
import { buildVideoMetricsChartSpec } from '../src/pages/video/videoMetricsChart.js';

// Exercise VChart's actual per-datum expansion and final tooltip processing, without a DOM/canvas.
function showDateTooltip(spec, date, activeMetrics) {
  const series = {
    id: 'video-metrics', type: 'line',
    getSpec: () => ({}),
    getSeriesField: () => 'series',
    getSeriesKeys: () => [],
    getDimensionField: () => ['date'],
    getMeasureField: () => ['value'],
    getSeriesStyle: () => () => undefined,
    getDefaultShapeType: () => 'circle',
  };
  series.tooltipHelper = new BaseSeriesTooltipHelper(series);
  const datum = spec.data[0].values.filter(row => row.date === date).slice(0, activeMetrics);
  const data = [{ value: date, data: [{ series, datum }] }];
  let tooltip;
  const processor = new BaseTooltipProcessor({
    getSpec: () => spec.tooltip,
    event: { emit() {} },
    tooltipHandler: {
      showTooltip(_activeType, _data, params) {
        tooltip = params.activeTooltipSpec;
        return 0;
      },
    },
  });
  processor.activeType = 'dimension';
  processor._showTooltipByHandler(data, {});
  return tooltip;
}

test('date tooltip contains each metric exactly once regardless of how many data items VChart activates', () => {
  const row = {
    date: '2026-11-02',
    indicators: { view: 318776, favorite: 28884, like: 0, coin: 0, share: 0, reply: 0, danmaku: 2028 },
  };
  const colors = VIDEO_METRICS.map(({ color }) => color);
  for (const mode of ['cumulative', 'delta']) {
    const spec = buildVideoMetricsChartSpec([row], colors, 'zh', mode);
    for (const activeMetrics of [1, 3, 7]) {
      const tooltip = showDateTooltip(spec, row.date, activeMetrics);
      assert.equal(tooltip.title.value, row.date);
      assert.deepEqual(tooltip.content.map(line => line.key), VIDEO_METRICS.map(({ label }) => label));
      assert.deepEqual(tooltip.content.map(line => line.value), ['318,776', '28,884', '0', '0', '0', '0', '2,028']);
      assert.deepEqual(tooltip.content.map(line => line.shapeFill), colors);
    }
  }
});

test('the final date tooltip retains unavailable metrics and real zero in all languages', () => {
  const row = {
    date: '2026-11-02',
    indicators: { view: 120, favorite: 0, like: null, coin: 0, share: 0, reply: 0, danmaku: 0 },
  };
  const colors = VIDEO_METRICS.map(({ color }) => color);
  for (const [language, missing] of [['zh', '暂缺'], ['en', 'Unavailable'], ['ja', 'データなし']]) {
    const spec = buildVideoMetricsChartSpec([row], colors, language, 'cumulative');
    const tooltip = showDateTooltip(spec, row.date, 3);
    assert.equal(tooltip.content.length, 7);
    assert.equal(new Set(tooltip.content.map(line => line.key)).size, 7);
    assert.equal(tooltip.content[1].value, '0');
    assert.equal(tooltip.content[2].value, missing);
  }
});
