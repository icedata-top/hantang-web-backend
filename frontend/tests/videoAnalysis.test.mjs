import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisProgress, formatAnalysisDuration } from '../src/pages/Admin/videoAnalysisModel.js';

const now = Date.parse('2026-11-20T23:59:30+08:00');
const state = {
  active: true, status: 'running', selected_count: 1000, snapshot_at: new Date(now).toISOString(), elapsed_ms: 60_000,
  summary: { succeeded_count: 400, failed_count: 20 },
  live: { videos_per_minute: 420, eta_ms: 82_857, eta_state: 'available', estimated_completion_at: '2026-11-21T00:00:53+08:00' },
};

test('progress counts only persisted success and final failures and keeps retries in remaining work', () => {
  const result = analysisProgress(state, now);
  assert.equal(result.done, 420);
  assert.equal(result.percent, 42);
  assert.equal(result.remaining, 580);
  assert.equal(result.eta, 82_857);
  assert.equal(result.estimatedCompletion, '2026-11-21T00:00:53+08:00');
  assert.equal(result.averageSpeed, 420);
  assert.equal(analysisProgress({ ...state, summary: { succeeded_count: 999, failed_count: 0 } }, now).percent, 99.9);
});

test('stale or missing snapshots clear throughput and estimates without clearing actual counts', () => {
  for (const data of [state, { ...state, snapshot_at: undefined }]) {
    const result = analysisProgress(data, now + 6000);
    assert.equal(result.stale, true);
    assert.equal(result.speed, null);
    assert.equal(result.eta, null);
    assert.equal(result.estimatedCompletion, null);
    assert.equal(result.done, 420);
  }
});

test('terminal summaries freeze actual duration and discard ETA even with partial failures', () => {
  const result = analysisProgress({ ...state, active: false, status: 'completed_with_failures', summary: { succeeded_count: 980, failed_count: 20 } }, now + 3600000);
  assert.equal(result.terminal, true);
  assert.equal(result.percent, 100);
  assert.equal(result.remaining, 0);
  assert.equal(result.eta, null);
  assert.equal(result.estimatedCompletion, null);
  assert.equal(result.averageSpeed, 1000);
});

test('warming up and absent durations remain unknown and duration formatting crosses days', () => {
  assert.equal(analysisProgress(null, now).eta, null);
  assert.equal(analysisProgress(null, now).etaState, 'warming_up');
  assert.equal(formatAnalysisDuration(null), '—');
  assert.equal(formatAnalysisDuration(-1), '—');
  assert.equal(formatAnalysisDuration(0), '00:00:00');
  assert.equal(formatAnalysisDuration(90061000), '25:01:01');
});
