export const MAX_LABELING_COUNT = 200000;
export function labelingOverviewRequestError(failure) {
  if (failure?.code === 403) return 'LOCAL_ACCESS_REQUIRED';
  if (failure?.code === 404) return 'LABELING_API_NOT_FOUND';
  return 'OVERVIEW_UNAVAILABLE';
}
export function labelingAvailability(overview, mode) {
  if (!overview?.available) return null;
  return Math.max(0, mode === 'overwrite' ? overview.total_count - overview.manual_count : overview.unlabeled_count);
}
export function clampLabelingCount(count, available) {
  if (available == null) return count;
  if (available <= 0) return 0;
  return Math.min(Math.max(1, Number.isInteger(count) && count > 0 ? count : 10000), available, MAX_LABELING_COUNT);
}
export function validLabelingCount(count, available) {
  return Number.isInteger(count) && count >= 1 && available != null && count <= Math.min(available, MAX_LABELING_COUNT);
}
export function overallLabelingPercent(overview) {
  if (!overview?.available) return null;
  if (overview.total_count === 0) return 0;
  return Math.min(100, Math.floor(overview.labeled_count / overview.total_count * 1000) / 10);
}
