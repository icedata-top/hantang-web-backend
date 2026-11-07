import { getDateRangePresets, getDefaultDateRange, getLatestBusinessDate } from '../../utils/metricsDateRange.js';

export function getDefaultOverviewFilter(latestRecordDate) {
  return getDefaultDateRange(getLatestBusinessDate(latestRecordDate));
}

export function getOverviewRangePresets(language, latestRecordDate) {
  return getDateRangePresets(language, getLatestBusinessDate(latestRecordDate));
}
