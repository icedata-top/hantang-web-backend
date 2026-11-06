import { isMockEnv } from '../../config/runtimeEnv.js';
import { getJson } from '../http/client.js';
import { getMaxSelectableDate } from '../../utils/metricsDateRange.js';

/** @returns {Promise<{ latestRecordDate: string|null }>} */
export async function fetchDailyLatestDate(options) {
  if (isMockEnv()) {
    return { latestRecordDate: getMaxSelectableDate().format('YYYY-MM-DD') };
  }
  return getJson('/daily/latest-date', options);
}
