import { getJson, postJson } from '../http/client.js';

const BASE = '/admin/content/video-analysis';
export const fetchVideoAnalysis = options => getJson(BASE, options);
export const startVideoAnalysis = () => postJson(`${BASE}/start`);
export const fetchVideoAnalysisFile = file => getJson(`${BASE}/${file}`);
