export const PROCESSING_SOURCES = ['search', 'aggregation', 'scheduler'];
export const PROCESSING_TODOS = ['videoLabels', 'creatorLabels'];

/** Unknown jobs stay unknown; neither pg_cron nor Java implies full/incremental processing. */
export function processingJobMode(name, expectedJobs = []) {
  return expectedJobs.find(job => job.name === name)?.mode ?? 'unknown';
}

export function processingRunHealth(job) {
  if (!job.active) return 'gaps';
  if (job.lastStatus === 'failed') return 'unavailable';
  if (job.lastStatus === 'succeeded') return 'healthy';
  return ['running', 'starting', 'connecting', 'sending'].includes(job.lastStatus) ? 'loading' : 'gaps';
}

export function processingRunLabel(job) {
  if (!job.active) return 'paused';
  if (!job.lastStatus) return 'noRun';
  return ['succeeded', 'failed', 'running', 'starting', 'connecting', 'sending'].includes(job.lastStatus)
    ? `run.${job.lastStatus}` : 'run.unknown';
}
