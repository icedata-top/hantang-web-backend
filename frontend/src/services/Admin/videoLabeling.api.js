import { getApiBaseUrl } from '../../config/runtimeEnv.js';
import { getJson, postJson } from '../http/client.js';
const BASE = '/admin/content/video-labeling';
export const fetchVideoLabeling = options => getJson(BASE, options);
export const fetchLabelingOverview = options => getJson(`${BASE}/overview`, options);
export const startVideoLabeling = options => postJson(`${BASE}/start`, options);
export const stopVideoLabeling = () => postJson(`${BASE}/stop`);
export function labelingDownloadUrl(file) {
  const base = String(getApiBaseUrl() || '').replace(/\/+$/, '');
  const prefix = /^https?:\/\//i.test(base) ? base : base ? `/${base.replace(/^\/+/, '')}` : '';
  return `${prefix}${BASE}/${file}`;
}
