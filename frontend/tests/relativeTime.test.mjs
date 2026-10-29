import assert from 'node:assert/strict';
import test from 'node:test';
import { getRelativeTimeDetails, getRelativeTimeText, parseTime } from '../src/components/custom/RelativeTime/relativeTime.js';

const NOW = Date.UTC(2026, 9, 29, 4); // 北京时间 2026-10-29 12:00。
const SECOND = 1000;
const HOUR = 3600000;
const DAY = 24 * HOUR;
const detailsAt = (milliseconds, language = 'zh', now = NOW) => getRelativeTimeDetails(milliseconds / 1000, now, language);

test('accepts Unix seconds, numeric strings, unzoned dates, and ISO offsets consistently', () => {
  for (const value of [NOW / 1000, String(NOW / 1000), '2026-10-29 12:00:00', '2026-10-29 12:00',
    '2026-10-29T04:00:00Z', '2026-10-29T12:00:00+08:00', '2026-10-29T09:30:00+0530']) {
    assert.equal(parseTime(value), NOW, String(value));
  }
  assert.equal(parseTime('2026-10-29'), NOW - 12 * HOUR);
  assert.equal(parseTime('2026-10-29T04:00:00.123Z'), NOW + 123);
  assert.equal(parseTime(0), 0);
  assert.equal(parseTime(-1), -1000);
});

test('rejects invalid calendar dates, unsupported values, and malformed offsets', () => {
  for (const value of [null, undefined, '', ' ', false, {}, Infinity, NaN,
    'tomorrow', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-01-00',
    '2026-10-29 24:00:00', '2026-10-29 12:60:00', '2026-10-29 12:00:60',
    '2026-10-29T12:00:00+25:00', '2026-10-29T12:00:00+08:60', '2026-10-29Z', '0000-01-01']) {
    assert.equal(parseTime(value), null, String(value));
    assert.equal(getRelativeTimeDetails(value, NOW), null, String(value));
  }
  assert.notEqual(parseTime('2024-02-29'), null);
  assert.equal(getRelativeTimeText(null), '—');
});

test('past time uses the two-minute, one-hour, calendar-day, and year boundaries', () => {
  const examples = [
    [0, '刚才'], [-120 * SECOND, '刚才'], [-121 * SECOND, '2分钟前'],
    [-3599 * SECOND, '59分钟前'], [-HOUR, '今天 11:00'],
    [-DAY, '昨天 12:00'], [-2 * DAY, '前天 12:00'], [-3 * DAY, '10-26'],
  ];
  for (const [offset, expected] of examples) assert.equal(detailsAt(NOW + offset).relative, expected);
  assert.equal(getRelativeTimeDetails('2025-10-29 12:00:00', NOW).relative, '2025-10-29');
});

test('future time mirrors past rules with natural future labels', () => {
  const examples = [
    [120 * SECOND, '马上'], [121 * SECOND, '2分钟后'], [3599 * SECOND, '59分钟后'],
    [HOUR, '今天 13:00'], [DAY, '明天 12:00'], [2 * DAY, '后天 12:00'], [3 * DAY, '11-01'],
  ];
  for (const [offset, expected] of examples) assert.equal(detailsAt(NOW + offset).relative, expected);
  assert.equal(getRelativeTimeDetails('2027-10-29 12:00:00', NOW).relative, '2027-10-29');
});

test('English relative labels use dates for two days away', () => {
  assert.equal(detailsAt(NOW - 60 * SECOND, 'en').relative, 'Just now');
  assert.equal(detailsAt(NOW + 60 * SECOND, 'en').relative, 'In a moment');
  assert.equal(detailsAt(NOW - 25 * 60000, 'en').relative, '25 minutes ago');
  assert.equal(detailsAt(NOW + 25 * 60000, 'en').relative, 'In 25 minutes');
  assert.equal(detailsAt(NOW - HOUR, 'en').relative, 'Today 11:00');
  assert.equal(detailsAt(NOW - DAY, 'en').relative, 'Yesterday 12:00');
  assert.equal(detailsAt(NOW + DAY, 'en').relative, 'Tomorrow 12:00');
  assert.equal(detailsAt(NOW - 2 * DAY, 'en').relative, '10-27');
  assert.equal(detailsAt(NOW + 2 * DAY, 'en').relative, '10-31');
});

test('day differences floor elapsed 24-hour periods rather than counting midnights', () => {
  const now = parseTime('2026-10-29 00:30:00');
  const details = getRelativeTimeDetails('2026-10-28 22:00:00', now);
  assert.equal(details.absoluteDiff, '2026-10-28 22:00 （0天前）');
  assert.equal(details.relative, '昨天 22:00');
  assert.equal(details.distance, '0天2小时');
  assert.equal(detailsAt(NOW - 25 * HOUR).absoluteDiff, '2026-10-28 11:00 （1天前）');
  assert.equal(detailsAt(NOW + 25 * HOUR).absoluteDiff, '2026-10-30 13:00 （1天后）');
  assert.equal(detailsAt(NOW - 25 * HOUR, 'en').distance, '1 day 1 hour');
  assert.match(detailsAt(NOW + 25 * HOUR, 'en').absoluteDiff, /\(in 1 day\)$/);
});

test('near-midnight short intervals still use minutes before calendar labels', () => {
  const now = parseTime('2026-10-29 00:10:00');
  assert.equal(getRelativeTimeDetails('2026-10-28 23:50:00', now).relative, '20分钟前');
  assert.equal(getRelativeTimeDetails('2026-10-29 00:09:00', now).relative, '刚才');
});

test('relative calendar labels take precedence across year boundaries', () => {
  const now = parseTime('2027-01-01 12:00:00');
  assert.equal(getRelativeTimeDetails('2026-12-31 10:00:00', now).relative, '昨天 10:00');
  assert.equal(getRelativeTimeDetails('2026-12-30 10:00:00', now).relative, '前天 10:00');
  assert.equal(getRelativeTimeDetails('2026-12-30 10:00:00', now, 'en').relative, '2026-12-30');
  assert.equal(getRelativeTimeDetails('2026-12-29 10:00:00', now).relative, '2026-12-29');
});

test('absolute mode, detailed tooltip fields, and a fixed reference remain consistent', () => {
  const details = getRelativeTimeDetails('2026-10-28 10:34:56', NOW);
  assert.equal(getRelativeTimeText(details, 'absolute'), '2026-10-28 10:34');
  assert.equal(getRelativeTimeText(details, 'absolute-diff'), '2026-10-28 10:34 （1天前）');
  assert.equal(getRelativeTimeText(details, 'relative'), '昨天 10:34');
  assert.equal(details.distance, '1天1小时');
  assert.equal(details.unix, Date.UTC(2026, 9, 28, 2, 34, 56) / 1000);
  assert.equal(details.iso, '2026-10-28T02:34:56.000Z');
  assert.deepEqual(getRelativeTimeDetails('2026-10-28 10:34:56', NOW), details);
  assert.equal(getRelativeTimeDetails('2026-10-28 10:34:56', NaN), null);
});

test('early years are parsed literally instead of being shifted into the 1900s', () => {
  assert.equal(getRelativeTimeDetails('0001-01-01 12:00:00', NOW).absolute, '0001-01-01 12:00');
});
