import { getApiBaseUrl } from '../../config/runtimeEnv.js';
import { getJson, postJson } from '../http/client.js';

const BASE = '/admin/content/video-analysis';
export const fetchVideoAnalysis = options => getJson(BASE, options);
export const startVideoAnalysis = concurrency => postJson(`${BASE}/start`, { concurrency });
export const fetchVideoAnalysisFile = file => getJson(`${BASE}/${file}`);
export const fetchVideoAnalysisScore = options => getJson(`${BASE}/score/details`, options);
export const scoreSavedVideoAnalysis = () => postJson(`${BASE}/score`);

export function videoAnalysisDownloadUrl(file) {
  const base = String(getApiBaseUrl() || '').replace(/\/+$/, '');
  const prefix = /^https?:\/\//i.test(base) ? base : base ? `/${base.replace(/^\/+/, '')}` : '';
  return `${prefix}${BASE}/${file}`;
}
