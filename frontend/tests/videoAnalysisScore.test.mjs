import assert from 'node:assert/strict';
import test from 'node:test';
import { filterScoreEntries, formatScoreAccuracy } from '../src/pages/Admin/videoAnalysisScoreModel.js';

const entries = [
  { aid: 1, outcome: 'correct' },
  { aid: 2, outcome: 'incorrect' },
  { aid: 3, outcome: 'unscorable' },
  { aid: 4, outcome: 'missing_prediction' },
];

test('error details include missing predictions and separate unknown reference entries', () => {
  const before = structuredClone(entries);
  assert.deepEqual(filterScoreEntries(entries, 'errors').map(row => row.aid), [2, 4]);
  assert.deepEqual(filterScoreEntries(entries, 'unscorable').map(row => row.aid), [3]);
  assert.deepEqual(filterScoreEntries(entries, 'all'), entries);
  assert.deepEqual(entries, before);
});

test('zero scores are real zero and a zero denominator stays unknown', () => {
  assert.equal(formatScoreAccuracy(0), '0.0%');
  assert.equal(formatScoreAccuracy(1 / 3), '33.3%');
  assert.equal(formatScoreAccuracy(1), '100.0%');
  assert.equal(formatScoreAccuracy(null), '—');
  assert.equal(formatScoreAccuracy(undefined), '—');
});
