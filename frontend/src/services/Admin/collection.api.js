import { isMockEnv } from '../../config/runtimeEnv.js';
import { getJson } from '../http/client.js';
import { collectionWindow } from '../../pages/Admin/collectionModel.js';

export async function fetchCollectionStatus(source, options) {
  if (!isMockEnv()) return getJson(`/admin/data/collection/${encodeURIComponent(source)}`, options);
  // Explicitly labelled demo data in the page; never used as a fallback for API failures.
  const { startDate, endDate, days } = collectionWindow();
  const tables = { daily: 'video_daily', videos: 'processed_videos', crossings: 'video_collection_gate_crossings', accounts: 'discovered_users' };
  return {
    source, table: `hantang_dynamic.${tables[source]}`, startDate, endDate,
    checkedAt: new Date().toISOString(), health: source === 'daily' ? 'gaps' : 'healthy', hasData: true,
    estimatedRows: source === 'daily' ? null : 12000, latestRecordDate: source === 'daily' ? endDate : null,
    latestAt: source === 'daily' ? null : new Date(Date.now() - 3600000).toISOString(),
    timeKind: source === 'crossings' ? 'ingested' : 'updated', fanRows: source === 'accounts' ? 11000 : null,
    partial: false,
    days: source === 'daily' ? days.map((date, i) => ({ date, hasData: i !== 2, rows: i === 2 ? 0 : 1000 + i * 100 })) : [],
  };
}
