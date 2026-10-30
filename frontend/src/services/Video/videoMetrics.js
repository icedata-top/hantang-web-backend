import { VIDEO_METRICS } from '../../constants/video/metrics.js';

/** Calendar arithmetic in UTC keeps dates independent of the browser's timezone and DST. */
export function addSnapshotDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Fill calendar dates explicitly; never turn a missing counter into zero. */
export function fillVideoSnapshots(rows, startDate, endDate) {
  const byDate = new Map((rows ?? []).map((row) => [row.date, row]));
  const cumulative = [];
  for (let date = startDate; date <= endDate; date = addSnapshotDays(date, 1)) {
    const row = byDate.get(date);
    const snapshotMissing = !row || row.snapshotMissing === true;
    const indicators = Object.fromEntries(VIDEO_METRICS.map(({ key }) => [key,
      !snapshotMissing && Number.isSafeInteger(row?.indicators?.[key]) ? row.indicators[key] : null,
    ]));
    cumulative.push({ date, snapshotMissing, indicators });
  }
  return cumulative;
}

/** Business days [start, end] use snapshots [start, end + 1], matching Overview. */
export function buildVideoMetricsModel(rows, startDate, endDate) {
  const cumulative = fillVideoSnapshots(rows, startDate, addSnapshotDays(endDate, 1));
  const delta = cumulative.slice(0, -1).map((row, index) => ({
    date: row.date,
    indicators: Object.fromEntries(VIDEO_METRICS.map(({ key }) => {
      const before = row.indicators[key];
      const after = cumulative[index + 1].indicators[key];
      return [key, before != null && after != null ? after - before : null];
    })),
  }));
  const startViews = cumulative[0].indicators.view;
  const endViews = cumulative.at(-1).indicators.view;
  const growth = startViews != null && endViews != null ? endViews - startViews : null;
  return {
    cumulative,
    delta,
    growth,
    average: growth == null ? null : growth / delta.length,
    days: delta.length,
    missingSnapshots: cumulative.filter((row) => row.snapshotMissing).map((row) => row.date),
    partialSnapshots: cumulative.filter((row) => !row.snapshotMissing && VIDEO_METRICS.some(({ key }) => row.indicators[key] == null)),
  };
}
