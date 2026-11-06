import assert from 'node:assert/strict';
import test from 'node:test';
import dayjs from 'dayjs';
import {
  getDateRangePresets, getDefaultDateRange, getMaxSelectableDate, isDateRangeDisabled,
} from '../src/utils/metricsDateRange.js';

function freezeToday(context) {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 5, 12).getTime() });
}

test('shared defaults and all presets include the explicit reference date in the day count', (context) => {
  freezeToday(context);
  assert.deepEqual(getDefaultDateRange('2026-11-02'), { startDate: '2026-10-27', endDate: '2026-11-02' });
  const presets = getDateRangePresets('zh', '2026-11-02');
  assert.deepEqual(presets.map(({ value }) => value().map(date => date.format('YYYY-MM-DD'))), [
    ['2026-10-27', '2026-11-02'],
    ['2026-10-20', '2026-11-02'],
    ['2026-10-04', '2026-11-02'],
  ]);
});

test('manual selection still allows dates after the latest snapshot through yesterday, but never today or later', (context) => {
  freezeToday(context);
  assert.equal(getMaxSelectableDate().format('YYYY-MM-DD'), '2026-11-04');
  for (const date of ['2026-11-02', '2026-11-03', '2026-11-04']) {
    assert.equal(isDateRangeDisabled(dayjs(date), { from: dayjs('2026-10-27') }), false, date);
  }
  for (const date of ['2026-11-05', '2026-11-06', '2025-09-30']) {
    assert.equal(isDateRangeDisabled(dayjs(date)), true, date);
  }
  assert.equal(isDateRangeDisabled(dayjs('2026-11-04'), { from: dayjs('2026-10-06') }), false);
  assert.equal(isDateRangeDisabled(dayjs('2026-11-04'), { from: dayjs('2026-10-05') }), true);
});

test('even a Daily date of today or later cannot make a default or shortcut select today', (context) => {
  freezeToday(context);
  for (const date of ['2026-11-05', '2026-11-06']) {
    assert.deepEqual(getDefaultDateRange(date), { startDate: '2026-10-29', endDate: '2026-11-04' });
    assert.equal(getDateRangePresets('en', date)[2].value()[1].format('YYYY-MM-DD'), '2026-11-04');
  }
});

test('ranges are clipped at the earliest selectable date and missing Daily dates do not fall back to yesterday', (context) => {
  freezeToday(context);
  assert.deepEqual(getDefaultDateRange('2025-10-03'), { startDate: '2025-10-01', endDate: '2025-10-03' });
  assert.deepEqual(getDateRangePresets('ja', '2025-10-03')[2].value().map(date => date.format('YYYY-MM-DD')), ['2025-10-01', '2025-10-03']);
  for (const date of [null, '', 'invalid', '2025-09-30']) {
    assert.equal(getDefaultDateRange(date), null);
    assert.deepEqual(getDateRangePresets('zh', date), []);
  }
});

test('callers that omit a Daily reference date retain their existing yesterday-based ranges', (context) => {
  freezeToday(context);
  assert.deepEqual(getDefaultDateRange(), { startDate: '2026-10-29', endDate: '2026-11-04' });
  assert.equal(getDateRangePresets('zh')[0].value()[1].format('YYYY-MM-DD'), '2026-11-04');
});
