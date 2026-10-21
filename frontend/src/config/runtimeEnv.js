/**
 * 全局运行环境配置：
 * - MOCK：前端本地 MOCK 数据
 * - DEV：浏览器直接请求本机后端 http://localhost:8080
 * - PROD：请求同源 /api，由部署侧反向代理到后端
 *
 * 可通过 Vite 环境变量覆盖（可选）：
 * - VITE_APP_ENV=MOCK|DEV|PROD
 * - VITE_API_BASE_URL=http://localhost:8080
 *
 * Docker/Caddy 部署可通过 /runtime-config.js 注入：
 * - window.__ICEDATA_RUNTIME_CONFIG__.apiBaseUrl
 */

export const APP_ENV = Object.freeze({
  MOCK: 'MOCK',
  DEV: 'DEV',
  PROD: 'PROD',
});

/** npm run dev 默认连本机后端；生产构建默认走同源 /api */
const DEFAULT_ENV = import.meta.env.DEV ? APP_ENV.DEV : APP_ENV.PROD;

/** 当前环境：优先取 VITE_APP_ENV，否则使用默认值 */
export const CURRENT_APP_ENV = normalizeAppEnv(import.meta.env?.VITE_APP_ENV) ?? DEFAULT_ENV;

/** 本机 Javalin 地址，与后端启动日志中的 Listening on 一致 */
const LOCAL_BACKEND_ORIGIN = 'http://localhost:8080';

/** DEV / PROD 的 base url */
const BASE_URL_BY_ENV = Object.freeze({
  [APP_ENV.DEV]: LOCAL_BACKEND_ORIGIN,
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
