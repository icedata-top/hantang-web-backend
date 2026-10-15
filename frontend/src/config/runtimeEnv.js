/**
 * 全局运行环境配置：
 * - MOCK：前端本地 MOCK 数据
 * - DEV：请求开发环境后端
 * - PROD：请求生产环境后端
 *
 * 可通过 Vite 环境变量覆盖（可选）：
 * - VITE_APP_ENV=MOCK|DEV|PROD
 * - VITE_API_BASE_URL=/api
 *
 * Docker/Caddy 部署可通过 /runtime-config.js 注入：
 * - window.__ICEDATA_RUNTIME_CONFIG__.apiBaseUrl
 */

export const APP_ENV = Object.freeze({
  MOCK: 'MOCK',
  DEV: 'DEV',
  PROD: 'PROD',
});

/** 默认环境（未配置 VITE_APP_ENV 时生效） */
const DEFAULT_ENV = APP_ENV.MOCK;

/** 当前环境：优先取 VITE_APP_ENV，否则使用默认值 */
export const CURRENT_APP_ENV = normalizeAppEnv(import.meta.env?.VITE_APP_ENV) ?? DEFAULT_ENV;

/** DEV / PROD 的 base url（不含路径） */
const BASE_URL_BY_ENV = Object.freeze({
  [APP_ENV.DEV]: '/api',
  [APP_ENV.PROD]: '/api',
});

const RUNTIME_CONFIG = globalThis.window?.__ICEDATA_RUNTIME_CONFIG__ ?? {};
const VITE_API_BASE_URL = normalizeBaseUrl(import.meta.env?.VITE_API_BASE_URL);
const RUNTIME_API_BASE_URL = normalizeBaseUrl(RUNTIME_CONFIG.apiBaseUrl);

/** 是否走 MOCK */
export function isMockEnv() {
  return CURRENT_APP_ENV === APP_ENV.MOCK;
}

/** 返回当前环境下 API base url；MOCK 环境返回空串 */
export function getApiBaseUrl() {
  if (RUNTIME_API_BASE_URL) return RUNTIME_API_BASE_URL;
  if (VITE_API_BASE_URL) return VITE_API_BASE_URL;
  if (isMockEnv()) return '';
  return BASE_URL_BY_ENV[CURRENT_APP_ENV] ?? BASE_URL_BY_ENV[APP_ENV.DEV];
}

function normalizeAppEnv(value) {
  if (!value) return null;
  const upper = String(value).toUpperCase();
  if (upper === APP_ENV.MOCK || upper === APP_ENV.DEV || upper === APP_ENV.PROD) {
    return upper;
  }
  return null;
}

function normalizeBaseUrl(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}
