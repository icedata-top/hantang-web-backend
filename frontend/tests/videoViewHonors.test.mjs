import assert from 'node:assert/strict';
import test from 'node:test';
import { getVideoViewHonor } from '../src/constants/video/viewHonors.js';

test('video honors include each threshold and show only the highest reached tier', () => {
  const examples = [
    [0, null], [99_999, null],
    [100_000, 'hall'], [999_999, 'hall'],
    [1_000_000, 'legend'], [9_999_999, 'legend'],
    [10_000_000, 'myth'], [100_000_000, 'myth'],
  ];
  for (const [views, expected] of examples) {
    assert.equal(getVideoViewHonor(views)?.id ?? null, expected, String(views));
  }
});

test('missing or invalid view counts do not award an honor', () => {
  for (const views of [null, undefined, '', '1000000', false, {}, -1, 100_000.5, NaN, Infinity, -Infinity]) {
    assert.equal(getVideoViewHonor(views), null, String(views));
  }
});
