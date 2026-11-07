import assert from 'node:assert/strict';
import test from 'node:test';
import dayjs from 'dayjs';
import {
  getDefaultVideoHistoryRange, getVideoHistoryRangePresets, getVideoPublicationDate, isVideoHistoryDateDisabled,
} from '../src/pages/video/videoHistoryDateRange.js';

function freezeToday(context) {
  context.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 10, 6, 12).getTime() });
}

test('history defaults to 14 business days and its default and shortcuts close on the latest Daily snapshot', (context) => {
  freezeToday(context);
  const publication = '2024-02-01';
  assert.deepEqual(getDefaultVideoHistoryRange('2026-11-04', publication), { startDate: '2026-10-21', endDate: '2026-11-03' });
  const ranges = getVideoHistoryRangePresets('zh', '2026-11-04', publication).map(({ value }) => value());
  assert.deepEqual(ranges.map(range => range.map(date => date.format('YYYY-MM-DD'))), [
    ['2026-10-28', '2026-11-03'], ['2026-10-21', '2026-11-03'], ['2026-10-05', '2026-11-03'],
  ]);
  for (const [, end] of ranges) assert.equal(end.add(1, 'day').format('YYYY-MM-DD'), '2026-11-04');
});

test('a recent publication clips the default and all shortcuts at the publication day', (context) => {
  freezeToday(context);
  assert.deepEqual(getDefaultVideoHistoryRange('2026-11-04', '2026-11-01'), { startDate: '2026-11-01', endDate: '2026-11-03' });
  for (const { value } of getVideoHistoryRangePresets('ja', '2026-11-04', '2026-11-01')) {
    assert.deepEqual(value().map(date => date.format('YYYY-MM-DD')), ['2026-11-01', '2026-11-03']);
  }
});

test('publication replaces the old fixed lower bound while manual selection still ends at yesterday and spans at most 30 days', (context) => {
  freezeToday(context);
  const disabled = (date, from) => isVideoHistoryDateDisabled(dayjs(date), from ? { from: dayjs(from) } : undefined, '2024-02-29');
  assert.equal(disabled('2024-02-28'), true);
  assert.equal(disabled('2024-02-29'), false);
  assert.equal(disabled('2025-09-30'), false);
  assert.equal(disabled('2026-11-05'), false);
  assert.equal(disabled('2026-11-06'), true);
  assert.equal(disabled('2026-11-07'), true);
  assert.equal(disabled('2026-11-05', '2026-10-07'), false);
  assert.equal(disabled('2026-11-05', '2026-10-06'), true);
  assert.deepEqual(getDefaultVideoHistoryRange('2025-10-02', '2024-02-29'), { startDate: '2025-09-18', endDate: '2025-10-01' });
});

test('publication is derived from the Beijing calendar date rather than the browser timezone', () => {
  const unix = Date.parse('2026-11-01T16:30:00Z') / 1000;
  assert.equal(getVideoPublicationDate(unix), '2026-11-02');
  assert.equal(getVideoPublicationDate(String(unix)), '2026-11-02');
  assert.equal(getVideoPublicationDate('2026-11-01T16:30:00Z'), '2026-11-02');
  assert.equal(getVideoPublicationDate('2026-11-02 00:30:00'), '2026-11-02');
  assert.equal(getVideoPublicationDate(null), null);
  assert.equal(getVideoPublicationDate('2026-02-30'), null);
});

test('no default is invented when the latest snapshot precedes publication, but manual selection remains available', (context) => {
  freezeToday(context);
  assert.equal(getDefaultVideoHistoryRange('2026-11-04', '2026-11-04'), null);
  assert.deepEqual(getVideoHistoryRangePresets('zh', '2026-11-04', '2026-11-04'), []);
  assert.equal(isVideoHistoryDateDisabled(dayjs('2026-11-04'), undefined, '2026-11-04'), false);
  for (const date of [null, undefined, '', 'invalid']) assert.equal(getDefaultVideoHistoryRange(date, '2026-10-01'), null);
  assert.equal(getDefaultVideoHistoryRange('2026-11-06', '2026-11-06'), null);
  assert.equal(isVideoHistoryDateDisabled(dayjs('2026-11-06'), undefined, '2026-11-06'), true);
  assert.deepEqual(getDefaultVideoHistoryRange('2026-11-07', '2026-10-01'), { startDate: '2026-10-23', endDate: '2026-11-05' });
});
