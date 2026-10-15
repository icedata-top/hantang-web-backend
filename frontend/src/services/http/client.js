import { getApiBaseUrl } from '../../config/runtimeEnv.js';

const inFlightRequestMap = new Map();

export class ApiError extends Error {
  /**
   * @param {number|string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

/**
 * 发起 POST 请求并返回“已解壳”的 data/result。
 * @param {string} path 形如 /overview/get-indicators
 * @param {unknown} [body]
 */
export async function postJson(path, body) {
  const url = buildApiUrl(path);
  const requestBody = JSON.stringify(body ?? {});
  const dedupeKey = `${url.toString()}::${requestBody}`;

  if (inFlightRequestMap.has(dedupeKey)) {
    return inFlightRequestMap.get(dedupeKey);
  }

  const requestPromise = fetch(url.toString(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: requestBody,
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const raw = await res.json();
      return unwrapPayload(raw);
    })
    .finally(() => {
      inFlightRequestMap.delete(dedupeKey);
    });

  inFlightRequestMap.set(dedupeKey, requestPromise);
  return requestPromise;
}

function buildApiUrl(path) {
  const baseUrl = getApiBaseUrl();
  const normalizedPath = String(path).replace(/^\/+/, '');

  if (!baseUrl) {
    return new URL(`/${normalizedPath}`, window.location.origin);
  }

  const normalizedBase = String(baseUrl).replace(/\/+$/, '');
  if (/^https?:\/\//i.test(normalizedBase)) {
    return new URL(normalizedPath, `${normalizedBase}/`);
  }

  const basePath = normalizedBase.replace(/^\/+/, '');
  return new URL(`/${basePath}/${normalizedPath}`, window.location.origin);
}

function unwrapPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw;

  const code = raw.code;
  const msg = raw.msg ?? raw.message ?? 'Request failed';

  // 兼容两种成功码：0（旧约定）/ 200（后端当前约定）
  if (code != null && code !== 0 && code !== 200) {
    throw new ApiError(code, String(msg));
  }

  if (Object.prototype.hasOwnProperty.call(raw, 'result')) return raw.result;
  if (Object.prototype.hasOwnProperty.call(raw, 'data')) return raw.data;
  return raw;
}
