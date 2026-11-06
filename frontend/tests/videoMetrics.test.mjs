import assert from 'node:assert/strict';
import test from 'node:test';
import { VIDEO_METRICS } from '../src/constants/video/metrics.js';
import { addSnapshotDays, buildVideoMetricsModel, fillVideoSnapshots } from '../src/services/Video/videoMetrics.js';
import { buildVideoMetricsChartSpec } from '../src/pages/video/videoMetricsChart.js';

const START = '2026-10-20';
const snapshot = (day, view, overrides = {}) => ({
  date: addSnapshotDays(START, day), snapshotMissing: false,
  indicators: { ...Object.fromEntries(VIDEO_METRICS.map(({ key }) => [key, view])), ...overrides },
});

test('daily changes use D+1 minus D and retain real zero and negative corrections', () => {
  const model = buildVideoMetricsModel([snapshot(0, 100), snapshot(1, 100), snapshot(2, 130), snapshot(3, 120)], START, '2026-10-22');
  assert.deepEqual(model.delta.map((row) => row.indicators.view), [0, 30, -10]);
  assert.equal(model.cumulative.length, 4);
  assert.equal(model.cumulative.at(-1).date, '2026-10-23');
  assert.equal(model.growth, 20);
  assert.equal(model.average, 20 / 3);
  assert.equal(model.days, 3);
});

test('a missing middle day breaks both adjacent deltas without losing endpoint growth', () => {
  const model = buildVideoMetricsModel([snapshot(0, 100), snapshot(2, 160), snapshot(3, 190)], START, '2026-10-22');
  assert.deepEqual(model.delta.map((row) => row.indicators.view), [null, null, 30]);
  assert.equal(model.cumulative[1].indicators.view, null);
  assert.deepEqual(model.missingSnapshots, ['2026-10-21']);
  assert.equal(model.growth, 90);
  assert.equal(model.average, 30);
});

test('partial metrics affect only their series and unknown endpoints never produce growth', () => {
  const model = buildVideoMetricsModel([snapshot(0, 100), snapshot(1, 120, { like: null }), snapshot(2, 130)], START, '2026-10-21');
  assert.deepEqual(model.delta.map((row) => row.indicators.view), [20, 10]);
  assert.deepEqual(model.delta.map((row) => row.indicators.like), [null, null]);
  assert.equal(model.partialSnapshots.length, 1);
  for (const rows of [[snapshot(1, 120)], [snapshot(0, 100)], []]) {
    const missing = buildVideoMetricsModel(rows, START, START);
    assert.equal(missing.growth, null);
    assert.equal(missing.average, null);
  }
});

test('one selected day still has a valid delta when both boundary snapshots exist', () => {
  const model = buildVideoMetricsModel([snapshot(0, 0), snapshot(1, 7)], START, START);
  assert.equal(model.days, 1);
  assert.equal(model.delta[0].indicators.view, 7);
  assert.equal(model.growth, 7);
  assert.equal(model.average, 7);
});

test('a missing publication-day snapshot supplies a zero baseline for all seven metrics and range growth', () => {
  const source = [snapshot(1, 70), snapshot(2, 100)];
  const model = buildVideoMetricsModel(source, START, '2026-10-21', START);
  assert.equal(model.publicationBaselineDate, START);
  assert.equal(model.cumulative[0].baselineAssumed, true);
  assert.equal(model.cumulative[0].snapshotMissing, true);
  for (const { key } of VIDEO_METRICS) {
    assert.equal(model.cumulative[0].indicators[key], 0);
    assert.equal(model.delta[0].indicators[key], 70);
    assert.equal(model.delta[1].indicators[key], 30);
  }
  assert.deepEqual(model.missingSnapshots, []);
  assert.equal(model.growth, 100);
  assert.equal(model.average, 50);
  assert.equal(source.length, 2);
  assert.equal(source[0].indicators.view, 70);
});

test('a publication baseline never fills later gaps or invents a missing closing value', () => {
  const model = buildVideoMetricsModel([snapshot(2, 100)], START, '2026-10-21', START);
  assert.deepEqual(model.delta.map(row => row.indicators.view), [null, null]);
  assert.deepEqual(model.missingSnapshots, ['2026-10-21']);
  assert.equal(model.growth, 100);
  const noClosingSnapshot = buildVideoMetricsModel([], START, START, START);
  assert.equal(noClosingSnapshot.cumulative[0].indicators.view, 0);
  assert.equal(noClosingSnapshot.delta[0].indicators.view, null);
  assert.equal(noClosingSnapshot.growth, null);
});

test('real publication snapshots and partial metrics are preserved, including after backfill', () => {
  const source = [snapshot(0, 5, { like: null }), snapshot(1, 15)];
  const model = buildVideoMetricsModel(source, START, START, START);
  assert.equal(model.publicationBaselineDate, null);
  assert.equal(model.cumulative[0].indicators.view, 5);
  assert.equal(model.cumulative[0].indicators.like, null);
  assert.equal(model.delta[0].indicators.view, 10);
  assert.equal(model.delta[0].indicators.like, null);
  assert.equal(model.partialSnapshots.length, 1);
  const missing = [{ ...snapshot(0, 99), snapshotMissing: true }, snapshot(1, 15)];
  assert.equal(buildVideoMetricsModel(missing, START, START, START).growth, 15);
  assert.equal(missing[0].indicators.view, 99);
});

test('publication must fall within the selected business range to create a baseline', () => {
  for (const publication of [undefined, null, '2026-10-19', '2026-10-21', '2026-10-22']) {
    const model = buildVideoMetricsModel([], START, START, publication);
    assert.equal(model.publicationBaselineDate, null);
    assert.ok(model.cumulative.every(row => Object.values(row.indicators).every(value => value === null)));
  }
});

test('backfilling a gap restores deltas; an absent snapshot flag overrides unexpected counters', () => {
  const rows = [snapshot(0, 100), snapshot(2, 140)];
  assert.deepEqual(buildVideoMetricsModel(rows, START, '2026-10-21').delta.map((row) => row.indicators.view), [null, null]);
  rows.push(snapshot(1, 120));
  assert.deepEqual(buildVideoMetricsModel(rows, START, '2026-10-21').delta.map((row) => row.indicators.view), [20, 20]);
  assert.equal(fillVideoSnapshots([{ ...snapshot(0, 0), snapshotMissing: true }], START, START)[0].indicators.view, null);
});

test('all missing and invalid counts remain null for every metric and calendar date', () => {
  const rows = fillVideoSnapshots([], START, '2026-10-22');
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal(row.snapshotMissing, true);
    assert.equal(Object.keys(row.indicators).length, 7);
    assert.ok(Object.values(row.indicators).every((value) => value === null));
  }
  for (const invalid of [null, undefined, '', '10', NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(fillVideoSnapshots([snapshot(0, invalid)], START, START)[0].indicators.view, null);
  }
});

test('snapshot calendar arithmetic crosses leap days, months and years without timezone drift', () => {
  assert.equal(addSnapshotDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addSnapshotDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addSnapshotDays('2026-12-31', 1), '2027-01-01');
});

test('chart retains nulls and the full date domain; date tooltips explicitly name missing metrics', () => {
  const model = buildVideoMetricsModel([snapshot(0, 100), snapshot(1, 120, { like: null })], START, START);
  const colors = VIDEO_METRICS.map(({ color }) => color);
  const spec = buildVideoMetricsChartSpec(model.cumulative, colors, 'zh', 'cumulative');
  assert.equal(spec.invalidType, 'break');
  assert.deepEqual(spec.data[0].fields.date.domain, [START, '2026-10-21']);
  assert.equal(spec.data[0].values.find((row) => row.date === '2026-10-21' && row.series === '点赞量').value, null);
  const tooltip = spec.tooltip.dimension.content([{ value: '2026-10-21' }]);
  assert.equal(tooltip.length, 7);
  assert.equal(tooltip.find((line) => line.key === '点赞量').value, '暂缺');
  assert.equal(tooltip.find((line) => line.key === '播放量').value, '120');
});
