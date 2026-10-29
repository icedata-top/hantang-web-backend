import { isMockEnv } from '../../config/runtimeEnv.js';
import { ApiError, getJson } from '../http/client.js';

export async function fetchProducerInfo(userId, options) {
  if (isMockEnv()) {
    const { producerInfo } = await import('./producer.mock.js');
    if (String(userId) !== producerInfo.userId) throw new ApiError(404, 'Producer not indexed');
    return producerInfo;
  }
  return getJson(`/producers/${encodeURIComponent(userId)}/info`, options);
}

export async function fetchProducerVideos(userId, query, options) {
  if (isMockEnv()) {
    const { producerInfo, producerVideos } = await import('./producer.mock.js');
    const allRows = String(userId) === producerInfo.userId && query.role === 'uploader' ? producerVideos : [];
    const rows = [...allRows].sort((a, b) => {
      const left = a[query.sortBy];
      const right = b[query.sortBy];
      if (left == null || right == null) return left == null ? (right == null ? 0 : 1) : -1;
      return query.order === 'asc' ? left - right : right - left;
    });
    return { userId, ...query, total: rows.length, rows: rows.slice((query.page - 1) * query.pageSize, query.page * query.pageSize) };
  }
  const params = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)]));
  return getJson(`/producers/${encodeURIComponent(userId)}/videos?${params}`, options);
}
