import assert from 'node:assert/strict';
import test from 'node:test';
import { createDebouncedAction } from '../src/utils/debounce.js';

test('rapid queries wait for the final click and submit only the latest range', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const submitted = [];
  const query = createDebouncedAction((range) => submitted.push(range));
  query({ startDate: '2026-11-01', endDate: '2026-11-03' });
  context.mock.timers.tick(200);
  const latestRange = { startDate: '2026-11-02', endDate: '2026-11-04' };
  query(latestRange);
  context.mock.timers.tick(299);
  assert.deepEqual(submitted, []);
  context.mock.timers.tick(1);
  assert.deepEqual(submitted, [latestRange]);
  context.mock.timers.tick(1000);
  assert.equal(submitted.length, 1);

  // After settling, the same range can be queried again to refresh its data.
  query(latestRange);
  context.mock.timers.tick(300);
  assert.deepEqual(submitted, [latestRange, latestRange]);
});

test('cancelling pending work prevents stale queries and permits a later query', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const submitted = [];
  const query = createDebouncedAction((range) => submitted.push(range));
  query('old range');
  context.mock.timers.tick(200);
  query.cancel();
  query.cancel();
  context.mock.timers.tick(1000);
  assert.deepEqual(submitted, []);
  query('new range');
  context.mock.timers.tick(300);
  assert.deepEqual(submitted, ['new range']);
});
