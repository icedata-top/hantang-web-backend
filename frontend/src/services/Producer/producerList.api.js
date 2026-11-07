import { isMockEnv } from '../../config/runtimeEnv.js';
import { getJson } from '../http/client.js';
import { producerListParams } from '../../pages/producer/producerListQuery.js';

export async function fetchProducerList(query, options) {
  if (!isMockEnv()) return getJson(`/producers?${producerListParams(query)}`, options);
  const { producerInfo } = await import('./producer.mock.js');
  // videos_filtered=5 is from the documented COPY account sample, not its total uploads.
  const producer = { ...producerInfo, videoCount: 5 };
  const matches = (query.minFans == null || producer.fans >= query.minFans)
    && (query.minVideos == null || producer.videoCount >= query.minVideos);
  return { page: query.page, pageSize: query.pageSize, total: matches ? 1 : 0,
    rows: matches && query.page === 1 ? [producer] : [] };
}
