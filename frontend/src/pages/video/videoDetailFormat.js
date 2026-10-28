/** Decode the requested entity as plain text, without interpreting HTML. */
export function formatVideoText(value) {
  return typeof value === 'string' ? value.replaceAll('&amp;', '&') : '';
}

/** Calendar-day difference in Beijing time, independent of the browser's timezone. */
export function getPublicationAgeDays(epochSeconds, now = Date.now()) {
  if (!Number.isFinite(epochSeconds) || !Number.isFinite(now)) return null;
  const published = epochSeconds * 1000;
  if (!Number.isFinite(new Date(published).getTime()) || published > now) return null;
  const day = 86_400_000;
  const offset = 8 * 60 * 60 * 1000;
  return Math.floor((now + offset) / day) - Math.floor((published + offset) / day);
}
