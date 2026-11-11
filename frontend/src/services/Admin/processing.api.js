import { isMockEnv } from '../../config/runtimeEnv.js';
import { getJson } from '../http/client.js';

export async function fetchProcessingStatus(source, options) {
  if (!isMockEnv()) return getJson(`/admin/data/processing/${encodeURIComponent(source)}`, options);
  // This page explicitly labels all MOCK values. Failed real requests never fall back here.
  const expectedJobs = [
    { source: 'search', name: 'hantang-uniseek-search-refresh', schedule: '*/10 * * * *', engine: 'PostgreSQL', mode: 'full' },
    { source: 'aggregation', name: 'hantang-adm-daily', schedule: '*/5 * * * *', engine: 'PostgreSQL', mode: 'by_day' },
  ];
  const expected = expectedJobs.find(job => job.source === source);
  return {
    source, engine: source === 'scheduler' ? 'pg_cron' : 'PostgreSQL', mode: expected?.mode ?? 'inventory',
    checkedAt: new Date().toISOString(), availability: 'available', status: 'ready', health: 'healthy',
    expectedJob: expected?.name, expectedSchedule: expected?.schedule,
    snapshot: source === 'scheduler' ? null : {
      table: `hantang_dynamic.${source === 'search' ? 'adm_uniseek_videos' : 'adm_entity_metrics_daily'}`,
      rows: 1200, estimatedRows: 1200, dataDate: '2026-11-09', updatedAt: new Date().toISOString(), batchId: 'demo-batch', complete: source === 'aggregation' ? true : null,
    },
    task: null, publication: null, notes: source === 'scheduler' ? ['cron_scope'] : [],
    jobs: source === 'scheduler' ? expectedJobs.map((job, index) => ({ id: String(index + 1), name: job.name,
      schedule: job.schedule, active: true, lastStatus: 'succeeded', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() })) : [],
    expectedJobs: source === 'scheduler' ? expectedJobs : [],
  };
}
