import { parseTime } from '../../components/custom/RelativeTime/relativeTime.js';
import {
  MIN_METRICS_DATE, getDateRangePresets, getDefaultDateRange, getLatestBusinessDate, isDateRangeDisabled,
} from '../../utils/metricsDateRange.js';

/** 与详情页投稿时间一致，按北京时间确定投稿日。 */
export function getVideoPublicationDate(pubdate) {
  const timestamp = parseTime(pubdate);
  return timestamp == null ? null : new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function getVideoHistoryMinDate(publicationDate) {
  return publicationDate ?? MIN_METRICS_DATE;
}

export function getDefaultVideoHistoryRange(latestRecordDate, publicationDate) {
  return getDefaultDateRange(getLatestBusinessDate(latestRecordDate), {
    days: 14, minDate: getVideoHistoryMinDate(publicationDate),
  });
}

export function getVideoHistoryRangePresets(language, latestRecordDate, publicationDate) {
  return getDateRangePresets(language, getLatestBusinessDate(latestRecordDate), {
    minDate: getVideoHistoryMinDate(publicationDate),
  });
}

export function isVideoHistoryDateDisabled(current, info, publicationDate) {
  return isDateRangeDisabled(current, info, { minDate: getVideoHistoryMinDate(publicationDate) });
}
