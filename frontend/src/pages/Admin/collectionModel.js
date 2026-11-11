export const COLLECTION_SOURCES = ['daily', 'videos', 'crossings', 'accounts'];

/** Seven completed Beijing calendar days; today's still-running ingestion is excluded. */
export function collectionWindow(now = Date.now()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(({ type, value }) => [type, value]));
  const today = Date.parse(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => new Date(today - (7 - i) * 86400000).toISOString().slice(0, 10));
  return { startDate: days[0], endDate: days[6], days };
}

export function summarizeCollectionDays(days = []) {
  return {
    covered: days.filter(day => day.hasData === true).length,
    rows: days.length === 7 && days.every(day => Number.isSafeInteger(day.rows) && day.rows >= 0)
      ? days.reduce((total, day) => total + day.rows, 0) : null,
  };
}
