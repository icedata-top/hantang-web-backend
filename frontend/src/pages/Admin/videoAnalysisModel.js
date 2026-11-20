export const CONCURRENCY_OPTIONS = [1, 4, 8, 16, 32, 64];
export const DEFAULT_CONCURRENCY = 8;

export function formatAnalysisDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const seconds = Math.floor(ms / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
}

export function analysisProgress(state, now = Date.now()) {
  const summary = state?.summary;
  const total = state?.selected_count ?? 1000;
  const succeeded = summary?.succeeded_count ?? 0;
  const failed = summary?.failed_count ?? 0;
  const skipped = summary?.skipped_count ?? 0;
  const done = succeeded + failed + skipped;
  const terminal = Boolean(state && !state.active && state.status !== 'idle');
  const timestamp = Date.parse(state?.snapshot_at);
  const stale = Boolean(state?.active && (!Number.isFinite(timestamp) || now - timestamp > 5000));
  return {
    total, succeeded, failed, skipped, done, terminal, stale,
    percent: total > 0 ? Math.min(100, Math.floor(done / total * 1000) / 10) : 0,
    remaining: Math.max(0, total - done),
    speed: stale ? null : state?.live?.videos_per_minute ?? null,
    eta: stale || terminal ? null : state?.live?.eta_ms ?? null,
    etaState: stale || terminal ? 'unavailable' : state?.live?.eta_state ?? 'warming_up',
    estimatedCompletion: stale || terminal ? null : state?.live?.estimated_completion_at ?? null,
    averageSpeed: state?.elapsed_ms > 0 ? done / state.elapsed_ms * 60_000 : null,
  };
}
