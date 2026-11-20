export const SCORE_CLASSES = ['virtual_song', 'non_song', 'non_virtual_song'];

export function filterScoreEntries(entries, filter) {
  if (filter === 'errors') return entries.filter(entry => ['incorrect', 'missing_prediction'].includes(entry.outcome));
  if (filter === 'unscorable') return entries.filter(entry => entry.outcome === 'unscorable');
  return entries;
}

export function formatScoreAccuracy(value) {
  return value == null || !Number.isFinite(value) ? '—' : `${(value * 100).toFixed(1)}%`;
}
