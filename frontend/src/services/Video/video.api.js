import { isMockEnv } from '../../config/runtimeEnv.js';
import { ApiError, getJson } from '../http/client.js';
import { fillVideoSnapshots } from './videoMetrics.js';

export async function fetchVideoInfo(aid, options) {
  if (isMockEnv()) {
    const { videoInfo } = await import('./video.mock.js');
    if (String(aid) !== String(videoInfo.aid)) throw new ApiError(404, 'Video not found');
    return videoInfo;
  }
  return getJson(`/videos/${encodeURIComponent(aid)}/info`, options);
}

export async function fetchVideoLatestMetrics(aid, options) {
  if (isMockEnv()) {
    // No real daily record was supplied with the documented sample. Do not invent counters.
    throw new ApiError(404, 'No daily snapshot available');
  }
  return getJson(`/videos/${encodeURIComponent(aid)}/latest-metrics`, options);
}

/** Inclusive snapshot dates; no delta computation or zero filling in the API client. */
export async function fetchVideoDailyMetrics(aid, startDate, endDate, options) {
  if (isMockEnv()) {
    // No real daily sample is documented. Mirror the API's explicit missing-date rows.
    const rows = fillVideoSnapshots([], startDate, endDate);
    return { aid, startDate, endDate, rows };
  }
  const query = new URLSearchParams({ startDate, endDate });
  return getJson(`/videos/${encodeURIComponent(aid)}/daily-metrics?${query}`, options);
}

/**
 * 单视频播放过线记录：接口一次返回全部记录（已按 gateValue 降序），无记录时 rows 为空数组。
 * 分页与量级筛选都在前端完成，不会重复请求。
 */
export async function fetchVideoGateCrossings(aid, options) {
  if (isMockEnv()) {
    // MOCK has no real crossing sample; never invent milestones.
    return { aid, rows: [] };
  }
  return getJson(`/videos/${encodeURIComponent(aid)}/gate-crossings`, options);
}
