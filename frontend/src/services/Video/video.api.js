import { isMockEnv } from '../../config/runtimeEnv.js';
import { ApiError, getJson } from '../http/client.js';

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
