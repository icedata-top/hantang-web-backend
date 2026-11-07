/** Highest first: only one honor is returned for the latest collected cumulative views. */
export const VIDEO_VIEW_HONORS = Object.freeze([
  Object.freeze({ id: 'myth', threshold: 10_000_000, zh: '神话', en: 'Mythic' }),
  Object.freeze({ id: 'legend', threshold: 1_000_000, zh: '传说', en: 'Legendary' }),
  Object.freeze({ id: 'hall', threshold: 100_000, zh: '殿堂', en: 'Hall of Fame' }),
]);

export function getVideoViewHonor(views) {
  if (!Number.isFinite(views) || !Number.isInteger(views) || views < 0) return null;
  return VIDEO_VIEW_HONORS.find(({ threshold }) => views >= threshold) ?? null;
}
