/** The current catalog is a frontend profile catalog, not a processed_videos relation. */
export function resolveVocalProfile(identifier, catalog) {
  if ((typeof identifier !== 'string' && typeof identifier !== 'number')
    || (typeof identifier === 'number' && !Number.isSafeInteger(identifier))
    || !/^[1-9]\d*$/.test(String(identifier))) return { status: 'invalid' };
  const vocal = catalog.vocal_list.find((entry) => String(entry.id) === String(identifier));
  if (!vocal) return { status: 'missing' };
  const group = catalog.group_list.find((entry) => entry.id === vocal.group_id) ?? null;
  return {
    status: 'ready', vocal, group,
    collectionName: ({ 1: 'Vsinger', 3: '五维介质' })[group?.id] || group?.short_name || group?.name || '',
    imageSrc: normalizeVocalImagePath(vocal.image_path),
    // Presentation accents use existing theme highlights, never the literal fan color.
    accent: vocal.id === 304 ? 'red' : 'blue',
  };
}

/** Vite serves public/vocals at /vocals, without the /public segment. */
export function normalizeVocalImagePath(value) {
  if (typeof value !== 'string') return null;
  const path = value.replace(/^\/public\//, '/');
  return /^\/vocals\/[a-z0-9_-]+\.(?:png|webp|jpe?g)$/i.test(path) ? path : null;
}

export function vocalExternalUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** Match host boundaries, so lookalike domains cannot claim a known artwork platform. */
export function getVocalArtworkSource(value) {
  const url = vocalExternalUrl(value);
  if (!url) return null;
  const hostname = new URL(url).hostname.toLowerCase();
  const platforms = [['bilibili.com', 'Bilibili'], ['booth.pm', 'Booth'], ['vcpedia.cn', 'VCPeida'], ['weibo.com', '微博']];
  return platforms.find(([domain]) => hostname === domain || hostname.endsWith(`.${domain}`))?.[1] ?? null;
}

/** A recurring birthday has no birth year; 2000 only validates month/day including leap day. */
export function formatVocalBirthday(value, isZh = true) {
  if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value)) return null;
  const [month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(2000, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return isZh ? `${month}月${day}日` : new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}
