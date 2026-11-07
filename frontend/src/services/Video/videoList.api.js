import { isMockEnv } from '../../config/runtimeEnv.js';
import { getJson } from '../http/client.js';
import { videoListParams } from '../../pages/video/videoListQuery.js';

export async function fetchVideoList(query, options) {
  if (!isMockEnv()) return getJson(`/videos?${videoListParams(query)}`, options);
  const { videoInfo } = await import('./video.mock.js');
  // The documented sample has no cumulative metrics: preserve unknown values in MOCK too.
  const video = { ...videoInfo, aid: String(videoInfo.aid), userId: String(videoInfo.uploader.userId), view: null, favorite: null, like: null, recordDate: null };
  const beijingDate = new Date(video.pubdate * 1000 + 8 * 3600000).toISOString().slice(0, 10);
  const matches = (!query.startDate || beijingDate >= query.startDate) && (!query.endDate || beijingDate <= query.endDate)
    && (query.typeId == null || query.typeId === video.typeId) && query.honor === 'all' && query.minView == null;
  return { page: query.page, pageSize: query.pageSize, total: matches ? 1 : 0, recordDate: null, rows: matches && query.page === 1 ? [video] : [] };
}
