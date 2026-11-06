import assert from 'node:assert/strict';
import test from 'node:test';
import dayjs from 'dayjs';
import { getDefaultOverviewFilter, getOverviewRangePresets } from '../src/pages/Overview/overviewDateRange.js';
import { isDateRangeDisabled } from '../src/utils/metricsDateRange.js';

function freezeToday(context) {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 6, 12).getTime() });
}

test('overview uses seven complete business days ending the day before the latest snapshot', (context) => {
  freezeToday(context);
  assert.deepEqual(getDefaultOverviewFilter('2026-11-02'), { startDate: '2026-10-26', endDate: '2026-11-01' });
});

test('7/14/30-day shortcuts need the latest snapshot as their right endpoint, never a nonexistent next snapshot', (context) => {
  freezeToday(context);
  const latestSnapshot = '2026-11-02';
  const ranges = getOverviewRangePresets('zh', latestSnapshot).map(({ value }) => value());
  assert.deepEqual(ranges.map(range => range.map(date => date.format('YYYY-MM-DD'))), [
    ['2026-10-26', '2026-11-01'],
    ['2026-10-19', '2026-11-01'],
    ['2026-10-03', '2026-11-01'],
  ]);
  ranges.forEach(([start, end], index) => {
    assert.equal(end.add(1, 'day').format('YYYY-MM-DD'), latestSnapshot);
    assert.equal(end.startOf('day').diff(start, 'day') + 1, [7, 14, 30][index]);
  });
});

test('manual dates can extend beyond the latest computable business day through yesterday', (context) => {
  freezeToday(context);
  const { startDate } = getDefaultOverviewFilter('2026-11-02');
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']) {
    assert.equal(isDateRangeDisabled(dayjs(date), { from: dayjs(startDate) }), false, date);
  }
  assert.equal(isDateRangeDisabled(dayjs('2026-11-06')), true);
  assert.equal(isDateRangeDisabled(dayjs('2026-11-07')), true);
});

test('snapshot-to-business conversion crosses calendar boundaries and still respects selectable dates', (context) => {
  freezeToday(context);
  assert.deepEqual(getDefaultOverviewFilter('2026-11-01'), { startDate: '2026-10-25', endDate: '2026-10-31' });
  assert.deepEqual(getDefaultOverviewFilter('2026-01-01'), { startDate: '2025-12-25', endDate: '2025-12-31' });
  assert.deepEqual(getDefaultOverviewFilter('2026-11-06'), { startDate: '2026-10-30', endDate: '2026-11-05' });
  assert.deepEqual(getDefaultOverviewFilter('2026-11-07'), { startDate: '2026-10-30', endDate: '2026-11-05' });
  assert.deepEqual(getDefaultOverviewFilter('2025-10-02'), { startDate: '2025-10-01', endDate: '2025-10-01' });
  for (const date of [undefined, null, '', 'invalid', '2025-10-01']) {
    assert.equal(getDefaultOverviewFilter(date), null);
    assert.deepEqual(getOverviewRangePresets('zh', date), []);
  }
});
