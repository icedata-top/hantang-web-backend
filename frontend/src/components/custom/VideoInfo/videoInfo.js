import { parseVideoIdentifier } from '../../../pages/video/videoIdentifier.js';

/** Accept decimal aid values and av-prefixed strings without losing 64-bit precision. */
export function normalizeVideoAid(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const aid = String(value).trim().replace(/^av/i, '');
  if (!/^[1-9]\d*$/.test(aid)) return null;
  const resolved = parseVideoIdentifier(aid);
  return resolved.status === 'valid' ? resolved.aid : null;
}

export function hasHangingOpeningPunctuation(title) {
  return typeof title === 'string' && /^[【（《〈「『〔［｛〖“‘]/u.test(title.trimStart());
}

export function formatVideoDuration(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  const seconds = Math.floor(value);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const clock = `${String(minutes).padStart(hours ? 2 : 1, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return hours ? `${hours}:${clock}` : clock;
}
